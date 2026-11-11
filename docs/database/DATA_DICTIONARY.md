# Từ điển dữ liệu — Nền tảng E-learning Visfar Academy

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt
**Phạm vi:** TASK 03 — từ điển dữ liệu cho 31 bảng. **Không triển khai database, không sửa code.** Đây là tài liệu đặc tả; mọi thay đổi schema thực tế đều làm bằng migration mới sau khi phê duyệt.
**Nguồn:**
- `workspace/visfar-academy-platform/docs/DECISIONS.md` (19 quyết định Task 01 + 16 quyết định Task 02, đã chốt 10/11/2026).
- Tài liệu kiến trúc tổng thể `Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` §3 (schema Module 1).
- `workspace/visfar-academy-platform/docs/architecture/ROLE_PERMISSION_MATRIX.md` (ma trận quyền RBAC, 4 vai trò, 40 hành động, kiểm tra 2 lớp RLS + Workers API).

**Quy ước chung (áp cho mọi bảng, theo §3.1 tài liệu kiến trúc):**
- Mọi bảng có `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()` (trừ các bảng append-only chỉ ghi — ghi rõ ở từng bảng).
- Không xóa cứng dữ liệu nghiệp vụ — dùng `deleted_at` (soft delete) hoặc cột trạng thái.
- Tiền lưu bằng `integer`, đơn vị VND, không dùng float cho tiền.
- Mọi khóa ngoại đều có `ON DELETE` rõ ràng.
- Bật RLS trên mọi bảng; mặc định từ chối khi không có policy cho phép.
- Ký hiệu quyền trong cột “Đọc / Ghi”: **K** = khách (chưa đăng nhập), **HV** = student (học viên), **GV** = instructor (giảng viên), **AD** = admin, **SR** = API service-role (Cloudflare Workers, đã xác minh JWT + role + nghiệp vụ). “Qua Workers” = client không có policy ghi trực tiếp; chỉ Workers dùng service-role mới ghi.
- Ký hiệu “MỚI” = cột/bảng chưa có trong schema Module 1 (§3 tài liệu kiến trúc). Không có ghi chú này = đã có trong Module 1 (có thể đổi tên cột hoặc thêm ràng buộc — ghi rõ nếu có).

**Lưu ý về số tài khoản ngân hàng và giá:** Tài liệu này **không ghi số tài khoản ngân hàng** (theo DECISIONS QĐ 15: tài khoản MB Bank, chủ tài khoản Công ty TNHH MTV Visfar Holdings — chỉ dùng từ ảnh chụp/QR do user cung cấp khi tạo khối thanh toán). Học phí các khóa “Tùy tâm” và giá gói membership **chưa có giá niêm yết** trong tài liệu nguồn — mọi ví dụ tiền trong file này đều là số 0 hoặc ghi rõ “ví dụ minh họa, không phải giá niêm yết”; không tự bịa giá dịch vụ.

---

## 0. Bảng tham chiếu (enum dùng chung)

### 0.1. 34 tỉnh/thành (whitelist ở API — sau sáp nhập 2025)

An Giang, Bắc Ninh, Cà Mau, Cao Bằng, Cần Thơ, Đà Nẵng, Đắk Lắk, Điện Biên, Đồng Nai, Đồng Tháp, Gia Lai, Hà Nội, Hà Tĩnh, Hải Phòng, Hưng Yên, Khánh Hòa, Lai Châu, Lào Cai, Lâm Đồng, Lạng Sơn, Nghệ An, Ninh Bình, Phú Thọ, Quảng Ngãi, Quảng Ninh, Quảng Trị, Sơn La, Tây Ninh, Thái Nguyên, Thanh Hóa, TP. Hồ Chí Minh, Tuyên Quang, Vĩnh Long, Huế. Dùng cho `profiles.province` và `leads.province`. Ví dụ trong file này: `Hà Nội`, `TP. Hồ Chí Minh`, `Đà Nẵng`.

### 0.2. Trụ cột khóa học (`courses.pillar`)

| Giá trị | Ý nghĩa | Ví dụ khóa |
|---|---|---|
| `tam-thuc` | Tâm thức | 01 Thấu Hiểu Nội Tâm, 02 Thấu Hiểu Tâm Thức |
| `tri-tue` | Trí tuệ | 03 Thấu Hiểu Trí Tuệ |
| `nhan-hieu` | Nhân hiệu | 08 Master Tâm thức & Nhân hiệu, 09 Coaching 90 ngày đồng hành |
| `cong-dong` | Cộng đồng | 10 Cộng đồng Visfar |

### 0.3. 10 khóa học seed (giữ nguyên thứ tự 01–10, theo §3 tài liệu kiến trúc)

| display_order | slug | title | pillar | Ghi chú |
|---|---|---|---|---|
| 1 | `thau-hieu-noi-tam` | Thấu Hiểu Nội Tâm | tam-thuc | |
| 2 | `thau-hieu-tam-thuc` | Thấu Hiểu Tâm Thức | tam-thuc | |
| 3 | `thau-hieu-tri-tue` | Thấu Hiểu Trí Tuệ | tri-tue | |
| 4 | `thau-hieu-suc-khoe` | Thấu Hiểu Sức Khỏe | tam-thuc | Nội dung tạm từ Lĩnh vực, chờ user gửi văn bản của mình |
| 5 | `thau-hieu-moi-quan-he` | Thấu Hiểu Mối Quan Hệ | tam-thuc | Nội dung tạm từ Lĩnh vực, chờ user gửi văn bản của mình |
| 6 | `thau-hieu-tai-chinh` | Thấu Hiểu Tài Chính | tam-thuc | Nội dung tạm từ Lĩnh vực, chờ user gửi văn bản của mình |
| 7 | `chuyen-gia-tu-van` | Chuyên gia tư vấn và huấn luyện tâm thức | tam-thuc | `is_featured = true`, full-width |
| 8 | `master-tam-thuc-nhan-hieu` | Master Tâm thức & Nhân hiệu | nhan-hieu | |
| 9 | `coaching-90-ngay` | Coaching 90 ngày đồng hành | nhan-hieu | |
| 10 | `cong-dong-visfar` | Cộng đồng Visfar | cong-dong | Khóa miễn phí (`price_vnd = 0`) |

### 0.4. Trạng thái dùng trong file này

| Enum | Giá trị |
|---|---|
| Vai trò (`role`) | `student`, `instructor`, `admin` (không có `superadmin` riêng giai đoạn đầu) |
| Lead (`leads.status`) | `new`, `contacted`, `enrolled`, `closed`, `spam` |
| Đơn hàng (`orders.status`) | `pending`, `paid`, `cancelled`, `refunded`, `expired` |
| Thanh toán (`payments.status`) | `pending`, `succeeded`, `failed`, `refunded` |
| Ghi danh (`enrollments.status`) | `active`, `completed`, `revoked` |
| Tiến độ (`lesson_progress.status`) | `not_started`, `in_progress`, `completed` |
| Khóa học (`courses.status`) | `draft`, `published`, `archived` |
| Phương thức thanh toán | `bank_transfer`, `sepay`, `stripe`, `cash`, `free` — thực tế chỉ dùng SePay (QĐ 15) và chuyển khoản thủ công; Stripe chưa dùng (QĐ Task 02 số 9) |

---

## 1. Làm rõ 4 điểm dễ nhầm (đọc trước khi dùng từ điển)

### 1.1. `answers` = đáp án HỌC VIÊN CHỌN — không phải đáp án đúng

- Bảng `answers` (§14) lưu **mỗi câu trả lời của học viên trong một lần làm quiz**: học viên đã chọn lựa chọn nào (`selected_option_ids`), hoặc đã viết gì (`answer_text` cho câu tự luận/ngắn).
- **Đáp án đúng không nằm ở `answers`.** Đáp án đúng nằm ở bảng `questions` (§12): `correct_option_ids` / `correct_answer`. Cột này **không bao giờ trả về cho client** — chỉ Workers service-role đọc để chấm điểm ở server; giảng viên xem đáp án đúng hay không còn chờ chốt (xem Quyết định D8, vì ma trận quyền cấm nhưng QĐ Task 02 số 6 lại cho phép).
- Cột `answers.is_correct` là **kết quả chấm do server ghi** (đúng/sai sau khi đối chiếu với `questions`), không phải dữ liệu học viên gửi lên và không phải đáp án đúng.
- Trùng lặp cần chốt: Module 1 đã có `quiz_attempts.answers` (jsonb) lưu toàn bộ đáp án đã chọn của một lần làm. Nếu giữ cả hai, `answers` (bảng) và `quiz_attempts.answers` (jsonb) có thể lệch nhau. Xem Quyết định D2.

### 1.2. `questions` vs `quiz_questions` cũ (Module 1)

| Module 1 (§3) | Task 03 (file này) | Thay đổi |
|---|---|---|
| `quiz_questions` (gắn trực tiếp vào `lesson_id`) | `questions` (gắn vào `quiz_id` → `quizzes` → `lessons`) | Thêm tầng trung gian `quizzes` (§11): 1 bài học loại quiz có đúng 1 quiz; 1 quiz có nhiều câu hỏi |
| `quiz_questions.question` | `questions.question_text` | Đổi tên cột cho rõ nghĩa |
| `quiz_options` (bảng riêng: `option_text`, `is_correct`) | `questions.options` (jsonb) + `questions.correct_option_ids` (jsonb) | **Gộp lựa chọn vào jsonb trong `questions`** — bảng `quiz_options` không còn trong danh sách 31 bảng. Đây là thay đổi thiết kế, không chỉ đổi tên (xem Quyết định D2) |
| Không có | `questions.question_type`, `points`, `explanation` | MỚI: hỗ trợ trắc nghiệm nhiều đáp án, đúng/sai, tự luận ngắn; điểm từng câu; giải thích hiện sau khi nộp |

### 1.3. `course_modules` vs `modules` cũ (Module 1)

- `course_modules` (§5) là **đổi tên** của bảng `modules` trong Module 1 (§3): cùng ý nghĩa (chương/module trong một khóa học), cùng khóa ngoại tới `courses`, cùng `display_order`.
- Thay đổi duy nhất ngoài tên: thêm cột `description` (MỚI) và khóa ngoại ở `lessons` đổi tên từ `module_id` thành `course_module_id`.
- Khi triển khai: dùng migration **đổi tên bảng** (`ALTER TABLE modules RENAME TO course_modules`), không tạo bảng mới rồi copy dữ liệu — tránh mất dữ liệu và tránh hai bảng cùng tồn tại. Mọi chỗ tham chiếu cũ (`lessons.module_id`, RLS policy, API) phải đổi theo cùng một migration.

### 1.4. `user_roles` vs cột `profiles.role` cũ — HAI CÁCH LƯU ROLE MÂU THUẪN NHAU

**Đây là mâu thuẫn nghiêm trọng nhất trong schema Task 03, phải chốt trước khi viết migration.**

