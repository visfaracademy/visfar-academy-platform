// Metadata cap muc — Prompt 15 (trang tra cuu la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Tra cứu chứng chỉ',
  description: 'Tra cứu chứng chỉ hoàn thành khóa học của Visfar Academy bằng mã chứng chỉ.',
  path: '/chung-chi/tra-cuu',
});

export default function ChungChiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
