# Báo cáo Task 06 — Student Dashboard (phần Dashboard)

**Dự án:** Visfar Academy
**Ngày:** 10/11/2026
**Phạm vi:** Dashboard học viên trong `apps/web` — xây tiếp trên code Task 05, không viết lại.
**Trạng thái chung:** Code + kiểm thử local **đã xong và đạt**. Kiểm thử live có tài khoản thật **CHƯA CHẠY** (ghi rõ ở §5, không ghi PASS cho thứ chưa chạy).

> Ghi chú phối hợp: trong lúc làm Task 06 có agent song song cùng làm trên cùng repo (security tests `src/lib/security.test.ts`, `src/lib/rls-policy.test.ts`, `src/lib/useRequireAuth.ts`, trang `/hoc-vien/doi-mat-khau`, middleware auth, và file `docs/frontend/TASK06_REPORT.md`). Báo cáo này chỉ ghi phần Dashboard do subagent này làm, đặt tên file riêng `TASK06_DASHBOARD_REPORT.md` để không ghi đè báo cáo tổng hợp của agent kia. Hai chỗ chạm nhau đã xử lý: (1) agent kia thêm effect `subscribeToAuthChanges` vào `hoc-vien/page.tsx` nhưng thiếu import — đã thêm import (1 dòng) để build pass; (2) `auth.ts` giữ nguyên thay đổi avatar_url của phần này.
>
> ⚠️ **Xung đột tên migration cần coordinator xử lý:** agent song song đã tạo `supabase/migrations/0008_fix_fk_answers.sql` trong khi phần này tạo `supabase/migrations/0010_dashboard_avatar_storage.sql` — hai file cùng số 0008. Cần đổi số một file (ví dụ phần Dashboard thành 0009) trước khi chạy `supabase db push`, nếu không thứ tự chạy không xác định. Nội dung hai file không chồng chéo nhau.

Tài liệu đã đọc trước khi làm: `docs/frontend/TASK05_REPORT.md`, `docs/DECISIONS.md` (QĐ 17: slug UNIQUE theo module, video ≥ 90% / bài text bấm "Đã hoàn thành", tính theo module), schema Task 03 (`docs/database/DATABASE_SCHEMA.md` §3.1/3.8/3.9/3.10/3.24/3.18/3.26), `src/app/hoc-vien/page.tsx` (Task 05), `src/lib/supabase.ts`, `src/lib/api-client.ts`, `src/lib/leads.ts`, và các migration `supabase/migrations/0001–0007` (đối chiếu RLS/bucket).

---

## 1. File giữ nguyên

| File | Ghi chú |
|---|---|
| `workspace/user/files/Visfar_Academy.html` | Trang HTML gốc — không sửa |
| `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` | Không sửa |
| `supabase/migrations/0001–0007` | Không sửa migration cũ; thêm mới 0008 (§3) |
| `apps/web/src/lib/validation.ts`, `courses.ts`, `leads.ts`, `api-client.ts`, `newsletter.ts` | Không sửa |
| `apps/web/.env.local`, `.env.staging` | Chỉ swap tạm `.env.local` ← staging để build/smoke test, đã khôi phục về bản prod ngay sau đó (kiểm chứng bằng URL, không ghi key vào báo cáo) |

Không đổi màu sắc, font, hình ảnh, nội dung đã có. Style mới chỉ dùng token sẵn có (`--bg-ivory`, `--bg-champagne`, `--gold*`, `Be Vietnam Pro`).

## 2. File được sửa

