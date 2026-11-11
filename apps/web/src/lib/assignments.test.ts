// Test Task 08 (ASSIGNMENT): lib assignments.ts.
// Chay local, khong can Supabase that. Ham thuan test truc tiep; ham goi
// API test bang stub fetch (khong goi mang that, khong mock DB).
import { describe, expect, it } from 'vitest';
import {
  assignmentGradingUrl,
  assignmentTypeLabelVi,
  assignmentUrl,
  createAssignment,
  decideCanSubmit,
  getAssignmentDetail,
  gradeSubmission,
  isOverdue,
  isResubmission,
  latestReview,
  latestSubmission,
  listAssignmentSubmissions,
  saveSubmission,
  submissionFileDownloadUrl,
  submissionStatusLabelVi,
  uploadSubmissionFile,
  validateAssignmentInput,
  validateReviewInput,
  validateSubmissionInput,
  validateUploadFile,
  type FetchFn,
  type SubmissionItem,
} from './assignments';

function submission(
  overrides: Partial<SubmissionItem> = {},
): SubmissionItem {
  return {
    id: 'sub-1',
    assignmentId: 'asg-1',
    userId: 'user-1',
    studentName: 'Nguyễn Văn A',
    studentEmail: 'a@example.com',
    contentText: 'Bai lam.',
    status: 'submitted',
    isLate: false,
    submittedAt: '2026-11-10T10:00:00.000Z',
    gradedAt: null,
    files: [],
    latestReview: null,
    reviews: [],
    ...overrides,
  };
}

function stubFetch(
  body: unknown,
  ok = true,
  status = 200,
): FetchFn {
  return async () => ({ ok, status, json: async () => body });
}

describe('labels + url', () => {
  it('assignmentUrl / gradingUrl / downloadUrl khong lo URL goc', () => {
    expect(assignmentUrl('thau-hieu-noi-tam', 'asg-1')).toBe(
      '/hoc-vien/khoa-hoc/thau-hieu-noi-tam/bai-tap/asg-1',
    );
    expect(assignmentGradingUrl('thau-hieu-noi-tam', 'asg-1')).toBe(
      '/hoc-vien/khoa-hoc/thau-hieu-noi-tam/bai-tap/asg-1/cham-bai',
    );
    const url = submissionFileDownloadUrl('asg-1', 'file-1');
    expect(url).toBe('/api/v1/assignments/asg-1/files/file-1/download');
    expect(url).not.toContain('supabase');
    expect(url).not.toContain('storage');
  });

  it('nhan trang thai + loai bai tap tieng Viet', () => {
    expect(submissionStatusLabelVi('draft')).toBe('Bản nháp');
    expect(submissionStatusLabelVi('submitted')).toBe('Đã nộp — chờ chấm');
    expect(submissionStatusLabelVi('graded')).toBe('Đã chấm');
    expect(submissionStatusLabelVi('returned')).toBe('Trả lại — làm lại');
    expect(assignmentTypeLabelVi('essay')).toBe('Viết bài trực tiếp');
    expect(assignmentTypeLabelVi('file_upload')).toBe('Nộp file');
    expect(assignmentTypeLabelVi('mixed')).toBe('Viết bài + nộp file');
  });
});

