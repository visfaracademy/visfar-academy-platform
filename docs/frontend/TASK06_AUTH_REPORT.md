# Báo cáo Task 06 — Phần AUTHENTICATION

**Dự án:** Visfar Academy
**Ngày:** 10/11/2026
**Phạm vi:** Chỉ phần Authentication của Task 06 trong `apps/web` (Next.js 15, Supabase Auth), xây tiếp trên code Task 05, không viết lại.
**Trạng thái chung:** Code + kiểm thử local **đã xong và đạt**. Kiểm thử live có tài khoản thật trên staging **CHƯA CHẠY** — bị chặn bởi rate-limit email của Supabase Auth staging (ghi rõ ở §5, không ghi PASS giả).

> **Bối cảnh cần đọc trước:** Trong cùng phiên làm việc có agent song song làm phần Dashboard/Security của Task 06 (tạo `src/lib/dashboard.ts`, `src/components/dashboard/`, các trang `/hoc-vien/*`, `supabase/migrations/0009_security_fixes.sql`, `src/lib/security.test.ts`, `src/lib/rls-policy.test.ts`, `src/lib/session-guard.test.ts`). Báo cáo này **chỉ ghi phần auth do tôi làm**; các file của agent kia được liệt kê ở §1.3 để khỏi nhầm. File `docs/frontend/TASK06_REPORT.md` (tổng hợp) được viết lúc 22:11 +07, **trước khi code Task 06 hạ cánh** — kết luận "không có code Task 06" trong đó đã lỗi thời, cần tổng hợp lại sau khi các nhóm bàn giao xong.

Tài liệu đã đọc trước khi làm: `docs/frontend/TASK05_REPORT.md`, `docs/DECISIONS.md`, `src/lib/auth.ts`, `src/lib/supabase.ts`, `src/app/dang-nhap/page.tsx`, `src/app/dang-ky/page.tsx`, `src/app/hoc-vien/page.tsx`, `src/components/AccountNav.tsx` (bản Task 05).

---

## 1. File giữ nguyên / sửa / mới (phần auth)

### 1.1. File giữ nguyên

| File | Ghi chú |
|---|---|
| `workspace/user/files/Visfar_Academy.html` | Trang HTML gốc — không sửa |
| `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` | Endpoint Apps Script cũ — không sửa |
| `apps/web/src/components/AccountNav.tsx` | Không cần sửa: đã dùng `signOut()` (tương thích chữ ký mới) + `onAuthStateChange` |
| `apps/web/src/lib/validation.ts` | Dùng chung `validateEmail`/`validateFullName`/`validatePassword` đã có |
| `supabase/migrations/0001–0007` | Không sửa migration cũ nào |

### 1.2. File được sửa (phần auth)

| File | Thay đổi |
|---|---|
| `apps/web/src/lib/supabase.ts` | **Thêm cookie-sync storage** cho Supabase Auth: session vẫn lưu chính ở `localStorage`, đồng thời ghi bản sao vào cookie `sb-<ref>-auth-token` (cùng key, toàn bộ JSON phiên) để middleware đọc được. Chỉ đồng bộ key phiên chính (`*-auth-token`); key phụ như code-verifier PKCE chỉ ở `localStorage`. Ghi cookie lỗi (quá dài…) thì `localStorage` vẫn giữ phiên — middleware khi đó chỉ không thấy cookie và chuyển về đăng nhập. `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true` giữ nguyên từ Task 05 (đã kiểm tra lại — xem §4.5) |
| `apps/web/src/lib/auth.ts` | Thêm: `requestPasswordReset`, `resendSignUpEmail`, `resetPasswordWithSession`, `changePassword` (xác minh mật khẩu hiện tại trước khi đổi), `signOut(scope)` (`local`/`global`/`others`) + `signOutAllDevices()` (`global`), `getSessionState`, `subscribeToAuthChanges`, `exchangeCodeForSession`, `validatePasswordChange`; mở rộng `mapAuthErrorMessage` (link hết hạn, mật khẩu mới trùng cũ); `signUpWithEmail` thêm `emailRedirectTo` về `/auth/callback?next=/hoc-vien`, `options.data` vẫn chỉ có `full_name` — **không gửi role** |
| `apps/web/src/app/dang-nhap/page.tsx` | Thêm param `next` (redirect sau đăng nhập, chỉ đường nội bộ — xem `safeNextPath`), link "Quên mật khẩu?", hộp "Gửi lại email xác nhận" khi lỗi là email chưa xác nhận, thông báo khi bị middleware chuyển về vì phiên hết hạn (`?reason=expired`). Bọc `Suspense` vì dùng `useSearchParams` |
| `apps/web/src/app/dang-ky/page.tsx` | Trạng thái chờ xác nhận email thêm nút "Gửi lại email xác nhận" (gửi / đang gửi / đã gửi / lỗi) |
| `apps/web/src/app/hoc-vien/page.tsx` | Thêm link "Đổi mật khẩu" (`/hoc-vien/doi-mat-khau`), nút "Đăng xuất khỏi tất cả thiết bị" (bấm 2 lần để xác nhận), lắng nghe `SIGNED_OUT` để tải lại khi phiên bị thu hồi từ thiết bị khác. (File này agent dashboard cũng đang sửa song song — thay đổi của tôi chỉ giới hạn ở 3 điểm trên) |
| `apps/web/src/styles/globals.css` | Chỉ **thêm cuối file** class `.auth-links` (dùng token sẵn có). Không sửa rule cũ nào |

