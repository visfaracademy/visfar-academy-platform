// Workers API — Visfar Academy (Module 2).
// Base da chot: https://visfaracademy.netlify.app/api/v1 (DECISIONS.md
// Task 02 QĐ 8). Router nay chay ca o workers.dev lan domain chinh thuc.
//
// Endpoints:
//   POST /api/v1/leads    — tao lead tu van (khong can JWT)
//   POST /api/v1/progress — luu tien do hoc (can JWT Supabase)
//   GET  /api/health     — kiem tra song that (khong can JWT)
//   GET  /api/v1/health  — alias cua /api/health
//
// Payment & Commerce (Task 10 — them 10/11/2026):
//   POST /api/v1/orders, GET /api/v1/orders/:id,
//   POST /api/v1/orders/:id/cancel, POST /api/v1/my/orders/:id/refund-request,
//   GET /api/v1/my/orders,
//   GET  /api/v1/my/transactions, POST /api/v1/coupons/validate,
//   GET  /api/v1/membership-plans, POST /api/v1/my/enrollments,
//   POST /api/v1/webhooks/sepay (+ alias /api/webhooks/sepay),
//   GET  /api/v1/admin/orders, POST /api/v1/admin/orders/:id/mark-paid,
//   POST /api/v1/admin/orders/:id/refund,
//   POST /api/v1/admin/orders/expire-sweep,
//   GET|POST /api/v1/admin/coupons, PATCH /api/v1/admin/coupons/:id,
//   GET|POST /api/v1/admin/membership-plans, GET /api/v1/admin/payments
//
// Lich hen + Tiep thi lien ket / Vi (Task 12 — them 11/11/2026):
//   GET   /api/v1/appointments, POST /api/v1/appointments,
//   PATCH /api/v1/appointments/:id,
//   GET   /api/v1/referrals/me, GET /api/v1/referrals/validate?code=,
//   POST  /api/v1/referrals/claim, POST /api/v1/referrals/withdraw
//
// AI Mentor (Prompt 12 — them 11/11/2026, che do tim kiem thong minh
// vi chua co key AI — xem handlers/ai-mentor.ts):
//   POST  /api/v1/ai-mentor/ask (can JWT; 20 cau/gio/user),
//   GET   /api/v1/ai-mentor/sessions,
//   GET   /api/v1/ai-mentor/sessions/:id,
//   PATCH /api/v1/ai-mentor/messages/:id/feedback
//
// Email / Newsletter (Task 11 — noi route 11/11/2026, QA-18-FUNC-01):
//   POST /api/v1/newsletter — dang ky nhan tin (khong can JWT)
//   GET|POST /api/v1/newsletter/unsubscribe?token=... — huy dang ky
//   POST /api/webhooks/resend — webhook Resend (xac minh chu ky Svix)
//   GET  /api/admin/reports/email — tra cuu email_logs (JWT + admin)
//
// Dinh dang response thong nhat (API_ARCHITECTURE.md §7):
//   ok: { ok:true, ... } / loi: { ok:false, error:"ma_loi", message:"..." }
// Khong bao gio tra ok:true gia: chi 201/200 khi ghi DB da xac nhan.
import type { Env } from './env';
import { ApiError, jsonError } from './errors';
import { handleCreateLead } from './handlers/leads';
import { handleHealth } from './handlers/health';
import { handleSaveProgress } from './handlers/progress';
import {
  handleCancelOrder,
  handleCreateOrder,
  handleEnrollFree,
  handleGetMyOrders,
  handleGetMyTransactions,
  handleGetOrder,
  handleListMembershipPlans,
  handleRequestRefund,
  handleSepayWebhook,
  handleValidateCoupon,
} from './handlers/payments';
import {
  handleAdminCreateCoupon,
  handleAdminCreatePlan,
  handleAdminExpireSweep,
  handleAdminListCoupons,
  handleAdminListOrders,
  handleAdminListPayments,
  handleAdminListPlans,
  handleAdminMarkPaid,
  handleAdminRefund,
  handleAdminUpdateCoupon,
} from './handlers/payments-admin';
import {
  handleCreateAppointment,
  handleListAppointments,
  handlePatchAppointment,
} from './handlers/appointments';
import {
  handleClaimReferral,
  handleGetMyReferral,
  handleRequestWithdrawal,
  handleValidateReferralCode,
} from './handlers/referrals';
import {
  handleAiMentorFeedback,
  handleAskAiMentor,
  handleGetAiMentorSession,
  handleListAiMentorSessions,
} from './handlers/ai-mentor';
import { handleAdminEmailLogs } from './email/logs';
import { handleSubscribeNewsletter } from './email/subscribe';
import { handleNewsletterUnsubscribe } from './email/unsubscribe';
import { handleResendWebhook } from './email/webhook';

