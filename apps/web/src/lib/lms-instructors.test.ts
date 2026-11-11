// Test Task 09 phan 3/4: COURSE MANAGEMENT — phan cong giang vien.
// Chay local, khong can Supabase that. Fake client ghi that vao store
// trong bo nho de kiem tra: dong course_instructors duoc tao / doi vai
// tro / xoa that, audit_logs luon co dong tuong ung, cot giang vien
// dung la `user_id` (khong co `instructor_id` — 0004 muc 20, 0013 muc E).
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assignInstructor,
  listCourseInstructors,
  listInstructorCandidates,
  revokeInstructorAssignment,
  validateInstructorRole,
} from './lms-admin';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, rel), 'utf8');

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private pendingUpdate: Row | null = null;
  private pendingInsert: Row | null = null;
  private pendingDelete = false;
  private committed = false;
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
  order() {
    return this;
  }
  private rows(): Row[] {
    return (this.store[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
  }
  private commit(): Row[] {
    if (this.committed) return this.rows();
    this.committed = true;
    if (this.pendingDelete) {
      const targets = this.rows();
      this.store[this.table] = (this.store[this.table] ?? []).filter((r) => !targets.includes(r));
      return targets;
    }
    if (this.pendingUpdate) {
      const targets = this.rows();
      for (const row of targets) Object.assign(row, this.pendingUpdate);
      return targets;
    }
    return this.rows();
  }
  async maybeSingle() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    return { data: this.commit()[0] ?? null, error: null };
  }
  async single() {
    if (this.pendingInsert) return { data: this.pendingInsert, error: null };
    const rows = this.commit();
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
    else data = this.commit();
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
const GV_LEAD = 'gv-lead';
const GV_AST = 'gv-ast';
const STUDENT_ID = 'student-1';

function baseStore(): Record<string, Row[]> {
  return {
    courses: [{ id: 'c1', slug: 'khoa-1', title: 'Khóa 1', status: 'published' }],
    profiles: [
      { id: ADMIN_ID, role: 'admin', full_name: 'Admin', email: 'admin@test.visfar' },
      { id: GV_LEAD, role: 'instructor', full_name: 'GV Chính', email: 'lead@test.visfar' },
      { id: GV_AST, role: 'instructor', full_name: 'GV Trợ', email: 'ast@test.visfar' },
      { id: STUDENT_ID, role: 'student', full_name: 'Học viên', email: 'hv@test.visfar' },
    ],
    user_roles: [
      { user_id: ADMIN_ID, role: 'admin' },
      { user_id: GV_LEAD, role: 'instructor' },
      { user_id: GV_AST, role: 'instructor' },
      { user_id: STUDENT_ID, role: 'student' },
    ],
    course_instructors: [],
    audit_logs: [],
  };
}

describe('assignInstructor — admin phan cong giang vien', () => {
  it('gan moi tro giang: insert dung user_id/role/assigned_by + audit instructor.assign', async () => {
    const store = baseStore();
    const res = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST, role: 'assistant',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.roleChanged).toBe(false);
    expect(store.course_instructors).toHaveLength(1);
    const row = store.course_instructors[0];
    expect(row.course_id).toBe('c1');
    expect(row.user_id).toBe(GV_AST);
    expect(row.role).toBe('assistant');
    expect(row.assigned_by).toBe(ADMIN_ID);
    expect(row).not.toHaveProperty('instructor_id');
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('instructor.assign');
    expect(store.audit_logs[0].actor_id).toBe(ADMIN_ID);
    expect(store.audit_logs[0].target_id).toBe(row.id);
    expect((store.audit_logs[0].details as Row).role_changed).toBe(false);
  });
  it('gan lead moi khi chua co lead -> ok', async () => {
    const store = baseStore();
    const res = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_LEAD, role: 'lead',
    });
    expect(res.status).toBe('ok');
    expect(store.course_instructors[0].role).toBe('lead');
  });
  it('da gan dung vai tro -> loi, khong tao trung, khong ghi audit', async () => {
    const store = baseStore();
    store.course_instructors = [
      { id: 'a1', course_id: 'c1', user_id: GV_AST, role: 'assistant', assigned_by: ADMIN_ID },
    ];
    const res = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST, role: 'assistant',
    });
    expect(res.status).toBe('error');
    expect(store.course_instructors).toHaveLength(1);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('da gan roi doi vai tro -> update role + audit ghi previous_role', async () => {
    const store = baseStore();
    store.course_instructors = [
      { id: 'a1', course_id: 'c1', user_id: GV_AST, role: 'assistant', assigned_by: ADMIN_ID },
    ];
    const res = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST, role: 'lead',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.roleChanged).toBe(true);
    expect(store.course_instructors).toHaveLength(1);
    expect(store.course_instructors[0].role).toBe('lead');
    expect(store.audit_logs).toHaveLength(1);
    expect((store.audit_logs[0].details as Row).previous_role).toBe('assistant');
    expect((store.audit_logs[0].details as Row).role_changed).toBe(true);
  });
  it('da co lead khac -> gan lead moi loi (moi khoa 1 lead)', async () => {
    const store = baseStore();
    store.course_instructors = [
      { id: 'a1', course_id: 'c1', user_id: GV_LEAD, role: 'lead', assigned_by: ADMIN_ID },
    ];
    const res = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST, role: 'lead',
    });
    expect(res.status).toBe('error');
    expect(store.course_instructors).toHaveLength(1);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('tai khoan khong co vai tro giang vien -> loi', async () => {
    const store = baseStore();
    const res = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: STUDENT_ID, role: 'assistant',
    });
    expect(res.status).toBe('error');
    expect(store.course_instructors).toHaveLength(0);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('vai tro giang vien chi co trong cache profiles.role van gan duoc', async () => {
    const store = baseStore();
    store.user_roles = [{ user_id: ADMIN_ID, role: 'admin' }];
    const res = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST, role: 'assistant',
    });
    expect(res.status).toBe('ok');
  });
  it('khoa / tai khoan khong ton tai, role sai -> loi', async () => {
    const store = baseStore();
    const noCourse = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'khong-co', userId: GV_AST, role: 'assistant',
    });
    expect(noCourse.status).toBe('error');
    const noUser = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: 'khong-co', role: 'assistant',
    });
    expect(noUser.status).toBe('error');
    const badRole = await assignInstructor(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST, role: 'teacher',
    });
    expect(badRole.status).toBe('error');
    expect(store.course_instructors).toHaveLength(0);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('validateInstructorRole: chi lead/assistant', () => {
    expect(validateInstructorRole('lead')).toBe(true);
    expect(validateInstructorRole('assistant')).toBe(true);
    expect(validateInstructorRole('teacher')).toBe(false);
    expect(validateInstructorRole(undefined)).toBe(false);
  });
});

