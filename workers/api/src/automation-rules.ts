// Automation Rules — TASK 11: Visfar Academy.
//
// 5 rule da chot (chi 5 rule nay, khong them rule moi khi chua phe duyet):
//   (1) registration_welcome     Dang ky tai khoan  -> Welcome email            (E7)
//   (2) payment_verified_access  Thanh toan da xac minh -> Enroll + access email (E5)
//   (3) learning_reminder        Khong hoat dong 3 ngay -> Nhac hoc             (E9)
//   (4) course_completed         Hoan thanh khoa     -> Chuc mung               (E11)
//   (5) certificate_issued       Cap chung chi       -> Certificate email       (E6)
//
// Anh xa mau theo DANH SACH TASK 11 cua nhom templates
// (workers/api/src/email/README.md §1 + types.ts TEMPLATE_META) — day la
// bang mau duy nhat co ham render that (renderTemplate). Bang nay KHAC
// bang automation o docs/architecture/SYSTEM_ARCHITECTURE.md §9 (o do
// E1 = chao mung, E8 = da nhan thanh toan, E9 = hoan thanh + chung chi,
// E10 = nhac hoc...). Nhom templates da ghi ro mau thuat o README §1
// va can coordinator chot bang thong nhat; cho toi luc do, automation
// di theo bang Task 11 vi chi bang nay moi gui duoc that:
//   E7 'Chao mung' (care) — rule (1). E1 'Xac nhan dang ky' cung lien
//      quan dang ky, nhung ten rule trong task la "Welcome email" nen
//      chon E7; neu coordinator muon E1 thi doi 1 dong o RULE_TEMPLATES.
//   E5 'Cap quyen hoc' (transactional) — rule (2), email cap quyen truy
//      cap khoa. E4 'Xac nhan thanh toan' la email rieng (chi xac nhan
//      da nhan tien, khong cap quyen) — KHONG nam trong 5 rule; neu muon
//      gui ca E4 khi thanh toan thi can quyet dinh bo sung (xem doc).
//   E9 'Nhac hoc' (care) — rule (3). Can courseTitle + resumeUrl +
//      daysInactive (xem InactiveLearner).
//   E11 'Chuc mung hoan thanh khoa hoc' (care) — rule (4).
//   E6 'Cap chung chi' (transactional) — rule (5).
// Loai 'transactional' o day = E1–E6, 'care' = E7–E13 (theo types.ts).
//
// Cach kich hoat (xem them docs/automation/TASK11_AUTOMATION_RULES.md):
//   (1) Goi runRegistrationWelcome() ngay sau khi Supabase Auth tao
//       profiles (trigger dang ky / route /dang-ky). Event-driven.
//   (2) Goi runPaymentVerifiedAccess() ngay sau khi don chuyen sang paid
//       VA enrollment da duoc tao (mark-paid / SePay webhook). Event-driven.
//       Rule nay KHONG tu tao enrollment — no chi gui email truy cap khi
//       enrollment da ton tai, de khong gui link vao khoa chua co quyen.
//   (3) Workers Cron chay moi gio (wrangler: [triggers] crons=["0 * * * *"])
//       goi runLearningReminderCron() trong automation-cron.ts. Cron-driven.
//   (4) Goi runCourseCompleted() khi enrollments.status chuyen sang
//       'completed' (100% bai + quiz dat — dieu kien nay da duoc ma hoa
//       trong enrollment status theo TASK 08, khong kiem tra lai o day).
//       Event-driven.
//   (5) Goi runCertificateIssued() ngay sau khi dong certificates duoc
//       tao o trang thai 'valid' (migration 0016). Event-driven.
//
// Chong gui trung + gioi han tan suat (ap dung cho ca 5 rule):
//   - Idempotency key: `${rule}:${userId}:${YYYY-MM-DD}` (ngay theo gio
//     Viet Nam, Asia/Ho_Chi_Minh), luu trong automation_events.payload
//     va gui len Resend lam Idempotency-Key header.
//     Truoc khi gui LUON kiem tra email_logs: cung (to_email, template,
//     related_id) da gui trong ngay (status queued/sent/delivered) thi
//     bo qua (outcome 'skipped', reason 'duplicate').
//     Luu y: khoa idempotency KHONG bao gom related_id — 2 khoa khac nhau
//     hoan thanh cung ngay van gui ca 2 (moi khoa co related_id rieng).
//   - Nhac hoc (rule 3, E9 — email lap lai duy nhat): toi da 1 lan /
//     3 ngay / enrollment, va dem vao han muc marketing toi da 2 lan /
//     tuan / user. Cac rule 1 lan (E7/E5/E11/E6) KHONG bi 2 han muc nay
//     chan — chi bi chong trung chan.
//   - Uu tien transactional: email giao dich (E5/E6) luon duoc thu gui;
//     khi han muc Resend gan het (100 email/ngay), cron TAM HOAN dot
//     nhac (xem automation-cron.ts) chu khong bao gio hoan transactional.
//     Neu Resend tra daily_quota_exceeded cho email care (E7/E9/E11)
//     thi ghi failed de gui lai sau 00:00 UTC (theo email/README.md §5).
//   - Moi lan chay (gui / bo qua / loi) deu ghi 1 dong automation_events
//     (status processed/skipped/failed); moi lan gui ghi 1 dong
//     email_logs (queued -> sent/failed, kem resend_id khi co).
//     Payload KHONG chua PII (khong email, khong ho ten) — chi rule,
//     template, idempotency_key, related_type/related_id.
//   - Gui that di qua sendEmail() cua nhom templates (src/email/client):
//     no tu validate + render mau + gui Resend. File nay khong tu render
//     HTML, khong goi Resend truc tiep.
//
// Khong sua migration cu. Khong tao du lieu hoc vien that.
import type { Env } from './env';
import { upstreamError } from './errors';
import { sendEmail as sendEmailViaClient } from './email/client';
import {
  APP_URL_PLACEHOLDER,
  type EmailSenderConfig,
  type SendEmailErrorCode,
  type SendEmailInput as EmailClientInput,
  type TemplateData,
} from './email/types';

