// Quan ly hoc vien PHIA ADMIN — Task 09 phan 2/4 (ADMIN PANEL & CRM).
//
// Chi goi sau requireAdmin() (layout /admin/* + route /api/admin/*).
// Moi ham nhan SupabaseClient da mang JWT cua admin (xem
// supabase-server.ts) nen RLS van ap dung; khong dung service-role key.
//
// NGUYEN TAC (DECISIONS.md Task 03 QĐ 3 + QĐ 9):
// - `user_roles` la nguon su that duy nhat cho role; `profiles.role`
//   chi la cache dong bo bang trigger (0007). Doi role = xoa cac dong
//   user_roles cu cua user roi insert dong moi (granted_by = admin);
//   KHONG bao gio UPDATE profiles.role truc tiep tu code nay (trigger
//   0009 chan hoc vien tu doi role; admin doi qua user_roles thi
//   trigger tu dong bo cache).
// - KHONG XOA TAI KHOAN. Tai khoan con don / con enrollment chi duoc
//   VO HIEU HOA (profiles.is_disabled, migration 0017) thay vi xoa;
//   don hang va enrollment giu nguyen. File nay khong co ham xoa
//   tai khoan, khong goi auth.admin.deleteUser.
// - Moi thao tac ghi (doi role / vo hieu hoa / mo lai) deu insert 1
//   dong audit_logs (action user.role.change / user.disable /
//   user.enable); neu audit ghi loi, ham van tra ket qua cua thao tac
//   chinh kem `auditWarning` (khong im lang) — theo mau lms-admin.ts.
// - Tang / thu hoi khoa dung lai grantEnrollment / revokeEnrollment
//   trong lms-admin.ts (khong viet lai o day).
//
// GIOI HAN (ghi ro, khong gia vo): co is_disabled chua chan dang nhap
// — JWT da cap van dung duoc toi khi het han, RLS khong kiem tra co
// nay. Chan dang nhap / chan hoc vien bi vo hieu hoa o middleware +
// layout /hoc-vien la follow-up can coordinator quyet (xem 0017).
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateGrantReason, writeAuditLog } from './lms-admin';
import {
  computeCourseProgress,
  computeModuleProgress,
  type LessonRow,
  type OrderItem,
  type ProgressRow,
} from './dashboard';

export const ADMIN_USER_ROLES = ['student', 'instructor', 'admin'] as const;
export type AdminUserRole = (typeof ADMIN_USER_ROLES)[number];

export const ADMIN_USERS_PAGE_SIZE = 20;

export function roleLabelVi(role: string): string {
  const map: Record<string, string> = {
    student: 'Học viên',
    instructor: 'Giảng viên',
    admin: 'Quản trị viên',
  };
  return map[role] ?? role;
}

export function accountStatusLabelVi(isDisabled: boolean): string {
  return isDisabled ? 'Đã vô hiệu hóa' : 'Đang hoạt động';
}

/**
 * Chuan hoa tu khoa tim kiem (ten / email / SĐT): cat khoang trang,
 * gioi han 100 ky tu, loai ky tu dac biet cua LIKE (%, _, \) de khong
 * pha vo mau `.or(...ilike...)`.
 */
export function normalizeUserSearch(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[%_\\]/g, '')
    .slice(0, 100);
}

export function isValidAdminUserRole(value: unknown): value is AdminUserRole {
  return typeof value === 'string' && (ADMIN_USER_ROLES as readonly string[]).includes(value);
}

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  province: string | null;
  /** Cache profiles.role (dong bo tu user_roles). */
  primaryRole: string;
  roles: string[];
  isDisabled: boolean;
  disabledReason: string | null;
  createdAt: string;
  enrollmentCount: number;
  orderCount: number;
}

