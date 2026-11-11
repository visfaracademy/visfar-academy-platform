// Analytics gating — Prompt 15 (GĐ2, 11/11/2026).
// GA4 + Meta Pixel CHI chay khi co ID that trong env:
//   NEXT_PUBLIC_GA4_MEASUREMENT_ID (dang G-XXXXXXXXXX)
//   NEXT_PUBLIC_META_PIXEL_ID (chi so)
// Hien tai ca hai deu CHUA co — getAnalyticsConfig tra {} va component
// Analytics khong render bat ky script tracking nao (khong tracking gia,
// khong ID gia). ID khong hop le cung bi loai.
export interface AnalyticsConfig {
  ga4Id?: string;
  pixelId?: string;
}

export function getAnalyticsConfig(env: {
  ga4?: string | undefined;
  pixel?: string | undefined;
}): AnalyticsConfig {
  const out: AnalyticsConfig = {};
  const ga4 = (env.ga4 ?? '').trim();
  if (/^G-[A-Z0-9]{4,}$/.test(ga4)) out.ga4Id = ga4;
  const pixel = (env.pixel ?? '').trim();
  if (/^\d{6,}$/.test(pixel)) out.pixelId = pixel;
  return out;
}

export function isAnalyticsEnabled(config: AnalyticsConfig): boolean {
  return Boolean(config.ga4Id || config.pixelId);
}
