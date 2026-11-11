// Dinh dang loi thong nhat — API_ARCHITECTURE.md §7.2:
//   { ok:false, error:"ma_loi", message:"Tieng Viet, de hieu" }
// message luon tieng Viet, khong lo chi tiet ky thuat hay secret.
export type ErrorCode =
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
  | 'upstream_error';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly retryAfterSec: number | null;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    opts: { retryAfterSec?: number | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = opts.retryAfterSec ?? null;
  }
}

export function jsonError(err: ApiError, extraHeaders?: HeadersInit): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (err.retryAfterSec !== null) headers['Retry-After'] = String(err.retryAfterSec);
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((v, k) => {
      headers[k] = v;
    });
  }
  return new Response(
    JSON.stringify({ ok: false, error: err.code, message: err.message }),
    { status: err.status, headers },
  );
}

export function jsonOk(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((v, k) => {
      headers[k] = v;
    });
  }
  return new Response(JSON.stringify({ ok: true, ...body }), { status, headers });
}

/** Loi server chung — khong lo chi tiet ky thuat ra client. */
export function serverError(detail: string): ApiError {
  try {
    console.error('[visfar-api] server_error:', detail.slice(0, 500));
  } catch {
    // Bo qua.
  }
  return new ApiError(500, 'server_error', 'Hệ thống đang bận. Vui lòng thử lại sau.');
}

export function upstreamError(service: string, detail: string): ApiError {
  try {
    console.error(`[visfar-api] upstream_error (${service}):`, detail.slice(0, 500));
  } catch {
    // Bo qua.
  }
  return new ApiError(502, 'upstream_error', 'Dịch vụ liên kết đang bận. Vui lòng thử lại sau.');
}
