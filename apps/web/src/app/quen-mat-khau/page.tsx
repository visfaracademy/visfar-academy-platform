// Trang /quen-mat-khau — gui email dat lai mat khau.
// Trang thai: idle / submitting / sent / error. Thong bao sau khi gui
// luon chung chung (khong tiet lo email co ton tai hay khong).
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { requestPasswordReset } from '@/lib/auth';

type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string };

export default function QuenMatKhauPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'submitting' });
    const result = await requestPasswordReset(email);
    if (result.status === 'ok') {
      setState({ status: 'sent', email: email.trim() });
    } else {
      setState({ status: 'error', message: result.message });
    }
  }

  const submitting = state.status === 'submitting';

  return (
    <div className="wrap">
      <div className="auth-card">
        <h1 className="gold-title">Quên mật khẩu</h1>
        {state.status === 'sent' ? (
          <div className="notice success" role="status">
            <p>
              <strong>Đã gửi email đặt lại mật khẩu.</strong>
            </p>
            <p>
              Nếu email <strong>{state.email}</strong> đã đăng ký, bạn sẽ nhận được liên kết đặt
              lại mật khẩu trong vài phút. Vui lòng kiểm tra cả hộp thư rác.
            </p>
            <p>
              <Link href="/dang-nhap">Về trang đăng nhập</Link>
            </p>
          </div>
        ) : (
          <>
            <p>Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu cho bạn.</p>
            <form className="auth-form" noValidate onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="reset-email">Email *</label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="ban@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
              {state.status === 'error' && (
                <div className="notice error" role="alert">
                  <p>{state.message}</p>
                </div>
              )}
              <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? 'Đang gửi…' : 'Gửi liên kết đặt lại mật khẩu'}
              </button>
            </form>
          </>
        )}
        <div className="auth-links">
          <Link href="/dang-nhap">Quay lại đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
