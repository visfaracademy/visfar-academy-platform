// Data layer cho Course Structure + Student Learning — Task 07 (phan 1/4).
// Doc THAT tu Supabase (courses, course_modules, lessons_public,
// lesson_resources, quizzes, assignments, learning_events,
// enrollments, lesson_progress, lesson_notes). KHONG mock, KHONG du
// lieu gia — chua co du lieu thi tra mang rong / null de UI hien
// empty state. S-03: cau truc khoa hoc doc VIEW lessons_public (khong
// co content / video_url / file_url); noi dung bai that chi lay qua
// GET /api/lms/lessons/[lessonId] co kiem tra quyen — KHONG doc truc
// tiep bang lessons cho muc dich hien thi.
//
// Quy tac tien do (DECISIONS QĐ 17): lessons.slug UNIQUE theo module
// (course_module_id, slug); video hoan thanh khi xem >= 90%, bai text
// khi bam "Da hoan thanh" (status = 'completed'); tinh theo module.
// Video YouTube giai doan dau la unlisted (QĐ 16): ai co link deu xem
// duoc — embed qua youtube-nocookie, khong gia vo bao mat.
//
// Luu y ten cot sau 0005: lessons.course_module_id (khong con module_id).
// File tai lieu goc KHONG lo qua client: tai qua API
// /api/v1/resources/[id]/download (proxy, xem route tuong ung).
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';
import {
  isLessonCompleted,
  isOfflineErr,
  mapSupabaseErrorMessage,
  VIDEO_COMPLETION_THRESHOLD,
  type DashboardState,
} from './dashboard';

export { VIDEO_COMPLETION_THRESHOLD };

export const MAX_NOTE_LENGTH = 10000;
/** Tai file toi da qua API proxy (100 MB) — lon hon thi bao loi, khong co stream vo han. */
export const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

export type LessonType =
  | 'video'
  | 'text'
  | 'quiz'
  | 'file'
  | 'audio'
  | 'image'
  | 'pdf'
  | 'assignment'
  | 'webinar';

export interface CourseHead {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  priceVnd: number;
}

export interface CourseModuleItem {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string | null;
  displayOrder: number;
  isFreePreview: boolean;
}

export interface LessonItem {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  type: LessonType;
  content: string | null;
  videoUrl: string | null;
  videoDurationSec: number | null;
  fileUrl: string | null;
  displayOrder: number;
  isFreePreview: boolean;
}

export interface LessonResourceItem {
  id: string;
  lessonId: string;
  title: string;
  resourceType: string;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  displayOrder: number;
  isFreePreview: boolean;
}

export interface LessonProgressItem {
  lessonId: string;
  status: string;
  progressPercent: number;
  lastPositionSec: number | null;
  completedAt: string | null;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  passScorePercent: number | null;
  timeLimitSec: number | null;
  maxAttempts: number | null;
}

export interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  maxScore: number | null;
}

export interface WebinarItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  meetingUrl: string | null;
  status: string;
}

export interface ModuleWithLessons extends CourseModuleItem {
  lessons: LessonItem[];
}

export interface CourseStructure {
  course: CourseHead;
  modules: ModuleWithLessons[];
  totalLessons: number;
}

export interface LessonDetail {
  course: CourseHead;
  modules: ModuleWithLessons[];
  module: CourseModuleItem;
  lesson: LessonItem;
  resources: LessonResourceItem[];
  quiz: QuizSummary | null;
  assignment: AssignmentItem | null;
  webinar: WebinarItem | null;
  progress: LessonProgressItem | null;
  noteContent: string;
  enrolled: boolean;
  /** Khoa neu chua ghi danh va bai khong phai free preview. */
  locked: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  /** Id cac bai da hoan thanh trong khoa (de sidebar danh dau ✓). */
  completedLessonIds: string[];
}

