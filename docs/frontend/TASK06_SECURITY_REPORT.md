# Báo cáo Task 06 — SECURITY TEST + UX KIỂM CHỨNG (phần Security)

**Dự án:** Visfar Academy
**Ngày:** 10/11/2026
**Phạm vi:** `apps/web` + migration RLS. Chỉ test và sửa lỗi bảo mật/UX phát hiện được —
không viết lại code Auth/Dashboard của 2 nhóm khác (chỉ đọc để kiểm chứng).
**Trạng thái chung:** Test tự động **176/176 PASS**; phát hiện **3 lỗ RLS nghiêm trọng
trong migration 0001** (chưa từng được sửa bởi 0005/0006/0007) và **1 lỗi tràn ngang
header ở 390px** — cả 4 đã sửa (migration `0009`, CSS). Kiểm thử live 2 tài khoản
**CHƯA CHẠY** (staging Auth bị rate-limit, xem §4). Áp migration 0009 lên staging/prod
**CHƯA CHẠY** (cần access token + phê duyệt, xem §6).

Tài liệu đã đọc trước khi làm: `docs/frontend/TASK05_REPORT.md`,
`docs/database/RLS_POLICIES.md`, `docs/architecture/ROLE_PERMISSION_MATRIX.md`,
`docs/DECISIONS.md`, cộng `supabase/migrations/0001–0007`,
`docs/supabase/BACKEND_TEST_REPORT.md` và `docs/supabase/MIGRATION_GUIDE.md`
(đối chiếu trạng thái staging thật).

> Ghi chú môi trường: trong lúc làm phần này, 2 nhóm song song vẫn đang sửa cùng repo
> (nhóm Auth thêm `src/middleware.ts`, `src/lib/session-guard.ts`, `useRequireAuth`,
> `/hoc-vien/layout.tsx`, `/auth/callback`; nhóm Dashboard thêm `src/lib/dashboard.ts`,
> `/hoc-vien/*`, `0010_dashboard_avatar_storage.sql`; nhóm Backend thêm
> `0008_fix_fk_answers.sql`). Mọi kết luận dưới đây kiểm chứng trên code **tại thời
> điểm chạy test/curl** (ghi rõ trong từng mục). `.next` bị nhiều agent build chung
> nên có 1 lần build lỗi transient (xem §7). Báo cáo tổng hợp Task 06 của coordinator
> (`docs/frontend/TASK06_REPORT.md`, viết 22:11) ghi "chưa có bàn giao Task 06" — đó là
> trạng thái **trước khi 3 nhóm bàn giao**; báo cáo này chỉ ghi phần Security Test +
> UX kiểm chứng, không ghi đè báo cáo tổng hợp.

---

## 1. File được tạo / sửa (phần này)

| File | Thay đổi |
|---|---|
| `apps/web/src/lib/security.test.ts` (mới, 13 test) | Mock Supabase client: query chỉ lọc theo uid của mình; signUp/signIn không gửi `role`; không có đường update profiles/insert `user_roles`; token hết hạn → signed-out; kiểm tra tĩnh `dashboard.ts` (nhóm Dashboard) |
| `apps/web/src/lib/rls-policy.test.ts` (mới, 11 test) | Audit tĩnh file migration SQL: ghi nhận 3 lỗ trong 0001, xác nhận 0006/0007 không sửa chúng, xác nhận 0009 đóng cả 3 lỗ |
| `apps/web/src/lib/session-guard.test.ts` (mới, 12 test) | Hàm thuần dùng chung middleware/client: tên cookie, chống open-redirect `?next=`, đọc `exp` JWT, parse cookie phiên |
| `supabase/migrations/0009_security_fixes.sql` (mới) | **Sửa H1/H2/H3/H4** (xem §3). Đánh số 0009 vì 0008 đã thuộc về fix F-12 đã phê duyệt |
| `apps/web/src/styles/globals.css` (thêm cuối file) | **Sửa tràn ngang header ở ≤900px** (xem §5). Chỉ thêm media query, không đổi chữ/thứ tự |
| `docs/frontend/TASK06_SECURITY_REPORT.md` | Báo cáo này |

Không sửa `auth.ts`, `dashboard.ts`, `middleware.ts`, `session-guard.ts`,
`supabase.ts`, migration 0001–0008, `.env.*`.

---

## 2. Test đã thêm / chạy

