// POST /api/v1/leads — API_ARCHITECTURE.md §9.
// Luong: rate-limit -> honeypot -> validation server -> Turnstile ->
// idempotency -> khoa ton tai -> ghi DB (nguon su that) -> ghi Sheet
// (ban sao doi soat). CHI tra 201 khi ghi DB da xac nhan; Sheet loi
// sau do van 201 kem sheetSynced:false + log (khong thanh cong gia,
// khong bien loi Sheet thanh loi lead).
//
// Frontend gui (apps/web/src/lib/leads.ts — camelCase):
//   { fullName, phone, email, province, courseId|null,
//     courseInterestText, source, turnstileToken|null, honeypot:'' }
// Header: Idempotency-Key. Tra ve: { ok:true, referenceCode,
// duplicate?, sheetSynced? } — frontend chap nhan ca referenceCode
// va reference_code.
import type { Env } from '../env';
import { safeLog } from '../env';
import { ApiError, jsonOk, serverError } from '../errors';
import { checkRateLimit, getClientIp } from '../rate-limit';
import { postLeadToSheet } from '../sheet';
import {
  getLeadByIdempotencyKey,
  getPublishedCourse,
  insertLead,
  isUniqueViolation,
  notConfiguredError,
  requireSbOk,
  type LeadRow,
} from '../supabase';
import { verifyTurnstile } from '../turnstile';
import {
  asTrimmedString,
  generateReferenceCode,
  isUuid,
  pickField,
  validateEmail,
  validateFullName,
  validatePhone,
  validateProvince,
} from '../validation';
import { isSupabaseConfigured } from '../env';

const LEAD_RATE_LIMIT = 5;
const LEAD_RATE_WINDOW_MS = 60 * 60 * 1000;

interface NormalizedLead {
  fullName: string;
  phone: string;
  email: string;
  province: string;
  courseId: string | null;
  courseInterestText: string;
  source: string;
  turnstileToken: string | null;
}

function sameLead(a: LeadRow, b: NormalizedLead): boolean {
  return (
    a.full_name === b.fullName &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.province === b.province &&
    (a.course_id ?? null) === b.courseId &&
    (a.course_interest_text ?? '') === b.courseInterestText &&
    a.source === b.source
  );
}

