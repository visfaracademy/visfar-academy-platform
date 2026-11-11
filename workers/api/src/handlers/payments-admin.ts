// Handlers thanh toan — admin (Task 10).
// Chi role admin (requireAdmin). Moi thao tac ghi audit_logs.
// Hoan tra: THU CONG — xem executeRefund() o ../payments.ts (SePay
// khong co API hoan tien duoc goi o day).
//
// Endpoints (them vao workers/api/src/index.ts):
//   GET  /api/v1/admin/orders                 — danh sach don
//   POST /api/v1/admin/orders/:id/mark-paid   — xac nhan thu cong
//   POST /api/v1/admin/orders/:id/refund      — hoan tra (can ma GD hoan)
//   POST /api/v1/admin/orders/expire-sweep    — quet don qua han
//   GET  /api/v1/admin/coupons                — danh sach ma giam gia
//   POST /api/v1/admin/coupons                — tao ma giam gia
//   PATCH /api/v1/admin/coupons/:id           — bat/tat ma
//   GET  /api/v1/admin/membership-plans       — danh sach goi
//   POST /api/v1/admin/membership-plans       — tao goi thanh vien
//   GET  /api/v1/admin/payments               — doi soat giao dich (R9)
import type { Env } from '../env';
import { ApiError, jsonOk } from '../errors';
import {
  confirmPayment,
  executeRefund,
  expirePendingOrders,
  getCouponCodeById,
  getOrderById,
  getOrderItems,
  requireAdmin,
  toOrderSummary,
  type OrderRow,
} from '../payments';
import { isUuid, pickField } from '../validation';
import { requireSbOk, sbFetch } from '../supabase';
import { parsePagination, readJsonBody } from './payments';

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

async function attachProfiles(
  env: Env,
  orders: OrderRow[],
): Promise<Array<Record<string, unknown>>> {
  const userIds = [...new Set(orders.map((o) => o.user_id).filter((x): x is string => Boolean(x)))];
  let byId = new Map<string, ProfileMini>();
  if (userIds.length > 0) {
    const inList = userIds.map((id) => `"${id}"`).join(',');
    const result = await sbFetch<ProfileMini[]>(
      env,
      `/profiles?select=id,full_name,email&id=in.(${inList})`,
    );
    const rows = (requireSbOk(result, 'attachProfiles') ?? []) as ProfileMini[];
    byId = new Map(rows.map((r) => [r.id, r]));
  }
  const out = [];
  for (const order of orders) {
    const items = await getOrderItems(env, order.id);
    const couponCode = order.coupon_id ? await getCouponCodeById(env, order.coupon_id) : null;
    const summary = toOrderSummary(order, items, couponCode);
    const profile = order.user_id ? byId.get(order.user_id) : undefined;
    out.push({
      ...summary,
      student: profile
        ? { id: profile.id, fullName: profile.full_name, email: profile.email }
        : null,
      refundRequestedAt: order.refund_requested_at,
      refundReason: order.refund_reason,
      refundedAt: order.refunded_at,
      refundBankReference: order.refund_bank_reference,
    });
  }
  return out;
}

// Goi thanh vien tra ve dang camelCase (giong handler public
// listMembershipPlans): web MembershipPlan dung priceVnd / durationDays /
// courseId. Khong tra row snake_case that.
function toPlanSummary(p: Record<string, unknown>): Record<string, unknown> {
  return {
    id: p['id'],
    slug: p['slug'],
    name: p['name'],
    description: p['description'],
    priceVnd: p['price_vnd'],
    durationDays: p['duration_days'],
    courseId: p['course_id'],
    isActive: p['is_active'],
  };
}

