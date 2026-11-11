// Test auth helpers (pure) — chay local, khong can Supabase that.
import { describe, expect, it } from 'vitest';
import { mapAuthErrorMessage, validatePassword } from './auth';

describe('validatePassword', () => {
  it('hop le: >= 8 ky tu', () => {
    expect(validatePassword('matkhau123')).toBeNull();
  });
  it('qua ngan: 7 ky tu', () => {
    expect(validatePassword('1234567')).toBe('Mật khẩu cần ít nhất 8 ký tự.');
  });
  it('rong', () => {
    expect(validatePassword('')).toBe('Vui lòng nhập mật khẩu.');
  });
  it('qua dai: 129 ky tu', () => {
    expect(validatePassword('a'.repeat(129))).toBe('Mật khẩu quá dài (tối đa 128 ký tự).');
  });
});

describe('mapAuthErrorMessage — loi Supabase -> tieng Viet, khong lo ky thuat', () => {
  it('sai email/mat khau', () => {
    expect(mapAuthErrorMessage('Invalid login credentials')).toBe(
      'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.',
    );
  });
  it('email da dang ky', () => {
    expect(mapAuthErrorMessage('User already registered')).toBe(
      'Email này đã đăng ký. Vui lòng đăng nhập hoặc đặt lại mật khẩu.',
    );
  });
  it('email chua xac nhan', () => {
    expect(mapAuthErrorMessage('Email not confirmed')).toBe(
      'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư và bấm liên kết xác nhận.',
    );
  });
  it('qua nhieu lan thu', () => {
    expect(mapAuthErrorMessage('Too many requests')).toBe(
      'Bạn đã thử quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.',
    );
  });
  it('loi la: tra message chung, khong lo nguyen van ky thuat', () => {
    expect(mapAuthErrorMessage('something weird happened')).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.');
  });
});
