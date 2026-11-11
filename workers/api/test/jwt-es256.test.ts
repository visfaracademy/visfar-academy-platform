// Test verifySupabaseJwt voi ES256 — Supabase publishable key moi phat
// hanh JWT alg ES256 (11/11/2026). RS256 cu van phai PASS (test o
// health.test.ts). Moi alg khac (none, HS256) phai bi tu choi.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetJwksCache, verifySupabaseJwt } from '../src/jwt';
import {
  USER_ENROLLED,
  buildRawJwt,
  createFakeState,
  createMockFetch,
  generateTestEcKeyPair,
  generateTestKeyPair,
  signTestJwt,
  signTestJwtEs256,
  testJwtPayload,
  type FakeState,
} from './fake-supabase';

let state: FakeState;

beforeEach(() => {
  state = createFakeState();
  vi.stubGlobal('fetch', createMockFetch(state));
  __resetJwksCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verifySupabaseJwt — ES256', () => {
  it('token ES256 hop le (khoa EC P-256, chu ky raw r||s) → tra userId = sub', async () => {
    const keys = await generateTestEcKeyPair('kid-es256-1');
    state.jwksKeys = [keys.publicJwk];
    const token = await signTestJwtEs256(keys.privateKey, 'kid-es256-1', testJwtPayload(USER_ENROLLED));
    const verified = await verifySupabaseJwt(token, 'https://test.supabase.co');
    expect(verified.userId).toBe(USER_ENROLLED);
  });

  it('token ES256 het han → throw expired', async () => {
    const keys = await generateTestEcKeyPair('kid-es256-2');
    state.jwksKeys = [keys.publicJwk];
    const token = await signTestJwtEs256(
      keys.privateKey,
      'kid-es256-2',
      testJwtPayload(USER_ENROLLED, { exp: Math.floor(Date.now() / 1000) - 120 }),
    );
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow('expired');
  });

  it('token ES256 sai chu ky → throw signature', async () => {
    const keys = await generateTestEcKeyPair('kid-es256-3');
    const other = await generateTestEcKeyPair('kid-es256-3');
    state.jwksKeys = [keys.publicJwk];
    const token = await signTestJwtEs256(other.privateKey, 'kid-es256-3', testJwtPayload(USER_ENROLLED));
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow('signature');
  });

  it('token ES256 nhung JWKS chi co khoa RSA → throw key not found', async () => {
    const ec = await generateTestEcKeyPair('kid-es256-4');
    const rsa = await generateTestKeyPair('kid-es256-4');
    state.jwksKeys = [rsa.publicJwk];
    const token = await signTestJwtEs256(ec.privateKey, 'kid-es256-4', testJwtPayload(USER_ENROLLED));
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow('key not found');
  });

  it('token RS256 cu van PASS (hoi quy)', async () => {
    const keys = await generateTestKeyPair('kid-rs256-1');
    state.jwksKeys = [keys.publicJwk];
    const token = await signTestJwt(keys.privateKey, 'kid-rs256-1', testJwtPayload(USER_ENROLLED));
    const verified = await verifySupabaseJwt(token, 'https://test.supabase.co');
    expect(verified.userId).toBe(USER_ENROLLED);
  });

  it('alg none → tu choi', async () => {
    const token = buildRawJwt({ alg: 'none', typ: 'JWT' }, testJwtPayload(USER_ENROLLED));
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow('alg');
  });

  it('alg HS256 → tu choi', async () => {
    const token = buildRawJwt(
      { alg: 'HS256', typ: 'JWT', kid: 'kid-hs256-1' },
      testJwtPayload(USER_ENROLLED),
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    await expect(verifySupabaseJwt(token, 'https://test.supabase.co')).rejects.toThrow('alg');
  });
});
