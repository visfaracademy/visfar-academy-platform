// Trang /hoc-vien/thong-bao — thong bao in-app (notifications),
// moi nhat truoc. Hoc vien tu danh dau da doc (RLS cho phep UPDATE
// is_read cua chinh minh).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type DashboardState,
  type NotificationItem,
} from '@/lib/dashboard';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default function ThongBaoPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<DashboardState<NotificationItem[]>>({ status: 'success', data: [] });
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') setState(await getMyNotifications());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMarkOne(id: string) {
    const res = await markNotificationRead(id);
    if (res.status === 'ok') {
      setState((prev) =>
        prev.status === 'success'
          ? { status: 'success', data: prev.data.map((n) => (n.id === id ? { ...n, isRead: true } : n)) }
          : prev,
      );
    } else {
      setActionMsg(res.message);
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    const res = await markAllNotificationsRead();
    setMarkingAll(false);
    if (res.status === 'ok') {
      setState((prev) =>
        prev.status === 'success'
          ? { status: 'success', data: prev.data.map((n) => ({ ...n, isRead: true })) }
          : prev,
      );
      setActionMsg(`Đã đánh dấu ${res.updated} thông báo là đã đọc.`);
    } else {
      setActionMsg(res.message);
    }
  }

  if (authState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải thông báo…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Thông báo</h1>
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
        <h1 className="gold-title">Thông báo</h1>
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
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="wrap">
      <h1 className="gold-title">Thông báo</h1>
      <DashboardNav />

      {actionMsg && (
        <div className="notice" role="status">
          <p>{actionMsg}</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được thông báo.</strong>
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
          <p>Bạn chưa có thông báo nào.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <p>
            {unread > 0 ? (
              <>
                {unread} thông báo chưa đọc.{' '}
                <button type="button" className="btn btn-ghost" disabled={markingAll} onClick={() => void handleMarkAll()}>
                  {markingAll ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}
                </button>
              </>
            ) : (
              'Tất cả thông báo đã được đọc.'
            )}
          </p>
          <ul className="dashboard-list">
            {items.map((n) => (
              <li key={n.id} className={`list-row${n.isRead ? '' : ' unread'}`}>
                <p>
                  <strong>{n.title}</strong>
                  {!n.isRead && <span className="pill"> Mới</span>}
                </p>
                {n.body && <p>{n.body}</p>}
                <p className="muted">
                  {new Date(n.createdAt).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p>
                  {n.actionUrl && (
                    <>
                      <Link href={n.actionUrl}>Xem chi tiết</Link>{' '}
                    </>
                  )}
                  {!n.isRead && (
                    <button type="button" className="btn btn-ghost" onClick={() => void handleMarkOne(n.id)}>
                      Đánh dấu đã đọc
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
