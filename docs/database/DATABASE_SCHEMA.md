# DATABASE_SCHEMA.md — Thiết kế cơ sở dữ liệu Visfar Academy (Task 03)

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt
**Phạm vi:** Thiết kế (design-only). **Không triển khai DB, không chạy migration, không sửa code.** Mọi thay đổi so với schema Module 1 chỉ thực hiện bằng migration mới, đánh số thứ tự, không sửa migration cũ.

**Nguồn:**

- `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (v1.0, 10/11/2026, §3, §5, §6)
- `workspace/visfar-academy-platform/docs/DECISIONS.md` (19 quyết định 10/11/2026 + 16 quyết định phê duyệt Task 02)
- `workspace/visfar-academy-platform/docs/architecture/SYSTEM_ARCHITECTURE.md` (Task 02, §5, §10.4–10.11, §14)
- `workspace/visfar-academy-platform/docs/architecture/ROLE_PERMISSION_MATRIX.md` (Task 02)
- `workspace/visfar-academy-platform/supabase/migrations/0001_init_schema.sql` (Module 1 — schema gốc để đối chiếu)

---

## 0. Tóm tắt số lượng bảng

| Nhóm | Số bảng | Ghi chú |
|---|---|---|
| Danh sách 31 bảng theo yêu cầu Task 03 | 31 | Thiết kế đầy đủ ở §3 (§3.1–§3.31) |
| Bảng bổ sung đã phê duyệt, ngoài danh sách 31 | 2 | `course_instructors` (§4.1, đã phê duyệt Task 02 QĐ 3) và `question_options` (§4.2, giữ đáp án đúng — xem cảnh báo đặt tên ở §0.1) |
| Bảng Module 1 giữ nguyên, ngoài danh sách 31 | 5 | `events`, `event_registrations`, `posts`, `policies`, `newsletter_subscribers` (§4.3) — **không xóa** |
| **Tổng số bảng vật lý sau migration** | **38** | 31 + 2 + 5. Con số này cần phê duyệt (xem §9, Q1) |

### 0.1. ⚠️ Cảnh báo đặt tên quan trọng nhất: `answers` ≠ đáp án đúng

Trong danh sách 31 bảng, **`answers` là đáp án học viên đã chọn khi làm quiz** (mỗi dòng = 1 câu trả lời của 1 lượt làm bài). **Đáp án đúng của câu hỏi KHÔNG nằm ở `answers`** — nó vẫn nằm ở bảng lựa chọn của câu hỏi (Module 1 gọi là `quiz_options`).

Để tránh nhầm lẫn nguy hiểm (trả đáp án đúng về client, chấm điểm sai, lộ đề), thiết kế này:

- Giữ bảng lựa chọn câu hỏi dưới tên đề xuất **`question_options`** (§4.2) với cột `is_correct` — chỉ Workers (service-role) đọc để chấm điểm; client chỉ đọc qua VIEW `quiz_options_public` (không có cột `is_correct`, giữ nguyên từ Module 1).
- Bảng `answers` (§3.14) chỉ lưu lựa chọn của học viên (`selected_option_id` → `question_options.id`, hoặc `answer_text` cho câu tự luận ngắn) và bản snapshot `is_correct` tại thời điểm chấm.
- **Không gộp** `quiz_options` vào `answers`, **không đổi tên** `quiz_options` thành `answers`. Phương án đổi tên chỉ áp dụng cho `quiz_questions` → `questions` (xem §5).

### 0.2. Bảng MỚI / đổi tên / giữ nguyên so với Module 1

> **Lưu ý về số lượng Module 1:** Task 03 ghi “19 bảng cũ”, nhưng đếm trực tiếp trong `0001_init_schema.sql` có **20 bảng** (`create table` xuất hiện 20 lần). Thiết kế này đối chiếu theo con số đếm được là 20 bảng. Xem §9, Q2.

| Trạng thái | Bảng |
|---|---|
| **MỚI (17 bảng trong danh sách 31)** | `user_roles`, `categories`, `lesson_resources`, `learning_events`, `quizzes`, `answers`, `assignments`, `submissions`, `submission_reviews`, `order_items`, `coupons`, `membership_plans`, `memberships`, `notifications`, `automation_events`, `activity_logs`, `system_settings` |
| **ĐỔI TÊN (3 bảng)** | `modules` → `course_modules`; `quiz_questions` → `questions`; `quiz_options` → `question_options` (tên đề xuất, xem §0.1) |
| **GIỮ NGUYÊN TÊN (11 bảng trong danh sách 31)** | `profiles`, `courses`, `lessons`, `enrollments`, `lesson_progress`, `quiz_attempts`, `orders`, `payments`, `certificates`, `leads`, `email_logs`, `audit_logs` — giữ nguyên tên, chỉ thêm cột/index khi ghi rõ 🆕 |
| **GIỮ NGUYÊN, ngoài danh sách 31 (5 bảng)** | `events`, `event_registrations`, `posts`, `policies`, `newsletter_subscribers` |

### 0.3. Bảng kê 31 bảng theo yêu cầu (kèm trạng thái so với Module 1)

| # | Bảng | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | `profiles` | Giữ nguyên tên | Thêm cột `status` 🆕 (§3.1) |
| 2 | `user_roles` | **MỚI** | Tách role ra khỏi cột `profiles.role` — xem §3.2, Q3 §9 |
| 3 | `courses` | Giữ nguyên tên | Thêm `category_id` FK 🆕, `deleted_at` 🆕 |
| 4 | `categories` | **MỚI** | Nhóm khóa học; `pillar` vẫn giữ ở `courses` |
| 5 | `course_modules` | **ĐỔI TÊN từ `modules`** | Không đổi cột |
| 6 | `lessons` | Giữ nguyên tên | `slug` UNIQUE theo module (QĐ 17); thêm loại `assignment` 🆕 |
| 7 | `lesson_resources` | **MỚI** | Tài liệu đính kèm nhiều file/bài; thay thế `lessons.file_url` đơn lẻ |
| 8 | `enrollments` | Giữ nguyên tên | Thêm `granted_by` 🆕 (admin tặng khóa), `deleted_at` 🆕 |
| 9 | `lesson_progress` | Giữ nguyên tên | Ngưỡng hoàn thành 90% video (QĐ 17) |
| 10 | `learning_events` | **MỚI** | Nhật ký sự kiện học tập (analytics) — khác `events` (sự kiện Zoom/workshop) |
| 11 | `quizzes` | **MỚI** | Lớp trung gian giữa `lessons` (loại `quiz`) và `questions` |
| 12 | `questions` | **ĐỔI TÊN từ `quiz_questions`** | Thêm `quiz_id`, `question_type` 🆕 |
| 13 | `quiz_attempts` | Giữ nguyên tên | Thêm `quiz_id`, `status`, `passed` 🆕; giữ `answers` jsonb làm snapshot |
| 14 | `answers` | **MỚI** | Đáp án học viên chọn — xem §0.1 |
| 15 | `assignments` | **MỚI** | Bài tập tự luận (Task 02 QĐ 5) |
| 16 | `submissions` | **MỚI** | Bài nộp của học viên |
| 17 | `submission_reviews` | **MỚI** | Chấm tay bài tự luận |
| 18 | `orders` | Giữ nguyên tên | Thêm `coupon_id`, `discount_vnd` 🆕 |
| 19 | `order_items` | **MỚI** | Dòng hàng của đơn (khóa học / gói thành viên) |
| 20 | `payments` | Giữ nguyên tên | Không đổi cột |
| 21 | `coupons` | **MỚI** | Mã giảm giá |
| 22 | `membership_plans` | **MỚI** | Gói thành viên (vd. Cộng đồng Visfar) |
| 23 | `memberships` | **MỚI** | Thành viên đã mua gói |
| 24 | `certificates` | Giữ nguyên tên | Thêm `status` 🆕 (`valid`/`revoked`) |
| 25 | `leads` | Giữ nguyên tên | Thêm `user_id` 🆕 (liên kết khi lead đăng ký tài khoản) |
| 26 | `notifications` | **MỚI** | Thông báo in-app (Task 02 QĐ 4) |
| 27 | `email_logs` | Giữ nguyên tên | Không đổi cột |
| 28 | `automation_events` | **MỚI** | Nhật ký lượt chạy automation (cron nhắc thanh toán/học/sự kiện) |
| 29 | `activity_logs` | **MỚI** | Nhật ký hoạt động chung của người dùng |
| 30 | `audit_logs` | Giữ nguyên tên | Không đổi cột |
| 31 | `system_settings` | **MỚI** | Cài đặt hệ thống dạng key–value |

Ký hiệu trong toàn file: 🆕 = cột/bảng/ràng buộc mới so với Module 1; 🔁 = đổi tên; ⚠️ = điểm cần quyết (xem §9).

---

## 1. Quy ước chung (áp dụng cho mọi bảng, trừ ngoại lệ ghi rõ)

| Quy ước | Nội dung |
|---|---|
| Khóa chính | `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` — ngoại lệ duy nhất: `system_settings` dùng `key text PRIMARY KEY` (§3.31) |
| Timestamps | `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` + trigger `set_updated_at()` (kế thừa Module 1). Bảng log append-only (`learning_events`, `activity_logs`, `automation_events`, `audit_logs`, `email_logs`) vẫn có 2 cột này theo Module 1 nhưng **không UPDATE** (chặn ở RLS/API) |
| Tiền tệ | `integer` (đơn vị VND), `CHECK >= 0`; riêng `payments.amount_vnd` `CHECK > 0` (kế thừa Module 1). **Không dùng float cho tiền** |
| SĐT | `text`, `CHECK (phone ~ '^0[0-9]{9}$')` — 10 số, bắt đầu bằng 0, lưu dạng text để giữ số 0 đầu |
| Email | `text`, `CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')` (TLD ≥ 2 ký tự, đồng bộ client/server) |
| Soft delete | Không xóa cứng dữ liệu nghiệp vụ. Bảng nghiệp vụ có `deleted_at timestamptz NULL` (NULL = đang hoạt động); xóa = `UPDATE deleted_at = now()` (+ chuyển `status` sang `archived`/`revoked` nếu có). Xem chi tiết ở `DATABASE_ERD.md` §5 |
| Trạng thái | Mọi bảng nghiệp vụ có cột `status` với CHECK enum liệt kê ở từng bảng; không dùng chuỗi tự do |
| RLS | Bật `ROW LEVEL SECURITY` trên **mọi bảng**, mặc định từ chối. Ghi nhạy cảm chỉ qua Workers API (service-role). Xem tóm tắt RLS ở §7 |
| Đặt tên | `snake_case`; FK đặt tên `<bảng_tham_chiếu>_id` (vd. `course_id`, `user_id`); index đặt tên `idx_<bảng>_<cột>` |
| JSON | Chỉ dùng `jsonb` cho dữ liệu bán cấu trúc (`details`, `gateway_payload`, `event_data`, `answers` snapshot); không dùng `jsonb` thay cho FK |
| Múi giờ | Mọi cột thời gian là `timestamptz`; hiển thị theo giờ Việt Nam ở tầng ứng dụng |

**Quyết định đã chốt được tôn trọng trong thiết kế này:**

