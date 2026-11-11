// Huy dang ky nhan tin — helper frontend cho trang xac nhan huy.
// POST /api/v1/newsletter/unsubscribe { token, reason } (token ky o
// server — xem workers/api/src/email/token.ts). Link trong email thi
// dung GET truc tiep toi Workers (getUnsubscribeUrl) — khong can qua
// trang trung gian. Chi hien thanh cong khi API tra ok:true.
import { ApiError, getApiBaseUrl, postJson, type FetchImpl } from './api-client';

export type UnsubscribeResult =
  | { status: 'success'; already: boolean }
  | { status: 'error'; code: string; message: string; isOffline: boolean; canRetry: boolean };

/** URL GET huy dang ky 1 cham (link trong email). */
export function getUnsubscribeUrl(token: string): string {
  return `${getApiBaseUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function requestUnsubscribe(
  token: string,
  reason: string | null = null,
  opts: { fetchImpl?: FetchImpl; timeoutMs?: number } = {},
): Promise<UnsubscribeResult> {
  if (!token.trim()) {
    return {
      status: 'error',
      code: 'invalid_token',
      message: 'Liên kết hủy đăng ký không hợp lệ hoặc đã hết hạn.',
      isOffline: false,
      canRetry: false,
    };
  }
  try {
    const data = await postJson<{ ok: boolean; already?: boolean }>(
      '/newsletter/unsubscribe',
      { token, reason },
      { timeoutMs: opts.timeoutMs ?? 30000, fetchImpl: opts.fetchImpl },
    );
    return { status: 'success', already: data.already === true };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        status: 'error',
        code: err.code,
        message: err.message,
        isOffline: err.isOffline,
        canRetry: err.code !== 'invalid_token',
      };
    }
    return {
      status: 'error',
      code: 'unknown',
      message: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      isOffline: false,
      canRetry: true,
    };
  }
}
