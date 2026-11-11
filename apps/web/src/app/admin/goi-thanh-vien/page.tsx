// Trang /admin/goi-thanh-vien — quan tri goi thanh vien (Task 10).
// Guard admin o app/admin/layout.tsx. Tao goi qua Workers API.
// Go co the gan 1 khoa (courseId): khi goi duoc kich hoat, hoc vien
// duoc ghi danh khoa do; gia goi do admin nhap (khong bi gia khoa).
'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import { formatVnd } from '@/lib/dashboard';
import {
  createPlan,
  fetchAdminPlans,
  type MembershipPlan,
  type PaymentsState,
} from '@/lib/payments';
import { fetchPublishedCourses } from '@/lib/courses';

export default function AdminPlansPage() {
  const [state, setState] = useState<PaymentsState<{ plans: MembershipPlan[] }>>({
    status: 'loading',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [courseId, setCourseId] = useState('');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchAdminPlans());
    const res = await fetchPublishedCourses();
    if (res.status === 'success') {
      setCourses(res.courses.map((c) => ({ id: c.id, title: c.title })));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setMsg(null);
    setErr(null);
    const priceVnd = Number(price.replace(/[^\d]/g, ''));
    if (!slug.trim() || !name.trim()) {
      setErr('Vui lòng nhập slug và tên gói.');
      return;
    }
    if (!Number.isFinite(priceVnd) || priceVnd < 0) {
      setErr('Giá gói phải là số tiền >= 0đ.');
      return;
    }
    setBusy(true);
    const res = await createPlan({
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      description: description.trim() || null,
      priceVnd,
      durationDays: duration.trim() ? Number(duration) : null,
      courseId: courseId || null,
    });
    setBusy(false);
    if (res.status === 'success') {
      setMsg(`Đã tạo gói ${res.data.plan.name}.`);
      setSlug('');
      setName('');
      setDescription('');
      setPrice('');
      setDuration('');
      setCourseId('');
      void load();
    } else if (res.status === 'error') {
      setErr(res.message);
    } else {
      setErr('Chưa kết nối được tới API thanh toán.');
    }
  };

  const plans = state.status === 'success' ? state.data.plans : [];
  const courseTitle = (id: string | null) =>
    id ? (courses.find((c) => c.id === id)?.title ?? id) : 'Không gắn khóa cụ thể';

  return (
    <div>
      <h1 className="gold-title">Gói thành viên</h1>
      <p className="muted">
        Gói đang bán hiển thị ở trang /goi-thanh-vien. Giá gói do bạn nhập — không tự lấy theo giá
        khóa học.
      </p>

      {msg ? (
        <p className="notice success" role="status">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="notice error" role="alert">
          {err}
        </p>
      ) : null}

      <section className="card" aria-label="Tạo gói thành viên">
        <h2 className="gold-title">Tạo gói mới</h2>
        <p>
          <label htmlFor="plan-slug">
            Slug
            <input
              id="plan-slug"
              className="field"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="goi-12-thang"
              autoComplete="off"
            />
          </label>{' '}
          <label htmlFor="plan-name">
            Tên gói
            <input
              id="plan-name"
              className="field"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gói 12 tháng"
            />
          </label>
        </p>
        <p>
          <label htmlFor="plan-desc">
            Mô tả
            <input
              id="plan-desc"
              className="field"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Học trọn bộ chương trình trong 12 tháng"
            />
          </label>
        </p>
        <p>
          <label htmlFor="plan-price">
            Giá gói (đ)
            <input
              id="plan-price"
              className="field"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ví dụ: 4999000"
            />
          </label>{' '}
          <label htmlFor="plan-duration">
            Thời hạn (ngày)
            <input
              id="plan-duration"
              className="field"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Để trống = không giới hạn"
            />
          </label>
        </p>
        <p>
          <label htmlFor="plan-course">
            Gắn khóa học (tùy chọn — học viên mua gói được ghi danh khóa này)
            <select
              id="plan-course"
              className="field"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Không gắn khóa cụ thể</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <button type="button" className="btn" onClick={() => void handleCreate()} disabled={busy}>
            {busy ? 'Đang tạo…' : 'Tạo gói'}
          </button>
        </p>
      </section>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải gói thành viên…
        </p>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được gói thành viên.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}
      {state.status === 'success' && plans.length === 0 && (
        <div className="notice">
          <p>Chưa có gói thành viên nào.</p>
        </div>
      )}
      {plans.length > 0 && (
        <div className="dashboard-list">
          {plans.map((p) => (
            <article className="card list-row" key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {p.description ?? 'Không có mô tả'}
                <br />
                <span className="muted">
                  {formatVnd(p.priceVnd)}
                  {p.durationDays ? ` · ${p.durationDays} ngày` : ' · Không giới hạn thời gian'}
                  {` · ${courseTitle(p.courseId)}`}
                </span>
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
