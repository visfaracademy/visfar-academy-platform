// Hook hoan thanh khoa — Task 11 (E11), phia Workers.
//
//   Goi tu handlers/progress.ts (saveRow) SAU KHI 1 bai vua chuyen sang
//   'completed' (khong goi khi bai da completed tu truoc, khong goi
//   khi chi mo/xem bai). Luong:
//     1. Kiem tra enrollment dang 'active' va TAT CA bai dang hien cua
//        khoa deu completed (tinh tu DB — khong tin claim client).
//     2. Neu du: enrollment -> 'completed' (+ completed_at).
//     3. Gui mail E11 qua rule san runCourseCompleted
//        (automation-rules.ts): rule tu kiem tra enrollment completed,
//        chong gui trung trong ngay (cung enrollment + E11), ghi
//        automation_events + email_logs.
//   KHONG BAO GIO throw: loi o bat ky buoc nao (ke ca loi ghi DB phu
//   hay thieu cau hinh Resend) chi tra ve trong ket qua — luong luu
//   tien do goi hook nay khong duoc hong vi email.
//   Neu chua co RESEND_API_KEY / RESEND_FROM_EMAIL thi enrollment VAN
//   duoc danh dau completed, chi bo qua buoc gui mail (tra
//   emailOutcome 'not_configured') — giong cach handleAutomationScheduled
//   tra deferred khi thieu key.
//
//   Luu y trung thuc (gioi han cua rule san, khong sua o day):
//   runCourseCompleted gui qua Mailer truc tiep (sendEmail cua
//   client.ts), KHONG di qua lop kiem tra consent nhu
//   sendTemplatedEmail — hoc vien da huy nhan tin (care) van co the
//   nhan E11. Can follow-up: them kiem tra consent vao
//   executeAutomationRule hoac chuyen rule care sang sendTemplatedEmail.
import type { Env } from '../env';
import {
  createResendMailerFromEnv,
  createSupabaseAutomationStore,
  runCourseCompleted,
  type AutomationDeps,
} from '../automation-rules';
import {
  countCompletedLessons,
  getCourseTitle,
  getEnrollment,
  getProfileEmail,
  listCourseLessonIds,
  markEnrollmentCompleted,
} from '../supabase';

export interface CourseCompletionHookResult {
  /** Enrollment co chuyen sang 'completed' o lan nay khong. */
  courseCompleted: boolean;
  emailOutcome?: 'sent' | 'skipped' | 'failed' | 'not_configured' | 'no_email';
  emailReason?: string;
}

export interface CourseCompletionDeps {
  getEnrollmentFn?: typeof getEnrollment;
  listLessonIdsFn?: typeof listCourseLessonIds;
  countCompletedFn?: typeof countCompletedLessons;
  markCompletedFn?: typeof markEnrollmentCompleted;
  getProfileFn?: typeof getProfileEmail;
  getCourseFn?: typeof getCourseTitle;
  /** Tao AutomationDeps (store + mailer) — chi dung trong test. */
  createDepsFn?: (env: Env) => AutomationDeps;
  /** Chay rule E11 — chi dung trong test. */
  runCourseCompletedFn?: typeof runCourseCompleted;
}

function defaultDeps(env: Env): AutomationDeps {
  return {
    store: createSupabaseAutomationStore(env),
    mailer: createResendMailerFromEnv(env),
  };
}

export async function maybeCompleteCourseAndNotify(
  env: Env,
  input: { userId: string; courseId: string; nowIso: string },
  deps: CourseCompletionDeps = {},
): Promise<CourseCompletionHookResult> {
  const getEnrollmentFn = deps.getEnrollmentFn ?? getEnrollment;
  const listLessonIdsFn = deps.listLessonIdsFn ?? listCourseLessonIds;
  const countCompletedFn = deps.countCompletedFn ?? countCompletedLessons;
  const markCompletedFn = deps.markCompletedFn ?? markEnrollmentCompleted;
  const getProfileFn = deps.getProfileFn ?? getProfileEmail;
  const getCourseFn = deps.getCourseFn ?? getCourseTitle;
  const runRule = deps.runCourseCompletedFn ?? runCourseCompleted;

  // --- Buoc 1+2: du dieu kien thi danh dau enrollment completed. ---
  let enrollmentId: string;
  try {
    const enrollment = await getEnrollmentFn(env, input.userId, input.courseId);
    if (!enrollment || enrollment.status !== 'active') return { courseCompleted: false };
    const lessonIds = await listLessonIdsFn(env, input.courseId);
    if (lessonIds.length === 0) return { courseCompleted: false };
    const done = await countCompletedFn(env, input.userId, lessonIds);
    if (done < lessonIds.length) return { courseCompleted: false };
    const marked = await markCompletedFn(env, enrollment.id, input.nowIso);
    if (!marked) return { courseCompleted: false };
    enrollmentId = enrollment.id;
  } catch (err) {
    try {
      console.log(
        '[course-completion] check failed',
        err instanceof Error ? err.message : 'unknown',
      );
    } catch {
      // Bo qua loi log.
    }
    return { courseCompleted: false, emailOutcome: 'failed', emailReason: 'check_failed' };
  }

  // --- Buoc 3: gui mail E11. Loi o day KHONG hoan tac completed. ---
  try {
    const profile = await getProfileFn(env, input.userId);
    const course = await getCourseFn(env, input.courseId);
    const toEmail = profile?.email ?? null;
    if (!toEmail) {
      return { courseCompleted: true, emailOutcome: 'no_email', emailReason: 'missing_email' };
    }
    const apiKey = (env.RESEND_API_KEY ?? '').trim();
    const from = (env.RESEND_FROM_EMAIL ?? '').trim();
    if (!apiKey || !from) {
      return { courseCompleted: true, emailOutcome: 'not_configured', emailReason: 'resend_not_configured' };
    }
    const automationDeps = deps.createDepsFn ? deps.createDepsFn(env) : defaultDeps(env);
    const result = await runRule(
      {
        userId: input.userId,
        email: toEmail,
        fullName: profile?.full_name?.trim() || toEmail,
        courseId: input.courseId,
        courseTitle: course?.title ?? 'Khóa học',
        enrollmentId,
      },
      automationDeps,
      new Date(input.nowIso),
    );
    return { courseCompleted: true, emailOutcome: result.outcome, emailReason: result.reason };
  } catch (err) {
    try {
      console.log(
        '[course-completion] email failed',
        err instanceof Error ? err.message : 'unknown',
      );
    } catch {
      // Bo qua loi log.
    }
    return { courseCompleted: true, emailOutcome: 'failed', emailReason: 'hook_error' };
  }
}
