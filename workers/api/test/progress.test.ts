// Test POST /api/v1/progress — JWT JWKS, enrollment, luat 90%,
// chan gian lan (vuot duration, nhay 0%→100%, scrub), quiz passed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { handleRequest } from '../src/index';
import { __resetRateLimits } from '../src/rate-limit';
import { __resetJwksCache } from '../src/jwt';
import {
  ATTEMPT_FAILED,
  ATTEMPT_PASSED,
  COURSE_PUBLISHED,
  LESSON_QUIZ,
  LESSON_TEXT,
  LESSON_VIDEO,
  USER_ENROLLED,
  USER_STRANGER,
  createFakeState,
  createMockFetch,
  generateTestKeyPair,
  signTestJwt,
  testJwtPayload,
  type FakeState,
  type TestKeyPair,
} from './fake-supabase';

const BASE_URL = 'https://visfaracademy.netlify.app';
const KID = 'test-kid-1';

let state: FakeState;
let env: Env;
let keys: TestKeyPair;

async function postProgress(
  body: Record<string, unknown>,
  opts: { token?: string | null; userId?: string } = {},
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const token =
    opts.token !== undefined
      ? opts.token
      : await signTestJwt(keys.privateKey, KID, testJwtPayload(opts.userId ?? USER_ENROLLED));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': `prog-${Math.random().toString(36).slice(2)}`,
    'CF-Connecting-IP': '203.0.113.20',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await handleRequest(
    new Request(`${BASE_URL}/api/v1/progress`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    env,
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, headers: res.headers };
}

function videoBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lesson_id: LESSON_VIDEO,
    course_id: COURSE_PUBLISHED,
    lesson_type: 'video',
    event: 'position',
    video_position_sec: 300,
    progress_percent: 50,
    explicit_complete: false,
    ...overrides,
  };
}

beforeEach(async () => {
  state = createFakeState();
  env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    APPS_SCRIPT_URL: 'https://script.google.test/exec',
  };
  keys = await generateTestKeyPair(KID);
  state.jwksKeys = [keys.publicJwk];
  vi.stubGlobal('fetch', createMockFetch(state));
  __resetRateLimits();
  __resetJwksCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/v1/progress — JWT', () => {
  it('thiếu JWT → 401 unauthorized', async () => {
    const { status, json } = await postProgress(videoBody(), { token: null });
    expect(status).toBe(401);
    expect(json.error).toBe('unauthorized');
  });

  it('JWT ký sai khóa → 401', async () => {
    const other = await generateTestKeyPair('other-kid');
    const bad = await signTestJwt(other.privateKey, KID, testJwtPayload(USER_ENROLLED));
    const { status, json } = await postProgress(videoBody(), { token: bad });
    expect(status).toBe(401);
    expect(json.error).toBe('unauthorized');
  });

  it('JWT hết hạn → 401', async () => {
    const expired = await signTestJwt(
      keys.privateKey,
      KID,
      testJwtPayload(USER_ENROLLED, { exp: Math.floor(Date.now() / 1000) - 60 }),
    );
    const { status, json } = await postProgress(videoBody(), { token: expired });
    expect(status).toBe(401);
    expect(json.error).toBe('unauthorized');
  });

  it('JWT sai iss → 401', async () => {
    const wrongIss = await signTestJwt(
      keys.privateKey,
      KID,
      testJwtPayload(USER_ENROLLED, { iss: 'https://evil.example/auth/v1' }),
    );
    const { status, json } = await postProgress(videoBody(), { token: wrongIss });
    expect(status).toBe(401);
    expect(json.error).toBe('unauthorized');
  });

  it('JWT sai aud → 401', async () => {
    const wrongAud = await signTestJwt(
      keys.privateKey,
      KID,
      testJwtPayload(USER_ENROLLED, { aud: 'anon' }),
    );
    const { status, json } = await postProgress(videoBody(), { token: wrongAud });
    expect(status).toBe(401);
    expect(json.error).toBe('unauthorized');
  });
});

