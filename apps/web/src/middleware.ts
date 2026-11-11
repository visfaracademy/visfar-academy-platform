// Middleware — route guard cho /hoc-vien/* (Task 06) + S-01.
// Doc cookie phien sb-*-auth-token (do storage o supabase.ts dong bo
// tu localStorage sang cookie). Chua dang nhap / phien het han va
// refresh that bai -> redirect ve /dang-nhap?next=<duong dan goc>.
// S-01: tai khoan bi vo hieu hoa (profiles.is_disabled = true) ->
// dang xuat (thu hoi refresh token qua Auth API + xoa cookie phien)
// roi redirect ve /dang-nhap?reason=disabled.
//
// GIOI HAN (ghi ro, khong gia vo): middleware chi doc `exp`/`sub` cua
// JWT ma khong verify chu ky — day chi la lop dinh tuyen. Tinh hop le
// cua token duoc Supabase tu xac minh khi middleware goi REST
// /rest/v1/profiles (Bearer token) va Auth API: token gia se bi
// Supabase tu choi o do. Bao mat that van do Supabase Auth + RLS dam
// bao o moi query; token gia khong doc duoc is_disabled cua ai.
// Neu Supabase REST loi / khong tra loi, middleware CHO QUA (fail-open)
// va lop 2 o layout /hoc-vien se chan lai — khong khoa cung toan
// trang vi loi mang tam thoi.
import { NextRequest, NextResponse } from 'next/server';
import {
  decodeJwtExp,
  decodeJwtSub,
  getAuthCookieName,
  isTokenExpired,
  parseStoredSessionValue,
} from '@/lib/session-guard';

export const config = {
  // Task 06: /hoc-vien/* — chi nguoi dang nhap.
  // Task 07 phan 3/4: /admin/* + /api/admin/* — chi nguoi dang nhap
  // moi qua duoc middleware; quyen admin that do requireAdmin()
  // kiem tra o server layout / route (doc role tu DB, khong tin cookie).
  matcher: ['/hoc-vien/:path*', '/admin', '/admin/:path*', '/api/admin/:path*'],
};

function loginRedirect(req: NextRequest, reason?: string): NextResponse {
  // API admin: tra JSON 401 thay vi redirect (client fetch can doc).
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: 'Bạn chưa đăng nhập.' },
      { status: 401 },
    );
  }
  const url = new URL('/dang-nhap', req.url);
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

/** S-01: tra ve response chan tai khoan bi vo hieu hoa + xoa cookie phien. */
function disabledRedirect(req: NextRequest, cookieName: string): NextResponse {
  // API admin: tra JSON 403 thay vi redirect (client fetch can doc).
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const res = NextResponse.json(
      { ok: false, error: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.' },
      { status: 403 },
    );
    res.cookies.delete(cookieName);
    return res;
  }
  const url = new URL('/dang-nhap', req.url);
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  url.searchParams.set('reason', 'disabled');
  const res = NextResponse.redirect(url);
  res.cookies.delete(cookieName);
  return res;
}

/**
 * S-01: hoi Supabase REST xem profiles.is_disabled cua user co true
 * khong. Chi tra true khi Supabase tra ve 1 dong is_disabled = true.
 * Moi truong hop khac (loi mang, token loi, khong co dong, parse loi)
 * -> false (fail-open; layout /hoc-vien la lop chan thu 2).
 * Token duoc Supabase verify o phia server khi nhan request nay —
 * middleware khong tu verify chu ky (xem GIOI HAN o dau file).
 */
async function isAccountDisabled(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
): Promise<boolean> {
  const userId = decodeJwtSub(accessToken);
  if (!userId) return false;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=is_disabled&id=eq.${encodeURIComponent(userId)}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ is_disabled?: unknown }>;
    return Array.isArray(rows) && rows.length > 0 && rows[0]?.is_disabled === true;
  } catch {
    return false;
  }
}

/** S-01: thu hoi refresh token qua Auth API (best-effort, khong chan redirect). */
async function revokeSessionBestEffort(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Bo qua — cookie phien da bi xoa o disabledRedirect, access token
    // con lai tu het han (thuong <= 1 gio) va RLS khong cho no ghi gi.
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookieName = getAuthCookieName(supabaseUrl);
  // Chua cau hinh Supabase -> de request qua, trang client se hien
  // trang thai 'not-configured' (khong khoa c ung toan trang vi loi cau hinh).
  if (!cookieName || !supabaseUrl || !anonKey) return NextResponse.next();

  const raw = req.cookies.get(cookieName)?.value;
  const session = parseStoredSessionValue(raw);
  if (!session) return loginRedirect(req);

  let accessToken = session.access_token;
  let refreshedCookie: string | null = null;

  const exp = session.expires_at ?? decodeJwtExp(session.access_token);
  if (isTokenExpired(exp)) {
    // Access token het han: thu refresh bang refresh_token (grant
    // refresh_token cua Supabase Auth API). Thanh cong -> cap nhat
    // cookie phien moi va cho qua; that bai -> ve dang nhap.
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) return loginRedirect(req, 'expired');
      const data = (await res.json()) as {
        access_token?: unknown;
        refresh_token?: unknown;
        expires_at?: unknown;
        expires_in?: unknown;
      };
      if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
        return loginRedirect(req, 'expired');
      }
      accessToken = data.access_token;
      const expiresAt =
        typeof data.expires_at === 'number'
          ? data.expires_at
          : typeof data.expires_in === 'number'
            ? Math.floor(Date.now() / 1000) + data.expires_in
            : null;
      refreshedCookie = JSON.stringify({ ...data, expires_at: expiresAt });
    } catch {
      return loginRedirect(req, 'expired');
    }
  }

  // S-01: tai khoan bi vo hieu hoa -> dang xuat + ve dang nhap.
  if (await isAccountDisabled(supabaseUrl, anonKey, accessToken)) {
    await revokeSessionBestEffort(supabaseUrl, anonKey, accessToken);
    return disabledRedirect(req, cookieName);
  }

  const next = NextResponse.next();
  if (refreshedCookie) {
    next.cookies.set(cookieName, encodeURIComponent(refreshedCookie), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
    });
  }
  return next;
}
