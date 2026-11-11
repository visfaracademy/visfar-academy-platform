// Trang /admin/cong-dong — kiem duyet cong dong (Prompt 13).
// Chi admin/instructor (layout /admin chan san bang requireAdmin).
// Duyet/an/hien/ghim/xoa bai; xu ly bao cao (resolved/dismissed).
// Du lieu that tu Supabase (RLS migration 0030).
'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import {
  COMMUNITY_PAGE_SIZE,
  deleteCommunityPost,
  fetchCommunityPosts,
  fetchCommunityReports,
  moderatePost,
  resolveReport,
  type CommunityReport,
  type PostListItem,
} from '@/lib/community';

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

export default function AdminCongDongPage() {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [reportsError, setReportsError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const loadPosts = useCallback(async (offset: number, append: boolean) => {
    if (!append) setLoading(true);
    const res = await fetchCommunityPosts({ limit: COMMUNITY_PAGE_SIZE, offset, includeHidden: true });
    setLoading(false);
    if (res.status === 'success') {
      setPosts((prev) => (append ? [...prev, ...res.items] : res.items));
      setHasMore(res.hasMore);
      setLoadError('');
    } else if (res.status === 'signed-out') {
      setLoadError('Bạn cần đăng nhập.');
    } else {
      setLoadError(res.status === 'error' ? res.message : 'Không tải được danh sách bài viết.');
    }
  }, []);

  const loadReports = useCallback(async () => {
    const res = await fetchCommunityReports();
    if (res.status === 'success') {
      setReports(res.data);
      setReportsError('');
    } else {
      setReportsError(res.status === 'error' ? res.message : 'Không tải được danh sách báo cáo.');
    }
  }, []);

  useEffect(() => {
    void loadPosts(0, false);
    void loadReports();
  }, [loadPosts, loadReports]);

  async function runAction(id: string, fn: () => Promise<{ status: string; message?: string }>, okText: string) {
    setBusyId(id);
    setActionMsg(null);
    const res = await fn();
    setBusyId(null);
    if (res.status === 'ok') {
      setActionMsg({ kind: 'success', text: okText });
      void loadPosts(0, false);
      void loadReports();
    } else {
      setActionMsg({
        kind: 'error',
        text: res.status === 'signed-out' ? 'Bạn cần đăng nhập.' : (res.message ?? 'Thao tác thất bại.'),
      });
    }
  }

  const openReports = reports.filter((r) => r.status === 'open');

  return (
    <div>
      <h1 className="gold-title">Kiểm duyệt cộng đồng</h1>
      <p>
        Bài viết bị ẩn chỉ tác giả và người kiểm duyệt thấy được. Báo cáo mở cần được
        xử lý: ẩn/xóa bài vi phạm rồi đánh dấu báo cáo đã xử lý, hoặc bỏ qua nếu
        báo cáo không đúng.
      </p>
      {actionMsg && (
        <p className={actionMsg.kind === 'success' ? 'success-text' : 'error-text'} role="status">
          {actionMsg.text}
        </p>
      )}

      <section aria-labelledby="bao-cao-title">
        <h2 id="bao-cao-title" className="gold-title">
          Báo cáo chờ xử lý ({openReports.length})
        </h2>
        {reportsError && (
          <div className="notice error" role="alert">
            <p>{reportsError}</p>
          </div>
        )}
        {openReports.length === 0 && !reportsError && (
          <div className="notice">
            <p>Không có báo cáo nào đang mở.</p>
          </div>
        )}
        {openReports.length > 0 && (
          <ul className="dashboard-list">
            {openReports.map((r) => (
              <li key={r.id} className="list-row">
                <p>
                  <strong>{r.post_id ? 'Bài viết' : 'Bình luận'}:</strong>{' '}
                  {r.post_id ? r.post_id : r.comment_id}
                </p>
                <p>
                  Lý do: {r.reason} · {formatDate(r.created_at)}
                </p>
                <p>
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={busyId === r.id}
                    onClick={() => void runAction(r.id, () => resolveReport(r.id, 'resolved'), 'Đã đánh dấu báo cáo đã xử lý.')}
                  >
                    Đã xử lý
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    disabled={busyId === r.id}
                    onClick={() => void runAction(r.id, () => resolveReport(r.id, 'dismissed'), 'Đã bỏ qua báo cáo.')}
                  >
                    Bỏ qua
                  </button>
                </p>
              </li>
            ))}
          </ul>
        )}
        {reports.filter((r) => r.status !== 'open').length > 0 && (
          <p className="muted">Đã xử lý: {reports.filter((r) => r.status !== 'open').length} báo cáo.</p>
        )}
      </section>

      <section aria-labelledby="bai-viet-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="bai-viet-title" className="gold-title">
          Bài viết ({posts.length})
        </h2>
        {loading && (
          <p role="status" aria-live="polite">
            Đang tải danh sách bài viết…
          </p>
        )}
        {loadError && (
          <div className="notice error" role="alert">
            <p>{loadError}</p>
            <p>
              <button type="button" className="btn" onClick={() => void loadPosts(0, false)}>
                Thử lại
              </button>
            </p>
          </div>
        )}
        {!loading && posts.length === 0 && !loadError && (
          <div className="notice">
            <p>Chưa có bài viết nào trong cộng đồng.</p>
          </div>
        )}
        {posts.length > 0 && (
          <ul className="dashboard-list">
            {posts.map(({ post, commentCount }) => (
              <li key={post.id} className="list-row">
                <p>
                  <strong>{post.title}</strong>{' '}
                  {post.status === 'hidden' && <span className="error-text">(Đang ẩn)</span>}
                  {post.is_pinned && <span> 📌</span>}
                </p>
                <p className="muted">
                  {post.author_name || 'Học viên'} · {formatDate(post.created_at)} · {commentCount} bình luận
                </p>
                <p>
                  {post.status === 'visible' ? (
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={busyId === post.id}
                      onClick={() =>
                        void runAction(post.id, () => moderatePost(post.id, { status: 'hidden' }), 'Đã ẩn bài viết.')
                      }
                    >
                      Ẩn bài
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={busyId === post.id}
                      onClick={() =>
                        void runAction(post.id, () => moderatePost(post.id, { status: 'visible' }), 'Đã hiện lại bài viết.')
                      }
                    >
                      Hiện lại
                    </button>
                  )}{' '}
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    disabled={busyId === post.id}
                    onClick={() =>
                      void runAction(
                        post.id,
                        () => moderatePost(post.id, { is_pinned: !post.is_pinned }),
                        post.is_pinned ? 'Đã bỏ ghim bài viết.' : 'Đã ghim bài viết.',
                      )
                    }
                  >
                    {post.is_pinned ? 'Bỏ ghim' : 'Ghim'}
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    disabled={busyId === post.id}
                    onClick={() => {
                      if (!window.confirm('Xóa bài viết này? Không thể hoàn tác.')) return;
                      void runAction(post.id, () => deleteCommunityPost(post.id), 'Đã xóa bài viết.');
                    }}
                  >
                    Xóa
                  </button>
                </p>
              </li>
            ))}
          </ul>
        )}
        {hasMore && (
          <p>
            <button type="button" className="btn" onClick={() => void loadPosts(posts.length, true)}>
              Xem thêm
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
