// Session guard — Task 06 (b) + (d). Test ham thuan dung chung giua
// middleware (Edge) va client: dinh tuyen /hoc-vien/* khi chua dang nhap,
// phat hien token het han, chan open-redirect qua ?next=.
// Bao mat that (verify chu ky JWT, RLS) KHONG nam o day — middleware chi
// doc `exp` de dinh tuyen, Supabase/RLS moi verify that (ghi ro trong
// src/middleware.ts). Kiem chung live bang curl: xem TASK06_REPORT.md §(b).
import { describe, expect, it } from 'vitest';
import {
  AUTH_CHECK_TIMEOUT_MS,
  decodeJwtExp,
  decodeJwtSub,
  getAuthCookieName,
  isSafeNextPath,
  isTokenExpired,
  parseStoredSessionValue,
  safeNextPath,
  withTimeout,
} from './session-guard';

function makeJwt(exp: number): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u1', exp })}.${b64({})}`;
}

describe('getAuthCookieName', () => {
  it('sb-<project-ref>-auth-token tu Supabase URL', () => {
    expect(getAuthCookieName('https://scskhplczrxlnxzruweu.supabase.co')).toBe(
      'sb-scskhplczrxlnxzruweu-auth-token',
    );
  });
  it('thieu URL -> null (middleware de request qua, client hien not-configured)', () => {
    expect(getAuthCookieName(undefined)).toBeNull();
    expect(getAuthCookieName('')).toBeNull();
    expect(getAuthCookieName('khong-phai-url')).toBeNull();
  });
});

describe('isSafeNextPath — chan open-redirect', () => {
  it('duong dan noi bo hop le', () => {
    expect(isSafeNextPath('/hoc-vien/khoa-hoc')).toBe(true);
    expect(isSafeNextPath('/hoc-vien?tab=1')).toBe(true);
  });
  it('chan URL ngoai / // / backslash / xuong dong', () => {
    expect(isSafeNextPath('https://evil.example.com')).toBe(false);
    expect(isSafeNextPath('//evil.example.com')).toBe(false);
    expect(isSafeNextPath('/hoc-vien\\@evil.com')).toBe(false);
    expect(isSafeNextPath('/hoc-vien\r\nLocation: evil')).toBe(false);
    expect(isSafeNextPath(null)).toBe(false);
    expect(isSafeNextPath('')).toBe(false);
  });
  it('safeNextPath ve fallback /hoc-vien khi next khong an toan', () => {
    expect(safeNextPath('https://evil.example.com')).toBe('/hoc-vien');
    expect(safeNextPath('/hoc-vien/don-hang')).toBe('/hoc-vien/don-hang');
  });
});

describe('decodeJwtSub — S-01: lay id user de hoi is_disabled', () => {
  it('doc sub tu JWT (khong verify chu ky — chi de dinh tuyen)', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(decodeJwtSub(makeJwt(exp))).toBe('u1');
  });
  it('JWT sai dinh dang / thieu sub -> null (middleware cho qua, layout chan lai)', () => {
    expect(decodeJwtSub('khong-phai-jwt')).toBeNull();
    expect(decodeJwtSub('a.b')).toBeNull();
    expect(decodeJwtSub(null)).toBeNull();
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const noSub = `${b64({ alg: 'none' })}.${b64({ exp: 9999999999 })}.${b64({})}`;
    expect(decodeJwtSub(noSub)).toBeNull();
  });
});

describe('decodeJwtExp / isTokenExpired — (d) phien het han', () => {
  it('doc exp tu JWT (khong verify chu ky — chi de dinh tuyen)', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(decodeJwtExp(makeJwt(exp))).toBe(exp);
  });
  it('JWT sai dinh dang / thieu exp -> null (middleware coi nhu het han)', () => {
    expect(decodeJwtExp('khong-phai-jwt')).toBeNull();
    expect(decodeJwtExp('a.b')).toBeNull();
    expect(decodeJwtExp(null)).toBeNull();
    expect(decodeJwtExp('')).toBeNull();
  });
  it('token het han (qua 30 giay lech dong ho) -> expired', () => {
    const now = Date.now();
    const past = Math.floor(now / 1000) - 60;
    expect(isTokenExpired(past, now)).toBe(true);
    const future = Math.floor(now / 1000) + 3600;
    expect(isTokenExpired(future, now)).toBe(false);
    // Het han trong vong 30 giay toi -> coi nhu het han (lech dong ho).
    expect(isTokenExpired(Math.floor(now / 1000) + 10, now)).toBe(true);
  });
  it('khong co exp -> khong ket luan het han (de Supabase quyet dinh)', () => {
    expect(isTokenExpired(null)).toBe(false);
    expect(isTokenExpired(undefined)).toBe(false);
  });
});

describe('parseStoredSessionValue — cookie phien', () => {
  it('parse JSON phien day du, uu tien expires_at', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const raw = encodeURIComponent(
      JSON.stringify({ access_token: makeJwt(exp), refresh_token: 'r1', expires_at: exp }),
    );
    const s = parseStoredSessionValue(raw);
    expect(s).not.toBeNull();
    expect(s!.expires_at).toBe(exp);
    expect(s!.refresh_token).toBe('r1');
  });
  it('thieu expires_at -> lay exp tu JWT', () => {
    const exp = Math.floor(Date.now() / 1000) + 1800;
    const raw = encodeURIComponent(
      JSON.stringify({ access_token: makeJwt(exp), refresh_token: 'r1' }),
    );
    expect(parseStoredSessionValue(raw)?.expires_at).toBe(exp);
  });
  it('cookie rac / thieu token -> null (middleware redirect ve dang nhap)', () => {
    expect(parseStoredSessionValue(null)).toBeNull();
    expect(parseStoredSessionValue('')).toBeNull();
    expect(parseStoredSessionValue('khong-phai-json')).toBeNull();
    expect(parseStoredSessionValue(encodeURIComponent(JSON.stringify({ foo: 1 })))).toBeNull();
    expect(
      parseStoredSessionValue(
        encodeURIComponent(JSON.stringify({ access_token: 'x', refresh_token: '' })),
      ),
    ).toBeNull();
  });
});

describe('withTimeout — guard khong ket vinh vien khi Supabase treo', () => {
  it('promise xong truoc timeout thi tra ket qua', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });
  it('promise treo qua timeout thi reject (layout hien man hinh loi + nut Thu lai)', async () => {
    const never = new Promise<string>(() => {});
    await expect(withTimeout(never, 20)).rejects.toThrow('auth-check-timeout');
  });
  it('promise reject truoc timeout thi giu nguyen loi', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom');
  });
  it('AUTH_CHECK_TIMEOUT_MS = 10s', () => {
    expect(AUTH_CHECK_TIMEOUT_MS).toBe(10_000);
  });
});
