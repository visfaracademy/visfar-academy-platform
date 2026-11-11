// Chuong trinh hoc (Course -> Module -> Lesson) tren trang chi tiet khoa.
// Doc THAT tu Supabase qua fetchCourseStructure — khong co module/bai
// thi hien empty state, khong ve noi dung gia.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchCourseStructure,
  formatDuration,
  formatTotalDuration,
  lessonTypeLabelVi,
  lessonUrl,
  type CourseStructure,
} from '@/lib/learning';

type State =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'success'; structure: CourseStructure | null }
  | { status: 'error'; message: string };

// Trang chi tiet khoa hien DAY DU chuong trinh cho moi nguoi, khong
// can dang ky / dang nhap (chi doc metadata tu view lessons_public —
// khong co content / video_url / file_url, xem S-03).
//   - enrolled === true: moi bai deu mo — bam vao la hoc.
//   - enrolled === false: bai xem truoc mo, bai tra phi hien O KHOA
//     (icon 🔒 + nhan "Đã khóa"); bam vao bai khoa se cuon toi khoi
//     dang ky (#dang-ky-khoa-hoc) de dang ky/mua dung khoa do.
//   - enrolled === null (chua biet trang thai ghi danh, dang tai):
//     khong ve o khoa, giu link bai nhu cu — trang bai hoc tu chan
//     quyen (locked state) nen khong lo noi dung.
// Noi dung bai that chi lay qua API guard /api/lms/lessons/[id] khi
// mo bai; danh sach o day khong bao gio mang video_url/content.
export default function CourseCurriculum({
  courseSlug,
  enrolled = null,
}: {
  courseSlug: string;
  enrolled?: boolean | null;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await fetchCourseStructure(courseSlug);
    if (res.status === 'error') setState({ status: 'error', message: res.message });
    else if (res.status === 'not-configured') setState({ status: 'not-configured' });
    else if (res.status === 'signed-out') setState({ status: 'success', structure: null });
    else setState({ status: 'success', structure: res.data });
  }, [courseSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-labelledby="curriculum-title" className="curriculum">
      <h2 id="curriculum-title" className="gold-title">Chương trình học</h2>
      {state.status === 'loading' && <p role="status">Đang tải chương trình học…</p>}
      {state.status === 'not-configured' && (
        <div className="notice" role="status">
          <p>Chưa cấu hình Supabase nên chưa tải được chương trình học.</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được chương trình học.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}
      {state.status === 'success' &&
        (state.structure === null || state.structure.totalLessons === 0) && (
          <div className="notice" role="status">
            <p>Khóa học chưa có nội dung. Vui lòng quay lại sau.</p>
          </div>
        )}
      {state.status === 'success' && state.structure !== null && state.structure.totalLessons > 0 && (
        <>
          <p className="muted">
            {state.structure.modules.length} module · {state.structure.totalLessons} bài học
            {(() => {
              const totalSec = state.structure!.modules
                .flatMap((m) => m.lessons)
                .reduce((s, l) => s + (l.videoDurationSec ?? 0), 0);
              const total = formatTotalDuration(totalSec);
              return total ? ` · Tổng thời lượng video ${total}` : '';
            })()}
          </p>
          {enrolled === false && (
            <p className="muted">
              🔒 Các bài có biểu tượng ổ khóa dành cho học viên đã ghi danh. Đăng ký khóa học để
              mở toàn bộ bài học — các bài có nhãn “Xem trước” xem được ngay không cần đăng ký.
            </p>
          )}
          <div className="curriculum-list">
            {state.structure.modules.map((m, mi) => (
              <details key={m.id} open={mi === 0} className="card curriculum-module">
                <summary>
                  <strong>
                    Module {mi + 1}: {m.title}
                  </strong>{' '}
                  <span className="muted">
                    ({m.lessons.length} bài
                    {(() => {
                      const total = formatTotalDuration(
                        m.lessons.reduce((s, l) => s + (l.videoDurationSec ?? 0), 0),
                      );
                      return total ? ` · ${total}` : '';
                    })()}
                    )
                  </span>
                </summary>
                {m.description ? <p className="muted">{m.description}</p> : null}
                <ul className="lesson-list">
                  {m.lessons.map((l) => {
                    const isLocked = enrolled === false && !l.isFreePreview;
                    return (
                      <li key={l.id} className={`lesson-row${isLocked ? ' lesson-locked' : ''}`}>
                        {isLocked ? (
                          <a
                            href="#dang-ky-khoa-hoc"
                            className="lesson-locked-link"
                            aria-label={`${l.title} — bài học đã khóa, đăng ký khóa học để mở`}
                          >
                            <span aria-hidden="true">🔒</span> {l.title}
                          </a>
                        ) : (
                          <Link href={lessonUrl(state.structure!.course.slug, l.slug, m.slug)}>
                            {l.title}
                          </Link>
                        )}
                        <span className="lesson-meta">
                          <span className="pill">{lessonTypeLabelVi(l.type)}</span>
                          {l.videoDurationSec ? (
                            <span className="muted">{formatDuration(l.videoDurationSec)}</span>
                          ) : null}
                          {l.isFreePreview ? <span className="pill">Xem trước</span> : null}
                          {isLocked ? <span className="pill pill-locked">Đã khóa</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {m.lessons.length === 0 && <p className="muted">Module chưa có bài học.</p>}
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
