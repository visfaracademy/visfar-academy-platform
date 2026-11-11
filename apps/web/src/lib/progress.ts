// Lib Learning Progress — Task 07 (2/4).
// Quy tac (DECISIONS.md QĐ 17): video hoan thanh khi xem >= 90%,
// bai text/file/audio khi bam "Da hoan thanh". CHI MO BAI KHONG BAO
// GIO tu hoan thanh — khong co auto-complete khi mo.
//
// DUONG GHI — DOC KY:
//   Migration 0009 (H3) da xoa policy ghi truc tiep lesson_progress
//   cua client: Supabase RLS hien chi cho client SELECT dong cua
//   minh. Moi ghi tien do trong file nay deu di qua Workers API
//   (POST /api/v1/progress, xem api-client.ts) bang service-role.
//   Workers API CHUA deploy (workers/api chi la cho giu) — cho toi
//   khi deploy xong, saveLessonProgress tra loi ro rang, KHONG bao
//   "ok" gia, UI hien nut "Thu lai" (giong lop leads/newsletter).
//   Hop dong endpoint Workers can (de Workers implement):
//     POST /api/v1/progress, Authorization: Bearer <Supabase JWT>
//     Body: { lesson_id, course_id, lesson_type, event,
//             video_position_sec?, progress_percent?,
//             explicit_complete? }
//       event: 'opened' | 'position' | 'completed'
//     Server PHAI: (1) xac thuc JWT, chi ghi user_id cua minh;
//     (2) kiem tra enrollment (da ghi danh khoa); (3) ap dung cung
//     luat 90% / explicit-complete nhu resolveProgressUpdate ben
//     duoi — KHONG tin percent client gui; (4) upsert lesson_progress
//     (started_at lan dau, last_accessed = now()); (5) tra
//     { ok: true, data: { completion_status, progress_percent,
//       video_position, completed_at } }.
//     Them cho quiz (B-T08-5): lesson_type 'quiz' + event 'completed'
//     chi duoc gui SAU KHI route submit tra passed = true (cham o
//     server bang ham SECURITY DEFINER submit_quiz_attempt, 0014).
//     Body kem quiz_attempt_id de Workers doi chieu
//     quiz_attempts.passed truoc khi ghi — khong tin rieng claim
//     cua client. Bai chua dat KHONG gui request nao (xem
//     markQuizLessonComplete ben duoi).
//     Trigger trg_progress_sync_guard (migration 0012) la lop chan
//     cuoi o DB: video < 90% khong the 'completed', percent cua video
//     bi server tinh lai tu position/duration.
//   Doc tien do (SELECT) thi dung truc tiep Supabase client — RLS
//   "progress_select_own" cho phep.
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, getApiBaseUrl, newIdempotencyKey, postJson } from './api-client';
import { fetchCourseBySlug } from './courses';
import type { QuizSubmitResult } from './quiz';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';

/** Nguong hoan thanh video (QĐ 17). Dong bo voi dashboard.ts. */
export const VIDEO_COMPLETION_THRESHOLD = 90;
/** Debounce luu vi tri video: gom cac tick thanh 1 lan ghi. */
export const PROGRESS_SAVE_DEBOUNCE_MS = 5000;
/** Chi luu khi vi tri thay doi it nhat 2 giay so voi lan luu truoc. */
export const PROGRESS_POSITION_MIN_DELTA_SEC = 2;
/** Poll vi tri YouTube khi dang phat (ms). */
export const VIDEO_POLL_INTERVAL_MS = 5000;

export type CompletionStatus = 'not_started' | 'in_progress' | 'completed';
export type LessonType = 'video' | 'text' | 'quiz' | 'file';
export type ProgressEvent = 'opened' | 'position' | 'completed';

