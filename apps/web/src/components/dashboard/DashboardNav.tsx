// Nav dung chung cho /hoc-vien/* — Task 06.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/hoc-vien', label: 'Tổng quan' },
  { href: '/hoc-vien/ho-so', label: 'Hồ sơ' },
  { href: '/hoc-vien/khoa-hoc', label: 'Khóa học' },
  { href: '/hoc-vien/lich-su', label: 'Lịch hẹn' },
  { href: '/hoc-vien/lich-su-hoc', label: 'Lịch sử học' },
  { href: '/hoc-vien/danh-gia-11d', label: 'Đánh giá 11D' },
  { href: '/ai-mentor', label: 'AI Mentor' },
  { href: '/hoc-vien/thanh-tich', label: 'Thành tích' },
  { href: '/hoc-vien/vi', label: 'Ví & giới thiệu' },
  { href: '/hoc-vien/thong-bao', label: 'Thông báo' },
  { href: '/hoc-vien/chung-chi', label: 'Chứng chỉ' },
  { href: '/hoc-vien/don-hang', label: 'Đơn hàng' },
  { href: '/hoc-vien/giao-dich', label: 'Giao dịch' },
];

export default function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="dashboard-nav" aria-label="Dashboard học viên">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
