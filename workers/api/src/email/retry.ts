// Retry gui email — TASK 11.
//
//   - Toi da 3 lan thu (lan dau + toi da 2 lan thu lai).
//   - Backoff: 1 phut -> 5 phut -> 15 phut (RETRY_DELAYS_MS).
//   - CHI retry loi TAM THOI: 429 (rate-limit), 5xx, loi mang/timeout
//     (khong co HTTP status).
//   - KHONG retry loi VINH VIEN: 4xx khac (400 dia chi sai, 401/403
//     sai key, 422 du lieu khong hop le, ...). Retry loi vinh vien
//     chi dot quota Resend vo ich.

export const MAX_SEND_ATTEMPTS = 3;

/** Do tre truoc lan thu lai thu i (i = 1 sau lan 1 that bai, i = 2 sau lan 2). */
export const RETRY_DELAYS_MS: readonly number[] = [60_000, 300_000, 900_000]; // 1p / 5p / 15p

export type ErrorClass = 'retryable' | 'permanent';

export interface SendErrorLike {
  /** HTTP status tu Resend (null/undefined = loi mang, timeout, khong co response). */
  status?: number | null;
  /** Ma loi cua Resend (neu co), vd 'rate_limit_exceeded', 'validation_error'. */
  code?: string | null;
}

/** Phan loai loi gui: retryable = tam thoi, permanent = vinh vien. */
export function classifySendError(err: SendErrorLike): ErrorClass {
  const code = (err.code ?? '').toLowerCase();
  if (code === 'rate_limit_exceeded' || code === 'rate_limited') return 'retryable';
  if (code === 'validation_error' || code === 'invalid_recipient' || code === 'invalid_email') {
    return 'permanent';
  }
  const status = err.status;
  if (status === undefined || status === null) return 'retryable'; // loi mang / timeout
  if (status === 429) return 'retryable';
  if (status >= 500 && status <= 599) return 'retryable';
  return 'permanent';
}

/** Co nen thu lai sau lan thu `attempt` (1-based) voi loi nay khong. */
export function shouldRetry(attempt: number, err: SendErrorLike): boolean {
  if (attempt >= MAX_SEND_ATTEMPTS) return false;
  return classifySendError(err) === 'retryable';
}

/** Do tre (ms) truoc lan thu ke tiep sau lan thu `attempt` that bai tam thoi. */
export function delayBeforeNextAttempt(attempt: number): number {
  const idx = attempt - 1;
  if (idx < 0) return 0;
  if (idx >= RETRY_DELAYS_MS.length) return RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] as number;
  return RETRY_DELAYS_MS[idx] as number;
}

/** Thoi diem hen thu lai (ISO) = now + delay cua lan thu `attempt`. */
export function nextRetryAtIso(attempt: number, nowMs: number): string {
  return new Date(nowMs + delayBeforeNextAttempt(attempt)).toISOString();
}
