// Security test — Task 06. Chay local, khong can Supabase that:
// mock Supabase client + kiem tra tinh (static) ma nguon.
//   (a) Hoc vien A khong xem duoc du lieu hoc vien B: moi query doc
//       profiles/enrollments cua frontend LUON loc theo id cua chinh
//       user dang dang nhap (eq id/user_id = auth uid); khi chua dang
//       nhap thi khong query gi ca.
//   (c) Hoc vien khong tu thay duoc role: signUp/signIn khong gui field
//       role; khong co ham client nao update profiles hay insert
//       user_roles; supabase.ts khong chua service-role key.
//   (d) Session het han / token khong hop le: getUser tra null hoac loi
//       -> signed-out (khong bao gio success gia); signOut goi
//       auth.signOut va phien sau do la signed-out.
// Live 2-tai-khoan tren staging: CHUA CHAY (xem docs/frontend/TASK06_REPORT.md
// — staging Auth bi "email rate limit exceeded", khong tao duoc tai khoan
// test trong phien nay). Test nay la lop frontend + policy; RLS that tren
// staging can kiem chung lai theo checklist trong bao cao.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mockGetUser = vi.fn();
const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockMaybeSingle = vi.fn();
const capturedEq: Array<{ column: string; value: unknown }> = [];
const fromTables: string[] = [];

// Query builder toi thieu, giong supabase-js: select -> eq -> (maybeSingle | order -> await).
function makeQueryStub() {
  const stub: Record<string, unknown> = {};
  stub.select = vi.fn(() => stub);
  stub.eq = vi.fn((column: string, value: unknown) => {
    capturedEq.push({ column, value });
    return stub;
  });
  stub.order = vi.fn(() => stub);
  stub.maybeSingle = mockMaybeSingle;
  // Builder la thenable: `await query` tra { data, error }.
  (stub as { then: unknown }).then = (
    resolve: (v: { data: unknown[]; error: null }) => void,
  ) => {
    resolve({ data: [], error: null });
    return undefined as unknown as PromiseLike<{ data: unknown[]; error: null }>;
  };
  return stub;
}

const mockFrom = vi.fn((table: string) => {
  fromTables.push(table);
  return makeQueryStub();
});

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: () => ({
    auth: {
      getUser: mockGetUser,
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
    from: mockFrom,
  }),
  getSupabaseClient: () => null,
}));

import {
  getMyEnrollments,
  getMyProfileState,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from './auth';

const USER_A = { id: '11111111-aaaa-4000-8000-0000000000a1', email: 'a@test.visfar' };
const USER_B_ID = '22222222-bbbb-4000-8000-0000000000b2';

beforeEach(() => {
  vi.clearAllMocks();
  capturedEq.length = 0;
  fromTables.length = 0;
  mockGetUser.mockResolvedValue({ data: { user: USER_A }, error: null });
  mockMaybeSingle.mockResolvedValue({
    data: { id: USER_A.id, full_name: 'Test A', email: USER_A.email, role: 'student' },
    error: null,
  });
});

describe('(a) Chi doc du lieu cua chinh minh — query loc theo uid', () => {
  it('getMyProfileState: query profiles voi eq(id, uid cua A), khong bao gio id cua B', async () => {
    const state = await getMyProfileState();
    expect(state.status).toBe('success');
    expect(fromTables).toContain('profiles');
    expect(capturedEq).toContainEqual({ column: 'id', value: USER_A.id });
    expect(capturedEq.some((e) => e.value === USER_B_ID)).toBe(false);
  });

  it('getMyEnrollments: query enrollments voi eq(user_id, uid cua A), khong bao gio user_id cua B', async () => {
    const state = await getMyEnrollments();
    expect(state.status).toBe('success');
    expect(fromTables).toContain('enrollments');
    expect(capturedEq).toContainEqual({ column: 'user_id', value: USER_A.id });
    expect(capturedEq.some((e) => e.value === USER_B_ID)).toBe(false);
  });

  it('chua dang nhap: khong query profiles/enrollments gi ca', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getMyProfileState()).toEqual({ status: 'signed-out' });
    expect(await getMyEnrollments()).toMatchObject({ status: 'error' });
    expect(fromTables).toEqual([]);
    expect(capturedEq).toEqual([]);
  });

  it('khong co duong doc profiles/enrollments khong loc uid trong auth.ts', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'auth.ts'), 'utf8');
    // Moi .from('profiles' | 'enrollments') trong file deu di kem .eq theo uid o cung ham.
    expect(src).toContain(".eq('id', user.id)");
    expect(src).toContain(".eq('user_id', user.id)");
    // Chi 4 cho dung profiles/enrollments, ca bon deu co eq uid (kiem tra bang dem).
    // S-01 them cho thu 3: checkCurrentAccountDisabled() doc is_disabled
    // cua chinh user (.eq('id', user.id)) — van loc theo uid nhu 2 cho cu.
    // GĐ2 them cho thu 4: getMyProfileState() thu lai khong co cot
    // gamification_enabled khi DB chua co cot do (migration 0031 moi ap
    // staging) — cung .eq('id', user.id), van loc theo uid.
    expect((src.match(/\.from\('(profiles|enrollments)'\)/g) ?? []).length).toBe(4);
  });
});

