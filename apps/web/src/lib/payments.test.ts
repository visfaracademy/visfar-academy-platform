// Test Payment & Commerce — TASK 10 (phan chay duoc NGAY, khong can code moi).
//
// Kiem tra TINH (khong can DB that, khong can code Task 10):
//   - Schema da co tu Task 01/03 (0001/0004) co du rang buoc chong trung
//     thanh toan, kiem tra so tien, trang thai don — neu thieu, Task 10
//     khong the dung nhu thiet ke (API_ARCHITECTURE.md §10.1, §4).
//   - Tai su dung san co: api-client da co ma loi payment_mismatch /
//     idempotency_conflict + postJson(idempotencyKey) + newIdempotencyKey.
//   - GAP CON LAI (test van PASS nhung ghi nhan khoang trong): cac thu
//     Task 10 can ma chua co — ten bien SePay trong .dev.vars.example,
//     handler/route orders + webhook, tai lieu SEPAY_INTEGRATION.md,
//     test cho refundOrder(). Khi builder giao code, cac test GAP nay
//     phai duoc cap nhat thanh khang dinh DUONG (co mat).
//
// Phan logic chay that (chu ky webhook, parse payload, trich ma don)
// nam o workers/api/test/sepay.test.ts (test workers/api/src/sepay.ts
// that). Phan chua co implementation (kiem tra so tien, idempotency,
// chong trung payment, cap quyen, han hoan tra) nam o
// workers/api/test/sepay-contract.test.ts — CONTRACT TEST, doi code.
import { describe, expect, it } from 'vitest';
import {
  computeCouponDiscount,
  computeOrderTotals,
  paymentMethodLabelVi,
  transactionStatusLabelVi,
  type CouponForPricing,
} from './payments';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const DOCS = join(ROOT, 'docs');

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), 'utf8');
}

describe('TASK 10 — schema chong trung thanh toan (0001)', () => {
  const sql = readMigration('0001_init_schema.sql');

  it('payments co UNIQUE (method, gateway_reference) — webhook gui lai khong tao trung', () => {
    expect(sql).toMatch(/unique\s*\(\s*method\s*,\s*gateway_reference\s*\)/i);
  });

  it('0001 ghi ro: gateway_reference NULL khong tinh la trung (Postgres coi NULL khac nhau)', () => {
    expect(sql).toMatch(/gateway_reference NULL/i);
  });

  it('orders.reference_code UNIQUE — ma don lam noi dung chuyen khoan', () => {
    expect(sql).toMatch(/reference_code text not null unique/i);
  });

  it('enrollments UNIQUE (user_id, course_id) — 1 don paid khong cap 2 ghi danh', () => {
    expect(sql).toMatch(/unique\s*\(\s*user_id\s*,\s*course_id\s*\)/i);
  });
});

describe('TASK 10 — rang buoc so tien + trang thai (0001)', () => {
  const sql = readMigration('0001_init_schema.sql');

  it("orders.amount_vnd CHECK >= 0 — giao dich 0d duoc phep (Task 03 #11, Tuy tam)", () => {
    expect(sql).toMatch(/amount_vnd integer not null default 0 check \(amount_vnd >= 0\)/i);
  });

  it('payments.amount_vnd CHECK > 0 — khong ghi payment 0d/am', () => {
    expect(sql).toMatch(/amount_vnd integer not null check \(amount_vnd > 0\)/i);
  });

  it("orders.status chi nhan pending/paid/cancelled/refunded/expired", () => {
    expect(sql).toMatch(
      /check \(status in \('pending', 'paid', 'cancelled', 'refunded', 'expired'\)\)/i,
    );
  });

  it("payments.status chi nhan pending/succeeded/failed/refunded", () => {
    expect(sql).toMatch(/check \(status in \('pending', 'succeeded', 'failed', 'refunded'\)\)/i);
  });

  it("orders.payment_method chi nhan bank_transfer/sepay/stripe/cash/free", () => {
    expect(sql).toMatch(
      /check \(payment_method in \('bank_transfer', 'sepay', 'stripe', 'cash', 'free'\)\)/i,
    );
  });
});

