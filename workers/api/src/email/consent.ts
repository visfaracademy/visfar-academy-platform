// Quyen nhan tin (consent) — TASK 11.
//
// Quy tac (API_ARCHITECTURE.md §8.1/§10.2, DECISIONS.md QĐ 14):
//   - Email MARKETING va CARE: CHI gui khi nguoi nhan khong bi chan.
//   - Email TRANSACTIONAL (don hang, dat lai mat khau, thong bao he
//     thong): luon duoc gui, khong co unsubscribe, nhung VAN ghi log.
//   - Bi chan = da huy dang ky (status 'unsubscribed') HOAC hard bounce
//     (hard_bounced_at != null) HOAC khieu nai spam (ly do 'spam_complaint').
//
// Ngu nghia suppression-list: bang newsletter_subscribers la DANH SACH
// CHAN (opt-out), khong phai danh sach cho phep (opt-in). Email CHUA CO
// dong nao trong bang -> khong bi chan (duoc gui). Ly do: email care
// (nhac hoc, nhac su kien) gui cho hoc vien da ghi danh — ho khong
// nhat thiet co dong newsletter; chan ho chi vi "chua dang ky
// newsletter" se lam vo luong care. Marketing campaign thi phai
// TU lay danh sach tu dong status='subscribed' (tang campaign, ngoai
// pham vi module nay); ham nay la lop chan cuoi truoc khi gui.

export type EmailKind = 'marketing' | 'care' | 'transactional';

/** Email marketing/care can kiem tra quyen nhan tin; transactional thi khong. */
export function requiresConsent(kind: EmailKind): boolean {
  return kind === 'marketing' || kind === 'care';
}

/** 1 dong newsletter_subscribers (chi cac cot module nay dung). */
export interface SubscriberRow {
  email: string;
  status: string;
  unsubscribed_at: string | null;
  unsubscribe_reason: string | null;
  hard_bounced_at: string | null;
}

export type SuppressionReason = 'unsubscribed' | 'hard_bounced' | 'spam_complaint';

export interface ConsentCheck {
  allowed: boolean;
  /** Ly do bi chan (neu allowed = false). */
  reason?: SuppressionReason;
}

/** Kiem tra 1 email co duoc nhan marketing/care khong. */
export function checkMarketingConsent(subscriber: SubscriberRow | null): ConsentCheck {
  if (!subscriber) return { allowed: true };
  if (subscriber.unsubscribe_reason === 'spam_complaint') {
    return { allowed: false, reason: 'spam_complaint' };
  }
  if (subscriber.hard_bounced_at) {
    return { allowed: false, reason: 'hard_bounced' };
  }
  if (subscriber.status === 'unsubscribed') {
    return { allowed: false, reason: 'unsubscribed' };
  }
  return { allowed: true };
}

/** Tien ich: email co dang bi chan gui marketing khong. */
export function isSuppressed(subscriber: SubscriberRow | null): boolean {
  return !checkMarketingConsent(subscriber).allowed;
}

/** Cat ly do huy dang ky ve toi da 500 ky tu (validation o tang API). */
export function normalizeUnsubscribeReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}
