# Chính sách Row Level Security (RLS) — Nền tảng Visfar Academy

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt
**Phạm vi:** TASK 03 — Visfar Academy. Chỉ là tài liệu đặc tả. **Không triển khai database, không sửa code, không chạy migration.**
**Tài liệu nguồn:**
- `docs/DECISIONS.md` (19 quyết định ngày 10/11/2026 + 16 quyết định Task 02)
- `docs/architecture/ROLE_PERMISSION_MATRIX.md` (§2 ma trận quyền, §3 hai lớp kiểm tra, §4 bảng RLS tóm tắt, §5 bảng `course_instructors`)
- `docs/architecture/API_ARCHITECTURE.md` (§3 JWT, §4 idempotency, §5 rate-limit, §6 validation, §10 webhook)
- `Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (§5 RBAC, §6 bảo mật RLS, §8 luồng thanh toán)
- `docs/database/DATABASE_SCHEMA.md` (Task 03 — thiết kế 31 bảng + bảng bổ sung; xem §0.2 về giới hạn)
- `supabase/migrations/0001_init_schema.sql` (schema Module 1 — 19 bảng theo tài liệu kiến trúc, 20 bảng đếm trực tiếp trong file)

---

## 0. Phạm vi bảng

### 0.1. Tổng số bảng: 38

Tài liệu này viết policy cho **38 bảng vật lý** sau migration Task 03 (theo `DATABASE_SCHEMA.md` §0): 31 bảng trong danh sách Task 03 + 2 bảng bổ sung đã phê duyệt + 5 bảng Module 1 giữ nguyên.

| Nhóm | Bảng |
|---|---|
| 31 bảng Task 03 | `profiles`, `user_roles`, `courses`, `categories`, `course_modules`, `lessons`, `lesson_resources`, `enrollments`, `lesson_progress`, `learning_events`, `quizzes`, `questions`, `quiz_attempts`, `answers`, `assignments`, `submissions`, `submission_reviews`, `orders`, `order_items`, `payments`, `coupons`, `membership_plans`, `memberships`, `certificates`, `leads`, `notifications`, `email_logs`, `automation_events`, `activity_logs`, `audit_logs`, `system_settings` |
| Bổ sung đã phê duyệt (2 bảng) | `course_instructors` (Task 02 QĐ 3), `question_options` (giữ đáp án đúng, đổi tên từ `quiz_options`) |
| Module 1 giữ nguyên (5 bảng) | `events`, `event_registrations`, `posts`, `policies`, `newsletter_subscribers` |

### 0.2. Giới hạn cần ghi rõ

- **Đổi tên so với Module 1 (3 bảng):** `modules` → `course_modules`; `quiz_questions` → `questions`; `quiz_options` → `question_options` (tên đề xuất). Mọi policy dưới đây dùng **tên mới**.
- **`DATABASE_SCHEMA.md` tại thời điểm viết tài liệu này mới chi tiết tới §3.21 (`coupons`)**; các mục §3.22–§3.31 (`membership_plans`, `memberships`, `certificates`, `leads`, `notifications`, `email_logs`, `automation_events`, `activity_logs`, `audit_logs`, `system_settings`) **chưa được viết trong file schema đó**. Policy cho 10 bảng này dưới đây viết theo định nghĩa Module 1 (§3.2 tài liệu kiến trúc tổng thể) + nguyên tắc §1, và **phải đối chiếu lại khi §3.22–§3.31 của schema hoàn thành** — đặc biệt là tên cột (VD `notifications`, `system_settings` dùng `key` làm PK).
- **Tên bảng `answers` gây nhầm:** `answers` là đáp án **học viên đã chọn** (mỗi dòng = 1 câu trả lời của 1 lượt làm bài), **không phải đáp án đúng**. Đáp án đúng vẫn nằm ở `question_options.is_correct` (§4.2). Tên thay thế đã cân nhắc trong schema là `quiz_answers` — xem quyết định cần phê duyệt số 8 (§9.8).
- **`profiles.role` vs `user_roles`:** schema giữ `profiles.role` làm cache đọc nhanh cho RLS (`current_role()`), nguồn sự thật về lịch sử cấp/thu hồi role là `user_roles`; hai nơi đồng bộ bằng trigger. Nếu phê duyệt “`profiles.role` là nguồn duy nhất, không cần `user_roles`” thì bỏ bảng `user_roles` (schema §9, Q3) và policy tương ứng. Xem §9.7.
- Mọi policy dưới đây là **đặc tả để viết migration**, chưa phải SQL đã chạy. SQL mẫu ở §7 là mẫu tham khảo, cần kiểm tra lại trên staging trước khi áp vào production.

---

## 1. Nguyên tắc chung

1. **Bật RLS trên mọi bảng** (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`). Không có bảng nào để RLS tắt.
2. **Mặc định từ chối.** Không có policy nào cho phép thì không đọc/ghi được gì — kể cả `authenticated`.
3. **RLS chỉ là lớp chặn cuối, không phải đường ghi chính.** Mọi ghi nhạy cảm (`leads`, `orders`, `payments`, `enrollments`, `lesson_progress`, `quiz_attempts`, `answers`, `submissions`, `certificates`, `audit_logs`, `activity_logs`, `learning_events`, `email_logs`) đi qua **Workers API bằng service-role key** sau khi API đã xác minh JWT + role + nghiệp vụ. Client (anon key hoặc JWT của user) **không bao giờ** ghi trực tiếp vào các bảng này. Policy INSERT/UPDATE trực tiếp cho client ở các bảng đó — nếu có — chỉ tồn tại để chặn (mức tối thiểu), không phải để frontend dùng.
4. **Service-role bypass RLS.** Service-role key chỉ nằm ở Workers API, không bao giờ ở frontend. Mọi thao tác service-role đều phải đi kèm kiểm tra JWT + role ở API trước (xem `SECURITY_MODEL.md` §2).
5. **Không role nào tự nâng cấp role của chính mình.** Chỉ `admin` cấp/thu hồi role (`PATCH /api/admin/users/:id/role`), và mọi lần cấp/thu hồi đều ghi `user_roles` + `audit_logs`.
6. **Không hard-delete dữ liệu nghiệp vụ.** DELETE bị cấm ở hầu hết bảng; thay bằng trạng thái (`archived`, `revoked`, `cancelled`, `unsubscribed`, `deactivated`) hoặc `deleted_at`. Admin vô hiệu hóa tài khoản (`profiles.status = 'suspended'`/`'deactivated'`) thay vì xóa.
7. **Quyền instructor gắn với khóa được giao, không gắn với mọi khóa.** Mọi quyền instructor “khóa phụ trách” đều kiểm tra qua bảng `course_instructors` (`course_id`, `instructor_id`). Cho tới khi migration `course_instructors` tồn tại, instructor tạm thời chỉ có quyền như `student` — không được “tạm” gán quyền bằng tên, email hay danh sách cứng trong code (theo `ROLE_PERMISSION_MATRIX.md` §5).
8. **Hàm phụ dùng trong policy:**
   - `public.current_role()` — lấy `role` từ `profiles` theo `auth.uid()`; `SECURITY DEFINER`, `SET search_path = public` (đã có trong migration 0001; vẫn dùng cache `profiles.role`).
   - `public.is_instructor_of(p_course_id uuid)` — trả `true` khi `auth.uid()` có dòng trong `course_instructors` với `course_id = p_course_id` (thêm cùng migration `course_instructors`; xem §7.1).
   - `public.is_enrolled(p_course_id uuid)` — trả `true` khi `auth.uid()` có `enrollments` còn `status = 'active'` (hoặc `'completed'`) ở khóa đó.
   - `public.course_of_lesson(p_lesson_id uuid)` / `public.course_of_quiz(p_quiz_id uuid)` — lấy `course_id` qua chuỗi `lessons → course_modules → courses` (hoặc `quizzes → lessons → …`) để viết policy gọn cho các bảng con (xem §7.1).

