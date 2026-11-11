# Hướng dẫn chạy Migration — Supabase Backend (Task 04)

**Ngày:** 10/11/2026 (cập nhật cùng ngày — thêm 0007, file môi trường, lần chạy thật staging đầu tiên)
**Trạng thái:** Project Supabase đã tạo (prod + staging); lần chạy thật đầu tiên lên staging ngày 10/11/2026 **FAIL ở 0001** (lỗi `42P01` — xem §2.8 và `BACKEND_TEST_REPORT.md` §5A) — **chờ phê duyệt phương án sửa 0001/0004 (§2.9) rồi mới chạy lại**. Chưa chạy gì lên prod. **Chạy lần 5 ngày 10/11/2026 22:49 +07 (TASK 07): 0011–0013 FAIL ngay ở 0011 trên staging (lỗi `42883`, xem §2.13). Chạy lần 6 ngày 10/11/2026 ~23:00 +07 (xem §2.14, user auto-duyệt): sửa 0011 (ép kiểu `::text`) + sửa 0013 (tiền đề mục (E) sai cột — `instructor_id` không tồn tại, cột đúng là `user_id`), chạy lại 0011→0013 — staging PASS hết, prod PASS hết. Kiểm chứng 4 điểm đạt cả hai môi trường.**
**Thuộc:** Task 04 — Supabase Backend Implementation, Visfar Academy
**Tài liệu liên quan:**

- `workspace/visfar-academy-platform/supabase/migrations/0001_init_schema.sql` (Module 1)
- `workspace/visfar-academy-platform/supabase/migrations/0002_seed_courses.sql` (Module 1)
- `workspace/visfar-academy-platform/supabase/migrations/0003_seed_content.sql` (Module 1)
- `workspace/visfar-academy-platform/supabase/migrations/0004_add_task03_tables.sql` (Task 03 — đã chuyển vào đây ngày 10/11/2026; bản sao còn ở `docs/database/DATABASE_MIGRATIONS/`)
- `workspace/visfar-academy-platform/supabase/migrations/0005_rename_restructure.sql` (Task 03 — như trên)
- `workspace/visfar-academy-platform/supabase/migrations/0006_rls_task03.sql` (Task 03 — như trên)
- `workspace/visfar-academy-platform/supabase/migrations/0007_fix_blockers.sql` (mới, 10/11/2026 — đổi tên bảng, trigger `user_roles`, 5 bucket Storage, xử lý bảng tạm, cập nhật seed 0003)
- `workspace/visfar-academy-platform/apps/web/.env.local` (prod) + `apps/web/.env.staging` (staging) — chỉ URL + anon key, `.gitignore` chặn, không commit
- `workspace/visfar-academy-platform/docs/database/DATABASE_SCHEMA.md` (Task 03 — thiết kế 38 bảng)
- `workspace/visfar-academy-platform/docs/database/RLS_POLICIES.md` (Task 03 — đặc tả RLS 38 bảng)
- `workspace/visfar-academy-platform/docs/DECISIONS.md` (phê duyệt Task 03 ngày 10/11/2026)
- `workspace/visfar-academy-platform/docs/supabase/BACKUP_GUIDE.md` (§8 backup trước migration, §7 phục hồi)
- `workspace/visfar-academy-platform/docs/supabase/ENVIRONMENT_CONFIG.md` (tạo project, phân bổ prod/staging)

## Phạm vi và giới hạn của tài liệu này

- **Đội ngũ không có quyền truy cập tài khoản Supabase của user**: không mật khẩu, không API key, không connection string thật. Tài liệu này là **hướng dẫn để user chạy migration**, không phải bản ghi của một lần chạy đã thực hiện.
- **Lần chạy thật đầu tiên đã diễn ra ngày 10/11/2026 (do coordinator chạy, staging): FAIL ở 0001** — xem §2.8 và `BACKEND_TEST_REPORT.md` §5A. **Không chạy migration lên database thật trong nhiệm vụ này** ngoài lần chạy đó; mọi lệnh dưới đây đều ở dạng mẫu — chỉ chạy lại sau khi phương án sửa §2.9 được phê duyệt.
- Tài liệu này **chỉ ghi tên secret / placeholder dạng `<...>`**, không ghi giá trị thật. Không ghi số tài khoản ngân hàng, không ghi giá trị secret nào.
- Mọi số liệu kiểm chứng trong tài liệu này đều đếm trực tiếp từ 7 file migration và `DECISIONS.md` ngày 10/11/2026. Nếu file migration được sửa sau ngày này (xem §2), cập nhật lại các số kỳ vọng ở §7 trước khi chạy.

## 0. Nguyên tắc vàng — đọc trước khi chạy bất cứ lệnh nào

| # | Nguyên tắc | Vì sao |
|---|---|---|
| 1 | **Chạy đúng thứ tự 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007.** Không chạy 0006 trước 0005, không chạy 0005 trước 0004, không chạy 0002/0003 trước 0001, không chạy 0007 trước 0006. | Mỗi file phụ thuộc file trước (xem §3). Chạy sai thứ tự là lỗi chắc chắn, không phải lỗi có thể. |
| 2 | **Staging trước, prod sau.** Chạy đủ 7 file + toàn bộ kiểm chứng §7 trên staging và đạt hết rồi mới chạm tới prod. | Staging là nơi duy nhất được phép sai. Prod chỉ chạy lại đúng những gì staging đã chạy đạt. |
| 3 | **Backup prod trước khi chạy prod.** Dump đầy đủ, giữ file backup khôi phục được, ghi lại tên file + thời điểm trước khi bắt đầu (xem §6). | 0005 đổi tên bảng và backfill dữ liệu — sai một bước mà không có backup thì không có đường về an toàn. |
| 4 | **Một project — một cách chạy.** Chọn **một** trong hai cách ở §4 (Dashboard SQL Editor) hoặc §5 (Supabase CLI) cho mỗi project và giữ nguyên tới cuối. Không trộn hai cách trên cùng một project. | Cách Dashboard không ghi vào bảng theo dõi migration của CLI (`supabase_migrations.schema_migrations`); trộn hai cách sẽ khiến CLI tưởng file chưa chạy và chạy lại, gây lỗi policy trùng. |
| 5 | **Dừng ngay khi gặp lỗi.** Không chạy file tiếp theo, không chạy lại file lỗi một cách mù quáng, không tự sửa dữ liệu trên prod để "chữa cháy". Xử lý theo §8. | Chạy tiếp sau lỗi sẽ tạo trạng thái nửa vời: bảng mới có, bảng cũ còn, dữ liệu backfill dở dang — khó chẩn đoán hơn lỗi gốc rất nhiều. |
| 6 | **Không reset main, không xóa dữ liệu nghiệp vụ.** Không chạy `supabase db reset` lên project prod/staging, không `DROP TABLE` bảng nghiệp vụ, không `TRUNCATE`, không `DELETE` dữ liệu thật để "làm sạch rồi chạy lại". | Reset/xóa là mất dữ liệu không khôi phục được nếu không có backup vừa dump. Mọi quay lại đều đi theo §8 (rename ngược hoặc restore từ backup). |

## 1. Chuẩn bị

### 1.1. Tạo 2 project Supabase

- Tạo **2 project Supabase Free** trên tài khoản Gmail `visfaracademy@gmail.com` (theo phê duyệt Task 02, quyết định 15; xem `ENVIRONMENT_CONFIG.md` §11 mục 1).
- Phân bổ: **project 1 = production, project 2 = staging**. Supabase Free chỉ có 2 project đang hoạt động — đúng 2 project cần dùng, không còn project dự phòng.
- Tên gợi ý (chưa phải tên thật — chốt khi tạo): `visfar-academy-prod` và `visfar-academy-staging`. Region gợi ý: Singapore (gần Việt Nam).
- Ghi lại cho mỗi project: tên project, project ref (`<project-ref>`), region. **Không gửi mật khẩu database / key qua chat** — mật khẩu chỉ nhập trực tiếp vào công cụ khi chạy lệnh.
- ✅ **Đã xong ngày 10/11/2026:** cả 2 project đã tạo — prod ref `ugynqjqyfynkmqutoarp`, staging ref `scskhplczrxlnxzruweu` (ref suy ra từ Project URL trong file môi trường; không ghi key vào tài liệu này).

### 1.2. Lấy thông tin kết nối (user làm, chỉ lấy — không gửi giá trị thật cho đội ngũ)

| Thông tin | Lấy ở đâu | Dùng cho |
|---|---|---|
| Project URL + anon key (từng project) | Supabase Dashboard → Project Settings → API | Kiểm chứng sau migration; cấu hình frontend/API (xem `ENVIRONMENT_CONFIG.md`) |
| Database password (từng project) | Đặt lúc tạo project; xem lại trong Dashboard → Project Settings → Database | `pg_dump` backup (§6) và Supabase CLI `db push` (§5) |
| Project ref (từng project) | Dashboard → Project Settings → General, hoặc trong Project URL | Lệnh `supabase link --project-ref <project-ref>` (§5) |

### 1.3. Cài Supabase CLI (chỉ cần nếu chọn cách CLI ở §5)

- Cài Supabase CLI trên máy chạy migration theo hướng dẫn cài đặt chính thức của Supabase, rồi kiểm tra bằng `supabase --version`.
- CLI cần Docker đang chạy nếu muốn dùng Supabase local để chạy thử (§5.4). Nếu máy chưa có Docker, bỏ qua bước chạy thử local và chạy thẳng lên staging theo §5.2 — vẫn đúng quy trình, chỉ mất một lớp kiểm tra sớm.

### 1.4. Chuẩn bị file migration

- 3 file Module 1 đã nằm đúng chỗ: `supabase/migrations/0001_init_schema.sql`, `0002_seed_courses.sql`, `0003_seed_content.sql`.
- 3 file Task 03 **đã** nằm trong `supabase/migrations/` từ ngày 10/11/2026 (`0004_add_task03_tables.sql`, `0005_rename_restructure.sql`, `0006_rls_task03.sql` — `diff` với bản sao ở `docs/database/DATABASE_MIGRATIONS/` giống hệt nhau). Bản chính là `supabase/migrations/`; mọi sửa sau này chỉ sửa ở đó.
- File mới `supabase/migrations/0007_fix_blockers.sql` đã có trong `supabase/migrations/` (10/11/2026) — chạy **sau** 0006 (xem §3.1).
- **Chưa chạy được ngay.** Đọc §2 trước — có 9 điểm trong các file hiện tại cần xử lý xong mới được chạy (trong đó §2.7–§2.8 là blocker mới, trong đó §2.8 đã gây lỗi thật ở lần chạy staging đầu tiên).

### 1.5. Hai thứ còn thiếu để chạy migration thật — đã được giải quyết thế nào (10/11/2026)

Trước đây, để chạy migration thật còn thiếu 2 thứ. Cả hai nay đã có — **không ghi giá trị token/key nào vào tài liệu này**:

