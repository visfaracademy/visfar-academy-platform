// Client gui email qua Resend REST API (fetch truc tiep, khong them
// dependency moi — Workers tuong thich, de mock trong test).
// CHI chay o server (Cloudflare Workers). RESEND_API_KEY chi o Workers
// Secrets / .dev.vars — KHONG BAO GIO o frontend, khong commit.
// KHONG gui email that trong test: test mock fetch (xem client.test.ts).
import { EMAIL_RE } from '../validation';
import { renderTemplate } from './templates';
import type {
  EmailLogRow,
  EmailSenderConfig,
  SendEmailErrorCode,
  SendEmailInput,
  SendEmailResult,
  TemplateId,
} from './types';
import { TEMPLATE_META } from './types';

export const RESEND_API_URL = 'https://api.resend.com/emails';

/** Loi Resend tra ve khi vuot 100 email/ngay (gioi han goi Free). */
export function isDailyQuotaError(status: number, bodyText: string): boolean {
  return status === 429 || /daily_quota_exceeded/i.test(bodyText);
}

/** Xay dong insert vao bang email_logs — khop DATABASE_SCHEMA.md §3.27. */
export function buildEmailLogRow(input: {
  to: string;
  template: TemplateId;
  resendId: string | null;
  status: EmailLogRow['status'];
  relatedType?: string;
  relatedId?: string;
  errorMessage?: string | null;
}): EmailLogRow {
  return {
    to_email: input.to,
    template: input.template,
    resend_id: input.resendId,
    status: input.status,
    related_type: input.relatedType ?? null,
    related_id: input.relatedId ?? null,
    error_message: input.errorMessage ?? null,
  };
}

function failResult(
  input: SendEmailInput,
  errorCode: SendEmailErrorCode,
  message: string,
): SendEmailResult {
  return {
    ok: false,
    errorCode,
    message,
    logRow: buildEmailLogRow({
      to: input.to,
      template: input.template,
      resendId: null,
      status: 'failed',
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      errorMessage: `${errorCode}: ${message}`,
    }),
  };
}

/**
 * Gui 1 email qua Resend.
 * Thu tu: validate nguoi nhan -> validate + render mau -> kiem tra cau
 * hinh (key/from) -> goi Resend. Bat ky buoc nao loi thi KHONG gui,
 * tra ve logRow status 'failed' de caller ghi vao email_logs.
 * Idempotency-Key (neu co) duoc gui len Resend: gui trung key se tra
 * lai ket qua cu thay vi gui email moi.
 */
export async function sendEmail(
  config: EmailSenderConfig,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const to = typeof input.to === 'string' ? input.to.trim() : '';
  if (!EMAIL_RE.test(to)) {
    return failResult(input, 'invalid_recipient', 'Email nguoi nhan khong hop le.');
  }
  if (!TEMPLATE_META[input.template]) {
    return failResult(input, 'invalid_template_data', 'Mau email khong ton tai.');
  }

  let rendered;
  try {
    rendered = renderTemplate(input.template, input.data, to);
  } catch (err) {
    return failResult(
      input,
      'invalid_template_data',
      err instanceof Error ? err.message : 'Du lieu mau email khong hop le.',
    );
  }

  const apiKey = config.apiKey?.trim() ?? '';
  const from = config.from?.trim() ?? '';
  if (!apiKey || !from) {
    return failResult(
      input,
      'email_not_configured',
      'Email chua duoc cau hinh (thieu RESEND_API_KEY hoac RESEND_FROM_EMAIL).',
    );
  }
  // Bao ve: khong bao gio gui tu onboarding@resend.dev cho nguoi dung
  // that — dia chi do chi gui duoc toi email cua tai khoan Resend.
  if (/onboarding@resend\.dev/i.test(from)) {
    return failResult(
      input,
      'email_not_configured',
      'RESEND_FROM_EMAIL dang la onboarding@resend.dev — can domain rieng da xac minh DNS truoc khi gui.',
    );
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
  } catch {
    return failResult(input, 'email_upstream_error', 'Khong ket noi duoc toi Resend.');
  }

  const bodyText = await res.text().catch(() => '');
  let parsed: { id?: unknown; message?: unknown; name?: unknown } = {};
  try {
    parsed = bodyText ? (JSON.parse(bodyText) as typeof parsed) : {};
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    const detail =
      typeof parsed.message === 'string' && parsed.message ? parsed.message : `Resend HTTP ${res.status}`;
    if (isDailyQuotaError(res.status, bodyText)) {
      // Gioi han Free: 100 email/ngay (reset 00:00 UTC). Email giao dich
      // duoc uu tien gui lai sau 00:00 UTC; email nhac xep hang sang
      // hom sau (xem README.md §4).
      return failResult(
        input,
        'daily_quota_exceeded',
        'Da vuot gioi han 100 email/ngay cua Resend — email se duoc xep hang gui lai sau 00:00 UTC.',
      );
    }
    return failResult(input, 'resend_error', `Resend tu choi: ${detail}`);
  }

  const resendId = typeof parsed.id === 'string' ? parsed.id : null;
  return {
    ok: true,
    resendId: resendId ?? undefined,
    message: 'Da gui email.',
    logRow: buildEmailLogRow({
      to,
      template: input.template,
      resendId,
      status: 'sent',
      relatedType: input.relatedType,
      relatedId: input.relatedId,
    }),
  };
}