---

## 2. Quy tắc theo vai trò (tóm tắt)

| Vai trò | Nguyên tắc RLS |
|---|---|
| `anon` (khách, chưa đăng nhập) | Chỉ `SELECT` nội dung công khai: khóa `published`, nhóm `categories` đang `is_active`, bài blog `published`, sự kiện `upcoming`/`happened`, chính sách bản `is_current`. **Không được `INSERT`/`UPDATE`/`DELETE` vào bất kỳ bảng nào** — kể cả `leads`, `orders`, `payments`, `event_registrations`, `newsletter_subscribers` (mọi ghi đều qua Workers API, kể cả ghi của khách). |
| `student` | Chỉ đọc/ghi dữ liệu của chính mình (`user_id = auth.uid()`). Chỉ đọc nội dung khóa đã ghi danh (phần không xem thử kiểm tra thêm ở API). Không đọc dữ liệu người khác, không đọc `is_correct`, không tự tạo enrollment. |
| `instructor` | Mọi quyền của `student`, cộng: đọc/sửa nội dung bài học của khóa phụ trách (không sửa giá, không tạo khóa); xem tiến độ, quiz, bài nộp và chứng chỉ của học viên khóa phụ trách; **được xem đáp án đúng quiz của khóa phụ trách và SĐT/email học viên khóa phụ trách** (Task 02 QĐ 6 — xem §4.3, đây là quyết định mới ghi đè ma trận cũ). Không xem lead, không chạm đơn hàng/thanh toán/coupon, không cấp role. |
| `admin` | Đọc/ghi quản trị theo ma trận quyền; là vai trò duy nhất đọc `leads`, `orders`/`payments` của người khác, `audit_logs`, `email_logs`, `newsletter_subscribers`, `system_settings`, `coupons`. Mọi thao tác admin đổi dữ liệu đều ghi `audit_logs` (qua API). |

---

## 3. Bảng policy đầy đủ (38 bảng)

Ký hiệu: **Mình** = `user_id = auth.uid()` (hoặc `id = auth.uid()` với `profiles`) · **Admin** = `public.current_role() = 'admin'` · **GV phụ trách** = `public.is_instructor_of(course_id)` · **Qua Workers** = không có policy ghi trực tiếp cho client; chỉ Workers dùng service-role sau khi xác minh JWT + role + nghiệp vụ · **—** = không có policy (mặc định từ chối) · **Công khai** = điều kiện trạng thái công khai, không cần đăng nhập.

### 3.1. Người dùng, vai trò, phân công, thông báo

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Mình + Admin + GV phụ trách (chỉ học viên của khóa phụ trách — xem §4.3) | Mình (khi đăng ký, qua trigger Supabase Auth) | Mình (chỉ trường của mình, không đổi `role`/`status`) + Admin | — (admin đổi `status` thành `suspended`/`deactivated` thay vì xóa) |
| `user_roles` | Mình (dòng của mình) + Admin | Admin (qua Workers, kèm `audit_logs`) | Admin (thu hồi: ghi `revoked_at`/`revoked_by`, qua Workers, kèm `audit_logs`) | — |
| `course_instructors` | Admin + GV (chỉ dòng của mình) | Admin (qua Workers, ghi `audit_logs`) | Admin (qua Workers, ghi `audit_logs`) | Admin (qua Workers, ghi `audit_logs`) |
| `notifications` | Mình (chỉ thông báo gửi cho mình) + Admin | Qua Workers (service-role) | Mình (chỉ đánh dấu đã đọc thông báo của mình) + Admin | — |

### 3.2. Khóa học và nội dung học tập

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `courses` | Công khai nếu `status = 'published'` | Admin | Admin | Admin (nên `archived` thay vì xóa; `RESTRICT` khi đã có đơn) |
| `categories` | Công khai nếu `is_active = true` | Admin | Admin | Admin (nên ẩn `is_active = false` thay vì xóa) |
| `course_modules` | Công khai nếu khóa `published` | Admin + GV phụ trách | Admin + GV phụ trách | Admin |
| `lessons` | Công khai nếu khóa `published` (bài không xem thử chỉ hiển thị đầy đủ qua API khi đã ghi danh — xem §4.1) | Admin + GV phụ trách | Admin + GV phụ trách | Admin |
| `lesson_resources` | Như `lessons` (file chỉ lấy qua signed URL sau khi API kiểm tra enrollment) | Admin + GV phụ trách | Admin + GV phụ trách | Admin |
| `quizzes` | Như `lessons` | Admin + GV phụ trách | Admin + GV phụ trách | Admin |
| `questions` | Như `lessons` (câu hỏi + lựa chọn qua VIEW, không kèm `is_correct` — xem §4.2) | Admin + GV phụ trách | Admin + GV phụ trách | Admin |
| `question_options` | **Không SELECT trực tiếp từ client.** Student đọc qua VIEW `quiz_options_public` (không có `is_correct`); GV phụ trách đọc bảng gốc (có `is_correct`) chỉ ở khóa phụ trách; Admin đọc qua API/service-role (xem §4.2) | Admin + GV phụ trách | Admin + GV phụ trách | Admin |
| `assignments` | Như `lessons` | Admin + GV phụ trách | Admin + GV phụ trách | Admin |
| `submissions` | Mình + GV phụ trách (bài nộp của học viên khóa phụ trách) + Admin | Mình (qua Workers — nộp bài) | Mình (sửa nháp/bài bị trả lại, qua Workers) + GV phụ trách/Admin (đổi `status` khi chấm — qua Workers, đồng bộ từ `submission_reviews`) | — |
| `submission_reviews` | Mình (review bài nộp của mình) + GV phụ trách (review bài nộp khóa phụ trách) + Admin | GV phụ trách + Admin (qua Workers — chấm bài) | GV phụ trách + Admin (chấm lại — qua Workers, ghi `audit_logs`) | — |

