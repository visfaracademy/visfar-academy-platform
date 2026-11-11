// AI Mentor & AI Learning Assistant (Prompt 12, GĐ2) —
// POST /api/v1/ai-mentor/ask (+ lich su hoi thoai).
//
// CHE DO HOAT DONG (11/11/2026): TIM KIEM THONG MINH, KHONG LLM.
// Worker `api` KHONG co key AI nao (OPENAI_API_KEY / GEMINI_API_KEY
// deu chua set — da kiem tra `wrangler secret list`, chi co 5 secret
// cu). Route ask CHI goi ham SQL search_ai_knowledge (migration 0029)
// tren kho tri thuc da phe duyet (119 muc Thu vien Master + mo ta
// 10 khoa hoc + 9 muc triet ly trang chu) va tra ve doan tri thuc
// + trich dan nguon noi bo + cau hoi goi y. KHONG goi LLM, KHONG bia
// cau tra loi, KHONG khang dinh dieu chua chac chan.
//
// Neu sau nay user cap OPENAI_API_KEY (Workers Secrets): handler goi
// OpenAI Chat Completions voi system prompt "chi tra loi dua tren
// doan tri thuc duoc cung cap, khong bia, trich dan nguon, phan biet
// khoa hoc / triet hoc / tin nguong / gia thuyet". LLM loi -> tu
// dong roi ve che do tim kiem thong minh (khong bao gio tra loi gia).
// GEMINI_API_KEY mot minh (khong co OPENAI_API_KEY) thi van chay
// che do tim kiem thong minh — adapter Gemini chua co (viec mo).
//
// Quyen truy cap: CHI dung tri thuc cong khai + mo ta khoa hoc.
// Noi dung bai hoc tra phi (bang lessons) KHONG co trong kho tri
// thuc; cau hoi ve khoa chua ghi danh chi duoc tra loi bang mo ta
// cong khai kem ghi chu "chua ghi danh" (kiem tra enrollment truoc
// khi ghi chu). Lich su hoi thoai luu DB, RLS chi chu so huu doc;
// Worker ghi qua service-role sau khi xac minh JWT + quyen so huu.
//
// Rate-limit: 20 cau hoi / gio / user (theo DECISIONS Task 02 QĐ 10
// — ap theo user). Khong co JWT -> 401 (khong dem rate-limit).
import type { Env } from '../env';
import { isSupabaseConfigured, safeLog } from '../env';
import { ApiError, jsonOk, serverError } from '../errors';
import { extractBearerToken, verifySupabaseJwt } from '../jwt';
import { checkRateLimit, getClientIp } from '../rate-limit';
import {
  getCourseBySlug,
  getEnrollment,
  notConfiguredError,
  requireSbOk,
  sbFetch,
  type SbResult,
} from '../supabase';

const AI_MENTOR_RATE_LIMIT = 20;
const AI_MENTOR_RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_QUESTION_LEN = 1000;
const TOP_K = 5;
/** Nguong giu chunk sau khi tim: rank >= 25 VA (khop tieu de day du,
// hoac co cap tu ke nhau khop, hoac khop >= 4 tu noi dung). Xem
// migration 0029 (da hieu chuan tren staging — cau ngoai pham vi
// "dau tu chung khoan lai 100%" bi loai het). */
const MIN_KEEP_RANK = 25;
const MIN_KEEP_MATCHED = 4;
const MAX_EXCERPT_LEN = 600;

export interface KnowledgeChunk {
  chunk_id: string;
  source_type: 'library' | 'course' | 'philosophy';
  source_slug: string;
  title: string;
  content: string;
  keywords: string;
  rank: number;
  matched_words: number;
  title_match: boolean;
  pair_bonus: number;
}

export interface AiMentorSource {
  sourceType: KnowledgeChunk['source_type'];
  sourceSlug: string;
  title: string;
  url: string;
  /** Chi co y nghia voi source course: user da ghi danh khoa nay. */
  enrolled?: boolean;
}

function sourceLabelVi(sourceType: KnowledgeChunk['source_type']): string {
  switch (sourceType) {
    case 'library':
      return 'Thư viện Master';
    case 'course':
      return 'Khóa học';
    case 'philosophy':
      return 'Triết lý Visfar Academy';
  }
}

export function sourceUrlFor(sourceType: KnowledgeChunk['source_type'], slug: string): string {
  switch (sourceType) {
    case 'library':
      return `/thu-vien-master?bai=${encodeURIComponent(slug)}`;
    case 'course':
      return `/chuong-trinh/${encodeURIComponent(slug)}`;
    case 'philosophy':
      return '/#triet-ly';
  }
}

