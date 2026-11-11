// Chung chi — Task 08: CERTIFICATE.
//
// DIEU KIEN CAP (chot, dong bo voi migration 0016 muc D):
//   1. enrollment con active/completed (khong revoked);
//   2. hoan thanh 100% bai hoc: lesson_progress.status = 'completed' cho
//      MOI bai cua khoa. Trang thai 'completed' chi dat khi video >= 90%
//      (trigger 0012 tinh lai tu video_position) hoac bai text/file/audio
//      bam "Da hoan thanh". CHI MO VIDEO chi tao dong in_progress
//      (progress_percent co the > 0) — KHONG BAO GIO du dieu kien cap.
//   3. moi quiz cua khoa co 1 lan lam DAT NGUONG: diem cao nhat
//      (score/total) >= quizzes.pass_score_percent; neu quiz de NULL
//      thi dung nguong mac dinh DEFAULT_PASSING_SCORE_PERCENT = 70%.
//      Khoa khong co quiz: chi can (1) + (2).
//
// Luu y schema that (doi chieu migration, khong theo DATABASE_SCHEMA.md
// mot cach mu):
//   - quizzes.pass_score_percent la ten cot that (khong phai
//     passing_score_percent); quiz_attempts KHONG co cot `passed` /
//     `quiz_id` — diem phai tinh tu score/total, quiz noi qua
//     quiz_attempts.lesson_id -> quizzes.lesson_id.
//   - Ma chung chi + verification_code do DB sinh (DEFAULT o 0016:
//     generate_certificate_code() / gen_random_bytes) — lib KHONG tu
//     sinh ma, chi doc lai dong vua insert.
//   - Tra cuu cong khai chi qua ham RPC verify_certificate (0016):
//     ham SECURITY DEFINER chi tra 6 truong an toan (ma, ten hoc vien,
//     ten/slug khoa, ngay cap, trang thai). Khong bao gio SELECT truc
//     tiep bang certificates bang anon key — RLS se chan, va mo RLS
//     cong khai se lo user_id.
//   - QR chi chua URL tra cuu cong khai (khong PII, khong so tai khoan):
//     anh QR lay qua api.qrserver.com tu URL do; dich vu ngoai chi
//     nhan duoc URL cong khai, khong nhan ten/email/SDT.
//
// Moi ham nhan SupabaseClient da mang JWT cua nguoi goi (admin route /
// Workers) va PHAI duoc goi sau requireAdmin() khi chay qua API admin.
// Ghi nhay cam khong di qua client trinh duyet.
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyCertificateEmail } from './email';

/** Nguong dat quiz mac dinh khi quiz khong dat pass_score_percent. */
export const DEFAULT_PASSING_SCORE_PERCENT = 70;

/** Tien to ma chung chi: VISFAR-CERT-YYYY-NNNNNN. */
export const CERTIFICATE_CODE_PREFIX = 'VISFAR-CERT';

/** Dich vu ve anh QR tu URL (khong can them dependency). */
export const QR_IMAGE_SERVICE_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

/** Do dai toi da ly do thu hoi (khop validateGrantReason o lms-admin). */
export const MAX_REVOKE_REASON_LENGTH = 500;

/** Dinh dang ma chung chi: VISFAR-CERT-2026-000001. */
export function buildCertificateCode(year: number, sequenceNumber: number): string {
  return `${CERTIFICATE_CODE_PREFIX}-${year}-${String(sequenceNumber).padStart(6, '0')}`;
}

export function isValidCertificateCode(code: string): boolean {
  return /^VISFAR-CERT-[0-9]{4}-[0-9]{6}$/.test(code.trim().toUpperCase());
}

/**
 * Chuan hoa ma nguoi dung go: cat khoang trang, viet hoa. Ma tra cuu
 * (verification_code, hex) cung duoc chuan hoa tuong tu o DB (upper).
 */
export function normalizeCertificateCode(input: string): string {
  return input.trim().toUpperCase();
}

