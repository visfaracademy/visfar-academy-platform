// Env cua Workers API — secret CHI o Workers Secrets / .dev.vars,
// KHONG bao gio commit gia tri that (xem README.md).
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** URL Web App Apps Script ghi Sheet (ban sao doi soat). */
  APPS_SCRIPT_URL?: string;
  /** Secret verify Cloudflare Turnstile. Khong co = bo qua CAPTCHA (ghi log). */
  TURNSTILE_SECRET?: string;
  /** Resend API key — Workers Secrets (email/README.md §3). Bi mat khoi
      Env o ban viet lai 16:55 10/11/2026 trong khi nhieu file van doc
      bien nay (email/sender, payments, handlers/course-completion,
      automation-rules) — khoi phuc lai. */
  RESEND_API_KEY?: string;
  /** Ten cu cua RESEND_FROM_EMAIL (payments.ts dung lam fallback). */
  RESEND_FROM?: string;
  /** Secret verify webhook Resend/Svix — dang "whsec_..." (Workers Secrets). */
  RESEND_WEBHOOK_SECRET?: string;
  /** Secret ky token huy dang ky email (Workers Secrets). */
  UNSUBSCRIBE_SECRET?: string;
  /** Email gui di mac dinh — ten chuan RESEND_FROM_EMAIL (theo email/README.md §3). VD "Visfar Academy <hello@visfaracademy.vn>". */
  RESEND_FROM_EMAIL?: string;
  /** Email nhan canh bao he thong — ten chuan ADMIN_NOTIFY_EMAIL (theo email/README.md §3). Mac dinh visfaracademy@gmail.com (DECISIONS QĐ 14). ALERT_EMAIL la alias cu, van duoc chap nhan. */
  ADMIN_NOTIFY_EMAIL?: string;
  /** Alias cu cua ADMIN_NOTIFY_EMAIL. */
  ALERT_EMAIL?: string;
  /** Origin duoc phep CORS, phay phan tach. */
  ALLOWED_ORIGINS?: string;
  /** KV rate-limit (tuy chon). Khong co = bo nho trong-process. */
  RATE_LIMIT_KV?: KVNamespace;
  /**
   * Secret xac minh chu ky webhook SePay (Workers Secrets).
   * CHUA co = moi webhook SePay deu bi tu choi 401 (fail-closed).
   * Ten bien theo docs/supabase/ENVIRONMENT_CONFIG.md; gia tri that
   * KHONG bao gio commit. Xem workers/api/src/sepay.ts.
   */
  SEPAY_WEBHOOK_SECRET?: string;
  /**
   * Bearer Token SePay API v2 — doi soat bu qua GET /v2/transactions
   * (SEPAY_INTEGRATION.md §1.2/§8). Ten bien chinh xac theo tai lieu
   * SePay; ten bien truoc day (API key) da doi ten ngay 10/11/2026.
   * Chi trong Workers Secrets, khong commit.
   */
  SEPAY_API_TOKEN?: string;
  /** UUID tai khoan MB Bank tren SePay — loc giao dich khi doi soat bu (khong phai so tai khoan). */
  SEPAY_BANK_ACCOUNT_ID?: string;
  /** ID merchant SePay (neu SePay yeu cau khi cau hinh). */
  SEPAY_MERCHANT_ID?: string;
  /**
   * OpenAI API key — CHI set khi user cap key AI (Workers Secrets).
   * Khong co = AI Mentor chay che do tim kiem thong minh (khong goi
   * LLM). Co key thi route /api/v1/ai-mentor/ask goi OpenAI Chat
   * Completions voi system prompt "chi tra loi dua tren doan tri
   * thuc duoc cung cap" (xem handlers/ai-mentor.ts); LLM loi thi
   * tu roi ve che do tim kiem thong minh.
   */
  OPENAI_API_KEY?: string;
  /**
   * Gemini API key — hien CHUA co adapter. Co key nay nhung khong co
   * OPENAI_API_KEY thi AI Mentor van chay che do tim kiem thong minh.
   */
  GEMINI_API_KEY?: string;
}

export function isSupabaseConfigured(env: Env): boolean {
  return Boolean(env.SUPABASE_URL?.trim()) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Log an toan: chi ghi ma tham chieu / user id / ma loi — KHONG ghi PII. */
export function safeLog(message: string, meta?: Record<string, string>): void {
  try {
    console.log(`[visfar-api] ${message}`, meta ?? '');
  } catch {
    // Bo qua loi log.
  }
}
