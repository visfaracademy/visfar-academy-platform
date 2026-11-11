// Quiz — Task 08.
//
// LUONG DU LIEU (bao mat la tren het):
// - De thi (GET /api/v1/quizzes/[quizId]) chi tra cau hoi + lua chon
//   QUA VIEW question_options_public — KHONG CO cot is_correct.
//   Ham toPublicPaper() o day la lop loc cuoi o server: bat ky dong
//   nao con is_correct deu bi cat truoc khi tra ve client.
// - Nop bai (POST /api/v1/quizzes/[quizId]/submit) goi ham SQL
//   SECURITY DEFINER submit_quiz_attempt (migration 0014) qua RPC —
//   cham o server, ghi quiz_attempts + quiz_answers. Apps/web KHONG
//   dung service-role key (bi cam boi security.test.ts), nen khong
//   the doc is_correct bang JWT cua hoc vien.
// - Ham gradeQuizAttempt() la BAN DAC TA TS cua cung quy tac cham
//   trong ham SQL — dung de unit test + Workers tuong lai. Route
//   /submit KHONG dung ham nay de cham (route dung ham SQL); sau khi
//   ap 0014 len staging phai chay kiem tra parity muc (G) — KIEM
//   CHUNG so 7 trong file migration.
//
// QUY TAC CHAM (giong het ham SQL):
// - single_choice / true_false: dung khi option duoc chon duy nhat
//   co is_correct = true.
// - multiple_choice: dung khi tap option duoc chon == tap option
//   dung (khop chinh xac, khong diem thanh phan).
// - fill_blank / short_answer: dung khi answer_text chuan hoa
//   (trim, gom khoang trang, khong phan biet hoa/thuong) trung 1
//   option_text co is_correct = true. Cau khong dinh nghia dap an
//   dung nao -> chua cham duoc (is_correct null, needsReview).
// - essay: khong cham tu dong (is_correct null, needsReview).
// - passing_score mac dinh 70 (DEFAULT_PASSING_SCORE) khi quiz de
//   pass_score_percent NULL; diem dat tinh theo tong `points`.

export const DEFAULT_PASSING_SCORE = 70;
/** Grace them khi nop tre so voi time_limit_sec (giong ham SQL). */
export const QUIZ_SUBMIT_GRACE_SEC = 60;
/** Gioi han do dai cau tra loi dang text (fill_blank/essay). */
export const MAX_ANSWER_TEXT_LENGTH = 5000;

export type QuizQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'essay'
  | 'short_answer';

export interface QuizOptionPublic {
  id: string;
  optionText: string;
  displayOrder: number;
}

export interface QuizQuestionPublic {
  id: string;
  question: string;
  questionType: QuizQuestionType;
  points: number;
  options: QuizOptionPublic[];
}

export interface QuizPaper {
  quizId: string;
  courseSlug: string;
  /** Bai hoc chua quiz (null = quiz chua gan bai hoc) — de client biet
   *  bai nao can danh dau hoan thanh sau khi nop DAT (B-T08-5). */
  lessonId: string | null;
  /** Khoa chua quiz — gui kem khi ghi tien do qua Workers /progress. */
  courseId: string;
  title: string;
  description: string | null;
  /** Diem dat (%); NULL o DB duoc hieu la DEFAULT_PASSING_SCORE. */
  passingScore: number;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  questions: QuizQuestionPublic[];
}

export interface QuizAnswerInput {
  questionId: string;
  optionIds?: string[];
  answerText?: string;
}

export interface QuizQuestionResult {
  questionId: string;
  questionType: QuizQuestionType;
  isCorrect: boolean | null;
  pointsAwarded: number;
  points: number;
  /** Chi co SAU KHI nop (ham SQL tra ve) — khong co trong de thi. */
  explanation: string | null;
  correctOptionIds: string[];
  selectedOptionIds: string[];
  answerText: string | null;
}

export interface QuizSubmitResult {
  attemptId: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  needsReview: boolean;
  status: 'submitted' | 'expired';
  results: QuizQuestionResult[];
}

export interface QuizAttemptSummary {
  id: string;
  quizId: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean | null;
  needsReview: boolean;
  status: string;
  startedAt: string | null;
  submittedAt: string;
}

export class QuizApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'QuizApiError';
    this.status = status;
    this.code = code;
  }
}

export function quizApiPath(quizId: string): string {
  return `/api/v1/quizzes/${encodeURIComponent(quizId)}`;
}

