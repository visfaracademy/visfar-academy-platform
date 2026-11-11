import type { NextConfig } from 'next';

// CSP (S-04, GĐ2 11/11/2026) — cho phep dung nhung gi trang that su
// dung, chan con lai:
//  - YouTube: iframe_api (script) + embed youtube-nocookie (frame).
//  - Supabase: REST/Realtime (connect) — Auth + DB.
//  - Worker API: https://api.visfaracademy.workers.dev (connect).
//  - Font self-hosted (public/fonts) — khong Google Fonts/CDN.
//  - Zalo chi la link <a href> (dieu huong) nen khong can chi thi CSP.
//  - GA4 + Meta Pixel (Prompt 15, GĐ2): chi cho phep domain khi co ID
//    that trong env; khi chua co ID, component Analytics khong render
//    script nao nen cac cho phep nay khong kich hoat tracking.
//  - 'unsafe-inline' script/style: Next.js can de chay inline script
//    va style runtime; 'unsafe-eval' cho webpack runtime. Nang cap
//    len nonce-based CSP la follow-up (chua lam o dot nay).
// HSTS: chi header, khong preload (tranh khoa vinh vien subdomain
// pages.dev). X-Frame-Options giu kem CSP frame-ancestors.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.visfaracademy.workers.dev https://www.google-analytics.com https://region1.google-analytics.com https://www.facebook.com",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  // Deploy len Cloudflare Pages qua @cloudflare/next-on-pages
  // (lenh `npm run pages:build`). Khong dung `output: 'export'` vi
  // can route dong /api/health va trang khoa hoc doc Supabase.
  reactStrictMode: true,
  images: {
    // Anh se nam o Supabase Storage / R2 o module sau; tam chi cho
    // remote pattern cua Supabase (se dien domain that khi co project).
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