| # | Thứ còn thiếu | Đã giải quyết thế nào |
|---|---|---|
| 1 | **Access token Supabase** (để Supabase CLI login + `link` + `db push`) | Đã nhận qua Secure Vault/chat. Token **không ghi vào file hay tài liệu nào** — chỉ dùng qua biến môi trường khi chạy lệnh CLI. Lần chạy thật đầu tiên (§5A) đã login thành công bằng token này (Supabase CLI 3.1.0, S-01) và link staging thành công (S-02). |
| 2 | **Project URL + anon key của prod và staging** (để kiểm chứng sau migration + cấu hình frontend) | Đã có trong file môi trường local: `apps/web/.env.local` (prod) và `apps/web/.env.staging` (staging). Mỗi file chỉ chứa `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key, không có service-role key). Cả hai file đều bị `.gitignore` chặn (đã phải thêm dòng `.env.staging` vì mẫu cũ `.env*.local` không chặn được file này) và không commit — xác nhận bằng `git check-ignore` + `git status` (xem `BACKEND_TEST_REPORT.md` T-12). |

**Cập nhật 10/11/2026 22:09 +07 — chạy lại lần 2:** token đã cấp lại, chạy qua Management API: **0001→0006 PASS trên staging (HTTP 201), 0007 FAIL** — lỗi `2BP01: cannot drop table questions_new_empty because other objects depend on it — constraint answers_question_id_fkey on table quiz_answers depends on table questions_new_empty` (xem §2.10 mới, F-12). Staging hiện có 40 bảng, 10 khóa, 4 policy, RLS 40/40, 81 policy, 0 bucket; prod 0 bảng, chưa chạy. **Cập nhật 10/11/2026 22:14 +07 — chạy lần 3 (user duyệt tất cả): migration 0008 mới + chạy lại 0007 — staging PASS hết, prod PASS hết (xem §2.11). Lệch policy 81 vs 83 đã đối chiếu xong: 81 là đúng, 83 là đếm nhầm (grep đếm cả 2 dòng comment trong 0006) — xem §2.11.** **Cập nhật 10/11/2026 — chạy lần 4 (user auto-duyệt): 0009 + 0010 PASS staging + prod (xem §2.12); tổng policy public nay là 80 (81 − 2 + 1, đúng theo 0009).** `supabase db push --remote` **không chạy được trong môi trường VM hiện tại** (mạng chặn Postgres wire protocol — S-03); đường vòng là Management API qua HTTPS (§5.5).

## 2. ⚠️ Điểm cần xử lý TRƯỚC khi chạy — chưa chạy được ngay

Các file migration hiện tại **chưa chạy được nguyên trạng**. 9 điểm dưới đây được phát hiện khi đọc kỹ nội dung và thứ tự phụ thuộc của 7 file đối chiếu với `DECISIONS.md` — trong đó **§2.8 đã gây lỗi thật** ở lần chạy staging đầu tiên ngày 10/11/2026 (xem `BACKEND_TEST_REPORT.md` §5A, S-05). **Dừng ở đây cho tới khi từng điểm được sửa file hoặc được chốt bằng văn bản.** Nhiệm vụ viết hướng dẫn này không sửa file migration nào — việc sửa thuộc về một nhiệm vụ riêng, sau khi user chốt phương án (§2.9).

### 2.1. [CHẶN] 0001: `enrollments` tham chiếu tới `orders` trước khi `orders` được tạo

- **Vị trí:** `supabase/migrations/0001_init_schema.sql` dòng 168 (`order_id uuid references public.orders (id)`) trong khi bảng `orders` mới được tạo ở dòng 239.
- **Vấn đề:** PostgreSQL yêu cầu bảng được tham chiếu phải tồn tại tại thời điểm `CREATE TABLE`. Chạy file này nguyên trạng sẽ lỗi tại bảng `enrollments` và dừng ở đó — các bảng sau (`lesson_progress`, `quiz_attempts`, …, `audit_logs`) và toàn bộ policy RLS phía sau sẽ chưa được tạo.
- **Cách sửa (chọn 1):** (a) chuyển khối tạo bảng `orders` + `payments` lên trước khối `enrollments`; hoặc (b) tạo `enrollments` không có cột `order_id`, rồi thêm cột + khóa ngoại bằng `ALTER TABLE` sau khi `orders` đã tồn tại. Không sửa bằng cách bỏ cột `order_id` hẳn — cột này là liên kết đơn hàng ↔ ghi danh.

### 2.2. [CHẶN] 0004: `order_items` tham chiếu tới `membership_plans` trước khi `membership_plans` được tạo

- **Vị trí:** `docs/database/DATABASE_MIGRATIONS/0004_add_task03_tables.sql` dòng 328 (`membership_plan_id uuid references public.membership_plans (id)`) trong khi bảng `membership_plans` mới được tạo ở dòng 364 (mục 14, sau mục 12 `order_items`).
- **Vấn đề:** giống §2.1 — chạy file này nguyên trạng sẽ lỗi tại bảng `order_items`, các bảng sau (`coupons` đã tạo trước nên không sao, nhưng `membership_plans`, `memberships`, `notifications`, …, `course_instructors` và trigger `updated_at`) sẽ chưa được tạo.
- **Cách sửa (chọn 1):** (a) chuyển khối tạo bảng `membership_plans` lên trước khối `order_items`; hoặc (b) tạo `order_items` không có cột `membership_plan_id`, rồi thêm cột + khóa ngoại bằng `ALTER TABLE` sau khi `membership_plans` đã tồn tại.

### 2.3. [CHẶN] Tên bảng đáp án học viên: file dùng `answers`, quyết định đã chốt là `quiz_answers`

- **Quyết định đã chốt:** `DECISIONS.md`, phê duyệt Task 03, quyết định 2 — **đổi `answers` thành `quiz_answers`**; đáp án đúng giữ ở bảng lựa chọn `question_options` (không gộp/đổi tên thành `answers`); giữ cột `quiz_answers.is_correct` là kết quả chấm ở server; hỗ trợ multiple-choice bằng `UNIQUE (attempt_id, question_id, option_id)`.
- **File hiện tại:** cả 3 file Task 03 đều dùng tên `answers` — 0004 tạo bảng `answers` (dòng 243) với `UNIQUE (attempt_id, question_id)`, 0005 backfill vào `public.answers` (mục 4), 0006 tạo policy trên `public.answers` (mục 2.8) và liệt kê `answers` trong khối kiểm tra mục 4.
- **Cách sửa:** đổi tên nhất quán ở cả 3 file trước khi chạy — 0004: `create table public.quiz_answers` + đổi tên index `idx_answers_*` thành `idx_quiz_answers_*`; 0005: backfill và rollback (§8) dùng `quiz_answers`; 0006: policy `quiz_answers_select_own` + khối kiểm tra mục 4 dùng `quiz_answers`. Đồng thời đổi `UNIQUE (attempt_id, question_id)` thành `UNIQUE (attempt_id, question_id, option_id)` theo quyết định multiple-choice (lưu ý: ràng buộc này cho phép 1 câu hỏi có nhiều dòng đáp án — kiểm tra lại cùng lúc với quyết định ở `DATABASE_SCHEMA.md` §3.14, nơi vẫn ghi `UNIQUE (quiz_attempt_id, question_id)`).
- **Không làm:** không chạy 0004–0006 với tên `answers` rồi đổi tên sau — đổi tên sau khi đã chạy sẽ cần thêm một migration nữa và làm lệch mọi kiểm chứng ở §7.

### 2.4. [CHẶN] Đổi tên `quiz_options` → `question_options`: đã chốt tên nhưng chưa có trong file migration nào

- **Quyết định đã chốt:** `DECISIONS.md`, phê duyệt Task 03, quyết định 2 và 4 — đáp án đúng giữ ở bảng lựa chọn **`question_options`**; `DATABASE_SCHEMA.md` §0.1/§4.2 và `RLS_POLICIES.md` §0.2 viết policy theo tên mới này.
- **File hiện tại:** không file nào đổi tên bảng này. 0001 tạo `quiz_options` và VIEW `quiz_options_public`; 0005 mục 3 ghi rõ "quiz_options KHÔNG đổi tên, KHÔNG đổi cấu trúc"; 0006 mục 3a tạo policy trên `public.quiz_options` và ghi chú "phụ thuộc 0005" cho tên mới `questions`/`course_modules` nhưng vẫn dùng tên bảng `quiz_options`.
- **Cách xử lý (chốt 1 trong 2 trước khi chạy):** (a) thêm bước rename `quiz_options` → `question_options` vào 0005 (kèm đổi tên VIEW thành `question_options_public` hoặc giữ tên VIEW cũ — chốt rõ), rồi cập nhật mọi chỗ dùng `quiz_options` trong 0006; hoặc (b) giữ nguyên tên `quiz_options` và cập nhật lại `DECISIONS.md` / `DATABASE_SCHEMA.md` / `RLS_POLICIES.md` cho khớp thực tế. Không chạy trong trạng thái "tài liệu nói tên mới, file chạy tên cũ" — kiểm chứng §7 sẽ không biết tin bên nào.

### 2.5. [CHƯA XONG] `user_roles` là nguồn duy nhất — nhưng trigger đồng bộ chưa có trong bộ 6 file

- **Quyết định đã chốt:** `DECISIONS.md`, phê duyệt Task 03, quyết định 3 — **`user_roles` là nguồn duy nhất**; `profiles.role` giữ làm cache đọc nhanh, đồng bộ bằng trigger từ `user_roles`; RLS và API đều đọc `user_roles`.
- **File hiện tại:** 0005 mục 5 chỉ backfill 1 chiều `profiles.role` → `user_roles` và ghi rõ "`profiles.role` KHÔNG XÓA, KHÔNG ĐỔI trong file này — vẫn là nguồn sự thật cho tới khi code chuyển sang đọc `user_roles`". Hàm `public.current_role()` ở 0001 đọc `profiles.role`, và toàn bộ policy ở 0001 + 0006 đều dùng `current_role()`. **Không file nào trong bộ 6 file tạo trigger đồng bộ `user_roles` → `profiles.role`.**
- **Cách xử lý:** sau khi chạy xong 0004–0006, `profiles.role` **vẫn là nguồn mà RLS đang đọc** — chưa được coi `user_roles` là nguồn duy nhất. Cần một migration bổ sung (tạo trigger đồng bộ + hàm đọc role từ `user_roles`) và một bước chuyển code/API sang đọc `user_roles`, rồi mới tuyên bố quyết định 3 đã thực thi. Ghi rõ trạng thái này vào bảng §3 khi chạy xong — không đánh dấu "đã xong" cho quyết định 3 chỉ vì bảng `user_roles` đã tồn tại.

### 2.6. [ĐÃ XONG] 0004–0006 đã nằm trong thư mục migration của CLI

- 3 file Task 03 **đã có** trong `supabase/migrations/` từ ngày 10/11/2026 (bản sao ở `docs/database/DATABASE_MIGRATIONS/` vẫn còn, `diff` giống hệt nhau). Supabase CLI (`supabase db push`) chỉ nhận file trong `supabase/migrations/` — điều kiện này nay đã đủ. Bản chính là `supabase/migrations/`; mọi sửa sau này chỉ sửa ở đó.
- Lưu ý: §5.1 (copy 0004–0006) nay không cần làm lại — chỉ giữ lại để đối chiếu khi cần kiểm tra bản sao.

### 2.7. [CHẶN] Blocker FK xuôi trong 0001/0004 — 0007 KHÔNG cứu được, push lần đầu sẽ lỗi

- **(a) 0001:** `CREATE TABLE enrollments` ở **dòng 164**, cột `order_id` ở **dòng 168** khai FK inline `references public.orders (id)`, trong khi bảng `orders` mới được tạo ở **dòng 239**. PostgreSQL yêu cầu bảng được tham chiếu phải tồn tại tại thời điểm `CREATE TABLE` — chạy file này nguyên trạng sẽ lỗi tại bảng `enrollments` và dừng ở đó.
- **(b) 0004:** `CREATE TABLE order_items` ở **dòng 324**, cột `membership_plan_id` ở **dòng 328** khai FK inline `references public.membership_plans (id)`, trong khi bảng `membership_plans` mới được tạo ở **dòng 364** (mục 14, sau mục 12 `order_items`). Lỗi tương tự tại bảng `order_items` khi chạy 0004.
- **Vì sao 0007 không cứu được:** mục (a)/(b) trong 0007 chỉ thêm FK khi **cả hai bảng đã tồn tại** — nếu bảng thiếu (do 0001/0004 lỗi) thì 0007 chỉ báo `NOTICE` và bỏ qua, không tự tạo lại bảng. Chính header 0007 cũng cảnh báo điều này.
- **Số dòng đã kiểm chứng bằng `grep` ngày 10/11/2026** (xem `BACKEND_TEST_REPORT.md` T-11): 0001 `enrollments` 164 / FK `order_id` 168 / `orders` 239; 0004 `order_items` 324 / FK `membership_plan_id` 328 / `membership_plans` 364.
- **Cách sửa:** xem phương án ở §2.9 — **đã phê duyệt và đã sửa file ngày 10/11/2026** (xem `BACKEND_TEST_REPORT.md` §5B); chạy lại đang dừng vì thiếu access token.

### 2.8. [CHẶN — LỖI THẬT] 0001: hàm `current_role()` tham chiếu bảng `profiles` chưa được tạo

- **Đã xảy ra thật** ở lần chạy staging đầu tiên ngày 10/11/2026 (do coordinator chạy qua Management API — xem `BACKEND_TEST_REPORT.md` §5A, S-05). Lỗi 400, thông điệp chính xác:
  `ERROR: 42P01: relation "public.profiles" does not exist, LINE 43: select role from public.profiles where id = auth.uid();`
- **Vị trí (đã đối chiếu trong file):** hàm `current_role()` ở **0001 dòng 36–44**, khai báo `language sql`, thân hàm dòng 43 là `select role from public.profiles where id = auth.uid();` — nhưng bảng `profiles` mới được tạo ở **dòng 49**. PostgreSQL kiểm tra thân hàm SQL ngay khi `CREATE FUNCTION`, nên lỗi ngay tại dòng 36–44 dù bảng sẽ được tạo sau đó.
- **Hậu quả:** file chạy trong 1 transaction nên **đã rollback hoàn toàn — staging vẫn có 0 bảng public**. Đã dừng lại theo lệnh: không tự sửa 0001/0004, không chạy tiếp 0002–0007, không link/chạy prod.
- **Vì sao kiểm tra cú pháp không bắt được:** `pglast` (T-05, PASS) chỉ kiểm tra cú pháp, không kiểm tra bảng có tồn tại khi tạo hàm SQL hay không. S-05 là bằng chứng thực tế cho giới hạn này.
- **Phạm vi:** trong 0001–0007 chỉ có 3 hàm `language sql` — 0001:38 `current_role()` và 0006:64 `is_instructor_of()`, 0006:80 `course_of_lesson()`. Hai hàm ở 0006 tham chiếu `course_instructors`/`lessons`/`course_modules`, là các bảng đã tồn tại khi 0006 chạy (sau 0004 + 0005), nên không dính cùng lỗi. Chỉ `current_role()` ở 0001 là dính.
- **Cách sửa:** xem phương án ở §2.9 — **đã phê duyệt và đã sửa file ngày 10/11/2026** (xem `BACKEND_TEST_REPORT.md` §5B); chạy lại đang dừng vì thiếu access token.

### 2.9. Phương án sửa 0001/0004 — ĐÃ PHÊ DUYỆT, ĐÃ SỬA FILE (10/11/2026)

> ✅ **Phương án dưới đây ĐÃ được phê duyệt và ĐÃ sửa file ngày 10/11/2026** (xem `BACKEND_TEST_REPORT.md` §5B: E-01/E-02 — chỉ đổi thứ tự các khối trong file, không đổi nội dung bảng/cột/hàm; kiểm chứng thuần đổi thứ tự bằng `sort` toàn bộ dòng). Chạy lại từ đầu trên staging (0001→0007) và kiểm chứng theo §7 — **hiện đang DỪNG vì biến môi trường `SUPABASE_ACCESS_TOKEN` không còn trong phiên làm việc; cần cấp lại token rồi mới chạy** (xem §5B, E-04). Không bịa token mới.

| # | File | Đổi thứ tự | Vì sao |
|---|---|---|---|
| 1 | 0001 | Chuyển khối tạo hàm `current_role()` (dòng 34–44) xuống **sau** `CREATE TABLE profiles` (dòng 49) | Sửa lỗi thật §2.8 (`42P01`) — hàm SQL chỉ được tạo sau khi bảng `profiles` đã tồn tại. Nội dung hàm giữ nguyên. |
| 2 | 0001 | Chuyển khối tạo bảng `orders` + `payments` lên **trước** khối `enrollments` | Sửa blocker §2.7(a) — `enrollments.order_id` FK tới `orders` phải có bảng `orders` tồn tại trước. Nội dung bảng giữ nguyên. |
| 3 | 0004 | Chuyển khối tạo bảng `membership_plans` lên **trước** khối `order_items` (ngay trước mục 12) | Sửa blocker §2.7(b) — `order_items.membership_plan_id` FK tới `membership_plans` phải có bảng tồn tại trước. Nội dung bảng giữ nguyên. |

**Phương án thay thế (nếu không muốn đổi thứ tự khối):** bỏ FK inline khỏi `enrollments.order_id` (0001:168) và `order_items.membership_plan_id` (0004:328), để 0007 mục (a)/(b) thêm FK sau — nhưng cách này vẫn cần sửa 0001 để xử lý §2.8 (hàm `current_role()`), nên đổi thứ tự là phương án gọn hơn.

**Sau khi phê duyệt và sửa:** chạy lại từ đầu trên staging theo §3.1 (0001→0007), dùng đường vòng Management API nếu CLI push vẫn bị chặn mạng (§5.5), kiểm chứng từng file theo §7, rồi mới nghĩ tới prod.

### 2.10. [CHẶN] Lỗi 0007 lần 2 — FK `answers.question_id` trỏ nhầm bảng tạm (F-12, 10/11/2026 22:09 +07)

- **Lỗi nguyên văn (HTTP 400):** `ERROR: 2BP01: cannot drop table questions_new_empty because other objects depend on it — DETAIL: constraint answers_question_id_fkey on table quiz_answers depends on table questions_new_empty — HINT: Use DROP ... CASCADE to drop the dependent objects too. — CONTEXT: SQL statement "drop table public.questions_new_empty" — PL/pgSQL function inline_code_block line 12 at EXECUTE`.
- **Nguyên nhân gốc:** 0004 tạo bảng `questions` (trống) và `answers.question_id` FK trỏ tới bảng đó; 0005 rename `questions` → `questions_new_empty` và `quiz_questions` → `questions` (bảng thật) nhưng FK không đổi theo, vẫn trỏ `questions_new_empty`. 0007 bước (g) DROP bảng tạm vì thế bị chặn. Kiểm chứng: `pg_constraint` trên `public.answers` cho `answers_question_id_fkey → questions_new_empty`.
- **Hậu quả:** transaction 0007 rollback hoàn toàn. Staging giữ trạng thái 0001→0006: 40 bảng, 10 khóa, 4 policy, RLS 40/40, 81 policy (lệch 2 so với kỳ vọng tĩnh 83 — cần đối chiếu), 0 bucket. Prod 0 bảng, chưa chạy.
- **Phương án đề xuất (chưa phê duyệt, chưa làm):** migration mới **0008** — (1) DROP + tạo lại FK `answers.question_id` trỏ tới bảng `questions` thật, kiểm tra 0 dòng mồ côi trước khi đổi; (2) DROP 2 bảng tạm (đều trống, 0 dòng); (3) chạy lại 0007 (có guard idempotent). **Không dùng `DROP ... CASCADE`.**

## 2.11. Chạy lần 3 — 0008 + chạy lại 0007: staging + prod PASS hết (10/11/2026 22:14 +07, user duyệt tất cả)

- **0008** (`supabase/migrations/0008_fix_fk_answers.sql`, pglast PARSE OK): (a) kiểm tra 0 dòng mồ côi `answers.question_id` so với bảng `questions` thật; (b) DROP + tạo lại FK `answers_question_id_fkey` trỏ `questions` thật, `on delete cascade`, không dùng `DROP ... CASCADE`; (c) DROP 2 bảng tạm (chỉ khi trống + không còn FK trỏ tới); (d) guard idempotent. Lần chạy 1 trên staging lỗi HTTP 400 `42P01: relation "public.quiz_answers" does not exist` — lỗi ở khối kiểm chứng cuối file 0008: `'public.quiz_answers'::regclass` trong `IN` lỗi khi bảng chưa tồn tại; đã sửa sang `coalesce(to_regclass(...))`, parse lại OK, chạy lần 2 HTTP 201. Kiểm chứng sau 0008: 38 bảng, bảng tạm đã mất, FK trỏ `questions`, `courses = 10`, `policies = 4`, 81 policy.
- **Chạy lại 0007** trên staging: HTTP 201. Kiểm chứng đầy đủ: 38 bảng, RLS 38/38, policy 81, `courses = 10`, `policies = 4`, `quiz_answers`/`question_options` tồn tại, `answers`/`quiz_options` không còn, view `question_options_public` tồn tại, trigger `trg_sync_profiles_role` tồn tại, UNIQUE multiple-choice tồn tại, 5 bucket (`public`, `avatars` public; `private`, `receipts`, `certificates` riêng tư), seed cập nhật đúng hoàn trả 15 ngày / khiếu nại 3 ngày. Chạy lại 0008 kiểm idempotent: HTTP 201, trạng thái không đổi.
- **Prod** (`ugynqjqyfynkmqutoarp`, đang trống): 0001→0006 + 0008 + 0007 đều HTTP 201; kiểm chứng giống hệt staging; REST anon trả đủ 10 khóa.
- **Đối chiếu policy 81 vs 83:** tập tên policy live trên staging (81) so với tập tên tạo bởi `create policy "..."` trong 0001 (35) + 0006 (46) — trùng khớp 100%. Số 83 là đếm nhầm: `grep -c "create policy"` đếm cả 2 dòng comment trong 0006. Tổng ròng đúng là **81**.
- **Lưu ý:** chạy tay qua Management API không ghi vào `supabase_migrations.schema_migrations` — theo dõi bằng bảng tay §3.2, không trộn CLI và API giữa chừng.

## 2.12. Chạy lần 4 — 0009 (vá RLS) + 0010 (avatar Storage): staging + prod PASS hết (10/11/2026, user auto-duyệt)

- **Đổi số migration avatar:** file `0008_dashboard_avatar_storage.sql` → `0010_dashboard_avatar_storage.sql` (xóa file số 0008 cũ, giữ nguyên nội dung; mọi tài liệu nhắc tới nó đã cập nhật). File `0008_fix_fk_answers.sql` giữ nguyên. Xung đột số 0008 đã xử lý xong.
- **0009 staging:** HTTP 201. Kiểm chứng: `enrollments_insert_own` đã mất, `progress_own` đã mất (thay bằng `progress_select_own`), trigger `trg_profiles_block_role_change` tồn tại, tổng policy public **80** (81 − 2 policy bị drop + 1 policy SELECT mới — 80 là đúng, không phải thiếu).
- **0010 staging lần 1: FAIL HTTP 400 `42703: column "user_id" does not exist`** — phần (b) của file tạo policy `learning_events_select_own` với `using (user_id = auth.uid())`, nhưng bảng `learning_events` thực tế (0004) là buổi học trực tiếp gắn khóa học (chỉ có `course_id`, `lesson_id`, `title`, `starts_at`...) — KHÔNG có cột `user_id`/`event_type`/`event_data`/`occurred_at`. Toàn bộ 0010 rollback (kể cả phần (a) Storage). **Đã sửa file trước khi áp (file chưa từng áp thành công ở đâu):** bỏ phần (b), giữ nguyên phần (a); ghi rõ lý do trong file. Chạy lại 0010 staging: HTTP 201. Kiểm chứng: 5 bucket (`avatars`, `certificates`, `private`, `public`, `receipts`), 4 policy `avatars_*` trên `storage.objects`, policy public 80.
- **Prod:** 0009 HTTP 201, 0010 HTTP 201; kiểm chứng giống hệt staging (5 bucket, policy public 80).
- **Phát hiện follow-up (chưa sửa):** `apps/web/src/lib/dashboard.ts` `getMyLearningHistory()` truy vấn `learning_events` với các cột `event_type`, `event_data`, `occurred_at`, `user_id` — các cột này KHÔNG tồn tại trong bảng thật, nên trang Lịch sử học sẽ lỗi 400 khi chạy thật (không phải empty state). Lịch sử học của học viên thuộc về `activity_logs` (có `user_id`, `action`, `created_at`) hoặc `lesson_progress`. Cần sửa `dashboard.ts` ở Task 06 follow-up / Task 07, không sửa trong đợt migration này.

## 2.13. Chạy lần 5 — TASK 07: 0011 FAIL ngay trên staging (10/11/2026 22:49 +07) — DỪNG, chưa chạy 0012/0013, chưa chạy prod

- **Phạm vi đợt này:** `0011_add_lesson_notes.sql` → `0012_add_progress_fields.sql` → `0013_admin_lms.sql` (TASK 07), chạy từng file một qua Management API `POST /v1/projects/{ref}/database/query` (HTTP 201 = thành công), staging trước (`scskhplczrxlnxzruweu`), chỉ khi staging PASS hết mới lên prod (`ugynqjqyfynkmqutoarp`). Access token dùng qua biến môi trường `SUPABASE_ACCESS_TOKEN` (không ghi giá trị vào file/log/tài liệu).
- **Kiểm tra cú pháp trước khi chạy (pglast v8.7):** cả 3 file PARSE OK — 0011: 9 câu, 0012: 13 câu, 0013: 19 câu. pglast chỉ kiểm tra cú pháp, không kiểm tra ngữ nghĩa/kiểu dữ liệu — lỗi dưới đây là lỗi ngữ nghĩa chỉ lộ khi chạy thật.
- **0011 staging: FAIL HTTP 400** — lỗi nguyên văn: `ERROR: 42883: operator does not exist: information_schema.sql_identifier[] = text[] — HINT: No operator matches the given name and argument types. You might need to add explicit type casts. — QUERY: select exists (select 1 from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema where tc.table_schema = 'public' and tc.table_name = 'lessons' and tc.constraint_type = 'UNIQUE' group by tc.constraint_name having array_agg(kcu.column_name order by kcu.ordinal_position) = array['course_module_id', 'slug']) — CONTEXT: PL/pgSQL function inline_code_block line 5 at SQL statement`.
- **Nguyên nhân gốc:** khối kiểm tra (C) ở đầu 0011 so sánh `array_agg(kcu.column_name ...)` với `array['course_module_id', 'slug']`. `kcu.column_name` có kiểu `information_schema.sql_identifier`, nên `array_agg` trả về `sql_identifier[]`, không có toán tử `=` với `text[]` trên PostgreSQL 17 của project. Lỗi xảy ra ở câu lệnh đầu tiên của file, trước mọi DDL — toàn bộ 0011 rollback, không có gì được áp.
- **Hậu quả / trạng thái sau lỗi (kiểm chứng thật trên staging, HTTP 201):** `to_regclass('public.lesson_notes')` = null (chưa tồn tại), `to_regclass('public.lessons_public')` = null, số cột mới của `lesson_progress` trong 5 cột (`course_id`, `started_at`, `last_accessed`, `video_position`, `completion_status`) = 0, policy `enrollments_insert_admin` = 0. Staging giữ nguyên trạng thái sau lần 4 (0001→0010). **0012 và 0013 CHƯA CHẠY (dừng theo quy trình), prod CHƯA CHẠY gì trong đợt này.**
- **Không tự sửa file migration.** Phương án sửa cần phê duyệt trước khi chạy lại (ví dụ: ép kiểu `array_agg(kcu.column_name::text ...)` hoặc so sánh bằng `string_agg`, hoặc kiểm tra UNIQUE bằng `pg_index`/`pg_attribute` như cách 0012 mục 5 đã làm — chỉ là gợi ý, chưa chốt, chưa sửa). Sau khi sửa file (file chưa từng áp thành công ở đâu nên được sửa trước khi áp, như tiền lệ 0010 ở §2.12), chạy lại từ 0011 trên staging, kiểm chứng theo §7 rồi mới lên prod.

## 2.14. Chạy lần 6 — TASK 07: sửa 0011 + 0013 rồi chạy lại, staging + prod đều PASS (10/11/2026 ~23:00 +07, user auto-duyệt)

- **Sửa 0011 (file chưa từng áp thành công ở đâu, được sửa trước khi áp):** khối kiểm tra (C) đổi `array_agg(kcu.column_name order by ...)` → `array_agg(kcu.column_name::text order by ...)` — đúng phương án gợi ý ở §2.13. Parse lại pglast v8.7: PARSE OK, 9 câu.
- **0011 staging: PASS, HTTP 201. 0012 staging: PASS, HTTP 201.**
- **0013 staging lần 1: FAIL, HTTP 400** — lỗi nguyên văn: `ERROR: 42703: column ci.instructor_id does not exist — LINE 107: and ci.instructor_id = auth.uid()`. **Nguyên nhân gốc:** tiền đề mục (E) của 0013 sai sự thật — bảng `course_instructors` (0004 mục 20) chỉ có cột `user_id`, KHÔNG có `instructor_id`; hàm `is_instructor_of()` và 2 policy ở 0006 đã dùng `user_id` đúng từ đầu. 0013 chạy lần 1 rollback hoàn toàn, không có gì được áp.
- **Sửa 0013 (file chưa từng áp thành công ở đâu, được sửa trước khi áp):** mục (E) đổi thành kiểm tra/khẳng định lại hàm + policy với cột `user_id` đúng (giống hệt 0006, idempotent); mọi `ci.instructor_id`/`instructor_id = auth.uid()` trong code SQL → `user_id`; comment kiểm chứng cuối file sửa theo. Parse lại pglast: PARSE OK, 19 câu. Lưu ý: code app `src/lib/lms-access.ts:230` (`.eq('instructor_id', userId)`) và test `lms-admin.test.ts:333-335` (assert `ci.instructor_id`) vẫn dùng tên cột sai — đó là lỗi code app/test, ngoài phạm vi migration, cần sửa riêng.
- **Chạy lại 0013 staging: PASS, HTTP 201.**
- **Kiểm chứng staging (HTTP 201):** bảng `lesson_notes` tồn tại (1); `lesson_progress` đủ 5 cột mới (`course_id`, `started_at`, `last_accessed`, `video_position`, `completion_status`); view `lessons_public` tồn tại (1); policy admin `enrollments_insert_admin` + `audit_logs_insert_admin` có mặt (2).
- **Prod (`ugynqjqyfynkmqutoarp`, đã có 0001→0010):** 0011 → 0012 → 0013 đều **HTTP 201**. Kiểm chứng giống hệt staging trong 1 query: `lesson_notes=1, progress_cols=5, lessons_public=1, admin_policies=2`.
- **Seed tối thiểu TASK 07 trên staging** (`supabase/seed/001_seed_task07_staging.sql`): khóa 01 "Thấu Hiểu Nội Tâm" (published, từ 0002) + 1 module + 2 lesson (bài 1 video free preview, bài 2 text trả phí) + 1 resource — kiểm chứng: modules=1, lessons=2, resources=1. Lưu ý khi seed: `lesson_resources.resource_type` chỉ cho `file/link/video/document` (không có `pdf`) nên resource dùng `document`; lesson video có `video_url = NULL` vì chưa có link YouTube unlisted thật do user cung cấp, `video_duration_sec = 600` để test ngưỡng 90%.
- **Kiểm thử live end-to-end trên staging: 17/17 PASS** (script `/tmp/e2e_task07.py`, tài khoản test mới tạo qua Auth Admin API bằng service_role lấy qua Management API trong bộ nhớ — không ghi key/mật khẩu vào tài liệu): đăng nhập student A/B; ghi danh khóa miễn phí cho A (service_role, thay đường Workers API chưa deploy); B tự ghi danh trực tiếp bị RLS chặn (403); A đọc `lessons_public` không lộ `content`/`video_url`; tiến độ 300/600s → 50% `in_progress`, chưa `completed`; đánh dấu completed ở 300s bị trigger chặn (P0001, ">= 90% (hien tai % 50)"); 540/600s → 90% `completed` + `completed_at`; resume đọc lại 540s/completed; A ghi chú bài 1 (201); B không đọc được ghi chú/tiến độ của A (0 dòng); anon không đọc được resource trả phí (0 dòng); B chỉ thấy metadata bài trả phí qua `lessons_public`, không thấy `content`.

## 3. Thứ tự chạy và bảng trạng thái

### 3.1. Thứ tự bắt buộc

```
0001_init_schema.sql  (Module 1 — schema gốc: 20 bảng + RLS + VIEW quiz_options_public)
  → 0002_seed_courses.sql   (Module 1 — seed 10 khóa học)
    → 0003_seed_content.sql (Module 1 — seed 4 chính sách)
      → 0004_add_task03_tables.sql   (Task 03 — 20 bảng mới; RLS CHƯA bật — xem lưu ý dưới)
        → 0005_rename_restructure.sql (Task 03 — rename giữ dữ liệu + backfill)
          → 0006_rls_task03.sql       (Task 03 — bật RLS + policy cho 20 bảng mới)
            → 0008_fix_fk_answers.sql  (F-12 — đổi FK answers.question_id sang bảng questions thật, DROP 2 bảng tạm; chạy TRƯỚC khi chạy lại 0007)
              → 0007_fix_blockers.sql    (Task 03 — đổi tên answers/quiz_options, trigger user_roles, 5 bucket, xử lý bảng tạm, cập nhật seed 0003 — chạy LẠI sau 0008, có guard idempotent)
                → 0009_security_fixes.sql  (Task 06 — vá 3 lỗ RLS H1/H2/H3 + H4; xem §2.12)
                  → 0010_dashboard_avatar_storage.sql  (Task 06 — 4 policy Storage bucket `avatars`; xem §2.12)
                  → 0011_add_lesson_notes.sql      (TASK 07 — bảng `lesson_notes` + mở rộng `lessons.type`; xem §2.13/§2.14 — **FAIL lần 5 (42883), sửa ép kiểu `::text`, PASS lần 6 staging + prod**)
                    → 0012_add_progress_fields.sql   (TASK 07 — 5 cột mới `lesson_progress` + trigger đồng bộ/chặn gian lận; **PASS lần 6 staging + prod**)
                      → 0013_admin_lms.sql             (TASK 07 — `enrollments.granted_by`/`grant_reason`, `certificates.status`, `lessons.is_published`, RLS admin, khẳng định lại `is_instructor_of` với cột `user_id` đúng, view `lessons_public`; xem §2.14 — **FAIL lần 1 (42703, tiền đề (E) sai cột), sửa sang `user_id`, PASS lần 6 staging + prod**)
