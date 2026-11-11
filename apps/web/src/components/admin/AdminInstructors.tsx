// Quan ly giang vien cua 1 khoa (client): phan cong giang vien (chi
// nguoi co vai tro instructor), doi vai tro lead/assistant, thu hoi
// phan cong. Chi admin vao duoc trang nay; moi thao tac ghi audit_logs
// o server (xem cac route /api/admin/courses/[id]/instructors/*).
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { CourseInstructorItem, InstructorCandidate } from '@/lib/lms-admin';
import { INSTRUCTOR_ROLE_LABEL } from '@/lib/lms-admin';

export default function AdminInstructors({
  courseId,
  initialInstructors,
  candidates,
}: {
  courseId: string;
  initialInstructors: CourseInstructorItem[];
  candidates: InstructorCandidate[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('assistant');
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const assignedIds = new Set(initialInstructors.map((i) => i.userId));
  const assignable = candidates.filter((c) => !assignedIds.has(c.userId));

  async function assign(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/instructors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không phân công được giảng viên.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã phân công giảng viên cho khóa học.');
      setUserId('');
      setRole('assistant');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(instructor: CourseInstructorItem, newRole: string) {
    if (newRole === instructor.role) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/instructors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: instructor.userId, role: newRole }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không đổi được vai trò giảng viên.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã đổi vai trò giảng viên.');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(instructor: CourseInstructorItem) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/courses/${courseId}/instructors/${encodeURIComponent(instructor.userId)}`,
        { method: 'DELETE' },
      );
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không thu hồi được phân công.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã thu hồi phân công giảng viên.');
      setRevokingUserId(null);
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

      <form onSubmit={assign} className="card">
        <h3>Phân công giảng viên</h3>
        <p className="muted">
          Chỉ phân công được tài khoản đã có vai trò giảng viên. Mỗi khóa chỉ có một giảng viên phụ trách
          chính; trợ giảng có thể có nhiều người.
        </p>
        {candidates.length === 0 ? (
          <div className="notice">
            <p>Chưa có tài khoản nào mang vai trò giảng viên.</p>
          </div>
        ) : assignable.length === 0 ? (
          <div className="notice">
            <p>Tất cả giảng viên đã được phân công cho khóa này.</p>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="assign-instructor">Giảng viên</label>
              <select
                id="assign-instructor"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              >
                <option value="">— Chọn giảng viên —</option>
                {assignable.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.fullName ?? '(Chưa có tên)'}
                    {c.email ? ` — ${c.email}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="assign-role">Vai trò</label>
              <select id="assign-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="assistant">Trợ giảng</option>
                <option value="lead">Phụ trách chính</option>
              </select>
            </div>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Đang phân công…' : 'Phân công giảng viên'}
            </button>
          </>
        )}
      </form>

      {initialInstructors.length === 0 ? (
        <div className="notice" style={{ marginTop: '1rem' }}>
          <p>Khóa học chưa có giảng viên phụ trách.</p>
        </div>
      ) : (
        <table className="admin-table" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th scope="col">Giảng viên</th>
              <th scope="col">Vai trò</th>
              <th scope="col">Phân công ngày</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {initialInstructors.map((ins) => (
              <tr key={ins.assignmentId}>
                <td>
                  <strong>{ins.fullName ?? '(Chưa có tên)'}</strong>
                  <br />
                  <span className="muted">{ins.email ?? ''}</span>
                </td>
                <td>
                  <select
                    aria-label={`Vai trò của ${ins.fullName ?? ins.email ?? ins.userId}`}
                    value={ins.role}
                    disabled={busy}
                    onChange={(e) => void changeRole(ins, e.target.value)}
                  >
                    <option value="assistant">{INSTRUCTOR_ROLE_LABEL.assistant}</option>
                    <option value="lead">{INSTRUCTOR_ROLE_LABEL.lead}</option>
                  </select>
                </td>
                <td>{new Date(ins.assignedAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  {revokingUserId === ins.userId ? (
                    <span>
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        disabled={busy}
                        onClick={() => void revoke(ins)}
                      >
                        Xác nhận thu hồi
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        disabled={busy}
                        onClick={() => setRevokingUserId(null)}
                      >
                        Hủy
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      disabled={busy}
                      onClick={() => setRevokingUserId(ins.userId)}
                    >
                      Thu hồi phân công
                    </button>
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
