// GET /api/health — kiem tra API song THAT (giong apps/web /api/health).
// KHONG fake ok khi chua ket noi duoc: chua cau hinh -> 503;
// query that loi -> 503; chi 200 khi select that 1 dong courses thanh cong.
// Cron "giu am" Supabase goi endpoint nay moi ngay.
import type { Env } from '../env';
import { isSupabaseConfigured } from '../env';
import { checkSupabaseHealth } from '../supabase';
import { jsonOk } from '../errors';

export async function handleHealth(_req: Request, env: Env): Promise<Response> {
  const started = Date.now();
  const latency = () => Date.now() - started;
  if (!isSupabaseConfigured(env)) {
    return new Response(
      JSON.stringify({
        ok: false,
        status: 'not_configured',
        message: 'Chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.',
        latency_ms: latency(),
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
  try {
    const healthy = await checkSupabaseHealth(env);
    if (!healthy) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: 'supabase_error',
          message: 'Không đọc được bảng courses từ Supabase.',
          latency_ms: latency(),
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return jsonOk({ status: 'ok', latency_ms: latency() }, 200);
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        status: 'unreachable',
        message: 'Không kết nối được Supabase.',
        latency_ms: latency(),
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
