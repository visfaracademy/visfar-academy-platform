export const runtime = 'edge';
// POST /api/admin/courses/[courseId]/modules — chi admin.
// Tao chuong moi trong khoa + audit 'module.create'.
// (Sua chuong: PATCH /api/admin/modules/[moduleId].)
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { validateModuleInput, writeAuditLog } from '@/lib/lms-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { courseId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const input = { title: body.title, displayOrder: body.display_order ?? body.displayOrder ?? 0 };
  const validationError = validateModuleInput(input);
  if (validationError) return jsonError(validationError, 400);
  const slug = typeof body.slug === 'string' && body.slug.trim()
    ? body.slug.trim()
    : `chuong-${Date.now().toString(36)}`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return jsonError('Slug chương chỉ gồm chữ thường, số và dấu gạch ngang.', 400);
  }
  const { data, error } = await admin.ctx.client
    .from('course_modules')
    .insert({
      course_id: courseId,
      slug,
      title: (input.title as string).trim(),
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      display_order: input.displayOrder as number,
      is_free_preview: body.is_free_preview === true,
      is_published: body.is_published !== false,
    })
    .select('id')
    .single();
  if (error || !data) {
    const message =
      (error as { code?: string } | null)?.code === '23505'
        ? 'Slug chương này đã có trong khóa học.'
        : (error?.message ?? 'Không tạo được chương.');
    return jsonError(message, (error as { code?: string } | null)?.code === '23505' ? 409 : 500);
  }
  const moduleId = (data as { id: string }).id;
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'module.create',
    targetType: 'course_module',
    targetId: moduleId,
    details: { course_id: courseId, title: input.title },
  });
  return NextResponse.json(
    { ok: true, moduleId, auditWarning: audit.ok ? null : `Đã tạo chương nhưng chưa ghi được audit log: ${audit.error}` },
    { status: 201 },
  );
}
