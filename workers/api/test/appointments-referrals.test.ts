// Test Lich hen + Tiep thi lien ket / Vi — TASK 12 (Workers API).
// Test logic THAT cua workers/api/src/appointments.ts,
// src/referrals.ts + handlers + route o src/index.ts, voi PostgREST
// GIA lap trong file nay (tuong tu payments.test.ts).
//
// Mock mo phong dung cac rang buoc that cua schema 0023: cot khong
// ton tai -> 400 PGRST204, UNIQUE referral_codes.user_id / .code,
// referrals.referred_user_id, wallet 1 commission / don -> 409 code
// 23505. Mock KHONG phai Supabase that — test live staging nam o bao
// cao, khong o day. KHONG chuyen tien that: withdraw chi tao dong
// wallet status pending.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../src/env';
import { ApiError } from '../src/errors';
import { handleRequest } from '../src/index';
import { __resetRateLimits } from '../src/rate-limit';
import { __resetJwksCache } from '../src/jwt';
import {
  generateTestKeyPair,
  signTestJwt,
  testJwtPayload,
  type TestKeyPair,
} from './fake-supabase';
import {
  computeCommissionAmount,
  generateReferralCode,
  getOrCreateReferralCode,
  recordReferralCommission,
  requestWithdrawal,
} from '../src/referrals';
import type { OrderRow } from '../src/payments';
import {
  parseCreateAppointmentBody,
  validateAppointmentPatch,
  type AppointmentRow,
} from '../src/appointments';

const BASE = 'https://test.supabase.co';
const API = 'https://visfaracademy.netlify.app';
const KID = 'test-kid-appt-ref';
const STUDENT_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const STUDENT_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const STUDENT_C = 'cccccccc-3333-4333-8333-333333333333';
const INSTRUCTOR_1 = 'dddddddd-4444-4444-8444-444444444444';
const ADMIN_1 = 'eeeeeeee-5555-4555-8555-555555555555';
const ORDER_1 = 'ffffffff-6666-4666-8666-666666666666';

type Row = Record<string, unknown>;

// Cot cho phep / bang — theo schema that (0001 + 0023). Cot nao khong
// co o day ma code ghi -> mock tra 400 PGRST204 (nhu that).
const COLUMNS: Record<string, string[]> = {
  profiles: ['id', 'full_name', 'email', 'role'],
  appointments: ['id', 'student_id', 'instructor_id', 'scheduled_at', 'duration_minutes', 'mode', 'status', 'note', 'meeting_url', 'created_at', 'updated_at'],
  referral_codes: ['id', 'user_id', 'code', 'created_at'],
  referrals: ['id', 'referrer_id', 'referred_user_id', 'referral_code', 'created_at'],
  wallet_transactions: ['id', 'user_id', 'type', 'amount_vnd', 'related_order_id', 'status', 'note', 'created_at'],
  orders: ['id', 'user_id', 'amount_vnd', 'reference_code', 'status', 'created_at'],
};