export interface ResumeTarget {
  courseSlug: string;
  lessonSlug: string;
  moduleSlug: string;
  lessonTitle: string;
  completedLessons: number;
  totalLessons: number;
  /** true khi da hoc het khoa — nut doi thanh "Hoc lai tu dau". */
  allCompleted: boolean;
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

// ---------------------------------------------------------------------------
// Logic thuan (co test rieng)
// ---------------------------------------------------------------------------

/** Nhan tieng Viet cho loai bai hoc. */
export function lessonTypeLabelVi(type: string): string {
  const map: Record<string, string> = {
    video: 'Video',
    text: 'Bài đọc',
    quiz: 'Quiz',
    file: 'Tài liệu',
    audio: 'Audio',
    image: 'Hình ảnh',
    pdf: 'PDF',
    assignment: 'Bài tập',
    webinar: 'Webinar',
  };
  return map[type] ?? type;
}

/** Tach YouTube video id tu watch / youtu.be / embed / shorts. Tra null neu khong phai link YouTube hop le. */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  // Link YouTube Music khong phai video khoa hoc -> khong nhan.
  if (host === 'music.youtube.com') return null;
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v') ?? '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    const embed = parsed.pathname.match(/^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    if (embed) return embed[2];
  }
  return null;
}

/**
 * Chuan hoa bat ky dang nhap YouTube nao thanh URL watch chuan
 * `https://www.youtube.com/watch?v=<ID>` (bo tham so si, t, list...).
 * Chap nhan: watch / youtu.be / embed / shorts / live (ke ca
 * youtube-nocookie), link thieu scheme, ma video 11 ky tu dung mot
 * minh, va ca doan ma nhung <iframe src="..."> dan nham.
 * Tra null neu khong phai link video YouTube hop le (link kenh,
 * playlist, Vimeo, file mp4...). Dung cho ca form tao va form sua
 * bai hoc de admin khong bi trinh duyet bao loi chung chung.
 */
export function normalizeYouTubeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let text = input.trim();
  if (!text) return null;
  // Dan nham ca doan ma nhung <iframe ... src="URL" ...> -> lay src.
  const iframeSrc = text.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (iframeSrc) text = iframeSrc[1].trim();
  // Ma video 11 ky tu dung mot minh.
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) {
    return `https://www.youtube.com/watch?v=${text}`;
  }
  // Thieu scheme: youtube.com/... hoac youtu.be/... -> them https://
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    text = `https://${text}`;
  }
  const id = extractYouTubeId(text);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Slug tu tieng Viet co dau: "Buổi 1 - Chuyển hóa tâm thức" -> "buoi-1-chuyen-hoa-tam-thuc". */
export function slugifyVi(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** URL embed an toan (youtube-nocookie, khong goi y video lien quan). Null khi link khong phai YouTube. */
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

/** Dinh dang thoi luong: 75 -> "1:15", 3661 -> "1:01:01". */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec < 0) return '';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Tong thoi luong video cua ca khoa / 1 module, dang doc:
 * 2700 -> "45 phút", 5400 -> "1 giờ 30 phút", 3661 -> "1 giờ 1 phút".
 * Chi tinh bai co video_duration_sec; khong co bai nao co thoi luong
 * thi tra '' de UI an tong thoi luong thay vi hien "0 phút".
 */
export function formatTotalDuration(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec <= 0) return '';
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h <= 0) return `${m} phút`;
  if (m <= 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

/** Chuyen LessonProgressItem (camelCase) sang dang dashboard.isLessonCompleted doc (snake_case). */
function toDashboardProgress(
  p: LessonProgressItem | null | undefined,
): { status: string; progress_percent: number } | null {
  if (!p) return null;
  return { status: p.status, progress_percent: p.progressPercent };
}
export function flattenLessons(modules: ModuleWithLessons[]): LessonItem[] {
  return modules.flatMap((m) => m.lessons);
}

/** Bai truoc / bai tiep theo trong thu tu hoc cua khoa. Tra null o 2 dau; khong tim thay bai -> ca 2 null. */
export function findPrevNext(
  lessons: LessonItem[],
  lessonId: string,
): { prev: LessonItem | null; next: LessonItem | null } {
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? lessons[idx - 1] : null,
    next: idx < lessons.length - 1 ? lessons[idx + 1] : null,
  };
}

/**
 * Bai can hoc tiep (resume): bai dau tien theo thu tu hoc ma chua hoan
 * thanh (uu tien bai dang do, roi bai chua bat dau). Het khoa -> null.
 */
export function findResumeLesson(
  lessons: LessonItem[],
  progressByLesson: Map<string, LessonProgressItem>,
): LessonItem | null {
  for (const lesson of lessons) {
    if (!isLessonCompleted(lesson.type, toDashboardProgress(progressByLesson.get(lesson.id)))) {
      return lesson;
    }
  }
  return null;
}

