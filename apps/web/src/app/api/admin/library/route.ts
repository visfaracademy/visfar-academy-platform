export const runtime = 'edge';
// /api/admin/library — chi admin.
// GET: tat ca bai thu vien (ca nhap) + sap xep display_order.
// POST: tao bai moi + audit 'library.create'.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { normalizeYouTubeUrl, slugifyVi } from '@/lib/learning';
import { validateLibraryInput, type LibraryInput } from '@/lib/master-library';
import { writeAuditLog } from '@/lib/lms-admin';

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
    displayOrder:
      typeof body.display_order === 'number' ? body.display_order : 0,
  };
}

export async function GET(): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { data, error } = await admin.ctx.client
    .from('master_library_items')
    .select('id,title,slug,category,content,cover_image_url,video_url,is_published,display_order,created_at,updated_at')
    .order('display_order', { ascending: true });
  if (error) return jsonError(error.message || 'Không tải được danh sách thư viện.', 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const input = readInput(body);
  const validationError = validateLibraryInput(input);
  if (validationError) return jsonError(validationError, 400);
  const videoUrl = input.videoUrl.trim() === '' ? null : normalizeYouTubeUrl(input.videoUrl);
  const { data, error } = await admin.ctx.client
    .from('master_library_items')
    .insert({
      title: input.title.trim(),
      slug: input.slug,
      category: input.category.trim() || null,
      content: input.content,
      cover_image_url: input.coverImageUrl.trim() || null,
      video_url: videoUrl,
      is_published: input.isPublished,
      display_order: input.displayOrder,
    })
    .select('id')
    .single();
  if (error || !data) {
    const message =
      (error as { code?: string } | null)?.code === '23505'
        ? 'Slug này đã được dùng cho bài khác.'
        : (error?.message ?? 'Không tạo được bài viết.');
    return jsonError(message, (error as { code?: string } | null)?.code === '23505' ? 409 : 500);
  }
  const itemId = (data as { id: string }).id;
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'library.create',
    targetType: 'master_library_item',
    targetId: itemId,
    details: { slug: input.slug, title: input.title },
  });
  return NextResponse.json(
    { ok: true, itemId, auditWarning: audit.ok ? null : `Đã tạo bài nhưng chưa ghi được audit log: ${audit.error}` },
    { status: 201 },
  );
}
