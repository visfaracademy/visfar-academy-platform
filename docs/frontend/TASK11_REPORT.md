# TASK 11 — EMAIL AUTOMATION & LEARNER CARE: BÁO CÁO TỔNG HỢP (coordinator)

- **Ngày:** 10/11/2026
- **Trạng thái:** Code xong, kiểm thử local PASS (phạm vi Task 11). **Chưa đủ điều kiện gửi email thật / nghiệm thu live** — xem §6.
- **Dịch vụ:** Resend (đã phê duyệt). Domain gửi **chưa xác minh DNS SPF/DKIM/DMARC** — chưa được gửi cho người dùng thật.
- **Nguyên tắc:** 0 email thật đã gửi. Không key Resend thật, không secret nào được commit. Mọi con số test dưới đây là kết quả chạy thật của coordinator sau khi 4 nhóm bàn giao (17:23–17:25 +07, 10/11/2026), không lấy lại số báo cáo của nhóm.

## 1. Quyết định của coordinator (đã chốt trong Task 11)

| # | Điểm | Quyết định |
|---|---|---|
| D1 | Bảng mẫu E1–E13 chuẩn lưu DB | **Bảng Task 11** (E1 xác nhận đăng ký … E13 gia hạn membership). Bảng kiến trúc §9/§10.10 khác (E1 chào mừng, E3 lead…) — chưa có hàm render thật, không dùng làm chuẩn. Cần một đợt thống nhất bảng mẫu kiến trúc sau (follow-up, không chặn Task 11). |
| D2 | Vị trí gửi email | **Chỉ Workers** (`workers/api/src/email/`). Không gọi Resend từ frontend/`apps/web`. `RESEND_API_KEY` chỉ ở Workers Secrets. |
| D3 | Tên biến môi trường chuẩn | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFY_EMAIL` (mặc định `visfaracademy@gmail.com`), `UNSUBSCRIBE_SECRET`, `RESEND_WEBHOOK_SECRET`. `RESEND_FROM` và `ALERT_EMAIL` chỉ là alias cũ, vẫn chấp nhận để không vỡ cấu hình cũ — code mới dùng tên chuẩn. |
| D4 | Token unsubscribe | **HMAC-SHA256 stateless, có `exp`** (mặc định 90 ngày, sai số đồng hồ 60s), ký bằng `UNSUBSCRIBE_SECRET`, không lưu DB. Không dùng cột `newsletter_subscribers.unsubscribe_token` (không có cột hết hạn). |
| D5 | Cột đếm lần thử | Giữ **`email_logs.attempts`** (0017). Không thêm `retry_count` (0018 đã kiểm chứng không thêm cột này). |
| D6 | Trùng số migration 0017 | **Đã xử lý:** `0017_admin_user_disable.sql` (Task 09, độc lập, chỉ thêm cột `profiles`) đổi số thành **`0021_admin_user_disable.sql`**; `0017_email_unsubscribe_logs.sql` giữ số 0017 vì `0018_email_task11.sql` phụ thuộc các cột của nó. Thứ tự cuối: 0017 → 0018 → 0019 → 0020 → 0021, mỗi số duy nhất. `scripts/check-migrations.mjs` + test `admin-users.test.ts` đã cập nhật theo; `npm run check:migrations` PASS. |
| D7 | `src/email.ts` vs thư mục `src/email/` | Không còn xung đột: kiểm chứng không còn file `workers/api/src/email.ts` (đã gỡ trong lúc các nhóm làm việc). Barrel là `workers/api/src/email/index.ts`. |
| D8 | Link trong email | Tạm dùng `https://visfaracademy.netlify.app` (domain API đã chốt) làm `APP_URL_PLACEHOLDER`; thay bằng domain công khai của website khi chốt domain. |

## 2. File giữ nguyên

- Trang HTML gốc `workspace/user/files/Visfar_Academy.html` và `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` (chỉ đọc, không sửa).
- Migration cũ 0001–0016 (không sửa file nào). Schema/RLS cũ.
- Không sửa file nào ngoài phạm vi Task 11, trừ 2 chỗ ở §5 (đổi số migration + cập nhật test theo).

## 3. File mới

