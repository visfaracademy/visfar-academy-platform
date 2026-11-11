// Trang chinh sach — route that /chinh-sach/<slug>, thay cho hash view
// #policyView trong file HTML goc. Noi dung NGUYEN VAN tu file goc
// (src/lib/policies.ts). Khoi lien he cuoi moi bai gop chung 1 mau.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { POLICIES } from '@/lib/policies';
import Breadcrumb from '@/components/seo/Breadcrumb';

export const runtime = 'edge';

// Khong dung generateStaticParams: xung dot voi runtime edge;
// 4 slug render theo yeu cau tren edge.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES.find((p) => p.slug === slug);
  if (!policy) return {};
  return {
    title: `${policy.title} — Visfar Academy`,
    description: policy.lead,
    alternates: { canonical: `/chinh-sach/${slug}` },
    openGraph: {
      type: 'website',
      url: `https://visfaracademy.pages.dev/chinh-sach/${slug}`,
      siteName: 'Visfar Academy',
      title: `${policy.title} — Visfar Academy`,
      description: policy.lead,
    },
  };
}

const OTHER_TITLES: Record<string, string> = {
  'bao-mat': 'Chính sách bảo mật',
  'dieu-khoan-tham-gia': 'Điều khoản tham gia',
  'hoan-tra-huy-dang-ky': 'Chính sách hoàn trả / hủy đăng ký',
  'giai-quyet-khieu-nai': 'Giải quyết khiếu nại',
};

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES.find((p) => p.slug === slug);
  if (!policy) notFound();
  const others = POLICIES.filter((p) => p.slug !== slug);

  return (
    <div className="wrap">
      <Breadcrumb
        items={[
          { label: 'Trang chủ', href: '/' },
          { label: policy.title },
        ]}
      />
      <article className="policy-article">
        <p className="chapter">Visfar Academy</p>
        <h1 className="gold-title">{policy.title}</h1>
        <p className="policy-meta">{policy.meta}</p>
        <p className="lead">{policy.lead}</p>
        <div className="policy-body">
          {policy.blocks.map((b, i) => {
            if (b.type === 'h2') return <h2 key={i} className="gold-title">{b.text}</h2>;
            if (b.type === 'h3') return <h3 key={i}>{b.text}</h3>;
            if (b.type === 'p') return <p key={i}>{b.text}</p>;
            if (b.type === 'ul')
              return (
                <ul key={i}>
                  {b.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            return (
              <ol key={i}>
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          })}
        </div>
        <div className="policy-contact">
          <h2 className="gold-title">Liên hệ</h2>
          <p>
            Tổ chức đào tạo Visfar Academy
            <br />
            Điện thoại: <a href="tel:+84347897868">034 7897 868</a> · Email:{' '}
            <a href="mailto:visfaracademy@gmail.com">visfaracademy@gmail.com</a> · Zalo hỗ trợ:{' '}
            <a href="https://zalo.me/0347897868/" target="_blank" rel="noopener">
              zalo.me/0347897868
            </a>
          </p>
        </div>
        <nav className="policy-nav" aria-label="Các chính sách khác">
          {others.map((o) => (
            <Link key={o.slug} href={`/chinh-sach/${o.slug}`}>
              {OTHER_TITLES[o.slug] ?? o.title}
            </Link>
          ))}
          <Link href="/#trang-chu">Quay lại trang chính</Link>
          <Link href="/tu-van">Đăng ký tư vấn</Link>
        </nav>
      </article>
    </div>
  );
}
