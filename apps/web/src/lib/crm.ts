// CRM + nhat ky quan tri (audit log) — Task 09 phan 4/4.
//
// Nguon su that: Supabase that (leads, enrollments, orders,
// audit_logs, lead_interactions). Moi ham nhan SupabaseClient da mang
// JWT cua admin (xem supabase-server.ts) va PHAI duoc goi sau
// requireAdmin() o route / layout. Khong co du lieu mau, khong gia
// lap: chua co dong nao thi tra danh sach rong + empty state o page.
//
// Trang thai lead goc trong DB (0001, CHECK): 'new' | 'contacted' |
// 'enrolled' | 'closed' | 'spam'. Phan loai CRM hien thi (8 nhom)
// la SUY RA tu trang thai + don hang / ghi danh that cua cung
// nguoi (khop bang email, roi SDT) — xem classifyLead():
//   lead moi / da tu van / da dang ky / da mua / dang hoc /
//   hoan thanh / khong hoat dong / khach hang quay lai.
//
// Lich su tuong tac luu o bang lead_interactions — CHUA CO trong DB
// hien tai: can migration 0017 (file da viet, CHUA CHAY — can
// coordinator duyet + ap staging truoc). Khi bang chua co, ham doc
// tuong tac tra interactionsError (page hien canh bao, khong vo);
// ham ghi tuong tac tra loi ro rang thay vi gia vo thanh cong.
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Lead
// ---------------------------------------------------------------------------

export const LEAD_STATUSES = ['new', 'contacted', 'enrolled', 'closed', 'spam'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  enrolled: 'Đã ghi danh',
  closed: 'Đã đóng',
  spam: 'Spam',
};

export const CRM_CATEGORIES = [
  'new',
  'contacted',
  'enrolled',
  'purchased',
  'learning',
  'completed',
  'inactive',
  'returning',
] as const;
export type CrmCategory = (typeof CRM_CATEGORIES)[number];

export const CRM_CATEGORY_LABELS: Record<CrmCategory, string> = {
  new: 'Lead mới',
  contacted: 'Đã tư vấn',
  enrolled: 'Đã đăng ký',
  purchased: 'Đã mua',
  learning: 'Đang học',
  completed: 'Hoàn thành',
  inactive: 'Không hoạt động',
  returning: 'Khách hàng quay lại',
};

export interface LeadRow {
  id: string;
  reference_code: string;
  full_name: string;
  phone: string;
  email: string;
  province: string;
  course_id: string | null;
  course_interest_text: string | null;
  source: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  courseTitle?: string | null;
}

/** Tin hieu suy ra tu don hang / ghi danh that cua cung mot nguoi. */
export interface LeadSignals {
  paidOrderCount: number;
  enrollmentCount: number;
  hasActiveEnrollment: boolean;
  hasCompletedEnrollment: boolean;
  /** Thoi diem tuong tac gan nhat (ISO) — null khi chua co tuong tac nao. */
  lastInteractionAt: string | null;
}

export const INACTIVE_AFTER_DAYS = 30;

/**
 * Phan loai CRM cho 1 lead — logic thuan, khong can DB (test duoc).
 * Thu tu uu tien: quay lai > hoan thanh > dang hoc > da mua >
 * da dang ky (status) > da tu van (status) > khong hoat dong > moi.
 * "Khong hoat dong": status closed/spam, hoac tao hon 30 ngay ma
 * khong co tuong tac nao trong 30 ngay gan nhat.
 */
