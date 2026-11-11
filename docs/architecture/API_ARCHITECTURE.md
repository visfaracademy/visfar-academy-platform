# Kiến trúc API — Nền tảng Visfar Academy (TASK 02)

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt kiến trúc
**Phạm vi:** Chỉ đặc tả kiến trúc. **Chưa viết code, chưa tạo database, chưa deploy.** Không sửa code/file HTML gốc, không thay đổi schema.
**Tài liệu nguồn:** `Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (§1, §6, §7, §8, §10) và `docs/DECISIONS.md` (19 quyết định đã chốt ngày 10/11/2026).
**Stack liên quan (đã chốt):** Frontend Next.js (Quyết định 19) trên Cloudflare Pages · API Cloudflare Workers · PostgreSQL + Auth trên Supabase · Email Resend · Thanh toán SePay khi được phê duyệt triển khai (Quyết định 15).

---

## 1. Nguyên tắc

1. **API là lớp trước, database là nguồn sự thật.** Mọi ghi nhạy cảm (lead, đơn hàng, tiến độ, quiz, thanh toán) đi qua Workers API. Client không bao giờ ghi trực tiếp vào bảng nhạy cảm bằng anon key. Google Sheet chỉ là bản sao đối soát, không phải database chính (xem §9 về luồng lead).
2. **Không tin client.** Mọi validation, phân quyền và chấm điểm đều làm lại ở server, dù client đã kiểm tra.
3. **Không có “thành công giả”.** API chỉ trả `ok: true` khi ghi đã được xác nhận. Không có nhánh fallback trả thành công khi ghi thất bại (xem §9.4 và mục lưu ý về Quyết định 3 ở §12).
4. **Bảo mật theo mặc định.** RLS bật trên mọi bảng; API là lớp kiểm tra nghiệp vụ, RLS là lớp chặn cuối ở database. Secret chỉ nằm trong Cloudflare Workers Secrets / GitHub Secrets, không commit vào repo.
5. **0 đồng trước, trả phí chỉ khi được phê duyệt.** SePay/Stripe, nâng gói Supabase/Workers/Resend đều cần phê duyệt riêng trước khi triển khai (Quyết định 15, 18).

## 2. Base URL và môi trường

| Môi trường | Base URL | Ghi chú |
|---|---|---|
| Production | `https://api.visfaracademy.vn` | Custom domain trên Cloudflare Workers — cần phê duyệt domain |
| Dev / staging | `https://<tên-worker>.workers.dev` | Tạm thời trong giai đoạn dev, cho tới khi domain production được phê duyệt |

- Mọi endpoint đều dưới `/api/...` (theo tài liệu kiến trúc tổng thể §7; chưa có tiền tố phiên bản — xem “Quyết định cần phê duyệt” ở §12).
- Chỉ dùng HTTPS. Mọi response là JSON (`Content-Type: application/json`).
- Frontend gọi API qua `api-client` kèm JWT (xem §3); nội dung công khai (khóa học, bài viết, sự kiện) được đọc trực tiếp qua Supabase bằng anon key + RLS cho phép đọc công khai, để giảm tải Workers (giới hạn miễn phí 100.000 request/ngày).

## 3. Xác thực (Auth) — JWT Supabase Auth

- **Nguồn JWT duy nhất:** Supabase Auth (đăng ký / đăng nhập / quên mật khẩu qua Supabase, không tự viết hệ thống auth riêng).
- **Cách gọi:** endpoint cần đăng nhập yêu cầu header `Authorization: Bearer <Supabase JWT>`.
- **Xác minh ở server — không tin JWT client tự khai:**
  - Workers xác minh chữ ký JWT bằng **Supabase JWKS** (JSON Web Key Set) lấy từ Supabase Auth, kèm kiểm tra `iss` (issuer), `aud` (audience) và thời gian hết hạn (`exp`).
  - JWKS được cache ở Workers (có TTL) để không fetch lại mỗi request; khi key xoay, cache hết hạn thì fetch lại.
  - JWT hết hạn → client dùng refresh token để lấy JWT mới qua Supabase Auth; API trả `401` với mã lỗi `unauthorized`, không tự gia hạn token.
  - JWT giả, hết hạn, sai issuer/audience, hoặc chữ ký không khớp JWKS → từ chối `401`, không đọc bất kỳ claim nào trong token đó để phân quyền.
- **Phân quyền (RBAC):** sau khi xác minh JWT, API lấy `role` từ bảng `profiles` (theo `user_id` trong token) và kiểm tra quyền theo ma trận ở tài liệu kiến trúc tổng thể §5:
  - `student` — chỉ dữ liệu của mình (enrollment, đơn, tiến độ, chứng chỉ của mình).
  - `instructor` — thêm quyền xem tiến độ và sửa bài học của khóa mình phụ trách; không xem lead, không sửa giá/đơn hàng.
  - `admin` — toàn quyền quản lý (lead, đơn, thanh toán, khóa học, học viên, báo cáo, cấp role).
  - Không có role `superadmin` riêng trong giai đoạn đầu; `admin` là cao nhất.
