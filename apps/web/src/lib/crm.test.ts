// Test Task 09 (phan 4/4): CRM + audit log.
// Chay local, khong can Supabase that. Fake client ghi that vao store
// trong bo nho: doi trang thai lead that, tuong tac luu that, audit
// log luon co dong tuong ung; phan loai CRM suy ra dung tu don hang /
// ghi danh that trong store.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUDIT_ACTION_LABELS,
  addLeadInteraction,
  auditActionLabel,
  classifyLead,
  fetchAuditLogs,
  fetchCrmLeads,
  fetchLeadDetail,
  updateLeadStatus,
  validateInteractionInput,
  type LeadRow,
  type LeadSignals,
} from './crm';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, rel), 'utf8');

type Row = Record<string, unknown>;

function matchesOr(row: Row, expr: string): boolean {
  // Chi ho tro dang 'col.ilike.%q%,col.ilike.%q%' (crm.ts chi dung dang nay).
  return expr.split(',').some((part) => {
    const m = part.match(/^(\w+)\.ilike\.%(.*)%$/);
    if (!m) return false;
    const value = String(row[m[1]] ?? '');
    const needle = m[2].replace(/\\([%_\\])/g, '$1').toLowerCase();
    return value.toLowerCase().includes(needle);
  });
}

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private orExpr: string | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private rangeFrom = 0;
  private rangeTo = Number.POSITIVE_INFINITY;
  private pendingUpdate: Row | null = null;
  private pendingInsert: Row | null = null;
  private pendingDelete = false;
  private applied = false;
  constructor(
    private store: Record<string, Row[]>,
    private table: string,
  ) {}
  select() {
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  or(expr: string) {
    this.orExpr = expr;
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  limit(n: number) {
    this.rangeTo = this.rangeFrom + n - 1;
    return this;
  }
  private rows(): Row[] {
    let out = (this.store[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.orExpr) out = out.filter((r) => matchesOr(r, this.orExpr as string));
    if (this.orderCol) {
      const col = this.orderCol;
      out = [...out].sort((a, b) => {
        const av = String(a[col] ?? '');
        const bv = String(b[col] ?? '');
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return out.slice(this.rangeFrom, this.rangeTo + 1);
  }
  private applyWrite(): Row[] {
    if (this.applied) return this.rows();
    this.applied = true;
    if (this.pendingDelete) {
      const targets = this.rows();
      this.store[this.table] = (this.store[this.table] ?? []).filter((r) => !targets.includes(r));
      return targets;
    }
    if (!this.pendingUpdate) return this.rows();
    const targets = this.rows();
    for (const row of targets) Object.assign(row, this.pendingUpdate);
    return targets;
  }
  async maybeSingle() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    return { data: this.applyWrite()[0] ?? null, error: null };
  }
  async single() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    const rows = this.applyWrite();
    if (rows.length === 0) return { data: null, error: { message: 'No rows found' } };
    return { data: rows[0], error: null };
  }
  update(values: Row) {
    this.pendingUpdate = values;
    return this;
  }
  insert(values: Row) {
    const row: Row = { id: `gen-${Math.random().toString(36).slice(2, 10)}`, ...values };
    (this.store[this.table] ??= []).push(row);
    this.pendingInsert = row;
    return this;
  }
  delete() {
    this.pendingDelete = true;
    return this;
  }
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    let data: unknown;
    if (this.pendingInsert) data = [this.pendingInsert];
    else if (this.pendingUpdate || this.pendingDelete) data = this.applyWrite();
    else data = this.rows();
    return Promise.resolve({ data, error: null }).then(onF, onR);
  }
}

function makeClient(store: Record<string, Row[]>): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } }, error: null }) },
    from(table: string) {
      return new FakeQuery(store, table);
    },
  } as unknown as SupabaseClient;
}

const ADMIN_ID = 'admin-1';
const NOW = Date.parse('2026-11-10T12:00:00+07:00');

