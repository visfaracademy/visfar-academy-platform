export const runtime = 'edge';
// GET /api/v1/certificates/verify?code=... — tra cuu cong khai.
// Chi goi RPC verify_certificate (migration 0016): ham SECURITY DEFINER
// chi tra ma, ten hoc vien, ten/slug khoa, ngay cap, trang thai.
// Khong SELECT truc tiep bang certificates (RLS chan anon, va mo RLS
// cong khai se lo user_id). 404 = khong tim thay ma (khong phai loi).
import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { normalizeCertificateCode, verifyCertificateByCode } from '@/lib/certificates';

export async function GET(req: Request): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Chưa cấu hình Supabase.' },
      { status: 503 },
    );
  }
  const code = normalizeCertificateCode(new URL(req.url).searchParams.get('code') ?? '');
  if (!code) {
    return NextResponse.json(
      { ok: false, error: 'Vui lòng nhập mã chứng chỉ.' },
      { status: 400 },
    );
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Chưa cấu hình Supabase.' },
      { status: 503 },
    );
  }
  const result = await verifyCertificateByCode(supabase, code);
  if (result.status === 'error') {
    return NextResponse.json({ ok: false, error: result.message }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json(
      { ok: false, error: 'Không tìm thấy chứng chỉ với mã này.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, certificate: result.data });
}