interface FakeDb {
  tables: Record<string, Row[]>;
  seq: number;
  jwksKeys: Array<Record<string, unknown>>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createDb(): FakeDb {
  const db: FakeDb = { tables: {}, seq: 0, jwksKeys: [] };
  for (const t of Object.keys(COLUMNS)) db.tables[t] = [];
  db.tables['profiles']!.push(
    { id: STUDENT_A, full_name: 'Hoc vien A', email: 'a@example.com', role: 'student' },
    { id: STUDENT_B, full_name: 'Hoc vien B', email: 'b@example.com', role: 'student' },
    { id: STUDENT_C, full_name: 'Hoc vien C', email: 'c@example.com', role: 'student' },
    { id: INSTRUCTOR_1, full_name: 'Giang vien', email: 'gv@example.com', role: 'instructor' },
    { id: ADMIN_1, full_name: 'Admin', email: 'admin@example.com', role: 'admin' },
  );
  // B gioi thieu A; A da co don paid 1.999.000đ.
  db.tables['referral_codes']!.push({
    id: 'rc-b', user_id: STUDENT_B, code: 'VISFAR-BB1234', created_at: nowIso(),
  });
  db.tables['referrals']!.push({
    id: 'ref-1', referrer_id: STUDENT_B, referred_user_id: STUDENT_A,
    referral_code: 'VISFAR-BB1234', created_at: nowIso(),
  });
  db.tables['orders']!.push({
    id: ORDER_1, user_id: STUDENT_A, amount_vnd: 1999000,
    reference_code: 'DH-2026-000001', status: 'paid', created_at: nowIso(),
  });
  return db;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function matchFilters(rows: Row[], url: URL): Row[] {
  let out = [...rows];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
    const inMatch = v.match(/^in\.\((.*)\)$/s);
    if (inMatch) {
      const wanted = new Set(inMatch[1]!.split(',').map((s) => decodeURIComponent(s)));
      out = out.filter((r) => wanted.has(String(r[k] ?? '')));
      continue;
    }
    const m = v.match(/^(eq|lt|gt|gte|lte|ne|neq)\.(.*)$/s);
    if (!m) continue;
    const [, op, raw] = m as [string, string, string];
    out = out.filter((r) => {
      const cell = r[k];
      const c = cell === null || cell === undefined ? '' : String(cell);
      if (op === 'eq') return c === decodeURIComponent(raw);
      if (op === 'ne' || op === 'neq') return c !== decodeURIComponent(raw);
      if (op === 'lt') return c < raw;
      if (op === 'gt') return c > raw;
      if (op === 'gte') return c >= raw;
      if (op === 'lte') return c <= raw;
      return true;
    });
  }
  const order = url.searchParams.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out.sort((a, b) => {
      const x = String(a[col!] ?? '');
      const y = String(b[col!] ?? '');
      return dir === 'desc' ? y.localeCompare(x) : x.localeCompare(y);
    });
  }
  const offset = url.searchParams.get('offset');
  if (offset) out = out.slice(Number.parseInt(offset, 10));
  const limit = url.searchParams.get('limit');
  if (limit) out = out.slice(0, Number.parseInt(limit, 10));
  return out;
}

function createMockFetch(db: FakeDb): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const href = url.href;
    const prefer = String((init?.headers as Record<string, string> | undefined)?.['Prefer'] ?? '');

    if (href.includes('/auth/v1/.well-known/jwks.json')) {
      return jsonResponse({ keys: db.jwksKeys });
    }
    if (!href.startsWith(`${BASE}/rest/v1/`)) {
      return jsonResponse({ message: `fake: unknown URL ${href}` }, 500);
    }
    const table = url.pathname.replace('/rest/v1/', '').split('/')[0] as string;
    const rows = db.tables[table];
    if (!rows) return jsonResponse({ message: `fake chua ho tro bang ${table}`, code: 'XX000' }, 500);
    const allowed = COLUMNS[table];
    const checkColumns = (body: Row): Response | null => {
      if (!allowed) return null;
      for (const k of Object.keys(body)) {
        if (!allowed.includes(k)) {
          return jsonResponse(
            { message: `Could not find the '${k}' column of '${table}' in the schema cache`, code: 'PGRST204' },
            400,
          );
        }
      }
      return null;
    };

    if (method === 'GET') return jsonResponse(matchFilters(rows, url));

    if (method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Row;
      const bad = checkColumns(body);
      if (bad) return bad;
      if (table === 'referral_codes') {
        if (rows.some((r) => r['user_id'] === body['user_id'])) {
          return jsonResponse({ message: 'duplicate key user_id', code: '23505' }, 409);
        }
        if (rows.some((r) => r['code'] === body['code'])) {
          return jsonResponse({ message: 'duplicate key code', code: '23505' }, 409);
        }
      }
      if (table === 'referrals') {
        if (body['referred_user_id'] != null && rows.some((r) => r['referred_user_id'] === body['referred_user_id'])) {
          return jsonResponse({ message: 'duplicate key referred_user_id', code: '23505' }, 409);
        }
      }
      if (table === 'wallet_transactions') {
        if (
          body['type'] === 'commission' &&
          body['related_order_id'] != null &&
          rows.some((r) => r['type'] === 'commission' && r['related_order_id'] === body['related_order_id'])
        ) {
          return jsonResponse({ message: 'duplicate key uq_wallet_one_commission_per_order', code: '23505' }, 409);
        }
        // CHECK that 0023: commission > 0, withdrawal < 0.
        const amount = body['amount_vnd'] as number;
        if (body['type'] === 'commission' && !(amount > 0)) {
          return jsonResponse({ message: 'violates check constraint "wallet_transactions_amount_vnd_check"', code: '23514' }, 400);
        }
        if (body['type'] === 'withdrawal' && !(amount < 0)) {
          return jsonResponse({ message: 'violates check constraint "wallet_transactions_amount_vnd_check"', code: '23514' }, 400);
        }
      }
      const row: Row = { ...body };
      db.seq += 1;
      row['id'] = (body['id'] as string | undefined) ?? `${table}-${db.seq}`;
      row['created_at'] = (body['created_at'] as string | undefined) ?? nowIso();
      if (allowed?.includes('updated_at')) row['updated_at'] = nowIso();
      rows.push(row);
      if (prefer.includes('return=minimal')) return new Response('', { status: 201 });
      return jsonResponse([row], 201);
    }

    if (method === 'PATCH') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Row;
      const bad = checkColumns(body);
      if (bad) return bad;
      const targets = matchFilters(rows, url);
      for (const t of targets) Object.assign(t, body, { updated_at: nowIso() });
      if (prefer.includes('return=minimal')) return new Response(null, { status: 204 });
      return jsonResponse(targets);
    }
    return jsonResponse({ message: `fake chua ho tro ${method} ${table}`, code: 'XX000' }, 500);
  }) as typeof fetch;
}

