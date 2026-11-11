# Hành trình người dùng — Nền tảng E-learning Visfar Academy

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt kiến trúc
**Thuộc TASK 02 — Visfar Academy**
**Tài liệu gốc:** `Tài liệu kiến trúc tổng thể — Nền tảng E-learning Visfar Academy` (phiên bản 1.0, 10/11/2026) và `docs/DECISIONS.md` (19 quyết định đã chốt ngày 10/11/2026).
**Phạm vi:** chỉ mô tả hành trình. **Chưa viết code, chưa tạo database, chưa deploy.** Không sửa code/file HTML gốc.

## Quy ước chung cho mọi flow

- **Mọi lần gửi đều có xác nhận thật.** Luồng mới không hiện “thành công giả”: nếu API lỗi, giao diện hiện lỗi và mã tham chiếu (nếu có), không hiện màn hình cảm ơn. Ngoại lệ duy nhất là nhánh fallback của form trên trang hiện tại — nhánh này **giữ nguyên** theo Quyết định 3 trong `DECISIONS.md` (không đổi văn bản, không bỏ nhánh), và được ghi nhận là rủi ro đã cảnh báo.
- **API làm lớp trước, rồi ghi Sheet (đối với lead).** Lead đi qua Workers API — validate, chống spam (honeypot + rate-limit + idempotency + CAPTCHA, theo Quyết định 4), chống trùng — sau đó ghi vào Sheet làm bản sao đối soát. Sheet không còn là đường ghi duy nhất và không phải database chính (Quyết định 5).
- **PII trong mailto/clipboard giữ nguyên** theo Quyết định 8: hộp xác nhận dự phòng trên trang hiện tại vẫn giữ mailto + nút sao chép chứa họ tên/SĐT/email. Rủi ro đã cảnh báo: PII vẫn lộ qua email client / lịch sử trình duyệt / clipboard. Trong luồng mới, log chỉ ghi `reference_code` và `user_id`, không ghi SĐT/email vào log, URL hay clipboard.
- **Mọi ghi nhạy cảm đi qua Workers API** (xác thực JWT, validation ở server, rate-limit, idempotency). Client không ghi trực tiếp vào bảng nhạy cảm (`orders`, `payments`, `lesson_progress`).
- **Định dạng lỗi chung:** `{ "ok": false, "error": "ma_loi", "message": "…" }`. Mọi phản hồi thành công có `ok: true`.
- **Thanh toán:** ngân hàng **MB Bank**, chủ tài khoản **Công ty TNHH MTV Visfar Holdings**. **Không ghi số tài khoản trong tài liệu này.** QR Code cũ (file do user cung cấp) vẫn dùng được; không tự tạo QR mới từ thông tin chưa xác nhận (Quyết định 15).
- **Giá dịch vụ trả phí:** cần xác minh lại trước khi nâng cấp (Quyết định 18) — tài liệu này không ghi giá.
- **Ngày sự kiện:** 3 sự kiện chốt ngày **25/11/2026**. Giờ + hình thức từng sự kiện chưa được cung cấp — không tự bịa, chờ user gửi sau (Quyết định 7).

---

## Flow 1 — Khách → đăng ký (tư vấn / lead)

**Mục đích:** khách để lại thông tin để được tư vấn, hệ thống ghi nhận lead có mã tham chiếu để đối soát.
**Tác nhân:** khách (chưa đăng nhập). **Kênh:** form tư vấn trên trang công khai.

### Sơ đồ bước

```
Khách                Frontend              Workers API              DB + Sheet
  │                      │                       │                      │
  │ 1. Mở form tư vấn    │                       │                      │
  │─────────────────────►│                       │                      │
  │                      │ 2. Nhập: họ tên, SĐT,│                      │
  │                      │    email, tỉnh/thành, │                      │
  │                      │    khóa quan tâm      │                      │
  │                      │    (honeypot ẩn)     │                      │
  │                      │                       │                      │
  │                      │ 3. POST /api/leads    │                      │
  │                      │    + Idempotency-Key  │                      │
  │                      │──────────────────────►│                      │
  │                      │                       │ 4. Validate server:  │
  │                      │                       │    SĐT ^0\d{9}$,     │
  │                      │                       │    email TLD ≥2 ký   │
  │                      │                       │    tự, tỉnh trong    │
  │                      │                       │    34 tỉnh/thành,    │
  │                      │                       │    khóa tồn tại &    │
  │                      │                       │    published;        │
  │                      │                       │    honeypot rỗng;    │
  │                      │                       │    rate-limit        │
  │                      │                       │    5 lần/giờ/IP     │
  │                      │                       │                      │
  │                      │                       │ 5. Tạo lead:         │
  │                      │                       │    reference_code    │
  │                      │                       │    VISFAR-2026-…     │
  │                      │                       │    status = new      │
  │                      │                       ├─────────────────────►│
  │                      │                       │ 6. Ghi Sheet (bản    │
  │                      │                       │    sao đối soát)     │
  │                      │                       │    sau khi API ghi   │
  │                      │                       │    DB thành công     │
  │                      │                       │                      │
  │                      │ 7. 201 + referenceCode│                      │
  │                      │◄──────────────────────┤                      │
  │ 8. Màn hình xác nhận │                       │                      │
  │    + mã tham chiếu   │                       │                      │
  │◄─────────────────────┤                       │                      │
  │                      │                       │ 9. Email lead-received
  │                      │                       │    + lead-notify-admin
  │                      │                       │    (qua Resend)      │
```

### Trạng thái