/** 1 dong lesson_progress (gom ca cot moi 0012 + cot legacy 0001). */
export interface LessonProgressRow {
  user_id: string;
  course_id: string | null;
  lesson_id: string;
  /** Cot legacy — dong bo 2 chieu voi completion_status (trigger 0012). */
  status: string;
  completion_status: string | null;
  progress_percent: number;
  /** Vi tri video hien tai (giay) — cot moi 0012. */
  video_position: number | null;
  /** Cot legacy — dong bo 2 chieu voi video_position. */
  last_position_sec: number | null;
  started_at: string | null;
  last_accessed: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonProgressInput {
  lessonId: string;
  courseId: string;
  lessonType: LessonType;
  /** Vi tri hien tai (giay). Chi co y nghia voi video/audio. */
  positionSec?: number | null;
  /** Do dai video/audio (giay) — de tinh %. Lay tu lessons.video_duration_sec. */
  durationSec?: number | null;
  /** Nguoi dung bam nut "Da hoan thanh" (chi text/file/audio). */
  explicitComplete?: boolean;
}

export interface ProgressDecision {
  /** Trang thai quyet dinh sau lan cap nhat nay. */
  completionStatus: CompletionStatus;
  progressPercent: number;
  /** Vi tri se luu (giay) — null neu khong co vi tri. */
  positionSec: number | null;
  /** Co chuyen sang completed o lan nay khong. */
  shouldComplete: boolean;
  /** Ly do chan (neu co) — UI hien nguyen van. Null = duoc phep. */
  blockedReason: string | null;
}

export type SaveProgressResult =
  | { status: 'ok'; progress: LessonProgressRow }
  | { status: 'blocked'; reason: string }
  | { status: 'signed-out' }
  | { status: 'not-configured' }
  | { status: 'error'; message: string; isOffline: boolean };

export type ProgressDetailState =
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; detail: CourseProgressDetail }
  | { status: 'error'; message: string; isOffline: boolean };

export interface CourseLessonItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  videoUrl: string | null;
  videoDurationSec: number | null;
  fileUrl: string | null;
  content: string | null;
  isFreePreview: boolean;
  displayOrder: number;
  moduleId: string;
  moduleTitle: string;
}

export interface CourseModuleDetail {
  id: string;
  title: string;
  lessons: CourseLessonItem[];
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

export interface CourseProgressDetail {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  enrolled: boolean;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  modules: CourseModuleDetail[];
  progressByLesson: Map<string, LessonProgressRow>;
}

// ---------------------------------------------------------------------------
// Logic thuan (test duoc khong can Supabase / Workers)
// ---------------------------------------------------------------------------

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** % da xem: position / duration, LAM TRON XUONG (floor).
 * 539/600 giay = 89,83% that -> luu 89%, CHUA dat nguong 90% — tranh
 * truong hop lam tron len 90% roi tu hoan thanh khi thuc te chua xem
 * du 90%. Cung quy tac nay dung o trigger DB (migration 0012 muc 3f)
 * va dashboard (doc progress_percent da luu) de 3 lop khop nhau. */
export function videoProgressPercent(
  positionSec: number | null | undefined,
  durationSec: number | null | undefined,
): number {
  if (!positionSec || positionSec <= 0) return 0;
  if (!durationSec || durationSec <= 0) return 0;
  if (positionSec >= durationSec) return 100;
  return Math.max(0, Math.min(99, Math.floor((positionSec / durationSec) * 100)));
}

export function isVideoComplete(
  positionSec: number | null | undefined,
  durationSec: number | null | undefined,
): boolean {
  return videoProgressPercent(positionSec, durationSec) >= VIDEO_COMPLETION_THRESHOLD;
}

/** "mm:ss" / "h:mm:ss" — hien vi tri tiep tuc xem. */
export function formatPosition(totalSec: number | null | undefined): string {
  const s = Math.max(0, Math.floor(totalSec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}

/**
 * Tach YouTube video id tu moi dang link user/seed co the luu:
 * watch?v=, youtu.be/, /embed/, /shorts/, /live/, /v/.
 * Video unlisted van dung co che nay (QĐ 16: khong phai bao mat that).
 */
export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host.endsWith('.youtube.com')) {
    const v = parsed.searchParams.get('v');
    if (v && /^[\w-]{6,}$/.test(v)) return v;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'v') && parts[1]) {
      return /^[\w-]{6,}$/.test(parts[1]) ? parts[1] : null;
    }
  }
  return null;
}

