export const runtime = 'edge';
// POST /api/admin/lessons/[lessonId]/resources — chi admin.
// Them tai lieu cho bai hoc + audit 'resource.create'.
// URL tai lieu luu o DB nhung chi tra cho hoc vien qua
// GET /api/lms/resources/[id] (redirect sau khi kiem tra enrollment).
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { validateResourceInput, writeAuditLog } from '@/lib/lms-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { lessonId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const input = {
    title: body.title,
    resourceType: body.resource_type ?? body.resourceType ?? 'file',
    fileUrl: body.file_url ?? body.fileUrl ?? '',
    displayOrder: body.display_order ?? body.displayOrder ?? 0,
  };
  const validationError = validateResourceInput(input);
  if (validationError) return jsonError(validationError, 400);
  const { data: lesson, error: lessonErr } = await admin.ctx.client
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .maybeSingle();
  if (lessonErr || !lesson) return jsonError(lessonErr?.message ?? 'Không tìm thấy bài học.', 404);
  const { data, error } = await admin.ctx.client
    .from('lesson_resources')
    .insert({
      lesson_id: lessonId,
      title: (input.title as string).trim(),
      resource_type: input.resourceType as string,
      file_url: typeof input.fileUrl === 'string' && input.fileUrl.trim() ? input.fileUrl.trim() : null,
      file_size_bytes: typeof body.file_size_bytes === 'number' ? body.file_size_bytes : null,
      display_order: input.displayOrder as number,
      is_free_preview: body.is_free_preview === true,
    })
    .select('id')
    .single();
  if (error || !data) return jsonError(error?.message ?? 'Không thêm được tài liệu.', 500);
  const resourceId = (data as { id: string }).id;
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'resource.create',
    targetType: 'lesson_resource',
    targetId: resourceId,
    details: { lesson_id: lessonId, title: input.title, resource_type: input.resourceType },
  });
  return NextResponse.json(
    { ok: true, resourceId, auditWarning: audit.ok ? null : `Đã thêm tài liệu nhưng chưa ghi được audit log: ${audit.error}` },
    { status: 201 },
  );
}
