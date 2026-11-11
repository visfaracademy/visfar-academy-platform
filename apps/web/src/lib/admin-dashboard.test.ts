// Test admin dashboard data layer (Task 09 phan 1/4) — chay local,
// khong can Supabase that. Fake client mo phong chuoi query cua
// supabase-js (thenable), ke ca select head:true tra count.
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STUDENT_DAYS,
  computeCompletionRate,
  countDistinctUsers,
  daysAgoIso,
  getAdminDashboardStats,
  sumRevenue,
  type AdminDashboardStats,
} from './admin-dashboard';

type QueryResult = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };
type Handler = (q: FakeQuery) => QueryResult;

// --- Fake supabase-js query builder (thenable) ------------------------------
class FakeQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];
  selectCols = '';
  isHead = false;
  constructor(private handler: Handler) {}
  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    this.selectCols = cols ?? '';
    this.isHead = opts?.head === true;
    this.calls.push({ method: 'select', args: [cols, opts] });
    return this;
  }
  eq(col: string, value: unknown) {
    this.calls.push({ method: 'eq', args: [col, value] });
    return this;
  }
  gte(col: string, value: unknown) {
    this.calls.push({ method: 'gte', args: [col, value] });
    return this;
  }
  in(col: string, values: unknown) {
    this.calls.push({ method: 'in', args: [col, values] });
    return this;
  }
  order(col: string, opts?: unknown) {
    this.calls.push({ method: 'order', args: [col, opts] });
    return this;
  }
  limit(n: number) {
    this.calls.push({ method: 'limit', args: [n] });
    return this;
  }
  range(from: number, to: number) {
    this.calls.push({ method: 'range', args: [from, to] });
    return this;
  }
  then(onF: (v: QueryResult) => unknown, onR?: (e: unknown) => unknown) {
    return Promise.resolve(this.handler(this)).then(onF, onR);
  }
}

function makeFakeClient(tables: Record<string, Handler>) {
  const client = {
    from(table: string) {
      const handler = tables[table] ?? (() => ({ data: [], error: null, count: 0 }));
      return new FakeQuery(handler);
    },
  };
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (c: unknown) => c as any;

const rowsHandler = (rows: unknown): Handler => () => ({ data: rows, error: null, count: null });
const errorHandler = (message: string, code?: string): Handler => () => ({
  data: null,
  error: { message, code },
  count: null,
});

/** Bo du lieu day du cho test success: 2 khoa, 3 enrollment tinh duoc + 1 revoked. */
function fullTables(): Record<string, Handler> {
  return {
    profiles: (q) => (q.isHead ? { data: [], error: null, count: q.calls.some((c) => c.method === 'gte') ? 3 : 12 } : { data: [], error: null, count: null }),
    courses: (q) => {
      if (q.isHead) {
        return { data: [], error: null, count: q.calls.some((c) => c.method === 'eq') ? 8 : 10 };
      }
      return {
        data: [
          { id: 'c1', title: 'Thấu Hiểu Nội Tâm', slug: 'thau-hieu-noi-tam', status: 'published' },
          { id: 'c2', title: 'Khóa chưa có bài', slug: 'khoa-chua-co-bai', status: 'draft' },
        ],
        error: null,
        count: null,
      };
    },
    enrollments: (q) => {
      if (q.isHead) {
        return { data: [], error: null, count: q.calls.some((c) => c.method === 'eq') ? 15 : 20 };
      }
      if (q.selectCols.includes('profiles(')) {
        return {
          data: [
            {
              id: 'e1',
              status: 'active',
              enrolled_at: '2026-11-09T10:00:00Z',
              profiles: { full_name: 'Nguyễn Văn A', email: 'a@test.vn' },
              courses: { title: 'Thấu Hiểu Nội Tâm' },
            },
          ],
          error: null,
          count: null,
        };
      }
      return {
        data: [
          { id: 'e1', user_id: 'u1', course_id: 'c1', status: 'active', enrolled_at: '2026-11-09T10:00:00Z' },
          { id: 'e2', user_id: 'u2', course_id: 'c1', status: 'completed', enrolled_at: '2026-11-08T10:00:00Z' },
          { id: 'e3', user_id: 'u3', course_id: 'c1', status: 'revoked', enrolled_at: '2026-11-07T10:00:00Z' },
          { id: 'e4', user_id: 'u1', course_id: 'c2', status: 'active', enrolled_at: '2026-11-06T10:00:00Z' },
        ],
        error: null,
        count: null,
      };
    },
    orders: (q) => {
      if (q.isHead) {
        return { data: [], error: null, count: q.calls.some((c) => c.method === 'eq') ? 5 : 7 };
      }
      return { data: [{ amount_vnd: 50000 }], error: null, count: null };
    },
    payments: rowsHandler([{ amount_vnd: 100000 }, { amount_vnd: 250000 }]),
    course_modules: rowsHandler([
      { id: 'm1', course_id: 'c1' },
      { id: 'm2', course_id: 'c1' },
    ]),
    lessons: rowsHandler([
      { id: 'l1', course_module_id: 'm1', type: 'video' },
      { id: 'l2', course_module_id: 'm2', type: 'text' },
    ]),
    lesson_progress: (q) => {
      // Query hoc vien hoat dong chi select user_id; query tien do select day du.
      if (q.selectCols === 'user_id') {
        return {
          data: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }],
          error: null,
          count: null,
        };
      }
      return {
        data: [
          { user_id: 'u1', lesson_id: 'l1', status: 'completed', progress_percent: 100, updated_at: '2026-11-09T10:00:00Z' },
          { user_id: 'u1', lesson_id: 'l2', status: 'in_progress', progress_percent: 50, updated_at: '2026-11-09T10:00:00Z' },
          { user_id: 'u2', lesson_id: 'l1', status: 'completed', progress_percent: 100, updated_at: '2026-11-08T10:00:00Z' },
          { user_id: 'u2', lesson_id: 'l2', status: 'completed', progress_percent: 100, updated_at: '2026-11-08T10:00:00Z' },
        ],
        error: null,
        count: null,
      };
    },
  };
}