| File | Thay đổi |
|---|---|
| `apps/web/src/app/hoc-vien/page.tsx` | Viết lại thành trang tổng quan: hồ sơ + 5 thẻ thống kê (đang học / hoàn thành / chứng chỉ / đơn hàng / thông báo chưa đọc) + 3 khóa đang học gần nhất kèm thanh tiến độ. Giữ đủ trạng thái loading / signed-out / success / empty / error / not-configured. Thêm 1 dòng import `subscribeToAuthChanges` (do agent song song thêm effect dùng hàm này mà thiếu import — xem ghi chú đầu báo cáo) |
| `apps/web/src/lib/auth.ts` | `MyProfile` thêm `avatar_url: string \| null`; `getMyProfileState` select thêm `avatar_url`. Không đổi logic auth |
| `apps/web/src/styles/globals.css` | Chỉ **thêm cuối file** class dashboard (`.dashboard-nav`, `.stat-grid`, `.stat-card`, `.stat-num`, `.progress-track/.progress-fill`, `.avatar`, `.dashboard-list`, `.module-list`). Không sửa rule cũ nào |

## 3. File được tạo mới

| File | Vai trò |
|---|---|
| `apps/web/src/lib/dashboard.ts` | Data layer dashboard: đọc thật từ Supabase (xem §4). Không mock, không dữ liệu giả, không localStorage làm database |
| `apps/web/src/lib/dashboard.test.ts` | 36 test cho data layer (fake client mô phỏng chuỗi query supabase-js) |
| `apps/web/src/components/dashboard/DashboardNav.tsx` | Nav dùng chung 7 mục `/hoc-vien/*`, `aria-current="page"` |
| `apps/web/src/app/hoc-vien/ho-so/page.tsx` | Sửa hồ sơ + upload avatar |
| `apps/web/src/app/hoc-vien/khoa-hoc/page.tsx` | Khóa đang học / đã hoàn thành + tiến độ theo module |
| `apps/web/src/app/hoc-vien/lich-su/page.tsx` | Lịch sử học (50 sự kiện gần nhất) |
| `apps/web/src/app/hoc-vien/thong-bao/page.tsx` | Thông báo + đánh dấu đã đọc (từng cái / tất cả) |
| `apps/web/src/app/hoc-vien/chung-chi/page.tsx` | Chứng chỉ |
| `apps/web/src/app/hoc-vien/don-hang/page.tsx` | Đơn hàng + dòng hàng |
| `supabase/migrations/0010_dashboard_avatar_storage.sql` | Policy Storage bucket `avatars` (chỉ chủ sở hữu được ghi/xóa) + policy SELECT riêng cho học viên trên `learning_events` (xem §4.4). Idempotent, có guard — **chưa chạy** (chưa có access token) |
| `docs/frontend/TASK06_DASHBOARD_REPORT.md` | Báo cáo này |

## 4. Chức năng đã làm

### 4.1. Data layer (`src/lib/dashboard.ts`)

- **Hồ sơ — `updateMyProfile()`:** chỉ gửi `full_name` / `phone` / `province`. Không bao giờ gửi `role` / `email` (test khóa chặt: payload update không chứa 2 key này). Validate chung `validation.ts`: tên 2–100 ký tự, SĐT rỗng hoặc `^0\d{9}$`, tỉnh rỗng hoặc trong 34 tỉnh. SĐT/tỉnh rỗng → `null`.
- **Ảnh đại diện — `uploadMyAvatar()`:** validate file (ảnh JPG/PNG/WebP, ≤ 2 MB) → upload lên bucket `avatars`, đường dẫn `<userId>/avatar.<ext>` (`upsert: true`) → lấy public URL → cập nhật `profiles.avatar_url`. Lỗi storage → không cập nhật profile.
- **Tiến độ — `getMyCourseProgress()`:** `enrollments` (join `courses`) → `course_modules` → `lessons` → `lesson_progress` của chính user. Ngưỡng QĐ 17: bài `completed` khi server đánh dấu `status='completed'`, hoặc bài video đạt ≥ 90% (`VIDEO_COMPLETION_THRESHOLD = 90`); bài text chỉ tính khi có status. Tiến độ tính theo module rồi tổng hợp lên khóa; khóa hoàn thành khi `enrollments.status='completed'` hoặc 100% bài xong. Tách đang học / đã hoàn thành bằng `splitEnrollments()`.
- **Lịch sử học — `getMyLearningHistory()`:** `learning_events` của chính user, mới nhất trước, tối đa 50, map tên khóa/bài + `progress_percent` từ `event_data`.
- **Thông báo — `getMyNotifications()` / `markNotificationRead()` / `markAllNotificationsRead()`:** đọc + đánh dấu đã đọc (RLS 0006 cho phép UPDATE `is_read` của chính mình).
- **Chứng chỉ — `getMyCertificates()`:** `certificates` join `courses`, mới nhất trước.
- **Đơn hàng — `getMyOrders()`:** `orders` + `order_items` (theo `order_id`), kèm nhãn trạng thái + định dạng VND (`formatVnd`).
- **Lỗi rõ ràng:** `mapSupabaseErrorMessage()` dịch `PGRST205` (bảng chưa tồn tại) thành "Dữ liệu chưa sẵn sàng trên Supabase (bảng chưa được tạo — cần chạy migration)"; mất mạng → `isOffline: true`. Mọi hàm trả `DashboardState` (`not-configured` / `signed-out` / `success` / `error`), không bao giờ trả success giả.

