// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'AI Mentor',
  description:
    'Trợ lý học tập của Visfar Academy — trả lời dựa trên Thư viện Master, mô tả khóa học và triết lý Giáo dục Tận Gốc đã được phê duyệt.',
  path: '/ai-mentor',
});

export default function AiMentorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