### 1.3. File được tạo mới (phần auth)

| File | Vai trò |
|---|---|
| `apps/web/src/lib/session-guard.ts` | Hàm thuần dùng chung middleware + client (để test được): `getAuthCookieName`, `isSafeNextPath`/`safeNextPath` (chặn open-redirect), `decodeJwtExp` (đọc `exp`, **không** verify chữ ký — chỉ để định tuyến), `isTokenExpired` (trừ 30 giây lệch đồng hồ), `parseStoredSessionValue` |
| `apps/web/src/lib/useRequireAuth.ts` | Hook chặn client (lớp 2 sau middleware): kiểm tra phiên, tự refresh khi hết hạn, tự chuyển về đăng nhập khi `SIGNED_OUT` |
| `apps/web/src/middleware.ts` | Route guard `/hoc-vien/*`: không cookie phiên → redirect `/dang-nhap?next=…`; access token hết hạn → thử refresh bằng `refresh_token` qua `POST /auth/v1/token?grant_type=refresh_token`, thành công thì cập nhật cookie và cho qua, thất bại thì về đăng nhập (`?reason=expired`) |
| `apps/web/src/app/auth/callback/page.tsx` | Đích của mọi link email Supabase Auth: đổi `?code=` (PKCE) lấy session, hoặc nhận session từ hash (`detectSessionInUrl`), rồi chuyển về `next` an toàn; link lỗi/hết hạn thì hiện lỗi + link yêu cầu mới |
| `apps/web/src/app/quen-mat-khau/page.tsx` | Quên mật khẩu: nhập email → gửi link đặt lại. Thông báo sau gửi luôn chung chung (không tiết lộ email có tồn tại hay không) |
| `apps/web/src/app/dat-lai-mat-khau/page.tsx` | Đặt lại mật khẩu bằng phiên recovery: chưa có phiên → hướng dẫn mở lại link trong email; có phiên → form mật khẩu mới + nhập lại |
| `apps/web/src/app/hoc-vien/doi-mat-khau/page.tsx` | Đổi mật khẩu khi đã đăng nhập (mật khẩu hiện tại + mới + nhập lại) + mục "Đăng xuất mọi thiết bị" kèm ghi chú giới hạn access token |
| `apps/web/src/app/hoc-vien/layout.tsx` | Layout guard cho `/hoc-vien/*`: `checking` → chờ; `signed-out` → `router.replace('/dang-nhap?next=…')`; `not-configured` → báo cấu hình |
| `apps/web/src/lib/auth-flows.test.ts` | 24 test mới cho các luồng auth mới (mock Supabase client, xem §5.1) |
| `docs/frontend/TASK06_AUTH_REPORT.md` | Báo cáo này |