| # | Test | Kết quả |
|---|---|---|
| T-06-01 | `npm test` (vitest 2.1.9), 10 file lúc 15:24 | **PASS — 176/176** (Task 05: 80; thêm: dashboard 36 của nhóm Dashboard, auth-flows 24 của nhóm Auth, security 13 + rls-policy 11 + session-guard 12 của phần này). **Lưu ý cuối phiên:** chạy lại lúc 15:2x sau khi nhóm Auth thêm file live test `__live-task06.test.ts` thì **181/182** — 1 test fail duy nhất là test live của nhóm Auth ("quên mật khẩu: gửi email đặt lại" → `error` thay vì `ok`), cùng nguyên nhân rate-limit email staging 429 đã ghi ở §4a; các test của phần này (security 13 + rls-policy 11 + session-guard 12) vẫn **PASS toàn bộ**. |
| T-06-02 | `npm run typecheck` (`tsc --noEmit`) | **PASS — 0 lỗi** |
| T-06-03 | `npm run lint` (`eslint .`) | **PASS — 0 lỗi** |
| T-06-04 | `npm run build` (Next.js 15.4.11) | **PASS ở lần chạy lại** — đủ 19 route + middleware 34,3 kB (xem §7 về 1 lần lỗi transient) |
| T-06-05 | `security.test.ts` (13) | **PASS** — xem §4 (a)/(c)/(d) |
| T-06-06 | `rls-policy.test.ts` (11) | **PASS** — 0001 còn 3 lỗ (ghi nhận), 0009 đóng cả 3, không mở thêm đường ghi client |
| T-06-07 | `session-guard.test.ts` (12) | **PASS** — cookie name, open-redirect, exp, parse cookie |

---

## 3. Lỗi phát hiện và đã sửa

### H1 — NGHIÊM TRỌNG: học viên tự nâng `profiles.role` thành `admin` (RLS 0001)

- **Bằng chứng tĩnh:** `0001_init_schema.sql:446` policy `"profiles_update_own"`
  `FOR UPDATE USING (id = auth.uid() OR current_role() = 'admin')` — **không có
  `WITH CHECK` về cột nào**. Với UPDATE, khi thiếu `WITH CHECK` thì `USING` vừa là
  điều kiện dòng cũ vừa là điều kiện dòng mới; điều kiện `id = auth.uid()` vẫn đúng
  khi dòng mới có `role='admin'` (id không đổi). Học viên gọi trực tiếp qua Supabase
  REST `update profiles set role='admin' where id = <uid mình>` sẽ thành công.
  `current_role()` (0001) đọc `profiles.role`, nên sau đó mọi policy "chỉ admin" đều
  mở cho học viên đó. Mâu thuẫn `RLS_POLICIES.md` §1.5 + §7.2 và ma trận quyền
  hành động 37 (chỉ admin cấp/thu hồi role).
- **Vì sao các lớp khác không cứu được:** frontend không có nút nào làm việc này
  (`auth.ts` không có hàm update profile; `dashboard.ts:updateMyProfile` chỉ gửi
  `full_name/phone/province` — đã kiểm chứng bằng test), nhưng RLS là lớp chặn cuối,
  phải chặn cả khi gọi trực tiếp. Trigger `trg_sync_profiles_role` (0007) chỉ đồng
  bộ `user_roles → profiles.role`, không ngăn update trực tiếp `profiles.role`.
  Lưu ý: staging đang ở trạng thái 0001→0006 (0007 FAIL vì F-12, xem
  `BACKEND_TEST_REPORT.md` §5C), nên `profiles.role` **vẫn là nguồn sự thật của
  `current_role()`** trên staging — leo thang là có hiệu lực thật, không chỉ lý thuyết.
- **Đã sửa (0009):** (a) trigger `trg_profiles_block_role_change`
  (`BEFORE UPDATE OF role`) — raise exception khi `NEW.role` khác `OLD.role` và
  người gọi có JWT mà không phải admin; service-role (`auth.uid() IS NULL`, đi qua
  Workers) và admin JWT vẫn được đổi; (b) `REVOKE UPDATE (role) ON profiles FROM
  authenticated` (phòng thủ chiều sâu ở mức quyền cột; trigger đồng bộ 0007 chạy
  `SECURITY DEFINER` với quyền owner nên không bị ảnh hưởng).

### H2 — NGHIÊM TRỌNG: học viên tự ghi danh khóa trả phí (RLS 0001)