// ---------------------------------------------------------------------------
// Hang so — gioi han da chot (doi so nay = doi quyet dinh, ghi lai)
// ---------------------------------------------------------------------------

/** Gioi han Resend Free: 100 email/ngay (SYSTEM_ARCHITECTURE.md §12). */
export const RESEND_DAILY_LIMIT = 100;
/** Cron tam hoan email nhac khi da gui >= nguong nay trong ngay. */
export const REMINDER_DEFERRAL_THRESHOLD = 90;
/** Rule (3): so ngay khong hoat dong moi nhac (TASK 11 chot 3). */
export const LEARNING_REMINDER_DAYS = 3;
/** Rule (3): khoang cach toi thieu giua 2 lan nhac cung enrollment. */
export const REMINDER_MIN_INTERVAL_DAYS = 3;
/** Han muc marketing: toi da 2 email nhac / tuan / user. */
export const MARKETING_MAX_PER_WEEK = 2;
/** So ngay cua 1 tuan tinh han muc marketing. */
export const MARKETING_WINDOW_DAYS = 7;

/** Mui gio tinh "ngay" cho idempotency key. */
export const AUTOMATION_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Goc URL mac dinh cho link trong email (khi deps khong truyen siteOrigin). */
export const DEFAULT_SITE_ORIGIN = APP_URL_PLACEHOLDER;

// ---------------------------------------------------------------------------
// Rule + mau email (bang Task 11 — xem ghi chu dau file)
// ---------------------------------------------------------------------------

export type AutomationRuleId =
  | 'registration_welcome'
  | 'payment_verified_access'
  | 'learning_reminder'
  | 'course_completed'
  | 'certificate_issued';

/** Ma mau theo bang Task 11 (src/email/types.ts TEMPLATE_META). */
export type EmailTemplateCode = 'E5' | 'E6' | 'E7' | 'E9' | 'E11';

export type EmailCategory = 'transactional' | 'care';

export interface TemplateMeta {
  code: EmailTemplateCode;
  category: EmailCategory;
  /** Ten goi trong bang Task 11. */
  name: string;
  /** true = email lap lai (nhac hoc) — moi bi han muc tan suat. */
  recurringReminder: boolean;
}

/** Anh xa rule -> mau. Chi doi khi coordinator chot bang mau moi. */
export const RULE_TEMPLATES: Record<AutomationRuleId, TemplateMeta> = {
  registration_welcome: { code: 'E7', category: 'care', name: 'Chào mừng', recurringReminder: false },
  payment_verified_access: { code: 'E5', category: 'transactional', name: 'Cấp quyền học', recurringReminder: false },
  learning_reminder: { code: 'E9', category: 'care', name: 'Nhắc học', recurringReminder: true },
  course_completed: { code: 'E11', category: 'care', name: 'Chúc mừng hoàn thành khóa học', recurringReminder: false },
  certificate_issued: { code: 'E6', category: 'transactional', name: 'Cấp chứng chỉ', recurringReminder: false },
};

/** Cac mau tinh vao han muc marketing 2 lan/tuan (hien chi co E9). */
export const MARKETING_TEMPLATES: readonly EmailTemplateCode[] = ['E9'];

// ---------------------------------------------------------------------------
// Kieu du lieu
// ---------------------------------------------------------------------------

export interface EmailLogRow {
  id: string;
  to_email: string;
  template: string;
  resend_id: string | null;
  status: string;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}

