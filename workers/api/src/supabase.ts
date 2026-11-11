// Supabase PostgREST client (service-role) — Workers cam service-role key,
// frontend KHONG BAO GIO thay key nay. Dung fetch truc tiep thay vi
// supabase-js de giu bundle nho va de mock trong test.
// RLS: service-role bypass RLS — phan quyen phai kiem tra o Workers
// (JWT + enrollment + role) TRUOC khi goi cac ham nay.
import type { Env } from './env';
import { ApiError, upstreamError } from './errors';

export interface PostgrestError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface SbResult<T> {
  data: T | null;
  error: PostgrestError | null;
  status: number;
}

function restUrl(env: Env, path: string): string {
  return `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1${path}`;
}

export async function sbFetch<T>(
  env: Env,
  path: string,
  init: RequestInit & { parseJson?: boolean } = {},
): Promise<SbResult<T>> {
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  let res: Response;
  try {
    res = await fetch(restUrl(env, path), { ...init, headers });
  } catch (err) {
    throw upstreamError('supabase', err instanceof Error ? err.message : 'fetch failed');
  }
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    const e = (parsed ?? {}) as PostgrestError;
    return {
      data: null,
      error: {
        message: typeof e.message === 'string' ? e.message : `Supabase HTTP ${res.status}`,
        code: typeof e.code === 'string' ? e.code : undefined,
        details: typeof e.details === 'string' ? e.details : undefined,
        hint: typeof e.hint === 'string' ? e.hint : undefined,
      },
      status: res.status,
    };
  }
  return { data: parsed as T, error: null, status: res.status };
}

export function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === '23505';
}

