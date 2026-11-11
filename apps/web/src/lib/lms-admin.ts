// Thao tac quan tri LMS — Task 07 phan 3/4 (ADMIN).
//
// Moi ham nhan SupabaseClient da mang JWT cua admin (xem
// supabase-server.ts) va PHAI duoc goi sau requireAdmin() o route /
// layout. Moi thao tac ghi deu insert 1 dong audit_logs
// (action / actor_id / target_type / target_id / details) — can
// migration 0013 (policy audit_logs_insert_admin) moi ghi duoc qua
// JWT; neu audit ghi loi, ham van tra ket qua cua thao tac chinh
// kem `auditWarning` de UI hien canh bao (khong im lang).
//
// Thu hoi enrollment: doi status active/completed -> revoked, dong
// thoi thu hoi chung chi 'valid' cua hoc vien o khoa do (can cot
// certificates.status o 0013; neu DB chua chay 0013 thi buoc nay
// loi va duoc bao lai bang `certificatesWarning`, enrollment van
// bi thu hoi). Hoc vien bi thu hoi mat quyen ngay o request ke
// tiep vi requireLessonAccess() kiem tra lai enrollment moi lan.
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyEnrollmentGrantedEmail } from './email';

export type AuditAction =
  | 'enrollment.grant'
  | 'enrollment.revoke'
  | 'user.role.change'
  | 'user.disable'
  | 'user.enable'
  | 'certificate.issue'
  | 'certificate.revoke'
  | 'course.create'
  | 'course.update'
  | 'module.create'
  | 'module.update'
  | 'lesson.create'
  | 'lesson.update'
  | 'resource.create'
  | 'resource.update'
  | 'content.reorder'
  | 'instructor.assign'
  | 'instructor.revoke'
  | 'assignment.create'
  | 'submission.grade'
  // Task 09 phan 4/4 (CRM + audit) — bo sung 3 action con thieu sau
  // khi ra soat: doi role (da co o admin-users.ts, 'user.role.change'),
  // phan cong giang vien (da co o file nay, 'instructor.assign' /
  // 'instructor.revoke'), xuat ban / an khoa (di qua 'course.update'
  // o route PUT /api/admin/courses/[courseId]), cham bai (da co o
  // route POST /api/v1/.../reviews, 'submission.grade'). Chi con
  // HOAN TRA don hang la chua co lib/route nao — refundOrder() duoi
  // day la cho duy nhat moi them.
  | 'lead.status'
  | 'lead.interaction'
  | 'order.refund'
  | 'library.create'
  | 'library.update'
  | 'library.delete';