### 3.3. Học tập của học viên

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `enrollments` | Mình + Admin + GV phụ trách (chỉ học viên khóa phụ trách) | **Qua Workers** (xem §5 — không có policy INSERT cho client) | Admin (đổi `status`, qua Workers; kèm `audit_logs` khi tặng/thu hồi) | — |
| `lesson_progress` | Mình + Admin + GV phụ trách (chỉ học viên khóa phụ trách) | Mình (qua Workers) | Mình (qua Workers — server kiểm tra enrollment + ngưỡng hợp lý) | — |
| `learning_events` | Mình + Admin + GV phụ trách (chỉ học viên khóa phụ trách) | Qua Workers (service-role; chỉ ghi mốc 25/50/75/90/100%, không ghi mỗi giây) | — (append-only) | — |
| `quiz_attempts` | Mình + Admin + GV phụ trách (chỉ học viên khóa phụ trách) | Qua Workers (chấm ở server) | — (trạng thái `in_progress` → `submitted`/`expired` do Workers cập nhật, không phải client) | — |
| `answers` | Mình (đáp án mình đã chọn) + Admin + GV phụ trách (chỉ học viên khóa phụ trách; **không thấy `is_correct` trước khi chấm** — xem §4.2) | Qua Workers (cùng lúc nộp quiz) | — | — |
| `certificates` | Mình + Admin + GV phụ trách (chỉ học viên khóa phụ trách) | Qua Workers (khi hoàn thành 100%) | Admin (thu hồi: đổi `status` sang `revoked`, qua Workers) | — |

### 3.4. Đơn hàng, thanh toán, giảm giá, thành viên

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `orders` | Mình + Admin | **Qua Workers** — không có policy INSERT cho client | Admin / Workers (đổi trạng thái; chỉ server đổi sang `paid` — xem §5) | — |
| `order_items` | Mình (dòng hàng của đơn mình) + Admin | **Qua Workers** (cùng lúc tạo đơn) | — (snapshot bất biến tại thời điểm mua) | — |
| `payments` | Mình (chỉ payment của đơn mình — xem §4.4) + Admin | **Qua Workers** — không có policy INSERT cho client | Workers (service-role, qua webhook đã xác minh / admin xác nhận) | — |
| `coupons` | Admin (học viên chỉ kiểm tra mã qua API, không SELECT trực tiếp bảng) | Admin (qua Workers) | Admin (qua Workers; `used_count` chỉ Workers cập nhật trong transaction khi đơn `paid`/hoàn trả) | Admin (nên `inactive` thay vì xóa) |
| `membership_plans` | Công khai nếu đang mở bán (`status = 'active'` — tên cột/trạng thái chốt theo §3.22 schema khi hoàn thành) + Admin | Admin | Admin | Admin (nên ngừng bán thay vì xóa) |
| `memberships` | Mình + Admin | **Qua Workers** (khi đơn gói thành viên `paid` hoặc admin tặng) | Admin (đổi trạng thái/gia hạn, qua Workers) | — |

### 3.5. Sự kiện, blog, chính sách, log, hệ thống

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `events` | Công khai nếu `status` IN (`upcoming`, `happened`) | Admin | Admin | Admin |
| `event_registrations` | Mình + Admin (+ GV phụ trách: chỉ sự kiện thuộc khóa phụ trách, nếu sự kiện gắn khóa) | Mình (qua Workers) | — | Mình (hủy đăng ký của mình, qua Workers) |
| `posts` | Công khai nếu `status = 'published'` | Admin | Admin | Admin |
| `policies` | Công khai nếu `is_current = true` | Admin | Admin (tạo version mới, không sửa version cũ) | — |
| `leads` | Admin | **Qua Workers** (service-role) — **không có policy INSERT cho anon/authenticated** | Admin (đổi `status`/ghi chú, qua Workers) | — |
| `email_logs` | Admin | Qua Workers | Workers (cập nhật trạng thái qua webhook Resend đã xác minh) | — |
| `newsletter_subscribers` | Admin | Qua Workers (service-role) | Qua Workers (hủy nhận qua token trong email) | — |
| `notifications` | Xem §3.1 | — | — | — |
| `automation_events` | Admin | Qua Workers (cron/automation ghi) | — (append-only) | — |
| `activity_logs` | Mình (log của mình) + Admin | Qua Workers (service-role) | — (append-only) | — |
| `audit_logs` | Admin | Qua Workers (service-role) | — | — |
| `system_settings` | Admin (frontend đọc giá trị công khai qua API, không SELECT trực tiếp bảng) | Admin (qua Workers) | Admin (qua Workers, ghi `audit_logs` khi đổi ngưỡng/cấu hình quan trọng) | — |

> Lưu ý `payments` SELECT cho student: ma trận quyền (§2.2 hành động 13–14) cho student xem đơn/payment của chính mình; instructor không xem payment của người khác. Policy mẫu ở §7.6 phản ánh đúng điều này. Lưu ý `payments` trong schema Task 03 (§3.20) ghi “SELECT chỉ admin” — mâu thuẫn với ma trận quyền; tài liệu này theo ma trận quyền (student xem payment của đơn mình). Xem quyết định cần phê duyệt số 6 (§9.6).

