// Trang /dang-ky — Supabase Auth signUp (email + mat khau + ho ten).
// Role mac dinh 'student' do trigger tao profiles; form nay khong co o
// chon role. Neu Supabase yeu cau xac nhan email thi hien trang thai
// "confirm-email" thay vi tu cho la dang nhap xong.
// Ma gioi thieu (?ref=CODE): validate qua Workers
// GET /api/v1/referrals/validate, luu tam vao sessionStorage; sau khi
// signUp co session thi claim ngay (POST /api/v1/referrals/claim), neu
// phai xac nhan email thi claim o lan dang nhap dau tien vao /hoc-vien
// (claimStoredReferralCode trong layout). Quan he gioi thieu chi ton tai
// khi Workers da ghi vao bang referrals — khong luu o localStorage.
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { resendSignUpEmail, signUpWithEmail } from '@/lib/auth';
import {
  claimStoredReferralCode,
  storeReferralCode,
  validateReferralCode,
} from '@/lib/referrals';

type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'confirm-email'; message: string }
  | { status: 'error'; message: string };

type ResendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'error'; message: string };

export default function DangKyPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap">
          <p role="status" aria-live="polite">
            Đang tải trang đăng ký…
          </p>
        </div>
      }
    >
      <DangKyForm />
    </Suspense>
  );
}

function DangKyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [resend, setResend] = useState<ResendState>({ status: 'idle' });
  const [referral, setReferral] = useState<{ code: string; valid: boolean } | null>(null);

  // Doc ?ref=, validate ma, luu tam de claim sau khi co session.
  useEffect(() => {
    const raw = searchParams.get('ref');
    if (!raw) return;
    let cancelled = false;
    void (async () => {
      const result = await validateReferralCode(raw);
      if (cancelled) return;
      setReferral({ code: result.code ?? raw.trim().toUpperCase(), valid: result.valid });
      if (result.valid && result.code) storeReferralCode(result.code);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function onResend() {
    setResend({ status: 'sending' });
    const result = await resendSignUpEmail(email);
    if (result.status === 'ok') {
      setResend({ status: 'sent' });
    } else {
      setResend({ status: 'error', message: result.message });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setState({ status: 'error', message: 'Mật khẩu nhập lại chưa khớp.' });
      return;
    }
    setState({ status: 'submitting' });
    const result = await signUpWithEmail({ fullName, email, password });
    if (result.status === 'ok') {
      // Co session ngay: ghi referrer luon; loi claim khong chan dang ky.
      await claimStoredReferralCode();
      router.push('/hoc-vien');
    } else if (result.status === 'confirm-email') {
      setState({ status: 'confirm-email', message: result.message });
    } else {
      setState({ status: 'error', message: result.message });
    }
  }

  const submitting = state.status === 'submitting';

  return (
    <div className="wrap">
      <div className="auth-card">
        <h1 className="gold-title">Đăng ký</h1>
        <p>Tạo tài khoản học viên Visfar Academy để ghi danh khóa học và theo dõi tiến độ.</p>
        {referral && referral.valid && (
          <div className="notice success" role="status">
            <p>
              Bạn đăng ký qua mã giới thiệu <strong>{referral.code}</strong> — người giới thiệu sẽ
              nhận hoa hồng khi bạn mua khóa học.
            </p>
          </div>
        )}
        {referral && !referral.valid && (
          <div className="notice" role="status">
            <p>Mã giới thiệu trong link không hợp lệ hoặc không tồn tại — bạn vẫn đăng ký bình thường.</p>
          </div>
        )}
        {state.status === 'confirm-email' ? (
          <div className="notice success" role="status">
            <p>
              <strong>Đã tạo tài khoản.</strong>
            </p>
            <p>{state.message}</p>
            {resend.status === 'sent' ? (
              <p>Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư (cả hộp thư rác).</p>
            ) : (
              <p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={resend.status === 'sending'}
                  onClick={() => void onResend()}
                >
                  {resend.status === 'sending' ? 'Đang gửi…' : 'Gửi lại email xác nhận'}
                </button>
              </p>
            )}
            {resend.status === 'error' && <p>{resend.message}</p>}
            <p>
              <Link href="/dang-nhap">Tới trang đăng nhập</Link>
            </p>
          </div>
        ) : (
          <form className="auth-form" noValidate onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="signup-name">Họ và tên *</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                required
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-email">Email *</label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                placeholder="ban@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-password">Mật khẩu *</label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Ít nhất 8 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-password-confirm">Nhập lại mật khẩu *</label>
              <input
                id="signup-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Nhập lại mật khẩu"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={submitting}
              />
            </div>
            {state.status === 'error' && (
              <div className="notice error" role="alert">
                <p>{state.message}</p>
              </div>
            )}
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
            </button>
          </form>
        )}
        <p>
          Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
