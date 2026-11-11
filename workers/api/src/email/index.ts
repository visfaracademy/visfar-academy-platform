// Module email (Resend) — chi dung o server (Cloudflare Workers).
export { renderTemplate, escapeHtml, formatVnd, formatDateVi, CONTACT_EMAIL } from './templates';
export { sendEmail, buildEmailLogRow, isDailyQuotaError, RESEND_API_URL } from './client';
export { TEMPLATE_IDS, TEMPLATE_META, APP_URL_PLACEHOLDER } from './types';
export { handleSubscribeNewsletter, processSubscribe } from './subscribe';
export { handleNewsletterUnsubscribe, processUnsubscribe } from './unsubscribe';
export { handleResendWebhook, processResendWebhook } from './webhook';
export { handleAdminEmailLogs } from './logs';
export type {
  TemplateId,
  TemplateCategory,
  TemplateMeta,
  TemplateData,
  RenderedEmail,
  EmailSenderConfig,
  SendEmailInput,
  SendEmailResult,
  SendEmailErrorCode,
  EmailLogRow,
} from './types';