export async function writeAuditLog(
  client: SupabaseClient,
  input: {
    actorId: string;
    action: AuditAction;
    targetType: string;
    targetId: string | null;
    details?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from('audit_logs').insert({
    actor_id: input.actorId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    details: input.details ?? {},
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Ly do tang/thu hoi bat buoc: khong co ly do thi khong ghi audit day du. */
export function validateGrantReason(reason: string | null | undefined): string | null {
  if (!reason || !reason.trim()) return 'Vui lòng nhập lý do tặng / thu hồi khóa học.';
  if (reason.trim().length > 500) return 'Lý do tối đa 500 ký tự.';
  return null;
}

export type GrantResult =
  | { status: 'ok'; enrollmentId: string; reactivated: boolean; auditWarning?: string; emailWarning?: string }
  | { status: 'error'; message: string };

/**
 * Admin tang khoa: tao enrollment active khong qua don (order_id NULL),
 * ghi granted_by + grant_reason + audit_logs 'enrollment.grant'.
 * Da ghi danh active/completed -> 409 (khong tao trung — UNIQUE
 * (user_id, course_id)); da bi thu hoi -> mo lai dong cu.
 */
export async function grantEnrollment(
  client: SupabaseClient,
  input: { adminId: string; userId: string; courseId: string; grantReason: string },
): Promise<GrantResult> {
  const reasonError = validateGrantReason(input.grantReason);
  if (reasonError) return { status: 'error', message: reasonError };
  const { data: course, error: courseErr } = await client
    .from('courses')
    .select('id')
    .eq('id', input.courseId)
    .maybeSingle();
  if (courseErr || !course) return { status: 'error', message: 'Không tìm thấy khóa học.' };
  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('id, email')
    .eq('id', input.userId)
    .maybeSingle();
  if (profileErr || !profile) return { status: 'error', message: 'Không tìm thấy học viên.' };
  const studentEmail =
    typeof (profile as { email?: unknown }).email === 'string'
      ? ((profile as { email: string }).email ?? '')
      : '';

  const { data: existing, error: exErr } = await client
    .from('enrollments')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('course_id', input.courseId)
    .maybeSingle();
  if (exErr) return { status: 'error', message: exErr.message };
  const row = existing as { id: string; status: string } | null;
  if (row && (row.status === 'active' || row.status === 'completed')) {
    return { status: 'error', message: 'Học viên đã có quyền học khóa này.' };
  }

  let enrollmentId: string;
  let reactivated = false;
  if (row && row.status === 'revoked') {
    const { error } = await client
      .from('enrollments')
      .update({
        status: 'active',
        granted_by: input.adminId,
        grant_reason: input.grantReason.trim(),
        completed_at: null,
      })
      .eq('id', row.id);
    if (error) return { status: 'error', message: error.message };
    enrollmentId = row.id;
    reactivated = true;
  } else {
    const { data, error } = await client
      .from('enrollments')
      .insert({
        user_id: input.userId,
        course_id: input.courseId,
        order_id: null,
        status: 'active',
        granted_by: input.adminId,
        grant_reason: input.grantReason.trim(),
      })
      .select('id')
      .single();
    if (error || !data) {
      return { status: 'error', message: error?.message ?? 'Không tạo được enrollment.' };
    }
    enrollmentId = (data as { id: string }).id;
  }

  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: 'enrollment.grant',
    targetType: 'enrollment',
    targetId: enrollmentId,
    details: {
      user_id: input.userId,
      course_id: input.courseId,
      grant_reason: input.grantReason.trim(),
      reactivated,
    },
  });
  // Task 11 (enrollment-granted): mail bao hoc vien da duoc ghi danh.
  // Khong phai mail thanh toan (E8 order-paid chi gui sau khi don that
  // su da tra — route mark-paid chua ton tai trong code). Loi email
  // khong lam hong viec tang khoa: tra kem emailWarning nhu auditWarning.
  let emailWarning: string | undefined;
  try {
    if (studentEmail.includes('@')) {
      const emailRes = await notifyEnrollmentGrantedEmail({
        toEmail: studentEmail,
        userId: input.userId,
        courseId: input.courseId,
        enrollmentId,
      });
      if (emailRes.status === 'failed') {
        emailWarning = `Đã tặng khóa nhưng chưa gửi được email: ${emailRes.error ?? 'không rõ lỗi'}`;
      }
    } else {
      emailWarning = 'Đã tặng khóa nhưng chưa gửi được email: không tìm thấy email học viên.';
    }
  } catch (err) {
    emailWarning = `Đã tặng khóa nhưng chưa gửi được email: ${err instanceof Error ? err.message : 'không rõ lỗi'}`;
  }
  return {
    status: 'ok',
    enrollmentId,
    reactivated,
    ...(audit.ok ? {} : { auditWarning: `Đã tặng khóa nhưng chưa ghi được audit log: ${audit.error}` }),
    ...(emailWarning ? { emailWarning } : {}),
  };
}

export type RevokeResult =
  | {
      status: 'ok';
      enrollmentId: string;
      previousStatus: string;
      certificatesRevoked: number | null;
      auditWarning?: string;
      certificatesWarning?: string;
    }
  | { status: 'error'; message: string };

/** Admin thu hoi quyen hoc: active/completed -> revoked + audit + thu hoi chung chi. */
export async function revokeEnrollment(
  client: SupabaseClient,
  input: { adminId: string; enrollmentId: string; reason: string },
): Promise<RevokeResult> {
  const reasonError = validateGrantReason(input.reason);
  if (reasonError) return { status: 'error', message: reasonError };
  const { data, error } = await client
    .from('enrollments')
    .select('id, user_id, course_id, status')
    .eq('id', input.enrollmentId)
    .maybeSingle();
  if (error || !data) {
    return { status: 'error', message: error?.message ?? 'Không tìm thấy enrollment.' };
  }
  const row = data as { id: string; user_id: string; course_id: string; status: string };
  if (row.status === 'revoked') {
    return { status: 'error', message: 'Enrollment này đã bị thu hồi trước đó.' };
  }
  const previousStatus = row.status;
  const { error: updErr } = await client
    .from('enrollments')
    .update({ status: 'revoked' })
    .eq('id', row.id);
  if (updErr) return { status: 'error', message: updErr.message };

  // Thu hoi chung chi con hieu luc cua hoc vien o khoa nay (best-effort:
  // neu DB chua chay 0013 thi cot status chua co — bao lai, khong lam
  // hong viec thu hoi enrollment chinh).
  let certificatesRevoked: number | null = null;
  let certificatesWarning: string | undefined;
  try {
    const { data: certs, error: certErr } = await client
      .from('certificates')
      .update({ status: 'revoked' })
      .eq('user_id', row.user_id)
      .eq('course_id', row.course_id)
      .eq('status', 'valid')
      .select('id');
    if (certErr) {
      certificatesWarning = `Không thu hồi được chứng chỉ: ${certErr.message}`;
    } else {
      certificatesRevoked = Array.isArray(certs) ? certs.length : 0;
    }
  } catch (err) {
    certificatesWarning =
      err instanceof Error ? `Không thu hồi được chứng chỉ: ${err.message}` : 'Không thu hồi được chứng chỉ.';
  }

  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: 'enrollment.revoke',
    targetType: 'enrollment',
    targetId: row.id,
    details: {
      user_id: row.user_id,
      course_id: row.course_id,
      previous_status: previousStatus,
      reason: input.reason.trim(),
      certificates_revoked: certificatesRevoked,
    },
  });
  return {
    status: 'ok',
    enrollmentId: row.id,
    previousStatus,
    certificatesRevoked,
    ...(audit.ok ? {} : { auditWarning: `Đã thu hồi nhưng chưa ghi được audit log: ${audit.error}` }),
    ...(certificatesWarning ? { certificatesWarning } : {}),
  };
}

