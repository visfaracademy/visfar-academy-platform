// Data layer cho Admin Dashboard (/admin) — Task 09 phan 1/4.
//
// MOI so deu doc that tu Supabase (profiles, enrollments, courses,
// course_modules, lessons, orders, payments, lesson_progress) qua
// client da mang JWT cua admin (layout /admin da chan bang
// requireAdmin truoc khi page chay). KHONG mock, KHONG du lieu gia —
// chua co du lieu thi tra 0 / mang rong de UI hien empty state.
//
// Dinh nghia cac chi so (ghi ro de khoi hieu lam):
// - Tong hoc vien: so dong profiles (moi tai khoan = 1 hoc vien,
//   ke ca admin/instructor — day la so tai khoan tren he thong).
// - Hoc vien moi: profiles.created_at trong 30 ngay qua.
// - Hoc vien hoat dong: so user_id RIENG BIET co lesson_progress
//   cap nhat (updated_at) trong 30 ngay qua.
// - Tong khoa hoc: so dong courses (ca draft/published/archived).
// - Dang ky khoa hoc: so dong enrollments (trang thai active +
//   completed + revoked — tong dang ky; rieng active dem rieng).
// - Doanh thu: tong payments.amount_vnd voi status = 'succeeded'.
//   Neu bang payments chua co / truy van loi (vd. chua chay
//   migration) thi fallback sang tong orders.amount_vnd voi status =
//   'paid', va bao ro nguon qua `revenueSource` + `revenueWarning`
//   (khong im lang doi nguon). Ca hai deu loi -> error state.
// - Don hang: so dong orders; don da tra = status 'paid'.
// - Ty le hoan thanh: tong so bai da hoan thanh / tong so bai phai
//   hoc cua cac enrollment active + completed (khong tinh revoked),
//   theo nguong QĐ 17 (video >= 90%, bai text khi status =
//   'completed') — dung isLessonCompleted() cua dashboard.ts.
//   Tong bai cua 1 enrollment = so lesson cua khoa do (qua
//   course_modules -> lessons). Chua co enrollment / khoa chua co
//   bai -> 0%.
//
// Gioi han thuc te: cac tong tien / danh sach doc theo trang 1000
// dong (PostgREST), toi da 10 trang (10.000 dong) — du cho quy mo
// 100–1.000 hoc vien cua Visfar Academy; vuot qua thi can RPC
// aggregate o server. Dem so luong dung head:true (khong tai dong).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  formatVnd,
  isLessonCompleted,
  mapSupabaseErrorMessage,
  type DashboardState,
  type LessonRow,
  type ProgressRow,
} from './dashboard';

export const ACTIVE_STUDENT_DAYS = 30;
export const NEW_STUDENT_DAYS = 30;
export const RECENT_ENROLLMENTS_LIMIT = 10;
/** So dong toi da doc moi trang khi tinh tong (PostgREST). */
export const PAGE_SIZE = 1000;
/** So trang toi da khi tinh tong — 10 trang = 10.000 dong. */
export const MAX_SUM_PAGES = 10;

export interface CourseDashboardRow {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  totalLessons: number;
  enrollmentCount: number;
  activeEnrollmentCount: number;
  completedLessons: number;
  completionRate: number;
}

export interface RecentEnrollmentItem {
  enrollmentId: string;
  studentName: string | null;
  studentEmail: string | null;
  courseTitle: string;
  status: string;
  enrolledAt: string;
}

export type RevenueSource = 'payments' | 'orders' | 'none';

export interface AdminDashboardStats {
  totalStudents: number;
  newStudents: number;
  activeStudents: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  activeEnrollments: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenueVnd: number;
  revenueSource: RevenueSource;
  /** Ghi chu khi doanh thu khong lay tu payments (fallback / khong co du lieu). */
  revenueWarning: string | null;
  /** Ty le hoan thanh chung 0–100 (lam tron). */
  completionRate: number;
  totalLessonsToLearn: number;
  completedLessons: number;
  courses: CourseDashboardRow[];
  recentEnrollments: RecentEnrollmentItem[];
}

export type AdminDashboardState = DashboardState<AdminDashboardStats>;

export { formatVnd };

/** Ty le hoan thanh 0–100 (lam tron); mau so 0 -> 0, khong chia cho 0. */
export function computeCompletionRate(totalLessons: number, completedLessons: number): number {
  if (totalLessons <= 0) return 0;
  const clamped = Math.min(Math.max(completedLessons, 0), totalLessons);
  return Math.round((clamped / totalLessons) * 100);
}

/** Tong tien: chi cong so nguyen >= 0, bo qua gia tri khong hop le. */
export function sumRevenue(amounts: Array<number | null | undefined>): number {
  let total = 0;
  for (const a of amounts) {
    if (typeof a === 'number' && Number.isFinite(a) && a > 0) total += Math.floor(a);
  }
  return total;
}

