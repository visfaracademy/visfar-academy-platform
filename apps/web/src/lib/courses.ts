// Doc khoa hoc that tu Supabase (bang courses, status=published).
// Khong co du lieu mau, khong co fallback gia — loi thi tra loi ro rang.
import type { Course } from '@visfar/shared';
import { normalizePillar } from '@visfar/shared';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { normalizeSearch } from './validation';

export type CoursesState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'success'; courses: Course[] }
  | { status: 'error'; message: string; isOffline: boolean };

/** Giảng viên phụ trách tất cả khóa học — user chốt ngày 11/11/2026 (QĐ 37).
    Tên "Ngô Mạnh Cường" là tên bịa cũ, không còn xuất hiện ở bất kỳ đâu
    (repo, git history, DB prod/staging, live HTML đều = 0).
    Phân công thật nằm ở bảng course_instructors (lead = tài khoản Lê Đăng Quyết). */
export const LEAD_INSTRUCTOR_NAME = 'Lê Đăng Quyết';

export async function fetchPublishedCourses(): Promise<CoursesState> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const supabase = getSupabaseClient();
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('display_order', { ascending: true });
    if (error) return { status: 'error', message: error.message, isOffline: false };
    return { status: 'success', courses: (data ?? []) as Course[] };
  } catch (err) {
    const isOffline =
      err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
    return {
      status: 'error',
      message: isOffline
        ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.'
        : err instanceof Error
          ? err.message
          : 'Không tải được danh sách khóa học.',
      isOffline,
    };
  }
}

export async function fetchCourseBySlug(
  slug: string,
): Promise<
  | { status: 'not-configured' }
  | { status: 'success'; course: Course | null }
  | { status: 'error'; message: string; isOffline: boolean }
> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const supabase = getSupabaseClient();
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return { status: 'error', message: error.message, isOffline: false };
    return { status: 'success', course: (data as Course | null) ?? null };
  } catch (err) {
    const isOffline =
      err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
    return {
      status: 'error',
      message: isOffline
        ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.'
        : err instanceof Error
          ? err.message
          : 'Không tải được khóa học.',
      isOffline,
    };
  }
}

/** Loc client-side: theo pillar + tim kiem khong dau trong title/subtitle/description.
    Khoa 'tich-hop' tich hop ca 3 tru cot Than–Tam–Tue nen hien duoi ca 3 tab tru cot.
    normalizePillar() map gia tri cu trong DB sang bo moi (xoa sau migration 0024). */
export function filterCourses(
  courses: Course[],
  query: string,
  pillar: string,
): Course[] {
  const q = normalizeSearch(query);
  return courses.filter((c) => {
    if (pillar !== 'all') {
      const p = normalizePillar(c.pillar, c.slug);
      const isIntegrated = p === 'tich-hop';
      const isPillarTab = pillar === 'than' || pillar === 'tam' || pillar === 'tue';
      if (p !== pillar && !(isIntegrated && isPillarTab)) return false;
    }
    if (!q) return true;
    const haystack = normalizeSearch(
      [c.title, c.subtitle ?? '', c.description ?? ''].join(' '),
    );
    return q.split(/\s+/).every((w) => haystack.includes(w));
  });
}
