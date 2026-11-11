// Test retry — thuan, khong can DB / Resend that.
import { describe, expect, it } from 'vitest';
import {
  classifySendError,
  delayBeforeNextAttempt,
  MAX_SEND_ATTEMPTS,
  nextRetryAtIso,
  RETRY_DELAYS_MS,
  shouldRetry,
} from './retry';

describe('classifySendError', () => {
  it('429 + 5xx + loi mang/timeout: retryable', () => {
    expect(classifySendError({ status: 429 })).toBe('retryable');
    expect(classifySendError({ status: 500 })).toBe('retryable');
    expect(classifySendError({ status: 502 })).toBe('retryable');
    expect(classifySendError({ status: 503 })).toBe('retryable');
    expect(classifySendError({ status: null })).toBe('retryable');
    expect(classifySendError({})).toBe('retryable');
    expect(classifySendError({ code: 'rate_limit_exceeded' })).toBe('retryable');
  });

  it('4xx khac (400 dia chi sai, 401/403, 422): permanent — KHONG retry', () => {
    expect(classifySendError({ status: 400 })).toBe('permanent');
    expect(classifySendError({ status: 401 })).toBe('permanent');
    expect(classifySendError({ status: 403 })).toBe('permanent');
    expect(classifySendError({ status: 404 })).toBe('permanent');
    expect(classifySendError({ status: 422 })).toBe('permanent');
    expect(classifySendError({ status: 400, code: 'validation_error' })).toBe('permanent');
    expect(classifySendError({ status: 400, code: 'invalid_recipient' })).toBe('permanent');
  });
});

describe('shouldRetry / delays', () => {
  it('toi da 3 lan: lan 3 that bai tam thoi cung khong retry nua', () => {
    expect(MAX_SEND_ATTEMPTS).toBe(3);
    expect(shouldRetry(1, { status: 500 })).toBe(true);
    expect(shouldRetry(2, { status: 500 })).toBe(true);
    expect(shouldRetry(3, { status: 500 })).toBe(false);
    expect(shouldRetry(1, { status: 400 })).toBe(false);
  });

  it('backoff 1p / 5p / 15p', () => {
    expect(RETRY_DELAYS_MS).toEqual([60_000, 300_000, 900_000]);
    expect(delayBeforeNextAttempt(1)).toBe(60_000);
    expect(delayBeforeNextAttempt(2)).toBe(300_000);
    expect(delayBeforeNextAttempt(3)).toBe(900_000);
  });

  it('nextRetryAtIso = now + delay', () => {
    const now = Date.parse('2026-11-10T10:00:00Z');
    expect(nextRetryAtIso(1, now)).toBe(new Date(now + 60_000).toISOString());
    expect(nextRetryAtIso(2, now)).toBe(new Date(now + 300_000).toISOString());
  });
});
