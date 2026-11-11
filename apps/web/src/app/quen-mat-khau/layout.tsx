// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Quên mật khẩu',
  description: 'Đặt lại mật khẩu tài khoản học viên Visfar Academy.',
  path: '/quen-mat-khau',
});

export default function QuenMatKhauLayout({ children }: { children: React.ReactNode }) {
  return children;
}
