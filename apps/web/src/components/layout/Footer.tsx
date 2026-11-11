// Footer — luoi 5 cot giong file HTML goc + khoi gioi thieu toan chieu rong
// + dong "Cong dong: Cong dong VISFAR" + dai newsletter + thanh Copyright.
// Giu NewsletterForm THAT (E04) va thong tin lien he/disclaimer goc.
// Link chinh sach toi route that /chinh-sach/* (thay cho hash view goc).
import Image from 'next/image';
import Link from 'next/link';
import NewsletterForm from '@/components/NewsletterForm';
import {
  FOOTER_ABOUT_LINKS,
  FOOTER_COURSE_LINKS,
  FOOTER_SUPPORT_LINKS,
} from '@/lib/homepage-data';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link href="/" aria-label="Visfar Academy — Trang chủ">
              <Image
                src="/images/logo.png"
                alt="Logo Visfar Academy"
                width={2411}
                height={2411}
                loading="lazy"
              />
            </Link>
            <p className="foot-slogan">Hiểu mình, sáng trí, dựng hiệu.</p>
          </div>
          <nav aria-label="Về Visfar Academy">
            <h4>Về Visfar Academy</h4>
            <ul>
              {FOOTER_ABOUT_LINKS.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Khóa học">
            <h4>Khóa học</h4>
            <ul>
              {FOOTER_COURSE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Hỗ trợ">
            <h4>Hỗ trợ</h4>
            <ul>
              {FOOTER_SUPPORT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="foot-contact">
            <h4>Liên hệ</h4>
            <ul>
              <li>Tổ chức đào tạo Visfar Academy</li>
              <li>
                Điện thoại: <a href="tel:+84347897868">034 7897 868</a>
              </li>
              <li>
                Email: <a href="mailto:visfaracademy@gmail.com">visfaracademy@gmail.com</a>
              </li>
              <li>
                Zalo hỗ trợ:{' '}
                <a href="https://zalo.me/0347897868/" target="_blank" rel="noopener">
                  zalo.me/0347897868
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="foot-intro">
          <p>
            Visfar Academy là nền tảng chia sẻ tư duy theo triết lý giáo dục tận gốc — phát triển
            Tâm thức, Trí tuệ và Nhân hiệu từ gốc nhận thức, để cá nhân và doanh nghiệp nâng tầm
            nhận thức, thấu suốt nhân sinh, nhìn rộng thế giới và sống, làm việc có giá trị hơn.
          </p>
          <p className="muted foot-disclaimer">
            Thông tin chỉ dùng để liên hệ tư vấn. Không có khóa học “làm giàu nhanh”, kết quả phụ
            thuộc vào hành động của học viên.
          </p>
          <p>
            Cộng đồng: <strong>Cộng đồng VISFAR</strong>
          </p>
        </div>

        <div className="foot-news">
          <p>
            <strong>Đăng ký nhận thông tin từ Visfar Academy</strong>
          </p>
          <p className="muted">Bài viết, hoạt động và chương trình mới.</p>
          <NewsletterForm />
        </div>

        <div className="foot-bottom">
          <p className="muted">Copyright 2026 © Visfar Academy.</p>
          <a className="to-top" href="#trang-chu" aria-label="Về đầu trang">
            ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
