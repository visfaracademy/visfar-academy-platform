export const runtime = 'edge';
// PATCH /api/admin/lessons/[lessonId] — chi admin.
// Sua bai hoc (tieu de, slug, loai, noi dung, video/file URL, thu tu,
// xem thu, xuat ban) + audit 'lesson.update'.
// Luu y: video_url / file_url chi admin sua o day; hoc vien khong bao
// gio nhan URL qua HTML — chi qua /api/lms/* sau khi kiem tra enrollment.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { validateLessonInput, writeAuditLog } from '@/lib/lms-admin';

const LESSON_PATCH_FIELDS = [
  'title',
  'slug',
  'type',
  'content',
  'video_url',
  'video_duration_sec',
  'file_url',
  'display_order',
  'is_free_preview',
  'is_published',
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { lessonId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const patch: Record<string, unknown> = {};
  for (const field of LESSON_PATCH_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return jsonError('Không có trường nào để cập nhật.', 400);
  const { data: current, error: curErr } = await admin.ctx.client
    .from('lessons')
    .select('id, title, slug, type, display_order')
    .eq('id', lessonId)
    .maybeSingle();
  if (curErr || !current) return jsonError(curErr?.message ?? 'Không tìm thấy bài học.', 404);
  const validationError = validateLessonInput({
    title: (patch.title ?? (current as { title: string }).title) as unknown,
    slug: (patch.slug ?? (current as { slug: string }).slug) as unknown,
    type: (patch.type ?? (current as { type: string }).type) as unknown,
    displayOrder: (patch.display_order ?? (current as { display_order: number }).display_order) as unknown,
  });
  if (validationError) return jsonError(validationError, 400);
  const { error } = await admin.ctx.client.from('lessons').update(patch).eq('id', lessonId);
  if (error) {
    const message =
      (error as { code?: string } | null)?.code === '23505'
        ? 'Slug bài học này đã có trong chương.'
        : error.message;
    return jsonError(message, (error as { code?: string } | null)?.code === '23505' ? 409 : 500);
  }
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'lesson.update',
    targetType: 'lesson',
    targetId: lessonId,
    details: { changed_fields: Object.keys(patch), patch },
  });
  return NextResponse.json({
    ok: true,
    auditWarning: audit.ok ? null : `Đã lưu nhưng chưa ghi được audit log: ${audit.error}`,
  });
}
