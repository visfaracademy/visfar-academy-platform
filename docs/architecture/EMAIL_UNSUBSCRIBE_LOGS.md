# Email — Unsubscribe + Email Logs + Bounce/Retry (TASK 11)

Phần này của Task 11: hủy đăng ký, nhật ký email, retry và xử lý
bounce/quota. Module template E1–E13 + `sendEmail` (client.ts) do
phần khác của Task 11 làm; phần này nối vào qua adapter
`templated.ts`. **Chỉ chạy ở server (Cloudflare Workers)** — secret
chỉ ở Workers Secrets / `.dev.vars`, không commit.

## 1. File

| File | Vai trò |
|---|---|
| `supabase/migrations/0017_email_unsubscribe_logs.sql` | **CHƯA ÁP.** Thêm cột cho `email_logs` + `newsletter_subscribers` (xem §5). |
| `workers/api/src/email/token.ts` | Token hủy đăng ký HMAC-SHA256, hết hạn được (mặc định 90 ngày). |
| `workers/api/src/email/consent.ts` | Kiểm tra quyền nhận tin (suppression-list). |
| `workers/api/src/email/retry.ts` | Retry tối đa 3 lần, backoff 1p/5p/15p, chỉ lỗi tạm thời. |
| `workers/api/src/email/svix.ts` | Xác minh chữ ký webhook Resend/Svix. |
| `workers/api/src/email/store.ts` | Truy cập Supabase: subscribers + email_logs + đếm ngày + role admin. |
| `workers/api/src/email/sender.ts` | Gửi thô qua Resend + log + retry + cảnh báo quota ≥80/ngày. |
| `workers/api/src/email/templated.ts` | Adapter: mẫu E1–E13 → consent + retry + log + link hủy có token. |
| `workers/api/src/email/unsubscribe.ts` | Route `GET/POST /api/v1/newsletter/unsubscribe`. |
| `workers/api/src/email/webhook.ts` | Route `POST /api/webhooks/resend`. |
| `workers/api/src/email/logs.ts` | Route `GET /api/admin/reports/email` (admin tra cứu log). |
| `apps/web/src/lib/unsubscribe.ts` | Helper frontend gọi API hủy đăng ký. |

## 2. Unsubscribe

- Link trong email care (E7–E13): `GET /api/v1/newsletter/unsubscribe?token=<token>`.
- Token = `base64url({e, exp}).base64url(HMAC-SHA256(payload))`, ký
  bằng `UNSUBSCRIBE_SECRET` (riêng, không dùng chung `RESEND_API_KEY`).
  Không đoán được, hết hạn được (mặc định 90 ngày, sai số đồng hồ 60s).
  Không lưu DB — xác minh bằng chữ ký.
- Route cập nhật `newsletter_subscribers`: `status='unsubscribed'`,
  `unsubscribed_at=now`, `unsubscribe_reason` (nếu có, tối đa 500 ký tự).
  Đã hủy trước → `already:true` (idempotent). Email không có trong bảng
  → vẫn trả ok (không lộ email có tồn tại hay không). Token sai/hết hạn
  → `400 invalid_token`. Rate-limit 10 req/giờ/IP.
- **Bắt buộc dùng link có token.** Fallback `?email=...` trong
  `templates.ts` (xem `email/README.md` §5) là tạm thời và phải bỏ
  trước khi gửi thật: adapter `templated.ts` tự chèn link có token vào
  `data.unsubscribeUrl` khi mẫu có `hasUnsubscribe`.

## 3. Quyền nhận tin (consent) — suppression-list

- Marketing/care: chỉ gửi khi **không bị chặn**. Bị chặn = đã hủy đăng ký,
  hard bounce, hoặc spam complaint.
- Transactional (E1–E6, cảnh báo hệ thống): luôn gửi, không có
  unsubscribe, nhưng **vẫn ghi log**.