describe('TASK 10 — RLS: client khong ghi truc tiep orders/payments (0001 + 0009)', () => {
  const sql0001 = readMigration('0001_init_schema.sql');
  const sql0009 = readMigration('0009_security_fixes.sql');

  it('RLS bat tren ca orders va payments', () => {
    expect(sql0001).toContain('alter table public.orders enable row level security;');
    expect(sql0001).toContain('alter table public.payments enable row level security;');
  });

  it('0001: orders chi co policy SELECT cua chinh minh; payments chi admin doc', () => {
    expect(sql0001).toContain('create policy "orders_select_own" on public.orders');
    expect(sql0001).toContain('create policy "payments_admin_read" on public.payments');
    expect(sql0001.toLowerCase()).not.toMatch(
      /create policy[^;]*on public\.orders[^;]*for (insert|update|delete)/s,
    );
    expect(sql0001.toLowerCase()).not.toMatch(
      /create policy[^;]*on public\.payments[^;]*for (insert|update|delete)/s,
    );
  });

  it('0009 khong mo them duong ghi client cho orders/payments', () => {
    const lower = sql0009.toLowerCase();
    for (const t of ['orders', 'payments']) {
      expect(lower).not.toMatch(
        new RegExp(`create policy[^;]*on public\\.${t}[^;]*for (insert|update|delete)`, 's'),
      );
    }
  });
});

describe('TASK 10 — cau hinh da chot trong tai lieu (DECISIONS / DATA_DICTIONARY)', () => {
  const dict = readFileSync(join(DOCS, 'database', 'DATA_DICTIONARY.md'), 'utf8');

  it('hoan tra 15 ngay lam viec, khieu nai phan hoi 3 ngay (QD 9)', () => {
    expect(dict).toContain('refund.working_days');
    expect(dict).toContain('complaint.response_days');
    expect(dict).toMatch(/refund\.working_days.*15/s);
    expect(dict).toMatch(/complaint\.response_days.*3/s);
  });

  it('nha cung cap SePay, ngan hang MB Bank, KHONG luu so tai khoan (QD 15)', () => {
    expect(dict).toContain('payment.provider');
    expect(dict).toMatch(/payment\.provider.*"sepay"/s);
    expect(dict).toContain('payment.bank_name');
    expect(dict).toMatch(/payment\.bank_name.*"MB Bank"/s);
    expect(dict).toMatch(/không lưu số tài khoản/i);
  });
});

describe('TASK 10 — tai su dung san co o api-client', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'api-client.ts'),
    'utf8',
  );

  it('da co ma loi payment_mismatch (422) va idempotency_conflict (409)', () => {
    expect(src).toContain("'payment_mismatch'");
    expect(src).toContain("'idempotency_conflict'");
  });

  it('postJson ho tro Idempotency-Key + co ham sinh key moi', () => {
    expect(src).toContain('idempotencyKey?: string');
    expect(src).toContain('export function newIdempotencyKey');
  });
});