export interface CourseEnrollmentItem {
  enrollmentId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  enrolledAt: string;
  grantReason: string | null;
}

/** Danh sach enrollment cua 1 khoa kem ho ten/SĐT/email (chi admin doc). */
export async function listCourseEnrollments(
  client: SupabaseClient,
  courseId: string,
): Promise<CourseEnrollmentItem[]> {
  const { data, error } = await client
    .from('enrollments')
    .select('id, user_id, status, enrolled_at, grant_reason, profiles(full_name, email, phone)')
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown as Array<{
    id: string;
    user_id: string;
    status: string;
    enrolled_at: string;
    grant_reason: string | null;
    profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
  }>).map((r) => ({
    enrollmentId: r.id,
    userId: r.user_id,
    fullName: r.profiles?.full_name ?? null,
    email: r.profiles?.email ?? null,
    phone: r.profiles?.phone ?? null,
    status: r.status,
    enrolledAt: r.enrolled_at,
    grantReason: r.grant_reason,
  }));
}

// ---------------------------------------------------------------------------
// Cay noi dung khoa hoc cho trang admin (dung chung cho page server +
// API route GET /api/admin/courses/[courseId])
// ---------------------------------------------------------------------------

export interface AdminResourceItem {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  file_url: string | null;
  display_order: number;
  is_free_preview: boolean;
}

export interface AdminLessonItem {
  id: string;
  course_module_id: string;
  slug: string;
  title: string;
  type: string;
  content: string | null;
  video_url: string | null;
  file_url: string | null;
  display_order: number;
  is_free_preview: boolean;
  is_published: boolean | null;
  video_duration_sec: number | null;
  resources: AdminResourceItem[];
}

export interface AdminModuleItem {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  display_order: number;
  is_free_preview: boolean;
  is_published: boolean;
  lessons: AdminLessonItem[];
}

export interface AdminCourseTree {
  course: Record<string, unknown> | null;
  modules: AdminModuleItem[];
}

export interface AdminCourseListItem {
  id: string;
  slug: string;
  display_order: number;
  title: string;
  subtitle: string | null;
  pillar: string | null;
  price_vnd: number;
  is_featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  moduleCount: number;
  lessonCount: number;
}

/** Tat ca khoa (ca draft/archived) kem so chuong / so bai — chi admin goi. */
export async function fetchAdminCourseList(client: SupabaseClient): Promise<AdminCourseListItem[]> {
  const { data, error } = await client
    .from('courses')
    .select(
      'id, slug, display_order, title, subtitle, pillar, price_vnd, is_featured, status, created_at, updated_at',
    )
    .order('display_order', { ascending: true });
  if (error || !data) return [];
  const courses = data as unknown as AdminCourseListItem[];
  const counts = new Map<string, { modules: number; lessons: number }>();
  if (courses.length > 0) {
    const ids = courses.map((c) => c.id);
    const { data: mods } = await client.from('course_modules').select('id, course_id').in('course_id', ids);
    const modRows = (mods ?? []) as Array<{ id: string; course_id: string }>;
    for (const m of modRows) {
      const c = counts.get(m.course_id) ?? { modules: 0, lessons: 0 };
      c.modules += 1;
      counts.set(m.course_id, c);
    }
    if (modRows.length > 0) {
      const { data: lessons } = await client
        .from('lessons')
        .select('id, course_module_id')
        .in('course_module_id', modRows.map((m) => m.id));
      const lessonRows = (lessons ?? []) as Array<{ course_module_id: string }>;
      const courseOfModule = new Map(modRows.map((m) => [m.id, m.course_id]));
      for (const l of lessonRows) {
        const cid = courseOfModule.get(l.course_module_id);
        if (!cid) continue;
        const c = counts.get(cid) ?? { modules: 0, lessons: 0 };
        c.lessons += 1;
        counts.set(cid, c);
      }
    }
  }
  return courses.map((c) => ({
    ...c,
    moduleCount: counts.get(c.id)?.modules ?? 0,
    lessonCount: counts.get(c.id)?.lessons ?? 0,
  }));
}