- `newsletter_subscribers` là danh sách **chặn**, không phải danh sách
  cho phép: email chưa có dòng nào → không bị chặn (được gửi). Lý do:
  email care gửi cho học viên đã ghi danh — họ không nhất thiết có dòng
  newsletter. Marketing campaign phải tự lấy danh sách từ dòng
  `status='subscribed'`; hàm này là lớp chặn cuối trước khi gửi.

## 4. Email logs

- Mọi lần gửi đều ghi `email_logs`: `to_email`, `template`, `status`,
  `resend_id` (`provider_message_id`), `error_message`, `sent_at`,
  `attempts`, `next_retry_at`, `related_type/id`.
- Trạng thái: `queued → sent → delivered`, `bounced`, `failed`,
  `complained`, `skipped` (bị chặn vì hủy/bounce — có log nhưng không gửi).
- Tra cứu (admin): `GET /api/admin/reports/email?to_email=&template=&status=&from=&to=&page=&limit=`
  — cần JWT + role `admin`; trả `{ logs, pagination: { page, limit, hasMore } }`.

## 5. Retry

- Tối đa 3 lần (lần đầu + 2 lần thử lại), backoff 1 phút → 5 phút → 15 phút.
- Chỉ retry lỗi tạm thời: HTTP 429, 5xx, lỗi mạng/timeout.
- Không retry lỗi vĩnh viễn: 400 (địa chỉ sai), 401/403, 422…
- `daily_quota_exceeded` (vượt 100 email/ngày của Resend Free): không
  retry trong ngày — gửi lại sau 00:00 UTC.
- Mỗi lần thử thất bại cập nhật log (`attempts`, `next_retry_at`, `error_message`).

## 6. Webhook Resend + bounce

- `POST /api/webhooks/resend`, xác minh chữ ký Svix (`svix-id`,
  `svix-timestamp`, `svix-signature`, dung sai 5 phút). Sai/thiếu chữ ký
  → `401`, không xử lý, không ghi.
- Cập nhật `email_logs` theo `data.email_id`: `sent → delivered /
  bounced / complained`. Event `opened/clicked/delivery_delayed` → bỏ qua.
- Hard bounce (`data.bounce.type === 'hard'`) → dừng gửi marketing/care
  cho địa chỉ đó (`hard_bounced_at`). Soft bounce → chỉ cập nhật log.
  Spam complaint → dừng gửi marketing (`unsubscribe_reason='spam_complaint'`).
- Không tìm thấy log theo `resend_id` → vẫn trả 200 (tránh Resend gửi lại).

## 7. Cảnh báo quota

- Sau mỗi lần gửi thành công, đếm email đã gửi trong ngày (giờ Việt Nam).
  Đạt **≥80 email/ngày** → gửi 1 cảnh báo về `visfaracademy@gmail.com`
  (kênh cảnh báo theo DECISIONS.md QĐ 14; biến `ADMIN_NOTIFY_EMAIL`,
  alias cũ `ALERT_EMAIL`), **1 lần/ngày**. Cảnh báo là transactional,
  không tự kiểm quota (không đệ quy). Lỗi cảnh báo không làm hỏng lần gửi chính.

## 8. Cấu hình (chỉ tên biến — không giá trị thật)

| Biến | Ghi chú |
|---|---|
| `RESEND_API_KEY` | Key Resend (đã có ở phần template). |
| `RESEND_FROM_EMAIL` | Email gửi đi, domain đã xác minh DNS. |
| `RESEND_WEBHOOK_SECRET` | Secret webhook Resend, dạng `whsec_...`. |
| `UNSUBSCRIBE_SECRET` | **Mới (phần này).** Secret riêng ký token hủy đăng ký. |
| `ADMIN_NOTIFY_EMAIL` | Email nhận cảnh báo; mặc định `visfaracademy@gmail.com`. |

## 9. Điểm cần coordinator chốt / chưa làm được