// ---------------------------------------------------------------------------
// Tron co seed (deterministic): cung seed -> cung thu tu. Seed theo
// attempt: client tao seed luc mo de thi (crypto.randomUUID) va giu
// trong state; dap an luu theo question_id nen thu tu khong anh
// huong cham diem.
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit — bien chuoi seed thanh so nguyen on dinh. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32 — deterministic theo seed so. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates voi PRNG co seed — khong doi mang goc. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = mulberry32(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Tron de thi: tron cau hoi (neu quiz bat shuffle_questions) va luon
 * tron dap an trong moi cau (de tranh doan theo vi tri). Tra ban moi,
 * khong doi paper goc.
 */
export function shufflePaper(paper: QuizPaper, seed: string): QuizPaper {
  const questions = paper.shuffleQuestions
    ? seededShuffle(paper.questions, `${seed}:q`)
    : [...paper.questions];
  return {
    ...paper,
    questions: questions.map((q) => ({
      ...q,
      options: seededShuffle(q.options, `${seed}:${q.id}`),
    })),
  };
}

// ---------------------------------------------------------------------------
// Dem nguoc + gioi han lan lam
// ---------------------------------------------------------------------------

/** So giay con lai (<= 0 = het gio). Dung Date.now() o client. */
export function remainingSeconds(
  timeLimitSec: number | null,
  startedAtMs: number,
  nowMs: number,
): number | null {
  if (timeLimitSec === null) return null;
  return timeLimitSec - Math.floor((nowMs - startedAtMs) / 1000);
}

/** "MM:SS" (duoi 1 gio) hoac "HH:MM:SS". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** So lan con lai (null = khong gioi han). */
export function attemptsRemaining(
  maxAttempts: number | null,
  attemptsUsed: number,
): number | null {
  if (maxAttempts === null) return null;
  return Math.max(0, maxAttempts - attemptsUsed);
}

export function canAttempt(maxAttempts: number | null, attemptsUsed: number): boolean {
  return attemptsRemaining(maxAttempts, attemptsUsed) !== 0;
}

// ---------------------------------------------------------------------------
// Chuan hoa + cham diem (dac ta TS cua ham SQL 0014)
// ---------------------------------------------------------------------------

/** Trim, gom khoang trang lien tiep, khong phan biet hoa/thuong. */
export function normalizeFillBlankAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface GradedOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
}

export interface GradedQuestion {
  id: string;
  questionType: QuizQuestionType;
  points: number;
  options: GradedOption[];
}

