export const runtime = 'edge';
// PATCH /api/admin/resources/[resourceId] — chi admin.
// Sua tai lieu (tieu de, loai, URL, thu tu, xem thu) + audit.
// Khong co DELETE: tai lieu khong dung thi bo is_free_preview / doi
// URL, giu lich su thay vi xoa cung (theo nguyen tac khong hard-delete).
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { validateResourceInput, writeAuditLog } from '@/lib/lms-admin';

const RESOURCE_PATCH_FIELDS = [
  'title',
  'resource_type',
  'file_url',
  'file_size_bytes',
  'display_order',
  'is_free_preview',
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { resourceId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const patch: Record<string, unknown> = {};
  for (const field of RESOURCE_PATCH_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return jsonError('Không có trường nào để cập nhật.', 400);
  const { data: current, error: curErr } = await admin.ctx.client
    .from('lesson_resources')
    .select('id, title, resource_type, file_url, display_order')
    .eq('id', resourceId)
    .maybeSingle();
  if (curErr || !current) return jsonError(curErr?.message ?? 'Không tìm thấy tài liệu.', 404);
  const validationError = validateResourceInput({
    title: (patch.title ?? (current as { title: string }).title) as unknown,
    resourceType: (patch.resource_type ?? (current as { resource_type: string }).resource_type) as unknown,
    fileUrl: (patch.file_url ?? (current as { file_url: string | null }).file_url ?? '') as unknown,
    displayOrder: (patch.display_order ?? (current as { display_order: number }).display_order) as unknown,
  });
  if (validationError) return jsonError(validationError, 400);
  const { error } = await admin.ctx.client.from('lesson_resources').update(patch).eq('id', resourceId);
  if (error) return jsonError(error.message, 500);
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'resource.update',
    targetType: 'lesson_resource',
    targetId: resourceId,
    details: { changed_fields: Object.keys(patch), patch },
  });
  return NextResponse.json({
    ok: true,
    auditWarning: audit.ok ? null : `Đã lưu nhưng chưa ghi được audit log: ${audit.error}`,
  });
}