1. **Trùng số migration 0017** (đã ghi trong `scripts/check-migrations.mjs`):
   `0017_admin_user_disable.sql` (Task 09), `0017_email_unsubscribe_logs.sql`
   (phần này), `0017_lead_interactions.sql`, cộng `0018_email_task11.sql`
   (phần automation Task 11). Cần điều phối đánh số lại trước khi áp thật.
   **Chưa áp migration nào lên DB thật.**
2. **Chồng chéo cột với `0018_email_task11.sql`** (phần automation):
   `error_message`, `sent_at`, `unsubscribed_at` có ở cả hai file (an toàn
   nhờ `IF NOT EXISTS`). **Trùng ngữ nghĩa:** `attempts` (phần này) vs
   `retry_count` (0018) — cùng đếm số lần thử gửi; cần chốt giữ 1 cột.
   **Mâu thuẫn thiết kế token:** 0018 thêm `newsletter_subscribers.unsubscribe_token`
   (token ngẫu nhiên lưu DB, không có cột hết hạn) trong khi phần này dùng
   token HMAC ký stateless có `exp` theo đúng yêu cầu Task 11
   ("token ký, không đoán được, hết hạn được"). Đề xuất: giữ token ký
   HMAC (không cần tra DB, hết hạn sẵn trong payload); cột
   `unsubscribe_token` của 0018 có thể để trống/bỏ theo quyết định chung.
3. **Chưa có router** (`workers/api/src/index.ts` chưa tồn tại): 3 route
   ở §2/§6/§4 chưa được nối vào Worker. Nối khi router có.
4. **Chưa gửi email thật lần nào** (theo yêu cầu task): toàn bộ test dùng
   mock. Trước khi gửi thật cần: xác minh DNS SPF/DKIM/DMARC của domain gửi,
   set đủ secret, gửi thử tới admin, và đối chiếu 1 payload bounce thật
   của Resend (hiện chỉ coi là hard bounce khi `data.bounce.type === 'hard'`).
5. **`index.ts` barrel chưa gộp:** `workers/api/src/email/index.ts` hiện
   chỉ export phần template/client của Task 11 (do agent khác sở hữu).
   Cần gộp thêm export của phần này (token/consent/retry/svix/store/
   sender/templated/unsubscribe/webhook/logs) — chú ý `EmailLogRow`,
   `SendEmailInput`, `SendEmailResult` của `types.ts` trùng tên với kiểu
   cũ của phần này nên phần này đã đổi tên thành `EmailLogRecord`,
   `RawEmailInput`, `RawEmailResult` để tránh xung đột.
6. **`email/README.md` §5/§6 lỗi thời sau phần này:** webhook, ghi
   `email_logs` thật và link hủy có token nay đã có — cần cập nhật README
   khi gộp.

## 10. Kiểm thử

```bash
# Workers (phần này — 92 test, mock hoàn toàn, không gửi email thật):
./node_modules/.bin/vitest run workers/api/src/email/token.test.ts \
  workers/api/src/email/consent.test.ts workers/api/src/email/retry.test.ts \
  workers/api/src/email/svix.test.ts workers/api/src/email/sender.test.ts \
  workers/api/src/email/webhook.test.ts workers/api/src/email/unsubscribe.test.ts \
  workers/api/src/email/templated.test.ts workers/api/src/email/store.test.ts \
  workers/api/src/email/logs.test.ts
# Frontend helper:
npm run test --workspace=apps/web   # gồm src/lib/unsubscribe.test.ts
# Migration (kiểm tra tĩnh):
node scripts/check-migrations.mjs
```

Test bao phủ: token (hết hạn / giả mạo / sai secret), consent
(unsubscribed / hard bounce / complaint / transactional vẫn gửi), retry
(500→thành công, 500×3, 400 không retry, 429 retry), webhook Svix
(chữ ký sai → 401, hard vs soft bounce, complained), unsubscribe
(GET/POST, đã hủy, token hết hạn), adapter template (care bị chặn,
chèn link token, quota), store (URL query log, đếm ngày theo giờ VN),
admin logs (401/403/200).
