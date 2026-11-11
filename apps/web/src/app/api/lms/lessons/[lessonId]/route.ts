export const runtime = 'edge';
// GET /api/lms/lessons/[lessonId] — lay noi dung 1 bai hoc.
// Kiem tra quyen PHIA SERVER (requireLessonAccessById): chi enrollment
// active/completed, bai xem thu, admin hoac instructor khoa phu trach
// moi nhan duoc noi dung. Bai tra phi chua ghi danh: 403, KHONG tra
// content / video_url / file_url (lesson = null). Bai xem thu: chi tra
// metadata + video_url (mau mien phi, khong content / file_url).
import { NextResponse } from 'next/server';
import { requireLessonAccessById } from '@/lib/lms-access';
import { getServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<NextResponse> {
  const { lessonId } = await params;
  const client = await getServerSupabaseClient();
  if (!client) {
    return NextResponse.json({ ok: false, error: 'Chưa cấu hình Supabase.' }, { status: 503 });
  }
  const result = await requireLessonAccessById(client, lessonId);
  if (!result.allowed) {
    const status =
      result.reason === 'unauthenticated' ? 401 : result.reason === 'not-found' ? 404 : 403;
    const message =
      result.reason === 'unauthenticated'
        ? 'Bạn chưa đăng nhập.'
        : result.reason === 'not-found'
          ? 'Không tìm thấy bài học.'
          : result.reason === 'revoked'
            ? 'Quyền học khóa này đã bị thu hồi. Vui lòng liên hệ Visfar Academy.'
            : result.reason === 'not-published'
              ? 'Bài học chưa được xuất bản.'
              : 'Bạn chưa ghi danh khóa học này.';
    return NextResponse.json({ ok: false, error: message, reason: result.reason }, { status });
  }
  return NextResponse.json({
    ok: true,
    course: result.course,
    lesson: result.lesson,
    previewOnly: result.reason === 'ok-preview',
    enrollmentStatus: result.enrollmentStatus,
  });
}
