// POST /api/v1/progress — API_ARCHITECTURE.md §8.3 + hop dong o
// apps/web/src/lib/progress.ts (dau file) + DECISIONS.md QĐ 17.
//
// Frontend gui (snake_case; chap nhan ca camelCase phong thu):
//   { lesson_id, course_id, lesson_type, event,
//     video_position_sec?, progress_percent?, explicit_complete?,
//     quiz_attempt_id?, quiz_percent? }
//   event: 'opened' | 'position' | 'completed'
// Header: Authorization: Bearer <Supabase JWT>, Idempotency-Key.
// Tra ve: { ok:true, data: <LessonProgressRow snake_case> } — dung
// hinh dang progress.ts doi (toSaveResult).
//
// Server PHAI:
//   (1) xac thuc JWT bang JWKS, chi ghi user_id cua minh;
//   (2) kiem tra enrollment (active/completed; revoked hoac chua ghi
//       danh -> 403);
//   (3) ap dung luat 90% / explicit-complete nhu progress.ts
//       resolveProgressUpdate — KHONG tin percent client gui voi video
//       (tinh lai tu position/duration, lam tron xuong);
//   (4) chan gian lan: position vuot duration+10s; hoan thanh video
//       khi khong co bang chung position >= 90%; nhay vi tri qua nhanh
//       so voi thoi gian thuc (scrub toi cuoi) khi chuyen sang completed;
//   (5) quiz chi completed khi quiz_attempts.passed = true (doi chieu
//       bang quiz_attempt_id, khong tin claim client);
//   (6) upsert lesson_progress (started_at lan dau, last_accessed = now()).
// Trigger trg_progress_sync_guard (0012) la lop chan cuoi o DB.
import type { Env } from '../env';
import { isSupabaseConfigured } from '../env';
import { ApiError, jsonOk, serverError } from '../errors';
import { extractBearerToken, verifySupabaseJwt } from '../jwt';
import { checkRateLimit, getClientIp } from '../rate-limit';
import {
  getEnrollment,
  getLesson,
  getProgressRow,
  getQuizAttempt,
  notConfiguredError,
  requireSbOk,
  upsertProgress,
  type ProgressRow,
} from '../supabase';
import { maybeCompleteCourseAndNotify } from './course-completion';
import {
  asTrimmedString,
  isNonNegativeInt,
  isUuid,
  pickField,
} from '../validation';

export const VIDEO_COMPLETION_THRESHOLD = 90;
/** Dung sai khi so sanh nhay vi tri voi thoi gian thuc (giay). */
const JUMP_TOLERANCE_SEC = 30;

type LessonType = 'video' | 'text' | 'quiz' | 'file';
type ProgressEvent = 'opened' | 'position' | 'completed';

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** % video: position/duration, LAM TRON XUONG (giong progress.ts + trigger 0012). */
export function videoProgressPercent(
  positionSec: number | null | undefined,
  durationSec: number | null | undefined,
): number {
  if (!positionSec || positionSec <= 0) return 0;
  if (!durationSec || durationSec <= 0) return 0;
  if (positionSec >= durationSec) return 100;
  return Math.max(0, Math.min(99, Math.floor((positionSec / durationSec) * 100)));
}

interface NormalizedProgress {
  lessonId: string;
  courseId: string;
  lessonType: LessonType | null;
  event: ProgressEvent;
  videoPositionSec: number | null;
  progressPercent: number | null;
  explicitComplete: boolean;
  quizAttemptId: string | null;
}

function parseBody(body: Record<string, unknown>): NormalizedProgress {
  const lessonId = asTrimmedString(pickField(body, 'lessonId', 'lesson_id'));
  const courseId = asTrimmedString(pickField(body, 'courseId', 'course_id'));
  const rawType = asTrimmedString(pickField(body, 'lessonType', 'lesson_type'));
  const lessonType: LessonType | null =
    rawType === 'video' || rawType === 'text' || rawType === 'quiz' || rawType === 'file'
      ? rawType
      : null;
  const rawEvent = asTrimmedString(pickField(body, 'event', 'event'));
  const event: ProgressEvent =
    rawEvent === 'opened' || rawEvent === 'position' || rawEvent === 'completed'
      ? rawEvent
      : 'opened';
  const rawPos = pickField(body, 'videoPositionSec', 'video_position_sec');
  const videoPositionSec =
    rawPos === null || rawPos === undefined
      ? null
      : isNonNegativeInt(rawPos)
        ? rawPos
        : -1; // -1 = sai dinh dang, xu ly o buoc validate.
  const rawPct = pickField(body, 'progressPercent', 'progress_percent');
  const progressPercent =
    rawPct === null || rawPct === undefined
      ? null
      : typeof rawPct === 'number' && Number.isFinite(rawPct)
        ? clampPercent(rawPct)
        : -1;
  const explicitComplete = pickField(body, 'explicitComplete', 'explicit_complete') === true;
  const rawAttempt = pickField(body, 'quizAttemptId', 'quiz_attempt_id');
  const quizAttemptId =
    typeof rawAttempt === 'string' && rawAttempt.trim() ? rawAttempt.trim() : null;
  return {
    lessonId,
    courseId,
    lessonType,
    event,
    videoPositionSec,
    progressPercent,
    explicitComplete,
    quizAttemptId,
  };
}

