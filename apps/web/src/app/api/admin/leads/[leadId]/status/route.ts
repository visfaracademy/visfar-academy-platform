export const runtime = 'edge';
// PATCH /api/admin/leads/[leadId]/status — doi trang thai lead (chi admin).
// Ghi audit 'lead.status' qua updateLeadStatus() trong lib crm.ts.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { updateLeadStatus } from '@/lib/crm';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { leadId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const status = typeof body.status === 'string' ? body.status : '';
  const note = typeof body.note === 'string' ? body.note : undefined;
  const result = await updateLeadStatus(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    leadId,
    status,
    note,
  });
  if (result.status === 'error') return jsonError(result.message, 400);
  return NextResponse.json({
    ok: true,
    previousStatus: result.previousStatus,
    auditWarning: result.auditWarning ?? null,
  });
}
