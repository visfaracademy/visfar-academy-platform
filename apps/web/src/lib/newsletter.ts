// Newsletter footer — form + handler that (DECISIONS QĐ 6).
// POST /api/v1/newsletter, chi hien thanh cong khi API tra ok:true.
// Khong co endpoint cu de fallback (khac voi form tu van) nen loi nao
// cung tra error + nut "Thu lai", khong hien thanh cong gia.
import { ApiError, postJson, type FetchImpl } from './api-client';
import { validateEmail } from './validation';

export type NewsletterResult =
  | { status: 'success' }
  | { status: 'error'; code: string; message: string; isOffline: boolean; canRetry: boolean };

export async function submitNewsletter(
  email: string,
  opts: { fetchImpl?: FetchImpl; timeoutMs?: number } = {},
): Promise<NewsletterResult> {
  const value = (email ?? '').trim();
  if (!validateEmail(value)) {
    return {
      status: 'error',
      code: 'invalid_email',
      message: 'Email chưa đúng định dạng.',
      isOffline: false,
      canRetry: false,
    };
  }
  try {
    await postJson<{ ok: boolean }>('/newsletter', { email: value }, {
      timeoutMs: opts.timeoutMs ?? 30000,
      fetchImpl: opts.fetchImpl,
    });
    return { status: 'success' };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        status: 'error',
        code: err.code,
        message: err.message,
        isOffline: err.isOffline,
        canRetry: true,
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
