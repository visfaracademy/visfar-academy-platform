export const runtime = 'edge';
// GET /api/v1/quizzes/[quizId] — lay de thi (KHONG co dap an dung).
//
// De thi chi tra cau hoi + lua chon qua VIEW question_options_public
// (khong co cot is_correct, tao o 0001 + doi ten o 0007 + tao lai o
// 0014). Lop loc cuoi: toPublicPaper() cat moi truong is_correct
// neu dong server vo tinh con chua no. Dap an dung chi duoc tra ve
// SAU KHI nop, trong response cua POST .../submit.
// Quyen: requireLessonAccessById (enrollment active/completed, bai
// xem thu, admin, instructor khoa). Khong tao attempt o GET — luot
// lam chi dem khi nop (ham SQL dem status submitted/expired).
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireLessonAccessById } from '@/lib/lms-access';
import { getServerSupabaseClient, getServerUser } from '@/lib/supabase-server';
import { toPublicPaper, type QuizPaperServerRow } from '@/lib/quiz';

interface QuizRow {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  pass_score_percent: number | null;
  time_limit_sec: number | null;
  max_attempts: number | null;
  shuffle_questions: boolean | null;
  is_published: boolean;
}

interface QuestionRow {
  id: string;
  question: string;
  question_type: string;
  points: number;
  display_order: number;
}

interface OptionRow {
  id: string;
  question_id: string;
  option_text: string;
  display_order: number;
}

export async function GET(
  _req: Request,
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

  const { data: quizData, error: quizErr } = await client
    .from('quizzes')
    .select(
      'id, course_id, lesson_id, title, description, pass_score_percent, time_limit_sec, max_attempts, shuffle_questions, is_published',
    )
    .eq('id', quizId)
    .maybeSingle();
  const quiz = quizData as unknown as QuizRow | null;
  if (quizErr || !quiz || !quiz.is_published) {
    return NextResponse.json({ ok: false, error: 'quiz_not_found' }, { status: 404 });
  }

  // Quyen lam bai theo bai hoc chua quiz (neu quiz chua gan bai hoc
  // thi chi admin / hoc vien da ghi danh khoa moi duoc lam).
  if (quiz.lesson_id) {
    const access = await requireLessonAccessById(client, quiz.lesson_id);
    if (!access.allowed) {
      const status =
        access.reason === 'unauthenticated'
          ? 401
          : access.reason === 'not-found'
            ? 404
            : 403;
      return NextResponse.json(
        { ok: false, error: access.reason === 'not-found' ? 'quiz_not_found' : 'not_enrolled' },
        { status },
      );
    }
  } else {
    const allowed = await hasCourseAccess(client, user.id, quiz.course_id);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'not_enrolled' }, { status: 403 });
    }
  }

  const { data: courseData } = await client
    .from('courses')
    .select('slug')
    .eq('id', quiz.course_id)
    .maybeSingle();
  const courseSlug = (courseData as unknown as { slug?: string } | null)?.slug ?? '';

  const { data: questionData, error: qErr } = await client
    .from('questions')
    .select('id, question, question_type, points, display_order')
    .eq('quiz_id', quiz.id)
    .order('display_order', { ascending: true });
  if (qErr) {
    return NextResponse.json({ ok: false, error: 'quiz_not_found' }, { status: 404 });
  }
  const questions = (questionData ?? []) as unknown as QuestionRow[];
  const questionIds = questions.map((q) => q.id);

  // Lua chon QUA VIEW cong khai (khong is_correct). Fallback view ten
  // cu quiz_options_public phong khi DB chua ap 0007/0014.
  let options: OptionRow[] = [];
  if (questionIds.length > 0) {
    const { data, error } = await client
      .from('question_options_public')
      .select('id, question_id, option_text, display_order')
      .in('question_id', questionIds)
      .order('display_order', { ascending: true });
    if (!error) {
      options = (data ?? []) as unknown as OptionRow[];
    } else {
      const { data: legacy } = await client
        .from('quiz_options_public')
        .select('id, question_id, option_text, display_order')
        .in('question_id', questionIds)
        .order('display_order', { ascending: true });
      options = (legacy ?? []) as unknown as OptionRow[];
    }
  }
  const optionsByQuestion = new Map<string, OptionRow[]>();
  for (const o of options) {
    const list = optionsByQuestion.get(o.question_id) ?? [];
    list.push(o);
    optionsByQuestion.set(o.question_id, list);
  }

  const { data: attemptData } = await client
    .from('quiz_attempts')
    .select('id')
    .eq('user_id', user.id)
    .eq('quiz_id', quiz.id)
    .in('status', ['submitted', 'expired']);
  const attemptsUsed = (attemptData ?? []).length;

  const serverRow: QuizPaperServerRow = {
    quizId: quiz.id,
    courseSlug,
    lessonId: quiz.lesson_id,
    courseId: quiz.course_id,
    title: quiz.title,
    description: quiz.description,
    passingScore: quiz.pass_score_percent,
    timeLimitSec: quiz.time_limit_sec,
    maxAttempts: quiz.max_attempts,
    shuffleQuestions: quiz.shuffle_questions ?? false,
    attemptsUsed,
    questions: questions.map((q) => ({
      id: q.id,
      question: q.question,
      questionType: q.question_type as QuizPaperServerRow['questions'][number]['questionType'],
      points: q.points,
      options: (optionsByQuestion.get(q.id) ?? []).map((o) => ({
        id: o.id,
        optionText: o.option_text,
        displayOrder: o.display_order,
      })),
    })),
  };

  return NextResponse.json({ ok: true, paper: toPublicPaper(serverRow) });
}

/** Quiz chua gan bai hoc: admin hoac enrollment active/completed. */
async function hasCourseAccess(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const [{ data: roleRows }, { data: enroll }] = await Promise.all([
    client.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin'),
    client
      .from('enrollments')
      .select('status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle(),
  ]);
  if (Array.isArray(roleRows) && roleRows.length > 0) return true;
  const status = (enroll as { status?: string } | null)?.status;
  return status === 'active' || status === 'completed';
}
