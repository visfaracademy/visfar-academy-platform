# BÁO CÁO KIỂM TRA BẢO MẬT TOÀN BỘ — Visfar Academy (Task 12)

**Ngày báo cáo:** 10/11/2026
**Phạm vi:** `workspace/visfar-academy-platform/` — toàn bộ nền tảng (Next.js `apps/web`, Cloudflare Workers `workers/api`, Supabase migrations `0001–0016` + 4 file `0017`, tài liệu `docs/`).
**Tài liệu đã đọc:** `docs/database/RLS_POLICIES.md`, `docs/database/SECURITY_MODEL.md`, `docs/DECISIONS.md`, `docs/architecture/ROLE_PERMISSION_MATRIX.md`, `docs/architecture/API_ARCHITECTURE.md`, báo cáo Task 06 (`docs/frontend/TASK06_SECURITY_REPORT.md` + `TASK06_REPORT.md`), Task 07 (`docs/frontend/TASK07_REPORT.md`), Task 08 (`docs/frontend/TASK08_REPORT.md`), `docs/supabase/BACKEND_TEST_REPORT.md` (§5D–§5G), `tests/rls-manual.md`, toàn bộ migration `0001–0016` + 4 file `0017` (đọc tay các policy/hàm liên quan), code `apps/web/src` và `workers/api/src` (đọc tay các file bảo mật then chốt + grep toàn repo).
**Phương pháp:** kiểm chứng tĩnh (đọc code/policy, grep) + kiểm thử live bằng anon key staging (chỉ đọc, không tạo/sửa/xóa dữ liệu thật, không đăng nhập bằng tài khoản test vì mật khẩu test các đợt trước không được ghi lại — xem §6) + chạy test suite, typecheck, check-migrations, build.
**Không sửa code.** Mọi lỗi phát hiện chỉ ghi vào báo cáo này, không tự vá (theo yêu cầu task).

> **CẢNH BÁO VỀ TÍNH THỜI ĐIỂM (quan trọng):** repo đang được nhiều agent khác giao code song song TRONG LÚC kiểm tra (Task 09/10/11 đổ về liên tục 23:40–00:15 +07: `workers/api/src/sepay.ts`, `src/email/*`, `src/handlers/course-completion.*`, 4 file migration `0017`, `env.ts` thay đổi giữa các lần chạy). Mọi con số dưới đây chỉ đúng tại **thời điểm snapshot ghi trong từng mục**; chạy lại sau khi các nhóm dừng giao code có thể cho số khác. Đặc biệt: kết quả `vitest` Workers và `tsc` Workers thay đổi giữa các lần chạy vì file đang được ghi dở (xem §5).

## Cập nhật GĐ2 — 11/11/2026 (vá S-03 + S-04, KHÔNG sửa kết luận gốc ở dưới)

- **S-03 — ĐÃ VÁ TRÊN STAGING, CHƯA ÁP PROD (chờ user nghiệm thu).** Migration mới `0028_fix_s03_lessons_rls.sql` (số 0027 đã thuộc về đánh giá 11D của nhóm song song): drop `lessons_select_public`, thay bằng `lessons_select_enrolled` (chỉ admin / instructor khoa phụ trách / enrollment `active|completed` của khóa `published` mới SELECT được dòng trên bảng `lessons`); view mới `lessons_preview_video` (chỉ `id` + `video_url` bài xem thử). Áp staging **HTTP 201**. Kiểm chứng staging: anon REST `lessons` 0 dòng / 0 content (trước vá: bài trả phí 269 ký tự); `lessons_public` 2 dòng metadata; JWT học viên đã ghi danh đọc đủ 2 bài (`content` 121 + 269 ký tự); JWT chưa ghi danh 0 dòng; guard route local (staging env): đã ghi danh → 200 đủ `content` 269 ký tự, chưa ghi danh → 403 `not-enrolled`, bài xem thử → 200 `previewOnly:true` chỉ có `video_url` (không `content`/`file_url`). Code guard đổi theo: `lms-access.ts` đọc metadata qua view, đọc nội dung đầy đủ chỉ khi `ok`, đọc video mẫu qua view mới; `learning.ts` giữ `videoUrl` mẫu khi preview. Dữ liệu test đã xóa sạch. **Prod vẫn chạy policy cũ (chưa áp 0028) nên S-03 trên prod vẫn mở về mặt policy** — nhưng `content` seed prod đang rỗng nên chưa rò nội dung thật; KHÔNG bán khóa có content thật trên prod trước khi 0028 được áp prod.
- **S-04 — ĐÃ VÁ (CSP/HSTS/X-Frame-Options) + kiểm chứng live.** `next.config.ts` thêm CSP (YouTube/Supabase/Worker API/font self-hosted), HSTS `max-age=31536000; includeSubDomains` (không preload), `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`. Header đã đo thật trên production `https://visfaracademy.pages.dev` (200). CSP dùng `'unsafe-inline'`/`'unsafe-eval'` cho Next.js runtime — nâng lên nonce-based CSP là follow-up.
- **S-09 — ĐÃ SỬA.** `scripts/check-migrations.mjs` bỏ danh sách cứng, đếm động (số liên tục `0001..NNNN`, không trùng số) + kiểm tra nội dung 0028: **271/271 PASS, 0 FAIL**.
- **C-05-02 (liên quan Task 05, không thuộc S-01→S-18) — ĐẠT live:** POST `/api/v1/leads` 201 `duplicate:false` → 200 `duplicate:true` (cùng mã) → 409 `idempotency_conflict`; DB prod 1 dòng (Worker nối PROD), dòng test đã xóa, kiểm tra lại 0 dòng; `sheetSynced:false` nên Sheet không nhận dòng test.
- **Lưu ý vận hành mới:** nhiều agent build song song chung `.next` làm build sau ghi đè chunk của build trước (đã chứng minh: server chunk bake nhầm env prod trong lúc server staging đang chạy → guard trả 503 giả). Lần sau chỉ build khi không còn agent khác đang build.

## Kết luận tổng thể

**KHÔNG đủ điều kiện coi là “đạt bảo mật” để mở cho người dùng thật ngay.** Lý do:

1. **2 lỗi MỚI mức CAO, đều chưa live nhưng sẽ thành live nếu áp migration hiện có:**
   - **S-01:** học viên tự mở lại tài khoản bị vô hiệu hóa (`profiles.is_disabled`) — cùng mẫu lỗi H1 đã vá bằng 0009, nhưng cột mới `is_disabled` (migration `0017_admin_user_disable.sql`) không được trigger/REVOKE nào chặn. **Chưa áp staging** nên chưa khai thác được hôm nay — nhưng file 0017 ghi sai rằng “chỉ admin mới update được”.
   - **S-02:** **4 file migration cùng số `0017`** (`0017_admin_user_disable.sql`, `0017_lead_interactions.sql`, `0017_commerce_payment.sql`, `0017_email_unsubscribe_logs.sql`). Supabase theo dõi migration theo version — 1 hoặc nhiều file trong số này có thể **không bao giờ được áp mà không báo lỗi rõ**, hoặc áp sai thứ tự. Chưa file nào trong 4 file được áp lên staging (đã kiểm chứng live, §6).