**Không phải của tôi (agent song song, chỉ liệt kê để khỏi nhầm):** `src/lib/dashboard.ts`, `src/lib/dashboard.test.ts`, `src/components/dashboard/`, các trang `/hoc-vien/ho-so|khoa-hoc|lich-su|thong-bao|chung-chi|don-hang`, `src/lib/security.test.ts`, `src/lib/rls-policy.test.ts`, `src/lib/session-guard.test.ts` (test cho `session-guard.ts` của tôi), `supabase/migrations/0010_dashboard_avatar_storage.sql`, `0008_fix_fk_answers.sql`, `0009_security_fixes.sql`.

---

## 2. Chức năng đã làm

### 2.1. Đăng ký + xác minh email

- Đăng ký qua `supabase.auth.signUp` (họ tên + email + mật khẩu ≥ 8 ký tự). `options.data` chỉ có `full_name`; `emailRedirectTo` về `/auth/callback?next=/hoc-vien`.
- Trạng thái "chờ xác nhận email" giữ nguyên từ Task 05 (không tự cho là đã đăng nhập) + **mới: nút gửi lại email xác nhận** (`auth.resend({ type: 'signup' })`), cả ở trang đăng ký và trang đăng nhập (khi lỗi là email chưa xác nhận).
- Validate client: họ tên 2–100 ký tự, email TLD ≥ 2, mật khẩu 8–128 ký tự, nhập lại phải khớp. Mọi thao tác có loading/error/success state.

### 2.2. Đăng nhập / đăng xuất

- Đăng nhập `signInWithPassword`; thành công → về `next` nếu là đường nội bộ an toàn, mặc định `/hoc-vien`. Lỗi map sang tiếng Việt, không lộ chi tiết kỹ thuật.
- Đăng xuất: `signOut()` mặc định chỉ thiết bị hiện tại (`scope: 'local'`); `signOutAllDevices()` dùng `scope: 'global'` — **Supabase Auth có hỗ trợ đăng xuất mọi thiết bị** (thu hồi refresh token toàn cục). **Ghi rõ giới hạn:** access token đã cấp vẫn dùng được tới khi hết hạn (thường ≤ 1 giờ); không có cách nào thu hồi ngay access token từ phía client. Ghi chú này có trong code, trang đổi mật khẩu và dashboard.
- `AccountNav` giữ nguyên: tự cập nhật theo `onAuthStateChange`.

### 2.3. Quên / đặt lại / đổi mật khẩu

- Quên mật khẩu: `resetPasswordForEmail` với `redirectTo` về `/auth/callback?next=/dat-lai-mat-khau`. Không tiết lộ email có tồn tại hay không (Supabase cũng không tiết lộ; UI luôn báo chung chung).
- Callback `/auth/callback` xử lý cả 2 dạng link Supabase gửi: PKCE (`?code=`) qua `exchangeCodeForSession`, và hash (`#access_token=…`) qua `detectSessionInUrl` + `getSession()`. Link lỗi/hết hạn → báo "Liên kết đã hết hạn hoặc không hợp lệ" + link yêu cầu mới.
- Đặt lại mật khẩu (`/dat-lai-mat-khau`): chỉ cho đặt khi đã có phiên recovery; chưa có phiên → hướng dẫn mở lại link trong email.
- Đổi mật khẩu (`/hoc-vien/doi-mat-khau`, khi đã đăng nhập): `updateUser()` của Supabase không tự kiểm tra mật khẩu cũ, nên `changePassword()` **xác minh lại bằng cách đăng nhập lại với mật khẩu hiện tại trước khi đổi**; mật khẩu mới phải khác cũ và nhập lại phải khớp.

### 2.4. Học viên KHÔNG tự đổi được role

