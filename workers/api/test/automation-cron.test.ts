// Unit test — TASK 11 Automation Cron.
// Fake store/mailer + fetch stub: KHONG cham DB that, KHONG gui email that.
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  handleAutomationCronHttp,
  handleAutomationScheduled,
  runLearningReminderCron,
} from '../src/automation-cron';
import {
  type AutomationStore,
  type EmailLogRow,
  type EnrollmentRef,
  type InactiveLearner,
  type Mailer,
  type SendEmailInput,
} from '../src/automation-rules';
import type { Env } from '../src/env';

const NOW = new Date('2026-11-10T10:00:00+07:00');
const COURSE_ID = '22222222-2222-2222-2222-222222222222';
const COURSE_SLUG = 'thau-hieu-noi-tam';

class FakeStore implements AutomationStore {
  emailLogs: EmailLogRow[] = [];
  events: Array<{ id: string; status: string }> = [];
  enrollments: EnrollmentRef[] = [];
  inactiveLearners: InactiveLearner[] = [];
  listInactiveCalls = 0;
  private seq = 0;

  async findEmailLogs(query: { toEmail?: string; template?: string; sinceIso?: string }) {
    return this.emailLogs.filter((log) => {
      if (query.toEmail && log.to_email !== query.toEmail) return false;
      if (query.template && log.template !== query.template) return false;
      if (query.sinceIso && log.created_at < query.sinceIso) return false;
      return true;
    });
  }

  async insertEmailLog(entry: {
    to_email: string;
    template: string;
    status: string;
    related_type: string;
    related_id: string;
  }) {
    this.seq += 1;
    const row: EmailLogRow = {
      id: `log-${this.seq}`,
      ...entry,
      resend_id: null,
      created_at: NOW.toISOString(),
    };
    this.emailLogs.push(row);
    return { id: row.id };
  }

  async updateEmailLog(id: string, patch: { status: string; resend_id?: string | null }) {
    const row = this.emailLogs.find((l) => l.id === id);
    if (row) {
      row.status = patch.status;
      if (patch.resend_id !== undefined) row.resend_id = patch.resend_id;
    }
  }

  async insertAutomationEvent(event: {
    event_type: string;
    user_id: string;
    related_type: string;
    related_id: string;
    payload: Record<string, unknown>;
  }) {
    this.seq += 1;
    const row = { id: `evt-${this.seq}`, status: 'pending' };
    this.events.push(row);
    return { id: row.id };
  }

  async updateAutomationEvent(id: string, patch: { status: string }) {
    const row = this.events.find((e) => e.id === id);
    if (row) row.status = patch.status;
  }

  async getEnrollment(userId: string, courseId: string) {
    return (
      this.enrollments.find((e) => e.user_id === userId && e.course_id === courseId) ?? null
    );
  }

  async getEnrollmentByOrder() {
    return null;
  }

  async getCertificate() {
    return null;
  }

  async listInactiveLearners() {
    this.listInactiveCalls += 1;
    return this.inactiveLearners;
  }
}

class FakeMailer implements Mailer {
  calls: SendEmailInput[] = [];
  failFor = new Set<string>();

  async sendEmail(input: SendEmailInput) {
    this.calls.push(input);
    if (this.failFor.has(input.to)) throw new Error('Resend HTTP 500');
    return { resendId: `re_test_${this.calls.length}` };
  }
}

function learner(userId: string, email: string, enrollmentId: string): InactiveLearner {
  return {
    userId,
    email,
    fullName: `HV ${userId}`,
    enrollmentId,
    courseId: COURSE_ID,
    courseSlug: COURSE_SLUG,
    courseTitle: 'Thấu Hiểu Nội Tâm',
    lastActivityAt: '2026-11-05T10:00:00+07:00',
    enrolledAt: '2026-11-01T10:00:00+07:00',
  };
}