describe('TASK 10 — migration 0019_commerce_payment (da giao 10/11/2026)', () => {
  const sql = readMigration('0019_commerce_payment.sql');

  it('seed system_settings: du 9 key, dung gia tri da chot, khong luu so tai khoan', () => {
    expect(sql).toContain('insert into public.system_settings');
    for (const key of [
      'completion.video_threshold_percent',
      'order.expiry_hours',
      'order.reminder_hours',
      'learning.inactivity_reminder_days',
      'refund.working_days',
      'complaint.response_days',
      'event.reminder_hours_before',
      'payment.provider',
      'payment.bank_name',
    ]) {
      expect(sql).toContain(`'${key}'`);
    }
    expect(sql).toMatch(/'refund\.working_days', '15'::jsonb/);
    expect(sql).toMatch(/'complaint\.response_days', '3'::jsonb/);
    expect(sql).toMatch(/'payment\.provider', '"sepay"'::jsonb/);
    expect(sql).toMatch(/'payment\.bank_name', '"MB Bank"'::jsonb/);
    expect(sql).not.toMatch(/account_number/i);
    expect(sql).toMatch(/on conflict \(key\) do nothing/i);
  });

  it('orders.idempotency_body_hash: cot luu hash body de so sanh trung key (khong co cot nay thi 409 khong bao gio xay ra)', () => {
    expect(sql).toContain('add column if not exists idempotency_body_hash text;');
  });

  it('orders.idempotency_key + UNIQUE rieng phan (NULL duoc phep nhieu dong)', () => {
    expect(sql).toContain('idempotency_key text');
    expect(sql).toMatch(
      /create unique index if not exists idx_orders_idempotency_key\s+on public\.orders \(idempotency_key\) where idempotency_key is not null;/i,
    );
  });

  it("ma don tu dong DH-YYYY-NNNNNN: sequence + generate_order_reference() lam DEFAULT", () => {
    expect(sql).toContain('create sequence if not exists public.order_reference_seq');
    expect(sql).toContain('create or replace function public.generate_order_reference()');
    expect(sql).toContain("'DH-'");
    expect(sql).toMatch(
      /alter table public\.orders\s+alter column reference_code set default public\.generate_order_reference\(\);/i,
    );
  });

  it('orders.user_id: nullable + FK SET NULL (Task 03 QD 9 — vo hieu hoa thay vi xoa)', () => {
    expect(sql).toMatch(/alter table public\.orders alter column user_id drop not null;/i);
    expect(sql).toMatch(
      /foreign key \(user_id\) references public\.profiles \(id\) on delete set null/i,
    );
  });

  it('order_items: CHECK tong = don gia * so luong + CHECK moi dong chi 1 loai hang', () => {
    expect(sql).toContain('order_items_total_check');
    expect(sql).toMatch(/check \(total_vnd = unit_price_vnd \* quantity\)/i);
    expect(sql).toContain('order_items_single_item_type_check');
    expect(sql).toMatch(/item_type in \('course', 'membership'\)/i);
  });

  it('coupons: percent <= 100; memberships: them pending + expires_at GENERATED', () => {
    expect(sql).toContain('coupons_percent_value_check');
    expect(sql).toMatch(/discount_value <= 100/);
    expect(sql).toMatch(/check \(status in \('active', 'expired', 'cancelled', 'pending'\)\)/i);
    expect(sql).toMatch(/expires_at timestamptz generated always as \(ends_at\) stored/i);
  });

  it('0019 KHONG them cot cancelled_at cho memberships; payments.ts cung khong ghi cot nay (hoi quy B-T10-2 — da sua bang cach chi doi status)', () => {
    // 0004 quen cot cancelled_at (thiet ke Task 03 §3.23 co); 0019 khong
    // bo sung. executeRefund chi PATCH { status: 'cancelled' } — ghi
    // cancelled_at se loi PGRST204. Hai phia phai dong bo: neu sau nay
    // them cot, ca 0019-moi va payments.ts deu phai doi cung luc.
    expect(sql).not.toContain('cancelled_at');
    const paymentsSrc = readFileSync(
      join(ROOT, 'workers', 'api', 'src', 'payments.ts'),
      'utf8',
    );
    expect(paymentsSrc).toContain('KHONG co cot');
    expect(paymentsSrc).toContain('cancelled_at; ghi cot do se loi PGRST204');
  });

  it('courses.is_pay_what_you_want: mac dinh false, chua bat khoa nao', () => {
    expect(sql).toMatch(
      /add column if not exists is_pay_what_you_want boolean not null default false/i,
    );
  });

  it('RLS 0019: admin INSERT payments (verified_by = chinh admin) + admin UPDATE orders', () => {
    expect(sql).toContain('create policy "payments_insert_admin" on public.payments');
    expect(sql).toMatch(/verified_by = auth\.uid\(\)/);
    expect(sql).toContain('create policy "orders_update_admin" on public.orders');
  });

  it('payments: index doi soat (method, gateway_reference) — UNIQUE da co tu 0001', () => {
    expect(sql).toMatch(
      /create index if not exists idx_payments_gateway\s+on public\.payments \(method, gateway_reference\);/i,
    );
  });

  it('0019 khong sua file cu: chi ALTER/ADD tren bang da co, khong DROP bang', () => {
    expect(sql.toLowerCase()).not.toMatch(/drop table/i);
  });
});

