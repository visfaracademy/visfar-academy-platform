// Test helper huy dang ky — chay local voi fetch mock, khong can API that.
import { describe, expect, it, vi } from 'vitest';
import type { FetchImpl } from './api-client';
import { getUnsubscribeUrl, requestUnsubscribe } from './unsubscribe';

type MockFetch = (...args: Parameters<FetchImpl>) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getUnsubscribeUrl', () => {
  it('xay link GET dung API base + token', () => {
    expect(getUnsubscribeUrl('abc.def')).toBe(
      'https://api.visfaracademy.workers.dev/api/v1/newsletter/unsubscribe?token=abc.def',
    );
  });
});

describe('requestUnsubscribe', () => {
  it('token hop le + API ok:true: success', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true }, 200));
    const result = await requestUnsubscribe('tok.123', null, { fetchImpl });
    expect(result).toEqual({ status: 'success', already: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.visfaracademy.workers.dev/api/v1/newsletter/unsubscribe',
    );
  });

  it('da huy truoc do: success + already:true', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true, already: true }, 200));
    const result = await requestUnsubscribe('tok.123', null, { fetchImpl });
    expect(result).toEqual({ status: 'success', already: true });
  });

  it('token rong: khong goi API, loi invalid_token', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true }, 200));
    const result = await requestUnsubscribe('  ', null, { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_token', canRetry: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('token het han/sai (API 400 invalid_token): error, khong retry', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse(
        { ok: false, error: 'invalid_token', message: 'Liên kết hủy đăng ký không hợp lệ hoặc đã hết hạn.' },
        400,
      ),
    );
    const result = await requestUnsubscribe('tok.het-han', null, { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_token', canRetry: false });
  });

  it('API 500: error + canRetry', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: false, error: 'server_error', message: 'Loi.' }, 500),
    );
    const result = await requestUnsubscribe('tok.123', null, { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'server_error', canRetry: true });
  });
});