### Workers API — `workers/api/src/email/` (gửi email duy nhất qua Workers)
- `types.ts` — `TemplateId` E1–E13, `E1Data`…`E13Data`, `TemplateMeta`, `EmailSenderConfig`, `SendEmailInput/Result`, `EmailLogRow` khớp cột `email_logs`.
- `templates.ts` — `renderTemplate()`: subject + HTML + text thuần đủ 13 mẫu, escape HTML, validate trường bắt buộc, `formatVnd`/`formatDateVi` (giờ VN).
- `client.ts` — `sendEmail({to, template, data, idempotencyKey})` qua Resend REST bằng `fetch` (không thêm dependency); validate email (TLD ≥ 2); chặn `from = onboarding@resend.dev`; thiếu key/from → `email_not_configured` (không gửi); phát hiện `daily_quota_exceeded`; trả `logRow` để caller insert `email_logs`.
- `index.ts` — re-export (barrel, đã gộp).
- `token.ts` — token hủy đăng ký HMAC-SHA256, hết hạn 90 ngày.
- `consent.ts` — suppression-list: chưa có dòng → không chặn; đã hủy / hard bounce / spam complaint → chặn, ghi log `skipped`. Transactional vẫn gửi nhưng vẫn ghi log.
- `retry.ts` — tối đa 3 lần, backoff 1p/5p/15p; chỉ retry 429/5xx/lỗi mạng; không retry 4xx; `daily_quota_exceeded` không retry trong ngày.
- `svix.ts` + `webhook.ts` — webhook Resend `POST /api/webhooks/resend`, xác minh chữ ký Svix (`svix-id/timestamp/signature`, dung sai 5 phút); sai → 401. Cập nhật log theo `resend_id`: delivered/bounced/failed/complained; hard bounce + complaint → dừng gửi marketing cho địa chỉ đó; ≥80 email/ngày (giờ VN) → cảnh báo 1 lần/ngày về `visfaracademy@gmail.com`.
- `store.ts` + `logs.ts` — ghi/tra cứu `email_logs` (`to`, template, status, `resend_id` = provider_message_id, error, `sent_at`, `attempts`, `next_retry_at`); route admin `GET /api/admin/reports/email` (JWT + role admin).
- `sender.ts` — sender có consent + retry + log + cảnh báo quota.
- `templated.ts` — nối mẫu E1–E13 với consent/retry/log; tự chèn link hủy **có token ký** vào `data.unsubscribeUrl` (thay fallback `?email=...`).
- `unsubscribe.ts` — route `GET/POST /api/v1/newsletter/unsubscribe` (GET cho link 1 chạm); cập nhật `newsletter_subscribers` (`status='unsubscribed'`, `unsubscribed_at`, `unsubscribe_reason` ≤500 ký tự); idempotent (`already:true`); email không có trong bảng vẫn trả ok (không lộ sự tồn tại); token sai/hết hạn → `400 invalid_token`; rate-limit 10 req/giờ/IP.
- `README.md` — cách dùng, cấu hình, giới hạn, mục chưa làm.
- Test: `email-templates.test.ts` (68), `email-client.test.ts` (11), `consent.test.ts`, `retry.test.ts`, `svix.test.ts`, `store.test.ts`, `sender.test.ts`, `templated.test.ts`, `token.test.ts`, `unsubscribe.test.ts`, `webhook.test.ts`, `logs.test.ts` (tổng nhóm unsubscribe: 92 test).

### Workers API — automation
- `src/automation-rules.ts` — đủ 5 rule + lõi chung (chống trùng, hạn mức, ghi log) + store Supabase + adapter qua `sendEmail()`.
- `src/automation-cron.ts` — cron handler (`handleAutomationScheduled`, `createScheduledHandler`, `handleAutomationCronHttp` cho route admin tay).
- Test: `test/automation-rules.test.ts` (36), `test/automation-cron.test.ts` (7).
- `docs/automation/TASK11_AUTOMATION_RULES.md` — bảng kích hoạt/tần suất từng rule, giới hạn, điểm chưa làm.

