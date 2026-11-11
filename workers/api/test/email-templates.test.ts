// Unit test render 13 mau email — KHONG gui email that, khong goi Resend.
import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../src/email/templates';
import { TEMPLATE_IDS, TEMPLATE_META } from '../src/email/types';
import type { TemplateData, TemplateId } from '../src/email/types';

const STUDENT = 'Nguyễn Thị Lan';
const COURSE = 'Thấu Hiểu Nội Tâm';
const TO = 'lan@example.vn';
const APP_URL = 'https://visfaracademy.netlify.app';

const SAMPLES: Record<TemplateId, TemplateData> = {
  E1: { studentName: STUDENT, dashboardUrl: `${APP_URL}/hoc-vien` },
  E2: { studentName: STUDENT, verificationUrl: `${APP_URL}/xac-minh?token=abc123`, expiresHours: 24 },
  E3: { studentName: STUDENT, resetUrl: `${APP_URL}/dat-lai-mat-khau?token=xyz789`, expiresMinutes: 60 },
  E4: {
    studentName: STUDENT,
    courseTitle: COURSE,
    orderReference: 'DH-2026-000123',
    amountVnd: 1999000,
    paidAt: '2026-11-10T10:30:00+07:00',
  },
  E5: { studentName: STUDENT, courseTitle: COURSE, courseUrl: `${APP_URL}/hoc-vien/khoa-hoc/thau-hieu-noi-tam` },
  E6: {
    studentName: STUDENT,
    courseTitle: COURSE,
    certificateCode: 'VISFAR-CERT-2026-0001',
    certificateUrl: `${APP_URL}/hoc-vien/chung-chi/VISFAR-CERT-2026-0001`,
  },
  E7: { studentName: STUDENT, dashboardUrl: `${APP_URL}/hoc-vien` },
  E8: {
    studentName: STUDENT,
    courseTitle: COURSE,
    firstLessonTitle: 'Bài 1 — Nhận diện chính mình',
    firstLessonUrl: `${APP_URL}/hoc-vien/khoa-hoc/thau-hieu-noi-tam/bai/bai-1`,
  },
  E9: {
    studentName: STUDENT,
    courseTitle: COURSE,
    resumeUrl: `${APP_URL}/hoc-vien/khoa-hoc/thau-hieu-noi-tam`,
    daysInactive: 7,
    lastLessonTitle: 'Bài 2 — Lắng nghe nội tâm',
  },
  E10: {
    studentName: STUDENT,
    courseTitle: COURSE,
    lessonTitle: 'Bài 3 — Cân bằng cảm xúc',
    resumeUrl: `${APP_URL}/hoc-vien/khoa-hoc/thau-hieu-noi-tam/bai/bai-3`,
    progressPercent: 45,
  },
  E11: {
    studentName: STUDENT,
    courseTitle: COURSE,
    certificateUrl: `${APP_URL}/hoc-vien/chung-chi/VISFAR-CERT-2026-0001`,
    nextCourseTitle: 'Thấu Hiểu Trí Tuệ',
    nextCourseUrl: `${APP_URL}/chuong-trinh/thau-hieu-tri-tue`,
  },
  E12: {
    studentName: STUDENT,
    courseTitle: 'Thấu Hiểu Tài Chính',
    courseSummary: 'Hiểu dòng tiền của chính mình và xây nền tảng tài chính vững vàng.',
    courseUrl: `${APP_URL}/chuong-trinh/thau-hieu-tai-chinh`,
    priceVnd: 0,
  },
  E13: {
    studentName: STUDENT,
    planName: 'Cộng đồng Visfar',
    renewByDate: '2026-12-10T23:59:00+07:00',
    renewUrl: `${APP_URL}/hoc-vien/gia-han`,
    amountVnd: 0,
  },
};

