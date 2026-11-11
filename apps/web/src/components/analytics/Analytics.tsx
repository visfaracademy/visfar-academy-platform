// GA4 + Meta Pixel — Prompt 15 (GĐ2, 11/11/2026).
// CHI kich hoat khi co ID that trong env (xem src/lib/analytics.ts).
// Chua co ID nao: component tra null, khong tai script tracking nao.
'use client';

import Script from 'next/script';
import { getAnalyticsConfig } from '@/lib/analytics';

export default function Analytics() {
  const config = getAnalyticsConfig({
    ga4: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  });
  if (!config.ga4Id && !config.pixelId) return null;
  return (
    <>
      {config.ga4Id ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${config.ga4Id}');`}
          </Script>
        </>
      ) : null}
      {config.pixelId ? (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${config.pixelId}');fbq('track', 'PageView');`}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${config.pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      ) : null}
    </>
  );
}
