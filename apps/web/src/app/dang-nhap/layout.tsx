// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Đăng nhập',
  description: 'Đăng nhập vào tài khoản học viên Visfar Academy để tiếp tục học.',
  path: '/dang-nhap',
});

export default function DangNhapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