function enrollment(userId: string, enrollmentId: string): EnrollmentRef {
  return {
    id: enrollmentId,
    user_id: userId,
    course_id: COURSE_ID,
    status: 'active',
    completed_at: null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runLearningReminderCron', () => {
  it('quota con du -> quet va gui cho ca 2 hoc vien', async () => {
    const store = new FakeStore();
    store.inactiveLearners = [
      learner('user-a', 'a@example.vn', 'enr-a'),
      learner('user-b', 'b@example.vn', 'enr-b'),
    ];
    store.enrollments = [enrollment('user-a', 'enr-a'), enrollment('user-b', 'enr-b')];
    const mailer = new FakeMailer();
    const summary = await runLearningReminderCron({ store, mailer }, NOW);
    expect(summary.deferred).toBe(false);
    expect(summary.scanned).toBe(2);
    expect(summary.sent).toBe(2);
    expect(summary.skipped).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it('da gui >= 90 email hom nay -> tam hoan dot nhac, khong quet', async () => {
    const store = new FakeStore();
    for (let i = 0; i < 90; i += 1) {
      store.emailLogs.push({
        id: `seed-${i}`,
        to_email: `hv${i}@example.vn`,
        template: 'E1',
        resend_id: 're_seed',
        status: 'sent',
        related_type: 'profiles',
        related_id: `user-${i}`,
        created_at: NOW.toISOString(),
      });
    }
    store.inactiveLearners = [learner('user-a', 'a@example.vn', 'enr-a')];
    const mailer = new FakeMailer();
    const summary = await runLearningReminderCron({ store, mailer }, NOW);
    expect(summary.deferred).toBe(true);
    expect(summary.reason).toMatch(/daily_quota_near_limit/);
    expect(summary.sent).toBe(0);
    expect(store.listInactiveCalls).toBe(0);
    expect(mailer.calls).toHaveLength(0);
  });

  it('1 hoc vien loi gui -> dot van chay tiep, failed dem rieng', async () => {
    const store = new FakeStore();
    store.inactiveLearners = [
      learner('user-a', 'a@example.vn', 'enr-a'),
      learner('user-b', 'b@example.vn', 'enr-b'),
    ];
    store.enrollments = [enrollment('user-a', 'enr-a'), enrollment('user-b', 'enr-b')];
    const mailer = new FakeMailer();
    mailer.failFor.add('b@example.vn');
    const summary = await runLearningReminderCron({ store, mailer }, NOW);
    expect(summary.scanned).toBe(2);
    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results.find((r) => r.userId === 'user-b')?.outcome).toBe('failed');
  });
});

describe('handleAutomationScheduled', () => {
  it('thieu Resend key -> deferred, khong gui', async () => {
    const env: Env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    };
    const summary = await handleAutomationScheduled(env, { now: NOW });
    expect(summary.deferred).toBe(true);
    expect(summary.reason).toMatch(/RESEND_API_KEY/);
    expect(summary.sent).toBe(0);
  });
});

describe('handleAutomationCronHttp (kich hoat tay, admin)', () => {
  const env: Env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    RESEND_API_KEY: 're_key',
    RESEND_FROM_EMAIL: 'Visfar Academy <chao@visfaracademy.vn>',
  };

  it('khong phai admin -> 403', async () => {
    const res = await handleAutomationCronHttp(env, { isAdmin: false });
    expect(res.status).toBe(403);
  });

  it('admin nhung thieu Resend key -> 503', async () => {
    const noKeyEnv: Env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    };
    const res = await handleAutomationCronHttp(noKeyEnv, { isAdmin: true });
    expect(res.status).toBe(503);
  });

  it('admin + fetch stub -> 200, quet 1 gui 1 (khong gui that)', async () => {
    const json = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const empty = () => new Response(null, { status: 200 });
    const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.startsWith('https://api.resend.com/emails')) {
        return json({ id: 're_1' });
      }
      if (url.includes('/email_logs?')) return json([]);
      if (url.includes('/enrollments?') && url.includes('user_id=eq.')) {
        return json([
          {
            id: 'enr-a',
            user_id: 'user-a',
            course_id: COURSE_ID,
            status: 'active',
            completed_at: null,
          },
        ]);
      }
      if (url.includes('/enrollments?')) {
        return json([
          {
            id: 'enr-a',
            user_id: 'user-a',
            course_id: COURSE_ID,
            status: 'active',
            enrolled_at: '2026-11-01T10:00:00+07:00',
            profiles: { email: 'a@example.vn', full_name: 'A' },
            courses: { title: 'Thấu Hiểu Nội Tâm', slug: COURSE_SLUG },
          },
        ]);
      }
      if (url.includes('/lesson_progress?')) return json([]);
      if (url.includes('/email_logs') && method === 'POST') {
        return json([{ id: 'log-1' }]);
      }
      if (url.includes('/automation_events') && method === 'POST') {
        return json([{ id: 'evt-1' }]);
      }
      if (method === 'PATCH') return empty();
      throw new Error(`unexpected fetch ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchStub);

    const res = await handleAutomationCronHttp(env, { isAdmin: true, now: NOW });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.scanned).toBe(1);
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(0);
    // Resend chi duoc goi 1 lan, qua fetch stub — khong gui that.
    expect(
      fetchStub.mock.calls.filter((c) =>
        String(c[0]).startsWith('https://api.resend.com/emails'),
      ),
    ).toHaveLength(1);
  });
});
