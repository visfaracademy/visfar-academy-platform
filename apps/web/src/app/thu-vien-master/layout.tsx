// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Thư viện Master',
  description:
    'Những khái niệm nguồn làm rõ hình, rõ khái niệm, rõ trạng thái — để mỗi người thấu suốt từ gốc rồi mới hành động.',
  path: '/thu-vien-master',
});

export default function ThuVienLayout({ children }: { children: React.ReactNode }) {
  return children;
}