| Trạng thái lead | Ý nghĩa |
|---|---|
| `new` | Vừa tạo, chưa liên hệ |
| `contacted` | Admin đã liên hệ |
| `enrolled` | Lead đã thành học viên (liên kết bằng email, không FK cứng) |
| `closed` | Đóng, không theo nữa |
| `spam` | Bị đánh dấu spam |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| SĐT/email/tỉnh không hợp lệ | 400 `invalid_phone` / `invalid_email` / `invalid_province` | Hiện lỗi tại đúng trường, không ghi dữ liệu, không hiện cảm ơn |
| Honeypot có giá trị / nghi spam | 400 `spam_suspected` | Không ghi dữ liệu; hiện thông báo chung, không tiết lộ lý do chống spam |
| Vượt rate-limit (5 lần/giờ/IP) | 429 `rate_limited` | Hiện “vui lòng thử lại sau”, không ghi dữ liệu |
| Trùng `Idempotency-Key` | 200 + `duplicate: true`, trả mã cũ | Không tạo lead mới; hiện mã tham chiếu cũ |
| API lỗi / mất mạng (luồng mới) | Không nhận được phản hồi thành công | **Không hiện “thành công giả”**: hiện lỗi + hướng dẫn thử lại; nếu đã có `reference_code` thì hiện mã đó để đối soát |
| Ghi Sheet thất bại sau khi API đã ghi DB | DB đã có lead, Sheet thiếu | Lead trong DB là nguồn sự thật; ghi log, đối soát và ghi bù Sheet thủ công; không báo lỗi cho khách (vì đăng ký đã ghi nhận) |
| Nhánh fallback form trang hiện tại | Theo Quyết định 3 — giữ nguyên | Không đổi văn bản, không bỏ nhánh; đây là rủi ro đã cảnh báo, giảm thiểu bằng mã tham chiếu + đối soát |

---

## Flow 2 — Đăng ký tài khoản → xác minh email

**Mục đích:** tạo tài khoản học viên qua Supabase Auth và xác minh email trước khi học.
**Tác nhân:** khách. **Kênh:** `/dang-ky`.

### Sơ đồ bước

```
Khách              Frontend            Supabase Auth           Workers API / Resend
  │                    │                     │                          │
  │ 1. Mở /dang-ky     │                     │                          │
  │───────────────────►│                     │                          │
  │                    │ 2. Nhập: họ tên,    │                          │
  │                    │    email, mật khẩu, │                          │
  │                    │    SĐT (tùy chọn    │                          │
  │                    │    theo form)       │                          │
  │                    │                     │                          │
  │                    │ 3. POST /auth/signup│                          │
  │                    │────────────────────►│                          │
  │                    │                     │ 4. Tạo auth.users +    │
  │                    │                     │    profiles qua trigger │
  │                    │                     │    (role mặc định      │
  │                    │                     │    student)            │
  │                    │                     │                          │
  │                    │                     │ 5. Gửi email xác minh  │
  │                    │                     │    (qua Supabase Auth  │
  │                    │                     │    + Resend/SMTP) ─────►│
  │                    │                     │                          │
  │                    │ 6. Báo “đã gửi email│                          │
  │                    │    xác minh, kiểm   │                          │
  │                    │    tra hộp thư”     │                          │
  │                    │◄────────────────────┤                          │
  │ 7. Mở email, bấm   │                     │                          │
  │    link xác minh   │                     │                          │
  │─────────────────────────────────────────►│                          │
  │                    │                     │ 8. Email được xác minh  │
  │                    │                     │    → tài khoản kích hoạt│
  │ 9. Đăng nhập lần   │                     │                          │
  │    đầu → Flow 3    │                     │                          │
  │───────────────────►│                     │                          │
```

### Trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| Chưa xác minh | Tài khoản đã tạo, email chưa bấm link xác minh |
| Đã xác minh | Email xác nhận, tài khoản kích hoạt, đăng nhập được |
| `profiles.role = student` | Vai trò mặc định khi đăng ký; `instructor`/`admin` chỉ do admin cấp |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| Email đã đăng ký | Lỗi “email đã tồn tại” | Hướng dẫn đăng nhập hoặc đặt lại mật khẩu, không tạo tài khoản trùng |
| Mật khẩu yếu / không hợp lệ | Lỗi validation | Hiện yêu cầu mật khẩu, không gửi signup |
| Email xác minh không tới | Khách báo không nhận được | Cho bấm “gửi lại email xác minh” (có rate-limit); kiểm tra `email_logs` + trạng thái Resend; nhắc kiểm tra thư rác |
| Link xác minh hết hạn / đã dùng | Lỗi khi bấm link | Hướng dẫn gửi lại link mới từ trang đăng nhập |
| Email vượt giới hạn Resend (100 email/ngày) | Lỗi `daily_quota_exceeded` | Email xác minh xếp hàng, gửi lại sau 00:00 UTC; ưu tiên email giao dịch (xác minh, đặt lại mật khẩu) trước email nhắc; admin nhận cảnh báo qua báo cáo email (R8) |
| Đăng ký spam hàng loạt | Nhiều signup từ 1 IP | Rate-limit đăng ký theo IP; CAPTCHA theo Quyết định 4 |

---

## Flow 3 — Đăng nhập → dashboard

**Mục đích:** học viên đăng nhập và vào dashboard cá nhân.
**Tác nhân:** học viên đã có tài khoản. **Kênh:** `/dang-nhap` → `/hoc-vien/dashboard`.

### Sơ đồ bước

