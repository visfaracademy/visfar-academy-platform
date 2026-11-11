# Email — Resend (TASK 11)

Module gửi email của Visfar Academy. **Chỉ chạy ở server (Cloudflare
Workers API)** — `RESEND_API_KEY` chỉ ở Workers Secrets / `.dev.vars`,
không bao giờ ở frontend, không commit key.

## 1. 13 mẫu E1–E13 (theo danh sách Task 11)

| Mẫu | Tên | Loại | Hủy nhận tin |
|-----|-----|------|--------------|
| E1 | Xác nhận đăng ký | Giao dịch | Không |
| E2 | Xác minh email | Giao dịch | Không |
| E3 | Đặt lại mật khẩu | Giao dịch | Không |
| E4 | Xác nhận thanh toán | Giao dịch | Không |
| E5 | Cấp quyền học | Giao dịch | Không |
| E6 | Cấp chứng chỉ | Giao dịch | Không |
| E7 | Chào mừng | Chăm sóc | Có |
| E8 | Hướng dẫn bắt đầu học | Chăm sóc | Có |
| E9 | Nhắc học | Chăm sóc | Có |
| E10 | Nhắc bài chưa hoàn thành | Chăm sóc | Có |
| E11 | Chúc mừng hoàn thành khóa học | Chăm sóc | Có |
| E12 | Khóa học mới | Chăm sóc | Có |
| E13 | Gia hạn membership | Chăm sóc | Có |

**Lưu ý đối chiếu:** danh sách này **khác** bảng automation ở
`docs/architecture/SYSTEM_ARCHITECTURE.md` §9/§10.10 (ở đó E1 là chào
mừng đăng ký tài khoản, E3 là lead đã ghi nhận, E5/E6/E7 là đơn hàng +
nhắc thanh toán…). Module này làm theo danh sách Task 11; các mẫu còn
thiếu theo bảng kiến trúc (lead đã ghi nhận, báo lead mới cho admin,
đơn hàng mới + QR, nhắc thanh toán 12h/24h, nhắc sự kiện, xác nhận đăng
ký nhận tin, xác nhận hoàn trả) **chưa có** — cần coordinator chốt
bảng mẫu thống nhất rồi bổ sung (xem §6).

Mỗi mẫu có: subject + HTML + text thuần, render bằng
`renderTemplate(template, data, toEmail)`. Mọi biến dữ liệu đều có tên
rõ ràng trong `types.ts` (`E1Data`…`E13Data`); thiếu trường bắt buộc thì
ném lỗi, không gửi email nửa chừng. Dữ liệu người dùng được escape HTML
trước khi chèn. Footer mọi mẫu đều có `visfaracademy@gmail.com`.

## 2. Cách dùng (từ route/cron của Workers API)

```ts
import { sendEmail } from './email';

const result = await sendEmail(
  { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL },
  {
    to: student.email,
    template: 'E4',
    data: {
      studentName: student.full_name,
      courseTitle: course.title,
      orderReference: order.reference_code,
      amountVnd: order.amount_vnd,
    },
    idempotencyKey: crypto.randomUUID(), // sinh 1 lan / 1 lan gui
    relatedType: 'order',
    relatedId: order.id,
  },
);
// Ghi log doi soat vao bang email_logs (RLS: chi qua Workers):
//   insert result.logRow vao email_logs
//     (to_email, template, resend_id, status, related_type,
//      related_id, error_message)
```

Module **không tự ghi DB** — caller insert `result.logRow` vào
`email_logs` (khớp `docs/database/DATABASE_SCHEMA.md` §3.27). Webhook
Resend (`POST /api/webhooks/resend`, chưa làm) sẽ cập nhật `status`
thành `delivered` / `bounced` sau.

## 3. Cấu hình (chỉ tên biến — không giá trị thật)

| Biến | Ghi ở đâu |
|------|-----------|
| `RESEND_API_KEY` | `wrangler secret put RESEND_API_KEY` / `.dev.vars` |
| `RESEND_FROM_EMAIL` | như trên, VD `Visfar Academy <hello@visfaracademy.vn>` |
| `RESEND_WEBHOOK_SECRET` | cho webhook trạng thái (chưa làm) |
| `ADMIN_NOTIFY_EMAIL` | email admin nhận cảnh báo — theo DECISIONS.md là `visfaracademy@gmail.com` |