export function classifyLead(
  lead: Pick<LeadRow, 'status' | 'created_at'>,
  signals: LeadSignals,
  nowMs: number = Date.now(),
): CrmCategory {
  if (signals.paidOrderCount >= 2 || signals.enrollmentCount >= 2) return 'returning';
  if (signals.hasCompletedEnrollment) return 'completed';
  if (signals.hasActiveEnrollment) return 'learning';
  if (signals.paidOrderCount >= 1) return 'purchased';
  if (lead.status === 'enrolled') return 'enrolled';
  if (lead.status === 'contacted') return 'contacted';
  if (lead.status === 'closed' || lead.status === 'spam') return 'inactive';
  const createdMs = Date.parse(lead.created_at);
  const ageDays = Number.isFinite(createdMs)
    ? (nowMs - createdMs) / (1000 * 60 * 60 * 24)
    : 0;
  const lastMs = signals.lastInteractionAt ? Date.parse(signals.lastInteractionAt) : NaN;
  const idleDays = Number.isFinite(lastMs)
    ? (nowMs - lastMs) / (1000 * 60 * 60 * 24)
    : ageDays;
  if (ageDays > INACTIVE_AFTER_DAYS && idleDays > INACTIVE_AFTER_DAYS) return 'inactive';
  return 'new';
}

export interface ClassifiedLead {
  lead: LeadRow;
  category: CrmCategory;
}

export interface FetchLeadsFilters {
  status?: string;
  category?: string;
  search?: string;
}

/**
 * Gioi han doc de phan loai trong bo nho: phan loai CRM can don
 * hang / ghi danh (khong loc duoc bang 1 query SQL don gian), nen
 * chi doc toi da cap nay roi loc theo nhom trong bo nho.
 */
export const CRM_FETCH_CAP = 200;

