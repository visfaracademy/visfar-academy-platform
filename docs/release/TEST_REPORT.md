# BÁO CÁO KIỂM THỬ TOÀN BỘ (QA) — Visfar Academy (Task 12)

- **Ngày báo cáo:** 10/11/2026
- **Phiên kiểm thử:** 23:41 +07 ngày 10/11/2026 → 00:17 +07 ngày 11/11/2026 (giờ Việt Nam; 16:41–17:17 UTC). Mọi mốc giờ dưới đây ghi theo +07 trừ khi ghi rõ UTC.
- **Phạm vi:** `workspace/visfar-academy-platform`, app `apps/web` (Next.js 15.4.11, React 19, Vitest 2.1.9).
- **Người kiểm thử:** subagent QA Task 12 (không phải tác giả Task 05–11).
- **Tài liệu đầu vào đã đọc:** `docs/frontend/TASK05_REPORT.md`, `TASK06_REPORT.md`, `TASK06_AUTH_REPORT.md`, `TASK06_DASHBOARD_REPORT.md`, `TASK06_SECURITY_REPORT.md`, `TASK07_REPORT.md`, `TASK07_PART3_REPORT.md`, `TASK08_REPORT.md`. **Không tồn tại `TASK09_REPORT.md`, `TASK10_REPORT.md`, `TASK11_REPORT.md`** trong `docs/frontend/` — công việc Task 09–11 chỉ được ghi trong header các file code (vd. `admin-dashboard.ts` “1/4”, `lms-admin.ts` “3/4”, `crm.test.ts` “4/4”, `payments.test.ts` “TASK 10”, `email.test.ts` “Task 11”). Báo cáo này không bịa báo cáo Task 09–11.
- **Nguyên tắc:** chỉ ghi PASS cho thứ đã chạy thật và đạt; mọi con số dưới đây lấy từ output thật của lệnh đã chạy. Không viết thêm tính năng mới, không sửa code trong phiên QA này.

## 0. Cảnh báo về snapshot: repo đang bị sửa song song

Trong suốt phiên QA, các agent Task 09–11 vẫn đang giao code vào cùng repo. Bằng chứng:

- File test mới xuất hiện giữa các lần chạy: `admin-users.test.ts` (16:44 UTC), `crm.test.ts` (16:44), `lms-admin-audit.test.ts` (16:44), `lms-instructors.test.ts` (16:43), `payments.test.ts` (16:44), `email.test.ts` + `email.ts` (16:47), `unsubscribe.ts` + `unsubscribe.test.ts` (16:50), `api-client.ts` sửa lúc 17:01:38 UTC.
- Lần chạy `npm test` lúc 23:58 +07 cho 17 lỗi ở `email.test.ts` — **đã chứng minh là artifact**: cả `email.ts` (16:58:27 UTC) và `email.test.ts` (16:58:48 UTC) đều bị ghi lại **trong lúc Vitest đang chạy** (run bắt đầu 16:58:07 UTC). Chạy lại riêng file này lúc 00:00 +07: **21/21 PASS**.
- Có lúc 3 tiến trình `next build` chạy đồng thời (PID 16230, 17413, 18970) cùng ghi vào một thư mục `.next/`; load average lên tới 15,12. Lần build 00:06 +07 thất bại bằng lỗi `ENOENT` rename `.next/export/500.html` trong khi 2 build khác (bắt đầu 17:07 UTC) đang chạy — xem §2.4. Chạy lại build lúc 00:14 +07: **PASS, exit 0**.
- Lỗi type `TS2367` ở `unsubscribe.ts:45` (23:56 +07) đã được agent khác sửa bằng cách thêm `'invalid_token'` vào `ApiErrorCode`/`ERROR_CODES` trong `api-client.ts` lúc 17:01:38 UTC — typecheck và test `unsubscribe` sau đó đều PASS.

Vì vậy **mỗi kết quả dưới đây đều gắn mốc giờ snapshot**. Số “chốt” của phiên QA là snapshot cuối cùng cho từng lệnh (in đậm ở §2). Nếu code tiếp tục đổi sau 00:17 +07 ngày 11/11, các con số này không còn đúng nữa và phải chạy lại.

