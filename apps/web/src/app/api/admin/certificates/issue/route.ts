export const runtime = 'edge';
// POST /api/admin/certificates/issue — admin kich hoat cap chung chi.
// Body: { userId: string, courseId: string }.
// Chi cap khi du dieu kien (100% bai + quiz dat nguong 70% mac dinh) —
// xem issueCertificateIfEligible o lib/certificates.ts. Da cap roi thi
// tra lai chung chi cu (alreadyIssued), khong tao trung.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { issueCertificateIfEligible } from '@/lib/certificates';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const courseId = typeof body.courseId === 'string' ? body.courseId : '';
  if (!userId || !courseId) {
    return jsonError('Thiếu userId hoặc courseId.', 400);
  }
  const result = await issueCertificateIfEligible(admin.ctx.client, {
    userId,
    courseId,
    actorId: admin.ctx.adminId,
    issuedVia: 'admin',
  });
  if (result.status === 'not-eligible') {
    return NextResponse.json(
      { ok: false, error: 'Học viên chưa đủ điều kiện cấp chứng chỉ.', reasons: result.reasons },
      { status: 422 },
    );
  }
  if (result.status === 'error') {
    return jsonError(result.message, 400);
  }
  return NextResponse.json({
    ok: true,
    certificate: result.certificate,
    alreadyIssued: result.alreadyIssued,
    auditWarning: result.auditWarning ?? null,
  });
}