### Migration
- `supabase/migrations/0017_email_unsubscribe_logs.sql` — **CHƯA ÁP.** Thêm cột `email_logs` (`error_message`, `sent_at`, `attempts`, `next_retry_at`, status thêm `complained`/`skipped`, unique index `resend_id`) + `newsletter_subscribers` (`unsubscribed_at`, `unsubscribe_reason`, `hard_bounced_at`). Parse pglast OK (13 câu).
- `supabase/migrations/0018_email_task11.sql` — **CHƯA ÁP.** Delta thuần: `email_logs.user_id` (FK profiles) + bảng `automation_events` theo §3.28 (`trigger`, `target_count`, `success_count`, `failure_count`, `started_at`, `finished_at`, CHECK status thêm `running`/`succeeded`, giữ `processed`). Không thêm `retry_count` / `provider_message_id` / `details` / `unsubscribe_token` (đã chốt D4/D5). Parse pglast OK (15 câu).

### Apps/web
- `src/lib/email.ts` — registry E1–E13, `TASK11_TEMPLATE_MAP`, log-only sender, `queueEmailLog` không throw.
- `src/lib/unsubscribe.ts` + `unsubscribe.test.ts` — phía frontend.
- `docs/architecture/EMAIL_UNSUBSCRIBE_LOGS.md` — tài liệu tích hợp unsubscribe/logs.

## 4. File sửa

- `workers/api/src/env.ts` — thêm `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UNSUBSCRIBE_SECRET`, `RESEND_WEBHOOK_SECRET`, `ADMIN_NOTIFY_EMAIL` (+ alias cũ `RESEND_FROM`, `ALERT_EMAIL`); `errors.ts` (mã `invalid_token`); `supabase.ts` (export `sbFetch`, helper `getProfileEmail`, `getCourseTitle`, `getCourseMeta`, `listCourseLessonIds`, `countCompletedLessons`, `markEnrollmentCompleted`).
- `workers/api/wrangler.toml` + `.dev.vars.example` — chỉ tên biến, không giá trị thật.
- `workers/api/src/payments.ts` — `notifyEnrollmentGranted()` gọi rule `runPaymentVerifiedAccess` sau `grantAccessForOrder()` cho từng khóa (kể cả khóa kèm gói membership).
- `workers/api/src/handlers/course-completion.ts` (`maybeCompleteCourseAndNotify`) — tự tính đủ 100% từ DB rồi mới đánh `completed` + gửi mail.
- `workers/api/src/certificates.ts` — chỉ bản cấp mới, thêm `emailWarning`; `src/lms-admin.ts` (E5 admin tặng khóa, thêm `emailWarning`).
- `apps/web/src/lib/auth.ts` — `signUpWithEmail` gọi E7 welcome (try/catch, lỗi mail không hỏng luồng chính).
- `apps/web/src/lib/api-client.ts` — thêm `invalid_token` vào allowlist mã lỗi.
- `scripts/check-migrations.mjs` — danh sách đủ 21 migration theo thứ tự (đã cập nhật renumber 0021) + 9 check cho 0017 + check 0018.
- `apps/web/src/lib/admin-users.test.ts` — cập nhật đường dẫn migration 0017 → 0021 (theo D6).
- `supabase/migrations/0021_admin_user_disable.sql` — file Task 09 đổi số từ 0017 (nội dung không đổi).

## 5. Chức năng đã làm

### 13 mẫu email (tiếng Việt, tự nhiên, ít emoji, không FOMO mạnh)
| Mẫu | Nội dung | Loại |
|---|---|---|
| E1 | Xác nhận đăng ký | Transactional |
| E2 | Xác minh email | Transactional |
| E3 | Đặt lại mật khẩu | Transactional |
| E4 | Xác nhận thanh toán | Transactional |
| E5 | Cấp quyền học | Transactional |
| E6 | Cấp chứng chỉ | Transactional |
| E7 | Chào mừng | Care |
| E8 | Hướng dẫn bắt đầu học | Care |
| E9 | Nhắc học | Care |
| E10 | Nhắc bài học chưa hoàn thành | Care |
| E11 | Chúc mừng hoàn thành | Care |
| E12 | Khóa học mới | Marketing |
| E13 | Gia hạn membership | Care/Marketing |

Footer mọi mẫu có `visfaracademy@gmail.com`; nút hủy đăng ký **chỉ ở E7–E13** (care/marketing), không có ở E1–E6 (giao dịch) — test khẳng định cả hai chiều.

