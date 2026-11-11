// Trang /hoc-vien/lich-su — "Lich hen cua toi" (dat lich 1-1 that qua
// Workers API /api/v1/appointments, migration 0023).
// Lich su hoc cu da chuyen sang /hoc-vien/lich-su-hoc.
// LUU Y: Email nhac lich CHUA co — API hien tai khong gui email nhac;
// hoc vien tu theo doi lich o day. Khong hien thong bao nhac gia.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import DashboardNav from '@/components/dashboard/DashboardNav';
import {
  APPOINTMENT_DURATIONS,
  appointmentModeLabelVi,
  appointmentStatusLabelVi,
  cancelMyAppointment,
  createAppointment,
  formatAppointmentCountdown,
  listMyAppointments,
  splitAppointments,
  validateCreateAppointmentInput,
  type Appointment,
  type AppointmentsState,
} from '@/lib/appointments';

function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

function AppointmentRow({
  appt,
  highlight,
  cancellingId,
  onCancel,
}: {
  appt: Appointment;
  highlight?: boolean;
  cancellingId: string | null;
  onCancel: (appt: Appointment) => void;
}) {
  return (
    <li key={appt.id} className={`list-row${highlight ? ' appt-next' : ''}`}>
      <p>
        <strong>{formatScheduledAt(appt.scheduledAt)}</strong>
        {' — '}
        {appt.durationMinutes} phút · {appointmentModeLabelVi(appt.mode)}
        {highlight && (
          <>
            {' · '}
            <strong>{formatAppointmentCountdown(appt.scheduledAt)}</strong>
          </>
        )}
      </p>
      <p>
        <span className="pill">{appointmentStatusLabelVi(appt.status)}</span>
      </p>
      {appt.note && <p className="muted">{appt.note}</p>}
      {appt.status === 'confirmed' && appt.meetingUrl && (
        <p>
          <a className="btn btn-small" href={appt.meetingUrl} target="_blank" rel="noopener noreferrer">
            Vào phòng họp
          </a>
        </p>
      )}
      {appt.status === 'confirmed' && !appt.meetingUrl && appt.mode === 'truc-tiep' && (
        <p className="muted">Lịch trực tiếp đã xác nhận — giảng viên sẽ liên hệ địa điểm.</p>
      )}
      {appt.status === 'pending' && (
        <p>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={cancellingId === appt.id}
            onClick={() => void onCancel(appt)}
          >
            {cancellingId === appt.id ? 'Đang hủy…' : 'Hủy lịch'}
          </button>
        </p>
      )}
    </li>
  );
}

