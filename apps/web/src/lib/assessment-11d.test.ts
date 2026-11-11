// Test cho lib danh gia 11D — tinh diem, xep hang, map khoa hoc, radar,
// khong mock Supabase (chi test logic thuan).
import { describe, expect, it } from 'vitest';
import {
  DIMENSIONS,
  DIMENSION_COURSES,
  QUESTIONS,
  buildRoadmap,
  computeScores,
  isComplete,
  radarPoints,
  rankDimensions,
  scoreBand,
  strongestDimensions,
  suggestedCourses,
  weakestDimensions,
} from './assessment-11d';
import { HOME_COURSES } from './homepage-data';

const ALL_FIVES: Record<string, number> = Object.fromEntries(QUESTIONS.map((q) => [q.id, 5]));
const MIXED: Record<string, number> = {};
for (const q of QUESTIONS) {
  // Tam thuc 5, tam thai 4, tam dao 3, tri tue 2, nghi luc 1, con lai 3.
  const byDim: Record<string, number> = {
    'tam-thuc': 5,
    'tam-thai': 4,
    'tam-dao': 3,
    'tri-tue': 2,
    'nghi-luc': 1,
  };
  MIXED[q.id] = byDim[q.dimensionKey] ?? 3;
}

describe('11 phuong dien — thu tu/tên da chot', () => {
  it('du 11 phuong dien, dung thu tu', () => {
    expect(DIMENSIONS.map((d) => d.name)).toEqual([
      'Tâm thức', 'Tâm thái', 'Tâm đạo', 'Trí tuệ', 'Nghị lực', 'Thể chất',
      'Tinh thần', 'Phẩm chất', 'Nhân cách', 'Năng lực', 'Vật chất',
    ]);
    expect(DIMENSIONS.map((d) => d.num)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11',
    ]);
  });

  it('moi phuong dien dung 3 cau, tong 33 cau, id duy nhat', () => {
    expect(QUESTIONS).toHaveLength(33);
    for (const d of DIMENSIONS) {
      expect(QUESTIONS.filter((q) => q.dimensionKey === d.key)).toHaveLength(3);
    }
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(33);
  });

  it('moi cau co giai thich ngan, khong rong', () => {
    for (const q of QUESTIONS) {
      expect(q.text.trim().length).toBeGreaterThan(10);
      expect(q.hint.trim().length).toBeGreaterThan(5);
    }
  });
});

describe('tinh diem', () => {
  it('toan 5 -> moi phuong dien 5, tong 5', () => {
    const { scores, overall } = computeScores(ALL_FIVES);
    expect(Object.keys(scores)).toHaveLength(11);
    expect(overall).toBe(5);
    expect(isComplete(ALL_FIVES)).toBe(true);
  });

  it('hon hop -> dung diem tung phuong dien va tong', () => {
    const { scores, overall } = computeScores(MIXED);
    expect(scores['tam-thuc']).toBe(5);
    expect(scores['tam-thai']).toBe(4);
    expect(scores['tam-dao']).toBe(3);
    expect(scores['tri-tue']).toBe(2);
    expect(scores['nghi-luc']).toBe(1);
    // (5+4+3+2+1+3*6)/11 = 33/11 = 3
    expect(overall).toBe(3);
  });

  it('thieu cau -> phuong dien do khong co diem, tong null', () => {
    const partial = { ...ALL_FIVES };
    delete partial['tam-thuc-1'];
    const { scores, overall } = computeScores(partial);
    expect(scores['tam-thuc']).toBeUndefined();
    expect(overall).toBeNull();
    expect(isComplete(partial)).toBe(false);
  });

  it('gia tri ngoai 1–5 bi bo qua', () => {
    const bad = { ...ALL_FIVES, 'tam-thuc-1': 9, 'tam-thuc-2': 0 };
    const { scores } = computeScores(bad);
    expect(scores['tam-thuc']).toBeUndefined();
  });

  it('nhan diem trung lap, khong dung tu phan xet', () => {
    expect(scoreBand(4.5)).toBe('Đang vững');
    expect(scoreBand(3)).toBe('Đang phát triển');
    expect(scoreBand(2.9)).toBe('Cần chăm sóc thêm');
  });
});

describe('manh / yeu / lo trinh', () => {
  it('3 manh nhat va 3 can cai thien nhat', () => {
    const { scores } = computeScores(MIXED);
    expect(strongestDimensions(scores).map((r) => r.dimension.key)).toEqual([
      'tam-thuc', 'tam-thai', 'tam-dao',
    ]);
    // 3 thap nhat: nghi-luc 1, tri-tue 2, roi 1 trong cac phuong dien
    // dong 3 diem (sap xep on dinh -> vat-chat, phuong dien 3 diem cuoi
    // cung theo thu tu da chot).
    expect(weakestDimensions(scores).map((r) => r.dimension.key)).toEqual([
      'nghi-luc', 'tri-tue', 'vat-chat',
    ]);
    expect(rankDimensions(scores)).toHaveLength(11);
  });

  it('lo trinh co 3 buoc tu 3 phuong dien thap nhat, moi buoc co muc tieu + khoa', () => {
    const { scores } = computeScores(MIXED);
    const { steps, keepStrong } = buildRoadmap(scores);
    expect(steps).toHaveLength(3);
    expect(steps[0].dimension.key).toBe('nghi-luc');
    for (const s of steps) {
      expect(s.goal.length).toBeGreaterThan(5);
      expect(s.courses.length).toBeGreaterThanOrEqual(1);
    }
    expect(keepStrong).toHaveLength(3);
  });
});

describe('map khoa hoc that', () => {
  it('moi phuong dien map vao slug khoa co that trong 10 khoa', () => {
    const slugs = new Set(HOME_COURSES.map((c) => c.slug));
    expect(HOME_COURSES).toHaveLength(10);
    for (const d of DIMENSIONS) {
      const courses = suggestedCourses(d.key);
      expect(courses.length).toBeGreaterThanOrEqual(1);
      for (const c of courses) expect(slugs.has(c.slug)).toBe(true);
    }
    // Map dung vi du da chot: Tam thuc -> 01/02, Tri tue -> 03,
    // The chat -> 04, Vat chat -> 06 Tai chinh.
    expect(DIMENSION_COURSES['tam-thuc']).toContain('thau-hieu-tam-thuc');
    expect(DIMENSION_COURSES['tam-thuc']).toContain('thau-hieu-noi-tam');
    expect(DIMENSION_COURSES['tri-tue']).toEqual(['thau-hieu-tri-tue']);
    expect(DIMENSION_COURSES['the-chat']).toEqual(['thau-hieu-suc-khoe']);
    expect(DIMENSION_COURSES['vat-chat']).toContain('thau-hieu-tai-chinh');
    expect(DIMENSION_COURSES['nhan-cach']).toContain('thau-hieu-moi-quan-he');
  });
});

describe('radar SVG', () => {
  it('11 diem, nam trong khung, diem 5 xa tam hon diem 1', () => {
    const { scores } = computeScores(ALL_FIVES);
    const pts = radarPoints(scores, 340, 120);
    expect(pts).toHaveLength(11);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(340);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(340);
    }
    const ones = radarPoints(
      Object.fromEntries(DIMENSIONS.map((d) => [d.key, 1])),
      340,
      120,
    );
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x - 170, p.y - 170);
    expect(dist(pts[0])).toBeGreaterThan(dist(ones[0]));
    expect(dist(pts[0])).toBeCloseTo(120, 0);
    expect(dist(ones[0])).toBeCloseTo(24, 0);
  });
});
