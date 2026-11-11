// Test unsubscribe token — khong gui email that, khong can secret that.
import { describe, expect, it } from 'vitest';
import { createUnsubscribeToken, verifyUnsubscribeToken } from './token';

const SECRET = 'test-unsubscribe-secret-123';
const NOW = Date.parse('2026-11-10T10:00:00+07:00');

describe('createUnsubscribeToken / verifyUnsubscribeToken', () => {
  it('token moi ky: verify ok + tra dung email (lowercase, trim)', async () => {
    const token = await createUnsubscribeToken('  A@Example.com ', SECRET, { nowMs: NOW });
    const result = await verifyUnsubscribeToken(token, SECRET, { nowMs: NOW });
    expect(result).toEqual({ ok: true, email: 'a@example.com' });
  });

  it('token het han: expired (qua ca sai so dong ho 60s)', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { ttlSec: 60, nowMs: NOW });
    const result = await verifyUnsubscribeToken(token, SECRET, { nowMs: NOW + 130_000 });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('token vua het han trong sai so dong ho 60s: van ok', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { ttlSec: 60, nowMs: NOW });
    const result = await verifyUnsubscribeToken(token, SECRET, { nowMs: NOW + 90_000 });
    expect(result.ok).toBe(true);
  });

  it('doi 1 ky tu trong payload: invalid (chu ky khong khop)', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const [payload, sig] = token.split('.') as [string, string];
    const tampered = `${payload?.slice(0, -1)}${payload?.endsWith('A') ? 'B' : 'A'}.${sig}`;
    const result = await verifyUnsubscribeToken(tampered, SECRET, { nowMs: NOW });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('doi 1 ky tu trong chu ky: invalid', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const [payload, sig] = token.split('.') as [string, string];
    const tampered = `${payload}.${sig?.slice(0, -1)}${sig?.endsWith('A') ? 'B' : 'A'}`;
    const result = await verifyUnsubscribeToken(tampered, SECRET, { nowMs: NOW });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('sai secret: invalid (khong doan duoc token)', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const result = await verifyUnsubscribeToken(token, 'secret-khac', { nowMs: NOW });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('token sai dinh dang (khong co dau cham / rong): invalid', async () => {
    expect(await verifyUnsubscribeToken('khong-co-dau-cham', SECRET)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await verifyUnsubscribeToken('', SECRET)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('token cua email khac khong dung duoc cho email nay (email nam trong payload ky)', async () => {
    const tokenA = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    const tokenB = await createUnsubscribeToken('b@example.com', SECRET, { nowMs: NOW });
    expect(tokenA).not.toBe(tokenB);
    expect(await verifyUnsubscribeToken(tokenA, SECRET, { nowMs: NOW })).toEqual({
      ok: true,
      email: 'a@example.com',
    });
  });

  it('ky bang secret rong: throw (khong bao gio ky bang secret rong)', async () => {
    await expect(createUnsubscribeToken('a@example.com', '', { nowMs: NOW })).rejects.toThrow();
  });

  it('ttl mac dinh 90 ngay: token van ok sau 89 ngay, het han sau 91 ngay', async () => {
    const token = await createUnsubscribeToken('a@example.com', SECRET, { nowMs: NOW });
    expect((await verifyUnsubscribeToken(token, SECRET, { nowMs: NOW + 89 * 86400_000 })).ok).toBe(true);
    expect(await verifyUnsubscribeToken(token, SECRET, { nowMs: NOW + 91 * 86400_000 })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
});
