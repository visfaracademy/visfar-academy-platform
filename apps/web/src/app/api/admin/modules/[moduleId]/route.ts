export const runtime = 'edge';
// PATCH /api/admin/modules/[moduleId] — chi admin.
// Sua chuong (tieu de, mo ta, thu tu, xem thu, xuat ban) + audit.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { validateModuleInput, writeAuditLog } from '@/lib/lms-admin';

const MODULE_PATCH_FIELDS = ['title', 'description', 'display_order', 'is_free_preview', 'is_published'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { moduleId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const patch: Record<string, unknown> = {};
  for (const field of MODULE_PATCH_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return jsonError('Không có trường nào để cập nhật.', 400);
  const { data: current, error: curErr } = await admin.ctx.client
    .from('course_modules')
    .select('id, title, display_order')
    .eq('id', moduleId)
    .maybeSingle();
  if (curErr || !current) return jsonError(curErr?.message ?? 'Không tìm thấy chương.', 404);
  const validationError = validateModuleInput({
    title: (patch.title ?? (current as { title: string }).title) as unknown,
    displayOrder: (patch.display_order ?? (current as { display_order: number }).display_order) as unknown,
  });
  if (validationError) return jsonError(validationError, 400);
  const { error } = await admin.ctx.client.from('course_modules').update(patch).eq('id', moduleId);
  if (error) return jsonError(error.message, 500);
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'module.update',
    targetType: 'course_module',
    targetId: moduleId,
    details: { changed_fields: Object.keys(patch), patch },
  });
  return NextResponse.json({
    ok: true,
    auditWarning: audit.ok ? null : `Đã lưu nhưng chưa ghi được audit log: ${audit.error}`,
  });
}