export interface AutomationEventInput {
  event_type: string;
  user_id: string;
  related_type: string;
  related_id: string;
  payload: Record<string, unknown>;
}

export interface EnrollmentRef {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  completed_at: string | null;
}

export interface CertificateRef {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  certificate_code: string;
}

/** 1 hoc vien thuoc dien nhac hoc (do store truy van). */
export interface InactiveLearner {
  userId: string;
  email: string;
  fullName: string;
  enrollmentId: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  /** ISO timestamptz; null = chua co tien do nao (lay enrolledAt lam moc). */
  lastActivityAt: string | null;
  enrolledAt: string;
}

/**
 * Cong luu tru ma cac rule can. Viet theo interface de test dung fake
 * ma khong cham DB that; ban cai dat Supabase that o cuoi file
 * (createSupabaseAutomationStore). Chi doc/ghi 4 bang: email_logs,
 * automation_events, enrollments, certificates (+ lesson_progress chi
 * de tinh last activity trong listInactiveLearners).
 */
export interface AutomationStore {
  findEmailLogs(query: {
    toEmail?: string;
    template?: string;
    sinceIso?: string;
  }): Promise<EmailLogRow[]>;
  insertEmailLog(entry: {
    to_email: string;
    template: string;
    status: string;
    related_type: string;
    related_id: string;
  }): Promise<{ id: string }>;
  updateEmailLog(
    id: string,
    patch: { status: string; resend_id?: string | null },
  ): Promise<void>;
  insertAutomationEvent(event: AutomationEventInput): Promise<{ id: string }>;
  updateAutomationEvent(
    id: string,
    patch: { status: string; processed_at?: string; error_message?: string | null },
  ): Promise<void>;
  getEnrollment(userId: string, courseId: string): Promise<EnrollmentRef | null>;
  getEnrollmentByOrder(orderId: string): Promise<EnrollmentRef | null>;
  getCertificate(certificateId: string): Promise<CertificateRef | null>;
  /**
   * Hoc vien co enrollment 'active', chua hoan thanh, khong hoat dong
   * >= inactiveDays (tinh theo lastActivityAt, fallback enrolledAt).
   * Luu y schema that: lesson_progress (0001) khong co course_id
   * (0012 moi them) nen last activity tinh THEO USER, khong theo tung
   * khoa — hoc vien hoc khoa khac van tinh la co hoat dong.
   */
  listInactiveLearners(now: Date, inactiveDays: number): Promise<InactiveLearner[]>;
}

export interface SendEmailInput {
  to: string;
  template: EmailTemplateCode;
  /**
   * Du lieu mau theo src/email/types.ts (TemplateData). Subject do
   * renderTemplate cua nhom templates sinh — rule khong dat subject.
   * Truong bat buoc cua tung mau: E7 studentName; E5 studentName +
   * courseTitle + courseUrl; E9 studentName + courseTitle + resumeUrl
   * + daysInactive; E11 studentName + courseTitle; E6 studentName +
   * courseTitle + certificateCode + certificateUrl. Thieu truong ->
   * sendEmail tra invalid_template_data, rule ghi failed (khong gui).
   */
  data: Record<string, unknown>;
  idempotencyKey: string;
  relatedType?: string;
  relatedId?: string;
}

/** Cong gui mail. Ban that la sendEmail() cua nhom templates (xem cuoi file). */
export interface Mailer {
  sendEmail(input: SendEmailInput): Promise<{ resendId: string }>;
}

export interface AutomationDeps {
  store: AutomationStore;
  mailer: Mailer;
  /** Goc site de dung link khoa / tra cuu chung chi. Mac dinh APP_URL_PLACEHOLDER. */
  siteOrigin?: string;
}

export type RuleOutcome = 'sent' | 'skipped' | 'failed';

export type SkipReason =
  | 'invalid_email'
  | 'payment_not_succeeded'
  | 'enrollment_not_found'
  | 'enrollment_not_active'
  | 'course_not_completed'
  | 'certificate_not_found'
  | 'certificate_not_valid'
  | 'still_active'
  | 'duplicate'
  | 'too_frequent'
  | 'weekly_cap'
  | 'send_failed';

export interface RuleResult {
  rule: AutomationRuleId;
  outcome: RuleOutcome;
  /** 'sent' khi gui thanh cong; ly do bo qua / loi khi khac. */
  reason: string;
  idempotencyKey: string;
  emailLogId?: string;
  resendId?: string;
  automationEventId?: string;
}

// ---------------------------------------------------------------------------
// Helper ngay / idempotency / email / URL (thuan, test duoc khong can DB)
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' theo gio Viet Nam. */
export function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AUTOMATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Idempotency key: user + rule + ngay (TASK 11). */
export function buildIdempotencyKey(
  rule: AutomationRuleId,
  userId: string,
  date: Date,
): string {
  return `${rule}:${userId}:${toDateKey(date)}`;
}

