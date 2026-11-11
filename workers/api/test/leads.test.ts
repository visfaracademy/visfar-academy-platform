// Test POST /api/v1/leads — validation, honeypot, rate-limit,
// idempotency (trung key / khac body), ghi DB that (fake), Sheet loi
// van 201, Turnstile, thieu cau hinh.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { handleRequest } from '../src/index';
import { __resetRateLimits } from '../src/rate-limit';
import { __resetJwksCache } from '../src/jwt';
import {
  COURSE_DRAFT,
  COURSE_PUBLISHED,
  createFakeState,
  createMockFetch,
  type FakeState,
} from './fake-supabase';

const BASE_URL = 'https://visfaracademy.netlify.app';

let state: FakeState;
let env: Env;

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fullName: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'a@example.com',
    province: 'Hà Nội',
    courseId: COURSE_PUBLISHED,
    courseInterestText: 'Thấu Hiểu Nội Tâm',
    source: 'visfar-academy',
    turnstileToken: null,
    honeypot: '',
    ...overrides,
  };
}

async function postLead(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await handleRequest(
    new Request(`${BASE_URL}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `key-${Math.random().toString(36).slice(2)}`,
        'CF-Connecting-IP': '203.0.113.10',
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    env,
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  state = createFakeState();
  env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    APPS_SCRIPT_URL: 'https://script.google.test/exec',
  };
  vi.stubGlobal('fetch', createMockFetch(state));
  __resetRateLimits();
  __resetJwksCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/v1/leads — validation server', () => {
  it('SĐT 9 số → 400 invalid_phone, không ghi DB', async () => {
    const { status, json } = await postLead(validBody({ phone: '090123456' }));
    expect(status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: 'invalid_phone' });
    expect(state.leads).toHaveLength(0);
  });

  it('SĐT +84 → 400 invalid_phone', async () => {
    const { status, json } = await postLead(validBody({ phone: '+84901234567' }));
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_phone');
  });

  it('email TLD 1 ký tự (a@b.c) → 400 invalid_email', async () => {
    const { status, json } = await postLead(validBody({ email: 'a@b.c' }));
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_email');
  });

  it('tỉnh ngoài 34 tỉnh (Bình Dương) → 400 invalid_province', async () => {
    const { status, json } = await postLead(validBody({ province: 'Bình Dương' }));
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_province');
  });

  it('thiếu tên → 400 invalid_input', async () => {
    const { status, json } = await postLead(validBody({ fullName: 'A' }));
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });

  it('courseId không tồn tại → 400 invalid_course', async () => {
    const { status, json } = await postLead(
      validBody({ courseId: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_course');
  });

  it('courseId là khóa draft → 400 invalid_course', async () => {
    const { status, json } = await postLead(validBody({ courseId: COURSE_DRAFT }));
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_course');
  });

  it('courseId null + courseInterestText đầy đủ → 201 (chưa biết bắt đầu từ đâu)', async () => {
    const { status, json } = await postLead(
      validBody({ courseId: null, courseInterestText: 'Chưa biết bắt đầu từ đâu' }),
    );
    expect(status).toBe(201);
    expect(json.ok).toBe(true);
    expect(state.leads[0]?.['course_id']).toBeNull();
  });

  it('honeypot có giá trị → 400 spam_suspected, không gọi Sheet, không ghi DB', async () => {
    const { status, json } = await postLead(validBody({ honeypot: 'http://spam.example' }));
    expect(status).toBe(400);
    expect(json.error).toBe('spam_suspected');
    expect(state.leads).toHaveLength(0);
    expect(state.sheetCalls).toHaveLength(0);
  });
});

describe('POST /api/v1/leads — ghi DB + Sheet', () => {
  it('thành công → 201 + referenceCode VISFAR-2026-XXXXXX + 1 row DB + 1 lần Sheet', async () => {
    const { status, json } = await postLead(validBody(), { 'Idempotency-Key': 'lead-ok-1' });
    expect(status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json['referenceCode']).toMatch(/^VISFAR-2026-\d{6}$/);
    expect(json['sheetSynced']).toBe(true);
    expect(state.leads).toHaveLength(1);
    expect(state.sheetCalls).toHaveLength(1);
    expect(state.sheetCalls[0]).toMatchObject({
      source: 'visfar-academy',
      fullName: 'Nguyễn Văn A',
      phone: '0901234567',
      course: 'Thấu Hiểu Nội Tâm',
      referenceCode: json['referenceCode'],
    });
  });

  it('Sheet lỗi sau khi DB ghi xong → vẫn 201, sheetSynced:false, không thành công giả ngược', async () => {
    state.sheetShouldFail = true;
    const { status, json } = await postLead(validBody(), { 'Idempotency-Key': 'lead-sheet-fail' });
    expect(status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json['sheetSynced']).toBe(false);
    expect(state.leads).toHaveLength(1);
  });

  it('ghi DB lỗi → 502 ok:false, KHÔNG 201', async () => {
    state.insertShouldFail = true;
    const { status, json } = await postLead(validBody(), { 'Idempotency-Key': 'lead-db-fail' });
    expect(status).toBe(502);
    expect(json.ok).toBe(false);
    expect(json.error).toBe('upstream_error');
    expect(state.leads).toHaveLength(0);
  });

  it('thiếu SUPABASE_URL → 503, không ghi', async () => {
    env = { ...env, SUPABASE_URL: '' };
    const { status, json } = await postLead(validBody(), { 'Idempotency-Key': 'lead-nocfg' });
    expect(status).toBe(503);
    expect(json.ok).toBe(false);
    expect(state.leads).toHaveLength(0);
  });
});

describe('POST /api/v1/leads — idempotency', () => {
  it('gửi 2 lần cùng key → lần 2 trả 200 duplicate:true, cùng referenceCode, DB chỉ 1 dòng', async () => {
    const first = await postLead(validBody(), { 'Idempotency-Key': 'dup-key-1' });
    expect(first.status).toBe(201);
    const second = await postLead(validBody(), { 'Idempotency-Key': 'dup-key-1' });
    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ ok: true, duplicate: true });
    expect(second.json['referenceCode']).toBe(first.json['referenceCode']);
    expect(state.leads).toHaveLength(1);
    // Lần trùng không ghi Sheet lần 2.
    expect(state.sheetCalls).toHaveLength(1);
  });

  it('cùng key nhưng body khác (SĐT khác) → 409 idempotency_conflict, không ghi thêm', async () => {
    await postLead(validBody(), { 'Idempotency-Key': 'conflict-key-1' });
    const { status, json } = await postLead(validBody({ phone: '0909999999' }), {
      'Idempotency-Key': 'conflict-key-1',
    });
    expect(status).toBe(409);
    expect(json.error).toBe('idempotency_conflict');
    expect(state.leads).toHaveLength(1);
  });
});

describe('POST /api/v1/leads — rate-limit 5/giờ/IP', () => {
  it('5 lần OK, lần 6 → 429 rate_limited kèm Retry-After, không ghi thêm', async () => {
    const ip = '203.0.113.99';
    for (let i = 0; i < 5; i++) {
      const r = await postLead(validBody({ phone: `090123456${i}` }), {
        'Idempotency-Key': `rl-${i}`,
        'CF-Connecting-IP': ip,
      });
      expect(r.status).toBe(201);
    }
    const res = await handleRequest(
      new Request(`${BASE_URL}/api/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'rl-6',
          'CF-Connecting-IP': ip,
        },
        body: JSON.stringify(validBody({ phone: '0901234599' })),
      }),
      env,
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.error).toBe('rate_limited');
    expect(state.leads).toHaveLength(5);
  });
});

describe('POST /api/v1/leads — Turnstile', () => {
  it('có secret + token sai → 400 spam_suspected, không ghi', async () => {
    env = { ...env, TURNSTILE_SECRET: 'test-secret' };
    state.turnstileShouldFail = true;
    const { status, json } = await postLead(validBody({ turnstileToken: 'bad-token' }), {
      'Idempotency-Key': 'ts-bad',
    });
    expect(status).toBe(400);
    expect(json.error).toBe('spam_suspected');
    expect(state.leads).toHaveLength(0);
  });

  it('có secret nhưng không có token → cho qua + log (Task 03 QĐ 13), vẫn 201', async () => {
    env = { ...env, TURNSTILE_SECRET: 'test-secret' };
    const { status } = await postLead(validBody({ turnstileToken: null }), {
      'Idempotency-Key': 'ts-notoken',
    });
    expect(status).toBe(201);
  });
});
