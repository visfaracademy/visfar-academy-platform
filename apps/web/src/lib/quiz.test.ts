// Test Quiz — Task 08. Chay local, khong can Supabase that:
// logic thuan + fetch gia. Cham diem o day la dac ta TS cua ham SQL
// submit_quiz_attempt (migration 0014) — parity voi SQL phai duoc
// kiem chung tren staging (KIEM CHUNG so 7 trong file migration).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PASSING_SCORE,
  attemptsRemaining,
  buildSubmitPayload,
  canAttempt,
  fetchQuizHistory,
  fetchQuizPaper,
  findUnansweredRequired,
  formatCountdown,
  gradeQuizAttempt,
  hashSeed,
  mulberry32,
  normalizeFillBlankAnswer,
  remainingSeconds,
  seededShuffle,
  shufflePaper,
  submitQuizAttempt,
  toCamelCaseQuizSubmitResult,
  toPublicPaper,
  toSnakeCaseQuizAnswers,
  QuizApiError,
  type GradedQuestion,
  type QuizAnswerInput,
  type QuizPaper,
  type QuizPaperServerRow,
} from './quiz';

function makePaper(over: Partial<QuizPaper> = {}): QuizPaper {
  return {
    quizId: 'quiz-1',
    courseSlug: 'thau-hieu-noi-tam',
    lessonId: 'lesson-1',
    courseId: 'course-1',
    title: 'Kiểm tra',
    description: null,
    passingScore: 70,
    timeLimitSec: 600,
    maxAttempts: 3,
    shuffleQuestions: true,
    attemptsUsed: 0,
    attemptsRemaining: 3,
    questions: [
      {
        id: 'q1',
        question: 'Câu 1?',
        questionType: 'single_choice',
        points: 2,
        options: [
          { id: 'o1', optionText: 'A', displayOrder: 1 },
          { id: 'o2', optionText: 'B', displayOrder: 2 },
        ],
      },
      {
        id: 'q2',
        question: 'Câu 2?',
        questionType: 'multiple_choice',
        points: 3,
        options: [
          { id: 'o3', optionText: 'C', displayOrder: 1 },
          { id: 'o4', optionText: 'D', displayOrder: 2 },
        ],
      },
    ],
    ...over,
  };
}

const gradedQuestions: GradedQuestion[] = [
  {
    id: 'q-single',
    questionType: 'single_choice',
    points: 2,
    options: [
      { id: 'a', optionText: 'Sai', isCorrect: false },
      { id: 'b', optionText: 'Đúng', isCorrect: true },
    ],
  },
  {
    id: 'q-multi',
    questionType: 'multiple_choice',
    points: 3,
    options: [
      { id: 'c', optionText: 'Đúng 1', isCorrect: true },
      { id: 'd', optionText: 'Sai', isCorrect: false },
      { id: 'e', optionText: 'Đúng 2', isCorrect: true },
    ],
  },
  {
    id: 'q-tf',
    questionType: 'true_false',
    points: 1,
    options: [
      { id: 't', optionText: 'Đúng', isCorrect: true },
      { id: 'f', optionText: 'Sai', isCorrect: false },
    ],
  },
  {
    id: 'q-fill',
    questionType: 'fill_blank',
    points: 2,
    options: [{ id: 'exp', optionText: 'Tâm thức', isCorrect: true }],
  },
  {
    id: 'q-essay',
    questionType: 'essay',
    points: 5,
    options: [],
  },
];

const allCorrect: QuizAnswerInput[] = [
  { questionId: 'q-single', optionIds: ['b'] },
  { questionId: 'q-multi', optionIds: ['c', 'e'] },
  { questionId: 'q-tf', optionIds: ['t'] },
  { questionId: 'q-fill', answerText: '  TÂM   thức ' },
  { questionId: 'q-essay', answerText: 'Bài tự luận của tôi.' },
];

