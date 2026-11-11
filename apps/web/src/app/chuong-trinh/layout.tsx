// Metadata cap muc — Prompt 15. Trang danh sach + chi tiet deu la
// client component nen khong export metadata tu page; metadata cap muc
// (server) la cach duy nhat khong doi cau truc trang. Han che: trang
// chi tiet 1 khoa dung chung title/description cap muc (khong co title
// rieng theo khoa); JSON-LD Course rieng (du lieu DB) duoc them trong
// trang chi tiet khi khoa da tai xong (xem chuong-trinh/[slug]/page.tsx)
// — script do chi co sau khi JS chay, khong co trong HTML tinh.
// JSON-LD ItemList 10 khoa (du lieu tinh HOME_COURSES) dat o day de co
// mat trong HTML tinh ngay tu dau; no hien ca tren trang chi tiet
// (cung cap /chuong-trinh/*) vi layout bao ca hai — chap nhan duoc vi
// ItemList mo ta dung danh muc khoa hoc cua site.
import type { Metadata } from 'next';
import { courseListJsonLd, publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'Mười chương trình',
  description:
    'Từ thấu hiểu bản thân đến phát triển trí tuệ, kiến tạo nhân hiệu và làm chủ cuộc sống. VISFAR thiết kế hệ thống chương trình theo từng cấp độ.',
  path: '/chuong-trinh',
});

export default function ChuongTrinhLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseListJsonLd()) }}
      />
      {children}
    </>
  );
}