---

## 4. Quy tắc chi tiết theo chủ đề

### 4.1. Học viên chỉ xem dữ liệu cá nhân; bài học không xem thử

- Mọi bảng có `user_id` đều có policy `user_id = auth.uid()` cho `SELECT` (và `UPDATE` ở `lesson_progress`/`profiles`/`submissions` khi qua Workers). Không có policy nào cho phép `authenticated` đọc dòng có `user_id` khác mình, trừ Admin và GV phụ trách (giới hạn theo khóa).
- `lessons`/`course_modules`/`quizzes`/`questions`/`assignments`/`lesson_resources`: RLS cho `SELECT` công khai khi khóa `published` (theo §6.2 tài liệu kiến trúc). **Việc chặn bài không xem thử (`is_free_preview = false`) đối với người chưa ghi danh được thực hiện ở Workers API** (endpoint `GET /api/my/lessons/:lessonId` kiểm tra enrollment), không chỉ dựa vào RLS — vì RLS trên `lessons` không phân biệt được “xem danh sách bài” với “xem nội dung bài”. Frontend đọc chi tiết bài học qua API, không đọc trực tiếp bảng `lessons` bằng anon key.
- `video_url`/`file_url`/`lesson_resources.file_url`: không trả về cho người chưa ghi danh. Tài liệu bài học chỉ lấy qua **signed URL, hết hạn sau 1 giờ**, cấp bởi API sau khi kiểm tra enrollment (xem `SECURITY_MODEL.md` §7.1). Xem thêm quyết định cần phê duyệt số 4 (§9.4) về việc có tách `video_url`/`file_url` khỏi SELECT công khai bằng view hay không.

### 4.2. Không lộ đáp án đúng (`question_options.is_correct`)

- **Client không bao giờ `SELECT` trực tiếp bảng `question_options`** (tên Module 1: `quiz_options`). Không có policy SELECT nào trên bảng gốc cho `anon` hay `student`.
- Học viên chỉ đọc qua VIEW (giữ nguyên tên từ Module 1):
  ```sql
  CREATE VIEW quiz_options_public AS
  SELECT id, question_id, option_text, display_order
  FROM question_options;
  ```
  View này **không có cột `is_correct`**. API `GET /api/my/quiz/:lessonId` trả câu hỏi + lựa chọn từ view; chấm điểm ở server (`POST /api/my/quiz/:lessonId/submit`), điểm do server tính, không tin điểm client gửi. `questions.explanation` chỉ hiện **sau khi nộp bài**.
- Chỉ **Workers service-role** đọc `is_correct` để chấm. Service-role bypass RLS nên việc đọc này không cần policy — nhưng chỉ được gọi sau khi API xác minh JWT + enrollment của người nộp.
- Giảng viên phụ trách được xem đáp án đúng (xem §4.3) — đó là **ngoại lệ duy nhất** cho client đọc bảng gốc, giới hạn theo khóa phụ trách.
- **Bảng `answers` (đáp án học viên chọn) không phải đáp án đúng.** `answers.is_correct` là **snapshot đúng/sai tại thời điểm chấm** — học viên chỉ đọc đáp án của mình (qua API, sau khi nộp); giảng viên khóa phụ trách đọc `answers` của học viên khóa mình **nhưng không thấy `is_correct` trước khi chấm** (theo ghi chú schema §3.14; quyết định về thời điểm hiện `is_correct` cho giảng viên xem §9, Q6). Tuyệt đối không gộp `question_options` vào `answers`, không đổi tên `question_options` thành `answers`.

### 4.3. Quyền instructor — theo Task 02 QĐ 6 (ghi đè ma trận cũ)

Quyết định Task 02 số 6 (chốt 10/11/2026) cho instructor **được xem đáp án đúng quiz, SĐT/email học viên, và quản lý blog/sự kiện**. Quyết định này **ghi đè** hai điểm trong `ROLE_PERMISSION_MATRIX.md` bản Task 02:

| Điểm | Ma trận Task 02 (cũ) | Quyết định Task 02 QĐ 6 (mới, áp dụng) |
|---|---|---|
| Đáp án đúng quiz | Instructor ✗ qua client (hành động 31) | **Instructor được xem `is_correct` của khóa phụ trách** — policy SELECT trên `question_options` giới hạn theo `course_instructors` (join `questions → quizzes → lessons → course_modules → courses`). Student vẫn không được xem. |
| Hồ sơ học viên | Chỉ họ tên + tiến độ (hành động 22) | **Instructor được xem SĐT/email học viên của khóa phụ trách** — policy SELECT trên `profiles` giới hạn: học viên có `enrollments` ở khóa mà instructor phụ trách. Chỉ các trường phục vụ giảng dạy/liên hệ; không mở rộng sang học viên khóa khác. |
| Quản lý blog/sự kiện | Chỉ admin (hành động 32–33) | **Chưa áp vào RLS.** Quyết định ghi “quản lý blog/sự kiện (theo ma trận quyền đã duyệt)” — mà ma trận đã duyệt lại ghi chỉ admin. Mâu thuẫn này **chưa được giải quyết**: trong tài liệu này `posts`/`events` vẫn chỉ admin ghi. Xem quyết định cần phê duyệt số 2 (§9.2). |

- Instructor **không** xem lead, **không** sửa giá khóa học (`courses.price_vnd` — policy UPDATE trên `courses` chỉ admin; policy UPDATE của instructor chỉ áp cho `course_modules`/`lessons`/`quizzes`/`questions`/`question_options`/`assignments`/`lesson_resources`), **không** chạm đơn hàng/thanh toán/coupon, **không** cấp/thu hồi role, **không** đọc `system_settings`.
- Instructor sửa bài học của khóa phụ trách: policy `UPDATE`/`INSERT` trên `course_modules`, `lessons`, `quizzes`, `questions`, `question_options`, `assignments`, `lesson_resources` với điều kiện `is_instructor_of(course_id)` — nhưng **đường ghi chính vẫn là Workers API** (endpoint giảng viên kiểm tra `course_instructors` trước); policy RLS chỉ là lớp chặn cuối nếu có ai gọi Supabase trực tiếp.
- Instructor chấm bài tự luận: `INSERT`/`UPDATE` trên `submission_reviews` (điểm + phản hồi) giới hạn theo khóa phụ trách, qua Workers API; học viên không tự chấm bài mình. Chấm lại = UPDATE dòng review (giữ `reviewed_at` mới, lịch sử chấm lại xem trong `audit_logs`).

