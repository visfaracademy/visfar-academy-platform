'use client';

// Cloudflare Pages yeu cau route dong chay Edge Runtime.
export const runtime = 'edge';

// Trang chi tiet 1 khoa — doc THAT tu Supabase theo slug.
// Trang thai: loading / success / not-found (404 that) / error / not-configured.
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Course } from '@visfar/shared';
import { normalizePillar, PILLAR_LABELS } from '@visfar/shared';
import LessonPlayer, { type PlayerLesson } from '@/components/course/LessonPlayer';
import { fetchCourseBySlug, LEAD_INSTRUCTOR_NAME } from '@/lib/courses';
import {
  fetchLessonContentViaApi,
  type LessonContentPayload,
} from '@/lib/learning';
import {
  computeCourseProgressPercent,
  formatPosition,
  getCourseProgressDetail,
  isProgressRowCompleted,
  lessonTypeLabelVi,
  type CourseLessonItem,
  type CourseProgressDetail,
  type LessonProgressRow,
  type ProgressDetailState,
} from '@/lib/progress';
import CourseCurriculum from '@/components/course/CourseCurriculum';
import CheckoutButton from '@/components/payment/CheckoutButton';
import ResumeButton from '@/components/learning/ResumeButton';
import Breadcrumb from '@/components/seo/Breadcrumb';
import { breadcrumbJsonLd, courseJsonLd } from '@/lib/seo';

type State =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'success'; course: Course | null }
  | { status: 'error'; message: string };

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [detailState, setDetailState] = useState<ProgressDetailState | { status: 'loading' }>({
    status: 'loading',
  });
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setDetailState({ status: 'loading' });
    setDetailState(await getCourseProgressDetail(slug));
  }, [slug]);

  // Cap nhat tien do cuc bo khi LessonPlayer luu xong (khong goi lai
  // API lien tuc khi dang xem video) — tinh lai % khoa/module.
  const handleProgressSaved = useCallback((row: LessonProgressRow) => {
    setDetailState((prev) => {
      if (prev.status !== 'success') return prev;
      const next = new Map(prev.detail.progressByLesson);
      next.set(row.lesson_id, row);
      const modules = prev.detail.modules.map((m) => {
        const completed = m.lessons.filter((l) =>
          isProgressRowCompleted(next.get(l.id), l.type),
        ).length;
        return {
          ...m,
          completedLessons: completed,
          progressPercent: computeCourseProgressPercent(m.totalLessons, completed),
        };
      });
      const total = modules.reduce((s, m) => s + m.totalLessons, 0);
      const done = modules.reduce((s, m) => s + m.completedLessons, 0);
      return {
        status: 'success',
        detail: {
          ...prev.detail,
          modules,
          progressByLesson: next,
          totalLessons: total,
          completedLessons: done,
          progressPercent: computeCourseProgressPercent(total, done),
        },
      };
    });
  }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await fetchCourseBySlug(slug);
    if (res.status === 'error') setState({ status: 'error', message: res.message });
    else if (res.status === 'not-configured') setState({ status: 'not-configured' });
    else setState({ status: 'success', course: res.course });
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadedCourse = state.status === 'success' ? state.course : null;
  useEffect(() => {
    if (loadedCourse) void loadDetail();
  }, [loadedCourse, loadDetail]);

  return (
    <div className="wrap">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Các khóa học', href: '/chuong-trinh' },
          { label: state.status === 'success' && state.course ? state.course.title : 'Khóa học' },
        ]}
      />
      {state.status === 'loading' && <p role="status">Đang tải khóa học…</p>}
      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong> Xem README.md để tạo project và file{' '}
            <code>.env.local</code>.
          </p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được khóa học.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}
      {state.status === 'success' && state.course === null && (
        <div className="notice" role="alert">
          <h1>Không tìm thấy khóa học</h1>
          <p>Khóa học “{slug}” không tồn tại hoặc chưa được công bố.</p>
        </div>
      )}
      {state.status === 'success' && state.course !== null && (
        <>
          {/* JSON-LD Course + BreadcrumbList: du lieu that tu DB (title /
              description / slug). Trang la client component nen khong co
              generateMetadata; script nay render cung DOM khi khoa da tai.
              Khong dua offers (gia Tuy tam chua chot). */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                courseJsonLd({
                  slug: state.course.slug,
                  title: state.course.title,
                  description:
                    state.course.description ?? state.course.subtitle ?? state.course.title,
                }),
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                breadcrumbJsonLd([
                  { name: 'Trang chủ', path: '/' },
                  { name: 'Các khóa học', path: '/chuong-trinh' },
                  { name: state.course.title },
                ]),
              ),
            }}
          />
          <article>
            <p>
              <span className="course-num">
                {String(state.course.display_order).padStart(2, '0')}.
              </span>
            </p>
            <h1 className="gold-title">{state.course.title}</h1>
            {state.course.subtitle ? <p>{state.course.subtitle}</p> : null}
            {state.course.description ? <p>{state.course.description}</p> : null}
            <p className="muted">
              Giảng viên: <strong>{LEAD_INSTRUCTOR_NAME}</strong>
            </p>
            {(() => {
              const pillar = normalizePillar(state.course!.pillar, state.course!.slug);
              return pillar ? (
                <p>
                  <span className="pill">{PILLAR_LABELS[pillar]}</span>
                </p>
              ) : null;
            })()}
            <p className="muted">
              Học phí:{' '}
              {state.course.price_vnd === 0
                ? 'Miễn phí / Tùy tâm'
                : state.course.price_vnd.toLocaleString('vi-VN') + ' đ'}
            </p>
            <CourseOutcomes course={state.course} />
            <section
              id="dang-ky-khoa-hoc"
              className="card enrol-box"
              aria-labelledby="enrol-title"
            >
              <h2 id="enrol-title" className="gold-title">Đăng ký khóa học</h2>
              {detailState.status === 'success' && detailState.detail.enrolled ? (
                <p>
                  Bạn đã ghi danh khóa học này — toàn bộ bài học đã mở. Bấm vào bài học trong
                  chương trình bên dưới là học được ngay.
                </p>
              ) : (
                <p>
                  Đăng ký để mở toàn bộ bài học của khóa này. Các bài có nhãn “Xem trước” xem
                  được ngay không cần đăng ký.
                </p>
              )}
              <p>
                <ResumeButton courseSlug={state.course.slug} />{' '}
                <CheckoutButton course={state.course} />
              </p>
            </section>
            <CourseCurriculum
              courseSlug={state.course.slug}
              enrolled={
                detailState.status === 'success' ? detailState.detail.enrolled : null
              }
            />
          </article>
          <CourseProgressSection
            detailState={detailState}
            selectedLessonId={selectedLessonId}
            onSelectLesson={setSelectedLessonId}
            onProgressSaved={handleProgressSaved}
            onCompleted={() => void loadDetail()}
            onRetry={() => void loadDetail()}
          />
        </>
      )}
    </div>
  );
}

