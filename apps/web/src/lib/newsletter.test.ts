// Test newsletter — chay local voi fetch mock, khong can staging/API that.
import { describe, expect, it, vi } from 'vitest';
import type { FetchImpl } from './api-client';
import { submitNewsletter } from './newsletter';

type MockFetch = (...args: Parameters<FetchImpl>) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('submitNewsletter', () => {
  it('email hop le + API ok:true: success', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true }, 201));
    const result = await submitNewsletter('a@example.com', { fetchImpl });
    expect(result).toEqual({ status: 'success' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.visfaracademy.workers.dev/api/v1/newsletter');
  });

  it('email sai: khong goi API', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true }, 201));
    const result = await submitNewsletter('khong-phai-email', { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_email', canRetry: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('API 500: error + canRetry, KHONG co fallback (khong co endpoint cu)', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: false, error: 'server_error', message: 'Loi.' }, 500),
    );
    const result = await submitNewsletter('a@example.com', { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'server_error', canRetry: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('mat mang: error offline + canRetry', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await submitNewsletter('a@example.com', { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'offline', isOffline: true, canRetry: true });
  });
});
