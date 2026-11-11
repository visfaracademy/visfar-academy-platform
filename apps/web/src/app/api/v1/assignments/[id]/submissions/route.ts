// /api/v1/assignments/[id]/submissions — lich su + nop bai.
// GET: hoc vien chi thay bai cua minh; giang vien khoa phu trach + admin
//   thay tat ca bai nop cua bai tap (de cham).
// POST: hoc vien da ghi danh nop/luu nhap. Nop lai = tao submission MOI
//   (lich su cu giu lai, theo DECISIONS Task 03 QĐ 10); rieng nhap thi
//   chi co 1 dong / hoc vien / bai tap — luu nhap cap nhat dong nhap do,
//   nop tu nhap thi chuyen chinh dong nhap do sang 'submitted'.
// Han nop kiem tra PHIA SERVER (va trigger trg_submissions_enforce_due
// o migration 0015 la lop chan cuoi o DB).
export const runtime = 'edge';

import { NextResponse, type NextRequest } from 'next/server';
import {
  assignmentJsonError,
  fetchSubmissionsDetailed,
  getAssignmentCaller,
  loadAssignmentContext,
  readJsonBody,
  validateSubmissionInput,
} from '@/lib/assignment-server';
import {
  decideCanSubmit,
  isOverdue,
} from '@/lib/assignments';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const enrolled =
    ctx.enrollmentStatus === 'active' || ctx.enrollmentStatus === 'completed';
  if (!enrolled && !ctx.isInstructor && !ctx.isAdmin) {
    return assignmentJsonError('Bạn chưa ghi danh khóa học này.', 403);
  }
  const submissions = await fetchSubmissionsDetailed(
    client,
    id,
    ctx.isInstructor || ctx.isAdmin ? null : userId,
  );
  return NextResponse.json({ ok: true, submissions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const caller = await getAssignmentCaller();
  if (!caller.ok) return caller.response;
  const { client, userId } = caller;
  const loaded = await loadAssignmentContext(client, userId, id);
  if (!loaded.ok) {
    return assignmentJsonError(
      loaded.error === 'migration_missing'
        ? 'Bài tập chưa khả dụng: migration 0015 chưa được áp lên cơ sở dữ liệu.'
        : loaded.error === 'not_found'
          ? 'Không tìm thấy bài tập.'
          : 'Không tải được bài tập.',
      loaded.error === 'not_found' ? 404 : 502,
    );
  }
  const { ctx } = loaded;
  const enrolled =
    ctx.enrollmentStatus === 'active' || ctx.enrollmentStatus === 'completed';
  if (!enrolled) {
    return assignmentJsonError('Bạn chưa ghi danh khóa học này nên không nộp được bài.', 403);
  }
  const body = await readJsonBody(req);
  if (!body) {
    return assignmentJsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  }
  const action = body.action === 'submit' ? 'submit' : body.action === 'draft' ? 'draft' : null;
  if (!action) {
    return assignmentJsonError('Hành động nộp bài không hợp lệ.', 400);
  }
  const contentText = typeof body.contentText === 'string' ? body.contentText : '';
  const detail = {
    assignmentType: String(ctx.assignment.assignment_type ?? 'essay'),
    dueAt: (ctx.assignment.due_at as string | null) ?? null,
    allowLate: ctx.assignment.allow_late_submission === true,
    status: String(ctx.assignment.status ?? 'published'),
  };

  const mySubmissions = await fetchSubmissionsDetailed(client, id, userId);
  const latest = mySubmissions.length > 0 ? mySubmissions[0] : null;

  if (action === 'submit') {
    const decision = decideCanSubmit({
      assignmentStatus: detail.status as 'draft' | 'published' | 'archived',
      assignmentType: detail.assignmentType as 'essay' | 'file_upload' | 'mixed',
      dueAt: detail.dueAt,
      allowLateSubmission: detail.allowLate,
      latest,
    });
    if (!decision.allowed) {
      return assignmentJsonError(decision.reason ?? 'Không nộp được bài.', 400);
    }
  } else if (detail.status !== 'published') {
    return assignmentJsonError('Bài tập chưa mở nhận bài.', 400);
  }

  // Bai nop phai co chu HOAC file (file chi co o dong nhap dang sua).
  // Chi bat buoc khi NOP (submit); luu nhap duoc phep de trong (chi gioi
  // han do dai) de hoc vien quay lai viet tiep sau.
  const fileCount = latest && latest.status === 'draft' ? latest.files.length : 0;
  if (action === 'submit') {
    const validationError = validateSubmissionInput(
      { contentText, fileCount, action },
      detail.assignmentType as 'essay' | 'file_upload' | 'mixed',
    );
    if (validationError) return assignmentJsonError(validationError, 400);
  } else if (contentText.length > 20000) {
    return assignmentJsonError('Nội dung bài làm tối đa 20.000 ký tự.', 400);
  }

  const nowIso = new Date().toISOString();
  let submissionId: string;
  if (latest && latest.status === 'draft') {
    // Nhap dang sua: cap nhat chinh dong nhap (khong tao dong moi).
    const { data, error } = await client
      .from('submissions')
      .update({
        content_text: contentText.trim() === '' ? null : contentText.trim(),
        status: action === 'submit' ? 'submitted' : 'draft',
        submitted_at: action === 'submit' ? nowIso : latest.submittedAt,
      })
      .eq('id', latest.id)
      .eq('user_id', userId)
      .select('id')
      .single();
    if (error || !data) {
      return assignmentJsonError(
        'Không lưu được bài làm. Vui lòng thử lại.',
        502,
      );
    }
    submissionId = (data as { id: string }).id;
  } else {
    // Nop moi / nop lai: dong moi (lich su cu giu lai).
    const { data, error } = await client
      .from('submissions')
      .insert({
        assignment_id: id,
        user_id: userId,
        content_text: contentText.trim() === '' ? null : contentText.trim(),
        status: action === 'submit' ? 'submitted' : 'draft',
        submitted_at: nowIso,
      })
      .select('id')
      .single();
    if (error || !data) {
      const message = (error as { message?: string } | null)?.message ?? '';
      if (/assignment_overdue/i.test(message)) {
        return assignmentJsonError('Đã quá hạn nộp và bài này không cho nộp muộn.', 400);
      }
      if (/column .* does not exist/i.test(message)) {
        return assignmentJsonError(
          'Bài tập chưa khả dụng: migration 0015 chưa được áp lên cơ sở dữ liệu.',
          500,
        );
      }
      return assignmentJsonError('Không lưu được bài làm. Vui lòng thử lại.', 502);
    }
    submissionId = (data as { id: string }).id;
  }

  const updated = await fetchSubmissionsDetailed(client, id, userId);
  const saved = updated.find((s) => s.id === submissionId) ?? updated[0] ?? null;
  if (!saved) {
    return assignmentJsonError('Đã lưu bài nhưng không tải lại được bài nộp.', 502);
  }
  return NextResponse.json(
    {
      ok: true,
      submission: saved,
      willBeLate:
        action === 'submit' ? isOverdue(detail.dueAt) && detail.allowLate : false,
    },
    { status: action === 'submit' ? 201 : 200 },
  );
}
