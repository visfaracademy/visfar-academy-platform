// Unit test — TASK 11 Automation Rules.
// Fake store + fake mailer: KHONG cham DB that, KHONG gui email that.
// Them 1 test tich hop: mailer goi renderTemplate THAT cua nhom templates
// (src/email/templates) de chung minh du lieu cua moi rule thoa cac truong
// bat buoc cua mau (E7/E5/E9/E11/E6).
import { describe, expect, it } from 'vitest';
import {
  buildCourseUrl,
  buildIdempotencyKey,
  buildVerificationUrl,
  createEmailModuleMailer,
  createSupabaseAutomationStore,
  isValidEmail,
  runCertificateIssued,
  runCourseCompleted,
  runLearningReminderForLearner,
  runPaymentVerifiedAccess,
  runRegistrationWelcome,
  toDateKey,
  type AutomationStore,
  type CertificateRef,
  type EmailLogRow,
  type EmailModuleSendFn,
  type EnrollmentRef,
  type InactiveLearner,
  type Mailer,
  type SendEmailInput,
} from '../src/automation-rules';
import { renderTemplate } from '../src/email/templates';
import type { TemplateData } from '../src/email/types';
import type { Env } from '../src/env';

const NOW = new Date('2026-11-10T10:00:00+07:00');
const ORIGIN = 'https://visfaracademy.netlify.app';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const COURSE_ID = '22222222-2222-2222-2222-222222222222';
const COURSE_SLUG = 'thau-hieu-noi-tam';
const ENROLLMENT_ID = '33333333-3333-3333-3333-333333333333';
const ORDER_ID = '44444444-4444-4444-4444-444444444444';
const CERT_ID = '55555555-5555-5555-5555-555555555555';

class FakeStore implements AutomationStore {
  emailLogs: EmailLogRow[] = [];
  events: Array<{
    id: string;
    event_type: string;
    user_id: string;
    related_type: string;
    related_id: string;
    payload: Record<string, unknown>;
    status: string;
    error_message?: string | null;
  }> = [];
  enrollments: EnrollmentRef[] = [];
  enrollmentsByOrder = new Map<string, EnrollmentRef>();
  certificates: CertificateRef[] = [];
  inactiveLearners: InactiveLearner[] = [];
  listInactiveCalls = 0;
  now: Date = NOW;
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  async findEmailLogs(query: { toEmail?: string; template?: string; sinceIso?: string }) {
    return this.emailLogs.filter((log) => {
      if (query.toEmail && log.to_email !== query.toEmail) return false;
      if (query.template && log.template !== query.template) return false;
      if (query.sinceIso && log.created_at < query.sinceIso) return false;
      return true;
    });
  }

  async insertEmailLog(entry: {
    to_email: string;
    template: string;
    status: string;
    related_type: string;
    related_id: string;
  }) {
    const row: EmailLogRow = {
      id: this.nextId('log'),
      ...entry,
      resend_id: null,
      created_at: this.now.toISOString(),
    };
    this.emailLogs.push(row);
    return { id: row.id };
  }

  async updateEmailLog(id: string, patch: { status: string; resend_id?: string | null }) {
    const row = this.emailLogs.find((l) => l.id === id);
    if (row) {
      row.status = patch.status;
      if (patch.resend_id !== undefined) row.resend_id = patch.resend_id;
    }
  }

  async insertAutomationEvent(event: {
    event_type: string;
    user_id: string;
    related_type: string;
    related_id: string;
    payload: Record<string, unknown>;
  }) {
    const row = { id: this.nextId('evt'), ...event, status: 'pending' };
    this.events.push(row);
    return { id: row.id };
  }

  async updateAutomationEvent(
    id: string,
    patch: { status: string; processed_at?: string; error_message?: string | null },
  ) {
    const row = this.events.find((e) => e.id === id);
    if (row) {
      row.status = patch.status;
      row.error_message = patch.error_message ?? null;
    }
  }

