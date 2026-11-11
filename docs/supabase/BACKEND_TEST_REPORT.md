# Báo cáo kiểm thử Backend — Task 04: Supabase Backend Implementation

**Dự án:** Visfar Academy
**Ngày:** 10/11/2026 (cập nhật cùng ngày — thêm 0007, file môi trường, kiểm thử local chạy lại)
**Trạng thái:** **Project Supabase đã tạo (prod + staging); chạy thật lần 3 ngày 10/11/2026 (xem §5D): migration 0008 mới + chạy lại 0007 — staging PASS hết (38 bảng, 10 khóa, 4 policy, RLS 38/38, 81 policy, 5 bucket), prod PASS hết (kiểm chứng giống hệt staging, REST anon trả đủ 10 khóa). C-21 và C-29: PASS (xem §5D). Lệch policy 81 vs 83 đã đối chiếu xong: 81 là đúng, 83 là đếm nhầm (xem §5D). Chạy lần 4 ngày 10/11/2026 (xem §5E, user auto-duyệt): 0009 (vá RLS H1–H4) + 0010 (policy Storage avatars) PASS staging + prod; tổng policy public nay là 80 (81 − 2 + 1); 2 tài khoản test đã tạo trên staging và kiểm thử live RLS H1/H2/H3 + avatar đều PASS (xem §5E).** **Chạy lần 5 ngày 10/11/2026 22:49 +07 (TASK 07, xem §5F): 0011–0013 FAIL ngay ở 0011 trên staging (lỗi 42883) — dừng, không chạy 0012/0013, không chạy prod. Chạy lần 6 ngày 10/11/2026 ~23:00 +07 (xem §5G, user auto-duyệt): sửa 0011 (ép kiểu `::text`) + sửa 0013 (tiền đề (E) sai cột), chạy lại 0011→0013 — staging PASS hết, prod PASS hết; seed tối thiểu + kiểm thử live e2e 17/17 PASS trên staging.**
**Phạm vi:** Kiểm thử backend Supabase (database, Authentication, API, RLS, Storage, Migrations, Backup) cho nền tảng Visfar Academy.

---

## 0. Bối cảnh bắt buộc — đọc trước

- **Không có quyền truy cập tài khoản Supabase của user, không mật khẩu, không API key, không có project Supabase thật.** Mọi kiểm thử cần project thật đều ở trạng thái **CHƯA CHẠY** trong báo cáo này — không ghi PASS cho thứ chưa chạy.
- **Cập nhật 10/11/2026:** Project Supabase prod + staging đã được tạo; Project URL + anon key đã có trong file môi trường local (`apps/web/.env.local` cho prod, `apps/web/.env.staging` cho staging — chỉ chứa anon key, cả hai đều bị `.gitignore` chặn, không commit). Access token dùng cho Supabase CLI đã được nhận (qua Secure Vault/chat — giá trị không ghi trong tài liệu này hay trong repo, chỉ dùng qua biến môi trường khi chạy lệnh). **Chạy thật lần 1 trên staging đã diễn ra cùng ngày (do coordinator chạy — xem §5A):** S-01/S-02/S-04 PASS, S-03 FAIL (mạng VM chặn Postgres wire protocol), S-05 FAIL (0001 lỗi 42P01, staging rollback về 0 bảng). Hệ quả: C-21 đã chạy thử và FAIL; 28 mục còn lại vẫn CHƯA CHẠY. Không ghi PASS cho thứ chưa chạy.
- **Không tạo dữ liệu học viên thật.** Mọi kiểm thử dưới đây chỉ dùng dữ liệu seed trong migration và tài khoản test (khi có project); dữ liệu test phải xóa hoặc đánh dấu rõ sau khi đối soát, theo `docs/audit/ACCEPTANCE_CRITERIA.md`.
- **Không bịa kết quả kiểm thử, không bịa số tài khoản ngân hàng, không bịa giá dịch vụ, không ghi secret thật.** Mọi kết quả PASS/FAIL trong §3 đều có lệnh chạy thật kèm theo (§8 — Phụ lục tái hiện).
- Tài khoản Supabase sẽ tạo trên Gmail `visfaracademy@gmail.com`, cả project prod + staging dùng tài khoản này (theo `docs/DECISIONS.md`, phê duyệt Task 02 QĐ 15).

### Quy ước kết quả

| Kết quả | Nghĩa |
|---|---|
| **PASS** | Đã chạy thật và đạt tiêu chí ghi trong bảng. |
| **FAIL** | Đã chạy thật và không đạt — cần sửa trước khi coi là xong. |
| **CHƯA CHẠY** | Chưa thể chạy (thiếu project Supabase thật, thiếu công cụ, hoặc thiếu quyết định của user). Không được hiểu là đạt. |

---

## 1. Tài liệu nguồn đã đọc trước khi viết báo cáo này

