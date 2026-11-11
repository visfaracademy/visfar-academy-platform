// Dang ky newsletter — QA-18-FUNC-01 (form Newsletter footer POST
// /api/v1/newsletter -> 404 vi router chua noi route). Handler nay
// MOI (Task 11 khong co file subscribe): frontend chi gui { email }
// (apps/web/src/lib/newsletter.ts), khong gui email that o day.
//
//   POST /api/v1/newsletter  { "email": "a@example.com", "source"?: "footer" }
//
//   - Rate-limit: 10 request/gio/IP (nhu unsubscribe) — dem ca request
//     loi validation, theo quy tac chung (rate-limit.ts).
//   - Email sai dinh dang -> 400 invalid_email. Body khong phai JSON
//     -> 400 invalid_input. Chua cau hinh Supabase -> 503.
//   - Email moi -> insert newsletter_subscribers (status='subscribed',
//     source mac dinh 'footer'), tra 201 { subscribed:true, duplicate:false }.
//   - Email da subscribed -> KHONG insert them dong, tra 200
//     { subscribed:true, duplicate:true } (chong trung; UNIQUE email
//     o DB la lop chan cuoi — race trung 23505 cung tra duplicate).
//   - Email da unsubscribed truoc do -> mo lai (reactivate), tra 200
//     { subscribed:true, duplicate:false, reactivated:true }.
//   - Khong gui email chao mung o day (E7 chi cho dang ky tai khoan);
//     khong ghi SDT / ho ten (form footer chi co email).

import { ApiError, jsonError, jsonOk, serverError } from '../errors';
import type { Env } from '../env';
import { isSupabaseConfigured } from '../env';
import { checkRateLimit, getClientIp } from '../rate-limit';
import { isUniqueViolation, notConfiguredError } from '../supabase';
import { validateEmail } from '../validation';
import type { SubscriberRow } from './consent';
import {
  getSubscriberByEmail,
  insertSubscriber,
  reactivateSubscriber,
} from './store';

export const NEWSLETTER_RATE_LIMIT = 10; // request / gio / IP
const NEWSLETTER_RATE_WINDOW_MS = 60 * 60 * 1000;

export interface SubscribeDeps {
  getSubscriber?: typeof getSubscriberByEmail;
  insert?: typeof insertSubscriber;
  reactivate?: typeof reactivateSubscriber;
  /** Bo qua rate-limit — chi dung trong test. */
  skipRateLimit?: boolean;
}

export interface SubscribeResult {
  subscribed: boolean;
  duplicate: boolean;
  reactivated: boolean;
}

/** Xu ly dang ky: tra ket qua de handler quyet dinh 200/201. */
export async function processSubscribe(
  env: Env,
  email: string,
  source: string,
  deps: SubscribeDeps = {},
): Promise<SubscribeResult> {
  const getSubscriber = deps.getSubscriber ?? getSubscriberByEmail;
  const insert = deps.insert ?? insertSubscriber;
  const reactivate = deps.reactivate ?? reactivateSubscriber;

  const existing = await getSubscriber(env, email);
  if (existing) {
    if (existing.status === 'subscribed') {
      return { subscribed: true, duplicate: true, reactivated: false };
    }
    await reactivate(env, email);
    return { subscribed: true, duplicate: false, reactivated: true };
  }

  const result = await insert(env, email, source);
  if (result.error) {
    if (isUniqueViolation(result.error)) {
      // Race: request song song cung email vua insert xong.
      const raced = await getSubscriber(env, email);
      if (raced) return { subscribed: true, duplicate: true, reactivated: false };
    }
    throw new ApiError(502, 'upstream_error', 'Hệ thống chưa ghi nhận được. Vui lòng thử lại sau.');
  }
  const rows = result.data;
  if (!rows || rows.length === 0) throw serverError('insertSubscriber returned no row');
  return { subscribed: true, duplicate: false, reactivated: false };
}

/** Handler POST /api/v1/newsletter. Tra Response JSON. */
export async function handleSubscribeNewsletter(
  env: Env,
  req: Request,
  deps: SubscribeDeps = {},
): Promise<Response> {
  try {
    if (!deps.skipRateLimit) {
      const ip = getClientIp(req);
      const rl = await checkRateLimit(
        env,
        `newsletter:${ip}`,
        NEWSLETTER_RATE_LIMIT,
        NEWSLETTER_RATE_WINDOW_MS,
      );
      if (!rl.allowed) {
        return jsonError(
          new ApiError(429, 'rate_limited', 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.', {
            retryAfterSec: rl.retryAfterSec,
          }),
        );
      }
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      return jsonError(new ApiError(400, 'invalid_input', 'Nội dung gửi lên không phải JSON.'));
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError(new ApiError(400, 'invalid_input', 'Dữ liệu gửi lên không đúng định dạng.'));
    }
    const b = body as { email?: unknown; source?: unknown };
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (!validateEmail(email)) {
      return jsonError(new ApiError(400, 'invalid_email', 'Email chưa đúng định dạng.'));
    }
    const source =
      typeof b.source === 'string' && b.source.trim() ? b.source.trim().slice(0, 50) : 'footer';

    if (!isSupabaseConfigured(env)) throw notConfiguredError();

    const result = await processSubscribe(env, email, source, deps);
    return jsonOk(
      {
        subscribed: result.subscribed,
        duplicate: result.duplicate,
        reactivated: result.reactivated,
        message: result.duplicate
          ? 'Email này đã đăng ký nhận tin trước đó.'
          : 'Đăng ký nhận tin thành công.',
      },
      result.duplicate || result.reactivated ? 200 : 201,
    );
  } catch (err) {
    if (err instanceof ApiError) return jsonError(err);
    return jsonError(serverError(err instanceof Error ? err.message : 'subscribe failed'));
  }
}
