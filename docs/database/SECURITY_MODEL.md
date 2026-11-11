# Mô hình bảo mật tổng thể — Nền tảng Visfar Academy

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt
**Phạm vi:** TASK 03 — Visfar Academy. Chỉ là tài liệu đặc tả. **Không triển khai DB, không sửa code.**
**Tài liệu nguồn:**
- `docs/DECISIONS.md` (19 quyết định ngày 10/11/2026 + 16 quyết định Task 02)
- `docs/architecture/ROLE_PERMISSION_MATRIX.md` (2 lớp kiểm tra, ma trận quyền)
- `docs/architecture/API_ARCHITECTURE.md` (§3 JWT, §4 idempotency, §5 rate-limit, §6 validation, §10 webhook, §11 bảo mật/vận hành)
- `Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (§5 RBAC, §6 bảo mật RLS, §8 luồng thanh toán, §9 video)
- `docs/database/RLS_POLICIES.md` (chính sách RLS chi tiết, viết cùng Task 03)

---

## 1. Tổng quan mô hình

Bảo mật của Visfar Academy xây trên 3 nguyên tắc bất di bất dịch (tài liệu kiến trúc tổng thể):

1. **Bảo mật theo mặc định, không theo niềm tin.** RLS bật trên mọi bảng; client không bao giờ chạm trực tiếp vào dữ liệu của người khác.
2. **Không tin client.** Mọi validation, phân quyền và chấm điểm đều làm lại ở server, dù client đã kiểm tra.
3. **Một nguồn sự thật.** PostgreSQL trên Supabase là nguồn sự thật duy nhất; Google Sheet chỉ là bản sao đối soát.

```
Người dùng (guest / student / instructor / admin)
  │  HTTPS (chỉ HTTPS, mọi response JSON)
  ▼
Cloudflare Pages (frontend Next.js — chỉ cầm anon key + JWT)
  │  Đọc công khai: Supabase trực tiếp (anon key + RLS)
  │  Mọi ghi nhạy cảm: Workers API
  ▼
Cloudflare Workers API — LỚP KIỂM TRA NGHIỆP VỤ (lớp 1)
  │  Xác minh JWT (JWKS) → lấy role → validation server
  │  → rate-limit → honeypot + CAPTCHA → idempotency
  │  → service-role (bypass RLS, chỉ sau khi đã xác minh)
  ▼
Supabase PostgreSQL + RLS — LỚP CHẶN CUỐI (lớp 2)
  │  Mặc định từ chối; policy theo vai trò (xem RLS_POLICIES.md)
  ▼
Dịch vụ ngoài: Resend (email) · SePay (thanh toán, MB Bank)
               · Google Sheet (bản sao đối soát) · YouTube unlisted (video)
