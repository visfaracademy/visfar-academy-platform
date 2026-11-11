# TASK 11 — Automation Rules (5 rule email) — Visfar Academy

Ngày: 10/11/2026. Code: `workers/api/src/automation-rules.ts` +
`workers/api/src/automation-cron.ts`. Test:
`workers/api/test/automation-rules.test.ts` (36) +
`workers/api/test/automation-cron.test.ts` (7).

## 1. Bảng mẫu: kiến trúc §9 ≠ danh sách Task 11

`docs/architecture/SYSTEM_ARCHITECTURE.md` §9 đánh số E1–E13 một kiểu
(E1 chào mừng, E8 đã nhận thanh toán, E9 hoàn thành + chứng chỉ, E10
nhắc học…), nhưng nhóm templates đã làm theo **danh sách Task 11**
(`workers/api/src/email/README.md` §1, `src/email/types.ts`) — bảng này
khác hẳn và là bảng duy nhất có hàm render thật (`renderTemplate`).
Automation đi theo **bảng Task 11** (coordinator cần chốt bảng thống
nhất; xem §6).

| Rule | Kích hoạt | Mẫu Task 11 | Loại |
|---|---|---|---|
| (1) Registration → Welcome | Event: sau khi tạo `profiles` | **E7** Chào mừng | care |
| (2) Payment verified → Enroll + access | Event: đơn → `paid` + đã tạo enrollment | **E5** Cấp quyền học | transactional |
| (3) No activity 3 days → Learning reminder | **Cron mỗi giờ**, quét | **E9** Nhắc học | care, lặp lại |
| (4) Course completed → Congratulations | Event: enrollment → `completed` | **E11** Chúc mừng hoàn thành khóa học | care |
| (5) Certificate issued → Certificate email | Event: `certificates` → `valid` | **E6** Cấp chứng chỉ | transactional |

Hàm (file `automation-rules.ts`): `runRegistrationWelcome`,
`runPaymentVerifiedAccess`, `runLearningReminderForLearner`,
`runCourseCompleted`, `runCertificateIssued`. Mỗi hàm nhận
`AutomationDeps { store, mailer, siteOrigin? }` và trả `RuleResult
{ outcome: 'sent' | 'skipped' | 'failed', reason, idempotencyKey, … }`.

## 2. Cách kích hoạt từng rule

| Rule | Kích hoạt | Tần suất | Ghi chú |
|---|---|---|---|
| (1) | Gọi `runRegistrationWelcome()` ngay sau khi Supabase Auth tạo `profiles` (trigger đăng ký / route `/dang-ky`) | Mỗi lần đăng ký | Chỉ cần email hợp lệ |
| (2) | Gọi `runPaymentVerifiedAccess()` ngay sau khi đơn sang `paid` **và** enrollment đã tạo (route `mark-paid` / webhook SePay) | Mỗi đơn đã trả | Rule KHÔNG tự tạo enrollment; chưa có enrollment → `skipped enrollment_not_found`, không gửi link vào khóa chưa có quyền |
| (3) | Workers Cron → `handleAutomationScheduled(env)` (`automation-cron.ts`); hoặc tay: `POST /api/v1/admin/automation/run` (chỉ admin) → `handleAutomationCronHttp()` | Cron **mỗi giờ**: thêm vào `workers/api/wrangler.toml`: `[triggers] crons = ["0 * * * *"]`, nối `scheduled()` của entrypoint vào `handleAutomationScheduled()` | Cron chỉ quét; gửi thật ≤ 1 lần/3 ngày/enrollment nhờ cap (§3) |
| (4) | Gọi `runCourseCompleted()` khi enrollment → `completed` (100% bài + quiz đạt đã mã hóa trong status này theo TASK 08) | Mỗi lần hoàn thành khóa | **Đã nối sẵn:** `src/handlers/course-completion.ts` gọi rule này sau khi lưu tiến độ |
| (5) | Gọi `runCertificateIssued()` ngay sau khi dòng `certificates` tạo ở trạng thái `valid` (migration 0016) | Mỗi chứng chỉ | Mã chứng chỉ lấy từ DB (nguồn thật), không tin mã caller đưa |

