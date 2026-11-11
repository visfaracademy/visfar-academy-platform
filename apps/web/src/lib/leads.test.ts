// Test dich vu form tu van — chay local voi fetch mock, khong can staging.
// Bao phu: validation, chong trung (Idempotency-Key), mat mang, fallback
// Apps Script (chi thanh cong khi doc duoc JSON ok:true), khong fallback
// khi API tu choi dut khoat (400/429).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { FetchImpl } from './api-client';
import {
  getLegacyAppsScriptUrl,
  submitLead,
  validateLeadInput,
  type LeadInput,
} from './leads';

type MockFetch = (...args: Parameters<FetchImpl>) => Promise<Response>;

function validInput(over: Partial<LeadInput> = {}): LeadInput {
  return {
    fullName: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'a@example.com',
    province: 'Hà Nội',
    courseId: 'course-uuid-1',
    courseInterestText: 'Thấu Hiểu Nội Tâm',
    source: 'visfar-academy',
    honeypot: '',
    ...over,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// localStorage gia cho test (node env khong co): de recordFallbackAttempt chay that.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  });
  vi.stubGlobal('console', { ...console, warn: vi.fn() });
});

describe('validateLeadInput', () => {
  it('hop le: khong loi', () => expect(validateLeadInput(validInput())).toEqual([]));
  it('SĐT sai: 9 so, +84, khong bat dau bang 0', () => {
    expect(validateLeadInput(validInput({ phone: '090123456' })).map((e) => e.field)).toContain('phone');
    expect(validateLeadInput(validInput({ phone: '+84901234567' })).map((e) => e.field)).toContain('phone');
    expect(validateLeadInput(validInput({ phone: '1901234567' })).map((e) => e.field)).toContain('phone');
  });
  it('email TLD 1 ky tu bi tu choi (a@b.c) — dong bo client/server', () => {
    expect(validateLeadInput(validInput({ email: 'a@b.c' })).map((e) => e.field)).toContain('email');
  });
  it('tinh ngoai 34 tinh (Binh Duong da sap nhap) bi tu choi', () => {
    expect(validateLeadInput(validInput({ province: 'Bình Dương' })).map((e) => e.field)).toContain('province');
  });
  it('thieu ten / thieu khoa quan tam', () => {
    expect(validateLeadInput(validInput({ fullName: 'A' })).map((e) => e.field)).toContain('fullName');
    expect(validateLeadInput(validInput({ courseInterestText: '' })).map((e) => e.field)).toContain('course');
  });
  it('courseId null van hop le khi chon "Chua biet bat dau tu dau"', () => {
    expect(
      validateLeadInput(validInput({ courseId: null, courseInterestText: 'Chưa biết bắt đầu từ đâu — cần tư vấn lộ trình' })),
    ).toEqual([]);
  });
});

