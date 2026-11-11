// Khoi chuong trinh tren trang chu — tim kiem + 5 tab loc + toggle chi tiet.
// Du lieu NGUYEN VAN tu file HTML goc (src/lib/homepage-data.ts).
// Loc dung normalizeSearch() giong filterCourses (bo dau tieng Viet),
// tab la da-tru-cot: khoa 07/08/09 thuoc ca 3 tru (nhu data-cat goc).
// CTA pre-select qua /tu-van?course=<slug> (xem ConsultationForm).
'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { COURSE_TABS, HOME_COURSES } from '@/lib/homepage-data';
import { LEAD_INSTRUCTOR_NAME } from '@/lib/courses';
import { normalizeSearch } from '@/lib/validation';

export default function CourseExplorer() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: HOME_COURSES.length };
    for (const t of COURSE_TABS.slice(1)) {
      c[t.value] = HOME_COURSES.filter((course) => course.cats.includes(t.value)).length;
    }
    return c;
  }, []);

  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    return HOME_COURSES.filter((course) => {
      if (tab !== 'all' && !course.cats.includes(tab)) return false;
      if (!q) return true;
      const haystack = normalizeSearch(
        [course.title, course.subtitle, course.description, ...course.content, course.outcome].join(' '),
      );
      return q.split(/\s+/).every((w) => haystack.includes(w));
    });
  }, [query, tab]);

  const toggle = (slug: string) => setOpen((prev) => ({ ...prev, [slug]: !prev[slug] }));

  return (
    <div>
      <label htmlFor="courseSearch" className="sr-only">
        Tìm khóa học, giảng viên
      </label>
      <input
        id="courseSearch"
        className="search"
        type="search"
        placeholder="Tìm khóa học, giảng viên…"
        aria-label="Tìm khóa học, giảng viên"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="tabs" role="group" aria-label="Lọc theo trụ cột">
        {COURSE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className="tab"
            aria-pressed={tab === t.value}
            onClick={() => setTab(t.value)}
          >
            {t.label} {counts[t.value]}
          </button>
        ))}
      </div>

      <p role="status" className="course-count">
        Đang hiển thị {visible.length} / {HOME_COURSES.length} chương trình.
      </p>

      {visible.length === 0 ? (
        <div className="notice no-result" role="status">
          <p>
            <strong>Không tìm thấy chương trình phù hợp với lựa chọn hiện tại.</strong>
          </p>
          <p>Thử từ khóa khác hoặc chọn “Tất cả”.</p>
        </div>
      ) : (
        <div className="prog-grid">
          {visible.map((course) => {
            const isOpen = Boolean(open[course.slug]);
            return (
              <article
                key={course.slug}
                className={`prog-card reveal in${course.featured ? ' featured' : ''}${isOpen ? ' details-open' : ''}`}
                data-cat={course.cats.join(' ')}
                data-num={course.num}
              >
                <div className={`poster${course.featured ? ' poster-wide' : ''}`}>
                  <Image
                    src={`/images/poster-${course.num}.jpg`}
                    alt=""
                    width={1600}
                    height={900}
                    loading="lazy"
                  />
                  <div className="poster-overlay">
                    <p className="poster-kicker">KHÓA HỌC</p>
                    <p className="poster-title">{course.posterTitle}</p>
                    <p className="poster-sub">{course.posterSub}</p>
                  </div>
                </div>
                <div className="prog-body">
                  <h3>
                    <span className="course-num">{course.num}.</span> {course.title}
                  </h3>
                  <p className="prog-subtitle">
                    <strong>{course.subtitle}</strong>
                  </p>
                  <p>{course.description}</p>
                  <p className="muted">
                    Giảng viên: <strong>{LEAD_INSTRUCTOR_NAME}</strong>
                  </p>
                  {course.temp ? (
                    <p className="muted">Nội dung tạm — chờ văn bản của người sáng lập để thay.</p>
                  ) : null}
                  {isOpen ? (
                    <div className="prog-details">
                      <h4>{course.contentTitle}:</h4>
                      <ul>
                        {course.content.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <p>
                        <strong>{course.outcomeLabel}:</strong> {course.outcome}
                      </p>
                      {course.extra
                        ? course.extra.map((line) => <p key={line}>{line}</p>)
                        : null}
                    </div>
                  ) : null}
                  <p className="prog-actions">
                    <Link className="btn btn-gold" href={`/tu-van?course=${course.slug}`}>
                      {course.ctaLabel}
                    </Link>{' '}
                    <button
                      type="button"
                      className="prog-toggle btn btn-ghost"
                      aria-expanded={isOpen}
                      onClick={() => toggle(course.slug)}
                    >
                      {isOpen ? 'Thu gọn chi tiết' : 'Xem chi tiết khóa học'}
                    </button>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="prog-help">
        <h3>CHƯA BIẾT BẮT ĐẦU TỪ ĐÂU?</h3>
        <p>Hãy để VISFAR đồng hành cùng bạn lựa chọn lộ trình phù hợp</p>
        <p>
          Mỗi người có một xuất phát điểm, mục tiêu và hành trình riêng. Hãy chia sẻ điều bạn muốn
          thay đổi, VISFAR sẽ giúp bạn xác định chương trình phù hợp – bắt đầu từ những bước nền
          tảng nhất.
        </p>
        <p>
          <Link className="btn btn-gold" href="/tu-van?course=unknown">
            Tư vấn định hướng miễn phí →
          </Link>
        </p>
      </div>
    </div>
  );
}
