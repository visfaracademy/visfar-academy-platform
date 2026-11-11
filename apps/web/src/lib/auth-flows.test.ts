// Test cac luong auth moi Task 06 — chay local, khong can Supabase that:
// quen mat khau / gui lai xac minh / dat lai / doi mat khau /
// dang xuat moi thiet bi / trang thai phien / doi code PKCE.
// (Phan chong leo role + chi doc du lieu cua minh da co o security.test.ts.)
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseBrowserClient: () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      resend: mocks.resend,
      updateUser: mocks.updateUser,
      getUser: mocks.getUser,
      getSession: mocks.getSession,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: () => {
      throw new Error('khong dung from() trong file test nay');
    },
  }),
  getSupabaseClient: () => null,
}));

import {
  changePassword,
  exchangeCodeForSession,
  getSessionState,
  mapAuthErrorMessage,
  requestPasswordReset,
  resendSignUpEmail,
  resetPasswordWithSession,
  signOut,
  signOutAllDevices,
  signUpWithEmail,
  subscribeToAuthChanges,
  validatePasswordChange,
} from './auth';

const ORIGIN = 'https://example.com';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { email: 'a@test.visfar' } }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
});

describe('mapAuthErrorMessage — loi moi Task 06', () => {
  it('link het han / khong hop le', () => {
    expect(mapAuthErrorMessage('Email link is invalid or has expired')).toBe(
      'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.',
    );
    expect(mapAuthErrorMessage('Otp expired')).toBe(
      'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.',
    );
  });
  it('mat khau moi trung mat khau cu', () => {
    expect(mapAuthErrorMessage('New password should be different from the old password.')).toBe(
      'Mật khẩu mới phải khác mật khẩu hiện tại.',
    );
  });
});

describe('validatePasswordChange', () => {
  it('hop le', () => {
    expect(
      validatePasswordChange({
        currentPassword: 'matkhaucu1',
        newPassword: 'matkhaumoi1',
        confirmPassword: 'matkhaumoi1',
      }),
    ).toBeNull();
  });
  it('thieu mat khau hien tai / moi qua ngan / trung cu / nhap lai lech', () => {
    expect(
      validatePasswordChange({ currentPassword: '', newPassword: 'matkhaumoi1', confirmPassword: 'matkhaumoi1' }),
    ).toBe('Vui lòng nhập mật khẩu hiện tại.');
    expect(
      validatePasswordChange({ currentPassword: 'matkhaucu1', newPassword: 'ngan', confirmPassword: 'ngan' }),
    ).toBe('Mật khẩu cần ít nhất 8 ký tự.');
    expect(
      validatePasswordChange({ currentPassword: 'matkhaucu1', newPassword: 'matkhaucu1', confirmPassword: 'matkhaucu1' }),
    ).toBe('Mật khẩu mới phải khác mật khẩu hiện tại.');
    expect(
      validatePasswordChange({ currentPassword: 'matkhaucu1', newPassword: 'matkhaumoi1', confirmPassword: 'matkhaumoi2' }),
    ).toBe('Mật khẩu mới nhập lại chưa khớp.');
  });
});

describe('signUpWithEmail — redirect xac minh ve /auth/callback', () => {
  it('co origin -> emailRedirectTo tro ve callback, data chi co full_name', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await signUpWithEmail({ fullName: 'Test A', email: 'a@test.visfar', password: 'matkhau123', origin: ORIGIN });
    const args = mocks.signUp.mock.calls[0][0] as Record<string, unknown>;
    expect((args.options as { emailRedirectTo?: string }).emailRedirectTo).toBe(
      `${ORIGIN}/auth/callback?next=/hoc-vien`,
    );
    expect((args.options as { data: unknown }).data).toEqual({ full_name: 'Test A' });
  });
});

describe('requestPasswordReset — quen mat khau', () => {
  it('email sai dinh dang -> loi, khong goi API', async () => {
    const r = await requestPasswordReset('khong-phai-email', ORIGIN);
    expect(r.status).toBe('error');
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it('email hop le -> resetPasswordForEmail voi redirectTo ve callback dat-lai-mat-khau', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const r = await requestPasswordReset('a@test.visfar', ORIGIN);
    expect(r).toEqual({ status: 'ok' });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('a@test.visfar', {
      redirectTo: `${ORIGIN}/auth/callback?next=/dat-lai-mat-khau`,
    });
  });
  it('API rate-limit -> thong bao tieng Viet, khong lo ky thuat', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Too many requests' },
    });
    const r = await requestPasswordReset('a@test.visfar', ORIGIN);
    expect(r.status).toBe('error');
    if (r.status === 'error') {
      expect(r.message).toBe('Bạn đã thử quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.');
    }
  });
});

