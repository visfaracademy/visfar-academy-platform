// Gui email qua Resend + log + retry + canh bao quota — TASK 11.
//
// Luong gui (moi lan gui deu ghi email_logs):
//   1. Marketing/care: kiem tra quyen nhan tin truoc (consent.ts).
//      Bi chan (huy nhan / hard bounce / spam complaint) -> KHONG gui,
//      ghi log status='skipped' + ly do, tra { sent:false, skipped:true }.
//   2. Transactional: gui luon (khong unsubscribe) nhung van ghi log.
//   3. Gui that qua Resend API (client inject duoc — test khong gui
//      email that). Thanh cong -> log 'sent' + resend_id + sent_at.
//   4. Loi tam thoi (429/5xx/loi mang): retry toi da 3 lan, backoff
//      1p/5p/15p (retry.ts); moi lan that bai cap nhat log (attempts,
//      next_retry_at, error_message). Loi vinh vien (4xx khac): khong
//      retry, log 'failed'.
//   5. Sau moi lan gui thanh cong: dem email da gui trong ngay (gio
//      VN); neu >= 80 thi gui 1 canh bao ve ALERT_EMAIL
//      (mac dinh visfaracademy@gmail.com, DECISIONS QĐ 14), 1 lan/ngay.
//      Canh bao la transactional, khong de quy (khong tu kiem quota).
//
// KHONG gui email that trong test: truyen client gia qua deps.

import { ApiError, serverError } from '../errors';
import type { Env } from '../env';
import { safeLog } from '../env';
import { validateEmail } from '../validation';
import { checkMarketingConsent, requiresConsent, type EmailKind } from './consent';
import {
  classifySendError,
  delayBeforeNextAttempt,
  MAX_SEND_ATTEMPTS,
  nextRetryAtIso,
  shouldRetry,
} from './retry';
import {
  countEmailsSentToday,
  getSubscriberByEmail,
  hasQuotaAlertBeenSentToday,
  insertEmailLog,
  startOfTodayVnIso,
  updateEmailLog,
} from './store';

export const QUOTA_ALERT_THRESHOLD = 80;
export const QUOTA_ALERT_TEMPLATE = 'system_alert_resend_quota';
export const DEFAULT_ALERT_EMAIL = 'visfaracademy@gmail.com';

export function getAlertEmail(env: Env): string {
  // Ten chuan: ADMIN_NOTIFY_EMAIL (theo email/README.md §3).
  // ALERT_EMAIL la alias cu — van chap nhan de khong vo cau hinh cu.
  const v = (env.ALERT_EMAIL ?? '').trim() || (env.ADMIN_NOTIFY_EMAIL ?? '').trim();
  return v || DEFAULT_ALERT_EMAIL;
}

export class ResendSendError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = 'ResendSendError';
    this.status = status;
    this.code = code;
  }
}

export interface ResendSendInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface ResendClient {
  send(input: ResendSendInput): Promise<{ id: string }>;
}

/** Client Resend that (fetch truc tiep). Can RESEND_API_KEY moi tao duoc. */
export function createResendClient(env: Env): ResendClient {
  const apiKey = (env.RESEND_API_KEY ?? '').trim();
  if (!apiKey) throw serverError('RESEND_API_KEY is not configured');
  return {
    async send(input: ResendSendInput): Promise<{ id: string }> {
      let res: Response;
      try {
        res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: input.from,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            ...(input.text ? { text: input.text } : {}),
          }),
        });
      } catch (err) {
        throw new ResendSendError(
          err instanceof Error ? err.message : 'network error',
          null,
        );
      }
      const text = await res.text();
      let parsed: { id?: unknown; name?: unknown; message?: unknown } = {};
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        parsed = {};
      }
      if (!res.ok) {
        throw new ResendSendError(
          typeof parsed.message === 'string' ? parsed.message : `Resend HTTP ${res.status}`,
          res.status,
          typeof parsed.name === 'string' ? parsed.name : null,
        );
      }
      if (typeof parsed.id !== 'string' || !parsed.id) {
        throw new ResendSendError('Resend response missing id', res.status);
      }
      return { id: parsed.id };
    },
  };
}

export interface RawEmailInput {
  to: string;
  template: string;
  kind: EmailKind;
  from: string;
  subject: string;
  html: string;
  text?: string;
  relatedType?: string;
  relatedId?: string;
  /** Bo qua kiem tra quota sau khi gui (dung cho chinh email canh bao). */
  skipQuotaCheck?: boolean;
}

export type RawEmailResult =
  | { sent: true; resendId: string; attempts: number }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped?: false; reason: string; attempts: number };

export interface SendEmailDeps {
  client?: ResendClient;
  sleep?: (ms: number) => Promise<void>;
  /** Moc thoi gian (ms epoch) — chi dung trong test. */
  nowMs?: number;
  getSubscriber?: typeof getSubscriberByEmail;
  insertLog?: typeof insertEmailLog;
  updateLog?: typeof updateEmailLog;
  countSentToday?: typeof countEmailsSentToday;
  hasAlertBeenSent?: typeof hasQuotaAlertBeenSentToday;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function truncateError(message: string): string {
  return message.slice(0, 1000);
}

export async function sendEmailWithRetry(
  env: Env,
  input: RawEmailInput,
  deps: SendEmailDeps = {},
): Promise<RawEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (!validateEmail(to)) {
    throw new ApiError(400, 'invalid_email', 'Email người nhận chưa đúng định dạng.');
  }
  const client = deps.client ?? createResendClient(env);
  const sleep = deps.sleep ?? defaultSleep;
  const nowMs = deps.nowMs ?? Date.now();
  const getSubscriber = deps.getSubscriber ?? getSubscriberByEmail;
  const insertLog = deps.insertLog ?? insertEmailLog;
  const updateLog = deps.updateLog ?? updateEmailLog;