describe('validateAssignmentInput (giao bai)', () => {
  const base = {
    courseId: 'course-1',
    title: 'Bài tập 1',
    description: 'Hãy viết 500 chữ.',
  };
  it('hop le khi du truong', () => {
    expect(validateAssignmentInput(base)).toBeNull();
    expect(
      validateAssignmentInput({ ...base, assignmentType: 'mixed', maxScore: 10 }),
    ).toBeNull();
  });
  it('thieu khoa / ten / de bai thi loi', () => {
    expect(validateAssignmentInput({ ...base, courseId: '' })).toBe('Thiếu mã khóa học.');
    expect(validateAssignmentInput({ ...base, title: '  ' })).toBe(
      'Vui lòng nhập tên bài tập.',
    );
    expect(validateAssignmentInput({ ...base, description: '' })).toBe(
      'Vui lòng nhập đề bài / yêu cầu.',
    );
  });
  it('diem toi da phai la so nguyen 1..100', () => {
    expect(validateAssignmentInput({ ...base, maxScore: 0 })).toBe(
      'Điểm tối đa phải từ 1 đến 100.',
    );
    expect(validateAssignmentInput({ ...base, maxScore: 101 })).toBe(
      'Điểm tối đa phải từ 1 đến 100.',
    );
    expect(validateAssignmentInput({ ...base, maxScore: 7.5 })).toBe(
      'Điểm tối đa phải là số nguyên.',
    );
  });
  it('loai bai tap + han nop + trang thai sai thi loi', () => {
    expect(validateAssignmentInput({ ...base, assignmentType: 'quiz' })).toBe(
      'Loại bài tập không hợp lệ.',
    );
    expect(validateAssignmentInput({ ...base, dueAt: 'khong-phai-ngay' })).toBe(
      'Hạn nộp không phải ngày giờ hợp lệ.',
    );
    expect(validateAssignmentInput({ ...base, status: 'open' })).toBe(
      'Trạng thái bài tập không hợp lệ.',
    );
  });
});

describe('validateSubmissionInput (nop bai)', () => {
  it('essay: bat buoc co chu; file_upload: bat buoc co file; mixed: 1 trong 2', () => {
    expect(validateSubmissionInput({ contentText: '' }, 'essay')).toBe(
      'Vui lòng viết nội dung bài làm trước khi nộp.',
    );
    expect(validateSubmissionInput({ contentText: 'Bai lam.' }, 'essay')).toBeNull();
    expect(validateSubmissionInput({ fileCount: 0 }, 'file_upload')).toBe(
      'Vui lòng đính kèm ít nhất 1 file trước khi nộp.',
    );
    expect(validateSubmissionInput({ fileCount: 1 }, 'file_upload')).toBeNull();
    expect(validateSubmissionInput({ contentText: '', fileCount: 0 }, 'mixed')).toBe(
      'Vui lòng viết nội dung bài làm hoặc đính kèm file trước khi nộp.',
    );
    expect(validateSubmissionInput({ contentText: 'x', fileCount: 0 }, 'mixed')).toBeNull();
  });
  it('noi dung qua dai thi loi', () => {
    expect(
      validateSubmissionInput({ contentText: 'x'.repeat(20001) }, 'essay'),
    ).toMatch('tối đa 20.000 ký tự');
  });
});

describe('validateReviewInput (cham bai)', () => {
  it('diem vuot maxScore thi loi; thieu diem khi bai co maxScore thi loi', () => {
    expect(
      validateReviewInput({ score: 11, feedback: '', status: 'graded' }, 10),
    ).toBe('Điểm chấm không được vượt điểm tối đa (10).');
    expect(
      validateReviewInput({ score: null, feedback: '', status: 'graded' }, 10),
    ).toBe('Vui lòng nhập điểm chấm (bài này có điểm tối đa).');
    expect(
      validateReviewInput({ score: 8, feedback: 'Tốt.', status: 'graded' }, 10),
    ).toBeNull();
  });
  it('bai chi nhan xet (maxScore null) duoc cham khong diem', () => {
    expect(
      validateReviewInput({ score: null, feedback: 'Tốt.', status: 'graded' }, null),
    ).toBeNull();
  });
  it('tra lai (returned) khong bat buoc diem; status sai thi loi', () => {
    expect(
      validateReviewInput({ score: null, feedback: 'Làm lại.', status: 'returned' }, 10),
    ).toBeNull();
    expect(
      validateReviewInput({ score: 5, feedback: '', status: 'approved' }, 10),
    ).toBe('Kết quả chấm phải là “Đã chấm điểm” hoặc “Trả lại để làm lại”.');
    expect(
      validateReviewInput({ score: -1, feedback: '', status: 'graded' }, 10),
    ).toBe('Điểm chấm không được âm.');
  });
});