function emptyTables(): Record<string, Handler> {
  const tables: Record<string, Handler> = {};
  for (const t of ['profiles', 'courses', 'enrollments', 'orders', 'payments', 'course_modules', 'lessons', 'lesson_progress']) {
    tables[t] = (q) => (q.isHead ? { data: [], error: null, count: 0 } : { data: [], error: null, count: null });
  }
  return tables;
}

async function getStats(tables: Record<string, Handler>): Promise<AdminDashboardStats> {
  const state = await getAdminDashboardStats(asClient(makeFakeClient(tables)), {
    now: new Date('2026-11-10T12:00:00Z'),
  });
  if (state.status !== 'success') throw new Error(`expected success, got ${state.status}`);
  return state.data;
}

// --- Pure helpers ------------------------------------------------------------
describe('computeCompletionRate', () => {
  it('0/0 -> 0 (khong chia cho 0)', () => {
    expect(computeCompletionRate(0, 0)).toBe(0);
  });
  it('1/2 -> 50', () => {
    expect(computeCompletionRate(2, 1)).toBe(50);
  });
  it('lam tron: 1/3 -> 33', () => {
    expect(computeCompletionRate(3, 1)).toBe(33);
  });
  it('hoan thanh vuot tong -> chan o 100', () => {
    expect(computeCompletionRate(2, 5)).toBe(100);
  });
  it('so am -> 0', () => {
    expect(computeCompletionRate(4, -1)).toBe(0);
  });
});

describe('sumRevenue', () => {
  it('cong so duong, bo qua null/am/NaN', () => {
    expect(sumRevenue([100000, null, -5, undefined, Number.NaN, 250000])).toBe(350000);
  });
  it('mang rong -> 0', () => {
    expect(sumRevenue([])).toBe(0);
  });
});

describe('countDistinctUsers', () => {
  it('trung user chi dem 1 lan, bo qua null/rong', () => {
    expect(
      countDistinctUsers([{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }, { user_id: null }, { user_id: '' }]),
    ).toBe(2);
  });
});

describe('daysAgoIso', () => {
  it('30 ngay truoc 2026-11-10 -> 2026-10-11', () => {
    expect(daysAgoIso(30, new Date('2026-11-10T12:00:00Z'))).toBe('2026-10-11T12:00:00.000Z');
  });
  it('ACTIVE_STUDENT_DAYS = 30', () => {
    expect(ACTIVE_STUDENT_DAYS).toBe(30);
  });
});

