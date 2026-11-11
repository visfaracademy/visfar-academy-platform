// Test Task 07 (phan 3/4): SECURITY guard + ADMIN.
// Chay local, khong can Supabase that. Fake client mo phong chuoi query
// cua supabase-js (thenable) + luu tru trong bo nho de kiem tra tac
// dung phu (revoke/grant doi status that, audit log duoc ghi).
//
// Cac truong hop bat buoc theo task:
//   - chua dang nhap -> redirect (middleware chan /admin/*, requireLessonAccess
//     tra 'unauthenticated', requireAdmin tra 'unauthenticated').
//   - student khong enrollment -> bi chan (not-enrolled, lesson = null,
//     khong lo video_url / content / file_url).
//   - admin thu hoi -> mat quyen (revoked -> requireLessonAccess tra
//     'revoked', lesson = null).
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decideLessonAccess,
  requireAdmin,
  requireLessonAccess,
  requireLessonAccessById,
  sanitizeLessonForPreview,
  type LessonRow,
} from './lms-access';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, rel), 'utf8');

// --- Fake supabase-js (loc that theo eq/in, ghi that vao store) -----------
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
  order(col: string, opts?: { ascending?: boolean }) {
    const asc = opts?.ascending !== false;
    const rows = this.rows();
    rows.sort((a, b) => {
      const av = a[col] as number;
      const bv = b[col] as number;
      return asc ? av - bv : bv - av;
    });
    // Sap xep tai cho tren ban sao da loc — don gian: luu thu tu vao store tam.
    this.sortedRows = rows;
    return this;
  }
  private sortedRows: Row[] | null = null;
  limit() {
    return this;
  }
  private rows(): Row[] {
    if (this.sortedRows) return this.sortedRows;
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
    const rows = this.applyUpdate();
    return { data: rows[0] ?? null, error: null };
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

function makeClient(
  store: Record<string, Row[]>,
  userId: string | null,
): SupabaseClient {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId, email: `${userId}@test.visfar` } : null },
        error: null,
      }),
    },
    from(table: string) {
      return new FakeQuery(store, table);
    },
  };
  return client as unknown as SupabaseClient;
}

const ADMIN_ID = 'admin-1';
const STUDENT_ID = 'student-1';
const OTHER_ID = 'student-2';

function baseStore(): Record<string, Row[]> {
  return {
    courses: [
      { id: 'c1', slug: 'khoa-1', title: 'Khóa 1', status: 'published' },
      { id: 'c2', slug: 'khoa-nhap', title: 'Khóa nháp', status: 'draft' },
    ],
    course_modules: [
      { id: 'm1', course_id: 'c1', title: 'Chương 1', courses: { id: 'c1', slug: 'khoa-1', title: 'Khóa 1', status: 'published' } },
      { id: 'm2', course_id: 'c2', title: 'Chương nháp', courses: { id: 'c2', slug: 'khoa-nhap', title: 'Khóa nháp', status: 'draft' } },
    ],
    lessons: [
      {
        id: 'l-paid', course_module_id: 'm1', slug: 'bai-tra-phi', title: 'Bài trả phí',
        type: 'video', content: 'NOI DUNG BI MAT', video_url: 'https://video.example.com/secret.mp4',
        video_duration_sec: 600, file_url: 'https://files.example.com/secret.pdf',
        display_order: 1, is_free_preview: false, is_published: true,
      },
      {
        id: 'l-free', course_module_id: 'm1', slug: 'bai-xem-thu', title: 'Bài xem thử',
        type: 'text', content: 'Nội dung xem thử', video_url: null,
        video_duration_sec: null, file_url: null,
        display_order: 0, is_free_preview: true, is_published: true,
      },
      {
        id: 'l-draft', course_module_id: 'm2', slug: 'bai-nhap', title: 'Bài nháp',
        type: 'text', content: 'Nháp', video_url: null, video_duration_sec: null,
        file_url: null, display_order: 0, is_free_preview: false, is_published: true,
      },
      {
        id: 'l-preview-video', course_module_id: 'm1', slug: 'bai-mau-video', title: 'Bài mẫu video',
        type: 'video', content: 'NOI DUNG MAU', video_url: 'https://video.example.com/preview.mp4',
        video_duration_sec: 120, file_url: 'https://files.example.com/mau.pdf',
        display_order: 2, is_free_preview: true, is_published: true,
      },
    ],
    // S-03 / 0028: guard doc metadata qua view lessons_public (khong
    // content / video_url / file_url) va video mau qua view
    // lessons_preview_video — fake client mo phong dung 2 view nay.
    lessons_public: [
      {
        id: 'l-paid', course_module_id: 'm1', slug: 'bai-tra-phi', title: 'Bài trả phí',
        type: 'video', video_duration_sec: 600, display_order: 1, is_free_preview: false, is_published: true,
      },
      {
        id: 'l-free', course_module_id: 'm1', slug: 'bai-xem-thu', title: 'Bài xem thử',
        type: 'text', video_duration_sec: null, display_order: 0, is_free_preview: true, is_published: true,
      },
      {
        id: 'l-draft', course_module_id: 'm2', slug: 'bai-nhap', title: 'Bài nháp',
        type: 'text', video_duration_sec: null, display_order: 0, is_free_preview: false, is_published: true,
      },
      {
        id: 'l-preview-video', course_module_id: 'm1', slug: 'bai-mau-video', title: 'Bài mẫu video',
        type: 'video', video_duration_sec: 120, display_order: 2, is_free_preview: true, is_published: true,
      },
    ],
    lessons_preview_video: [
      { id: 'l-preview-video', video_url: 'https://video.example.com/preview.mp4' },
    ],
    profiles: [
      { id: ADMIN_ID, role: 'admin', full_name: 'Admin', email: 'admin@test.visfar' },
      { id: STUDENT_ID, role: 'student', full_name: 'Học viên 1', email: 'a@test.visfar' },
      { id: OTHER_ID, role: 'student', full_name: 'Học viên 2', email: 'b@test.visfar' },
    ],
    user_roles: [{ user_id: ADMIN_ID, role: 'admin' }],
    enrollments: [],
    course_instructors: [],
    audit_logs: [],
  };
}

