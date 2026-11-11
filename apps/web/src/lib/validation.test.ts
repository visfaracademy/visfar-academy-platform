import { describe, expect, it } from 'vitest';
import {
  formatOrderCode,
  formatReferenceCode,
  normalizeSearch,
  validateEmail,
  validateFullName,
  validatePhone,
  validateProvince,
} from './validation';

describe('normalizeSearch — bo dau tieng Viet, đ→d', () => {
  it('bo dau va ve chu thuong', () => {
    expect(normalizeSearch('Thấu Hiểu Nội Tâm')).toBe('thau hieu noi tam');
  });
  it('đ→d, Đ→D', () => {
    expect(normalizeSearch('Đào tạo')).toBe('dao tao');
    expect(normalizeSearch('đồng hành')).toBe('dong hanh');
  });
  it('giữ số và khoảng trắng đã trim', () => {
    expect(normalizeSearch('  Coaching 90 ngày  ')).toBe('coaching 90 ngay');
  });
  it('chuỗi rỗng', () => {
    expect(normalizeSearch('')).toBe('');
  });
});

describe('validatePhone — 10 so, bat dau bang 0', () => {
  it('hop le: 0901234567', () => expect(validatePhone('0901234567')).toBe(true));
  it('hop le: 0347897868', () => expect(validatePhone('0347897868')).toBe(true));
  it('khong hop le: +84 (chua ho tro o Module 1)', () =>
    expect(validatePhone('+84901234567')).toBe(false));
  it('khong hop le: 9 so', () => expect(validatePhone('090123456')).toBe(false));
  it('khong hop le: 11 so', () => expect(validatePhone('09012345678')).toBe(false));
  it('khong hop le: khong bat dau bang 0', () =>
    expect(validatePhone('1901234567')).toBe(false));
  it('khong hop le: chua chu cai', () => expect(validatePhone('090123456a')).toBe(false));
  it('khong hop le: rong', () => expect(validatePhone('')).toBe(false));
});

describe('validateEmail — TLD toi thieu 2 ky tu (dong bo client/server)', () => {
  it('hop le', () => expect(validateEmail('a@example.com')).toBe(true));
  it('hop le: subdomain', () => expect(validateEmail('nguyen.van@visfar.vn')).toBe(true));
  it('khong hop le: TLD 1 ky tu (a@b.c) — client cu cho qua, server tu choi', () =>
    expect(validateEmail('a@b.c')).toBe(false));
  it('khong hop le: thieu @', () => expect(validateEmail('abc.com')).toBe(false));
  it('khong hop le: thieu domain', () => expect(validateEmail('a@')).toBe(false));
  it('khong hop le: co khoang trang', () => expect(validateEmail('a b@c.com')).toBe(false));
});

describe('validateFullName', () => {
  it('hop le', () => expect(validateFullName('Nguyễn Văn A')).toBe(true));
  it('khong hop le: 1 ky tu', () => expect(validateFullName('A')).toBe(false));
  it('khong hop le: rong / chi khoang trang', () => expect(validateFullName('   ')).toBe(false));
  it('khong hop le: qua 100 ky tu', () => expect(validateFullName('A'.repeat(101))).toBe(false));
});

describe('validateProvince — 1 trong 34 tinh/thanh', () => {
  it('hop le: Hà Nội, TP. Hồ Chí Minh', () => {
    expect(validateProvince('Hà Nội')).toBe(true);
    expect(validateProvince('TP. Hồ Chí Minh')).toBe(true);
  });
  it('khong hop le: tinh cu da sap nhap (VD: Bình Dương)', () =>
    expect(validateProvince('Bình Dương')).toBe(false));
  it('khong hop le: chuoi tuy y', () => expect(validateProvince('Narnia')).toBe(false));
});

describe('formatReferenceCode / formatOrderCode', () => {
  it('VISFAR-2026-000123', () =>
    expect(formatReferenceCode('VISFAR', 2026, 123)).toBe('VISFAR-2026-000123'));
  it('DH-2026-000001', () => expect(formatOrderCode(2026, 1)).toBe('DH-2026-000001'));
  it('pad du 6 chu so', () => expect(formatReferenceCode('VISFAR', 2026, 1234567)).toBe('VISFAR-2026-1234567'));
  it('prefix phai chu hoa A-Z', () =>
    expect(() => formatReferenceCode('visfar', 2026, 1)).toThrow());
  it('seq phai >= 1', () => expect(() => formatReferenceCode('VISFAR', 2026, 0)).toThrow());
});