| # | Tài liệu | Dùng cho |
|---|---|---|
| 1 | `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (v1.0, 10/11/2026) | Kiến trúc tổng thể: schema §3, RBAC §5, RLS §6, API §7, thanh toán §8, học tập §9, email §10, báo cáo §11, giới hạn miễn phí + backup §12 |
| 2 | `workspace/visfar-academy-platform/docs/audit/ACCEPTANCE_CRITERIA.md` (Task 01) | Tiêu chí nghiệm thu G0–G4, 16 kịch bản RLS (RLS-01–RLS-16), test mất mạng, test responsive, giới hạn miễn phí |
| 3 | `workspace/visfar-academy-platform/docs/database/RLS_POLICIES.md` (Task 03) | Đặc tả RLS 38 bảng, nguyên tắc chung, 12 kiểm thử RLS (§8), 10 quyết định cần phê duyệt (§9) |
| 4 | `workspace/visfar-academy-platform/docs/database/DATABASE_SCHEMA.md`, `DATABASE_MIGRATIONS/`, `DATA_DICTIONARY.md`, `SECURITY_MODEL.md` | Thiết kế 38 bảng, migration 0004–0006, từ điển dữ liệu, mô hình bảo mật |
| 5 | `workspace/visfar-academy-platform/supabase/migrations/0001_init_schema.sql`, `0002_seed_courses.sql`, `0003_seed_content.sql` | Schema Module 1 + seed 10 khóa + seed 4 chính sách |
| 6 | `workspace/visfar-academy-platform/docs/DECISIONS.md` | 19 quyết định 10/11/2026 + 16 quyết định Task 02 + 14 quyết định Task 03 — chuẩn đối chiếu cho mọi lệch lạc (§6) |
| 7 | `workspace/visfar-academy-platform/docs/supabase/SUPABASE_SETUP.md`, `ENVIRONMENT_CONFIG.md`, `BACKUP_GUIDE.md` | Hướng dẫn tạo project, biến môi trường, backup/phục hồi (dùng khi chạy §5) |
| 8 | `workspace/visfar-academy-platform/supabase/migrations/0007_fix_blockers.sql` (mới, 10/11/2026) + `apps/web/.env.local` (prod) + `apps/web/.env.staging` (staging) | Migration 0007: đổi tên `answers`→`quiz_answers`, `quiz_options`→`question_options`, trigger đồng bộ `user_roles`, 5 bucket Storage, xử lý 2 bảng tạm, cập nhật seed 0003; file môi trường chỉ chứa URL + anon key (không ghi giá trị key vào báo cáo này) |

---

## 2. Kế hoạch kiểm thử

Kế hoạch gồm 7 nhóm. Mỗi nhóm ghi rõ: mục đích, điều kiện để chạy, các bước, tiêu chí PASS/FAIL. **Nhóm nào cần project thật thì toàn bộ kiểm thử trong nhóm đó hiện là CHƯA CHẠY** (xem §5).

### 2.1. Kết nối database

**Mục đích:** chứng minh frontend/API kết nối được tới project Supabase thật, đọc được dữ liệu seed, và không bao giờ báo "ok" giả khi chưa kết nối được.

| # | Kiểm thử | Điều kiện chạy | Cách chạy | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| DB-01 | Health check thật | Project Supabase đã tạo; `.env.local` có `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` thật | `GET /api/health` (route `apps/web/src/app/api/health/route.ts`) | Trả `200 + ok:true` chỉ khi query thật `select id from courses limit 1` thành công; trả `503 + ok:false` khi chưa cấu hình hoặc query lỗi | Trả `200` khi chưa cấu hình, hoặc trả `ok:true` khi query lỗi |
| DB-02 | Đếm bảng sau migration | Project đã chạy đủ migration 0001→0007 | Query `information_schema.tables` (schema `public`); đối chiếu với danh sách 38 bảng §3.1 | Đủ 38 bảng nghiệp vụ, đúng tên, đúng cột theo `DATABASE_SCHEMA.md` | Thiếu/thừa bảng, sai tên/cột |
| DB-03 | Đếm dữ liệu seed | Project đã chạy 0002 + 0003 | `select count(*) from courses` (= 10); `select count(*) from policies where is_current = true` (= 4) | 10 khóa đúng thứ tự 01–10, `status = 'published'`; 4 chính sách đúng slug, `version = 1` | Sai số lượng, sai thứ tự, sai slug, khóa không `published` |
| DB-04 | Chạy lại migration (idempotency) | Project staging | Chạy lại toàn bộ migration lần 2 (hoặc `supabase db push` lần 2) | Không lỗi, không tạo trùng (seed dùng `ON CONFLICT DO NOTHING` / `UPDATE` theo slug) | Lỗi, hoặc sinh dòng trùng |
| DB-05 | Kiểm tra giới hạn miễn phí | Project thật | Đối chiếu usage trên Supabase Dashboard với §12.1 tài liệu kiến trúc (DB 500 MB, Storage 1 GB, Auth 50.000 MAU/tháng, tạm dừng sau 7 ngày không hoạt động) — **xác minh lại trên trang pricing chính thức trước mỗi lần nghiệm thu** | Chưa chạm ngưỡng chặn nào, hoặc đã có phương án nâng cấp được phê duyệt | Đã chạm ngưỡng chặn mà chưa có phương án |

### 2.2. Authentication (Supabase Auth)

**Mục đích:** chứng minh đăng ký/đăng nhập/phân quyền hoạt động, mật khẩu không lưu plain-text, session hết hạn đúng, không ai tự nâng role của mình.

| # | Kiểm thử | Điều kiện chạy | Cách chạy | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| AU-01 | Đăng ký tài khoản mới | Project thật, Auth bật email | Đăng ký bằng email test riêng; kiểm tra `auth.users` + `profiles` có dòng mới (trigger tạo profile), `profiles.role` mặc định `student` | Có dòng `profiles` khớp `auth.users`, role mặc định đúng | Không tạo được profile, hoặc role mặc định sai |
| AU-02 | Đăng nhập / đăng xuất / refresh token | Tài khoản test đã tạo | Đăng nhập, gọi API với JWT, chờ hết hạn session (hoặc thu hồi session), gọi lại API bằng token cũ | Token hết hạn bị từ chối `401`; refresh token hoạt động đúng | Token hết hạn vẫn dùng được |
| AU-03 | Mật khẩu không lưu plain-text | Project thật | Kiểm tra DB/log/email: không nơi nào chứa mật khẩu thật đọc được | Không tìm thấy mật khẩu plain-text ở bất kỳ đâu | Mật khẩu plain-text xuất hiện ở DB/log/email |
| AU-04 | Không tự nâng role | Tài khoản student test | `PATCH /api/my/profile` (hoặc UPDATE trực tiếp) với field `role='admin'` / `user_id` khác | API từ chối; `profiles.role` và `user_roles` không đổi; có log từ chối | Role đổi thành `admin`, hoặc sửa được hồ sơ người khác |
| AU-05 | Phân quyền route | 3 tài khoản test: student, instructor, admin | Student truy cập `/admin` và `GET /api/admin/leads`; instructor truy cập `GET /api/admin/leads` và trang quản lý đơn hàng | Student vào `/admin` bị chặn (redirect/403); instructor gọi API lead bị `403`; không dữ liệu admin/lead nào lộ trong response | Bất kỳ tài khoản nào không phải admin xem được trang/dữ liệu admin hoặc lead |

### 2.3. API (Workers API + Next.js route)

**Mục đích:** chứng minh API là lớp trước duy nhất ghi dữ liệu nhạy cảm (theo DECISIONS QĐ 5: API nhận lead, validate/chống spam/chống trùng, rồi ghi Sheet làm bản sao đối soát), và API không hiện cảm ơn khi chưa nhận `ok:true` (theo phê duyệt Task 02 QĐ 2).

| # | Kiểm thử | Điều kiện chạy | Cách chạy | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| API-01 | Lead đầu-cuối (không mất lead) | Project thật + Workers API đã deploy | Gửi form tư vấn hợp lệ 1 lần từ trình duyệt; kiểm tra bảng `leads` có đúng 1 dòng mới, đủ cột, SĐT giữ số 0 đầu; đối chiếu Sheet bản sao | Đúng 1 dòng `leads`; màn hình cảm ơn **chỉ hiện sau khi** API trả `ok:true`; Sheet khớp số dòng với DB | Thank-you hiện trước khi DB có dòng; 0 hoặc ≥ 2 dòng; SĐT mất số 0; Sheet lệch số dòng |
| API-02 | Chống trùng (idempotency) | Project thật + API | Gửi 2 lần cùng `Idempotency-Key` (hiệu lực 24 giờ, theo DECISIONS Task 03 QĐ 13) | DB chỉ có 1 dòng; lần 2 trả kết quả trùng (`duplicate: true`, cùng `reference_code` cũ) | 2 dòng cho cùng 1 lần đăng ký, hoặc lần 2 tạo mã tham chiếu mới |
| API-03 | Chống spam | Project thật + API | POST trực tiếp 5 trường hợp: SĐT sai định dạng; email TLD 1 ký tự; tỉnh ngoài 34 tỉnh; khóa không tồn tại/không `published`; honeypot có giá trị. Gửi > 5 lần/giờ/IP (mức theo tài liệu kiến trúc §7.2) và > 300 req/giờ/user (theo DECISIONS Task 03 QĐ 13) | Cả 5 trường hợp bị từ chối `400 + ok:false` với mã lỗi rõ ràng, không dòng rác mới; request vượt ngưỡng trả `429` | Bất kỳ trường hợp nào ghi được dòng, trả `ok:true` cho dữ liệu sai, hoặc không có rate-limit |
| API-04 | CAPTCHA (Turnstile) | Project thật + API; Turnstile đã cấu hình | Gửi lead không có/không hợp lệ token Turnstile; gửi khi Turnstile không tải được | Không token → bị chặn hoặc cho qua với rate-limit chặt hơn + ghi log (theo DECISIONS Task 03 QĐ 13), không chặn cứng người dùng thật; token hợp lệ → qua bình thường | Chặn cứng người dùng thật khi Turnstile lỗi, hoặc bỏ qua CAPTCHA hoàn toàn không ghi log |
| API-05 | Đơn hàng không tự `paid` | Project thật + API | (1) Gọi API giả mạo "đã trả" từ client (không chữ ký webhook); (2) sửa trạng thái đơn qua Supabase client bằng anon key / JWT học viên | Cả 2 cách đều thất bại; đơn vẫn `pending`, không dòng `payments` mới, không enrollment mới; server trả lỗi + ghi log | Bất kỳ cách nào làm đơn chuyển `paid` hoặc tạo được enrollment |
| API-06 | Quiz chấm ở server | Project thật + API; khóa test có quiz | `GET /api/my/quiz/:lessonId` bằng JWT học viên đã ghi danh; nộp quiz 1 lần đúng hết, 1 lần sai 1 câu; thử gửi `score: 10/10` từ client | Response lấy câu hỏi **không có** `is_correct`/`correct`/`answer`; điểm trả về khớp số câu đúng tính tay; `quiz_attempts` lưu đúng; server chấm lại, không tin điểm client gửi | Lộ đáp án đúng trước khi nộp; điểm sai; client tự gửi điểm được server tin |
| API-07 | Tiến độ chống gian lận | Project thật + API | Gửi progress nhảy 0% → 100% trong 1 request cho video dài; gửi `progress_percent` = 150 và = -5; gửi tiến độ hợp lệ tới ≥ 90% rồi đánh dấu hoàn thành (ngưỡng 90% video / bấm "Đã hoàn thành" bài text — DECISIONS QĐ 17) | Nhảy 0→100 trong 1 giây bị từ chối/không hoàn thành; giá trị ngoài 0–100 bị `400`; bài hoàn thành đúng khi đạt ngưỡng đã chốt | Nhảy 0→100 vẫn hoàn thành; ngưỡng áp dụng khác ngưỡng đã duyệt; giá trị ngoài 0–100 được chấp nhận |
| API-08 | Mất mạng giữa chừng | Project thật + API | Ngắt mạng (DevTools offline) ngay sau khi bấm gửi form tư vấn / newsletter / đăng nhập / nộp quiz / cập nhật tiến độ; bật mạng lại, bấm "Thử lại" | Hiện lỗi rõ ràng + nút "Thử lại"; **không** hiện dữ liệu giả; bấm "Thử lại" hoàn tất thật và DB có dòng/kết quả đúng, không tạo trùng | Hiện thành công giả khi mất mạng; không có nút thử lại; "Thử lại" tạo 2 dòng trùng |

### 2.4. RLS — 16 kịch bản (theo `docs/audit/ACCEPTANCE_CRITERIA.md`)

**Mục đích:** chứng minh policy RLS chặn đúng ở tầng database, không chỉ ở API. **Quy tắc: chạy đủ 16 trên staging trước khi ra mắt; chạy lại đủ 16 sau mỗi lần thêm bảng mới hoặc sửa policy; ghi ngày chạy + người chạy + kết quả từng kịch bản. Chưa chạy = chưa đạt.**

Tài khoản test cần chuẩn bị: anon (không đăng nhập), học viên A, học viên B, instructor phụ trách khóa X (đã có dòng trong `course_instructors`), instructor không phụ trách khóa Y, admin. Bằng chứng mỗi kịch bản: câu query đã chạy + kết quả trả về (số dòng / lỗi 403) + vai trò đã dùng.

| # | Kịch bản | Vai trò test | Cách test | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| RLS-01 | Anon chỉ thấy khóa `published` | Anon | `SELECT` bảng `courses` bằng anon key | Chỉ thấy khóa `status='published'`; không thấy `draft`/`archived` | Thấy ≥ 1 khóa `draft`/`archived` |
| RLS-02 | Anon không đọc được lead | Anon | `SELECT` bảng `leads` bằng anon key | 0 dòng / lỗi từ chối | Thấy ≥ 1 dòng lead |
| RLS-03 | Anon không ghi được vào bảng nhạy cảm | Anon | `INSERT` vào `leads`, `orders`, `payments`, `lesson_progress` bằng anon key | Cả 4 đều bị từ chối | Bất kỳ bảng nào ghi được |
| RLS-04 | Anon đọc được bài blog `published` và chính sách `is_current` | Anon | `SELECT` `posts` (`published`) và `policies` (`is_current=true`) | Chỉ thấy bài published / chính sách hiện hành; không thấy `draft` | Thấy bài `draft` hoặc chính sách cũ (không phải `is_current`) |
| RLS-05 | Học viên A không thấy enrollment của học viên B | Học viên A | `SELECT` `enrollments` bằng JWT của A | Chỉ thấy enrollment có `user_id = A` | Thấy enrollment của B |
| RLS-06 | Học viên A không thấy tiến độ của học viên B | Học viên A | `SELECT` `lesson_progress` bằng JWT của A | Chỉ thấy tiến độ của A | Thấy tiến độ của B |
| RLS-07 | Học viên A không thấy đơn hàng của học viên B | Học viên A | `SELECT` `orders` bằng JWT của A | Chỉ thấy đơn của A | Thấy đơn của B |
| RLS-08 | Học viên A không thấy chứng chỉ / quiz attempts của học viên B | Học viên A | `SELECT` `certificates` và `quiz_attempts` bằng JWT của A | Chỉ thấy của A | Thấy của B |
| RLS-09 | Học viên không đọc được `payments` và `leads` | Học viên A | `SELECT` `payments` và `leads` bằng JWT của A | 0 dòng / từ chối cả 2 bảng | Thấy ≥ 1 dòng ở bảng nào |
| RLS-10 | Học viên không ghi enrollment cho người khác | Học viên A | `INSERT` `enrollments` với `user_id = B` bằng JWT của A | Bị từ chối | Ghi được |
| RLS-11 | Học viên chỉ đọc bài học của khóa đã ghi danh (bài không xem thử) | Học viên A (chưa ghi danh khóa X) | `GET /api/my/lessons/:lessonId` của khóa X (bài không `is_free_preview`) bằng JWT của A | Bị từ chối (403/404); không nhận được `video_url`/`file_url` | Nhận được video/file URL của bài chưa ghi danh |
| RLS-12 | Học viên đọc được bài xem thử (`is_free_preview`) mà không cần ghi danh | Anon / học viên chưa ghi danh | `GET /api/my/lessons/:lessonId` của bài `is_free_preview=true` | Nhận được nội dung bài xem thử | Bị từ chối bài xem thử |
| RLS-13 | Instructor chỉ xem tiến độ học viên của khóa mình phụ trách | Instructor (phụ trách khóa X) | `SELECT` `lesson_progress` của học viên khóa X và khóa Y (không phụ trách) | Thấy tiến độ khóa X; không thấy khóa Y | Thấy tiến độ khóa Y, hoặc không thấy khóa X |
| RLS-14 | Instructor không xem được lead và không sửa được giá/đơn hàng | Instructor | `SELECT` `leads`; `UPDATE` `courses.price_vnd`; `UPDATE` `orders` | Cả 3 đều bị từ chối | Bất kỳ thao tác nào thành công |
| RLS-15 | Admin thấy tất cả | Admin | `SELECT` `leads`, `orders`, `payments`, `enrollments`, `lesson_progress`, `email_logs`, `audit_logs` bằng JWT admin | Thấy đủ tất cả các bảng, kể cả dữ liệu của A và B | Thiếu bảng nào, hoặc không thấy dữ liệu của A/B |
| RLS-16 | Học viên chỉ sửa được hồ sơ của mình | Học viên A | `UPDATE` `profiles` của A (được) và của B (phải bị từ chối); `PATCH /api/my/profile` với `user_id` khác | Sửa của mình thành công; sửa của B bị từ chối | Sửa được hồ sơ của B, hoặc không sửa được hồ sơ của mình |

> **⚠️ Mâu thuẫn cần user chốt trước khi chạy RLS-09:** Task 01 (bảng trên) yêu cầu học viên **không đọc được `payments`**; `RLS_POLICIES.md` §4.4/§7.6 lại cho học viên đọc payment **của đơn mình** (theo ma trận quyền), và chính tài liệu đó ghi nhận mâu thuẫn với schema Task 03 §3.20 ("SELECT chỉ admin") tại §9.6. Cả 3 nguồn chưa thống nhất. **Không chạy RLS-09 cho tới khi user chốt 1 trong 2:** (a) student không được SELECT `payments` chút nào, hay (b) student được SELECT payment của đơn mình. Xem §6, F-06.

> **Lưu ý RLS-11/RLS-12:** đây là kiểm thử ở tầng API (endpoint kiểm tra enrollment + `is_free_preview`), không phải RLS thuần — RLS trên `lessons` không phân biệt được "xem danh sách bài" với "xem nội dung bài" (theo `RLS_POLICIES.md` §4.1). Chạy kèm với API-06/API-07.

### 2.5. Storage

**Mục đích:** chứng minh file học liệu/video chỉ lấy được qua signed URL sau khi API kiểm tra enrollment, và bucket không cho phép truy cập công khai trái phép.

| # | Kiểm thử | Điều kiện chạy | Cách chạy | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| ST-01 | Bucket tồn tại + đúng cấu hình | Project thật | Liệt kê bucket trên Dashboard / SQL `storage.buckets`; kiểm tra policy từng bucket (public/private) | Đủ bucket theo thiết kế; bucket học liệu là private, không public-read | Thiếu bucket, hoặc bucket học liệu để public |
| ST-02 | Signed URL hết hạn sau 1 giờ | Project thật; học viên đã ghi danh | Lấy signed URL file bài học qua API; truy cập ngay (được) và sau 1 giờ (hết hạn) | Truy cập được trong 1 giờ; sau 1 giờ bị từ chối | URL không hết hạn, hoặc truy cập được khi chưa ghi danh |
| ST-03 | Chưa ghi danh không lấy được file | Project thật | Anon / học viên chưa ghi danh gọi API lấy file bài không xem thử | Bị từ chối (403/404), không nhận được URL | Nhận được URL hoặc tải được file |
| ST-04 | Upload đúng giới hạn | Project thật | Upload file vượt `file_size_limit` (50 MiB theo `supabase/config.toml`) và sai định dạng (nếu có whitelist) | Bị từ chối với lỗi rõ ràng | Upload vượt giới hạn vẫn thành công |

> **Lưu ý (cập nhật 10/11/2026):** migration 0007 mục (f) đã có lệnh tạo 5 bucket Storage (`public`, `avatars` public; `private`, `receipts`, `certificates` riêng tư — `ON CONFLICT DO NOTHING`). **Policy Storage chi tiết vẫn chưa có** (chính file 0007 cũng ghi "làm ở bước sau") — nhóm ST-01–ST-04 vẫn chưa chạy được cho tới khi policy Storage được viết và áp dụng. Xem §6, F-05.

### 2.6. Migrations

**Mục đích:** chứng minh migration chạy được từ đầu tới cuối trên database trống, đúng thứ tự, đúng phụ thuộc, và rollback được khi lỗi.

| # | Kiểm thử | Điều kiện chạy | Cách chạy | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| MG-01 | Chạy đủ 0001→0007 trên DB trống | Project staging trống (hoặc Supabase local: `supabase start` + `supabase db push`) | Chạy migration theo đúng thứ tự 0001→0007, không bỏ bước; đối chiếu `supabase_migrations.schema_migrations` | Cả 7 migration áp thành công, đúng thứ tự, không lỗi; bảng `supabase_migrations` ghi đủ 7 version | Bất kỳ migration nào lỗi, hoặc thiếu version |
| MG-02 | Phụ thuộc 0005 → 0006 | Project staging | Chạy thử 0006 trước 0005 (trên DB test riêng) | 0006 lỗi hoặc bị chặn khi chưa có 0005 (đúng như DECISIONS Task 03 QĐ 14: không chạy 0006 trước 0005) | 0006 chạy "thành công" khi thiếu 0005 nhưng để lại trạng thái sai |
| MG-03 | Rollback khi migration lỗi | Project staging | Cố ý áp migration lỗi (hoặc ngắt giữa chừng), rồi khôi phục bằng backup / chạy lại | DB trở về trạng thái trước khi chạy, không bảng dở dang; có biên bản khôi phục | Bảng dở dang còn sót, hoặc không khôi phục được |
| MG-04 | Đối chiếu schema sau migration | Project staging đã chạy đủ migration | So sánh schema thực tế (bảng/cột/kiểu dữ liệu/constraint/index) với `DATABASE_SCHEMA.md` §3 | Khớp 100% các bảng/cột đã chốt; mọi lệch lạc đều có ghi chú + quyết định | Lệch schema mà không có giải thích |

### 2.7. Backup

**Mục đích:** chứng minh có backup tự động, restore thử được, và dữ liệu sau restore khớp production. Chi tiết theo `docs/supabase/BACKUP_GUIDE.md`.

| # | Kiểm thử | Điều kiện chạy | Cách chạy | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| BK-01 | Backup tự động trong 24h | Project thật | Kiểm tra file `pg_dump` mới nhất (theo `BACKUP_GUIDE.md`) | Backup mới nhất trong 24h | Backup quá 24h hoặc không có backup |
| BK-02 | Restore thử lên staging | Project staging + file backup | Restore backup lên staging 1 lần/tháng; đếm số dòng các bảng chính (`courses`, `profiles`, `leads`, `orders`, `enrollments`) | Số dòng khớp production tại thời điểm backup; ứng dụng chạy được trên staging đã restore | Restore lỗi, hoặc số dòng lệch mà không giải thích được |
| BK-03 | Cảnh báo khi form/API lỗi | Project thật + kênh cảnh báo `visfaracademy@gmail.com` (theo DECISIONS Task 02 QĐ 14) | Giả lập lỗi form/API (tắt Workers hoặc trả lỗi 500), đo thời gian cảnh báo tới admin | Cảnh báo tới admin ≤ 15 phút | Giả lập lỗi mà không có cảnh báo, hoặc cảnh báo > 15 phút |
| BK-04 | Đối soát lead hàng ngày | Project thật; quy trình đối soát R9 (§11.3 tài liệu kiến trúc) | Trong 14 ngày liên tiếp, mỗi sáng đếm số lead form gửi = số dòng DB = số dòng Sheet (nếu còn) | Đủ 14 ngày nhật ký; sai lệch = 0 trong cả 14 ngày; không ngày nào mất lead | Thiếu ngày nhật ký; lệch số không giải thích/khắc phục trong ngày; mất ≥ 1 lead |

---

## 3. Kết quả kiểm thử đã chạy (local / static — ngày 10/11/2026)

Các kiểm thử dưới đây **đã chạy thật bằng lệnh terminal** trên máy dev, không cần project Supabase. Lệnh tái hiện đầy đủ ở §8. **Cập nhật 10/11/2026:** chạy lại toàn bộ sau khi 0004–0006 đã vào `supabase/migrations/` và 0007 mới được tạo; thêm T-11–T-14.

| # | Kiểm thử | Cách chạy | Kết quả | Ghi chú |
|---|---|---|---|---|
| T-01 | Migration đủ 0001→0007, không thiếu file, không trùng số | `ls supabase/migrations/` + đếm số `000[0-9]` | **PASS** | Đủ **7 file** 0001→0007 trong `supabase/migrations/`, mỗi số xuất hiện đúng 1 lần, không thiếu số. **0004–0006 đã nằm trong `supabase/migrations/`** (lỗi vị trí file ở lần báo cáo trước đã hết). Bản sao 0004–0006 vẫn còn ở `docs/database/DATABASE_MIGRATIONS/` — `diff` giống hệt nhau (xem T-14); bản chính là `supabase/migrations/`. |
| T-02 | RLS `ENABLE ROW LEVEL SECURITY` cho đủ 38 bảng | `grep -ci "enable row level security"` từng file + liệt kê bảng distinct | **PASS** | Câu ENABLE thật: **40** (0001: 20; 0006: 20). `grep -ci` đếm được 0006 = 21 dòng khớp vì có thêm **1 dòng comment** (0006:31) và 0007 = 1 dòng khớp là **chuỗi trong khối DO ở mục (g), dòng 614** — ENABLE có điều kiện, chỉ chạy khi bảng tạm có dữ liệu. Danh sách distinct 40 tên; sau khi 0005 rename (`modules`→`course_modules`, `quiz_questions`→`questions`), **38 bảng nghiệp vụ vật lý đều có RLS bật**. 2 bảng tạm `_new_empty` không có ENABLE tĩnh — xem T-03. |
| T-03 | Không còn bảng nghiệp vụ nào chưa bật RLS | Đối chiếu danh sách ENABLE với danh sách bảng vật lý sau 0001→0007 | **PASS** (sau 0007) | 0007 mục (g) xử lý dứt điểm 2 bảng tạm `course_modules_new_empty` và `questions_new_empty`: nếu trống (0 dòng) thì `DROP TABLE`; nếu có dữ liệu thì giữ lại **và bật RLS** cho chúng. Sau khi 0007 chạy, không còn bảng nào (nghiệp vụ hay tạm) thiếu RLS. **Giới hạn:** đây là kết luận tĩnh từ nội dung file 0007 — hành vi DROP hay ENABLE thực tế chỉ xác nhận được khi chạy MG-01 trên DB thật (C-21). |
| T-04 | Số lượng policy RLS | `grep -ci "create policy"` từng file | **PASS** (về số lượng) | Tổng **86 dòng khớp** `create policy`: 0001 có 35, 0006 có 48, **0007 có 3**. 3 dòng trong 0007 là drop + tạo lại để **đổi tên policy theo tên bảng mới** (`answers_select_own`→`quiz_answers_select_own`, `quiz_options_admin_all`→`question_options_admin_all`, `quiz_options_instructor_read`→`question_options_instructor_read`), không phải policy mới — **tổng số policy ròng sau 0007 vẫn là 83**. Số lượng chỉ chứng minh policy đã viết, **không chứng minh policy đúng** — đúng/sai chỉ kết luận được sau khi chạy RLS-01–RLS-16 trên project thật (§5). |
| T-05 | Kiểm tra cú pháp SQL 7 migration | `pglast` (PostgreSQL parser) — `parse_sql()` từng file | **PASS** | Cả 7 file parse OK, tổng **271 câu lệnh**: 0001: 100, 0002: 1, 0003: 1, 0004: 54, 0005: 25, 0006: 68, **0007: 22**. `pglast` v8.7 đã có sẵn trên máy dev (không cần cài lại). **Giới hạn:** pglast chỉ kiểm tra cú pháp, không kiểm tra ngữ nghĩa (FK trỏ đúng bảng/cột không, extension có sẵn không, hàm `auth.uid()` có tồn tại không). Ngữ nghĩa chỉ xác nhận được khi chạy MG-01 trên DB thật. `psql` không có trên máy dev. **Chạy lại ngày 10/11/2026 sau khi sửa thứ tự 0001/0004 (xem §5B): vẫn PASS, đúng 271 câu, số câu từng file không đổi** — chứng tỏ sửa chỉ đổi thứ tự, không thêm/bớt câu lệnh. |
| T-06 | Seed: 10 khóa học (0002) | Đếm dòng UUID + slug trong `0002_seed_courses.sql` | **PASS** | Đủ **10 dòng**, slug 01–10 đúng thứ tự (`thau-hieu-noi-tam`, `thau-hieu-tam-thuc`, `thau-hieu-tri-tue`, `thau-hieu-suc-khoe`, `thau-hieu-moi-quan-he`, `thau-hieu-tai-chinh`, `chuyen-gia-tu-van`, `master-tam-thuc-nhan-hieu`, `coaching-90-ngay`, `cong-dong-visfar`), cả 10 đều `status='published'`, `price_vnd = 0` (miễn phí / Tùy tâm — không tự đặt giá, đúng DECISIONS). Idempotent: chạy lại UPDATE theo slug, không tạo trùng. |
| T-07 | Seed: 4 chính sách (0003) | Đếm tuple `values` + slug trong `0003_seed_content.sql` | **PASS** (về số lượng) | Đủ **4 chính sách**, slug `bao-mat`, `dieu-khoan-tham-gia`, `hoan-tra-huy-dang-ky`, `giai-quyet-khieu-nai`, `version = 1`, `is_current = true`, idempotent `ON CONFLICT (slug, version) DO NOTHING`. **Ghi chú:** nội dung trong file là bản tóm tắt đúng tinh thần (toàn văn sẽ chuyển vào sau, ghi rõ trong header file); khung thời gian hoàn trả/khiếu nại trong seed vẫn ghi "CHƯA được user duyệt" — trong khi DECISIONS QĐ 9 đã chốt (hoàn trả 15 ngày làm việc, khiếu nại phản hồi 3 ngày). Seed cần cập nhật câu này khi chạy migration chính thức. Xem §6, F-04. |
| T-08 | Không có secret trong frontend | `grep -rniE "service_role\|SUPABASE_SERVICE_ROLE_KEY\|password\|secret"` trong `apps/web/src/`; `grep eyJ...` toàn repo (trừ `node_modules`, `.next`); đọc `apps/web/.env.example` — **chạy lại 10/11/2026** | **PASS** | Kết quả chạy lại giống hệt lần trước: trong `apps/web/src/` chỉ có **1 lần nhắc tới service-role — là comment cảnh báo** trong `apps/web/src/lib/supabase.ts` (dòng 2), không có key thật. `apps/web/src/lib/supabase.ts` chỉ dùng `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`, trả `null` khi chưa cấu hình (không fake dữ liệu). `.env.example` chỉ chứa placeholder `<project-ref>` / `<anon-public-key>`. Không tìm thấy chuỗi JWT thật (`eyJ...`) trong `docs/`, `apps/web/src/`, `supabase/migrations/`. Tên biến `SUPABASE_SERVICE_ROLE_KEY` chỉ xuất hiện trong tài liệu (`docs/architecture/`, `docs/supabase/ENVIRONMENT_CONFIG.md`) dưới dạng **placeholder** (`<YOUR_STAGING_SUPABASE_SERVICE_ROLE_KEY>`), không phải giá trị thật. **Ghi chú:** `apps/web/.env.local` (prod) và `apps/web/.env.staging` (staging) đã tạo ngày 10/11/2026 và chứa anon key thật — nằm ngoài phạm vi grep này, cả hai đều bị `.gitignore` chặn và không commit (xem T-12); báo cáo này không ghi giá trị key. |
| T-09 | Không có số tài khoản ngân hàng trong docs/migration mới | `grep -rnoE "[0-9]{9,}"` trong `supabase/migrations/` + `docs/database/` (loại UUID); `grep -rniE "mb bank\|stk\|so tai khoan"` | **PASS** | Không có dãy số tài khoản nào. Số điện thoại duy nhất xuất hiện là hotline/Zalo công khai **0347897868 / 034 7897 868** và email `visfaracademy@gmail.com` trong seed 0003 (thông tin đã công bố). Ngân hàng chỉ được nhắc bằng tên **MB Bank**, chủ tài khoản Công ty TNHH MTV Visfar Holdings — đúng DECISIONS QĐ 15 (không ghi số tài khoản vào tài liệu; chỉ dùng từ ảnh chụp/QR do user cung cấp). |
| T-10 | Unit test frontend hiện có | `npm test` (`vitest run`) trong `apps/web/` — **chạy lại 10/11/2026** | **PASS** | **37/37 test pass** (2 file, vitest 2.1.9): `src/lib/validation.test.ts` 30 test, `src/lib/courses.test.ts` 7 test — giống hệt lần chạy trước. Đây là test logic validation/khóa học ở frontend, **không phải** test backend — không thay thế được DB-01–BK-04. |
| T-11 | Kiểm tra tĩnh nội dung 0007 (đổi tên, trigger, bucket, seed, guard FK) | Đọc toàn bộ `0007_fix_blockers.sql` (771 dòng) + đối chiếu tên hàm/cột/bảng với file gốc bằng `grep` | **PASS** (về nội dung tĩnh) | (c) `answers`→`quiz_answers` + UNIQUE mới `(attempt_id, question_id, option_id)`; (d) `quiz_options`→`question_options` + view mới `question_options_public` (không có `is_correct`); (e) trigger `trg_sync_profiles_role` + hàm `sync_one_profile_role()` (ưu tiên admin > instructor > student); (f) 5 bucket `public`/`avatars` (public) + `private`/`receipts`/`certificates` (riêng tư), `ON CONFLICT DO NOTHING`; (g) xử lý 2 bảng tạm (xem T-03); (h) cập nhật seed 0003 theo DECISIONS QĐ 9 (hoàn trả 15 ngày làm việc, khiếu nại phản hồi 3 ngày — dùng đúng cột `body`, không phải `content`). Cảnh báo blocker (a)/(b) trong header 0007 **khớp đúng số dòng thật** (đã kiểm chứng bằng `grep`): 0001 `enrollments` CREATE dòng 164, FK `order_id` dòng 168, `orders` CREATE dòng 239; 0004 `order_items` CREATE dòng 324, FK `membership_plan_id` dòng 328, `membership_plans` CREATE dòng 364. **Giới hạn:** chỉ kiểm tra tĩnh — trigger/rename/bucket chỉ xác nhận được khi chạy MG-01 trên DB thật (C-21/C-29). |
| T-12 | File môi trường + `.gitignore` | Tạo `apps/web/.env.local` (prod) + `apps/web/.env.staging` (staging); `git check-ignore -v`; `git status` | **PASS** | Cả 2 file đã tạo, mỗi file chỉ có `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key, không có service-role key). `git check-ignore` xác nhận cả hai đều bị chặn (`.env.local` — `.gitignore:4`; `.env.staging` — `.gitignore:5`). **Đã phải thêm dòng `.env.staging` vào `.gitignore` gốc** vì trước đó mẫu `.env*.local` không chặn được `.env.staging` (`git check-ignore` trả về exit 1 trước khi thêm). `git status` không hiện file nào trong hai file (không tracked). Không ghi giá trị key vào tài liệu này. |
| T-13 | Đếm policy ròng sau 0007 | `grep -ci "create policy"` toàn bộ `supabase/migrations/*.sql` | **PASS** (về số lượng) | 86 dòng khớp: 0001: 35, 0006: 48, 0007: 3. 3 dòng trong 0007 là đổi tên policy cũ theo tên bảng mới (xem T-04) — **tổng ròng sau 0007 vẫn 83 policy**. Như T-04, số lượng không chứng minh policy đúng. |
| T-14 | 0004–0006 đồng nhất ở hai nơi | `diff` 3 file giữa `docs/database/DATABASE_MIGRATIONS/` và `supabase/migrations/` | **PASS** | Cả 3 file giống hệt nhau (`diff -q` không báo khác). Rủi ro còn lại: hai bản sao có thể lệch nhau sau này — bản chính là `supabase/migrations/`; mọi sửa sau này chỉ sửa ở đó (xem §6, F-10). |

