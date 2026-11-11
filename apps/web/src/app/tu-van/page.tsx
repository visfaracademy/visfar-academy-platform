// Trang /tu-van — form tu van cua trang hien tai, chuyen sang Next.js.
// Van ban tieu de + lien he giu nguyen tu section #tu-van trong file goc.
import { Suspense } from 'react';
import ConsultationForm from '@/components/ConsultationForm';

export const metadata = {
  title: 'Đăng ký tư vấn — Visfar Academy',
  description:
    'Để lại thông tin, Visfar Academy liên hệ, cùng tìm điểm bắt đầu phù hợp: từ Biết tới Chuyển hóa, theo thứ tự Tâm thức, Trí tuệ, Nhân hiệu.',
  alternates: { canonical: '/tu-van' },
  openGraph: {
    type: 'website',
    url: 'https://visfaracademy.pages.dev/tu-van',
    siteName: 'Visfar Academy',
    title: 'Đăng ký tư vấn — Visfar Academy',
    description:
      'Để lại thông tin, Visfar Academy liên hệ, cùng tìm điểm bắt đầu phù hợp: từ Biết tới Chuyển hóa, theo thứ tự Tâm thức, Trí tuệ, Nhân hiệu.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Đăng ký tư vấn — Visfar Academy',
    description:
      'Để lại thông tin, Visfar Academy liên hệ, cùng tìm điểm bắt đầu phù hợp: từ Biết tới Chuyển hóa, theo thứ tự Tâm thức, Trí tuệ, Nhân hiệu.',
  },
};

export default function TuVanPage() {
  return (
    <div className="wrap">
      <section aria-labelledby="formTitle">
        <p className="muted">Đăng ký và kết nối</p>
        <h1 id="formTitle" className="gold-title">
          Đăng ký tham gia
        </h1>
        <p className="lead">
          Để lại thông tin, Visfar Academy liên hệ, cùng tìm điểm bắt đầu phù hợp: từ Biết tới
          Chuyển hóa, theo thứ tự Tâm thức, Trí tuệ, Nhân hiệu. Năm ô thông tin.
        </p>
        <p>
          <a href="tel:+84347897868">
            <b>Điện thoại</b> 034 7897 868
          </a>{' '}
          ·{' '}
          <a href="mailto:visfaracademy@gmail.com">
            <b>Email</b> visfaracademy@gmail.com
          </a>
        </p>
        <p>
          Nói thẳng: không có đường tắt thay cho huân tập từ gốc. Visfar cho khung, phương pháp,
          sự đồng hành. Đổi hay không, ở việc rõ khái niệm, rõ hình, giữ trạng thái trong lòng
          đều đặn.
        </p>
        <Suspense fallback={<p role="status">Đang tải form đăng ký…</p>}>
          <ConsultationForm />
        </Suspense>
      </section>
    </div>
  );
}
