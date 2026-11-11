// Test Task 08: CERTIFICATE — chay local, khong can Supabase that.
// Fake client ghi that vao store trong bo nho (mau lms-admin.test.ts),
// mo phong them DEFAULT cua DB o 0016 (ma chung chi + verification_code
// do DB sinh khi insert) va ham RPC verify_certificate.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCertificateCode,
  buildQrCodeImageUrl,
  buildVerificationUrl,
  checkCertificateEligibility,
  DEFAULT_PASSING_SCORE_PERCENT,
  isValidCertificateCode,
  issueCertificateIfEligible,
  normalizeCertificateCode,
  resolvePassingThreshold,
  revokeCertificate,
  verifyCertificateByCode,
} from './certificates';

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private pendingUpdate: Row | null = null;
  private pendingInsert: Row | null = null;
  private applied = false;
  constructor(
    private store: Record<string, Row[]>,
    private table: string,
  ) {}
  select() {
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  private rows(): Row[] {
    return (this.store[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
  }
  private applyUpdate(): Row[] {
    if (this.applied) return this.rows();
    this.applied = true;
    if (!this.pendingUpdate) return this.rows();
    const targets = this.rows();
    for (const row of targets) Object.assign(row, this.pendingUpdate);
    return targets;
  }
  async maybeSingle() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    return { data: this.applyUpdate()[0] ?? null, error: null };
  }
  async single() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    const rows = this.applyUpdate();
    if (rows.length === 0) return { data: null, error: { message: 'No rows found' } };
    return { data: rows[0], error: null };
  }
  update(values: Row) {
    this.pendingUpdate = values;
    return this;
  }
  insert(values: Row) {
    const row: Row = { id: `gen-${Math.random().toString(36).slice(2, 10)}`, ...values };
    // Mo phong DEFAULT 0016: ma + verification_code do DB sinh.
    if (this.table === 'certificates') {
      const n = (this.store[this.table] ?? []).length + 1;
      if (!row.certificate_code) {
        row.certificate_code = `VISFAR-CERT-2026-${String(n).padStart(6, '0')}`;
      }
      if (!row.verification_code) {
        row.verification_code = `deadbeef00000000000000000000000${n}`;
      }
      if (!row.issued_at) row.issued_at = new Date().toISOString();
    }
    (this.store[this.table] ??= []).push(row);
    this.pendingInsert = row;
    return this;
  }
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    let data: unknown;
    if (this.pendingInsert) data = [this.pendingInsert];
    else if (this.pendingUpdate) data = this.applyUpdate();
    else data = this.rows();
    return Promise.resolve({ data, error: null }).then(onF, onR);
  }
}

function makeClient(store: Record<string, Row[]>): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } }, error: null }) },
    from(table: string) {
      return new FakeQuery(store, table);
    },
    // Mo phong ham verify_certificate (0016): chi tra 6 truong an toan.
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn !== 'verify_certificate') {
        return Promise.resolve({ data: null, error: { message: `unknown function ${fn}` } });
      }
      const code = String(args.p_code ?? '').toUpperCase();
      const cert = (store.certificates ?? []).find(
        (c) =>
          String(c.certificate_code ?? '').toUpperCase() === code ||
          String(c.verification_code ?? '').toUpperCase() === code,
      );
      if (!cert) return Promise.resolve({ data: [], error: null });
      const profile = (store.profiles ?? []).find((p) => p.id === cert.user_id);
      const course = (store.courses ?? []).find((c) => c.id === cert.course_id);
      return Promise.resolve({
        data: [
          {
            certificate_code: cert.certificate_code,
            recipient_name: profile?.full_name ?? '',
            course_title: course?.title ?? '',
            course_slug: course?.slug ?? '',
            issued_at: cert.issued_at ?? '',
            status: cert.status ?? 'valid',
          },
        ],
        error: null,
      });
    },
  } as unknown as SupabaseClient;
}

const ADMIN_ID = 'admin-1';
const STUDENT_ID = 'student-1';

