import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  courseJsonLd,
  courseListJsonLd,
  faqJsonLd,
  publicPageMetadata,
} from './seo';

describe('publicPageMetadata', () => {
  it('dat canonical + OG + Twitter theo path that', () => {
    const m = publicPageMetadata({
      title: 'Các khóa học',
      description: 'Muoi chuong trinh.',
      path: '/chuong-trinh',
    });
    expect(m.alternates).toEqual({ canonical: '/chuong-trinh' });
    expect(m.openGraph?.url).toBe('https://visfaracademy.pages.dev/chuong-trinh');
    expect(m.title).toContain('Các khóa học');
    expect(m.openGraph?.siteName).toBe('Visfar Academy');
  });
});

describe('courseJsonLd', () => {
  it('Course co du truong, KHONG co offers (gia Tuy tam chua chot)', () => {
    const j = courseJsonLd({
      slug: 'thau-hieu-noi-tam',
      title: 'Thấu Hiểu Nội Tâm',
      description: 'Hiểu bản thân.',
    });
    expect(j['@type']).toBe('Course');
    expect(j.url).toBe('https://visfaracademy.pages.dev/chuong-trinh/thau-hieu-noi-tam');
    expect(j.provider.name).toBe('Visfar Academy');
    expect('offers' in j).toBe(false);
  });
  it('ItemList du 10 khoa that, dung thu tu HOME_COURSES', () => {
    const j = courseListJsonLd();
    expect(j.itemListElement).toHaveLength(10);
    expect(j.itemListElement[0].item.url).toContain('thau-hieu-noi-tam');
    expect(j.itemListElement[9].item.url).toContain('cong-dong-visfar');
    expect(j.itemListElement.map((e) => e.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('breadcrumbJsonLd', () => {
  it('vi tri 1..n, muc cuoi khong co item', () => {
    const j = breadcrumbJsonLd([
      { name: 'Trang chủ', path: '/' },
      { name: 'Các khóa học', path: '/chuong-trinh' },
      { name: 'Thấu Hiểu Nội Tâm' },
    ]);
    expect(j.itemListElement).toHaveLength(3);
    expect(j.itemListElement[2].item).toBeUndefined();
    expect(j.itemListElement[0].item).toBe('https://visfaracademy.pages.dev/');
  });
});

describe('faqJsonLd', () => {
  it('FAQPage lay dung 9 cau that tren trang chu', () => {
    const j = faqJsonLd();
    expect(j['@type']).toBe('FAQPage');
    expect(j.mainEntity).toHaveLength(9);
    expect(j.mainEntity[0]['@type']).toBe('Question');
  });
});
