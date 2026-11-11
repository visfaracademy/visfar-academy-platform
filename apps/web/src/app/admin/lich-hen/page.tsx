// Trang /admin/lich-hen — quan ly lich hen (Workers API
// /api/v1/appointments, migration 0023; guard admin o layout requireAdmin).
// Admin thay TAT CA lich (server tra theo role admin tu JWT).
// - Xac nhan: doi status confirmed; lich Zoom BAT BUOC nhap meeting_url.
// - Huy / hoan thanh: theo bang chuyen trang thai server cho phep.
// Khong co endpoint admin rieng: dung PATCH /api/v1/appointments/:id voi
// JWT admin (validateAppointmentPatch o workers/api/src/appointments.ts).
'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import {
  appointmentModeLabelVi,
  appointmentStatusLabelVi,
  listMyAppointments,
  patchAppointment,
  type Appointment,
  type AppointmentStatus,
  type AppointmentsState,
} from '@/lib/appointments';

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_FILTERS: Array<{ value: '' | AppointmentStatus; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'completed', label: 'Đã hoàn thành' },
];

export default function AdminLichHenPage() {
  const [state, setState] = useState<AppointmentsState>({ status: 'loading' });
  const [filter, setFilter] = useState<'' | AppointmentStatus>('');
  const [meetingUrls, setMeetingUrls] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async (status: '' | AppointmentStatus) => {
    setState({ status: 'loading' });
    setState(await listMyAppointments({ status: status || undefined }));
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function onPatch(appt: Appointment, status: AppointmentStatus) {
    setNotice(null);
    const meetingUrl = (meetingUrls[appt.id] ?? '').trim();
    if (status === 'confirmed' && appt.mode === 'zoom' && !meetingUrl) {
      setNotice({ kind: 'error', text: 'Xác nhận lịch Zoom cần nhập link phòng họp (meeting_url).' });
      return;
    }
    if (status === 'confirmed' && appt.mode === 'zoom' && !/^https?:\/\/.{3,500}$/.test(meetingUrl)) {
      setNotice({ kind: 'error', text: 'Link phòng họp chưa đúng định dạng (phải bắt đầu bằng http:// hoặc https://).' });
      return;
    }
    setActingId(appt.id);
    const result = await patchAppointment(
      appt.id,
      status === 'confirmed' ? { status, meetingUrl: meetingUrl || undefined } : { status },
    );
    setActingId(null);
    if (result.status === 'error') {
      setNotice({ kind: 'error', text: result.message });
      return;
    }
    setNotice({ kind: 'success', text: `Đã cập nhật lịch hẹn thành "${appointmentStatusLabelVi(status)}".` });
    await load(filter);
  }

  const items = state.status === 'success' ? state.data : [];

  return (
    <>
      <h1 className="gold-title">Quản lý lịch hẹn</h1>
      <p className="muted">
        Lịch hẹn 1-1 của học viên (Workers API, migration 0023). Xác nhận lịch Zoom cần nhập link
        phòng họp; học viên sẽ thấy link khi lịch đã xác nhận.
      </p>

      {notice && (
        <div className={notice.kind === 'success' ? 'notice success' : 'notice error'} role={notice.kind === 'success' ? 'status' : 'alert'}>
          <p>{notice.text}</p>
        </div>
      )}

      <p>
        <label htmlFor="admin-appt-filter">Lọc trạng thái: </label>
        <select
          id="admin-appt-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as '' | AppointmentStatus)}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>{' '}
        <button type="button" className="btn btn-ghost btn-small" onClick={() => void load(filter)}>
          Tải lại
        </button>
      </p>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải lịch hẹn…
        </p>
      )}
      {state.status === 'signed-out' && (
        <div className="notice error" role="alert">
          <p>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được lịch hẹn.</strong>
          </p>
          <p>{state.message}</p>
        </div>
      )}
      {state.status === 'success' && items.length === 0 && (
        <div className="notice">
          <p>Chưa có lịch hẹn nào ở trạng thái này.</p>
        </div>
      )}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Học viên</th>
                <th>Hình thức / Thời lượng</th>
                <th>Trạng thái</th>
                <th>Ghi chú / Link họp</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((appt) => (
                <tr key={appt.id}>
                  <td>{formatScheduledAt(appt.scheduledAt)}</td>
                  <td>
                    <code>{appt.studentId.slice(0, 8)}…</code>
                  </td>
                  <td>
                    {appointmentModeLabelVi(appt.mode)} · {appt.durationMinutes} phút
                  </td>
                  <td>{appointmentStatusLabelVi(appt.status)}</td>
                  <td>
                    {appt.note && <p>{appt.note}</p>}
                    {appt.meetingUrl ? (
                      <p>
                        <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer">
                          {appt.meetingUrl}
                        </a>
                      </p>
                    ) : (
                      <p className="muted">Chưa có link họp</p>
                    )}
                  </td>
                  <td>
                    {appt.status === 'pending' && (
                      <>
                        <div className="field">
                          <label htmlFor={`meeting-${appt.id}`}>Link phòng họp (Zoom) *</label>
                          <input
                            id={`meeting-${appt.id}`}
                            type="text"
                            inputMode="url"
                            placeholder="https://zoom.us/j/..."
                            value={meetingUrls[appt.id] ?? appt.meetingUrl ?? ''}
                            onChange={(e) =>
                              setMeetingUrls((m) => ({ ...m, [appt.id]: e.target.value }))
                            }
                            disabled={actingId === appt.id}
                          />
                          <p className="hint">Dán đầy đủ link Zoom bắt đầu bằng https://</p>
                        </div>
                        <p>
                          <button
                            type="button"
                            className="btn btn-gold btn-small"
                            disabled={actingId === appt.id}
                            onClick={() => void onPatch(appt, 'confirmed')}
                          >
                            Xác nhận
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            disabled={actingId === appt.id}
                            onClick={() => void onPatch(appt, 'cancelled')}
                          >
                            Hủy
                          </button>
                        </p>
                      </>
                    )}
                    {appt.status === 'confirmed' && (
                      <p>
                        <button
                          type="button"
                          className="btn btn-small"
                          disabled={actingId === appt.id}
                          onClick={() => void onPatch(appt, 'completed')}
                        >
                          Đánh dấu hoàn thành
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          disabled={actingId === appt.id}
                          onClick={() => void onPatch(appt, 'cancelled')}
                        >
                          Hủy
                        </button>
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
