// Truy cap Supabase cho email — TASK 11.
//
// Ghi doc qua PostgREST bang service-role (Workers), tai su dung
// sbFetch/requireSbOk tu ../supabase.ts. Chi ghi PII toi thieu can
// thiet cho nghiep vu (email nguoi nhan — ban than bang email_logs /
// newsletter_subscribers da luu email theo thiet ke). Khong ghi SDT,
// ho ten vao log.
// Cac ham deu nem ApiError 502 (upstream_error) khi Supabase loi —
// handler khong bao gio tra ok:true gia.

import type { Env } from '../env';
import { requireSbOk, sbFetch, type SbResult } from '../supabase';
import type { SubscriberRow } from './consent';

/** Them dong newsletter_subscribers moi. Tra SbResult de caller xu ly
    trung UNIQUE (23505) khi 2 request song song cung email. */
export async function insertSubscriber(
  env: Env,
  email: string,
  source: string,
): Promise<SbResult<SubscriberRow[]>> {
  return sbFetch<SubscriberRow[]>(env, '/newsletter_subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      status: 'subscribed',
      source,
    }),
  });
}

/** Dang ky lai email da huy truoc do: mo lai status + xoa cac dau
    chan (unsubscribed_at / ly do / hard_bounced_at) vi nguoi dung
    tu dang ky lai mot cach tuong minh. */
export async function reactivateSubscriber(env: Env, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const result = await sbFetch<unknown>(
    env,
    `/newsletter_subscribers?email=eq.${encodeURIComponent(normalized)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'subscribed',
        unsubscribed_at: null,
        unsubscribe_reason: null,
        hard_bounced_at: null,
      }),
    },
  );
  requireSbOk(result, 'reactivateSubscriber');
}

const SUBSCRIBER_SELECT =
  'email,status,unsubscribed_at,unsubscribe_reason,hard_bounced_at';

/** Lay dong newsletter_subscribers theo email (lowercase, trim). Null = chua co dong. */
export async function getSubscriberByEmail(
  env: Env,
  email: string,
): Promise<SubscriberRow | null> {
  const normalized = email.trim().toLowerCase();
  const result = await sbFetch<SubscriberRow[]>(
    env,
    `/newsletter_subscribers?select=${SUBSCRIBER_SELECT}&email=eq.${encodeURIComponent(normalized)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getSubscriberByEmail');
  return rows && rows.length > 0 ? (rows[0] as SubscriberRow) : null;
}

/** Huy dang ky: status='unsubscribed' + unsubscribed_at + ly do (neu co). */
export async function markSubscriberUnsubscribed(
  env: Env,
  email: string,
  reason: string | null,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const patch: Record<string, unknown> = {
    status: 'unsubscribed',
    unsubscribed_at: new Date().toISOString(),
    unsubscribe_reason: reason,
  };
  const result = await sbFetch<unknown>(
    env,
    `/newsletter_subscribers?email=eq.${encodeURIComponent(normalized)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    },
  );
  requireSbOk(result, 'markSubscriberUnsubscribed');
}

/**
 * Danh dau hard bounce / spam complaint: neu da co dong thi set
 * hard_bounced_at (+ doi status neu la complaint); neu chua co dong
 * thi tao dong chan (status='unsubscribed', source='bounce') de dia
 * chi nay khong bao gio nhan marketing/care ve sau.
 */
export async function suppressSubscriber(
  env: Env,
  email: string,
  reason: 'hard_bounce' | 'spam_complaint',
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const existing = await getSubscriberByEmail(env, normalized);
  if (existing) {
    const patch: Record<string, unknown> = { unsubscribe_reason: reason };
    if (reason === 'hard_bounce') patch['hard_bounced_at'] = now;
    if (reason === 'spam_complaint') {
      patch['status'] = 'unsubscribed';
      patch['unsubscribed_at'] = now;
    }
    const result = await sbFetch<unknown>(
      env,
      `/newsletter_subscribers?email=eq.${encodeURIComponent(normalized)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      },
    );
    requireSbOk(result, 'suppressSubscriber');
    return;
  }
  const insert: Record<string, unknown> = {
    email: normalized,
    status: 'unsubscribed',
    source: 'bounce',
    unsubscribed_at: now,
    unsubscribe_reason: reason,
  };
  if (reason === 'hard_bounce') insert['hard_bounced_at'] = now;
  const result = await sbFetch<unknown>(env, '/newsletter_subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(insert),
  });
  requireSbOk(result, 'suppressSubscriber');
}

// ---------------------------------------------------------------------------
// email_logs
// ---------------------------------------------------------------------------

export type EmailLogStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'complained'
  | 'skipped';