```
Học viên             Frontend            Supabase Auth           Workers API
  │                    │                     │                          │
  │ 1. Mở /dang-nhap   │                     │                          │
  │───────────────────►│                     │                          │
  │                    │ 2. Nhập email +     │                          │
  │                    │    mật khẩu         │                          │
  │                    │                     │                          │
  │                    │ 3. POST /auth/signin│                          │
  │                    │────────────────────►│                          │
  │                    │                     │ 4. Kiểm tra tài khoản, │
  │                    │                     │    trả JWT             │
  │                    │◄────────────────────┤                          │
  │                    │                     │                          │
  │                    │ 5. GET /api/me      │                          │
  │                    │    (kèm JWT) ───────┼───────────────────────►│
  │                    │                     │ 6. Trả profile + role  │
  │                    │                     │    + danh sách khóa    │
  │                    │                     │    đã ghi danh         │
  │                    │◄────────────────────┼────────────────────────┤
  │                    │                     │                          │
  │ 7. Chuyển tới       │                     │                          │
  │    /hoc-vien/       │                     │                          │
  │    dashboard: khóa  │                     │                          │
  │    đang học, % hoàn │                     │                          │
  │    thành, chứng chỉ │                     │                          │
  │◄───────────────────┤                     │                          │
```

### Trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| Chưa đăng nhập | Khách chỉ xem nội dung công khai và bài xem thử |
| Đã đăng nhập (`student`) | Vào được dashboard, khóa đã ghi danh, hồ sơ của mình |
| Đã đăng nhập (`admin`) | Thêm quyền vào `/admin/*` |
| Phiên hết hạn | JWT hết hạn → refresh; refresh không được → về trang đăng nhập |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| Sai email/mật khẩu | Lỗi đăng nhập | Hiện lỗi chung (không tiết lộ email có tồn tại hay không); đếm số lần sai |
| Vượt rate-limit đăng nhập (10 lần/15 phút/IP) | 429 | Khóa tạm theo IP, hiện “thử lại sau 15 phút” |
| Email chưa xác minh | Đăng nhập bị chặn (nếu bật yêu cầu xác minh) | Hướng dẫn gửi lại email xác minh (xem Flow 2) |
| Quên mật khẩu | Học viên bấm “Quên mật khẩu” | `POST /auth/reset-password` → email đặt lại mật khẩu; link hết hạn → gửi lại link mới |
| JWT hết hạn giữa chừng | API trả 401 | Frontend refresh token; không refresh được → đăng xuất về `/dang-nhap`, giữ lại trang đang xem để quay lại sau khi đăng nhập |
| Tài khoản bị vô hiệu hóa | Đăng nhập thất bại | Admin kiểm tra; không xóa cứng tài khoản, chỉ vô hiệu hóa |

---

## Flow 4 — Đăng ký khóa học miễn phí

**Mục đích:** học viên ghi danh ngay khóa miễn phí (`price_vnd = 0`), không qua đơn hàng/thanh toán.
**Tác nhân:** học viên đã đăng nhập. **Kênh:** trang chi tiết khóa học → `/hoc-vien/khoa-hoc/[slug]`.

### Sơ đồ bước

```
Học viên             Frontend              Workers API              DB
  │                    │                       │                      │
  │ 1. Xem khóa miễn   │                       │                      │
  │    phí, bấm        │                       │                      │
  │    “Đăng ký học”   │                       │                      │
  │───────────────────►│                       │                      │
  │                    │ 2. POST /api/my/      │                      │
  │                    │    enrollments        │                      │
  │                    │    { course_id }      │                      │
  │                    │    + JWT ────────────►│                      │
  │                    │                       │ 3. Kiểm tra: khóa    │
  │                    │                       │    tồn tại, status = │
  │                    │                       │    published,        │
  │                    │                       │    price_vnd = 0,    │
  │                    │                       │    chưa ghi danh     │
  │                    │                       │    (UNIQUE user +    │
  │                    │                       │    course)           │
  │                    │                       │                      │
  │                    │                       │ 4. Tạo enrollments   │
  │                    │                       │    status = active   │
  │                    │                       ├─────────────────────►│
  │                    │ 5. Trả enrollment     │                      │
  │                    │◄──────────────────────┤                      │
  │ 6. Vào bài học đầu │                       │                      │
  │    tiên ngay       │                       │                      │
  │◄───────────────────┤                       │                      │
```

### Trạng thái

| Trạng thái enrollment | Ý nghĩa |
|---|---|
| `active` | Đang học |
| `completed` | Hoàn thành 100% bài học của khóa (xem Flow 7) |
| `revoked` | Bị thu hồi (VD sau hoàn trả — chỉ áp dụng khóa trả phí) |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| Chưa đăng nhập | Bấm “Đăng ký học” khi chưa đăng nhập | Chuyển tới `/dang-nhap`, sau khi đăng nhập quay lại đúng khóa học |
| Khóa không miễn phí | Khóa có giá > 0 | Không cho ghi danh qua endpoint này; chuyển sang Flow 5 (tạo đơn → thanh toán) |
| Đã ghi danh rồi | UNIQUE (`user_id`, `course_id`) trùng | Trả enrollment hiện có; đưa học viên vào bài học tiếp theo, không tạo trùng |
| Khóa ở trạng thái `draft`/`archived` | Không tìm thấy khóa | Hiện “khóa học chưa khả dụng”, không tạo enrollment |
| API lỗi | Không nhận được phản hồi thành công | Không hiện “đăng ký thành công”; hiện lỗi + nút thử lại |

---

## Flow 5 — Mua khóa học → thanh toán → cấp quyền

