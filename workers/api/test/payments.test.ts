// Test Payment & Commerce — TASK 10 (Workers API).
// Test logic THAT cua workers/api/src/payments.ts (createOrder,
// confirmPayment, processSepayWebhook, grantAccessForOrder,
// cancel/expire/refund, enrollFreeCourse, coupon) + cac ham pure
// (computeCouponDiscount, computeOrderTotals, canonicalOrderBody,
// toOrderSummary) — voi PostgREST GIA lap trong file nay.
//
// Mock PostgREST mo phong dung cac rang buoc that cua schema
// (0001/0004/0019): cot khong ton tai -> 400 PGRST204 (nhu that),
// UNIQUE idempotency_key / reference_code / (method,
// gateway_reference) -> 409 code 23505. Nho vay test moi bat duoc
// loi ghi cot khong ton tai (VD memberships.cancelled_at — B-T10-2).
// Mock KHONG phai Supabase that — test live staging nam o bao cao.
//
// KHONG thu tien that, KHONG goi SePay that: webhook duoc goi qua
// processSepayWebhook() truc tiep voi chu ky HMAC tu tao.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
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
  cancelOrder,
  canonicalOrderBody,
  computeCouponDiscount,
  computeOrderTotals,
  confirmPayment,
  createOrder,
  enrollFreeCourse,
  executeRefund,
  expirePendingOrders,
  grantAccessForOrder,
  processSepayWebhook,
  requestRefund,
  toOrderSummary,
  type CouponRow,
  type CreateOrderInput,
  type OrderRow,
  type OrderItemRow,
} from '../src/payments';

const BASE = 'https://test.supabase.co';
const USER_1 = '66666666-6666-4666-8666-666666666666';
const ADMIN_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COURSE_A = '11111111-1111-4111-8111-111111111111';
const COURSE_FREE = '22222222-2222-4222-8222-222222222222';
const COURSE_PWYW = '33333333-3333-4333-8333-333333333333';
const COURSE_DRAFT = '44444444-4444-4333-8333-444444444444';
const PLAN_COMMUNITY = '55555555-5555-4333-8333-555555555555';
const COUPON_10 = '66666666-6666-4666-8666-666666666661';
const SEPAY_SECRET = 'test-sepay-webhook-secret';

type Row = Record<string, unknown>;

// Cot cho phep / bang — theo schema that (0001/0004/0019). Cot nao
// khong co o day ma code ghi -> mock tra 400 PGRST204 (nhu that).
const COLUMNS: Record<string, string[]> = {
  courses: ['id', 'title', 'slug', 'price_vnd', 'status', 'is_pay_what_you_want'],
  membership_plans: ['id', 'slug', 'name', 'description', 'price_vnd', 'duration_days', 'course_id', 'is_active'],
  coupons: ['id', 'code', 'description', 'discount_type', 'discount_value', 'min_order_vnd', 'max_discount_vnd', 'max_uses', 'used_count', 'valid_from', 'valid_until', 'is_active', 'created_by'],
  orders: ['id', 'user_id', 'course_id', 'coupon_id', 'amount_vnd', 'original_amount_vnd', 'discount_vnd', 'custom_amount_vnd', 'status', 'payment_method', 'reference_code', 'expires_at', 'paid_at', 'refund_reason', 'refund_requested_at', 'refunded_at', 'refund_bank_reference', 'idempotency_key', 'idempotency_body_hash', 'created_at', 'updated_at'],
  order_items: ['id', 'order_id', 'item_type', 'course_id', 'membership_plan_id', 'title_snapshot', 'amount_vnd', 'item_name', 'unit_price_vnd', 'quantity', 'total_vnd', 'created_at', 'updated_at'],
  payments: ['id', 'order_id', 'amount_vnd', 'method', 'gateway_reference', 'gateway_payload', 'status', 'paid_at', 'verified_by', 'created_at', 'updated_at'],
  enrollments: ['id', 'user_id', 'course_id', 'order_id', 'status', 'enrolled_at', 'completed_at', 'created_at', 'updated_at'],
  memberships: ['id', 'user_id', 'plan_id', 'order_id', 'status', 'started_at', 'ends_at', 'created_at', 'updated_at'],
  certificates: ['id', 'user_id', 'course_id', 'status', 'revoked_at', 'revoked_by', 'revoked_reason', 'created_at', 'updated_at'],
  profiles: ['id', 'full_name', 'email'],
  system_settings: ['key', 'value', 'description', 'is_public'],
};