### 4.2. Trang

- **Tổng quan `/hoc-vien`:** chào theo tên, avatar, email/SĐT/tỉnh, nút sửa hồ sơ + đăng xuất; 5 thẻ thống kê đếm thật từ dữ liệu; 3 khóa đang học gần nhất kèm thanh tiến độ (`role="progressbar"`).
- **Hồ sơ `/hoc-vien/ho-so`:** xem trước avatar + chọn ảnh mới; form sửa tên/SĐT/tỉnh; email + vai trò chỉ hiển thị (input disabled, ghi rõ không sửa được ở đây).
- **Khóa học `/hoc-vien/khoa-hoc`:** 2 nhóm Đang học / Đã hoàn thành, mỗi khóa có thanh tiến độ + chi tiết từng module (`x/y bài (z%)`) + ngày ghi danh/hoàn thành.
- **Lịch sử học / Thông báo / Chứng chỉ / Đơn hàng:** danh sách thật từ DB; mỗi trang đủ trạng thái loading / signed-out / error (+ nút "Thử lại") / empty (kèm link hành động, không bịa dữ liệu). Thông báo chưa đọc nổi bật + pill "Mới".
- **UX:** nav dashboard 7 mục trên mọi trang con; body 16px, nút ≥ 44px (kế thừa token + `.btn` 48px), lưới thống kê xuống 1 cột trên điện thoại, không tràn ngang (dùng `.wrap` + grid hiện có).

### 4.3. Migration 0008 (chưa chạy)

- **Storage `avatars`:** 4 policy trên `storage.objects` — SELECT công khai (bucket public); INSERT/UPDATE/DELETE chỉ khi `(storage.foldername(name))[1] = auth.uid()::text`. Bucket đã tạo ở 0007, nhưng 0007 ghi rõ policy làm ở bước sau — đây là bước đó.
- **Bổ sung `learning_events_select_own`:** policy 0006 chỉ cho xem sự kiện của khóa đã ghi danh; sự kiện của chính user nhưng `course_id` NULL sẽ bị ẩn mất. Policy mới thêm `user_id = auth.uid()` để trang Lịch sử học hiện đủ lịch sử của chính mình.

### 4.4. Phát hiện trong Task 06 (ghi nhận, không tự sửa ngoài phạm vi)