export interface GradeResult {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  needsReview: boolean;
  perQuestion: Array<{
    questionId: string;
    questionType: QuizQuestionType;
    isCorrect: boolean | null;
    pointsAwarded: number;
    points: number;
    correctOptionIds: string[];
    selectedOptionIds: string[];
    answerText: string | null;
  }>;
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

/**
 * Cham 1 bai lam theo dung quy tac ham SQL submit_quiz_attempt.
 * CHI DUNG O SERVER / TEST — khong bao gio goi o client truoc khi
 * nop (can isCorrect). Route /submit dung ham SQL, khong dung ham nay.
 */
export function gradeQuizAttempt(
  questions: readonly GradedQuestion[],
  answers: readonly QuizAnswerInput[],
  passingScore: number = DEFAULT_PASSING_SCORE,
): GradeResult {
  let score = 0;
  let total = 0;
  let needsReview = false;
  const perQuestion: GradeResult['perQuestion'] = [];

  for (const q of questions) {
    total += q.points;
    const answer = answers.find((x) => x.questionId === q.id);
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const selectedIds = answer?.optionIds ?? [];
    const answerText =
      answer?.answerText !== undefined && answer.answerText !== ''
        ? answer.answerText
        : null;
    let isCorrect: boolean | null = false;
    let pointsAwarded = 0;

    if (q.questionType === 'single_choice' || q.questionType === 'true_false') {
      if (answer && selectedIds.length === 1) {
        isCorrect = correctIds.includes(selectedIds[0]);
        pointsAwarded = isCorrect ? q.points : 0;
      } else {
        isCorrect = false;
      }
    } else if (q.questionType === 'multiple_choice') {
      if (answer && selectedIds.length > 0) {
        isCorrect = correctIds.length > 0 && sameIdSet(selectedIds, correctIds);
        pointsAwarded = isCorrect ? q.points : 0;
      } else {
        isCorrect = false;
      }
    } else if (q.questionType === 'fill_blank' || q.questionType === 'short_answer') {
      if (answer && answerText !== null) {
        if (correctIds.length === 0) {
          isCorrect = null;
          needsReview = true;
        } else {
          const expected = q.options
            .filter((o) => o.isCorrect)
            .map((o) => normalizeFillBlankAnswer(o.optionText));
          isCorrect = expected.includes(normalizeFillBlankAnswer(answerText));
          pointsAwarded = isCorrect ? q.points : 0;
        }
      } else {
        isCorrect = false;
      }
    } else if (q.questionType === 'essay') {
      isCorrect = null;
      if (answer && answerText !== null) needsReview = true;
    }

    score += pointsAwarded;
    perQuestion.push({
      questionId: q.id,
      questionType: q.questionType,
      isCorrect,
      pointsAwarded,
      points: q.points,
      correctOptionIds: correctIds,
      selectedOptionIds: selectedIds,
      answerText,
    });
  }

  const percent = total === 0 ? 0 : Math.round((score * 100) / total);
  return {
    score,
    total,
    percent,
    passed: total === 0 || percent >= passingScore,
    needsReview,
    perQuestion,
  };
}

// ---------------------------------------------------------------------------
// Validate + dong goi cau tra loi truoc khi nop
// ---------------------------------------------------------------------------

/**
 * Cac cau bat buoc tra loi con thieu. Essay la tu chon (duoc nop
 * trang — se cho cham tay sau); cac loai khac phai tra loi moi nop.
 */
export function findUnansweredRequired(
  paper: QuizPaper,
  answers: Map<string, QuizAnswerInput> | Record<string, QuizAnswerInput>,
): string[] {
  const get = (id: string): QuizAnswerInput | undefined =>
    answers instanceof Map ? answers.get(id) : answers[id];
  const missing: string[] = [];
  for (const q of paper.questions) {
    if (q.questionType === 'essay') continue;
    const a = get(q.id);
    const hasOption = (a?.optionIds?.length ?? 0) > 0;
    const hasText = (a?.answerText?.trim().length ?? 0) > 0;
    if (!hasOption && !hasText) missing.push(q.id);
  }
  return missing;
}

/** Chuyen Map cau tra loi thanh mang gui len server (bo cau trang). */
export function buildSubmitPayload(
  answers: Map<string, QuizAnswerInput> | Record<string, QuizAnswerInput>,
): QuizAnswerInput[] {
  const list = answers instanceof Map ? [...answers.values()] : Object.values(answers);
  return list
    .map((a) => ({
      questionId: a.questionId,
      optionIds: (a.optionIds ?? []).filter(Boolean),
      answerText: (a.answerText ?? '').slice(0, MAX_ANSWER_TEXT_LENGTH),
    }))
    .filter((a) => a.optionIds.length > 0 || a.answerText.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Loc de thi cong khai: cat is_correct khoi dong server (lop phong thu
// cuoi truoc khi tra ve client). Neu kieu dau vao doi, ham nay van
// khong bao gio de lot truong do ra ngoai.
// ---------------------------------------------------------------------------

export interface QuizPaperServerRow {
  quizId: string;
  courseSlug: string;
  lessonId: string | null;
  courseId: string;
  title: string;
  description: string | null;
  passingScore: number | null;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  attemptsUsed: number;
  questions: Array<{
    id: string;
    question: string;
    questionType: QuizQuestionType;
    points: number;
    options: Array<{
      id: string;
      optionText: string;
      displayOrder: number;
      /** Dap an dung — CHI o server, phai bi cat o day. */
      isCorrect?: boolean;
    }>;
  }>;
}

export function toPublicPaper(row: QuizPaperServerRow): QuizPaper {
  return {
    quizId: row.quizId,
    courseSlug: row.courseSlug,
    lessonId: row.lessonId ?? null,
    courseId: row.courseId ?? '',
    title: row.title,
    description: row.description,
    passingScore: row.passingScore ?? DEFAULT_PASSING_SCORE,
    timeLimitSec: row.timeLimitSec,
    maxAttempts: row.maxAttempts,
    shuffleQuestions: row.shuffleQuestions,
    attemptsUsed: row.attemptsUsed,
    attemptsRemaining: attemptsRemaining(row.maxAttempts, row.attemptsUsed),
    questions: row.questions.map((q) => ({
      id: q.id,
      question: q.question,
      questionType: q.questionType,
      points: q.points,
      options: q.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        displayOrder: o.displayOrder,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Map camelCase <-> snake_case cho route submit (B-T08-7).
//
// Client (QuizPlayer/buildSubmitPayload) gui camelCase:
//   { questionId, optionIds, answerText }
// Ham SQL submit_quiz_attempt (0014) chi doc snake_case:
//   { question_id, option_ids, answer_text }
// Chieu ve ham SQL tra snake_case (attempt_id, needs_review,
// question_id, is_correct, points_awarded, ...) trong khi lib
// client doi camelCase (attemptId, needsReview, ...).
// Ca 2 chieu deu phai map o route Next — khong sua ham SQL, khong
// sua client. Cac ham duoi day la pure + co unit test.
// ---------------------------------------------------------------------------

export interface QuizAnswerSnake {
  question_id: string;
  option_ids: string[];
  answer_text: string;
}

/** camelCase (client) -> snake_case (ham SQL). */
export function toSnakeCaseQuizAnswers(
  answers: readonly QuizAnswerInput[],
): QuizAnswerSnake[] {
  return answers.map((a) => ({
    question_id: a.questionId,
    option_ids: [...(a.optionIds ?? [])],
    answer_text: a.answerText ?? '',
  }));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  if (v.some((x) => typeof x !== 'string')) return null;
  return [...(v as string[])];
}

/**
 * snake_case (ham SQL) -> camelCase (lib client). Tra null neu hinh
 * dang khong hop le — route tra 502 thay vi de client throw
 * bad_response kho hieu.
 */
export function toCamelCaseQuizSubmitResult(
  data: unknown,
): QuizSubmitResult | null {
  if (!isRecord(data)) return null;
  if (typeof data.attempt_id !== 'string') return null;
  if (
    typeof data.score !== 'number' ||
    typeof data.total !== 'number' ||
    typeof data.percent !== 'number' ||
    typeof data.passed !== 'boolean' ||
    typeof data.needs_review !== 'boolean' ||
    (data.status !== 'submitted' && data.status !== 'expired')
  ) {
    return null;
  }
  if (!Array.isArray(data.results)) return null;
  const results: QuizQuestionResult[] = [];
  for (const r of data.results as unknown[]) {
    if (!isRecord(r)) return null;
    const correct = asStringArray(r.correct_option_ids);
    const selected = asStringArray(r.selected_option_ids);
    if (
      typeof r.question_id !== 'string' ||
      typeof r.question_type !== 'string' ||
      (r.is_correct !== null && typeof r.is_correct !== 'boolean') ||
      typeof r.points_awarded !== 'number' ||
      typeof r.points !== 'number' ||
      (r.explanation !== null && typeof r.explanation !== 'string') ||
      correct === null ||
      selected === null ||
      (r.answer_text !== null && typeof r.answer_text !== 'string')
    ) {
      return null;
    }
    results.push({
      questionId: r.question_id,
      questionType: r.question_type as QuizQuestionType,
      isCorrect: r.is_correct as boolean | null,
      pointsAwarded: r.points_awarded,
      points: r.points,
      explanation: r.explanation as string | null,
      correctOptionIds: correct,
      selectedOptionIds: selected,
      answerText: r.answer_text as string | null,
    });
  }
  return {
    attemptId: data.attempt_id,
    score: data.score,
    total: data.total,
    percent: data.percent,
    passed: data.passed,
    needsReview: data.needs_review,
    status: data.status,
    results,
  };
}

// ---------------------------------------------------------------------------
// Client fetch wrappers (goi route Next /api/v1/quizzes/*)
// ---------------------------------------------------------------------------

async function readQuizResponse(res: Response): Promise<Record<string, unknown>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const code =
      (body as { error?: unknown } | null)?.error ?? 'request_failed';
    throw new QuizApiError(
      res.status,
      typeof code === 'string' ? code : 'request_failed',
      `Quiz request failed (${res.status}).`,
    );
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new QuizApiError(res.status, 'bad_response', 'Phản hồi quiz không hợp lệ.');
  }
  return body as Record<string, unknown>;
}

function asPaper(value: unknown): QuizPaper {
  const p = value as QuizPaper;
  if (!p || typeof p.quizId !== 'string' || !Array.isArray(p.questions)) {
    throw new QuizApiError(502, 'bad_response', 'Đề thi trả về không hợp lệ.');
  }
  return p;
}

/** Lay de thi (khong co dap an dung). */
export async function fetchQuizPaper(
  quizId: string,
  init?: RequestInit,
): Promise<QuizPaper> {
  const res = await fetch(quizApiPath(quizId), {
    credentials: 'same-origin',
    ...init,
  });
  const body = await readQuizResponse(res);
  return asPaper(body.paper ?? body);
}

export interface QuizSubmitInput {
  startedAt: string;
  answers: QuizAnswerInput[];
}

/** Nop bai — cham o server, tra ket qua + dap an dung (sau khi nop). */
export async function submitQuizAttempt(
  quizId: string,
  input: QuizSubmitInput,
): Promise<QuizSubmitResult> {
  const res = await fetch(`${quizApiPath(quizId)}/submit`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readQuizResponse(res);
  const result = body.result as QuizSubmitResult | undefined;
  if (!result || typeof result.attemptId !== 'string') {
    throw new QuizApiError(res.status, 'bad_response', 'Kết quả chấm trả về không hợp lệ.');
  }
  return result;
}

/** Lich su lam bai cua chinh minh cho quiz nay (moi nhat truoc). */
export async function fetchQuizHistory(quizId: string): Promise<QuizAttemptSummary[]> {
  const res = await fetch(`${quizApiPath(quizId)}/attempts`, {
    credentials: 'same-origin',
  });
  const body = await readQuizResponse(res);
  const attempts = body.attempts;
  if (!Array.isArray(attempts)) {
    throw new QuizApiError(res.status, 'bad_response', 'Lịch sử làm bài trả về không hợp lệ.');
  }
  return attempts as QuizAttemptSummary[];
}
