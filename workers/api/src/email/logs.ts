// Tra cuu email logs (admin) — TASK 11.
//
//   GET /api/admin/reports/email?to_email=&template=&status=&from=&to=&page=&limit=
//   Can JWT + role admin (doc profiles.role — cache dong bo tu
//   user_roles). Khong co JWT / JWT sai -> 401; khong phai admin -> 403.
// Tra { logs, pagination: { page, limit, hasMore } } — xem
// findEmailLogs o store.ts (hasMore thay cho total vi PostgREST
// count header khong di qua sbFetch).

import { ApiError, jsonError, jsonOk } from '../errors';
import type { Env } from '../env';
import { extractBearerToken, verifySupabaseJwt } from '../jwt';
import { findEmailLogs, getProfileRole } from './store';

export interface AdminEmailLogsDeps {
  findLogs?: typeof findEmailLogs;
  getRole?: typeof getProfileRole;
  /** Ham xac minh JWT — inject trong test de khong can JWKS that. */
  verifyJwt?: typeof verifySupabaseJwt;
}

export async function handleAdminEmailLogs(
  env: Env,
  req: Request,
  deps: AdminEmailLogsDeps = {},
): Promise<Response> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return jsonError(new ApiError(401, 'unauthorized', 'Vui lòng đăng nhập.'));
    }
    const verifyJwt = deps.verifyJwt ?? verifySupabaseJwt;
    let userId: string;
    try {
      const verified = await verifyJwt(token, env.SUPABASE_URL);
      userId = verified.userId;
    } catch {
      return jsonError(new ApiError(401, 'unauthorized', 'Phiên đăng nhập không hợp lệ.'));
    }
    const getRole = deps.getRole ?? getProfileRole;
    const role = await getRole(env, userId);
    if (role !== 'admin') {
      return jsonError(new ApiError(403, 'forbidden', 'Bạn không có quyền xem nhật ký email.'));
    }
    const url = new URL(req.url);
    const q = url.searchParams;
    const page = Number(q.get('page') ?? '1');
    const limit = Number(q.get('limit') ?? '20');
    const findLogs = deps.findLogs ?? findEmailLogs;
    const result = await findLogs(env, {
      toEmail: q.get('to_email') ?? undefined,
      template: q.get('template') ?? undefined,
      status: q.get('status') ?? undefined,
      from: q.get('from') ?? undefined,
      to: q.get('to') ?? undefined,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return jsonOk({
      logs: result.logs,
      pagination: { page: result.page, limit: result.limit, hasMore: result.hasMore },
    });
  } catch (err) {
    if (err instanceof ApiError) return jsonError(err);
    return jsonError(
      new ApiError(500, 'server_error', 'Hệ thống đang bận. Vui lòng thử lại sau.'),
    );
  }
}
