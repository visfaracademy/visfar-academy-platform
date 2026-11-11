// Test Task 07 (phan 1/4): Course Structure + Student Learning.
// Chay local, khong can Supabase that. Fake client mo phong chuoi query
// cua supabase-js (thenable) theo mau dashboard.test.ts.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeCourseProgressPercent,
  extractYouTubeId,
  fetchCourseStructure,
  fetchLessonContentViaApi,
  fetchLessonDetail,
  fetchResumeTarget,
  findPrevNext,
  findResumeLesson,
  flattenLessons,
  formatDuration,
  formatTotalDuration,
  lessonTypeLabelVi,
  lessonUrl,
  markLessonComplete,
  normalizeYouTubeUrl,
  quizUrl,
  resourceDownloadUrl,
  saveLessonNote,
  saveLessonProgress,
  slugifyVi,
  stripLessonContent,
  validateNoteContent,
  verifyLessonAccessViaApi,
  youtubeEmbedUrl,
  type LessonItem,
  type LessonProgressItem,
  type ModuleWithLessons,
} from './learning';

function lesson(over: Partial<LessonItem> & { id: string }): LessonItem {
  return {
    moduleId: over.moduleId ?? 'm1',
    slug: over.slug ?? over.id,
    title: over.title ?? over.id,
    type: over.type ?? 'text',
    content: over.content ?? null,
    videoUrl: over.videoUrl ?? null,
    videoDurationSec: over.videoDurationSec ?? null,
    fileUrl: over.fileUrl ?? null,
    displayOrder: over.displayOrder ?? 0,
    isFreePreview: over.isFreePreview ?? false,
    ...over,
  };
}

function mod(over: Partial<ModuleWithLessons> & { id: string }): ModuleWithLessons {
  return {
    courseId: 'c1',
    slug: over.slug ?? over.id,
    title: over.title ?? over.id,
    description: null,
    displayOrder: over.displayOrder ?? 0,
    isFreePreview: false,
    lessons: over.lessons ?? [],
    ...over,
  };
}

const MODULES: ModuleWithLessons[] = [
  mod({
    id: 'm1',
    slug: 'mo-dau',
    lessons: [
      lesson({ id: 'l1', slug: 'gioi-thieu', type: 'video', displayOrder: 1 }),
      lesson({ id: 'l2', slug: 'tam-thuc-la-gi', type: 'text', displayOrder: 2 }),
    ],
  }),
  mod({
    id: 'm2',
    slug: 'thuc-hanh',
    lessons: [
      lesson({ id: 'l3', slug: 'bai-tap-1', type: 'assignment', displayOrder: 1 }),
      lesson({ id: 'l4', slug: 'kiem-tra', type: 'quiz', displayOrder: 2 }),
    ],
  }),
];
const ALL = flattenLessons(MODULES);

function progressMap(
  entries: Array<[string, Partial<LessonProgressItem>]>,
): Map<string, LessonProgressItem> {
  return new Map(
    entries.map(([lessonId, p]) => [
      lessonId,
      {
        lessonId,
        status: p.status ?? 'in_progress',
        progressPercent: p.progressPercent ?? 0,
        lastPositionSec: p.lastPositionSec ?? null,
        completedAt: p.completedAt ?? null,
      },
    ]),
  );
}

// --- Fake supabase-js -------------------------------------------------------
type Row = Record<string, unknown>;

class FakeQuery {
  constructor(
    private result: { data: unknown; error: { message: string; code?: string } | null },
    private onUpsert?: (table: string, values: Row) => void,
    private table = '',
  ) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  in() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  upsert(values: Row) {
    this.onUpsert?.(this.table, values);
    return Promise.resolve({ data: null, error: null });
  }
  maybeSingle() {
    return Promise.resolve(this.result);
  }
  single() {
    return Promise.resolve(this.result);
  }
  then(onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(onF, onR);
  }
}

interface FakeClientOpts {
  tables?: Record<string, { data: unknown; error: { message: string; code?: string } | null }>;
  userId?: string | null;
  onUpsert?: (table: string, values: Row) => void;
}

