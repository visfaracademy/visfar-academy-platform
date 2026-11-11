// Test Task 11: template email (ma E1–E13 chuan Workers) + dinh tuyen
// su kien + ghi log. Chay local, khong can Supabase that, khong gui
// email that.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EMAIL_TEMPLATE_CODES,
  TASK11_TEMPLATE_MAP,
  isEmailTemplateCode,
  isUnsubscribeTokenFormat,
  logOnlySender,
  notifyCertificateEmail,
  notifyCourseCompletedEmail,
  notifyEnrollmentGrantedEmail,
  notifyOrderPaidEmail,
  notifyWelcomeEmail,
  queueEmailLog,
  requestEmailEvent,
  validateEmailEventInput,
  type EmailEventInput,
  type EmailSender,
} from './email';

const RECORDING_SENDER: EmailSender = {
  send: async (input: EmailEventInput) => ({
    ok: true,
    providerMessageId: `re_test_${input.template}`,
  }),
};

describe('EMAIL_TEMPLATE_CODES — 13 mau E1–E13 chuan Workers', () => {
  it('du 13 ma, dung ten + loai theo TEMPLATE_META', () => {
    const ids = Object.keys(EMAIL_TEMPLATE_CODES);
    expect(ids).toHaveLength(13);
    expect(EMAIL_TEMPLATE_CODES.E1.name).toBe('Xác nhận đăng ký');
    expect(EMAIL_TEMPLATE_CODES.E6.name).toBe('Cấp chứng chỉ');
    expect(EMAIL_TEMPLATE_CODES.E7.name).toBe('Chào mừng');
    expect(EMAIL_TEMPLATE_CODES.E11.name).toBe('Chúc mừng hoàn thành khóa học');
    for (const [id, t] of Object.entries(EMAIL_TEMPLATE_CODES)) {
      expect(['transactional', 'care']).toContain(t.category);
      expect(typeof t.hasUnsubscribe).toBe('boolean');
      expect(t.name.length, id).toBeGreaterThan(0);
    }
    // Transactional (E1–E6) khong co nut huy; care (E7–E13) co.
    for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']) {
      expect(EMAIL_TEMPLATE_CODES[id as keyof typeof EMAIL_TEMPLATE_CODES].hasUnsubscribe).toBe(false);
    }
    for (const id of ['E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13']) {
      expect(EMAIL_TEMPLATE_CODES[id as keyof typeof EMAIL_TEMPLATE_CODES].hasUnsubscribe).toBe(true);
    }
  });
  it('anh xa 4 diem Task 11 dung ma E (theo RULE_TEMPLATES)', () => {
    expect(TASK11_TEMPLATE_MAP).toEqual({
      welcome: 'E7',
      orderPaid: 'E4',
      enrollmentGranted: 'E5',
      courseCompleted: 'E11',
      certificateIssued: 'E6',
    });
  });
  it('isEmailTemplateCode nhan dung / tu choi sai', () => {
    expect(isEmailTemplateCode('E7')).toBe(true);
    expect(isEmailTemplateCode('E11')).toBe(true);
    expect(isEmailTemplateCode('welcome')).toBe(false);
    expect(isEmailTemplateCode('E14')).toBe(false);
    expect(isEmailTemplateCode(undefined)).toBe(false);
  });
});

describe('validateEmailEventInput', () => {
  it('email sai dinh dang -> loi', () => {
    expect(validateEmailEventInput({ template: 'E7', toEmail: 'a@b.c' })).toBeTruthy();
    expect(validateEmailEventInput({ template: 'E7', toEmail: '' })).toBeTruthy();
  });
  it('template la -> loi', () => {
    expect(
      validateEmailEventInput({
        template: 'welcome' as never,
        toEmail: 'a@example.com',
      }),
    ).toBeTruthy();
  });
  it('hop le -> null', () => {
    expect(
      validateEmailEventInput({
        template: 'E7',
        toEmail: 'a@example.com',
        userId: 'u1',
        relatedType: 'profile',
        relatedId: 'u1',
      }),
    ).toBeNull();
  });
});

