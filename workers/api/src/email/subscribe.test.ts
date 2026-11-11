// Test handler dang ky newsletter — store mock (deps inject), khong
// goi Supabase that. Test noi route that nam o
// test/newsletter-routes.test.ts.
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import type { SubscriberRow } from './consent';
import { handleSubscribeNewsletter, processSubscribe } from './subscribe';

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
} as unknown as Env;

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

function postReq(body: unknown): Request {
  return new Request('https://api.test/api/v1/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('processSubscribe', () => {
  it('email moi: insert + duplicate=false, reactivated=false', async () => {
    const insert = vi.fn(async () => ({
      data: [sub()],
      error: null,
      status: 201,
    }));
    const result = await processSubscribe(env, 'a@example.com', 'footer', {
      getSubscriber: async () => null,
      insert,
    });
    expect(result).toEqual({ subscribed: true, duplicate: false, reactivated: false });
    expect(insert).toHaveBeenCalledWith(env, 'a@example.com', 'footer');
  });

  it('email da subscribed: duplicate=true, khong insert', async () => {
    const insert = vi.fn(async () => ({
      data: [sub()],
      error: null,
      status: 201,
    }));
    const result = await processSubscribe(env, 'a@example.com', 'footer', {
      getSubscriber: async () => sub(),
      insert,
    });
    expect(result).toEqual({ subscribed: true, duplicate: true, reactivated: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it('email da unsubscribed: mo lai, reactivated=true', async () => {
    const reactivate = vi.fn(async () => undefined);
    const result = await processSubscribe(env, 'a@example.com', 'footer', {
      getSubscriber: async () => sub({ status: 'unsubscribed', unsubscribed_at: '2026-11-09T00:00:00Z' }),
      reactivate,
    });
    expect(result).toEqual({ subscribed: true, duplicate: false, reactivated: true });
    expect(reactivate).toHaveBeenCalledWith(env, 'a@example.com');
  });

  it('race trung UNIQUE 23505: doc lai thay dong -> duplicate=true', async () => {
    const getSubscriber = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sub());
    const insert = vi.fn(async () => ({
      data: null,
      error: { message: 'duplicate key email', code: '23505' },
      status: 409,
    }));
    const result = await processSubscribe(env, 'a@example.com', 'footer', {
      getSubscriber,
      insert,
    });
    expect(result).toEqual({ subscribed: true, duplicate: true, reactivated: false });
  });
});

describe('handleSubscribeNewsletter', () => {
  it('email moi: 201 subscribed, duplicate=false', async () => {
    const res = await handleSubscribeNewsletter(env, postReq({ email: 'A@Example.com' }), {
      getSubscriber: async () => null,
      insert: async () => ({ data: [sub()], error: null, status: 201 }),
      skipRateLimit: true,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true, subscribed: true, duplicate: false });
  });

  it('email da dang ky: 200 duplicate=true', async () => {
    const res = await handleSubscribeNewsletter(env, postReq({ email: 'a@example.com' }), {
      getSubscriber: async () => sub(),
      insert: async () => ({ data: [sub()], error: null, status: 201 }),
      skipRateLimit: true,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, subscribed: true, duplicate: true });
  });

  it('email sai dinh dang: 400 invalid_email', async () => {
    const res = await handleSubscribeNewsletter(env, postReq({ email: 'khong-phai-email' }), {
      skipRateLimit: true,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: 'invalid_email' });
  });

  it('thieu email: 400 invalid_email', async () => {
    const res = await handleSubscribeNewsletter(env, postReq({}), { skipRateLimit: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: 'invalid_email' });
  });

  it('body khong phai JSON: 400 invalid_input', async () => {
    const res = await handleSubscribeNewsletter(env, postReq('khong-phai-json'), {
      skipRateLimit: true,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('chua cau hinh Supabase: 503', async () => {
    const envNoSb = { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } as unknown as Env;
    const res = await handleSubscribeNewsletter(envNoSb, postReq({ email: 'a@example.com' }), {
      skipRateLimit: true,
    });
    expect(res.status).toBe(503);
  });
});
