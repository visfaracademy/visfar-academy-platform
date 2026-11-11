// Test dashboard data layer (Task 06) — chay local, khong can Supabase
// that. Fake client mo phong chuoi query cua supabase-js (thenable).
import { describe, expect, it, vi } from 'vitest';
import {
  AVATAR_MAX_BYTES,
  avatarStoragePath,
  computeCourseProgress,
  computeModuleProgress,
  eventTypeLabelVi,
  formatVnd,
  getMyCertificates,
  getMyCourseProgress,
  getMyLearningHistory,
  getMyNotifications,
  getMyOrders,
  isLessonCompleted,
  isQuizPassed,
  markNotificationRead,
  quizScorePercent,
  splitEnrollments,
  updateMyProfile,
  uploadMyAvatar,
  validateAvatarFile,
  validateProfileUpdate,
  type CourseProgressItem,
} from './dashboard';

type Row = Record<string, unknown>;

// --- Fake supabase-js query builder (thenable) ------------------------------
class FakeQuery {
  calls: string[] = [];
  constructor(
    private result: { data: unknown; error: { message: string; code?: string } | null },
    private onUpdate?: (values: Row) => void,
  ) {}
  select() {
    this.calls.push('select');
    return this;
  }
  eq() {
    return this;
  }
  in() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  update(values: Row) {
    this.onUpdate?.(values);
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.result);
  }
  single() {
    return Promise.resolve(this.result);
  }
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(onF, onR);
  }
}

interface FakeClientOpts {
  tables?: Record<string, { data: unknown; error: { message: string; code?: string } | null }>;
  userId?: string | null;
  storageError?: string | null;
}

