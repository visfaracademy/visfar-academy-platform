// 13 mau email tieng Viet E1–E13 — chi render (khong gui, khong goi Resend).
// Phong cach Visfar: tu nhien, it emoji, khong thuc ep / FOMO manh.
// Footer: moi mau deu co dia chi lien he visfaracademy@gmail.com;
// nut huy nhan tin CHI co o mau cham soc E7–E13 (khong co o mau giao
// dich E1–E6, vi nguoi nhan can nhan email giao dich cua chinh minh).
import type {
  E1Data,
  E2Data,
  E3Data,
  E4Data,
  E5Data,
  E6Data,
  E7Data,
  E8Data,
  E9Data,
  E10Data,
  E11Data,
  E12Data,
  E13Data,
  RenderedEmail,
  TemplateData,
  TemplateId,
} from './types';
import { TEMPLATE_META, APP_URL_PLACEHOLDER } from './types';

export const CONTACT_EMAIL = 'visfaracademy@gmail.com';
export const BRAND_NAME = 'Visfar Academy';
export const BRAND_TAGLINE = 'Hiểu mình, sáng trí, dựng hiệu.';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Dinh dang tien VND: 1.999.000 ₫ (integer, khong dung float). */
export function formatVnd(amountVnd: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amountVnd)} ₫`;
}

/** Hien thi ngay gio theo gio Viet Nam; neu khong parse duoc thi tra ve
 *  chuoi goc (khong tu bia ngay). */
export function formatDateVi(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function requireField(template: TemplateId, field: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[email:${template}] thieu truong bat buoc: ${field}`);
  }
}

function requireNumber(template: TemplateId, field: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[email:${template}] thieu truong bat buoc: ${field}`);
  }
}

function resolveAppUrl(data: { appUrl?: string }): string {
  return data.appUrl?.trim() ? data.appUrl.trim().replace(/\/+$/, '') : APP_URL_PLACEHOLDER;
}

function unsubscribeUrlFor(data: { appUrl?: string; unsubscribeUrl?: string }, toEmail: string): string {
  if (data.unsubscribeUrl?.trim()) return data.unsubscribeUrl.trim();
  return `${resolveAppUrl(data)}/api/v1/newsletter/unsubscribe?email=${encodeURIComponent(toEmail)}`;
}

function layoutHtml(opts: {
  title: string;
  body: string;
  hasUnsubscribe: boolean;
  unsubscribeUrl?: string;
}): string {
  const { title, body, hasUnsubscribe, unsubscribeUrl } = opts;
  const unsubscribeBlock = hasUnsubscribe
    ? `<p style="margin:12px 0 0;font-size:13px;color:#6b6552;">Bạn nhận email này vì đã đăng ký nhận tin từ ${BRAND_NAME}. Nếu không muốn nhận nữa, bạn có thể <a href="${escapeHtml(unsubscribeUrl ?? '')}" style="color:#a8841c;">hủy đăng ký tại đây</a>.</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f8f1d7;font-family:'Be Vietnam Pro',Arial,sans-serif;color:#16130c;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background-color:#fdfbf3;border:1px solid #e3d9b8;border-radius:12px;padding:32px 28px;">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;color:#a8841c;font-weight:700;">VISFAR ACADEMY</p>
<p style="margin:0 0 24px;font-size:13px;color:#6b6552;">${BRAND_TAGLINE}</p>
${body}
</div>
<div style="padding:20px 8px 0;font-size:13px;color:#6b6552;line-height:1.6;">
<p style="margin:0;">Cần hỗ trợ? Liên hệ ${BRAND_NAME} qua email <a href="mailto:${CONTACT_EMAIL}" style="color:#a8841c;">${CONTACT_EMAIL}</a>.</p>
${unsubscribeBlock}
<p style="margin:12px 0 0;">© 2026 ${BRAND_NAME}</p>
</div>
</div>
</body>
</html>`;
}

function buttonHtml(url: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background-color:#a8841c;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;">${escapeHtml(label)}</a></p>`;
}

