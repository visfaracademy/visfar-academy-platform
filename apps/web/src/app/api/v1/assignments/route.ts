// /api/v1/assignments — danh sach + giao bai.
// GET ?courseId= / ?lessonId=: hoc vien da ghi danh chi thay bai published;
//   giang vien khoa phu trach + admin thay tat ca (ke ca draft).
// POST: giao bai moi — chi giang vien khoa phu trach hoac admin. Bai
//   duoc gan vao 1 lesson (lessonId, tuy chon) trong 1 khoa (courseId
//   bat buoc). Han nop / diem toi da / cho nop muon theo DECISIONS
//   Task 03 QĐ 10 + DATABASE_SCHEMA §3.15.
export const runtime = 'edge';

import { NextResponse, type NextRequest } from 'next/server';
import {
  assignmentJsonError,
  getAssignmentCaller,
  readJsonBody,
  validateAssignmentInput,
} from '@/lib/assignment-server';
import { writeAuditLog } from '@/lib/lms-admin';

export async function GET(req: NextRequest) {
  const caller = await getAssignmentCaller();
  if (!caller.ok) return caller.response;
  const { client, userId } = caller;
  const url = new URL(req.url);
  const courseId = url.searchParams.get('courseId');
  const lessonId = url.searchParams.get('lessonId');
  if (!courseId && !lessonId) {
    return assignmentJsonError('Thiếu courseId hoặc lessonId.', 400);
  }

  // Giai lesson -> khoa (de kiem tra quyen theo khoa).
  let resolvedCourseId: string | null = courseId;
  if (!resolvedCourseId && lessonId) {
    const { data: lesson } = await client
      .from('lessons')
      .select('course_module_id')
      .eq('id', lessonId)
      .maybeSingle();
    const moduleId = (lesson as { course_module_id?: string } | null)?.course_module_id;
    if (!moduleId) return assignmentJsonError('Không tìm thấy bài học.', 404);
    const { data: mod } = await client
      .from('course_modules')
      .select('course_id')
      .eq('id', moduleId)
      .maybeSingle();
    resolvedCourseId = (mod as { course_id?: string } | null)?.course_id ?? null;
    if (!resolvedCourseId) return assignmentJsonError('Không tìm thấy bài học.', 404);
  }

  const [{ data: roleRows }, { data: profile }, { data: enroll }, { data: instr }] =
    await Promise.all([
      client.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin'),
      client.from('profiles').select('role').eq('id', userId).maybeSingle(),
      client
        .from('enrollments')
        .select('status')
        .eq('user_id', userId)
        .eq('course_id', resolvedCourseId)
        .maybeSingle(),
      client
        .from('course_instructors')
        .select('course_id')
        .eq('course_id', resolvedCourseId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
  const isAdmin =
    (Array.isArray(roleRows) && roleRows.length > 0) ||
    (profile as { role?: string } | null)?.role === 'admin';
  const isInstructor = Boolean(instr);
  const enrolled =
    (enroll as { status?: string } | null)?.status === 'active' ||
    (enroll as { status?: string } | null)?.status === 'completed';
  if (!enrolled && !isInstructor && !isAdmin) {
    return assignmentJsonError('Bạn chưa ghi danh khóa học này.', 403);
  }

  let query = client
    .from('assignments')
    .select(
      'id, course_id, lesson_id, title, description, assignment_type, max_score, due_at, allow_late_submission, status, is_published, created_at',
    )
    .order('created_at', { ascending: true });
  if (courseId) query = query.eq('course_id', courseId);
  if (lessonId) query = query.eq('lesson_id', lessonId);
  // Hoc vien chi thay bai dang mo; giang vien/admin thay ca draft.
  if (!isInstructor && !isAdmin) query = query.eq('status', 'published');
  const { data, error } = await query;
  if (error) {
    if (/column .* does not exist/i.test(error.message ?? '')) {
      return assignmentJsonError(
        'Bài tập chưa khả dụng: migration 0015 chưa được áp lên cơ sở dữ liệu.',
        500,
      );
    }
    return assignmentJsonError('Không tải được danh sách bài tập.', 502);
  }
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return NextResponse.json({
    ok: true,
    assignments: rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      lessonId: r.lesson_id ?? null,
      title: r.title,
      description: r.description,
      assignmentType: r.assignment_type ?? 'essay',
      maxScore: typeof r.max_score === 'number' ? r.max_score : null,
      dueAt: r.due_at ?? null,
      allowLateSubmission: r.allow_late_submission === true,
      status: r.status ?? (r.is_published === false ? 'draft' : 'published'),
    })),
  });
}

