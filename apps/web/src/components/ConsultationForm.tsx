// Form tu van — ban React cua form #consultForm trong trang HTML goc
// (workspace/user/files/Visfar_Academy.html — KHONG sua file goc).
// Giu nguyen 5 o thong tin + van ban goc: ho ten, SĐT, email, tinh/thanh
// (34 tinh/thanh), tru cot / chuong trinh quan tam. Them:
// - honeypot (QĐ 4a) + Idempotency-Key (dung lai khi retry) + disable
//   nut khi dang gui (chong gui trung);
// - chi hien cam on khi nhan ok:true tu API hoac tu fallback Apps Script
//   xac nhan duoc bang JSON (leads.ts); khong hien cam on gia;
// - BO hop xac nhan PII (mailto/clipboard chua ho ten/SĐT/email) theo
//   DECISIONS Task 03 QĐ 13: he thong moi khong hien PII trong
//   mailto/clipboard. Hop do chi con o trang HTML cu theo QĐ 8.
// - Trang thai: idle / validating / submitting / success / error,
//   ke ca mat mang (nut "Thu lai" dung lai Idempotency-Key cu).
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PROVINCES } from '@visfar/shared';
import { fetchPublishedCourses } from '@/lib/courses';
import { newIdempotencyKey } from '@/lib/api-client';
import { submitLead, validateLeadInput, type LeadFieldError, type LeadSubmitResult } from '@/lib/leads';

type FormState =
  | { status: 'idle' }
  | { status: 'submitting'; note: string }
  | { status: 'success'; referenceCode: string; duplicate: boolean; via: 'api' | 'fallback-apps-script'; fullName: string; course: string }
  | { status: 'error'; message: string; isOffline: boolean; canRetry: boolean; fallbackAttempted: boolean };

const BUSINESS_OPTION = 'Doanh nghiệp — đào tạo / diễn giả / cố vấn';
const UNKNOWN_OPTION = 'Chưa biết bắt đầu từ đâu — cần tư vấn lộ trình';