describe('seeded shuffle — deterministic theo seed', () => {
  it('cung seed -> cung thu tu; khac seed -> thu tu co the khac', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(items, 'attempt-1')).toEqual(seededShuffle(items, 'attempt-1'));
    expect(seededShuffle(items, 'attempt-1')).not.toEqual(items);
    expect(hashSeed('a')).toBe(hashSeed('a'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
  it('khong doi mang goc; van du phan tu (hoan vi)', () => {
    const items = ['a', 'b', 'c', 'd'];
    const out = seededShuffle(items, 's');
    expect(out).toHaveLength(4);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
  it('mulberry32 deterministic', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
});

describe('shufflePaper', () => {
  it('tron dap an deterministic theo seed; khong doi paper goc', () => {
    const paper = makePaper();
    const a = shufflePaper(paper, 'seed-1');
    const b = shufflePaper(paper, 'seed-1');
    expect(a).toEqual(b);
    const q1 = a.questions.find((q) => q.id === 'q1');
    expect(q1?.options.map((o) => o.id).sort()).toEqual(['o1', 'o2']);
    expect(paper.questions[0].options[0].id).toBe('o1');
  });
  it('khong tron cau hoi khi shuffleQuestions = false', () => {
    const paper = makePaper({ shuffleQuestions: false });
    const out = shufflePaper(paper, 'seed-1');
    expect(out.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });
  it('tron cau hoi khi shuffleQuestions = true', () => {
    const paper = makePaper({
      shuffleQuestions: true,
      questions: Array.from({ length: 8 }, (_, i) => ({
        id: `q${i}`,
        question: `Câu ${i}`,
        questionType: 'single_choice' as const,
        points: 1,
        options: [{ id: `o${i}`, optionText: 'A', displayOrder: 1 }],
      })),
    });
    const out = shufflePaper(paper, 'seed-9');
    expect(out.questions.map((q) => q.id)).not.toEqual(
      paper.questions.map((q) => q.id),
    );
  });
});

describe('dem nguoc + gioi han lan lam', () => {
  it('remainingSeconds: 600s, da qua 61s -> 539', () => {
    expect(remainingSeconds(600, 1000, 62000)).toBe(539);
  });
  it('het gio -> <= 0; khong gioi han -> null', () => {
    expect(remainingSeconds(60, 0, 61000)).toBe(-1);
    expect(remainingSeconds(null, 0, 99999)).toBeNull();
  });
  it('formatCountdown: 90 -> 01:30; 3661 -> 1:01:01; 0 -> 00:00', () => {
    expect(formatCountdown(90)).toBe('01:30');
    expect(formatCountdown(3661)).toBe('1:01:01');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00');
  });
  it('attemptsRemaining / canAttempt', () => {
    expect(attemptsRemaining(3, 1)).toBe(2);
    expect(attemptsRemaining(1, 1)).toBe(0);
    expect(attemptsRemaining(null, 99)).toBeNull();
    expect(canAttempt(1, 1)).toBe(false);
    expect(canAttempt(null, 99)).toBe(true);
    expect(canAttempt(3, 0)).toBe(true);
  });
});

describe('normalizeFillBlankAnswer', () => {
  it('trim + gom khoang trang + khong phan biet hoa/thuong', () => {
    expect(normalizeFillBlankAnswer('  TÂM   thức ')).toBe('tâm thức');
    expect(normalizeFillBlankAnswer('A  B')).toBe('a b');
  });
});

describe('gradeQuizAttempt — du 5 loai cau (dac ta cua ham SQL 0014)', () => {
  it('tra loi dung het (tru essay): 8/13, 62% -> chua dat 70, needsReview', () => {
    const r = gradeQuizAttempt(gradedQuestions, allCorrect, 70);
    expect(r.score).toBe(8); // 2+3+1+2, essay 0 (chua cham)
    expect(r.total).toBe(13);
    expect(r.percent).toBe(62);
    expect(r.passed).toBe(false);
    expect(r.needsReview).toBe(true);
    expect(r.perQuestion.map((x) => x.isCorrect)).toEqual([
      true,
      true,
      true,
      true,
      null,
    ]);
  });
  it('multiple_choice chon thieu 1 option dung -> sai, 0 diem (khong diem thanh phan)', () => {
    const r = gradeQuizAttempt(gradedQuestions, [
      { questionId: 'q-multi', optionIds: ['c'] },
    ]);
    const row = r.perQuestion.find((x) => x.questionId === 'q-multi');
    expect(row?.isCorrect).toBe(false);
    expect(row?.pointsAwarded).toBe(0);
  });
  it('multiple_choice chon thua 1 option sai -> sai', () => {
    const r = gradeQuizAttempt(gradedQuestions, [
      { questionId: 'q-multi', optionIds: ['c', 'e', 'd'] },
    ]);
    expect(r.perQuestion.find((x) => x.questionId === 'q-multi')?.isCorrect).toBe(false);
  });
  it('single_choice chon 2 option -> sai (khong phai dap an duy nhat)', () => {
    const r = gradeQuizAttempt(gradedQuestions, [
      { questionId: 'q-single', optionIds: ['a', 'b'] },
    ]);
    expect(r.perQuestion.find((x) => x.questionId === 'q-single')?.isCorrect).toBe(false);
  });
  it('fill_blank khong phan biet hoa/thuong + khoang trang', () => {
    const r = gradeQuizAttempt(gradedQuestions, [
      { questionId: 'q-fill', answerText: 'tâm    THỨC' },
    ]);
    expect(r.perQuestion.find((x) => x.questionId === 'q-fill')?.isCorrect).toBe(true);
  });
  it('fill_blank khong co dap an dung dinh nghia -> null + needsReview', () => {
    const qs: GradedQuestion[] = [
      { id: 'qf', questionType: 'fill_blank', points: 1, options: [] },
    ];
    const r = gradeQuizAttempt(qs, [{ questionId: 'qf', answerText: 'x' }]);
    expect(r.perQuestion[0].isCorrect).toBeNull();
    expect(r.needsReview).toBe(true);
    expect(r.score).toBe(0);
  });
  it('cau khong tra loi -> false, 0 diem', () => {
    const r = gradeQuizAttempt(gradedQuestions, []);
    expect(r.perQuestion.every((x) => x.isCorrect === false || x.isCorrect === null)).toBe(true);
    expect(r.score).toBe(0);
    // Essay khong tra loi: isCorrect null nhung KHONG needsReview.
    expect(r.needsReview).toBe(false);
  });
  it('nguong dat 70: 7/10 = 70% dat; 6/10 = 60% truot', () => {
    const qs: GradedQuestion[] = [
      { id: 'a', questionType: 'single_choice', points: 7, options: [{ id: 'y', optionText: 'Y', isCorrect: true }] },
      { id: 'b', questionType: 'single_choice', points: 3, options: [{ id: 'z', optionText: 'Z', isCorrect: true }] },
    ];
    const pass = gradeQuizAttempt(qs, [
      { questionId: 'a', optionIds: ['y'] },
      { questionId: 'b', optionIds: ['wrong'] },
    ]);
    expect(pass.percent).toBe(70);
    expect(pass.passed).toBe(true);
    const fail = gradeQuizAttempt(qs, [{ questionId: 'b', optionIds: ['z'] }]);
    expect(fail.percent).toBe(30);
    expect(fail.passed).toBe(false);
  });
  it('DEFAULT_PASSING_SCORE = 70', () => {
    expect(DEFAULT_PASSING_SCORE).toBe(70);
  });
  it('total = 0 -> percent 0, passed true (khong co cau nao)', () => {
    const r = gradeQuizAttempt([], []);
    expect(r.total).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.passed).toBe(true);
  });
});

describe('findUnansweredRequired / buildSubmitPayload', () => {
  it('essay duoc bo qua (tu chon); cau trac nghiem thieu thi bao', () => {
    const paper = makePaper({
      questions: [
        { id: 'q1', question: 'C1', questionType: 'single_choice', points: 1, options: [] },
        { id: 'q2', question: 'C2', questionType: 'essay', points: 1, options: [] },
        { id: 'q3', question: 'C3', questionType: 'fill_blank', points: 1, options: [] },
      ],
    });
    const answers = new Map([['q1', { questionId: 'q1', optionIds: ['o1'] }]]);
    expect(findUnansweredRequired(paper, answers)).toEqual(['q3']);
  });
  it('buildSubmitPayload bo cau trang, cat text qua dai', () => {
    const payload = buildSubmitPayload(
      new Map([
        ['q1', { questionId: 'q1', optionIds: ['o1'] }],
        ['q2', { questionId: 'q2', optionIds: [], answerText: '   ' }],
        ['q3', { questionId: 'q3', answerText: 'x'.repeat(6000) }],
      ]),
    );
    expect(payload.map((p) => p.questionId)).toEqual(['q1', 'q3']);
    expect(payload[1].answerText?.length).toBe(5000);
  });
});

describe('toPublicPaper — KHONG de lot is_correct xuong client', () => {
  it('cat is_correct khoi moi option; JSON khong chua chuoi is_correct', () => {
    const row: QuizPaperServerRow = {
      quizId: 'quiz-1',
      courseSlug: 'thau-hieu-noi-tam',
      lessonId: 'lesson-1',
      courseId: 'course-1',
      title: 'Kiểm tra',
      description: null,
      passingScore: null,
      timeLimitSec: 300,
      maxAttempts: 2,
      shuffleQuestions: false,
      attemptsUsed: 1,
      questions: [
        {
          id: 'q1',
          question: 'Câu 1?',
          questionType: 'single_choice',
          points: 1,
          options: [
            { id: 'o1', optionText: 'A', displayOrder: 1, isCorrect: false },
            { id: 'o2', optionText: 'B', displayOrder: 2, isCorrect: true },
          ],
        },
      ],
    };
    const paper = toPublicPaper(row);
    expect(JSON.stringify(paper)).not.toContain('is_correct');
    expect(JSON.stringify(paper)).not.toContain('isCorrect');
    expect(paper.passingScore).toBe(70); // NULL -> mac dinh 70
    expect(paper.lessonId).toBe('lesson-1');
    expect(paper.courseId).toBe('course-1');
    expect(paper.attemptsRemaining).toBe(1);
    expect(paper.questions[0].options).toEqual([
      { id: 'o1', optionText: 'A', displayOrder: 1 },
      { id: 'o2', optionText: 'B', displayOrder: 2 },
    ]);
  });
});

describe('fetch wrappers (fetch gia)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchQuizPaper tra paper khi ok', async () => {
    const paper = makePaper();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, paper }), { status: 200 }),
      ),
    );
    await expect(fetchQuizPaper('quiz-1')).resolves.toEqual(paper);
  });

  it('fetchQuizPaper loi 401 -> QuizApiError status 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, error: 'unauthenticated' }), { status: 401 }),
      ),
    );
    await expect(fetchQuizPaper('quiz-1')).rejects.toMatchObject({
      status: 401,
      code: 'unauthenticated',
    });
    expect(fetchQuizPaper('quiz-1')).rejects.toBeInstanceOf(QuizApiError);
  });

  it('submitQuizAttempt gui POST + tra ket qua', async () => {
    const result = {
      attemptId: 'att-1',
      score: 8,
      total: 10,
      percent: 80,
      passed: true,
      needsReview: false,
      status: 'submitted',
      results: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      submitQuizAttempt('quiz-1', {
        startedAt: new Date(0).toISOString(),
        answers: [{ questionId: 'q1', optionIds: ['o1'] }],
      }),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/quizzes/quiz-1/submit',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('submitQuizAttempt nhan result camelCase tu route (sau map B-T08-7)', async () => {
    const result = {
      attemptId: 'att-9',
      score: 4,
      total: 5,
      percent: 80,
      passed: true,
      needsReview: true,
      status: 'submitted',
      results: [
        {
          questionId: 'q1',
          questionType: 'single_choice',
          isCorrect: true,
          pointsAwarded: 1,
          points: 1,
          explanation: 'Giai thich',
          correctOptionIds: ['o1'],
          selectedOptionIds: ['o1'],
          answerText: null,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, result }), { status: 200 }),
      ),
    );
    await expect(
      submitQuizAttempt('quiz-1', {
        startedAt: new Date(0).toISOString(),
        answers: [{ questionId: 'q1', optionIds: ['o1'] }],
      }),
    ).resolves.toEqual(result);
  });

  it('submit het luot (409 max_attempts_reached) -> QuizApiError code giu nguyen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, error: 'max_attempts_reached' }), { status: 409 }),
      ),
    );
    await expect(
      submitQuizAttempt('quiz-1', { startedAt: new Date(0).toISOString(), answers: [] }),
    ).rejects.toMatchObject({ status: 409, code: 'max_attempts_reached' });
  });

  it('fetchQuizHistory tra danh sach attempts', async () => {
    const attempts = [
      {
        id: 'att-1',
        quizId: 'quiz-1',
        score: 8,
        total: 10,
        percent: 80,
        passed: true,
        needsReview: false,
        status: 'submitted',
        startedAt: null,
        submittedAt: '2026-11-10T00:00:00.000Z',
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, attempts }), { status: 200 }),
      ),
    );
    await expect(fetchQuizHistory('quiz-1')).resolves.toEqual(attempts);
  });
});

