export const runtime = 'edge';
// POST /api/admin/modules/[moduleId]/lessons — chi admin.
// Tao bai hoc moi trong chuong + audit 'lesson.create'.
// Slug UNIQUE theo chuong (QĐ 17) — trung slug tra 409.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { validateLessonInput, writeAuditLog } from '@/lib/lms-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { moduleId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const input = {
    title: body.title,
    slug: body.slug,
    type: body.type ?? 'text',
    displayOrder: body.display_order ?? body.displayOrder ?? 0,
  };
  const validationError = validateLessonInput(input);
  if (validationError) return jsonError(validationError, 400);
  const { data: mod, error: modErr } = await admin.ctx.client
    .from('course_modules')
    .select('id')
    .eq('id', moduleId)
    .maybeSingle();
  if (modErr || !mod) return jsonError(modErr?.message ?? 'Không tìm thấy chương.', 404);
  const { data, error } = await admin.ctx.client
    .from('lessons')
    .insert({
      course_module_id: moduleId,
      slug: (input.slug as string).trim(),
      title: (input.title as string).trim(),
      type: input.type as string,
      content: typeof body.content === 'string' ? body.content : null,
      video_url: typeof body.video_url === 'string' ? body.video_url.trim() || null : null,
      video_duration_sec: typeof body.video_duration_sec === 'number' ? body.video_duration_sec : null,
      file_url: typeof body.file_url === 'string' ? body.file_url.trim() || null : null,
      display_order: input.displayOrder as number,
      is_free_preview: body.is_free_preview === true,
      is_published: body.is_published !== false,
    })
    .select('id')
    .single();
  if (error || !data) {
    const message =
      (error as { code?: string } | null)?.code === '23505'
        ? 'Slug bài học này đã có trong chương.'
        : (error?.message ?? 'Không tạo được bài học.');
    return jsonError(message, (error as { code?: string } | null)?.code === '23505' ? 409 : 500);
  }
  const lessonId = (data as { id: string }).id;
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'lesson.create',
    targetType: 'lesson',
    targetId: lessonId,
    details: { module_id: moduleId, title: input.title, type: input.type },
  });
  return NextResponse.json(
    { ok: true, lessonId, auditWarning: audit.ok ? null : `Đã tạo bài nhưng chưa ghi được audit log: ${audit.error}` },
    { status: 201 },
  );
}
