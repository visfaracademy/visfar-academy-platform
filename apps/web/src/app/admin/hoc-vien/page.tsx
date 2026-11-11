export const runtime = 'edge';
// /admin/hoc-vien — danh sach hoc vien (server component, chi admin
// nho layout). Tim kiem (ten/email/SĐT) + loc (role, trang thai tai
// khoan, khoa hoc) qua query string (GET form, chia se duoc link loc).
import Link from 'next/link';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { fetchAdminCourseList } from '@/lib/lms-admin';
import {
  ADMIN_USER_ROLES,
  accountStatusLabelVi,
  listAdminUsers,
  roleLabelVi,
} from '@/lib/admin-users';

function pageHref(
  base: { search: string; role: string; status: string; courseId: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (base.search) params.set('q', base.search);
  if (base.role) params.set('role', base.role);
  if (base.status && base.status !== 'all') params.set('status', base.status);
  if (base.courseId) params.set('courseId', base.courseId);
  params.set('page', String(page));
  return `/admin/hoc-vien?${params.toString()}`;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined): string =>
    Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
  const search = first(sp.q);
  const role = first(sp.role);
  const status = first(sp.status) || 'all';
  const courseId = first(sp.courseId);
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const client = await getServerSupabaseClient();
  if (!client) {
    return (
      <>
        <h1 className="gold-title">Quản lý học viên</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase.</p>
        </div>
      </>
    );
  }
  const [courses, result] = await Promise.all([
    fetchAdminCourseList(client),
    listAdminUsers(client, { search, role, status, courseId, page }),
  ]);
  const filters = { search, role, status, courseId };

  return (
    <>
      <h1 className="gold-title">Quản lý học viên</h1>
      <p className="muted">
        Tìm kiếm theo tên, email hoặc số điện thoại; lọc theo vai trò, trạng thái tài khoản và
        khóa học đã ghi danh. Vô hiệu hóa thay vì xóa tài khoản còn đơn hàng.
      </p>

      <form method="get" action="/admin/hoc-vien" aria-label="Tìm kiếm và lọc học viên">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
          <div className="field">
            <label htmlFor="filter-q">Tìm kiếm (tên / email / SĐT)</label>
            <input id="filter-q" name="q" type="search" defaultValue={search} placeholder="Ví dụ: An Nguyễn" />
          </div>
          <div className="field">
            <label htmlFor="filter-role">Vai trò</label>
            <select id="filter-role" name="role" defaultValue={role}>
              <option value="">Tất cả vai trò</option>
              {ADMIN_USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabelVi(r)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-status">Trạng thái tài khoản</label>
            <select id="filter-status" name="status" defaultValue={status}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="disabled">Đã vô hiệu hóa</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-course">Khóa học đã ghi danh</label>
            <select id="filter-course" name="courseId" defaultValue={courseId}>
              <option value="">Tất cả khóa học</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <button className="btn" type="submit" style={{ width: '100%' }}>
              Lọc
            </button>
          </div>
        </div>
      </form>

      <p className="muted" role="status">
        Tìm thấy {result.total} học viên
        {result.totalPages > 1 ? ` — trang ${result.page}/${result.totalPages}` : ''}.
      </p>

      {result.users.length === 0 ? (
        <div className="notice">
          <p>Không tìm thấy học viên nào phù hợp.</p>
          <p className="muted">Thử đổi từ khóa tìm kiếm hoặc bỏ bớt điều kiện lọc.</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Học viên</th>
              <th scope="col">Vai trò</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Khóa học / Đơn hàng</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {result.users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.fullName}</strong>
                  <br />
                  <span className="muted">{u.email}</span>
                  {u.phone ? (
                    <>
                      <br />
                      <span className="muted">{u.phone}</span>
                    </>
                  ) : null}
                </td>
                <td>{u.roles.map((r) => roleLabelVi(r)).join(', ')}</td>
                <td>
                  {accountStatusLabelVi(u.isDisabled)}
                  {u.isDisabled && u.disabledReason ? (
                    <>
                      <br />
                      <span className="muted">{u.disabledReason}</span>
                    </>
                  ) : null}
                </td>
                <td>
                  {u.enrollmentCount} khóa / {u.orderCount} đơn
                </td>
                <td>
                  <Link className="btn btn-small" href={`/admin/hoc-vien/${u.id}`}>
                    Xem hồ sơ
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Phân trang" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          {result.page > 1 ? (
            <Link className="btn btn-ghost btn-small" href={pageHref(filters, result.page - 1)}>
              ← Trang trước
            </Link>
          ) : null}
          {result.page < result.totalPages ? (
            <Link className="btn btn-ghost btn-small" href={pageHref(filters, result.page + 1)}>
              Trang sau →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
