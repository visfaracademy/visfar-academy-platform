// Lich hen 1-1 — client goi Workers API /api/v1/appointments (migration
// 0023). JWT qua session Supabase. KHONG mock du lieu: API chua deploy /
// migration chua ap thi tra ve trang thai loi de UI hien ro.
// Email nhac lich CHUA co (ghi ro o UI) — API hien tai khong gui mail.
import {
  ApiError,
  getApiBaseUrl,
  getJson,
  isOfflineError,
  newIdempotencyKey,
  postJson,
  type FetchImpl,
} from './api-client';
import { getAccessToken } from './payments';

export type AppointmentMode = 'zoom' | 'truc-tiep';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  studentId: string;
  instructorId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  mode: AppointmentMode;
  status: AppointmentStatus;
  note: string | null;
  meetingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentsState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; data: Appointment[] }
  | { status: 'error'; message: string; isOffline: boolean };

export type AppointmentActionState =
  | { status: 'success'; appointment: Appointment }
  | { status: 'error'; message: string; isOffline: boolean };

/** Lich phai dat truoc it nhat 1 gio — giong server (APPOINTMENT_MIN_LEAD_MS). */
export const APPOINTMENT_MIN_LEAD_MS = 60 * 60 * 1000;
export const APPOINTMENT_DURATIONS = [30, 60, 90] as const;

export function appointmentStatusLabelVi(status: AppointmentStatus): string {
  switch (status) {
    case 'pending':
      return 'Chờ xác nhận';
    case 'confirmed':
      return 'Đã xác nhận';
    case 'cancelled':
      return 'Đã hủy';
    case 'completed':
      return 'Đã hoàn thành';
  }
}

export function appointmentModeLabelVi(mode: AppointmentMode): string {
  return mode === 'zoom' ? 'Zoom (trực tuyến)' : 'Trực tiếp';
}

/** Dem nguoc toi lich hen sap toi, tieng Viet: "con 2 ngay 3 gio", "con 45 phut", "dang dien ra" / "da qua". */
export function formatAppointmentCountdown(scheduledAt: string, nowMs: number = Date.now()): string {
  const target = new Date(scheduledAt).getTime();
  if (Number.isNaN(target)) return '';
  const diffMs = target - nowMs;
  if (diffMs <= 0) return 'Đã tới giờ hẹn';
  const totalMin = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `Còn ${days} ngày${hours > 0 ? ` ${hours} giờ` : ''}`;
  if (hours > 0) return `Còn ${hours} giờ${mins > 0 ? ` ${mins} phút` : ''}`;
  return `Còn ${mins} phút`;
}

/** Lich sap toi = chua huy/hoan thanh va gio hen >= hien tai (sap xep som nhat truoc). */
export function splitAppointments(
  items: Appointment[],
  nowMs: number = Date.now(),
): { upcoming: Appointment[]; past: Appointment[] } {
  const upcoming: Appointment[] = [];
  const past: Appointment[] = [];
  for (const a of items) {
    const t = new Date(a.scheduledAt).getTime();
    if (
      (a.status === 'pending' || a.status === 'confirmed') &&
      !Number.isNaN(t) &&
      t >= nowMs - 60 * 60 * 1000
    ) {
      upcoming.push(a);
    } else {
      past.push(a);
    }
  }
  upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  past.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  return { upcoming, past };
}