### 5 automation rule (đã chốt)
| Rule | Kích hoạt | Mẫu | Ghi chú |
|---|---|---|---|
| Registration → Welcome | Sau đăng ký | E7 | Đã nối caller ở `auth.ts` |
| Payment verified → Enroll + access | `paymentStatus='succeeded'` + enrollment đã tồn tại; không tự tạo enrollment | E5 | Đã nối caller ở `payments.ts`; E4 xác nhận thanh toán đã nối sẵn ở `confirmPayment()` bước 11 (Task 10) |
| No activity 3 days → Learning reminder | Enrollment `active`, chưa hoàn thành, không hoạt động ≥ 3 ngày (theo `lesson_progress.updated_at`, fallback `enrolledAt`) | E9 | Cron handler đã có; cron thật chưa nối vào `wrangler.toml`/`index.ts` |
| Course completed → Congratulations | `enrollments.status='completed'` (tự tính đủ 100% từ DB) | E11 | Đã nối caller ở `handlers/course-completion.ts`, gọi từ `progress.ts` |
| Certificate issued → Certificate email | Chứng chỉ `valid`; mã lấy từ DB, không tin mã caller | E6 | Đã nối caller ở `certificates.ts` |

### Yêu cầu bắt buộc
- **Chống gửi trùng:** idempotency key `${rule}:${userId}:${YYYY-MM-DD}` (giờ VN) + kiểm tra `email_logs` trước khi gửi.
- **Giới hạn tần suất:** transactional luôn ưu tiên trước email nhắc; nhắc học tối đa 1 lần/3 ngày/enrollment và 2 lần/tuần/user; cron tạm hoãn đợt nhắc khi đã gửi ≥90/100 email/ngày để dành quota cho transactional. Resend Free: 3.000 email/tháng, **100 email/ngày** (giới hạn chạm đầu tiên của toàn hệ thống).
- **Unsubscribe:** có link hủy cho marketing/care; tôn trọng quyền nhận tin (suppression-list, §3).
- **Email logs:** mọi lần gửi ghi `email_logs`; tra cứu theo user/template/status/khoảng thời gian; route admin `GET /api/admin/reports/email`.
- **Retry:** tối đa 3 lần, backoff 1p/5p/15p; chỉ retry 429/5xx/lỗi mạng.
- **Bounce/lỗi gửi:** webhook Resend Svix; hard bounce/complaint → dừng gửi marketing cho địa chỉ đó; cảnh báo quota về `visfaracademy@gmail.com`.
- **Lỗi email không phá luồng chính:** mọi điểm gọi email đều try/catch + `emailWarning`; không có hàng đợi gửi lại sau `daily_quota_exceeded` (chỉ ghi log `failed`) — follow-up.

### Điểm tích hợp đã nối (5 điểm gọi email)
E7 welcome (`auth.ts`), E4 order-paid (`confirmPayment()`), E5 enrollment (`payments.ts`), E11 course-completed (`handlers/course-completion.ts`), E6 certificate (`certificates.ts`) + E5 admin tặng khóa (`lms-admin.ts`).

## 6. Kết quả kiểm thử — chạy thật bởi coordinator (10/11/2026, 17:23–17:25 +07)

| Lệnh | Kết quả |
|---|---|
| `node scripts/check-migrations.mjs` | **PASS** — đủ 21 migration theo thứ tự (sau renumber 0021) |
| `apps/web` `npm test` | **PASS — 27 file, 570/570 test** (sau khi sửa test theo D6; trước sửa: 569/570, 1 fail do đường dẫn migration cũ) |
| `apps/web` typecheck / lint / build | **PASS / PASS / PASS** |
| `workers/api` email-related (`test/email-templates`, `test/email-client`, `test/automation-rules`, `test/automation-cron`, `src/email/`) | **PASS — 122/122 test** (4 file chạy trong lần kiểm chứng cuối) |
| `workers/api` `npm test` (toàn suite) | **272/284 PASS — 12 FAIL, tất cả ở `test/payments.test.ts` + `test/sepay.test.ts` (Task 10, không phải Task 11)**. Lỗi typecheck kèm theo: `sepay.test.ts` gọi hàm thiếu 1 đối số (Expected 4 arguments, got 3). Nhóm Task 10 đang sửa song song; không phải lỗi Task 11. |
| `workers/api` typecheck | **FAIL do 5 lỗi ở `test/sepay.test.ts` (Task 10)**; 0 lỗi trong file email/automation của Task 11. |
| Quét secret trong `src/` (cả 2 phía) | **Sạch** — không có `RESEND_API_KEY` thật, không `.dev.vars` thật. Chỉ 1 chuỗi giả trong test. |
| pglast parse 0017 / 0018 | **PASS** (13 + 15 câu, chỉ kiểm tra cú pháp) |