// "Ban se hoc duoc gi" + "Ket qua huong den" — chi hien du lieu THAT
// trong courses.details; hien tai ca 10 khoa deu chua co (mang rong)
// nen hien "Dang cap nhat." chu KHONG bia noi dung.
function stringItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function CourseOutcomes({ course }: { course: Course }) {
  const main = stringItems(course.details?.noi_dung_chinh);
  const outcomes = stringItems(course.details?.ket_qua_huong_den);
  return (
    <>
      <section aria-labelledby="course-learn-title">
        <h2 id="course-learn-title" className="gold-title">Bạn sẽ học được gì</h2>
        {main.length > 0 ? (
          <ul>
            {main.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Đang cập nhật.</p>
        )}
      </section>
      <section aria-labelledby="course-outcomes-title">
        <h2 id="course-outcomes-title" className="gold-title">Kết quả hướng đến</h2>
        {outcomes.length > 0 ? (
          <ul>
            {outcomes.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Đang cập nhật.</p>
        )}
      </section>
    </>
  );
}

// Tien do cua ban tren trang khoa hoc (Task 07 2/4) — % khoa, % tung
// module, bai dang hoc do (tiep tuc tu vi tri da luu) + LessonPlayer mo
// ngay tai trang. Trang bai hoc rieng (/hoc-vien/khoa-hoc/.../bai/...,
// phan khac cua Task 07 xay) co the dung lai LessonPlayer nay thay cho
// phan mo inline o day.
function CourseProgressSection({
  detailState,
  selectedLessonId,
  onSelectLesson,
  onProgressSaved,
  onCompleted,
  onRetry,
}: {
  detailState: ProgressDetailState | { status: 'loading' };
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string | null) => void;
  onProgressSaved: (row: LessonProgressRow) => void;
  onCompleted: (lessonId: string) => void;
  onRetry: () => void;
}) {
  if (detailState.status === 'loading') {
    return (
      <section aria-labelledby="my-progress-title" style={{ marginTop: '2rem' }}>
        <h2 id="my-progress-title" className="gold-title">Tiến độ của bạn</h2>
        <p role="status" aria-live="polite">
          Đang tải tiến độ…
        </p>
      </section>
    );
  }
  if (detailState.status === 'not-configured') return null;
  if (detailState.status === 'signed-out') {
    return (
      <section aria-labelledby="my-progress-title" style={{ marginTop: '2rem' }}>
        <h2 id="my-progress-title" className="gold-title">Tiến độ của bạn</h2>
        <p>
          <Link className="btn" href="/dang-nhap">
            Đăng nhập để xem tiến độ
          </Link>
        </p>
      </section>
    );
  }
  if (detailState.status === 'error') {
    return (
      <section aria-labelledby="my-progress-title" style={{ marginTop: '2rem' }}>
        <h2 id="my-progress-title" className="gold-title">Tiến độ của bạn</h2>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được tiến độ học.</strong>
          </p>
          <p>{detailState.message}</p>
          <p>
            <button type="button" className="btn" onClick={onRetry}>
              Thử lại
            </button>
          </p>
        </div>
      </section>
    );
  }

  const detail: CourseProgressDetail = detailState.detail;
  const allLessons: CourseLessonItem[] = detail.modules.flatMap((m) => m.lessons);
  const selected = allLessons.find((l) => l.id === selectedLessonId) ?? null;
  const selectedProgress = selected ? (detail.progressByLesson.get(selected.id) ?? null) : null;
  const resumeLessons = allLessons.filter((l) => {
    const p = detail.progressByLesson.get(l.id);
    return p !== undefined && !isProgressRowCompleted(p, l.type);
  });

  return (
    <section aria-labelledby="my-progress-title" style={{ marginTop: '2rem' }}>
      <h2 id="my-progress-title" className="gold-title">Tiến độ của bạn</h2>
      {!detail.enrolled && (
        <p className="muted">
          Bạn chưa ghi danh khóa học này — chỉ mở được bài xem trước.{' '}
          <Link href="/hoc-vien/khoa-hoc">Xem khóa học của tôi</Link>
        </p>
      )}
      <p>
        Đã học {detail.completedLessons}/{detail.totalLessons} bài — {detail.progressPercent}%
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={detail.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tiến độ ${detail.courseTitle}`}
      >
        <div className="progress-fill" style={{ width: `${detail.progressPercent}%` }} />
      </div>
      {detail.modules.length > 0 && (
        <ul className="module-list">
          {detail.modules.map((m) => (
            <li key={m.id}>
              {m.title}: {m.completedLessons}/{m.totalLessons} bài ({m.progressPercent}%)
            </li>
          ))}
        </ul>
      )}

      {resumeLessons.length > 0 && (
        <>
          <h3>Bài đang học dở</h3>
          <ul className="dashboard-list">
            {resumeLessons.map((l) => {
              const p = detail.progressByLesson.get(l.id);
              const pos = p?.video_position ?? p?.last_position_sec ?? 0;
              const canOpen = detail.enrolled || l.isFreePreview;
              return (
                <li key={l.id} className="list-row">
                  <p>
                    <strong>{l.title}</strong>{' '}
                    <span className="pill">{lessonTypeLabelVi(l.type)}</span>
                  </p>
                  <p className="muted">
                    {l.type === 'video' && pos > 0
                      ? `Tiếp tục từ ${formatPosition(pos)} — ${p?.progress_percent ?? 0}%`
                      : `Đang học — ${p?.progress_percent ?? 0}%`}
                  </p>
                  <p>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!canOpen}
                      onClick={() => onSelectLesson(l.id)}
                    >
                      {selectedLessonId === l.id ? 'Đang mở bài này' : 'Học bài'}
                    </button>
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selected && (
        <div style={{ marginTop: '1.5rem' }}>
          <SelectedLessonPlayer
            lesson={selected}
            courseId={detail.courseId}
            initialProgress={selectedProgress}
            onProgressSaved={onProgressSaved}
            onCompleted={onCompleted}
            onClose={() => onSelectLesson(null)}
          />
        </div>
      )}
    </section>
  );
}

// Player mo inline 1 bai tren trang khoa hoc.
// S-03: getCourseProgressDetail chi tra metadata (view
// lessons_public — khong co content / videoUrl / fileUrl). Noi dung
// that lay rieng qua GET /api/lms/lessons/[lessonId] co kiem tra
// quyen; chua duoc phep (chi preview / chua ghi danh) thi player
// nhan null va hien empty state nhu LessonPlayer von co.
function SelectedLessonPlayer({
  lesson,
  courseId,
  initialProgress,
  onProgressSaved,
  onCompleted,
  onClose,
}: {
  lesson: CourseLessonItem;
  courseId: string;
  initialProgress: LessonProgressRow | null;
  onProgressSaved: (progress: LessonProgressRow) => void;
  onCompleted: (lessonId: string) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState<LessonContentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setLoading(true);
    void fetchLessonContentViaApi(lesson.id)
      .then((c) => {
        if (!cancelled) {
          setContent(c);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id]);
  if (loading) return <p role="status">Đang tải nội dung bài học…</p>;
  return (
    <>
      <LessonPlayer
        key={lesson.id}
        lesson={
          {
            id: lesson.id,
            courseId,
            title: lesson.title,
            type: lesson.type,
            videoUrl: content?.videoUrl ?? null,
            videoDurationSec: lesson.videoDurationSec,
            fileUrl: content?.fileUrl ?? null,
            content: content?.content ?? null,
            isFreePreview: lesson.isFreePreview,
          } satisfies PlayerLesson
        }
        initialProgress={initialProgress}
        onProgressSaved={onProgressSaved}
        onCompleted={onCompleted}
      />
      <p>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Đóng bài học
        </button>
      </p>
    </>
  );
}