```

**Phụ thuộc từng file:**

| File | Phụ thuộc | Vì sao không chạy trước được |
|---|---|---|
| 0001 | (không) — file đầu tiên | Tạo hàm `set_updated_at()`, `current_role()`, trigger `handle_new_user()` và 20 bảng gốc mà mọi file sau dựa vào |
| 0002 | 0001 | `INSERT INTO courses` — bảng `courses` chỉ tồn tại sau 0001 |
| 0003 | 0001 | `INSERT INTO policies` — bảng `policies` chỉ tồn tại sau 0001 |
| 0004 | 0001 | FK tới `profiles`, `courses`, `lessons`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `orders` (đều ở 0001); dùng lại hàm `set_updated_at()` ở 0001 |
| 0005 | 0004 (và 0001) | Guard mục 0 tự dừng nếu thiếu bảng `course_modules`/`questions` của 0004, và dừng nếu 2 bảng mới này đã có dữ liệu (phải đang trống) |
| 0006 | 0005 (và 0004, 0001) | Hàm `course_of_lesson()` và policy `quiz_options_instructor_read` dùng tên mới `course_module_id`, `course_modules`, `questions` — chỉ đúng sau khi 0005 chạy xong. File 0006 tự ghi chú điểm này ở 2 chỗ; **không** sửa file để chạy 0006 trước 0005 |
| 0007 | 0008 + 0006 (và 0004, 0005, 0001) | Đổi tên bảng/policy/view, trigger `user_roles`, bucket, xử lý bảng tạm, cập nhật seed — tất cả đều cần bảng/policy đã tạo ở 0001–0006. **Không cứu được blocker §2.7/§2.8** (mục (a)/(b) chỉ thêm FK khi cả hai bảng đã tồn tại). Chạy sau 0006, trong cùng đợt push đầu tiên; **chạy LẠI sau 0008** (xem §2.11). |
| 0008 | 0006 (và 0005, 0004, 0001) | Sửa FK `answers.question_id` sang bảng `questions` thật + DROP 2 bảng tạm. Chỉ chạy sau 0006 (cần bảng `answers`/`questions`/`questions_new_empty` đã tồn tại sau 0005). Chạy **trước** khi chạy lại 0007. |
| 0009 | 0007 (và 0001–0006, 0008) | Vá H1–H4: trigger chặn tự đổi `profiles.role`, `REVOKE UPDATE (role)`, drop `enrollments_insert_own`, `progress_own` → SELECT-only, `profiles_insert_own` thêm `role='student'`. Chỉ chạy sau 0007 (cần trigger `trg_sync_profiles_role` và policy cũ đã tồn tại). |
| 0010 | 0007 (và 0001–0009) | 4 policy Storage bucket `avatars` + (đã bỏ) policy `learning_events_select_own` — xem §2.12. Chỉ chạy sau 0007 (cần bucket `avatars` đã tạo). |
| 0011 | 0010 (và 0001–0009) | Bảng `lesson_notes` (FK `profiles`/`lessons`) + mở rộng CHECK `lessons.type` + kiểm tra UNIQUE (`course_module_id`, `slug`) trên `lessons`. **Lần 5 (10/11/2026 22:49 +07) FAIL ngay khối kiểm tra (C) đầu file — lỗi 42883 `sql_identifier[] = text[]` (xem §2.13); chưa chạy lại.** |
| 0012 | 0011 (và 0001–0010) | 5 cột mới `lesson_progress` + backfill từ `lessons`/`course_modules` + trigger `trg_progress_sync_guard`. Chỉ chạy sau 0011 (cần `lessons.type` mở rộng để trigger phân biệt bài video). **CHƯA CHẠY — dừng sau lỗi 0011.** |
| 0013 | 0011 (và 0001–0010; 0012 nếu có) | `enrollments.granted_by`/`grant_reason`, `certificates.status`, `lessons.is_published`, RLS admin, sửa hàm `is_instructor_of()` lỗi 0006, view `lessons_public`. Chỉ chạy sau 0011 (và 0012 nếu có). **CHƯA CHẠY — dừng sau lỗi 0011.** |

**Lưu ý an toàn giữa 0004 và 0006:** 0004 chỉ tạo bảng + index, **không bật RLS và không tạo policy** — policy tập trung ở 0006. Vì vậy trong khoảng giữa 0004 và 0006, 20 bảng mới đang ở trạng thái chưa có RLS. Chạy 0004 → 0005 → 0006 **liền nhau trong cùng một phiên**, không dừng lại đi làm việc khác, không mở truy cập anon vào project, không deploy code đọc các bảng mới cho tới khi 0006 chạy xong và kiểm chứng §7 đạt.

### 3.2. Bảng trạng thái từng migration

Cập nhật bảng này sau mỗi lần chạy (ghi ngày giờ + người chạy vào cột Ghi chú). Mặc định ban đầu: **CHƯA CHẠY** toàn bộ.

| # | File | Mục đích | Phụ thuộc | Staging | Prod | Ghi chú |
|---|---|---|---|---|---|---|
| 1 | `supabase/migrations/0001_init_schema.sql` | Schema gốc Module 1: 20 bảng, index, trigger `updated_at`, RLS + 35 policy, VIEW `quiz_options_public` | — | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Xem §2.11 |
| 2 | `supabase/migrations/0002_seed_courses.sql` | Seed 10 khóa học (UUID cố định, idempotent theo `slug`) | 0001 | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Học phí 0 = miễn phí / Tùy tâm; chưa có giá khóa nào khác được công bố |
| 3 | `supabase/migrations/0003_seed_content.sql` | Seed 4 chính sách (bản tóm tắt, version 1, `is_current = true`) | 0001 | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Chỉ là tóm tắt đúng tinh thần; toàn văn chuyển vào ở module nội dung sau |
| 4 | `supabase/migrations/0004_add_task03_tables.sql` | Task 03: 20 bảng mới (`user_roles`, `categories`, `course_modules`, `lesson_resources`, `learning_events`, `quizzes`, `questions`, `answers`→`quiz_answers`, `assignments`, `submissions`, `submission_reviews`, `order_items`, `coupons`, `membership_plans`, `memberships`, `notifications`, `automation_events`, `activity_logs`, `system_settings`, `course_instructors`) | 0001 | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Xem §2.11; chưa bật RLS cho tới 0006 |
| 5 | `supabase/migrations/0005_rename_restructure.sql` | Task 03 phương án A: rename giữ dữ liệu (`modules` → `course_modules`, `quiz_questions` → `questions`, `lessons.module_id` → `course_module_id`) + backfill (`user_roles`, `order_items`, `answers`→`quiz_answers`, `quizzes`) | 0004 | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Chạy trong 1 transaction; guard mục 0; rollback xem §8 |
| 6 | `supabase/migrations/0006_rls_task03.sql` | Task 03: hàm `is_instructor_of()` / `course_of_lesson()`, bật RLS + 46 policy thật cho 20 bảng mới, 2 policy bổ sung cho bảng cũ (`quiz_options`, `profiles`) — tổng ròng sau 0001+0006 là **81 policy** (đính chính từ 48/83, xem §2.11) | 0005 | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Không chạy trước 0005; xem §2.4 về tên `quiz_options` |
| 7 | `supabase/migrations/0007_fix_blockers.sql` | Fix blocker Task 03: đổi tên `answers`→`quiz_answers`, `quiz_options`→`question_options` (+ policy + view), trigger đồng bộ `user_roles`→`profiles.role`, 5 bucket Storage, xử lý 2 bảng tạm `_new_empty`, cập nhật seed 0003 theo QĐ 9 | 0008 + 0006 | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** — chạy lại sau 0008 (lần 2 FAIL `2BP01` F-12, xem §2.10) | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Chạy LẠI sau 0008; kiểm chứng sau 0007 xem §7.8 / §2.11 |
| 8 | `supabase/migrations/0008_fix_fk_answers.sql` | F-12: đổi FK `answers.question_id` sang bảng `questions` thật (kiểm tra 0 dòng mồ côi trước), DROP 2 bảng tạm `_new_empty` (chỉ khi trống + không còn FK trỏ tới), guard idempotent | 0006 | ☑ **PASS staging lần 3 ngày 10/11/2026 (HTTP 201)** — lần 1 lỗi 42P01 ở khối kiểm chứng cuối file (đã sửa, xem §2.11), lần 2 PASS; chạy lại kiểm idempotent PASS | ☑ **PASS prod lần 3 ngày 10/11/2026 (HTTP 201)** | Chạy TRƯỚC khi chạy lại 0007; không dùng `DROP ... CASCADE` |
| 9 | `supabase/migrations/0009_security_fixes.sql` | Task 06: vá 3 lỗ RLS H1 (trigger chặn tự đổi `profiles.role` + `REVOKE UPDATE (role)`), H2 (drop `enrollments_insert_own`), H3 (`progress_own` → SELECT-only `progress_select_own`), H4 (`profiles_insert_own` thêm `role='student'`) | 0007 | ☑ **PASS staging ngày 10/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 10/11/2026 (HTTP 201)** | Xem §2.12; tổng policy public sau 0009: **80** (81 − 2 policy bị drop + 1 policy SELECT mới) |
| 10 | `supabase/migrations/0010_dashboard_avatar_storage.sql` | Task 06: 4 policy Storage bucket `avatars` (`avatars_select_public`, `avatars_insert_own`, `avatars_update_own`, `avatars_delete_own`); phần (b) `learning_events_select_own` đã bỏ trước khi áp (xem §2.12) | 0007 | ☑ **PASS staging ngày 10/11/2026 (HTTP 201)** — lần 1 FAIL 42703 do phần (b) (đã sửa file, chạy lại PASS) | ☑ **PASS prod ngày 10/11/2026 (HTTP 201)** | File cũ `0008_dashboard_avatar_storage.sql` đã đổi số thành 0010 ngày 10/11/2026 (xung đột số 0008 đã xử lý); xem §2.12 |
| 11 | `supabase/migrations/0011_add_lesson_notes.sql` | TASK 07 (1/4): bảng `lesson_notes` (1 ghi chú / 1 học viên / 1 bài học) + mở rộng CHECK `lessons.type` thêm `audio`/`image`/`pdf`/`assignment`/`webinar` + kiểm tra UNIQUE (`course_module_id`, `slug`) trên `lessons` | 0010 | ☑ **PASS staging lần 6 + ☑ PASS prod lần 6** (sửa ép kiểu `array_agg(kcu.column_name::text …)`, HTTP 201) | ☑ **PASS** | Xem §2.13 (lỗi 42883 lần 5) + §2.14 (sửa + chạy lại) |
| 12 | `supabase/migrations/0012_add_progress_fields.sql` | TASK 07 (2/4): 5 cột mới `lesson_progress` (`course_id`, `started_at`, `last_accessed`, `video_position`, `completion_status`) + backfill + trigger `trg_progress_sync_guard` (đồng bộ legacy, chặn video completed < 90%, tính lại percent) + 2 index | 0011 | ☑ **PASS staging lần 6 + ☑ PASS prod lần 6** (HTTP 201) | ☑ **PASS** | Xem §2.14 |
| 13 | `supabase/migrations/0013_admin_lms.sql` | TASK 07 (3/4): `enrollments.granted_by`/`grant_reason`, `certificates.status` (`valid`/`revoked`), `lessons.is_published`, RLS admin INSERT `enrollments`/`audit_logs`, khẳng định lại `is_instructor_of` với cột `user_id` đúng (tiền đề (E) gốc sai — `instructor_id` không tồn tại), thu hẹp SELECT `lesson_resources`, view `lessons_public` | 0011 (+ 0012) | ☑ **PASS staging lần 6 + ☑ PASS prod lần 6** (sửa sang `user_id` sau lỗi 42703 lần 1, HTTP 201) | ☑ **PASS** | Xem §2.14; code app `lms-access.ts:230` + test `lms-admin.test.ts:333-335` vẫn dùng `instructor_id` sai — cần sửa riêng, ngoài phạm vi migration |
| — | 0014–0024 | *Bảng này chưa được cập nhật cho 0014–0024 (khoảng trống có sẵn từ trước đợt này; trạng thái từng file xem DECISIONS.md QĐ 20 + CHANGELOG.md).* | — | — | — | Cần bổ sung sau |
| 25 | `supabase/migrations/0025_master_library.sql` | Thư viện Master: bảng `master_library_items` + RLS + seed 119 mục nguyên văn | — | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~15:55 +07 (HTTP 201)** — anon REST đếm 119 mục đã xuất bản | Chạy bằng `scripts/apply-migrations-0025-0031-prod.py`; kiểm chứng `scripts/verify-prod-p0.py` |
| 26 | `supabase/migrations/0026_rename_course_08.sql` | Đổi title khóa 08 → “Master Tâm thức” (giữ slug) | 0025 | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~15:55 +07 (HTTP 201)** — title = “Master Tâm thức” | Prod đã có title mới từ trước; migration xác nhận lại |
| 27 | `supabase/migrations/0027_assessments_11d.sql` | Đánh giá 11D: bảng `assessments_11d` + view `assessment_aggregates_11d` + RLS own-only | — | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~15:55 +07 (HTTP 201)** — bảng tồn tại; anon 200, 0 dòng | — |
| 28 | `supabase/migrations/0028_fix_s03_lessons_rls.sql` | **Vá S-03:** drop `lessons_select_public`, policy mới `lessons_select_enrolled` + view `lessons_preview_video` | — | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~15:55 +07 (HTTP 201)** — anon REST `lessons` = **0 dòng** (S-03 ĐÓNG trên prod) | Ưu tiên P0; xem QĐ 23 |
| 29 | `supabase/migrations/0029_ai_mentor.sql` | AI Mentor: `ai_knowledge_chunks` (138 chunk) + `ai_chat_sessions`/`ai_chat_messages` + RLS | — | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~15:55 +07 (HTTP 201)** — anon đếm 138 chunk | Policy select public có chủ đích (QA-18-SEC-02) |
| 30 | `supabase/migrations/0030_community.sql` | Cộng đồng: 4 bảng `community_posts/comments/reactions/reports` + RLS | — | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~15:55 +07 (HTTP 201)** — 4 bảng; anon 401 | — |
| 31 | `supabase/migrations/0031_gamification.sql` | Gamification: `learning_points`/`badges`/`user_badges`/`learning_streaks` + RLS | — | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~15:55 +07 (HTTP 201)** — 4 bảng; anon 401 | — |
| 32 | `supabase/migrations/0032_rename_courses_02_08.sql` | Đổi title khóa 02 → “Thấu Hiểu Tâm”, khóa 08 → “Master Thân – Tâm – Tuệ” (giữ slug), idempotent | — | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~16:19 +07 (HTTP 201)** — REST xác minh title mới cả 2 khóa | QĐ 29 |
| 33 | `supabase/migrations/0033_bo_thi_nhan_toa.sql` | Bổ sung lời giải Nhan thí + Tọa thí vào mục “7 Bố Thí Quan Trọng Đời Người” (theo slug, idempotent) | 0025 | ☑ **PASS staging ngày 11/11/2026 (HTTP 201)** | ☑ **PASS prod ngày 11/11/2026 ~16:30 +07 (HTTP 201)** — REST xác minh content dài 1032 ký tự, bắt đầu bằng lời giải Nhan thí mới | QĐ 34 |

## 4. Cách A — Chạy bằng Supabase Dashboard SQL Editor

Dùng cách này khi không cài CLI, hoặc khi muốn nhìn thấy từng kết quả chạy trực tiếp trên dashboard. Mỗi file chạy **một lần, toàn bộ nội dung, theo đúng thứ tự §3.1**.

### 4.1. Các bước chung (lặp lại cho từng file, từng project)

1. Vào Supabase Dashboard → chọn đúng project (**kiểm tra tên project trên góc màn hình — nhầm staging/prod là lỗi cấm**; kiểm tra 2 lần trước file đầu tiên).
2. Mở **SQL Editor** → **New query**.
3. Mở file migration tương ứng trong repo, copy **toàn bộ** nội dung, dán vào ô query. Không chạy từng đoạn rời rạc, không bỏ đoạn nào (kể cả khối kiểm tra cuối file — đó là ghi chú, không phải lệnh chạy).
4. Bấm **Run**. Đợi chạy xong hoàn toàn mới làm bước tiếp theo.
5. Đọc kết quả: phải hiện `Success. No rows returned` (hoặc thông báo `NOTICE` của các khối kiểm tra trong 0005 — ghi lại các con số `NOTICE` để đối chiếu §7). Nếu hiện lỗi (màu đỏ) → **dừng ngay**, xử lý theo §8, không chạy file tiếp theo.
6. Chạy kiểm chứng của file đó ở §7 ngay sau khi file báo thành công. Chỉ khi kiểm chứng đạt mới chạy file tiếp theo.
7. Đánh dấu vào bảng §3.2 (cột Staging hoặc Prod) + ghi ngày giờ chạy.

### 4.2. Lưu ý riêng từng file khi chạy bằng Dashboard

- **0001:** file dài (575 dòng), có 35 `CREATE POLICY` không có `IF NOT EXISTS`. Nếu file chạy dở rồi lỗi (xem blocker §2.1), **không chạy lại toàn bộ file** — chạy lại sẽ lỗi trùng policy ở những policy đã tạo. Khi đó: kiểm tra xem những gì đã tạo được (theo §7.1), sửa lỗi gốc, rồi chỉ chạy phần còn thiếu — hoặc xóa project staging làm lại từ đầu (chỉ staging mới được làm vậy; prod thì xử lý theo §8).
- **0002 / 0003:** idempotent (`ON CONFLICT ... DO UPDATE` / `DO NOTHING`) — chạy lại an toàn, không tạo trùng. Đây là 2 file duy nhất được phép chạy lại toàn bộ.
- **0004:** file dài (541 dòng), các bảng dùng `IF NOT EXISTS` nên chạy lại phần bảng thì an toàn; nhưng nếu lỗi ở §2.2 rồi chạy lại sau khi sửa, kiểm tra kỹ những bảng đã tạo trước điểm lỗi để không bỏ sót index/trigger `updated_at` ở cuối file.
- **0005:** file bọc trong một transaction `BEGIN ... COMMIT`. SQL Editor có thể tự commit từng lệnh thay vì giữ nguyên transaction — chính file 0005 cũng ghi chú điểm này: nếu SQL Editor tự commit từng lệnh, hãy chạy **từng mục theo thứ tự** (mục 0 → 1 → 2 → 3 → 4 → 5 → 6) và **dừng ngay khi gặp lỗi**. Đọc kỹ mọi dòng `NOTICE` sau khi chạy: mục 1, 3, 4, 5, 6 đều in số dòng để đối chiếu (§7.5). Nếu guard mục 0 báo lỗi (`0004 chưa chạy` hoặc `course_modules/questions đã có dữ liệu`) thì **không cố chạy tiếp** — đó là tín hiệu dừng có chủ đích.
- **0006:** 48 `CREATE POLICY` không có `DROP POLICY IF EXISTS` đi kèm. File tự ghi: muốn chạy lại trên staging thì thêm `DROP POLICY IF EXISTS <tên> ON public.<bảng>;` trước mỗi `CREATE POLICY`. Không chạy lại toàn bộ file nguyên trạng — sẽ lỗi trùng policy.

## 5. Cách B — Chạy bằng Supabase CLI

Dùng cách này khi đã cài CLI và muốn có lịch sử migration được ghi tự động. CLI ghi mỗi file đã chạy vào `supabase_migrations.schema_migrations` nên lần sau chỉ chạy file mới.

### 5.1. Đưa 0004–0006 vào thư mục migration — ✅ ĐÃ XONG (10/11/2026)

3 file đã có trong `supabase/migrations/` (bản sao ở `docs/database/DATABASE_MIGRATIONS/` vẫn còn, `diff` giống hệt nhau). Các lệnh dưới đây chỉ giữ lại để đối chiếu khi cần làm lại — **không cần chạy lại**:

```bash
# Đứng ở thư mục gốc repo visfar-academy-platform
cp docs/database/DATABASE_MIGRATIONS/0004_add_task03_tables.sql supabase/migrations/
cp docs/database/DATABASE_MIGRATIONS/0005_rename_restructure.sql supabase/migrations/
cp docs/database/DATABASE_MIGRATIONS/0006_rls_task03.sql supabase/migrations/