function makeFakeClient(
  opts: FakeClientOpts = {},
): SupabaseClient & {
  upserts: Array<{ table: string; values: Row }>;
  queriedTables: string[];
} {
  const upserts: Array<{ table: string; values: Row }> = [];
  const queriedTables: string[] = [];
  const client = {
    upserts,
    queriedTables,
    auth: {
      getUser: async () => ({
        data: { user: opts.userId === undefined || opts.userId ? { id: opts.userId ?? 'u1' } : null },
        error: null,
      }),
    },
    from(table: string) {
      queriedTables.push(table);
      const result = opts.tables?.[table] ?? { data: [], error: null };
      return new FakeQuery(result, (t, v) => {
        upserts.push({ table: t, values: v });
        opts.onUpsert?.(t, v);
      }, table);
    },
  };
  return client as unknown as SupabaseClient & {
    upserts: Array<{ table: string; values: Row }>;
    queriedTables: string[];
  };
}

function structureTables(): Record<
  string,
  { data: unknown; error: { message: string; code?: string } | null }
> {
  return {
    courses: {
      data: {
        id: 'c1',
        slug: 'thau-hieu-noi-tam',
        title: 'Thấu Hiểu Nội Tâm',
        subtitle: null,
        description: null,
        price_vnd: 0,
      },
      error: null,
    },
    course_modules: {
      data: [
        { id: 'm1', course_id: 'c1', slug: 'mo-dau', title: 'Mở đầu', description: null, display_order: 1, is_free_preview: false },
        { id: 'm2', course_id: 'c1', slug: 'thuc-hanh', title: 'Thực hành', description: null, display_order: 2, is_free_preview: false },
      ],
      error: null,
    },
    // S-03: cau truc doc VIEW lessons_public — fixture chi co cac cot
    // view co (khong co content / video_url / file_url). Khong co key
    // 'lessons': neu code con doc bang goc thi cau truc se rong.
    lessons_public: {
      data: [
        { id: 'l1', course_module_id: 'm1', slug: 'gioi-thieu', title: 'Giới thiệu', type: 'video', video_duration_sec: 600, display_order: 1, is_free_preview: true },
        { id: 'l2', course_module_id: 'm1', slug: 'tam-thuc-la-gi', title: 'Tâm thức là gì', type: 'text', video_duration_sec: null, display_order: 2, is_free_preview: false },
        { id: 'l3', course_module_id: 'm2', slug: 'bai-tap-1', title: 'Bài tập 1', type: 'assignment', video_duration_sec: null, display_order: 1, is_free_preview: false },
        { id: 'l4', course_module_id: 'm2', slug: 'kiem-tra', title: 'Kiểm tra', type: 'quiz', video_duration_sec: null, display_order: 2, is_free_preview: false },
      ],
      error: null,
    },
    enrollments: { data: { id: 'e1' }, error: null },
    lesson_progress: { data: [], error: null },
    lesson_resources: { data: [], error: null },
    lesson_notes: { data: null, error: null },
    quizzes: { data: null, error: null },
    assignments: { data: null, error: null },
    learning_events: { data: null, error: null },
  };
}

// ---------------------------------------------------------------------------
describe('lessonTypeLabelVi', () => {
  it('du loai noi dung Task 07', () => {
    expect(lessonTypeLabelVi('video')).toBe('Video');
    expect(lessonTypeLabelVi('pdf')).toBe('PDF');
    expect(lessonTypeLabelVi('audio')).toBe('Audio');
    expect(lessonTypeLabelVi('image')).toBe('Hình ảnh');
    expect(lessonTypeLabelVi('quiz')).toBe('Quiz');
    expect(lessonTypeLabelVi('assignment')).toBe('Bài tập');
    expect(lessonTypeLabelVi('webinar')).toBe('Webinar');
    expect(lessonTypeLabelVi('text')).toBe('Bài đọc');
    expect(lessonTypeLabelVi('file')).toBe('Tài liệu');
  });
  it('loai la tra nguyen chuoi', () => {
    expect(lessonTypeLabelVi('xyz')).toBe('xyz');
  });
});

