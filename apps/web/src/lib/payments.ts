// Payment & Commerce — client (Task 10).
// Goi Workers API (visfaracademy.netlify.app/api/v1 — DECISIONS Task 02
// QĐ 8) qua api-client, kem JWT + Idempotency-Key cho moi POST tao don.
// Workers CHUA deploy -> moi goi that deu loi/offline va lop nay PHAI
// tra loi ro rang, khong bao gio tra "ok" gia (giong leads.ts).
//
// QUY TAC:
// - Gia lay tu server (Workers tinh tu DB). Client chi gui id khoa/goi
//   + ma coupon + so tien Tuy tam; ham pure o day CHI de hien tam tinh
//   truoc khi gui (combo), khong phai gia chot.
// - Ham pure computeCouponDiscount / computeOrderTotals GIU DONG BO voi
//   workers/api/src/payments.ts (cung ten, cung luat). Doi 1 ben thi
//   doi ca ben + test ca ben.
// - Khong hien so tai khoan o day: API chi tra bankName + accountHolder
//   + content (ma don) + amount; ma QR VietQR hien tu file anh do user
//   cung cap (xem trang /thanh-toan/[orderId]).
// - Khong bao gio hien "da thanh toan" dua tren client: trang thai don
//   chi lay tu server (GET /orders/:id) sau webhook/admin xac nhan.
import {
  ApiError,
  getApiBaseUrl,
  isOfflineError,
  newIdempotencyKey,
  postJson,
  type FetchImpl,
} from './api-client';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';

export type PaymentsState<T> =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string; isOffline: boolean };

export interface PaymentOrderItem {
  id: string;
  itemType: string;
  courseId: string | null;
  planId: string | null;
  itemName: string;
  unitPriceVnd: number;
  quantity: number;
  totalVnd: number;
}

export interface PaymentOrder {
  id: string;
  referenceCode: string;
  status: string;
  amountVnd: number;
  originalAmountVnd: number;
  discountVnd: number;
  customAmountVnd: number | null;
  paymentMethod: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  couponCode: string | null;
  refundRequestedAt: string | null;
  refundReason: string | null;
  items: PaymentOrderItem[];
  transfer: {
    bankName: string;
    accountHolder: string;
    content: string;
    amountVnd: number;
  } | null;
}

export interface AdminOrder extends PaymentOrder {
  student: { id: string; fullName: string | null; email: string | null } | null;
  refundRequestedAt: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  refundBankReference: string | null;
}

export interface TransactionItem {
  id: string;
  orderId: string;
  referenceCode: string | null;
  amountVnd: number;
  method: string;
  gatewayReference: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface MembershipPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceVnd: number;
  durationDays: number | null;
  courseId: string | null;
  isActive?: boolean;
}

export interface CouponPreview {
  valid: boolean;
  code: string;
  discountType: string;
  discountValue: number;
  discountVnd: number;
  amountAfterDiscount: number;
  reason: string | null;
}

export interface CouponAdminRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_vnd: number;
  max_discount_vnd: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminPaymentRow {
  id: string;
  order_id: string;
  amount_vnd: number;
  method: string;
  gateway_reference: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  orders: { id: string; reference_code: string; user_id: string | null; status: string } | null;
}

// ---------------------------------------------------------------------------
// Logic gia / coupon — PURE, giu dong bo voi workers/api/src/payments.ts
// ---------------------------------------------------------------------------