**Mục đích:** học viên mua khóa trả phí / Tùy tâm, thanh toán, và được cấp quyền học khi đơn đã trả.
**Tác nhân:** học viên đã đăng nhập. **Phương thức giai đoạn đầu:** chuyển khoản thủ công MB Bank + đối soát tay; **SePay** (webhook tự động) triển khai sau khi phê duyệt. **QR cũ dùng được.**

### Sơ đồ bước — chuyển khoản thủ công (giai đoạn đầu, 0 đồng)

```
Học viên             Frontend              Workers API              Admin / Ngân hàng
  │                    │                       │                      │
  │ 1. Chọn khóa trả   │                       │                      │
  │    phí, bấm        │                       │                      │
  │    “Đăng ký”       │                       │                      │
  │───────────────────►│                       │                      │
  │                    │ 2. POST /api/orders   │                      │
  │                    │    { course_id,       │                      │
  │                    │      custom_amount_vnd│                      │
  │                    │      nếu Tùy tâm }    │                      │
  │                    │    + JWT ────────────►│                      │
  │                    │                       │ 3. Tạo orders:       │
  │                    │                       │    status = pending, │
  │                    │                       │    reference_code    │
  │                    │                       │    DH-2026-…,        │
  │                    │                       │    expires_at = +48h │
  │                    │                       │                      │
  │                    │ 4. Trả reference_code │                      │
  │                    │    + QR VietQR (file │                      │
  │                    │    QR cũ do user cung│                      │
  │                    │    cấp) + MB Bank +  │                      │
  │                    │    chủ tài khoản      │                      │
  │                    │    Công ty TNHH MTV  │                      │
  │                    │    Visfar Holdings + │                      │
  │                    │    số tiền + nội dung│                      │
  │                    │    = mã đơn          │                      │
  │                    │◄──────────────────────┤                      │
  │ 5. Chuyển khoản    │                       │                      │
  │    bằng app ngân   │                       │                      │
  │    hàng (ghi đúng  │                       │                      │
  │    nội dung = mã   │                       │                      │
  │    đơn)            │                       │                      │
  │───────────────────────────────────────────────────────────────►│
  │                    │                       │  Ngân hàng MB Bank   │
  │                    │                       │                      │
  │                    │                       │ 6. Admin kiểm tra    │
  │                    │                       │    sao kê mỗi ngày,  │
  │                    │                       │    đối soát mã đơn   │
  │                    │                       │    (báo cáo R9)      │
  │                    │                       │                      │
  │                    │                       │ 7. POST /api/admin/  │
  │                    │                       │    orders/:id/       │
  │                    │                       │    mark-paid         │
  │                    │                       │    { amount_vnd,     │
  │                    │                       │      note }          │
  │                    │                       │                      │
  │                    │                       │ 8. Tạo payments      │
  │                    │                       │    (bank_transfer,   │
  │                    │                       │    succeeded) →      │
  │                    │                       │    orders → paid →   │
  │                    │                       │    tạo enrollments   │
  │                    │                       │    → email order-paid│
  │                    │                       │                      │
  │ 9. Email “Đã nhận  │                       │                      │
  │    thanh toán” +   │                       │                      │
  │    vào học ngay    │                       │                      │
  │◄───────────────────┤                       │                      │
```

### Sơ đồ bước — SePay (khi được phê duyệt, tự động đối soát)

```
Học viên → POST /api/orders (payment_method = sepay)
→ Hiện QR VietQR (SePay) + thông tin MB Bank
→ Chuyển khoản
→ SePay webhook → POST /api/webhooks/sepay
  1. Xác minh chữ ký webhook (từ chối webhook không có chữ ký đúng)
  2. Tìm order theo reference_code trong nội dung chuyển khoản
  3. Kiểm tra số tiền khớp (không chấp nhận thiếu/thừa)
  4. Tạo payments (succeeded) + orders → paid + enrollments + email order-paid
  5. Idempotency: UNIQUE (method, gateway_reference) — webhook gửi lại không tạo trùng
```

### Trạng thái

| Đối tượng | Trạng thái | Ý nghĩa |
|---|---|---|
| `orders` | `pending` | Đã tạo đơn, chờ thanh toán (giữ chỗ 48h) |
| `orders` | `paid` | Đã nhận tiền, đã cấp quyền học |
| `orders` | `cancelled` | Học viên hủy đơn `pending` |
| `orders` | `expired` | Quá 48h chưa trả |
| `orders` | `refunded` | Đã hoàn trả |
| `payments` | `pending` / `succeeded` / `failed` / `refunded` | Trạng thái từng giao dịch |
| `enrollments` | `active` | Được tạo khi đơn chuyển sang `paid` |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| Học viên chuyển khoản sai nội dung (thiếu mã đơn) | Admin không đối soát được | Admin liên hệ học viên theo SĐT/email để đối soát tay; không tự cấp quyền khi chưa khớp mã đơn + số tiền |
| Chuyển khoản thiếu/thừa tiền | Số tiền không khớp đơn | Không chuyển đơn sang `paid`; admin liên hệ học viên xử lý phần chênh lệch; ghi `payments` + ghi chú đối soát |
| Đơn quá 48h chưa trả | Đơn hết hạn giữ chỗ | Đơn → `expired`; học viên tạo đơn mới; email nhắc đã gửi ở 12h và 24h (E6/E7) |
| Học viên hủy đơn | Bấm hủy đơn `pending` | Đơn → `cancelled`; không tạo enrollment |
| Webhook SePay gửi lại / trùng | Cùng `gateway_reference` tới 2 lần | UNIQUE (`method`, `gateway_reference`) chặn ghi trùng; trả kết quả cũ |
| Webhook không có chữ ký đúng | Chữ ký webhook sai | Từ chối webhook, lưu log để đối soát; không đổi trạng thái đơn |
| Client tự báo “đã trả” | Không có webhook/xác nhận admin | **Không bao giờ tin client báo đã trả.** Đơn chỉ sang `paid` khi webhook xác minh chữ ký hoặc admin xác nhận thủ công sau khi kiểm tra sao kê |
| Hoàn trả | Học viên yêu cầu hoàn trả | Khung đã chốt: hoàn trả trong **15 ngày làm việc**; khiếu nại phản hồi trong **3 ngày** (Quyết định 9). Admin bấm hoàn trả → `orders → refunded`, tạo bản ghi `payments` hoàn trả, gửi email, thu hồi enrollment (`status = revoked`). Hoàn trả chuyển khoản thủ công: admin chuyển khoản lại, ghi mã giao dịch hoàn vào `gateway_reference` |
| API tạo đơn lỗi | Không nhận được phản hồi thành công | Không hiện “đặt hàng thành công”; hiện lỗi + nút thử lại; không hiện QR/mã đơn khi chưa tạo được đơn |