/** Tien do khoa tu danh sach bai + tien do tung bai (QĐ 17: tinh theo module, tong hop len khoa). */
export function computeCourseProgressPercent(
  lessons: LessonItem[],
  progressByLesson: Map<string, LessonProgressItem>,
): { completedLessons: number; totalLessons: number; progressPercent: number } {
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter((l) =>
    isLessonCompleted(l.type, toDashboardProgress(progressByLesson.get(l.id))),
  ).length;
  return {
    completedLessons,
    totalLessons,
    progressPercent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
  };
}

/** Validate ghi chu truoc khi luu: khong rong, toi da 10.000 ky tu. */
export function validateNoteContent(content: string): string | null {
  if (content.trim() === '') return 'Ghi chú đang trống. Hãy viết vài dòng rồi bấm Lưu ghi chú.';
  if (content.length > MAX_NOTE_LENGTH) {
    return `Ghi chú tối đa ${MAX_NOTE_LENGTH.toLocaleString('vi-VN')} ký tự (hiện tại ${content.length.toLocaleString('vi-VN')}).`;
  }
  return null;
}

/** Link tai tai lieu qua API (khong lo URL goc). */
export function resourceDownloadUrl(resourceId: string): string {
  return `/api/v1/resources/${encodeURIComponent(resourceId)}/download`;
}

/** Trang lam quiz (Task 08): /hoc-vien/khoa-hoc/[courseSlug]/quiz/[quizId]. */
export function quizUrl(courseSlug: string, quizId: string): string {
  return `/hoc-vien/khoa-hoc/${encodeURIComponent(courseSlug)}/quiz/${encodeURIComponent(quizId)}`;
}

/** URL bai hoc; kem moduleSlug khi can phan biet 2 bai cung slug o 2 module khac nhau (slug UNIQUE theo module, QĐ 17). */
export function lessonUrl(courseSlug: string, lessonSlug: string, moduleSlug?: string): string {
  const base = `/hoc-vien/khoa-hoc/${encodeURIComponent(courseSlug)}/bai/${encodeURIComponent(lessonSlug)}`;
  return moduleSlug ? `${base}?module=${encodeURIComponent(moduleSlug)}` : base;
}

// ---------------------------------------------------------------------------
// Doc du lieu that
// ---------------------------------------------------------------------------

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  price_vnd: number;
}

interface ModuleRow {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  display_order: number;
  is_free_preview: boolean;
}

interface LessonRow {
  // S-03: dong cau truc chi doc VIEW lessons_public (0013-G) — view
  // KHONG co content / video_url / file_url, ke ca bai tra phi.
  // Noi dung that chi lay qua API co kiem tra quyen (xem
  // verifyLessonAccessViaApi / fetchLessonContentViaApi).
  id: string;
  course_module_id: string;
  slug: string;
  title: string;
  type: string;
  video_duration_sec: number | null;
  display_order: number;
  is_free_preview: boolean;
  is_published?: boolean | null;
}

function toCourseHead(row: CourseRow): CourseHead {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    priceVnd: row.price_vnd,
  };
}

function toModule(row: ModuleRow): CourseModuleItem {
  return {
    id: row.id,
    courseId: row.course_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    displayOrder: row.display_order,
    isFreePreview: row.is_free_preview,
  };
}

function toLesson(row: LessonRow): LessonItem {
  // S-03: view lessons_public khong co content / video_url / file_url
  // nen cau truc khoa hoc LUON tra null o 3 truong nay — ke ca bai
  // xem thu. Noi dung that chi co qua API guard (fetchLessonDetail
  // gop tu GET /api/lms/lessons/[lessonId] khi duoc phep).
  return {
    id: row.id,
    moduleId: row.course_module_id,
    slug: row.slug,
    title: row.title,
    type: row.type as LessonType,
    content: null,
    videoUrl: null,
    videoDurationSec: row.video_duration_sec,
    fileUrl: null,
    displayOrder: row.display_order,
    isFreePreview: row.is_free_preview,
  };
}