  async getEnrollment(userId: string, courseId: string) {
    return (
      this.enrollments.find((e) => e.user_id === userId && e.course_id === courseId) ?? null
    );
  }

  async getEnrollmentByOrder(orderId: string) {
    return this.enrollmentsByOrder.get(orderId) ?? null;
  }

  async getCertificate(certificateId: string) {
    return this.certificates.find((c) => c.id === certificateId) ?? null;
  }

  async listInactiveLearners() {
    this.listInactiveCalls += 1;
    return this.inactiveLearners;
  }
}

class FakeMailer implements Mailer {
  calls: SendEmailInput[] = [];
  failNextWith: Error | null = null;

  async sendEmail(input: SendEmailInput) {
    this.calls.push(input);
    if (this.failNextWith) {
      const err = this.failNextWith;
      this.failNextWith = null;
      throw err;
    }
    return { resendId: `re_test_${this.calls.length}` };
  }
}

/** Mailer goi renderTemplate THAT — fail neu du lieu thieu truong bat buoc. */
const renderingMailer: Mailer = {
  async sendEmail(input: SendEmailInput) {
    const rendered = renderTemplate(
      input.template,
      input.data as unknown as TemplateData,
      input.to,
    );
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.html).not.toContain('{{');
    expect(rendered.text).not.toContain('{{');
    return { resendId: 're_rendered' };
  },
};

function seedSentLog(
  store: FakeStore,
  opts: { to: string; template: string; relatedId: string; createdAt: string },
): void {
  store.emailLogs.push({
    id: `seed-${store.emailLogs.length + 1}`,
    to_email: opts.to,
    template: opts.template,
    resend_id: 're_seed',
    status: 'sent',
    related_type: 'enrollments',
    related_id: opts.relatedId,
    created_at: opts.createdAt,
  });
}

function activeEnrollment(): EnrollmentRef {
  return {
    id: ENROLLMENT_ID,
    user_id: USER_ID,
    course_id: COURSE_ID,
    status: 'active',
    completed_at: null,
  };
}

