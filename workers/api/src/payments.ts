// Payment & Commerce — service core (Task 10).
//
// LUONG THANH TOAN 11 BUOC (API_ARCHITECTURE §10.1 + SYSTEM_ARCHITECTURE §8):
//   (1) hoc vien chon khoa -> (2) backend tao don (createOrder) ->
//   (3) backend tao yeu cau thanh toan (tra ve thong tin chuyen khoan
//   + ma don lam noi dung) -> (4) nha cung cap xu ly (hoc vien chuyen
//   khoan MB Bank / SePay) -> (5) backend nhan webhook
//   (handleSepayWebhook) -> (6) xac minh chu ky (sepay.ts) ->
//   (7) kiem tra ma giao dich + so tien (checkPaymentAmount) ->
//   (8) chong xu ly trung (idempotency + UNIQUE method+gateway_reference)
//   -> (9) xac nhan thanh toan (payments succeeded + orders paid) ->
//   (10) cap quyen hoc (enrollments + memberships) -> (11) gui email (E4 + E5).
//
// NGUYEN TAC BAT BIEN:
//   - KHONG cap quyen hoc chi dua vao frontend hoac anh chup giao dich.
//     Chi server moi doi don sang 'paid' sau khi webhook xac minh hoac
//     admin xac nhan (ghi audit_logs) — xem canGrantEnrollment().
//   - Tien luon lay tu DB (courses.price_vnd / membership_plans.
//     price_vnd), KHONG BAO GIO tin gia client gui.
//   - Gia khoa giu Tuy tam / 0đ toi khi user cung cap gia (DECISIONS
//     Task 03 QĐ 11). Khong bia gia, khong bia so tai khoan.
//   - Hoan tien: SePay KHONG co API hoan tien duoc goi o day — xem
//     executeRefund(): hoan tien xu ly THU CONG qua admin (chuyen khoan
//     lai bang MB Bank, ghi refund_bank_reference) + audit log. Neu
//     SEPAY_INTEGRATION.md sau nay xac nhan SePay co API hoan tien thi
//     them buoc goi API do vao executeRefund() sau buoc kiem tra han,
//     truoc khi ghi payments 'refunded' — khong doi cac buoc khac.
//   - Email: dung module email cua Task 11 (sendTemplatedEmail).
//     Mau E4 (Task 11) = 'Xac nhan thanh toan'. CHU Y: danh so mau
//     E1–E13 cua Task 11 KHAC voi danh so trong SYSTEM_ARCHITECTURE
//     §9 (o do E5 = don moi, E8 = da nhan thanh toan, E13 = hoan tra).
//     Code nay dung danh so Task 11 (module email that). Hien Task 11
//     CHUA co mau 'don moi' (E5 cu) va 'xac nhan hoan tra' (E13 cu)
//     nen 2 truong hop do KHONG gui email — chi ghi log + hien huong
//     dan tren trang thanh toan; can Task 11 bo sung mau neu muon gui.
//   - Sheet: don hang KHONG ghi Sheet (Sheet chi la ban sao doi soat
//     cua LEAD theo QĐ 5). Doi soat don qua GET /admin/orders +
//     GET /admin/payments (bao cao R9).
import type { Env } from './env';
import { safeLog } from './env';
import { ApiError, serverError } from './errors';
import { verifySupabaseJwt } from './jwt';
import { checkRateLimit, getClientIp } from './rate-limit';
import {
  canGrantEnrollment,
  checkPaymentAmount,
  decideIdempotencyReplay,
  findDuplicatePayment,
  isIdempotencyKeyExpired,
  isRefundRequestInWindow,
  parseSepayPayload,
  shouldRevokeEnrollment,
  verifySepayWebhookSignature,
  IDEMPOTENCY_TTL_MS,
  type SepayTransaction,
} from './sepay';
import {
  getCourseMeta,
  getProfileEmail,
  isUniqueViolation,
  requireSbOk,
  sbFetch,
} from './supabase';
import { getProfileRole } from './email/store';
import { recordReferralCommission } from './referrals';
import { sendTemplatedEmail } from './email/templated';
import {
  createResendMailerFromEnv,
  createSupabaseAutomationStore,
  runPaymentVerifiedAccess,
  type AutomationDeps,
} from './automation-rules';

// ---------------------------------------------------------------------------
// Hang so — theo quyet dinh da chot
// ---------------------------------------------------------------------------

/** Ngan hang nhan chuyen khoan (QĐ 15). So tai khoan KHONG luu o day. */
export const PAYMENT_BANK_NAME = 'MB Bank';
/** Chu tai khoan (QĐ 15). */
export const PAYMENT_ACCOUNT_HOLDER = 'Công ty TNHH MTV Visfar Holdings';
/** Han giu cho mac dinh khi system_settings chua co (order.expiry_hours = 48). */
export const DEFAULT_ORDER_EXPIRY_HOURS = 48;
/** Khung hoan tra mac dinh khi system_settings chua co (refund.working_days = 15). */
export const DEFAULT_REFUND_WORKING_DAYS = 15;
/** Rate-limit tao don: 300 req/gio/user (Task 03 QĐ 13) + 100 req/phut/IP. */
export const ORDER_RATE_PER_USER_PER_HOUR = 300;
export const ORDER_RATE_PER_IP_PER_MIN = 100;

// ---------------------------------------------------------------------------
// Kieu du lieu
// ---------------------------------------------------------------------------

export interface OrderItemInput {
  /** 'course' | 'membership' (combo = nhieu item trong 1 don). */
  itemType: 'course' | 'membership';
  courseId?: string;
  planId?: string;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  /** Ma giam gia (viet hoa, khong dau — chuan hoa o server). */
  couponCode?: string | null;
  /**
   * So tien Tuy tam (VND). Chi duoc dung khi don chi co 1 item la khoa
   * Tuy tam (courses.is_pay_what_you_want = true). Khong dung chung
   * voi coupon.
   */
  customAmountVnd?: number | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  item_type: string;
  course_id: string | null;
  membership_plan_id: string | null;
  /** Cot cu 0004, NOT NULL — phai gui khi insert (xem createOrder). */
  title_snapshot: string;
  /** Cot cu 0004, NOT NULL — bang unit_price_vnd * quantity. */
  amount_vnd: number;
  item_name: string;
  unit_price_vnd: number;
  quantity: number;
  total_vnd: number;
}

export interface OrderRow {
  id: string;
  user_id: string | null;
  course_id: string | null;
  coupon_id: string | null;
  amount_vnd: number;
  original_amount_vnd: number | null;
  discount_vnd: number;
  custom_amount_vnd: number | null;
  status: string;
  payment_method: string | null;
  reference_code: string;
  expires_at: string | null;
  paid_at: string | null;
  refund_reason: string | null;
  refund_requested_at: string | null;
  refunded_at: string | null;
  refund_bank_reference: string | null;
  idempotency_key: string | null;
  idempotency_body_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  amount_vnd: number;
  method: string;
  gateway_reference: string | null;
  gateway_payload: Record<string, unknown> | null;
  status: string;
  paid_at: string | null;
  verified_by: string | null;
  created_at: string;
}

export interface CourseSaleRow {
  id: string;
  title: string;
  slug: string;
  price_vnd: number;
  status: string;
  is_pay_what_you_want: boolean | null;
}

export interface PlanSaleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_vnd: number;
  duration_days: number | null;
  course_id: string | null;
  is_active: boolean;
}

export interface CouponRow {
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
}

