// Trang /cong-dong/[id] — chi tiet bai viet cong dong (Prompt 13).
// Binh luan, tha cam xuc, bao cao noi dung; tac gia sua/xoa bai cua minh.
// Du lieu that tu Supabase; chi hoc vien da dang nhap.
'use client';

export const runtime = 'edge';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  addCommunityComment,
  deleteCommunityPost,
  fetchCommunityPostDetail,
  reportContent,
  updateCommunityPost,
  type CommunityComment,
  type CommunityPost,
  type ReactionCounts,
  type ReactionType,
} from '@/lib/community';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import ReactionButtons from '@/components/community/ReactionButtons';

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

export default function CongDongDetailPage() {
  const params = useParams();
  const postId = typeof params.id === 'string' ? params.id : '';
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [counts, setCounts] = useState<ReactionCounts>({ like: 0, helpful: 0, celebrate: 0 });
  const [myReactions, setMyReactions] = useState<ReactionType[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'not-configured' | 'signed-out' | 'success' | 'error'>(
    'loading',
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentMsg, setCommentMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMsg, setReportMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) {
      setStatus('error');
      setErrorMsg('Không tìm thấy bài viết.');
      return;
    }
    setStatus('loading');
    const res = await fetchCommunityPostDetail(postId);
    if (res.status === 'success') {
      setPost(res.post);
      setComments(res.comments);
      setCounts(res.counts);
      setMyReactions(res.myReactions);
      setStatus('success');
    } else if (res.status === 'signed-out') {
      setStatus('signed-out');
    } else if (res.status === 'not-configured') {
      setStatus('not-configured');
    } else {
      setStatus('error');
      setErrorMsg(res.message);
    }
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      setMyUserId(data.user?.id ?? null);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentMsg(null);
    setSendingComment(true);
    const res = await addCommunityComment(postId, commentBody);
    setSendingComment(false);
    if (res.status === 'ok') {
      setCommentBody('');
      setCommentMsg({ kind: 'success', text: 'Đã gửi bình luận.' });
      void load();
    } else if (res.status === 'signed-out') {
      setCommentMsg({ kind: 'error', text: 'Bạn cần đăng nhập để bình luận.' });
    } else {
      setCommentMsg({ kind: 'error', text: res.message });
    }
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    setReportMsg(null);
    setSendingReport(true);
    const res = await reportContent({ postId }, reportReason);
    setSendingReport(false);
    if (res.status === 'ok') {
      setReportReason('');
      setShowReport(false);
      setReportMsg({ kind: 'success', text: 'Đã gửi báo cáo. Quản trị viên sẽ xem xét.' });
    } else if (res.status === 'signed-out') {
      setReportMsg({ kind: 'error', text: 'Bạn cần đăng nhập để báo cáo.' });
    } else {
      setReportMsg({ kind: 'error', text: res.message });
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditMsg(null);
    const res = await updateCommunityPost(postId, { title: editTitle, body: editBody });
    if (res.status === 'ok') {
      setEditing(false);
      void load();
    } else {
      setEditMsg(res.status === 'signed-out' ? 'Bạn cần đăng nhập.' : res.message);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Xóa bài viết này? Bình luận và cảm xúc kèm theo cũng sẽ bị xóa.')) return;
    setDeleting(true);
    setDeleteMsg(null);
    const res = await deleteCommunityPost(postId);
    setDeleting(false);
    if (res.status === 'ok') {
      setPost(null);
      setStatus('error');
      setErrorMsg('Bài viết đã được xóa.');
    } else {
      setDeleteMsg(res.status === 'signed-out' ? 'Bạn cần đăng nhập.' : res.message);
    }
  }

  const isAuthor = post !== null && myUserId !== null && post.author_id === myUserId;

  return (
    <div className="wrap">
      <p>
        <Link href="/cong-dong">← Về cộng đồng</Link>
      </p>

      {status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải bài viết…
        </p>
      )}

      {status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
        </div>
      )}

      {status === 'signed-out' && (
        <div className="notice" role="status">
          <p>Cộng đồng chỉ dành cho học viên đã đăng nhập.</p>
          <p>
            <Link className="btn" href={`/dang-nhap?next=/cong-dong/${postId}`}>
              Đăng nhập
            </Link>
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>{errorMsg || 'Không tải được bài viết.'}</strong>
          </p>
          <p>
            <Link className="btn" href="/cong-dong">
              Về cộng đồng
            </Link>
          </p>
        </div>
      )}

      {status === 'success' && post && (
        <>
          <article className="card">
            {editing ? (
              <form onSubmit={handleEdit}>
                <p>
                  <label htmlFor="edit-title">Tiêu đề</label>
                  <input
                    id="edit-title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={200}
                  />
                </p>
                <p>
                  <label htmlFor="edit-body">Nội dung</label>
                  <textarea
                    id="edit-body"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={5}
                    maxLength={5000}
                  />
                </p>
                <p>
                  <button type="submit" className="btn btn-gold">
                    Lưu thay đổi
                  </button>{' '}
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                    Hủy
                  </button>
                </p>
                {editMsg && (
                  <p className="error-text" role="alert">
                    {editMsg}
                  </p>
                )}
              </form>
            ) : (
              <>
                <h1 className="gold-title">{post.title}</h1>
                <p className="muted">
                  {post.is_pinned && <strong>📌 Đã ghim · </strong>}
                  {post.author_name || 'Học viên'} · {formatDate(post.created_at)}
                  {post.status === 'hidden' && ' · Bài viết đang bị ẩn (chỉ bạn và quản trị viên thấy)'}
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>
              </>
            )}
            <ReactionButtons postId={post.id} counts={counts} myReactions={myReactions} onChanged={() => void load()} />
            <p>
              {!isAuthor && (
                <button type="button" className="btn btn-ghost" onClick={() => setShowReport((v) => !v)}>
                  Báo cáo nội dung
                </button>
              )}{' '}
              {isAuthor && !editing && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditTitle(post.title);
                      setEditBody(post.body);
                      setEditing(true);
                    }}
                  >
                    Sửa bài
                  </button>{' '}
                  <button type="button" className="btn btn-ghost" disabled={deleting} onClick={() => void handleDelete()}>
                    {deleting ? 'Đang xóa…' : 'Xóa bài'}
                  </button>
                </>
              )}
            </p>
            {deleteMsg && (
              <p className="error-text" role="alert">
                {deleteMsg}
              </p>
            )}
            {reportMsg && (
              <p className={reportMsg.kind === 'success' ? 'success-text' : 'error-text'} role="status">
                {reportMsg.text}
              </p>
            )}
            {showReport && (
              <form onSubmit={handleReport} className="card">
                <p>
                  <label htmlFor="report-reason">Lý do báo cáo</label>
                  <textarea
                    id="report-reason"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Ví dụ: Nội dung quảng cáo, không liên quan tới học tập…"
                  />
                </p>
                <p>
                  <button type="submit" className="btn" disabled={sendingReport}>
                    {sendingReport ? 'Đang gửi…' : 'Gửi báo cáo'}
                  </button>
                </p>
              </form>
            )}
          </article>

          <section aria-labelledby="binh-luan-title" style={{ marginTop: '1.5rem' }}>
            <h2 id="binh-luan-title" className="gold-title">
              Bình luận ({comments.length})
            </h2>
            {comments.length === 0 && (
              <div className="notice">
                <p>Chưa có bình luận nào. Hãy chia sẻ suy nghĩ của bạn!</p>
              </div>
            )}
            {comments.length > 0 && (
              <ul className="dashboard-list">
                {comments.map((c) => (
                  <li key={c.id} className="list-row">
                    <p>
                      <strong>{c.author_name || 'Học viên'}</strong>{' '}
                      <span className="muted">{formatDate(c.created_at)}</span>
                    </p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleComment} className="card" style={{ marginTop: '1rem' }}>
              <p>
                <label htmlFor="comment-body">Viết bình luận</label>
                <textarea
                  id="comment-body"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  disabled={sendingComment}
                  placeholder="Chia sẻ góc nhìn hoặc đặt câu hỏi thêm…"
                />
              </p>
              <p>
                <button type="submit" className="btn btn-gold" disabled={sendingComment}>
                  {sendingComment ? 'Đang gửi…' : 'Gửi bình luận'}
                </button>
              </p>
              {commentMsg && (
                <p className={commentMsg.kind === 'success' ? 'success-text' : 'error-text'} role="status">
                  {commentMsg.text}
                </p>
              )}
            </form>
          </section>
        </>
      )}
    </div>
  );
}