export default function LichHenPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<AppointmentsState>({ status: 'loading' });
  const [dateTime, setDateTime] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [mode, setMode] = useState<'zoom' | 'truc-tiep'>('zoom');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') {
      setState({ status: 'loading' });
      setState(await listMyAppointments());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const minDateTime = toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000 + 60 * 1000));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const validation = validateCreateAppointmentInput({
      scheduledAt: dateTime,
      durationMinutes: duration,
      mode,
      note,
    });
    if (validation) {
      setFormError(validation);
      return;
    }
    setSubmitting(true);
    const result = await createAppointment({
      scheduledAt: new Date(dateTime).toISOString(),
      durationMinutes: duration,
      mode,
      note,
    });
    setSubmitting(false);
    if (result.status === 'error') {
      setFormError(result.message);
      return;
    }
    setFormSuccess(
      `Đã đặt lịch hẹn ${formatScheduledAt(result.appointment.scheduledAt)} (${appointmentModeLabelVi(mode)}). Lịch đang chờ xác nhận.`,
    );
    setDateTime('');
    setNote('');
    setState(await listMyAppointments());
  }

  async function onCancel(appt: Appointment) {
    if (!window.confirm('Bạn có chắc muốn hủy lịch hẹn này?')) return;
    setCancellingId(appt.id);
    const result = await cancelMyAppointment(appt.id);
    setCancellingId(null);
    if (result.status === 'error') {
      setFormError(result.message);
      return;
    }
    setFormSuccess('Đã hủy lịch hẹn.');
    setState(await listMyAppointments());
  }

  if (authState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải lịch hẹn…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Lịch hẹn của tôi</h1>
        <div className="notice" role="status">
          <p>
            Bạn chưa đăng nhập.{' '}
            <Link className="btn" href="/dang-nhap">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    );
  }
  if (authState.status === 'error' || authState.status === 'not-configured') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Lịch hẹn của tôi</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được hồ sơ.</strong>
          </p>
          {authState.status === 'error' && <p>{authState.message}</p>}
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      </div>
    );
  }

  const allItems = state.status === 'success' ? state.data : [];
  const { upcoming, past } = splitAppointments(allItems);

  return (
    <div className="wrap">
      <h1 className="gold-title">Lịch hẹn của tôi</h1>
      <DashboardNav />
      <p className="muted">
        Đặt lịch tư vấn 1-1 với giảng viên Visfar Academy. Lịch hẹn cần đặt trước ít nhất 1 giờ.
        Hiện chưa có email nhắc lịch — bạn vui lòng tự theo dõi lịch đã đặt tại trang này.
      </p>

      {formSuccess && (
        <div className="notice success" role="status">
          <p>{formSuccess}</p>
        </div>
      )}
      {formError && (
        <div className="notice error" role="alert">
          <p>
            <strong>{formError}</strong>
          </p>
        </div>
      )}

      <section className="card" aria-labelledby="dat-lich-moi">
        <h2 id="dat-lich-moi" className="gold-title">Đặt lịch mới</h2>
        <form onSubmit={onSubmit} noValidate>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="appt-datetime">Ngày và giờ *</label>
              <input
                id="appt-datetime"
                type="datetime-local"
                required
                min={minDateTime}
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                disabled={submitting}
              />
              <p className="hint">Chỉ chọn giờ trong tương lai, trước ít nhất 1 giờ.</p>
            </div>
            <div className="field">
              <label htmlFor="appt-duration">Thời lượng *</label>
              <select
                id="appt-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={submitting}
              >
                {APPOINTMENT_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} phút
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="appt-mode">Hình thức *</label>
              <select
                id="appt-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'zoom' | 'truc-tiep')}
                disabled={submitting}
              >
                <option value="zoom">Zoom (trực tuyến)</option>
                <option value="truc-tiep">Trực tiếp</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="appt-note">Ghi chú</label>
            <textarea
              id="appt-note"
              className="note-textarea"
              rows={3}
              maxLength={1000}
              placeholder="Nội dung bạn muốn trao đổi…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
            <p className="hint">{note.length}/1000 ký tự</p>
          </div>
          <p>
            <button type="submit" className="btn btn-gold" disabled={submitting}>
              {submitting ? 'Đang đặt lịch…' : 'Đặt lịch hẹn'}
            </button>
          </p>
        </form>
      </section>

      <section aria-labelledby="danh-sach-lich">
        <h2 id="danh-sach-lich" className="gold-title">Lịch đã đặt</h2>
        {state.status === 'loading' && (
          <p role="status" aria-live="polite">
            Đang tải danh sách lịch hẹn…
          </p>
        )}
        {state.status === 'error' && (
          <div className="notice error" role="alert">
            <p>
              <strong>Không tải được lịch hẹn.</strong>
            </p>
            <p>{state.message}</p>
            <p>
              <button type="button" className="btn" onClick={() => void load()}>
                Thử lại
              </button>
            </p>
          </div>
        )}
        {state.status === 'success' && allItems.length === 0 && (
          <div className="notice">
            <p>Bạn chưa đặt lịch hẹn nào.</p>
          </div>
        )}
        {upcoming.length > 0 && (
          <>
            <h3>
              Sắp tới ({upcoming.length}
              {upcoming[0].status === 'confirmed' ? ' · lịch gần nhất đã xác nhận' : ''})
            </h3>
            <ul className="dashboard-list">
              {upcoming.map((appt, i) => (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  highlight={i === 0}
                  cancellingId={cancellingId}
                  onCancel={onCancel}
                />
              ))}
            </ul>
          </>
        )}
        {past.length > 0 && (
          <>
            <h3 style={{ marginTop: '1.5rem' }}>Đã qua ({past.length})</h3>
            <ul className="dashboard-list">
              {past.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  cancellingId={cancellingId}
                  onCancel={onCancel}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