const EXPECTED_SUBJECTS: Record<TemplateId, string> = {
  E1: 'Đăng ký thành công — chào mừng bạn đến với Visfar Academy',
  E2: 'Xác minh địa chỉ email của bạn — Visfar Academy',
  E3: 'Đặt lại mật khẩu — Visfar Academy',
  E4: 'Đã nhận thanh toán — Thấu Hiểu Nội Tâm (DH-2026-000123)',
  E5: 'Bạn đã có quyền học khóa “Thấu Hiểu Nội Tâm”',
  E6: 'Chứng chỉ của bạn đã sẵn sàng — Thấu Hiểu Nội Tâm',
  E7: 'Chào mừng bạn đến với Visfar Academy',
  E8: 'Bắt đầu học “Thấu Hiểu Nội Tâm” như thế nào?',
  E9: 'Đã 7 ngày rồi — tiếp tục khóa “Thấu Hiểu Nội Tâm” nhé',
  E10: 'Bài “Bài 3 — Cân bằng cảm xúc” đang dở — hoàn thành nốt nhé',
  E11: 'Chúc mừng bạn đã hoàn thành khóa “Thấu Hiểu Nội Tâm”',
  E12: 'Khóa học mới: Thấu Hiểu Tài Chính',
  E13: 'Gói Cộng đồng Visfar sắp hết hạn — gia hạn để tiếp tục',
};

/** Mau nao phai chua ten khoa hoc trong subject hoac body. */
const COURSE_TEMPLATES: TemplateId[] = ['E4', 'E5', 'E6', 'E8', 'E9', 'E10', 'E11', 'E12'];

describe('renderTemplate — du 13 mau E1–E13', () => {
  it('co du 13 mau', () => {
    expect(TEMPLATE_IDS).toHaveLength(13);
  });

  for (const id of TEMPLATE_IDS) {
    describe(id, () => {
      it('subject dung', () => {
        const r = renderTemplate(id, SAMPLES[id], TO);
        expect(r.template).toBe(id);
        expect(r.subject).toBe(EXPECTED_SUBJECTS[id]);
      });

      it('html + text chua ten hoc vien, khong con bien chua thay the', () => {
        const r = renderTemplate(id, SAMPLES[id], TO);
        expect(r.html).toContain(STUDENT);
        expect(r.text).toContain(STUDENT);
        for (const out of [r.html, r.text, r.subject]) {
          expect(out).not.toContain('{{');
          expect(out).not.toContain('}}');
          expect(out).not.toContain('undefined');
        }
      });

      it('footer co email lien he visfaracademy@gmail.com', () => {
        const r = renderTemplate(id, SAMPLES[id], TO);
        expect(r.html).toContain('visfaracademy@gmail.com');
        expect(r.text).toContain('visfaracademy@gmail.com');
      });

      it(TEMPLATE_META[id].hasUnsubscribe ? 'co nut huy nhan tin (mau cham soc)' : 'khong co nut huy nhan tin (mau giao dich)', () => {
        const r = renderTemplate(id, SAMPLES[id], TO);
        if (TEMPLATE_META[id].hasUnsubscribe) {
          expect(r.html).toContain('hủy đăng ký');
          expect(r.text).toContain('Hủy đăng ký');
          expect(r.html).toContain(encodeURIComponent(TO));
        } else {
          expect(r.html).not.toContain('hủy đăng ký');
          expect(r.text).not.toContain('Hủy đăng ký');
        }
      });
    });
  }

  it('cac mau khoa hoc chua ten khoa hoc', () => {
    for (const id of COURSE_TEMPLATES) {
      const courseTitle = (SAMPLES[id] as { courseTitle: string }).courseTitle;
      const r = renderTemplate(id, SAMPLES[id], TO);
      expect(r.html).toContain(courseTitle);
      expect(r.text).toContain(courseTitle);
    }
  });

  it('E4 hien ma don, so tien VND dinh dang dung', () => {
    const r = renderTemplate('E4', SAMPLES.E4, TO);
    expect(r.html).toContain('DH-2026-000123');
    expect(r.html).toContain('1.999.000 ₫');
    expect(r.text).toContain('1.999.000 ₫');
  });

  it('E6 hien ma chung chi', () => {
    const r = renderTemplate('E6', SAMPLES.E6, TO);
    expect(r.html).toContain('VISFAR-CERT-2026-0001');
    expect(r.text).toContain('VISFAR-CERT-2026-0001');
  });

  it('E10 hien % hoan thanh cua bai', () => {
    const r = renderTemplate('E10', SAMPLES.E10, TO);
    expect(r.html).toContain('45%');
    expect(r.text).toContain('45%');
  });

  it('E13 hien ngay het han theo gio Viet Nam', () => {
    const r = renderTemplate('E13', SAMPLES.E13, TO);
    expect(r.html).toContain('10/12/2026');
    expect(r.text).toContain('10/12/2026');
  });

  it('E12 gia 0 hien "Mien phi / Tuy tam"', () => {
    const r = renderTemplate('E12', SAMPLES.E12, TO);
    expect(r.html).toContain('Miễn phí / Tùy tâm');
  });
});