# Kiểm tra: phải có đủ 7 file, đúng thứ tự tên (thêm 0007)
ls -1 supabase/migrations/
# Kỳ vọng:
#   0001_init_schema.sql
#   0002_seed_courses.sql
#   0003_seed_content.sql
#   0004_add_task03_tables.sql
#   0005_rename_restructure.sql
#   0006_rls_task03.sql
#   0007_fix_blockers.sql
```

Lưu ý: đây là **copy, không phải move** — bản gốc vẫn ở `docs/database/DATABASE_MIGRATIONS/` để đối chiếu. Bản chính là `supabase/migrations/`; mọi sửa sau này (kể cả phương án §2.9) chỉ sửa ở đó, rồi đồng bộ lại nếu cần.

### 5.2. Chạy lên staging

```bash
# 1. Liên kết tới project staging (project ref lấy theo §1.2)
supabase link --project-ref <project-ref-staging>

# 2. Xem migration nào đã chạy / chưa chạy trên staging
supabase migration list

# 3. Đẩy toàn bộ migration chưa chạy lên staging, theo đúng thứ tự tên file
supabase db push

# 4. Kiểm tra lại danh sách đã áp dụng
supabase migration list
```

- `supabase db push` chạy các file chưa có trong `schema_migrations`, theo thứ tự tên file — đúng thứ tự §3.1 nếu tên file giữ nguyên.
- `db push` sẽ dừng ở file lỗi đầu tiên và không chạy các file sau — đúng hành vi cần thiết. Xử lý lỗi theo §8 rồi chạy lại `db push` (chỉ những file chưa áp dụng mới chạy tiếp).
- Sau `db push` đạt: chạy toàn bộ kiểm chứng §7 trên staging, đánh dấu bảng §3.2, rồi mới làm §5.3.

### 5.3. Chạy lên prod (chỉ sau khi staging đạt + đã backup theo §6)

```bash
# 1. Liên kết tới project prod — KIỂM TRA LẠI project ref, khác với staging
supabase link --project-ref <project-ref-prod>

