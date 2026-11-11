// Trang /hoc-vien/lich-su-hoc — lich su hoc (lesson_progress), moi nhat
// truoc, toi da 50 su kien gan nhat. Day la noi dung cu cua
// /hoc-vien/lich-su, chuyen sang day ngay 11/11/2026 khi /hoc-vien/lich-su
// thanh trang Lich hen that.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import {
  eventTypeLabelVi,
  getMyLearningHistory,
  getMyQuizAttempts,
  isQuizPassed,
  QUIZ_PASS_PERCENT,
  quizScorePercent,
  type DashboardState,
  type LearningEventItem,
  type QuizAttemptItem,
} from '@/lib/dashboard';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default function LichSuPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<DashboardState<LearningEventItem[]>>({ status: 'success', data: [] });
  const [quizState, setQuizState] = useState<DashboardState<QuizAttemptItem[]>>({
    status: 'success',
    data: [],
  });
  const [eventFilter, setEventFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') {
      setState(await getMyLearningHistory());
      setQuizState(await getMyQuizAttempts());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (authState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải lịch sử học…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Lịch sử học</h1>
        <div className="notice" role="status">
          <p>
            Bạn chưa đăng nhập.{' '}
            <Link className="btn" href="/dang-nhap">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    );
  }
  if (authState.status === 'error' || authState.status === 'not-configured') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Lịch sử học</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được hồ sơ.</strong>
          </p>
          {authState.status === 'error' && <p>{authState.message}</p>}
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      </div>
    );
  }

  const items = state.status === 'success' ? state.data : [];
  const quizItems = quizState.status === 'success' ? quizState.data : [];
  const eventTypes = [...new Set(items.map((ev) => ev.eventType))];
  const shownItems = eventFilter === 'all' ? items : items.filter((ev) => ev.eventType === eventFilter);
  const passedCount = quizItems.filter((q) => isQuizPassed(q.score, q.total)).length;

  return (
    <div className="wrap">
      <h1 className="gold-title">Lịch sử học</h1>
      <DashboardNav />

      <section aria-labelledby="diem-quiz-title">
        <h2 id="diem-quiz-title" className="gold-title">
          Điểm quiz ({quizItems.length}
          {quizItems.length > 0 ? ` · ${passedCount} bài đạt ≥ ${QUIZ_PASS_PERCENT}%` : ''})
        </h2>
        {quizState.status === 'error' && (
          <div className="notice error" role="alert">
            <p>
              <strong>Không tải được điểm quiz.</strong>
            </p>
            <p>{quizState.message}</p>
          </div>
        )}
        {quizState.status === 'success' && quizItems.length === 0 && (
          <div className="notice">
            <p>Bạn chưa làm quiz nào.</p>
          </div>
        )}
        {quizItems.length > 0 && (
          <ul className="dashboard-list">
            {quizItems.map((q) => {
              const pct = quizScorePercent(q.score, q.total);
              const passed = isQuizPassed(q.score, q.total);
              return (
                <li key={q.id} className="list-row">
                  <p>
                    <strong>{q.lessonTitle || 'Quiz'}</strong>
                    {q.courseTitle ? ` (${q.courseTitle})` : ''} — {q.score}/{q.total} ({pct}%)
                  </p>
                  <p>
                    <span className={`pill ${passed ? 'pill-pass' : 'pill-fail'}`}>
                      {passed ? 'Đạt' : 'Chưa đạt'}
                    </span>{' '}
                    <span className="muted">
                      {new Date(q.submittedAt).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p>
          <Link className="btn btn-ghost" href="/hoc-vien/chung-chi">
            Xem chứng chỉ của tôi
          </Link>
        </p>
      </section>

      <section aria-labelledby="hoat-dong-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="hoat-dong-title" className="gold-title">Hoạt động học</h2>
        {eventTypes.length > 0 && (
          <div className="field">
            <label htmlFor="event-filter">Lọc theo loại hoạt động</label>
            <select
              id="event-filter"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="all">Tất cả hoạt động ({items.length})</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {eventTypeLabelVi(t)} ({items.filter((ev) => ev.eventType === t).length})
                </option>
              ))}
            </select>
          </div>
        )}
        {state.status === 'error' && (
          <div className="notice error" role="alert">
            <p>
              <strong>Không tải được lịch sử học.</strong>
            </p>
            <p>{state.message}</p>
            <p>
              <button type="button" className="btn" onClick={() => void load()}>
                Thử lại
              </button>
            </p>
          </div>
        )}
      </section>

      {state.status === 'success' && items.length === 0 && (
        <div className="notice">
          <p>Chưa có hoạt động học nào được ghi nhận.</p>
          <p>
            <Link className="btn" href="/hoc-vien/khoa-hoc">
              Vào khóa học của tôi
            </Link>
          </p>
        </div>
      )}

      {shownItems.length > 0 && (
        <ul className="dashboard-list">
          {shownItems.map((ev) => (
            <li key={ev.id} className="list-row">
              <p>
                <strong>{eventTypeLabelVi(ev.eventType)}</strong>
                {ev.lessonTitle ? ` — ${ev.lessonTitle}` : ''}
                {ev.courseTitle ? ` (${ev.courseTitle})` : ''}
                {ev.progressPercent !== null ? ` — ${ev.progressPercent}%` : ''}
              </p>
              <p className="muted">
                {new Date(ev.occurredAt).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'success' && items.length > 0 && shownItems.length === 0 && (
        <div className="notice">
          <p>Không có hoạt động nào thuộc loại đã chọn.</p>
        </div>
      )}
    </div>
  );
}
