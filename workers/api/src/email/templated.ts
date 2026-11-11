// Gui email theo mau E1–E13 qua lop consent + retry + log — TASK 11.
//
// Adapter noi module template cua Task 11 (templates.ts / client.ts /
// types.ts) voi module nay:
//   - Loai mau tu TEMPLATE_META: 'transactional' (E1–E6) gui luon;
//     'care' (E7–E13) phai kiem tra quyen nhan tin truoc (consent.ts)
//     — bi chan thi KHONG gui, ghi log 'skipped'.
//   - Mau co hasUnsubscribe: tu chen link huy dang ky CO TOKEN KY
//     (token.ts) vao data.unsubscribeUrl — tru khi caller da truyen
//     san. Neu chua cau hinh UNSUBSCRIBE_SECRET thi giu fallback
//     '?email=...' cua templates.ts + ghi canh bao log (KHONG chan
//     gui, vi email giao dich phai chay; sua bang cach set secret).
//   - Retry: goi lai sendEmail (client.ts) toi da 3 lan khi loi tam
//     thoi (loi mang, 429, 5xx — doc tu HTTP status qua fetchImpl
//     boc ngoai). 'daily_quota_exceeded' KHONG retry trong ngay
//     (gui lai sau 00:00 UTC — xem email/README.md §5); loi cau hinh
//     / nguoi nhan sai / mau sai KHONG retry.
//   - Log: adapter TU ghi email_logs qua store.ts (insert 'queued'
//     roi cap nhat theo tung lan thu: attempts, next_retry_at,
//     sent_at, resend_id, error_message). Caller KHONG insert them
//     result.logRow cua client.ts nua (tranh ghi trung 2 dong).
// KHONG gui email that trong test: truyen sendViaClient / fetchImpl gia.

import type { Env } from '../env';
import { safeLog } from '../env';
import { sendEmail } from './client';
import { checkMarketingConsent, requiresConsent, type EmailKind } from './consent';
import { classifySendError, delayBeforeNextAttempt, MAX_SEND_ATTEMPTS, nextRetryAtIso, shouldRetry } from './retry';
import { maybeAlertQuota } from './sender';
import { countEmailsSentToday, getSubscriberByEmail, hasQuotaAlertBeenSentToday, insertEmailLog, updateEmailLog } from './store';
import { buildUnsubscribeUrl } from './unsubscribe';
import { createUnsubscribeToken } from './token';
import { TEMPLATE_META, type EmailSenderConfig, type SendEmailErrorCode, type SendEmailInput as TemplatedInput, type TemplateId } from './types';

export const DEFAULT_API_BASE_URL = 'https://visfaracademy.netlify.app';

export type TemplatedSendResult =
  | { sent: true; resendId: string; attempts: number }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped?: false; reason: string; errorCode?: SendEmailErrorCode; attempts: number };