describe('POST /api/v1/progress — enrollment + video', () => {
  it('chưa ghi danh → 403 forbidden', async () => {
    const { status, json } = await postProgress(videoBody(), { userId: USER_STRANGER });
    expect(status).toBe(403);
    expect(json.error).toBe('forbidden');
  });

  it('bài không tồn tại → 404 not_found', async () => {
    const { status, json } = await postProgress(
      videoBody({ lesson_id: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(status).toBe(404);
    expect(json.error).toBe('not_found');
  });

  it('video 300/600s → 200 in_progress, percent 50 do server tính', async () => {
    const { status, json } = await postProgress(videoBody());
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('in_progress');
    expect(data['progress_percent']).toBe(50);
    expect(data['video_position']).toBe(300);
    expect(data['started_at']).toBeTruthy();
    expect(data['completed_at']).toBeNull();
  });

  it('client khai percent 100 nhưng position mới 300/600 → server tính lại 50%, KHÔNG completed', async () => {
    const { status, json } = await postProgress(
      videoBody({ progress_percent: 100, event: 'position' }),
    );
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['progress_percent']).toBe(50);
    expect(data['completion_status']).toBe('in_progress');
  });

  it('video_position 660 > duration 600 + 10 → 400 invalid_input', async () => {
    const { status, json } = await postProgress(videoBody({ video_position_sec: 660 }));
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });

  it('video completed khi mới xem 300/600 (50%) → 400, chưa đủ 90%', async () => {
    const { status, json } = await postProgress(
      videoBody({ event: 'completed', explicit_complete: true }),
    );
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });

  it('video completed với position 540/600 (90%) → 200 completed, completed_at có giá trị', async () => {
    const { status, json } = await postProgress(
      videoBody({ video_position_sec: 540, event: 'completed', explicit_complete: true }),
    );
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('completed');
    expect(data['progress_percent']).toBe(90);
    expect(data['completed_at']).toBeTruthy();
  });

  it('video position 570/600 (95%) qua event position → tự completed (luật 90%)', async () => {
    const { status, json } = await postProgress(
      videoBody({ video_position_sec: 570, event: 'position' }),
    );
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('completed');
    expect(data['progress_percent']).toBe(95);
  });

  it('nhảy 0%→100% trong 1 request (scrub tới cuối ngay sau khi bắt đầu) → 400', async () => {
    // Dong cu: vua bat dau (position 0, last_accessed = hien tai).
    const nowIso = new Date().toISOString();
    state.progress.set(`${USER_ENROLLED}|${LESSON_VIDEO}`, {
      user_id: USER_ENROLLED,
      course_id: COURSE_PUBLISHED,
      lesson_id: LESSON_VIDEO,
      status: 'in_progress',
      completion_status: 'in_progress',
      progress_percent: 0,
      video_position: 0,
      last_position_sec: 0,
      started_at: nowIso,
      last_accessed: nowIso,
      completed_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    });
    const { status, json } = await postProgress(
      videoBody({ video_position_sec: 600, event: 'completed', explicit_complete: true }),
    );
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });

  it('hoàn thành video khi không đưa video_position (claim 0%→100% không bằng chứng) → 400', async () => {
    const { status, json } = await postProgress(
      videoBody({
        video_position_sec: null,
        progress_percent: 100,
        event: 'completed',
        explicit_complete: true,
      }),
    );
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });

  it('mở bài lần đầu (opened, chưa có previous/position) → not_started, không tự completed', async () => {
    // Cung luat voi progress.ts resolveProgressUpdate: mo bai lan dau
    // chua co vi tri thi van la not_started (chi ghi started_at/last_accessed).
    const { status, json } = await postProgress(
      videoBody({ video_position_sec: null, progress_percent: null, event: 'opened' }),
    );
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('not_started');
    expect(data['progress_percent']).toBe(0);
    expect(data['started_at']).toBeTruthy();
  });

  it('mở bài lần 2 (đã có dòng in_progress) → vẫn in_progress', async () => {
    await postProgress(videoBody({ video_position_sec: 300 }));
    const { status, json } = await postProgress(
      videoBody({ video_position_sec: null, progress_percent: null, event: 'opened' }),
    );
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('in_progress');
    expect(data['progress_percent']).toBe(50);
  });
});

describe('POST /api/v1/progress — text / quiz', () => {
  it('bài text bấm "Đã hoàn thành" → completed 100%', async () => {
    const { status, json } = await postProgress({
      lesson_id: LESSON_TEXT,
      course_id: COURSE_PUBLISHED,
      lesson_type: 'text',
      event: 'completed',
      explicit_complete: true,
    });
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('completed');
    expect(data['progress_percent']).toBe(100);
  });

  it('bài text chỉ mở lần đầu → not_started, không completed', async () => {
    const { status, json } = await postProgress({
      lesson_id: LESSON_TEXT,
      course_id: COURSE_PUBLISHED,
      lesson_type: 'text',
      event: 'opened',
      explicit_complete: false,
    });
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('not_started');
  });

  it('quiz completed nhưng không có quiz_attempt_id → 400', async () => {
    const { status, json } = await postProgress({
      lesson_id: LESSON_QUIZ,
      course_id: COURSE_PUBLISHED,
      lesson_type: 'quiz',
      event: 'completed',
      progress_percent: 100,
      explicit_complete: true,
    });
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });

  it('quiz attempt chưa đạt (passed=false) → 400, không completed', async () => {
    const { status, json } = await postProgress({
      lesson_id: LESSON_QUIZ,
      course_id: COURSE_PUBLISHED,
      lesson_type: 'quiz',
      event: 'completed',
      progress_percent: 100,
      explicit_complete: true,
      quiz_attempt_id: ATTEMPT_FAILED,
    });
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });

  it('quiz attempt ĐẠT (passed=true) → 200 completed 100% (B-T08-5)', async () => {
    const { status, json } = await postProgress({
      lesson_id: LESSON_QUIZ,
      course_id: COURSE_PUBLISHED,
      lesson_type: 'quiz',
      event: 'completed',
      progress_percent: 100,
      explicit_complete: true,
      quiz_attempt_id: ATTEMPT_PASSED,
    });
    expect(status).toBe(200);
    const data = json['data'] as Record<string, unknown>;
    expect(data['completion_status']).toBe('completed');
    expect(data['progress_percent']).toBe(100);
  });

  it('quiz không qua completed (chỉ mở bài) → 400', async () => {
    const { status, json } = await postProgress({
      lesson_id: LESSON_QUIZ,
      course_id: COURSE_PUBLISHED,
      lesson_type: 'quiz',
      event: 'opened',
      explicit_complete: false,
    });
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_input');
  });
});
