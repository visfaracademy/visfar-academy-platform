// Test noi route email vao router that (handleRequest) — QA-18-FUNC-01:
//   POST /api/v1/newsletter, GET|POST /api/v1/newsletter/unsubscribe,
//   POST /api/webhooks/resend, GET /api/admin/reports/email.
// Supabase gia lap qua fake-supabase (them bang newsletter_subscribers).
// Khong goi Supabase / Resend that, khong dung secret that.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { createUnsubscribeToken } from '../src/email/token';
import { handleRequest } from '../src/index';
import { __resetRateLimits } from '../src/rate-limit';
import { createFakeState, createMockFetch, type FakeState } from './fake-supabase';

const BASE_URL = 'https://visfaracademy.netlify.app';
const SECRET = 'test-unsubscribe-secret-123';
const NOW = Date.parse('2026-11-10T10:00:00+07:00');

let state: FakeState;
let env: Env;

function req(path: string, init?: RequestInit): Request {
  return new Request(`${BASE_URL}${path}`, {
    headers: { 'CF-Connecting-IP': '203.0.113.20', ...(init?.headers ?? {}) },
    ...init,
  });
}

async function call(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await handleRequest(req(path, init), env);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

function postNewsletter(email: string): Promise<{ status: number; json: Record<string, unknown> }> {
  return call('/api/v1/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

beforeEach(() => {
  state = createFakeState();
  vi.stubGlobal('fetch', createMockFetch(state));
  __resetRateLimits();
  env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    UNSUBSCRIBE_SECRET: SECRET,
    RESEND_WEBHOOK_SECRET: 'whsec_testsecret',
  } as unknown as Env;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/v1/newsletter (router)', () => {
  it('email moi: 201, ghi 1 dong vao newsletter_subscribers', async () => {
    const { status, json } = await postNewsletter('a@example.com');
    expect(status).toBe(201);
    expect(json).toMatchObject({ ok: true, subscribed: true, duplicate: false });
    expect(state.subscribers).toHaveLength(1);
    expect(state.subscribers[0]).toMatchObject({ email: 'a@example.com', status: 'subscribed' });
  });

  it('trung email: 200 duplicate=true, khong them dong', async () => {
    await postNewsletter('a@example.com');
    const { status, json } = await postNewsletter('a@example.com');
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, subscribed: true, duplicate: true });
    expect(state.subscribers).toHaveLength(1);
  });

  it('email sai dinh dang: 400 invalid_email, khong ghi DB', async () => {
    const { status, json } = await postNewsletter('khong-phai-email');
    expect(status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: 'invalid_email' });
    expect(state.subscribers).toHaveLength(0);
  });

  it('huy roi dang ky lai: 200 reactivated=true', async () => {
    await postNewsletter('a@example.com');
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const unsub = await call(
      `/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    );
    expect(unsub.status).toBe(200);
    expect(state.subscribers[0]?.['status']).toBe('unsubscribed');
    const { status, json } = await postNewsletter('a@example.com');
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, subscribed: true, reactivated: true });
    expect(state.subscribers).toHaveLength(1);
    expect(state.subscribers[0]?.['status']).toBe('subscribed');
  });
});

describe('GET|POST /api/v1/newsletter/unsubscribe (router)', () => {
  it('token sai: 400 invalid_token (GET)', async () => {
    const { status, json } = await call('/api/v1/newsletter/unsubscribe?token=token-sai');
    expect(status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: 'invalid_token' });
  });

  it('token sai: 400 invalid_token (POST)', async () => {
    const { status, json } = await call('/api/v1/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'token-sai' }),
    });
    expect(status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: 'invalid_token' });
  });

  it('token hop le (email chua co dong): 200 unsubscribed', async () => {
    const token = await createUnsubscribeToken('la@example.com', SECRET, { nowMs: NOW });
    const { status, json } = await call(
      `/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    );
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, unsubscribed: true });
  });
});

describe('POST /api/webhooks/resend (router)', () => {
  it('thieu chu ky Svix: 401 unauthorized', async () => {
    const { status, json } = await call('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } }),
    });
    expect(status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: 'unauthorized' });
  });
});

describe('GET /api/admin/reports/email (router)', () => {
  it('thieu JWT: 401 unauthorized', async () => {
    const { status, json } = await call('/api/admin/reports/email');
    expect(status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: 'unauthorized' });
  });
});