- **Kiểm tra quyền ở 2 lớp:** RLS ở database + kiểm tra role/nghiệp vụ ở Workers API. Chỉ kiểm tra ở 1 lớp là không đủ.
- **Endpoint xác thực:**
  - `GET /api/me` — lấy profile + role của user hiện tại (cần JWT).
  - `GET /api/health` — kiểm tra API sống (công khai, không cần JWT; dùng cho cron “giữ ấm” Supabase — tránh project tạm dừng sau 7 ngày không hoạt động).

## 4. Idempotency — chống ghi trùng

- **Header:** `Idempotency-Key: <uuid>` — UUID do client sinh cho mỗi lần gửi, gửi kèm mọi `POST` tạo dữ liệu (lead, order, quiz submit, đăng ký sự kiện).
- **Cách hoạt động:**
  1. Server lưu key cùng kết quả của lần ghi đầu tiên (bảng `leads.idempotency_key` có UNIQUE; tương tự cho order/quiz — key + phạm vi endpoint/user).
  2. Request lặp lại với cùng key (người dùng bấm gửi 2 lần, mạng retry, webhook gửi lại) → server **không ghi thêm**, trả lại kết quả cũ với cờ `duplicate: true` và HTTP `200` (thay vì `201` của lần đầu).
  3. Cùng key nhưng body khác → từ chối `409` (`idempotency_conflict`), không ghi.
- **Phạm vi key:** key có hiệu lực trong 24 giờ; sau đó key cũ có thể được dọn (quyết định dọn dẹp cụ thể khi lập trình).
- **Thanh toán:** chống trùng ở tầng gateway bằng UNIQUE (`method`, `gateway_reference`) trên bảng `payments` — webhook SePay gửi lại cùng giao dịch không tạo payment trùng (xem §10.1).
- **Không dùng idempotency để che lỗi:** nếu lần ghi đầu tiên thất bại (validation lỗi, Sheet/DB lỗi), key không được coi là “đã xong”; client retry với cùng key phải được xử lý lại, không trả thành công giả (xem §9.4).

## 5. Rate-limit

Áp theo IP, cộng thêm theo user (khi đã đăng nhập) đối với endpoint nhạy cảm. Vượt giới hạn → HTTP `429` với body lỗi thống nhất (xem §7), kèm header `Retry-After` (số giây chờ), và **không ghi dữ liệu**.

| Nhóm endpoint | Giới hạn |
|---|---|
| Tạo lead — `POST /api/leads` | **5 request/giờ/IP** |
| Đăng nhập — qua Supabase Auth (`/auth/signin`) | **10 lần/15 phút/IP** (ghi chú: giới hạn áp ở tầng API/edge trước Supabase Auth; con số chốt theo tài liệu kiến trúc tổng thể §6.3) |
| Đăng ký nhận tin — `POST /api/newsletter` | 5 request/giờ/IP |
| Hủy nhận tin — `POST /api/newsletter/unsubscribe` | 10 request/giờ/IP |
| Endpoint công khai (đọc: khóa học, bài viết, sự kiện, chính sách) | **100 request/phút/IP** |
| Endpoint học viên / đơn hàng (cần JWT) | 100 request/phút/IP + giới hạn theo user (con số theo user chốt khi lập trình — xem §12) |
| Webhook (SePay, Resend) | Không rate-limit theo IP công khai (xác minh bằng chữ ký thay cho rate-limit — xem §10); giới hạn chống flood ở tầng edge nếu cần |

- Rate-limit đếm cả request lỗi validation (trừ lỗi `401`/`403` do sai auth) để chống dò.
- Khi chạm giới hạn, response lỗi dùng mã `rate_limited` (xem §7).

## 6. Validation ở server

Mọi field đều validate lại ở Workers — không tin validation ở client. Validation client và server dùng cùng một bộ quy tắc.

| Field | Quy tắc server |
|---|---|
| Họ tên (`fullName`) | 2–100 ký tự, không chứa ký tự điều khiển |
| SĐT (`phone`) | `^0\d{9}$` — 10 số, bắt đầu bằng 0; lưu dạng text để giữ số 0 đầu |
| Email (`email`) | Định dạng email hợp lệ, **TLD ≥ 2 ký tự**: `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` (đồng bộ client/server) |
| Tỉnh/thành (`province`) | Phải nằm trong whitelist **34 tỉnh/thành** (danh sách dùng chung ở `packages/shared/constants.ts`) |
| Khóa quan tâm (`courseId`) | Phải tồn tại và `status = 'published'`; được phép `null` (“Chưa biết bắt đầu từ đâu”) |
| Số tiền tùy tâm (`custom_amount_vnd`) | Integer, ≥ 0 (nếu có); số tiền đơn `amount_vnd` là integer VND, không dùng float cho tiền |
| Tiến độ (`progress_percent`) | Integer 0–100; server kiểm tra enrollment còn `active` và ngưỡng hợp lý theo `video_duration_sec` (không cho nhảy 0% → 100% trong 1 giây) |
| Đáp án quiz | Chỉ nhận đáp án đã chọn; **đáp án đúng (`is_correct`) không bao giờ đi từ client lên, cũng không bao giờ trả về client trước khi nộp** — chấm ở server |

