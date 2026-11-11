// Vi & tiep thi lien ket — client goi Workers API /api/v1/referrals
// (migration 0023). JWT qua session Supabase. KHONG mock du lieu: API
// chua deploy / migration chua ap thi tra ve trang thai loi de UI hien ro.
// Ty le hoa hong DA CHOT 10% (QĐ 26, 11/11/2026) — xem COMMISSION_RATE
// trong workers/api/src/referrals.ts (nguon su that duy nhat). Hien dung
// chu nay o UI. Rut tien THU CONG: chi tao giao dich status pending,
// admin duyet va chuyen khoan tay trong 15 ngay lam viec — KHONG tu dong
// chuyen tien.
import {
  getApiBaseUrl,
  getJson,
  isOfflineError,
  newIdempotencyKey,
  postJson,
  type FetchImpl,
} from './api-client';
import { getAccessToken } from './payments';

/** Ty le hoa hong da chot 10% (QĐ 26, 11/11/2026). */
export const COMMISSION_RATE_LABEL = '10%';
export const COMMISSION_RATE = 0.1;

export const REFERRAL_CODE_REGEX = /^VISFAR-[A-Z0-9]{6}$/;
/** Domain cong khai lam goc link gioi thieu (layout.tsx SITE_URL). */
export const REFERRAL_SITE_URL = 'https://visfaracademy.pages.dev';

export function referralLink(code: string): string {
  return `${REFERRAL_SITE_URL}/dang-ky?ref=${encodeURIComponent(code)}`;
}

export type WalletTransactionType = 'commission' | 'withdrawal' | 'adjustment';
export type WalletTransactionStatus = 'pending' | 'completed' | 'rejected';

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  amountVnd: number;
  relatedOrderId: string | null;
  status: WalletTransactionStatus;
  note: string | null;
  createdAt: string;
}

export interface ReferredPerson {
  userId: string | null;
  fullName: string | null;
  email: string | null;
  referralCode: string;
  referredAt: string;
  hasPaidOrder: boolean;
  commissionEarnedVnd: number;
}

export interface MyReferral {
  referralCode: string;
  balanceVnd: number;
  availableBalanceVnd: number;
  transactions: WalletTransaction[];
  referred: ReferredPerson[];
}

export type ReferralState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; data: MyReferral }
  | { status: 'error'; message: string; isOffline: boolean };

export type ReferralActionState =
  | { status: 'success'; data: MyReferral }
  | { status: 'error'; message: string; isOffline: boolean };

export function walletTransactionTypeLabelVi(type: WalletTransactionType): string {
  switch (type) {
    case 'commission':
      return 'Hoa hồng giới thiệu';
    case 'withdrawal':
      return 'Rút tiền';
    case 'adjustment':
      return 'Điều chỉnh';
  }
}

export function walletTransactionStatusLabelVi(status: WalletTransactionStatus): string {
  switch (status) {
    case 'pending':
      return 'Chờ duyệt';
    case 'completed':
      return 'Đã hoàn thành';
    case 'rejected':
      return 'Đã từ chối';
  }
}

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

/**
 * Tong ket vi tu lich su giao dich (chi tinh giao dich da hoan thanh):
 * tong hoa hong da nhan + tong da rut (so duong). Giao dich cho duyet /
 * bi tu choi khong tinh vao 2 so nay.
 */
export function summarizeWallet(transactions: WalletTransaction[]): {
  totalCommissionVnd: number;
  totalWithdrawnVnd: number;
} {
  let totalCommissionVnd = 0;
  let totalWithdrawnVnd = 0;
  for (const tx of transactions) {
    if (tx.status !== 'completed') continue;
    if (tx.type === 'commission' && tx.amountVnd > 0) totalCommissionVnd += tx.amountVnd;
    if (tx.type === 'withdrawal' && tx.amountVnd < 0) totalWithdrawnVnd += Math.abs(tx.amountVnd);
  }
  return { totalCommissionVnd, totalWithdrawnVnd };
}

