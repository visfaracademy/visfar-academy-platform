export const runtime = 'edge';
// POST /api/admin/leads/[leadId]/interactions — ghi tuong tac moi (chi admin).
// Ghi vao lead_interactions + audit 'lead.interaction' qua
// addLeadInteraction() trong lib crm.ts. Can migration 0017 (bang
// lead_interactions) — chua chay thi route tra loi ro thay vi gia vo thanh cong.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { addLeadInteraction } from '@/lib/crm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { leadId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const channel = typeof body.channel === 'string' ? body.channel : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const outcome =
    typeof body.outcome === 'string' && body.outcome ? body.outcome : null;
  const result = await addLeadInteraction(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    leadId,
    channel,
    content,
    outcome,
  });
  if (result.status === 'error') return jsonError(result.message, 400);
  return NextResponse.json(
    {
      ok: true,
      interactionId: result.interactionId,
      auditWarning: result.auditWarning ?? null,
    },
    { status: 201 },
  );
}
