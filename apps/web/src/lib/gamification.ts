// Gamification hoc tap (Prompt 14, GĐ2).
// QUY TAC DIEM (1 nguon su that = trigger + ham trong migration 0031;
// file nay CHI DOC + goi RPC refresh_my_gamification, KHONG tu cong diem):
// - Hoan thanh bai hoc            +10  (trigger lesson_progress)
// - Hoan thanh quiz dat           +20  (trigger quiz_attempts.passed)
// - Hoan thanh khoa hoc           +100 (trigger enrollments)
// - Bai cong dong duoc danh dau huu ich +5, toi da 1 lan/ngay
//   (trigger community_reactions type='helpful' tu nguoi khac)
// - Streak moi ngay hoc lien tiep +5 (ngay co tien do THAT trong
//   lesson_progress; ngay tinh theo UTC)
// Chong gian lan: client KHONG co policy ghi learning_points /
// user_badges / learning_streaks (chi SELECT dong cua minh); moi moc
// diem chi thuong 1 lan (UNIQUE user_id, reason, related_id).
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';

export const POINT_RULES = [
  { reason: 'lesson_completed', points: 10, label: 'Hoàn thành bài học' },
  { reason: 'quiz_passed', points: 20, label: 'Hoàn thành quiz đạt' },
  { reason: 'course_completed', points: 100, label: 'Hoàn thành khóa học' },
  { reason: 'community_helpful', points: 5, label: 'Bài cộng đồng được đánh dấu hữu ích (tối đa 1 lần/ngày)' },
  { reason: 'streak', points: 5, label: 'Ngày học liên tiếp (streak)' },
] as const;

export const REASON_LABEL_VI: Record<string, string> = Object.fromEntries(
  POINT_RULES.map((r) => [r.reason, r.label]),
);

export interface PointsRow {
  id: string;
  points: number;
  reason: string;
  related_id: string | null;
  created_at: string;
}

export interface MyBadge {
  badge_id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
}

export interface BadgeCatalogItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rule: string;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

export interface Achievements {
  totalPoints: number;
  history: PointsRow[];
  badges: MyBadge[];
  catalog: BadgeCatalogItem[];
  streak: StreakInfo;
  gamificationEnabled: boolean;
}

export type AchievementsState =
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; data: Achievements }
  | { status: 'error'; message: string; isOffline: boolean };

export function totalPoints(rows: Pick<PointsRow, 'points'>[]): number {
  return rows.reduce((s, r) => s + (r.points || 0), 0);
}

/**
 * Tinh streak hien tai tu danh sach ngay (YYYY-MM-DD) co tien do that.
 * Bat dau tu hom nay neu hom nay co hoc, neu khong tu hom qua; dem
 * nguoc ngay lien tiep. Hom nay chua hoc + hom qua khong hoc = 0.
 * `today` truyen vao de test duoc (mac dinh = ngay hien tai UTC).
 */
export function computeStreakFromDates(dates: string[], today?: string): number {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const set = new Set(dates);
  let day = todayStr;
  if (!set.has(day)) {
    const y = new Date(`${day}T00:00:00Z`);
    y.setUTCDate(y.getUTCDate() - 1);
    day = y.toISOString().slice(0, 10);
  }
  let streak = 0;
  for (;;) {
    if (!set.has(day)) break;
    streak += 1;
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    day = d.toISOString().slice(0, 10);
  }
  return streak;
}

function resolveClient(client?: SupabaseClient | null): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isSupabaseConfigured()) return null;
  return getSupabaseBrowserClient();
}

function toErrorState(err: unknown, fallback: string): AchievementsState {
  const isOffline =
    err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
  return {
    status: 'error',
    message: isOffline ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.' : fallback,
    isOffline,
  };
}

export async function fetchMyAchievements(
  client?: SupabaseClient | null,
): Promise<AchievementsState> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    // Tinh lai streak + huy hieu cua chinh minh truoc khi doc (RPC
    // dung auth.uid(), khong nhan user_id tu client).
    await supabase.rpc('refresh_my_gamification');
    const [pointsRes, badgesRes, catalogRes, streakRes, profileRes] = await Promise.all([
      supabase
        .from('learning_points')
        .select('id, points, reason, related_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('user_badges')
        .select('badge_id, earned_at, badges(slug, name, description, icon)')
        .order('earned_at', { ascending: false }),
      supabase.from('badges').select('id, slug, name, description, icon, rule'),
      supabase
        .from('learning_streaks')
        .select('current_streak, longest_streak, last_active_date')
        .eq('user_id', authData.user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('gamification_enabled')
        .eq('id', authData.user.id)
        .maybeSingle(),
    ]);
    if (pointsRes.error || badgesRes.error || catalogRes.error || streakRes.error) {
      return { status: 'error', message: 'Không tải được thành tích.', isOffline: false };
    }
    // Cot gamification_enabled chi co tu migration 0031 (moi ap staging).
    // Neu profiles query loi (vd DB prod chua co cot) thi mac dinh bat,
    // khong lam hong ca trang thanh tich.
    const history = (pointsRes.data ?? []) as PointsRow[];
    const badges: MyBadge[] = ((badgesRes.data ?? []) as unknown as {
      badge_id: string;
      earned_at: string;
      badges: { slug: string; name: string; description: string; icon: string } | null;
    }[]).map((b) => ({
      badge_id: b.badge_id,
      slug: b.badges?.slug ?? '',
      name: b.badges?.name ?? '',
      description: b.badges?.description ?? '',
      icon: b.badges?.icon ?? '🏅',
      earned_at: b.earned_at,
    }));
    const streakRaw = streakRes.data as unknown;
    const streakRow =
      streakRaw && typeof streakRaw === 'object' && !Array.isArray(streakRaw)
        ? (streakRaw as StreakInfo)
        : null;
    return {
      status: 'success',
      data: {
        totalPoints: totalPoints(history),
        history,
        badges,
        catalog: (catalogRes.data ?? []) as BadgeCatalogItem[],
        streak: streakRow ?? { current_streak: 0, longest_streak: 0, last_active_date: null },
        gamificationEnabled:
          profileRes.error
            ? true
            : ((profileRes.data as { gamification_enabled?: boolean } | null)?.gamification_enabled ?? true),
      },
    };
  } catch (err) {
    return toErrorState(err, 'Không tải được thành tích.');
  }
}

/** Tat / bat lai gamification trong cai dat ho so (profiles). */
export async function updateGamificationEnabled(
  enabled: boolean,
  client?: SupabaseClient | null,
): Promise<{ status: 'ok' } | { status: 'signed-out' } | { status: 'error'; message: string }> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { error } = await supabase
      .from('profiles')
      .update({ gamification_enabled: enabled })
      .eq('id', authData.user.id);
    if (error) return { status: 'error', message: 'Không lưu được cài đặt.' };
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Không lưu được cài đặt.' };
  }
}
