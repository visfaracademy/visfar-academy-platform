// Test handler tra cuu email logs (admin) — JWT/role/findLogs mock.
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { handleAdminEmailLogs } from './logs';
import type { FindEmailLogsResult } from './store';

const env = { SUPABASE_URL: 'https://test.supabase.co' } as unknown as Env;

const fakeLogs: FindEmailLogsResult = {
  logs: [
    {
      id: 'log-1',
      to_email: 'a@example.com',
      template: 'E9',
      resend_id: 're_1',
      status: 'delivered',
      error_message: null,
      sent_at: '2026-11-10T01:00:00Z',
      attempts: 1,
      next_retry_at: null,
      related_type: null,
      related_id: null,
      created_at: '2026-11-10T01:00:00Z',
      updated_at: '2026-11-10T01:00:00Z',
    },
  ],
  page: 1,
  limit: 20,
  hasMore: false,
};

function authReq(): Request {
  return new Request(
    'https://api.test/api/admin/reports/email?to_email=a@example.com&template=E9&page=1&limit=20',
    { headers: { Authorization: 'Bearer jwt-hop-le' } },
  );
}

describe('handleAdminEmailLogs', () => {
  it('admin: 200 + logs + truyen dung filter', async () => {
    const findLogs = vi.fn(async () => fakeLogs);
    const res = await handleAdminEmailLogs(env, authReq(), {
      verifyJwt: async () => ({ userId: 'admin-1', claims: {} }),
      getRole: async () => 'admin',
      findLogs,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; logs: unknown[]; pagination: unknown };
    expect(body.ok).toBe(true);
    expect(body.logs).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 1, limit: 20, hasMore: false });
    expect(findLogs).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ toEmail: 'a@example.com', template: 'E9' }),
    );
  });

  it('thieu JWT: 401', async () => {
    const req = new Request('https://api.test/api/admin/reports/email');
    const res = await handleAdminEmailLogs(env, req, {
      verifyJwt: async () => ({ userId: 'x', claims: {} }),
      getRole: async () => 'admin',
      findLogs: vi.fn(async () => fakeLogs),
    });
    expect(res.status).toBe(401);
  });

  it('JWT sai: 401', async () => {
    const res = await handleAdminEmailLogs(env, authReq(), {
      verifyJwt: async () => {
        throw new Error('JWT signature mismatch');
      },
      getRole: async () => 'admin',
      findLogs: vi.fn(async () => fakeLogs),
    });
    expect(res.status).toBe(401);
  });

  it('khong phai admin (student): 403, khong goi findLogs', async () => {
    const findLogs = vi.fn(async () => fakeLogs);
    const res = await handleAdminEmailLogs(env, authReq(), {
      verifyJwt: async () => ({ userId: 'student-1', claims: {} }),
      getRole: async () => 'student',
      findLogs,
    });
    expect(res.status).toBe(403);
    expect(findLogs).not.toHaveBeenCalled();
  });
});
