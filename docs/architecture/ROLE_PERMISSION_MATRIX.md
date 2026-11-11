# Ma trận quyền theo vai trò (RBAC) — Nền tảng E-learning Visfar Academy

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt kiến trúc
**Nguồn:** Tài liệu kiến trúc tổng thể `Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (§5 Phân quyền RBAC, §6 Bảo mật RLS) và `docs/DECISIONS.md` (19 quyết định đã chốt ngày 10/11/2026).
**Phạm vi:** TASK 02 — Visfar Academy. Chỉ là tài liệu kiến trúc. **Chưa viết code, chưa tạo database, chưa deploy.** Không sửa code/file HTML gốc, không thay đổi schema.

---

## 1. Vai trò

| Vai trò | Ai | Ghi chú |
|---|---|---|
| `guest` — khách | Chưa đăng nhập | Không có tài khoản hoặc chưa đăng nhập; chỉ truy cập nội dung công khai và gửi lead/newsletter |
| `student` — học viên | Người đã đăng ký tài khoản | Vai trò mặc định khi đăng ký (`profiles.role` mặc định `'student'`) |
| `instructor` — giảng viên | Do admin cấp | Mọi quyền của `student`, cộng quyền trên khóa mình phụ trách |
| `admin` — quản trị viên | Lê Đăng Quyết + người được ủy quyền | Quyền cao nhất; không có role `superadmin` riêng trong giai đoạn đầu |

**Quy tắc chung:**

- Quyền của vai trò cao hơn bao gồm quyền của vai trò thấp hơn, trừ khi ô ma trận ghi rõ ngoại lệ.
- Mọi quyền đều được kiểm tra ở **2 lớp** (xem §3): RLS ở database và kiểm tra role ở Workers API. Chỉ kiểm tra ở 1 lớp là không đủ.
- Không có role nào được tự nâng cấp role của chính mình; chỉ `admin` cấp/thu hồi role.
- `instructor` không có quyền xem lead, không sửa giá khóa học, không chạm vào đơn hàng/thanh toán (theo §5.1).

---

## 2. Ma trận quyền

Ký hiệu: ✓ = được phép · ✗ = không được phép · ô có chữ = chỉ được phép với điều kiện ghi trong ô.

### 2.1. Nội dung công khai và học tập

| # | Hành động | Khách | student | instructor | admin |
|---|---|---|---|---|---|
| 1 | Xem nội dung công khai (khóa học đã `published`, bài blog đã `published`, sự kiện, chính sách bản hiện tại) | ✓ | ✓ | ✓ | ✓ |
| 2 | Xem bài học — bài xem thử (`is_free_preview = true`) | ✓ | ✓ | ✓ | ✓ |
| 3 | Xem bài học — bài không phải xem thử | ✗ | Chỉ khóa đã ghi danh và enrollment còn `active` | Khóa phụ trách + khóa đã ghi danh | ✓ |
| 4 | Xem video bài giảng (YouTube unlisted) và tải tài liệu bài học | ✗ | Chỉ khóa đã ghi danh (tài liệu qua signed URL, hết hạn sau 1 giờ) | Khóa phụ trách + khóa đã ghi danh | ✓ |
| 5 | Ghi danh khóa miễn phí (`price_vnd = 0`, gồm khóa “Cộng đồng Visfar”) | ✗ (phải đăng nhập) | ✓ | ✓ | ✓ |
| 6 | Ghi danh khóa trả phí / Tùy tâm | ✗ | Chỉ qua đơn đã `paid` (không có đường tắt) | Chỉ qua đơn đã `paid` | ✓ (kể cả tặng — phải ghi `audit_logs`) |
| 7 | Nộp quiz / ghi tiến độ học (`lesson_progress`, `quiz_attempts`) | ✗ | Chỉ khóa đã ghi danh | Chỉ khóa đã ghi danh (không được ghi tiến độ cho học viên khác) | ✓ (chỉ để test) |
| 8 | Xem tiến độ của chính mình | ✗ | Của mình | Của mình | Của mình |
| 9 | Xem tiến độ học viên khác | ✗ | ✗ | Chỉ khóa phụ trách | ✓ |
| 10 | Xem chứng chỉ của chính mình | ✗ | Của mình | Của mình | Của mình |
| 11 | Xem chứng chỉ của học viên khác | ✗ | ✗ | Chỉ khóa phụ trách | ✓ |

### 2.2. Đơn hàng và thanh toán

| # | Hành động | Khách | student | instructor | admin |
|---|---|---|---|---|---|
| 12 | Tạo đơn / thanh toán (chuyển khoản thủ công giai đoạn đầu; SePay/Stripe chỉ khi được phê duyệt) | ✗ | Cho chính mình | Cho chính mình | Cho chính mình |
| 13 | Xem đơn / payment của chính mình | ✗ | Của mình | Của mình | Của mình |
| 14 | Xem đơn / payment của người khác | ✗ | ✗ | ✗ | ✓ (mọi đơn) |
| 15 | Xác nhận thanh toán thủ công (đổi đơn sang `paid`, tạo `payments`, tạo enrollment) | ✗ | ✗ | ✗ | ✓ |
| 16 | Hủy đơn `pending` | ✗ | Đơn của mình | Đơn của mình | Mọi đơn |
| 17 | Hoàn trả đơn (`refunded`, thu hồi enrollment) | ✗ | ✗ | ✗ | ✓ (theo chính sách hoàn trả 15 ngày làm việc đã chốt) |

**Nguyên tắc bất di bất dịch:** không bao giờ tin client báo “đã trả”. Đơn chỉ chuyển sang `paid` khi webhook cổng thanh toán xác minh chữ ký, hoặc admin xác nhận thủ công sau khi kiểm tra sao kê.

### 2.3. Lead, hồ sơ và đăng ký sự kiện / newsletter

| # | Hành động | Khách | student | instructor | admin |
|---|---|---|---|---|---|
| 18 | Tạo lead tư vấn (`POST /api/leads`) | ✓ (qua Workers API, có validation, rate-limit, honeypot + CAPTCHA, idempotency; không ghi trực tiếp vào DB) | ✓ | ✓ | ✓ |
| 19 | Xem lead | ✗ | ✗ | ✗ | ✓ |
| 20 | Đổi trạng thái / ghi chú lead | ✗ | ✗ | ✗ | ✓ |
| 21 | Xem / sửa hồ sơ của chính mình | ✗ | Của mình | Của mình | Của mình |
| 22 | Xem hồ sơ học viên khác | ✗ | ✗ | Chỉ học viên của khóa phụ trách (chỉ trường phục vụ giảng dạy: họ tên, tiến độ) | ✓ |
| 23 | Đăng ký sự kiện (`event_registrations`, kể cả bằng email khi chưa đăng nhập) | ✓ (bằng email) | ✓ | ✓ | ✓ |
| 24 | Hủy đăng ký sự kiện của chính mình | ✓ (đăng ký bằng email của mình) | Của mình | Của mình | Của mình |
| 25 | Xem danh sách người đăng ký sự kiện | ✗ | ✗ | Chỉ sự kiện thuộc khóa phụ trách (nếu có) | ✓ |
| 26 | Đăng ký newsletter (footer) | ✓ (ghi thật vào Sheet/dịch vụ email — không còn newsletter giả) | ✓ | ✓ | ✓ |
| 27 | Hủy nhận newsletter | ✓ (qua token trong email) | ✓ | ✓ | ✓ |
| 28 | Xem danh sách newsletter subscribers | ✗ | ✗ | ✗ | ✓ |

### 2.4. Quản trị nội dung và hệ thống

| # | Hành động | Khách | student | instructor | admin |
|---|---|---|---|---|---|
| 29 | Tạo / sửa / xóa khóa học (`courses`) — gồm giá (`price_vnd`), trạng thái `draft`/`published`/`archived` | ✗ | ✗ | ✗ (không sửa giá, không tạo khóa) | ✓ |
| 30 | Tạo / sửa bài học, module, quiz (`modules`, `lessons`, `quiz_questions`, `quiz_options`) | ✗ | ✗ | Chỉ bài học của khóa phụ trách (không sửa giá, không sửa đơn hàng) | ✓ |
| 31 | Xem đáp án đúng của quiz (`quiz_options.is_correct`) | ✗ | ✗ (client chỉ đọc VIEW `quiz_options_public`, không có `is_correct`; chấm điểm ở server) | ✗ (chấm điểm ở server; giảng viên không tự xem đáp án qua client) | ✗ qua client (chỉ Workers service-role đọc để chấm) |
| 32 | Quản lý sự kiện (`events`: tạo/sửa/đổi trạng thái) | ✗ | ✗ | ✗ | ✓ |
| 33 | Quản lý blog (`posts`: tạo/sửa/xuất bản) | ✗ | ✗ | ✗ | ✓ |
| 34 | Quản lý chính sách (`policies`: tạo version mới — không sửa version cũ) | ✗ | ✗ | ✗ | ✓ |
| 35 | Xem báo cáo tổng hợp | ✗ | ✗ | Chỉ báo cáo của khóa phụ trách | ✓ (mọi báo cáo) |
| 36 | Xem báo cáo doanh thu / đơn hàng toàn hệ thống | ✗ | ✗ | ✗ | ✓ |
| 37 | Cấp / thu hồi role (`PATCH /api/admin/users/:id/role`) | ✗ | ✗ | ✗ | ✓ |
| 38 | Xem audit log (`audit_logs`) | ✗ | ✗ | ✗ | ✓ |
| 39 | Xem email log (`email_logs`, đối soát Resend) | ✗ | ✗ | ✗ | ✓ |
| 40 | Quản lý học viên (danh sách, vô hiệu hóa tài khoản thay vì xóa) | ✗ | ✗ | Chỉ danh sách học viên khóa phụ trách | ✓ |

---

## 3. Quyền được kiểm tra ở 2 lớp

Mọi hành động nhạy cảm phải qua **cả hai lớp**. Một lớp chỉ là chặn cuối, không phải đường ghi chính.

### Lớp 1 — RLS ở database (PostgreSQL trên Supabase)

- Bật RLS trên **mọi bảng** (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`). Mặc định từ chối: không có policy nào cho phép thì không đọc/ghi được gì.
- Anon key chỉ đọc nội dung công khai; không bao giờ được `INSERT`/`UPDATE`/`DELETE` vào bảng nhạy cảm.
- Service-role key **chỉ ở Workers API, không bao giờ ở frontend**. Service-role bypass RLS — chỉ dùng khi Workers đã xác minh JWT + role + nghiệp vụ.
- Hàm phụ `public.current_role()` lấy role từ `profiles` theo `auth.uid()` để dùng trong policy.
- Client không bao giờ chạm trực tiếp vào dữ liệu của người khác; mọi ghi nhạy cảm (`orders`, `payments`, `lesson_progress`, `quiz_attempts`, `leads`) đi qua Workers API.

