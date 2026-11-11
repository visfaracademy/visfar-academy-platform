// Bai tap / bai nop / cham bai — Task 08 (ASSIGNMENT).
//
// NGUYEN TAC (giong Task 07 phan 3/4 + bai hoc B3/B4 trong TASK07_REPORT):
//   * Moi ghi nghiep vu deu qua API route /api/v1/assignments/* (co kiem
//     tra enrollment / instructor / han nop PHIA SERVER) — khong ghi
//     truc tiep tu client vao bang (RLS chi la lop chan cuoi).
//   * File bai nop o bucket PRIVATE 'submissions' (migration 0015):
//     client KHONG BAO GIO thay storage_path hay URL goc. Upload qua
//     POST /api/v1/assignments/[id]/upload (multipart); tai qua
//     GET /api/v1/assignments/[id]/files/[fileId]/download (stream qua
//     server, khong redirect ra URL goc).
//   * Nop lai / cham lai (DECISIONS.md Task 03 QĐ 10): nop lai = tao
//     submission MOI (lich su cu giu lai); cham lai = them review MOI,
//     review moi nhat la ket qua hien hanh. Nhap (draft) thi chi co 1
//     dong / hoc vien / bai tap — luu nhap cap nhat dong nhap do.
//   * Ham thuan (validate / decide / label) tach rieng de unit test
//     khong can DB; ham goi API nhan `fetchFn` de test stub duoc fetch.
//     Yeu cau migration 0015 da ap (cot assignment_type / status,
//     submissions.content_text / is_late / graded_at, bang
//     submission_files); chua ap thi API tra loi ro (400/500), khong
//     che giau thanh trang thai rong.

export type AssignmentType = 'essay' | 'file_upload' | 'mixed';
export type AssignmentStatus = 'draft' | 'published' | 'archived';
export type SubmissionStatus = 'draft' | 'submitted' | 'graded' | 'returned';
export type ReviewStatus = 'graded' | 'returned';

export interface AssignmentDetail {
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  lessonId: string | null;
  lessonSlug: string | null;
  title: string;
  description: string;
  assignmentType: AssignmentType;
  maxScore: number | null;
  dueAt: string | null;
  allowLateSubmission: boolean;
  status: AssignmentStatus;
}

export interface SubmissionFileItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string | null;
  createdAt: string;
}

export interface SubmissionReviewItem {
  id: string;
  score: number | null;
  feedback: string | null;
  status: ReviewStatus;
  reviewerId: string;
  reviewerName: string | null;
  reviewedAt: string;
}

export interface SubmissionItem {
  id: string;
  assignmentId: string;
  userId: string;
  studentName: string | null;
  studentEmail: string | null;
  contentText: string | null;
  status: SubmissionStatus;
  isLate: boolean;
  submittedAt: string;
  gradedAt: string | null;
  files: SubmissionFileItem[];
  /** Review moi nhat (neu co). Lich su cham lai xem o `reviews`. */
  latestReview: SubmissionReviewItem | null;
  reviews: SubmissionReviewItem[];
}

export interface AssignmentContext {
  assignment: AssignmentDetail;
  /** Hoc vien da ghi danh khoa nay (hoac la instructor/admin). */
  enrolled: boolean;
  isInstructor: boolean;
  isAdmin: boolean;
  /** Bai nop cua chinh nguoi goi, moi nhat truoc (null = chua nop). */
  myLatestSubmission: SubmissionItem | null;
  /** Lich su nop cua chinh nguoi goi (moi nhat truoc). */
  mySubmissions: SubmissionItem[];
  /** Chi co khi la instructor/admin: tat ca bai nop (moi nhat truoc). */
  allSubmissions: SubmissionItem[] | null;
}

// ---------------------------------------------------------------------------
// Gioi han file dinh kem (dong bo voi API route upload).
// ---------------------------------------------------------------------------
export const MAX_SUBMISSION_FILE_BYTES = 10 * 1024 * 1024; // 10 MB / file
export const MAX_SUBMISSION_FILES = 5;
export const MAX_SUBMISSION_TEXT_LENGTH = 20000;
export const ALLOWED_SUBMISSION_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'md',
  'png',
  'jpg',
  'jpeg',
] as const;

export function assignmentUrl(courseSlug: string, assignmentId: string): string {
  return `/hoc-vien/khoa-hoc/${encodeURIComponent(courseSlug)}/bai-tap/${encodeURIComponent(assignmentId)}`;
}

export function assignmentGradingUrl(
  courseSlug: string,
  assignmentId: string,
): string {
  return `/hoc-vien/khoa-hoc/${encodeURIComponent(courseSlug)}/bai-tap/${encodeURIComponent(assignmentId)}/cham-bai`;
}

