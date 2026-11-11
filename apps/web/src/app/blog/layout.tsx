// Metadata cap muc — Prompt 15 (trang danh sach la client component;
// trang chi tiet /blog/[slug] co generateMetadata rieng va ghi de).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Blog',
  description:
    'Mỗi bài đi thẳng vào khái niệm, hình trong đầu, trạng thái trong lòng. Đọc trước, cảm trước — rồi mới hành động.',
  path: '/blog',
});

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
