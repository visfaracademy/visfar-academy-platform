// Email giao dich + tu dong — Task 11 (M10), phia apps/web.
//
//   DIEM QUAN TRONG — ma mau nao moi la chuan:
//   Gia tri luu vao email_logs.template la MA E1–E13 theo module gui
//   that o Workers (workers/api/src/email/types.ts TEMPLATE_META +
//   automation-rules.ts RULE_TEMPLATES). Danh sach nay KHAC cach danh
//   so E1–E13 trong tai lieu kien truc (SYSTEM_MODULES.md M10 goi
//   'welcome' la E1, 'order-paid' la E8...) — xung dot da duoc nhom
//   email ghi ro o workers/api/src/email/README.md §1/§6.5 va can
//   coordinator chot bang thong nhat. File nay KHONG tu dat them 1
//   bang ma thu ba: no dung ma E cua module gui that, va giu bang
//   anh xa TASK11_TEMPLATE_MAP de doc hieu theo ten luong (welcome /
//   order-paid / ...) — slug kien truc chi la alias, khong luu DB.
//
//   Anh xa 4 diem tich hop Task 11 (theo automation-rules.ts):
//     dang ky xong -> welcome           = E7  (Chao mung, care)
//     thanh toan verified -> enroll     = E5  (Cap quyen hoc, transactional)
//       (E4 Xac nhan thanh toan la mail bao da nhan tien, gui truoc E5)
//     hoan thanh khoa -> congratulations = E11 (Chuc mung hoan thanh, care)
//     cap chung chi -> certificate      = E6  (Cap chung chi, transactional)
//
//   Gui that o dau:
//   * Apps/web KHONG BAO GIO goi Resend truc tiep (M10: chi Workers goi
//     Resend bang API key o server). Lib nay chi (1) dinh nghia template
//     + anh xa, (2) validate + dinh tuyen su kien email, (3) ghi log y
//     dinh vao email_logs khi co client server truyen vao.
//   * Sender mac dinh la logOnlySender: chi ghi log (khong gui mail
//     that, khong goi mang). Gui that chi xay ra khi Workers truyen
//     Resend sender vao — hien tai CHUA co key nao nen khong co email
//     that nao duoc gui tu code nay.
//   * Moi diem goi deu phai try/catch: loi email KHONG BAO GIO lam hong
//     luong chinh (dang ky / cap chung chi / tang khoa). requestEmailEvent
//     khong bao gio throw; cac wrapper cung vay.
//   * Log an toan: chi ghi template + related id, KHONG ghi dia chi
//     email / SDT / noi dung mail vao log (theo quy tac safeLog o
//     workers/api/src/env.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateEmail } from './validation';

/** Ma mau chuan — workers/api/src/email/types.ts TEMPLATE_META. */
export const EMAIL_TEMPLATE_CODES = {
  E1: { name: 'Xác nhận đăng ký', category: 'transactional', hasUnsubscribe: false },
  E2: { name: 'Xác minh email', category: 'transactional', hasUnsubscribe: false },
  E3: { name: 'Đặt lại mật khẩu', category: 'transactional', hasUnsubscribe: false },
  E4: { name: 'Xác nhận thanh toán', category: 'transactional', hasUnsubscribe: false },
  E5: { name: 'Cấp quyền học', category: 'transactional', hasUnsubscribe: false },
  E6: { name: 'Cấp chứng chỉ', category: 'transactional', hasUnsubscribe: false },
  E7: { name: 'Chào mừng', category: 'care', hasUnsubscribe: true },
  E8: { name: 'Hướng dẫn bắt đầu học', category: 'care', hasUnsubscribe: true },
  E9: { name: 'Nhắc học', category: 'care', hasUnsubscribe: true },
  E10: { name: 'Nhắc bài chưa hoàn thành', category: 'care', hasUnsubscribe: true },
  E11: { name: 'Chúc mừng hoàn thành khóa học', category: 'care', hasUnsubscribe: true },
  E12: { name: 'Khóa học mới', category: 'care', hasUnsubscribe: true },
  E13: { name: 'Gia hạn membership', category: 'care', hasUnsubscribe: true },
} as const;

export type EmailTemplateCode = keyof typeof EMAIL_TEMPLATE_CODES;
export type EmailCategory = 'transactional' | 'care';

/** Ten luong (slug kien truc M10) -> ma mau chuan de luu DB. */
export const TASK11_TEMPLATE_MAP = {
  welcome: 'E7',
  orderPaid: 'E4',
  enrollmentGranted: 'E5',
  courseCompleted: 'E11',
  certificateIssued: 'E6',
} as const;

export type Task11TemplateSlug = keyof typeof TASK11_TEMPLATE_MAP;

export function isEmailTemplateCode(value: unknown): value is EmailTemplateCode {
  return typeof value === 'string' && value in EMAIL_TEMPLATE_CODES;
}

