export const runtime = 'edge';
// /admin — Tong quan quan tri (Task 09 phan 1/4).
// Server component, chi admin nho layout (requireAdmin). Moi so doc
// that tu Supabase qua getAdminDashboardStats(); chua co du lieu thi
// hien 0 / empty state, khong bia so lieu. Dung class san co
// (.stat-grid, .stat-card, .admin-table, .notice) — khong doi mau /
// font / anh.
import Link from 'next/link';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { formatVnd, getAdminDashboardStats } from '@/lib/admin-dashboard';
import { enrollmentStatusLabelVi } from '@/lib/dashboard';

export default async function AdminDashboardPage() {
  const client = await getServerSupabaseClient();
  if (!client) {
    return (
      <>
        <h1 className="gold-title">Tổng quan quản trị</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase.</p>
        </div>
      </>
    );
  }
  const state = await getAdminDashboardStats(client);
  if (state.status === 'error') {
    return (
      <>
        <h1 className="gold-title">Tổng quan quản trị</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được dữ liệu tổng quan.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <Link className="btn" href="/admin">
              Tải lại
            </Link>
          </p>
        </div>
      </>
    );
  }
  if (state.status !== 'success') {
    // Khong xay ra o thuc te (layout da requireAdmin + client da co),
    // nhung xu ly ro thay vi crash khi kieu du lieu doi.
    return (
      <>
        <h1 className="gold-title">Tổng quan quản trị</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase hoặc phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p>
        </div>
      </>
    );
  }
  const data = state.data;
  const stats = [
    { label: 'Tổng học viên', value: data.totalStudents.toLocaleString('vi-VN'), hint: `${data.newStudents} mới trong 30 ngày qua` },
    { label: 'Học viên hoạt động', value: data.activeStudents.toLocaleString('vi-VN'), hint: 'Có tiến độ học trong 30 ngày qua' },
    { label: 'Tổng khóa học', value: data.totalCourses.toLocaleString('vi-VN'), hint: `${data.publishedCourses} khóa đã xuất bản` },
    { label: 'Đăng ký khóa học', value: data.totalEnrollments.toLocaleString('vi-VN'), hint: `${data.activeEnrollments} đang học` },
    { label: 'Doanh thu', value: formatVnd(data.totalRevenueVnd), hint: data.revenueSource === 'payments' ? 'Từ thanh toán đã thành công' : data.revenueSource === 'orders' ? 'Từ đơn hàng đã thanh toán' : 'Chưa có doanh thu' },
    { label: 'Đơn hàng', value: data.totalOrders.toLocaleString('vi-VN'), hint: `${data.paidOrders} đơn đã thanh toán` },
    { label: 'Tỷ lệ hoàn thành', value: `${data.completionRate}%`, hint: `${data.completedLessons}/${data.totalLessonsToLearn} bài đã hoàn thành` },
    { label: 'Học viên mới', value: data.newStudents.toLocaleString('vi-VN'), hint: 'Đăng ký trong 30 ngày qua' },
  ];
  const isEmpty =
    data.totalStudents === 0 &&
    data.totalCourses === 0 &&
    data.totalEnrollments === 0 &&
    data.totalOrders === 0;

  return (
    <>
      <h1 className="gold-title">Tổng quan quản trị</h1>
      <p className="muted">
        Số liệu tổng hợp từ Supabase — cập nhật theo dữ liệu thật, không dùng số liệu mẫu.
      </p>

      {data.revenueWarning ? (
        <div className="notice" role="status">
          <p>{data.revenueWarning}</p>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="notice" role="status">
          <p>
            <strong>Chưa có dữ liệu.</strong>
          </p>
          <p>
            Chưa có học viên, khóa học, đơn hàng hay đăng ký nào. Khi có dữ liệu thật, các số liệu bên dưới
            sẽ tự cập nhật.
          </p>
        </div>
      ) : null}

      <section aria-label="Số liệu tổng quan">
        <div className="stat-grid">
          {stats.map((s) => (
            <div className="stat-card" key={s.label}>
              <p className="stat-num">{s.value}</p>
              <p>
                <strong>{s.label}</strong>
              </p>
              <p className="muted">{s.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="courses-title" style={{ marginTop: '2rem' }}>
        <h2 id="courses-title" className="gold-title">Tiến độ theo khóa học</h2>
        {data.courses.length === 0 ? (
          <div className="notice" role="status">
            <p>Chưa có khóa học nào.</p>
            <p>
              <Link className="btn btn-small" href="/admin/khoa-hoc">
                Quản lý khóa học
              </Link>
            </p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Khóa học</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Bài học</th>
                <th scope="col">Đăng ký</th>
                <th scope="col">Hoàn thành</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c) => (
                <tr key={c.courseId}>
                  <td>
                    <strong>{c.courseTitle}</strong>
                    <br />
                    <span className="muted">{c.courseSlug}</span>
                  </td>
                  <td>{c.status === 'published' ? 'Đã xuất bản' : c.status === 'draft' ? 'Nháp' : 'Đã lưu trữ'}</td>
                  <td>{c.totalLessons} bài</td>
                  <td>
                    {c.enrollmentCount} lượt ({c.activeEnrollmentCount} đang học)
                  </td>
                  <td>{c.completionRate}%</td>
                  <td>
                    <Link className="btn btn-small" href={`/admin/khoa-hoc/${c.courseId}`}>
                      Quản lý
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="recent-title" style={{ marginTop: '2rem' }}>
        <h2 id="recent-title" className="gold-title">Đăng ký gần đây</h2>
        {data.recentEnrollments.length === 0 ? (
          <div className="notice" role="status">
            <p>Chưa có lượt đăng ký khóa học nào.</p>
          </div>
        ) : (
          <ul className="dashboard-list">
            {data.recentEnrollments.map((e) => (
              <li className="list-row" key={e.enrollmentId}>
                <p>
                  <strong>{e.studentName ?? e.studentEmail ?? '(Chưa có tên)'}</strong>{' '}
                  <span className="muted">— {e.courseTitle}</span>
                </p>
                <p className="muted">
                  {enrollmentStatusLabelVi(e.status)} ·{' '}
                  {new Date(e.enrolledAt).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
