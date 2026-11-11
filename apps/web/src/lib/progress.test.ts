// Test Learning Progress — Task 07 (2/4). Chay local, khong can
// Supabase that hay Workers that: logic thuan + ProgressSaver voi
// ham save gia + saveLessonProgress voi fetch gia.
import { describe, expect, it, vi } from 'vitest';
import {
  gradeQuizAttempt,
  type GradedQuestion,
  type QuizAnswerInput,
  type QuizSubmitResult,
} from './quiz';
import {
  VIDEO_COMPLETION_THRESHOLD,
  computeCourseProgressPercent,
  extractYouTubeVideoId,
  formatPosition,
  isProgressRowCompleted,
  markQuizLessonComplete,
  normalizePreviousProgress,
  ProgressSaver,
  resolveProgressUpdate,
  resolveQuizCompletion,
  saveLessonProgress,
  shouldSavePosition,
  videoProgressPercent,
  type LessonProgressRow,
  type PreviousProgress,
} from './progress';

function makeRow(over: Partial<LessonProgressRow> = {}): LessonProgressRow {
  return {
    user_id: 'u1',
    course_id: 'c1',
    lesson_id: 'l1',
    status: 'in_progress',
    completion_status: 'in_progress',
    progress_percent: 0,
    video_position: null,
    last_position_sec: null,
    started_at: '2026-11-10T00:00:00.000Z',
    last_accessed: '2026-11-10T00:00:00.000Z',
    completed_at: null,
    created_at: '2026-11-10T00:00:00.000Z',
    updated_at: '2026-11-10T00:00:00.000Z',
    ...over,
  };
}

const notStarted: PreviousProgress = { completionStatus: 'not_started', progressPercent: 0, positionSec: null };

describe('videoProgressPercent — nguong 90% (QĐ 17)', () => {
  it('0 giay -> 0%', () => {
    expect(videoProgressPercent(0, 600)).toBe(0);
  });
  it('540/600 giay = 90% -> dat nguong', () => {
    expect(videoProgressPercent(540, 600)).toBe(90);
  });
  it('539/600 giay = 89,83% that -> floor 89% -> CHUA dat nguong', () => {
    // Co y dung floor (khong round len 90%): chua xem du 90% that
    // thi khong duoc hoan thanh. Cung quy tac o trigger DB (0012).
    expect(videoProgressPercent(539, 600)).toBe(89);
  });
  it('530/600 = 88% -> chua dat', () => {
    expect(videoProgressPercent(530, 600)).toBe(88);
  });
  it('vuot duration -> chan 100%', () => {
    expect(videoProgressPercent(700, 600)).toBe(100);
  });
  it('duration khong biet -> 0% (khong tu hoan thanh)', () => {
    expect(videoProgressPercent(300, null)).toBe(0);
    expect(videoProgressPercent(300, 0)).toBe(0);
  });
  it('nguong la 90', () => {
    expect(VIDEO_COMPLETION_THRESHOLD).toBe(90);
  });
});