### Lớp 2 — Kiểm tra role ở Workers API

- Workers xác minh JWT bằng Supabase JWKS (không tin JWT do client tự khai); token hết hạn → refresh.
- Mỗi endpoint kiểm tra role trước khi xử lý nghiệp vụ, ví dụ:
  - `POST /api/my/progress` — kiểm tra enrollment còn `active` và bài học thuộc khóa đã ghi danh, kiểm tra ngưỡng tiến độ hợp lý (chống ghi tiến độ giả).
  - `POST /api/my/quiz/:lessonId/submit` — chấm ở server, không tin điểm do client gửi.
  - `POST /api/orders` — chỉ tạo đơn cho chính người gọi; đơn chỉ sang `paid` qua webhook đã xác minh chữ ký hoặc admin xác nhận thủ công.
  - `PATCH /api/admin/users/:id/role`, `POST /api/admin/orders/:id/mark-paid`, `GET /api/admin/*` — chỉ role `admin`.
  - Endpoint giảng viên (sửa bài học khóa phụ trách) — kiểm tra `course_instructors` (xem §5, lưu ý về migration).
- Validation server cho mọi field (không tin validation client): SĐT `^0\d{9}$`, email TLD ≥ 2 ký tự, `province` trong 34 tỉnh/thành, `course_id` tồn tại và `published`.
- Rate-limit theo IP + user (VD lead: tối đa 5 lần/giờ/IP); chống spam bằng honeypot + CAPTCHA (theo Quyết định 4); mọi POST tạo dữ liệu nhận header `Idempotency-Key` để chống ghi trùng.