describe('extractYouTubeId / youtubeEmbedUrl', () => {
  const ID = 'dQw4w9WgXcQ';
  it('watch?v=', () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });
  it('youtu.be', () => {
    expect(extractYouTubeId(`https://youtu.be/${ID}?t=10`)).toBe(ID);
  });
  it('embed va shorts', () => {
    expect(extractYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });
  it('khong phai YouTube / id sai -> null', () => {
    expect(extractYouTubeId('https://vimeo.com/123')).toBeNull();
    expect(extractYouTubeId('https://www.youtube.com/watch?v=ngan')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();
    expect(extractYouTubeId(null)).toBeNull();
  });
  it('embed dung youtube-nocookie, khong goi y video khac', () => {
    expect(youtubeEmbedUrl(`https://youtu.be/${ID}`)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    );
    expect(youtubeEmbedUrl('https://example.com/x.mp4')).toBeNull();
  });
});

describe('normalizeYouTubeUrl — chuan hoa link admin dan vao', () => {
  const ID = 'xE0ofNDjBXo';
  const WATCH = `https://www.youtube.com/watch?v=${ID}`;
  it('watch co tham so si/t -> bo tham so, giu ID', () => {
    expect(normalizeYouTubeUrl(`${WATCH}&t=57s`)).toBe(WATCH);
    expect(normalizeYouTubeUrl(`https://youtu.be/${ID}?si=dDOsSyyhijWWGaPS`)).toBe(WATCH);
  });
  it('youtu.be / embed / shorts / live -> watch chuan', () => {
    expect(normalizeYouTubeUrl(`https://youtu.be/${ID}`)).toBe(WATCH);
    expect(normalizeYouTubeUrl(`https://www.youtube.com/embed/${ID}`)).toBe(WATCH);
    expect(normalizeYouTubeUrl(`https://www.youtube.com/shorts/${ID}`)).toBe(WATCH);
    expect(normalizeYouTubeUrl(`https://www.youtube.com/live/${ID}`)).toBe(WATCH);
    expect(normalizeYouTubeUrl(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(WATCH);
  });
  it('ma tran 11 ky tu / thieu scheme', () => {
    expect(normalizeYouTubeUrl(ID)).toBe(WATCH);
    expect(normalizeYouTubeUrl(`www.youtube.com/watch?v=${ID}`)).toBe(WATCH);
    expect(normalizeYouTubeUrl(`youtu.be/${ID}`)).toBe(WATCH);
  });
  it('doan ma nhung iframe -> lay src', () => {
    expect(
      normalizeYouTubeUrl(
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/${ID}" frameborder="0"></iframe>`,
      ),
    ).toBe(WATCH);
  });
  it('link kenh / playlist / khong phai YouTube / rong -> null', () => {
    expect(normalizeYouTubeUrl('https://www.youtube.com/@visfaracademy')).toBeNull();
    expect(normalizeYouTubeUrl('https://www.youtube.com/playlist?list=PL1234567890a')).toBeNull();
    expect(normalizeYouTubeUrl('https://music.youtube.com/watch?v=' + ID)).toBeNull();
    expect(normalizeYouTubeUrl('https://vimeo.com/123456789')).toBeNull();
    expect(normalizeYouTubeUrl('https://example.com/x.mp4')).toBeNull();
    expect(normalizeYouTubeUrl('')).toBeNull();
    expect(normalizeYouTubeUrl(null)).toBeNull();
  });
});

describe('slugifyVi — goi y slug tu tieu de tieng Viet', () => {
  it('bo dau, khoang trang -> gach ngang', () => {
    expect(slugifyVi('Buổi 1 - Chuyển hóa tâm thức')).toBe('buoi-1-chuyen-hoa-tam-thuc');
    expect(slugifyVi('Thấu hiểu về nội tâm')).toBe('thau-hieu-ve-noi-tam');
    expect(slugifyVi('Chương 1 — Hiểu về tâm thức')).toBe('chuong-1-hieu-ve-tam-thuc');
  });
  it('rong / chi ky tu dac biet -> chuoi rong', () => {
    expect(slugifyVi('')).toBe('');
    expect(slugifyVi('---')).toBe('');
    expect(slugifyVi(null)).toBe('');
  });
});

describe('formatDuration', () => {
  it('giay -> phut:giay', () => {
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(-5)).toBe('');
  });
});

describe('formatTotalDuration — tong thoi luong video cua khoa/module', () => {
  it('duoi 1 gio -> "N phút", tren 1 gio -> "N giờ M phút"', () => {
    expect(formatTotalDuration(2700)).toBe('45 phút');
    expect(formatTotalDuration(5400)).toBe('1 giờ 30 phút');
    expect(formatTotalDuration(3661)).toBe('1 giờ 1 phút');
    expect(formatTotalDuration(3600)).toBe('1 giờ');
    expect(formatTotalDuration(59)).toBe('1 phút');
  });
  it('khong co thoi luong -> chuoi rong (UI an tong thoi luong)', () => {
    expect(formatTotalDuration(0)).toBe('');
    expect(formatTotalDuration(null)).toBe('');
    expect(formatTotalDuration(undefined)).toBe('');
    expect(formatTotalDuration(-10)).toBe('');
  });
});

describe('flattenLessons / findPrevNext', () => {
  it('xep phang theo thu tu module -> bai', () => {
    expect(flattenLessons(MODULES).map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4']);
  });
  it('bai giua co ca truoc va sau', () => {
    const { prev, next } = findPrevNext(ALL, 'l2');
    expect(prev?.id).toBe('l1');
    expect(next?.id).toBe('l3');
  });
  it('bai dau khong co prev, bai cuoi khong co next (xuyen module)', () => {
    expect(findPrevNext(ALL, 'l1').prev).toBeNull();
    expect(findPrevNext(ALL, 'l1').next?.id).toBe('l2');
    expect(findPrevNext(ALL, 'l4').next).toBeNull();
    expect(findPrevNext(ALL, 'l4').prev?.id).toBe('l3');
  });
  it('bai khong co trong khoa -> ca 2 null', () => {
    expect(findPrevNext(ALL, 'khong-co')).toEqual({ prev: null, next: null });
  });
});

describe('findResumeLesson', () => {
  it('chua hoc gi -> bai dau tien', () => {
    expect(findResumeLesson(ALL, new Map())?.id).toBe('l1');
  });
  it('bo qua bai da xong, dung o bai dang do', () => {
    const p = progressMap([
      ['l1', { status: 'completed', progressPercent: 100 }],
      ['l2', { status: 'in_progress', progressPercent: 40 }],
    ]);
    expect(findResumeLesson(ALL, p)?.id).toBe('l2');
  });
  it('video >= 90% tinh la xong (QĐ 17) nen resume bo qua', () => {
    const p = progressMap([['l1', { status: 'in_progress', progressPercent: 90 }]]);
    expect(findResumeLesson(ALL, p)?.id).toBe('l2');
  });
  it('video 89% chua xong -> resume dung lai o do', () => {
    const p = progressMap([['l1', { status: 'in_progress', progressPercent: 89 }]]);
    expect(findResumeLesson(ALL, p)?.id).toBe('l1');
  });
  it('hoc het khoa -> null', () => {
    const p = progressMap(
      ALL.map((l): [string, Partial<LessonProgressItem>] => [
        l.id,
        { status: 'completed', progressPercent: 100 },
      ]),
    );
    expect(findResumeLesson(ALL, p)).toBeNull();
    expect(findResumeLesson([], new Map())).toBeNull();
  });
});

describe('computeCourseProgressPercent', () => {
  it('0 bai -> 0%', () => {
    expect(computeCourseProgressPercent([], new Map())).toEqual({
      completedLessons: 0,
      totalLessons: 0,
      progressPercent: 0,
    });
  });
  it('1/4 bai -> 25%', () => {
    const p = progressMap([['l1', { status: 'completed', progressPercent: 100 }]]);
    expect(computeCourseProgressPercent(ALL, p)).toEqual({
      completedLessons: 1,
      totalLessons: 4,
      progressPercent: 25,
    });
  });
});

describe('validateNoteContent', () => {
  it('rong -> loi', () => {
    expect(validateNoteContent('   ')).toMatch(/đang trống/);
  });
  it('qua 10.000 ky tu -> loi', () => {
    expect(validateNoteContent('a'.repeat(10001))).toMatch(/tối đa/);
  });
  it('hop le -> null', () => {
    expect(validateNoteContent('Ghi nhớ: tâm thức là gốc.')).toBeNull();
  });
});

describe('URL helper', () => {
  it('tai qua API, khong lo URL goc', () => {
    expect(resourceDownloadUrl('r1')).toBe('/api/v1/resources/r1/download');
  });
  it('quiz va bai hoc', () => {
    expect(quizUrl('thau-hieu-noi-tam', 'quiz-1')).toBe(
      '/hoc-vien/khoa-hoc/thau-hieu-noi-tam/quiz/quiz-1',
    );
    expect(lessonUrl('thau-hieu-noi-tam', 'gioi-thieu')).toBe(
      '/hoc-vien/khoa-hoc/thau-hieu-noi-tam/bai/gioi-thieu',
    );
    expect(lessonUrl('thau-hieu-noi-tam', 'gioi-thieu', 'mo-dau')).toBe(
      '/hoc-vien/khoa-hoc/thau-hieu-noi-tam/bai/gioi-thieu?module=mo-dau',
    );
  });
});

describe('fetchCourseStructure (fake client)', () => {
  it('tra cau truc Course -> Module -> Lesson', async () => {
    const client = makeFakeClient({ tables: structureTables() });
    const res = await fetchCourseStructure('thau-hieu-noi-tam', client);
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.course.slug).toBe('thau-hieu-noi-tam');
    expect(res.data.modules).toHaveLength(2);
    expect(res.data.modules[0].lessons.map((l) => l.slug)).toEqual(['gioi-thieu', 'tam-thuc-la-gi']);
    expect(res.data.totalLessons).toBe(4);
  });
  it('S-03: cau truc doc view lessons_public, KHONG doc bang lessons goc', async () => {
    const client = makeFakeClient({ tables: structureTables() });
    const res = await fetchCourseStructure('thau-hieu-noi-tam', client);
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(client.queriedTables).toContain('lessons_public');
    expect(client.queriedTables).not.toContain('lessons');
  });
  it('S-03: cau truc chi co metadata — content/videoUrl/fileUrl LUON null (ke ca bai xem thu)', async () => {
    const res = await fetchCourseStructure('thau-hieu-noi-tam', makeFakeClient({ tables: structureTables() }));
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    for (const m of res.data.modules) {
      for (const l of m.lessons) {
        expect(l.content).toBeNull();
        expect(l.videoUrl).toBeNull();
        expect(l.fileUrl).toBeNull();
      }
    }
    expect(res.data.modules[0].lessons[0].title).toBe('Giới thiệu');
    expect(res.data.modules[0].lessons[0].videoDurationSec).toBe(600);
    expect(res.data.modules[0].lessons[0].isFreePreview).toBe(true);
  });
  it('khoa khong ton tai -> data null (empty state)', async () => {
    const tables = structureTables();
    tables.courses = { data: null, error: null };
    const res = await fetchCourseStructure('khong-co', makeFakeClient({ tables }));
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data).toBeNull();
  });
  it('loi Supabase -> error ro rang', async () => {
    const tables = structureTables();
    tables.courses = { data: null, error: { message: 'boom', code: 'PGRST205' } };
    const res = await fetchCourseStructure('thau-hieu-noi-tam', makeFakeClient({ tables }));
    expect(res.status).toBe('error');
  });
});

describe('fetchLessonDetail (fake client)', () => {
  it('bai video free preview: khong khoa, embed duoc, chua hoan thanh', async () => {
    // S-03: videoUrl that khong con trong cau truc (view) — co nho API
    // guard tra lesson day du cho hoc vien da ghi danh.
    const allowWithVideo = async () => ({
      allowed: true as const,
      previewOnly: false,
      lesson: { content: null, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', fileUrl: null },
    });
    const res = await fetchLessonDetail('thau-hieu-noi-tam', 'gioi-thieu', null, makeFakeClient({ tables: structureTables() }), allowWithVideo);
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.lesson.slug).toBe('gioi-thieu');
    expect(res.data.locked).toBe(false);
    expect(youtubeEmbedUrl(res.data.lesson.videoUrl)).toContain('youtube-nocookie.com');
    expect(res.data.progress).toBeNull();
    expect(res.data.totalLessons).toBe(4);
    expect(res.data.progressPercent).toBe(0);
  });
  it('S-03: khong goi duoc API guard -> bai chi co metadata (fail-closed, khong lo noi dung)', async () => {
    // Mac dinh verifyLessonAccessViaApi dung fetch that — trong test
    // khong co server nen tra null -> quyet dinh client, nhung cau
    // truc tu view khong co content/videoUrl/fileUrl.
    const res = await fetchLessonDetail('thau-hieu-noi-tam', 'gioi-thieu', null, makeFakeClient({ tables: structureTables() }));
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.locked).toBe(false);
    expect(res.data.lesson.content).toBeNull();
    expect(res.data.lesson.videoUrl).toBeNull();
    expect(res.data.lesson.fileUrl).toBeNull();
  });
  it('bai thuong khi da ghi danh: mo, doc duoc ghi chu cu', async () => {
    const tables = structureTables();
    tables.lesson_notes = { data: { content: 'Ghi chú cũ' }, error: null };
    tables.lesson_progress = {
      data: [{ lesson_id: 'l1', status: 'completed', progress_percent: 100, last_position_sec: null, completed_at: '2026-11-10T00:00:00Z' }],
      error: null,
    };
    const res = await fetchLessonDetail('thau-hieu-noi-tam', 'tam-thuc-la-gi', null, makeFakeClient({ tables }));
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.locked).toBe(false);
    expect(res.data.noteContent).toBe('Ghi chú cũ');
    expect(res.data.completedLessons).toBe(1);
    expect(res.data.progressPercent).toBe(25);
  });
  it('chua ghi danh + bai khong free -> khoa', async () => {
    const tables = structureTables();
    tables.enrollments = { data: null, error: null };
    const res = await fetchLessonDetail('thau-hieu-noi-tam', 'tam-thuc-la-gi', null, makeFakeClient({ tables }));
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.enrolled).toBe(false);
    expect(res.data.locked).toBe(true);
  });
  it('chua dang nhap -> signed-out', async () => {
    const res = await fetchLessonDetail('thau-hieu-noi-tam', 'gioi-thieu', null, makeFakeClient({ userId: null, tables: structureTables() }));
    expect(res.status).toBe('signed-out');
  });
  it('bang lesson_notes chua co (0011 chua chay) -> bai van mo, ghi chu rong', async () => {
    const tables = structureTables();
    tables.lesson_notes = {
      data: null,
      error: { message: "Could not find the table 'public.lesson_notes' in the schema cache", code: 'PGRST205' },
    };
    const res = await fetchLessonDetail('thau-hieu-noi-tam', 'gioi-thieu', null, makeFakeClient({ tables }));
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.noteContent).toBe('');
    expect(res.data.lesson.slug).toBe('gioi-thieu');
  });
  it('bai khong ton tai -> data null', async () => {
    const res = await fetchLessonDetail('thau-hieu-noi-tam', 'khong-co', null, makeFakeClient({ tables: structureTables() }));
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data).toBeNull();
  });
});

