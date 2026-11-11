# API_DOCUMENTATION — Tài liệu API (từ code thật)

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Nguồn duy nhất:** `workers/api/src/index.ts` (router Worker), `workers/api/src/handlers/`, `workers/api/src/errors.ts`, `workers/api/src/env.ts`, `workers/api/src/jwt.ts`, `workers/api/src/rate-limit.ts`, và các Route Handler Next.js trong `apps/web/src/app/api/`. Không bịa route.
- **Hai hệ API khác nhau — đừng nhầm:**
  - **Worker API** (Cloudflare Worker `api`): base `https://api.visfaracademy.workers.dev`, tiền tố `/api/v1`. Đây là API chính cho leads/orders/payments/appointments/referrals/AI Mentor.
  - **Next.js API** (Route Handlers trong `apps/web`): cùng domain Pages `https://visfaracademy.pages.dev`, đường dẫn `/api/...` (gồm cả `/api/v1/quizzes/*`, `/api/v1/assignments/*`, `/api/v1/certificates/*`, `/api/admin/*`, `/api/lms/*`). Đây là API LMS/admin chạy trên Pages (edge runtime).
- **Không chứa secret/key/token nào (chỉ tên biến).**

## 1. Quy ước chung

### 1.1. Định dạng response

- Thành công: `{ "ok": true, ... }` (JSON, `Content-Type: application/json`).
- Lỗi: `{ "ok": false, "error": "<ma_loi>", "message": "<tiếng Việt, dễ hiểu>" }` — không lộ chi tiết kỹ thuật hay secret. Chi tiết kỹ thuật chỉ ghi vào log server (không chứa PII — log chỉ ghi `reference_code` / `user_id` / mã lỗi).
- **Không có "thành công giả":** API chỉ trả `ok: true` khi ghi DB đã được xác nhận. Ghi thất bại → `500 server_error` hoặc `502 upstream_error`.
- CORS (Worker): chỉ origin trong `ALLOWED_ORIGINS` (mặc định: `https://visfaracademy.netlify.app`, `http://localhost:3000`, `http://localhost:3100` — **lưu ý: `visfaracademy.pages.dev` không có trong danh sách mặc định**; xem §6). Cho phép method `GET, POST, PATCH, OPTIONS`; header `Content-Type, Authorization, Idempotency-Key`; preflight `OPTIONS` → 204.
- Phân trang (theo thiết kế API_ARCHITECTURE §7.3): `?page=` (mặc định 1) + `?limit=` (mặc định 20, tối đa 100); response kèm `pagination: { page, limit, total, totalPages }`. **Chưa đối chiếu từng handler có tuân thủ đúng hay không trong đợt này** — xem ghi chú ở từng route khi dùng.

### 1.2. Xác thực (Worker)

- Header: `Authorization: Bearer <Supabase JWT>`.
- Verify ở server bằng Supabase JWKS: RS256 **và** ES256 (đã sửa 11/11/2026 vì Supabase staging phát hành JWT ES256), kiểm tra `iss`/`aud`/`exp`; JWKS cache; từ chối alg khác (`none`/`HS256`). JWT hết hạn/sai chữ ký/sai issuer → `401 unauthorized`, không đọc claim nào trong token đó.
- Phân quyền sau verify: lấy `role` từ DB (`user_roles` là nguồn sự thật; `profiles.role` là cache) — student chỉ dữ liệu của mình; instructor thêm khóa phụ trách; admin toàn quyền.
- Route không có trong router → `404 not_found` ("Không tìm thấy đường dẫn này.").
- Lỗi không xử lý được → `500 server_error` ("Hệ thống đang bận. Vui lòng thử lại sau.").

### 1.3. Mã lỗi (đọc từ `workers/api/src/errors.ts` — `ErrorCode`)

