export const runtime = 'edge';
// DELETE /api/admin/courses/[courseId]/instructors/[userId] — chi admin.
// Thu hoi phan cong giang vien cua khoa + audit 'instructor.revoke'.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError } from '@/lib/admin-api';
import { revokeInstructorAssignment } from '@/lib/lms-admin';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; userId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { courseId, userId } = await params;
  if (!courseId || !userId) return jsonError('Thiếu courseId hoặc userId.', 400);
  const result = await revokeInstructorAssignment(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    courseId,
    userId,
  });
  if (result.status === 'error') return jsonError(result.message, 400);
  return NextResponse.json({
    ok: true,
    assignmentId: result.assignmentId,
    auditWarning: result.auditWarning ?? null,
  });
}
