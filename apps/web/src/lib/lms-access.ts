// Kiem tra quyen hoc PHIA SERVER — Task 07 phan 3/4 (SECURITY).
//
// NGUYEN TAC: chi enrollment status 'active' (hoac 'completed') moi
// xem duoc bai tra phi. Kiem tra chay o Server Component / Route
// Handler, truoc khi tra bat ky noi dung nao — KHONG chi an nut o
// client, KHONG dua video_url / file_url / content vao HTML cho
// nguoi chua duoc phep. Bai xem thu (is_free_preview) duoc xem
// video mau qua API guard (chi video_url, khong content/file_url —
// xem sanitizeLessonForPreview + view lessons_preview_video, 0028);
// admin va instructor khoa phu trach duoc xem moi bai (ke ca khoa
// draft / bai chua xuat ban) de kiem tra noi dung.
//
// Cac ham o day nhan SupabaseClient da mang JWT nguoi goi (xem
// supabase-server.ts) nen RLS van ap dung; getUser() verify token
// that qua Auth API. Ham thuan decideLessonAccess() tach rieng de
// unit test khong can DB.
import type { SupabaseClient } from '@supabase/supabase-js';

export type EnrollmentStatus = 'active' | 'completed' | 'revoked' | string;

export type LessonAccessReason =
  | 'ok' // Duoc xem day du
  | 'ok-preview' // Chi duoc xem ban xem thu (khong co URL/noi dung day du)
  | 'unauthenticated' // Chua dang nhap
  | 'not-enrolled' // Da dang nhap nhung khong co enrollment active/completed
  | 'revoked' // Enrollment da bi thu hoi
  | 'not-published' // Khoa draft/archived hoac bai chua xuat ban
  | 'not-found'; // Khong co khoa/bai voi slug da cho

export interface LessonAccessDecision {
  allowed: boolean;
  reason: LessonAccessReason;
  /** Chi co khi allowed: 'active' | 'completed' | null (admin/instructor/preview). */
  enrollmentStatus: EnrollmentStatus | null;
  isAdmin: boolean;
  isInstructor: boolean;
}

export interface LessonRow {
  id: string;
  course_module_id: string;
  slug: string;
  title: string;
  type: string;
  content: string | null;
  video_url: string | null;
  video_duration_sec: number | null;
  file_url: string | null;
  display_order: number;
  is_free_preview: boolean;
  is_published?: boolean | null;
}

export interface CourseRow {
  id: string;
  slug: string;
  title: string;
  status: string;
}

/**
 * Ban xem thu: chi metadata + video_url cua bai mau, KHONG co
 * content / file_url. Video la mau mien phi (YouTube unlisted,
 * QĐ 16) nen duoc tra qua API guard cho nguoi da dang nhap chua
 * ghi danh; content text + file tai lieu van giu kin.
 * (S-03 / 0028: video_url lay tu view lessons_preview_video,
 * khong doc truc tiep bang lessons.)
 */
export type PreviewLesson = Pick<
  LessonRow,
  'id' | 'course_module_id' | 'slug' | 'title' | 'type' | 'video_duration_sec' | 'display_order' | 'is_free_preview'
> & { video_url: string | null };

export function sanitizeLessonForPreview(lesson: LessonRow, videoUrl: string | null = null): PreviewLesson {
  return {
    id: lesson.id,
    course_module_id: lesson.course_module_id,
    slug: lesson.slug,
    title: lesson.title,
    type: lesson.type,
    video_duration_sec: lesson.video_duration_sec,
    display_order: lesson.display_order,
    is_free_preview: lesson.is_free_preview,
    video_url: videoUrl,
  };
}

/**
 * Quyet dinh thuan — lop duy nhat duoc phep tra 'allowed'.
 * Thu tu uu tien: admin/instructor > bai chua xuat ban > xem thu >
 * enrollment active/completed > revoked > chua ghi danh.
 */
