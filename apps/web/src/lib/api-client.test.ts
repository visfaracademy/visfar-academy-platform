// Test lop API client — chay local, khong can staging (mock fetch).
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  ApiError,
  getApiBaseUrl,
  isOfflineError,
  newIdempotencyKey,
  postJson,
  type FetchImpl,
} from './api-client';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Lay ApiError tu mot promise bi reject — dung cho moi test loi. */
async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw new Error(`expected ApiError, got ${String(e)}`);
  }
  throw new Error('expected rejection, got success');
}

type MockFetch = (...args: Parameters<FetchImpl>) => Promise<Response>;

describe('getApiBaseUrl — domain + tien to da chot (DECISIONS Task 02 QĐ 8)', () => {
  const prev = process.env.NEXT_PUBLIC_API_BASE_URL;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = prev;
  });
  it('mac dinh: visfaracademy.netlify.app + /api/v1', () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getApiBaseUrl()).toBe('https://api.visfaracademy.workers.dev/api/v1');
  });
  it('env override duoc ton trong', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test/api/v1/';
    expect(getApiBaseUrl()).toBe('https://api.example.test/api/v1');
  });
});

describe('newIdempotencyKey', () => {
  it('dang UUID, khong trung nhau', () => {
    const keys = new Set(Array.from({ length: 100 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(100);
    for (const k of keys) {
      expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });
});

describe('postJson', () => {
  it('thanh cong: chi resolve khi ok:true + tra dung body', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: true, referenceCode: 'VISFAR-2026-000123' }, 201),
    );
    const data = await postJson<{ referenceCode: string }>('/leads', { a: 1 }, { fetchImpl, idempotencyKey: 'k-1' });
    expect(data.referenceCode).toBe('VISFAR-2026-000123');
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k-1');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.visfaracademy.workers.dev/api/v1/leads');
  });

  it('HTTP 200 nhung ok:false -> ApiError, KHONG coi la thanh cong', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: false, error: 'server_error', message: 'Loi.' }, 200),
    );
    const err = await captureApiError(postJson('/leads', {}, { fetchImpl }));
    expect(err.code).toBe('server_error');
  });

  it('400 invalid_phone -> ApiError dung ma + message tieng Viet', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: false, error: 'invalid_phone', message: 'Số điện thoại chưa đúng định dạng.' }, 400),
    );
    const err = await captureApiError(postJson('/leads', {}, { fetchImpl }));
    expect(err.code).toBe('invalid_phone');
    expect(err.status).toBe(400);
    expect(err.message).toContain('Số điện thoại');
  });

  it('429 -> ApiError rate_limited + Retry-After', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: false, error: 'rate_limited', message: 'Qua nhieu lan.' }, 429, { 'Retry-After': '120' }),
    );
    const err = await captureApiError(postJson('/leads', {}, { fetchImpl }));
    expect(err.code).toBe('rate_limited');
    expect(err.retryAfterSec).toBe(120);
  });

  it('mat mang (TypeError Failed to fetch) -> ApiError offline, isOffline=true', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await captureApiError(postJson('/leads', {}, { fetchImpl }));
    expect(err.code).toBe('offline');
    expect(err.isOffline).toBe(true);
    expect(isOfflineError(err)).toBe(true);
  });

  it('timeout: fetch khong bao gio xong -> ApiError timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: Parameters<FetchImpl>[0], init?: Parameters<FetchImpl>[1]) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const err = await captureApiError(postJson('/leads', {}, { fetchImpl, timeoutMs: 10 }));
    expect(err.code).toBe('timeout');
  });

  it('response khong phai JSON + 500 -> server_error', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      new Response('<html>loi</html>', { status: 500 }),
    );
    const err = await captureApiError(postJson('/leads', {}, { fetchImpl }));
    expect(err.code).toBe('server_error');
    expect(err.status).toBe(500);
  });
});

describe('isOfflineError', () => {
  it('TypeError -> offline', () => expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true));
  it('loi thuong -> khong offline', () => expect(isOfflineError(new Error('boom'))).toBe(false));
});
