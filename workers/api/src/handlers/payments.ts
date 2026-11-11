// Handlers thanh toan — hoc vien + webhook SePay (Task 10).
// Luong 11 buoc o workers/api/src/payments.ts; file nay chi la lop
// HTTP mong (auth / rate-limit / parse body / response).
//
// Endpoints (them vao workers/api/src/index.ts):
//   POST /api/v1/orders                 — tao don (can JWT)
//   GET  /api/v1/orders/:id             — chi tiet don cua minh
//   POST /api/v1/orders/:id/cancel      — huy don pending cua minh
//   GET  /api/v1/my/orders              — don cua minh (phan trang)
//   GET  /api/v1/my/transactions        — lich su giao dich cua minh
//   POST /api/v1/coupons/validate       — kiem tra ma giam gia
//   GET  /api/v1/membership-plans       — goi thanh vien dang ban (cong khai)
//   POST /api/v1/my/enrollments         — ghi danh khoa mien phi
//   POST /api/v1/webhooks/sepay         — webhook SePay (xac minh chu ky)
//   POST /api/webhooks/sepay            — alias (khong /v1)
import type { Env } from '../env';
import { ApiError, jsonError, jsonOk } from '../errors';
import {
  cancelOrder,
  checkOrderRateLimit,
  computeCouponDiscount,
  createOrder,
  enrollFreeCourse,
  getCouponByCode,
  getOrderById,
  getOrderItems,
  requireAuthUser,
  requestRefund,
  toOrderSummary,
  getCouponCodeById,
  type CreateOrderInput,
  type OrderItemInput,
  type OrderRow,
} from '../payments';
import { getSepaySignatureHeader, getSepayTimestampHeader } from '../sepay';
import { processSepayWebhook } from '../payments';
import { isSupabaseConfigured } from '../env';
import { isUuid, pickField } from '../validation';
import { requireSbOk, sbFetch } from '../supabase';

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'invalid_input', 'Dữ liệu gửi lên không đúng định dạng.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'invalid_input', 'Dữ liệu gửi lên không đúng định dạng.');
  }
  return body as Record<string, unknown>;
}

export function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  return { page, limit, offset: (page - 1) * limit };
}

function normalizeOrderItems(raw: unknown): OrderItemInput[] {
  if (!Array.isArray(raw)) throw new ApiError(400, 'invalid_input', 'Danh sách dòng hàng không hợp lệ.');
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new ApiError(400, 'invalid_input', 'Dòng hàng không hợp lệ.');
    }
    const e = entry as Record<string, unknown>;
    const itemType = pickField(e, 'itemType', 'item_type');
    const courseId = pickField(e, 'courseId', 'course_id');
    const planId = pickField(e, 'planId', 'plan_id');
    if (itemType === 'course') {
      if (typeof courseId !== 'string' || !isUuid(courseId)) {
        throw new ApiError(400, 'invalid_course', 'Mã khóa học không hợp lệ.');
      }
      return { itemType: 'course' as const, courseId };
    }
    if (itemType === 'membership') {
      if (typeof planId !== 'string' || !isUuid(planId)) {
        throw new ApiError(400, 'invalid_input', 'Mã gói thành viên không hợp lệ.');
      }
      return { itemType: 'membership' as const, planId };
    }
    throw new ApiError(400, 'invalid_input', 'Loại dòng hàng phải là course hoặc membership.');
  });
}

export async function handleCreateOrder(req: Request, env: Env): Promise<Response> {
  if (!isSupabaseConfigured(env)) {
    throw new ApiError(503, 'upstream_error', 'Hệ thống thanh toán chưa được cấu hình.');
  }
  const user = await requireAuthUser(env, req);
  await checkOrderRateLimit(env, req, user.userId);
  const body = await readJsonBody(req);
  const input: CreateOrderInput = {
    items: normalizeOrderItems(body['items']),
    couponCode:
      typeof pickField(body, 'couponCode', 'coupon_code') === 'string'
        ? (pickField(body, 'couponCode', 'coupon_code') as string)
        : null,
    customAmountVnd:
      typeof pickField(body, 'customAmountVnd', 'custom_amount_vnd') === 'number'
        ? (pickField(body, 'customAmountVnd', 'custom_amount_vnd') as number)
        : null,
  };
  const idempotencyKey = req.headers.get('Idempotency-Key')?.trim() || null;
  if (idempotencyKey && idempotencyKey.length > 128) {
    throw new ApiError(400, 'invalid_input', 'Idempotency-Key quá dài.');
  }
  const result = await createOrder(env, user.userId, input, idempotencyKey);
  return jsonOk(
    { order: result.order, duplicate: result.duplicate },
    result.duplicate ? 200 : 201,
  );
}

export async function handleGetOrder(req: Request, env: Env, orderId: string): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const order = await getOrderById(env, orderId);
  if (!order || order.user_id !== user.userId) {
    throw new ApiError(404, 'not_found', 'Không tìm thấy đơn hàng.');
  }
  const items = await getOrderItems(env, order.id);
  const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
  return jsonOk({ order: toOrderSummary(order, items, couponCode) });
}

export async function handleCancelOrder(req: Request, env: Env, orderId: string): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const order = await cancelOrder(env, user.userId, orderId);
  return jsonOk({ order });
}

/** Hoc vien yeu cau hoan tra (chi ghi nhan — admin moi thuc hien hoan). */
export async function handleRequestRefund(req: Request, env: Env, orderId: string): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const body = await readJsonBody(req);
  const reason = typeof body['reason'] === 'string' ? body['reason'] : '';
  const order = await requestRefund(env, user.userId, orderId, reason);
  return jsonOk({ order });
}

