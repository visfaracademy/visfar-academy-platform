// Trang /hoc-vien/vi — Vi & tiep thi lien ket (Workers API
// /api/v1/referrals/*, migration 0023).
// - Ma gioi thieu rieng + link gioi thieu (sao chep).
// - Ty le hoa hong 10% MAC DINH, CHO VISFAR CHOT (ghi ro o UI).
// - Rut tien THU CONG: chi tao yeu cau status pending, admin duyet va
//   chuyen khoan tay trong 15 ngay lam viec — KHONG tu dong chuyen tien.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import DashboardNav from '@/components/dashboard/DashboardNav';
import {
  COMMISSION_RATE_LABEL,
  formatVnd,
  getMyReferral,
  referralLink,
  requestWithdrawal,
  summarizeWallet,
  walletTransactionStatusLabelVi,
  walletTransactionTypeLabelVi,
  type MyReferral,
  type ReferralState,
} from '@/lib/referrals';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ViPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<ReferralState>({ status: 'loading' });
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [amount, setAmount] = useState('');
  const [payoutInfo, setPayoutInfo] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') {
      setState({ status: 'loading' });
      setState(await getMyReferral());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(text: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      setWithdrawError('Không sao chép được. Vui lòng bôi đen và sao chép thủ công.');
    }
  }

  async function onWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);
    const amountVnd = Number(amount.replace(/[^\d]/g, ''));
    if (!Number.isInteger(amountVnd) || amountVnd <= 0) {
      setWithdrawError('Vui lòng nhập số tiền rút (đồng, số nguyên lớn hơn 0).');
      return;
    }
    if (!payoutInfo.trim()) {
      setWithdrawError('Vui lòng nhập thông tin nhận tiền (ngân hàng, số tài khoản, chủ tài khoản).');
      return;
    }
    if (payoutInfo.trim().length > 500) {
      setWithdrawError('Thông tin nhận tiền tối đa 500 ký tự.');
      return;
    }
    setWithdrawing(true);
    const result = await requestWithdrawal({ amountVnd, payoutInfo: payoutInfo.trim() });
    setWithdrawing(false);
    if (result.status === 'error') {
      setWithdrawError(result.message);
      return;
    }
    setWithdrawSuccess(
      'Đã ghi nhận yêu cầu rút tiền. Quản trị viên sẽ xét duyệt và chuyển khoản thủ công trong 15 ngày làm việc.',
    );
    setAmount('');
    setPayoutInfo('');
    setState({ status: 'success', data: result.data });
  }

  if (authState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải ví…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Ví &amp; tiếp thị liên kết</h1>
        <div className="notice" role="status">
          <p>Bạn chưa đăng nhập. Vui lòng đăng nhập để xem ví của mình.</p>
        </div>
      </div>
    );
  }
  if (authState.status === 'error' || authState.status === 'not-configured') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Ví &amp; tiếp thị liên kết</h1>
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

  const data: MyReferral | null = state.status === 'success' ? state.data : null;
  const walletSummary = data ? summarizeWallet(data.transactions) : null;

  return (
    <div className="wrap">
      <h1 className="gold-title">Ví &amp; tiếp thị liên kết</h1>
      <DashboardNav />
      <p className="muted">
        Chia sẻ mã giới thiệu của bạn — khi người được giới thiệu mua khóa học, bạn nhận hoa hồng{' '}
        {COMMISSION_RATE_LABEL}. Hoa hồng được ghi vào ví sau khi đơn hàng thanh toán thành công.
      </p>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải ví…
        </p>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được ví.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="stat-grid" aria-label="Số dư ví">
            <div className="stat-card">
              <p className="stat-num">{formatVnd(data.balanceVnd)}</p>
              <p>Số dư ví</p>
            </div>
            <div className="stat-card">
              <p className="stat-num">{formatVnd(data.availableBalanceVnd)}</p>
              <p>Số dư khả dụng để rút</p>
            </div>
            <div className="stat-card">
              <p className="stat-num">
                {walletSummary ? formatVnd(walletSummary.totalCommissionVnd) : '—'}
              </p>
              <p>Tổng hoa hồng đã nhận</p>
            </div>
            <div className="stat-card">
              <p className="stat-num">
                {walletSummary ? formatVnd(walletSummary.totalWithdrawnVnd) : '—'}
              </p>
              <p>Tổng đã rút</p>
            </div>
            <div className="stat-card">
              <p className="stat-num">{COMMISSION_RATE_LABEL}</p>
              <p>Tỷ lệ hoa hồng</p>
            </div>
          </div>

          <section className="card" aria-labelledby="ma-gioi-thieu">
            <h2 id="ma-gioi-thieu" className="gold-title">Mã giới thiệu của bạn</h2>
            <p>
              <strong>{data.referralCode}</strong>{' '}
              <button
                type="button"
                className="btn btn-small"
                onClick={() => void copyText(data.referralCode, 'code')}
              >
                {copied === 'code' ? 'Đã sao chép' : 'Sao chép mã'}
              </button>
            </p>
            <p className="muted">Link giới thiệu:</p>
            <p>
              <code>{referralLink(data.referralCode)}</code>{' '}
              <button
                type="button"
                className="btn btn-small"
                onClick={() => void copyText(referralLink(data.referralCode), 'link')}
              >
                {copied === 'link' ? 'Đã sao chép' : 'Sao chép link'}
              </button>
            </p>
            <p className="hint">
              Người đăng ký qua link này sẽ được ghi nhận là do bạn giới thiệu sau khi tạo tài khoản.
            </p>
          </section>

          <section aria-labelledby="nguoi-da-gioi-thieu">
            <h2 id="nguoi-da-gioi-thieu" className="gold-title">Người đã giới thiệu ({data.referred.length})</h2>
            {data.referred.length === 0 ? (
              <div className="notice">
                <p>Chưa có ai đăng ký qua mã giới thiệu của bạn.</p>
              </div>
            ) : (
              <ul className="dashboard-list">
                {data.referred.map((r, i) => (
                  <li key={`${r.userId ?? 'unknown'}-${i}`} className="list-row">
                    <p>
                      <strong>{r.fullName ?? r.email ?? 'Học viên'}</strong>
                      {r.email && r.fullName ? ` — ${r.email}` : ''}
                    </p>
                    <p className="muted">
                      Đăng ký: {formatDateTime(r.referredAt)} ·{' '}
                      {r.hasPaidOrder ? 'Đã mua khóa học' : 'Chưa mua khóa học'}
                      {r.commissionEarnedVnd > 0 && ` · Hoa hồng: ${formatVnd(r.commissionEarnedVnd)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="lich-su-vi">
            <h2 id="lich-su-vi" className="gold-title">Lịch sử giao dịch ví</h2>
            {data.transactions.length === 0 ? (
              <div className="notice">
                <p>Chưa có giao dịch ví nào.</p>
              </div>
            ) : (
              <ul className="dashboard-list">
                {data.transactions.map((tx) => (
                  <li key={tx.id} className="list-row">
                    <p>
                      <strong>{walletTransactionTypeLabelVi(tx.type)}</strong>
                      {' — '}
                      {tx.amountVnd > 0 ? '+' : ''}
                      {formatVnd(tx.amountVnd)}
                      {' · '}
                      <span className="pill">{walletTransactionStatusLabelVi(tx.status)}</span>
                    </p>
                    <p className="muted">
                      {formatDateTime(tx.createdAt)}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="yeu-cau-rut">
            <h2 id="yeu-cau-rut" className="gold-title">Yêu cầu rút tiền</h2>
            <p className="muted">
              Rút bằng chuyển khoản thủ công, admin duyệt trong 15 ngày làm việc. Tiền không tự động
              chuyển — quản trị viên sẽ chuyển khoản tay sau khi duyệt.
            </p>
            {withdrawSuccess && (
              <div className="notice success" role="status">
                <p>{withdrawSuccess}</p>
              </div>
            )}
            {withdrawError && (
              <div className="notice error" role="alert">
                <p>
                  <strong>{withdrawError}</strong>
                </p>
              </div>
            )}
            <form onSubmit={onWithdraw} noValidate>
              <div className="field">
                <label htmlFor="wd-amount">Số tiền rút (đồng) *</label>
                <input
                  id="wd-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={data.availableBalanceVnd}
                  step={1}
                  required
                  placeholder="Ví dụ: 100000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={withdrawing}
                />
                <p className="hint">Tối đa {formatVnd(data.availableBalanceVnd)} (số dư khả dụng).</p>
              </div>
              <div className="field">
                <label htmlFor="wd-payout">Thông tin nhận tiền *</label>
                <textarea
                  id="wd-payout"
                  className="note-textarea"
                  rows={3}
                  maxLength={500}
                  placeholder="Ngân hàng, số tài khoản, chủ tài khoản — ví dụ: MB Bank, 1234567890, Nguyễn Văn A"
                  value={payoutInfo}
                  onChange={(e) => setPayoutInfo(e.target.value)}
                  disabled={withdrawing}
                />
                <p className="hint">{payoutInfo.length}/500 ký tự</p>
              </div>
              <p>
                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={withdrawing || data.availableBalanceVnd <= 0}
                >
                  {withdrawing ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền'}
                </button>
              </p>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