describe('fetchResumeTarget (fake client)', () => {
  it('dang do o bai 2 -> resume bai 2', async () => {
    const tables = structureTables();
    tables.lesson_progress = {
      data: [{ lesson_id: 'l1', status: 'completed', progress_percent: 100, last_position_sec: null, completed_at: null }],
      error: null,
    };
    const res = await fetchResumeTarget('thau-hieu-noi-tam', makeFakeClient({ tables }));
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data?.lessonSlug).toBe('tam-thuc-la-gi');
    expect(res.data?.moduleSlug).toBe('mo-dau');
    expect(res.data?.allCompleted).toBe(false);
    expect(res.data?.completedLessons).toBe(1);
  });
  it('hoc het khoa -> allCompleted true, tro ve bai dau', async () => {
    const tables = structureTables();
    tables.lesson_progress = {
      data: ALL.map((l) => ({ lesson_id: l.id, status: 'completed', progress_percent: 100, last_position_sec: null, completed_at: null })),
      error: null,
    };
    const res = await fetchResumeTarget('thau-hieu-noi-tam', makeFakeClient({ tables }));
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data?.allCompleted).toBe(true);
    expect(res.data?.lessonSlug).toBe('gioi-thieu');
  });
  it('chua ghi danh -> null', async () => {
    const tables = structureTables();
    tables.enrollments = { data: null, error: null };
    const res = await fetchResumeTarget('thau-hieu-noi-tam', makeFakeClient({ tables }));
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('expected success');
    expect(res.data).toBeNull();
  });
});