- **Client:** không có API/hàm nào cho phép update `profiles.role` hay ghi `user_roles`. `signUp`/`signIn` không gửi field role; `auth.ts` không có `.update(` hay `.insert(` nào (kiểm tra tĩnh trong `security.test.ts` của agent song song + test mới của tôi). `dashboard.ts` (agent song song) chỉ update `full_name`/`phone`/`province`/`avatar_url`.
- **RLS — phát hiện lỗ và bản sửa (không phải code của tôi, nhưng là điều kiện để yêu cầu "bị RLS từ chối" đạt):** policy `profiles_update_own` ở migration 0001 **không có `WITH CHECK` về cột nào** nên học viên gọi trực tiếp qua REST `update profiles set role='admin' where id = <uid>` **sẽ thành công** (điều kiện `id = auth.uid()` vẫn đúng khi dòng mới có `role='admin'`); `current_role()` lại đọc `profiles.role` nên sau đó mọi policy "chỉ admin" đều mở. Agent security đã viết bản sửa ở **`supabase/migrations/0009_security_fixes.sql`** (trigger `trg_profiles_block_role_change` + `REVOKE UPDATE (role) … FROM authenticated` + `profiles_insert_own` mới chỉ cho `role='student'`, kèm test tĩnh `rls-policy.test.ts`). **Migration này CHƯA được áp lên staging** (cần `SUPABASE_ACCESS_TOKEN`, xem §5.2) nên yêu cầu "thử gọi update role phải bị RLS từ chối" **hiện chưa đạt trên staging** — chỉ mới đạt ở mức code + test tĩnh. Xem thêm §5.2 (C-06-AUTH-04).

### 2.5. Quản lý phiên

- `persistSession: true` — **đã kiểm tra lại** trong `src/lib/supabase.ts`: bật từ Task 05, giữ nguyên; `autoRefreshToken: true`, `detectSessionInUrl: true`.
- **Hết hạn session:** `getSession()` tự refresh access token khi hết hạn mà refresh token còn hạn; `getSessionState()` trả `active`/`signed-out`/`not-configured` (không bao giờ success giả). Middleware thử refresh qua Auth API khi access token hết hạn (xem §2.6). `useRequireAuth` + dashboard lắng nghe `SIGNED_OUT`/`TOKEN_REFRESHED` để tự chuyển về đăng nhập khi phiên bị thu hồi.
- **Refresh token:** dùng `autoRefreshToken` của supabase-js ở client; ở middleware dùng trực tiếp `grant_type=refresh_token` khi cần. Refresh thất bại → về `/dang-nhap?reason=expired` + thông báo "Phiên đăng nhập của bạn đã hết hạn."
- **Cookie-sync storage:** xem §1.2 (`supabase.ts`). Cookie không phải httpOnly (client cần đọc/ghi qua storage adapter — cùng mức rủi ro XSS như `localStorage` chứa token); `SameSite=Lax`, `Secure` khi HTTPS, `Max-Age` 7 ngày, xóa khi đăng xuất.

### 2.6. Middleware / route guard

- `src/middleware.ts`, matcher `/hoc-vien/:path*`: chưa đăng nhập (không có cookie phiên hợp lệ) → `307` về `/dang-nhap?next=<đường gốc>`. Đã kiểm chứng thật trên server local sau build (xem T-06-AUTH-05).
- Lớp 2: `src/app/hoc-vien/layout.tsx` (`useRequireAuth`) chặn ở client cho điều hướng trong SPA.
- **Ghi rõ giới hạn:** middleware chỉ đọc claim `exp` của JWT mà **không verify chữ ký** — đây là lớp định tuyến, không phải lớp ủy quyền. Bảo mật thật vẫn do Supabase Auth + RLS đảm nhiệm ở mỗi query; token giả sẽ bị Supabase từ chối khi gọi API. Verify thật ở server cần `@supabase/ssr` hoặc gọi Auth API — chưa có trong task này (không thêm dependency mới).

### 2.7. Phong cách / responsive

- Không đổi màu/font/ảnh: chỉ dùng token sẵn có (`--bg-ivory`, `--bg-champagne`, `--gold*`, Be Vietnam Pro); class mới duy nhất là `.auth-links`. Body giữ ≥ 16px (`html { font-size: 16px }`), nút `min-height: 44px` (`.btn` 48px, link `.auth-links` 44px), không tràn ngang (form trong `.auth-card` max-width 560px). Không sửa trang HTML gốc ngoài repo.

---

## 3. Phát hiện trong Task 06 (phần auth)

