// Supabase client PHIA SERVER — Task 07 phan 3/4 (SECURITY + ADMIN).
//
// Dung o Server Component / Route Handler (khong dung o client).
// Doc access_token tu cookie phien (do supabase.ts dong bo tu
// localStorage) roi goi Supabase bang ANON KEY + header Authorization:
// Bearer <access_token>. Moi query sau do chay duoi RLS theo dung JWT
// cua nguoi goi — server KHONG dung service-role key (khong co key do
// o apps/web), nen RLS van la lop chan cuoi. Tinh hop le cua token
// duoc Supabase Auth xac minh khi goi auth.getUser() (goi Auth API
// that, khong chi doc `exp` nhu middleware).
//
// GIOI HAN: access token chi song toi da ~1 gio; refresh token trong
// cookie khong duoc dung o day — neu token het han, getUser() tra
// null va caller phai chuyen ve dang nhap (client se refresh roi
// goi lai). Khong tu refresh trong server component de tranh ghi
// cookie tu 2 noi.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getAuthCookieName, parseStoredSessionValue } from './session-guard';

/** Tao client server tu 1 access token da co (test / route da parse san). */
export function createServerSupabaseClient(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !accessToken) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Doc cookie phien o server va tra client mang JWT cua nguoi goi.
 * Tra null khi: chua cau hinh Supabase, khong co cookie, cookie khong
 * parse duoc (khi do caller coi nhu chua dang nhap).
 */
export async function getServerSupabaseClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const cookieName = getAuthCookieName(url);
  if (!cookieName) return null;
  let raw: string | undefined;
  try {
    raw = (await cookies()).get(cookieName)?.value;
  } catch {
    return null;
  }
  const session = parseStoredSessionValue(raw);
  if (!session) return null;
  return createServerSupabaseClient(session.access_token);
}

/** Lay user hien tai qua Auth API (verify token that). Tra null khi token loi/het han. */
export async function getServerUser(
  client: SupabaseClient,
): Promise<{ id: string; email: string | null } | null> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}