export interface EmailEventInput {
  template: EmailTemplateCode;
  toEmail: string;
  userId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  /** Du lieu hien thi trong mail (tieu de khoa, ma don...). KHONG chua PII nhay cam. */
  data?: Record<string, unknown>;
}

export type EmailEventStatus = 'queued' | 'sent' | 'failed';

export interface EmailEventResult {
  status: EmailEventStatus;
  template: EmailTemplateCode;
  providerMessageId?: string;
  error?: string;
}

/** Sender that chi ghi y dinh, khong gui that — mac dinh o apps/web. */
export interface EmailSender {
  send(input: EmailEventInput): Promise<{ ok: boolean; providerMessageId?: string; error?: string }>;
}

export const logOnlySender: EmailSender = {
  async send(input: EmailEventInput): Promise<{ ok: boolean }> {
    // Chi ghi template + related — khong ghi dia chi email vao log.
    console.warn(
      `[email] queued (log-only, chua gui that): template=${input.template} related=${input.relatedType ?? '-'}:${input.relatedId ?? '-'}`,
    );
    return { ok: true };
  },
};

/** Loi validate input email: tra chuoi loi, hop le tra null. */
export function validateEmailEventInput(input: EmailEventInput): string | null {
  if (!isEmailTemplateCode(input.template)) return 'Template email không hợp lệ.';
  if (!validateEmail(input.toEmail ?? '')) return 'Email nhận không đúng định dạng.';
  if (input.userId !== undefined && input.userId !== null && typeof input.userId !== 'string') {
    return 'userId không hợp lệ.';
  }
  return null;
}

/**
 * Dinh tuyen 1 su kien email. KHONG BAO GIO throw — loi nao cung tra
 * { status: 'failed', error } de luong chinh khong bi anh huong.
 * Sender mac dinh chi ghi log; gui that can truyen sender Resend
 * (chi o phia server — Workers).
 */
export async function requestEmailEvent(
  input: EmailEventInput,
  opts: { sender?: EmailSender } = {},
): Promise<EmailEventResult> {
  const validationError = validateEmailEventInput(input);
  if (validationError) {
    return { status: 'failed', template: input.template, error: validationError };
  }
  const sender = opts.sender ?? logOnlySender;
  try {
    const sent = await sender.send(input);
    if (!sent.ok) {
      return { status: 'failed', template: input.template, error: sent.error ?? 'Không gửi được email.' };
    }
    return {
      status: sent.providerMessageId ? 'sent' : 'queued',
      template: input.template,
      ...(sent.providerMessageId ? { providerMessageId: sent.providerMessageId } : {}),
    };
  } catch (err) {
    return {
      status: 'failed',
      template: input.template,
      error: err instanceof Error ? err.message : 'Không gửi được email.',
    };
  }
}

// ---------------------------------------------------------------------------
// Wrapper goi san cho 4 diem tich hop Task 11 (+ E4 san cho mark-paid)
// ---------------------------------------------------------------------------

/** Sau dang ky -> E7 Chao mung (care). */
export async function notifyWelcomeEmail(
  input: { toEmail: string; userId?: string | null },
  opts: { sender?: EmailSender } = {},
): Promise<EmailEventResult> {
  return requestEmailEvent(
    { template: TASK11_TEMPLATE_MAP.welcome, toEmail: input.toEmail, userId: input.userId ?? null, relatedType: 'profile', relatedId: input.userId ?? null },
    opts,
  );
}

/**
 * E4 — mail "da nhan thanh toan". CHI goi sau khi thanh toan da duoc
 * XAC MINH (webhook SePay dung chu ky hoac admin mark-paid) — khong
 * bao gio goi khi chi co claim cua client.
 * DA NOI (Task 10, phia Workers): workers/api/src/payments.ts —
 * notifyOrderPaid() o buoc (11) cua confirmPayment() (dung chung
 * cho SePay webhook + admin mark-paid), gui E4 qua sendTemplatedEmail
 * trong try/catch + safeLog. Wrapper nay (apps/web) CHI la helper
 * log-only (ghi email_logs 'queued', khong co endpoint HTTP gui mail
 * that) — khong phai duong gui E4 that, giu lai de test/dung khi can.
 */
export async function notifyOrderPaidEmail(
  input: { toEmail: string; userId?: string | null; orderId: string; referenceCode?: string | null; courseId?: string | null },
  opts: { sender?: EmailSender } = {},
): Promise<EmailEventResult> {
  return requestEmailEvent(
    {
      template: TASK11_TEMPLATE_MAP.orderPaid,
      toEmail: input.toEmail,
      userId: input.userId ?? null,
      relatedType: 'order',
      relatedId: input.orderId,
      data: {
        ...(input.referenceCode ? { reference_code: input.referenceCode } : {}),
        ...(input.courseId ? { course_id: input.courseId } : {}),
      },
    },
    opts,
  );
}