// --- getAdminDashboardStats --------------------------------------------------
describe('getAdminDashboardStats — du lieu day du', () => {
  it('tra du 8 chi so + bang theo khoa + dang ky gan day', async () => {
    const data = await getStats(fullTables());
    expect(data.totalStudents).toBe(12);
    expect(data.newStudents).toBe(3);
    expect(data.activeStudents).toBe(2); // u1, u2 (u1 trung 2 dong chi dem 1)
    expect(data.totalCourses).toBe(10);
    expect(data.publishedCourses).toBe(8);
    expect(data.totalEnrollments).toBe(20);
    expect(data.activeEnrollments).toBe(15);
    expect(data.totalOrders).toBe(7);
    expect(data.paidOrders).toBe(5);
    expect(data.totalRevenueVnd).toBe(350000);
    expect(data.revenueSource).toBe('payments');
    expect(data.revenueWarning).toBeNull();
    // e1: 1/2 bai; e2: 2/2 bai; e3 revoked khong tinh; e4 khoa 0 bai -> 3/4 = 75%
    expect(data.totalLessonsToLearn).toBe(4);
    expect(data.completedLessons).toBe(3);
    expect(data.completionRate).toBe(75);
    expect(data.courses).toHaveLength(2);
    expect(data.courses[0]).toMatchObject({
      courseId: 'c1',
      totalLessons: 2,
      enrollmentCount: 2,
      activeEnrollmentCount: 1,
      completedLessons: 3,
      completionRate: 75,
    });
    expect(data.courses[1]).toMatchObject({
      courseId: 'c2',
      totalLessons: 0,
      enrollmentCount: 1,
      completionRate: 0,
    });
    expect(data.recentEnrollments).toHaveLength(1);
    expect(data.recentEnrollments[0]).toMatchObject({
      enrollmentId: 'e1',
      studentName: 'Nguyễn Văn A',
      studentEmail: 'a@test.vn',
      courseTitle: 'Thấu Hiểu Nội Tâm',
      status: 'active',
    });
  });

  it('video 90% tinh la hoan thanh theo QĐ 17', async () => {
    const tables = fullTables();
    tables.lesson_progress = (q) => {
      if (q.selectCols === 'user_id') return { data: [{ user_id: 'u1' }], error: null, count: null };
      return {
        data: [{ user_id: 'u1', lesson_id: 'l1', status: 'in_progress', progress_percent: 90, updated_at: '2026-11-09T10:00:00Z' }],
        error: null,
        count: null,
      };
    };
    tables.enrollments = (q) => {
      if (q.isHead) return { data: [], error: null, count: 1 };
      if (q.selectCols.includes('profiles(')) return { data: [], error: null, count: null };
      return {
        data: [{ id: 'e1', user_id: 'u1', course_id: 'c1', status: 'active', enrolled_at: '2026-11-09T10:00:00Z' }],
        error: null,
        count: null,
      };
    };
    tables.lessons = rowsHandler([{ id: 'l1', course_module_id: 'm1', type: 'video' }]);
    const data = await getStats(tables);
    expect(data.completedLessons).toBe(1);
    expect(data.totalLessonsToLearn).toBe(1);
    expect(data.completionRate).toBe(100);
  });
});

describe('getAdminDashboardStats — empty state (chua co du lieu)', () => {
  it('moi so = 0, mang rong, khong bia so lieu', async () => {
    const data = await getStats(emptyTables());
    expect(data.totalStudents).toBe(0);
    expect(data.newStudents).toBe(0);
    expect(data.activeStudents).toBe(0);
    expect(data.totalCourses).toBe(0);
    expect(data.totalEnrollments).toBe(0);
    expect(data.totalOrders).toBe(0);
    expect(data.totalRevenueVnd).toBe(0);
    expect(data.revenueSource).toBe('payments');
    expect(data.completionRate).toBe(0);
    expect(data.courses).toEqual([]);
    expect(data.recentEnrollments).toEqual([]);
  });
});

describe('getAdminDashboardStats — fallback doanh thu + loi', () => {
  it('payments chua co (PGRST205) -> fallback orders paid + bao ro nguon', async () => {
    const tables = fullTables();
    tables.payments = errorHandler('Could not find the table public.payments in the schema cache', 'PGRST205');
    const data = await getStats(tables);
    expect(data.totalRevenueVnd).toBe(50000);
    expect(data.revenueSource).toBe('orders');
    expect(data.revenueWarning).toMatch(/đơn hàng đã thanh toán/);
  });

  it('ca payments va orders deu loi -> error state', async () => {
    const tables = fullTables();
    tables.payments = errorHandler('boom payments');
    tables.orders = (q) => {
      if (q.isHead) return { data: [], error: null, count: 7 };
      return { data: null, error: { message: 'boom orders' }, count: null };
    };
    const state = await getAdminDashboardStats(asClient(makeFakeClient(tables)));
    expect(state.status).toBe('error');
    if (state.status === 'error') expect(state.message).toMatch(/boom payments/);
  });

  it('profiles count loi -> error state, khong tra so gia', async () => {
    const tables = fullTables();
    tables.profiles = errorHandler('permission denied');
    const state = await getAdminDashboardStats(asClient(makeFakeClient(tables)));
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.message).toMatch(/permission denied/);
      expect(state.isOffline).toBe(false);
    }
  });

  it('enrollments loi -> error state', async () => {
    const tables = fullTables();
    tables.enrollments = errorHandler('enrollments boom');
    const state = await getAdminDashboardStats(asClient(makeFakeClient(tables)));
    expect(state.status).toBe('error');
  });
});