export function decideLessonAccess(input: {
  isAdmin: boolean;
  isInstructorOfCourse: boolean;
  enrollmentStatus: EnrollmentStatus | null;
  isFreePreview: boolean;
  courseStatus: string;
  lessonPublished: boolean;
}): LessonAccessDecision {
  const base = {
    enrollmentStatus: input.enrollmentStatus,
    isAdmin: input.isAdmin,
    isInstructor: input.isInstructorOfCourse,
  };
  // Admin / instructor khoa phu trach xem duoc moi bai de kiem tra.
  if (input.isAdmin || input.isInstructorOfCourse) {
    return { ...base, allowed: true, reason: 'ok' };
  }
  // Khoa chua xuat ban hoac bai chua xuat ban: hoc vien khong thay.
  if (input.courseStatus !== 'published' || !input.lessonPublished) {
    return { ...base, allowed: false, reason: 'not-published' };
  }
  // Bai xem thu: xem duoc ban preview, khong can enrollment.
  if (input.isFreePreview) {
    return { ...base, allowed: true, reason: 'ok-preview' };
  }
  // Enrollment bi thu hoi: mat quyen ngay lap tuc (khong cho xem lai
  // du bai da hoc truoc do — kiem tra lai moi request, khong cache).
  if (input.enrollmentStatus === 'revoked') {
    return { ...base, allowed: false, reason: 'revoked' };
  }
  if (input.enrollmentStatus === 'active' || input.enrollmentStatus === 'completed') {
    return { ...base, allowed: true, reason: 'ok' };
  }
  return { ...base, allowed: false, reason: 'not-enrolled' };
}

export type LessonAccessResult =
  | {
      allowed: true;
      reason: 'ok' | 'ok-preview';
      course: CourseRow;
      /** Day du khi reason='ok'; ban preview (khong URL) khi 'ok-preview'. */
      lesson: LessonRow | PreviewLesson;
      enrollmentStatus: EnrollmentStatus | null;
      isAdmin: boolean;
      isInstructor: boolean;
    }
  | {
      allowed: false;
      reason: Exclude<LessonAccessReason, 'ok' | 'ok-preview'>;
      course: CourseRow | null;
      lesson: null;
      enrollmentStatus: EnrollmentStatus | null;
      isAdmin: boolean;
      isInstructor: boolean;
    };

async function fetchCourseBySlug(
  client: SupabaseClient,
  courseSlug: string,
): Promise<CourseRow | null> {
  const { data, error } = await client
    .from('courses')
    .select('id, slug, title, status')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CourseRow;
}

const LESSON_META_COLUMNS =
  'id, course_module_id, slug, title, type, video_duration_sec, display_order, is_free_preview, is_published';
const LESSON_FULL_COLUMNS =
  'id, course_module_id, slug, title, type, content, video_url, video_duration_sec, file_url, display_order, is_free_preview, is_published';

/**
 * S-03 / 0028: metadata bai hoc CHI doc qua view lessons_public
 * (khong co content / video_url / file_url) — view nay ai cung doc
 * duoc nen guard van phan biet duoc not-found / not-enrolled /
 * revoked / not-published ngay ca khi RLS bang lessons chan dong.
 * Noi dung day du CHI doc truc tiep bang lessons khi quyet dinh
 * la 'ok' (RLS moi cho phep: da ghi danh / admin / instructor).
 * Video bai xem thu CHI doc qua view lessons_preview_video.
 */
async function fetchLessonMetaBySlug(
  client: SupabaseClient,
  courseId: string,
  lessonSlug: string,
): Promise<LessonRow | null> {
  const { data: modules, error: modErr } = await client
    .from('course_modules')
    .select('id')
    .eq('course_id', courseId);
  if (modErr || !modules || modules.length === 0) return null;
  const moduleIds = (modules as Array<{ id: string }>).map((m) => m.id);
  const { data, error } = await client
    .from('lessons_public')
    .select(LESSON_META_COLUMNS)
    .in('course_module_id', moduleIds)
    .eq('slug', lessonSlug)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as unknown as LessonRow), content: null, video_url: null, file_url: null };
}

async function fetchLessonMetaById(
  client: SupabaseClient,
  lessonId: string,
): Promise<{ lesson: LessonRow; course: CourseRow } | null> {
  const { data, error } = await client
    .from('lessons_public')
    .select(LESSON_META_COLUMNS)
    .eq('id', lessonId)
    .maybeSingle();
  if (error || !data) return null;
  const lesson = {
    ...(data as unknown as LessonRow),
    content: null,
    video_url: null,
    file_url: null,
  };
  const { data: mod, error: modErr } = await client
    .from('course_modules')
    .select('id, course_id, courses(id, slug, title, status)')
    .eq('id', lesson.course_module_id)
    .maybeSingle();
  if (modErr || !mod) return null;
  const row = mod as unknown as {
    courses: CourseRow | null;
  };
  if (!row.courses) return null;
  return { lesson, course: row.courses };
}