```

**Quy tắc “không thành công giả”:** API chỉ trả `ok: true` khi ghi đã được xác nhận ở database. Nếu ghi thất bại, API trả `500`/`502`, client hiện lỗi và hướng dẫn thử lại, không hiện màn hình cảm ơn. (Lưu ý: Quyết định 3 giữ nhánh fallback “thành công giả” trên **trang HTML hiện tại** — đó là quyết định của chủ dự án cho trang cũ; API mới không kế thừa nhánh đó. Mâu thuẫn này đã ghi trong `API_ARCHITECTURE.md` §12.3 và cần xác nhận lại khi chuyển form cũ sang API mới.)

---

## 2. Xác thực — Supabase Auth JWT

| Mục | Quy định |
|---|---|
| Nguồn JWT duy nhất | **Supabase Auth** (đăng ký / đăng nhập / quên mật khẩu qua Supabase, không tự viết hệ thống auth riêng). |
| Cách gọi | Endpoint cần đăng nhập yêu cầu header `Authorization: Bearer <Supabase JWT>`. |
| Xác minh ở server | Workers xác minh **chữ ký JWT bằng Supabase JWKS** (JSON Web Key Set), kèm kiểm tra `iss` (issuer), `aud` (audience) và `exp` (hết hạn). **Không tin JWT do client tự khai.** JWT giả, hết hạn, sai issuer/audience, hoặc chữ ký không khớp JWKS → từ chối `401` (`unauthorized`), không đọc bất kỳ claim nào trong token đó để phân quyền. |
| Cache JWKS | JWKS được cache ở Workers (có TTL); khi key xoay, cache hết hạn thì fetch lại. |
| Token hết hạn | Client dùng refresh token để lấy JWT mới qua Supabase Auth; API trả `401`, không tự gia hạn token. |
| Phân quyền (RBAC) | Sau khi xác minh JWT, API lấy `role` từ bảng `profiles` (theo `user_id` trong token) và kiểm tra theo ma trận quyền (`ROLE_PERMISSION_MATRIX.md`): `student` chỉ dữ liệu của mình; `instructor` thêm quyền khóa phụ trách (qua `course_instructors`); `admin` toàn quyền quản lý. Không có role `superadmin` riêng trong giai đoạn đầu. |
| Tạo hồ sơ | Đăng ký qua Supabase Auth tạo `profiles` qua trigger; `profiles.role` mặc định `'student'`. Không role nào tự nâng cấp role của chính mình — chỉ admin cấp/thu hồi role qua `PATCH /api/admin/users/:id/role`, ghi `audit_logs`. |
| Đăng nhập | Rate-limit 10 lần/15 phút/IP (áp ở tầng API/edge trước Supabase Auth). |

---

## 3. Hai lớp kiểm tra — RLS + Workers API

Mọi hành động nhạy cảm phải qua **cả hai lớp**. Một lớp chỉ là chặn cuối, không phải đường ghi chính.

| Lớp | Vai trò | Ví dụ chặn được |
|---|---|---|
| **Lớp 1 — Workers API** (kiểm tra nghiệp vụ) | Xác minh JWT + role, validation server, kiểm tra enrollment còn `active`, chấm quiz ở server, kiểm tra ngưỡng tiến độ hợp lý, chỉ server đổi đơn sang `paid` | Học viên tự chấm quiz điểm 10; tự ghi tiến độ 100%; client tự tạo đơn “đã trả”; spam lead như Apps Script hiện tại |
| **Lớp 2 — RLS ở database** (chặn cuối) | Bật trên mọi bảng, mặc định từ chối; policy theo `user_id = auth.uid()`, `current_role()`, `is_instructor_of(course_id)` | Học viên đọc đơn/progress của người khác qua Supabase trực tiếp; anon INSERT vào `leads`/`orders`/`payments`; giảng viên sửa giá khóa / xem lead |

Chi tiết policy từng bảng: xem `docs/database/RLS_POLICIES.md` (§3 bảng policy đầy đủ, §7 SQL mẫu). Các điểm then chốt:

- **Anon key chỉ đọc nội dung công khai** (khóa `published`, blog `published`, sự kiện `upcoming`/`happened`, chính sách bản `is_current`). Không bao giờ được `INSERT`/`UPDATE`/`DELETE` vào bảng nhạy cảm.
- **Service-role key chỉ ở Workers API, không bao giờ ở frontend.** Service-role bypass RLS — chỉ dùng khi Workers đã xác minh JWT + role + nghiệp vụ.
- **Đáp án đúng không lộ:** client không `SELECT` trực tiếp `question_options` (tên Module 1: `quiz_options`); chỉ đọc view `quiz_options_public` (không có `is_correct`); chỉ service-role đọc `is_correct` để chấm; ngoại lệ duy nhất là giảng viên khóa phụ trách (Task 02 QĐ 6). Bảng `answers` chỉ lưu đáp án học viên đã chọn, không phải đáp án đúng.
- **Enrollment không tự cấp:** không có policy `INSERT` nào trên `enrollments` cho client; enrollment chỉ tạo qua API sau khi đơn `paid`, khóa miễn phí, hoặc admin tặng kèm `audit_logs` (xem `RLS_POLICIES.md` §5).
- **Không hard-delete dữ liệu nghiệp vụ:** `DELETE` bị cấm ở hầu hết bảng; dùng trạng thái (`archived`, `revoked`, `cancelled`, `unsubscribed`) hoặc `deleted_at`.

---

## 4. Secret — chỉ ở server

| Quy định | Chi tiết |
|---|---|
| Nơi lưu duy nhất | **Cloudflare Workers Secrets** và **GitHub Secrets**. Không commit `.env` vào repo (`.gitignore` chặn); không lưu secret key ở frontend dưới mọi hình thức. |
| Secret thuộc nhóm này | Supabase service-role key, Supabase anon key (anon key được phép ở frontend vì RLS chặn, nhưng **không** phải service-role), Resend API key, webhook secret (SePay / Resend / Stripe), Turnstile secret key, Apps Script Web App URL (nếu cần gọi từ Workers). |
| Ai được cầm service-role | Chỉ `workers/api` được cầm service-role key. Frontend không bao giờ thấy key này. |
| Xoay key | Xoay key khi có người rời đội; xoay webhook secret khi nghi lộ. Ghi lại lần xoay vào `audit_logs` / runbook vận hành (không ghi giá trị key). |
| Không bịa secret | Không tự tạo QR / khóa / tài khoản từ thông tin chưa xác nhận. Số tài khoản ngân hàng **không ghi vào tài liệu** — chỉ dùng từ ảnh chụp / file QR do user cung cấp (QĐ 15). |
| Tài khoản Supabase | Project prod + staging tạo trên tài khoản Gmail `visfaracademy@gmail.com` (Task 02 QĐ 15). |

---

## 5. Validation ở server

Mọi field đều validate lại ở Workers — không tin validation ở client. Validation client và server dùng cùng một bộ quy tắc.

| Field | Quy tắc server |
|---|---|
| Họ tên (`fullName`) | 2–100 ký tự, không chứa ký tự điều khiển |
| SĐT (`phone`) | `^0\d{9}$` — 10 số, bắt đầu bằng 0; lưu dạng text để giữ số 0 đầu |
| Email (`email`) | Định dạng hợp lệ, **TLD ≥ 2 ký tự**: `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` |
| Tỉnh/thành (`province`) | Phải nằm trong whitelist **34 tỉnh/thành** |
| Khóa quan tâm (`courseId`) | Phải tồn tại và `status = 'published'`; được phép `null` (“Chưa biết bắt đầu từ đâu”) |
| Số tiền tùy tâm (`custom_amount_vnd`) | Integer, ≥ 0; `amount_vnd` là integer VND, không dùng float cho tiền |
| Tiến độ (`progress_percent`) | Integer 0–100; server kiểm tra enrollment còn `active` và ngưỡng hợp lý theo `video_duration_sec` (không cho nhảy 0% → 100% trong 1 giây); ngưỡng hoàn thành: video ≥ 90%, bài text bấm “Đã hoàn thành” (QĐ 17) |
| Đáp án quiz | Chỉ nhận đáp án đã chọn; `is_correct` không bao giờ đi từ client lên, cũng không bao giờ trả về client trước khi nộp — chấm ở server |

- Lỗi validation trả mã lỗi theo field (`invalid_phone`, `invalid_email`, `invalid_province`, `invalid_course`, `invalid_input`) + `message` tiếng Việt, không lộ chi tiết kỹ thuật hay secret. Chi tiết lỗi kỹ thuật chỉ ghi vào log server (không chứa PII).
- Mọi response lỗi có dạng `{ "ok": false, "error": "ma_loi", "message": "…" }`; mọi response thành công có `ok: true`.

---

## 6. Rate-limit, honeypot + CAPTCHA

### 6.1. Rate-limit — theo IP và theo user

Áp theo IP, cộng thêm theo user (khi đã đăng nhập) đối với endpoint nhạy cảm (Task 02 QĐ 10: áp cả theo IP và theo user). Vượt giới hạn → HTTP `429` (`rate_limited`), kèm header `Retry-After`, và **không ghi dữ liệu**.

| Nhóm endpoint | Giới hạn |
|---|---|
| Tạo lead — `POST /api/leads` | **5 request/giờ/IP** |
| Đăng nhập — qua Supabase Auth | **10 lần/15 phút/IP** |
| Đăng ký nhận tin — `POST /api/newsletter` | 5 request/giờ/IP |
| Hủy nhận tin — `POST /api/newsletter/unsubscribe` | 10 request/giờ/IP |
| Endpoint công khai (đọc) | **100 request/phút/IP** |
| Endpoint học viên / đơn hàng (cần JWT) | 100 request/phút/IP + giới hạn theo user (con số theo user chốt khi lập trình — đề xuất 300 req/giờ/user, cần phê duyệt) |
| Webhook (SePay, Resend) | Không rate-limit theo IP công khai (xác minh bằng chữ ký thay cho rate-limit); giới hạn chống flood ở tầng edge nếu cần |

- Rate-limit đếm cả request lỗi validation (trừ lỗi `401`/`403` do sai auth) để chống dò.

### 6.2. Chống spam — honeypot + CAPTCHA (Quyết định 4: thêm cả hai)

- **(a) Honeypot + rate-limit + idempotency:** field ẩn phải rỗng, nếu không → `400` (`spam_suspected`), không ghi.
- **(b) CAPTCHA — Cloudflare Turnstile** (miễn phí; cần xác minh giới hạn khi triển khai, không giả định): token Turnstile được xác minh ở server trước khi ghi; token sai/hết hạn → `400`, không ghi. Không dùng CAPTCHA trả phí nếu chưa phê duyệt.
- Vị trí hiển thị Turnstile trên form và cách xử lý khi Turnstile không tải được (chặn gửi hay cho gửi kèm cảnh báo) là quyết định cần phê duyệt (xem §10.3).

---

## 7. Bảo vệ dữ liệu cá nhân (PII)

### 7.1. Quy tắc của hệ thống mới

- **Không đưa họ tên / SĐT / email vào URL, log, `mailto:`, hay clipboard ở tầng API.** Log chỉ ghi `reference_code` và `user_id`, không ghi SĐT/email/họ tên.
- Không đưa PII vào `gateway_payload` vượt mức cần thiết để đối soát; payload webhook gốc lưu để đối soát, không chứa secret.
- SĐT lưu dạng text (giữ số 0 đầu), kiểm tra định dạng ở cả DB (`CHECK`) và API.
- Tài liệu bài học chỉ lấy qua **signed URL, hết hạn sau 1 giờ**, cấp sau khi kiểm tra enrollment; bucket Storage chia `public` (poster, ảnh khóa học) / `private` (tài liệu bài học).
- Video bài giảng dùng **YouTube unlisted** (giai đoạn 0 đồng): không phải bảo mật thật — ai có link đều xem được, không chống tải, không có DRM. Đây là đánh đổi đã được chấp nhận (QĐ 16). Khi cần bảo mật hơn (Cloudflare Stream / Mux / Vimeo Pro) cần phê duyệt riêng, có phí.

### 7.2. Ghi chú về Quyết định 8 — PII trong mailto/clipboard ở trang HTML hiện tại

> **Quyết định 8 của user (chốt 10/11/2026): GIỮ nguyên mailto + nút sao chép chứa họ tên/SĐT/email trong hộp xác nhận dự phòng của trang HTML hiện tại.** Đội ngũ đã cảnh báo rủi ro: PII vẫn lộ qua email client / lịch sử trình duyệt / clipboard — đây là quyết định của chủ dự án.
>
> **Hệ thống mới (Next.js + Workers API) KHÔNG làm vậy:** tầng API tuân thủ §7.1 — không PII trong `mailto:`, clipboard, URL, log. Quyết định 8 chỉ áp cho trang HTML hiện tại, không kế thừa sang nền tảng mới. Khi chuyển form cũ sang API mới, hộp xác nhận dự phòng chứa PII phải được xem xét lại cùng với Quyết định 3 (xem §1 và §10.4).

### 7.3. Quyền xem PII của giảng viên

Theo Task 02 QĐ 6, instructor được xem SĐT/email học viên **của khóa phụ trách** (giới hạn qua `course_instructors` + `enrollments`). Mọi liên hệ khác (lead, học viên khóa khác) instructor không được xem. Chi tiết policy: xem `RLS_POLICIES.md` §4.3.

---

## 8. Bảo mật thanh toán (SePay — MB Bank)

Thanh toán dùng **SePay** (QĐ 15); ngân hàng **MB Bank**, chủ tài khoản là Công ty TNHH MTV Visfar Holdings. **Số tài khoản không ghi vào tài liệu này** — chỉ dùng từ ảnh chụp / file QR do user cung cấp khi cần tạo khối thanh toán / VietQR; có thể sử dụng QR Code cũ; không tự tạo QR mới từ thông tin chưa xác nhận. Stripe chưa dùng (Task 02 QĐ 9). Giai đoạn đầu vẫn có luồng chuyển khoản thủ công + admin đối soát (`POST /api/admin/orders/:id/mark-paid`, hạn giữ chỗ 48h, nhắc sau 12h/24h).

### 8.1. Webhook signature — xác minh chữ ký SePay

```
POST /api/webhooks/sepay  (không dùng JWT — xác minh bằng chữ ký)
```

1. **Xác minh chữ ký** webhook SePay bằng secret riêng (chỉ trong Workers Secrets). Chữ ký sai/thiếu → từ chối `401`/`403`, **không xử lý, không ghi dữ liệu**.
2. Webhook không có chữ ký đúng không bao giờ được đổi trạng thái đơn, dù payload trông hợp lệ.
3. Áp tương tự cho webhook Resend (chữ ký Resend/Svix) và Stripe (Stripe-Signature + endpoint secret) khi dùng.

### 8.2. Idempotency — chống ghi trùng

- Mọi `POST` tạo dữ liệu nhận header **`Idempotency-Key: <uuid>`** (UUID do client sinh). Server lưu key cùng kết quả lần ghi đầu tiên (`leads.idempotency_key` UNIQUE; tương tự cho order/quiz — key + phạm vi endpoint/user).
- Request lặp lại với cùng key → server **không ghi thêm**, trả lại kết quả cũ với cờ `duplicate: true` và HTTP `200` (thay vì `201` lần đầu). Cùng key nhưng body khác → từ chối `409` (`idempotency_conflict`), không ghi.
- Key có hiệu lực 24 giờ (đề xuất, cần phê duyệt); sau đó key cũ có thể được dọn.
- **Không dùng idempotency để che lỗi:** nếu lần ghi đầu tiên thất bại, key không được coi là “đã xong”; client retry với cùng key phải được xử lý lại, không trả thành công giả.

### 8.3. Duplicate payment prevention — chống trùng giao dịch

- **UNIQUE (`method`, `gateway_reference`)** trên bảng `payments` (khi `gateway_reference` không NULL): webhook SePay gửi lại cùng giao dịch không tạo payment trùng; lần gửi lại trả kết quả cũ.
- Tìm đơn theo `reference_code` trong nội dung chuyển khoản. Không tìm thấy đơn → ghi log + báo cáo đối soát (R9), trả `200` cho SePay (đã nhận webhook) nhưng không đổi trạng thái đơn nào.

### 8.4. Transaction verification — xác minh giao dịch trước khi ghi nhận

1. **Tìm đơn** theo `reference_code` (mã đơn, VD `DH-2026-000123`) trong nội dung chuyển khoản.
2. **Kiểm tra số tiền khớp: cho phép sai lệch 0đ — không chấp nhận thiếu/thừa.** Số tiền giao dịch không khớp `amount_vnd` của đơn → ghi `payments` trạng thái `failed` (hoặc bản ghi đối soát), **không đổi đơn sang `paid`**, đưa vào báo cáo đối soát (R9) để admin xử lý tay; ghi lỗi `422` (`payment_mismatch`) trong log nội bộ.
3. **Chỉ server mới được đổi đơn sang `paid`** — qua webhook đã xác minh chữ ký hoặc admin xác nhận thủ công (`POST /api/admin/orders/:id/mark-paid`, sau khi kiểm tra sao kê). **Không bao giờ tin client báo “đã trả”.**
4. Thành công: tạo `payments` (`method=sepay`, `status=succeeded`, `paid_at=now()`) → đổi `orders` sang `paid` → tạo `enrollments` → gửi email `order-paid` (E8) → ghi `email_logs`.

### 8.5. Hoàn trả và khiếu nại (Quyết định 9)

- **Hoàn trả: 15 ngày làm việc.** Học viên yêu cầu hoàn trả → admin kiểm tra khung thời gian chính sách → `POST /api/admin/orders/:id/refund`: đổi đơn sang `refunded`, ghi payment `refunded`, thu hồi enrollment (`status=revoked`), gửi email xác nhận. Hoàn trả chuyển khoản thủ công: admin chuyển khoản lại, ghi `gateway_reference` là mã giao dịch hoàn.
- **Khiếu nại: phản hồi trong 3 ngày.** “15 ngày” áp cho xử lý hoàn trả; “3 ngày” áp cho phản hồi khiếu nại. Các bước còn lại trong khung hoàn trả/khiếu nại (do builder viết) giữ nguyên cho tới khi user nói khác — cần phê duyệt trước khi áp vào endpoint refund.
- Chỉ admin thực hiện hoàn trả; mọi lần hoàn trả ghi `audit_logs`.

### 8.6. Audit trail — nhật ký đối soát

| Nguồn log | Ghi gì | Ai đọc |
|---|---|---|
| `audit_logs` | Mọi thao tác admin đổi dữ liệu: `actor_id`, `action` (VD `order.mark_paid`, `enrollment.grant`, `course.publish`, `lead.status`), `target_type`, `target_id`, `details` (jsonb) | Chỉ admin (`GET /api/admin/audit-logs`) |
| `payments.gateway_payload` | Payload webhook gốc (để đối soát, **không chứa secret**) | Admin qua báo cáo đối soát |
| `email_logs` | `to_email`, `template`, `resend_id`, `status` (`queued`/`sent`/`delivered`/`bounced`/`failed`), `related_type`/`related_id` — cập nhật qua webhook Resend đã xác minh chữ ký | Chỉ admin (`GET /api/admin/reports/email`) |
| `leads.reference_code` / `orders.reference_code` | Mã tham chiếu duy nhất (`VISFAR-2026-000123` / `DH-2026-000123`) để đối soát với người đăng ký và với Sheet | Admin; người đăng ký chỉ thấy mã của mình |
| Báo cáo đối soát R9 | Đơn `pending` quá 48h; đơn `paid` chưa có enrollment; payment không khớp order; webhook lỗi; lead ghi DB xong nhưng Sheet/email lỗi | Admin kiểm tra mỗi sáng |

- Webhook lỗi và payment không khớp xuất hiện trong báo cáo đối soát R9 để admin xử lý mỗi sáng; không tự động đổi trạng thái đơn từ các bản ghi lỗi.
- Sheet (bản sao đối soát) được ghi **sau** khi database đã ghi xong (API làm lớp trước, rồi ghi Sheet — QĐ 5). Nếu Sheet/email lỗi sau khi database đã ghi xong, API vẫn trả `201` kèm `referenceCode` (lead đã được ghi nhận thật), nhưng ghi log lỗi + đưa vào hàng đợi thử lại / báo cáo đối soát.

---

## 9. Bảo mật khác

| Mục | Quy định |
|---|---|
| Header bảo mật | Cloudflare Pages đặt CSP, `X-Content-Type-Options`, `Referrer-Policy`; không dùng `innerHTML` với dữ liệu người dùng (theo tài liệu kiến trúc §6.3; CSP theo QĐ 13). |
| Storage | Bucket riêng theo quyền — `public` (poster, ảnh khóa học), `private` (tài liệu bài học — chỉ học viên đã ghi danh mới lấy được signed URL, hết hạn sau 1 giờ). |
| Email | Chỉ gửi qua Resend từ Workers (API key ở server); không gọi Resend từ client. Domain gửi Resend cần xác minh DNS SPF/DKIM/DMARC trước khi gửi cho người dùng thật; kênh cảnh báo hệ thống qua mail `visfaracademy@gmail.com` (Task 02 QĐ 14). Webhook Resend cập nhật `email_logs.status`; email giao dịch quan trọng bị `bounced`/`failed` đưa vào báo cáo email (R8). |
| Phân trang / lọc | Mọi endpoint danh sách phân trang (`?page=&limit=`, mặc định 20, tối đa 100), sắp xếp mới nhất trước, trừ khóa học sắp xếp theo `display_order` 01–10. |
| Giới hạn miễn phí | Workers Free 100.000 request/ngày; Resend Free tối đa 100 email/ngày (ưu tiên email giao dịch E3/E5/E8); Supabase Free tạm dừng sau 7 ngày không hoạt động — cron giữ ấm gọi `GET /api/health` mỗi ngày. Nâng gói trả phí (Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng — giá tra cứu 10/11/2026, cần xác minh lại) **chỉ khi chạm giới hạn và được phê duyệt** (QĐ 18; Task 02 QĐ 16: linh hoạt, ban đầu dùng hoàn toàn miễn phí). |
| Chính sách | `policies` có versioning: tạo version mới, không sửa version cũ; chỉ 1 bản `is_current` / 1 slug. |

---

## 10. Quyết định cần phê duyệt

1. **Phê duyệt mô hình 2 lớp** (RLS + Workers API) và các quy tắc ở §2–§8 làm căn cứ lập trình, hay cần thêm/bớt lớp kiểm tra nào?
2. **Triển khai SePay:** phê duyệt triển khai SePay (giá, gói, thời điểm) trước khi làm webhook §8.1–§8.4; tới lúc đó vẫn dùng chuyển khoản thủ công + admin đối soát.
3. **Turnstile CAPTCHA:** phê duyệt vị trí hiển thị Turnstile trên form và cách xử lý khi Turnstile không tải được (chặn gửi hay cho gửi kèm cảnh báo?).
4. **Quyết định 8 trên nền tảng mới:** khi chuyển form cũ sang API mới, có bỏ hộp xác nhận dự phòng chứa PII (mailto/clipboard) theo quy tắc §7.1, hay giữ lại theo Quyết định 8? (Tài liệu này áp §7.1 cho hệ thống mới; Quyết định 8 chỉ áp cho trang HTML hiện tại.)
5. **Rate-limit theo user:** phê duyệt con số cụ thể cho endpoint học viên/đơn hàng (đề xuất: 100 req/phút/IP + 300 req/giờ/user).
6. **Thời gian hiệu lực và dọn dẹp `Idempotency-Key`:** đề xuất 24 giờ — cần phê duyệt.
7. **Khung hoàn trả/khiếu nại:** Quyết định 9 đã chốt hoàn trả 15 ngày làm việc, phản hồi khiếu nại 3 ngày — cần phê duyệt các bước còn lại trong khung (hiện do builder viết) trước khi áp vào endpoint `POST /api/admin/orders/:id/refund`.
8. **Video unlisted:** đã chấp nhận đánh đổi (QĐ 16) — có giữ YouTube unlisted cho tới khi doanh thu đủ bù chi phí dịch vụ video có bảo mật, hay chuyển sớm sang Cloudflare Stream/Mux/Vimeo Pro?
9. **Xác minh lại giới hạn miễn phí** (Supabase, Workers, Resend) trên trang pricing chính thức tại thời điểm bắt đầu lập trình — số trong §9 là snapshot tra cứu ngày 10/11/2026, nhà cung cấp có thể thay đổi.

---

*Nguồn: `docs/DECISIONS.md`, `docs/architecture/ROLE_PERMISSION_MATRIX.md`, `docs/architecture/API_ARCHITECTURE.md`, `Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` §5/§6/§8/§9, `docs/database/RLS_POLICIES.md`. Không triển khai DB, không sửa code, không bịa số tài khoản ngân hàng, không bịa giá dịch vụ (giá gói trả phí ghi rõ là tra cứu ngày 10/11/2026, cần xác minh lại).*