export interface OrderSummary {
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
  items: Array<{
    id: string;
    itemType: string;
    courseId: string | null;
    planId: string | null;
    itemName: string;
    unitPriceVnd: number;
    quantity: number;
    totalVnd: number;
  }>;
  /**
   * Thong tin chuyen khoan hien cho hoc vien. KHONG chua so tai khoan
   * (so tai khoan chi co trong anh QR do user cung cap — hien o
   * frontend tu file anh, khong qua API).
   */
  transfer: {
    bankName: string;
    accountHolder: string;
    content: string;
    amountVnd: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Auth — JWT + role (khong tin JWT client tu khai)
// ---------------------------------------------------------------------------

export interface AuthedUser {
  userId: string;
  email: string | null;
}

export async function requireAuthUser(env: Env, req: Request): Promise<AuthedUser> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  if (!token) throw new ApiError(401, 'unauthorized', 'Bạn chưa đăng nhập.');
  let verified;
  try {
    verified = await verifySupabaseJwt(token, env.SUPABASE_URL);
  } catch {
    throw new ApiError(401, 'unauthorized', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  const profile = await getProfileEmail(env, verified.userId);
  return { userId: verified.userId, email: profile?.email ?? null };
}

export async function requireAdmin(env: Env, req: Request): Promise<AuthedUser> {
  const user = await requireAuthUser(env, req);
  const role = await getProfileRole(env, user.userId);
  if (role !== 'admin') {
    throw new ApiError(403, 'forbidden', 'Bạn không có quyền quản trị.');
  }
  return user;
}

/** Rate-limit tao don theo user + IP (dem ca request loi validation). */
export async function checkOrderRateLimit(env: Env, req: Request, userId: string): Promise<void> {
  const ip = getClientIp(req);
  const byIp = await checkRateLimit(env, `orders-ip:${ip}`, ORDER_RATE_PER_IP_PER_MIN, 60 * 1000);
  if (!byIp.allowed) {
    throw new ApiError(429, 'rate_limited', 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.', {
      retryAfterSec: byIp.retryAfterSec,
    });
  }
  const byUser = await checkRateLimit(
    env,
    `orders-user:${userId}`,
    ORDER_RATE_PER_USER_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!byUser.allowed) {
    throw new ApiError(429, 'rate_limited', 'Bạn đã tạo quá nhiều đơn trong 1 giờ. Vui lòng thử lại sau.', {
      retryAfterSec: byUser.retryAfterSec,
    });
  }
}

// ---------------------------------------------------------------------------
// Tien / coupon — PURE (giữ đồng bộ với apps/web/src/lib/payments.ts)
// ---------------------------------------------------------------------------

export interface CouponDiscount {
  discountVnd: number;
  /** Ly do khong giam (null = giam duoc). */
  reason: string | null;
}

/**
 * Tinh so tien giam cua 1 coupon tren gia goc (chua giam).
 * Ten cot theo DB THAT (0004): discount_type 'percent' | 'fixed_vnd',
 * max_uses, valid_until, is_active — khac ten thiet ke Task 03
 * ('fixed_amount' / usage_limit / valid_to / status).
 */
export function computeCouponDiscount(
  coupon: CouponRow,
  originalAmountVnd: number,
  now: Date = new Date(),
): CouponDiscount {
  if (!coupon.is_active) return { discountVnd: 0, reason: 'coupon_inactive' };
  if (coupon.valid_from && now < new Date(coupon.valid_from)) {
    return { discountVnd: 0, reason: 'coupon_not_started' };
  }
  if (coupon.valid_until && now > new Date(coupon.valid_until)) {
    return { discountVnd: 0, reason: 'coupon_expired' };
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { discountVnd: 0, reason: 'coupon_used_up' };
  }
  if (originalAmountVnd < (coupon.min_order_vnd ?? 0)) {
    return { discountVnd: 0, reason: 'min_order_not_met' };
  }
  let discount = 0;
  if (coupon.discount_type === 'percent') {
    discount = Math.floor((originalAmountVnd * coupon.discount_value) / 100);
    if (coupon.max_discount_vnd !== null) discount = Math.min(discount, coupon.max_discount_vnd);
  } else if (coupon.discount_type === 'fixed_vnd') {
    discount = coupon.discount_value;
  } else {
    return { discountVnd: 0, reason: 'coupon_invalid_type' };
  }
  discount = Math.max(0, Math.min(discount, originalAmountVnd));
  return { discountVnd: discount, reason: null };
}

export interface PricedItem {
  unitPriceVnd: number;
  quantity: number;
}

export function computeOrderTotals(
  items: PricedItem[],
  coupon: CouponRow | null,
  now: Date = new Date(),
): { originalAmountVnd: number; discountVnd: number; amountVnd: number; couponReason: string | null } {
  const originalAmountVnd = items.reduce(
    (sum, it) => sum + it.unitPriceVnd * it.quantity,
    0,
  );
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

// ---------------------------------------------------------------------------
// Doc DB (PostgREST, service-role)
// ---------------------------------------------------------------------------

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function canonicalOrderBody(input: CreateOrderInput): string {
  const items = [...input.items]
    .map((it) => ({
      itemType: it.itemType,
      courseId: it.courseId ?? null,
      planId: it.planId ?? null,
    }))
    .sort((a, b) => `${a.itemType}:${a.courseId ?? ''}:${a.planId ?? ''}`.localeCompare(
      `${b.itemType}:${b.courseId ?? ''}:${b.planId ?? ''}`,
    ));
  return JSON.stringify({
    items,
    couponCode: (input.couponCode ?? '').trim().toUpperCase() || null,
    customAmountVnd: input.customAmountVnd ?? null,
  });
}

async function getSystemSettingNumber(
  env: Env,
  key: string,
  fallback: number,
): Promise<number> {
  try {
    const result = await sbFetch<Array<{ value: number }>>(
      env,
      `/system_settings?select=value&key=eq.${encodeURIComponent(key)}&limit=1`,
    );
    const rows = requireSbOk(result, 'getSystemSettingNumber');
    const v = rows?.[0]?.value;
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

async function getCourseForSale(env: Env, courseId: string): Promise<CourseSaleRow | null> {
  const result = await sbFetch<CourseSaleRow[]>(
    env,
    `/courses?select=id,title,slug,price_vnd,status,is_pay_what_you_want&id=eq.${encodeURIComponent(courseId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getCourseForSale');
  return rows && rows.length > 0 ? (rows[0] as CourseSaleRow) : null;
}

async function getPlanForSale(env: Env, planId: string): Promise<PlanSaleRow | null> {
  const result = await sbFetch<PlanSaleRow[]>(
    env,
    `/membership_plans?select=id,slug,name,description,price_vnd,duration_days,course_id,is_active&id=eq.${encodeURIComponent(planId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getPlanForSale');
  return rows && rows.length > 0 ? (rows[0] as PlanSaleRow) : null;
}

export async function getCouponByCode(env: Env, code: string): Promise<CouponRow | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const result = await sbFetch<CouponRow[]>(
    env,
    `/coupons?select=id,code,description,discount_type,discount_value,min_order_vnd,max_discount_vnd,max_uses,used_count,valid_from,valid_until,is_active&code=eq.${encodeURIComponent(normalized)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getCouponByCode');
  return rows && rows.length > 0 ? (rows[0] as CouponRow) : null;
}

export async function getOrderById(env: Env, orderId: string): Promise<OrderRow | null> {
  const result = await sbFetch<OrderRow[]>(
    env,
    `/orders?select=*&id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getOrderById');
  return rows && rows.length > 0 ? (rows[0] as OrderRow) : null;
}

export async function getOrderByReference(
  env: Env,
  referenceCode: string,
): Promise<OrderRow | null> {
  const result = await sbFetch<OrderRow[]>(
    env,
    `/orders?select=*&reference_code=eq.${encodeURIComponent(referenceCode)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getOrderByReference');
  return rows && rows.length > 0 ? (rows[0] as OrderRow) : null;
}

export async function getOrderByIdempotencyKey(
  env: Env,
  key: string,
): Promise<OrderRow | null> {
  const result = await sbFetch<OrderRow[]>(
    env,
    `/orders?select=*&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getOrderByIdempotencyKey');
  return rows && rows.length > 0 ? (rows[0] as OrderRow) : null;
}

export async function getOrderItems(env: Env, orderId: string): Promise<OrderItemRow[]> {
  const result = await sbFetch<OrderItemRow[]>(
    env,
    `/order_items?select=*&order_id=eq.${encodeURIComponent(orderId)}&order=created_at.asc`,
  );
  const rows = requireSbOk(result, 'getOrderItems');
  return (rows ?? []) as OrderItemRow[];
}

async function getPaymentsByOrder(env: Env, orderId: string): Promise<PaymentRow[]> {
  const result = await sbFetch<PaymentRow[]>(
    env,
    `/payments?select=*&order_id=eq.${encodeURIComponent(orderId)}&order=created_at.asc`,
  );
  const rows = requireSbOk(result, 'getPaymentsByOrder');
  return (rows ?? []) as PaymentRow[];
}

async function getProfileName(env: Env, userId: string): Promise<string> {
  try {
    const result = await sbFetch<Array<{ full_name: string | null }>>(
      env,
      `/profiles?select=full_name&id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    const rows = requireSbOk(result, 'getProfileName');
    return rows?.[0]?.full_name?.trim() || 'Học viên';
  } catch {
    return 'Học viên';
  }
}

export function toOrderSummary(
  order: OrderRow,
  items: OrderItemRow[],
  couponCode: string | null,
): OrderSummary {
  return {
    id: order.id,
    referenceCode: order.reference_code,
    status: order.status,
    amountVnd: order.amount_vnd,
    originalAmountVnd: order.original_amount_vnd ?? order.amount_vnd,
    discountVnd: order.discount_vnd ?? 0,
    customAmountVnd: order.custom_amount_vnd,
    paymentMethod: order.payment_method,
    expiresAt: order.expires_at,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    couponCode,
    refundRequestedAt: order.refund_requested_at ?? null,
    refundReason: order.refund_reason ?? null,
    items: items.map((it) => ({
      id: it.id,
      itemType: it.item_type,
      courseId: it.course_id,
      planId: it.membership_plan_id,
      itemName: it.item_name,
      unitPriceVnd: it.unit_price_vnd,
      quantity: it.quantity,
      totalVnd: it.total_vnd,
    })),
    transfer:
      order.status === 'pending'
        ? {
            bankName: PAYMENT_BANK_NAME,
            accountHolder: PAYMENT_ACCOUNT_HOLDER,
            content: order.reference_code,
            amountVnd: order.amount_vnd,
          }
        : null,
  };
}

async function insertAuditLog(
  env: Env,
  input: {
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    details: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const result = await sbFetch<unknown>(env, '/audit_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_id: input.actorId,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId,
        details: input.details,
      }),
    });
    requireSbOk(result, 'insertAuditLog');
  } catch (err) {
    // Audit loi khong duoc lam hong nghiep vu chinh — chi ghi log.
    safeLog('audit log failed', { action: input.action });
    void err;
  }
}

async function insertNotification(
  env: Env,
  input: { userId: string; type: string; title: string; body: string; relatedType: string; relatedId: string },
): Promise<void> {
  try {
    const result = await sbFetch<unknown>(env, '/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        related_type: input.relatedType,
        related_id: input.relatedId,
      }),
    });
    requireSbOk(result, 'insertNotification');
  } catch {
    safeLog('notification failed', { type: input.type });
  }
}

// ---------------------------------------------------------------------------
// Tao don — buoc (2) + (3)
// ---------------------------------------------------------------------------

interface PricedOrderItem {
  itemType: 'course' | 'membership';
  courseId: string | null;
  planId: string | null;
  itemName: string;
  unitPriceVnd: number;
  quantity: number;
}

export interface CreateOrderResult {
  order: OrderSummary;
  /** true = tra lai don cu do trung Idempotency-Key (HTTP 200). */
  duplicate: boolean;
}

/**
 * Tao don hang (kem combo nhieu item, coupon, Tuy tam).
 * Gia lay tu DB; client chi gui id + ma coupon + so tien Tuy tam.
 * Don 0đ (mien phi / coupon 100% / Tuy tam 0đ) -> thanh toan ngay o
 * server (khong co payments row vi payments.amount_vnd CHECK > 0),
 * cap quyen luon. Don > 0đ -> pending, han +48h (order.expiry_hours).
 */
export async function createOrder(
  env: Env,
  userId: string,
  input: CreateOrderInput,
  idempotencyKey: string | null,
): Promise<CreateOrderResult> {
  const now = new Date();
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ApiError(400, 'invalid_input', 'Đơn hàng cần ít nhất 1 khóa học hoặc gói thành viên.');
  }
  if (input.items.length > 20) {
    throw new ApiError(400, 'invalid_input', 'Một đơn tối đa 20 dòng hàng.');
  }
  const customAmount =
    input.customAmountVnd === undefined || input.customAmountVnd === null
      ? null
      : input.customAmountVnd;
  if (customAmount !== null && (!Number.isInteger(customAmount) || customAmount < 0)) {
    throw new ApiError(400, 'invalid_input', 'Số tiền tùy tâm phải là số nguyên ≥ 0.');
  }

  // --- Idempotency: trung key -> replay / conflict (API_ARCH §4) ---
  // Key het han 24h -> xu ly nhu key moi: don moi KHONG dung lai key
  // cu (key cu van UNIQUE tren don cu) — tranh UNIQUE chan insert roi
  // roi vao nhanh race tra ve don cu (BUG B-T10-5).
  const bodyHash = await sha256Hex(canonicalOrderBody(input));
  let effectiveIdempotencyKey: string | null = idempotencyKey;
  if (idempotencyKey) {
    const existing = await getOrderByIdempotencyKey(env, idempotencyKey);
    if (existing) {
      const createdMs = new Date(existing.created_at).getTime();
      if (isIdempotencyKeyExpired(createdMs, now.getTime(), IDEMPOTENCY_TTL_MS)) {
        effectiveIdempotencyKey = null;
      } else {
        // Don cu (truoc 0019) co key nhung chua co body hash -> tra lai
        // don cu thay vi 409 (khong du du lieu de so sanh body).
        if (!existing.idempotency_body_hash) {
          const items = await getOrderItems(env, existing.id);
          const couponCode = existing.coupon_id
            ? await getCouponCodeById(env, existing.coupon_id)
            : null;
          return { order: toOrderSummary(existing, items, couponCode), duplicate: true };
        }
        const decision = decideIdempotencyReplay(
          { bodyHash: existing.idempotency_body_hash ?? '', result: existing.id },
          bodyHash,
        );
        if (decision.action === 'replay') {
          const items = await getOrderItems(env, existing.id);
          const couponCode = existing.coupon_id
            ? await getCouponCodeById(env, existing.coupon_id)
            : null;
          return { order: toOrderSummary(existing, items, couponCode), duplicate: true };
        }
        if (decision.action === 'conflict') {
          throw new ApiError(
            409,
            'idempotency_conflict',
            'Yêu cầu này đã được gửi với nội dung khác. Vui lòng tạo đơn mới.',
          );
        }
      }
    }
  }

  // --- Dinh gia tung item tu DB (khong tin gia client) ---
  const priced: PricedOrderItem[] = [];
  let onlyPayWhatYouWantCourse = input.items.length === 1;
  for (const item of input.items) {
    if (item.itemType === 'course') {
      if (!item.courseId) throw new ApiError(400, 'invalid_course', 'Thiếu mã khóa học.');
      const course = await getCourseForSale(env, item.courseId);
      if (!course || course.status !== 'published') {
        throw new ApiError(400, 'invalid_course', 'Khóa học không tồn tại hoặc chưa mở bán.');
      }
      if (!course.is_pay_what_you_want) onlyPayWhatYouWantCourse = false;
      priced.push({
        itemType: 'course',
        courseId: course.id,
        planId: null,
        itemName: course.title,
        unitPriceVnd: course.price_vnd,
        quantity: 1,
      });
    } else if (item.itemType === 'membership') {
      onlyPayWhatYouWantCourse = false;
      if (!item.planId) throw new ApiError(400, 'invalid_input', 'Thiếu mã gói thành viên.');
      const plan = await getPlanForSale(env, item.planId);
      if (!plan || !plan.is_active) {
        throw new ApiError(400, 'invalid_input', 'Gói thành viên không tồn tại hoặc đã ngừng bán.');
      }
      priced.push({
        itemType: 'membership',
        courseId: null,
        planId: plan.id,
        itemName: plan.name,
        unitPriceVnd: plan.price_vnd,
        quantity: 1,
      });
    } else {
      throw new ApiError(400, 'invalid_input', 'Loại dòng hàng không hợp lệ.');
    }
  }

  // --- Tuy tam: chi 1 khoa Tuy tam, khong dung chung coupon ---
  if (customAmount !== null) {
    if (!onlyPayWhatYouWantCourse) {
      throw new ApiError(
        400,
        'invalid_input',
        'Số tiền tùy tâm chỉ áp dụng cho khóa học Tùy tâm (1 khóa / đơn).',
      );
    }
    if (input.couponCode?.trim()) {
      throw new ApiError(400, 'invalid_input', 'Không dùng chung mã giảm giá với số tiền tùy tâm.');
    }
  }

  // --- Coupon (neu co) ---
  let coupon: CouponRow | null = null;
  let couponCode: string | null = null;
  if (input.couponCode?.trim()) {
    couponCode = input.couponCode.trim().toUpperCase();
    coupon = await getCouponByCode(env, couponCode);
    if (!coupon) throw new ApiError(400, 'invalid_input', 'Mã giảm giá không tồn tại.');
  }
  const totals = computeOrderTotals(priced, coupon, now);
  if (coupon && totals.couponReason) {
    const reasonVi: Record<string, string> = {
      coupon_inactive: 'Mã giảm giá đã ngừng áp dụng.',
      coupon_not_started: 'Mã giảm giá chưa bắt đầu.',
      coupon_expired: 'Mã giảm giá đã hết hạn.',
      coupon_used_up: 'Mã giảm giá đã hết lượt dùng.',
      min_order_not_met: `Đơn chưa đủ ${coupon.min_order_vnd.toLocaleString('vi-VN')} đ để dùng mã này.`,
      coupon_invalid_type: 'Mã giảm giá không hợp lệ.',
    };
    throw new ApiError(400, 'invalid_input', reasonVi[totals.couponReason] ?? 'Mã giảm giá không áp dụng được.');
  }
  const amountVnd = customAmount !== null ? customAmount : totals.amountVnd;
  const originalAmountVnd = customAmount !== null ? customAmount : totals.originalAmountVnd;
  const discountVnd = customAmount !== null ? 0 : totals.discountVnd;

  // --- Kiem tra da ghi danh / da co goi (don moi trung lap) ---
  for (const p of priced) {
    if (p.itemType === 'course' && p.courseId) {
      const enr = await sbFetch<Array<{ status: string }>>(
        env,
        `/enrollments?select=status&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(p.courseId)}&limit=1`,
      );
      const rows = requireSbOk(enr, 'checkExistingEnrollment');
      if (rows && rows.length > 0 && (rows[0] as { status: string }).status === 'active') {
        throw new ApiError(409, 'conflict', `Bạn đã ghi danh khóa “${p.itemName}” rồi.`);
      }
    }
  }

  // --- Ghi don (reference_code sinh tu DB — generate_order_reference) ---
  const expiryHours = await getSystemSettingNumber(
    env,
    'order.expiry_hours',
    DEFAULT_ORDER_EXPIRY_HOURS,
  );
  const expiresAt =
    amountVnd > 0 ? new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString() : null;
  const firstCourseId = priced.find((p) => p.itemType === 'course')?.courseId ?? null;
  const insertBody: Record<string, unknown> = {
    user_id: userId,
    course_id: firstCourseId,
    coupon_id: coupon?.id ?? null,
    amount_vnd: amountVnd,
    original_amount_vnd: originalAmountVnd,
    discount_vnd: discountVnd,
    custom_amount_vnd: customAmount,
    status: amountVnd === 0 ? 'paid' : 'pending',
    payment_method: amountVnd === 0 ? 'free' : 'bank_transfer',
    expires_at: expiresAt,
    paid_at: amountVnd === 0 ? now.toISOString() : null,
    idempotency_key: effectiveIdempotencyKey,
    idempotency_body_hash: bodyHash,
  };
  const inserted = await sbFetch<OrderRow[]>(env, '/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(insertBody),
  });
  if (inserted.error) {
    if (isUniqueViolation(inserted.error)) {
      // Race: 2 request cung key cung luc — doc lai don vua tao.
      // Chi ap dung khi don moi co mang key (key het han thi don moi
      // khong mang key nen UNIQUE khong the den tu key).
      if (effectiveIdempotencyKey) {
        const again = await getOrderByIdempotencyKey(env, effectiveIdempotencyKey);
        if (again) {
          const items = await getOrderItems(env, again.id);
          return { order: toOrderSummary(again, items, couponCode), duplicate: true };
        }
      }
      throw new ApiError(409, 'conflict', 'Đơn hàng đã tồn tại. Vui lòng kiểm tra lại đơn hàng của bạn.');
    }
    throw serverError(`insertOrder: ${inserted.error.message}`);
  }
  const orderRows = requireSbOk(inserted, 'insertOrder');
  const order = orderRows?.[0] as OrderRow | undefined;
  if (!order) throw serverError('insertOrder: no row returned');

  const itemRows = await sbFetch<OrderItemRow[]>(env, '/order_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(
      priced.map((p) => ({
        order_id: order.id,
        item_type: p.itemType,
        course_id: p.courseId,
        membership_plan_id: p.planId,
        // Cot cu giu lai tu 0004 (NOT NULL, khong default) — 0019 them
        // item_name/unit_price_vnd/... nhung KHONG bo title_snapshot /
        // amount_vnd. Thieu 2 cot nay PostgREST tra 23502 -> Worker
        // map thanh 502 (bug tao don 11/11/2026: 2 don mo coi
        // DH-2026-000001/000002, 0 order_items).
        title_snapshot: p.itemName,
        amount_vnd: p.unitPriceVnd * p.quantity,
        item_name: p.itemName,
        unit_price_vnd: p.unitPriceVnd,
        quantity: p.quantity,
        total_vnd: p.unitPriceVnd * p.quantity,
      })),
    ),
  });
  const createdItems = (requireSbOk(itemRows, 'insertOrderItems') ?? []) as OrderItemRow[];

  await insertAuditLog(env, {
    actorId: userId,
    action: 'order.create',
    targetType: 'order',
    targetId: order.id,
    details: {
      reference_code: order.reference_code,
      amount_vnd: amountVnd,
      items: priced.map((p) => ({ type: p.itemType, name: p.itemName })),
      coupon_code: couponCode,
    },
  });

  // --- Don 0đ: cap quyen ngay o server (khong qua payments) ---
  if (amountVnd === 0) {
    await grantAccessForOrder(env, order, createdItems, {
      actorId: userId,
      auditAction: 'order.free_fulfilled',
    });
    if (coupon) await applyCouponUse(env, coupon.id);
  } else {
    await insertNotification(env, {
      userId,
      type: 'order_created',
      title: 'Đơn hàng đã được tạo',
      body: `Đơn ${order.reference_code} — ${amountVnd.toLocaleString('vi-VN')} đ. Vui lòng chuyển khoản trong ${expiryHours} giờ.`,
      relatedType: 'order',
      relatedId: order.id,
    });
  }

  return { order: toOrderSummary(order, createdItems, couponCode), duplicate: false };
}

export async function getCouponCodeById(env: Env, couponId: string): Promise<string | null> {
  const result = await sbFetch<Array<{ code: string }>>(
    env,
    `/coupons?select=code&id=eq.${encodeURIComponent(couponId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getCouponCodeById');
  return rows?.[0]?.code ?? null;
}

async function applyCouponUse(env: Env, couponId: string): Promise<void> {
  try {
    const result = await sbFetch<boolean>(env, '/rpc/apply_coupon_use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_coupon_id: couponId }),
    });
    requireSbOk(result, 'applyCouponUse');
  } catch {
    safeLog('applyCouponUse failed', { couponId });
  }
}

async function releaseCouponUse(env: Env, couponId: string): Promise<void> {
  try {
    const result = await sbFetch<boolean>(env, '/rpc/release_coupon_use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_coupon_id: couponId }),
    });
    requireSbOk(result, 'releaseCouponUse');
  } catch {
    safeLog('releaseCouponUse failed', { couponId });
  }
}

// ---------------------------------------------------------------------------
// Cap quyen hoc — buoc (10). CHI goi sau khi don da paid (xac minh).
// ---------------------------------------------------------------------------

export interface GrantAccessOptions {
  actorId: string | null;
  auditAction: string;
}

/**
 * Tao enrollment cho moi khoa trong don + membership cho moi goi.
 * Idempotent: enrollment upsert theo UNIQUE(user_id, course_id);
 * membership ton tai thi gia han ends_at thay vi tao moi.
 * Goi kem khoa cua goi (membership_plans.course_id) cung duoc mo.
 */
export async function grantAccessForOrder(
  env: Env,
  order: OrderRow,
  items: OrderItemRow[],
  opts: GrantAccessOptions,
): Promise<void> {
  const userId = order.user_id;
  if (!userId) throw serverError('grantAccessForOrder: order has no user');
  const nowIso = new Date().toISOString();

  for (const item of items) {
    if (item.item_type === 'course' && item.course_id) {
      const result = await sbFetch<unknown>(
        env,
        '/enrollments?on_conflict=user_id,course_id',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            user_id: userId,
            course_id: item.course_id,
            order_id: order.id,
            status: 'active',
            enrolled_at: nowIso,
          }),
        },
      );
      if (result.error) throw serverError(`grantEnrollment: ${result.error.message}`);
    } else if (item.item_type === 'membership' && item.membership_plan_id) {
      const plan = await getPlanForSale(env, item.membership_plan_id);
      const endsAt =
        plan?.duration_days && plan.duration_days > 0
          ? new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString()
          : null;
      // Gia han neu da co goi active; neu khong thi tao moi.
      const existing = await sbFetch<Array<{ id: string; ends_at: string | null }>>(
        env,
        `/memberships?select=id,ends_at&user_id=eq.${encodeURIComponent(userId)}&plan_id=eq.${encodeURIComponent(item.membership_plan_id)}&status=eq.active&limit=1`,
      );
      const rows = requireSbOk(existing, 'getActiveMembership');
      if (rows && rows.length > 0) {
        const base = rows[0]?.ends_at ? new Date(rows[0].ends_at as string).getTime() : Date.now();
        const nextEnds =
          plan?.duration_days && plan.duration_days > 0
            ? new Date(base + plan.duration_days * 24 * 60 * 60 * 1000).toISOString()
            : null;
        const patched = await sbFetch<unknown>(
          env,
          `/memberships?id=eq.${encodeURIComponent((rows[0] as { id: string }).id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ ends_at: nextEnds, order_id: order.id }),
          },
        );
        if (patched.error) throw serverError(`extendMembership: ${patched.error.message}`);
      } else {
        const created = await sbFetch<unknown>(env, '/memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            user_id: userId,
            plan_id: item.membership_plan_id,
            order_id: order.id,
            status: 'active',
            started_at: nowIso,
            ends_at: endsAt,
          }),
        });
        if (created.error) throw serverError(`createMembership: ${created.error.message}`);
      }
      // Goi kem khoa -> mo enrollment khoa do.
      if (plan?.course_id) {
        const result = await sbFetch<unknown>(
          env,
          '/enrollments?on_conflict=user_id,course_id',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              user_id: userId,
              course_id: plan.course_id,
              order_id: order.id,
              status: 'active',
              enrolled_at: nowIso,
            }),
          },
        );
        if (result.error) throw serverError(`grantPlanCourse: ${result.error.message}`);
      }
    }
  }

  await insertAuditLog(env, {
    actorId: opts.actorId,
    action: opts.auditAction,
    targetType: 'order',
    targetId: order.id,
    details: { reference_code: order.reference_code, user_id: userId },
  });
}

/**
 * Gui email xac nhan thanh toan (mau E4 — Task 11) + notification.
 * Best-effort: loi email KHONG lam hong don da paid (ghi log de R8
 * doi soat). Khong gui khi thieu email nguoi nhan.
 */
async function notifyOrderPaid(env: Env, order: OrderRow, items: OrderItemRow[]): Promise<void> {
  if (!order.user_id) return;
  const profile = await getProfileEmail(env, order.user_id);
  const name = await getProfileName(env, order.user_id);
  await insertNotification(env, {
    userId: order.user_id,
    type: 'order_paid',
    title: 'Đã nhận thanh toán',
    body: `Đơn ${order.reference_code} đã thanh toán — bạn có thể bắt đầu học ngay.`,
    relatedType: 'order',
    relatedId: order.id,
  });
  if (!profile?.email) {
    safeLog('order-paid email skipped: no recipient email', { referenceCode: order.reference_code });
    return;
  }
  const firstName = items[0]?.item_name ?? 'khóa học';
  const courseTitle =
    items.length > 1 ? `${firstName} (+${items.length - 1} mục)` : firstName;
  try {
    await sendTemplatedEmail(
      env,
      { apiKey: env.RESEND_API_KEY ?? '', from: env.RESEND_FROM_EMAIL ?? env.RESEND_FROM ?? '' },
      {
        to: profile.email,
        template: 'E4',
        data: {
          studentName: name,
          courseTitle,
          orderReference: order.reference_code,
          amountVnd: order.amount_vnd,
          paidAt: order.paid_at ?? undefined,
        },
        relatedType: 'order',
        relatedId: order.id,
      },
    );
  } catch (err) {
    safeLog('order-paid email failed', {
      referenceCode: order.reference_code,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}

// ---------------------------------------------------------------------------
// Email cap quyen hoc (E5) — Task 11, rule san runPaymentVerifiedAccess.
// Goi SAU grantAccessForOrder (enrollment da ton tai — rule tu kiem tra
// enrollment qua getEnrollmentByOrder; chua co enrollment thi rule bo
// qua, khong gui link vao khoa chua co quyen). KHONG BAO GIO throw:
// loi o bat ky buoc nao chi ghi log + dem vao ket qua — luong xac
// nhan thanh toan (confirmPayment) khong duoc hong vi email.
//   Luu y trung thuc: rule chong gui trung theo (nguoi nhan + mau E5 +
//   related_id = orderId) trong ngay — don co NHIEU khoa thi khoa thu
//   2 tro di se bi rule tra 'skipped' (duplicate). Don thuong chi co
//   1 khoa; neu sau nay don combo pho bien thi doi related_id cua rule
//   sang enrollment truoc khi doi ham nay.
// ---------------------------------------------------------------------------

export interface EnrollmentGrantedNotifyResult {
  /** So khoa duy nhat trong don (ke ca khoa kem theo goi membership). */
  courses: number;
  sent: number;
  skipped: number;
  failed: number;
  outcome: 'sent' | 'partial' | 'skipped' | 'failed' | 'no_email' | 'not_configured' | 'no_course' | 'no_user';
}

export interface EnrollmentGrantedNotifyDeps {
  runRuleFn?: typeof runPaymentVerifiedAccess;
  getCourseMetaFn?: typeof getCourseMeta;
  getProfileEmailFn?: typeof getProfileEmail;
  getProfileNameFn?: typeof getProfileName;
  getPlanFn?: typeof getPlanForSale;
  /** Tao AutomationDeps (store + mailer) — chi dung trong test. */
  createDepsFn?: (env: Env) => AutomationDeps;
}

function defaultAutomationDeps(env: Env): AutomationDeps {
  return {
    store: createSupabaseAutomationStore(env),
    mailer: createResendMailerFromEnv(env),
  };
}

export async function notifyEnrollmentGranted(
  env: Env,
  order: OrderRow,
  items: OrderItemRow[],
  deps: EnrollmentGrantedNotifyDeps = {},
): Promise<EnrollmentGrantedNotifyResult> {
  const none = (outcome: EnrollmentGrantedNotifyResult['outcome']): EnrollmentGrantedNotifyResult =>
    ({ courses: 0, sent: 0, skipped: 0, failed: 0, outcome });
  try {
    if (!order.user_id) return none('no_user');
    const getPlanFn = deps.getPlanFn ?? getPlanForSale;
    const courseIds: string[] = [];
    for (const item of items) {
      if (item.item_type === 'course' && item.course_id) {
        if (!courseIds.includes(item.course_id)) courseIds.push(item.course_id);
      } else if (item.item_type === 'membership' && item.membership_plan_id) {
        // Goi kem khoa -> enrollment khoa do cung da mo o grantAccessForOrder.
        const plan = await getPlanFn(env, item.membership_plan_id);
        if (plan?.course_id && !courseIds.includes(plan.course_id)) courseIds.push(plan.course_id);
      }
    }
    if (courseIds.length === 0) return none('no_course');

    const getProfileEmailFn = deps.getProfileEmailFn ?? getProfileEmail;
    const getProfileNameFn = deps.getProfileNameFn ?? getProfileName;
    const profile = await getProfileEmailFn(env, order.user_id);
    const toEmail = profile?.email ?? null;
    if (!toEmail) {
      safeLog('enrollment email skipped: no recipient email', { referenceCode: order.reference_code });
      return { courses: courseIds.length, sent: 0, skipped: 0, failed: 0, outcome: 'no_email' };
    }
    const apiKey = (env.RESEND_API_KEY ?? '').trim();
    const from = (env.RESEND_FROM_EMAIL ?? env.RESEND_FROM ?? '').trim();
    if (!apiKey || !from) {
      safeLog('enrollment email skipped: resend not configured', { referenceCode: order.reference_code });
      return { courses: courseIds.length, sent: 0, skipped: 0, failed: 0, outcome: 'not_configured' };
    }
    let automationDeps: AutomationDeps;
    try {
      automationDeps = deps.createDepsFn ? deps.createDepsFn(env) : defaultAutomationDeps(env);
    } catch {
      return { courses: courseIds.length, sent: 0, skipped: 0, failed: 0, outcome: 'not_configured' };
    }

    const fullName = (await getProfileNameFn(env, order.user_id)) || toEmail;
    const getCourseMetaFn = deps.getCourseMetaFn ?? getCourseMeta;
    const runRule = deps.runRuleFn ?? runPaymentVerifiedAccess;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const courseId of courseIds) {
      try {
        const meta = await getCourseMetaFn(env, courseId);
        if (!meta?.slug) {
          failed += 1;
          safeLog('enrollment email failed: course not found', { referenceCode: order.reference_code, courseId });
          continue;
        }
        const result = await runRule(
          {
            userId: order.user_id,
            email: toEmail,
            fullName,
            orderId: order.id,
            orderReferenceCode: order.reference_code,
            courseId,
            courseSlug: meta.slug,
            courseTitle: meta.title ?? 'Khóa học',
            amountVnd: order.amount_vnd,
            paymentStatus: 'succeeded',
          },
          automationDeps,
          new Date(),
        );
        if (result.outcome === 'sent') sent += 1;
        else if (result.outcome === 'skipped') skipped += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        safeLog('enrollment email failed', {
          referenceCode: order.reference_code,
          courseId,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
    const outcome: EnrollmentGrantedNotifyResult['outcome'] =
      sent > 0 && failed === 0 ? 'sent' : sent > 0 ? 'partial' : skipped > 0 ? 'skipped' : 'failed';
    return { courses: courseIds.length, sent, skipped, failed, outcome };
  } catch (err) {
    // Khong bao gio de loi mail lam hong confirmPayment.
    safeLog('enrollment email failed', {
      referenceCode: order.reference_code,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return none('failed');
  }
}

// ---------------------------------------------------------------------------
// Xac nhan thanh toan — buoc (9) + (10) + (11). Dung chung cho webhook
// SePay (verified = chu ky dung) va admin mark-paid (verified = admin).
// ---------------------------------------------------------------------------

export interface ConfirmPaymentInput {
  method: 'sepay' | 'bank_transfer';
  amountVnd: number;
  /** Ma giao dich cong / ma giao dich ngan hang (chong trung). */
  gatewayReference: string | null;
  /** Payload goc (khong chua secret) — luu de doi soat. */
  gatewayPayload: Record<string, unknown> | null;
  /** Admin xac nhan thu cong (null khi la webhook). */
  verifiedBy: string | null;
  /** 'sepay_webhook' | 'admin_mark_paid'. */
  source: string;
}

export interface ConfirmPaymentResult {
  order: OrderSummary;
  /** true = payment/fulfillment da ton tai truoc (webhook gui lai). */
  duplicate: boolean;
}

export async function confirmPayment(
  env: Env,
  order: OrderRow,
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const now = new Date();
  // Don da paid truoc do -> webhook gui lai: khong cap quyen 2 lan.
  if (order.status === 'paid') {
    const items = await getOrderItems(env, order.id);
    const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
    return { order: toOrderSummary(order, items, couponCode), duplicate: true };
  }
  if (order.status !== 'pending') {
    throw new ApiError(409, 'conflict', `Đơn ${order.reference_code} đang ở trạng thái ${order.status}, không thể xác nhận thanh toán.`);
  }

  // Buoc (7): so tien phai khop tuyet doi.
  const amountCheck = checkPaymentAmount(order.amount_vnd, input.amountVnd);
  if (!amountCheck.ok) {
    // Ghi payments 'failed' de doi soat R9 (neu co ma giao dich).
    if (input.gatewayReference) {
      await sbFetch<unknown>(env, '/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          order_id: order.id,
          amount_vnd: input.amountVnd,
          method: input.method,
          gateway_reference: input.gatewayReference,
          gateway_payload: input.gatewayPayload,
          status: 'failed',
          verified_by: input.verifiedBy,
        }),
      });
    }
    await insertAuditLog(env, {
      actorId: input.verifiedBy,
      action: 'order.payment_mismatch',
      targetType: 'order',
      targetId: order.id,
      details: {
        reference_code: order.reference_code,
        expected_vnd: order.amount_vnd,
        received_vnd: input.amountVnd,
        diff_vnd: amountCheck.diffVnd,
        source: input.source,
      },
    });
    throw new ApiError(
      422,
      'payment_mismatch',
      `Số tiền nhận được (${input.amountVnd.toLocaleString('vi-VN')} đ) không khớp số tiền đơn (${order.amount_vnd.toLocaleString('vi-VN')} đ). Vui lòng liên hệ hỗ trợ.`,
    );
  }

  // Buoc (8): chong trung theo UNIQUE (method, gateway_reference).
  const existingPayments = await getPaymentsByOrder(env, order.id);
  const dup = findDuplicatePayment(
    existingPayments.map((p) => ({ method: p.method, gatewayReference: p.gateway_reference })),
    input.method,
    input.gatewayReference,
  );
  if (dup) {
    const items = await getOrderItems(env, order.id);
    const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
    const fresh = (await getOrderById(env, order.id)) ?? order;
    return { order: toOrderSummary(fresh, items, couponCode), duplicate: true };
  }

  // Buoc (9): ghi payments succeeded + don paid.
  const inserted = await sbFetch<PaymentRow[]>(env, '/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      order_id: order.id,
      amount_vnd: input.amountVnd,
      method: input.method,
      gateway_reference: input.gatewayReference,
      gateway_payload: input.gatewayPayload,
      status: 'succeeded',
      paid_at: now.toISOString(),
      verified_by: input.verifiedBy,
    }),
  });
  if (inserted.error) {
    if (isUniqueViolation(inserted.error)) {
      // Race voi webhook gui song song — doc lai, khong tao trung.
      const fresh = (await getOrderById(env, order.id)) ?? order;
      const items = await getOrderItems(env, order.id);
      const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
      return { order: toOrderSummary(fresh, items, couponCode), duplicate: true };
    }
    throw serverError(`insertPayment: ${inserted.error.message}`);
  }
  const paymentRows = requireSbOk(inserted, 'insertPayment');
  const payment = paymentRows?.[0] as PaymentRow | undefined;
  if (!payment) throw serverError('insertPayment: no row returned');

  const updated = await sbFetch<OrderRow[]>(env, `/orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'paid', paid_at: now.toISOString() }),
  });
  const updatedRows = requireSbOk(updated, 'updateOrderPaid');
  const paidOrder = (updatedRows?.[0] as OrderRow | undefined) ?? { ...order, status: 'paid', paid_at: now.toISOString() };

  // Buoc (10): cap quyen — chi khi du 3 dieu kien (da paid + succeeded
  // + verified). verified o day = webhook da xac minh chu ky hoac admin.
  const items = await getOrderItems(env, order.id);
  if (
    !canGrantEnrollment({ orderStatus: paidOrder.status, paymentStatus: payment.status, verified: true })
  ) {
    throw serverError('confirmPayment: grant gate failed');
  }
  await grantAccessForOrder(env, paidOrder, items, {
    actorId: input.verifiedBy,
    auditAction: input.source === 'admin_mark_paid' ? 'order.mark_paid' : 'order.paid',
  });
  if (paidOrder.coupon_id) await applyCouponUse(env, paidOrder.coupon_id);

  // Hoa hong gioi thieu (0023 — referrals.ts): 10% * amount_vnd cho
  // referrer neu nguoi mua duoc gioi thieu; idempotent theo don.
  // Best-effort (khong bao gio throw): don da paid khong duoc hong
  // vi hoa hong. Don 0đ khong sinh hoa hong (amount <= 0 -> bo qua).
  await recordReferralCommission(env, paidOrder);

  // Buoc (11): email + notification (best-effort). E4: xac nhan thanh
  // toan (notifyOrderPaid). E5: cap quyen hoc (notifyEnrollmentGranted
  // — Task 11). Ca 2 deu khong bao gio throw; loi chi ghi log.
  await notifyOrderPaid(env, paidOrder, items);
  await notifyEnrollmentGranted(env, paidOrder, items);

  const couponCode = paidOrder.coupon_id ? await getCouponCodeById(env, paidOrder.coupon_id) : null;
  return { order: toOrderSummary(paidOrder, items, couponCode), duplicate: false };
}

// ---------------------------------------------------------------------------
// Webhook SePay — buoc (5) -> (11). Xu ly o handlers/payments.ts goi ham
// nay sau khi doc raw body. Tra ve {httpStatus, body} de handler tra.
// ---------------------------------------------------------------------------

export interface SepayWebhookOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
}

/**
 * Xu ly 1 webhook SePay (raw body + signature header da doc).
 * - Chu ky sai / thieu secret -> 401, khong xu ly, khong ghi DB.
 * - Khong tim thay don theo ma -> 200 {matched:false} (da nhan, de
 *   SePay khong retry vo han) + audit de R9 doi soat.
 * - So tien lech -> 200 {ok:false, error:'payment_mismatch'} + ghi
 *   payments 'failed' + audit (khong retry vo han vi lech tien la
 *   loi vinh vien, admin xu ly tay).
 * - Thanh cong / gui lai -> 200 {ok:true, duplicate?}.
 */
export async function processSepayWebhook(
  env: Env,
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null = null,
): Promise<SepayWebhookOutcome> {
  // Chu ky SePay: HMAC-SHA256("{timestamp}.{raw_body}") + chong replay
  // 5 phut (SEPAY_INTEGRATION.md §4.2). Sai/thieu -> 401, khong ghi DB.
  const verified = await verifySepayWebhookSignature(
    rawBody,
    signatureHeader,
    env.SEPAY_WEBHOOK_SECRET,
    timestampHeader,
  );
  if (!verified) {
    safeLog('sepay webhook rejected: bad signature', {});
    return { httpStatus: 401, body: { ok: false, error: 'unauthorized', message: 'Chữ ký webhook không hợp lệ.' } };
  }

  let payload: unknown = null;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    return { httpStatus: 400, body: { ok: false, error: 'invalid_input', message: 'Webhook body không phải JSON hợp lệ.' } };
  }
  const tx: SepayTransaction = parseSepayPayload(payload);
  // Chi xu ly tien VAO ('in'). Webhook tien RA ('out') — webhook
  // Visfar chi dang ky su kien "Co tien vao", nhung neu SePay gui
  // nham thi bo qua, van tra 200 success:true de SePay khong retry.
  if (tx.transferType !== null && tx.transferType !== 'in') {
    return {
      httpStatus: 200,
      body: { success: true, ok: true, matched: false, ignored: 'transfer_out', message: 'Đã nhận webhook nhưng không phải giao dịch tiền vào.' },
    };
  }
  if (!tx.referenceCode) {
    await insertAuditLog(env, {
      actorId: null,
      action: 'order.webhook_unmatched',
      targetType: 'order',
      targetId: null,
      details: { gateway_reference: tx.gatewayReference, amount_vnd: tx.amountVnd, content: tx.content },
    });
    // Tra 200 + success:true cho SePay (da nhan; gui lai cung vo ich
    // vi don khong ton tai) — xu ly tay qua doi soat R9.
    return { httpStatus: 200, body: { success: true, ok: true, matched: false, message: 'Đã nhận webhook nhưng không tìm thấy mã đơn trong nội dung chuyển khoản.' } };
  }
  const order = await getOrderByReference(env, tx.referenceCode);
  if (!order) {
    await insertAuditLog(env, {
      actorId: null,
      action: 'order.webhook_unmatched',
      targetType: 'order',
      targetId: null,
      details: { reference_code: tx.referenceCode, gateway_reference: tx.gatewayReference, amount_vnd: tx.amountVnd },
    });
    return { httpStatus: 200, body: { success: true, ok: true, matched: false, message: `Đã nhận webhook nhưng không tìm thấy đơn ${tx.referenceCode}.` } };
  }
  if (tx.amountVnd === null) {
    // Ghi audit de doi soat (R9) — truoc day nhanh nay tra 200 ma
    // khong de lai dau vet nao (phat hien 5.4(b) bao cao TASK10).
    await insertAuditLog(env, {
      actorId: null,
      action: 'order.payment_mismatch',
      targetType: 'order',
      targetId: order.id,
      details: {
        reference_code: tx.referenceCode,
        gateway_reference: tx.gatewayReference,
        reason: 'webhook_thieu_so_tien',
      },
    });
    return { httpStatus: 200, body: { success: true, ok: false, error: 'payment_mismatch', message: 'Webhook thiếu số tiền giao dịch.' } };
  }
  try {
    const result = await confirmPayment(env, order, {
      method: 'sepay',
      amountVnd: tx.amountVnd,
      gatewayReference: tx.gatewayReference,
      gatewayPayload: (payload ?? {}) as Record<string, unknown>,
      verifiedBy: null,
      source: 'sepay_webhook',
    });
    return {
      httpStatus: 200,
      body: {
        success: true,
        ok: true,
        matched: true,
        duplicate: result.duplicate,
        referenceCode: result.order.referenceCode,
        status: result.order.status,
      },
    };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'payment_mismatch') {
      // Da ghi nhan de xu ly tay (R9) — van tra 200 + success:true
      // cho SePay de khong retry vo ich trong 33 phut
      // (SEPAY_INTEGRATION.md §4.4).
      return { httpStatus: 200, body: { success: true, ok: false, error: 'payment_mismatch', message: err.message } };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Huy don / het han / hoan tra
// ---------------------------------------------------------------------------

export async function cancelOrder(env: Env, userId: string, orderId: string): Promise<OrderSummary> {
  const order = await getOrderById(env, orderId);
  if (!order || order.user_id !== userId) {
    throw new ApiError(404, 'not_found', 'Không tìm thấy đơn hàng.');
  }
  if (order.status !== 'pending') {
    throw new ApiError(409, 'conflict', `Đơn đang ở trạng thái ${order.status}, không thể hủy.`);
  }
  const updated = await sbFetch<OrderRow[]>(env, `/orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const rows = requireSbOk(updated, 'cancelOrder');
  const cancelled = (rows?.[0] as OrderRow | undefined) ?? { ...order, status: 'cancelled' };
  await insertAuditLog(env, {
    actorId: userId,
    action: 'order.cancel',
    targetType: 'order',
    targetId: order.id,
    details: { reference_code: order.reference_code },
  });
  const items = await getOrderItems(env, order.id);
  const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
  return toOrderSummary(cancelled, items, couponCode);
}

/** Quet don pending qua han -> expired (admin chay tay / cron). */
export async function expirePendingOrders(env: Env, adminId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const result = await sbFetch<OrderRow[]>(
    env,
    `/orders?select=id,reference_code&status=eq.pending&expires_at=lt.${encodeURIComponent(nowIso)}&limit=100`,
  );
  const rows = (requireSbOk(result, 'expirePendingOrders') ?? []) as OrderRow[];
  let count = 0;
  for (const row of rows) {
    const updated = await sbFetch<unknown>(env, `/orders?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'expired' }),
    });
    if (!updated.error) {
      count += 1;
      await insertAuditLog(env, {
        actorId: adminId,
        action: 'order.expired',
        targetType: 'order',
        targetId: row.id,
        details: { reference_code: row.reference_code },
      });
    }
  }
  return count;
}

export interface RefundExecutionInput {
  reason: string;
  /** Ma giao dich hoan khoan (admin chuyen khoan lai bang MB Bank). */
  refundBankReference: string;
  /** Ly do vuot han 15 ngay lam viec (neu co) — ghi vao audit log. */
  forceReason?: string | null;
}

/**
 * HOAN TIEN — xu ly THU CONG qua admin (khong goi API hoan tien SePay):
 *   1. Admin chuyen khoan lai cho hoc vien bang app ngan hang (MB Bank).
 *   2. Admin nhap ma giao dich hoan (refundBankReference) vao endpoint
 *      nay -> he thong ghi payments 'refunded' + don 'refunded' +
 *      thu hoi enrollment/membership/chung chi + giam luot dung coupon
 *      + audit log. Khong co buoc nao goi SePay o day.
 *   Neu SEPAY_INTEGRATION.md sau nay xac nhan SePay co API hoan tien
 *   thi them buoc goi API do truoc buoc ghi payments (chi doi
 *   refundBankReference thanh ma giao dich SePay tra ve).
 */
export async function executeRefund(
  env: Env,
  order: OrderRow,
  adminId: string,
  input: RefundExecutionInput,
): Promise<OrderSummary> {
  if (order.status !== 'paid') {
    throw new ApiError(409, 'conflict', `Chỉ hoàn trả đơn đã thanh toán (đơn đang ở trạng thái ${order.status}).`);
  }
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, 'invalid_input', 'Vui lòng nhập lý do hoàn trả.');
  if (reason.length > 500) throw new ApiError(400, 'invalid_input', 'Lý do hoàn trả tối đa 500 ký tự.');
  if (!input.refundBankReference.trim()) {
    throw new ApiError(400, 'invalid_input', 'Vui lòng nhập mã giao dịch hoàn khoản (admin đã chuyển khoản lại cho học viên).');
  }
  const now = new Date();
  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date(order.created_at);
  const workingDays = await getSystemSettingNumber(env, 'refund.working_days', DEFAULT_REFUND_WORKING_DAYS);
  const inWindow = isRefundRequestInWindow(paidAt, now, workingDays);
  if (!inWindow && !input.forceReason?.trim()) {
    throw new ApiError(
      422,
      'invalid_input',
      `Đơn đã quá hạn hoàn trả (${workingDays} ngày làm việc kể từ ngày thanh toán). Cần ghi rõ lý do vượt hạn để hoàn trả.`,
    );
  }

  const items = await getOrderItems(env, order.id);
  const nowIso = now.toISOString();

  // Ghi payments 'refunded' (khong sua dong 'succeeded' cu). Don 0đ
  // khong co payments goc (CHECK amount > 0) -> bo qua buoc nay.
  const payments = await getPaymentsByOrder(env, order.id);
  const originalMethod = payments.find((p) => p.status === 'succeeded')?.method ?? 'bank_transfer';
  if (order.amount_vnd > 0) {
    const refundPayment = await sbFetch<unknown>(env, '/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        order_id: order.id,
        amount_vnd: order.amount_vnd,
        method: originalMethod,
        gateway_reference: input.refundBankReference.trim(),
        gateway_payload: { refund_reason: reason, manual: true },
        status: 'refunded',
        paid_at: nowIso,
        verified_by: adminId,
      }),
    });
    if (refundPayment.error && !isUniqueViolation(refundPayment.error)) {
      throw serverError(`insertRefundPayment: ${refundPayment.error.message}`);
    }
  }

  const updated = await sbFetch<OrderRow[]>(env, `/orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'refunded',
      refund_reason: reason,
      refunded_at: nowIso,
      refund_bank_reference: input.refundBankReference.trim(),
    }),
  });
  const rows = requireSbOk(updated, 'updateOrderRefunded');
  const refunded = (rows?.[0] as OrderRow | undefined) ?? { ...order, status: 'refunded' };

  // Thu hoi quyen hoc + goi + chung chi (shouldRevokeEnrollment).
  if (shouldRevokeEnrollment(refunded.status) && order.user_id) {
    for (const item of items) {
      if (item.item_type === 'course' && item.course_id) {
        await sbFetch<unknown>(
          env,
          `/enrollments?user_id=eq.${encodeURIComponent(order.user_id)}&course_id=eq.${encodeURIComponent(item.course_id)}&order_id=eq.${encodeURIComponent(order.id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'revoked' }),
          },
        );
        await sbFetch<unknown>(
          env,
          `/certificates?user_id=eq.${encodeURIComponent(order.user_id)}&course_id=eq.${encodeURIComponent(item.course_id)}&status=eq.valid`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({
              status: 'revoked',
              revoked_at: nowIso,
              revoked_by: adminId,
              revoked_reason: `Hoàn trả đơn ${order.reference_code}: ${reason}`,
            }),
          },
        );
      } else if (item.item_type === 'membership' && item.membership_plan_id) {
        // Chi doi status (bang memberships that — 0004 — KHONG co cot
        // cancelled_at; ghi cot do se loi PGRST204. Trang thai
        // 'cancelled' + ends_at goc la du de doi soat).
        await sbFetch<unknown>(
          env,
          `/memberships?user_id=eq.${encodeURIComponent(order.user_id)}&plan_id=eq.${encodeURIComponent(item.membership_plan_id)}&order_id=eq.${encodeURIComponent(order.id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'cancelled' }),
          },
        );
      }
    }
    if (order.coupon_id) await releaseCouponUse(env, order.coupon_id);
    await insertNotification(env, {
      userId: order.user_id,
      type: 'order_refunded',
      title: 'Đơn hàng đã được hoàn trả',
      // Noi dung theo dung truong hop: trong han thi ghi han 15 ngay
      // lam viec; qua han (forceReason) thi ghi ro la hoan ngoai han
      // theo quyet dinh quan tri (phat hien 5.4(f) bao cao TASK10).
      body: inWindow
        ? `Đơn ${order.reference_code} đã hoàn trả ${order.amount_vnd.toLocaleString('vi-VN')} đ trong ${workingDays} ngày làm việc.`
        : `Đơn ${order.reference_code} đã hoàn trả ${order.amount_vnd.toLocaleString('vi-VN')} đ (hoàn trả ngoài hạn ${workingDays} ngày làm việc theo quyết định của quản trị viên).`,
      relatedType: 'order',
      relatedId: order.id,
    });
  }

  await insertAuditLog(env, {
    actorId: adminId,
    action: 'order.refund',
    targetType: 'order',
    targetId: order.id,
    details: {
      reference_code: order.reference_code,
      amount_vnd: order.amount_vnd,
      refund_reason: reason,
      refund_bank_reference: input.refundBankReference.trim(),
      in_refund_window: inWindow,
      force_reason: input.forceReason?.trim() || null,
    },
  });

  const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
  return toOrderSummary(refunded, items, couponCode);
}

/** Hoc vien yeu cau hoan tra (chi ghi nhan — admin moi thuc hien). */
export async function requestRefund(
  env: Env,
  userId: string,
  orderId: string,
  reason: string,
): Promise<OrderSummary> {
  const order = await getOrderById(env, orderId);
  if (!order || order.user_id !== userId) {
    throw new ApiError(404, 'not_found', 'Không tìm thấy đơn hàng.');
  }
  if (order.status !== 'paid') {
    throw new ApiError(409, 'conflict', 'Chỉ yêu cầu hoàn trả đơn đã thanh toán.');
  }
  if (order.refund_requested_at) {
    throw new ApiError(409, 'conflict', 'Bạn đã gửi yêu cầu hoàn trả cho đơn này rồi.');
  }
  const trimmed = reason.trim();
  if (!trimmed) throw new ApiError(400, 'invalid_input', 'Vui lòng nhập lý do hoàn trả.');
  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date(order.created_at);
  const workingDays = await getSystemSettingNumber(env, 'refund.working_days', DEFAULT_REFUND_WORKING_DAYS);
  if (!isRefundRequestInWindow(paidAt, new Date(), workingDays)) {
    throw new ApiError(
      422,
      'invalid_input',
      `Đơn đã quá hạn hoàn trả (${workingDays} ngày làm việc kể từ ngày thanh toán). Vui lòng liên hệ hỗ trợ.`,
    );
  }
  const updated = await sbFetch<OrderRow[]>(env, `/orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ refund_reason: trimmed, refund_requested_at: new Date().toISOString() }),
  });
  const rows = requireSbOk(updated, 'requestRefund');
  const changed = (rows?.[0] as OrderRow | undefined) ?? order;
  await insertAuditLog(env, {
    actorId: userId,
    action: 'order.refund_requested',
    targetType: 'order',
    targetId: order.id,
    details: { reference_code: order.reference_code, refund_reason: trimmed },
  });
  const items = await getOrderItems(env, order.id);
  const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
  return toOrderSummary(changed, items, couponCode);
}