# 2. Xem migration nào đã chạy / chưa chạy trên prod
supabase migration list

# 3. Đẩy migration lên prod
supabase db push

# 4. Kiểm tra lại danh sách đã áp dụng
supabase migration list
```

### 5.4. (Tùy chọn, nên làm) Chạy thử local trước khi chạm staging

Nếu máy đã cài CLI + Docker đang chạy:

```bash
supabase start     # khởi động Supabase local
supabase db reset  # áp toàn bộ migration trong supabase/migrations/ lên DB local
```

- `db reset` **chỉ chạy trên máy local** — không bao giờ chạy lệnh này khi đang link tới project staging/prod (nó sẽ reset database đó).
- Chạy thử local giúp bắt sớm lỗi kiểu §2.1/§2.2 mà không tốn lượt thử trên staging. Nếu local lỗi, sửa file rồi chạy lại `db reset` cho tới khi đạt, rồi mới lên staging.
- Kiểm chứng local bằng cùng các câu SQL ở §7 (trỏ psql/SQL Editor tới DB local do `supabase start` cấp).

### 5.5. Đường vòng — chạy qua Management API khi CLI `db push` bị chặn mạng (đã kiểm chứng 10/11/2026)

**Khi nào dùng:** khi `supabase db push --remote` thất bại với lỗi SSL ở bước kết nối Postgres trực tiếp — tức mạng của máy chạy chặn Postgres wire protocol (`db.<ref>.supabase.co:5432`), chỉ cho HTTPS qua. Đã xảy ra thật ngày 10/11/2026 (`BACKEND_TEST_REPORT.md` §5A, S-03): lỗi "There was an error establishing an SSL connection", host resolve ra `198.18.212.57`. Đây là lỗi môi trường mạng, **không phải lỗi migration**.

**Đường vòng đã kiểm chứng hoạt động (S-04):** Supabase Management API qua HTTPS:

```
POST https://api.supabase.com/v1/projects/{ref}/database/query
```

- Xác thực bằng access token (dùng qua **biến môi trường**, không ghi token vào file hay tài liệu — xem §1.5).
- Kiểm chứng: `select version()` trả về **PostgreSQL 17.11**.
- Lần chạy thật đầu tiên (S-05) đã dùng đường này để chạy 0001: lỗi `42P01` (xem §2.8), file chạy trong 1 transaction nên rollback hoàn toàn, staging còn 0 bảng.

**Cách chạy bằng đường vòng (mỗi file một lần, đúng thứ tự §3.1):**

1. Gửi toàn bộ nội dung 1 file migration làm 1 query tới endpoint trên (project ref của đúng project — kiểm tra 2 lần staging/prod trước file đầu tiên).
2. Đợi chạy xong hoàn toàn. Đọc kết quả: thành công thì chạy kiểm chứng §7 của file đó ngay; lỗi thì **dừng ngay**, xử lý theo §8, không chạy file tiếp theo.
3. Ghi vào bảng §3.2 (cột Staging hoặc Prod) + ngày giờ chạy — **bắt buộc**, vì lý do dưới đây.

**⚠️ Giới hạn quan trọng của đường vòng — đọc kỹ:**

- Chạy SQL bằng tay qua API **không ghi gì vào bảng `supabase_migrations.schema_migrations`** của CLI. CLI sẽ không biết file nào đã chạy — nếu sau này chạy `supabase db push`, CLI sẽ thử chạy lại các file chưa được ghi nhận và lỗi trùng (policy/bảng đã tồn tại).
- Vì vậy: **một project — một cách chạy** (nguyên tắc 4 ở §0). Nếu đã bắt đầu đợt push bằng Management API thì **chạy hết cả 7 file bằng API**, tự theo dõi bằng bảng §3.2, không chuyển sang CLI giữa chừng. Chỉ chuyển sang CLI khi đã xử lý xong việc ghi nhận (ví dụ dùng `supabase migration repair` để đánh dấu các version đã áp dụng — làm riêng, có biên bản, và thử trên staging trước).
- Ngoài ra, trước lần chạy §5A, `supabase/config.toml` đã phải sửa: bỏ khối `[api.external_url]` trống gây lỗi parse cho CLI (`git diff` xác nhận chỉ xóa đúng 1 dòng này). Sau khi sửa, CLI chạy được tới bước kết nối nhưng vẫn bị chặn ở bước kết nối Postgres — tức sửa config chỉ hết lỗi parse, không hết lỗi mạng.

## 6. Backup trước khi chạy prod

**Bắt buộc trước khi chạy bất kỳ file nào lên prod** (kể cả 0001 — prod là database trống thì backup vẫn là thói quen bắt buộc; sau này khi đã có dữ liệu thật thì backup là đường sống duy nhất). Chi tiết đầy đủ xem `BACKUP_GUIDE.md` §4 và §8 — dưới đây chỉ là bước tối thiểu cho lần chạy migration này.

### 6.1. Dump prod bằng CLI (cách chính)

```bash
# Đứng ở thư mục làm việc an toàn (không phải repo code chính — file backup
# chứa dữ liệu, không commit vào repo code).
# <db-url-prod> là connection string Postgres của project prod
# (Dashboard → Settings → Database; dùng direct connection, cổng 5432).
# Mật khẩu nằm trong connection string — không dán connection string
# thật vào chat, tài liệu hay ảnh chụp màn hình.
supabase db dump --db-url "<db-url-prod>" -f "backup-truoc-migration-YYYY-MM-DD-HHMM.sql"