Repo vẫn chỉ có 1 commit (`54b6321 Module 1: Foundation`); toàn bộ công việc Task 05–11 vẫn ở trạng thái chưa commit (`git status --short`: 125 dòng thay đổi/untracked tại 00:17 +07).

---

## 1. Kết luận tổng thể

| Hạng mục | Kết quả chốt |
|---|---|
| `npm test` (full suite) | **FAIL (exit 1)** — 26 file, **546/548 test pass, 2 fail** tại snapshot 00:01 +07; sau đó 1 trong 2 lỗi đã được sửa thật và chứng minh PASS khi chạy lại (00:06 +07). **Còn 1 lỗi duy nhất: `payments.test.ts` G-T10-3b** (xem §3.10). |
| `npm run typecheck` | **PASS (exit 0)** tại snapshot 00:02 +07 — sau khi lỗi `TS2367` được sửa. Trước đó FAIL 1 lỗi lúc 23:56 +07. |
| `npm run lint` | **PASS (exit 0)** tại snapshot 00:02 +07. Trước đó FAIL 2 lỗi lúc 23:41 +07. |
| `npm run build` | **PASS (exit 0)** tại snapshot 00:14–00:17 +07 — compile 48s, lint + typecheck trong build OK, 31/31 trang tĩnh. Trước đó FAIL 3 lần với 3 nguyên nhân khác nhau (xem §2.4). |
| 14 lĩnh vực (§4) | **11 PASS, 1 FAIL (Payment), 2 CHƯA CHẠY đầy đủ (PDF, và Analytics chỉ PASS giới hạn — xem bảng).** |
| Kiểm thử live / E2E | **CHƯA CHẠY toàn bộ** — không có môi trường staging/prod thật trong phiên QA này, không tài khoản admin/thật, không thanh toán thật, không gửi email thật, không phát video thật. Mọi test đều chạy local với fake client/mock fetch. |

**Verdict: CHƯA ĐỦ ĐIỀU KIỆN NGHIỆM THU LIVE.** Code biên dịch được, build được, 547/548 test (hiệu lực sau khi trừ assertion lỗi thời) đạt — nhưng còn 1 test đỏ phải cập nhật, và chưa có bất kỳ kiểm chứng nào trên môi trường thật (DB live, đăng nhập thật, webhook SePay thật, email thật). Không ghi PASS cho những thứ này.

---

## 2. Kết quả 4 lệnh — chạy thật

Tất cả lệnh chạy trong `apps/web` (`@visfar/web@0.1.0`), Node qua npm. Log đầy đủ lưu tại `/tmp/qa_test4.log`, `/tmp/qa_typecheck3.log`, `/tmp/qa_lint3.log`, `/tmp/qa_build4.log` (thư mục tạm của phiên QA).

### 2.1 `npm test` — FAIL (exit 1), 546/548 pass tại snapshot 00:01 +07

Lịch sử các lần chạy (repo đổi liên tục nên số test tăng dần):

| Lần chạy (giờ +07) | File test | Tổng test | Pass | Fail | Ghi chú |
|---|---|---|---|---|---|
| 23:41, 10/11 | 19 | 423 | 423 | 0 | Chạy trước khi 5 file test mới đổ về (16:43–16:44 UTC). |
| 23:45, 10/11 | 24 | 505 | 503 | 2 | Fail: `payments.test.ts` G-T10-1 (đã có seed `system_settings` ở migration 0019) và G-T10-3 (handlers đã có thêm `health.ts`, `progress.ts`) — cả hai đều là assertion phủ định lỗi thời, xem §3.10. |
| 23:58, 10/11 | 26 | 543 | 524 | 19 | 17 fail ở `email.test.ts` — **artifact do file bị ghi lại giữa lúc chạy** (email.ts 16:58:27 UTC, email.test.ts 16:58:48 UTC, run bắt đầu 16:58:07 UTC). Chạy lại riêng file lúc 00:00 +07: 21/21 PASS. 2 fail còn lại: payments G-T10-3b + unsubscribe `invalid_token`. |
| **00:01, 11/11 (chốt full suite)** | **26** | **548** | **546** | **2** | Fail: payments G-T10-3b; unsubscribe `invalid_token` (lúc đó chưa sửa). |
| 00:06, 11/11 (chạy lại 2 file) | 2 | 36 | 35 | 1 | `unsubscribe.test.ts` **6/6 PASS** sau khi `api-client.ts` thêm `'invalid_token'` (17:01:38 UTC). Chỉ còn payments G-T10-3b fail. |