export async function handleAdminListOrders(req: Request, env: Env): Promise<Response> {
  await requireAdmin(env, req);
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const status = url.searchParams.get('status')?.trim() || '';
  const q = url.searchParams.get('q')?.trim() || '';
  const refundRequested = url.searchParams.get('refundRequested') === 'true';
  let query = '/orders?select=*';
  if (['pending', 'paid', 'cancelled', 'refunded', 'expired'].includes(status)) {
    query += `&status=eq.${status}`;
  }
  if (q) query += `&reference_code=ilike.%${encodeURIComponent(q)}%`;
  if (refundRequested) query += '&refund_requested_at=not.is.null';
  query += `&order=created_at.desc&limit=${limit + 1}&offset=${offset}`;
  const result = await sbFetch<OrderRow[]>(env, query);
  const rows = (requireSbOk(result, 'adminListOrders') ?? []) as OrderRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return jsonOk({ orders: await attachProfiles(env, pageRows), pagination: { page, limit, hasMore } });
}

export async function handleAdminMarkPaid(
  req: Request,
  env: Env,
  orderId: string,
): Promise<Response> {
  const admin = await requireAdmin(env, req);
  const body = await readJsonBody(req);
  const amountVnd = pickField(body, 'amountVnd', 'amount_vnd');
  const gatewayReference = pickField(body, 'gatewayReference', 'gateway_reference');
  const note = typeof body['note'] === 'string' ? body['note'] : '';
  if (typeof amountVnd !== 'number' || !Number.isInteger(amountVnd) || amountVnd <= 0) {
    throw new ApiError(400, 'invalid_input', 'Số tiền xác nhận phải là số nguyên > 0.');
  }
  const order = await getOrderById(env, orderId);
  if (!order) throw new ApiError(404, 'not_found', 'Không tìm thấy đơn hàng.');
  // Xac nhan thu cong: admin da kiem tra sao ke MB Bank. So tien phai
  // khop don (confirmPayment se tra 422 neu lech).
  const result = await confirmPayment(env, order, {
    method: 'bank_transfer',
    amountVnd,
    gatewayReference: typeof gatewayReference === 'string' && gatewayReference.trim() ? gatewayReference.trim() : null,
    gatewayPayload: { source: 'admin_mark_paid', note: note.slice(0, 500) },
    verifiedBy: admin.userId,
    source: 'admin_mark_paid',
  });
  return jsonOk({ order: result.order, duplicate: result.duplicate });
}

export async function handleAdminRefund(
  req: Request,
  env: Env,
  orderId: string,
): Promise<Response> {
  const admin = await requireAdmin(env, req);
  const body = await readJsonBody(req);
  const reason = typeof body['reason'] === 'string' ? body['reason'] : '';
  const refundBankReference =
    typeof pickField(body, 'refundBankReference', 'refund_bank_reference') === 'string'
      ? (pickField(body, 'refundBankReference', 'refund_bank_reference') as string)
      : '';
  const forceReason =
    typeof pickField(body, 'forceReason', 'force_reason') === 'string'
      ? (pickField(body, 'forceReason', 'force_reason') as string)
      : null;
  const order = await getOrderById(env, orderId);
  if (!order) throw new ApiError(404, 'not_found', 'Không tìm thấy đơn hàng.');
  const refunded = await executeRefund(env, order, admin.userId, {
    reason,
    refundBankReference,
    forceReason,
  });
  return jsonOk({ order: refunded });
}

export async function handleAdminExpireSweep(req: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(env, req);
  const expiredCount = await expirePendingOrders(env, admin.userId);
  return jsonOk({ expiredCount });
}

export async function handleAdminListCoupons(req: Request, env: Env): Promise<Response> {
  await requireAdmin(env, req);
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const result = await sbFetch<Array<Record<string, unknown>>>(
    env,
    `/coupons?select=*&order=created_at.desc&limit=${limit + 1}&offset=${offset}`,
  );
  const rows = (requireSbOk(result, 'adminListCoupons') ?? []) as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  return jsonOk({ coupons: hasMore ? rows.slice(0, limit) : rows, pagination: { page, limit, hasMore } });
}

