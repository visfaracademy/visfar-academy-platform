// SePay webhook — xac minh chu ky + trich thong tin giao dich +
// cac ham pure dung chung cho Payment & Commerce (Task 10).
//
// HOP DONG (contract test: workers/api/test/sepay.test.ts):
//   IDEMPOTENCY_TTL_MS, verifySepayWebhookSignature,
//   decideIdempotencyReplay, isIdempotencyKeyExpired,
//   checkPaymentAmount, findDuplicatePayment, canGrantEnrollment,
//   shouldRevokeEnrollment, addWorkingDays, isRefundRequestInWindow,
//   complaintResponseDeadline, isSepayTimestampFresh,
//   getSepayTimestampHeader.
//
// NGUON SU THAT VE CHU KY — DA XAC NHAN (10/11/2026):
//   docs/payment/SEPAY_INTEGRATION.md §4.2 (tong hop tu tai lieu
//   chinh thuc SePay: developer.sepay.vn — xac thuc webhook,
//   docs.sepay.vn — tich hop webhooks):
//   - Header: X-SePay-Signature: sha256={hex} + X-SePay-Timestamp
//     (Unix seconds luc ky).
//   - Chuoi ky: "{timestamp}.{raw_body}" — HMAC-SHA256 voi Secret Key.
//   - Chong replay: tu choi timestamp lech qua 5 phut (300 giay)
//     so voi thoi gian hien tai.
//   - So sanh constant-time; sai/thieu chu ky -> 401, khong xu ly,
//     khong ghi du lieu.
//   Ban truoc (HMAC chi tren raw body, khong timestamp) la GIA DINH
//   tam khi SEPAY_INTEGRATION.md chua co — da thay bang scheme that
//   o day + test chu ky (test/sepay.test.ts).
//
// NGUYEN TAC AN TOAN:
//   - Khong co SEPAY_WEBHOOK_SECRET -> TU CHOI moi webhook (401,
//     fail-closed). Khong bao gio chap nhan webhook khong xac minh.
//   - Khong bao gio log secret, khong bao gio dua secret vao
//     gateway_payload luu DB.
//   - Chi server moi duoc doi don sang 'paid' (webhook da xac minh
//     hoac admin xac nhan). Khong tin client bao "da tra".
//   - So tien phai khop TUYET DOI (sai lech 0đ): thieu/thua deu la
//     payment_mismatch, khong doi don sang paid.
import { safeLog } from './env';

/** Hieu luc Idempotency-Key: 24 gio (DECISIONS Task 03 QĐ 13). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Ten header co the chua chu ky SePay (doc theo thu tu nay). */
export const SEPAY_SIGNATURE_HEADERS = [
  'x-sepay-signature',
  'sepay-signature',
  'x-signature',
] as const;

/** Header timestamp SePay gui kem chu ky (Unix seconds). */
export const SEPAY_TIMESTAMP_HEADER = 'x-sepay-timestamp';

/** Chong replay: timestamp lech qua 5 phut (300 giay) thi tu choi. */
export const SEPAY_TIMESTAMP_TOLERANCE_S = 300;

/**
 * Ma don trong noi dung chuyen khoan: DH-YYYY-NNNNNN.
 * VietQR `des` tu bo dau tieng Viet va co the xu ly dau gach ngang
 * (SEPAY_INTEGRATION.md §1.3 — can kiem tra thuc te), nen regex chap
 * nhan ca dang mat gach noi (DH2026000123, DH-2026000123) va
 * extractReferenceCode() chuan hoa ve dang DH-YYYY-NNNNNN de khop DB.
 */
export const ORDER_REFERENCE_RE = /DH-?(\d{4})-?(\d{6})/;

/**
 * Trich ma don (reference_code) tu mot chuoi noi dung chuyen khoan.
 * Tra null khi khong thay — webhook do se vao doi soat R9, khong doi
 * trang thai don nao. Luon tra dang chuan DH-YYYY-NNNNNN (ke ca khi
 * noi dung bi mat dau gach ngang do VietQR).
 */
export function extractReferenceCode(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const m = ORDER_REFERENCE_RE.exec(text);
  if (!m) return null;
  return `DH-${m[1]}-${m[2]}`;
}

function hexEncode(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** So sanh 2 chuoi theo thoi gian hang so (chong timing attack). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function normalizeSignature(raw: string): string {
  let v = raw.trim();
  // SePay gui dang "sha256=<hex>" (SEPAY_INTEGRATION.md §4.2).
  if (v.toLowerCase().startsWith('sha256=')) v = v.slice('sha256='.length);
  return v.trim().toLowerCase();
}

/**
 * Timestamp SePay con tuoi khong (chong replay): Unix seconds,
 * lech qua SEPAY_TIMESTAMP_TOLERANCE_S (300 giay) theo ca 2 huong
 * thi het tuoi. Timestamp khong phai so / <= 0 -> het tuoi.
 */
export function isSepayTimestampFresh(
  timestampSeconds: number,
  nowMs: number = Date.now(),
): boolean {
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) return false;
  const nowSeconds = Math.floor(nowMs / 1000);
  return Math.abs(nowSeconds - timestampSeconds) <= SEPAY_TIMESTAMP_TOLERANCE_S;
}