async function fetchStructureRows(
  supabase: AnyClient,
  courseSlug: string,
): Promise<{ course: CourseHead; modules: ModuleWithLessons[] } | null> {
  const { data: courseData, error: courseErr } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description, price_vnd')
    .eq('status', 'published')
    .eq('slug', courseSlug)
    .maybeSingle();
  if (courseErr) throw new Error(mapSupabaseErrorMessage(courseErr));
  if (!courseData) return null;
  const course = toCourseHead(courseData as CourseRow);

  const { data: moduleRows, error: modErr } = await supabase
    .from('course_modules')
    .select('id, course_id, slug, title, description, display_order, is_free_preview')
    .eq('course_id', course.id)
    .eq('is_published', true)
    .order('display_order', { ascending: true });
  if (modErr) throw new Error(mapSupabaseErrorMessage(modErr));
  const modules = ((moduleRows ?? []) as ModuleRow[]).map(toModule);
  if (modules.length === 0) return { course, modules: [] };

  const moduleIds = modules.map((m) => m.id);
  // S-03 (HIGH): doc VIEW lessons_public thay vi bang lessons goc.
  // Bang lessons co RLS policy cho anon doc moi bai cua khoa
  // published kem content / video_url / file_url; view chi co
  // metadata (khong co 3 cot nhay cam). Chi select dung cac cot
  // view co — select content/video_url/file_url o day se loi PGRST204.
  const { data: lessonRows, error: lessonErr } = await supabase
    .from('lessons_public')
    .select(
      'id, course_module_id, slug, title, type, video_duration_sec, display_order, is_free_preview, is_published',
    )
    .in('course_module_id', moduleIds)
    .order('display_order', { ascending: true });
  if (lessonErr) throw new Error(mapSupabaseErrorMessage(lessonErr));
  const lessons = ((lessonRows ?? []) as LessonRow[]).map(toLesson);

  return {
    course,
    modules: modules.map((m) => ({
      ...m,
      lessons: lessons.filter((l) => l.moduleId === m.id),
    })),
  };
}

/** Cau truc day du 1 khoa (Course -> Module -> Lesson) theo slug. */
export async function fetchCourseStructure(
  courseSlug: string,
  client?: AnyClient,
): Promise<DashboardState<CourseStructure | null>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const rows = await fetchStructureRows(supabase, courseSlug);
    if (!rows) return { status: 'success', data: null };
    const totalLessons = rows.modules.reduce((s, m) => s + m.lessons.length, 0);
    return { status: 'success', data: { ...rows, totalLessons } };
  } catch (err) {
    return errorState<CourseStructure | null>(err, 'Không tải được cấu trúc khóa học.');
  }
}

/**
 * Chi tiet 1 bai hoc + tien do + ghi chu + quyen xem cua hoc vien hien tai.
 * moduleSlug (query ?module=) chi dung khi 2 module co bai trung slug
 * (slug UNIQUE theo module, QĐ 17) — khong co thi lay bai dau tien theo
 * thu tu hoc.
 *
 * KIEM TRA QUYEN 2 LOP (Task 07 phan 3/4 — SECURITY) + S-03:
 * - Lop client (nhu cu): enrollment ton tai + bai khong phai free preview
 *   thi `locked = false`. Chi dung lam fallback khi khong goi duoc API.
 * - Lop server (moi, quyet dinh): GET /api/lms/lessons/[lessonId] chay
 *   requireLessonAccessById() phia server — chi enrollment active /
 *   completed moi duoc xem bai tra phi; enrollment bi thu hoi (revoked)
 *   mat quyen ngay ca khi client van thay dong enrollment. Khi server
 *   tu choi, ham nay khoa bai VA loc sach content / videoUrl / fileUrl
 *   khoi du lieu tra ve (khong chi an nut o UI). Khi server tra
 *   previewOnly, bai chi giu metadata. Khi khong goi duoc API (VD: chay
 *   unit test khong co server, hoac mat mang) thi dung quyet dinh client.
 * - S-03: cau truc (fetchStructureRows) gio chi doc view lessons_public
 *   nen KHONG con mang content / videoUrl / fileUrl. Noi dung that cua
 *   bai chi co trong payload tra ve tu API guard (verifyLessonAccessViaApi
 *   kem theo `lesson`); khi API khong goi duoc thi bai chi co metadata
 *   (fail-closed — khong hien noi dung), ke ca hoc vien da ghi danh.
 */
