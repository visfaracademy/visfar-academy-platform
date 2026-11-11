// Enrollment cua 1 hoc vien (client): tang khoa + thu hoi quyen hoc.
// Tang khoa dung POST /api/admin/enrollments (grantEnrollment — bat
// buoc granted_by + grant_reason + audit). Thu hoi dung PATCH
// /api/admin/enrollments/[id] (revokeEnrollment + audit).
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { AdminUserEnrollment } from '@/lib/admin-users';
import { enrollmentStatusLabelVi } from '@/lib/dashboard';

export default function AdminUserEnrollments({
  userId,
  enrollments,
  courses,
}: {
  userId: string;
  enrollments: AdminUserEnrollment[];
  courses: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState('');
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
        body: JSON.stringify({ userId, courseId, grantReason: grantReason.trim() }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } =
        await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không tặng được khóa học.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã tặng khóa học cho học viên.');
      setCourseId('');
      setGrantReason('');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(e: FormEvent, enrollmentId: string) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked', reason: revokeReason.trim() }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } =
        await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không thu hồi được quyền học.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã thu hồi quyền học.');
      setRevokeReason('');
      setRevokingId(null);
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="user-enrollments-title" style={{ marginTop: '2rem' }}>
      <h2 id="user-enrollments-title" className="gold-title">Khóa học đã ghi danh</h2>
      {enrollments.length === 0 ? (
        <div className="notice">
          <p>Học viên chưa ghi danh khóa học nào.</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Khóa học</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Tiến độ</th>
              <th scope="col">Ghi danh</th>
              <th scope="col">Thu hồi</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((en) => (
              <tr key={en.enrollmentId}>
                <td>
                  <strong>{en.courseTitle}</strong>
                  <br />
                  <span className="muted">{en.courseSlug}</span>
                  {en.grantReason ? (
                    <>
                      <br />
                      <span className="muted">Lý do tặng: {en.grantReason}</span>
                    </>
                  ) : null}
                </td>
                <td>{enrollmentStatusLabelVi(en.status)}</td>
                <td>
                  {en.completedLessons}/{en.totalLessons} bài · {en.progressPercent}%
                </td>
                <td>
                  {new Date(en.enrolledAt).toLocaleDateString('vi-VN')}
                  {en.completedAt ? (
                    <>
                      <br />
                      <span className="muted">
                        Hoàn thành {new Date(en.completedAt).toLocaleDateString('vi-VN')}
                      </span>
                    </>
                  ) : null}
                </td>
                <td>
                  {en.status === 'active' || en.status === 'completed' ? (
                    revokingId === en.enrollmentId ? (
                      <form onSubmit={(e) => void revoke(e, en.enrollmentId)}>
                        <div className="field">
                          <label htmlFor={`revoke-reason-${en.enrollmentId}`}>
                            Lý do thu hồi (bắt buộc)
                          </label>
                          <input
                            id={`revoke-reason-${en.enrollmentId}`}
                            type="text"
                            value={revokeReason}
                            onChange={(e) => setRevokeReason(e.target.value)}
                            disabled={busy}
                            maxLength={500}
                            placeholder="Ví dụ: Hoàn trả theo yêu cầu"
                          />
                        </div>
                        <button className="btn btn-danger btn-small" type="submit" disabled={busy}>
                          {busy ? 'Đang thu hồi…' : 'Xác nhận thu hồi'}
                        </button>{' '}
                        <button
                          className="btn btn-ghost btn-small"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setRevokingId(null);
                            setRevokeReason('');
                          }}
                        >
                          Hủy
                        </button>
                      </form>
                    ) : (
                      <button
                        className="btn btn-danger btn-small"
                        type="button"
                        disabled={busy}
                        onClick={() => setRevokingId(en.enrollmentId)}
                      >
                        Thu hồi quyền học
                      </button>
                    )
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={grant} className="consult-form" aria-label="Tặng khóa học" style={{ marginTop: '1.5rem' }}>
        <h3>Tặng khóa học</h3>
        <div className="field">
          <label htmlFor="grant-course">Khóa học</label>
          <select
            id="grant-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={busy}
          >
            <option value="">— Chọn khóa học —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="grant-reason">Lý do tặng (bắt buộc)</label>
          <input
            id="grant-reason"
            type="text"
            value={grantReason}
            onChange={(e) => setGrantReason(e.target.value)}
            disabled={busy}
            maxLength={500}
            placeholder="Ví dụ: Tặng học viên đạt giải"
          />
        </div>
        <button className="btn" type="submit" disabled={busy || courseId === ''}>
          {busy ? 'Đang tặng…' : 'Tặng khóa học'}
        </button>
      </form>
      {message ? (
        <div className={`notice form-status ${isError ? 'error' : 'success'}`} role="alert">
          <p>{message}</p>
        </div>
      ) : null}
    </section>
  );
}