export function lessonTypeLabelVi(type: string): string {
  const map: Record<string, string> = {
    video: 'Video',
    text: 'Bài đọc',
    quiz: 'Quiz',
    file: 'Tài liệu',
  };
  return map[type] ?? type;
}

/** Co nen luu vi tri moi? Khong spam DB: doi thay >= 2 giay hoac sap hoan thanh. */
export function shouldSavePosition(
  lastSavedPositionSec: number | null,
  nextPositionSec: number,
  nextProgressPercent: number,
  minDeltaSec: number = PROGRESS_POSITION_MIN_DELTA_SEC,
): boolean {
  if (lastSavedPositionSec === null || lastSavedPositionSec === undefined) return true;
  if (nextProgressPercent >= VIDEO_COMPLETION_THRESHOLD) return true;
  return Math.abs(nextPositionSec - lastSavedPositionSec) >= minDeltaSec;
}

export interface PreviousProgress {
  completionStatus: CompletionStatus;
  progressPercent: number;
  positionSec: number | null;
}

/** Chuan hoa dong progress cu (uu tien cot moi 0012, roi ve cot legacy). */
export function normalizePreviousProgress(
  row: LessonProgressRow | null | undefined,
): PreviousProgress | null {
  if (!row) return null;
  const status =
    row.completion_status === 'completed' ||
    row.completion_status === 'in_progress' ||
    row.completion_status === 'not_started'
      ? row.completion_status
      : row.status === 'completed' || row.status === 'in_progress' || row.status === 'not_started'
        ? row.status
        : 'not_started';
  return {
    completionStatus: status,
    progressPercent: clampPercent(row.progress_percent ?? 0),
    positionSec: row.video_position ?? row.last_position_sec ?? null,
  };
}

/**
 * Luat quyet dinh HOAN THANH — dung chung cho client + mo ta cho Workers.
 *   - Da completed: giu nguyen (idempotent), van cap nhat position.
 *   - Video: chi completed khi >= 90% (tu position/duration hoac tu
 *     progressPercent gui kem). Mo video / tam dung / roi trang KHONG
 *     bao gio tu completed.
 *   - Text/file/audio: chi completed khi bam "Da hoan thanh"
 *     (explicitComplete). Mo bai chi chuyen sang in_progress.
 *   - Quiz: khong hoan thanh qua duong nay — hoan thanh khi nop quiz
 *     (phan quiz, Task 07 3/4).
 *   - Nhan 0% -> 100% khi chua du dieu kien: bi chan, tra blockedReason
 *     (client chan truoc; server/trigger chan sau — xem 0012 muc 3).
 */
export function resolveProgressUpdate(input: {
  lessonType: LessonType;
  positionSec?: number | null;
  durationSec?: number | null;
  progressPercent?: number | null;
  explicitComplete?: boolean;
  previous?: PreviousProgress | null;
}): ProgressDecision {
  const previous = input.previous ?? null;
  const positionSec =
    input.positionSec !== null && input.positionSec !== undefined && input.positionSec >= 0
      ? Math.floor(input.positionSec)
      : (previous?.positionSec ?? null);
  const percent =
    input.lessonType === 'video'
      ? videoProgressPercent(positionSec, input.durationSec)
      : (input.progressPercent ?? previous?.progressPercent ?? 0);

  // Da hoan thanh tu truoc: giu nguyen, chi cap nhat vi tri.
  if (previous?.completionStatus === 'completed') {
    return {
      completionStatus: 'completed',
      progressPercent: clampPercent(percent),
      positionSec,
      shouldComplete: false,
      blockedReason: null,
    };
  }

  const explicit = input.explicitComplete === true;

  if (explicit) {
    if (input.lessonType === 'quiz') {
      return {
        completionStatus: previous?.completionStatus ?? 'not_started',
        progressPercent: clampPercent(previous?.progressPercent ?? 0),
        positionSec,
        shouldComplete: false,
        blockedReason: 'Bài quiz chỉ hoàn thành khi bạn nộp bài làm, không bấm nút này.',
      };
    }
    if (input.lessonType === 'video') {
      if (percent < VIDEO_COMPLETION_THRESHOLD) {
        return {
          completionStatus: 'in_progress',
          progressPercent: clampPercent(percent),
          positionSec,
          shouldComplete: false,
          blockedReason: `Bạn cần xem ít nhất ${VIDEO_COMPLETION_THRESHOLD}% video mới hoàn thành được bài này (hiện tại ${clampPercent(percent)}%).`,
        };
      }
      return {
        completionStatus: 'completed',
        progressPercent: clampPercent(percent),
        positionSec,
        shouldComplete: true,
        blockedReason: null,
      };
    }
    // text / file / audio: bam nut la du dieu kien.
    return {
      completionStatus: 'completed',
      progressPercent: 100,
      positionSec,
      shouldComplete: true,
      blockedReason: null,
    };
  }

  // Khong bam nut — chi mo / xem / tam dung:
  if (input.lessonType === 'video' && percent >= VIDEO_COMPLETION_THRESHOLD) {
    return {
      completionStatus: 'completed',
      progressPercent: clampPercent(percent),
      positionSec,
      shouldComplete: true,
      blockedReason: null,
    };
  }
  const started = previous !== null || positionSec !== null || percent > 0;
  return {
    completionStatus: started ? 'in_progress' : 'not_started',
    progressPercent: clampPercent(percent),
    positionSec,
    shouldComplete: false,
    blockedReason: null,
  };
}

