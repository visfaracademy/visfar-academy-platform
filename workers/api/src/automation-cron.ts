// Cron handler — TASK 11: Visfar Academy.
//
// Chi co rule (3) learning_reminder chay theo cron. 4 rule con lai la
// event-driven (goi truc tiep tu route/webhook — xem automation-rules.ts
// dau file) va KHONG di qua cron nay.
//
// Kich hoat:
//   1. Workers Cron (khuyen nghi): them vao workers/api/wrangler.toml
//        [triggers]
//        crons = ["0 * * * *"]          # moi gio, theo kien truc §9
//      va noi scheduled() cua Worker entrypoint (workers/api/src/index.ts)
//      vao handleAutomationScheduled() o duoi. Tan suat thuc gui: nho cap
//      1 lan/3 ngay/enrollment nen cron chay moi gio chi de quet, khong
//      phai de gui moi gio.
//   2. Kich hoat tay (admin): POST /api/v1/admin/automation/run
//      (route do nhom lam entrypoint tao, CHI admin, kiem tra JWT + role
//      truoc khi goi handleAutomationCronHttp() o duoi).
//
// Uu tien transactional: cron nay chi gui email NHAC (E9). Neu hom nay
// da gui gan het han muc Resend (100 email/ngay, nguong tam hoan 90)
// thi cron TAM HOAN toan bo dot nhac (deferred, khong gui nua) de danh
// quota cho email giao dich (E5/E6 — chay event-driven, khong qua cron,
// khong bi chan). Dot nhac bi hoan se duoc quet lai o lan cron sau.
//
// Gui that di qua sendEmail() cua nhom templates (src/email/client) —
// no tu render mau E9. Cron chi can RESEND_API_KEY + RESEND_FROM_EMAIL
// (Workers Secrets); thieu thi tra deferred (khong gui bua).
import type { Env } from './env';
import { jsonError, jsonOk, ApiError } from './errors';
import {
  createResendMailerFromEnv,
  createSupabaseAutomationStore,
  REMINDER_DEFERRAL_THRESHOLD,
  RESEND_DAILY_LIMIT,
  runLearningReminderForLearner,
  vnDayStartIso,
  type AutomationDeps,
  type Mailer,
  type RuleResult,
} from './automation-rules';

export interface CronSummary {
  deferred: boolean;
  /** Ly do tam hoan (neu deferred). */
  reason?: string;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Chi tiet tung hoc vien (khong chua PII ngoai user id). */
  results: Array<{
    userId: string;
    enrollmentId: string;
    outcome: RuleResult['outcome'];
    reason: string;
  }>;
}

const ZERO_SUMMARY: Omit<CronSummary, 'deferred' | 'reason'> = {
  scanned: 0,
  sent: 0,
  skipped: 0,
  failed: 0,
  results: [],
};

function countOutcome(results: CronSummary['results'], outcome: RuleResult['outcome']): number {
  return results.filter((r) => r.outcome === outcome).length;
}

/**
 * Quet hoc vien khong hoat dong va gui nhac (rule 3). Loi cua 1 hoc vien
 * (mailer loi / store loi) chi ghi vao results, khong lam dung ca dot.
 */
export async function runLearningReminderCron(
  deps: AutomationDeps,
  now: Date = new Date(),
): Promise<CronSummary> {
  // Uu tien transactional: gan het quota ngay thi tam hoan dot nhac.
  const todayLogs = await deps.store.findEmailLogs({
    sinceIso: vnDayStartIso(now),
  });
  const sentToday = todayLogs.filter(
    (log) => log.status === 'sent' || log.status === 'delivered',
  ).length;
  if (sentToday >= REMINDER_DEFERRAL_THRESHOLD) {
    return {
      ...ZERO_SUMMARY,
      deferred: true,
      reason: `daily_quota_near_limit: da gui ${sentToday} email hom nay (nguong tam hoan ${REMINDER_DEFERRAL_THRESHOLD}/${RESEND_DAILY_LIMIT})`,
    };
  }

  const learners = await deps.store.listInactiveLearners(now, 3);
  const results: CronSummary['results'] = [];
  for (const learner of learners) {
    try {
      const r = await runLearningReminderForLearner(learner, deps, now);
      results.push({
        userId: learner.userId,
        enrollmentId: learner.enrollmentId,
        outcome: r.outcome,
        reason: r.reason,
      });
    } catch (err) {
      results.push({
        userId: learner.userId,
        enrollmentId: learner.enrollmentId,
        outcome: 'failed',
        reason: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }
  return {
    deferred: false,
    scanned: learners.length,
    sent: countOutcome(results, 'sent'),
    skipped: countOutcome(results, 'skipped'),
    failed: countOutcome(results, 'failed'),
    results,
  };
}

export interface ScheduledOptions {
  now?: Date;
}

/**
 * Diem noi cho Workers `scheduled` event (wrangler crons). Entry point
 * cua Worker (index.ts) goi ham nay.
 */
export async function handleAutomationScheduled(
  env: Env,
  options: ScheduledOptions = {},
): Promise<CronSummary> {
  const now = options.now ?? new Date();
  const store = createSupabaseAutomationStore(env);
  let mailer: Mailer;
  try {
    mailer = createResendMailerFromEnv(env);
  } catch (err) {
    return {
      ...ZERO_SUMMARY,
      deferred: true,
      reason: err instanceof Error ? err.message : 'resend_not_configured',
    };
  }
  return runLearningReminderCron({ store, mailer }, now);
}

/** Ham scheduled dung truc tiep lam handler wrangler. */
export function createScheduledHandler() {
  return async (
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> => {
    ctx.waitUntil(
      handleAutomationScheduled(env).then(
        (summary) => {
          console.log('[automation-cron]', JSON.stringify(summary));
        },
        (err: unknown) => {
          console.log(
            '[automation-cron] failed',
            err instanceof Error ? err.message : 'unknown',
          );
        },
      ),
    );
  };
}

/**
 * Kich hoat tay cho route admin POST /api/v1/admin/automation/run.
 * Route phai kiem tra admin TRUOC khi goi (JWT + role). Thieu Resend
 * key -> 503, khong gui bua.
 */
export async function handleAutomationCronHttp(
  env: Env,
  opts: { isAdmin: boolean; now?: Date },
): Promise<Response> {
  if (!opts.isAdmin) {
    return jsonError(new ApiError(403, 'forbidden', 'Chỉ quản trị viên mới được chạy automation.'));
  }
  let mailer: Mailer;
  try {
    mailer = createResendMailerFromEnv(env);
  } catch {
    return jsonError(
      new ApiError(503, 'server_error', 'API chưa được cấu hình gửi email (RESEND_API_KEY / RESEND_FROM_EMAIL).'),
    );
  }
  const store = createSupabaseAutomationStore(env);
  const summary = await runLearningReminderCron(
    { store, mailer },
    opts.now ?? new Date(),
  );
  return jsonOk({
    deferred: summary.deferred,
    reason: summary.reason ?? null,
    scanned: summary.scanned,
    sent: summary.sent,
    skipped: summary.skipped,
    failed: summary.failed,
  });
}