/** Cat trich dan o ranh gioi tu (khong cat giua chu). */
export function excerptOf(content: string, maxLen: number = MAX_EXCERPT_LEN): string {
  const text = (content ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLen / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function requireAuth(req: Request, env: Env): Promise<string> {
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'unauthorized', 'Vui lòng đăng nhập để hỏi AI Mentor.');
  }
  try {
    const verified = await verifySupabaseJwt(token, env.SUPABASE_URL);
    return verified.userId;
  } catch {
    throw new ApiError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  }
}

async function searchKnowledge(env: Env, question: string): Promise<KnowledgeChunk[]> {
  const result = await sbFetch<KnowledgeChunk[]>(env, '/rpc/search_ai_knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_query: question, p_limit: TOP_K }),
  });
  const rows = requireSbOk(result, 'search_ai_knowledge');
  return Array.isArray(rows) ? rows : [];
}

/** Loc chunk giu lai de tra loi (chong cau ngoai pham vi tra ve doan
    khong lien quan). */
export function keepRelevantChunks(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
  return chunks.filter(
    (c) =>
      c.rank >= MIN_KEEP_RANK &&
      (c.title_match || c.pair_bonus > 0 || c.matched_words >= MIN_KEEP_MATCHED),
  );
}

const OUT_OF_SCOPE_ANSWER =
  'Tôi chưa tìm thấy nội dung phù hợp trong Thư viện Master, mô tả khóa học và triết lý của Visfar Academy cho câu hỏi này. Tôi chỉ trả lời dựa trên tri thức đã được phê duyệt của Visfar Academy nên không tự suy đoán thêm. Bạn có thể thử hỏi về một khái niệm trong Thư viện Master (ví dụ: An vui, Bao dung, 7 bố thí), về triết lý Giáo dục Tận Gốc, hoặc về một khóa học của Visfar Academy.';

const OUT_OF_SCOPE_SUGGESTIONS = [
  'An vui là gì?',
  'Bao dung là gì?',
  '7 bố thí quan trọng đời người gồm những gì?',
];

function composeSmartAnswer(
  chunks: KnowledgeChunk[],
  notEnrolledTitles: string[],
): { answer: string; suggestions: string[] } {
  if (chunks.length === 0) {
    return { answer: OUT_OF_SCOPE_ANSWER, suggestions: [...OUT_OF_SCOPE_SUGGESTIONS] };
  }
  const lines: string[] = [
    'Dựa trên tri thức đã được phê duyệt của Visfar Academy, tôi tìm thấy những nội dung sau:',
  ];
  for (const c of chunks) {
    lines.push('', `${c.title}`, excerptOf(c.content), `(Nguồn: ${sourceLabelVi(c.source_type)})`);
  }
  if (notEnrolledTitles.length > 0) {
    lines.push(
      '',
      `Lưu ý: bạn chưa ghi danh ${notEnrolledTitles.map((t) => `khóa “${t}”`).join(', ')} — nội dung bài học đầy đủ chỉ mở sau khi ghi danh. Phần trên chỉ là mô tả công khai của khóa học.`,
    );
  }
  const suggestions = chunks
    .slice(0, 3)
    .map((c) => `Tìm hiểu thêm về “${c.title}”`);
  return { answer: lines.join('\n'), suggestions };
}

// ---------------------------------------------------------------------------
// LLM (chi khi co OPENAI_API_KEY). Loi -> null de roi ve tim kiem
// thong minh; khong bao gio tra loi gia vi LLM loi.
// ---------------------------------------------------------------------------
const LLM_SYSTEM_PROMPT =
  'Bạn là AI Mentor của Visfar Academy. Chỉ trả lời dựa trên các đoạn tri thức được cung cấp dưới đây. Không bịa thêm kiến thức, không khẳng định điều chưa chắc chắn. Nếu các đoạn tri thức không đủ để trả lời, hãy nói rõ là chưa tìm thấy nội dung phù hợp và gợi ý hỏi về một khái niệm trong Thư viện Master. Trích dẫn nguồn (tên mục) sau mỗi ý chính. Phân biệt rõ đâu là khoa học, đâu là triết học, đâu là tín ngưỡng, đâu là giả thuyết — chỉ dùng đúng nhãn mà đoạn tri thức đã ghi. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.';