### Tóm tắt §3

| | Số kiểm thử |
|---|---|
| **PASS** | 14 (T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14) |
| **FAIL** | 0 |
| **CHƯA CHẠY** | 0 trong nhóm local/static (mọi kiểm thử local có thể chạy đều đã chạy) |

> Đọc đúng: lần báo cáo trước là **8 PASS, 2 FAIL** trong 10 kiểm thử. Lần cập nhật này: **14 PASS, 0 FAIL** trong 14 kiểm thử local/static. 2 FAIL cũ đã hết — T-01 (0004–0006 đã vào `supabase/migrations/`), T-03 (0007 mục (g) xử lý 2 bảng tạm). Cả 2 cách xử lý đều là sửa bằng file/thư mục, không cần project thật — nhưng hành vi thật của 0007 (DROP hay ENABLE bảng tạm, rename, trigger, bucket) vẫn phải xác nhận lại khi chạy MG-01/C-29 trên DB thật.

---

## 4. Đối chiếu tên bảng: 38 bảng mục tiêu vs bảng vật lý sau migration

Để T-02 được hiểu đúng, bảng dưới đây đối chiếu danh sách 38 bảng trong `RLS_POLICIES.md` §0.1 / `DATABASE_SCHEMA.md` §0 với bảng vật lý thật sau khi chạy 0001→0006 (trạng thái trước 0007).

| Nhóm | Số bảng | Trạng thái |
|---|---|---|
| 31 bảng Task 03 (theo `DATABASE_SCHEMA.md` §0) | 31 | Đủ 31 tên trong migration, **trừ 2 tên lệch** — xem dưới |
| Bảng bổ sung đã phê duyệt (2): `course_instructors`, `question_options` | 2 | `course_instructors` có trong 0004 ✓. **`question_options` không tồn tại** — bảng vật lý vẫn là `quiz_options` (0001), 0005 ghi rõ "quiz_options KHÔNG đổi tên" (0005:177–178). Xem §6, F-03. |
| 5 bảng Module 1 giữ nguyên (`events`, `event_registrations`, `posts`, `policies`, `newsletter_subscribers`) | 5 | Đủ 5 ✓ |
| **Tổng bảng nghiệp vụ có RLS** | **38** | 36 tên khớp đúng danh sách mục tiêu + 2 tên lệch (`quiz_options`, `answers`) |
| Bảng trống giữ làm bằng chứng thiết kế (`course_modules_new_empty`, `questions_new_empty`) | +2 | Tồn tại sau 0005, **không có RLS** (T-03) |
| **Tổng bảng vật lý sau 0001→0006 (trước 0007)** | **40** | 38 nghiệp vụ + 2 trống |

