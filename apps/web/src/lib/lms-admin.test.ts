// Test Task 07 (phan 3/4): ADMIN — tang khoa / thu hoi / sap xep / validation.
// Chay local, khong can Supabase that. Fake client ghi that vao store
// trong bo nho de kiem tra: status doi that, chung chi bi thu hoi,
// audit_logs luon co dong tuong ung.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  grantEnrollment,
  reorderContent,
  revokeEnrollment,
  validateCourseInput,
  validateGrantReason,
  validateLessonInput,
  validateModuleInput,
  validateResourceInput,
} from './lms-admin';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, rel), 'utf8');

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private pendingUpdate: Row | null = null;
  private pendingInsert: Row | null = null;
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
  order() {
    return this;
  }
  limit() {
    return this;
  }
  private rows(): Row[] {
    return (this.store[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
  }
  private applyUpdate(): Row[] {
    if (this.applied) return this.rows();
    this.applied = true;
    if (!this.pendingUpdate) return this.rows();
    const targets = this.rows();
    for (const row of targets) Object.assign(row, this.pendingUpdate);
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
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    let data: unknown;
    if (this.pendingInsert) data = [this.pendingInsert];
    else if (this.pendingUpdate) data = this.applyUpdate();
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
const STUDENT_ID = 'student-1';

function baseStore(): Record<string, Row[]> {
  return {
    courses: [{ id: 'c1', slug: 'khoa-1', title: 'Khóa 1', status: 'published' }],
    profiles: [
      { id: ADMIN_ID, role: 'admin' },
      { id: STUDENT_ID, role: 'student' },
    ],
    enrollments: [],
    certificates: [],
    audit_logs: [],
    course_modules: [
      { id: 'm1', course_id: 'c1', display_order: 0 },
      { id: 'm2', course_id: 'c1', display_order: 1 },
      { id: 'm3', course_id: 'c2', display_order: 0 },
    ],
    lessons: [],
    lesson_resources: [],
  };
}

describe('grantEnrollment — admin tang khoa', () => {
  it('thieu ly do -> loi, khong tao enrollment, khong ghi audit', async () => {
    const store = baseStore();
    const res = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: STUDENT_ID, courseId: 'c1', grantReason: '   ',
    });
    expect(res.status).toBe('error');
    expect(store.enrollments).toHaveLength(0);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('tao moi: enrollment active + granted_by/grant_reason + audit enrollment.grant', async () => {
    const store = baseStore();
    const res = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: STUDENT_ID, courseId: 'c1', grantReason: 'Tặng học viên giỏi',
    });
    expect(res.status).toBe('ok');
    expect(store.enrollments).toHaveLength(1);
    const en = store.enrollments[0];
    expect(en.status).toBe('active');
    expect(en.granted_by).toBe(ADMIN_ID);
    expect(en.grant_reason).toBe('Tặng học viên giỏi');
    expect(en.order_id).toBeNull();
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('enrollment.grant');
    expect(store.audit_logs[0].actor_id).toBe(ADMIN_ID);
    expect(store.audit_logs[0].target_id).toBe(en.id);
  });
  it('da active -> loi, khong tao trung', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'active' }];
    const res = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: STUDENT_ID, courseId: 'c1', grantReason: 'Tặng lại',
    });
    expect(res.status).toBe('error');
    expect(store.enrollments).toHaveLength(1);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('da revoked -> mo lai dong cu (reactivated), khong tao dong moi', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'revoked' }];
    const res = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: STUDENT_ID, courseId: 'c1', grantReason: 'Mở lại sau khiếu nại',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.reactivated).toBe(true);
    expect(store.enrollments).toHaveLength(1);
    expect(store.enrollments[0].status).toBe('active');
    expect(store.audit_logs[0].action).toBe('enrollment.grant');
  });
  it('khoa / hoc vien khong ton tai -> loi', async () => {
    const store = baseStore();
    const noCourse = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: STUDENT_ID, courseId: 'khong-co', grantReason: 'Tặng',
    });
    expect(noCourse.status).toBe('error');
    const noUser = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: 'khong-co', courseId: 'c1', grantReason: 'Tặng',
    });
    expect(noUser.status).toBe('error');
  });
});

