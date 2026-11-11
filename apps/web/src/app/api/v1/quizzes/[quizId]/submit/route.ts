export const runtime = 'edge';
// POST /api/v1/quizzes/[quizId]/submit — nop bai, cham o server.
//
// Cham bai KHONG chay o route (JWT cua hoc vien khong doc duoc
// question_options.is_correct — dung thiet ke RLS) va KHONG dung
// service-role key (bi cam o apps/web). Route goi ham SQL SECURITY
// DEFINER submit_quiz_attempt (migration 0014) qua RPC: ham do
// kiem tra enrollment / gioi han lan lam / het gio, cham tung cau,
// ghi quiz_attempts + quiz_answers, tra ket qua (kem dap an dung +
// giai thich — CHI SAU KHI NOP).
// Route chi validate hinh dang body + map ma loi cua ham sang HTTP:
//   unauthenticated 401 | quiz_not_found 404 | not_enrolled 403 |
//   max_attempts_reached 409 | invalid_answers 400.
import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody } from '@/lib/admin-api';
import { getServerSupabaseClient, getServerUser } from '@/lib/supabase-server';
import {
  MAX_ANSWER_TEXT_LENGTH,
  toCamelCaseQuizSubmitResult,
  toSnakeCaseQuizAnswers,
  type QuizAnswerInput,
} from '@/lib/quiz';

const KNOWN_ERRORS: Record<string, number> = {
  unauthenticated: 401,
  quiz_not_found: 404,
  not_enrolled: 403,
  max_attempts_reached: 409,
  invalid_answers: 400,
};

// B-T08-7: client gui camelCase (questionId/optionIds/answerText),
// ham SQL chi doc snake_case (question_id/option_ids/answer_text).
// Chap nhan ca 2 kieu key (camel uu tien, snake du phong) roi
// chuan hoa ve camelCase; route map sang snake_case truoc khi RPC.
function pickString(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] !== undefined ? row[camel] : row[snake];
}

function parseAnswers(body: Record<string, unknown>): QuizAnswerInput[] | null {
  const raw = body.answers;
  if (!Array.isArray(raw) || raw.length > 200) return null;
  const out: QuizAnswerInput[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const questionId = pickString(row, 'questionId', 'question_id');
    if (typeof questionId !== 'string' || questionId.length === 0) return null;
    const optionIds = pickString(row, 'optionIds', 'option_ids');
    if (
      optionIds !== undefined &&
      (!Array.isArray(optionIds) ||
        optionIds.length > 50 ||
        optionIds.some((o) => typeof o !== 'string'))
    ) {
      return null;
    }
    const answerText = pickString(row, 'answerText', 'answer_text');
    if (
      answerText !== undefined &&
      (typeof answerText !== 'string' || answerText.length > MAX_ANSWER_TEXT_LENGTH)
    ) {
      return null;
    }
    out.push({
      questionId,
      optionIds: (optionIds as string[] | undefined) ?? [],
      answerText: (answerText as string | undefined) ?? '',
    });
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> },
): Promise<NextResponse> {
  const { quizId } = await params;
  const client = await getServerSupabaseClient();
  if (!client) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }
  const user = await getServerUser(client);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const body = await readJsonBody(req);
  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid_answers' }, { status: 400 });
  }
  // B-T08-7: chap nhan ca startedAt (client) va started_at (phong thu).
  const startedAt = body.startedAt ?? body.started_at;
  if (typeof startedAt !== 'string' || Number.isNaN(Date.parse(startedAt))) {
    return NextResponse.json({ ok: false, error: 'invalid_answers' }, { status: 400 });
  }
  const answers = parseAnswers(body);
  if (answers === null) {
    return NextResponse.json({ ok: false, error: 'invalid_answers' }, { status: 400 });
  }

  // B-T08-7: map camelCase -> snake_case truoc khi RPC; ham SQL
  // chi doc question_id/option_ids/answer_text.
  const { data, error } = await client.rpc('submit_quiz_attempt', {
    p_quiz_id: quizId,
    p_started_at: startedAt,
    p_answers: toSnakeCaseQuizAnswers(answers),
  });
  if (error) {
    const code = Object.keys(KNOWN_ERRORS).find((k) => error.message.includes(k));
    if (code) {
      return NextResponse.json(
        { ok: false, error: code },
        { status: KNOWN_ERRORS[code] },
      );
    }
    return NextResponse.json({ ok: false, error: 'submit_failed' }, { status: 502 });
  }
  // B-T08-7: map snake_case -> camelCase truoc khi tra ve client;
  // lib client doi attemptId/needsReview/... — neu hinh dang la
  // thi tra 502 thay vi de client throw bad_response kho hieu.
  const result = toCamelCaseQuizSubmitResult(data);
  if (result === null) {
    return NextResponse.json({ ok: false, error: 'submit_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, result });
}
