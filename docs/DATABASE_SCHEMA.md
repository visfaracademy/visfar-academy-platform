# DATABASE_SCHEMA — Schema hiện tại (từ migrations 0001–0031)

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Nguồn duy nhất:** `supabase/migrations/0001–0031` (đọc thật). Không bịa cột/quan hệ.
- **Phân biệt với bản thiết kế:** `docs/database/DATABASE_SCHEMA.md` là **thiết kế Task 03** (38 bảng, giá trị trụ cột cũ, trước các migration 0007–0031) — file này là **trạng thái thật sau khi áp migrations**, dùng làm tham chiếu hiện tại; file thiết kế giữ nguyên, không sửa.
- **Lưu ý đếm:** đếm tĩnh từ `CREATE TABLE` trong migrations: **60 tên bảng** xuất hiện, trong đó 3 tên cũ (`modules`, `quiz_questions`, `quiz_options`) được đổi tên ở 0005 → **~57 bảng vật lý**. Con số này là đếm tĩnh từ file migration, **chưa đối chứng bằng query `information_schema` trực tiếp trên prod/staging trong đợt này** (Management API endpoint `/database/migrations` trả `[]` nên không dùng làm bằng chứng — xem PROJECT_AUDIT §8). Nếu đếm live lệch, tin số live.
- **Trạng thái áp migration:** prod tới **0024**; staging tới **0031**. Các bảng 0025–0031 chỉ tồn tại trên staging cho tới khi áp prod (xem §8).
- **Không chứa secret/key/token nào.**

## 1. Quy ước chung (đọc từ migration)

- PK: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (ngoại lệ: `system_settings.key text PRIMARY KEY`).
- Mọi bảng có `created_at` / `updated_at timestamptz NOT NULL DEFAULT now()` + trigger `set_updated_at()`; bảng log append-only không UPDATE.
- Tiền: `integer` VND, `CHECK >= 0` (riêng `payments.amount_vnd CHECK > 0`); không dùng float cho tiền.
- SĐT: `text`, `CHECK ^0[0-9]{9}$`; email `text`, TLD ≥ 2 ký tự.
- Soft delete: `deleted_at timestamptz NULL` trên bảng nghiệp vụ (ưu tiên `status` thay vì xóa).
- RLS bật trên mọi bảng vật lý (đếm tĩnh: **156 lệnh `CREATE POLICY`** trong toàn bộ migrations, gồm cả policy đã bị drop/thay thế sau này — con số policy đang hiệu lực chưa đếm live).
- Múi giờ: mọi cột thời gian là `timestamptz`; hiển thị theo giờ Việt Nam ở tầng ứng dụng.

## 2. Bảng theo nhóm (tên bảng · migration tạo · cột chính · quan hệ chính)

### 2.1. Người dùng & vai trò

| Bảng | Migration | Cột chính | Quan hệ / ràng buộc đáng chú ý |
|---|---|---|---|
| `profiles` | 0001 (+0009, 0021, 0022, 0031) | `id` (= `auth.users.id`), `full_name`, `phone`, `email` UNIQUE, `province`, `role` (cache), `avatar_url`, `status`, `is_disabled`, `disabled_at`, `disabled_reason`, `gamification_enabled` (0031, default true), `deleted_at` | Trigger `handle_new_user()` tạo profile khi đăng ký; trigger chặn tự đổi `role` (0009) và tự đổi `is_disabled` (0022); `role` đồng bộ từ `user_roles` bằng trigger (S-17: `current_role()` vẫn đọc cache) |
| `user_roles` | 0004 | `user_id`, `role`, `granted_by`, `granted_at`, `revoked_at`, `revoked_by`, `reason` | **Nguồn sự thật duy nhất về role** (QĐ Task 03); UNIQUE `(user_id, role) WHERE revoked_at IS NULL` |
| `lesson_notes` | 0011 | (ghi chú bài học của học viên — chi tiết cột chưa trích trong đợt này, xem file migration) | RLS chỉ chủ sở hữu |

### 2.2. Khóa học & nội dung (LMS lõi)