describe('revokeEnrollment — admin thu hoi quyen hoc', () => {
  it('active -> revoked + thu hoi chung chi + audit enrollment.revoke', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'active' }];
    store.certificates = [
      { id: 'cert1', user_id: STUDENT_ID, course_id: 'c1', status: 'valid' },
      { id: 'cert2', user_id: STUDENT_ID, course_id: 'c1', status: 'revoked' },
    ];
    const res = await revokeEnrollment(makeClient(store), {
      adminId: ADMIN_ID, enrollmentId: 'e1', reason: 'Hoàn trả theo yêu cầu',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.previousStatus).toBe('active');
    expect(store.enrollments[0].status).toBe('revoked');
    expect(store.certificates[0].status).toBe('revoked');
    expect(res.certificatesRevoked).toBe(1);
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('enrollment.revoke');
    expect((store.audit_logs[0].details as Row).previous_status).toBe('active');
    expect((store.audit_logs[0].details as Row).reason).toBe('Hoàn trả theo yêu cầu');
  });
  it('thieu ly do -> loi, enrollment giu nguyen', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'active' }];
    const res = await revokeEnrollment(makeClient(store), {
      adminId: ADMIN_ID, enrollmentId: 'e1', reason: '',
    });
    expect(res.status).toBe('error');
    expect(store.enrollments[0].status).toBe('active');
    expect(store.audit_logs).toHaveLength(0);
  });
  it('da revoked -> loi (khong ghi audit trung)', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'revoked' }];
    const res = await revokeEnrollment(makeClient(store), {
      adminId: ADMIN_ID, enrollmentId: 'e1', reason: 'Thu lại lần nữa',
    });
    expect(res.status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
  });
  it('enrollment khong ton tai -> loi', async () => {
    const store = baseStore();
    const res = await revokeEnrollment(makeClient(store), {
      adminId: ADMIN_ID, enrollmentId: 'khong-co', reason: 'Thu hồi',
    });
    expect(res.status).toBe('error');
  });
});

describe('reorderContent — sap xep thu tu', () => {
  it('doi cho 2 chuong: display_order doi that + audit content.reorder', async () => {
    const store = baseStore();
    const res = await reorderContent(makeClient(store), {
      adminId: ADMIN_ID, kind: 'module', courseId: 'c1', parentId: 'c1',
      items: [
        { id: 'm1', displayOrder: 1 },
        { id: 'm2', displayOrder: 0 },
      ],
    });
    expect(res.status).toBe('ok');
    expect(store.course_modules.find((m) => m.id === 'm1')?.display_order).toBe(1);
    expect(store.course_modules.find((m) => m.id === 'm2')?.display_order).toBe(0);
    expect(store.audit_logs).toHaveLength(1);
    expect(store.audit_logs[0].action).toBe('content.reorder');
  });
  it('id thuoc khoa khac -> loi, khong doi thu tu cua ai', async () => {
    const store = baseStore();
    const res = await reorderContent(makeClient(store), {
      adminId: ADMIN_ID, kind: 'module', courseId: 'c1', parentId: 'c1',
      items: [
        { id: 'm1', displayOrder: 1 },
        { id: 'm3', displayOrder: 0 },
      ],
    });
    expect(res.status).toBe('error');
    expect(store.course_modules.find((m) => m.id === 'm1')?.display_order).toBe(0);
    expect(store.audit_logs).toHaveLength(0);
  });
  it('displayOrder trung nhau / id trung -> loi', async () => {
    const store = baseStore();
    const dupOrder = await reorderContent(makeClient(store), {
      adminId: ADMIN_ID, kind: 'module', courseId: 'c1', parentId: 'c1',
      items: [
        { id: 'm1', displayOrder: 0 },
        { id: 'm2', displayOrder: 0 },
      ],
    });
    expect(dupOrder.status).toBe('error');
    const dupId = await reorderContent(makeClient(store), {
      adminId: ADMIN_ID, kind: 'module', courseId: 'c1', parentId: 'c1',
      items: [
        { id: 'm1', displayOrder: 0 },
        { id: 'm1', displayOrder: 1 },
      ],
    });
    expect(dupId.status).toBe('error');
  });
  it('id khong ton tai -> loi, khong ghi audit', async () => {
    const store = baseStore();
    const res = await reorderContent(makeClient(store), {
      adminId: ADMIN_ID, kind: 'module', courseId: 'c1', parentId: 'c1',
      items: [{ id: 'khong-co', displayOrder: 0 }],
    });
    expect(res.status).toBe('error');
    expect(store.audit_logs).toHaveLength(0);
  });
});