function leadRow(over: Partial<Row> = {}): Row {
  return {
    id: 'lead-1',
    reference_code: 'VF-0001',
    full_name: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'a@example.com',
    province: 'Hà Nội',
    course_id: null,
    course_interest_text: 'Thấu Hiểu Nội Tâm',
    source: 'visfar-academy',
    status: 'new',
    notes: null,
    created_at: '2026-11-10T00:00:00+07:00',
    updated_at: '2026-11-10T00:00:00+07:00',
    courses: null,
    ...over,
  };
}

function signals(over: Partial<LeadSignals> = {}): LeadSignals {
  return {
    paidOrderCount: 0,
    enrollmentCount: 0,
    hasActiveEnrollment: false,
    hasCompletedEnrollment: false,
    lastInteractionAt: null,
    ...over,
  };
}

function baseStore(): Record<string, Row[]> {
  return {
    leads: [leadRow()],
    lead_interactions: [],
    profiles: [{ id: 'user-1', full_name: 'Nguyễn Văn A', email: 'a@example.com', phone: '0901234567' }],
    enrollments: [],
    orders: [],
    audit_logs: [],
    courses: [],
  };
}

describe('classifyLead — phan loai CRM (8 nhom)', () => {
  const lead = leadRow() as unknown as LeadRow;
  it('lead moi: status new, khong don/ghi danh -> new', () => {
    expect(classifyLead(lead, signals(), NOW)).toBe('new');
  });
  it('da tu van / da dang ky theo status', () => {
    expect(classifyLead({ ...lead, status: 'contacted' }, signals(), NOW)).toBe('contacted');
    expect(classifyLead({ ...lead, status: 'enrolled' }, signals(), NOW)).toBe('enrolled');
  });
  it('da mua / dang hoc / hoan thanh theo don + ghi danh', () => {
    expect(classifyLead(lead, signals({ paidOrderCount: 1 }), NOW)).toBe('purchased');
    expect(classifyLead(lead, signals({ hasActiveEnrollment: true, enrollmentCount: 1 }), NOW)).toBe('learning');
    expect(classifyLead(lead, signals({ hasCompletedEnrollment: true, enrollmentCount: 1 }), NOW)).toBe('completed');
  });
  it('khach quay lai: >= 2 don da tra hoac >= 2 ghi danh', () => {
    expect(classifyLead(lead, signals({ paidOrderCount: 2 }), NOW)).toBe('returning');
    expect(classifyLead(lead, signals({ enrollmentCount: 2, hasActiveEnrollment: true }), NOW)).toBe('returning');
  });
  it('khong hoat dong: closed/spam, hoac tao > 30 ngay khong tuong tac', () => {
    expect(classifyLead({ ...lead, status: 'closed' }, signals(), NOW)).toBe('inactive');
    expect(classifyLead({ ...lead, status: 'spam' }, signals(), NOW)).toBe('inactive');
    const old = { ...lead, created_at: '2026-09-01T00:00:00+07:00' };
    expect(classifyLead(old, signals(), NOW)).toBe('inactive');
    // Co tuong tac gan day -> van la lead moi (chua bo roi).
    expect(
      classifyLead(old, signals({ lastInteractionAt: '2026-11-09T00:00:00+07:00' }), NOW),
    ).toBe('new');
  });
  it('uu tien: hoan thanh thang dang hoc, dang hoc thang da mua', () => {
    expect(
      classifyLead(
        lead,
        signals({ paidOrderCount: 1, hasActiveEnrollment: true, hasCompletedEnrollment: true, enrollmentCount: 1 }),
        NOW,
      ),
    ).toBe('completed');
  });
});

