export const runtime = 'edge';
// POST /api/admin/courses/[courseId]/reorder — chi admin.
// Body: { kind: 'module'|'lesson'|'resource', parentId: string,
//         items: [{ id, displayOrder }] } — luu thu tu moi + audit.
// parentId: courseId (module), moduleId (lesson), lessonId (resource).
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContext, jsonError, readJsonBody } from '@/lib/admin-api';
import { reorderContent, type ReorderKind } from '@/lib/lms-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  const admin = await getAdminContext();
  if (!admin.ok) return admin.response;
  const { courseId } = await params;
  const body = await readJsonBody(req);
  if (!body) return jsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  const kind = body.kind as ReorderKind;
  if (kind !== 'module' && kind !== 'lesson' && kind !== 'resource') {
    return jsonError("kind phải là 'module', 'lesson' hoặc 'resource'.", 400);
  }
  const parentId = typeof body.parentId === 'string' ? body.parentId : '';
  const items = Array.isArray(body.items)
    ? (body.items as Array<{ id?: unknown; displayOrder?: unknown }>)
        .filter((i) => typeof i.id === 'string' && typeof i.displayOrder === 'number')
        .map((i) => ({ id: i.id as string, displayOrder: i.displayOrder as number }))
    : [];
  if (!parentId || items.length === 0) return jsonError('Thiếu parentId hoặc items.', 400);
  const result = await reorderContent(admin.ctx.client, {
    adminId: admin.ctx.adminId,
    kind,
    courseId,
    parentId,
    items,
  });
  if (result.status === 'error') return jsonError(result.message, 400);
  return NextResponse.json({ ok: true, auditWarning: result.auditWarning ?? null });
}
