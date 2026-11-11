// Sitemap — SEO co ban (GĐ2, 11/11/2026).
// Chi liet ke route CONG KHAI CO THAT (tra 200 cho crawler chua dang
// nhap). Khong dua /su-kien (chi la neo /#su-kien tren trang chu,
// khong co route rieng), khong dua /hoc-vien/* va /admin/* (can dang
// nhap, tra 307 cho khach — da chan trong robots.ts), khong dua
// /cong-dong va /ai-mentor (noi dung chinh can dang nhap, khach chi
// thay loi moi dang nhap). Bo sung GĐ2 Prompt 15: /danh-gia-11d va
// /chung-chi/tra-cuu (cong khai, 200) — tong 27 URL.
// Slug khoa hoc (10) lay tu seed 0002; slug blog (3) lay tu
// BLOG_POSTS (homepage-data.ts); slug chinh sach (4) lay tu seed 0003.
import type { MetadataRoute } from 'next';

const SITE_URL = 'https://visfaracademy.pages.dev';

const COURSE_SLUGS = [
  'thau-hieu-noi-tam',
  'thau-hieu-tam-thuc',
  'thau-hieu-tri-tue',
  'thau-hieu-suc-khoe',
  'thau-hieu-moi-quan-he',
  'thau-hieu-tai-chinh',
  'chuyen-gia-tu-van',
  'master-tam-thuc-nhan-hieu',
  'coaching-90-ngay',
  'cong-dong-visfar',
];

const BLOG_SLUGS = [
  'ro-hinh-la-ra-qua',
  'nhan-tot-duyen-lanh-qua-nhu-y',
  'ngoi-nha-visfar-11-phuong-dien-trong-1-can-phong',
];

const POLICY_SLUGS = [
  'bao-mat',
  'dieu-khoan-tham-gia',
  'hoan-tra-huy-dang-ky',
  'giai-quyet-khieu-nai',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-11-11T00:00:00+07:00');
  const url = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });
  return [
    url('/', 1, 'weekly'),
    url('/chuong-trinh', 0.9, 'weekly'),
    ...COURSE_SLUGS.map((slug) => url(`/chuong-trinh/${slug}`, 0.8, 'monthly')),
    url('/thu-vien-master', 0.8, 'weekly'),
    url('/blog', 0.7, 'weekly'),
    ...BLOG_SLUGS.map((slug) => url(`/blog/${slug}`, 0.6, 'monthly')),
    ...POLICY_SLUGS.map((slug) => url(`/chinh-sach/${slug}`, 0.5, 'yearly')),
    url('/tu-van', 0.7, 'monthly'),
    url('/goi-thanh-vien', 0.6, 'monthly'),
    url('/danh-gia-11d', 0.6, 'monthly'),
    url('/chung-chi/tra-cuu', 0.5, 'yearly'),
    url('/dang-nhap', 0.3, 'yearly'),
    url('/dang-ky', 0.3, 'yearly'),
  ];
}