function inactiveLearner(overrides: Partial<InactiveLearner> = {}): InactiveLearner {
  return {
    userId: USER_ID,
    email: 'hocvien@example.vn',
    fullName: 'Nguyễn Văn A',
    enrollmentId: ENROLLMENT_ID,
    courseId: COURSE_ID,
    courseSlug: COURSE_SLUG,
    courseTitle: 'Thấu Hiểu Nội Tâm',
    lastActivityAt: '2026-11-05T10:00:00+07:00',
    enrolledAt: '2026-11-01T10:00:00+07:00',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

describe('helpers ngay / idempotency / URL', () => {
  it('toDateKey dung gio Viet Nam (17:00 UTC = 00:00+07 hom sau)', () => {
    expect(toDateKey(new Date('2026-11-10T17:00:00Z'))).toBe('2026-11-11');
    expect(toDateKey(new Date('2026-11-10T10:00:00Z'))).toBe('2026-11-10');
  });

  it('buildIdempotencyKey = rule:user:YYYY-MM-DD', () => {
    expect(buildIdempotencyKey('registration_welcome', USER_ID, NOW)).toBe(
      `registration_welcome:${USER_ID}:2026-11-10`,
    );
  });

  it('isValidEmail theo CHECK schema (TLD >= 2)', () => {
    expect(isValidEmail('a@b.vn')).toBe(true);
    expect(isValidEmail('a@b.c')).toBe(false);
    expect(isValidEmail('khong-phai-email')).toBe(false);
  });

  it('buildCourseUrl / buildVerificationUrl dung goc site', () => {
    expect(buildCourseUrl(ORIGIN, COURSE_SLUG)).toBe(
      `${ORIGIN}/hoc-vien/khoa-hoc/${COURSE_SLUG}`,
    );
    expect(buildVerificationUrl(ORIGIN, 'VISFAR-CERT-2026-000002')).toBe(
      `${ORIGIN}/chung-chi/tra-cuu?ma=VISFAR-CERT-2026-000002`,
    );
  });
});

// ---------------------------------------------------------------------------
// Rule (1) — Registration -> Welcome (E7)
// ---------------------------------------------------------------------------

describe('rule (1) registration_welcome', () => {
  it('du dieu kien -> gui E7, ghi email_logs sent + automation_event processed', async () => {
    const store = new FakeStore();
    const mailer = new FakeMailer();
    const result = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      { store, mailer, siteOrigin: ORIGIN },
      NOW,
    );
    expect(result.outcome).toBe('sent');
    expect(result.reason).toBe('sent');
    expect(result.idempotencyKey).toBe(`registration_welcome:${USER_ID}:2026-11-10`);
    expect(mailer.calls).toHaveLength(1);
    expect(mailer.calls[0]?.template).toBe('E7');
    expect(mailer.calls[0]?.to).toBe('hocvien@example.vn');
    expect(mailer.calls[0]?.data.studentName).toBe('Nguyễn Văn A');
    expect(mailer.calls[0]?.data.dashboardUrl).toBe(`${ORIGIN}/hoc-vien/dashboard`);
    expect(mailer.calls[0]?.idempotencyKey).toBe(result.idempotencyKey);
    expect(store.emailLogs).toHaveLength(1);
    expect(store.emailLogs[0]?.status).toBe('sent');
    expect(store.emailLogs[0]?.resend_id).toBe('re_test_1');
    expect(store.events).toHaveLength(1);
    expect(store.events[0]?.status).toBe('processed');
    expect(store.events[0]?.payload.idempotency_key).toBe(result.idempotencyKey);
  });

  it('email sai dinh dang -> khong gui, skipped invalid_email', async () => {
    const store = new FakeStore();
    const mailer = new FakeMailer();
    const result = await runRegistrationWelcome(
      { userId: USER_ID, email: 'khong-phai-email', fullName: 'Nguyễn Văn A' },
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('invalid_email');
    expect(mailer.calls).toHaveLength(0);
    expect(store.events[0]?.status).toBe('skipped');
  });

  it('gui trung trong ngay -> chan, skipped duplicate', async () => {
    const store = new FakeStore();
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E7',
      relatedId: USER_ID,
      createdAt: NOW.toISOString(),
    });
    const mailer = new FakeMailer();
    const result = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('duplicate');
    expect(mailer.calls).toHaveLength(0);
  });

  it('log hom qua khong chan gui hom nay', async () => {
    const store = new FakeStore();
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E7',
      relatedId: USER_ID,
      createdAt: '2026-11-09T10:00:00+07:00',
    });
    const mailer = new FakeMailer();
    const result = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('sent');
  });

  it('email 1 lan (E7) khong bi han muc nhac 2 lan/tuan chan', async () => {
    const store = new FakeStore();
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E9',
      relatedId: 'enr-1',
      createdAt: '2026-11-08T10:00:00+07:00',
    });
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E9',
      relatedId: 'enr-2',
      createdAt: '2026-11-09T10:00:00+07:00',
    });
    const mailer = new FakeMailer();
    const result = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('sent');
  });
});

// ---------------------------------------------------------------------------
// Rule (2) — Payment verified -> Enroll + access (E5)
// ---------------------------------------------------------------------------