### 4.4. Đơn hàng và thanh toán — student chỉ của mình

- `orders`: student `SELECT` chỉ dòng `user_id = auth.uid()`; instructor cũng chỉ đơn của mình (không có policy instructor đọc đơn người khác).
- `order_items`: student `SELECT` chỉ dòng hàng của đơn mình (join `orders` theo `user_id`); là snapshot bất biến tại thời điểm mua — không policy UPDATE.
- `payments`: student `SELECT` chỉ payment thuộc đơn của mình (join `orders` theo `user_id`); admin đọc mọi payment. Instructor không đọc payment của người khác.
- **Không có policy INSERT/UPDATE nào cho client trên `orders`/`order_items`/`payments`.** Đơn chỉ tạo qua `POST /api/orders` (Workers); đơn chỉ sang `paid` qua webhook SePay đã xác minh chữ ký hoặc admin xác nhận thủ công (`POST /api/admin/orders/:id/mark-paid`). Xem §5 và `SECURITY_MODEL.md` §8.
- `coupons`: học viên không SELECT trực tiếp bảng (tránh dò mã, xem `used_count`/`usage_limit`); chỉ kiểm tra mã qua API khi tạo đơn. `used_count` chỉ Workers cập nhật trong transaction khi đơn `paid` / hoàn trả.

### 4.5. Admin theo ma trận quyền

- Admin đọc mọi bảng (policy `SELECT` với `current_role() = 'admin'`), trừ `question_options` bảng gốc vẫn nên đọc qua API/service-role để tránh lộ đáp án qua client admin (admin xem đáp án qua giao diện quản trị của API, không SELECT trực tiếp bảng gốc từ frontend).
- Admin ghi: `courses`, `categories`, `course_modules`, `lessons`, `quizzes`, `questions`, `question_options`, `assignments`, `lesson_resources`, `events`, `posts`, `policies` (tạo version mới, không sửa version cũ), `leads` (đổi trạng thái/ghi chú), `orders` (đổi trạng thái, hoàn trả), `coupons`, `membership_plans`, `system_settings`, `course_instructors` (gán/thu hồi giảng viên), `user_roles` (cấp/thu hồi role). Mọi ghi qua Workers API và ghi `audit_logs`.
- Admin **không tự ý** đổi `profiles.role` bằng SQL trực tiếp: dùng endpoint `PATCH /api/admin/users/:id/role` (ghi `user_roles` + `audit_logs`).
- `audit_logs`, `automation_events`: chỉ admin `SELECT`; không ai `UPDATE`/`DELETE`. `activity_logs`: user đọc log của mình, admin đọc hết; append-only.
- `system_settings`: chỉ admin đọc/ghi trực tiếp; frontend đọc giá trị công khai (VD ngưỡng hoàn thành 90%) qua API. Đổi ngưỡng/cấu hình quan trọng ghi `audit_logs`.

---

## 5. Không để frontend tự cấp quyền học (enrollment)

Đây là quy tắc bất di bất dịch, thực thi ở cả 2 lớp:

| Lớp | Cơ chế |
|---|---|
| **Workers API (đường ghi chính)** | `POST /api/my/enrollments` chỉ tạo enrollment cho khóa miễn phí (`price_vnd = 0`, gồm khóa “Cộng đồng Visfar”). Khóa trả phí / Tùy tâm: enrollment **chỉ được tạo tự động khi đơn chuyển sang `paid`** (webhook SePay đã xác minh hoặc admin xác nhận thủ công) — không có endpoint nào cho client tự tạo enrollment của khóa trả phí. Kiểm tra trùng: `UNIQUE (user_id, course_id)` — đã ghi danh rồi thì trả `409 conflict`, không tạo thêm; nếu enrollment bị `revoked` rồi đăng ký lại thì dùng lại dòng cũ đổi status, không tạo dòng mới. |
| **RLS (lớp chặn cuối)** | **Không có policy `INSERT` nào trên `enrollments` cho `anon` hay `authenticated`.** Client gọi Supabase trực tiếp cũng không tạo được enrollment. Chỉ service-role (Workers) insert được. |
| **Admin tặng khóa (Task 02 QĐ 7)** | Admin được tạo enrollment không qua đơn đã trả — **chỉ qua endpoint admin**, với `order_id = NULL`, `granted_by = <admin>`, `grant_reason` bắt buộc, bắt buộc ghi `audit_logs` (`action = 'enrollment.grant'`, `actor_id` = admin, `target_id` = enrollment id). Không có đường tặng khóa nào không qua audit log. Giới hạn số lượng/đối tượng tặng (nếu có) do user quyết — xem §9.5. |
| **Thu hồi** | Hoàn trả (`POST /api/admin/orders/:id/refund`, theo chính sách hoàn trả 15 ngày làm việc — QĐ 9) đổi `enrollments.status` sang `revoked` và `certificates.status` sang `revoked`; chỉ admin qua Workers. Student không tự đổi `status` của enrollment. |
| **Gói thành viên** | `memberships` cũng chỉ tạo qua Workers khi đơn gói thành viên `paid` (hoặc admin tặng); không policy INSERT cho client. |

---

## 6. Không cho anon INSERT — leads / orders / payments

| Bảng | Vì sao cấm anon INSERT | Đường ghi duy nhất |
|---|---|---|
| `leads` | Chống spam như Apps Script hiện tại (ghi trùng, không validation, không chống spam). Lead qua `POST /api/leads`: rate-limit 5 req/giờ/IP (+ theo user khi đăng nhập), honeypot + Turnstile CAPTCHA, validation server, `Idempotency-Key` (UNIQUE `idempotency_key`). | Workers API → service-role INSERT. |
| `orders` | Ngăn client tự tạo đơn “đã trả” / đơn giả. Đơn tạo qua `POST /api/orders` với JWT, chỉ tạo cho chính người gọi. | Workers API → service-role INSERT. |
| `order_items` | Ngăn client tự thêm dòng hàng giả vào đơn. Dòng hàng sinh cùng lúc tạo đơn ở server (snapshot giá/tên tại thời điểm mua). | Workers API → service-role INSERT. |
| `payments` | Ngăn client tự ghi payment giả để mở khóa học. Payment chỉ sinh từ webhook đã xác minh chữ ký hoặc admin xác nhận thủ công. | Workers API → service-role INSERT. |
| `newsletter_subscribers` | Chống spam đăng ký; đăng ký qua `POST /api/newsletter` (5 req/giờ/IP), hủy qua token trong email. | Workers API → service-role INSERT/UPDATE. |
| `event_registrations` | Đăng ký sự kiện (kể cả bằng email khi chưa đăng nhập) vẫn qua `POST /api/events/:slug/register` để kiểm tra trùng `UNIQUE (event_id, email)` + rate-limit; không INSERT trực tiếp. | Workers API → service-role INSERT; hủy qua Workers. |
| `learning_events` / `activity_logs` | Ngăn client tự ghi log giả (làm sai báo cáo retention/tiến độ). | Workers API → service-role INSERT. |