1. **Staging ĐÃ được migrate (đính chính báo cáo tổng hợp):** `TASK06_REPORT.md` §5.2 viết "staging vẫn 0 bảng" theo Task 05, nhưng kiểm tra REST trực tiếp ngày 10/11/2026 cho thấy `profiles`, `user_roles`, `courses`, `enrollments` đều trả về (không còn `PGRST205`); `courses` đã có 1 dòng seed (`id 11111111-0001-…`). Tức migration đã chạy lên staging sau Task 05 — điều kiện tiên quyết cho kiểm thử live đã đủ, chỉ còn vướng rate-limit email (§5.2).
2. **Lỗ leo role H1 (xác nhận lại độc lập):** `profiles_update_own` (0001) không chặn tự đổi `role` — xem §2.4. Bản sửa nằm ở `0009_security_fixes.sql` (agent security), **chưa áp dụng**.
3. **Trùng số hiệu migration (còn tồn tại):** có 2 file cùng số `0008` — `0010_dashboard_avatar_storage.sql` và `0008_fix_fk_answers.sql` (file security đã được đổi thành `0009_security_fixes.sql` để tránh trùng 3 file, nhưng vẫn còn 2 file `0008`). Supabase CLI sẽ lỗi với version trùng — cần coordinator đổi số một file (vd. `0010`) trước khi chạy migration. Tôi không tự đổi vì đó là file của agent khác.
4. **`.env.local` hiện trỏ sang staging:** agent song song đã sao lưu `.env.local` gốc thành `.env.local.bak.task06` và đổi `.env.local` sang URL staging để test live. Build local hiện tại vì vậy bake URL staging. Coordinator cần quyết định file `.env.local` nào là chuẩn trước khi deploy prod.
5. **Build lần đầu lỗi do 2 agent build cùng lúc:** `next build` của tôi và của agent song song cùng ghi `.next/` → lỗi `ENOENT …/_not-found/page.js.nft.json` ở bước "Collecting build traces". Build lại sạch (sau khi agent kia build xong) thì **PASS**. Đây là va chạm vận hành khi làm song song, không phải lỗi code.

---

## 4. Phương án rollback (phần auth)

| # | Tình huống | Cách rollback | Ảnh hưởng |
|---|---|---|---|
| R-AUTH-01 | Middleware chặn sai / lỗi redirect | Xóa `src/middleware.ts` (hoặc thu hẹp matcher). Layout guard + trang dashboard vẫn hiện trạng thái signed-out như Task 05 | `/hoc-vien` quay lại hành vi Task 05 (hiện link đăng nhập, không redirect server-side) |
| R-AUTH-02 | Cookie-sync storage gây lỗi phiên | Revert `createCookieSyncStorage` trong `supabase.ts` về storage mặc định của supabase-js (chỉ `localStorage`). Middleware khi đó không thấy cookie → luôn redirect `/hoc-vien` về đăng nhập, nên phải rollback R-AUTH-01 cùng lúc | Phiên chỉ còn ở `localStorage` như Task 05; middleware mất tác dụng |
| R-AUTH-03 | Trang quên/đặt/đổi mật khẩu lỗi | Gỡ link tới 3 trang mới khỏi đăng nhập/dashboard (hoặc revert 3 file trang). Không có migration auth nào chạy trong phần này nên không cần rollback DB | Người dùng quay lại chỉ đăng nhập/đăng ký như Task 05 |
| R-AUTH-04 | Auth lỗi diện rộng | Revert toàn bộ file §1.2–§1.3 về cuối Task 05. Không có dòng DB/Sheet nào do phần auth tạo ra (đăng ký live không thành công — xem §5.2) nên không cần dọn dữ liệu | Như Task 05 |

---

## 5. Kết quả kiểm thử

### 5.1. Đã chạy thật ở local — PASS