1. **Bucket `avatars` chưa tồn tại trên staging** (Storage REST trả `NoSuchBucket`, xem §5.2) — tức migration 0007 (phần tạo bucket) chưa chạy lên staging, hoặc bucket chưa được tạo. Upload avatar live sẽ lỗi cho tới khi chạy 0007 + 0008.
2. **Staging Auth bị rate-limit gửi email** (`over_email_send_rate_limit`, §5.2) — không tạo được tài khoản test trong phiên này, nên mọi kiểm thử live có đăng nhập đều chưa chạy được.
3. **RLS `profiles_update_own` (0001) không giới hạn cột** — client tự kỷ luật chỉ gửi 3 trường (có test khóa), nhưng ở tầng DB một client khác vẫn có thể gửi `role`/`email`. Nên bổ sung trigger/`WITH CHECK` hạn chế cột ở migration sau (không làm trong Task 06 để tránh chạm luồng admin).
4. **Chưa có dữ liệu thật để hiển thị:** staging có 1 khóa seed (`courses` có 1 dòng) nhưng `enrollments`/`lesson_progress`/`certificates`/`orders`/`notifications`/`learning_events` đều rỗng qua REST anon (RLS ẩn + chưa có dữ liệu). Dashboard sẽ hiện empty state cho tới khi có học viên/ghi danh thật.

## 5. Kết quả kiểm thử

### 5.1. Đã chạy thật ở local — PASS

| # | Kiểm thử | Lệnh / cách chạy | Kết quả |
|---|---|---|---|
| T-06-01 | Unit test | `npm test` (vitest 2.1.9) trong `apps/web` | **PASS — 137/137 test, 9 file** (dashboard 36 mới; security 11 + rls-policy 10 của agent song song; 80 cũ từ Task 05). Trước Task 06: 80 test |
| T-06-02 | Ngưỡng hoàn thành QĐ 17 | `dashboard.test.ts`: video 90% → xong, 89% → chưa; text 100% chưa bấm hoàn thành → chưa tính; `status='completed'` → xong mọi loại bài | **PASS** |
| T-06-03 | Tiến độ theo module | Module 1: 2 bài, 1 xong → 50%; module rỗng → 0% (không chia cho 0); khóa 3/3 → 100% | **PASS** |
| T-06-04 | Chỉ sửa 3 trường hồ sơ | Fake client ghi lại payload update: đúng `{full_name, phone, province}`, không có key `role`/`email`; validation lỗi → không gọi update | **PASS** |
| T-06-05 | Avatar | Đường dẫn `user-1/avatar.jpg`; file > 2 MB / sai định dạng → lỗi, không upload; lỗi storage → không cập nhật profile | **PASS** |
| T-06-06 | Empty state, không bịa dữ liệu | Chưa ghi danh / chưa có lịch sử / thông báo / chứng chỉ / đơn → `success, data: []` | **PASS** |
| T-06-07 | Bảng chưa tồn tại | Fake lỗi `PGRST205` → error "bảng chưa được tạo", không fake success | **PASS** |
| T-06-08 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 lỗi (sau khi thêm import `subscribeToAuthChanges` còn thiếu do agent song song thêm effect) |
| T-06-09 | Lint | `npm run lint` (`eslint .`) | **PASS** — 0 lỗi |
| T-06-10 | Build | `npm run build` (Next.js, env staging tạm thời) | **PASS** — compiled successfully; đủ 7 route dashboard: `/hoc-vien`, `/hoc-vien/chung-chi`, `/hoc-vien/don-hang`, `/hoc-vien/ho-so`, `/hoc-vien/khoa-hoc`, `/hoc-vien/lich-su`, `/hoc-vien/thong-bao` (+ `/hoc-vien/doi-mat-khau` của agent song song) |
| T-06-11 | Smoke test server local | `next start -p 3106` (staging env), curl từng trang | **PASS** — `/hoc-vien` + 6 trang con đều 307 về `/dang-nhap?next=...` khi chưa đăng nhập (middleware auth của agent song song — hành vi đúng, không phải lỗi); `/dang-nhap` 200; `/api/health` trả `{"ok":true,"status":"ok"}` (staging đã có bảng, khác lúc Task 05) |
| T-06-12 | Không secret ở frontend | Không thêm key/JWT nào; dashboard chỉ dùng anon key + JWT của chính user | **PASS** (kế thừa kiểm tra Task 05; không ghi giá trị key nào vào báo cáo) |
| T-06-13 | File gốc không đổi | Không chạm `Visfar_Academy.html` / `.gs`; `.env.local` đã khôi phục về bản prod sau smoke test | **PASS** |

