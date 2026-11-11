// Trang /admin/ma-giam-gia — quan tri ma giam gia (Task 10).
// Guard admin o app/admin/layout.tsx. Tao / bat-tat ma qua Workers API.
// Quy tac gia (server chot): percent <= 100, fixed_vnd <= tong don,
// khong ap dung cho don Tuy tam, khong vuot min_order_vnd.
'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import { formatVnd } from '@/lib/dashboard';
import {
  createCoupon,
  fetchAdminCoupons,
  toggleCoupon,
  type CouponAdminRow,
  type PaymentsState,
} from '@/lib/payments';

export default function AdminCouponsPage() {
  const [state, setState] = useState<PaymentsState<{ coupons: CouponAdminRow[] }>>({
    status: 'loading',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrder, setMinOrder] = useState('0');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchAdminCoupons());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setMsg(null);
    setErr(null);
    const value = Number(discountValue);
    if (!code.trim()) {
      setErr('Vui lòng nhập mã (ví dụ: VISFAR10).');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setErr('Giá trị giảm phải lớn hơn 0.');
      return;
    }
    if (discountType === 'percent' && value > 100) {
      setErr('Giảm theo % tối đa 100%.');
      return;
    }
    setBusy(true);
    const res = await createCoupon({
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discountType,
      discountValue: value,
      minOrderVnd: Number(minOrder) || 0,
      maxDiscountVnd: maxDiscount.trim() ? Number(maxDiscount) : null,
      maxUses: maxUses.trim() ? Number(maxUses) : null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    });
    setBusy(false);
    if (res.status === 'success') {
      setMsg(`Đã tạo mã ${res.data.coupon.code}.`);
      setCode('');
      setDescription('');
      setDiscountValue('10');
      setMinOrder('0');
      setMaxDiscount('');
      setMaxUses('');
      setValidUntil('');
      void load();
    } else if (res.status === 'error') {
      setErr(res.message);
    } else {
      setErr('Chưa kết nối được tới API thanh toán.');
    }
  };

  const handleToggle = async (row: CouponAdminRow) => {
    setMsg(null);
    setErr(null);
    const res = await toggleCoupon(row.id, !row.is_active);
    if (res.status === 'success') {
      setMsg(`Mã ${row.code} đã ${res.data.coupon.is_active ? 'bật' : 'tắt'}.`);
      void load();
    } else if (res.status === 'error') {
      setErr(res.message);
    } else {
      setErr('Chưa kết nối được tới API thanh toán.');
    }
  };

  const coupons = state.status === 'success' ? state.data.coupons : [];

  return (
    <div>
      <h1 className="gold-title">Mã giảm giá</h1>
      <p className="muted">
        Mã chỉ áp dụng cho đơn có phí (không áp dụng cho khóa Tùy tâm). Lượt dùng được trừ nguyên
        tử khi đơn thanh toán thành công và trả lại khi đơn hoàn trả.
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

      <section className="card" aria-label="Tạo mã giảm giá">
        <h2 className="gold-title">Tạo mã mới</h2>
        <p>
          <label htmlFor="coupon-code">
            Mã
            <input
              id="coupon-code"
              className="field"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VISFAR10"
              autoComplete="off"
            />
          </label>
        </p>
        <p>
          <label htmlFor="coupon-desc">
            Mô tả
            <input
              id="coupon-desc"
              className="field"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: Giảm 10% khai trương"
            />
          </label>
        </p>
        <p>
          <label htmlFor="coupon-type">
            Loại giảm{' '}
            <select
              id="coupon-type"
              className="field"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              <option value="percent">Theo %</option>
              <option value="fixed_vnd">Số tiền cố định (đ)</option>
            </select>
          </label>{' '}
          <label htmlFor="coupon-value">
            Giá trị giảm
            <input
              id="coupon-value"
              className="field"
              type="number"
              min={1}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </label>
        </p>
        <p>
          <label htmlFor="coupon-min">
            Đơn tối thiểu (đ)
            <input
              id="coupon-min"
              className="field"
              type="number"
              min={0}
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
            />
          </label>{' '}
          <label htmlFor="coupon-max">
            Giảm tối đa (đ, chỉ loại %)
            <input
              id="coupon-max"
              className="field"
              type="number"
              min={0}
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="Để trống = không giới hạn"
            />
          </label>
        </p>
        <p>
          <label htmlFor="coupon-uses">
            Số lượt dùng tối đa
            <input
              id="coupon-uses"
              className="field"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Để trống = không giới hạn"
            />
          </label>{' '}
          <label htmlFor="coupon-until">
            Hết hạn ngày
            <input
              id="coupon-until"
              className="field"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </label>
        </p>
        <p>
          <button type="button" className="btn" onClick={() => void handleCreate()} disabled={busy}>
            {busy ? 'Đang tạo…' : 'Tạo mã'}
          </button>
        </p>
      </section>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải mã giảm giá…
        </p>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được mã giảm giá.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}
      {state.status === 'success' && coupons.length === 0 && (
        <div className="notice">
          <p>Chưa có mã giảm giá nào.</p>
        </div>
      )}
      {coupons.length > 0 && (
        <div className="dashboard-list">
          {coupons.map((c) => (
            <article className="card list-row" key={c.id}>
              <h3>
                {c.code} —{' '}
                {c.discount_type === 'percent' ? `giảm ${c.discount_value}%` : `giảm ${formatVnd(c.discount_value)}`}
              </h3>
              <p>
                {c.description ?? 'Không có mô tả'}
                <br />
                <span className="muted">
                  Đã dùng {c.used_count}
                  {c.max_uses !== null ? `/${c.max_uses}` : ''} lượt
                  {c.min_order_vnd > 0 ? ` · Đơn tối thiểu ${formatVnd(c.min_order_vnd)}` : ''}
                  {c.max_discount_vnd !== null ? ` · Giảm tối đa ${formatVnd(c.max_discount_vnd)}` : ''}
                  {c.valid_until ? ` · Hết hạn ${new Date(c.valid_until).toLocaleDateString('vi-VN')}` : ''}
                  {' · '}
                  {c.is_active ? 'Đang bật' : 'Đã tắt'}
                </span>
              </p>
              <p>
                <button type="button" className="btn-ghost btn-small" onClick={() => void handleToggle(c)}>
                  {c.is_active ? 'Tắt mã' : 'Bật mã'}
                </button>
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
