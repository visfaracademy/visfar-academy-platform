// Lich hen 1-1 — service core (Task 12, migration 0023).
// Luat chuyen trang thai o day (API server); RLS chi rang buoc chu
// so huu don gian (xem 0023). Luong:
//   - Hoc vien tao lich pending (dat truoc it nhat 1 gio).
//   - Hoc vien chi duoc HUY lich cua minh khi dang pending.
//   - Admin / instructor duoc giao: xac nhan (confirm) / hoan thanh /
//     huy. Confirm lich mode zoom BAT BUOC co meeting_url.
//   - Instructor chi tac dong lich duoc giao cho minh (instructor_id
//     = minh); admin tac dong tat ca.
import type { Env } from './env';
import { ApiError, serverError } from './errors';
import { isUuid } from './validation';
import { requireSbOk, sbFetch } from './supabase';
import { getProfileRole } from './email/store';

export type AppointmentMode = 'zoom' | 'truc-tiep';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type CallerRole = 'student' | 'instructor' | 'admin';

export const APPOINTMENT_DURATIONS = [30, 60, 90] as const;
export const APPOINTMENT_MODES: AppointmentMode[] = ['zoom', 'truc-tiep'];
export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
];
/** Lich phai dat truoc it nhat 1 gio (so voi luc tao). */
export const APPOINTMENT_MIN_LEAD_MS = 60 * 60 * 1000;

export interface AppointmentRow {
  id: string;
  student_id: string;
  instructor_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  mode: AppointmentMode;
  status: AppointmentStatus;
  note: string | null;
  meeting_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentInput {
  scheduledAt: string;
  durationMinutes: number;
  mode: AppointmentMode;
  instructorId: string | null;
  note: string | null;
}

/**
 * Validate body tao lich — PURE (de test khong can DB). Nem ApiError
 * 400 khi sai. now truyen vao de test duoc moc thoi gian.
 */
export function parseCreateAppointmentBody(
  body: Record<string, unknown>,
  now: Date = new Date(),
): CreateAppointmentInput {
  const rawScheduled = body['scheduled_at'] ?? body['scheduledAt'];
  if (typeof rawScheduled !== 'string' || !rawScheduled.trim()) {
    throw new ApiError(400, 'invalid_input', 'Vui lòng chọn thời gian đặt hẹn.');
  }
  const scheduled = new Date(rawScheduled.trim());
  if (Number.isNaN(scheduled.getTime())) {
    throw new ApiError(400, 'invalid_input', 'Thời gian đặt hẹn không đúng định dạng ISO.');
  }
  if (scheduled.getTime() <= now.getTime() + APPOINTMENT_MIN_LEAD_MS) {
    throw new ApiError(
      400,
      'invalid_input',
      'Vui lòng đặt hẹn trước ít nhất 1 giờ so với thời gian hiện tại.',
    );
  }
  const rawDuration = body['duration_minutes'] ?? body['durationMinutes'];
  const duration = typeof rawDuration === 'number' ? rawDuration : Number(rawDuration);
  if (!APPOINTMENT_DURATIONS.includes(duration as (typeof APPOINTMENT_DURATIONS)[number])) {
    throw new ApiError(400, 'invalid_input', 'Thời lượng buổi hẹn phải là 30, 60 hoặc 90 phút.');
  }
  const rawMode = body['mode'];
  if (rawMode !== 'zoom' && rawMode !== 'truc-tiep') {
    throw new ApiError(400, 'invalid_input', 'Hình thức hẹn phải là zoom hoặc trực tiếp.');
  }
  const rawInstructor = body['instructor_id'] ?? body['instructorId'];
  let instructorId: string | null = null;
  if (rawInstructor !== null && rawInstructor !== undefined && rawInstructor !== '') {
    if (typeof rawInstructor !== 'string' || !isUuid(rawInstructor)) {
      throw new ApiError(400, 'invalid_input', 'Mã giảng viên không hợp lệ.');
    }
    instructorId = rawInstructor;
  }
  const rawNote = body['note'];
  let note: string | null = null;
  if (rawNote !== null && rawNote !== undefined && rawNote !== '') {
    if (typeof rawNote !== 'string') {
      throw new ApiError(400, 'invalid_input', 'Ghi chú không hợp lệ.');
    }
    note = rawNote.trim() || null;
    if (note && note.length > 1000) {
      throw new ApiError(400, 'invalid_input', 'Ghi chú tối đa 1000 ký tự.');
    }
  }
  return {
    scheduledAt: scheduled.toISOString(),
    durationMinutes: duration,
    mode: rawMode,
    instructorId,
    note,
  };
}

/**
 * Validate PATCH — PURE. Tra patch hop le de ghi DB (chi status +
 * meeting_url). Nem 403 khi khong co quyen, 409 khi chuyen trang
 * thai khong hop le, 400 khi thieu meeting_url luc confirm zoom.
 */
export function validateAppointmentPatch(
  current: AppointmentRow,
  actor: { userId: string; role: CallerRole },
  body: Record<string, unknown>,
): { status: AppointmentStatus; meetingUrl: string | null | undefined } {
  const isOwner = current.student_id === actor.userId;
  const isAssignee =
    current.instructor_id !== null && current.instructor_id === actor.userId;
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isAssignee && !isAdmin) {
    throw new ApiError(404, 'not_found', 'Không tìm thấy lịch hẹn.');
  }
  const rawStatus = body['status'];
  if (typeof rawStatus !== 'string' || !APPOINTMENT_STATUSES.includes(rawStatus as AppointmentStatus)) {
    throw new ApiError(400, 'invalid_input', 'Trạng thái mới không hợp lệ.');
  }
  const next = rawStatus as AppointmentStatus;