describe('validateUploadFile', () => {
  it('chap nhan pdf/docx/anh duoi 10 MB', () => {
    expect(validateUploadFile({ name: 'bai-lam.pdf', size: 1024 })).toBeNull();
    expect(validateUploadFile({ name: 'anh.PNG', size: 5 * 1024 * 1024 })).toBeNull();
  });
  it('chan duoi khong ho tro, file rong, file qua 10 MB', () => {
    expect(validateUploadFile({ name: 'bai.exe', size: 100 })).toMatch('chưa được hỗ trợ');
    expect(validateUploadFile({ name: 'trong.pdf', size: 0 })).toBe(
      'File trống, không thể nộp.',
    );
    expect(validateUploadFile({ name: 'lon.pdf', size: 10 * 1024 * 1024 + 1 })).toMatch(
      'vượt giới hạn 10 MB',
    );
    expect(validateUploadFile({ name: 'khong-duoi', size: 100 })).toBe(
      'File phải có đuôi mở rộng (vd. .pdf, .docx).',
    );
  });
});

describe('decideCanSubmit', () => {
  const base = {
    assignmentStatus: 'published' as const,
    assignmentType: 'essay' as const,
    dueAt: null as string | null,
    allowLateSubmission: false,
    latest: null as SubmissionItem | null,
  };
  it('bai dang mo, chua nop: duoc nop', () => {
    const r = decideCanSubmit(base);
    expect(r.allowed).toBe(true);
    expect(r.willBeLate).toBe(false);
  });
  it('bai draft/archived: khong nhan bai', () => {
    expect(decideCanSubmit({ ...base, assignmentStatus: 'draft' }).allowed).toBe(false);
    expect(decideCanSubmit({ ...base, assignmentStatus: 'archived' }).allowed).toBe(false);
  });
  it('qua han + khong cho nop muon: chan; cho nop muon: duoc, danh dau muon', () => {
    const past = { ...base, dueAt: '2026-11-01T00:00:00.000Z' };
    expect(decideCanSubmit(past).allowed).toBe(false);
    const late = decideCanSubmit({ ...past, allowLateSubmission: true });
    expect(late.allowed).toBe(true);
    expect(late.willBeLate).toBe(true);
  });
  it('da cham xong: khong nop lai; bi tra lai: duoc nop lai', () => {
    expect(
      decideCanSubmit({ ...base, latest: submission({ status: 'graded' }) }).allowed,
    ).toBe(false);
    expect(
      decideCanSubmit({ ...base, latest: submission({ status: 'returned' }) }).allowed,
    ).toBe(true);
    expect(
      decideCanSubmit({ ...base, latest: submission({ status: 'submitted' }) }).allowed,
    ).toBe(true);
    expect(isResubmission(submission({ status: 'returned' }))).toBe(true);
    expect(isResubmission(submission({ status: 'draft' }))).toBe(false);
    expect(isResubmission(null)).toBe(false);
  });
});

describe('isOverdue / latest helpers', () => {
  it('qua han theo gio hien tai', () => {
    expect(isOverdue('2026-11-01T00:00:00.000Z', new Date('2026-11-10T00:00:00Z'))).toBe(true);
    expect(isOverdue('2026-12-01T00:00:00.000Z', new Date('2026-11-10T00:00:00Z'))).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });
  it('latestSubmission / latestReview lay phan tu dau (moi nhat truoc)', () => {
    const s1 = submission({ id: 'new' });
    const s2 = submission({ id: 'old' });
    expect(latestSubmission([s1, s2])?.id).toBe('new');
    expect(latestSubmission([])).toBeNull();
    const r = { id: 'r1', score: 8, feedback: 'Tốt', status: 'graded' as const, reviewerId: 'gv-1', reviewerName: 'GV', reviewedAt: '2026-11-10T11:00:00.000Z' };
    expect(latestReview([r])?.id).toBe('r1');
    expect(latestReview([])).toBeNull();
  });
});

