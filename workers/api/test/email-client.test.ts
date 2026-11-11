// Unit test sendEmail — fetch duoc mock, KHONG gui email that,
// KHONG goi Resend that, KHONG dung API key that.
import { describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../src/email/client';
import type { EmailSenderConfig, SendEmailInput } from '../src/email/types';

const CONFIG: EmailSenderConfig = {
  apiKey: 're_test_key_khong-phai-key-that',
  from: 'Visfar Academy <hello@visfaracademy.vn>',
};

const INPUT: SendEmailInput = {
  to: 'lan@example.vn',
  template: 'E1',
  data: { studentName: 'Nguyễn Thị Lan' },
  idempotencyKey: '11111111-2222-3333-4444-555555555555',
  relatedType: 'lead',
  relatedId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
};

function mockFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('sendEmail — thanh cong', () => {
  it('gui E1 thanh cong, tra resendId + logRow sent khop bang email_logs', async () => {
    const fetchImpl = mockFetch(200, { id: 're_123456789' });
    const r = await sendEmail({ ...CONFIG, fetchImpl }, INPUT);
    expect(r.ok).toBe(true);
    expect(r.resendId).toBe('re_123456789');
    expect(r.logRow).toEqual({
      to_email: 'lan@example.vn',
      template: 'E1',
      resend_id: 're_123456789',
      status: 'sent',
      related_type: 'lead',
      related_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      error_message: null,
    });

    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_key_khong-phai-key-that');
    expect(headers['Idempotency-Key']).toBe('11111111-2222-3333-4444-555555555555');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.from).toBe('Visfar Academy <hello@visfaracademy.vn>');
    expect(body.to).toEqual(['lan@example.vn']);
    expect(body.subject).toBe('Đăng ký thành công — chào mừng bạn đến với Visfar Academy');
    expect(body.html as string).toContain('Nguyễn Thị Lan');
    expect(body.text as string).toContain('Nguyễn Thị Lan');
  });

  it('khong co idempotencyKey thi khong gui header Idempotency-Key', async () => {
    const fetchImpl = mockFetch(200, { id: 're_abc' });
    const { idempotencyKey: _ignored, ...noKey } = INPUT;
    await sendEmail({ ...CONFIG, fetchImpl }, noKey);
    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const headers = (calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('sendEmail — validation (khong goi fetch)', () => {
  it('email nguoi nhan sai thi loi invalid_recipient, khong goi Resend', async () => {
    const fetchImpl = mockFetch(200, { id: 're_x' });
    const r = await sendEmail({ ...CONFIG, fetchImpl }, { ...INPUT, to: 'khong-phai-email' });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('invalid_recipient');
    expect(r.logRow.status).toBe('failed');
    expect(r.logRow.resend_id).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('email TLD 1 ky tu thi loi (dong bo validation server)', async () => {
    const fetchImpl = mockFetch(200, { id: 're_x' });
    const r = await sendEmail({ ...CONFIG, fetchImpl }, { ...INPUT, to: 'a@b.c' });
    expect(r.errorCode).toBe('invalid_recipient');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('thieu truong bat buoc cua mau thi loi invalid_template_data, khong goi Resend', async () => {
    const fetchImpl = mockFetch(200, { id: 're_x' });
    const r = await sendEmail(
      { ...CONFIG, fetchImpl },
      { to: 'lan@example.vn', template: 'E2', data: { studentName: 'Nguyễn Thị Lan' } as never },
    );
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('invalid_template_data');
    expect(r.message).toContain('verificationUrl');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('thieu RESEND_API_KEY thi loi email_not_configured, khong goi Resend', async () => {
    const fetchImpl = mockFetch(200, { id: 're_x' });
    const r = await sendEmail({ apiKey: '', from: CONFIG.from, fetchImpl }, INPUT);
    expect(r.errorCode).toBe('email_not_configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('thieu RESEND_FROM_EMAIL thi loi email_not_configured', async () => {
    const fetchImpl = mockFetch(200, { id: 're_x' });
    const r = await sendEmail({ apiKey: CONFIG.apiKey, from: '  ', fetchImpl }, INPUT);
    expect(r.errorCode).toBe('email_not_configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('from la onboarding@resend.dev thi tu choi (khong gui cho nguoi dung that)', async () => {
    const fetchImpl = mockFetch(200, { id: 're_x' });
    const r = await sendEmail({ apiKey: CONFIG.apiKey, from: 'onboarding@resend.dev', fetchImpl }, INPUT);
    expect(r.errorCode).toBe('email_not_configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('sendEmail — loi tu Resend', () => {
  it('429 daily_quota_exceeded thi ma loi dung + log failed', async () => {
    const fetchImpl = mockFetch(429, { name: 'rate_limit_exceeded', message: 'daily_quota_exceeded' });
    const r = await sendEmail({ ...CONFIG, fetchImpl }, INPUT);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('daily_quota_exceeded');
    expect(r.logRow.status).toBe('failed');
    expect(r.logRow.error_message).toContain('daily_quota_exceeded');
  });

  it('400 tu Resend thi resend_error, khong nham sang quota', async () => {
    const fetchImpl = mockFetch(400, { name: 'validation_error', message: 'Invalid `to` field' });
    const r = await sendEmail({ ...CONFIG, fetchImpl }, INPUT);
    expect(r.errorCode).toBe('resend_error');
    expect(r.message).toContain('Invalid `to` field');
  });

  it('fetch loi mang thi email_upstream_error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    const r = await sendEmail({ ...CONFIG, fetchImpl }, INPUT);
    expect(r.errorCode).toBe('email_upstream_error');
    expect(r.logRow.status).toBe('failed');
  });
});
