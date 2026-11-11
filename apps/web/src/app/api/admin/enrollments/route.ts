export const runtime = 'edge';
// /api/admin/enrollments — chi admin.
// GET ?courseId=... : danh sach enrollment cua 1 khoa (kem ho ten /
// SĐT / email hoc vien — chi admin duoc xem, RLS profiles chi cho
// admin doc nguoi khac).
// POST: admin tang khoa (khong qua don) — xem grantEnrollment().
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { grantEnrollment, listCourseEnrollments } from '@/lib/lms-admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const courseId = req.nextUrl.searchParams.get('courseId');
  if (!courseId) return jsonError('Thiếu courseId.', 400);
  const items = await listCourseEnrollments(admin.ctx.client, courseId);
  return NextResponse.json({ ok: true, enrollments: items });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const courseId = typeof body.courseId === 'string' ? body.courseId : '';
  const grantReason = typeof body.grantReason === 'string' ? body.grantReason : '';
  if (!userId || !courseId) return jsonError('Thiếu userId hoặc courseId.', 400);
  const result = await grantEnrollment(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    userId,
    courseId,
    grantReason,
  });
  if (result.status === 'error') {
    const status = result.message.includes('đã có quyền học') ? 409 : 400;
    return jsonError(result.message, status);
  }
  return NextResponse.json(
    { ok: true, enrollmentId: result.enrollmentId, reactivated: result.reactivated, auditWarning: result.auditWarning ?? null },
    { status: 201 },
  );
}