/** ISO string cua 00:00 ngay hien tai theo gio Viet Nam (moc loc email_logs). */
export function vnDayStartIso(date: Date): string {
  return new Date(`${toDateKey(date)}T00:00:00+07:00`).toISOString();
}

export function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** So ngay (co the le) tu moc ISO den now; null = khong co moc. */
export function daysSince(iso: string | null, now: Date): number | null {
  if (iso === null) return null;
  const ms = now.getTime() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / (24 * 60 * 60 * 1000);
}

/** Cung regex email nhu CHECK o schema (TLD >= 2 ky tu). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Goc site dung cho link; mac dinh placeholder cua nhom templates. */
export function resolveSiteOrigin(deps: AutomationDeps): string {
  const origin = (deps.siteOrigin ?? '').trim();
  return origin === '' ? DEFAULT_SITE_ORIGIN : origin.replace(/\/+$/, '');
}

/** Link vao khoa hoc (trang hoc vien). */
export function buildCourseUrl(siteOrigin: string, courseSlug: string): string {
  return `${siteOrigin.replace(/\/+$/, '')}/hoc-vien/khoa-hoc/${encodeURIComponent(courseSlug)}`;
}

/** Link tra cuu chung chi cong khai (cung la noi dung QR). */
export function buildVerificationUrl(siteOrigin: string, certificateCode: string): string {
  return `${siteOrigin.replace(/\/+$/, '')}/chung-chi/tra-cuu?ma=${encodeURIComponent(certificateCode)}`;
}

const SENT_LIKE_STATUSES = new Set(['queued', 'sent', 'delivered']);

// ---------------------------------------------------------------------------
// Lõi chung: ghi automation_events + email_logs, chống trùng, giới hạn
// ---------------------------------------------------------------------------

interface ExecuteOptions {
  rule: AutomationRuleId;
  userId: string;
  email: string;
  relatedType: string;
  relatedId: string;
  templateData: Record<string, unknown>;
  /** Kiem tra dieu kien nghiep vu cua rule; tra ly do bo qua neu chua du. */
  checkEligibility: () => Promise<SkipReason | null>;
  deps: AutomationDeps;
  now: Date;
}

async function markEvent(
  store: AutomationStore,
  eventId: string,
  status: 'processed' | 'skipped' | 'failed',
  now: Date,
  errorMessage?: string,
): Promise<void> {
  await store.updateAutomationEvent(eventId, {
    status,
    processed_at: now.toISOString(),
    error_message: errorMessage ?? null,
  });
}

/**
 * Chay 1 rule: ghi automation_event (pending) -> kiem tra dieu kien ->
 * kiem tra trung trong email_logs -> kiem tra han muc (chi email nhac
 * lap lai) -> ghi email_log (queued) -> gui qua mailer -> cap nhat
 * sent/failed.
 * Loi mailer tra ve RuleResult 'failed', KHONG throw (de cron chay tiep
 * hoc vien khac). Loi store (khong ghi duoc log/event) thi throw — vi
 * khi do khong the khang dinh da gui hay chua.
 */