# Kiểm tra file backup: tồn tại, dung lượng > 0
ls -lh backup-truoc-migration-*.sql
```

- Đặt tên file theo mẫu `backup-truoc-migration-YYYY-MM-DD-HHMM.sql` (giờ Việt Nam), ghi tên file + thời điểm vào biên bản chạy (ghi chú ở bảng §3.2).
- Ngoài file dump tay này, workflow backup hàng ngày theo `BACKUP_GUIDE.md` §4 (chạy tay bằng `workflow_dispatch` trước giờ migration) là lớp backup thứ hai — làm cả hai khi prod đã có dữ liệu thật.
- **Giới hạn cần biết:** `pg_dump`/`supabase db dump` chỉ dump schema `public` + dữ liệu. Tài khoản đăng nhập trong `auth.users` và cấu hình Auth/Storage nằm ngoài file dump (xem `BACKUP_GUIDE.md` §2) — sau restore cần kiểm tra đăng nhập bằng tài khoản test.

### 6.2. Ghi số dòng đối chiếu trước khi chạy prod

Trước khi chạy file đầu tiên lên prod, ghi lại số dòng các bảng chính (chỉ `SELECT`, không ghi):

```sql
SELECT 'courses' AS bang, count(*) FROM courses
UNION ALL SELECT 'policies', count(*) FROM policies
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'leads', count(*) FROM leads
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'enrollments', count(*) FROM enrollments;
```

- Với lần chạy đầu tiên (prod trống): kỳ vọng toàn 0. Con số này là "ảnh trước" để đối chiếu sau mỗi file — đặc biệt sau 0005 (số dòng `course_modules` phải bằng số dòng `modules` cũ, `questions` bằng `quiz_questions` cũ).
- Lưu kết quả kèm ngày giờ vào biên bản chạy.

## 7. Kiểm chứng sau mỗi migration

Chạy các câu SQL dưới đây trong **SQL Editor của đúng project vừa chạy** (staging hoặc prod). "Kỳ vọng" là giá trị đếm trực tiếp từ file migration và `DECISIONS.md` — nếu kết quả khác kỳ vọng thì **dừng lại, không chạy file tiếp theo**, xử lý theo §8.

### 7.1. Sau 0001 — schema gốc

```sql
-- 1. Tổng số bảng = 20
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Kỳ vọng: 20

-- 2. Đủ 20 bảng gốc
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles','courses','modules','lessons','quiz_questions',
    'quiz_options','enrollments','lesson_progress','quiz_attempts',
    'certificates','leads','orders','payments','events',
    'event_registrations','posts','policies','email_logs',
    'newsletter_subscribers','audit_logs');
-- Kỳ vọng: 20 dòng

-- 3. RLS bật trên mọi bảng (0 bảng chưa bật)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Kỳ vọng: 0 dòng

-- 4. Số policy = 35
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
-- Kỳ vọng: 35

-- 5. VIEW công khai không có is_correct tồn tại
SELECT viewname FROM pg_views
WHERE schemaname = 'public' AND viewname = 'quiz_options_public';
-- Kỳ vọng: 1 dòng
-- (Nếu đã thực hiện §2.4 phương án (a) đổi tên thành question_options,
--  kiểm tra tên VIEW mới tương ứng thay cho tên này.)
```

### 7.2. Sau 0002 — seed 10 khóa học

```sql
-- 1. Số khóa học = 10
SELECT count(*) FROM public.courses;
-- Kỳ vọng: 10

-- 2. Đủ 10 slug, đúng thứ tự hiển thị 1–10
SELECT display_order, slug, title FROM public.courses ORDER BY display_order;
-- Kỳ vọng (theo đúng thứ tự):
--   1 thau-hieu-noi-tam | 2 thau-hieu-tam-thuc | 3 thau-hieu-tri-tue
--   4 thau-hieu-suc-khoe | 5 thau-hieu-moi-quan-he | 6 thau-hieu-tai-chinh
--   7 chuyen-gia-tu-van | 8 master-tam-thuc-nhan-hieu
--   9 coaching-90-ngay | 10 cong-dong-visfar

-- 3. Tất cả đều published, học phí 0 (miễn phí / Tùy tâm)
SELECT count(*) FROM public.courses
WHERE status = 'published' AND price_vnd = 0;
-- Kỳ vọng: 10
```

### 7.3. Sau 0003 — seed 4 chính sách

```sql
-- 1. Số chính sách = 4, đều là bản hiện tại, version 1
SELECT slug, title, version, is_current FROM public.policies ORDER BY slug;
-- Kỳ vọng: 4 dòng —
--   bao-mat | dieu-khoan-tham-gia | hoan-tra-huy-dang-ky | giai-quyet-khieu-nai
--   (version = 1, is_current = true cho cả 4)

-- 2. Nội dung chỉ là bản tóm tắt — kiểm tra bằng mắt rằng body có câu
--    "Tóm tắt đúng tinh thần" và "Toàn văn đầy đủ sẽ được chuyển vào".
--    Toàn văn đầy đủ KHÔNG nằm trong seed này (chuyển vào ở module nội dung sau).
```

Lưu ý: nội dung seed 0003 có ghi chú "khung thời gian xử lý … CHƯA được user duyệt". Ghi chú này đã cũ — `DECISIONS.md` quyết định 9 đã chốt: hoàn trả **15 ngày làm việc**, khiếu nại phản hồi **3 ngày**. Khi chuyển toàn văn chính sách vào ở module nội dung, dùng khung đã chốt này, không dùng khung trong ghi chú seed.

### 7.4. Sau 0004 — 20 bảng mới

```sql
-- 1. Tổng số bảng = 40 (20 cũ + 20 mới)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Kỳ vọng: 40

-- 2. Đủ 20 bảng mới
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_roles','categories','course_modules',
    'lesson_resources','learning_events','quizzes','questions',
    'answers','assignments','submissions','submission_reviews',
    'order_items','coupons','membership_plans','memberships',
    'notifications','automation_events','activity_logs',
    'system_settings','course_instructors');
-- Kỳ vọng: 20 dòng
-- (Nếu đã thực hiện §2.3 đổi tên answers → quiz_answers trước khi chạy,
--  danh sách trên dùng 'quiz_answers' thay cho 'answers' — vẫn 20 dòng.)

-- 3. Hai bảng mới course_modules / questions ĐANG TRỐNG (điều kiện bắt buộc
--    để 0005 chạy được — guard mục 0 của 0005 sẽ tự dừng nếu khác 0)
SELECT (SELECT count(*) FROM public.course_modules) AS course_modules_moi,
       (SELECT count(*) FROM public.questions) AS questions_moi;
-- Kỳ vọng: 0 | 0

-- 4. Bảng cũ vẫn còn nguyên, song song với bảng mới (đây là có chủ đích)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('modules','quiz_questions');
-- Kỳ vọng: 2 dòng (modules và quiz_questions vẫn tồn tại cho tới khi 0005 chạy)

