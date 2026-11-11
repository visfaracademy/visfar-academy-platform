export const runtime = 'edge';
// /admin/hoc-vien/[id] — chi tiet hoc vien: ho so, trang thai tai
// khoan, khoa hoc da ghi danh kem tien do, lich su don hang; thao tac
// doi role / vo hieu hoa / mo lai, tang khoa / thu hoi quyen hoc.
// Du lieu lay bang server client (chi admin nho layout).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSupabaseClient, getServerUser } from '@/lib/supabase-server';
import { fetchAdminCourseList } from '@/lib/lms-admin';
import { accountStatusLabelVi, fetchAdminUserDetail, roleLabelVi } from '@/lib/admin-users';
import { formatVnd, orderStatusLabelVi } from '@/lib/dashboard';
import AdminUserActions from '@/components/admin/AdminUserActions';
import AdminUserEnrollments from '@/components/admin/AdminUserEnrollments';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getServerSupabaseClient();
  if (!client) {
    return (
      <>
        <h1 className="gold-title">Hồ sơ học viên</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase.</p>
        </div>
      </>
    );
  }
  const [detail, courses, me] = await Promise.all([
    fetchAdminUserDetail(client, id),
    fetchAdminCourseList(client),
    getServerUser(client),
  ]);
  if (!detail) notFound();

  return (
    <>
      <p>
        <Link href="/admin/hoc-vien">← Tất cả học viên</Link>
      </p>
      <h1 className="gold-title">{detail.fullName}</h1>
      <p className="muted">{detail.email}</p>

      <section className="card" aria-labelledby="profile-title">
        <h2 id="profile-title" className="gold-title">Hồ sơ</h2>
        <p>
          <strong>Họ và tên:</strong> {detail.fullName}
          <br />
          <strong>Email:</strong> {detail.email}
          <br />
          <strong>Số điện thoại:</strong> {detail.phone ?? '—'}
          <br />
          <strong>Tỉnh / thành:</strong> {detail.province ?? '—'}
          <br />
          <strong>Vai trò:</strong> {detail.roles.map((r) => roleLabelVi(r)).join(', ')}
          <br />
          <strong>Trạng thái tài khoản:</strong> {accountStatusLabelVi(detail.isDisabled)}
          {detail.isDisabled ? (
            <>
              <br />
              <strong>Lý do vô hiệu hóa:</strong> {detail.disabledReason ?? '—'}
              {detail.disabledAt ? (
                <>
                  <br />
                  <strong>Thời điểm:</strong>{' '}
                  {new Date(detail.disabledAt).toLocaleString('vi-VN')}
                </>
              ) : null}
            </>
          ) : null}
          <br />
          <strong>Ngày tạo tài khoản:</strong>{' '}
          {new Date(detail.createdAt).toLocaleDateString('vi-VN')}
        </p>
      </section>

      <AdminUserActions
        userId={detail.id}
        primaryRole={detail.primaryRole}
        roles={detail.roles}
        isDisabled={detail.isDisabled}
        isSelf={me?.id === detail.id}
      />

      <AdminUserEnrollments
        userId={detail.id}
        enrollments={detail.enrollments}
        courses={courses.map((c) => ({ id: c.id, title: c.title }))}
      />

      <section aria-labelledby="user-orders-title" style={{ marginTop: '2rem' }}>
        <h2 id="user-orders-title" className="gold-title">Lịch sử đơn hàng</h2>
        {detail.orders.length === 0 ? (
          <div className="notice">
            <p>Học viên chưa có đơn hàng nào.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Mã đơn</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Số tiền</th>
                <th scope="col">Ngày tạo</th>
                <th scope="col">Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {detail.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.referenceCode}</strong>
                    {o.paymentMethod ? (
                      <>
                        <br />
                        <span className="muted">{o.paymentMethod}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{orderStatusLabelVi(o.status)}</td>
                  <td>{formatVnd(o.amountVnd)}</td>
                  <td>
                    {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                    {o.paidAt ? (
                      <>
                        <br />
                        <span className="muted">
                          Đã trả {new Date(o.paidAt).toLocaleDateString('vi-VN')}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {o.items.length === 0
                      ? '—'
                      : o.items.map((it) => `${it.itemName} × ${it.quantity}`).join('; ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
