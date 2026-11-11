export const runtime = 'edge';
// GET /api/admin/instructors — chi admin.
// Danh sach nguoi co vai tro giang vien de chon phan cong cho khoa.
// Chi tra id + ho ten + email (khong tra thong tin nhay cam khac).
import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin-api';
import { listInstructorCandidates } from '@/lib/lms-admin';

export async function GET(): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const instructors = await listInstructorCandidates(admin.ctx.client);
  return NextResponse.json({ ok: true, instructors });
}
