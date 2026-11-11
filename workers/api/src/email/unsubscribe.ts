// Route huy dang ky nhan tin — TASK 11.
//
//   GET  /api/v1/newsletter/unsubscribe?token=<token>&reason=<ly do>
//   POST /api/v1/newsletter/unsubscribe  { "token": "<token>", "reason": "..." }
//
// GET ton tai vi link trong email la link bam (one-click unsubscribe,
// theo thong le RFC 8058). Ca 2 phuong thuc dung chung
// processUnsubscribe:
//   - Token thieu / sai chu ky / het han -> 400 invalid_token
//     (cung 1 thong bao chung — khong lo token het han hay sai).
//   - Token hop le -> cap nhat newsletter_subscribers:
//     status='unsubscribed', unsubscribed_at=now, unsubscribe_reason
//     (neu co). Da huy truoc do -> tra ok + already:true (idempotent).
//   - Email khong co trong bang -> van tra ok (khong lo email co
//     ton tai trong he thong khong).
//   - Rate-limit: 10 request/gio/IP (API_ARCHITECTURE §5) — dem ca
//     request loi validation (tru 401/403) theo quy tac chung.
// Secret ky token: UNSUBSCRIBE_SECRET (Workers Secrets). Thieu secret
// -> 500 (khong bao gio xac minh bang secret rong).

import { ApiError, jsonError, jsonOk, serverError } from '../errors';
import type { Env } from '../env';
import { checkRateLimit, getClientIp } from '../rate-limit';
import { normalizeUnsubscribeReason } from './consent';
import { getSubscriberByEmail, markSubscriberUnsubscribed } from './store';
import { verifyUnsubscribeToken } from './token';

export const UNSUBSCRIBE_RATE_LIMIT = 10; // request / gio / IP
const UNSUBSCRIBE_RATE_WINDOW_MS = 60 * 60 * 1000;

export interface UnsubscribeDeps {
  getSubscriber?: typeof getSubscriberByEmail;
  markUnsubscribed?: typeof markSubscriberUnsubscribed;
  /** Moc thoi gian (ms epoch) — chi dung trong test. */
  nowMs?: number;
  /** Bo qua rate-limit — chi dung trong test. */
  skipRateLimit?: boolean;
}

export interface UnsubscribeResult {
  unsubscribed: boolean;
  already: boolean;
  email: string;
}

/** Xay link huy dang ky co token ky tu API base + token. */
export function buildUnsubscribeUrl(apiBaseUrl: string, token: string): string {
  const base = (apiBaseUrl ?? '').trim().replace(/\/+$/, '') || 'https://visfaracademy.netlify.app';
  return `${base}/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Xu ly huy dang ky tu token da ky. Nem ApiError 400 invalid_token
 * khi token thieu/sai/het han; 503 khi chua cau hinh secret.
 */
export async function processUnsubscribe(
  env: Env,
  token: string,
  reason: unknown,
  deps: UnsubscribeDeps = {},
): Promise<UnsubscribeResult> {
  const secret = (env.UNSUBSCRIBE_SECRET ?? '').trim();
  if (!secret) throw serverError('UNSUBSCRIBE_SECRET is not configured');
  const verified = await verifyUnsubscribeToken(token, secret, { nowMs: deps.nowMs });
  if (!verified.ok) {
    throw new ApiError(
      400,
      'invalid_token',
      'Liên kết hủy đăng ký không hợp lệ hoặc đã hết hạn.',
    );
  }
  const email = verified.email;
  const getSubscriber = deps.getSubscriber ?? getSubscriberByEmail;
  const markUnsubscribed = deps.markUnsubscribed ?? markSubscriberUnsubscribed;
  const normalizedReason = normalizeUnsubscribeReason(reason);
  const subscriber = await getSubscriber(env, email);
  if (!subscriber) {
    // Khong lo email co ton tai hay khong — van tra ok.
    return { unsubscribed: true, already: false, email };
  }
  if (subscriber.status === 'unsubscribed') {
    return { unsubscribed: true, already: true, email };
  }
  await markUnsubscribed(env, email, normalizedReason);
  return { unsubscribed: true, already: false, email };
}

/** Handler GET/POST /api/v1/newsletter/unsubscribe. Tra Response JSON. */
export async function handleNewsletterUnsubscribe(
  env: Env,
  req: Request,
  deps: UnsubscribeDeps = {},
): Promise<Response> {
  try {
    if (!deps.skipRateLimit) {
      const ip = getClientIp(req);
      const rl = await checkRateLimit(
        env,
        `unsubscribe:${ip}`,
        UNSUBSCRIBE_RATE_LIMIT,
        UNSUBSCRIBE_RATE_WINDOW_MS,
      );
      if (!rl.allowed) {
        return jsonError(
          new ApiError(429, 'rate_limited', 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.', {
            retryAfterSec: rl.retryAfterSec,
          }),
        );
      }
    }

    let token = '';
    let reason: unknown = null;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = url.searchParams.get('token') ?? '';
      reason = url.searchParams.get('reason');
    } else if (req.method === 'POST') {
      let body: unknown = null;
      try {
        body = await req.json();
      } catch {
        return jsonError(new ApiError(400, 'invalid_input', 'Nội dung gửi lên không phải JSON.'));
      }
      if (typeof body === 'object' && body !== null) {
        const b = body as { token?: unknown; reason?: unknown };
        token = typeof b.token === 'string' ? b.token : '';
        reason = b.reason ?? null;
      }
    } else {
      return jsonError(new ApiError(400, 'invalid_input', 'Phương thức không được hỗ trợ.'));
    }

    if (!token) {
      return jsonError(
        new ApiError(400, 'invalid_token', 'Liên kết hủy đăng ký không hợp lệ hoặc đã hết hạn.'),
      );
    }
    const result = await processUnsubscribe(env, token, reason, deps);
    return jsonOk({
      unsubscribed: result.unsubscribed,
      already: result.already,
      message: 'Bạn đã hủy nhận tin thành công.',
    });
  } catch (err) {
    if (err instanceof ApiError) return jsonError(err);
    return jsonError(serverError(err instanceof Error ? err.message : 'unsubscribe failed'));
  }
}
