import { describe, expect, it } from 'vitest';
import type { Course } from '@visfar/shared';
import { filterCourses, LEAD_INSTRUCTOR_NAME } from './courses';

function course(over: Partial<Course>): Course {
  return {
    id: over.id ?? 'x',
    slug: over.slug ?? 'x',
    display_order: over.display_order ?? 1,
    title: over.title ?? '',
    subtitle: over.subtitle ?? null,
    description: over.description ?? null,
    details: null,
    pillar: over.pillar ?? 'tam',
    poster_url: null,
    price_vnd: 0,
    is_featured: false,
    status: 'published',
    created_at: '',
    updated_at: '',
  };
}

const COURSES = [
  course({ id: '1', slug: 'thau-hieu-noi-tam', title: 'Thấu Hiểu Nội Tâm' }),
  course({ id: '2', slug: 'thau-hieu-tri-tue', title: 'Thấu Hiểu Trí Tuệ', pillar: 'tue' }),
  course({ id: '3', slug: 'coaching-90-ngay', title: 'Coaching 90 ngày đồng hành', pillar: 'tich-hop' }),
];

describe('filterCourses', () => {
  it('khong loc: tra ve tat ca', () => {
    expect(filterCourses(COURSES, '', 'all')).toHaveLength(3);
  });
  it('loc theo pillar', () => {
    expect(filterCourses(COURSES, '', 'tue').map((c) => c.slug)).toEqual([
      'thau-hieu-tri-tue',
      'coaching-90-ngay',
    ]);
  });
  it('khoa tich-hop hien duoi ca 3 tab tru cot Than–Tam–Tue', () => {
    expect(filterCourses(COURSES, '', 'than').map((c) => c.slug)).toEqual([
      'coaching-90-ngay',
    ]);
    expect(filterCourses(COURSES, '', 'tam').map((c) => c.slug)).toEqual([
      'thau-hieu-noi-tam',
      'coaching-90-ngay',
    ]);
    expect(filterCourses(COURSES, '', 'cong-dong')).toHaveLength(0);
  });
  it('tuong thich du lieu cu: tam-thuc -> Tam, nhan-hieu -> Tich hop, suc khoe/tai chinh -> Than (xoa sau migration 0024)', () => {
    const legacy = [
      course({ id: '9', slug: 'thau-hieu-suc-khoe', title: 'Thấu Hiểu Sức Khỏe', pillar: 'tam-thuc' as never }),
      course({ id: '10', slug: 'master-tam-thuc-nhan-hieu', title: 'Master', pillar: 'nhan-hieu' as never }),
      course({ id: '11', slug: 'chuyen-gia-tu-van', title: 'Chuyên gia tư vấn', pillar: 'tam-thuc' as never }),
    ];
    expect(filterCourses(legacy, '', 'than').map((c) => c.slug)).toEqual(['thau-hieu-suc-khoe', 'master-tam-thuc-nhan-hieu', 'chuyen-gia-tu-van']);
    expect(filterCourses(legacy, '', 'tam').map((c) => c.slug)).toEqual(['master-tam-thuc-nhan-hieu', 'chuyen-gia-tu-van']);
    expect(filterCourses(legacy, '', 'tue').map((c) => c.slug)).toEqual(['master-tam-thuc-nhan-hieu', 'chuyen-gia-tu-van']);
  });
  it('tim khong dau: "thau hieu" tim duoc ca 2 khoa co dau', () => {
    expect(filterCourses(COURSES, 'thau hieu', 'all')).toHaveLength(2);
  });
  it('tim co dau van duoc', () => {
    expect(filterCourses(COURSES, 'Trí Tuệ', 'all').map((c) => c.slug)).toEqual([
      'thau-hieu-tri-tue',
    ]);
  });
  it('tim "90" ra coaching', () => {
    expect(filterCourses(COURSES, '90', 'all').map((c) => c.slug)).toEqual([
      'coaching-90-ngay',
    ]);
  });
  it('khong co ket qua', () => {
    expect(filterCourses(COURSES, 'xyz', 'all')).toHaveLength(0);
  });
  it('ket hop pillar + query', () => {
    expect(filterCourses(COURSES, 'thau hieu', 'tue')).toHaveLength(1);
    expect(filterCourses(COURSES, 'thau hieu', 'cong-dong')).toHaveLength(0);
  });
});

describe('LEAD_INSTRUCTOR_NAME (QĐ 37)', () => {
  it('giảng viên tất cả khóa học là Lê Đăng Quyết', () => {
    expect(LEAD_INSTRUCTOR_NAME).toBe('Lê Đăng Quyết');
  });
  it('không còn tên bịa Ngô Mạnh Cường', () => {
    expect(LEAD_INSTRUCTOR_NAME).not.toContain('Ngô Mạnh Cường');
  });
});