function paidLesson(): LessonRow {
  return {
    id: 'l-paid', course_module_id: 'm1', slug: 'bai-tra-phi', title: 'Bài trả phí',
    type: 'video', content: 'NOI DUNG BI MAT', video_url: 'https://video.example.com/secret.mp4',
    video_duration_sec: 600, file_url: 'https://files.example.com/secret.pdf',
    display_order: 1, is_free_preview: false, is_published: true,
  };
}

// ---------------------------------------------------------------------------
describe('decideLessonAccess (ham thuan)', () => {
  const base = {
    isAdmin: false,
    isInstructorOfCourse: false,
    enrollmentStatus: null as string | null,
    isFreePreview: false,
    courseStatus: 'published',
    lessonPublished: true,
  };
  it('bai xem thu: duoc xem ban preview, khong can enrollment', () => {
    const d = decideLessonAccess({ ...base, isFreePreview: true });
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('ok-preview');
  });
  it('enrollment active / completed: duoc xem day du', () => {
    expect(decideLessonAccess({ ...base, enrollmentStatus: 'active' }).reason).toBe('ok');
    expect(decideLessonAccess({ ...base, enrollmentStatus: 'completed' }).reason).toBe('ok');
  });
  it('khong enrollment: bi chan, ly do not-enrolled', () => {
    const d = decideLessonAccess(base);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('not-enrolled');
  });
  it('enrollment revoked: bi chan ngay, ly do revoked', () => {
    const d = decideLessonAccess({ ...base, enrollmentStatus: 'revoked' });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('revoked');
  });
  it('admin / instructor: duoc xem ca khoa draft + bai chua xuat ban', () => {
    expect(
      decideLessonAccess({ ...base, isAdmin: true, courseStatus: 'draft', lessonPublished: false }).allowed,
    ).toBe(true);
    expect(
      decideLessonAccess({ ...base, isInstructorOfCourse: true, courseStatus: 'draft' }).allowed,
    ).toBe(true);
  });
  it('hoc vien: khoa draft hoac bai chua xuat ban -> not-published', () => {
    expect(decideLessonAccess({ ...base, courseStatus: 'draft' }).reason).toBe('not-published');
    expect(decideLessonAccess({ ...base, lessonPublished: false }).reason).toBe('not-published');
  });
});

describe('sanitizeLessonForPreview', () => {
  it('loc sach content / file_url, giu metadata + video_url mau', () => {
    const preview = sanitizeLessonForPreview(paidLesson(), 'https://video.example.com/preview.mp4');
    expect(preview).not.toHaveProperty('content');
    expect(preview).not.toHaveProperty('file_url');
    expect(preview.video_url).toBe('https://video.example.com/preview.mp4');
    expect(preview.title).toBe('Bài trả phí');
    expect(preview.slug).toBe('bai-tra-phi');
    expect(JSON.stringify(preview)).not.toContain('secret');
  });
  it('mac dinh video_url null khi bai mau khong co video', () => {
    const preview = sanitizeLessonForPreview(paidLesson());
    expect(preview.video_url).toBeNull();
    expect(preview).not.toHaveProperty('content');
    expect(preview).not.toHaveProperty('file_url');
  });
});

