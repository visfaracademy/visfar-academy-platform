// Menu tai khoan hoc vien — theo anh mau user gui. Khong phu thuoc React/
// Next de test co the import truc tiep.
// - "Lich su hoc" o /hoc-vien/lich-su-hoc (trang Lich su hoc cu da chuyen
//   sang do ngay 11/11/2026); /hoc-vien/lich-su gio la trang Lich hen that.
// - "Vi & tiep thi lien ket" -> /hoc-vien/vi (trang that, API Workers
//   /api/v1/referrals/* — migration 0023).
// - "Quan tri" -> /admin CHI hien cho role admin (xem
//   visibleAccountMenuItems); hoc vien thuong KHONG thay muc nay.
export const ACCOUNT_MENU_ITEMS = [
  { href: '/hoc-vien', label: 'Tổng quan', icon: 'grid' },
  { href: '/hoc-vien/khoa-hoc', label: 'Khóa học của tôi', icon: 'book' },
  { href: '/hoc-vien/lich-su-hoc', label: 'Lịch sử học', icon: 'history' },
  { href: '/hoc-vien/danh-gia-11d', label: 'Đánh giá 11D', icon: 'compass' },
  { href: '/ai-mentor', label: 'AI Mentor', icon: 'sparkles' },
  { href: '/hoc-vien/thanh-tich', label: 'Thành tích', icon: 'trophy' },
  { href: '/cong-dong', label: 'Cộng đồng', icon: 'users' },
  { href: '/hoc-vien/lich-su', label: 'Lịch hẹn của tôi', icon: 'calendar' },
  { href: '/hoc-vien/don-hang', label: 'Đơn hàng', icon: 'receipt' },
  { href: '/hoc-vien/vi', label: 'Ví & tiếp thị liên kết', icon: 'wallet' },
  { href: '/hoc-vien/ho-so', label: 'Thông tin cá nhân', icon: 'user' },
  { href: '/hoc-vien/doi-mat-khau', label: 'Đổi mật khẩu', icon: 'key' },
] as const;

/** Muc Quan tri — chi admin, chen sau "Doi mat khau", truoc "Dang xuat". */
export const ADMIN_MENU_ITEM = { href: '/admin', label: 'Quản trị', icon: 'shield' } as const;

export type AccountMenuItem = (typeof ACCOUNT_MENU_ITEMS)[number] | typeof ADMIN_MENU_ITEM;

/**
 * Menu hien cho 1 role. role lay tu profiles.role (getMyProfileState)
 * — admin moi thay muc Quan tri; hoc vien / chua ro role thi khong.
 */
export function visibleAccountMenuItems(role: string | null | undefined): AccountMenuItem[] {
  const items: AccountMenuItem[] = [...ACCOUNT_MENU_ITEMS];
  if (role === 'admin') items.push(ADMIN_MENU_ITEM);
  return items;
}
