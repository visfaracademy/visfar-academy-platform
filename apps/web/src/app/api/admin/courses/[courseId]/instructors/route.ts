export const runtime = 'edge';
// GET/POST /api/admin/courses/[courseId]/instructors — chi admin.
// GET: giang vien dang phu trach khoa (kem ho ten/email).
// POST: gan giang vien (hoac doi vai tro neu da gan) — xem
// assignInstructor() trong lib/lms-admin.ts. Moi thao tac ghi audit.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { assignInstructor, listCourseInstructors } from '@/lib/lms-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { courseId } = await params;
  const instructors = await listCourseInstructors(admin.ctx.client, courseId);
  return NextResponse.json({ ok: true, instructors });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { courseId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const role = typeof body.role === 'string' ? body.role : '';
  if (!userId || !role) return jsonError('Thiếu userId hoặc role.', 400);
  const result = await assignInstructor(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    courseId,
    userId,
    role,
  });
  if (result.status === 'error') {
    const status = result.message.includes('đã được phân công') ? 409 : 400;
    return jsonError(result.message, status);
  }
  return NextResponse.json(
    {
      ok: true,
      assignmentId: result.assignmentId,
      roleChanged: result.roleChanged,
      auditWarning: result.auditWarning ?? null,
    },
    { status: 201 },
  );
}
