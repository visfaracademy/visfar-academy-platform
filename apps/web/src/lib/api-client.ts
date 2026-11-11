// Lop API client — moi POST tao du lieu cua frontend deu di qua day.
// Diem den: Workers API tai https://api.visfaracademy.workers.dev/api/v1
// (doi ten Worker tu visfar-academy-api sang api ngay 11/11/2026; URL cu
// https://visfar-academy-api.visfaracademy.workers.dev se bi xoa, khong
// con hoat dong). Alias da chot theo docs/DECISIONS.md (Task 02 QĐ 8):
// visfaracademy.netlify.app/api/v1 — van giu lam alias, can redirect
// Netlify ve Worker moi moi dung duoc; override bang env khi can.
//
// Quy tac cua lop nay:
// - Moi POST tao du lieu kem Idempotency-Key (UUID, client sinh, dung
//   lai nguyen key khi retry cung mot lan gui — theo API_ARCHITECTURE §4,
//   hieu luc 24 gio o server).
// - Timeout mac dinh 30 giay (AbortController), giong form cu.
// - Mat mang / fetch that bai -> ApiError isOffline = true, khong gia
//   lap du lieu, de UI hien nut "Thu lai".
// - Response co ok:false hoac thieu ok:true -> ApiError, khong coi la
//   thanh cong du HTTP 200.

export type ApiErrorCode =
  | 'invalid_phone'
  | 'invalid_email'
  | 'invalid_province'
  | 'invalid_course'
  | 'invalid_input'
  | 'spam_suspected'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'idempotency_conflict'
  | 'payment_mismatch'
  | 'invalid_token'
  | 'rate_limited'
  | 'server_error'
  | 'upstream_error'
  | 'timeout'
  | 'offline'
  | 'unknown';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly isOffline: boolean;
  readonly retryAfterSec: number | null;

  constructor(
    code: ApiErrorCode,
    message: string,
    opts: { status?: number | null; isOffline?: boolean; retryAfterSec?: number | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = opts.status ?? null;
    this.isOffline = opts.isOffline ?? false;
    this.retryAfterSec = opts.retryAfterSec ?? null;
  }
}

/** URL Worker moi (doi ten 11/11/2026). Alias netlify.app/api/v1 van giu
 *  theo DECISIONS Task 02 QĐ 8 nhung chi dung duoc sau khi co redirect
 *  Netlify; override bang env khi can. */
export function getApiBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  return 'https://api.visfaracademy.workers.dev/api/v1';
}

export function newIdempotencyKey(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // Roi xuong fallback ben duoi.
  }
  return `visfar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof ApiError) return err.isOffline;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|fetch|Failed to fetch|Load failed|NetworkError/i.test(err.message)) {
    return true;
  }
  return false;
}

export type FetchImpl = typeof fetch;

export interface PostJsonOptions {
  idempotencyKey?: string;
  /** Timeout ms. Mac dinh 30000 — giong form cu. */
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
  /** Them header Authorization khi endpoint can JWT (se dung o Module 2+). */
  accessToken?: string;
}

const ERROR_CODES = new Set<string>([
  'invalid_phone',
  'invalid_email',
  'invalid_province',
  'invalid_course',
  'invalid_token',
  'invalid_input',
  'spam_suspected',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'idempotency_conflict',
  'payment_mismatch',
  'rate_limited',
  'server_error',
  'upstream_error',
]);

function toErrorCode(raw: unknown, status: number): ApiErrorCode {
  if (typeof raw === 'string' && ERROR_CODES.has(raw)) return raw as ApiErrorCode;
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export interface GetJsonOptions {
  /** Timeout ms. Mac dinh 30000. */
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
  /** Them header Authorization khi endpoint can JWT. */
  accessToken?: string;
}

/**
 * GET JSON tu Workers API. Chi resolve khi body tra ve co ok:true.
 * Loi (HTTP loi, ok:false, mat mang, timeout) deu throw ApiError —
 * giong postJson, de UI hien loi ro thay vi gia lap du lieu.
 */
export async function getJson<T>(path: string, opts: GetJsonOptions = {}): Promise<T> {
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30000;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (opts.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;
    let res: Response;
    try {
      res = await fetchImpl(url, { method: 'GET', headers, signal: controller.signal });
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError('timeout', 'Hết thời gian chờ phản hồi. Vui lòng thử lại.', {
          status: null,
        });
      }
      throw new ApiError(
        'offline',
        'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.',
        { status: null, isOffline: true },
      );
    }
    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
    if (!res.ok || !data || data.ok !== true) {
      const code = toErrorCode(data?.error, res.status);
      const message =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message
          : 'Không tải được dữ liệu. Vui lòng thử lại.';
      throw new ApiError(code, message, { status: res.status, isOffline: false });
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST JSON toi Workers API. Chi resolve khi body tra ve co ok:true.
 * Moi loi (HTTP loi, ok:false, mat mang, timeout) deu throw ApiError.
 */
/** PATCH JSON — giong postJson nhung dung PATCH (VD phan hoi AI Mentor).
 *  Khong kem Idempotency-Key: PATCH o day la cap nhat 1 lan, khong tao moi. */
export async function patchJson<T>(path: string, body: unknown, opts: PostJsonOptions = {}): Promise<T> {
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30000;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError('timeout', 'Hết thời gian chờ phản hồi. Vui lòng thử lại.', {
          status: null,
        });
      }
      throw new ApiError(
        'offline',
        'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.',
        { status: null, isOffline: true },
      );
    }
    const retryAfter = res.headers?.get?.('Retry-After');
    const retryAfterSec = retryAfter ? Number.parseInt(retryAfter, 10) || null : null;
    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
    if (!res.ok || !data || data.ok !== true) {
      const code = toErrorCode(data?.error, res.status);
      const message =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message
          : res.status === 429
            ? 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.'
            : 'Hệ thống chưa ghi nhận được. Vui lòng thử lại.';
      throw new ApiError(code, message, {
        status: res.status,
        retryAfterSec,
        isOffline: false,
      });
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function postJson<T>(path: string, body: unknown, opts: PostJsonOptions = {}): Promise<T> {
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30000;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    if (opts.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError('timeout', 'Hết thời gian chờ phản hồi. Vui lòng thử lại.', {
          status: null,
        });
      }
      throw new ApiError(
        'offline',
        'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.',
        { status: null, isOffline: true },
      );
    }
    const retryAfter = res.headers?.get?.('Retry-After');
    const retryAfterSec = retryAfter ? Number.parseInt(retryAfter, 10) || null : null;
    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
    if (!res.ok || !data || data.ok !== true) {
      const code = toErrorCode(data?.error, res.status);
      const message =
        typeof data?.message === 'string' && data.message.trim()
          ? data.message
          : res.status === 429
            ? 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.'
            : 'Hệ thống chưa ghi nhận được. Vui lòng thử lại.';
      throw new ApiError(code, message, {
        status: res.status,
        retryAfterSec,
        isOffline: false,
      });
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}
