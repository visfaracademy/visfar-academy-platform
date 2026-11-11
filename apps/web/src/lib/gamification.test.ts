// Test lib gamification (Prompt 14) — chay local, khong can Supabase that.
import { describe, expect, it } from 'vitest';
import {
  POINT_RULES,
  REASON_LABEL_VI,
  computeStreakFromDates,
  fetchMyAchievements,
  totalPoints,
  updateGamificationEnabled,
} from './gamification';

class FakeQuery {
  constructor(private result: { data: unknown; error: { message: string } | null }) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  update() {
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.result);
  }
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(onF, onR);
  }
}

function makeFakeClient(opts: {
  tables?: Record<string, { data: unknown; error: { message: string } | null }>;
  userId?: string | null;
  rpcError?: boolean;
}) {
  return {
    auth: {
      getUser: async () =>
        opts.userId === undefined || opts.userId
          ? { data: { user: { id: opts.userId ?? 'user-1', email: 'a@b.co' } } }
          : { data: { user: null } },
    },
    rpc: async () => (opts.rpcError ? { error: { message: 'rpc fail' } } : { data: null, error: null }),
    from(table: string) {
      const res = opts.tables?.[table] ?? { data: [], error: null };
      return new FakeQuery(res);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (c: unknown) => c as any;

describe('POINT_RULES — quy tac diem da chot (Prompt 14)', () => {
  it('du 5 quy tac, dung so diem', () => {
    expect(Object.fromEntries(POINT_RULES.map((r) => [r.reason, r.points]))).toEqual({
      lesson_completed: 10,
      quiz_passed: 20,
      course_completed: 100,
      community_helpful: 5,
      streak: 5,
    });
    expect(REASON_LABEL_VI.lesson_completed).toBe('Hoàn thành bài học');
  });
});

describe('totalPoints', () => {
  it('cong dung tong diem, bo qua diem 0/null', () => {
    expect(totalPoints([{ points: 10 }, { points: 20 }, { points: 100 }])).toBe(130);
    expect(totalPoints([])).toBe(0);
  });
});

describe('computeStreakFromDates — tinh tu ngay co tien do THAT', () => {
  it('hom nay + 2 ngay truoc lien tiep = 3', () => {
    expect(computeStreakFromDates(['2026-11-11', '2026-11-10', '2026-11-09'], '2026-11-11')).toBe(3);
  });

  it('hom nay chua hoc, hom qua + hom kia co hoc = 2', () => {
    expect(computeStreakFromDates(['2026-11-10', '2026-11-09'], '2026-11-11')).toBe(2);
  });

  it('hom nay chua hoc, hom qua khong hoc = 0 (khong tu khai)', () => {
    expect(computeStreakFromDates(['2026-11-09'], '2026-11-11')).toBe(0);
  });

  it('dut quang 1 ngay thi streak tinh tu doan moi nhat', () => {
    expect(computeStreakFromDates(['2026-11-11', '2026-11-09', '2026-11-08'], '2026-11-11')).toBe(1);
  });

  it('khong co ngay nao = 0', () => {
    expect(computeStreakFromDates([], '2026-11-11')).toBe(0);
  });
});

describe('fetchMyAchievements', () => {
  it('chua dang nhap -> signed-out', async () => {
    const res = await fetchMyAchievements(asClient(makeFakeClient({ userId: null })));
    expect(res.status).toBe('signed-out');
  });

  it('tra tong diem + streak + huy hieu (map tu bang badges)', async () => {
    const client = makeFakeClient({
      tables: {
        learning_points: {
          data: [
            { id: 'a', points: 10, reason: 'lesson_completed', related_id: 'l1', created_at: '2026-11-11T00:00:00Z' },
            { id: 'b', points: 20, reason: 'quiz_passed', related_id: 'q1', created_at: '2026-11-11T01:00:00Z' },
          ],
          error: null,
        },
        user_badges: {
          data: [
            {
              badge_id: 'bd1',
              earned_at: '2026-11-11T00:00:00Z',
              badges: { slug: 'khoi-dau', name: 'Khởi đầu', description: 'Bai dau tien', icon: '🌱' },
            },
          ],
          error: null,
        },
        badges: {
          data: [
            { id: 'bd1', slug: 'khoi-dau', name: 'Khởi đầu', description: 'Bai dau tien', icon: '🌱', rule: '1 bai' },
            { id: 'bd2', slug: 'kien-tri-7-ngay', name: 'Kiên trì 7 ngày', description: 'Streak 7', icon: '🔥', rule: '7 ngay' },
          ],
          error: null,
        },
        learning_streaks: {
          data: { current_streak: 3, longest_streak: 5, last_active_date: '2026-11-11' },
          error: null,
        },
        profiles: { data: { gamification_enabled: true }, error: null },
      },
    });
    const res = await fetchMyAchievements(asClient(client));
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    expect(res.data.totalPoints).toBe(30);
    expect(res.data.history).toHaveLength(2);
    expect(res.data.badges).toHaveLength(1);
    expect(res.data.badges[0].slug).toBe('khoi-dau');
    expect(res.data.catalog).toHaveLength(2);
    expect(res.data.streak.current_streak).toBe(3);
    expect(res.data.streak.longest_streak).toBe(5);
    expect(res.data.gamificationEnabled).toBe(true);
  });

  it('chua co du lieu -> tong 0, streak 0, khong bia so', async () => {
    const res = await fetchMyAchievements(asClient(makeFakeClient({})));
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;
    expect(res.data.totalPoints).toBe(0);
    expect(res.data.streak.current_streak).toBe(0);
    expect(res.data.badges).toEqual([]);
  });
});

describe('updateGamificationEnabled', () => {
  it('tat gamification tra ok', async () => {
    const res = await updateGamificationEnabled(false, asClient(makeFakeClient({})));
    expect(res.status).toBe('ok');
  });

  it('chua dang nhap -> signed-out', async () => {
    const res = await updateGamificationEnabled(false, asClient(makeFakeClient({ userId: null })));
    expect(res.status).toBe('signed-out');
  });
});