/** Lay khoa + toan bo cay chuong -> bai -> tai lieu (chi admin goi). */
export async function fetchAdminCourseTree(
  client: SupabaseClient,
  courseId: string,
): Promise<AdminCourseTree> {
  const { data: course, error } = await client
    .from('courses')
    .select(
      'id, slug, display_order, title, subtitle, description, pillar, poster_url, price_vnd, is_featured, status, created_at, updated_at',
    )
    .eq('id', courseId)
    .maybeSingle();
  if (error || !course) return { course: null, modules: [] };
  const { data: modules } = await client
    .from('course_modules')
    .select('id, course_id, slug, title, description, display_order, is_free_preview, is_published')
    .eq('course_id', courseId)
    .order('display_order', { ascending: true });
  const modRows = (modules ?? []) as Array<{ id: string }>;
  let lessons: AdminLessonItem[] = [];
  let resources: AdminResourceItem[] = [];
  if (modRows.length > 0) {
    const { data: lessonRows } = await client
      .from('lessons')
      .select(
        'id, course_module_id, slug, title, type, content, video_url, file_url, display_order, is_free_preview, is_published, video_duration_sec',
      )
      .in('course_module_id', modRows.map((m) => m.id))
      .order('display_order', { ascending: true });
    lessons = (lessonRows ?? []) as unknown as AdminLessonItem[];
    const lessonIds = lessons.map((l) => l.id);
    if (lessonIds.length > 0) {
      const { data: resRows } = await client
        .from('lesson_resources')
        .select('id, lesson_id, title, resource_type, file_url, display_order, is_free_preview')
        .in('lesson_id', lessonIds)
        .order('display_order', { ascending: true });
      resources = (resRows ?? []) as unknown as AdminResourceItem[];
    }
  }
  const resourcesByLesson = new Map<string, AdminResourceItem[]>();
  for (const r of resources) {
    const list = resourcesByLesson.get(r.lesson_id) ?? [];
    list.push(r);
    resourcesByLesson.set(r.lesson_id, list);
  }
  const lessonsByModule = new Map<string, AdminLessonItem[]>();
  for (const l of lessons) {
    const list = lessonsByModule.get(l.course_module_id) ?? [];
    list.push({ ...l, resources: resourcesByLesson.get(l.id) ?? [] });
    lessonsByModule.set(l.course_module_id, list);
  }
  return {
    course: course as unknown as Record<string, unknown>,
    modules: (modules ?? []).map((m) => ({
      ...(m as unknown as AdminModuleItem),
      lessons: lessonsByModule.get((m as unknown as { id: string }).id) ?? [],
    })),
  };
}


export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export const LESSON_TYPES = [
  'video',
  'text',
  'quiz',
  'file',
  'audio',
  'image',
  'pdf',
  'assignment',
  'webinar',
] as const;

export function validateCourseInput(input: {
  title?: unknown;
  slug?: unknown;
  status?: unknown;
  priceVnd?: unknown;
  displayOrder?: unknown;
}): string | null {
  if (typeof input.title !== 'string' || input.title.trim().length < 3 || input.title.trim().length > 200) {
    return 'Tiêu đề khóa học cần 3–200 ký tự.';
  }
  if (typeof input.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.';
  }
  if (typeof input.status !== 'string' || !(COURSE_STATUSES as readonly string[]).includes(input.status)) {
    return 'Trạng thái phải là draft, published hoặc archived.';
  }
  if (typeof input.priceVnd !== 'number' || !Number.isInteger(input.priceVnd) || input.priceVnd < 0) {
    return 'Giá phải là số nguyên ≥ 0 (VNĐ, 0 = miễn phí / tùy tâm).';
  }
  if (
    typeof input.displayOrder !== 'number' ||
    !Number.isInteger(input.displayOrder) ||
    input.displayOrder < 0
  ) {
    return 'Thứ tự hiển thị phải là số nguyên ≥ 0.';
  }
  return null;
}

export function validateModuleInput(input: { title?: unknown; displayOrder?: unknown }): string | null {
  if (typeof input.title !== 'string' || input.title.trim().length < 2 || input.title.trim().length > 200) {
    return 'Tiêu đề chương cần 2–200 ký tự.';
  }
  if (typeof input.displayOrder !== 'number' || !Number.isInteger(input.displayOrder) || input.displayOrder < 0) {
    return 'Thứ tự hiển thị phải là số nguyên ≥ 0.';
  }
  return null;
}

export function validateLessonInput(input: {
  title?: unknown;
  slug?: unknown;
  type?: unknown;
  displayOrder?: unknown;
}): string | null {
  if (typeof input.title !== 'string' || input.title.trim().length < 2 || input.title.trim().length > 200) {
    return 'Tiêu đề bài học cần 2–200 ký tự.';
  }
  if (typeof input.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return 'Slug bài học chỉ gồm chữ thường, số và dấu gạch ngang.';
  }
  if (typeof input.type !== 'string' || !(LESSON_TYPES as readonly string[]).includes(input.type)) {
    return `Loại bài học phải là một trong: ${LESSON_TYPES.join(', ')}.`;
  }
  if (typeof input.displayOrder !== 'number' || !Number.isInteger(input.displayOrder) || input.displayOrder < 0) {
    return 'Thứ tự hiển thị phải là số nguyên ≥ 0.';
  }
  return null;
}

