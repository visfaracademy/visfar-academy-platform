// S-01 — chan hoc vien bi vo hieu hoa (profiles.is_disabled).
// Kiem tra TINH (source assertion, theo mau lms-access.test.ts):
// middleware hoi is_disabled qua Supabase REST roi dang xuat + redirect
// ve /dang-nhap?reason=disabled; layout /hoc-vien kiem tra lai bang
// checkCurrentAccountDisabled() roi signOut; trang dang nhap hien
// thong bao vo hieu hoa. Kiem chung live tren staging (REST that +
// mo /hoc-vien that) nam ngoai file nay — xem bao cao S-01.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('S-01 middleware: chan tai khoan bi vo hieu hoa', () => {
  const src = readSrc('../middleware.ts');
  it('hoi profiles.is_disabled qua Supabase REST bang Bearer token', () => {
    expect(src).toContain('rest/v1/profiles?select=is_disabled');
    expect(src).toContain('decodeJwtSub');
    expect(src).toContain('isAccountDisabled');
  });
  it('bi disable -> thu hoi phien + redirect ve dang nhap ?reason=disabled', () => {
    expect(src).toContain("reason', 'disabled'");
    expect(src).toContain('auth/v1/logout');
    expect(src).toContain('disabledRedirect');
  });
  it('API admin bi disable -> JSON 403 (khong redirect)', () => {
    expect(src).toContain('Tài khoản của bạn đã bị vô hiệu hóa');
    expect(src).toContain('403');
  });
  it('ghi ro gioi han: middleware KHONG verify chu ky JWT', () => {
    expect(src).toContain('khong verify chu ky');
    expect(src).toContain('fail-open');
  });
  it('khong dung service-role key o middleware', () => {
    expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(src).not.toContain('service_role');
  });
});

describe('S-01 layout /hoc-vien: lop chan thu 2', () => {
  const src = readSrc('../app/hoc-vien/layout.tsx');
  it('kiem tra is_disabled roi signOut + ve dang nhap ?reason=disabled', () => {
    expect(src).toContain('checkCurrentAccountDisabled');
    expect(src).toContain('signOut');
    expect(src).toContain('/dang-nhap?reason=disabled');
  });
  it('hien thong bao vo hieu hoa khi dang chuyen ve dang nhap', () => {
    expect(src).toContain('Tài khoản của bạn đã bị vô hiệu hóa');
  });
});

describe('S-01 auth.ts: checkCurrentAccountDisabled', () => {
  const src = readSrc('./auth.ts');
  it('doc cot is_disabled cua chinh user hien tai', () => {
    expect(src).toContain('checkCurrentAccountDisabled');
    expect(src).toContain("select('is_disabled')");
  });
});

describe('S-01 trang dang nhap: hien ly do bi vo hieu hoa', () => {
  const src = readSrc('../app/dang-nhap/page.tsx');
  it('?reason=disabled -> thong bao vo hieu hoa', () => {
    expect(src).toContain("reason') === 'disabled'");
    expect(src).toContain('Tài khoản của bạn đã bị vô hiệu hóa');
  });
});

describe('S-01 migration 0022: trigger chan tu doi is_disabled', () => {
  const sql = readFileSync(
    join(here, '..', '..', '..', '..', 'supabase', 'migrations', '0022_block_student_self_disable.sql'),
    'utf8',
  );
  it('trigger BEFORE UPDATE OF is_disabled, disabled_at, disabled_reason', () => {
    expect(sql).toContain('prevent_profiles_disable_change');
    expect(sql).toContain('before update of is_disabled, disabled_at, disabled_reason');
    expect(sql).toContain('trg_profiles_block_disable_change');
  });
  it('chan non-admin (RAISE EXCEPTION), cho admin + service-role qua', () => {
    expect(sql).toContain('raise exception');
    expect(sql).toContain("public.current_role() is distinct from 'admin'");
    expect(sql).toContain('auth.uid() is not null');
  });
  it('KHONG REVOKE cot is_disabled (admin doi truc tiep bang JWT)', () => {
    // Chi khop lenh REVOKE that o dau dong — file co doan comment
    // giai thich vi sao KHONG dung REVOKE nen khong duoc khop comment.
    expect(sql).not.toMatch(/^revoke update \(is_disabled/im);
  });
});