Gửi thật đi qua `sendEmail()` của nhóm templates (`src/email/client`):
nó tự validate, render mẫu (subject + HTML + text), kiểm tra cấu hình,
gọi Resend kèm `Idempotency-Key`. Cần `RESEND_API_KEY` +
`RESEND_FROM_EMAIL` ở Workers Secrets; thiếu → cron trả `deferred`,
route tay trả 503, rule (4) qua hook trả `not_configured` — không gửi
email placeholder. Domain gửi chưa xác minh DNS (xem email/README §4):
không gửi cho người dùng thật trước khi xác minh SPF/DKIM/DMARC.

## 3. Chống trùng + giới hạn tần suất

- **Idempotency key:** `${rule}:${userId}:${YYYY-MM-DD}` (ngày theo giờ
  Việt Nam). Lưu trong `automation_events.payload` và gửi lên Resend.
  Trước khi gửi luôn kiểm tra `email_logs`: cùng `(to_email, template,
  related_id)` đã gửi trong ngày (queued/sent/delivered) → `skipped
  duplicate`. Key không gồm `related_id` nên 2 khóa hoàn thành cùng ngày
  vẫn gửi cả 2 (mỗi khóa có `related_id` riêng).
- **Nhắc học (E9) — email lặp lại duy nhất:** tối đa 1 lần/3 ngày/
  enrollment (`too_frequent`) + tối đa 2 lần/tuần/user (`weekly_cap`).
  Các rule 1 lần (E7/E5/E11/E6) không bị 2 hạn mức này chặn.
- **Ưu tiên transactional:** E5/E6 luôn được thử gửi; cron tạm hoãn toàn
  bộ đợt nhắc khi hôm nay đã gửi ≥ 90/100 email (`daily_quota_near_limit`,
  `REMINDER_DEFERRAL_THRESHOLD = 90`); Resend trả `daily_quota_exceeded`
  cho email care → ghi `failed` để gửi lại sau 00:00 UTC.
- **Ghi log:** mỗi lần chạy ghi 1 dòng `automation_events`
  (pending → processed/skipped/failed); mỗi lần gửi ghi 1 dòng
  `email_logs` (queued → sent/failed + `resend_id`). Payload không chứa
  PII (không email/họ tên). Lỗi mailer → `failed`, không throw để cron
  chạy tiếp học viên khác; lỗi store (không ghi được log) thì throw.

## 4. Điều kiện từng rule (tóm tắt)

- (1) E7: email hợp lệ. Dữ liệu mẫu: `studentName`, `dashboardUrl`.
- (2) E5: `paymentStatus = 'succeeded'` + enrollment của đơn tồn tại và
  `active`/`completed`. Dữ liệu mẫu: `studentName`, `courseTitle`,
  `courseUrl` (cần `courseSlug`).
- (3) E9: enrollment `active` + không hoạt động ≥ 3 ngày (`lastActivityAt`
  theo `lesson_progress.updated_at`, fallback `enrolledAt`; lưu ý: schema
  0001 chưa có `lesson_progress.course_id` nên last activity tính theo
  user, không theo từng khóa). Dữ liệu mẫu: `studentName`, `courseTitle`,
  `resumeUrl`, `daysInactive`.
- (4) E11: enrollment `completed`. Dữ liệu mẫu: `studentName`,
  `courseTitle`.
- (5) E6: chứng chỉ tồn tại + `valid`. Dữ liệu mẫu: `studentName`,
  `courseTitle`, `certificateCode`, `certificateUrl` (link tra cứu).

## 5. Kiểm thử (chạy thật, không gửi email thật, không chạm DB thật)

```sh
cd workers/api
./node_modules/.bin/vitest run test/automation-rules.test.ts test/automation-cron.test.ts
# Test Files 2 passed (2); Tests 43 passed (43)
```