- **QĐ 17 (10/11/2026):** `lessons.slug` UNIQUE **theo module** (không theo khóa) — giữ `UNIQUE(module_id, slug)` như Module 1, không đổi. Ngưỡng hoàn thành: video ≥ **90%**, bài text bấm “Đã hoàn thành”, tính theo module.
- **Task 02 QĐ 3:** bảng `course_instructors` tồn tại (§4.1), tạo bằng migration mới sau khi duyệt.
- **Task 02 QĐ 4:** bảng `notifications` có tạo (§3.26), thông báo in-app được hỗ trợ, không chỉ dùng email.
- **Task 02 QĐ 5:** bài tập tự luận có hỗ trợ — `assignments` + `submissions` + `submission_reviews` (§3.15–§3.17).
- **Task 02 QĐ 7:** admin được tặng khóa — `enrollments` không qua đơn đã trả, bắt buộc ghi `audit_logs` (cột `granted_by` §3.8 + quy tắc §3.8).
- **QĐ 9:** hoàn trả 15 ngày làm việc; khiếu nại phản hồi 3 ngày — lưu ý ở `orders`/`payments` (§3.18, §3.20); không hard-code số ngày vào CHECK, chỉ lưu trong `system_settings` (§3.31) để admin đổi được.

---

## 2. Cách đọc từng bảng (§3)

Mỗi bảng gồm: bảng cột (Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú), rồi các dòng **PK / FK / UNIQUE / Index / Status / RLS** tóm tắt. Cột không ghi `NOT NULL` là nullable. `timestamptz` viết tắt `tstz`.

---

## 3. Thiết kế chi tiết 31 bảng