describe('ghi tien do / ghi chu (fake client)', () => {
  it('markLessonComplete: video mac dinh 90% (QĐ 17), text 100%', async () => {
    const client = makeFakeClient({ tables: structureTables() });
    const video = await markLessonComplete('l1', { progressPercent: 90 }, client);
    expect(video.status).toBe('ok');
    expect(client.upserts[0]).toEqual({
      table: 'lesson_progress',
      values: expect.objectContaining({
        lesson_id: 'l1',
        status: 'completed',
        progress_percent: 90,
      }),
    });
    const text = await markLessonComplete('l2', undefined, client);
    expect(text.status).toBe('ok');
    expect(client.upserts[1].values).toEqual(
      expect.objectContaining({ lesson_id: 'l2', progress_percent: 100 }),
    );
  });
  it('saveLessonProgress: clamp 0-100, >=100 thi completed', async () => {
    const client = makeFakeClient({ tables: structureTables() });
    const res = await saveLessonProgress('l1', 150, 42, client);
    expect(res.status).toBe('ok');
    expect(client.upserts[0].values).toEqual(
      expect.objectContaining({ progress_percent: 100, status: 'completed', last_position_sec: 42 }),
    );
  });
  it('saveLessonNote: ghi chu rong khong goi Supabase', async () => {
    const client = makeFakeClient({ tables: structureTables() });
    const res = await saveLessonNote('l1', '   ', client);
    expect(res.status).toBe('error');
    expect(client.upserts).toHaveLength(0);
  });
  it('saveLessonNote: upsert dung khoa user+lesson', async () => {
    const client = makeFakeClient({ tables: structureTables() });
    const res = await saveLessonNote('l2', 'Ghi nhớ quan trọng', client);
    expect(res.status).toBe('ok');
    expect(client.upserts[0]).toEqual({
      table: 'lesson_notes',
      values: expect.objectContaining({
        user_id: 'u1',
        lesson_id: 'l2',
        content: 'Ghi nhớ quan trọng',
      }),
    });
  });
  it('chua dang nhap -> loi, khong goi Supabase', async () => {
    const client = makeFakeClient({ userId: null, tables: structureTables() });
    const res = await markLessonComplete('l1', undefined, client);
    expect(res.status).toBe('error');
    expect(client.upserts).toHaveLength(0);
  });
});