| Bảng | Migration | Cột chính | Quan hệ / ràng buộc đáng chú ý |
|---|---|---|---|
| `courses` | 0001 (+0019, 0024, 0026) | `slug` UNIQUE, `category_id`, `display_order`, `title`, `subtitle`, `description`, `details` jsonb, `pillar`, `poster_url`, `price_vnd` (default 0, CHECK ≥ 0), `is_pay_what_you_want` (0019), `is_featured`, `status` (`draft`/`published`/`archived`), `deleted_at` | 10 khóa seed (0002); `pillar` sau 0024: `tam`/`tam`/`tue`/`than`/`tich-hop`/`cong-dong` (Thân–Tâm–Tuệ); khóa 08 đổi title → "MASTER TÂM THỨC", giữ slug `master-tam-thuc-nhan-hieu` (0026) |
| `categories` | 0004 | `slug` UNIQUE, `name`, `description`, `parent_id` (tự tham chiếu, 1 cấp), `pillar`, `display_order`, `is_active` | Nhóm khóa học |
| `course_modules` | 0004 tạo mới, 0005 rename `modules` → `course_modules` | `course_id`, `title`, `description`, `display_order`, `deleted_at` | FK → `courses` CASCADE |
| `lessons` | 0001 (+0028) | `module_id` (sau 0005 đổi tên cột thành `course_module_id` — kiểm tra tên cột thật trong 0005 trước khi query), `slug`, `title`, `type` (`video`/`text`/`quiz`/`file`/`assignment`), `content`, `video_url` (YouTube unlisted), `video_duration_sec`, `file_url` (deprecated, chuyển sang `lesson_resources`), `display_order`, `is_free_preview`, `deleted_at` | UNIQUE `(module_id, slug)` — slug UNIQUE **theo module** (QĐ 17); policy sau 0028: `lessons_select_enrolled` (chỉ admin/instructor/học viên đã ghi danh); xem view §5 |
| `lesson_resources` | 0004 | `lesson_id`, `title`, `resource_type` (`pdf`/`doc`/`slide`/`audio`/`link`/`other`), `file_url`, `external_url`, `file_size_bytes`, `display_order`, `is_downloadable` | CHECK (có `file_url` hoặc `external_url`) |
| `course_instructors` | 0004 | (liên kết giảng viên ↔ khóa phụ trách — chi tiết cột xem file migration) | Chỉ admin gán |
| `master_library_items` | 0025 | `title`, `slug` UNIQUE, `category`, `content`, `cover_image_url`, `video_url`, `is_published`, `display_order` | **Staging only** (chưa áp prod); seed 119 mục nguyên văn; prod chạy dữ liệu mặc định trong code |

### 2.3. Ghi danh, tiến độ, đánh giá