describe('resolveProgressUpdate — KHONG auto-complete khi mo', () => {
  it('mo bai video (khong vi tri) -> not_started, khong completed', () => {
    const d = resolveProgressUpdate({ lessonType: 'video' });
    expect(d.completionStatus).toBe('not_started');
    expect(d.shouldComplete).toBe(false);
    expect(d.blockedReason).toBeNull();
  });
  it('mo bai text -> not_started, khong completed', () => {
    const d = resolveProgressUpdate({ lessonType: 'text' });
    expect(d.completionStatus).toBe('not_started');
    expect(d.shouldComplete).toBe(false);
  });
  it('xem video 50% -> in_progress, khong completed', () => {
    const d = resolveProgressUpdate({
      lessonType: 'video',
      positionSec: 300,
      durationSec: 600,
      previous: notStarted,
    });
    expect(d.completionStatus).toBe('in_progress');
    expect(d.progressPercent).toBe(50);
    expect(d.shouldComplete).toBe(false);
  });
  it('xem video 89% -> in_progress, khong completed', () => {
    const d = resolveProgressUpdate({
      lessonType: 'video',
      positionSec: 534,
      durationSec: 600,
      previous: notStarted,
    });
    expect(d.progressPercent).toBe(89);
    expect(d.shouldComplete).toBe(false);
  });
  it('xem video 539/600 giay (89,83% that) -> van in_progress, khong completed', () => {
    const d = resolveProgressUpdate({
      lessonType: 'video',
      positionSec: 539,
      durationSec: 600,
      previous: notStarted,
    });
    expect(d.progressPercent).toBe(89);
    expect(d.completionStatus).toBe('in_progress');
    expect(d.shouldComplete).toBe(false);
  });
  it('xem video 90% -> completed (tu dong, dung luat)', () => {
    const d = resolveProgressUpdate({
      lessonType: 'video',
      positionSec: 540,
      durationSec: 600,
      previous: notStarted,
    });
    expect(d.completionStatus).toBe('completed');
    expect(d.shouldComplete).toBe(true);
  });
  it('bam "Da hoan thanh" bai text -> completed 100%', () => {
    const d = resolveProgressUpdate({ lessonType: 'text', explicitComplete: true, previous: notStarted });
    expect(d.completionStatus).toBe('completed');
    expect(d.progressPercent).toBe(100);
    expect(d.shouldComplete).toBe(true);
  });
  it('bam "Da hoan thanh" bai file/audio -> completed 100%', () => {
    const d = resolveProgressUpdate({ lessonType: 'file', explicitComplete: true, previous: notStarted });
    expect(d.completionStatus).toBe('completed');
    expect(d.shouldComplete).toBe(true);
  });
  it('bam "Da hoan thanh" bai video khi moi 10% -> BI CHAN', () => {
    const d = resolveProgressUpdate({
      lessonType: 'video',
      positionSec: 60,
      durationSec: 600,
      explicitComplete: true,
      previous: notStarted,
    });
    expect(d.shouldComplete).toBe(false);
    expect(d.completionStatus).toBe('in_progress');
    expect(d.blockedReason).toContain('90%');
  });
  it('bam "Da hoan thanh" bai quiz -> BI CHAN (hoan thanh qua nop quiz)', () => {
    const d = resolveProgressUpdate({ lessonType: 'quiz', explicitComplete: true, previous: notStarted });
    expect(d.shouldComplete).toBe(false);
    expect(d.blockedReason).toContain('quiz');
  });
  it('nhay 0% -> 100% khi chua du dieu kien: video khong position -> khong completed', () => {
    // Ke ca gui progressPercent=100 kem, video van tinh tu position/duration.
    const d = resolveProgressUpdate({
      lessonType: 'video',
      progressPercent: 100,
      explicitComplete: true,
      previous: notStarted,
    });
    expect(d.shouldComplete).toBe(false);
    expect(d.blockedReason).toContain('90%');
  });
  it('da completed tu truoc: giu completed, van cap nhat position', () => {
    const d = resolveProgressUpdate({
      lessonType: 'video',
      positionSec: 100,
      durationSec: 600,
      previous: { completionStatus: 'completed', progressPercent: 100, positionSec: 540 },
    });
    expect(d.completionStatus).toBe('completed');
    expect(d.positionSec).toBe(100);
    expect(d.shouldComplete).toBe(false);
  });
  it('resume: previous position duoc giu khi tick moi khong co position', () => {
    const d = resolveProgressUpdate({
      lessonType: 'video',
      durationSec: 600,
      previous: { completionStatus: 'in_progress', progressPercent: 50, positionSec: 300 },
    });
    expect(d.positionSec).toBe(300);
    expect(d.progressPercent).toBe(50);
  });
});

describe('isProgressRowCompleted / normalizePreviousProgress', () => {
  it('uu tien completion_status moi', () => {
    expect(isProgressRowCompleted(makeRow({ completion_status: 'completed', status: 'in_progress' }), 'text')).toBe(true);
  });
  it('roi ve cot legacy status khi completion_status null', () => {
    expect(isProgressRowCompleted(makeRow({ completion_status: null, status: 'completed' }), 'text')).toBe(true);
    expect(isProgressRowCompleted(makeRow({ completion_status: null, status: 'in_progress', progress_percent: 10 }), 'text')).toBe(false);
  });
  it('video >= 90% tinh completed du status chua doi', () => {
    expect(isProgressRowCompleted(makeRow({ progress_percent: 95 }), 'video')).toBe(true);
    expect(isProgressRowCompleted(makeRow({ progress_percent: 50 }), 'video')).toBe(false);
  });
  it('normalize: video_position uu tien hon last_position_sec', () => {
    const p = normalizePreviousProgress(makeRow({ video_position: 120, last_position_sec: 60 }));
    expect(p?.positionSec).toBe(120);
    const p2 = normalizePreviousProgress(makeRow({ video_position: null, last_position_sec: 60 }));
    expect(p2?.positionSec).toBe(60);
  });
  it('normalize: null -> null', () => {
    expect(normalizePreviousProgress(null)).toBeNull();
  });
});

