export const runtime = 'edge';
// /admin/khoa-hoc/[courseId] — chi tiet khoa: sua thong tin, cay chuong
// -> bai -> tai lieu (len/xuong, xuat ban, xem thu), quan ly enrollment
// (tang khoa / thu hoi quyen hoc). Du lieu lay bang server client.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { fetchAdminCourseTree, listCourseEnrollments, listCourseInstructors, listInstructorCandidates } from '@/lib/lms-admin';
import CourseEditForm from '@/components/admin/CourseEditForm';
import AdminContentTree from '@/components/admin/AdminContentTree';
import AdminEnrollments from '@/components/admin/AdminEnrollments';
import AdminInstructors from '@/components/admin/AdminInstructors';

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const client = await getServerSupabaseClient();
  if (!client) {
    return (
      <>
        <h1 className="gold-title">Quản lý khóa học</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase.</p>
        </div>
      </>
    );
  }
  const tree = await fetchAdminCourseTree(client, courseId);
  if (!tree.course) notFound();
  const enrollments = await listCourseEnrollments(client, courseId);
  const instructors = await listCourseInstructors(client, courseId);
  const instructorCandidates = await listInstructorCandidates(client);
  const course = tree.course as {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    pillar: string | null;
    price_vnd: number;
    display_order: number;
    status: string;
  };

  return (
    <>
      <p>
        <Link href="/admin/khoa-hoc">← Tất cả khóa học</Link>
      </p>
      <h1 className="gold-title">{course.title}</h1>
      <p className="muted">
        Slug: {course.slug} · Trạng thái: <strong>{course.status}</strong> · Giá:{' '}
        {course.price_vnd.toLocaleString('vi-VN')} VNĐ
      </p>

      <section aria-labelledby="info-title">
        <h2 id="info-title" className="gold-title">Thông tin khóa học</h2>
        <CourseEditForm course={course} />
      </section>

      <section aria-labelledby="content-title" style={{ marginTop: '2rem' }}>
        <h2 id="content-title" className="gold-title">Chương · Bài học · Tài liệu</h2>
        <p className="muted">
          Dùng nút ↑ ↓ để đổi thứ tự (lưu display_order). Bài chưa xuất bản thì học viên không xem được,
          kể cả đã ghi danh.
        </p>
        <AdminContentTree courseId={course.id} modules={tree.modules} />
      </section>

      <section aria-labelledby="instructors-title" style={{ marginTop: '2rem' }}>
        <h2 id="instructors-title" className="gold-title">Giảng viên phụ trách ({instructors.length})</h2>
        <AdminInstructors courseId={course.id} initialInstructors={instructors} candidates={instructorCandidates} />
      </section>

      <section aria-labelledby="enroll-title" style={{ marginTop: '2rem' }}>
        <h2 id="enroll-title" className="gold-title">Học viên ({enrollments.length})</h2>
        <AdminEnrollments courseId={course.id} initialEnrollments={enrollments} />
      </section>
    </>
  );
}
