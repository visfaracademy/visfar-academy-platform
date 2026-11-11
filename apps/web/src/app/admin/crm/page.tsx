export const runtime = 'edge';
// /admin/crm — danh sach lead + phan loai CRM (Task 09 phan 4/4).
// Server component, chi admin nho layout. Doc that tu Supabase qua
// fetchCrmLeads(); chua co lead thi empty state, khong bia du lieu.
// Loc: trang thai goc (new/contacted/enrolled/closed/spam), nhom CRM
// (8 nhom suy ra tu don/ghi danh), tim kiem ten/SDT/email/ma.
import Link from 'next/link';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import {
  CRM_CATEGORIES,
  CRM_CATEGORY_LABELS,
  CRM_FETCH_CAP,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  fetchCrmLeads,
} from '@/lib/crm';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function AdminCrmPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? '';
  const category = params.category ?? '';
  const q = params.q ?? '';
  const client = await getServerSupabaseClient();
  if (!client) {
    return (
      <>
        <h1 className="gold-title">CRM — Quản lý lead</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase.</p>
        </div>
      </>
    );
  }
  const result = await fetchCrmLeads(client, { status, category, search: q });
  return (
    <>
      <h1 className="gold-title">CRM — Quản lý lead</h1>
      <p className="muted">
        Lead từ form tư vấn (API ghi DB trước, rồi ghi Sheet đối soát). Phân loại CRM suy ra từ
        trạng thái lead + đơn hàng / ghi danh thật của cùng người (khớp email, rồi số điện thoại).
      </p>

      <form method="get" className="card" role="search" aria-label="Lọc lead">
        <div className="field">
          <label htmlFor="crm-q">Tìm kiếm (tên / SĐT / email / mã tham chiếu)</label>
          <input id="crm-q" name="q" type="search" defaultValue={q} placeholder="Ví dụ: 0901234567" />
        </div>
        <div className="field">
          <label htmlFor="crm-status">Trạng thái lead</label>
          <select id="crm-status" name="status" defaultValue={status}>
            <option value="">Tất cả trạng thái</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="crm-category">Phân loại CRM</label>
          <select id="crm-category" name="category" defaultValue={category}>
            <option value="">Tất cả phân loại</option>
            {CRM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CRM_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn">
          Lọc
        </button>{' '}
        <Link className="btn btn-ghost" href="/admin/crm">
          Xóa lọc
        </Link>
      </form>

      {result.error ? (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được danh sách lead.</strong>
          </p>
          <p>{result.error}</p>
          <p>
            <Link className="btn" href="/admin/crm">
              Tải lại
            </Link>
          </p>
        </div>
      ) : result.leads.length === 0 ? (
        <div className="notice">
          <p>Chưa có lead nào{status || category || q ? ' khớp với bộ lọc.' : '.'}</p>
          {!status && !category && !q && (
            <p className="muted">Lead mới từ form tư vấn sẽ hiện ở đây sau khi có người đăng ký.</p>
          )}
        </div>
      ) : (
        <>
          <p className="muted" role="status">
            Hiển thị {result.leads.length} lead
            {result.truncated ? ` (chỉ xét ${CRM_FETCH_CAP} lead mới nhất — hãy thu hẹp bộ lọc)` : ''}.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Họ tên</th>
                <th scope="col">Liên hệ</th>
                <th scope="col">Quan tâm</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Phân loại</th>
                <th scope="col">Ngày đăng ký</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {result.leads.map(({ lead, category: cat }) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.full_name}</strong>
                    <br />
                    <span className="muted">{lead.reference_code}</span>
                  </td>
                  <td>
                    {lead.phone}
                    <br />
                    <span className="muted">{lead.email}</span>
                  </td>
                  <td>{lead.courseTitle ?? lead.course_interest_text ?? '—'}</td>
                  <td>{LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}</td>
                  <td>{CRM_CATEGORY_LABELS[cat]}</td>
                  <td>{formatDate(lead.created_at)}</td>
                  <td>
                    <Link className="btn btn-small" href={`/admin/crm/${lead.id}`}>
                      Hồ sơ
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