/** Doc day du 1 dong bang lessons — CHI goi khi quyet dinh la 'ok'. */
async function fetchLessonFullById(
  client: SupabaseClient,
  lessonId: string,
): Promise<LessonRow | null> {
  const { data, error } = await client
    .from('lessons')
    .select(LESSON_FULL_COLUMNS)
    .eq('id', lessonId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as LessonRow;
}

/** Video bai xem thu — CHI qua view lessons_preview_video. */
async function fetchPreviewVideoById(
  client: SupabaseClient,
  lessonId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('lessons_preview_video')
    .select('id, video_url')
    .eq('id', lessonId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown as { video_url?: string | null }).video_url ?? null;
}

interface AccessContext {
  userId: string;
  isAdmin: boolean;
  isInstructor: boolean;
  enrollmentStatus: EnrollmentStatus | null;
}

async function loadAccessContext(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<AccessContext> {
  // Role: user_roles la nguon su that (Task 03 QĐ 3); profiles.role chi
  // la cache — doc ca hai, admin o 1 trong 2 thi tinh la admin.
  const [{ data: roleRows }, { data: profile }, { data: enroll }, { data: instr }] =
    await Promise.all([
      client.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin'),
      client.from('profiles').select('role').eq('id', userId).maybeSingle(),
      client
        .from('enrollments')
        .select('status')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle(),
      client
        .from('course_instructors')
        .select('course_id')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
  const isAdmin =
    (Array.isArray(roleRows) && roleRows.length > 0) ||
    (profile as { role?: string } | null)?.role === 'admin';
  return {
    userId,
    isAdmin,
    isInstructor: Boolean(instr),
    enrollmentStatus: (enroll as { status?: string } | null)?.status ?? null,
  };
}

function toResult(
  decision: LessonAccessDecision,
  course: CourseRow,
  lesson: LessonRow,
  previewVideoUrl: string | null = null,
): LessonAccessResult {
  if (!decision.allowed) {
    return {
      allowed: false,
      reason: decision.reason as Exclude<LessonAccessReason, 'ok' | 'ok-preview'>,
      course,
      lesson: null,
      enrollmentStatus: decision.enrollmentStatus,
      isAdmin: decision.isAdmin,
      isInstructor: decision.isInstructor,
    };
  }
  return {
    allowed: true,
    reason: decision.reason as 'ok' | 'ok-preview',
    course,
    lesson:
      decision.reason === 'ok-preview'
        ? sanitizeLessonForPreview(lesson, previewVideoUrl)
        : lesson,
    enrollmentStatus: decision.enrollmentStatus,
    isAdmin: decision.isAdmin,
    isInstructor: decision.isInstructor,
  };
}

/**
 * Gop noi dung theo quyet dinh: 'ok' -> doc day du bang lessons;
 * 'ok-preview' -> chi video_url qua view lessons_preview_video;
 * khong duoc phep -> lesson null. Tra null khi dong day du khong
 * doc duoc du quyet dinh 'ok' (RLS lech — fail-closed).
 */
async function resolveLessonContent(
  client: SupabaseClient,
  decision: LessonAccessDecision,
  meta: LessonRow,
): Promise<LessonRow | PreviewLesson | null> {
  if (decision.reason === 'ok') {
    return fetchLessonFullById(client, meta.id);
  }
  if (decision.reason === 'ok-preview') {
    const videoUrl = await fetchPreviewVideoById(client, meta.id);
    return sanitizeLessonForPreview(meta, videoUrl);
  }
  return null;
}

/**
 * Kiem tra quyen hoc 1 bai theo slug — dung o Server Component /
 * Route Handler truoc khi tra noi dung. Khong bao gio tra content /
 * video_url / file_url khi khong duoc phep (lesson = null hoac ban
 * preview da loc).
 */
export async function requireLessonAccess(
  client: SupabaseClient,
  input: { courseSlug: string; lessonSlug: string },
): Promise<LessonAccessResult> {
  const { data: authData } = await client.auth.getUser();
  const user = authData.user;
  if (!user) {
    return {
      allowed: false,
      reason: 'unauthenticated',
      course: null,
      lesson: null,
      enrollmentStatus: null,
      isAdmin: false,
      isInstructor: false,
    };
  }
  const course = await fetchCourseBySlug(client, input.courseSlug);
  if (!course) {
    return {
      allowed: false,
      reason: 'not-found',
      course: null,
      lesson: null,
      enrollmentStatus: null,
      isAdmin: false,
      isInstructor: false,
    };
  }
  const meta = await fetchLessonMetaBySlug(client, course.id, input.lessonSlug);
  if (!meta) {
    return {
      allowed: false,
      reason: 'not-found',
      course,
      lesson: null,
      enrollmentStatus: null,
      isAdmin: false,
      isInstructor: false,
    };
  }
  const ctx = await loadAccessContext(client, user.id, course.id);
  const decision = decideLessonAccess({
    isAdmin: ctx.isAdmin,
    isInstructorOfCourse: ctx.isInstructor,
    enrollmentStatus: ctx.enrollmentStatus,
    isFreePreview: meta.is_free_preview,
    courseStatus: course.status,
    lessonPublished: meta.is_published !== false,
  });
  if (!decision.allowed) return toResult(decision, course, meta);
  const content = await resolveLessonContent(client, decision, meta);
  if (decision.reason === 'ok' && content === null) {
    // RLS khong tra dong day du du quyet dinh 'ok' — fail-closed.
    return toResult({ ...decision, allowed: false, reason: 'not-enrolled' }, course, meta);
  }
  return {
    allowed: true,
    reason: decision.reason as 'ok' | 'ok-preview',
    course,
    lesson: content as LessonRow | PreviewLesson,
    enrollmentStatus: decision.enrollmentStatus,
    isAdmin: decision.isAdmin,
    isInstructor: decision.isInstructor,
  };
}

/** Bien the theo lesson id — dung cho API route /api/lms/lessons/[id]. */
export async function requireLessonAccessById(
  client: SupabaseClient,
  lessonId: string,
): Promise<LessonAccessResult> {
  const { data: authData } = await client.auth.getUser();
  const user = authData.user;
  if (!user) {
    return {
      allowed: false,
      reason: 'unauthenticated',
      course: null,
      lesson: null,
      enrollmentStatus: null,
      isAdmin: false,
      isInstructor: false,
    };
  }
  const found = await fetchLessonMetaById(client, lessonId);
  if (!found) {
    return {
      allowed: false,
      reason: 'not-found',
      course: null,
      lesson: null,
      enrollmentStatus: null,
      isAdmin: false,
      isInstructor: false,
    };
  }
  const ctx = await loadAccessContext(client, user.id, found.course.id);
  const decision = decideLessonAccess({
    isAdmin: ctx.isAdmin,
    isInstructorOfCourse: ctx.isInstructor,
    enrollmentStatus: ctx.enrollmentStatus,
    isFreePreview: found.lesson.is_free_preview,
    courseStatus: found.course.status,
    lessonPublished: found.lesson.is_published !== false,
  });
  if (!decision.allowed) return toResult(decision, found.course, found.lesson);
  const content = await resolveLessonContent(client, decision, found.lesson);
  if (decision.reason === 'ok' && content === null) {
    // RLS khong tra dong day du du quyet dinh 'ok' — fail-closed.
    return toResult({ ...decision, allowed: false, reason: 'not-enrolled' }, found.course, found.lesson);
  }
  return {
    allowed: true,
    reason: decision.reason as 'ok' | 'ok-preview',
    course: found.course,
    lesson: content as LessonRow | PreviewLesson,
    enrollmentStatus: decision.enrollmentStatus,
    isAdmin: decision.isAdmin,
    isInstructor: decision.isInstructor,
  };
}

/**
 * Kiem tra quyen admin phia server — dung o admin layout / API route.
 * Doc user_roles (nguon su that) + profiles.role (cache); admin o 1
 * trong 2 thi dat. Tra 'unauthenticated' khi khong co user hop le.
 */
export async function requireAdmin(
  client: SupabaseClient,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' }
> {
  const { data: authData } = await client.auth.getUser();
  const user = authData.user;
  if (!user) return { ok: false, reason: 'unauthenticated' };
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    client.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin'),
    client.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ]);
  const isAdmin =
    (Array.isArray(roleRows) && roleRows.length > 0) ||
    (profile as { role?: string } | null)?.role === 'admin';
  if (!isAdmin) return { ok: false, reason: 'forbidden' };
  return { ok: true, userId: user.id };
}
