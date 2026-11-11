// Quan ly enrollment cua 1 khoa (client): tang khoa cho hoc vien
// (can userId + ly do) va thu hoi quyen hoc (can ly do). Moi thao tac
// ghi audit_logs o server.
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { CourseEnrollmentItem } from '@/lib/lms-admin';

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang học',
  completed: 'Đã hoàn thành',
  revoked: 'Đã thu hồi',
};

export default function AdminEnrollments({
  courseId,
  initialEnrollments,
}: {
  courseId: string;
  initialEnrollments: CourseEnrollmentItem[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function grant(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.trim(), courseId, grantReason: grantReason.trim() }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không tặng được khóa học.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã tặng khóa học cho học viên.');
      setUserId('');
      setGrantReason('');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(enrollmentId: string) {
    if (!revokeReason.trim()) {
      setIsError(true);
      setMessage('Vui lòng nhập lý do thu hồi trước khi thu hồi quyền học.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked', reason: revokeReason.trim() }),
      });
      const data: {
        ok?: boolean;
        error?: string;
        auditWarning?: string | null;
        certificatesWarning?: string | null;
      } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không thu hồi được quyền học.');
        return;
      }
      setIsError(false);
      setMessage(
        data.auditWarning ?? data.certificatesWarning ?? 'Đã thu hồi quyền học. Học viên mất quyền xem bài ngay lập tức.',
      );
      setRevokingId(null);
      setRevokeReason('');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <p className={isError ? 'field-error' : 'muted'} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}

      <form onSubmit={grant} className="card">
        <h3>Tặng khóa học</h3>
        <p className="muted">
          Nhập ID tài khoản học viên (UUID trong hồ sơ) và lý do tặng. Enrollment được tạo không qua đơn hàng,
          ghi rõ người tặng và lý do vào audit log.
        </p>
        <div className="field">
          <label htmlFor="grant-user-id">ID học viên (UUID)</label>
          <input
            id="grant-user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </div>
        <div className="field">
          <label htmlFor="grant-reason">Lý do tặng (bắt buộc)</label>
          <input
            id="grant-reason"
            value={grantReason}
            onChange={(e) => setGrantReason(e.target.value)}
            required
            maxLength={500}
            placeholder="Ví dụ: Tặng học viên đạt giải chương trình tháng 11"
          />
        </div>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Đang tặng…' : 'Tặng khóa học'}
        </button>
      </form>

      {initialEnrollments.length === 0 ? (
        <div className="notice" style={{ marginTop: '1rem' }}>
          <p>Chưa có học viên nào ghi danh khóa này.</p>
        </div>
      ) : (
        <table className="admin-table" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th scope="col">Học viên</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Ghi danh ngày</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {initialEnrollments.map((en) => (
              <tr key={en.enrollmentId}>
                <td>
                  <strong>{en.fullName ?? '(Chưa có tên)'}</strong>
                  <br />
                  <span className="muted">
                    {en.email ?? ''} {en.phone ? `· ${en.phone}` : ''}
                  </span>
                  {en.grantReason && (
                    <>
                      <br />
                      <span className="muted">Lý do tặng: {en.grantReason}</span>
                    </>
                  )}
                </td>
                <td>{STATUS_LABEL[en.status] ?? en.status}</td>
                <td>{new Date(en.enrolledAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  {en.status !== 'revoked' && (
                    <>
                      {revokingId === en.enrollmentId ? (
                        <span>
                          <input
                            aria-label="Lý do thu hồi"
                            value={revokeReason}
                            onChange={(e) => setRevokeReason(e.target.value)}
                            placeholder="Lý do thu hồi (bắt buộc)"
                            maxLength={500}
                            style={{ minWidth: '12rem' }}
                          />{' '}
                          <button
                            type="button"
                            className="btn btn-small btn-danger"
                            disabled={busy}
                            onClick={() => void revoke(en.enrollmentId)}
                          >
                            Xác nhận thu hồi
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-small btn-ghost"
                            disabled={busy}
                            onClick={() => {
                              setRevokingId(null);
                              setRevokeReason('');
                            }}
                          >
                            Hủy
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          disabled={busy}
                          onClick={() => setRevokingId(en.enrollmentId)}
                        >
                          Thu hồi quyền học
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