| Mã HTTP | `error` | Ý nghĩa |
|---|---|---|
| 400 | `invalid_phone` | SĐT không đúng `^0\d{9}$` |
| 400 | `invalid_email` | Email không hợp lệ hoặc TLD < 2 ký tự |
| 400 | `invalid_province` | Tỉnh/thành không nằm trong 34 tỉnh |
| 400 | `invalid_course` | `course_id` không tồn tại hoặc chưa published |
| 400 | `invalid_input` | Field khác không hợp lệ (tên, số tiền, tiến độ…) |
| 400 | `spam_suspected` | Honeypot không rỗng hoặc Turnstile không hợp lệ |
| 401 | `unauthorized` | Thiếu JWT, JWT hết hạn, hoặc chữ ký không khớp JWKS |
| 401 | `invalid_token` | Token không hợp lệ (dùng ở một số handler) |
| 403 | `forbidden` | Đã đăng nhập nhưng role không đủ quyền |
| 404 | `not_found` | Không tìm thấy khóa/bài/đơn/sự kiện/route |
| 409 | `conflict` | Trùng lặp nghiệp vụ (vd. đã ghi danh khóa này rồi) |
| 409 | `idempotency_conflict` | Cùng `Idempotency-Key` nhưng body khác |
| 422 | `payment_mismatch` | Webhook: số tiền giao dịch không khớp đơn (sai lệch ≠ 0đ) |
| 429 | `rate_limited` | Vượt rate-limit (kèm header `Retry-After`) |
| 500 | `server_error` | Lỗi server / ghi database thất bại — không trả `ok: true` |
| 502 | `upstream_error` | Dịch vụ ngoài (Supabase, Sheet, Resend) lỗi — không trả `ok: true` |

### 1.4. Idempotency & rate-limit (Worker)

- **Idempotency:** header `Idempotency-Key: <uuid>` cho mọi POST tạo dữ liệu. Lần đầu → `201`; trùng key + cùng body → `200` + `duplicate: true`, không ghi thêm; trùng key + body khác → `409 idempotency_conflict`. Hiệu lực 24 giờ (theo thiết kế). Thanh toán chống trùng thêm bằng UNIQUE `(method, gateway_reference)` trên `payments`.
- **Rate-limit (đọc từ code handler):** leads `5 req/giờ/IP`; progress `100 req/phút/IP` + `300 req/giờ/user`; AI Mentor ask `20 câu/giờ/user`. Vượt → `429` + header `Retry-After`, không ghi dữ liệu. Đếm cả request lỗi validation (trừ 401/403). Backend: KV `RATE_LIMIT_KV` nếu có binding, fallback bộ nhớ trong-process (race qua nhiều isolate có thể vượt nhẹ — UNIQUE ở DB là lớp chặn cuối).
- **Chưa có rate-limit:** các route Next.js (`/api/v1/*`, `/api/admin/*`, `/api/lms/*` trên Pages) — theo SECURITY_REPORT §4.9; đăng nhập dựa vào rate-limit của Supabase Auth.

## 2. Worker API — danh sách route (đọc từ `workers/api/src/index.ts`)

Base: `https://api.visfaracademy.workers.dev`. Tất cả dưới `/api/v1` trừ 2 trường hợp ghi rõ.

### 2.1. Health (công khai)

| Method + Path | Auth | Mô tả / Response |
|---|---|---|
| `GET /api/health` và `GET /api/v1/health` | Không | Kiểm tra API sống. Live 200: `{"ok":true,"status":"ok","latency_ms":<số>}`. 503 `not_configured` khi thiếu biến môi trường; 503 `supabase_error` khi Supabase lỗi/tạm dừng. Dùng cho cron giữ ấm. |

### 2.2. Leads (công khai)

| Method + Path | Auth | Mô tả |
|---|---|---|
| `POST /api/v1/leads` | Không (rate-limit 5/giờ/IP) | Tạo lead tư vấn. Body: `fullName` (2–100 ký tự), `phone` (`^0\d{9}$`), `email` (TLD ≥ 2), `province` (34 tỉnh), `courseId` (uuid hoặc null), `source`, `turnstileToken`, `honeypot` (phải rỗng). Luồng: validate → chống spam → chống trùng → ghi `leads` → ghi Sheet qua Apps Script → gửi email E3/E4. Thành công lần đầu `201 { ok:true, referenceCode: "VISFAR-YYYY-NNNNNN", message }`; trùng key `200 { ok:true, referenceCode, duplicate:true }`; lỗi `400/409/429` (không ghi). **Đã kiểm chứng live 11/11/2026** (201 → 200 → 409, mã `VISFAR-2026-708302`). |

### 2.3. Progress (học viên)

| Method + Path | Auth | Mô tả |
|---|---|---|
| `POST /api/v1/progress` | JWT | Lưu tiến độ học. Body: `lesson_id`, `progress_percent` (0–100), `last_position_sec`. Server kiểm tra enrollment còn `active` + ngưỡng hợp lý theo `video_duration_sec` (không cho nhảy 0% → 100% trong 1 giây); trigger DB chặn `completed` khi < 90%. S-12: request đầu tiên khai 90% ngay từ đầu vẫn được chấp nhận (chưa có baseline). |

