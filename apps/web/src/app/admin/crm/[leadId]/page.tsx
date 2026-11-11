export const runtime = 'edge';
// /admin/crm/[leadId] — ho so chi tiet 1 lead (Task 09 phan 4/4).
// Server component, chi admin nho layout. Hien: thong tin lead,
// phan loai CRM, doi trang thai (form client), lich su tuong tac
// (form ghi moi), ghi danh / don hang that cua cung nguoi, audit
// lien quan toi lead nay. Chua co tuong tac thi empty state.
import Link from 'next/link';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import {
  CRM_CATEGORY_LABELS,
  INTERACTION_CHANNEL_LABELS,
  INTERACTION_OUTCOME_LABELS,
  LEAD_STATUS_LABELS,
  fetchLeadDetail,
} from '@/lib/crm';
import LeadStatusForm from '@/components/admin/LeadStatusForm';
import LeadInteractionForm from '@/components/admin/LeadInteractionForm';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const client = await getServerSupabaseClient();
  if (!client) {
    return (
      <>
        <h1 className="gold-title">Hồ sơ lead</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase.</p>
        </div>
      </>
    );
  }
  const { detail, error } = await fetchLeadDetail(client, leadId);
  if (!detail) {
    return (
      <>
        <h1 className="gold-title">Hồ sơ lead</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được hồ sơ lead.</strong>
          </p>
          <p>{error ?? 'Không tìm thấy lead.'}</p>
          <p>
            <Link className="btn" href="/admin/crm">
              Về danh sách lead
            </Link>
          </p>
        </div>
      </>
    );
  }
  const { lead, interactions, profile, enrollments, orders, auditTrail, category } = detail;
  return (
    <>
      <p>
        <Link href="/admin/crm">← Về danh sách lead</Link>
      </p>
      <h1 className="gold-title">{lead.full_name}</h1>
      <p className="muted">
        Mã tham chiếu: {lead.reference_code} · Nguồn: {lead.source} · Đăng ký:{' '}
        {formatDateTime(lead.created_at)}
      </p>

      <div className="card">
        <p>
          <strong>Phân loại CRM:</strong> {CRM_CATEGORY_LABELS[category]}
        </p>
        <p>
          <strong>Trạng thái:</strong>{' '}
          {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
        </p>
        <p>
          <strong>Điện thoại:</strong> {lead.phone}
        </p>
        <p>
          <strong>Email:</strong> {lead.email}
        </p>
        <p>
          <strong>Tỉnh / thành:</strong> {lead.province}
        </p>
        <p>
          <strong>Khóa quan tâm:</strong> {lead.courseTitle ?? lead.course_interest_text ?? '—'}
        </p>
        {lead.notes ? (
          <p>
            <strong>Ghi chú:</strong> {lead.notes}
          </p>
        ) : null}
        {profile ? (
          <p>
            <strong>Tài khoản đã đăng ký:</strong> {profile.fullName ?? profile.email ?? profile.id}
          </p>
        ) : (
          <p className="muted">Người này chưa có tài khoản học viên (chỉ có lead).</p>
        )}
      </div>

      <h2 className="gold-title">Đổi trạng thái lead</h2>
      <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />

      <h2 className="gold-title">Lịch sử tương tác</h2>
      {detail.interactionsError ? (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa đọc được lịch sử tương tác.</strong>
          </p>
          <p>{detail.interactionsError}</p>
          <p className="muted">
            Có thể bảng lead_interactions chưa được tạo — cần chạy migration 0017 (đang chờ duyệt)
            rồi tải lại trang.
          </p>
        </div>
      ) : interactions.length === 0 ? (
        <div className="notice">
          <p>Chưa có tương tác nào với lead này.</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Thời gian</th>
              <th scope="col">Kênh</th>
              <th scope="col">Nội dung</th>
              <th scope="col">Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {interactions.map((it) => (
              <tr key={it.id}>
                <td>{formatDateTime(it.createdAt)}</td>
                <td>{INTERACTION_CHANNEL_LABELS[it.channel as keyof typeof INTERACTION_CHANNEL_LABELS] ?? it.channel}</td>
                <td>{it.content}</td>
                <td>
                  {it.outcome
                    ? (INTERACTION_OUTCOME_LABELS[it.outcome as keyof typeof INTERACTION_OUTCOME_LABELS] ?? it.outcome)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Ghi tương tác mới</h3>
      <LeadInteractionForm leadId={lead.id} />

      <h2 className="gold-title">Ghi danh &amp; đơn hàng</h2>
      {enrollments.length === 0 && orders.length === 0 ? (
        <div className="notice">
          <p>Người này chưa có ghi danh hay đơn hàng nào.</p>
        </div>
      ) : (
        <>
          {enrollments.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Khóa học</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ghi danh</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td>{e.courseTitle ?? e.courseId}</td>
                    <td>{e.status}</td>
                    <td>{formatDateTime(e.enrolledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {orders.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Đơn hàng</th>
                  <th scope="col">Số tiền (VNĐ)</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ngày đặt</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.referenceCode}</td>
                    <td>{o.amountVnd.toLocaleString('vi-VN')}</td>
                    <td>{o.status}</td>
                    <td>{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <h2 className="gold-title">Lịch sử quản trị liên quan</h2>
      {auditTrail.length === 0 ? (
        <div className="notice">
          <p>Chưa có thao tác quản trị nào ghi trên lead này.</p>
        </div>
      ) : (
        <ul>
          {auditTrail.map((log) => (
            <li key={log.id}>
              {formatDateTime(log.createdAt)} — {log.action} — {log.actorName ?? '—'}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