// ---------------------------------------------------------------------------
// Ghi danh khoa mien phi — khong qua don (Task 02 §8.2)
// ---------------------------------------------------------------------------

export async function enrollFreeCourse(env: Env, userId: string, courseId: string): Promise<{ courseId: string; alreadyEnrolled: boolean }> {
  const course = await getCourseForSale(env, courseId);
  if (!course || course.status !== 'published') {
    throw new ApiError(400, 'invalid_course', 'Khóa học không tồn tại hoặc chưa mở bán.');
  }
  if (course.price_vnd > 0) {
    throw new ApiError(400, 'invalid_input', 'Khóa học này có phí — vui lòng tạo đơn hàng để đăng ký.');
  }
  if (course.is_pay_what_you_want) {
    throw new ApiError(400, 'invalid_input', 'Khóa học Tùy tâm — vui lòng tạo đơn với số tiền bạn muốn đóng góp.');
  }
  const existing = await sbFetch<Array<{ status: string }>>(
    env,
    `/enrollments?select=status&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`,
  );
  const rows = requireSbOk(existing, 'checkFreeEnrollment');
  if (rows && rows.length > 0) {
    const status = (rows[0] as { status: string }).status;
    if (status === 'active' || status === 'completed') return { courseId, alreadyEnrolled: true };
  }
  const inserted = await sbFetch<unknown>(
    env,
    '/enrollments?on_conflict=user_id,course_id',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        course_id: courseId,
        order_id: null,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      }),
    },
  );
  if (inserted.error) throw serverError(`enrollFree: ${inserted.error.message}`);
  await insertAuditLog(env, {
    actorId: userId,
    action: 'enrollment.create_free',
    targetType: 'enrollment',
    targetId: null,
    details: { user_id: userId, course_id: courseId, course_title: course.title },
  });
  return { courseId, alreadyEnrolled: false };
}
