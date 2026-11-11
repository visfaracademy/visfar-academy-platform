// Test SePay webhook — TASK 10 (Workers API).
// Test logic THAT cua workers/api/src/sepay.ts: xac minh chu ky
// HMAC-SHA256, trich ma don / so tien / ma giao dich tu payload.
// Chay that, khong mock DB.
//
// SCHEME CHU KY DA XAC NHAN (10/11/2026, SEPAY_INTEGRATION.md §4.2
// — tai lieu chinh thuc SePay): HMAC-SHA256 tren chuoi
// "{timestamp}.{raw_body}", header X-SePay-Signature: sha256={hex}
// + X-SePay-Timestamp (Unix seconds), tu choi timestamp lech qua
// 5 phut. Ban truoc (HMAC chi tren raw body) la gia dinh tam khi
// file tich hop chua co — da thay o day.
//
// Phan chua co implementation (kiem tra so tien, idempotency,
// chong trung payment, cap quyen, han hoan tra) nam o file
// test/sepay-contract.test.ts — CONTRACT TEST, doi code.
import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  ORDER_REFERENCE_RE,
  SEPAY_SIGNATURE_HEADERS,
  SEPAY_TIMESTAMP_HEADER,
  extractReferenceCode,
  getSepaySignatureHeader,
  getSepayTimestampHeader,
  isSepayTimestampFresh,
  parseSepayPayload,
  timingSafeEqual,
  verifySepaySignature,
} from '../src/sepay';

const SECRET = 'test-sepay-webhook-secret-chi-dung-trong-test';
const RAW_BODY =
  '{"id":"SEPAY-20261110-000001","transferType":"in","transferAmount":1999000,"content":"DH-2026-000123","referenceCode":"SEPAY-20261110-000001"}';

