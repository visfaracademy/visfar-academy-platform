// Trang /hoc-vien/doi-mat-khau — doi mat khau khi da dang nhap.
// Can nhap mat khau hien tai de xac minh (xem changePassword).
// Duoc bao ve boi layout /hoc-vien (middleware + useRequireAuth).
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { changePassword, signOutAllDevices } from '@/lib/auth';

type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'done' }
  | { status: 'error'; message: string };

export default function DoiMatKhauPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [signedOutAll, setSignedOutAll] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'submitting' });
    const result = await changePassword({ currentPassword, newPassword, confirmPassword });
    if (result.status === 'ok') {
      setState({ status: 'done' });
    } else {
      setState({ status: 'error', message: result.message });
    }
  }

  async function onSignOutAll() {
    setSigningOutAll(true);
    const result = await signOutAllDevices();
    setSigningOutAll(false);
    if (result.status === 'ok') {
      setSignedOutAll(true);
    } else {
      setState({ status: 'error', message: result.message });
    }
  }

  const submitting = state.status === 'submitting';
  const reqLength = newPassword.length >= 8;
  const reqDifferent = newPassword.length > 0 && newPassword !== currentPassword;
  const reqMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="wrap">
      <div className="auth-card">
        <h1 className="gold-title">Đổi mật khẩu</h1>
        {state.status === 'done' ? (
          <div className="notice success" role="status">
            <p>
              <strong>Đã đổi mật khẩu.</strong>
            </p>
            <p>
              Các thiết bị khác vẫn giữ phiên đăng nhập cũ cho tới khi token của chúng hết hạn
              (thường trong vòng 1 giờ). Nếu bạn nghi ngờ tài khoản bị lộ, hãy đăng xuất khỏi tất
              cả thiết bị bên dưới.
            </p>
            <p>
              <Link className="btn" href="/hoc-vien">
                Về dashboard
              </Link>
            </p>
          </div>
        ) : (
          <form className="auth-form" noValidate onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="current-password">Mật khẩu hiện tại *</label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Mật khẩu hiện tại"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="change-new-password">Mật khẩu mới *</label>
              <input
                id="change-new-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Ít nhất 8 ký tự, khác mật khẩu hiện tại"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="change-new-password-confirm">Nhập lại mật khẩu mới *</label>
              <input
                id="change-new-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            {state.status === 'error' && (
              <div className="notice error" role="alert">
                <p>{state.message}</p>
              </div>
            )}
            <ul className="password-checklist" aria-label="Yêu cầu mật khẩu mới">
              <li className={reqLength ? 'met' : ''}>
                {reqLength ? '✓' : '○'} Ít nhất 8 ký tự
              </li>
              <li className={reqDifferent ? 'met' : ''}>
                {reqDifferent ? '✓' : '○'} Khác mật khẩu hiện tại
              </li>
              <li className={reqMatch ? 'met' : ''}>
                {reqMatch ? '✓' : '○'} Nhập lại khớp với mật khẩu mới
              </li>
            </ul>
            <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
            </button>
          </form>
        )}

        <section aria-labelledby="signout-all-title" style={{ marginTop: '2rem' }}>
          <h2 id="signout-all-title" className="gold-title">Đăng xuất mọi thiết bị</h2>
          {signedOutAll ? (
            <div className="notice success" role="status">
              <p>Đã đăng xuất khỏi tất cả thiết bị. Vui lòng đăng nhập lại.</p>
              <p>
                <Link className="btn" href="/dang-nhap">
                  Đăng nhập lại
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p>
                Thu hồi phiên đăng nhập trên tất cả thiết bị (kể cả thiết bị này). Access token
                đã cấp vẫn dùng được tới khi hết hạn (thường trong vòng 1 giờ) — đây là giới hạn
                của Supabase Auth.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={signingOutAll}
                onClick={() => void onSignOutAll()}
              >
                {signingOutAll ? 'Đang đăng xuất…' : 'Đăng xuất khỏi tất cả thiết bị'}
              </button>
            </>
          )}
        </section>

        <div className="auth-links">
          <Link href="/hoc-vien">Quay lại dashboard</Link>
        </div>
      </div>
    </div>
  );
}
