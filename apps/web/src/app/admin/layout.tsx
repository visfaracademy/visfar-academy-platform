// Layout /admin/* — lop chan server (lop 2 sau middleware).
// Middleware chi kiem tra phien con han; o day requireAdmin() doc role
// that tu DB (user_roles + profiles.role) — khong phai admin thi thay
// trang 403, khong thay bat ky du lieu quan tri nao.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/lms-access';
import { getServerSupabaseClient } from '@/lib/supabase-server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const client = await getServerSupabaseClient();
  if (!client) {
    redirect('/dang-nhap?next=/admin');
  }
  const admin = await requireAdmin(client);
  if (!admin.ok) {
    if (admin.reason === 'unauthenticated') {
      redirect('/dang-nhap?next=/admin');
    }
    return (
      <div className="wrap">
        <h1 className="gold-title">Không có quyền truy cập</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Khu vực này chỉ dành cho quản trị viên.</strong>
          </p>
          <p>Bạn đang đăng nhập bằng tài khoản không có quyền quản trị.</p>
          <p>
            <Link className="btn" href="/hoc-vien">
              Về trang học viên
            </Link>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap">
      <nav className="admin-nav" aria-label="Quản trị">
        <Link href="/admin">Tổng quan</Link>
        <Link href="/admin/khoa-hoc">Khóa học</Link>
        <Link href="/admin/thu-vien">Thư viện</Link>
        <Link href="/admin/cong-dong">Cộng đồng</Link>
        <Link href="/admin/hoc-vien">Học viên</Link>
        <Link href="/admin/don-hang">Đơn hàng</Link>
        <Link href="/admin/lich-hen">Lịch hẹn</Link>
        <Link href="/admin/ma-giam-gia">Mã giảm giá</Link>
        <Link href="/admin/goi-thanh-vien">Gói thành viên</Link>
        <Link href="/admin/crm">CRM</Link>
        <Link href="/admin/audit-logs">Nhật ký quản trị</Link>
        <span className="muted"> · Quản trị viên</span>
      </nav>
      {children}
    </div>
  );
}