/** Dem so user_id rieng biet trong cac dong tien do (dang hoat dong). */
export function countDistinctUsers(rows: Array<{ user_id: string | null | undefined }>): number {
  const seen = new Set<string>();
  for (const r of rows) {
    if (typeof r.user_id === 'string' && r.user_id !== '') seen.add(r.user_id);
  }
  return seen.size;
}

/** Moc thoi gian ISO: `days` ngay truoc `now` (mac dinh: hien tai). */
export function daysAgoIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

type AnyClient = SupabaseClient;

interface CountResult {
  count: number | null;
  error: { message?: string; code?: string } | null;
}

async function fetchCount(
  client: AnyClient,
  table: string,
  filter?: (q: {
    gte: (col: string, v: string) => unknown;
    eq: (col: string, v: string) => unknown;
  }) => unknown,
): Promise<CountResult> {
  // select(..., { count: 'exact', head: true }) chi tra count, khong tai dong.
  const q = client.from(table).select('id', { count: 'exact', head: true });
  if (filter) {
    // filter chi dung gte/eq — giu kieu long de test fake client de mo phong.
    filter(q as unknown as { gte: (c: string, v: string) => unknown; eq: (c: string, v: string) => unknown });
  }
  const res = (await q) as unknown as CountResult;
  return res;
}

/**
 * Doc het 1 cot so theo trang (range) — dung khi can tong tien hoac
 * dem distinct. Dung lai khi trang tra it hon PAGE_SIZE hoac het
 * MAX_SUM_PAGES trang. Tra { values, error }.
 */
async function fetchPagedNumbers(
  client: AnyClient,
  table: string,
  column: string,
  statusColumn: string,
  statusValue: string,
): Promise<{ values: number[]; error: { message?: string; code?: string } | null }> {
  const values: number[] = [];
  for (let page = 0; page < MAX_SUM_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = (await client
      .from(table)
      .select(column)
      .eq(statusColumn, statusValue)
      .range(from, to)) as unknown as {
      data: Array<Record<string, unknown>> | null;
      error: { message?: string; code?: string } | null;
    };
    if (error) return { values, error };
    const rows = data ?? [];
    for (const r of rows) {
      const v = r[column];
      if (typeof v === 'number') values.push(v);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return { values, error: null };
}

function isMissingTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    /Could not find the table/i.test(error.message ?? '') ||
    /PGRST205/.test(error.message ?? '')
  );
}

interface EnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
}

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface ModuleRow {
  id: string;
  course_id: string;
}

interface ProgressRowFull extends ProgressRow {
  user_id: string;
  updated_at: string;
}

/**
 * Tong quan admin: doc that tu Supabase. Client phai la client server
 * da mang JWT admin (layout /admin da requireAdmin truoc). `now` chi
 * dung de test (moc 30 ngay); mac dinh lay thoi diem goi ham.
 */
