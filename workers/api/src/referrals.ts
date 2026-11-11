// Tiep thi lien ket + Vi — service core (Task 12, migration 0023).
//
// QUY UOC VI (theo 0023):
//   - amount_vnd > 0: tien VAO vi (commission, adjustment duong).
//   - amount_vnd < 0: tien RA khoi vi (withdrawal — luu SO AM).
//   - So du vi = SUM(amount_vnd) voi status = 'completed'.
//   - So du KHA DUNG de rut = SUM(amount_vnd) voi status IN
//     ('completed', 'pending') — rut dang cho duyet (pending, so am)
//     da tru vao kha dung, tranh rut vuot 2 lan.
//
// TY LE HOA HONG DA CHOT 10% (QĐ 26, 11/11/2026) — KHONG co bang
// settings moi; hang so duoi day la nguon su that duy nhat. Neu user
// chot ty le khac hoac muon cau hinh theo khoa, doi hang so nay
// (hoac them settings sau) — khong tu y them bang o dot nay.
import type { Env } from './env';
import { safeLog } from './env';
import { ApiError, serverError } from './errors';
import { isUniqueViolation, requireSbOk, sbFetch } from './supabase';
import type { OrderRow } from './payments';

/** Ty le hoa hong da chot 10% (QĐ 26, 11/11/2026). */
export const COMMISSION_RATE = 0.10;

const REFERRAL_CODE_PREFIX = 'VISFAR-';
const REFERRAL_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REFERRAL_CODE_LENGTH = 6;
export const REFERRAL_CODE_REGEX = /^VISFAR-[A-Z0-9]{6}$/;

/** Hoa hong (VND, lam tron xuong) cua 1 don — pure, de test. */
export function computeCommissionAmount(orderAmountVnd: number): number {
  if (!Number.isFinite(orderAmountVnd) || orderAmountVnd <= 0) return 0;
  return Math.floor(orderAmountVnd * COMMISSION_RATE);
}

/**
 * Sinh ma gioi thieu xac dinh tu user id (hash SHA-256): cung user
 * luon ra cung ma, khong can luu truoc. attempt > 0 de thu lai khi
 * trung UNIQUE voi user khac (hiem).
 */
export async function generateReferralCode(userId: string, attempt = 0): Promise<string> {
  const input = attempt === 0 ? userId : `${userId}#${attempt}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  let suffix = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    suffix += REFERRAL_CODE_ALPHABET[(bytes[i] as number) % REFERRAL_CODE_ALPHABET.length];
  }
  return `${REFERRAL_CODE_PREFIX}${suffix}`;
}

// ---------------------------------------------------------------------------
// Doc / ghi DB (PostgREST, service-role)
// ---------------------------------------------------------------------------

export interface ReferralCodeRow {
  id: string;
  user_id: string;
  code: string;
  created_at: string;
}

export interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_user_id: string | null;
  referral_code: string;
  created_at: string;
}

export interface WalletTransactionRow {
  id: string;
  user_id: string;
  type: 'commission' | 'withdrawal' | 'adjustment';
  amount_vnd: number;
  related_order_id: string | null;
  status: 'pending' | 'completed' | 'rejected';
  note: string | null;
  created_at: string;
}

export async function getReferralCodeByUser(env: Env, userId: string): Promise<ReferralCodeRow | null> {
  const result = await sbFetch<ReferralCodeRow[]>(
    env,
    `/referral_codes?select=id,user_id,code,created_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getReferralCodeByUser');
  return rows && rows.length > 0 ? (rows[0] as ReferralCodeRow) : null;
}