export function validateResourceInput(input: {
  title?: unknown;
  resourceType?: unknown;
  fileUrl?: unknown;
  displayOrder?: unknown;
}): string | null {
  if (typeof input.title !== 'string' || input.title.trim().length < 2 || input.title.trim().length > 200) {
    return 'Tiêu đề tài liệu cần 2–200 ký tự.';
  }
  const types = ['file', 'link', 'video', 'document'] as const;
  if (typeof input.resourceType !== 'string' || !(types as readonly string[]).includes(input.resourceType)) {
    return 'Loại tài liệu phải là file, link, video hoặc document.';
  }
  if (
    input.fileUrl !== undefined &&
    input.fileUrl !== null &&
    input.fileUrl !== '' &&
    (typeof input.fileUrl !== 'string' || input.fileUrl.length > 2000)
  ) {
    return 'URL tài liệu không hợp lệ.';
  }
  if (typeof input.displayOrder !== 'number' || !Number.isInteger(input.displayOrder) || input.displayOrder < 0) {
    return 'Thứ tự hiển thị phải là số nguyên ≥ 0.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sap xep thu tu noi dung (nut len/xuong o /admin/khoa-hoc)
// ---------------------------------------------------------------------------

export type ReorderKind = 'module' | 'lesson' | 'resource';

export type ReorderResult =
  | { status: 'ok'; auditWarning?: string }
  | { status: 'error'; message: string };

/**
 * Luu display_order moi cho nhieu item cung 1 cha. Kiem tra moi id
 * deu thuoc dung cha (module -> course, lesson -> module -> course,
 * resource -> lesson -> module -> course) truoc khi ghi bat ky dong
 * nao — id la thi khong doi thu tu cua ai ca.
 */
export async function reorderContent(
  client: SupabaseClient,
  input: {
    adminId: string;
    kind: ReorderKind;
    courseId: string;
    parentId: string;
    items: Array<{ id: string; displayOrder: number }>;
  },
): Promise<ReorderResult> {
  if (input.items.length === 0) return { status: 'error', message: 'Không có mục nào để sắp xếp.' };
  if (input.items.length > 200) return { status: 'error', message: 'Quá nhiều mục trong một lần sắp xếp (tối đa 200).' };
  const seen = new Set<string>();
  for (const item of input.items) {
    if (!item.id || seen.has(item.id)) return { status: 'error', message: 'Danh sách sắp xếp có id trùng hoặc rỗng.' };
    seen.add(item.id);
    if (!Number.isInteger(item.displayOrder) || item.displayOrder < 0) {
      return { status: 'error', message: 'Thứ tự hiển thị phải là số nguyên ≥ 0.' };
    }
  }
  const orders = input.items.map((i) => i.displayOrder);
  if (new Set(orders).size !== orders.length) {
    return { status: 'error', message: 'Thứ tự hiển thị không được trùng nhau.' };
  }

  const table = input.kind === 'module' ? 'course_modules' : input.kind === 'lesson' ? 'lessons' : 'lesson_resources';
  const parentColumn = input.kind === 'module' ? 'course_id' : input.kind === 'lesson' ? 'course_module_id' : 'lesson_id';

  // Voi resource, parentId la lesson — can doi chieu lesson do thuoc khoa nao.
  let expectedParentId = input.parentId;
  if (input.kind === 'resource') {
    const { data: lesson, error } = await client
      .from('lessons')
      .select('id, course_module_id')
      .eq('id', input.parentId)
      .maybeSingle();
    if (error || !lesson) return { status: 'error', message: 'Không tìm thấy bài học chứa tài liệu.' };
    const { data: mod, error: modErr } = await client
      .from('course_modules')
      .select('id, course_id')
      .eq('id', (lesson as { course_module_id: string }).course_module_id)
      .maybeSingle();
    if (modErr || !mod || (mod as { course_id: string }).course_id !== input.courseId) {
      return { status: 'error', message: 'Bài học không thuộc khóa học này.' };
    }
    expectedParentId = input.parentId;
  }

  const { data: rows, error } = await client
    .from(table)
    .select(`id, ${parentColumn}`)
    .in('id', input.items.map((i) => i.id));
  if (error) return { status: 'error', message: error.message };
  const found = (rows ?? []) as Array<Record<string, unknown>>;
  if (found.length !== input.items.length) {
    return { status: 'error', message: 'Có mục không tồn tại — chưa lưu thứ tự.' };
  }
  if (found.some((r) => r[parentColumn] !== expectedParentId)) {
    return { status: 'error', message: 'Có mục không thuộc đúng nhóm cha — chưa lưu thứ tự.' };
  }

  for (const item of input.items) {
    const { error: updErr } = await client
      .from(table)
      .update({ display_order: item.displayOrder })
      .eq('id', item.id);
    if (updErr) return { status: 'error', message: updErr.message };
  }
  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: 'content.reorder',
    targetType: 'course',
    targetId: input.courseId,
    details: { kind: input.kind, parent_id: input.parentId, items: input.items },
  });
  if (!audit.ok) {
    return { status: 'ok', auditWarning: `Đã lưu thứ tự nhưng chưa ghi được audit log: ${audit.error}` };
  }
  return { status: 'ok' };
}