---

## Flow 6 — Học → lưu tiến độ

**Mục đích:** học viên học từng bài, hệ thống lưu tiến độ để “tiếp tục học” và tính hoàn thành.
**Tác nhân:** học viên đã ghi danh. **Kênh:** `/hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]`.

### Sơ đồ bước

```
Học viên             Frontend              Workers API              DB
  │                    │                       │                      │
  │ 1. Mở bài học      │                       │                      │
  │───────────────────►│                       │                      │
  │                    │ 2. GET /api/my/       │                      │
  │                    │    lessons/:lessonId  │                      │
  │                    │    + JWT ────────────►│                      │
  │                    │                       │ 3. Kiểm tra enrollment
  │                    │                       │    active hoặc bài là│
  │                    │                       │    is_free_preview;  │
  │                    │                       │    trả video_url /   │
  │                    │                       │    nội dung / file   │
  │                    │                       │    (signed URL, hết │
  │                    │                       │    hạn 1 giờ)        │
  │                    │                       │                      │
  │                    │ 4. Hiển thị bài:     │                      │
  │                    │    video (YouTube    │                      │
  │                    │    unlisted) / bài   │                      │
  │                    │    text / tài liệu   │                      │
  │                    │◄──────────────────────┤                      │
  │ 5. Xem video /     │                       │                      │
  │    đọc bài         │                       │                      │
  │───────────────────►│                       │                      │
  │                    │ 6. POST /api/my/      │                      │
  │                    │    progress định kỳ   │                      │
  │                    │    (mỗi 30 giây khi  │                      │
  │                    │    xem video, và khi │                      │
  │                    │    rời bài):         │                      │
  │                    │    { lesson_id,      │                      │
  │                    │      progress_percent,│                      │
  │                    │      last_position_sec│                      │
  │                    │    } ────────────────►│                      │
  │                    │                       │ 7. Kiểm tra server:  │
  │                    │                       │    enrollment còn    │
  │                    │                       │    active;           │
  │                    │                       │    progress 0–100;   │
  │                    │                       │    không cho nhảy    │
  │                    │                       │    0% → 100% trong   │
  │                    │                       │    1 giây (chống     │
  │                    │                       │    gian lận, theo    │
  │                    │                       │    video_duration_sec)│
  │                    │                       │                      │
  │                    │                       │ 8. Lưu lesson_progress│
  │                    │                       │    (UNIQUE user +    │
  │                    │                       │    lesson)           │
  │                    │                       │                      │
  │                    │ 9. Lần sau mở lại:   │                      │
  │                    │    tiếp tục từ        │                      │
  │                    │    last_position_sec  │                      │
  │                    │◄──────────────────────┤                      │
```

### Ngưỡng hoàn thành (đã chốt — Quyết định 17, tính theo module)

- **Bài video:** hoàn thành khi `progress_percent >= 90%`.
- **Bài text:** hoàn thành khi học viên bấm **“Đã hoàn thành”** (`POST /api/my/progress/complete`).
- Ngưỡng tính **theo module**: `lessons.slug` UNIQUE theo module (không theo khóa).
- Học viên xem lại bài đã hoàn thành bất cứ lúc nào; tiến độ không bị xóa khi xem lại.

### Trạng thái

| Trạng thái `lesson_progress` | Ý nghĩa |
|---|---|
| `not_started` | Chưa mở bài |
| `in_progress` | Đang học, `progress_percent` 1–89% (video) |
| `completed` | Đạt ngưỡng 90% (video) hoặc đã bấm “Đã hoàn thành” (text); có `completed_at` |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| Chưa ghi danh mà mở bài không phải xem thử | API từ chối | Hiện “bạn chưa đăng ký khóa này”, chuyển tới trang khóa học (Flow 4/5) |
| Video YouTube unlisted | Ai có link đều xem được, không chống tải (Quyết định 16) | Chấp nhận đánh đổi ở giai đoạn 0 đồng; chuyển sang dịch vụ video có phí khi có phê duyệt/doanh thu |
| Tiến độ nhảy bất thường (0% → 100% trong 1 giây) | Server từ chối ghi | Không lưu tiến độ gian lận; giữ tiến độ hợp lệ gần nhất; hiện thông báo chung |
| Mất mạng khi đang học | `POST /api/my/progress` thất bại | Lưu tạm tiến độ ở client, gửi lại khi có mạng; không báo “đã lưu” khi chưa có phản hồi thành công từ server |
| File tài liệu hết hạn signed URL | Tải tài liệu thất bại | Xin signed URL mới (hết hạn sau 1 giờ); chỉ học viên đã ghi danh mới lấy được |
| Enrollment bị thu hồi giữa chừng | `enrollments.status = revoked` | Chặn truy cập bài học, hiện lý do (VD đã hoàn trả) |