| Bảng | Migration | Cột chính | Quan hệ / ràng buộc đáng chú ý |
|---|---|---|---|
| `enrollments` | 0001 (+0007) | `user_id`, `course_id`, `order_id` (NULL nếu miễn phí/tặng), `granted_by`, `grant_reason`, `status` (`active`/`completed`/`revoked`), `enrolled_at`, `completed_at` | UNIQUE `(user_id, course_id)`; admin tặng khóa bắt buộc ghi `audit_logs` |
| `lesson_progress` | 0001 (+0012) | `user_id`, `lesson_id`, `status` (`not_started`/`in_progress`/`completed`), `progress_percent` 0–100, `last_position_sec`, `completed_at` | UNIQUE `(user_id, lesson_id)`; trigger 0012 chặn `completed` khi < 90% (S-12: không chặn "khai 90% ngay từ đầu") |
| `learning_events` | 0004 | `user_id`, `course_id`, `lesson_id`, `event_type` (10 loại: `lesson_started`…`resource_downloaded`), `event_data` jsonb (không PII, không đáp án đúng), `occurred_at` | Append-only; chỉ ghi mốc 25/50/75/90/100%, không ghi mỗi giây |
| `quizzes` | 0004 | `lesson_id`, `title`, `description`, `passing_score_percent`, `time_limit_sec`, `max_attempts`, `shuffle_questions`, `status` | UNIQUE `(lesson_id)` — 1 bài quiz = 1 quiz |
| `questions` | 0004 tạo mới, 0005 rename `quiz_questions` → `questions` | `quiz_id`, `question`, `question_type` (`single_choice`/`multiple_choice`/`true_false`/`short_answer`), `explanation` (chỉ hiện sau nộp), `points`, `display_order` | FK → `quizzes` CASCADE |
| `question_options` | 0001 (`quiz_options`), 0005 rename | (lựa chọn trắc nghiệm, gồm `is_correct`) | **Không policy SELECT cho client**; chỉ đọc qua view `question_options_public` (không có `is_correct`); Workers đọc để chấm |
| `quiz_attempts` | 0001 (+0014) | `user_id`, `lesson_id`, `quiz_id`, `score`, `total`, `passed`, `status` (`in_progress`/`submitted`/`expired`), `answers` jsonb (snapshot giữ lại), `started_at`, `submitted_at` | Chấm ở server bằng hàm `submit_quiz_attempt` (SECURITY DEFINER) |
| `quiz_answers` | 0004 tạo là `answers`, 0007 rename → `quiz_answers` | `quiz_attempt_id` (tên cột thật trong 0007 là `attempt_id` — kiểm tra file trước khi query), `question_id`, `selected_option_id`/`answer_text`, `is_correct` (snapshot), `points_awarded` | Đáp án **học viên đã chọn** (không phải đáp án đúng); UNIQUE `(attempt_id, question_id)` |
| `assignments` | 0004 (+0015) | `lesson_id`, `title`, `description`, `assignment_type` (`essay`/`file_upload`/`mixed`), `max_score`, `due_at`, `allow_late_submission`, `status` | UNIQUE `(lesson_id)` |
| `submissions` | 0004 | `assignment_id`, `user_id`, `content_text`, `file_url` (Storage private), `status` (`draft`/`submitted`/`graded`/`returned`), `is_late`, `submitted_at`, `graded_at` | UNIQUE `(assignment_id, user_id) WHERE status <> 'draft'` |
| `submission_files` | 0015 | (file đính kèm bài nộp — chi tiết cột xem file migration) | Bucket private `submissions` |
| `submission_reviews` | 0004 | `submission_id`, `reviewer_id` (RESTRICT), `score`, `feedback`, `status` (`graded`/`returned`), `reviewed_at` | UNIQUE `(submission_id)` — 1 bài nộp = 1 kết quả chấm cuối; chấm lại = UPDATE |
| `certificates` | 0001 (+0016) | `certificate_code` UNIQUE dạng `VISFAR-CERT-YYYY-NNNNNN`, `status` (`valid`/`revoked`) | Tra cứu công khai qua hàm `verify_certificate` (chỉ trả 6 trường) |

### 2.4. Thương mại & thanh toán

| Bảng | Migration | Cột chính | Quan hệ / ràng buộc đáng chú ý |
|---|---|---|---|
| `orders` | 0001 (+0019) | `user_id`, `course_id` (giữ tương thích Module 1), `coupon_id`, `amount_vnd`, `original_amount_vnd`, `discount_vnd`, `custom_amount_vnd`, `status` (`pending`/`paid`/`cancelled`/`refunded`/`expired`), `payment_method`, `reference_code` UNIQUE (`DH-YYYY-NNNNNN`), `expires_at` (+48h), `paid_at`, `refund_reason`, `refund_requested_at`, `refunded_at`, `refund_bank_reference`, `idempotency_key` UNIQUE (0019) | Chỉ server đổi sang `paid` (webhook đã xác minh / admin mark-paid) |
| `order_items` | 0004 | `order_id`, `item_type` (`course`/`membership`), `course_id`, `membership_plan_id`, `item_name` (snapshot), `unit_price_vnd`, `quantity`, `total_vnd` | CHECK đúng 1 loại hàng/dòng |
| `payments` | 0001 | `order_id`, `amount_vnd` CHECK > 0, `method` (`bank_transfer`/`sepay`/`stripe`), `gateway_reference`, `gateway_payload` jsonb (không chứa secret), `status` (`pending`/`succeeded`/`failed`/`refunded`), `paid_at`, `verified_by` | UNIQUE `(method, gateway_reference)` — chống ghi trùng webhook; SELECT chỉ admin (S-08: lệch ma trận quyền, học viên không đọc được payment của mình) |
| `coupons` | 0004 | `code` UNIQUE, `discount_type` (`percent`/`fixed_amount`), `discount_value`, `min_order_vnd`, `max_discount_vnd`, `usage_limit`, `used_count`, `valid_from`/`valid_to`, `status` | `used_count` tăng khi đơn `paid` (Workers, transaction) |
| `membership_plans` | 0004 | (gói thành viên — chi tiết cột xem file migration) | |
| `memberships` | 0004 | (thành viên đã mua gói — chi tiết cột xem file migration) | |
| `appointments` | 0023 | `student_id`, `instructor_id` (SET NULL), `scheduled_at`, `duration_minutes` (default 60, > 0), `mode` (`zoom`/`truc-tiep`), `status` (`pending`/`confirmed`/`cancelled`/`completed`), `note`, `meeting_url` | Lịch hẹn 1–1 |
| `referral_codes` | 0023 | (mã giới thiệu của user — chi tiết cột xem file migration) | |
| `referrals` | 0023 | (lượt giới thiệu + hoa hồng — chi tiết cột xem file migration) | Xem `docs/payment/referrals-wallet.md` |
| `wallet_transactions` | 0023 | (giao dịch ví: hoa hồng, rút tiền — chi tiết cột xem file migration) | Rút tiền: yêu cầu `pending`, admin chuyển khoản thủ công trong 15 ngày làm việc |

