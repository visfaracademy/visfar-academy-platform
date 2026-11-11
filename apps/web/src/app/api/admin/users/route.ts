export const runtime = 'edge';
// GET /api/admin/users — danh sach hoc vien (chi admin).
// Query: ?search=...&role=student|instructor|admin&status=active|disabled|all
//        &courseId=...&page=1 — xem listAdminUsers().
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError } from '@/lib/admin-api';
import { ADMIN_USER_ROLES, listAdminUsers } from '@/lib/admin-users';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const params = req.nextUrl.searchParams;
  const role = params.get('role') ?? '';
  if (role !== '' && !(ADMIN_USER_ROLES as readonly string[]).includes(role)) {
    return jsonError('Role không hợp lệ (student, instructor hoặc admin).', 400);
  }
  const status = params.get('status') ?? 'all';
  if (!['active', 'disabled', 'all'].includes(status)) {
    return jsonError('Trạng thái không hợp lệ (active, disabled hoặc all).', 400);
  }
  const page = Number(params.get('page') ?? '1');
  const result = await listAdminUsers(admin.ctx.client, {
    search: params.get('search') ?? '',
    role,
    status,
    courseId: params.get('courseId') ?? '',
    page: Number.isFinite(page) ? page : 1,
  });
  return NextResponse.json({ ok: true, ...result });
}
