// Visfar Academy — shared constants (dung chung frontend + Workers sau nay)
// 34 tinh/thanh pho hien hanh (sau sap nhap), theo thu tu ABC —
// giong danh sach <select> tren trang hien tai. Khong tu them/bot.
export const PROVINCES: readonly string[] = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng',
  'Đắk Lắk', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Nội',
  'Hà Tĩnh', 'Hải Phòng', 'Huế', 'Hưng Yên', 'Khánh Hòa', 'Lai Châu',
  'Lâm Đồng', 'Lào Cai', 'Lạng Sơn', 'Nghệ An', 'Ninh Bình', 'Phú Thọ',
  'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh',
  'Thái Nguyên', 'Thanh Hóa', 'TP. Hồ Chí Minh', 'Tuyên Quang', 'Vĩnh Long',
] as const;

// 3 tru cot: Than – Tam – Tue (quyet dinh 11/11/2026, thay cho bo cu
// Tam thuc – Tri tue – Nhan hieu). 'tich-hop' = khoa tich hop ca 3 tru
// cot (chuong trinh trong tam/chuyen sau); 'cong-dong' khong phai tru
// cot ma la moi truong hoc tap. Tab loc tren /chuong-trinh chi hien
// 3 tru cot + Cong dong; khoa tich-hop van hien duoi ca 3 tab tru cot
// (xem filterCourses trong apps/web/src/lib/courses.ts).
export const PILLARS = [
  { value: 'than', label: 'Thân' },
  { value: 'tam', label: 'Tâm' },
  { value: 'tue', label: 'Tuệ' },
  { value: 'tich-hop', label: 'Tích hợp' },
  { value: 'cong-dong', label: 'Cộng đồng' },
] as const;

export type Pillar = (typeof PILLARS)[number]['value'];

export const PILLAR_LABELS: Record<Pillar, string> = {
  'than': 'Thân',
  'tam': 'Tâm',
  'tue': 'Tuệ',
  'tich-hop': 'Tích hợp',
  'cong-dong': 'Cộng đồng',
};

// Tuong thich TAM THOI voi du lieu cu trong DB (pillar 'tam-thuc' /
// 'tri-tue' / 'nhan-hieu') truoc khi migration 0024 doi CHECK +
// du lieu sang bo moi. Hai khoa suc khoe / tai chinh phai map theo
// slug vi gia tri cu 'tam-thuc' khong phan biet duoc (04/06 thuoc
// Than, 01/02/05 thuoc Tam). XOA ham nay + LEGACY_PILLAR_BY_SLUG
// sau khi 0024 da ap len staging + prod.
export const LEGACY_PILLAR_BY_SLUG: Record<string, Pillar> = {
  'thau-hieu-suc-khoe': 'than',
  'thau-hieu-tai-chinh': 'than',
  'chuyen-gia-tu-van': 'tich-hop',
};

export function normalizePillar(pillar: string | null, slug?: string): Pillar | null {
  if (!pillar) return null;
  if (slug && LEGACY_PILLAR_BY_SLUG[slug]) return LEGACY_PILLAR_BY_SLUG[slug];
  if (pillar === 'tam-thuc') return 'tam';
  if (pillar === 'tri-tue') return 'tue';
  if (pillar === 'nhan-hieu') return 'tich-hop';
  if (PILLARS.some((p) => p.value === pillar)) return pillar as Pillar;
  return null;
}

export const ROLES = ['student', 'instructor', 'admin'] as const;
export type Role = (typeof ROLES)[number];
