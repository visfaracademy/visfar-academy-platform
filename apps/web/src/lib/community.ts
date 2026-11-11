// Cong dong hoc tap VISFAR (Prompt 13, GĐ2).
// - Chi hoc vien da dang nhap doc/ghi (RLS migration 0030); trang
//   /cong-dong hien thong bao dang nhap khi chua co phien.
// - KHONG feed vo han, khong video tu phat: phan trang theo lo 20 bai,
//   nut "Xem them"; chi hoc tap / hoi dap / chia se thanh tich.
// - Khong lo PII: ten hien thi luu san author_name luc dang bai (lay
//   tu ho so cua chinh tac gia); khong join bang profiles.
// - Tac gia sua/xoa bai cua minh; instructor/admin kiem duyet
//   (an/hien/ghim/xoa) o /admin/cong-dong.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';

export type ReactionType = 'like' | 'helpful' | 'celebrate';

export const REACTION_TYPES: { type: ReactionType; label: string }[] = [
  { type: 'like', label: 'Thích' },
  { type: 'helpful', label: 'Hữu ích' },
  { type: 'celebrate', label: 'Chúc mừng' },
];

export interface CommunityPost {
  id: string;
  author_id: string;
  course_id: string | null;
  title: string;
  body: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  status: 'visible' | 'hidden';
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  author_name: string;
  created_at: string;
}

export interface CommunityReport {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reporter_id: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}

export type ReactionCounts = Record<ReactionType, number>;

export const EMPTY_REACTION_COUNTS: ReactionCounts = { like: 0, helpful: 0, celebrate: 0 };

export type CommunityState<T> =
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string; isOffline: boolean };

export type CommunityActionResult =
  | { status: 'ok'; id?: string }
  | { status: 'signed-out' }
  | { status: 'error'; message: string };

export const COMMUNITY_PAGE_SIZE = 20;

export function validatePost(input: { title: string; body: string }): string[] {
  const errors: string[] = [];
  if (input.title.trim().length < 3) errors.push('Tiêu đề cần ít nhất 3 ký tự.');
  if (input.title.trim().length > 200) errors.push('Tiêu đề tối đa 200 ký tự.');
  if (input.body.trim().length < 1) errors.push('Nội dung không được để trống.');
  if (input.body.trim().length > 5000) errors.push('Nội dung tối đa 5000 ký tự.');
  return errors;
}

export function validateComment(body: string): string[] {
  const errors: string[] = [];
  if (body.trim().length < 1) errors.push('Bình luận không được để trống.');
  if (body.trim().length > 2000) errors.push('Bình luận tối đa 2000 ký tự.');
  return errors;
}

export function validateReport(reason: string): string[] {
  const errors: string[] = [];
  if (reason.trim().length < 3) errors.push('Lý do báo cáo cần ít nhất 3 ký tự.');
  if (reason.trim().length > 500) errors.push('Lý do báo cáo tối đa 500 ký tự.');
  return errors;
}

/** Gom so luot cam xuc theo loai tu danh sach dong reactions tho. */
export function groupReactions(
  rows: { post_id?: string | null; comment_id?: string | null; type: string; user_id: string }[],
  targetId: string,
  targetKind: 'post' | 'comment',
): { counts: ReactionCounts; myReactions: ReactionType[]; total: number } {
  const counts: ReactionCounts = { ...EMPTY_REACTION_COUNTS };
  const myReactions: ReactionType[] = [];
  let total = 0;
  for (const r of rows) {
    const match =
      targetKind === 'post' ? r.post_id === targetId : r.comment_id === targetId;
    if (!match) continue;
    if (r.type === 'like' || r.type === 'helpful' || r.type === 'celebrate') {
      counts[r.type] += 1;
      total += 1;
    }
  }
  return { counts, myReactions, total };
}

function toError(err: unknown, fallback: string): { status: 'error'; message: string; isOffline: boolean } {
  const isOffline =
    err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
  return {
    status: 'error',
    message: isOffline ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.' : fallback,
    isOffline,
  };
}

function resolveClient(client?: SupabaseClient | null): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!isSupabaseConfigured()) return null;
  return getSupabaseBrowserClient();
}

export interface PostListItem {
  post: CommunityPost;
  counts: ReactionCounts;
  myReactions: ReactionType[];
  commentCount: number;
}

export async function fetchCommunityPosts(
  opts: { courseId?: string | null; limit?: number; offset?: number; includeHidden?: boolean },
  client?: SupabaseClient | null,
): Promise<
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; items: PostListItem[]; hasMore: boolean }
  | { status: 'error'; message: string; isOffline: boolean }
> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const limit = opts.limit ?? COMMUNITY_PAGE_SIZE;
    const offset = opts.offset ?? 0;
    let q = supabase
      .from('community_posts')
      .select('id, author_id, course_id, title, body, author_name, created_at, updated_at, is_pinned, status')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      // range() bao ca 2 dau: lay limit+1 de biet con trang sau khong.
      .range(offset, offset + limit);
    if (opts.courseId) q = q.eq('course_id', opts.courseId);
    if (!opts.includeHidden) q = q.eq('status', 'visible');
    const { data, error } = await q;
    if (error) return { status: 'error', message: 'Không tải được danh sách bài viết.', isOffline: false };
    const allPosts = (data ?? []) as CommunityPost[];
    const hasMore = allPosts.length > limit;
    const posts = allPosts.slice(0, limit);
    const ids = posts.map((p) => p.id);
    const countsByPost: Record<string, ReactionCounts> = {};
    const myByPost: Record<string, ReactionType[]> = {};
    const commentsByPost: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: reactions } = await supabase
        .from('community_reactions')
        .select('post_id, type, user_id')
        .in('post_id', ids);
      for (const r of (reactions ?? []) as { post_id: string; type: string; user_id: string }[]) {
        if (r.type !== 'like' && r.type !== 'helpful' && r.type !== 'celebrate') continue;
        const c = countsByPost[r.post_id] ?? { ...EMPTY_REACTION_COUNTS };
        c[r.type as ReactionType] += 1;
        countsByPost[r.post_id] = c;
        if (r.user_id === authData.user!.id) {
          const mine = myByPost[r.post_id] ?? [];
          mine.push(r.type as ReactionType);
          myByPost[r.post_id] = mine;
        }
      }
      const { data: comments } = await supabase
        .from('community_comments')
        .select('post_id')
        .in('post_id', ids);
      for (const c of (comments ?? []) as { post_id: string }[]) {
        commentsByPost[c.post_id] = (commentsByPost[c.post_id] ?? 0) + 1;
      }
    }
    const items: PostListItem[] = posts.map((p) => ({
      post: p,
      counts: countsByPost[p.id] ?? { ...EMPTY_REACTION_COUNTS },
      myReactions: myByPost[p.id] ?? [],
      commentCount: commentsByPost[p.id] ?? 0,
    }));
    return { status: 'success', items, hasMore };
  } catch (err) {
    return toError(err, 'Không tải được danh sách bài viết.');
  }
}

export async function fetchCommunityPostDetail(
  postId: string,
  client?: SupabaseClient | null,
): Promise<
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; post: CommunityPost; comments: CommunityComment[]; counts: ReactionCounts; myReactions: ReactionType[] }
  | { status: 'error'; message: string; isOffline: boolean }
> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { data: post, error } = await supabase
      .from('community_posts')
      .select('id, author_id, course_id, title, body, author_name, created_at, updated_at, is_pinned, status')
      .eq('id', postId)
      .maybeSingle();
    if (error || !post) return { status: 'error', message: 'Không tìm thấy bài viết.', isOffline: false };
    const { data: comments } = await supabase
      .from('community_comments')
      .select('id, post_id, author_id, body, author_name, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    const { data: reactions } = await supabase
      .from('community_reactions')
      .select('post_id, comment_id, type, user_id')
      .eq('post_id', postId);
    const rows = (reactions ?? []) as { post_id: string | null; comment_id: string | null; type: string; user_id: string }[];
    const g = groupReactions(rows, postId, 'post');
    const myReactions = rows
      .filter((r) => r.post_id === postId && r.user_id === authData.user!.id)
      .map((r) => r.type)
      .filter((t): t is ReactionType => t === 'like' || t === 'helpful' || t === 'celebrate');
    return {
      status: 'success',
      post: post as CommunityPost,
      comments: (comments ?? []) as CommunityComment[],
      counts: g.counts,
      myReactions,
    };
  } catch (err) {
    return toError(err, 'Không tải được bài viết.');
  }
}

async function getMyDisplayName(
  supabase: SupabaseClient,
  userId: string,
  email: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  const name = (data as { full_name?: string | null } | null)?.full_name?.trim();
  return name || email;
}

export async function createCommunityPost(
  input: { title: string; body: string; courseId?: string | null },
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const errors = validatePost(input);
  if (errors.length > 0) return { status: 'error', message: errors[0] };
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const authorName = await getMyDisplayName(supabase, authData.user.id, authData.user.email ?? '');
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        author_id: authData.user.id,
        course_id: input.courseId ?? null,
        title: input.title.trim(),
        body: input.body.trim(),
        author_name: authorName,
      })
      .select('id')
      .single();
    if (error) return { status: 'error', message: 'Không đăng được bài viết. Vui lòng thử lại.' };
    return { status: 'ok', id: (data as { id: string } | null)?.id };
  } catch {
    return { status: 'error', message: 'Không đăng được bài viết. Vui lòng thử lại.' };
  }
}

