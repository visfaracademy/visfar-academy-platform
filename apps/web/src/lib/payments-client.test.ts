// TASK 10 — test client thanh toan (apps/web/src/lib/payments.ts).
// Chay local, khong can Supabase/Workers that:
// - Ham pure computeCouponDiscount / computeOrderTotals: cung luat, cung
//   so voi workers/api/src/payments.ts (parity — doi 1 ben phai doi ca
//   ben + test ca ben).
// - Cac ham goi API: gui dung path/header (JWT + Idempotency-Key), xu ly
//   loi/offline thanh PaymentsState, khong bao gio tra "ok" gia.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: () => ({
    auth: { getSession: mocks.getSession },
  }),
}));

import {
  computeCouponDiscount,
  computeOrderTotals,
  createOrder,
  fetchMembershipPlans,
  fetchOrder,
  paymentMethodLabelVi,
  requestRefund,
  transactionStatusLabelVi,
  validateCoupon,
  type CouponForPricing,
} from './payments';
import type { FetchImpl } from './api-client';

const API = 'https://api.visfaracademy.workers.dev/api/v1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function coupon(over: Partial<CouponForPricing> = {}): CouponForPricing {
  return {
    discountType: 'percent',
    discountValue: 10,
    minOrderVnd: 0,
    maxDiscountVnd: 50000,
    maxUses: 10,
    usedCount: 0,
    validFrom: null,
    validUntil: null,
    isActive: true,
    ...over,
  };
}

describe('TASK 10 — ham pure gia/coupon (parity voi workers/api/src/payments.ts)', () => {
  it('computeCouponDiscount: percent 10% tren 1.999.000 tran 50.000 -> 50.000', () => {
    expect(computeCouponDiscount(coupon(), 1999000)).toEqual({ discountVnd: 50000, reason: null });
  });

  it('computeCouponDiscount: 100% -> giam het; fixed 200.000 tren don 150.000 -> tran bang don', () => {
    expect(computeCouponDiscount(coupon({ discountValue: 100, maxDiscountVnd: null }), 1999000)).toEqual({
      discountVnd: 1999000,
      reason: null,
    });
    expect(
      computeCouponDiscount(
        coupon({ discountType: 'fixed_vnd', discountValue: 200000, maxDiscountVnd: null }),
        150000,
      ),
    ).toEqual({ discountVnd: 150000, reason: null });
  });

  it('computeCouponDiscount: khong hoat dong / het han / het luot / chua du don toi thieu -> 0 + reason', () => {
    expect(computeCouponDiscount(coupon({ isActive: false }), 1999000)).toEqual({
      discountVnd: 0,
      reason: 'coupon_inactive',
    });
    expect(computeCouponDiscount(coupon({ validUntil: '2026-01-01T00:00:00Z' }), 1999000, new Date('2026-11-10T00:00:00Z'))).toEqual({
      discountVnd: 0,
      reason: 'coupon_expired',
    });
    expect(computeCouponDiscount(coupon({ usedCount: 10 }), 1999000)).toEqual({
      discountVnd: 0,
      reason: 'coupon_used_up',
    });
    expect(computeCouponDiscount(coupon({ minOrderVnd: 5000000 }), 1999000)).toEqual({
      discountVnd: 0,
      reason: 'min_order_not_met',
    });
    expect(computeCouponDiscount(coupon({ discountType: 'la' }), 1999000)).toEqual({
      discountVnd: 0,
      reason: 'coupon_invalid_type',
    });
  });

  it('computeOrderTotals: cong nhieu mon; coupon 100% -> 0; khong coupon -> giu nguyen', () => {
    const items = [
      { unitPriceVnd: 1999000, quantity: 1 },
      { unitPriceVnd: 499000, quantity: 2 },
    ];
    expect(computeOrderTotals(items, null)).toEqual({
      originalAmountVnd: 2997000,
      discountVnd: 0,
      amountVnd: 2997000,
      couponReason: null,
    });
    expect(
      computeOrderTotals(items, coupon({ discountValue: 100, maxDiscountVnd: null })),
    ).toEqual({ originalAmountVnd: 2997000, discountVnd: 2997000, amountVnd: 0, couponReason: null });
    expect(computeOrderTotals(items, coupon())).toEqual({
      originalAmountVnd: 2997000,
      discountVnd: 50000,
      amountVnd: 2947000,
      couponReason: null,
    });
  });

  it('nhan: phuong thuc + trang thai giao dich co tieng Viet', () => {
    expect(paymentMethodLabelVi('bank_transfer')).toBe('Chuyển khoản ngân hàng');
    expect(paymentMethodLabelVi('sepay')).toBe('SePay (chuyển khoản)');
    expect(paymentMethodLabelVi(null)).toBe('Chưa chọn');
    expect(transactionStatusLabelVi('succeeded')).toBe('Thành công');
    expect(transactionStatusLabelVi('refunded')).toBe('Đã hoàn trả');
  });
});