/** % tien do khoa = so bai completed / tong so bai (lam tron). */
export function computeCourseProgressPercent(totalLessons: number, completedLessons: number): number {
  if (totalLessons <= 0) return 0;
  return clampPercent((completedLessons / totalLessons) * 100);
}

/**
 * 1 bai co duoc tinh completed khong — dung cot moi 0012 neu co,
 * roi ve cot legacy (giong dashboard.isLessonCompleted).
 */
export function isProgressRowCompleted(
  row: LessonProgressRow | null | undefined,
  lessonType: string,
): boolean {
  if (!row) return false;
  if (row.completion_status === 'completed' || row.status === 'completed') return true;
  if (lessonType === 'video' && row.progress_percent >= VIDEO_COMPLETION_THRESHOLD) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Debounce luu vi tri — gom tick video thanh 1 lan ghi, khong spam DB
// ---------------------------------------------------------------------------

export interface ProgressSaverOptions {
  debounceMs?: number;
  minDeltaSec?: number;
  initialPositionSec?: number | null;
}

type SaverFn = (
  positionSec: number,
  progressPercent: number,
) => Promise<SaveProgressResult>;

/**
 * ProgressSaver: nhan tick vi tri video (moi 5s khi dang phat), chi ghi
 * khi vi tri doi >= 2 giay (hoac vua cham 90%). flush() ghi ngay —
 * goi khi tam dung / roi trang / ket thuc video.
 */
export class ProgressSaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { positionSec: number; durationSec: number | null } | null = null;
  private lastSavedPositionSec: number | null;
  private lastSavedPercent = 0;
  private completedSaved = false;
  private disposed = false;
  private flushing: Promise<SaveProgressResult> | null = null;

  constructor(
    private saveFn: SaverFn,
    private opts: ProgressSaverOptions = {},
  ) {
    this.lastSavedPositionSec = opts.initialPositionSec ?? null;
  }

  get debounceMs(): number {
    return this.opts.debounceMs ?? PROGRESS_SAVE_DEBOUNCE_MS;
  }

  get minDeltaSec(): number {
    return this.opts.minDeltaSec ?? PROGRESS_POSITION_MIN_DELTA_SEC;
  }

  update(positionSec: number, durationSec: number | null): void {
    if (this.disposed) return;
    const percent = videoProgressPercent(positionSec, durationSec);
    const last = this.lastSavedPositionSec;
    const crossedThreshold = percent >= VIDEO_COMPLETION_THRESHOLD && !this.completedSaved;
    if (
      last !== null &&
      Math.abs(positionSec - last) < this.minDeltaSec &&
      !crossedThreshold
    ) {
      return;
    }
    this.pending = { positionSec, durationSec };
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  async flush(): Promise<SaveProgressResult | null> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = this.pending;
    if (!pending) return null;
    if (this.flushing) return this.flushing;
    this.pending = null;
    const percent = videoProgressPercent(pending.positionSec, pending.durationSec);
    this.flushing = this.saveFn(pending.positionSec, percent).then((res) => {
      this.flushing = null;
      if (res.status === 'ok') {
        this.lastSavedPositionSec = pending.positionSec;
        this.lastSavedPercent = percent;
        if (percent >= VIDEO_COMPLETION_THRESHOLD) this.completedSaved = true;
      } else {
        // Ghi loi: giu pending de lan flush sau thu lai, khong mat vi tri.
        this.pending = pending;
      }
      return res;
    });
    return this.flushing;
  }

  get lastSavedPercentValue(): number {
    return this.lastSavedPercent;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Doc tien do (Supabase SELECT — RLS cho phep, xem 0009 H3)
// ---------------------------------------------------------------------------

type AnyClient = SupabaseClient;

function resolveClient(client?: AnyClient): AnyClient | null {
  if (client) return client;
  if (!isSupabaseConfigured()) return null;
  return getSupabaseBrowserClient();
}

function isOfflineErr(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|fetch|Failed to fetch|Load failed|NetworkError/i.test(err.message)) {
    return true;
  }
  return false;
}

async function getUserId(client: AnyClient): Promise<string | null> {
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

async function getAccessToken(client: AnyClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Doc 1 dong tien do cua minh cho 1 bai (null = chua bat dau). */
export async function getLessonProgress(
  lessonId: string,
  client?: AnyClient,
): Promise<
  | { status: 'ok'; progress: LessonProgressRow | null }
  | { status: 'signed-out' }
  | { status: 'not-configured' }
  | { status: 'error'; message: string; isOffline: boolean }
> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    const { data, error } = await supabase
      .from('lesson_progress')
      .select(
        'user_id, course_id, lesson_id, status, completion_status, progress_percent, video_position, last_position_sec, started_at, last_accessed, completed_at, created_at, updated_at',
      )
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();
    if (error) return { status: 'error', message: error.message, isOffline: false };
    return { status: 'ok', progress: (data as LessonProgressRow | null) ?? null };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không tải được tiến độ bài học.',
      isOffline: isOfflineErr(err),
    };
  }
}