- **Chống spam lead (Quyết định 4 — thêm cả hai lớp):**
  - (a) Honeypot field + rate-limit + idempotency: field ẩn phải rỗng, nếu không → `400` (`spam_suspected`), không ghi.
  - (b) CAPTCHA — Cloudflare Turnstile (miễn phí; cần xác minh giới hạn khi triển khai, không giả định): token Turnstile được xác minh ở server trước khi ghi; token sai/hết hạn → `400`, không ghi. Không dùng CAPTCHA trả phí nếu chưa phê duyệt.
- **Dữ liệu nhạy cảm (PII):** không đưa họ tên/SĐT/email vào URL, log, `mailto:` hay clipboard ở tầng API. Log chỉ ghi `reference_code` và `user_id`, không ghi SĐT/email. (Lưu ý: Quyết định 8 giữ nguyên mailto + nút sao chép chứa PII trong hộp xác nhận dự phòng của **trang hiện tại** — đó là quyết định của chủ dự án cho trang cũ, đã được cảnh báo rủi ro; tầng API mới vẫn tuân thủ quy tắc không lộ PII trong log/URL.)

## 7. Định dạng response và mã lỗi

### 7.1. Response thành công

Mọi response thành công đều có `ok: true`:

```json
{ "ok": true, "referenceCode": "VISFAR-2026-000123", "message": "Đã ghi nhận." }
```

### 7.2. Response lỗi — thống nhất

Mọi response lỗi đều có dạng:

```json
{ "ok": false, "error": "ma_loi", "message": "Mô tả tiếng Việt, dễ hiểu với người dùng." }
```

| Mã HTTP | `error` | Ý nghĩa |
|---|---|---|
| 400 | `invalid_phone` | SĐT không đúng định dạng `^0\d{9}$` |
| 400 | `invalid_email` | Email không hợp lệ hoặc TLD < 2 ký tự |
| 400 | `invalid_province` | Tỉnh/thành không nằm trong 34 tỉnh |
| 400 | `invalid_course` | `course_id` không tồn tại hoặc chưa published |
| 400 | `invalid_input` | Field khác không hợp lệ (tên, số tiền, tiến độ…) |
| 400 | `spam_suspected` | Honeypot không rỗng hoặc Turnstile không hợp lệ |
| 401 | `unauthorized` | Thiếu JWT, JWT hết hạn, hoặc chữ ký không khớp JWKS |
| 403 | `forbidden` | Đã đăng nhập nhưng role không đủ quyền (VD học viên xem lead) |
| 404 | `not_found` | Không tìm thấy khóa/bài/đơn/sự kiện |
| 409 | `conflict` | Trùng lặp nghiệp vụ (VD đã ghi danh khóa này rồi) |
| 409 | `idempotency_conflict` | Cùng `Idempotency-Key` nhưng body khác |
| 422 | `payment_mismatch` | Webhook: số tiền trong giao dịch không khớp đơn (sai lệch ≠ 0đ) |
| 429 | `rate_limited` | Vượt rate-limit (kèm header `Retry-After`) |
| 500 | `server_error` | Lỗi server / ghi database hoặc Sheet thất bại — **không trả `ok: true`** |
| 502 | `upstream_error` | Dịch vụ ngoài (Supabase, Sheet, Resend) lỗi — **không trả `ok: true`** |

- `message` luôn là tiếng Việt, không lộ chi tiết kỹ thuật hay secret. Chi tiết lỗi kỹ thuật chỉ ghi vào log server (không chứa PII).
- Lỗi validation trả về field nào lỗi (qua `error`), để client hiện đúng thông báo tại field đó.

### 7.3. Phân trang

Áp cho mọi endpoint danh sách (khóa học, bài viết, sự kiện, lead, đơn, học viên, báo cáo).

- Query params: `?page=<số trang, mặc định 1>&limit=<số mục/trang, mặc định 20, tối đa 100>`.
- Response thành công kèm khối phân trang:

```json
{
  "ok": true,
  "data": [ "..." ],
  "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

- Lọc theo query param chuẩn: `?status=`, `?q=` (tìm không dấu, như trang hiện tại), `?pillar=`, `?from=&to=` (khoảng thời gian), `?course_id=`, `?source=`. Param lọc không hợp lệ → bỏ qua (không lỗi 400), trừ `page`/`limit` ngoài khoảng thì kẹp về giới hạn.
- Danh sách mặc định sắp xếp mới nhất trước (`created_at DESC`), trừ danh sách khóa học sắp xếp theo `display_order` 01–10 (giữ nguyên thứ tự hiện tại).

## 8. Danh sách endpoint theo nhóm

### 8.1. Public — không cần đăng nhập (rate-limit 100 req/phút/IP, trừ lead/newsletter)

| Method + Path | Mô tả | Auth |
|---|---|---|
| `GET /api/courses` | Danh sách khóa published; lọc `?pillar=`, `?q=`; phân trang | Không |
| `GET /api/courses/:slug` | Chi tiết 1 khóa (không kèm đáp án quiz, không kèm video URL của bài không xem thử) | Không |
| `GET /api/posts` | Danh sách bài blog published; phân trang | Không |
| `GET /api/posts/:slug` | 1 bài blog đầy đủ | Không |
| `GET /api/events` | Sự kiện `upcoming` + `happened`; phân trang | Không |
| `GET /api/events/:slug` | Chi tiết 1 sự kiện | Không |
| `GET /api/policies/:slug` | Chính sách bản hiện tại (`is_current`) | Không |
| `POST /api/leads` | Tạo lead tư vấn — đặc tả chi tiết ở §9 | Không — 5 req/giờ/IP |
| `POST /api/newsletter` | Đăng ký nhận tin (ghi `newsletter_subscribers`) | Không — 5 req/giờ/IP |
| `POST /api/newsletter/unsubscribe` | Hủy nhận tin (token trong email) | Không — 10 req/giờ/IP |
| `GET /api/health` | Kiểm tra API sống (cho cron giữ ấm) | Không |

### 8.2. Auth & hồ sơ

| Method + Path | Mô tả | Auth |
|---|---|---|
| `POST /auth/signup` (Supabase) | Đăng ký bằng email + mật khẩu; tạo `profiles` qua trigger | Không |
| `POST /auth/signin` (Supabase) | Đăng nhập, trả JWT (rate-limit 10 lần/15 phút/IP) | Không |
| `POST /auth/signout` (Supabase) | Đăng xuất | JWT |
| `POST /auth/reset-password` (Supabase) | Gửi email đặt lại mật khẩu (qua Resend + Supabase SMTP) | Không |
| `GET /api/me` | Profile + role của user hiện tại | JWT |

### 8.3. Student — cần JWT, role `student` trở lên

| Method + Path | Mô tả | Auth |
|---|---|---|
| `GET /api/my/enrollments` | Khóa tôi đã ghi danh + % hoàn thành | JWT (student+) |
| `POST /api/my/enrollments` | Ghi danh khóa miễn phí (body: `course_id`) — khóa trả phí phải qua `/api/orders` | JWT (student+) |
| `GET /api/my/courses/:slug/lessons` | Danh sách bài học của khóa đã ghi danh (kèm video URL, file URL signed — hết hạn sau 1 giờ) | JWT + đã ghi danh |
| `GET /api/my/lessons/:lessonId` | Chi tiết 1 bài học (chỉ khi đã ghi danh hoặc `is_free_preview`) | JWT + đã ghi danh / xem thử |
| `POST /api/my/progress` | Cập nhật tiến độ (body: `lesson_id`, `progress_percent`, `last_position_sec`) — server kiểm tra enrollment + ngưỡng hợp lý | JWT (student+) |
| `POST /api/my/progress/complete` | Đánh dấu hoàn thành 1 bài; đủ 100% bài trong module/khóa → enrollment `completed` + tạo certificate (ngưỡng: video ≥ 90%, bài text bấm “Đã hoàn thành” — Quyết định 17) | JWT (student+) |
| `GET /api/my/quiz/:lessonId` | Lấy câu hỏi quiz (**không kèm `is_correct`**) | JWT + đã ghi danh |
| `POST /api/my/quiz/:lessonId/submit` | Nộp quiz (body: đáp án) — chấm ở server, trả điểm, lưu `quiz_attempts` | JWT (student+) + Idempotency-Key |
| `GET /api/my/certificates` | Chứng chỉ của tôi | JWT (student+) |
| `GET /api/my/orders` | Đơn hàng của tôi; phân trang | JWT (student+) |
| `PATCH /api/my/profile` | Sửa hồ sơ của mình (tên, SĐT, tỉnh — validate lại ở server theo §6) | JWT (student+) |

### 8.4. Orders & thanh toán — cần JWT (trừ webhook)

| Method + Path | Mô tả | Auth |
|---|---|---|
| `POST /api/orders` | Tạo đơn (body: `course_id`, `custom_amount_vnd` nếu Tùy tâm) — trả `reference_code` (nội dung chuyển khoản) + QR VietQR + hạn giữ chỗ 48h | JWT (student+) + Idempotency-Key |
| `GET /api/orders/:id` | Chi tiết đơn của mình (trạng thái, số tiền, hạn giữ chỗ) | JWT + chủ đơn |
| `POST /api/orders/:id/cancel` | Hủy đơn `pending` của mình | JWT + chủ đơn |
| `POST /api/webhooks/sepay` | Webhook SePay — xem §10.1 | Không JWT — **xác minh chữ ký** |
| `POST /api/webhooks/stripe` | Webhook Stripe (khi dùng Stripe — cần phê duyệt riêng) — xem §10.3 | Không JWT — **xác minh chữ ký Stripe** |
| `POST /api/webhooks/resend` | Webhook trạng thái email Resend — xem §10.2 | Không JWT — **xác minh chữ ký Resend/Svix** |

### 8.5. Admin — cần JWT, role `admin`

| Method + Path | Mô tả | Auth |
|---|---|---|
| `GET /api/admin/leads` | Danh sách lead; lọc `?status=&q=&from=&to=`; phân trang | JWT (admin) |
| `PATCH /api/admin/leads/:id` | Đổi trạng thái (`new/contacted/enrolled/closed/spam`) / ghi chú lead | JWT (admin) |
| `GET /api/admin/orders` | Danh sách đơn; lọc theo trạng thái/khóa; phân trang | JWT (admin) |
| `POST /api/admin/orders/:id/mark-paid` | Xác nhận thanh toán thủ công (body: `amount_vnd`, `note`) — ghi `payments` + đổi đơn sang `paid` + tạo enrollment + gửi email | JWT (admin) |
| `POST /api/admin/orders/:id/refund` | Hoàn trả theo chính sách (hoàn trả 15 ngày làm việc — Quyết định 9); đổi đơn sang `refunded`, ghi payment `refunded`, thu hồi enrollment (`revoked`), gửi email | JWT (admin) |
| `GET /api/admin/users` | Danh sách học viên; phân trang | JWT (admin) |
| `PATCH /api/admin/users/:id/role` | Cấp/thu hồi role (`student`/`instructor`/`admin`) | JWT (admin) |
| `POST /api/admin/courses` / `PATCH /api/admin/courses/:id` | Tạo/sửa khóa học | JWT (admin) |
| `POST /api/admin/lessons` / `PATCH /api/admin/lessons/:id` | Tạo/sửa bài học (slug bài UNIQUE theo module — Quyết định 17) | JWT (admin) |
| `GET /api/admin/reports/overview` | Tổng quan: học viên, lead, đơn, doanh thu, tỷ lệ lead→đơn | JWT (admin) |
| `GET /api/admin/reports/leads` | Lead theo thời gian / nguồn / khóa / tỉnh | JWT (admin) |
| `GET /api/admin/reports/courses` | Học viên theo khóa, % hoàn thành, chứng chỉ | JWT (admin) |
| `GET /api/admin/reports/revenue` | Doanh thu theo ngày/tuần/tháng, theo khóa, theo phương thức; đơn pending quá hạn; hoàn trả | JWT (admin) |
| `GET /api/admin/reports/progress` | % hoàn thành trung bình/khóa; học viên không học 7/14/30 ngày | JWT (admin) |
| `GET /api/admin/reports/quiz` | Điểm trung bình/bài; câu hỏi nhiều người sai nhất | JWT (admin) |
| `GET /api/admin/reports/events` | Số đăng ký/sự kiện; tỷ lệ tham dự (nếu có điểm danh) | JWT (admin) |
| `GET /api/admin/reports/email` | Email gửi/delivered/bounced/failed theo template; số lần chạm giới hạn Resend | JWT (admin) |
| `GET /api/admin/reports/reconciliation` | Đối soát: đơn `pending` quá 48h; đơn `paid` chưa có enrollment; payment không khớp order; webhook lỗi | JWT (admin) |
| `GET /api/admin/reports/growth` | Học viên mới/tuần, MAU, retention 7/30 ngày | JWT (admin) |
| `GET /api/admin/audit-logs` | Nhật ký thao tác admin; phân trang | JWT (admin) |

Mọi thao tác admin đổi dữ liệu đều ghi vào `audit_logs` (`actor_id`, `action`, `target_type`, `target_id`, `details`).

## 9. Đặc tả chi tiết — `POST /api/leads`

Đây là endpoint thay thế form → Apps Script → Sheet hiện tại, sửa các lỗi đã ghi trong báo cáo Task 01: không có mã tham chiếu, ghi trùng, không validation server, không chống spam, và nhánh fallback “thành công giả”.

### 9.1. Luồng tổng thể — API làm lớp trước, rồi ghi Sheet

Theo **Quyết định 5 (chốt ngày 10/11/2026): API làm lớp trước, rồi ghi Sheet.** API nhận lead → validate / chống spam / chống trùng → ghi vào database (nguồn sự thật) → ghi vào Sheet (bản sao đối soát) → gửi email → trả mã tham chiếu. Sheet không còn là đường ghi duy nhất. Được phép sửa + deploy lại file Apps Script (`.gs`) khi cần cho luồng này.

```
Client (form tư vấn)
  │  POST /api/leads + Idempotency-Key + Turnstile token
  ▼