/** Nem 502 neu Supabase loi (tranh tra ok:true gia); tra null khi khong co dong. */
export function requireSbOk<T>(result: SbResult<T>, what: string): T | null {
  if (result.error) {
    throw upstreamError('supabase', `${what}: ${result.error.code ?? ''} ${result.error.message}`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Bang courses / leads
// ---------------------------------------------------------------------------

export interface CourseRow {
  id: string;
  status: string;
}

/** Kiem tra khoa ton tai + published. */
export async function getPublishedCourse(env: Env, courseId: string): Promise<CourseRow | null> {
  const result = await sbFetch<CourseRow[]>(
    env,
    `/courses?select=id,status&id=eq.${encodeURIComponent(courseId)}&status=eq.published&limit=1`,
  );
  const rows = requireSbOk(result, 'getPublishedCourse');
  return rows && rows.length > 0 ? (rows[0] as CourseRow) : null;
}

export interface LeadRow {
  id: string;
  reference_code: string;
  idempotency_key: string;
  full_name: string;
  phone: string;
  email: string;
  province: string;
  course_id: string | null;
  course_interest_text: string | null;
  source: string;
  status: string;
  created_at: string;
}

export async function getLeadByIdempotencyKey(
  env: Env,
  key: string,
): Promise<LeadRow | null> {
  const result = await sbFetch<LeadRow[]>(
    env,
    `/leads?select=id,reference_code,idempotency_key,full_name,phone,email,province,course_id,course_interest_text,source,status,created_at&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getLeadByIdempotencyKey');
  return rows && rows.length > 0 ? (rows[0] as LeadRow) : null;
}

export interface InsertLeadInput {
  reference_code: string;
  idempotency_key: string;
  full_name: string;
  phone: string;
  email: string;
  province: string;
  course_id: string | null;
  course_interest_text: string;
  source: string;
}

export async function insertLead(env: Env, input: InsertLeadInput): Promise<SbResult<LeadRow[]>> {
  return sbFetch<LeadRow[]>(env, '/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ ...input, status: 'new' }),
  });
}

// ---------------------------------------------------------------------------
// Bang lessons / enrollments / lesson_progress / quiz_attempts
// ---------------------------------------------------------------------------

export interface LessonRow {
  id: string;
  type: string;
  video_duration_sec: number | null;
  course_modules: { course_id: string } | null;
}

export async function getLesson(env: Env, lessonId: string): Promise<LessonRow | null> {
  const result = await sbFetch<LessonRow[]>(
    env,
    `/lessons?select=id,type,video_duration_sec,course_modules(course_id)&id=eq.${encodeURIComponent(lessonId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getLesson');
  return rows && rows.length > 0 ? (rows[0] as LessonRow) : null;
}

export interface EnrollmentRow {
  id: string;
  status: string;
}

export async function getEnrollment(
  env: Env,
  userId: string,
  courseId: string,
): Promise<EnrollmentRow | null> {
  const result = await sbFetch<EnrollmentRow[]>(
    env,
    `/enrollments?select=id,status&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getEnrollment');
  return rows && rows.length > 0 ? (rows[0] as EnrollmentRow) : null;
}

export interface ProgressRow {
  user_id: string;
  course_id: string | null;
  lesson_id: string;
  status: string;
  completion_status: string | null;
  progress_percent: number;
  video_position: number | null;
  last_position_sec: number | null;
  started_at: string | null;
  last_accessed: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProgressRow(
  env: Env,
  userId: string,
  lessonId: string,
): Promise<ProgressRow | null> {
  const result = await sbFetch<ProgressRow[]>(
    env,
    `/lesson_progress?select=user_id,course_id,lesson_id,status,completion_status,progress_percent,video_position,last_position_sec,started_at,last_accessed,completed_at,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&lesson_id=eq.${encodeURIComponent(lessonId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getProgressRow');
  return rows && rows.length > 0 ? (rows[0] as ProgressRow) : null;
}

export interface UpsertProgressInput {
  user_id: string;
  lesson_id: string;
  course_id: string;
  status: string;
  completion_status: string;
  progress_percent: number;
  video_position: number | null;
  last_position_sec: number | null;
  started_at?: string;
  last_accessed: string;
  completed_at: string | null;
}

/** Upsert theo UNIQUE (user_id, lesson_id) — tu nhien idempotent. */
export async function upsertProgress(
  env: Env,
  input: UpsertProgressInput,
): Promise<SbResult<ProgressRow[]>> {
  return sbFetch<ProgressRow[]>(env, '/lesson_progress?on_conflict=user_id,lesson_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(input),
  });
}

export interface QuizAttemptRow {
  id: string;
  user_id: string;
  lesson_id: string | null;
  passed: boolean | null;
}

export async function getQuizAttempt(
  env: Env,
  attemptId: string,
): Promise<QuizAttemptRow | null> {
  const result = await sbFetch<QuizAttemptRow[]>(
    env,
    `/quiz_attempts?select=id,user_id,lesson_id,passed&id=eq.${encodeURIComponent(attemptId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getQuizAttempt');
  return rows && rows.length > 0 ? (rows[0] as QuizAttemptRow) : null;
}

// ---------------------------------------------------------------------------
// Email (Task 11) — profiles / courses / lessons / enrollments / email_logs
// Ghi qua service-role (bypass RLS). Chi goi sau khi da kiem tra quyen
// o handler (JWT + enrollment + role).
// ---------------------------------------------------------------------------

export interface ProfileEmailRow {
  id: string;
  email: string | null;
  full_name: string | null;
}

export async function getProfileEmail(env: Env, userId: string): Promise<ProfileEmailRow | null> {
  const result = await sbFetch<ProfileEmailRow[]>(
    env,
    `/profiles?select=id,email,full_name&id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getProfileEmail');
  return rows && rows.length > 0 ? (rows[0] as ProfileEmailRow) : null;
}

export interface CourseTitleRow {
  id: string;
  title: string | null;
}

/** Tieu de khoa (de dua vao mail chuc mung / chung chi). */
export async function getCourseTitle(env: Env, courseId: string): Promise<CourseTitleRow | null> {
  const result = await sbFetch<CourseTitleRow[]>(
    env,
    `/courses?select=id,title&id=eq.${encodeURIComponent(courseId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getCourseTitle');
  return rows && rows.length > 0 ? (rows[0] as CourseTitleRow) : null;
}

export interface CourseMetaRow {
  id: string;
  slug: string | null;
  title: string | null;
}

/** Slug + tieu de khoa (AI Mentor: kiem tra ghi danh truoc khi ghi
    chu ve khoa tra phi — chi mo ta cong khai duoc dung). */
export async function getCourseBySlug(env: Env, slug: string): Promise<CourseMetaRow | null> {
  const result = await sbFetch<CourseMetaRow[]>(
    env,
    `/courses?select=id,slug,title&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getCourseBySlug');
  return rows && rows.length > 0 ? (rows[0] as CourseMetaRow) : null;
}

/** Slug + tieu de khoa (de dua vao mail cap quyen hoc E5 — can courseUrl). */
export async function getCourseMeta(env: Env, courseId: string): Promise<CourseMetaRow | null> {
  const result = await sbFetch<CourseMetaRow[]>(
    env,
    `/courses?select=id,slug,title&id=eq.${encodeURIComponent(courseId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getCourseMeta');
  return rows && rows.length > 0 ? (rows[0] as CourseMetaRow) : null;
}

/**
 * Id cac bai hoc DANG HIEN cua khoa (is_published !== false — bai an
 * khong chan hoan thanh, giong logic cap chung chi o certificates.ts).
 * Tra [] khi khoa chua co bai.
 */
export async function listCourseLessonIds(env: Env, courseId: string): Promise<string[]> {
  const mods = await sbFetch<Array<{ id: string }>>(
    env,
    `/course_modules?select=id&course_id=eq.${encodeURIComponent(courseId)}`,
  );
  const modRows = requireSbOk(mods, 'listCourseLessonIds/modules');
  const modIds = (modRows ?? []).map((m) => m.id);
  if (modIds.length === 0) return [];
  const lessons = await sbFetch<Array<{ id: string; is_published: boolean | null }>>(
    env,
    `/lessons?select=id,is_published&course_module_id=in.(${modIds.map((id) => encodeURIComponent(id)).join(',')})`,
  );
  const lesRows = requireSbOk(lessons, 'listCourseLessonIds/lessons');
  return (lesRows ?? []).filter((l) => l.is_published !== false).map((l) => l.id);
}

/** So bai cua khoa ma hoc vien da completed (status='completed'). */
export async function countCompletedLessons(
  env: Env,
  userId: string,
  lessonIds: string[],
): Promise<number> {
  if (lessonIds.length === 0) return 0;
  const result = await sbFetch<Array<{ lesson_id: string }>>(
    env,
    `/lesson_progress?select=lesson_id&user_id=eq.${encodeURIComponent(userId)}&lesson_id=in.(${lessonIds.map((id) => encodeURIComponent(id)).join(',')})&status=eq.completed`,
  );
  const rows = requireSbOk(result, 'countCompletedLessons');
  return (rows ?? []).length;
}

/** Enrollment active -> completed (+ completed_at). Tra true neu update duoc 1 dong. */
export async function markEnrollmentCompleted(
  env: Env,
  enrollmentId: string,
  nowIso: string,
): Promise<boolean> {
  const result = await sbFetch<Array<{ id: string }>>(
    env,
    `/enrollments?id=eq.${encodeURIComponent(enrollmentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'completed', completed_at: nowIso }),
    },
  );
  if (result.error) return false;
  return (result.data ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// Health: select that 1 dong courses (khong dung head:true — PostgREST
// nuot loi bang khong ton tai; xem apps/web health route, cung bai hoc).
// ---------------------------------------------------------------------------

export async function checkSupabaseHealth(env: Env): Promise<boolean> {
  const result = await sbFetch<Array<{ id: string }>>(
    env,
    '/courses?select=id&limit=1',
  );
  if (result.error || result.data === null) return false;
  return true;
}

/** Dung trong handler khi cau hinh thieu: 503, khong phai 500. */
export function notConfiguredError(): ApiError {
  return new ApiError(
    503,
    'server_error',
    'API chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
  );
}