### 5.2. Live staging — CHẠY ĐƯỢC MỘT PHẦN (REST), còn lại CHƯA CHẠY

| # | Kiểm thử | Kết quả thật | Điều kiện để chạy tiếp |
|---|---|---|---|
| L-06-01 | REST staging: bảng đã tồn tại? | **CHẠY — PASS.** `curl` REST anon tới 10 bảng (`profiles`, `enrollments`, `lesson_progress`, `certificates`, `orders`, `notifications`, `courses`, `learning_events`, `course_modules`, `lessons`) đều HTTP 200. `courses` có ≥ 1 dòng seed; các bảng còn lại trả `[]` (RLS anon + chưa có dữ liệu). Khác lúc Task 05 (0 bảng, `PGRST205`) — staging đã được migrate sau Task 05 | — |
| L-06-02 | Storage bucket `avatars` tồn tại? | **CHẠY — FAIL (ghi nhận, chưa sửa).** `GET /storage/v1/bucket/avatars` trả `400 {"code":"NoSuchBucket","message":"Bucket not found"}`. Upload avatar live chưa chạy được | Chạy migration 0007 (tạo bucket) + 0008 (policy) lên staging |
| L-06-03 | Đăng ký tài khoản test staging → đăng nhập → xem dashboard thật (hồ sơ, ghi danh, tiến độ, avatar, thông báo…) | **CHƯA CHẠY.** 1 lần thử `POST /auth/v1/signup` trả `429 {"code":429,"error_code":"over_email_send_rate_limit","msg":"email rate limit exceeded"}`. Không tạo được tài khoản test, không có JWT để kiểm thử RLS/upload thật | Chờ Supabase reset giới hạn gửi email (hoặc tắt xác nhận email / tạo tài khoản test từ Dashboard Supabase), rồi tạo 1 tài khoản test + 1 enrollment test + chạy lại L-06-03 |
| L-06-04 | RLS 2 tài khoản (A không xem được dữ liệu B) trên staging | **CHƯA CHẠY** (cần 2 tài khoản test — bị chặn bởi L-06-03). Lớp frontend + policy đã có test local (`security.test.ts`, `rls-policy.test.ts` của agent song song) | Như L-06-03, với 2 tài khoản |
| L-06-05 | Migration 0008 lên staging | **CHƯA CHẠY** (thiếu `SUPABASE_ACCESS_TOKEN` trong phiên làm việc, như Task 05) | Cấp lại access token → `supabase db push` / chạy SQL 0008 → kiểm chứng 4 policy `avatars_*` + `learning_events_select_own` theo checklist cuối file 0008 |

**Không bịa token:** không tạo, không đoán, không ghi bất kỳ access token / secret nào trong Task 06.

## 6. Việc cần user / coordinator quyết sau Task 06

1. Cấp lại `SUPABASE_ACCESS_TOKEN` để chạy migration 0007 (bucket) + 0008 (policy avatars + learning_events) lên staging, rồi chạy L-06-02/L-06-05.
2. Gỡ rate-limit email staging (hoặc tạo tài khoản test từ Supabase Dashboard), rồi chạy L-06-03/L-06-04 với 1–2 tài khoản test + enrollment test.
3. Quyết bổ sung trigger/`WITH CHECK` hạn chế cột ở `profiles_update_own` (chỉ `full_name`/`phone`/`province`/`avatar_url`) hay giữ kỷ luật ở client như hiện tại (§4.4.3).
4. Xác nhận file báo cáo tổng hợp Task 06 là `docs/frontend/TASK06_REPORT.md` (agent song song) và file này chỉ là báo cáo phần Dashboard, tránh trùng lặp khi hợp nhất.