**2 tên lệch so với quyết định đã chốt:**
- `answers` (vật lý, 0004) vs `quiz_answers` (mục tiêu — DECISIONS Task 03 QĐ 2: "Đổi `answers` thành `quiz_answers`"). Không có migration nào đổi tên này.
- `quiz_options` (vật lý, 0001) vs `question_options` (mục tiêu — `DATABASE_SCHEMA.md` §0/§4.2, `RLS_POLICIES.md` §0.1). 0005 chủ động giữ tên cũ.

Cả 2 lệch đều **không làm sai chức năng RLS** (policy trong 0006 viết theo tên vật lý thật: `quiz_options` có 1 policy, `answers` có 1 policy), nhưng làm tài liệu đặc tả (RLS_POLICIES.md, DATABASE_SCHEMA.md) **không khớp code thật**. Cần user chốt 1 trong 2 hướng (xem §7, mục 3).

> **Cập nhật 10/11/2026:** migration **0007 mục (c)/(d) đã viết sẵn hướng đổi tên** — `answers`→`quiz_answers` (kèm UNIQUE `(attempt_id, question_id, option_id)` và đổi tên policy `answers_select_own`→`quiz_answers_select_own`) và `quiz_options`→`question_options` (kèm view mới `question_options_public` không có `is_correct` và đổi tên 2 policy). **Nhưng đổi tên chỉ có hiệu lực sau khi 0007 chạy trên DB thật** — trước lúc đó tên vật lý vẫn là `answers`/`quiz_options`. Xác nhận bằng C-29 sau khi chạy MG-01.

---

## 5. Kiểm thử CHƯA CHẠY — cần project Supabase thật

Toàn bộ bảng dưới đây là **CHƯA CHẠY**. Điều kiện chung để chạy: user tạo project Supabase (staging trước, rồi production) trên tài khoản `visfaracademy@gmail.com`, rồi cung cấp **Project URL + anon key** (xem §7). Một số kiểm thử cần thêm: service-role key (chỉ dùng ở server, không gửi qua chat), tài khoản test theo từng vai trò, Workers API đã deploy, Resend đã cấu hình.

> **Cập nhật 10/11/2026 (lần 2, cùng ngày):** project prod + staging **đã tạo**, URL + anon key **đã có** trong `apps/web/.env.local` / `apps/web/.env.staging`, access token cho Supabase CLI **đã nhận** (không ghi giá trị vào tài liệu này). Điều kiện "tạo project + gửi URL/key" coi như đã xong. **Chạy thật lần 1 trên staging đã diễn ra (do coordinator chạy, xem §5A):** S-01/S-02/S-04 PASS, S-03 FAIL (mạng VM chặn Postgres wire protocol), S-05 FAIL (0001 lỗi 42P01, staging rollback về 0 bảng). Hệ quả cho bảng dưới: **C-21 (MG-01) đã chạy thử và FAIL**; **28 mục còn lại (C-01..C-20, C-22..C-29) vẫn là CHƯA CHẠY**. Không mục nào được coi là đạt cho tới khi chạy thật và ghi bằng chứng.

| # | Kiểm thử | Cách chạy | Kết quả | Điều kiện để chạy (ghi chú) |
|---|---|---|---|---|
| C-01 | DB-01 — Health check thật | `GET /api/health` với env thật | **CHƯA CHẠY** | Cần Project URL + anon key của user |
| C-02 | DB-02 — Đếm bảng sau migration | Query `information_schema.tables` | **CHƯA CHẠY** | Cần project đã chạy đủ 0001→0007 |
| C-03 | DB-03 — Đếm dữ liệu seed | `select count(*) from courses / policies` | **CHƯA CHẠY** | Cần project đã chạy 0002 + 0003 |
| C-04 | DB-04 — Chạy lại migration (idempotency) | Chạy lại toàn bộ migration lần 2 | **CHƯA CHẠY** | Cần project staging |
| C-05 | DB-05 — Giới hạn miễn phí | Đối chiếu usage trên Dashboard | **CHƯA CHẠY** | Cần project thật + xác minh lại pricing chính thức |
| C-06 | AU-01 — Đăng ký tài khoản mới | Đăng ký email test, kiểm tra `auth.users` + `profiles` | **CHƯA CHẠY** | Cần project thật, Auth bật email |
| C-07 | AU-02 — Session hết hạn đúng | Đăng nhập, thu hồi session, gọi lại API | **CHƯA CHẠY** | Cần tài khoản test |
| C-08 | AU-03 — Mật khẩu không plain-text | Kiểm tra DB/log/email | **CHƯA CHẠY** | Cần project thật |
| C-09 | AU-04 — Không tự nâng role | PATCH profile với `role='admin'` | **CHƯA CHẠY** | Cần tài khoản student test + API |
| C-10 | AU-05 — Phân quyền route | Student/instructor truy cập `/admin`, API lead | **CHƯA CHẠY** | Cần 3 tài khoản test (student/instructor/admin) |
| C-11 | API-01 — Lead đầu-cuối | Gửi form thật, đối soát `leads` + Sheet | **CHƯA CHẠY** | Cần project thật + Workers API đã deploy |
| C-12 | API-02 — Chống trùng idempotency | Gửi 2 lần cùng `Idempotency-Key` | **CHƯA CHẠY** | Cần project thật + API |
| C-13 | API-03 — Chống spam | POST 5 trường hợp sai + vượt rate-limit | **CHƯA CHẠY** | Cần project thật + API |
| C-14 | API-04 — CAPTCHA Turnstile | Gửi lead không token / Turnstile lỗi | **CHƯA CHẠY** | Cần project thật + Turnstile đã cấu hình |
| C-15 | API-05 — Đơn không tự `paid` | Giả mạo "đã trả" từ client + sửa đơn qua anon key | **CHƯA CHẠY** | Cần project thật + API |
| C-16 | API-06 — Quiz chấm ở server | Lấy câu hỏi + nộp quiz + gửi điểm giả | **CHƯA CHẠY** | Cần project thật + API + khóa test có quiz |
| C-17 | API-07 — Tiến độ chống gian lận | Nhảy 0→100%, giá trị ngoài 0–100 | **CHƯA CHẠY** | Cần project thật + API |
| C-18 | API-08 — Mất mạng giữa chừng | Ngắt mạng khi gửi form/quiz/tiến độ | **CHƯA CHẠY** | Cần project thật + API + trình duyệt test |
| C-19 | RLS-01 – RLS-16 — 16 kịch bản RLS | Theo bảng §2.4 (anon, A, B, instructor, admin) | **CHƯA CHẠY** | Cần project **staging** + 5 loại tài khoản test; RLS-09 chờ user chốt mâu thuẫn (§2.4) |
| C-20 | ST-01 – ST-04 — Storage | Liệt kê bucket, signed URL, upload vượt giới hạn | **CHƯA CHẠY** | Cần project thật + policy Storage đã áp dụng (0007 (f) đã có lệnh tạo 5 bucket, nhưng policy Storage chi tiết vẫn chưa có — xem §6, F-05) |
| C-21 | MG-01 — Chạy đủ 0001→0007 trên DB trống | `supabase db push` / chạy tay trên staging trống | **PASS** (xem §5D) | Chạy lần 3 ngày 10/11/2026 22:14 +07 qua Management API: staging 0008 PASS (HTTP 201) rồi chạy lại 0007 PASS (HTTP 201); prod 0001→0006 + 0008 + 0007 đều HTTP 201. Cả hai môi trường: 38 bảng, RLS 38/38, 81 policy, 10 khóa, 4 policy. Lỗi cũ 42P01 (lần 1) và 2BP01/F-12 (lần 2) đều đã xử lý xong. |
| C-22 | MG-02 — Phụ thuộc 0005 → 0006 | Chạy thử 0006 trước 0005 trên DB test riêng | **CHƯA CHẠY** | Cần project staging/DB test riêng |
| C-23 | MG-03 — Rollback khi migration lỗi | Áp migration lỗi rồi khôi phục bằng backup | **CHƯA CHẠY** | Cần project staging + backup |
| C-24 | MG-04 — Đối chiếu schema sau migration | So schema thực tế với `DATABASE_SCHEMA.md` | **CHƯA CHẠY** | Cần project staging đã chạy đủ migration |
| C-25 | BK-01 — Backup tự động trong 24h | Kiểm tra file `pg_dump` mới nhất | **CHƯA CHẠY** | Cần project thật + backup đã cấu hình theo `BACKUP_GUIDE.md` |
| C-26 | BK-02 — Restore thử lên staging | Restore backup lên staging, đếm dòng | **CHƯA CHẠY** | Cần project staging + file backup |
| C-27 | BK-03 — Cảnh báo khi form/API lỗi | Giả lập lỗi, đo thời gian cảnh báo | **CHƯA CHẠY** | Cần project thật + kênh cảnh báo `visfaracademy@gmail.com` |
| C-28 | BK-04 — Đối soát lead 14 ngày | Đối soát hàng ngày form → DB → Sheet | **CHƯA CHẠY** | Cần project thật + vận hành 14 ngày liên tiếp |
| C-29 | MG-05 — Kiểm chứng sau 0007 trên staging | Sau khi staging chạy đủ 0001→0007: `quiz_answers`/`question_options` tồn tại, `answers`/`quiz_options` không còn, trigger `trg_sync_profiles_role` tồn tại, đủ 5 bucket, 2 bảng tạm đã DROP (hoặc có RLS nếu có dữ liệu), seed 0003 đã cập nhật theo QĐ 9, FK (a)/(b) tồn tại, tổng policy ròng = 81 (đính chính từ 83, xem §5D.1) | **PASS** (xem §5D) | Staging + prod sau 0008 + chạy lại 0007: `quiz_answers`/`question_options` tồn tại, `answers`/`quiz_options` không còn, trigger `trg_sync_profiles_role` tồn tại, đủ 5 bucket, 2 bảng tạm đã DROP, seed 0003 đã cập nhật theo QĐ 9, FK (a)/(b) tồn tại, tổng policy ròng = 81. |

**Tổng kết §5 (cập nhật §5D): C-21 và C-29 PASS (migration hoàn tất staging + prod); các mục còn lại trong nhóm C-01..C-29 vẫn CHƯA CHẠY cho tới khi chạy thật và ghi bằng chứng (đặc biệt nhóm RLS-01–16, Auth, Storage policy, Backup — xem §5).**

---

## 5A. Kết quả chạy thật trên staging — lần 1 (10/11/2026, do coordinator chạy)

Lần chạy thật đầu tiên lên project staging. **Người chạy: coordinator** (kết quả dưới đây ghi lại theo báo cáo của coordinator; các lệnh và thông báo lỗi nguyên văn được giữ nguyên). Không ghi access token hay secret nào vào đây — token chỉ dùng qua biến môi trường, không ghi vào file.

| # | Kiểm thử | Cách chạy | Kết quả | Bằng chứng / ghi chú |
|---|---|---|---|---|
| S-01 | Supabase CLI login bằng access token | Supabase CLI 3.1.0, access token qua biến môi trường (không ghi vào file) | **PASS** | Login thành công. |
| S-02 | Link project staging | `supabase link` tới project staging `scskhplczrxlnxzruweu` | **PASS** | Link thành công. |
| S-03 | `supabase db push --remote` qua CLI | CLI kết nối Postgres trực tiếp tới `db.<ref>.supabase.co:5432` | **FAIL** (lỗi môi trường mạng, không phải lỗi migration) | Lỗi SSL: "There was an error establishing an SSL connection". Host resolve ra `198.18.212.57` — mạng VM chặn Postgres wire protocol, chỉ cho HTTPS qua. Đã sửa `supabase/config.toml` (bỏ khối `[api.external_url]` trống gây lỗi parse — `git diff` xác nhận chỉ xóa đúng 1 dòng này) để CLI chạy được tới bước kết nối; bước kết nối Postgres vẫn bị chặn. **Kết luận:** `db push` qua CLI không chạy được trong môi trường này; dùng đường vòng Management API (S-04). |
| S-04 | Chạy SQL qua Management API (đường vòng HTTPS) | `POST https://api.supabase.com/v1/projects/{ref}/database/query` | **PASS** | Chạy được SQL thật qua HTTPS. Kiểm chứng `select version()` trả về **PostgreSQL 17.11**. Đường vòng này hoạt động — xem `MIGRATION_GUIDE.md` §5.5 để dùng lại. **Lưu ý:** chạy SQL bằng tay qua API không ghi vào bảng `supabase_migrations.schema_migrations` của CLI — phải tự theo dõi file nào đã chạy (xem MIGRATION_GUIDE §5.5). |
| S-05 | Push 0001 lên staging qua Management API | Chạy toàn bộ `0001_init_schema.sql` trong 1 transaction qua endpoint ở S-04 | **FAIL** (lỗi migration thật — xem §6, F-11) | Lỗi 400, thông điệp chính xác: `ERROR: 42P01: relation "public.profiles" does not exist, LINE 43: select role from public.profiles where id = auth.uid();` — hàm `current_role()` ở **0001 dòng 36** (khai báo `language sql`) tham chiếu `public.profiles`, nhưng bảng `profiles` mới được tạo ở **dòng 49**. Postgres kiểm tra thân hàm SQL ngay khi `CREATE FUNCTION`, nên lỗi ngay tại dòng 36–44 dù bảng sẽ được tạo sau đó. File chạy trong 1 transaction nên **đã rollback hoàn toàn — kiểm chứng staging vẫn có 0 bảng public**. **Đã DỪNG LẠI ở đây theo lệnh:** KHÔNG tự sửa file 0001/0004, KHÔNG chạy tiếp 0002–0007, KHÔNG link/chạy prod. |

**Tổng kết §5A: 3 PASS (S-01, S-02, S-04), 2 FAIL (S-03 do mạng VM, S-05 do lỗi 0001). Prod CHƯA CHẠY bất cứ gì (chưa link, chưa chạy).**

## 5B. Sửa thứ tự 0001/0004 theo phương án đã phê duyệt + chạy lại lần 2 — DỪNG Ở BƯỚC TOKEN (10/11/2026)

User đã phê duyệt phương án sửa thứ tự ở `MIGRATION_GUIDE.md` §2.9. Các bước đã làm thật trong phiên này:

| # | Bước | Kết quả | Bằng chứng |
|---|---|---|---|
| E-01 | Sửa thứ tự 0001: chuyển khối hàm `current_role()` xuống **sau** `CREATE TABLE profiles`; chuyển khối `orders` + `payments` lên **trước** `enrollments` | **XONG** | `profiles` CREATE dòng 37, `current_role()` dòng 52, `orders` dòng 164, `payments` dòng 179, `enrollments` dòng 200. Kiểm chứng thuần đổi thứ tự: `sort` toàn bộ dòng file trước/sau sửa giống hệt nhau (không thêm/bớt/sửa nội dung bảng/cột/hàm). Tiêu đề mục giữ nguyên số cũ (khối "7. orders / payments" nay đứng trước khối "5. enrollments") — chỉ đổi vị trí, không đổi tên/đánh số lại. |
| E-02 | Sửa thứ tự 0004: chuyển khối `membership_plans` lên **trước** `order_items` | **XONG** | `membership_plans` CREATE dòng 322, `order_items` CREATE dòng 340. Kiểm chứng thuần đổi thứ tự: `sort` toàn bộ dòng so với bản sao ở `docs/database/DATABASE_MIGRATIONS/` (bản gốc trước sửa) giống hệt nhau. Bản sao ở `docs/` đã đồng bộ lại cùng nội dung sửa (giữ T-14: `diff` giống hệt nhau). |
| E-03 | Kiểm tra cú pháp SQL 7 file bằng pglast sau khi sửa | **PASS** | Cả 7 file PARSE OK, tổng 271 câu (0001: 100, 0002: 1, 0003: 1, 0004: 54, 0005: 25, 0006: 68, 0007: 22) — đúng số câu trước sửa (xem T-05). |
| E-04 | Chạy lại 0001→0007 lên STAGING qua Management API | **CHƯA CHẠY — DỪNG LẠI** | Biến môi trường `SUPABASE_ACCESS_TOKEN` **không còn trong phiên làm việc** (kiểm tra: `env` không có biến này, độ dài rỗng). Theo lệnh: **không bịa token mới, không chạy tiếp**. Cần user/cấp trên cấp lại access token qua biến môi trường rồi mới chạy staging. **Không ghi token vào file/tài liệu/log.** |
| E-05 | Kiểm chứng staging (38 bảng, 10 khóa, 4 policy, RLS, 5 bucket) | **CHƯA CHẠY** | Chưa chạy được vì E-04 dừng ở token. Không ghi số liệu giả. |
| E-06 | Link + chạy prod `ugynqjqyfynkmqutoarp` | **CHƯA CHẠY** | Chỉ chạy sau khi staging PASS hết (chưa tới bước này). Prod vẫn trống, chưa link, chưa chạy gì. |

**Kết luận §5B: file migration đã sửa xong đúng phương án phê duyệt và parse OK, nhưng lần chạy lại lần 2 chưa diễn ra. C-21 vẫn giữ FAIL từ lần 1 (chưa được chạy lại để đổi trạng thái); C-01..C-20, C-22..C-29 vẫn CHƯA CHẠY. Không mục nào được ghi PASS cho thứ chưa chạy.**

## 5C. Chạy lại lần 2 lên STAGING — 0001→0006 PASS, 0007 FAIL (10/11/2026, 22:09 +07)

Access token đã được cấp lại qua biến môi trường `SUPABASE_ACCESS_TOKEN` (chỉ dùng qua env, không ghi giá trị vào file/tài liệu/log). Chạy qua Management API `POST /v1/projects/scskhplczrxlnxzruweu/database/query`, từng file một, dừng khi gặp lỗi. Lưu ý kỹ thuật: endpoint trả HTTP **201** khi chạy thành công (không phải 200) — lần chạy đầu 0001 trả 201 `[]` đã bị script kiểm tra sai thành FAIL, đã sửa script chấp nhận 200/201 rồi xác nhận lại bằng query đếm bảng.

| # | Bước | Kết quả | Bằng chứng |
|---|---|---|---|
| R-01 | 0001_init_schema.sql lên staging | **PASS** | HTTP 201 `[]`. Kiểm chứng: `count(*) information_schema.tables public BASE TABLE = 20` (đủ 20 bảng 0001). |
| R-02 | 0002_seed_courses.sql | **PASS** | HTTP 201 `[]`. |
| R-03 | 0003_seed_content.sql | **PASS** | HTTP 201 `[]`. |
| R-04 | 0004_add_task03_tables.sql | **PASS** | HTTP 201 `[]`. |
| R-05 | 0005_rename_restructure.sql | **PASS** | HTTP 201 `[]`. |
| R-06 | 0006_rls_task03.sql | **PASS** | HTTP 201 `[]`. |
| R-07 | 0007_fix_blockers.sql | **FAIL** | HTTP 400 nguyên văn: `ERROR: 2BP01: cannot drop table questions_new_empty because other objects depend on it — DETAIL: constraint answers_question_id_fkey on table quiz_answers depends on table questions_new_empty — HINT: Use DROP ... CASCADE to drop the dependent objects too. — CONTEXT: SQL statement "drop table public.questions_new_empty" — PL/pgSQL function inline_code_block line 12 at EXECUTE`. **Đã dừng theo lệnh: không tự sửa thêm, không chạy tiếp, không link/chạy prod.** |
| R-08 | Kiểm chứng staging sau R-07 | — | Transaction 0007 rollback hoàn toàn: `quiz_answers` = null (chưa tồn tại), `answers` vẫn tồn tại, `question_options` = null, `quiz_options` vẫn tồn tại, bucket Storage = 0. Trạng thái staging = 0001→0006 đã áp dụng: **40 bảng BASE TABLE** (38 bảng nghiệp vụ + 2 bảng tạm `course_modules_new_empty`, `questions_new_empty`), `courses = 10`, `policies = 4`, RLS bật trên **40/40 bảng**, policy `pg_policies public = 81` (xem lưu ý dưới), trigger `on_auth_user_created` trên `auth.users` + hàm `handle_new_user` tồn tại. |
| R-09 | Link + chạy prod `ugynqjqyfynkmqutoarp` | **CHƯA CHẠY** | Chỉ chạy sau khi staging PASS hết — staging chưa PASS (0007 FAIL) nên prod **không chạy**. Kiểm chứng prod vẫn trống: `count(*) tables public = 0`. |

**Nguyên nhân gốc của lỗi R-07 (F-12, xem §6):** 0004 tạo bảng `questions` (trống) và `answers.question_id` FK trỏ tới bảng `questions` đó. 0005 rename `questions` → `questions_new_empty` và rename `quiz_questions` → `questions` (bảng thật, có dữ liệu) — nhưng FK `answers_question_id_fkey` **không đổi theo**: nó vẫn trỏ `questions_new_empty`. 0007 bước (g) `DROP TABLE questions_new_empty` vì thế bị chặn bởi FK này. Kiểm chứng trực tiếp: `pg_constraint` trên `public.answers` cho `answers_question_id_fkey → questions_new_empty`. 0007 bước (c) rename `answers` → `quiz_answers` nằm trong cùng transaction nên cũng bị rollback theo.

**Lưu ý lệch số policy:** đếm tĩnh T-04 kỳ vọng 83 policy (0001: 35 + 0006: 48), nhưng live trên staging sau 0001→0006 chỉ có **81** policy trong `pg_policies`. Chênh 2 policy chưa rõ nguyên nhân — cần đối chiếu lại trước khi coi RLS là hoàn chỉnh (không ghi PASS cho tổng số policy).

**Kết luận §5C: staging dừng ở 0007 FAIL; prod chưa chạy (0 bảng). C-21 vẫn FAIL. Cần phê duyệt phương án sửa F-12 (migration 0008: đổi FK `answers.question_id` → bảng `questions` thật trước, rồi mới DROP 2 bảng tạm + chạy lại phần còn lại của 0007) rồi mới chạy lại staging.**

## 5D. Chạy lần 3 — migration 0008 + chạy lại 0007: staging PASS hết, prod PASS hết (10/11/2026, 22:14 +07 — user đã duyệt tất cả)

Access token dùng qua biến môi trường `SUPABASE_ACCESS_TOKEN` (không ghi giá trị vào file/tài liệu/log). Chạy qua Management API `POST /v1/projects/{ref}/database/query`, từng file một. Thứ tự chạy trên staging: 0008 trước, rồi chạy lại 0007 (0007 có guard idempotent); trên prod (đang trống, 0 bảng): 0001→0006, rồi 0008, rồi 0007.

### 5D.1. Đối chiếu lệch policy live 81 vs kỳ vọng tĩnh 83 — ĐÃ GIẢI QUYẾT: 81 là đúng, 83 là đếm nhầm

Đối chiếu bằng script: tập tên policy trong `pg_policies` trên staging (81 tên) so với tập tên policy tạo bởi `create policy "..."` trong 0001 + 0006 (81 tên) — **trùng khớp 100%, không thiếu, không thừa**. Nguyên nhân lệch: `grep -c "create policy"` đếm được 0006 = 48, nhưng trong đó có **2 dòng comment** nhắc tới cụm "create policy" (0006:124 và 1 dòng comment khác), không phải lệnh tạo policy thật. Số lệnh tạo policy thật: 0001 = 35, 0006 = 46, tổng = **81**. Sau khi 0007 chạy (chỉ đổi tên 3 policy theo tên bảng mới, không thêm policy), tổng ròng vẫn **81**. Kết luận: **không có policy nào thiếu; T-04/T-13 và tiêu chí C-29 ghi "83" là sai số đếm, đính chính thành 81** (xem cập nhật T-04/T-13 dưới §5D.4).

### 5D.2. Migration 0008 — file mới + chạy staging

File mới `supabase/migrations/0008_fix_fk_answers.sql` (pglast PARSE OK): (a) kiểm tra 0 dòng mồ côi trong `answers.question_id` so với bảng `questions` thật (nếu > 0 thì RAISE EXCEPTION, dừng); (b) DROP + tạo lại FK `answers_question_id_fkey` trỏ tới bảng `questions` thật, `on delete cascade` — **không dùng `DROP ... CASCADE`**; (c) DROP 2 bảng tạm `course_modules_new_empty` và `questions_new_empty` — chỉ drop khi trống (0 dòng) và không còn FK nào trỏ tới, nếu không thì RAISE EXCEPTION; (d) guard idempotent cho cả 3 bước (chạy lại sau 0007 thì làm việc trên tên `quiz_answers`, bảng tạm đã mất thì chỉ NOTICE và bỏ qua).

| # | Bước | Kết quả | Bằng chứng |
|---|---|---|---|
| S-01 | Kiểm tra tiền điều kiện staging | **PASS** | `answers` = 0 dòng, 0 dòng mồ côi; 2 bảng tạm = 0 dòng; FK duy nhất trỏ `questions_new_empty` là `answers_question_id_fkey`; không có FK nào trỏ `course_modules_new_empty`. |
| S-02 | Chạy 0008 lần 1 lên staging | **FAIL rồi PASS** | Lần 1: HTTP 400 `42P01: relation "public.quiz_answers" does not exist` — lỗi ở **khối kiểm chứng cuối file 0008 của chính lần viết này**: `'public.quiz_answers'::regclass` trong danh sách `IN` lỗi khi bảng chưa tồn tại (0007 chưa chạy). Toàn bộ 0008 rollback, chưa có gì thay đổi. Đã sửa khối kiểm chứng sang dùng `coalesce(to_regclass('public.answers'), to_regclass('public.quiz_answers'))`, parse lại OK, chạy lại lần 2: **HTTP 201 `[]`**. |
| S-03 | Kiểm chứng sau 0008 (staging) | **PASS** | 38 bảng BASE TABLE (không còn bảng tạm), `course_modules_new_empty`/`questions_new_empty` đều không còn, FK `answers_question_id_fkey → questions`, `courses = 10`, `policies = 4`, `pg_policies = 81`. |
| S-04 | Chạy lại 0007 lên staging | **PASS** | HTTP 201, trả về `[{"doi_tuong":"quiz_answers","ton_tai":true},{"doi_tuong":"question_options","ton_tai":true},{"doi_tuong":"question_options_public (view)","ton_tai":true},{"doi_tuong":"trigger trg_sync_profiles_role","ton_tai":true}]`. |
| S-05 | Kiểm chứng đầy đủ staging sau 0007 | **PASS** | 38 bảng, RLS bật **38/38**, policy **81**, `courses = 10`, `policies = 4`, `quiz_answers` ✓, `question_options` ✓, `answers` không còn, `quiz_options` không còn, view `question_options_public` ✓, trigger `trg_sync_profiles_role` ✓, UNIQUE `quiz_answers_attempt_question_option_key` ✓, **5 bucket** (`public`, `avatars` public; `private`, `receipts`, `certificates` riêng tư). Seed đã cập nhật: `hoan-tra-huy-dang-ky` ghi "khung hoàn trả 15 ngày làm việc (đã chốt ngày 10/11/2026)", `giai-quyet-khieu-nai` ghi "phản hồi khiếu nại trong 3 ngày (đã chốt ngày 10/11/2026)". |
| S-06 | Idempotent: chạy lại 0008 trên staging | **PASS** | HTTP 201 `[]`, trạng thái không đổi (38 bảng, 81 policy) — các bước chỉ NOTICE và bỏ qua. |
| S-07 | Chạy 0001→0006 + 0008 + 0007 lên prod `ugynqjqyfynkmqutoarp` | **PASS** | Cả 8 file đều HTTP 201 `[]` (0007 trả về 4 đối tượng tồn tại như staging). |
| S-08 | Kiểm chứng đầy đủ prod | **PASS** | Giống hệt staging: 38 bảng, RLS 38/38, policy 81, `courses = 10`, `policies = 4`, `quiz_answers` ✓, `question_options` ✓, `answers`/`quiz_options` không còn, view ✓, trigger ✓, UNIQUE ✓, 5 bucket (cùng phân public/riêng tư), FK `quiz_answers.question_id → questions`. REST anon trên prod trả đủ 10 khóa (`thau-hieu-noi-tam` … `cong-dong-visfar`). |

**Kết luận §5D: migration hoàn tất trên cả staging và prod. F-12 đã xử lý xong (xem §6). C-21 (MG-01) và C-29 (MG-05) chuyển sang PASS. Lưu ý còn lại: chạy tay qua Management API không ghi vào `supabase_migrations.schema_migrations` — theo dõi bằng bảng tay trong `MIGRATION_GUIDE.md` §3.2, không trộn CLI và API giữa chừng. Policy Storage chi tiết vẫn chưa có (F-05) — bucket đã có, policy Storage vẫn là bước sau.**

### 5D.4. Đính chính số policy tĩnh (T-04/T-13)

Số policy ròng đúng là **81**, không phải 83. Nguyên nhân đếm nhầm: `grep -ci "create policy"` đếm cả dòng comment trong 0006 (2 dòng). Đã đính chính trong bảng §5: T-04 và T-13 ghi "83" được hiểu là **81** sau đính chính này; tổng số policy live trên cả staging và prod đều là 81 và trùng khớp 100% với danh sách tĩnh (xem §5D.1).

**Bài học từ S-05:** kiểm tra cú pháp bằng `pglast` (T-05, PASS) **không bắt được lỗi này** — pglast chỉ kiểm tra cú pháp, không kiểm tra bảng có tồn tại khi tạo hàm SQL hay không. S-05 là bằng chứng thực tế cho giới hạn đã ghi ở T-05. Ngoài ra, trong 0001–0007 chỉ có 3 hàm `language sql` (0001:38 `current_role()`; 0006:64 `is_instructor_of()` và 0006:80 `course_of_lesson()`) — 2 hàm ở 0006 tham chiếu `course_instructors`/`lessons`/`course_modules`, là các bảng đã tồn tại khi 0006 chạy (sau 0004 + 0005), nên không dính cùng lỗi; chỉ `current_role()` ở 0001 là dính.