/** Validate client truoc khi gui — giong server, de bao loi ngay. */
export function validateCreateAppointmentInput(input: {
  scheduledAt: string;
  durationMinutes: number;
  mode: string;
  note: string;
}): string | null {
  const scheduled = new Date(input.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return 'Vui lòng chọn ngày và giờ đặt hẹn.';
  if (scheduled.getTime() <= Date.now() + APPOINTMENT_MIN_LEAD_MS) {
    return 'Vui lòng đặt hẹn trước ít nhất 1 giờ so với thời gian hiện tại.';
  }
  if (!APPOINTMENT_DURATIONS.includes(input.durationMinutes as (typeof APPOINTMENT_DURATIONS)[number])) {
    return 'Thời lượng buổi hẹn phải là 30, 60 hoặc 90 phút.';
  }
  if (input.mode !== 'zoom' && input.mode !== 'truc-tiep') {
    return 'Hình thức hẹn phải là Zoom hoặc trực tiếp.';
  }
  if (input.note.length > 1000) return 'Ghi chú tối đa 1000 ký tự.';
  return null;
}

function mapRow(row: Record<string, unknown>): Appointment {
  return {
    id: String(row['id'] ?? ''),
    studentId: String(row['student_id'] ?? row['studentId'] ?? ''),
    instructorId: (row['instructor_id'] ?? row['instructorId'] ?? null) as string | null,
    scheduledAt: String(row['scheduled_at'] ?? row['scheduledAt'] ?? ''),
    durationMinutes: Number(row['duration_minutes'] ?? row['durationMinutes'] ?? 60),
    mode: (row['mode'] as AppointmentMode) ?? 'zoom',
    status: (row['status'] as AppointmentStatus) ?? 'pending',
    note: (row['note'] as string | null) ?? null,
    meetingUrl: ((row['meeting_url'] ?? row['meetingUrl']) as string | null) ?? null,
    createdAt: String(row['created_at'] ?? row['createdAt'] ?? ''),
    updatedAt: String(row['updated_at'] ?? row['updatedAt'] ?? ''),
  };
}

function toErrorState(err: unknown, fallback: string): AppointmentsState {
  const isOffline = isOfflineError(err);
  return {
    status: 'error',
    message: isOffline
      ? 'Không kết nối được tới API lịch hẹn. Kiểm tra mạng, hoặc API chưa được triển khai (migration 0023 chưa áp / Workers chưa deploy).'
      : err instanceof Error
        ? err.message
        : fallback,
    isOffline,
  };
}

function toActionError(err: unknown, fallback: string): AppointmentActionState {
  const isOffline = isOfflineError(err);
  return {
    status: 'error',
    message: isOffline
      ? 'Không kết nối được tới API lịch hẹn. Kiểm tra mạng, hoặc API chưa được triển khai (migration 0023 chưa áp / Workers chưa deploy).'
      : err instanceof Error
        ? err.message
        : fallback,
    isOffline,
  };
}

export async function listMyAppointments(opts: {
  fetchImpl?: FetchImpl;
  status?: AppointmentStatus;
} = {}): Promise<AppointmentsState> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    const path = opts.status
      ? `/appointments?status=${encodeURIComponent(opts.status)}`
      : '/appointments';
    const data = await getJson<{ appointments: Array<Record<string, unknown>> }>(path, {
      accessToken,
      fetchImpl: opts.fetchImpl,
    });
    return { status: 'success', data: (data.appointments ?? []).map(mapRow) };
  } catch (err) {
    return toErrorState(err, 'Không tải được danh sách lịch hẹn.');
  }
}

export async function createAppointment(input: {
  scheduledAt: string;
  durationMinutes: number;
  mode: AppointmentMode;
  note: string;
  fetchImpl?: FetchImpl;
}): Promise<AppointmentActionState> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: 'error', message: 'Bạn chưa đăng nhập.', isOffline: false };
  }
  try {
    const data = await postJson<{ appointment: Record<string, unknown> }>(
      '/appointments',
      {
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMinutes,
        mode: input.mode,
        note: input.note.trim() || null,
      },
      { accessToken, idempotencyKey: newIdempotencyKey(), fetchImpl: input.fetchImpl },
    );
    return { status: 'success', appointment: mapRow(data.appointment) };
  } catch (err) {
    return toActionError(err, 'Không đặt được lịch hẹn.');
  }
}

export async function patchAppointment(
  id: string,
  patch: { status: AppointmentStatus; meetingUrl?: string },
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<AppointmentActionState> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: 'error', message: 'Bạn chưa đăng nhập.', isOffline: false };
  }
  // PATCH qua fetch truc tiep: api-client chi co GET/POST. Giong
  // payments.ts apiGet — loi tra ve dang state, khong throw.
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const body: Record<string, unknown> = { status: patch.status };
    if (patch.meetingUrl !== undefined) body['meeting_url'] = patch.meetingUrl;
    let res: Response;
    try {
      res = await fetchImpl(`${getApiBaseUrl()}/appointments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        return { status: 'error', message: 'Hết thời gian chờ phản hồi. Vui lòng thử lại.', isOffline: false };
      }
      return toActionError(new ApiError('offline', 'offline', { isOffline: true }), '');
    }
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
      const message = String(
        (data as { message?: unknown }).message ?? (data as { error?: unknown }).error ?? 'Không cập nhật được lịch hẹn.',
      );
      return { status: 'error', message, isOffline: false };
    }
    return {
      status: 'success',
      appointment: mapRow((data as { appointment: Record<string, unknown> }).appointment),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Hoc vien huy lich cua minh (chi khi dang pending — server chan neu khong). */
export async function cancelMyAppointment(
  id: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<AppointmentActionState> {
  return patchAppointment(id, { status: 'cancelled' }, opts);
}
