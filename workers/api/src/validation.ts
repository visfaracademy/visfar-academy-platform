// Validation server — CUNG bo quy tac voi client (apps/web/src/lib/validation.ts
// + API_ARCHITECTURE.md §6). Khong tin validation o client.
import { PROVINCES } from './provinces';

export const PHONE_RE = /^0\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validatePhone(phone: unknown): boolean {
  return typeof phone === 'string' && PHONE_RE.test(phone.trim());
}

export function validateEmail(email: unknown): boolean {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

export function validateFullName(name: unknown): boolean {
  if (typeof name !== 'string') return false;
  const v = name.trim();
  return v.length >= 2 && v.length <= 100 && !CONTROL_CHARS_RE.test(v);
}

export function validateProvince(province: unknown): boolean {
  return typeof province === 'string' && (PROVINCES as readonly string[]).includes(province);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Ma tham chieu lead: VISFAR-YYYY-NNNNNN (VD VISFAR-2026-000123). */
export function formatReferenceCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

/** Sinh ma tham chieu ngau nhien 6 so; insert se thu lai khi trung UNIQUE. */
export function generateReferenceCode(now = new Date()): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const seq = (buf[0] as number) % 900000 + 100000;
  return formatReferenceCode('VISFAR', now.getUTCFullYear(), seq);
}

/** Lay field chap nhan ca camelCase (frontend gui) va snake_case (phong thu). */
export function pickField(
  body: Record<string, unknown>,
  camel: string,
  snake: string,
): unknown {
  const c = body[camel];
  return c !== undefined ? c : body[snake];
}

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