describe('fetchCrmLeads — danh sach + loc + phan loai tu du lieu that', () => {
  it('tra lead kem category; co don paid -> purchased', async () => {
    const store = baseStore();
    store.orders = [{ id: 'o1', user_id: 'user-1', status: 'paid' }];
    const res = await fetchCrmLeads(makeClient(store), {});
    expect(res.error).toBeUndefined();
    expect(res.leads).toHaveLength(1);
    expect(res.leads[0].category).toBe('purchased');
    expect(res.leads[0].lead.full_name).toBe('Nguyễn Văn A');
  });
  it('loc theo status + tim kiem theo ten/SDT/email/ma', async () => {
    const store = baseStore();
    store.leads.push(
      leadRow({ id: 'lead-2', full_name: 'Trần Thị B', phone: '0912345678', email: 'b@example.com', reference_code: 'VF-0002', status: 'contacted' }),
    );
    const byStatus = await fetchCrmLeads(makeClient(store), { status: 'contacted' });
    expect(byStatus.leads).toHaveLength(1);
    expect(byStatus.leads[0].lead.id).toBe('lead-2');
    const bySearch = await fetchCrmLeads(makeClient(store), { search: '0912345678' });
    expect(bySearch.leads).toHaveLength(1);
    expect(bySearch.leads[0].lead.id).toBe('lead-2');
    const byCategory = await fetchCrmLeads(makeClient(store), { category: 'contacted' });
    expect(byCategory.leads).toHaveLength(1);
    expect(byCategory.leads[0].lead.id).toBe('lead-2');
  });
  it('khong co lead -> danh sach rong, khong loi (empty state)', async () => {
    const store = baseStore();
    store.leads = [];
    const res = await fetchCrmLeads(makeClient(store), {});
    expect(res.leads).toEqual([]);
    expect(res.error).toBeUndefined();
  });
});