2. **1 lỗi CAO đã live trên staging (đã biết từ Task 07, chưa sửa):** **S-03** — nội dung bài học trả phí đọc được qua REST anon (đã chứng minh live: bài 2 `is_free_preview=false` trả đủ `content`). Chỉ tầng API (`requireLessonAccess`) chặn; tầng RLS không chặn.
3. **Webhook thanh toán SePay chưa có endpoint nào** (S-11): logic xác minh chữ ký đã có dạng hàm pure (`workers/api/src/sepay.ts`, mới giao trong lúc kiểm tra) nhưng router chưa nối route; `SEPAY_WEBHOOK_SECRET` chưa có trong `Env`; không có code tạo đơn/thu tiền nào chạy thật — nên **không thể nhận tiền qua SePay**, và cũng chưa có gì để replay-attack. Trạng thái này an toàn theo nghĩa “chưa mở”, nhưng không được hiểu là “webhook đã chống replay”.
4. **H1–H4 (Task 06) đã vá đúng và đã kiểm chứng live bị chặn** (BACKEND_TEST_REPORT §5E) — xem §2. Không phát hiện lỗ leo thang quyền mới nào đang live.
5. **Không lộ secret/key trong code:** grep toàn `apps/web/src`, `workers/api/src`, `packages/shared/src` không thấy service-role key, JWT thật, API key hay secret hard-code; `.env.local`/`.env.staging` chỉ chứa anon (publishable) key; `.gitignore` chặn `.env*`; chỉ `.env.example` được commit.

## 1. Bảng tóm tắt 12 mục kiểm tra

| # | Mục | Kết quả | Mức độ |
|---|---|---|---|
| 1 | RLS | **FAIL** — H1–H4 đã vá (0009, live PASS §5E); nhưng: `lessons` lộ content bài trả phí cho anon (S-03, live); `event_registrations` cho anon INSERT trực tiếp (S-07, tĩnh); `profiles_update_own` không `WITH CHECK` — cột mới `is_disabled` tự sửa được (S-01, tiềm ẩn); `current_role()` đọc cache `profiles.role`, lệch QĐ “`user_roles` là nguồn duy nhất” (S-17) | **Cao** |
| 2 | IDOR | **PASS (có lưu ý)** — mọi route đọc/nộp/chấm đều kiểm tra `user_id`/enrollment/instructor theo khóa; quiz/assignment/submission/certificate đã test live Task 08 (B đọc dữ liệu A = 0 dòng). Lưu ý: `orders_admin_update`/`lead_interactions_admin_all` (0017) không có `WITH CHECK` (S-16, thấp); `payments` SELECT chỉ admin, học viên không đọc được payment của chính mình — lệch ma trận quyền (S-08, thấp) | Thấp |
| 3 | XSS | **PASS** — grep `dangerouslySetInnerHTML`/`innerHTML`/`document.write` trong `apps/web/src` + `workers/api/src` = 0 kết quả; không có render HTML người dùng. Lưu ý: cookie phiên chứa refresh token và JS đọc được (không HttpOnly) — nếu sau này xuất hiện 1 lỗ XSS thì session bị đánh cắp (S-05) | Thấp |
| 4 | SQL injection | **PASS** — mọi truy vấn app đi qua supabase-js (`.eq`/`.in`/`.rpc` với tham số); hàm SQL `submit_quiz_attempt`/`verify_certificate` không dùng input người dùng trong SQL động; SQL động duy nhất trong migration là DDL với `%I` (quote identifier). Không có string-interpolation SQL nào từ input | — |
| 5 | Authentication bypass | **FAIL (một phần)** — middleware chỉ đọc `exp` JWT, không verify chữ ký (đã ghi nhận từ Task 06, vẫn còn); mọi route/API thật đều verify qua `auth.getUser()` hoặc JWKS nên **không rò dữ liệu** (Task 06 đã chứng minh live: JWT giả qua middleware nhưng không lấy được dữ liệu). `/admin/*` + `/api/admin/*` chặn server bằng `requireAdmin()` (S-05) | **Trung bình** |
| 6 | Authorization bypass | **PASS (live đã kiểm chứng ở Task 07/08) + 1 lỗ tiềm ẩn** — admin route đều qua `getAdminContext()`/`requireAdmin()`; instructor sai cột `instructor_id` đã sửa xong (Task 08 §9.1). Lỗ tiềm ẩn: S-01 (tự mở lại tài khoản sau khi 0017 được áp) | **Cao (tiềm ẩn)** |
| 7 | API key exposure | **PASS** — không có service-role key/JWT/secret hard-code trong `src/`; service-role chỉ xuất hiện trong `workers/api/src` qua `env.SUPABASE_SERVICE_ROLE_KEY` (Workers Secrets); frontend chỉ dùng anon key; `.env.example` chỉ có tên biến; git không track file `.env` thật | — |
| 8 | File upload | **PASS (có lưu ý)** — avatar: whitelist ext `jpg/jpeg/png/webp` + ≤2 MB, đường dẫn `<uid>/avatar.<ext>`, policy Storage chỉ chủ sở hữu ghi; assignment: bucket private `submissions`, validate đuôi + 10 MB/file + tối đa 5 file, không trả `storage_path`, tải qua API stream có kiểm tra quyền. Lưu ý nhỏ: `contentType` khi upload avatar lấy từ `file.type` do client gửi, không suy ra từ ext (S-13, thấp) | Thấp |
| 9 | Rate limiting | **CHƯA ĐẠT (một phần)** — Workers: leads 5/giờ/IP + progress 100/phút/IP + 300/giờ/user, có `Retry-After`, đếm cả request lỗi validation (trừ 401/403) — PASS (có test). **Next.js API routes (`/api/v1/*`, `/api/admin/*`, `/api/lms/*`) không có rate-limit nào**; đăng nhập dựa vào rate-limit của Supabase Auth. Newsletter chưa có endpoint. Turnstile fail-open theo QĐ 13 (S-15) | **Trung bình** |
| 10 | Webhook replay | **CHƯA KIỂM (chưa có gì để kiểm)** — không có endpoint webhook nào được nối route: `POST /api/webhooks/sepay` chưa tồn tại, `POST /api/webhooks/resend` chưa tồn tại (code Svix verify đã có trong `src/email/svix.ts` nhưng router chưa gọi). Hàm verify SePay (HMAC-SHA256 + timing-safe + fail-closed) và Svix (5 phút tolerance chống replay) kiểm tra tĩnh PASS, nhưng **thuật toán chữ ký SePay thật CHƯA được xác nhận từ tài liệu SePay** (chính file code ghi rõ) | **Trung bình** |
| 11 | Duplicate payment | **PASS (tầng DB) / CHƯA KIỂM (tầng chạy thật)** — `UNIQUE (method, gateway_reference)` trên `payments` từ 0001 (NULL không tính trùng, đúng thiết kế); `orders.idempotency_key` UNIQUE (0017_commerce, chưa áp); `UNIQUE (user_id, course_id)` trên `enrollments`; idempotency leads đã chạy thật trong handler. Chưa có webhook/order thật để test replay end-to-end | Thấp |
| 12 | H1–H4 (0009) | **PASS** — đã vá + kiểm chứng live bị chặn (BACKEND_TEST_REPORT §5E, L-01→L-03); kiểm chứng tĩnh lại trong đợt này: policy lỗ đã drop, trigger + REVOKE còn nguyên trong 0009; không migration nào sau 0009 mở lại 3 đường ghi đó | — |

## 2. Kiểm chứng lại H1–H4 (Task 06, migration 0009)