function makeFakeClient(opts: FakeClientOpts = {}) {
  const updates: Array<{ table: string; values: Row }> = [];
  const uploads: Array<{ bucket: string; path: string }> = [];
  const client = {
    updates,
    uploads,
    auth: {
      getUser: async () =>
        opts.userId === undefined || opts.userId
          ? { data: { user: { id: opts.userId ?? 'user-1', email: 'a@b.co' } } }
          : { data: { user: null } },
    },
    from(table: string) {
      const res = opts.tables?.[table] ?? { data: [], error: null };
      return new FakeQuery(res, (values) => updates.push({ table, values }));
    },
    storage: {
      from(bucket: string) {
        return {
          upload: async (path: string) => {
            uploads.push({ bucket, path });
            if (opts.storageError) return { data: null, error: { message: opts.storageError } };
            return { data: { path }, error: null };
          },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
        };
      },
    },
  };
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (c: unknown) => c as any;

// --- Pure helpers ------------------------------------------------------------
describe('isLessonCompleted — nguong QĐ 17 (video >= 90%)', () => {
  it('video 90% -> hoan thanh', () => {
    expect(isLessonCompleted('video', { status: 'in_progress', progress_percent: 90 })).toBe(true);
  });
  it('video 89% -> chua hoan thanh', () => {
    expect(isLessonCompleted('video', { status: 'in_progress', progress_percent: 89 })).toBe(false);
  });
  it('bai text 100% nhung chua bam hoan thanh -> chua tinh', () => {
    expect(isLessonCompleted('text', { status: 'in_progress', progress_percent: 100 })).toBe(false);
  });
  it('status completed -> hoan thanh moi loai bai', () => {
    expect(isLessonCompleted('text', { status: 'completed', progress_percent: 0 })).toBe(true);
    expect(isLessonCompleted('quiz', { status: 'completed', progress_percent: 0 })).toBe(true);
  });
  it('khong co tien do -> chua hoan thanh', () => {
    expect(isLessonCompleted('video', null)).toBe(false);
    expect(isLessonCompleted('video', undefined)).toBe(false);
  });
});

describe('computeModuleProgress / computeCourseProgress', () => {
  const lessons = [
    { id: 'l1', course_module_id: 'm1', type: 'video' },
    { id: 'l2', course_module_id: 'm1', type: 'text' },
    { id: 'l3', course_module_id: 'm2', type: 'video' },
  ];
  it('tinh theo module: 1/2 bai xong -> 50%', () => {
    const byLesson = new Map([
      ['l1', { lesson_id: 'l1', status: 'in_progress', progress_percent: 95 }],
      ['l2', { lesson_id: 'l2', status: 'in_progress', progress_percent: 100 }],
    ]);
    const m = computeModuleProgress('m1', 'Module 1', lessons, byLesson);
    expect(m).toEqual({ moduleId: 'm1', title: 'Module 1', totalLessons: 2, completedLessons: 1, progressPercent: 50 });
  });
  it('module chua co bai -> 0%, khong chia cho 0', () => {
    const m = computeModuleProgress('m9', 'Rong', [], new Map());
    expect(m.progressPercent).toBe(0);
    expect(m.totalLessons).toBe(0);
  });
  it('khoa 0 bai nhung enrollment completed -> van tinh hoan thanh', () => {
    expect(computeCourseProgress(0, 0, 'completed')).toEqual({ progressPercent: 0, isCompleted: true });
  });
  it('khoa 3/3 bai -> 100% va hoan thanh', () => {
    expect(computeCourseProgress(3, 3, 'active')).toEqual({ progressPercent: 100, isCompleted: true });
  });
  it('khoa 1/3 bai -> 33%', () => {
    expect(computeCourseProgress(3, 1, 'active')).toEqual({ progressPercent: 33, isCompleted: false });
  });
});

describe('splitEnrollments', () => {
  const base = (status: string): CourseProgressItem => ({
    enrollmentId: status,
    courseId: status,
    courseTitle: status,
    courseSlug: '',
    status,
    enrolledAt: '2026-01-01',
    completedAt: null,
    totalLessons: 1,
    completedLessons: 0,
    progressPercent: 0,
    modules: [],
  });
  it('tach dang hoc / da hoan thanh', () => {
    const { inProgress, completed } = splitEnrollments([base('active'), base('completed'), base('revoked')]);
    expect(inProgress.map((i) => i.status)).toEqual(['active', 'revoked']);
    expect(completed.map((i) => i.status)).toEqual(['completed']);
  });
});

describe('validateProfileUpdate — chi 3 truong duoc sua', () => {
  it('hop le', () => {
    expect(validateProfileUpdate({ fullName: 'Nguyễn Văn A', phone: '0901234567', province: 'Hà Nội' })).toEqual([]);
  });
  it('de trong SĐT/tinh duoc chap nhan (chua cap nhat)', () => {
    expect(validateProfileUpdate({ fullName: 'Nguyễn Văn A', phone: '', province: '' })).toEqual([]);
  });
  it('ten qua ngan, SĐT sai, tinh ngoai danh sach', () => {
    const errs = validateProfileUpdate({ fullName: 'A', phone: '84123456789', province: 'Bình Dương' });
    expect(errs.map((e) => e.field)).toEqual(['fullName', 'phone', 'province']);
  });
});

describe('avatar — duong dan + validate', () => {
  it('duong dan <userId>/avatar.<ext>', () => {
    expect(avatarStoragePath('u-1', 'anh.PNG')).toBe('u-1/avatar.png');
  });
  it('ext la -> null', () => {
    expect(avatarStoragePath('u-1', 'anh.gif')).toBeNull();
    expect(avatarStoragePath('u-1', 'anh')).toBeNull();
  });
  it('file hop le', () => {
    expect(validateAvatarFile({ name: 'a.jpg', size: 1000, type: 'image/jpeg' })).toBeNull();
  });
  it('qua 2MB / khong phai anh / sai ext', () => {
    expect(validateAvatarFile({ name: 'a.jpg', size: AVATAR_MAX_BYTES + 1, type: 'image/jpeg' })).toContain('2 MB');
    expect(validateAvatarFile({ name: 'a.pdf', size: 100, type: 'application/pdf' })).toContain('ảnh');
    expect(validateAvatarFile({ name: 'a.gif', size: 100, type: 'image/gif' })).toContain('Định dạng');
  });
});

describe('nhan + dinh dang', () => {
  it('formatVnd', () => {
    expect(formatVnd(1999000)).toBe('1.999.000 đ');
    expect(formatVnd(0)).toBe('0 đ');
  });
  it('eventTypeLabelVi — loai la giu nguyen', () => {
    expect(eventTypeLabelVi('lesson_completed')).toBe('Hoàn thành bài học');
    expect(eventTypeLabelVi('kieu_moi')).toBe('kieu_moi');
  });
});

// --- Data layer voi fake client ----------------------------------------------
describe('getMyCourseProgress', () => {
  it('chua dang nhap -> signed-out', async () => {
    const res = await getMyCourseProgress(asClient(makeFakeClient({ userId: null })));
    expect(res.status).toBe('signed-out');
  });
  it('chua ghi danh -> success, data rong (empty state, khong bia khoa)', async () => {
    const res = await getMyCourseProgress(asClient(makeFakeClient()));
    expect(res).toEqual({ status: 'success', data: [] });
  });
  it('tinh tien do theo module: video 90% + text completed', async () => {
    const client = makeFakeClient({
      tables: {
        enrollments: {
          data: [
            {
              id: 'e1',
              status: 'active',
              enrolled_at: '2026-11-01',
              completed_at: null,
              course_id: 'c1',
              courses: { title: 'Thấu Hiểu Nội Tâm', slug: 'thau-hieu-noi-tam' },
            },
          ],
          error: null,
        },
        course_modules: {
          data: [
            { id: 'm1', course_id: 'c1', title: 'Module 1' },
            { id: 'm2', course_id: 'c1', title: 'Module 2' },
          ],
          error: null,
        },
        lessons: {
          data: [
            { id: 'l1', course_module_id: 'm1', type: 'video' },
            { id: 'l2', course_module_id: 'm1', type: 'text' },
            { id: 'l3', course_module_id: 'm2', type: 'video' },
          ],
          error: null,
        },
        lesson_progress: {
          data: [
            { lesson_id: 'l1', status: 'in_progress', progress_percent: 90 },
            { lesson_id: 'l2', status: 'completed', progress_percent: 100 },
            { lesson_id: 'l3', status: 'in_progress', progress_percent: 10 },
          ],
          error: null,
        },
      },
    });
    const res = await getMyCourseProgress(asClient(client));
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0].completedLessons).toBe(2);
    expect(res.data[0].totalLessons).toBe(3);
    expect(res.data[0].progressPercent).toBe(67);
    expect(res.data[0].modules).toEqual([
      { moduleId: 'm1', title: 'Module 1', totalLessons: 2, completedLessons: 2, progressPercent: 100 },
      { moduleId: 'm2', title: 'Module 2', totalLessons: 1, completedLessons: 0, progressPercent: 0 },
    ]);
  });
  it('bang chua ton tai (PGRST205) -> error ro rang, khong fake', async () => {
    const client = makeFakeClient({
      tables: {
        enrollments: {
          data: null,
          error: { message: "Could not find the table 'public.enrollments' in the schema cache", code: 'PGRST205' },
        },
      },
    });
    const res = await getMyCourseProgress(asClient(client));
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.message).toContain('chưa được tạo');
  });
});

