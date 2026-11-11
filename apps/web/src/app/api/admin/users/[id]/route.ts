export const runtime = 'edge';
// PATCH /api/admin/users/[id] — thao tac admin tren 1 tai khoan.
// Body:
//   { action: 'change-role', role: 'student'|'instructor'|'admin', reason?: string }
//   { action: 'disable' | 'enable', reason: string (bat buoc) }
// Chi admin (getAdminContext). Khong co thao tac xoa tai khoan —
// vo hieu hoa thay vi xoa (Task 03 QĐ 9). Hoc vien khong tu doi duoc
// role cua minh: route nay chi admin vao duoc; lib chan ca admin tu
// doi role / tu vo hieu hoa chinh minh.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { changeUserRole, setUserDisabled } from '@/lib/admin-users';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);

  if (body.action === 'change-role') {
    const role = typeof body.role === 'string' ? body.role : '';
    const reason = typeof body.reason === 'string' ? body.reason : '';
    const result = await changeUserRole(admin.ctx.client, {
      adminId: admin.ctx.adminId,
      userId: id,
      newRole: role,
      reason,
    });
    if (result.status === 'error') {
      const status = result.message.includes('Không tìm thấy') ? 404 : 400;
      return jsonError(result.message, status);
    }
    return NextResponse.json({
      ok: true,
      previousRoles: result.previousRoles,
      newRole: result.newRole,
      auditWarning: result.auditWarning ?? null,
    });
  }

  if (body.action === 'disable' || body.action === 'enable') {
    const reason = typeof body.reason === 'string' ? body.reason : '';
    const result = await setUserDisabled(admin.ctx.client, {
      adminId: admin.ctx.adminId,
      userId: id,
      disabled: body.action === 'disable',
      reason,
    });
    if (result.status === 'error') {
      const status = result.message.includes('Không tìm thấy') ? 404 : 400;
      return jsonError(result.message, status);
    }
    return NextResponse.json({
      ok: true,
      isDisabled: result.isDisabled,
      auditWarning: result.auditWarning ?? null,
    });
  }

  return jsonError("action phải là 'change-role', 'disable' hoặc 'enable'.", 400);
}