- **Bằng chứng tĩnh:** `0001:508` policy `"enrollments_insert_own"`
  `FOR INSERT WITH CHECK (user_id = auth.uid())` — chỉ kiểm tra `user_id`, không
  kiểm tra `course_id`/`status`/`order_id`. Học viên insert trực tiếp enrollment
  `status='active'` cho bất kỳ khóa nào, bỏ qua đơn hàng/thanh toán. Mâu thuẫn
  `RLS_POLICIES.md` §5 ("Không có policy INSERT nào trên enrollments cho anon hay
  authenticated") và ma trận quyền hành động 6.
- **Đã sửa (0009):** `DROP POLICY "enrollments_insert_own"` — không có policy thay
  thế. Enrollment chỉ tạo qua Workers service-role (đơn `paid` / khóa miễn phí /
  admin tặng kèm `audit_logs`).

### H3 — NGHIÊM TRỌNG: học viên tự ghi tiến độ giả (RLS 0001)

- **Bằng chứng tĩnh:** `0001:514` policy `"progress_own"` `FOR ALL USING
  (user_id = auth.uid())` — học viên INSERT/UPDATE `lesson_progress` của mình tùy
  ý (vd 100% khi chưa học). Mâu thuẫn `RLS_POLICIES.md` §7.7 ("Không policy
  INSERT/UPDATE trực tiếp cho client: ghi qua Workers API").
- **Đã sửa (0009):** drop `progress_own`, thay bằng `progress_select_own`
  (SELECT-only cho chính mình; admin đã có `progress_admin_read` riêng). Tiến độ chỉ
  ghi qua Workers sau khi kiểm tra enrollment + ngưỡng.

### H4 — Nhẹ, cùng họ H1: `profiles_insert_own` không kiểm tra `role`

- `0001` `WITH CHECK` chỉ kiểm tra `id`. Đường chính không ảnh hưởng (trigger
  `handle_new_user` tạo profile bằng `SECURITY DEFINER`, bypass RLS), nhưng là
  phòng thủ chiều sâu. **Đã sửa (0009):** tạo lại với
  `WITH CHECK (id = auth.uid() AND role = 'student')`.

### H5 — UX: header tràn ngang ở 390px (đã sửa bằng CSS)

- **Bằng chứng tĩnh:** `.site-header .wrap` là flex 1 hàng, **không wrap**
  (brand + 5 link nav + `AccountNav` + nút CTA ≈ 1000px) trong khi viewport 390px;
  trước sửa không có media query nào cho header. **Đã sửa:** thêm media query
  `≤900px` cuối `globals.css` — header được wrap, nav xuống hàng riêng
  (`order: 3`, full-width), CTA full-width (`order: 4`), `AccountNav` được wrap khi
  tên dài. Chỉ CSS, không đổi chữ/thứ tự. Kiểm chứng trực quan trên điện thoại thật
  vẫn **CHƯA CHẠY** (subagent không có trình duyệt thật — xem §5).

### Vấn đề danh số migration — cần coordinator xử lý (không tự đổi file nhóm khác)

- `0008` đã thuộc về fix F-12 (`0008_fix_fk_answers.sql`, user phê duyệt 10/11/2026
  22:14) nên file sửa bảo mật này đánh số **0009**. Hiện có **3 file cùng số 0008**:
  `0008_fix_fk_answers.sql` (F-12, đã duyệt), `0010_dashboard_avatar_storage.sql`
  (nhóm Dashboard), và file này đã dời sang 0009. **Coordinator cần đổi số
  `0010_dashboard_avatar_storage.sql` trước khi push**, tránh thứ tự áp migration
  sai. Thứ tự chạy đúng: `0008 (F-12) → chạy lại 0007 → 0009 (file này)`.

---

## 4. Kết quả từng mục security

### (a) Học viên A không xem được dữ liệu học viên B — PASS (mức frontend + anon REST) / CHƯA CHẠY (live 2 tài khoản)

| Kiểm chứng | Kết quả |
|---|---|
| `security.test.ts`: `getMyProfileState` query `profiles` với `.eq('id', uid A)`, không bao giờ id B | **PASS** |
| `security.test.ts`: `getMyEnrollments` query `enrollments` với `.eq('user_id', uid A)`, không bao giờ user_id B | **PASS** |
| `security.test.ts` + `dashboard.test.ts` (nhóm Dashboard): mọi query đọc `profiles/enrollments/lesson_progress/learning_events/orders/certificates/notifications/order_items` trong `dashboard.ts` đều lọc theo uid của mình; các lookup `.in(...)` (courses/lessons) chỉ dùng id suy ra từ chính dữ liệu của mình | **PASS** |
| Chưa đăng nhập: không query `profiles`/`enrollments` nào | **PASS** |
| Anon REST staging (ngày 10/11/2026, anon key `.env.staging`): `GET /rest/v1/{profiles,enrollments,lesson_progress,orders,payments,certificates,notifications,user_roles,leads,quiz_options,events,posts}` → **HTTP 200 `[]`**; `courses` (published) trả 1 dòng seed; `question_options` → 404 `PGRST205` (bảng chưa tồn tại sau rename — staging đang ở 0001→0006) | **PASS — không rò rỉ cho anon** |
| Live 2 tài khoản (A đọc dữ liệu B, A thử update/insert) | **CHƯA CHẠY** — xem dưới |

**Vì sao CHƯA CHẠY live:** đã thử tạo 2 tài khoản test trên staging trong phiên này:
`example.com` bị Supabase từ chối (`email_address_invalid`); bật ẩn danh đã tắt
(`anonymous_provider_disabled`); đăng ký bằng Gmail test
(`visfar.test.a.20261110@gmail.com`) bị **`429 over_email_send_rate_limit`
("email rate limit exceeded")** — thử lại sau ~40 phút vẫn 429. Không có tài khoản
test nào được tạo (không tạo dòng nào trong Auth staging, không cần dọn).
Điều kiện chạy lại: chờ rate-limit reset (hoặc user tạo 2 tài khoản test từ dashboard
Supabase) → chạy checklist § cuối file 0009 (mục 1, 2, 5).

### (b) Người chưa đăng nhập không truy cập được `/hoc-vien/*` — PASS (live, server thật)

Middleware do nhóm Auth thêm trong lúc làm Task 06 (`src/middleware.ts`, matcher
`/hoc-vien/:path*`) + layout client `useRequireAuth` (`/hoc-vien/layout.tsx`).
Kiểm chứng live bằng `next start` (build sau sửa, port 3106):

| Request | Kết quả |
|---|---|
| `GET /hoc-vien` không cookie | **PASS — 307 → `/dang-nhap?next=%2Fhoc-vien`** |
| `GET /hoc-vien/khoa-hoc` không cookie | **PASS — 307 → `/dang-nhap?next=%2Fhoc-vien%2Fkhoa-hoc`** |
| `GET /hoc-vien` với cookie rác (`sb-<ref>-auth-token=garbage.notajwt`) | **PASS — 307 → `/dang-nhap?next=%2Fhoc-vien`** |
| `GET /` và `GET /dang-nhap` không cookie (đối chứng công khai) | **PASS — 200** |
| `GET /hoc-vien` với JWT giả mạo, `exp` tương lai, không chữ ký hợp lệ | **200, body chỉ có "Đang kiểm tra phiên đăng nhập…" — KHÔNG có dữ liệu hồ sơ/khóa học.** Đúng như giới hạn đã ghi trong `middleware.ts`: middleware chỉ đọc `exp` để định tuyến, không verify chữ ký; token giả qua được middleware nhưng bị Supabase/RLS từ chối ở mọi query thật, và layout client chặn tiếp. Đây là giới hạn đã ghi nhận, không phải rò rỉ dữ liệu. Muốn verify thật ở server cần `@supabase/ssr` hoặc gọi Auth API — ngoài phạm vi Task 06, ghi lại làm follow-up. |
| Unit test `session-guard.test.ts` (12): tên cookie, `?next=` an toàn, `exp`, parse cookie | **PASS** |

### (c) Học viên không thể tự thay đổi role — PASS (mức client) / FAIL (mức RLS 0001) → ĐÃ SỬA bằng 0009, CHƯA CHẠY live

| Kiểm chứng | Kết quả |
|---|---|
| `signUpWithEmail` không gửi field `role` (chỉ `full_name` trong `options.data`) | **PASS** |
| `signInWithEmail` không gửi field `role` | **PASS** |
| `auth.ts`: không `.update(`, không `.insert(`, không `.from('user_roles')` | **PASS** |
| `dashboard.ts:updateMyProfile`: chỉ gửi `full_name/phone/province` + `.eq('id', userId)`, không `role`/`email` | **PASS** |
| `supabase.ts`: không có service-role key / JWT thật | **PASS** |
| RLS 0001: `profiles_update_own` cho phép update `role` (H1) | **FAIL → đã sửa bằng 0009 (trigger + REVOKE)** |
| RLS 0001: `user_roles` insert chỉ admin (`user_roles_admin_all`) | **PASS** (không cần sửa) |
| Live: thử `update profiles.role` / `insert user_roles` bằng JWT student thật | **CHƯA CHẠY** — cùng blocker rate-limit như (a); chạy checklist § cuối file 0009 (mục 1, 2) sau khi có tài khoản test |

### (d) Session hết hạn → đăng xuất, token cũ không dùng được — PASS (mức unit + middleware live) / CHƯA CHẠY (hết hạn thật 1 giờ)

| Kiểm chứng | Kết quả |
|---|---|
| `security.test.ts`: `getUser` trả lỗi/null (token không hợp lệ) → `signed-out`, không success giả, không query | **PASS** |
| `security.test.ts`: `signOut` gọi `auth.signOut`; sau đó `getUser` null → `signed-out` | **PASS** |
| `session-guard.test.ts`: `isTokenExpired` (trừ 30 giây lệch đồng hồ), `decodeJwtExp` | **PASS** |
| Live middleware: JWT hết hạn + refresh token sai → **307 → `/dang-nhap?next=%2Fhoc-vien&reason=expired`** (đã thử refresh qua Auth API, thất bại → redirect) | **PASS** |
| Live: chờ token hết hạn thật (~1 giờ) rồi dùng lại token cũ | **CHƯA CHẠY** — cần phiên kiểm thử dài; Supabase JWT là stateless nên access token cũ về lý thuyết vẫn qua được RLS cho tới `exp`, việc "đăng xuất" dựa vào refresh-token rotation + `signOut` xóa session. Ghi rõ để không ngộ nhận: middleware + `getSession()`/`onAuthStateChange` xử lý hết hạn bằng refresh, không có blacklist JWT. |

---

## 5. UX kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Body ≥16px | **PASS** — `html { font-size: 16px }`, `body { font-size: 1rem }`, input/search 1rem. Ghi nhận nhỏ (không sửa): `.muted`/`.hint`/`.form-note` 0,95rem (15,2px) và `.pill` 0,875rem (14px) là chữ phụ/nhãn, dưới 16px — theo chuẩn đã chốt trước đây nhãn 14px được chấp nhận; nếu muốn siết đúng 16px cho mọi chữ thì báo lại. |
| Nút chạm ≥44px | **PASS** — `button` 44px, `.btn` 48px, input/select 50px, nav link 44px, tab 44px, auth link 44px |
| Không tràn ngang 390px | **FAIL → ĐÃ SỬA** — header (H5, §3). Các khối khác kiểm tra tĩnh đạt: `.wrap` `max-width` + padding `clamp(18px, 4,5vw, 32px)`, `.course-grid` 1 cột ≤700px, `.newsletter-row`/`.tabs` có `flex-wrap`, input `width: 100%`. **Kiểm chứng trực quan 390px và 1440px trên trình duyệt/điện thoại thật: CHƯA CHẠY** (subagent không có trình duyệt thật) — cần parent/user kiểm tra trên điện thoại thật sau khi sửa H5. |
| Empty / loading / error / success cho mọi thao tác | **PASS (kiểm tra tĩnh + test)** — dashboard `/hoc-vien` và 7 trang con có đủ trạng thái loading (`Đang tải…` / `Đang kiểm tra phiên đăng nhập…`), signed-out (redirect `/dang-nhap?next=`), empty ("Bạn chưa ghi danh khóa học nào", lịch sử trống), error + nút "Thử lại", success; form tư vấn/newsletter/auth có idle/submitting/success/error + "Thử lại" (đã có từ Task 05, không đổi). Tổng 69 điểm khớp chuỗi trạng thái trong `src/app/hoc-vien/**` và `src/components/dashboard/`. |
| Không còn dữ liệu giả/mock trong dashboard | **PASS** — grep `mock\|Mock\|giả\|dữ liệu mẫu\|Lorem` trong `src/app/hoc-vien/**`, `src/components/dashboard/`, `src/lib/dashboard.ts` chỉ trúng 1 dòng comment "KHONG mock, KHONG du lieu [giả]" trong `dashboard.ts`; mọi hàm `getMy*` đọc thật từ Supabase và trả `error` rõ ràng khi lỗi, không fallback dữ liệu mẫu. |

---

## 6. Việc cần phê duyệt / làm tiếp (sau phần Security)

1. **Phê duyệt + áp migration 0009 lên staging** theo thứ tự: `0008_fix_fk_answers.sql`
   (F-12, đã duyệt) → chạy lại 0007 → **0009** (cần `SUPABASE_ACCESS_TOKEN` — cùng
   blocker như Task 05 C-05-01). Sau đó chạy checklist kiểm chứng ở cuối file 0009
   (6 mục: update role bị chặn, insert `user_roles` bị chặn, insert enrollment bị
   chặn, insert progress bị chặn, SELECT chéo 0 dòng, đồng bộ role 0007 không vỡ).
2. **Đổi số `0010_dashboard_avatar_storage.sql`** (nhóm Dashboard) trước khi push —
   tránh 3 file cùng số 0008 (xem §3).
3. **Chạy live 2 tài khoản** khi Auth rate-limit staging reset (hoặc user tạo 2 tài
   khoản test từ Supabase dashboard): A đọc dữ liệu B, A update `role`, A insert
   `user_roles`/`enrollments`/`lesson_progress` — kỳ vọng tất cả bị chặn sau 0009.
4. **Kiểm tra trực quan 390px + 1440px** trên điện thoại/máy tính thật (đặc biệt
   header sau sửa H5).
5. **Follow-up (không chặn):** verify chữ ký JWT ở middleware (`@supabase/ssr` hoặc
   gọi Auth API) thay vì chỉ đọc `exp`; xem xét `HttpOnly` cho cookie phiên (hiện
   cookie chứa refresh token và JS đọc được — ngang mức localStorage mặc định của
   supabase-js, không phải hồi quy); lệch `event_registrations` cho phép anon
   INSERT trực tiếp (`0001`, `user_id IS NULL`) trong khi `RLS_POLICIES.md` §6 yêu
   cầu qua Workers — giữ nguyên hay siết, do coordinator quyết (chưa sửa trong
   phần này vì chưa có luồng đăng ký sự kiện trên frontend mới).

---

## 7. Kết quả lệnh (chạy thật)

| Lệnh | Kết quả |
|---|---|
| `npm test` | **PASS — 176/176, 10 file** (lần cuối 15:24). Chạy lại cuối phiên: **181/182** — 1 fail duy nhất là test live của nhóm Auth (reset-password email, do rate-limit 429, xem T-06-01); test phần này vẫn PASS hết. |
| `npm run typecheck` | **PASS — 0 lỗi** |
| `npm run lint` | **PASS — 0 lỗi** |
| `npm run build` | **PASS ở lần chạy lại** — 19 route + middleware. **1 lần FAIL transient:** `Failed to collect page data for /_not-found` ở lần build 15:2x, chạy lại ngay sau đó thì PASS hoàn toàn; nguyên nhân nhiều khả năng là nhiều agent build chung thư mục `.next` cùng lúc (build trước đó cũng từng mất `BUILD_ID` giữa chừng). Không phải lỗi code của phần này (không file nào của phần này chạm tới `/_not-found`). |
| Live server `next start -p 3106` + curl | Xem §4(b)/(d): 307 redirect không session/cookie rác/token hết hạn; 200 trang công khai; forged JWT qua middleware nhưng không rò dữ liệu |
| Anon REST staging | Xem §4(a): private tables `[]`, `courses` 1 dòng seed |
| Signup staging (3 lần) | `example.com` → 400 invalid; anon → 422 disabled; Gmail test → 429 rate-limit (2 lần, cách nhau ~40 phút) |

---

## 8. Checklist tay (đã chạy, đính kèm bằng chứng)

- [x] Anon REST probe 15 bảng staging (mục §4a) — `[]` / 404 `question_options`.
- [x] Signup/signin/token rác qua Auth API staging — 400/403/422/429 như bảng §7.
- [x] `next start` + curl 6 trường hợp middleware (307/200, §4b/d).
- [x] Grep toàn `src/`: không service-role key, không JWT thật, không dữ liệu mock
      trong dashboard.
- [x] Đọc tay 3 policy lỗ trong 0001 + đối chiếu 0006/0007 không sửa chúng.
- [ ] Live 2 tài khoản + áp 0009 lên staging — **CHƯA CHẠY** (blocker §6.1/§6.3).
- [ ] Xem trực quan 390px/1440px trên thiết bị thật — **CHƯA CHẠY** (cần trình duyệt/điện thoại thật).
