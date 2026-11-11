// Layout /hoc-vien/* — lop chan client (lop 2 sau middleware):
// chua dang nhap -> chuyen ve /dang-nhap?next=<duong dan hien tai>.
// Phien het han hoac bi dang xuat tu thiet bi khac -> tu chuyen ve
// dang nhap nho useRequireAuth lang nghe SIGNED_OUT.
// S-01: tai khoan bi vo hieu hoa (profiles.is_disabled = true) ->
// sign-out roi chuyen ve /dang-nhap?reason=disabled (thong bao
// "tai khoan da bi vo hieu hoa" hien o trang dang nhap).
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { checkCurrentAccountDisabled, signOut } from '@/lib/auth';
import { claimStoredReferralCode } from '@/lib/referrals';
import { useRequireAuth } from '@/lib/useRequireAuth';

export default function HocVienLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useRequireAuth();
  const [disabledState, setDisabledState] = useState<'idle' | 'checking' | 'disabled' | 'ok' | 'error'>(
    'idle',
  );
  const signingOutRef = useRef(false);
  const referralClaimedRef = useRef(false);

  // Ghi ma gioi thieu da luu tam o /dang-ky?ref= (truong hop dang ky
  // phai xac nhan email nen luc signUp chua co session). Best effort,
  // im lang — khong chan trang hoc vien.
  useEffect(() => {
    if (status !== 'authed' || referralClaimedRef.current) return;
    referralClaimedRef.current = true;
    void claimStoredReferralCode();
  }, [status]);

  useEffect(() => {
    if (status === 'signed-out') {
      router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  // S-01: lop chan thu 2 sau middleware — tai khoan bi disable sau khi
  // middleware da cho qua (vd bi admin disable giua phien) thi sign-out
  // va ve dang nhap. 'error' (khong doc duoc profiles) thi cho qua
  // (fail-open): middleware da kiem tra truoc, khong khoa trang vi loi mang.
  useEffect(() => {
    if (status !== 'authed' || disabledState !== 'idle') return;
    let cancelled = false;
    setDisabledState('checking');
    void (async () => {
      const result = await checkCurrentAccountDisabled();
      if (cancelled) return;
      if (result === 'disabled') {
        setDisabledState('disabled');
        if (!signingOutRef.current) {
          signingOutRef.current = true;
          await signOut();
          if (!cancelled) router.replace('/dang-nhap?reason=disabled');
        }
      } else if (result === 'active' || result === 'signed-out') {
        setDisabledState('ok');
      } else {
        setDisabledState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, disabledState, router]);

  // Chua xong kiem tra phien / kiem tra disable thi chua render con
  // (tranh loe noi dung /hoc-vien trong tich tac truoc khi chan).
  if (
    status === 'checking' ||
    (status === 'authed' && (disabledState === 'idle' || disabledState === 'checking'))
  ) {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang kiểm tra phiên đăng nhập…
        </p>
      </div>
    );
  }

  if (status === 'not-configured') {
    return (
      <div className="wrap">
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
          <p>Chưa có biến môi trường NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
        </div>
      </div>
    );
  }

  // 2026-11-11 — loi kiem tra phien (qua 10s khong xac minh duoc):
  // hien loi + nut Thu lai thay vi ket vinh vien o man hinh cho.
  // Noi dung hoc vien van bi chan cho toi khi phien duoc xac minh.
  if (status === 'error') {
    return (
      <div className="wrap">
        <div className="notice error" role="alert">
          <p>
            <strong>Không kiểm tra được phiên đăng nhập.</strong>
          </p>
          <p>
            Kết nối tới máy chủ xác thực bị gián đoạn. Vui lòng kiểm tra mạng rồi thử lại — không cần
            đăng nhập lại nếu phiên của bạn vẫn còn hạn.
          </p>
          <p>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => window.location.reload()}
            >
              Thử lại
            </button>{' '}
            <a className="btn" href="/dang-nhap">
              Đăng nhập lại
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (status === 'signed-out') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang chuyển về trang đăng nhập…
        </p>
      </div>
    );
  }

  if (disabledState === 'disabled') {
    return (
      <div className="wrap">
        <div className="notice error" role="alert">
          <p>
            <strong>Tài khoản của bạn đã bị vô hiệu hóa.</strong>
          </p>
          <p>Vui lòng liên hệ quản trị viên để được hỗ trợ. Đang chuyển về trang đăng nhập…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