export interface LessonContentPayload {
  content: string | null;
  videoUrl: string | null;
  fileUrl: string | null;
}

export type LessonAccessVerification =
  | { allowed: true; previewOnly: boolean; lesson?: LessonContentPayload | null }
  | { allowed: false }
  | null; // Khong xac minh duoc qua API -> dung quyet dinh client

export async function verifyLessonAccessViaApi(
  lessonId: string,
  fetchFn: typeof fetch = fetch,
): Promise<LessonAccessVerification> {
  try {
    const res = await fetchFn(`/api/lms/lessons/${encodeURIComponent(lessonId)}`);
    if (!res.ok) return { allowed: false };
    const data = (await res.json()) as {
      ok?: boolean;
      previewOnly?: boolean;
      lesson?: {
        content?: string | null;
        video_url?: string | null;
        file_url?: string | null;
      } | null;
    };
    if (!data.ok) return { allowed: false };
    // S-03 / 0028: route tra lesson day du (snake_case) khi duoc phep
    // xem het; ban preview chi co video_url (mau mien phi) khi
    // previewOnly — khong co content / file_url. Chi kem payload khi
    // route that su tra it nhat 1 trong 3 truong.
    const raw = data.lesson;
    const hasFullLesson =
      raw != null &&
      ('content' in raw || 'video_url' in raw || 'file_url' in raw);
    return {
      allowed: true,
      previewOnly: data.previewOnly === true,
      ...(hasFullLesson
        ? {
            lesson: {
              content: raw.content ?? null,
              videoUrl: raw.video_url ?? null,
              fileUrl: raw.file_url ?? null,
            },
          }
        : {}),
    };
  } catch {
    return null;
  }
}

/**
 * S-03: lay noi dung that cua 1 bai qua API guard
 * (GET /api/lms/lessons/[lessonId]). Tra null khi khong duoc phep xem
 * day du (chua ghi danh / chi preview / khong goi duoc API) — caller
 * giu bai o dang metadata, khong tu doc bang lessons goc.
 */
export async function fetchLessonContentViaApi(
  lessonId: string,
  fetchFn: typeof fetch = fetch,
): Promise<LessonContentPayload | null> {
  const verification = await verifyLessonAccessViaApi(lessonId, fetchFn);
  if (!verification || !verification.allowed || verification.previewOnly) return null;
  return verification.lesson ?? null;
}

/** Loc sach noi dung nhay cam khoi bai hoc bi khoa / chi xem thu. */
export function stripLessonContent(lesson: LessonItem): LessonItem {
  return { ...lesson, content: null, videoUrl: null, fileUrl: null };
}