---

## Flow 7 — Kiểm tra (quiz) → chứng chỉ

**Mục đích:** học viên làm quiz để kiểm tra hiểu bài, hoàn thành khóa và nhận chứng chỉ.
**Tác nhân:** học viên đã ghi danh.

### Sơ đồ bước

```
Học viên             Frontend              Workers API              DB
  │                    │                       │                      │
  │ 1. Mở bài quiz     │                       │                      │
  │───────────────────►│                       │                      │
  │                    │ 2. GET /api/my/quiz/  │                      │
  │                    │    :lessonId ────────►│                      │
  │                    │                       │ 3. Trả câu hỏi +     │
  │                    │                       │    lựa chọn — KHÔNG  │
  │                    │                       │    kèm is_correct    │
  │                    │◄──────────────────────┤                      │
  │ 4. Chọn đáp án,    │                       │                      │
  │    bấm “Nộp bài”   │                       │                      │
  │───────────────────►│                       │                      │
  │                    │ 5. POST /api/my/quiz/ │                      │
  │                    │    :lessonId/submit   │                      │
  │                    │    + JWT ────────────►│                      │
  │                    │                       │ 6. Chấm ở server     │
  │                    │                       │    bằng quiz_options.│
  │                    │                       │    is_correct; lưu   │
  │                    │                       │    quiz_attempts     │
  │                    │                       │    (điểm, đáp án đã │
  │                    │                       │    chọn); trả điểm + │
  │                    │                       │    đáp án đúng (chỉ │
  │                    │                       │    sau khi nộp)      │
  │                    │◄──────────────────────┤                      │
  │ 7. Xem điểm, làm   │                       │                      │
  │    lại nếu muốn    │                       │                      │
  │    (giai đoạn đầu  │                       │                      │
  │    không giới hạn  │                       │                      │
  │    số lần làm lại) │                       │                      │
  │                    │                       │                      │
  │                    │    Khi tất cả bài     │                      │
  │                    │    trong khóa đều     │                      │
  │                    │    completed:         │                      │
  │                    │                       │ 8. enrollments →     │
  │                    │                       │    completed,        │
  │                    │                       │    completed_at =    │
  │                    │                       │    now(); tạo        │
  │                    │                       │    certificates      │
  │                    │                       │    (mã VISFAR-CERT- │
  │                    │                       │    2026-…); gửi     │
  │                    │                       │    email             │
  │                    │                       │    course-completed  │
  │                    │                       │    + gợi ý khóa tiếp │
  │                    │                       │    theo              │
  │                    │◄──────────────────────┤                      │
  │ 9. Xem/tải chứng   │                       │                      │
  │    chỉ tại          │                       │                      │
  │    /hoc-vien/       │                       │                      │
  │    chung-chi        │                       │                      │
  │◄───────────────────┤                       │                      │
```

### Trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| Chưa làm quiz | Chưa có `quiz_attempts` cho bài đó |
| Đã nộp | Có `quiz_attempts` (điểm, tổng số câu, đáp án đã chọn, thời gian nộp) |
| Khóa `completed` | Tất cả bài trong khóa đều `completed` |
| Đã cấp chứng chỉ | Có `certificates` (UNIQUE user + course, mã duy nhất) |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| Client tự chấm điểm / gửi điểm giả | Không thể xảy ra ở luồng đúng | Chấm điểm chỉ ở server; client chỉ gửi đáp án đã chọn, không gửi điểm |
| Đáp án đúng lộ cho client | Response quiz chứa `is_correct` | Không bao giờ trả `is_correct` cho client; đáp án đúng chỉ trả sau khi nộp; đáp án đúng chỉ đọc qua VIEW `quiz_options_public` (không có cột `is_correct`) |
| Nộp trùng (bấm nộp 2 lần) | 2 request submit | `Idempotency-Key` chống ghi trùng; chỉ lưu 1 lần nộp |
| Chưa hoàn thành đủ bài mà đòi chứng chỉ | Chưa đủ bài `completed` | Không tạo chứng chỉ; hiện % hoàn thành và danh sách bài còn thiếu |
| Quiz không phải điều kiện bắt buộc | Tùy từng khóa | Quiz không bắt buộc để hoàn thành bài, trừ khi khóa học ghi rõ — quyết theo từng khóa khi nhập nội dung |

---

## Flow 8 — Không hoạt động → email chăm sóc

**Mục đích:** nhắc học viên quay lại học và nhắc các sự kiện/đơn hàng, qua email Resend.
**Tác nhân:** hệ thống (Workers Cron chạy mỗi giờ) → học viên. **Giới hạn:** Resend miễn phí tối đa **100 email/ngày** (reset 00:00 UTC), 3.000 email/tháng.

### Sơ đồ bước