describe('submitLead — API thanh cong / trung lap', () => {
  it('201 lan dau: success, via api, kem referenceCode', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: true, referenceCode: 'VISFAR-2026-000123' }, 201),
    );
    const result = await submitLead(validInput(), { fetchImpl, idempotencyKey: 'key-1' });
    expect(result).toMatchObject({ status: 'success', referenceCode: 'VISFAR-2026-000123', duplicate: false, via: 'api' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/leads');
    expect((fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'key-1' });
  });

  it('gui 2 lan cung Idempotency-Key: lan 2 tra duplicate:true, cung referenceCode, khong ghi them', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      // Mo phong server dedup: lan 2 tra lai ket qua cu.
      jsonResponse({ ok: true, referenceCode: 'VISFAR-2026-000123', duplicate: true }, 200),
    );
    const first = await submitLead(validInput(), { fetchImpl, idempotencyKey: 'key-dup' });
    const second = await submitLead(validInput(), { fetchImpl, idempotencyKey: 'key-dup' });
    expect(first).toMatchObject({ status: 'success', duplicate: true });
    expect(second).toMatchObject({ status: 'success', referenceCode: 'VISFAR-2026-000123', duplicate: true });
    // Client gui lai (retry an toan); server khong ghi them nho cung key.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const call of fetchImpl.mock.calls) {
      expect((call[1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'key-dup' });
    }
  });

  it('retry dung lai key cu; key moi sinh header khac nhau', async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (...args: Parameters<FetchImpl>) => {
      seen.push(((args[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined)?.['Idempotency-Key'] ?? '');
      return jsonResponse({ ok: true, referenceCode: 'VISFAR-2026-000001' }, 201);
    });
    await submitLead(validInput(), { fetchImpl, idempotencyKey: 'same-key' });
    await submitLead(validInput(), { fetchImpl, idempotencyKey: 'same-key' });
    await submitLead(validInput(), { fetchImpl });
    expect(seen[0]).toBe('same-key');
    expect(seen[1]).toBe('same-key');
    expect(seen[2]).not.toBe('same-key');
  });

  it('validation loi o client: khong goi fetch', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true }, 201));
    const result = await submitLead(validInput({ phone: '123' }), { fetchImpl });
    expect(result.status).toBe('error');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('honeypot co gia tri: spam, khong goi API', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true }, 201));
    const result = await submitLead(validInput({ honeypot: 'http://spam.example' }), { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'spam_suspected' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('submitLead — API tu choi dut khoat: KHONG fallback', () => {
  it('400 invalid_phone: error, chi goi API 1 lan, khong chay Apps Script', async () => {
    const fetchImpl = vi.fn(async (...args: Parameters<FetchImpl>) => {
      expect(String(args[0])).toContain('/api/v1/leads');
      return jsonResponse({ ok: false, error: 'invalid_phone', message: 'Số điện thoại chưa đúng định dạng.' }, 400);
    });
    const result = await submitLead(validInput(), { fetchImpl, idempotencyKey: 'k-400' });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_phone' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    if (result.status === 'error') expect(result.fallbackAttempted).toBe(false);
  });

  it('429 rate_limited: error + canRetry, khong fallback (khong lan tranh rate-limit)', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () =>
      jsonResponse({ ok: false, error: 'rate_limited', message: 'Bạn đã gửi quá nhiều lần.' }, 429),
    );
    const result = await submitLead(validInput(), { fetchImpl });
    expect(result).toMatchObject({ status: 'error', code: 'rate_limited' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    if (result.status === 'error') {
      expect(result.canRetry).toBe(true);
      expect(result.fallbackAttempted).toBe(false);
    }
  });
});

describe('submitLead — mat mang + fallback Apps Script', () => {
  const appsScriptUrl = getLegacyAppsScriptUrl();

  it('API mat mang + Apps Script tra JSON ok:true: success via fallback-apps-script (co ghi log)', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<MockFetch>(async (url) => {
      const urlStr = String(url);
      calls.push(urlStr);
      if (urlStr.includes('/api/v1/leads')) throw new TypeError('Failed to fetch');
      expect(urlStr).toBe(appsScriptUrl);
      return jsonResponse({ ok: true, source: 'visfar-academy' }, 200);
    });
    const result = await submitLead(validInput(), { fetchImpl, idempotencyKey: 'k-fb-ok' });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.via).toBe('fallback-apps-script');
      expect(result.fallbackLogged).toBe(true);
      // Ma fallback ghi ro la ma tam, khong gia vo la ma tham chieu API.
      expect(result.referenceCode).toMatch(/^FALLBACK-/);
    }
    expect(calls).toHaveLength(2);
  });

  it('API 500 + Apps Script tra JSON ok:true: success via fallback', async () => {
    const fetchImpl = vi.fn<MockFetch>(async (url) => {
      if (String(url).includes('/api/v1/leads')) {
        return jsonResponse({ ok: false, error: 'server_error', message: 'Loi server.' }, 500);
      }
      return jsonResponse({ ok: true }, 200);
    });
    const result = await submitLead(validInput(), { fetchImpl });
    expect(result).toMatchObject({ status: 'success', via: 'fallback-apps-script' });
  });

  it('API mat mang + Apps Script khong doc duoc xac nhan: ERROR, khong hien cam on gia', async () => {
    const fetchImpl = vi.fn<MockFetch>(async (url) => {
      if (String(url).includes('/api/v1/leads')) throw new TypeError('Failed to fetch');
      return new Response('<html>redirect</html>', { status: 200 });
    });
    const result = await submitLead(validInput(), { fetchImpl, idempotencyKey: 'k-fb-bad' });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.isOffline).toBe(true);
      expect(result.canRetry).toBe(true);
      expect(result.fallbackAttempted).toBe(true);
      expect(result.fallbackLogged).toBe(true);
      expect(result.message).toContain('Thử lại');
    }
  });

  it('API mat mang + Apps Script cung mat mang: ERROR offline, co nut thu lai', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await submitLead(validInput(), { fetchImpl });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.isOffline).toBe(true);
      expect(result.canRetry).toBe(true);
    }
  });

  it('API tra ok:true nhung thieu referenceCode: ERROR, khong coi la thanh cong', async () => {
    const fetchImpl = vi.fn<MockFetch>(async () => jsonResponse({ ok: true }, 201));
    const result = await submitLead(validInput(), { fetchImpl });
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('server_error');
  });
});
