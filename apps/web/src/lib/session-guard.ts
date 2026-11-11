// Session guard — ham thuan (khong phu thuoc Next/Supabase) de
// middleware (Edge) va client dung chung, va de unit test.
// Bao mat that van do RLS + Supabase Auth dam bao; middleware o day
// chi la lop dinh tuyen (khong co session hop le -> ve /dang-nhap),
// khong thay the kiem tra quyen o DB/API.

/** Ten cookie phien Supabase: sb-<project-ref>-auth-token. */

/** Thoi gian toi da cho mot lan kiem tra phien o guard client (ms).
 * Qua thoi gian nay khong xac minh duoc thi coi nhu loi (hien nut Thu
 * lai) thay vi ket vinh vien o man hinh cho — xem useRequireAuth. */
export const AUTH_CHECK_TIMEOUT_MS = 10_000;

/** Race mot promise voi timeout: qua `ms` thi reject (de guard khong
 * cho mai khi Supabase treo — fetch trong supabase-js khong co timeout). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('auth-check-timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
export function getAuthCookieName(supabaseUrl: string | undefined | null): string | null {
  if (!supabaseUrl) return null;
  try {
    const host = new URL(supabaseUrl).hostname; // <ref>.supabase.co
    const ref = host.split('.')[0];
    if (!ref) return null;
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
}

/** Chi cho phep redirect noi bo dang '/...' (chan open-redirect). */
export function isSafeNextPath(next: string | null | undefined): next is string {
  if (!next || typeof next !== 'string') return false;
  if (!next.startsWith('/')) return false;
  if (next.startsWith('//')) return false;
  if (next.includes('\\')) return false;
  if (/[\r\n]/.test(next)) return false;
  return true;
}

export function safeNextPath(next: string | null | undefined, fallback = '/hoc-vien'): string {
  return isSafeNextPath(next) ? next : fallback;
}

function base64UrlDecodeToString(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const g = globalThis as unknown as {
      atob?: (s: string) => string;
      Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
    };
    let binary: string;
    if (typeof g.atob === 'function') {
      binary = g.atob(padded);
    } else if (g.Buffer) {
      return g.Buffer.from(padded, 'base64').toString('utf-8');
    } else {
      return null;
    }
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Doc claim `exp` (giay) tu JWT ma KHONG verify chu ky — chi dung de
 *  dinh tuyen o middleware. Verify that do Supabase/RLS dam nhiem. */
export function decodeJwtExp(jwt: string | null | undefined): number | null {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const payload = base64UrlDecodeToString(parts[1]);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload) as { exp?: unknown };
    return typeof data.exp === 'number' && Number.isFinite(data.exp) ? data.exp : null;
  } catch {
    return null;
  }
}

/** Doc claim `sub` (id user, UUID) tu JWT ma KHONG verify chu ky —
 *  chi dung de hoi Supabase REST `profiles.is_disabled` cua chinh user
 *  do (S-01). Supabase tu verify token khi nhan request REST. */
export function decodeJwtSub(jwt: string | null | undefined): string | null {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const payload = base64UrlDecodeToString(parts[1]);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload) as { sub?: unknown };
    return typeof data.sub === 'string' && data.sub ? data.sub : null;
  } catch {
    return null;
  }
}

/** true khi token da het han (tru 30 giay lech dong ho). */
export function isTokenExpired(expSeconds: number | null | undefined, nowMs = Date.now()): boolean {
  if (expSeconds === null || expSeconds === undefined) return false;
  return expSeconds * 1000 <= nowMs + 30_000;
}

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
}

/** Parse gia tri cookie phien (JSON day du do supabase-js luu).
 *  Tra null khi khong parse duoc — middleware se coi nhu chua dang nhap. */
export function parseStoredSessionValue(raw: string | null | undefined): StoredSession | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const data = JSON.parse(decoded) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_at?: unknown;
    };
    if (typeof data.access_token !== 'string' || !data.access_token) return null;
    if (typeof data.refresh_token !== 'string' || !data.refresh_token) return null;
    const expiresAt =
      typeof data.expires_at === 'number'
        ? data.expires_at
        : decodeJwtExp(data.access_token);
    return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: expiresAt };
  } catch {
    return null;
  }
}
