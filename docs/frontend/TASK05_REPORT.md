# Báo cáo Task 05 — Preserve and Upgrade Existing Frontend

**Dự án:** Visfar Academy
**Ngày:** 10/11/2026
**Phạm vi:** Frontend Next.js `apps/web` — giữ nguyên thương hiệu, bố cục, nội dung hiện tại; thêm lớp service/API, tích hợp form tư vấn qua API mới (API làm lớp trước, rồi ghi Sheet), navigation tài khoản + trang đăng nhập/đăng ký/dashboard, loading/error/success states cho mọi thao tác.
**Trạng thái chung:** Code + kiểm thử local **đã xong và đạt**. Kiểm thử cần staging/prod thật **CHƯA CHẠY** (ghi rõ ở §5, không ghi PASS cho thứ chưa chạy).

Tài liệu đã đọc trước khi làm: `docs/architecture/` (Task 02, 7 file), schema Task 03 (`docs/database/`), `docs/DECISIONS.md` (19 QĐ + phê duyệt Task 02/03), `docs/supabase/BACKEND_TEST_REPORT.md` (Task 04), `workspace/visfar-academy/Code-hop-nhat-2-trang.gs`, form trong `workspace/user/files/Visfar_Academy.html`.

---

## 1. Luồng Google Apps Script hiện tại — đã kiểm tra TRƯỚC khi chuyển đổi

**File `.gs`:** `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` (không sửa).

- `doPost` nhận JSON hoặc form-encoded, định tuyến theo `source`: `visfar-academy` → tab `DATA VISFAR ACADEMY`, 6 cột (Thời gian, Họ và Tên, Số điện thoại, Email, Tỉnh / Thành phố, Khóa học quan tâm); `nang-tam` (mặc định khi thiếu `source`) → tab `DATA TÂM THỨC & NHÂN HIỆU`, 5 cột + biên lai Drive.
- Validate: họ tên, SĐT `^0\d{9}$`, email, `course` bắt buộc. `LockService` chống ghi trùng. Không có honeypot, Turnstile, Idempotency-Key, mã tham chiếu.
- `doGet` trả `{ ok: true, routes: [...] }`.

**Form cũ trong `workspace/user/files/Visfar_Academy.html` (KHÔNG sửa file gốc):**

- Form `#consultForm`, 5 ô: `fullName`, `phone`, `email`, `province` (select 34 tỉnh/thành), `course` (select 10 khóa + doanh nghiệp + "Chưa biết bắt đầu từ đâu"), kèm `source=visfar-academy` ẩn.
- Gửi `URLSearchParams` tới `WEB_APP_URL` (Apps Script `/exec`), timeout 30 giây. JSON `{ok:true}` → màn hình cảm ơn; JSON `{error}` → lỗi; còn lại (không đọc được JSON / mất mạng) → gửi lại bằng iframe ẩn rồi hiện "thành công dự phòng" (`showFallbackOk`) — tức **thành công giả** khi không đọc được xác nhận.
- Lệch validation: email client dùng regex TLD ≥ 1 ký tự, server yêu cầu TLD ≥ 2 (theo kiến trúc §6) — form mới dùng chung `validation.ts` (TLD ≥ 2) cho cả hai bên.
- Form cũ có hộp xác nhận PII (nút `mailto:` + sao chép chứa họ tên/SĐT/email) và nhánh fallback "thành công giả" — cả hai **chỉ giữ trên trang HTML cũ** theo QĐ 8 và QĐ 3; frontend mới không kế thừa (xem §4).

**File gốc không thay đổi:** `Visfar_Academy.html` và `Code-hop-nhat-2-trang.gs` chỉ được đọc, không được ghi (mtime giữ nguyên ngày 10/11/2026 11:50 và 04/11/2026). Không copy file HTML 5,7 MB vào repo — form được dựng lại bằng React từ đúng đặc tả trên.

---

## 2. File giữ nguyên