export default function ConsultationForm() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [province, setProvince] = useState('');
  const [courseValue, setCourseValue] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LeadFieldError[]>([]);
  const [state, setState] = useState<FormState>({ status: 'idle' });
  const [courseOptions, setCourseOptions] = useState<Array<{ id: string; slug: string; title: string }>>([]);
  const [coursesState, setCoursesState] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Pre-select tu CTA trang chu (?course=<slug>), giong [data-course] goc (D05).
  const searchParams = useSearchParams();
  const preselectSlug = searchParams.get('course');
  // Key cua lan gui hien tai: sinh 1 lan, dung lai cho moi retry.
  // Chi sinh key moi khi nguoi dung bam "Dang ky them" (lan gui moi).
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey());

  useEffect(() => {
    let cancelled = false;
    void fetchPublishedCourses().then((r) => {
      if (cancelled) return;
      if (r.status === 'success') {
        setCourseOptions(r.courses.map((c) => ({ id: c.id, slug: c.slug, title: c.title })));
        setCoursesState('ready');
      } else {
        // Khong co du lieu gia: van cho chon 2 lua chon khong can khoa hoc.
        setCoursesState('failed');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-select 1 lan khi danh sach khoa hoc da tai xong. Khop theo slug
  // truoc, roi theo ten chuan hoa (bo dau, nhu norm() goc); 'business' /
  // 'unknown' la 2 lua chon khong can khoa hoc. Khong khop thi de trong,
  // khong tu chon sai khoa (loi goc: link "Thau Hieu Ban Than" cu khong khop).
  useEffect(() => {
    if (!preselectSlug || coursesState !== 'ready') return;
    if (preselectSlug === 'business' || preselectSlug === 'unknown') {
      setCourseValue(preselectSlug);
      return;
    }
    const bySlug = courseOptions.find((c) => c.slug === preselectSlug);
    if (bySlug) {
      setCourseValue(bySlug.id);
      return;
    }
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const byTitle = courseOptions.find((c) => norm(c.title) === norm(preselectSlug));
    if (byTitle) setCourseValue(byTitle.id);
  }, [preselectSlug, coursesState, courseOptions]);

  const fieldError = (field: LeadFieldError['field']) =>
    fieldErrors.find((e) => e.field === field)?.message;

  async function doSubmit() {
    const selected = courseOptions.find((c) => c.id === courseValue);
    const courseInterestText =
      selected?.title ?? (courseValue === 'business' ? BUSINESS_OPTION : courseValue === 'unknown' ? UNKNOWN_OPTION : '');
    const input = {
      fullName,
      phone: phone.replace(/[\s.-]/g, ''),
      email,
      province,
      courseId: selected ? selected.id : null,
      courseInterestText,
      source: 'visfar-academy',
      honeypot,
    };
    const errors = validateLeadInput(input);
    if (errors.length > 0) {
      setFieldErrors(errors);
      setState({
        status: 'error',
        message: 'Vui lòng kiểm tra lại: ' + errors.map((e) => e.message).join(' '),
        isOffline: false,
        canRetry: false,
        fallbackAttempted: false,
      });
      return;
    }
    setFieldErrors([]);
    setState({ status: 'submitting', note: 'Đang gửi yêu cầu tới Visfar Academy… Vui lòng chờ, đừng bấm gửi lại.' });
    const result: LeadSubmitResult = await submitLead(input, { idempotencyKey: idempotencyKeyRef.current });
    if (result.status === 'success') {
      setState({
        status: 'success',
        referenceCode: result.referenceCode,
        duplicate: result.duplicate,
        via: result.via,
        fullName: input.fullName.trim(),
        course: courseInterestText,
      });
    } else {
      setState({
        status: 'error',
        message: result.message,
        isOffline: result.isOffline,
        canRetry: result.canRetry,
        fallbackAttempted: result.fallbackAttempted,
      });
    }
  }

  function resetForNewSubmission() {
    idempotencyKeyRef.current = newIdempotencyKey();
    setFullName('');
    setPhone('');
    setEmail('');
    setProvince('');
    setCourseValue('');
    setHoneypot('');
    setFieldErrors([]);
    setState({ status: 'idle' });
  }

  const submitting = state.status === 'submitting';

  if (state.status === 'success') {
    return (
      <div className="notice success" role="status">
        <p>
          <strong>Cảm ơn {state.fullName}!</strong>
        </p>
        <p>
          Cảm ơn bạn đã đăng ký tư vấn chương trình “{state.course}”. Thông tin của bạn đã được
          ghi nhận. Visfar Academy sẽ liên hệ lại với bạn.
        </p>
        <p>
          Mã tham chiếu: <strong>{state.referenceCode}</strong>
          {state.duplicate ? ' (đăng ký này đã được ghi nhận trước đó — không tạo trùng).' : ''}
        </p>
        {state.via === 'fallback-apps-script' && (
          <p>
            Ghi chú: yêu cầu này được ghi nhận qua kênh dự phòng (Google Sheet) vì API chính chưa
            phản hồi; Visfar Academy sẽ đối soát lại trước khi liên hệ. Mã trên là mã theo dõi
            tạm của lần gửi này, không phải mã tham chiếu chính thức của hệ thống.
          </p>
        )}
        <p>
          Nếu cần liên hệ ngay, hãy gửi email tới{' '}
          <a href="mailto:visfaracademy@gmail.com">visfaracademy@gmail.com</a> hoặc gọi{' '}
          <a href="tel:+84347897868">034 7897 868</a>.
        </p>
        <p>
          Muốn nhận thông tin và lịch mới nhất khi có, tham gia nhóm Zalo bên dưới. Cần hỗ trợ
          thêm, nhắn trực tiếp qua Zalo hỗ trợ.
        </p>
        <p className="zalo-actions">
          <a
            className="btn btn-gold"
            href="https://zalo.me/g/9p1ow5o696mfjvvhtfu6"
            target="_blank"
            rel="noopener"
          >
            Tham gia nhóm Zalo
          </a>{' '}
          <a
            className="btn btn-ghost"
            href="https://zalo.me/0347897868/"
            target="_blank"
            rel="noopener"
          >
            Zalo hỗ trợ
          </a>
        </p>
        <p className="zalo-note">Hai nút Zalo mở trong tab mới, không làm mất trang này.</p>
        <p>
          <button type="button" className="btn btn-ghost" onClick={resetForNewSubmission}>
            Đăng ký thêm một yêu cầu khác
          </button>
        </p>
      </div>
    );
  }

  return (
    <form
      className="consult-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void doSubmit();
      }}
    >
      {/* Honeypot chong spam (QĐ 4a): field an, nguoi that khong bao gio dien. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="cf-website">Website</label>
        <input
          id="cf-website"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="cf-name">Họ và tên *</label>
        <input
          id="cf-name"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          placeholder="Nguyễn Văn A"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={submitting}
        />
        {fieldError('fullName') && <p className="field-error">{fieldError('fullName')}</p>}
      </div>

      <div className="field">
        <label htmlFor="cf-phone">Số điện thoại *</label>
        <input
          id="cf-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          placeholder="09xx xxx xxx"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={submitting}
        />
        <p className="hint">Vui lòng nhập số điện thoại 10 chữ số, bắt đầu bằng số 0.</p>
        {fieldError('phone') && <p className="field-error">{fieldError('phone')}</p>}
      </div>

      <div className="field">
        <label htmlFor="cf-email">Email *</label>
        <input
          id="cf-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ban@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
        {fieldError('email') && <p className="field-error">{fieldError('email')}</p>}
      </div>

      <div className="field">
        <label htmlFor="cf-province">Tỉnh / Thành phố *</label>
        <select
          id="cf-province"
          name="province"
          autoComplete="address-level1"
          required
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          disabled={submitting}
        >
          <option value="" disabled>
            Chọn tỉnh / thành phố
          </option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {fieldError('province') && <p className="field-error">{fieldError('province')}</p>}
      </div>

      <div className="field">
        <label htmlFor="cf-course">Bạn quan tâm tới trụ cột hoặc chương trình nào? *</label>
        <select
          id="cf-course"
          name="course"
          required
          value={courseValue}
          onChange={(e) => setCourseValue(e.target.value)}
          disabled={submitting}
        >
          <option value="">— Chọn một trụ cột / chương trình —</option>
          {courseOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
          <option value="business">{BUSINESS_OPTION}</option>
          <option value="unknown">{UNKNOWN_OPTION}</option>
        </select>
        {coursesState === 'failed' && (
          <p className="hint">
            Chưa tải được danh sách khóa học từ hệ thống — bạn vẫn có thể chọn 2 mục cuối để gửi
            yêu cầu tư vấn.
          </p>
        )}
        {coursesState === 'loading' && <p className="hint">Đang tải danh sách khóa học…</p>}
        {fieldError('course') && <p className="field-error">{fieldError('course')}</p>}
      </div>

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa gửi được.</strong>
          </p>
          <p>{state.message}</p>
          {state.fallbackAttempted && (
            <p>Đã thử kênh dự phòng (Google Sheet) nhưng chưa nhận được xác nhận ghi nhận.</p>
          )}
          {state.canRetry && (
            <p>
              <button type="button" className="btn" onClick={() => void doSubmit()} disabled={submitting}>
                Thử lại
              </button>
            </p>
          )}
        </div>
      )}

      {state.status === 'submitting' && (
        <p role="status" aria-live="polite">
          {state.note}
        </p>
      )}

      <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
        {submitting ? 'Đang gửi…' : 'Đăng ký tham gia'}
      </button>
      <p className="form-note">
        Khi bạn bấm gửi, thông tin sẽ được gửi tới Visfar Academy để liên hệ tư vấn. Trang cảm ơn
        chỉ hiện sau khi hệ thống xác nhận đã ghi nhận.
      </p>
    </form>
  );
}
