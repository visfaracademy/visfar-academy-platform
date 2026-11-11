// Auth — Supabase Auth truc tiep (email + mat khau). Khong tu viet
// he thong auth rieng, khong luu mat khau o bat ky dau (API_ARCH §3).
// Role mac dinh 'student' do trigger handle_new_user() tao profiles
// (migration 0001); client KHONG duoc tu gan role — role chi admin gan
// qua user_roles (DECISIONS Task 03 QĐ 3).
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabase';
import { AUTH_CHECK_TIMEOUT_MS, withTimeout } from './session-guard';
import { validateEmail, validateFullName } from './validation';
import { notifyWelcomeEmail } from './email';

export interface MyProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  province: string | null;
  role: string;
  avatar_url: string | null;
  /** Gamification bat/tat (migration 0031). Tuy chon: DB prod chua co
      cot nay truoc khi 0030 ap len prod thi undefined = mac dinh bat. */
  gamification_enabled?: boolean;
}

export interface MyEnrollment {
  id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  courseTitle: string;
  courseSlug: string;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Vui lòng nhập mật khẩu.';
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (password.length > 128) return 'Mật khẩu quá dài (tối đa 128 ký tự).';
  return null;
}

/** Map loi Supabase Auth sang tieng Viet, khong lo chi tiet ky thuat. */
export function mapAuthErrorMessage(message: string): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.';
  }
  if (m.includes('user already registered') || m.includes('already registered') || m.includes('already exists')) {
    return 'Email này đã đăng ký. Vui lòng đăng nhập hoặc đặt lại mật khẩu.';
  }
  if (m.includes('email not confirmed') || m.includes('email not verified')) {
    return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư và bấm liên kết xác nhận.';
  }
  if (
    m.includes('email link is invalid') ||
    m.includes('invalid or has expired') ||
    m.includes('link is invalid or has expired') ||
    m.includes('otp expired') ||
    m.includes('expired')
  ) {
    return 'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu liên kết mới.';
  }
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return 'Bạn đã thử quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.';
  }
  if (
    m.includes('new password should be different') ||
    m.includes('should be different from the old')
  ) {
    return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }
  if (m.includes('password')) return 'Mật khẩu chưa hợp lệ. Vui lòng kiểm tra lại.';
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/** Validate doi mat khau: mat khau hien tai + mat khau moi + nhap lai. */
export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!input.currentPassword) return 'Vui lòng nhập mật khẩu hiện tại.';
  const pwError = validatePassword(input.newPassword);
  if (pwError) return pwError;
  if (input.newPassword === input.currentPassword) {
    return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }
  if (input.newPassword !== input.confirmPassword) {
    return 'Mật khẩu mới nhập lại chưa khớp.';
  }
  return null;
}

export type SignUpResult =
  | { status: 'ok' }
  | { status: 'confirm-email'; message: string }
  | { status: 'error'; message: string };

export async function signUpWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
  /** Ghi de origin cho emailRedirectTo (test). Mac dinh lay window.location.origin. */
  origin?: string;
}): Promise<SignUpResult> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  }
  if (!validateFullName(input.fullName)) {
    return { status: 'error', message: 'Vui lòng nhập họ và tên (2–100 ký tự).' };
  }
  if (!validateEmail(input.email)) {
    return { status: 'error', message: 'Email chưa đúng định dạng.' };
  }
  const pwError = validatePassword(input.password);
  if (pwError) return { status: 'error', message: pwError };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const origin =
    input.origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    // Chi gui full_name — KHONG gui role: role mac dinh 'student' do
    // trigger DB gan; hoc vien khong duoc tu chon role
    // (RLS chan o 0009_security_fixes.sql — xem rls-policy.test.ts).
    options: {
      data: { full_name: input.fullName.trim() },
      ...(origin ? { emailRedirectTo: `${origin}/auth/callback?next=/hoc-vien` } : {}),
    },
  });
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  // Task 11 (E1 — welcome): dinh tuyen mail chao mung sau khi dang ky
  // xong. notifyWelcomeEmail KHONG BAO GIO throw va khong doi ket qua
  // tra ve: loi email khong lam hong dang ky. Gui that chi xay ra o
  // Workers khi RESEND_API_KEY da cau hinh (mac dinh chi ghi log);
  // mail xac minh cua Supabase Auth van gui nhu cu, day la mail rieng.
  void notifyWelcomeEmail({ toEmail: input.email.trim(), userId: data.user?.id ?? null });
  // Supabase co the yeu cau xac nhan email truoc khi co session.
  if (data.session) return { status: 'ok' };
  return {
    status: 'confirm-email',
    message:
      'Đã tạo tài khoản. Vui lòng kiểm tra email và bấm liên kết xác nhận trước khi đăng nhập.',
  };
}

