// Test storage dong bo cookie + singleton client (sua 2026-11-11):
// - getItem phai tra phien MOI HON khi ca localStorage va cookie deu co
//   (middleware refresh server-side xong cookie moi hon).
// - getSupabaseClient tra cung mot instance o trinh duyet (khong tao
//   4-5 client cung refresh doc lap).
// Chay o environment 'node' nen stub localStorage / document / window.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'sb-ugynqjqyfynkmqutoarp-auth-token';

function sessionJson(expiresInSec: number, tag: string): string {
  return JSON.stringify({
    access_token: `at-${tag}`,
    refresh_token: `rt-${tag}`,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
    user: { id: 'u1', email: 'a@b.c' },
  });
}

describe('createCookieSyncStorage — chon phien moi hon', () => {
  let store: Record<string, string>;
  let cookieJar: Record<string, string>;

  beforeEach(() => {
    store = {};
    cookieJar = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal('document', {
      get cookie() {
        return Object.entries(cookieJar)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      },
      set cookie(raw: string) {
        const [pair] = raw.split(';');
        const eq = pair.indexOf('=');
        if (eq === -1) return;
        const k = pair.slice(0, eq).trim();
        const v = pair.slice(eq + 1);
        if (v === '') delete cookieJar[k];
        else cookieJar[k] = v;
      },
    });
    vi.stubGlobal('window', { location: { protocol: 'https:' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chi co localStorage -> tra localStorage', async () => {
    const { createCookieSyncStorage } = await import('./supabase');
    store[KEY] = sessionJson(3600, 'ls');
    expect(await createCookieSyncStorage().getItem(KEY)).toBe(store[KEY]);
  });

  it('chi co cookie -> tra cookie (localStorage trong)', async () => {
    const { createCookieSyncStorage } = await import('./supabase');
    const raw = sessionJson(3600, 'ck');
    cookieJar[KEY] = encodeURIComponent(raw);
    expect(await createCookieSyncStorage().getItem(KEY)).toBe(raw);
  });

  it('cookie moi hon localStorage (middleware vua refresh) -> tra cookie', async () => {
    const { createCookieSyncStorage } = await import('./supabase');
    store[KEY] = sessionJson(60, 'ls-cu');
    cookieJar[KEY] = encodeURIComponent(sessionJson(3600, 'ck-moi'));
    const got = await createCookieSyncStorage().getItem(KEY);
    expect(got).not.toBeNull();
    expect(JSON.parse(got!).refresh_token).toBe('rt-ck-moi');
  });

  it('localStorage moi hon cookie -> tra localStorage', async () => {
    const { createCookieSyncStorage } = await import('./supabase');
    store[KEY] = sessionJson(3600, 'ls-moi');
    cookieJar[KEY] = encodeURIComponent(sessionJson(60, 'ck-cu'));
    const got = await createCookieSyncStorage().getItem(KEY);
    expect(JSON.parse(got!).refresh_token).toBe('rt-ls-moi');
  });

  it('cookie rac (khong parse duoc) -> giu localStorage', async () => {
    const { createCookieSyncStorage } = await import('./supabase');
    store[KEY] = sessionJson(3600, 'ls');
    cookieJar[KEY] = encodeURIComponent('khong-phai-json');
    expect(await createCookieSyncStorage().getItem(KEY)).toBe(store[KEY]);
  });

  it('key khong phai token -> khong doc cookie', async () => {
    const { createCookieSyncStorage } = await import('./supabase');
    cookieJar['khac'] = 'x';
    expect(await createCookieSyncStorage().getItem('khac')).toBeNull();
  });
});

describe('getSupabaseClient — singleton o trinh duyet', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal('document', { get cookie() { return ''; }, set cookie(_v: string) {} });
    vi.stubGlobal('window', {
      location: { protocol: 'https:' },
      addEventListener: () => {},
    });
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('goi 2 lan cung env -> cung mot instance', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test1.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-1';
    const { getSupabaseClient } = await import('./supabase');
    expect(getSupabaseClient()).toBe(getSupabaseClient());
  });

  it('doi env -> instance moi (khong dung nham project cu)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test2.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-2';
    const { getSupabaseClient } = await import('./supabase');
    const first = getSupabaseClient();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test3.supabase.co';
    const second = getSupabaseClient();
    expect(second).not.toBe(first);
    expect(second).not.toBeNull();
  });

  it('thieu env -> null', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { getSupabaseClient } = await import('./supabase');
    expect(getSupabaseClient()).toBeNull();
  });
});