function baseStore(): Record<string, Row[]> {
  return {
    courses: [{ id: 'c1', slug: 'khoa-1', title: 'Khóa 1', status: 'published' }],
    profiles: [
      { id: ADMIN_ID, role: 'admin', full_name: 'Quản trị viên' },
      { id: STUDENT_ID, role: 'student', full_name: 'Nguyễn Văn A', email: 'a@example.com', phone: '0900000001' },
    ],
    course_modules: [{ id: 'm1', course_id: 'c1', display_order: 0 }],
    lessons: [
      { id: 'l1', course_module_id: 'm1', type: 'video', is_published: true },
      { id: 'l2', course_module_id: 'm1', type: 'text', is_published: true },
    ],
    lesson_progress: [],
    quizzes: [],
    quiz_attempts: [],
    enrollments: [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'active' }],
    certificates: [],
    audit_logs: [],
  };
}

/** Store voi hoc vien hoan thanh 100% bai + (tuy chon) quiz dat. */
function completedStore(opts: { quizThreshold?: number | null; bestPercent?: number | null } = {}): Record<string, Row[]> {
  const store = baseStore();
  store.lesson_progress = [
    { user_id: STUDENT_ID, lesson_id: 'l1', status: 'completed', progress_percent: 95 },
    { user_id: STUDENT_ID, lesson_id: 'l2', status: 'completed', progress_percent: 100 },
  ];
  if (opts.bestPercent !== undefined || opts.quizThreshold !== undefined) {
    store.lessons = [
      { id: 'l1', course_module_id: 'm1', type: 'video', is_published: true },
      { id: 'l2', course_module_id: 'm1', type: 'quiz', is_published: true },
    ];
    store.quizzes = [
      { id: 'q1', course_id: 'c1', lesson_id: 'l2', title: 'Kiểm tra cuối khóa', pass_score_percent: opts.quizThreshold ?? null },
    ];
    if (opts.bestPercent !== null && opts.bestPercent !== undefined) {
      // bestPercent 70 -> 7/10; 60 -> 6/10; 85 -> 17/20.
      const total = opts.bestPercent === 85 ? 20 : 10;
      const score = Math.round((opts.bestPercent / 100) * total);
      store.quiz_attempts = [{ user_id: STUDENT_ID, lesson_id: 'l2', score, total }];
    }
  }
  return store;
}

describe('ma chung chi', () => {
  it('buildCertificateCode dung dinh dang VISFAR-CERT-2026-000001', () => {
    expect(buildCertificateCode(2026, 1)).toBe('VISFAR-CERT-2026-000001');
    expect(buildCertificateCode(2026, 42)).toBe('VISFAR-CERT-2026-000042');
  });
  it('isValidCertificateCode chan ma sai dinh dang', () => {
    expect(isValidCertificateCode('VISFAR-CERT-2026-000001')).toBe(true);
    expect(isValidCertificateCode('VISFAR-CERT-2026-1')).toBe(false);
    expect(isValidCertificateCode('CERT-2026-000001')).toBe(false);
    expect(isValidCertificateCode('')).toBe(false);
  });
  it('normalizeCertificateCode cat khoang trang + viet hoa', () => {
    expect(normalizeCertificateCode('  visfar-cert-2026-000001 ')).toBe('VISFAR-CERT-2026-000001');
  });
});

describe('nguong dat quiz mac dinh 70%', () => {
  it('DEFAULT_PASSING_SCORE_PERCENT = 70', () => {
    expect(DEFAULT_PASSING_SCORE_PERCENT).toBe(70);
  });
  it('resolvePassingThreshold: null -> 70, nguong rieng duoc ton trong', () => {
    expect(resolvePassingThreshold(null)).toBe(70);
    expect(resolvePassingThreshold(undefined)).toBe(70);
    expect(resolvePassingThreshold(80)).toBe(80);
    expect(resolvePassingThreshold(150)).toBe(70);
    expect(resolvePassingThreshold(-5)).toBe(70);
  });
});