/**
 * Xac minh chu ky HMAC-SHA256 cua webhook SePay (scheme that —
 * SEPAY_INTEGRATION.md §4.2): chuoi ky la "{timestamp}.{raw_body}",
 * header X-SePay-Signature: sha256={hex}, kem X-SePay-Timestamp.
 * Tra false khi: thieu secret, thieu chu ky, thieu/khong hop le/
 * het han timestamp, chu ky khong phai hex / sai do dai, chu ky
 * khong khop. KHONG throw khi chu ky sai — caller tra 401.
 * Timestamp BAT BUOC: khong co timestamp thi khong xac minh duoc
 * (SePay luon gui kem); goi khong truyen timestamp = tu choi.
 */
export async function verifySepayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
  timestamp: string | number | null | undefined,
): Promise<boolean> {
  if (!secret?.trim() || !signature?.trim()) return false;
  const ts = typeof timestamp === 'string' ? Number(timestamp.trim()) : timestamp;
  if (typeof ts !== 'number' || !isSepayTimestampFresh(ts)) return false;
  const expected = normalizeSignature(signature);
  if (!/^[0-9a-f]{64}$/.test(expected)) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret.trim()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const message = `${Math.trunc(ts)}.${rawBody}`;
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return timingSafeEqual(hexEncode(sig), expected);
  } catch (err) {
    safeLog('sepay signature verify error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return false;
  }
}

/** Alias giu ten ngan gon cho handler dung. */
export const verifySepaySignature = verifySepayWebhookSignature;

/** Lay chu ky tu header request (thu lan luot cac ten header). */
export function getSepaySignatureHeader(req: Request): string | null {
  for (const name of SEPAY_SIGNATURE_HEADERS) {
    const v = req.headers.get(name);
    if (v?.trim()) return v;
  }
  return null;
}

/** Lay timestamp SePay gui kem chu ky (header X-SePay-Timestamp). */
export function getSepayTimestampHeader(req: Request): string | null {
  const v = req.headers.get(SEPAY_TIMESTAMP_HEADER);
  return v?.trim() ? v.trim() : null;
}

// ---------------------------------------------------------------------------
// Idempotency — API_ARCHITECTURE.md §4
// ---------------------------------------------------------------------------

export interface StoredIdempotency {
  bodyHash: string;
  result: unknown;
}

export type IdempotencyDecision =
  | { action: 'new' }
  | { action: 'replay'; result: unknown }
  | { action: 'conflict' };

/**
 * Cung key + cung body -> tra ket qua cu (replay, khong ghi them).
 * Cung key + khac body -> conflict (handler tra 409, khong ghi).
 * Chua co key -> new.
 */
export function decideIdempotencyReplay(
  existing: StoredIdempotency | null | undefined,
  bodyHash: string,
): IdempotencyDecision {
  if (!existing) return { action: 'new' };
  if (existing.bodyHash === bodyHash) return { action: 'replay', result: existing.result };
  return { action: 'conflict' };
}

/**
 * Het han khi (nowMs - createdAtMs) > ttlMs (qua dung TTL moi het;
 * dung bang TTL thi chua het). Mac dinh TTL = IDEMPOTENCY_TTL_MS.
 */
export function isIdempotencyKeyExpired(
  createdAtMs: number,
  nowMs: number,
  ttlMs: number = IDEMPOTENCY_TTL_MS,
): boolean {
  return nowMs - createdAtMs > ttlMs;
}

// ---------------------------------------------------------------------------
// Kiem tra so tien + chong trung + cap / thu hoi quyen
// ---------------------------------------------------------------------------

export type PaymentAmountCheck =
  | { ok: true }
  | { ok: false; error: 'payment_mismatch'; diffVnd: number };

/**
 * So tien giao dich phai khop tuyet doi so tien don (diffVnd =
 * paid - order). Thieu/thua du 1đ cung la mismatch.
 */
export function checkPaymentAmount(
  orderAmountVnd: number,
  paidAmountVnd: number,
): PaymentAmountCheck {
  const diffVnd = paidAmountVnd - orderAmountVnd;
  if (diffVnd !== 0) return { ok: false, error: 'payment_mismatch', diffVnd };
  return { ok: true };
}

export interface KnownPayment {
  method: string;
  gatewayReference: string | null;
}

/**
 * Tim payment trung theo UNIQUE (method, gateway_reference).
 * gateway_reference NULL khong bao gio coi la trung (dung semantics
 * UNIQUE cua Postgres: NULL khac NULL).
 */
export function findDuplicatePayment<T extends KnownPayment>(
  payments: readonly T[],
  method: string,
  gatewayReference: string | null,
): T | null {
  if (gatewayReference === null) return null;
  for (const p of payments) {
    if (p.method === method && p.gatewayReference === gatewayReference) return p;
  }
  return null;
}

