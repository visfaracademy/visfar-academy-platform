// Test sendEmailWithRetry + maybeAlertQuota — client + store deu mock,
// KHONG gui email that, khong goi Resend that.
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { ResendSendError, maybeAlertQuota, sendEmailWithRetry, type ResendClient, type ResendSendInput } from './sender';
import type { SubscriberRow } from './consent';
import type { EmailLogRecord, InsertEmailLogInput } from './store';

type UpdateEmailLogPatch = Partial<
  Pick<EmailLogRecord, 'status' | 'resend_id' | 'error_message' | 'sent_at' | 'attempts' | 'next_retry_at'>
>;

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
} as unknown as Env;

const NOW = Date.parse('2026-11-10T10:00:00+07:00');

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

type Behavior = { ok: true; id: string } | { error: { status: number | null; code?: string; message: string } };

function mockClient(behaviors: Behavior[]): { client: ResendClient } {
  let calls = 0;
  const client: ResendClient = {
    async send() {
      const b = behaviors[Math.min(calls, behaviors.length - 1)] as Behavior;
      calls += 1;
      if ('ok' in b) return { id: b.id };
      throw new ResendSendError(b.error.message, b.error.status, b.error.code ?? null);
    },
  };
  return { client };
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

const baseInput = {
  to: 'a@example.com',
  template: 'E9',
  from: 'Visfar Academy <hello@visfaracademy.vn>',
  subject: 'Nhac hoc',
  html: '<p>Chao</p>',
} as const;

describe('sendEmailWithRetry — consent', () => {
  it('marketing + da unsubscribed: KHONG gui, log skipped', async () => {
    const { client } = mockClient([{ ok: true, id: 're_1' }]);
    const store = mockStore(sub({ status: 'unsubscribed', unsubscribed_at: '2026-11-09T00:00:00Z' }));
    const send = vi.fn(client.send);
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'marketing' },
      { client: { send }, sleep: async () => undefined, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: false, skipped: true, reason: 'unsubscribed' });
    expect(send).not.toHaveBeenCalled();
    expect(store.insertLog).toHaveBeenCalledTimes(1);
    expect(store.insertLog.mock.calls[0]?.[1]).toMatchObject({ status: 'skipped' });
  });

  it('marketing + hard bounce: KHONG gui, log skipped (hard_bounced)', async () => {
    const { client } = mockClient([{ ok: true, id: 're_1' }]);
    const store = mockStore(sub({ hard_bounced_at: '2026-11-09T00:00:00Z' }));
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'marketing' },
      { client, sleep: async () => undefined, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: false, skipped: true, reason: 'hard_bounced' });
    expect(store.insertLog.mock.calls[0]?.[1]).toMatchObject({ status: 'skipped' });
  });

  it('transactional + da unsubscribed: VAN gui (khong co unsubscribe)', async () => {
    const { client } = mockClient([{ ok: true, id: 're_1' }]);
    const store = mockStore(sub({ status: 'unsubscribed' }));
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'transactional' },
      { client, sleep: async () => undefined, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: true, resendId: 're_1', attempts: 1 });
    expect(store.getSubscriber).not.toHaveBeenCalled();
  });

  it('care + chua co dong subscriber: duoc gui', async () => {
    const { client } = mockClient([{ ok: true, id: 're_1' }]);
    const store = mockStore(null);
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'care' },
      { client, sleep: async () => undefined, nowMs: NOW, ...store },
    );
    expect(result.sent).toBe(true);
  });
});

