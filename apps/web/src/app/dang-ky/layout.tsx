// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Đăng ký',
  description: 'Tạo tài khoản học viên Visfar Academy để bắt đầu hành trình học tập.',
  path: '/dang-ky',
});

export default function DangKyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