describe('computeCourseProgressPercent', () => {
  it('0 bai -> 0%', () => {
    expect(computeCourseProgressPercent(0, 0)).toBe(0);
  });
  it('3/10 -> 30%', () => {
    expect(computeCourseProgressPercent(10, 3)).toBe(30);
  });
  it('10/10 -> 100%', () => {
    expect(computeCourseProgressPercent(10, 10)).toBe(100);
  });
});

describe('formatPosition / extractYouTubeVideoId', () => {
  it('format mm:ss', () => {
    expect(formatPosition(0)).toBe('0:00');
    expect(formatPosition(65)).toBe('1:05');
    expect(formatPosition(540)).toBe('9:00');
    expect(formatPosition(3661)).toBe('1:01:01');
    expect(formatPosition(null)).toBe('0:00');
  });
  it('tach id tu watch / youtu.be / embed / shorts', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('link khong phai YouTube / rac -> null', () => {
    expect(extractYouTubeVideoId('https://example.com/video.mp4')).toBeNull();
    expect(extractYouTubeVideoId('')).toBeNull();
    expect(extractYouTubeVideoId(null)).toBeNull();
    expect(extractYouTubeVideoId('not a url')).toBeNull();
  });
});

describe('shouldSavePosition — khong spam DB', () => {
  it('chua luu lan nao -> luu', () => {
    expect(shouldSavePosition(null, 10, 5)).toBe(true);
  });
  it('doi < 2 giay -> khong luu', () => {
    expect(shouldSavePosition(100, 101, 20)).toBe(false);
  });
  it('doi >= 2 giay -> luu', () => {
    expect(shouldSavePosition(100, 102, 20)).toBe(true);
  });
  it('cham 90% -> luu ngay du doi nho', () => {
    expect(shouldSavePosition(539, 540, 90)).toBe(true);
  });
});

describe('ProgressSaver — debounce + flush', () => {
  it('gom nhieu tick thanh 1 lan ghi sau debounce; flush ghi ngay', async () => {
    vi.useFakeTimers();
    try {
      const calls: Array<{ pos: number; pct: number }> = [];
      const saver = new ProgressSaver(
        async (pos, pct) => {
          calls.push({ pos, pct });
          return { status: 'ok', progress: makeRow({ video_position: pos, progress_percent: pct }) };
        },
        { debounceMs: 5000, initialPositionSec: 0 },
      );
      saver.update(10, 600);
      saver.update(12, 600);
      saver.update(14, 600);
      expect(calls).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(5000);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ pos: 14, pct: 2 });

      // Tick nho (< 2 giay) khong len lich ghi.
      saver.update(15, 600);
      await vi.advanceTimersByTimeAsync(5000);
      expect(calls).toHaveLength(1);

      // flush() ghi ngay khong doi debounce.
      saver.update(30, 600);
      const flushed = await saver.flush();
      expect(flushed?.status).toBe('ok');
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual({ pos: 30, pct: 5 });
      saver.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ghi loi -> giu pending de flush sau thu lai', async () => {
    vi.useFakeTimers();
    try {
      let fail = true;
      const saver = new ProgressSaver(
        async (pos, pct) => {
          if (fail) return { status: 'error', message: 'Workers chua deploy', isOffline: false };
          return { status: 'ok', progress: makeRow({ video_position: pos, progress_percent: pct }) };
        },
        { debounceMs: 1000, initialPositionSec: null },
      );
      saver.update(20, 600);
      await vi.advanceTimersByTimeAsync(1000);
      fail = false;
      const res = await saver.flush();
      expect(res?.status).toBe('ok');
      saver.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('saveLessonProgress — chan o client truoc khi goi Workers', () => {
  // Fake supabase client: signed-in, chua co progress.
  function fakeClient() {
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: 'u1' } } }),
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }),
      }),
    };
  }

  it('bam hoan thanh video 10% -> blocked, KHONG goi fetch', async () => {
    const fetchImpl = vi.fn();
    const res = await saveLessonProgress(
      { lessonId: 'l1', courseId: 'c1', lessonType: 'video', positionSec: 60, durationSec: 600, explicitComplete: true },
      { client: fakeClient() as never, fetchImpl: fetchImpl as never },
    );
    expect(res.status).toBe('blocked');
    if (res.status === 'blocked') expect(res.reason).toContain('90%');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('bam hoan thanh bai text -> goi POST /progress', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    const fetchImpl = vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body ?? '');
      const body = { ok: true, data: makeRow({ completion_status: 'completed', status: 'completed', progress_percent: 100 }) };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const res = await saveLessonProgress(
      { lessonId: 'l1', courseId: 'c1', lessonType: 'text', explicitComplete: true },
      { client: fakeClient() as never, fetchImpl: fetchImpl as never },
    );
    expect(res.status).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toContain('/progress');
    const sent = JSON.parse(capturedBody) as Record<string, unknown>;
    expect(sent.lesson_id).toBe('l1');
    expect(sent.event).toBe('completed');
    expect(sent.explicit_complete).toBe(true);
  });

  it('Workers chua deploy (fetch loi) -> error ro, khong "ok" gia', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const res = await saveLessonProgress(
      { lessonId: 'l1', courseId: 'c1', lessonType: 'text', explicitComplete: true },
      { client: fakeClient() as never, fetchImpl: fetchImpl as never },
    );
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.isOffline).toBe(true);
  });
});