export interface CourseProgressDetailInput {
  /** Slug khoa (vd 'thau-hieu-noi-tam'). */
  slug: string;
}

/**
 * Tien do day du cua 1 khoa cho trang khoa hoc: modules + lessons +
 * progress cua minh + % khoa. Dung duoc ca khi chua dang nhap (khi do
 * enrolled = false, progress rong — van liet ke bai hoc de xem thu).
 * GHI CHU: lessons dung cot course_module_id (sau migration 0005);
 * dung module_id cu se loi PGRST204 tren DB da chay 0005.
 */
export async function getCourseProgressDetail(
  slug: string,
  client?: AnyClient,
): Promise<ProgressDetailState> {
  const courseRes = await fetchCourseBySlug(slug);
  if (courseRes.status === 'not-configured') return { status: 'not-configured' };
  if (courseRes.status === 'error') {
    return { status: 'error', message: courseRes.message, isOffline: courseRes.isOffline };
  }
  const course = courseRes.course;
  if (!course) {
    return { status: 'error', message: 'Không tìm thấy khóa học.', isOffline: false };
  }
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };

  try {
    const userId = await getUserId(supabase);
    if (!userId) {
      const detail = await buildCourseDetail(supabase, course.id, course.slug, course.title, null);
      if (!detail) return { status: 'error', message: 'Không tải được nội dung khóa học.', isOffline: false };
      return { status: 'success', detail };
    }
    const detail = await buildCourseDetail(supabase, course.id, course.slug, course.title, userId);
    if (!detail) return { status: 'error', message: 'Không tải được nội dung khóa học.', isOffline: false };
    return { status: 'success', detail };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không tải được tiến độ khóa học.',
      isOffline: isOfflineErr(err),
    };
  }
}

