// Kiem chung du lieu trang chu (nguyen van tu file HTML goc):
// du 10 khoa hoc / 8 testimonial / 9 FAQ / 3 su kien dung ngay da chot,
// tab loc co so dem khop data-cat goc, 4 bai chinh sach du slug.
import { describe, expect, it } from 'vitest';
import {
  COURSE_TABS,
  FAQS,
  HOME_COURSES,
  HOME_EVENTS,
  TESTIMONIALS,
} from './homepage-data';
import { POLICIES } from './policies';

describe('homepage data (goc HTML)', () => {
  it('du 10 khoa hoc, thu tu 01-10, moi khoa co poster + chi tiet', () => {
    expect(HOME_COURSES).toHaveLength(10);
    expect(HOME_COURSES.map((c) => c.num)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    ]);
    for (const c of HOME_COURSES) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.content.length).toBeGreaterThanOrEqual(3);
      expect(c.outcome.length).toBeGreaterThan(0);
      expect(c.cats.length).toBeGreaterThanOrEqual(1);
    }
    expect(HOME_COURSES[6].featured).toBe(true);
    // 04/05/06 khong con noi dung tam (Quyet dinh 10 da chap nhan van ban).
    expect(HOME_COURSES.filter((c) => c.temp)).toEqual([]);
    // Nhãn trụ cột theo 3 trụ cột Thân – Tâm – Tuệ (11/11/2026).
    expect(HOME_COURSES.map((c) => [c.num, c.cats])).toEqual([
      ['01', ['tam']],
      ['02', ['tam']],
      ['03', ['tue']],
      ['04', ['than']],
      ['05', ['tam']],
      ['06', ['than']],
      ['07', ['than', 'tam', 'tue']],
      ['08', ['than', 'tam', 'tue']],
      ['09', ['than', 'tam', 'tue']],
      ['10', ['cong-dong']],
    ]);
  });

  it('so dem tab loc khop 3 tru cot Than – Tam – Tue: Tat ca 10 / Than 5 / Tam 6 / Tue 4 / Cong dong 1', () => {
    const count = (cat: string) =>
      cat === 'all'
        ? HOME_COURSES.length
        : HOME_COURSES.filter((c) => c.cats.includes(cat)).length;
    expect(COURSE_TABS.map((t) => [t.value, count(t.value)])).toEqual([
      ['all', 10],
      ['than', 5],
      ['tam', 6],
      ['tue', 4],
      ['cong-dong', 1],
    ]);
  });

  it('du 8 testimonial dung nguoi da xac nhan, moi nguoi co anh', () => {
    expect(TESTIMONIALS).toHaveLength(8);
    expect(TESTIMONIALS.map((t) => t.name)).toEqual([
      'Trần Thị Thu Hằng',
      'Lê Hoàng Nam',
      'Nguyễn Minh Khoa',
      'Đỗ Bảo Anh',
      'Võ Đức Huy',
      'Phạm Thanh Trúc',
      'Lương Khánh Vy',
      'Nguyễn Hoàng Ánh',
    ]);
    for (const t of TESTIMONIALS) {
      expect(t.quote.length).toBeGreaterThan(20);
      expect(t.img).toMatch(/^\/images\/testimonial-/);
    }
  });

  it('du 9 FAQ', () => {
    expect(FAQS).toHaveLength(9);
  });

  it('ca 3 su kien dung ngay 25/11/2026, 18:30, Zoom (quyet dinh da chot)', () => {
    expect(HOME_EVENTS).toHaveLength(3);
    for (const e of HOME_EVENTS) {
      expect(e.date).toBe('25/11/2026 · 18:30');
      expect(e.meta).toMatch(/^Zoom · /);
    }
  });

  it('du 4 bai chinh sach, dung slug route /chinh-sach/*', () => {
    expect(POLICIES.map((p) => p.slug)).toEqual([
      'bao-mat',
      'dieu-khoan-tham-gia',
      'hoan-tra-huy-dang-ky',
      'giai-quyet-khieu-nai',
    ]);
    for (const p of POLICIES) {
      expect(p.blocks.length).toBeGreaterThan(10);
      expect(p.meta).toContain('04 tháng 11 năm 2026');
    }
  });
});