export async function handleCreateLead(req: Request, env: Env): Promise<Response> {
  // Rate-limit dem ca request loi validation (tru 401/403 — endpoint
  // nay khong co auth nen moi request deu dem).
  const ip = getClientIp(req);
  const rl = await checkRateLimit(env, `leads:${ip}`, LEAD_RATE_LIMIT, LEAD_RATE_WINDOW_MS);
  if (!rl.allowed) {
    throw new ApiError(429, 'rate_limited', 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.', {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch {
    throw new ApiError(400, 'invalid_input', 'Dữ liệu gửi lên không đúng định dạng.');
  }

  // Honeypot: field an phai rong. Bot dien vao -> spam, khong ghi.
  // Chap nhan ca `honeypot` (leads.ts gui) va `website` (ten field form).
  const honeypot = asTrimmedString(body['honeypot'] ?? body['website']);
  if (honeypot !== '') {
    throw new ApiError(400, 'spam_suspected', 'Không thể ghi nhận đăng ký lúc này.');
  }

  const lead: NormalizedLead = {
    fullName: asTrimmedString(pickField(body, 'fullName', 'full_name')),
    phone: asTrimmedString(pickField(body, 'phone', 'phone')),
    email: asTrimmedString(pickField(body, 'email', 'email')),
    province: asTrimmedString(pickField(body, 'province', 'province')),
    courseId: null,
    courseInterestText: asTrimmedString(pickField(body, 'courseInterestText', 'course_interest_text')),
    source: asTrimmedString(pickField(body, 'source', 'source')) || 'visfar-academy',
    turnstileToken: null,
  };
  const rawCourseId = pickField(body, 'courseId', 'course_id');
  if (rawCourseId !== null && rawCourseId !== undefined) {
    if (typeof rawCourseId !== 'string') {
      throw new ApiError(400, 'invalid_course', 'Khóa học quan tâm chưa đúng.');
    }
    lead.courseId = rawCourseId.trim() || null;
  }
  const rawToken = pickField(body, 'turnstileToken', 'turnstile_token');
  if (typeof rawToken === 'string' && rawToken.trim()) lead.turnstileToken = rawToken.trim();

  if (!validateFullName(lead.fullName)) {
    throw new ApiError(400, 'invalid_input', 'Vui lòng nhập họ và tên (2–100 ký tự).');
  }
  if (!validatePhone(lead.phone)) {
    throw new ApiError(400, 'invalid_phone', 'Số điện thoại phải là 10 số, bắt đầu bằng 0.');
  }
  if (!validateEmail(lead.email)) {
    throw new ApiError(400, 'invalid_email', 'Email chưa đúng định dạng.');
  }
  if (!validateProvince(lead.province)) {
    throw new ApiError(400, 'invalid_province', 'Vui lòng chọn tỉnh / thành phố trong danh sách.');
  }
  if (!lead.courseInterestText) {
    throw new ApiError(400, 'invalid_course', 'Vui lòng chọn khóa học hoặc nội dung quan tâm.');
  }
  if (lead.courseId !== null && !isUuid(lead.courseId)) {
    throw new ApiError(400, 'invalid_course', 'Khóa học quan tâm chưa đúng.');
  }

  // Chi request da qua validation moi can DB: chua cau hinh -> 503.
  // (Validation thuan chay truoc de local dev khong secret van thay
  // 400/429 that.)
  if (!isSupabaseConfigured(env)) throw notConfiguredError();

  // Turnstile (neu co secret + token): sai/het han -> spam, khong ghi.
  // Khong co token -> cho qua + log (Task 03 QĐ 13).
  const ts = await verifyTurnstile(lead.turnstileToken, env.TURNSTILE_SECRET);
  if (!ts.ok) {
    throw new ApiError(400, 'spam_suspected', 'Không thể ghi nhận đăng ký lúc này.');
  }

  // Idempotency: key do client gui; thieu key -> sinh key server
  // (khong dedup duoc, nhung van ghi dung 1 lan).
  const idempotencyKey = req.headers.get('Idempotency-Key')?.trim() || `server-${crypto.randomUUID()}`;
  const existing = await getLeadByIdempotencyKey(env, idempotencyKey);
  if (existing) {
    if (!sameLead(existing, lead)) {
      throw new ApiError(
        409,
        'idempotency_conflict',
        'Yêu cầu này đã được gửi với nội dung khác. Vui lòng gửi lại với mã mới.',
      );
    }
    return jsonOk({ referenceCode: existing.reference_code, duplicate: true }, 200);
  }

  // Khoa quan tam phai ton tai + published (null = "Chua biet bat dau tu dau").
  if (lead.courseId !== null) {
    const course = await getPublishedCourse(env, lead.courseId);
    if (!course) {
      throw new ApiError(400, 'invalid_course', 'Khóa học quan tâm không tồn tại hoặc chưa mở đăng ký.');
    }
  }

  // Ghi DB — buoc bat buoc. Thu lai ma tham chieu khi trung UNIQUE.
  let saved: LeadRow | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const referenceCode = generateReferenceCode();
    const result = await insertLead(env, {
      reference_code: referenceCode,
      idempotency_key: idempotencyKey,
      full_name: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      province: lead.province,
      course_id: lead.courseId,
      course_interest_text: lead.courseInterestText,
      source: lead.source,
    });
    if (result.error) {
      if (isUniqueViolation(result.error)) {
        // Race: request song song cung key, hoac trung ma tham chieu.
        const raced = await getLeadByIdempotencyKey(env, idempotencyKey);
        if (raced) {
          if (!sameLead(raced, lead)) {
            throw new ApiError(
              409,
              'idempotency_conflict',
              'Yêu cầu này đã được gửi với nội dung khác. Vui lòng gửi lại với mã mới.',
            );
          }
          return jsonOk({ referenceCode: raced.reference_code, duplicate: true }, 200);
        }
        continue; // Trung reference_code -> sinh ma moi, thu lai.
      }
      // Ghi DB loi (VD rang buoc CHECK, Supabase loi) -> 502, KHONG 201.
      safeLog('lead insert failed', { reason: `${result.error.code ?? ''} ${result.error.message}` });
      throw new ApiError(502, 'upstream_error', 'Hệ thống chưa ghi nhận được. Vui lòng thử lại sau.');
    }
    const rows = requireSbOk(result, 'insertLead');
    if (!rows || rows.length === 0 || !rows[0]?.reference_code) {
      throw serverError('insertLead returned no row');
    }
    saved = rows[0] as LeadRow;
    break;
  }
  if (!saved) throw serverError('insertLead exhausted retries');

  safeLog('lead saved', { referenceCode: saved.reference_code });

  // Ghi Sheet (ban sao doi soat). Loi o day KHONG lam mat 201:
  // DB da xac nhan, admin doi soat sau qua bao cao R9.
  const sheet = await postLeadToSheet(env.APPS_SCRIPT_URL, {
    source: lead.source,
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    province: lead.province,
    course: lead.courseInterestText,
    referenceCode: saved.reference_code,
    idempotencyKey,
  });

  return jsonOk(
    {
      referenceCode: saved.reference_code,
      message: 'Đã ghi nhận.',
      duplicate: false,
      sheetSynced: sheet.synced,
    },
    201,
  );
}