describe('updateLeadStatus — doi trang thai + audit lead.status', () => {
  it('new -> contacted: status doi that + audit ghi cu/moi', async () => {
    const store = baseStore();
    const res = await updateLeadStatus(makeClient(store), {
      adminId: ADMIN_ID, leadId: 'lead-1', status: 'contacted', note: 'Đã gọi tư vấn',
    });
    expect(res.status).toBe('ok');
    expect(store.leads[0].status).toBe('contacted');
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('lead.status');
    expect(store.audit_logs[0].actor_id).toBe(ADMIN_ID);
    expect((store.audit_logs[0].details as Row).previous_status).toBe('new');
    expect((store.audit_logs[0].details as Row).new_status).toBe('contacted');
  });
  it('status khong hop le / trung trang thai cu / lead khong co -> loi, khong ghi audit', async () => {
    const store = baseStore();
    expect((await updateLeadStatus(makeClient(store), { adminId: ADMIN_ID, leadId: 'lead-1', status: 'da-mua' })).status).toBe('error');
    expect((await updateLeadStatus(makeClient(store), { adminId: ADMIN_ID, leadId: 'lead-1', status: 'new' })).status).toBe('error');
    expect((await updateLeadStatus(makeClient(store), { adminId: ADMIN_ID, leadId: 'khong-co', status: 'contacted' })).status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
    expect(store.leads[0].status).toBe('new');
  });
});

describe('addLeadInteraction — ghi tuong tac + audit lead.interaction', () => {
  it('ghi day du ai/khi nao/kenh/noi dung/ket qua + audit', async () => {
    const store = baseStore();
    const res = await addLeadInteraction(makeClient(store), {
      adminId: ADMIN_ID, leadId: 'lead-1', channel: 'zalo', content: 'Gửi lộ trình, hẹn gọi lại thứ 5', outcome: 'follow_up',
    });
    expect(res.status).toBe('ok');
    expect(store.lead_interactions).toHaveLength(1);
    const it = store.lead_interactions[0];
    expect(it.lead_id).toBe('lead-1');
    expect(it.actor_id).toBe(ADMIN_ID);
    expect(it.channel).toBe('zalo');
    expect(it.content).toBe('Gửi lộ trình, hẹn gọi lại thứ 5');
    expect(it.outcome).toBe('follow_up');
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('lead.interaction');
  });
  it('validate: kenh sai / noi dung rong / qua dai / ket qua sai -> loi, khong luu', async () => {
    const store = baseStore();
    expect(validateInteractionInput({ channel: 'sms', content: 'x' })).not.toBeNull();
    expect(validateInteractionInput({ channel: 'phone', content: '   ' })).not.toBeNull();
    expect(validateInteractionInput({ channel: 'phone', content: 'a'.repeat(2001) })).not.toBeNull();
    expect(validateInteractionInput({ channel: 'phone', content: 'ok', outcome: 'da-mua' })).not.toBeNull();
    expect(validateInteractionInput({ channel: 'phone', content: 'ok', outcome: 'interested' })).toBeNull();
    const res = await addLeadInteraction(makeClient(store), {
      adminId: ADMIN_ID, leadId: 'lead-1', channel: 'sms', content: 'x',
    });
    expect(res.status).toBe('error');
    expect(store.lead_interactions).toHaveLength(0);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('lead khong ton tai -> loi', async () => {
    const store = baseStore();
    const res = await addLeadInteraction(makeClient(store), {
      adminId: ADMIN_ID, leadId: 'khong-co', channel: 'phone', content: 'Gọi',
    });
    expect(res.status).toBe('error');
  });
});

describe('fetchLeadDetail — ho so lead', () => {
  it('tra lead + tuong tac + ghi danh/don + phan loai', async () => {
    const store = baseStore();
    store.lead_interactions = [
      { id: 'it-1', lead_id: 'lead-1', actor_id: ADMIN_ID, channel: 'phone', content: 'Đã tư vấn', outcome: 'interested', created_at: '2026-11-10T10:00:00+07:00' },
    ];
    store.enrollments = [{ id: 'e1', user_id: 'user-1', course_id: 'c1', status: 'active', enrolled_at: '2026-11-09T00:00:00+07:00', completed_at: null, courses: { title: 'Khóa 1' } }];
    store.orders = [{ id: 'o1', user_id: 'user-1', course_id: 'c1', amount_vnd: 0, status: 'paid', reference_code: 'ORD-1', created_at: '2026-11-09T00:00:00+07:00' }];
    const { detail, error } = await fetchLeadDetail(makeClient(store), 'lead-1');
    expect(error).toBeUndefined();
    expect(detail?.lead.full_name).toBe('Nguyễn Văn A');
    expect(detail?.interactions).toHaveLength(1);
    expect(detail?.interactions[0].channel).toBe('phone');
    expect(detail?.enrollments).toHaveLength(1);
    expect(detail?.orders).toHaveLength(1);
    expect(detail?.category).toBe('learning');
    expect(detail?.profile?.id).toBe('user-1');
  });
  it('lead khong ton tai -> error', async () => {
    const store = baseStore();
    const { detail, error } = await fetchLeadDetail(makeClient(store), 'khong-co');
    expect(detail).toBeNull();
    expect(error).toBeTruthy();
  });
});

describe('fetchAuditLogs — loc theo action / actor / tu khoa', () => {
  function auditStore(): Record<string, Row[]> {
    return {
      leads: [],
      lead_interactions: [],
      profiles: [
        { id: ADMIN_ID, full_name: 'Admin Visfar', email: 'admin@visfar.test' },
        { id: 'admin-2', full_name: 'Admin Hai', email: 'hai@visfar.test' },
      ],
      enrollments: [],
      orders: [],
      audit_logs: [
        { id: 'a1', actor_id: ADMIN_ID, action: 'enrollment.grant', target_type: 'enrollment', target_id: 'e1', details: {}, created_at: '2026-11-10T10:00:00+07:00' },
        { id: 'a2', actor_id: 'admin-2', action: 'order.refund', target_type: 'order', target_id: 'o1', details: {}, created_at: '2026-11-10T11:00:00+07:00' },
        { id: 'a3', actor_id: ADMIN_ID, action: 'lead.status', target_type: 'lead', target_id: 'lead-1', details: {}, created_at: '2026-11-10T12:00:00+07:00' },
      ],
    };
  }
  it('khong loc: tra het, moi nhat truoc, kem ten actor', async () => {
    const { logs, error } = await fetchAuditLogs(makeClient(auditStore()), {});
    expect(error).toBeUndefined();
    expect(logs).toHaveLength(3);
    expect(logs[0].action).toBe('lead.status');
    expect(logs[0].actorName).toBe('Admin Visfar');
    expect(logs[1].actorName).toBe('Admin Hai');
  });
  it('loc theo action va actor', async () => {
    const byAction = await fetchAuditLogs(makeClient(auditStore()), { action: 'order.refund' });
    expect(byAction.logs).toHaveLength(1);
    expect(byAction.logs[0].targetType).toBe('order');
    const byActor = await fetchAuditLogs(makeClient(auditStore()), { actorId: 'admin-2' });
    expect(byActor.logs).toHaveLength(1);
    expect(byActor.logs[0].action).toBe('order.refund');
  });
  it('tim kiem theo action / doi tuong', async () => {
    const res = await fetchAuditLogs(makeClient(auditStore()), { search: 'lead' });
    expect(res.logs).toHaveLength(1);
    expect(res.logs[0].action).toBe('lead.status');
  });
  it('khong co log -> rong, khong loi', async () => {
    const store = auditStore();
    store.audit_logs = [];
    const { logs, error } = await fetchAuditLogs(makeClient(store), {});
    expect(logs).toEqual([]);
    expect(error).toBeUndefined();
  });
});

describe('nhan hanh dong audit + migration 0017 (static)', () => {
  it('moi thao tac quan tri quan trong deu co nhan tieng Viet', () => {
    for (const action of [
      'enrollment.grant', 'enrollment.revoke', 'user.role.change',
      'instructor.assign', 'instructor.revoke', 'course.update',
      'order.refund', 'submission.grade', 'certificate.issue',
      'certificate.revoke', 'lead.status', 'lead.interaction',
    ]) {
      expect(auditActionLabel(action)).not.toBe(action);
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
    }
    expect(auditActionLabel('hanh-dong-la')).toBe('hanh-dong-la');
  });
  it('migration 0020 tao bang lead_interactions + policy hoan tra', () => {
    const sql = readSrc('../../../../supabase/migrations/0020_lead_interactions.sql');
    expect(sql).toContain('create table if not exists public.lead_interactions');
    expect(sql).toContain('lead_interactions_admin_all');
    expect(sql).toContain('orders_admin_update');
    expect(sql).toContain("check (channel in ('phone', 'zalo', 'email', 'in_person', 'other'))");
  });
  it('audit da co san o cac lib khac (khong them trung)', () => {
    // Tang/thu hoi khoa + sap xep: lms-admin.ts
    expect(readSrc('./lms-admin.ts')).toContain("action: 'enrollment.grant'");
    expect(readSrc('./lms-admin.ts')).toContain("action: 'enrollment.revoke'");
    expect(readSrc('./lms-admin.ts')).toContain("action: 'instructor.assign'");
    expect(readSrc('./lms-admin.ts')).toContain("action: 'instructor.revoke'");
    expect(readSrc('./lms-admin.ts')).toContain("action: 'order.refund'");
    // Doi role: admin-users.ts (phan khac cua Task 09)
    expect(readSrc('./admin-users.ts')).toContain("action: 'user.role.change'");
    // Cap/thu hoi chung chi: certificates.ts
    expect(readSrc('./certificates.ts')).toContain("action: 'certificate.issue'");
    expect(readSrc('./certificates.ts')).toContain("action: 'certificate.revoke'");
    // Cham bai: route reviews
    expect(
      readSrc('../app/api/v1/assignments/[id]/submissions/[submissionId]/reviews/route.ts'),
    ).toContain("action: 'submission.grade'");
    // Xuat ban / an khoa: di qua course.update o route PUT
    expect(readSrc('../app/api/admin/courses/[courseId]/route.ts')).toContain("action: 'course.update'");
  });
});
