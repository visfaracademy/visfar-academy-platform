// Dich vu form tu van — API lam lop truoc, roi ghi Sheet (DECISIONS QĐ 5).
// Luong: client validate -> POST /api/v1/leads (kem Idempotency-Key,
// honeypot, Turnstile token khi co) -> API ghi DB (nguon su that), roi
// ghi Sheet (ban sao doi soat) -> tra ok:true + referenceCode.
// CHI hien cam on khi nhan ok:true (phe duyet Task 02 QĐ 2).
//
// Fallback — endpoint Apps Script CU giu nguyen lam du phong (khong xoa):
// chi chay khi API loi mang / 5xx / timeout (KHONG chay khi API tra 400 /
// 409 / 429 — do la tu choi dut khoat, fallback se lan tranh rate-limit
// va validation). Fallback chi duoc coi la THANH CONG khi doc duoc JSON
// { ok:true } tu Apps Script. Neu Apps Script khong doc duoc xac nhan
// (mang rot, redirect, JSON hong) thi KHONG hien cam on — tra loi +
// ghi log fallback de doi soat sau (xem recordFallbackAttempt). Day la
// diem khac co chu y voi trang HTML cu: trang cu (QĐ 3) giu nhanh
// fallback-iframe hien "thanh cong gia"; frontend moi tuan thu QĐ 2
// (API moi khong hien cam on khi chua nhan ok:true).
//
// Luong Apps Script cu (da kiem tra truoc khi chuyen doi — xem
// docs/frontend/TASK05_REPORT.md §1):
// - File: workspace/visfar-academy/Code-hop-nhat-2-trang.gs, doPost nhan
//   JSON hoac form-encoded, dinh tuyen theo source ('visfar-academy' ->
//   tab 'DATA VISFAR ACADEMY', 6 cot: thoi gian, ho ten, SĐT, email,
//   tinh/thanh, khoa quan tam). Validate: ten, SĐT ^0\d{9}$, email,
//   course bat buoc. LockService chong ghi trung. Khong co honeypot,
//   khong Turnstile, khong Idempotency-Key, khong ma tham chieu.
// - Form cu trong workspace/user/files/Visfar_Academy.html (KHONG sua
//   file goc): gui URLSearchParams toi WEB_APP_URL, timeout 30 giay;
//   JSON ok -> cam on; JSON error -> loi; con lai -> iframe fallback
//   hien "thanh cong gia". Email client cua form cu dung regex TLD >= 1
//   ky tu, lech voi server (TLD >= 2) — form moi dung chung
//   validation.ts (TLD >= 2) cho ca 2 ben.
import { PROVINCES } from '@visfar/shared';
import { ApiError, getApiBaseUrl, newIdempotencyKey, postJson, type FetchImpl } from './api-client';
import { validateEmail, validateFullName, validatePhone } from './validation';

/** URL Web App Apps Script cu — URL cong khai co san trong trang hien tai. */
export const LEGACY_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxMYvos2_UjIC9AQHnbA_I4F2gAIntnzmjkL6bWv4Doq26ltrfA6T0BpkONdesQk-fM/exec';

export function getLegacyAppsScriptUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_LEGACY_APPS_SCRIPT_URL ?? '').trim();
  return fromEnv || LEGACY_APPS_SCRIPT_URL;
}

export interface LeadInput {
  fullName: string;
  phone: string;
  email: string;
  province: string;
  /** UUID khoa o Supabase; null khi chon "Chua biet bat dau tu dau". */
  courseId: string | null;
  /** Ten khoa / lua chon hien tren form luc dang ky (de doi soat). */
  courseInterestText: string;
  source?: string;
  /** Honeypot — field an, phai rong. Bot dien vao -> spam. */
  honeypot?: string;
  /** Token Cloudflare Turnstile khi widget da cau hinh (chua co site key — xem bao cao). */
  turnstileToken?: string;
}

export interface LeadFieldError {
  field: 'fullName' | 'phone' | 'email' | 'province' | 'course' | 'honeypot';
  message: string;
}

/** Validation client — cung bo quy tac voi server (API_ARCHITECTURE §6). */
export function validateLeadInput(input: LeadInput): LeadFieldError[] {
  const errors: LeadFieldError[] = [];
  if (!validateFullName(input.fullName ?? '')) {
    errors.push({ field: 'fullName', message: 'Vui lòng nhập họ và tên (2–100 ký tự).' });
  }
  if (!validatePhone(input.phone ?? '')) {
    errors.push({ field: 'phone', message: 'Số điện thoại phải là 10 số, bắt đầu bằng 0.' });
  }
  if (!validateEmail(input.email ?? '')) {
    errors.push({ field: 'email', message: 'Email chưa đúng định dạng.' });
  }
  if (!(PROVINCES as readonly string[]).includes(input.province ?? '')) {
    errors.push({ field: 'province', message: 'Vui lòng chọn tỉnh / thành phố trong danh sách.' });
  }
  if (!input.courseInterestText?.trim()) {
    errors.push({ field: 'course', message: 'Vui lòng chọn trụ cột hoặc chương trình quan tâm.' });
  }
  return errors;
}