## 4. ⚠️ Domain gửi CHƯA xác minh — không gửi cho người dùng thật

- **Chưa có domain gửi nào được xác minh.** Không bịa domain đã xác
  minh: DNS SPF/DKIM/DMARC của domain gửi **chưa được xác minh**, và
  `RESEND_FROM_EMAIL` chưa được chốt giá trị thật (chỉ có dạng ví dụ
  `…@visfaracademy.vn` trong `INTEGRATION_PLAN.md` §4).
- **Không gửi từ `onboarding@resend.dev`** cho người dùng thật — địa
  chỉ đó chỉ gửi được tới email của tài khoản Resend. `sendEmail` từ
  chối `from` này bằng lỗi `email_not_configured`.
- Trước khi gửi thật cần: (1) chốt domain gửi, (2) xác minh DNS
  SPF/DKIM/DMARC trên Resend, (3) set `RESEND_FROM_EMAIL` đúng domain
  đó, (4) gửi thử tới hộp thư của chính admin và kiểm tra vào inbox.

## 5. Giới hạn miễn phí Resend (tra cứu 10/11/2026 — xác minh lại trước khi triển khai)

- **3.000 email/tháng, tối đa 100 email/ngày** (reset 00:00 UTC).
- Email thứ 101 trong ngày → lỗi `daily_quota_exceeded`
  (`sendEmail` trả `errorCode: 'daily_quota_exceeded'`, log `failed`).
- Khi chạm giới hạn: ưu tiên email giao dịch (E1–E6) gửi lại sau
  00:00 UTC; email nhắc/chăm sóc (E7–E13) xếp hàng sang hôm sau.
  Cảnh báo gửi về `visfaracademy@gmail.com` (DECISIONS.md, Task 02
  QĐ 14). Nâng Resend Pro khi chạm giới hạn — cần phê duyệt, giá xác
  minh lại (QĐ 18).
- Link hủy nhận tin mặc định trỏ tới
  `/api/v1/newsletter/unsubscribe?email=…`. Đây là **tạm thời**: trước
  khi gửi thật cho người dùng, endpoint hủy nhận tin cần nhận link có
  chữ ký/token (để người khác không hủy hộ), và caller nên truyền
  `unsubscribeUrl` đã ký vào `data`. Hiện tại Task 05 chỉ có form
  newsletter ở footer, chưa có endpoint hủy nhận tin thật.

## 6. Chưa làm (cần làm tiếp, ngoài phạm vi Task 11)

1. **Nối route/cron thật:** chưa có route nào gọi `sendEmail`
   (đăng ký, đơn hàng, cron nhắc học…). Workers API vẫn chưa có
   `src/index.ts` / router — module này là thư viện sẵn để nối.
2. **Webhook Resend** `POST /api/webhooks/resend` (xác minh chữ ký
   bằng `RESEND_WEBHOOK_SECRET`, cập nhật `email_logs.status`).
3. **Ghi `email_logs` thật** — hiện chỉ trả `logRow`, chưa insert.
4. **Hàng đợi khi chạm quota** — hiện chỉ trả lỗi, chưa có hàng đợi
   gửi lại sau 00:00 UTC.
5. **Thống nhất bảng mẫu** với kiến trúc §9 (xem §1) + bổ sung các
   mẫu còn thiếu (lead, đơn hàng + QR, nhắc thanh toán, nhắc sự kiện,
   hoàn trả).
6. **Link trong email:** `APP_URL_PLACEHOLDER`
   (`https://visfaracademy.netlify.app`) là domain API đã chốt, dùng
   tạm làm gốc link — thay bằng domain công khai của website khi chốt.
7. **Gửi thử thật** tới admin sau khi xác minh DNS (chưa gửi email
   thật nào trong Task 11).

## 7. Kiểm thử

```bash
cd workers/api
npm test        # vitest — chi test render + client voi fetch mock
npm run typecheck
```

Không test nào gửi email thật hay gọi Resend thật.
