// POST /api/v1/assignments/[id]/upload — upload file dinh kem bai nop.
// Multipart (field `file`). Hoc vien phai da ghi danh; bai tap phai dang
// mo nhan bai (qua han + khong cho nop muon thi chan ngay o day).
// File len bucket PRIVATE 'submissions' theo duong dan
//   <user_id>/<assignment_id>/<submission_id>/<timestamp>-<ten-file>
// Response chi tra id + ten file + dung luong — KHONG tra storage_path
// hay URL goc. Tai file chi qua route download (stream qua server).
export const runtime = 'edge';

import { NextResponse, type NextRequest } from 'next/server';
import {
  assignmentJsonError,
  fetchSubmissionsDetailed,
  getAssignmentCaller,
  loadAssignmentContext,
} from '@/lib/assignment-server';
import {
  MAX_SUBMISSION_FILES,
  decideCanSubmit,
  validateUploadFile,
} from '@/lib/assignments';

function sanitizeFileName(name: string): string {
  // Loai ky tu dieu khien (charCode < 32) + ky tu cam trong ten file,
  // khong dung regex chua control character (ESLint no-control-regex).
  const withoutControls = [...name]
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('');
  const base = withoutControls
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const clean = base && base !== '' ? base : 'file';
  return clean.length > 120 ? clean.slice(0, 120) : clean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const caller = await getAssignmentCaller();
  if (!caller.ok) return caller.response;
  const { client, userId } = caller;
  const loaded = await loadAssignmentContext(client, userId, id);
  if (!loaded.ok) {
    return assignmentJsonError(
      loaded.error === 'migration_missing'
        ? 'Bài tập chưa khả dụng: migration 0015 chưa được áp lên cơ sở dữ liệu.'
        : loaded.error === 'not_found'
          ? 'Không tìm thấy bài tập.'
          : 'Không tải được bài tập.',
      loaded.error === 'not_found' ? 404 : 502,
    );
  }
  const { ctx } = loaded;
  const enrolled =
    ctx.enrollmentStatus === 'active' || ctx.enrollmentStatus === 'completed';
  if (!enrolled) {
    return assignmentJsonError('Bạn chưa ghi danh khóa học này nên không nộp được bài.', 403);
  }

  const mySubmissions = await fetchSubmissionsDetailed(client, id, userId);
  const latest = mySubmissions.length > 0 ? mySubmissions[0] : null;
  const decision = decideCanSubmit({
    assignmentStatus: String(ctx.assignment.status ?? 'published') as
      | 'draft'
      | 'published'
      | 'archived',
    assignmentType: String(ctx.assignment.assignment_type ?? 'essay') as
      | 'essay'
      | 'file_upload'
      | 'mixed',
    dueAt: (ctx.assignment.due_at as string | null) ?? null,
    allowLateSubmission: ctx.assignment.allow_late_submission === true,
    latest,
  });
  if (!decision.allowed) {
    return assignmentJsonError(decision.reason ?? 'Không nộp được bài.', 400);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return assignmentJsonError('Dữ liệu gửi lên không phải form hợp lệ.', 400);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return assignmentJsonError('Vui lòng chọn 1 file để nộp.', 400);
  }
  const uploadFile = file as unknown as File;
  const validationError = validateUploadFile({
    name: uploadFile.name,
    size: uploadFile.size,
  });
  if (validationError) return assignmentJsonError(validationError, 400);

  // Nhap dang sua thi gan file vao nhap do; chua co nhap thi tao nhap moi.
  // Gioi han so file / bai nop (tinh tren nhap hien tai).
  let submissionId: string;
  if (latest && latest.status === 'draft') {
    if (latest.files.length >= MAX_SUBMISSION_FILES) {
      return assignmentJsonError(
        `Mỗi bài nộp tối đa ${MAX_SUBMISSION_FILES} file đính kèm.`,
        400,
      );
    }
    submissionId = latest.id;
  } else {
    const { data, error } = await client
      .from('submissions')
      .insert({
        assignment_id: id,
        user_id: userId,
        content_text: null,
        status: 'draft',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !data) {
      const message = (error as { message?: string } | null)?.message ?? '';
      if (/column .* does not exist/i.test(message)) {
        return assignmentJsonError(
          'Bài tập chưa khả dụng: migration 0015 chưa được áp lên cơ sở dữ liệu.',
          500,
        );
      }
      return assignmentJsonError('Không tạo được bản nháp để đính kèm file.', 502);
    }
    submissionId = (data as { id: string }).id;
  }

  const safeName = sanitizeFileName(uploadFile.name);
  const storagePath = `${userId}/${id}/${submissionId}/${Date.now()}-${safeName}`;
  const { error: uploadErr } = await client.storage
    .from('submissions')
    .upload(storagePath, uploadFile, {
      contentType: uploadFile.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadErr) {
    return assignmentJsonError('Không tải file lên được. Vui lòng thử lại.', 502);
  }
  const { data: fileRow, error: fileErr } = await client
    .from('submission_files')
    .insert({
      submission_id: submissionId,
      storage_path: storagePath,
      file_name: safeName,
      file_size_bytes: uploadFile.size,
      mime_type: uploadFile.type || null,
      uploaded_by: userId,
    })
    .select('id, file_name, file_size_bytes, mime_type, created_at')
    .single();
  if (fileErr || !fileRow) {
    // Ghi DB loi: xoa file vua upload de khong de file mo coi trong bucket.
    await client.storage.from('submissions').remove([storagePath]);
    return assignmentJsonError(
      /column .* does not exist/i.test((fileErr as { message?: string } | null)?.message ?? '')
        ? 'Bài tập chưa khả dụng: migration 0015 chưa được áp lên cơ sở dữ liệu.'
        : 'Không lưu được thông tin file. Vui lòng thử lại.',
      /column .* does not exist/i.test((fileErr as { message?: string } | null)?.message ?? '')
        ? 500
        : 502,
    );
  }
  const row = fileRow as unknown as {
    id: string;
    file_name: string;
    file_size_bytes: number;
    mime_type: string | null;
    created_at: string;
  };
  return NextResponse.json(
    {
      ok: true,
      file: {
        id: row.id,
        fileName: row.file_name,
        fileSizeBytes: row.file_size_bytes,
        mimeType: row.mime_type,
        createdAt: row.created_at,
      },
      submissionId,
    },
    { status: 201 },
  );
}
