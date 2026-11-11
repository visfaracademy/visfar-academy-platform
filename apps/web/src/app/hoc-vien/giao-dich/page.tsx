// Trang /hoc-vien/giao-dich — lich su giao dich cua hoc vien (Task 10).
// Doc qua Workers GET /my/transactions (chi giao dich cua don do chinh
// minh tao). Khac /hoc-vien/lich-su (lich su HOC) va /hoc-vien/don-hang
// (don hang): day la dong tien that da ghi nhan o bang payments.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import DashboardNav from '@/components/dashboard/DashboardNav';
import { formatVnd } from '@/lib/dashboard';
import {
  fetchMyTransactions,
  paymentMethodLabelVi,
  transactionStatusLabelVi,
  type PaymentsState,
  type TransactionItem,
} from '@/lib/payments';

export default function GiaoDichPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<PaymentsState<{ transactions: TransactionItem[] }>>({
    status: 'loading',
  });

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') setState(await fetchMyTransactions());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (authState.status === 'loading' || state.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải lịch sử giao dịch…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Lịch sử giao dịch</h1>
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
        <h1 className="gold-title">Lịch sử giao dịch</h1>
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

  const items = state.status === 'success' ? state.data.transactions : [];

  return (
    <div className="wrap">
      <h1 className="gold-title">Lịch sử giao dịch</h1>
      <DashboardNav />

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được lịch sử giao dịch.</strong>
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
          <p>Bạn chưa có giao dịch nào.</p>
          <p>
            <Link className="btn" href="/chuong-trinh">
              Xem 10 chương trình
            </Link>
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="dashboard-list">
          {items.map((t) => (
            <article className="card list-row" key={t.id}>
              <h3>
                {formatVnd(t.amountVnd)} — <strong>{transactionStatusLabelVi(t.status)}</strong>
              </h3>
              <p>
                {paymentMethodLabelVi(t.method)}
                {t.referenceCode ? ` · Đơn ${t.referenceCode}` : ''}
                {t.gatewayReference ? ` · Mã giao dịch ${t.gatewayReference}` : ''}
              </p>
              <p className="muted">
                {t.paidAt
                  ? `Thanh toán ngày ${new Date(t.paidAt).toLocaleDateString('vi-VN')}`
                  : `Tạo ngày ${new Date(t.createdAt).toLocaleDateString('vi-VN')}`}
                {t.orderId ? (
                  <>
                    {' · '}
                    <Link href={`/thanh-toan/${t.orderId}`}>Xem đơn hàng</Link>
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
