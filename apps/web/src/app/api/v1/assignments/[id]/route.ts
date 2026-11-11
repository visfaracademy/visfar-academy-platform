// GET /api/v1/assignments/[id] — chi tiet bai tap + bai nop cua nguoi goi.
// Hoc vien phai da ghi danh khoa (enrollment active/completed); giang vien
// khoa phu trach + admin xem duoc tat ca bai nop (de cham).
// Khong tra storage_path / file_url goc — chi id + ten file + link download
// qua API (xem submissionFileDownloadUrl).
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import {
  assignmentJsonError,
  fetchSubmissionsDetailed,
  getAssignmentCaller,
  loadAssignmentContext,
  toAssignmentDetail,
} from '@/lib/assignment-server';

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
    if (loaded.error === 'migration_missing') {
      return assignmentJsonError(
        'Bài tập chưa khả dụng: migration 0015 chưa được áp lên cơ sở dữ liệu.',
        500,
      );
    }
    if (loaded.error === 'not_found') {
      return assignmentJsonError('Không tìm thấy bài tập.', 404);
    }
    return assignmentJsonError('Không tải được bài tập. Vui lòng thử lại.', 502);
  }
  const { ctx } = loaded;
  const enrolled =
    ctx.enrollmentStatus === 'active' || ctx.enrollmentStatus === 'completed';
  if (!enrolled && !ctx.isInstructor && !ctx.isAdmin) {
    return assignmentJsonError(
      'Bạn chưa ghi danh khóa học này nên không xem được bài tập.',
      403,
    );
  }

  const detail = toAssignmentDetail(ctx);
  if (ctx.assignment.lesson_id) {
    const { data: lesson } = await client
      .from('lessons')
      .select('slug')
      .eq('id', String(ctx.assignment.lesson_id))
      .maybeSingle();
    const slug = (lesson as { slug?: string } | null)?.slug;
    if (slug) detail.lessonSlug = slug;
  }

  const mySubmissions = await fetchSubmissionsDetailed(client, id, userId);
  const allSubmissions =
    ctx.isInstructor || ctx.isAdmin
      ? await fetchSubmissionsDetailed(client, id, null)
      : null;
  return NextResponse.json({
    ok: true,
    assignment: detail,
    enrolled,
    isInstructor: ctx.isInstructor,
    isAdmin: ctx.isAdmin,
    myLatestSubmission: mySubmissions.length > 0 ? mySubmissions[0] : null,
    mySubmissions,
    allSubmissions,
  });
}