export interface EmailLogRecord {
  id: string;
  to_email: string;
  template: string;
  resend_id: string | null;
  status: EmailLogStatus;
  error_message: string | null;
  sent_at: string | null;
  attempts: number;
  next_retry_at: string | null;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsertEmailLogInput {
  to_email: string;
  template: string;
  status: EmailLogStatus;
  resend_id?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
  attempts?: number;
  next_retry_at?: string | null;
  related_type?: string | null;
  related_id?: string | null;
}

/** Ghi 1 dong email_logs. Tra id cua dong vua tao. */
export async function insertEmailLog(
  env: Env,
  input: InsertEmailLogInput,
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    to_email: input.to_email.trim().toLowerCase(),
    template: input.template,
    status: input.status,
    resend_id: input.resend_id ?? null,
    error_message: input.error_message ?? null,
    sent_at: input.sent_at ?? null,
    attempts: input.attempts ?? 1,
    next_retry_at: input.next_retry_at ?? null,
    related_type: input.related_type ?? null,
    related_id: input.related_id ?? null,
  };
  const result = await sbFetch<Array<{ id: string }>>(env, '/email_logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const rows = requireSbOk(result, 'insertEmailLog');
  if (!rows || rows.length === 0) throw new Error('insertEmailLog: no row returned');
  return { id: (rows[0] as { id: string }).id };
}

/** Cap nhat 1 dong email_logs theo id. */
export async function updateEmailLog(
  env: Env,
  id: string,
  patch: Partial<Pick<EmailLogRecord, 'status' | 'resend_id' | 'error_message' | 'sent_at' | 'attempts' | 'next_retry_at'>>,
): Promise<void> {
  const result = await sbFetch<unknown>(
    env,
    `/email_logs?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    },
  );
  requireSbOk(result, 'updateEmailLog');
}

/**
 * Cap nhat email_logs theo resend_id (webhook Resend). Tra true neu
 * co dong duoc cap nhat, false neu khong tim thay dong nao.
 */
export async function updateEmailLogByResendId(
  env: Env,
  resendId: string,
  patch: Partial<Pick<EmailLogRecord, 'status' | 'error_message' | 'sent_at'>>,
): Promise<boolean> {
  const found = await sbFetch<EmailLogRecord[]>(
    env,
    `/email_logs?select=id&resend_id=eq.${encodeURIComponent(resendId)}&limit=1`,
  );
  const rows = requireSbOk(found, 'updateEmailLogByResendId');
  if (!rows || rows.length === 0) return false;
  await updateEmailLog(env, (rows[0] as EmailLogRecord).id, patch);
  return true;
}

export interface FindEmailLogsFilters {
  /** Email nguoi nhan (to_email). */
  toEmail?: string;
  template?: string;
  status?: string;
  /** ISO — loc created_at >= from. */
  from?: string;
  /** ISO — loc created_at <= to. */
  to?: string;
  page?: number;
  limit?: number;
}

export interface FindEmailLogsResult {
  logs: EmailLogRecord[];
  page: number;
  limit: number;
  /** true = co the con trang sau (lay limit+1 de biet). */
  hasMore: boolean;
}

/** Tra cuu log theo user (to_email) / template / status / khoang thoi gian. */
export async function findEmailLogs(
  env: Env,
  filters: FindEmailLogsFilters,
): Promise<FindEmailLogsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;
  const params: string[] = [
    'select=id,to_email,template,resend_id,status,error_message,sent_at,attempts,next_retry_at,related_type,related_id,created_at,updated_at',
    'order=created_at.desc',
    `limit=${limit + 1}`,
    `offset=${offset}`,
  ];
  if (filters.toEmail) {
    params.push(`to_email=eq.${encodeURIComponent(filters.toEmail.trim().toLowerCase())}`);
  }
  if (filters.template) params.push(`template=eq.${encodeURIComponent(filters.template)}`);
  if (filters.status) params.push(`status=eq.${encodeURIComponent(filters.status)}`);
  if (filters.from) params.push(`created_at=gte.${encodeURIComponent(filters.from)}`);
  if (filters.to) params.push(`created_at=lte.${encodeURIComponent(filters.to)}`);
  const result = await sbFetch<EmailLogRecord[]>(env, `/email_logs?${params.join('&')}`);
  const rows = requireSbOk(result, 'findEmailLogs') ?? [];
  const hasMore = rows.length > limit;
  return { logs: hasMore ? rows.slice(0, limit) : rows, page, limit, hasMore };
}

/**
 * Dem email da gui that trong ngay (gio Viet Nam): so dong tao tu
 * dau ngay co status sent/delivered/bounced/complained (tuc da toi
 * Resend). Dem toi da `cap` dong (du de biet co cham nguong khong).
 */
export async function countEmailsSentToday(
  env: Env,
  dayStartIso: string,
  cap = 80,
): Promise<number> {
  const result = await sbFetch<Array<{ id: string }>>(
    env,
    `/email_logs?select=id&created_at=gte.${encodeURIComponent(dayStartIso)}` +
      `&status=in.(sent,delivered,bounced,complained)&limit=${cap}`,
  );
  const rows = requireSbOk(result, 'countEmailsSentToday') ?? [];
  return rows.length;
}

/** Da gui canh bao quota Resend trong ngay (theo gio VN) chua — de chi canh bao 1 lan/ngay. */
export async function hasQuotaAlertBeenSentToday(
  env: Env,
  dayStartIso: string,
  alertEmail: string,
): Promise<boolean> {
  const result = await sbFetch<Array<{ id: string }>>(
    env,
    `/email_logs?select=id&created_at=gte.${encodeURIComponent(dayStartIso)}` +
      `&template=eq.system_alert_resend_quota&to_email=eq.${encodeURIComponent(alertEmail.trim().toLowerCase())}&limit=1`,
  );
  const rows = requireSbOk(result, 'hasQuotaAlertBeenSentToday') ?? [];
  return rows.length > 0;
}

/** Role cua user (profiles.role — cache dong bo tu user_roles). */
export async function getProfileRole(env: Env, userId: string): Promise<string | null> {
  const result = await sbFetch<Array<{ role: string }>>(
    env,
    `/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const rows = requireSbOk(result, 'getProfileRole');
  return rows && rows.length > 0 ? ((rows[0] as { role: string }).role ?? null) : null;
}

/** Moc dau ngay hom nay theo gio Viet Nam (ISO UTC). */
export function startOfTodayVnIso(nowMs: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : 0;
  };
  // 00:00 gio VN = 17:00 UTC hom truoc.
  const startUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), 0, 0, 0) - 7 * 60 * 60 * 1000;
  return new Date(startUtcMs).toISOString();
}

export type { SbResult };
