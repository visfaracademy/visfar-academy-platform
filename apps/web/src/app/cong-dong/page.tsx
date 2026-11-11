// Trang /cong-dong — Cong dong hoc tap VISFAR (Prompt 13, GĐ2).
// Chi hoc vien da dang nhap doc/ghi (RLS migration 0030).
// KHONG feed vo han, khong video tu phat: danh sach theo lo 20 bai +
// nut "Xem them"; loc theo khoa hoc hoac tat ca; tap trung hoc tap,
// hoi dap, chia se thanh tich. Du lieu that tu Supabase.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  COMMUNITY_PAGE_SIZE,
  createCommunityPost,
  fetchCommunityPosts,
  type PostListItem,
} from '@/lib/community';
import { fetchPublishedCourses } from '@/lib/courses';
import ReactionButtons from '@/components/community/ReactionButtons';

type LoadState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; items: PostListItem[]; hasMore: boolean }
  | { status: 'error'; message: string };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function CongDongPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [courseId, setCourseId] = useState<string>('');
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postCourseId, setPostCourseId] = useState<string>('');
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setState({ status: 'loading' });
      }
      const res = await fetchCommunityPosts({
        courseId: courseId || null,
        limit: COMMUNITY_PAGE_SIZE,
        offset,
      });
      setLoadingMore(false);
      if (res.status === 'success') {
        setState((prev) => {
          if (append && prev.status === 'success') {
            return { status: 'success', items: [...prev.items, ...res.items], hasMore: res.hasMore };
          }
          return { status: 'success', items: res.items, hasMore: res.hasMore };
        });
      } else if (res.status === 'signed-out') {
        setState({ status: 'signed-out' });
      } else if (res.status === 'not-configured') {
        setState({ status: 'not-configured' });
      } else {
        setState({ status: 'error', message: res.message });
      }
    },
    [courseId],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetchPublishedCourses();
      if (res.status === 'success') {
        setCourses(res.courses.map((c) => ({ id: c.id, title: c.title })));
      }
    })();
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setPostMsg(null);
    setPosting(true);
    const res = await createCommunityPost({ title, body, courseId: postCourseId || null });
    setPosting(false);
    if (res.status === 'ok') {
      setTitle('');
      setBody('');
      setPostCourseId('');
      setPostMsg({ kind: 'success', text: 'Đã đăng bài viết.' });
      void load(0, false);
    } else if (res.status === 'signed-out') {
      setPostMsg({ kind: 'error', text: 'Bạn cần đăng nhập để đăng bài.' });
    } else {
      setPostMsg({ kind: 'error', text: res.message });
    }
  }

  const items = state.status === 'success' ? state.items : [];
  const hasMore = state.status === 'success' ? state.hasMore : false;

  return (
    <div className="wrap">
      <h1 className="gold-title">Cộng đồng VISFAR</h1>
      <p>
        Cộng đồng học tập suốt đời của Visfar Academy — nơi học viên hỏi đáp, chia sẻ
        bài học và thành tích cùng nhau. Vui lòng giữ thái độ tôn trọng, không đăng
        nội dung quảng cáo hay gây mất tập trung.
      </p>

      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
          <p>Chưa có biến môi trường NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
        </div>
      )}

      {state.status === 'signed-out' && (
        <div className="notice" role="status">
          <p>Cộng đồng chỉ dành cho học viên đã đăng nhập.</p>
          <p>
            <Link className="btn" href="/dang-nhap?next=/cong-dong">
              Đăng nhập
            </Link>{' '}
            <Link className="btn btn-ghost" href="/dang-ky">
              Đăng ký
            </Link>
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được danh sách bài viết.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load(0, false)}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status !== 'signed-out' && state.status !== 'not-configured' && (
        <>
          <section className="card" aria-labelledby="dang-bai-title">
            <h2 id="dang-bai-title" className="gold-title">
              Đăng bài viết mới
            </h2>
            <form onSubmit={handlePost}>
              <p>
                <label htmlFor="post-title">Tiêu đề</label>
                <input
                  id="post-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={posting}
                  maxLength={200}
                  placeholder="Ví dụ: Cách mình duy trì thói quen học mỗi sáng"
                />
              </p>
              <p>
                <label htmlFor="post-body">Nội dung</label>
                <textarea
                  id="post-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={posting}
                  rows={4}
                  maxLength={5000}
                  placeholder="Chia sẻ bài học, đặt câu hỏi hoặc kể về một thành tích bạn vừa đạt được…"
                />
              </p>
              <p>
                <label htmlFor="post-course">Khóa học liên quan (không bắt buộc)</label>
                <select
                  id="post-course"
                  value={postCourseId}
                  onChange={(e) => setPostCourseId(e.target.value)}
                  disabled={posting}
                >
                  <option value="">Chung cho cả cộng đồng</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </p>
              <p>
                <button type="submit" className="btn btn-gold" disabled={posting}>
                  {posting ? 'Đang đăng…' : 'Đăng bài'}
                </button>
              </p>
              {postMsg && (
                <p className={postMsg.kind === 'success' ? 'success-text' : 'error-text'} role="status">
                  {postMsg.text}
                </p>
              )}
            </form>
          </section>

          <section aria-labelledby="danh-sach-title" style={{ marginTop: '1.5rem' }}>
            <h2 id="danh-sach-title" className="gold-title">
              Bài viết
            </h2>
            <p>
              <label htmlFor="filter-course">Lọc theo khóa học</label>{' '}
              <select
                id="filter-course"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Tất cả bài viết</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </p>

            {state.status === 'loading' && (
              <p role="status" aria-live="polite">
                Đang tải danh sách bài viết…
              </p>
            )}

            {state.status === 'success' && items.length === 0 && (
              <div className="notice">
                <p>Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!</p>
              </div>
            )}

            {items.length > 0 && (
              <div className="community-list">
                {items.map(({ post, counts, myReactions: itemMyReactions, commentCount }) => (
                  <article className="card community-post" key={post.id}>
                    <h3>
                      <Link href={`/cong-dong/${post.id}`}>{post.title}</Link>
                    </h3>
                    <p className="muted">
                      {post.is_pinned && <strong>📌 Đã ghim · </strong>}
                      {post.author_name || 'Học viên'} · {formatDate(post.created_at)}
                    </p>
                    <p>{post.body.length > 300 ? `${post.body.slice(0, 300)}…` : post.body}</p>
                    <p>
                      <Link href={`/cong-dong/${post.id}`}>💬 {commentCount} bình luận</Link>
                    </p>
                    <ReactionButtons
                      postId={post.id}
                      counts={counts}
                      myReactions={itemMyReactions}
                      onChanged={() => void load(0, false)}
                    />
                  </article>
                ))}
              </div>
            )}

            {hasMore && (
              <p>
                <button
                  type="button"
                  className="btn"
                  disabled={loadingMore}
                  onClick={() => void load(items.length, true)}
                >
                  {loadingMore ? 'Đang tải…' : 'Xem thêm'}
                </button>
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