export async function fetchLessonDetail(
  courseSlug: string,
  lessonSlug: string,
  moduleSlug?: string | null,
  client?: AnyClient,
  verifyAccess?: (lessonId: string) => Promise<LessonAccessVerification>,
): Promise<DashboardState<LessonDetail | null>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };

    const rows = await fetchStructureRows(supabase, courseSlug);
    if (!rows) return { status: 'success', data: null };
    const allLessons = flattenLessons(rows.modules);
    const candidates = allLessons.filter((l) => l.slug === lessonSlug);
    if (candidates.length === 0) {
      return { status: 'success', data: null };
    }
    let lesson = candidates[0];
    if (moduleSlug) {
      const inModule = candidates.find((l) => {
        const mod = rows.modules.find((m) => m.id === l.moduleId);
        return mod?.slug === moduleSlug;
      });
      if (inModule) lesson = inModule;
    }
    const mod = rows.modules.find((m) => m.id === lesson.moduleId);
    if (!mod) return { status: 'success', data: null };

    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', rows.course.id)
      .maybeSingle();
    const enrolled = Boolean(enrollmentData);

    // Lop server: xac minh quyen hoc qua API (ghi de quyet dinh client).
    // Mac dinh dung fetch that; test / moi truong khong co server co the
    // truyen verifyAccess rieng. Tra null khi khong goi duoc API — khi
    // do dung quyet dinh client (khong lam hong trang vi loi mang).
    const verify = verifyAccess ?? ((id: string) => verifyLessonAccessViaApi(id));
    let serverAccess: LessonAccessVerification = null;
    try {
      serverAccess = await verify(lesson.id);
    } catch {
      serverAccess = null;
    }

    const { data: resourceRows, error: resErr } = await supabase
      .from('lesson_resources')
      .select('id, lesson_id, title, resource_type, file_url, file_size_bytes, display_order, is_free_preview')
      .eq('lesson_id', lesson.id)
      .order('display_order', { ascending: true });
    if (resErr) throw new Error(mapSupabaseErrorMessage(resErr));
    const resources = ((resourceRows ?? []) as Array<{
      id: string;
      lesson_id: string;
      title: string;
      resource_type: string;
      file_url: string | null;
      file_size_bytes: number | null;
      display_order: number;
      is_free_preview: boolean;
    }>).map((r) => ({
      id: r.id,
      lessonId: r.lesson_id,
      title: r.title,
      resourceType: r.resource_type,
      fileUrl: r.file_url,
      fileSizeBytes: r.file_size_bytes,
      displayOrder: r.display_order,
      isFreePreview: r.is_free_preview,
    }));

    // Quiz / bai tap / webinar cua bai (co the khong co — tra null, UI an muc do).
    let quiz: QuizSummary | null = null;
    if (lesson.type === 'quiz') {
      const { data: quizRow } = await supabase
        .from('quizzes')
        .select('id, title, description, pass_score_percent, time_limit_sec, max_attempts')
        .eq('lesson_id', lesson.id)
        .eq('is_published', true)
        .maybeSingle();
      const q = quizRow as unknown as {
        id: string;
        title: string;
        description: string | null;
        pass_score_percent: number | null;
        time_limit_sec: number | null;
        max_attempts: number | null;
      } | null;
      if (q) {
        quiz = {
          id: q.id,
          title: q.title,
          description: q.description,
          passScorePercent: q.pass_score_percent,
          timeLimitSec: q.time_limit_sec,
          maxAttempts: q.max_attempts,
        };
      }
    }

    let assignment: AssignmentItem | null = null;
    if (lesson.type === 'assignment') {
      const { data: asgRow } = await supabase
        .from('assignments')
        .select('id, title, description, due_at, max_score')
        .eq('lesson_id', lesson.id)
        .eq('is_published', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const a = asgRow as unknown as {
        id: string;
        title: string;
        description: string;
        due_at: string | null;
        max_score: number | null;
      } | null;
      if (a) {
        assignment = {
          id: a.id,
          title: a.title,
          description: a.description,
          dueAt: a.due_at,
          maxScore: a.max_score,
        };
      }
    }

    let webinar: WebinarItem | null = null;
    if (lesson.type === 'webinar') {
      // RLS learning_events: chi hoc vien DA GHI DANH moi thay hang
      // (ke ca meeting_url) — chua ghi danh tra ve mang rong, khong loi.
      const { data: webRow } = await supabase
        .from('learning_events')
        .select('id, title, description, starts_at, ends_at, meeting_url, status')
        .eq('lesson_id', lesson.id)
        .in('status', ['scheduled', 'live'])
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const w = webRow as unknown as {
        id: string;
        title: string;
        description: string | null;
        starts_at: string;
        ends_at: string | null;
        meeting_url: string | null;
        status: string;
      } | null;
      if (w) {
        webinar = {
          id: w.id,
          title: w.title,
          description: w.description,
          startsAt: w.starts_at,
          endsAt: w.ends_at,
          meetingUrl: w.meeting_url,
          status: w.status,
        };
      }
    }

    const lessonIds = allLessons.map((l) => l.id);
    const { data: progressRows, error: progErr } = await supabase
      .from('lesson_progress')
      .select('lesson_id, status, progress_percent, last_position_sec, completed_at')
      .eq('user_id', userId)
      .in('lesson_id', lessonIds);
    if (progErr) throw new Error(mapSupabaseErrorMessage(progErr));
    const progressByLesson = new Map<string, LessonProgressItem>(
      ((progressRows ?? []) as Array<{
        lesson_id: string;
        status: string;
        progress_percent: number;
        last_position_sec: number | null;
        completed_at: string | null;
      }>).map((p) => [
        p.lesson_id,
        {
          lessonId: p.lesson_id,
          status: p.status,
          progressPercent: p.progress_percent,
          lastPositionSec: p.last_position_sec,
          completedAt: p.completed_at,
        },
      ]),
    );

    // Ghi chu cua bai (bang lesson_notes — migration 0011; neu project
    // chua chay 0011 thi PGRST205 -> coi nhu chua co ghi chu, bai hoc
    // van mo duoc (ghi chu moi khi luu se bao loi ro, khong mat am).
    let noteContent = '';
    const { data: noteRow, error: noteErr } = await supabase
      .from('lesson_notes')
      .select('content')
      .eq('user_id', userId)
      .eq('lesson_id', lesson.id)
      .maybeSingle();
    const notesTableMissing =
      noteErr?.code === 'PGRST205' || /Could not find the table/i.test(noteErr?.message ?? '');
    if (noteErr && !notesTableMissing) throw new Error(mapSupabaseErrorMessage(noteErr));
    const n = noteRow as unknown as { content: string } | null;
    if (n) noteContent = n.content;

    const { completedLessons, totalLessons, progressPercent } = computeCourseProgressPercent(
      allLessons,
      progressByLesson,
    );
    const completedLessonIds = allLessons
      .filter((l) => isLessonCompleted(l.type, toDashboardProgress(progressByLesson.get(l.id))))
      .map((l) => l.id);
    // Quyet dinh cuoi: server thang khi xac minh duoc; khong xac minh
    // duoc (serverAccess null) thi dung quyet dinh client nhu cu.
    const locked =
      serverAccess === null ? !enrolled && !lesson.isFreePreview : !serverAccess.allowed;
    const previewOnly = serverAccess !== null && serverAccess.allowed && serverAccess.previewOnly;
    // S-03 / 0028: cau truc chi co metadata (view lessons_public).
    // Noi dung that chi gop tu payload API guard khi server cho phep
    // xem day du. previewOnly: chi giu videoUrl mau tu guard (khong
    // content / fileUrl); bi khoa / khong goi duoc API -> giu null
    // (fail-closed).
    const fullContent =
      serverAccess !== null && serverAccess.allowed && !previewOnly
        ? serverAccess.lesson ?? null
        : null;
    const previewVideoUrl =
      previewOnly && serverAccess !== null && serverAccess.allowed
        ? (serverAccess.lesson?.videoUrl ?? null)
        : null;
    const lessonWithContent: LessonItem =
      fullContent !== null
        ? {
            ...lesson,
            content: fullContent.content,
            videoUrl: fullContent.videoUrl,
            fileUrl: fullContent.fileUrl,
          }
        : previewVideoUrl !== null
          ? { ...lesson, videoUrl: previewVideoUrl }
          : lesson;
    const finalLesson = locked
      ? stripLessonContent(lessonWithContent)
      : previewOnly
        ? { ...lessonWithContent, content: null, fileUrl: null }
        : lessonWithContent;
    return {
      status: 'success',
      data: {
        course: rows.course,
        modules: rows.modules,
        module: mod,
        lesson: finalLesson,
        resources: locked ? [] : resources,
        quiz,
        assignment,
        webinar,
        progress: progressByLesson.get(lesson.id) ?? null,
        noteContent,
        enrolled,
        locked,
        completedLessons,
        totalLessons,
        progressPercent,
        completedLessonIds,
      },
    };
  } catch (err) {
    return errorState<LessonDetail | null>(err, 'Không tải được bài học.');
  }
}

