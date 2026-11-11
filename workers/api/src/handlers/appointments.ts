// Handlers lich hen — lop HTTP mong (auth / rate-limit / parse body /
// response). Nghiep vu o ../appointments.ts.
//
// Endpoints (dang ky o index.ts):
//   GET   /api/v1/appointments      — lich cua minh (admin: tat ca)
//   POST  /api/v1/appointments      — hoc vien dat lich
//   PATCH /api/v1/appointments/:id  — huy / xac nhan / hoan thanh
import type { Env } from '../env';
import { ApiError, jsonOk } from '../errors';
import { checkRateLimit } from '../rate-limit';
import { requireAuthUser } from '../payments';
import { isSupabaseConfigured } from '../env';
import { readJsonBody } from './payments';
import { isUuid } from '../validation';
import {
  APPOINTMENT_STATUSES,
  createAppointment,
  getAppointmentById,
  getCallerRole,
  listAppointments,
  parseCreateAppointmentBody,
  patchAppointment,
  validateAppointmentPatch,
  type AppointmentStatus,
} from '../appointments';
import { notConfiguredError } from '../supabase';

/** Rate-limit dat lich: 5 req/gio/user — nhu leads (5/gio). */
const APPOINTMENT_RATE_LIMIT = 5;
const APPOINTMENT_RATE_WINDOW_MS = 60 * 60 * 1000;

export async function handleListAppointments(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const role = await getCallerRole(env, user.userId);
  const url = new URL(req.url);
  const rawStatus = url.searchParams.get('status');
  let status: AppointmentStatus | undefined;
  if (rawStatus) {
    if (!APPOINTMENT_STATUSES.includes(rawStatus as AppointmentStatus)) {
      throw new ApiError(400, 'invalid_input', 'Trạng thái lọc không hợp lệ.');
    }
    status = rawStatus as AppointmentStatus;
  }
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  const appointments = await listAppointments(env, user.userId, role, {
    status,
    limit: Number.isFinite(rawLimit) ? rawLimit : 50,
  });
  return jsonOk({ appointments });
}

export async function handleCreateAppointment(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const rl = await checkRateLimit(
    env,
    `appointments-user:${user.userId}`,
    APPOINTMENT_RATE_LIMIT,
    APPOINTMENT_RATE_WINDOW_MS,
  );
  if (!rl.allowed) {
    throw new ApiError(429, 'rate_limited', 'Bạn đã đặt quá nhiều lịch hẹn trong 1 giờ. Vui lòng thử lại sau.', {
      retryAfterSec: rl.retryAfterSec,
    });
  }
  const body = await readJsonBody(req);
  const input = parseCreateAppointmentBody(body);
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const appointment = await createAppointment(env, user.userId, input);
  return jsonOk({ appointment }, 201);
}

export async function handlePatchAppointment(
  req: Request,
  env: Env,
  appointmentId: string,
): Promise<Response> {
  const user = await requireAuthUser(env, req);
  if (!isUuid(appointmentId)) {
    throw new ApiError(400, 'invalid_input', 'Mã lịch hẹn không hợp lệ.');
  }
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const current = await getAppointmentById(env, appointmentId);
  if (!current) {
    throw new ApiError(404, 'not_found', 'Không tìm thấy lịch hẹn.');
  }
  const role = await getCallerRole(env, user.userId);
  const body = await readJsonBody(req);
  const patch = validateAppointmentPatch(current, { userId: user.userId, role }, body);
  const updated = await patchAppointment(env, current, patch);
  return jsonOk({ appointment: updated });
}