| Lỗ | Trạng thái 0009 | Kiểm chứng đợt này |
|---|---|---|
| H1 — tự nâng `profiles.role` → `admin` | Trigger `trg_profiles_block_role_change` (chỉ chặn JWT non-admin) + `REVOKE UPDATE (role) FROM authenticated` + `profiles_insert_own` siết `role='student'` | **PASS.** File 0009 còn nguyên; không migration 0010–0017 nào chạm policy/trigger này. Live đã chứng minh ở BACKEND_TEST_REPORT §5E L-01: student PATCH `role='admin'` → HTTP 400 `P0001: Khong duoc tu thay doi vai tro…`, role vẫn `student`. |
| H2 — tự ghi danh khóa trả phí | `DROP POLICY "enrollments_insert_own"`, không policy thay thế | **PASS.** Grep toàn migration: không còn policy INSERT nào trên `enrollments` cho client (chỉ `enrollments_insert_admin` ở 0013, admin-only). Live §5E L-02: INSERT trực tiếp → HTTP 403 `42501`. |
| H3 — tự ghi tiến độ giả | Drop `progress_own`, chỉ còn `progress_select_own` | **PASS.** Live §5E L-03: INSERT `lesson_progress` 100% → HTTP 403 `42501`. Đường ghi duy nhất còn lại là Workers `/api/v1/progress` (JWT + enrollment + tính lại % từ position, §4). |
| H4 — `profiles_insert_own` không kiểm tra `role` | Tạo lại với `WITH CHECK (id = auth.uid() AND role = 'student')` | **PASS** (tĩnh). |

## 3. Lỗi phát hiện (mới trong đợt này — chưa sửa, theo yêu cầu task)

### S-01 — CAO (tiềm ẩn, chưa live): học viên tự mở lại tài khoản bị vô hiệu hóa

- **Bằng chứng tĩnh:** `supabase/migrations/0017_admin_user_disable.sql` thêm cột `profiles.is_disabled` nhưng ghi rõ “chỉ có cột `role` bị trigger 0009 chặn, cột `is_disabled` không bị chặn” và thừa nhận ở cuối file: “nếu muốn chặn học viên tự đổi `is_disabled` của mình thì cần thêm trigger/CHECK ở migration sau (follow-up)”.
- **Vì sao khai thác được:** policy `profiles_update_own` (0001:446–447) là `FOR UPDATE USING (id = auth.uid() OR current_role() = 'admin')` **không có `WITH CHECK`** — đúng mẫu lỗi H1. 0009 chỉ chặn cột `role` (trigger `BEFORE UPDATE OF role` + `REVOKE UPDATE (role)`). Sau khi 0017 được áp, học viên bị disable gọi trực tiếp Supabase REST `update profiles set is_disabled=false where id=<uid mình>` sẽ **thành công** (điều kiện `id = auth.uid()` vẫn đúng), tự mở lại tài khoản.
- **Hiện trạng live:** **chưa khai thác được hôm nay** — probe staging: `profiles?select=is_disabled` → HTTP 400 `42703: column profiles.is_disabled does not exist` (0017 chưa áp). Nhưng `is_disabled` hiện cũng **chưa được middleware/layout nào kiểm tra** (grep toàn `src/`: chỉ `admin-users.ts` đọc để hiển thị danh sách) — nên ngay cả khi sửa S-01, việc disable vẫn chưa có tác dụng chặn đăng nhập/học cho tới khi làm follow-up middleware mà chính file 0017 đã ghi.
- **Ngoài ra:** `setUserDisabled()` trong `admin-users.ts` là lib-only — **không có route `/api/admin/users/*` nào gọi nó**, không có trang `/admin/hoc-vien` hay `/admin/crm` nào (chỉ có link trong nav của `admin/layout.tsx` trỏ tới trang chưa tồn tại). Tính năng disable hiện chưa dùng được từ UI/API.
- **Hướng sửa (đề xuất, chưa làm):** trước khi áp 0017, thêm trigger `BEFORE UPDATE OF is_disabled, disabled_at, disabled_reason` chặn JWT non-admin (giống mẫu H1a) + `REVOKE UPDATE (is_disabled, disabled_at, disabled_reason) FROM authenticated`; đồng thời quyết định và làm lớp chặn đăng nhập/học cho tài khoản disabled. Không áp file 0017 ở trạng thái hiện tại.

### S-02 — CAO (quy trình): 4 file migration cùng số 0017

- **Bằng chứng:** `supabase/migrations/` hiện có **20 file SQL**, trong đó 4 file cùng số `0017`:
  - `0017_admin_user_disable.sql` (Task 09 2/4)
  - `0017_lead_interactions.sql` (Task 09 4/4)
  - `0017_commerce_payment.sql` (Task 10)
  - `0017_email_unsubscribe_logs.sql` (Task 11)
- **Ảnh hưởng:** Supabase CLI theo dõi migration theo version (số đầu tên file). 4 file cùng version có thể khiến 1+ file **không bao giờ được áp mà không báo lỗi rõ**, hoặc áp sai thứ tự (VD: `0017_commerce_payment` seed `system_settings` trước khi bảng/hàm liên quan sẵn sàng). Đây là lỗi cùng họ với vụ 3 file cùng số 0008 ở Task 06 (đã phải đổi số thủ công). Chưa file nào trong 4 file được áp lên staging (kiểm chứng live §6: `lead_interactions` 404, `orders.idempotency_key` / `email_logs.attempts` / `profiles.is_disabled` đều 42703).
- **Hướng sửa:** đổi số thành `0017`/`0018`/`0019`/`0020` theo đúng thứ tự phụ thuộc trước khi áp bất kỳ file nào; cập nhật `scripts/check-migrations.mjs` (hiện vẫn hard-code đúng 16 file — xem S-09).

### S-03 — CAO (live trên staging): nội dung bài học trả phí đọc được qua REST anon

- **Bằng chứng live (staging, anon key, 10/11/2026 ~23:55 +07):** `GET /rest/v1/lessons?select=id,title,content,video_url,file_url,is_free_preview&is_free_preview=eq.false` → HTTP 200, trả đủ `content` bài 2 “Thay đổi từ gốc nhận thức” (`is_free_preview=false`). `video_url`/`file_url` của bài seed này là `null` nên chưa chứng minh được rò rỉ video/file, nhưng cùng một policy sẽ lộ chúng ngay khi có giá trị thật.
- **Nguyên nhân:** policy `lessons_select_public` (0001:468) cho anon đọc mọi bài của khóa `published`; migration 0013 chỉ tạo view `lessons_public` (không content/URL) và siết `lesson_resources`, **không siết policy bảng `lessons` gốc**. Đây là quyết định QĐ 4 trong `RLS_POLICIES.md` §9.4 vẫn đang chờ phê duyệt (tách view hay giữ SELECT công khai + chặn ở API).
- **Giảm nhẹ:** UI đi qua API gated (`GET /api/lms/lessons/[id]` dùng `requireLessonAccessById`: chưa ghi danh → 403, không trả content/URL; bài xem thử chỉ trả bản preview đã lọc). Route tải tài liệu `/api/v1/resources/[id]/download` cũng đã được siết (kiểm tra enrollment — khác với báo cáo Task 08 §9.4 ghi B3 chưa sửa; file hiện tại đã có kiểm tra, mtime 22:42 UTC). Nhưng bất kỳ ai biết gọi REST trực tiếp đều đọc được nội dung text bài trả phí — với khóa học là sản phẩm chính thì đây là rò rỉ nội dung thật, không chỉ lý thuyết.
- **Hướng sửa:** phê duyệt QĐ 4 theo hướng đề xuất trong RLS_POLICIES (tách view `lessons_public` làm đường đọc công khai, thu hẹp policy bảng gốc), hoặc ít nhất đổi policy `lessons_select_public` để không trả `content`/`video_url`/`file_url` cho anon (PostgREST không hỗ trợ chọn cột theo role trong cùng policy — cần view + revoke SELECT bảng gốc khỏi anon/authenticated, chỉ cho service-role/API đọc).