- **Cách cũ (Module 1, §3):** `profiles.role` — một cột `text` trên mỗi hồ sơ, CHECK IN (`student`, `instructor`, `admin`), mặc định `'student'`. Mỗi người chỉ có **đúng 1 role**. Hàm RLS `public.current_role()` đọc role từ chính cột này (`SELECT role FROM profiles WHERE id = auth.uid()`); toàn bộ policy RLS và kiểm tra role ở Workers API đều dựa vào nó.
- **Cách mới (Task 03):** bảng `user_roles` (§2) — quan hệ nhiều–nhiều: một người có thể giữ **nhiều role cùng lúc** (ví dụ vừa là `instructor` của khóa 08, vừa là `student` của khóa 10), mỗi dòng có người cấp (`granted_by`), thời điểm cấp và thời điểm thu hồi (`revoked_at`).

**Hai cách mâu thuẫn nhau như thế nào (cụ thể):**

1. **Một nguồn sự thật bị tách làm hai.** Cùng một câu hỏi “người này có phải instructor không?” có thể nhận hai câu trả lời khác nhau: `profiles.role = 'student'` nhưng `user_roles` lại có dòng (`user_id`, `instructor`, `revoked_at IS NULL`). Không có cơ chế nào trong schema tự giữ hai nơi đồng bộ.
2. **Thu hồi role ở một nơi không có hiệu lực ở nơi kia.** Admin thu hồi instructor bằng cách set `user_roles.revoked_at`, nhưng `profiles.role` vẫn là `'instructor'` → RLS `current_role()` vẫn trả về instructor → người đó vẫn sửa được bài học, xem được tiến độ học viên. Ngược lại, admin sửa `profiles.role` về `'student'` nhưng dòng `user_roles` còn hiệu lực → Workers API (nếu đọc `user_roles`) vẫn coi là instructor.
3. **Kiểm tra quyền ở 2 lớp sẽ lệch nhau.** RLS (lớp 1) dùng `current_role()` đọc `profiles.role`; Workers API (lớp 2) nếu đọc `user_roles` sẽ ra kết quả khác. Ma trận quyền yêu cầu “chỉ kiểm tra ở 1 lớp là không đủ” — nhưng nếu 2 lớp đọc 2 nguồn khác nhau thì kiểm tra 2 lớp cũng không cứu được.
4. **Cấp role mới có thể “mất” role cũ.** Với `profiles.role`, cấp `instructor` cho một `admin` sẽ ghi đè thành `'instructor'` → mất quyền admin. Với `user_roles`, cấp thêm là cộng thêm, không mất. Hai hành vi này đối nghịch nhau; admin không thể đoán trước kết quả khi cấp role.
5. **Lịch sử cấp/thu hồi chỉ có ở một nơi.** `user_roles` ghi được ai cấp, khi nào, thu hồi khi nào (phục vụ `audit_logs`); `profiles.role` chỉ có giá trị hiện tại, không có lịch sử.

**Hướng chốt đề xuất (chờ phê duyệt — Quyết định D1):** lấy **`user_roles` làm nguồn sự thật duy nhất** (vì hỗ trợ nhiều role và có lịch sử cấp/thu hồi); `profiles.role` hoặc **bỏ hẳn**, hoặc giữ làm cột cache chỉ đọc (derived) đồng bộ bằng trigger/database function, **không bao giờ ghi trực tiếp từ API**. Hàm `current_role()` và mọi policy RLS phải được viết lại để đọc từ `user_roles` (role hiệu lực = dòng có `revoked_at IS NULL`). Cho tới khi D1 được chốt, **không viết migration nào chạm vào role**, và mọi tài liệu quyền phải ghi rõ đang dùng nguồn nào.

---

## 2. Từ điển theo bảng

### 2.1. `profiles` — Hồ sơ người dùng (1–1 với `auth.users`)

Đã có trong Module 1. Nguồn sự thật về danh tính học viên/giảng viên/admin.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | = `auth.users.id` | `a1b2c3d4-…` (uuid do Supabase Auth cấp) | FK → `auth.users(id)` ON DELETE CASCADE | Đọc: chính mình + AD; Ghi: SR (tạo qua trigger khi đăng ký) |
| `full_name` | text | Họ và tên | `Nguyễn Văn A` | NOT NULL | Đọc: chính mình + AD (+ GV chỉ họ tên học viên khóa phụ trách); Ghi: chính mình + AD |
| `phone` | text | SĐT 10 số, bắt đầu bằng 0; lưu dạng text để giữ số 0 đầu | `0901234567` | CHECK `^0\d{9}$` | Đọc: chính mình + AD; Ghi: chính mình + AD. **GV không được đọc SĐT** (ma trận quyền §2.3 hành động 22) — chờ chốt lại theo QĐ Task 02 số 6, xem D8 |
| `email` | text | Email đăng nhập, đồng bộ từ auth | `nguyenvana@example.com` | NOT NULL, UNIQUE | Đọc: chính mình + AD; Ghi: SR (đồng bộ từ auth). **GV không được đọc email** — xem D8 |
| `province` | text | Tỉnh/thành cư trú | `Hà Nội` | NULL; whitelist 34 tỉnh/thành ở API (§0.1) | Đọc: chính mình + AD; Ghi: chính mình + AD |
| `role` | text | Vai trò chính (cách lưu cũ) | `student` | NOT NULL DEFAULT `'student'`, CHECK IN (`student`, `instructor`, `admin`) | Đọc: chính mình + AD; Ghi: chỉ AD. **⚠️ Mâu thuẫn với bảng `user_roles` (§2.2) — xem §1.4 và Quyết định D1. Không ghi cột này cho tới khi D1 chốt** |
| `avatar_url` | text | Ảnh đại diện (Supabase Storage) | `https://…/avatars/a1b2c3d4.jpg` | NULL | Đọc: chính mình + AD (+ công khai nếu hiển thị trên trang chia sẻ — chờ chốt); Ghi: chính mình |
| `is_active` | boolean | Tài khoản còn hoạt động không; admin **vô hiệu hóa thay vì xóa** | `true` | NOT NULL DEFAULT `true`. **MỚI** (Module 1 chưa có; cần cho hành động 40 ma trận quyền “vô hiệu hóa tài khoản thay vì xóa”) | Đọc: chính mình + AD; Ghi: chỉ AD |
| `created_at`, `updated_at` | timestamptz | Thời điểm tạo / cập nhật hồ sơ | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: chính mình + AD; Ghi: hệ thống |

### 2.2. `user_roles` — Vai trò được cấp cho người dùng (quan hệ nhiều–nhiều) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Cho phép một người giữ nhiều role cùng lúc và lưu lịch sử cấp/thu hồi.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD + SR; Ghi: SR |
| `user_id` | uuid | Người được cấp role | uuid của học viên Lê Hoàng Nam | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: AD + SR; Ghi: SR (chỉ AD qua API) |
| `role` | text | Vai trò được cấp | `instructor` | NOT NULL, CHECK IN (`student`, `instructor`, `admin`) | Đọc: AD + SR; Ghi: SR (chỉ AD qua API) |
| `granted_by` | uuid | Admin đã cấp role | uuid của admin Lê Đăng Quyết | NULL, FK → `profiles(id)` ON DELETE SET NULL | Đọc: AD; Ghi: SR |
| `granted_at` | timestamptz | Thời điểm cấp | `2026-11-10 20:00:00+07` | NOT NULL DEFAULT now() | Đọc: AD; Ghi: hệ thống |
| `revoked_at` | timestamptz | Thời điểm thu hồi; NULL = role còn hiệu lực | `NULL` (còn hiệu lực) | NULL | Đọc: AD; Ghi: SR (chỉ AD qua API) |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`user_id`, `role`) với điều kiện `revoked_at IS NULL` (partial unique index) — một người không thể có 2 dòng `instructor` cùng hiệu lực. Mọi lần cấp/thu hồi phải ghi `audit_logs` (§2.30). **Mâu thuẫn với `profiles.role` — xem §1.4, Quyết định D1.**

### 2.3. `courses` — Khóa học (10 khóa hiện tại + khóa mới)

Đã có trong Module 1. Thứ tự hiển thị 01–10 giữ nguyên (§0.3).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: công khai nếu `published`; Ghi: AD |
| `slug` | text | Đường dẫn thân thiện, dùng trong URL `/chuong-trinh/[slug]` | `thau-hieu-noi-tam` | NOT NULL, UNIQUE | Đọc: công khai nếu `published`; Ghi: AD |
| `display_order` | integer | Thứ tự hiển thị 01–10, giữ nguyên thứ tự hiện tại | `1` (khóa 01 Thấu Hiểu Nội Tâm) | NOT NULL | Đọc: công khai; Ghi: AD |
| `title` | text | Tên khóa học | `Thấu Hiểu Nội Tâm` | NOT NULL | Đọc: công khai; Ghi: AD |
| `subtitle` | text | Dòng phụ dưới tên khóa | `Hiểu mình để làm chủ nội tâm` (ví dụ minh họa) | NULL | Đọc: công khai; Ghi: AD |
| `description` | text | Mô tả ngắn | `Khóa học giúp học viên thấu hiểu nội tâm…` (ví dụ minh họa) | NULL | Đọc: công khai; Ghi: AD |
| `details` | jsonb | Nội dung chính + Kết quả hướng đến (cấu trúc) | `{"noi_dung": […], "ket_qua": […]}` | NULL | Đọc: công khai; Ghi: AD |
| `pillar` | text | Trụ cột để lọc | `tam-thuc` | CHECK IN (`tam-thuc`, `tri-tue`, `nhan-hieu`, `cong-dong`) | Đọc: công khai; Ghi: AD |
| `category_id` | uuid | Danh mục thuộc về (nếu dùng `categories`) | uuid của danh mục “Tâm thức” | NULL, FK → `categories(id)` ON DELETE SET NULL. **MỚI** | Đọc: công khai; Ghi: AD. **⚠️ Chồng chéo với `pillar`: `pillar` là enum cố định 4 giá trị, `category_id` là FK tới bảng danh mục — cần chốt dùng một trong hai làm tiêu chí lọc chính (Quyết định D7)** |
| `poster_url` | text | Ảnh poster (Storage/R2), không base64 | `https://…/posters/thau-hieu-noi-tam.jpg` | NULL | Đọc: công khai; Ghi: AD |
| `price_vnd` | integer | Học phí (VND); 0 = miễn phí / Tùy tâm | `0` (khóa 10 Cộng đồng Visfar; các khóa Tùy tâm) | NOT NULL DEFAULT 0, CHECK ≥ 0 | Đọc: công khai; Ghi: AD. **GV không được sửa giá** (ma trận quyền hành động 29–30) |
| `is_featured` | boolean | Khóa nổi bật, hiển thị full-width | `true` (khóa 07 Chuyên gia tư vấn và huấn luyện tâm thức) | DEFAULT `false` | Đọc: công khai; Ghi: AD |
| `status` | text | Trạng thái xuất bản | `published` | NOT NULL DEFAULT `'published'`, CHECK IN (`draft`, `published`, `archived`) | Đọc: công khai nếu `published` (bản `draft`/`archived` chỉ AD + GV phụ trách đọc); Ghi: AD |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

