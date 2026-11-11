export const runtime = 'edge';
// /api/admin/courses — chi admin.
// GET: tat ca khoa (ca draft/archived) + so chuong / so bai.
// POST: tao khoa moi (status mac dinh draft) + audit 'course.create'.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { validateCourseInput, fetchAdminCourseList, writeAuditLog } from '@/lib/lms-admin';

export async function GET(): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const courses = await fetchAdminCourseList(admin.ctx.client);
  return NextResponse.json({ ok: true, courses });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const input = {
    title: body.title,
    slug: body.slug,
    status: body.status ?? 'draft',
    priceVnd: body.price_vnd ?? body.priceVnd ?? 0,
    displayOrder: body.display_order ?? body.displayOrder ?? 0,
  };
  const validationError = validateCourseInput(input);
  if (validationError) return jsonError(validationError, 400);
  const { data, error } = await admin.ctx.client
    .from('courses')
    .insert({
      slug: (input.slug as string).trim(),
      display_order: input.displayOrder as number,
      title: (input.title as string).trim(),
      subtitle: typeof body.subtitle === 'string' ? body.subtitle.trim() || null : null,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      pillar: typeof body.pillar === 'string' ? body.pillar : null,
      price_vnd: input.priceVnd as number,
      is_featured: body.is_featured === true,
      status: input.status as string,
    })
    .select('id')
    .single();
  if (error || !data) {
    const message =
      (error as { code?: string } | null)?.code === '23505'
        ? 'Slug này đã được dùng cho khóa học khác.'
        : (error?.message ?? 'Không tạo được khóa học.');
    return jsonError(message, (error as { code?: string } | null)?.code === '23505' ? 409 : 500);
  }
  const courseId = (data as { id: string }).id;
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'course.create',
    targetType: 'course',
    targetId: courseId,
    details: { slug: input.slug, title: input.title, status: input.status },
  });
  return NextResponse.json(
    { ok: true, courseId, auditWarning: audit.ok ? null : `Đã tạo khóa nhưng chưa ghi được audit log: ${audit.error}` },
    { status: 201 },
  );
}
