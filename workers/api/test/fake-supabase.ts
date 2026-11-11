// Fake Supabase PostgREST + Apps Script + Turnstile cho test Workers API.
// Chi cai dat dung tap con ma src/ dung: GET co filter eq.*, POST insert
// (UNIQUE idempotency_key / reference_code), POST upsert on_conflict.
// KHONG phai Supabase that — test live staging nam o bao cao, khong o day.
export const COURSE_PUBLISHED = '11111111-1111-4111-8111-111111111111';
export const COURSE_DRAFT = '22222222-2222-4222-8222-222222222222';
export const LESSON_VIDEO = '33333333-3333-4333-8333-333333333333';
export const LESSON_TEXT = '44444444-4444-4333-8333-444444444444';
export const LESSON_QUIZ = '55555555-5555-4333-8333-555555555555';
export const USER_ENROLLED = '66666666-6666-4666-8666-666666666666';
export const USER_STRANGER = '77777777-7777-4777-8777-777777777777';
export const ATTEMPT_PASSED = '88888888-8888-4888-8888-888888888888';
export const ATTEMPT_FAILED = '99999999-9999-4999-8999-999999999999';

export interface FakeState {
  leads: Array<Record<string, unknown>>;
  subscribers: Array<Record<string, unknown>>;
  progress: Map<string, Record<string, unknown>>;
  sheetCalls: Array<Record<string, unknown>>;
  sheetShouldFail: boolean;
  turnstileShouldFail: boolean;
  insertShouldFail: boolean;
  healthShouldFail: boolean;
  jwksKeys: Array<Record<string, unknown>>;
  aiSessions: Array<Record<string, unknown>>;
  aiMessages: Array<Record<string, unknown>>;
}

export function createFakeState(): FakeState {
  return {
    leads: [],
    subscribers: [],
    progress: new Map(),
    sheetCalls: [],
    sheetShouldFail: false,
    turnstileShouldFail: false,
    insertShouldFail: false,
    healthShouldFail: false,
    jwksKeys: [],
    aiSessions: [],
    aiMessages: [],
  };
}

// Chunk mau cho AI Mentor (Prompt 12): 1 muc Thu vien, 1 khoa hoc,
// 1 "moi" ngoai pham vi de kiem tra bo loc.
export const AI_CHUNK_AN_VUI = {
  chunk_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  source_type: 'library',
  source_slug: 'an-vui',
  title: 'An Vui',
  content:
    'An vui là trạng thái nhận thức nội tâm xuất phát từ sự chân thật nơi chính mình, xuất phát từ Nghe – Thấy – Nói – Biết mà không dính mắc vào lớp Tánh và lớp Tình của con người.',
  keywords: 'an vui tam thai',
  rank: 148.9,
  matched_words: 2,
  title_match: true,
  pair_bonus: 15,
};

export const AI_CHUNK_COURSE_TAM_THUC = {
  chunk_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  source_type: 'course',
  source_slug: 'thau-hieu-tam-thuc',
  title: 'Thấu Hiểu Tâm Thức',
  content: 'Thấu hiểu tâm thức — nền tảng của sự phát triển toàn diện con người.',
  keywords: 'thau hieu tam thuc',
  rank: 124.4,
  matched_words: 4,
  title_match: false,
  pair_bonus: 30,
};

export const AI_CHUNK_OUT_OF_SCOPE = {
  chunk_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  source_type: 'library',
  source_slug: 'yeu-thuong',
  title: 'Yêu Thương',
  content: 'Yêu thương là trạng thái nội tâm khi...',
  keywords: 'yeu thuong',
  rank: 33.0,
  matched_words: 3,
  title_match: false,
  pair_bonus: 0,
};

const LESSONS: Record<string, { type: string; video_duration_sec: number | null; course_id: string }> = {
  [LESSON_VIDEO]: { type: 'video', video_duration_sec: 600, course_id: COURSE_PUBLISHED },
  [LESSON_TEXT]: { type: 'text', video_duration_sec: null, course_id: COURSE_PUBLISHED },
  [LESSON_QUIZ]: { type: 'quiz', video_duration_sec: null, course_id: COURSE_PUBLISHED },
};

const ATTEMPTS: Record<string, { user_id: string; lesson_id: string; passed: boolean }> = {
  [ATTEMPT_PASSED]: { user_id: USER_ENROLLED, lesson_id: LESSON_QUIZ, passed: true },
  [ATTEMPT_FAILED]: { user_id: USER_ENROLLED, lesson_id: LESSON_QUIZ, passed: false },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function eqFilters(url: URL): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of url.searchParams) {
    if (v.startsWith('eq.')) out.push([k, decodeURIComponent(v.slice(3))]);
  }
  return out;
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], url: URL): T[] {
  let out = rows;
  for (const [k, v] of eqFilters(url)) {
    out = out.filter((r) => String(r[k] ?? '') === v);
  }
  const limit = url.searchParams.get('limit');
  if (limit) out = out.slice(0, Number.parseInt(limit, 10));
  return out;
}