function errorMessage(err: unknown, fallback: string): { message: string; isOffline: boolean } {
  const isOffline = isOfflineError(err);
  return {
    message: isOffline
      ? 'Không kết nối được tới API ví / giới thiệu. Kiểm tra mạng, hoặc API chưa được triển khai (migration 0023 chưa áp / Workers chưa deploy).'
      : err instanceof Error
        ? err.message
        : fallback,
    isOffline,
  };
}

function mapMyReferral(data: Record<string, unknown>): MyReferral {
  const txs = (data['transactions'] as Array<Record<string, unknown>> | undefined) ?? [];
  const referred = (data['referred'] as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    referralCode: String(data['referralCode'] ?? ''),
    balanceVnd: Number(data['balanceVnd'] ?? 0),
    availableBalanceVnd: Number(data['availableBalanceVnd'] ?? 0),
    transactions: txs.map((t) => ({
      id: String(t['id'] ?? ''),
      type: (t['type'] as WalletTransactionType) ?? 'commission',
      amountVnd: Number(t['amountVnd'] ?? 0),
      relatedOrderId: (t['relatedOrderId'] as string | null) ?? null,
      status: (t['status'] as WalletTransactionStatus) ?? 'pending',
      note: (t['note'] as string | null) ?? null,
      createdAt: String(t['createdAt'] ?? ''),
    })),
    referred: referred.map((r) => ({
      userId: (r['userId'] as string | null) ?? null,
      fullName: (r['fullName'] as string | null) ?? null,
      email: (r['email'] as string | null) ?? null,
      referralCode: String(r['referralCode'] ?? ''),
      referredAt: String(r['referredAt'] ?? ''),
      hasPaidOrder: Boolean(r['hasPaidOrder']),
      commissionEarnedVnd: Number(r['commissionEarnedVnd'] ?? 0),
    })),
  };
}

export async function getMyReferral(opts: { fetchImpl?: FetchImpl } = {}): Promise<ReferralState> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'signed-out' };
  try {
    const data = await getJson<Record<string, unknown>>('/referrals/me', {
      accessToken,
      fetchImpl: opts.fetchImpl,
    });
    return { status: 'success', data: mapMyReferral(data) };
  } catch (err) {
    return { status: 'error', ...errorMessage(err, 'Không tải được ví của bạn.') };
  }
}

/**
 * Kiem tra ma gioi thieu co ton tai khong — endpoint CONG KHAI (khong
 * can JWT), dung o trang /dang-ky?ref=CODE.
 */
export async function validateReferralCode(
  code: string,
  opts: { fetchImpl?: FetchImpl; timeoutMs?: number } = {},
): Promise<{ valid: boolean; code: string | null }> {
  const normalized = code.trim().toUpperCase();
  if (!REFERRAL_CODE_REGEX.test(normalized)) return { valid: false, code: normalized || null };
  const fetchImpl: FetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetchImpl(
      `${getApiBaseUrl()}/referrals/validate?code=${encodeURIComponent(normalized)}`,
      { method: 'GET', signal: controller.signal },
    );
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
      return { valid: false, code: normalized };
    }
    return {
      valid: Boolean((data as { valid?: unknown }).valid),
      code: (data as { code?: string | null }).code ?? normalized,
    };
  } catch {
    return { valid: false, code: normalized };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ghi referrer cho user moi vua dang ky (POST /api/v1/referrals/claim,
 * JWT cua user moi). Tra 'already-claimed' khi user da co referrer.
 */
export async function claimReferral(
  code: string,
  opts: { fetchImpl?: FetchImpl } = {},
): Promise<
  | { status: 'success'; alreadyClaimed: boolean }
  | { status: 'error'; message: string; isOffline: boolean }
> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { status: 'error', message: 'Bạn chưa đăng nhập.', isOffline: false };
  }
  try {
    const data = await postJson<{ alreadyClaimed?: boolean }>('/referrals/claim', { code }, {
      accessToken,
      idempotencyKey: newIdempotencyKey(),
      fetchImpl: opts.fetchImpl,
    });
    return { status: 'success', alreadyClaimed: Boolean(data.alreadyClaimed) };
  } catch (err) {
    return { status: 'error', ...errorMessage(err, 'Không ghi nhận được mã giới thiệu.') };
  }
}

