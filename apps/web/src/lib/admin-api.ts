// Helper dung chung cho Route Handler admin — Task 07 phan 3/4.
// Moi route admin: lay client server (JWT nguoi goi) -> requireAdmin()
// (kiem tra that o server, khong tin bat ky gi tu client) -> moi lam
// viec. Khong bao gio dung service-role key o day.
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/lms-access';
import { getServerSupabaseClient } from '@/lib/supabase-server';

export type AdminContext = { client: SupabaseClient; adminId: string };

/** Tra AdminContext khi la admin; nguoc lai tra Response loi (401/403/503). */
export async function getAdminContext(): Promise<
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse }
> {
  const client = await getServerSupabaseClient();
  if (!client) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Chưa cấu hình Supabase hoặc chưa đăng nhập.' },
        { status: 503 },
      ),
    };
  }
  const admin = await requireAdmin(client);
  if (!admin.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error:
            admin.reason === 'unauthenticated'
              ? 'Bạn chưa đăng nhập.'
              : 'Bạn không có quyền quản trị.',
        },
        { status: admin.reason === 'unauthenticated' ? 401 : 403 },
      ),
    };
  }
  return { ok: true, ctx: { client, adminId: admin.userId } };
}

/** Doc JSON body an toan — tra null khi khong phai JSON hop le. */
export async function readJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await req.json();
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}
