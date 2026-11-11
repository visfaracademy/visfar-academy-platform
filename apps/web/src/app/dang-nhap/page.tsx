// Trang /dang-nhap — Supabase Auth (email + mat khau).
// Trang thai: idle / submitting / success (chuyen ve `next` neu co,
// mac dinh /hoc-vien) / error. Neu loi la "email chua xac nhan" thi
// hien them nut gui lai email xac minh. Neu duoc middleware chuyen ve
// vi phien het han (?reason=expired) thi bao ro ly do; tai khoan bi
// vo hieu hoa (?reason=disabled, S-01) thi bao da bi vo hieu hoa.
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { resendSignUpEmail, signInWithEmail } from '@/lib/auth';
import { safeNextPath } from '@/lib/session-guard';

type ResendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'error'; message: string };

function DangNhapInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'), '/hoc-vien');
  const sessionExpired = params.get('reason') === 'expired';
  const accountDisabled = params.get('reason') === 'disabled';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resend, setResend] = useState<ResendState>({ status: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResend({ status: 'idle' });
    setSubmitting(true);
    const result = await signInWithEmail({ email, password });
    setSubmitting(false);
    if (result.status === 'ok') {
      router.push(next);
    } else {
      setError(result.message);
    }
  }

  async function onResend() {
    setResend({ status: 'sending' });
    const result = await resendSignUpEmail(email);
    if (result.status === 'ok') {
      setResend({ status: 'sent' });
    } else {
      setResend({ status: 'error', message: result.message });
    }
  }

  const showResend = error.includes('chưa được xác nhận');

  return (
    <div className="wrap">
      <div className="auth-card">
        <h1 className="gold-title">Đăng nhập</h1>
        <p>Đăng nhập để xem khóa học đã ghi danh và tiến độ học tập của bạn.</p>
        {sessionExpired && (
          <div className="notice" role="status">
            <p>Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.</p>
          </div>
        )}
        {accountDisabled && (
          <div className="notice error" role="alert">
            <p>Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.</p>
          </div>
        )}
        <form className="auth-form" noValidate onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email *</label>
            <input
              id="login-email"
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
            <label htmlFor="login-password">Mật khẩu *</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Ít nhất 8 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
          {error && (
            <div className="notice error" role="alert">
              <p>{error}</p>
            </div>
          )}
          {showResend && (
            <div className="notice" role="status">
              {resend.status === 'sent' ? (
                <p>Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư (cả hộp thư rác).</p>
              ) : (
                <>
                  <p>Chưa nhận được email xác nhận?</p>
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
                  {resend.status === 'error' && <p>{resend.message}</p>}
                </>
              )}
            </div>
          )}
          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <div className="auth-links">
          <Link href="/quen-mat-khau">Quên mật khẩu?</Link>
          <span>
            Chưa có tài khoản? <Link href="/dang-ky">Đăng ký</Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DangNhapPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap">
          <div className="auth-card">
            <p role="status">Đang tải…</p>
          </div>
        </div>
      }
    >
      <DangNhapInner />
    </Suspense>
  );
}
