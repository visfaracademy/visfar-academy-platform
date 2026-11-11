// Trang /hoc-vien/chung-chi — chung chi hoan thanh (certificates).
// Chi cap khi enrollment completed (server cap qua Workers).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import {
  getMyCertificates,
  type CertificateItem,
  type DashboardState,
} from '@/lib/dashboard';
import CertificateCard from '@/components/certificate/CertificateCard';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default function ChungChiPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<DashboardState<CertificateItem[]>>({ status: 'success', data: [] });

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') setState(await getMyCertificates());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (authState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải chứng chỉ…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Chứng chỉ của tôi</h1>
        <div className="notice" role="status">
          <p>
            Bạn chưa đăng nhập.{' '}
            <Link className="btn" href="/dang-nhap">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    );
  }
  if (authState.status === 'error' || authState.status === 'not-configured') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Chứng chỉ của tôi</h1>
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

  const items = state.status === 'success' ? state.data : [];

  return (
    <div className="wrap">
      <h1 className="gold-title">Chứng chỉ của tôi</h1>
      <DashboardNav />

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được chứng chỉ.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status === 'success' && items.length === 0 && (
        <div className="notice">
          <p>Bạn chưa có chứng chỉ nào.</p>
          <p>Chứng chỉ được cấp khi bạn hoàn thành 100% bài học của một khóa và đạt ngưỡng bài kiểm tra (mặc định 70%).</p>
          <p>
            <Link className="btn" href="/hoc-vien/khoa-hoc">
              Xem tiến độ khóa học
            </Link>
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="course-grid">
          {items.map((c) => (
            <CertificateCard
              key={c.id}
              certificateCode={c.certificateCode}
              courseTitle={c.courseTitle}
              courseSlug={c.courseSlug}
              status={c.status}
              issuedAt={c.issuedAt}
            />
          ))}
        </div>
      )}
      {items.length > 0 && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          Chứng chỉ được cấp khi bạn hoàn thành 100% bài học của một khóa và đạt ngưỡng bài
          kiểm tra (mặc định 70%). Quét mã QR trên chứng chỉ để mở trang xác thực công khai.
        </p>
      )}
    </div>
  );
}