export interface TemplatedSendDeps {
  sleep?: (ms: number) => Promise<void>;
  /** Moc thoi gian (ms epoch) — chi dung trong test. */
  nowMs?: number;
  getSubscriber?: typeof getSubscriberByEmail;
  insertLog?: typeof insertEmailLog;
  updateLog?: typeof updateEmailLog;
  countSentToday?: typeof countEmailsSentToday;
  hasAlertBeenSent?: typeof hasQuotaAlertBeenSentToday;
  /** Gui that qua Resend — mac dinh sendEmail cua client.ts. */
  sendViaClient?: typeof sendEmail;
  /** Fetch that — mac dinh fetch toan cuc (duoc boc de doc HTTP status). */
  fetchImpl?: typeof fetch;
  /** Goc URL API cho link huy dang ky — mac dinh config.appUrl hoac DEFAULT_API_BASE_URL. */
  apiBaseUrl?: string;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Phan loai loi cua client.ts: retryable = tam thoi, permanent = vinh vien / khong retry trong ngay. */
export function classifyClientError(
  errorCode: SendEmailErrorCode | undefined,
  httpStatus: number | null,
): 'retryable' | 'permanent' {
  switch (errorCode) {
    case 'email_upstream_error':
      return 'retryable';
    case 'daily_quota_exceeded':
      return 'permanent'; // Retry trong ngay vo ich — gui lai sau 00:00 UTC.
    case 'email_not_configured':
    case 'invalid_recipient':
    case 'invalid_template_data':
      return 'permanent';
    case 'resend_error':
      return classifySendError({ status: httpStatus });
    default:
      return 'permanent';
  }
}

export async function sendTemplatedEmail(
  env: Env,
  config: EmailSenderConfig,
  input: TemplatedInput,
  deps: TemplatedSendDeps = {},
): Promise<TemplatedSendResult> {
  const meta = TEMPLATE_META[input.template as TemplateId];
  const kind: EmailKind = meta?.category === 'care' ? 'care' : 'transactional';
  const to = input.to.trim().toLowerCase();
  const sleep = deps.sleep ?? defaultSleep;
  const nowMs = deps.nowMs ?? Date.now();
  const getSubscriber = deps.getSubscriber ?? getSubscriberByEmail;
  const insertLog = deps.insertLog ?? insertEmailLog;
  const updateLog = deps.updateLog ?? updateEmailLog;
  const sendViaClient = deps.sendViaClient ?? sendEmail;

  // (1) Kiem tra quyen nhan tin truoc khi gui care.
  if (meta && requiresConsent(kind)) {
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

  // (2) Chen link huy dang ky co token ky cho mau care.
  let data = input.data;
  if (meta?.hasUnsubscribe && !data.unsubscribeUrl) {
    const secret = (env.UNSUBSCRIBE_SECRET ?? '').trim();
    if (secret) {
      const token = await createUnsubscribeToken(to, secret);
      const apiBase = deps.apiBaseUrl ?? config.appUrl ?? DEFAULT_API_BASE_URL;
      data = { ...data, unsubscribeUrl: buildUnsubscribeUrl(apiBase, token) };
    } else {
      safeLog('unsubscribe secret missing: care email uses unsigned ?email= link', {});
    }
  }

  // (3) Ghi log 'queued' truoc, cap nhat theo tung lan thu.
  const { id: logId } = await insertLog(env, {
    to_email: to,
    template: input.template,
    status: 'queued',
    attempts: 1,
    related_type: input.relatedType ?? null,
    related_id: input.relatedId ?? null,
  });

  let lastStatus: number | null = null;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const capturingFetch: typeof fetch = async (url, init) => {
    const res = await fetchImpl(url, init);
    lastStatus = res.status;
    return res;
  };
  const clientConfig: EmailSenderConfig = { ...config, fetchImpl: capturingFetch };
  const clientInput: TemplatedInput = { ...input, data };

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    const result = await sendViaClient(clientConfig, clientInput);
    if (result.ok) {
      await updateLog(env, logId, {
        status: 'sent',
        resend_id: result.resendId ?? null,
        sent_at: new Date().toISOString(),
        attempts: attempt,
        next_retry_at: null,
      });
      await maybeAlertQuota(env, config.from, {
        nowMs,
        countSentToday: deps.countSentToday,
        hasAlertBeenSent: deps.hasAlertBeenSent,
        insertLog,
      }).catch(() => undefined);
      return { sent: true, resendId: result.resendId ?? '', attempts: attempt };
    }
    const errorCode = result.errorCode;
    const errorMessage = result.message;
    const cls = classifyClientError(errorCode, lastStatus);
    const retryable = cls === 'retryable' && shouldRetry(attempt, { status: lastStatus, code: errorCode ?? null });
    if (retryable) {
      await updateLog(env, logId, {
        attempts: attempt,
        next_retry_at: nextRetryAtIso(attempt, nowMs),
        error_message: `${errorCode ?? 'resend_error'}: ${errorMessage}`.slice(0, 1000),
      });
      await sleep(delayBeforeNextAttempt(attempt));
      continue;
    }
    await updateLog(env, logId, {
      status: 'failed',
      attempts: attempt,
      next_retry_at: null,
      error_message: `${errorCode ?? 'resend_error'}: ${errorMessage}`.slice(0, 1000),
    });
    return {
      sent: false,
      reason: errorCode === 'daily_quota_exceeded' ? 'daily_quota_exceeded' : 'permanent_failed',
      errorCode,
      attempts: attempt,
    };
  }
  return { sent: false, reason: 'retryable_failed', attempts: MAX_SEND_ATTEMPTS };
}

/** Tien ich: lay loai email (kind) cua 1 mau theo TEMPLATE_META. */
export function kindOfTemplate(template: TemplateId): EmailKind {
  return TEMPLATE_META[template]?.category === 'care' ? 'care' : 'transactional';
}