async function tryLlmAnswer(
  env: Env,
  question: string,
  chunks: KnowledgeChunk[],
): Promise<string | null> {
  const key = (env.OPENAI_API_KEY ?? '').trim();
  if (!key) return null;
  const knowledge = chunks
    .map((c) => `### ${c.title} (Nguồn: ${sourceLabelVi(c.source_type)})\n${excerptOf(c.content)}`)
    .join('\n\n');
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: 'system', content: LLM_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Câu hỏi: ${question}\n\nCác đoạn tri thức:\n${knowledge}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      safeLog('ai-mentor llm failed', { status: String(res.status) });
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) return null;
    return text.slice(0, 4000);
  } catch {
    safeLog('ai-mentor llm failed', { status: 'fetch-error' });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lich su hoi thoai (ghi qua service-role; loi ghi KHONG lam mat cau
// tra loi — tra ve historySaved:false de UI bao ro, giong mau leads
// khi Sheet loi van giu 201).
// ---------------------------------------------------------------------------
interface ChatSessionRow {
  id: string;
  user_id: string;
  title: string;
}

async function getSessionOwned(
  env: Env,
  userId: string,
  sessionId: string,
): Promise<ChatSessionRow | null> {
  const result = await sbFetch<ChatSessionRow[]>(
    env,
    `/ai_chat_sessions?select=id,user_id,title&id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getSessionOwned');
  return rows && rows.length > 0 ? (rows[0] as ChatSessionRow) : null;
}

async function createSession(env: Env, userId: string, title: string): Promise<ChatSessionRow> {
  const result = await sbFetch<ChatSessionRow[]>(env, '/ai_chat_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, title }),
  });
  const rows = requireSbOk(result, 'createSession');
  if (!rows || rows.length === 0 || !rows[0]?.id) throw serverError('createSession returned no row');
  return rows[0] as ChatSessionRow;
}

async function insertMessage(
  env: Env,
  input: {
    session_id: string;
    user_id: string;
    role: 'user' | 'assistant';
    content: string;
    sources: AiMentorSource[];
  },
): Promise<boolean> {
  const result: SbResult<Array<{ id: string }>> = await sbFetch(env, '/ai_chat_messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(input),
  });
  if (result.error) {
    safeLog('ai-mentor message insert failed', {
      reason: `${result.error.code ?? ''} ${result.error.message}`.slice(0, 200),
    });
    return false;
  }
  return (result.data ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// POST /api/v1/ai-mentor/ask
// ---------------------------------------------------------------------------
export async function handleAskAiMentor(req: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(req, env);

  // Rate-limit dem ca request loi validation (tru 401 — da qua auth).
  const ip = getClientIp(req);
  const rl = await checkRateLimit(env, `ai-mentor:${userId}:${ip}`, AI_MENTOR_RATE_LIMIT, AI_MENTOR_RATE_WINDOW_MS);
  if (!rl.allowed) {
    throw new ApiError(429, 'rate_limited', 'Bạn đã hỏi quá 20 câu trong 1 giờ. Vui lòng thử lại sau.', {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch {
    throw new ApiError(400, 'invalid_input', 'Dữ liệu gửi lên không đúng định dạng.');
  }
  const question = typeof body['question'] === 'string' ? body['question'].trim() : '';
  if (question.length < 2 || question.length > MAX_QUESTION_LEN) {
    throw new ApiError(
      400,
      'invalid_input',
      `Câu hỏi phải từ 2 đến ${MAX_QUESTION_LEN} ký tự.`,
    );
  }
  const rawSessionId = typeof body['sessionId'] === 'string' ? body['sessionId'].trim() : '';
  if (rawSessionId && !isUuid(rawSessionId)) {
    throw new ApiError(400, 'invalid_input', 'Phiên hội thoại không đúng định dạng.');
  }

  // Session: dung lai neu thuoc ve user, khong thi 404 (khong lo
  // session cua nguoi khac); chua co thi tao moi.
  let session: ChatSessionRow;
  if (rawSessionId) {
    const owned = await getSessionOwned(env, userId, rawSessionId);
    if (!owned) throw new ApiError(404, 'not_found', 'Không tìm thấy phiên hội thoại này.');
    session = owned;
  } else {
    session = await createSession(env, userId, question.slice(0, 60));
  }

  const found = await searchKnowledge(env, question);
  const chunks = keepRelevantChunks(found);

  // Kiem tra ghi danh cho chunk loai course (noi dung bai tra phi
  // khong co trong kho — chi can biet user da ghi danh de ghi chu).
  const sources: AiMentorSource[] = [];
  const notEnrolledTitles: string[] = [];
  for (const c of chunks) {
    const src: AiMentorSource = {
      sourceType: c.source_type,
      sourceSlug: c.source_slug,
      title: c.title,
      url: sourceUrlFor(c.source_type, c.source_slug),
    };
    if (c.source_type === 'course') {
      const course = await getCourseBySlug(env, c.source_slug);
      if (course) {
        const enrollment = await getEnrollment(env, userId, course.id);
        const enrolled = !!enrollment && (enrollment.status === 'active' || enrollment.status === 'completed');
        src.enrolled = enrolled;
        if (!enrolled) notEnrolledTitles.push(c.title);
      } else {
        src.enrolled = false;
      }
    }
    sources.push(src);
  }

  // Tra loi: LLM neu co key (va goi duoc), khong thi tim kiem thong minh.
  let mode: 'smart-search' | 'llm' = 'smart-search';
  let answer: string;
  let suggestions: string[];
  const llmText = await tryLlmAnswer(env, question, chunks);
  if (llmText !== null) {
    mode = 'llm';
    answer = llmText;
    suggestions = chunks.slice(0, 3).map((c) => `Tìm hiểu thêm về “${c.title}”`);
    if (chunks.length === 0) suggestions = [...OUT_OF_SCOPE_SUGGESTIONS];
  } else {
    const composed = composeSmartAnswer(chunks, notEnrolledTitles);
    answer = composed.answer;
    suggestions = composed.suggestions;
  }
  if (notEnrolledTitles.length > 0 && mode === 'llm') {
    answer += `\n\nLưu ý: bạn chưa ghi danh ${notEnrolledTitles.map((t) => `khóa “${t}”`).join(', ')} — nội dung bài học đầy đủ chỉ mở sau khi ghi danh. Phần trên chỉ là mô tả công khai của khóa học.`;
  }

  const userSaved = await insertMessage(env, {
    session_id: session.id,
    user_id: userId,
    role: 'user',
    content: question,
    sources: [],
  });
  const assistantSaved = await insertMessage(env, {
    session_id: session.id,
    user_id: userId,
    role: 'assistant',
    content: answer,
    sources,
  });

  return jsonOk({
    mode,
    sessionId: session.id,
    answer,
    sources,
    suggestions,
    historySaved: userSaved && assistantSaved,
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/ai-mentor/sessions — lich su phien cua user.
// ---------------------------------------------------------------------------
export interface AiMentorSessionItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function handleListAiMentorSessions(req: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(req, env);
  const result = await sbFetch<AiMentorSessionItem[]>(
    env,
    `/ai_chat_sessions?select=id,title,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=20`,
  );
  const rows = requireSbOk(result, 'listAiMentorSessions');
  return jsonOk({ sessions: rows ?? [] });
}

// ---------------------------------------------------------------------------
// GET /api/v1/ai-mentor/sessions/:id — chi tiet phien + tin nhan.
// ---------------------------------------------------------------------------
export interface AiMentorMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: AiMentorSource[];
  helpful: boolean | null;
  created_at: string;
}

export async function handleGetAiMentorSession(
  req: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  const userId = await requireAuth(req, env);
  const session = await getSessionOwned(env, userId, sessionId);
  if (!session) throw new ApiError(404, 'not_found', 'Không tìm thấy phiên hội thoại này.');
  const result = await sbFetch<AiMentorMessageItem[]>(
    env,
    `/ai_chat_messages?select=id,role,content,sources,helpful,created_at&session_id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=100`,
  );
  const rows = requireSbOk(result, 'getAiMentorSessionMessages');
  return jsonOk({ session: { id: session.id, title: session.title }, messages: rows ?? [] });
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/ai-mentor/messages/:id/feedback { helpful: boolean }
// ---------------------------------------------------------------------------
export async function handleAiMentorFeedback(
  req: Request,
  env: Env,
  messageId: string,
): Promise<Response> {
  const userId = await requireAuth(req, env);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch {
    throw new ApiError(400, 'invalid_input', 'Dữ liệu gửi lên không đúng định dạng.');
  }
  if (typeof body['helpful'] !== 'boolean') {
    throw new ApiError(400, 'invalid_input', 'Phản hồi phải là hữu ích hoặc không hữu ích.');
  }
  const existing = await sbFetch<Array<{ id: string }>>(
    env,
    `/ai_chat_messages?select=id&id=eq.${encodeURIComponent(messageId)}&user_id=eq.${encodeURIComponent(userId)}&role=eq.assistant&limit=1`,
  );
  const rows = requireSbOk(existing, 'getAiMentorMessageOwned');
  if (!rows || rows.length === 0) {
    throw new ApiError(404, 'not_found', 'Không tìm thấy câu trả lời này.');
  }
  const updated = await sbFetch<Array<{ id: string }>>(
    env,
    `/ai_chat_messages?id=eq.${encodeURIComponent(messageId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ helpful: body['helpful'] }),
    },
  );
  const updatedRows = requireSbOk(updated, 'patchAiMentorFeedback');
  if (!updatedRows || updatedRows.length === 0) {
    throw serverError('patchAiMentorFeedback returned no row');
  }
  return jsonOk({ messageId, helpful: body['helpful'] });
}