### Vì sao cần cả 2 lớp

| Rủi ro | Lớp chặn |
|---|---|
| Học viên đọc đơn/progress của người khác qua Supabase trực tiếp | RLS (`user_id = auth.uid()`) |
| Học viên tự chấm quiz điểm 10, tự ghi tiến độ 100% | Workers API (chấm ở server, kiểm tra enrollment) |
| Client tự tạo đơn “đã trả” | Workers API (chỉ server đổi sang `paid`) |
| Spam lead như Apps Script hiện tại | Workers API (validation, rate-limit, CAPTCHA, honeypot, idempotency) |
| Giảng viên sửa giá khóa / xem lead / xác nhận thanh toán | Cả 2 lớp: RLS không có policy cho instructor trên các bảng đó; API từ chối role không phải admin |

---

## 4. Bảng RLS tóm tắt theo bảng dữ liệu

Tóm tắt từ §6.2 của tài liệu kiến trúc tổng thể. “Qua Workers” = client không có policy ghi trực tiếp; Workers dùng service-role sau khi đã xác minh JWT + role + nghiệp vụ.

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Mình + admin | Mình (khi đăng ký) | Mình + admin | Không (admin vô hiệu hóa thay vì xóa) |
| `courses` | Công khai nếu `published` | Admin | Admin | Admin (nên archive thay vì xóa) |
| `modules`, `lessons` | Công khai nếu khóa `published`; bài không xem thử chỉ khi đã ghi danh (kiểm tra ở API) | Admin / instructor (khóa phụ trách) | Admin / instructor (khóa phụ trách) | Admin |
| `quiz_questions` | Như `lessons` | Admin | Admin | Admin |
| `quiz_options` | Qua VIEW `quiz_options_public` (không `is_correct`) | Admin | Admin | Admin |
| `enrollments` | Mình + admin | Qua Workers | Admin (đổi status) | Không |
| `lesson_progress` | Mình + admin (+ instructor: chỉ học viên khóa phụ trách) | Mình (qua Workers) | Mình (qua Workers) | Không |
| `quiz_attempts` | Mình + admin (+ instructor: chỉ học viên khóa phụ trách) | Qua Workers | Không | Không |
| `leads` | Admin | Qua Workers (service-role) | Admin | Không |
| `orders` | Mình + admin | Qua Workers | Admin / Workers | Không |
| `payments` | Admin | Qua Workers | Workers | Không |
| `certificates` | Mình + admin | Qua Workers | Không | Không |
| `events` | Công khai nếu `upcoming`/`happened` | Admin | Admin | Admin |
| `event_registrations` | Mình + admin | Mình (qua Workers) | Không | Mình (hủy) |
| `posts` | Công khai nếu `published` | Admin | Admin | Admin |
| `policies` | Công khai nếu `is_current` | Admin | Admin (tạo version mới, không sửa version cũ) | Không |
| `email_logs` | Admin | Qua Workers | Workers | Không |
| `newsletter_subscribers` | Admin | Qua Workers | Qua Workers (unsubscribe) | Không |
| `audit_logs` | Admin | Qua Workers | Không | Không |