async function buildCourseDetail(
  supabase: AnyClient,
  courseId: string,
  courseSlug: string,
  courseTitle: string,
  userId: string | null,
): Promise<CourseProgressDetail | null> {
  const { data: moduleRows, error: modErr } = await supabase
    .from('course_modules')
    .select('id, title, display_order')
    .eq('course_id', courseId)
    .order('display_order', { ascending: true });
  if (modErr) throw new Error(modErr.message);
  const modules = (moduleRows ?? []) as Array<{ id: string; title: string }>;
  const moduleIds = modules.map((m) => m.id);

  let lessonRows: Array<{
    id: string;
    course_module_id: string;
    slug: string;
    title: string;
    type: string;
    video_duration_sec: number | null;
    is_free_preview: boolean;
    display_order: number;
  }> = [];
  if (moduleIds.length > 0) {
    // S-03 (HIGH): doc VIEW lessons_public thay vi bang lessons goc.
    // Bang lessons co RLS policy cho anon doc moi bai cua khoa
    // published kem content / video_url / file_url; view chi co
    // metadata. Bai nao can noi dung that (hoc vien da ghi danh mo
    // bai) lay qua GET /api/lms/lessons/[lessonId] co kiem tra quyen
    // (xem lib/learning.ts fetchLessonContentViaApi) — o day LUON
    // tra content / videoUrl / fileUrl = null.
    const { data, error: lessonErr } = await supabase
      .from('lessons_public')
      .select(
        'id, course_module_id, slug, title, type, video_duration_sec, is_free_preview, display_order',
      )
      .in('course_module_id', moduleIds)
      .order('display_order', { ascending: true });
    if (lessonErr) throw new Error(lessonErr.message);
    lessonRows = (data ?? []) as typeof lessonRows;
  }

  const progressByLesson = new Map<string, LessonProgressRow>();
  let enrolled = false;
  if (userId) {
    const { data: enr } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();
    enrolled = Boolean(enr);
    const { data: progRows, error: progErr } = await supabase
      .from('lesson_progress')
      .select(
        'user_id, course_id, lesson_id, status, completion_status, progress_percent, video_position, last_position_sec, started_at, last_accessed, completed_at, created_at, updated_at',
      )
      .eq('user_id', userId)
      .eq('course_id', courseId);
    if (progErr) throw new Error(progErr.message);
    for (const row of (progRows ?? []) as LessonProgressRow[]) {
      progressByLesson.set(row.lesson_id, row);
    }
  }

  const moduleDetails: CourseModuleDetail[] = modules.map((m) => {
    const lessons: CourseLessonItem[] = lessonRows
      .filter((l) => l.course_module_id === m.id)
      .map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        type: l.type,
        // S-03: lessons_public khong co URL/noi dung — metadata only.
        videoUrl: null,
        videoDurationSec: l.video_duration_sec,
        fileUrl: null,
        content: null,
        isFreePreview: l.is_free_preview,
        displayOrder: l.display_order,
        moduleId: m.id,
        moduleTitle: m.title,
      }));
    const completed = lessons.filter((l) =>
      isProgressRowCompleted(progressByLesson.get(l.id), l.type),
    ).length;
    return {
      id: m.id,
      title: m.title,
      lessons,
      totalLessons: lessons.length,
      completedLessons: completed,
      progressPercent: computeCourseProgressPercent(lessons.length, completed),
    };
  });

  const totalLessons = moduleDetails.reduce((s, m) => s + m.totalLessons, 0);
  const completedLessons = moduleDetails.reduce((s, m) => s + m.completedLessons, 0);
  return {
    courseId,
    courseSlug,
    courseTitle,
    enrolled,
    totalLessons,
    completedLessons,
    progressPercent: computeCourseProgressPercent(totalLessons, completedLessons),
    modules: moduleDetails,
    progressByLesson,
  };
}

// ---------------------------------------------------------------------------
// Ghi tien do (qua Workers API — xem hop dong o dau file)
// ---------------------------------------------------------------------------

export interface SaveProgressOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  client?: AnyClient;
}

interface ProgressApiResponse {
  ok: boolean;
  data?: LessonProgressRow;
  error?: string;
  message?: string;
}