-- 5. RLS CHƯA bật trên 20 bảng mới — đúng thiết kế (RLS ở 0006)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Kỳ vọng: 20 dòng (đúng 20 bảng mới ở câu 2).
-- Nếu khác 20 dòng thì có bảng cũ bị tắt RLS nhầm — dừng lại kiểm tra.
```

### 7.5. Sau 0005 — rename giữ dữ liệu + backfill

Đối chiếu với số dòng đã ghi ở §6.2 (trước khi chạy) và với các dòng `NOTICE` mà 0005 in ra khi chạy. **Mọi phép so sánh dưới đây đều phải bằng nhau — lệch 1 dòng cũng phải dừng lại đối soát tay, không tự sửa số liệu.**

```sql
-- 1. Tên bảng cũ không còn (dạng bảng thật)
SELECT table_name FROM pg_tables
WHERE schemaname = 'public' AND table_name IN ('modules','quiz_questions');
-- Kỳ vọng: 0 dòng
-- (Ngoại lệ: nếu có tạo VIEW tên cũ ở mục 7 của 0005 — mặc định file để
--  comment, không tạo — thì tên cũ xuất hiện ở pg_views, không phải pg_tables.
--  Kiểm tra riêng: SELECT viewname FROM pg_views WHERE viewname IN ('modules','quiz_questions');)

-- 2. Rename modules → course_modules: số dòng giữ nguyên
SELECT count(*) FROM public.course_modules;
-- Kỳ vọng: = số dòng bảng modules cũ (đã ghi ở §6.2 / NOTICE mục 1 của 0005)

-- 3. Rename quiz_questions → questions: số dòng giữ nguyên, không câu nào mất quiz
SELECT count(*) FROM public.questions;
-- Kỳ vọng: = số dòng bảng quiz_questions cũ
SELECT count(*) FROM public.questions WHERE quiz_id IS NULL;
-- Kỳ vọng: 0 (mọi câu hỏi đều đã gắn được quiz; nếu > 0 thì 0005 đã tự
-- RAISE EXCEPTION ở mục 3c và dừng — không chạy tiếp)

-- 4. Đổi tên cột lessons.module_id → course_module_id
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'lessons'
  AND column_name IN ('module_id','course_module_id');
-- Kỳ vọng: chỉ còn 'course_module_id' (1 dòng)

-- 5. Hai bảng tạm *_new_empty tồn tại và ĐANG TRỐNG
SELECT (SELECT count(*) FROM public.course_modules_new_empty) AS cm_tam,
       (SELECT count(*) FROM public.questions_new_empty) AS q_tam;
-- Kỳ vọng: 0 | 0
-- Hai bảng này chỉ là "bằng chứng thiết kế" của phương án A mặc định.
-- Chỉ xóa chúng ở migration dọn dẹp sau khi code đã chuyển hết sang tên mới
-- (cần phê duyệt riêng — xem §9). Không xóa ngay trong đợt này.

-- 6. Backfill user_roles: đủ 1 dòng / 1 profile
SELECT (SELECT count(*) FROM public.profiles) AS profiles,
       (SELECT count(DISTINCT user_id) FROM public.user_roles) AS user_roles;
-- Kỳ vọng: 2 con số bằng nhau (và NOTICE mục 5 của 0005 báo OK).
-- Nếu user_roles thiếu: có profile mang role không thuộc
-- ('student','instructor','admin') — đối soát tay, không tự sửa role.

-- 7. Backfill order_items: mỗi đơn có course_id đều có 1 dòng hàng
SELECT (SELECT count(*) FROM public.orders WHERE course_id IS NOT NULL) AS don_co_khoa,
       (SELECT count(DISTINCT order_id) FROM public.order_items) AS don_co_dong_hang;
-- Kỳ vọng: 2 con số bằng nhau (và NOTICE mục 6 của 0005 báo OK)

-- 8. Backfill quiz_answers (tên trong file hiện tại: answers):
--    chỉ kiểm tra được khi quiz_attempts.answers (jsonb) đúng dạng object
--    {"<question_id>": "<option_id>", ...}. Nếu jsonb có dạng khác,
--    0005 ghi NOTICE "0 dòng" và GIỮ NGUYÊN jsonb gốc — khi đó đối soát
--    tay, không tự đoán dạng jsonb để backfill.
SELECT count(*) FROM public.quiz_answers;
-- (Tên trong file hiện tại là public.answers — dùng tên đó nếu chưa thực
--  hiện §2.3. Kỳ vọng: = số dòng NOTICE mục 4 của 0005 đã in ra.)

-- 9. Dữ liệu gốc được giữ nguyên, không mất dòng
SELECT (SELECT count(*) FROM public.lessons) AS lessons,
       (SELECT count(*) FROM public.quiz_attempts) AS quiz_attempts,
       (SELECT count(*) FROM public.orders) AS orders;
-- Kỳ vọng: bằng đúng số dòng đã ghi ở §6.2 trước khi chạy 0005
-- (quiz_attempts.answers jsonb vẫn còn nguyên — 0005 không xóa)
```

### 7.6. Sau 0006 — RLS + policy (kiểm chứng cuối cùng của cả đợt)

```sql
-- 1. Tổng số bảng = 40 (20 Module 1 + 20 Task 03).
--    Trong đó 38 bảng nghiệp vụ + 2 bảng tạm *_new_empty (xem §7.5 mục 5).
--    Chỉ sau migration dọn dẹp (chưa có trong bộ 6 file, cần phê duyệt riêng)
--    xóa 2 bảng tạm thì tổng mới còn đúng 38 bảng vật lý theo DECISIONS.md.
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Kỳ vọng: 40

-- 2. RLS bật trên mọi bảng nghiệp vụ.
--    Ngoại lệ duy nhất được phép: 2 bảng tạm *_new_empty (chưa có RLS
--    vì chúng không phải bảng nghiệp vụ và sẽ bị xóa ở migration dọn dẹp).
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Kỳ vọng: đúng 2 dòng — course_modules_new_empty, questions_new_empty.
-- Nếu có tên bảng nào khác trong kết quả → RLS chưa bật đủ — dừng lại.

-- 3. Tổng số policy = 83 (35 ở 0001 + 48 ở 0006)
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
-- Kỳ vọng: 83

-- 4. Không có policy INSERT/UPDATE/DELETE cho anon trên leads/orders/payments
--    (khẳng định trong 0006 mục 4 — chạy đúng câu trong file 0006)
SELECT policyname, tablename, cmd FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('leads','orders','payments')
  AND cmd IN ('INSERT','UPDATE','DELETE')
  AND roles::text LIKE '%anon%';
-- Kỳ vọng: 0 dòng

-- 5. Bảng đáp án đúng (quiz_options) chỉ có đúng 2 policy SELECT:
--    admin (0001) + instructor khóa phụ trách (0006 mục 3a).
--    Không có policy SELECT nào mở cho mọi authenticated user.
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quiz_options' AND cmd = 'SELECT';
-- Kỳ vọng: 2 dòng — "quiz_options_admin_all" và "quiz_options_instructor_read"
-- (Nếu đã thực hiện §2.4 đổi tên thành question_options thì tablename
--  và tên policy đổi tương ứng.)

-- 6. RLS bật trên đủ 20 bảng mới (0006 mục 1)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_roles','categories','course_modules',
    'lesson_resources','learning_events','quizzes','questions',
    'answers','assignments','submissions','submission_reviews',
    'order_items','coupons','membership_plans','memberships',
    'notifications','automation_events','activity_logs',
    'system_settings','course_instructors')
  AND rowsecurity = false;
-- Kỳ vọng: 0 dòng
-- (Tên 'answers' đổi thành 'quiz_answers' nếu đã thực hiện §2.3.)

-- 7. Kiểm thử hành vi bằng tài khoản thật trên staging (bắt buộc trước prod):
--    - Đăng nhập bằng 1 tài khoản student: SELECT trực tiếp quiz_options
--      phải bị từ chối; SELECT từ quiz_options_public phải trả về KHÔNG có
--      cột is_correct; SELECT đơn/progress/answers của student khác
--      phải trả về 0 dòng; INSERT INTO leads/orders/payments trực tiếp
--      phải bị từ chối.
--    - Đăng nhập bằng 1 tài khoản instructor chưa được gán khóa X:
--      SELECT progress/quiz_options/submissions của khóa X phải trả 0 dòng.
--    - Sau khi admin gán instructor vào khóa X (bảng course_instructors):
--      instructor đọc được đáp án đúng + SĐT/email học viên của khóa X,
--      và không đọc được khóa khác.
--    Chi tiết 12 ca kiểm thử xem RLS_POLICIES.md §8.
```

### 7.7. Số liệu tổng kết sau cả 7 migration (ghi vào biên bản chạy)

| Hạng mục | Kỳ vọng sau 0007 | Ghi chú |
|---|---|---|
| Tổng số bảng (kể cả bảng tạm) | **38** | 20 (0001) + 20 (0004) − 2 bảng tạm đã DROP ở 0007 (nếu trống); nếu bảng tạm có dữ liệu thì 0007 giữ lại + bật RLS, tổng vẫn 40 — xem §7.8 mục 1 |
| Bảng nghiệp vụ (trừ 2 bảng tạm) | **38** | Đúng con số `DECISIONS.md` phê duyệt Task 03 (31 + 2 + 5) |
| Bảng tạm chờ dọn dẹp | 0 (đã DROP ở 0007 nếu trống) | Nếu còn thì do có dữ liệu — 0007 đã bật RLS cho chúng, đối soát tay trước khi xóa (§9) |
| Số khóa học seed | **10** | 0002 |
| Số chính sách seed | **4** | 0003 (nội dung đã cập nhật theo QĐ 9 ở 0007 mục (h)) |
| Tổng số policy RLS | **83** (35 + 48, ròng — 0007 chỉ đổi tên policy cũ) | 0001 + 0006; `grep "create policy"` đếm 86 dòng khớp vì 0007 có 3 dòng drop + tạo lại để đổi tên |
| Bảng chưa bật RLS | 0 | Mọi bảng (nghiệp vụ + tạm còn lại) đều bật RLS sau 0007 |
| Tên bảng đáp án học viên | `quiz_answers` | Sau 0007 mục (c) (trước đó file ghi `answers`) |
| Tên bảng lựa chọn câu hỏi | `question_options` | Sau 0007 mục (d) (trước đó file ghi `quiz_options`) |

### 7.8. Sau 0007 — kiểm chứng cuối cùng của cả đợt (mới, 10/11/2026)

Chạy sau khi 0007 báo thành công (qua CLI hoặc Management API — xem §5.5). Kỳ vọng dưới đây khớp với khối kiểm chứng cuối file 0007 và với C-29 trong `BACKEND_TEST_REPORT.md`.

```sql
-- 1. Tổng số bảng = 38 (2 bảng tạm đã DROP nếu trống)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Kỳ vọng: 38. Nếu = 40 thì 2 bảng tạm vẫn còn — đối soát theo 0007 mục (g)
-- (còn vì có dữ liệu, đã bật RLS) rồi mới xóa tay sau khi đối soát.

-- 2. Tên mới tồn tại, tên cũ không còn
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('quiz_answers','question_options','answers','quiz_options');
-- Kỳ vọng: 2 dòng — quiz_answers, question_options.

-- 3. Trigger đồng bộ user_roles tồn tại
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.user_roles'::regclass
  AND tgname = 'trg_sync_profiles_role' AND NOT tgisinternal;
-- Kỳ vọng: 1 dòng.

-- 4. FK (a)/(b) tồn tại — chỉ có khi 0001/0004 đã sửa thứ tự (§2.9) và
--    bảng enrollments / order_items đã được tạo đầy đủ
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.enrollments'::regclass AND contype = 'f'
  AND confrelid = 'public.orders'::regclass;
-- Kỳ vọng: 1 dòng — enrollments_order_id_fkey.
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.order_items'::regclass AND contype = 'f'
  AND confrelid = 'public.membership_plans'::regclass;
-- Kỳ vọng: 1 dòng — order_items_membership_plan_id_fkey.

-- 5. UNIQUE mới trên quiz_answers (hỗ trợ multiple-choice)
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.quiz_answers'::regclass AND contype = 'u'
  AND conname = 'quiz_answers_attempt_question_option_key';
-- Kỳ vọng: 1 dòng.

-- 6. View mới tồn tại, view cũ không còn
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('question_options_public','quiz_options_public');
-- Kỳ vọng: 1 dòng — question_options_public.

-- 7. Đủ 5 bucket Storage
SELECT id, public FROM storage.buckets
WHERE id IN ('public','avatars','private','receipts','certificates') ORDER BY id;
-- Kỳ vọng: 5 dòng — public/avatars public = true;
--   private/receipts/certificates public = false.
-- (Policy Storage chi tiết vẫn chưa có — xem §2.6/F-05; bucket tồn tại
--  không có nghĩa là policy đã xong.)

-- 8. Tổng policy ròng vẫn 83 (0007 chỉ đổi tên policy cũ, không thêm policy mới)
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
-- Kỳ vọng: 83.

-- 9. Seed 0003 đã cập nhật theo QĐ 9 (không còn cụm "CHƯA được user duyệt")
SELECT slug FROM public.policies
WHERE is_current = true AND body LIKE '%CHƯA được user duyệt%';
-- Kỳ vọng: 0 dòng.

