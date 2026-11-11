'use client';

// Trang /chuong-trinh — doc THAT tu Supabase (bang courses, published,
// sap xep display_order). Khong co du lieu mau, khong co fallback gia.
// Trang thai: loading / success / error (ke ca mat mang) / empty / not-configured.
import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PILLARS } from '@visfar/shared';
import CourseCard from '@/components/course/CourseCard';
import { fetchPublishedCourses, filterCourses, type CoursesState } from '@/lib/courses';

function CoursesContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<CoursesState>({ status: 'loading' });
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [pillar, setPillar] = useState('all');

  // Dong bo tu khoa khi di tu o tim kiem header (?q=...) sang trang nay.
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQuery(q);
  }, [searchParams]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchPublishedCourses());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const courses = useMemo(
    () => (state.status === 'success' ? filterCourses(state.courses, query, pillar) : []),
    [state, query, pillar],
  );
  const total = state.status === 'success' ? state.courses.length : 0;

  return (
    <div className="wrap">
      <h1 className="gold-title">Mười chương trình – Một hành trình phát triển</h1>
      <p>
        Từ thấu hiểu bản thân đến phát triển trí tuệ, kiến tạo nhân hiệu và làm chủ cuộc sống.
        VISFAR thiết kế hệ thống chương trình theo từng cấp độ, giúp mỗi người lựa chọn điểm bắt
        đầu và từng bước phát triển theo năng lực, mục tiêu của mình.
      </p>

      <label htmlFor="course-search">Tìm khóa học</label>
      <input
        id="course-search"
        className="search"
        type="search"
        placeholder="Tìm khóa học…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={state.status !== 'success'}
      />

      <div className="tabs" role="group" aria-label="Lọc theo trụ cột" style={{ marginTop: '1rem' }}>
        <button type="button" className="tab" aria-pressed={pillar === 'all'} onClick={() => setPillar('all')}>
          Tất cả
        </button>
        {PILLARS.filter((p) => p.value !== 'tich-hop').map((p) => (
          <button
            key={p.value}
            type="button"
            className="tab"
            aria-pressed={pillar === p.value}
            onClick={() => setPillar(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải danh sách khóa học…
        </p>
      )}

      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
          <p>
            Chưa có biến môi trường <code>NEXT_PUBLIC_SUPABASE_URL</code> và{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Xem README.md để tạo project Supabase và
            file <code>.env.local</code>. Trang không hiển thị dữ liệu giả thay thế.
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được danh sách khóa học.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status === 'success' && (
        <>
          <p role="status">
            Đang hiển thị {courses.length} / {total} chương trình.
          </p>
          {courses.length === 0 ? (
            <div className="notice">
              <p>
                <strong>Không tìm thấy khóa học nào phù hợp.</strong>
              </p>
              <p>Thử từ khóa khác hoặc chọn trụ cột khác.</p>
            </div>
          ) : (
            <div className="course-grid">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="wrap"><p role="status">Đang tải danh sách khóa học…</p></div>}>
      <CoursesContent />
    </Suspense>
  );
}
