export const runtime = 'edge';
// /api/admin/library/[id] — chi admin.
// GET: 1 bai. PATCH: sua bai + audit 'library.update'.
// DELETE: xoa bai + audit 'library.delete'.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { normalizeYouTubeUrl, slugifyVi } from '@/lib/learning';
import { validateLibraryInput, type LibraryInput } from '@/lib/master-library';
import { writeAuditLog } from '@/lib/lms-admin';

type Params = { params: Promise<{ id: string }> };

function readInput(body: Record<string, unknown>): LibraryInput {
  const title = typeof body.title === 'string' ? body.title : '';
  const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : '';
  return {
    title,
    slug: rawSlug === '' ? slugifyVi(title) : rawSlug,
    category: typeof body.category === 'string' ? body.category : '',
    content: typeof body.content === 'string' ? body.content : '',
    coverImageUrl: typeof body.cover_image_url === 'string' ? body.cover_image_url : '',
    videoUrl: typeof body.video_url === 'string' ? body.video_url : '',
    isPublished: body.is_published === true,
    displayOrder: typeof body.display_order === 'number' ? body.display_order : 0,
  };
}

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const { data, error } = await admin.ctx.client
    .from('master_library_items')
    .select('id,title,slug,category,content,cover_image_url,video_url,is_published,display_order,created_at,updated_at')
    .eq('id', id)
    .single();
  if (error || !data) return jsonError('Không tìm thấy bài viết.', 404);
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const input = readInput(body);
  const validationError = validateLibraryInput(input);
  if (validationError) return jsonError(validationError, 400);
  const videoUrl = input.videoUrl.trim() === '' ? null : normalizeYouTubeUrl(input.videoUrl);
  const { data, error } = await admin.ctx.client
    .from('master_library_items')
    .update({
      title: input.title.trim(),
      slug: input.slug,
      category: input.category.trim() || null,
      content: input.content,
      cover_image_url: input.coverImageUrl.trim() || null,
      video_url: videoUrl,
      is_published: input.isPublished,
      display_order: input.displayOrder,
    })
    .eq('id', id)
    .select('id')
    .single();
  if (error || !data) {
    const message =
      (error as { code?: string } | null)?.code === '23505'
        ? 'Slug này đã được dùng cho bài khác.'
        : (error?.message ?? 'Không cập nhật được bài viết.');
    return jsonError(message, (error as { code?: string } | null)?.code === '23505' ? 409 : 500);
  }
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'library.update',
    targetType: 'master_library_item',
    targetId: id,
    details: { slug: input.slug, title: input.title },
  });
  return NextResponse.json({
    ok: true,
    auditWarning: audit.ok ? null : `Đã lưu bài nhưng chưa ghi được audit log: ${audit.error}`,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const { data, error } = await admin.ctx.client
    .from('master_library_items')
    .delete()
    .eq('id', id)
    .select('id,title,slug')
    .single();
  if (error || !data) return jsonError('Không xóa được bài viết.', 500);
  const row = data as { title?: string; slug?: string };
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'library.delete',
    targetType: 'master_library_item',
    targetId: id,
    details: { slug: row.slug ?? '', title: row.title ?? '' },
  });
  return NextResponse.json({
    ok: true,
    auditWarning: audit.ok ? null : `Đã xóa bài nhưng chưa ghi được audit log: ${audit.error}`,
  });
}