### S-04 — TRUNG BÌNH: không có Content-Security-Policy

- **Bằng chứng:** `apps/web/next.config.ts` `headers()` chỉ đặt `X-Content-Type-Options: nosniff` và `Referrer-Policy: strict-origin-when-cross-origin`. Không có CSP, không có `X-Frame-Options`, không có HSTS. Grep toàn repo không thấy file `_headers` hay cấu hình header nào khác. Trong khi `docs/DECISIONS.md` QĐ 13 chốt “CSP theo tài liệu kiến trúc” và `SECURITY_MODEL.md` §9 ghi “Cloudflare Pages đặt CSP” — **không có bằng chứng nào trong repo cho thấy CSP được đặt ở đâu** (dashboard Cloudflare không kiểm chứng được từ repo).
- **Hướng sửa:** thêm CSP vào `next.config.ts` `headers()` (cho phép `youtube-nocookie`, Supabase, Turnstile; `frame-ancestors 'self'` thay X-Frame-Options) và kiểm chứng header thật trên domain deploy.

### S-05 — TRUNG BÌNH (đã biết, chưa sửa): middleware không verify chữ ký JWT + cookie phiên không HttpOnly

- **Bằng chứng:** `apps/web/src/middleware.ts` chỉ đọc `exp` (qua `session-guard.ts`), file tự ghi giới hạn này; `apps/web/src/lib/supabase.ts` đồng bộ session sang cookie bằng `document.cookie` với `SameSite=Lax; Secure (khi https); Max-Age=7 ngày` — **không `HttpOnly`** (cookie chứa refresh token, JS đọc được). Task 06 đã chứng minh live: JWT giả mạo qua được middleware nhưng **không lấy được dữ liệu** (mọi query thật bị Supabase/RLS từ chối + layout client chặn tiếp) — nên đây là **lớp phòng thủ yếu, không phải lỗ rò dữ liệu**.
- **Hướng sửa (follow-up đã ghi từ Task 06):** verify chữ ký ở middleware bằng `@supabase/ssr` hoặc gọi Auth API; cân nhắc cookie HttpOnly cho refresh token. Không chặn release vì đã có RLS + `getUser()` ở tầng route.

### S-06 — THẤP (fail-closed, không phải lỗ hổng): đường ghi tiến độ trực tiếp còn sót trong `learning.ts`

- **Bằng chứng:** `apps/web/src/lib/learning.ts:868–869` (`upsertProgress` → `.from('lesson_progress').upsert(...)`) và `markLessonComplete`/`saveLessonProgress` vẫn ghi trực tiếp bằng client; trang học bài (`hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]/page.tsx:319`) vẫn gọi `markLessonComplete` từ `learning.ts` (trong khi `LessonPlayer.tsx` đã dùng `progress.ts`/Workers). Sau 0009, các lệnh này sẽ nhận **42501** khi chạy live — tức nút “Đã hoàn thành” cho bài text/file trên trang học bài **hỏng**, không phải bị lợi dụng (B4 của Task 07 vẫn còn một nửa).
- **Hướng sửa:** chuyển trang học bài sang `progress.ts` (Workers `/api/v1/progress`, đã có code + handler) và đánh dấu deprecated/xóa hàm ghi trực tiếp trong `learning.ts`.

### S-07 — TRUNG BÌNH (tĩnh): anon được INSERT trực tiếp `event_registrations`

- **Bằng chứng:** `0001:551–552` policy `"event_registrations_insert" FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid())` — anon (không đăng nhập) được INSERT dòng `user_id NULL`. Mâu thuẫn `RLS_POLICIES.md` §6 (mọi ghi qua Workers API, kể cả đăng ký sự kiện). Task 06 §6.5 đã ghi follow-up này nhưng chưa sửa. Chưa thử live (sẽ tạo dữ liệu thật — task cấm tạo dữ liệu thật; nhưng policy text là đủ rõ).
- **Ảnh hưởng:** spam đăng ký sự kiện không qua rate-limit/validation/honeypot/CAPTCHA; không có kiểm tra trùng ở tầng này (UNIQUE `(event_id, email)` chỉ có ở tầng API chưa viết). Chưa có frontend đăng ký sự kiện nên rủi ro hiện tại là thấp-trung bình.
- **Hướng sửa:** drop policy INSERT cho anon (chỉ giữ INSERT qua Workers service-role khi có endpoint `POST /api/events/:slug/register`), hoặc giữ lại có chủ đích thì ghi quyết định và thêm rate-limit ở edge.

### S-08 — THẤP: mâu thuẫn policy SELECT `payments` (student có được đọc payment của mình?)

- `0001:539` policy `"payments_admin_read"` — chỉ admin SELECT. `RLS_POLICIES.md` §3.4/§4.4 và §9.6 lại ghi student được đọc payment của đơn mình (theo ma trận quyền hành động 13–14) — mâu thuẫn chưa được phê duyệt. Thực tế hiện tại là fail-closed (học viên không đọc được payment của mình qua query trực tiếp; trang đơn hàng chỉ đọc bảng `orders`). Cần chốt 1 bên trước khi có trang thanh toán.

### S-09 — THẤP (quy trình): `scripts/check-migrations.mjs` lỗi thời

- Script hard-code đúng 16 file (`EXPECTED_FILES` 0001–0016); repo hiện có 20 file (thêm 4 file 0017) → chạy `node scripts/check-migrations.mjs` **FAIL 1 kiểm tra** (“du 16 migration…”). Đây là lỗi script, không phải lỗi migration — nhưng sau S-02, script này là chốt chặn duy nhất phát hiện lệch số migration, cần cập nhật cùng lúc đổi số (kiểm tra cả 0017–0020 + các mục 0014–0016 đã có).

### S-10 — TRUNG BÌNH (chất lượng/chặn deploy Workers): Workers `tsc` FAIL + test Workers biến động theo thời gian

