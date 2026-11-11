// Xac minh chu ky webhook Resend/Svix — TASK 11 (API_ARCHITECTURE §10.2).
//
// Resend ky webhook theo chuan Svix:
//   Header: svix-id, svix-timestamp (epoch giay), svix-signature
//     ("v1,<base64>, v1,<base64>, ..." — co the nhieu chu ky, 1 cai
//     khop la du).
//   Chu ky = base64(HMAC-SHA256(secret_bytes, "<id>.<timestamp>.<rawBody>")).
//   Secret lay tu Resend dashboard, dang "whsec_<base64>" — bo tien to
//   "whsec_" roi base64-decode lay bytes; neu decode hong thi dung
//   nguyen chuoi secret lam bytes (fallback).
//   Timestamp lech qua 5 phut so voi hien tai -> tu choi (chong replay).
// Chu ky sai / thieu header / qua han -> false (handler tra 401,
// khong xu ly, khong ghi du lieu). Dung WebCrypto — khong thu vien ngoai.

export const SVIX_TOLERANCE_SEC = 300; // 5 phut

export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

/** Trich 3 header Svix tu Request (tra null khi thieu 1 trong 3). */
export function parseSvixHeaders(headers: Headers): SvixHeaders | null {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!id || !timestamp || !signature) return null;
  return { id: id.trim(), timestamp: timestamp.trim(), signature: signature.trim() };
}

function base64DecodeToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function secretToBytes(secret: string): Uint8Array {
  const stripped = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  try {
    const bytes = base64DecodeToBytes(stripped);
    // Base64 hop le phai giai ma duoc va ma hoa lai dung chuoi goc
    // (bo qua padding); neu khong thi coi secret la chuoi tho.
    if (bytes.length > 0 && base64Encode(bytes).replace(/=+$/, '') === stripped.replace(/=+$/, '')) {
      return bytes;
    }
  } catch {
    // Roi xuong fallback ben duoi.
  }
  return new TextEncoder().encode(secret);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifySvixOptions {
  /** Moc thoi gian (ms epoch) — chi dung trong test. */
  nowMs?: number;
  /** Dung sai timestamp, giay. Mac dinh 300 (5 phut). */
  toleranceSec?: number;
}

/**
 * Xac minh chu ky Svix cho raw body. Tra false khi: thieu secret,
 * timestamp khong phai so, lech qua dung sai, khong co chu ky v1 nao khop.
 */
export async function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
  opts: VerifySvixOptions = {},
): Promise<boolean> {
  if (!secret) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const tolerance = opts.toleranceSec ?? SVIX_TOLERANCE_SEC;
  if (Math.abs(nowSec - ts) > tolerance) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    secretToBytes(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedContent) as BufferSource,
  );
  const expected = `v1,${base64Encode(new Uint8Array(sig))}`;

  // Header co the chua nhieu chu ky cach nhau bang dau cach.
  for (const part of headers.signature.split(' ')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith('v1,')) continue;
    if (timingSafeEqual(trimmed, expected)) return true;
  }
  return false;
}

/** Ham tien ich cho test: ky 1 payload theo chuan Svix (cung thuat toan nhu ham verify). */
export async function signSvixPayload(
  secret: string,
  id: string,
  timestampSec: number,
  rawBody: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secretToBytes(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedContent = `${id}.${timestampSec}.${rawBody}`;
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedContent) as BufferSource,
  );
  return `v1,${base64Encode(new Uint8Array(sig))}`;
}
