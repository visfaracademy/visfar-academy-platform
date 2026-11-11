// Robots — SEO co ban (GĐ2, 11/11/2026).
// Chan crawler khoi khu vuc can dang nhap (/hoc-vien, /admin), API
// va auth callback; cac trang cong khai khac duoc phep.
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/hoc-vien/', '/auth/', '/thanh-toan/'],
      },
    ],
    sitemap: 'https://visfaracademy.pages.dev/sitemap.xml',
  };
}
