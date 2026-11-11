// Trang /admin/don-hang — quan tri don hang (Task 10).
// Guard admin o app/admin/layout.tsx (requireAdmin doc role that tu DB).
// Moi thao tac ghi di qua Workers API:
// - Xac nhan da nhan tien (mark-paid): chi khi admin da doi soat duoc
//   tien ve tai khoan MB Bank. Server tu cap quyen hoc + gui email E4.
// - Hoan tra (refund): THU CONG — admin phai chuyen khoan hoan tien
//   qua MB Bank TRUOC, roi nhap ma giao dich hoan vao day. Server ghi
//   payments 'refunded', thu hoi enrollment/membership/chung chi, giam
//   luot dung coupon, ghi audit 'order.refund'. Han 15 ngay lam viec
//   ke tu ngay thanh toan; qua han can ly do cuong che (ghi audit).
// - Quet don het han 48h: expire-sweep.
// Khong bao gio cap quyen hoc hay doi trang thai don truc tiep tu day.
'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatVnd, orderStatusLabelVi } from '@/lib/dashboard';
import {
  expireOrdersSweep,
  fetchAdminOrders,
  markOrderPaid,
  refundOrder,
  type AdminOrder,
  type PaymentsState,
} from '@/lib/payments';

type Filter = { status: string; q: string; refundRequested: boolean };

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<Filter>({ status: '', q: '', refundRequested: false });
  const [state, setState] = useState<PaymentsState<{ orders: AdminOrder[] }>>({ status: 'loading' });
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    setState({ status: 'loading' });
    setState(await fetchAdminOrders(f));
  }, []);

  useEffect(() => {
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = () => void load(filter);

  const handleSweep = async () => {
    setActionMsg(null);
    setActionErr(null);
    const res = await expireOrdersSweep();
    if (res.status === 'success') {
      setActionMsg(`Đã quét: ${res.data.expiredCount} đơn quá hạn 48h chuyển sang hết hạn.`);
      void load(filter);
    } else if (res.status === 'error') {
      setActionErr(res.message);
    } else {
      setActionErr('Chưa kết nối được tới API thanh toán.');
    }
  };

  const orders = state.status === 'success' ? state.data.orders : [];

  return (
    <div>
      <h1 className="gold-title">Đơn hàng</h1>
      <p className="muted">
        Xác nhận thanh toán chỉ sau khi đối soát tiền về tài khoản MB Bank. Hoàn trả xử lý thủ công
        qua ngân hàng trước, rồi ghi nhận tại đây. Mọi thao tác đều ghi audit log.
      </p>

      <div className="card">
        <p>
          <label htmlFor="filter-status">
            Trạng thái{' '}
            <select
              id="filter-status"
              className="field"
              value={filter.status}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ thanh toán</option>
              <option value="paid">Đã thanh toán</option>
              <option value="cancelled">Đã hủy</option>
              <option value="refunded">Đã hoàn trả</option>
              <option value="expired">Hết hạn</option>
            </select>
          </label>{' '}
          <label htmlFor="filter-q">
            Tìm mã đơn / email{' '}
            <input
              id="filter-q"
              className="field"
              type="search"
              value={filter.q}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
              placeholder="DH-2026-000123 hoặc email"
            />
          </label>{' '}
          <label>
            <input
              type="checkbox"
              checked={filter.refundRequested}
              onChange={(e) => setFilter((f) => ({ ...f, refundRequested: e.target.checked }))}
            />{' '}
            Chỉ đơn xin hoàn trả
          </label>{' '}
          <button type="button" className="btn" onClick={applyFilter}>
            Lọc
          </button>{' '}
          <button type="button" className="btn-ghost" onClick={() => void handleSweep()}>
            Quét đơn hết hạn 48h
          </button>
        </p>
      </div>

      {actionMsg ? (
        <p className="notice success" role="status">
          {actionMsg}
        </p>
      ) : null}
      {actionErr ? (
        <p className="notice error" role="alert">
          {actionErr}
        </p>
      ) : null}

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải đơn hàng…
        </p>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được đơn hàng.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={applyFilter}>
              Thử lại
            </button>
          </p>
        </div>
      )}
      {state.status === 'success' && orders.length === 0 && (
        <div className="notice">
          <p>Không có đơn hàng nào khớp bộ lọc.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="dashboard-list">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              busy={busyId === o.id}
              onBusy={(b) => setBusyId(b ? o.id : null)}
              onDone={(msg) => {
                setActionMsg(msg);
                setActionErr(null);
                void load(filter);
              }}
              onError={(msg) => {
                setActionErr(msg);
                setActionMsg(null);
              }}
            />
          ))}
        </div>
      )}
      <p>
        <Link className="btn-ghost" href="/admin/audit-logs">
          Xem nhật ký quản trị (đối soát mark-paid / refund)
        </Link>
      </p>
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onBusy,
  onDone,
  onError,
}: {
  order: AdminOrder;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [showPaid, setShowPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState(String(order.amountVnd));
  const [gatewayRef, setGatewayRef] = useState('');
  const [paidNote, setPaidNote] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundBankRef, setRefundBankRef] = useState('');
  const [forceRefund, setForceRefund] = useState(false);
  const [forceReason, setForceReason] = useState('');

  const doMarkPaid = async () => {
    const amount = Number(paidAmount.replace(/[^\d]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      onError('Số tiền xác nhận phải lớn hơn 0đ và khớp đúng số tiền đơn.');
      return;
    }
    onBusy(true);
    const res = await markOrderPaid(order.id, {
      amountVnd: amount,
      gatewayReference: gatewayRef.trim() || null,
      note: paidNote.trim() || undefined,
    });
    onBusy(false);
    if (res.status === 'success') {
      onDone(
        res.data.duplicate
          ? `Đơn ${order.referenceCode} đã được xác nhận trước đó (trùng mã giao dịch — không ghi trùng).`
          : `Đã xác nhận thanh toán đơn ${order.referenceCode}. Quyền học đã được cấp.`,
      );
      setShowPaid(false);
    } else if (res.status === 'error') {
      onError(res.message);
    } else {
      onError('Chưa kết nối được tới API thanh toán.');
    }
  };

  const doRefund = async () => {
    if (!refundReason.trim()) {
      onError('Vui lòng nhập lý do hoàn trả.');
      return;
    }
    if (!refundBankRef.trim()) {
      onError('Vui lòng nhập mã giao dịch hoàn tiền qua ngân hàng (bạn phải chuyển khoản hoàn trước).');
      return;
    }
    if (forceRefund && !forceReason.trim()) {
      onError('Hoàn trả quá hạn cần ghi rõ lý do cưỡng chế.');
      return;
    }
    onBusy(true);
    const res = await refundOrder(order.id, {
      reason: refundReason.trim(),
      refundBankReference: refundBankRef.trim(),
      forceReason: forceRefund ? forceReason.trim() : null,
    });
    onBusy(false);
    if (res.status === 'success') {
      onDone(`Đã hoàn trả đơn ${order.referenceCode}. Quyền học đã thu hồi.`);
      setShowRefund(false);
    } else if (res.status === 'error') {
      onError(res.message);
    } else {
      onError('Chưa kết nối được tới API thanh toán.');
    }
  };

  return (
    <article className="card list-row">
      <h3>
        Đơn {order.referenceCode} — <strong>{orderStatusLabelVi(order.status)}</strong>
      </h3>
      <p>
        {order.student?.fullName ?? 'Học viên'} {order.student?.email ? `(${order.student.email})` : ''}
        <br />
        Tổng tiền: <strong>{formatVnd(order.amountVnd)}</strong>
        {order.discountVnd > 0 ? ` · Giảm ${formatVnd(order.discountVnd)}` : ''}
        {order.couponCode ? ` · Mã ${order.couponCode}` : ''}
        <br />
        <span className="muted">
          Đặt ngày {new Date(order.createdAt).toLocaleDateString('vi-VN')}
          {order.paidAt ? ` · Thanh toán ${new Date(order.paidAt).toLocaleDateString('vi-VN')}` : ''}
          {order.refundRequestedAt
            ? ` · Xin hoàn ${new Date(order.refundRequestedAt).toLocaleDateString('vi-VN')}${order.refundReason ? `: ${order.refundReason}` : ''}`
            : ''}
          {order.refundedAt ? ` · Hoàn trả ${new Date(order.refundedAt).toLocaleDateString('vi-VN')}` : ''}
        </span>
      </p>
      {order.items.length > 0 && (
        <ul>
          {order.items.map((it) => (
            <li key={it.id}>
              {it.itemName} × {it.quantity} — {formatVnd(it.totalVnd)}
            </li>
          ))}
        </ul>
      )}

      {order.status === 'pending' && (
        <p>
          <button type="button" className="btn-small" onClick={() => setShowPaid((v) => !v)}>
            {showPaid ? 'Đóng' : 'Xác nhận đã nhận tiền'}
          </button>
        </p>
      )}
      {showPaid && order.status === 'pending' && (
        <div className="card">
          <p>
            <strong>Xác nhận đã nhận tiền</strong> — chỉ bấm khi đã thấy tiền về tài khoản MB Bank
            đúng số tiền và đúng nội dung {order.referenceCode}.
          </p>
          <p>
            <label htmlFor={`paid-amount-${order.id}`}>
              Số tiền thực nhận (đ)
              <input
                id={`paid-amount-${order.id}`}
                className="field"
                type="number"
                min={1}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </label>
          </p>
          <p>
            <label htmlFor={`gateway-ref-${order.id}`}>
              Mã giao dịch ngân hàng (nếu có)
              <input
                id={`gateway-ref-${order.id}`}
                className="field"
                type="text"
                value={gatewayRef}
                onChange={(e) => setGatewayRef(e.target.value)}
                placeholder="Mã tham chiếu trên sao kê"
                autoComplete="off"
              />
            </label>
          </p>
          <p>
            <label htmlFor={`paid-note-${order.id}`}>
              Ghi chú đối soát
              <input
                id={`paid-note-${order.id}`}
                className="field"
                type="text"
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                placeholder="Ví dụ: đối soát sao kê MB Bank ngày…"
              />
            </label>
          </p>
          <p>
            <button type="button" className="btn" onClick={() => void doMarkPaid()} disabled={busy}>
              {busy ? 'Đang xác nhận…' : 'Xác nhận — cấp quyền học'}
            </button>
          </p>
        </div>
      )}

      {order.status === 'paid' && (
        <p>
          <button type="button" className="btn-danger btn-small" onClick={() => setShowRefund((v) => !v)}>
            {showRefund ? 'Đóng' : 'Hoàn trả đơn này'}
          </button>
        </p>
      )}
      {showRefund && order.status === 'paid' && (
        <div className="card">
          <p>
            <strong>Hoàn trả thủ công</strong> — chuyển khoản hoàn tiền qua MB Bank trước, rồi nhập
            mã giao dịch hoàn vào đây. Hạn hoàn trả: 15 ngày làm việc kể từ ngày thanh toán.
          </p>
          <p>
            <label htmlFor={`refund-reason-${order.id}`}>
              Lý do hoàn trả
              <input
                id={`refund-reason-${order.id}`}
                className="field"
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Ví dụ: học viên yêu cầu hủy trong hạn"
              />
            </label>
          </p>
          <p>
            <label htmlFor={`refund-bank-ref-${order.id}`}>
              Mã giao dịch hoàn tiền (MB Bank)
              <input
                id={`refund-bank-ref-${order.id}`}
                className="field"
                type="text"
                value={refundBankRef}
                onChange={(e) => setRefundBankRef(e.target.value)}
                placeholder="Mã tham chiếu lệnh chuyển hoàn"
                autoComplete="off"
              />
            </label>
          </p>
          <p>
            <label>
              <input
                type="checkbox"
                checked={forceRefund}
                onChange={(e) => setForceRefund(e.target.checked)}
              />{' '}
              Quá hạn 15 ngày làm việc — hoàn trả cưỡng chế
            </label>
          </p>
          {forceRefund ? (
            <p>
              <label htmlFor={`force-reason-${order.id}`}>
                Lý do cưỡng chế (ghi audit)
                <input
                  id={`force-reason-${order.id}`}
                  className="field"
                  type="text"
                  value={forceReason}
                  onChange={(e) => setForceReason(e.target.value)}
                  placeholder="Ví dụ: quyết định của ban quản trị ngày…"
                />
              </label>
            </p>
          ) : null}
          <p>
            <button type="button" className="btn-danger" onClick={() => void doRefund()} disabled={busy}>
              {busy ? 'Đang hoàn trả…' : 'Xác nhận hoàn trả — thu hồi quyền học'}
            </button>
          </p>
        </div>
      )}
    </article>
  );
}