describe('requestEmailEvent — khong bao gio throw', () => {
  it('sender mac dinh (log-only) -> queued, khong gui that', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = await requestEmailEvent({ template: 'E7', toEmail: 'a@example.com' });
      expect(res.status).toBe('queued');
      expect(res.template).toBe('E7');
      // Log chi co template + related, khong co dia chi email.
      expect(warn).toHaveBeenCalled();
      expect(String(warn.mock.calls[0]?.[0] ?? '')).not.toContain('a@example.com');
    } finally {
      warn.mockRestore();
    }
  });
  it('sender nem loi -> failed, khong throw ra ngoai', async () => {
    const throwing: EmailSender = {
      send: async () => {
        throw new Error('Resend 429');
      },
    };
    const res = await requestEmailEvent(
      { template: 'E7', toEmail: 'a@example.com' },
      { sender: throwing },
    );
    expect(res.status).toBe('failed');
    expect(res.error).toContain('429');
  });
  it('sender tra ok:false -> failed', async () => {
    const res = await requestEmailEvent(
      { template: 'E7', toEmail: 'a@example.com' },
      { sender: { send: async () => ({ ok: false, error: 'daily_quota_exceeded' }) } },
    );
    expect(res.status).toBe('failed');
    expect(res.error).toBe('daily_quota_exceeded');
  });
  it('sender tra providerMessageId -> sent', async () => {
    const res = await requestEmailEvent(
      { template: 'E7', toEmail: 'a@example.com' },
      { sender: RECORDING_SENDER },
    );
    expect(res.status).toBe('sent');
    expect(res.providerMessageId).toBe('re_test_E7');
  });
  it('input khong hop le -> failed, sender khong duoc goi', async () => {
    const sender: EmailSender = { send: vi.fn(async () => ({ ok: true })) };
    const res = await requestEmailEvent(
      { template: 'E7', toEmail: 'email-sai' },
      { sender },
    );
    expect(res.status).toBe('failed');
    expect(sender.send).not.toHaveBeenCalled();
  });
  it('logOnlySender khong goi fetch / mang', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await logOnlySender.send({ template: 'E7', toEmail: 'a@example.com' });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('wrapper 4 diem tich hop Task 11 (+ E4)', () => {
  it('welcome -> E7, related profile', async () => {
    const seen: EmailEventInput[] = [];
    const sender: EmailSender = {
      send: async (input) => {
        seen.push(input);
        return { ok: true };
      },
    };
    const res = await notifyWelcomeEmail({ toEmail: 'a@example.com', userId: 'u1' }, { sender });
    expect(res.status).toBe('queued');
    expect(seen[0]?.template).toBe('E7');
    expect(seen[0]?.relatedType).toBe('profile');
    expect(seen[0]?.relatedId).toBe('u1');
  });
  it('order-paid -> E4, related order', async () => {
    const seen: EmailEventInput[] = [];
    const sender: EmailSender = {
      send: async (input) => {
        seen.push(input);
        return { ok: true };
      },
    };
    await notifyOrderPaidEmail(
      { toEmail: 'a@example.com', userId: 'u1', orderId: 'o1', referenceCode: 'DH-2026-000001' },
      { sender },
    );
    expect(seen[0]?.template).toBe('E4');
    expect(seen[0]?.relatedType).toBe('order');
    expect(seen[0]?.relatedId).toBe('o1');
    expect(seen[0]?.data?.reference_code).toBe('DH-2026-000001');
  });
  it('course-completed -> E11, related enrollment', async () => {
    const seen: EmailEventInput[] = [];
    const sender: EmailSender = {
      send: async (input) => {
        seen.push(input);
        return { ok: true };
      },
    };
    await notifyCourseCompletedEmail(
      { toEmail: 'a@example.com', userId: 'u1', courseId: 'c1', enrollmentId: 'e1' },
      { sender },
    );
    expect(seen[0]?.template).toBe('E11');
    expect(seen[0]?.relatedId).toBe('e1');
  });
  it('certificate-issued -> E6, related certificate + ma chung chi', async () => {
    const seen: EmailEventInput[] = [];
    const sender: EmailSender = {
      send: async (input) => {
        seen.push(input);
        return { ok: true };
      },
    };
    await notifyCertificateEmail(
      {
        toEmail: 'a@example.com', userId: 'u1', courseId: 'c1',
        certificateId: 'cert1', certificateCode: 'VISFAR-CERT-2026-000001',
      },
      { sender },
    );
    expect(seen[0]?.template).toBe('E6');
    expect(seen[0]?.relatedType).toBe('certificate');
    expect(seen[0]?.data?.certificate_code).toBe('VISFAR-CERT-2026-000001');
  });
  it('enrollment-granted -> E5, khong phai E4', async () => {
    const seen: EmailEventInput[] = [];
    const sender: EmailSender = {
      send: async (input) => {
        seen.push(input);
        return { ok: true };
      },
    };
    await notifyEnrollmentGrantedEmail(
      { toEmail: 'a@example.com', userId: 'u1', courseId: 'c1', enrollmentId: 'e1' },
      { sender },
    );
    expect(seen[0]?.template).toBe('E5');
    expect(seen[0]?.template).not.toBe('E4');
  });
});

describe('queueEmailLog — ghi email_logs qua client server', () => {
  function makeClient(opts: { failInsert?: boolean } = {}): {
    client: SupabaseClient;
    inserts: Array<Record<string, unknown>>;
  } {
    const inserts: Array<Record<string, unknown>> = [];
    const client = {
      from: () => ({
        insert: (values: Record<string, unknown>) => {
          inserts.push(values);
          return {
            select: () => ({
              single: async () =>
                opts.failInsert
                  ? { data: null, error: { message: 'new row violates row-level security policy' } }
                  : { data: { id: 'log-1' }, error: null },
            }),
          };
        },
      }),
    } as unknown as SupabaseClient;
    return { client, inserts };
  }

  it('ghi dung cot: to_email/template E7/queued + user/related', async () => {
    const { client, inserts } = makeClient();
    const res = await queueEmailLog(client, {
      template: 'E7',
      toEmail: 'a@example.com',
      userId: 'u1',
      relatedType: 'profile',
      relatedId: 'u1',
    });
    expect(res).toEqual({ logged: true, emailLogId: 'log-1' });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      to_email: 'a@example.com',
      template: 'E7',
      status: 'queued',
      user_id: 'u1',
      related_type: 'profile',
      related_id: 'u1',
    });
  });
  it('insert loi (vd. RLS chan JWT) -> logged:false, khong throw', async () => {
    const { client } = makeClient({ failInsert: true });
    const res = await queueEmailLog(client, { template: 'E7', toEmail: 'a@example.com' });
    expect(res.logged).toBe(false);
    expect(res.error).toContain('row-level security');
  });
  it('email sai -> khong insert, logged:false', async () => {
    const { client, inserts } = makeClient();
    const res = await queueEmailLog(client, { template: 'E7', toEmail: 'sai' });
    expect(res.logged).toBe(false);
    expect(inserts).toHaveLength(0);
  });
});

describe('isUnsubscribeTokenFormat — dinh dang HMAC token', () => {
  it('nhan base64url.payload + "." + base64url.sig, tu choi dang khac', () => {
    expect(isUnsubscribeTokenFormat('eyJlIjoiYUBiLmNvbSJ9.abc-DEF_123')).toBe(true);
    expect(isUnsubscribeTokenFormat('a'.repeat(64))).toBe(false);
    expect(isUnsubscribeTokenFormat('part1.part2.part3')).toBe(false);
    expect(isUnsubscribeTokenFormat('no-dot')).toBe(false);
    expect(isUnsubscribeTokenFormat('')).toBe(false);
    expect(isUnsubscribeTokenFormat(null)).toBe(false);
  });
});