- `npx tsc --noEmit` trong `workers/api`: **FAIL, exit 2** (snapshot ~00:05 +07 11/11). Nhóm lỗi còn lại sau khi `sepay.ts` đã giao đủ: (a) `src/env.ts` khai trùng field `RESEND_API_KEY` (×3), `RESEND_FROM_EMAIL` (×2), `RESEND_WEBHOOK_SECRET` (×2) — TS2300 (lưu ý: file này thay đổi giữa các lần đọc trong phiên, số lần trùng dao động 1–3 — song song merge); (b) `src/email/sender.test.ts` / `templated.test.ts`: mock `countSentToday` sai kiểu tham số `cap` (TS2345, test-only); (c) `src/handlers/course-completion.test.ts`: lỗi tuple (TS2493/TS2339, file mới giao trong lúc kiểm tra).
- `npx vitest run` trong `workers/api`: kết quả **thay đổi giữa các lần chạy** vì code đang đổ về — lần chạy 16:56 UTC: `Test Files 2 failed | 5 passed (7)`, `Tests 103 passed (103)` (2 file fail ở bước collect do import contract test khi `sepay.ts` chưa giao xong); lần chạy sau: 2 test `health.test.ts` (verify JWT hết hạn/sai chữ ký) fail do **timeout 5s khi fetch JWKS qua mạng** và `JWT key not found` — dạng flaky phụ thuộc mạng, không phải lỗi logic verify (code `jwt.ts` kiểm tra RS256 + iss/aud/exp + chữ ký đúng chuẩn, có test unit tương ứng).
- `apps/web`: `npm test` **503/505 PASS** (2 fail là test GAP `payments.test.ts` G-T10-1/G-T10-3 — viết để fail khi code Task 10 về: seed `system_settings` nay đã có trong `0017_commerce_payment`, handlers nay đã có thêm `health.ts`/`progress.ts`; cần cập nhật test thành khẳng định dương khi Task 10 chốt); `npx tsc --noEmit` **PASS exit 0**.
- Build `apps/web`: 2 lần chạy trong phiên đều compile thành công (~3,7 phút) + lint/typecheck trong build OK + sinh đủ 31/31 trang tĩnh, rồi fail ở bước cuối “Collecting build traces” với `ENOENT` file khác nhau mỗi lần (`_ssgManifest.js`, rồi `_not-found/page.js.nft.json`). Đã xác minh nguyên nhân bằng `ps`: có **2 tiến trình `next build` khác đang chạy song song** tại thời điểm đó (1 build ngay trong thư mục repo này, PID 38029, bắt đầu 17:14 +07 11/11; 1 build isolated của task khác) cùng 1 tiến trình vitest — đúng mẫu lỗi transient khi nhiều agent build chung `.next` (đã gặp ở Task 07/08). **Kết luận: build fail do tranh chấp môi trường, không phải lỗi code**; cần build lại khi không còn agent nào khác build chung thư mục để có verdict cuối.

### S-11 — TRUNG BÌNH: webhook SePay/Resend chưa được nối route; thuật toán chữ ký SePay chưa xác nhận

- `workers/api/src/sepay.ts` (mới giao trong phiên, 347 dòng): `verifySepayWebhookSignature` = HMAC-SHA256 (hex) trên raw body + `timingSafeEqual` + fail-closed khi thiếu secret/chữ ký; `checkPaymentAmount` sai lệch 0đ; `decideIdempotencyReplay`/`findDuplicatePayment`/`canGrantEnrollment` đủ theo contract test. **Nhưng:** (a) `src/index.ts` chỉ route `leads`/`progress`/`health` — **không có route webhook/order nào**; (b) `Env` chưa có `SEPAY_WEBHOOK_SECRET` (test GAP G-T10-2 vẫn PASS = chưa có); (c) chính file code ghi rõ thuật toán/header chữ ký SePay thật **chưa được xác nhận từ tài liệu SePay** (`docs/database/SEPAY_INTEGRATION.md` đang được agent khác viết song song) — nếu SePay dùng thuật toán/header khác thì hàm verify hiện tại sẽ từ chối mọi webhook thật (fail-closed, an toàn nhưng không nhận được tiền).
- `workers/api/src/email/svix.ts` + `webhook.ts`: verify Svix đúng chuẩn (HMAC-SHA256 trên `<id>.<timestamp>.<rawBody>`, secret `whsec_` base64-decode, tolerance 5 phút chống replay, timing-safe, hỗ trợ nhiều chữ ký `v1,`) — kiểm tra tĩnh PASS. Nhưng cũng **chưa được nối route** (`/api/webhooks/resend` chưa tồn tại trong `index.ts`); `RESEND_WEBHOOK_SECRET` đã có trong `Env` (dạng `whsec_...`).
- Token hủy đăng ký (`src/email/token.ts`): HMAC-SHA256, hết hạn 90 ngày, fail-closed khi thiếu secret, timing-safe — kiểm tra tĩnh PASS. Lưu ý nhỏ: payload chỉ base64url (email lộ trong token, không mã hóa) — chấp nhận được vì link vốn gửi tới chính email đó; token bị lộ vẫn dùng được trong 90 ngày để hủy đăng ký (hành động rủi ro thấp, không có cơ chế thu hồi — chấp nhận được).

### S-12 — THẤP: chống scrub video có kẽ hở ở request đầu tiên

- `workers/api/src/handlers/progress.ts` kiểm tra nhảy vị trí quá nhanh chỉ khi **đã có dòng tiến độ trước đó** (`previous` + `video_position` cũ). Request đầu tiên với `video_position=540/600` (90%) và chưa có dòng nào sẽ được chấp nhận thành `completed` mà không có bằng chứng đã xem 540 giây. Đây là giới hạn cố hữu của kiểm tra “tăng quá nhanh” (không có baseline), đã được giảm nhẹ bởi trigger DB 0012 (chặn `completed` khi <90%) — nhưng không chặn được “khai 90% ngay từ đầu”. Cần theo dõi hành vi (nhiều bài completed trong vài giây đầu phiên) ở báo cáo đối soát, hoặc yêu cầu ít nhất 2 lần ghi `position` cách nhau trước khi cho completed.

### S-13 — THẤP: `contentType` avatar lấy từ client

- `dashboard.ts:uploadMyAvatar` truyền `contentType: file.type` (do client gửi) khi upload Storage, trong khi ext đã whitelist (`jpg/jpeg/png/webp`, chặn `.svg`). Kẻ tấn công có thể đặt tên `x.png` nhưng gửi `file.type=image/svg+xml` với nội dung SVG → file lưu dạng `avatar.png` nhưng phục vụ với `Content-Type: image/svg+xml` (thực thi script trong origin Supabase Storage, không phải origin app — tác động giới hạn). Hướng sửa: suy `contentType` từ ext đã kiểm chứng, không tin `file.type`.

### S-14 — THẤP (tính năng chưa nối, không phải lỗ hổng): Task 09 admin/CRM lib chưa có route/trang

- `admin-users.ts` (`setUserDisabled`, đổi role, tặng/thu hồi) và `crm.ts` (tương tác lead) không có caller nào ngoài test (grep toàn `src/` = 0); không có route `/api/admin/users/*`, `/api/admin/crm/*` và không có trang `/admin/hoc-vien`, `/admin/crm`, `/admin/audit-logs` (dù nav admin đã link tới). `refundOrder()` trong `lms-admin.ts` cũng ghi rõ “chưa có lib/route nào” gọi. Các lib này tự thân kiểm tra đúng (đều yêu cầu gọi sau `requireAdmin()`; `setUserDisabled` cấm tự disable chính mình, lý do bắt buộc, ghi audit) — chỉ là chưa dùng được.

### S-15 — TRUNG BÌNH (theo quyết định đã chốt): Turnstile fail-open + fallback Apps Script không có chống spam