export interface CouponForPricing {
  discountType: string;
  discountValue: number;
  minOrderVnd: number;
  maxDiscountVnd: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export function computeCouponDiscount(
  coupon: CouponForPricing,
  originalAmountVnd: number,
  now: Date = new Date(),
): { discountVnd: number; reason: string | null } {
  if (!coupon.isActive) return { discountVnd: 0, reason: 'coupon_inactive' };
  if (coupon.validFrom && now < new Date(coupon.validFrom)) {
    return { discountVnd: 0, reason: 'coupon_not_started' };
  }
  if (coupon.validUntil && now > new Date(coupon.validUntil)) {
    return { discountVnd: 0, reason: 'coupon_expired' };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { discountVnd: 0, reason: 'coupon_used_up' };
  }
  if (originalAmountVnd < (coupon.minOrderVnd ?? 0)) {
    return { discountVnd: 0, reason: 'min_order_not_met' };
  }
  let discount = 0;
  if (coupon.discountType === 'percent') {
    discount = Math.floor((originalAmountVnd * coupon.discountValue) / 100);
    if (coupon.maxDiscountVnd !== null) discount = Math.min(discount, coupon.maxDiscountVnd);
  } else if (coupon.discountType === 'fixed_vnd') {
    discount = coupon.discountValue;
  } else {
    return { discountVnd: 0, reason: 'coupon_invalid_type' };
  }
  discount = Math.max(0, Math.min(discount, originalAmountVnd));
  return { discountVnd: discount, reason: null };
}

export function computeOrderTotals(
  items: Array<{ unitPriceVnd: number; quantity: number }>,
  coupon: CouponForPricing | null,
  now: Date = new Date(),
): { originalAmountVnd: number; discountVnd: number; amountVnd: number; couponReason: string | null } {
  const originalAmountVnd = items.reduce((sum, it) => sum + it.unitPriceVnd * it.quantity, 0);
  if (!coupon) {
    return { originalAmountVnd, discountVnd: 0, amountVnd: originalAmountVnd, couponReason: null };
  }
  const { discountVnd, reason } = computeCouponDiscount(coupon, originalAmountVnd, now);
  return {
    originalAmountVnd,
    discountVnd,
    amountVnd: Math.max(0, originalAmountVnd - discountVnd),
    couponReason: reason,
  };
}

export function paymentMethodLabelVi(method: string | null): string {
  const map: Record<string, string> = {
    bank_transfer: 'Chuyển khoản ngân hàng',
    sepay: 'SePay (chuyển khoản)',
    stripe: 'Thẻ quốc tế (Stripe)',
    cash: 'Tiền mặt',
    free: 'Miễn phí',
  };
  return method ? (map[method] ?? method) : 'Chưa chọn';
}

export function transactionStatusLabelVi(status: string): string {
  const map: Record<string, string> = {
    pending: 'Chờ xử lý',
    succeeded: 'Thành công',
    failed: 'Thất bại',
    refunded: 'Đã hoàn trả',
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Goi API — JWT + Idempotency-Key + timeout (qua api-client)
// ---------------------------------------------------------------------------

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function errorState<T>(err: unknown, fallback: string): PaymentsState<T> {
  const isOffline = isOfflineError(err);
  return {
    status: 'error',
    message: isOffline
      ? 'Không kết nối được tới API thanh toán. Kiểm tra mạng, hoặc API chưa được triển khai (Workers chưa deploy).'
      : err instanceof Error
        ? err.message
        : fallback,
    isOffline,
  };
}

async function apiGet<T>(
  path: string,
  opts: { fetchImpl?: FetchImpl; timeoutMs?: number } = {},
): Promise<PaymentsState<T>> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        return { status: 'error', message: 'Hết thời gian chờ phản hồi. Vui lòng thử lại.', isOffline: false };
      }
      return {
        status: 'error',
        message: 'Không kết nối được tới API thanh toán. Kiểm tra mạng, hoặc API chưa được triển khai (Workers chưa deploy).',
        isOffline: true,
      };
    }
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
      const message =
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error ??
        'Không tải được dữ liệu.';
      return { status: 'error', message: String(message), isOffline: false };
    }
    return { status: 'success', data: data as T };
  } catch (err) {
    return errorState<T>(err, 'Không tải được dữ liệu.');
  } finally {
    clearTimeout(timer);
  }
}

async function apiPost<T>(
  path: string,
  body: unknown,
  opts: { idempotencyKey?: string; fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<T>> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    const data = await postJson<{ ok: boolean } & T>(path, body, {
      accessToken,
      idempotencyKey: opts.idempotencyKey ?? newIdempotencyKey(),
      fetchImpl: opts.fetchImpl,
    });
    return { status: 'success', data: data as T };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'offline') {
      return {
        status: 'error',
        message: 'Không kết nối được tới API thanh toán. Kiểm tra mạng, hoặc API chưa được triển khai (Workers chưa deploy).',
        isOffline: true,
      };
    }
    return errorState<T>(err, 'Không thực hiện được yêu cầu.');
  }
}

export interface CreateOrderRequest {
  items: Array<{ itemType: 'course' | 'membership'; courseId?: string; planId?: string }>;
  couponCode?: string | null;
  customAmountVnd?: number | null;
}

/** Tao don. Tra ve don + co duplicate (trung Idempotency-Key). */
export async function createOrder(
  input: CreateOrderRequest,
  opts: { idempotencyKey?: string; fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ order: PaymentOrder; duplicate: boolean }>> {
  return apiPost<{ order: PaymentOrder; duplicate: boolean }>('/orders', input, opts);
}

export async function fetchOrder(
  orderId: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ order: PaymentOrder }>> {
  return apiGet<{ order: PaymentOrder }>(`/orders/${encodeURIComponent(orderId)}`, opts);
}

export async function fetchMyOrders(
  status?: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ orders: PaymentOrder[] }>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiGet<{ orders: PaymentOrder[] }>(`/my/orders${q}`, opts);
}

export async function fetchMyTransactions(
  page = 1,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ transactions: TransactionItem[] }>> {
  return apiGet<{ transactions: TransactionItem[] }>(`/my/transactions?page=${page}`, opts);
}

export async function cancelOrder(
  orderId: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ order: PaymentOrder }>> {
  return apiPost<{ order: PaymentOrder }>(`/orders/${encodeURIComponent(orderId)}/cancel`, {}, opts);
}