/** URL tra cuu cong khai cua 1 chung chi — day la NOI DUNG DUY NHAT trong QR. */
export function buildVerificationUrl(origin: string, code: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/chung-chi/tra-cuu?ma=${encodeURIComponent(normalizeCertificateCode(code))}`;
}

/**
 * URL anh QR cho URL tra cuu. QR chi chua URL cong khai — khong ten,
 * khong email/SDT, khong so tai khoan, khong ma tra cuu rieng.
 */
export function buildQrCodeImageUrl(verificationUrl: string, size = 240): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    margin: '8',
    data: verificationUrl,
  });
  return `${QR_IMAGE_SERVICE_BASE}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Dieu kien cap — logic thuan (test duoc khong can DB)
// ---------------------------------------------------------------------------

export interface QuizEligibilityInput {
  quizId: string;
  lessonId: string;
  title: string;
  /** Nguong rieng cua quiz (quizzes.pass_score_percent); null = dung 70%. */
  passScorePercent: number | null;
  /** Diem cao nhat cua hoc vien o quiz nay (%), null = chua lam lan nao. */
  bestScorePercent: number | null;
}

export interface EligibilityInput {
  enrollmentStatus: string | null;
  totalLessons: number;
  completedLessons: number;
  quizzes: QuizEligibilityInput[];
}

export interface QuizEligibilityResult extends QuizEligibilityInput {
  thresholdUsed: number;
  passed: boolean;
}

export interface EligibilityCheck {
  eligible: boolean;
  reasons: string[];
  lessonsCompleted: number;
  lessonsTotal: number;
  quizzes: QuizEligibilityResult[];
}

/** Nguong ap dung cho 1 quiz: pass_score_percent hop le, neu khong thi 70%. */
export function resolvePassingThreshold(passScorePercent: number | null | undefined): number {
  if (
    typeof passScorePercent === 'number' &&
    Number.isFinite(passScorePercent) &&
    passScorePercent >= 0 &&
    passScorePercent <= 100
  ) {
    return passScorePercent;
  }
  return DEFAULT_PASSING_SCORE_PERCENT;
}

export function checkCertificateEligibility(input: EligibilityInput): EligibilityCheck {
  const reasons: string[] = [];
  if (input.enrollmentStatus === 'revoked') {
    reasons.push('Quyền học đã bị thu hồi.');
  } else if (input.enrollmentStatus !== 'active' && input.enrollmentStatus !== 'completed') {
    reasons.push('Chưa ghi danh khóa học này hoặc ghi danh không còn hiệu lực.');
  }
  if (input.totalLessons <= 0) {
    reasons.push('Khóa học chưa có bài học nào.');
  } else if (input.completedLessons < input.totalLessons) {
    reasons.push(
      `Chưa hoàn thành 100% bài học (${input.completedLessons}/${input.totalLessons} bài). ` +
        'Chỉ mở video chưa đủ — bài học chỉ tính hoàn thành khi xem đủ 90% video hoặc bấm "Đã hoàn thành".',
    );
  }
  const quizzes: QuizEligibilityResult[] = input.quizzes.map((q) => {
    const thresholdUsed = resolvePassingThreshold(q.passScorePercent);
    const passed =
      q.bestScorePercent !== null && q.bestScorePercent >= thresholdUsed;
    if (!passed) {
      if (q.bestScorePercent === null) {
        reasons.push(`Chưa làm bài kiểm tra "${q.title}" (cần đạt ${thresholdUsed}%).`);
      } else {
        reasons.push(
          `Bài kiểm tra "${q.title}" chưa đạt ngưỡng ${thresholdUsed}% (cao nhất ${q.bestScorePercent}%).`,
        );
      }
    }
    return { ...q, thresholdUsed, passed };
  });
  return {
    eligible: reasons.length === 0,
    reasons,
    lessonsCompleted: input.completedLessons,
    lessonsTotal: input.totalLessons,
    quizzes,
  };
}

// ---------------------------------------------------------------------------
// Kieu du lieu tra ve
// ---------------------------------------------------------------------------

export interface CertificateRow {
  id: string;
  certificateCode: string;
  verificationCode: string | null;
  courseTitle: string;
  courseSlug: string;
  status: string;
  issuedAt: string;
}

export interface PublicCertificate {
  certificateCode: string;
  recipientName: string;
  courseTitle: string;
  courseSlug: string;
  issuedAt: string;
  status: string;
}

export type IssueResult =
  | {
      status: 'ok';
      certificate: CertificateRow;
      alreadyIssued: boolean;
      auditWarning?: string;
      emailWarning?: string;
    }
  | { status: 'not-eligible'; reasons: string[] }
  | { status: 'error'; message: string };

export type RevokeResult =
  | { status: 'ok'; certificateId: string; auditWarning?: string }
  | { status: 'error'; message: string };

export type VerifyResult =
  | { status: 'success'; data: PublicCertificate | null }
  | { status: 'error'; message: string };

type Row = Record<string, unknown>;

function toCertificateRow(r: Row, courseTitle: string, courseSlug: string): CertificateRow {
  return {
    id: String(r.id ?? ''),
    certificateCode: String(r.certificate_code ?? ''),
    verificationCode:
      typeof r.verification_code === 'string' ? r.verification_code : null,
    courseTitle,
    courseSlug,
    status: String(r.status ?? 'valid'),
    issuedAt: String(r.issued_at ?? ''),
  };
}

function validateRevokeReason(reason: string | null | undefined): string | null {
  if (!reason || !reason.trim()) return 'Vui lòng nhập lý do thu hồi chứng chỉ.';
  if (reason.trim().length > MAX_REVOKE_REASON_LENGTH)
    return `Lý do tối đa ${MAX_REVOKE_REASON_LENGTH} ký tự.`;
  return null;
}

async function writeCertificateAudit(
  client: SupabaseClient,
  input: { actorId: string | null; action: string; targetId: string; details: Row },
): Promise<string | undefined> {
  const { error } = await client.from('audit_logs').insert({
    actor_id: input.actorId,
    action: input.action,
    target_type: 'certificate',
    target_id: input.targetId,
    details: input.details,
  });
  return error ? `Không ghi được audit log: ${error.message}` : undefined;
}

/**
 * Cap chung chi khi du dieu kien (idempotent): neu da co chung chi
 * 'valid' thi tra lai chung chi do, khong tao trung. Neu chung chi cu
 * da revoked thi duoc cap moi (0016 doi UNIQUE thanh UNIQUE rieng phan).
 * Chi goi tu server (route admin / Workers) sau khi kiem tra quyen.
 */
export async function issueCertificateIfEligible(
  client: SupabaseClient,
  input: { userId: string; courseId: string; actorId?: string | null; issuedVia?: 'auto' | 'admin' },
): Promise<IssueResult> {
  const issuedVia = input.issuedVia ?? 'auto';
  try {
    // 1. Enrollment phai ton tai va khong revoked.
    const { data: enrollment, error: enErr } = await client
      .from('enrollments')
      .select('id, user_id, course_id, status, completed_at')
      .eq('user_id', input.userId)
      .eq('course_id', input.courseId)
      .maybeSingle();
    if (enErr) return { status: 'error', message: `Không đọc được ghi danh: ${enErr.message}` };
    if (!enrollment) return { status: 'error', message: 'Học viên chưa ghi danh khóa học này.' };
    const en = enrollment as unknown as Row;

    // 2. Chung chi 'valid' da co -> tra lai, khong tao trung.
    const { data: existing, error: exErr } = await client
      .from('certificates')
      .select('id, certificate_code, verification_code, status, issued_at')
      .eq('user_id', input.userId)
      .eq('course_id', input.courseId)
      .eq('status', 'valid')
      .maybeSingle();
    if (exErr) return { status: 'error', message: `Không đọc được chứng chỉ: ${exErr.message}` };
    const course = await readCourseTitle(client, input.courseId);
    if (existing) {
      return {
        status: 'ok',
        certificate: toCertificateRow(
          existing as unknown as Row,
          course.title,
          course.slug,
        ),
        alreadyIssued: true,
      };
    }

    // 3. Bai hoc cua khoa: lessons <- course_modules (course_module_id).
    const { data: modules, error: modErr } = await client
      .from('course_modules')
      .select('id')
      .eq('course_id', input.courseId);
    if (modErr) return { status: 'error', message: `Không đọc được chương: ${modErr.message}` };
    const moduleIds = ((modules ?? []) as unknown as Row[]).map((m) => String(m.id));
    if (moduleIds.length === 0) {
      return { status: 'not-eligible', reasons: ['Khóa học chưa có bài học nào.'] };
    }
    const { data: lessons, error: lesErr } = await client
      .from('lessons')
      .select('id, course_module_id, type, is_published')
      .in('course_module_id', moduleIds);
    if (lesErr) return { status: 'error', message: `Không đọc được bài học: ${lesErr.message}` };
    // Bai an (is_published = false) khong chan cap; dong cu chua chay
    // 0013 thi is_published undefined -> tinh la hien.
    const visibleLessons = ((lessons ?? []) as unknown as Row[]).filter(
      (l) => l.is_published !== false,
    );
    const lessonIds = visibleLessons.map((l) => String(l.id));

    // 4. Tien do: CHI status='completed' moi tinh. Dong in_progress
    // (chi mo video, ke ca progress_percent > 0) khong tinh.
    let completedCount = 0;
    if (lessonIds.length > 0) {
      const { data: progress, error: prErr } = await client
        .from('lesson_progress')
        .select('lesson_id, status')
        .eq('user_id', input.userId)
        .in('lesson_id', lessonIds);
      if (prErr) return { status: 'error', message: `Không đọc được tiến độ: ${prErr.message}` };
      completedCount = ((progress ?? []) as unknown as Row[]).filter(
        (p) => p.status === 'completed',
      ).length;
    }

    // 5. Quiz: moi quiz cua khoa phai co lan lam dat nguong.
    // quiz_attempts chi co lesson_id/score/total (khong co passed).
    const { data: quizzes, error: qzErr } = await client
      .from('quizzes')
      .select('id, lesson_id, title, pass_score_percent')
      .eq('course_id', input.courseId);
    if (qzErr) return { status: 'error', message: `Không đọc được quiz: ${qzErr.message}` };
    const quizRows = ((quizzes ?? []) as unknown as Row[]).filter((q) =>
      lessonIds.includes(String(q.lesson_id)),
    );
    const quizInputs: QuizEligibilityInput[] = [];
    if (quizRows.length > 0) {
      const quizLessonIds = quizRows.map((q) => String(q.lesson_id));
      const { data: attempts, error: atErr } = await client
        .from('quiz_attempts')
        .select('lesson_id, score, total')
        .eq('user_id', input.userId)
        .in('lesson_id', quizLessonIds);
      if (atErr) return { status: 'error', message: `Không đọc được bài làm quiz: ${atErr.message}` };
      const bestByLesson = new Map<string, number>();
      for (const a of ((attempts ?? []) as unknown as Row[])) {
        const total = Number(a.total);
        const score = Number(a.score);
        if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(score)) continue;
        const pct = Math.round((score / total) * 1000) / 10;
        const key = String(a.lesson_id);
        if (pct > (bestByLesson.get(key) ?? -1)) bestByLesson.set(key, pct);
      }
      for (const q of quizRows) {
        quizInputs.push({
          quizId: String(q.id),
          lessonId: String(q.lesson_id),
          title: String(q.title ?? 'Bài kiểm tra'),
          passScorePercent:
            typeof q.pass_score_percent === 'number' ? q.pass_score_percent : null,
          bestScorePercent: bestByLesson.get(String(q.lesson_id)) ?? null,
        });
      }
    }

    const check = checkCertificateEligibility({
      enrollmentStatus: String(en.status ?? ''),
      totalLessons: visibleLessons.length,
      completedLessons: completedCount,
      quizzes: quizInputs,
    });
    if (!check.eligible) return { status: 'not-eligible', reasons: check.reasons };

    // 6. Cap: ma + verification_code do DB sinh (DEFAULT 0016).
    const snapshot: Row = {
      rule: 'task08-certificate-v1',
      enrollment_status: String(en.status ?? ''),
      lessons_completed: check.lessonsCompleted,
      lessons_total: check.lessonsTotal,
      quizzes: check.quizzes.map((q) => ({
        quiz_id: q.quizId,
        lesson_id: q.lessonId,
        title: q.title,
        threshold_percent: q.thresholdUsed,
        best_score_percent: q.bestScorePercent,
        passed: q.passed,
      })),
    };
    const { data: inserted, error: insErr } = await client
      .from('certificates')
      .insert({
        user_id: input.userId,
        course_id: input.courseId,
        status: 'valid',
        issued_via: issuedVia,
        eligibility_snapshot: snapshot,
      })
      .select('id, certificate_code, verification_code, status, issued_at')
      .single();
    if (insErr || !inserted) {
      return { status: 'error', message: `Không cấp được chứng chỉ: ${insErr?.message ?? 'không rõ lỗi'}` };
    }
    const cert = toCertificateRow(inserted as unknown as Row, course.title, course.slug);
    if (!cert.certificateCode) {
      return {
        status: 'error',
        message: 'Chứng chỉ đã tạo nhưng chưa có mã — DB chưa chạy migration 0016 (DEFAULT generate_certificate_code).',
      };
    }
    const auditWarning = await writeCertificateAudit(client, {
      actorId: input.actorId ?? null,
      action: 'certificate.issue',
      targetId: cert.id,
      details: { user_id: input.userId, course_id: input.courseId, issued_via: issuedVia, certificate_code: cert.certificateCode },
    });
    // Task 11 (E14 — certificate-issued): mail cap chung chi, CHI khi
    // cap MOI (alreadyIssued o tren da return truoc, khong gui lai).
    // Loi email khong lam hong viec cap: tra kem emailWarning nhu
    // auditWarning. Gui that chi xay ra o Workers khi RESEND_API_KEY
    // da cau hinh (mac dinh chi ghi log).
    let emailWarning: string | undefined;
    try {
      const { data: profile } = await client
        .from('profiles')
        .select('email')
        .eq('id', input.userId)
        .maybeSingle();
      const toEmail = (profile as unknown as { email?: unknown } | null)?.email;
      if (typeof toEmail === 'string' && toEmail.includes('@')) {
        const emailRes = await notifyCertificateEmail({
          toEmail,
          userId: input.userId,
          courseId: input.courseId,
          certificateId: cert.id,
          certificateCode: cert.certificateCode,
        });
        if (emailRes.status === 'failed') {
          emailWarning = `Đã cấp chứng chỉ nhưng chưa gửi được email: ${emailRes.error ?? 'không rõ lỗi'}`;
        }
      } else {
        emailWarning = 'Đã cấp chứng chỉ nhưng chưa gửi được email: không tìm thấy email học viên.';
      }
    } catch (err) {
      emailWarning = `Đã cấp chứng chỉ nhưng chưa gửi được email: ${err instanceof Error ? err.message : 'không rõ lỗi'}`;
    }
    return { status: 'ok', certificate: cert, alreadyIssued: false, ...(auditWarning ? { auditWarning } : {}), ...(emailWarning ? { emailWarning } : {}) };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Không cấp được chứng chỉ.' };
  }
}