**Nguyên tắc kiểm tra:** sau khi áp migration, kiểm thử bằng anon key: `INSERT INTO leads …` phải bị từ chối (RLS), `INSERT INTO orders …` phải bị từ chối, `SELECT` từ `question_options` bằng JWT student phải bị từ chối (không policy) trong khi `SELECT` từ `quiz_options_public` phải trả về không có `is_correct`.

---

## 7. SQL policy mẫu (tham khảo — chưa chạy)

> Chỉ là mẫu đặc tả. Áp dụng bằng migration mới sau khi tài liệu này được phê duyệt; kiểm tra trên staging trước production. Mọi bảng đều `ENABLE ROW LEVEL SECURITY` trước khi tạo policy. Tên bảng/cột theo `DATABASE_SCHEMA.md` (tên mới sau đổi tên).

### 7.1. Hàm phụ

```sql
-- Đã có trong migration 0001 (ghi lại để đối chiếu)
create or replace function public.current_role()
returns text language sql stable security definer
set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- MỚI (cùng migration course_instructors): giảng viên có phụ trách khóa này?
create or replace function public.is_instructor_of(p_course_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.course_instructors
    where course_id = p_course_id
      and instructor_id = auth.uid()
  );
$$;

-- MỚI (tiện dùng chung): học viên đã ghi danh khóa này (active/completed)?
create or replace function public.is_enrolled(p_course_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.enrollments
    where course_id = p_course_id
      and user_id = auth.uid()
      and status in ('active', 'completed')
  );
$$;

-- MỚI: lấy course_id từ lesson / quiz (dùng cho policy các bảng con)
create or replace function public.course_of_lesson(p_lesson_id uuid)
returns uuid language sql stable security definer
set search_path = public as $$
  select m.course_id from public.lessons l
  join public.course_modules m on m.id = l.module_id
  where l.id = p_lesson_id;
$$;

create or replace function public.course_of_quiz(p_quiz_id uuid)
returns uuid language sql stable security definer
set search_path = public as $$
  select m.course_id from public.quizzes q
  join public.lessons l on l.id = q.lesson_id
  join public.course_modules m on m.id = l.module_id
  where q.id = p_quiz_id;
$$;
```

### 7.2. `profiles` — mình + admin + giảng viên khóa phụ trách

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_admin" on public.profiles
  for select using (public.current_role() = 'admin');

-- GV phụ trách: chỉ đọc hồ sơ học viên đang ghi danh khóa mình phụ trách
-- (Task 02 QĐ 6: được xem SĐT/email học viên khóa phụ trách)
create policy "profiles_select_instructor_students" on public.profiles
  for select using (
    exists (
      select 1
      from public.enrollments e
      join public.course_instructors ci on ci.course_id = e.course_id
      where e.user_id = profiles.id
        and e.status in ('active', 'completed')
        and ci.instructor_id = auth.uid()
    )
  );

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
-- Lưu ý: UPDATE này chặn ở RLS mức dòng; việc cấm đổi `role`/`status`
-- phải kiểm tra thêm ở Workers API (endpoint PATCH /api/my/profile
-- không nhận field `role` hay `status`).
```

### 7.3. `courses` / `course_modules` / `lessons` — công khai + admin + GV phụ trách

```sql
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;

create policy "courses_select_public" on public.courses
  for select using (status = 'published');
create policy "courses_admin_all" on public.courses
  for all using (public.current_role() = 'admin');

create policy "course_modules_select_public" on public.course_modules
  for select using (
    exists (select 1 from public.courses c
            where c.id = course_modules.course_id and c.status = 'published')
  );
create policy "course_modules_write_admin_instructor" on public.course_modules
  for all using (
    public.current_role() = 'admin'
    or public.is_instructor_of(course_modules.course_id)
  );

create policy "lessons_select_public" on public.lessons
  for select using (
    exists (select 1 from public.course_modules m
            join public.courses c on c.id = m.course_id
            where m.id = lessons.module_id and c.status = 'published')
  );
-- Bài không xem thử: nội dung đầy đủ (video_url/file_url) chỉ trả qua API
-- khi đã ghi danh — xem §4.1. Policy RLS trên chỉ chặn mức dòng.
create policy "lessons_write_admin_instructor" on public.lessons
  for all using (
    public.current_role() = 'admin'
    or public.is_instructor_of(
         (select m.course_id from public.course_modules m
          where m.id = lessons.module_id)
       )
  );
```

### 7.4. `question_options` — không SELECT trực tiếp; view công khai không `is_correct`

```sql
alter table public.question_options enable row level security;
-- Không tạo policy SELECT cho anon/authenticated trên bảng gốc.
-- Chỉ admin/instructor-ghi (INSERT/UPDATE/DELETE) qua API; SELECT bảng gốc
-- của GV phụ trách giới hạn theo khóa (Task 02 QĐ 6):
create policy "question_options_select_instructor" on public.question_options
  for select using (
    public.current_role() = 'admin'
    or public.is_instructor_of(
         public.course_of_quiz(
           (select q.quiz_id from public.questions q
            where q.id = question_options.question_id)
         )
       )
  );

-- View cho học viên: không có is_correct (giữ nguyên tên từ Module 1)
create or replace view public.quiz_options_public as
select id, question_id, option_text, display_order
from public.question_options;
-- Quyền trên view: grant select cho anon/authenticated; kiểm tra
-- security_invoker trên staging trước khi dùng production.
```

### 7.5. `enrollments` — không INSERT cho client

```sql
alter table public.enrollments enable row level security;