```
Workers Cron (mỗi giờ)        Workers API              Resend              DB
  │                               │                       │                   │
  │ 1. Quét:                      │                       │                   │
  │    - enrollment active, chưa  │                       │                   │
  │      hoàn thành, không học    │                       │                   │
  │      7 ngày → E10             │                       │                   │
  │    - đơn pending quá 12h/24h  │                       │                   │
  │      → E6/E7                  │                       │                   │
  │    - sự kiện sắp diễn ra      │                       │                   │
  │      (trước 1 ngày) → E11     │                       │                   │
  │                               │                       │                   │
  │ 2. Xếp hàng email theo thứ    │                       │                   │
  │    tự ưu tiên: giao dịch      │                       │                   │
  │    (E3/E5/E8) trước, email    │                       │                   │
  │    nhắc (E6/E7/E10/E11) sau   │                       │                   │
  │                               │                       │                   │
  │                               │ 3. Gửi qua Resend     │                   │
  │                               │    (API key ở server) │                   │
  │                               │──────────────────────►│                   │
  │                               │                       │ 4. Cập nhật trạng  │
  │                               │                       │    thái qua webhook│
  │                               │                       │    Resend →        │
  │                               │                       │    email_logs      │
  │                               │◄──────────────────────┤                   │
  │                               │                       │                   │
  │ 5. Học viên nhận email, bấm   │                       │                   │
  │    link quay lại bài học /    │                       │                   │
  │    sự kiện / thanh toán       │                       │                   │
```

### Bảng email liên quan (trích từ tài liệu kiến trúc §10.2)

| Mã | Trigger | Template | Ghi chú |
|---|---|---|---|
| E6 | Đơn quá 12h chưa trả | `order-reminder-12h` | Nhắc thanh toán, kèm lại QR/mã đơn |
| E7 | Đơn quá 24h chưa trả | `order-reminder-24h` | Nhắc lần 2 |
| E10 | Học viên không học 7 ngày | `lesson-reminder-7d` | Chỉ gửi nếu enrollment còn `active` và chưa hoàn thành |
| E11 | Sự kiện sắp diễn ra (trước 1 ngày) | `event-reminder` | Link, giờ, chuẩn bị. 3 sự kiện ngày **25/11/2026**; giờ + hình thức từng sự kiện chưa có — không bịa |
| E1/E3/E5/E8 | Đăng ký / lead / tạo đơn / đã trả | `welcome` / `lead-received` / `order-created` / `order-paid` | Email giao dịch — ưu tiên cao nhất khi chạm giới hạn |

### Trạng thái

| Trạng thái `email_logs` | Ý nghĩa |
|---|---|
| `queued` | Đã xếp hàng, chưa gửi |
| `sent` | Đã gửi qua Resend (có `resend_id`) |
| `delivered` | Resend webhook xác nhận đã tới hộp thư |
| `bounced` | Bị trả lại (email không tồn tại / hộp thư đầy) |
| `failed` | Gửi lỗi (VD vượt quota ngày) |

### Lỗi và cách xử lý

| Lỗi | Biểu hiện | Cách xử lý |
|---|---|---|
| Vượt 100 email/ngày | Email thứ 101 trong ngày → lỗi `daily_quota_exceeded` | Xếp hàng email nhắc (E6/E7/E10/E11) sang ngày hôm sau; ưu tiên email giao dịch (E3/E5/E8, xác minh, đặt lại mật khẩu); admin nhận cảnh báo qua báo cáo email (R8). Nâng Resend Pro chỉ khi được phê duyệt — giá cần xác minh lại |
| Email vào thư rác / không tới | Học viên báo không nhận được | Gửi từ domain riêng đã xác minh DNS (SPF, DKIM, DMARC); không gửi từ `onboarding@resend.dev` cho người dùng thật; kiểm tra `email_logs` + webhook Resend |
| Email bị `bounced` | Địa chỉ không tồn tại | Đánh dấu trong `email_logs`; không gửi lại cùng địa chỉ cho tới khi học viên cập nhật email |
| Học viên đã hoàn thành / đã trả rồi mà vẫn nhận email nhắc | Email nhắc gửi sau khi trạng thái đã đổi | Cron kiểm tra lại trạng thái ngay trước khi gửi (enrollment còn `active`, đơn còn `pending`); hủy email nhắc nếu trạng thái đã đổi |
| Học viên hủy nhận tin | Bấm hủy trong email | `POST /api/newsletter/unsubscribe` → `newsletter_subscribers.status = unsubscribed`; không gửi email nhắc marketing sau đó (email giao dịch vẫn gửi) |

---

## Flow 9 — Admin → báo cáo

**Mục đích:** admin xem tổng quan, đối soát và ra quyết định vận hành.
**Tác nhân:** admin (Lê Đăng Quyết + người được ủy quyền). **Kênh:** `/admin/*`, chỉ role `admin`.

### Sơ đồ bước

```
Admin                Frontend              Workers API              DB
  │                    │                       │                      │
  │ 1. Đăng nhập, vào  │                       │                      │
  │    /admin          │                       │                      │
  │───────────────────►│                       │                      │
  │                    │ 2. GET /api/admin/    │                      │
  │                    │    reports/overview   │                      │
  │                    │    + JWT ────────────►│                      │
  │                    │                       │ 3. Kiểm tra role =   │
  │                    │                       │    admin; tổng hợp   │
  │                    │                       │    ở server, cache,  │
  │                    │                       │    phân trang        │
  │                    │◄──────────────────────┤                      │
  │ 4. Xem dashboard:  │                       │                      │
  │    tổng học viên,  │                       │                      │
  │    lead, đơn,      │                       │                      │
  │    doanh thu, tỷ   │                       │                      │
  │    lệ lead→đơn     │                       │                      │
  │◄───────────────────┤                       │                      │
  │                    │                       │                      │
  │ 5. Đối soát hằng   │                       │                      │
  │    ngày (R9): đơn  │                       │                      │
  │    pending quá hạn,│                       │                      │
  │    payment không   │                       │                      │
  │    khớp, webhook   │                       │                      │
  │    lỗi; kiểm tra   │                       │                      │
  │    Sheet khớp với  │                       │                      │
  │    leads trong DB  │                       │                      │
  │───────────────────►│                       │                      │
  │                    │                       │                      │
  │ 6. Thao tác: đổi   │                       │                      │
  │    trạng thái lead,│                       │                      │
  │    mark-paid đơn,  │                       │                      │
  │    hoàn trả, cấp   │                       │                      │
  │    role, sửa khóa  │                       │                      │
  │    học → ghi       │                       │                      │
  │    audit_logs      │                       │                      │
  │───────────────────►│                       │                      │
```

