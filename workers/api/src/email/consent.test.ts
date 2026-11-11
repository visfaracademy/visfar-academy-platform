// Test quyen nhan tin (consent) — thuan, khong can DB.
import { describe, expect, it } from 'vitest';
import {
  checkMarketingConsent,
  isSuppressed,
  normalizeUnsubscribeReason,
  requiresConsent,
  type SubscriberRow,
} from './consent';

function sub(overrides: Partial<SubscriberRow> = {}): SubscriberRow {
  return {
    email: 'a@example.com',
    status: 'subscribed',
    unsubscribed_at: null,
    unsubscribe_reason: null,
    hard_bounced_at: null,
    ...overrides,
  };
}

describe('requiresConsent', () => {
  it('marketing + care can kiem tra; transactional khong', () => {
    expect(requiresConsent('marketing')).toBe(true);
    expect(requiresConsent('care')).toBe(true);
    expect(requiresConsent('transactional')).toBe(false);
  });
});

describe('checkMarketingConsent', () => {
  it('chua co dong subscriber: duoc gui (suppression-list, khong phai opt-in list)', () => {
    expect(checkMarketingConsent(null)).toEqual({ allowed: true });
  });

  it('dang subscribed, khong bounce: duoc gui', () => {
    expect(checkMarketingConsent(sub())).toEqual({ allowed: true });
  });

  it('da unsubscribed: chan, ly do unsubscribed', () => {
    expect(
      checkMarketingConsent(sub({ status: 'unsubscribed', unsubscribed_at: '2026-11-10T00:00:00Z' })),
    ).toEqual({ allowed: false, reason: 'unsubscribed' });
  });

  it('hard bounce: chan ngay ca khi status van subscribed', () => {
    expect(checkMarketingConsent(sub({ hard_bounced_at: '2026-11-10T00:00:00Z' }))).toEqual({
      allowed: false,
      reason: 'hard_bounced',
    });
  });

  it('spam complaint: chan, ly do spam_complaint', () => {
    expect(
      checkMarketingConsent(
        sub({ status: 'unsubscribed', unsubscribe_reason: 'spam_complaint' }),
      ),
    ).toEqual({ allowed: false, reason: 'spam_complaint' });
  });

  it('isSuppressed dong nhat voi checkMarketingConsent', () => {
    expect(isSuppressed(null)).toBe(false);
    expect(isSuppressed(sub())).toBe(false);
    expect(isSuppressed(sub({ status: 'unsubscribed' }))).toBe(true);
  });
});

describe('normalizeUnsubscribeReason', () => {
  it('trim + cat 500 ky tu', () => {
    expect(normalizeUnsubscribeReason('  nhieu email qua  ')).toBe('nhieu email qua');
    expect(normalizeUnsubscribeReason('x'.repeat(600))?.length).toBe(500);
  });

  it('rong / khong phai chuoi: null', () => {
    expect(normalizeUnsubscribeReason('   ')).toBeNull();
    expect(normalizeUnsubscribeReason(null)).toBeNull();
    expect(normalizeUnsubscribeReason(123)).toBeNull();
  });
});