/** Link tai file — chi tro vao API route, khong bao gio lo URL goc. */
export function submissionFileDownloadUrl(
  assignmentId: string,
  fileId: string,
): string {
  return `/api/v1/assignments/${encodeURIComponent(assignmentId)}/files/${encodeURIComponent(fileId)}/download`;
}

export function assignmentTypeLabelVi(type: AssignmentType): string {
  if (type === 'file_upload') return 'Nộp file';
  if (type === 'mixed') return 'Viết bài + nộp file';
  return 'Viết bài trực tiếp';
}

export function submissionStatusLabelVi(status: SubmissionStatus): string {
  if (status === 'draft') return 'Bản nháp';
  if (status === 'submitted') return 'Đã nộp — chờ chấm';
  if (status === 'graded') return 'Đã chấm';
  return 'Trả lại — làm lại';
}

export function reviewStatusLabelVi(status: ReviewStatus): string {
  return status === 'returned' ? 'Trả lại để làm lại' : 'Đã chấm điểm';
}

export function isOverdue(dueAt: string | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

/** Bai nop moi nhat (danh sach da sap moi nhat truoc). */
export function latestSubmission(
  submissions: SubmissionItem[],
): SubmissionItem | null {
  return submissions.length > 0 ? submissions[0] : null;
}

/** Review moi nhat cua 1 bai nop (danh sach da sap moi nhat truoc). */
export function latestReview(
  reviews: SubmissionReviewItem[],
): SubmissionReviewItem | null {
  return reviews.length > 0 ? reviews[0] : null;
}

// ---------------------------------------------------------------------------
// Validation thuan — dung chung client + API route (1 nguon su that).
// Tra null khi hop le, tra thong bao loi tieng Viet khi khong hop le.
// ---------------------------------------------------------------------------

export interface AssignmentInput {
  courseId?: unknown;
  lessonId?: unknown;
  title?: unknown;
  description?: unknown;
  assignmentType?: unknown;
  maxScore?: unknown;
  dueAt?: unknown;
  allowLateSubmission?: unknown;
  status?: unknown;
}

export function validateAssignmentInput(input: AssignmentInput): string | null {
  if (typeof input.courseId !== 'string' || input.courseId.trim() === '') {
    return 'Thiếu mã khóa học.';
  }
  if (typeof input.title !== 'string' || input.title.trim() === '') {
    return 'Vui lòng nhập tên bài tập.';
  }
  if (input.title.trim().length > 200) {
    return 'Tên bài tập tối đa 200 ký tự.';
  }
  if (typeof input.description !== 'string' || input.description.trim() === '') {
    return 'Vui lòng nhập đề bài / yêu cầu.';
  }
  if (
    input.assignmentType !== undefined &&
    input.assignmentType !== 'essay' &&
    input.assignmentType !== 'file_upload' &&
    input.assignmentType !== 'mixed'
  ) {
    return 'Loại bài tập không hợp lệ.';
  }
  if (input.maxScore !== undefined && input.maxScore !== null) {
    if (typeof input.maxScore !== 'number' || !Number.isInteger(input.maxScore)) {
      return 'Điểm tối đa phải là số nguyên.';
    }
    if (input.maxScore <= 0 || input.maxScore > 100) {
      return 'Điểm tối đa phải từ 1 đến 100.';
    }
  }
  if (input.dueAt !== undefined && input.dueAt !== null) {
    if (typeof input.dueAt !== 'string' || Number.isNaN(Date.parse(input.dueAt))) {
      return 'Hạn nộp không phải ngày giờ hợp lệ.';
    }
  }
  if (
    input.status !== undefined &&
    input.status !== 'draft' &&
    input.status !== 'published' &&
    input.status !== 'archived'
  ) {
    return 'Trạng thái bài tập không hợp lệ.';
  }
  return null;
}

export interface SubmissionInput {
  contentText?: unknown;
  fileCount?: number;
  action?: unknown;
}

/**
 * Bai nop phai co noi dung viet HOAC file dinh kem (giong CHECK o DB).
 * Voi loai file_upload: chi file cung du (khong bat buoc viet).
 * Voi loai essay: chi viet cung du. Mixed: 1 trong 2 la du.
 */
export function validateSubmissionInput(
  input: SubmissionInput,
  assignmentType: AssignmentType,
): string | null {
  const text =
    typeof input.contentText === 'string' ? input.contentText.trim() : '';
  if (text.length > MAX_SUBMISSION_TEXT_LENGTH) {
    return `Nội dung bài làm tối đa ${MAX_SUBMISSION_TEXT_LENGTH.toLocaleString('vi-VN')} ký tự.`;
  }
  const fileCount = typeof input.fileCount === 'number' ? input.fileCount : 0;
  if (assignmentType === 'essay' && text === '') {
    return 'Vui lòng viết nội dung bài làm trước khi nộp.';
  }
  if (assignmentType === 'file_upload' && fileCount === 0) {
    return 'Vui lòng đính kèm ít nhất 1 file trước khi nộp.';
  }
  if (assignmentType === 'mixed' && text === '' && fileCount === 0) {
    return 'Vui lòng viết nội dung bài làm hoặc đính kèm file trước khi nộp.';
  }
  if (input.action !== undefined && input.action !== 'draft' && input.action !== 'submit') {
    return 'Hành động nộp bài không hợp lệ.';
  }
  return null;
}

export interface ReviewInput {
  score?: unknown;
  feedback?: unknown;
  status?: unknown;
}

export function validateReviewInput(
  input: ReviewInput,
  maxScore: number | null,
): string | null {
  if (input.status !== 'graded' && input.status !== 'returned') {
    return 'Kết quả chấm phải là “Đã chấm điểm” hoặc “Trả lại để làm lại”.';
  }
  if (input.score !== undefined && input.score !== null) {
    if (typeof input.score !== 'number' || !Number.isInteger(input.score)) {
      return 'Điểm chấm phải là số nguyên.';
    }
    if (input.score < 0) {
      return 'Điểm chấm không được âm.';
    }
    if (maxScore !== null && input.score > maxScore) {
      return `Điểm chấm không được vượt điểm tối đa (${maxScore}).`;
    }
  }
  // Cham 'graded' cho bai co diem toi da thi bat buoc co diem; bai chi
  // nhan xet (maxScore null) thi diem duoc de trong.
  if (input.status === 'graded' && maxScore !== null && input.score == null) {
    return 'Vui lòng nhập điểm chấm (bài này có điểm tối đa).';
  }
  if (typeof input.feedback === 'string' && input.feedback.length > 5000) {
    return 'Nhận xét tối đa 5.000 ký tự.';
  }
  return null;
}

export interface UploadFileInput {
  name: string;
  size: number;
  type?: string;
}

/** Kiem tra 1 file truoc khi upload (ten, duoi, dung luong). */
export function validateUploadFile(file: UploadFileInput): string | null {
  const name = file.name.trim();
  if (name === '') return 'Tên file trống.';
  const match = name.match(/\.([A-Za-z0-9]{1,10})$/);
  if (!match) return 'File phải có đuôi mở rộng (vd. .pdf, .docx).';
  const ext = match[1].toLowerCase();
  if (!(ALLOWED_SUBMISSION_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Định dạng .${ext} chưa được hỗ trợ. Chỉ nhận: ${ALLOWED_SUBMISSION_EXTENSIONS.map((e) => `.${e}`).join(', ')}.`;
  }
  if (file.size <= 0) return 'File trống, không thể nộp.';
  if (file.size > MAX_SUBMISSION_FILE_BYTES) {
    return `File “${name}” vượt giới hạn 10 MB.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Quyet dinh thuan: duoc nop / nop lai / nop muon hay khong.
// ---------------------------------------------------------------------------

export interface CanSubmitInput {
  assignmentStatus: AssignmentStatus;
  assignmentType: AssignmentType;
  dueAt: string | null;
  allowLateSubmission: boolean;
  /** Bai nop moi nhat cua hoc vien (null = chua nop lan nao). */
  latest: SubmissionItem | null;
  now?: Date;
}

/**
 * - Bai draft/archived: khong nhan bai.
 * - Da cham (graded): khong nop lai nua (bai da hoan tat).
 * - Da nop cho cham / bi tra lai / chi co nhap: duoc nop (lai).
 * - Qua han + khong cho nop muon: khong duoc nop; qua han + cho nop
 *   muon: duoc, bai se danh dau is_late.
 */
export function decideCanSubmit(input: CanSubmitInput): {
  allowed: boolean;
  reason: string | null;
  willBeLate: boolean;
} {
  if (input.assignmentStatus !== 'published') {
    return {
      allowed: false,
      reason:
        input.assignmentStatus === 'draft'
          ? 'Bài tập chưa mở nhận bài.'
          : 'Bài tập đã đóng, chỉ xem lại lịch sử.',
      willBeLate: false,
    };
  }
  const overdue = isOverdue(input.dueAt, input.now ?? new Date());
  if (overdue && !input.allowLateSubmission) {
    return { allowed: false, reason: 'Đã quá hạn nộp và bài này không cho nộp muộn.', willBeLate: true };
  }
  if (input.latest && input.latest.status === 'graded') {
    return { allowed: false, reason: 'Bài đã được chấm, không cần nộp lại.', willBeLate: overdue };
  }
  return { allowed: true, reason: null, willBeLate: overdue };
}

/** Co phai la lan nop lai (da co bai nop truoc do, khong tinh nhap)? */
export function isResubmission(latest: SubmissionItem | null): boolean {
  return latest !== null && latest.status !== 'draft';
}

// ---------------------------------------------------------------------------
// Goi API route /api/v1/assignments/* (fetch). `fetchFn` mac dinh la
// fetch toan cuc — test truyen stub vao. Moi ham tra { ok, ... } hoac
// { ok: false, error } — khong bao gio throw do loi HTTP.
// ---------------------------------------------------------------------------

export type FetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const defaultFetch: FetchFn = (input, init) =>
  fetch(input, init) as unknown as Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>;

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function readApi<T>(
  res: { ok: boolean; status: number; json: () => Promise<unknown> },
): Promise<ApiResult<T>> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: 'Máy chủ trả về dữ liệu không hợp lệ.' };
  }
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
  const obj = body as Record<string, unknown>;
  if (obj.ok !== true) {
    // Giu nguyen message loi cua server (vd. 404 'Không tìm thấy bài
    // tập.') thay vi doi thanh loi chung — chi dung loi chung khi server
    // khong tra message.
    if (typeof obj.error === 'string' && obj.error.trim() !== '') {
      return { ok: false, error: obj.error };
    }
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
  return { ok: true, data: obj as unknown as T };
}

export async function getAssignmentDetail(
  assignmentId: string,
  fetchFn: FetchFn = defaultFetch,
): Promise<ApiResult<AssignmentContext>> {
  try {
    const res = await fetchFn(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}`,
    );
    return readApi<AssignmentContext>(res);
  } catch {
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
}

export async function createAssignment(
  input: {
    courseId: string;
    lessonId?: string | null;
    title: string;
    description: string;
    assignmentType: AssignmentType;
    maxScore?: number | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    status?: AssignmentStatus;
  },
  fetchFn: FetchFn = defaultFetch,
): Promise<ApiResult<{ assignmentId: string }>> {
  const validationError = validateAssignmentInput(input);
  if (validationError) return { ok: false, error: validationError };
  try {
    const res = await fetchFn('/api/v1/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return readApi<{ assignmentId: string }>(res);
  } catch {
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
}

export async function saveSubmission(
  assignmentId: string,
  input: { contentText: string; action: 'draft' | 'submit' },
  fetchFn: FetchFn = defaultFetch,
): Promise<ApiResult<{ submission: SubmissionItem; willBeLate?: boolean }>> {
  try {
    const res = await fetchFn(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/submissions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    return readApi<{ submission: SubmissionItem; willBeLate?: boolean }>(res);
  } catch {
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
}

/**
 * Upload 1 file dinh kem qua API (multipart). Server tao/cap nhat nhap
 * (draft) neu chua co, upload len bucket private 'submissions', ghi dong
 * submission_files. Tra ve file da ghi — KHONG bao gom storage_path
 * hay URL goc.
 */
export async function uploadSubmissionFile(
  assignmentId: string,
  file: File,
  fetchFn: FetchFn = defaultFetch,
): Promise<ApiResult<{ file: SubmissionFileItem; submissionId: string }>> {
  const validationError = validateUploadFile({ name: file.name, size: file.size });
  if (validationError) return { ok: false, error: validationError };
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetchFn(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/upload`,
      { method: 'POST', body: form },
    );
    return readApi<{ file: SubmissionFileItem; submissionId: string }>(res);
  } catch {
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
}

export async function listAssignmentSubmissions(
  assignmentId: string,
  fetchFn: FetchFn = defaultFetch,
): Promise<ApiResult<{ submissions: SubmissionItem[] }>> {
  try {
    const res = await fetchFn(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    );
    return readApi<{ submissions: SubmissionItem[] }>(res);
  } catch {
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
}

export async function gradeSubmission(
  assignmentId: string,
  submissionId: string,
  input: { score: number | null; feedback: string; status: ReviewStatus },
  fetchFn: FetchFn = defaultFetch,
): Promise<ApiResult<{ review: SubmissionReviewItem }>> {
  try {
    const res = await fetchFn(
      `/api/v1/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/reviews`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    return readApi<{ review: SubmissionReviewItem }>(res);
  } catch {
    return { ok: false, error: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
  }
}
