// Cloudflare Turnstile — DECISIONS.md QĐ 4 + Task 03 QĐ 13:
// form lead + dang ky co CAPTCHA; khi widget khong tai duoc thi CHO QUA
// voi rate-limit chat hon + ghi log (khong chan cung nguoi dung that).
// => Quy tac o Workers:
//   - Co TURNSTILE_SECRET + client gui token -> verify that; sai/het han
//     thi 400 spam_suspected, khong ghi.
//   - Co secret nhung client KHONG gui token -> cho qua, ghi log canh bao
//     (widget co the khong tai duoc), rate-limit van ap dung.
//   - Chua co secret -> bo qua hoan toan (ghi log 1 lan).
export interface TurnstileResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string | undefined,
): Promise<TurnstileResult> {
  if (!secret) {
    return { ok: true, skipped: true, reason: 'no-secret-configured' };
  }
  if (!token) {
    try {
      console.warn('[visfar-api] turnstile token missing — allowing with rate-limit (widget may have failed to load).');
    } catch {
      // Bo qua.
    }
    return { ok: true, skipped: true, reason: 'no-token-provided' };
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    if (data.success === true) return { ok: true, skipped: false };
    return { ok: false, skipped: false, reason: 'verification-failed' };
  } catch (err) {
    // Khong lien he duoc Cloudflare: khong chan cung — ghi log, cho qua
    // (rate-limit + honeypot van la lop chan). Loi ha tang khong phai spam.
    try {
      console.warn('[visfar-api] turnstile verify unreachable:', err instanceof Error ? err.message : 'unknown');
    } catch {
      // Bo qua.
    }
    return { ok: true, skipped: true, reason: 'verify-unreachable' };
  }
}
