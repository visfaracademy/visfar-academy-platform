// Handlers tiep thi lien ket + vi — lop HTTP mong (auth / parse body /
// response). Nghiep vu o ../referrals.ts.
//
// Endpoints (dang ky o index.ts):
//   GET  /api/v1/referrals/me        — ma + so du + lich su + nguoi da gioi thieu
//   GET  /api/v1/referrals/validate?code= — cong khai, kiem tra ma ton tai
//   POST /api/v1/referrals/claim     — user moi ghi referrer bang ma
//                                      (goi sau Supabase Auth signUp)
//   POST /api/v1/referrals/withdraw  — yeu cau rut tien (status pending,
//                                      KHONG tu dong chuyen tien)
import type { Env } from '../env';
import { ApiError, jsonOk } from '../errors';
import { requireAuthUser } from '../payments';
import { isSupabaseConfigured } from '../env';
import { readJsonBody } from './payments';
import { getProfileEmail } from '../supabase';
import {
  REFERRAL_CODE_REGEX,
  claimReferral,
  getOrCreateReferralCode,
  getReferralCodeByCode,
  getWalletSums,
  listReferralsByReferrer,
  listWalletTransactions,
  requestWithdrawal,
  type WalletTransactionRow,
} from '../referrals';
import { notConfiguredError, sbFetch, requireSbOk } from '../supabase';

function toWalletView(tx: WalletTransactionRow): Record<string, unknown> {
  return {
    id: tx.id,
    type: tx.type,
    amountVnd: tx.amount_vnd,
    relatedOrderId: tx.related_order_id,
    status: tx.status,
    note: tx.note,
    createdAt: tx.created_at,
  };
}

export async function handleGetMyReferral(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const codeRow = await getOrCreateReferralCode(env, user.userId);
  const sums = await getWalletSums(env, user.userId);
  const history = await listWalletTransactions(env, user.userId, 50);
  const referrals = await listReferralsByReferrer(env, user.userId);

  // Trang thai nguoi duoc gioi thieu: da co don paid + hoa hong da nhan
  // tu don cua ho (tinh tu wallet commission + orders paid).
  const referredIds = referrals
    .map((r) => r.referred_user_id)
    .filter((id): id is string => id !== null);
  const paidByUser = new Map<string, boolean>();
  const commissionByUser = new Map<string, number>();
  if (referredIds.length > 0) {
    const inList = referredIds.map((id) => encodeURIComponent(id)).join(',');
    const paidOrders = await sbFetch<Array<{ id: string; user_id: string }>>(
      env,
      `/orders?select=id,user_id&user_id=in.(${inList})&status=eq.paid`,
    );
    const paidRows = (requireSbOk(paidOrders, 'listPaidOrdersOfReferred') ?? []) as Array<{
      id: string;
      user_id: string;
    }>;
    const paidOrderOwner = new Map<string, string>();
    for (const o of paidRows) {
      paidByUser.set(o.user_id, true);
      paidOrderOwner.set(o.id, o.user_id);
    }
    const commissions = await sbFetch<Array<{ amount_vnd: number; related_order_id: string | null }>>(
      env,
      `/wallet_transactions?select=amount_vnd,related_order_id&user_id=eq.${encodeURIComponent(user.userId)}&type=eq.commission&status=eq.completed&limit=1000`,
    );
    const commissionRows = (requireSbOk(commissions, 'listMyCommissions') ?? []) as Array<{
      amount_vnd: number;
      related_order_id: string | null;
    }>;
    for (const c of commissionRows) {
      if (!c.related_order_id) continue;
      const owner = paidOrderOwner.get(c.related_order_id);
      if (!owner) continue;
      commissionByUser.set(owner, (commissionByUser.get(owner) ?? 0) + c.amount_vnd);
    }
  }
  const referred = [];
  for (const r of referrals) {
    const referredId = r.referred_user_id;
    const profile = referredId ? await getProfileEmail(env, referredId) : null;
    referred.push({
      userId: referredId,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      referralCode: r.referral_code,
      referredAt: r.created_at,
      hasPaidOrder: referredId ? (paidByUser.get(referredId) ?? false) : false,
      commissionEarnedVnd: referredId ? (commissionByUser.get(referredId) ?? 0) : 0,
    });
  }

  return jsonOk({
    referralCode: codeRow.code,
    balanceVnd: sums.completedBalanceVnd,
    availableBalanceVnd: sums.availableBalanceVnd,
    transactions: history.map(toWalletView),
    referred,
  });
}

export async function handleValidateReferralCode(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const raw = (url.searchParams.get('code') ?? '').trim().toUpperCase();
  if (!raw || !REFERRAL_CODE_REGEX.test(raw)) {
    return jsonOk({ valid: false, code: raw || null });
  }
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const found = await getReferralCodeByCode(env, raw);
  return jsonOk({ valid: found !== null, code: raw });
}

export async function handleClaimReferral(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const body = await readJsonBody(req);
  const rawCode = body['code'];
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    throw new ApiError(400, 'invalid_input', 'Vui lòng nhập mã giới thiệu.');
  }
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const { referral, created } = await claimReferral(env, user.userId, rawCode);
  return jsonOk(
    {
      referral: {
        id: referral.id,
        referrerId: referral.referrer_id,
        referredUserId: referral.referred_user_id,
        referralCode: referral.referral_code,
        createdAt: referral.created_at,
      },
      alreadyClaimed: !created,
    },
    created ? 201 : 200,
  );
}

export async function handleRequestWithdrawal(req: Request, env: Env): Promise<Response> {
  const user = await requireAuthUser(env, req);
  const body = await readJsonBody(req);
  const rawAmount = body['amount_vnd'] ?? body['amountVnd'];
  const amountVnd = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
  const payoutInfo =
    typeof body['payout_info'] === 'string'
      ? (body['payout_info'] as string)
      : typeof body['payoutInfo'] === 'string'
        ? (body['payoutInfo'] as string)
        : '';
  if (!isSupabaseConfigured(env)) throw notConfiguredError();
  const { transaction, sums } = await requestWithdrawal(env, user.userId, {
    amountVnd,
    payoutInfo,
  });
  return jsonOk(
    {
      transaction: toWalletView(transaction),
      balanceVnd: sums.completedBalanceVnd,
      availableBalanceVnd: sums.availableBalanceVnd,
      message: 'Đã ghi nhận yêu cầu rút tiền. Quản trị viên sẽ xét duyệt và chuyển khoản thủ công.',
    },
    201,
  );
}
