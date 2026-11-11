// Webhook Resend — TASK 11 (API_ARCHITECTURE.md §10.2).
//
// POST /api/webhooks/resend — khong JWT, xac minh bang chu ky Svix:
//   - Thieu secret cau hinh -> 500 (loi server, khong xu ly).
//   - Thieu/sai chu ky -> 401, khong xu ly, khong ghi du lieu.
//   - Chu ky dung -> parse payload, cap nhat email_logs theo resend_id:
//       email.sent -> sent | email.delivered -> delivered
//       email.bounced -> bounced | email.complained -> complained
//       email.delivery_delayed / opened / clicked -> bo qua (khong doi
//       trang thai gui).
//   - Hard bounce -> dung gui marketing cho dia chi do (ghi
//     newsletter_subscribers.hard_bounced_at). Spam complaint -> cung
//     dung gui marketing (ly do 'spam_complaint').
//   - Khong tim thay dong log theo resend_id van tra 200 (da nhan
//     webhook) — tranh Resend gui lai lien tuc; chi ghi log server.
//   - Luu y ve payload bounce that: Resend gui kem data.bounce.type
//     ('hard' | 'soft'). Chi coi la hard bounce khi type === 'hard'
//     (hoac data.bounce_type === 'hard'); khong co thong tin type thi
//     coi la soft (chi cap nhat log, khong chan dia chi) — can doi
//     chieu lai voi 1 payload bounce that truoc khi tin hoan toan.

import { ApiError, jsonError, jsonOk, serverError } from '../errors';
import type { Env } from '../env';
import { safeLog } from '../env';
import { parseSvixHeaders, verifySvixSignature } from './svix';
import {
  suppressSubscriber,
  updateEmailLogByResendId,
  type EmailLogStatus,
} from './store';

/** Map kieu su kien Resend -> trang thai email_logs (null = bo qua). */
export function mapResendEventToStatus(type: string): EmailLogStatus | null {
  switch (type) {
    case 'email.sent':
      return 'sent';
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.delivery_delayed':
    case 'email.opened':
    case 'email.clicked':
    default:
      return null;
  }
}

export interface ResendWebhookData {
  email_id?: unknown;
  id?: unknown;
  resend_id?: unknown;
  to?: unknown;
  bounce?: { type?: unknown; message?: unknown } | unknown;
  bounce_type?: unknown;
  [key: string]: unknown;
}

export interface ResendWebhookPayload {
  type?: unknown;
  data?: ResendWebhookData;
}

/** Lay resend_id tu payload (Resend dung `data.email_id`). */
export function extractResendId(data: ResendWebhookData | undefined): string | null {
  if (!data) return null;
  for (const key of ['email_id', 'resend_id', 'id']) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Lay email nguoi nhan tu payload (chuoi hoac mang — lay phan tu dau). */
export function extractRecipient(data: ResendWebhookData | undefined): string | null {
  if (!data) return null;
  const to = data['to'];
  if (typeof to === 'string' && to.trim()) return to.trim().toLowerCase();
  if (Array.isArray(to) && typeof to[0] === 'string' && (to[0] as string).trim()) {
    return (to[0] as string).trim().toLowerCase();
  }
  return null;
}

/**
 * Co phai hard bounce khong. Chi true khi payload noi ro type='hard'.
 * Khong co thong tin -> false (soft — khong chan dia chi).
 */
export function isHardBounce(data: ResendWebhookData | undefined): boolean {
  if (!data) return false;
  const bounce = data['bounce'];
  if (bounce && typeof bounce === 'object') {
    return (bounce as { type?: unknown })['type'] === 'hard';
  }
  return data['bounce_type'] === 'hard';
}

function extractBounceMessage(data: ResendWebhookData | undefined): string | null {
  if (!data) return null;
  const bounce = data['bounce'];
  if (bounce && typeof bounce === 'object') {
    const m = (bounce as { message?: unknown })['message'];
    if (typeof m === 'string' && m.trim()) return m.trim().slice(0, 1000);
  }
  return null;
}

export interface WebhookDeps {
  updateLogByResendId?: typeof updateEmailLogByResendId;
  suppress?: typeof suppressSubscriber;
  /** Moc thoi gian (ms epoch) — chi dung trong test. */
  nowMs?: number;
}

export interface WebhookHandleResult {
  received: boolean;
  updated: boolean;
  suppressed: boolean;
}

/**
 * Xu ly 1 webhook Resend DA XAC MINH chu ky. Tra ket qua xu ly
 * (khong nem loi khi khong tim thay log — chi ghi log server).
 */
export async function processResendWebhook(
  env: Env,
  payload: ResendWebhookPayload,
  deps: WebhookDeps = {},
): Promise<WebhookHandleResult> {
  const updateLogByResendId = deps.updateLogByResendId ?? updateEmailLogByResendId;
  const suppress = deps.suppress ?? suppressSubscriber;
  const type = typeof payload.type === 'string' ? payload.type : '';
  const status = mapResendEventToStatus(type);
  const data = payload.data;
  const resendId = extractResendId(data);
  const recipient = extractRecipient(data);
  const result: WebhookHandleResult = { received: true, updated: false, suppressed: false };

  if (status && resendId) {
    const patch: { status: EmailLogStatus; error_message?: string | null } = { status };
    if (status === 'bounced') {
      const msg = extractBounceMessage(data);
      if (msg) patch.error_message = msg;
    }
    result.updated = await updateLogByResendId(env, resendId, patch);
    if (!result.updated) {
      safeLog('resend webhook: no email_log for resend_id', { type });
    }
  }

  // Hard bounce / spam complaint -> dung gui marketing cho dia chi do.
  if (type === 'email.bounced' && recipient && isHardBounce(data)) {
    await suppress(env, recipient, 'hard_bounce');
    result.suppressed = true;
  } else if (type === 'email.complained' && recipient) {
    await suppress(env, recipient, 'spam_complaint');
    result.suppressed = true;
  }
  return result;
}

/**
 * Handler POST /api/webhooks/resend: doc raw body, xac minh chu ky
 * Svix, roi xu ly. Tra Response (401 khi chu ky sai, 200 khi nhan).
 */
export async function handleResendWebhook(
  env: Env,
  req: Request,
  deps: WebhookDeps = {},
): Promise<Response> {
  const secret = (env.RESEND_WEBHOOK_SECRET ?? '').trim();
  if (!secret) {
    return jsonError(serverError('RESEND_WEBHOOK_SECRET is not configured'));
  }
  const headers = parseSvixHeaders(req.headers);
  if (!headers) {
    return jsonError(
      new ApiError(401, 'unauthorized', 'Thiếu chữ ký webhook.'),
    );
  }
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonError(new ApiError(400, 'invalid_input', 'Không đọc được nội dung webhook.'));
  }
  const valid = await verifySvixSignature(secret, headers, rawBody, { nowMs: deps.nowMs });
  if (!valid) {
    return jsonError(new ApiError(401, 'unauthorized', 'Chữ ký webhook không hợp lệ.'));
  }
  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return jsonError(new ApiError(400, 'invalid_input', 'Nội dung webhook không phải JSON.'));
  }
  const result = await processResendWebhook(env, payload, deps);
  return jsonOk({
    received: result.received,
    updated: result.updated,
    suppressed: result.suppressed,
  });
}
