// Trang cham bai — danh cho giang vien khoa phu trach / admin.
// Duong dan: /hoc-vien/khoa-hoc/[courseSlug]/bai-tap/[assignmentId]/cham-bai
// (KHONG dat duoi /admin: layout /admin chan ca giang vien khong phai
// admin; quyen cham duoc kiem tra PHIA SERVER o API route — giang vien
// cua khoa hoac admin moi thay duoc danh sach + cham duoc).
// Hien bai nop moi nhat cua tung hoc vien de cham; lich su nop cu +
// lich su cham lai nam trong <details>. Cham lai = them review moi,
// ket qua moi nhat la ket qua hien hanh.
'use client';

export const runtime = 'edge';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import {
  getAssignmentDetail,
  gradeSubmission,
  submissionFileDownloadUrl,
  submissionStatusLabelVi,
  validateReviewInput,
  type AssignmentContext,
  type SubmissionItem,
} from '@/lib/assignments';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'forbidden'; message: string }
  | { status: 'success'; ctx: AssignmentContext };

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function groupLatestByStudent(
  submissions: SubmissionItem[],
): { studentKey: string; latest: SubmissionItem; history: SubmissionItem[] }[] {
  const groups = new Map<string, SubmissionItem[]>();
  for (const sub of submissions) {
    const list = groups.get(sub.userId) ?? [];
    list.push(sub);
    groups.set(sub.userId, list);
  }
  return [...groups.values()].map((list) => ({
    studentKey: list[0].userId,
    latest: list[0],
    history: list.slice(1),
  }));
}