export async function POST(req: NextRequest) {
  const caller = await getAssignmentCaller();
  if (!caller.ok) return caller.response;
  const { client, userId } = caller;
  const body = await readJsonBody(req);
  if (!body) {
    return assignmentJsonError('Nội dung gửi lên không phải JSON hợp lệ.', 400);
  }
  const input = {
    courseId: body.courseId ?? body.course_id,
    lessonId: body.lessonId ?? body.lesson_id ?? null,
    title: body.title,
    description: body.description,
    assignmentType: body.assignmentType ?? body.assignment_type ?? 'essay',
    maxScore: body.maxScore ?? body.max_score ?? null,
    dueAt: body.dueAt ?? body.due_at ?? null,
    allowLateSubmission: body.allowLateSubmission ?? body.allow_late_submission ?? false,
    status: body.status ?? 'published',
  };
  const validationError = validateAssignmentInput(input);
  if (validationError) return assignmentJsonError(validationError, 400);

  // Quyen: admin, hoac instructor cua dung khoa nay.
  const [{ data: roleRows }, { data: profile }, { data: instr }] = await Promise.all([
    client.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin'),
    client.from('profiles').select('role').eq('id', userId).maybeSingle(),
    client
      .from('course_instructors')
      .select('course_id')
      .eq('course_id', String(input.courseId))
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  const isAdmin =
    (Array.isArray(roleRows) && roleRows.length > 0) ||
    (profile as { role?: string } | null)?.role === 'admin';
  if (!isAdmin && !instr) {
    return assignmentJsonError('Chỉ giảng viên phụ trách khóa hoặc quản trị viên mới giao được bài.', 403);
  }
  // Lesson (neu co) phai thuoc dung khoa nay.
  if (input.lessonId) {
    const { data: lesson } = await client
      .from('lessons')
      .select('id, course_module_id')
      .eq('id', String(input.lessonId))
      .maybeSingle();
    const moduleId = (lesson as { course_module_id?: string } | null)?.course_module_id;
    if (!lesson || !moduleId) {
      return assignmentJsonError('Không tìm thấy bài học.', 404);
    }
    const { data: mod } = await client
      .from('course_modules')
      .select('course_id')
      .eq('id', moduleId)
      .maybeSingle();
    if ((mod as { course_id?: string } | null)?.course_id !== String(input.courseId)) {
      return assignmentJsonError('Bài học không thuộc khóa học này.', 400);
    }
  }

  const status = String(input.status);
  const { data, error } = await client
    .from('assignments')
    .insert({
      course_id: String(input.courseId),
      lesson_id: input.lessonId ? String(input.lessonId) : null,
      title: String(input.title).trim(),
      description: String(input.description).trim(),
      assignment_type: String(input.assignmentType),
      max_score: input.maxScore,
      due_at: input.dueAt,
      allow_late_submission: input.allowLateSubmission === true,
      status,
      is_published: status === 'published',
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
    return assignmentJsonError('Không tạo được bài tập. Vui lòng thử lại.', 502);
  }
  const assignmentId = (data as { id: string }).id;
  const audit = await writeAuditLog(client, {
    actorId: userId,
    action: 'assignment.create',
    targetType: 'assignment',
    targetId: assignmentId,
    details: { courseId: input.courseId, title: input.title, status },
  });
  return NextResponse.json(
    {
      ok: true,
      assignmentId,
      auditWarning: audit.ok ? null : `Đã giao bài nhưng chưa ghi được audit log: ${audit.error}`,
    },
    { status: 201 },
  );
}