export async function getReferralCodeByCode(env: Env, code: string): Promise<ReferralCodeRow | null> {
  const normalized = code.trim().toUpperCase();
  if (!REFERRAL_CODE_REGEX.test(normalized)) return null;
  const result = await sbFetch<ReferralCodeRow[]>(
    env,
    `/referral_codes?select=id,user_id,code,created_at&code=eq.${encodeURIComponent(normalized)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getReferralCodeByCode');
  return rows && rows.length > 0 ? (rows[0] as ReferralCodeRow) : null;
}

/**
 * Lay ma cua user; tu tao neu chua co. Chay dua UNIQUE: trung ma voi
 * user khac -> sinh lai voi attempt tang; trung user_id (request song
 * song) -> doc lai dong vua co.
 */
export async function getOrCreateReferralCode(env: Env, userId: string): Promise<ReferralCodeRow> {
  const existing = await getReferralCodeByUser(env, userId);
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateReferralCode(userId, attempt);
    const result = await sbFetch<ReferralCodeRow[]>(env, '/referral_codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, code }),
    });
    if (result.error) {
      if (isUniqueViolation(result.error)) {
        const raced = await getReferralCodeByUser(env, userId);
        if (raced) return raced;
        continue; // Trung code voi user khac -> sinh ma moi, thu lai.
      }
      throw serverError(`insertReferralCode: ${result.error.message}`);
    }
    const rows = requireSbOk(result, 'insertReferralCode');
    if (rows && rows.length > 0) return rows[0] as ReferralCodeRow;
    throw serverError('insertReferralCode: no row returned');
  }
  throw serverError('getOrCreateReferralCode: exhausted retries');
}

export async function getReferralByReferredUser(
  env: Env,
  referredUserId: string,
): Promise<ReferralRow | null> {
  const result = await sbFetch<ReferralRow[]>(
    env,
    `/referrals?select=id,referrer_id,referred_user_id,referral_code,created_at&referred_user_id=eq.${encodeURIComponent(referredUserId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getReferralByReferredUser');
  return rows && rows.length > 0 ? (rows[0] as ReferralRow) : null;
}

export interface ClaimReferralResult {
  referral: ReferralRow;
  /** false khi user da co referrer (goi lai — idempotent). */
  created: boolean;
}

/**
 * Ghi quan he gioi thieu cho user MOI vua dang ky bang ma gioi thieu.
 * Gọi tu web sau khi Supabase Auth signUp thanh cong (JWT cua user
 * moi). Kiem tra: ma ton tai, khong tu gioi thieu minh, user chua co
 * referrer. Idempotent: goi lai tra ve dong da co, khong tao trung
 * (DB co UNIQUE referrals.referred_user_id).
 */
export async function claimReferral(
  env: Env,
  referredUserId: string,
  rawCode: string,
): Promise<ClaimReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!REFERRAL_CODE_REGEX.test(code)) {
    throw new ApiError(400, 'invalid_input', 'Mã giới thiệu chưa đúng định dạng.');
  }
  const codeRow = await getReferralCodeByCode(env, code);
  if (!codeRow) {
    throw new ApiError(404, 'not_found', 'Mã giới thiệu không tồn tại.');
  }
  if (codeRow.user_id === referredUserId) {
    throw new ApiError(400, 'invalid_input', 'Bạn không thể tự giới thiệu chính mình.');
  }
  const existing = await getReferralByReferredUser(env, referredUserId);
  if (existing) return { referral: existing, created: false };
  const inserted = await sbFetch<ReferralRow[]>(env, '/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      referrer_id: codeRow.user_id,
      referred_user_id: referredUserId,
      referral_code: code,
    }),
  });
  if (inserted.error) {
    if (isUniqueViolation(inserted.error)) {
      const raced = await getReferralByReferredUser(env, referredUserId);
      if (raced) return { referral: raced, created: false };
    }
    throw serverError(`insertReferral: ${inserted.error.message}`);
  }
  const rows = requireSbOk(inserted, 'insertReferral');
  const row = rows?.[0] as ReferralRow | undefined;
  if (!row) throw serverError('insertReferral: no row returned');
  return { referral: row, created: true };
}

export async function listReferralsByReferrer(env: Env, referrerId: string): Promise<ReferralRow[]> {
  const result = await sbFetch<ReferralRow[]>(
    env,
    `/referrals?select=id,referrer_id,referred_user_id,referral_code,created_at&referrer_id=eq.${encodeURIComponent(referrerId)}&order=created_at.desc&limit=200`,
  );
  const rows = requireSbOk(result, 'listReferralsByReferrer');
  return (rows ?? []) as ReferralRow[];
}

export async function listWalletTransactions(
  env: Env,
  userId: string,
  limit = 50,
): Promise<WalletTransactionRow[]> {
  const result = await sbFetch<WalletTransactionRow[]>(
    env,
    `/wallet_transactions?select=id,user_id,type,amount_vnd,related_order_id,status,note,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${limit}`,
  );
  const rows = requireSbOk(result, 'listWalletTransactions');
  return (rows ?? []) as WalletTransactionRow[];
}

export interface WalletSums {
  /** SUM completed — so du vi hien thi. */
  completedBalanceVnd: number;
  /** SUM completed + pending — so du kha dung de rut. */
  availableBalanceVnd: number;
}

/** Tong vi theo quy uoc 0023 (tinh o code — PostgREST khong co SUM). */
export async function getWalletSums(env: Env, userId: string): Promise<WalletSums> {
  const result = await sbFetch<Array<{ amount_vnd: number; status: string }>>(
    env,
    `/wallet_transactions?select=amount_vnd,status&user_id=eq.${encodeURIComponent(userId)}&limit=1000`,
  );
  const rows = (requireSbOk(result, 'getWalletSums') ?? []) as Array<{
    amount_vnd: number;
    status: string;
  }>;
  let completed = 0;
  let available = 0;
  for (const r of rows) {
    if (r.status === 'completed') {
      completed += r.amount_vnd;
      available += r.amount_vnd;
    } else if (r.status === 'pending') {
      available += r.amount_vnd;
    }
    // rejected: khong tinh vao ca 2 so.
  }
  return { completedBalanceVnd: completed, availableBalanceVnd: available };
}