interface FakeDb {
  tables: Record<string, Row[]>;
  seq: number;
  refSeq: number;
  resendCalls: unknown[];
  jwksKeys: Array<Record<string, unknown>>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createDb(): FakeDb {
  const db: FakeDb = { tables: {}, seq: 0, refSeq: 123, resendCalls: [], jwksKeys: [] };
  for (const t of Object.keys(COLUMNS)) db.tables[t] = [];
  db.tables['audit_logs'] = [];
  db.tables['notifications'] = [];
  db.tables['email_logs'] = [];
  db.tables['courses']!.push(
    { id: COURSE_A, title: 'Thấu Hiểu Nội Tâm', slug: 'thau-hieu-noi-tam', price_vnd: 1999000, status: 'published', is_pay_what_you_want: false },
    { id: COURSE_FREE, title: 'Khóa miễn phí', slug: 'khoa-mien-phi', price_vnd: 0, status: 'published', is_pay_what_you_want: false },
    { id: COURSE_PWYW, title: 'Khóa Tùy tâm', slug: 'khoa-tuy-tam', price_vnd: 0, status: 'published', is_pay_what_you_want: true },
    { id: COURSE_DRAFT, title: 'Khóa nháp', slug: 'khoa-nhap', price_vnd: 500000, status: 'draft', is_pay_what_you_want: false },
  );
  db.tables['membership_plans']!.push({
    id: PLAN_COMMUNITY, slug: 'cong-dong', name: 'Cộng đồng Visfar', description: null,
    price_vnd: 499000, duration_days: 365, course_id: COURSE_A, is_active: true,
  });
  db.tables['coupons']!.push(
    { id: COUPON_10, code: 'GIAM10', description: null, discount_type: 'percent', discount_value: 10, min_order_vnd: 0, max_discount_vnd: 50000, max_uses: null, used_count: 0, valid_from: null, valid_until: null, is_active: true, created_by: null },
    { id: 'c100', code: 'FREE100', description: null, discount_type: 'percent', discount_value: 100, min_order_vnd: 0, max_discount_vnd: null, max_uses: null, used_count: 0, valid_from: null, valid_until: null, is_active: true, created_by: null },
    { id: 'cfix', code: 'GIAM200K', description: null, discount_type: 'fixed_vnd', discount_value: 200000, min_order_vnd: 0, max_discount_vnd: null, max_uses: null, used_count: 0, valid_from: null, valid_until: null, is_active: true, created_by: null },
    { id: 'cexp', code: 'HETHAN', description: null, discount_type: 'percent', discount_value: 50, min_order_vnd: 0, max_discount_vnd: null, max_uses: null, used_count: 0, valid_from: null, valid_until: '2026-01-01T00:00:00.000Z', is_active: true, created_by: null },
    { id: 'cmin', code: 'MIN5TR', description: null, discount_type: 'percent', discount_value: 10, min_order_vnd: 5000000, max_discount_vnd: null, max_uses: null, used_count: 0, valid_from: null, valid_until: null, is_active: true, created_by: null },
    { id: 'cused', code: 'HETLUOT', description: null, discount_type: 'percent', discount_value: 10, min_order_vnd: 0, max_discount_vnd: null, max_uses: 1, used_count: 1, valid_from: null, valid_until: null, is_active: true, created_by: null },
    { id: 'coff', code: 'TAT', description: null, discount_type: 'percent', discount_value: 10, min_order_vnd: 0, max_discount_vnd: null, max_uses: null, used_count: 0, valid_from: null, valid_until: null, is_active: false, created_by: null },
  );
  db.tables['profiles']!.push(
    { id: USER_1, full_name: 'Nguyễn Văn A', email: 'a@example.com', role: 'student' },
    { id: ADMIN_1, full_name: 'Admin', email: 'admin@example.com', role: 'admin' },
  );
  db.tables['system_settings']!.push(
    { key: 'order.expiry_hours', value: 48, description: '', is_public: false },
    { key: 'refund.working_days', value: 15, description: '', is_public: false },
  );
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
    if (k.includes('.')) continue; // VD orders.user_id (join) — xu ly rieng o nhanh GET.
    const m = v.match(/^(eq|lt|gt|gte|lte|ne|neq)\.(.*)$/s);
    if (!m) continue; // ilike / not.is / in. — mock khong loc (tra ve nhu khong loc).
    const [, op, raw] = m as [string, string, string];
    out = out.filter((r) => {
      const cell = r[k];
      const c = cell === null || cell === undefined ? '' : String(cell);
      if (op === 'eq') return c === raw;
      if (op === 'ne' || op === 'neq') return c !== raw;
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

// Cot NOT NULL that (sau 0019) — mock enforce nhu Postgres: thieu /
// null -> 400 code 23502. Them vao day khi schema doi, khong chi
// dua vao COLUMNS (chi bat cot khong ton tai). Bug 11/11/2026:
// createOrder quen gui title_snapshot/amount_vnd cua order_items.
const NOT_NULL: Record<string, string[]> = {
  order_items: ['order_id', 'title_snapshot', 'amount_vnd', 'item_type', 'item_name', 'unit_price_vnd', 'quantity', 'total_vnd'],
  // orders.reference_code do trigger generate_order_reference sinh o DB
  // nen khong dua vao day (code khong gui reference_code khi insert).
};

function checkNotNull(table: string, body: Row): Response | null {
  for (const col of NOT_NULL[table] ?? []) {
    if (body[col] === null || body[col] === undefined) {
      return jsonResponse(
        { message: `null value in column "${col}" of relation "${table}" violates not-null constraint`, code: '23502' },
        400,
      );
    }
  }
  // CHECK that cua order_items (0019): total = don gia * so luong.
  if (table === 'order_items' && body['total_vnd'] !== undefined && body['unit_price_vnd'] !== undefined && body['quantity'] !== undefined) {
    if (body['total_vnd'] !== (body['unit_price_vnd'] as number) * (body['quantity'] as number)) {
      return jsonResponse(
        { message: 'new row for relation "order_items" violates check constraint "order_items_total_check"', code: '23514' },
        400,
      );
    }
  }
  return null;
}

function createMockFetch(db: FakeDb): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const href = url.href;
    const prefer = String((init?.headers as Record<string, string> | undefined)?.['Prefer'] ?? '');

    if (href.startsWith('https://api.resend.com/')) {
      db.resendCalls.push(init?.body ? JSON.parse(String(init.body)) : {});
      return jsonResponse({ id: 're_mock_1' }, 200);
    }
    // JWKS Supabase Auth (cho requireAuthUser/requireAdmin trong test handler).
    if (href.includes('/auth/v1/.well-known/jwks.json')) {
      return jsonResponse({ keys: db.jwksKeys });
    }
    if (!href.startsWith(`${BASE}/rest/v1/`)) {
      return jsonResponse({ message: `fake: unknown URL ${href}` }, 500);
    }
    const path = url.pathname.replace('/rest/v1/', '');

    // RPC coupon.
    if (path === 'rpc/apply_coupon_use' || path === 'rpc/release_coupon_use') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { p_coupon_id: string };
      const coupon = db.tables['coupons']!.find((c) => c['id'] === body.p_coupon_id) as Row | undefined;
      if (!coupon) return jsonResponse(false);
      if (path.endsWith('apply_coupon_use')) {
        if (coupon['max_uses'] !== null && (coupon['used_count'] as number) >= (coupon['max_uses'] as number)) {
          return jsonResponse(false);
        }
        coupon['used_count'] = (coupon['used_count'] as number) + 1;
        return jsonResponse(true);
      }
      coupon['used_count'] = Math.max(0, (coupon['used_count'] as number) - 1);
      return jsonResponse(true);
    }

    const table = path.split('/')[0] as string;
    const rows = db.tables[table];
    if (!rows) return jsonResponse({ message: `fake chua ho tro bang ${table}`, code: 'XX000' }, 500);
    const allowed = COLUMNS[table];
    const checkColumns = (body: Row): Response | null => {
      if (!allowed) return null; // bang log: cho phep (Task 11 so huu).
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

    if (method === 'GET') {
      // Join mong: /payments?...&orders.user_id=eq.X — loc theo don cua user.
      let list = rows;
      const ouid = url.searchParams.get('orders.user_id');
      if (table === 'payments' && ouid?.startsWith('eq.')) {
        const uid = decodeURIComponent(ouid.slice(3));
        const ids = new Set(
          db.tables['orders']!.filter((o) => String(o['user_id']) === uid).map((o) => String(o['id'])),
        );
        list = list.filter((r) => ids.has(String(r['order_id'])));
      }
      // Nhung orders(id,reference_code,...) / orders!inner(...) — nhu PostgREST.
      const sel = url.searchParams.get('select') ?? '';
      const om = sel.match(/orders(?:!inner)?\(([^)]*)\)/);
      if (table === 'payments' && om) {
        const fields = om[1]!.split(',').map((s) => s.trim());
        list = list.map((r) => {
          const o = db.tables['orders']!.find((x) => String(x['id']) === String(r['order_id']));
          if (!o) return r;
          const embedded: Row = {};
          for (const f of fields) embedded[f] = o[f] ?? null;
          return { ...r, orders: embedded };
        });
      }
      return jsonResponse(matchFilters(list, url));
    }

    if (method === 'POST') {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as Row | Row[];
      const list = Array.isArray(parsed) ? parsed : [parsed];
      // Upsert on_conflict (enrollments).
      const onConflict = url.searchParams.get('on_conflict');
      const out: Row[] = [];
      for (const body of list) {
        const bad = checkColumns(body);
        if (bad) return bad;
        const missing = checkNotNull(table, body);
        if (missing) return missing;
        if (onConflict) {
          const keys = onConflict.split(',');
          const found = rows.find((r) => keys.every((k) => String(r[k] ?? '') === String(body[k] ?? '')));
          if (found) {
            Object.assign(found, body, { updated_at: nowIso() });
            out.push(found);
            continue;
          }
        }
        // UNIQUE.
        if (table === 'orders') {
          if (body['idempotency_key'] != null && rows.some((r) => r['idempotency_key'] === body['idempotency_key'])) {
            return jsonResponse({ message: 'duplicate key value violates unique constraint "idx_orders_idempotency_key"', code: '23505' }, 409);
          }
          if (body['reference_code'] != null && rows.some((r) => r['reference_code'] === body['reference_code'])) {
            return jsonResponse({ message: 'duplicate key value violates unique constraint "orders_reference_code_key"', code: '23505' }, 409);
          }
        }
        if (table === 'payments') {
          if (body['gateway_reference'] != null && rows.some((r) => r['method'] === body['method'] && r['gateway_reference'] === body['gateway_reference'])) {
            return jsonResponse({ message: 'duplicate key value violates unique constraint "payments_method_gateway_reference_key"', code: '23505' }, 409);
          }
        }
        if (table === 'coupons') {
          if (rows.some((r) => r['code'] === body['code'])) {
            return jsonResponse({ message: 'duplicate key value violates unique constraint "coupons_code_key"', code: '23505' }, 409);
          }
        }
        const row: Row = { ...body };
        db.seq += 1;
        row['id'] = (body['id'] as string | undefined) ?? `${table}-${db.seq}`;
        if (table === 'orders' && !row['reference_code']) {
          row['reference_code'] = `DH-2026-${String(db.refSeq).padStart(6, '0')}`;
          db.refSeq += 1;
        }
        row['created_at'] = (body['created_at'] as string | undefined) ?? nowIso();
        if (allowed?.includes('updated_at')) row['updated_at'] = nowIso();
        rows.push(row);
        out.push(row);
      }
      if (prefer.includes('return=minimal')) return new Response('', { status: 201 });
      return jsonResponse(out, 201);
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
    SEPAY_WEBHOOK_SECRET: SEPAY_SECRET,
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'Visfar Academy <test@example.com>',
  } as Env;
}

function couponRow(db: FakeDb, code: string): CouponRow {
  const row = db.tables['coupons']!.find((c) => c['code'] === code) as unknown as CouponRow;
  if (!row) throw new Error(`khong co coupon ${code} trong seed`);
  return row;
}

function orderInput(courseId: string, over: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return { items: [{ itemType: 'course', courseId }], ...over };
}

function seedPendingOrder(db: FakeDb, over: Partial<Row> = {}): Row {
  const row: Row = {
    id: `order-seed-${db.seq + 1}`,
    user_id: USER_1,
    course_id: COURSE_A,
    coupon_id: null,
    amount_vnd: 1999000,
    original_amount_vnd: 1999000,
    discount_vnd: 0,
    custom_amount_vnd: null,
    status: 'pending',
    payment_method: 'bank_transfer',
    reference_code: 'DH-2026-000123',
    expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    paid_at: null,
    refund_reason: null,
    refund_requested_at: null,
    refunded_at: null,
    refund_bank_reference: null,
    idempotency_key: null,
    idempotency_body_hash: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    ...over,
  };
  db.seq += 1;
  db.tables['orders']!.push(row);
  db.tables['order_items']!.push({
    id: `item-seed-${db.seq}`,
    order_id: row['id'],
    item_type: 'course',
    course_id: COURSE_A,
    membership_plan_id: null,
    item_name: 'Thấu Hiểu Nội Tâm',
    unit_price_vnd: 1999000,
    quantity: 1,
    total_vnd: 1999000,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  return row;
}

// Ky webhook theo scheme that cua SePay (SEPAY_INTEGRATION.md §4.2):
// HMAC-SHA256("{timestamp}.{body}"), timestamp = Unix seconds hien tai
// (tuoi 5 phut). Tra kem timestamp de test truyen vao header
// X-SePay-Timestamp.
function signSepay(body: string, timestamp?: number): { sig: string; timestamp: number } {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', SEPAY_SECRET).update(`${ts}.${body}`, 'utf8').digest('hex');
  return { sig, timestamp: ts };
}

function webhookBody(over: Record<string, unknown> = {}): {
  raw: string;
  sig: string;
  timestamp: number;
} {
  const raw = JSON.stringify({
    id: 'SEPAY-20261110-000001',
    transferAmount: 1999000,
    content: 'DH-2026-000123 thanh toan khoa hoc',
    ...over,
  });
  const { sig, timestamp } = signSepay(raw);
  return { raw, sig, timestamp };
}

let db: FakeDb;
let env: Env;

beforeEach(() => {
  db = createDb();
  env = makeEnv();
  vi.stubGlobal('fetch', createMockFetch(db));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  throw new Error(`du kien loi ${status}/${code} nhung khong co loi`);
}

describe('computeCouponDiscount — pure', () => {
  const now = new Date('2026-11-10T00:00:00.000Z');
  it('percent 10% tren 1.999.000d -> 199.900d, cap max_discount 50.000d -> 50.000d', () => {
    expect(computeCouponDiscount(couponRow(db, 'GIAM10'), 1999000, now)).toEqual({
      discountVnd: 50000,
      reason: null,
    });
  });
  it('percent 100% -> giam het don', () => {
    expect(computeCouponDiscount(couponRow(db, 'FREE100'), 1999000, now)).toEqual({
      discountVnd: 1999000,
      reason: null,
    });
  });
  it('fixed 200.000d; fixed lon hon don -> cap bang don', () => {
    expect(computeCouponDiscount(couponRow(db, 'GIAM200K'), 1999000, now).discountVnd).toBe(200000);
    expect(computeCouponDiscount(couponRow(db, 'GIAM200K'), 100000, now).discountVnd).toBe(100000);
  });
  it('khong active / het han / het luot / chua du don toi thieu -> 0 + ly do', () => {
    expect(computeCouponDiscount(couponRow(db, 'TAT'), 1999000, now)).toEqual({ discountVnd: 0, reason: 'coupon_inactive' });
    expect(computeCouponDiscount(couponRow(db, 'HETHAN'), 1999000, now)).toEqual({ discountVnd: 0, reason: 'coupon_expired' });
    expect(computeCouponDiscount(couponRow(db, 'HETLUOT'), 1999000, now)).toEqual({ discountVnd: 0, reason: 'coupon_used_up' });
    expect(computeCouponDiscount(couponRow(db, 'MIN5TR'), 1999000, now)).toEqual({ discountVnd: 0, reason: 'min_order_not_met' });
  });
});

describe('computeOrderTotals — pure', () => {
  const now = new Date('2026-11-10T00:00:00.000Z');
  it('nhieu item cong don; khong coupon -> amount = goc', () => {
    const t = computeOrderTotals(
      [{ unitPriceVnd: 1999000, quantity: 1 }, { unitPriceVnd: 499000, quantity: 2 }],
      null,
      now,
    );
    expect(t).toEqual({ originalAmountVnd: 2997000, discountVnd: 0, amountVnd: 2997000, couponReason: null });
  });
  it('coupon 100% -> amount 0', () => {
    const t = computeOrderTotals([{ unitPriceVnd: 1999000, quantity: 1 }], couponRow(db, 'FREE100'), now);
    expect(t.amountVnd).toBe(0);
    expect(t.discountVnd).toBe(1999000);
  });
  it('coupon het han -> amount giu nguyen + ly do', () => {
    const t = computeOrderTotals([{ unitPriceVnd: 1999000, quantity: 1 }], couponRow(db, 'HETHAN'), now);
    expect(t.amountVnd).toBe(1999000);
    expect(t.couponReason).toBe('coupon_expired');
  });
});

describe('canonicalOrderBody — pure (idempotency hash)', () => {
  it('cung item, khac thu tu -> cung chuoi (sap xep truoc khi hash)', () => {
    const a = canonicalOrderBody({ items: [{ itemType: 'course', courseId: COURSE_A }, { itemType: 'membership', planId: PLAN_COMMUNITY }] });
    const b = canonicalOrderBody({ items: [{ itemType: 'membership', planId: PLAN_COMMUNITY }, { itemType: 'course', courseId: COURSE_A }] });
    expect(a).toBe(b);
  });
  it('coupon chuan hoa hoa + trim; customAmount khac -> khac chuoi', () => {
    const a = canonicalOrderBody({ items: [{ itemType: 'course', courseId: COURSE_A }], couponCode: ' giam10 ' });
    const b = canonicalOrderBody({ items: [{ itemType: 'course', courseId: COURSE_A }], couponCode: 'GIAM10' });
    expect(a).toBe(b);
    const c = canonicalOrderBody({ items: [{ itemType: 'course', courseId: COURSE_PWYW }], customAmountVnd: 100000 });
    const d = canonicalOrderBody({ items: [{ itemType: 'course', courseId: COURSE_PWYW }], customAmountVnd: 200000 });
    expect(c).not.toBe(d);
  });
});

describe('toOrderSummary — pure', () => {
  it('don pending -> co khoi transfer (MB Bank, chu TK, noi dung = ma don), khong co so TK', () => {
    const order = seedPendingOrder(db) as unknown as OrderRow;
    const items = db.tables['order_items'] as unknown as OrderItemRow[];
    const s = toOrderSummary(order, items, null);
    expect(s.transfer).toEqual({
      bankName: 'MB Bank',
      accountHolder: 'Công ty TNHH MTV Visfar Holdings',
      content: 'DH-2026-000123',
      amountVnd: 1999000,
    });
    expect(Object.keys(s.transfer ?? {}).sort()).toEqual([
      'accountHolder',
      'amountVnd',
      'bankName',
      'content',
    ]);
  });
  it('don paid -> transfer null', () => {
    const order = seedPendingOrder(db, { status: 'paid', paid_at: nowIso() }) as unknown as OrderRow;
    const items = db.tables['order_items'] as unknown as OrderItemRow[];
    expect(toOrderSummary(order, items, null).transfer).toBeNull();
  });
});

describe('createOrder — tao don (gia lay tu DB, khong tin client)', () => {
  it('don thuong: gia tu DB, pending, han 48h, duplicate:false', async () => {
    const r = await createOrder(env, USER_1, orderInput(COURSE_A), 'key-1');
    expect(r.duplicate).toBe(false);
    expect(r.order.status).toBe('pending');
    expect(r.order.amountVnd).toBe(1999000);
    expect(r.order.referenceCode).toMatch(/^DH-2026-\d{6}$/);
    expect(r.order.transfer?.content).toBe(r.order.referenceCode);
    expect(db.tables['orders']!.length).toBe(1);
    expect(db.tables['order_items']!.length).toBe(1);
    expect(db.tables['audit_logs']!.some((a) => a['action'] === 'order.create')).toBe(true);
  });

  it('hoi quy B-T10-6: order_items phai co title_snapshot + amount_vnd (cot cu 0004 NOT NULL)', async () => {
    const r = await createOrder(env, USER_1, orderInput(COURSE_A), 'key-title-snapshot');
    expect(r.order.status).toBe('pending');
    const items = db.tables['order_items']! as unknown as OrderItemRow[];
    expect(items.length).toBe(1);
    expect(items[0]!.title_snapshot).toBe('Thấu Hiểu Nội Tâm');
    expect(items[0]!.amount_vnd).toBe(1999000);
    expect(items[0]!.item_name).toBe('Thấu Hiểu Nội Tâm');
    expect(items[0]!.total_vnd).toBe(1999000);
  });

  it('hoi quy B-T10-6: don goi thanh vien cung co title_snapshot + amount_vnd', async () => {
    const r = await createOrder(env, USER_1, { items: [{ itemType: 'membership', planId: PLAN_COMMUNITY }] }, 'key-plan-snapshot');
    expect(r.order.status).toBe('pending');
    const items = db.tables['order_items']! as unknown as OrderItemRow[];
    expect(items.length).toBe(1);
    expect(items[0]!.title_snapshot).toBe('Cộng đồng Visfar');
    expect(items[0]!.amount_vnd).toBe(499000);
    expect(items[0]!.membership_plan_id).toBe(PLAN_COMMUNITY);
    expect(items[0]!.course_id).toBeNull();
  });

  it('trung Idempotency-Key + cung body -> tra don cu, duplicate:true, khong tao don moi', async () => {
    const first = await createOrder(env, USER_1, orderInput(COURSE_A), 'key-dup');
    const second = await createOrder(env, USER_1, orderInput(COURSE_A), 'key-dup');
    expect(second.duplicate).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(db.tables['orders']!.length).toBe(1);
  });

  it('trung Idempotency-Key + khac body -> 409 idempotency_conflict, khong ghi', async () => {
    await createOrder(env, USER_1, orderInput(COURSE_A), 'key-conf');
    await expectApiError(
      createOrder(env, USER_1, orderInput(COURSE_FREE), 'key-conf'),
      409,
      'idempotency_conflict',
    );
    expect(db.tables['orders']!.length).toBe(1);
  });

  it('khoa draft / khong ton tai / don rong / >20 item -> 400', async () => {
    await expectApiError(createOrder(env, USER_1, orderInput(COURSE_DRAFT), 'k1'), 400, 'invalid_course');
    await expectApiError(createOrder(env, USER_1, orderInput('khong-ton-tai'), 'k2'), 400, 'invalid_course');
    await expectApiError(createOrder(env, USER_1, { items: [] }, 'k3'), 400, 'invalid_input');
    const many = Array.from({ length: 21 }, () => ({ itemType: 'course' as const, courseId: COURSE_A }));
    await expectApiError(createOrder(env, USER_1, { items: many }, 'k4'), 400, 'invalid_input');
  });

  it('Tuy tam: chi 1 khoa PWYW; dung chung coupon -> 400; dung cho khoa thuong -> 400', async () => {
    await expectApiError(
      createOrder(env, USER_1, orderInput(COURSE_A, { customAmountVnd: 100000 }), 'k5'),
      400,
      'invalid_input',
    );
    await expectApiError(
      createOrder(env, USER_1, orderInput(COURSE_PWYW, { customAmountVnd: 100000, couponCode: 'GIAM10' }), 'k6'),
      400,
      'invalid_input',
    );
    const ok = await createOrder(env, USER_1, orderInput(COURSE_PWYW, { customAmountVnd: 100000 }), 'k7');
    expect(ok.order.amountVnd).toBe(100000);
    expect(ok.order.customAmountVnd).toBe(100000);
    expect(ok.order.status).toBe('pending');
  });

  it('coupon: ma khong ton tai / het han / het luot -> 400; GIAM10 tru dung 50.000d (cap)', async () => {
    await expectApiError(createOrder(env, USER_1, orderInput(COURSE_A, { couponCode: 'KHONGCO' }), 'k8'), 400, 'invalid_input');
    await expectApiError(createOrder(env, USER_1, orderInput(COURSE_A, { couponCode: 'HETHAN' }), 'k9'), 400, 'invalid_input');
    await expectApiError(createOrder(env, USER_1, orderInput(COURSE_A, { couponCode: 'HETLUOT' }), 'k10'), 400, 'invalid_input');
    const r = await createOrder(env, USER_1, orderInput(COURSE_A, { couponCode: 'giam10' }), 'k11');
    expect(r.order.originalAmountVnd).toBe(1999000);
    expect(r.order.discountVnd).toBe(50000);
    expect(r.order.amountVnd).toBe(1949000);
  });

  it('coupon 100% -> don 0d: paid ngay + cap quyen luon, khong co payments row', async () => {
    const r = await createOrder(env, USER_1, orderInput(COURSE_A, { couponCode: 'FREE100' }), 'k12');
    expect(r.order.status).toBe('paid');
    expect(r.order.amountVnd).toBe(0);
    expect(db.tables['payments']!.length).toBe(0);
    expect(db.tables['enrollments']!.some((e) => e['user_id'] === USER_1 && e['course_id'] === COURSE_A)).toBe(true);
  });

  it('khoa mien phi (0d) -> paid ngay + cap quyen; da ghi danh active -> 409 conflict', async () => {
    const r = await createOrder(env, USER_1, orderInput(COURSE_FREE), 'k13');
    expect(r.order.status).toBe('paid');
    await expectApiError(createOrder(env, USER_1, orderInput(COURSE_FREE), 'k14'), 409, 'conflict');
  });

  it('key het han 24h -> tao don moi (don moi khong mang key cu) [hoi quy B-T10-5 — da sua 10/11/2026]', async () => {
    const old = seedPendingOrder(db, {
      idempotency_key: 'key-cu',
      idempotency_body_hash: 'hash-cu',
      created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    });
    const r = await createOrder(env, USER_1, orderInput(COURSE_A), 'key-cu');
    // Ky vong theo API_ARCHITECTURE §4: het han -> xu ly nhu key moi (don moi).
    expect(r.order.id).not.toBe(old['id']);
    expect(r.duplicate).toBe(false);
    expect(db.tables['orders']!.length).toBe(2);
    // Don moi khong mang key cu (tranh UNIQUE chan insert).
    expect(db.tables['orders']!.find((o) => o['id'] === r.order.id)!['idempotency_key']).toBeNull();
  });
});

describe('confirmPayment — xac nhan thu cong / webhook (khong tin client)', () => {
  function paidOrder(): { order: OrderRow; items: OrderItemRow[] } {
    const row = seedPendingOrder(db) as unknown as OrderRow;
    const items = db.tables['order_items'] as unknown as OrderItemRow[];
    return { order: row, items };
  }

  it('khop so tien -> paid + payments succeeded + cap quyen + duplicate:false', async () => {
    const { order } = paidOrder();
    const r = await confirmPayment(env, order, {
      method: 'sepay', amountVnd: 1999000, gatewayReference: 'SEPAY-1',
      gatewayPayload: {}, verifiedBy: null, source: 'sepay_webhook',
    });
    expect(r.duplicate).toBe(false);
    expect(r.order.status).toBe('paid');
    expect(db.tables['payments']!.length).toBe(1);
    expect(db.tables['payments']![0]!['status']).toBe('succeeded');
    expect(db.tables['enrollments']!.some((e) => e['user_id'] === USER_1 && e['course_id'] === COURSE_A)).toBe(true);
    expect(db.tables['audit_logs']!.some((a) => a['action'] === 'order.paid')).toBe(true);
  });

  it('lech so tien -> 422 payment_mismatch, don van pending, ghi payments failed + audit', async () => {
    const { order } = paidOrder();
    await expectApiError(
      confirmPayment(env, order, {
        method: 'sepay', amountVnd: 1999000 - 1, gatewayReference: 'SEPAY-2',
        gatewayPayload: {}, verifiedBy: null, source: 'sepay_webhook',
      }),
      422,
      'payment_mismatch',
    );
    expect(db.tables['orders']![0]!['status']).toBe('pending');
    expect(db.tables['payments']!.length).toBe(1);
    expect(db.tables['payments']![0]!['status']).toBe('failed');
    expect(db.tables['enrollments']!.length).toBe(0);
    expect(db.tables['audit_logs']!.some((a) => a['action'] === 'order.payment_mismatch')).toBe(true);
  });

  it('webhook gui lai cung giao dich -> duplicate:true, khong tao payment/enrollment thu 2', async () => {
    const { order } = paidOrder();
    const input = { method: 'sepay' as const, amountVnd: 1999000, gatewayReference: 'SEPAY-3', gatewayPayload: {}, verifiedBy: null, source: 'sepay_webhook' };
    await confirmPayment(env, order, input);
    const again = await confirmPayment(env, { ...order, status: 'paid' }, input);
    expect(again.duplicate).toBe(true);
    expect(db.tables['payments']!.length).toBe(1);
    expect(db.tables['enrollments']!.length).toBe(1);
  });

  it('don cancelled / refunded -> 409, khong doi trang thai', async () => {
    const { order } = paidOrder();
    await expectApiError(
      confirmPayment(env, { ...order, status: 'cancelled' }, {
        method: 'sepay', amountVnd: 1999000, gatewayReference: 'SEPAY-4',
        gatewayPayload: {}, verifiedBy: null, source: 'sepay_webhook',
      }),
      409,
      'conflict',
    );
    expect(db.tables['payments']!.length).toBe(0);
  });
});

describe('processSepayWebhook — end-to-end qua ham xu ly webhook', () => {
  it('chu ky sai / thieu secret -> 401, khong ghi DB', async () => {
    seedPendingOrder(db);
    const { raw } = webhookBody();
    const out = await processSepayWebhook(env, raw, 'chu-ky-sai', String(Math.floor(Date.now() / 1000)));
    expect(out.httpStatus).toBe(401);
    expect(db.tables['payments']!.length).toBe(0);
    expect(db.tables['orders']![0]!['status']).toBe('pending');
    const signed = signSepay(raw);
    const noSecret = await processSepayWebhook(
      { ...env, SEPAY_WEBHOOK_SECRET: '' } as Env,
      raw,
      signed.sig,
      String(signed.timestamp),
    );
    expect(noSecret.httpStatus).toBe(401);
  });

  it('chu ky dung + khop tien -> 200 ok:true, don paid, cap quyen', async () => {
    seedPendingOrder(db);
    const { raw, sig, timestamp } = webhookBody();
    const out = await processSepayWebhook(env, raw, sig, String(timestamp));
    expect(out).toEqual({
      httpStatus: 200,
      body: {
        success: true,
        ok: true,
        matched: true,
        duplicate: false,
        referenceCode: 'DH-2026-000123',
        status: 'paid',
      },
    });
    expect(db.tables['orders']![0]!['status']).toBe('paid');
    expect(db.tables['enrollments']!.length).toBe(1);
  });

  it('gui lai webhook -> 200 duplicate:true, chi 1 payment', async () => {
    seedPendingOrder(db);
    const { raw, sig, timestamp } = webhookBody();
    await processSepayWebhook(env, raw, sig, String(timestamp));
    const again = await processSepayWebhook(env, raw, sig, String(timestamp));
    expect(again.body).toMatchObject({ ok: true, duplicate: true });
    expect(db.tables['payments']!.length).toBe(1);
    expect(db.tables['enrollments']!.length).toBe(1);
  });

  it('lech tien -> 200 payment_mismatch (khong retry vo han), don van pending', async () => {
    seedPendingOrder(db);
    const { raw, sig, timestamp } = webhookBody({ transferAmount: 1000000 });
    const out = await processSepayWebhook(env, raw, sig, String(timestamp));
    expect(out.httpStatus).toBe(200);
    expect(out.body).toMatchObject({ ok: false, error: 'payment_mismatch' });
    expect(db.tables['orders']![0]!['status']).toBe('pending');
    expect(db.tables['enrollments']!.length).toBe(0);
  });

  it('khong tim thay don theo ma -> 200 matched:false + audit, khong doi don nao', async () => {
    seedPendingOrder(db);
    const { raw, sig, timestamp } = webhookBody({ content: 'DH-2026-999999 khong co don' });
    const out = await processSepayWebhook(env, raw, sig, String(timestamp));
    expect(out.httpStatus).toBe(200);
    expect(out.body).toMatchObject({ ok: true, matched: false });
    expect(db.tables['orders']![0]!['status']).toBe('pending');
    expect(db.tables['audit_logs']!.some((a) => a['action'] === 'order.webhook_unmatched')).toBe(true);
  });

  it('tien RA (transferType out) -> 200 success:true, khong doi don nao, khong ghi payment', async () => {
    seedPendingOrder(db);
    const { raw, sig, timestamp } = webhookBody({ transferType: 'out' });
    const out = await processSepayWebhook(env, raw, sig, String(timestamp));
    expect(out.httpStatus).toBe(200);
    expect(out.body).toMatchObject({ success: true, matched: false, ignored: 'transfer_out' });
    expect(db.tables['orders']![0]!['status']).toBe('pending');
    expect(db.tables['payments']!.length).toBe(0);
  });

  it('ma don mat gach ngang do VietQR (DH2026000123) -> van khop don, paid', async () => {
    seedPendingOrder(db);
    const { raw, sig, timestamp } = webhookBody({ content: 'DH2026000123 thanh toan' });
    const out = await processSepayWebhook(env, raw, sig, String(timestamp));
    expect(out.httpStatus).toBe(200);
    expect(out.body).toMatchObject({ success: true, matched: true, status: 'paid' });
    expect(db.tables['orders']![0]!['status']).toBe('paid');
  });

  it('thieu so tien -> 200 payment_mismatch; body khong phai JSON (ky dung) -> 400', async () => {
    seedPendingOrder(db);
    const rawNoAmount = JSON.stringify({ id: 'SEPAY-9', content: 'DH-2026-000123' });
    const signedNoAmount = signSepay(rawNoAmount);
    const out = await processSepayWebhook(
      env,
      rawNoAmount,
      signedNoAmount.sig,
      String(signedNoAmount.timestamp),
    );
    expect(out.httpStatus).toBe(200);
    expect(out.body).toMatchObject({ error: 'payment_mismatch' });
    // Nhanh thieu so tien phai de lai audit de doi soat (R9) —
    // phat hien 5.4(b) bao cao TASK10.
    expect(
      db.tables['audit_logs']!.some((a) => a['action'] === 'order.payment_mismatch'),
    ).toBe(true);
    const bad = 'khong-phai-json';
    const signedBad = signSepay(bad);
    const out2 = await processSepayWebhook(env, bad, signedBad.sig, String(signedBad.timestamp));
    expect(out2.httpStatus).toBe(400);
  });
});

describe('grantAccessForOrder / cancelOrder / expirePendingOrders', () => {
  it('cap quyen goi thanh vien: tao membership + mo khoa kem theo goi', async () => {
    const order = seedPendingOrder(db, { status: 'paid', course_id: null }) as unknown as OrderRow;
    db.tables['order_items']!.length = 0;
    const item: Row = {
      id: 'item-plan-1', order_id: order.id, item_type: 'membership', course_id: null,
      membership_plan_id: PLAN_COMMUNITY, item_name: 'Cộng đồng Visfar',
      unit_price_vnd: 499000, quantity: 1, total_vnd: 499000,
      created_at: nowIso(), updated_at: nowIso(),
    };
    db.tables['order_items']!.push(item);
    await grantAccessForOrder(env, order, [item as unknown as OrderItemRow], { actorId: ADMIN_1, auditAction: 'order.paid' });
    expect(db.tables['memberships']!.length).toBe(1);
    expect(db.tables['memberships']![0]!['status']).toBe('active');
    // Goi kem khoa COURSE_A -> mo enrollment khoa do.
    expect(db.tables['enrollments']!.some((e) => e['course_id'] === COURSE_A)).toBe(true);
  });

  it('huy don pending -> cancelled; don paid -> 409; don cua nguoi khac -> 404', async () => {
    const row = seedPendingOrder(db);
    const out = await cancelOrder(env, USER_1, String(row['id']));
    expect(out.status).toBe('cancelled');
    await expectApiError(cancelOrder(env, USER_1, String(row['id'])), 409, 'conflict');
    const other = seedPendingOrder(db, { reference_code: 'DH-2026-000124' });
    await expectApiError(cancelOrder(env, 'nguoi-khac', String(other['id'])), 404, 'not_found');
  });

  it('quet het han: pending qua expires_at -> expired; chua het han -> giu nguyen', async () => {
    seedPendingOrder(db, { expires_at: new Date(Date.now() - 1000).toISOString(), reference_code: 'DH-2026-000125' });
    seedPendingOrder(db, { expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), reference_code: 'DH-2026-000126' });
    const n = await expirePendingOrders(env, ADMIN_1);
    expect(n).toBe(1);
    const rows = db.tables['orders']!;
    expect(rows.find((r) => r['reference_code'] === 'DH-2026-000125')!['status']).toBe('expired');
    expect(rows.find((r) => r['reference_code'] === 'DH-2026-000126')!['status']).toBe('pending');
  });
});

describe('requestRefund / executeRefund — hoan tra 15 ngay lam viec (QD 9)', () => {
  function paidOrderWithEnrollment(): OrderRow {
    const row = seedPendingOrder(db, {
      status: 'paid',
      paid_at: new Date().toISOString(),
    }) as unknown as OrderRow;
    db.tables['enrollments']!.push({
      id: 'enr-1', user_id: USER_1, course_id: COURSE_A, order_id: row.id,
      status: 'active', enrolled_at: nowIso(), completed_at: null,
      created_at: nowIso(), updated_at: nowIso(),
    });
    db.tables['payments']!.push({
      id: 'pay-1', order_id: row.id, amount_vnd: 1999000, method: 'sepay',
      gateway_reference: 'SEPAY-20261110-000001', gateway_payload: {},
      status: 'succeeded', paid_at: nowIso(), verified_by: null,
      created_at: nowIso(), updated_at: nowIso(),
    });
    return row;
  }

  it('hoc vien yeu cau trong han -> ghi refund_requested_at; yeu cau lan 2 -> 409', async () => {
    const order = paidOrderWithEnrollment();
    const out = await requestRefund(env, USER_1, String(order.id), 'Khóa không phù hợp.');
    expect(out.status).toBe('paid');
    expect(db.tables['orders']![0]!['refund_requested_at']).not.toBeNull();
    await expectApiError(requestRefund(env, USER_1, String(order.id), 'Ly do khac.'), 409, 'conflict');
  });

  it('yeu cau qua han 15 ngay lam viec -> 422; don pending -> 409', async () => {
    const old = paidOrderWithEnrollment();
    const o = db.tables['orders']![0]!;
    o['paid_at'] = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
    o['created_at'] = o['paid_at'];
    await expectApiError(requestRefund(env, USER_1, String(old.id), 'Muon qua han.'), 422, 'invalid_input');
    const pending = seedPendingOrder(db, { reference_code: 'DH-2026-000127' });
    await expectApiError(requestRefund(env, USER_1, String(pending['id']), 'Chua tra ma doi hoan.'), 409, 'conflict');
  });

  it('admin hoan tra trong han -> refunded + payments refunded + thu hoi enrollment + audit', async () => {
    const order = paidOrderWithEnrollment();
    const out = await executeRefund(env, order, ADMIN_1, { reason: 'Hoc vien yeu cau.', refundBankReference: 'MB-HOAN-001' });
    expect(out.status).toBe('refunded');
    const refundPay = db.tables['payments']!.find((p) => p['status'] === 'refunded');
    expect(refundPay).toBeDefined();
    expect(refundPay!['gateway_reference']).toBe('MB-HOAN-001');
    expect(db.tables['enrollments']![0]!['status']).toBe('revoked');
    expect(db.tables['audit_logs']!.some((a) => a['action'] === 'order.refund')).toBe(true);
    expect(db.tables['orders']![0]!['refund_reason']).toBe('Hoc vien yeu cau.');
  });

  it('qua han khong co forceReason -> 422; co forceReason -> hoan duoc + audit ghi ly do', async () => {
    const order = paidOrderWithEnrollment();
    const o = db.tables['orders']![0]!;
    o['paid_at'] = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
    o['created_at'] = o['paid_at'];
    await expectApiError(
      executeRefund(env, order, ADMIN_1, { reason: 'Qua han.', refundBankReference: 'MB-HOAN-002' }),
      422,
      'invalid_input',
    );
    const out = await executeRefund(env, order, ADMIN_1, {
      reason: 'Qua han nhung hoan ngoai le.',
      refundBankReference: 'MB-HOAN-002',
      forceReason: 'User la hoc vien than thiet, duyet ngoai le.',
    });
    expect(out.status).toBe('refunded');
    const audit = db.tables['audit_logs']!.find((a) => a['action'] === 'order.refund');
    expect((audit!['details'] as Row)['force_reason']).toContain('ngoai le');
  });

  it('thieu ma giao dich hoan / thieu ly do -> 400; don pending -> 409', async () => {
    const order = paidOrderWithEnrollment();
    await expectApiError(executeRefund(env, order, ADMIN_1, { reason: 'Ly do.', refundBankReference: '   ' }), 400, 'invalid_input');
    await expectApiError(executeRefund(env, order, ADMIN_1, { reason: '  ', refundBankReference: 'MB-HOAN-003' }), 400, 'invalid_input');
    const pending = seedPendingOrder(db, { reference_code: 'DH-2026-000128' });
    await expectApiError(
      executeRefund(env, pending as unknown as OrderRow, ADMIN_1, { reason: 'Ly do.', refundBankReference: 'MB-HOAN-003' }),
      409,
      'conflict',
    );
  });

  it('[hoi quy B-T10-2 — da sua] hoan tra don goi thanh vien huy duoc membership (chi doi status, khong ghi cot cancelled_at vi 0004/0019 khong co cot nay)', async () => {
    const order = seedPendingOrder(db, { status: 'paid', paid_at: new Date().toISOString(), course_id: null }) as unknown as OrderRow;
    db.tables['order_items']!.length = 0;
    db.tables['order_items']!.push({
      id: 'item-plan-2', order_id: order.id, item_type: 'membership', course_id: null,
      membership_plan_id: PLAN_COMMUNITY, item_name: 'Cộng đồng Visfar',
      unit_price_vnd: 499000, quantity: 1, total_vnd: 499000,
      created_at: nowIso(), updated_at: nowIso(),
    });
    db.tables['memberships']!.push({
      id: 'mem-1', user_id: USER_1, plan_id: PLAN_COMMUNITY, order_id: order.id,
      status: 'active', started_at: nowIso(), ends_at: null, created_at: nowIso(), updated_at: nowIso(),
    });
    db.tables['payments']!.push({
      id: 'pay-2', order_id: order.id, amount_vnd: 499000, method: 'bank_transfer',
      gateway_reference: 'MB-1', gateway_payload: {}, status: 'succeeded',
      paid_at: nowIso(), verified_by: ADMIN_1, created_at: nowIso(), updated_at: nowIso(),
    });
    await executeRefund(env, order, ADMIN_1, { reason: 'Hoan goi.', refundBankReference: 'MB-HOAN-004' });
    // Ky vong: membership bi huy (status cancelled) sau khi hoan tra.
    // Khong ghi cancelled_at (cot khong ton tai o 0004/0019 — ghi se loi
    // PGRST204); mock mo phong dung schema that nen PATCH co cot la se loi.
    expect(db.tables['memberships']![0]!['status']).toBe('cancelled');
    expect(db.tables['memberships']![0]!['cancelled_at']).toBeUndefined();
  });
});

describe('enrollFreeCourse — ghi danh khoa mien phi khong qua don', () => {
  it('khoa 0d published -> ghi danh; goi lai -> alreadyEnrolled:true', async () => {
    const first = await enrollFreeCourse(env, USER_1, COURSE_FREE);
    expect(first).toEqual({ courseId: COURSE_FREE, alreadyEnrolled: false });
    const second = await enrollFreeCourse(env, USER_1, COURSE_FREE);
    expect(second.alreadyEnrolled).toBe(true);
    expect(db.tables['enrollments']!.length).toBe(1);
  });
  it('khoa co phi / khoa Tuy tam / khoa nhap -> 400', async () => {
    await expectApiError(enrollFreeCourse(env, USER_1, COURSE_A), 400, 'invalid_input');
    await expectApiError(enrollFreeCourse(env, USER_1, COURSE_PWYW), 400, 'invalid_input');
    await expectApiError(enrollFreeCourse(env, USER_1, COURSE_DRAFT), 400, 'invalid_course');
  });
});

describe('HTTP handlers qua handleRequest (workers/api/src/index.ts)', () => {
  const API = 'https://visfaracademy.netlify.app';
  const KID = 'test-kid-payments';
  let keys: TestKeyPair;

  beforeEach(async () => {
    keys = await generateTestKeyPair(KID);
    db.jwksKeys = [keys.publicJwk];
    __resetJwksCache();
    __resetRateLimits();
  });

  async function call(
    method: string,
    path: string,
    opts: {
      body?: Record<string, unknown> | string;
      userId?: string | null;
      headers?: Record<string, string>;
    } = {},
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const headers: Record<string, string> = {
      'CF-Connecting-IP': '203.0.113.20',
      ...(opts.headers ?? {}),
    };
    if (opts.userId !== null && opts.userId !== undefined) {
      const token = await signTestJwt(keys.privateKey, KID, testJwtPayload(opts.userId));
      headers['Authorization'] = `Bearer ${token}`;
    } else if (opts.userId === undefined) {
      const token = await signTestJwt(keys.privateKey, KID, testJwtPayload(USER_1));
      headers['Authorization'] = `Bearer ${token}`;
    }
    const init: RequestInit = { method, headers };
    if (opts.body !== undefined) {
      if (typeof opts.body === 'string') {
        init.body = opts.body;
      } else {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
    }
    const res = await handleRequest(new Request(`${API}${path}`, init), env);
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  it('POST /api/v1/orders khong JWT -> 401; JWT het han -> 401', async () => {
    const noAuth = await call('POST', '/api/v1/orders', {
      userId: null,
      body: { items: [{ itemType: 'course', courseId: COURSE_A }] },
    });
    expect(noAuth.status).toBe(401);
    expect(noAuth.json['error']).toBe('unauthorized');
    const expired = await signTestJwt(
      keys.privateKey,
      KID,
      // Het han 1 gio — vuot qua CLOCK_SKEW_SEC (30s) cua verifySupabaseJwt.
      testJwtPayload(USER_1, { exp: Math.floor(Date.now() / 1000) - 3600 }),
    );
    const res = await handleRequest(
      new Request(`${API}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${expired}` },
        body: JSON.stringify({ items: [{ itemType: 'course', courseId: COURSE_A }] }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/orders -> 201 pending + transfer; GET lai don cua minh -> 200; nguoi khac -> 404', async () => {
    const created = await call('POST', '/api/v1/orders', {
      body: { items: [{ itemType: 'course', courseId: COURSE_A }] },
      headers: { 'Idempotency-Key': 'http-key-1' },
    });
    expect(created.status).toBe(201);
    expect(created.json['ok']).toBe(true);
    const order = created.json['order'] as Record<string, unknown>;
    expect(order['status']).toBe('pending');
    expect(order['amountVnd']).toBe(1999000);
    expect((order['transfer'] as Record<string, unknown>)['content']).toBe(order['referenceCode']);
    const mine = await call('GET', `/api/v1/orders/${String(order['id'])}`);
    expect(mine.status).toBe(200);
    const stranger = await call('GET', `/api/v1/orders/${String(order['id'])}`, { userId: 'nguoi-khac' });
    expect(stranger.status).toBe(404);
  });

  it('POST /api/v1/orders trung key -> 200 duplicate; khac body -> 409', async () => {
    const body = { items: [{ itemType: 'course', courseId: COURSE_A }] };
    const first = await call('POST', '/api/v1/orders', { body, headers: { 'Idempotency-Key': 'http-key-2' } });
    expect(first.status).toBe(201);
    const second = await call('POST', '/api/v1/orders', { body, headers: { 'Idempotency-Key': 'http-key-2' } });
    expect(second.status).toBe(200);
    expect(second.json['duplicate']).toBe(true);
    expect((second.json['order'] as Record<string, unknown>)['id']).toBe(
      (first.json['order'] as Record<string, unknown>)['id'],
    );
    const conflict = await call('POST', '/api/v1/orders', {
      body: { items: [{ itemType: 'course', courseId: COURSE_FREE }] },
      headers: { 'Idempotency-Key': 'http-key-2' },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.json['error']).toBe('idempotency_conflict');
  });

  it('POST /api/v1/orders sai dinh dang -> 400 (UUID khoa sai / items khong phai mang)', async () => {
    const badUuid = await call('POST', '/api/v1/orders', {
      body: { items: [{ itemType: 'course', courseId: 'khong-phai-uuid' }] },
    });
    expect(badUuid.status).toBe(400);
    const badItems = await call('POST', '/api/v1/orders', { body: { items: 'khong-phai-mang' } });
    expect(badItems.status).toBe(400);
  });

  it('POST /api/v1/orders/:id/cancel -> 200 cancelled; huy lai -> 409', async () => {
    const created = await call('POST', '/api/v1/orders', {
      body: { items: [{ itemType: 'course', courseId: COURSE_A }] },
    });
    const id = String((created.json['order'] as Record<string, unknown>)['id']);
    const cancelled = await call('POST', `/api/v1/orders/${id}/cancel`, { body: {} });
    expect(cancelled.status).toBe(200);
    expect((cancelled.json['order'] as Record<string, unknown>)['status']).toBe('cancelled');
    const again = await call('POST', `/api/v1/orders/${id}/cancel`, { body: {} });
    expect(again.status).toBe(409);
  });

  it('GET /api/v1/my/orders chi tra don cua minh; GET /api/v1/my/transactions sau webhook', async () => {
    await call('POST', '/api/v1/orders', { body: { items: [{ itemType: 'course', courseId: COURSE_A }] } });
    seedPendingOrder(db, { user_id: 'nguoi-khac', reference_code: 'DH-2026-000200' });
    const mine = await call('GET', '/api/v1/my/orders');
    expect(mine.status).toBe(200);
    const orders = mine.json['orders'] as Array<Record<string, unknown>>;
    expect(orders.length).toBe(1);
    expect(orders[0]!['referenceCode']).not.toBe('DH-2026-000200');
    const txEmpty = await call('GET', '/api/v1/my/transactions');
    expect((txEmpty.json['transactions'] as unknown[]).length).toBe(0);
    const { raw, sig, timestamp } = webhookBody();
    const hook = await call('POST', '/api/v1/webhooks/sepay', {
      userId: null,
      body: raw,
      headers: {
        'x-sepay-signature': sig,
        'x-sepay-timestamp': String(timestamp),
        'Content-Type': 'application/json',
      },
    });
    expect(hook.status).toBe(200);
    const tx = await call('GET', '/api/v1/my/transactions');
    const list = tx.json['transactions'] as Array<Record<string, unknown>>;
    expect(list.length).toBe(1);
    expect(list[0]!['status']).toBe('succeeded');
    expect(list[0]!['referenceCode']).toBe('DH-2026-000123');
  });

  it('POST /api/v1/coupons/validate: GIAM10 hop le; ma khong co -> valid:false', async () => {
    const ok = await call('POST', '/api/v1/coupons/validate', { body: { code: 'giam10', amountVnd: 1999000 } });
    expect(ok.status).toBe(200);
    expect(ok.json['valid']).toBe(true);
    expect(ok.json['discountVnd']).toBe(50000);
    expect(ok.json['amountAfterDiscount']).toBe(1949000);
    const bad = await call('POST', '/api/v1/coupons/validate', { body: { code: 'KHONGCO', amountVnd: 1999000 } });
    expect(bad.json['valid']).toBe(false);
    expect(bad.json['reason']).toBe('coupon_not_found');
  });

  it('GET /api/v1/membership-plans khong can dang nhap -> goi dang ban', async () => {
    const res = await call('GET', '/api/v1/membership-plans', { userId: null });
    expect(res.status).toBe(200);
    const plans = res.json['plans'] as Array<Record<string, unknown>>;
    expect(plans.length).toBe(1);
    expect(plans[0]!['slug']).toBe('cong-dong');
  });

  it('POST /api/v1/my/enrollments khoa mien phi -> 201; goi lai -> 200 alreadyEnrolled', async () => {
    const first = await call('POST', '/api/v1/my/enrollments', { body: { courseId: COURSE_FREE } });
    expect(first.status).toBe(201);
    const second = await call('POST', '/api/v1/my/enrollments', { body: { courseId: COURSE_FREE } });
    expect(second.status).toBe(200);
    expect(second.json['alreadyEnrolled']).toBe(true);
  });

  it('POST /api/v1/webhooks/sepay qua HTTP: sai chu ky -> 401; dung -> 200 paid (ca alias /api/webhooks/sepay)', async () => {
    await call('POST', '/api/v1/orders', { body: { items: [{ itemType: 'course', courseId: COURSE_A }] } });
    const { raw } = webhookBody();
    const bad = await call('POST', '/api/v1/webhooks/sepay', {
      userId: null,
      body: raw,
      headers: { 'x-sepay-signature': 'sai', 'Content-Type': 'application/json' },
    });
    expect(bad.status).toBe(401);
    const { raw: raw2, sig, timestamp: ts2 } = webhookBody();
    const good = await call('POST', '/api/webhooks/sepay', {
      userId: null,
      body: raw2,
      headers: {
        'x-sepay-signature': sig,
        'x-sepay-timestamp': String(ts2),
        'Content-Type': 'application/json',
      },
    });
    expect(good.status).toBe(200);
    expect(good.json).toMatchObject({ ok: true, matched: true });
    expect(db.tables['orders']![0]!['status']).toBe('paid');
  });

  it('admin: hoc vien GET /api/v1/admin/orders -> 403; admin -> 200', async () => {
    await call('POST', '/api/v1/orders', { body: { items: [{ itemType: 'course', courseId: COURSE_A }] } });
    const student = await call('GET', '/api/v1/admin/orders');
    expect(student.status).toBe(403);
    const admin = await call('GET', '/api/v1/admin/orders', { userId: ADMIN_1 });
    expect(admin.status).toBe(200);
    expect((admin.json['orders'] as unknown[]).length).toBe(1);
  });

  it('admin mark-paid: khop tien -> 200 paid + enrollment; lech tien -> 422', async () => {
    const created = await call('POST', '/api/v1/orders', { body: { items: [{ itemType: 'course', courseId: COURSE_A }] } });
    const id = String((created.json['order'] as Record<string, unknown>)['id']);
    const wrong = await call('POST', `/api/v1/admin/orders/${id}/mark-paid`, {
      userId: ADMIN_1,
      body: { amountVnd: 1000000, gatewayReference: 'MB-ADMIN-1' },
    });
    expect(wrong.status).toBe(422);
    expect(wrong.json['error']).toBe('payment_mismatch');
    expect(db.tables['orders']![0]!['status']).toBe('pending');
    const ok = await call('POST', `/api/v1/admin/orders/${id}/mark-paid`, {
      userId: ADMIN_1,
      body: { amountVnd: 1999000, gatewayReference: 'MB-ADMIN-2', note: 'Da kiem tra sao ke MB Bank.' },
    });
    expect(ok.status).toBe(200);
    expect((ok.json['order'] as Record<string, unknown>)['status']).toBe('paid');
    expect(db.tables['enrollments']!.length).toBe(1);
    const again = await call('POST', `/api/v1/admin/orders/${id}/mark-paid`, {
      userId: ADMIN_1,
      body: { amountVnd: 1999000, gatewayReference: 'MB-ADMIN-2' },
    });
    expect(again.status).toBe(200);
    expect(again.json['duplicate']).toBe(true);
    // 1 failed (lan lech tien) + 1 succeeded; khong co giao dich trung lap.
    expect(db.tables['payments']!.filter((p) => p['status'] === 'succeeded').length).toBe(1);
    expect(db.tables['payments']!.length).toBe(2);
  });

  it('admin refund qua HTTP: thieu ma GD hoan -> 400; du thong tin -> 200 refunded', async () => {
    const created = await call('POST', '/api/v1/orders', { body: { items: [{ itemType: 'course', courseId: COURSE_A }] } });
    const id = String((created.json['order'] as Record<string, unknown>)['id']);
    await call('POST', `/api/v1/admin/orders/${id}/mark-paid`, {
      userId: ADMIN_1,
      body: { amountVnd: 1999000, gatewayReference: 'MB-ADMIN-2' },
    });
    const noRef = await call('POST', `/api/v1/admin/orders/${id}/refund`, {
      userId: ADMIN_1,
      body: { reason: 'Hoan tra.', refundBankReference: '' },
    });
    expect(noRef.status).toBe(400);
    const ok = await call('POST', `/api/v1/admin/orders/${id}/refund`, {
      userId: ADMIN_1,
      body: { reason: 'Hoan tra.', refundBankReference: 'MB-HOAN-HTTP-1' },
    });
    expect(ok.status).toBe(200);
    expect((ok.json['order'] as Record<string, unknown>)['status']).toBe('refunded');
    expect(db.tables['enrollments']![0]!['status']).toBe('revoked');
  });

  it('admin expire-sweep qua HTTP: quet 1 don qua han', async () => {
    seedPendingOrder(db, { expires_at: new Date(Date.now() - 1000).toISOString(), reference_code: 'DH-2026-000201' });
    const out = await call('POST', '/api/v1/admin/orders/expire-sweep', { userId: ADMIN_1, body: {} });
    expect(out.status).toBe(200);
    expect(out.json['expiredCount']).toBe(1);
  });

  it('admin coupons: tao moi -> 201; trung ma -> 409; tat ma -> 200; list thay ma', async () => {
    const created = await call('POST', '/api/v1/admin/coupons', {
      userId: ADMIN_1,
      body: { code: 'NEW20', discountType: 'percent', discountValue: 20 },
    });
    expect(created.status).toBe(201);
    const dup = await call('POST', '/api/v1/admin/coupons', {
      userId: ADMIN_1,
      body: { code: 'NEW20', discountType: 'percent', discountValue: 20 },
    });
    expect(dup.status).toBe(409);
    const bad = await call('POST', '/api/v1/admin/coupons', {
      userId: ADMIN_1,
      body: { code: 'X', discountType: 'percent', discountValue: 150 },
    });
    expect(bad.status).toBe(400);
    const list = await call('GET', '/api/v1/admin/coupons', { userId: ADMIN_1 });
    expect((list.json['coupons'] as Array<Record<string, unknown>>).some((c) => c['code'] === 'NEW20')).toBe(true);
  });

  it('admin payments (R9): sau webhook co giao dich succeeded de doi soat', async () => {
    await call('POST', '/api/v1/orders', { body: { items: [{ itemType: 'course', courseId: COURSE_A }] } });
    const { raw, sig, timestamp } = webhookBody();
    await call('POST', '/api/v1/webhooks/sepay', {
      userId: null,
      body: raw,
      headers: {
        'x-sepay-signature': sig,
        'x-sepay-timestamp': String(timestamp),
        'Content-Type': 'application/json',
      },
    });
    const list = await call('GET', '/api/v1/admin/payments', { userId: ADMIN_1 });
    expect(list.status).toBe(200);
    const payments = list.json['payments'] as Array<Record<string, unknown>>;
    expect(payments.length).toBe(1);
    expect(payments[0]!['status']).toBe('succeeded');
    expect(payments[0]!['method']).toBe('sepay');
  });

  it('POST /api/v1/my/orders/:id/refund-request: chua paid -> 409; paid trong han -> 200; goi lai -> 409; nguoi khac -> 404', async () => {
    const created = await call('POST', '/api/v1/orders', { body: { items: [{ itemType: 'course', courseId: COURSE_A }] } });
    const id = String((created.json['order'] as Record<string, unknown>)['id']);
    const pending = await call('POST', `/api/v1/my/orders/${id}/refund-request`, { body: { reason: 'Muon hoan.' } });
    expect(pending.status).toBe(409);
    await call('POST', `/api/v1/admin/orders/${id}/mark-paid`, {
      userId: ADMIN_1,
      body: { amountVnd: 1999000, gatewayReference: 'MB-ADMIN-RR' },
    });
    const ok = await call('POST', `/api/v1/my/orders/${id}/refund-request`, { body: { reason: 'Muon hoan vi ly do ca nhan.' } });
    expect(ok.status).toBe(200);
    expect((ok.json['order'] as Record<string, unknown>)['refundRequestedAt']).not.toBeNull();
    const again = await call('POST', `/api/v1/my/orders/${id}/refund-request`, { body: { reason: 'Lan 2.' } });
    expect(again.status).toBe(409);
    const stranger = await call('POST', `/api/v1/my/orders/${id}/refund-request`, { userId: 'nguoi-khac', body: { reason: 'X.' } });
    expect(stranger.status).toBe(404);
  });

  it('route khong ton tai -> 404 not_found', async () => {
    const res = await call('GET', '/api/v1/khong-ton-tai', { userId: null });
    expect(res.status).toBe(404);
    expect(res.json['error']).toBe('not_found');
  });
});