/** Bai can hoc tiep cua 1 khoa (resume). Chua ghi danh / het khoa -> data null (allCompleted phan biet 2 truong hop). */
export async function fetchResumeTarget(
  courseSlug: string,
  client?: AnyClient,
): Promise<DashboardState<ResumeTarget | null>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    const rows = await fetchStructureRows(supabase, courseSlug);
    if (!rows) return { status: 'success', data: null };
    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', rows.course.id)
      .maybeSingle();
    if (!enrollmentData) return { status: 'success', data: null };

    const allLessons = flattenLessons(rows.modules);
    const { data: progressRows, error: progErr } = await supabase
      .from('lesson_progress')
      .select('lesson_id, status, progress_percent, last_position_sec, completed_at')
      .eq('user_id', userId)
      .in('lesson_id', allLessons.map((l) => l.id));
    if (progErr) throw new Error(mapSupabaseErrorMessage(progErr));
    const progressByLesson = new Map<string, LessonProgressItem>(
      ((progressRows ?? []) as Array<{
        lesson_id: string;
        status: string;
        progress_percent: number;
        last_position_sec: number | null;
        completed_at: string | null;
      }>).map((p) => [
        p.lesson_id,
        {
          lessonId: p.lesson_id,
          status: p.status,
          progressPercent: p.progress_percent,
          lastPositionSec: p.last_position_sec,
          completedAt: p.completed_at,
        },
      ]),
    );
    const { completedLessons, totalLessons } = computeCourseProgressPercent(allLessons, progressByLesson);
    const next = findResumeLesson(allLessons, progressByLesson);
    if (!next) {
      const first = allLessons[0];
      if (!first) return { status: 'success', data: null };
      const firstModule = rows.modules.find((m) => m.id === first.moduleId);
      return {
        status: 'success',
        data: {
          courseSlug,
          lessonSlug: first.slug,
          moduleSlug: firstModule?.slug ?? '',
          lessonTitle: first.title,
          completedLessons,
          totalLessons,
          allCompleted: true,
        },
      };
    }
    const nextModule = rows.modules.find((m) => m.id === next.moduleId);
    return {
      status: 'success',
      data: {
        courseSlug,
        lessonSlug: next.slug,
        moduleSlug: nextModule?.slug ?? '',
        lessonTitle: next.title,
        completedLessons,
        totalLessons,
        allCompleted: false,
      },
    };
  } catch (err) {
    return errorState<ResumeTarget | null>(err, 'Không tìm được bài học tiếp theo.');
  }
}