export async function handleAdminCreateCoupon(req: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(env, req);
  const body = await readJsonBody(req);
  const code = typeof body['code'] === 'string' ? body['code'].trim().toUpperCase() : '';
  const discountType = typeof body['discountType'] === 'string' ? body['discountType'] : body['discount_type'];
  const discountValue = typeof body['discountValue'] === 'number' ? body['discountValue'] : body['discount_value'];
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    throw new ApiError(400, 'invalid_input', 'Mã giảm giá: 3–20 ký tự, chữ hoa không dấu và số.');
  }
  if (discountType !== 'percent' && discountType !== 'fixed_vnd') {
    throw new ApiError(400, 'invalid_input', 'Loại giảm giá phải là percent hoặc fixed_vnd.');
  }
  if (typeof discountValue !== 'number' || !Number.isInteger(discountValue) || discountValue <= 0) {
    throw new ApiError(400, 'invalid_input', 'Giá trị giảm phải là số nguyên > 0.');
  }
  if (discountType === 'percent' && discountValue > 100) {
    throw new ApiError(400, 'invalid_input', 'Giảm theo % tối đa 100%.');
  }
  const minOrderVnd = typeof body['minOrderVnd'] === 'number' ? body['minOrderVnd'] : 0;
  const maxDiscountVnd = typeof body['maxDiscountVnd'] === 'number' ? body['maxDiscountVnd'] : null;
  const maxUses = typeof body['maxUses'] === 'number' ? body['maxUses'] : null;
  if (!Number.isInteger(minOrderVnd) || minOrderVnd < 0) {
    throw new ApiError(400, 'invalid_input', 'Đơn tối thiểu phải là số nguyên ≥ 0.');
  }
  if (maxDiscountVnd !== null && (!Number.isInteger(maxDiscountVnd) || maxDiscountVnd <= 0)) {
    throw new ApiError(400, 'invalid_input', 'Trần giảm phải là số nguyên > 0.');
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    throw new ApiError(400, 'invalid_input', 'Tổng lượt dùng phải là số nguyên > 0.');
  }
  const validFrom = typeof body['validFrom'] === 'string' ? body['validFrom'] : null;
  const validUntil = typeof body['validUntil'] === 'string' ? body['validUntil'] : null;
  for (const [label, v] of [['validFrom', validFrom], ['validUntil', validUntil]] as const) {
    if (v !== null && Number.isNaN(Date.parse(v))) {
      throw new ApiError(400, 'invalid_input', `Ngày ${label} không hợp lệ.`);
    }
  }
  const inserted = await sbFetch<Array<Record<string, unknown>>>(env, '/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      code,
      description: typeof body['description'] === 'string' ? body['description'].slice(0, 500) : null,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_vnd: minOrderVnd,
      max_discount_vnd: maxDiscountVnd,
      max_uses: maxUses,
      used_count: 0,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: true,
      created_by: admin.userId,
    }),
  });
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      throw new ApiError(409, 'conflict', 'Mã giảm giá này đã tồn tại.');
    }
    throw new ApiError(500, 'server_error', 'Không tạo được mã giảm giá.');
  }
  const rows = requireSbOk(inserted, 'adminCreateCoupon');
  return jsonOk({ coupon: rows?.[0] ?? null }, 201);
}