-- 10. RLS bật trên mọi bảng (0 bảng chưa bật)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Kỳ vọng: 0 dòng (2 bảng tạm đã DROP; nếu bảng tạm còn lại do có dữ liệu
-- thì 0007 mục (g) đã bật RLS cho chúng).
```

## 8. Rollback khi migration lỗi

### 8.1. Nguyên tắc

- **Rollback 0005 chỉ làm được khi CHƯA có dữ liệu mới ghi vào tên mới.** "Dữ liệu mới" nghĩa là: đăng ký, nộp quiz, đơn hàng, bài nộp… phát sinh sau khi 0005 chạy xong. Nếu đã có dữ liệu mới, **không rollback theo cách dưới đây** — phải backfill ngược dữ liệu mới về tên cũ trước, rồi mới rename ngược. Kế hoạch backfill ngược này cần duyệt riêng trước khi chạy prod.
- **Không reset main, không xóa dữ liệu nghiệp vụ** (nguyên tắc 6 ở §0). Rollback ở đây là rename ngược + xóa dữ liệu backfill do chính 0005 sinh ra — không phải xóa database, không phải `DROP TABLE` bảng nghiệp vụ.
- **Staging lỗi thì dừng, không chạy prod.** Lỗi trên staging xử lý xong, chạy lại staging đạt hết §7 rồi mới nghĩ tới prod.
- **Prod lỗi thì 1 trong 2 hướng** (quyết theo mức độ, ghi biên bản — xem `BACKUP_GUIDE.md` §8): (a) sửa bằng migration mới (không sửa migration cũ đã chạy) rồi chạy tiếp trên staging trước; hoặc (b) restore database từ file backup ở §6 (xem `BACKUP_GUIDE.md` §7.3). Không tự ý chọn hướng (b) mà không báo admin.

### 8.2. Rollback 0005 — rename ngược (theo mục 8 trong file 0005)

Chỉ chạy khi đủ điều kiện ở §8.1 (chưa có dữ liệu mới ở tên mới). Chạy **trên staging trước**, trong 1 transaction, theo đúng thứ tự ngược:

```sql
begin;

-- 8a. Xóa dữ liệu backfill do chính file 0005 sinh ra
--     (chỉ khi dữ liệu đó do file này sinh ra, chưa có dữ liệu mới từ API)
delete from public.quiz_answers;   -- tên trong file hiện tại: public.answers
delete from public.order_items;    -- backfill mục 6
delete from public.user_roles;     -- backfill mục 5

-- 8b. Xóa quiz tạo thêm ở mục 3a (chỉ quiz do file này tạo):
--     đối soát bằng created_at / tiêu đề 'Quiz — ...' trước khi xóa;
--     KHÔNG xóa quiz do người dùng tạo sau đó.

-- 8c. Rename ngược
alter table public.questions rename to quiz_questions;
alter table public.questions_new_empty rename to questions;
alter table public.course_modules rename to modules;
alter table public.course_modules_new_empty rename to course_modules;
alter table public.lessons rename column course_module_id to module_id;

-- 8d. Bỏ các cột thêm ở mục 1c/3 (nếu muốn về đúng trạng thái cũ)
alter table public.modules
  drop column if exists slug,
  drop column if exists description,
  drop column if exists is_free_preview,
  drop column if exists is_published;
alter table public.quiz_questions
  drop column if exists quiz_id,
  drop column if exists question_type,
  drop column if exists explanation,
  drop column if exists points;

commit;
```

Sau rollback: chạy lại kiểm chứng §7.1–§7.3 (20 bảng gốc, tên cũ `modules`/`quiz_questions` trở lại, 10 khóa, 4 chính sách) để xác nhận đã về đúng trạng thái trước 0005.

### 8.3. Lỗi ở các file khác

| File lỗi | Xử lý |
|---|---|
| 0001 | Dừng. Không chạy file sau. Kiểm tra §2.1/§2.7(a) và **§2.8 (lỗi thật đã xảy ra: `42P01` ở hàm `current_role()`, S-05)**. Vì policy không idempotent (§4.2), không chạy lại toàn bộ file — chỉ chạy phần còn thiếu, hoặc xóa project **staging** làm lại từ đầu (chỉ staging). Prod: restore từ backup §6 nếu đã chạm prod (xem `BACKUP_GUIDE.md` §7.3). **Lần chạy staging đầu tiên (10/11/2026) đã rollback hoàn toàn về 0 bảng** nên chỉ cần sửa file theo §2.9 (sau phê duyệt) rồi chạy lại từ đầu — không cần dọn dẹp gì thêm trên staging. |
| 0002 / 0003 | Chạy lại toàn bộ file được (idempotent theo `ON CONFLICT`). Kiểm tra lỗi gốc trước (thường là 0001 chưa chạy xong hoặc sai thứ tự). |
| 0004 | Dừng. Không chạy 0005/0006. Kiểm tra §2.2/§2.7(b). Bảng dùng `IF NOT EXISTS` nên sau khi sửa lỗi có thể chạy lại — nhưng phải kiểm tra những bảng/index/trigger nào đã tạo trước điểm lỗi để không bỏ sót (đặc biệt trigger `updated_at` ở cuối file). |
| 0005 | Guard mục 0 tự dừng là **hành vi đúng**, không phải lỗi để "vượt qua": nếu báo `0004 chưa chạy` → chạy 0004 trước; nếu báo bảng mới đã có dữ liệu → đối soát tay, không tự xóa dữ liệu để chạy tiếp. Nếu lỗi ở mục 3c (`question không gắn được quiz_id`) → đối soát lesson/khóa bị lệch, không tự xóa question. Nếu đã chạy dở trong transaction thì transaction tự rollback — kiểm tra lại trạng thái bằng §7.4 rồi xử lý. |
| 0006 | Dừng. Không chạy lại toàn bộ file nguyên trạng (policy trùng — xem §4.2). Thêm `DROP POLICY IF EXISTS` trước mỗi `CREATE POLICY` rồi chạy lại trên staging; hoặc restore từ backup nếu lỗi xảy ra trên prod và không xác định được phần nào đã áp dụng. |
| 0007 | File thiết kế idempotent (mỗi bước có guard, chạy lại không lỗi, không đổi dữ liệu). Nếu một mục báo `BO QUA` / `NOTICE` thì đọc NOTICE của mục đó để biết bước tiên quyết nào thiếu (thường là 0001–0006 chưa chạy đủ) rồi chạy lại 0007 sau khi đủ điều kiện — không tự sửa dữ liệu để "vượt qua". Nếu mục (c) báo `DỪNG LẠI` do trùng `(attempt_id, question_id, option_id)` thì đối soát tay, không tự xóa dữ liệu. Nếu mục (a)/(b) báo `BO QUA` do thiếu bảng thì xem §2.7 — 0007 không tự tạo lại bảng. |

### 8.4. Sau khi xử lý lỗi

1. Ghi biên bản: file nào lỗi, thông báo lỗi nguyên văn, thời điểm, project (staging/prod), người xử lý.
2. Chạy lại từ file lỗi (không chạy lại từ đầu nếu các file trước đã đạt kiểm chứng §7).
3. Chạy lại toàn bộ kiểm chứng §7 của file đó và các file sau nó.
4. Chỉ khi staging đạt hết mới chạy lại lên prod (sau khi backup lại prod theo §6 — backup cũ trước lần chạy lỗi vẫn còn hiệu lực, nhưng dump mới phản ánh đúng trạng thái hiện tại của prod).

## 9. Sau khi chạy xong cả 7 migration

Đánh dấu bảng §3.2 là "Đã chạy" cho cả staging và prod, rồi xử lý các việc còn lại sau — **không coi đợt migration này là xong** nếu các mục dưới đây chưa được chốt:

| # | Việc còn lại | Trạng thái |
|---|---|---|
| 1 | **Migration dọn dẹp 2 bảng tạm** (`course_modules_new_empty`, `questions_new_empty`): xóa sau khi code (API/frontend) đã chuyển hết sang tên mới `course_modules`/`questions`. Cần phê duyệt riêng (0005 mục 8 và phần kiểm tra cuối file ghi rõ). | ☐ Chưa làm — **nhưng 0007 mục (g) đã viết sẵn:** trống thì DROP ngay khi chạy 0007; chỉ khi bảng tạm có dữ liệu mới cần dọn dẹp riêng sau đối soát. |
| 2 | **Trigger đồng bộ `user_roles` → `profiles.role`** + chuyển RLS/API sang đọc `user_roles` (xem §2.5). Tới khi xong, `profiles.role` vẫn là nguồn RLS đang đọc. | ☐ Chưa làm — **trigger đã có sẵn trong 0007 mục (e)** (`trg_sync_profiles_role` + hàm `sync_one_profile_role()`); còn lại là **chuyển RLS/API sang đọc `user_roles`** (đổi code, không phải migration). |
| 3 | **Đổi tên `quiz_options` → `question_options`** nếu chốt phương án (a) ở §2.4 (kèm VIEW `quiz_options_public`). | ☐ Chưa làm — **đã có sẵn trong 0007 mục (c)/(d)** (đổi cả `answers`→`quiz_answers`, view mới `question_options_public`, đổi tên 3 policy); chỉ có hiệu lực sau khi 0007 chạy. |
| 4 | **Xóa cột `questions.lesson_id`** (0005 mục 3d giữ lại làm cột đối soát) — chỉ xóa ở migration sau khi code đã chuyển hết sang `quiz_id`. Cần phê duyệt riêng. | ☐ Chưa làm |
| 5 | **Bỏ `quiz_attempts.answers` jsonb và `orders.course_id`** sau backfill — 0005 giữ cả hai để đối soát; bỏ ở migration sau khi đã xác nhận dữ liệu chuẩn hóa khớp (xem `DECISIONS.md` quyết định 7). | ☐ Chưa làm (0007 không bỏ hai cột này — header 0007 ghi rõ) |
| 6 | **Code chuyển sang tên mới**: API/frontend dùng `course_modules`, `questions`, `quiz_answers`, `course_module_id`, `quiz_id` thay cho tên cũ. VIEW tên cũ ở 0005 mục 7 chỉ là cầu nối tạm thời trong thời gian chuyển đổi (mặc định không tạo) — xóa VIEW khi code chuyển xong. | ☐ Chưa làm — lưu ý 0007 mục (d) đã **drop view cũ `quiz_options_public`** và tạo view mới `question_options_public`; frontend/API phải đọc view mới sau khi 0007 chạy. |
| 7 | Cập nhật trạng thái file này + `BACKUP_GUIDE.md` (chạy backup hàng ngày) + `ENVIRONMENT_CONFIG.md` (điền URL/key vào Cloudflare/Github Secrets) sau khi migration xong. | ☐ Chưa làm |

## 10. Việc cần user làm

> Các việc dưới đây chỉ user (chủ tài khoản) mới làm được — đội ngũ không có quyền truy cập tài khoản Supabase của user, không mật khẩu, không API key.

1. **Tạo 2 project Supabase Free** trên tài khoản Gmail `visfaracademy@gmail.com`: project 1 = production, project 2 = staging (xem §1.1). Gửi lại tên/ref của 2 project (không gửi mật khẩu / key qua chat). — ✅ **ĐÃ XONG (10/11/2026):** cả 2 project đã tạo; URL + anon key đã có trong `apps/web/.env.local` / `apps/web/.env.staging`.
2. **Phê duyệt phương án sửa ở §2.9** (điều kiện bắt buộc trước khi chạy lại): (a) trong 0001 chuyển khối tạo hàm `current_role()` xuống sau `CREATE TABLE profiles` + chuyển khối `orders`/`payments` lên trước `enrollments`; (b) trong 0004 chuyển `membership_plans` lên trước `order_items` — chỉ đổi thứ tự, không đổi nội dung bảng/cột. Hoặc user xác nhận phương án sửa khác. **Chưa phê duyệt thì không sửa file, không chạy lại** (lần chạy đầu tiên ngày 10/11/2026 đã dừng ở 0001 lỗi `42P01` — xem §2.8).
3. **Chốt cách chạy**: Dashboard SQL Editor (§4), Supabase CLI (§5), hay **Management API qua HTTPS (§5.5)** — chọn một cách cho mỗi project và giữ nguyên tới cuối. Lưu ý: CLI `db push --remote` hiện không chạy được trong môi trường VM (mạng chặn Postgres wire protocol — S-03); đường vòng đã kiểm chứng là Management API (§5.5).
4. **Chạy migration trên staging** theo đúng thứ tự §3.1 (0001→0007; hoặc cùng đội ngũ chạy từng bước có giám sát), kiểm chứng theo §7 sau mỗi file, và gửi lại kết quả kiểm chứng (số bảng, số dòng, thông báo lỗi nếu có — kèm ảnh chụp màn hình thông báo lỗi nguyên văn, không tóm tắt lại). Lần chạy đầu tiên đã FAIL ở 0001 — chạy lại từ đầu sau khi §2.9 được phê duyệt.
5. **Backup prod trước khi chạy prod** theo §6 (dump đầy đủ, ghi lại tên file + thời điểm), rồi chạy đúng 7 file đã chạy đạt trên staging lên prod.
6. **Cập nhật bảng trạng thái §3.2** (hoặc gửi kết quả để đội ngũ cập nhật): đánh dấu từng migration đã chạy staging / đã chạy prod kèm ngày giờ.
7. **Không gửi secret thật qua chat**: mật khẩu database, service-role key, connection string chỉ nhập trực tiếp vào Dashboard/CLI/GitHub Secrets (xem `ENVIRONMENT_CONFIG.md` §11 và `BACKUP_GUIDE.md` §3.2).
8. **Sau khi migration xong**: chốt các việc còn lại ở §9 (đặc biệt migration dọn dẹp 2 bảng tạm và trigger đồng bộ `user_roles`) trước khi deploy code đọc các bảng mới.

---

*Tài liệu hướng dẫn chạy Migration — Task 04 Supabase Backend Implementation — Visfar Academy — 10/11/2026 (cập nhật cùng ngày). Project đã tạo; lần chạy thật đầu tiên lên staging ngày 10/11/2026 FAIL ở 0001 (lỗi 42P01) — chờ phê duyệt phương án sửa §2.9 rồi chạy lại. Chưa chạy gì lên prod. Mọi lệnh trong tài liệu này đều là mẫu, chỉ chạy sau khi user hoàn thành §10.*
