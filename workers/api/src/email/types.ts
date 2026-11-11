// Kieu du lieu cho module email (Resend) — workers/api/src/email/
// Chi chay o server (Cloudflare Workers). KHONG import tu frontend.
// Domain gui CHUA duoc xac minh DNS (SPF/DKIM/DMARC) — xem README.md.

/** 13 mau email E1–E13 theo danh sach Task 11 (xem README.md §1). */
export type TemplateId =
  | 'E1'
  | 'E2'
  | 'E3'
  | 'E4'
  | 'E5'
  | 'E6'
  | 'E7'
  | 'E8'
  | 'E9'
  | 'E10'
  | 'E11'
  | 'E12'
  | 'E13';

export const TEMPLATE_IDS: readonly TemplateId[] = [
  'E1',
  'E2',
  'E3',
  'E4',
  'E5',
  'E6',
  'E7',
  'E8',
  'E9',
  'E10',
  'E11',
  'E12',
  'E13',
];

/**
 * Goc URL mac dinh cho link trong email.
 * LUU Y: day la domain API da chot (DECISIONS.md, Task 02 QĐ 8:
 * visfaracademy.netlify.app), dung TAM THOI lam goc link cho toi khi
 * domain cong khai cua website duoc chot. Khong phai domain gui email
 * (domain gui do RESEND_FROM_EMAIL quyet dinh, can xac minh DNS).
 */
export const APP_URL_PLACEHOLDER = 'https://visfaracademy.netlify.app';

/** Giao dich = bat buoc phai gui (uu tien khi cham gioi han Resend).
 *  Cham soc = co the xep hang sang hom sau (E7–E13 co nut huy nhan tin). */
export type TemplateCategory = 'transactional' | 'care';

export interface TemplateMeta {
  id: TemplateId;
  /** Ten tieng Viet cua mau (dung cho log / bao cao R8). */
  name: string;
  category: TemplateCategory;
  /** Co nut huy nhan tin o footer khong (chi E7–E13). */
  hasUnsubscribe: boolean;
}

export const TEMPLATE_META: Record<TemplateId, TemplateMeta> = {
  E1: { id: 'E1', name: 'Xac nhan dang ky', category: 'transactional', hasUnsubscribe: false },
  E2: { id: 'E2', name: 'Xac minh email', category: 'transactional', hasUnsubscribe: false },
  E3: { id: 'E3', name: 'Dat lai mat khau', category: 'transactional', hasUnsubscribe: false },
  E4: { id: 'E4', name: 'Xac nhan thanh toan', category: 'transactional', hasUnsubscribe: false },
  E5: { id: 'E5', name: 'Cap quyen hoc', category: 'transactional', hasUnsubscribe: false },
  E6: { id: 'E6', name: 'Cap chung chi', category: 'transactional', hasUnsubscribe: false },
  E7: { id: 'E7', name: 'Chao mung', category: 'care', hasUnsubscribe: true },
  E8: { id: 'E8', name: 'Huong dan bat dau hoc', category: 'care', hasUnsubscribe: true },
  E9: { id: 'E9', name: 'Nhac hoc', category: 'care', hasUnsubscribe: true },
  E10: { id: 'E10', name: 'Nhac bai chua hoan thanh', category: 'care', hasUnsubscribe: true },
  E11: { id: 'E11', name: 'Chuc mung hoan thanh khoa hoc', category: 'care', hasUnsubscribe: true },
  E12: { id: 'E12', name: 'Khoa hoc moi', category: 'care', hasUnsubscribe: true },
  E13: { id: 'E13', name: 'Gia han membership', category: 'care', hasUnsubscribe: true },
};

/** Du lieu chung cho moi mau. `appUrl` la goc link trong email. */
export interface CommonData {
  /** Ho ten hoc vien (bat buoc — hien trong loi chao moi mau). */
  studentName: string;
  /** Goc URL dung cho link (dashboard / khoa hoc / huy nhan tin).
   *  Neu khong truyen, dung APP_URL_PLACEHOLDER (xem templates.ts). */
  appUrl?: string;
  /** Link huy nhan tin co chu ky (khi co). Neu khong truyen, client tu
   *  dung `${appUrl}/api/v1/newsletter/unsubscribe?email=...` — chi la
   *  tam thoi, xem README.md §5 truoc khi gui that cho nguoi dung. */
  unsubscribeUrl?: string;
}

