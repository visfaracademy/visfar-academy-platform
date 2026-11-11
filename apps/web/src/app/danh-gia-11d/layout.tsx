// Metadata cap muc — Prompt 15 (trang la client component).
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Đánh giá 11 phương diện',
  description:
    'Bài tự đánh giá đầu vào gồm 33 câu hỏi — 3 câu cho mỗi phương diện trong hệ Thập Nhất Viên Mãn. Công cụ tự đánh giá tham khảo, không thay thế chẩn đoán chuyên môn.',
  path: '/danh-gia-11d',
});

export default function DanhGia11dLayout({ children }: { children: React.ReactNode }) {
  return children;
}
