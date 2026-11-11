// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Đặt lại mật khẩu',
  description: 'Đặt lại mật khẩu tài khoản học viên Visfar Academy.',
  path: '/dat-lai-mat-khau',
});

export default function DatLaiMatKhauLayout({ children }: { children: React.ReactNode }) {
  return children;
}
