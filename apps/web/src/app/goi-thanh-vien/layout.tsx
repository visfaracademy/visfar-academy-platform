// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Gói thành viên',
  description:
    'Thành viên Visfar Academy học trọn bộ chương trình theo gói — một lần đăng ký, học xuyên suốt thời hạn gói.',
  path: '/goi-thanh-vien',
});

export default function GoiThanhVienLayout({ children }: { children: React.ReactNode }) {
  return children;
}