### 2.4. Orders & thanh toán (học viên + admin)

| Method + Path | Auth | Mô tả |
|---|---|---|
| `POST /api/v1/orders` | JWT + Idempotency-Key | Tạo đơn. Body: `course_id`, `custom_amount_vnd` (nếu Tùy tâm — chỉ khi khóa `is_pay_what_you_want=true`, ngược lại 400). Trả `reference_code` (`DH-YYYY-NNNNNN`, nội dung chuyển khoản) + hạn giữ chỗ +48h. |
| `GET /api/v1/orders/:id` | JWT + chủ đơn | Chi tiết đơn của mình (trạng thái, số tiền, hạn giữ chỗ). |
| `POST /api/v1/orders/:id/cancel` | JWT + chủ đơn | Hủy đơn `pending` của mình. |
| `POST /api/v1/my/orders/:id/refund-request` | JWT + chủ đơn | Học viên yêu cầu hoàn trả (admin xử lý thủ công; khung hoàn trả 15 ngày làm việc). |
| `GET /api/v1/my/orders` | JWT | Đơn hàng của tôi (phân trang). |
| `GET /api/v1/my/transactions` | JWT | Giao dịch/ví của tôi (đọc `wallet_transactions` + `payments` của mình — chi tiết xem handler `payments.ts`). |
| `POST /api/v1/coupons/validate` | JWT (theo code handler — chưa đối chiếu lại trong đợt này) | Kiểm tra mã giảm giá còn hiệu lực không (trả mức giảm, không trừ lượt dùng). |
| `GET /api/v1/membership-plans` | (công khai theo router — chưa đối chiếu auth trong handler) | Danh sách gói thành viên. |
| `POST /api/v1/my/enrollments` | JWT | Ghi danh khóa miễn phí (body: `course_id`). Khóa trả phí phải qua `/api/v1/orders`. |

### 2.5. Webhook SePay (không JWT — xác minh chữ ký)

| Method + Path | Auth | Mô tả |
|---|---|---|
| `POST /api/v1/webhooks/sepay` và `POST /api/webhooks/sepay` (alias) | Không JWT — HMAC-SHA256 | Header: `X-SePay-Signature: sha256={hex}` + `X-SePay-Timestamp`; chuỗi ký `{timestamp}.{raw_body}`; timing-safe; thiếu secret/chữ ký → 401 fail-closed. Luồng: tìm đơn theo `reference_code` trong nội dung chuyển khoản → kiểm tra số tiền khớp sai lệch 0đ (không khớp → ghi `payments` failed + đưa vào đối soát, không đổi đơn sang `paid`) → chống trùng UNIQUE `(method, gateway_reference)` → tạo `payments` succeeded → đơn `paid` → enrollment → email E8. Không tìm thấy đơn → ghi log + báo cáo đối soát, trả 200 cho SePay (đã nhận) nhưng không đổi trạng thái đơn nào. **Chưa kiểm chứng POST thật** (chưa có đơn thật, chưa đối soát tiền vào). Chi tiết: `docs/payment/SEPAY_INTEGRATION.md` §4. |

### 2.6. Admin — Commerce (Worker, JWT + role admin)

| Method + Path | Mô tả |
|---|---|
| `GET /api/v1/admin/orders` | Danh sách đơn (lọc theo trạng thái/khóa, phân trang). |
| `POST /api/v1/admin/orders/:id/mark-paid` | Xác nhận thanh toán thủ công (body: `amount_vnd`, `note`) — ghi `payments` + đơn `paid` + enrollment + email. Chỉ sau khi admin kiểm tra sao kê. |
| `POST /api/v1/admin/orders/:id/refund` | Hoàn trả: đơn `refunded`, ghi payment `refunded`, thu hồi enrollment (`revoked`), giảm lượt dùng coupon, ghi audit `order.refund`, gửi email E13. **Hoàn tiền thực tế chuyển khoản thủ công** (admin chuyển khoản lại, ghi `refund_bank_reference`). |
| `POST /api/v1/admin/orders/expire-sweep` | Quét đơn `pending` quá hạn (+48h) → `expired`. **Chưa xác minh có cron/scheduler nào gọi route này định kỳ hay không trong đợt này.** |
| `GET /api/v1/admin/coupons` · `POST /api/v1/admin/coupons` · `PATCH /api/v1/admin/coupons/:id` | Quản lý mã giảm giá. |
| `GET /api/v1/admin/membership-plans` · `POST /api/v1/admin/membership-plans` | Quản lý gói thành viên. |
| `GET /api/v1/admin/payments` | Danh sách giao dịch (đối soát). |