describe('Task 07 (phan 3/4): server guard ghi de kiem tra client', () => {
  const deny = async () => ({ allowed: false as const });
  // S-03: stub "cho phep" kem payload lesson nhu API guard tra ve
  // (noi dung that chi co o day, khong con trong cau truc view).
  const allow = async () => ({
    allowed: true as const,
    previewOnly: false,
    lesson: { content: 'Nội dung bài.', videoUrl: null, fileUrl: null },
  });
  const preview = async () => ({ allowed: true as const, previewOnly: true });
  const previewWithVideo = async () => ({
    allowed: true as const,
    previewOnly: true,
    lesson: { content: null, videoUrl: 'https://video.example.com/preview.mp4', fileUrl: null },
  });
  const unreachable = async () => null;

  it('server tu choi (VD: enrollment bi thu hoi) -> khoa + loc sach URL/noi dung', async () => {
    const res = await fetchLessonDetail(
      'thau-hieu-noi-tam', 'tam-thuc-la-gi', null,
      makeFakeClient({ tables: structureTables() }), deny,
    );
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.locked).toBe(true);
    expect(res.data.lesson.videoUrl).toBeNull();
    expect(res.data.lesson.content).toBeNull();
    expect(res.data.lesson.fileUrl).toBeNull();
    expect(res.data.resources).toEqual([]);
  });

  it('server noi previewOnly -> mo bai nhung khong co URL/noi dung day du', async () => {
    const res = await fetchLessonDetail(
      'thau-hieu-noi-tam', 'gioi-thieu', null,
      makeFakeClient({ tables: structureTables() }), preview,
    );
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.locked).toBe(false);
    expect(res.data.lesson.videoUrl).toBeNull();
    expect(res.data.lesson.title).toBe('Giới thiệu');
  });

  it('S-03 / 0028: preview co video mau -> giu videoUrl, van loc content/fileUrl', async () => {
    const res = await fetchLessonDetail(
      'thau-hieu-noi-tam', 'gioi-thieu', null,
      makeFakeClient({ tables: structureTables() }), previewWithVideo,
    );
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.locked).toBe(false);
    expect(res.data.lesson.videoUrl).toBe('https://video.example.com/preview.mp4');
    expect(res.data.lesson.content).toBeNull();
    expect(res.data.lesson.fileUrl).toBeNull();
  });

  it('server cho phep -> mo day du nhu cu', async () => {
    const res = await fetchLessonDetail(
      'thau-hieu-noi-tam', 'tam-thuc-la-gi', null,
      makeFakeClient({ tables: structureTables() }), allow,
    );
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.locked).toBe(false);
    expect(res.data.lesson.content).toBe('Nội dung bài.');
  });

  it('khong goi duoc API (null) -> dung quyet dinh client nhu cu', async () => {
    const tables = structureTables();
    tables.enrollments = { data: null, error: null };
    const res = await fetchLessonDetail(
      'thau-hieu-noi-tam', 'tam-thuc-la-gi', null,
      makeFakeClient({ tables }), unreachable,
    );
    expect(res.status).toBe('success');
    if (res.status !== 'success' || !res.data) throw new Error('expected data');
    expect(res.data.locked).toBe(true);
  });

  it('stripLessonContent: loc content/video/file, giu tieu de + slug', () => {
    const stripped = stripLessonContent(
      lesson({ id: 'lx', content: 'Bi mat', videoUrl: 'https://v.example.com/x', fileUrl: 'https://f.example.com/x.pdf' }),
    );
    expect(stripped.content).toBeNull();
    expect(stripped.videoUrl).toBeNull();
    expect(stripped.fileUrl).toBeNull();
    expect(stripped.title).toBe('lx');
  });

  it('verifyLessonAccessViaApi: fetch loi -> null (fallback client)', async () => {
    const failing = async () => {
      throw new Error('offline');
    };
    await expect(verifyLessonAccessViaApi('l1', failing as unknown as typeof fetch)).resolves.toBeNull();
  });
  it('verifyLessonAccessViaApi: 403 -> denied; 200 previewOnly -> preview', async () => {
    const denied = async () =>
      ({ ok: false, json: async () => ({ ok: false }) }) as unknown as Response;
    await expect(verifyLessonAccessViaApi('l1', denied as unknown as typeof fetch)).resolves.toEqual({
      allowed: false,
    });
    const okPreview = async () =>
      ({ ok: true, json: async () => ({ ok: true, previewOnly: true }) }) as unknown as Response;
    await expect(verifyLessonAccessViaApi('l1', okPreview as unknown as typeof fetch)).resolves.toEqual({
      allowed: true,
      previewOnly: true,
    });
  });
  it('S-03 / 0028: verifyLessonAccessViaApi kem lesson day du khi duoc phep; preview chi kem video_url', async () => {
    const okFull = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          previewOnly: false,
          lesson: { content: 'Noi dung that', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', file_url: null },
        }),
      }) as unknown as Response;
    await expect(verifyLessonAccessViaApi('l1', okFull as unknown as typeof fetch)).resolves.toEqual({
      allowed: true,
      previewOnly: false,
      lesson: { content: 'Noi dung that', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', fileUrl: null },
    });
    const okPreviewSanitized = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          previewOnly: true,
          lesson: { id: 'l1', slug: 'gioi-thieu', title: 'Giới thiệu', type: 'video' },
        }),
      }) as unknown as Response;
    const preview = await verifyLessonAccessViaApi('l1', okPreviewSanitized as unknown as typeof fetch);
    expect(preview).toEqual({ allowed: true, previewOnly: true });
    expect((preview as { lesson?: unknown }).lesson).toBeUndefined();
    const okPreviewVideo = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          previewOnly: true,
          lesson: { video_url: 'https://video.example.com/preview.mp4' },
        }),
      }) as unknown as Response;
    await expect(verifyLessonAccessViaApi('l1', okPreviewVideo as unknown as typeof fetch)).resolves.toEqual({
      allowed: true,
      previewOnly: true,
      lesson: { content: null, videoUrl: 'https://video.example.com/preview.mp4', fileUrl: null },
    });
  });
  it('S-03: fetchLessonContentViaApi chi tra noi dung khi duoc phep xem day du', async () => {
    const okFull = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          previewOnly: false,
          lesson: { content: 'Noi dung that', video_url: null, file_url: 'https://f.example.com/x.pdf' },
        }),
      }) as unknown as Response;
    await expect(fetchLessonContentViaApi('l1', okFull as unknown as typeof fetch)).resolves.toEqual({
      content: 'Noi dung that',
      videoUrl: null,
      fileUrl: 'https://f.example.com/x.pdf',
    });
    const okPreview = async () =>
      ({ ok: true, json: async () => ({ ok: true, previewOnly: true }) }) as unknown as Response;
    await expect(fetchLessonContentViaApi('l1', okPreview as unknown as typeof fetch)).resolves.toBeNull();
    const denied = async () =>
      ({ ok: false, json: async () => ({ ok: false }) }) as unknown as Response;
    await expect(fetchLessonContentViaApi('l1', denied as unknown as typeof fetch)).resolves.toBeNull();
  });
});