Bảng chi tiết từng file tại lần chạy full chốt (00:01 +07, 548 test):

| File test | Số test | Kết quả |
|---|---|---|
| `certificates.test.ts` | 32 | ✓ pass |
| `progress.test.ts` | 47 | ✓ pass |
| `learning.test.ts` | 48 | ✓ pass |
| `quiz.test.ts` | 34 | ✓ pass |
| `crm.test.ts` | 23 | ✓ pass |
| `admin-users.test.ts` | 20 | ✓ pass |
| `lms-access.test.ts` | 28 | ✓ pass |
| `lms-admin.test.ts` | 21 | ✓ pass |
| `dashboard.test.ts` | 36 | ✓ pass |
| `lms-instructors.test.ts` | 17 | ✓ pass |
| `assignments.test.ts` | 25 | ✓ pass |
| `admin-dashboard.test.ts` | 17 | ✓ pass |
| `payments.test.ts` | 30 | ✗ **1 failed** (G-T10-3b) |
| `email.test.ts` | 21 | ✓ pass |
| `auth-flows.test.ts` | 24 | ✓ pass |
| `leads.test.ts` | 18 | ✓ pass |
| `security.test.ts` | 13 | ✓ pass |
| `lms-admin-audit.test.ts` | 3 | ✓ pass |
| `api-client.test.ts` | 12 | ✓ pass |
| `session-guard.test.ts` | 12 | ✓ pass |
| `rls-policy.test.ts` | 11 | ✓ pass |
| `validation.test.ts` | 30 | ✓ pass |
| `unsubscribe.test.ts` | 6 | ✗ **1 failed tại snapshot này; đã PASS 6/6 khi chạy lại lúc 00:06 +07** |
| `newsletter.test.ts` | 4 | ✓ pass |
| `auth.test.ts` | 9 | ✓ pass |
| `courses.test.ts` | 7 | ✓ pass |
| **Tổng** | **548** | **546 pass / 2 fail (tại snapshot); hiệu lực sau fix: 547/548, chỉ còn G-T10-3b** |

Lưu ý: `vitest.config.ts` chỉ chạy `src/**/*.test.ts` trong `apps/web`. Test của Workers API (vd. `workers/api/src/sepay.test.ts`, `workers/api/src/email/*.test.ts`) **không nằm trong lệnh này và không được chạy trong phiên QA này**.

### 2.2 `npm run typecheck` (`tsc --noEmit`) — PASS tại snapshot cuối

| Lần chạy (giờ +07) | Kết quả |
|---|---|
| 23:42, 10/11 | **PASS, exit 0, 0 lỗi** — trước khi file `email.ts`/`unsubscribe.ts` đổ về. |
| 23:56, 10/11 | **FAIL, exit 2, 1 lỗi:** `src/lib/unsubscribe.ts(45,19): error TS2367: This comparison appears to be unintentional because the types 'ApiErrorCode' and '"invalid_token"' have no overlap.` — `unsubscribe.ts` (mới về 16:50 UTC) so sánh `err.code !== 'invalid_token'` trong khi `ApiErrorCode` trong `api-client.ts` chưa có giá trị này. |
| **00:02, 11/11 (chốt)** | **PASS, exit 0, 0 lỗi** — `api-client.ts` đã được sửa lúc 17:01:38 UTC: thêm `'invalid_token'` vào union `ApiErrorCode` (dòng 31) và vào `ERROR_CODES` (dòng 102). |

### 2.3 `npm run lint` (`eslint .`) — PASS tại snapshot cuối