function GradeForm({
  assignmentId,
  maxScore,
  submission,
  onGraded,
}: {
  assignmentId: string;
  maxScore: number | null;
  submission: SubmissionItem;
  onGraded: () => void;
}) {
  const [score, setScore] = useState<string>(
    submission.latestReview?.score !== null && submission.latestReview?.score !== undefined
      ? String(submission.latestReview.score)
      : '',
  );
  const [feedback, setFeedback] = useState(submission.latestReview?.feedback ?? '');
  const [result, setResult] = useState<'graded' | 'returned'>(
    submission.latestReview?.status ?? 'graded',
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    const parsedScore = score.trim() === '' ? null : Number(score);
    const validationError = validateReviewInput(
      { score: parsedScore, feedback, status: result },
      maxScore,
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    const res = await gradeSubmission(assignmentId, submission.id, {
      score: parsedScore,
      feedback,
      status: result,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotice(
      result === 'returned'
        ? 'Đã trả bài lại cho học viên làm lại.'
        : `Đã lưu kết quả chấm${parsedScore !== null ? ` — ${parsedScore} điểm` : ''}.`,
    );
    onGraded();
  }

  return (
    <div className="grade-form">
      <div className="field">
        <label htmlFor={`score-${submission.id}`}>
          Điểm{maxScore !== null ? ` (tối đa ${maxScore})` : ' (bài chỉ nhận xét — để trống nếu không chấm điểm)'}
        </label>
        <input
          id={`score-${submission.id}`}
          type="number"
          min={0}
          max={maxScore ?? undefined}
          step={1}
          inputMode="numeric"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder={maxScore !== null ? `0–${maxScore}` : 'Không bắt buộc'}
        />
      </div>
      <div className="field">
        <label htmlFor={`feedback-${submission.id}`}>Nhận xét / chữa bài</label>
        <textarea
          id={`feedback-${submission.id}`}
          className="note-textarea"
          rows={4}
          maxLength={5000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Nhận xét cho học viên…"
        />
      </div>
      <div className="field">
        <label htmlFor={`result-${submission.id}`}>Kết quả</label>
        <select
          id={`result-${submission.id}`}
          value={result}
          onChange={(e) => setResult(e.target.value as 'graded' | 'returned')}
        >
          <option value="graded">Đã chấm điểm</option>
          <option value="returned">Trả lại để làm lại</option>
        </select>
      </div>
      {error ? (
        <div className="notice error form-status" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="notice success form-status" role="status">
          <p>{notice}</p>
        </div>
      ) : null}
      <p>
        <button className="btn" type="button" disabled={saving} onClick={() => void handleSubmit()}>
          {saving ? 'Đang lưu…' : submission.latestReview ? 'Chấm lại' : 'Lưu kết quả chấm'}
        </button>
      </p>
    </div>
  );
}

export default function AssignmentGradingPage({
  params,
}: {
  params: Promise<{ courseSlug: string; assignmentId: string }>;
}) {
  const { courseSlug, assignmentId } = use(params);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filter, setFilter] = useState<'all' | 'pending' | 'graded' | 'returned'>('all');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await getAssignmentDetail(assignmentId);
    if (!res.ok) {
      setState({ status: 'error', message: res.error });
      return;
    }
    if (!res.data.isInstructor && !res.data.isAdmin) {
      setState({
        status: 'forbidden',
        message: 'Chỉ giảng viên phụ trách khóa học hoặc quản trị viên mới xem được trang chấm bài.',
      });
      return;
    }
    setState({ status: 'success', ctx: res.data });
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Chấm bài</h1>
        <p>Đang tải danh sách bài nộp…</p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Chấm bài</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được danh sách bài nộp.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button className="btn" type="button" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      </div>
    );
  }
  if (state.status === 'forbidden') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Chấm bài</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không có quyền chấm bài.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <Link
              className="btn"
              href={`/hoc-vien/khoa-hoc/${courseSlug}/bai-tap/${assignmentId}`}
            >
              Về trang nộp bài
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const { ctx } = state;
  const { assignment } = ctx;
  const all = ctx.allSubmissions ?? [];
  const groups = groupLatestByStudent(all);
  const pendingCount = groups.filter((g) => g.latest.status === 'submitted').length;
  const filtered =
    filter === 'all'
      ? groups
      : groups.filter((g) =>
          filter === 'pending'
            ? g.latest.status === 'submitted'
            : filter === 'graded'
              ? g.latest.status === 'graded'
              : g.latest.status === 'returned',
        );

  return (
    <div className="wrap">
      <p className="muted">
        <Link href={`/hoc-vien/khoa-hoc/${courseSlug}/bai-tap/${assignmentId}`}>
          {assignment.title}
        </Link>
        {' · Chấm bài'}
      </p>
      <h1 className="gold-title">Chấm bài: {assignment.title}</h1>
      <hr className="rule" />
      <p className="muted">
        Khóa: {assignment.courseTitle} · Hạn nộp: {formatDateTime(assignment.dueAt)}
        {assignment.maxScore !== null ? ` · Điểm tối đa: ${assignment.maxScore}` : ' · Chỉ nhận xét, không chấm điểm'} ·{' '}
        {groups.length} học viên đã nộp · {pendingCount} bài chờ chấm.
      </p>
      <div className="tabs" role="group" aria-label="Lọc bài nộp">
        {(
          [
            ['all', `Tất cả (${groups.length})`],
            ['pending', `Chờ chấm (${pendingCount})`],
            ['graded', 'Đã chấm'],
            ['returned', 'Đã trả lại'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="tab"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="notice">
          <p>
            {all.length === 0
              ? 'Chưa có học viên nào nộp bài tập này.'
              : 'Không có bài nộp nào khớp bộ lọc.'}
          </p>
        </div>
      ) : (
        <ul className="dashboard-list">
          {filtered.map(({ studentKey, latest, history }) => (
            <li key={studentKey} className="list-row">
              <p>
                <strong>{latest.studentName ?? 'Học viên'}</strong>
                {latest.studentEmail ? ` · ${latest.studentEmail}` : ''}
              </p>
              <p>
                {submissionStatusLabelVi(latest.status)}
                {latest.isLate ? ' · Nộp muộn' : ''}
                {' · '}
                {formatDateTime(latest.submittedAt)}
              </p>
              {latest.contentText ? <p>{latest.contentText}</p> : null}
              {latest.files.length > 0 ? (
                <ul className="file-list">
                  {latest.files.map((f) => (
                    <li key={f.id}>
                      <a href={submissionFileDownloadUrl(assignmentId, f.id)}>
                        {f.fileName} ({formatFileSize(f.fileSizeBytes)})
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {latest.latestReview ? (
                <div className="notice">
                  <p>
                    <strong>
                      Kết quả hiện tại:{' '}
                      {latest.latestReview.status === 'returned' ? 'Đã trả lại' : 'Đã chấm'}
                      {latest.latestReview.score !== null
                        ? ` — ${latest.latestReview.score} điểm`
                        : ''}
                    </strong>
                  </p>
                  {latest.latestReview.feedback ? (
                    <p>Nhận xét: {latest.latestReview.feedback}</p>
                  ) : null}
                  <p className="muted">
                    {latest.latestReview.reviewerName
                      ? `${latest.latestReview.reviewerName} · `
                      : ''}
                    {formatDateTime(latest.latestReview.reviewedAt)}
                  </p>
                </div>
              ) : null}
              {history.length > 0 ? (
                <details>
                  <summary>
                    Lịch sử nộp lại ({history.length} bài trước)
                  </summary>
                  <ul className="file-list">
                    {history.map((h) => (
                      <li key={h.id}>
                        {submissionStatusLabelVi(h.status)} · {formatDateTime(h.submittedAt)}
                        {h.latestReview?.score !== null && h.latestReview?.score !== undefined
                          ? ` · ${h.latestReview.score} điểm`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {latest.reviews.length > 1 ? (
                <p className="muted">
                  Bài này đã được chấm {latest.reviews.length} lần — form dưới đây chấm lại (thêm kết quả mới, không sửa kết quả cũ).
                </p>
              ) : null}
              <GradeForm
                assignmentId={assignmentId}
                maxScore={assignment.maxScore}
                submission={latest}
                onGraded={() => void load()}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