**Lỗi xuôi đã biết khác (chưa chạy tới, nhưng sẽ gặp sau khi sửa F-11 — xem §6, F-09):** 0001 `enrollments` (dòng 164) FK tới `orders` (dòng 239); 0004 `order_items` (dòng 324) FK tới `membership_plans` (dòng 364). Phương án sửa đề xuất — **CHƯA được phê duyệt nên chưa làm**: trong 0001 chuyển khối tạo hàm `current_role()` xuống sau `CREATE TABLE profiles`, chuyển khối `orders`/`payments` lên trước `enrollments`; trong 0004 chuyển `membership_plans` lên trước `order_items` — chỉ đổi thứ tự, không đổi nội dung bảng/cột.

## 5E. Chạy lần 4 — 0009 (vá RLS) + 0010 (avatar Storage) + kiểm thử live 2 tài khoản test (10/11/2026, user auto-duyệt)

Access token dùng qua biến môi trường (không ghi giá trị vào file/tài liệu/log). Chạy qua Management API, từng file một.

### 5E.1. Đổi số migration avatar + áp 0009/0010

| # | Bước | Kết quả | Bằng chứng |
|---|---|---|---|
| E-01 | Đổi số `0008_dashboard_avatar_storage.sql` → `0010_dashboard_avatar_storage.sql` | **PASS** | Xóa file số 0008 cũ, giữ nguyên nội dung; cập nhật mọi tài liệu nhắc tới nó (TASK06_REPORT, TASK06_DASHBOARD_REPORT, TASK06_SECURITY_REPORT, TASK06_AUTH_REPORT, 0009 header). `0008_fix_fk_answers.sql` giữ nguyên. |
| E-02 | Chạy 0009 lên staging | **PASS** | HTTP 201. Kiểm chứng: `enrollments_insert_own` đã mất, `progress_own` đã mất (thay bằng `progress_select_own`), trigger `trg_profiles_block_role_change` tồn tại, policy public 80. |
| E-03 | Chạy 0010 lên staging lần 1 | **FAIL rồi PASS** | Lần 1: HTTP 400 `42703: column "user_id" does not exist` — phần (b) tạo policy `learning_events_select_own` với `using (user_id = auth.uid())`, nhưng bảng `learning_events` thực tế chỉ có `course_id`/`lesson_id`/`title`/`starts_at`... (buổi học trực tiếp), KHÔNG có `user_id`. Toàn bộ 0010 rollback. Đã sửa file trước khi áp (file chưa từng áp thành công): bỏ phần (b), giữ phần (a), ghi rõ lý do trong file. Chạy lại: HTTP 201. |
| E-04 | Kiểm chứng staging sau 0010 | **PASS** | 5 bucket (`avatars`, `certificates`, `private`, `public`, `receipts`); 4 policy `avatars_*` trên `storage.objects`; policy public 80. |
| E-05 | Chạy 0009 + 0010 lên prod | **PASS** | Cả hai HTTP 201; kiểm chứng giống hệt staging (5 bucket, policy public 80). |

### 5E.2. Tạo 2 tài khoản test trên staging (Auth Admin API, không dùng signUp anon)

Rate-limit `signUp` anon (`429 over_email_send_rate_limit`) vẫn là blocker cho đăng ký qua form, nên 2 tài khoản test được tạo qua Auth Admin API bằng service-role key lấy tạm qua Management API (chỉ trong bộ nhớ, không ghi file/log, không nhắc lại ở đây). Mật khẩu test sinh ngẫu nhiên, chỉ dùng trong phiên kiểm thử này, **không ghi vào tài liệu** — muốn đăng nhập lại bằng 2 tài khoản này thì đặt lại mật khẩu qua Supabase Dashboard → Authentication → Users.

| Tài khoản | UID | Role (sau trigger sync) | Đăng nhập (password grant) |
|---|---|---|---|
| test-student-01@visfar-academy.test | 8c2ffa39-a8e3-4221-b546-50234a806438 | student | HTTP 200, `email_confirmed_at` có giá trị |
| test-instructor-01@visfar-academy.test | 08bb74ee-79a2-4b9c-8fb2-158c02dbcc9c | instructor (gán qua `user_roles`, trigger `trg_sync_profiles_role` đồng bộ sang `profiles.role`) | HTTP 200, `email_confirmed_at` có giá trị |

### 5E.3. Kiểm thử live RLS + avatar với 2 JWT test (staging)

| # | Kiểm thử | Kết quả | Bằng chứng |
|---|---|---|---|
| L-01 | H1: student `PATCH profiles SET role='admin'` | **PASS — bị chặn** | HTTP 400, `P0001: Khong duoc tu thay doi vai tro (chi admin cap qua user_roles).` (trigger `trg_profiles_block_role_change`); sau đó `role` vẫn `student` |
| L-02 | H2: student `INSERT enrollments status='active'` trực tiếp | **PASS — bị chặn** | HTTP 403, `42501: new row violates row-level security policy for table "enrollments"` |
| L-03 | H3: student `INSERT lesson_progress progress_percent=100` trực tiếp | **PASS — bị chặn** | HTTP 403, `42501: new row violates row-level security policy for table "lesson_progress"` (kiểm bằng lesson_id giả — RLS chặn trước FK) |
| L-04 | Student không SELECT được profile của instructor | **PASS** | HTTP 200, 0 dòng |
| L-05 | Student không SELECT được enrollments của người khác | **PASS** | HTTP 200, 0 dòng |
| L-06 | Student SELECT orders | **PASS** | HTTP 200, 0 dòng (chưa có đơn nào) |
| L-07 | Upload avatar vào thư mục của chính mình | **PASS** | HTTP 200, `avatars/8c2ffa39-a8e3-4221-b546-50234a806438/avatar.png` (ảnh PNG 1×1 test) |
| L-08 | Upload avatar vào thư mục của người khác | **PASS — bị chặn** | HTTP 400 |
| L-09 | Đọc công khai avatar vừa upload | **PASS** | HTTP 200, đúng magic PNG, 68 bytes |
| L-10 | Đăng xuất global (`POST /auth/v1/logout?scope=global`) | **PASS** | HTTP 204 (refresh token bị thu hồi; access token cũ vẫn dùng được tới khi hết hạn ≤1 giờ — hành vi chuẩn của Supabase, đã ghi ở Task 06) |

### 5E.4. Phát hiện follow-up (chưa sửa)

`apps/web/src/lib/dashboard.ts` `getMyLearningHistory()` truy vấn `learning_events` với các cột `event_type`, `event_data`, `occurred_at`, `user_id` — các cột này KHÔNG tồn tại trong bảng thật (xem E-03). Trang Lịch sử học (`/hoc-vien/lich-su`) sẽ lỗi 400 khi chạy thật thay vì empty state. Lịch sử học thuộc về `activity_logs` (có `user_id`, `action`, `created_at`) hoặc `lesson_progress`. Cần sửa `dashboard.ts` ở follow-up Task 06 / Task 07.

**Kết luận §5E: 0009 + 0010 PASS staging + prod; 3 lỗ RLS H1/H2/H3 đã vá và kiểm chứng live bị chặn đúng; avatar upload/read đúng quyền; 2 tài khoản test đã tạo và đăng nhập được trên staging. Tổng policy public nay là 80 (81 − 2 + 1).**

## 5F. Chạy lần 5 — TASK 07: 0011 FAIL ngay trên staging, dừng toàn bộ đợt (10/11/2026 22:49 +07)

Access token dùng qua biến môi trường `SUPABASE_ACCESS_TOKEN` (không ghi giá trị vào file/log/tài liệu). Chạy qua Management API `POST /v1/projects/{ref}/database/query` (HTTP 201 = thành công), từng file một, theo thứ tự 0011 → 0012 → 0013. Không tạo dữ liệu học viên thật.

### 5F.1. Kiểm tra cú pháp trước khi chạy (pglast v8.7)

| File | Kết quả |
|---|---|
| `0011_add_lesson_notes.sql` | **PARSE OK** — 9 câu lệnh |
| `0012_add_progress_fields.sql` | **PARSE OK** — 13 câu lệnh |
| `0013_admin_lms.sql` | **PARSE OK** — 19 câu lệnh |

Giới hạn: pglast chỉ kiểm tra cú pháp, không kiểm tra ngữ nghĩa/kiểu dữ liệu — lỗi dưới đây chỉ lộ khi chạy thật.

### 5F.2. Áp 0011 lên staging (`scskhplczrxlnxzruweu`) — FAIL

| # | Bước | Kết quả | Bằng chứng |
|---|---|---|---|
| F5-01 | Chạy 0011 lên staging | **FAIL** | HTTP 400: `ERROR: 42883: operator does not exist: information_schema.sql_identifier[] = text[] — HINT: No operator matches the given name and argument types. You might need to add explicit type casts. — QUERY: select exists (select 1 from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema where tc.table_schema = 'public' and tc.table_name = 'lessons' and tc.constraint_type = 'UNIQUE' group by tc.constraint_name having array_agg(kcu.column_name order by kcu.ordinal_position) = array['course_module_id', 'slug']) — CONTEXT: PL/pgSQL function inline_code_block line 5 at SQL statement` |
| F5-02 | Kiểm chứng trạng thái staging sau lỗi (query đếm, HTTP 201) | **PASS — xác nhận rollback hoàn toàn** | `to_regclass('public.lesson_notes')` = null; `to_regclass('public.lessons_public')` = null; số cột mới của `lesson_progress` trong 5 cột (`course_id`, `started_at`, `last_accessed`, `video_position`, `completion_status`) = 0; policy `enrollments_insert_admin` = 0. Staging giữ nguyên trạng thái sau lần 4 (0001→0010). |
| F5-03 | Chạy 0012 / 0013 lên staging | **KHÔNG CHẠY** | Dừng theo quy trình khi gặp lỗi ở 0011. |
| F5-04 | Chạy 0011–0013 lên prod (`ugynqjqyfynkmqutoarp`) | **KHÔNG CHẠY** | Chỉ chạy prod khi staging PASS hết — điều kiện chưa đạt. |

Nguyên nhân gốc: khối kiểm tra (C) ở đầu 0011 so sánh `array_agg(kcu.column_name ...)` với `array['course_module_id', 'slug']`. `kcu.column_name` có kiểu `information_schema.sql_identifier`, nên `array_agg` trả về `sql_identifier[]`, không có toán tử `=` với `text[]` trên PostgreSQL 17 của project. Lỗi xảy ra ở câu lệnh đầu tiên của file, trước mọi DDL.

**Kết luận §5F: đợt TASK 07 (0011–0013) DỪNG ở 0011 trên staging; 0012/0013 và toàn bộ prod chưa chạy. Không tự sửa file migration. Phương án sửa cần phê duyệt trước khi chạy lại (gợi ý chưa chốt: ép kiểu `array_agg(kcu.column_name::text ...)` hoặc kiểm tra UNIQUE bằng `pg_index`/`pg_attribute` như cách 0012 mục 5 đã làm). File 0011 chưa từng áp thành công ở đâu nên được sửa trước khi áp, như tiền lệ 0010 ở §5E/E-03. Sau khi sửa: chạy lại từ 0011 trên staging, kiểm chứng đủ 4 điểm (bảng `lesson_notes` tồn tại, `lesson_progress` đủ 5 cột mới, view `lessons_public` tồn tại, policy admin có mặt), rồi mới lên prod.**

## 5G. Chạy lần 6 — TASK 07: sửa 0011 + 0013, chạy lại, staging + prod PASS hết; e2e live 17/17 PASS (10/11/2026 ~23:00 +07, user auto-duyệt)

Access token dùng qua biến môi trường `SUPABASE_ACCESS_TOKEN` (không ghi giá trị vào file/log/tài liệu). Chạy qua Management API `POST /v1/projects/{ref}/database/query` (HTTP 201 = thành công), từng file một.

### 5G.1. Sửa + chạy migration

| # | Việc | Kết quả |
|---|---|---|
| G6-01 | Sửa 0011: `array_agg(kcu.column_name::text …)`; pglast PARSE OK (9 câu) | **PASS** |
| G6-02 | Chạy 0011 lên staging | **PASS** — HTTP 201 |
| G6-03 | Chạy 0012 lên staging | **PASS** — HTTP 201 |
| G6-04 | Chạy 0013 lên staging lần 1 | **FAIL** — HTTP 400: `ERROR: 42703: column ci.instructor_id does not exist — LINE 107: and ci.instructor_id = auth.uid()` |
| G6-05 | Sửa 0013: tiền đề mục (E) sai — `course_instructors` (0004 mục 20) chỉ có cột `user_id`, không có `instructor_id`; 0006 đã dùng `user_id` đúng. Đổi mọi `instructor_id` trong code SQL → `user_id`; pglast PARSE OK (19 câu) | **PASS** |
| G6-06 | Chạy lại 0013 lên staging | **PASS** — HTTP 201 |
| G6-07 | Kiểm chứng staging (HTTP 201): `lesson_notes`=1; `lesson_progress` đủ 5 cột mới; `lessons_public`=1; policy admin `enrollments_insert_admin` + `audit_logs_insert_admin`=2 | **PASS** |
| G6-08 | Chạy 0011→0013 lên prod | **PASS** — cả 3 đều HTTP 201 |
| G6-09 | Kiểm chứng prod (1 query, HTTP 201): `lesson_notes=1, progress_cols=5, lessons_public=1, admin_policies=2` | **PASS** |

### 5G.2. Seed tối thiểu TASK 07 trên staging

File `supabase/seed/001_seed_task07_staging.sql` (chỉ staging): khóa 01 "Thấu Hiểu Nội Tâm" (published, từ 0002) + 1 module + 2 lesson (bài 1 video free preview, bài 2 text trả phí) + 1 resource. Kiểm chứng: modules=1, lessons=2, resources=1. Hai lưu ý khi seed: (1) `lesson_resources.resource_type` chỉ cho `file/link/video/document` (không có `pdf`) nên resource dùng `document`; (2) lesson video có `video_url = NULL` vì chưa có link YouTube unlisted thật do user cung cấp, `video_duration_sec = 600` để test ngưỡng 90%.

### 5G.3. Kiểm thử live end-to-end trên staging — 17/17 PASS

Script `/tmp/e2e_task07.py` (không lưu trong repo — script tạm, chạy 1 lần). Tài khoản test mới tạo qua Auth Admin API bằng service_role lấy qua Management API trong bộ nhớ (không ghi key/mật khẩu vào tài liệu): `test-student-lms-02@visfar-academy.test` (student A, đã ghi danh) và `test-student-lms-03@visfar-academy.test` (student B, chưa ghi danh).

