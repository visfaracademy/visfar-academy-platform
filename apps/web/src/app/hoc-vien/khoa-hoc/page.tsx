// Trang /hoc-vien/khoa-hoc — khoa dang hoc + khoa da hoan thanh,
// tien do theo module (QĐ 17: video >= 90%, bai text bam hoan thanh).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import {
  enrollmentStatusLabelVi,
  getMyCourseProgress,
  splitEnrollments,
  type CourseProgressItem,
  type DashboardState,
} from '@/lib/dashboard';
import DashboardNav from '@/components/dashboard/DashboardNav';
import ResumeButton from '@/components/learning/ResumeButton';

function CourseCard({ c }: { c: CourseProgressItem }) {
  return (
    <article className="card">
      <h3>
        {c.courseSlug ? <Link href={`/chuong-trinh/${c.courseSlug}`}>{c.courseTitle}</Link> : c.courseTitle}
      </h3>
      <p>
        Trạng thái: <strong>{enrollmentStatusLabelVi(c.status)}</strong>
      </p>
      <p>
        Đã học {c.completedLessons}/{c.totalLessons} bài — {c.progressPercent}%
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={c.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tiến độ ${c.courseTitle}`}
      >
        <div className="progress-fill" style={{ width: `${c.progressPercent}%` }} />
      </div>
      {c.modules.length > 0 && (
        <ul className="module-list">
          {c.modules.map((m) => (
            <li key={m.moduleId}>
              {m.title}: {m.completedLessons}/{m.totalLessons} bài ({m.progressPercent}%)
            </li>
          ))}
        </ul>
      )}
      <p className="muted">Ghi danh ngày {new Date(c.enrolledAt).toLocaleDateString('vi-VN')}</p>
      {c.completedAt && (
        <p className="muted">Hoàn thành ngày {new Date(c.completedAt).toLocaleDateString('vi-VN')}</p>
      )}
      {c.courseSlug && (
        <p>
          <ResumeButton courseSlug={c.courseSlug} returnTo="/hoc-vien/khoa-hoc" />
        </p>
      )}
    </article>
  );
}

export default function KhoaHocPage() {
  const [authState, setAuthState] = useState<ProfileState>({ status: 'loading' });
  const [state, setState] = useState<DashboardState<CourseProgressItem[]>>({ status: 'success', data: [] });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed'>('all');

  const load = useCallback(async () => {
    setAuthState({ status: 'loading' });
    const p = await getMyProfileState();
    setAuthState(p);
    if (p.status === 'success') setState(await getMyCourseProgress());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (authState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải khóa học…
        </p>
      </div>
    );
  }
  if (authState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Khóa học của tôi</h1>
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
        <h1 className="gold-title">Khóa học của tôi</h1>
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
  const { inProgress, completed } = splitEnrollments(items);
  const q = query.trim().toLowerCase();
  const matches = (c: CourseProgressItem) => q === '' || c.courseTitle.toLowerCase().includes(q);
  const shownInProgress = inProgress.filter(matches);
  const shownCompleted = completed.filter(matches);

  return (
    <div className="wrap">
      <h1 className="gold-title">Khóa học của tôi</h1>
      <DashboardNav />

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được tiến độ học.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status === 'success' && items.length === 0 && (
        <div className="notice">
          <p>Bạn chưa ghi danh khóa học nào.</p>
          <p>
            <Link className="btn" href="/chuong-trinh">
              Xem 10 chương trình
            </Link>
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="field" role="search">
            <label htmlFor="my-courses-search">Tìm khóa học của tôi</label>
            <input
              id="my-courses-search"
              type="search"
              placeholder="Nhập tên khóa học…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-tabs" role="group" aria-label="Lọc khóa học theo trạng thái">
            <button
              type="button"
              className={filter === 'all' ? 'active' : ''}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              Tất cả ({items.length})
            </button>
            <button
              type="button"
              className={filter === 'in-progress' ? 'active' : ''}
              aria-pressed={filter === 'in-progress'}
              onClick={() => setFilter('in-progress')}
            >
              Đang học ({inProgress.length})
            </button>
            <button
              type="button"
              className={filter === 'completed' ? 'active' : ''}
              aria-pressed={filter === 'completed'}
              onClick={() => setFilter('completed')}
            >
              Đã hoàn thành ({completed.length})
            </button>
          </div>
          {shownInProgress.length === 0 && shownCompleted.length === 0 && (
            <div className="notice">
              <p>Không tìm thấy khóa học nào khớp “{query.trim()}”.</p>
            </div>
          )}
        </>
      )}

      {(filter === 'all' || filter === 'in-progress') && shownInProgress.length > 0 && (
        <section aria-labelledby="inprogress-title">
          <h2 id="inprogress-title" className="gold-title">Đang học ({shownInProgress.length})</h2>
          <div className="course-grid">
            {shownInProgress.map((c) => (
              <CourseCard key={c.enrollmentId} c={c} />
            ))}
          </div>
        </section>
      )}

      {(filter === 'all' || filter === 'completed') && shownCompleted.length > 0 && (
        <section aria-labelledby="completed-title" style={{ marginTop: '1.5rem' }}>
          <h2 id="completed-title" className="gold-title">Đã hoàn thành ({shownCompleted.length})</h2>
          <div className="course-grid">
            {shownCompleted.map((c) => (
              <CourseCard key={c.enrollmentId} c={c} />
            ))}
          </div>
          <p>
            <Link className="btn" href="/hoc-vien/chung-chi">
              Xem chứng chỉ
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
