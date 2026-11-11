// Test adapter gui theo mau E7–E13 — sendEmail (client.ts) + store mock.
// KHONG gui email that, KHONG goi Resend that.
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import type { SubscriberRow } from './consent';
import type { EmailLogRecord, InsertEmailLogInput } from './store';
import { classifyClientError, sendTemplatedEmail } from './templated';
import type { EmailSenderConfig, SendEmailInput as TemplatedInput, SendEmailResult } from './types';

type UpdateEmailLogPatch = Partial<
  Pick<EmailLogRecord, 'status' | 'resend_id' | 'error_message' | 'sent_at' | 'attempts' | 'next_retry_at'>
>;

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  UNSUBSCRIBE_SECRET: 'test-unsubscribe-secret-123',
} as unknown as Env;

const NOW = Date.parse('2026-11-10T10:00:00+07:00');

const config: EmailSenderConfig = {
  apiKey: 're_test',
  from: 'Visfar Academy <hello@visfaracademy.vn>',
  appUrl: 'https://visfaracademy.netlify.app',
  fetchImpl: async () =>
    new Response(JSON.stringify({ id: 're_1' }), { status: 200 }),
};

function sub(overrides: Partial<SubscriberRow> = {}): SubscriberRow {
  return {
    email: 'a@example.com',
    status: 'subscribed',
    unsubscribed_at: null,
    unsubscribe_reason: null,
    hard_bounced_at: null,
    ...overrides,
  };
}

function okResult(resendId = 're_1'): SendEmailResult {
  return {
    ok: true,
    resendId,
    message: 'Da gui email.',
    logRow: {
      to_email: 'a@example.com',
      template: 'E9',
      resend_id: resendId,
      status: 'sent',
      related_type: null,
      related_id: null,
      error_message: null,
    },
  };
}

function failResult(errorCode: SendEmailResult['errorCode']): SendEmailResult {
  return {
    ok: false,
    errorCode,
    message: `loi ${errorCode}`,
    logRow: {
      to_email: 'a@example.com',
      template: 'E9',
      resend_id: null,
      status: 'failed',
      related_type: null,
      related_id: null,
      error_message: errorCode ?? null,
    },
  };
}

function mockStore(subscriber: SubscriberRow | null = null) {
  return {
    insertLog: vi.fn(async (_env: Env, _input: InsertEmailLogInput) => ({ id: 'log-1' })),
    updateLog: vi.fn(async (_env: Env, _id: string, _patch: UpdateEmailLogPatch) => undefined),
    getSubscriber: vi.fn(async (_env: Env, _email: string): Promise<SubscriberRow | null> => subscriber),
    countSentToday: vi.fn(async (_env: Env, _dayStart: string, _cap?: number) => 0),
    hasAlertBeenSent: vi.fn(async (_env: Env, _dayStart: string, _email: string) => false),
  };
}

describe('classifyClientError', () => {
  it('upstream (loi mang): retryable; quota/config/nguoi nhan/mau: permanent', () => {
    expect(classifyClientError('email_upstream_error', null)).toBe('retryable');
    expect(classifyClientError('daily_quota_exceeded', 429)).toBe('permanent');
    expect(classifyClientError('email_not_configured', null)).toBe('permanent');
    expect(classifyClientError('invalid_recipient', 400)).toBe('permanent');
    expect(classifyClientError('invalid_template_data', 400)).toBe('permanent');
  });

  it('resend_error: theo HTTP status (429/5xx retry, 4xx khac khong)', () => {
    expect(classifyClientError('resend_error', 500)).toBe('retryable');
    expect(classifyClientError('resend_error', 429)).toBe('retryable');
    expect(classifyClientError('resend_error', 400)).toBe('permanent');
  });
});

