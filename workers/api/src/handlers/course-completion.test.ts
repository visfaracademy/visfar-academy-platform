// Test Task 11: hook hoan thanh khoa (E11) — Workers progress handler.
// Fake deps: KHONG cham Supabase that, KHONG gui email that.
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import {
  maybeCompleteCourseAndNotify,
  type CourseCompletionDeps,
} from './course-completion';

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  RESEND_API_KEY: 're_test_key',
  RESEND_FROM_EMAIL: 'Visfar Academy <hello@visfaracademy.vn>',
} as unknown as Env;

const NO_KEY_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
} as unknown as Env;

const INPUT = {
  userId: '11111111-1111-1111-1111-111111111111',
  courseId: '22222222-2222-2222-2222-222222222222',
  nowIso: '2026-11-10T10:00:00.000Z',
};

function baseDeps(overrides: Partial<CourseCompletionDeps> = {}): CourseCompletionDeps {
  return {
    getEnrollmentFn: async () => ({ id: 'enr-1', status: 'active' }),
    listLessonIdsFn: async () => ['l1', 'l2'],
    countCompletedFn: async () => 2,
    markCompletedFn: async () => true,
    getProfileFn: async () => ({
      id: INPUT.userId,
      email: 'a@example.com',
      full_name: 'Nguyễn Văn A',
    }),
    getCourseFn: async () => ({ id: INPUT.courseId, title: 'Khóa 1' }),
    runCourseCompletedFn: async () => ({
      rule: 'course_completed',
      outcome: 'sent',
      reason: 'sent',
      idempotencyKey: 'k1',
    }),
    ...overrides,
  };
}

describe('maybeCompleteCourseAndNotify', () => {
  it('du 100% bai -> enrollment completed + goi rule E11', async () => {
    const runRule = vi.fn(async () => ({
      rule: 'course_completed' as const,
      outcome: 'sent' as const,
      reason: 'sent',
      idempotencyKey: 'k1',
    }));
    const mark = vi.fn(async () => true);
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      runCourseCompletedFn: runRule,
      markCompletedFn: mark,
    }));
    expect(res).toEqual({ courseCompleted: true, emailOutcome: 'sent', emailReason: 'sent' });
    expect(mark).toHaveBeenCalledTimes(1);
    expect(runRule).toHaveBeenCalledTimes(1);
    const call = (runRule as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as
      | { email?: string; fullName?: string; courseTitle?: string; enrollmentId?: string }
      | undefined;
    expect(call?.email).toBe('a@example.com');
    expect(call?.fullName).toBe('Nguyễn Văn A');
    expect(call?.courseTitle).toBe('Khóa 1');
    expect(call?.enrollmentId).toBe('enr-1');
  });

  it('chua du 100% bai -> khong danh dau, khong gui mail', async () => {
    const mark = vi.fn(async () => true);
    const runRule = vi.fn();
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      countCompletedFn: async () => 1,
      markCompletedFn: mark,
      runCourseCompletedFn: runRule,
    }));
    expect(res.courseCompleted).toBe(false);
    expect(mark).not.toHaveBeenCalled();
    expect(runRule).not.toHaveBeenCalled();
  });

  it('enrollment da completed tu truoc -> khong gui lai', async () => {
    const runRule = vi.fn();
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      getEnrollmentFn: async () => ({ id: 'enr-1', status: 'completed' }),
      runCourseCompletedFn: runRule,
    }));
    expect(res.courseCompleted).toBe(false);
    expect(runRule).not.toHaveBeenCalled();
  });

  it('enrollment revoked -> khong lam gi', async () => {
    const runRule = vi.fn();
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      getEnrollmentFn: async () => ({ id: 'enr-1', status: 'revoked' }),
      runCourseCompletedFn: runRule,
    }));
    expect(res.courseCompleted).toBe(false);
    expect(runRule).not.toHaveBeenCalled();
  });

  it('khoa chua co bai -> khong danh dau', async () => {
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      listLessonIdsFn: async () => [],
    }));
    expect(res.courseCompleted).toBe(false);
  });

  it('chua co key Resend -> enrollment van completed, mail not_configured', async () => {
    const runRule = vi.fn();
    const res = await maybeCompleteCourseAndNotify(NO_KEY_ENV, INPUT, baseDeps({
      runCourseCompletedFn: runRule,
    }));
    expect(res.courseCompleted).toBe(true);
    expect(res.emailOutcome).toBe('not_configured');
    expect(runRule).not.toHaveBeenCalled();
  });

  it('khong co email hoc vien -> completed, mail no_email', async () => {
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      getProfileFn: async () => ({ id: INPUT.userId, email: null, full_name: null }),
    }));
    expect(res.courseCompleted).toBe(true);
    expect(res.emailOutcome).toBe('no_email');
  });

  it('rule tra skipped (trung trong ngay) -> completed van true, outcome skipped', async () => {
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      runCourseCompletedFn: async () => ({
        rule: 'course_completed' as const,
        outcome: 'skipped' as const,
        reason: 'duplicate',
        idempotencyKey: 'k1',
      }),
    }));
    expect(res).toEqual({ courseCompleted: true, emailOutcome: 'skipped', emailReason: 'duplicate' });
  });

  it('rule nem loi -> completed van true, outcome failed, khong throw', async () => {
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      runCourseCompletedFn: async () => {
        throw new Error('store down');
      },
    }));
    expect(res.courseCompleted).toBe(true);
    expect(res.emailOutcome).toBe('failed');
  });

  it('loi kiem tra dieu kien (store nem) -> khong throw, courseCompleted false', async () => {
    const res = await maybeCompleteCourseAndNotify(ENV, INPUT, baseDeps({
      getEnrollmentFn: async () => {
        throw new Error('supabase down');
      },
    }));
    expect(res.courseCompleted).toBe(false);
  });
});