// Ky theo scheme that cua SePay: HMAC-SHA256("{timestamp}.{body}").
function sign(body: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

function freshTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

describe('verifySepaySignature — chu ky dung/sai (SEPAY_INTEGRATION.md §4.2)', () => {
  it('chu ky dung (HMAC-SHA256 hex cua "{timestamp}.{raw_body}") -> true', async () => {
    const ts = freshTimestamp();
    await expect(verifySepaySignature(RAW_BODY, sign(RAW_BODY, SECRET, ts), SECRET, ts)).resolves.toBe(
      true,
    );
  });

  it('chu ky sai (doi 1 ky tu) -> false, khong xu ly', async () => {
    const ts = freshTimestamp();
    const good = sign(RAW_BODY, SECRET, ts);
    const bad = `${good.slice(0, -1)}${good.endsWith('0') ? '1' : '0'}`;
    await expect(verifySepaySignature(RAW_BODY, bad, SECRET, ts)).resolves.toBe(false);
  });

  it('body bi sua sau khi ky -> false', async () => {
    const ts = freshTimestamp();
    const sig = sign(RAW_BODY, SECRET, ts);
    const tampered = RAW_BODY.replace('1999000', '1999001');
    await expect(verifySepaySignature(tampered, sig, SECRET, ts)).resolves.toBe(false);
  });

  it('timestamp bi sua sau khi ky -> false', async () => {
    const ts = freshTimestamp();
    const sig = sign(RAW_BODY, SECRET, ts);
    await expect(verifySepaySignature(RAW_BODY, sig, SECRET, ts + 1)).resolves.toBe(false);
  });

  it('thieu chu ky (null / undefined / rong) -> false', async () => {
    const ts = freshTimestamp();
    await expect(verifySepaySignature(RAW_BODY, null, SECRET, ts)).resolves.toBe(false);
    await expect(verifySepaySignature(RAW_BODY, undefined, SECRET, ts)).resolves.toBe(false);
    await expect(verifySepaySignature(RAW_BODY, '', SECRET, ts)).resolves.toBe(false);
    await expect(verifySepaySignature(RAW_BODY, '   ', SECRET, ts)).resolves.toBe(false);
  });

  it('thieu timestamp (null / undefined) -> false — fail-closed, SePay luon gui kem', async () => {
    const ts = freshTimestamp();
    const sig = sign(RAW_BODY, SECRET, ts);
    await expect(verifySepaySignature(RAW_BODY, sig, SECRET, null)).resolves.toBe(false);
    await expect(verifySepaySignature(RAW_BODY, sig, SECRET, undefined)).resolves.toBe(false);
    await expect(verifySepaySignature(RAW_BODY, sig, SECRET, 'khong-phai-so')).resolves.toBe(
      false,
    );
  });

  it('timestamp het han (> 5 phut) hoac o tuong lai xa -> false (chong replay)', async () => {
    const oldTs = freshTimestamp() - 301;
    await expect(
      verifySepaySignature(RAW_BODY, sign(RAW_BODY, SECRET, oldTs), SECRET, oldTs),
    ).resolves.toBe(false);
    const futureTs = freshTimestamp() + 301;
    await expect(
      verifySepaySignature(RAW_BODY, sign(RAW_BODY, SECRET, futureTs), SECRET, futureTs),
    ).resolves.toBe(false);
  });

  it('secret sai -> false', async () => {
    const ts = freshTimestamp();
    await expect(
      verifySepaySignature(RAW_BODY, sign(RAW_BODY, SECRET, ts), 'secret-khac', ts),
    ).resolves.toBe(false);
  });

  it('chua cau hinh secret (rong / undefined) -> false — fail-closed', async () => {
    const ts = freshTimestamp();
    await expect(verifySepaySignature(RAW_BODY, sign(RAW_BODY, SECRET, ts), '', ts)).resolves.toBe(
      false,
    );
    await expect(
      verifySepaySignature(RAW_BODY, sign(RAW_BODY, SECRET, ts), undefined, ts),
    ).resolves.toBe(false);
  });

  it('chu ky khong phai hex / sai do dai -> false', async () => {
    const ts = freshTimestamp();
    await expect(verifySepaySignature(RAW_BODY, 'khong-phai-hex', SECRET, ts)).resolves.toBe(
      false,
    );
    await expect(verifySepaySignature(RAW_BODY, 'aabbcc', SECRET, ts)).resolves.toBe(false);
  });

  it('body rong + chu ky dung cua body rong -> true (handler tu xu ly body rong sau)', async () => {
    const ts = freshTimestamp();
    await expect(verifySepaySignature('', sign('', SECRET, ts), SECRET, ts)).resolves.toBe(true);
  });

  it('chap nhan dang sha256=<hex> va hex hoa (normalize o implementation)', async () => {
    const ts = freshTimestamp();
    const sig = sign(RAW_BODY, SECRET, ts);
    await expect(verifySepaySignature(RAW_BODY, `sha256=${sig}`, SECRET, ts)).resolves.toBe(
      true,
    );
    await expect(
      verifySepaySignature(RAW_BODY, sig.toUpperCase(), SECRET, ts),
    ).resolves.toBe(true);
  });
});

describe('isSepayTimestampFresh — chong replay 5 phut', () => {
  it('trong 5 phut -> tuoi; dung 300 giay -> tuoi; 301 giay -> het', () => {
    const nowMs = Date.now();
    const nowS = Math.floor(nowMs / 1000);
    expect(isSepayTimestampFresh(nowS, nowMs)).toBe(true);
    expect(isSepayTimestampFresh(nowS - 300, nowMs)).toBe(true);
    expect(isSepayTimestampFresh(nowS - 301, nowMs)).toBe(false);
    expect(isSepayTimestampFresh(nowS + 300, nowMs)).toBe(true);
    expect(isSepayTimestampFresh(nowS + 301, nowMs)).toBe(false);
    expect(isSepayTimestampFresh(0, nowMs)).toBe(false);
    expect(isSepayTimestampFresh(Number.NaN, nowMs)).toBe(false);
  });
});

describe('getSepayTimestampHeader — doc X-SePay-Timestamp', () => {
  it('doc dung header timestamp; thieu -> null', () => {
    expect(SEPAY_TIMESTAMP_HEADER).toBe('x-sepay-timestamp');
    const req = new Request('https://example.com/webhook', {
      headers: { 'x-sepay-timestamp': '1762810000' },
    });
    expect(getSepayTimestampHeader(req)).toBe('1762810000');
    const noTs = new Request('https://example.com/webhook', { headers: {} });
    expect(getSepayTimestampHeader(noTs)).toBeNull();
  });
});

describe('timingSafeEqual', () => {
  it('bang nhau -> true; khac 1 ky tu -> false; khac do dai -> false', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

describe('extractReferenceCode — trich ma don DH-YYYY-NNNNNN tu noi dung chuyen khoan', () => {
  it('tim thay ma don giua cau', () => {
    expect(extractReferenceCode('Thanh toan DH-2026-000123 khoa hoc')).toBe('DH-2026-000123');
  });

  it('nhieu ma -> lay ma dau tien', () => {
    expect(extractReferenceCode('DH-2026-000123 DH-2026-000124')).toBe('DH-2026-000123');
  });

  it('mat gach ngang do VietQR (DH2026000123) -> chuan hoa ve DH-2026-000123', () => {
    expect(extractReferenceCode('Chuyen tien DH2026000123')).toBe('DH-2026-000123');
    expect(extractReferenceCode('DH-2026000123')).toBe('DH-2026-000123');
    expect(extractReferenceCode('DH2026-000123')).toBe('DH-2026-000123');
  });

  it('khong co ma / sai dinh dang / khong phai chuoi -> null (webhook vao doi soat R9)', () => {
    expect(extractReferenceCode('Chuyen khoan khong co ma')).toBeNull();
    expect(extractReferenceCode('DH-2026-123')).toBeNull();
    expect(extractReferenceCode(123)).toBeNull();
    expect(extractReferenceCode(null)).toBeNull();
  });
});

describe('getSepaySignatureHeader — doc chu ky tu header', () => {
  it('uu tien x-sepay-signature', () => {
    const req = new Request('https://example.com/webhook', {
      headers: { 'x-sepay-signature': 'sig-1', 'x-signature': 'sig-2' },
    });
    expect(getSepaySignatureHeader(req)).toBe('sig-1');
  });

  it('fallback sang x-signature khi khong co header chinh', () => {
    const req = new Request('https://example.com/webhook', {
      headers: { 'x-signature': 'sig-2' },
    });
    expect(getSepaySignatureHeader(req)).toBe('sig-2');
  });

  it('khong co header nao / header rong -> null', () => {
    expect(getSepaySignatureHeader(new Request('https://example.com/webhook'))).toBeNull();
    const req = new Request('https://example.com/webhook', {
      headers: { 'x-sepay-signature': '   ' },
    });
    expect(getSepaySignatureHeader(req)).toBeNull();
  });

  it('SEPAY_SIGNATURE_HEADERS co x-sepay-signature dau tien', () => {
    expect(SEPAY_SIGNATURE_HEADERS[0]).toBe('x-sepay-signature');
    expect(SEPAY_SIGNATURE_HEADERS.length).toBeGreaterThanOrEqual(2);
  });
});

describe('parseSepayPayload — trich giao dich tu payload', () => {
  it('payload chuan: id + transferAmount + content -> du field, ma don trich duoc', () => {
    const tx = parseSepayPayload({
      id: 'SEPAY-20261110-000001',
      transferAmount: 1999000,
      content: 'DH-2026-000123 thanh toan khoa hoc',
    });
    expect(tx).toEqual({
      gatewayReference: 'SEPAY-20261110-000001',
      amountVnd: 1999000,
      content: 'DH-2026-000123 thanh toan khoa hoc',
      referenceCode: 'DH-2026-000123',
      accountName: null,
      transferType: null,
    });
  });

  it('payload co transferType in/out -> parse dung huong giao dich', () => {
    expect(parseSepayPayload({ id: 'X', transferAmount: 100, content: 'DH-2026-000123', transferType: 'in' }).transferType).toBe('in');
    expect(parseSepayPayload({ id: 'X', transferAmount: 100, content: 'DH-2026-000123', transferType: 'OUT' }).transferType).toBe('out');
  });

  it('payload boc trong data -> mo 1 lop', () => {
    const tx = parseSepayPayload({
      data: { id: 'SEPAY-X', transferAmount: 500000, content: 'DH-2026-000124' },
    });
    expect(tx.gatewayReference).toBe('SEPAY-X');
    expect(tx.amountVnd).toBe(500000);
    expect(tx.referenceCode).toBe('DH-2026-000124');
  });

  it('ten field khac: referenceCode / amount (chuoi so) / description', () => {
    const tx = parseSepayPayload({
      referenceCode: 'SEPAY-Y',
      amount: '1999000',
      description: 'Chuyen khoan DH-2026-000125',
      accountName: 'NGUYEN VAN A',
    });
    expect(tx.gatewayReference).toBe('SEPAY-Y');
    expect(tx.amountVnd).toBe(1999000);
    expect(tx.referenceCode).toBe('DH-2026-000125');
    expect(tx.accountName).toBe('NGUYEN VAN A');
  });

  it('thieu so tien / thieu noi dung -> null (handler phai tu choi, khong doan)', () => {
    const tx = parseSepayPayload({ id: 'SEPAY-Z', content: 'DH-2026-000126' });
    expect(tx.amountVnd).toBeNull();
    expect(tx.referenceCode).toBe('DH-2026-000126');
    const tx2 = parseSepayPayload({ id: 'SEPAY-Z', transferAmount: 1000 });
    expect(tx2.content).toBeNull();
    expect(tx2.referenceCode).toBeNull();
  });

  it('so tien chuoi khong phai so / so thap phan -> null / truncate', () => {
    expect(parseSepayPayload({ amount: 'abc' }).amountVnd).toBeNull();
    expect(parseSepayPayload({ amount: 1999000.9 }).amountVnd).toBe(1999000);
  });

  it('payload khong phai object -> tat ca null', () => {
    for (const bad of [null, [], 'chuoi', 123]) {
      const tx = parseSepayPayload(bad);
      expect(tx.gatewayReference).toBeNull();
      expect(tx.amountVnd).toBeNull();
      expect(tx.referenceCode).toBeNull();
    }
  });

  it('ORDER_REFERENCE_RE nhan DH-YYYY-NNNNNN (6 so) + dang mat gach ngang do VietQR', () => {
    expect(ORDER_REFERENCE_RE.test('DH-2026-000123')).toBe(true);
    expect(ORDER_REFERENCE_RE.test('DH2026000123')).toBe(true);
    expect(ORDER_REFERENCE_RE.test('DH-2026-00012')).toBe(false);
    expect(ORDER_REFERENCE_RE.test('DH-2026-0001234')).toBe(true); // chua 6 so dau — regex khong neo cuoi
  });
});