/**
 * Khi enrollment duoc tao (admin tang khoa / sau thanh toan) -> E5 Cap quyen hoc.
 * DA NOI ca 2 duong: (1) Workers — notifyEnrollmentGranted() o buoc (11)
 * cua confirmPayment() (workers/api/src/payments.ts), goi rule san
 * runPaymentVerifiedAccess sau khi grantAccessForOrder tao enrollment;
 * (2) apps/web — grantEnrollment() (lms-admin.ts) goi wrapper nay khi
 * admin tang khoa (log-only sender mac dinh, khong gui that).
 */
export async function notifyEnrollmentGrantedEmail(
  input: { toEmail: string; userId?: string | null; courseId: string; enrollmentId?: string | null },
  opts: { sender?: EmailSender } = {},
): Promise<EmailEventResult> {
  return requestEmailEvent(
    {
      template: TASK11_TEMPLATE_MAP.enrollmentGranted,
      toEmail: input.toEmail,
      userId: input.userId ?? null,
      relatedType: 'enrollment',
      relatedId: input.enrollmentId ?? null,
      data: { course_id: input.courseId },
    },
    opts,
  );
}

/** E11 — chuc mung hoan thanh khoa (rule san phia Workers: runCourseCompleted). */
export async function notifyCourseCompletedEmail(
  input: { toEmail: string; userId?: string | null; courseId: string; enrollmentId?: string | null },
  opts: { sender?: EmailSender } = {},
): Promise<EmailEventResult> {
  return requestEmailEvent(
    {
      template: TASK11_TEMPLATE_MAP.courseCompleted,
      toEmail: input.toEmail,
      userId: input.userId ?? null,
      relatedType: 'enrollment',
      relatedId: input.enrollmentId ?? null,
      data: { course_id: input.courseId },
    },
    opts,
  );
}

/** E6 — mail cap chung chi, kem ma + link tra cuu cong khai. */
export async function notifyCertificateEmail(
  input: { toEmail: string; userId?: string | null; courseId: string; certificateId: string; certificateCode?: string | null },
  opts: { sender?: EmailSender } = {},
): Promise<EmailEventResult> {
  return requestEmailEvent(
    {
      template: TASK11_TEMPLATE_MAP.certificateIssued,
      toEmail: input.toEmail,
      userId: input.userId ?? null,
      relatedType: 'certificate',
      relatedId: input.certificateId,
      data: {
        course_id: input.courseId,
        ...(input.certificateCode ? { certificate_code: input.certificateCode } : {}),
      },
    },
    opts,
  );
}

// ---------------------------------------------------------------------------
// Ghi log y dinh vao email_logs (server) — khong gui mail that
// ---------------------------------------------------------------------------

export interface QueueEmailLogResult {
  logged: boolean;
  emailLogId?: string;
  error?: string;
}

/**
 * Ghi 1 dong email_logs status='queued' qua client server truyen vao.
 * KHONG BAO GIO throw. Luu y RLS: email_logs chi admin SELECT, ghi
 * qua Workers (service-role) — neu client truyen vao la JWT (ke ca
 * admin) thi insert bi chan 42501, ham tra logged:false (khong gia vo
 * thanh cong). Duong ghi that la Workers service-role (store.ts).
 * Khong ghi automation_events o day: bang do ghi 1 dong / 1 luot chay
 * rule (automation-rules.ts), khong phai 1 dong / 1 email.
 */
export async function queueEmailLog(
  client: SupabaseClient,
  input: EmailEventInput,
): Promise<QueueEmailLogResult> {
  const validationError = validateEmailEventInput(input);
  if (validationError) return { logged: false, error: validationError };
  try {
    const { data, error } = await client
      .from('email_logs')
      .insert({
        to_email: input.toEmail.trim(),
        template: input.template,
        status: 'queued',
        ...(input.userId ? { user_id: input.userId } : {}),
        ...(input.relatedType ? { related_type: input.relatedType } : {}),
        ...(input.relatedId ? { related_id: input.relatedId } : {}),
      })
      .select('id')
      .single();
    if (error || !data) {
      return { logged: false, error: error?.message ?? 'Không ghi được email_logs.' };
    }
    const row = data as unknown as { id?: unknown };
    return { logged: true, emailLogId: typeof row.id === 'string' ? row.id : undefined };
  } catch (err) {
    return { logged: false, error: err instanceof Error ? err.message : 'Không ghi được email_logs.' };
  }
}

/**
 * Kiem tra DINH DANG token huy dang ky: `<base64url>.<base64url>`
 * (HMAC-SHA256 ky bang UNSUBSCRIBE_SECRET — workers/api/src/email/
 * token.ts). Xac minh that token thuoc email nao chi lam o Workers
 * (verifyUnsubscribeToken); khong co secret de ky/xac minh o code nay.
 */
export function isUnsubscribeTokenFormat(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 2 && parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
}
