// Validation dung chung — logic nay se duoc dung lai o Module 2 (Lead)
// ca o client lan server (Workers). Dong bo 2 ben, khong lech nhau
// nhu loi lech email client/server o trang cu.
import { PROVINCES } from '@visfar/shared';

/** Bo dau tieng Viet, đ→d, ve chu thuong — dung cho tim kiem (giong trang cu). */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** SDT: 10 chu so, bat dau bang 0. Khong chap nhan +84 o Module 1. */
export function validatePhone(phone: string): boolean {
  return /^0\d{9}$/.test(phone.trim());
}

/** Email: TLD toi thieu 2 ky tu — DONG BO client/server (§7.5). */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validateFullName(name: string): boolean {
  const v = name.trim();
  return v.length >= 2 && v.length <= 100;
}

export function validateProvince(province: string): boolean {
  return (PROVINCES as readonly string[]).includes(province);
}

/** Ma tham chieu lead: VISFAR-YYYY-NNNNNN (VD VISFAR-2026-000123). */
export function formatReferenceCode(prefix: string, year: number, seq: number): string {
  if (!/^[A-Z]+$/.test(prefix)) throw new Error('prefix phai la chu hoa A-Z');
  if (!Number.isInteger(seq) || seq < 1) throw new Error('seq phai la so nguyen >= 1');
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

export function formatOrderCode(year: number, seq: number): string {
  return formatReferenceCode('DH', year, seq);
}