describe('API wrappers (stub fetch)', () => {
  it('getAssignmentDetail: tra context khi ok:true', async () => {
    const ctx = { assignment: { id: 'asg-1' }, enrolled: true };
    const res = await getAssignmentDetail('asg-1', stubFetch({ ok: true, ...ctx }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.enrolled).toBe(true);
  });
  it('getAssignmentDetail: loi server -> ok:false + giu message', async () => {
    const res = await getAssignmentDetail(
      'asg-1',
      stubFetch({ ok: false, error: 'Không tìm thấy bài tập.' }, false, 404),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('Không tìm thấy bài tập.');
  });
  it('fetch throw (mat mang) -> loi tieng Viet, khong throw', async () => {
    const failing: FetchFn = async () => {
      throw new Error('network down');
    };
    const res = await getAssignmentDetail('asg-1', failing);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch('Không kết nối được máy chủ');
  });
  it('createAssignment: validate o client truoc, khong goi fetch khi sai', async () => {
    let called = false;
    const counting: FetchFn = async () => {
      called = true;
      return { ok: true, status: 201, json: async () => ({ ok: true, assignmentId: 'x' }) };
    };
    const bad = await createAssignment(
      { courseId: 'c1', title: '', description: 'd', assignmentType: 'essay' },
      counting,
    );
    expect(bad.ok).toBe(false);
    expect(called).toBe(false);
    const good = await createAssignment(
      { courseId: 'c1', title: 'BT1', description: 'd', assignmentType: 'essay' },
      counting,
    );
    expect(good.ok).toBe(true);
    expect(called).toBe(true);
  });
  it('saveSubmission / gradeSubmission / listSubmissions: truyen dung duong dan', async () => {
    const seen: string[] = [];
    const spy: FetchFn = async (input) => {
      seen.push(input);
      return { ok: true, status: 200, json: async () => ({ ok: true, submission: submission(), submissions: [], review: {} }) };
    };
    await saveSubmission('asg-1', { contentText: 'Bai.', action: 'submit' }, spy);
    await listAssignmentSubmissions('asg-1', spy);
    await gradeSubmission('asg-1', 'sub-1', { score: 8, feedback: 'Tốt.', status: 'graded' }, spy);
    expect(seen).toEqual([
      '/api/v1/assignments/asg-1/submissions',
      '/api/v1/assignments/asg-1/submissions',
      '/api/v1/assignments/asg-1/submissions/sub-1/reviews',
    ]);
  });
  it('uploadSubmissionFile: chan file sai truoc khi goi fetch; gui FormData khi dung', async () => {
    let called = false;
    const spy: FetchFn = async () => {
      called = true;
      return {
        ok: true,
        status: 201,
        json: async () => ({
          ok: true,
          file: { id: 'f1', fileName: 'bai.pdf', fileSizeBytes: 10, mimeType: 'application/pdf', createdAt: '2026-11-10T10:00:00.000Z' },
          submissionId: 'sub-1',
        }),
      };
    };
    const bad = await uploadSubmissionFile(
      'asg-1',
      new File(['x'], 'bai.exe', { type: 'application/octet-stream' }),
      spy,
    );
    expect(bad.ok).toBe(false);
    expect(called).toBe(false);
    const good = await uploadSubmissionFile(
      'asg-1',
      new File(['hello'], 'bai.pdf', { type: 'application/pdf' }),
      spy,
    );
    expect(good.ok).toBe(true);
    expect(called).toBe(true);
    if (good.ok) {
      expect(good.data.file.fileName).toBe('bai.pdf');
      expect(JSON.stringify(good.data)).not.toContain('storage_path');
      expect(JSON.stringify(good.data)).not.toContain('supabase');
    }
  });
});