function makeEnv(): Env {
  return {
    SUPABASE_URL: BASE,
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  } as Env;
}

async function expectApiError(p: Promise<unknown>, status: number, code: string): Promise<ApiError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(status);
    expect(e.code).toBe(code);
    return e;
  }
  throw new Error(`expected ApiError ${status}/${code}, got success`);
}

function makeAppt(over: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: 'appt-1',
    student_id: STUDENT_A,
    instructor_id: INSTRUCTOR_1,
    scheduled_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    duration_minutes: 60,
    mode: 'zoom',
    status: 'pending',
    note: null,
    meeting_url: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...over,
  };
}

function makePaidOrder(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: ORDER_1,
    user_id: STUDENT_A,
    course_id: null,
    coupon_id: null,
    amount_vnd: 1999000,
    original_amount_vnd: 1999000,
    discount_vnd: 0,
    custom_amount_vnd: null,
    status: 'paid',
    payment_method: 'bank_transfer',
    reference_code: 'DH-2026-000001',
    expires_at: null,
    paid_at: nowIso(),
    refund_reason: null,
    refund_requested_at: null,
    refunded_at: null,
    refund_bank_reference: null,
    idempotency_key: null,
    idempotency_body_hash: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...over,
  } as OrderRow;
}

// ---------------------------------------------------------------------------
// Pure validators + referral code / commission
// ---------------------------------------------------------------------------

describe('parseCreateAppointmentBody (pure)', () => {
  const future = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const past = new Date(Date.now() - 3600 * 1000).toISOString();
  const tooSoon = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  it('hop le: chuan hoa ve ISO + mac dinh', () => {
    const out = parseCreateAppointmentBody({ scheduled_at: future, duration_minutes: 60, mode: 'zoom' });
    expect(out.durationMinutes).toBe(60);
    expect(out.mode).toBe('zoom');
    expect(out.instructorId).toBeNull();
    expect(out.note).toBeNull();
  });
  it('qua khu bi chan; dat truoc < 1h bi chan', () => {
    expect(() => parseCreateAppointmentBody({ scheduled_at: past, duration_minutes: 60, mode: 'zoom' })).toThrow(ApiError);
    expect(() => parseCreateAppointmentBody({ scheduled_at: tooSoon, duration_minutes: 60, mode: 'zoom' })).toThrow(ApiError);
  });
  it('duration 45 bi chan; mode sai bi chan; note > 1000 ky tu bi chan', () => {
    expect(() => parseCreateAppointmentBody({ scheduled_at: future, duration_minutes: 45, mode: 'zoom' })).toThrow(ApiError);
    expect(() => parseCreateAppointmentBody({ scheduled_at: future, duration_minutes: 60, mode: 'phone' })).toThrow(ApiError);
    expect(() =>
      parseCreateAppointmentBody({ scheduled_at: future, duration_minutes: 60, mode: 'zoom', note: 'x'.repeat(1001) }),
    ).toThrow(ApiError);
  });
});

