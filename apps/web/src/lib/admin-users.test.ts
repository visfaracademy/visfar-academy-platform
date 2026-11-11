// Test Task 09 (phan 2/4): ADMIN — quan ly hoc vien.
// Chay local, khong can Supabase that. Fake client ghi that vao store
// trong bo nho: doi role thay user_roles that, vo hieu hoa doi
// profiles.is_disabled that, moi thao tac ghi deu co audit_logs.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accountStatusLabelVi,
  changeUserRole,
  fetchAdminUserDetail,
  isValidAdminUserRole,
  listAdminUsers,
  normalizeUserSearch,
  roleLabelVi,
  setUserDisabled,
} from './admin-users';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, rel), 'utf8');

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private orFilter: ((r: Row) => boolean) | null = null;
  private pendingUpdate: Row | null = null;
  private pendingInsert: Row | null = null;
  private pendingDelete = false;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
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
  or(raw: string) {
    const parts = raw.split(',').map((seg) => {
      const m = /^(\w+)\.ilike\.%(.*)%$/.exec(seg.trim());
      return m ? { col: m[1], needle: m[2].toLowerCase() } : null;
    });
    this.orFilter = (r) =>
      parts.some(
        (p) => p !== null && String(r[p.col] ?? '').toLowerCase().includes(p.needle),
      );
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  delete() {
    this.pendingDelete = true;
    return this;
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
  private rows(): Row[] {
    let out = (this.store[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.orFilter) out = out.filter(this.orFilter);
    return out;
  }
  private applyUpdate(): Row[] {
    if (this.applied) return this.rows();
    this.applied = true;
    if (!this.pendingUpdate) return this.rows();
    const targets = this.rows();
    for (const row of targets) Object.assign(row, this.pendingUpdate);
    return targets;
  }
  private applyDelete(): Row[] {
    if (this.applied) return [];
    this.applied = true;
    const targets = this.rows();
    this.store[this.table] = (this.store[this.table] ?? []).filter((r) => !targets.includes(r));
    return targets;
  }
  async maybeSingle() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    return { data: this.applyUpdate()[0] ?? null, error: null };
  }
  async single() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    const rows = this.applyUpdate();
    if (rows.length === 0) return { data: null, error: { message: 'No rows found' } };
    return { data: rows[0], error: null };
  }
  then(onF: (v: { data: unknown; error: unknown; count: number | null }) => unknown, onR?: (e: unknown) => unknown) {
    let data: unknown;
    let count: number | null = null;
    if (this.pendingInsert) {
      data = [this.pendingInsert];
    } else if (this.pendingDelete) {
      data = this.applyDelete();
    } else if (this.pendingUpdate) {
      data = this.applyUpdate();
    } else {
      const all = this.rows();
      count = all.length;
      data =
        this.rangeFrom !== null && this.rangeTo !== null
          ? all.slice(this.rangeFrom, this.rangeTo + 1)
          : all;
    }
    return Promise.resolve({ data, error: null, count }).then(onF, onR);
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

function baseStore(): Record<string, Row[]> {
  return {
    profiles: [
      { id: 'u1', full_name: 'An Nguyễn', email: 'an@test.vn', phone: '0901111111', province: 'Hà Nội', role: 'student', is_disabled: false, disabled_reason: null, created_at: '2026-11-01T00:00:00Z' },
      { id: 'u2', full_name: 'Bình Trần', email: 'binh@test.vn', phone: '0902222222', province: 'TP.HCM', role: 'instructor', is_disabled: false, disabled_reason: null, created_at: '2026-11-02T00:00:00Z' },
      { id: 'u3', full_name: 'Chi Lê', email: 'chi@test.vn', phone: '0903333333', province: 'Đà Nẵng', role: 'admin', is_disabled: false, disabled_reason: null, created_at: '2026-11-03T00:00:00Z' },
      { id: 'u4', full_name: 'Dũng Phạm', email: 'dung@test.vn', phone: '0904444444', province: 'Hà Nội', role: 'student', is_disabled: true, disabled_at: '2026-11-05T00:00:00Z', disabled_reason: 'Spam', created_at: '2026-11-04T00:00:00Z' },
    ],
    user_roles: [
      { id: 'r1', user_id: 'u1', role: 'student' },
      { id: 'r2', user_id: 'u2', role: 'instructor' },
      { id: 'r3', user_id: 'u3', role: 'admin' },
      { id: 'r4', user_id: 'u4', role: 'student' },
    ],
    courses: [
      { id: 'c1', title: 'Khóa 1', slug: 'khoa-1' },
      { id: 'c2', title: 'Khóa 2', slug: 'khoa-2' },
    ],
    course_modules: [
      { id: 'm1', course_id: 'c1', title: 'Chương 1' },
      { id: 'm2', course_id: 'c1', title: 'Chương 2' },
      { id: 'm3', course_id: 'c2', title: 'Chương 1' },
    ],
    lessons: [
      { id: 'l1', course_module_id: 'm1', type: 'video' },
      { id: 'l2', course_module_id: 'm1', type: 'text' },
      { id: 'l3', course_module_id: 'm2', type: 'video' },
      { id: 'l4', course_module_id: 'm3', type: 'video' },
    ],
    lesson_progress: [
      { lesson_id: 'l1', user_id: 'u1', status: 'completed', progress_percent: 100 },
      { lesson_id: 'l2', user_id: 'u1', status: 'in_progress', progress_percent: 40 },
      { lesson_id: 'l4', user_id: 'u1', status: 'completed', progress_percent: 100 },
    ],
    enrollments: [
      { id: 'e1', user_id: 'u1', course_id: 'c1', status: 'active', enrolled_at: '2026-11-02T00:00:00Z', completed_at: null, granted_by: null, grant_reason: null, courses: { title: 'Khóa 1', slug: 'khoa-1' } },
      { id: 'e2', user_id: 'u1', course_id: 'c2', status: 'completed', enrolled_at: '2026-11-03T00:00:00Z', completed_at: '2026-11-04T00:00:00Z', granted_by: ADMIN_ID, grant_reason: 'Tặng học viên giỏi', courses: { title: 'Khóa 2', slug: 'khoa-2' } },
      { id: 'e3', user_id: 'u2', course_id: 'c1', status: 'active', enrolled_at: '2026-11-02T00:00:00Z', completed_at: null, granted_by: null, grant_reason: null, courses: { title: 'Khóa 1', slug: 'khoa-1' } },
    ],
    orders: [
      { id: 'o1', user_id: 'u1', reference_code: 'VF-001', status: 'paid', amount_vnd: 500000, payment_method: 'bank_transfer', created_at: '2026-11-02T00:00:00Z', paid_at: '2026-11-02T01:00:00Z' },
      { id: 'o2', user_id: 'u1', reference_code: 'VF-002', status: 'pending', amount_vnd: 0, payment_method: 'free', created_at: '2026-11-03T00:00:00Z', paid_at: null },
      { id: 'o3', user_id: 'u2', reference_code: 'VF-003', status: 'paid', amount_vnd: 199000, payment_method: 'sepay', created_at: '2026-11-02T00:00:00Z', paid_at: '2026-11-02T01:00:00Z' },
    ],
    order_items: [
      { id: 'oi1', order_id: 'o1', item_name: 'Khóa 1', unit_price_vnd: 500000, quantity: 1, total_vnd: 500000 },
      { id: 'oi2', order_id: 'o2', item_name: 'Khóa 2', unit_price_vnd: 0, quantity: 1, total_vnd: 0 },
      { id: 'oi3', order_id: 'o3', item_name: 'Khóa 1', unit_price_vnd: 199000, quantity: 1, total_vnd: 199000 },
    ],
    audit_logs: [],
  };
}

describe('nhan + chuan hoa tim kiem', () => {
  it('roleLabelVi / accountStatusLabelVi', () => {
    expect(roleLabelVi('student')).toBe('Học viên');
    expect(roleLabelVi('instructor')).toBe('Giảng viên');
    expect(roleLabelVi('admin')).toBe('Quản trị viên');
    expect(accountStatusLabelVi(false)).toBe('Đang hoạt động');
    expect(accountStatusLabelVi(true)).toBe('Đã vô hiệu hóa');
  });
  it('normalizeUserSearch: cat khoang trang, loai %, gioi han 100 ky tu', () => {
    expect(normalizeUserSearch('  An   Nguyễn  ')).toBe('An Nguyễn');
    expect(normalizeUserSearch('a%b_c\\d')).toBe('abcd');
    expect(normalizeUserSearch('x'.repeat(150))).toHaveLength(100);
    expect(normalizeUserSearch(null)).toBe('');
    expect(isValidAdminUserRole('admin')).toBe(true);
    expect(isValidAdminUserRole('superadmin')).toBe(false);
  });
});

describe('listAdminUsers — danh sach + tim kiem + loc', () => {
  it('khong loc: 4 user kem role, so enrollment, so don', async () => {
    const res = await listAdminUsers(makeClient(baseStore()), {});
    expect(res.total).toBe(4);
    expect(res.users).toHaveLength(4);
    const u1 = res.users.find((u) => u.id === 'u1');
    expect(u1?.roles).toEqual(['student']);
    expect(u1?.enrollmentCount).toBe(2);
    expect(u1?.orderCount).toBe(2);
    expect(u1?.isDisabled).toBe(false);
    expect(res.users.find((u) => u.id === 'u4')?.isDisabled).toBe(true);
  });
  it('tim kiem theo ten / SĐT / email', async () => {
    const store = baseStore();
    expect((await listAdminUsers(makeClient(store), { search: 'Bình Trần' })).users.map((u) => u.id)).toEqual(['u2']);
    expect((await listAdminUsers(makeClient(store), { search: '0904444444' })).users.map((u) => u.id)).toEqual(['u4']);
    expect((await listAdminUsers(makeClient(store), { search: 'test.vn' })).total).toBe(4);
    expect((await listAdminUsers(makeClient(store), { search: 'khong-co-ai' })).total).toBe(0);
  });
  it('loc theo role / trang thai / khoa hoc (ket hop duoc)', async () => {
    const store = baseStore();
    expect((await listAdminUsers(makeClient(store), { role: 'instructor' })).users.map((u) => u.id)).toEqual(['u2']);
    expect((await listAdminUsers(makeClient(store), { status: 'disabled' })).users.map((u) => u.id)).toEqual(['u4']);
    expect((await listAdminUsers(makeClient(store), { status: 'active' })).total).toBe(3);
    expect((await listAdminUsers(makeClient(store), { courseId: 'c1' })).users.map((u) => u.id).sort()).toEqual(['u1', 'u2']);
    expect((await listAdminUsers(makeClient(store), { courseId: 'c2' })).users.map((u) => u.id)).toEqual(['u1']);
    expect((await listAdminUsers(makeClient(store), { role: 'student', courseId: 'c1' })).users.map((u) => u.id)).toEqual(['u1']);
    expect((await listAdminUsers(makeClient(store), { courseId: 'khong-co' })).total).toBe(0);
  });
  it('phan trang: pageSize 2 -> 2 trang, tong 4', async () => {
    const store = baseStore();
    const p1 = await listAdminUsers(makeClient(store), { page: 1, pageSize: 2 });
    const p2 = await listAdminUsers(makeClient(store), { page: 2, pageSize: 2 });
    expect(p1.users).toHaveLength(2);
    expect(p2.users).toHaveLength(2);
    expect(p1.totalPages).toBe(2);
    expect(p1.users[0].id).not.toBe(p2.users[0].id);
  });
  it('store rong -> danh sach rong, total 0', async () => {
    const res = await listAdminUsers(makeClient({ profiles: [], user_roles: [], enrollments: [], orders: [], audit_logs: [] }), {});
    expect(res).toEqual({ users: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  });
});

describe('fetchAdminUserDetail — ho so + enrollment + tien do + don hang', () => {
  it('u1: 2 enrollment kem tien do dung, 2 don kem dong hang', async () => {
    const detail = await fetchAdminUserDetail(makeClient(baseStore()), 'u1');
    expect(detail).not.toBeNull();
    expect(detail?.fullName).toBe('An Nguyễn');
    expect(detail?.roles).toEqual(['student']);
    expect(detail?.isDisabled).toBe(false);
    expect(detail?.enrollments).toHaveLength(2);
    const c1 = detail?.enrollments.find((e) => e.courseId === 'c1');
    // c1 co 3 bai (l1 video hoan thanh, l2 text dang hoc, l3 chua hoc) -> 1/3 = 33%.
    expect(c1?.totalLessons).toBe(3);
    expect(c1?.completedLessons).toBe(1);
    expect(c1?.progressPercent).toBe(33);
    const c2 = detail?.enrollments.find((e) => e.courseId === 'c2');
    expect(c2?.totalLessons).toBe(1);
    expect(c2?.completedLessons).toBe(1);
    expect(c2?.progressPercent).toBe(100);
    expect(c2?.grantReason).toBe('Tặng học viên giỏi');
    expect(detail?.orders).toHaveLength(2);
    expect(detail?.orders.find((o) => o.id === 'o1')?.items).toHaveLength(1);
    expect(detail?.orders.find((o) => o.id === 'o1')?.items[0].itemName).toBe('Khóa 1');
  });
  it('u4: khong enrollment, khong don — mang rong, khong loi', async () => {
    const detail = await fetchAdminUserDetail(makeClient(baseStore()), 'u4');
    expect(detail).not.toBeNull();
    expect(detail?.isDisabled).toBe(true);
    expect(detail?.disabledReason).toBe('Spam');
    expect(detail?.enrollments).toEqual([]);
    expect(detail?.orders).toEqual([]);
  });
  it('user khong ton tai -> null', async () => {
    expect(await fetchAdminUserDetail(makeClient(baseStore()), 'khong-co')).toBeNull();
  });
});

describe('changeUserRole — doi role qua user_roles + audit', () => {
  it('student -> instructor: user_roles thay that + audit user.role.change', async () => {
    const store = baseStore();
    const res = await changeUserRole(makeClient(store), {
      adminId: ADMIN_ID, userId: 'u1', newRole: 'instructor', reason: 'Mời làm giảng viên',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.previousRoles).toEqual(['student']);
    expect(res.newRole).toBe('instructor');
    expect(store.user_roles.filter((r) => r.user_id === 'u1').map((r) => r.role)).toEqual(['instructor']);
    expect(store.user_roles.filter((r) => r.user_id === 'u1')[0].granted_by).toBe(ADMIN_ID);
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('user.role.change');
    expect(store.audit_logs[0].actor_id).toBe(ADMIN_ID);
    expect(store.audit_logs[0].target_id).toBe('u1');
    expect((store.audit_logs[0].details as Row).previous_roles).toEqual(['student']);
    expect((store.audit_logs[0].details as Row).new_role).toBe('instructor');
  });
  it('role khong hop le / tu doi role cua minh / da co role do -> loi, khong ghi audit', async () => {
    const store = baseStore();
    expect((await changeUserRole(makeClient(store), { adminId: ADMIN_ID, userId: 'u1', newRole: 'superadmin' })).status).toBe('error');
    expect((await changeUserRole(makeClient(store), { adminId: 'u3', userId: 'u3', newRole: 'student' })).status).toBe('error');
    expect((await changeUserRole(makeClient(store), { adminId: ADMIN_ID, userId: 'u1', newRole: 'student' })).status).toBe('error');
    expect((await changeUserRole(makeClient(store), { adminId: ADMIN_ID, userId: 'khong-co', newRole: 'admin' })).status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
    expect(store.user_roles).toHaveLength(4);
  });
  it('ly do qua 500 ky tu -> loi', async () => {
    const res = await changeUserRole(makeClient(baseStore()), {
      adminId: ADMIN_ID, userId: 'u1', newRole: 'admin', reason: 'x'.repeat(501),
    });
    expect(res.status).toBe('error');
  });
  it('user chua co dong user_roles nao van doi duoc', async () => {
    const store = baseStore();
    store.user_roles = store.user_roles.filter((r) => r.user_id !== 'u1');
    const res = await changeUserRole(makeClient(store), {
      adminId: ADMIN_ID, userId: 'u1', newRole: 'admin',
    });
    expect(res.status).toBe('ok');
    expect(store.user_roles.filter((r) => r.user_id === 'u1').map((r) => r.role)).toEqual(['admin']);
  });
});

describe('setUserDisabled — vo hieu hoa thay vi xoa + audit', () => {
  it('vo hieu hoa u1: is_disabled + ly do + disabled_at + audit user.disable, don/enrollment giu nguyen', async () => {
    const store = baseStore();
    const res = await setUserDisabled(makeClient(store), {
      adminId: ADMIN_ID, userId: 'u1', disabled: true, reason: 'Vi phạm quy định cộng đồng',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.isDisabled).toBe(true);
    const p = store.profiles.find((x) => x.id === 'u1');
    expect(p?.is_disabled).toBe(true);
    expect(p?.disabled_reason).toBe('Vi phạm quy định cộng đồng');
    expect(typeof p?.disabled_at).toBe('string');
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('user.disable');
    expect((store.audit_logs[0].details as Row).reason).toBe('Vi phạm quy định cộng đồng');
    // Don hang + enrollment khong bi xoa / thu hoi theo.
    expect(store.orders.filter((o) => o.user_id === 'u1')).toHaveLength(2);
    expect(store.enrollments.filter((e) => e.user_id === 'u1')).toHaveLength(2);
  });
  it('mo lai u4: is_disabled false, ly do xoa, audit user.enable', async () => {
    const store = baseStore();
    const res = await setUserDisabled(makeClient(store), {
      adminId: ADMIN_ID, userId: 'u4', disabled: false, reason: 'Khiếu nại được chấp nhận',
    });
    expect(res.status).toBe('ok');
    const p = store.profiles.find((x) => x.id === 'u4');
    expect(p?.is_disabled).toBe(false);
    expect(p?.disabled_reason).toBeNull();
    expect(p?.disabled_at).toBeNull();
    expect(store.audit_logs[0].action).toBe('user.enable');
  });
  it('da vo hieu hoa roi / dang hoat dong roi / thieu ly do / tu vo hieu hoa / khong ton tai -> loi', async () => {
    const store = baseStore();
    expect((await setUserDisabled(makeClient(store), { adminId: ADMIN_ID, userId: 'u4', disabled: true, reason: 'Lại khóa' })).status).toBe('error');
    expect((await setUserDisabled(makeClient(store), { adminId: ADMIN_ID, userId: 'u1', disabled: false, reason: 'Mở lại' })).status).toBe('error');
    expect((await setUserDisabled(makeClient(store), { adminId: ADMIN_ID, userId: 'u1', disabled: true, reason: '   ' })).status).toBe('error');
    expect((await setUserDisabled(makeClient(store), { adminId: 'u3', userId: 'u3', disabled: true, reason: 'Tự khóa mình' })).status).toBe('error');
    expect((await setUserDisabled(makeClient(store), { adminId: ADMIN_ID, userId: 'khong-co', disabled: true, reason: 'Khóa' })).status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
    expect(store.profiles.find((x) => x.id === 'u1')?.is_disabled).toBe(false);
  });
});

describe('guard tinh: khong xoa tai khoan + migration 0021', () => {
  it('admin-users.ts khong co lenh xoa tai khoan (bo qua dong comment giai thich)', () => {
    const src = readSrc('./admin-users.ts')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(src).not.toContain("from('profiles').delete");
    expect(src).not.toContain('auth.admin.deleteUser');
    expect(src).not.toContain('deleteUser(');
    expect(readSrc('./admin-users.ts')).toContain('KHONG XOA TAI KHOAN');
  });
  it('migration 0021 them 3 cot vo hieu hoa, khong xoa du lieu', () => {
    const sql = readSrc('../../../../supabase/migrations/0021_admin_user_disable.sql');
    expect(sql).toContain('is_disabled');
    expect(sql).toContain('disabled_at');
    expect(sql).toContain('disabled_reason');
    expect(sql).toContain('idx_profiles_is_disabled');
    expect(sql.toLowerCase()).not.toContain('drop table');
    expect(sql.toLowerCase()).not.toContain('delete from');
  });
  it('lms-admin.ts co 3 action audit moi cho quan ly user', () => {
    const src = readSrc('./lms-admin.ts');
    expect(src).toContain("'user.role.change'");
    expect(src).toContain("'user.disable'");
    expect(src).toContain("'user.enable'");
  });
});
