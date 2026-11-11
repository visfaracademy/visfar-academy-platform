// Rate-limit — API_ARCHITECTURE.md §5 + DECISIONS.md Task 02 QĐ 10
// (ap ca theo IP va theo user) + Task 03 QĐ 13 (progress: 300 req/gio/user).
//
// Backend: KV neu co binding RATE_LIMIT_KV; khong co thi bo nho
// trong-process (per-isolate — best-effort, du cho luong lead thap;
// ghi ro trong README). Dem ca request loi validation (tru 401/403)
// de chong do — vi vay handler goi check TRUOC khi validate, va chi
// goi record() khi request vuot qua buoc auth (401/403 khong dem).
import type { Env } from './env';

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Bucket>();

/** Chi dung trong test: xoa het bucket giua cac test. */
export function __resetRateLimits(): void {
  memoryStore.clear();
}

export interface RateLimitResult {
  allowed: boolean;
  /** So giay phai doi khi bi chan (de header Retry-After). */
  retryAfterSec: number;
  remaining: number;
}

function memoryCheck(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const bucket = memoryStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0, remaining: limit - bucket.count };
}

async function kvCheck(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateLimitResult> {
  const raw = await kv.get(key, 'text');
  let bucket: Bucket | null = null;
  if (raw) {
    try {
      bucket = JSON.parse(raw) as Bucket;
    } catch {
      bucket = null;
    }
  }
  if (!bucket || bucket.resetAt <= now) {
    const next: Bucket = { count: 1, resetAt: now + windowMs };
    await kv.put(key, JSON.stringify(next), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
    return { allowed: true, retryAfterSec: 0, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  bucket.count += 1;
  await kv.put(key, JSON.stringify(bucket), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
  return { allowed: true, retryAfterSec: 0, remaining: limit - bucket.count };
}

/**
 * Kiem tra + tang dem trong 1 lan goi. Luu y race: 2 isolate cung tang
 * co the vuot nhe gioi han khi dung KV (khong co transaction) — chap nhan
 * duoc voi gioi han chong spam; DB UNIQUE van la lop chan trung cuoi.
 */
export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  // Don dep dinh ky: xoa bucket het han trong bo nho.
  if (memoryStore.size > 10000) {
    for (const [k, b] of memoryStore) if (b.resetAt <= now) memoryStore.delete(k);
  }
  if (env.RATE_LIMIT_KV) {
    try {
      return await kvCheck(env.RATE_LIMIT_KV, key, limit, windowMs, now);
    } catch {
      // KV loi: fallback ve bo nho, khong chan user vi loi ha tang.
      return memoryCheck(key, limit, windowMs, now);
    }
  }
  return memoryCheck(key, limit, windowMs, now);
}

/** IP client: CF-Connecting-IP (Cloudflare) > X-Forwarded-For > 'unknown'. */
export function getClientIp(req: Request): string {
  const cf = req.headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  const xff = req.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  return 'unknown';
}
