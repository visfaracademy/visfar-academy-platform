// Trang /hoc-vien/don-hang — don hang cua hoc vien (orders +
// order_items). Chi doc; thanh toan / hoan tra xu ly o Workers API.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import {
  formatVnd,
  getMyOrders,
  orderStatusLabelVi,
  type DashboardState,
  type OrderItem,
} from '@/lib/dashboard';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default function DonHangPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<DashboardState<OrderItem[]>>({ status: 'success', data: [] });

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') setState(await getMyOrders());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (authState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải đơn hàng…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Đơn hàng của tôi</h1>
        <div className="notice" role="status">
          <p>
            Bạn chưa đăng nhập.{' '}
            <Link className="btn" href="/dang-nhap">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    );
  }
  if (authState.status === 'error' || authState.status === 'not-configured') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Đơn hàng của tôi</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được hồ sơ.</strong>
          </p>
          {authState.status === 'error' && <p>{authState.message}</p>}
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      </div>
    );
  }

  const items = state.status === 'success' ? state.data : [];
  const paidTotal = items
    .filter((o) => o.status === 'paid')
    .reduce((s, o) => s + o.amountVnd, 0);
  const paidCount = items.filter((o) => o.status === 'paid').length;

  return (
    <div className="wrap">
      <h1 className="gold-title">Đơn hàng của tôi</h1>
      <DashboardNav />

      {items.length > 0 && (
        <div className="stat-grid" aria-label="Tổng kết đơn hàng">
          <div className="stat-card">
            <p className="stat-num">{items.length}</p>
            <p>Tổng số đơn</p>
          </div>
          <div className="stat-card">
            <p className="stat-num">{paidCount}</p>
            <p>Đơn đã thanh toán</p>
          </div>
          <div className="stat-card">
            <p className="stat-num">{formatVnd(paidTotal)}</p>
            <p>Tổng đã thanh toán</p>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được đơn hàng.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status === 'success' && items.length === 0 && (
        <div className="notice">
          <p>Bạn chưa có đơn hàng nào.</p>
          <p>
            <Link className="btn" href="/chuong-trinh">
              Xem 10 chương trình
            </Link>
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="dashboard-list">
          {items.map((o) => (
            <article className="card list-row" key={o.id}>
              <h3>
                Đơn {o.referenceCode} — <strong>{orderStatusLabelVi(o.status)}</strong>
              </h3>
              <p>
                Tổng tiền: <strong>{formatVnd(o.amountVnd)}</strong>
                {o.paymentMethod ? ` · ${o.paymentMethod}` : ''}
              </p>
              {o.items.length > 0 && (
                <ul className="module-list">
                  {o.items.map((it) => (
                    <li key={it.id}>
                      {it.itemName} × {it.quantity} — {formatVnd(it.totalVnd)}
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted">Đặt ngày {new Date(o.createdAt).toLocaleDateString('vi-VN')}</p>
              {o.paidAt && <p className="muted">Thanh toán ngày {new Date(o.paidAt).toLocaleDateString('vi-VN')}</p>}
              <p>
                <Link className="btn btn-small" href={`/thanh-toan/${o.id}`}>
                  Xem chi tiết đơn
                </Link>{' '}
                <Link className="btn btn-ghost btn-small" href="/hoc-vien/giao-dich">
                  Xem giao dịch
                </Link>
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