export interface GrantEnrollmentInput {
  orderStatus: string;
  paymentStatus: string;
  verified: boolean;
}

/**
 * Chi cap quyen hoc khi: don DA paid + payment DA succeeded +
 * DA xac minh (chu ky webhook dung hoac admin xac nhan). Thieu 1
 * trong 3 dieu kien -> khong cap. Day la lop chan cuoi chong cap
 * quyen dua tren frontend hoac anh chup giao dich.
 */
export function canGrantEnrollment(input: GrantEnrollmentInput): boolean {
  return (
    input.orderStatus === 'paid' &&
    input.paymentStatus === 'succeeded' &&
    input.verified === true
  );
}

/** Don refunded -> thu hoi enrollment (va membership, chung chi). */
export function shouldRevokeEnrollment(orderStatus: string): boolean {
  return orderStatus === 'refunded';
}

// ---------------------------------------------------------------------------
// Hoan tra 15 ngay lam viec / khieu nai 3 ngay (DECISIONS.md QĐ 9)
// ---------------------------------------------------------------------------

/**
 * Cong N ngay lam viec (bo Thu Bay / Chu Nhat). Tra Date MOI, khong
 * sua doi ngay dau vao. +0 tra ve cung ngay. Tinh theo UTC de tranh
 * lech mui gio khi chay o Workers / Node.
 */
export function addWorkingDays(start: Date, workingDays: number): Date {
  const out = new Date(start.getTime());
  let remaining = workingDays;
  while (remaining > 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    const day = out.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return out;
}

/**
 * Yeu cau hoan tra trong han khi: requestedAt >= paidAt va
 * requestedAt <= paidAt + workingDays ngay lam viec (mac dinh 15 —
 * QĐ 9). Qua han -> admin chi hoan khi co ly do ghi vao audit log.
 */
export function isRefundRequestInWindow(
  paidAt: Date,
  requestedAt: Date,
  workingDays: number = 15,
): boolean {
  if (requestedAt.getTime() < paidAt.getTime()) return false;
  const deadline = addWorkingDays(paidAt, workingDays);
  return requestedAt.getTime() <= deadline.getTime();
}

/** Han phan hoi khieu nai: +3 ngay lich, giu nguyen gio (QĐ 9). */
export function complaintResponseDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Parse payload webhook SePay
// ---------------------------------------------------------------------------

export interface SepayTransaction {
  /** Ma giao dich cua SePay (gateway_reference — chong trung). */
  gatewayReference: string | null;
  /** So tien giao dich (VND). */
  amountVnd: number | null;
  /** Noi dung chuyen khoan (chua ma don DH-...). */
  content: string | null;
  /** Ma don trich duoc tu content (null neu khong thay). */
  referenceCode: string | null;
  /** Ten tai khoan nguoi chuyen (chi de doi soat, khong dung de cap quyen). */
  accountName: string | null;
  /** Huong giao dich: 'in' (tien vao) / 'out' (tien ra) / null (khong ro). */
  transferType: string | null;
}

/**
 * Parse payload webhook SePay — theo mau chinh thuc
 * (SEPAY_INTEGRATION.md §4.3):
 *   id (ma giao dich SePay — gateway_reference), transferAmount
 *   (so tien VND), content (noi dung chuyen khoan, chua ma don),
 *   transferType ('in'/'out'), referenceCode (ma tham chieu NGAN
 *   HANG, VD FT... — KHONG phai ma don, chi luu doi soat),
 *   description (ten nguoi chuyen + noi dung).
 * LUY Y: field `referenceCode` cua SePay KHONG phai ma don cua minh —
 * ma don chi trich tu `content` qua extractReferenceCode(). Chi lay
 * so + chuoi, khong tin bat ky field nao khac de doi trang thai don.
 */
export function parseSepayPayload(payload: unknown): SepayTransaction {
  const obj =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  // SePay co the boc payload trong `data` — mo 1 lop.
  const data =
    obj['data'] !== null && typeof obj['data'] === 'object' && !Array.isArray(obj['data'])
      ? (obj['data'] as Record<string, unknown>)
      : obj;

  const pickString = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = data[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
    return null;
  };
  const pickAmount = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = data[k];
      if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
      if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
    }
    return null;
  };

  const gatewayReference = pickString(
    'id',
    'referenceCode',
    'reference_code',
    'transactionId',
    'transaction_id',
    'code',
  );
  const amountVnd = pickAmount('transferAmount', 'transfer_amount', 'amount', 'amountVnd', 'amount_vnd');
  const content = pickString('content', 'description', 'transferContent', 'transfer_content', 'note');
  const transferTypeRaw = pickString('transferType', 'transfer_type');
  return {
    gatewayReference,
    amountVnd,
    content,
    referenceCode: extractReferenceCode(content),
    accountName: pickString('accountName', 'account_name', 'senderName'),
    transferType: transferTypeRaw ? transferTypeRaw.toLowerCase() : null,
  };
}