describe('markQuizLessonComplete — quiz DAT moi hoan thanh (B-T08-5)', () => {
  // Fake supabase client: signed-in (chi de lay JWT goi Workers).
  function fakeClient() {
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: 'u1' } } }),
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }),
      }),
    };
  }

  function passedResult(over: Partial<QuizSubmitResult> = {}): QuizSubmitResult {
    return {
      attemptId: 'att-1',
      score: 7,
      total: 10,
      percent: 70,
      passed: true,
      needsReview: false,
      status: 'submitted',
      results: [],
      ...over,
    };
  }

  function okFetch() {
    return vi.fn(async () => {
      const body = {
        ok: true,
        data: makeRow({ completion_status: 'completed', status: 'completed', progress_percent: 100 }),
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  }

  it('resolveQuizCompletion: passed=true -> shouldComplete; passed=false -> blocked', () => {
    expect(resolveQuizCompletion(passedResult()).shouldComplete).toBe(true);
    expect(resolveQuizCompletion(passedResult()).blockedReason).toBeNull();
    const fail = resolveQuizCompletion(
      passedResult({ score: 6, percent: 60, passed: false }),
    );
    expect(fail.shouldComplete).toBe(false);
    expect(fail.blockedReason).toContain('60%');
  });

  it('dat 7/10 = 70% -> POST /progress (quiz/completed/100%, kem quiz_attempt_id)', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    const fetchImpl = vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body ?? '');
      const body = {
        ok: true,
        data: makeRow({ completion_status: 'completed', status: 'completed', progress_percent: 100 }),
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const res = await markQuizLessonComplete('l1', 'c1', passedResult(), {
      client: fakeClient() as never,
      fetchImpl: fetchImpl as never,
    });
    expect(res.status).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toContain('/progress');
    const sent = JSON.parse(capturedBody) as Record<string, unknown>;
    expect(sent.lesson_id).toBe('l1');
    expect(sent.course_id).toBe('c1');
    expect(sent.lesson_type).toBe('quiz');
    expect(sent.event).toBe('completed');
    expect(sent.progress_percent).toBe(100);
    expect(sent.quiz_attempt_id).toBe('att-1');
  });

  it('chua dat 6/10 = 60% -> blocked, KHONG goi fetch (khong ghi lesson_progress)', async () => {
    const fetchImpl = vi.fn();
    const res = await markQuizLessonComplete(
      'l1',
      'c1',
      passedResult({ score: 6, percent: 60, passed: false }),
      { client: fakeClient() as never, fetchImpl: fetchImpl as never },
    );
    expect(res.status).toBe('blocked');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('het gio (expired, passed=false) -> blocked, KHONG goi fetch', async () => {
    const fetchImpl = vi.fn();
    const res = await markQuizLessonComplete(
      'l1',
      'c1',
      passedResult({ score: 8, percent: 80, passed: false, status: 'expired' }),
      { client: fakeClient() as never, fetchImpl: fetchImpl as never },
    );
    expect(res.status).toBe('blocked');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Workers chua deploy (fetch loi) -> error ro, khong "ok" gia', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const res = await markQuizLessonComplete('l1', 'c1', passedResult(), {
      client: fakeClient() as never,
      fetchImpl: fetchImpl as never,
    });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.isOffline).toBe(true);
  });

  it('nguong mac dinh 70% qua gradeQuizAttempt: 7/10 dat -> goi fetch; 6/10 truot -> khong goi', async () => {
    const questions: GradedQuestion[] = Array.from({ length: 10 }, (_, i) => ({
      id: `q${i}`,
      questionType: 'single_choice' as const,
      points: 1,
      options: [
        { id: `q${i}-a`, optionText: 'Sai', isCorrect: false },
        { id: `q${i}-b`, optionText: 'Đúng', isCorrect: true },
      ],
    }));
    const answersFor = (n: number): QuizAnswerInput[] =>
      questions.slice(0, n).map((q) => ({ questionId: q.id, optionIds: [`${q.id}-b`] }));

    // 7/10 = 70% dung nguong mac dinh -> DAT -> ghi tien do.
    const pass = gradeQuizAttempt(questions, answersFor(7));
    expect(pass.percent).toBe(70);
    expect(pass.passed).toBe(true);
    const fetchPass = okFetch();
    const resPass = await markQuizLessonComplete(
      'l1',
      'c1',
      passedResult({ score: pass.score, total: pass.total, percent: pass.percent, passed: pass.passed }),
      { client: fakeClient() as never, fetchImpl: fetchPass as never },
    );
    expect(resPass.status).toBe('ok');
    expect(fetchPass).toHaveBeenCalledTimes(1);

    // 6/10 = 60% duoi nguong mac dinh -> TRUOT -> khong ghi.
    const fail = gradeQuizAttempt(questions, answersFor(6));
    expect(fail.percent).toBe(60);
    expect(fail.passed).toBe(false);
    const fetchFail = vi.fn();
    const resFail = await markQuizLessonComplete(
      'l1',
      'c1',
      passedResult({ score: fail.score, total: fail.total, percent: fail.percent, passed: fail.passed }),
      { client: fakeClient() as never, fetchImpl: fetchFail as never },
    );
    expect(resFail.status).toBe('blocked');
    expect(fetchFail).not.toHaveBeenCalled();
  });

  it('khong tu tinh lai dat/truot theo 70: quiz nguong 80% lam 75% -> truot, khong goi fetch', async () => {
    const questions: GradedQuestion[] = Array.from({ length: 4 }, (_, i) => ({
      id: `q${i}`,
      questionType: 'single_choice' as const,
      points: 1,
      options: [
        { id: `q${i}-a`, optionText: 'Sai', isCorrect: false },
        { id: `q${i}-b`, optionText: 'Đúng', isCorrect: true },
      ],
    }));
    const graded = gradeQuizAttempt(
      questions,
      questions.slice(0, 3).map((q) => ({ questionId: q.id, optionIds: [`${q.id}-b`] })),
      80,
    );
    expect(graded.percent).toBe(75);
    expect(graded.passed).toBe(false); // 75% >= 70 mac dinh nhung < 80 cua quiz -> truot
    const fetchImpl = vi.fn();
    const res = await markQuizLessonComplete(
      'l1',
      'c1',
      passedResult({ score: graded.score, total: graded.total, percent: graded.percent, passed: graded.passed }),
      { client: fakeClient() as never, fetchImpl: fetchImpl as never },
    );
    expect(res.status).toBe('blocked');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