### 2.7. Lịch hẹn (Appointments)

| Method + Path | Auth | Mô tả |
|---|---|---|
| `GET /api/v1/appointments` | JWT | Danh sách lịch hẹn (học viên thấy của mình; admin/instructor thấy theo quyền — chi tiết xem handler). |
| `POST /api/v1/appointments` | JWT | Đặt lịch hẹn (body: `instructor_id`, `scheduled_at`, `duration_minutes`, `mode`, `note`). |
| `PATCH /api/v1/appointments/:id` | JWT | Đổi trạng thái lịch hẹn (`pending`/`confirmed`/`cancelled`/`completed`). |

### 2.8. Tiếp thị liên kết & ví (Referrals)

| Method + Path | Auth | Mô tả |
|---|---|---|
| `GET /api/v1/referrals/me` | JWT | Mã giới thiệu của tôi + số dư + lịch sử + người đã giới thiệu. |
| `GET /api/v1/referrals/validate?code=` | Không (công khai) | Kiểm tra mã giới thiệu có tồn tại không. |
| `POST /api/v1/referrals/claim` | JWT | Người mới ghi `referrer` bằng mã giới thiệu. |
| `POST /api/v1/referrals/withdraw` | JWT | Yêu cầu rút tiền (status `pending`; admin xét duyệt và chuyển khoản thủ công trong 15 ngày làm việc). Chi tiết: `docs/payment/referrals-wallet.md`. |

### 2.9. AI Mentor

| Method + Path | Auth | Mô tả |
|---|---|---|
| `POST /api/v1/ai-mentor/ask` | JWT, 20 câu/giờ/user | Body: câu hỏi 2–1000 ký tự (+ `sessionId` tùy chọn). Trả `{ mode, sessionId, answer, sources[{sourceType, sourceSlug, title, url, enrolled?}], suggestions, historySaved }`. `mode` = `smart-search` (hiện tại — không LLM, chưa có key AI) hoặc `llm` (chỉ khi có `OPENAI_API_KEY`; LLM lỗi → rơi về `smart-search`). Kiểm tra enrollment cho chunk course: chưa ghi danh thì chỉ dùng mô tả công khai + ghi chú. Lỗi ghi lịch sử không làm mất câu trả lời (`historySaved:false`). **Trên prod hiện 502 `upstream_error` vì prod chưa có bảng 0029.** |
| `GET /api/v1/ai-mentor/sessions` | JWT | 20 phiên mới nhất của user. |
| `GET /api/v1/ai-mentor/sessions/:id` | JWT | Chi tiết phiên + tối đa 100 tin nhắn (chỉ khi session thuộc về user, không thì 404). |
| `PATCH /api/v1/ai-mentor/messages/:id/feedback` | JWT | Body `{ helpful: boolean }` — chỉ tin nhắn assistant của chính user. |

### 2.10. Email / automation trong Worker (không phải route HTTP công khai)

- `workers/api/src/email/` — templates E1–E13 + Task 11, sender, Svix verify, token hủy đăng ký HMAC 90 ngày, automation rules (`automation-rules.ts`), cron (`automation-cron.ts` — chỉ rule nhắc học E9; **chưa nối `scheduled()` trong `index.ts`** — xem ARCHITECTURE §4).
- `workers/api/src/handlers/course-completion.ts` — logic hoàn thành khóa → chứng chỉ (gọi nội bộ, không phải route HTTP riêng).

## 3. Next.js API — Route Handlers (Pages, `apps/web/src/app/api/`)

Base: `https://visfaracademy.pages.dev/api/...`. Auth: Supabase session (cookie) + `auth.getUser()`; admin qua `requireAdmin()`/`getAdminContext()` (đọc role từ DB, không tin cookie).

### 3.1. LMS guard & tài nguyên

| Method + Path | Mô tả |
|---|---|
| `GET /api/lms/lessons/[lessonId]` | Guard bài học (xem ARCHITECTURE §2.5): đã ghi danh → 200 đủ `content`; chưa ghi danh + bài trả phí → 403 `not-enrolled`; bài xem thử → 200 `previewOnly:true` chỉ `video_url`; chưa đăng nhập (không cookie) → 503 "Chưa cấu hình Supabase" (hành vi có sẵn từ trước, chưa sửa). |
| `GET /api/health` | Health của web (khác Worker `/api/health`). |
| `GET /api/v1/resources/[id]/download` | Tải tài liệu bài học (kiểm tra enrollment; signed URL). |