describe('getMyLearningHistory / getMyNotifications / getMyCertificates / getMyOrders', () => {
  it('chua co du lieu -> success rong (khong bia lich su / thong bao / chung chi / don)', async () => {
    const client = makeFakeClient();
    expect(await getMyLearningHistory(asClient(client))).toEqual({ status: 'success', data: [] });
    expect(await getMyNotifications(asClient(client))).toEqual({ status: 'success', data: [] });
    expect(await getMyCertificates(asClient(client))).toEqual({ status: 'success', data: [] });
    expect(await getMyOrders(asClient(client))).toEqual({ status: 'success', data: [] });
  });
  it('lich su hoc: doc tu lesson_progress, map tieu de khoa/bai qua module', async () => {
    const client = makeFakeClient({
      tables: {
        lesson_progress: {
          data: [
            {
              id: 'lp1',
              lesson_id: 'l1',
              status: 'completed',
              progress_percent: 90,
              completed_at: '2026-11-09T10:00:00Z',
              updated_at: '2026-11-09T10:00:00Z',
            },
            {
              id: 'lp2',
              lesson_id: 'l2',
              status: 'in_progress',
              progress_percent: 40,
              completed_at: null,
              updated_at: '2026-11-09T11:00:00Z',
            },
          ],
          error: null,
        },
        lessons: {
          data: [
            { id: 'l1', title: 'Bài 1', course_module_id: 'm1' },
            { id: 'l2', title: 'Bài 2', course_module_id: 'm1' },
          ],
          error: null,
        },
        course_modules: { data: [{ id: 'm1', course_id: 'c1' }], error: null },
        courses: { data: [{ id: 'c1', title: 'Thấu Hiểu Nội Tâm' }], error: null },
      },
    });
    const res = await getMyLearningHistory(asClient(client));
    expect(res).toEqual({
      status: 'success',
      data: [
        {
          id: 'lp1',
          eventType: 'lesson_completed',
          courseTitle: 'Thấu Hiểu Nội Tâm',
          lessonTitle: 'Bài 1',
          occurredAt: '2026-11-09T10:00:00Z',
          progressPercent: 90,
        },
        {
          id: 'lp2',
          eventType: 'lesson_started',
          courseTitle: 'Thấu Hiểu Nội Tâm',
          lessonTitle: 'Bài 2',
          occurredAt: '2026-11-09T11:00:00Z',
          progressPercent: 40,
        },
      ],
    });
  });
  it('don hang: kem order_items', async () => {
    const client = makeFakeClient({
      tables: {
        orders: {
          data: [
            {
              id: 'o1',
              reference_code: 'DH-2026-000001',
              status: 'paid',
              amount_vnd: 0,
              payment_method: 'bank_transfer',
              created_at: '2026-11-01',
              paid_at: '2026-11-02',
            },
          ],
          error: null,
        },
        order_items: {
          data: [{ id: 'oi1', order_id: 'o1', item_name: 'Thấu Hiểu Nội Tâm', unit_price_vnd: 0, quantity: 1, total_vnd: 0 }],
          error: null,
        },
      },
    });
    const res = await getMyOrders(asClient(client));
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    expect(res.data[0].items).toHaveLength(1);
    expect(res.data[0].items[0].itemName).toBe('Thấu Hiểu Nội Tâm');
  });
  it('chung chi: map ten khoa qua join', async () => {
    const client = makeFakeClient({
      tables: {
        certificates: {
          data: [
            {
              id: 'cert1',
              certificate_code: 'VISFAR-CERT-2026-000001',
              status: 'valid',
              issued_at: '2026-11-09',
              course_id: 'c1',
              courses: { title: 'Thấu Hiểu Nội Tâm', slug: 'thau-hieu-noi-tam' },
            },
          ],
          error: null,
        },
      },
    });
    const res = await getMyCertificates(asClient(client));
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    expect(res.data[0].certificateCode).toBe('VISFAR-CERT-2026-000001');
    expect(res.data[0].courseTitle).toBe('Thấu Hiểu Nội Tâm');
  });
});