Workers API
  │  1. Rate-limit (5 req/giờ/IP) → vượt: 429, không ghi
  │  2. Honeypot + Turnstile → nghi spam: 400 spam_suspected, không ghi
  │  3. Validation server (§6) → lỗi: 400 + mã lỗi theo field, không ghi
  │  4. Idempotency-Key trùng → trả lại kết quả cũ (200, duplicate: true), không ghi thêm
  │  5. Ghi bảng leads (PostgreSQL — nguồn sự thật) + sinh reference_code
  │  6. Ghi Sheet (bản sao đối soát) qua Apps Script Web App
  │  7. Gửi email lead-received (Resend, template E3) + lead-notify-admin (E4)
  ▼
Client nhận 201 + referenceCode (chỉ khi bước 5 đã xác nhận)
```

- **Thứ tự bắt buộc:** bước 5 (ghi database) xác nhận xong mới được coi là “đã ghi nhận”. Bước 6 (Sheet) và bước 7 (email) là bước sau: nếu Sheet/email lỗi sau khi database đã ghi xong, API **vẫn trả 201 kèm `referenceCode`** (vì lead đã được ghi nhận thật ở nguồn sự thật), nhưng ghi log lỗi + đưa vào hàng đợi thử lại / báo cáo đối soát (R9), để admin đối soát Sheet sau. Ngược lại, nếu bước 5 thất bại thì **không bao giờ** trả thành công (xem §9.4).
- **Sheet là bản sao, không phải đường ghi chính:** admin đối soát bằng database + báo cáo `GET /api/admin/reports/leads` và `GET /api/admin/reports/reconciliation`; Sheet chỉ để đối chiếu. Khi API lead ổn định, bỏ hẳn việc đọc Sheet làm nguồn dữ liệu.
- **Đồng bộ field với Apps Script:** file `.gs` mới phải nhận đúng các field form hiện tại (họ tên, SĐT, email, tỉnh, khóa quan tâm, nguồn, `reference_code`, `idempotency_key`, thời gian) — không còn trường tuần thai (đã bỏ từ chương trình “Nâng Tầm Tâm Thức & Nhân Hiệu”); sửa + deploy lại `.gs` khi luồng API–Sheet thay đổi.

### 9.2. Request

```
POST /api/leads
Headers:
  Idempotency-Key: <uuid>
  Content-Type: application/json