| Lần chạy (giờ +07) | Kết quả |
|---|---|
| 23:41, 10/11 | **FAIL, exit 1, 2 lỗi:** `src/components/admin/AdminContentTree.tsx:9:49 'AdminResourceItem' is defined but never used` (`@typescript-eslint/no-unused-vars`); `src/lib/admin-dashboard.ts:149:7 'q' is never reassigned. Use 'const' instead` (`prefer-const`). |
| **00:02, 11/11 (chốt)** | **PASS, exit 0, 0 lỗi, 0 warning** — cả hai lỗi đã được sửa trong lúc QA chạy (kiểm chứng: `AdminResourceItem` hiện được dùng ở `AdminContentTree.tsx:601`; `admin-dashboard.ts:149` hiện là `const q = ...`). |

### 2.4 `npm run build` (`next build`) — PASS tại snapshot cuối

| Lần chạy (giờ +07) | Kết quả |
|---|---|
| 23:41–23:47, 10/11 | **FAIL, exit 1.** Compile xong nhưng bước lint trong build báo: `./src/lib/admin-users.test.ts:39:13 Error: '_args' is defined but never used.` — file test mới về giữa phiên QA; lint của `next build` quét cả file test trong khi `eslint .` (lệnh lint riêng) không báo lỗi này. Chênh lệch cấu hình lint giữa hai lệnh, cần thống nhất (xem §5, B-T12-1). |
| 23:49–00:00, 11/11 | **FAIL, exit 1.** `✓ Compiled successfully in 97s`, sau đó fail ở “Linting and checking validity of types” với đúng lỗi `TS2367` ở `unsubscribe.ts:45:19` như §2.2. (Build này chạy 391s do máy bị nghẽn — load average 15,12, 3 build song song.) |
| 00:06–00:13, 11/11 | **FAIL, exit 1 — nhưng KHÔNG phải lỗi code.** `✓ Compiled successfully in 3.7min`, lint + typecheck trong build OK, `✓ Generating static pages (31/31)`, rồi fail ở bước cuối: `[Error: ENOENT: no such file or directory, rename '.../.next/export/500.html' -> '.../.next/server/pages/500.html']`. Trong lúc build này chạy, 2 tiến trình `next build` khác (bắt đầu 17:07 UTC) cùng ghi vào chung một thư mục `.next/` — gần như chắc chắn là race do build song song, không phải lỗi ứng dụng. Sau build này, `.next/export/` trống. |
| **00:14–00:17, 11/11 (chốt)** | **PASS, exit 0.** `✓ Compiled successfully in 48s`; `Linting and checking validity of types ...` OK (chỉ cảnh báo: “The Next.js plugin was not detected in your ESLint configuration”); `✓ Generating static pages (31/31)`; in đủ bảng route (xem §2.5). First Load JS shared: 100 kB; Middleware 34.4 kB. |

#### 2.5 Route đã build được (từ `npm run build` chốt, 00:14 +07)

31 trang tĩnh/dynamic, gồm: `/`, `/chuong-trinh`, `/chuong-trinh/[slug]`, `/dang-ky`, `/dang-nhap`, `/dat-lai-mat-khau`, `/quen-mat-khau`, `/tu-van`, `/hoc-vien`, `/hoc-vien/chung-chi`, `/hoc-vien/doi-mat-khau`, `/hoc-vien/don-hang`, `/hoc-vien/ho-so`, `/hoc-vien/khoa-hoc`, `/hoc-vien/khoa-hoc/[courseSlug]/bai/[lessonSlug]`, `/hoc-vien/khoa-hoc/[courseSlug]/quiz/[quizId]`, `/hoc-vien/khoa-hoc/[courseSlug]/bai-tap/[assignmentId]`, `/hoc-vien/khoa-hoc/[courseSlug]/bai-tap/[assignmentId]/cham-bai`, `/hoc-vien/lich-su`, `/hoc-vien/thong-bao`, cộng các route `/admin/*` và `/api/*` (không liệt kê hết trong bảng route của Next). Không có lỗi prerender nào.

---

## 3. Các lỗi / khoảng trống phát hiện (mã B-T12-*)

Không sửa code trong phiên QA; các mục dưới đây là việc còn tồn đọng cho builder.