describe('validateAppointmentPatch (pure)', () => {
  it('hoc vien huy lich pending cua minh -> ok', () => {
    const out = validateAppointmentPatch(makeAppt(), { userId: STUDENT_A, role: 'student' }, { status: 'cancelled' });
    expect(out.status).toBe('cancelled');
  });
  it('hoc vien xac nhan lich cua minh -> 403', () => {
    let caught: unknown;
    try {
      validateAppointmentPatch(makeAppt(), { userId: STUDENT_A, role: 'student' }, { status: 'confirmed' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(403);
    expect((caught as ApiError).code).toBe('forbidden');
  });
  it('admin confirm lich zoom thieu meeting_url -> 400; co meeting_url -> ok', () => {
    expect(() =>
      validateAppointmentPatch(makeAppt(), { userId: ADMIN_1, role: 'admin' }, { status: 'confirmed' }),
    ).toThrow(ApiError);
    const out = validateAppointmentPatch(
      makeAppt(),
      { userId: ADMIN_1, role: 'admin' },
      { status: 'confirmed', meeting_url: 'https://zoom.us/j/123456789' },
    );
    expect(out.status).toBe('confirmed');
    expect(out.meetingUrl).toBe('https://zoom.us/j/123456789');
  });
  it('instructor khong duoc giao tac dong lich -> 404; instructor duoc giao confirm duoc', () => {
    expect(() =>
      validateAppointmentPatch(
        makeAppt({ instructor_id: INSTRUCTOR_1 }),
        { userId: 'ffffffff-0000-4000-8000-000000000000', role: 'instructor' },
        { status: 'confirmed', meeting_url: 'https://zoom.us/j/1' },
      ),
    ).toThrow(ApiError);
    const out = validateAppointmentPatch(
      makeAppt(),
      { userId: INSTRUCTOR_1, role: 'instructor' },
      { status: 'confirmed', meeting_url: 'https://zoom.us/j/1' },
    );
    expect(out.status).toBe('confirmed');
  });
  it('chuyen tu completed sang cancelled -> 409', () => {
    expect(() =>
      validateAppointmentPatch(
        makeAppt({ status: 'completed' }),
        { userId: ADMIN_1, role: 'admin' },
        { status: 'cancelled' },
      ),
    ).toThrow(ApiError);
  });
});

describe('referral code + commission (pure)', () => {
  it('generateReferralCode: dinh dang VISFAR-XXXXXX, xac dinh theo user', async () => {
    const a = await generateReferralCode(STUDENT_A);
    const b = await generateReferralCode(STUDENT_A);
    expect(a).toBe(b);
    expect(a).toMatch(/^VISFAR-[A-Z0-9]{6}$/);
    const other = await generateReferralCode(STUDENT_B);
    expect(other).not.toBe(a);
  });
  it('computeCommissionAmount: 10% lam tron xuong; don 0đ -> 0', () => {
    expect(computeCommissionAmount(1999000)).toBe(199900);
    expect(computeCommissionAmount(1999999)).toBe(199999);
    expect(computeCommissionAmount(0)).toBe(0);
    expect(computeCommissionAmount(-5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// HTTP qua handleRequest + service co DB gia lap
// ---------------------------------------------------------------------------

describe('HTTP handlers qua handleRequest (workers/api/src/index.ts)', () => {
  let db: FakeDb;
  let env: Env;
  let keys: TestKeyPair;

  beforeEach(async () => {
    db = createDb();
    env = makeEnv();
    keys = await generateTestKeyPair(KID);
    db.jwksKeys = [keys.publicJwk];
    __resetJwksCache();
    __resetRateLimits();
    vi.stubGlobal('fetch', createMockFetch(db));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function call(
    method: string,
    path: string,
    opts: { body?: Record<string, unknown> | string; userId?: string | null } = {},
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const headers: Record<string, string> = { 'CF-Connecting-IP': '203.0.113.20' };
    if (opts.userId !== null && opts.userId !== undefined) {
      const token = await signTestJwt(keys.privateKey, KID, testJwtPayload(opts.userId));
      headers['Authorization'] = `Bearer ${token}`;
    } else if (opts.userId === undefined) {
      const token = await signTestJwt(keys.privateKey, KID, testJwtPayload(STUDENT_A));
      headers['Authorization'] = `Bearer ${token}`;
    }
    const init: RequestInit = { method, headers };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    }
    const res = await handleRequest(new Request(`${API}${path}`, init), env);
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  function futureIso(hours = 2): string {
    return new Date(Date.now() + hours * 3600 * 1000).toISOString();
  }

  async function seedAppointment(studentId: string, over: Partial<Row> = {}): Promise<Row> {
    const row: Row = {
      id: `00000000-0000-4000-8000-${String(db.seq + 1).padStart(12, '0')}`,
      student_id: studentId,
      instructor_id: INSTRUCTOR_1,
      scheduled_at: futureIso(),
      duration_minutes: 60,
      mode: 'zoom',
      status: 'pending',
      note: null,
      meeting_url: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...over,
    };
    db.seq += 1;
    db.tables['appointments']!.push(row);
    return row;
  }

  it('POST /api/v1/appointments hop le -> 201 pending; qua khu -> 400', async () => {
    const ok = await call('POST', '/api/v1/appointments', {
      body: { scheduled_at: futureIso(), duration_minutes: 60, mode: 'zoom', instructor_id: INSTRUCTOR_1 },
    });
    expect(ok.status).toBe(201);
    expect(ok.json['ok']).toBe(true);
    const appt = ok.json['appointment'] as Record<string, unknown>;
    expect(appt['status']).toBe('pending');
    expect(appt['student_id']).toBe(STUDENT_A);

    const past = await call('POST', '/api/v1/appointments', {
      body: { scheduled_at: new Date(Date.now() - 3600 * 1000).toISOString(), duration_minutes: 60, mode: 'zoom' },
    });
    expect(past.status).toBe(400);
    expect(past.json['error']).toBe('invalid_input');
  });

  it('POST /api/v1/appointments chon instructor la hoc vien -> 400', async () => {
    const res = await call('POST', '/api/v1/appointments', {
      body: { scheduled_at: futureIso(), duration_minutes: 30, mode: 'truc-tiep', instructor_id: STUDENT_B },
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/appointments: hoc vien chi thay lich cua minh; admin thay tat ca', async () => {
    await seedAppointment(STUDENT_A);
    await seedAppointment(STUDENT_B);
    const mine = await call('GET', '/api/v1/appointments', { userId: STUDENT_A });
    expect(mine.status).toBe(200);
    const list = mine.json['appointments'] as Array<Record<string, unknown>>;
    expect(list.length).toBe(1);
    expect(list[0]?.['student_id']).toBe(STUDENT_A);
    const all = await call('GET', '/api/v1/appointments', { userId: ADMIN_1 });
    const allList = all.json['appointments'] as Array<Record<string, unknown>>;
    expect(allList.length).toBe(2);
  });

  it('PATCH huy lich: khong phai cua minh -> 404; cua minh pending -> 200; huy lai -> 409', async () => {
    const row = await seedAppointment(STUDENT_A);
    const other = await call('PATCH', `/api/v1/appointments/${row['id']}`, {
      userId: STUDENT_B,
      body: { status: 'cancelled' },
    });
    expect(other.status).toBe(404);
    const mine = await call('PATCH', `/api/v1/appointments/${row['id']}`, {
      userId: STUDENT_A,
      body: { status: 'cancelled' },
    });
    expect(mine.status).toBe(200);
    expect((mine.json['appointment'] as Record<string, unknown>)['status']).toBe('cancelled');
    const again = await call('PATCH', `/api/v1/appointments/${row['id']}`, {
      userId: STUDENT_A,
      body: { status: 'cancelled' },
    });
    expect(again.status).toBe(409);
  });

  it('PATCH admin confirm lich zoom: thieu meeting_url -> 400; co link -> 200 confirmed', async () => {
    const row = await seedAppointment(STUDENT_A);
    const noUrl = await call('PATCH', `/api/v1/appointments/${row['id']}`, {
      userId: ADMIN_1,
      body: { status: 'confirmed' },
    });
    expect(noUrl.status).toBe(400);
    const withUrl = await call('PATCH', `/api/v1/appointments/${row['id']}`, {
      userId: ADMIN_1,
      body: { status: 'confirmed', meeting_url: 'https://zoom.us/j/987654321' },
    });
    expect(withUrl.status).toBe(200);
    const appt = withUrl.json['appointment'] as Record<string, unknown>;
    expect(appt['status']).toBe('confirmed');
    expect(appt['meeting_url']).toBe('https://zoom.us/j/987654321');
  });

  it('GET /api/v1/referrals/me tu tao code cho user moi; goi lai tra cung ma', async () => {
    const first = await call('GET', '/api/v1/referrals/me', { userId: STUDENT_C });
    expect(first.status).toBe(200);
    const code = first.json['referralCode'] as string;
    expect(code).toMatch(/^VISFAR-[A-Z0-9]{6}$/);
    expect(first.json['balanceVnd']).toBe(0);
    const second = await call('GET', '/api/v1/referrals/me', { userId: STUDENT_C });
    expect(second.json['referralCode']).toBe(code);
  });

  it('GET /api/v1/referrals/me cua referrer: so du + nguoi da gioi thieu + trang thai', async () => {
    // Seed hoa hong 199.900đ (10% don 1.999.000đ cua A) cho B.
    db.tables['wallet_transactions']!.push({
      id: 'wt-1', user_id: STUDENT_B, type: 'commission', amount_vnd: 199900,
      related_order_id: ORDER_1, status: 'completed', note: 'Hoa hồng', created_at: nowIso(),
    });
    const res = await call('GET', '/api/v1/referrals/me', { userId: STUDENT_B });
    expect(res.status).toBe(200);
    expect(res.json['referralCode']).toBe('VISFAR-BB1234');
    expect(res.json['balanceVnd']).toBe(199900);
    const referred = res.json['referred'] as Array<Record<string, unknown>>;
    expect(referred.length).toBe(1);
    expect(referred[0]?.['userId']).toBe(STUDENT_A);
    expect(referred[0]?.['hasPaidOrder']).toBe(true);
    expect(referred[0]?.['commissionEarnedVnd']).toBe(199900);
  });

  it('GET /api/v1/referrals/validate: ma ton tai -> valid true (khong can JWT); ma la -> false', async () => {
    const ok = await call('GET', '/api/v1/referrals/validate?code=VISFAR-BB1234', { userId: null });
    expect(ok.status).toBe(200);
    expect(ok.json['valid']).toBe(true);
    const bad = await call('GET', '/api/v1/referrals/validate?code=VISFAR-ZZZZZZ', { userId: null });
    expect(bad.json['valid']).toBe(false);
    const malformed = await call('GET', '/api/v1/referrals/validate?code=ABC', { userId: null });
    expect(malformed.json['valid']).toBe(false);
  });

  it('POST /api/v1/referrals/withdraw: vuot so du -> 400; hop le -> 201 pending, so am', async () => {
    db.tables['wallet_transactions']!.push({
      id: 'wt-a', user_id: STUDENT_A, type: 'commission', amount_vnd: 500000,
      related_order_id: null, status: 'completed', note: 'Hoa hồng', created_at: nowIso(),
    });
    const over = await call('POST', '/api/v1/referrals/withdraw', {
      body: { amount_vnd: 600000, payout_info: 'MB Bank 1234567890 Nguyen Van A' },
    });
    expect(over.status).toBe(400);
    const ok = await call('POST', '/api/v1/referrals/withdraw', {
      body: { amount_vnd: 200000, payout_info: 'MB Bank 1234567890 Nguyen Van A' },
    });
    expect(ok.status).toBe(201);
    const tx = ok.json['transaction'] as Record<string, unknown>;
    expect(tx['type']).toBe('withdrawal');
    expect(tx['status']).toBe('pending');
    expect(tx['amountVnd']).toBe(-200000);
    expect(ok.json['availableBalanceVnd']).toBe(300000);
    // Rut tiep 400.000đ vuot kha dung con lai (300.000đ) -> 400.
    const over2 = await call('POST', '/api/v1/referrals/withdraw', {
      body: { amount_vnd: 400000, payout_info: 'MB Bank 1234567890 Nguyen Van A' },
    });
    expect(over2.status).toBe(400);
  });

  it('recordReferralCommission: 10% don paid + idempotent (goi 2 lan chi 1 dong)', async () => {
    const order = makePaidOrder();
    const first = await recordReferralCommission(env, order);
    expect(first).not.toBeNull();
    expect(first?.amount_vnd).toBe(199900);
    expect(first?.user_id).toBe(STUDENT_B);
    expect(first?.type).toBe('commission');
    const second = await recordReferralCommission(env, order);
    expect(second).toBeNull();
    const rows = db.tables['wallet_transactions']!.filter((r) => r['type'] === 'commission');
    expect(rows.length).toBe(1);
  });

  it('recordReferralCommission: khong co referrer -> null; don 0đ -> null', async () => {
    const noRef = await recordReferralCommission(env, makePaidOrder({ user_id: STUDENT_C }));
    expect(noRef).toBeNull();
    const zero = await recordReferralCommission(env, makePaidOrder({ amount_vnd: 0 }));
    expect(zero).toBeNull();
    expect(db.tables['wallet_transactions']!.length).toBe(0);
  });

  it('requestWithdrawal truc tiep: vuot so du bi chan', async () => {
    db.tables['wallet_transactions']!.push({
      id: 'wt-b', user_id: STUDENT_A, type: 'commission', amount_vnd: 100000,
      related_order_id: null, status: 'completed', note: 'Hoa hồng', created_at: nowIso(),
    });
    await expectApiError(
      requestWithdrawal(env, STUDENT_A, { amountVnd: 100001, payoutInfo: 'MB Bank 1' }),
      400,
      'invalid_input',
    );
  });

  it('getOrCreateReferralCode: user da co ma -> tra ma cu, khong tao moi', async () => {
    const row = await getOrCreateReferralCode(env, STUDENT_B);
    expect(row.code).toBe('VISFAR-BB1234');
    expect(db.tables['referral_codes']!.length).toBe(1);
  });

  it('POST /api/v1/referrals/claim: ma dung -> 201 ghi referrals; goi lai -> 200 idempotent', async () => {
    // STUDENT_C chua co referrer; ma cua B ton tai (VISFAR-BB1234).
    const first = await call('POST', '/api/v1/referrals/claim', {
      userId: STUDENT_C,
      body: { code: 'visfar-bb1234' },
    });
    expect(first.status).toBe(201);
    expect(first.json['ok']).toBe(true);
    const referral = first.json['referral'] as Record<string, unknown>;
    expect(referral['referrerId']).toBe(STUDENT_B);
    expect(referral['referredUserId']).toBe(STUDENT_C);
    expect(db.tables['referrals']!.length).toBe(2);
    const again = await call('POST', '/api/v1/referrals/claim', {
      userId: STUDENT_C,
      body: { code: 'VISFAR-BB1234' },
    });
    expect(again.status).toBe(200);
    expect(again.json['alreadyClaimed']).toBe(true);
    expect(db.tables['referrals']!.length).toBe(2);
  });

  it('POST /api/v1/referrals/claim: ma khong ton tai -> 404; tu gioi thieu -> 400; ma sai dinh dang -> 400', async () => {
    const missing = await call('POST', '/api/v1/referrals/claim', {
      userId: STUDENT_C,
      body: { code: 'VISFAR-ZZ9999' },
    });
    expect(missing.status).toBe(404);
    expect(missing.json['error']).toBe('not_found');
    const selfRef = await call('POST', '/api/v1/referrals/claim', {
      userId: STUDENT_B,
      body: { code: 'VISFAR-BB1234' },
    });
    expect(selfRef.status).toBe(400);
    const badFormat = await call('POST', '/api/v1/referrals/claim', {
      userId: STUDENT_C,
      body: { code: 'KHONG-PHAI-MA' },
    });
    expect(badFormat.status).toBe(400);
    expect(db.tables['referrals']!.length).toBe(1);
  });

  it('POST /api/v1/referrals/claim: chua dang nhap -> 401', async () => {
    const res = await call('POST', '/api/v1/referrals/claim', {
      userId: null,
      body: { code: 'VISFAR-BB1234' },
    });
    expect(res.status).toBe(401);
  });
});