export async function updateCommunityPost(
  postId: string,
  input: { title: string; body: string },
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const errors = validatePost(input);
  if (errors.length > 0) return { status: 'error', message: errors[0] };
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { error } = await supabase
      .from('community_posts')
      .update({ title: input.title.trim(), body: input.body.trim() })
      .eq('id', postId)
      .eq('author_id', authData.user.id);
    if (error) return { status: 'error', message: 'Không sửa được bài viết.' };
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Không sửa được bài viết.' };
  }
}

export async function deleteCommunityPost(
  postId: string,
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { error } = await supabase.from('community_posts').delete().eq('id', postId);
    if (error) return { status: 'error', message: 'Không xóa được bài viết.' };
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Không xóa được bài viết.' };
  }
}

export async function addCommunityComment(
  postId: string,
  body: string,
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const errors = validateComment(body);
  if (errors.length > 0) return { status: 'error', message: errors[0] };
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const authorName = await getMyDisplayName(supabase, authData.user.id, authData.user.email ?? '');
    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: postId, author_id: authData.user.id, body: body.trim(), author_name: authorName })
      .select('id')
      .single();
    if (error) return { status: 'error', message: 'Không gửi được bình luận.' };
    return { status: 'ok', id: (data as { id: string } | null)?.id };
  } catch {
    return { status: 'error', message: 'Không gửi được bình luận.' };
  }
}

/** Bam lai 1 cam xuc da tha = bo cam xuc do (toggle). */
export async function toggleReaction(
  target: { postId?: string; commentId?: string },
  type: ReactionType,
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const col = target.postId ? 'post_id' : 'comment_id';
    const targetId = (target.postId ?? target.commentId) as string;
    const { data: existing } = await supabase
      .from('community_reactions')
      .select('id')
      .eq(col, targetId)
      .eq('user_id', authData.user.id)
      .eq('type', type)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('community_reactions')
        .delete()
        .eq('id', (existing as { id: string }).id);
      if (error) return { status: 'error', message: 'Không bỏ được cảm xúc.' };
      return { status: 'ok' };
    }
    const { error } = await supabase.from('community_reactions').insert({
      post_id: target.postId ?? null,
      comment_id: target.commentId ?? null,
      user_id: authData.user.id,
      type,
    });
    if (error) return { status: 'error', message: 'Không thả được cảm xúc.' };
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Không thả được cảm xúc.' };
  }
}

export async function reportContent(
  target: { postId?: string; commentId?: string },
  reason: string,
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const errors = validateReport(reason);
  if (errors.length > 0) return { status: 'error', message: errors[0] };
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { error } = await supabase.from('community_reports').insert({
      post_id: target.postId ?? null,
      comment_id: target.commentId ?? null,
      reporter_id: authData.user.id,
      reason: reason.trim(),
    });
    if (error) return { status: 'error', message: 'Không gửi được báo cáo.' };
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Không gửi được báo cáo.' };
  }
}

// --- Kiem duyet (admin / instructor) ---------------------------------------
export async function moderatePost(
  postId: string,
  patch: { status?: 'visible' | 'hidden'; is_pinned?: boolean },
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { error } = await supabase.from('community_posts').update(patch).eq('id', postId);
    if (error) return { status: 'error', message: 'Không cập nhật được bài viết.' };
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Không cập nhật được bài viết.' };
  }
}

export async function fetchCommunityReports(
  client?: SupabaseClient | null,
): Promise<CommunityState<CommunityReport[]>> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { data, error } = await supabase
      .from('community_reports')
      .select('id, post_id, comment_id, reporter_id, reason, status, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return { status: 'error', message: 'Không tải được danh sách báo cáo.', isOffline: false };
    return { status: 'success', data: (data ?? []) as CommunityReport[] };
  } catch (err) {
    return toError(err, 'Không tải được danh sách báo cáo.');
  }
}

export async function resolveReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  client?: SupabaseClient | null,
): Promise<CommunityActionResult> {
  const supabase = resolveClient(client);
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase.' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { status: 'signed-out' };
    const { error } = await supabase
      .from('community_reports')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', reportId);
    if (error) return { status: 'error', message: 'Không xử lý được báo cáo.' };
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Không xử lý được báo cáo.' };
  }
}