export interface FetchLeadsResult {
  leads: ClassifiedLead[];
  /** So lead doc tu DB truoc khi loc theo nhom. */
  fetched: number;
  truncated: boolean;
  error?: string;
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/** Danh sach lead kem phan loai CRM. Loi DB -> { leads: [], error }. */
export async function fetchCrmLeads(
  client: SupabaseClient,
  filters: FetchLeadsFilters = {},
): Promise<FetchLeadsResult> {
  try {
    let query = client
      .from('leads')
      .select(
        'id, reference_code, full_name, phone, email, province, course_id, course_interest_text, source, status, notes, created_at, updated_at, courses(title)',
      );
    if (filters.status && (LEAD_STATUSES as readonly string[]).includes(filters.status)) {
      query = query.eq('status', filters.status);
    }
    const search = (filters.search ?? '').trim();
    if (search) {
      const q = `%${escapeLike(search)}%`;
      query = query.or(
        `full_name.ilike.${q},phone.ilike.${q},email.ilike.${q},reference_code.ilike.${q}`,
      );
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(0, CRM_FETCH_CAP - 1);
    if (error) return { leads: [], fetched: 0, truncated: false, error: error.message };
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const leads: LeadRow[] = rows.map((r) => ({
      id: String(r.id ?? ''),
      reference_code: String(r.reference_code ?? ''),
      full_name: String(r.full_name ?? ''),
      phone: String(r.phone ?? ''),
      email: String(r.email ?? ''),
      province: String(r.province ?? ''),
      course_id: (r.course_id as string | null) ?? null,
      course_interest_text: (r.course_interest_text as string | null) ?? null,
      source: String(r.source ?? ''),
      status: String(r.status ?? ''),
      notes: (r.notes as string | null) ?? null,
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      courseTitle:
        (r.courses as { title?: string } | null)?.title ?? null,
    }));
    const signals = await loadLeadSignals(client, leads);
    const nowMs = Date.now();
    let classified = leads.map((lead) => ({
      lead,
      category: classifyLead(lead, signals.get(lead.id) ?? emptySignals(), nowMs),
    }));
    if (
      filters.category &&
      (CRM_CATEGORIES as readonly string[]).includes(filters.category)
    ) {
      classified = classified.filter((c) => c.category === filters.category);
    }
    return {
      leads: classified,
      fetched: leads.length,
      truncated: leads.length >= CRM_FETCH_CAP,
    };
  } catch (err) {
    return {
      leads: [],
      fetched: 0,
      truncated: false,
      error: err instanceof Error ? err.message : 'Không tải được danh sách lead.',
    };
  }
}

function emptySignals(): LeadSignals {
  return {
    paidOrderCount: 0,
    enrollmentCount: 0,
    hasActiveEnrollment: false,
    hasCompletedEnrollment: false,
    lastInteractionAt: null,
  };
}

/**
 * Nap tin hieu don hang / ghi danh / tuong tac cho 1 lo lead.
 * Khop profile bang email truoc, SDT sau (lead dang ky an danh
 * nen chua chac co profile). Loi o buoc phu -> tin hieu rong
 * (lead van hien, chi phan loai theo status), khong vo ca trang.
 */
async function loadLeadSignals(
  client: SupabaseClient,
  leads: LeadRow[],
): Promise<Map<string, LeadSignals>> {
  const result = new Map<string, LeadSignals>();
  for (const lead of leads) result.set(lead.id, emptySignals());
  if (leads.length === 0) return result;
  try {
    const emails = [...new Set(leads.map((l) => l.email).filter(Boolean))];
    const phones = [...new Set(leads.map((l) => l.phone).filter(Boolean))];
    const profileByKey = new Map<string, string>();
    if (emails.length > 0) {
      const { data } = await client.from('profiles').select('id, email, phone').in('email', emails);
      for (const p of ((data ?? []) as unknown as Array<Record<string, unknown>>)) {
        if (typeof p.email === 'string') profileByKey.set(`email:${p.email}`, String(p.id));
        if (typeof p.phone === 'string') profileByKey.set(`phone:${p.phone}`, String(p.id));
      }
    }
    if (phones.length > 0) {
      const { data } = await client.from('profiles').select('id, email, phone').in('phone', phones);
      for (const p of ((data ?? []) as unknown as Array<Record<string, unknown>>)) {
        if (typeof p.email === 'string') profileByKey.set(`email:${p.email}`, String(p.id));
        if (typeof p.phone === 'string') profileByKey.set(`phone:${p.phone}`, String(p.id));
      }
    }
    const leadProfile = new Map<string, string>();
    for (const lead of leads) {
      const pid = profileByKey.get(`email:${lead.email}`) ?? profileByKey.get(`phone:${lead.phone}`);
      if (pid) leadProfile.set(lead.id, pid);
    }
    const profileIds = [...new Set(leadProfile.values())];
    const orderCount = new Map<string, number>();
    const enrollmentCount = new Map<string, number>();
    const active = new Set<string>();
    const completed = new Set<string>();
    if (profileIds.length > 0) {
      const { data: orders } = await client
        .from('orders')
        .select('user_id, status')
        .in('user_id', profileIds)
        .eq('status', 'paid');
      for (const o of ((orders ?? []) as unknown as Array<Record<string, unknown>>)) {
        const uid = String(o.user_id ?? '');
        orderCount.set(uid, (orderCount.get(uid) ?? 0) + 1);
      }
      const { data: enrollments } = await client
        .from('enrollments')
        .select('user_id, status')
        .in('user_id', profileIds);
      for (const e of ((enrollments ?? []) as unknown as Array<Record<string, unknown>>)) {
        const uid = String(e.user_id ?? '');
        enrollmentCount.set(uid, (enrollmentCount.get(uid) ?? 0) + 1);
        if (e.status === 'active') active.add(uid);
        if (e.status === 'completed') completed.add(uid);
      }
    }
    // Tuong tac gan nhat (can bang 0017; chua co bang -> bo qua).
    try {
      const { data: interactions } = await client
        .from('lead_interactions')
        .select('lead_id, created_at')
        .in('lead_id', leads.map((l) => l.id))
        .order('created_at', { ascending: false });
      for (const it of ((interactions ?? []) as unknown as Array<Record<string, unknown>>)) {
        const sig = result.get(String(it.lead_id));
        if (sig && !sig.lastInteractionAt) sig.lastInteractionAt = String(it.created_at ?? '');
      }
    } catch {
      // Bang chua co (0017 chua chay): phan loai dung tuoi lead.
    }
    for (const [leadId, profileId] of leadProfile) {
      const sig = result.get(leadId);
      if (!sig) continue;
      sig.paidOrderCount = orderCount.get(profileId) ?? 0;
      sig.enrollmentCount = enrollmentCount.get(profileId) ?? 0;
      sig.hasActiveEnrollment = active.has(profileId);
      sig.hasCompletedEnrollment = completed.has(profileId);
    }
    return result;
  } catch {
    return result;
  }
}

// ---------------------------------------------------------------------------
// Tuong tac (lead_interactions — can migration 0017)
// ---------------------------------------------------------------------------

export const INTERACTION_CHANNELS = ['phone', 'zalo', 'email', 'in_person', 'other'] as const;
export type InteractionChannel = (typeof INTERACTION_CHANNELS)[number];

export const INTERACTION_CHANNEL_LABELS: Record<InteractionChannel, string> = {
  phone: 'Điện thoại',
  zalo: 'Zalo',
  email: 'Email',
  in_person: 'Gặp trực tiếp',
  other: 'Kênh khác',
};

export const INTERACTION_OUTCOMES = ['no_answer', 'interested', 'not_interested', 'enrolled', 'follow_up'] as const;
export type InteractionOutcome = (typeof INTERACTION_OUTCOMES)[number];

export const INTERACTION_OUTCOME_LABELS: Record<InteractionOutcome, string> = {
  no_answer: 'Không nghe máy',
  interested: 'Quan tâm',
  not_interested: 'Không quan tâm',
  enrolled: 'Đã ghi danh',
  follow_up: 'Cần theo dõi thêm',
};

export interface LeadInteraction {
  id: string;
  leadId: string;
  actorId: string | null;
  channel: string;
  content: string;
  outcome: string | null;
  createdAt: string;
  actorName?: string | null;
}

/** Validate noi dung tuong tac — tra loi tieng Viet, null khi hop le. */
export function validateInteractionInput(input: {
  channel?: unknown;
  content?: unknown;
  outcome?: unknown;
}): string | null {
  if (
    typeof input.channel !== 'string' ||
    !(INTERACTION_CHANNELS as readonly string[]).includes(input.channel)
  ) {
    return 'Kênh tương tác phải là điện thoại, Zalo, email, gặp trực tiếp hoặc kênh khác.';
  }
  if (typeof input.content !== 'string' || input.content.trim().length === 0) {
    return 'Vui lòng nhập nội dung tương tác.';
  }
  if (input.content.trim().length > 2000) {
    return 'Nội dung tương tác tối đa 2000 ký tự.';
  }
  if (
    input.outcome !== undefined &&
    input.outcome !== null &&
    input.outcome !== '' &&
    (typeof input.outcome !== 'string' ||
      !(INTERACTION_OUTCOMES as readonly string[]).includes(input.outcome))
  ) {
    return 'Kết quả tương tác không hợp lệ.';
  }
  return null;
}

export type AddInteractionResult =
  | { status: 'ok'; interactionId: string; auditWarning?: string }
  | { status: 'error'; message: string };

/**
 * Ghi 1 tuong tac vao lead_interactions + audit 'lead.interaction'.
 * Moi tuong tac ghi ai (actor_id), khi nao (created_at), kenh,
 * noi dung, ket qua. Loi khi bang 0017 chua chay -> tra loi ro,
 * khong gia vo da luu.
 */
export async function addLeadInteraction(
  client: SupabaseClient,
  input: {
    adminId: string;
    leadId: string;
    channel: string;
    content: string;
    outcome?: string | null;
  },
): Promise<AddInteractionResult> {
  const validationError = validateInteractionInput(input);
  if (validationError) return { status: 'error', message: validationError };
  const { data: lead, error: leadErr } = await client
    .from('leads')
    .select('id')
    .eq('id', input.leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return { status: 'error', message: leadErr?.message ?? 'Không tìm thấy lead.' };
  }
  const { data, error } = await client
    .from('lead_interactions')
    .insert({
      lead_id: input.leadId,
      actor_id: input.adminId,
      channel: input.channel,
      content: input.content.trim(),
      outcome: input.outcome ? input.outcome : null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return {
      status: 'error',
      message:
        error?.message ??
        'Không lưu được tương tác. Có thể bảng lead_interactions chưa được tạo (migration 0017 chưa chạy).',
    };
  }
  const interactionId = (data as { id: string }).id;
  const { error: auditErr } = await client.from('audit_logs').insert({
    actor_id: input.adminId,
    action: 'lead.interaction',
    target_type: 'lead',
    target_id: input.leadId,
    details: { interaction_id: interactionId, channel: input.channel, outcome: input.outcome ?? null },
  });
  return {
    status: 'ok',
    interactionId,
    ...(auditErr
      ? { auditWarning: `Đã lưu tương tác nhưng chưa ghi được audit log: ${auditErr.message}` }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Doi trang thai lead
// ---------------------------------------------------------------------------

export type UpdateLeadStatusResult =
  | { status: 'ok'; previousStatus: string; auditWarning?: string }
  | { status: 'error'; message: string };

/** Doi trang thai lead + audit 'lead.status' (ghi trang thai cu/moi). */
export async function updateLeadStatus(
  client: SupabaseClient,
  input: { adminId: string; leadId: string; status: string; note?: string },
): Promise<UpdateLeadStatusResult> {
  if (!(LEAD_STATUSES as readonly string[]).includes(input.status)) {
    return { status: 'error', message: 'Trạng thái lead không hợp lệ.' };
  }
  const { data: lead, error: leadErr } = await client
    .from('leads')
    .select('id, status')
    .eq('id', input.leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return { status: 'error', message: leadErr?.message ?? 'Không tìm thấy lead.' };
  }
  const previousStatus = String((lead as { status: string }).status ?? '');
  if (previousStatus === input.status) {
    return { status: 'error', message: 'Lead đã ở trạng thái này rồi.' };
  }
  const { error: updErr } = await client
    .from('leads')
    .update({ status: input.status })
    .eq('id', input.leadId);
  if (updErr) return { status: 'error', message: updErr.message };
  const { error: auditErr } = await client.from('audit_logs').insert({
    actor_id: input.adminId,
    action: 'lead.status',
    target_type: 'lead',
    target_id: input.leadId,
    details: {
      previous_status: previousStatus,
      new_status: input.status,
      note: input.note?.trim() ? input.note.trim() : null,
    },
  });
  return {
    status: 'ok',
    previousStatus,
    ...(auditErr
      ? { auditWarning: `Đã đổi trạng thái nhưng chưa ghi được audit log: ${auditErr.message}` }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Ho so chi tiet 1 lead
// ---------------------------------------------------------------------------

export interface LeadEnrollmentItem {
  id: string;
  courseId: string;
  courseTitle: string | null;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
}

export interface LeadOrderItem {
  id: string;
  courseId: string;
  amountVnd: number;
  status: string;
  referenceCode: string;
  createdAt: string;
}

export interface LeadDetail {
  lead: LeadRow;
  interactions: LeadInteraction[];
  interactionsError?: string;
  profile: { id: string; fullName: string | null; email: string | null; phone: string | null } | null;
  enrollments: LeadEnrollmentItem[];
  orders: LeadOrderItem[];
  auditTrail: AuditLogRow[];
  category: CrmCategory;
}

/** Ho so lead: thong tin + tuong tac + ghi danh / don hang + audit. */
export async function fetchLeadDetail(
  client: SupabaseClient,
  leadId: string,
): Promise<{ detail: LeadDetail | null; error?: string }> {
  try {
    const { data: leadRow, error: leadErr } = await client
      .from('leads')
      .select(
        'id, reference_code, full_name, phone, email, province, course_id, course_interest_text, source, status, notes, created_at, updated_at, courses(title)',
      )
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) return { detail: null, error: leadErr.message };
    if (!leadRow) return { detail: null, error: 'Không tìm thấy lead.' };
    const r = leadRow as unknown as Record<string, unknown>;
    const lead: LeadRow = {
      id: String(r.id ?? ''),
      reference_code: String(r.reference_code ?? ''),
      full_name: String(r.full_name ?? ''),
      phone: String(r.phone ?? ''),
      email: String(r.email ?? ''),
      province: String(r.province ?? ''),
      course_id: (r.course_id as string | null) ?? null,
      course_interest_text: (r.course_interest_text as string | null) ?? null,
      source: String(r.source ?? ''),
      status: String(r.status ?? ''),
      notes: (r.notes as string | null) ?? null,
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      courseTitle: (r.courses as { title?: string } | null)?.title ?? null,
    };

    let interactions: LeadInteraction[] = [];
    let interactionsError: string | undefined;
    try {
      const { data, error } = await client
        .from('lead_interactions')
        .select('id, lead_id, actor_id, channel, content, outcome, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) {
        interactionsError = error.message;
      } else {
        interactions = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((it) => ({
          id: String(it.id ?? ''),
          leadId: String(it.lead_id ?? ''),
          actorId: (it.actor_id as string | null) ?? null,
          channel: String(it.channel ?? ''),
          content: String(it.content ?? ''),
          outcome: (it.outcome as string | null) ?? null,
          createdAt: String(it.created_at ?? ''),
        }));
      }
    } catch (err) {
      interactionsError = err instanceof Error ? err.message : 'Không đọc được lịch sử tương tác.';
    }

    // Profile khop theo email truoc, SDT sau.
    let profile: LeadDetail['profile'] = null;
    for (const col of ['email', 'phone'] as const) {
      const { data } = await client
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq(col, lead[col])
        .maybeSingle();
      const p = data as unknown as Record<string, unknown> | null;
      if (p) {
        profile = {
          id: String(p.id ?? ''),
          fullName: (p.full_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
          phone: (p.phone as string | null) ?? null,
        };
        break;
      }
    }

    let enrollments: LeadEnrollmentItem[] = [];
    let orders: LeadOrderItem[] = [];
    if (profile) {
      const { data: enr } = await client
        .from('enrollments')
        .select('id, course_id, status, enrolled_at, completed_at, courses(title)')
        .eq('user_id', profile.id)
        .order('enrolled_at', { ascending: false });
      enrollments = ((enr ?? []) as unknown as Array<Record<string, unknown>>).map((e) => ({
        id: String(e.id ?? ''),
        courseId: String(e.course_id ?? ''),
        courseTitle: (e.courses as { title?: string } | null)?.title ?? null,
        status: String(e.status ?? ''),
        enrolledAt: String(e.enrolled_at ?? ''),
        completedAt: (e.completed_at as string | null) ?? null,
      }));
      const { data: ord } = await client
        .from('orders')
        .select('id, course_id, amount_vnd, status, reference_code, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      orders = ((ord ?? []) as unknown as Array<Record<string, unknown>>).map((o) => ({
        id: String(o.id ?? ''),
        courseId: String(o.course_id ?? ''),
        amountVnd: typeof o.amount_vnd === 'number' ? o.amount_vnd : 0,
        status: String(o.status ?? ''),
        referenceCode: String(o.reference_code ?? ''),
        createdAt: String(o.created_at ?? ''),
      }));
    }

    const audit = await fetchAuditLogs(client, { search: '', limit: 20 });
    const auditTrail = (audit.logs ?? []).filter(
      (l) => l.targetType === 'lead' && l.targetId === leadId,
    );

    const signals: LeadSignals = {
      paidOrderCount: orders.filter((o) => o.status === 'paid').length,
      enrollmentCount: enrollments.length,
      hasActiveEnrollment: enrollments.some((e) => e.status === 'active'),
      hasCompletedEnrollment: enrollments.some((e) => e.status === 'completed'),
      lastInteractionAt: interactions[0]?.createdAt ?? null,
    };
    return {
      detail: {
        lead,
        interactions,
        ...(interactionsError ? { interactionsError } : {}),
        profile,
        enrollments,
        orders,
        auditTrail,
        category: classifyLead(lead, signals),
      },
    };
  } catch (err) {
    return {
      detail: null,
      error: err instanceof Error ? err.message : 'Không tải được hồ sơ lead.',
    };
  }
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

/** Nhan tieng Viet cho cac hanh dong quan tri quan trong (chua biet -> giu nguyen ma). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'enrollment.grant': 'Tặng khóa học',
  'enrollment.revoke': 'Thu hồi khóa học',
  'user.role.change': 'Đổi vai trò người dùng',
  'user.disable': 'Vô hiệu hóa tài khoản',
  'user.enable': 'Mở lại tài khoản',
  'certificate.issue': 'Cấp chứng chỉ',
  'certificate.revoke': 'Thu hồi chứng chỉ',
  'course.create': 'Tạo khóa học',
  'course.update': 'Sửa khóa học (kể cả xuất bản / ẩn)',
  'module.create': 'Tạo chương',
  'module.update': 'Sửa chương',
  'lesson.create': 'Tạo bài học',
  'lesson.update': 'Sửa bài học',
  'resource.create': 'Thêm tài liệu',
  'resource.update': 'Sửa tài liệu',
  'content.reorder': 'Sắp xếp lại nội dung',
  'assignment.create': 'Tạo bài tập',
  'submission.grade': 'Chấm bài',
  'lead.status': 'Đổi trạng thái lead',
  'lead.interaction': 'Ghi tương tác với lead',
  'instructor.assign': 'Phân công giảng viên',
  'instructor.revoke': 'Gỡ giảng viên khỏi khóa',
  'order.refund': 'Hoàn trả đơn hàng',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export interface FetchAuditLogsFilters {
  action?: string;
  actorId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FetchAuditLogsResult {
  logs: AuditLogRow[];
  error?: string;
}

/** Danh sach audit_logs moi nhat truoc — loc theo action / actor / tu khoa. */
export async function fetchAuditLogs(
  client: SupabaseClient,
  filters: FetchAuditLogsFilters = {},
): Promise<FetchAuditLogsResult> {
  try {
    let query = client
      .from('audit_logs')
      .select('id, actor_id, action, target_type, target_id, details, created_at');
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.actorId) query = query.eq('actor_id', filters.actorId);
    const search = (filters.search ?? '').trim();
    if (search) {
      const q = `%${escapeLike(search)}%`;
      query = query.or(`action.ilike.${q},target_type.ilike.${q}`);
    }
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return { logs: [], error: error.message };
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const actorIds = [...new Set(rows.map((r) => String(r.actor_id ?? '')).filter(Boolean))];
    const names = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', actorIds);
      for (const p of ((profiles ?? []) as unknown as Array<Record<string, unknown>>)) {
        const name = typeof p.full_name === 'string' && p.full_name ? p.full_name : null;
        const email = typeof p.email === 'string' ? p.email : '';
        names.set(String(p.id), name ?? email ?? String(p.id));
      }
    }
    return {
      logs: rows.map((r) => ({
        id: String(r.id ?? ''),
        actorId: (r.actor_id as string | null) ?? null,
        actorName: r.actor_id ? (names.get(String(r.actor_id)) ?? String(r.actor_id)) : null,
        action: String(r.action ?? ''),
        targetType: String(r.target_type ?? ''),
        targetId: (r.target_id as string | null) ?? null,
        details: (r.details as Record<string, unknown> | null) ?? null,
        createdAt: String(r.created_at ?? ''),
      })),
    };
  } catch (err) {
    return {
      logs: [],
      error: err instanceof Error ? err.message : 'Không tải được nhật ký quản trị.',
    };
  }
}