describe('sendTemplatedEmail', () => {
  it('mau care E9 + da unsubscribed: KHONG gui, log skipped', async () => {
    const sendViaClient = vi.fn(async (_config: EmailSenderConfig, _input: TemplatedInput): Promise<SendEmailResult> => okResult());
    const store = mockStore(sub({ status: 'unsubscribed' }));
    const result = await sendTemplatedEmail(
      env,
      config,
      { to: 'a@example.com', template: 'E9', data: { studentName: 'A', courseTitle: 'K1', resumeUrl: 'https://x', daysInactive: 3 } },
      { sendViaClient, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: false, skipped: true, reason: 'unsubscribed' });
    expect(sendViaClient).not.toHaveBeenCalled();
    expect(store.insertLog.mock.calls[0]?.[1]).toMatchObject({ status: 'skipped', template: 'E9' });
  });

  it('mau care E9 + subscribed: gui kem link huy dang ky CO TOKEN (khong phai ?email=)', async () => {
    const sendViaClient = vi.fn(async (_config: EmailSenderConfig, _input: TemplatedInput): Promise<SendEmailResult> => okResult());
    const store = mockStore(sub());
    const result = await sendTemplatedEmail(
      env,
      config,
      { to: 'a@example.com', template: 'E9', data: { studentName: 'A', courseTitle: 'K1', resumeUrl: 'https://x', daysInactive: 3 } },
      { sendViaClient, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: true, resendId: 're_1', attempts: 1 });
    const sentData = sendViaClient.mock.calls[0]?.[1]?.data as { unsubscribeUrl?: string };
    expect(sentData.unsubscribeUrl ?? '').toContain('/api/v1/newsletter/unsubscribe?token=');
    expect(sentData.unsubscribeUrl ?? '').not.toContain('a@example.com');
    expect(store.updateLog).toHaveBeenCalledWith(
      env,
      'log-1',
      expect.objectContaining({ status: 'sent', resend_id: 're_1' }),
    );
  });

  it('mau transactional E4 + da unsubscribed: VAN gui, khong chen link huy', async () => {
    const sendViaClient = vi.fn(async (_config: EmailSenderConfig, _input: TemplatedInput): Promise<SendEmailResult> => okResult());
    const store = mockStore(sub({ status: 'unsubscribed' }));
    const result = await sendTemplatedEmail(
      env,
      config,
      { to: 'a@example.com', template: 'E4', data: { studentName: 'A', courseTitle: 'K1', orderReference: 'DH-1', amountVnd: 0 } },
      { sendViaClient, nowMs: NOW, ...store },
    );
    expect(result.sent).toBe(true);
    expect(store.getSubscriber).not.toHaveBeenCalled();
    const sentData = sendViaClient.mock.calls[0]?.[1]?.data as { unsubscribeUrl?: string };
    expect(sentData.unsubscribeUrl).toBeUndefined();
  });

  it('loi mang 2 lan roi thanh cong: 3 lan goi, sleep [60s, 300s]', async () => {
    const sendViaClient = vi.fn(
      async (_config: EmailSenderConfig, _input: TemplatedInput): Promise<SendEmailResult> =>
        okResult('re_3'),
    );
    sendViaClient
      .mockResolvedValueOnce(failResult('email_upstream_error'))
      .mockResolvedValueOnce(failResult('email_upstream_error'));
    const store = mockStore(sub());
    const sleeps: number[] = [];
    const result = await sendTemplatedEmail(
      env,
      config,
      { to: 'a@example.com', template: 'E9', data: { studentName: 'A', courseTitle: 'K1', resumeUrl: 'https://x', daysInactive: 3 } },
      { sendViaClient, sleep: async (ms) => { sleeps.push(ms); }, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: true, resendId: 're_3', attempts: 3 });
    expect(sendViaClient).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([60_000, 300_000]);
  });

  it('daily_quota_exceeded: chi 1 lan, khong retry trong ngay', async () => {
    const sendViaClient = vi.fn(async (_config: EmailSenderConfig, _input: TemplatedInput): Promise<SendEmailResult> => failResult('daily_quota_exceeded'));
    const store = mockStore(sub());
    const sleeps: number[] = [];
    const result = await sendTemplatedEmail(
      env,
      config,
      { to: 'a@example.com', template: 'E9', data: { studentName: 'A', courseTitle: 'K1', resumeUrl: 'https://x', daysInactive: 3 } },
      { sendViaClient, sleep: async (ms) => { sleeps.push(ms); }, nowMs: NOW, ...store },
    );
    expect(result).toEqual({
      sent: false,
      reason: 'daily_quota_exceeded',
      errorCode: 'daily_quota_exceeded',
      attempts: 1,
    });
    expect(sendViaClient).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
    expect(store.updateLog).toHaveBeenCalledWith(
      env,
      'log-1',
      expect.objectContaining({ status: 'failed', attempts: 1 }),
    );
  });
});
