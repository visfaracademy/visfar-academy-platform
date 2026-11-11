// Test GET /api/health + verifySupabaseJwt truc tiep.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { handleRequest } from '../src/index';
import { __resetJwksCache, verifySupabaseJwt } from '../src/jwt';
import {
  USER_ENROLLED,
  createFakeState,
  createMockFetch,
  generateTestKeyPair,
  signTestJwt,
  testJwtPayload,
  type FakeState,
} from './fake-supabase';

const BASE_URL = 'https://visfaracademy.netlify.app';

let state: FakeState;

function healthEnv(overrides: Partial<Env> = {}): Env {
  return {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    ...overrides,
  };
}

beforeEach(() => {
  state = createFakeState();
  vi.stubGlobal('fetch', createMockFetch(state));
  __resetJwksCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/health', () => {
  it('chưa cấu hình Supabase → 503 not_configured, ok:false', async () => {
    const res = await handleRequest(
      new Request(`${BASE_URL}/api/health`),
      healthEnv({ SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }),
    );
    expect(res.status).toBe(503);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ ok: false, status: 'not_configured' });
  });

  it('Supabase lỗi (bảng courses lỗi) → 503 supabase_error', async () => {
    state.healthShouldFail = true;
    const res = await handleRequest(new Request(`${BASE_URL}/api/health`), healthEnv());
    expect(res.status).toBe(503);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.ok).toBe(false);
  });

  it('select thật 1 dòng courses OK → 200 ok:true + latency_ms', async () => {
    const res = await handleRequest(new Request(`${BASE_URL}/api/health`), healthEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true, status: 'ok' });
    expect(typeof json['latency_ms']).toBe('number');
  });

  it('alias /api/v1/health cũng trả 200', async () => {
    const res = await handleRequest(new Request(`${BASE_URL}/api/v1/health`), healthEnv());
    expect(res.status).toBe(200);
  });

  it('đường dẫn lạ → 404 not_found', async () => {
    const res = await handleRequest(new Request(`${BASE_URL}/api/v1/unknown`), healthEnv());
    expect(res.status).toBe(404);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe('not_found');
  });
});

describe('verifySupabaseJwt', () => {
  it('token hợp lệ → trả userId = sub', async () => {
    const keys = await generateTestKeyPair('kid-health-1');
    state.jwksKeys = [keys.publicJwk];
    const token = await signTestJwt(keys.privateKey, 'kid-health-1', testJwtPayload(USER_ENROLLED));
    const verified = await verifySupabaseJwt(token, 'https://test.supabase.co');
    expect(verified.userId).toBe(USER_ENROLLED);
  });

  it('token hết hạn → throw', async () => {
    const keys = await generateTestKeyPair('kid-health-2');
    state.jwksKeys = [keys.publicJwk];
    const token = await signTestJwt(
      keys.privateKey,
      'kid-health-2',
      testJwtPayload(USER_ENROLLED, { exp: Math.floor(Date.now() / 1000) - 120 }),
    );
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow('expired');
  });

  it('token sai chữ ký → throw', async () => {
    const keys = await generateTestKeyPair('kid-health-3');
    const other = await generateTestKeyPair('kid-health-3');
    state.jwksKeys = [keys.publicJwk];
    const token = await signTestJwt(other.privateKey, 'kid-health-3', testJwtPayload(USER_ENROLLED));
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow('signature');
  });

  it('JWKS không có key khớp kid → throw', async () => {
    const keys = await generateTestKeyPair('kid-health-4');
    state.jwksKeys = [];
    const token = await signTestJwt(keys.privateKey, 'kid-health-4', testJwtPayload(USER_ENROLLED));
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow();
  });
});
