// Supabase client — FRONTEND CHI DUNG ANON KEY.
// Service-role key KHONG BAO GIO xuat hien trong file nay hay bat ky
// file nao o apps/web. Mọi ghi nhay cam (lead/order/progress) se di
// qua Cloudflare Workers API o Module 2+.
//
// Task 05: bat session persistence (persistSession + autoRefreshToken)
// de trang dang nhap / dang ky / dashboard giu duoc phien Supabase Auth.
// Truoc Task 05 client nay co persistSession: false — dung cho doc cong
// khai, nhung khong giu duoc dang nhap. Doc cong khai khong thay doi:
// van chi dung anon key + RLS cho phep doc cong khai.
//
// Task 06: storage dong bo them sang cookie (cung key sb-*-auth-token)
// de middleware (chay o server, khong doc duoc localStorage) kiem tra
// duoc phien va chan /hoc-vien/* khi chua dang nhap. localStorage van
// la noi luu chinh cua client; cookie chi la ban sao de dinh tuyen —
// bao mat that van do RLS + Supabase Auth dam bao, khong do cookie.
// Gia tri cookie la toan bo JSON phien (nhu localStorage) nen neu
// localStorage trong ma cookie con thi client van khoi phuc duoc.
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function readCookie(key: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${key}=`));
    if (!match) return null;
    return decodeURIComponent(match.slice(key.length + 1));
  } catch {
    return null;
  }
}

function writeCookie(key: string, value: string): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    // Refresh token mac dinh co han dai; cookie 7 ngay, se duoc ghi de
    // moi lan token refresh. Dang xuat xoa cookie (removeItem).
    document.cookie =
      `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=604800; SameSite=Lax${secure}`;
  } catch {
    // Ghi cookie that bai (vd: qua lon) -> localStorage van giu phien;
    // middleware khi do chi khong thay cookie va chuyen ve dang nhap.
  }
}

function deleteCookie(key: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // Bo qua — localStorage da duoc xoa o removeItem.
  }
}

/**
 * Storage cho Supabase Auth: localStorage + dong bo cookie.
 * Chi dong bo key phien chinh (ket thuc bang '-auth-token'); cac key
 * phu nhu code-verifier (PKCE, ngan han) chi luu localStorage.
 *
 * 2026-11-11 — chon phien MOI HON khi ca hai noi deu co (cookie co the
 * moi hon localStorage sau khi middleware refresh token phia server va
 * rotate refresh token; lay phien cu thi client se thu refresh bang
 * token da bi thu hoi -> bi day ve dang nhap du phien van con han).
 * Chi so sanh `expires_at`; parse loi thi giu hanh vi cu (uu tien
 * localStorage).
 */
function sessionExpiresAt(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { expires_at?: unknown };
    return typeof data.expires_at === 'number' && Number.isFinite(data.expires_at)
      ? data.expires_at
      : null;
  } catch {
    return null;
  }
}

export function createCookieSyncStorage(): SupportedStorage {
  const isTokenKey = (key: string) => key.endsWith('-auth-token');
  return {
    getItem(key: string): string | null {
      let fromStorage: string | null = null;
      try {
        if (typeof localStorage !== 'undefined') {
          fromStorage = localStorage.getItem(key);
        }
      } catch {
        // localStorage khong dung duoc (vd: che do rieng tu) -> doc cookie.
      }
      if (!isTokenKey(key)) return fromStorage;
      const fromCookie = readCookie(key);
      if (fromStorage === null) return fromCookie;
      if (fromCookie === null) return fromStorage;
      const expStorage = sessionExpiresAt(fromStorage);
      const expCookie = sessionExpiresAt(fromCookie);
      if (expCookie !== null && (expStorage === null || expCookie > expStorage)) {
        return fromCookie;
      }
      return fromStorage;
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      } catch {
        // Bo qua — cookie ben duoi van luu duoc phien.
      }
      if (isTokenKey(key)) writeCookie(key, value);
    },
    removeItem(key: string): void {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      } catch {
        // Bo qua.
      }
      if (isTokenKey(key)) deleteCookie(key);
    },
  };
}

/** Tra ve null khi chua cau hinh — caller PHAI xu ly trang thai loi, khong fake du lieu.
 *
 * 2026-11-11 — singleton o trinh duyet: truoc day moi lan goi la tao
 * mot client moi, nen mot trang /hoc-vien co 4-5 client cung khoi tao
 * va cung refresh token doc lap (dua nhau rotate token, nhieu ticker
 * auto-refresh). Mot client duy nhat cho ca phien trinh duyet.
 * O server (SSR) van tao moi moi lan goi de khong dung chung trang
 * thai giua cac request. */
let cachedBrowserClient: SupabaseClient | null = null;
let cachedBrowserClientKey = '';
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (typeof window === 'undefined') {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: createCookieSyncStorage(),
      },
    });
  }
  const cacheKey = `${url}|${anonKey}`;
  if (cachedBrowserClient && cachedBrowserClientKey === cacheKey) {
    return cachedBrowserClient;
  }
  cachedBrowserClient = createClient(url, anonKey, {
    auth: {
      // Giu phien dang nhap tren trinh duyet (localStorage mac dinh).
      // Can cho AccountNav / /hoc-vien. Khong anh huong doc cong khai.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: createCookieSyncStorage(),
    },
  });
  cachedBrowserClientKey = cacheKey;
  return cachedBrowserClient;
}

/** Alias ro nghia cho code auth — cung mot client browser, cung anon key. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  return getSupabaseClient();
}