### 2.4. `categories` — Danh mục (khóa học / nội dung) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1 (Module 1 chỉ có enum `pillar` trên `courses`).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: công khai; Ghi: AD |
| `slug` | text | Đường dẫn thân thiện | `tam-thuc` | NOT NULL, UNIQUE | Đọc: công khai; Ghi: AD |
| `name` | text | Tên danh mục | `Tâm thức` | NOT NULL | Đọc: công khai; Ghi: AD |
| `type` | text | Loại danh mục | `course` | NOT NULL, CHECK IN (`course`, `post`, `event`) | Đọc: công khai; Ghi: AD |
| `description` | text | Mô tả danh mục | `Các khóa học về tâm thức…` (ví dụ minh họa) | NULL | Đọc: công khai; Ghi: AD |
| `parent_id` | uuid | Danh mục cha (cho danh mục lồng nhau) | `NULL` (danh mục gốc) | NULL, FK → `categories(id)` ON DELETE SET NULL | Đọc: công khai; Ghi: AD |
| `display_order` | integer | Thứ tự hiển thị | `1` | NOT NULL DEFAULT 0 | Đọc: công khai; Ghi: AD |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ghi chú: nếu chỉ dùng 4 trụ cột cố định thì bảng này là thừa so với `courses.pillar` — xem Quyết định D7.

### 2.5. `course_modules` — Chương / module trong khóa học — **MỚI (đổi tên từ `modules`)**