describe('rule (2) payment_verified_access', () => {
  const baseInput = {
    userId: USER_ID,
    email: 'hocvien@example.vn',
    fullName: 'Nguyễn Văn A',
    orderId: ORDER_ID,
    orderReferenceCode: 'DH-2026-000123',
    courseId: COURSE_ID,
    courseSlug: COURSE_SLUG,
    courseTitle: 'Thấu Hiểu Nội Tâm',
    amountVnd: 1999000,
    paymentStatus: 'succeeded',
  };

  it('da tra + da co enrollment -> gui E5 kem link vao khoa', async () => {
    const store = new FakeStore();
    store.enrollmentsByOrder.set(ORDER_ID, activeEnrollment());
    const mailer = new FakeMailer();
    const result = await runPaymentVerifiedAccess(
      baseInput,
      { store, mailer, siteOrigin: ORIGIN },
      NOW,
    );
    expect(result.outcome).toBe('sent');
    expect(mailer.calls[0]?.template).toBe('E5');
    expect(mailer.calls[0]?.data.courseTitle).toBe('Thấu Hiểu Nội Tâm');
    expect(mailer.calls[0]?.data.courseUrl).toBe(
      `${ORIGIN}/hoc-vien/khoa-hoc/${COURSE_SLUG}`,
    );
    expect(store.emailLogs[0]?.related_type).toBe('orders');
    expect(store.emailLogs[0]?.related_id).toBe(ORDER_ID);
  });

  it('chua tra (pending) -> khong gui', async () => {
    const store = new FakeStore();
    store.enrollmentsByOrder.set(ORDER_ID, activeEnrollment());
    const mailer = new FakeMailer();
    const result = await runPaymentVerifiedAccess(
      { ...baseInput, paymentStatus: 'pending' },
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('payment_not_succeeded');
    expect(mailer.calls).toHaveLength(0);
  });

  it('da tra nhung chua co enrollment -> khong gui access email', async () => {
    const store = new FakeStore();
    const mailer = new FakeMailer();
    const result = await runPaymentVerifiedAccess(baseInput, { store, mailer }, NOW);
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('enrollment_not_found');
    expect(mailer.calls).toHaveLength(0);
  });

  it('enrollment bi thu hoi -> khong gui', async () => {
    const store = new FakeStore();
    store.enrollmentsByOrder.set(ORDER_ID, {
      ...activeEnrollment(),
      status: 'revoked',
    });
    const mailer = new FakeMailer();
    const result = await runPaymentVerifiedAccess(baseInput, { store, mailer }, NOW);
    expect(result.reason).toBe('enrollment_not_active');
    expect(mailer.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule (3) — Learning reminder (E9)
// ---------------------------------------------------------------------------

describe('rule (3) learning_reminder', () => {
  it('khong hoat dong 5 ngay + enrollment active -> gui E9 kem daysInactive=5', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    const mailer = new FakeMailer();
    const result = await runLearningReminderForLearner(
      inactiveLearner(),
      { store, mailer, siteOrigin: ORIGIN },
      NOW,
    );
    expect(result.outcome).toBe('sent');
    expect(mailer.calls[0]?.template).toBe('E9');
    expect(mailer.calls[0]?.data.daysInactive).toBe(5);
    expect(mailer.calls[0]?.data.resumeUrl).toBe(
      `${ORIGIN}/hoc-vien/khoa-hoc/${COURSE_SLUG}`,
    );
    expect(store.emailLogs[0]?.related_id).toBe(ENROLLMENT_ID);
  });

  it('moi hoat dong 1 ngay truoc -> khong gui', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    const mailer = new FakeMailer();
    const result = await runLearningReminderForLearner(
      inactiveLearner({ lastActivityAt: '2026-11-09T10:00:00+07:00' }),
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('still_active');
    expect(mailer.calls).toHaveLength(0);
  });

  it('chua co tien do, ghi danh 5 ngay truoc -> gui (moc enrolledAt)', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    const mailer = new FakeMailer();
    const result = await runLearningReminderForLearner(
      inactiveLearner({ lastActivityAt: null, enrolledAt: '2026-11-05T10:00:00+07:00' }),
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('sent');
  });

  it('enrollment da completed -> khong nhac', async () => {
    const store = new FakeStore();
    store.enrollments = [{ ...activeEnrollment(), status: 'completed' }];
    const mailer = new FakeMailer();
    const result = await runLearningReminderForLearner(
      inactiveLearner(),
      { store, mailer },
      NOW,
    );
    expect(result.reason).toBe('enrollment_not_active');
    expect(mailer.calls).toHaveLength(0);
  });

  it('da nhac 1 ngay truoc -> chan, qua tan suat (1 lan/3 ngay)', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E9',
      relatedId: ENROLLMENT_ID,
      createdAt: '2026-11-09T10:00:00+07:00',
    });
    const mailer = new FakeMailer();
    const result = await runLearningReminderForLearner(
      inactiveLearner(),
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('too_frequent');
    expect(mailer.calls).toHaveLength(0);
  });

  it('da nhan 2 email nhac trong tuan -> chan, weekly_cap', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E9',
      relatedId: 'enr-khac-1',
      createdAt: '2026-11-06T10:00:00+07:00',
    });
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E9',
      relatedId: 'enr-khac-2',
      createdAt: '2026-11-07T10:00:00+07:00',
    });
    const mailer = new FakeMailer();
    const result = await runLearningReminderForLearner(
      inactiveLearner(),
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('weekly_cap');
    expect(mailer.calls).toHaveLength(0);
  });

  it('nhac cuoi cach 4 ngay + moi 1 lan trong tuan -> gui lai duoc', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E9',
      relatedId: ENROLLMENT_ID,
      createdAt: '2026-11-06T10:00:00+07:00',
    });
    const mailer = new FakeMailer();
    const result = await runLearningReminderForLearner(
      inactiveLearner(),
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('sent');
  });
});

