export const runtime = 'edge';
// /admin/khoa-hoc — danh sach khoa hoc (server component, chi admin
// nho layout). Hien ca draft/archived + so chuong/bai; tao khoa moi
// bang form ben duoi (goi POST /api/admin/courses).
import Link from 'next/link';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { fetchAdminCourseList } from '@/lib/lms-admin';
import CourseCreateForm from '@/components/admin/CourseCreateForm';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
};

export default async function AdminCoursesPage() {
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
  const courses = await fetchAdminCourseList(client);
  return (
    <>
      <h1 className="gold-title">Quản lý khóa học</h1>
      <p className="muted">
        Tạo khóa, đổi trạng thái xuất bản (nháp / đã xuất bản / lưu trữ), quản lý chương, bài học và tài liệu.
        Mọi thao tác đều ghi lại vào nhật ký quản trị (audit_logs).
      </p>

      {courses.length === 0 ? (
        <div className="notice">
          <p>Chưa có khóa học nào.</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Khóa học</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Giá (VNĐ)</th>
              <th scope="col">Chương / Bài</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.title}</strong>
                  <br />
                  <span className="muted">{c.slug}</span>
                </td>
                <td>{STATUS_LABEL[c.status] ?? c.status}</td>
                <td>{c.price_vnd.toLocaleString('vi-VN')}</td>
                <td>
                  {c.moduleCount} chương / {c.lessonCount} bài
                </td>
                <td>
                  <Link className="btn btn-small" href={`/admin/khoa-hoc/${c.id}`}>
                    Quản lý
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section aria-labelledby="create-title" style={{ marginTop: '2rem' }}>
        <h2 id="create-title" className="gold-title">Tạo khóa học mới</h2>
        <CourseCreateForm />
      </section>
    </>
  );
}
