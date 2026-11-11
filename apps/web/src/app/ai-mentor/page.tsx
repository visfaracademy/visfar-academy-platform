// Trang /ai-mentor — AI Mentor & AI Learning Assistant (Prompt 12).
// Chat hoi dap dua tren kho tri thuc da phe duyet (Thu vien Master
// 119 muc + mo ta 10 khoa hoc + triet ly trang chu). Can dang nhap:
// lich su hoi thoai luu DB, RLS chi chu so huu doc.
// Che do hien tai (11/11/2026): TIM KIEM THONG MINH — chua co key AI
// nen khong goi LLM, khong bia cau tra loi; moi cau tra loi deu kem
// trich dan nguon noi bo. Gioi han 20 cau hoi / gio / user.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AI_MENTOR_MAX_QUESTION_LEN,
  AI_MENTOR_SUGGESTED_QUESTIONS,
  askAiMentor,
  getAiMentorSession,
  isValidQuestion,
  listAiMentorSessions,
  sendAiMentorFeedback,
  sourceLabelVi,
  type AiMentorMessage,
  type AiMentorSessionItem,
} from '@/lib/ai-mentor';
import { getSessionState, type SessionState } from '@/lib/auth';

export default function AiMentorPage() {
  const [session, setSession] = useState<SessionState>({ status: 'signed-out' });
  const [sessions, setSessions] = useState<AiMentorSessionItem[]>([]);
  const [sessionsState, setSessionsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMentorMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askMode, setAskMode] = useState<'smart-search' | 'llm' | null>(null);
  const [historyWarning, setHistoryWarning] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState<Record<string, boolean>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getSessionState().then((s) => {
      setSession(s);
      if (s.status === 'active') {
        void listAiMentorSessions().then((res) => {
          if (res.status === 'success') {
            setSessions(res.data);
            setSessionsState('ready');
          } else if (res.status === 'signed-out') {
            setSession({ status: 'signed-out' });
            setSessionsState('ready');
          } else {
            setSessionsState('error');
          }
        });
      } else {
        setSessionsState('ready');
      }
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, asking]);

  const openSession = useCallback(async (id: string) => {
    setLoadingHistory(true);
    setAskError(null);
    const res = await getAiMentorSession(id);
    setLoadingHistory(false);
    if (res.status === 'success') {
      setCurrentSessionId(id);
      setMessages(res.messages);
    } else if (res.status === 'signed-out') {
      setSession({ status: 'signed-out' });
    } else if (res.status === 'error') {
      setAskError(res.message);
    }
  }, []);

  const newConversation = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setAskError(null);
    setHistoryWarning(false);
    setAskMode(null);
  }, []);

  const handleAsk = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = question.trim();
      if (!isValidQuestion(q) || asking) return;
      setAsking(true);
      setAskError(null);
      setHistoryWarning(false);
      const userMsg: AiMentorMessage = {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content: q,
        sources: [],
        helpful: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setQuestion('');
      const res = await askAiMentor(q, currentSessionId);
      setAsking(false);
      if (res.status === 'signed-out') {
        setSession({ status: 'signed-out' });
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        return;
      }
      if (res.status === 'error') {
        setAskError(res.message);
        return;
      }
      setAskMode(res.data.mode);
      setCurrentSessionId(res.data.sessionId);
      if (!res.data.historySaved) setHistoryWarning(true);
      const assistantMsg: AiMentorMessage = {
        id: `local-assistant-${Date.now()}`,
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        helpful: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      void listAiMentorSessions().then((r) => {
        if (r.status === 'success') setSessions(r.data);
      });
    },
    [question, asking, currentSessionId],
  );

  const handleFeedback = useCallback(async (messageId: string, helpful: boolean) => {
    const res = await sendAiMentorFeedback(messageId, helpful);
    if (res.status === 'success') {
      setFeedbackDone((prev) => ({ ...prev, [messageId]: true }));
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, helpful } : m)),
      );
    }
  }, []);

  const askSuggestion = useCallback(
    (q: string) => {
      setQuestion(q);
    },
    [],
  );

  if (session.status !== 'active') {
    return (
      <main className="ai-mentor-page">
        <h1 className="gold-title">AI Mentor</h1>
        <p className="ai-mentor-intro">
          Trợ lý học tập của Visfar Academy — trả lời dựa trên Thư viện Master, mô tả khóa học
          và triết lý Giáo dục Tận Gốc đã được phê duyệt.
        </p>
        <div className="notice">
          <p>Bạn cần đăng nhập để hỏi AI Mentor và xem lại lịch sử hội thoại của mình.</p>
          <p>
            <Link className="btn btn-gold" href="/dang-nhap?next=/ai-mentor">
              Đăng nhập
            </Link>{' '}
            <Link className="btn btn-ghost" href="/dang-ky?next=/ai-mentor">
              Đăng ký tài khoản
            </Link>
          </p>
        </div>
        <p className="ai-mentor-disclaimer">
          AI hỗ trợ học tập, không thay thế bác sĩ / chuyên gia tâm lý / luật sư / cố vấn tài chính.
        </p>
      </main>
    );
  }

  return (
    <main className="ai-mentor-page">
      <h1 className="gold-title">AI Mentor</h1>
      <p className="ai-mentor-intro">
        Hỏi về khái niệm trong Thư viện Master, triết lý Giáo dục Tận Gốc, hoặc một khóa học
        của Visfar Academy. Mỗi câu trả lời đều ghi rõ nguồn nội bộ để bạn kiểm chứng lại.
      </p>
      <p className="ai-mentor-mode" role="status">
        Chế độ hiện tại: <strong>Tìm kiếm thông minh</strong> — trả lời dựa trên tri thức đã
        được phê duyệt, chưa dùng AI tạo sinh. Giới hạn 20 câu hỏi / giờ.
      </p>

      <div className="ai-mentor-layout">
        <aside className="ai-mentor-history" aria-label="Lịch sử hội thoại">
          <div className="ai-mentor-history-head">
            <h2>Lịch sử hội thoại</h2>
            <button type="button" className="btn btn-ghost ai-mentor-new" onClick={newConversation}>
              + Hội thoại mới
            </button>
          </div>
          {sessionsState === 'loading' && <p role="status">Đang tải lịch sử…</p>}
          {sessionsState === 'error' && <p>Chưa tải được lịch sử hội thoại.</p>}
          {sessionsState === 'ready' && sessions.length === 0 && (
            <p className="ai-mentor-empty-note">Chưa có hội thoại nào.</p>
          )}
          {sessions.length > 0 && (
            <ul className="ai-mentor-session-list">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === currentSessionId ? 'active' : ''}
                    aria-current={s.id === currentSessionId ? 'true' : undefined}
                    onClick={() => void openSession(s.id)}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="ai-mentor-chat" aria-label="Hội thoại với AI Mentor">
          {loadingHistory && <p role="status">Đang tải hội thoại…</p>}

          {messages.length === 0 && !asking && (
            <div className="ai-mentor-empty">
              <p>Bạn có thể hỏi thử:</p>
              <ul className="ai-mentor-suggestions">
                {AI_MENTOR_SUGGESTED_QUESTIONS.map((q) => (
                  <li key={q}>
                    <button type="button" onClick={() => askSuggestion(q)}>
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="ai-mentor-messages">
            {messages.map((m) => (
              <li key={m.id} className={`ai-mentor-msg ai-mentor-msg-${m.role}`}>
                <p className="ai-mentor-answer">{m.content}</p>
                {m.role === 'assistant' && m.sources.length > 0 && (
                  <div className="ai-mentor-sources">
                    <p>Nguồn nội bộ:</p>
                    <ul>
                      {m.sources.map((s) => (
                        <li key={`${s.sourceType}:${s.sourceSlug}`}>
                          <Link href={s.url}>
                            {s.title} — {sourceLabelVi(s.sourceType)}
                          </Link>
                          {s.sourceType === 'course' && typeof s.enrolled === 'boolean' && (
                            <span className="ai-mentor-enrolled">
                              {s.enrolled ? ' · Đã ghi danh' : ' · Chưa ghi danh'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.role === 'assistant' && (
                  <div className="ai-mentor-feedback">
                    {feedbackDone[m.id] || m.helpful !== null ? (
                      <span>Cảm ơn phản hồi của bạn.</span>
                    ) : (
                      <>
                        <span>Câu trả lời này có hữu ích không?</span>{' '}
                        <button type="button" onClick={() => void handleFeedback(m.id, true)}>
                          👍 Hữu ích
                        </button>{' '}
                        <button type="button" onClick={() => void handleFeedback(m.id, false)}>
                          👎 Chưa hữu ích
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {asking && (
            <p role="status" aria-live="polite" className="ai-mentor-thinking">
              Đang tìm trong Thư viện Master…
            </p>
          )}
          {askMode === 'llm' && (
            <p className="ai-mentor-mode-note">Câu trả lời vừa rồi do AI tạo sinh từ đoạn tri thức được cung cấp.</p>
          )}
          {historyWarning && (
            <p role="alert" className="ai-mentor-warning">
              Câu trả lời đã hiển thị nhưng chưa lưu được vào lịch sử hội thoại. Vui lòng thử lại sau.
            </p>
          )}
          {askError && (
            <p role="alert" className="ai-mentor-error">
              {askError}{' '}
              <button type="button" onClick={() => setAskError(null)}>
                Đóng
              </button>
            </p>
          )}
          <div ref={bottomRef} />

          <form className="ai-mentor-form" onSubmit={handleAsk}>
            <label htmlFor="ai-mentor-question" className="sr-only">
              Câu hỏi cho AI Mentor
            </label>
            <textarea
              id="ai-mentor-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ví dụ: An vui là gì?"
              rows={2}
              maxLength={AI_MENTOR_MAX_QUESTION_LEN}
              disabled={asking}
            />
            <button type="submit" className="btn btn-gold" disabled={asking || !isValidQuestion(question)}>
              {asking ? 'Đang hỏi…' : 'Hỏi AI Mentor'}
            </button>
          </form>
          <p className="ai-mentor-count">
            {question.trim().length}/{AI_MENTOR_MAX_QUESTION_LEN} ký tự · Tối đa 20 câu / giờ
          </p>
          <p className="ai-mentor-disclaimer">
            AI hỗ trợ học tập, không thay thế bác sĩ / chuyên gia tâm lý / luật sư / cố vấn tài chính.
          </p>
        </section>
      </div>
    </main>
  );
}