describe('TASK 10 — GAP CON LAI (test PASS = ghi nhan, can cap nhat khi code ve)', () => {
  it('G-T10-2b: Env + .dev.vars.example DA CO ten bien SEPAY (chi ten, gia tri redacted) — ten API token doi theo SEPAY_INTEGRATION.md §8', () => {
    const env = readFileSync(join(ROOT, 'workers', 'api', 'src', 'env.ts'), 'utf8');
    expect(env).toContain('SEPAY_WEBHOOK_SECRET');
    // Ten cu SEPAY_API_KEY da doi thanh SEPAY_API_TOKEN (10/11/2026)
    // theo tai lieu chinh thuc SePay (SEPAY_INTEGRATION.md §8).
    expect(env).toContain('SEPAY_API_TOKEN');
    expect(env).not.toContain('SEPAY_API_KEY');
    expect(env).toContain('SEPAY_BANK_ACCOUNT_ID');
    expect(env).toContain('SEPAY_MERCHANT_ID');
    const example = readFileSync(
      join(ROOT, 'workers', 'api', '.dev.vars.example'),
      'utf8',
    );
    expect(example).toContain('SEPAY_WEBHOOK_SECRET');
    expect(example).toContain('SEPAY_API_TOKEN');
    expect(example).not.toContain('SEPAY_API_KEY');
    // Chi ten bien + placeholder redacted, khong gia tri that.
    expect(example).toMatch(/SEPAY_WEBHOOK_SECRET=<redacted>/);
    expect(example).toMatch(/SEPAY_API_TOKEN=<redacted>/);
    // Secret that chi set bang `wrangler secret put`.
  });

  it('G-T10-3b: handler orders/webhook DA CO o Workers (payments.ts, Task 10) — web-side: lib DA CO, trang dang giao dan (3/6 luc viet)', () => {
    const handlers = readdirSync(join(ROOT, 'workers', 'api', 'src', 'handlers')).sort();
    // Them appointments.ts + referrals.ts (Task 12, 11/11/2026): handler
    // lich hen + vi/tiep thi lien ket — da co that, khong phai cho doi.
    // Them ai-mentor.ts (Prompt 12, agent song song, GĐ2 11/11/2026).
    expect(handlers).toEqual([
      'ai-mentor.ts',
      'appointments.ts',
      'course-completion.test.ts',
      'course-completion.ts',
      'health.ts',
      'leads.ts',
      'payments-admin.ts',
      'payments.ts',
      'progress.ts',
      'referrals.ts',
    ]);
    const index = readFileSync(join(ROOT, 'workers', 'api', 'src', 'index.ts'), 'utf8');
    expect(index).toContain('/api/v1/webhooks/sepay');
    expect(index.toLowerCase()).toContain('sepay');
    // Web-side lib DA GIAO (Task 10): client + ham tinh tien.
    const libPayments = readFileSync(
      join(ROOT, 'apps', 'web', 'src', 'lib', 'payments.ts'),
      'utf8',
    );
    expect(libPayments).toContain('export async function createOrder');
    expect(libPayments).toContain('export async function fetchOrder');
    expect(libPayments).toContain('export async function fetchMyTransactions');
    expect(libPayments).toContain('export async function refundOrder');
    expect(libPayments).toContain('export async function markOrderPaid');
    expect(libPayments).toContain('export function computeCouponDiscount');
    expect(libPayments).toContain('export function computeOrderTotals');
    // Trang (Task 10 dang giao dan — KHONG assert tung trang o day vi
    // trang ve lien tuc lam test doi xanh/do vo ich; trang thai luc
    // viet test nay (10/11/2026): DA CO 3/6 — thanh-toan/[orderId],
    // hoc-vien/giao-dich, goi-thanh-vien; CHUA CO 3/6 — admin/don-hang,
    // admin/ma-giam-gia, admin/goi-thanh-vien. Task 10 chot khi du 6.
    // Luu y: hoc-vien/don-hang/page.tsx DA CO tu truoc nhung ten khac
    // voi hoc-vien/giao-dich/page.tsx — can Task 10 chot ten.
    // Khong mo Next API route — GHI CHU KIEN TRUC (Task 10): ghi
    // orders/payments CHI qua Workers API. RLS khong co policy INSERT
    // client cho orders (chi SELECT cua minh + admin UPDATE tu 0019),
    // va service-role key khong bao gio duoc dua vao apps/web, nen
    // Next route POST /api/orders khong the tao don ma khong pha vo
    // mo hinh bao mat. Luong hoan tra day du chi co o Workers
    // executeRefund(); mo them ban Next se tao 2 luong lech nhau
    // (xem bao cao TASK10 §4).
    expect(existsSync(join(ROOT, 'apps', 'web', 'src', 'app', 'api', 'v1', 'orders'))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, 'apps', 'web', 'src', 'app', 'api', 'webhooks'))).toBe(
      false,
    );
  });

  it('G-T10-4: tai lieu SePay chinh thuc (SEPAY_INTEGRATION.md) chua co — chu ky HMAC-SHA256 chua duoc xac nhan', () => {
    expect(existsSync(join(DOCS, 'database', 'SEPAY_INTEGRATION.md'))).toBe(false);
    // Khi file do co: doi chieu thuat toan/header that voi
    // workers/api/src/sepay.ts verifySepaySignature() + test chu ky.
  });

  it('G-T10-5: refundOrder() (Task 09, lms-admin.ts) chua co test nao', () => {
    const testSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'lms-admin.test.ts'),
      'utf8',
    );
    expect(testSrc).not.toContain('refundOrder');
    // Ham nay cung KHONG tu chan han 15 ngay lam viec (ghi ro trong
    // comment cua ham) va khong thu hoi enrollment — can test + route
    // admin o Task 10 (xem bao cao TASK10 §5, B-T10-3/B-T10-4).
  });
});