describe('revokeInstructorAssignment — admin thu hoi phan cong', () => {
  it('xoa dong phan cong that + audit instructor.revoke', async () => {
    const store = baseStore();
    store.course_instructors = [
      { id: 'a1', course_id: 'c1', user_id: GV_AST, role: 'assistant', assigned_by: ADMIN_ID },
    ];
    const res = await revokeInstructorAssignment(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST,
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.assignmentId).toBe('a1');
    expect(store.course_instructors).toHaveLength(0);
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('instructor.revoke');
    expect(store.audit_logs[0].target_id).toBe('a1');
    expect((store.audit_logs[0].details as Row).role).toBe('assistant');
  });
  it('chua duoc phan cong -> loi, khong ghi audit', async () => {
    const store = baseStore();
    const res = await revokeInstructorAssignment(makeClient(store), {
      adminId: ADMIN_ID, courseId: 'c1', userId: GV_AST,
    });
    expect(res.status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
  });
});

describe('listCourseInstructors / listInstructorCandidates', () => {
  it('list giang vien cua khoa kem ho ten/email tu profiles join', async () => {
    const store = baseStore();
    store.course_instructors = [
      {
        id: 'a1', course_id: 'c1', user_id: GV_LEAD, role: 'lead',
        assigned_by: ADMIN_ID, assigned_at: '2026-11-01T00:00:00Z',
        profiles: { full_name: 'GV Chính', email: 'lead@test.visfar' },
      },
    ];
    const items = await listCourseInstructors(makeClient(store), 'c1');
    expect(items).toHaveLength(1);
    expect(items[0].fullName).toBe('GV Chính');
    expect(items[0].email).toBe('lead@test.visfar');
    expect(items[0].role).toBe('lead');
    expect(items[0].assignmentId).toBe('a1');
    expect(await listCourseInstructors(makeClient(store), 'khoa-khac')).toHaveLength(0);
  });
  it('candidates: chi nguoi co role instructor o user_roles', async () => {
    const store = baseStore();
    const items = await listInstructorCandidates(makeClient(store));
    expect(items.map((c) => c.userId).sort()).toEqual([GV_AST, GV_LEAD].sort());
    expect(items.find((c) => c.userId === GV_LEAD)?.fullName).toBe('GV Chính');
  });
  it('candidates: user_roles rong -> fallback sang cache profiles.role', async () => {
    const store = baseStore();
    store.user_roles = [];
    const items = await listInstructorCandidates(makeClient(store));
    expect(items.map((c) => c.userId).sort()).toEqual([GV_AST, GV_LEAD].sort());
  });
});

describe('phan cong giang vien — route + UI noi vao trang admin (static)', () => {
  it('route GET/POST/DELETE deu qua getAdminContext, ghi audit qua lib', () => {
    const list = readSrc('../app/api/admin/courses/[courseId]/instructors/route.ts');
    expect(list).toContain('getAdminContext');
    expect(list).toContain('assignInstructor');
    expect(list).toContain('listCourseInstructors');
    const del = readSrc('../app/api/admin/courses/[courseId]/instructors/[userId]/route.ts');
    expect(del).toContain('getAdminContext');
    expect(del).toContain('revokeInstructorAssignment');
    const cand = readSrc('../app/api/admin/instructors/route.ts');
    expect(cand).toContain('getAdminContext');
    expect(cand).toContain('listInstructorCandidates');
  });
  it('lib ghi audit instructor.assign / instructor.revoke; khong dung cot instructor_id', () => {
    const src = readSrc('./lms-admin.ts');
    expect(src).toContain("action: 'instructor.assign'");
    expect(src).toContain("action: 'instructor.revoke'");
    // Bo comment giai thich (noi ten cot sai de canh bao): code that khong duoc dung cot do.
    const codeOnly = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(codeOnly).not.toContain('instructor_id');
    expect(src).toContain(".from('course_instructors')");
    expect(src).toContain(".eq('user_id', input.userId)");
  });
  it('trang chi tiet khoa noi AdminInstructors; cay noi dung lay content/video de sua bai', () => {
    const page = readSrc('../app/admin/khoa-hoc/[courseId]/page.tsx');
    expect(page).toContain('AdminInstructors');
    expect(page).toContain('listCourseInstructors');
    expect(page).toContain('listInstructorCandidates');
    const lib = readSrc('./lms-admin.ts');
    expect(lib).toContain('content, video_url, file_url');
    const tree = readSrc('../components/admin/AdminContentTree.tsx');
    expect(tree).toContain('ModuleEditForm');
    expect(tree).toContain('LessonEditForm');
    expect(tree).toContain('ResourceEditForm');
  });
});
