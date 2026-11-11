# Báo cáo Task 06 — Authentication & Student Dashboard (TỔNG HỢP, BẢN CUỐI)

**Dự án:** Visfar Academy
**Ngày:** 10/11/2026
**Phạm vi:** Frontend Next.js `apps/web` — auth, dashboard học viên, middleware/bảo vệ route, security test.
**Trạng thái chung: CODE ĐÃ XONG + TEST LOCAL PASS; VÁ BẢO MẬT 0009 + 0010 ĐÃ ÁP STAGING + PROD VÀ KIỂM THỬ LIVE RLS/AVATAR PASS (10/11/2026, user auto-duyệt — xem §5.2 mới và §6). Còn dở: đăng ký qua form (rate-limit email 429 vẫn còn), trang Lịch sử học truy vấn cột không tồn tại (follow-up, xem §5.2).**

> Lưu ý về bản báo cáo này: bản tổng hợp đầu tiên (viết lúc 22:11 +07) được viết trước khi 3 nhóm bàn giao code nên kết luận "chưa có bàn giao" đã lỗi thời. Bản này viết lại sau khi cả 3 nhóm (Auth, Dashboard, Security) đã bàn giao và coordinator đã kiểm chứng lại bằng `npm test` / `typecheck` / `lint` / `build` thật. Báo cáo chi tiết từng phần: [TASK06_AUTH_REPORT.md](sandbox://workspace/visfar-academy-platform/docs/frontend/TASK06_AUTH_REPORT.md), [TASK06_DASHBOARD_REPORT.md](sandbox://workspace/visfar-academy-platform/docs/frontend/TASK06_DASHBOARD_REPORT.md), [TASK06_SECURITY_REPORT.md](sandbox://workspace/visfar-academy-platform/docs/frontend/TASK06_SECURITY_REPORT.md).

## 1. File giữ nguyên

- Trang HTML gốc `workspace/user/files/Visfar_Academy.html` và `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` — chỉ đọc, không sửa.
- Migration cũ 0001–0007 — không sửa nội dung (chỉ đổi thứ tự 0001/0004 đã phê duyệt ở Task 05).
- `validation.ts`, `courses.ts`, trang `/chuong-trinh`, `workers/api/`, docs kiến trúc/quyết định.
- Không có service-role key / JWT thật trong `src/` (grep = 0).

## 2. File sửa

| File | Thay đổi |
|---|---|
| `src/lib/auth.ts` | Thêm `emailRedirectTo`, gửi lại email xác nhận, `changePassword()` (xác minh mật khẩu cũ bằng đăng nhập lại), `getSessionState`, `subscribeToAuthChanges`, cookie-sync storage |
| `src/lib/supabase.ts` | Kiểm tra lại `persistSession: true` |
| `src/app/dang-nhap/page.tsx`, `src/app/dang-ky/page.tsx` | Param `next` (chặn open-redirect), link quên mật khẩu, thông báo hết hạn session |
| `src/app/hoc-vien/page.tsx` | Viết lại thành trang tổng quan dashboard |
| `src/styles/globals.css` | Chỉ append class mới (`.auth-links`, class dashboard, media query header ≤900px sửa tràn ngang) |

## 3. File mới

- **Auth:** `src/middleware.ts`, `src/lib/session-guard.ts`, `src/lib/useRequireAuth.ts`, `src/app/auth/callback/page.tsx`, `src/app/quen-mat-khau/page.tsx`, `src/app/dat-lai-mat-khau/page.tsx`, `src/app/hoc-vien/layout.tsx`, `src/app/hoc-vien/doi-mat-khau/page.tsx`, `src/lib/auth-flows.test.ts` (24 test)
- **Dashboard:** `src/lib/dashboard.ts` (+ `dashboard.test.ts`, 36 test), 6 trang con `/hoc-vien/ho-so`, `khoa-hoc`, `lich-su`, `thong-bao`, `chung-chi`, `don-hang`, `src/components/dashboard/` (DashboardNav…)
- **Security:** `src/lib/security.test.ts` (13), `src/lib/rls-policy.test.ts` (11), `src/lib/session-guard.test.ts` (12)
- **Migration:** `supabase/migrations/0010_dashboard_avatar_storage.sql` (4 policy Storage bucket `avatars`; phần `learning_events_select_own` đã bỏ trước khi áp vì bảng thật không có cột `user_id` — xem §5.2), `supabase/migrations/0009_security_fixes.sql` (sửa H1–H4, xem §6) — cả hai **đã áp staging + prod ngày 10/11/2026 (HTTP 201)**

## 4. Chức năng đã làm

**Authentication (Supabase Auth):** đăng ký + xác minh email (gửi lại email xác nhận), đăng nhập (param `next`), đăng xuất, quên mật khẩu, đặt lại mật khẩu (PKCE callback `/auth/callback`), đổi mật khẩu (xác minh mật khẩu hiện tại), đăng xuất mọi thiết bị (`signOut({scope:'global'})` — Supabase có hỗ trợ; access token đã cấp vẫn dùng được tới khi hết hạn ≤1 giờ), quản lý phiên (persistSession, refresh token, tự về đăng nhập khi `SIGNED_OUT`). Route guard 2 lớp: middleware `/hoc-vien/*` + `useRequireAuth` trong layout.
**Student Dashboard:** thông tin cá nhân (sửa tên/SĐT/tỉnh — `updateMyProfile` chỉ gửi 3 trường, không bao giờ gửi `role`/`email`), ảnh đại diện (upload bucket `avatars`, JPG/PNG/WebP ≤2 MB, đường dẫn `<userId>/avatar.<ext>`), khóa học đang học / hoàn thành, tiến độ theo ngưỡng 90% video / theo module (QĐ 17), lịch sử học (`learning_events`, 50 gần nhất), thông báo (`notifications` + đánh dấu đã đọc), chứng chỉ, đơn hàng. Mọi dữ liệu từ backend thật — không mock, không dữ liệu giả, không localStorage làm database; chưa có dữ liệu thì empty state.
**UX:** responsive (body 16px, nút ≥44px), mọi thao tác có loading/error/empty/success state, giữ phong cách luxury (ivory champagne, vàng gold, Be Vietnam Pro). Sửa tràn ngang header ở 390px bằng media query ≤900px (chưa kiểm chứng trực quan trên điện thoại thật).

## 5. Kết quả kiểm thử

### 5.1 Local — PASS thật (coordinator chạy lại sau khi cả 3 nhóm xong)

| Kiểm thử | Kết quả |
|---|---|
| `npm test` | **176/176 PASS, 11 file** (Task 05: 80; thêm auth-flows 24, dashboard 36, security 13, rls-policy 11, session-guard 12) |
| `npm run typecheck` | PASS, 0 lỗi |
| `npm run lint` | PASS, 0 lỗi |
| `npm run build` | PASS, 19 route + middleware 34.3 kB |
| Smoke `next start` | `/hoc-vien` → 307 về `/dang-nhap?next=%2Fhoc-vien`; `/hoc-vien/khoa-hoc`, `/hoc-vien/doi-mat-khau` → 307; cookie rác → 307; `/` và `/dang-nhap` → 200 |
| Grep service-role/JWT trong `src/` | PASS, 0 match |
| Grep mock/fake trong dashboard | PASS, chỉ comment cảnh báo |

(Lưu ý: có 1 lần báo 181/182 do file test live tạm của nhóm Auth; file tạm đã xóa sau khi chạy, số liệu ổn định hiện tại là 176/176.)

### 5.2 Live — VÁ 0009/0010 + KIỂM THỬ RLS/AVATAR PASS (10/11/2026, user auto-duyệt; chi tiết đầy đủ xem `docs/supabase/BACKEND_TEST_REPORT.md` §5E)

- **0009 + 0010:** staging PASS (HTTP 201), prod PASS (HTTP 201). Staging/prod: 5 bucket, 4 policy `avatars_*`, policy public **80** (81 − 2 + 1). File avatar đã đổi số `0008` → `0010` (xung đột số đã xử lý). 0010 lần 1 FAIL `42703: column "user_id" does not exist` — phần (b) `learning_events_select_own` truy vấn cột không tồn tại (bảng thật chỉ có `course_id`/`lesson_id`/`title`/`starts_at`...); đã bỏ phần (b) trước khi áp, chạy lại PASS.
- **2 tài khoản test trên staging** (tạo qua Auth Admin API, bỏ qua rate-limit `signUp` 429): test-student-01@visfar-academy.test (`8c2ffa39-a8e3-4221-b546-50234a806438`, student) và test-instructor-01@visfar-academy.test (`08bb74ee-79a2-4b9c-8fb2-158c02dbcc9c`, instructor — gán qua `user_roles`, trigger đồng bộ sang `profiles.role`). Cả hai đăng nhập password grant HTTP 200, email đã xác nhận. Mật khẩu test sinh ngẫu nhiên, không ghi vào tài liệu — muốn đăng nhập lại thì đặt lại mật khẩu qua Dashboard → Authentication → Users.
- **Kiểm thử live với 2 JWT test (staging) — đều PASS:** H1 student `PATCH profiles SET role='admin'` bị chặn (HTTP 400, trigger `trg_profiles_block_role_change`, role vẫn `student`); H2 student `INSERT enrollments status='active'` bị chặn (HTTP 403, 42501); H3 student `INSERT lesson_progress 100%` bị chặn (HTTP 403, 42501); student không SELECT được profile/enrollments của người khác (HTTP 200, 0 dòng); upload avatar vào thư mục của mình PASS (HTTP 200), upload vào thư mục người khác bị chặn (HTTP 400), đọc công khai avatar PASS (HTTP 200, đúng magic PNG); đăng xuất global HTTP 204.
- **Đăng ký qua form — VẪN CHƯA CHẠY:** `signUp` anon vẫn trả `429 over_email_send_rate_limit`. Tài khoản test phải tạo qua Admin API. Cần theo dõi rate-limit reset hoặc cấu hình lại email (Resend) trước khi mở đăng ký công khai.
- **Phát hiện follow-up — trang Lịch sử học:** `dashboard.ts` `getMyLearningHistory()` truy vấn `learning_events` với các cột `event_type`, `event_data`, `occurred_at`, `user_id` — các cột này KHÔNG tồn tại trong bảng thật. Trang `/hoc-vien/lich-su` sẽ lỗi 400 khi chạy thật thay vì empty state. Lịch sử học thuộc về `activity_logs` (có `user_id`, `action`, `created_at`) hoặc `lesson_progress`. Cần sửa `dashboard.ts` ở follow-up Task 06 / Task 07.
- **Middleware live (đã kiểm chứng trước đó):** không cookie → 307; JWT hết hạn + refresh sai → 307 về đăng nhập kèm `reason=expired`; JWT giả mạo `exp` tương lai → 200 nhưng body chỉ có "Đang kiểm tra phiên đăng nhập…", không rò dữ liệu. Giới hạn: middleware chỉ đọc `exp`, không verify chữ ký JWT (verify thật cần `@supabase/ssr` — follow-up, bảo mật thật do RLS đảm nhiệm).

## 6. Phát hiện bảo mật quan trọng — 3 lỗ RLS trong migration 0001 (đã có bản sửa, CHƯA áp)

- **H1 — leo thang đặc quyền:** `profiles_update_own` (0001:446) không có `WITH CHECK` về cột → học viên gọi REST trực tiếp có thể `UPDATE profiles SET role='admin'`; `current_role()` đọc `profiles.role` nên mọi policy "chỉ admin" mở theo.
- **H2 — tự ghi danh khóa trả phí:** `enrollments_insert_own` chỉ kiểm tra `user_id` → insert trực tiếp enrollment `status='active'` cho bất kỳ khóa nào, bỏ qua đơn/thanh toán.
- **H3 — tự ghi tiến độ giả:** `progress_own` là `FOR ALL` cho chính mình → INSERT/UPDATE `lesson_progress` tùy ý.
- **H4 (nhẹ):** `profiles_insert_own` không kiểm tra `role`.
- **Đã sửa** bằng [supabase/migrations/0009_security_fixes.sql](sandbox://workspace/visfar-academy-platform/supabase/migrations/0009_security_fixes.sql): trigger chặn tự đổi role + `REVOKE UPDATE (role) FROM authenticated`; drop `enrollments_insert_own`; `progress_own` → SELECT-only; `profiles_insert_own` thêm `role='student'`. **ĐÃ ÁP staging + prod ngày 10/11/2026 (HTTP 201) và kiểm chứng live: H1/H2/H3 đều bị chặn đúng (xem §5.2).**
- Phát hiện phụ: `profiles_update_own` không giới hạn cột (client tự kỷ luật, có test) — cân nhắc trigger/`WITH CHECK` ở migration sau; `event_registrations` cho anon INSERT trực tiếp (lệch `RLS_POLICIES.md` §6 — chưa sửa, chờ quyết).

## 7. Xung đột / việc dở dang cần xử lý trước khi push migration

1. **Trùng số 0008 — ĐÃ XỬ LÝ ngày 10/11/2026:** file avatar đã đổi số thành `0010_dashboard_avatar_storage.sql`; `0008_fix_fk_answers.sql` giữ nguyên. Không còn file trùng số.
2. **Thứ tự áp migration — ĐÃ XONG:** `0009` (security) → `0010` (avatar) đã áp staging + prod (HTTP 201), kiểm chứng đầy đủ (xem §5.2).
3. **`.env.local` hiện trỏ prod** (`ugynqjqyfynkmqutoarp`) — coordinator kiểm chứng lại sau khi các nhóm xong; bản chuẩn trước khi deploy prod cần xác nhận.
4. **Chưa có:** CSP/HSTS/X-Frame-Options, Turnstile (chưa có site key), `/admin/*`, kiểm chứng trực quan 390px/1440px trên điện thoại thật.

## 8. Phương án rollback

- Revert code Task 06 về trạng thái cuối Task 05 (git revert các file §2–§3); trang HTML gốc ngoài repo không ảnh hưởng.
- Migration 0009/0010 đã áp lên staging/prod; nếu cần rollback DB thì dùng migration ngược (drop policy/trigger đã thêm, khôi phục policy cũ) — ghi trong file 0009. 2 tài khoản test chỉ tồn tại trên staging, không ảnh hưởng prod.
- Điều kiện xóa endpoint Apps Script cũ vẫn chưa đủ (nay thêm: middleware + security headers phải đạt trên staging; 0009 đã áp xong).

## 9. Việc cần làm tiếp (theo thứ tự)

1. ~~Phê duyệt + đổi số migration 0008 trùng, áp 0007 → 0008 → 0009 lên staging~~ — **ĐÃ XONG ngày 10/11/2026** (đổi số → 0010, áp 0009 + 0010 staging + prod, kiểm thử live PASS — xem §5.2).
2. ~~Chờ rate-limit email staging reset, tạo 2 tài khoản test~~ — **ĐÃ XONG** (2 tài khoản test tạo qua Admin API, đăng nhập + RLS + leo role + upload avatar live đều PASS). Còn lại: đăng ký qua form vẫn 429 — cần theo dõi rate-limit reset hoặc cấu hình email (Resend) trước khi mở đăng ký công khai.
3. **MỚI — sửa trang Lịch sử học:** `dashboard.ts` `getMyLearningHistory()` truy vấn cột không tồn tại trên `learning_events`; chuyển sang đọc `activity_logs`/`lesson_progress` (xem §5.2).
4. Kiểm tra trực quan 390px/1440px trên điện thoại thật (đặc biệt header sau sửa).
5. Follow-up không chặn: verify chữ ký JWT ở middleware (`@supabase/ssr`), CSP/HSTS/X-Frame-Options, Turnstile, `event_registrations` anon INSERT.