export async function handleSaveProgress(req: Request, env: Env): Promise<Response> {
  // (1) JWT — thieu/sai -> 401, khong dem rate-limit (tru 401/403).
  // Thieu token tra 401 ngay ca khi chua cau hinh; chi buoc verify
  // moi can SUPABASE_URL (JWKS + iss).
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'unauthorized', 'Vui lòng đăng nhập lại để tiếp tục học.');
  }
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  let userId: string;
  try {
    const verified = await verifySupabaseJwt(token, env.SUPABASE_URL);
    userId = verified.userId;
  } catch {
    throw new ApiError(401, 'unauthorized', 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
  }

  // Rate-limit: 100 req/phut/IP + 300 req/gio/user (Task 03 QĐ 13).
  const ip = getClientIp(req);
  const rlIp = await checkRateLimit(env, `progress-ip:${ip}`, 100, 60 * 1000);
  if (!rlIp.allowed) {
    throw new ApiError(429, 'rate_limited', 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.', {
      retryAfterSec: rlIp.retryAfterSec,
    });
  }
  const rlUser = await checkRateLimit(env, `progress-user:${userId}`, 300, 60 * 60 * 1000);
  if (!rlUser.allowed) {
    throw new ApiError(429, 'rate_limited', 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.', {
      retryAfterSec: rlUser.retryAfterSec,
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch {
    throw new ApiError(400, 'invalid_input', 'Dữ liệu gửi lên không đúng định dạng.');
  }
  const input = parseBody(body);
  if (!isUuid(input.lessonId) || !isUuid(input.courseId)) {
    throw new ApiError(400, 'invalid_input', 'Bài học hoặc khóa học chưa đúng.');
  }
  if (input.videoPositionSec !== null && input.videoPositionSec < 0) {
    throw new ApiError(400, 'invalid_input', 'Vị trí video chưa đúng.');
  }
  if (input.progressPercent !== null && input.progressPercent < 0) {
    throw new ApiError(400, 'invalid_input', 'Phần trăm tiến độ chưa đúng.');
  }
  if (input.quizAttemptId !== null && !isUuid(input.quizAttemptId)) {
    throw new ApiError(400, 'invalid_input', 'Mã bài nộp quiz chưa đúng.');
  }

  // Bai hoc that (loai + do dai + khoa lay tu DB — khong tin client).
  const lesson = await getLesson(env, input.lessonId);
  if (!lesson) {
    throw new ApiError(404, 'not_found', 'Không tìm thấy bài học.');
  }
  const lessonCourseId = lesson.course_modules?.course_id ?? null;
  if (!lessonCourseId) {
    throw serverError('lesson has no course module');
  }
  if (lessonCourseId !== input.courseId) {
    throw new ApiError(400, 'invalid_input', 'Bài học không thuộc khóa học này.');
  }
  const lessonType = lesson.type as LessonType;
  const durationSec = lesson.video_duration_sec;

  // (2) Enrollment: phai ton tai va khong bi thu hoi.
  const enrollment = await getEnrollment(env, userId, input.courseId);
  if (!enrollment) {
    throw new ApiError(403, 'forbidden', 'Bạn chưa ghi danh khóa học này.');
  }
  if (enrollment.status === 'revoked') {
    throw new ApiError(403, 'forbidden', 'Quyền học khóa này của bạn đã bị thu hồi.');
  }

  const previous = await getProgressRow(env, userId, input.lessonId);
  const nowIso = new Date().toISOString();
  const wantsComplete = input.event === 'completed' || input.explicitComplete === true;

  // --- Quiz: chi completed khi attempt PASSED o server (B-T08-5) ---
  if (lessonType === 'quiz') {
    if (!wantsComplete) {
      throw new ApiError(
        400,
        'invalid_input',
        'Bài quiz chỉ hoàn thành khi bạn nộp bài làm, không bấm nút này.',
      );
    }
    if (!input.quizAttemptId) {
      throw new ApiError(400, 'invalid_input', 'Thiếu mã bài nộp quiz để đối chiếu kết quả.');
    }
    const attempt = await getQuizAttempt(env, input.quizAttemptId);
    if (!attempt) {
      throw new ApiError(404, 'not_found', 'Không tìm thấy bài nộp quiz để đối chiếu.');
    }
    if (attempt.user_id !== userId) {
      throw new ApiError(403, 'forbidden', 'Bài nộp quiz này không phải của bạn.');
    }
    if (attempt.lesson_id && attempt.lesson_id !== input.lessonId) {
      throw new ApiError(400, 'invalid_input', 'Bài nộp quiz không thuộc bài học này.');
    }
    if (attempt.passed !== true) {
      throw new ApiError(
        400,
        'invalid_input',
        'Bạn chưa đạt điểm yêu cầu nên bài quiz chưa được đánh dấu hoàn thành.',
      );
    }
    return saveRow(env, {
      userId,
      lessonId: input.lessonId,
      courseId: input.courseId,
      previous,
      completionStatus: 'completed',
      progressPercent: 100,
      videoPosition: null,
      nowIso,
    });
  }

  // --- Video: percent TINH LAI tu position/duration; chan gian lan ---
  if (lessonType === 'video') {
    // Khong co position trong request (vd event 'opened') -> giu vi tri
    // cu, KHONG reset ve 0 (loi nay test 'mo bai lan 2' bat duoc).
    const position = input.videoPositionSec ?? previous?.video_position ?? null;
    if (
      position !== null &&
      durationSec !== null &&
      durationSec > 0 &&
      position > durationSec + 10
    ) {
      throw new ApiError(
        400,
        'invalid_input',
        'Vị trí video vượt quá độ dài bài học.',
      );
    }
    const percent =
      durationSec !== null && durationSec > 0
        ? videoProgressPercent(position, durationSec)
        : (input.progressPercent ?? previous?.progress_percent ?? 0);

    // Da completed tu truoc: giu nguyen, chi cap nhat vi tri.
    if (previous?.completion_status === 'completed' || previous?.status === 'completed') {
      return saveRow(env, {
        userId,
        lessonId: input.lessonId,
        courseId: input.courseId,
        previous,
        completionStatus: 'completed',
        progressPercent: clampPercent(percent),
        videoPosition: position,
        nowIso,
      });
    }

    const reachesThreshold = percent >= VIDEO_COMPLETION_THRESHOLD;
    if (wantsComplete || reachesThreshold) {
      // (a) Hoan thanh ma khong co bang chung position >= 90% -> chan.
      //     Day la truong hop "nhay 0% -> 100%": claim completed nhung
      //     khong dua ra vi tri nao chung minh da xem.
      if (!reachesThreshold) {
        throw new ApiError(
          400,
          'invalid_input',
          `Bạn cần xem ít nhất ${VIDEO_COMPLETION_THRESHOLD}% video mới hoàn thành được bài này (hiện tại ${clampPercent(percent)}%).`,
        );
      }
      // (b) Nhay vi tri qua nhanh so voi thoi gian thuc: tu vi tri cu
      //     len gan cuoi trong 1 request, trong khi thoi gian troi qua
      //     tu lan luu truoc khong du de xem het doan do (scrub toi
      //     cuoi). Cho phep sai so 30 giay (debounce + seek nho).
      //     Khong co dong cu (lan luu dau) thi khong co co so de chan.
      if (previous && previous.video_position !== null && position !== null) {
        const prevPos = previous.video_position;
        const prevAt = previous.last_accessed ? Date.parse(previous.last_accessed) : NaN;
        if (position > prevPos && !Number.isNaN(prevAt)) {
          const elapsedSec = Math.max(0, (Date.now() - prevAt) / 1000);
          if (position - prevPos > elapsedSec + JUMP_TOLERANCE_SEC) {
            throw new ApiError(
              400,
              'invalid_input',
              'Tiến độ tăng quá nhanh so với thời gian xem thực. Vui lòng xem tiếp video rồi thử lại.',
            );
          }
        }
      }
      return saveRow(env, {
        userId,
        lessonId: input.lessonId,
        courseId: input.courseId,
        previous,
        completionStatus: 'completed',
        progressPercent: clampPercent(percent),
        videoPosition: position,
        nowIso,
      });
    }

    // Mo / xem / tam dung: khong tu completed.
    const started = previous !== null || position !== null || percent > 0;
    return saveRow(env, {
      userId,
      lessonId: input.lessonId,
      courseId: input.courseId,
      previous,
      completionStatus: started ? 'in_progress' : 'not_started',
      progressPercent: clampPercent(percent),
      videoPosition: position,
      nowIso,
    });
  }

  // --- Text / file: chi completed khi bam "Da hoan thanh" ---
  if (wantsComplete) {
    return saveRow(env, {
      userId,
      lessonId: input.lessonId,
      courseId: input.courseId,
      previous,
      completionStatus: 'completed',
      progressPercent: 100,
      videoPosition: input.videoPositionSec ?? previous?.video_position ?? null,
      nowIso,
    });
  }
  const started = previous !== null || input.progressPercent !== null;
  return saveRow(env, {
    userId,
    lessonId: input.lessonId,
    courseId: input.courseId,
    previous,
    completionStatus: started ? 'in_progress' : 'not_started',
    progressPercent: clampPercent(input.progressPercent ?? previous?.progress_percent ?? 0),
    videoPosition: input.videoPositionSec ?? previous?.video_position ?? null,
    nowIso,
  });
}

async function saveRow(
  env: Env,
  opts: {
    userId: string;
    lessonId: string;
    courseId: string;
    previous: ProgressRow | null;
    completionStatus: 'not_started' | 'in_progress' | 'completed';
    progressPercent: number;
    videoPosition: number | null;
    nowIso: string;
  },
): Promise<Response> {
  const isCompleted = opts.completionStatus === 'completed';
  const result = await upsertProgress(env, {
    user_id: opts.userId,
    lesson_id: opts.lessonId,
    course_id: opts.courseId,
    status: opts.completionStatus,
    completion_status: opts.completionStatus,
    progress_percent: clampPercent(opts.progressPercent),
    video_position: opts.videoPosition,
    last_position_sec: opts.videoPosition,
    ...(opts.previous ? {} : { started_at: opts.nowIso }),
    last_accessed: opts.nowIso,
    completed_at: isCompleted ? (opts.previous?.completed_at ?? opts.nowIso) : null,
  });
  if (result.error) {
    // VD trigger 0012 nem exception (position vuot / video <90% doi
    // completed) -> PostgREST 400/500: tra 400 invalid_input, khong ok:true.
    throw new ApiError(400, 'invalid_input', 'Không lưu được tiến độ. Vui lòng thử lại.');
  }
  const rows = requireSbOk(result, 'upsertProgress');
  let row = rows && rows.length > 0 ? (rows[0] as ProgressRow) : null;
  if (!row) {
    // Upsert khong tra row (hiem): doc lai de tra dung du lieu da luu.
    row = await getProgressRow(env, opts.userId, opts.lessonId);
  }
  if (!row) throw serverError('upsertProgress returned no row');
  // Task 11 (E11 — hoan thanh khoa): CHI khi bai VUA chuyen sang
  // completed (bai da completed tu truoc thi khong goi lai). Hook tu
  // try/catch ben trong va KHONG BAO GIO throw — loi email hay loi
  // danh dau completed khong lam hong response luu tien do nay.
  // Danh dau completed + gui mail chuc mung; neu chua co key Resend
  // thi enrollment van completed, chi bo qua buoc gui mail.
  const wasCompleted =
    opts.previous?.completion_status === 'completed' || opts.previous?.status === 'completed';
  if (isCompleted && !wasCompleted) {
    await maybeCompleteCourseAndNotify(env, {
      userId: opts.userId,
      courseId: opts.courseId,
      nowIso: opts.nowIso,
    });
  }
  return jsonOk({ data: toClientRow(row) }, 200);
}

/** Hinh dang dong progress frontend doi (progress.ts LessonProgressRow). */
function toClientRow(row: ProgressRow): Record<string, unknown> {
  return {
    user_id: row.user_id,
    course_id: row.course_id,
    lesson_id: row.lesson_id,
    status: row.status,
    completion_status: row.completion_status,
    progress_percent: row.progress_percent,
    video_position: row.video_position,
    last_position_sec: row.last_position_sec,
    started_at: row.started_at,
    last_accessed: row.last_accessed,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
