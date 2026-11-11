// Test POST /api/v1/ai-mentor/ask (+ sessions/feedback) — Prompt 12.
// Che do tim kiem thong minh (khong key AI): JWT, validation,
// rate-limit 20/gio/user, loc chunk ngoai pham vi, ghi chu chua
// ghi danh, luu lich su, phan hoi huu ich.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { handleRequest } from '../src/index';
import { __resetRateLimits } from '../src/rate-limit';
import { __resetJwksCache } from '../src/jwt';
import {
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
const KID = 'test-kid-ai';
const OWNED_SESSION_ID = '11111111-1111-4111-8111-111111111111';

let state: FakeState;
let env: Env;
let keys: TestKeyPair;

async function ask(
  body: Record<string, unknown>,
  opts: { token?: string | null; userId?: string; ip?: string } = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const token =
    opts.token !== undefined
      ? opts.token
      : await signTestJwt(keys.privateKey, KID, testJwtPayload(opts.userId ?? USER_ENROLLED));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': opts.ip ?? '203.0.113.30',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await handleRequest(
    new Request(`${BASE_URL}/api/v1/ai-mentor/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    env,
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function authed(
  method: string,
  path: string,
  opts: { userId?: string; body?: Record<string, unknown> } = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const token = await signTestJwt(keys.privateKey, KID, testJwtPayload(opts.userId ?? USER_ENROLLED));
  const res = await handleRequest(
    new Request(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }),
    env,
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

beforeEach(async () => {
  state = createFakeState();
  env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  };
  keys = await generateTestKeyPair(KID);
  state.jwksKeys = [
    { ...(keys.publicJwk as Record<string, unknown>), alg: 'RS256', use: 'sig' },
  ];
  vi.stubGlobal('fetch', createMockFetch(state));
  __resetRateLimits();
  __resetJwksCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/v1/ai-mentor/ask — auth + validation', () => {
  it('khong JWT → 401 unauthorized, khong dem rate-limit', async () => {
    const { status, json } = await ask({ question: 'An vui là gì?' }, { token: null });
    expect(status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('JWT sai chu ky → 401', async () => {
    const other = await generateTestKeyPair('other-kid');
    const bad = await signTestJwt(other.privateKey, KID, testJwtPayload(USER_ENROLLED));
    const { status, json } = await ask({ question: 'An vui là gì?' }, { token: bad });
    expect(status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('cau hoi 1 ky tu → 400 invalid_input', async () => {
    const { status, json } = await ask({ question: 'a' });
    expect(status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('cau hoi qua 1000 ky tu → 400', async () => {
    const { status } = await ask({ question: 'x'.repeat(1001) });
    expect(status).toBe(400);
  });

  it('sessionId khong phai UUID → 400', async () => {
    const { status, json } = await ask({ question: 'An vui là gì?', sessionId: 'sess-1' });
    expect(status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: 'invalid_input' });
  });
});

describe('POST /api/v1/ai-mentor/ask — che do tim kiem thong minh', () => {
  it('cau trong Thu vien → 200 mode smart-search, trich dan dung nguon, luu 2 tin nhan', async () => {
    const { status, json } = await ask({ question: 'An vui là gì?' });
    expect(status).toBe(200);
    expect(json['mode']).toBe('smart-search');
    expect(String(json['answer'])).toContain('An Vui');
    expect(String(json['answer'])).toContain('Thư viện Master');
    const sources = json['sources'] as Array<Record<string, unknown>>;
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      sourceType: 'library',
      sourceSlug: 'an-vui',
      url: '/thu-vien-master?bai=an-vui',
    });
    expect(typeof json['sessionId']).toBe('string');
    expect(state.aiSessions).toHaveLength(1);
    expect(state.aiMessages).toHaveLength(2);
    expect(state.aiMessages[0]?.['role']).toBe('user');
    expect(state.aiMessages[1]?.['role']).toBe('assistant');
    const suggestions = json['suggestions'] as string[];
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('cau ngoai pham vi → tra loi "chua tim thay", khong co nguon, khong bia', async () => {
    const { status, json } = await ask({
      question: 'Làm thế nào để đầu tư chứng khoán lãi 100% mỗi tháng?',
    });
    expect(status).toBe(200);
    expect(json['mode']).toBe('smart-search');
    expect(String(json['answer'])).toContain('chưa tìm thấy');
    expect(json['sources']).toEqual([]);
    expect(String(json['answer'])).not.toContain('chứng khoán');
  });

  it('cau ve khoa da ghi danh → enrolled true, khong ghi chu chua ghi danh', async () => {
    const { status, json } = await ask({ question: 'Khóa Thấu Hiểu Tâm Thức học những gì?' });
    expect(status).toBe(200);
    const sources = json['sources'] as Array<Record<string, unknown>>;
    const course = sources.find((s) => s['sourceType'] === 'course');
    expect(course).toMatchObject({ sourceSlug: 'thau-hieu-tam-thuc', enrolled: true });
    expect(String(json['answer'])).not.toContain('chưa ghi danh');
  });

  it('cau ve khoa chua ghi danh → enrolled false + ghi chu chua ghi danh', async () => {
    const { status, json } = await ask(
      { question: 'Khóa Thấu Hiểu Tâm Thức học những gì?' },
      { userId: USER_STRANGER },
    );
    expect(status).toBe(200);
    const sources = json['sources'] as Array<Record<string, unknown>>;
    const course = sources.find((s) => s['sourceType'] === 'course');
    expect(course).toMatchObject({ enrolled: false });
    expect(String(json['answer'])).toContain('chưa ghi danh');
    expect(String(json['answer'])).toContain('mô tả công khai');
  });

  it('dung lai session cua minh → khong tao session moi', async () => {
    state.aiSessions.push({
      id: OWNED_SESSION_ID,
      user_id: USER_ENROLLED,
      title: 'Phiên cũ',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const { status, json } = await ask({ question: 'An vui là gì?', sessionId: OWNED_SESSION_ID });
    expect(status).toBe(200);
    expect(json['sessionId']).toBe(OWNED_SESSION_ID);
    expect(state.aiSessions).toHaveLength(1);
  });

  it('session cua nguoi khac → 404 not_found (khong lo lich su)', async () => {
    state.aiSessions.push({
      id: OWNED_SESSION_ID,
      user_id: USER_STRANGER,
      title: 'Phiên người khác',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const { status, json } = await ask({ question: 'An vui là gì?', sessionId: OWNED_SESSION_ID });
    expect(status).toBe(404);
    expect(json).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('20 cau/gio/user: cau 21 → 429 rate_limited', async () => {
    for (let i = 0; i < 20; i++) {
      const r = await ask({ question: 'An vui là gì?' });
      expect(r.status).toBe(200);
    }
    const { status, json } = await ask({ question: 'An vui là gì?' });
    expect(status).toBe(429);
    expect(json).toMatchObject({ ok: false, error: 'rate_limited' });
  });
});

describe('GET sessions + feedback', () => {
  it('liet ke phien + xem chi tiet + phan hoi huu ich', async () => {
    const asked = await ask({ question: 'An vui là gì?' });
    const sessionId = String(asked.json['sessionId']);
    const listed = await authed('GET', '/api/v1/ai-mentor/sessions');
    expect(listed.status).toBe(200);
    const sessions = listed.json['sessions'] as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.['id']).toBe(sessionId);

    const detail = await authed('GET', `/api/v1/ai-mentor/sessions/${sessionId}`);
    expect(detail.status).toBe(200);
    const messages = detail.json['messages'] as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(2);
    const assistantId = String(messages[1]?.['id']);

    const fb = await authed('PATCH', `/api/v1/ai-mentor/messages/${assistantId}/feedback`, {
      body: { helpful: true },
    });
    expect(fb.status).toBe(200);
    expect(fb.json).toMatchObject({ ok: true, helpful: true });
    expect(state.aiMessages[1]?.['helpful']).toBe(true);

    // Phan hoi tin nhan cua user (khong phai cau tra loi) → 404.
    const userId = String(messages[0]?.['id']);
    const fbUser = await authed('PATCH', `/api/v1/ai-mentor/messages/${userId}/feedback`, {
      body: { helpful: false },
    });
    expect(fbUser.status).toBe(404);
  });

  it('xem phien cua nguoi khac → 404', async () => {
    state.aiSessions.push({
      id: OWNED_SESSION_ID,
      user_id: USER_STRANGER,
      title: 'Phiên người khác',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = await authed('GET', `/api/v1/ai-mentor/sessions/${OWNED_SESSION_ID}`);
    expect(res.status).toBe(404);
  });

  it('khong JWT khi xem sessions → 401', async () => {
    const res = await handleRequest(
      new Request(`${BASE_URL}/api/v1/ai-mentor/sessions`, { method: 'GET' }),
      env,
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/ai-mentor/ask — nhanh LLM (co key)', () => {
  it('co OPENAI_API_KEY + OpenAI tra loi duoc → mode llm, van kem nguon', async () => {
    env = { ...env, OPENAI_API_KEY: 'test-openai-key' };
    const mockFetch = createMockFetch(state);
    vi.stubGlobal(
      'fetch',
      (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (href.includes('api.openai.com')) {
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: 'An vui là trạng thái an lạc nội tâm. (Nguồn: An Vui)' } }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return mockFetch(input, init);
      }) as typeof fetch,
    );
    const { status, json } = await ask({ question: 'An vui là gì?' });
    expect(status).toBe(200);
    expect(json['mode']).toBe('llm');
    expect(String(json['answer'])).toContain('An Vui');
    const sources = json['sources'] as Array<Record<string, unknown>>;
    expect(sources).toHaveLength(1);
  });

  it('OpenAI loi → roi ve smart-search, khong bao gio tra loi gia', async () => {
    env = { ...env, OPENAI_API_KEY: 'test-openai-key' };
    const mockFetch = createMockFetch(state);
    vi.stubGlobal(
      'fetch',
      (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (href.includes('api.openai.com')) {
          return new Response(JSON.stringify({ error: { message: 'overloaded' } }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return mockFetch(input, init);
      }) as typeof fetch,
    );
    const { status, json } = await ask({ question: 'An vui là gì?' });
    expect(status).toBe(200);
    expect(json['mode']).toBe('smart-search');
    expect(String(json['answer'])).toContain('An Vui');
  });
});
