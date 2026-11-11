// GET /api/v1/assignments/[id]/files/[fileId]/download — tai file bai nop.
// Chi chu bai nop, giang vien khoa phu trach, admin moi tai duoc.
// File stream tu bucket PRIVATE 'submissions' qua server (download bang
// JWT nguoi goi, policy Storage ap dung); URL goc / storage_path KHONG
// bao gio xuat hien trong response, header, hay Location.
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import {
  assignmentJsonError,
  getAssignmentCaller,
  loadAssignmentContext,
} from '@/lib/assignment-server';

function safeFileName(name: string): string {
  const clean = name.replace(/["\r\n]/g, '').trim();
  return clean === '' ? 'file' : clean;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const caller = await getAssignmentCaller();
  if (!caller.ok) return caller.response;
  const { client, userId } = caller;
  const loaded = await loadAssignmentContext(client, userId, id);
  if (!loaded.ok) {
    return assignmentJsonError('Không tìm thấy bài tập.', 404);
  }
  const { ctx } = loaded;
  const enrolled =
    ctx.enrollmentStatus === 'active' || ctx.enrollmentStatus === 'completed';
  if (!enrolled && !ctx.isInstructor && !ctx.isAdmin) {
    return assignmentJsonError('Bạn không có quyền tải file này.', 403);
  }

  const { data: fileRow, error: fileErr } = await client
    .from('submission_files')
    .select('id, submission_id, storage_path, file_name, mime_type')
    .eq('id', fileId)
    .maybeSingle();
  if (fileErr || !fileRow) {
    return assignmentJsonError('Không tìm thấy file.', 404);
  }
  const file = fileRow as unknown as {
    submission_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
  };
  const { data: sub, error: subErr } = await client
    .from('submissions')
    .select('id, assignment_id, user_id')
    .eq('id', file.submission_id)
    .maybeSingle();
  if (subErr || !sub) {
    return assignmentJsonError('Không tìm thấy file.', 404);
  }
  const subRow = sub as unknown as {
    assignment_id: string;
    user_id: string;
  };
  // File phai thuoc dung bai tap nay, va nguoi tai phai la chu bai nop
  // hoac giang vien khoa / admin (hoc vien khac khong tai duoc).
  if (
    subRow.assignment_id !== id ||
    (subRow.user_id !== userId && !ctx.isInstructor && !ctx.isAdmin)
  ) {
    return assignmentJsonError('Bạn không có quyền tải file này.', 403);
  }

  const { data: blob, error: dlErr } = await client.storage
    .from('submissions')
    .download(file.storage_path);
  if (dlErr || !blob) {
    return assignmentJsonError('Không tải được file. Vui lòng thử lại.', 502);
  }
  const fileName = safeFileName(file.file_name);
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': String(blob.size),
      'Cache-Control': 'private, no-store',
    },
  });
}
