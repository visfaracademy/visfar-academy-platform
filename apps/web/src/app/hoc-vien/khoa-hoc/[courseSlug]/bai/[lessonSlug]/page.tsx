// Trang hoc bai: /hoc-vien/khoa-hoc/[courseSlug]/bai/[lessonSlug]
// Hien thi du loai noi dung (Video / PDF / Audio / Text / Image / Quiz /
// Assignment / Webinar) + tai lieu dinh kem (tai qua API, khong lo URL
// goc) + ghi chu (luu DB) + danh dau hoan thanh + bai truoc/tiep theo.
// Trang thai: loading / success / not-found / locked / error /
// not-configured / signed-out. Route nam duoi /hoc-vien/* nen da co
// middleware + layout chan khi chua dang nhap.
'use client';

export const runtime = 'edge';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import {
  assignmentUrl,
} from '@/lib/assignments';
import {
  fetchLessonDetail,
  findPrevNext,
  flattenLessons,
  formatDuration,
  lessonTypeLabelVi,
  lessonUrl,
  markLessonComplete,
  quizUrl,
  resourceDownloadUrl,
  saveLessonNote,
  youtubeEmbedUrl,
  type LessonDetail,
  type LessonResourceItem,
} from '@/lib/learning';

type State =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'success'; detail: LessonDetail | null }
  | { status: 'error'; message: string };

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LessonContent({ detail }: { detail: LessonDetail }) {
  const { lesson, quiz, assignment, webinar } = detail;
  const embedUrl = lesson.type === 'video' ? youtubeEmbedUrl(lesson.videoUrl) : null;
  const isMp4 =
    lesson.videoUrl !== null && /\.(mp4|webm|mov)(\?|#|$)/i.test(lesson.videoUrl);
  const pdfResource: LessonResourceItem | undefined = detail.resources.find(
    (r) =>
      r.resourceType === 'document' ||
      (r.fileUrl !== null && /\.pdf(\?|#|$)/i.test(r.fileUrl)),
  );
  const pdfSrc =
    lesson.type === 'pdf'
      ? pdfResource
        ? resourceDownloadUrl(pdfResource.id)
        : lesson.fileUrl
      : null;

  if (lesson.type === 'video') {
    return (
      <div>
        {embedUrl ? (
          <div className="video-embed">
            <iframe
              src={embedUrl}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : isMp4 && lesson.videoUrl ? (
          <video className="video-embed" controls preload="metadata" src={lesson.videoUrl}>
            Trình duyệt của bạn không phát được video này.
          </video>
        ) : (
          <div className="notice" role="status">
            <p>Bài học chưa có link video. Vui lòng quay lại sau.</p>
          </div>
        )}
        {lesson.videoDurationSec ? (
          <p className="muted">Thời lượng: {formatDuration(lesson.videoDurationSec)}</p>
        ) : null}
        {lesson.content ? <p>{lesson.content}</p> : null}
      </div>
    );
  }

  if (lesson.type === 'text') {
    return (
      <div>
        {lesson.content ? (
          lesson.content.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)
        ) : (
          <div className="notice" role="status">
            <p>Bài đọc chưa có nội dung.</p>
          </div>
        )}
      </div>
    );
  }

  if (lesson.type === 'pdf') {
    return (
      <div>
        {pdfSrc ? (
          <iframe className="pdf-viewer" src={pdfSrc} title={lesson.title}>
            Trình duyệt của bạn không xem được PDF. Hãy tải file ở mục Tài liệu đính kèm bên dưới.
          </iframe>
        ) : (
          <div className="notice" role="status">
            <p>Bài học chưa có file PDF.</p>
          </div>
        )}
        {lesson.content ? <p>{lesson.content}</p> : null}
      </div>
    );
  }

  if (lesson.type === 'audio') {
    const src = lesson.videoUrl ?? lesson.fileUrl;
    return (
      <div>
        {src ? (
          <audio controls preload="metadata" src={src} className="audio-player">
            Trình duyệt của bạn không phát được audio này.
          </audio>
        ) : (
          <div className="notice" role="status">
            <p>Bài học chưa có file audio.</p>
          </div>
        )}
        {lesson.content ? <p>{lesson.content}</p> : null}
      </div>
    );
  }

  if (lesson.type === 'image') {
    const src = lesson.fileUrl ?? lesson.videoUrl;
    return (
      <div>
        {src ? (
          <img src={src} alt={lesson.title} className="lesson-image" />
        ) : (
          <div className="notice" role="status">
            <p>Bài học chưa có hình ảnh.</p>
          </div>
        )}
        {lesson.content ? <p>{lesson.content}</p> : null}
      </div>
    );
  }

  if (lesson.type === 'quiz') {
    return (
      <div className="card">
        <h2 className="gold-title">Bài kiểm tra</h2>
        {quiz ? (
          <>
            <p>
              <strong>{quiz.title}</strong>
            </p>
            {quiz.description ? <p>{quiz.description}</p> : null}
            <p className="muted">
              {quiz.passScorePercent !== null ? `Điểm đạt: ${quiz.passScorePercent}%. ` : ''}
              {quiz.timeLimitSec !== null
                ? `Thời gian: ${formatDuration(quiz.timeLimitSec)}. `
                : ''}
              {quiz.maxAttempts !== null ? `Số lần làm tối đa: ${quiz.maxAttempts}.` : ''}
            </p>
            <p>
              <Link
                className="btn"
                href={quizUrl(detail.course.slug, quiz.id)}
              >
                Làm quiz ngay
              </Link>
            </p>
          </>
        ) : (
          <p>Bài kiểm tra chưa được thiết lập.</p>
        )}
        <p className="muted">
          Nộp quiz xong, bạn sẽ thấy điểm, đáp án đúng và giải thích của từng câu.
          (Đánh dấu bài học hoàn thành theo kết quả quiz sẽ được nối sau khi có
          đường ghi tiến độ qua Workers.)
        </p>
      </div>
    );
  }

  if (lesson.type === 'assignment') {
    return (
      <div className="card">
        <h2 className="gold-title">Bài tập</h2>
        {assignment ? (
          <>
            <p>
              <strong>{assignment.title}</strong>
            </p>
            <p>{assignment.description}</p>
            <p className="muted">
              {assignment.dueAt ? `Hạn nộp: ${formatDateTime(assignment.dueAt)}. ` : ''}
              {assignment.maxScore !== null ? `Điểm tối đa: ${assignment.maxScore}.` : ''}
            </p>
            <p>
              <Link className="btn" href={assignmentUrl(detail.course.slug, assignment.id)}>
                Nộp bài tập
              </Link>
            </p>
          </>
        ) : (
          <p>Bài tập chưa được thiết lập.</p>
        )}
      </div>
    );
  }

  if (lesson.type === 'webinar') {
    return (
      <div className="card">
        <h2 className="gold-title">Webinar</h2>
        {webinar ? (
          <>
            <p>
              <strong>{webinar.title}</strong>
            </p>
            {webinar.description ? <p>{webinar.description}</p> : null}
            <p className="muted">
              Thời gian: {formatDateTime(webinar.startsAt)}
              {webinar.endsAt ? ` – ${formatDateTime(webinar.endsAt)}` : ''}
              {webinar.status === 'live' ? ' · Đang diễn ra' : ''}
            </p>
            {webinar.meetingUrl ? (
              <p>
                <a className="btn" href={webinar.meetingUrl} target="_blank" rel="noreferrer">
                  Tham gia webinar
                </a>
              </p>
            ) : (
              <p className="muted">Link tham gia sẽ hiện khi webinar sắp diễn ra.</p>
            )}
          </>
        ) : (
          <p className="muted">Lịch webinar sẽ hiện sau khi bạn ghi danh khóa học.</p>
        )}
        {lesson.content ? <p>{lesson.content}</p> : null}
      </div>
    );
  }

  // file (loai chung): noi dung chinh la tai lieu dinh kem ben duoi.
  return (
    <div>
      {lesson.content ? <p>{lesson.content}</p> : null}
      <p className="muted">Tài liệu của bài học ở mục “Tài liệu đính kèm” bên dưới.</p>
    </div>
  );
}

export default function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
  searchParams: Promise<{ module?: string }>;
}) {
  const { courseSlug, lessonSlug } = use(params);
  const { module: moduleSlug } = use(searchParams);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [note, setNote] = useState('');
  const [noteStatus, setNoteStatus] = useState<
    { kind: 'idle' } | { kind: 'saving' } | { kind: 'ok' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [completeStatus, setCompleteStatus] = useState<
    { kind: 'idle' } | { kind: 'saving' } | { kind: 'ok' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await fetchLessonDetail(courseSlug, lessonSlug, moduleSlug ?? null);
    if (res.status === 'error') setState({ status: 'error', message: res.message });
    else if (res.status === 'not-configured') setState({ status: 'not-configured' });
    else if (res.status === 'signed-out') setState({ status: 'signed-out' });
    else {
      setState({ status: 'success', detail: res.data });
      setNote(res.data?.noteContent ?? '');
      setNoteStatus({ kind: 'idle' });
      setCompleteStatus({ kind: 'idle' });
    }
  }, [courseSlug, lessonSlug, moduleSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const detail = state.status === 'success' ? state.detail : null;
  const allLessons = detail ? flattenLessons(detail.modules) : [];
  const { prev, next } = detail ? findPrevNext(allLessons, detail.lesson.id) : { prev: null, next: null };
  const isCompleted = detail?.progress?.status === 'completed';

  async function handleComplete() {
    if (!detail) return;
    setCompleteStatus({ kind: 'saving' });
    const res = await markLessonComplete(detail.lesson.id, {
      progressPercent: detail.lesson.type === 'video' ? 90 : 100,
    });
    if (res.status === 'error') {
      setCompleteStatus({ kind: 'error', message: res.message });
      return;
    }
    setCompleteStatus({ kind: 'ok' });
    await load();
  }

  async function handleSaveNote() {
    if (!detail) return;
    setNoteStatus({ kind: 'saving' });
    const res = await saveLessonNote(detail.lesson.id, note);
    if (res.status === 'error') setNoteStatus({ kind: 'error', message: res.message });
    else setNoteStatus({ kind: 'ok' });
  }

  return (
    <div className="wrap">
      {state.status === 'loading' && <p role="status">Đang tải bài học…</p>}
      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
        </div>
      )}
      {state.status === 'signed-out' && (
        <div className="notice" role="status">
          <p>
            Bạn chưa đăng nhập.{' '}
            <Link className="btn" href={`/dang-nhap?next=${encodeURIComponent(`/hoc-vien/khoa-hoc/${courseSlug}/bai/${lessonSlug}`)}`}>
              Đăng nhập
            </Link>
          </p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được bài học.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}
      {state.status === 'success' && detail === null && (
        <div className="notice" role="alert">
          <h1>Không tìm thấy bài học</h1>
          <p>
            Bài học “{lessonSlug}” không tồn tại trong khóa học này.{' '}
            <Link href={`/chuong-trinh/${courseSlug}`}>Quay lại khóa học</Link>
          </p>
        </div>
      )}
      {state.status === 'success' && detail !== null && detail.locked && (
        <div>
          <p>
            <Link href={`/chuong-trinh/${courseSlug}`}>← Quay lại khóa học</Link>
          </p>
          <h1 className="gold-title">{detail.lesson.title}</h1>
          <div className="notice" role="alert">
            <p>
              <strong>Bài học này dành cho học viên đã ghi danh.</strong>
            </p>
            <p>
              Bạn chưa ghi danh khóa học “{detail.course.title}”. Hãy đăng ký khóa học để mở
              toàn bộ bài học.
            </p>
            <p>
              <Link className="btn" href={`/chuong-trinh/${courseSlug}`}>
                Xem khóa học và đăng ký
              </Link>
            </p>
          </div>
        </div>
      )}
      {state.status === 'success' && detail !== null && !detail.locked && (
        <div className="lesson-layout">
          <article>
            <p className="muted">
              <Link href={`/chuong-trinh/${courseSlug}`}>{detail.course.title}</Link>
              {' / '}
              {detail.module.title}
            </p>
            <h1 className="gold-title">{detail.lesson.title}</h1>
            <p>
              <span className="pill">{lessonTypeLabelVi(detail.lesson.type)}</span>{' '}
              {isCompleted ? <span className="pill">✓ Đã hoàn thành</span> : null}
              {detail.lesson.isFreePreview ? <span className="pill">Xem trước</span> : null}
            </p>
            <p className="muted" aria-label="Tiến độ khóa học">
              Đã học {detail.completedLessons}/{detail.totalLessons} bài — {detail.progressPercent}%
            </p>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={detail.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tiến độ ${detail.course.title}`}
            >
              <div className="progress-fill" style={{ width: `${detail.progressPercent}%` }} />
            </div>

            <div className="lesson-content">
              <LessonContent detail={detail} />
            </div>

            {detail.resources.length > 0 && (
              <section aria-labelledby="resources-title" className="resources">
                <h2 id="resources-title" className="gold-title">Tài liệu đính kèm ({detail.resources.length})</h2>
                <ul className="resource-list">
                  {detail.resources.map((r) => (
                    <li key={r.id} className="resource-row">
                      <span>
                        {r.title}
                        {r.fileSizeBytes !== null ? (
                          <span className="muted"> · {formatFileSize(r.fileSizeBytes)}</span>
                        ) : null}
                      </span>
                      {r.fileUrl ? (
                        <a className="btn btn-ghost" href={resourceDownloadUrl(r.id)}>
                          Tải xuống
                        </a>
                      ) : (
                        <span className="muted">Chưa có file</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="notes-title" className="lesson-notes">
              <h2 id="notes-title" className="gold-title">Ghi chú của tôi</h2>
              <label htmlFor="lesson-note" className="sr-only">
                Ghi chú cho bài học {detail.lesson.title}
              </label>
              <textarea
                id="lesson-note"
                className="note-textarea"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteStatus({ kind: 'idle' });
                }}
                rows={5}
                maxLength={10000}
                placeholder="Viết lại ý quan trọng, câu hỏi hoặc việc cần làm sau bài học…"
              />
              <p className="muted">{note.length.toLocaleString('vi-VN')} / 10.000 ký tự</p>
              <p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleSaveNote()}
                  disabled={noteStatus.kind === 'saving'}
                >
                  {noteStatus.kind === 'saving' ? 'Đang lưu…' : 'Lưu ghi chú'}
                </button>
              </p>
              {noteStatus.kind === 'ok' && (
                <p className="notice success" role="status">
                  Đã lưu ghi chú.
                </p>
              )}
              {noteStatus.kind === 'error' && (
                <p className="notice error" role="alert">
                  {noteStatus.message}
                </p>
              )}
            </section>

            <div className="lesson-actions">
              {detail.lesson.type !== 'quiz' && (
                <div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleComplete()}
                    disabled={completeStatus.kind === 'saving' || isCompleted}
                  >
                    {completeStatus.kind === 'saving'
                      ? 'Đang lưu…'
                      : isCompleted
                        ? '✓ Đã hoàn thành'
                        : detail.lesson.type === 'video'
                          ? 'Tôi đã xem xong video'
                          : 'Đánh dấu đã hoàn thành'}
                  </button>
                  {completeStatus.kind === 'ok' && (
                    <p className="notice success" role="status">
                      Đã ghi nhận hoàn thành bài học.
                    </p>
                  )}
                  {completeStatus.kind === 'error' && (
                    <p className="notice error" role="alert">
                      {completeStatus.message}
                    </p>
                  )}
                </div>
              )}
              <nav className="lesson-nav" aria-label="Bài trước và bài tiếp theo">
                {prev ? (
                  <Link
                    className="btn btn-ghost"
                    href={lessonUrl(courseSlug, prev.slug, detail.modules.find((m) => m.id === prev.moduleId)?.slug)}
                  >
                    ← Bài trước: {prev.title}
                  </Link>
                ) : (
                  <span />
                )}
                {next ? (
                  <Link
                    className="btn"
                    href={lessonUrl(courseSlug, next.slug, detail.modules.find((m) => m.id === next.moduleId)?.slug)}
                  >
                    Bài tiếp theo: {next.title} →
                  </Link>
                ) : (
                  <span className="muted">Đây là bài cuối cùng của khóa học.</span>
                )}
              </nav>
            </div>
          </article>

          <aside aria-label="Danh sách bài học" className="lesson-sidebar">
            <h2 className="gold-title">Bài học trong khóa</h2>
            {detail.modules.map((m) => (
              <details key={m.id} open={m.id === detail.module.id} className="sidebar-module">
                <summary>
                  {m.title} ({m.lessons.length})
                </summary>
                <ul className="lesson-list">
                  {m.lessons.map((l) => {
                    const done = detail.completedLessonIds.includes(l.id);
                    const current = l.id === detail.lesson.id;
                    return (
                      <li key={l.id} className={current ? 'lesson-row current' : 'lesson-row'}>
                        <Link
                          href={lessonUrl(courseSlug, l.slug, m.slug)}
                          aria-current={current ? 'page' : undefined}
                        >
                          {done ? '✓ ' : ''}
                          {l.title}
                        </Link>
                        <span className="pill">{lessonTypeLabelVi(l.type)}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
            <p>
              <Link href="/hoc-vien/khoa-hoc">← Khóa học của tôi</Link>
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