export async function getAdminDashboardStats(
  client: AnyClient,
  opts: { now?: Date; activeDays?: number; newDays?: number } = {},
): Promise<AdminDashboardState> {
  const now = opts.now ?? new Date();
  const activeDays = opts.activeDays ?? ACTIVE_STUDENT_DAYS;
  const newDays = opts.newDays ?? NEW_STUDENT_DAYS;
  const activeSince = daysAgoIso(activeDays, now);
  const newSince = daysAgoIso(newDays, now);

  try {
    const [
      totalStudentsRes,
      newStudentsRes,
      totalCoursesRes,
      publishedCoursesRes,
      totalEnrollmentsRes,
      activeEnrollmentsRes,
      totalOrdersRes,
      paidOrdersRes,
    ] = await Promise.all([
      fetchCount(client, 'profiles'),
      fetchCount(client, 'profiles', (q) => q.gte('created_at', newSince)),
      fetchCount(client, 'courses'),
      fetchCount(client, 'courses', (q) => q.eq('status', 'published')),
      fetchCount(client, 'enrollments'),
      fetchCount(client, 'enrollments', (q) => q.eq('status', 'active')),
      fetchCount(client, 'orders'),
      fetchCount(client, 'orders', (q) => q.eq('status', 'paid')),
    ]);
    const countResults = [
      totalStudentsRes,
      newStudentsRes,
      totalCoursesRes,
      publishedCoursesRes,
      totalEnrollmentsRes,
      activeEnrollmentsRes,
      totalOrdersRes,
      paidOrdersRes,
    ];
    for (const r of countResults) {
      if (r.error) {
        return { status: 'error', message: mapSupabaseErrorMessage(r.error), isOffline: false };
      }
    }

    // Doanh thu: uu tien payments succeeded; loi (vd. bang chua co)
    // thi fallback sang orders paid va bao ro nguon.
    let totalRevenueVnd = 0;
    let revenueSource: RevenueSource = 'none';
    let revenueWarning: string | null = null;
    const payments = await fetchPagedNumbers(client, 'payments', 'amount_vnd', 'status', 'succeeded');
    if (!payments.error) {
      totalRevenueVnd = sumRevenue(payments.values);
      revenueSource = 'payments';
    } else {
      const ordersPaid = await fetchPagedNumbers(client, 'orders', 'amount_vnd', 'status', 'paid');
      if (ordersPaid.error) {
        return { status: 'error', message: mapSupabaseErrorMessage(payments.error), isOffline: false };
      }
      totalRevenueVnd = sumRevenue(ordersPaid.values);
      revenueSource = 'orders';
      revenueWarning = isMissingTableError(payments.error)
        ? 'Bảng payments chưa sẵn sàng nên doanh thu đang tính từ đơn hàng đã thanh toán (orders).'
        : `Không đọc được payments (${payments.error.message ?? 'lỗi không rõ'}) nên doanh thu đang tính từ đơn hàng đã thanh toán (orders).`;
    }

    // Hoc vien hoat dong: user_id rieng biet co lesson_progress
    // cap nhat trong `activeDays` ngay qua. Chi dung cot 0001
    // (updated_at) — khong dung last_accessed (cot 0012, co the
    // chua co tren DB cu) de query khong loi 400.
    const { data: activeRows, error: activeErr } = (await client
      .from('lesson_progress')
      .select('user_id')
      .gte('updated_at', activeSince)
      .limit(PAGE_SIZE)) as unknown as {
      data: Array<{ user_id: string }> | null;
      error: { message?: string; code?: string } | null;
    };
    if (activeErr) {
      return { status: 'error', message: mapSupabaseErrorMessage(activeErr), isOffline: false };
    }
    const activeStudents = countDistinctUsers(activeRows ?? []);

    // Du lieu cho ty le hoan thanh + bang theo khoa + dang ky gan day.
    const { data: courseRows, error: courseErr } = (await client
      .from('courses')
      .select('id, title, slug, status')
      .order('display_order', { ascending: true })) as unknown as {
      data: CourseRow[] | null;
      error: { message?: string; code?: string } | null;
    };
    if (courseErr) {
      return { status: 'error', message: mapSupabaseErrorMessage(courseErr), isOffline: false };
    }
    const courses = courseRows ?? [];

    const { data: enrollmentRows, error: enrollErr } = (await client
      .from('enrollments')
      .select('id, user_id, course_id, status, enrolled_at')
      .order('enrolled_at', { ascending: false })
      .limit(PAGE_SIZE)) as unknown as {
      data: EnrollmentRow[] | null;
      error: { message?: string; code?: string } | null;
    };
    if (enrollErr) {
      return { status: 'error', message: mapSupabaseErrorMessage(enrollErr), isOffline: false };
    }
    const enrollments = enrollmentRows ?? [];

    const { data: moduleRows, error: modErr } = (await client
      .from('course_modules')
      .select('id, course_id')) as unknown as {
      data: ModuleRow[] | null;
      error: { message?: string; code?: string } | null;
    };
    if (modErr) {
      return { status: 'error', message: mapSupabaseErrorMessage(modErr), isOffline: false };
    }
    const modules = moduleRows ?? [];
    const moduleIds = modules.map((m) => m.id);
    const moduleCourseId = new Map(modules.map((m) => [m.id, m.course_id]));

    let lessons: LessonRow[] = [];
    if (moduleIds.length > 0) {
      const { data: lessonRows, error: lessonErr } = (await client
        .from('lessons')
        .select('id, course_module_id, type')
        .in('course_module_id', moduleIds)) as unknown as {
        data: LessonRow[] | null;
        error: { message?: string; code?: string } | null;
      };
      if (lessonErr) {
        return { status: 'error', message: mapSupabaseErrorMessage(lessonErr), isOffline: false };
      }
      lessons = lessonRows ?? [];
    }
    const lessonCourseId = new Map<string, string>();
    const lessonsByCourse = new Map<string, LessonRow[]>();
    for (const l of lessons) {
      const cid = moduleCourseId.get(l.course_module_id);
      if (!cid) continue;
      lessonCourseId.set(l.id, cid);
      const list = lessonsByCourse.get(cid) ?? [];
      list.push(l);
      lessonsByCourse.set(cid, list);
    }

    const { data: progressRows, error: progErr } = (await client
      .from('lesson_progress')
      .select('user_id, lesson_id, status, progress_percent, updated_at')
      .limit(PAGE_SIZE)) as unknown as {
      data: ProgressRowFull[] | null;
      error: { message?: string; code?: string } | null;
    };
    if (progErr) {
      return { status: 'error', message: mapSupabaseErrorMessage(progErr), isOffline: false };
    }
    const progressByUserLesson = new Map<string, ProgressRowFull>();
    for (const p of progressRows ?? []) {
      progressByUserLesson.set(`${p.user_id}:${p.lesson_id}`, p);
    }

    // Chi enrollment active/completed moi tinh vao ty le hoan thanh;
    // revoked da mat quyen hoc nen khong tinh.
    const countable = enrollments.filter((e) => e.status === 'active' || e.status === 'completed');
    let totalLessonsToLearn = 0;
    let completedLessons = 0;
    const perCourse = new Map<string, { enrollments: number; active: number; completed: number; total: number }>();
    for (const e of countable) {
      const courseLessons = lessonsByCourse.get(e.course_id) ?? [];
      const done = courseLessons.filter((l) =>
        isLessonCompleted(l.type, progressByUserLesson.get(`${e.user_id}:${l.id}`)),
      ).length;
      totalLessonsToLearn += courseLessons.length;
      completedLessons += done;
      const agg = perCourse.get(e.course_id) ?? { enrollments: 0, active: 0, completed: 0, total: 0 };
      agg.enrollments += 1;
      if (e.status === 'active') agg.active += 1;
      agg.completed += done;
      agg.total += courseLessons.length;
      perCourse.set(e.course_id, agg);
    }

    const courseRowsOut: CourseDashboardRow[] = courses.map((c) => {
      const agg = perCourse.get(c.id) ?? { enrollments: 0, active: 0, completed: 0, total: 0 };
      const total = lessonsByCourse.get(c.id)?.length ?? 0;
      return {
        courseId: c.id,
        courseTitle: c.title,
        courseSlug: c.slug,
        status: c.status,
        totalLessons: total,
        enrollmentCount: agg.enrollments,
        activeEnrollmentCount: agg.active,
        completedLessons: agg.completed,
        completionRate: computeCompletionRate(agg.total, agg.completed),
      };
    });

    // Dang ky gan day (10 moi nhat) kem ten hoc vien + ten khoa.
    const recentIds = enrollments.slice(0, RECENT_ENROLLMENTS_LIMIT).map((e) => e.id);
    let recentEnrollments: RecentEnrollmentItem[] = [];
    if (recentIds.length > 0) {
      const { data: recentRows, error: recentErr } = (await client
        .from('enrollments')
        .select('id, status, enrolled_at, profiles(full_name, email), courses(title)')
        .in('id', recentIds)
        .order('enrolled_at', { ascending: false })) as unknown as {
        data: Array<{
          id: string;
          status: string;
          enrolled_at: string;
          profiles: { full_name: string | null; email: string | null } | null;
          courses: { title: string } | null;
        }> | null;
        error: { message?: string; code?: string } | null;
      };
      if (recentErr) {
        return { status: 'error', message: mapSupabaseErrorMessage(recentErr), isOffline: false };
      }
      recentEnrollments = (recentRows ?? []).map((r) => ({
        enrollmentId: r.id,
        studentName: r.profiles?.full_name ?? null,
        studentEmail: r.profiles?.email ?? null,
        courseTitle: r.courses?.title ?? '(Khóa học đã gỡ)',
        status: r.status,
        enrolledAt: r.enrolled_at,
      }));
    }

    return {
      status: 'success',
      data: {
        totalStudents: totalStudentsRes.count ?? 0,
        newStudents: newStudentsRes.count ?? 0,
        activeStudents,
        totalCourses: totalCoursesRes.count ?? 0,
        publishedCourses: publishedCoursesRes.count ?? 0,
        totalEnrollments: totalEnrollmentsRes.count ?? 0,
        activeEnrollments: activeEnrollmentsRes.count ?? 0,
        totalOrders: totalOrdersRes.count ?? 0,
        paidOrders: paidOrdersRes.count ?? 0,
        totalRevenueVnd,
        revenueSource,
        revenueWarning,
        completionRate: computeCompletionRate(totalLessonsToLearn, completedLessons),
        totalLessonsToLearn,
        completedLessons,
        courses: courseRowsOut,
        recentEnrollments,
      },
    };
  } catch (err) {
    const isOffline =
      err instanceof TypeError ||
      (err instanceof Error && /network|fetch|Failed to fetch|Load failed|NetworkError/i.test(err.message));
    return {
      status: 'error',
      message: isOffline
        ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.'
        : err instanceof Error
          ? err.message
          : 'Không tải được dữ liệu tổng quan.',
      isOffline,
    };
  }
}