Đổi tên từ bảng `modules` của Module 1 — xem §1.3.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: công khai nếu khóa `published` (bài không xem thử chỉ khi đã ghi danh — kiểm tra ở API); Ghi: AD / GV (khóa phụ trách) |
| `course_id` | uuid | Khóa học chứa module | uuid của khóa 01 Thấu Hiểu Nội Tâm | NOT NULL, FK → `courses(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `title` | text | Tên module | `Module 1: Nhận diện nội tâm` (ví dụ minh họa) | NOT NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `description` | text | Mô tả module | `…` | NULL. **MỚI** | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `display_order` | integer | Thứ tự module trong khóa | `1` | NOT NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

### 2.6. `lessons` — Bài học

Đã có trong Module 1. Khóa ngoại đổi tên theo §1.3 (`module_id` → `course_module_id`).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: xem thử công khai; bài thường chỉ HV đã ghi danh + GV phụ trách + AD; Ghi: AD / GV (khóa phụ trách) |
| `course_module_id` | uuid | Module chứa bài học (đổi tên từ `module_id` của Module 1) | uuid của module khóa 01 | NOT NULL, FK → `course_modules(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `slug` | text | Đường dẫn bài học | `bai-1-nhan-dien-noi-tam` (ví dụ minh họa) | NOT NULL, UNIQUE theo module — **QĐ 17: `lessons.slug` UNIQUE theo module, không theo khóa** | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `title` | text | Tên bài học | `Bài 1: Nhận diện nội tâm` (ví dụ minh họa) | NOT NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `type` | text | Loại bài học | `video` | NOT NULL, CHECK IN (`video`, `text`, `quiz`, `file`) | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `content` | text | Nội dung text / ghi chú bài học | `…` | NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `video_url` | text | Link YouTube unlisted (giai đoạn 0 đồng) | `https://www.youtube.com/watch?v=…` (link unlisted thật do user cung cấp) | NULL; chỉ có khi `type = 'video'` | Đọc: chỉ HV đã ghi danh (không trả cho khách); Ghi: AD / GV (khóa phụ trách) |
| `video_duration_sec` | integer | Thời lượng video (giây) | `900` (= 15 phút) | NULL, CHECK ≥ 0 | Đọc: HV đã ghi danh; Ghi: AD / GV (khóa phụ trách) |
| `file_url` | text | Tài liệu đính kèm (Storage/R2) | `https://…/files/tai-lieu-bai-1.pdf` | NULL. **⚠️ Chồng chéo với bảng `lesson_resources` (§2.7) — xem Quyết định D5** | Đọc: HV đã ghi danh, qua signed URL hết hạn sau 1 giờ; Ghi: AD / GV (khóa phụ trách) |
| `display_order` | integer | Thứ tự bài trong module | `1` | NOT NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `is_free_preview` | boolean | Bài xem thử không cần mua | `true` (bài mở đầu khóa 01) | DEFAULT `false` | Đọc: công khai; Ghi: AD / GV (khóa phụ trách) |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ngưỡng hoàn thành bài (QĐ 17): 90% (video) / bấm “Đã hoàn thành” (bài text), tính theo module.

### 2.7. `lesson_resources` — Tài liệu đính kèm của bài học — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1 (Module 1 chỉ có một `lessons.file_url` duy nhất cho mỗi bài).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: HV đã ghi danh + GV phụ trách + AD; Ghi: AD / GV (khóa phụ trách) |
| `lesson_id` | uuid | Bài học chứa tài liệu | uuid của bài học khóa 01 | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `title` | text | Tên tài liệu | `Slide bài 1 (PDF)` (ví dụ minh họa) | NOT NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `resource_type` | text | Loại tài liệu | `pdf` | NOT NULL, CHECK IN (`pdf`, `slide`, `file`, `link`, `image`) | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `file_url` | text | Đường dẫn file (Storage/R2) hoặc link ngoài | `https://…/files/slide-bai-1.pdf` | NOT NULL | Đọc: HV đã ghi danh qua signed URL hết hạn sau 1 giờ; Ghi: AD / GV (khóa phụ trách) |
| `display_order` | integer | Thứ tự hiển thị trong bài | `1` | NOT NULL DEFAULT 0 | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `is_downloadable` | boolean | Học viên có được tải về không | `true` | NOT NULL DEFAULT `true` | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ghi chú: bảng này cho phép một bài có nhiều tài liệu (slide + PDF + link tham khảo). Nếu giữ lại `lessons.file_url`, một bài sẽ có tài liệu ở hai nơi — xem Quyết định D5.

### 2.8. `enrollments` — Ghi danh (học viên ↔ khóa học)

Đã có trong Module 1.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD (+ GV: học viên khóa phụ trách); Ghi: SR (qua Workers) |
| `user_id` | uuid | Học viên | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `course_id` | uuid | Khóa học đã ghi danh | uuid của khóa 01 Thấu Hiểu Nội Tâm | NOT NULL, FK → `courses(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `order_id` | uuid | Đơn hàng đã tạo enrollment này | uuid của đơn `DH-2026-000123` | NULL, FK → `orders(id)` ON DELETE SET NULL. NULL nếu miễn phí / tặng | Đọc: chính mình + AD; Ghi: SR |
| `membership_id` | uuid | Membership đã tạo enrollment này (ghi danh theo gói) | uuid của membership Cộng đồng Visfar | NULL, FK → `memberships(id)` ON DELETE SET NULL. **MỚI** | Đọc: chính mình + AD; Ghi: SR |
| `status` | text | Trạng thái ghi danh | `active` | NOT NULL DEFAULT `'active'`, CHECK IN (`active`, `completed`, `revoked`) | Đọc: chính mình + AD (+ GV khóa phụ trách); Ghi: AD (đổi status) / SR |
| `enrolled_at` | timestamptz | Thời điểm ghi danh | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: chính mình + AD; Ghi: hệ thống |
| `completed_at` | timestamptz | Thời điểm hoàn thành 100% bài học | `NULL` (chưa hoàn thành) | NULL | Đọc: chính mình + AD; Ghi: SR |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`user_id`, `course_id`) — 1 học viên chỉ ghi danh 1 lần / 1 khóa. Admin tặng khóa (không qua đơn đã trả) được phép nhưng **phải ghi `audit_logs`** (QĐ Task 02 số 7).

### 2.9. `lesson_progress` — Tiến độ từng bài học (ảnh chụp trạng thái hiện tại)

Đã có trong Module 1. Đây là **trạng thái hiện tại** của một học viên tại một bài học — khác với `learning_events` (§2.10) là nhật ký từng sự kiện đã xảy ra.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD (+ GV: học viên khóa phụ trách, cần policy bổ sung theo `course_instructors`); Ghi: SR (qua Workers) |
| `user_id` | uuid | Học viên | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `lesson_id` | uuid | Bài học | uuid của bài học khóa 01 | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `status` | text | Trạng thái bài học | `in_progress` | NOT NULL DEFAULT `'in_progress'`, CHECK IN (`not_started`, `in_progress`, `completed`) | Đọc: như trên; Ghi: SR |
| `progress_percent` | integer | % xem video / đọc bài (client báo, server kiểm tra ngưỡng) | `90` (đạt ngưỡng hoàn thành video theo QĐ 17) | CHECK 0–100 | Đọc: như trên; Ghi: SR (qua Workers, kiểm tra enrollment + ngưỡng hợp lý — chống ghi tiến độ giả) |
| `last_position_sec` | integer | Vị trí xem dở (giây) — để “tiếp tục học” | `540` (= phút 09:00 của video 15 phút) | NULL, CHECK ≥ 0 | Đọc: chính mình; Ghi: SR |
| `completed_at` | timestamptz | Thời điểm hoàn thành bài | `NULL` (chưa hoàn thành) | NULL | Đọc: như trên; Ghi: SR |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`user_id`, `lesson_id`). Không DELETE — tiến độ là lịch sử học tập.

### 2.10. `learning_events` — Nhật ký sự kiện học tập (event log) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Ghi lại **từng sự kiện** trong quá trình học (bắt đầu xem, tạm dừng, tua, xem hết, tải tài liệu…) để phân tích hành vi và đối soát tiến độ.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD (+ GV: học viên khóa phụ trách); Ghi: SR (qua Workers) |
| `user_id` | uuid | Học viên thực hiện sự kiện | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `lesson_id` | uuid | Bài học xảy ra sự kiện | uuid của bài học khóa 01 | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `event_type` | text | Loại sự kiện | `video_ended` | NOT NULL, CHECK IN (`started`, `video_played`, `video_paused`, `video_seeked`, `video_ended`, `file_downloaded`, `lesson_completed`, `quiz_started`, `quiz_submitted`) | Đọc: như trên; Ghi: SR |
| `position_sec` | integer | Vị trí video tại thời điểm sự kiện (giây) | `900` (xem hết video 15 phút) | NULL, CHECK ≥ 0 | Đọc: như trên; Ghi: SR |
| `metadata` | jsonb | Dữ liệu kèm theo sự kiện | `{"from_sec": 540, "to_sec": 600}` (sự kiện tua video) | NULL | Đọc: như trên; Ghi: SR |
| `created_at` | timestamptz | Thời điểm sự kiện | `2026-11-10 20:05:00+07` | DEFAULT now(). **Bảng append-only: không có `updated_at`, không UPDATE/DELETE** | Đọc: AD; Ghi: hệ thống |

Phân biệt với `lesson_progress` (§2.9): `learning_events` là **dòng sự kiện thô** (nhiều dòng / 1 bài / 1 học viên), `lesson_progress` là **ảnh chụp trạng thái hiện tại** (1 dòng / 1 bài / 1 học viên, UNIQUE). `lesson_progress` được tổng hợp từ `learning_events` + xác nhận của server; không dùng `learning_events` làm nguồn duy nhất để tính % hoàn thành.

### 2.11. `quizzes` — Bài kiểm tra (quiz) gắn với bài học — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1 (Module 1 không có bảng quiz riêng — quiz chỉ là `lessons.type = 'quiz'` và câu hỏi gắn trực tiếp vào `lesson_id`).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: HV đã ghi danh + GV phụ trách + AD; Ghi: AD / GV (khóa phụ trách) |
| `lesson_id` | uuid | Bài học loại quiz chứa quiz này | uuid của bài quiz trong khóa 02 Thấu Hiểu Tâm Thức | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `title` | text | Tên bài kiểm tra | `Kiểm tra Module 1` (ví dụ minh họa) | NOT NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `description` | text | Mô tả / hướng dẫn làm bài | `Trả lời 5 câu hỏi trong 10 phút…` (ví dụ minh họa) | NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `pass_score_percent` | integer | % điểm tối thiểu để đạt | `80` | NOT NULL DEFAULT 0, CHECK 0–100 | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `time_limit_sec` | integer | Giới hạn thời gian làm bài (giây); NULL = không giới hạn | `600` (= 10 phút) | NULL, CHECK > 0 | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `max_attempts` | integer | Số lần làm tối đa; NULL = không giới hạn | `3` | NULL, CHECK > 0 | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `shuffle_questions` | boolean | Có xáo trộn thứ tự câu hỏi không | `true` | NOT NULL DEFAULT `false` | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `show_correct_after_submit` | boolean | Có hiện đáp án đúng sau khi nộp không | `true` | NOT NULL DEFAULT `true` | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `status` | text | Trạng thái xuất bản | `published` | NOT NULL DEFAULT `'draft'`, CHECK IN (`draft`, `published`, `archived`) | Đọc: như trên; Ghi: AD |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`lesson_id`) — 1 bài học loại quiz có đúng 1 quiz.

### 2.12. `questions` — Câu hỏi trong quiz — **MỚI (thay `quiz_questions` + `quiz_options`)**

Bảng mới trong Task 03, thay thế hai bảng Module 1 là `quiz_questions` và `quiz_options` — xem §1.2. **Đáp án đúng lưu tại đây và không bao giờ trả về cho client.**

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: HV đã ghi danh (chỉ cột không nhạy cảm, qua API — không bao giờ kèm đáp án đúng); Ghi: AD / GV (khóa phụ trách) |
| `quiz_id` | uuid | Quiz chứa câu hỏi (thay cho `quiz_questions.lesson_id` của Module 1) | uuid của quiz khóa 02 | NOT NULL, FK → `quizzes(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `question_text` | text | Nội dung câu hỏi (đổi tên từ `quiz_questions.question`) | `Theo triết lý Giáo dục Tận Gốc, yếu tố nào là gốc của hiện thực?` (ví dụ minh họa) | NOT NULL | Đọc: HV đã ghi danh; Ghi: AD / GV (khóa phụ trách) |
| `question_type` | text | Loại câu hỏi | `single_choice` | NOT NULL, CHECK IN (`single_choice`, `multiple_choice`, `true_false`, `short_answer`) | Đọc: HV đã ghi danh; Ghi: AD / GV (khóa phụ trách) |
| `options` | jsonb | Danh sách lựa chọn (thay bảng `quiz_options` của Module 1) | `[{"id": "a", "text": "Thông tin"}, {"id": "b", "text": "Năng lượng"}, {"id": "c", "text": "Vật chất"}]` | NULL (NULL khi `short_answer`); **không chứa cờ đúng/sai trong từng lựa chọn — đáp án đúng nằm ở `correct_option_ids`** | Đọc: HV đã ghi danh (qua API, không kèm đáp án đúng); Ghi: AD / GV (khóa phụ trách) |
| `correct_option_ids` | jsonb | **ĐÁP ÁN ĐÚNG** — id các lựa chọn đúng | `["a"]` | NULL. **Cột nhạy cảm: chỉ SR đọc để chấm điểm; không bao giờ trả về client; không SELECT trực tiếp từ frontend** | Đọc: chỉ SR (+ GV phụ trách — chờ chốt, xem D8); Ghi: AD / GV (khóa phụ trách) |
| `correct_answer` | text | Đáp án đúng dạng text (dùng khi `short_answer`) | `Thông tin – Năng lượng – Vật chất` (ví dụ minh họa) | NULL. **Cột nhạy cảm như `correct_option_ids`** | Đọc: chỉ SR (+ GV — chờ chốt D8); Ghi: AD / GV (khóa phụ trách) |
| `explanation` | text | Giải thích đáp án, hiện sau khi nộp | `…` | NULL | Đọc: HV đã nộp bài; Ghi: AD / GV (khóa phụ trách) |
| `points` | integer | Điểm của câu hỏi | `2` | NOT NULL DEFAULT 1, CHECK ≥ 0 | Đọc: HV đã ghi danh; Ghi: AD / GV (khóa phụ trách) |
| `display_order` | integer | Thứ tự câu hỏi trong quiz | `1` | NOT NULL | Đọc: HV đã ghi danh; Ghi: AD / GV (khóa phụ trách) |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

### 2.13. `quiz_attempts` — Bài làm quiz (một lần nộp bài)

Đã có trong Module 1, thay đổi: thêm `quiz_id`, `score_percent`, `passed`, `started_at`, `time_spent_sec`; cột `answers` (jsonb) giữ lại tạm thời — xem ghi chú trùng lặp dưới bảng.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD (+ GV: học viên khóa phụ trách); Ghi: SR (qua Workers) |
| `user_id` | uuid | Học viên làm bài | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `quiz_id` | uuid | Quiz đã làm | uuid của quiz khóa 02 | NOT NULL, FK → `quizzes(id)` ON DELETE CASCADE. **MỚI** (Module 1 gắn trực tiếp `lesson_id`) | Đọc: như trên; Ghi: SR |
| `lesson_id` | uuid | Bài học chứa quiz (giữ để tương thích Module 1) | uuid của bài quiz khóa 02 | NOT NULL, FK → `lessons(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `score` | integer | Số điểm đạt được (tổng `points` các câu đúng) | `8` | NOT NULL, CHECK ≥ 0 | Đọc: như trên; Ghi: SR (chấm ở server — không tin điểm do client gửi) |
| `total` | integer | Tổng điểm tối đa của quiz | `10` | NOT NULL, CHECK > 0 | Đọc: như trên; Ghi: SR |
| `score_percent` | integer | % điểm đạt được | `80` | NOT NULL DEFAULT 0, CHECK 0–100. **MỚI** | Đọc: như trên; Ghi: SR |
| `passed` | boolean | Có đạt ngưỡng `quizzes.pass_score_percent` không | `true` (80% ≥ ngưỡng 80%) | NOT NULL DEFAULT `false`. **MỚI** | Đọc: như trên; Ghi: SR |
| `answers` | jsonb | Toàn bộ đáp án đã chọn (định dạng Module 1) | `{"<question_id>": ["a"]}` | NOT NULL. **⚠️ TRÙNG LẶP với bảng `answers` (§2.14): cùng một dữ liệu ở hai nơi — xem Quyết định D2. Cho tới khi D2 chốt, giữ cột này làm ảnh chụp (snapshot) và coi bảng `answers` là nguồn chi tiết** | Đọc: chính mình + AD (+ GV khóa phụ trách); Ghi: SR |
| `started_at` | timestamptz | Thời điểm bắt đầu làm bài | `2026-11-10 20:00:00+07` | NULL DEFAULT now(). **MỚI** | Đọc: như trên; Ghi: SR |
| `submitted_at` | timestamptz | Thời điểm nộp bài | `2026-11-10 20:08:00+07` | DEFAULT now() | Đọc: như trên; Ghi: SR |
| `time_spent_sec` | integer | Thời gian làm bài (giây) | `480` | NULL, CHECK ≥ 0. **MỚI** | Đọc: như trên; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:08:00+07` | DEFAULT now(). **Bảng chỉ ghi một lần khi nộp: không `updated_at`, không UPDATE/DELETE** | Đọc: AD; Ghi: hệ thống |

### 2.14. `answers` — Đáp án HỌC VIÊN CHỌN trong từng câu hỏi của một lần làm quiz — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1 (Module 1 chỉ có `quiz_attempts.answers` jsonb). **Đọc kỹ §1.1 trước khi dùng bảng này.**

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD (+ GV: học viên khóa phụ trách); Ghi: SR |
| `attempt_id` | uuid | Lần làm quiz chứa đáp án này | uuid của `quiz_attempts` | NOT NULL, FK → `quiz_attempts(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `question_id` | uuid | Câu hỏi được trả lời | uuid của câu hỏi trong quiz khóa 02 | NOT NULL, FK → `questions(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `selected_option_ids` | jsonb | **Lựa chọn mà học viên đã chọn** (không phải đáp án đúng) | `["b"]` (học viên chọn “Năng lượng”, trong khi đáp án đúng là `["a"]`) | NULL (NULL khi câu tự luận — dùng `answer_text`) | Đọc: chính mình + AD (+ GV khóa phụ trách); Ghi: SR (chỉ ghi đáp án học viên gửi lên) |
| `answer_text` | text | Câu trả lời dạng text (câu tự luận / ngắn) | `Theo tôi, gốc của hiện thực là…` (ví dụ minh họa) | NULL | Đọc: chính mình + AD (+ GV khóa phụ trách, để chấm tay); Ghi: SR |
| `is_correct` | boolean | Kết quả chấm của server cho câu này (đúng/sai) | `false` (học viên chọn “b”, đáp án đúng là “a”) | NULL (NULL khi câu tự luận chưa chấm tay); **do server ghi sau khi đối chiếu với `questions.correct_option_ids` — không phải dữ liệu client gửi** | Đọc: chính mình + AD (+ GV khóa phụ trách); Ghi: SR / GV (chấm tay câu tự luận) |
| `points_earned` | integer | Điểm đạt được ở câu này | `0` | NOT NULL DEFAULT 0, CHECK ≥ 0 | Đọc: như trên; Ghi: SR |
| `answered_at` | timestamptz | Thời điểm trả lời câu này | `2026-11-10 20:03:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |
| `created_at` | timestamptz | | `2026-11-10 20:03:00+07` | DEFAULT now(). **Không `updated_at`, không UPDATE/DELETE (trừ chấm tay câu tự luận — ghi `is_correct`/`points_earned` qua API chấm)** | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`attempt_id`, `question_id`) — mỗi câu hỏi chỉ có 1 đáp án / 1 lần làm.

### 2.15. `assignments` — Bài tập (gồm bài tập tự luận, chấm tay) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Bổ sung theo QĐ Task 02 số 5 (có hỗ trợ bài tập tự luận + chấm tay).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: HV đã ghi danh + GV phụ trách + AD; Ghi: AD / GV (khóa phụ trách) |
| `lesson_id` | uuid | Bài học giao bài tập | uuid của bài học khóa 08 Master Tâm thức & Nhân hiệu | NULL, FK → `lessons(id)` ON DELETE CASCADE (NULL nếu bài tập gắn trực tiếp vào khóa — dùng `course_id`) | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `course_id` | uuid | Khóa học giao bài tập | uuid của khóa 08 | NULL, FK → `courses(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `title` | text | Tên bài tập | `Bài tập tự luận: Viết về hành trình thấu hiểu nội tâm` (ví dụ minh họa) | NOT NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `description` | text | Mô tả bài tập | `…` | NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `instructions` | text | Hướng dẫn làm bài | `Viết 500–1000 từ…` (ví dụ minh họa) | NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `due_at` | timestamptz | Hạn nộp; NULL = không hạn | `NULL` | NULL | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `max_score` | integer | Điểm tối đa | `10` | NOT NULL DEFAULT 10, CHECK > 0 | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `allow_file_upload` | boolean | Có cho nộp file đính kèm không | `true` | NOT NULL DEFAULT `true` | Đọc: như trên; Ghi: AD / GV (khóa phụ trách) |
| `status` | text | Trạng thái xuất bản | `published` | NOT NULL DEFAULT `'draft'`, CHECK IN (`draft`, `published`, `archived`) | Đọc: như trên; Ghi: AD |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: `lesson_id` và `course_id` không được cùng NULL (bài tập phải gắn vào ít nhất một bài học hoặc một khóa).

### 2.16. `submissions` — Bài nộp của học viên cho một bài tập — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD + GV (khóa phụ trách, để chấm); Ghi: SR |
| `assignment_id` | uuid | Bài tập được nộp | uuid của bài tập khóa 08 | NOT NULL, FK → `assignments(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `user_id` | uuid | Học viên nộp bài | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `content_text` | text | Nội dung bài làm dạng text | `…` (bài tự luận của học viên) | NULL | Đọc: chính mình + AD + GV (khóa phụ trách); Ghi: chính mình (qua Workers) |
| `file_url` | text | File bài làm đính kèm (Storage, private) | `https://…/submissions/bai-lam.pdf` | NULL | Đọc: chính mình + AD + GV (khóa phụ trách, qua signed URL); Ghi: chính mình (qua Workers) |
| `status` | text | Trạng thái bài nộp | `submitted` | NOT NULL DEFAULT `'draft'`, CHECK IN (`draft`, `submitted`, `under_review`, `graded`, `returned`) | Đọc: như trên; Ghi: SR / GV (đổi sang `under_review`/`graded`/`returned` khi chấm) |
| `submitted_at` | timestamptz | Thời điểm nộp | `2026-11-10 20:00:00+07` | NULL (NULL khi còn `draft`) | Đọc: như trên; Ghi: SR |
| `graded_at` | timestamptz | Thời điểm chấm xong | `NULL` (chưa chấm) | NULL | Đọc: như trên; Ghi: SR |
| `score` | integer | Điểm bài nộp (do GV chấm, tổng hợp từ `submission_reviews`) | `8` | NULL, CHECK 0–`assignments.max_score` | Đọc: chính mình + AD + GV (khóa phụ trách); Ghi: SR / GV (qua API chấm) |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`assignment_id`, `user_id`) — mỗi học viên 1 bài nộp / 1 bài tập, trừ khi cho nộp lại (xem Quyết định D3 trong §4 — nếu cho nộp lại thì bỏ UNIQUE này và dùng `status` + `submitted_at` để lấy bản mới nhất).

### 2.17. `submission_reviews` — Nhận xét / chấm bài nộp (chấm tay) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Lưu từng lần chấm/nhận xét của giảng viên (hoặc admin) cho một bài nộp.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: học viên nộp bài + AD + GV chấm; Ghi: SR |
| `submission_id` | uuid | Bài nộp được chấm | uuid của bài nộp khóa 08 | NOT NULL, FK → `submissions(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `reviewer_id` | uuid | Người chấm (GV phụ trách hoặc AD) | uuid của giảng viên | NOT NULL, FK → `profiles(id)` ON DELETE SET NULL | Đọc: như trên; Ghi: SR |
| `score` | integer | Điểm lần chấm này | `8` | NULL, CHECK ≥ 0 | Đọc: học viên nộp bài + AD + GV; Ghi: GV (qua API chấm) |
| `feedback` | text | Nhận xét của người chấm | `Bài viết rõ ràng, cần làm rõ thêm phần…` (ví dụ minh họa) | NULL | Đọc: học viên nộp bài + AD + GV; Ghi: GV (qua API chấm) |
| `reviewed_at` | timestamptz | Thời điểm chấm | `2026-11-11 09:00:00+07` | NOT NULL DEFAULT now() | Đọc: như trên; Ghi: hệ thống |
| `created_at` | timestamptz | | `2026-11-11 09:00:00+07` | DEFAULT now(). **Không `updated_at`: mỗi lần chấm lại là một dòng mới (lưu lịch sử chấm)** | Đọc: AD; Ghi: hệ thống |

Ghi chú: điểm cuối cùng của bài nộp (`submissions.score`) lấy từ lần chấm mới nhất; các lần chấm cũ giữ lại làm lịch sử. Nếu chỉ cho chấm 1 lần duy nhất thì thêm UNIQUE (`submission_id`) — xem Quyết định D3 trong §4.

### 2.18. `orders` — Đơn hàng

Đã có trong Module 1, thay đổi: thêm `membership_plan_id`, `discount_vnd`, `coupon_id`, `paid_at`; cột `course_id` giữ lại nhưng chồng chéo với `order_items` (§2.19) — xem ghi chú dưới bảng.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD; Ghi: SR (qua Workers) |
| `user_id` | uuid | Người đặt hàng | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: chính mình + AD; Ghi: SR |
| `course_id` | uuid | Khóa học trong đơn (Module 1: đơn chỉ có 1 khóa) | uuid của khóa 08 Master Tâm thức & Nhân hiệu | NULL, FK → `courses(id)` ON DELETE RESTRICT (không cho xóa khóa đã có đơn). **Đổi từ NOT NULL (Module 1) thành NULL: đơn nhiều khóa hoặc đơn mua gói membership không có một `course_id` duy nhất — xem Quyết định D4** | Đọc: chính mình + AD; Ghi: SR |
| `membership_plan_id` | uuid | Gói membership trong đơn (nếu đơn mua gói) | uuid của gói Cộng đồng Visfar | NULL, FK → `membership_plans(id)` ON DELETE RESTRICT. **MỚI** | Đọc: chính mình + AD; Ghi: SR |
| `amount_vnd` | integer | Tổng tiền phải trả sau giảm giá (VND) | `0` (đơn Tùy tâm chưa nhập số / đơn miễn phí) | NOT NULL, CHECK ≥ 0 | Đọc: chính mình + AD; Ghi: SR |
| `custom_amount_vnd` | integer | Số tiền tùy tâm học viên nhập (nếu có) | `NULL` (chưa nhập) | NULL, CHECK ≥ 0 | Đọc: chính mình + AD; Ghi: SR |
| `discount_vnd` | integer | Số tiền được giảm (coupon) | `0` | NOT NULL DEFAULT 0, CHECK ≥ 0. **MỚI** | Đọc: chính mình + AD; Ghi: SR |
| `coupon_id` | uuid | Mã giảm giá đã áp dụng | `NULL` (không dùng coupon) | NULL, FK → `coupons(id)` ON DELETE SET NULL. **MỚI** | Đọc: chính mình + AD; Ghi: SR |
| `status` | text | Trạng thái đơn | `pending` | NOT NULL DEFAULT `'pending'`, CHECK IN (`pending`, `paid`, `cancelled`, `refunded`, `expired`) | Đọc: chính mình + AD; Ghi: SR / AD. **Chỉ server mới được đổi sang `paid`** (qua webhook SePay đã xác minh chữ ký hoặc admin xác nhận thủ công sau khi kiểm tra sao kê — không bao giờ tin client báo “đã trả”) |
| `payment_method` | text | Phương thức thanh toán | `bank_transfer` (chuyển khoản thủ công giai đoạn đầu) | CHECK IN (`bank_transfer`, `sepay`, `stripe`, `cash`, `free`) | Đọc: chính mình + AD; Ghi: SR |
| `reference_code` | text | Mã đơn — nội dung chuyển khoản | `DH-2026-000123` | NOT NULL, UNIQUE | Đọc: chính mình + AD; Ghi: SR |
| `expires_at` | timestamptz | Hết hạn giữ chỗ (đơn chuyển khoản thủ công) | `2026-11-11 20:00:00+07` | NULL | Đọc: chính mình + AD; Ghi: SR |
| `paid_at` | timestamptz | Thời điểm đơn chuyển sang `paid` | `NULL` (đơn đang `pending`) | NULL. **MỚI** | Đọc: chính mình + AD; Ghi: SR |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Hoàn trả: theo QĐ 9 — hoàn trả trong 15 ngày làm việc; khiếu nại phản hồi trong 3 ngày. Hoàn trả đơn (`refunded`) đồng thời thu hồi enrollment (ma trận quyền hành động 17, chỉ AD).

### 2.19. `order_items` — Dòng hàng trong đơn (một đơn có nhiều khóa/gói) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1 (Module 1: mỗi đơn chỉ có đúng 1 `course_id`).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD; Ghi: SR |
| `order_id` | uuid | Đơn chứa dòng hàng | uuid của đơn `DH-2026-000123` | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `item_type` | text | Loại dòng hàng | `course` | NOT NULL, CHECK IN (`course`, `membership_plan`) | Đọc: như trên; Ghi: SR |
| `course_id` | uuid | Khóa học (khi `item_type = 'course'`) | uuid của khóa 08 | NULL, FK → `courses(id)` ON DELETE RESTRICT | Đọc: như trên; Ghi: SR |
| `membership_plan_id` | uuid | Gói membership (khi `item_type = 'membership_plan'`) | `NULL` | NULL, FK → `membership_plans(id)` ON DELETE RESTRICT | Đọc: như trên; Ghi: SR |
| `title_snapshot` | text | Tên khóa/gói tại thời điểm đặt hàng (đề phòng đổi tên sau này) | `Master Tâm thức & Nhân hiệu` | NOT NULL | Đọc: như trên; Ghi: SR |
| `price_vnd` | integer | Giá của dòng hàng tại thời điểm đặt (VND) | `0` (khóa Tùy tâm) | NOT NULL, CHECK ≥ 0 | Đọc: như trên; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now(). **Không `updated_at`: dòng hàng không sửa sau khi tạo** | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`order_id`, `course_id`) với điều kiện `course_id IS NOT NULL`; UNIQUE (`order_id`, `membership_plan_id`) với điều kiện `membership_plan_id IS NOT NULL`. Tổng `price_vnd` các dòng (trừ `discount_vnd`) phải bằng `orders.amount_vnd` — kiểm tra ở Workers API, không tin client.

### 2.20. `payments` — Giao dịch thanh toán (1 đơn có nhiều lần thanh toán / đối soát)

Đã có trong Module 1. Thêm `receipt_url` (biên lai học viên upload).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD (học viên chỉ đọc đơn của mình qua `orders`, không đọc trực tiếp `payments`); Ghi: SR |
| `order_id` | uuid | Đơn được thanh toán | uuid của đơn `DH-2026-000123` | NOT NULL, FK → `orders(id)` ON DELETE CASCADE | Đọc: AD; Ghi: SR |
| `amount_vnd` | integer | Số tiền giao dịch (VND) | `0` (giao dịch Tùy tâm chưa nhập số — ghi rõ: số tiền thật lấy từ sao kê/webhook, không tự điền) | NOT NULL, CHECK > 0 — **ngoại lệ: giao dịch Tùy tâm 0đ vẫn cần một dòng ghi nhận; nếu giữ CHECK > 0 thì giao dịch 0đ không lưu được — xem Quyết định D10** | Đọc: AD; Ghi: SR |
| `method` | text | Phương thức giao dịch | `bank_transfer` | NOT NULL, CHECK IN (`bank_transfer`, `sepay`, `stripe`) | Đọc: AD; Ghi: SR |
| `gateway_reference` | text | Mã giao dịch từ cổng (SePay transaction id, Stripe payment_intent…) | `SEPAY-20261110-XXXXXX` (mã thật từ SePay khi có giao dịch) | NULL | Đọc: AD; Ghi: SR |
| `gateway_payload` | jsonb | Payload webhook gốc (để đối soát, không chứa secret) | `{"transaction_id": "…", "amount": …}` | NULL | Đọc: AD; Ghi: SR |
| `receipt_url` | text | Link biên lai chuyển khoản học viên upload (Storage, private) | `https://…/receipts/bien-lai-000123.jpg` | NULL. **MỚI** (Module 1 không có; form Nâng Tầm đã có ô upload biên lai) | Đọc: AD; Ghi: SR (học viên upload qua Workers) |
| `status` | text | Trạng thái giao dịch | `pending` | NOT NULL DEFAULT `'pending'`, CHECK IN (`pending`, `succeeded`, `failed`, `refunded`) | Đọc: AD; Ghi: SR |
| `paid_at` | timestamptz | Thời điểm tiền về | `NULL` (chưa xác nhận) | NULL | Đọc: AD; Ghi: SR |
| `verified_by` | uuid | Admin xác nhận thủ công (nếu có) | uuid của admin Lê Đăng Quyết | NULL, FK → `profiles(id)` ON DELETE SET NULL | Đọc: AD; Ghi: SR (AD qua API) |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`method`, `gateway_reference`) khi `gateway_reference` không NULL — chống ghi trùng 1 giao dịch cổng 2 lần. **Không ghi số tài khoản ngân hàng vào bảng này** (QĐ 15: chỉ dùng ảnh chụp/QR do user cung cấp).

### 2.21. `coupons` — Mã giảm giá — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD (học viên chỉ biết coupon có hợp lệ không qua API kiểm tra, không đọc toàn bộ bảng); Ghi: AD |
| `code` | text | Mã coupon học viên nhập | `VISFAR10` (ví dụ minh họa) | NOT NULL, UNIQUE | Đọc: AD; Ghi: AD |
| `discount_type` | text | Loại giảm giá | `percent` | NOT NULL, CHECK IN (`percent`, `fixed_vnd`) | Đọc: AD; Ghi: AD |
| `discount_value` | integer | Giá trị giảm (%, hoặc VND nếu `fixed_vnd`) | `10` (= giảm 10%) | NOT NULL, CHECK > 0; nếu `percent` thì CHECK ≤ 100 | Đọc: AD; Ghi: AD |
| `max_uses` | integer | Số lần dùng tối đa; NULL = không giới hạn | `100` | NULL, CHECK > 0 | Đọc: AD; Ghi: AD |
| `used_count` | integer | Số lần đã dùng | `0` | NOT NULL DEFAULT 0, CHECK ≥ 0; **chỉ tăng bằng server (transaction), không cho client tự sửa** | Đọc: AD; Ghi: SR |
| `valid_from` | timestamptz | Hiệu lực từ | `2026-11-10 00:00:00+07` | NULL | Đọc: AD; Ghi: AD |
| `valid_to` | timestamptz | Hiệu lực đến | `2026-11-30 23:59:59+07` | NULL | Đọc: AD; Ghi: AD |
| `applicable_course_id` | uuid | Chỉ áp cho khóa này; NULL = áp cho mọi khóa | `NULL` (áp mọi khóa) | NULL, FK → `courses(id)` ON DELETE SET NULL | Đọc: AD; Ghi: AD |
| `is_active` | boolean | Coupon còn bật không | `true` | NOT NULL DEFAULT `true` | Đọc: AD; Ghi: AD |
| `created_by` | uuid | Admin tạo coupon | uuid của admin Lê Đăng Quyết | NULL, FK → `profiles(id)` ON DELETE SET NULL | Đọc: AD; Ghi: hệ thống |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

### 2.22. `membership_plans` — Gói thành viên (membership) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: công khai nếu `published`; Ghi: AD |
| `slug` | text | Đường dẫn thân thiện | `cong-dong-visfar` | NOT NULL, UNIQUE | Đọc: công khai; Ghi: AD |
| `name` | text | Tên gói | `Cộng đồng Visfar` | NOT NULL | Đọc: công khai; Ghi: AD |
| `description` | text | Mô tả gói | `Cộng đồng học tập suốt đời của Visfar Academy…` (ví dụ minh họa) | NULL | Đọc: công khai; Ghi: AD |
| `price_vnd` | integer | Giá gói (VND) | `0` (gói cộng đồng miễn phí). **Giá các gói trả phí chưa có — chờ user cung cấp, không tự điền (xem Quyết định D10)** | NOT NULL DEFAULT 0, CHECK ≥ 0 | Đọc: công khai; Ghi: AD |
| `billing_period` | text | Chu kỳ thu phí | `lifetime` | NOT NULL, CHECK IN (`one_time`, `monthly`, `yearly`, `lifetime`) | Đọc: công khai; Ghi: AD |
| `duration_days` | integer | Số ngày hiệu lực; NULL = vĩnh viễn | `NULL` (gói lifetime) | NULL, CHECK > 0 | Đọc: công khai; Ghi: AD |
| `benefits` | jsonb | Quyền lợi gói (danh sách khóa được truy cập…) | `{"course_ids": ["<uuid khóa 10>"], "community_access": true}` | NULL | Đọc: công khai; Ghi: AD |
| `status` | text | Trạng thái xuất bản | `published` | NOT NULL DEFAULT `'draft'`, CHECK IN (`draft`, `published`, `archived`) | Đọc: công khai nếu `published`; Ghi: AD |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

### 2.23. `memberships` — Thành viên đã mua/đăng ký gói — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Phân biệt với `enrollments` (§2.8): membership là **quyền truy cập theo gói** (ví dụ vào Cộng đồng Visfar), enrollment là **ghi danh vào một khóa cụ thể**. Một membership có thể sinh ra nhiều enrollment (qua `enrollments.membership_id`).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD; Ghi: SR |
| `user_id` | uuid | Thành viên | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: chính mình + AD; Ghi: SR |
| `plan_id` | uuid | Gói đã đăng ký | uuid của gói Cộng đồng Visfar | NOT NULL, FK → `membership_plans(id)` ON DELETE RESTRICT | Đọc: chính mình + AD; Ghi: SR |
| `status` | text | Trạng thái membership | `active` | NOT NULL DEFAULT `'pending'`, CHECK IN (`active`, `expired`, `cancelled`, `pending`) | Đọc: chính mình + AD; Ghi: SR / AD |
| `started_at` | timestamptz | Thời điểm bắt đầu | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: chính mình + AD; Ghi: SR |
| `expires_at` | timestamptz | Thời điểm hết hạn; NULL = vĩnh viễn | `NULL` (gói lifetime) | NULL | Đọc: chính mình + AD; Ghi: SR |
| `order_id` | uuid | Đơn hàng đã tạo membership này | uuid của đơn mua gói | NULL, FK → `orders(id)` ON DELETE SET NULL | Đọc: chính mình + AD; Ghi: SR |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`user_id`, `plan_id`) với điều kiện `status = 'active'` (partial unique index) — một người không có 2 membership cùng gói cùng hiệu lực.

### 2.24. `certificates` — Chứng chỉ hoàn thành khóa học

Đã có trong Module 1. Thêm `pdf_url`.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD (+ GV: học viên khóa phụ trách); Ghi: SR |
| `user_id` | uuid | Người nhận chứng chỉ | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `course_id` | uuid | Khóa học đã hoàn thành | uuid của khóa 01 Thấu Hiểu Nội Tâm | NOT NULL, FK → `courses(id)` ON DELETE CASCADE | Đọc: như trên; Ghi: SR |
| `certificate_code` | text | Mã chứng chỉ | `VISFAR-CERT-2026-000123` | NOT NULL, UNIQUE | Đọc: như trên; Ghi: SR |
| `pdf_url` | text | File PDF chứng chỉ (Storage) | `https://…/certificates/VISFAR-CERT-2026-000123.pdf` | NULL. **MỚI** | Đọc: chính mình + AD; Ghi: SR |
| `issued_at` | timestamptz | Thời điểm cấp | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: như trên; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now(). **Không `updated_at`: chứng chỉ không sửa sau khi cấp** | Đọc: AD; Ghi: hệ thống |

Ràng buộc: UNIQUE (`user_id`, `course_id`) — 1 chứng chỉ / 1 học viên / 1 khóa. Chứng chỉ chỉ cấp khi enrollment `completed` (hoàn thành 100% bài học) — tạo tự động qua Workers, không cấp tay.

### 2.25. `leads` — Đăng ký tư vấn (thay thế form → Apps Script → Sheet)

Đã có trong Module 1. Thêm `assigned_to`. Luồng mới theo QĐ 5: **API làm lớp trước, rồi ghi Sheet** — API nhận lead, validate / chống spam / chống trùng, sau đó ghi vào Sheet (bản sao đối soát); Sheet không còn là đường ghi duy nhất.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD; Ghi: SR (qua Workers) |
| `reference_code` | text | Mã tham chiếu để đối soát | `VISFAR-2026-000123` | NOT NULL, UNIQUE | Đọc: AD (+ người gửi nhận mã này trong response API, không đọc bảng); Ghi: SR |
| `idempotency_key` | text | Khóa chống ghi trùng (client sinh UUID, gửi qua header `Idempotency-Key`) | `550e8400-e29b-41d4-a716-446655440000` | NOT NULL, UNIQUE | Đọc: SR; Ghi: SR |
| `full_name` | text | Họ và tên người đăng ký tư vấn | `Nguyễn Văn A` | NOT NULL (2–100 ký tự, kiểm tra ở API) | Đọc: AD; Ghi: SR |
| `phone` | text | SĐT | `0901234567` | NOT NULL, CHECK `^0\d{9}$` | Đọc: AD; Ghi: SR |
| `email` | text | Email | `nguyenvana@example.com` | NOT NULL, CHECK email hợp lệ (TLD ≥ 2 ký tự) | Đọc: AD; Ghi: SR |
| `province` | text | Tỉnh/thành | `Hà Nội` | NOT NULL, whitelist 34 tỉnh/thành (§0.1) | Đọc: AD; Ghi: SR |
| `course_id` | uuid | Khóa quan tâm | uuid của khóa 01 Thấu Hiểu Nội Tâm | NULL, FK → `courses(id)` ON DELETE SET NULL (NULL nếu “Chưa biết bắt đầu từ đâu”) | Đọc: AD; Ghi: SR |
| `course_interest_text` | text | Ghi lại tên khóa lúc đăng ký (đề phòng khóa đổi tên/xóa sau này) | `Thấu Hiểu Nội Tâm` | NULL | Đọc: AD; Ghi: SR |
| `source` | text | Nguồn lead | `visfar-academy` | NOT NULL DEFAULT `'visfar-academy'` (các giá trị khác: `nang-tam`) | Đọc: AD; Ghi: SR |
| `status` | text | Trạng thái pipeline chăm sóc | `new` | NOT NULL DEFAULT `'new'`, CHECK IN (`new`, `contacted`, `enrolled`, `closed`, `spam`) | Đọc: AD; Ghi: AD (đổi trạng thái / ghi chú) |
| `notes` | text | Ghi chú chăm sóc (admin) | `Đã gọi 10/11, hẹn gọi lại 11/11` (ví dụ minh họa) | NULL | Đọc: AD; Ghi: AD |
| `assigned_to` | uuid | Admin phụ trách lead này | uuid của admin Lê Đăng Quyết | NULL, FK → `profiles(id)` ON DELETE SET NULL. **MỚI** | Đọc: AD; Ghi: AD |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Chống spam (QĐ 4): honeypot + rate-limit (tối đa 5 lần/giờ/IP) + idempotency + CAPTCHA (Turnstile). **GV không được xem lead** (ma trận quyền hành động 19–20). PII (họ tên/SĐT/email) không đưa vào log — log chỉ ghi `reference_code` và `user_id`.

### 2.26. `notifications` — Thông báo in-app — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1 (Module 1 chỉ dùng email; SYSTEM_ARCHITECTURE §10.11 ghi rõ schema Module 1 không có bảng `notifications`). Được tạo theo QĐ Task 02 số 4 (có tạo bảng `notifications`, thông báo in-app được hỗ trợ, không chỉ dùng email).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: chính mình + AD; Ghi: SR |
| `user_id` | uuid | Người nhận thông báo | uuid của học viên | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Đọc: chính mình + AD; Ghi: SR |
| `type` | text | Loại thông báo | `order_paid` | NOT NULL, CHECK IN (`order_paid`, `enrollment_granted`, `certificate_issued`, `event_reminder`, `lesson_reminder`, `lead_new`, `payment_received`, `system`) | Đọc: chính mình + AD; Ghi: SR |
| `title` | text | Tiêu đề thông báo | `Đơn hàng của bạn đã được xác nhận` (ví dụ minh họa) | NOT NULL | Đọc: chính mình + AD; Ghi: SR |
| `body` | text | Nội dung thông báo | `Đơn DH-2026-000123 đã thanh toán thành công…` (ví dụ minh họa) | NULL | Đọc: chính mình + AD; Ghi: SR |
| `link_url` | text | Link khi bấm vào thông báo | `/hoc-vien/khoa-hoc/thau-hieu-noi-tam` | NULL | Đọc: chính mình + AD; Ghi: SR |
| `related_type` | text | Loại đối tượng liên quan | `order` | NULL | Đọc: chính mình + AD; Ghi: SR |
| `related_id` | uuid | ID đối tượng liên quan (không FK cứng để không khóa xóa) | uuid của đơn `DH-2026-000123` | NULL | Đọc: chính mình + AD; Ghi: SR |
| `is_read` | boolean | Đã đọc chưa | `false` | NOT NULL DEFAULT `false` | Đọc: chính mình; Ghi: chính mình (qua Workers, đánh dấu đã đọc) |
| `read_at` | timestamptz | Thời điểm đọc | `NULL` (chưa đọc) | NULL | Đọc: chính mình; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now(). **Không `updated_at`** (trừ `is_read`/`read_at` — cập nhật qua API đánh dấu đã đọc) | Đọc: AD; Ghi: hệ thống |

### 2.27. `email_logs` — Nhật ký email (để đối soát Resend)

Đã có trong Module 1. Thêm `error_message`, `sent_at`.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD; Ghi: SR |
| `to_email` | text | Email người nhận | `nguyenvana@example.com` | NOT NULL | Đọc: AD; Ghi: SR |
| `template` | text | Mẫu email đã dùng | `order_paid` | NOT NULL (VD: `welcome`, `order_paid`, `lesson_reminder`) | Đọc: AD; Ghi: SR |
| `resend_id` | text | ID từ Resend | `re_xxxxxxxxxxxx` (id thật từ Resend khi có) | NULL | Đọc: AD; Ghi: SR |
| `status` | text | Trạng thái gửi | `sent` | NOT NULL DEFAULT `'queued'`, CHECK IN (`queued`, `sent`, `delivered`, `bounced`, `failed`) | Đọc: AD; Ghi: SR (cập nhật qua webhook Resend đã xác minh chữ ký) |
| `related_type` | text | Loại đối tượng liên quan | `order` | NULL (VD: `lead`, `order`, `enrollment`) | Đọc: AD; Ghi: SR |
| `related_id` | uuid | ID đối tượng liên quan (không FK cứng) | uuid của đơn `DH-2026-000123` | NULL | Đọc: AD; Ghi: SR |
| `error_message` | text | Lỗi gửi (nếu `failed`/`bounced`) | `Invalid recipient` (ví dụ minh họa) | NULL. **MỚI** | Đọc: AD; Ghi: SR |
| `sent_at` | timestamptz | Thời điểm gửi thành công | `2026-11-10 20:00:00+07` | NULL. **MỚI** | Đọc: AD; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now(). **Không `updated_at` (trừ cập nhật `status` qua webhook)** | Đọc: AD; Ghi: hệ thống |

### 2.28. `automation_events` — Sự kiện kích hoạt automation (email / thông báo tự động) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Ghi lại mọi sự kiện kích hoạt luồng tự động (VD: học viên hoàn thành khóa → gửi email chứng chỉ) để đối soát và xử lý lại khi lỗi.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD; Ghi: SR |
| `trigger_type` | text | Loại kích hoạt | `enrollment_completed` | NOT NULL (VD: `enrollment_completed`, `order_paid`, `lead_created`, `event_tomorrow`, `lesson_incomplete_7d`) | Đọc: AD; Ghi: SR |
| `trigger_source` | text | Nguồn phát sinh sự kiện | `enrollments` | NOT NULL | Đọc: AD; Ghi: SR |
| `related_type` | text | Loại đối tượng liên quan | `enrollment` | NULL | Đọc: AD; Ghi: SR |
| `related_id` | uuid | ID đối tượng liên quan (không FK cứng) | uuid của enrollment khóa 01 | NULL | Đọc: AD; Ghi: SR |
| `payload` | jsonb | Dữ liệu kèm theo để chạy automation | `{"user_id": "…", "course_id": "…"}` | NULL | Đọc: AD; Ghi: SR |
| `status` | text | Trạng thái xử lý | `processed` | NOT NULL DEFAULT `'pending'`, CHECK IN (`pending`, `processed`, `failed`, `skipped`) | Đọc: AD; Ghi: SR |
| `processed_at` | timestamptz | Thời điểm xử lý xong | `2026-11-10 20:00:00+07` | NULL | Đọc: AD; Ghi: SR |
| `error_message` | text | Lỗi xử lý (nếu `failed`) | `Resend API timeout` (ví dụ minh họa) | NULL | Đọc: AD; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now(). **Không `updated_at` (trừ cập nhật `status` khi xử lý)** | Đọc: AD; Ghi: hệ thống |

Phân biệt với `email_logs` (§2.27) và `notifications` (§2.26): `automation_events` ghi **sự kiện kích hoạt** (đã kích hoạt automation nào, xử lý xong chưa); `email_logs` ghi **email đã gửi**; `notifications` ghi **thông báo đã tạo**. Một automation event có thể sinh ra 1 email + 1 notification.

### 2.29. `activity_logs` — Nhật ký hoạt động của người dùng (hành vi) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Ghi hành vi sử dụng (đăng nhập, xem trang, mở bài học…) phục vụ phân tích và hỗ trợ người dùng. Phân biệt với `audit_logs` (§2.30): `activity_logs` ghi **người dùng làm gì trên nền tảng**, `audit_logs` ghi **ai đã thay đổi dữ liệu nhạy cảm nào** (chủ yếu là thao tác admin).

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD; Ghi: SR |
| `user_id` | uuid | Người thực hiện; NULL nếu khách chưa đăng nhập | uuid của học viên | NULL, FK → `profiles(id)` ON DELETE SET NULL | Đọc: AD (+ chính mình xem lịch sử của mình — chờ chốt); Ghi: SR |
| `action` | text | Hành động | `lesson.view` | NOT NULL (VD: `auth.login`, `lesson.view`, `course.view`, `quiz.start`) | Đọc: AD; Ghi: SR |
| `path` | text | Đường dẫn / màn hình xảy ra hành động | `/hoc-vien/khoa-hoc/thau-hieu-noi-tam/bai/bai-1` | NULL | Đọc: AD; Ghi: SR |
| `metadata` | jsonb | Dữ liệu kèm theo | `{"lesson_id": "…"}` | NULL | Đọc: AD; Ghi: SR |
| `ip_address` | inet | IP nguồn (phục vụ chống lạm dụng) | `203.0.113.10` (IP ví dụ minh họa, không phải IP thật của người dùng) | NULL. **Cột nhạy cảm: chỉ AD đọc; không xuất ra báo cáo công khai; thời gian lưu giữ chờ chốt (xem Quyết định D6)** | Đọc: AD; Ghi: SR |
| `user_agent` | text | Trình duyệt / thiết bị | `Mozilla/5.0…` (chuỗi thật do trình duyệt gửi) | NULL | Đọc: AD; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now(). **Bảng append-only: không `updated_at`, không UPDATE/DELETE** | Đọc: AD; Ghi: hệ thống |

### 2.30. `audit_logs` — Nhật ký thao tác admin / thao tác nhạy cảm (tối thiểu)

Đã có trong Module 1. Thêm `ip_address`. Append-only, không UPDATE/DELETE; chỉ AD đọc.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD; Ghi: SR |
| `actor_id` | uuid | Người thực hiện thao tác (NULL nếu thao tác hệ thống) | uuid của admin Lê Đăng Quyết | NULL, FK → `profiles(id)` ON DELETE SET NULL | Đọc: AD; Ghi: SR |
| `action` | text | Hành động (định dạng `<đối tượng>.<động từ>`) | `order.mark_paid` | NOT NULL (VD: `order.mark_paid`, `course.publish`, `lead.status`, `user.role_grant`, `enrollment.gift`) | Đọc: AD; Ghi: SR |
| `target_type` | text | Loại đối tượng bị tác động | `order` | NOT NULL | Đọc: AD; Ghi: SR |
| `target_id` | uuid | ID đối tượng bị tác động | uuid của đơn `DH-2026-000123` | NULL | Đọc: AD; Ghi: SR |
| `details` | jsonb | Chi tiết thay đổi (giá trị trước/sau) | `{"from": "pending", "to": "paid"}` | NULL. **Không ghi PII (SĐT/email/mật khẩu) và không ghi secret vào đây** | Đọc: AD; Ghi: SR |
| `ip_address` | inet | IP nguồn của thao tác | `203.0.113.10` (IP ví dụ minh họa) | NULL. **MỚI** | Đọc: AD; Ghi: SR |
| `created_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now(). **Không `updated_at`, không UPDATE/DELETE** | Đọc: AD; Ghi: hệ thống |

Các thao tác bắt buộc ghi `audit_logs`: admin tặng khóa, admin xác nhận thanh toán thủ công, cấp/thu hồi role, gán/thu hồi giảng viên cho khóa, hoàn trả đơn, đổi trạng thái lead.

### 2.31. `system_settings` — Cài đặt hệ thống (key–value) — **MỚI**

Bảng mới trong Task 03; chưa có trong Module 1. Lưu các tham số vận hành mà admin thay đổi được không cần deploy lại.

| Cột | Kiểu | Ý nghĩa | Ví dụ | Ràng buộc | Đọc / Ghi |
|---|---|---|---|---|---|
| `id` | uuid PK | Khóa chính | `…` | | Đọc: AD (+ SR đọc mọi key; client chỉ đọc key công khai qua API — xem ghi chú); Ghi: AD |
| `key` | text | Khóa cài đặt (duy nhất) | `refund.working_days` | NOT NULL, UNIQUE | Đọc: AD; Ghi: AD |
| `value` | jsonb | Giá trị cài đặt | `15` | NOT NULL | Đọc: AD; Ghi: AD |
| `description` | text | Mô tả ý nghĩa của key | `Số ngày làm việc xử lý hoàn trả (QĐ 9)` | NULL | Đọc: AD; Ghi: AD |
| `is_public` | boolean | Key có được trả về cho client không (VD: tên site) hay chỉ server đọc (VD: ngưỡng rate-limit) | `true` | NOT NULL DEFAULT `false`. **MỚI** | Đọc: AD; Ghi: AD |
| `updated_by` | uuid | Admin sửa lần cuối | uuid của admin Lê Đăng Quyết | NULL, FK → `profiles(id)` ON DELETE SET NULL | Đọc: AD; Ghi: hệ thống |
| `created_at`, `updated_at` | timestamptz | | `2026-11-10 20:00:00+07` | DEFAULT now() | Đọc: AD; Ghi: hệ thống |

Các key khởi tạo đề xuất (giá trị lấy từ quyết định đã chốt, không bịa thêm):

| key | value | Ghi chú |
|---|---|---|
| `site.name` | `"Visfar Academy"` | Tên hiển thị |
| `refund.working_days` | `15` | QĐ 9: hoàn trả 15 ngày làm việc |
| `complaint.response_days` | `3` | QĐ 9: khiếu nại phản hồi 3 ngày |
| `quiz.completion_video_percent` | `90` | QĐ 17: ngưỡng hoàn thành video 90% |
| `lead.rate_limit_per_hour_per_ip` | `5` | Ma trận quyền §3: lead tối đa 5 lần/giờ/IP |
| `payment.provider` | `"sepay"` | QĐ 15: dùng SePay |
| `payment.bank_name` | `"MB Bank"` | QĐ 15. **Không lưu số tài khoản tại đây** |

---

## 3. Bảng Module 1 không có trong danh sách 31 bảng Task 03

8 bảng đã định nghĩa trong schema Module 1 (§3 tài liệu kiến trúc) **không xuất hiện** trong danh sách 31 bảng của Task 03. Đây không phải lỗi đánh máy — cần chốt số phận từng bảng trước khi viết migration (xem Quyết định D7):

| Bảng Module 1 | Trạng thái trong Task 03 | Đề xuất |
|---|---|---|
| `modules` | Đổi tên thành `course_modules` (§2.5) | Giữ, đổi tên bằng migration |
| `quiz_questions` | Thay bằng `questions` (§2.12) | Giữ dữ liệu, migrate sang `questions` + `quizzes` |
| `quiz_options` | Gộp vào `questions.options` (jsonb) (§2.12) | Migrate dữ liệu vào jsonb rồi mới bỏ bảng |
| `events` | Không có trong 31 bảng | **Giữ** — sự kiện 25/11/2026 đã chốt ngày, cần bảng này; bổ sung từ điển sau |
| `event_registrations` | Không có trong 31 bảng | **Giữ** — đăng ký sự kiện bằng email (khách chưa đăng nhập) cần bảng này; bổ sung từ điển sau |
| `posts` | Không có trong 31 bảng | **Giữ** — blog đã duyệt 3 bài (QĐ 10); bổ sung từ điển sau |
| `policies` | Không có trong 31 bảng | **Giữ** — chính sách có URL thật (QĐ 11), versioning; bổ sung từ điển sau |
| `newsletter_subscribers` | Không có trong 31 bảng | **Giữ** — newsletter footer làm thật (QĐ 6); bổ sung từ điển sau |

Ngoài ra, bảng `course_instructors` (giảng viên ↔ khóa phụ trách) **không có trong cả Module 1 lẫn danh sách 31 bảng**, nhưng ma trận quyền yêu cầu nó để thực thi mọi quyền “khóa phụ trách” của instructor. Theo QĐ Task 02 số 3: tạo bằng migration mới sau khi duyệt. Xem Quyết định D9.

---

## 4. Quyết định cần phê duyệt

1. **D1 — Một nguồn sự thật cho role: `user_roles` hay `profiles.role`?** (xem §1.4). Đề xuất: `user_roles` là nguồn duy nhất; `profiles.role` bỏ hẳn hoặc giữ làm cache chỉ đọc đồng bộ bằng trigger. Hàm `current_role()` và mọi policy RLS viết lại theo nguồn đã chốt. Cho tới khi chốt, không viết migration nào chạm vào role.
2. **D2 — Đáp án quiz lưu ở đâu?** (a) `quiz_options` (bảng riêng, Module 1) hay `questions.options` (jsonb, Task 03)? (b) `quiz_attempts.answers` (jsonb) giữ làm snapshot hay bỏ hẳn, chỉ dùng bảng `answers`? Đề xuất: giữ jsonb `options` trong `questions` (đơn giản, đủ dùng giai đoạn đầu); bỏ `quiz_attempts.answers` sau khi migrate dữ liệu sang bảng `answers`.
3. **D3 — Bài tập nộp lại và chấm lại:** học viên có được nộp lại bài tập sau khi đã nộp (`submissions` UNIQUE `assignment_id` + `user_id` có giữ không)? Giảng viên có được chấm nhiều lần (`submission_reviews` nhiều dòng / 1 bài nộp) hay chỉ 1 lần duy nhất?
4. **D4 — Đơn hàng một khóa hay nhiều khóa?** Giữ `orders.course_id` (đơn 1 khóa, Module 1) hay chuyển hẳn sang `order_items` (đơn nhiều khóa, Task 03)? Nếu chuyển hẳn: `orders.course_id` bỏ hay giữ làm cột legacy? Đề xuất: đơn mới dùng `order_items`; `orders.course_id` giữ NULL cho đơn nhiều khóa/gói.
5. **D5 — Tài liệu bài học ở đâu?** Giữ `lessons.file_url` (1 file / 1 bài, Module 1) hay chuyển hẳn sang `lesson_resources` (nhiều file / 1 bài, Task 03)? Đề xuất: chuyển hẳn; migrate `file_url` cũ thành 1 dòng `lesson_resources` rồi bỏ cột.
6. **D6 — Lưu giữ log và PII trong log:** `activity_logs.ip_address` và `audit_logs.ip_address` lưu bao lâu thì xóa? Học viên có được xem `activity_logs` của chính mình không? (Đề xuất: chỉ AD đọc; xóa/ẩn danh IP sau 90 ngày — chờ chốt số ngày.)
7. **D7 — Danh mục và các bảng Module 1 vắng mặt:** (a) Dùng `courses.pillar` (enum 4 giá trị) hay `categories` + `courses.category_id` làm tiêu chí lọc chính? (b) Chốt số phận 8 bảng Module 1 ở §3 (giữ/đổi tên/bỏ), đặc biệt `events`, `event_registrations`, `posts`, `policies`, `newsletter_subscribers` — đề xuất giữ cả 5 và bổ sung từ điển sau.
8. **D8 — Instructor xem đáp án đúng và SĐT/email học viên?** Ma trận quyền cấm GV xem `is_correct` qua client và cấm xem SĐT/email học viên (chỉ họ tên + tiến độ); QĐ Task 02 số 6 lại cho phép GV xem đáp án đúng quiz, SĐT/email học viên và quản lý blog/sự kiện. Chốt một trong hai và cập nhật ma trận quyền + cột `questions.correct_option_ids` / `profiles.phone` / `profiles.email` trong file này theo đó.
9. **D9 — Bảng `course_instructors`:** phê duyệt tạo bằng migration mới sau khi duyệt (QĐ Task 02 số 3)? Người gán giảng viên cho khóa có phải chỉ admin không? (Mọi lần gán/thu hồi ghi `audit_logs`.)
10. **D10 — Giá và giao dịch 0đ:** (a) Giá các gói membership trả phí và học phí các khóa trả phí chưa có trong tài liệu nguồn — user cung cấp giá hay giữ toàn bộ “Tùy tâm / 0đ” giai đoạn đầu? (b) `payments.amount_vnd` CHECK > 0 có giữ không — giao dịch Tùy tâm 0đ lưu như thế nào?
11. **D11 — `quiz_attempts.lesson_id` có giữ không?** Module 1 gắn attempt vào `lesson_id`; Task 03 gắn vào `quiz_id`. Giữ cả hai (dư thừa nhưng tương thích) hay chỉ giữ `quiz_id` (suy ra lesson qua `quizzes.lesson_id`)?
12. **D12 — Danh sách key `system_settings` khởi tạo:** duyệt 7 key ở §2.31 (đặc biệt `refund.working_days = 15`, `complaint.response_days = 3`, `payment.provider = "sepay"`, `payment.bank_name = "MB Bank"` — không lưu số tài khoản) hay thêm/bớt key nào?

---

*Hết file. Không triển khai database, không sửa code. Mọi thay đổi schema thực tế đều làm bằng migration mới sau khi file này và các quyết định ở §4 được phê duyệt.*
