// Trang /auth/callback — dich cua moi link email Supabase Auth
// (xac minh dang ky, quen mat khau, doi email).
// - Link dang PKCE (?code=...): doi code lay session.
// - Link dang hash (#access_token=...): supabase-js tu nhan session
//   nho detectSessionInUrl khi khoi tao client.
// Xong -> chuyen ve `next` (chi duong dan noi bo, chan open-redirect).
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { exchangeCodeForSession } from '@/lib/auth';
import { safeNextPath } from '@/lib/session-guard';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type State =
  | { status: 'working' }
  | { status: 'error'; message: string };

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State>({ status: 'working' });
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const next = safeNextPath(params.get('next'), '/hoc-vien');
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');
    if (errorParam) {
      setState({
        status: 'error',
        message:
          errorDescription && errorDescription.toLowerCase().includes('expired')
            ? 'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.'
            : 'Liên kết không hợp lệ. Vui lòng yêu cầu liên kết mới.',
      });
      return;
    }
    const code = params.get('code');
    async function finish() {
      if (code) {
        const result = await exchangeCodeForSession(code);
        if (result.status === 'error') {
          setState({ status: 'error', message: result.message });
          return;
        }
        router.replace(next);
        return;
      }
      // Khong co code: co the la link dang hash — client tu nhan
      // session nho detectSessionInUrl. Kiem tra session hien tai.
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setState({ status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' });
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace(next);
      } else {
        setState({
          status: 'error',
          message: 'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.',
        });
      }
    }
    void finish();
  }, [params, router]);

  if (state.status === 'error') {
    return (
      <div className="wrap">
        <div className="auth-card">
          <h1 className="gold-title">Liên kết không dùng được</h1>
          <div className="notice error" role="alert">
            <p>{state.message}</p>
          </div>
          <div className="auth-links">
            <Link className="btn" href="/quen-mat-khau">
              Yêu cầu liên kết đặt lại mật khẩu mới
            </Link>
            <Link className="btn btn-ghost" href="/dang-nhap">
              Về trang đăng nhập
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="auth-card">
        <p role="status" aria-live="polite">
          Đang xác nhận liên kết…
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap">
          <div className="auth-card">
            <p role="status">Đang xác nhận liên kết…</p>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