| Mã | Mức | Nội dung | Bằng chứng |
|---|---|---|---|
| **B-T12-1** | Trung bình | `npm run lint` PASS nhưng `next build` (lần 1) FAIL vì lint trong build quét cả file test (`admin-users.test.ts:39 '_args' unused`) — hai cấu hình lint không thống nhất. Lỗi này về sau tự hết (file được sửa), nhưng chênh lệch cấu hình vẫn còn và có thể tái phát. | Log build lần 1 (§2.4). |
| **B-T12-2** | Thấp (đã có code mới, test lỗi thời) | `payments.test.ts` G-T10-3b vẫn FAIL: test khẳng định “chưa có handler orders/webhook — handlers chỉ có health/leads/progress”, nhưng thực tế handlers đã là `['health.ts', 'leads.ts', 'payments-admin.ts', 'payments.ts', 'progress.ts']`. Đây là assertion phủ định lỗi thời, không phải lỗi sản phẩm — nhưng nó làm `npm test` exit 1. Test phải được cập nhật thành khẳng định DƯƠNG (handlers payments đã có), đúng như chính header file đã dặn (“cần cập nhật khi code về”). | `npm test` 00:01 +07 và chạy lại 00:06 +07: `expected [...] to deeply equal ['health.ts', 'leads.ts', 'progress.ts']`, `payments.test.ts:250`. Cùng họ với G-T10-1/G-T10-3 đã fail ở lần chạy 23:45 +07 (seed `system_settings` đã có ở `supabase/migrations/0019_commerce_payment.sql:304`). |
| **B-T12-3** | Đã sửa trong phiên QA (ghi để đối chiếu) | `invalid_token` không có trong `ApiErrorCode` → typecheck/build fail (TS2367) và test `unsubscribe` fail (API 400 `invalid_token` bị map thành `code: 'unknown', canRetry: true` thay vì `code: 'invalid_token', canRetry: false`). Đã sửa ở `api-client.ts` lúc 17:01:38 UTC; typecheck 00:02 PASS, `unsubscribe.test.ts` 6/6 PASS lúc 00:06. | §2.2, §2.1; `api-client.ts:31,102`; `unsubscribe.test.ts:55`. |
| **B-T12-4** | Trung bình | Chưa có kiểm chứng live/E2E cho bất kỳ luồng nào: không staging/prod, không JWT admin/thật, không webhook SePay thật, không email thật, không phát video thật. Migration 0014–0019 (quiz, assignment, certificate, admin disable, email, commerce/payment) chưa được xác nhận đã áp lên DB live trong phiên này (Task 08 đã ghi 0014–0016 chưa áp; QA này không có quyền/kênh để kiểm chứng DB live nên không ghi PASS/FAIL cho mục đó — ghi **CHƯA KIỂM CHỨNG**). | Toàn §4, cột “Live”. |
| **B-T12-5** | Thấp | Test suite của Workers API không chạy trong phiên này (`workers/api/src/sepay.test.ts` — contract test cho chu kỳ webhook/idempotency/số tiền/cấp quyền theo header `payments.test.ts`; `workers/api/src/email/*.test.ts`). Cần chạy riêng `npm test` trong `workers/api` trước khi kết luận Payment/Email. | `workers/api/src/sepay.test.ts`, `workers/api/src/email/` tồn tại; `vitest.config.ts` của `apps/web` không bao gồm chúng. |
| **B-T12-6** | Thấp | `SEPAY_WEBHOOK_SECRET` vẫn chưa có (test G-T10-2 trong `payments.test.ts` vẫn PASS theo nghĩa “chưa có” — `workers/api/src/env.ts` và `.dev.vars.example` chưa chứa tên biến). Webhook SePay chưa thể xác thực chữ ký cho tới khi bổ sung secret qua Workers Secrets. | `payments.test.ts` G-T10-2 pass; grep `workers/api/src/env.ts`. |

### Đối chiếu các lỗi cũ từ Task 08 (đã kiểm tra lại)

- **B-T08-2** (dùng cột `course_instructors.instructor_id` không tồn tại): **dường như đã sửa.** Grep toàn `apps/web/src` chỉ còn 1 lần nhắc `instructor_id` trong comment ở `lms-admin.ts:699`; `lms-instructors.test.ts` (17 test, pass) khẳng định cột đúng là `user_id` (theo 0004 mục 20, 0013 mục E). Chưa kiểm chứng trên DB live.
- **B-T08-5** (nộp quiz đạt chưa đánh dấu bài quiz hoàn thành → khóa có quiz không cấp được chứng chỉ): **đã có đường nối trong code, chưa kiểm chứng E2E.** Header `progress.ts` (dòng 27–31) ghi đã thêm cho quiz: `lesson_type 'quiz'` + event `'completed'`, server đối chiếu `quiz_attempts.passed` trước khi ghi. Không có test E2E hay DB live để chứng minh luồng chạy thật.