// ---------------------------------------------------------------------------
// Phan cong giang vien (Task 09 phan 3/4 — COURSE MANAGEMENT).
//
// Quy tac (DECISIONS Task 02 #3 + Task 03 QĐ 12): chi admin gan / thu
// hoi giang vien, qua bang course_instructors (0004 muc 20) — khong
// gan bang cach khac. Cot giang vien la `user_id` (khong co cot
// `instructor_id` — xem 0013 muc E); role chi 'lead' (phu trach
// chinh) hoac 'assistant' (tro giang). Moi thao tac ghi audit_logs
// ('instructor.assign' / 'instructor.revoke').
// Vai tro giang vien kiem tra o user_roles (nguon su that) + cache
// profiles.role, giong requireAdmin(). Moi khoa chi co toi da 1
// 'lead' — gan lead moi khi da co lead khac thi bao loi, admin phai
// doi vai tro / thu hoi lead cu truoc.
// ---------------------------------------------------------------------------

export const INSTRUCTOR_ROLES = ['lead', 'assistant'] as const;
export type InstructorRole = (typeof INSTRUCTOR_ROLES)[number];

export const INSTRUCTOR_ROLE_LABEL: Record<InstructorRole, string> = {
  lead: 'Phụ trách chính',
  assistant: 'Trợ giảng',
};

export function validateInstructorRole(role: unknown): role is InstructorRole {
  return typeof role === 'string' && (INSTRUCTOR_ROLES as readonly string[]).includes(role);
}

export interface CourseInstructorItem {
  assignmentId: string;
  courseId: string;
  userId: string;
  role: InstructorRole;
  assignedBy: string | null;
  assignedAt: string;
  fullName: string | null;
  email: string | null;
}

export interface InstructorCandidate {
  userId: string;
  fullName: string | null;
  email: string | null;
}

/** Giang vien dang phu trach 1 khoa kem ho ten/email (chi admin goi). */
export async function listCourseInstructors(
  client: SupabaseClient,
  courseId: string,
): Promise<CourseInstructorItem[]> {
  const { data, error } = await client
    .from('course_instructors')
    .select('id, course_id, user_id, role, assigned_by, assigned_at, profiles(full_name, email)')
    .eq('course_id', courseId)
    .order('assigned_at', { ascending: true });
  if (error || !data) return [];
  return (data as unknown as Array<{
    id: string;
    course_id: string;
    user_id: string;
    role: string;
    assigned_by: string | null;
    assigned_at: string;
    profiles: { full_name: string | null; email: string | null } | null;
  }>).map((r) => ({
    assignmentId: r.id,
    courseId: r.course_id,
    userId: r.user_id,
    role: (INSTRUCTOR_ROLES as readonly string[]).includes(r.role) ? (r.role as InstructorRole) : 'assistant',
    assignedBy: r.assigned_by,
    assignedAt: r.assigned_at,
    fullName: r.profiles?.full_name ?? null,
    email: r.profiles?.email ?? null,
  }));
}

/** Nguoi co vai tro giang vien de admin chon phan cong (chi admin goi). */
export async function listInstructorCandidates(client: SupabaseClient): Promise<InstructorCandidate[]> {
  // user_roles la nguon su that; profiles.role chi la cache dong bo
  // bang trigger — doc ca hai nhu requireAdmin(), uu tien user_roles.
  const { data: roleRows } = await client
    .from('user_roles')
    .select('user_id')
    .eq('role', 'instructor');
  const ids = ((roleRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  let rows: Array<{ id: string; full_name: string | null; email: string | null }> = [];
  if (ids.length > 0) {
    const { data } = await client
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids)
      .order('full_name', { ascending: true });
    rows = (data ?? []) as typeof rows;
  }
  if (rows.length === 0) {
    const { data } = await client
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'instructor')
      .order('full_name', { ascending: true });
    rows = (data ?? []) as typeof rows;
  }
  return rows.map((r) => ({ userId: r.id, fullName: r.full_name, email: r.email }));
}

export type AssignInstructorResult =
  | { status: 'ok'; assignmentId: string; roleChanged: boolean; auditWarning?: string }
  | { status: 'error'; message: string };

/**
 * Admin gan giang vien cho khoa. Gan moi -> insert; da gan roi ma doi
 * vai tro -> update role; da gan dung vai tro do -> loi (khong tao
 * trung — UNIQUE (course_id, user_id)). Luon ghi audit
 * 'instructor.assign' (ke ca doi vai tro).
 */
