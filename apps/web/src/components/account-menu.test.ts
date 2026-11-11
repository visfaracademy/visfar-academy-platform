// Menu tai khoan hoc vien — khoa tung muc vao route that, khong co muc gia.
// - 12 muc co ban (them "Danh gia 11D" -> /hoc-vien/danh-gia-11d ngay
//   11/11/2026, Prompt 11; them "AI Mentor" -> /ai-mentor ngay 11/11/2026,
//   Prompt 12; them "Thanh tich" + "Cong dong" ngay 11/11/2026,
//   Prompt 13 + 14, GĐ2).
// - "Quan tri" -> /admin CHI hien khi role = 'admin' (visibleAccountMenuItems),
//   chen sau "Doi mat khau", truoc "Dang xuat" (AccountNav render nut Dang
//   xuat sau danh sach menu).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_MENU_ITEMS,
  ADMIN_MENU_ITEM,
  visibleAccountMenuItems,
} from './account-menu-items';

const APP_DIR = join(__dirname, '..', 'app');

describe('account menu (dropdown tai khoan hoc vien)', () => {
  it('co dung 12 muc co ban, dung thu tu va nhan', () => {
    expect(ACCOUNT_MENU_ITEMS.map((i) => i.label)).toEqual([
      'Tổng quan',
      'Khóa học của tôi',
      'Lịch sử học',
      'Đánh giá 11D',
      'AI Mentor',
      'Thành tích',
      'Cộng đồng',
      'Lịch hẹn của tôi',
      'Đơn hàng',
      'Ví & tiếp thị liên kết',
      'Thông tin cá nhân',
      'Đổi mật khẩu',
    ]);
    expect(ACCOUNT_MENU_ITEMS.map((i) => i.href)).toEqual([
      '/hoc-vien',
      '/hoc-vien/khoa-hoc',
      '/hoc-vien/lich-su-hoc',
      '/hoc-vien/danh-gia-11d',
      '/ai-mentor',
      '/hoc-vien/thanh-tich',
      '/cong-dong',
      '/hoc-vien/lich-su',
      '/hoc-vien/don-hang',
      '/hoc-vien/vi',
      '/hoc-vien/ho-so',
      '/hoc-vien/doi-mat-khau',
    ]);
  });

  it('moi muc deu tro toi route that (co page.tsx), khong co muc gia', () => {
    for (const item of ACCOUNT_MENU_ITEMS) {
      const dir = join(APP_DIR, ...item.href.replace(/^\//, '').split('/'));
      expect(existsSync(join(dir, 'page.tsx')), `${item.href} phai co page.tsx`).toBe(true);
    }
    const dir = join(APP_DIR, ...ADMIN_MENU_ITEM.href.replace(/^\//, '').split('/'));
    expect(existsSync(join(dir, 'page.tsx')), `${ADMIN_MENU_ITEM.href} phai co page.tsx`).toBe(true);
  });

  it('khong co muc trung href', () => {
    const hrefs = [...ACCOUNT_MENU_ITEMS.map((i) => i.href), ADMIN_MENU_ITEM.href];
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('admin thay muc Quan tri sau Doi mat khau; hoc vien khong thay', () => {
    const adminItems = visibleAccountMenuItems('admin');
    expect(adminItems.map((i) => i.label)).toEqual([
      'Tổng quan',
      'Khóa học của tôi',
      'Lịch sử học',
      'Đánh giá 11D',
      'AI Mentor',
      'Thành tích',
      'Cộng đồng',
      'Lịch hẹn của tôi',
      'Đơn hàng',
      'Ví & tiếp thị liên kết',
      'Thông tin cá nhân',
      'Đổi mật khẩu',
      'Quản trị',
    ]);
    expect(adminItems[adminItems.length - 1]?.href).toBe('/admin');
    for (const role of ['student', 'instructor', null, undefined, '']) {
      const items = visibleAccountMenuItems(role);
      expect(items.map((i) => i.label)).not.toContain('Quản trị');
      expect(items.map((i) => i.href)).not.toContain('/admin');
    }
  });
});