describe('sendEmailWithRetry — retry', () => {
  it('500 lan 1, thanh cong lan 2: sent attempts=2, sleep 1 lan 60s', async () => {
    const { client } = mockClient([
      { error: { status: 500, message: 'Internal' } },
      { ok: true, id: 're_2' },
    ]);
    const store = mockStore(null);
    const sleeps: number[] = [];
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'transactional' },
      { client, sleep: async (ms) => { sleeps.push(ms); }, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: true, resendId: 're_2', attempts: 2 });
    expect(sleeps).toEqual([60_000]);
    expect(store.updateLog).toHaveBeenCalledWith(
      env,
      'log-1',
      expect.objectContaining({ attempts: 1, next_retry_at: new Date(NOW + 60_000).toISOString() }),
    );
  });

  it('500 ca 3 lan: failed attempts=3, sleep [60s, 300s], khong thu lan 4', async () => {
    const send = vi.fn(async () => {
      throw new ResendSendError('Internal', 500);
    });
    const store = mockStore(null);
    const sleeps: number[] = [];
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'transactional' },
      { client: { send }, sleep: async (ms) => { sleeps.push(ms); }, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: false, reason: 'retryable_failed', attempts: 3 });
    expect(send).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([60_000, 300_000]);
    expect(store.updateLog).toHaveBeenCalledWith(
      env,
      'log-1',
      expect.objectContaining({ status: 'failed', attempts: 3 }),
    );
  });

  it('400 (dia chi sai — loi vinh vien): chi 1 lan, khong sleep, log failed', async () => {
    const send = vi.fn(async () => {
      throw new ResendSendError('Invalid recipient', 400, 'validation_error');
    });
    const store = mockStore(null);
    const sleeps: number[] = [];
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'transactional' },
      { client: { send }, sleep: async (ms) => { sleeps.push(ms); }, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: false, reason: 'permanent_failed', attempts: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it('429 (rate-limit): retry duoc', async () => {
    const { client } = mockClient([
      { error: { status: 429, message: 'Too many' } },
      { ok: true, id: 're_2' },
    ]);
    const store = mockStore(null);
    const result = await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'transactional' },
      { client, sleep: async () => undefined, nowMs: NOW, ...store },
    );
    expect(result).toEqual({ sent: true, resendId: 're_2', attempts: 2 });
  });

  it('thanh cong: log sent + resend_id + sent_at', async () => {
    const { client } = mockClient([{ ok: true, id: 're_abc' }]);
    const store = mockStore(null);
    await sendEmailWithRetry(
      env,
      { ...baseInput, kind: 'transactional' },
      { client, sleep: async () => undefined, nowMs: NOW, ...store },
    );
    expect(store.insertLog).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ to_email: 'a@example.com', template: 'E9', status: 'queued' }),
    );
    expect(store.updateLog).toHaveBeenCalledWith(
      env,
      'log-1',
      expect.objectContaining({ status: 'sent', resend_id: 're_abc', attempts: 1 }),
    );
  });
});

describe('maybeAlertQuota', () => {
  const from = 'Visfar Academy <hello@visfaracademy.vn>';

  it('79 email/ngay: khong canh bao', async () => {
    const send = vi.fn(async () => ({ id: 're_alert' }));
    const result = await maybeAlertQuota(env, from, {
      client: { send },
      nowMs: NOW,
      countSentToday: async () => 79,
      hasAlertBeenSent: async () => false,
      insertLog: vi.fn(async () => ({ id: 'log-a' })),
    });
    expect(result).toEqual({ alerted: false, sentToday: 79 });
    expect(send).not.toHaveBeenCalled();
  });

  it('>=80 email/ngay + chua canh bao: gui 1 canh bao ve visfaracademy@gmail.com', async () => {
    const send = vi.fn(async (input: ResendSendInput) => ({ id: 're_alert' }));
    const insertLog = vi.fn(async () => ({ id: 'log-a' }));
    const result = await maybeAlertQuota(env, from, {
      client: { send },
      nowMs: NOW,
      countSentToday: async () => 80,
      hasAlertBeenSent: async () => false,
      insertLog,
    });
    expect(result).toEqual({ alerted: true, sentToday: 80 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: 'visfaracademy@gmail.com',
      subject: expect.stringContaining('80'),
    });
    expect(insertLog).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ template: 'system_alert_resend_quota', status: 'sent' }),
    );
  });

  it('>=80 nhung da canh bao hom nay: khong gui lan 2', async () => {
    const send = vi.fn(async () => ({ id: 're_alert' }));
    const result = await maybeAlertQuota(env, from, {
      client: { send },
      nowMs: NOW,
      countSentToday: async () => 95,
      hasAlertBeenSent: async () => true,
      insertLog: vi.fn(async () => ({ id: 'log-a' })),
    });
    expect(result.alerted).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