**Ghi chú về `lesson_progress` / `quiz_attempts` cho instructor:** §6.2 của tài liệu kiến trúc chỉ ghi policy “Mình + admin”. Quyền instructor “xem tiến độ học viên khóa phụ trách” (§5.1) cần thêm policy SELECT cho instructor giới hạn theo khóa phụ trách — policy này phụ thuộc bảng `course_instructors` (xem §5) và được viết trong migration khi bảng đó tồn tại.

**Bảo mật khác (ngoài RLS, theo §6.3):** JWT xác minh bằng JWKS; rate-limit; validation server; xác minh chữ ký webhook (SePay/Stripe/Resend); PII không đưa vào `mailto:`, clipboard, URL, log (chỉ ghi `reference_code` và `user_id`); Storage chia bucket `public`/`private` (tài liệu bài học chỉ lấy được bằng signed URL, hết hạn sau 1 giờ); CSP + security header; secret chỉ trong Cloudflare Workers Secrets / GitHub Secrets.

---

## 5. Lưu ý: bảng `course_instructors` — cần migration sau

**Vấn đề:** Quyền của instructor (“khóa phụ trách”) trong ma trận này — sửa bài học của khóa phụ trách, xem tiến độ học viên khóa phụ trách, xem báo cáo khóa phụ trách — cần một bảng liên kết giảng viên ↔ khóa học để kiểm tra ở cả RLS lẫn Workers API. **Bảng này chưa có trong schema Module 1** (tài liệu kiến trúc tổng thể §3.2).

