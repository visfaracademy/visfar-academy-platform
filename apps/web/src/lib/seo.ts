// SEO helpers — Prompt 15 (GĐ2, 11/11/2026).
// Chi dung du lieu that da co trong repo (HOME_COURSES / FAQS / BLOG_POSTS).
// Khong tu tao gia, khong them noi dung SEO moi: offers (gia) CO Y khong
// dua vao JSON-LD Course vi gia khoa hien la "Tuy tam / 0đ" (QĐ 11 Task 03)
// — gia that do user cung cap sau.
import type { Metadata } from 'next';
import { FAQS, HOME_COURSES } from './homepage-data';

export const SITE_URL = 'https://visfaracademy.pages.dev';

export function publicPageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title: `${title} — Visfar Academy`,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Visfar Academy',
      title: `${title} — Visfar Academy`,
      description,
      images: image ? [{ url: image, alt: title }] : [{ url: '/images/hero-group.jpg', width: 1334, height: 889, alt: 'Thành viên và học viên Visfar Academy' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Visfar Academy`,
      description,
      images: [image ?? '/images/hero-group.jpg'],
    },
  };
}

export interface CourseJsonLdInput {
  slug: string;
  title: string;
  description: string;
}

export function courseJsonLd({ slug, title, description }: CourseJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: title,
    description,
    url: `${SITE_URL}/chuong-trinh/${slug}`,
    inLanguage: 'vi',
    provider: {
      '@type': 'Organization',
      name: 'Visfar Academy',
      url: SITE_URL,
    },
  };
}

// Danh sach 10 khoa that tren trang chu (HOME_COURSES) — dung cho
// ItemList tren /chuong-trinh. Khong lay tu DB o day de giu JSON-LD
// tinh, co mat ngay trong HTML lan dau (client page khong co metadata).
export function courseListJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Mười chương trình — Visfar Academy',
    itemListElement: HOME_COURSES.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: courseJsonLd({ slug: c.slug, title: c.title, description: c.description }),
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: `${SITE_URL}${it.path}` } : {}),
    })),
  };
}

// FAQ that tren trang chu (9 cau FAQS) — dung nguyen van, khong viet them.
export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