describe('B-T08-7 — map camelCase <-> snake_case cho route submit', () => {
  it('toSnakeCaseQuizAnswers: questionId/optionIds/answerText -> snake_case', () => {
    expect(
      toSnakeCaseQuizAnswers([
        { questionId: 'q1', optionIds: ['o1', 'o2'], answerText: '' },
        { questionId: 'q2', answerText: '  dap an  ' },
        { questionId: 'q3' },
      ]),
    ).toEqual([
      { question_id: 'q1', option_ids: ['o1', 'o2'], answer_text: '' },
      { question_id: 'q2', option_ids: [], answer_text: '  dap an  ' },
      { question_id: 'q3', option_ids: [], answer_text: '' },
    ]);
  });

  it('toSnakeCaseQuizAnswers khong doi mang goc', () => {
    const input: QuizAnswerInput[] = [{ questionId: 'q1', optionIds: ['o1'] }];
    toSnakeCaseQuizAnswers(input);
    expect(input).toEqual([{ questionId: 'q1', optionIds: ['o1'] }]);
  });

  it('toCamelCaseQuizSubmitResult: snake_case SQL -> camelCase client', () => {
    expect(
      toCamelCaseQuizSubmitResult({
        attempt_id: 'att-1',
        score: 4,
        total: 5,
        percent: 80,
        passed: true,
        needs_review: true,
        status: 'submitted',
        results: [
          {
            question_id: 'q1',
            question_type: 'single_choice',
            is_correct: true,
            points_awarded: 1,
            points: 1,
            explanation: 'Giai thich',
            correct_option_ids: ['o1'],
            selected_option_ids: ['o1'],
            answer_text: null,
          },
          {
            question_id: 'q5',
            question_type: 'essay',
            is_correct: null,
            points_awarded: 0,
            points: 1,
            explanation: null,
            correct_option_ids: [],
            selected_option_ids: [],
            answer_text: 'Bai tu luan',
          },
        ],
      }),
    ).toEqual({
      attemptId: 'att-1',
      score: 4,
      total: 5,
      percent: 80,
      passed: true,
      needsReview: true,
      status: 'submitted',
      results: [
        {
          questionId: 'q1',
          questionType: 'single_choice',
          isCorrect: true,
          pointsAwarded: 1,
          points: 1,
          explanation: 'Giai thich',
          correctOptionIds: ['o1'],
          selectedOptionIds: ['o1'],
          answerText: null,
        },
        {
          questionId: 'q5',
          questionType: 'essay',
          isCorrect: null,
          pointsAwarded: 0,
          points: 1,
          explanation: null,
          correctOptionIds: [],
          selectedOptionIds: [],
          answerText: 'Bai tu luan',
        },
      ],
    });
  });

  it('toCamelCaseQuizSubmitResult tra null khi thieu attempt_id / sai kieu', () => {
    expect(toCamelCaseQuizSubmitResult(null)).toBeNull();
    expect(toCamelCaseQuizSubmitResult({ score: 1 })).toBeNull();
    expect(
      toCamelCaseQuizSubmitResult({
        attempt_id: 'att-1',
        score: 1,
        total: 1,
        percent: 100,
        passed: true,
        needs_review: false,
        status: 'submitted',
        results: [{ question_id: 'q1' }],
      }),
    ).toBeNull();
  });
});