describe('checkCertificateEligibility — logic thuan', () => {
  it('100% bai + quiz 75% >= 70% -> du dieu kien', () => {
    const r = checkCertificateEligibility({
      enrollmentStatus: 'active',
      totalLessons: 2,
      completedLessons: 2,
      quizzes: [{ quizId: 'q1', lessonId: 'l2', title: 'Quiz', passScorePercent: null, bestScorePercent: 75 }],
    });
    expect(r.eligible).toBe(true);
    expect(r.quizzes[0].thresholdUsed).toBe(70);
  });
  it('100% bai, khong co quiz -> du dieu kien', () => {
    const r = checkCertificateEligibility({
      enrollmentStatus: 'completed',
      totalLessons: 3,
      completedLessons: 3,
      quizzes: [],
    });
    expect(r.eligible).toBe(true);
  });
  it('quiz 69% < 70% -> khong du dieu kien, ly do neu ro nguong', () => {
    const r = checkCertificateEligibility({
      enrollmentStatus: 'active',
      totalLessons: 1,
      completedLessons: 1,
      quizzes: [{ quizId: 'q1', lessonId: 'l2', title: 'Quiz', passScorePercent: null, bestScorePercent: 69 }],
    });
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(' ')).toContain('70%');
  });
  it('quiz co nguong rieng 80%: 75% truot, 85% dau', () => {
    const base = {
      enrollmentStatus: 'active',
      totalLessons: 1,
      completedLessons: 1,
    } as const;
    const fail = checkCertificateEligibility({
      ...base,
      quizzes: [{ quizId: 'q1', lessonId: 'l2', title: 'Quiz', passScorePercent: 80, bestScorePercent: 75 }],
    });
    expect(fail.eligible).toBe(false);
    const pass = checkCertificateEligibility({
      ...base,
      quizzes: [{ quizId: 'q1', lessonId: 'l2', title: 'Quiz', passScorePercent: 80, bestScorePercent: 85 }],
    });
    expect(pass.eligible).toBe(true);
  });
  it('chua lam quiz -> khong du dieu kien', () => {
    const r = checkCertificateEligibility({
      enrollmentStatus: 'active',
      totalLessons: 1,
      completedLessons: 1,
      quizzes: [{ quizId: 'q1', lessonId: 'l2', title: 'Quiz', passScorePercent: null, bestScorePercent: null }],
    });
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(' ')).toContain('Chưa làm');
  });
  it('9/10 bai -> khong du dieu kien (can 100%)', () => {
    const r = checkCertificateEligibility({
      enrollmentStatus: 'active',
      totalLessons: 10,
      completedLessons: 9,
      quizzes: [],
    });
    expect(r.eligible).toBe(false);
    expect(r.reasons.join(' ')).toContain('100%');
  });
  it('enrollment revoked -> khong du dieu kien', () => {
    const r = checkCertificateEligibility({
      enrollmentStatus: 'revoked',
      totalLessons: 1,
      completedLessons: 1,
      quizzes: [],
    });
    expect(r.eligible).toBe(false);
  });
});