---

## 4. Bảng QA 14 lĩnh vực

Quy ước: **PASS** = test unit local đã chạy thật và đạt (ghi rõ file + số test); **FAIL** = có test đỏ hoặc lỗi đã chạy thật; **CHƯA CHẠY** = chưa có kiểm thử thực chất cho lĩnh vực đó. Mọi lĩnh vực đều có thêm cột “Live” — tất cả đều là **CHƯA** vì phiên QA không có môi trường thật.

| # | Lĩnh vực | Kết quả | Bằng chứng (test đã chạy thật) | Giới hạn / lý do |
|---|---|---|---|---|
| 1 | Authentication | **PASS** | `auth.test.ts` 9 + `auth-flows.test.ts` 24 + `session-guard.test.ts` 12 = **45 test pass** (đăng ký/đăng nhập, redirect xác minh email về `/auth/callback`, đổi/quên/đặt lại mật khẩu, session guard). | Unit với mock Supabase/fetch; **live chưa chạy** (không đăng nhập thật trên Supabase). |
| 2 | Authorization | **PASS** | `rls-policy.test.ts` 11 + `security.test.ts` 13 + `lms-access.test.ts` 28 = **52 test pass** (RLS bật trên bảng, học viên chỉ đọc/nộp bài của mình, kiểm tra enrollment trước khi cho xem bài, đáp án đúng không lộ qua `toPublicPaper`). | Khẳng định trên text policy + fake client; **live chưa chạy** (không JWT thật để thử vượt quyền). |
| 3 | LMS (khóa học / bài học / quản trị khóa) | **PASS** | `learning.test.ts` 48 + `lms-admin.test.ts` 21 + `lms-instructors.test.ts` 17 + `lms-admin-audit.test.ts` 3 = **89 test pass** (module/bài học, phân công giảng viên đúng cột `user_id`, audit log cho thao tác quản trị, hoàn trả đơn hàng). | Fake client ghi vào store trong bộ nhớ; **live chưa chạy**. |
| 4 | Video | **PASS (giới hạn)** | Không có file test riêng cho video; phủ trong `learning.test.ts` (48): tách YouTube video id từ watch/youtu.be/embed/shorts, URL embed `youtube-nocookie` không gợi ý video liên quan, loại bài `video`, quy tắc hoàn thành khi xem ≥ 90% (trong `learning.ts:8`); `progress.test.ts` (47) kiểm tra tiến độ xem; component `LessonPlayer.tsx` tồn tại; route bài học build được (`/hoc-vien/khoa-hoc/[courseSlug]/bai/[lessonSlug]`). | **Không có test phát video thật**, không kiểm tra YouTube live, không đo % xem thực tế trên trình phát. |
| 5 | PDF | **CHƯA CHẠY** | Chỉ có 2 điểm chạm trong test: `lessonTypeLabelVi('pdf')` → `'PDF'` và `file_url` `.pdf` được truyền qua trong `learning.test.ts` (dòng 212, 596); `LessonPlayer.tsx` có link “Mở / tải tài liệu (PDF)”; route tài nguyên `/api/v1/resources/[id]` tồn tại. | Không có test nào mở/render/tải một file PDF thật, không kiểm tra quyền truy cập file PDF. Vì vậy không ghi PASS cho “PDF chạy được”. |
| 6 | Progress (tiến độ học) | **PASS** | `progress.test.ts` **47 test pass** (ghi nhận tiến độ bài, video 90%, ghi chú bài học, tính % hoàn thành khóa). | Fake client; đường nối quiz → `lesson_progress` (B-T08-5) mới chỉ có trong code/comment, **chưa kiểm chứng E2E**. |
| 7 | Quiz | **PASS** | `quiz.test.ts` **34 test pass** (trộn đề có seed, đếm ngược, chấm đủ loại câu hỏi, `toPublicPaper` không lọt `is_correct`, fetch wrapper map lỗi 401; 1 cảnh báo Vitest 3 về assertion chưa await ở dòng 387 — không fail). | Chấm thật chạy bằng hàm SQL `submit_quiz_attempt` (migration 0014) — **chưa áp/chưa chạy trên DB live** nên chỉ mới kiểm chứng bản đặc tả TS + mock fetch. |
| 8 | Assignment (bài tập) | **PASS** | `assignments.test.ts` **25 test pass** (validate bài tập/bài nộp/chấm/file, `decideCanSubmit`, URL không lộ URL gốc). Route `POST/GET /api/v1/assignments/*`, upload vào bucket private `submissions`, download qua server đều có code và build được. | Fake client; **chưa nộp/chấm bài thật, chưa upload file thật lên Storage**. |
| 9 | Certificate (chứng chỉ) | **PASS** | `certificates.test.ts` **32 test pass**, gồm đúng 2 trường hợp Task 08 yêu cầu: video `in_progress` 95% → không cấp; quiz 60% < 70% → không cấp; 70% → cấp; cấp lại sau thu hồi (UNIQUE riêng phần chỉ 1 chứng chỉ `valid`/user+khóa). Mã `VISFAR-CERT-YYYY-NNNNNN`, tra cứu công khai qua RPC `verify_certificate` chỉ trả 6 trường an toàn. | Fake client; hàm SQL + migration 0016 **chưa chạy trên DB live**; chưa cấp chứng chỉ thật. |
| 10 | Payment (thanh toán) | **FAIL** | `payments.test.ts` 30 test, **29 pass / 1 fail** — G-T10-3b (xem B-T12-2). Phần pass: schema đủ ràng buộc chống trùng (`UNIQUE (method, gateway_reference)`), `amount_vnd CHECK > 0`, `status` chỉ nhận `pending/succeeded/failed/refunded`, RLS chặn client ghi trực tiếp `orders`/`payments`, `api-client` có mã lỗi `payment_mismatch`/`idempotency_conflict` + `Idempotency-Key`. Migration 0019 đã seed `system_settings` (refund 15 ngày / complaint 3 ngày / SePay / MB Bank). Handlers `payments.ts` + `payments-admin.ts` đã có trong Workers. | FAIL vì suite exit 1 (dù lỗi là assertion lỗi thời). **Live chưa chạy:** chưa có `SEPAY_WEBHOOK_SECRET` (B-T12-6), chưa test webhook SePay thật, chưa có route orders trong `apps/web`; `workers/api/src/sepay.test.ts` chưa chạy trong phiên này (B-T12-5). |
| 11 | CRM | **PASS** | `crm.test.ts` **23 test pass** + `leads.test.ts` **18 test pass** = 41 test (đổi trạng thái lead thật trên fake store, lưu tương tác, audit log luôn có dòng tương ứng, phân loại CRM suy từ đơn hàng/ghi danh thật). Migration `0017_lead_interactions.sql` tồn tại. | Fake store trong bộ nhớ; **live chưa chạy** (không lead thật). |
| 12 | Email | **PASS (sau khi loại artifact)** | `email.test.ts` **21/21 pass** (15 template E1–E13 + 2 mẫu Task 11, `TASK11_TEMPLATE_MAP`, `validateEmailEventInput`, `requestEmailEvent` không throw, 4 wrapper tích hợp welcome/order-paid/course-completed/certificate-issued, `queueEmailLog`, token hủy đăng ký HMAC); `unsubscribe.test.ts` **6/6 pass** (sau fix `invalid_token`); `newsletter.test.ts` **4 pass**. Workers có module email đầy đủ (`templates.ts`, `sender.ts`, `webhook.ts`, `svix.ts`, `unsubscribe.ts`, `token.ts`, `retry.ts`, `consent.ts`). | 17/21 fail ở lần chạy 23:58 +07 đã chứng minh là artifact do file bị ghi lại giữa lúc chạy (xem §0). **Không gửi email thật** (`logOnlySender` chỉ ghi log); test Workers email chưa chạy (B-T12-5); migration `0018_email_task11.sql` + `0017_email_unsubscribe_logs.sql` chưa kiểm chứng trên DB live. |
| 13 | Admin (quản trị) | **PASS** | `admin-users.test.ts` **20 test pass** (vô hiệu hóa user, đổi role, audit) + `admin-dashboard.test.ts` **17 test pass** + `dashboard.test.ts` **36 test pass** = 73 test. Trang `/admin` build được; migration `0017_admin_user_disable.sql` tồn tại. | Fake client; **live chưa chạy** (không JWT admin thật — xem thêm `docs/release/ANALYTICS_CHECK.md`). |
| 14 | Analytics | **PASS (giới hạn)** | `admin-dashboard.test.ts` **17 pass** + `dashboard.test.ts` **36 pass** (công thức tính, fallback doanh thu, empty state, video 90%). Theo `docs/release/ANALYTICS_CHECK.md` (kiểm chứng Task 12 cùng phiên): **9/12 chỉ số CÓ** (7 đầy đủ: học viên mới, học viên hoạt động, khóa học, tiến độ học, tỷ lệ hoàn thành, doanh thu, đơn hàng; 2 một phần: lượt đăng ký, thanh toán), **3 KHÔNG** (điểm quiz tổng hợp, email, tỷ lệ chuyển đổi); số liệu lấy từ Supabase thật, không bịa. | **Live chưa chạy** (không JWT admin); kiến trúc M12 (tổng hợp ở Workers API + cache) **chưa** implemented — hiện đọc trực tiếp Supabase bằng JWT admin. |