export async function validateCoupon(
  code: string,
  amountVnd: number,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<CouponPreview>> {
  return apiPost<CouponPreview>('/coupons/validate', { code, amountVnd }, opts);
}

export async function fetchMembershipPlans(
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ plans: MembershipPlan[] }>> {
  // Endpoint cong khai nhung van can JWT o Workers hien tai? Khong:
  // handler khong yeu cau auth — goi truc tiep khong can token.
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${getApiBaseUrl()}/membership-plans`);
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
      return { status: 'error', message: 'Không tải được gói thành viên.', isOffline: false };
    }
    return { status: 'success', data: data as { plans: MembershipPlan[] } };
  } catch (err) {
    return errorState<{ plans: MembershipPlan[] }>(err, 'Không tải được gói thành viên.');
  }
}

export async function enrollFreeCourse(
  courseId: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ courseId: string; alreadyEnrolled: boolean }>> {
  return apiPost<{ courseId: string; alreadyEnrolled: boolean }>('/my/enrollments', { courseId }, opts);
}

export async function requestRefund(
  orderId: string,
  reason: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ order: PaymentOrder }>> {
  return apiPost<{ order: PaymentOrder }>(`/my/orders/${encodeURIComponent(orderId)}/refund-request`, { reason }, opts);
}

// ---------------------------------------------------------------------------
// Admin — qua Workers API (can JWT admin)
// ---------------------------------------------------------------------------

export async function fetchAdminOrders(
  params: { status?: string; q?: string; refundRequested?: boolean; page?: number } = {},
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ orders: AdminOrder[] }>> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  if (params.refundRequested) search.set('refundRequested', 'true');
  if (params.page) search.set('page', String(params.page));
  const qs = search.toString();
  return apiGet<{ orders: AdminOrder[] }>(`/admin/orders${qs ? `?${qs}` : ''}`, opts);
}

export async function markOrderPaid(
  orderId: string,
  input: { amountVnd: number; gatewayReference?: string | null; note?: string },
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ order: PaymentOrder; duplicate: boolean }>> {
  return apiPost<{ order: PaymentOrder; duplicate: boolean }>(
    `/admin/orders/${encodeURIComponent(orderId)}/mark-paid`,
    input,
    opts,
  );
}

export async function refundOrder(
  orderId: string,
  input: { reason: string; refundBankReference: string; forceReason?: string | null },
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ order: PaymentOrder }>> {
  return apiPost<{ order: PaymentOrder }>(
    `/admin/orders/${encodeURIComponent(orderId)}/refund`,
    input,
    opts,
  );
}

export async function expireOrdersSweep(
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ expiredCount: number }>> {
  return apiPost<{ expiredCount: number }>('/admin/orders/expire-sweep', {}, opts);
}

export async function fetchAdminCoupons(
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ coupons: CouponAdminRow[] }>> {
  return apiGet<{ coupons: CouponAdminRow[] }>('/admin/coupons', opts);
}

export async function createCoupon(
  input: {
    code: string;
    description?: string | null;
    discountType: string;
    discountValue: number;
    minOrderVnd?: number;
    maxDiscountVnd?: number | null;
    maxUses?: number | null;
    validFrom?: string | null;
    validUntil?: string | null;
  },
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ coupon: CouponAdminRow }>> {
  return apiPost<{ coupon: CouponAdminRow }>('/admin/coupons', input, opts);
}

export async function toggleCoupon(
  couponId: string,
  isActive: boolean,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ coupon: CouponAdminRow }>> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    const res = await (opts.fetchImpl ?? fetch)(
      `${getApiBaseUrl()}/admin/coupons/${encodeURIComponent(couponId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ isActive }),
      },
    );
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
      return { status: 'error', message: 'Không đổi được trạng thái mã.', isOffline: false };
    }
    return { status: 'success', data: data as { coupon: CouponAdminRow } };
  } catch (err) {
    return errorState<{ coupon: CouponAdminRow }>(err, 'Không đổi được trạng thái mã.');
  }
}

export async function fetchAdminPlans(
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ plans: MembershipPlan[] }>> {
  return apiGet<{ plans: MembershipPlan[] }>('/admin/membership-plans', opts);
}

export async function createPlan(
  input: {
    slug: string;
    name: string;
    description?: string | null;
    priceVnd: number;
    durationDays?: number | null;
    courseId?: string | null;
  },
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ plan: MembershipPlan }>> {
  return apiPost<{ plan: MembershipPlan }>('/admin/membership-plans', input, opts);
}

export async function fetchAdminPayments(
  params: { status?: string; method?: string; page?: number } = {},
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<PaymentsState<{ payments: AdminPaymentRow[] }>> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.method) search.set('method', params.method);
  if (params.page) search.set('page', String(params.page));
  const qs = search.toString();
  return apiGet<{ payments: AdminPaymentRow[] }>(`/admin/payments${qs ? `?${qs}` : ''}`, opts);
}
