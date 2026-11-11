export const runtime = 'edge';
// GET /api/v1/quizzes/[quizId]/attempts — lich su lam bai cua minh.
//
// Chi doc attempt cua chinh minh (RLS quiz_attempts_select_own).
// Khong tra dap an dung o day — muon xem dap an dung + giai thich
// thi mo ket qua cua lan nop (response cua POST .../submit).
import { NextResponse } from 'next/server';
import { getServerSupabaseClient, getServerUser } from '@/lib/supabase-server';

interface AttemptRow {
  id: string;
  quiz_id: string;
  score: number;
  total: number;
  passed: boolean | null;
  needs_review: boolean | null;
  status: string;
  started_at: string | null;
  submitted_at: string;
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
    .select('id')
    .eq('id', quizId)
    .eq('is_published', true)
    .maybeSingle();
  if (quizErr || !quizData) {
    return NextResponse.json({ ok: false, error: 'quiz_not_found' }, { status: 404 });
  }

  const { data, error } = await client
    .from('quiz_attempts')
    .select('id, quiz_id, score, total, passed, needs_review, status, started_at, submitted_at')
    .eq('user_id', user.id)
    .eq('quiz_id', quizId)
    .order('submitted_at', { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: 'quiz_not_found' }, { status: 404 });
  }
  const attempts = ((data ?? []) as unknown as AttemptRow[]).map((a) => ({
    id: a.id,
    quizId: a.quiz_id,
    score: a.score,
    total: a.total,
    percent: a.total === 0 ? 0 : Math.round((a.score * 100) / a.total),
    passed: a.passed,
    needsReview: a.needs_review ?? false,
    status: a.status,
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
  }));
  return NextResponse.json({ ok: true, attempts });
}
