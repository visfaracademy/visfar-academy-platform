// Unsubscribe token — TASK 11.
//
// Link huy dang ky trong email marketing/care co dang:
//   <API_BASE>/api/v1/newsletter/unsubscribe?token=<token>
// Token = base64url(payload) + '.' + base64url(HMAC-SHA256(payload)),
// payload JSON: { "e": "<email>", "exp": <epoch giay> }.
//   - Khong doan duoc: can secret (UNSUBSCRIBE_SECRET, chi o Workers
//     Secrets) moi ky duoc token hop le.
//   - Het han duoc: exp mac dinh 90 ngay; token het han -> tu choi.
//   - Khong luu DB: xac minh bang chu ky, khong can bang token.
// Dung WebCrypto (crypto.subtle) — co san o Workers va Node 20+.
// KHONG gui email that o day; chi ky / xac minh token.

export const DEFAULT_UNSUBSCRIBE_TTL_SEC = 90 * 24 * 60 * 60; // 90 ngay
const CLOCK_SKEW_SEC = 60;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** So sanh 2 mang byte theo thoi gian hang so (chong timing attack). */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export interface CreateTokenOptions {
  /** Thoi gian song cua token, tinh bang giay. Mac dinh 90 ngay. */
  ttlSec?: number;
  /** Moc thoi gian (ms epoch) — chi dung trong test. */
  nowMs?: number;
}

/** Ky token huy dang ky cho 1 email. Secret rong -> throw (khong bao gio ky bang secret rong). */
export async function createUnsubscribeToken(
  email: string,
  secret: string,
  opts: CreateTokenOptions = {},
): Promise<string> {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is required');
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('email is required');
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const payload = JSON.stringify({
    e: normalized,
    exp: nowSec + (opts.ttlSec ?? DEFAULT_UNSUBSCRIBE_TTL_SEC),
  });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const sig = await hmacSha256(secret, payloadB64);
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

export type VerifyTokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'invalid' | 'expired' };

export interface VerifyTokenOptions {
  /** Moc thoi gian (ms epoch) — chi dung trong test. */
  nowMs?: number;
}

/** Xac minh token: sai dinh dang / sai chu ky -> invalid; qua exp -> expired. */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
  opts: VerifyTokenOptions = {},
): Promise<VerifyTokenResult> {
  if (!secret || typeof token !== 'string') return { ok: false, reason: 'invalid' };
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'invalid' };
  const [payloadB64, sigB64] = parts as [string, string];
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = base64UrlDecode(payloadB64);
    sigBytes = base64UrlDecode(sigB64);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const expected = await hmacSha256(secret, payloadB64);
  if (!timingSafeEqual(sigBytes, expected)) return { ok: false, reason: 'invalid' };
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof payload !== 'object' || payload === null) return { ok: false, reason: 'invalid' };
  const { e, exp } = payload as { e?: unknown; exp?: unknown };
  if (typeof e !== 'string' || !e.includes('@') || typeof exp !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (exp + CLOCK_SKEW_SEC < nowSec) return { ok: false, reason: 'expired' };
  return { ok: true, email: e };
}
