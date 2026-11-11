// Trang /thanh-toan/[orderId] — huong dan chuyen khoan + trang thai don.
// (Task 10). Don duoc tao o Workers API; trang nay CHI doc trang thai
// qua GET /orders/:id — khong bao gio doi don sang paid tu client.
// - Chuyen khoan MB Bank: so tien + noi dung = ma don (reference_code).
//   So tai khoan KHONG hien o code: ma QR do user tai len
//   (/qr-chuyen-khoan.png) la cach duy nhat hien thong tin tai khoan.
// - Nut "Toi da chuyen khoan" CHI ghi nhan thong bao + lam moi trang
//   thai: quyen hoc chi duoc cap khi server xac nhan (webhook SePay
//   da xac minh hoac admin an Xac nhan da nhan tien). Neu admin chua
//   xac nhan, trang thai van la "Cho thanh toan" — do la dung.
// - Don het han sau 48h (order.expiry_hours): trang thai expired, nut
//   tao don moi.
'use client';

export const runtime = 'edge';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { cancelOrder, fetchOrder, type PaymentOrder, type PaymentsState } from '@/lib/payments';
import { formatVnd, orderStatusLabelVi } from '@/lib/dashboard';

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const [state, setState] = useState<PaymentsState<{ order: PaymentOrder }>>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  const [noted, setNoted] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchOrder(orderId));
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyReference = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    const res = await cancelOrder(orderId);
    setCancelling(false);
    if (res.status === 'success') setState({ status: 'success', data: { order: res.data.order } });
    else if (res.status === 'error') setState(res);
  };

  return (
    <div className="wrap">
      <h1 className="gold-title">Thanh toán đơn hàng</h1>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải đơn hàng…
        </p>
      )}

      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>Hệ thống thanh toán chưa được cấu hình. Vui lòng thử lại sau.</p>
        </div>
      )}

      {state.status === 'signed-out' && (
        <div className="notice" role="status">
          <p>
            Bạn cần đăng nhập để xem đơn hàng này.{' '}
            <Link className="btn" href={`/dang-nhap?next=/thanh-toan/${orderId}`}>
              Đăng nhập
            </Link>
          </p>
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

      {state.status === 'success' && (
        <OrderDetail
          order={state.data.order}
          copied={copied}
          noted={noted}
          cancelling={cancelling}
          onCopy={() => void copyReference(state.data.order.referenceCode)}
          onNote={() => setNoted(true)}
          onRefresh={() => void load()}
          onCancel={() => void handleCancel()}
        />
      )}
    </div>
  );
}