export async function requestWithdrawal(input: {
  amountVnd: number;
  payoutInfo: string;
  fetchImpl?: FetchImpl;
}): Promise<ReferralActionState> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { status: 'error', message: 'Bạn chưa đăng nhập.', isOffline: false };
  try {
    const data = await postJson<Record<string, unknown>>(
      '/referrals/withdraw',
      { amount_vnd: input.amountVnd, payout_info: input.payoutInfo },
      { accessToken, idempotencyKey: newIdempotencyKey(), fetchImpl: input.fetchImpl },
    );
    // Lay lai toan bo vi de UI hien so du moi (withdraw chi tra 1 giao dich).
    const fresh = await getMyReferral({ fetchImpl: input.fetchImpl });
    if (fresh.status === 'success') return { status: 'success', data: fresh.data };
    return {
      status: 'success',
      data: {
        referralCode: '',
        balanceVnd: Number(data['balanceVnd'] ?? 0),
        availableBalanceVnd: Number(data['availableBalanceVnd'] ?? 0),
        transactions: [],
        referred: [],
      },
    };
  } catch (err) {
    return { status: 'error', ...errorMessage(err, 'Không gửi được yêu cầu rút tiền.') };
  }
}

// ---------------------------------------------------------------------------
// Ma gioi thieu tam giu khi dang ky — sessionStorage CHI la phuong tien
// van chuyen tam thoi giua /dang-ky va phien dang nhap dau tien, KHONG
// phai noi luu tru: quan he gioi thieu chi ton tai khi Workers da ghi
// vao bang referrals (claimReferral). Neu trinh duyet xoa session thi
// ma se mat va khong duoc ghi — do la gioi han da biet, khong gia vo.
// ---------------------------------------------------------------------------

export const STORED_REFERRAL_CODE_KEY = 'visfar-ref-code';

export function storeReferralCode(code: string): void {
  try {
    const normalized = code.trim().toUpperCase();
    if (REFERRAL_CODE_REGEX.test(normalized)) {
      sessionStorage.setItem(STORED_REFERRAL_CODE_KEY, normalized);
    }
  } catch {
    // Bo qua: trinh duyet chan storage.
  }
}

export function readStoredReferralCode(): string | null {
  try {
    const raw = sessionStorage.getItem(STORED_REFERRAL_CODE_KEY);
    if (!raw) return null;
    return REFERRAL_CODE_REGEX.test(raw.trim().toUpperCase())
      ? raw.trim().toUpperCase()
      : null;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    sessionStorage.removeItem(STORED_REFERRAL_CODE_KEY);
  } catch {
    // Bo qua.
  }
}

/**
 * Ghi ma gioi thieu da luu tam (neu co) cho user vua dang nhap. Best
 * effort, im lang khi khong co ma / API loi — khong chan trang hoc vien.
 * Tra true khi da ghi (hoac da co san), false khi khong co ma de ghi.
 */
export async function claimStoredReferralCode(opts: {
  fetchImpl?: FetchImpl;
} = {}): Promise<boolean> {
  const code = readStoredReferralCode();
  if (!code) return false;
  try {
    const result = await claimReferral(code, opts);
    if (result.status === 'success') {
      clearStoredReferralCode();
      return true;
    }
    // Ma khong ton tai / loi: xoa de khong thu lai mai.
    if (!result.isOffline) clearStoredReferralCode();
    return false;
  } catch {
    return false;
  }
}