**Quyết định trong file này:**

- **Không tự ý thêm schema ở file này.** File này chỉ ghi ma trận quyền, không định nghĩa bảng mới.
- Bảng `course_instructors` (dự kiến: `course_id`, `instructor_id` → `profiles(id)`, `assigned_at`, `assigned_by`) cần được tạo bằng **migration mới** (`0004_course_instructors.sql` hoặc số tiếp theo) trong giai đoạn lập trình, sau khi kiến trúc được phê duyệt.
- Cho tới khi migration đó tồn tại, quyền instructor theo “khóa phụ trách” **chưa thể thực thi**: instructor tạm thời chỉ có quyền như `student` (xem bài học khóa đã ghi danh, ghi tiến độ của mình). Không được “tạm” gán quyền instructor bằng cách kiểm tra theo tên, email, hay danh sách cứng trong code.
- Khi migration có hiệu lực, cần bổ sung: policy RLS SELECT cho instructor trên `lesson_progress` / `quiz_attempts` / `enrollments` giới hạn theo `course_instructors`, và kiểm tra `course_instructors` trong Workers API trước mọi endpoint sửa bài học.
- Mọi lần gán/thu hồi giảng viên cho một khóa đều ghi `audit_logs` (actor là admin thực hiện).

---

## 6. Quyết định cần phê duyệt

1. **Chấp nhận ma trận quyền này** (4 vai trò, 40 hành động, 2 lớp kiểm tra) làm căn cứ lập trình Module 1, hay cần thêm/bớt hành động nào?
2. **Bảng `course_instructors`:** phê duyệt tạo bảng này bằng migration mới sau khi kiến trúc được duyệt (không thêm vào schema Module 1 hiện tại)? Và ai là người gán giảng viên cho khóa — chỉ admin?
3. **Instructor xem đáp án đúng của quiz:** ma trận hiện tại cấm giảng viên xem `is_correct` qua client (chấm ở server). Có cho giảng viên xem đáp án đúng của chính khóa mình phụ trách (để soạn bài / chữa bài) hay giữ nguyên cấm?
4. **Instructor xem hồ sơ học viên:** ma trận giới hạn ở họ tên + tiến độ phục vụ giảng dạy. Có mở rộng cho instructor xem SĐT/email học viên khóa phụ trách để liên hệ trực tiếp, hay mọi liên hệ đều qua admin?
5. **Admin tặng khóa (ghi danh không qua đơn đã trả):** có cho phép admin tặng khóa, với điều kiện bắt buộc ghi `audit_logs`? Ai được tặng và có giới hạn số lượng không?
6. **Policy RLS cho instructor trên `lesson_progress` / `quiz_attempts`:** phê duyệt bổ sung policy này cùng migration `course_instructors`, hay để instructor xem tiến độ qua Workers API báo cáo (không đọc trực tiếp qua RLS)?
7. **Quyền quản lý sự kiện/blog/chính sách cho instructor:** ma trận hiện tại chỉ cho admin. Có cho instructor tạo/sửa bài blog hoặc sự kiện của khóa mình phụ trách không, hay giữ nguyên chỉ admin?

---

*Hết file. Không viết code, không tạo database, không deploy, không thay đổi schema trong file này.*
