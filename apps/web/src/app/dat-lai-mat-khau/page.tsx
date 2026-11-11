// Trang /dat-lai-mat-khau — dat mat khau moi bang phien recovery
// (mo tu link trong email quen mat khau, qua /auth/callback).
// Chua co phien -> huong dan mo lai link trong email, khong cho dat.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSessionState, resetPasswordWithSession } from '@/lib/auth';

type PageState =
  | { status: 'checking' }
  | { status: 'no-session' }
  | { status: 'ready' }
  | { status: 'submitting' }
  | { status: 'done' }
  | { status: 'error'; message: string };

export default function DatLaiMatKhauPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [state, setState] = useState<PageState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const session = await getSessionState();
      if (cancelled) return;
      setState(session.status === 'active' ? { status: 'ready' } : { status: 'no-session' });
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setState({ status: 'error', message: 'Mật khẩu nhập lại chưa khớp.' });
      return;
    }
    setState({ status: 'submitting' });
    const result = await resetPasswordWithSession(password);
    if (result.status === 'ok') {
      setState({ status: 'done' });
    } else {
      setState({ status: 'error', message: result.message });
    }
  }

  const busy = state.status === 'checking' || state.status === 'submitting';

  return (
    <div className="wrap">
      <div className="auth-card">
        <h1 className="gold-title">Đặt lại mật khẩu</h1>
        {state.status === 'checking' && (
          <p role="status" aria-live="polite">
            Đang kiểm tra liên kết…
          </p>
        )}
        {state.status === 'no-session' && (
          <div className="notice error" role="alert">
            <p>
              <strong>Liên kết chưa được xác nhận.</strong>
            </p>
            <p>
              Vui lòng mở liên kết đặt lại mật khẩu trong email của bạn. Nếu liên kết đã hết hạn,
              hãy yêu cầu liên kết mới.
            </p>
            <p>
              <Link className="btn" href="/quen-mat-khau">
                Yêu cầu liên kết mới
              </Link>
            </p>
          </div>
        )}
        {state.status === 'done' && (
          <div className="notice success" role="status">
            <p>
              <strong>Đã đặt lại mật khẩu.</strong>
            </p>
            <p>Bạn có thể đăng nhập bằng mật khẩu mới.</p>
            <p>
              <button type="button" className="btn" onClick={() => router.push('/hoc-vien')}>
                Tới dashboard học viên
              </button>
            </p>
          </div>
        )}
        {(state.status === 'ready' || state.status === 'submitting' || state.status === 'error') && (
          <form className="auth-form" noValidate onSubmit={onSubmit}>
            <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
            <div className="field">
              <label htmlFor="new-password">Mật khẩu mới *</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Ít nhất 8 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="new-password-confirm">Nhập lại mật khẩu mới *</label>
              <input
                id="new-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Nhập lại mật khẩu mới"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={busy}
              />
            </div>
            {state.status === 'error' && (
              <div className="notice error" role="alert">
                <p>{state.message}</p>
              </div>
            )}
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
              {state.status === 'submitting' ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link href="/dang-nhap">Quay lại đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