### 3.2. Quiz / Assignment / Certificate (Next.js)

| Method + Path | Mô tả |
|---|---|
| `GET /api/v1/quizzes/[quizId]` | Lấy câu hỏi quiz (**không kèm `is_correct`**). |
| `GET /api/v1/quizzes/[quizId]/attempts` | Lịch sử làm bài của mình. |
| `POST /api/v1/quizzes/[quizId]/submit` | Nộp quiz — chấm ở server qua RPC `submit_quiz_attempt` (SECURITY DEFINER), ghi `quiz_attempts` + `quiz_answers`, trả điểm + đáp án đúng chỉ sau khi nộp. |
| `GET /api/v1/assignments` · `GET /api/v1/assignments/[id]` | Danh sách / chi tiết bài tập. |
| `POST /api/v1/assignments/[id]/upload` | Nộp bài tập (đuôi cho phép pdf/doc/docx/txt/md/png/jpg/jpeg, 10 MB/file, tối đa 5 file; bucket private `submissions`). |
| `GET /api/v1/assignments/[id]/submissions` · `POST /api/v1/assignments/[id]/submissions/[submissionId]/reviews` | Xem bài nộp / chấm bài (instructor/admin). |
| `GET /api/v1/assignments/[id]/files/[fileId]/download` | Tải file bài nộp (kiểm tra quyền: chủ bài / instructor / admin). |
| `GET /api/v1/certificates/verify` | Tra cứu chứng chỉ công khai qua RPC `verify_certificate` (mã `VISFAR-CERT-YYYY-NNNNNN`, chỉ trả 6 trường). |

### 3.3. Admin (Next.js, `/api/admin/*` — JWT + role admin)

| Nhóm route | Mô tả |
|---|---|
| `GET/POST /api/admin/courses` · `GET/PATCH /api/admin/courses/[courseId]` · `POST /api/admin/courses/[courseId]/modules` · `POST /api/admin/courses/[courseId]/reorder` · `GET/POST/DELETE /api/admin/courses/[courseId]/instructors` (+ `[userId]`) | Quản lý khóa học, module, thứ tự, giảng viên phụ trách. |
| `GET /api/admin/users` · `GET/PATCH /api/admin/users/[id]` | Quản lý học viên (đổi role, vô hiệu hóa — `setUserDisabled` cấm tự disable chính mình, lý do bắt buộc, ghi audit). |
| `GET /api/admin/leads/[leadId]/status` · `.../interactions` | Đổi trạng thái lead (`new`/`contacted`/`enrolled`/`closed`/`spam`), ghi tương tác chăm sóc. |
| `GET/POST /api/admin/enrollments` · `PATCH /api/admin/enrollments/[id]` | Tặng/thu hồi khóa học (tặng bắt buộc ghi audit `enrollment.grant`). |
| `GET/PATCH /api/admin/lessons/[lessonId]` · `.../lessons/[lessonId]/resources` · `GET/PATCH /api/admin/modules/[moduleId]` (+ `/lessons`) · `.../resources/[resourceId]` | Quản lý bài học, module, tài liệu đính kèm. |
| `GET/POST /api/admin/library` · `GET/PATCH/DELETE /api/admin/library/[id]` | Đăng/sửa/xóa bài Thư viện Master (audit `library.create/update/delete`); ảnh bìa hiện chỉ dán link, chưa hỗ trợ tải file. |
| `POST /api/admin/certificates/issue` · `POST /api/admin/certificates/[id]/revoke` | Cấp / thu hồi chứng chỉ (chỉ API route — **chưa có trang UI admin riêng** cho chứng chỉ trong đợt này). |

**Lưu ý:** một số lib admin (`admin-users.ts`, `crm.ts`, `lms-admin.ts` — vd. `refundOrder()`) từng chưa có route gọi (S-14); sau Task 09–10 phần lớn đã được nối — rà lại từng lib trước khi dùng làm tham chiếu.

## 4. Supabase trực tiếp (không qua Worker/Next.js API)

- Đọc công khai bằng anon key + RLS: `courses` (published), `posts`, `events`, `policies`, `master_library_items` (staging), view `lessons_public` / `lessons_preview_video` / `question_options_public`, `assessment_aggregates_11d` (authenticated).
- Auth: Supabase Auth REST (`/auth/v1/*`: đăng ký/đăng nhập/quên/đặt lại mật khẩu, refresh token) — gọi trực tiếp từ frontend qua supabase-js, không qua Worker.
- **Không** ghi trực tiếp vào bảng nhạy cảm bằng anon key (RLS chặn: `leads`/`orders`/`payments`/`enrollments`/`lesson_progress`/`quiz_attempts` không có policy INSERT/UPDATE cho client).