export interface E1Data extends CommonData {
  dashboardUrl?: string;
}
export interface E2Data extends CommonData {
  verificationUrl: string;
  /** So gio link con hieu luc. Mac dinh 24. */
  expiresHours?: number;
}
export interface E3Data extends CommonData {
  resetUrl: string;
  /** So phut link con hieu luc. Mac dinh 60. */
  expiresMinutes?: number;
}
export interface E4Data extends CommonData {
  courseTitle: string;
  /** Ma don, VD DH-2026-000123 — cung la noi dung chuyen khoan. */
  orderReference: string;
  amountVnd: number;
  /** Ngay gio nhan thanh toan (hien thi theo gio Viet Nam). */
  paidAt?: string;
}
export interface E5Data extends CommonData {
  courseTitle: string;
  courseUrl: string;
}
export interface E6Data extends CommonData {
  courseTitle: string;
  certificateCode: string;
  certificateUrl: string;
}
export interface E7Data extends CommonData {
  dashboardUrl?: string;
}
export interface E8Data extends CommonData {
  courseTitle: string;
  firstLessonTitle: string;
  firstLessonUrl: string;
}
export interface E9Data extends CommonData {
  courseTitle: string;
  resumeUrl: string;
  /** So ngay hoc vien chua hoc. */
  daysInactive: number;
  lastLessonTitle?: string;
}
export interface E10Data extends CommonData {
  courseTitle: string;
  lessonTitle: string;
  resumeUrl: string;
  /** % hoan thanh cua bai (0–100). */
  progressPercent: number;
}
export interface E11Data extends CommonData {
  courseTitle: string;
  certificateUrl?: string;
  nextCourseTitle?: string;
  nextCourseUrl?: string;
}
export interface E12Data extends CommonData {
  courseTitle: string;
  courseSummary?: string;
  courseUrl: string;
  /** Gia VND; 0 = mien phi / Tuy tam. Khong truyen = khong hien gia. */
  priceVnd?: number;
}
export interface E13Data extends CommonData {
  planName: string;
  /** Ngay het han goi (hien thi theo gio Viet Nam). */
  renewByDate: string;
  renewUrl: string;
  /** So tien gia han VND. Khong truyen = khong hien so tien. */
  amountVnd?: number;
}

export type TemplateData =
  | E1Data
  | E2Data
  | E3Data
  | E4Data
  | E5Data
  | E6Data
  | E7Data
  | E8Data
  | E9Data
  | E10Data
  | E11Data
  | E12Data
  | E13Data;

/** Ket qua render 1 mau: subject + HTML + text thuan. */
export interface RenderedEmail {
  template: TemplateId;
  subject: string;
  html: string;
  text: string;
}

/** Cau hinh gui email (lay tu Env cua Workers — secret, khong commit). */
export interface EmailSenderConfig {
  /** RESEND_API_KEY. Bat buoc — thieu thi sendEmail tra loi, khong gui. */
  apiKey: string;
  /** RESEND_FROM_EMAIL, VD "Visfar Academy <hello@visfaracademy.vn>".
   *  Bat buoc — KHONG mac dinh ve onboarding@resend.dev (chi gui duoc
   *  toi email cua tai khoan Resend). Domain phai xac minh DNS truoc
   *  khi gui cho nguoi dung that (xem README.md). */
  from: string;
  /** Goc URL dung cho link khi data khong truyen appUrl. */
  appUrl?: string;
  /** Cho phep truyen fetch mock trong test. Mac dinh: fetch toan cuc. */
  fetchImpl?: typeof fetch;
}

export interface SendEmailInput {
  /** Email nguoi nhan (validate TLD >= 2 ky tu, nhu validation.ts). */
  to: string;
  template: TemplateId;
  data: TemplateData;
  /** Idempotency-Key: Resend tra lai ket qua cu neu gui trung key.
   *  Caller nen sinh UUID 1 lan / 1 lan gui (dung lai khi retry). */
  idempotencyKey?: string;
  /** Lien ket mem toi doi tuong nghiep vu — giong cot related_* cua
   *  bang email_logs (khong FK cung). */
  relatedType?: string;
  relatedId?: string;
}

export type SendEmailErrorCode =
  | 'email_not_configured'
  | 'invalid_recipient'
  | 'invalid_template_data'
  | 'daily_quota_exceeded'
  | 'resend_error'
  | 'email_upstream_error';

export interface SendEmailResult {
  ok: boolean;
  /** ID Resend tra ve khi gui thanh cong (ghi vao email_logs.resend_id). */
  resendId?: string;
  errorCode?: SendEmailErrorCode;
  /** Thong bao loi tieng Viet, an toan de ghi log (khong chua PII/key). */
  message: string;
  /** Dong san sang insert vao bang email_logs (caller tu insert qua
   *  Supabase service-role; module nay khong tu ghi DB). */
  logRow: EmailLogRow;
}

/** Dong insert vao bang email_logs — khop DATABASE_SCHEMA.md §3.27.
 *  Cot: to_email, template, resend_id, status, related_type,
 *  related_id, error_message. */
export interface EmailLogRow {
  to_email: string;
  template: TemplateId;
  resend_id: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  related_type: string | null;
  related_id: string | null;
  error_message: string | null;
}