- `workers/api/src/turnstile.ts`: khi chưa có secret, hoặc client không gửi token, hoặc Cloudflare không liên hệ được → **cho qua + ghi log** (theo DECISIONS Task 03 QĐ 13: không chặn cứng người thật). Khi đó lớp chống spam chỉ còn rate-limit 5/giờ/IP + honeypot. Đây là quyết định của user, không phải lỗi code — nhưng cần ghi rõ: cho tới khi Turnstile site key + secret được cấu hình thì form lead chỉ được bảo vệ ở mức này.
- `apps/web/src/lib/leads.ts`: fallback sang Apps Script cũ **chỉ** khi API lỗi mạng/5xx/timeout, **không** chạy khi API trả 400/409/429 (không lách được rate-limit/validation). Tốt. Nhưng bản thân Apps Script cũ không có honeypot/Turnstile/Idempotency-Key/mã tham chiếu (ghi trong chính comment của `leads.ts`) — đường fallback là đường spam yếu, giữ lại theo quyết định (chỉ xóa khi API mới chứng minh ổn định).

### S-16 — THẤP: `orders_admin_update`/`lead_interactions_admin_all` (0017) thiếu `WITH CHECK`

- `0017_lead_interactions.sql`: policy `orders_admin_update FOR UPDATE USING (admin)` không có `WITH CHECK` — admin có thể đổi đơn sang bất kỳ trạng thái nào (kể cả `paid` mà không qua payment) bằng JWT admin trực tiếp. Admin vốn đã tin cậy, và policy `orders_update_admin` trong `0017_commerce_payment.sql` **có** `WITH CHECK (admin)`; nhưng để nhất quán và đúng nguyên tắc “chỉ server đổi đơn sang paid”, nên thêm `WITH CHECK` + ràng buộc cột ở tầng API (file commerce đã tự ghi chú: Postgres policy không giới hạn được cột — phải chặn ở API).

### S-17 — THẤP: `current_role()` đọc cache `profiles.role`, lệch quyết định “`user_roles` là nguồn duy nhất”

- DECISIONS Task 03 QĐ 3 đã phê duyệt: **`user_roles` là nguồn duy nhất**, `profiles.role` chỉ là cache đồng bộ bằng trigger. Nhưng `current_role()` (0001:52–60) vẫn `select role from profiles`, và mọi policy RLS + `lms-access.ts`/`requireAdmin` đều đọc cả hai (admin ở 1 trong 2 thì tính là admin). Trigger đồng bộ `trg_sync_profiles_role` (0007) chạy sau INSERT/UPDATE/DELETE trên `user_roles` nên thường thì cache đúng — nhưng nếu trigger lỗi/tắt, thu hồi role trong `user_roles` sẽ **không** thu hồi quyền thật (cache cũ vẫn `admin`). Hướng sửa: đổi `current_role()` đọc `user_roles` (có `EXISTS` + `revoked_at IS NULL` nếu dùng), giữ `profiles.role` chỉ để hiển thị.

### S-18 — THẤP: 2 test GAP hết hạn nhưng chưa cập nhật (không phải lỗi bảo mật)

- Xem S-10: `payments.test.ts` G-T10-1/G-T10-3 fail vì code Task 10 đã về một phần. Cập nhật test thành khẳng định dương khi Task 10 chốt (seed `system_settings` đã có; handlers đã có `health`/`progress`; webhook/order vẫn chưa có nên phần đó của GAP vẫn đúng).

## 4. Kết quả từng mục chi tiết (bằng chứng)

### 4.1 RLS — FAIL (xem S-01/S-02/S-03/S-07/S-17)

- Bật RLS: grep toàn migration — mọi bảng vật lý (38 bảng Task 03 + `lesson_notes` + `submission_files` + `lead_interactions`) đều có `ENABLE ROW LEVEL SECURITY`; policy đếm được 80 ở lần chạy §5E (81 − 2 + 1 sau 0009).
- Không có policy INSERT/UPDATE/DELETE nào cho client trên `leads`/`orders`/`payments`/`enrollments`/`lesson_progress`/`quiz_attempts`/`quiz_answers` (grep toàn migration; 0017_commerce chỉ thêm policy **admin** `payments_insert_admin` với `WITH CHECK (verified_by = auth.uid())` và `orders_update_admin` với `WITH CHECK (admin)` — đúng hướng).
- `question_options`: không policy SELECT cho anon/student; chỉ view `question_options_public` (đã kiểm chứng live: view không có cột `is_correct` — `select=is_correct` → 400 `42703`; view cũ `quiz_options_public` đã biến mất khỏi schema cache, 404 `PGRST205` gợi ý đúng tên mới).
- Điểm trừ: S-03 (bảng `lessons`), S-07 (`event_registrations` anon INSERT), S-01 (cột mới không được chặn), S-17 (nguồn role).

### 4.2 IDOR — PASS (có lưu ý)

- Route quiz submit: `getServerUser()` + RPC `submit_quiz_attempt` (SECURITY DEFINER) tự kiểm tra enrollment/giới hạn lượt/hết giờ; `quiz_attempt_id` đối chiếu `user_id` ở handler progress. Route assignment: `getAssignmentCaller` + `loadAssignmentContext` kiểm tra enrollment + `userIdFilter` (học viên chỉ thấy bài của mình; instructor/admin mới thấy tất cả); download file kiểm tra chủ bài nộp/instructor/admin. Route certificate issue/revoke: `getAdminContext()` bắt buộc. Live Task 08: B đọc `quiz_attempts`/`submissions` của A = 0 dòng; B GET quiz 403 `not_enrolled`.
- Lưu ý: xem S-08 (payments), S-16 (WITH CHECK), S-17 (nguồn role kép).

### 4.3 XSS — PASS

- Grep `dangerouslySetInnerHTML|innerHTML|document.write` trong `apps/web/src` + `workers/api/src` = 0. Nội dung bài học render qua React (escape mặc định). Video qua `youtube-nocookie` iframe. Không có `v-html` hay `__html`.
- Rủi ro còn lại duy nhất là cookie phiên không HttpOnly (S-05) — cần 1 lỗ XSS khác mới khai thác được; hiện không tìm thấy lỗ đó.

### 4.4 SQL injection — PASS

- Không có nối chuỗi SQL từ input: toàn bộ app dùng supabase-js builder + `rpc()` với object tham số; SQL động trong migration chỉ là DDL (`execute format(... %I ...)` với tên constraint từ `pg_constraint`, không từ input người dùng). Hàm `submit_quiz_attempt` (0014) và `verify_certificate` (0016) là SECURITY DEFINER nhưng không nối input vào SQL động (đã đọc; chỉ dùng tham số + JSONB).

### 4.5 Authentication bypass — FAIL một phần (S-05)