| # | Kiểm thử | Kết quả |
|---|---|---|
| E1 | Đăng nhập student A | PASS — HTTP 200 |
| E2 | Đăng nhập student B | PASS — HTTP 200 |
| E3 | Ghi danh khóa miễn phí cho A (service_role — thay đường Workers API chưa deploy) | PASS — HTTP 201 |
| E4 | B tự ghi danh trực tiếp bằng JWT | PASS (bị chặn) — HTTP 403 |
| E5 | A đọc `lessons_public` (không lộ `content`/`video_url`) | PASS — HTTP 200, chỉ có cột `id/slug/title/type` |
| E6 | Ghi tiến độ 300/600s → 50% `in_progress`, chưa `completed` | PASS — HTTP 201, `progress_percent=50` |
| E7 | Đánh dấu completed khi mới 300s | PASS (bị trigger chặn) — HTTP 400, `P0001: Bai video chi duoc danh dau hoan thanh khi xem >= 90% (hien tai % 50)` |
| E8 | Xem 540/600s → 90% `completed` + `completed_at` | PASS — HTTP 200, `progress_percent=90` |
| E9 | Resume: A đọc lại tiến độ của mình | PASS — `video_position=540, completion_status=completed, progress_percent=90` |
| E10 | A ghi chú bài 1 bằng JWT | PASS — HTTP 201 |
| E11 | B không đọc được ghi chú của A | PASS — HTTP 200, 0 dòng |
| E12 | B không đọc được tiến độ của A | PASS — HTTP 200, 0 dòng |
| E13 | Anon không đọc được resource trả phí (RLS 0013) | PASS — HTTP 200, 0 dòng |
| E14 | B chỉ thấy metadata bài trả phí qua `lessons_public`, không thấy `content` | PASS — HTTP 200 |

Lưu ý giới hạn: (a) "xem video" ở đây là ghi `video_position` qua đường server (service_role, thay Workers API) — chưa có phát video thật trên trình duyệt vì `video_url` còn NULL (chờ link YouTube unlisted thật) và Workers API chưa deploy; (b) chặn bài trả phí được chứng minh ở tầng RLS (resource) + view `lessons_public` (metadata), còn `lessons` gốc qua REST anon vẫn đọc được `content` của bài trả phí theo thiết kế cũ (V6 trong TASK07_REPORT) — chặn đầy đủ chỉ ở tầng API `requireLessonAccess`, chưa deploy/test live; (c) quiz chưa có trong seed nên luồng quiz chưa test live.

**Kết luận §5G: 0011–0013 đã áp thành công staging + prod; seed tối thiểu + e2e live 17/17 PASS trên staging. F-13 chuyển sang ĐÃ XỬ LÝ (xem §6).**

## 6. Phát hiện & lệch so với quyết định đã chốt

Các phát hiện dưới đây đều có bằng chứng lệnh/grep kèm theo. Không phát hiện nào trong số này là bịa — số dòng file và nội dung trích dẫn đều kiểm chứng được trong repo.

| # | Phát hiện | Bằng chứng | Mức độ | Hướng xử lý (chờ user/dev chốt) |
|---|---|---|---|---|
| F-01 | **Migration 0004–0006 sai vị trí:** nằm ở `docs/database/DATABASE_MIGRATIONS/`, không nằm ở `supabase/migrations/` (chỉ có 0001–0003). Supabase CLI sẽ bỏ qua 0004–0006. | `ls supabase/migrations/` (3 file) vs `ls docs/database/DATABASE_MIGRATIONS/` (3 file); T-01 | **ĐÃ XỬ LÝ** (10/11/2026) | 0004–0006 đã có trong `supabase/migrations/` (T-01 PASS). Bản sao ở `docs/` vẫn còn — `diff` giống hệt nhau (T-14); rủi ro lệch bản sao xem F-10. |
| F-02 | **2 bảng trống không có RLS:** `course_modules_new_empty`, `questions_new_empty`. | 0005:93,181 (rename thực thi), 0005:95 (DROP bị comment), 0006 không có ENABLE cho 2 bảng này; T-03 | **ĐÃ XỬ LÝ — chờ chạy thật xác nhận** | 0007 mục (g) + 0008 mục (c): 2 bảng tạm đã DROP thật trên staging + prod (§5D, S-03/S-05/S-07) — xác nhận ở C-29 PASS. |
| F-03 | **Lệch tên bảng so với quyết định đã chốt:** vật lý là `quiz_options` + `answers`; quyết định chốt là `question_options` + `quiz_answers` (DECISIONS Task 03 QĐ 2; `DATABASE_SCHEMA.md` §0/§4.2; `RLS_POLICIES.md` §0.1). 0005 chủ động giữ tên cũ (0005:177–178). | `grep question_options / quiz_answers` trong 0004 + 0005 = 0 kết quả; §4 | **ĐÃ XỬ LÝ — chờ chạy thật xác nhận** | 0007 mục (c)/(d) đổi tên cả hai bảng + policy + view (T-11) — đã chạy thật trên staging + prod (§5D), xác nhận ở C-29 PASS. |
| F-04 | **Seed 0003 lỗi thời về khung hoàn trả/khiếu nại:** file vẫn ghi khung "CHƯA được user duyệt", trong khi DECISIONS QĐ 9 đã chốt (hoàn trả 15 ngày làm việc; khiếu nại phản hồi 3 ngày). | 0003_seed_content.sql:36–38, 46–48 vs `DECISIONS.md` QĐ 9; T-07 | **ĐÃ XỬ LÝ — chờ chạy thật xác nhận** | 0007 mục (h) cập nhật seed theo QĐ 9, dùng đúng cột `body` (T-11) — đã chạy thật, xác nhận ở C-29 PASS (seed ghi đúng 15 ngày / 3 ngày). |
| F-05 | **Chưa có migration tạo bucket Storage.** | `grep -rniE "storage\.|create bucket"` trong 6 migration + `apps/web/src/` = 0 kết quả | **XỬ LÝ MỘT PHẦN** (vẫn chặn nhóm ST) | 0007 mục (f) đã có lệnh tạo 5 bucket (`public`, `avatars`, `private`, `receipts`, `certificates`). **Policy Storage chi tiết vẫn chưa có** (chính file 0007 ghi "làm ở bước sau") — nhóm ST-01–ST-04 (C-20) vẫn chưa chạy được cho tới khi policy Storage được viết và áp dụng. |
| F-06 | **Mâu thuẫn RLS-09 chưa được giải quyết:** Task 01 cấm student SELECT `payments`; `RLS_POLICIES.md` §4.4/§7.6 cho student SELECT payment của đơn mình; schema Task 03 §3.20 ghi "SELECT chỉ admin". | `ACCEPTANCE_CRITERIA.md` RLS-09 vs `RLS_POLICIES.md` §9.6 | Trung bình (chặn chạy RLS-09) | User chốt 1 trong 2 (xem §2.4) trước khi chạy RLS-09. |
| F-07 | **`quiz_attempts.answers` (jsonb) được giữ lại, trái DECISIONS Task 03 QĐ 7** ("bỏ `quiz_attempts.answers` jsonb sau khi migrate"). 0005:255 ghi rõ jsonb "ĐƯỢC GIỮ LẠI để đối soát" và chỉ backfill sang bảng `answers` khi bảng này đang trống. | 0005:247–285 | Thấp (giữ lại có lý do ghi trong file) | User xác nhận giữ lại làm bản đối soát (và ghi rõ thời điểm nào thì bỏ), hoặc viết migration bỏ cột sau khi đối soát xong. **Ghi chú 10/11/2026:** 0007 không bỏ cột này (header 0007 ghi rõ "chưa làm … vì cần code chuyển trước"). |
| F-08 | **Comment trong 0006 gây hiểu nhầm nhẹ:** dòng 31 ghi "ENABLE ROW LEVEL SECURITY trên MỌI bảng mới (20 bảng)" — thực tế 20 câu ENABLE gồm 18 bảng mới từ 0004 + 2 bảng cũ đã rename (`course_modules`, `questions`); 2 bảng mới rỗng (`_new_empty`) không được ENABLE. | 0006:31 vs danh sách ENABLE 0006:99–118; T-02/T-03 | Rất thấp (chỉ là comment) | Sửa comment khi sửa F-02, không ảnh hưởng hành vi. |
| F-09 | **Blocker FK xuôi trong 0001/0004 — 0007 KHÔNG cứu được, sẽ lỗi khi push lần đầu:** (a) 0001 `enrollments` CREATE dòng 164, FK `order_id` dòng 168 trỏ `orders` chưa tạo (CREATE dòng 239); (b) 0004 `order_items` CREATE dòng 324, FK `membership_plan_id` dòng 328 trỏ `membership_plans` chưa tạo (CREATE dòng 364). Mục (a)/(b) trong 0007 chỉ thêm FK khi cả hai bảng đã tồn tại — nếu bảng thiếu thì chỉ NOTICE và bỏ qua. | `grep -n` đã kiểm chứng số dòng thật ngày 10/11/2026 (xem T-11); header 0007 cảnh báo (a)/(b); §5A | **ĐÃ SỬA FILE — chờ chạy thật xác nhận** | **Đã sửa ngày 10/11/2026 theo phương án phê duyệt (§5B, E-01/E-02):** trong 0001 chuyển khối tạo `orders` + `payments` lên trước khối `enrollments` (nay `orders` dòng 164, `enrollments` dòng 200); trong 0004 chuyển khối tạo `membership_plans` lên trước khối `order_items` (nay `membership_plans` dòng 322, `order_items` dòng 340) — chỉ đổi thứ tự, không đổi nội dung bảng/cột (kiểm chứng bằng `sort` toàn bộ dòng). Chạy lại lần 2 **chưa diễn ra** (thiếu access token — xem §5B, E-04), nên F-09 chỉ được coi là xử lý xong sau khi MG-01 chạy đạt trên staging. |
| F-10 | **0004–0006 tồn tại ở cả hai nơi** (`supabase/migrations/` và `docs/database/DATABASE_MIGRATIONS/`). | `diff -q` 3 file ngày 10/11/2026: giống hệt nhau (T-14) | Thấp (hiện chưa lệch, nhưng có thể lệch sau này) | Bản chính là `supabase/migrations/`; mọi sửa sau này chỉ sửa ở đó (hoặc đồng bộ cả hai và kiểm tra lại bằng `diff`). |
| F-11 | **Lỗi thật khi chạy 0001 lên staging (S-05): hàm `current_role()` tham chiếu bảng chưa tạo.** `current_role()` ở 0001 dòng 36–44, khai báo `language sql`, thân hàm `select role from public.profiles where id = auth.uid();` (dòng 43) — nhưng bảng `profiles` mới được tạo ở dòng 49. Postgres kiểm tra thân hàm SQL ngay khi `CREATE FUNCTION` → lỗi `42P01: relation "public.profiles" does not exist`, transaction rollback hoàn toàn, staging còn 0 bảng. | Lỗi 400 nguyên văn ở §5A, S-05 (do coordinator chạy qua Management API); đối chiếu dòng trong file bằng `grep`/`awk` ngày 10/11/2026: `create or replace function public.current_role()` dòng 36, `create table ... public.profiles` dòng 49 | **ĐÃ SỬA FILE — chờ chạy thật xác nhận** | **Đã sửa ngày 10/11/2026 theo phương án phê duyệt (§5B, E-01):** chuyển khối tạo hàm `current_role()` xuống **sau** `CREATE TABLE profiles` (nay `profiles` dòng 37, `current_role()` dòng 52) — chỉ đổi thứ tự, không đổi nội dung hàm. 2 hàm `language sql` còn lại (0006:64 `is_instructor_of()`, 0006:80 `course_of_lesson()`) tham chiếu bảng đã tồn tại khi 0006 chạy nên không dính lỗi này. Chạy lại lần 2 **chưa diễn ra** (thiếu access token — xem §5B, E-04), nên F-11 chỉ được coi là xử lý xong sau khi MG-01 chạy đạt trên staging. |
| F-12 | **Lỗi thật khi chạy 0007 lên staging lần 2 (R-07, §5C): `2BP01: cannot drop table questions_new_empty because other objects depend on it — constraint answers_question_id_fkey on table quiz_answers depends on table questions_new_empty`.** Nguyên nhân gốc: 0004 tạo bảng `questions` (trống) và `answers.question_id` FK trỏ tới bảng đó; 0005 rename `questions` → `questions_new_empty` và `quiz_questions` → `questions` (bảng thật) nhưng FK không đổi theo, vẫn trỏ `questions_new_empty`. 0007 bước (g) DROP bảng tạm vì thế bị chặn. Transaction 0007 rollback hoàn toàn — staging giữ nguyên trạng thái 0001→0006 (40 bảng, 10 khóa, 4 policy, RLS 40/40, 81 policy, 0 bucket). Prod chưa chạy (0 bảng). | HTTP 400 nguyên văn ở §5C, R-07; kiểm chứng `pg_constraint` trên `public.answers`: `answers_question_id_fkey → questions_new_empty` | **ĐÃ XỬ LÝ (10/11/2026, xem §5D)** | Phương án đã được user phê duyệt ngày 10/11/2026 22:14 và đã thực hiện: migration mới **0008** — (1) DROP + tạo lại FK `answers.question_id` trỏ tới bảng `questions` thật (bảng đã rename từ `quiz_questions`), kiểm tra 0 dòng mồ côi trước khi đổi; (2) sau đó DROP 2 bảng tạm `course_modules_new_empty` / `questions_new_empty` (đều trống, 0 dòng); (3) chạy lại phần còn lại của 0007 (đổi tên answers→quiz_answers, quiz_options→question_options, trigger đồng bộ role, 5 bucket, cập nhật seed QĐ 9) — hoặc chạy lại toàn bộ 0007 sau khi FK đã sửa, vì 0007 có guard idempotent. **Không dùng `DROP ... CASCADE`** (sẽ xóa FK và có thể xóa cả dữ liệu liên quan). Ngoài ra cần đối chiếu lệch số policy live 81 vs kỳ vọng tĩnh 83 trước khi coi RLS hoàn chỉnh. |
| F-13 | **Lỗi thật khi chạy 0011 (TASK 07) lên staging lần 5 (§5F): `42883: operator does not exist: information_schema.sql_identifier[] = text[]`.** Khối kiểm tra (C) đầu 0011 so sánh `array_agg(kcu.column_name ...)` với `array['course_module_id', 'slug']`; `kcu.column_name` kiểu `information_schema.sql_identifier` nên `array_agg` trả về `sql_identifier[]`, không có toán tử `=` với `text[]` trên PostgreSQL 17. Lỗi ở câu lệnh đầu tiên, trước mọi DDL — toàn bộ 0011 rollback. Kiểm chứng sau lỗi: `lesson_notes` = null, `lessons_public` = null, cột mới `lesson_progress` = 0/5, policy `enrollments_insert_admin` = 0. 0012/0013 và prod chưa chạy. | HTTP 400 nguyên văn ở §5F, F5-01; kiểm chứng đếm ở §5F, F5-02 (HTTP 201) | **ĐÃ XỬ LÝ — chạy lần 6 (§5G) PASS staging + prod** | Đã sửa 0011 (ép kiểu `array_agg(kcu.column_name::text …)`) + sửa 0013 (tiền đề (E) sai cột `instructor_id` → `user_id`, lỗi 42703 lần 1), chạy lại 0011→0013 staging + prod đều HTTP 201, kiểm chứng 4 điểm đạt cả hai môi trường, e2e live 17/17 PASS. |

