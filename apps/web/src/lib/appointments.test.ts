// Test lib lich hen — goi dung Workers API, validate client dung luat
// server (dat truoc >= 1h, duration 30/60/90, note <= 1000), loi/offline
// tra ve state ro, khong bao gio tra du lieu gia.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: () => ({
    auth: { getSession: mocks.getSession },
  }),
}));

import {
  appointmentModeLabelVi,
  appointmentStatusLabelVi,
  cancelMyAppointment,
  createAppointment,
  formatAppointmentCountdown,
  listMyAppointments,
  splitAppointments,
  validateCreateAppointmentInput,
} from './appointments';
import type { FetchImpl } from './api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test-jwt' } } });
});

function futureIso(hours = 2): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

describe('validateCreateAppointmentInput (client — cung luat server)', () => {
  it('hop le: tuong lai > 1h, 60 phut, zoom', () => {
    expect(
      validateCreateAppointmentInput({
        scheduledAt: futureIso(),
        durationMinutes: 60,
        mode: 'zoom',
        note: '',
      }),
    ).toBeNull();
  });
  it('qua khu / < 1h toi bi chan; duration 45 bi chan; note > 1000 bi chan', () => {
    const base = { durationMinutes: 60, mode: 'zoom', note: '' };
    expect(validateCreateAppointmentInput({ ...base, scheduledAt: futureIso(0.5) })).toContain('1 giờ');
    expect(
      validateCreateAppointmentInput({ ...base, scheduledAt: futureIso(), durationMinutes: 45 }),
    ).toContain('30, 60 hoặc 90');
    expect(
      validateCreateAppointmentInput({ ...base, scheduledAt: futureIso(), note: 'x'.repeat(1001) }),
    ).toContain('1000');
  });
});

describe('nhan trang thai / hinh thuc', () => {
  it('du 4 trang thai + 2 hinh thuc tieng Viet', () => {
    expect(appointmentStatusLabelVi('pending')).toBe('Chờ xác nhận');
    expect(appointmentStatusLabelVi('confirmed')).toBe('Đã xác nhận');
    expect(appointmentStatusLabelVi('cancelled')).toBe('Đã hủy');
    expect(appointmentStatusLabelVi('completed')).toBe('Đã hoàn thành');
    expect(appointmentModeLabelVi('zoom')).toContain('Zoom');
    expect(appointmentModeLabelVi('truc-tiep')).toBe('Trực tiếp');
  });
});

describe('goi API lich hen (fetch gia lap)', () => {
  it('listMyAppointments: GET dung path + JWT, map snake_case ve camelCase', async () => {
    const fetchImpl: FetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain('/appointments');
      expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-jwt');
      return jsonResponse({
        ok: true,
        appointments: [
          {
            id: 'appt-1',
            student_id: 'stu-1',
            instructor_id: null,
            scheduled_at: futureIso(),
            duration_minutes: 60,
            mode: 'zoom',
            status: 'pending',
            note: 'Tu van lo trinh',
            meeting_url: null,
            created_at: futureIso(-1),
            updated_at: futureIso(-1),
          },
        ],
      });
    });
    const state = await listMyAppointments({ fetchImpl });
    expect(state.status).toBe('success');
    if (state.status === 'success') {
      expect(state.data[0]?.durationMinutes).toBe(60);
      expect(state.data[0]?.scheduledAt).toBeTruthy();
    }
  });

  it('listMyAppointments: API tra loi (vd bang chua co — migration chua ap) -> error, khong tra list gia', async () => {
    const fetchImpl: FetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, error: 'not_found', message: 'Không tìm thấy đường dẫn này.' }, 404),
    );
    const state = await listMyAppointments({ fetchImpl });
    expect(state.status).toBe('error');
    if (state.status === 'error') expect(state.message).toBeTruthy();
  });

  it('createAppointment: POST dung body + Idempotency-Key, 201 -> success', async () => {
    const fetchImpl: FetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      expect(body['duration_minutes']).toBe(60);
      return jsonResponse(
        {
          ok: true,
          appointment: {
            id: 'appt-2',
            student_id: 'stu-1',
            instructor_id: null,
            scheduled_at: futureIso(),
            duration_minutes: 60,
            mode: 'truc-tiep',
            status: 'pending',
            note: null,
            meeting_url: null,
            created_at: futureIso(-1),
            updated_at: futureIso(-1),
          },
        },
        201,
      );
    });
    const res = await createAppointment({
      scheduledAt: futureIso(),
      durationMinutes: 60,
      mode: 'truc-tiep',
      note: '',
      fetchImpl,
    });
    expect(res.status).toBe('success');
  });

  it('cancelMyAppointment: PATCH status=cancelled toi dung id', async () => {
    const fetchImpl: FetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain('/appointments/appt-1');
      expect(init?.method).toBe('PATCH');
      expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({ status: 'cancelled' });
      return jsonResponse({
        ok: true,
        appointment: {
          id: 'appt-1',
          student_id: 'stu-1',
          instructor_id: null,
          scheduled_at: futureIso(),
          duration_minutes: 60,
          mode: 'zoom',
          status: 'cancelled',
          note: null,
          meeting_url: null,
          created_at: futureIso(-1),
          updated_at: futureIso(-1),
        },
      });
    });
    const res = await cancelMyAppointment('appt-1', { fetchImpl });
    expect(res.status).toBe('success');
    if (res.status === 'success') expect(res.appointment.status).toBe('cancelled');
  });
});

describe('formatAppointmentCountdown / splitAppointments', () => {
  const now = new Date('2026-11-11T10:00:00+07:00').getTime();
  const appt = (id: string, scheduledAt: string, status: 'pending' | 'confirmed' | 'cancelled' | 'completed' = 'pending') => ({
    id, studentId: 'stu-1', instructorId: null, scheduledAt, durationMinutes: 60, mode: 'zoom' as const, status,
    note: null, meetingUrl: null, createdAt: '2026-11-11T09:00:00+07:00', updatedAt: '2026-11-11T09:00:00+07:00',
  });
  it('dem nguoc dung tieng Viet', () => {
    expect(formatAppointmentCountdown('2026-11-13T12:00:00+07:00', now)).toBe('Còn 2 ngày 2 giờ');
    expect(formatAppointmentCountdown('2026-11-11T12:30:00+07:00', now)).toBe('Còn 2 giờ 30 phút');
    expect(formatAppointmentCountdown('2026-11-11T10:45:00+07:00', now)).toBe('Còn 45 phút');
    expect(formatAppointmentCountdown('2026-11-11T09:00:00+07:00', now)).toBe('Đã tới giờ hẹn');
  });
  it('tach sap toi / da qua, sap toi xep som nhat truoc', () => {
    const items = [
      appt('past', '2026-11-10T10:00:00+07:00', 'completed'),
      appt('late', '2026-11-12T10:00:00+07:00'),
      appt('soon', '2026-11-11T11:00:00+07:00'),
      appt('cancelled', '2026-11-12T10:00:00+07:00', 'cancelled'),
    ];
    const { upcoming, past } = splitAppointments(items, now);
    expect(upcoming.map((a) => a.id)).toEqual(['soon', 'late']);
    expect(past.map((a) => a.id)).toEqual(['cancelled', 'past']);
  });
});
