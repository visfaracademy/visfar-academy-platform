// Trang cong khai /danh-gia-11d — bo cau hoi tu danh gia 11 phuong dien.
// Lam bai KHONG can dang nhap (dap an luu nhap localStorage); de LUU ket
// qua + xem lai lich su thi can dang nhap. Ket qua hien ngay sau khi nop
// (tinh tren trinh duyet, khong gui di dau khi chua bam Luu).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AssessmentResult from '@/components/assessment/AssessmentResult';
import {
  DIMENSIONS,
  QUESTIONS,
  SCALE_LABELS,
  answeredCount,
  clearDraft,
  computeScores,
  isComplete,
  loadDraft,
  saveAssessment,
  saveDraft,
  type Answers,
} from '@/lib/assessment-11d';
import { getSessionState, type SessionState } from '@/lib/auth';

export default function DanhGia11DPage() {
  const [answers, setAnswers] = useState<Answers>({});
  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState>({ status: 'signed-out' });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setAnswers(loadDraft());
    setLoaded(true);
    void getSessionState().then(setSession);
  }, []);

  const done = answeredCount(answers);
  const { scores, overall } = useMemo(() => computeScores(answers), [answers]);

  const setAnswer = useCallback((questionId: string, value: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      saveDraft(next);
      return next;
    });
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isComplete(answers)) {
        const firstMissing = QUESTIONS.find((q) => typeof answers[q.id] !== 'number');
        setFormError(
          `Bạn đã trả lời ${done}/33 câu. Vui lòng trả lời hết các câu hỏi trước khi xem kết quả.` +
            (firstMissing ? ` Câu chưa trả lời đầu tiên: “${firstMissing.text}”.` : ''),
        );
        return;
      }
      setFormError(null);
      setSaveState('idle');
      setSaveMessage(null);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [answers, done],
  );

  const handleSave = useCallback(async () => {
    setSaveState('saving');
    setSaveMessage(null);
    const result = await saveAssessment(answers);
    if (result.status === 'ok') {
      setSaveState('saved');
      setSaveMessage('Đã lưu kết quả. Bạn có thể xem lại và so sánh ở mục “Đánh giá 11D” trong tài khoản học viên.');
      clearDraft();
    } else {
      setSaveState('error');
      setSaveMessage(result.message);
    }
  }, [answers]);

  const handleRetake = useCallback(() => {
    setAnswers({});
    clearDraft();
    setSubmitted(false);
    setFormError(null);
    setSaveState('idle');
    setSaveMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!loaded) {
    return (
      <div className="wrap">
        <p role="status">Đang tải bài đánh giá…</p>
      </div>
    );
  }

  if (submitted && overall !== null) {
    return (
      <div className="wrap">
        <AssessmentResult
          scores={scores}
          overall={overall}
          completedLabel="Hoàn thành vừa xong — bạn có thể làm lại bài sau một thời gian để so sánh thay đổi."
          actions={
            <>
              {session.status === 'active' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-gold"
                    onClick={() => void handleSave()}
                    disabled={saveState === 'saving' || saveState === 'saved'}
                  >
                    {saveState === 'saving'
                      ? 'Đang lưu…'
                      : saveState === 'saved'
                        ? 'Đã lưu kết quả'
                        : 'Lưu kết quả vào tài khoản'}
                  </button>{' '}
                  <Link className="btn btn-ghost" href="/hoc-vien/danh-gia-11d">
                    Xem lịch sử đánh giá
                  </Link>
                </>
              ) : (
                <div className="notice">
                  <p>
                    <strong>Muốn lưu kết quả và đánh giá lại theo chu kỳ?</strong> Hãy{' '}
                    <Link href="/dang-nhap?next=/danh-gia-11d">đăng nhập</Link> (hoặc{' '}
                    <Link href="/dang-ky">đăng ký tài khoản</Link>) rồi bấm “Lưu kết quả”.
                    Bài làm của bạn đã được lưu tạm trên trình duyệt này, không mất khi đăng nhập xong.
                  </p>
                </div>
              )}
              {saveMessage && (
                <p className={saveState === 'error' ? 'field-error' : 'form-status'} role={saveState === 'error' ? 'alert' : 'status'}>
                  {saveMessage}
                </p>
              )}
              <button type="button" className="btn btn-ghost" onClick={handleRetake}>
                Làm lại bài
              </button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="assessment-intro">
        <p className="chapter">Thập Nhất Viên Mãn</p>
        <h1 className="gold-title">Đánh giá 11 phương diện</h1>
        <p>
          Bài tự đánh giá đầu vào gồm 33 câu hỏi — 3 câu cho mỗi phương diện trong hệ
          Thập Nhất Viên Mãn: Tâm thức, Tâm thái, Tâm đạo, Trí tuệ, Nghị lực, Thể chất,
          Tinh thần, Phẩm chất, Nhân cách, Năng lực và Vật chất.
        </p>
        <p>
          Hãy trả lời theo cảm nhận thật của bạn trong thời gian gần đây, không có đáp án
          đúng hay sai. Thang điểm 1–5: 1 là Rất ít, 5 là Rất thường xuyên. Kết quả chỉ
          giúp bạn nhìn rõ mình đang ở đâu để chọn hướng phát triển tiếp theo.
        </p>
        <p className="muted">
          Không cần đăng nhập để làm bài. Bài làm được lưu tạm trên trình duyệt này.
          Để lưu kết quả và xem lại, bạn cần đăng nhập.
        </p>
      </div>

      <p role="status" aria-live="polite" className="assessment-progress">
        Đã trả lời <strong>{done}/33</strong> câu
      </p>
      <div className="assessment-bar" role="img" aria-label={`Đã trả lời ${done} trên 33 câu`}>
        <span style={{ width: `${(done / 33) * 100}%` }} />
      </div>

      <form onSubmit={handleSubmit} className="assessment-form">
        {DIMENSIONS.map((dim) => {
          const qs = QUESTIONS.filter((q) => q.dimensionKey === dim.key);
          return (
            <section key={dim.key} className="card assessment-dimension" aria-labelledby={`dim-${dim.key}`}>
              <h2 id={`dim-${dim.key}`}>
                {dim.num} · {dim.name}
              </h2>
              <p className="muted">{dim.description}</p>
              {qs.map((q, qi) => (
                <fieldset key={q.id} className="assessment-question">
                  <legend>
                    Câu {qi + 1}. {q.text}
                  </legend>
                  <p className="hint">{q.hint}</p>
                  <div className="assessment-scale" role="radiogroup" aria-label={q.text}>
                    {SCALE_LABELS.map((s) => (
                      <label key={s.value} className="assessment-scale-option">
                        <input
                          type="radio"
                          name={q.id}
                          value={s.value}
                          checked={answers[q.id] === s.value}
                          onChange={() => setAnswer(q.id, s.value)}
                        />
                        <span className="assessment-scale-num">{s.value}</span>
                        <span>{s.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </section>
          );
        })}

        {formError && (
          <div className="notice error" role="alert">
            <p>{formError}</p>
          </div>
        )}

        <button type="submit" className="btn btn-gold assessment-submit">
          Xem kết quả của tôi
        </button>
        <p className="muted">
          Khi bấm “Xem kết quả”, kết quả chỉ hiển thị trên trình duyệt của bạn. Muốn lưu
          lại, hãy đăng nhập rồi bấm “Lưu kết quả” ở trang kết quả.
        </p>
      </form>
    </div>
  );
}