describe('(c) Khong tu thay duoc role tu client', () => {
  it('signUp khong gui field role — chi full_name trong options.data', async () => {
    mockSignUp.mockResolvedValue({ data: { session: {} }, error: null });
    await signUpWithEmail({ fullName: 'Test A', email: 'a@test.visfar', password: 'matkhau123' });
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    const args = mockSignUp.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('role');
    expect((args.options as { data: Record<string, unknown> }).data).toEqual({
      full_name: 'Test A',
    });
  });

  it('signIn khong gui field role', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: null });
    await signInWithEmail({ email: 'a@test.visfar', password: 'matkhau123' });
    const args = mockSignIn.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('role');
  });

  it('auth.ts: khong co update profiles / insert user_roles / update role', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'auth.ts'), 'utf8');
    expect(src).not.toContain(".from('user_roles')");
    expect(src).not.toContain('.update(');
    expect(src).not.toContain('.insert(');
    // Khong gan role (interface MyProfile co `role: string` — chi doc, khong gan).
    expect(src).not.toContain("role: 'admin'");
    expect(src).not.toContain('role: "admin"');
    expect(src).not.toContain("role =");
  });

  it('supabase.ts: khong co service-role key / JWT that', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'supabase.ts'), 'utf8');
    expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(src).not.toContain('service_role');
    expect(src).not.toContain('eyJ');
  });

  it('dashboard.ts (nhom Dashboard): updateMyProfile chi gui 3 truong, khong gui role/email', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'dashboard.ts'), 'utf8');
    const fn = src.match(/export async function updateMyProfile[\s\S]*?\n}/);
    expect(fn).not.toBeNull();
    expect(fn![0]).toContain('full_name');
    expect(fn![0]).toContain('phone');
    expect(fn![0]).toContain('province');
    expect(fn![0]).not.toMatch(/role/);
    expect(fn![0]).not.toMatch(/email/);
    expect(fn![0]).toContain(".eq('id', userId)");
  });

  it('dashboard.ts: khong doc/ghi user_roles; moi query doc loc theo uid cua minh', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'dashboard.ts'), 'utf8');
    expect(src).not.toContain(".from('user_roles')");
    // Moi query doc du lieu ca nhan deu co eq user_id/id theo userId; khong co
    // .from('profiles'|'enrollments'|'orders'|'certificates'|'notifications'|
    // 'lesson_progress'|'learning_events') nao khong kem eq o cung ham (kiem
    // tra gian tiep: so luong eq user_id/id >= so luong from bang ca nhan).
    const personalFrom = (src.match(/\.from\('(profiles|enrollments|orders|certificates|notifications|lesson_progress|learning_events)'\)/g) ?? []).length;
    const scopedEq = (src.match(/\.eq\('(user_id|id)', userId\)/g) ?? []).length;
    expect(personalFrom).toBeGreaterThan(0);
    expect(scopedEq).toBeGreaterThanOrEqual(personalFrom);
  });
});

describe('(d) Session het han / token khong hop le -> dang xuat', () => {
  it('getUser tra loi (vd token het han/khong hop le): khong success, ve signed-out', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    });
    const state = await getMyProfileState();
    expect(state.status).toBe('signed-out');
    expect(state).not.toHaveProperty('profile');
  });

  it('getUser reject (mat mang / token loi): khong success gia', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth session missing!'));
    const state = await getMyProfileState();
    // Code hien tai: getUser reject -> catch -> error (khong success). Chap nhan
    // error HOAC signed-out, mien khong success va khong tra profile.
    expect(state.status).not.toBe('success');
    expect(fromTables).toEqual([]);
  });

  it('signOut goi auth.signOut; sau do getUser tra null -> signed-out', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    await signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getMyProfileState()).toEqual({ status: 'signed-out' });
  });
});