// ---------------------------------------------------------------------------
// Hook hoa hong — goi tu payments.ts confirmPayment() SAU khi don paid.
// Best-effort: KHONG BAO GIO throw — loi chi ghi log, don da paid
// khong duoc hong vi hoa hong.
// ---------------------------------------------------------------------------

/**
 * Ghi hoa hong 10% * orders.amount_vnd cho referrer cua nguoi mua.
 * Idempotent: chi ghi neu chua co commission cho don nay (kiem tra
 * related_order_id + type; DB them lop chan UNIQUE rieng phan
 * uq_wallet_one_commission_per_order — trung -> bo qua).
 * Tra null khi: don 0đ / khong co referrer / da co commission / loi.
 */
export async function recordReferralCommission(
  env: Env,
  order: OrderRow,
): Promise<WalletTransactionRow | null> {
  try {
    if (!order.user_id) return null;
    if (!order.amount_vnd || order.amount_vnd <= 0) return null;
    const referral = await getReferralByReferredUser(env, order.user_id);
    if (!referral) return null;
    const existing = await sbFetch<Array<{ id: string }>>(
      env,
      `/wallet_transactions?select=id&related_order_id=eq.${encodeURIComponent(order.id)}&type=eq.commission&limit=1`,
    );
    const existingRows = requireSbOk(existing, 'checkExistingCommission');
    if (existingRows && existingRows.length > 0) return null;
    const amount = computeCommissionAmount(order.amount_vnd);
    if (amount <= 0) return null;
    const inserted = await sbFetch<WalletTransactionRow[]>(env, '/wallet_transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: referral.referrer_id,
        type: 'commission',
        amount_vnd: amount,
        related_order_id: order.id,
        status: 'completed',
        note: `Hoa hồng giới thiệu đơn ${order.reference_code} (${Math.round(COMMISSION_RATE * 100)}%)`,
      }),
    });
    if (inserted.error) {
      if (isUniqueViolation(inserted.error)) return null; // Race: don khac da ghi.
      safeLog('referral commission insert failed', {
        orderId: order.id,
        reason: `${inserted.error.code ?? ''} ${inserted.error.message}`,
      });
      return null;
    }
    const rows = requireSbOk(inserted, 'insertCommission');
    return rows && rows.length > 0 ? (rows[0] as WalletTransactionRow) : null;
  } catch (err) {
    safeLog('referral commission failed', {
      orderId: order.id,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rut tien — tao wallet_transactions type withdrawal status pending.
// KHONG tu dong chuyen tien: admin duyet / chuyen khoan tay sau.
// ---------------------------------------------------------------------------

export interface WithdrawalInput {
  amountVnd: number;
  /** Thong tin nhan tien do user nhap (ngan hang / so TK / chu TK). */
  payoutInfo: string;
}

export interface WithdrawalResult {
  transaction: WalletTransactionRow;
  sums: WalletSums;
}

export async function requestWithdrawal(
  env: Env,
  userId: string,
  input: WithdrawalInput,
): Promise<WithdrawalResult> {
  if (!Number.isInteger(input.amountVnd) || input.amountVnd <= 0) {
    throw new ApiError(400, 'invalid_input', 'Số tiền rút phải là số nguyên lớn hơn 0.');
  }
  const payoutInfo = input.payoutInfo.trim();
  if (!payoutInfo) {
    throw new ApiError(400, 'invalid_input', 'Vui lòng nhập thông tin nhận tiền (ngân hàng, số tài khoản, chủ tài khoản).');
  }
  if (payoutInfo.length > 500) {
    throw new ApiError(400, 'invalid_input', 'Thông tin nhận tiền tối đa 500 ký tự.');
  }
  const sums = await getWalletSums(env, userId);
  if (input.amountVnd > sums.availableBalanceVnd) {
    throw new ApiError(
      400,
      'invalid_input',
      `Số dư khả dụng chỉ còn ${sums.availableBalanceVnd.toLocaleString('vi-VN')} đ, không đủ để rút ${input.amountVnd.toLocaleString('vi-VN')} đ.`,
    );
  }
  const inserted = await sbFetch<WalletTransactionRow[]>(env, '/wallet_transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      type: 'withdrawal',
      // Luu SO AM theo quy uoc 0023 (tien ra khoi vi).
      amount_vnd: -input.amountVnd,
      related_order_id: null,
      status: 'pending',
      note: payoutInfo,
    }),
  });
  if (inserted.error) throw serverError(`insertWithdrawal: ${inserted.error.message}`);
  const rows = requireSbOk(inserted, 'insertWithdrawal');
  const tx = rows?.[0] as WalletTransactionRow | undefined;
  if (!tx) throw serverError('insertWithdrawal: no row returned');
  const after = await getWalletSums(env, userId);
  return { transaction: tx, sums: after };
}
