// Form sua thong tin khoa hoc (client) — PATCH /api/admin/courses/[id].
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export interface EditableCourse {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  pillar: string | null;
  price_vnd: number;
  display_order: number;
  status: string;
}

export default function CourseEditForm({ course }: { course: EditableCourse }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [subtitle, setSubtitle] = useState(course.subtitle ?? '');
  const [description, setDescription] = useState(course.description ?? '');
  const [pillar, setPillar] = useState(course.pillar ?? '');
  const [status, setStatus] = useState(course.status);
  const [price, setPrice] = useState(String(course.price_vnd));
  const [order, setOrder] = useState(String(course.display_order));
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim(),
          description: description.trim(),
          pillar: pillar || null,
          status,
          price_vnd: Number(price),
          display_order: Number(order),
        }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không lưu được khóa học.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã lưu khóa học.');
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
        <label htmlFor="course-title">Tiêu đề</label>
        <input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="course-subtitle">Tiêu đề phụ</label>
        <input id="course-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} />
      </div>
      <div className="field">
        <label htmlFor="course-description">Mô tả</label>
        <textarea id="course-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="field">
        <label htmlFor="course-pillar">Trụ cột</label>
        <select id="course-pillar" value={pillar} onChange={(e) => setPillar(e.target.value)}>
          <option value="">— Chưa chọn —</option>
          <option value="than">Thân</option>
          <option value="tam">Tâm</option>
          <option value="tue">Tuệ</option>
          <option value="tich-hop">Tích hợp (cả 3 trụ cột)</option>
          <option value="cong-dong">Cộng đồng</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="course-status">Trạng thái xuất bản</label>
        <select id="course-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="draft">Nháp</option>
          <option value="published">Đã xuất bản</option>
          <option value="archived">Đã lưu trữ</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="course-price">Giá (VNĐ)</label>
        <input id="course-price" type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="course-order">Thứ tự hiển thị</label>
        <input id="course-order" type="number" min={0} step={1} value={order} onChange={(e) => setOrder(e.target.value)} />
      </div>
      {message && (
        <p className={isError ? 'field-error' : 'muted'} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu khóa học'}
      </button>
    </form>
  );
}