describe('issueCertificateIfEligible', () => {
  it('du dieu kien -> cap moi, ma do DB sinh, co snapshot + audit', async () => {
    const store = completedStore();
    const res = await issueCertificateIfEligible(makeClient(store), {
      userId: STUDENT_ID,
      courseId: 'c1',
      actorId: ADMIN_ID,
      issuedVia: 'admin',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.alreadyIssued).toBe(false);
    expect(res.certificate.certificateCode).toBe('VISFAR-CERT-2026-000001');
    expect(res.certificate.verificationCode).toBeTruthy();
    expect(store.certificates).toHaveLength(1);
    const snap = store.certificates[0].eligibility_snapshot as Row;
    expect(snap.lessons_completed).toBe(2);
    expect(snap.lessons_total).toBe(2);
    expect(store.certificates[0].issued_via).toBe('admin');
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('certificate.issue');
  });
  it('da co chung chi valid -> tra lai, khong tao trung', async () => {
    const store = completedStore();
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', verification_code: 'abc', status: 'valid', issued_at: '2026-11-10T00:00:00Z' },
    ];
    const res = await issueCertificateIfEligible(makeClient(store), { userId: STUDENT_ID, courseId: 'c1' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.alreadyIssued).toBe(true);
    expect(res.certificate.certificateCode).toBe('VISFAR-CERT-2026-000001');
    expect(store.certificates).toHaveLength(1);
  });
  it('chung chi cu da revoked -> duoc cap moi', async () => {
    const store = completedStore();
    store.certificates = [
      { id: 'cert0', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', verification_code: 'abc', status: 'revoked', issued_at: '2026-11-09T00:00:00Z' },
    ];
    const res = await issueCertificateIfEligible(makeClient(store), { userId: STUDENT_ID, courseId: 'c1' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.alreadyIssued).toBe(false);
    expect(store.certificates).toHaveLength(2);
  });
  it('chi mo video (in_progress, 95%) khong tinh hoan thanh -> khong cap', async () => {
    const store = baseStore();
    store.lesson_progress = [
      { user_id: STUDENT_ID, lesson_id: 'l1', status: 'in_progress', progress_percent: 95 },
      { user_id: STUDENT_ID, lesson_id: 'l2', status: 'completed', progress_percent: 100 },
    ];
    const res = await issueCertificateIfEligible(makeClient(store), { userId: STUDENT_ID, courseId: 'c1' });
    expect(res.status).toBe('not-eligible');
    if (res.status !== 'not-eligible') throw new Error('expected not-eligible');
    expect(res.reasons.join(' ')).toContain('100%');
    expect(store.certificates).toHaveLength(0);
  });
  it('quiz 60% < 70% -> khong cap; 70% dung nguong -> cap', async () => {
    const failStore = completedStore({ bestPercent: 60 });
    const fail = await issueCertificateIfEligible(makeClient(failStore), { userId: STUDENT_ID, courseId: 'c1' });
    expect(fail.status).toBe('not-eligible');
    expect(failStore.certificates).toHaveLength(0);

    const passStore = completedStore({ bestPercent: 70 });
    const pass = await issueCertificateIfEligible(makeClient(passStore), { userId: STUDENT_ID, courseId: 'c1' });
    expect(pass.status).toBe('ok');
    expect(passStore.certificates).toHaveLength(1);
  });
  it('quiz chua lam lan nao -> khong cap', async () => {
    const store = completedStore({ quizThreshold: null, bestPercent: null });
    const res = await issueCertificateIfEligible(makeClient(store), { userId: STUDENT_ID, courseId: 'c1' });
    expect(res.status).toBe('not-eligible');
    expect(store.certificates).toHaveLength(0);
  });
  it('enrollment revoked -> khong cap', async () => {
    const store = completedStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'revoked' }];
    const res = await issueCertificateIfEligible(makeClient(store), { userId: STUDENT_ID, courseId: 'c1' });
    expect(res.status).toBe('not-eligible');
    expect(store.certificates).toHaveLength(0);
  });
  it('chua ghi danh -> loi', async () => {
    const store = completedStore();
    store.enrollments = [];
    const res = await issueCertificateIfEligible(makeClient(store), { userId: STUDENT_ID, courseId: 'c1' });
    expect(res.status).toBe('error');
    expect(store.certificates).toHaveLength(0);
  });
});

describe('revokeCertificate', () => {
  it('valid -> revoked + revoked_by/reason/at + audit certificate.revoke', async () => {
    const store = baseStore();
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', status: 'valid', issued_at: '2026-11-10T00:00:00Z' },
    ];
    const res = await revokeCertificate(makeClient(store), {
      adminId: ADMIN_ID,
      certificateId: 'cert1',
      reason: 'Cấp nhầm do lỗi đối soát',
    });
    expect(res.status).toBe('ok');
    expect(store.certificates[0].status).toBe('revoked');
    expect(store.certificates[0].revoked_by).toBe(ADMIN_ID);
    expect(store.certificates[0].revoked_reason).toBe('Cấp nhầm do lỗi đối soát');
    expect(store.certificates[0].revoked_at).toBeTruthy();
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('certificate.revoke');
    expect(store.audit_logs[0].actor_id).toBe(ADMIN_ID);
    expect(store.audit_logs[0].target_id).toBe('cert1');
  });
  it('thieu ly do -> loi, khong doi trang thai, khong ghi audit', async () => {
    const store = baseStore();
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', status: 'valid' },
    ];
    const res = await revokeCertificate(makeClient(store), { adminId: ADMIN_ID, certificateId: 'cert1', reason: '   ' });
    expect(res.status).toBe('error');
    expect(store.certificates[0].status).toBe('valid');
    expect(store.audit_logs).toHaveLength(0);
  });
  it('da revoked -> loi, khong ghi audit lan 2', async () => {
    const store = baseStore();
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', status: 'revoked' },
    ];
    const res = await revokeCertificate(makeClient(store), { adminId: ADMIN_ID, certificateId: 'cert1', reason: 'Thu hồi lại' });
    expect(res.status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
  });
  it('khong tim thay -> loi', async () => {
    const store = baseStore();
    const res = await revokeCertificate(makeClient(store), { adminId: ADMIN_ID, certificateId: 'khong-co', reason: 'Thu hồi' });
    expect(res.status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
  });
});