// ---------------------------------------------------------------------------
// Ghi tien do / ghi chu (hoc vien, qua RLS "cua minh")
// ---------------------------------------------------------------------------

export type SaveResult = { status: 'ok' } | { status: 'error'; message: string };

async function upsertProgress(
  supabase: AnyClient,
  userId: string,
  lessonId: string,
  values: { status: string; progress_percent: number; last_position_sec?: number | null },
): Promise<SaveResult> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    lesson_id: lessonId,
    status: values.status,
    progress_percent: values.progress_percent,
    updated_at: new Date().toISOString(),
  };
  if (values.status === 'completed') payload.completed_at = new Date().toISOString();
  if (values.last_position_sec !== undefined) payload.last_position_sec = values.last_position_sec;
  const { error } = await supabase
    .from('lesson_progress')
    .upsert(payload, { onConflict: 'user_id,lesson_id' });
  if (error) return { status: 'error', message: mapSupabaseErrorMessage(error) };
  return { status: 'ok' };
}

/**
 * Danh dau bai da hoan thanh. Video: progressPercent mac dinh 90 (QĐ 17
 * — video hoan thanh khi xem >= 90%); bai text: 100.
 */
export async function markLessonComplete(
  lessonId: string,
  opts?: { progressPercent?: number },
  client?: AnyClient,
): Promise<SaveResult> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'error', message: 'Bạn chưa đăng nhập.' };
    return await upsertProgress(supabase, userId, lessonId, {
      status: 'completed',
      progress_percent: opts?.progressPercent ?? 100,
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không lưu được tiến độ.',
    };
  }
}

/** Luu tien do xem/đoc do (0–100). Dung cho "xem video" truoc khi bam hoan thanh. */
export async function saveLessonProgress(
  lessonId: string,
  progressPercent: number,
  lastPositionSec?: number,
  client?: AnyClient,
): Promise<SaveResult> {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'error', message: 'Bạn chưa đăng nhập.' };
    return await upsertProgress(supabase, userId, lessonId, {
      status: clamped >= 100 ? 'completed' : 'in_progress',
      progress_percent: clamped,
      last_position_sec: lastPositionSec,
    });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không lưu được tiến độ.',
    };
  }
}

/** Luu ghi chu cua bai (upsert 1 dong / hoc vien / bai — migration 0011). */
export async function saveLessonNote(
  lessonId: string,
  content: string,
  client?: AnyClient,
): Promise<SaveResult> {
  const validationError = validateNoteContent(content);
  if (validationError) return { status: 'error', message: validationError };
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'error', message: 'Bạn chưa đăng nhập.' };
    const { error } = await supabase.from('lesson_notes').upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' },
    );
    if (error) return { status: 'error', message: mapSupabaseErrorMessage(error) };
    return { status: 'ok' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không lưu được ghi chú.',
    };
  }
}