| File | Ghi chú |
|---|---|
| `workspace/user/files/Visfar_Academy.html` | Trang hiện tại — không sửa, vẫn chạy độc lập như trước |
| `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` | Endpoint Apps Script cũ — không sửa, giữ làm fallback |
| `apps/web/src/lib/validation.ts`, `validation.test.ts` | Logic validation dùng chung (đã có) |
| `apps/web/src/lib/courses.ts`, `courses.test.ts` | Đọc khóa `published` từ Supabase (đã có) |
| `apps/web/src/app/chuong-trinh/`, `src/components/course/CourseCard.tsx` | Trang khóa học (đã có) |
| `workers/api/` | Giữ chỗ Module 2+ — Workers API chưa deploy, chưa có code |
| `supabase/migrations/*`, `docs/DECISIONS.md`, `docs/architecture/`, `docs/database/`, `docs/supabase/` | Không sửa trong Task 05 |
| `apps/web/.env.local`, `apps/web/.env.staging` | Chỉ chứa URL + anon key, bị `.gitignore` chặn, không commit, không ghi giá trị vào báo cáo này |

Không đổi màu sắc, font, hình ảnh, nội dung đã có. Toàn bộ style mới chỉ dùng token sẵn có (`--bg-ivory`, `--bg-champagne`, `--gold*`, font `Be Vietnam Pro`).

> Ghi chú: `git status` còn hiện `.gitignore`, `supabase/config.toml`, `supabase/migrations/0001_init_schema.sql` bị sửa — đó là thay đổi **có sẵn từ phần (A)/coordinator**, không phải của Task 05.

## 3. File được sửa

| File | Thay đổi |
|---|---|
| `apps/web/src/lib/supabase.ts` | Bật `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true` (trước đây `persistSession: false` nên không giữ được phiên đăng nhập). Vẫn chỉ dùng anon key. Thêm alias `getSupabaseBrowserClient()`. Đọc công khai không đổi |
| `apps/web/src/app/api/health/route.ts` | **Sửa lỗi báo `ok` giả (phát hiện trong Task 05, xem §5.3):** bỏ `{ head: true }`, chuyển sang `select('id').limit(1)` thật. Route cũ trả `200 ok:true` trên project 0 bảng |
| `apps/web/src/components/layout/Header.tsx` | Thêm link `/tu-van`, gắn `AccountNav`, nút CTA chính đổi đích sang `/tu-van` ("Nhận lộ trình phù hợp") |
| `apps/web/src/components/layout/Footer.tsx` | Thêm `NewsletterForm` (form + handler thật, QĐ 6). Thông tin liên hệ, copyright giữ nguyên |
| `apps/web/src/app/page.tsx` | Thêm nút "Đăng ký tư vấn" (`/tu-van`) cạnh nút "Xem 10 chương trình". Nội dung còn lại giữ nguyên |
| `apps/web/src/styles/globals.css` | Chỉ **thêm cuối file** class form/auth/newsletter (`.field`, `.form-err`, `.notice.success`, `.auth-card`, `.account-nav`, `.newsletter-form`, `.honeypot`, …), dùng đúng token màu/font sẵn có. Không sửa rule cũ nào |
| `apps/web/.env.example` | Thêm `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_LEGACY_APPS_SCRIPT_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (comment, chưa có key). Không chứa secret thật |
| `apps/web/eslint.config.mjs` | Thêm `.vercel/` vào `ignores` (thư mục build artifact có sẵn làm `npm run lint` lỗi 14.163 lỗi — xem §5.4). Không đổi rule |

## 4. File được tạo mới

| File | Vai trò |
|---|---|
| `apps/web/src/lib/api-client.ts` | Lớp API: `getApiBaseUrl()` (mặc định `https://visfaracademy.netlify.app/api/v1` theo QĐ 8 Task 02), `newIdempotencyKey()` (UUID), `postJson()` (timeout 30 giây, `ApiError` có `code`/`isOffline`/`retryAfterSec`), chỉ resolve khi body có `ok:true` |
| `apps/web/src/lib/leads.ts` | Dịch vụ form tư vấn: `validateLeadInput()` (cùng bộ quy tắc server §6), `submitLead()` (API trước → fallback Apps Script sau, xem §4), `recordFallbackAttempt()`/`getFallbackLog()` (log fallback vào `localStorage`, tối đa 50 mục) |
| `apps/web/src/lib/newsletter.ts` | `submitNewsletter()` — POST `/api/v1/newsletter`, chỉ success khi `ok:true`, không có fallback (không có endpoint cũ) |
| `apps/web/src/lib/auth.ts` | Supabase Auth trực tiếp: `signUpWithEmail`, `signInWithEmail`, `signOut`, `getMyProfileState`, `getMyEnrollments`, `validatePassword` (≥ 8 ký tự), `mapAuthErrorMessage` (lỗi → tiếng Việt, không lộ chi tiết kỹ thuật). Không tự gán role — role mặc định `student` do trigger DB |
| `apps/web/src/components/ConsultationForm.tsx` | Form tư vấn React (5 ô như form cũ + honeypot). Sinh `Idempotency-Key` 1 lần/lần gửi, dùng lại khi retry; disable nút khi đang gửi; chỉ hiện cảm ơn khi `ok:true` |
| `apps/web/src/components/AccountNav.tsx` | Nav tài khoản trong header: loading / chưa đăng nhập (Đăng nhập / Đăng ký) / đã đăng nhập (tên + Dashboard + Đăng xuất) |
| `apps/web/src/components/NewsletterForm.tsx` | Form newsletter ở footer, đủ trạng thái idle / submitting / success / error + "Thử lại" |
| `apps/web/src/app/tu-van/page.tsx` | Trang form tư vấn (tiêu đề + văn bản liên hệ giữ nguyên từ section `#tu-van` gốc) |
| `apps/web/src/app/dang-nhap/page.tsx` | Trang đăng nhập, success → `/hoc-vien` |
| `apps/web/src/app/dang-ky/page.tsx` | Trang đăng ký; xử lý riêng trạng thái "chờ xác nhận email" (không tự cho là đã đăng nhập) |
| `apps/web/src/app/hoc-vien/page.tsx` | Dashboard học viên (sitemap QĐ 11: `/hoc-vien/*`): hồ sơ (`profiles`) + khóa đã ghi danh (`enrollments` join `courses`), đủ trạng thái loading / signed-out / success / empty / error / not-configured |
| `apps/web/src/lib/api-client.test.ts` | 12 test (base URL, key, timeout, offline, mã lỗi, không `ok` giả) |
| `apps/web/src/lib/leads.test.ts` | 18 test (validation, chống trùng, mất mạng, fallback) |
| `apps/web/src/lib/auth.test.ts` | 9 test (mật khẩu, map lỗi auth) |
| `apps/web/src/lib/newsletter.test.ts` | 4 test (success, email sai, 500, offline) |
| `docs/frontend/TASK05_REPORT.md` | Báo cáo này |

