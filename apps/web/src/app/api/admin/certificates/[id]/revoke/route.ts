export const runtime = 'edge';
// POST /api/admin/certificates/[id]/revoke — admin thu hoi chung chi.
// Body: { reason: string (bat buoc) }.
// Ghi status='revoked' + revoked_at/by/reason va audit_logs
// 'certificate.revoke' (xem revokeCertificate o lib/certificates.ts).
// Khong xoa dong chung chi; hoc vien du dieu kien co the duoc cap moi.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { revokeCertificate } from '@/lib/certificates';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const result = await revokeCertificate(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    certificateId: id,
    reason,
  });
  if (result.status === 'error') {
    const status = result.message.includes('đã bị thu hồi trước đó') ? 409 : 400;
    return jsonError(result.message, status);
  }
  return NextResponse.json({
    ok: true,
    certificateId: result.certificateId,
    auditWarning: result.auditWarning ?? null,
  });
}