  // Hoc vien: chi duoc HUY lich cua minh khi dang pending.
  if (actor.role === 'student' || (isOwner && !isAdmin && !isAssignee)) {
    if (!isOwner) throw new ApiError(403, 'forbidden', 'Bạn không có quyền thay đổi lịch hẹn này.');
    if (next !== 'cancelled') {
      throw new ApiError(403, 'forbidden', 'Bạn chỉ có thể hủy lịch hẹn của mình.');
    }
    if (current.status !== 'pending') {
      throw new ApiError(
        409,
        'conflict',
        `Lịch đang ở trạng thái ${current.status}, không thể hủy.`,
      );
    }
    return { status: 'cancelled', meetingUrl: undefined };
  }

  // Admin / instructor duoc giao: bang chuyen trang thai cho phep.
  const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    cancelled: [],
    completed: [],
  };
  if (!allowed[current.status].includes(next)) {
    throw new ApiError(
      409,
      'conflict',
      `Không thể chuyển lịch từ ${current.status} sang ${next}.`,
    );
  }
  let meetingUrl: string | null | undefined;
  if (next === 'confirmed') {
    const rawUrl = body['meeting_url'] ?? body['meetingUrl'];
    if (current.mode === 'zoom') {
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        throw new ApiError(400, 'invalid_input', 'Xác nhận lịch Zoom cần có link phòng họp (meeting_url).');
      }
      if (!/^https?:\/\/.{3,500}$/.test(rawUrl.trim())) {
        throw new ApiError(400, 'invalid_input', 'Link phòng họp (meeting_url) chưa đúng định dạng.');
      }
      meetingUrl = rawUrl.trim();
    } else if (typeof rawUrl === 'string' && rawUrl.trim()) {
      meetingUrl = rawUrl.trim();
    }
  }
  return { status: next, meetingUrl };
}

// ---------------------------------------------------------------------------
// Doc / ghi DB (PostgREST, service-role)
// ---------------------------------------------------------------------------

export async function getAppointmentById(env: Env, id: string): Promise<AppointmentRow | null> {
  const result = await sbFetch<AppointmentRow[]>(
    env,
    `/appointments?select=id,student_id,instructor_id,scheduled_at,duration_minutes,mode,status,note,meeting_url,created_at,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getAppointmentById');
  return rows && rows.length > 0 ? (rows[0] as AppointmentRow) : null;
}

export interface ListAppointmentsOptions {
  status?: AppointmentStatus;
  limit?: number;
}

/** List theo quyen: admin = tat ca; instructor = lich duoc giao; hoc vien = lich cua minh. */
export async function listAppointments(
  env: Env,
  userId: string,
  role: CallerRole,
  opts: ListAppointmentsOptions = {},
): Promise<AppointmentRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  let query =
    '/appointments?select=id,student_id,instructor_id,scheduled_at,duration_minutes,mode,status,note,meeting_url,created_at,updated_at';
  if (role === 'admin') {
    // Khong loc theo user.
  } else if (role === 'instructor') {
    query += `&instructor_id=eq.${encodeURIComponent(userId)}`;
  } else {
    query += `&student_id=eq.${encodeURIComponent(userId)}`;
  }
  if (opts.status) query += `&status=eq.${encodeURIComponent(opts.status)}`;
  query += `&order=scheduled_at.asc&limit=${limit}`;
  const result = await sbFetch<AppointmentRow[]>(env, query);
  const rows = requireSbOk(result, 'listAppointments');
  return (rows ?? []) as AppointmentRow[];
}

export async function createAppointment(
  env: Env,
  studentId: string,
  input: CreateAppointmentInput,
): Promise<AppointmentRow> {
  // instructor_id (neu co) phai la giang vien / admin that.
  if (input.instructorId) {
    const role = await getProfileRole(env, input.instructorId);
    if (role === null) {
      throw new ApiError(400, 'invalid_input', 'Giảng viên được chọn không tồn tại.');
    }
    if (role !== 'instructor' && role !== 'admin') {
      throw new ApiError(400, 'invalid_input', 'Người được chọn không phải giảng viên.');
    }
  }
  const result = await sbFetch<AppointmentRow[]>(env, '/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      student_id: studentId,
      instructor_id: input.instructorId,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
      mode: input.mode,
      status: 'pending',
      note: input.note,
      meeting_url: null,
    }),
  });
  if (result.error) throw serverError(`insertAppointment: ${result.error.message}`);
  const rows = requireSbOk(result, 'insertAppointment');
  const row = rows?.[0] as AppointmentRow | undefined;
  if (!row) throw serverError('insertAppointment: no row returned');
  return row;
}

export async function patchAppointment(
  env: Env,
  appointment: AppointmentRow,
  patch: { status: AppointmentStatus; meetingUrl: string | null | undefined },
): Promise<AppointmentRow> {
  const body: Record<string, unknown> = { status: patch.status };
  if (patch.meetingUrl !== undefined) body['meeting_url'] = patch.meetingUrl;
  const result = await sbFetch<AppointmentRow[]>(
    env,
    `/appointments?id=eq.${encodeURIComponent(appointment.id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    },
  );
  if (result.error) throw serverError(`updateAppointment: ${result.error.message}`);
  const rows = requireSbOk(result, 'updateAppointment');
  const row = rows?.[0] as AppointmentRow | undefined;
  return row ?? { ...appointment, ...body } as AppointmentRow;
}

/** Role nguoi goi theo profiles.role (student/instructor/admin). */
export async function getCallerRole(env: Env, userId: string): Promise<CallerRole> {
  const role = await getProfileRole(env, userId);
  if (role === 'admin' || role === 'instructor') return role;
  return 'student';
}
