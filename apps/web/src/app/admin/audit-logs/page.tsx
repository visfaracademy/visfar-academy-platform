export const runtime = 'edge';
// /admin/audit-logs — nhat ky thao tac quan tri (Task 09 phan 4/4).
// Server component, chi admin nho layout. Doc that tu audit_logs qua
// fetchAuditLogs(); chua co log thi empty state. Loc theo hanh dong,
// id nguoi thuc hien, tu khoa (hanh dong / doi tuong).
import Link from 'next/link';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { AUDIT_ACTION_LABELS, auditActionLabel, fetchAuditLogs } from '@/lib/crm';

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

/** Tom tat ngan details (jsonb) de hien trong bang — khong in het JSON dai. */
function summarizeDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const parts: string[] = [];
  if (typeof details.reason === 'string') parts.push(`Lý do: ${details.reason}`);
  if (typeof details.previous_status === 'string' || typeof details.new_status === 'string') {
    parts.push(`${details.previous_status ?? '?'} → ${details.new_status ?? '?'}`);
  }
  if (typeof details.amount_vnd === 'number') {
    parts.push(`${details.amount_vnd.toLocaleString('vi-VN')}đ`);
  }
  if (typeof details.channel === 'string') parts.push(`Kênh: ${details.channel}`);
  if (typeof details.role === 'string') parts.push(`Vai trò: ${details.role}`);
  if (typeof details.new_role === 'string') parts.push(`Role mới: ${details.new_role}`);
  if (parts.length > 0) return parts.join(' · ');
  const keys = Object.keys(details);
  return keys.length > 0 ? keys.join(', ') : '—';
}

const ACTION_OPTIONS = Object.keys(AUDIT_ACTION_LABELS).sort();

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; q?: string }>;
}) {
  const params = await searchParams;
  const action = params.action ?? '';
  const actor = params.actor ?? '';
  const q = params.q ?? '';
  const client = await getServerSupabaseClient();
  if (!client) {
    return (
      <>
        <h1 className="gold-title">Nhật ký quản trị</h1>
        <div className="notice error" role="alert">
          <p>Chưa cấu hình Supabase.</p>
        </div>
      </>
    );
  }
  const result = await fetchAuditLogs(client, {
    action: action || undefined,
    actorId: actor || undefined,
    search: q,
    limit: 50,
  });
  return (
    <>
      <h1 className="gold-title">Nhật ký quản trị</h1>
      <p className="muted">
        Mọi thao tác quản trị quan trọng đều ghi lại ở đây: tặng / thu hồi khóa, đổi vai trò, phân
        công giảng viên, xuất bản / ẩn khóa, hoàn trả, chấm bài, cấp / thu hồi chứng chỉ, đổi trạng
        thái lead và ghi tương tác.
      </p>

      <form method="get" className="card" role="search" aria-label="Lọc nhật ký">
        <div className="field">
          <label htmlFor="audit-action">Hành động</label>
          <select id="audit-action" name="action" defaultValue={action}>
            <option value="">Tất cả hành động</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-actor">ID người thực hiện (để trống = tất cả)</label>
          <input id="audit-actor" name="actor" defaultValue={actor} placeholder="UUID của admin" />
        </div>
        <div className="field">
          <label htmlFor="audit-q">Tìm kiếm (hành động / đối tượng)</label>
          <input id="audit-q" name="q" type="search" defaultValue={q} placeholder="Ví dụ: order" />
        </div>
        <button type="submit" className="btn">
          Lọc
        </button>{' '}
        <Link className="btn btn-ghost" href="/admin/audit-logs">
          Xóa lọc
        </Link>
      </form>

      {result.error ? (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được nhật ký quản trị.</strong>
          </p>
          <p>{result.error}</p>
          <p>
            <Link className="btn" href="/admin/audit-logs">
              Tải lại
            </Link>
          </p>
        </div>
      ) : result.logs.length === 0 ? (
        <div className="notice">
          <p>Chưa có thao tác quản trị nào{action || actor || q ? ' khớp với bộ lọc.' : ' được ghi lại.'}</p>
        </div>
      ) : (
        <>
          <p className="muted" role="status">
            Hiển thị {result.logs.length} mục mới nhất.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Người thực hiện</th>
                <th scope="col">Hành động</th>
                <th scope="col">Đối tượng</th>
                <th scope="col">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {result.logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.actorName ?? '—'}</td>
                  <td>{auditActionLabel(log.action)}</td>
                  <td>
                    {log.targetType}
                    <br />
                    <span className="muted">{log.targetId ?? '—'}</span>
                  </td>
                  <td>{summarizeDetails(log.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