export async function handleGetMyOrders(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const status = url.searchParams.get('status')?.trim() || '';
  const statusFilter = ['pending', 'paid', 'cancelled', 'refunded', 'expired'].includes(status)
    ? `&status=eq.${status}`
    : '';
  const result = await sbFetch<OrderRow[]>(
    env,
    `/orders?select=*&user_id=eq.${encodeURIComponent(user.userId)}${statusFilter}&order=created_at.desc&limit=${limit + 1}&offset=${offset}`,
  );
  const rows = (requireSbOk(result, 'listMyOrders') ?? []) as OrderRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const orders = [];
  for (const row of pageRows) {
    const items = await getOrderItems(env, row.id);
    const couponCode = row.coupon_id ? await getCouponCodeById(env, row.coupon_id) : null;
    orders.push(toOrderSummary(row, items, couponCode));
  }
  return jsonOk({ orders, pagination: { page, limit, hasMore } });
}

export async function handleGetMyTransactions(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  // Chi payment cua don thuoc ve minh (RLS payments chi admin doc nen
  // phai qua service-role + loc theo orders.user_id o day).
  const result = await sbFetch<Array<Record<string, unknown>>>(
    env,
    `/payments?select=id,order_id,amount_vnd,method,gateway_reference,status,paid_at,created_at,orders!inner(id,reference_code,user_id)&orders.user_id=eq.${encodeURIComponent(user.userId)}&order=created_at.desc&limit=${limit + 1}&offset=${offset}`,
  );
  const rows = (requireSbOk(result, 'listMyTransactions') ?? []) as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const transactions = pageRows.map((r) => {
    const o = (r['orders'] ?? {}) as Record<string, unknown>;
    return {
      id: r['id'],
      orderId: r['order_id'],
      referenceCode: o['reference_code'] ?? null,
      amountVnd: r['amount_vnd'],
      method: r['method'],
      gatewayReference: r['gateway_reference'],
      status: r['status'],
      paidAt: r['paid_at'],
      createdAt: r['created_at'],
    };
  });
  return jsonOk({ transactions, pagination: { page, limit, hasMore } });
}

export async function handleValidateCoupon(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  await checkOrderRateLimit(env, req, user.userId);
  const body = await readJsonBody(req);
  const code = typeof body['code'] === 'string' ? body['code'] : '';
  const amountVnd = typeof body['amountVnd'] === 'number' ? body['amountVnd'] : 0;
  if (!code.trim()) throw new ApiError(400, 'invalid_input', 'Vui lòng nhập mã giảm giá.');
  if (!Number.isInteger(amountVnd) || amountVnd < 0) {
    throw new ApiError(400, 'invalid_input', 'Số tiền đơn không hợp lệ.');
  }
  const coupon = await getCouponByCode(env, code);
  if (!coupon) {
    return jsonOk({ valid: false, code: code.trim().toUpperCase(), discountVnd: 0, reason: 'coupon_not_found' });
  }
  const { discountVnd, reason } = computeCouponDiscount(coupon, amountVnd);
  return jsonOk({
    valid: reason === null && discountVnd > 0,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountVnd,
    amountAfterDiscount: Math.max(0, amountVnd - discountVnd),
    reason,
  });
}

export async function handleListMembershipPlans(_req: Request, env: Env): Promise<Response> {
  const result = await sbFetch<Array<Record<string, unknown>>>(
    env,
    '/membership_plans?select=id,slug,name,description,price_vnd,duration_days,course_id,is_active&is_active=eq.true&order=price_vnd.asc',
  );
  const rows = (requireSbOk(result, 'listMembershipPlans') ?? []) as Array<Record<string, unknown>>;
  return jsonOk({
    plans: rows.map((p) => ({
      id: p['id'],
      slug: p['slug'],
      name: p['name'],
      description: p['description'],
      priceVnd: p['price_vnd'],
      durationDays: p['duration_days'],
      courseId: p['course_id'],
    })),
  });
}

export async function handleEnrollFree(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  await checkOrderRateLimit(env, req, user.userId);
  const body = await readJsonBody(req);
  const courseId = pickField(body, 'courseId', 'course_id');
  if (typeof courseId !== 'string' || !isUuid(courseId)) {
    throw new ApiError(400, 'invalid_course', 'Mã khóa học không hợp lệ.');
  }
  const result = await enrollFreeCourse(env, user.userId, courseId);
  return jsonOk({ courseId: result.courseId, alreadyEnrolled: result.alreadyEnrolled }, result.alreadyEnrolled ? 200 : 201);
}

/**
 * POST /api/v1/webhooks/sepay (+ alias /api/webhooks/sepay).
 * Buoc (5)-(11). Doc RAW BODY (chua parse) de xac minh chu ky.
 */
export async function handleSepayWebhook(req: Request, env: Env): Promise<Response> {
  if (!isSupabaseConfigured(env)) {
    throw new ApiError(503, 'upstream_error', 'Hệ thống thanh toán chưa được cấu hình.');
  }
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    throw new ApiError(400, 'invalid_input', 'Không đọc được nội dung webhook.');
  }
  const signature = getSepaySignatureHeader(req);
  const timestamp = getSepayTimestampHeader(req);
  const outcome = await processSepayWebhook(env, rawBody, signature, timestamp);
  if (outcome.httpStatus === 401) {
    return jsonError(
      new ApiError(401, 'unauthorized', 'Chữ ký webhook không hợp lệ.'),
    );
  }
  return jsonOk(outcome.body, outcome.httpStatus);
}