export interface AdminUserListFilters {
  search?: string;
  /** Loc theo 1 role trong user_roles; rong = tat ca. */
  role?: string;
  /** 'active' | 'disabled' | 'all' (mac dinh 'all'). */
  status?: string;
  /** Chi user da ghi danh khoa nay; rong = tat ca. */
  courseId?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminUserListResult {
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  province: string | null;
  role: string;
  is_disabled?: boolean | null;
  disabled_reason?: string | null;
  created_at: string;
};

/** Danh sach hoc vien (admin): tim kiem + loc role / trang thai / khoa. */
export async function listAdminUsers(
  client: SupabaseClient,
  filters: AdminUserListFilters = {},
): Promise<AdminUserListResult> {
  const page = Math.max(1, Math.floor(filters.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(filters.pageSize ?? ADMIN_USERS_PAGE_SIZE) || ADMIN_USERS_PAGE_SIZE),
  );
  const empty: AdminUserListResult = { users: [], total: 0, page, pageSize, totalPages: 0 };

  // Loc role / khoa can gioi han id TRUOC KHI phan trang (khong the loc
  // sau khi da cat trang — tong so va trang se sai).
  let allowedIds: string[] | null = null;
  if (filters.role) {
    const { data } = await client.from('user_roles').select('user_id').eq('role', filters.role);
    const ids = ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
    allowedIds = ids;
  }
  if (filters.courseId) {
    const { data } = await client.from('enrollments').select('user_id').eq('course_id', filters.courseId);
    const ids = ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
    allowedIds = allowedIds === null ? ids : allowedIds.filter((id) => ids.includes(id));
  }
  if (allowedIds !== null && allowedIds.length === 0) return empty;

  let query = client
    .from('profiles')
    .select(
      'id, full_name, email, phone, province, role, is_disabled, disabled_reason, created_at',
      { count: 'exact' },
    );
  const q = normalizeUserSearch(filters.search);
  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (filters.status === 'active') query = query.eq('is_disabled', false);
  else if (filters.status === 'disabled') query = query.eq('is_disabled', true);
  if (allowedIds !== null) query = query.in('id', allowedIds);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error || !data) return { ...empty, total: 0 };
  const rows = data as unknown as ProfileRow[];
  if (rows.length === 0) return { ...empty, total: count ?? 0 };

  const ids = rows.map((r) => r.id);
  const [{ data: roleRows }, { data: enrollRows }, { data: orderRows }] = await Promise.all([
    client.from('user_roles').select('user_id, role').in('user_id', ids),
    client.from('enrollments').select('id, user_id').in('user_id', ids),
    client.from('orders').select('id, user_id').in('user_id', ids),
  ]);
  const rolesByUser = new Map<string, string[]>();
  for (const r of (roleRows ?? []) as Array<{ user_id: string; role: string }>) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }
  const countBy = (list: Array<{ user_id: string }> | null | undefined): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of list ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const enrollCount = countBy((enrollRows ?? []) as Array<{ user_id: string }>);
  const orderCount = countBy((orderRows ?? []) as Array<{ user_id: string }>);
  const total = count ?? rows.length;
  return {
    users: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      province: r.province,
      primaryRole: r.role,
      roles: rolesByUser.get(r.id) ?? (r.role ? [r.role] : []),
      isDisabled: r.is_disabled === true,
      disabledReason: r.disabled_reason ?? null,
      createdAt: r.created_at,
      enrollmentCount: enrollCount.get(r.id) ?? 0,
      orderCount: orderCount.get(r.id) ?? 0,
    })),
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// Chi tiet hoc vien
// ---------------------------------------------------------------------------

export interface AdminUserEnrollment {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  grantedBy: string | null;
  grantReason: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

export interface AdminUserDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  province: string | null;
  avatarUrl: string | null;
  primaryRole: string;
  roles: string[];
  isDisabled: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
  enrollments: AdminUserEnrollment[];
  orders: OrderItem[];
}