// ---------------------------------------------------------------------------
// Rule (4) — Course completed (E11)
// ---------------------------------------------------------------------------

describe('rule (4) course_completed', () => {
  const baseInput = {
    userId: USER_ID,
    email: 'hocvien@example.vn',
    fullName: 'Nguyễn Văn A',
    courseId: COURSE_ID,
    courseTitle: 'Thấu Hiểu Nội Tâm',
    enrollmentId: ENROLLMENT_ID,
  };

  it('enrollment completed -> gui E11', async () => {
    const store = new FakeStore();
    store.enrollments = [{ ...activeEnrollment(), status: 'completed' }];
    const mailer = new FakeMailer();
    const result = await runCourseCompleted(baseInput, { store, mailer }, NOW);
    expect(result.outcome).toBe('sent');
    expect(mailer.calls[0]?.template).toBe('E11');
    expect(mailer.calls[0]?.data.courseTitle).toBe('Thấu Hiểu Nội Tâm');
  });

  it('enrollment moi active (chua xong) -> khong gui', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    const mailer = new FakeMailer();
    const result = await runCourseCompleted(baseInput, { store, mailer }, NOW);
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('course_not_completed');
    expect(mailer.calls).toHaveLength(0);
  });

  it('khong co enrollment -> khong gui', async () => {
    const store = new FakeStore();
    const mailer = new FakeMailer();
    const result = await runCourseCompleted(baseInput, { store, mailer }, NOW);
    expect(result.reason).toBe('enrollment_not_found');
    expect(mailer.calls).toHaveLength(0);
  });

  it('gui trung trong ngay -> chan duplicate', async () => {
    const store = new FakeStore();
    store.enrollments = [{ ...activeEnrollment(), status: 'completed' }];
    seedSentLog(store, {
      to: 'hocvien@example.vn',
      template: 'E11',
      relatedId: ENROLLMENT_ID,
      createdAt: NOW.toISOString(),
    });
    const mailer = new FakeMailer();
    const result = await runCourseCompleted(baseInput, { store, mailer }, NOW);
    expect(result.reason).toBe('duplicate');
    expect(mailer.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule (5) — Certificate issued (E6)
// ---------------------------------------------------------------------------

describe('rule (5) certificate_issued', () => {
  const baseInput = {
    userId: USER_ID,
    email: 'hocvien@example.vn',
    fullName: 'Nguyễn Văn A',
    courseId: COURSE_ID,
    courseTitle: 'Thấu Hiểu Nội Tâm',
    certificateId: CERT_ID,
    certificateCode: 'VISFAR-CERT-2026-999999',
    verificationCode: 'abcdef0123456789abcdef0123456789',
  };

  it('chung chi valid -> gui E6, ma lay tu DB (khong tin ma caller)', async () => {
    const store = new FakeStore();
    store.certificates = [
      {
        id: CERT_ID,
        user_id: USER_ID,
        course_id: COURSE_ID,
        status: 'valid',
        certificate_code: 'VISFAR-CERT-2026-000002',
      },
    ];
    const mailer = new FakeMailer();
    const result = await runCertificateIssued(
      baseInput,
      { store, mailer, siteOrigin: ORIGIN },
      NOW,
    );
    expect(result.outcome).toBe('sent');
    expect(mailer.calls[0]?.template).toBe('E6');
    expect(mailer.calls[0]?.data.certificateCode).toBe('VISFAR-CERT-2026-000002');
    expect(mailer.calls[0]?.data.certificateUrl).toBe(
      `${ORIGIN}/chung-chi/tra-cuu?ma=VISFAR-CERT-2026-000002`,
    );
    expect(store.emailLogs[0]?.related_type).toBe('certificates');
    expect(store.emailLogs[0]?.related_id).toBe(CERT_ID);
  });

  it('chung chi bi thu hoi -> khong gui', async () => {
    const store = new FakeStore();
    store.certificates = [
      {
        id: CERT_ID,
        user_id: USER_ID,
        course_id: COURSE_ID,
        status: 'revoked',
        certificate_code: 'VISFAR-CERT-2026-000002',
      },
    ];
    const mailer = new FakeMailer();
    const result = await runCertificateIssued(baseInput, { store, mailer }, NOW);
    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('certificate_not_valid');
    expect(mailer.calls).toHaveLength(0);
  });

  it('khong co chung chi -> khong gui', async () => {
    const store = new FakeStore();
    const mailer = new FakeMailer();
    const result = await runCertificateIssued(baseInput, { store, mailer }, NOW);
    expect(result.reason).toBe('certificate_not_found');
    expect(mailer.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Loi gui mail
// ---------------------------------------------------------------------------

describe('mailer loi', () => {
  it('Resend loi -> failed, email_logs failed, event failed, khong throw', async () => {
    const store = new FakeStore();
    const mailer = new FakeMailer();
    mailer.failNextWith = new Error('daily_quota_exceeded: Da vuot gioi han 100 email/ngay');
    const result = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      { store, mailer },
      NOW,
    );
    expect(result.outcome).toBe('failed');
    expect(result.reason).toBe('send_failed');
    expect(store.emailLogs[0]?.status).toBe('failed');
    expect(store.events[0]?.status).toBe('failed');
  });

  it('gui lai sau loi van duoc (log failed khong chan duplicate)', async () => {
    const store = new FakeStore();
    const mailer = new FakeMailer();
    mailer.failNextWith = new Error('Resend HTTP 500');
    const first = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      { store, mailer },
      NOW,
    );
    expect(first.outcome).toBe('failed');
    const second = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      { store, mailer },
      NOW,
    );
    expect(second.outcome).toBe('sent');
    expect(mailer.calls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Mailer that: adapter qua sendEmail() cua nhom templates (fetch stub)
// ---------------------------------------------------------------------------

describe('createEmailModuleMailer', () => {
  const config = { apiKey: 're_key', from: 'Visfar Academy <chao@visfaracademy.vn>' };

  it('sendEmail that ok -> tra resendId, truyen dung template/data/key', async () => {
    const seen: Array<{ config: unknown; input: unknown }> = [];
    const sendFn: EmailModuleSendFn = async (cfg, input) => {
      seen.push({ config: cfg, input });
      return { ok: true, resendId: 're_abc123', message: 'Da gui email.' };
    };
    const mailer = createEmailModuleMailer(config, sendFn);
    const out = await mailer.sendEmail({
      to: 'hocvien@example.vn',
      template: 'E7',
      data: { studentName: 'Nguyễn Văn A' },
      idempotencyKey: 'registration_welcome:u1:2026-11-10',
      relatedType: 'profiles',
      relatedId: 'u1',
    });
    expect(out.resendId).toBe('re_abc123');
    const input = seen[0]?.input as Record<string, unknown>;
    expect(input.template).toBe('E7');
    expect(input.idempotencyKey).toBe('registration_welcome:u1:2026-11-10');
    expect(input.relatedType).toBe('profiles');
  });

  it('sendEmail tra daily_quota_exceeded -> throw de rule ghi failed', async () => {
    const sendFn: EmailModuleSendFn = async () => ({
      ok: false,
      errorCode: 'daily_quota_exceeded',
      message: 'Da vuot gioi han 100 email/ngay.',
    });
    const mailer = createEmailModuleMailer(config, sendFn);
    await expect(
      mailer.sendEmail({
        to: 'hocvien@example.vn',
        template: 'E7',
        data: { studentName: 'A' },
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/daily_quota_exceeded/);
  });

  it('sendEmail tra invalid_template_data -> throw', async () => {
    const sendFn: EmailModuleSendFn = async () => ({
      ok: false,
      errorCode: 'invalid_template_data',
      message: 'Thieu truong bat buoc.',
    });
    const mailer = createEmailModuleMailer(config, sendFn);
    await expect(
      mailer.sendEmail({
        to: 'hocvien@example.vn',
        template: 'E5',
        data: {},
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/invalid_template_data/);
  });

  it('thieu apiKey / from -> throw ngay khi tao mailer', () => {
    expect(() => createEmailModuleMailer({ apiKey: ' ', from: 'a@b.vn' })).toThrow(
      /RESEND_API_KEY/,
    );
    expect(() => createEmailModuleMailer({ apiKey: 'k', from: ' ' })).toThrow(
      /RESEND_FROM_EMAIL/,
    );
  });
});

// ---------------------------------------------------------------------------
// Tich hop: du lieu cua 5 rule render THAT duoc bang mau cua nhom templates
// ---------------------------------------------------------------------------

describe('render that voi du lieu cua 5 rule', () => {
  it('ca 5 rule deu render duoc (khong thieu truong bat buoc)', async () => {
    const store = new FakeStore();
    store.enrollments = [activeEnrollment()];
    store.enrollmentsByOrder.set(ORDER_ID, activeEnrollment());
    store.certificates = [
      {
        id: CERT_ID,
        user_id: USER_ID,
        course_id: COURSE_ID,
        status: 'valid',
        certificate_code: 'VISFAR-CERT-2026-000002',
      },
    ];
    const deps = { store, mailer: renderingMailer, siteOrigin: ORIGIN };
    // Enrollment dung chung cho rule (3) (can active) va rule (4) (can
    // completed) — chay tuan tu, doi status o giua.
    const r1 = await runRegistrationWelcome(
      { userId: USER_ID, email: 'hocvien@example.vn', fullName: 'Nguyễn Văn A' },
      deps,
      NOW,
    );
    const r2 = await runPaymentVerifiedAccess(
      {
        userId: USER_ID,
        email: 'hocvien@example.vn',
        fullName: 'Nguyễn Văn A',
        orderId: ORDER_ID,
        orderReferenceCode: 'DH-2026-000123',
        courseId: COURSE_ID,
        courseSlug: COURSE_SLUG,
        courseTitle: 'Thấu Hiểu Nội Tâm',
        amountVnd: 1999000,
        paymentStatus: 'succeeded',
      },
      deps,
      NOW,
    );
    const r3 = await runLearningReminderForLearner(inactiveLearner(), deps, NOW);
    const enrollmentRow = store.enrollments[0];
    if (enrollmentRow) enrollmentRow.status = 'completed';
    const r4 = await runCourseCompleted(
      {
        userId: USER_ID,
        email: 'hocvien@example.vn',
        fullName: 'Nguyễn Văn A',
        courseId: COURSE_ID,
        courseTitle: 'Thấu Hiểu Nội Tâm',
        enrollmentId: ENROLLMENT_ID,
      },
      deps,
      NOW,
    );
    const r5 = await runCertificateIssued(
      {
        userId: USER_ID,
        email: 'hocvien@example.vn',
        fullName: 'Nguyễn Văn A',
        courseId: COURSE_ID,
        courseTitle: 'Thấu Hiểu Nội Tâm',
        certificateId: CERT_ID,
        certificateCode: 'VISFAR-CERT-2026-999999',
      },
      deps,
      NOW,
    );
    const results = [r1, r2, r3, r4, r5];
    expect(results.map((r) => r.outcome)).toEqual([
      'sent',
      'sent',
      'sent',
      'sent',
      'sent',
    ]);
    expect(results.map((r) => r.rule)).toEqual([
      'registration_welcome',
      'payment_verified_access',
      'learning_reminder',
      'course_completed',
      'certificate_issued',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Store Supabase (fetch stub — khong cham DB that)
// ---------------------------------------------------------------------------

describe('createSupabaseAutomationStore.listInactiveLearners', () => {
  const env: Env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  };

  function stubResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), { status: 200 });
  }

  it('chi tra hoc vien khong hoat dong >= 3 ngay; last activity tinh theo user', async () => {
    const fetchStub = async (url: string) => {
      if (url.includes('/enrollments?')) {
        return stubResponse([
          {
            id: 'enr-a',
            user_id: 'user-a',
            course_id: COURSE_ID,
            status: 'active',
            enrolled_at: '2026-11-01T10:00:00+07:00',
            profiles: { email: 'a@example.vn', full_name: 'A' },
            courses: { title: 'Thấu Hiểu Nội Tâm', slug: 'thau-hieu-noi-tam' },
          },
          {
            id: 'enr-b',
            user_id: 'user-b',
            course_id: COURSE_ID,
            status: 'active',
            enrolled_at: '2026-11-01T10:00:00+07:00',
            profiles: { email: 'b@example.vn', full_name: 'B' },
            courses: { title: 'Thấu Hiểu Nội Tâm', slug: 'thau-hieu-noi-tam' },
          },
          {
            id: 'enr-c',
            user_id: 'user-c',
            course_id: COURSE_ID,
            status: 'active',
            enrolled_at: '2026-11-05T10:00:00+07:00',
            profiles: { email: 'c@example.vn', full_name: 'C' },
            courses: { title: 'Thấu Hiểu Nội Tâm', slug: 'thau-hieu-noi-tam' },
          },
        ]);
      }
      if (url.includes('/lesson_progress?')) {
        return stubResponse([
          // B hoc hom qua -> van hoat dong, khong nhac.
          { user_id: 'user-b', updated_at: '2026-11-09T10:00:00+07:00' },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    };
    const store = createSupabaseAutomationStore(
      env,
      fetchStub as unknown as typeof fetch,
    );
    const out = await store.listInactiveLearners(NOW, 3);
    // A: khong co tien do, moc enrolledAt 01/11 -> khong hoat dong 9 ngay.
    // C: khong co tien do, moc enrolledAt 05/11 -> khong hoat dong 5 ngay.
    expect(out.map((l) => l.userId).sort()).toEqual(['user-a', 'user-c']);
    expect(out.find((l) => l.userId === 'user-a')?.lastActivityAt).toBeNull();
    expect(out.find((l) => l.userId === 'user-a')?.courseSlug).toBe('thau-hieu-noi-tam');
  });

  it('getCertificate tra null khi khong co dong', async () => {
    const fetchStub = async () => stubResponse([]);
    const store = createSupabaseAutomationStore(
      env,
      fetchStub as unknown as typeof fetch,
    );
    await expect(store.getCertificate(CERT_ID)).resolves.toBeNull();
  });
});
