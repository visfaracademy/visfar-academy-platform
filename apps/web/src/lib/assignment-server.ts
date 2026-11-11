// Helper PHIA SERVER cho API route bai tap — Task 08 (ASSIGNMENT).
// Chi dung o Route Handler (khong dung o client). Moi route: lay client
// server mang JWT nguoi goi (getServerSupabaseClient) -> xac thuc nguoi
// dung that qua auth.getUser() -> moi doc/ghi; RLS van la lop chan cuoi.
// KHONG dung service-role key o day (apps/web khong co key do).
// Khong tra storage_path / file_url goc ra ngoai — cac ham map chi tra
// id + ten file + link download qua API (xem assignments.ts).
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import {
  validateAssignmentInput,
  validateReviewInput,
  validateSubmissionInput,
  type AssignmentDetail,
  type AssignmentStatus,
  type AssignmentType,
  type ReviewStatus,
  type SubmissionItem,
  type SubmissionReviewItem,
} from '@/lib/assignments';
import { readJsonBody } from '@/lib/admin-api';

export { validateAssignmentInput, validateReviewInput, validateSubmissionInput };
export { readJsonBody };

export function assignmentJsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Lay client server + user hien tai; tra Response loi khi chua dang nhap. */
export async function getAssignmentCaller(): Promise<
  | { ok: true; client: SupabaseClient; userId: string }
  | { ok: false; response: NextResponse }
> {
  const client = await getServerSupabaseClient();
  if (!client) {
    return {
      ok: false,
      response: assignmentJsonError(
        'Chưa cấu hình Supabase hoặc chưa đăng nhập.',
        503,
      ),
    };
  }
  const { data } = await client.auth.getUser();
  if (!data.user) {
    return {
      ok: false,
      response: assignmentJsonError('Bạn chưa đăng nhập.', 401),
    };
  }
  return { ok: true, client, userId: data.user.id };
}