### Bảng báo cáo (trích từ tài liệu kiến trúc §11.2)

| Mã | Báo cáo | Endpoint | Chỉ số chính |
|---|---|---|---|
| R1 | Tổng quan | `GET /api/admin/reports/overview` | Tổng học viên, lead, đơn, doanh thu, tỷ lệ chuyển đổi lead→đơn |
| R2 | Lead | `GET /api/admin/reports/leads` | Lead mới theo trạng thái, nguồn, khóa, tỉnh |
| R3 | Học viên theo khóa | `GET /api/admin/reports/courses` | Số ghi danh, % hoàn thành, số chứng chỉ/khóa |
| R4 | Doanh thu | `GET /api/admin/reports/revenue` | Doanh thu theo ngày/tuần/tháng, theo khóa, theo phương thức; đơn pending quá hạn; hoàn trả |
| R5 | Tiến độ học tập | `GET /api/admin/reports/progress` | % hoàn thành trung bình/khóa; học viên không học 7/14/30 ngày; bài có tỷ lệ bỏ cao nhất |
| R6 | Quiz | `GET /api/admin/reports/quiz` | Điểm trung bình/bài; câu hỏi nhiều người sai nhất |
| R7 | Sự kiện | `GET /api/admin/reports/events` | Số đăng ký/sự kiện; tỷ lệ tham dự (nếu có điểm danh) |
| R8 | Email | `GET /api/admin/reports/email` | Email gửi/delivered/bounced/failed theo template; số lần chạm giới hạn Resend |
| R9 | Đối soát thanh toán | `GET /api/admin/reports/reconciliation` | Đơn `pending` quá 48h; đơn `paid` chưa có enrollment; payment không khớp order; webhook lỗi |
| R10 | Tăng trưởng | `GET /api/admin/reports/growth` | Học viên mới/tuần, MAU, retention (quay lại học sau 7/30 ngày) |

### Nhịp vận hành

- **Mỗi sáng:** mở R9 — đơn pending quá hạn, payment không khớp, webhook lỗi; kiểm tra Sheet khớp với `leads` trong DB.
- **Mỗi tuần:** xem R1–R4 — lead, ghi danh, doanh thu; quyết định chương trình nào cần nội dung mới.
- **Mỗi tháng:** xem R5, R6, R10 — bài học nào học viên bỏ nhiều, quiz nào khó, retention; kiểm tra dung lượng Supabase và Storage còn bao nhiêu.

### Trạng thái và lỗi

| Tình huống | Cách xử lý |
|---|---|
| Không phải admin mà gọi API báo cáo | API từ chối (kiểm tra role ở Workers + RLS ở DB); chỉ `admin` xem được |
| Đơn `paid` nhưng chưa có enrollment | Báo cáo R9 phát hiện; admin tạo enrollment bù và ghi `audit_logs`, kiểm tra lại webhook/mark-paid |
| Payment không khớp order (sai số tiền/mã đơn) | R9 phát hiện; admin đối soát tay với sao kê MB Bank, liên hệ học viên |
| Số liệu lead trong Sheet khác DB | DB là nguồn sự thật; đối soát và ghi bù Sheet; khi API lead ổn định thì bỏ Sheet |
| Báo cáo nặng / chậm | Tổng hợp ở server, cache, phân trang; không đọc báo cáo từ Sheet |

---

## Quyết định cần phê duyệt

1. **Chấp nhận 9 flow trên làm hành trình chuẩn** của nền tảng mới (khách → đăng ký → xác minh email → đăng nhập → ghi danh miễn phí / mua khóa → học → quiz → chứng chỉ → email chăm sóc → báo cáo admin).
2. **Ngưỡng hoàn thành theo module** — 90% video / bấm “Đã hoàn thành” bài text, `lessons.slug` UNIQUE theo module (đã chốt theo Quyết định 17; xác nhận lại trong buổi phê duyệt kiến trúc).
3. **Thanh toán giai đoạn đầu:** chuyển khoản thủ công MB Bank + đối soát tay (QR cũ dùng được), SePay triển khai sau khi phê duyệt — giá SePay cần xác minh lại.
4. **Email chăm sóc khi chạm giới hạn Resend 100 email/ngày:** xếp hàng email nhắc sang hôm sau, ưu tiên email giao dịch; nâng Resend Pro chỉ khi được phê duyệt — giá cần xác minh lại.
5. **Nhánh fallback form và PII mailto/clipboard trên trang hiện tại giữ nguyên** theo Quyết định 3 và 8 (rủi ro đã cảnh báo); luồng mới không hiện “thành công giả”.
6. **API làm lớp trước rồi ghi Sheet cho lead** (Quyết định 5); Sheet chỉ là bản sao đối soát, DB là nguồn sự thật.
7. **Sự kiện ngày 25/11/2026:** xác nhận giờ + hình thức từng sự kiện (hiện chưa có — không tự bịa).
8. **Tài liệu này chỉ mô tả hành trình — chưa viết code, chưa tạo database, chưa deploy.** Mọi triển khai chỉ bắt đầu sau khi tài liệu kiến trúc tổng thể và file này được phê duyệt.