Số test theo nhóm (báo cáo của nhóm, coordinator đã chạy lại một phần để đối chiếu): templates 79/79, automation 43/43, unsubscribe/logs 92/92 (Workers) + 18/18 (frontend), tích hợp 570/570 (apps/web, đã chạy lại toàn bộ).

### Live — CHƯA CHẠY (không ghi PASS giả)
1. **Migration 0017 + 0018 chưa áp lên Supabase thật (kể cả staging).** Cần áp staging → kiểm chứng → prod, theo thứ tự 0017 → 0018 → 0019 → 0020 → 0021.
2. **Chưa gửi email thật end-to-end.** Cần: chốt domain gửi → xác minh DNS SPF/DKIM/DMARC → set key thật bằng `wrangler secret put RESEND_API_KEY` → gửi thử tới admin trước.
3. **Cron `scheduled()` chưa nối** vào `workers/api/src/index.ts` + `wrangler.toml` (`[triggers] crons`); route tay cho rule (3) đã có (`handleAutomationCronHttp`).
4. **Chưa nối router:** 3 route mới (unsubscribe, webhook Resend, admin email logs) chưa được kiểm chứng nối vào Worker.
5. **Chưa test live:** store Supabase + cron chưa chạy trên staging; truy vấn `listInactiveLearners` (embed PostgREST) cần kiểm chứng trên staging trước khi bật cron; giả định hard bounce = `data.bounce.type === 'hard'` cần đối chiếu với 1 payload bounce thật của Resend.
6. **Gap cần follow-up:** `executeAutomationRule` không kiểm tra consent suppression (E11 care có thể gửi tới người đã hủy nhận tin); E5 đơn nhiều khóa: khóa thứ 2+ bị rule chống trùng `skipped` (cùng orderId); chưa có hàng đợi gửi lại sau `daily_quota_exceeded`.
7. **3 trang admin Task 10 chưa có** (`admin/don-hang`, `admin/ma-giam-gia`, `admin/goi-thanh-vien`) — ngoài phạm vi Task 11.

## 7. Phương án rollback

- Code chưa commit, chưa deploy, migration 0017/0018 chưa áp lên DB nào → rollback = xóa file mới ở §3 + revert các file sửa ở §4 (giữ lại sửa đổi số migration 0021 và test `admin-users.test.ts` vì đó là fix đúng); không cần rollback DB.
- Nếu đã áp 0017/0018 lên staging: các cột thêm đều `IF NOT EXISTS`, rollback bằng migration ngược (drop cột mới) — chưa viết, chỉ làm khi cần áp thật.
- Endpoint Apps Script cũ vẫn giữ nguyên (Task 05) — email không thay thế luồng lead cũ.

## 8. Việc cần làm tiếp (theo thứ tự)

1. Áp migration 0017 → 0018 → 0019 → 0020 → 0021 lên staging (kiểm chứng), rồi prod.
2. Chốt domain gửi → xác minh DNS SPF/DKIM/DMARC → set `RESEND_API_KEY` thật → gửi thử 13 mẫu tới admin.
3. Nối cron `scheduled()` + 3 route mới (unsubscribe, webhook Resend, admin email logs) vào Worker; kiểm chứng `listInactiveLearners` trên staging trước khi bật cron.
4. Sửa gap: kiểm tra consent trong `executeAutomationRule`; idempotency key E5 theo từng khóa (không chỉ orderId) cho đơn nhiều khóa; hàng đợi gửi lại sau `daily_quota_exceeded`.
5. Thống nhất bảng mẫu E1–E13 kiến trúc §9 vs Task 11 (D1); sửa 12 fail Task 10 (`payments`/`sepay` test) — ngoài phạm vi Task 11, do nhóm Task 10 đang sửa song song.
6. Đối chiếu 1 payload bounce thật của Resend với giả định `bounce.type === 'hard'`.
