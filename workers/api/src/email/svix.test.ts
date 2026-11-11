// Test xac minh chu ky Svix — khong goi Resend that.
import { describe, expect, it } from 'vitest';
import { parseSvixHeaders, signSvixPayload, verifySvixSignature } from './svix';

const SECRET = 'whsec_' + Buffer.from('test-svix-secret-1234567890').toString('base64');
const RAW_SECRET = 'test-svix-secret-1234567890';
const NOW_MS = Date.parse('2026-11-10T10:00:00Z');
const NOW_SEC = Math.floor(NOW_MS / 1000);

async function signedHeaders(body: string, opts: { secret?: string; ts?: number; id?: string } = {}) {
  const id = opts.id ?? 'msg_test123';
  const ts = opts.ts ?? NOW_SEC;
  const sig = await signSvixPayload(opts.secret ?? SECRET, id, ts, body);
  return { id, timestamp: String(ts), signature: sig };
}

describe('parseSvixHeaders', () => {
  it('du 3 header: parse ok', () => {
    const h = new Headers({
      'svix-id': 'msg_1',
      'svix-timestamp': '1700000000',
      'svix-signature': 'v1,abc',
    });
    expect(parseSvixHeaders(h)).toEqual({ id: 'msg_1', timestamp: '1700000000', signature: 'v1,abc' });
  });

  it('thieu 1 header: null', () => {
    const h = new Headers({ 'svix-id': 'msg_1', 'svix-timestamp': '1700000000' });
    expect(parseSvixHeaders(h)).toBeNull();
  });
});

describe('verifySvixSignature', () => {
  const BODY = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_123' } });

  it('chu ky dung: true', async () => {
    const headers = await signedHeaders(BODY);
    expect(await verifySvixSignature(SECRET, headers, BODY, { nowMs: NOW_MS })).toBe(true);
  });

  it('secret dang tho (khong co whsec_): van verify duoc', async () => {
    const headers = await signedHeaders(BODY, { secret: RAW_SECRET });
    expect(await verifySvixSignature(RAW_SECRET, headers, BODY, { nowMs: NOW_MS })).toBe(true);
  });

  it('chu ky SAI -> tu choi (false)', async () => {
    const headers = await signedHeaders(BODY, { secret: 'whsec_' + Buffer.from('secret-khac').toString('base64') });
    expect(await verifySvixSignature(SECRET, headers, BODY, { nowMs: NOW_MS })).toBe(false);
  });

  it('body bi sua 1 ky tu sau khi ky -> tu choi', async () => {
    const headers = await signedHeaders(BODY);
    const tampered = BODY.replace('delivered', 'deliverex');
    expect(await verifySvixSignature(SECRET, headers, tampered, { nowMs: NOW_MS })).toBe(false);
  });

  it('timestamp qua han 5 phut (replay cu) -> tu choi', async () => {
    const headers = await signedHeaders(BODY, { ts: NOW_SEC - 301 });
    expect(await verifySvixSignature(SECRET, headers, BODY, { nowMs: NOW_MS })).toBe(false);
  });

  it('timestamp trong dung sai 5 phut: ok', async () => {
    const headers = await signedHeaders(BODY, { ts: NOW_SEC - 299 });
    expect(await verifySvixSignature(SECRET, headers, BODY, { nowMs: NOW_MS })).toBe(true);
  });

  it('thieu secret cau hinh: false', async () => {
    const headers = await signedHeaders(BODY);
    expect(await verifySvixSignature('', headers, BODY, { nowMs: NOW_MS })).toBe(false);
  });

  it('nhieu chu ky trong header, 1 cai dung: true', async () => {
    const headers = await signedHeaders(BODY);
    const multi = { ...headers, signature: `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${headers.signature}` };
    expect(await verifySvixSignature(SECRET, multi, BODY, { nowMs: NOW_MS })).toBe(true);
  });

  it('timestamp khong phai so: false', async () => {
    const headers = { id: 'msg_1', timestamp: 'khong-phai-so', signature: 'v1,abc' };
    expect(await verifySvixSignature(SECRET, headers, BODY, { nowMs: NOW_MS })).toBe(false);
  });
});
