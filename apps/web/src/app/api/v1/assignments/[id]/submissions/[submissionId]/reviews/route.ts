// POST /api/v1/assignments/[id]/submissions/[submissionId]/reviews — cham bai.
// Chi giang vien khoa phu trach hoac admin. Cham lai = them review MOI
// (khong sua review cu); trigger trg_submission_reviews_sync o migration
// 0015 dong bo submissions.status / graded_at theo review moi nhat.
// Diem vuot maxScore bi chan o day (validateReviewInput) truoc khi ghi.
export const runtime = 'edge';

import { NextResponse, type NextRequest } from 'next/server';
import {
  assignmentJsonError,
  getAssignmentCaller,
  loadAssignmentContext,
  readJsonBody,
  validateReviewInput,
} from '@/lib/assignment-server';
import { writeAuditLog } from '@/lib/lms-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> },
) {
  const { id, submissionId } = await params;
  const caller = await getAssignmentCaller();
  if (!caller.ok) return caller.response;
  const { client, userId } = caller;
  const loaded = await loadAssignmentContext(client, userId, id);
  if (!loaded.ok) {
    return assignmentJsonError(
      loaded.error === 'not_found' ? 'Không tìm thấy bài tập.' : 'Không tải được bài tập.',
      loaded.error === 'not_found' ? 404 : 502,
    );
  }
  const { ctx } = loaded;
  if (!ctx.isInstructor && !ctx.isAdmin) {
    return assignmentJsonError('Chỉ giảng viên phụ trách khóa hoặc quản trị viên mới chấm được bài.', 403);
  }

  const { data: sub, error: subErr } = await client
    .from('submissions')
    .select('id, assignment_id, user_id, status')
    .eq('id', submissionId)
    .maybeSingle();
  if (subErr || !sub) {
    return assignmentJsonError('Không tìm thấy bài nộp.', 404);
  }
  const subRow = sub as unknown as { assignment_id: string; status: string };
  if (subRow.assignment_id !== id) {
    return assignmentJsonError('Không tìm thấy bài nộp.', 404);
  }
  if (subRow.status === 'draft') {
    return assignmentJsonError('Bản nháp chưa nộp nên chưa chấm được.', 400);
  }

  const body = await readJsonBody(req);
  if (!body) {
    return assignmentJsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  }
  const maxScore =
    typeof ctx.assignment.max_score === 'number' ? ctx.assignment.max_score : null;
  const score =
    body.score === null || body.score === undefined
      ? null
      : typeof body.score === 'number'
        ? body.score
        : Number.NaN;
  const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';
  const status = body.status === 'returned' ? 'returned' : body.status === 'graded' ? 'graded' : null;
  const validationError = validateReviewInput({ score, feedback, status }, maxScore);
  if (validationError) return assignmentJsonError(validationError, 400);

  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from('submission_reviews')
    .insert({
      submission_id: submissionId,
      reviewer_id: userId,
      score,
      feedback: feedback === '' ? null : feedback,
      status,
      reviewed_at: nowIso,
    })
    .select('id, score, feedback, status, reviewer_id, reviewed_at')
    .single();
  if (error || !data) {
    return assignmentJsonError('Không lưu được kết quả chấm. Vui lòng thử lại.', 502);
  }
  const review = data as unknown as {
    id: string;
    score: number | null;
    feedback: string | null;
    status: string;
    reviewer_id: string;
    reviewed_at: string;
  };
  const audit = await writeAuditLog(client, {
    actorId: userId,
    action: 'submission.grade',
    targetType: 'submission',
    targetId: submissionId,
    details: { assignmentId: id, score, status },
  });
  return NextResponse.json(
    {
      ok: true,
      review: {
        id: review.id,
        score: review.score,
        feedback: review.feedback,
        status: review.status,
        reviewerId: review.reviewer_id,
        reviewerName: null,
        reviewedAt: review.reviewed_at,
      },
      auditWarning: audit.ok ? null : `Đã chấm bài nhưng chưa ghi được audit log: ${audit.error}`,
    },
    { status: 201 },
  );
}
