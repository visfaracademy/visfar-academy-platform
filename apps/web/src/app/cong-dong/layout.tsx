// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Cộng đồng VISFAR',
  description:
    'Cộng đồng học tập suốt đời của Visfar Academy — nơi học viên hỏi đáp, chia sẻ bài học và thành tích cùng nhau.',
  path: '/cong-dong',
});

export default function CongDongLayout({ children }: { children: React.ReactNode }) {
  return children;
}