create policy "enrollments_select_own" on public.enrollments
  for select using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
    or public.is_instructor_of(enrollments.course_id)
  );
-- Không có policy INSERT/UPDATE/DELETE cho client.
-- Ghi duy nhất qua Workers service-role (đơn paid / khóa miễn phí /
-- admin tặng kèm granted_by + grant_reason + audit_logs action
-- 'enrollment.grant'). Xem §5.
```

### 7.6. `orders` / `order_items` / `payments` / `leads` — không ghi trực tiếp

```sql
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.leads enable row level security;

create policy "orders_select_own" on public.orders
  for select using (
    user_id = auth.uid() or public.current_role() = 'admin'
  );
-- Không policy INSERT/UPDATE/DELETE cho client trên orders.

create policy "order_items_select_own" on public.order_items
  for select using (
    public.current_role() = 'admin'
    or exists (select 1 from public.orders o
               where o.id = order_items.order_id
                 and o.user_id = auth.uid())
  );
-- Không policy INSERT/UPDATE/DELETE cho client trên order_items.

create policy "payments_select_own_or_admin" on public.payments
  for select using (
    public.current_role() = 'admin'
    or exists (select 1 from public.orders o
               where o.id = payments.order_id
                 and o.user_id = auth.uid())
  );
-- Không policy INSERT/UPDATE/DELETE cho client trên payments.

create policy "leads_select_admin" on public.leads
  for select using (public.current_role() = 'admin');
-- Không policy INSERT/UPDATE/DELETE cho client trên leads.
-- Admin đổi trạng thái/ghi chú qua Workers API (service-role).
```

### 7.7. `lesson_progress` / `quiz_attempts` / `answers` — mình + admin + GV phụ trách

```sql
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.answers enable row level security;

create policy "progress_select_own_admin_instructor" on public.lesson_progress
  for select using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
    or public.is_instructor_of(
         public.course_of_lesson(lesson_progress.lesson_id)
       )
  );
-- Không policy INSERT/UPDATE trực tiếp cho client: ghi qua Workers API
-- (kiểm tra enrollment + ngưỡng hợp lý). Policy trên chỉ chặn mức đọc.

create policy "quiz_attempts_select_own_admin_instructor" on public.quiz_attempts
  for select using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
    or public.is_instructor_of(
         public.course_of_lesson(quiz_attempts.lesson_id)
       )
  );
-- Không policy INSERT/UPDATE/DELETE cho client: nộp quiz qua Workers,
-- chấm ở server rồi service-role ghi.

-- answers: đáp án học viên đã chọn — KHÔNG phải đáp án đúng.
create policy "answers_select_own_admin_instructor" on public.answers
  for select using (
    exists (select 1 from public.quiz_attempts qa
            where qa.id = answers.quiz_attempt_id
              and qa.user_id = auth.uid())
    or public.current_role() = 'admin'
    or exists (select 1 from public.quiz_attempts qa
               where qa.id = answers.quiz_attempt_id
                 and public.is_instructor_of(
                       public.course_of_lesson(qa.lesson_id)))
  );
-- Không policy INSERT/UPDATE/DELETE cho client: ghi cùng lúc nộp quiz
-- qua Workers. Cột answers.is_correct là snapshot sau chấm; giảng viên
-- không thấy is_correct trước khi chấm (xem §4.2, §9.6).
```

### 7.8. Bảng chờ migration / bảng mới — `course_instructors`, `user_roles`, `submissions`, `submission_reviews`, `system_settings` (mẫu)

```sql
-- course_instructors (đã phê duyệt Task 02 QĐ 3; xem DATABASE_SCHEMA.md §4.1)
create table if not exists public.course_instructors (
  course_id uuid not null references public.courses (id) on delete cascade,
  instructor_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id),
  primary key (course_id, instructor_id)
);
alter table public.course_instructors enable row level security;
create policy "course_instructors_select_admin_or_self" on public.course_instructors
  for select using (
    public.current_role() = 'admin' or instructor_id = auth.uid()
  );
-- INSERT/UPDATE/DELETE: chỉ admin qua Workers (ghi audit_logs). Không policy client.

-- user_roles (lịch sử cấp/thu hồi role; xem DATABASE_SCHEMA.md §3.2)
alter table public.user_roles enable row level security;
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select using (
    user_id = auth.uid() or public.current_role() = 'admin'
  );
-- INSERT/UPDATE: chỉ admin qua Workers (kèm audit_logs). Không DELETE.
-- Đồng bộ profiles.role bằng trigger; nếu bỏ bảng này thì bỏ luôn policy.

-- submissions (bài nộp tự luận; xem DATABASE_SCHEMA.md §3.16)
alter table public.submissions enable row level security;
create policy "submissions_select_own_admin_instructor" on public.submissions
  for select using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
    or public.is_instructor_of(
         public.course_of_lesson(
           (select a.lesson_id from public.assignments a
            where a.id = submissions.assignment_id)
         )
       )
  );
-- INSERT/UPDATE mình qua Workers (nộp bài / sửa nháp / nộp lại sau khi bị
-- trả lại); đổi status khi chấm do Workers (đồng bộ từ submission_reviews).

-- submission_reviews (chấm tay; xem DATABASE_SCHEMA.md §3.17)
alter table public.submission_reviews enable row level security;
create policy "submission_reviews_select" on public.submission_reviews
  for select using (
    public.current_role() = 'admin'
    or exists (select 1 from public.submissions s
               where s.id = submission_reviews.submission_id
                 and s.user_id = auth.uid())
    or public.is_instructor_of(
         public.course_of_lesson(
           (select a.lesson_id from public.submissions s
            join public.assignments a on a.id = s.assignment_id
            where s.id = submission_reviews.submission_id)
         )
       )
  );
-- INSERT/UPDATE: GV phụ trách + admin qua Workers. Học viên không tự chấm.

-- notifications (Task 02 QĐ 4; cột chốt theo DATABASE_SCHEMA.md §3.26
-- khi hoàn thành — mẫu dưới giả định có cột user_id)
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications
  for select using (
    user_id = auth.uid() or public.current_role() = 'admin'
  );
create policy "notifications_update_read_own" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- INSERT: chỉ Workers service-role. Không DELETE cho client.

