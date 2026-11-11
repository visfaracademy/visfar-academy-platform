// Test lib Vi & tiep thi lien ket — goi dung Workers API, ty le hoa hong
// mac dinh 10% chi la nhan hien thi (server moi la nguon su that), rut
// tien gui dung body, loi/offline tra ve state ro, khong tra du lieu gia.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: () => ({
    auth: { getSession: mocks.getSession },
  }),
}));

import {
  COMMISSION_RATE,
  COMMISSION_RATE_LABEL,
  claimReferral,
  formatVnd,
  getMyReferral,
  referralLink,
  requestWithdrawal,
  summarizeWallet,
  validateReferralCode,
  walletTransactionStatusLabelVi,
  walletTransactionTypeLabelVi,
} from './referrals';
import type { FetchImpl } from './api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test-jwt' } } });
});

describe('hang so + nhan hien thi', () => {
  it('hoa hong da chot 10%, nhan chi hien 10%', () => {
    expect(COMMISSION_RATE).toBe(0.1);
    expect(COMMISSION_RATE_LABEL).toBe('10%');
  });
  it('link gioi thieu dung dang https://visfaracademy.pages.dev/dang-ky?ref=CODE', () => {
    expect(referralLink('VISFAR-ABC123')).toBe(
      'https://visfaracademy.pages.dev/dang-ky?ref=VISFAR-ABC123',
    );
  });
  it('formatVnd + nhan giao dich day du', () => {
    expect(formatVnd(199900)).toBe('199.900 đ');
    expect(walletTransactionTypeLabelVi('commission')).toContain('Hoa hồng');
    expect(walletTransactionTypeLabelVi('withdrawal')).toBe('Rút tiền');
    expect(walletTransactionStatusLabelVi('pending')).toBe('Chờ duyệt');
  });
});

describe('goi API vi / gioi thieu (fetch gia lap)', () => {
  it('getMyReferral: GET /referrals/me + JWT, map dung so du + giao dich', async () => {
    const fetchImpl: FetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain('/referrals/me');
      expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-jwt');
      return jsonResponse({
        ok: true,
        referralCode: 'VISFAR-ABC123',
        balanceVnd: 199900,
        availableBalanceVnd: 199900,
        transactions: [
          {
            id: 'wt-1',
            type: 'commission',
            amountVnd: 199900,
            relatedOrderId: 'ord-1',
            status: 'completed',
            note: 'Hoa hồng',
            createdAt: '2026-11-11T00:00:00.000Z',
          },
        ],
        referred: [
          {
            userId: 'stu-2',
            fullName: 'Nguyen Van B',
            email: 'b@example.com',
            referralCode: 'VISFAR-ABC123',
            referredAt: '2026-11-10T00:00:00.000Z',
            hasPaidOrder: true,
            commissionEarnedVnd: 199900,
          },
        ],
      });
    });
    const state = await getMyReferral({ fetchImpl });
    expect(state.status).toBe('success');
    if (state.status === 'success') {
      expect(state.data.referralCode).toBe('VISFAR-ABC123');
      expect(state.data.balanceVnd).toBe(199900);
      expect(state.data.referred[0]?.hasPaidOrder).toBe(true);
    }
  });

  it('getMyReferral: API loi -> error, khong tra vi gia', async () => {
    const fetchImpl: FetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, error: 'not_found', message: 'Bang chua co.' }, 404),
    );
    const state = await getMyReferral({ fetchImpl });
    expect(state.status).toBe('error');
  });

  it('validateReferralCode: ma sai dinh dang khong goi API; ma dung goi GET validate', async () => {
    const fetchImpl: FetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain('/referrals/validate?code=VISFAR-ABC123');
      return jsonResponse({ ok: true, valid: true, code: 'VISFAR-ABC123' });
    });
    expect(await validateReferralCode('khong-phai-ma', { fetchImpl })).toEqual({
      valid: false,
      code: 'KHONG-PHAI-MA',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await validateReferralCode('visfar-abc123', { fetchImpl })).toEqual({
      valid: true,
      code: 'VISFAR-ABC123',
    });
  });

  it('claimReferral: POST /referrals/claim dung body + JWT', async () => {
    const fetchImpl: FetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain('/referrals/claim');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({ code: 'VISFAR-ABC123' });
      return jsonResponse({ ok: true, referral: { referralCode: 'VISFAR-ABC123' }, alreadyClaimed: false }, 201);
    });
    const res = await claimReferral('VISFAR-ABC123', { fetchImpl });
    expect(res).toEqual({ status: 'success', alreadyClaimed: false });
  });

  it('requestWithdrawal: POST dung amount_vnd + payout_info, roi tai lai vi', async () => {
    let calls = 0;
    const fetchImpl: FetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      if (String(url).includes('/referrals/withdraw')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        expect(body['amount_vnd']).toBe(100000);
        expect(body['payout_info']).toBe('MB Bank 1234567890 Nguyen Van A');
        return jsonResponse(
          { ok: true, transaction: { id: 'wt-2', type: 'withdrawal', amountVnd: -100000, status: 'pending' } },
          201,
        );
      }
      return jsonResponse({
        ok: true,
        referralCode: 'VISFAR-ABC123',
        balanceVnd: 199900,
        availableBalanceVnd: 99900,
        transactions: [],
        referred: [],
      });
    });
    const res = await requestWithdrawal({
      amountVnd: 100000,
      payoutInfo: 'MB Bank 1234567890 Nguyen Van A',
      fetchImpl,
    });
    expect(res.status).toBe('success');
    if (res.status === 'success') expect(res.data.availableBalanceVnd).toBe(99900);
    expect(calls).toBe(2);
  });
});

describe('summarizeWallet — tong hoa hong / tong da rut (chi giao dich completed)', () => {
  const tx = (id: string, type: 'commission' | 'withdrawal' | 'adjustment', amountVnd: number, status: 'pending' | 'completed' | 'rejected' = 'completed') => ({
    id, type, amountVnd, relatedOrderId: null, status, note: null, createdAt: '2026-11-11T00:00:00Z',
  });
  it('cong dung, bo qua pending/rejected', () => {
    expect(
      summarizeWallet([
        tx('1', 'commission', 100000),
        tx('2', 'commission', 50000),
        tx('3', 'withdrawal', -80000),
        tx('4', 'commission', 99999, 'pending'),
        tx('5', 'withdrawal', -1000, 'rejected'),
      ]),
    ).toEqual({ totalCommissionVnd: 150000, totalWithdrawnVnd: 80000 });
  });
  it('rong thi 0', () => {
    expect(summarizeWallet([])).toEqual({ totalCommissionVnd: 0, totalWithdrawnVnd: 0 });
  });
});
