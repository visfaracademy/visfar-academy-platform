// Trang nop bai: /hoc-vien/khoa-hoc/[courseSlug]/bai-tap/[assignmentId]
// Hoc vien viet bai truc tiep (essay/mixed) va/hoac dinh kem file
// (file_upload/mixed) — file upload qua API, bucket private, khong lo
// URL goc; lich su nop + diem/nhan xet cua giang vien hien ngay tren
// trang. Giang vien khoa phu trach / admin thay them link sang trang
// cham bai.
// Trang thai: loading / error / success. Route nam duoi /hoc-vien/* nen
// da co middleware + layout chan khi chua dang nhap.
'use client';

export const runtime = 'edge';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import {
  decideCanSubmit,
  getAssignmentDetail,
  isResubmission,
  saveSubmission,
  submissionFileDownloadUrl,
  submissionStatusLabelVi,
  uploadSubmissionFile,
  validateSubmissionInput,
  type AssignmentContext,
  type SubmissionItem,
} from '@/lib/assignments';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; ctx: AssignmentContext };

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Không giới hạn';
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

function SubmissionCard({ sub }: { sub: SubmissionItem }) {
  const review = sub.latestReview;
  return (
    <li className="list-row">
      <p>
        <strong>{submissionStatusLabelVi(sub.status)}</strong>
        {sub.isLate ? ' · Nộp muộn' : ''}
        {' · '}
        {formatDateTime(sub.submittedAt)}
      </p>
      {sub.contentText ? <p>{sub.contentText}</p> : null}
      {sub.files.length > 0 ? (
        <ul className="file-list">
          {sub.files.map((f) => (
            <li key={f.id}>
              <a href={submissionFileDownloadUrl(sub.assignmentId, f.id)}>
                {f.fileName} ({formatFileSize(f.fileSizeBytes)})
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {review ? (
        <div className="notice">
          <p>
            <strong>
              {review.status === 'returned' ? 'Trả lại để làm lại' : 'Đã chấm'}
              {review.score !== null ? ` — ${review.score} điểm` : ''}
            </strong>
          </p>
          {review.feedback ? <p>Nhận xét: {review.feedback}</p> : null}
          <p className="muted">
            {review.reviewerName ? `${review.reviewerName} · ` : ''}
            {formatDateTime(review.reviewedAt)}
          </p>
        </div>
      ) : null}
      {sub.reviews.length > 1 ? (
        <p className="muted">Đã chấm {sub.reviews.length} lần — trên đây là kết quả mới nhất.</p>
      ) : null}
    </li>
  );
}

export default function AssignmentSubmitPage({
  params,
}: {
  params: Promise<{ courseSlug: string; assignmentId: string }>;
}) {
  const { courseSlug, assignmentId } = use(params);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await getAssignmentDetail(assignmentId);
    if (!res.ok) {
      setState({ status: 'error', message: res.error });
      return;
    }
    setState({ status: 'success', ctx: res.data });
    const draft = res.data.myLatestSubmission;
    if (draft && draft.status === 'draft' && draft.contentText) {
      setContent(draft.contentText);
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Bài tập</h1>
        <p>Đang tải bài tập…</p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Bài tập</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được bài tập.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button className="btn" type="button" onClick={() => void load()}>
              Thử lại
            </button>{' '}
            <Link className="btn btn-ghost" href={`/hoc-vien/khoa-hoc/${courseSlug}`}>
              Về khóa học
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const { ctx } = state;
  const { assignment } = ctx;
  const latest = ctx.myLatestSubmission;
  const decision = decideCanSubmit({
    assignmentStatus: assignment.status,
    assignmentType: assignment.assignmentType,
    dueAt: assignment.dueAt,
    allowLateSubmission: assignment.allowLateSubmission,
    latest,
  });
  const canWrite = assignment.assignmentType !== 'file_upload';
  const canUpload = assignment.assignmentType !== 'essay';
  const draftFiles = latest && latest.status === 'draft' ? latest.files : [];
  const fileCount = draftFiles.length;

  async function handleSave(action: 'draft' | 'submit') {
    setFormError(null);
    setFormNotice(null);
    const validationError = validateSubmissionInput(
      { contentText: content, fileCount, action },
      assignment.assignmentType,
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    const res = await saveSubmission(assignmentId, { contentText: content, action });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    if (action === 'submit') {
      setFormNotice(
        res.data.willBeLate
          ? 'Đã nộp bài thành công (bài nộp muộn, đã được ghi nhận). Giảng viên sẽ chấm và phản hồi trên trang này.'
          : 'Đã nộp bài thành công. Giảng viên sẽ chấm và phản hồi trên trang này.',
      );
      setContent('');
    } else {
      setFormNotice('Đã lưu bản nháp.');
    }
    await load();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFormError(null);
    setFormNotice(null);
    setUploading(true);
    const res = await uploadSubmissionFile(assignmentId, file);
    setUploading(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setFormNotice(`Đã đính kèm file “${res.data.file.fileName}”. Nhớ bấm “Nộp bài” để hoàn tất.`);
    await load();
  }

  return (
    <div className="wrap">
      <p className="muted">
        <Link href={`/hoc-vien/khoa-hoc/${courseSlug}`}>{assignment.courseTitle}</Link>
        {' · Bài tập'}
      </p>
      <h1 className="gold-title">{assignment.title}</h1>
      <hr className="rule" />
      <div className="card">
        <p>{assignment.description}</p>
        <p className="muted">
          Hình thức:{' '}
          {assignment.assignmentType === 'essay'
            ? 'Viết bài trực tiếp'
            : assignment.assignmentType === 'file_upload'
              ? 'Nộp file'
              : 'Viết bài + nộp file'}
          {' · '}
          {assignment.maxScore !== null ? `Điểm tối đa: ${assignment.maxScore}. ` : 'Chỉ nhận xét, không chấm điểm. '}
          Hạn nộp: {formatDateTime(assignment.dueAt)}
          {assignment.dueAt && assignment.allowLateSubmission ? ' (cho nộp muộn, bài muộn sẽ được đánh dấu).' : '.'}
        </p>
        {decision.willBeLate && decision.allowed ? (
          <div className="notice" role="status">
            <p>
              <strong>Đã quá hạn nộp.</strong> Bài này cho nộp muộn nên bạn vẫn nộp được — bài sẽ được đánh dấu “Nộp muộn”.
            </p>
          </div>
        ) : null}
        {!decision.allowed ? (
          <div className="notice" role="status">
            <p>
              <strong>{decision.reason}</strong>
            </p>
          </div>
        ) : null}
        {isResubmission(latest) ? (
          <p className="muted">Bạn đang nộp lại — bài nộp trước vẫn được giữ trong lịch sử bên dưới.</p>
        ) : null}
        {(ctx.isInstructor || ctx.isAdmin) && (
          <p>
            <Link
              className="btn btn-ghost"
              href={`/hoc-vien/khoa-hoc/${courseSlug}/bai-tap/${assignmentId}/cham-bai`}
            >
              Chấm bài cho học viên
            </Link>
          </p>
        )}
      </div>

      {decision.allowed ? (
        <section className="card assignment-form" aria-label="Nộp bài">
          <h2 className="gold-title">Nộp bài của bạn</h2>
          {canWrite ? (
            <div className="field">
              <label htmlFor="submission-content">Nội dung bài làm</label>
              <textarea
                id="submission-content"
                className="note-textarea"
                rows={8}
                maxLength={20000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Viết bài làm của bạn tại đây…"
              />
            </div>
          ) : null}
          {canUpload ? (
            <div className="field">
              <label htmlFor="submission-file">
                File đính kèm (PDF, Word, TXT, Markdown, ảnh — tối đa 10 MB / file, tối đa 5 file)
              </label>
              <input
                id="submission-file"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
                onChange={(e) => void handleFileChange(e)}
                disabled={uploading || saving}
              />
              <p className="hint">
                {uploading ? 'Đang tải file lên…' : 'File được lưu riêng tư — chỉ bạn, giảng viên và quản trị viên xem được.'}
              </p>
              {draftFiles.length > 0 ? (
                <ul className="file-list">
                  {draftFiles.map((f) => (
                    <li key={f.id}>
                      <a href={submissionFileDownloadUrl(assignmentId, f.id)}>
                        {f.fileName} ({formatFileSize(f.fileSizeBytes)})
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {formError ? (
            <div className="notice error form-status" role="alert">
              <p>{formError}</p>
            </div>
          ) : null}
          {formNotice ? (
            <div className="notice success form-status" role="status">
              <p>{formNotice}</p>
            </div>
          ) : null}
          <p>
            <button
              className="btn"
              type="button"
              disabled={saving || uploading}
              onClick={() => void handleSave('submit')}
            >
              {saving ? 'Đang nộp…' : latest && latest.status !== 'draft' ? 'Nộp lại bài' : 'Nộp bài'}
            </button>{' '}
            <button
              className="btn btn-ghost"
              type="button"
              disabled={saving || uploading}
              onClick={() => void handleSave('draft')}
            >
              Lưu bản nháp
            </button>
          </p>
        </section>
      ) : null}

      <section aria-label="Lịch sử nộp bài">
        <h2 className="gold-title">Lịch sử nộp bài</h2>
        {ctx.mySubmissions.length === 0 ? (
          <div className="notice">
            <p>Bạn chưa nộp bài tập này.</p>
          </div>
        ) : (
          <ul className="dashboard-list">
            {ctx.mySubmissions.map((sub) => (
              <SubmissionCard key={sub.id} sub={sub} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