Body:
{
  "fullName": "Nguyễn Văn A",
  "phone": "0901234567",
  "email": "a@example.com",
  "province": "Hà Nội",
  "courseId": "<uuid hoặc null>",
  "source": "visfar-academy",
  "turnstileToken": "<token Turnstile>",
  "honeypot": ""
}
```

- `source`: `visfar-academy` (mặc định) / `nang-tam` / khác — để báo cáo lead theo nguồn.
- `courseId` = `null` khi người đăng ký chọn “Chưa biết bắt đầu từ đâu”; khi đó lưu `course_interest_text` (tên khóa lúc đăng ký, nếu có) để đối soát dù khóa đổi tên/xóa sau này.
- Không nhận field nào ngoài danh sách trên; field lạ bị bỏ qua (không lỗi), trừ honeypot không rỗng thì coi là spam.

### 9.3. Response

**Thành công lần đầu — `201`:**

```json
{ "ok": true, "referenceCode": "VISFAR-2026-000123", "message": "Đã ghi nhận." }
```

- `referenceCode` là mã duy nhất (`VISFAR-YYYY-NNNNNN`), lưu ở `leads.reference_code` (UNIQUE), dùng để đối soát với người đăng ký và với Sheet.
- Client hiện mã này cho người đăng ký và lưu lại để tra cứu.

**Trùng `Idempotency-Key` — `200`:**

```json
{ "ok": true, "referenceCode": "VISFAR-2026-000123", "duplicate": true }
```

**Lỗi — `400` / `429` (không ghi dữ liệu):**

```json
{ "ok": false, "error": "invalid_phone", "message": "Số điện thoại chưa đúng định dạng." }
```

```json
{ "ok": false, "error": "rate_limited", "message": "Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau." }
```

```json
{ "ok": false, "error": "spam_suspected", "message": "Không thể ghi nhận đăng ký lúc này." }
```

### 9.4. Quy tắc “không thành công giả”

- **API không có nhánh fallback trả `ok: true` khi ghi thất bại.** Nếu ghi database lỗi, ghi Sheet lỗi ở bước bắt buộc, hoặc Resend/Supabase không phản hồi ở bước bắt buộc, API trả `500` (`server_error`) hoặc `502` (`upstream_error`) kèm `message` tiếng Việt — client hiện lỗi và hướng dẫn thử lại, **không hiện màn hình cảm ơn**.
- **Client không được tự hiện “cảm ơn” khi chưa nhận `201`/`200` với `ok: true`.** Chỉ khi nhận đúng response thành công (kèm `referenceCode`) mới hiện xác nhận + mã tham chiếu.
- **Retry an toàn:** client thử lại với cùng `Idempotency-Key` — nếu lần đầu thực ra đã ghi xong, server trả lại kết quả cũ (`duplicate: true`); nếu chưa ghi, server xử lý lại từ đầu. Không sinh key mới cho mỗi lần retry của cùng một lần gửi.
- **Đối soát sau mỗi đăng ký:** vì có bước ghi Sheet/email sau bước ghi database, admin vẫn kiểm tra tab DATA / báo cáo đối soát (R9) sau mỗi đăng ký thật cho tới khi luồng API–Sheet được chứng minh ổn định bằng đăng ký thật (theo đúng bài học từ form “Nâng Tầm Tâm Thức & Nhân Hiệu” hiện tại).
- **Lưu ý về Quyết định 3:** Quyết định 3 giữ nguyên nhánh fallback “thành công giả” trên **trang HTML hiện tại** (không đổi văn bản fallback, không bỏ nhánh) — đó là quyết định của chủ dự án cho trang cũ. **API mới trong tài liệu này không kế thừa nhánh đó:** mọi endpoint mới đều tuân thủ quy tắc trên. Mâu thuẫn giữa “giữ fallback ở trang cũ” và “không thành công giả ở API mới” cần được user xác nhận lại khi chuyển form cũ sang API mới (xem §12).

## 10. Webhook

Webhook không dùng JWT — xác minh bằng **chữ ký** với secret riêng cho từng nhà cung cấp. Webhook không có chữ ký đúng → từ chối `401`/`403`, không xử lý, không ghi dữ liệu. Secret webhook chỉ nằm trong Workers Secrets, không commit vào repo. Payload gốc được lưu vào `payments.gateway_payload` (để đối soát, không chứa secret).

### 10.1. Webhook SePay — `POST /api/webhooks/sepay`

Áp khi SePay được phê duyệt triển khai (Quyết định 15: dùng SePay; ngân hàng **MB Bank**; chủ tài khoản là Công ty TNHH MTV Visfar Holdings — theo ảnh chụp màn hình user gửi ngày 10/11/2026. **Số tài khoản không ghi vào tài liệu này** — chỉ dùng từ ảnh chụp / file QR do user cung cấp khi cần tạo khối thanh toán / VietQR. Có thể sử dụng QR Code cũ; không tự tạo QR mới từ thông tin chưa xác nhận).

Luồng xử lý ở server:

1. **Xác minh chữ ký** webhook SePay bằng secret riêng. Chữ ký sai/thiếu → từ chối, không xử lý.
2. **Tìm đơn:** theo `reference_code` (mã đơn, VD `DH-2026-000123`) trong nội dung chuyển khoản. Không tìm thấy đơn → ghi log + báo cáo đối soát (R9), trả `200` cho SePay (đã nhận webhook) nhưng không đổi trạng thái đơn nào.
3. **Kiểm tra số tiền khớp:** số tiền giao dịch phải khớp `amount_vnd` của đơn — **cho phép sai lệch 0đ, không chấp nhận thiếu/thừa**. Không khớp → ghi `payments` trạng thái `failed` (hoặc bản ghi đối soát), không đổi đơn sang `paid`, đưa vào R9 để admin xử lý tay; trả lỗi `422` (`payment_mismatch`) trong log nội bộ.
4. **Chống trùng:** UNIQUE (`method`, `gateway_reference`) trên `payments` — webhook gửi lại cùng giao dịch SePay không tạo payment trùng; lần gửi lại trả kết quả cũ.
5. **Thành công:** tạo `payments` (`method=sepay`, `status=succeeded`, `paid_at=now()`) → đổi `orders` sang `paid` → tạo `enrollments` → gửi email `order-paid` (E8) → ghi `email_logs`.
6. Chỉ server mới được đổi đơn sang `paid` — qua webhook đã xác minh chữ ký hoặc admin xác nhận thủ công (`POST /api/admin/orders/:id/mark-paid`). **Không bao giờ tin client báo “đã trả”.**

### 10.2. Webhook Resend — `POST /api/webhooks/resend`

Cập nhật trạng thái email trong `email_logs` (để đối soát):

1. **Xác minh chữ ký** Resend/Svix bằng secret riêng. Chữ ký sai/thiếu → từ chối.
2. Theo `resend_id` trong payload, cập nhật `email_logs.status`: `sent` → `delivered` / `bounced` / `failed` (kèm lý do bounce nếu có).
3. `bounced`/`failed` của email giao dịch quan trọng (E3/E5/E8) → đưa vào báo cáo email (R8) để admin biết và liên hệ lại bằng kênh khác.
4. Webhook này chỉ cập nhật trạng thái email — không đổi trạng thái lead/đơn, không tạo dữ liệu nghiệp vụ mới.

### 10.3. Webhook Stripe — `POST /api/webhooks/stripe` (khi được phê duyệt)

- Chỉ triển khai khi user phê duyệt dùng Stripe (thanh toán thẻ quốc tế); cần xác minh Stripe có hỗ trợ tài khoản Việt Nam và phí giao dịch tại thời điểm triển khai.
- Xác minh chữ ký Stripe (Stripe-Signature + endpoint secret) trước khi xử lý; cùng quy tắc chống trùng (`method`, `gateway_reference`), kiểm tra số tiền, tạo payment → đơn `paid` → enrollment → email như §10.1.
- **Chưa triển khai cho tới khi phê duyệt** — không dùng cho tới lúc đó.

## 11. Bảo mật và vận hành API

- **Secret:** Supabase service-role key, Resend API key, webhook secret (SePay/Resend/Stripe), Turnstile secret — chỉ trong Cloudflare Workers Secrets + GitHub Secrets. Chỉ `workers/api` được cầm service-role key; frontend không bao giờ thấy key này. Xoay key khi có người rời đội.
- **PII:** log chỉ ghi `reference_code` và `user_id`, không ghi SĐT/email/họ tên; không đưa PII vào URL, `mailto:`, clipboard ở tầng API (xem §6).
- **Header bảo mật:** Cloudflare Pages đặt CSP, `X-Content-Type-Options`, `Referrer-Policy`; không dùng `innerHTML` với dữ liệu người dùng.
- **Storage:** bucket riêng theo quyền — `public` (poster, ảnh khóa học), `private` (tài liệu bài học — chỉ học viên đã ghi danh mới lấy được signed URL, hết hạn sau 1 giờ).
- **Giới hạn miễn phí ảnh hưởng API (tra cứu 10/11/2026, xác minh lại trước khi triển khai):** Workers Free 100.000 request/ngày (vượt → lỗi 1027) — giảm tải bằng cách đọc nội dung công khai trực tiếp qua Supabase + cache Cloudflare; Resend Free tối đa 100 email/ngày (vượt → `daily_quota_exceeded`) — ưu tiên email giao dịch (E3/E5/E8), xếp hàng email nhắc sang hôm sau; Supabase Free tạm dừng sau 7 ngày không hoạt động — cron giữ ấm gọi `GET /api/health` mỗi ngày. Nâng gói trả phí (Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng — giá tra cứu 10/11/2026) **chỉ khi chạm giới hạn và được phê duyệt** (Quyết định 18).
- **Audit:** mọi thao tác admin đổi dữ liệu ghi `audit_logs`; webhook lỗi và payment không khớp xuất hiện trong báo cáo đối soát R9 để admin xử lý mỗi sáng.

## 12. Quyết định cần phê duyệt

Các mục dưới đây **chưa chốt** — tài liệu này ghi rõ để user phê duyệt trước khi viết code. Không tự ý chọn trong lúc lập trình.

1. **Domain API production** (`api.visfaracademy.vn`): phê duyệt domain và thời điểm chuyển từ `*.workers.dev` sang domain chính thức.
2. **Tiền tố phiên bản API:** giữ `/api/...` như tài liệu kiến trúc tổng thể §7, hay thêm `/api/v1/...` ngay từ đầu để dễ nâng cấp sau này?
3. **Mâu thuẫn Quyết định 3 với quy tắc “không thành công giả” (§9.4):** khi chuyển form cũ sang API mới, có bỏ nhánh fallback “thành công giả” trên trang cũ không, hay giữ fallback ở trang cũ và chỉ áp quy tắc mới cho API? (Quyết định 3 hiện giữ nguyên fallback ở trang cũ.)
4. **CAPTCHA (Turnstile) cho form lead:** Quyết định 4 đã chốt “thêm cả hai” (honeypot + rate-limit + idempotency, và CAPTCHA) — cần phê duyệt vị trí hiển thị Turnstile trên form và xử lý khi Turnstile không tải được (chặn gửi hay cho gửi kèm cảnh báo?).
5. **Rate-limit theo user cho endpoint học viên/đơn hàng:** con số cụ thể (đề xuất: 100 req/phút/IP + 300 req/giờ/user — cần phê duyệt).
6. **SePay:** phê duyệt triển khai SePay (giá, gói, thời điểm) trước khi làm webhook §10.1; tới lúc đó vẫn dùng chuyển khoản thủ công + admin đối soát (`POST /api/admin/orders/:id/mark-paid`, hạn giữ chỗ 48h, nhắc sau 12h/24h).
7. **Stripe:** có dùng Stripe cho thẻ quốc tế hay không, và khi nào (xem §10.3).
8. **Hoàn trả / khiếu nại:** Quyết định 9 đã chốt hoàn trả 15 ngày làm việc, phản hồi khiếu nại 3 ngày — cần phê duyệt các bước còn lại trong khung hoàn trả/khiếu nại (hiện do builder viết) trước khi áp vào endpoint `POST /api/admin/orders/:id/refund`.
9. **`lessons.slug` và ngưỡng hoàn thành:** Quyết định 17 đã chốt slug UNIQUE theo module, ngưỡng video 90% / bài text bấm “Đã hoàn thành”, tính theo module — cần xác nhận lại khi lập trình endpoint progress/quiz, vì tài liệu kiến trúc tổng thể §3.4/§9.3 trước đó còn để ngỏ.
10. **Thời gian hiệu lực và dọn dẹp `Idempotency-Key`:** đề xuất 24 giờ (xem §4) — cần phê duyệt.
11. **Xác minh lại giới hạn miễn phí** (Supabase, Workers, Resend) trên trang pricing chính thức tại thời điểm bắt đầu lập trình — số trong §11 là snapshot tra cứu ngày 10/11/2026, nhà cung cấp có thể thay đổi.

---

*File đặc tả kiến trúc API — TASK 02. Chưa viết code, chưa tạo database, chưa deploy. Mọi thay đổi sau phê duyệt phải cập nhật vào file này và `docs/DECISIONS.md`.*
