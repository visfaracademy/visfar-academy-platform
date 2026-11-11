export const runtime = 'edge';
// PATCH /api/admin/enrollments/[id] — admin thu hoi quyen hoc.
// Body: { status: 'revoked', reason: string (bat buoc) }.
// Chi cho phep chuyen sang 'revoked' (khong mo lai bang PATCH — mo lai
// la tang khoa, dung POST /api/admin/enrollments de ghi dung audit
// 'enrollment.grant'). Sau khi thu hoi, hoc vien mat quyen ngay o
// request ke tiep (requireLessonAccess kiem tra lai moi lan).
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { revokeEnrollment } from '@/lib/lms-admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  if (body.status !== 'revoked') {
    return jsonError("PATCH này chỉ cho phép chuyển sang status 'revoked'.", 400);
  }
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const result = await revokeEnrollment(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    enrollmentId: id,
    reason,
  });
  if (result.status === 'error') {
    const status = result.message.includes('đã bị thu hồi') ? 409 : 400;
    return jsonError(result.message, status);
  }
  return NextResponse.json({
    ok: true,
    enrollmentId: result.enrollmentId,
    previousStatus: result.previousStatus,
    certificatesRevoked: result.certificatesRevoked,
    auditWarning: result.auditWarning ?? null,
    certificatesWarning: result.certificatesWarning ?? null,
  });
}
