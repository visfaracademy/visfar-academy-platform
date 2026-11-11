export const runtime = 'edge';
// /api/admin/courses/[courseId] — chi admin.
// GET: khoa + toan bo cay chuong -> bai -> tai lieu (de hien o /admin/khoa-hoc/[id]).
// PATCH: sua khoa (chi cac truong cho phep; khong doi slug qua PATCH nay)
//   + audit 'course.update'. Khong co DELETE — an khoa bang status 'archived'.
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { fetchAdminCourseTree, validateCourseInput, writeAuditLog } from '@/lib/lms-admin';

const COURSE_PATCH_FIELDS = [
  'title',
  'subtitle',
  'description',
  'status',
  'price_vnd',
  'display_order',
  'pillar',
  'poster_url',
  'is_featured',
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { courseId } = await params;
  const tree = await fetchAdminCourseTree(admin.ctx.client, courseId);
  if (!tree.course) return jsonError('Không tìm thấy khóa học.', 404);
  return NextResponse.json({ ok: true, course: tree.course, modules: tree.modules });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { courseId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const patch: Record<string, unknown> = {};
  for (const field of COURSE_PATCH_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) return jsonError('Không có trường nào để cập nhật.', 400);
  const { data: current, error: curErr } = await admin.ctx.client
    .from('courses')
    .select('title, slug, status, price_vnd, display_order')
    .eq('id', courseId)
    .maybeSingle();
  if (curErr || !current) return jsonError(curErr?.message ?? 'Không tìm thấy khóa học.', 404);
  const merged = {
    title: (patch.title ?? (current as { title: string }).title) as unknown,
    slug: (current as { slug: string }).slug as unknown,
    status: (patch.status ?? (current as { status: string }).status) as unknown,
    priceVnd: (patch.price_vnd ?? (current as { price_vnd: number }).price_vnd) as unknown,
    displayOrder: (patch.display_order ?? (current as { display_order: number }).display_order) as unknown,
  };
  const validationError = validateCourseInput(merged);
  if (validationError) return jsonError(validationError, 400);
  const { error } = await admin.ctx.client.from('courses').update(patch).eq('id', courseId);
  if (error) return jsonError(error.message, 500);
  const audit = await writeAuditLog(admin.ctx.client, {
    actorId: admin.ctx.adminId,
    action: 'course.update',
    targetType: 'course',
    targetId: courseId,
    details: { changed_fields: Object.keys(patch), patch },
  });
  return NextResponse.json({
    ok: true,
    auditWarning: audit.ok ? null : `Đã lưu nhưng chưa ghi được audit log: ${audit.error}`,
  });
}