export type SignInResult = { status: 'ok' } | { status: 'error'; message: string };

export async function signInWithEmail(input: { email: string; password: string }): Promise<SignInResult> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  }
  if (!validateEmail(input.email)) {
    return { status: 'error', message: 'Email chưa đúng định dạng.' };
  }
  const pwError = validatePassword(input.password);
  if (pwError) return { status: 'error', message: pwError };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  return { status: 'ok' };
}

export type SignOutResult = { status: 'ok' } | { status: 'error'; message: string };

/**
 * Dang xuat.
 * - 'local' (mac dinh): chi thiet bi hien tai.
 * - 'global': moi thiet bi — Supabase thu hoi refresh token cua tat ca
 *   phien (scope 'global' cua supabase-js). LUU Y: access token da cap
 *   van dung duoc toi khi het han (thuong <= 1 gio); khong co cach nao
 *   thu hoi ngay access token tu phia client — day la gioi han cua
 *   Supabase Auth, khong phai loi code nay.
 * - 'others': moi thiet bi tru thiet bi hien tai.
 */
export async function signOut(scope: 'local' | 'global' | 'others' = 'local'): Promise<SignOutResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const { error } = await supabase.auth.signOut({ scope });
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  return { status: 'ok' };
}

/** Dang xuat khoi TAT CA thiet bi (thu hoi refresh token toan cuc). */
export async function signOutAllDevices(): Promise<SignOutResult> {
  return signOut('global');
}

export type SimpleResult = { status: 'ok' } | { status: 'error'; message: string };

function resolveOrigin(origin?: string): string | undefined {
  if (origin) return origin;
  if (typeof window !== 'undefined') return window.location.origin;
  return undefined;
}

/**
 * Quen mat khau: gui email dat lai. Supabase khong tiet lo email co
 * ton tai hay khong — ham nay luon tra 'ok' khi goi API khong loi,
 * UI hien thong bao chung de tranh do tim email (enumeration).
 */
export async function requestPasswordReset(email: string, origin?: string): Promise<SimpleResult> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  }
  if (!validateEmail(email)) {
    return { status: 'error', message: 'Email chưa đúng định dạng.' };
  }
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const base = resolveOrigin(origin);
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    ...(base ? { redirectTo: `${base}/auth/callback?next=/dat-lai-mat-khau` } : {}),
  });
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  return { status: 'ok' };
}

/** Gui lai email xac minh dang ky (type 'signup'). */
export async function resendSignUpEmail(email: string, origin?: string): Promise<SimpleResult> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  }
  if (!validateEmail(email)) {
    return { status: 'error', message: 'Email chưa đúng định dạng.' };
  }
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const base = resolveOrigin(origin);
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    ...(base ? { emailRedirectTo: `${base}/auth/callback?next=/hoc-vien` } : {}),
  });
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  return { status: 'ok' };
}

/**
 * Dat lai mat khau bang phien recovery (tu link trong email quen mat
 * khau, sau khi /auth/callback doi code lay session). Can phien hop
 * le — neu chua co phien thi Supabase tra loi, UI chuyen ve quen mat khau.
 */
export async function resetPasswordWithSession(newPassword: string): Promise<SimpleResult> {
  const pwError = validatePassword(newPassword);
  if (pwError) return { status: 'error', message: pwError };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  return { status: 'ok' };
}

/**
 * Doi mat khau khi da dang nhap. Supabase updateUser() khong tu
 * kiem tra mat khau cu, nen ham nay xac minh lai bang cach dang nhap
 * lai voi mat khau hien tai truoc khi doi.
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<SimpleResult> {
  const validationError = validatePasswordChange(input);
  if (validationError) return { status: 'error', message: validationError };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email) {
    return { status: 'error', message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập lại.' };
  }
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (verifyError) {
    return { status: 'error', message: 'Mật khẩu hiện tại chưa đúng. Vui lòng thử lại.' };
  }
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  return { status: 'ok' };
}

export type SessionState =
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  | { status: 'active'; expiresAt: number | null };

/**
 * Trang thai phien hien tai. getSession() cua supabase-js se tu refresh
 * access token neu het han ma refresh token con han (autoRefreshToken);
 * neu refresh that bai thi tra ve session null -> 'signed-out'.
 */
export async function getSessionState(): Promise<SessionState> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'not-configured' };
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return { status: 'signed-out' };
  return { status: 'active', expiresAt: session.expires_at ?? null };
}

/**
 * Lang nghe thay doi phien: SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED /
 * PASSWORD_RECOVERY / USER_UPDATED. Tra ve ham huy dang ky.
 * Dung de: tu dong chuyen ve /dang-nhap khi phien het han hoac khi
 * tai khoan bi dang xuat tu thiet bi khac (global sign-out).
 */
