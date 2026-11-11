// Test lib AI Mentor (Prompt 12): cau hoi goi y, validation,
// nhan nguon, goi API (mock fetch + mock session).
import { describe, expect, it, vi } from 'vitest';
import {
  AI_MENTOR_MAX_QUESTION_LEN,
  AI_MENTOR_SUGGESTED_QUESTIONS,
  askAiMentor,
  getAiMentorSession,
  isValidQuestion,
  listAiMentorSessions,
  sendAiMentorFeedback,
  sourceLabelVi,
} from './ai-mentor';

vi.mock('./payments', () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from './payments';

const mockedGetAccessToken = vi.mocked(getAccessToken);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('isValidQuestion', () => {
  it('cau hoi 1 ky tu khong hop le; 2–1000 hop le', () => {
    expect(isValidQuestion('')).toBe(false);
    expect(isValidQuestion('a')).toBe(false);
    expect(isValidQuestion('An vui là gì?')).toBe(true);
    expect(isValidQuestion('x'.repeat(AI_MENTOR_MAX_QUESTION_LEN))).toBe(true);
    expect(isValidQuestion('x'.repeat(AI_MENTOR_MAX_QUESTION_LEN + 1))).toBe(false);
    expect(isValidQuestion('   ')).toBe(false);
  });
});

describe('sourceLabelVi', () => {
  it('nhan dung 3 loai nguon', () => {
    expect(sourceLabelVi('library')).toBe('Thư viện Master');
    expect(sourceLabelVi('course')).toBe('Khóa học');
    expect(sourceLabelVi('philosophy')).toBe('Triết lý Visfar Academy');
  });
});

describe('AI_MENTOR_SUGGESTED_QUESTIONS', () => {
  it('6 cau goi y, deu hop le va khong trung', () => {
    expect(AI_MENTOR_SUGGESTED_QUESTIONS).toHaveLength(6);
    for (const q of AI_MENTOR_SUGGESTED_QUESTIONS) {
      expect(isValidQuestion(q)).toBe(true);
    }
    expect(new Set(AI_MENTOR_SUGGESTED_QUESTIONS).size).toBe(6);
  });
});

describe('askAiMentor', () => {
  it('chua dang nhap → signed-out, khong goi API', async () => {
    mockedGetAccessToken.mockResolvedValue(null);
    const fetchImpl = vi.fn();
    expect(await askAiMentor('An vui là gì?', null, { fetchImpl })).toEqual({
      status: 'signed-out',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('thanh cong → tra mode smart-search + nguon + goi y', async () => {
    mockedGetAccessToken.mockResolvedValue('token-123');
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        mode: 'smart-search',
        sessionId: 'sess-1',
        answer: 'An Vui là trạng thái…',
        sources: [
          {
            sourceType: 'library',
            sourceSlug: 'an-vui',
            title: 'An Vui',
            url: '/thu-vien-master?bai=an-vui',
          },
        ],
        suggestions: ['Tìm hiểu thêm về “An Vui”'],
        historySaved: true,
      }),
    );
    const res = await askAiMentor('An vui là gì?', null, { fetchImpl });
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect(res.data.mode).toBe('smart-search');
      expect(res.data.sources[0]?.url).toBe('/thu-vien-master?bai=an-vui');
      expect(res.data.historySaved).toBe(true);
    }
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token-123');
  });

  it('API tra 429 → error rate_limited', async () => {
    mockedGetAccessToken.mockResolvedValue('token-123');
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        { ok: false, error: 'rate_limited', message: 'Bạn đã hỏi quá 20 câu trong 1 giờ.' },
        429,
      ),
    );
    const res = await askAiMentor('An vui là gì?', null, { fetchImpl });
    expect(res.status).toBe('error');
    if (res.status === 'error') {
      expect(res.message).toContain('20 câu');
      expect(res.isOffline).toBe(false);
    }
  });

  it('mat mang → error offline', async () => {
    mockedGetAccessToken.mockResolvedValue('token-123');
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const res = await askAiMentor('An vui là gì?', null, { fetchImpl });
    expect(res).toMatchObject({ status: 'error', isOffline: true });
  });
});

describe('listAiMentorSessions / getAiMentorSession / sendAiMentorFeedback', () => {
  it('liet ke phien thanh cong', async () => {
    mockedGetAccessToken.mockResolvedValue('token-123');
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        sessions: [{ id: 'sess-1', title: 'An vui là gì?', created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z' }],
      }),
    );
    const res = await listAiMentorSessions({ fetchImpl });
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.title).toBe('An vui là gì?');
    }
  });

  it('xem chi tiet phien thanh cong', async () => {
    mockedGetAccessToken.mockResolvedValue('token-123');
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        session: { id: 'sess-1', title: 'An vui là gì?' },
        messages: [
          { id: 'm1', role: 'user', content: 'An vui là gì?', sources: [], helpful: null, created_at: '2026-11-11T00:00:00Z' },
          { id: 'm2', role: 'assistant', content: 'An Vui là…', sources: [], helpful: null, created_at: '2026-11-11T00:00:01Z' },
        ],
      }),
    );
    const res = await getAiMentorSession('sess-1', { fetchImpl });
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect(res.messages).toHaveLength(2);
      expect(res.messages[1]?.role).toBe('assistant');
    }
  });

  it('phan hoi huu ich goi PATCH dung duong dan', async () => {
    mockedGetAccessToken.mockResolvedValue('token-123');
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, messageId: 'm2', helpful: true }),
    );
    const res = await sendAiMentorFeedback('m2', true, { fetchImpl });
    expect(res).toEqual({ status: 'success' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/ai-mentor/messages/m2/feedback');
    expect(init.method).toBe('PATCH');
    expect(String(init.body)).toContain('"helpful":true');
  });
});