- Middleware: chỉ đọc `exp`, không verify chữ ký — đã biết từ Task 06, vẫn còn. Bù lại: mọi Server Component/Route Handler dùng `getServerSupabaseClient()` + `auth.getUser()` (gọi Auth API thật); Workers `verifySupabaseJwt` kiểm tra RS256 + `iss`/`aud`/`exp` + JWKS cache 10 phút + clock-skew 30s (có test unit: token hết hạn/sai chữ ký/sai aud đều throw — dù 2 test này flaky do fetch JWKS qua mạng, xem S-10).
- Open-redirect: `isSafeNextPath` chặn `//`, `\`, CR/LF, yêu cầu bắt đầu `/`; trang `/dang-nhap` và `/auth/callback` đều dùng `safeNextPath(..., '/hoc-vien')` — PASS.
- Session hết hạn: middleware thử refresh qua Supabase Auth API, thất bại → 307 về `/dang-nhap?reason=expired` (Task 06 đã kiểm chứng live). Không có blacklist JWT (đúng bản chất JWT stateless) — đã ghi rõ, không ngộ nhận.

### 4.6 Authorization bypass — PASS + S-01 (tiềm ẩn)

- `/admin/*`: middleware chặn chưa đăng nhập + layout server `requireAdmin()` (đọc `user_roles` + `profiles.role`); `/api/admin/*`: mọi route qua `getAdminContext()` (401/403/503 rõ ràng). Không route admin nào tin role từ client.
- Instructor: lỗi cột `instructor_id` đã sửa xong ở Task 08 §9.1 (grep `instructor_id` trong `src/` chỉ còn chuỗi guard âm trong test).
- Lỗ duy nhất: S-01 (tự sửa `is_disabled` sau khi 0017 được áp).

### 4.7 API key exposure — PASS

- Grep (không in giá trị): không có chuỗi service-role/JWT/API-key/secret hard-code trong `src/`; `SUPABASE_SERVICE_ROLE_KEY` chỉ xuất hiện dưới dạng `env.SUPABASE_SERVICE_ROLE_KEY` trong Workers (Secrets); `apps/web/.env.local` và `.env.staging` chỉ có 2 key `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (key anon dạng `sb_publishable_…`, không phải JWT service-role); `git ls-files` chỉ track `.env.example` (chỉ tên biến); `.gitignore` chặn `.env*` + `.dev.vars`.
- Lưu ý: file `.env.staging`/`.env.local` tồn tại trên VM (đúng quy trình làm việc local, không commit) — không phải lỗi.

### 4.8 File upload — PASS (có lưu ý S-13)

- Avatar (`dashboard.ts`): `validateAvatarFile` — `image/*` + ext whitelist `jpg/jpeg/png/webp` + ≤2 MB + không rỗng; đường dẫn `<uid>/avatar.<ext>` (ghi đè ảnh cũ); policy Storage 0010: insert/update/delete chỉ khi `foldername(name)[1] = auth.uid()`; đọc công khai (bucket public, đúng mục đích avatar).
- Assignment (`upload/route.ts` + `assignments.ts`): kiểm tra enrollment + `decideCanSubmit` (hạn nộp, loại bài) trước khi nhận file; `validateUploadFile` (đuôi cho phép pdf/doc/docx/txt/md/png/jpg/jpeg + 10 MB/file, tối đa 5 file); đường dẫn `<user_id>/<assignment_id>/<submission_id>/<timestamp>-<tên đã sanitize>`; bucket `submissions` private + 4 policy Storage (0015); response không trả `storage_path`; lỗi ghi DB → xóa file vừa upload (không để file mồ côi); tải file chỉ qua route stream có kiểm tra quyền.
- Lưu ý: S-13 (`contentType` từ client); không kiểm tra magic bytes (phòng thủ sâu, chưa bắt buộc).

### 4.9 Rate limiting — CHƯA ĐẠT một phần

- Workers (đã có code + test): leads `5 req/giờ/IP` (`handlers/leads.ts: LEAD_RATE_LIMIT=5`); progress `100 req/phút/IP` + `300 req/giờ/user` (`handlers/progress.ts`); `Retry-After` trả kèm 429; đếm cả request lỗi validation, trừ 401/403. Backend: KV nếu có binding, fallback bộ nhớ trong-process (ghi rõ giới hạn: race qua nhiều isolate có thể vượt nhẹ — chấp nhận được với giới hạn chống spam; UNIQUE ở DB là lớp chặn cuối). Test `leads.test.ts` 18 test PASS (5 lần OK, lần 6 → 429, không ghi thêm).
- **Thiếu:** không có rate-limit nào trong `apps/web/src` cho các route Next.js (`/api/v1/*`, `/api/admin/*`, `/api/lms/*`) — grep `rate` chỉ thấy xử lý mã lỗi 429 ở client; đăng nhập dựa vào rate-limit của Supabase Auth (chưa đo live). Newsletter chưa có endpoint nên chưa có rate-limit 5/giờ/IP như thiết kế.
- Turnstile: xem S-15.

### 4.10 Webhook replay — CHƯA KIỂM (chưa có endpoint)

- Không có route webhook nào trong `workers/api/src/index.ts` (chỉ `leads`/`progress`/`health`). Code verify đã có (SePay HMAC-SHA256 + timing-safe + fail-closed; Resend/Svix đúng chuẩn + tolerance 5 phút) nhưng chưa được gọi từ HTTP — nên không thể test replay live, và cũng không có bề mặt tấn công replay hôm nay.
- **Chưa xác nhận:** thuật toán/header chữ ký SePay thật (file code tự ghi rõ là giả định); phải đối chiếu `docs/database/SEPAY_INTEGRATION.md` (đang viết song song) + tài liệu chính thức SePay trước khi live.

### 4.11 Duplicate payment — PASS (tầng DB) / CHƯA KIỂM (tầng chạy thật)

- `UNIQUE (method, gateway_reference)` trên `payments` (0001:192; NULL không tính trùng — đúng thiết kế, ghi rõ trong comment); `orders.reference_code` UNIQUE + sinh tự động `DH-YYYY-NNNNNN` qua sequence (0017_commerce, chưa áp); `orders.idempotency_key` UNIQUE partial index (0017_commerce, chưa áp); `enrollments UNIQUE (user_id, course_id)` (0001); idempotency leads: handler kiểm tra key trước khi ghi, trùng key + body khác → 409, trùng key + cùng body → 200 `duplicate:true`, race → đọc lại theo key (đã có test).
- Chưa có đơn/webhook thật để test replay end-to-end (SePay chưa live, không có route tạo đơn — `POST /api/orders` chưa tồn tại).

## 5. Bằng chứng chạy lệnh (snapshot)

| Lệnh / kiểm tra | Kết quả (thời điểm snapshot) |
|---|---|
| `npm test` — `apps/web` | **503/505 PASS**; 2 fail là test GAP `payments.test.ts` G-T10-1/G-T10-3 (hết hạn vì code Task 10 đã về một phần — xem S-10/S-18). Chạy 10/11/2026 ~23:46 +07, 56s. |
| `npx tsc --noEmit` — `apps/web` | **PASS, exit 0.** |
| `npx tsc --noEmit` — `workers/api` | **FAIL, exit 2** (snapshot ~00:05 +07 11/11): trùng field `Env`, mock `countSentToday` sai kiểu, `course-completion.test.ts` lỗi tuple. Lưu ý file thay đổi giữa các lần chạy (xem cảnh báo đầu báo cáo). |
| `npx vitest run` — `workers/api` | **Biến động giữa các lần chạy** (code đang đổ về): lần 16:56 UTC: `103/103 tests PASS`, 2 file fail ở bước collect (import contract `sepay.ts` chưa giao xong); lần sau: 2 test `health.test.ts` fail flaky do fetch JWKS timeout/mất key. Không dùng số này làm kết luận cuối — cần chạy lại sau khi các nhóm dừng giao code. |
| `node scripts/check-migrations.mjs` | **FAIL 1 kiểm tra** (“du 16 migration…”, repo đã có 20 file) — xem S-09. |
| `npm run build` — `apps/web` | **FAIL ở bước cuối do tranh chấp `.next` với build song song (không phải lỗi code — xem S-10).** 2 lần chạy: compile OK (~3,7 phút) + lint/typecheck trong build OK + sinh đủ 31/31 trang tĩnh, rồi fail ở “Collecting build traces” với `ENOENT` file khác nhau mỗi lần. `ps` xác nhận 2 tiến trình `next build` khác đang chạy song song (1 trong chính thư mục repo, PID 38029). Cần build lại khi không còn agent khác build chung. |
| Anon REST staging (xem §6) | Private tables `[]`; `lessons` lộ content bài trả phí (S-03); `question_options` `[]`; view `question_options_public` không có `is_correct`; 4 file 0017 đều chưa áp. |

## 6. Kiểm thử live (staging `scskhplczrxlnxzruweu.supabase.co`, anon key, chỉ đọc)

Không tạo/sửa/xóa dữ liệu; không đăng nhập tài khoản test (mật khẩu test các đợt Task 07/08 không được ghi lại trong tài liệu). Kiểm thử 2 tài khoản (A đọc dữ liệu B, A thử update role/insert enrollment/progress) **CHƯA CHẠY LẠI trong đợt này** — lần kiểm chứng gần nhất là BACKEND_TEST_REPORT §5E (H1/H2/H3 live bị chặn) và Task 08 §9.6 (quiz/assignment/certificate live 17/17 + V-T08-1→V-T08-9 PASS). Cần chạy lại sau khi có tài khoản test mới (xem §7).

| Probe (anon) | Kết quả |
|---|---|
| `courses?status=published` | 206, 10 khóa seed (3 dòng đầu đúng slug) |
| `lessons` (bài 1 xem thử) | 200, có `content` (đúng — bài xem thử) |
| `lessons?is_free_preview=false` (bài 2 trả phí) | **200, trả đủ `content`** — S-03 |
| `lessons_public` view | 200, 2 bài, chỉ metadata |
| `lesson_resources?select=file_url` | 200, `[]` (0013 siết RLS có hiệu lực) |
| `question_options?select=is_correct` | 200, `[]` (không policy SELECT) |
| `question_options_public?select=is_correct` | 400 `42703` (cột không tồn tại — view sạch) |
| `profiles` / `enrollments` / `orders` / `payments` / `quiz_attempts` / `submissions` / `leads` / `system_settings` / `coupons` / `certificates` / `lesson_notes` / `audit_logs` / `user_roles` / `memberships` | 200, `[]` (không rò rỉ cho anon) |
| `profiles?select=is_disabled` | 400 `42703` — cột chưa tồn tại (0017_admin_user_disable **chưa áp**) |
| `lead_interactions` | 404 `PGRST205` — bảng chưa tồn tại (0017_lead_interactions **chưa áp**) |
| `orders?select=idempotency_key` | 400 `42703` — cột chưa tồn tại (0017_commerce **chưa áp**) |
| `email_logs?select=attempts` | 400 `42703` — cột chưa tồn tại (0017_email **chưa áp**) |

## 7. Việc phải làm trước khi mở cho người dùng thật (theo thứ tự)

1. **Đổi số 4 file 0017 → 0017/0018/0019/0020** (S-02) và cập nhật `check-migrations.mjs` (S-09). Không áp bất kỳ file 0017 nào trước bước này.
2. **Vá S-01 trước khi áp file disable:** thêm trigger chặn sửa `is_disabled`/`disabled_at`/`disabled_reason` với JWT non-admin + `REVOKE UPDATE` các cột đó khỏi `authenticated` (mẫu 0009 H1); đồng thời quyết định + làm lớp chặn đăng nhập/học cho tài khoản disabled (middleware/layout) — nếu không, disable chỉ là cờ hiển thị.
3. **Chốt QĐ 4 (S-03):** thu hẹp đường đọc bảng `lessons` (view `lessons_public` làm đường công khai; chỉ API/service-role đọc `content`/`video_url`/`file_url`) rồi kiểm chứng lại bằng probe anon như §6.
4. **Nối route webhook + đơn hàng (S-11/S-10):** thêm `SEPAY_WEBHOOK_SECRET` vào `Env` + `.dev.vars.example` (chỉ tên biến), nối `POST /api/webhooks/sepay` (dùng `verifySepayWebhookSignature` đã có) và `POST /api/webhooks/resend` (dùng `email/webhook.ts` đã có) vào `index.ts`; **xác nhận thuật toán/header chữ ký SePay từ tài liệu chính thức** trước khi live; cập nhật test GAP `payments.test.ts` thành khẳng định dương.
5. **Thêm CSP** (S-04) vào `next.config.ts` + kiểm chứng header thật trên domain deploy.
6. **Sửa S-07** (drop policy anon INSERT `event_registrations`) hoặc ghi quyết định giữ lại có chủ đích.
7. **Chuyển trang học bài sang `progress.ts`** (S-06) và xóa/đánh dấu deprecated hàm ghi trực tiếp trong `learning.ts`.
8. **Chạy lại sau khi các nhóm dừng giao code:** `npm test` + `tsc` + `lint` + `build` ở cả `apps/web` và `workers/api`; `check-migrations`; **kiểm thử live 2 tài khoản test mới** (tạo qua Supabase dashboard/Auth Admin API, ghi lại tài khoản test dùng chung): A đọc dữ liệu B, A thử update `role`/`is_disabled`, A INSERT `enrollments`/`lesson_progress`/`orders`/`payments`, anon INSERT `leads`/`event_registrations`, B nộp quiz khi chưa ghi danh, kiểm tra `lessons` anon sau khi sửa S-03.
9. **Follow-up (không chặn mở thử nghiệm nội bộ):** verify chữ ký JWT ở middleware + cân nhắc cookie HttpOnly (S-05); rate-limit cho route Next.js (mục 9); chốt mâu thuẫn SELECT `payments` (S-08); đổi `current_role()` sang đọc `user_roles` (S-17); `contentType` avatar suy từ ext + kiểm tra magic bytes (S-13); sửa `orders_admin_update` thêm `WITH CHECK` (S-16).

## 8. Những gì đã kiểm tra và KHÔNG phát hiện vấn đề

- Không có service-role key/JWT/secret hard-code; không có dữ liệu mock trong dashboard (đã kiểm chứng từ Task 06, grep lại đợt này vẫn sạch).
- Không có SQL injection, không có XSS qua `innerHTML`, không có open-redirect (`?next=` đã chặn `//`).
- Không có code nào tin điểm quiz/tiến độ do client gửi: chấm quiz ở hàm SQL SECURITY DEFINER, tiến độ tính lại ở Workers + trigger 0012.
- Không có đường tạo đơn “đã trả” từ client: không policy INSERT/UPDATE cho client trên `orders`/`payments`; `UNIQUE (method, gateway_reference)` + `UNIQUE (user_id, course_id)` còn nguyên.
- Chứng chỉ: cấp idempotent, chỉ 1 `valid`/user+khóa, tra cứu công khai chỉ trả 6 trường (không PII) qua RPC `verify_certificate` — đã kiểm chứng live ở Task 08 §9.6.

---

*Báo cáo này không sửa code. Các lỗi S-01/S-02 cần xử lý trước khi áp bất kỳ migration 0017 nào; S-03 cần xử lý trước khi mở bán khóa có nội dung trả phí thật (video/file URL hiện chưa có giá trị thật trên staging nên mức rò rỉ thực tế hôm nay chỉ là nội dung text).*