export function createMockFetch(state: FakeState): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const href = url.href;

    // JWKS Supabase Auth.
    if (href.includes('/auth/v1/.well-known/jwks.json')) {
      return jsonResponse({ keys: state.jwksKeys });
    }
    // Turnstile siteverify.
    if (href.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
      return jsonResponse({ success: !state.turnstileShouldFail });
    }
    // Apps Script Web App.
    if (href.startsWith('https://script.google.test/')) {
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      state.sheetCalls.push(body);
      if (state.sheetShouldFail) return jsonResponse({ ok: false, error: 'Sheet loi gia lap.' });
      return jsonResponse({ ok: true, source: body['source'], message: 'Đã ghi thành công.' });
    }
    // Supabase REST.
    if (href.startsWith('https://test.supabase.co/rest/v1/')) {
      const table = url.pathname.replace('/rest/v1/', '');
      if (method === 'GET' && table === 'courses') {
        if (state.healthShouldFail) return jsonResponse({ message: 'bang khong ton tai', code: 'PGRST205' }, 404);
        const rows = [
          { id: COURSE_PUBLISHED, slug: 'thau-hieu-tam-thuc', title: 'Thấu Hiểu Tâm Thức', status: 'published' },
          { id: COURSE_DRAFT, slug: 'khoa-nhap', title: 'Khóa Nháp', status: 'draft' },
        ];
        return jsonResponse(applyFilters(rows, url));
      }
      // RPC tim kiem AI Mentor (Prompt 12) — tra chunk mau theo tu khoa.
      if (method === 'POST' && table === 'rpc/search_ai_knowledge') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        const q = String(body['p_query'] ?? '').toLowerCase();
        const unaccented = q.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
        if (q.includes('an vui') || unaccented.includes('an vui')) return jsonResponse([AI_CHUNK_AN_VUI]);
        if (q.includes('tâm thức') || unaccented.includes('tam thuc'))
          return jsonResponse([AI_CHUNK_COURSE_TAM_THUC, AI_CHUNK_AN_VUI]);
        if (q.includes('chung khoan') || q.includes('chứng khoán')) return jsonResponse([AI_CHUNK_OUT_OF_SCOPE]);
        return jsonResponse([]);
      }
      if (table === 'ai_chat_sessions') {
        if (method === 'GET') return jsonResponse(applyFilters([...state.aiSessions], url));
        if (method === 'POST') {
          const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
          const row = {
            id: `sess-${state.aiSessions.length + 1}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...body,
          };
          state.aiSessions.push(row);
          return jsonResponse([row], 201);
        }
      }
      if (table === 'ai_chat_messages') {
        if (method === 'GET') return jsonResponse(applyFilters([...state.aiMessages], url));
        if (method === 'POST') {
          const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
          const row = {
            id: `msg-${state.aiMessages.length + 1}`,
            helpful: null,
            created_at: new Date().toISOString(),
            ...body,
          };
          state.aiMessages.push(row);
          return jsonResponse([row], 201);
        }
        if (method === 'PATCH') {
          const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
          const id = eqFilters(url).find(([k]) => k === 'id')?.[1];
          const userId = eqFilters(url).find(([k]) => k === 'user_id')?.[1];
          const row = state.aiMessages.find((m) => m['id'] === id && m['user_id'] === userId);
          if (!row) return jsonResponse([]);
          Object.assign(row, body);
          return jsonResponse([row]);
        }
      }
      if (method === 'GET' && table === 'leads') {
        return jsonResponse(applyFilters([...state.leads], url));
      }
      // Newsletter subscribers (QA-18-FUNC-01): GET theo email, POST
      // insert (UNIQUE email -> 23505), PATCH theo email (huy / mo lai).
      if (table === 'newsletter_subscribers') {
        if (method === 'GET') {
          return jsonResponse(applyFilters([...state.subscribers], url));
        }
        if (method === 'POST') {
          const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
          if (state.subscribers.some((s) => s['email'] === body['email'])) {
            return jsonResponse({ message: 'duplicate key email', code: '23505' }, 409);
          }
          const row = {
            id: `sub-${state.subscribers.length + 1}`,
            status: 'subscribed',
            unsubscribed_at: null,
            unsubscribe_reason: null,
            hard_bounced_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...body,
          };
          state.subscribers.push(row);
          return jsonResponse([row], 201);
        }
        if (method === 'PATCH') {
          const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
          const email = eqFilters(url).find(([k]) => k === 'email')?.[1];
          const row = state.subscribers.find((s) => s['email'] === email);
          if (!row) return jsonResponse([]);
          Object.assign(row, body, { updated_at: new Date().toISOString() });
          return jsonResponse([row]);
        }
      }
      if (method === 'POST' && table === 'leads') {
        if (state.insertShouldFail) {
          return jsonResponse({ message: 'gia lap loi DB', code: 'XX000' }, 500);
        }
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        if (state.leads.some((l) => l['idempotency_key'] === body['idempotency_key'])) {
          return jsonResponse({ message: 'duplicate key idempotency_key', code: '23505' }, 409);
        }
        if (state.leads.some((l) => l['reference_code'] === body['reference_code'])) {
          return jsonResponse({ message: 'duplicate key reference_code', code: '23505' }, 409);
        }
        const row = { id: `lead-${state.leads.length + 1}`, created_at: new Date().toISOString(), ...body };
        state.leads.push(row);
        return jsonResponse([row], 201);
      }
      if (method === 'GET' && table === 'lessons') {
        const id = eqFilters(url).find(([k]) => k === 'id')?.[1];
        const lesson = id ? LESSONS[id] : undefined;
        if (!lesson) return jsonResponse([]);
        return jsonResponse([
          {
            id,
            type: lesson.type,
            video_duration_sec: lesson.video_duration_sec,
            course_modules: { course_id: lesson.course_id },
          },
        ]);
      }
      if (method === 'GET' && table === 'enrollments') {
        const userId = eqFilters(url).find(([k]) => k === 'user_id')?.[1];
        const courseId = eqFilters(url).find(([k]) => k === 'course_id')?.[1];
        if (userId === USER_ENROLLED && courseId === COURSE_PUBLISHED) {
          return jsonResponse([{ id: 'enr-1', status: 'active' }]);
        }
        return jsonResponse([]);
      }
      if (method === 'GET' && table === 'lesson_progress') {
        const userId = eqFilters(url).find(([k]) => k === 'user_id')?.[1];
        const lessonId = eqFilters(url).find(([k]) => k === 'lesson_id')?.[1];
        const row = state.progress.get(`${userId}|${lessonId}`);
        return jsonResponse(row ? [row] : []);
      }
      if (method === 'POST' && table === 'lesson_progress') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        const key = `${String(body['user_id'])}|${String(body['lesson_id'])}`;
        const prev = state.progress.get(key);
        const now = new Date().toISOString();
        const row = {
          ...(prev ?? { created_at: now }),
          ...body,
          updated_at: now,
          last_accessed: (body['last_accessed'] as string) ?? now,
        };
        state.progress.set(key, row);
        return jsonResponse([row], 201);
      }
      if (method === 'GET' && table === 'quiz_attempts') {
        const id = eqFilters(url).find(([k]) => k === 'id')?.[1];
        const attempt = id ? ATTEMPTS[id] : undefined;
        if (!attempt) return jsonResponse([]);
        return jsonResponse([{ id, ...attempt }]);
      }
      return jsonResponse({ message: `fake chua ho tro ${method} ${table}`, code: 'XX000' }, 500);
    }
    return jsonResponse({ message: `fake: unknown URL ${href}` }, 500);
  }) as typeof fetch;
}

// ---------------------------------------------------------------------------
// Ky JWT RS256 that bang WebCrypto (cho test jwt + progress).
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface TestKeyPair {
  privateKey: CryptoKey;
  publicJwk: Record<string, unknown>;
}

export async function generateTestKeyPair(kid: string): Promise<TestKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as unknown as Record<string, unknown>;
  publicJwk['kid'] = kid;
  publicJwk['alg'] = 'RS256';
  publicJwk['use'] = 'sig';
  return { privateKey: pair.privateKey, publicJwk };
}

export async function signTestJwt(
  privateKey: CryptoKey,
  kid: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const enc = new TextEncoder();
  const h = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const p = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export function testJwtPayload(userId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://test.supabase.co/auth/v1',
    aud: 'authenticated',
    sub: userId,
    exp: now + 3600,
    iat: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Ky JWT ES256 that bang WebCrypto (khoa EC P-256) — Supabase publishable key
// moi phat hanh JWT ES256 (11/11/2026). Chu ky ES256 trong JWT la raw r||s
// 64 bytes, dung dang crypto.subtle.sign('ECDSA') tra ve.
// ---------------------------------------------------------------------------

export async function generateTestEcKeyPair(kid: string): Promise<TestKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as unknown as Record<string, unknown>;
  publicJwk['kid'] = kid;
  publicJwk['alg'] = 'ES256';
  publicJwk['use'] = 'sig';
  return { privateKey: pair.privateKey, publicJwk };
}

export async function signTestJwtEs256(
  privateKey: CryptoKey,
  kid: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT', kid };
  const enc = new TextEncoder();
  const h = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const p = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    enc.encode(`${h}.${p}`),
  );
  return `${h}.${p}.${base64UrlEncode(new Uint8Array(sig))}`;
}

/** Dung token voi alg tuy y (none / HS256 ...) de kiem tra tu choi. */
export function buildRawJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  signatureB64 = '',
): string {
  const enc = new TextEncoder();
  const h = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const p = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  return `${h}.${p}.${signatureB64}`;
}
