// Thao tac admin tren 1 tai khoan (client): doi role + vo hieu hoa /
// mo lai. Goi PATCH /api/admin/users/[id] (chi admin, sau
// requireAdmin). Moi thao tac ghi audit_logs o server.
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ADMIN_USER_ROLES, accountStatusLabelVi, roleLabelVi } from '@/lib/admin-users';

export default function AdminUserActions({
  userId,
  primaryRole,
  roles,
  isDisabled,
  isSelf,
}: {
  userId: string;
  primaryRole: string;
  roles: string[];
  isDisabled: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(primaryRole);
  const [roleReason, setRoleReason] = useState('');
  const [disableReason, setDisableReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function callPatch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } =
        await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không thực hiện được thao tác.');
        return false;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã lưu thay đổi.');
      return true;
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(e: FormEvent) {
    e.preventDefault();
    const ok = await callPatch({ action: 'change-role', role, reason: roleReason.trim() });
    if (ok) {
      setRoleReason('');
      router.refresh();
    }
  }

  async function toggleDisabled(e: FormEvent) {
    e.preventDefault();
    const ok = await callPatch({
      action: isDisabled ? 'enable' : 'disable',
      reason: disableReason.trim(),
    });
    if (ok) {
      setDisableReason('');
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="user-actions-title" style={{ marginTop: '2rem' }}>
      <h2 id="user-actions-title" className="gold-title">Thao tác quản trị</h2>
      <p className="muted">
        Vai trò hiện tại: <strong>{roles.map((r) => roleLabelVi(r)).join(', ')}</strong> · Trạng
        thái: <strong>{accountStatusLabelVi(isDisabled)}</strong>
      </p>
      {isSelf ? (
        <div className="notice">
          <p>
            Đây là tài khoản của bạn — không thể tự đổi role của chính mình hay tự vô hiệu hóa
            tài khoản của mình.
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={changeRole} className="consult-form" aria-label="Đổi vai trò">
            <div className="field">
              <label htmlFor="role-select">Vai trò mới</label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={busy}
              >
                {ADMIN_USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabelVi(r)}
                  </option>
                ))}
              </select>
              <p className="hint">
                Đổi qua user_roles (nguồn sự thật duy nhất); hồ sơ tự đồng bộ theo. Học viên
                không tự đổi được role của mình.
              </p>
            </div>
            <div className="field">
              <label htmlFor="role-reason">Lý do (không bắt buộc)</label>
              <input
                id="role-reason"
                type="text"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                disabled={busy}
                maxLength={500}
                placeholder="Ví dụ: Mời làm giảng viên khóa mới"
              />
            </div>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Đổi vai trò'}
            </button>
          </form>

          <form
            onSubmit={toggleDisabled}
            className="consult-form"
            aria-label={isDisabled ? 'Mở lại tài khoản' : 'Vô hiệu hóa tài khoản'}
            style={{ marginTop: '1.5rem' }}
          >
            <div className="field">
              <label htmlFor="disable-reason">
                Lý do {isDisabled ? 'mở lại' : 'vô hiệu hóa'} tài khoản (bắt buộc)
              </label>
              <input
                id="disable-reason"
                type="text"
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                disabled={busy}
                maxLength={500}
                placeholder={
                  isDisabled
                    ? 'Ví dụ: Khiếu nại được chấp nhận'
                    : 'Ví dụ: Vi phạm quy định cộng đồng'
                }
              />
              <p className="hint">
                Không xóa tài khoản — đơn hàng và khóa học đã ghi danh được giữ nguyên.
              </p>
            </div>
            <button
              className={isDisabled ? 'btn' : 'btn btn-danger'}
              type="submit"
              disabled={busy}
            >
              {busy ? 'Đang lưu…' : isDisabled ? 'Mở lại tài khoản' : 'Vô hiệu hóa tài khoản'}
            </button>
          </form>
        </>
      )}
      {message ? (
        <div className={`notice form-status ${isError ? 'error' : 'success'}`} role="alert">
          <p>{message}</p>
        </div>
      ) : null}
    </section>
  );
}