/** Ho so + role + enrollment kem tien do + don hang cua 1 hoc vien. */
export async function fetchAdminUserDetail(
  client: SupabaseClient,
  userId: string,
): Promise<AdminUserDetail | null> {
  const { data: profile, error } = await client
    .from('profiles')
    .select('id, full_name, email, phone, province, avatar_url, role, is_disabled, disabled_at, disabled_reason, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !profile) return null;
  const p = profile as unknown as ProfileRow & {
    avatar_url: string | null;
    disabled_at: string | null;
  };

  const [{ data: roleRows }, { data: enrollRows }, { data: orderRows }] = await Promise.all([
    client.from('user_roles').select('role').eq('user_id', userId),
    client
      .from('enrollments')
      .select('id, user_id, course_id, order_id, status, enrolled_at, completed_at, granted_by, grant_reason, courses(title, slug)')
      .eq('user_id', userId)
      .order('enrolled_at', { ascending: false }),
    client
      .from('orders')
      .select('id, reference_code, status, amount_vnd, payment_method, created_at, paid_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);
  const roles = ((roleRows ?? []) as Array<{ role: string }>).map((r) => r.role);
  const enrollments = (enrollRows ?? []) as unknown as Array<{
    id: string;
    course_id: string;
    status: string;
    enrolled_at: string;
    completed_at: string | null;
    granted_by: string | null;
    grant_reason: string | null;
    courses: { title: string; slug: string } | null;
  }>;

  // Tien do theo tung khoa (tinh nhu dashboard: video >= 90% hoac
  // status completed — xem dashboard.ts isLessonCompleted / QĐ 17).
  let enrollmentsOut: AdminUserEnrollment[] = enrollments.map((e) => ({
    enrollmentId: e.id,
    courseId: e.course_id,
    courseTitle: e.courses?.title ?? '(Khóa học đã gỡ)',
    courseSlug: e.courses?.slug ?? '',
    status: e.status,
    enrolledAt: e.enrolled_at,
    completedAt: e.completed_at,
    grantedBy: e.granted_by,
    grantReason: e.grant_reason,
    totalLessons: 0,
    completedLessons: 0,
    progressPercent: 0,
  }));
  if (enrollments.length > 0) {
    const courseIds = [...new Set(enrollments.map((e) => e.course_id))];
    const { data: moduleRows } = await client
      .from('course_modules')
      .select('id, course_id, title, display_order')
      .in('course_id', courseIds)
      .order('display_order', { ascending: true });
    const modules = (moduleRows ?? []) as unknown as Array<{ id: string; course_id: string; title: string }>;
    const moduleIds = modules.map((m) => m.id);
    let lessons: LessonRow[] = [];
    if (moduleIds.length > 0) {
      const { data: lessonRows } = await client
        .from('lessons')
        .select('id, course_module_id, type')
        .in('course_module_id', moduleIds)
        .order('display_order', { ascending: true });
      lessons = (lessonRows ?? []) as LessonRow[];
    }
    const { data: progressRows } = await client
      .from('lesson_progress')
      .select('lesson_id, status, progress_percent')
      .eq('user_id', userId);
    const progressByLesson = new Map<string, ProgressRow>(
      ((progressRows ?? []) as ProgressRow[]).map((pr) => [pr.lesson_id, pr]),
    );
    enrollmentsOut = enrollments.map((e) => {
      const courseModules = modules.filter((m) => m.course_id === e.course_id);
      const moduleProgress = courseModules.map((m) =>
        computeModuleProgress(m.id, m.title, lessons, progressByLesson),
      );
      const total = moduleProgress.reduce((s, m) => s + m.totalLessons, 0);
      const completed = moduleProgress.reduce((s, m) => s + m.completedLessons, 0);
      const { progressPercent } = computeCourseProgress(total, completed, e.status);
      return {
        enrollmentId: e.id,
        courseId: e.course_id,
        courseTitle: e.courses?.title ?? '(Khóa học đã gỡ)',
        courseSlug: e.courses?.slug ?? '',
        status: e.status,
        enrolledAt: e.enrolled_at,
        completedAt: e.completed_at,
        grantedBy: e.granted_by,
        grantReason: e.grant_reason,
        totalLessons: total,
        completedLessons: completed,
        progressPercent,
      };
    });
  }

  // Don hang kem dong hang (order_items).
  const orders = (orderRows ?? []) as unknown as Array<{
    id: string;
    reference_code: string;
    status: string;
    amount_vnd: number;
    payment_method: string | null;
    created_at: string;
    paid_at: string | null;
  }>;
  let ordersOut: OrderItem[] = [];
  if (orders.length > 0) {
    const { data: itemRows } = await client
      .from('order_items')
      .select('id, order_id, item_name, unit_price_vnd, quantity, total_vnd')
      .in('order_id', orders.map((o) => o.id));
    const lines = (itemRows ?? []) as unknown as Array<{
      id: string;
      order_id: string;
      item_name: string;
      unit_price_vnd: number;
      quantity: number;
      total_vnd: number;
    }>;
    ordersOut = orders.map((o) => ({
      id: o.id,
      referenceCode: o.reference_code,
      status: o.status,
      amountVnd: o.amount_vnd,
      paymentMethod: o.payment_method,
      createdAt: o.created_at,
      paidAt: o.paid_at,
      items: lines
        .filter((l) => l.order_id === o.id)
        .map((l) => ({
          id: l.id,
          itemName: l.item_name,
          unitPriceVnd: l.unit_price_vnd,
          quantity: l.quantity,
          totalVnd: l.total_vnd,
        })),
    }));
  }

  return {
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    phone: p.phone,
    province: p.province,
    avatarUrl: p.avatar_url,
    primaryRole: p.role,
    roles: roles.length > 0 ? roles : p.role ? [p.role] : [],
    isDisabled: p.is_disabled === true,
    disabledAt: p.disabled_at ?? null,
    disabledReason: p.disabled_reason ?? null,
    createdAt: p.created_at,
    enrollments: enrollmentsOut,
    orders: ordersOut,
  };
}

// ---------------------------------------------------------------------------
// Thao tac admin (ghi + audit)
// ---------------------------------------------------------------------------

export type ChangeRoleResult =
  | { status: 'ok'; previousRoles: string[]; newRole: AdminUserRole; auditWarning?: string }
  | { status: 'error'; message: string };

/**
 * Admin doi role: chi qua user_roles (nguon su that). Xoa het dong
 * user_roles cu roi insert dong moi — profiles.role tu dong bo theo
 * trigger 0007 (uu tien admin > instructor > student). Hoc vien KHONG
 * tu doi duoc role (trigger 0009 + REVOKE UPDATE (role)); ham nay chi
 * duoc goi sau requireAdmin() o route admin. Cam admin tu doi role
 * cua chinh minh (tranh tu khoa tai khoan admin duy nhat).
 */
export async function changeUserRole(
  client: SupabaseClient,
  input: { adminId: string; userId: string; newRole: string; reason?: string },
): Promise<ChangeRoleResult> {
  if (!isValidAdminUserRole(input.newRole)) {
    return { status: 'error', message: 'Role không hợp lệ (student, instructor hoặc admin).' };
  }
  const reason = (input.reason ?? '').trim();
  if (reason.length > 500) return { status: 'error', message: 'Lý do tối đa 500 ký tự.' };
  if (input.adminId === input.userId) {
    return { status: 'error', message: 'Không thể tự đổi role của chính mình.' };
  }
  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('id')
    .eq('id', input.userId)
    .maybeSingle();
  if (profileErr || !profile) return { status: 'error', message: 'Không tìm thấy học viên.' };

  const { data: roleRows, error: roleErr } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', input.userId);
  if (roleErr) return { status: 'error', message: roleErr.message };
  const previousRoles = ((roleRows ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (previousRoles.length === 1 && previousRoles[0] === input.newRole) {
    return { status: 'error', message: 'Học viên đã có role này.' };
  }

  // Khong giao dich nguyen tu qua REST: neu insert sau delete that bai,
  // user tam khong co dong user_roles nao — trigger dong bo profiles.role
  // ve 'student' (mac dinh an toan), admin doi lai duoc ngay sau do.
  const { error: delErr } = await client.from('user_roles').delete().eq('user_id', input.userId);
  if (delErr) return { status: 'error', message: delErr.message };
  const { error: insErr } = await client.from('user_roles').insert({
    user_id: input.userId,
    role: input.newRole,
    granted_by: input.adminId,
  });
  if (insErr) {
    return { status: 'error', message: `Đã xóa role cũ nhưng chưa gán được role mới: ${insErr.message}` };
  }

  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: 'user.role.change',
    targetType: 'user',
    targetId: input.userId,
    details: { previous_roles: previousRoles, new_role: input.newRole, reason: reason || null },
  });
  return {
    status: 'ok',
    previousRoles,
    newRole: input.newRole,
    ...(audit.ok ? {} : { auditWarning: `Đã đổi role nhưng chưa ghi được audit log: ${audit.error}` }),
  };
}

export type SetDisabledResult =
  | { status: 'ok'; isDisabled: boolean; auditWarning?: string }
  | { status: 'error'; message: string };

/**
 * Admin vo hieu hoa / mo lai tai khoan (thay vi xoa — Task 03 QĐ 9).
 * Ly do bat buoc. Don hang + enrollment GIU NGUYEN (khong thu hoi,
 * khong xoa). Cam admin tu vo hieu hoa chinh minh. Chi goi sau
 * requireAdmin().
 */
export async function setUserDisabled(
  client: SupabaseClient,
  input: { adminId: string; userId: string; disabled: boolean; reason: string },
): Promise<SetDisabledResult> {
  const reasonError = validateGrantReason(input.reason);
  if (reasonError) {
    return {
      status: 'error',
      message: input.disabled
        ? 'Vui lòng nhập lý do vô hiệu hóa tài khoản.'
        : 'Vui lòng nhập lý do mở lại tài khoản.',
    };
  }
  if (input.adminId === input.userId) {
    return { status: 'error', message: 'Không thể tự vô hiệu hóa tài khoản của chính mình.' };
  }
  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('id, is_disabled')
    .eq('id', input.userId)
    .maybeSingle();
  if (profileErr || !profile) return { status: 'error', message: 'Không tìm thấy học viên.' };
  const current = (profile as { is_disabled?: boolean | null }).is_disabled === true;
  if (current === input.disabled) {
    return {
      status: 'error',
      message: input.disabled ? 'Tài khoản này đã bị vô hiệu hóa trước đó.' : 'Tài khoản này đang hoạt động.',
    };
  }
  const { error: updErr } = await client
    .from('profiles')
    .update({
      is_disabled: input.disabled,
      disabled_at: input.disabled ? new Date().toISOString() : null,
      disabled_reason: input.disabled ? input.reason.trim() : null,
    })
    .eq('id', input.userId);
  if (updErr) return { status: 'error', message: updErr.message };

  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: input.disabled ? 'user.disable' : 'user.enable',
    targetType: 'user',
    targetId: input.userId,
    details: { reason: input.reason.trim(), previous_disabled: current },
  });
  return {
    status: 'ok',
    isDisabled: input.disabled,
    ...(audit.ok ? {} : { auditWarning: `Đã cập nhật trạng thái nhưng chưa ghi được audit log: ${audit.error}` }),
  };
}
