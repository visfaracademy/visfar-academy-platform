// CONTRACT TEST — Payment & Commerce, TASK 10 (Workers API).
// ============================================================
// File nay DINH NGHIA hop dong cho phan Task 10 CHUA CO code,
// theo API_ARCHITECTURE.md §4 (idempotency) + §10.1 (webhook SePay:
// kiem tra so tien, chong trung, chi cap quyen khi da xac minh) +
// DECISIONS.md QD 9 (hoan tra 15 ngay lam viec / khieu nai 3 ngay)
// + Task 03 #13 (Idempotency-Key 24 gio).
//
// TRANG THAI: file nay se FAIL (Failed to resolve import — cac
// export duoi day chua ton tai trong ../src/sepay) cho toi khi
// builder giao them cac ham nay. Do la tin hieu DUNG — khong phai
// loi test. Khi code ve: chay `npm test` trong workers/api; neu
// builder dat logic o module khac (VD ../src/orders.ts), doi import
// o dau file cho dung vi tri that.
//
// Phan DA CO code (chu ky, parse payload, trich ma don) da co test
// that o test/sepay.test.ts — khong lap lai o day.
//
// Cac export hop dong (pure function, khong cham DB — de unit test):
//   IDEMPOTENCY_TTL_MS (= 24h)
//   decideIdempotencyReplay(existing, bodyHash) -> {action:'new'|'replay'|'conflict', result?}
//   isIdempotencyKeyExpired(createdAtMs, nowMs, ttlMs?) -> boolean
//   checkPaymentAmount(orderAmountVnd, paidAmountVnd) -> {ok:true} | {ok:false, error:'payment_mismatch', diffVnd}
//   findDuplicatePayment(payments, method, gatewayReference) -> payment | null
//   canGrantEnrollment({orderStatus, paymentStatus, verified}) -> boolean
//   shouldRevokeEnrollment(orderStatus) -> boolean
//   addWorkingDays(start, workingDays) -> Date
//   isRefundRequestInWindow(paidAt, requestedAt, workingDays?) -> boolean
//   complaintResponseDeadline(createdAt) -> Date
import { describe, expect, it } from 'vitest';
import {
  IDEMPOTENCY_TTL_MS,
  addWorkingDays,
  canGrantEnrollment,
  checkPaymentAmount,
  complaintResponseDeadline,
  decideIdempotencyReplay,
  findDuplicatePayment,
  isIdempotencyKeyExpired,
  isRefundRequestInWindow,
  shouldRevokeEnrollment,
} from '../src/sepay';

function utc(y: number, m: number, d: number, h = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h));
}

