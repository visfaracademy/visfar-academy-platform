// Test webhook Resend — chu ky that (ky bang signSvixPayload), store mock.
// KHONG goi Resend that.
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { signSvixPayload } from './svix';
import {
  extractRecipient,
  extractResendId,
  handleResendWebhook,
  isHardBounce,
  mapResendEventToStatus,
  processResendWebhook,
} from './webhook';

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  RESEND_WEBHOOK_SECRET: 'whsec_' + Buffer.from('test-webhook-secret-123456').toString('base64'),
} as unknown as Env;

const NOW_MS = Date.parse('2026-11-10T10:00:00Z');
const NOW_SEC = Math.floor(NOW_MS / 1000);

function signedRequest(body: string): Request {
  return new Request('https://api.test/api/webhooks/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

async function withSignature(req: Request, body: string, secret?: string): Promise<Request> {
  const sig = await signSvixPayload(secret ?? (env as { RESEND_WEBHOOK_SECRET: string }).RESEND_WEBHOOK_SECRET, 'msg_test1', NOW_SEC, body);
  const headers = new Headers(req.headers);
  headers.set('svix-id', 'msg_test1');
  headers.set('svix-timestamp', String(NOW_SEC));
  headers.set('svix-signature', sig);
  return new Request(req.url, { method: 'POST', headers, body });
}

describe('mapResendEventToStatus', () => {
  it('delivered / bounced / failed-path / complained', () => {
    expect(mapResendEventToStatus('email.delivered')).toBe('delivered');
    expect(mapResendEventToStatus('email.bounced')).toBe('bounced');
    expect(mapResendEventToStatus('email.complained')).toBe('complained');
    expect(mapResendEventToStatus('email.sent')).toBe('sent');
  });

  it('opened / clicked / delivery_delayed / la: bo qua (null)', () => {
    expect(mapResendEventToStatus('email.opened')).toBeNull();
    expect(mapResendEventToStatus('email.clicked')).toBeNull();
    expect(mapResendEventToStatus('email.delivery_delayed')).toBeNull();
    expect(mapResendEventToStatus('email.unknown')).toBeNull();
  });
});

describe('extractResendId / extractRecipient / isHardBounce', () => {
  it('email_id la resend_id; to co the la chuoi hoac mang', () => {
    expect(extractResendId({ email_id: 're_123' })).toBe('re_123');
    expect(extractResendId({ resend_id: 're_9' })).toBe('re_9');
    expect(extractResendId({})).toBeNull();
    expect(extractRecipient({ to: 'A@Example.com' })).toBe('a@example.com');
    expect(extractRecipient({ to: ['B@Example.com', 'c@example.com'] })).toBe('b@example.com');
    expect(extractRecipient({})).toBeNull();
  });

  it('hard bounce chi khi bounce.type === hard', () => {
    expect(isHardBounce({ bounce: { type: 'hard' } })).toBe(true);
    expect(isHardBounce({ bounce: { type: 'soft' } })).toBe(false);
    expect(isHardBounce({ bounce: {} })).toBe(false);
    expect(isHardBounce({})).toBe(false);
    expect(isHardBounce(undefined)).toBe(false);
  });
});

describe('processResendWebhook', () => {
  it('delivered: cap nhat log theo resend_id', async () => {
    const updateLogByResendId = vi.fn(async () => true);
    const suppress = vi.fn(async () => undefined);
    const result = await processResendWebhook(
      env,
      { type: 'email.delivered', data: { email_id: 're_1', to: 'a@example.com' } },
      { updateLogByResendId, suppress },
    );
    expect(result).toEqual({ received: true, updated: true, suppressed: false });
    expect(updateLogByResendId).toHaveBeenCalledWith(env, 're_1', { status: 'delivered' });
    expect(suppress).not.toHaveBeenCalled();
  });

  it('hard bounce: cap nhat log bounced + chan dia chi', async () => {
    const updateLogByResendId = vi.fn(async () => true);
    const suppress = vi.fn(async () => undefined);
    const result = await processResendWebhook(
      env,
      {
        type: 'email.bounced',
        data: { email_id: 're_2', to: 'bad@example.com', bounce: { type: 'hard', message: '550 User unknown' } },
      },
      { updateLogByResendId, suppress },
    );
    expect(result).toEqual({ received: true, updated: true, suppressed: true });
    expect(updateLogByResendId).toHaveBeenCalledWith(
      env,
      're_2',
      { status: 'bounced', error_message: '550 User unknown' },
    );
    expect(suppress).toHaveBeenCalledWith(env, 'bad@example.com', 'hard_bounce');
  });

  it('soft bounce: chi cap nhat log, KHONG chan dia chi', async () => {
    const updateLogByResendId = vi.fn(async () => true);
    const suppress = vi.fn(async () => undefined);
    const result = await processResendWebhook(
      env,
      {
        type: 'email.bounced',
        data: { email_id: 're_3', to: 'a@example.com', bounce: { type: 'soft', message: 'Mailbox full' } },
      },
      { updateLogByResendId, suppress },
    );
    expect(result.suppressed).toBe(false);
    expect(suppress).not.toHaveBeenCalled();
  });

  it('complained: cap nhat complained + chan dia chi (spam_complaint)', async () => {
    const updateLogByResendId = vi.fn(async () => true);
    const suppress = vi.fn(async () => undefined);
    const result = await processResendWebhook(
      env,
      { type: 'email.complained', data: { email_id: 're_4', to: 'a@example.com' } },
      { updateLogByResendId, suppress },
    );
    expect(result).toEqual({ received: true, updated: true, suppressed: true });
    expect(suppress).toHaveBeenCalledWith(env, 'a@example.com', 'spam_complaint');
  });

  it('khong tim thay log theo resend_id: van ok, updated=false', async () => {
    const updateLogByResendId = vi.fn(async () => false);
    const result = await processResendWebhook(
      env,
      { type: 'email.delivered', data: { email_id: 're_khong-co' } },
      { updateLogByResendId, suppress: vi.fn(async () => undefined) },
    );
    expect(result).toEqual({ received: true, updated: false, suppressed: false });
  });

  it('event opened: bo qua, khong cap nhat log', async () => {
    const updateLogByResendId = vi.fn(async () => true);
    const result = await processResendWebhook(
      env,
      { type: 'email.opened', data: { email_id: 're_5' } },
      { updateLogByResendId, suppress: vi.fn(async () => undefined) },
    );
    expect(result.updated).toBe(false);
    expect(updateLogByResendId).not.toHaveBeenCalled();
  });
});

describe('handleResendWebhook — xac minh chu ky', () => {
  const updateLogByResendId = vi.fn(async () => true);
  const suppress = vi.fn(async () => undefined);

  it('chu ky dung: 200 + xu ly', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
    const req = await withSignature(signedRequest(body), body);
    const res = await handleResendWebhook(env, req, { updateLogByResendId, suppress, nowMs: NOW_MS });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, received: true, updated: true });
  });

  it('chu ky SAI -> 401, KHONG xu ly, KHONG ghi', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
    const otherSecret = 'whsec_' + Buffer.from('secret-khac-hoan-toan-1234').toString('base64');
    const req = await withSignature(signedRequest(body), body, otherSecret);
    updateLogByResendId.mockClear();
    const res = await handleResendWebhook(env, req, { updateLogByResendId, suppress, nowMs: NOW_MS });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(updateLogByResendId).not.toHaveBeenCalled();
  });

  it('thieu header Svix -> 401', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
    const res = await handleResendWebhook(env, signedRequest(body), {
      updateLogByResendId,
      suppress,
      nowMs: NOW_MS,
    });
    expect(res.status).toBe(401);
    expect(updateLogByResendId).not.toHaveBeenCalled();
  });

  it('body khong phai JSON (nhung chu ky dung) -> 400', async () => {
    const body = 'khong-phai-json{';
    const req = await withSignature(signedRequest(body), body);
    const res = await handleResendWebhook(env, req, { updateLogByResendId, suppress, nowMs: NOW_MS });
    expect(res.status).toBe(400);
  });
});