export async function assignInstructor(
  client: SupabaseClient,
  input: { adminId: string; courseId: string; userId: string; role: unknown },
): Promise<AssignInstructorResult> {
  if (!validateInstructorRole(input.role)) {
    return { status: 'error', message: 'Vai trò giảng viên phải là lead (phụ trách chính) hoặc assistant (trợ giảng).' };
  }
  const role = input.role;
  const { data: course, error: courseErr } = await client
    .from('courses')
    .select('id')
    .eq('id', input.courseId)
    .maybeSingle();
  if (courseErr || !course) return { status: 'error', message: 'Không tìm thấy khóa học.' };
  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('id, role')
    .eq('id', input.userId)
    .maybeSingle();
  if (profileErr || !profile) return { status: 'error', message: 'Không tìm thấy tài khoản này.' };
  const { data: roleRows } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', input.userId)
    .eq('role', 'instructor');
  const isInstructor =
    (Array.isArray(roleRows) && roleRows.length > 0) ||
    (profile as { role?: string }).role === 'instructor';
  if (!isInstructor) {
    return { status: 'error', message: 'Tài khoản này không có vai trò giảng viên.' };
  }

  const { data: existing, error: exErr } = await client
    .from('course_instructors')
    .select('id, role')
    .eq('course_id', input.courseId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (exErr) return { status: 'error', message: exErr.message };
  const row = existing as { id: string; role: string } | null;
  if (row && row.role === role) {
    return { status: 'error', message: 'Giảng viên này đã được phân công với vai trò đó cho khóa học.' };
  }

  // Moi khoa chi 1 lead: gan lead moi khi da co lead khac thi bao loi.
  if (role === 'lead') {
    const { data: leads } = await client
      .from('course_instructors')
      .select('user_id')
      .eq('course_id', input.courseId)
      .eq('role', 'lead');
    const otherLead = ((leads ?? []) as Array<{ user_id: string }>).some((l) => l.user_id !== input.userId);
    if (otherLead) {
      return {
        status: 'error',
        message: 'Khóa học đã có giảng viên phụ trách chính. Hãy đổi vai trò hoặc thu hồi phân công cũ trước.',
      };
    }
  }

  let assignmentId: string;
  let roleChanged = false;
  // Chup vai tro cu TRUOC khi update: `row` co the la tham chieu toi
  // dong du lieu bi update ghi de (fake client / ORM tra ve cung object).
  const previousRole = row ? row.role : null;
  if (row) {
    const { error } = await client
      .from('course_instructors')
      .update({ role, assigned_by: input.adminId })
      .eq('course_id', input.courseId)
      .eq('user_id', input.userId);
    if (error) return { status: 'error', message: error.message };
    assignmentId = row.id;
    roleChanged = true;
  } else {
    const { data, error } = await client
      .from('course_instructors')
      .insert({
        course_id: input.courseId,
        user_id: input.userId,
        role,
        assigned_by: input.adminId,
      })
      .select('id')
      .single();
    if (error || !data) {
      return { status: 'error', message: error?.message ?? 'Không phân công được giảng viên.' };
    }
    assignmentId = (data as { id: string }).id;
  }

  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: 'instructor.assign',
    targetType: 'course_instructor',
    targetId: assignmentId,
    details: {
      course_id: input.courseId,
      user_id: input.userId,
      role,
      role_changed: roleChanged,
      previous_role: previousRole,
    },
  });
  return {
    status: 'ok',
    assignmentId,
    roleChanged,
    ...(audit.ok ? {} : { auditWarning: `Đã phân công nhưng chưa ghi được audit log: ${audit.error}` }),
  };
}

export type RevokeInstructorResult =
  | { status: 'ok'; assignmentId: string; auditWarning?: string }
  | { status: 'error'; message: string };

/**
 * Admin thu hoi phan cong giang vien: xoa dong course_instructors
 * (bang khong co cot trang thai) + audit 'instructor.revoke'. Giang
 * vien mat quyen instructor cua khoa ngay o request ke tiep vi
 * requireLessonAccess() kiem tra lai course_instructors moi lan.
 */
export async function revokeInstructorAssignment(
  client: SupabaseClient,
  input: { adminId: string; courseId: string; userId: string },
): Promise<RevokeInstructorResult> {
  const { data: existing, error: exErr } = await client
    .from('course_instructors')
    .select('id, role')
    .eq('course_id', input.courseId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (exErr || !existing) {
    return { status: 'error', message: exErr?.message ?? 'Giảng viên này không được phân công cho khóa học.' };
  }
  const row = existing as { id: string; role: string };
  const { error } = await client
    .from('course_instructors')
    .delete()
    .eq('course_id', input.courseId)
    .eq('user_id', input.userId);
  if (error) return { status: 'error', message: error.message };
  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: 'instructor.revoke',
    targetType: 'course_instructor',
    targetId: row.id,
    details: { course_id: input.courseId, user_id: input.userId, role: row.role },
  });
  return {
    status: 'ok',
    assignmentId: row.id,
    ...(audit.ok ? {} : { auditWarning: `Đã thu hồi phân công nhưng chưa ghi được audit log: ${audit.error}` }),
  };
}