## 5. Route đã thiết kế nhưng CHƯA CÓ trong code (đối chiếu router thật 11/11/2026)

| Route (thiết kế Task 02) | Trạng thái thật |
|---|---|
| `POST /api/webhooks/resend` | **Chưa có route.** Code verify Svix đã có (`src/email/svix.ts`, `webhook.ts`) nhưng router chưa gọi. |
| `POST /api/newsletter` / `POST /api/newsletter/unsubscribe` | **Không tìm thấy route** trong Worker `index.ts` lẫn Next.js `app/api/` trong đợt này. Form newsletter footer đã làm thật theo QĐ 6 — đường ghi thật của nó chưa được đối chiếu trong đợt này, cần kiểm tra lại trước khi ghi vào hướng dẫn vận hành. |
| `GET /api/courses`, `GET /api/posts`, `GET /api/events`, `GET /api/policies/:slug` (Worker) | **Không có trong Worker router.** Nội dung công khai đọc trực tiếp qua Supabase (xem §4), không qua Worker. |
| `GET /api/me` | **Không có trong Worker router** (theo `index.ts`). Profile lấy qua Supabase client (`getMyProfileState` trong `apps/web/src/lib/auth.ts`). |
| `GET /api/admin/reports/*`, `GET /api/admin/audit-logs` | **Không có route báo cáo trong Worker.** Báo cáo hiện đọc trực tiếp Supabase bằng JWT admin (dashboard); trang `/admin/audit-logs` tồn tại (xem ADMIN_GUIDE). |
| `POST /api/webhooks/stripe` | Chưa triển khai (Stripe chưa được phê duyệt). |
| `POST /api/v1/admin/orders/expire-sweep` | Có route, nhưng **chưa xác minh có cron/scheduler nào gọi định kỳ**. |

## 6. Biến môi trường (chỉ tên — không giá trị)

**Worker (`wrangler secret put <tên>` / `.dev.vars`):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APPS_SCRIPT_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (chưa set có chủ đích — Resend "Dùng tạm"), `RESEND_FROM` (tên cũ), `RESEND_WEBHOOK_SECRET`, `UNSUBSCRIBE_SECRET`, `ADMIN_NOTIFY_EMAIL` (mặc định `visfaracademy@gmail.com`), `ALERT_EMAIL` (alias cũ), `TURNSTILE_SECRET` (chưa có), `SEPAY_WEBHOOK_SECRET` (đã set), `SEPAY_API_TOKEN` (chưa set), `SEPAY_BANK_ACCOUNT_ID` (chưa set), `SEPAY_MERCHANT_ID` (chưa set), `OPENAI_API_KEY` (chưa có), `GEMINI_API_KEY` (chưa có adapter), `ALLOWED_ORIGINS`, `RATE_LIMIT_KV` (binding, tùy chọn, chưa tạo).

**Đã xác minh bằng `wrangler secret list` (chỉ tên, 11/11/2026):** có 5 secret — `APPS_SCRIPT_URL`, `RESEND_API_KEY`, `SEPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. Không có: `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `TURNSTILE_SECRET`, `UNSUBSCRIBE_SECRET`, `SEPAY_API_TOKEN`, `SEPAY_BANK_ACCOUNT_ID`, `SEPAY_MERCHANT_ID`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

**Pages (Dashboard > Settings > Environment variables):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL` (xem `apps/web/.env.example` — chỉ tên + giá trị mẫu giả).

## 7. Tài liệu API cũ (đọc thêm, đã lỗi thời ở một số điểm)

- `docs/architecture/API_ARCHITECTURE.md` — đặc tả Task 02 (thiết kế, chưa code): endpoint `GET /api/courses`… chưa từng được triển khai trên Worker; tiền tố `/api/v1` nay đã chốt; domain API nay là `*.workers.dev`, chưa có domain riêng.
- `docs/payment/SEPAY_INTEGRATION.md` — đặc tả SePay đầy đủ (API v2, webhook §4, đối soát §6, hoàn tiền §7).
- `workers/api/README.md` — hướng dẫn chạy/deploy Worker.
- `docs/supabase/ENVIRONMENT_CONFIG.md` — cấu hình biến môi trường Supabase.