### 2.5. Lead, CRM, nội dung, email, log

| Bảng | Migration | Cột chính | Quan hệ / ràng buộc đáng chú ý |
|---|---|---|---|
| `leads` | 0001 (+0018, 0020) | `reference_code` UNIQUE (`VISFAR-YYYY-NNNNNN`), `idempotency_key`, `full_name`, `phone`, `email`, `province`, `course_id`, `course_interest_text`, `source`, `status` (`new`/`contacted`/`enrolled`/`closed`/`spam`), `notes`, `user_id` (liên kết khi lead đăng ký tài khoản) | Không policy INSERT cho client — chỉ ghi qua Worker |
| `lead_interactions` | 0020 | (tương tác chăm sóc lead — chi tiết cột xem file migration) | CRM |
| `events` | 0001 | (sự kiện workshop/Q&A — 3 sự kiện 25/11/2026, 18:30) | Khác `learning_events` (nhật ký học tập) |
| `event_registrations` | 0001 | `event_id`, `email`, `user_id` | UNIQUE `(event_id, email)`; S-07: anon được INSERT trực tiếp (chưa sửa) |
| `posts` | 0001 | (bài blog — hiện 3 bài tĩnh trong code, chưa có admin đăng/sửa blog) | |
| `policies` | 0001 | (chính sách có versioning `version`, `is_current`) | 4 chính sách, URL thật `/chinh-sach/*` |
| `newsletter_subscribers` | 0001 | (đăng ký nhận tin) | Suppression-list cho email marketing |
| `email_logs` | 0001 (+0017, 0018) | `to_email`, `template`, `resend_id`, `status`, `related_type`, `related_id` | Đối soát Resend; log Resend chỉ giữ 30 ngày nên không dựa vào Resend làm nguồn đối soát |
| `email_unsubscribe_logs` | 0017 | (nhật ký hủy đăng ký email — chi tiết cột xem file migration) | Token hủy HMAC 90 ngày |
| `notifications` | 0004 | (thông báo in-app — chi tiết cột xem file migration) | Trang `/hoc-vien/thong-bao` đọc bảng này |
| `automation_events` | 0004 | (nhật ký lượt chạy automation) | |
| `activity_logs` | 0004 | (nhật ký hoạt động chung của user; học viên xem được log của mình) | Khác `learning_events` / `audit_logs` / `automation_events` (4 bảng log giữ riêng vai trò, lưu 12 tháng, IP chỉ admin xem) |
| `audit_logs` | 0001 | `actor_id`, `action`, `target_type`, `target_id`, `details` | Mọi thao tác admin đổi dữ liệu đều ghi (vd. `enrollment.grant`, `order.mark_paid`, `order.refund`, `library.create/update/delete`) |
| `system_settings` | 0004 | `key` text PK, `value` | 7 key khởi tạo (hoàn trả 15 ngày, khiếu nại 3 ngày, SePay, MB Bank — không lưu số tài khoản) |

### 2.6. GĐ2 mới (0027–0031, staging only)