// ---------------------------------------------------------------------------
// Hoan tra don hang — Task 09 phan 4/4 (CRM + audit).
// Truoc day KHONG co lib/route hoan tra nao (da kiem tra: chi co
// nhan 'Đã hoàn trả' o dashboard.ts). Ham nay la cho duy nhat.
// ---------------------------------------------------------------------------

export type RefundOrderResult =
  | { status: 'ok'; orderId: string; previousStatus: string; auditWarning?: string }
  | { status: 'error'; message: string };

/**
 * Admin hoan tra don da thanh toan: orders.status 'paid' -> 'refunded'
 * + audit 'order.refund' (ghi ly do + so tien). Chi don 'paid' moi
 * hoan tra duoc ('pending' thi huy don, 'refunded'/'cancelled' thi
 * khong lam lai). Khong tu dong thu hoi enrollment o day — enrollment
 * thu hoi rieng bang revokeEnrollment() neu can (ghi audit rieng).
 *
 * CHINH SACH (DECISIONS QĐ 9): hoan tra trong 15 ngay lam viec.
 * Ham nay KHONG tu tinh 15 ngay lam viec (can lich nghi le) — admin
 * chiu trach nhiem kiem tra han truoc khi bam hoan tra; ngay dat don
 * (created_at) duoc tra ve trong details de doi soat. Neu can chan
 * cung theo lich, bo sung o route sau.
 *
 * CAN migration 0017: policy orders_admin_update — hien orders chi
 * co policy SELECT cho admin (0001/0006), chua co UPDATE, nen goi
 * qua JWT admin se bi chan 42501 cho toi khi 0017 chay xong.
 *
 * DEPRECATED (Task 10, 10/11/2026) — KHONG dung cho UI moi: ham nay
 * chi doi status + audit, KHONG ghi payments 'refunded', KHONG thu
 * hoi enrollment/membership/chung chi, KHONG giam luot dung coupon,
 * KHONG ghi ma giao dich hoan, KHONG chan han 15 ngay lam viec.
 * Luong hoan tra day du nam o Workers API executeRefund()
 * (workers/api/src/payments.ts) — trang /admin/don-hang goi Workers
 * qua apps/web/src/lib/payments.ts (refundOrder). Giu ham nay lai de
 * khong vo code Task 09; khong mo them route nao goi no.
 */
export async function refundOrder(
  client: SupabaseClient,
  input: { adminId: string; orderId: string; reason: string },
): Promise<RefundOrderResult> {
  if (!input.reason || !input.reason.trim()) {
    return { status: 'error', message: 'Vui lòng nhập lý do hoàn trả.' };
  }
  if (input.reason.trim().length > 500) {
    return { status: 'error', message: 'Lý do tối đa 500 ký tự.' };
  }
  const { data, error } = await client
    .from('orders')
    .select('id, user_id, course_id, amount_vnd, status, created_at')
    .eq('id', input.orderId)
    .maybeSingle();
  if (error || !data) {
    return { status: 'error', message: error?.message ?? 'Không tìm thấy đơn hàng.' };
  }
  const row = data as {
    id: string;
    user_id: string;
    course_id: string;
    amount_vnd: number;
    status: string;
    created_at: string;
  };
  if (row.status === 'refunded') {
    return { status: 'error', message: 'Đơn hàng này đã được hoàn trả trước đó.' };
  }
  if (row.status !== 'paid') {
    return {
      status: 'error',
      message: `Chỉ hoàn trả được đơn đã thanh toán (đơn này đang ở trạng thái "${row.status}").`,
    };
  }
  // Giu lai trang thai cu TRUOC khi update: row la tham chieu toi dong
  // trong store (Supabase tra ve object rieng, nhung test fake dung
  // chung object) — doc row.status sau update se ra 'refunded'.
  const previousStatus = row.status;
  const { error: updErr } = await client
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', row.id);
  if (updErr) return { status: 'error', message: updErr.message };
  const audit = await writeAuditLog(client, {
    actorId: input.adminId,
    action: 'order.refund',
    targetType: 'order',
    targetId: row.id,
    details: {
      user_id: row.user_id,
      course_id: row.course_id,
      amount_vnd: row.amount_vnd,
      previous_status: previousStatus,
      reason: input.reason.trim(),
      order_created_at: row.created_at,
      refund_policy: 'Hoàn trả trong 15 ngày làm việc (DECISIONS QĐ 9).',
    },
  });
  return {
    status: 'ok',
    orderId: row.id,
    previousStatus,
    ...(audit.ok ? {} : { auditWarning: `Đã hoàn trả nhưng chưa ghi được audit log: ${audit.error}` }),
  };
}