// ---------------------------------------------------------------------------
// Logic gia / coupon PURE cua lib/payments.ts — giu dong bo voi
// workers/api/src/payments.ts (cung vector test). Khong goi API that.
// ---------------------------------------------------------------------------

function coupon(over: Partial<CouponForPricing> = {}): CouponForPricing {
  return {
    discountType: 'percent',
    discountValue: 10,
    minOrderVnd: 0,
    maxDiscountVnd: null,
    maxUses: null,
    usedCount: 0,
    validFrom: null,
    validUntil: null,
    isActive: true,
    ...over,
  };
}

describe('TASK 10 — computeCouponDiscount (web, dong bo Workers)', () => {
  it('giam 10% tren 1.999.000đ = 199.900đ', () => {
    expect(computeCouponDiscount(coupon(), 1999000)).toEqual({ discountVnd: 199900, reason: null });
  });

  it('tran giam (maxDiscountVnd) cap so tien giam', () => {
    expect(computeCouponDiscount(coupon({ maxDiscountVnd: 50000 }), 1999000)).toEqual({
      discountVnd: 50000,
      reason: null,
    });
  });

  it('fixed_vnd: giam dung so tien, khong vuot gia don', () => {
    expect(computeCouponDiscount(coupon({ discountType: 'fixed_vnd', discountValue: 500000 }), 300000)).toEqual({
      discountVnd: 300000,
      reason: null,
    });
  });

  it('chua du don toi thieu -> khong giam', () => {
    expect(computeCouponDiscount(coupon({ minOrderVnd: 2000000 }), 1999000).reason).toBe(
      'min_order_not_met',
    );
  });

  it('ma tat / het han / het luot -> khong giam', () => {
    expect(computeCouponDiscount(coupon({ isActive: false }), 100000).reason).toBe('coupon_inactive');
    expect(
      computeCouponDiscount(
        coupon({ validUntil: '2026-01-01T00:00:00.000Z' }),
        100000,
        new Date('2026-11-10T00:00:00.000Z'),
      ).reason,
    ).toBe('coupon_expired');
    expect(computeCouponDiscount(coupon({ maxUses: 5, usedCount: 5 }), 100000).reason).toBe(
      'coupon_used_up',
    );
  });
});

describe('TASK 10 — computeOrderTotals (web, dong bo Workers)', () => {
  it('combo 2 khoa + coupon 10%: tong goc, giam, tong tra', () => {
    expect(
      computeOrderTotals(
        [
          { unitPriceVnd: 1000000, quantity: 1 },
          { unitPriceVnd: 999000, quantity: 1 },
        ],
        coupon(),
      ),
    ).toEqual({
      originalAmountVnd: 1999000,
      discountVnd: 199900,
      amountVnd: 1799100,
      couponReason: null,
    });
  });

  it('khong coupon -> tong tra = tong goc (don 0đ duoc phep)', () => {
    expect(computeOrderTotals([{ unitPriceVnd: 0, quantity: 1 }], null)).toEqual({
      originalAmountVnd: 0,
      discountVnd: 0,
      amountVnd: 0,
      couponReason: null,
    });
  });
});

describe('TASK 10 — nhan tieng Viet (phuong thuc / trang thai giao dich)', () => {
  it('phuong thuc + trang thai', () => {
    expect(paymentMethodLabelVi('bank_transfer')).toBe('Chuyển khoản ngân hàng');
    expect(paymentMethodLabelVi('free')).toBe('Miễn phí');
    expect(transactionStatusLabelVi('succeeded')).toBe('Thành công');
    expect(transactionStatusLabelVi('refunded')).toBe('Đã hoàn trả');
  });
});
