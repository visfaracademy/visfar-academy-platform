// QuizPlayer — Task 08. Client component lam quiz (du 5 loai cau).
//
// - De thi lay qua GET /api/v1/quizzes/[quizId] (khong co dap an dung).
// - Tron cau hoi + dap an bang seed theo lan mo de (giữ trong state;
//   dap an luu theo question_id nen thu tu khong anh huong cham diem).
// - Dem nguoc theo time_limit_sec, tu nop khi het gio.
// - Nop qua POST .../submit (cham o server); dap an dung + giai thich
//   chi hien SAU KHI nop (trong ket qua tra ve).
// - Nop DAT (passed = true do server cham) thi danh dau bai quiz
//   hoan thanh qua Workers POST /api/v1/progress (B-T08-5, xem
//   markQuizLessonComplete o lib/progress); chua dat thi KHONG ghi
//   gi. Workers chua deploy thi bao loi ro + cho thu lai, diem quiz
//   thi da duoc luu o server.
// - Lich su lam bai lay qua GET .../attempts.
// - Style: class chung (.card/.btn/.notice/.pill/.field) + token
//   ivory/gold/Be Vietnam Pro hien co; khong doi mau/font/anh.
//   Chu >= 16px, nut/input >= 44px.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markQuizLessonComplete } from '@/lib/progress';
import {
  buildSubmitPayload,
  canAttempt,
  fetchQuizHistory,
  fetchQuizPaper,
  findUnansweredRequired,
  formatCountdown,
  remainingSeconds,
  shufflePaper,
  submitQuizAttempt,
  QuizApiError,
  type QuizAnswerInput,
  type QuizAttemptSummary,
  type QuizPaper,
  type QuizQuestionPublic,
  type QuizSubmitResult,
} from '@/lib/quiz';

type ProgressStatus = 'skipped' | 'saving' | 'saved' | 'failed';

type Phase =
  | { status: 'loading' }
  | { status: 'error'; message: string; code: string | null }
  | { status: 'ready'; paper: QuizPaper; history: QuizAttemptSummary[] }
  | { status: 'doing'; paper: QuizPaper; history: QuizAttemptSummary[] }
  | { status: 'submitting'; paper: QuizPaper; history: QuizAttemptSummary[] }
  | {
      status: 'result';
      paper: QuizPaper;
      history: QuizAttemptSummary[];
      result: QuizSubmitResult;
      /** Tien do hoan thanh bai quiz sau khi nop DAT (B-T08-5). */
      progressStatus: ProgressStatus;
    };

function typeLabelVi(q: QuizQuestionPublic): string {
  switch (q.questionType) {
    case 'single_choice':
      return 'Chọn 1 đáp án';
    case 'multiple_choice':
      return 'Chọn nhiều đáp án';
    case 'true_false':
      return 'Đúng / Sai';
    case 'fill_blank':
      return 'Điền vào chỗ trống';
    case 'short_answer':
      return 'Trả lời ngắn';
    case 'essay':
      return 'Tự luận';
    default:
      return '';
  }
}

function formatAttemptTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QuizPlayer({
  quizId,
  courseSlug,
}: {
  quizId: string;
  courseSlug: string;
}) {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' });
  const [answers, setAnswers] = useState<Map<string, QuizAnswerInput>>(new Map());
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Seed tron theo lan mo de thi (giữ ổn định trong suốt lượt làm).
  const [seed] = useState(
    () =>
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `seed-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
  );
  const submittingRef = useRef(false);

  const loadPaper = useCallback(async () => {
    setPhase({ status: 'loading' });
    setAnswers(new Map());
    setStartedAtMs(null);
    setConfirmSubmit(false);
    setSubmitError(null);
    try {
      const [paper, history] = await Promise.all([
        fetchQuizPaper(quizId),
        fetchQuizHistory(quizId).catch(() => [] as QuizAttemptSummary[]),
      ]);
      setPhase({ status: 'ready', paper, history });
    } catch (err) {
      if (err instanceof QuizApiError) {
        setPhase({
          status: 'error',
          code: err.code,
          message:
            err.code === 'unauthenticated'
              ? 'Bạn chưa đăng nhập. Vui lòng đăng nhập rồi làm bài.'
              : err.code === 'quiz_not_found'
                ? 'Không tìm thấy bài kiểm tra này (có thể chưa được xuất bản).'
                : err.code === 'not_enrolled'
                  ? 'Bạn chưa ghi danh khóa học này nên chưa làm được bài kiểm tra.'
                  : err.code === 'not_configured'
                    ? 'Hệ thống chưa cấu hình xong. Vui lòng thử lại sau.'
                    : 'Không tải được đề thi. Vui lòng thử lại.',
        });
      } else {
        setPhase({
          status: 'error',
          code: null,
          message: 'Không tải được đề thi. Vui lòng thử lại.',
        });
      }
    }
  }, [quizId]);

  useEffect(() => {
    void loadPaper();
  }, [loadPaper]);

  const doingPaper = useMemo(() => {
    if (phase.status !== 'doing' && phase.status !== 'submitting') return null;
    return shufflePaper(phase.paper, seed);
  }, [phase, seed]);

  const timeLimitSec =
    phase.status === 'doing' || phase.status === 'submitting'
      ? phase.paper.timeLimitSec
      : null;
  const remaining =
    timeLimitSec === null || startedAtMs === null
      ? null
      : remainingSeconds(timeLimitSec, startedAtMs, nowMs);

  // Dem nguoc 1 giay/lan khi dang lam bai co gioi han.
  useEffect(() => {
    if (phase.status !== 'doing' || timeLimitSec === null) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase.status, timeLimitSec]);

  const doSubmit = useCallback(async () => {
    if (phase.status !== 'doing' || submittingRef.current || startedAtMs === null) return;
    submittingRef.current = true;
    setSubmitError(null);
    setPhase({ status: 'submitting', paper: phase.paper, history: phase.history });
    try {
      const result = await submitQuizAttempt(quizId, {
        startedAt: new Date(startedAtMs).toISOString(),
        answers: buildSubmitPayload(answers),
      });
      const history = await fetchQuizHistory(quizId).catch(
        () => phase.history,
      );
      // B-T08-5: nop DAT thi danh dau bai quiz hoan thanh qua Workers
      // /progress; chua dat (hoac quiz khong gan bai hoc) thi khong
      // ghi gi. Diem quiz da luu o server truoc khi tra ket qua nen
      // ghi tien do loi chi anh huong viec danh dau hoan thanh.
      if (result.passed && phase.paper.lessonId) {
        setPhase({
          status: 'result',
          paper: phase.paper,
          history,
          result,
          progressStatus: 'saving',
        });
        const progressRes = await markQuizLessonComplete(
          phase.paper.lessonId,
          phase.paper.courseId,
          result,
        );
        setPhase({
          status: 'result',
          paper: phase.paper,
          history,
          result,
          progressStatus: progressRes.status === 'ok' ? 'saved' : 'failed',
        });
      } else {
        setPhase({
          status: 'result',
          paper: phase.paper,
          history,
          result,
          progressStatus: 'skipped',
        });
      }
    } catch (err) {
      submittingRef.current = false;
      setPhase({ status: 'doing', paper: phase.paper, history: phase.history });
      setSubmitError(
        err instanceof QuizApiError && err.code === 'max_attempts_reached'
          ? 'Bạn đã hết số lần làm bài cho phép.'
          : err instanceof QuizApiError && err.code === 'not_enrolled'
            ? 'Quyền học khóa này đã thay đổi — bạn chưa ghi danh nên không nộp được bài.'
            : 'Nộp bài chưa thành công. Vui lòng thử lại.',
      );
    }
  }, [phase, startedAtMs, answers, quizId]);

  // Thu ghi lai tien do hoan thanh khi lan ghi sau khi nop DAT bi loi
  // (vd Workers chua deploy) — diem quiz da luu, chi ghi lai viec
  // danh dau hoan thanh, khong nop lai bai.
  const retryProgress = useCallback(async () => {
    if (phase.status !== 'result' || !phase.result.passed || !phase.paper.lessonId) return;
    setPhase({ ...phase, progressStatus: 'saving' });
    const res = await markQuizLessonComplete(
      phase.paper.lessonId,
      phase.paper.courseId,
      phase.result,
    );
    setPhase({ ...phase, progressStatus: res.status === 'ok' ? 'saved' : 'failed' });
  }, [phase]);

  // Tu nop khi het gio (chi 1 lan).
  useEffect(() => {
    if (phase.status === 'doing' && remaining !== null && remaining <= 0) {
      void doSubmit();
    }
  }, [phase.status, remaining, doSubmit]);

  const setOptionAnswer = (questionId: string, optionId: string, multi: boolean) => {
    setConfirmSubmit(false);
    setAnswers((prev) => {
      const next = new Map(prev);
      const cur = next.get(questionId) ?? { questionId, optionIds: [] };
      const ids = cur.optionIds ?? [];
      next.set(questionId, {
        questionId,
        optionIds: multi
          ? ids.includes(optionId)
            ? ids.filter((x) => x !== optionId)
            : [...ids, optionId]
          : [optionId],
      });
      return next;
    });
  };

  const setTextAnswer = (questionId: string, text: string) => {
    setConfirmSubmit(false);
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, { questionId, answerText: text });
      return next;
    });
  };

  const handleSubmitClick = () => {
    if (phase.status !== 'doing') return;
    const missing = findUnansweredRequired(phase.paper, answers);
    if (missing.length > 0 && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    void doSubmit();
  };

  const startQuiz = () => {
    if (phase.status !== 'ready') return;
    setAnswers(new Map());
    setStartedAtMs(Date.now());
    setNowMs(Date.now());
    setConfirmSubmit(false);
    setSubmitError(null);
    setPhase({ status: 'doing', paper: phase.paper, history: phase.history });
  };

  // ---- Render: loading / error -------------------------------------------
  if (phase.status === 'loading') {
    return (
      <div className="card" role="status" aria-live="polite">
        <p>Đang tải đề thi…</p>
      </div>
    );
  }

  if (phase.status === 'error') {
    return (
      <div className="card">
        <h2>Không mở được bài kiểm tra</h2>
        <p>{phase.message}</p>
        <p>
          {phase.code === 'unauthenticated' ? (
            <Link className="btn" href="/dang-nhap">
              Đăng nhập
            </Link>
          ) : (
            <button type="button" className="btn" onClick={() => void loadPaper()}>
              Tải lại đề thi
            </button>
          )}{' '}
          <Link className="btn btn-ghost" href={`/chuong-trinh/${encodeURIComponent(courseSlug)}`}>
            Về trang khóa học
          </Link>
        </p>
      </div>
    );
  }

  const { paper, history } = phase;
  const remainingAttempts = paper.attemptsRemaining;
  const exhausted = !canAttempt(paper.maxAttempts, paper.attemptsUsed);

  // ---- Render: ket qua ----------------------------------------------------
  if (phase.status === 'result') {
    const { result } = phase;
    // So luot da dung lay tu lich su vua tai lai (paper.attemptsUsed la
    // so lieu luc mo de thi, da cu sau khi nop xong).
    const freshExhausted =
      paper.maxAttempts !== null && history.length >= paper.maxAttempts;
    const questionById = new Map(paper.questions.map((q) => [q.id, q]));
    return (
      <div>
        <div className="card">
          <p>
            <span className="pill">
              {result.status === 'expired' ? 'Hết giờ' : 'Đã nộp bài'}
            </span>{' '}
            <span className="pill">
              {result.passed ? 'Đạt' : 'Chưa đạt'} — {result.percent}%
            </span>
          </p>
          <h2>Kết quả: {result.score}/{result.total} điểm ({result.percent}%)</h2>
          <p>
            Điểm đạt: {paper.passingScore}%.{' '}
            {result.passed
              ? 'Chúc mừng bạn đã đạt bài kiểm tra.'
              : 'Bạn chưa đạt điểm yêu cầu — hãy ôn lại bài rồi làm lại nếu còn lượt.'}
          </p>
          {result.needsReview ? (
            <p className="notice" role="status">
              Bài của bạn có câu tự luận / câu chưa chấm được tự động — giảng viên sẽ chấm
              tay và cập nhật điểm sau.
            </p>
          ) : null}
          {result.passed && phase.progressStatus === 'saved' ? (
            <p className="notice" role="status">
              Bài quiz đã được đánh dấu hoàn thành.
            </p>
          ) : null}
          {result.passed && phase.progressStatus === 'failed' ? (
            <p className="notice" role="alert">
              Điểm của bạn đã được lưu, nhưng chưa ghi được tiến độ hoàn thành (hệ thống
              tiến độ chưa khả dụng).{' '}
              <button type="button" className="btn" onClick={() => void retryProgress()}>
                Thử ghi tiến độ lại
              </button>
            </p>
          ) : null}
          {result.status === 'expired' ? (
            <p className="notice" role="status">
              Bạn đã nộp bài sau khi hết giờ nên lượt này được tính là hết giờ.
            </p>
          ) : null}
          <p>
            {!freshExhausted && (
              <button type="button" className="btn" onClick={() => void loadPaper()}>
                Làm lại bài kiểm tra
              </button>
            )}{' '}
            <Link className="btn btn-ghost" href={`/chuong-trinh/${encodeURIComponent(courseSlug)}`}>
              Về trang khóa học
            </Link>
          </p>
        </div>

        <h2>Xem lại từng câu</h2>
        {result.results.map((r, idx) => {
          const q = questionById.get(r.questionId);
          return (
            <article key={r.questionId} className="card" style={{ marginTop: '1rem' }}>
              <p>
                <strong>
                  Câu {idx + 1}
                  {q ? `: ${q.question}` : ''}
                </strong>
              </p>
              <p>
                {r.isCorrect === null ? (
                  <span className="pill">Chờ chấm tay</span>
                ) : r.isCorrect ? (
                  <span className="pill">Đúng</span>
                ) : (
                  <span className="pill">Chưa đúng</span>
                )}{' '}
                <span className="muted">
                  {r.pointsAwarded}/{r.points} điểm
                </span>
              </p>
              {r.answerText ? <p>Bạn đã viết: {r.answerText}</p> : null}
              {r.explanation ? <p>Giải thích: {r.explanation}</p> : null}
            </article>
          );
        })}
        <HistoryList history={history} />
      </div>
    );
  }

  // ---- Render: gioi thieu (truoc khi bat dau) ----------------------------
  if (phase.status === 'ready') {
    return (
      <div>
        <div className="card">
          <h2>{paper.title}</h2>
          {paper.description ? <p>{paper.description}</p> : null}
          <p className="muted">
            {paper.questions.length === 0
              ? 'Bài kiểm tra chưa có câu hỏi nào.'
              : `${paper.questions.length} câu hỏi. `}
            Điểm đạt: {paper.passingScore}%.{' '}
            {paper.timeLimitSec !== null
              ? `Thời gian: ${Math.floor(paper.timeLimitSec / 60)} phút. `
              : 'Không giới hạn thời gian. '}
            {paper.maxAttempts !== null
              ? `Số lần làm tối đa: ${paper.maxAttempts} (đã dùng ${paper.attemptsUsed}, còn ${remainingAttempts}).`
              : 'Không giới hạn số lần làm.'}
          </p>
          {paper.questions.length === 0 ? (
            <p className="notice" role="status">
              Bài kiểm tra chưa có câu hỏi nào — vui lòng quay lại sau.
            </p>
          ) : exhausted ? (
            <p className="notice" role="status">
              Bạn đã hết số lần làm bài cho phép. Hãy xem lại lịch sử làm bài bên dưới.
            </p>
          ) : (
            <p>
              <button type="button" className="btn" onClick={startQuiz}>
                Bắt đầu làm bài
              </button>
            </p>
          )}
          <p>
            <Link className="btn btn-ghost" href={`/chuong-trinh/${encodeURIComponent(courseSlug)}`}>
              Về trang khóa học
            </Link>
          </p>
        </div>
        <HistoryList history={history} />
      </div>
    );
  }

  // ---- Render: dang lam bai ------------------------------------------------
  const paperDoing = doingPaper ?? paper;
  const missing = findUnansweredRequired(paperDoing, answers);
  return (
    <div>
      <div
        className="card"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <strong>{paper.title}</strong>
        {remaining !== null ? (
          <span className="pill" role="timer" aria-live="off">
            Còn lại: {formatCountdown(remaining)}
          </span>
        ) : (
          <span className="pill">Không giới hạn thời gian</span>
        )}
        <span className="muted">
          Đã trả lời {paperDoing.questions.length - missing.length}/{paperDoing.questions.length} câu
        </span>
      </div>

      {submitError ? (
        <p className="notice" role="alert" style={{ marginTop: '1rem' }}>
          {submitError}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmitClick();
        }}
      >
        {paperDoing.questions.map((q, idx) => (
          <fieldset
            key={q.id}
            className="card"
            style={{ marginTop: '1rem', border: '1px solid rgba(168, 132, 28, 0.55)' }}
          >
            <legend style={{ fontWeight: 700, paddingInline: '0.5rem' }}>
              Câu {idx + 1} · {typeLabelVi(q)} · {q.points} điểm
            </legend>
            <p style={{ marginTop: 0 }}>{q.question}</p>
            <QuestionInput
              question={q}
              answer={answers.get(q.id)}
              disabled={phase.status === 'submitting'}
              onOption={(optionId, multi) => setOptionAnswer(q.id, optionId, multi)}
              onText={(text) => setTextAnswer(q.id, text)}
            />
          </fieldset>
        ))}

        {confirmSubmit && missing.length > 0 ? (
          <p className="notice" role="alert" style={{ marginTop: '1rem' }}>
            Bạn còn {missing.length} câu bắt buộc chưa trả lời. Bấm “Nộp bài” một lần nữa để
            nộp với các câu còn trống (tính 0 điểm).
          </p>
        ) : null}

        <p style={{ marginTop: '1.5rem' }}>
          <button
            type="submit"
            className="btn"
            disabled={phase.status === 'submitting'}
          >
            {phase.status === 'submitting'
              ? 'Đang nộp bài…'
              : confirmSubmit && missing.length > 0
                ? `Nộp bài dù còn ${missing.length} câu chưa trả lời`
                : 'Nộp bài'}
          </button>
        </p>
      </form>
    </div>
  );
}

function QuestionInput({
  question,
  answer,
  disabled,
  onOption,
  onText,
}: {
  question: QuizQuestionPublic;
  answer: QuizAnswerInput | undefined;
  disabled: boolean;
  onOption: (optionId: string, multi: boolean) => void;
  onText: (text: string) => void;
}) {
  if (question.questionType === 'single_choice' || question.questionType === 'true_false') {
    const selected = answer?.optionIds?.[0];
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {question.options.map((o) => (
          <label
            key={o.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              minHeight: 44,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              value={o.id}
              checked={selected === o.id}
              disabled={disabled}
              onChange={() => onOption(o.id, false)}
              style={{ width: 20, height: 20, accentColor: '#a8841c' }}
            />
            <span>{o.optionText}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.questionType === 'multiple_choice') {
    const selected = new Set(answer?.optionIds ?? []);
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <p className="muted" style={{ margin: 0 }}>
          Có thể chọn nhiều đáp án.
        </p>
        {question.options.map((o) => (
          <label
            key={o.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              minHeight: 44,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              value={o.id}
              checked={selected.has(o.id)}
              disabled={disabled}
              onChange={() => onOption(o.id, true)}
              style={{ width: 20, height: 20, accentColor: '#a8841c' }}
            />
            <span>{o.optionText}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.questionType === 'fill_blank') {
    return (
      <div className="field">
        <label htmlFor={`fill-${question.id}`}>Đáp án của bạn</label>
        <input
          id={`fill-${question.id}`}
          type="text"
          value={answer?.answerText ?? ''}
          disabled={disabled}
          onChange={(e) => onText(e.target.value)}
          placeholder="Gõ đáp án vào đây"
          autoComplete="off"
        />
      </div>
    );
  }

  if (question.questionType === 'short_answer') {
    return (
      <div className="field">
        <label htmlFor={`short-${question.id}`}>Câu trả lời ngắn của bạn</label>
        <textarea
          id={`short-${question.id}`}
          rows={3}
          value={answer?.answerText ?? ''}
          disabled={disabled}
          onChange={(e) => onText(e.target.value)}
          style={{ width: '100%', minHeight: 88, font: 'inherit', fontSize: '1rem', padding: '0.7rem 0.9rem' }}
        />
      </div>
    );
  }

  // essay
  return (
    <div className="field">
      <label htmlFor={`essay-${question.id}`}>
        Bài tự luận của bạn (giảng viên sẽ chấm tay sau khi bạn nộp)
      </label>
      <textarea
        id={`essay-${question.id}`}
        rows={6}
        value={answer?.answerText ?? ''}
        disabled={disabled}
        onChange={(e) => onText(e.target.value)}
        style={{ width: '100%', minHeight: 160, font: 'inherit', fontSize: '1rem', padding: '0.7rem 0.9rem' }}
      />
    </div>
  );
}

function HistoryList({ history }: { history: QuizAttemptSummary[] }) {
  if (history.length === 0) return null;
  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h2>Lịch sử làm bài</h2>
      <ul className="lesson-list">
        {history.map((a) => (
          <li key={a.id} className="lesson-row">
            <span>
              {formatAttemptTime(a.submittedAt)} — {a.score}/{a.total} điểm ({a.percent}%)
            </span>
            <span className="lesson-meta">
              <span className="pill">
                {a.status === 'expired' ? 'Hết giờ' : a.passed ? 'Đạt' : 'Chưa đạt'}
              </span>
              {a.needsReview ? <span className="pill">Chờ chấm tay</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
