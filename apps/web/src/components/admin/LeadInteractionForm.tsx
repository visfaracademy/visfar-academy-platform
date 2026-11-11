// Form ghi tuong tac moi voi lead (client) — goi POST
// /api/admin/leads/[id]/interactions. Moi tuong tac ghi ai, khi nao,
// kenh, noi dung, ket qua (luu vao lead_interactions + audit log).
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  INTERACTION_CHANNELS,
  INTERACTION_CHANNEL_LABELS,
  INTERACTION_OUTCOMES,
  INTERACTION_OUTCOME_LABELS,
} from '@/lib/crm';

export default function LeadInteractionForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [channel, setChannel] = useState('phone');
  const [content, setContent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, content: content.trim(), outcome: outcome || null }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không lưu được tương tác.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã lưu tương tác.');
      setContent('');
      setOutcome('');
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
        <label htmlFor="interaction-channel">Kênh tương tác</label>
        <select id="interaction-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
          {INTERACTION_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {INTERACTION_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="interaction-content">Nội dung tương tác</label>
        <textarea
          id="interaction-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={2000}
          rows={3}
          placeholder="Ví dụ: Gọi tư vấn, học viên quan tâm khóa Thấu Hiểu Nội Tâm, hẹn gọi lại thứ 5"
        />
      </div>
      <div className="field">
        <label htmlFor="interaction-outcome">Kết quả (không bắt buộc)</label>
        <select id="interaction-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">— Chưa ghi kết quả —</option>
          {INTERACTION_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {INTERACTION_OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
      </div>
      {message && (
        <p className={isError ? 'field-error' : 'muted'} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu tương tác'}
      </button>
    </form>
  );
}
