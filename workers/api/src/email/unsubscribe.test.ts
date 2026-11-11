// Test route huy dang ky — token ky that, store mock. Khong gui email that.
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import type { Env } from '../env';
import type { SubscriberRow } from './consent';
import { createUnsubscribeToken } from './token';
import { buildUnsubscribeUrl, handleNewsletterUnsubscribe, processUnsubscribe } from './unsubscribe';

const SECRET = 'test-unsubscribe-secret-123';
const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  UNSUBSCRIBE_SECRET: SECRET,
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

describe('buildUnsubscribeUrl', () => {
  it('ghep API base + token (khong lo email vao URL)', () => {
    const url = buildUnsubscribeUrl('https://visfaracademy.netlify.app/', 'tok.123');
    expect(url).toBe(
      'https://visfaracademy.netlify.app/api/v1/newsletter/unsubscribe?token=tok.123',
    );
    expect(url).not.toContain('a@example.com');
  });
});

describe('processUnsubscribe', () => {
  it('token hop le + dang subscribed: cap nhat unsubscribed + ly do', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const getSubscriber = vi.fn(async () => sub());
    const markUnsubscribed = vi.fn(async () => undefined);
    const result = await processUnsubscribe(env, token, 'Nhieu email qua', {
      getSubscriber,
      markUnsubscribed,
      nowMs: NOW,
    });
    expect(result).toEqual({ unsubscribed: true, already: false, email: 'a@example.com' });
    expect(markUnsubscribed).toHaveBeenCalledWith(env, 'a@example.com', 'Nhieu email qua');
  });

  it('da huy truoc do: already=true, khong ghi lai', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const getSubscriber = vi.fn(async () => sub({ status: 'unsubscribed', unsubscribed_at: '2026-11-09T00:00:00Z' }));
    const markUnsubscribed = vi.fn(async () => undefined);
    const result = await processUnsubscribe(env, token, null, {
      getSubscriber,
      markUnsubscribed,
      nowMs: NOW,
    });
    expect(result).toEqual({ unsubscribed: true, already: true, email: 'a@example.com' });
    expect(markUnsubscribed).not.toHaveBeenCalled();
  });

  it('email khong co trong bang: van ok (khong lo co ton tai hay khong)', async () => {
    const token = await createUnsubscribeToken('la@example.com', SECRET, { nowMs: NOW });
    const getSubscriber = vi.fn(async () => null);
    const markUnsubscribed = vi.fn(async () => undefined);
    const result = await processUnsubscribe(env, token, null, {
      getSubscriber,
      markUnsubscribed,
      nowMs: NOW,
    });
    expect(result).toEqual({ unsubscribed: true, already: false, email: 'la@example.com' });
    expect(markUnsubscribed).not.toHaveBeenCalled();
  });

  it('token sai chu ky: 400 invalid_token', async () => {
    const token = await createUnsubscribeToken('a@example.com', 'secret-khac', { nowMs: NOW });
    await expect(
      processUnsubscribe(env, token, null, { nowMs: NOW }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_token' });
  });

  it('token het han: 400 invalid_token', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { ttlSec: 60, nowMs: NOW });
    await expect(
      processUnsubscribe(env, token, null, { nowMs: NOW + 3600_000 }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_token' });
  });

  it('thieu UNSUBSCRIBE_SECRET: 503 (khong xac minh bang secret rong)', async () => {
    const envNoSecret = { ...env, UNSUBSCRIBE_SECRET: '' } as unknown as Env;
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    await expect(processUnsubscribe(envNoSecret, token, null, { nowMs: NOW })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('handleNewsletterUnsubscribe', () => {
  it('GET voi token hop le: 200 ok', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const req = new Request(`https://api.test/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
    const res = await handleNewsletterUnsubscribe(env, req, {
      getSubscriber: async () => sub(),
      markUnsubscribed: async () => undefined,
      nowMs: NOW,
      skipRateLimit: true,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, unsubscribed: true });
  });

  it('POST voi token hop le + reason: 200 ok', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const markUnsubscribed = vi.fn(async () => undefined);
    const req = new Request('https://api.test/api/v1/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, reason: 'Khong con nhu cau' }),
    });
    const res = await handleNewsletterUnsubscribe(env, req, {
      getSubscriber: async () => sub(),
      markUnsubscribed,
      nowMs: NOW,
      skipRateLimit: true,
    });
    expect(res.status).toBe(200);
    expect(markUnsubscribed).toHaveBeenCalledWith(env, 'a@example.com', 'Khong con nhu cau');
  });

  it('thieu token: 400 invalid_token', async () => {
    const req = new Request('https://api.test/api/v1/newsletter/unsubscribe');
    const res = await handleNewsletterUnsubscribe(env, req, { skipRateLimit: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: 'invalid_token' });
  });

  it('token het han qua GET: 400 invalid_token', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { ttlSec: 60, nowMs: NOW });
    const req = new Request(`https://api.test/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
    const res = await handleNewsletterUnsubscribe(env, req, { nowMs: NOW + 3600_000, skipRateLimit: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: 'invalid_token' });
  });
});
