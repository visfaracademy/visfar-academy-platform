import Link from 'next/link';
import type { Course } from '@visfar/shared';
import { PILLAR_LABELS, normalizePillar } from '@visfar/shared';
import { LEAD_INSTRUCTOR_NAME } from '@/lib/courses';

export default function CourseCard({ course }: { course: Course }) {
  const isTemp = Boolean(course.details?.noi_dung_tam);
  const pillar = normalizePillar(course.pillar, course.slug);
  return (
    <article className="card">
      <p>
        <span className="course-num">{String(course.display_order).padStart(2, '0')}.</span>{' '}
        {pillar ? <span className="pill">{PILLAR_LABELS[pillar]}</span> : null}
        {course.is_featured ? <span className="pill"> Chương trình trọng tâm</span> : null}
      </p>
      <h3>
        <Link href={`/chuong-trinh/${course.slug}`}>{course.title}</Link>
      </h3>
      {course.subtitle ? <p className="muted">{course.subtitle}</p> : null}
      {course.description ? <p>{course.description}</p> : null}
      <p className="muted">
        Giảng viên: <strong>{LEAD_INSTRUCTOR_NAME}</strong>
      </p>
      {isTemp ? (
        <p className="muted">Nội dung tạm — chờ văn bản của người sáng lập để thay.</p>
      ) : null}
      <p className="card-actions">
        <Link className="btn btn-ghost" href={`/chuong-trinh/${course.slug}`}>
          Xem chi tiết khóa học
        </Link>
      </p>
    </article>
  );
}
