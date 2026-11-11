// AI Mentor — client goi Workers API /api/v1/ai-mentor/* (Prompt 12).
// JWT qua session Supabase. KHONG mock du lieu: API chua deploy /
// migration chua ap thi tra ve trang thai loi de UI hien ro.
// Che do hien tai (11/11/2026): tim kiem thong minh — tra loi dua
// tren Thu vien Master + mo ta khoa hoc + triet ly da phe duyet,
// chua dung AI tao sinh (chua co key AI). Xem workers/api/src/handlers/ai-mentor.ts.
import {
  ApiError,
  getJson,
  isOfflineError,
  patchJson,
  postJson,
  type FetchImpl,
} from './api-client';
import { getAccessToken } from './payments';

export type AiMentorSourceType = 'library' | 'course' | 'philosophy';

export interface AiMentorSource {
  sourceType: AiMentorSourceType;
  sourceSlug: string;
  title: string;
  url: string;
  /** Chi co y nghia voi source course. */
  enrolled?: boolean;
}

export interface AiMentorAskResult {
  mode: 'smart-search' | 'llm';
  sessionId: string;
  answer: string;
  sources: AiMentorSource[];
  suggestions: string[];
  historySaved: boolean;
}

export interface AiMentorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: AiMentorSource[];
  helpful: boolean | null;
  created_at: string;
}

export interface AiMentorSessionItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export type AiMentorAskState =
  | { status: 'success'; data: AiMentorAskResult }
  | { status: 'signed-out' }
  | { status: 'error'; message: string; isOffline: boolean };

export type AiMentorSessionsState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'success'; data: AiMentorSessionItem[] }
  | { status: 'error'; message: string; isOffline: boolean };

export type AiMentorDetailState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'success'; title: string; messages: AiMentorMessage[] }
  | { status: 'error'; message: string; isOffline: boolean };

export const AI_MENTOR_MAX_QUESTION_LEN = 1000;

/** Cau hoi goi y — tat ca deu co cau tra loi trong kho tri thuc
 *  da phe duyet (Thu vien Master / triet ly / mo ta khoa hoc). */
export const AI_MENTOR_SUGGESTED_QUESTIONS = [
  'An vui là gì?',
  'Bao dung là gì?',
  '7 bố thí quan trọng đời người gồm những gì?',
  'Triết lý Giáo dục Tận Gốc là gì?',
  'Lộ trình 6 bước gồm những gì?',
  'Khóa Thấu Hiểu Tâm học những gì?',
] as const;

export function isValidQuestion(question: string): boolean {
  const q = (question ?? '').trim();
  return q.length >= 2 && q.length <= AI_MENTOR_MAX_QUESTION_LEN;
}

export function sourceLabelVi(sourceType: AiMentorSourceType): string {
  switch (sourceType) {
    case 'library':
      return 'Thư viện Master';
    case 'course':
      return 'Khóa học';
    case 'philosophy':
      return 'Triết lý Visfar Academy';
  }
}

function errorState(err: unknown): { status: 'error'; message: string; isOffline: boolean } {
  const isOffline = isOfflineError(err);
  return {
    status: 'error',
    message: isOffline
      ? 'Không kết nối được tới AI Mentor. Kiểm tra mạng, hoặc API chưa được triển khai (Workers chưa deploy).'
      : err instanceof Error
        ? err.message
        : 'Hệ thống đang bận. Vui lòng thử lại sau.',
    isOffline,
  };
}

export async function askAiMentor(
  question: string,
  sessionId?: string | null,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<AiMentorAskState> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    const data = await postJson<AiMentorAskResult>(
      '/ai-mentor/ask',
      { question, sessionId: sessionId ?? undefined },
      { accessToken, fetchImpl: opts.fetchImpl },
    );
    return { status: 'success', data };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') return { status: 'signed-out' };
    return errorState(err);
  }
}

export async function listAiMentorSessions(
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<AiMentorSessionsState> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    const data = await getJson<{ sessions: AiMentorSessionItem[] }>('/ai-mentor/sessions', {
      accessToken,
      fetchImpl: opts.fetchImpl,
    });
    return { status: 'success', data: data.sessions ?? [] };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') return { status: 'signed-out' };
    return errorState(err);
  }
}

export async function getAiMentorSession(
  sessionId: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<AiMentorDetailState> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    const data = await getJson<{ session: { id: string; title: string }; messages: AiMentorMessage[] }>(
      `/ai-mentor/sessions/${encodeURIComponent(sessionId)}`,
      { accessToken, fetchImpl: opts.fetchImpl },
    );
    return { status: 'success', title: data.session.title, messages: data.messages ?? [] };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') return { status: 'signed-out' };
    return errorState(err);
  }
}

export async function sendAiMentorFeedback(
  messageId: string,
  helpful: boolean,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<{ status: 'success' } | { status: 'signed-out' } | { status: 'error'; message: string; isOffline: boolean }> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    await patchJson<{ messageId: string; helpful: boolean }>(
      `/ai-mentor/messages/${encodeURIComponent(messageId)}/feedback`,
      { helpful },
      { accessToken, fetchImpl: opts.fetchImpl },
    );
    return { status: 'success' };
  } catch (err) {
    if (err instanceof ApiError && err.code === 'unauthorized') return { status: 'signed-out' };
    return errorState(err);
  }
}