describe('renderTemplate — validation', () => {
  it('thieu ten hoc vien thi nem loi', () => {
    expect(() => renderTemplate('E1', { studentName: '  ' } as TemplateData, TO)).toThrow(
      'thieu truong bat buoc: studentName',
    );
  });

  it('thieu truong bat buoc cua mau thi nem loi (E2 thieu verificationUrl)', () => {
    expect(() => renderTemplate('E2', { studentName: STUDENT } as TemplateData, TO)).toThrow(
      'thieu truong bat buoc: verificationUrl',
    );
  });

  it('E4 thieu amountVnd thi nem loi', () => {
    expect(() =>
      renderTemplate(
        'E4',
        { studentName: STUDENT, courseTitle: COURSE, orderReference: 'DH-2026-000123' } as TemplateData,
        TO,
      ),
    ).toThrow('thieu truong bat buoc: amountVnd');
  });

  it('E10 progressPercent ngoai 0–100 thi nem loi', () => {
    expect(() =>
      renderTemplate(
        'E10',
        { ...(SAMPLES.E10 as object), progressPercent: 150 } as TemplateData,
        TO,
      ),
    ).toThrow('progressPercent phai trong khoang 0–100');
  });

  it('E4 amountVnd am thi nem loi', () => {
    expect(() =>
      renderTemplate('E4', { ...(SAMPLES.E4 as object), amountVnd: -1 } as TemplateData, TO),
    ).toThrow('amountVnd khong duoc am');
  });

  it('mau khong ton tai thi nem loi', () => {
    expect(() => renderTemplate('E99' as TemplateId, SAMPLES.E1, TO)).toThrow('mau khong ton tai');
  });

  it('escape HTML: ten hoc vien chua the HTML khong chen duoc the', () => {
    const r = renderTemplate('E1', { studentName: '<script>alert(1)</script>' }, TO);
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escape HTML: ten khoa hoc chua the HTML khong chen duoc the', () => {
    const r = renderTemplate(
      'E5',
      { studentName: STUDENT, courseTitle: 'Khoa <b>X</b>', courseUrl: `${APP_URL}/khoa-x` },
      TO,
    );
    expect(r.html).not.toContain('Khoa <b>X</b>');
    expect(r.html).toContain('Khoa &lt;b&gt;X&lt;/b&gt;');
  });

  it('unsubscribeUrl rieng duoc dung thay cho link mac dinh', () => {
    const signed = 'https://example.invalid/u?token=signed-token-123';
    const r = renderTemplate('E7', { studentName: STUDENT, unsubscribeUrl: signed }, TO);
    expect(r.html).toContain(signed);
    expect(r.html).not.toContain('newsletter/unsubscribe?email=');
  });
});