async function readCourseTitle(
  client: SupabaseClient,
  courseId: string,
): Promise<{ title: string; slug: string }> {
  try {
    const { data } = await client
      .from('courses')
      .select('title, slug')
      .eq('id', courseId)
      .maybeSingle();
    const row = data as unknown as Row | null;
    return {
      title: typeof row?.title === 'string' ? row.title : '(Khóa học đã gỡ)',
      slug: typeof row?.slug === 'string' ? row.slug : '',
    };
  } catch {
    return { title: '(Khóa học đã gỡ)', slug: '' };
  }
}

/**
 * Thu hoi chung chi (admin): status -> 'revoked' + revoked_at/by/reason
 * + audit_logs 'certificate.revoke'. Ly do bat buoc (khong co ly do thi
 * khong thu hoi — tranh thu hoi im lang). Khong xoa dong chung chi.
 */
export async function revokeCertificate(
  client: SupabaseClient,
  input: { adminId: string; certificateId: string; reason: string },
): Promise<RevokeResult> {
  const reasonError = validateRevokeReason(input.reason);
  if (reasonError) return { status: 'error', message: reasonError };
  try {
    const { data: cert, error: selErr } = await client
      .from('certificates')
      .select('id, certificate_code, status')
      .eq('id', input.certificateId)
      .maybeSingle();
    if (selErr) return { status: 'error', message: `Không đọc được chứng chỉ: ${selErr.message}` };
    if (!cert) return { status: 'error', message: 'Không tìm thấy chứng chỉ.' };
    const row = cert as unknown as Row;
    if (row.status === 'revoked') {
      return { status: 'error', message: 'Chứng chỉ này đã bị thu hồi trước đó.' };
    }
    const { error: updErr } = await client
      .from('certificates')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: input.adminId,
        revoked_reason: input.reason.trim(),
      })
      .eq('id', input.certificateId);
    if (updErr) return { status: 'error', message: `Không thu hồi được chứng chỉ: ${updErr.message}` };
    const auditWarning = await writeCertificateAudit(client, {
      actorId: input.adminId,
      action: 'certificate.revoke',
      targetId: input.certificateId,
      details: {
        certificate_code: String(row.certificate_code ?? ''),
        reason: input.reason.trim(),
      },
    });
    return { status: 'ok', certificateId: input.certificateId, ...(auditWarning ? { auditWarning } : {}) };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Không thu hồi được chứng chỉ.' };
  }
}

/**
 * Tra cuu cong khai theo ma chung chi hoac verification_code.
 * Chi goi RPC verify_certificate (0016) — khong SELECT bang goc.
 * Tra null khi khong tim thay (khong phai loi he thong).
 */
export async function verifyCertificateByCode(
  client: SupabaseClient,
  code: string,
): Promise<VerifyResult> {
  const normalized = normalizeCertificateCode(code);
  if (!normalized) return { status: 'error', message: 'Vui lòng nhập mã chứng chỉ.' };
  try {
    const { data, error } = await client.rpc('verify_certificate', { p_code: normalized });
    if (error) return { status: 'error', message: `Không tra cứu được: ${error.message}` };
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) return { status: 'success', data: null };
    const r = rows[0];
    return {
      status: 'success',
      data: {
        certificateCode: String(r.certificate_code ?? ''),
        recipientName: String(r.recipient_name ?? ''),
        courseTitle: String(r.course_title ?? ''),
        courseSlug: String(r.course_slug ?? ''),
        issuedAt: String(r.issued_at ?? ''),
        status: String(r.status ?? 'valid'),
      },
    };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Không tra cứu được.' };
  }
}