export async function executeAutomationRule(opts: ExecuteOptions): Promise<RuleResult> {
  const { rule, userId, email, relatedType, relatedId, deps, now } = opts;
  const meta = RULE_TEMPLATES[rule];
  const idempotencyKey = buildIdempotencyKey(rule, userId, now);

  const base: Omit<RuleResult, 'outcome' | 'reason'> = { rule, idempotencyKey };
  const skipped = (reason: SkipReason, automationEventId?: string): RuleResult => ({
    ...base,
    outcome: 'skipped',
    reason,
    automationEventId,
  });

  const event = await deps.store.insertAutomationEvent({
    event_type: rule,
    user_id: userId,
    related_type: relatedType,
    related_id: relatedId,
    payload: {
      rule,
      template: meta.code,
      idempotency_key: idempotencyKey,
      related_type: relatedType,
      related_id: relatedId,
    },
  });
  const automationEventId = event.id;

  if (!isValidEmail(email)) {
    await markEvent(deps.store, automationEventId, 'skipped', now);
    return skipped('invalid_email', automationEventId);
  }

  const notEligible = await opts.checkEligibility();
  if (notEligible !== null) {
    await markEvent(deps.store, automationEventId, 'skipped', now);
    return skipped(notEligible, automationEventId);
  }

  // Chong gui trung: cung nguoi nhan + mau + doi tuong da gui trong ngay.
  const todayLogs = await deps.store.findEmailLogs({
    toEmail: email.trim(),
    template: meta.code,
    sinceIso: vnDayStartIso(now),
  });
  const duplicate = todayLogs.some(
    (log) =>
      log.related_id === relatedId && SENT_LIKE_STATUSES.has(log.status),
  );
  if (duplicate) {
    await markEvent(deps.store, automationEventId, 'skipped', now);
    return skipped('duplicate', automationEventId);
  }

  // Gioi han tan suat — CHI ap cho email nhac lap lai (E9). Email giao
  // dich (E5/E6) va email 1 lan (E7/E11) khong bi 2 han muc nay chan
  // (transactional / one-off luon duoc uu tien truoc email nhac).
  if (meta.recurringReminder) {
    const recentLogs = await deps.store.findEmailLogs({
      toEmail: email.trim(),
      template: meta.code,
      sinceIso: daysAgoIso(now, REMINDER_MIN_INTERVAL_DAYS),
    });
    const remindedRecently = recentLogs.some(
      (log) =>
        log.related_id === relatedId && SENT_LIKE_STATUSES.has(log.status),
    );
    if (remindedRecently) {
      await markEvent(deps.store, automationEventId, 'skipped', now);
      return skipped('too_frequent', automationEventId);
    }

    const weekLogs = await deps.store.findEmailLogs({
      toEmail: email.trim(),
      sinceIso: daysAgoIso(now, MARKETING_WINDOW_DAYS),
    });
    const marketingSentThisWeek = weekLogs.filter(
      (log) =>
        (MARKETING_TEMPLATES as readonly string[]).includes(log.template) &&
        SENT_LIKE_STATUSES.has(log.status),
    ).length;
    if (marketingSentThisWeek >= MARKETING_MAX_PER_WEEK) {
      await markEvent(deps.store, automationEventId, 'skipped', now);
      return skipped('weekly_cap', automationEventId);
    }
  }

  const emailLog = await deps.store.insertEmailLog({
    to_email: email.trim(),
    template: meta.code,
    status: 'queued',
    related_type: relatedType,
    related_id: relatedId,
  });

  try {
    const sent = await deps.mailer.sendEmail({
      to: email.trim(),
      template: meta.code,
      data: opts.templateData,
      idempotencyKey,
      relatedType,
      relatedId,
    });
    await deps.store.updateEmailLog(emailLog.id, {
      status: 'sent',
      resend_id: sent.resendId,
    });
    await markEvent(deps.store, automationEventId, 'processed', now);
    return {
      ...base,
      outcome: 'sent',
      reason: 'sent',
      emailLogId: emailLog.id,
      resendId: sent.resendId,
      automationEventId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send failed';
    await deps.store.updateEmailLog(emailLog.id, { status: 'failed' });
    await markEvent(deps.store, automationEventId, 'failed', now, message);
    return {
      ...base,
      outcome: 'failed',
      reason: 'send_failed',
      emailLogId: emailLog.id,
      automationEventId,
    };
  }
}

// ---------------------------------------------------------------------------
// Rule (1) — Dang ky -> Welcome email (E7, care)
// Dieu kien: email hop le. Goi ngay sau khi tao profiles.
// Du lieu mau E7: studentName (+ dashboardUrl tuy chon).
// ---------------------------------------------------------------------------

export interface RegistrationWelcomeInput {
  userId: string;
  email: string;
  fullName: string;
}

export async function runRegistrationWelcome(
  input: RegistrationWelcomeInput,
  deps: AutomationDeps,
  now: Date = new Date(),
): Promise<RuleResult> {
  const origin = resolveSiteOrigin(deps);
  return executeAutomationRule({
    rule: 'registration_welcome',
    userId: input.userId,
    email: input.email,
    relatedType: 'profiles',
    relatedId: input.userId,
    templateData: {
      studentName: input.fullName,
      dashboardUrl: `${origin}/hoc-vien/dashboard`,
    },
    checkEligibility: async () => null,
    deps,
    now,
  });
}

// ---------------------------------------------------------------------------
// Rule (2) — Thanh toan da xac minh -> Enroll + access email (E5)
// Dieu kien: paymentStatus = 'succeeded' VA enrollment da ton tai
// (duoc tao o buoc mark-paid / SePay webhook truoc do). Neu chua co
// enrollment thi BO QUA — khong gui link vao khoa chua co quyen.
// Du lieu mau E5: studentName + courseTitle + courseUrl (bat buoc).
// ---------------------------------------------------------------------------

export interface PaymentVerifiedAccessInput {
  userId: string;
  email: string;
  fullName: string;
  orderId: string;
  orderReferenceCode: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  amountVnd: number;
  paymentStatus: string;
}

export async function runPaymentVerifiedAccess(
  input: PaymentVerifiedAccessInput,
  deps: AutomationDeps,
  now: Date = new Date(),
): Promise<RuleResult> {
  const origin = resolveSiteOrigin(deps);
  return executeAutomationRule({
    rule: 'payment_verified_access',
    userId: input.userId,
    email: input.email,
    relatedType: 'orders',
    relatedId: input.orderId,
    templateData: {
      studentName: input.fullName,
      courseTitle: input.courseTitle,
      courseUrl: buildCourseUrl(origin, input.courseSlug),
    },
    checkEligibility: async () => {
      if (input.paymentStatus !== 'succeeded') return 'payment_not_succeeded';
      const enrollment = await deps.store.getEnrollmentByOrder(input.orderId);
      if (enrollment === null) return 'enrollment_not_found';
      if (enrollment.status !== 'active' && enrollment.status !== 'completed') {
        return 'enrollment_not_active';
      }
      return null;
    },
    deps,
    now,
  });
}

// ---------------------------------------------------------------------------
// Rule (3) — Khong hoat dong 3 ngay -> Learning reminder (E9, care)
// Dieu kien: enrollment 'active' (chua hoan thanh, chua bi thu hoi) VA
// last activity >= 3 ngay (chua co tien do thi tinh tu enrolledAt).
// Them gioi han: 1 lan/3 ngay/enrollment + toi da 2 lan/tuan/user
// (xem executeAutomationRule). Chi goi tu cron (automation-cron.ts).
// Du lieu mau E9: studentName + courseTitle + resumeUrl + daysInactive.
// ---------------------------------------------------------------------------

export async function runLearningReminderForLearner(
  learner: InactiveLearner,
  deps: AutomationDeps,
  now: Date = new Date(),
): Promise<RuleResult> {
  const origin = resolveSiteOrigin(deps);
  const last = learner.lastActivityAt ?? learner.enrolledAt;
  const inactiveDays = daysSince(last, now);
  const daysInactive = inactiveDays === null ? 0 : Math.max(0, Math.floor(inactiveDays));
  return executeAutomationRule({
    rule: 'learning_reminder',
    userId: learner.userId,
    email: learner.email,
    relatedType: 'enrollments',
    relatedId: learner.enrollmentId,
    templateData: {
      studentName: learner.fullName,
      courseTitle: learner.courseTitle,
      resumeUrl: buildCourseUrl(origin, learner.courseSlug),
      daysInactive,
    },
    checkEligibility: async () => {
      if (inactiveDays === null || inactiveDays < LEARNING_REMINDER_DAYS) {
        return 'still_active';
      }
      const enrollment = await deps.store.getEnrollment(
        learner.userId,
        learner.courseId,
      );
      if (enrollment === null) return 'enrollment_not_found';
      if (enrollment.status !== 'active') return 'enrollment_not_active';
      return null;
    },
    deps,
    now,
  });
}

// ---------------------------------------------------------------------------
// Rule (4) — Hoan thanh khoa -> Congratulations (E11, care)
// Dieu kien: enrollments.status = 'completed'. Dieu kien 100% bai +
// quiz dat da duoc ma hoa trong status nay (TASK 08); khong kiem tra
// lai lesson_progress/quiz_attempts o day.
// Du lieu mau E11: studentName + courseTitle (+ certificateUrl tuy chon).
// ---------------------------------------------------------------------------

export interface CourseCompletedInput {
  userId: string;
  email: string;
  fullName: string;
  courseId: string;
  courseTitle: string;
  enrollmentId: string;
}

export async function runCourseCompleted(
  input: CourseCompletedInput,
  deps: AutomationDeps,
  now: Date = new Date(),
): Promise<RuleResult> {
  return executeAutomationRule({
    rule: 'course_completed',
    userId: input.userId,
    email: input.email,
    relatedType: 'enrollments',
    relatedId: input.enrollmentId,
    templateData: {
      studentName: input.fullName,
      courseTitle: input.courseTitle,
    },
    checkEligibility: async () => {
      const enrollment = await deps.store.getEnrollment(
        input.userId,
        input.courseId,
      );
      if (enrollment === null) return 'enrollment_not_found';
      if (enrollment.status !== 'completed') return 'course_not_completed';
      return null;
    },
    deps,
    now,
  });
}

// ---------------------------------------------------------------------------
// Rule (5) — Cap chung chi -> Certificate email (E6, transactional)
// Dieu kien: dong certificates ton tai va status = 'valid'. Ma chung chi
// lay tu DB (nguon su that, migration 0016 sinh), khong tin ma caller
// dua vao neu lech.
// Du lieu mau E6: studentName + courseTitle + certificateCode +
// certificateUrl (bat buoc).
// ---------------------------------------------------------------------------

export interface CertificateIssuedInput {
  userId: string;
  email: string;
  fullName: string;
  courseId: string;
  courseTitle: string;
  certificateId: string;
  /** Ma caller thay (doi chieu); ma that lay tu DB khi gui. */
  certificateCode: string;
  verificationCode?: string;
}

export async function runCertificateIssued(
  input: CertificateIssuedInput,
  deps: AutomationDeps,
  now: Date = new Date(),
): Promise<RuleResult> {
  const origin = resolveSiteOrigin(deps);
  // templateData la object truyen theo tham chieu; checkEligibility chay
  // TRUOC buoc gui nen ma chung chi that tu DB (gan o duoi) se la ma
  // mailer nhan duoc — khong gui ma caller dua vao neu lech.
  const templateData: Record<string, unknown> = {
    studentName: input.fullName,
    courseTitle: input.courseTitle,
    certificateCode: input.certificateCode,
    certificateUrl: buildVerificationUrl(origin, input.certificateCode),
  };
  return executeAutomationRule({
    rule: 'certificate_issued',
    userId: input.userId,
    email: input.email,
    relatedType: 'certificates',
    relatedId: input.certificateId,
    templateData,
    checkEligibility: async () => {
      const cert = await deps.store.getCertificate(input.certificateId);
      if (cert === null) return 'certificate_not_found';
      if (cert.status !== 'valid') return 'certificate_not_valid';
      templateData.certificateCode = cert.certificate_code;
      templateData.certificateUrl = buildVerificationUrl(origin, cert.certificate_code);
      return null;
    },
    deps,
    now,
  });
}

// ---------------------------------------------------------------------------
// Mailer that: sendEmail() cua nhom templates (src/email/client).
// No tu validate nguoi nhan, render mau (subject + HTML + text), kiem
// tra cau hinh, gui Resend kem Idempotency-Key. Tra { ok:false } thay
// vi throw khi loi — adapter doi thanh throw de rule ghi failed.
// Luu y: logRow cua client co them cot error_message (khong co trong
// schema email_logs that) — adapter chi lay resendId/status, store cua
// automation tu ghi email_logs theo dung cot schema.
// ---------------------------------------------------------------------------

export type EmailModuleSendFn = (
  config: EmailSenderConfig,
  input: EmailClientInput,
) => Promise<{
  ok: boolean;
  resendId?: string;
  errorCode?: SendEmailErrorCode;
  message: string;
}>;

/**
 * Dung sendEmail that cua nhom templates lam Mailer cho automation.
 * Thieu RESEND_API_KEY / RESEND_FROM_EMAIL -> throw ngay khi tao
 * (cron chuyen thanh deferred, khong gui bua).
 */
export function createEmailModuleMailer(
  config: EmailSenderConfig,
  sendFn: EmailModuleSendFn = sendEmailViaClient,
): Mailer {
  const apiKey = (config.apiKey ?? '').trim();
  const from = (config.from ?? '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is missing (Workers Secrets)');
  if (!from) throw new Error('RESEND_FROM_EMAIL is missing (Workers Secrets)');
  return {
    async sendEmail(input: SendEmailInput): Promise<{ resendId: string }> {
      const result = await sendFn(
        { apiKey, from, appUrl: config.appUrl, fetchImpl: config.fetchImpl },
        {
          to: input.to,
          template: input.template,
          data: input.data as unknown as TemplateData,
          idempotencyKey: input.idempotencyKey,
          relatedType: input.relatedType,
          relatedId: input.relatedId,
        },
      );
      if (!result.ok) {
        throw new Error(`${result.errorCode ?? 'resend_error'}: ${result.message}`);
      }
      if (!result.resendId) {
        throw new Error('Resend response missing id');
      }
      return { resendId: result.resendId };
    },
  };
}

/** Lay mailer tu Env (Workers Secrets). */
export function createResendMailerFromEnv(env: Env): Mailer {
  return createEmailModuleMailer({
    apiKey: env.RESEND_API_KEY ?? '',
    from: env.RESEND_FROM_EMAIL ?? '',
  });
}

// ---------------------------------------------------------------------------
// Store that: Supabase PostgREST (service-role, chi o Workers).
// Theo dung kieu goi o workers/api/src/supabase.ts (fetch truc tiep,
// header apikey + Bearer service-role). Khong dung o frontend.
// ---------------------------------------------------------------------------

interface SbFetchOptions {
  method?: string;
  body?: unknown;
}

export function createSupabaseAutomationStore(
  env: Env,
  fetchFn: typeof fetch = fetch,
): AutomationStore {
  const base = env.SUPABASE_URL.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  async function sb<T>(path: string, opts: SbFetchOptions = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`${base}/rest/v1${path}`, {
        method: opts.method ?? 'GET',
        headers: {
          ...headers,
          ...(opts.method === 'POST' || opts.method === 'PATCH'
            ? { Prefer: 'return=representation' }
            : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (err) {
      throw upstreamError(
        'supabase',
        `fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw upstreamError('supabase', `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json().catch(() => null)) as T;
  }

  const first = <T>(rows: T[] | null): T | null =>
    rows !== null && rows.length > 0 ? (rows[0] as T) : null;

  return {
    async findEmailLogs(query) {
      const params = new URLSearchParams({
        select: 'id,to_email,template,resend_id,status,related_type,related_id,created_at',
        order: 'created_at.desc',
        limit: '200',
      });
      if (query.toEmail) params.set('to_email', `eq.${query.toEmail}`);
      if (query.template) params.set('template', `eq.${query.template}`);
      if (query.sinceIso) params.set('created_at', `gte.${query.sinceIso}`);
      return sb<EmailLogRow[]>(`/email_logs?${params.toString()}`);
    },

    async insertEmailLog(entry) {
      const rows = await sb<EmailLogRow[]>('/email_logs', {
        method: 'POST',
        body: entry,
      });
      const row = first(rows);
      if (row === null) throw upstreamError('supabase', 'insert email_logs: no row returned');
      return { id: row.id };
    },

    async updateEmailLog(id, patch) {
      await sb<unknown>(`/email_logs?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      });
    },

    async insertAutomationEvent(event) {
      const rows = await sb<Array<{ id: string }>>('/automation_events', {
        method: 'POST',
        body: { ...event, status: 'pending' },
      });
      const row = first(rows);
      if (row === null) {
        throw upstreamError('supabase', 'insert automation_events: no row returned');
      }
      return { id: row.id };
    },

    async updateAutomationEvent(id, patch) {
      await sb<unknown>(`/automation_events?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      });
    },

    async getEnrollment(userId, courseId) {
      const params = new URLSearchParams({
        select: 'id,user_id,course_id,status,completed_at',
        user_id: `eq.${userId}`,
        course_id: `eq.${courseId}`,
        limit: '1',
      });
      return first(
        await sb<EnrollmentRef[]>(`/enrollments?${params.toString()}`),
      );
    },

    async getEnrollmentByOrder(orderId) {
      const params = new URLSearchParams({
        select: 'id,user_id,course_id,status,completed_at',
        order_id: `eq.${orderId}`,
        limit: '1',
      });
      return first(
        await sb<EnrollmentRef[]>(`/enrollments?${params.toString()}`),
      );
    },

    async getCertificate(certificateId) {
      const params = new URLSearchParams({
        select: 'id,user_id,course_id,status,certificate_code',
        id: `eq.${certificateId}`,
        limit: '1',
      });
      return first(
        await sb<CertificateRef[]>(`/certificates?${params.toString()}`),
      );
    },

    async listInactiveLearners(now, inactiveDays) {
      // (a) Enrollment active kem profile + ten/slug khoa.
      const params = new URLSearchParams({
        select: 'id,user_id,course_id,status,enrolled_at,profiles!inner(email,full_name),courses(title,slug)',
        status: 'eq.active',
        limit: '500',
      });
      type EnrollmentEmbed = {
        id: string;
        user_id: string;
        course_id: string;
        status: string;
        enrolled_at: string;
        profiles: { email: string; full_name: string } | null;
        courses: { title: string; slug: string } | null;
      };
      const enrollments = await sb<EnrollmentEmbed[]>(
        `/enrollments?${params.toString()}`,
      );
      if (enrollments.length === 0) return [];
      // (b) Hoat dong gan nhat theo user = max lesson_progress.updated_at.
      const userIds = [...new Set(enrollments.map((e) => e.user_id))];
      const progressParams = new URLSearchParams({
        select: 'user_id,updated_at',
        user_id: `in.(${userIds.join(',')})`,
        order: 'updated_at.desc',
        limit: '1000',
      });
      const progress = await sb<Array<{ user_id: string; updated_at: string }>>(
        `/lesson_progress?${progressParams.toString()}`,
      );
      const lastByUser = new Map<string, string>();
      for (const row of progress) {
        if (!lastByUser.has(row.user_id)) lastByUser.set(row.user_id, row.updated_at);
      }
      const cutoffMs = inactiveDays * 24 * 60 * 60 * 1000;
      const out: InactiveLearner[] = [];
      for (const e of enrollments) {
        if (e.profiles === null || e.courses === null) continue;
        const lastActivityAt = lastByUser.get(e.user_id) ?? null;
        const anchor = lastActivityAt ?? e.enrolled_at;
        if (now.getTime() - new Date(anchor).getTime() < cutoffMs) continue;
        out.push({
          userId: e.user_id,
          email: e.profiles.email,
          fullName: e.profiles.full_name,
          enrollmentId: e.id,
          courseId: e.course_id,
          courseSlug: e.courses.slug,
          courseTitle: e.courses.title,
          lastActivityAt,
          enrolledAt: e.enrolled_at,
        });
      }
      return out;
    },
  };
}
