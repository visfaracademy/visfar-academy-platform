// GET /api/health — tra trang thai ket noi Supabase THAT.
// KHONG fake ok khi chua ket noi duoc: neu chua cau hinh -> 503 + ok:false;
// neu query that loi -> 503 + ok:false + error. Chi 200 khi query that thanh cong.
// Cloudflare Pages yeu cau route dong chay Edge Runtime.
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  const started = Date.now();
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        status: 'not_configured',
        message:
          'Chua cau hinh NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Xem README.md.',
        latency_ms: Date.now() - started,
      },
      { status: 503 },
    );
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, status: 'not_configured', latency_ms: Date.now() - started },
      { status: 503 },
    );
  }
  try {
    // KHONG dung { head: true }: supabase-js tra error=null + data=null
    // ca khi bang khong ton tai (PostgREST PGRST205 bi nuot) — health se
    // bao ok:true gia tren project chua migrate (da kiem chung that
    // ngay 10/11/2026: ca prod + staging deu 0 bang nhung route cu van
    // tra 200 ok:true). Select that 1 dong: bang thieu -> error ->
    // 503; bang co -> data la mang (co the rong) -> 200.
    const { data, error } = await supabase.from('courses').select('id').limit(1);
    if (error || data === null) {
      return NextResponse.json(
        {
          ok: false,
          status: 'supabase_error',
          message: error ? error.message : 'Khong doc duoc bang courses.',
          latency_ms: Date.now() - started,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      status: 'ok',
      latency_ms: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: 'unreachable',
        message: err instanceof Error ? err.message : 'Khong ket noi duoc Supabase.',
        latency_ms: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
