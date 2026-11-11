// Form tao khoa hoc moi (client) — goi POST /api/admin/courses.
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { slugifyVi } from '@/lib/learning';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function CourseCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState('draft');
  const [price, setPrice] = useState('0');
  const [order, setOrder] = useState('0');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  function onTitleChange(value: string) {
    setTitle(value);
    // Go y slug tu tieu de khi admin chua sua tay o slug.
    if (!slugTouched) setSlug(slugifyVi(value));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const finalSlug = slug.trim() || slugifyVi(title);
    if (!finalSlug || !SLUG_PATTERN.test(finalSlug)) {
      setIsError(true);
      setMessage('Slug chỉ gồm chữ thường, số và dấu gạch ngang — ví dụ: thau-hieu-noi-tam');
      setBusy(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: finalSlug,
          status,
          price_vnd: Number(price),
          display_order: Number(order),
        }),
      });
      const data: { ok?: boolean; error?: string; auditWarning?: string | null } = await res.json();
      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data.error ?? 'Không tạo được khóa học.');
        return;
      }
      setIsError(false);
      setMessage(data.auditWarning ?? 'Đã tạo khóa học.');
      setTitle('');
      setSlug('');
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
        <label htmlFor="new-course-title">Tiêu đề khóa học</label>
        <input
          id="new-course-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          required
          minLength={3}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor="new-course-slug">Slug (chữ thường, số, dấu gạch ngang)</label>
        <input
          id="new-course-slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          placeholder="Ví dụ: thau-hieu-noi-tam"
        />
        <p className="hint">Slug chỉ gồm chữ thường, số và dấu gạch ngang (tự tạo từ tiêu đề nếu để trống).</p>
      </div>
      <div className="field">
        <label htmlFor="new-course-status">Trạng thái xuất bản</label>
        <select id="new-course-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="draft">Nháp</option>
          <option value="published">Đã xuất bản</option>
          <option value="archived">Đã lưu trữ</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="new-course-price">Giá (VNĐ, 0 = miễn phí / tùy tâm)</label>
        <input
          id="new-course-price"
          type="number"
          min={0}
          step={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="new-course-order">Thứ tự hiển thị</label>
        <input
          id="new-course-order"
          type="number"
          min={0}
          step={1}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
      </div>
      {message && (
        <p className={isError ? 'field-error' : 'muted'} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Đang tạo…' : 'Tạo khóa học'}
      </button>
    </form>
  );
}
