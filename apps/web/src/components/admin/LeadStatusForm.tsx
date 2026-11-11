// Form doi trang thai lead (client) — goi PATCH /api/admin/leads/[id]/status.
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/lib/crm';

export default function LeadStatusForm({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không đổi được trạng thái lead.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã đổi trạng thái lead.');
      setNote('');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="field">
        <label htmlFor="lead-status">Trạng thái mới</label>
        <select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="lead-status-note">Ghi chú (không bắt buộc, lưu vào audit log)</label>
        <input
          id="lead-status-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Ví dụ: Đã gọi, học viên hẹn tuần sau"
        />
      </div>
      {message && (
        <p className={isError ? 'field-error' : 'muted'} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy || status === currentStatus}>
        {busy ? 'Đang lưu…' : 'Lưu trạng thái'}
      </button>
    </form>
  );
}