function toSaveResult(res: ProgressApiResponse): SaveProgressResult {
  if (!res.data) return { status: 'error', message: 'Workers API trả về thiếu dữ liệu.', isOffline: false };
  return { status: 'ok', progress: res.data };
}

/**
 * Ghi 1 lan tien do: mo bai / cap nhat vi tri / bam hoan thanh.
 * Luat chan gian lan chay o client TRUOC (resolveProgressUpdate), roi
 * Workers + trigger DB chan sau. Neu Workers chua deploy -> tra loi
 * ro (khong "ok" gia) de UI hien "Thu lai".
 */
export async function saveLessonProgress(
  input: LessonProgressInput,
  opts: SaveProgressOptions = {},
): Promise<SaveProgressResult> {
  const supabase = resolveClient(opts.client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };

    // Doc progress cu de quyet dinh (khong doc = coi nhu chua hoc).
    const prevRes = await getLessonProgress(input.lessonId, supabase);
    const previous =
      prevRes.status === 'ok' ? normalizePreviousProgress(prevRes.progress) : null;

    const decision = resolveProgressUpdate({
      lessonType: input.lessonType,
      positionSec: input.positionSec,
      durationSec: input.durationSec,
      explicitComplete: input.explicitComplete,
      previous,
    });
    if (decision.blockedReason) {
      return { status: 'blocked', reason: decision.blockedReason };
    }

    const event: ProgressEvent = input.explicitComplete
      ? 'completed'
      : decision.shouldComplete
        ? 'completed'
        : input.positionSec !== null && input.positionSec !== undefined
          ? 'position'
          : 'opened';
    // Su kien 'completed' dung Idempotency-Key on dinh theo bai (bam 2 lan
    // khong ghi trung); 'position'/'opened' dung key moi moi lan.
    const idempotencyKey =
      event === 'completed'
        ? `progress-complete-${input.lessonId}`
        : newIdempotencyKey();
    const accessToken = await getAccessToken(supabase);
    if (!accessToken) return { status: 'signed-out' };

    const res = await postJson<ProgressApiResponse>(
      '/progress',
      {
        lesson_id: input.lessonId,
        course_id: input.courseId,
        lesson_type: input.lessonType,
        event,
        video_position_sec: decision.positionSec,
        progress_percent: decision.progressPercent,
        explicit_complete: input.explicitComplete === true,
      },
      {
        idempotencyKey,
        accessToken,
        fetchImpl: opts.fetchImpl,
        timeoutMs: opts.timeoutMs,
      },
    );
    return toSaveResult(res);
  } catch (err) {
    if (err instanceof ApiError) {
      return { status: 'error', message: err.message, isOffline: err.isOffline };
    }
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không lưu được tiến độ.',
      isOffline: isOfflineErr(err),
    };
  }
}

/**
 * Mo bai: cap nhat last_accessed (+ started_at lan dau) qua Workers.
 * Goi 1 lan khi mo LessonPlayer. Chi mo bai KHONG doi completion_status
 * (server tra ve progress cu neu chua du dieu kien hoan thanh).
 */
export async function markLessonOpened(
  lessonId: string,
  courseId: string,
  lessonType: LessonType,
  opts: SaveProgressOptions = {},
): Promise<SaveProgressResult> {
  return saveLessonProgress(
    { lessonId, courseId, lessonType, explicitComplete: false },
    opts,
  );
}

/** Bam nut "Da hoan thanh" (bai text/file/audio; video phai >= 90%). */
export async function markLessonComplete(
  lessonId: string,
  courseId: string,
  lessonType: LessonType,
  positionSec?: number | null,
  durationSec?: number | null,
  opts: SaveProgressOptions = {},
): Promise<SaveProgressResult> {
  return saveLessonProgress(
    { lessonId, courseId, lessonType, positionSec, durationSec, explicitComplete: true },
    opts,
  );
}

// ---------------------------------------------------------------------------
// Hoan thanh bai quiz sau khi nop DAT (B-T08-5)
// ---------------------------------------------------------------------------