describe('resendSignUpEmail — gui lai xac minh', () => {
  it('goi resend type signup voi redirect ve callback', async () => {
    mocks.resend.mockResolvedValue({ data: {}, error: null });
    const r = await resendSignUpEmail('a@test.visfar', ORIGIN);
    expect(r).toEqual({ status: 'ok' });
    expect(mocks.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@test.visfar',
      emailRedirectTo: `${ORIGIN}/auth/callback?next=/hoc-vien`,
    });
  });
  it('email sai -> loi truoc khi goi API', async () => {
    const r = await resendSignUpEmail('x', ORIGIN);
    expect(r.status).toBe('error');
    expect(mocks.resend).not.toHaveBeenCalled();
  });
});

describe('resetPasswordWithSession — dat lai mat khau bang phien recovery', () => {
  it('mat khau qua ngan -> loi, khong goi updateUser', async () => {
    const r = await resetPasswordWithSession('ngan');
    expect(r.status).toBe('error');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('hop le -> updateUser({ password })', async () => {
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    const r = await resetPasswordWithSession('matkhaumoi1');
    expect(r).toEqual({ status: 'ok' });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'matkhaumoi1' });
  });
  it('mat khau moi trung cu (loi server) -> thong bao tieng Viet', async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: { message: 'New password should be different from the old password.' },
    });
    const r = await resetPasswordWithSession('matkhaumoi1');
    expect(r).toEqual({ status: 'error', message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
  });
});

describe('changePassword — doi mat khau khi da dang nhap', () => {
  it('mat khau hien tai sai -> loi, KHONG goi updateUser', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    const r = await changePassword({
      currentPassword: 'sai-roi-123',
      newPassword: 'matkhaumoi1',
      confirmPassword: 'matkhaumoi1',
    });
    expect(r).toEqual({ status: 'error', message: 'Mật khẩu hiện tại chưa đúng. Vui lòng thử lại.' });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@test.visfar',
      password: 'sai-roi-123',
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('chua dang nhap (getUser null) -> loi, khong goi signIn/updateUser', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const r = await changePassword({
      currentPassword: 'matkhaucu1',
      newPassword: 'matkhaumoi1',
      confirmPassword: 'matkhaumoi1',
    });
    expect(r.status).toBe('error');
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('xac minh xong -> updateUser mat khau moi', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    const r = await changePassword({
      currentPassword: 'matkhaucu1',
      newPassword: 'matkhaumoi1',
      confirmPassword: 'matkhaumoi1',
    });
    expect(r).toEqual({ status: 'ok' });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'matkhaumoi1' });
  });
  it('validation loi -> khong goi bat ky API nao', async () => {
    const r = await changePassword({
      currentPassword: 'matkhaucu1',
      newPassword: 'matkhaucu1',
      confirmPassword: 'matkhaucu1',
    });
    expect(r.status).toBe('error');
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});

describe('signOut — pham vi dang xuat', () => {
  it('mac dinh chi thiet bi hien tai (scope local)', async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    expect(await signOut()).toEqual({ status: 'ok' });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('signOutAllDevices dung scope global (thu hoi refresh token moi phien)', async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    expect(await signOutAllDevices()).toEqual({ status: 'ok' });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
  it('loi dang xuat -> error tieng Viet', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'Something broke' } });
    const r = await signOut();
    expect(r.status).toBe('error');
  });
});

describe('getSessionState / exchangeCodeForSession / subscribeToAuthChanges', () => {
  it('co session -> active kem expires_at', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { expires_at: 2000000000 } },
      error: null,
    });
    expect(await getSessionState()).toEqual({ status: 'active', expiresAt: 2000000000 });
  });
  it('khong session -> signed-out', async () => {
    expect(await getSessionState()).toEqual({ status: 'signed-out' });
  });
  it('doi code PKCE thanh cong / that bai', async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    expect(await exchangeCodeForSession('code-123')).toEqual({ status: 'ok' });
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('code-123');
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: 'Email link is invalid or has expired' },
    });
    const r = await exchangeCodeForSession('code-het-han');
    expect(r).toEqual({
      status: 'error',
      message: 'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.',
    });
  });
  it('subscribe -> callback nhan event; unsubscribe huy dang ky', async () => {
    const unsubscribe = vi.fn();
    const captured: { fn: ((event: string, session: unknown) => void) | null } = { fn: null };
    mocks.onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      captured.fn = cb;
      return { data: { subscription: { unsubscribe } } };
    });
    const seen: string[] = [];
    const off = subscribeToAuthChanges((event) => {
      seen.push(event);
    });
    expect(off).not.toBeNull();
    captured.fn?.('SIGNED_OUT', null);
    captured.fn?.('TOKEN_REFRESHED', { user: { email: 'a@test.visfar' } });
    expect(seen).toEqual(['SIGNED_OUT', 'TOKEN_REFRESHED']);
    off?.();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