const DEFAULT_ORIGINS = [
  'https://visfaracademy.netlify.app',
  'http://localhost:3000',
  'http://localhost:3100',
];

function allowedOrigins(env: Env): string[] {
  const raw = (env.ALLOWED_ORIGINS ?? '').trim();
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (!origin) return {};
  if (!allowedOrigins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function withCors(res: Response, req: Request, env: Env): Response {
  const headers = corsHeaders(req, env);
  if (Object.keys(headers).length === 0) return res;
  const out = new Response(res.body, { status: res.status, headers: res.headers });
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

export async function handleRequest(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  // Preflight CORS.
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req, env) });
  }

  try {
    let res: Response;
    const seg = path.split('/').filter(Boolean);
    // seg = ['api','v1','orders',':id',...] hoac ['api','webhooks','sepay'].
    const orderId =
      seg.length >= 4 && seg[0] === 'api' && seg[1] === 'v1' && seg[2] === 'orders'
        ? decodeURIComponent(seg[3] as string)
        : null;
    const adminOrderId =
      seg.length >= 5 && seg[0] === 'api' && seg[1] === 'v1' && seg[2] === 'admin' && seg[3] === 'orders'
        ? decodeURIComponent(seg[4] as string)
        : null;
    const couponId =
      seg.length >= 5 && seg[0] === 'api' && seg[1] === 'v1' && seg[2] === 'admin' && seg[3] === 'coupons'
        ? decodeURIComponent(seg[4] as string)
        : null;
    const appointmentId =
      seg.length === 4 && seg[0] === 'api' && seg[1] === 'v1' && seg[2] === 'appointments'
        ? decodeURIComponent(seg[3] as string)
        : null;
    const aiMentorSessionId =
      seg.length === 5 && seg[0] === 'api' && seg[1] === 'v1' && seg[2] === 'ai-mentor' && seg[3] === 'sessions'
        ? decodeURIComponent(seg[4] as string)
        : null;
    const aiMentorMessageId =
      seg.length === 6 &&
      seg[0] === 'api' &&
      seg[1] === 'v1' &&
      seg[2] === 'ai-mentor' &&
      seg[3] === 'messages' &&
      seg[5] === 'feedback'
        ? decodeURIComponent(seg[4] as string)
        : null;
    if (method === 'POST' && path === '/api/v1/leads') {
      res = await handleCreateLead(req, env);
    } else if (method === 'POST' && path === '/api/v1/progress') {
      res = await handleSaveProgress(req, env);
    } else if (method === 'GET' && (path === '/api/health' || path === '/api/v1/health')) {
      res = await handleHealth(req, env);
    } else if (method === 'POST' && path === '/api/v1/orders') {
      res = await handleCreateOrder(req, env);
    } else if (method === 'GET' && orderId && seg.length === 4) {
      res = await handleGetOrder(req, env, orderId);
    } else if (method === 'POST' && orderId && seg.length === 5 && seg[4] === 'cancel') {
      res = await handleCancelOrder(req, env, orderId);
    } else if (
      method === 'POST' &&
      seg.length === 6 &&
      seg[0] === 'api' &&
      seg[1] === 'v1' &&
      seg[2] === 'my' &&
      seg[3] === 'orders' &&
      seg[5] === 'refund-request'
    ) {
      res = await handleRequestRefund(req, env, decodeURIComponent(seg[4] as string));
    } else if (method === 'GET' && path === '/api/v1/my/orders') {
      res = await handleGetMyOrders(req, env);
    } else if (method === 'GET' && path === '/api/v1/my/transactions') {
      res = await handleGetMyTransactions(req, env);
    } else if (method === 'POST' && path === '/api/v1/coupons/validate') {
      res = await handleValidateCoupon(req, env);
    } else if (method === 'GET' && path === '/api/v1/membership-plans') {
      res = await handleListMembershipPlans(req, env);
    } else if (method === 'POST' && path === '/api/v1/my/enrollments') {
      res = await handleEnrollFree(req, env);
    } else if (
      method === 'POST' &&
      (path === '/api/v1/webhooks/sepay' || path === '/api/webhooks/sepay')
    ) {
      res = await handleSepayWebhook(req, env);
    } else if (method === 'GET' && path === '/api/v1/admin/orders') {
      res = await handleAdminListOrders(req, env);
    } else if (method === 'POST' && adminOrderId && seg.length === 6 && seg[5] === 'mark-paid') {
      res = await handleAdminMarkPaid(req, env, adminOrderId);
    } else if (method === 'POST' && adminOrderId && seg.length === 6 && seg[5] === 'refund') {
      res = await handleAdminRefund(req, env, adminOrderId);
    } else if (method === 'POST' && path === '/api/v1/admin/orders/expire-sweep') {
      res = await handleAdminExpireSweep(req, env);
    } else if (method === 'GET' && path === '/api/v1/admin/coupons') {
      res = await handleAdminListCoupons(req, env);
    } else if (method === 'POST' && path === '/api/v1/admin/coupons') {
      res = await handleAdminCreateCoupon(req, env);
    } else if (method === 'PATCH' && couponId && seg.length === 5) {
      res = await handleAdminUpdateCoupon(req, env, couponId);
    } else if (method === 'GET' && path === '/api/v1/admin/membership-plans') {
      res = await handleAdminListPlans(req, env);
    } else if (method === 'POST' && path === '/api/v1/admin/membership-plans') {
      res = await handleAdminCreatePlan(req, env);
    } else if (method === 'GET' && path === '/api/v1/admin/payments') {
      res = await handleAdminListPayments(req, env);
    } else if (method === 'GET' && path === '/api/v1/appointments') {
      res = await handleListAppointments(req, env);
    } else if (method === 'POST' && path === '/api/v1/appointments') {
      res = await handleCreateAppointment(req, env);
    } else if (method === 'PATCH' && appointmentId) {
      res = await handlePatchAppointment(req, env, appointmentId);
    } else if (method === 'GET' && path === '/api/v1/referrals/me') {
      res = await handleGetMyReferral(req, env);
    } else if (method === 'GET' && path === '/api/v1/referrals/validate') {
      res = await handleValidateReferralCode(req, env);
    } else if (method === 'POST' && path === '/api/v1/referrals/claim') {
      res = await handleClaimReferral(req, env);
    } else if (method === 'POST' && path === '/api/v1/ai-mentor/ask') {
      res = await handleAskAiMentor(req, env);
    } else if (method === 'GET' && path === '/api/v1/ai-mentor/sessions') {
      res = await handleListAiMentorSessions(req, env);
    } else if (method === 'GET' && aiMentorSessionId) {
      res = await handleGetAiMentorSession(req, env, aiMentorSessionId);
    } else if (method === 'PATCH' && aiMentorMessageId) {
      res = await handleAiMentorFeedback(req, env, aiMentorMessageId);
    } else if (method === 'POST' && path === '/api/v1/referrals/withdraw') {
      res = await handleRequestWithdrawal(req, env);
    } else if (method === 'POST' && path === '/api/v1/newsletter') {
      res = await handleSubscribeNewsletter(env, req);
    } else if (
      (method === 'GET' || method === 'POST') &&
      path === '/api/v1/newsletter/unsubscribe'
    ) {
      res = await handleNewsletterUnsubscribe(env, req);
    } else if (method === 'POST' && path === '/api/webhooks/resend') {
      res = await handleResendWebhook(env, req);
    } else if (method === 'GET' && path === '/api/admin/reports/email') {
      res = await handleAdminEmailLogs(env, req);
    } else {
      throw new ApiError(404, 'not_found', 'Không tìm thấy đường dẫn này.');
    }
    return withCors(res, req, env);
  } catch (err) {
    if (err instanceof ApiError) {
      return withCors(jsonError(err), req, env);
    }
    try {
      console.error('[visfar-api] unhandled:', err instanceof Error ? err.message : String(err));
    } catch {
      // Bo qua.
    }
    return withCors(
      jsonError(new ApiError(500, 'server_error', 'Hệ thống đang bận. Vui lòng thử lại sau.')),
      req,
      env,
    );
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return handleRequest(req, env);
  },
};