| # | Kiểm thử | Lệnh / cách chạy | Kết quả |
|---|---|---|---|
| T-06-AUTH-01 | Unit test | `npm test` (vitest 2.1.9) trong `apps/web` | **PASS — 176/176 test, 11 file.** Trước phiên này: 152 test (sau khi agent song song thêm dashboard/security test). Mới trong phần auth: `auth-flows.test.ts` 24 test (quên/đặt/đổi mật khẩu, resend xác minh, sign-out `local`/`global`, session state, đổi code PKCE, subscribe auth changes, validate đổi mật khẩu, map lỗi link hết hạn/mật khẩu trùng). `session-guard.test.ts` 12 test do agent song song viết cho helper của tôi — PASS |
| T-06-AUTH-02 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | **PASS — 0 lỗi** (đã sửa 1 lỗi type trong test mới của tôi trước khi đạt) |
| T-06-AUTH-03 | Lint | `npm run lint` (`eslint .`) | **PASS — 0 lỗi** |
| T-06-AUTH-04 | Build | `npm run build` (Next.js 15.4.11, build sạch sau khi build song song lỗi — xem §3.5) | **PASS** — compiled successfully; đủ 19 route, gồm 4 route auth mới `/auth/callback`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/hoc-vien/doi-mat-khau`; `ƒ Middleware 34.3 kB` |
| T-06-AUTH-05 | Smoke test server local + middleware guard | `next start -p 3106`, curl từng trang | **PASS** — `/hoc-vien` → **307** `Location: /dang-nhap?next=%2Fhoc-vien`; `/hoc-vien/doi-mat-khau` → **307** `?next=%2Fhoc-vien%2Fdoi-mat-khau`; `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/auth/callback`, `/` đều **200**. Lưu ý: HTML tĩnh của `/dang-nhap` chỉ chứa fallback `Suspense` ("Đang tải…") vì trang dùng `useSearchParams` — form render sau hydration; chưa kiểm bằng trình duyệt thật (xem C-06-AUTH-05) |
| T-06-AUTH-06 | Không secret ở frontend | `grep service_role / SUPABASE_SERVICE_ROLE_KEY / eyJ` trong `apps/web/src/` | **PASS** — 0 match ngoài comment cảnh báo (đã có từ Task 05). Test tĩnh `security.test.ts` cũng kiểm tra điều này |
| T-06-AUTH-07 | Không có đường client đổi role | Test tĩnh `security.test.ts` (c) + `auth-flows.test.ts` (signUp chỉ gửi `full_name`, không role) + grep `.from('profiles').update(` / `.from('user_roles')` trong `src/` | **PASS** — không có đường nào. Lưu ý: đây là lớp client; lớp RLS vẫn hở cho tới khi áp `0009` (xem §2.4) |
| T-06-AUTH-08 | File gốc không đổi | Chỉ đọc, không ghi `Visfar_Academy.html` / `Code-hop-nhat-2-trang.gs` | **PASS** — không chạm vào 2 file gốc |

### 5.2. CHƯA CHẠY / CHƯA ĐẠT — live staging (không ghi PASS giả)

Kiểm tra REST trước khi test live (đúng quy tắc task): staging **đã có bảng** (xem §3.1) nên đã thử test live bằng file tạm `src/lib/__live-task06.test.ts` (vitest + Supabase client thật, env `.env.staging`, tài khoản test `visfaracademy+task06nov10@gmail.com`). File tạm này **đã xóa sau khi chạy** để không lọt vào bộ test thường.

| # | Kiểm thử live | Kết quả thật | Vì sao / điều kiện để chạy |
|---|---|---|---|
| C-06-AUTH-01 | Đăng ký thật trên staging | **CHƯA CHẠY — bị chặn.** `signUpWithEmail` trả lỗi `Too many requests` → map thành "Bạn đã thử quá nhiều lần. Vui lòng chờ vài phút rồi thử lại." Thử 2 lần (15:25 và 15:26 UTC) đều cùng lỗi. Đây là **rate-limit gửi email của Supabase Auth staging** (cùng blocker agent security đã ghi trong `security.test.ts`: "staging Auth bị 'email rate limit exceeded'") | Chờ cửa sổ rate-limit reset (thường theo giờ) rồi thử lại với cùng file tạm; hoặc user cung cấp SMTP riêng / tăng hạn mức gửi mail cho project staging |
| C-06-AUTH-02 | Đăng nhập / dashboard / đổi mật khẩu / đăng xuất mọi thiết bị thật | **CHƯA CHẠY** — hệ quả của C-06-AUTH-01: không tạo được tài khoản test nên không có session để chạy các bước này | Sau khi C-06-AUTH-01 đạt: chạy lại file tạm (đã xóa — cần viết lại từ mô tả ở đây) theo đúng thứ tự đăng ký → hồ sơ → đổi mật khẩu → đăng xuất global |
| C-06-AUTH-03 | Quên mật khẩu thật (email đặt lại tới hộp thư) | **CHƯA XÁC NHẬN ĐƯỢC.** `requestPasswordReset` trả `ok` trên staging — nhưng Supabase luôn trả `ok` cả khi email không tồn tại (chống dò email), và địa chỉ test trên chưa có tài khoản nào, nên `ok` này **chỉ chứng minh API nhận request, không chứng minh email đã gửi hay link dùng được** | Sau khi C-06-AUTH-01 đạt: yêu cầu reset cho tài khoản test thật → mở email trong Gmail `visfaracademy@gmail.com` (plus-address) → bấm link → đặt mật khẩu mới → đăng nhập |
| C-06-AUTH-04 | Thử gọi update `profiles.role` phải bị RLS từ chối | **CHƯA CHẠY (live) — và hiện tại sẽ KHÔNG bị từ chối.** Cần session (vướng C-06-AUTH-01) và cần `0009_security_fixes.sql` được áp lên staging (chưa áp — cần `SUPABASE_ACCESS_TOKEN`). Phân tích tĩnh + test tĩnh (`rls-policy.test.ts` H1) đã chứng minh lỗ tồn tại ở policy hiện tại | Cấp lại access token → chạy migration 0001→0009 lên staging (chú ý trùng số `0008` ở §3.3) → đăng nhập tài khoản test → gọi `update profiles set role='admin'` → kỳ vọng lỗi 403/trigger exception → xác nhận `role` vẫn `student` |
| C-06-AUTH-05 | Form auth render + hoàn tất trên trình duyệt thật (đăng ký → xác minh email → đăng nhập → đổi mật khẩu) | **CHƯA CHẠY** — subagent không dùng được trình duyệt live; chỉ kiểm tới mức HTTP 200 + middleware 307 ở T-06-AUTH-05 | Parent agent / user mở trang local hoặc staging đã deploy trên trình duyệt thật và đi hết luồng |
| C-06-AUTH-06 | Middleware + refresh token thật trên domain deploy | **CHƯA CHẠY** — frontend chưa deploy lên staging/prod; chỉ kiểm trên `next start` local | Deploy apps/web lên staging → truy cập `/hoc-vien` khi signed-out (kiểm 307) → đăng nhập → chờ token hết hạn → truy cập lại (kiểm refresh tự động, không bị văng về đăng nhập) |
| C-06-AUTH-07 | Xác minh email end-to-end (bấm link trong email thật) | **CHƯA CHẠY** — hệ quả của C-06-AUTH-01 (không có email xác minh nào được gửi; kiểm Gmail ngày 10/11/2026 không thấy mail Supabase nào) | Sau khi C-06-AUTH-01 đạt: mở mail xác minh trong Gmail → bấm link → về `/auth/callback` → vào `/hoc-vien` |

**Không bịa token:** Báo cáo này không tạo, không đoán, không ghi bất kỳ access token / secret / mật khẩu test nào. Tài khoản test `visfaracademy+task06nov10@gmail.com` **không được tạo thành công** (rate-limit) nên không có tài khoản test nào cần dọn trên staging.

---

## 6. Việc cần coordinator / user quyết sau phần auth

1. **Chờ rate-limit email staging reset rồi chạy lại kiểm thử live C-06-AUTH-01 → C-06-AUTH-04** (hoặc cấp SMTP riêng/tăng hạn mức cho project staging). Đây là blocker duy nhất còn lại cho luồng auth thật.
2. **Cấp lại `SUPABASE_ACCESS_TOKEN` để chạy migration 0001→0009 lên staging** (kế thừa từ Task 05), sau khi xử lý trùng số `0008` ở §3.3 — nếu không, lỗ leo role H1 vẫn mở trên staging dù code client đã sạch.
3. **Quyết `.env.local` chuẩn** (staging hay prod) sau khi agent song song đổi nó sang staging (§3.4).
4. **Tổng hợp lại `TASK06_REPORT.md`** — báo cáo tổng hợp hiện tại viết trước khi code Task 06 hạ cánh, nhiều kết luận đã lỗi thời (không có middleware, staging 0 bảng, không có trang quên mật khẩu… đều đã sai).
5. Deploy frontend lên staging để chạy C-06-AUTH-05/C-06-AUTH-06 trên trình duyệt thật.