### 3.1. `profiles` — Hồ sơ người dùng (1–1 với `auth.users`) — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE | = auth user id; tạo qua trigger `handle_new_user()` (Module 1) |
| `full_name` | text | NOT NULL | Họ và tên |
| `phone` | text | CHECK `^0[0-9]{9}$` | SĐT 10 số; NULL được (chưa bắt buộc lúc đăng ký) |
| `email` | text | NOT NULL, UNIQUE | Đồng bộ từ auth |
| `province` | text | NULL | 1 trong 34 tỉnh/thành (whitelist ở API) |
| `role` | text | NOT NULL DEFAULT `'student'`, CHECK IN (`student`, `instructor`, `admin`) | ⚠️ Giữ làm **cache đọc nhanh cho RLS** (`current_role()`); nguồn sự thật về lịch sử cấp/thu hồi role là `user_roles` (§3.2). Hai nơi phải đồng bộ bằng trigger — xem §9, Q3 |
| `avatar_url` | text | NULL | Ảnh đại diện (Storage) |
| `status` | text 🆕 | NOT NULL DEFAULT `'active'`, CHECK IN (`active`, `suspended`, `deactivated`) | Admin vô hiệu hóa thay vì xóa tài khoản (ma trận quyền #40) |
| `deleted_at` | tstz 🆕 | NULL | Soft delete; gần như không dùng — ưu tiên `status = 'deactivated'` |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `id` → `auth.users(id)` CASCADE.
- **UNIQUE:** `email`.
- **Index:** `idx_profiles_role (role)`; `idx_profiles_status (status)` 🆕; `idx_profiles_phone (phone)` 🆕 (tìm học viên theo SĐT).
- **RLS:** SELECT mình + admin; INSERT mình (khi đăng ký); UPDATE mình + admin; không DELETE qua client.

### 3.2. `user_roles` — Phân vai trò (lịch sử cấp / thu hồi) — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Người được cấp role |
| `role` | text | NOT NULL, CHECK IN (`student`, `instructor`, `admin`) | |
| `granted_by` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin cấp |
| `granted_at` | tstz | NOT NULL DEFAULT now() | |
| `revoked_at` | tstz | NULL | NULL = đang hiệu lực |
| `revoked_by` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin thu hồi |
| `reason` | text | NULL | Lý do cấp/thu hồi (ghi chú admin) |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `granted_by`/`revoked_by` → `profiles(id)` SET NULL.
- **UNIQUE:** `UNIQUE(user_id, role) WHERE revoked_at IS NULL` — mỗi user chỉ có 1 role đang hiệu lực (giai đoạn đầu: 1 user = 1 role; đa role là mở rộng tương lai, không tự bật).
- **Index:** `idx_user_roles_user (user_id, revoked_at)`; `idx_user_roles_role (role) WHERE revoked_at IS NULL`.
- **Đồng bộ với `profiles.role`:** khi INSERT `user_roles` (role mới, `revoked_at IS NULL`) → trigger cập nhật `profiles.role`; khi thu hồi role cuối cùng → `profiles.role` về `'student'`. Migration backfill: tạo 1 dòng `user_roles` cho mỗi `profiles` hiện có từ `profiles.role` (§5). ⚠️ Nếu phê duyệt “`profiles.role` là nguồn duy nhất, không cần `user_roles`” thì bỏ bảng này — xem §9, Q3.
- **RLS:** chỉ admin đọc/ghi (qua Workers); user thường chỉ đọc dòng của mình (SELECT `user_id = auth.uid()`). Mọi lần cấp/thu hồi ghi thêm `audit_logs`.

### 3.3. `courses` — Khóa học — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `slug` | text | NOT NULL, UNIQUE | VD `thau-hieu-noi-tam` |
| `category_id` | uuid 🆕 | NULL, FK → `categories(id)` ON DELETE SET NULL | Nhóm khóa học (§3.4); NULL = chưa xếp nhóm |
| `display_order` | integer | NOT NULL | Thứ tự hiển thị 01–10, giữ nguyên thứ tự hiện tại |
| `title` | text | NOT NULL | VD “Thấu Hiểu Nội Tâm” |
| `subtitle` | text | NULL | Dòng phụ |
| `description` | text | NULL | Mô tả ngắn |
| `details` | jsonb | NULL | Nội dung chính + Kết quả hướng đến (cấu trúc) |
| `pillar` | text | CHECK IN (`tam-thuc`, `tri-tue`, `nhan-hieu`, `cong-dong`) | Trụ cột để lọc — **giữ nguyên** dù đã có `categories` (xem §9, Q4) |
| `poster_url` | text | NULL | Ảnh poster (Storage/R2), không base64 |
| `price_vnd` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | 0 = miễn phí / Tùy tâm |
| `is_featured` | boolean | NOT NULL DEFAULT false | Khóa full-width (vd. khóa 07) |
| `status` | text | NOT NULL DEFAULT `'published'`, CHECK IN (`draft`, `published`, `archived`) | |
| `deleted_at` | tstz 🆕 | NULL | Soft delete; ưu tiên `status = 'archived'` thay vì xóa |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `category_id` → `categories(id)` SET NULL.
- **UNIQUE:** `slug`.
- **Index:** `idx_courses_display_order (display_order) WHERE status = 'published'`; `idx_courses_slug (slug)`; `idx_courses_category (category_id)` 🆕; `idx_courses_pillar (pillar) WHERE status = 'published'` 🆕.
- **RLS:** SELECT công khai nếu `published` (hoặc admin); INSERT/UPDATE/DELETE chỉ admin (nên archive thay vì xóa).

### 3.4. `categories` — Nhóm khóa học — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `slug` | text | NOT NULL, UNIQUE | VD `tam-thuc` |
| `name` | text | NOT NULL | VD “Tâm thức” |
| `description` | text | NULL | Mô tả nhóm |
| `parent_id` | uuid | NULL, FK → `categories(id)` ON DELETE SET NULL | Nhóm con (tự tham chiếu); NULL = nhóm gốc; chỉ 1 cấp con |
| `pillar` | text | NULL, CHECK IN (`tam-thuc`, `tri-tue`, `nhan-hieu`, `cong-dong`) | Trụ cột tương ứng (nếu có) |
| `display_order` | integer | NOT NULL DEFAULT 0 | Thứ tự hiển thị |
| `is_active` | boolean | NOT NULL DEFAULT true | Ẩn nhóm thay vì xóa |
| `deleted_at` | tstz | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `parent_id` → `categories(id)` SET NULL (tự tham chiếu).
- **UNIQUE:** `slug`.
- **Index:** `idx_categories_parent (parent_id, display_order)`; `idx_categories_slug (slug)`.
- **RLS:** SELECT công khai nếu `is_active`; ghi chỉ admin.
- **Seed:** 4 nhóm tương ứng 4 trụ cột hiện tại (tên/slug do admin chốt khi nhập liệu; không bịa thêm nhóm ngoài 4 trụ cột).

### 3.5. `course_modules` — Chương / module trong khóa học — 🔁 ĐỔI TÊN từ `modules`

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `course_id` | uuid | NOT NULL, FK → `courses(id)` ON DELETE CASCADE | |
| `title` | text | NOT NULL | |
| `description` | text 🆕 | NULL | Mô tả module (hiển thị ở Lộ trình) |
| `display_order` | integer | NOT NULL | |
| `deleted_at` | tstz 🆕 | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `course_id` → `courses(id)` CASCADE.
- **UNIQUE:** không có (trùng tên module trong 1 khóa được phép; thứ tự phân biệt bằng `display_order`).
- **Index:** `idx_course_modules_course (course_id, display_order)`.
- **RLS:** SELECT nếu khóa `published` (hoặc admin); ghi: admin + instructor khóa phụ trách (sau khi có `course_instructors`); DELETE chỉ admin.
- **Migration:** `ALTER TABLE modules RENAME TO course_modules;` + đổi tên index/constraint liên quan; dữ liệu giữ nguyên (§5).

### 3.6. `lessons` — Bài học — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `module_id` | uuid | NOT NULL, FK → `course_modules(id)` ON DELETE CASCADE | 🔁 FK đổi đích từ `modules` sang `course_modules` (cùng dữ liệu) |
| `slug` | text | NOT NULL | **UNIQUE theo module** (QĐ 17 đã chốt) |
| `title` | text | NOT NULL | |
| `type` | text | NOT NULL, CHECK IN (`video`, `text`, `quiz`, `file`, `assignment` 🆕) | `assignment` = bài tập tự luận (§3.15); thêm loại này cần phê duyệt (§9, Q7) |
| `content` | text | NULL | Nội dung text / ghi chú bài học |
| `video_url` | text | NULL | Link YouTube unlisted (giai đoạn 0 đồng) |
| `video_duration_sec` | integer | NULL, CHECK `>= 0` | Thời lượng (giây); dùng để kiểm tra ngưỡng hoàn thành |
| `file_url` | text | NULL | **Giữ lại, deprecated** — file đơn lẻ cũ; file mới vào `lesson_resources` (§3.7). Migration copy `file_url` → 1 dòng `lesson_resources`, không xóa cột ngay (§5) |
| `display_order` | integer | NOT NULL | |
| `is_free_preview` | boolean | NOT NULL DEFAULT false | Bài xem thử không cần mua |
| `deleted_at` | tstz 🆕 | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `module_id` → `course_modules(id)` CASCADE.
- **UNIQUE:** `UNIQUE(module_id, slug)` — theo QĐ 17 (UNIQUE theo module, không theo khóa). Giữ nguyên như Module 1.
- **Index:** `idx_lessons_module (module_id, display_order)`; `idx_lessons_slug (module_id, slug)` 🆕 (phục vụ route `/bai/[lessonSlug]`).
- **RLS:** SELECT nếu khóa `published` (bài không xem thử chỉ khi đã ghi danh — kiểm tra ở API, không ở RLS); ghi: admin + instructor khóa phụ trách.
- **Ngưỡng hoàn thành (QĐ 17):** video `progress_percent >= 90`; bài text bấm “Đã hoàn thành”; tính theo module. Ngưỡng 90 lưu trong `system_settings` (`completion.video_threshold_percent = 90`, §3.31) để đổi được mà không sửa code.

### 3.7. `lesson_resources` — Tài liệu đính kèm bài học — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `lesson_id` | uuid | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | |
| `title` | text | NOT NULL | Tên tài liệu hiển thị |
| `resource_type` | text | NOT NULL, CHECK IN (`pdf`, `doc`, `slide`, `audio`, `link`, `other`) | Loại tài liệu |
| `file_url` | text | NULL | Đường dẫn Storage/R2 (signed URL khi đọc); NULL nếu `resource_type = 'link'` |
| `external_url` | text | NULL | Link ngoài (khi `resource_type = 'link'`) |
| `file_size_bytes` | integer | NULL, CHECK `>= 0` | Dung lượng (nếu có) |
| `display_order` | integer | NOT NULL DEFAULT 0 | |
| `is_downloadable` | boolean | NOT NULL DEFAULT true | false = chỉ xem, không tải |
| `deleted_at` | tstz | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `lesson_id` → `lessons(id)` CASCADE.
- **Index:** `idx_lesson_resources_lesson (lesson_id, display_order)`.
- **CHECK:** `CHECK (file_url IS NOT NULL OR external_url IS NOT NULL)` — mỗi resource phải có 1 đường dẫn.
- **RLS:** SELECT như `lessons` (chỉ học viên đã ghi danh mới lấy được signed URL, hết hạn sau 1 giờ — kiểm tra ở API); ghi: admin + instructor khóa phụ trách.

### 3.8. `enrollments` — Ghi danh (học viên ↔ khóa học) — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `course_id` | uuid | NOT NULL, FK → `courses(id)` ON DELETE CASCADE | ⚠️ Xem lưu ý xóa khóa ở `DATABASE_ERD.md` §4: khóa có đơn hàng thì RESTRICT ở `orders`, enrollment CASCADE theo khóa chỉ khi khóa bị xóa thật (hiếm — ưu tiên archive) |
| `order_id` | uuid | NULL, FK → `orders(id)` ON DELETE SET NULL | Đơn đã tạo enrollment này; NULL nếu miễn phí / **tặng** |
| `granted_by` | uuid 🆕 | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin tặng khóa (Task 02 QĐ 7); NOT NULL khi `order_id IS NULL` và khóa không miễn phí — kiểm tra ở API + audit |
| `grant_reason` | text 🆕 | NULL | Lý do tặng (vd. học bổng, đối tác) |
| `status` | text | NOT NULL DEFAULT `'active'`, CHECK IN (`active`, `completed`, `revoked`) | `revoked` khi hoàn trả / vi phạm |
| `enrolled_at` | tstz | NOT NULL DEFAULT now() | |
| `completed_at` | tstz | NULL | Khi hoàn thành 100% bài học |
| `deleted_at` | tstz 🆕 | NULL | Soft delete (hiếm dùng; ưu tiên `status`) |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `course_id` → `courses(id)` CASCADE; `order_id` → `orders(id)` SET NULL; `granted_by` → `profiles(id)` SET NULL.
- **UNIQUE:** `(user_id, course_id)` — 1 học viên chỉ ghi danh 1 lần / 1 khóa. (Nếu enrollment bị `revoked` rồi đăng ký lại: dùng lại dòng cũ đổi status, không tạo dòng mới — kiểm tra ở API.)
- **Index:** `idx_enrollments_user (user_id)`; `idx_enrollments_course (course_id)`; `idx_enrollments_order (order_id)` 🆕.
- **Quy tắc admin tặng khóa (Task 02 QĐ 7):** tạo enrollment với `order_id = NULL`, `granted_by = <admin>`, `grant_reason` bắt buộc, **bắt buộc ghi `audit_logs`** (`action = 'enrollment.grant'`, `actor_id` = admin, `target_id` = enrollment id). Không có đường tắt nào khác tạo enrollment mà không có đơn đã trả.
- **RLS:** SELECT mình + admin (+ instructor: chỉ học viên khóa phụ trách, sau khi có `course_instructors`); INSERT qua Workers; UPDATE admin (đổi status).

### 3.9. `lesson_progress` — Tiến độ từng bài học — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `lesson_id` | uuid | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | |
| `status` | text | NOT NULL DEFAULT `'in_progress'`, CHECK IN (`not_started`, `in_progress`, `completed`) | |
| `progress_percent` | integer | NOT NULL DEFAULT 0, CHECK 0–100 | % xem video / đọc bài (client báo, server kiểm tra ngưỡng) |
| `last_position_sec` | integer | NULL, CHECK `>= 0` | Vị trí xem dở (giây) — để “tiếp tục học” |
| `completed_at` | tstz | NULL | |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `lesson_id` → `lessons(id)` CASCADE.
- **UNIQUE:** `(user_id, lesson_id)`.
- **Index:** `idx_progress_user_lesson (user_id, lesson_id)`; `idx_progress_lesson_status (lesson_id, status)` 🆕 (báo cáo R5: bài có tỷ lệ bỏ cao).
- **Quy tắc hoàn thành (QĐ 17):** `completed` khi video `progress_percent >= 90` hoặc bài text được bấm “Đã hoàn thành”; server kiểm tra enrollment còn `active`, bài thuộc khóa đã ghi danh, và chống nhảy 0% → 100% trong 1 giây (đối chiếu `video_duration_sec`). Khi tất cả bài trong khóa `completed` → `enrollments.status = 'completed'`, `completed_at = now()`, tạo `certificates`.
- **RLS:** SELECT/UPDATE mình (qua Workers) + admin (+ instructor: chỉ học viên khóa phụ trách — policy bổ sung cùng migration `course_instructors`); không DELETE qua client.

### 3.10. `learning_events` — Nhật ký sự kiện học tập — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Người học (bắt buộc — sự kiện ẩn danh không ghi vào đây) |
| `course_id` | uuid | NULL, FK → `courses(id)` ON DELETE SET NULL | Khóa liên quan (nếu có) |
| `lesson_id` | uuid | NULL, FK → `lessons(id)` ON DELETE SET NULL | Bài liên quan (nếu có) |
| `event_type` | text | NOT NULL, CHECK IN (`lesson_started`, `lesson_completed`, `video_progress`, `quiz_started`, `quiz_submitted`, `assignment_submitted`, `course_enrolled`, `course_completed`, `certificate_issued`, `resource_downloaded`) | Loại sự kiện học tập |
| `event_data` | jsonb | NULL | Dữ liệu kèm (vd. `{progress_percent: 90}`); **không chứa PII, không chứa đáp án đúng** |
| `occurred_at` | tstz | NOT NULL DEFAULT now() | Thời điểm sự kiện xảy ra (khác `created_at` khi ghi bù) |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | Append-only: không UPDATE |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `course_id` → `courses(id)` SET NULL; `lesson_id` → `lessons(id)` SET NULL.
- **Index:** `idx_learning_events_user_time (user_id, occurred_at DESC)`; `idx_learning_events_course_type (course_id, event_type, occurred_at DESC)`; `idx_learning_events_lesson (lesson_id, occurred_at DESC)`.
- **Phân biệt với các bảng log khác:** `learning_events` = sự kiện **học tập** (phục vụ báo cáo R5/R10, retention); `activity_logs` (§3.29) = hoạt động chung (đăng nhập, sửa hồ sơ); `audit_logs` (§3.30) = thao tác admin; `automation_events` (§3.28) = lượt chạy automation. Xem §9, Q8.
- **Phân biệt với `events`:** `events` (§4.3) là **sự kiện lịch** (workshop/Q&A ngày 25/11/2026…) — hai khái niệm khác nhau, không gộp, không đổi tên lẫn nhau.
- **RLS:** INSERT qua Workers; SELECT mình + admin (+ instructor: chỉ học viên khóa phụ trách). Không UPDATE/DELETE qua client.
- **Lưu trữ:** bảng này tăng nhanh nhất (mỗi lần xem video ghi nhiều dòng `video_progress` — chỉ ghi mốc 25/50/75/90/100%, không ghi mỗi giây). Dọn dữ liệu cũ theo chính sách lưu trữ do admin chốt (xem §9, Q8).

### 3.11. `quizzes` — Bài kiểm tra (quiz) — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `lesson_id` | uuid | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Bài học loại `quiz` chứa quiz này |
| `title` | text | NOT NULL | Tên bài kiểm tra |
| `description` | text | NULL | Hướng dẫn làm bài |
| `passing_score_percent` | integer | NULL, CHECK 0–100 | % điểm đạt (NULL = không yêu cầu đạt) |
| `time_limit_sec` | integer | NULL, CHECK `> 0` | Giới hạn thời gian (giây); NULL = không giới hạn |
| `max_attempts` | integer | NULL, CHECK `> 0` | Số lần làm tối đa; NULL = không giới hạn (giai đoạn đầu) |
| `shuffle_questions` | boolean | NOT NULL DEFAULT false | Đảo thứ tự câu hỏi |
| `status` | text | NOT NULL DEFAULT `'published'`, CHECK IN (`draft`, `published`, `archived`) | |
| `deleted_at` | tstz | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `lesson_id` → `lessons(id)` CASCADE.
- **UNIQUE:** `UNIQUE(lesson_id)` — giai đoạn đầu: 1 bài học loại `quiz` có đúng 1 quiz. (Mở rộng nhiều quiz/bài sau này thì bỏ UNIQUE này bằng migration mới.)
- **Index:** `idx_quizzes_lesson (lesson_id)`.
- **Migration từ Module 1:** Module 1 gắn `quiz_questions` trực tiếp vào `lesson_id`. Migration tạo 1 dòng `quizzes` cho mỗi `lessons` có `type = 'quiz'` (hoặc có câu hỏi), rồi chuyển `questions.quiz_id` theo đó (§5). Không mất câu hỏi nào.
- **RLS:** SELECT như `lessons`; ghi: admin + instructor khóa phụ trách.

### 3.12. `questions` — Câu hỏi trắc nghiệm — 🔁 ĐỔI TÊN từ `quiz_questions`

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `quiz_id` | uuid 🆕 | NOT NULL, FK → `quizzes(id)` ON DELETE CASCADE | 🔁 Thay cho `lesson_id` của Module 1 (chuyển qua `quizzes`, xem §5) |
| `question` | text | NOT NULL | Nội dung câu hỏi |
| `question_type` | text 🆕 | NOT NULL DEFAULT `'single_choice'`, CHECK IN (`single_choice`, `multiple_choice`, `true_false`, `short_answer`) | Loại câu hỏi; `essay` (tự luận dài) thuộc `assignments`, không thuộc quiz |
| `explanation` | text 🆕 | NULL | Giải thích đáp án — chỉ hiện **sau khi nộp bài** |
| `points` | integer 🆕 | NOT NULL DEFAULT 1, CHECK `> 0` | Điểm của câu (mặc định 1; `quiz_attempts.score` tính theo điểm) |
| `display_order` | integer | NOT NULL | |
| `deleted_at` | tstz 🆕 | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `quiz_id` → `quizzes(id)` CASCADE.
- **Index:** `idx_questions_quiz (quiz_id, display_order)`.
- **RLS:** SELECT như `lessons` (câu hỏi + lựa chọn qua VIEW, không kèm `is_correct`); ghi: admin + instructor khóa phụ trách.
- **Migration:** `ALTER TABLE quiz_questions RENAME TO questions;` + thêm cột `quiz_id`, backfill từ `quizzes` theo `lesson_id` cũ, rồi mới bỏ cột `lesson_id` cũ (§5). Trong lúc chuyển đổi, giữ cả 2 cột để không mất liên kết.

### 3.13. `quiz_attempts` — Bài làm quiz — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `lesson_id` | uuid | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Giữ để truy vấn nhanh theo bài; `quiz_id` là chuẩn xác |
| `quiz_id` | uuid 🆕 | NULL, FK → `quizzes(id)` ON DELETE SET NULL | Quiz đã làm; NULL chỉ với dữ liệu Module 1 chưa backfill xong |
| `score` | integer | NOT NULL, CHECK `>= 0` | Tổng điểm đạt (theo `questions.points`) |
| `total` | integer | NOT NULL, CHECK `> 0` | Tổng điểm tối đa của bài |
| `passed` | boolean 🆕 | NULL | Đạt/không đạt theo `quizzes.passing_score_percent`; NULL khi quiz không đặt ngưỡng |
| `status` | text 🆕 | NOT NULL DEFAULT `'submitted'`, CHECK IN (`in_progress`, `submitted`, `expired`) | `in_progress` = đang làm dở (hết giờ → `expired`) |
| `answers` | jsonb | NOT NULL | **Snapshot đáp án đã chọn** (giữ nguyên Module 1) — bản chuẩn hóa theo dòng nằm ở `answers` (§3.14). Hai nơi phải khớp nhau tại thời điểm nộp |
| `started_at` | tstz 🆕 | NULL | Bắt đầu làm (phục vụ `time_limit_sec`) |
| `submitted_at` | tstz | NOT NULL DEFAULT now() | Module 1: `submitted_at` DEFAULT now() — giữ nguyên |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `lesson_id` → `lessons(id)` CASCADE; `quiz_id` → `quizzes(id)` SET NULL.
- **Index:** `idx_quiz_attempts_user_lesson (user_id, lesson_id, submitted_at DESC)`; `idx_quiz_attempts_quiz (quiz_id, submitted_at DESC)` 🆕 (báo cáo R6).
- **RLS:** SELECT mình + admin (+ instructor: chỉ học viên khóa phụ trách); INSERT qua Workers (chấm ở server); không UPDATE/DELETE qua client.
- **Quy tắc chấm:** chấm ở server bằng `question_options.is_correct`; không tin điểm do client gửi; trả đáp án đúng + `explanation` chỉ sau khi nộp.

### 3.14. `answers` — Đáp án học viên đã chọn (theo từng câu, từng lượt làm) — 🆕 MỚI

> ⚠️ **Đọc kỹ §0.1 trước khi dùng bảng này.** Đây KHÔNG phải bảng đáp án đúng. Đáp án đúng ở `question_options.is_correct` (§4.2).

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `quiz_attempt_id` | uuid | NOT NULL, FK → `quiz_attempts(id)` ON DELETE CASCADE | Lượt làm bài |
| `question_id` | uuid | NOT NULL, FK → `questions(id)` ON DELETE CASCADE | Câu hỏi được trả lời |
| `selected_option_id` | uuid | NULL, FK → `question_options(id)` ON DELETE SET NULL | Lựa chọn học viên chọn (câu trắc nghiệm); NULL với câu `short_answer` |
| `answer_text` | text | NULL | Câu trả lời dạng text (câu `short_answer`); NULL với câu trắc nghiệm |
| `is_correct` | boolean | NULL | Snapshot đúng/sai tại thời điểm chấm; NULL khi chưa chấm (hoặc câu không có đáp án cố định) |
| `points_awarded` | integer | NULL, CHECK `>= 0` | Điểm đạt được ở câu này |
| `answered_at` | tstz | NOT NULL DEFAULT now() | |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `quiz_attempt_id` → `quiz_attempts(id)` CASCADE; `question_id` → `questions(id)` CASCADE; `selected_option_id` → `question_options(id)` SET NULL.
- **UNIQUE:** `(quiz_attempt_id, question_id)` — mỗi câu chỉ trả lời 1 lần trong 1 lượt làm.
- **Index:** `idx_answers_attempt (quiz_attempt_id, question_id)`; `idx_answers_question (question_id)` 🆕 (báo cáo R6: câu nhiều người sai nhất).
- **CHECK:** `CHECK (selected_option_id IS NOT NULL OR answer_text IS NOT NULL)` — mỗi dòng phải có 1 trong 2 dạng trả lời.
- **Migration từ Module 1:** dữ liệu đáp án hiện nằm trong `quiz_attempts.answers` (jsonb). Migration mở rộng jsonb thành các dòng `answers`; giữ nguyên cột jsonb làm snapshot bất biến (§5).
- **RLS:** SELECT mình + admin (+ instructor: chỉ học viên khóa phụ trách, **không thấy `is_correct` trước khi chấm** — xem §9, Q6); INSERT qua Workers; không UPDATE/DELETE qua client.
- **Tên thay thế đã cân nhắc (nếu user thấy `answers` gây nhầm):** `quiz_answers` (rõ ràng hơn, khớp tiền tố `quiz_*` của Module 1) hoặc `attempt_answers`. Đề xuất giữ `answers` theo danh sách Task 03, nhưng nếu phê duyệt đổi tên thì đổi thành `quiz_answers` trước khi viết migration — xem §9, Q5.

### 3.15. `assignments` — Bài tập (tự luận) — 🆕 MỚI (Task 02 QĐ 5)

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `lesson_id` | uuid | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Bài học loại `assignment` chứa bài tập này |
| `title` | text | NOT NULL | Tên bài tập |
| `description` | text | NULL | Đề bài / yêu cầu |
| `assignment_type` | text | NOT NULL DEFAULT `'essay'`, CHECK IN (`essay`, `file_upload`, `mixed`) | `essay` = viết trực tiếp; `file_upload` = nộp file; `mixed` = cả hai |
| `max_score` | integer | NULL, CHECK `> 0` | Điểm tối đa; NULL = chỉ nhận xét, không chấm điểm |
| `due_at` | tstz | NULL | Hạn nộp; NULL = không hạn |
| `allow_late_submission` | boolean | NOT NULL DEFAULT false | Cho nộp muộn (đánh dấu `is_late` ở `submissions`) |
| `status` | text | NOT NULL DEFAULT `'published'`, CHECK IN (`draft`, `published`, `archived`) | |
| `deleted_at` | tstz | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `lesson_id` → `lessons(id)` CASCADE.
- **UNIQUE:** `UNIQUE(lesson_id)` — giai đoạn đầu: 1 bài học loại `assignment` có đúng 1 bài tập (tương tự `quizzes`).
- **Index:** `idx_assignments_lesson (lesson_id)`.
- **RLS:** SELECT như `lessons`; ghi: admin + instructor khóa phụ trách.

### 3.16. `submissions` — Bài nộp của học viên — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `assignment_id` | uuid | NOT NULL, FK → `assignments(id)` ON DELETE CASCADE | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Người nộp |
| `content_text` | text | NULL | Nội dung bài viết trực tiếp (tự luận) |
| `file_url` | text | NULL | File bài nộp (Storage private, signed URL) |
| `status` | text | NOT NULL DEFAULT `'submitted'`, CHECK IN (`draft`, `submitted`, `graded`, `returned`) | `draft` = nháp chưa nộp; `returned` = trả lại để làm lại |
| `is_late` | boolean | NOT NULL DEFAULT false | Nộp sau `due_at` (chỉ khi `allow_late_submission`) |
| `submitted_at` | tstz | NOT NULL DEFAULT now() | |
| `graded_at` | tstz | NULL | Thời điểm chấm xong (đồng bộ từ `submission_reviews`) |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `assignment_id` → `assignments(id)` CASCADE; `user_id` → `profiles(id)` CASCADE.
- **UNIQUE:** `(assignment_id, user_id) WHERE status <> 'draft'` — mỗi học viên chỉ có 1 bài nộp chính thức / 1 bài tập; nộp lại = cập nhật dòng cũ (status về `submitted`) hoặc tạo bản mới sau khi bị `returned` — quy tắc nộp lại xem §9, Q7. (UNIQUE partial để vẫn cho phép 1 nháp + 1 bài chính thức.)
- **Index:** `idx_submissions_assignment (assignment_id, submitted_at DESC)`; `idx_submissions_user (user_id, submitted_at DESC)`.
- **CHECK:** `CHECK (content_text IS NOT NULL OR file_url IS NOT NULL)` — bài nộp phải có nội dung hoặc file.
- **RLS:** SELECT mình + admin + instructor khóa phụ trách (để chấm); INSERT/UPDATE mình (qua Workers); không DELETE qua client.

### 3.17. `submission_reviews` — Chấm tay bài tự luận — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `submission_id` | uuid | NOT NULL, FK → `submissions(id)` ON DELETE CASCADE | Bài được chấm |
| `reviewer_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE RESTRICT | Người chấm (admin/instructor); RESTRICT để không mất dấu vết chấm khi xóa tài khoản — ưu tiên vô hiệu hóa tài khoản thay vì xóa |
| `score` | integer | NULL, CHECK `>= 0` | Điểm (≤ `assignments.max_score` — kiểm tra ở API); NULL = chỉ nhận xét |
| `feedback` | text | NULL | Nhận xét / chữa bài |
| `status` | text | NOT NULL DEFAULT `'graded'`, CHECK IN (`graded`, `returned`) | `returned` = trả lại để học viên làm lại (đồng bộ `submissions.status`) |
| `reviewed_at` | tstz | NOT NULL DEFAULT now() | |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `submission_id` → `submissions(id)` CASCADE; `reviewer_id` → `profiles(id)` RESTRICT.
- **UNIQUE:** `(submission_id)` — giai đoạn đầu: 1 bài nộp có 1 kết quả chấm cuối cùng; chấm lại = UPDATE dòng review (giữ `reviewed_at` mới, lịch sử chấm lại xem trong `audit_logs`). Nếu cần nhiều lượt chấm, bỏ UNIQUE này bằng migration mới — xem §9, Q7.
- **Index:** `idx_submission_reviews_submission (submission_id)`; `idx_submission_reviews_reviewer (reviewer_id, reviewed_at DESC)`.
- **RLS:** SELECT: học viên xem review bài của mình + admin + instructor khóa phụ trách; INSERT/UPDATE: admin + instructor khóa phụ trách (qua Workers); học viên không tự chấm bài mình.

### 3.18. `orders` — Đơn hàng — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | ⚠️ Xem lưu ý ở `DATABASE_ERD.md` §4: đơn hàng là chứng từ tài chính — khi xóa tài khoản, cân nhắc giữ đơn (SET NULL + ẩn danh) thay vì CASCADE; quyết ở §9, Q9 |
| `course_id` | uuid | NOT NULL, FK → `courses(id)` ON DELETE RESTRICT | **Giữ lại** (đơn 1 khóa — tương thích Module 1); dòng hàng chi tiết nằm ở `order_items` (§3.19). Không cho xóa khóa đã có đơn |
| `coupon_id` | uuid 🆕 | NULL, FK → `coupons(id)` ON DELETE SET NULL | Mã giảm giá đã áp (nếu có) |
| `amount_vnd` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | Số tiền phải trả **sau giảm giá** |
| `original_amount_vnd` | integer 🆕 | NULL, CHECK `>= 0` | Giá gốc trước giảm (NULL khi không dùng coupon) |
| `discount_vnd` | integer 🆕 | NOT NULL DEFAULT 0, CHECK `>= 0` | Số tiền được giảm |
| `custom_amount_vnd` | integer | NULL, CHECK `>= 0` | Số tiền tùy tâm học viên nhập (nếu có) |
| `status` | text | NOT NULL DEFAULT `'pending'`, CHECK IN (`pending`, `paid`, `cancelled`, `refunded`, `expired`) | Chỉ server mới được đổi sang `paid` (webhook đã xác minh / admin xác nhận thủ công) |
| `payment_method` | text | CHECK IN (`bank_transfer`, `sepay`, `stripe`, `cash`, `free`) | SePay/Stripe chỉ khi được phê duyệt; giai đoạn đầu: `bank_transfer` + `free` |
| `reference_code` | text | NOT NULL, UNIQUE | Mã đơn, VD `DH-2026-000123` — nội dung chuyển khoản |
| `expires_at` | tstz | NULL | Hết hạn giữ chỗ (đơn chuyển khoản thủ công: +48h) |
| `paid_at` | tstz 🆕 | NULL | Thời điểm đơn sang `paid` (đồng bộ với `payments.paid_at`) |
| `refund_reason` | text 🆕 | NULL | Lý do hoàn trả (theo khung hoàn trả 15 ngày làm việc, QĐ 9) |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `course_id` → `courses(id)` RESTRICT; `coupon_id` → `coupons(id)` SET NULL.
- **UNIQUE:** `reference_code`.
- **Index:** `idx_orders_user_status (user_id, status)`; `idx_orders_reference (reference_code)`; `idx_orders_status_expires (status, expires_at)` 🆕 (cron quét đơn quá hạn); `idx_orders_coupon (coupon_id)` 🆕.
- **RLS:** SELECT mình + admin; INSERT/UPDATE chỉ qua Workers; không DELETE qua client.
- **Quy tắc tiền:** `amount_vnd = original_amount_vnd - discount_vnd` (hoặc `custom_amount_vnd` với khóa Tùy tâm); `amount_vnd = 0` = miễn phí / Tùy tâm chưa nhập số. Không bao giờ tin client báo “đã trả”.

### 3.19. `order_items` — Dòng hàng của đơn — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `order_id` | uuid | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | |
| `item_type` | text | NOT NULL, CHECK IN (`course`, `membership`) | Loại hàng: khóa học hoặc gói thành viên |
| `course_id` | uuid | NULL, FK → `courses(id)` ON DELETE RESTRICT | Khi `item_type = 'course'`; RESTRICT để không xóa khóa đã có đơn |
| `membership_plan_id` | uuid | NULL, FK → `membership_plans(id)` ON DELETE RESTRICT | Khi `item_type = 'membership'` |
| `item_name` | text | NOT NULL | Tên hàng tại thời điểm mua (snapshot — đề phòng khóa/gói đổi tên sau này) |
| `unit_price_vnd` | integer | NOT NULL, CHECK `>= 0` | Đơn giá tại thời điểm mua (snapshot) |
| `quantity` | integer | NOT NULL DEFAULT 1, CHECK `> 0` | Số lượng (thường = 1) |
| `total_vnd` | integer | NOT NULL, CHECK `>= 0` | = `unit_price_vnd * quantity` |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `order_id` → `orders(id)` CASCADE; `course_id` → `courses(id)` RESTRICT; `membership_plan_id` → `membership_plans(id)` RESTRICT.
- **Index:** `idx_order_items_order (order_id)`; `idx_order_items_course (course_id)` 🆕.
- **CHECK:** `CHECK ((item_type = 'course' AND course_id IS NOT NULL AND membership_plan_id IS NULL) OR (item_type = 'membership' AND membership_plan_id IS NOT NULL AND course_id IS NULL))` — mỗi dòng chỉ thuộc 1 loại hàng.
- **Migration từ Module 1:** mỗi `orders` hiện có sinh 1 dòng `order_items` (`item_type = 'course'`, `course_id`/`item_name`/`unit_price_vnd` copy từ đơn); `orders.course_id` giữ lại làm trường tương thích (§5). Giai đoạn đầu đơn vẫn 1 dòng hàng; đơn nhiều khóa là mở rộng tương lai — xem §9, Q10.
- **RLS:** như `orders` (SELECT mình + admin; ghi qua Workers).

### 3.20. `payments` — Giao dịch thanh toán — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `order_id` | uuid | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | 1 đơn có nhiều lần thanh toán / đối soát |
| `amount_vnd` | integer | NOT NULL, CHECK `> 0` | |
| `method` | text | NOT NULL, CHECK IN (`bank_transfer`, `sepay`, `stripe`) | |
| `gateway_reference` | text | NULL | Mã giao dịch từ cổng (SePay transaction id, Stripe payment_intent…); với chuyển khoản thủ công: mã giao dịch ngân hàng (nếu có) |
| `gateway_payload` | jsonb | NULL | Payload webhook gốc (để đối soát, **không chứa secret**) |
| `status` | text | NOT NULL DEFAULT `'pending'`, CHECK IN (`pending`, `succeeded`, `failed`, `refunded`) | |
| `paid_at` | tstz | NULL | |
| `verified_by` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin xác nhận thủ công (nếu có) |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `order_id` → `orders(id)` CASCADE; `verified_by` → `profiles(id)` SET NULL.
- **UNIQUE:** `(method, gateway_reference)` — chống ghi trùng 1 giao dịch cổng 2 lần. (PostgreSQL coi NULL khác nhau nên nhiều dòng `gateway_reference NULL` vẫn được phép — đúng thiết kế Module 1.)
- **Index:** `idx_payments_order (order_id)`; `idx_payments_gateway (method, gateway_reference)` 🆕; `idx_payments_status (status, created_at DESC)` 🆕 (báo cáo đối soát R9).
- **RLS:** SELECT chỉ admin; INSERT/UPDATE chỉ qua Workers; không DELETE qua client.
- **Hoàn trả (QĐ 9 — 15 ngày làm việc):** khi hoàn trả, tạo 1 dòng `payments` mới `status = 'refunded'` (không sửa dòng `succeeded` cũ), `orders.status → 'refunded'`, thu hồi enrollment (`status = 'revoked'`).

### 3.21. `coupons` — Mã giảm giá — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `code` | text | NOT NULL, UNIQUE | Mã học viên nhập, VD `VISFAR10` (viết hoa, không dấu, không khoảng trắng — chuẩn hóa ở API) |
| `description` | text | NULL | Mô tả chương trình |
| `discount_type` | text | NOT NULL, CHECK IN (`percent`, `fixed_amount`) | `percent` = giảm %; `fixed_amount` = giảm số tiền VND |
| `discount_value` | integer | NOT NULL, CHECK `> 0` | % (1–100) khi `percent`; số VND khi `fixed_amount` |
| `min_order_vnd` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | Đơn tối thiểu để áp dụng |
| `max_discount_vnd` | integer | NULL, CHECK `> 0` | Trần giảm (chỉ áp với `percent`) |
| `usage_limit` | integer | NULL, CHECK `> 0` | Tổng lượt dùng tối đa; NULL = không giới hạn |
| `used_count` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | Số lượt đã dùng (tăng khi đơn `paid`; giảm khi đơn hoàn trả — xử lý ở Workers, dùng transaction) |
| `valid_from` | tstz | NULL | Bắt đầu hiệu lực; NULL = hiệu lực ngay |
| `valid_to` | tstz | NULL | Hết hiệu lực; NULL = không hết hạn |
| `status` | text | NOT NULL DEFAULT `'active'`, CHECK IN (`active`, `inactive`, `expired`) | |
| `created_by` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin tạo |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `created_by` → `profiles(id)` SET NULL.
- **UNIQUE:** `code`.
- **Index:** `idx_coupons_code (code) WHERE status = 'active'`; `idx_coupons_valid (valid_from, valid_to)`.
- **CHECK:** `CHECK ((discount_type = 'percent' AND discount_value <= 100) OR discount_type = 'fixed_amount')`.
- **RLS:** SELECT: admin đọc hết; học viên chỉ kiểm tra mã qua API (không SELECT trực tiếp bảng); ghi chỉ admin (qua Workers).
- **Lưu ý:** không bịa giá/mức giảm mẫu — mọi coupon do admin tạo khi có chương trình thật.

### 3.22. `membership_plans` — Gói thành viên — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `slug` | text | NOT NULL, UNIQUE | VD `cong-dong-visfar` |
| `name` | text | NOT NULL | VD “Cộng đồng Visfar” |
| `description` | text | NULL | Quyền lợi gói |
| `price_vnd` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | 0 = gói miễn phí |
| `duration_days` | integer | NULL, CHECK `> 0` | Số ngày hiệu lực; NULL = không hết hạn (trọn đời) |
| `course_id` | uuid | NULL, FK → `courses(id)` ON DELETE SET NULL | Khóa đi kèm gói (nếu có — vd. gói Cộng đồng đi kèm khóa “Cộng đồng Visfar”); NULL = gói độc lập |
| `status` | text | NOT NULL DEFAULT `'active'`, CHECK IN (`active`, `inactive`, `archived`) | |
| `deleted_at` | tstz | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `course_id` → `courses(id)` SET NULL.
- **UNIQUE:** `slug`.
- **Index:** `idx_membership_plans_slug (slug)`; `idx_membership_plans_status (status)`.
- **RLS:** SELECT công khai nếu `active` (để hiển thị gói); ghi chỉ admin.
- **Lưu ý:** không bịa giá gói — giá do admin nhập khi tạo gói thật. Quan hệ gói ↔ enrollment xem §9, Q11.

### 3.23. `memberships` — Thành viên đã mua gói — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `plan_id` | uuid | NOT NULL, FK → `membership_plans(id)` ON DELETE RESTRICT | Không xóa gói đang có thành viên |
| `order_id` | uuid | NULL, FK → `orders(id)` ON DELETE SET NULL | Đơn đã mua gói; NULL nếu miễn phí / tặng |
| `status` | text | NOT NULL DEFAULT `'active'`, CHECK IN (`active`, `expired`, `cancelled`, `pending`) | `pending` = chờ thanh toán |
| `started_at` | tstz | NOT NULL DEFAULT now() | |
| `expires_at` | tstz | NULL | = `started_at + duration_days`; NULL khi gói trọn đời |
| `cancelled_at` | tstz | NULL | |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `plan_id` → `membership_plans(id)` RESTRICT; `order_id` → `orders(id)` SET NULL.
- **UNIQUE:** `(user_id, plan_id) WHERE status = 'active'` — mỗi user chỉ có 1 gói đang hiệu lực / 1 loại gói (gia hạn = cập nhật `expires_at`, không tạo dòng mới).
- **Index:** `idx_memberships_user (user_id, status)`; `idx_memberships_expires (expires_at) WHERE status = 'active'` 🆕 (cron quét hết hạn).
- **RLS:** SELECT mình + admin; INSERT/UPDATE qua Workers; không DELETE qua client.

### 3.24. `certificates` — Chứng chỉ hoàn thành — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `course_id` | uuid | NOT NULL, FK → `courses(id)` ON DELETE CASCADE | |
| `certificate_code` | text | NOT NULL, UNIQUE | VD `VISFAR-CERT-2026-000123` |
| `status` | text 🆕 | NOT NULL DEFAULT `'valid'`, CHECK IN (`valid`, `revoked`) | Thu hồi khi phát hiện gian lận / hoàn trả sau cấp |
| `issued_at` | tstz | NOT NULL DEFAULT now() | |
| `revoked_at` | tstz 🆕 | NULL | |
| `revoked_reason` | text 🆕 | NULL | Lý do thu hồi |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE; `course_id` → `courses(id)` CASCADE.
- **UNIQUE:** `certificate_code`; `(user_id, course_id)`.
- **Index:** `idx_certificates_user (user_id)`; `idx_certificates_code (certificate_code)`.
- **RLS:** SELECT mình + admin; INSERT qua Workers (khi enrollment `completed`); UPDATE admin (thu hồi); không DELETE qua client.
- **Quy tắc cấp:** chỉ cấp khi `enrollments.status = 'completed'` (100% bài `completed`); cấp 1 lần / 1 khóa; cấp lại sau thu hồi phải ghi `audit_logs`.

### 3.25. `leads` — Đăng ký tư vấn — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `reference_code` | text | NOT NULL, UNIQUE | Mã tham chiếu, VD `VISFAR-2026-000123` — để đối soát |
| `idempotency_key` | text | NOT NULL, UNIQUE | Chống ghi trùng (header `Idempotency-Key`) |
| `user_id` | uuid 🆕 | NULL, FK → `profiles(id)` ON DELETE SET NULL | Liên kết khi lead đăng ký tài khoản bằng cùng email (liên kết bằng email, không FK cứng lúc tạo lead — vì lead có thể chưa có tài khoản) |
| `full_name` | text | NOT NULL | |
| `phone` | text | NOT NULL, CHECK `^0[0-9]{9}$` | |
| `email` | text | NOT NULL, CHECK email hợp lệ (TLD ≥ 2 ký tự) | |
| `province` | text | NOT NULL | 1 trong 34 tỉnh/thành (whitelist ở API) |
| `course_id` | uuid | NULL, FK → `courses(id)` ON DELETE SET NULL | Khóa quan tâm; NULL = “Chưa biết bắt đầu từ đâu” |
| `course_interest_text` | text | NULL | Ghi lại tên khóa lúc đăng ký (đề phòng khóa đổi tên/xóa sau này) |
| `source` | text | NOT NULL DEFAULT `'visfar-academy'` | Nguồn: `visfar-academy` / `nang-tam` / khác |
| `status` | text | NOT NULL DEFAULT `'new'`, CHECK IN (`new`, `contacted`, `enrolled`, `closed`, `spam`) | Pipeline chăm sóc |
| `notes` | text | NULL | Ghi chú chăm sóc (admin) |
| `assigned_to` | uuid 🆕 | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin phụ trách chăm sóc lead (nếu phân công) |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `course_id` → `courses(id)` SET NULL; `user_id`/`assigned_to` → `profiles(id)` SET NULL.
- **UNIQUE:** `reference_code`; `idempotency_key`.
- **Index:** `idx_leads_status_created (status, created_at DESC)`; `idx_leads_phone (phone)`; `idx_leads_reference (reference_code)`; `idx_leads_email (email)` 🆕 (liên kết lead ↔ tài khoản); `idx_leads_assigned (assigned_to, status)` 🆕.
- **RLS:** SELECT/UPDATE chỉ admin; INSERT chỉ qua Workers (service-role) — **không có policy INSERT cho client** (chống spam như Apps Script hiện tại). Không DELETE qua client.
- **Luồng (QĐ 5):** API làm lớp trước (validate / chống spam / chống trùng) → ghi DB → ghi Sheet (bản sao đối soát). Sheet không phải DB chính.

### 3.26. `notifications` — Thông báo in-app — 🆕 MỚI (Task 02 QĐ 4)

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Người nhận (thông báo hệ thống chung cho admin: `user_id` = admin nhận) |
| `type` | text | NOT NULL, CHECK IN (`order_created`, `order_paid`, `order_reminder`, `course_completed`, `certificate_issued`, `assignment_graded`, `event_reminder`, `lead_assigned`, `system`) | Loại thông báo (mở rộng bằng migration mới khi thêm loại) |
| `title` | text | NOT NULL | Tiêu đề hiển thị |
| `body` | text | NULL | Nội dung ngắn |
| `related_type` | text | NULL | VD `order`, `course`, `event`, `assignment` |
| `related_id` | uuid | NULL | ID đối tượng liên quan (không FK cứng — giống `email_logs`, để không khóa xóa) |
| `action_url` | text | NULL | Link mở khi bấm thông báo (vd. `/hoc-vien/khoa-hoc/[slug]`) |
| `is_read` | boolean | NOT NULL DEFAULT false | |
| `read_at` | tstz | NULL | |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` CASCADE.
- **Index:** `idx_notifications_user_read (user_id, is_read, created_at DESC)`; `idx_notifications_type (type, created_at DESC)`.
- **RLS:** SELECT mình + admin; INSERT qua Workers; UPDATE mình (đánh dấu đã đọc); không DELETE qua client (xóa = đánh dấu đã đọc + ẩn ở client; dọn dữ liệu cũ theo chính sách lưu trữ).
- **Phân biệt với email:** `notifications` = thông báo **trong app**; email tương ứng vẫn ghi ở `email_logs`. Một sự kiện có thể sinh cả 2 (vd. đơn đã trả → notification + email E8). Không dùng `notifications` thay cho email giao dịch.

### 3.27. `email_logs` — Nhật ký email (đối soát Resend) — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `to_email` | text | NOT NULL | |
| `template` | text | NOT NULL | VD `welcome`, `order_paid`, `lesson_reminder` (13 mẫu E1–E13) |
| `resend_id` | text | NULL | ID từ Resend |
| `status` | text | NOT NULL DEFAULT `'queued'`, CHECK IN (`queued`, `sent`, `delivered`, `bounced`, `failed`) | Webhook Resend cập nhật `delivered`/`bounced` |
| `related_type` | text | NULL | VD `lead`, `order`, `enrollment` |
| `related_id` | uuid | NULL | Không FK cứng |
| `error_message` | text 🆕 | NULL | Lỗi gửi (vd. `daily_quota_exceeded`) — phục vụ báo cáo R8 |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | Append-only: không UPDATE ngoài cập nhật `status` qua webhook |

- **PK:** `id`. **FK:** không có (liên kết mềm qua `related_type` + `related_id`).
- **Index:** `idx_email_logs_to_template (to_email, template, created_at DESC)`; `idx_email_logs_status (status, created_at DESC)` 🆕; `idx_email_logs_resend (resend_id)` 🆕.
- **RLS:** SELECT chỉ admin; INSERT/UPDATE qua Workers; không DELETE qua client.

### 3.28. `automation_events` — Nhật ký lượt chạy automation — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `event_type` | text | NOT NULL, CHECK IN (`order_reminder_12h`, `order_reminder_24h`, `lesson_reminder_7d`, `event_reminder_1d`, `membership_expiry_reminder`, `lead_followup_reminder`) | Loại automation (tương ứng email nhắc E6/E7/E10/E11 + nhắc hết hạn gói) |
| `trigger` | text | NOT NULL, CHECK IN (`cron`, `manual`, `webhook`) | Nguồn kích hoạt (Workers Cron mỗi giờ / admin chạy tay / webhook) |
| `status` | text | NOT NULL DEFAULT `'pending'`, CHECK IN (`pending`, `running`, `succeeded`, `failed`, `skipped`) | `skipped` = chạy nhưng không có đối tượng nào cần xử lý |
| `target_count` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | Số đối tượng đã xử lý trong lượt chạy |
| `success_count` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | Số xử lý thành công |
| `failure_count` | integer | NOT NULL DEFAULT 0, CHECK `>= 0` | Số xử lý lỗi |
| `details` | jsonb | NULL | Chi tiết lỗi / danh sách ID đã xử lý (chỉ `reference_code`/`user_id`, **không ghi PII**) |
| `started_at` | tstz | NOT NULL DEFAULT now() | |
| `finished_at` | tstz | NULL | |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | Append-only: không UPDATE ngoài cập nhật `status` khi chạy xong |

- **PK:** `id`. **FK:** không có (liên kết tới từng email qua `email_logs.related_type = 'automation_event'` + `related_id` khi cần đối soát chi tiết).
- **Index:** `idx_automation_events_type_time (event_type, started_at DESC)`; `idx_automation_events_status (status, started_at DESC)`.
- **Phân biệt với `email_logs`:** `automation_events` ghi **1 dòng / 1 lượt chạy** (vd. cron 14:00 quét 30 đơn quá hạn); `email_logs` ghi **1 dòng / 1 email** đã gửi trong lượt đó. Không thay thế nhau.
- **RLS:** SELECT chỉ admin; INSERT/UPDATE qua Workers; không DELETE qua client.

### 3.29. `activity_logs` — Nhật ký hoạt động chung của người dùng — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `user_id` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Người thực hiện; NULL = khách chưa đăng nhập (vd. xem khóa công khai — chỉ ghi khi cần phân tích, mặc định không ghi hành vi khách) |
| `action` | text | NOT NULL | VD `auth.login`, `auth.logout`, `profile.update`, `password.reset`, `course.view`, `lesson.view` |
| `target_type` | text | NULL | VD `course`, `lesson`, `profile` |
| `target_id` | uuid | NULL | Không FK cứng |
| `metadata` | jsonb | NULL | Dữ liệu kèm (**không chứa PII, mật khẩu, token**) |
| `ip_address` | text | NULL | IP (phục vụ phát hiện bất thường; lưu tối đa theo chính sách, xem §9, Q8) |
| `user_agent` | text | NULL | |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | Append-only: không UPDATE/DELETE |

- **PK:** `id`. **FK:** `user_id` → `profiles(id)` SET NULL.
- **Index:** `idx_activity_logs_user_time (user_id, created_at DESC)`; `idx_activity_logs_action (action, created_at DESC)`.
- **Phân biệt với `audit_logs`:** `activity_logs` = hành vi **thường ngày của mọi user** (đăng nhập, xem bài); `audit_logs` = thao tác **nhạy cảm của admin** (`order.mark_paid`, `role.grant`…) — xem §3.30. `learning_events` chỉ ghi sự kiện **học tập** có ý nghĩa phân tích (R5/R10), không ghi mọi click.
- **RLS:** SELECT mình + admin; INSERT qua Workers; không UPDATE/DELETE qua client.

### 3.30. `audit_logs` — Nhật ký thao tác admin — GIỮ NGUYÊN TÊN

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `actor_id` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin thực hiện; NULL = hệ thống (Workers) |
| `action` | text | NOT NULL | VD `order.mark_paid`, `order.refund`, `course.publish`, `lead.status`, `role.grant`, `enrollment.grant`, `certificate.revoke` |
| `target_type` | text | NOT NULL | VD `order`, `course`, `lead`, `enrollment`, `profile` |
| `target_id` | uuid | NULL | Không FK cứng |
| `details` | jsonb | NULL | Chi tiết thay đổi (giá trị trước/sau); **không chứa PII thừa, không chứa secret** |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | Append-only: không UPDATE/DELETE (Module 1 đã có `updated_at` — giữ để tương thích, không dùng) |

- **PK:** `id`. **FK:** `actor_id` → `profiles(id)` SET NULL.
- **Index:** `idx_audit_logs_actor_time (actor_id, created_at DESC)` 🆕; `idx_audit_logs_action (action, created_at DESC)` 🆕; `idx_audit_logs_target (target_type, target_id)` 🆕.
- **RLS:** SELECT chỉ admin; INSERT qua Workers; không UPDATE/DELETE qua client.
- **Bắt buộc ghi:** admin tặng khóa (`enrollment.grant`), xác nhận thanh toán thủ công (`order.mark_paid`), hoàn trả (`order.refund`), cấp/thu hồi role (`role.grant`/`role.revoke`), gán/thu hồi giảng viên (`instructor.assign`), thu hồi chứng chỉ (`certificate.revoke`).

### 3.31. `system_settings` — Cài đặt hệ thống (key–value) — 🆕 MỚI

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `key` | text PK | NOT NULL | Khóa cài đặt, VD `completion.video_threshold_percent`. **PK là `key`, không có cột `id`** (ngoại lệ duy nhất so với quy ước §1) |
| `value` | jsonb | NOT NULL | Giá trị (số, chuỗi, boolean, object đều được) |
| `description` | text | NULL | Mô tả ý nghĩa + đơn vị của giá trị |
| `updated_by` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin sửa cuối |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `key` (text). **FK:** `updated_by` → `profiles(id)` SET NULL.
- **Index:** không cần thêm (PK đã index).
- **Các key dự kiến khi seed (giá trị lấy từ quyết định đã chốt, không bịa giá dịch vụ):**

| Key | Giá trị seed | Nguồn |
|---|---|---|
| `completion.video_threshold_percent` | `90` | QĐ 17 |
| `order.expiry_hours` | `48` | Kiến trúc tổng thể §8.2 (đơn chuyển khoản +48h) |
| `order.reminder_hours` | `[12, 24]` | Email nhắc E6/E7 |
| `learning.inactivity_reminder_days` | `7` | Email nhắc E10 (không học 7 ngày) |
| `refund.working_days` | `15` | QĐ 9 (hoàn trả 15 ngày làm việc) |
| `complaint.response_days` | `3` | QĐ 9 (khiếu nại phản hồi 3 ngày) |
| `event.reminder_hours_before` | `24` | Email nhắc sự kiện E11 (trước 1 ngày) |

- **RLS:** SELECT: admin đọc hết; client chỉ đọc key công khai qua API (whitelist ở Workers); UPDATE chỉ admin (qua Workers) + ghi `audit_logs`.
- **Không lưu ở đây:** secret, API key, thông tin tài khoản ngân hàng, giá gói dịch vụ bên ngoài. Những thứ đó chỉ nằm trong Cloudflare Workers Secrets / GitHub Secrets.

---

## 4. Bảng ngoài danh sách 31 (bổ sung đã phê duyệt + bảng Module 1 giữ nguyên)

### 4.1. `course_instructors` — Giảng viên phụ trách khóa — 🆕 MỚI, đã phê duyệt (Task 02 QĐ 3)

Bảng liên kết giảng viên ↔ khóa phụ trách. Không có bảng này thì quyền instructor “khóa phụ trách” không thể thực thi ở RLS lẫn API (ROLE_PERMISSION_MATRIX §5). Tạo bằng migration mới sau khi duyệt thiết kế này.

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `course_id` | uuid | NOT NULL, FK → `courses(id)` ON DELETE CASCADE | |
| `instructor_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Phải có `role = 'instructor'` hoặc `'admin'` — kiểm tra ở API |
| `assigned_by` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL | Admin gán |
| `assigned_at` | tstz | NOT NULL DEFAULT now() | |
| `revoked_at` | tstz | NULL | NULL = đang phụ trách |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **UNIQUE:** `(course_id, instructor_id) WHERE revoked_at IS NULL` — 1 giảng viên chỉ phụ trách 1 khóa 1 lần tại 1 thời điểm.
- **Index:** `idx_course_instructors_course (course_id, revoked_at)`; `idx_course_instructors_instructor (instructor_id, revoked_at)`.
- **RLS:** chỉ admin đọc/ghi (qua Workers); instructor đọc dòng của mình để biết khóa phụ trách.
- **Audit:** mọi lần gán/thu hồi ghi `audit_logs` (`action = 'instructor.assign'` / `'instructor.revoke'`).

### 4.2. `question_options` — Lựa chọn của câu hỏi (chứa đáp án đúng) — 🔁 ĐỔI TÊN từ `quiz_options` (tên đề xuất)

| Cột | Kiểu | Ràng buộc / Mặc định | Ghi chú |
|---|---|---|---|
| `id` | uuid PK | DEFAULT `gen_random_uuid()` | |
| `question_id` | uuid | NOT NULL, FK → `questions(id)` ON DELETE CASCADE | 🔁 FK đổi đích từ `quiz_questions` sang `questions` |
| `option_text` | text | NOT NULL | Nội dung lựa chọn |
| `is_correct` | boolean | NOT NULL DEFAULT false | **Đáp án đúng — không bao giờ trả về client** |
| `display_order` | integer | NOT NULL | |
| `deleted_at` | tstz 🆕 | NULL | Soft delete |
| `created_at`, `updated_at` | tstz | NOT NULL DEFAULT now() | |

- **PK:** `id`. **FK:** `question_id` → `questions(id)` CASCADE.
- **Index:** `idx_question_options_question (question_id, display_order)`.
- **RLS:** không có policy SELECT trực tiếp cho client (mặc định từ chối). Client chỉ đọc VIEW `quiz_options_public` (`id, question_id, option_text, display_order` — không có `is_correct`). Admin ghi qua Workers; Workers (service-role) đọc `is_correct` để chấm điểm.
- **Tên gọi:** đề xuất `question_options` (rõ nghĩa, tránh nhầm với `answers`). Phương án giữ nguyên tên cũ `quiz_options` cũng được chấp nhận — quyết ở §9, Q5. Dù chọn tên nào, **không được** đặt tên bảng này là `answers`.

### 4.3. Bảng Module 1 giữ nguyên ngoài danh sách 31 — KHÔNG XÓA, KHÔNG ĐỔI TÊN

5 bảng sau không nằm trong danh sách 31 của Task 03 nhưng **đang có trong Module 1 và vẫn được hệ thống dùng** (sự kiện, blog, chính sách, newsletter). Thiết kế này **giữ nguyên toàn bộ** — cột, ràng buộc, index, RLS như `0001_init_schema.sql`. Chỉ ghi tóm tắt để đối chiếu; đặc tả đầy đủ là migration Module 1.

| Bảng | Vai trò | Cột chính (tóm tắt) | Ghi chú |
|---|---|---|---|
| `events` | Sự kiện (workshop / Q&A / live) | `slug` UNIQUE, `title`, `type` (`live`, `workshop`, `qa`), `starts_at`, `location`, `image_url`, `status` (`upcoming`, `happened`, `cancelled`) | 3 sự kiện ngày 25/11/2026, giờ mặc định 18:30, hình thức Zoom (Task 02 QĐ 13) — ngày/giờ nhập qua seed, không hard-code trong schema |
| `event_registrations` | Đăng ký sự kiện | `event_id` → `events` CASCADE, `user_id` → `profiles` CASCADE (NULL nếu khách chưa đăng nhập), `email`, `full_name`, UNIQUE(`event_id`, `email`) | |
| `posts` | Bài blog | `slug` UNIQUE, `title`, `excerpt`, `body` (Markdown), `cover_url`, `status` (`draft`, `published`, `archived`), `published_at`, `author_id` → `profiles` SET NULL | |
| `policies` | Chính sách (versioning) | `slug`, `title`, `body`, `version`, `is_current`, UNIQUE(`slug`, `version`) | Chỉ 1 bản `is_current` / 1 slug (kiểm tra ở API); không sửa version cũ — tạo version mới |
| `newsletter_subscribers` | Đăng ký nhận tin | `email` UNIQUE, `status` (`subscribed`, `unsubscribed`), `source` DEFAULT `'footer'` | Newsletter làm thật (QĐ 6): ghi qua Workers, không còn newsletter giả |

- **Vì sao không gộp `events` vào `learning_events`:** hai khái niệm khác nhau (§3.10). Gộp sẽ làm mất lịch sự kiện, đăng ký sự kiện và báo cáo R7.
- **Nếu sau này muốn bỏ 1 trong 5 bảng:** phải có quyết định phê duyệt riêng + migration chuyển dữ liệu (vd. xuất CSV lưu trữ) — không tự xóa trong Task 03.

---

## 5. Phương án migration đổi tên / gộp (giữ dữ liệu)

Nguyên tắc: **không `DROP TABLE`, không sửa migration cũ.** Tất cả thay đổi bằng migration mới, đánh số thứ tự (`0004_…`, `0005_…`, …), chạy theo thứ tự, mỗi bước kiểm tra được (đếm dòng trước/sau). Không triển khai trong Task 03 — đây là kế hoạch để duyệt trước khi viết migration thật.

### 5.1. Đổi tên bảng (giữ nguyên dữ liệu, giữ nguyên id)

| Bước | Câu lệnh (mẫu) | Ghi chú |
|---|---|---|
| 1 | `ALTER TABLE public.modules RENAME TO course_modules;` | Đổi tên index `idx_modules_course` → `idx_course_modules_course`; đổi tên trigger `trg_modules_updated_at` tương ứng |
| 2 | `ALTER TABLE public.quiz_questions RENAME TO questions;` | Giữ cột `lesson_id` tạm thời ở bước này (xem §5.2) |
| 3 | `ALTER TABLE public.quiz_options RENAME TO question_options;` (hoặc giữ `quiz_options` — quyết §9, Q5) | Giữ VIEW `quiz_options_public` hoạt động (sửa định nghĩa VIEW trỏ sang tên mới, hoặc giữ tên VIEW cũ) |

### 5.2. Tách lớp `quizzes` + chuyển `questions.lesson_id` → `questions.quiz_id`

1. Tạo bảng `quizzes` (theo §3.11).
2. Với mỗi `lessons` có `type = 'quiz'` (hoặc có câu hỏi trong `questions`): tạo 1 dòng `quizzes` (`lesson_id`, `title` = `lessons.title`, `status = 'published'`).
3. Thêm cột `questions.quiz_id` (nullable) → backfill: `UPDATE questions SET quiz_id = <quiz của lesson_id cũ>` → đặt `NOT NULL` → bỏ cột `questions.lesson_id` cũ (chỉ bỏ cột, không bỏ bảng).
4. Kiểm tra: số câu hỏi trước/sau bằng nhau; mỗi `quiz_id` đều trỏ tới đúng `lesson_id` cũ.

### 5.3. Backfill các bảng mới từ dữ liệu cũ

| Bảng mới | Nguồn backfill | Cách làm |
|---|---|---|
| `user_roles` | `profiles.role` | Mỗi `profiles` tạo 1 dòng (`user_id`, `role` = `profiles.role`, `granted_at` = `profiles.created_at`, `granted_by` = NULL, `reason` = `'backfill từ profiles.role (Module 1)'`) |
| `answers` | `quiz_attempts.answers` (jsonb) | Mở rộng từng phần tử jsonb thành dòng `answers` (`quiz_attempt_id`, `question_id`, `selected_option_id`/`answer_text`, `is_correct` snapshot). Giữ nguyên cột jsonb làm snapshot bất biến. Kiểm tra: tổng số dòng `answers` = tổng số câu đã trả lời trong jsonb |
| `order_items` | `orders` | Mỗi `orders` tạo 1 dòng (`item_type = 'course'`, `course_id`, `item_name` = `courses.title` tại thời điểm đó, `unit_price_vnd` = `orders.amount_vnd` + `discount_vnd` (hoặc `custom_amount_vnd` nếu có), `quantity = 1`). Giữ `orders.course_id` |
| `lesson_resources` | `lessons.file_url` | Mỗi `lessons` có `file_url` NOT NULL tạo 1 dòng (`resource_type = 'pdf'` nếu tên file kết thúc `.pdf`, ngược lại `'other'`, `title` = tên file). Giữ cột `lessons.file_url` (deprecated) |
| `quizzes` | `lessons` loại `quiz` | Xem §5.2 |
| `course_instructors` | — (không có dữ liệu cũ) | Tạo rỗng; admin gán sau khi duyệt |
| `categories` | `courses.pillar` | Tạo 4 nhóm theo 4 trụ cột; backfill `courses.category_id` theo `pillar` (admin xác nhận lại sau) |
| `system_settings` | Quyết định đã chốt | Seed 7 key ở §3.31 |

### 5.4. Thứ tự migration đề xuất (chưa viết code)

1. `0004_rename_tables.sql` — đổi tên 3 bảng (§5.1) + tạo `categories`, `course_instructors`, `question_options` (nếu đổi tên) — chỉ DDL, không mất dữ liệu.
2. `0005_quizzes_answers.sql` — tạo `quizzes`, `questions.quiz_id`, `answers` + backfill (§5.2, §5.3).
3. `0006_assignments.sql` — tạo `assignments`, `submissions`, `submission_reviews`.
4. `0007_commerce.sql` — tạo `order_items`, `coupons`, `membership_plans`, `memberships` + backfill `order_items` + thêm cột `orders.coupon_id/discount_vnd/original_amount_vnd/paid_at`.
5. `0008_engagement.sql` — tạo `user_roles`, `lesson_resources`, `learning_events`, `notifications`, `automation_events`, `activity_logs`, `system_settings` + backfill `user_roles`/`lesson_resources`/`system_settings` + thêm cột mới ở các bảng cũ (`profiles.status`, `courses.category_id/deleted_at`, `enrollments.granted_by`, `certificates.status`, `leads.user_id/assigned_to`, `email_logs.error_message`).
6. `0009_rls_new_tables.sql` — bật RLS + policy cho mọi bảng mới (theo §7); bổ sung policy instructor cho `lesson_progress`/`quiz_attempts`/`answers` (phụ thuộc `course_instructors`).

Mỗi migration kết thúc bằng câu kiểm tra (đếm dòng, kiểm tra FK mồ côi) và chỉ commit khi kiểm tra đạt.

---

## 6. Index tổng hợp (bảng mới + bảng đổi tên)

Ngoài index ở từng bảng §3–§4, các index sau là bắt buộc để báo cáo R1–R10 chạy được mà không quét toàn bảng:

```sql
-- Học tập
CREATE INDEX idx_learning_events_user_time ON learning_events(user_id, occurred_at DESC);
CREATE INDEX idx_learning_events_course_type ON learning_events(course_id, event_type, occurred_at DESC);
-- Quiz / bài tập
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id, submitted_at DESC);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id, submitted_at DESC);
-- Thương mại
CREATE INDEX idx_orders_status_expires ON orders(status, expires_at);
CREATE INDEX idx_memberships_expires ON memberships(expires_at) WHERE status = 'active';
-- Vận hành
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_automation_events_type_time ON automation_events(event_type, started_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_leads_email ON leads(email);
```

---

## 7. RLS tóm tắt (mọi bảng — nguyên tắc 2 lớp: RLS + kiểm tra role ở Workers API)

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Mình + admin | Mình (khi đăng ký) | Mình + admin | Không (vô hiệu hóa bằng `status`) |
| `user_roles` | Mình (dòng của mình) + admin | Admin (qua Workers) | Admin (qua Workers) | Không |
| `courses`, `categories` | Công khai nếu `published`/`active` | Admin | Admin | Admin (nên archive thay vì xóa) |
| `course_modules`, `lessons`, `lesson_resources` | Công khai nếu khóa `published`; bài không xem thử chỉ khi đã ghi danh (kiểm tra ở API) | Admin / instructor (khóa phụ trách) | Admin / instructor (khóa phụ trách) | Admin |
| `quizzes`, `questions` | Như `lessons` | Admin / instructor (khóa phụ trách) | Admin / instructor (khóa phụ trách) | Admin |
| `question_options` | Qua VIEW `quiz_options_public` (không `is_correct`) | Admin | Admin | Admin |
| `enrollments` | Mình + admin (+ instructor: khóa phụ trách) | Qua Workers | Admin (đổi status) | Không |
| `lesson_progress` | Mình + admin (+ instructor: khóa phụ trách) | Mình (qua Workers) | Mình (qua Workers) | Không |
| `learning_events` | Mình + admin (+ instructor: khóa phụ trách) | Qua Workers | Không | Không |
| `quiz_attempts`, `answers` | Mình + admin (+ instructor: khóa phụ trách) | Qua Workers | Không | Không |
| `assignments` | Như `lessons` | Admin / instructor (khóa phụ trách) | Admin / instructor (khóa phụ trách) | Admin |
| `submissions` | Mình + admin + instructor (khóa phụ trách) | Mình (qua Workers) | Mình (nộp lại, qua Workers) | Không |
| `submission_reviews` | Học viên (bài của mình) + admin + instructor (khóa phụ trách) | Admin / instructor (khóa phụ trách, qua Workers) | Admin / instructor (chấm lại) | Không |
| `orders`, `order_items` | Mình + admin | Qua Workers | Admin / Workers | Không |
| `payments` | Admin | Qua Workers | Workers | Không |
| `coupons` | Admin (học viên kiểm tra mã qua API) | Admin | Admin | Admin (nên `inactive` thay vì xóa) |
| `membership_plans` | Công khai nếu `active` | Admin | Admin | Admin (nên archive) |
| `memberships` | Mình + admin | Qua Workers | Admin / Workers | Không |
| `certificates` | Mình + admin | Qua Workers | Admin (thu hồi) | Không |
| `leads` | Admin | Qua Workers (service-role) | Admin | Không |
| `notifications` | Mình + admin | Qua Workers | Mình (đánh dấu đã đọc) | Không |
| `email_logs`, `automation_events`, `activity_logs`, `audit_logs` | Admin (activity_logs: + mình, dòng của mình) | Qua Workers | Workers (chỉ cập nhật `status` của log) | Không |
| `system_settings` | Admin (client chỉ đọc key công khai qua API) | Admin | Admin (qua Workers) + ghi `audit_logs` | Không |
| `course_instructors` | Admin + instructor (dòng của mình) | Admin (qua Workers) | Admin (qua Workers) | Không (thu hồi bằng `revoked_at`) |
| `events`, `posts`, `policies` | Công khai nếu `upcoming`/`happened`/`published`/`is_current` | Admin | Admin | Admin (policies: không sửa version cũ) |
| `event_registrations` | Mình + admin | Mình (qua Workers; khách bằng email) | Không | Mình (hủy) |
| `newsletter_subscribers` | Admin | Qua Workers | Qua Workers (unsubscribe) | Không |

**Mâu thuẫn cần lưu ý (xem §9, Q6):** ROLE_PERMISSION_MATRIX cấm instructor xem `is_correct` qua client và cấm instructor quản lý blog/sự kiện, nhưng DECISIONS (phê duyệt Task 02, QĐ 6) ghi instructor “được xem đáp án đúng quiz, SĐT/email học viên, và quản lý blog/sự kiện”. Thiết kế này giữ nguyên giới hạn ở RLS (server-only `is_correct`, blog/sự kiện chỉ admin) cho tới khi mâu thuẫn được chốt — không tự mở quyền.

---

## 8. Quy tắc không xóa cứng (tóm tắt — chi tiết ở `DATABASE_ERD.md` §5)

- **Không `DELETE` dòng** ở bảng nghiệp vụ (`courses`, `course_modules`, `lessons`, `enrollments`, `orders`, `payments`, `leads`, `memberships`, `certificates`, `submissions`…): dùng `deleted_at` hoặc chuyển `status` (`archived` / `revoked` / `cancelled` / `refunded` / `unsubscribed`).
- **Ngoại lệ duy nhất:** `event_registrations` cho phép học viên hủy đăng ký sự kiện của mình (DELETE dòng của mình — theo Module 1); `notifications` chỉ ẩn ở client, không DELETE.
- **Bảng log** (`audit_logs`, `activity_logs`, `learning_events`, `automation_events`, `email_logs`): append-only, không UPDATE/DELETE; dọn dữ liệu cũ chỉ theo chính sách lưu trữ đã phê duyệt (vd. sau 24 tháng, xuất file lưu trữ rồi mới xóa — quyết ở §9, Q8).
- **Xóa tài khoản:** không xóa `auth.users` khi còn đơn hàng/thanh toán — vô hiệu hóa (`profiles.status = 'deactivated'`) và giữ dữ liệu đối soát (xem §9, Q9).

---

## 9. Quyết định cần phê duyệt

| # | Quyết định | Phương án đề xuất trong file này | Cần user chốt |
|---|---|---|---|
| Q1 | Tổng số bảng vật lý: 38 hay 31? | 31 bảng theo yêu cầu + 2 bảng bổ sung (`course_instructors`, `question_options`) + 5 bảng Module 1 giữ nguyên = **38 bảng**. Không xóa bảng nào | Chốt con số 38, hoặc chỉ rõ bảng nào trong 7 bảng ngoài danh sách được bỏ (kèm phương án chuyển dữ liệu) |
| Q2 | Module 1 có 19 hay 20 bảng? | Đếm trực tiếp `0001_init_schema.sql`: **20 bảng** (`create table` × 20). Task 03 ghi 19 là thiếu 1 | Xác nhận 20 bảng là đúng để đối chiếu |
| Q3 | `user_roles` hay chỉ `profiles.role`? | Tạo `user_roles` làm nguồn lịch sử cấp/thu hồi; `profiles.role` giữ làm cache cho RLS, đồng bộ bằng trigger | Chốt 1 trong 2: (a) tạo `user_roles` như thiết kế, hoặc (b) bỏ `user_roles`, giữ nguyên `profiles.role` |
| Q4 | `categories` vs `pillar`? | Tạo `categories` mới; **giữ** `courses.pillar` (không bỏ) để lọc theo trụ cột như hiện tại | Chốt: giữ cả hai, hay bỏ `pillar` và dùng `categories` thay thế (kèm backfill) |
| Q5 | Tên bảng lựa chọn câu hỏi + tên bảng đáp án học viên? | Lựa chọn: `question_options` (đề xuất) hoặc giữ `quiz_options`; đáp án học viên: `answers` (theo Task 03) hoặc `quiz_answers` | Chốt tên cho cả 2 bảng trước khi viết migration (không đổi tên sau khi đã chạy) |
| Q6 | Instructor xem đáp án đúng / SĐT-email / quản lý blog-sự kiện? | **Mâu thuẫn nguồn:** ma trận quyền cấm; DECISIONS Task 02 QĐ 6 cho phép. Thiết kế giữ giới hạn cũ (server-only, admin-only) cho tới khi chốt | Chốt rõ từng quyền: (a) xem `is_correct` của khóa phụ trách qua kênh nào, (b) xem SĐT/email học viên khóa phụ trách hay không, (c) quản lý blog/sự kiện hay không |
| Q7 | Bài tập tự luận: loại bài `assignment`, nộp lại, chấm lại? | Thêm `lessons.type = 'assignment'`; nộp lại = cập nhật bài nộp cũ; chấm lại = UPDATE 1 dòng `submission_reviews` (UNIQUE `submission_id`) | Chốt 3 điểm: thêm loại bài hay không; nộp lại tạo bản mới hay cập nhật; chấm lại ghi đè hay giữ lịch sử nhiều lượt chấm |
| Q8 | Ranh giới 4 bảng log + thời gian lưu trữ? | `learning_events` (học tập) / `activity_logs` (hành vi chung) / `audit_logs` (thao tác admin) / `automation_events` (lượt chạy automation) như §3.10/§3.28/§3.29/§3.30; `video_progress` chỉ ghi mốc 25/50/75/90/100% | Chốt ranh giới và thời gian lưu trữ log (đề xuất: xem xét dọn sau 24 tháng, chỉ sau khi xuất file lưu trữ) |
| Q9 | Xóa tài khoản còn đơn hàng/thanh toán? | Vô hiệu hóa (`status = 'deactivated'`), giữ đơn/payment để đối soát; `orders.user_id` giữ CASCADE trong thiết kế này theo Module 1 nhưng **chưa chốt** | Chốt: (a) giữ CASCADE như Module 1, hay (b) đổi `orders.user_id`/`payments` sang SET NULL + ẩn danh khi xóa tài khoản |
| Q10 | Đơn hàng 1 khóa hay nhiều khóa? | Giai đoạn đầu đơn vẫn 1 dòng hàng (`order_items` backfill 1–1 từ `orders`); `orders.course_id` giữ lại tương thích | Chốt: đơn nhiều khóa có bán ngay từ đầu không, hay chỉ chuẩn bị cấu trúc |
| Q11 | Gói thành viên ↔ ghi danh khóa? | Mua gói có `course_id` đi kèm thì tự tạo `enrollments` cho khóa đó khi `memberships` sang `active` | Chốt: gói Cộng đồng có tự mở enrollment khóa “Cộng đồng Visfar” không; hết hạn gói có thu hồi enrollment không |
| Q12 | Ngưỡng hoàn thành / slug | Đã chốt QĐ 17: `lessons.slug` UNIQUE theo module; video ≥ 90%, bài text bấm “Đã hoàn thành”, tính theo module | Không cần quyết lại — ghi để xác nhận thiết kế tuân thủ QĐ 17 |

*Hết file. Ngày 10/11/2026 — Chờ phê duyệt. Không triển khai DB, không chạy migration, không sửa code.*
