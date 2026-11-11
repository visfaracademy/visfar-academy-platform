// Test store Supabase — fetch mock (khong goi Supabase that).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import {
  countEmailsSentToday,
  findEmailLogs,
  getSubscriberByEmail,
  startOfTodayVnIso,
  updateEmailLogByResendId,
} from './store';

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
} as unknown as Env;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startOfTodayVnIso', () => {
  it('10:00 gio VN 10/11/2026 -> 2026-11-09T17:00:00Z', () => {
    expect(startOfTodayVnIso(Date.parse('2026-11-10T10:00:00+07:00'))).toBe(
      '2026-11-09T17:00:00.000Z',
    );
  });

  it('00:30 gio VN -> moc 17:00 UTC hom truoc', () => {
    expect(startOfTodayVnIso(Date.parse('2026-11-10T00:30:00+07:00'))).toBe(
      '2026-11-09T17:00:00.000Z',
    );
  });
});

describe('getSubscriberByEmail', () => {
  it('goi dung URL + tra dong tim duoc (email lowercase)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse([{ email: 'a@example.com', status: 'subscribed' }]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const row = await getSubscriberByEmail(env, '  A@Example.com ');
    expect(row?.email).toBe('a@example.com');
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/rest/v1/newsletter_subscribers?');
    expect(url).toContain('email=eq.a%40example.com');
  });

  it('khong co dong: null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([])));
    expect(await getSubscriberByEmail(env, 'la@example.com')).toBeNull();
  });
});

describe('findEmailLogs', () => {
  it('loc theo to_email + template + status, phan trang, hasMore khi du limit+1', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ id: `log-${i}`, to_email: 'a@example.com' }));
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(rows));
    vi.stubGlobal('fetch', fetchMock);
    const result = await findEmailLogs(env, {
      toEmail: 'a@example.com',
      template: 'E9',
      status: 'sent',
      page: 2,
      limit: 20,
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('to_email=eq.a%40example.com');
    expect(url).toContain('template=eq.E9');
    expect(url).toContain('status=eq.sent');
    expect(url).toContain('limit=21');
    expect(url).toContain('offset=20');
    expect(url).toContain('order=created_at.desc');
    expect(result.logs).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.page).toBe(2);
  });

  it('it hon limit: hasMore=false; page/limit kep ve gioi han', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ id: 'log-1' }])));
    const result = await findEmailLogs(env, { page: 0, limit: 500 });
    expect(result.hasMore).toBe(false);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });
});

describe('updateEmailLogByResendId', () => {
  it('tim thay dong: PATCH + tra true', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit): Promise<Response> => jsonResponse(null, 200),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'log-1' }]));
    vi.stubGlobal('fetch', fetchMock);
    const ok = await updateEmailLogByResendId(env, 're_1', { status: 'delivered' });
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const patchUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(patchUrl).toContain('/rest/v1/email_logs?id=eq.log-1');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
  });

  it('khong tim thay dong: false, khong PATCH', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await updateEmailLogByResendId(env, 're_khong-co', { status: 'delivered' })).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('countEmailsSentToday', () => {
  it('dem so dong tra ve (toi da cap)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse([{ id: '1' }, { id: '2' }, { id: '3' }]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const n = await countEmailsSentToday(env, '2026-11-09T17:00:00.000Z', 80);
    expect(n).toBe(3);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('status=in.(sent,delivered,bounced,complained)');
    expect(url).toContain('limit=80');
  });
});