function OrderDetail({
  order,
  copied,
  noted,
  cancelling,
  onCopy,
  onNote,
  onRefresh,
  onCancel,
}: {
  order: PaymentOrder;
  copied: boolean;
  noted: boolean;
  cancelling: boolean;
  onCopy: () => void;
  onNote: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}) {
  const isPending = order.status === 'pending';
  const isPaid = order.status === 'paid';
  const transfer = order.transfer;

  return (
    <div>
      <p>
        Đơn <strong>{order.referenceCode}</strong> —{' '}
        <strong>{orderStatusLabelVi(order.status)}</strong>
      </p>

      {isPaid && (
        <div className="notice success" role="status">
          <p>
            <strong>Thanh toán thành công.</strong> Quyền học đã được cấp cho bạn.
          </p>
          <p>
            <Link className="btn" href="/hoc-vien/khoa-hoc">
              Vào lớp học của tôi
            </Link>{' '}
            <Link className="btn-ghost" href="/hoc-vien/don-hang">
              Xem đơn hàng
            </Link>
          </p>
        </div>
      )}

      {order.status === 'refunded' && (
        <div className="notice" role="status">
          <p>
            Đơn này đã được hoàn trả{order.refundReason ? ` — lý do: ${order.refundReason}` : ''}. Nếu bạn
            chưa nhận lại tiền trong 15 ngày làm việc, vui lòng liên hệ hỗ trợ.
          </p>
        </div>
      )}

      {(order.status === 'expired' || order.status === 'cancelled') && (
        <div className="notice" role="status">
          <p>
            Đơn này {order.status === 'expired' ? 'đã hết hạn thanh toán (48 giờ)' : 'đã bị hủy'}.
            Bạn có thể tạo đơn mới từ trang khóa học.
          </p>
          <p>
            <Link className="btn" href="/chuong-trinh">
              Xem 10 chương trình
            </Link>
          </p>
        </div>
      )}

      <section className="card" aria-label="Chi tiết đơn hàng">
        <h2 className="gold-title">Chi tiết đơn hàng</h2>
        <ul>
          {order.items.map((it) => (
            <li key={it.id}>
              {it.itemName} × {it.quantity} — {formatVnd(it.totalVnd)}
            </li>
          ))}
        </ul>
        {order.discountVnd > 0 ? (
          <p>
            Giảm giá: −{formatVnd(order.discountVnd)}
            {order.couponCode ? ` (mã ${order.couponCode})` : ''}
          </p>
        ) : null}
        <p>
          <strong>Tổng thanh toán: {formatVnd(order.amountVnd)}</strong>
        </p>
        {isPending && order.expiresAt ? (
          <p className="muted">Hạn thanh toán: {formatExpiry(order.expiresAt)} (48 giờ kể từ lúc tạo đơn).</p>
        ) : null}
      </section>

      {isPending && transfer ? (
        <section className="card" aria-label="Hướng dẫn chuyển khoản">
          <h2 className="gold-title">Chuyển khoản ngân hàng</h2>
          <p>
            Ngân hàng: <strong>{transfer.bankName}</strong>
            <br />
            Chủ tài khoản: <strong>{transfer.accountHolder}</strong>
            <br />
            Số tiền: <strong>{formatVnd(transfer.amountVnd)}</strong>
            <br />
            Nội dung chuyển khoản: <strong>{transfer.content}</strong>{' '}
            <button type="button" className="btn-ghost btn-small" onClick={onCopy}>
              {copied ? 'Đã sao chép' : 'Sao chép mã'}
            </button>
          </p>
          <p className="muted">
            Vui lòng ghi đúng nội dung chuyển khoản (mã đơn) để hệ thống đối soát tự động. Chuyển
            khoản thiếu hoặc sai số tiền sẽ cần quản trị viên kiểm tra thủ công.
          </p>
          <p>
            <img
              src="/qr-chuyen-khoan.png"
              alt="Mã QR chuyển khoản Visfar Academy — quét bằng ứng dụng ngân hàng"
              width={340}
              height={404}
              style={{ maxWidth: '100%', height: 'auto', background: '#fff', padding: '12px' }}
            />
          </p>
          <p className="muted">Quét mã bằng ứng dụng ngân hàng. Mã QR do Visfar Academy cung cấp.</p>
          <p>
            <button type="button" className="btn" onClick={onNote}>
              Tôi đã chuyển khoản
            </button>{' '}
            <button type="button" className="btn-ghost" onClick={onRefresh}>
              Làm mới trạng thái
            </button>
          </p>
          {noted ? (
            <p className="notice" role="status">
              Cảm ơn bạn. Quản trị viên sẽ xác nhận sau khi kiểm tra giao dịch — quyền học được cấp
              ngay khi đơn chuyển sang “Đã thanh toán”. Bạn có thể bấm “Làm mới trạng thái” để kiểm
              tra.
            </p>
          ) : null}
          <p>
            <button type="button" className="btn-danger btn-small" onClick={onCancel} disabled={cancelling}>
              {cancelling ? 'Đang hủy…' : 'Hủy đơn này'}
            </button>
          </p>
        </section>
      ) : null}

      {isPending && !transfer ? (
        <div className="notice error" role="alert">
          <p>Đơn chưa có thông tin chuyển khoản. Vui lòng tải lại trang hoặc liên hệ hỗ trợ.</p>
          <p>
            <button type="button" className="btn" onClick={onRefresh}>
              Tải lại
            </button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
