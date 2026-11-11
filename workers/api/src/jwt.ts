// Xac minh JWT Supabase Auth bang JWKS — API_ARCHITECTURE.md §3.
// Khong tin JWT client tu khai: kiem tra chu ky RS256 hoac ES256 theo JWKS
// cua Supabase Auth, kem iss / aud / exp. Khong dung thu vien ngoai:
// WebCrypto (crypto.subtle) co san o Workers va Node 20+.
//
// Supabase JWT that:
//   iss = "<SUPABASE_URL>/auth/v1"
//   aud = "authenticated"
//   sub = user_id (UUID)
// JWKS endpoint: "<SUPABASE_URL>/auth/v1/.well-known/jwks.json"
//
// LUU Y (11/11/2026): Supabase staging dung publishable key moi phat hanh
// JWT alg ES256 (khoa EC P-256, chu ky raw r||s 64 bytes — dung dang ma
// WebCrypto ECDSA chap nhan). Ban cu chi chap nhan RS256 nen token ES256
// that bi 401. Tu day verify ca RS256 (RSA n/e) va ES256 (EC crv P-256,
// x/y); moi alg khac (none, HS256, ...) deu bi tu choi.

interface Jwk {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

interface JwksResponse {
  keys?: Jwk[];
}

interface CachedJwks {
  keys: Jwk[];
  expiresAt: number;
}

const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_SEC = 30;
let jwksCache: CachedJwks | null = null;

/** Chi dung trong test: xoa cache JWKS giua cac test. */
export function __resetJwksCache(): void {
  jwksCache = null;
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  const bytes = base64UrlDecode(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as Record<string, unknown>;
}

async function fetchJwks(supabaseUrl: string): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;
  const url = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as JwksResponse;
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (keys.length === 0) throw new Error('JWKS empty');
  jwksCache = { keys, expiresAt: now + JWKS_TTL_MS };
  return keys;
}

export interface VerifiedJwt {
  userId: string;
  claims: Record<string, unknown>;
}

/**
 * Xac minh JWT. Tra VerifiedJwt khi hop le; throw Error (message khong
 * chua PII) khi: sai dinh dang, het han, sai iss/aud, khong tim thay key,
 * chu ky khong khop. Handler map moi loi thanh 401 unauthorized.
 */
export async function verifySupabaseJwt(
  token: string,
  supabaseUrl: string,
): Promise<VerifiedJwt> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT malformed');
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJsonSegment(headerB64);
    payload = decodeJsonSegment(payloadB64);
  } catch {
    throw new Error('JWT undecodable');
  }
  if (header['alg'] !== 'RS256' && header['alg'] !== 'ES256') {
    throw new Error('JWT alg not supported');
  }
  const alg = header['alg'] as 'RS256' | 'ES256';
  const kid = typeof header['kid'] === 'string' ? header['kid'] : null;

  const keys = await fetchJwks(supabaseUrl);
  const jwk = kid ? keys.find((k) => k.kid === kid) : keys[0];
  if (!jwk) throw new Error('JWT key not found');
  // Khoa phai khop alg: RS256 -> RSA (n/e), ES256 -> EC P-256 (x/y).
  const isRsa = alg === 'RS256' && jwk.kty === 'RSA' && !!jwk.n && !!jwk.e;
  const isEc =
    alg === 'ES256' && jwk.kty === 'EC' && jwk.crv === 'P-256' && !!jwk.x && !!jwk.y;
  if (!isRsa && !isEc) throw new Error('JWT key not found');
  const key =
    alg === 'RS256'
      ? await crypto.subtle.importKey(
          'jwk',
          jwk as unknown as JsonWebKey,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        )
      : await crypto.subtle.importKey(
          'jwk',
          jwk as unknown as JsonWebKey,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify'],
        );
  const encoder = new TextEncoder();
  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);
  // ES256: chu ky JWT la raw r||s 64 bytes — dung dang WebCrypto ECDSA
  // chap nhan (khong phai DER). RS256: PKCS#1 v1.5 nhu cu.
  const verifyAlg =
    alg === 'RS256'
      ? 'RSASSA-PKCS1-v1_5'
      : ({ name: 'ECDSA', hash: 'SHA-256' } as const);
  const valid = await crypto.subtle.verify(
    verifyAlg,
    key,
    signature as BufferSource,
    signingInput as BufferSource,
  );
  if (!valid) throw new Error('JWT signature mismatch');

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = payload['exp'];
  if (typeof exp !== 'number' || exp + CLOCK_SKEW_SEC < nowSec) {
    throw new Error('JWT expired');
  }
  const expectedIss = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  if (payload['iss'] !== expectedIss) throw new Error('JWT issuer mismatch');
  const aud = payload['aud'];
  const audOk =
    aud === 'authenticated' ||
    (Array.isArray(aud) && aud.includes('authenticated'));
  if (!audOk) throw new Error('JWT audience mismatch');
  const sub = payload['sub'];
  if (typeof sub !== 'string' || sub.length === 0) throw new Error('JWT sub missing');
  return { userId: sub, claims: payload };
}

/** Trich Bearer token tu header Authorization. */
export function extractBearerToken(req: Request): string | null {
  const h = req.headers.get('Authorization');
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? (m[1] as string).trim() : null;
}