---

## 5. Việc còn tồn đọng trước khi release

1. **Cập nhật `payments.test.ts` G-T10-3b** thành khẳng định dương (handlers `payments.ts`/`payments-admin.ts` đã có; kiểm tra route webhook/orders thật thay vì khẳng định “chưa có”), rồi chạy lại `npm test` cho tới khi **exit 0**.
2. **Thống nhất cấu hình lint** giữa `eslint .` và lint trong `next build` (B-T12-1) để lỗi ở file test không chỉ lộ ra lúc build.
3. **Chạy test Workers API** (`workers/api`) — đặc biệt `sepay.test.ts` và `email/*.test.ts` (B-T12-5).
4. **Bổ sung `SEPAY_WEBHOOK_SECRET`** qua Workers Secrets (B-T12-6) và test webhook SePay thật (ký, trùng lặp, sai số tiền, cấp quyền sau thanh toán).
5. **Áp migration 0014–0019 lên staging** rồi kiểm chứng E2E thật: đăng nhập → ghi danh → xem video → làm quiz → nộp bài → cấp chứng chỉ; kiểm tra B-T08-5 (quiz đạt có đánh dấu bài hoàn thành không).
6. **Kiểm thử PDF thật** (mở/render/tải file PDF, phân quyền) và **phát video thật** (YouTube embed, % xem) — hiện cả hai đều chưa có kiểm thử thực chất.
7. **Không chạy nhiều `next build` song song** trên cùng repo (chúng dùng chung `.next/` và gây lỗi `ENOENT` giả như §2.4); chạy build release trên máy sạch hoặc sau khi các agent khác dừng giao code.
8. **Commit code Task 05–11** (hiện 125 dòng thay đổi/untracked, 1 commit duy nhất) và bổ sung báo cáo Task 09–11 vào `docs/frontend/` để QA sau có đầu vào đầy đủ.

---

## 6. Phụ lục — Lệnh đã chạy (để tái lập)

```bash
cd workspace/visfar-academy-platform/apps/web
npm test            # vitest run — xem §2.1 (4 lần full + 2 lần targeted)
npm run typecheck   # tsc --noEmit — xem §2.2 (3 lần)
npm run lint        # eslint . — xem §2.3 (2 lần)
npm run build       # next build — xem §2.4 (4 lần)
```

Môi trường: Next.js 15.4.11, Vitest 2.1.9, TypeScript 5.6, ESLint 9.28. Không dùng tài khoản/môi trường live nào trong phiên QA này; không gửi email/thanh toán thật; không thay đổi code nguồn (chỉ đọc + chạy lệnh; mọi sửa file trong phiên đều do các agent khác thực hiện song song và đã được ghi rõ mốc giờ).