  // (1) Kiem tra quyen nhan tin truoc khi gui marketing/care.
  if (requiresConsent(input.kind)) {
    const subscriber = await getSubscriber(env, to);
    const check = checkMarketingConsent(subscriber);
    if (!check.allowed) {
      const reason = check.reason ?? 'unsubscribed';
      await insertLog(env, {
        to_email: to,
        template: input.template,
        status: 'skipped',
        error_message: `suppressed: ${reason}`,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
      });
      return { sent: false, skipped: true, reason };
    }
  }

  // (2) Ghi log 'queued' truoc, roi cap nhat theo tung lan thu.
  const { id: logId } = await insertLog(env, {
    to_email: to,
    template: input.template,
    status: 'queued',
    attempts: 1,
    related_type: input.relatedType ?? null,
    related_id: input.relatedId ?? null,
  });

  let attempt = 1;
  for (attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const { id: resendId } = await client.send({
        from: input.from,
        to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      });
      await updateLog(env, logId, {
        status: 'sent',
        resend_id: resendId,
        sent_at: new Date().toISOString(),
        attempts: attempt,
        next_retry_at: null,
      });
      if (!input.skipQuotaCheck) {
        await maybeAlertQuota(env, input.from, deps).catch(() => {
          // Canh bao loi khong duoc lam hong lan gui chinh.
        });
      }
      return { sent: true, resendId, attempts: attempt };
    } catch (err) {
      const normalized = normalizeSendError(err);
      if (shouldRetry(attempt, normalized)) {
        await updateLog(env, logId, {
          attempts: attempt,
          next_retry_at: nextRetryAtIso(attempt, nowMs),
          error_message: truncateError(normalized.message),
        });
        await sleep(delayBeforeNextAttempt(attempt));
        continue;
      }
      await updateLog(env, logId, {
        status: 'failed',
        attempts: attempt,
        next_retry_at: null,
        error_message: truncateError(normalized.message),
      });
      return {
        sent: false,
        reason: classifySendError(normalized) === 'retryable' ? 'retryable_failed' : 'permanent_failed',
        attempts: attempt,
      };
    }
  }
  return { sent: false, reason: 'retryable_failed', attempts: MAX_SEND_ATTEMPTS, };
}

function normalizeSendError(err: unknown): { status: number | null; code: string | null; message: string } {
  if (err instanceof ResendSendError) {
    return { status: err.status, code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { status: null, code: null, message: err.message };
  }
  return { status: null, code: null, message: 'unknown send error' };
}

export interface QuotaAlertResult {
  alerted: boolean;
  sentToday: number;
}

/**
 * Neu so email da gui trong ngay (gio VN) >= 80 va chua canh bao
 * hom nay thi gui 1 email canh bao ve ALERT_EMAIL. Tra { alerted }.
 * Loi trong qua trinh canh bao khong nem ra ngoai (ghi log an toan).
 */
export async function maybeAlertQuota(
  env: Env,
  from: string,
  deps: SendEmailDeps = {},
): Promise<QuotaAlertResult> {
  const nowMs = deps.nowMs ?? Date.now();
  const countSentToday = deps.countSentToday ?? countEmailsSentToday;
  const hasAlertBeenSent = deps.hasAlertBeenSent ?? hasQuotaAlertBeenSentToday;
  const insertLog = deps.insertLog ?? insertEmailLog;
  const alertEmail = getAlertEmail(env);
  const dayStart = startOfTodayVnIso(nowMs);
  try {
    const sentToday = await countSentToday(env, dayStart, QUOTA_ALERT_THRESHOLD);
    if (sentToday < QUOTA_ALERT_THRESHOLD) return { alerted: false, sentToday };
    if (await hasAlertBeenSent(env, dayStart, alertEmail)) {
      return { alerted: false, sentToday };
    }
    // Chi tao client Resend khi that su can gui canh bao.
    const client = deps.client ?? createResendClient(env);
    const subject = `Cảnh báo: Resend đã gửi ${sentToday} email hôm nay`;
    const html =
      `<p>Visfar Academy đã gửi <strong>${sentToday} email</strong> trong ngày hôm nay ` +
      `(ngưỡng cảnh báo ${QUOTA_ALERT_THRESHOLD} email/ngày; gói Resend miễn phí tối đa 100 email/ngày).</p>` +
      `<p>Vui lòng kiểm tra lượng gửi và cân nhắc nâng gói (cần phê duyệt theo Quyết định 18) ` +
      `hoặc tạm dừng các email marketing/care chưa gấp.</p>`;
    const { id } = await client.send({ from, to: alertEmail, subject, html });
    await insertLog(env, {
      to_email: alertEmail,
      template: QUOTA_ALERT_TEMPLATE,
      status: 'sent',
      resend_id: id,
      sent_at: new Date().toISOString(),
    });
    return { alerted: true, sentToday };
  } catch (err) {
    safeLog('quota alert failed', {
      error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
    return { alerted: false, sentToday: 0 };
  }
}