describe('requireLessonAccess (server guard, fake client)', () => {
  it('chua dang nhap -> unauthenticated, lesson null', async () => {
    const res = await requireLessonAccess(makeClient(baseStore(), null), {
      courseSlug: 'khoa-1',
      lessonSlug: 'bai-tra-phi',
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('unauthenticated');
    expect(res.lesson).toBeNull();
  });

  it('student khong enrollment -> not-enrolled, lesson null, khong lo URL', async () => {
    const res = await requireLessonAccess(makeClient(baseStore(), STUDENT_ID), {
      courseSlug: 'khoa-1',
      lessonSlug: 'bai-tra-phi',
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('not-enrolled');
    expect(res.lesson).toBeNull();
    expect(JSON.stringify(res)).not.toContain('secret');
  });

  it('student enrollment active -> ok, nhan day du noi dung', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'active' }];
    const res = await requireLessonAccess(makeClient(store, STUDENT_ID), {
      courseSlug: 'khoa-1',
      lessonSlug: 'bai-tra-phi',
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('ok');
    if (!res.allowed) throw new Error('expected allowed');
    expect((res.lesson as LessonRow).video_url).toContain('secret.mp4');
  });

  it('admin thu hoi -> mat quyen ngay: revoked, lesson null', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'revoked' }];
    const res = await requireLessonAccess(makeClient(store, STUDENT_ID), {
      courseSlug: 'khoa-1',
      lessonSlug: 'bai-tra-phi',
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('revoked');
    expect(res.lesson).toBeNull();
    expect(JSON.stringify(res)).not.toContain('secret');
  });

  it('bai xem thu khong co video -> ok-preview, chi metadata, video_url null', async () => {
    const res = await requireLessonAccess(makeClient(baseStore(), STUDENT_ID), {
      courseSlug: 'khoa-1',
      lessonSlug: 'bai-xem-thu',
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('ok-preview');
    if (!res.allowed) throw new Error('expected allowed');
    expect((res.lesson as { video_url?: string | null }).video_url).toBeNull();
    expect(res.lesson).not.toHaveProperty('content');
    expect(res.lesson).not.toHaveProperty('file_url');
  });

  it('bai xem thu co video -> ok-preview, chi co video_url mau, khong lo content/file_url', async () => {
    const res = await requireLessonAccess(makeClient(baseStore(), STUDENT_ID), {
      courseSlug: 'khoa-1',
      lessonSlug: 'bai-mau-video',
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('ok-preview');
    if (!res.allowed) throw new Error('expected allowed');
    expect((res.lesson as { video_url?: string | null }).video_url).toBe(
      'https://video.example.com/preview.mp4',
    );
    expect(res.lesson).not.toHaveProperty('content');
    expect(res.lesson).not.toHaveProperty('file_url');
    expect(JSON.stringify(res)).not.toContain('NOI DUNG MAU');
    expect(JSON.stringify(res)).not.toContain('mau.pdf');
  });

  it('admin xem duoc bai cua khoa draft', async () => {
    const res = await requireLessonAccess(makeClient(baseStore(), ADMIN_ID), {
      courseSlug: 'khoa-nhap',
      lessonSlug: 'bai-nhap',
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('ok');
  });

  it('student xem bai khoa draft -> not-published', async () => {
    const res = await requireLessonAccess(makeClient(baseStore(), STUDENT_ID), {
      courseSlug: 'khoa-nhap',
      lessonSlug: 'bai-nhap',
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('not-published');
  });

  it('khoa khong ton tai -> not-found', async () => {
    const res = await requireLessonAccess(makeClient(baseStore(), STUDENT_ID), {
      courseSlug: 'khong-co',
      lessonSlug: 'bai-tra-phi',
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('not-found');
  });

  it('instructor khoa phu trach duoc xem bai tra phi', async () => {
    const store = baseStore();
    store.profiles.push({ id: OTHER_ID, role: 'instructor', full_name: 'GV', email: 'gv@test.visfar' });
    store.course_instructors = [{ course_id: 'c1', user_id: OTHER_ID }];
    const res = await requireLessonAccess(makeClient(store, OTHER_ID), {
      courseSlug: 'khoa-1',
      lessonSlug: 'bai-tra-phi',
    });
    expect(res.allowed).toBe(true);
    expect(res.isInstructor).toBe(true);
  });
});

describe('requireLessonAccessById', () => {
  it('revoked qua id -> revoked, khong lo URL', async () => {
    const store = baseStore();
    store.enrollments = [{ id: 'e1', user_id: STUDENT_ID, course_id: 'c1', status: 'revoked' }];
    const res = await requireLessonAccessById(makeClient(store, STUDENT_ID), 'l-paid');
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('revoked');
    expect(res.lesson).toBeNull();
  });
  it('chua dang nhap -> unauthenticated', async () => {
    const res = await requireLessonAccessById(makeClient(baseStore(), null), 'l-paid');
    expect(res.reason).toBe('unauthenticated');
  });
  it('bai mau video qua id -> ok-preview, chi video_url, khong content/file_url', async () => {
    const res = await requireLessonAccessById(makeClient(baseStore(), STUDENT_ID), 'l-preview-video');
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('ok-preview');
    if (!res.allowed) throw new Error('expected allowed');
    expect((res.lesson as { video_url?: string | null }).video_url).toBe(
      'https://video.example.com/preview.mp4',
    );
    expect(res.lesson).not.toHaveProperty('content');
    expect(JSON.stringify(res)).not.toContain('NOI DUNG MAU');
  });
});

describe('requireAdmin', () => {
  it('chua dang nhap -> unauthenticated', async () => {
    expect(await requireAdmin(makeClient(baseStore(), null))).toEqual({
      ok: false,
      reason: 'unauthenticated',
    });
  });
  it('student -> forbidden', async () => {
    expect(await requireAdmin(makeClient(baseStore(), STUDENT_ID))).toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });
  it('admin qua user_roles -> ok', async () => {
    expect(await requireAdmin(makeClient(baseStore(), ADMIN_ID))).toEqual({
      ok: true,
      userId: ADMIN_ID,
    });
  });
  it('admin chi qua profiles.role (cache) -> ok', async () => {
    const store = baseStore();
    store.user_roles = [];
    expect(await requireAdmin(makeClient(store, ADMIN_ID))).toEqual({
      ok: true,
      userId: ADMIN_ID,
    });
  });
});

describe('guard tich hop o trang bai hoc + route tai lieu (static)', () => {
  it('learning.ts: fetchLessonDetail xac minh qua API server, khoa thi loc URL', () => {
    const src = readSrc('./learning.ts');
    expect(src).toContain('verifyLessonAccessViaApi');
    expect(src).toContain('stripLessonContent');
    expect(src).toContain("resources: locked ? [] : resources");
  });
  it('route download v1: kiem tra enrollment phia server', () => {
    const src = readSrc('../app/api/v1/resources/[id]/download/route.ts');
    expect(src).toContain('requireLessonAccessById');
    expect(src).toContain('getServerSupabaseClient');
    // Khong con luong "chi can khoa published la tai duoc" cho nguoi da dang nhap.
    expect(src).not.toContain('Chi tai khi khoa da published');
  });
  it('middleware: chan /admin/* khi chua dang nhap', () => {
    const src = readSrc('../middleware.ts');
    expect(src).toContain("'/admin/:path*'");
    expect(src).toContain("'/api/admin/:path*'");
  });
  it('admin layout: kiem tra requireAdmin o server', () => {
    const src = readSrc('../app/admin/layout.tsx');
    expect(src).toContain('requireAdmin');
    expect(src).toContain('Không có quyền truy cập');
  });
  it('khong co service-role key o apps/web', () => {
    for (const rel of ['./supabase.ts', './supabase-server.ts', './lms-access.ts', './lms-admin.ts']) {
      const src = readSrc(rel);
      expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(src).not.toContain('service_role');
    }
  });
  it('course_instructors: khong con cot instructor_id — chi co user_id (0004 muc 20, 0013 muc E)', () => {
    // B-T08-2: cot instructor_id khong ton tai; dung sai ten cot se
    // loi PGRST204 va giang vien mat quyen xem/giao bai.
    for (const rel of [
      './lms-access.ts',
      './assignment-server.ts',
      '../app/api/v1/assignments/route.ts',
    ]) {
      const src = readSrc(rel);
      expect(src).not.toContain('instructor_id');
      expect(src).toContain(".eq('user_id', userId)");
    }
  });
});