| Bảng | Migration | Cột chính | Quan hệ / ràng buộc đáng chú ý |
|---|---|---|---|
| `assessments_11d` | 0027 | `user_id` FK `auth.users`, `answers` jsonb (object, giá trị 1–5), `scores` jsonb, `overall_score` numeric(4,2) 1–5, `completed_at` | RLS chỉ chủ sở hữu; view `assessment_aggregates_11d` tổng hợp không PII |
| `ai_knowledge_chunks` | 0029 | `source_type` (`library`/`course`/`philosophy`), `source_slug`, `title`, `content`, `keywords`, `search_text`, `search_vector` tsvector | UNIQUE `(source_type, source_slug)`; seed 138 chunk; **không index nội dung bài trả phí** |
| `ai_chat_sessions` | 0029 | `user_id`, `title` | RLS chỉ chủ sở hữu; không có policy admin |
| `ai_chat_messages` | 0029 | `session_id` CASCADE, `user_id`, `role` (`user`/`assistant`), `content`, `sources` jsonb, `helpful` boolean NULL | RLS chỉ chủ sở hữu |
| `community_posts` | 0030 | `author_id`, `course_id` (NULL = chung), `title` (3–200 ký tự), `body` (≤ 5000), `author_name` (lưu sẵn, không join `profiles`), `is_pinned`, `status` (`visible`/`hidden`) | Anon bị thu hồi toàn bộ quyền (probe staging 401 `42501`) |
| `community_comments` | 0030 | `post_id`, `author_id`, `body`, `author_name` | |
| `community_reactions` | 0030 | `post_id`/`comment_id` (đúng 1 mục tiêu), `user_id`, `type` (`like`/`helpful`/`celebrate`) | `helpful` từ người khác +5 điểm (tối đa 1 lần/ngày); tự thả cho bài mình không được điểm |
| `community_reports` | 0030 | `post_id`/`comment_id`, `reporter_id`, `reason`, `status` (`open`/`resolved`/`dismissed`), `resolved_at` | Xử lý ở `/admin/cong-dong` |
| `learning_points` | 0031 | `user_id`, `points` (> 0), `reason`, `related_id`, `created_at` | UNIQUE `(user_id, reason, related_id)` — mỗi mốc thưởng 1 lần; client không có policy ghi |
| `badges` | 0031 | `slug` UNIQUE, `name`, `description`, `icon`, `rule` | Seed 4 huy hiệu: Khởi đầu, Kiên trì 7 ngày, Hoàn thành khóa đầu tiên, Người chia sẻ |
| `user_badges` | 0031 | `user_id`, `badge_id`, `earned_at` | |
| `learning_streaks` | 0031 | `user_id`, `current_streak`, `longest_streak`, `last_active_date` | Tính từ ngày `completed_at` thật (ngày UTC) |

## 3. Hàm & trigger đáng chú ý (đọc từ migrations)

| Hàm | Vai trò |
|---|---|
| `handle_new_user()` | Tạo `profiles` khi đăng ký (trigger trên `auth.users`) |
| `current_role()` | Đọc `profiles.role` (cache) — **S-17: lệch QĐ `user_roles` là nguồn duy nhất**, chưa sửa |
| `submit_quiz_attempt(...)` | Chấm quiz ở server (SECURITY DEFINER), 1 nguồn sự thật |
| `verify_certificate(p_code)` | Tra cứu chứng chỉ công khai, chỉ trả 6 trường |
| `search_ai_knowledge(p_query, p_limit)` | Tìm kiếm AI Mentor (full-text config `simple` + khớp nguyên từ không dấu, không phải vector/pgvector) |
| `refresh_my_gamification()` | RPC tính lại streak + huy hiệu của chính mình (`auth.uid()`, không nhận `user_id` từ client) |
| `award_points_internal` / `award_badges_internal` / `refresh_streak_internal` | Cộng điểm/huy hiệu server-side (trigger) |
| `generate_certificate_code()` / `generate_order_reference()` | Sinh mã `VISFAR-CERT-YYYY-NNNNNN` / `DH-YYYY-NNNNNN` |
| `prevent_profiles_role_change()` / `prevent_profiles_disable_change()` | Trigger chặn tự đổi `role` / `is_disabled` (H1, S-01) |
| `sync_profiles_role()` / `sync_one_profile_role()` | Đồng bộ `profiles.role` từ `user_roles` |
| `sync_and_guard_lesson_progress()` | Guard tiến độ (0012) |
| `apply_coupon_use()` / `release_coupon_use()` | Tăng/giảm `used_count` coupon |

## 4. View đáng chú ý