export interface AssignmentContextRow {
  assignment: Record<string, unknown>;
  course: { id: string; slug: string; title: string; status: string };
  isAdmin: boolean;
  isInstructor: boolean;
  enrollmentStatus: string | null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Doc bai tap + khoa + quyen cua nguoi goi.
 *  Tra 'not_found' khi khong co bai tap; 'migration_missing' khi cot moi
 *  cua 0015 chua ton tai tren DB (loi ro thay vi 404 gia). */
export async function loadAssignmentContext(
  client: SupabaseClient,
  userId: string,
  assignmentId: string,
): Promise<
  | { ok: true; ctx: AssignmentContextRow }
  | { ok: false; error: 'not_found' | 'migration_missing' | 'unavailable' }
> {
  const { data: asg, error: asgErr } = await client
    .from('assignments')
    .select(
      'id, course_id, lesson_id, title, description, assignment_type, max_score, due_at, allow_late_submission, status, is_published',
    )
    .eq('id', assignmentId)
    .maybeSingle();
  if (asgErr || !asg) {
    if (asgErr && /column .* does not exist/i.test(asgErr.message ?? '')) {
      return { ok: false, error: 'migration_missing' };
    }
    if (asgErr) return { ok: false, error: 'unavailable' };
    return { ok: false, error: 'not_found' };
  }
  const row = asg as unknown as Record<string, unknown>;
  const courseId = asString(row.course_id);
  if (!courseId) return { ok: false, error: 'not_found' };
  const { data: course, error: courseErr } = await client
    .from('courses')
    .select('id, slug, title, status')
    .eq('id', courseId)
    .maybeSingle();
  if (courseErr || !course) return { ok: false, error: 'not_found' };
  const courseRow = course as unknown as {
    id: string;
    slug: string;
    title: string;
    status: string;
  };
  const [{ data: roleRows }, { data: profile }, { data: enroll }, { data: instr }] =
    await Promise.all([
      client.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin'),
      client.from('profiles').select('role').eq('id', userId).maybeSingle(),
      client
        .from('enrollments')
        .select('status')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle(),
      client
        .from('course_instructors')
        .select('course_id')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
  const isAdmin =
    (Array.isArray(roleRows) && roleRows.length > 0) ||
    (profile as { role?: string } | null)?.role === 'admin';
  return {
    ok: true,
    ctx: {
      assignment: row,
      course: courseRow,
      isAdmin,
      isInstructor: Boolean(instr),
      enrollmentStatus: (enroll as { status?: string } | null)?.status ?? null,
    },
  };
}

export function toAssignmentDetail(
  ctx: AssignmentContextRow,
): AssignmentDetail {
  const a = ctx.assignment;
  const status = asString(a.status);
  return {
    id: asString(a.id) ?? '',
    courseId: ctx.course.id,
    courseSlug: ctx.course.slug,
    courseTitle: ctx.course.title,
    lessonId: asString(a.lesson_id),
    lessonSlug: null,
    title: asString(a.title) ?? '',
    description: asString(a.description) ?? '',
    assignmentType: (asString(a.assignment_type) ?? 'essay') as AssignmentType,
    maxScore: typeof a.max_score === 'number' ? a.max_score : null,
    dueAt: asString(a.due_at),
    allowLateSubmission: a.allow_late_submission === true,
    status: (status === 'draft' || status === 'published' || status === 'archived'
      ? status
      : a.is_published === false
        ? 'draft'
        : 'published') as AssignmentStatus,
  };
}

/**
 * Doc bai nop kem file + review + ten hoc vien, ghep thanh SubmissionItem[].
 * `userIdFilter` = null nghia la lay tat ca (chi instructor/admin goi).
 * Ten hoc vien co the null khi RLS profiles chan (vd. giang vien doc ho
 * so giang vien khac) — UI hien 'Học viên' thay vi loi.
 */
export async function fetchSubmissionsDetailed(
  client: SupabaseClient,
  assignmentId: string,
  userIdFilter: string | null,
): Promise<SubmissionItem[]> {
  let query = client
    .from('submissions')
    .select(
      'id, assignment_id, user_id, content_text, content, status, is_late, submitted_at, graded_at',
    )
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (userIdFilter) query = query.eq('user_id', userIdFilter);
  const { data: subs, error } = await query;
  if (error || !subs) return [];
  const rows = subs as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];
  const submissionIds = rows.map((r) => asString(r.id) ?? '');
  const userIds = [...new Set(rows.map((r) => asString(r.user_id) ?? ''))];

  const [{ data: files }, { data: reviews }, { data: profiles }] = await Promise.all([
    client
      .from('submission_files')
      .select('id, submission_id, file_name, file_size_bytes, mime_type, created_at')
      .in('submission_id', submissionIds)
      .order('created_at', { ascending: true }),
    client
      .from('submission_reviews')
      .select('id, submission_id, reviewer_id, score, feedback, status, reviewed_at')
      .in('submission_id', submissionIds)
      .order('reviewed_at', { ascending: false }),
    client.from('profiles').select('id, full_name, email').in('id', userIds),
  ]);
  const fileRows = (files ?? []) as unknown as Array<Record<string, unknown>>;
  const reviewRows = (reviews ?? []) as unknown as Array<Record<string, unknown>>;
  const profileRows = (profiles ?? []) as unknown as Array<Record<string, unknown>>;
  const profileById = new Map(
    profileRows.map((p) => [
      asString(p.id) ?? '',
      { name: asString(p.full_name), email: asString(p.email) },
    ]),
  );
  // Ten nguoi cham: doc them 1 luot (co the null do RLS — chiu duoc).
  const reviewerIds = [...new Set(reviewRows.map((r) => asString(r.reviewer_id) ?? ''))];
  let reviewerById = new Map<string, string | null>();
  if (reviewerIds.length > 0) {
    const { data: reviewers } = await client
      .from('profiles')
      .select('id, full_name')
      .in('id', reviewerIds);
    reviewerById = new Map(
      ((reviewers ?? []) as unknown as Array<Record<string, unknown>>).map((p) => [
        asString(p.id) ?? '',
        asString(p.full_name),
      ]),
    );
  }

  return rows.map((r) => {
    const id = asString(r.id) ?? '';
    const userId = asString(r.user_id) ?? '';
    const profile = profileById.get(userId);
    const subReviews: SubmissionReviewItem[] = reviewRows
      .filter((rev) => asString(rev.submission_id) === id)
      .map((rev) => ({
        id: asString(rev.id) ?? '',
        score: typeof rev.score === 'number' ? rev.score : null,
        feedback: asString(rev.feedback),
        status: (asString(rev.status) ?? 'graded') as ReviewStatus,
        reviewerId: asString(rev.reviewer_id) ?? '',
        reviewerName: reviewerById.get(asString(rev.reviewer_id) ?? '') ?? null,
        reviewedAt: asString(rev.reviewed_at) ?? '',
      }));
    const status = asString(r.status);
    return {
      id,
      assignmentId: asString(r.assignment_id) ?? '',
      userId,
      studentName: profile?.name ?? null,
      studentEmail: profile?.email ?? null,
      contentText: asString(r.content_text) ?? asString(r.content),
      status: (status === 'draft' || status === 'submitted' || status === 'graded' || status === 'returned'
        ? status
        : 'submitted') as SubmissionItem['status'],
      isLate: r.is_late === true,
      submittedAt: asString(r.submitted_at) ?? '',
      gradedAt: asString(r.graded_at),
      files: fileRows
        .filter((f) => asString(f.submission_id) === id)
        .map((f) => ({
          id: asString(f.id) ?? '',
          fileName: asString(f.file_name) ?? '',
          fileSizeBytes: typeof f.file_size_bytes === 'number' ? f.file_size_bytes : 0,
          mimeType: asString(f.mime_type),
          createdAt: asString(f.created_at) ?? '',
        })),
      latestReview: subReviews.length > 0 ? subReviews[0] : null,
      reviews: subReviews,
    };
  });
}

export type { NextRequest };
