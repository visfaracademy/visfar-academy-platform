// Test hook mail cap quyen hoc (E5) — Task 11, phia Workers.
// Chay local, khong can Supabase/Resend that: moi phu thuoc DB/mail
// deu duoc tiem qua deps cua notifyEnrollmentGranted().
import { describe, expect, it, vi } from 'vitest';
import {
  notifyEnrollmentGranted,
  type OrderItemRow,
  type OrderRow,
} from './payments';
import type { Env } from './env';
import type { AutomationDeps } from './automation-rules';
import type { runPaymentVerifiedAccess } from './automation-rules';

const envWithResend = {
  RESEND_API_KEY: 're_test_key',
  RESEND_FROM_EMAIL: 'Visfar Academy <hello@visfar.academy>',
} as unknown as Env;

const order = {
  id: 'o1',
  user_id: 'u1',
  reference_code: 'DH-2026-000001',
  amount_vnd: 1999000,
  status: 'paid',
  paid_at: '2026-11-10T10:00:00Z',
} as unknown as OrderRow;

function courseItem(courseId: string): OrderItemRow {
  return {
    id: `i-${courseId}`,
    order_id: 'o1',
    item_type: 'course',
    course_id: courseId,
    membership_plan_id: null,
    title_snapshot: 'Khóa học',
    amount_vnd: 1999000,
    item_name: 'Khóa học',
    unit_price_vnd: 1999000,
    quantity: 1,
    total_vnd: 1999000,
  };
}

function membershipItem(planId: string): OrderItemRow {
  return {
    id: `i-${planId}`,
    order_id: 'o1',
    item_type: 'membership',
    course_id: null,
    membership_plan_id: planId,
    title_snapshot: 'Gói thành viên',
    amount_vnd: 990000,
    item_name: 'Gói thành viên',
    unit_price_vnd: 990000,
    quantity: 1,
    total_vnd: 990000,
  };
}

const profileFn = async () => ({ id: 'u1', email: 'hv@example.com', full_name: 'Nguyễn Văn A' });
const nameFn = async () => 'Nguyễn Văn A';
const metaFn = async (_env: Env, courseId: string) => ({
  id: courseId,
  slug: `khoa-${courseId}`,
  title: `Khóa ${courseId}`,
});
const fakeDeps = { store: {}, mailer: {} } as unknown as AutomationDeps;
const createDepsFn = () => fakeDeps;

function sentRule() {
  return vi.fn(async () => ({ outcome: 'sent', reason: undefined })) as unknown as typeof runPaymentVerifiedAccess;
}

describe('notifyEnrollmentGranted — E5 sau thanh toan verified', () => {
  it('1 khoa -> goi rule 1 lan, outcome sent', async () => {
    const runRule = sentRule();
    const res = await notifyEnrollmentGranted(envWithResend, order, [courseItem('c1')], {
      runRuleFn: runRule,
      getCourseMetaFn: metaFn,
      getProfileEmailFn: profileFn,
      getProfileNameFn: nameFn,
      createDepsFn,
    });
    expect(res).toEqual({ courses: 1, sent: 1, skipped: 0, failed: 0, outcome: 'sent' });
    expect(runRule).toHaveBeenCalledTimes(1);
    const input = (runRule as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input['userId']).toBe('u1');
    expect(input['email']).toBe('hv@example.com');
    expect(input['orderId']).toBe('o1');
    expect(input['courseId']).toBe('c1');
    expect(input['courseSlug']).toBe('khoa-c1');
    expect(input['paymentStatus']).toBe('succeeded');
    expect(input['amountVnd']).toBe(1999000);
  });

  it('goi membership kem khoa -> E5 cho khoa kem theo', async () => {
    const runRule = sentRule();
    const res = await notifyEnrollmentGranted(envWithResend, order, [membershipItem('p1')], {
      runRuleFn: runRule,
      getCourseMetaFn: metaFn,
      getProfileEmailFn: profileFn,
      getProfileNameFn: nameFn,
      getPlanFn: (async () => ({ id: 'p1', course_id: 'c9' })) as never,
      createDepsFn,
    });
    expect(res.courses).toBe(1);
    expect(res.sent).toBe(1);
    const input = (runRule as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input['courseId']).toBe('c9');
  });

  it('khong co email nguoi nhan -> no_email, khong goi rule', async () => {
    const runRule = sentRule();
    const res = await notifyEnrollmentGranted(envWithResend, order, [courseItem('c1')], {
      runRuleFn: runRule,
      getCourseMetaFn: metaFn,
      getProfileEmailFn: async () => ({ id: 'u1', email: null, full_name: 'Nguyễn Văn A' }),
      getProfileNameFn: nameFn,
      createDepsFn,
    });
    expect(res.outcome).toBe('no_email');
    expect(runRule).not.toHaveBeenCalled();
  });

  it('chua cau hinh Resend -> not_configured, khong goi rule', async () => {
    const runRule = sentRule();
    const res = await notifyEnrollmentGranted({} as unknown as Env, order, [courseItem('c1')], {
      runRuleFn: runRule,
      getCourseMetaFn: metaFn,
      getProfileEmailFn: profileFn,
      getProfileNameFn: nameFn,
      createDepsFn,
    });
    expect(res.outcome).toBe('not_configured');
    expect(runRule).not.toHaveBeenCalled();
  });

  it('rule throw -> failed, ham KHONG throw', async () => {
    const runRule = vi.fn(async () => {
      throw new Error('resend down');
    }) as unknown as typeof runPaymentVerifiedAccess;
    const res = await notifyEnrollmentGranted(envWithResend, order, [courseItem('c1')], {
      runRuleFn: runRule,
      getCourseMetaFn: metaFn,
      getProfileEmailFn: profileFn,
      getProfileNameFn: nameFn,
      createDepsFn,
    });
    expect(res).toEqual({ courses: 1, sent: 0, skipped: 0, failed: 1, outcome: 'failed' });
  });

  it('don khong co khoa -> no_course', async () => {
    const runRule = sentRule();
    const res = await notifyEnrollmentGranted(envWithResend, order, [], {
      runRuleFn: runRule,
      getCourseMetaFn: metaFn,
      getProfileEmailFn: profileFn,
      getProfileNameFn: nameFn,
      createDepsFn,
    });
    expect(res.outcome).toBe('no_course');
    expect(runRule).not.toHaveBeenCalled();
  });

  it('don khong co user -> no_user', async () => {
    const runRule = sentRule();
    const noUser = { ...order, user_id: null } as unknown as OrderRow;
    const res = await notifyEnrollmentGranted(envWithResend, noUser, [courseItem('c1')], {
      runRuleFn: runRule,
      getCourseMetaFn: metaFn,
      getProfileEmailFn: profileFn,
      getProfileNameFn: nameFn,
      createDepsFn,
    });
    expect(res.outcome).toBe('no_user');
    expect(runRule).not.toHaveBeenCalled();
  });
});