describe('TASK 10 — client goi Workers API (fetch mock)', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'tok-test' } },
    });
  });

  it('createOrder: POST /orders kem JWT + Idempotency-Key; tra don + duplicate:false', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: FetchImpl = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse({
        ok: true,
        order: { id: 'order-1', referenceCode: 'DH-2026-000123', status: 'pending', amountVnd: 1999000 },
        duplicate: false,
      });
    };
    const out = await createOrder(
      { items: [{ itemType: 'course', courseId: '00000000-0000-0000-0000-000000000001' }] },
      { idempotencyKey: 'key-web-1', fetchImpl },
    );
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toBe(`${API}/orders`);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok-test');
    expect(headers['Idempotency-Key']).toBe('key-web-1');
    expect(out).toEqual({
      status: 'success',
      data: {
        ok: true,
        order: { id: 'order-1', referenceCode: 'DH-2026-000123', status: 'pending', amountVnd: 1999000 },
        duplicate: false,
      },
    });
  });

  it('createOrder: trung key (200 duplicate:true) -> success, khong bao loi', async () => {
    const fetchImpl: FetchImpl = async () =>
      jsonResponse({ ok: true, order: { id: 'order-1', status: 'pending' }, duplicate: true });
    const out = await createOrder(
      { items: [{ itemType: 'course', courseId: '00000000-0000-0000-0000-000000000001' }] },
      { idempotencyKey: 'key-web-1', fetchImpl },
    );
    expect(out.status).toBe('success');
    if (out.status === 'success') expect(out.data.duplicate).toBe(true);
  });

  it('createOrder: 409 idempotency_conflict -> error (khong success gia); offline -> error isOffline:true', async () => {
    const conflict: FetchImpl = async () =>
      jsonResponse({ ok: false, error: 'idempotency_conflict', message: 'Key da dung cho don khac.' }, 409);
    const out = await createOrder(
      { items: [{ itemType: 'course', courseId: '00000000-0000-0000-0000-000000000001' }] },
      { idempotencyKey: 'key-web-1', fetchImpl: conflict },
    );
    expect(out.status).toBe('error');
    if (out.status === 'error') {
      expect(out.isOffline).toBe(false);
      expect(out.message).toContain('Key da dung');
    }
    const offline: FetchImpl = async () => {
      throw new Error('network down');
    };
    const out2 = await createOrder(
      { items: [{ itemType: 'course', courseId: '00000000-0000-0000-0000-000000000001' }] },
      { fetchImpl: offline },
    );
    expect(out2).toEqual({
      status: 'error',
      message: expect.stringContaining('Không kết nối được tới API thanh toán'),
      isOffline: true,
    });
  });

  it('fetchOrder: GET /orders/:id kem JWT; 404 -> error', async () => {
    const fetchImpl: FetchImpl = async (url, init) => {
      expect(String(url)).toBe(`${API}/orders/order-1`);
      expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-test');
      return jsonResponse({ ok: true, order: { id: 'order-1', status: 'paid' } });
    };
    const out = await fetchOrder('order-1', { fetchImpl });
    expect(out.status).toBe('success');
    const notFound: FetchImpl = async () =>
      jsonResponse({ ok: false, error: 'not_found', message: 'Không tìm thấy đơn hàng.' }, 404);
    expect((await fetchOrder('order-x', { fetchImpl: notFound })).status).toBe('error');
  });

  it('validateCoupon: POST /coupons/validate; requestRefund: POST /my/orders/:id/refund-request', async () => {
    const seen: string[] = [];
    const fetchImpl: FetchImpl = async (url) => {
      seen.push(String(url));
      if (String(url).endsWith('/coupons/validate')) {
        return jsonResponse({ ok: true, valid: true, code: 'GIAM10', discountVnd: 50000, amountAfterDiscount: 1949000 });
      }
      return jsonResponse({ ok: true, order: { id: 'order-1', status: 'paid', refundRequestedAt: '2026-11-10T00:00:00Z' } });
    };
    const v = await validateCoupon('giam10', 1999000, { fetchImpl });
    expect(v.status).toBe('success');
    if (v.status === 'success') expect(v.data.discountVnd).toBe(50000);
    const r = await requestRefund('order-1', 'Ly do ca nhan.', { fetchImpl });
    expect(r.status).toBe('success');
    expect(seen).toEqual([`${API}/coupons/validate`, `${API}/my/orders/order-1/refund-request`]);
  });

  it('fetchMembershipPlans: GET cong khai, khong gui Authorization', async () => {
    let authHeader: unknown = 'chua-goi';
    const fetchImpl: FetchImpl = async (url, init) => {
      expect(String(url)).toBe(`${API}/membership-plans`);
      authHeader = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
      return jsonResponse({ ok: true, plans: [{ id: 'plan-1', slug: 'cong-dong', priceVnd: 499000 }] });
    };
    const out = await fetchMembershipPlans({ fetchImpl });
    expect(out.status).toBe('success');
    expect(authHeader).toBeUndefined();
  });

  it('chua dang nhap -> signed-out (khong goi fetch)', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const fetchImpl: FetchImpl = async () => {
      throw new Error('khong duoc goi fetch khi signed-out');
    };
    expect(await fetchOrder('order-1', { fetchImpl })).toEqual({ status: 'signed-out' });
    expect(await createOrder({ items: [] }, { fetchImpl })).toEqual({ status: 'signed-out' });
  });
});