---

## 5. Những thay đổi về chức năng

### 5.1. Supabase client

- Vẫn chỉ dùng **publishable (anon) key** ở frontend. Không có service-role key, không có JWT thật trong `src/` (đã grep kiểm tra).
- `.env.local` (prod) và `.env.staging` (staging) đã có sẵn từ Task 04, chỉ chứa URL + anon key.

### 5.2. Luồng form tư vấn mới — API làm lớp trước, rồi ghi Sheet (QĐ 5)

```
Form -> validate client (ten / SĐT ^0\d{9}$ / email TLD>=2 / 34 tinh / khoa)
  -> POST {API_BASE}/api/v1/leads + Idempotency-Key + honeypot (+ Turnstile token khi co)
  -> API ghi DB (nguon su that) -> ghi Sheet (ban sao) -> tra ok:true + referenceCode
  -> CHI KHI NHAN ok:true moi hien cam on (QĐ 2, phe duyet Task 02)
```

- **Chống trùng:** `Idempotency-Key` UUID sinh 1 lần cho mỗi lần gửi, **dùng lại đúng key khi bấm "Thử lại"**; key mới chỉ sinh khi bấm "Đăng ký thêm một yêu cầu khác". Server dedup trong 24 giờ (theo QĐ 13 Task 03). Nút submit bị disable khi đang gửi.
- **Chống spam (QĐ 4):** (a) honeypot field `website` (ẩn hoàn toàn với người thật, bot điền vào → chặn ngay ở client, không gọi API) + rate-limit + idempotency ở server; (b) Turnstile: **chưa tích hợp widget** vì chưa có site key — form gửi không kèm token; server khi có sẽ áp rate-limit chặt hơn + ghi log thay vì chặn cứng người thật (QĐ 13 Task 03). Cần user cung cấp `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + triển khai verify ở Workers (Module 2).
- **Fallback Apps Script cũ — giữ nguyên, có ghi log, không hiện thành công giả:**
  - Chỉ chạy khi API lỗi mạng / timeout / 5xx. **Không chạy** khi API trả 400 / 409 / 429 (từ chối dứt khoát — fallback sẽ lẩn tránh validation và rate-limit của API).
  - Chỉ coi là thành công khi **đọc được JSON `{ ok: true }`** từ Apps Script. Nếu không đọc được xác nhận (mất mạng, redirect, JSON hỏng) → trả lỗi + nút "Thử lại" (cùng key), **không hiện cảm ơn**. Mọi lần chạy fallback đều ghi log (`console.warn` + `localStorage: visfar_fallback_log`) để đối soát tab DATA + DB sau.
  - Vì Apps Script không trả mã tham chiếu, lần gửi thành công qua fallback hiện mã tạm `FALLBACK-XXXXXXXX` và ghi rõ trong UI: "ghi nhận qua kênh dự phòng (Google Sheet)…, mã trên là mã theo dõi tạm, không phải mã tham chiếu chính thức".
  - **Khác biệt có chủ ý với trang cũ:** trang HTML cũ giữ nhánh iframe fallback hiện "thành công giả" theo QĐ 3; frontend mới tuân thủ QĐ 2 (phê duyệt Task 02: "API mới không hiện cảm ơn khi chưa nhận `ok:true`"). Hai quyết định này mâu thuẫn nhau theo đúng ghi nhận trong tài liệu kiến trúc §9.4 — Task 05 áp dụng QĐ 2 cho frontend mới, không tự ý đổi trang cũ.
- **Bỏ hộp xác nhận PII ở form mới** (không còn nút `mailto:`/sao chép chứa họ tên/SĐT/email) theo QĐ 13 Task 03. Hộp này vẫn còn trên trang HTML cũ theo QĐ 8.
- **Trạng thái:** idle / submitting ("Đang gửi… Vui lòng chờ, đừng bấm gửi lại.") / success (kèm mã tham chiếu, ghi rõ nếu là trùng lặp hoặc qua fallback) / error (kèm nút "Thử lại" khi `canRetry`, ghi rõ đã thử fallback nhưng chưa có xác nhận).
- **Tình trạng hiện tại:** Workers API **chưa deploy** nên mọi lần gửi hiện nay đều rơi vào nhánh lỗi API → fallback Apps Script. Form vẫn hoạt động qua fallback có xác nhận JSON, nhưng chưa có mã tham chiếu API thật. Khi Workers deploy xong, form tự chuyển sang đường API mà không cần sửa code (chỉ cần domain API sống).

### 5.3. Phát hiện trong Task 05 — route `/api/health` cũ báo `ok` giả

Kiểm chứng thật ngày 10/11/2026 (sau build, chạy `next start` local):

- Route cũ dùng `.select('id', { count: 'exact', head: true })` trả **`200 {"ok":true}` trên cả prod lẫn staging dù cả hai project đều có 0 bảng**.
- Kiểm chứng độc lập: query REST trực tiếp tới cả hai project đều trả `404 PGRST205 "Could not find the table 'public.courses' in the schema cache"`; query supabase-js **không** `head` cũng trả lỗi `PGRST205`; chỉ riêng biến thể `head: true` trả `error: null, data: null` — tức PostgREST nuốt lỗi bảng không tồn tại ở chế độ head.
- **Đã sửa** route health sang `select('id').limit(1)` thật + coi `data === null` là lỗi. Sau sửa, cùng project prod 0 bảng trả đúng **`503 {"ok":false,"status":"supabase_error","message":"Could not find the table 'public.courses' in the schema cache"}`**.
- Hệ quả: tiêu chí DB-01/C-01 của Task 04 ("chỉ trả `ok:true` khi query thật thành công") **không được route cũ bảo đảm** — mọi kết luận PASS nào dựa trên route cũ đều phải kiểm tra lại. C-01 vẫn là **CHƯA CHẠY** (xem §6).

### 5.4. Tài khoản — đăng nhập / đăng ký / dashboard

- Đăng ký/đăng nhập qua **Supabase Auth** (email + mật khẩu ≥ 8 ký tự), session lưu ở browser. Profile tạo bởi trigger `handle_new_user()`; role mặc định `student`, client không tự gán role.
- Header: chưa đăng nhập → "Đăng nhập / Đăng ký"; đã đăng nhập → "Xin chào, {tên} / Dashboard / Đăng xuất" (cập nhật theo `onAuthStateChange`).
- Dashboard `/hoc-vien`: đọc thật `profiles` + `enrollments` của chính user bằng JWT (RLS chỉ cho thấy của mình). Chưa đăng nhập → link tới đăng nhập; chưa ghi danh khóa nào → empty state + link xem khóa học. Không có dữ liệu mẫu, không giả lập tiến độ.
- Newsletter footer: form + handler thật POST `/api/v1/newsletter` (QĐ 6), chỉ success khi `ok:true`; lỗi có nút "Thử lại".

### 5.5. Những gì KHÔNG làm trong Task 05

- Không sửa file HTML gốc, không sửa file `.gs`, không deploy lại Apps Script.
- Không viết lại toàn bộ HTML, không đổi màu/font/ảnh/nội dung.
- Không tạo Workers API (thuộc Module 2+), không chạy migration, không tạo tài khoản test thật, không gửi đăng ký thật nào (không tạo dòng nào trong Sheet/DB).
- Không tích hợp Turnstile widget (chưa có site key), không làm trang admin, không làm ghi danh khóa / quiz / tiến độ (thuộc module sau).

---

## 6. Kết quả kiểm thử

### 6.1. Đã chạy thật ở local — PASS

| # | Kiểm thử | Lệnh / cách chạy | Kết quả |
|---|---|---|---|
| T-05-01 | Unit test | `npm test` (vitest 2.1.9) trong `apps/web` | **PASS — 80/80 test, 6 file** (validation 30 + courses 7 đã có từ trước; api-client 12 + leads 18 + auth 9 + newsletter 4 mới). Trước Task 05: 37 test; sau: 80 test |
| T-05-02 | Chống trùng | `leads.test.ts`: gửi 2 lần cùng `Idempotency-Key` → lần 2 trả `duplicate:true`, cùng `referenceCode`; retry dùng lại key cũ; key mới sinh header khác | **PASS** (mock server dedup — dedup thật ở server chỉ xác nhận được khi API deploy + staging migrate, xem §6.2) |
| T-05-03 | Mất mạng (offline) | Mock fetch reject `TypeError('Failed to fetch')` cho cả API lẫn fallback → kết quả `error`, `isOffline:true`, `canRetry:true`, **không** success; retry dùng lại key | **PASS** — 2 test (API + fallback cùng mất mạng; API mất mạng + fallback không đọc được xác nhận) |
| T-05-04 | Validation | SĐT 9 số / +84 / không bắt đầu bằng 0; email TLD 1 ký tự (`a@b.c`); tỉnh ngoài 34 tỉnh (`Bình Dương`); thiếu tên/khóa; honeypot có giá trị → chặn, không gọi API | **PASS** |
| T-05-05 | Fallback đúng luật | API 500 → fallback JSON `ok:true` → success `via: fallback-apps-script`, mã `FALLBACK-*`, `fallbackLogged:true`; API 400/429 → **không** fallback (fetch chỉ gọi 1 lần); API `ok:true` nhưng thiếu `referenceCode` → error | **PASS** |
| T-05-06 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 lỗi |
| T-05-07 | Lint | `npm run lint` (`eslint .`) | **PASS** — 0 lỗi (sau khi thêm `.vercel/` vào ignores; trước đó 14.163 lỗi đều nằm trong thư mục build artifact `.vercel/output/` có sẵn, không phải code nguồn; `src/` chỉ có 4 lỗi, đã sửa hết) |
| T-05-08 | Build | `npm run build` (Next.js 15.4.11) | **PASS** — compiled successfully; đủ 9 route: `/`, `/chuong-trinh`, `/chuong-trinh/[slug]`, `/tu-van`, `/dang-nhap`, `/dang-ky`, `/hoc-vien`, `/api/health`, `/_not-found` |
| T-05-09 | Smoke test server local | `next start -p 3105`, curl từng trang | **PASS** — `/`, `/tu-van`, `/dang-nhap`, `/dang-ky`, `/hoc-vien`, `/chuong-trinh` đều HTTP 200; HTML `/tu-van` chứa đủ field `cf-name`, `cf-phone`, `cf-email`, `cf-province`, `cf-course`, `cf-website` (honeypot) |
| T-05-10 | Health check sau sửa | `curl /api/health` trên server local (prod, 0 bảng) | **PASS** — trả đúng `503 ok:false` + `PGRST205` (trước sửa: `200 ok:true` giả — xem §5.3) |
| T-05-11 | Không secret ở frontend | `grep service_role / SUPABASE_SERVICE_ROLE_KEY / eyJ` trong `apps/web/src/` | **PASS** — chỉ còn comment cảnh báo trong `supabase.ts`; không có key/JWT thật |
| T-05-12 | File gốc không đổi | Đối chiếu mtime `Visfar_Academy.html` / `Code-hop-nhat-2-trang.gs` | **PASS** — không bị ghi |

### 6.2. CHƯA CHẠY — chờ staging migrate + token + Workers deploy (không ghi PASS)

| # | Kiểm thử | Vì sao chưa chạy | Điều kiện để chạy |
|---|---|---|---|
| C-05-01 | Form mới gửi thử lên staging, kiểm chứng có đúng 1 row trong bảng `leads` staging + Sheet đối soát khớp | **CHƯA CHẠY (đã chạy thử một phần ngày 10/11/2026 22:09 +07).** Staging nay có bảng `leads` (0001→0006 PASS, `leads` = 0 row) và `courses` = 10 row, đọc công khai qua REST anon trả đủ 10 khóa. Gửi thử POST `/rest/v1/leads` bằng anon key với đúng cột (`course_interest_text`, không phải `course`) → **42501 `new row violates row-level security policy for table "leads"`** — tức RLS chặn đúng như thiết kế (lead chỉ được ghi qua Workers API, không ghi trực tiếp từ client). **Cập nhật 10/11/2026 ~17:00 +07: code Workers API đã có** (`workers/api/` — `POST /api/v1/leads`, test local 50/50 PASS, `wrangler deploy --dry-run` OK) **nhưng chưa deploy** (chưa có Cloudflare token — `wrangler whoami` báo chưa đăng nhập) nên vẫn chưa có endpoint `/api/v1/leads` thật → chưa gửi được form end-to-end, chưa có row nào được tạo (không cần dọn test row). DB staging + prod nay đã sẵn sàng (38 bảng, `leads` tồn tại, RLS chặn anon ghi trực tiếp như thiết kế). | Deploy Workers API (lệnh ở `workers/api/README.md` § Deploy) → gửi form thật 1 lần từ trình duyệt → đếm row `leads` + tab DATA |
| C-05-02 | Chống trùng thật trên staging (gửi 2 lần cùng key → DB chỉ 1 dòng) | **CHƯA CHẠY.** Cần Workers API deploy (code đã có — idempotency trùng key / khác body đã test local PASS; cột `leads.idempotency_key` đã tồn tại trên staging). Lần gửi thử anon ở C-05-01 bị RLS chặn trước khi tới bước kiểm tra trùng. | Như C-05-01; kiểm tra `leads.idempotency_key` UNIQUE |
| C-05-03 | Mất mạng thật trên trình duyệt (DevTools offline → "Thử lại" hoàn tất, không trùng) | **CHƯA CHẠY.** Cần Workers API thật (như C-05-01) + trình duyệt test. | Như C-05-01 + trình duyệt test |
| C-05-04 | Đăng ký / đăng nhập / dashboard thật | **CHƯA CHẠY (đã kiểm chứng một phần ngày 10/11/2026).** Bảng `profiles`/`enrollments` đã có trên staging; trigger `on_auth_user_created` trên `auth.users` + hàm `handle_new_user` đã tồn tại (kiểm chứng bằng query `information_schema.triggers`). Chưa tạo tài khoản test thật nên chưa kiểm chứng được trigger tạo profile + RLS chỉ thấy dữ liệu của mình. | Tạo tài khoản test trên staging, kiểm tra trigger tạo profile + RLS chỉ thấy dữ liệu của mình |
| C-05-05 | Fallback Apps Script live (ghi thật vào Sheet) | Ghi thật sẽ tạo dòng thật trong Sheet của user — cần user duyệt + dọn dòng test sau khi đối soát | User duyệt gửi thử 1 lần (tắt API hoặc trỏ API sai) → kiểm tra tab DATA VISFAR ACADEMY → xóa dòng test |
| C-05-06 | RLS-01–RLS-16, API-01–API-08 (Task 04, C-11/C-12/C-18 liên quan trực tiếp Task 05) | Cần staging đã migrate + 5 loại tài khoản test + Workers API | Theo `docs/supabase/BACKEND_TEST_REPORT.md` §5 |
| C-05-07 | Turnstile thật | Chưa có site key, chưa có verify ở server | User cung cấp site key Cloudflare Turnstile + Workers verify |
| C-05-08 | Đối soát lead hàng ngày (BK-04, 14 ngày) | Cần vận hành thật 14 ngày | Sau khi C-05-01 đạt |

**Cập nhật 10/11/2026 22:14 +07 (chạy migration lần 3 — user duyệt tất cả):** migration 0008 + chạy lại 0007 PASS hết trên **cả staging và prod** (38 bảng, RLS 38/38, 81 policy, 10 khóa, 4 policy, 5 bucket — xem `docs/supabase/BACKEND_TEST_REPORT.md` §5D). DB đã sẵn sàng. C-05-01–C-05-04 vẫn **CHƯA CHẠY** — lý do duy nhất còn lại: **Workers API chưa deploy** (`workers/api/` chỉ có `README.md` placeholder, chưa có code endpoint `/api/v1/leads` thật), nên form end-to-end vẫn chưa gửi được qua API mới; mọi lần gửi hiện vẫn đi fallback Apps Script cũ. Không ghi PASS cho thứ chưa chạy.

**Cập nhật 10/11/2026 ~17:00 +07 (Workers API — code xong, chưa deploy):** `workers/api/` nay đã có code thật: `POST /api/v1/leads` (validate server, honeypot + rate-limit 5/giờ/IP + idempotency, ghi DB rồi ghi Sheet, chỉ 201 khi DB xác nhận), `POST /api/v1/progress` (JWT JWKS, enrollment, luật 90%, chống gian lận, quiz đạt mới hoàn thành), `GET /api/health` (select thật 1 dòng `courses`, 503 khi chưa cấu hình). Test local **50/50 PASS** (vitest, mock PostgREST + JWT RS256 thật), `wrangler deploy --dry-run` OK (bundle 178.86 KiB), `wrangler dev` local kiểm chứng: SĐT sai → `400 invalid_phone`, honeypot → `400 spam_suspected`, thiếu JWT → `401`, chưa có secret → `503`. **Chưa deploy** vì `wrangler whoami` báo chưa đăng nhập (chưa có Cloudflare API token / OAuth) — lệnh deploy + secret cần set ghi ở `workers/api/README.md` § Deploy. Kiểm chứng live staging ngày này: REST anon đọc được **10 khóa published** trên staging, bảng `leads` trả `[]` (RLS chặn đọc như thiết kế). **POST live lên staging chưa chạy** vì không có service-role key staging + tài khoản test trong đợt này — C-05-01–C-05-04 vẫn **CHƯA CHẠY** live, chỉ còn chờ deploy + secret. Không ghi PASS cho thứ chưa chạy.

**Cập nhật 11/11/2026 ~06:41 +07 (Workers API — ĐÃ DEPLOY + đổi tên Worker):** Worker đổi tên từ `visfar-academy-api` thành **`api`**, deploy thật tại **https://api.visfaracademy.workers.dev** (Version ID `711e195f-4443-4bec-b1c8-aace3be26eca`). 5 secret đã set lại cho Worker mới (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APPS_SCRIPT_URL, SEPAY_WEBHOOK_SECRET, RESEND_API_KEY — staging). Kiểm chứng live: `GET /api/v1/health` → **200 ok:true**; POST lead test (SĐT 0912345678, khóa Thấu Hiểu Nội Tâm) → **201**, mã `VISFAR-2026-605018`, `sheetSynced:true`, đã đối chiếu có đúng 1 row trong bảng `leads` staging → **C-05-01 ĐẠT (qua Worker mới)**. Worker cũ đã xóa, URL cũ trả 404. Code web (`api-client.ts`, `.env.example`) nay mặc định gọi Worker mới; alias `visfaracademy.netlify.app/api/v1` vẫn giữ theo DECISIONS Task 02 QĐ 8, chỉ dùng được sau khi có redirect Netlify. C-05-02 (gửi trùng key) vẫn **CHƯA CHẠY** — cần gửi lại cùng Idempotency-Key và đếm DB.

**Không bịa token:** Task 05 không tạo, không đoán, không ghi bất kỳ access token / secret nào. Mọi giá trị key trong báo cáo này đều không có.

---

## 7. Phương án rollback

Rollback được thiết kế để **không mất dữ liệu và không chạm vào Sheet/DB**, vì Task 05 không sửa `.gs`, không chạy migration, không tạo dòng nào:

| # | Tình huống | Cách rollback | Ảnh hưởng |
|---|---|---|---|
| R-01 | Frontend mới lỗi sau deploy | Revert các file ở §3–§4 về commit trước Task 05 (`git revert` / checkout). Trang HTML gốc **không nằm trong repo Next.js** nên không bị ảnh hưởng — vẫn chạy độc lập như trước | Người dùng quay lại trang cũ; không mất đăng ký nào (form cũ vẫn gửi thẳng Apps Script) |
| R-02 | API mới lỗi / chưa ổn định, chỉ riêng form tư vấn | Đặt `NEXT_PUBLIC_API_BASE_URL` thành rỗng hoặc trỏ sai → mọi lần gửi đều rơi vào fallback Apps Script cũ (đã kiểm thử ở T-05-05). Hoặc: đổi link `/tu-van` trong header/trang chủ về lại trang HTML hiện tại | Form tiếp tục nhận đăng ký qua Sheet; mất mã tham chiếu API cho tới khi API sửa xong |
| R-03 | Fallback Apps Script lỗi | Không có thay đổi nào ở `.gs` trong Task 05 nên không cần rollback phía Sheet. Kiểm tra tab DATA VISFAR ACADEMY + log fallback (`localStorage: visfar_fallback_log` trên trình duyệt người gửi, và `console.warn`) để đối soát | Đối soát thủ công theo quy trình R9 |
| R-04 | Auth lỗi / Supabase Auth chưa sẵn sàng | Gỡ link Đăng nhập/Đăng ký khỏi header (hoặc revert `AccountNav` + 3 trang auth). Không có migration auth nào chạy trong Task 05 nên không cần rollback DB | Người dùng dùng form tư vấn ẩn danh như trước; dashboard tạm ẩn |
| R-05 | Route `/api/health` sau sửa | **Không rollback.** Bản sửa chỉ bỏ báo `ok` giả; rollback sẽ mang lỗi báo `ok` giả trở lại. Nếu health 503 gây báo động giả, kiểm tra migration trước (503 lúc này là đúng — DB chưa migrate) | — |
| R-06 | Cần quay lại toàn bộ | Revert toàn bộ Task 05 + deploy lại bản trước. Dữ liệu: không có dòng DB/Sheet nào do Task 05 tạo ra nên không cần dọn dữ liệu | — |

**Điều kiện để XÓA endpoint Apps Script cũ (chưa đủ — chưa xóa):** chỉ xóa sau khi cả 3 điều kiện cùng đạt: (1) xác nhận dữ liệu đã ghi ở backend mới (C-05-01 đạt: lead vào DB + Sheet đối soát khớp); (2) kiểm thử form mới đạt trên staging (C-05-02, C-05-03); (3) phương án rollback R-01/R-02 đã được diễn tập. Hiện tại cả 3 đều **chưa đạt**.

---

## 8. Việc cần user / coordinator quyết sau Task 05

1. Cấp lại `SUPABASE_ACCESS_TOKEN` để chạy migration 0001→0007 lên staging (phần A đang dừng ở đây), rồi chạy C-05-01–C-05-04.
2. Deploy Workers API (`visfaracademy.netlify.app/api/v1`) — **code đã xong ngày 10/11/2026 ~17:00 +07** (`workers/api/`, test local 50/50 PASS, dry-run OK), chỉ còn chờ Cloudflare token + set secret (lệnh ở `workers/api/README.md` § Deploy). Tới lúc đó form mới tự chuyển sang đường API.
3. Duyệt gửi thử fallback Apps Script live 1 lần (C-05-05) + dọn dòng test.
4. Cung cấp Cloudflare Turnstile site key nếu muốn bật CAPTCHA (C-05-07).
5. Xác nhận cách xử lý mâu thuẫn QĐ 3 (giữ fallback "thành công giả" ở trang cũ) vs QĐ 2 (API mới không hiện cảm ơn khi chưa có `ok:true`) — Task 05 đã chọn QĐ 2 cho frontend mới; nếu user muốn thống nhất khác đi thì báo lại.
