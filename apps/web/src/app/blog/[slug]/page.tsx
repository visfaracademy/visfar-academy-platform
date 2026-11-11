// Trang chi tiet bai blog — hien thi dung doan van da chot (bai hien chi
// co doan ngan), khong bia them noi dung dai.
export const runtime = 'edge';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug } from '@/lib/blog';
import Breadcrumb from '@/components/seo/Breadcrumb';
import { breadcrumbJsonLd, SITE_URL } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Visfar Academy`,
    description: post.body,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/blog/${slug}`,
      siteName: 'Visfar Academy',
      title: `${post.title} — Visfar Academy`,
      description: post.body,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} — Visfar Academy`,
      description: post.body,
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="blog-page">
      <div className="wrap">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: post.title },
          ]}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              breadcrumbJsonLd([
                { name: 'Trang chủ', path: '/' },
                { name: 'Blog', path: '/blog' },
                { name: post.title },
              ]),
            ),
          }}
        />
        <p className="chapter">{post.pillar}</p>
        <h1 className="gold-title">{post.title}</h1>
        <p className="meta">{post.meta}</p>
        <article className="card blog-article">
          <p>{post.body}</p>
        </article>
        <p>
          <Link href="/blog">← Quay lại Blog</Link>
          {' · '}
          <Link href="/#tu-van">Nhận tư vấn →</Link>
        </p>
      </div>
    </main>
  );
}