describe('verifyCertificateByCode', () => {
  it('tim theo ma chung chi: chi tra 6 truong an toan, khong lo email/SDT', async () => {
    const store = completedStore();
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', verification_code: 'deadbeef000000000000000000000001', status: 'valid', issued_at: '2026-11-10T00:00:00Z' },
    ];
    const res = await verifyCertificateByCode(makeClient(store), 'visfar-cert-2026-000001');
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data?.recipientName).toBe('Nguyễn Văn A');
    expect(res.data?.courseTitle).toBe('Khóa 1');
    expect(res.data?.status).toBe('valid');
    expect(res.data).not.toHaveProperty('email');
    expect(res.data).not.toHaveProperty('phone');
    expect(res.data).not.toHaveProperty('user_id');
  });
  it('tim theo verification_code cung duoc', async () => {
    const store = completedStore();
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', verification_code: 'deadbeef000000000000000000000001', status: 'revoked', issued_at: '2026-11-10T00:00:00Z' },
    ];
    const res = await verifyCertificateByCode(makeClient(store), 'DEADBEEF000000000000000000000001');
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data?.status).toBe('revoked');
  });
  it('ma khong ton tai -> data null (khong phai loi he thong)', async () => {
    const store = baseStore();
    const res = await verifyCertificateByCode(makeClient(store), 'VISFAR-CERT-2026-999999');
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data).toBeNull();
  });
  it('ma rong -> loi', async () => {
    const res = await verifyCertificateByCode(makeClient(baseStore()), '   ');
    expect(res.status).toBe('error');
  });
});

describe('QR xac thuc', () => {
  it('URL tra cuu + anh QR chi chua URL cong khai, khong chua PII', () => {
    const url = buildVerificationUrl('https://visfaracademy.netlify.app', 'VISFAR-CERT-2026-000001');
    expect(url).toBe('https://visfaracademy.netlify.app/chung-chi/tra-cuu?ma=VISFAR-CERT-2026-000001');
    const qr = buildQrCodeImageUrl(url);
    expect(qr).toContain('api.qrserver.com');
    expect(qr).toContain(encodeURIComponent(url));
    expect(qr).not.toContain('@');
    expect(qr).not.toContain('0900000001');
  });
});

describe('Task 11 — hook mail cap chung chi (E6)', () => {
  it('cap moi + hoc vien co email -> ok, khong emailWarning', async () => {
    const store = completedStore();
    const res = await issueCertificateIfEligible(makeClient(store), {
      userId: STUDENT_ID,
      courseId: 'c1',
      actorId: ADMIN_ID,
      issuedVia: 'admin',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.emailWarning).toBeUndefined();
    expect(store.certificates).toHaveLength(1);
  });
  it('cap moi + hoc vien khong co email -> van cap, co emailWarning', async () => {
    const store = completedStore();
    store.profiles = [
      { id: ADMIN_ID, role: 'admin', full_name: 'Quản trị viên' },
      { id: STUDENT_ID, role: 'student', full_name: 'Nguyễn Văn A' },
    ];
    const res = await issueCertificateIfEligible(makeClient(store), {
      userId: STUDENT_ID,
      courseId: 'c1',
      actorId: ADMIN_ID,
      issuedVia: 'admin',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.emailWarning).toMatch(/email/);
    expect(store.certificates).toHaveLength(1);
  });
  it('da cap roi (alreadyIssued) -> khong gui lai mail', async () => {
    const store = completedStore();
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', certificate_code: 'VISFAR-CERT-2026-000001', verification_code: 'abc', status: 'valid', issued_at: '2026-11-10T00:00:00Z' },
    ];
    const res = await issueCertificateIfEligible(makeClient(store), { userId: STUDENT_ID, courseId: 'c1' });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.alreadyIssued).toBe(true);
    expect(res.emailWarning).toBeUndefined();
    expect(store.certificates).toHaveLength(1);
  });
});