function greetingHtml(studentName: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Chào ${escapeHtml(studentName)},</p>`;
}

function paraHtml(text: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;">${escapeHtml(text)}</p>`;
}

function textFooter(hasUnsubscribe: boolean, unsubscribeUrl?: string): string {
  const base = `\n\n--\n${BRAND_NAME} — ${BRAND_TAGLINE}\nCần hỗ trợ? Liên hệ: ${CONTACT_EMAIL}`;
  if (!hasUnsubscribe) return base;
  return `${base}\nBạn nhận email này vì đã đăng ký nhận tin từ ${BRAND_NAME}. Hủy đăng ký: ${unsubscribeUrl ?? ''}`;
}

type Renderer = (data: TemplateData, appUrl: string) => RenderedEmail;

const renderers: Record<TemplateId, Renderer> = {
  E1: (data) => {
    const d = data as E1Data;
    const dashboardUrl = d.dashboardUrl?.trim() || `${resolveAppUrl(d)}/hoc-vien`;
    const subject = 'Đăng ký thành công — chào mừng bạn đến với Visfar Academy';
    const body =
      greetingHtml(d.studentName) +
      paraHtml('Cảm ơn bạn đã đăng ký tài khoản tại Visfar Academy. Tài khoản của bạn đã được tạo, bạn có thể đăng nhập và xem các khóa học của mình bất cứ lúc nào.') +
      buttonHtml(dashboardUrl, 'Vào khu vực học viên');
    return {
      template: 'E1',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: false }),
      text: `Chào ${d.studentName},\n\nCảm ơn bạn đã đăng ký tài khoản tại Visfar Academy. Tài khoản của bạn đã được tạo, bạn có thể đăng nhập và xem các khóa học của mình bất cứ lúc nào.\n\nVào khu vực học viên: ${dashboardUrl}${textFooter(false)}`,
    };
  },

  E2: (data) => {
    const d = data as E2Data;
    const hours = d.expiresHours ?? 24;
    const subject = 'Xác minh địa chỉ email của bạn — Visfar Academy';
    const body =
      greetingHtml(d.studentName) +
      paraHtml('Để hoàn tất việc đăng ký, bạn vui lòng xác minh địa chỉ email này bằng cách bấm vào nút bên dưới.') +
      buttonHtml(d.verificationUrl, 'Xác minh email') +
      paraHtml(`Liên kết này có hiệu lực trong ${hours} giờ. Nếu bạn không đăng ký tài khoản tại Visfar Academy, bạn có thể bỏ qua email này.`);
    return {
      template: 'E2',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: false }),
      text: `Chào ${d.studentName},\n\nĐể hoàn tất việc đăng ký, bạn vui lòng xác minh địa chỉ email này bằng cách mở liên kết sau:\n${d.verificationUrl}\n\nLiên kết này có hiệu lực trong ${hours} giờ. Nếu bạn không đăng ký tài khoản tại Visfar Academy, bạn có thể bỏ qua email này.${textFooter(false)}`,
    };
  },

  E3: (data) => {
    const d = data as E3Data;
    const minutes = d.expiresMinutes ?? 60;
    const subject = 'Đặt lại mật khẩu — Visfar Academy';
    const body =
      greetingHtml(d.studentName) +
      paraHtml('Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Visfar Academy. Bấm vào nút bên dưới để tạo mật khẩu mới.') +
      buttonHtml(d.resetUrl, 'Đặt lại mật khẩu') +
      paraHtml(`Liên kết này có hiệu lực trong ${minutes} phút và chỉ dùng được một lần. Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này — mật khẩu hiện tại của bạn vẫn giữ nguyên.`);
    return {
      template: 'E3',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: false }),
      text: `Chào ${d.studentName},\n\nBạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Visfar Academy. Mở liên kết sau để tạo mật khẩu mới:\n${d.resetUrl}\n\nLiên kết này có hiệu lực trong ${minutes} phút và chỉ dùng được một lần. Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này — mật khẩu hiện tại của bạn vẫn giữ nguyên.${textFooter(false)}`,
    };
  },

  E4: (data) => {
    const d = data as E4Data;
    const subject = `Đã nhận thanh toán — ${d.courseTitle} (${d.orderReference})`;
    const paidLine = d.paidAt ? `<p style="margin:0 0 8px;font-size:16px;line-height:1.7;">Thời gian nhận: ${escapeHtml(formatDateVi(d.paidAt))}.</p>` : '';
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Visfar Academy đã nhận được thanh toán của bạn cho khóa học “${d.courseTitle}”.`) +
      `<div style="background-color:#f8f1d7;border-radius:8px;padding:16px 20px;margin:0 0 16px;font-size:16px;line-height:1.7;">
<p style="margin:0 0 8px;">Mã đơn: <strong>${escapeHtml(d.orderReference)}</strong></p>
<p style="margin:0 0 8px;">Khóa học: <strong>${escapeHtml(d.courseTitle)}</strong></p>
<p style="margin:0;">Số tiền: <strong>${escapeHtml(formatVnd(d.amountVnd))}</strong></p>
</div>` +
      paidLine +
      paraHtml('Quyền học của bạn sẽ được kích hoạt ngay sau email này. Nếu có điều gì chưa khớp, bạn vui lòng phản hồi lại email này để chúng tôi đối soát.');
    return {
      template: 'E4',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: false }),
      text: `Chào ${d.studentName},\n\nVisfar Academy đã nhận được thanh toán của bạn cho khóa học “${d.courseTitle}”.\n\nMã đơn: ${d.orderReference}\nKhóa học: ${d.courseTitle}\nSố tiền: ${formatVnd(d.amountVnd)}${d.paidAt ? `\nThời gian nhận: ${formatDateVi(d.paidAt)}` : ''}\n\nQuyền học của bạn sẽ được kích hoạt ngay sau email này. Nếu có điều gì chưa khớp, bạn vui lòng phản hồi lại email này để chúng tôi đối soát.${textFooter(false)}`,
    };
  },

  E5: (data) => {
    const d = data as E5Data;
    const subject = `Bạn đã có quyền học khóa “${d.courseTitle}”`;
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Quyền học khóa “${d.courseTitle}” đã được mở cho tài khoản của bạn. Bạn có thể bắt đầu học ngay bây giờ.`) +
      buttonHtml(d.courseUrl, 'Vào học ngay');
    return {
      template: 'E5',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: false }),
      text: `Chào ${d.studentName},\n\nQuyền học khóa “${d.courseTitle}” đã được mở cho tài khoản của bạn. Bạn có thể bắt đầu học ngay bây giờ.\n\nVào học: ${d.courseUrl}${textFooter(false)}`,
    };
  },

  E6: (data) => {
    const d = data as E6Data;
    const subject = `Chứng chỉ của bạn đã sẵn sàng — ${d.courseTitle}`;
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Chúc mừng bạn đã hoàn thành khóa học “${d.courseTitle}”. Chứng chỉ của bạn đã được cấp và sẵn sàng để xem hoặc tải về.`) +
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Mã chứng chỉ: <strong>${escapeHtml(d.certificateCode)}</strong></p>` +
      buttonHtml(d.certificateUrl, 'Xem chứng chỉ');
    return {
      template: 'E6',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: false }),
      text: `Chào ${d.studentName},\n\nChúc mừng bạn đã hoàn thành khóa học “${d.courseTitle}”. Chứng chỉ của bạn đã được cấp và sẵn sàng để xem hoặc tải về.\n\nMã chứng chỉ: ${d.certificateCode}\nXem chứng chỉ: ${d.certificateUrl}${textFooter(false)}`,
    };
  },

  E7: (data, appUrl) => {
    const d = data as E7Data;
    const dashboardUrl = d.dashboardUrl?.trim() || `${appUrl}/hoc-vien`;
    const subject = 'Chào mừng bạn đến với Visfar Academy';
    const body =
      greetingHtml(d.studentName) +
      paraHtml('Chào mừng bạn đến với Visfar Academy — nơi cùng nhau khai mở tâm thức, tu dưỡng đạo đức, phát triển trí tuệ và hoàn thiện con người.') +
      paraHtml('Bạn có thể bắt đầu bằng cách xem các khóa học, chọn một chương trình phù hợp với mình và học theo nhịp của riêng bạn.') +
      buttonHtml(dashboardUrl, 'Xem các khóa học');
    return {
      template: 'E7',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: true, unsubscribeUrl: unsubscribeUrlFor(d, '') }),
      text: `Chào ${d.studentName},\n\nChào mừng bạn đến với Visfar Academy — nơi cùng nhau khai mở tâm thức, tu dưỡng đạo đức, phát triển trí tuệ và hoàn thiện con người.\n\nBạn có thể bắt đầu bằng cách xem các khóa học, chọn một chương trình phù hợp với mình và học theo nhịp của riêng bạn.\n\nXem các khóa học: ${dashboardUrl}${textFooter(true, unsubscribeUrlFor(d, ''))}`,
    };
  },

  E8: (data) => {
    const d = data as E8Data;
    const subject = `Bắt đầu học “${d.courseTitle}” như thế nào?`;
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Bạn đã có quyền học khóa “${d.courseTitle}”. Dưới đây là vài bước đơn giản để bắt đầu:`) +
      `<ol style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.9;">
<li>Mở bài học đầu tiên: <strong>${escapeHtml(d.firstLessonTitle)}</strong>.</li>
<li>Học theo thứ tự từng bài, mỗi ngày một ít là đủ.</li>
<li>Khi xong một bài, đánh dấu “Đã hoàn thành” để lưu tiến độ.</li>
</ol>` +
      buttonHtml(d.firstLessonUrl, 'Học bài đầu tiên');
    return {
      template: 'E8',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: true, unsubscribeUrl: unsubscribeUrlFor(d, '') }),
      text: `Chào ${d.studentName},\n\nBạn đã có quyền học khóa “${d.courseTitle}”. Vài bước đơn giản để bắt đầu:\n\n1. Mở bài học đầu tiên: ${d.firstLessonTitle}.\n2. Học theo thứ tự từng bài, mỗi ngày một ít là đủ.\n3. Khi xong một bài, đánh dấu “Đã hoàn thành” để lưu tiến độ.\n\nHọc bài đầu tiên: ${d.firstLessonUrl}${textFooter(true, unsubscribeUrlFor(d, ''))}`,
    };
  },

  E9: (data) => {
    const d = data as E9Data;
    const subject = `Đã ${d.daysInactive} ngày rồi — tiếp tục khóa “${d.courseTitle}” nhé`;
    const lastLesson = d.lastLessonTitle ? ` Bài gần nhất của bạn là “${d.lastLessonTitle}”.` : '';
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Đã ${d.daysInactive} ngày bạn chưa quay lại khóa “${d.courseTitle}”.${lastLesson} Khi nào rảnh, bạn có thể tiếp tục từ chỗ đã dừng — tiến độ của bạn vẫn được lưu nguyên.`) +
      buttonHtml(d.resumeUrl, 'Tiếp tục học');
    return {
      template: 'E9',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: true, unsubscribeUrl: unsubscribeUrlFor(d, '') }),
      text: `Chào ${d.studentName},\n\nĐã ${d.daysInactive} ngày bạn chưa quay lại khóa “${d.courseTitle}”.${lastLesson} Khi nào rảnh, bạn có thể tiếp tục từ chỗ đã dừng — tiến độ của bạn vẫn được lưu nguyên.\n\nTiếp tục học: ${d.resumeUrl}${textFooter(true, unsubscribeUrlFor(d, ''))}`,
    };
  },

  E10: (data) => {
    const d = data as E10Data;
    const subject = `Bài “${d.lessonTitle}” đang dở — hoàn thành nốt nhé`;
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Bài “${d.lessonTitle}” trong khóa “${d.courseTitle}” của bạn mới hoàn thành ${d.progressPercent}%. Bạn có thể mở lại bài và hoàn thành nốt phần còn lại khi rảnh.`) +
      buttonHtml(d.resumeUrl, 'Mở lại bài học');
    return {
      template: 'E10',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: true, unsubscribeUrl: unsubscribeUrlFor(d, '') }),
      text: `Chào ${d.studentName},\n\nBài “${d.lessonTitle}” trong khóa “${d.courseTitle}” của bạn mới hoàn thành ${d.progressPercent}%. Bạn có thể mở lại bài và hoàn thành nốt phần còn lại khi rảnh.\n\nMở lại bài học: ${d.resumeUrl}${textFooter(true, unsubscribeUrlFor(d, ''))}`,
    };
  },

  E11: (data) => {
    const d = data as E11Data;
    const subject = `Chúc mừng bạn đã hoàn thành khóa “${d.courseTitle}”`;
    const certLine = d.certificateUrl
      ? buttonHtml(d.certificateUrl, 'Xem chứng chỉ')
      : '';
    const nextLine =
      d.nextCourseTitle && d.nextCourseUrl
        ? paraHtml(`Nếu muốn học tiếp, bạn có thể xem khóa “${d.nextCourseTitle}”.`)
        : '';
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Bạn đã hoàn thành toàn bộ khóa “${d.courseTitle}”. Cảm ơn bạn đã dành thời gian học tập nghiêm túc cùng Visfar Academy — mong những gì bạn học được sẽ hữu ích trong hành trình của mình.`) +
      certLine +
      nextLine;
    return {
      template: 'E11',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: true, unsubscribeUrl: unsubscribeUrlFor(d, '') }),
      text: `Chào ${d.studentName},\n\nBạn đã hoàn thành toàn bộ khóa “${d.courseTitle}”. Cảm ơn bạn đã dành thời gian học tập nghiêm túc cùng Visfar Academy — mong những gì bạn học được sẽ hữu ích trong hành trình của mình.${d.certificateUrl ? `\n\nXem chứng chỉ: ${d.certificateUrl}` : ''}${d.nextCourseTitle && d.nextCourseUrl ? `\n\nNếu muốn học tiếp, bạn có thể xem khóa “${d.nextCourseTitle}”: ${d.nextCourseUrl}` : ''}${textFooter(true, unsubscribeUrlFor(d, ''))}`,
    };
  },

  E12: (data) => {
    const d = data as E12Data;
    const summary = d.courseSummary
      ? paraHtml(d.courseSummary)
      : '';
    const priceLine =
      d.priceVnd !== undefined
        ? paraHtml(d.priceVnd === 0 ? 'Học phí: Miễn phí / Tùy tâm.' : `Học phí: ${formatVnd(d.priceVnd)}.`)
        : '';
    const subject = `Khóa học mới: ${d.courseTitle}`;
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Visfar Academy vừa mở khóa học mới: “${d.courseTitle}”.`) +
      summary +
      priceLine +
      buttonHtml(d.courseUrl, 'Xem khóa học');
    return {
      template: 'E12',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: true, unsubscribeUrl: unsubscribeUrlFor(d, '') }),
      text: `Chào ${d.studentName},\n\nVisfar Academy vừa mở khóa học mới: “${d.courseTitle}”.${d.courseSummary ? `\n\n${d.courseSummary}` : ''}${d.priceVnd !== undefined ? `\n\n${d.priceVnd === 0 ? 'Học phí: Miễn phí / Tùy tâm.' : `Học phí: ${formatVnd(d.priceVnd)}.`}` : ''}\n\nXem khóa học: ${d.courseUrl}${textFooter(true, unsubscribeUrlFor(d, ''))}`,
    };
  },

  E13: (data) => {
    const d = data as E13Data;
    const amountLine =
      d.amountVnd !== undefined
        ? paraHtml(`Phí gia hạn: ${formatVnd(d.amountVnd)}.`)
        : '';
    const subject = `Gói ${d.planName} sắp hết hạn — gia hạn để tiếp tục`;
    const body =
      greetingHtml(d.studentName) +
      paraHtml(`Gói thành viên ${d.planName} của bạn sẽ hết hạn vào ${formatDateVi(d.renewByDate)}. Gia hạn trước ngày này để việc học và quyền lợi thành viên của bạn không bị gián đoạn.`) +
      amountLine +
      buttonHtml(d.renewUrl, 'Gia hạn ngay');
    return {
      template: 'E13',
      subject,
      html: layoutHtml({ title: subject, body, hasUnsubscribe: true, unsubscribeUrl: unsubscribeUrlFor(d, '') }),
      text: `Chào ${d.studentName},\n\nGói thành viên ${d.planName} của bạn sẽ hết hạn vào ${formatDateVi(d.renewByDate)}. Gia hạn trước ngày này để việc học và quyền lợi thành viên của bạn không bị gián đoạn.${d.amountVnd !== undefined ? `\n\nPhí gia hạn: ${formatVnd(d.amountVnd)}.` : ''}\n\nGia hạn ngay: ${d.renewUrl}${textFooter(true, unsubscribeUrlFor(d, ''))}`,
    };
  },
};

/** Truong bat buoc cua tung mau (ngoai studentName chung). */
const REQUIRED_FIELDS: Record<TemplateId, string[]> = {
  E1: [],
  E2: ['verificationUrl'],
  E3: ['resetUrl'],
  E4: ['courseTitle', 'orderReference', 'amountVnd'],
  E5: ['courseTitle', 'courseUrl'],
  E6: ['courseTitle', 'certificateCode', 'certificateUrl'],
  E7: [],
  E8: ['courseTitle', 'firstLessonTitle', 'firstLessonUrl'],
  E9: ['courseTitle', 'resumeUrl', 'daysInactive'],
  E10: ['courseTitle', 'lessonTitle', 'resumeUrl', 'progressPercent'],
  E11: ['courseTitle'],
  E12: ['courseTitle', 'courseUrl'],
  E13: ['planName', 'renewByDate', 'renewUrl'],
};

/**
 * Render 1 mau. Nem Error neu thieu truong bat buoc (goi client chuyen
 * thanh `invalid_template_data`, khong gui email nua chung).
 * `toEmail` chi dung de xay link huy nhan tin mac dinh (E7–E13).
 */
export function renderTemplate(
  template: TemplateId,
  data: TemplateData,
  toEmail = '',
): RenderedEmail {
  if (!TEMPLATE_META[template]) {
    throw new Error(`[email] mau khong ton tai: ${String(template)}`);
  }
  requireField(template, 'studentName', data.studentName);
  for (const field of REQUIRED_FIELDS[template]) {
    const value = (data as unknown as Record<string, unknown>)[field];
    if (field === 'amountVnd' || field === 'daysInactive' || field === 'progressPercent') {
      requireNumber(template, field, value);
    } else {
      requireField(template, field, value);
    }
  }
  if (template === 'E10') {
    const pct = (data as E10Data).progressPercent;
    if (pct < 0 || pct > 100) {
      throw new Error('[email:E10] progressPercent phai trong khoang 0–100');
    }
  }
  if (template === 'E4' || template === 'E12' || template === 'E13') {
    const amount = (data as { amountVnd?: number }).amountVnd;
    if (amount !== undefined && amount < 0) {
      throw new Error(`[email:${template}] amountVnd khong duoc am`);
    }
  }
  // Truyen toEmail vao unsubscribe mac dinh thong qua 1 ban sao data.
  const dataWithEmail: TemplateData =
    TEMPLATE_META[template].hasUnsubscribe && !data.unsubscribeUrl
      ? { ...data, unsubscribeUrl: unsubscribeUrlFor(data, toEmail) }
      : data;
  const rendered = renderers[template](dataWithEmail, resolveAppUrl(data));
  if (rendered.html.includes('{{') || rendered.html.includes('}}')) {
    throw new Error(`[email:${template}] mau con bien chua thay the`);
  }
  if (rendered.text.includes('{{') || rendered.text.includes('}}')) {
    throw new Error(`[email:${template}] ban text con bien chua thay the`);
  }
  return rendered;
}