describe('idempotency — trung key tra ket qua cu, cung key khac body -> 409 (API_ARCHITECTURE §4)', () => {
  it('IDEMPOTENCY_TTL_MS = 24 gio (Task 03 #13)', () => {
    expect(IDEMPOTENCY_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('key moi (chua co) -> new', () => {
    expect(decideIdempotencyReplay(null, 'hash-body-A')).toEqual({ action: 'new' });
  });

  it('trung key + cung body -> replay, tra dung ket qua cu', () => {
    const stored = { referenceCode: 'DH-2026-000123' };
    expect(
      decideIdempotencyReplay({ bodyHash: 'hash-body-A', result: stored }, 'hash-body-A'),
    ).toEqual({ action: 'replay', result: stored });
  });

  it('trung key + khac body -> conflict (handler tra 409 idempotency_conflict, khong ghi)', () => {
    expect(
      decideIdempotencyReplay(
        { bodyHash: 'hash-body-A', result: { referenceCode: 'DH-2026-000123' } },
        'hash-body-B',
      ),
    ).toEqual({ action: 'conflict' });
  });

  it('key khac nhau -> doc lap (moi key la new)', () => {
    expect(decideIdempotencyReplay(null, 'hash-body-A')).toEqual({ action: 'new' });
    expect(decideIdempotencyReplay(null, 'hash-body-B')).toEqual({ action: 'new' });
  });

  it('het han 24h: trong TTL -> chua het; qua TTL -> het (handler xu ly lai nhu key moi)', () => {
    const created = Date.UTC(2026, 10, 10, 0, 0, 0);
    expect(isIdempotencyKeyExpired(created, created + IDEMPOTENCY_TTL_MS - 1)).toBe(false);
    expect(isIdempotencyKeyExpired(created, created + IDEMPOTENCY_TTL_MS)).toBe(false);
    expect(isIdempotencyKeyExpired(created, created + IDEMPOTENCY_TTL_MS + 1)).toBe(true);
    expect(isIdempotencyKeyExpired(created, created, 1000)).toBe(false);
    expect(isIdempotencyKeyExpired(created, created + 1001, 1000)).toBe(true);
  });
});

describe('kiem tra so tien — sai lech 0d moi duoc paid (API_ARCHITECTURE §10.1 buoc 3)', () => {
  it('khop dung (1.999.000d) -> ok', () => {
    expect(checkPaymentAmount(1999000, 1999000)).toEqual({ ok: true });
  });

  it('thieu 1d -> payment_mismatch, diff -1, KHONG doi don sang paid', () => {
    expect(checkPaymentAmount(1999000, 1999000 - 1)).toEqual({
      ok: false,
      error: 'payment_mismatch',
      diffVnd: -1,
    });
  });

  it('thua 1d -> payment_mismatch, diff +1', () => {
    expect(checkPaymentAmount(1999000, 1999000 + 1)).toEqual({
      ok: false,
      error: 'payment_mismatch',
      diffVnd: 1,
    });
  });

  it('thieu/thua lon van la mismatch (khong chap nhan lech mot phan)', () => {
    expect(checkPaymentAmount(1999000, 1000000).ok).toBe(false);
    expect(checkPaymentAmount(1999000, 2999000).ok).toBe(false);
  });

  it('chua chuyen (0d) vs don > 0d -> mismatch', () => {
    expect(checkPaymentAmount(1999000, 0)).toEqual({
      ok: false,
      error: 'payment_mismatch',
      diffVnd: -1999000,
    });
  });

  it('so tien am -> mismatch', () => {
    expect(checkPaymentAmount(1999000, -1000).ok).toBe(false);
  });

  it('don 0d (Tuy tam 0d / mien phi) vs paid 0d -> ok ve so tien', () => {
    expect(checkPaymentAmount(0, 0)).toEqual({ ok: true });
  });
});

describe('chong trung thanh toan — UNIQUE (method, gateway_reference) (API_ARCHITECTURE §10.1 buoc 4)', () => {
  const existing = [
    { method: 'sepay', gatewayReference: 'SEPAY-20261110-000001' },
    { method: 'bank_transfer', gatewayReference: 'MB-20261110-000777' },
  ];

  it('webhook gui lai cung giao dich SePay -> tra payment cu, khong tao moi', () => {
    expect(findDuplicatePayment(existing, 'sepay', 'SEPAY-20261110-000001')).toEqual(
      existing[0],
    );
  });

  it('khac method, cung reference -> khong trung (UNIQUE la CAP method+reference)', () => {
    expect(findDuplicatePayment(existing, 'stripe', 'SEPAY-20261110-000001')).toBeNull();
  });

  it('cung method, khac reference -> khong trung', () => {
    expect(findDuplicatePayment(existing, 'sepay', 'SEPAY-20261110-000002')).toBeNull();
  });

  it('gateway_reference NULL -> khong bao gio coi la trung (dung semantics Postgres UNIQUE)', () => {
    expect(findDuplicatePayment(existing, 'sepay', null)).toBeNull();
    expect(
      findDuplicatePayment([{ method: 'sepay', gatewayReference: null }], 'sepay', null),
    ).toBeNull();
  });
});

describe('khong cap quyen khi chua xac minh — chi paid + succeeded + verified moi cap enrollment', () => {
  it('paid + succeeded + da xac minh chu ky -> duoc cap', () => {
    expect(
      canGrantEnrollment({ orderStatus: 'paid', paymentStatus: 'succeeded', verified: true }),
    ).toBe(true);
  });

  it('paid + succeeded nhung CHUA xac minh -> khong cap', () => {
    expect(
      canGrantEnrollment({ orderStatus: 'paid', paymentStatus: 'succeeded', verified: false }),
    ).toBe(false);
  });

  it('don pending (chua doi sang paid) -> khong cap, du payment succeeded', () => {
    expect(
      canGrantEnrollment({
        orderStatus: 'pending',
        paymentStatus: 'succeeded',
        verified: true,
      }),
    ).toBe(false);
  });

  it('payment failed / pending -> khong cap', () => {
    expect(
      canGrantEnrollment({ orderStatus: 'pending', paymentStatus: 'failed', verified: true }),
    ).toBe(false);
    expect(
      canGrantEnrollment({ orderStatus: 'pending', paymentStatus: 'pending', verified: true }),
    ).toBe(false);
  });

  it('don cancelled / expired / refunded -> khong cap', () => {
    for (const s of ['cancelled', 'expired', 'refunded']) {
      expect(
        canGrantEnrollment({ orderStatus: s, paymentStatus: 'succeeded', verified: true }),
      ).toBe(false);
    }
  });

  it('don refunded -> thu hoi enrollment; don paid/pending -> khong thu hoi', () => {
    expect(shouldRevokeEnrollment('refunded')).toBe(true);
    expect(shouldRevokeEnrollment('paid')).toBe(false);
    expect(shouldRevokeEnrollment('pending')).toBe(false);
  });
});

describe('hoan tra 15 ngay lam viec / khieu nai 3 ngay (DECISIONS QD 9)', () => {
  // 10/11/2026 la Thu Ba (xac nhan: Tue 2026-11-10).
  it('addWorkingDays: +1 ngay tu Thu Ba -> Thu Tu; +5 ngay bo qua Thu Bay/Chu Nhat', () => {
    expect(addWorkingDays(utc(2026, 11, 10), 1).toISOString()).toBe(
      utc(2026, 11, 11).toISOString(),
    );
    expect(addWorkingDays(utc(2026, 11, 10), 5).toISOString()).toBe(
      utc(2026, 11, 17).toISOString(),
    );
  });

  it('addWorkingDays: Thu Sau +1 -> Thu Hai; Thu Bay +1 -> Thu Hai', () => {
    expect(addWorkingDays(utc(2026, 11, 13), 1).toISOString()).toBe(
      utc(2026, 11, 16).toISOString(),
    );
    expect(addWorkingDays(utc(2026, 11, 14), 1).toISOString()).toBe(
      utc(2026, 11, 16).toISOString(),
    );
  });

  it('addWorkingDays: +0 tra ve cung ngay; khong sua doi ngay dau vao', () => {
    const start = utc(2026, 11, 10);
    expect(addWorkingDays(start, 0).toISOString()).toBe(start.toISOString());
    expect(start.toISOString()).toBe(utc(2026, 11, 10).toISOString());
  });

  it('han hoan tra: tra 10/11 + 15 ngay lam viec = 01/12/2026', () => {
    expect(addWorkingDays(utc(2026, 11, 10), 15).toISOString()).toBe(
      utc(2026, 12, 1).toISOString(),
    );
  });

  it('yeu cau hoan tra trong han -> duoc; qua han -> khong', () => {
    const paidAt = utc(2026, 11, 10);
    expect(isRefundRequestInWindow(paidAt, utc(2026, 12, 1))).toBe(true);
    expect(isRefundRequestInWindow(paidAt, utc(2026, 12, 2))).toBe(false);
    expect(isRefundRequestInWindow(paidAt, utc(2026, 11, 10))).toBe(true);
    expect(isRefundRequestInWindow(paidAt, utc(2026, 11, 9))).toBe(false);
  });

  it('han phan hoi khieu nai: +3 ngay lich (10/11 10:00 -> 13/11 10:00)', () => {
    expect(complaintResponseDeadline(utc(2026, 11, 10, 10)).toISOString()).toBe(
      utc(2026, 11, 13, 10).toISOString(),
    );
  });
});