export function subscribeToAuthChanges(
  cb: (event: string, userEmail: string | null) => void,
): (() => void) | null {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session?.user?.email ?? null);
  });
  return () => listener.subscription.unsubscribe();
}

/** Doi code (PKCE) tu link email lay session — dung o /auth/callback. */
export async function exchangeCodeForSession(code: string): Promise<SimpleResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'error', message: 'Chưa cấu hình Supabase. Vui lòng thử lại sau.' };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { status: 'error', message: mapAuthErrorMessage(error.message) };
  return { status: 'ok' };
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export type AccountDisabledState = 'not-configured' | 'signed-out' | 'active' | 'disabled' | 'error';

/**
 * S-01: kiem tra tai khoan hien tai co bi vo hieu hoa khong
 * (profiles.is_disabled). Dung o layout /hoc-vien (lop chan thu 2 sau
 * middleware). 'error' = khong doc duoc profiles (loi mang / RLS) —
 * caller CHO QUA (fail-open) vi middleware da kiem tra truoc; khong
 * khoa cung trang vi loi tam thoi. Profile chua co dong -> 'active'
 * (chua bi disable).
 */
export async function checkCurrentAccountDisabled(): Promise<AccountDisabledState> {
  if (!isSupabaseConfigured()) return 'not-configured';
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 'not-configured';
  const client = supabase;
  // 2026-11-11 — timeout 10s cho TOAN BO luong kiem tra: truoc day neu
  // `getUser()` hoac select profiles treo thi layout /hoc-vien ket vinh
  // vien o man hinh "Dang kiem tra phien dang nhap...". Timeout tra
  // 'error' (caller CHO QUA theo thiet ke — middleware da kiem tra truoc).
  async function check(): Promise<AccountDisabledState> {
    const { data: authData } = await client.auth.getUser();
    const user = authData.user;
    if (!user) return 'signed-out';
    const { data, error } = await client
      .from('profiles')
      .select('is_disabled')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return 'error';
    return (data as { is_disabled?: boolean | null } | null)?.is_disabled === true
      ? 'disabled'
      : 'active';
  }
  try {
    return await withTimeout(check(), AUTH_CHECK_TIMEOUT_MS);
  } catch {
    return 'error';
  }
}

export type ProfileState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'success'; user: User; profile: MyProfile | null }
  | { status: 'error'; message: string; isOffline: boolean };

export async function getMyProfileState(): Promise<ProfileState> {
  if (!isSupabaseConfigured()) return { status: 'not-configured' };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: 'not-configured' };
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return { status: 'signed-out' };
    // Cot gamification_enabled chi co tu migration 0031 (moi ap staging,
    // chua ap prod). Neu DB chua co cot thi select loi "column does not
    // exist" — thu lai khong co cot do thay vi lam hong ca dashboard.
    let { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, province, role, avatar_url, gamification_enabled')
      .eq('id', user.id)
      .maybeSingle();
    if (error && /gamification_enabled/i.test(error.message)) {
      const retry = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, province, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      data = retry.data as typeof data;
      error = retry.error;
    }
    if (error) {
      return { status: 'error', message: error.message, isOffline: false };
    }
    return { status: 'success', user, profile: (data as MyProfile | null) ?? null };
  } catch (err) {
    const isOffline =
      err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
    return {
      status: 'error',
      message: isOffline
        ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.'
        : err instanceof Error
          ? err.message
          : 'Không tải được hồ sơ.',
      isOffline,
    };
  }
}

export type EnrollmentsState =
  | { status: 'loading' }
  | { status: 'success'; enrollments: MyEnrollment[] }
  | { status: 'error'; message: string; isOffline: boolean };

export async function getMyEnrollments(): Promise<EnrollmentsState> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { status: 'error', message: 'Chưa cấu hình Supabase.', isOffline: false };
  }
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      return { status: 'error', message: 'Bạn chưa đăng nhập.', isOffline: false };
    }
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, status, enrolled_at, completed_at, courses(title, slug)')
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false });
    if (error) {
      return { status: 'error', message: error.message, isOffline: false };
    }
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      status: string;
      enrolled_at: string;
      completed_at: string | null;
      courses: { title: string; slug: string } | null;
    }>;
    return {
      status: 'success',
      enrollments: rows.map((r) => ({
        id: r.id,
        status: r.status,
        enrolled_at: r.enrolled_at,
        completed_at: r.completed_at,
        courseTitle: r.courses?.title ?? '(Khóa học đã gỡ)',
        courseSlug: r.courses?.slug ?? '',
      })),
    };
  } catch (err) {
    const isOffline =
      err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
    return {
      status: 'error',
      message: isOffline
        ? 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.'
        : err instanceof Error
          ? err.message
          : 'Không tải được danh sách khóa học đã ghi danh.',
      isOffline,
    };
  }
}
