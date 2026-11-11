// Hook chan trang can dang nhap (lop phong thu thu 2 sau middleware):
// kiem tra phien, tu refresh neu het han, tu dong chuyen ve dang nhap
// khi phien het han hoac bi dang xuat tu thiet bi khac.
//
// 2026-11-11 — sua ket man hinh "Dang kiem tra phien dang nhap..." bi ket
// vinh vien (user bao 16:37, tai khoan lequyet.hvnh@gmail.com): truoc day
// `getSessionState()` duoc await KHONG timeout va KHONG try/catch — chi
// can mot lan goi Supabase treo (fetch khong timeout trong supabase-js)
// hoac reject la status mai o 'checking', trang dong bang o man hinh cho
// va khong co duong thoat. Nay: timeout 10s + bat loi -> trang thai
// 'error'; layout hien man hinh loi co nut Thu lai / Dang nhap lai thay
// vi ket vinh vien. Guard van chan noi dung cho toi khi phien duoc xac
// minh (khong ha bao mat, chi them duong thoat khi khong kiem tra duoc).
'use client';

import { useEffect, useState } from 'react';
import { getSessionState, subscribeToAuthChanges, type SessionState } from '@/lib/auth';
import { AUTH_CHECK_TIMEOUT_MS, withTimeout } from '@/lib/session-guard';

export type RequireAuthStatus = 'checking' | 'authed' | 'signed-out' | 'not-configured' | 'error';

/** Qua thoi gian nay khong xac minh duoc phien thi coi nhu loi (de hien nut Thu lai). */
export { AUTH_CHECK_TIMEOUT_MS };

export function useRequireAuth(): RequireAuthStatus {
  const [status, setStatus] = useState<RequireAuthStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const state: SessionState = await withTimeout(getSessionState(), AUTH_CHECK_TIMEOUT_MS);
        if (cancelled) return;
        if (state.status === 'active') setStatus('authed');
        else if (state.status === 'not-configured') setStatus('not-configured');
        else setStatus('signed-out');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    void check();
    const unsubscribe = subscribeToAuthChanges((event) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') setStatus('signed-out');
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setStatus('authed');
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return status;
}