export type LeadSubmitResult =
  | {
      status: 'success';
      referenceCode: string;
      duplicate: boolean;
      via: 'api' | 'fallback-apps-script';
      fallbackLogged: boolean;
    }
  | {
      status: 'error';
      code: string;
      message: string;
      fieldErrors: LeadFieldError[];
      isOffline: boolean;
      /** Loi nay duoc phep bam "Thu lai" (cung Idempotency-Key). */
      canRetry: boolean;
      fallbackAttempted: boolean;
      fallbackLogged: boolean;
    };

export interface FallbackLogEntry {
  at: string;
  idempotencyKey: string;
  reason: string;
  confirmed: boolean;
}

const FALLBACK_LOG_KEY = 'visfar_fallback_log';

/** Ghi log moi lan chay fallback — de doi soat thu cong (tab DATA + DB). */
export function recordFallbackAttempt(entry: FallbackLogEntry): boolean {
  try {
    console.warn('[visfar] fallback Apps Script:', entry);
  } catch {
    // Bo qua loi log.
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(FALLBACK_LOG_KEY);
    const list: FallbackLogEntry[] = raw ? (JSON.parse(raw) as FallbackLogEntry[]) : [];
    list.push(entry);
    localStorage.setItem(FALLBACK_LOG_KEY, JSON.stringify(list.slice(-50)));
    return true;
  } catch {
    return false;
  }
}

export function getFallbackLog(): FallbackLogEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(FALLBACK_LOG_KEY);
    return raw ? (JSON.parse(raw) as FallbackLogEntry[]) : [];
  } catch {
    return [];
  }
}

export interface SubmitLeadOptions {
  /** Key cua lan gui nay. Khong truyen -> sinh moi. Retry PHAI truyen lai key cu. */
  idempotencyKey?: string;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
}

interface LeadApiResponse {
  ok: boolean;
  referenceCode?: string;
  reference_code?: string;
  duplicate?: boolean;
  message?: string;
}

function errorResult(
  code: string,
  message: string,
  fieldErrors: LeadFieldError[],
  opts: { isOffline: boolean; canRetry: boolean; fallbackAttempted: boolean; fallbackLogged: boolean },
): LeadSubmitResult {
  return {
    status: 'error',
    code,
    message,
    fieldErrors,
    isOffline: opts.isOffline,
    canRetry: opts.canRetry,
    fallbackAttempted: opts.fallbackAttempted,
    fallbackLogged: opts.fallbackLogged,
  };
}

