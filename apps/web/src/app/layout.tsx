import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Analytics from '@/components/analytics/Analytics';
import '@/styles/globals.css';
import '@/styles/post-auth.css';

// Be Vietnam Pro tu host — 12 face woff2 tach tu file HTML goc
// (public/fonts/, font-display:swap). Khong dung Google Fonts/CDN.
const beVietnamPro = localFont({
  src: [
    { path: '../../public/fonts/be-vietnam-pro-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/be-vietnam-pro-400-italic.woff2', weight: '400', style: 'italic' },
    { path: '../../public/fonts/be-vietnam-pro-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/be-vietnam-pro-500-italic.woff2', weight: '500', style: 'italic' },
    { path: '../../public/fonts/be-vietnam-pro-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/be-vietnam-pro-600-italic.woff2', weight: '600', style: 'italic' },
    { path: '../../public/fonts/be-vietnam-pro-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/be-vietnam-pro-700-italic.woff2', weight: '700', style: 'italic' },
    { path: '../../public/fonts/be-vietnam-pro-800-normal.woff2', weight: '800', style: 'normal' },
    { path: '../../public/fonts/be-vietnam-pro-800-italic.woff2', weight: '800', style: 'italic' },
    { path: '../../public/fonts/be-vietnam-pro-900-normal.woff2', weight: '900', style: 'normal' },
    { path: '../../public/fonts/be-vietnam-pro-900-italic.woff2', weight: '900', style: 'italic' },
  ],
  variable: '--font-bvp',
  display: 'swap',
});

const SITE_URL = 'https://visfaracademy.pages.dev';

export const metadata: Metadata = {
  title:
    'Visfar Academy — Khai mở tâm thức • Tu dưỡng đạo đức • Phát triển trí tuệ • Hoàn thiện con người • Kiến tạo thịnh vượng',
  description:
    'Visfar Academy là nền tảng chia sẻ tư duy theo triết lý giáo dục tận gốc — phát triển Tâm thức, Trí tuệ và Nhân hiệu từ gốc nhận thức.',
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Visfar Academy',
    title: 'Visfar Academy — Khai mở tâm thức • Tu dưỡng đạo đức • Phát triển trí tuệ • Hoàn thiện con người • Kiến tạo thịnh vượng',
    description:
      'Visfar Academy là nền tảng chia sẻ tư duy theo triết lý giáo dục tận gốc — phát triển Tâm thức, Trí tuệ và Nhân hiệu từ gốc nhận thức.',
    images: [{ url: '/images/hero-group.jpg', width: 1334, height: 889, alt: 'Thành viên và học viên Visfar Academy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Visfar Academy',
    description:
      'Visfar Academy là nền tảng chia sẻ tư duy theo triết lý giáo dục tận gốc — phát triển Tâm thức, Trí tuệ và Nhân hiệu từ gốc nhận thức.',
    images: ['/images/hero-group.jpg'],
  },
  robots: { index: true, follow: true },
};

const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Visfar Academy',
  url: SITE_URL,
  email: 'visfaracademy@gmail.com',
  telephone: '+84347897868',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body>
        <a className="skip-link" href="#main-content">
          Bỏ qua tới nội dung chính
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        {/* GA4 + Meta Pixel: chi chay khi co ID that trong env (xem
            src/components/analytics/Analytics.tsx); chua co ID thi khong
            render script nao. */}
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
      </body>
    </html>
  );
}