describe('validation form admin', () => {
  it('validateGrantReason: rong / qua dai -> loi', () => {
    expect(validateGrantReason('')).not.toBeNull();
    expect(validateGrantReason('   ')).not.toBeNull();
    expect(validateGrantReason('a'.repeat(501))).not.toBeNull();
    expect(validateGrantReason('Lý do hợp lệ')).toBeNull();
  });
  it('validateCourseInput: slug sai, gia am, status sai -> loi', () => {
    const good = { title: 'Khóa hay', slug: 'khoa-hay', status: 'draft', priceVnd: 0, displayOrder: 0 };
    expect(validateCourseInput(good)).toBeNull();
    expect(validateCourseInput({ ...good, slug: 'Khoa Hay!' })).not.toBeNull();
    expect(validateCourseInput({ ...good, priceVnd: -1 })).not.toBeNull();
    expect(validateCourseInput({ ...good, status: 'xuat-ban' })).not.toBeNull();
    expect(validateCourseInput({ ...good, title: 'ab' })).not.toBeNull();
  });
  it('validateModuleInput / validateLessonInput / validateResourceInput', () => {
    expect(validateModuleInput({ title: 'Chương 1', displayOrder: 0 })).toBeNull();
    expect(validateModuleInput({ title: 'x', displayOrder: 0 })).not.toBeNull();
    expect(validateLessonInput({ title: 'Bài 1', slug: 'bai-1', type: 'video', displayOrder: 0 })).toBeNull();
    expect(validateLessonInput({ title: 'Bài 1', slug: 'bai-1', type: 'live', displayOrder: 0 })).not.toBeNull();
    expect(validateResourceInput({ title: 'Tài liệu', resourceType: 'file', fileUrl: 'https://x.pdf', displayOrder: 0 })).toBeNull();
    expect(validateResourceInput({ title: 'Tài liệu', resourceType: 'audio', fileUrl: '', displayOrder: 0 })).not.toBeNull();
  });
});

describe('migration 0013 (static)', () => {
  it('co cot + policy can cho admin ghi qua JWT', () => {
    const sql = readSrc('../../../../supabase/migrations/0013_admin_lms.sql');
    expect(sql).toContain('granted_by');
    expect(sql).toContain('grant_reason');
    expect(sql).toContain('certificates_status_check');
    expect(sql).toContain('is_published');
    expect(sql).toContain('enrollments_insert_admin');
    expect(sql).toContain('audit_logs_insert_admin');
    expect(sql).toContain('lesson_resources_select_enrolled_or_preview');
    expect(sql).toContain('lessons_public');
  });
  it('sua loi instructor 0006: is_instructor_of dung user_id (0013 sua 10/11/2026)', () => {
    const sql = readSrc('../../../../supabase/migrations/0013_admin_lms.sql');
    expect(sql).toContain('ci.user_id = auth.uid()');
    // Chi kiem tra code (bo comment giai thich loi cu): khong con dung cot sai.
    const codeOnly = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(codeOnly).not.toContain('ci.instructor_id');
  });
  it('moi thao tac admin trong route deu ghi audit', () => {
    const routes = [
      '../app/api/admin/courses/route.ts',
      '../app/api/admin/courses/[courseId]/route.ts',
      '../app/api/admin/courses/[courseId]/modules/route.ts',
      '../app/api/admin/modules/[moduleId]/route.ts',
      '../app/api/admin/modules/[moduleId]/lessons/route.ts',
      '../app/api/admin/lessons/[lessonId]/route.ts',
      '../app/api/admin/lessons/[lessonId]/resources/route.ts',
      '../app/api/admin/resources/[resourceId]/route.ts',
    ];
    for (const rel of routes) {
      expect(readSrc(rel)).toContain('writeAuditLog');
    }
    // Route reorder ghi audit qua reorderContent() trong lib.
    expect(readSrc('../app/api/admin/courses/[courseId]/reorder/route.ts')).toContain('reorderContent');
    expect(readSrc('./lms-admin.ts')).toContain("action: 'content.reorder'");
    expect(readSrc('./lms-admin.ts')).toContain("action: 'enrollment.grant'");
    expect(readSrc('./lms-admin.ts')).toContain("action: 'enrollment.revoke'");
  });
});

describe('Task 11 — hook mail ghi danh (E5) khi tang khoa', () => {
  it('hoc vien co email -> ok, khong emailWarning', async () => {
    const store = baseStore();
    store.profiles = [
      { id: ADMIN_ID, role: 'admin' },
      { id: STUDENT_ID, role: 'student', email: 'hv@example.com' },
    ];
    const res = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: STUDENT_ID, courseId: 'c1', grantReason: 'Tặng học viên giỏi',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.emailWarning).toBeUndefined();
    expect(store.enrollments).toHaveLength(1);
  });
  it('hoc vien khong co email -> van tang khoa, co emailWarning', async () => {
    const store = baseStore();
    const res = await grantEnrollment(makeClient(store), {
      adminId: ADMIN_ID, userId: STUDENT_ID, courseId: 'c1', grantReason: 'Tặng học viên giỏi',
    });
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.emailWarning).toMatch(/email/);
    expect(store.enrollments).toHaveLength(1);
  });
});