describe('updateMyProfile — chi gui 3 truong, khong gui role/email', () => {
  it('gui dung full_name/phone/province, phone rong -> null', async () => {
    const client = makeFakeClient();
    const res = await updateMyProfile({ fullName: ' Nguyễn Văn A ', phone: '', province: 'Hà Nội' }, asClient(client));
    expect(res).toEqual({ status: 'ok' });
    expect(client.updates).toHaveLength(1);
    expect(client.updates[0].table).toBe('profiles');
    expect(client.updates[0].values).toEqual({ full_name: 'Nguyễn Văn A', phone: null, province: 'Hà Nội' });
    expect(Object.keys(client.updates[0].values)).not.toContain('role');
    expect(Object.keys(client.updates[0].values)).not.toContain('email');
  });
  it('validation loi -> khong goi update', async () => {
    const client = makeFakeClient();
    const res = await updateMyProfile({ fullName: 'A', phone: '123', province: '' }, asClient(client));
    expect(res.status).toBe('error');
    expect(client.updates).toHaveLength(0);
  });
});

describe('uploadMyAvatar — bucket avatars, duong dan theo userId', () => {
  it('upload len <userId>/avatar.jpg roi cap nhat profiles.avatar_url', async () => {
    const client = makeFakeClient();
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const res = await uploadMyAvatar(
      { name: 'anh.jpg', size: 1000, type: 'image/jpeg' },
      blob,
      asClient(client),
    );
    expect(res).toEqual({ status: 'ok', publicUrl: 'https://cdn.test/user-1/avatar.jpg' });
    expect(client.uploads).toEqual([{ bucket: 'avatars', path: 'user-1/avatar.jpg' }]);
    expect(client.updates).toHaveLength(1);
    expect(client.updates[0].values).toEqual({ avatar_url: 'https://cdn.test/user-1/avatar.jpg' });
  });
  it('file qua lon -> loi, khong upload', async () => {
    const client = makeFakeClient();
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const res = await uploadMyAvatar(
      { name: 'anh.jpg', size: AVATAR_MAX_BYTES + 1, type: 'image/jpeg' },
      blob,
      asClient(client),
    );
    expect(res.status).toBe('error');
    expect(client.uploads).toHaveLength(0);
  });
  it('loi storage -> error, khong cap nhat profile', async () => {
    const client = makeFakeClient({ storageError: 'new row violates row-level security policy' });
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const res = await uploadMyAvatar({ name: 'a.png', size: 10, type: 'image/png' }, blob, asClient(client));
    expect(res.status).toBe('error');
    expect(client.updates).toHaveLength(0);
  });
});

describe('markNotificationRead', () => {
  it('ok', async () => {
    const client = makeFakeClient();
    const res = await markNotificationRead('n1', asClient(client));
    expect(res).toEqual({ status: 'ok' });
    expect(client.updates[0].values.is_read).toBe(true);
  });
  it('chua dang nhap -> error', async () => {
    const client = makeFakeClient({ userId: null });
    const res = await markNotificationRead('n1', asClient(client));
    expect(res.status).toBe('error');
  });
  it('vitest mock da dung (khong de unused import)', () => {
    expect(vi.fn()).toBeDefined();
  });
});

describe('quizScorePercent / isQuizPassed — nguong dat 70% (QĐ Task 08)', () => {
  it('tinh % dung, lam tron', () => {
    expect(quizScorePercent(7, 10)).toBe(70);
    expect(quizScorePercent(1, 3)).toBe(33);
    expect(quizScorePercent(0, 0)).toBe(0);
  });
  it('dat khi >= 70%, truot khi < 70%', () => {
    expect(isQuizPassed(7, 10)).toBe(true);
    expect(isQuizPassed(6, 10)).toBe(false);
    expect(isQuizPassed(14, 20, 70)).toBe(true);
    expect(isQuizPassed(13, 20, 70)).toBe(false);
  });
});