-- system_settings (key text PRIMARY KEY; xem DATABASE_SCHEMA.md §3.31
-- khi hoàn thành — mẫu dưới giả định bảng key–value)
alter table public.system_settings enable row level security;
create policy "system_settings_admin_all" on public.system_settings
  for all using (public.current_role() = 'admin');
-- Không policy SELECT cho anon/authenticated: frontend đọc giá trị công
-- khai (VD ngưỡng hoàn thành) qua API.
```

---

## 8. Kiểm thử RLS (trước khi duyệt migration)

| # | Kiểm thử | Kỳ vọng |
|---|---|---|
| 1 | Anon `INSERT INTO leads` / `orders` / `payments` / `order_items` | Bị từ chối (không policy) |
| 2 | Student A `SELECT` đơn/progress/quiz/answers của student B | Không trả dòng nào |
| 3 | Student `SELECT` trực tiếp `question_options` | Bị từ chối; `SELECT` từ `quiz_options_public` trả về không có `is_correct` |
| 4 | Student `INSERT INTO enrollments` / `memberships` trực tiếp | Bị từ chối |
| 5 | Instructor chưa được gán khóa X: `SELECT` progress học viên khóa X, `SELECT` `question_options` khóa X | Không trả dòng nào |
| 6 | Instructor đã được gán khóa X: `SELECT` `profiles` học viên khóa X, `question_options` khóa X, `submissions` khóa X | Trả đúng học viên/đáp án/bài nộp khóa X, không trả khóa khác |
| 7 | Instructor `UPDATE courses SET price_vnd` / `SELECT` từ `leads` / `payments` người khác / `SELECT` từ `coupons` / `system_settings` | Bị từ chối (chỉ admin) |
| 8 | Instructor `SELECT` từ `answers` của học viên khóa X trước khi chấm | Thấy đáp án đã chọn, **không** thấy `is_correct` (NULL cho tới khi chấm xong) |
| 9 | Student `UPDATE profiles SET role='admin'` qua API | API từ chối (không nhận field `role`); RLS không phải lớp duy nhất chặn |
| 10 | Webhook SePay gửi lại cùng giao dịch | Không tạo payment trùng (UNIQUE `method` + `gateway_reference`) |
| 11 | Student `SELECT` từ `coupons` / `system_settings` / `audit_logs` | Bị từ chối |
| 12 | Student `SELECT` `membership_plans` đang mở bán; `SELECT` `memberships` của người khác | Trả plan công khai; không trả membership người khác |

---

## 9. Quyết định cần phê duyệt

1. **Tổng số bảng 38:** phê duyệt tổng 38 bảng vật lý sau migration (31 Task 03 + `course_instructors` + `question_options` + 5 bảng Module 1 giữ nguyên) như `DATABASE_SCHEMA.md` §0, hay có bảng nào cần bỏ/gộp?
2. **Instructor quản lý blog/sự kiện:** Task 02 QĐ 6 nói instructor “quản lý blog/sự kiện (theo ma trận quyền đã duyệt)” nhưng ma trận đã duyệt ghi chỉ admin (hành động 32–33). Chọn: (a) giữ nguyên chỉ admin (như tài liệu này); hay (b) cho instructor tạo/sửa blog/sự kiện của khóa mình phụ trách (cần policy + endpoint riêng)?
3. **Tên/cột của các bảng mới và bảng đổi tên:** phê duyệt `course_modules` (từ `modules`), `questions` (từ `quiz_questions`), `question_options` (từ `quiz_options`) và tên/cột các bảng mới theo `DATABASE_SCHEMA.md`, hay còn đổi tên nào khác trước khi viết migration?
4. **`video_url`/`file_url` trên `lessons`:** giữ SELECT công khai theo §6.2 tài liệu kiến trúc (chỉ chặn nội dung đầy đủ ở API) hay tách view `lessons_public` không có `video_url`/`file_url` cho anon (chặn cả ở tầng đọc)? (Đề xuất: tách view — giảm rủi ro lộ link video unlisted/tài liệu qua Supabase trực tiếp.)
5. **Admin tặng khóa:** đã chốt “được tặng, ghi `audit_logs`” (Task 02 QĐ 7) — cần chốt thêm: ai được tặng (đối tượng), có giới hạn số lượng/lần tặng không, và tên endpoint tặng khóa? (Schema đã thêm `granted_by` + `grant_reason` bắt buộc và `action = 'enrollment.grant'`.)
6. **Policy SELECT `payments` cho student:** tài liệu này cho student đọc payment của đơn mình (theo ma trận quyền hành động 13), trong khi schema Task 03 §3.20 ghi “SELECT chỉ admin”. Chọn theo bên nào?
7. **`profiles.role` vs `user_roles`:** giữ cả hai (role cache ở `profiles` cho RLS + `user_roles` là lịch sử cấp/thu hồi, đồng bộ bằng trigger) hay chỉ giữ `profiles.role` làm nguồn duy nhất và bỏ bảng `user_roles`?
8. **Tên bảng `answers`:** giữ `answers` theo danh sách Task 03 (dễ nhầm với đáp án đúng) hay đổi thành `quiz_answers` trước khi viết migration (như đề xuất trong schema §3.14)?
9. **Giảng viên thấy `answers.is_correct` khi nào:** giữ quy tắc “không thấy `is_correct` trước khi chấm” (schema §3.14) hay cho giảng viên khóa phụ trách thấy `is_correct` của học viên ngay sau khi học viên nộp (để chữa bài sớm)?
10. **Đối chiếu §3.22–§3.31 của schema:** 10 bảng (`membership_plans`, `memberships`, `certificates`, `leads`, `notifications`, `email_logs`, `automation_events`, `activity_logs`, `audit_logs`, `system_settings`) chưa có chi tiết cột trong `DATABASE_SCHEMA.md` — có chờ schema hoàn thành rồi đối chiếu policy trước khi viết migration, hay duyệt policy theo Module 1 như tài liệu này và đối chiếu sau?

---

*Nguồn: `docs/DECISIONS.md`, `docs/architecture/ROLE_PERMISSION_MATRIX.md`, `docs/architecture/API_ARCHITECTURE.md`, `Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` §5/§6/§8, `docs/database/DATABASE_SCHEMA.md` (§0, §3.1–§3.21), `supabase/migrations/0001_init_schema.sql`. Không triển khai DB, không sửa code.*
