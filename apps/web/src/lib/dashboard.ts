// Data layer cho Student Dashboard (/hoc-vien/*) — Task 06.
// Doc THAT tu Supabase (profiles, enrollments, lesson_progress,
// certificates, orders, notifications, courses, course_modules,
// lessons, order_items). KHONG mock, KHONG du lieu
// gia, KHONG localStorage lam database — chua co du lieu thi tra
// mang rong de UI hien empty state.
//
// Quy tac tien do (DECISIONS QĐ 17): video hoan thanh khi xem >= 90%,
// bai text khi bam "Da hoan thanh" (status = 'completed'); tinh theo
// module, tong hop len khoa. Server la nguon chot trang thai
// 'completed'; dashboard chi hien thi, khong tu cap nhat tien do.
//
// Ho so: chi sua full_name / phone / province (+ avatar_url qua
// upload). KHONG bao gio gui role / email tu client — role la cache
// dong bo tu user_roles (Task 03 QĐ 3), email dong bo tu auth.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';
import { validateFullName, validatePhone, validateProvince } from './validation';

export const VIDEO_COMPLETION_THRESHOLD = 90;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export const AVATAR_BUCKET = 'avatars';

export type DashboardState<T> =
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string; isOffline: boolean };

export interface ModuleProgress {
  moduleId: string;
  title: string;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

export interface CourseProgressItem {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  modules: ModuleProgress[];
}

export interface LearningEventItem {
  id: string;
  eventType: string;
  courseTitle: string;
  lessonTitle: string;
  occurredAt: string;
  progressPercent: number | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface QuizAttemptItem {
  id: string;
  lessonTitle: string;
  courseTitle: string;
  score: number;
  total: number;
  submittedAt: string;
}

/** Nguong dat mac dinh cua quiz (QĐ Task 08): 70%. */
export const QUIZ_PASS_PERCENT = 70;

export function quizScorePercent(score: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((score / total) * 100);
}

export function isQuizPassed(score: number, total: number, passPercent: number = QUIZ_PASS_PERCENT): boolean {
  return quizScorePercent(score, total) >= passPercent;
}

export interface CertificateItem {
  id: string;
  certificateCode: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  issuedAt: string;
}

export interface OrderLineItem {
  id: string;
  itemName: string;
  unitPriceVnd: number;
  quantity: number;
  totalVnd: number;
}

export interface OrderItem {
  id: string;
  referenceCode: string;
  status: string;
  amountVnd: number;
  paymentMethod: string | null;
  createdAt: string;
  paidAt: string | null;
  items: OrderLineItem[];
}

export interface ProfileUpdateInput {
  fullName: string;
  phone: string;
  province: string;
}

export interface ProfileFieldError {
  field: 'fullName' | 'phone' | 'province';
  message: string;
}

/** PGRST205 = bang chua ton tai tren project (chua chay migration). */
export function mapSupabaseErrorMessage(error: { message?: string; code?: string } | null): string {
  const raw = error?.message ?? '';
  if (error?.code === 'PGRST205' || raw.includes('PGRST205') || /Could not find the table/i.test(raw)) {
    return 'Dữ liệu chưa sẵn sàng trên Supabase (bảng chưa được tạo — cần chạy migration). Vui lòng thử lại sau.';
  }
  return raw || 'Không tải được dữ liệu. Vui lòng thử lại.';
}

export function isOfflineErr(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|fetch|Failed to fetch|Load failed|NetworkError/i.test(err.message)) {
    return true;
  }
  return false;
}

function errorState<T>(err: unknown, fallback: string): DashboardState<T> {
  const isOffline = isOfflineErr(err);
  return {
    status: 'error',
    message: isOffline
      ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.'
      : err instanceof Error
        ? err.message
        : fallback,
    isOffline,
  };
}

type AnyClient = SupabaseClient;

function resolveClient(client?: AnyClient): AnyClient | null {
  if (client) return client;
  if (!isSupabaseConfigured()) return null;
  return getSupabaseBrowserClient();
}

async function getUserId(client: AnyClient): Promise<string | null> {
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/** Nhan tieng Viet cho loai su kien hoc tap (LearningEventItem.eventType — suy ra tu lesson_progress.status). */
export function eventTypeLabelVi(eventType: string): string {
  const map: Record<string, string> = {
    lesson_started: 'Bắt đầu bài học',
    lesson_completed: 'Hoàn thành bài học',
    video_progress: 'Xem video',
    quiz_started: 'Bắt đầu làm quiz',
    quiz_submitted: 'Đã nộp quiz',
    assignment_submitted: 'Đã nộp bài tập',
    course_enrolled: 'Đã ghi danh khóa học',
    course_completed: 'Hoàn thành khóa học',
    certificate_issued: 'Đã cấp chứng chỉ',
    resource_downloaded: 'Đã tải tài liệu',
  };
  return map[eventType] ?? eventType;
}

export function orderStatusLabelVi(status: string): string {
  const map: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn trả',
    expired: 'Hết hạn',
  };
  return map[status] ?? status;
}

export function enrollmentStatusLabelVi(status: string): string {
  const map: Record<string, string> = {
    active: 'Đang học',
    completed: 'Đã hoàn thành',
    revoked: 'Đã thu hồi',
  };
  return map[status] ?? status;
}

export function certificateStatusLabelVi(status: string): string {
  return status === 'revoked' ? 'Đã thu hồi' : 'Còn hiệu lực';
}

/** Dinh dang VND: 1999000 -> "1.999.000 đ". */
export function formatVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString('vi-VN')} đ`;
}

/**
 * Mot bai duoc tinh la hoan thanh khi server da danh dau status =
 * 'completed', hoac — phong khi tien do video chua duoc server chot —
 * bai video dat >= 90% (QĐ 17). Bai text chi tinh khi co status.
 * Task 07 (2/4): uu tien cot moi completion_status (migration 0012),
 * roi ve cot legacy status — hai cot dong bo 2 chieu bang trigger.
 */
export function isLessonCompleted(
  lessonType: string,
  progress: { status: string; progress_percent: number; completion_status?: string | null } | null | undefined,
): boolean {
  if (!progress) return false;
  if (progress.completion_status === 'completed' || progress.status === 'completed') return true;
  if (lessonType === 'video' && progress.progress_percent >= VIDEO_COMPLETION_THRESHOLD) return true;
  return false;
}

export interface LessonRow {
  id: string;
  /** Ten cot sau migration 0005 (module_id cu da doi thanh course_module_id). */
  course_module_id: string;
  type: string;
}

export interface ProgressRow {
  lesson_id: string;
  status: string;
  progress_percent: number;
  /** Cot moi (migration 0012) — tuy chon de tuong thich dong cu. */
  completion_status?: string | null;
  video_position?: number | null;
}

export function computeModuleProgress(
  moduleId: string,
  title: string,
  lessons: LessonRow[],
  progressByLesson: Map<string, ProgressRow>,
): ModuleProgress {
  const inModule = lessons.filter((l) => l.course_module_id === moduleId);
  const completed = inModule.filter((l) => isLessonCompleted(l.type, progressByLesson.get(l.id))).length;
  const total = inModule.length;
  return {
    moduleId,
    title,
    totalLessons: total,
    completedLessons: completed,
    progressPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function computeCourseProgress(
  totalLessons: number,
  completedLessons: number,
  enrollmentStatus: string,
): { progressPercent: number; isCompleted: boolean } {
  const progressPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const isCompleted = enrollmentStatus === 'completed' || (totalLessons > 0 && completedLessons === totalLessons);
  return { progressPercent, isCompleted };
}

/** Tach danh sach khoa dang hoc / da hoan thanh (theo enrollment.status). */
export function splitEnrollments(items: CourseProgressItem[]): {
  inProgress: CourseProgressItem[];
  completed: CourseProgressItem[];
} {
  return {
    inProgress: items.filter((i) => i.status !== 'completed'),
    completed: items.filter((i) => i.status === 'completed'),
  };
}

/** Validate form sua ho so. Chi chap nhan 3 truong: ten / SĐT / tinh. */
export function validateProfileUpdate(input: ProfileUpdateInput): ProfileFieldError[] {
  const errors: ProfileFieldError[] = [];
  if (!validateFullName(input.fullName ?? '')) {
    errors.push({ field: 'fullName', message: 'Vui lòng nhập họ và tên (2–100 ký tự).' });
  }
  const phone = (input.phone ?? '').trim();
  if (phone !== '' && !validatePhone(phone)) {
    errors.push({ field: 'phone', message: 'Số điện thoại phải là 10 số, bắt đầu bằng 0 (hoặc để trống).' });
  }
  const province = (input.province ?? '').trim();
  if (province !== '' && !validateProvince(province)) {
    errors.push({ field: 'province', message: 'Vui lòng chọn tỉnh / thành phố trong danh sách (hoặc để trống).' });
  }
  return errors;
}

/** Duong dan avatar trong bucket `avatars`: <userId>/avatar.<ext> (ghi de anh cu). */
export function avatarStoragePath(userId: string, fileName: string): string | null {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (!(AVATAR_ALLOWED_EXTS as readonly string[]).includes(ext)) return null;
  return `${userId}/avatar.${ext}`;
}

export function validateAvatarFile(file: { name: string; size: number; type: string }): string | null {
  if (!file.type.startsWith('image/')) return 'Vui lòng chọn file ảnh (JPG, PNG hoặc WebP).';
  if (!avatarStoragePath('x', file.name)) {
    return 'Định dạng ảnh chưa hỗ trợ. Vui lòng chọn file JPG, PNG hoặc WebP.';
  }
  if (file.size > AVATAR_MAX_BYTES) return 'Ảnh đại diện tối đa 2 MB. Vui lòng chọn ảnh nhỏ hơn.';
  if (file.size === 0) return 'File ảnh rỗng. Vui lòng chọn file khác.';
  return null;
}

// ---------------------------------------------------------------------------
// Doc du lieu that
// ---------------------------------------------------------------------------

export async function getMyCourseProgress(
  client?: AnyClient,
): Promise<DashboardState<CourseProgressItem[]>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };

    const { data: enrollRows, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, status, enrolled_at, completed_at, course_id, courses(title, slug)')
      .eq('user_id', userId)
      .order('enrolled_at', { ascending: false });
    if (enrollErr) return { status: 'error', message: mapSupabaseErrorMessage(enrollErr), isOffline: false };
    const enrollments = (enrollRows ?? []) as unknown as Array<{
      id: string;
      status: string;
      enrolled_at: string;
      completed_at: string | null;
      course_id: string;
      courses: { title: string; slug: string } | null;
    }>;
    if (enrollments.length === 0) return { status: 'success', data: [] };

    const courseIds = enrollments.map((e) => e.course_id);
    const { data: moduleRows, error: modErr } = await supabase
      .from('course_modules')
      .select('id, course_id, title, display_order')
      .in('course_id', courseIds)
      .order('display_order', { ascending: true });
    if (modErr) return { status: 'error', message: mapSupabaseErrorMessage(modErr), isOffline: false };
    const modules = (moduleRows ?? []) as unknown as Array<{
      id: string;
      course_id: string;
      title: string;
    }>;
    const moduleIds = modules.map((m) => m.id);

    let lessons: LessonRow[] = [];
    if (moduleIds.length > 0) {
      const { data: lessonRows, error: lessonErr } = await supabase
        .from('lessons')
        .select('id, course_module_id, type')
        .in('course_module_id', moduleIds)
        .order('display_order', { ascending: true });
      if (lessonErr) return { status: 'error', message: mapSupabaseErrorMessage(lessonErr), isOffline: false };
      lessons = (lessonRows ?? []) as LessonRow[];
    }

    const { data: progressRows, error: progErr } = await supabase
      .from('lesson_progress')
      .select('lesson_id, status, progress_percent')
      .eq('user_id', userId);
    if (progErr) return { status: 'error', message: mapSupabaseErrorMessage(progErr), isOffline: false };
    const progressByLesson = new Map<string, ProgressRow>(
      ((progressRows ?? []) as ProgressRow[]).map((p) => [p.lesson_id, p]),
    );

    const items: CourseProgressItem[] = enrollments.map((e) => {
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
        totalLessons: total,
        completedLessons: completed,
        progressPercent,
        modules: moduleProgress,
      };
    });
    return { status: 'success', data: items };
  } catch (err) {
    return errorState<CourseProgressItem[]>(err, 'Không tải được tiến độ học.');
  }
}

export async function getMyLearningHistory(
  client?: AnyClient,
): Promise<DashboardState<LearningEventItem[]>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    // Lich su hoc doc tu lesson_progress (0001), KHONG doc learning_events:
    // learning_events (0004) la lich buoi hoc truc tiep — chi co course_id,
    // lesson_id, title, starts_at... — KHONG co user_id / event_type /
    // event_data / occurred_at, nen query cu loi 400 (PGRST204) tren DB that
    // (xem 0010 muc (b)). lesson_progress co du user_id + lesson_id +
    // thoi gian (updated_at / completed_at) + progress_percent.
    // Chi dung cot 0001 (course_id / last_accessed / completion_status la
    // cot 0012, chua ap tren DB live) — khoa suy ra qua
    // lessons.course_module_id -> course_modules.course_id (sau 0005).
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('id, lesson_id, status, progress_percent, completed_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error), isOffline: false };
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      lesson_id: string;
      status: string;
      progress_percent: number;
      completed_at: string | null;
      updated_at: string;
    }>;
    if (rows.length === 0) return { status: 'success', data: [] };

    const lessonIds = [...new Set(rows.map((r) => r.lesson_id).filter((x): x is string => Boolean(x)))];
    const lessonTitles = new Map<string, string>();
    const lessonModuleIds = new Map<string, string>();
    if (lessonIds.length > 0) {
      const { data: lRows } = await supabase
        .from('lessons')
        .select('id, title, course_module_id')
        .in('id', lessonIds);
      for (const l of (lRows ?? []) as Array<{ id: string; title: string; course_module_id: string }>) {
        lessonTitles.set(l.id, l.title);
        lessonModuleIds.set(l.id, l.course_module_id);
      }
    }
    const moduleIds = [...new Set([...lessonModuleIds.values()].filter((x): x is string => Boolean(x)))];
    const moduleCourseIds = new Map<string, string>();
    if (moduleIds.length > 0) {
      const { data: mRows } = await supabase
        .from('course_modules')
        .select('id, course_id')
        .in('id', moduleIds);
      for (const m of (mRows ?? []) as Array<{ id: string; course_id: string }>) {
        moduleCourseIds.set(m.id, m.course_id);
      }
    }
    const courseIds = [...new Set([...moduleCourseIds.values()].filter((x): x is string => Boolean(x)))];
    const courseTitles = new Map<string, string>();
    if (courseIds.length > 0) {
      const { data: cRows } = await supabase.from('courses').select('id, title').in('id', courseIds);
      for (const c of (cRows ?? []) as Array<{ id: string; title: string }>) courseTitles.set(c.id, c.title);
    }
    return {
      status: 'success',
      data: rows.map((r) => {
        const moduleId = lessonModuleIds.get(r.lesson_id);
        const courseId = moduleId ? moduleCourseIds.get(moduleId) : undefined;
        return {
          id: r.id,
          eventType: r.status === 'completed' ? 'lesson_completed' : 'lesson_started',
          courseTitle: courseId ? (courseTitles.get(courseId) ?? '') : '',
          lessonTitle: lessonTitles.get(r.lesson_id) ?? '',
          occurredAt: r.completed_at ?? r.updated_at,
          progressPercent: r.progress_percent,
        };
      }),
    };
  } catch (err) {
    return errorState<LearningEventItem[]>(err, 'Không tải được lịch sử học.');
  }
}

export async function getMyQuizAttempts(
  client?: AnyClient,
): Promise<DashboardState<QuizAttemptItem[]>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('id, lesson_id, score, total, submitted_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(50);
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error), isOffline: false };
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      lesson_id: string;
      score: number;
      total: number;
      submitted_at: string;
    }>;
    if (rows.length === 0) return { status: 'success', data: [] };
    // Giai ten bai / ten khoa qua lessons -> course_modules -> courses
    // (cung cach getMyLearningHistory giai, khong doc dap an dung).
    const lessonIds = [...new Set(rows.map((r) => r.lesson_id).filter((x): x is string => Boolean(x)))];
    const lessonTitles = new Map<string, string>();
    const lessonModuleIds = new Map<string, string>();
    if (lessonIds.length > 0) {
      const { data: lRows } = await supabase
        .from('lessons')
        .select('id, title, course_module_id')
        .in('id', lessonIds);
      for (const l of (lRows ?? []) as Array<{ id: string; title: string; course_module_id: string }>) {
        lessonTitles.set(l.id, l.title);
        lessonModuleIds.set(l.id, l.course_module_id);
      }
    }
    const moduleIds = [...new Set([...lessonModuleIds.values()].filter((x): x is string => Boolean(x)))];
    const moduleCourseIds = new Map<string, string>();
    if (moduleIds.length > 0) {
      const { data: mRows } = await supabase
        .from('course_modules')
        .select('id, course_id')
        .in('id', moduleIds);
      for (const m of (mRows ?? []) as Array<{ id: string; course_id: string }>) {
        moduleCourseIds.set(m.id, m.course_id);
      }
    }
    const courseIds = [...new Set([...moduleCourseIds.values()].filter((x): x is string => Boolean(x)))];
    const courseTitles = new Map<string, string>();
    if (courseIds.length > 0) {
      const { data: cRows } = await supabase.from('courses').select('id, title').in('id', courseIds);
      for (const c of (cRows ?? []) as Array<{ id: string; title: string }>) courseTitles.set(c.id, c.title);
    }
    return {
      status: 'success',
      data: rows.map((r) => {
        const moduleId = lessonModuleIds.get(r.lesson_id);
        const courseId = moduleId ? moduleCourseIds.get(moduleId) : undefined;
        return {
          id: r.id,
          lessonTitle: lessonTitles.get(r.lesson_id) ?? '',
          courseTitle: courseId ? (courseTitles.get(courseId) ?? '') : '',
          score: r.score,
          total: r.total,
          submittedAt: r.submitted_at,
        };
      }),
    };
  } catch (err) {
    return errorState<QuizAttemptItem[]>(err, 'Không tải được điểm quiz.');
  }
}

export async function getMyNotifications(
  client?: AnyClient,
): Promise<DashboardState<NotificationItem[]>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, action_url, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error), isOffline: false };
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      type: string;
      title: string;
      body: string | null;
      action_url: string | null;
      is_read: boolean;
      created_at: string;
    }>;
    return {
      status: 'success',
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        actionUrl: r.action_url,
        isRead: r.is_read,
        createdAt: r.created_at,
      })),
    };
  } catch (err) {
    return errorState<NotificationItem[]>(err, 'Không tải được thông báo.');
  }
}

export async function markNotificationRead(
  notificationId: string,
  client?: AnyClient,
): Promise<{ status: 'ok' } | { status: 'error'; message: string }> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'error', message: 'Bạn chưa đăng nhập.' };
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error) };
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Không đánh dấu được thông báo.' };
  }
}

export async function markAllNotificationsRead(
  client?: AnyClient,
): Promise<{ status: 'ok'; updated: number } | { status: 'error'; message: string }> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'error', message: 'Bạn chưa đăng nhập.' };
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error) };
    return { status: 'ok', updated: (data ?? []).length };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Không đánh dấu được thông báo.' };
  }
}

export async function getMyCertificates(
  client?: AnyClient,
): Promise<DashboardState<CertificateItem[]>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    const { data, error } = await supabase
      .from('certificates')
      .select('id, certificate_code, status, issued_at, course_id, courses(title, slug)')
      .eq('user_id', userId)
      .order('issued_at', { ascending: false });
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error), isOffline: false };
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      certificate_code: string;
      status: string;
      issued_at: string;
      course_id: string;
      courses: { title: string; slug: string } | null;
    }>;
    return {
      status: 'success',
      data: rows.map((r) => ({
        id: r.id,
        certificateCode: r.certificate_code,
        courseTitle: r.courses?.title ?? '(Khóa học đã gỡ)',
        courseSlug: r.courses?.slug ?? '',
        status: r.status,
        issuedAt: r.issued_at,
      })),
    };
  } catch (err) {
    return errorState<CertificateItem[]>(err, 'Không tải được chứng chỉ.');
  }
}

export async function getMyOrders(client?: AnyClient): Promise<DashboardState<OrderItem[]>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    const { data, error } = await supabase
      .from('orders')
      .select('id, reference_code, status, amount_vnd, payment_method, created_at, paid_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error), isOffline: false };
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      reference_code: string;
      status: string;
      amount_vnd: number;
      payment_method: string | null;
      created_at: string;
      paid_at: string | null;
    }>;
    if (rows.length === 0) return { status: 'success', data: [] };

    const orderIds = rows.map((r) => r.id);
    const { data: itemRows, error: itemErr } = await supabase
      .from('order_items')
      .select('id, order_id, item_name, unit_price_vnd, quantity, total_vnd')
      .in('order_id', orderIds);
    if (itemErr) return { status: 'error', message: mapSupabaseErrorMessage(itemErr), isOffline: false };
    const lines = (itemRows ?? []) as unknown as Array<{
      id: string;
      order_id: string;
      item_name: string;
      unit_price_vnd: number;
      quantity: number;
      total_vnd: number;
    }>;
    return {
      status: 'success',
      data: rows.map((r) => ({
        id: r.id,
        referenceCode: r.reference_code,
        status: r.status,
        amountVnd: r.amount_vnd,
        paymentMethod: r.payment_method,
        createdAt: r.created_at,
        paidAt: r.paid_at,
        items: lines
          .filter((l) => l.order_id === r.id)
          .map((l) => ({
            id: l.id,
            itemName: l.item_name,
            unitPriceVnd: l.unit_price_vnd,
            quantity: l.quantity,
            totalVnd: l.total_vnd,
          })),
      })),
    };
  } catch (err) {
    return errorState<OrderItem[]>(err, 'Không tải được đơn hàng.');
  }
}

export type UpdateProfileResult =
  | { status: 'ok' }
  | { status: 'error'; message: string; fieldErrors: ProfileFieldError[] };

/**
 * Sua ho so: CHI gui full_name / phone / province. Khong bao gio gui
 * role / email — hai truong nay chi dong bo tu auth / user_roles.
 */
export async function updateMyProfile(
  input: ProfileUpdateInput,
  client?: AnyClient,
): Promise<UpdateProfileResult> {
  const fieldErrors = validateProfileUpdate(input);
  if (fieldErrors.length > 0) {
    return { status: 'error', message: 'Vui lòng kiểm tra lại thông tin đã nhập.', fieldErrors };
  }
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.', fieldErrors: [] };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'error', message: 'Bạn chưa đăng nhập.', fieldErrors: [] };
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: input.fullName.trim(),
        phone: input.phone.trim() === '' ? null : input.phone.trim(),
        province: input.province.trim() === '' ? null : input.province.trim(),
      })
      .eq('id', userId);
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error), fieldErrors: [] };
    return { status: 'ok' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không lưu được hồ sơ.',
      fieldErrors: [],
    };
  }
}

export type UploadAvatarResult =
  | { status: 'ok'; publicUrl: string }
  | { status: 'error'; message: string };

/**
 * Upload anh dai dien len bucket Storage `avatars` (public), duong dan
 * <userId>/avatar.<ext> — policy RLS chi chu so huu duoc ghi (xem
 * migration 0008). Sau upload, cap nhat profiles.avatar_url.
 */
export async function uploadMyAvatar(
  file: { name: string; size: number; type: string },
  fileBlob: Blob,
  client?: AnyClient,
): Promise<UploadAvatarResult> {
  const validationError = validateAvatarFile(file);
  if (validationError) return { status: 'error', message: validationError };
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'error', message: 'Bạn chưa đăng nhập.' };
    const path = avatarStoragePath(userId, file.name);
    if (!path) return { status: 'error', message: 'Định dạng ảnh chưa hỗ trợ.' };
    const { error: uploadErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, fileBlob, { upsert: true, contentType: file.type });
    if (uploadErr) return { status: 'error', message: mapSupabaseErrorMessage(uploadErr) };
    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);
    if (updateErr) return { status: 'error', message: mapSupabaseErrorMessage(updateErr) };
    return { status: 'ok', publicUrl };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không tải lên được ảnh đại diện.',
    };
  }
}