43 test: đủ điều kiện → gửi (5 rule, gồm 1 test render thật cả 5 mẫu
bằng `renderTemplate` của nhóm templates); chưa đủ điều kiện → không gửi
(email sai, chưa trả tiền, chưa có enrollment, enrollment revoked/
completed, chứng chỉ revoked/missing, còn hoạt động); gửi trùng → chặn
(`duplicate`); quá tần suất → chặn (`too_frequent`, `weekly_cap`);
transactional/one-off không bị hạn mức nhắc chặn; mailer lỗi →
`failed` + log `failed`, gửi lại sau lỗi vẫn được (log `failed` không
chặn duplicate); cron tạm hoãn khi ≥ 90 email/ngày (không quét); cron
chạy tiếp khi 1 học viên lỗi; route tay 403 (không admin) / 503 (thiếu
key); adapter qua `sendEmail()` của nhóm templates (ok → resendId,
`daily_quota_exceeded` / `invalid_template_data` → throw); store
Supabase (fetch stub) lọc đúng học viên không hoạt động.

Toàn bộ `workers/api`: `vitest run` = **235/236 pass** (1 fail ở
`test/payments.test.ts` — test của nhóm khác, không liên quan automation).
`tsc --noEmit`: **0 lỗi ở file automation**; còn 21 lỗi ở file test của
nhóm khác (snapshot lúc chạy: `src/email/sender.test.ts`,
`src/email/store.test.ts`, `src/email/templated.test.ts`,
`src/handlers/course-completion.test.ts` — lỗi tuple/`never`, không liên
quan automation).

## 6. Chưa làm được / cần quyết định

1. **Bảng mẫu chưa thống nhất:** kiến trúc §9 và danh sách Task 11 đánh
   số E1–E13 khác nhau (README của nhóm templates đã ghi rõ). Automation
   theo bảng Task 11. Coordinator cần chốt 1 bảng; nếu đổi, chỉ sửa
   `RULE_TEMPLATES` + dữ liệu mẫu.
2. **Chọn E7 hay E1 cho rule (1), có gửi thêm E4 cho rule (2) không:**
   E7 'Chào mừng' được chọn cho "Welcome email"; E1 'Xác nhận đăng ký'
   cũng liên quan đăng ký. E5 'Cấp quyền học' được chọn cho rule (2);
   E4 'Xác nhận thanh toán' là email riêng ngoài 5 rule — cần quyết có
   gửi thêm E4 khi thanh toán không (sẽ là lần gửi thứ 6).
3. **Chưa nối caller cho rule (1), (2), (5) và cron thật:** chỉ rule (4)
   đã có caller (`handlers/course-completion.ts`). Còn thiếu: route đăng
   ký gọi rule (1); `mark-paid`/webhook SePay gọi rule (2); luồng cấp
   chứng chỉ gọi rule (5); `workers/api/src/index.ts` + `[triggers]
   crons` cho cron rule (3) (file `wrangler.toml` không sửa trong đợt
   này vì nhóm khác đang làm entrypoint).
4. **Chưa test live:** store Supabase + cron chưa chạy trên staging
   (chưa có DB/key thật trong tay); `listInactiveLearners` dùng embed
   PostgREST `profiles!inner` / `courses(title,slug)` — cần kiểm chứng
   trên staging trước khi bật cron.
5. **Consent cho email care:** E7/E9/E11 có nút hủy nhận tin; đường gửi
   qua `client.sendEmail` không kiểm tra consent như `sendTemplatedEmail`
   (nhóm khác đã ghi chú ở `handlers/course-completion.ts`). Học viên đã
   hủy nhận tin vẫn có thể nhận E11 — cần follow-up thêm kiểm tra consent
   vào `executeAutomationRule` hoặc chuyển rule care sang đường có consent.
6. **Lỗi typecheck của nhóm khác (không sửa trong đợt này):** `tsc
   --noEmit` còn 21 lỗi — toàn ở file test của nhóm khác
   (`src/email/sender.test.ts`, `src/email/store.test.ts`,
   `src/email/templated.test.ts`, `src/handlers/course-completion.test.ts`;
   lỗi tuple `[]` / `never`). Riêng `src/env.ts`: bản viết lại 16:55 đã làm mất
   `RESEND_API_KEY`/`RESEND_FROM` trong khi 4 file vẫn đọc 2 biến này —
   đã khôi phục 2 khai báo (file này là file duy nhất ngoài 4 file
   automation mà đợt này chạm vào).
7. **Không có hàng đợi gửi lại:** email `failed` vì quota chỉ được ghi
   log; chưa có job gửi lại sau 00:00 UTC (nhóm templates cũng ghi ở
   README §6).