export async function handleAdminUpdateCoupon(
  req: Request,
  env: Env,
  couponId: string,
): Promise<Response> {
  await requireAdmin(env, req);
  if (!isUuid(couponId)) throw new ApiError(400, 'invalid_input', 'Mã coupon không hợp lệ.');
  const body = await readJsonBody(req);
  if (typeof body['isActive'] !== 'boolean' && typeof body['is_active'] !== 'boolean') {
    throw new ApiError(400, 'invalid_input', 'Chỉ hỗ trợ bật/tắt mã (isActive).');
  }
  const isActive = (body['isActive'] ?? body['is_active']) as boolean;
  const updated = await sbFetch<Array<Record<string, unknown>>>(
    env,
    `/coupons?id=eq.${encodeURIComponent(couponId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ is_active: isActive }),
    },
  );
  const rows = requireSbOk(updated, 'adminUpdateCoupon');
  if (!rows || rows.length === 0) throw new ApiError(404, 'not_found', 'Không tìm thấy mã giảm giá.');
  return jsonOk({ coupon: rows[0] });
}

export async function handleAdminListPlans(req: Request, env: Env): Promise<Response> {
  await requireAdmin(env, req);
  const result = await sbFetch<Array<Record<string, unknown>>>(
    env,
    '/membership_plans?select=*&order=price_vnd.asc',
  );
  const rows = (requireSbOk(result, 'adminListPlans') ?? []) as Array<Record<string, unknown>>;
  return jsonOk({ plans: rows.map(toPlanSummary) });
}

export async function handleAdminCreatePlan(req: Request, env: Env): Promise<Response> {
  await requireAdmin(env, req);
  const body = await readJsonBody(req);
  const slug = typeof body['slug'] === 'string' ? body['slug'].trim().toLowerCase() : '';
  const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
  const priceVnd = typeof body['priceVnd'] === 'number' ? body['priceVnd'] : body['price_vnd'];
  const durationDays = typeof body['durationDays'] === 'number' ? body['durationDays'] : null;
  const courseId = typeof body['courseId'] === 'string' ? body['courseId'] : null;
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug)) {
    throw new ApiError(400, 'invalid_input', 'Slug gói: chữ thường, số, dấu gạch ngang, 3–60 ký tự.');
  }
  if (!name || name.length > 200) {
    throw new ApiError(400, 'invalid_input', 'Tên gói không được trống (tối đa 200 ký tự).');
  }
  if (typeof priceVnd !== 'number' || !Number.isInteger(priceVnd) || priceVnd < 0) {
    throw new ApiError(400, 'invalid_input', 'Giá gói phải là số nguyên ≥ 0 (0 = miễn phí).');
  }
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays <= 0)) {
    throw new ApiError(400, 'invalid_input', 'Số ngày hiệu lực phải là số nguyên > 0 (trống = trọn đời).');
  }
  if (courseId !== null && !isUuid(courseId)) {
    throw new ApiError(400, 'invalid_course', 'Mã khóa đi kèm không hợp lệ.');
  }
  const inserted = await sbFetch<Array<Record<string, unknown>>>(env, '/membership_plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      slug,
      name,
      description: typeof body['description'] === 'string' ? body['description'].slice(0, 1000) : null,
      price_vnd: priceVnd,
      duration_days: durationDays,
      course_id: courseId,
      is_active: true,
    }),
  });
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      throw new ApiError(409, 'conflict', 'Slug gói này đã tồn tại.');
    }
    throw new ApiError(500, 'server_error', 'Không tạo được gói thành viên.');
  }
  const rows = requireSbOk(inserted, 'adminCreatePlan');
  return jsonOk({ plan: rows?.[0] ? toPlanSummary(rows[0] as Record<string, unknown>) : null }, 201);
}

/** Doi soat giao dich (bao cao R9): payment + don + hoc vien. */
export async function handleAdminListPayments(req: Request, env: Env): Promise<Response> {
  await requireAdmin(env, req);
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const status = url.searchParams.get('status')?.trim() || '';
  const method = url.searchParams.get('method')?.trim() || '';
  let query = '/payments?select=id,order_id,amount_vnd,method,gateway_reference,status,paid_at,created_at,orders(id,reference_code,user_id,status)';
  if (['pending', 'succeeded', 'failed', 'refunded'].includes(status)) query += `&status=eq.${status}`;
  if (['bank_transfer', 'sepay', 'stripe'].includes(method)) query += `&method=eq.${method}`;
  query += `&order=created_at.desc&limit=${limit + 1}&offset=${offset}`;
  const result = await sbFetch<Array<Record<string, unknown>>>(env, query);
  const rows = (requireSbOk(result, 'adminListPayments') ?? []) as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  return jsonOk({ payments: hasMore ? rows.slice(0, limit) : rows, pagination: { page, limit, hasMore } });
}