export interface QuizCompletionDecision {
  /** Chi true khi ket qua cham o server la DAT. */
  shouldComplete: boolean;
  /** Ly do chan (neu co) — UI hien nguyen van. Null = duoc phep. */
  blockedReason: string | null;
}

/**
 * Quyet dinh thuan: bai quiz co duoc danh dau hoan thanh khong.
 *
 * NGUON SU THAT DUY NHAT la `passed` do route submit tra ve — ham
 * SQL SECURITY DEFINER submit_quiz_attempt (0014) da cham voi
 * pass_score_percent cua chinh quiz do (NULL = mac dinh 70%).
 * Client KHONG tu tinh lai dat/truot tu score/total (se sai voi
 * quiz co nguong rieng, vd nguong 80% ma lam 75%): chi tin `passed`.
 * Het gio (status 'expired') ham SQL luon tra passed = false nen
 * cung khong hoan thanh.
 */
export function resolveQuizCompletion(
  result: Pick<QuizSubmitResult, 'passed' | 'percent' | 'score' | 'total' | 'status'>,
): QuizCompletionDecision {
  if (result.status === 'expired' || result.passed !== true) {
    return {
      shouldComplete: false,
      blockedReason: `Bạn chưa đạt điểm yêu cầu (${result.score}/${result.total} điểm, ${result.percent}%) nên bài quiz chưa được đánh dấu hoàn thành.`,
    };
  }
  return { shouldComplete: true, blockedReason: null };
}

/**
 * Danh dau bai quiz hoan thanh trong lesson_progress — CHI khi nop
 * DAT, qua Workers POST /api/v1/progress (cung duong ghi da chot
 * nhu moi tien do khac), KHONG ghi truc tiep lesson_progress tu
 * client (RLS 0009 chi cho SELECT) va KHONG di qua
 * saveLessonProgress/resolveProgressUpdate (duong do co y chan
 * quiz — bai quiz khong co nut "Da hoan thanh").
 *
 * Bai chua dat: tra 'blocked' NGAY, khong goi Supabase hay fetch
 * gi ca. Workers chua deploy: tra 'error' ro (khong "ok" gia) —
 * diem quiz thi DA DUOC LUU (ham SQL ghi quiz_attempts truoc khi
 * tra ket qua), chi viec danh dau hoan thanh la cho ghi lai; UI
 * cho "Thu lai" thay vi bao da hoan thanh.
 */
export async function markQuizLessonComplete(
  lessonId: string,
  courseId: string,
  result: Pick<QuizSubmitResult, 'attemptId' | 'passed' | 'percent' | 'score' | 'total' | 'status'>,
  opts: SaveProgressOptions = {},
): Promise<SaveProgressResult> {
  const decision = resolveQuizCompletion(result);
  if (!decision.shouldComplete || decision.blockedReason) {
    return { status: 'blocked', reason: decision.blockedReason ?? 'Bài quiz chưa đạt.' };
  }
  const supabase = resolveClient(opts.client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const userId = await getUserId(supabase);
    if (!userId) return { status: 'signed-out' };
    const accessToken = await getAccessToken(supabase);
    if (!accessToken) return { status: 'signed-out' };
    const res = await postJson<ProgressApiResponse>(
      '/progress',
      {
        lesson_id: lessonId,
        course_id: courseId,
        lesson_type: 'quiz',
        event: 'completed',
        progress_percent: 100,
        explicit_complete: true,
        quiz_attempt_id: result.attemptId,
        quiz_percent: result.percent,
      },
      {
        idempotencyKey: `progress-complete-${lessonId}`,
        accessToken,
        fetchImpl: opts.fetchImpl,
        timeoutMs: opts.timeoutMs,
      },
    );
    return toSaveResult(res);
  } catch (err) {
    if (err instanceof ApiError) {
      return { status: 'error', message: err.message, isOffline: err.isOffline };
    }
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Không lưu được tiến độ.',
      isOffline: isOfflineErr(err),
    };
  }
}

/** URL Workers API dang dung (de UI thong bao khi chua deploy). */
export function getProgressApiBaseUrl(): string {
  return getApiBaseUrl();
}