| View | Vai trò |
|---|---|
| `lessons_public` | Metadata bài học công khai (không `content`/`video_url`/`file_url`) — đường đọc công khai duy nhất cho danh sách bài |
| `lessons_preview_video` (0028) | Chỉ `id` + `video_url` của bài `is_free_preview=true` thuộc khóa `published` |
| `question_options_public` | Lựa chọn quiz công khai, **không có cột `is_correct`** |
| `assessment_aggregates_11d` (0027) | Tổng hợp theo phương diện (avg/min/max/số lượt), không PII |

## 5. Storage buckets (đọc từ migrations 0007/0010/0015)

| Bucket | Quyền | Ghi chú |
|---|---|---|
| `avatars` (public) | Đọc công khai; ghi chỉ chủ sở hữu (`<uid>/avatar.<ext>`, ext whitelist jpg/jpeg/png/webp, ≤ 2 MB) | S-13: `contentType` lấy từ `file.type` client gửi |
| `submissions` (private) | Chỉ chủ bài nộp / instructor / admin qua API stream có kiểm tra quyền; không trả `storage_path` | Bài tập, tối đa 5 file × 10 MB |

**Chưa kiểm chứng trong đợt này:** danh sách bucket live (không có quyền Storage API trong đợt kiểm toán — xem PROJECT_AUDIT §8).

## 6. Seed dữ liệu

- 10 khóa học (0002), thứ tự hiển thị 01–10; trụ cột cập nhật ở 0024.
- Thư viện Master 119 mục (0025, staging; prod chạy dữ liệu mặc định trong code `apps/web/src/lib/master-library-data.ts`).
- 4 huy hiệu gamification (0031); 138 chunk AI Mentor (0029, seed từ Thư viện + khóa + triết lý).
- 7 key `system_settings` khởi tạo; 4 chính sách (`policies`).
- Blog 3 bài là dữ liệu tĩnh trong code, không phải seed DB.

## 7. RLS — tóm tắt (chi tiết: `docs/database/RLS_POLICIES.md`)

- Bật RLS trên mọi bảng; mặc định từ chối.
- Anon chỉ đọc nội dung công khai (`courses`/`posts`/`events`/`policies` published, `master_library_items` published, view `lessons_public`/`lessons_preview_video`/`question_options_public`).
- Học viên chỉ đọc/ghi dữ liệu của mình; `leads`/`orders`/`payments`/`enrollments`/`lesson_progress`/`quiz_attempts` không có policy INSERT/UPDATE cho client — ghi qua Worker/service-role.
- 2 lỗ còn mở: S-03 trên prod (chưa áp 0028), S-07 anon INSERT `event_registrations`.
- Chi tiết đầy đủ: `docs/database/RLS_POLICIES.md`, `docs/database/SECURITY_MODEL.md`, `docs/database/DATA_DICTIONARY.md`, `docs/database/DATABASE_ERD.md`.

## 8. Trạng thái áp migration (11/11/2026 — đối chiếu PROJECT_AUDIT + CHANGELOG)

| Nhóm | Migration | Prod | Staging |
|---|---|---|---|
| Nền + Task 03 | 0001–0024 | ✅ Đã áp (0022/0023/0024 HTTP 201, đã xác minh) | ✅ |
| Thư viện + đổi tên khóa 08 | 0025, 0026 | ❌ Chưa áp | ✅ HTTP 201 |
| 11D | 0027 | ❌ Chưa áp | ✅ HTTP 201 |
| Vá S-03 | 0028 | ❌ Chưa áp (chờ nghiệm thu) | ✅ HTTP 201 |
| AI Mentor | 0029 | ❌ Chưa áp | ✅ HTTP 201 |
| Cộng đồng | 0030 | ❌ Chưa áp | ✅ HTTP 201 |
| Gamification | 0031 | ❌ Chưa áp | ✅ HTTP 201 |

**Lưu ý vận hành:** staging đã áp nội dung 0030/0031 dưới số cũ 0029/0030 (đổi số sau khi áp); nếu chuyển sang `supabase db push`, cần `migration repair` đánh dấu version (theo `docs/supabase/MIGRATION_GUIDE.md` §5.5 — Management API không ghi `schema_migrations`). Quy trình áp: staging trước → kiểm chứng → backup prod → áp prod; không sửa migration cũ, sai thì thêm migration mới. Kiểm tra: `node scripts/check-migrations.mjs` (đếm động, 271/271 PASS).