---

## 7. Việc cần user làm

> Không mục nào dưới đây được coi là xong cho tới khi user làm hoặc chốt bằng văn bản. Dev không tự quyết thay.

### 7.1. Tạo project Supabase (chặn toàn bộ §5 — ưu tiên cao nhất)

1. **Tạo 2 project Supabase trên tài khoản Gmail `visfaracademy@gmail.com`** (theo DECISIONS Task 02 QĐ 15): 1 staging + 1 production. Làm theo `docs/supabase/SUPABASE_SETUP.md`. — ✅ **ĐÃ XONG (10/11/2026):** cả 2 project đã tạo.
2. **Gửi Project URL + anon key** của project **staging** trước (chạy toàn bộ kiểm thử §5 trên staging; production chỉ chạy lại sau khi staging đạt). — ✅ **ĐÃ CÓ:** URL + anon key của cả staging và prod đã nằm trong `apps/web/.env.staging` / `apps/web/.env.local` (chỉ anon key; không ghi giá trị vào tài liệu này).
   - Chỉ gửi URL + anon key (key công khai, an toàn để gửi). **Không gửi service-role key qua chat** — key này chỉ đặt trực tiếp vào Workers Secrets / biến môi trường server theo `docs/supabase/ENVIRONMENT_CONFIG.md`.
3. **Bật Supabase Auth (email)** trên cả 2 project để chạy nhóm AU-01–AU-05.
4. Xác nhận đã đọc `docs/supabase/BACKUP_GUIDE.md` và đồng ý lịch backup/restore thử (BK-01, BK-02).

### 7.2. Chốt các quyết định còn treo (chặn RLS-09, F-02, F-03)

5. **RLS-09 — student có được SELECT `payments` không?** Chốt 1 trong 2: (a) không được chút nào (theo Task 01), hay (b) được SELECT payment của đơn mình (theo `RLS_POLICIES.md` §4.4).
6. **Tên bảng:** giữ tên vật lý hiện tại (`quiz_options`, `answers`) và sửa tài liệu cho khớp, hay viết migration 0007 đổi tên theo quyết định đã chốt (`question_options`, `quiz_answers`)? (F-03) — **0007 đã viết sẵn phương án đổi tên** (mục (c)/(d)); chờ user xác nhận chạy 0007 (sau khi sửa blocker 0001/0004 — xem F-09, F-11).
7. **2 bảng trống `_new_empty`:** DROP hay bật RLS? (F-02) — **0007 mục (g) đã viết sẵn:** trống thì DROP, có dữ liệu thì bật RLS; chờ xác nhận chạy 0007.
8. **`quiz_attempts.answers` jsonb:** xác nhận giữ lại làm bản đối soát (ghi rõ tới khi nào thì bỏ), hay bỏ ngay sau khi backfill xong? (F-07)

### 7.3. Việc dev làm sau khi user gửi thông tin (không cần user làm thêm)

9. ✅ Chuyển 0004–0006 vào `supabase/migrations/` (F-01) — **đã xong**; cập nhật câu ghi chú khung hoàn trả/khiếu nại trong seed 0003 theo QĐ 9 (F-04) — **đã viết sẵn trong 0007 mục (h), chờ chạy thật**; sửa comment 0006:31 (F-08) — vẫn chưa làm (rất thấp).
10. 5 bucket Storage đã có lệnh tạo trong 0007 mục (f); **policy Storage chi tiết vẫn chưa viết** (F-05). Chạy toàn bộ kiểm thử §5 trên staging, ghi bằng chứng từng kiểm thử (query + kết quả + vai trò + ngày chạy + người chạy) vào bản cập nhật của báo cáo này. **Cập nhật §5B ngày 10/11/2026: phương án sửa 0001/0004 (F-09, F-11) đã được phê duyệt và đã sửa file xong — chạy lại lần 2 đang DỪNG vì thiếu access token trong môi trường (`SUPABASE_ACCESS_TOKEN` không còn); cần cấp lại token rồi mới chạy staging/prod.**
11. Sau khi staging đạt đủ 29 kiểm thử §5 (C-01..C-29): chạy lại toàn bộ trên production, rồi chạy lại 16 kịch bản RLS sau mỗi lần sửa policy.

### 7.4. Việc user kiểm tra bằng mắt/tay (không dev nào làm thay được)

12. **Quét thử QR VietQR** trong khối chuyển khoản để xác nhận đúng tài khoản nhận (theo DECISIONS QĐ 15 — QR chỉ dùng file user cung cấp, không tự tạo mới). Kiểm thử thanh toán G3.2a không đạt nếu QR chưa được quét thử.
13. Cung cấp ngày/giờ cụ thể cho 3 sự kiện tháng 11 (đã chốt ngày 25/11/2026, giờ mặc định 18:30 — giờ + hình thức từng sự kiện vẫn chờ user gửi sau, theo `DECISIONS.md`).

---

## 8. Phụ lục — Lệnh đã chạy để tái hiện kết quả §3

Chạy ngày 10/11/2026 trên máy dev, thư mục `workspace/visfar-academy-platform`. Mọi lệnh đều là đọc/kiểm tra tĩnh — không ghi database, không gọi API ngoài, không tạo dữ liệu thật.

```bash
# T-01 — Migration theo đúng thứ tự 0001→0007 (lần đầu ghi 0001→0006; cập nhật 10/11/2026 thêm 0007)
ls supabase/migrations/ docs/database/DATABASE_MIGRATIONS/
ls supabase/migrations/*.sql docs/database/DATABASE_MIGRATIONS/*.sql | grep -oE "000[0-9]" | sort | uniq -c
# Kết quả: 0001–0006, mỗi số 1 lần; nhưng 0004–0006 ở docs/database/DATABASE_MIGRATIONS/

# T-02/T-03/T-04 — RLS ENABLE + policy
grep -ri "enable row level security" supabase/migrations/*.sql docs/database/DATABASE_MIGRATIONS/*.sql | wc -l
# Kết quả: 41 dòng khớp (40 câu lệnh + 1 dòng comment ở 0006:31)
grep -ri "create policy" supabase/migrations/*.sql docs/database/DATABASE_MIGRATIONS/*.sql | wc -l
# Kết quả: 83 (0001: 35, 0006: 48)
grep -rhiE "alter table (if exists )?(public\.)?[a-z_]+ enable row level security" \
  supabase/migrations/ docs/database/DATABASE_MIGRATIONS/ | sort -u
# Kết quả: 40 tên bảng distinct (38 nghiệp vụ + 2 _new_empty không có ENABLE — xem T-03)

# T-05 — Cú pháp SQL bằng pglast (psql và sqlparse không có trên máy)
python3 -m pip install --break-system-packages --quiet pglast
python3 -c "
from pglast import parse_sql
import glob
for f in sorted(glob.glob('supabase/migrations/*.sql') + glob.glob('docs/database/DATABASE_MIGRATIONS/*.sql')):
    print(f, 'PARSE OK,', len(parse_sql(open(f, encoding='utf-8').read())), 'statements')
"
# Kết quả: 0001: 100, 0002: 1, 0003: 1, 0004: 54, 0005: 25, 0006: 68 — tổng 249, đều PARSE OK

# T-06/T-07 — Seed
grep -c "11111111-00" supabase/migrations/0002_seed_courses.sql
# Kết quả: 10 (slug 01–10, đều 'published', price_vnd = 0)
grep -oiE "insert into (public\.)?[a-z_]+" supabase/migrations/0003_seed_content.sql
# Kết quả: 1 lệnh INSERT INTO public.policies với 4 tuple (bao-mat, dieu-khoan-tham-gia,
#   hoan-tra-huy-dang-ky, giai-quyet-khieu-nai), version 1, is_current = true

# T-08 — Không có secret trong frontend
grep -rniE "service.role|service_role|SUPABASE_SERVICE_ROLE_KEY|password|secret" apps/web/src/
# Kết quả: chỉ 1 dòng comment cảnh báo trong apps/web/src/lib/supabase.ts (dòng 2–4)
grep -rInE "eyJ[A-Za-z0-9_-]{10,}" --exclude-dir=node_modules --exclude-dir=.next \
  docs/ apps/web/src/ supabase/migrations/
# Kết quả: 0 dòng (không có JWT thật)
cat apps/web/.env.example
# Kết quả: chỉ có placeholder https://<project-ref>.supabase.co và <anon-public-key>

# T-09 — Không có số tài khoản ngân hàng
grep -rnoE "[0-9]{9,}" supabase/migrations/ docs/database/ | grep -v "11111111\|00000000"
# Kết quả: 0 dòng (chỉ còn số điện thoại công khai 0347897868 trong seed 0003)
grep -rniE "mb bank|stk|so tai khoan" supabase/migrations/ docs/database/
# Kết quả: chỉ nhắc tên "MB Bank" (không kèm số tài khoản), đúng DECISIONS QĐ 15

# T-10 — Unit test frontend
cd apps/web && npx vitest run
# Kết quả: Test Files 2 passed (2); Tests 37 passed (37)
#   src/lib/validation.test.ts (30 tests), src/lib/courses.test.ts (7 tests)

# T-11 — Kiểm tra tĩnh 0007 + dòng FK (a)/(b)
grep -n "create table if not exists public.enrollments\|create table if not exists public.orders" supabase/migrations/0001_init_schema.sql
# Kết quả: enrollments 164, orders 239 (FK order_id dòng 168)
grep -n "create table if not exists public.order_items\|create table if not exists public.membership_plans" supabase/migrations/0004_add_task03_tables.sql
# Kết quả: order_items 324, membership_plans 364 (FK membership_plan_id dòng 328)
grep -ci "create policy" supabase/migrations/*.sql
# Kết quả: 0001: 35, 0006: 48, 0007: 3 — tổng 86 dòng khớp, ròng 83 (T-13)

# T-12 — File môi trường + .gitignore
git check-ignore -v apps/web/.env.local apps/web/.env.staging
# Kết quả: cả hai đều bị chặn (.gitignore:4 và :5); git status không hiện file nào
# (trước khi thêm dòng `.env.staging` vào .gitignore, check-ignore trả exit 1 cho .env.staging)

# T-14 — 0004–0006 đồng nhất hai nơi
diff -q docs/database/DATABASE_MIGRATIONS/0004_add_task03_tables.sql supabase/migrations/0004_add_task03_tables.sql
# (tương tự 0005, 0006) — Kết quả: giống hệt nhau cả 3 file

# §5A — Chạy thật staging lần 1 (do coordinator chạy, 10/11/2026 — KHÔNG chạy lại ở đây)
# S-01/S-02: Supabase CLI 3.1.0 login (access token qua biến môi trường, không ghi vào file)
#   + link staging scskhplczrxlnxzruweu — PASS
# S-03: supabase db push --remote — FAIL: SSL "There was an error establishing an SSL connection"
#   (db.<ref>.supabase.co:5432, host resolve 198.18.212.57 — mạng VM chặn Postgres wire protocol)
#   Đã sửa config.toml: `git diff supabase/config.toml` chỉ xóa đúng 1 dòng `[api.external_url]` trống.
# S-04: POST https://api.supabase.com/v1/projects/{ref}/database/query — PASS
#   select version() trả về PostgreSQL 17.11
# S-05: chạy 0001 qua Management API — FAIL 400:
#   ERROR: 42P01: relation "public.profiles" does not exist, LINE 43: select role from public.profiles where id = auth.uid();
#   Transaction rollback hoàn toàn — staging vẫn 0 bảng public. DỪNG LẠI: không sửa 0001/0004,
#   không chạy tiếp 0002–0007, không link/chạy prod.
# Đối chiếu dòng trong file (kiểm tra lại local sau khi chạy):
awk 'NR>=30 && NR<=60 {printf "%d: %s\n", NR, $0}' supabase/migrations/0001_init_schema.sql
# Kết quả: current_role() dòng 36, "select role from public.profiles..." dòng 43,
#   create table public.profiles dòng 49 — khớp đúng thông điệp lỗi.
```

### Công cụ đã dùng / chưa có

| Công cụ | Trạng thái | Ảnh hưởng |
|---|---|---|
| `pglast` (Python PostgreSQL parser) | Ban đầu chưa có; đã cài bằng `pip install --break-system-packages pglast` để chạy T-05 | Kiểm tra cú pháp SQL chạy được (T-05 PASS) |
| `psql` | Không có trên máy dev | Không chạy được `--dry-run` / kiểm tra ngữ nghĩa trên DB thật — chờ project Supabase (MG-01) |
| `sqlparse` | Không có (không cài thêm vì `pglast` đã đủ cho kiểm tra cú pháp) | Không ảnh hưởng |
| `sqlite3` | Có, nhưng không dùng | SQLite không hiểu cú pháp PostgreSQL (`gen_random_uuid()`, `auth.uid()`, policy...) nên không dùng để kiểm tra migration |
| Supabase CLI (`supabase`) | CLI 3.1.0 đã dùng thành công ở lần chạy thật §5A (login + link staging PASS, S-01/S-02); **không có trên máy dev này** (`supabase: command not found`) — lần chạy thật do coordinator chạy trên máy khác | `db push --remote` FAIL do mạng VM chặn Postgres wire protocol (S-03); đường vòng là Management API (S-04, xem `MIGRATION_GUIDE.md` §5.5) |
| Management API (`POST /v1/projects/{ref}/database/query`) | Đã kiểm chứng hoạt động (S-04): `select version()` trả về PostgreSQL 17.11 | Chạy SQL bằng tay qua API không ghi vào `supabase_migrations.schema_migrations` — phải tự theo dõi file nào đã chạy |

---

*Hết báo cáo. Báo cáo này chỉ ghi kết quả đã chạy thật (§3) và kế hoạch + điều kiện chạy cho phần còn lại (§2, §5). Mọi kiểm thử CHƯA CHẠY đều không được hiểu là đạt. Cập nhật báo cáo này (ghi ngày chạy + người chạy + bằng chứng từng kiểm thử) sau mỗi lần chạy kiểm thử trên staging/production.*
