import { describe, expect, it } from 'vitest';
import { getAnalyticsConfig, isAnalyticsEnabled } from './analytics';

describe('getAnalyticsConfig', () => {
  it('khong co ID -> {} (khong tracking gia)', () => {
    expect(getAnalyticsConfig({})).toEqual({});
    expect(getAnalyticsConfig({ ga4: '', pixel: '' })).toEqual({});
    expect(isAnalyticsEnabled(getAnalyticsConfig({}))).toBe(false);
  });
  it('chi nhan GA4 dang G-... va Pixel chi so', () => {
    expect(getAnalyticsConfig({ ga4: 'G-ABC1234567', pixel: '123456789012345' })).toEqual({
      ga4Id: 'G-ABC1234567',
      pixelId: '123456789012345',
    });
  });
  it('ID sai dinh dang bi loai, ID dung giu lai', () => {
    expect(getAnalyticsConfig({ ga4: 'UA-123', pixel: 'abc' })).toEqual({});
    expect(getAnalyticsConfig({ ga4: 'G-ABC1234567', pixel: 'abc' })).toEqual({
      ga4Id: 'G-ABC1234567',
    });
  });
});