/** Goi endpoint Apps Script cu, chi thanh cong khi doc duoc JSON { ok:true }. */
async function submitViaLegacyAppsScript(
  input: LeadInput,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const params = new URLSearchParams({
    source: input.source ?? 'visfar-academy',
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    province: input.province.trim(),
    course: input.courseInterestText.trim(),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(getLegacyAppsScriptUrl(), {
      method: 'POST',
      body: params,
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { ok?: boolean; error?: string };
      if (data && data.ok === true) return { ok: true };
      return { ok: false, reason: data?.error ? String(data.error) : 'Apps Script tra ve ok:false.' };
    } catch {
      return { ok: false, reason: 'Khong doc duoc xac nhan tu Apps Script (phan hoi khong phai JSON).' };
    }
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, reason: 'Het thoi gian cho Apps Script.' };
    return { ok: false, reason: err instanceof Error ? err.message : 'Khong ket noi duoc Apps Script.' };
  } finally {
    clearTimeout(timer);
  }
}

export async function submitLead(input: LeadInput, opts: SubmitLeadOptions = {}): Promise<LeadSubmitResult> {
  const fieldErrors = validateLeadInput(input);
  if (fieldErrors.length > 0) {
    return errorResult('invalid_input', 'Vui lòng kiểm tra lại thông tin đã nhập.', fieldErrors, {
      isOffline: false,
      canRetry: false,
      fallbackAttempted: false,
      fallbackLogged: false,
    });
  }
  // Honeypot co gia tri -> bot. Tra loi chung chung, khong goi API, khong ghi.
  if ((input.honeypot ?? '').trim() !== '') {
    return errorResult('spam_suspected', 'Không thể ghi nhận đăng ký lúc này.', [], {
      isOffline: false,
      canRetry: false,
      fallbackAttempted: false,
      fallbackLogged: false,
    });
  }

  const idempotencyKey = opts.idempotencyKey ?? newIdempotencyKey();
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30000;

  try {
    const data = await postJson<LeadApiResponse>(
      '/leads',
      {
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        province: input.province.trim(),
        courseId: input.courseId,
        courseInterestText: input.courseInterestText.trim(),
        source: input.source ?? 'visfar-academy',
        turnstileToken: input.turnstileToken ?? null,
        honeypot: '',
      },
      { idempotencyKey, timeoutMs, fetchImpl },
    );
    const referenceCode = data.referenceCode ?? data.reference_code ?? '';
    if (!referenceCode) {
      // API tra ok:true nhung khong co ma tham chieu — khong coi la thanh cong day du.
      return errorResult(
        'server_error',
        'Hệ thống chưa trả mã tham chiếu. Vui lòng thử lại hoặc liên hệ 034 7897 868.',
        [],
        { isOffline: false, canRetry: true, fallbackAttempted: false, fallbackLogged: false },
      );
    }
    return {
      status: 'success',
      referenceCode,
      duplicate: data.duplicate === true,
      via: 'api',
      fallbackLogged: false,
    };
  } catch (err) {
    if (!(err instanceof ApiError)) {
      return errorResult('unknown', 'Đã có lỗi xảy ra. Vui lòng thử lại.', [], {
        isOffline: false,
        canRetry: true,
        fallbackAttempted: false,
        fallbackLogged: false,
      });
    }
    // Tu choi dut khoat tu API (validation / trung khoa / rate-limit):
    // KHONG fallback — fallback se lan tranh quyet dinh cua API.
    const definitive = ['invalid_phone', 'invalid_email', 'invalid_province', 'invalid_course', 'invalid_input', 'spam_suspected', 'conflict', 'idempotency_conflict', 'rate_limited', 'unauthorized', 'forbidden'].includes(err.code);
    if (definitive) {
      const fieldErrorsFromCode: LeadFieldError[] =
        err.code === 'invalid_phone'
          ? [{ field: 'phone', message: err.message }]
          : err.code === 'invalid_email'
            ? [{ field: 'email', message: err.message }]
            : err.code === 'invalid_province'
              ? [{ field: 'province', message: err.message }]
              : err.code === 'invalid_course'
                ? [{ field: 'course', message: err.message }]
                : [];
      return errorResult(err.code, err.message, fieldErrorsFromCode, {
        isOffline: false,
        canRetry: err.code === 'rate_limited',
        fallbackAttempted: false,
        fallbackLogged: false,
      });
    }

    // Chi con loi mang / timeout / 5xx: chay fallback Apps Script cu (co ghi log).
    const reason = err.code === 'offline' ? 'API khong ket noi duoc (mat mang).' : `API loi (${err.code}).`;
    const fb = await submitViaLegacyAppsScript(input, fetchImpl, timeoutMs);
    const logged = recordFallbackAttempt({
      at: new Date().toISOString(),
      idempotencyKey,
      reason: `${reason} Fallback: ${fb.ok ? 'Apps Script xac nhan ok:true.' : fb.reason}`,
      confirmed: fb.ok,
    });
    if (fb.ok) {
      // Fallback xac nhan duoc bang JSON ok:true — nhung KHONG co ma tham
      // chieu tu API. Tra success voi ma tam ghi ro la fallback, de UI
      // hien dung ("da ghi qua kenh du phong, dang cho doi soat") chu
      // khong gia vo la ma tham chieu chinh thuc cua API.
      return {
        status: 'success',
        referenceCode: `FALLBACK-${idempotencyKey.slice(0, 8).toUpperCase()}`,
        duplicate: false,
        via: 'fallback-apps-script',
        fallbackLogged: logged,
      };
    }
    return errorResult(
      err.code,
      'Không nhận được xác nhận ghi nhận. Yêu cầu có thể chưa được gửi đi — vui lòng bấm “Thử lại” (hệ thống dùng lại đúng một lần gửi, không tạo trùng) hoặc liên hệ 034 7897 868.',
      [],
      {
        isOffline: err.isOffline,
        canRetry: true,
        fallbackAttempted: true,
        fallbackLogged: logged,
      },
    );
  }
}

/** De test / debug: API base URL hien tai (khong chua secret). */
export function getLeadApiBaseUrl(): string {
  return getApiBaseUrl();
}
