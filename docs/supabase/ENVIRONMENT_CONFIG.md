# Cấu hình biến môi trường — Supabase Backend (Task 04)

**Ngày:** 10/11/2026
**Trạng thái:** Chờ user tạo project Supabase
**Thuộc:** Task 04 — Supabase Backend Implementation, Visfar Academy
**Tài liệu nguồn:**

- `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (kiến trúc tổng thể v1.0, §1–§2, §6, §12)
- `workspace/visfar-academy-platform/docs/architecture/DEPLOYMENT_ARCHITECTURE.md` (§2 môi trường, §5 secrets)
- `workspace/visfar-academy-platform/docs/architecture/INTEGRATION_PLAN.md` (§1–§8 secret theo tên biến)
- `workspace/visfar-academy-platform/docs/DECISIONS.md` (19 quyết định 10/11/2026 + phê duyệt Task 02/Task 03)

**Quy tắc của file này:** chỉ ghi **TÊN biến môi trường**, không ghi giá trị thật, không ghi secret thật, không ghi số tài khoản ngân hàng, không ghi giá dịch vụ. Mọi giá trị mẫu trong file này đều là placeholder (dạng `<...>`). **Chưa có project Supabase nào được tạo** — mọi giá trị thật chỉ tồn tại sau khi user tạo project (xem §11).

---

## 1. Nguyên tắc chung

1. **Cùng tên biến, khác giá trị theo môi trường.** Ba môi trường dùng đúng một bộ tên biến; giá trị (URL, key) khác nhau hoàn toàn giữa prod và staging. Nhầm key staging/prod là lỗi cấm — kiểm tra bằng `GET /api/health` sau mỗi lần deploy.
2. **Supabase Free chỉ có 2 project đang hoạt động** — đúng 2 project cần dùng, không còn project dự phòng. Phân bổ: project 1 = Production, project 2 = Staging (đồng thời là nơi restore thử backup hàng tháng). **Development không có project Supabase riêng** — dùng chung project staging (dữ liệu test) hoặc Supabase local qua CLI.
3. **Không bao giờ dùng dữ liệu thật ở staging/dev.** Dữ liệu staging chỉ là seed + dữ liệu test; xóa và seed lại được bất cứ lúc nào. Không tạo dữ liệu học viên thật ở môi trường nào ngoài production.
4. **Service-role key chỉ ở server.** Chỉ Cloudflare Workers API được cầm `SUPABASE_SERVICE_ROLE_KEY`. Frontend không bao giờ thấy key này — key này bypass RLS, lộ key là lộ toàn bộ database.
5. **Không commit secret.** Không commit `.env`, `.env.local`, hay bất kỳ file nào chứa secret. `.env.example` chỉ chứa tên biến + giá trị mẫu giả.
6. **Ban đầu hoàn toàn miễn phí.** Cả ba môi trường chạy trên gói miễn phí (Supabase Free, Cloudflare Free, Resend Free). Nâng cấp trả phí chỉ khi chạm giới hạn miễn phí và chỉ khi có phê duyệt riêng bằng văn bản (theo Quyết định 18).
7. **Không đưa PII vào biến môi trường, log hay URL.** Log chỉ ghi `reference_code` và `user_id`, không ghi họ tên / SĐT / email.

---

## 2. Tổng quan ba môi trường

| Môi trường | Frontend | API (Workers) | Supabase project | Database | Mục đích |
|---|---|---|---|---|---|
| **Development** (local) | `localhost` (Next.js dev server, `next dev`) | `wrangler dev` (local) | Dùng chung project **staging** hoặc Supabase local qua CLI | Staging / local — dữ liệu test | Lập trình, test nhanh trên máy cá nhân |
| **Staging** | Preview deployment Cloudflare Pages (mỗi PR có 1 URL riêng) | Workers staging (deploy từ PR/branch) | **Project Supabase thứ 2** | Staging — dữ liệu test, seed khóa học mẫu | Kiểm thử trước khi lên prod; **nơi duy nhất restore thử backup hàng tháng** |
| **Production** | Cloudflare Pages production (domain chính) | Workers production | **Project Supabase thứ 1** | Production — dữ liệu thật duy nhất | Phục vụ học viên thật |

**Tài khoản Supabase:** cả 2 project (prod + staging) tạo trên tài khoản Gmail `visfaracademy@gmail.com` (theo phê duyệt Task 02, quyết định 15).

**Domain API (đã chốt):** `visfaracademy.netlify.app`, tiền tố `/api/v1` (theo phê duyệt Task 02, quyết định 8). Lưu ý đã ghi trong DECISIONS.md: domain này là subdomain Netlify, khác với hosting Cloudflare Pages/Workers trong kiến trúc — **cần kiểm tra lại cách gắn domain cho Workers API khi triển khai**, không tự đổi domain.

---

## 3. Development (local)

### 3.1. Biến môi trường — Development

| Biến | Dùng ở | Bắt buộc | Ghi chú |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend (Next.js) | Có | URL project **staging** (hoặc URL Supabase local khi dùng CLI) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend (Next.js) | Có | Anon key project **staging** (hoặc local) — bị RLS chặn, chỉ đọc nội dung công khai |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend (Next.js) | Có | Base URL Workers API local / staging, gồm tiền tố `/api/v1` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Frontend (Next.js) | Có, khi bật CAPTCHA | Site key công khai của Turnstile (không phải secret) |
| `SUPABASE_URL` | Workers API (local) | Có | Cùng giá trị với `NEXT_PUBLIC_SUPABASE_URL` của môi trường này |
| `SUPABASE_SERVICE_ROLE_KEY` | Workers API (local, server) | Có | Chỉ ở server local, **không bao giờ** đưa vào code frontend |
| `SUPABASE_JWT_SECRET` | Workers API (local) | Có | Xác minh JWT (Supabase JWKS); không tin JWT do client tự khai |
| `RESEND_API_KEY` | Workers API (local) | Không, ở dev | Dev **không gửi email thật** — chỉ log + ghi `email_logs` ở staging |
| `RESEND_FROM_EMAIL` | Workers API (local) | Không, ở dev | Chỉ cần khi test gửi email thật qua staging |
| `ADMIN_NOTIFY_EMAIL` | Workers API (local) | Không, ở dev | Email admin nhận báo lead mới (xem §3.3) |
| `TURNSTILE_SECRET_KEY` | Workers API (local) | Có, khi bật CAPTCHA | Secret phía server của Turnstile |
| `GOOGLE_SHEET_ID` | Workers API (local) | Không, ở dev | Chỉ khi test luồng ghi Sheet đối soát |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Workers API (local) | Không, ở dev | Hoặc `GOOGLE_SHEETS_API_KEY` — chọn 1 trong 2 khi triển khai, không dùng cả hai |
| `APPS_SCRIPT_WEB_APP_URL` | Workers API (local) | Không, ở dev | Chỉ khi luồng triển khai giữ Apps Script làm cầu nối ghi Sheet |

**Không dùng ở Development:** `SEPAY_WEBHOOK_SECRET`, `SEPAY_API_TOKEN`, `SEPAY_MERCHANT_ID` (SePay chỉ triển khai khi có phê duyệt riêng — chưa triển khai ở giai đoạn đầu); mọi biến Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) — **Stripe chưa dùng** (theo phê duyệt Task 02, quyết định 9).

### 3.2. `.env.example` — Development

Đặt tại `apps/web/.env.example` (frontend) và `workers/api/.env.example` (Workers). File `.env.local` thật ở máy dev **không commit**.

```env
# ============================================================
# apps/web/.env.example — DEVELOPMENT (local)
# Sao chép thành .env.local rồi điền giá trị staging/local.
# File này CHỈ chứa placeholder — không điền giá trị thật vào đây.
# ============================================================
NEXT_PUBLIC_SUPABASE_URL=<YOUR_STAGING_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_STAGING_SUPABASE_ANON_KEY>
NEXT_PUBLIC_API_BASE_URL=<YOUR_LOCAL_OR_STAGING_API_BASE_URL>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<YOUR_TURNSTILE_SITE_KEY>
```

```env
# ============================================================
# workers/api/.env.example — DEVELOPMENT (local, wrangler dev)
# Sao chép thành .dev.vars rồi điền giá trị staging/local.
# File này CHỈ chứa placeholder — không điền giá trị thật vào đây.
# ============================================================
SUPABASE_URL=<YOUR_STAGING_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_STAGING_SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_JWT_SECRET=<YOUR_STAGING_SUPABASE_JWT_SECRET>
RESEND_API_KEY=<YOUR_RESEND_API_KEY>
RESEND_FROM_EMAIL=<YOUR_RESEND_FROM_EMAIL>
ADMIN_NOTIFY_EMAIL=<YOUR_ADMIN_NOTIFY_EMAIL>
TURNSTILE_SECRET_KEY=<YOUR_TURNSTILE_SECRET_KEY>
GOOGLE_SHEET_ID=<YOUR_GOOGLE_SHEET_ID>
GOOGLE_SERVICE_ACCOUNT_KEY=<YOUR_GOOGLE_SERVICE_ACCOUNT_KEY_JSON>
APPS_SCRIPT_WEB_APP_URL=<YOUR_APPS_SCRIPT_WEB_APP_URL>
```

### 3.3. Lưu ý riêng Development

- Dev dùng key staging nên **không bao giờ** nhập key production vào máy dev. Nếu lỡ nhập key prod vào `.env.local`, xóa file và tạo lại ngay, rồi báo cho admin để rà soát (không cần xoay key nếu key chưa từng rời máy, nhưng phải ghi lại sự việc).
- Email ở dev không gửi thật: Workers log nội dung email thay vì gọi Resend; chỉ test gửi thật trên staging với địa chỉ email test.
- Supabase local (CLI) là lựa chọn thay thế khi không muốn chạm tới project staging: khi đó `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_URL` trỏ tới URL local do CLI cấp, các key lấy từ output của `supabase start`.

---

## 4. Staging

### 4.1. Biến môi trường — Staging

| Biến | Dùng ở | Bắt buộc | Ghi chú |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend (Cloudflare Pages preview) | Có | URL project Supabase **staging (project thứ 2)** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend (Cloudflare Pages preview) | Có | Anon key project **staging** |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend (Cloudflare Pages preview) | Có | Base URL Workers **staging**, gồm tiền tố `/api/v1` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Frontend (Cloudflare Pages preview) | Có, khi bật CAPTCHA | Site key công khai của Turnstile |
| `SUPABASE_URL` | Workers staging (Workers Secrets) | Có | URL project Supabase **staging** |
| `SUPABASE_SERVICE_ROLE_KEY` | Workers staging (Workers Secrets) | Có | Service-role key project **staging** — chỉ ở server |
| `SUPABASE_JWT_SECRET` | Workers staging (Workers Secrets) | Có | JWT secret project **staging** |
| `RESEND_API_KEY` | Workers staging (Workers Secrets) | Có | Key Resend — staging chỉ gửi tới email test |
| `RESEND_WEBHOOK_SECRET` | Workers staging (Workers Secrets) | Có | Xác minh webhook trạng thái email Resend |
| `RESEND_FROM_EMAIL` | Workers staging (Workers Secrets) | Có | Địa chỉ gửi từ domain riêng đã xác minh DNS (chốt khi xác minh DNS) |
| `ADMIN_NOTIFY_EMAIL` | Workers staging (Workers Secrets) | Có | Email admin nhận báo lead mới |
| `TURNSTILE_SECRET_KEY` | Workers staging (Workers Secrets) | Có, khi bật CAPTCHA | Secret phía server của Turnstile |
| `GOOGLE_SHEET_ID` | Workers staging (Workers Secrets) | Có, khi test luồng Sheet | ID Google Sheet đối soát |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Workers staging (Workers Secrets) | Có, khi test luồng Sheet | Hoặc `GOOGLE_SHEETS_API_KEY` — chọn 1 trong 2 |
| `APPS_SCRIPT_WEB_APP_URL` | Workers staging (Workers Secrets) | Không | Chỉ khi luồng triển khai giữ Apps Script làm cầu nối |
| `SEPAY_WEBHOOK_SECRET` | Workers staging (Workers Secrets) | Không | Chỉ khi SePay được phê duyệt và triển khai |
| `SEPAY_API_TOKEN` | Workers staging (Workers Secrets) | Không | Chỉ khi SePay được phê duyệt; tên biến chính xác theo tài liệu SePay tại thời điểm triển khai |
| `SEPAY_MERCHANT_ID` | Workers staging (Workers Secrets) | Không | Chỉ khi SePay yêu cầu |

### 4.2. `.env.example` — Staging

Staging **không dùng file `.env`** — mọi biến đặt trực tiếp trong dashboard Cloudflare (Pages env vars cho frontend, Workers Secrets cho API) theo từng môi trường deploy. Khối dưới đây là **bản liệt kê để đối chiếu**, không phải file để commit hay để chạy local.

```env
# ============================================================
# STAGING — bản liệt kê đối chiếu (KHÔNG phải file .env thật)
# Đặt các giá trị này trong:
#  - Cloudflare Pages > Settings > Environment variables (preview)
#    cho 4 biến NEXT_PUBLIC_*
#  - Cloudflare Workers > Settings > Variables and Secrets
#    cho các biến còn lại (môi trường staging)
# ============================================================
# --- Frontend (Cloudflare Pages preview) ---
NEXT_PUBLIC_SUPABASE_URL=<YOUR_STAGING_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_STAGING_SUPABASE_ANON_KEY>
NEXT_PUBLIC_API_BASE_URL=<YOUR_STAGING_API_BASE_URL>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<YOUR_TURNSTILE_SITE_KEY>
# --- Workers API staging (Workers Secrets) ---
SUPABASE_URL=<YOUR_STAGING_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_STAGING_SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_JWT_SECRET=<YOUR_STAGING_SUPABASE_JWT_SECRET>
RESEND_API_KEY=<YOUR_RESEND_API_KEY>
RESEND_WEBHOOK_SECRET=<YOUR_RESEND_WEBHOOK_SECRET>
RESEND_FROM_EMAIL=<YOUR_RESEND_FROM_EMAIL>
ADMIN_NOTIFY_EMAIL=<YOUR_ADMIN_NOTIFY_EMAIL>
TURNSTILE_SECRET_KEY=<YOUR_TURNSTILE_SECRET_KEY>
GOOGLE_SHEET_ID=<YOUR_GOOGLE_SHEET_ID>
GOOGLE_SERVICE_ACCOUNT_KEY=<YOUR_GOOGLE_SERVICE_ACCOUNT_KEY_JSON>
APPS_SCRIPT_WEB_APP_URL=<YOUR_APPS_SCRIPT_WEB_APP_URL>
# --- Chỉ khi SePay được phê duyệt ---
SEPAY_WEBHOOK_SECRET=<YOUR_SEPAY_WEBHOOK_SECRET>
SEPAY_API_TOKEN=<YOUR_SEPAY_API_TOKEN>
SEPAY_MERCHANT_ID=<YOUR_SEPAY_MERCHANT_ID>
```

### 4.3. Lưu ý riêng Staging

- Preview deployment của mỗi PR dùng biến staging — không chạm dữ liệu prod.
- Staging là nơi duy nhất restore thử backup hàng tháng: restore xong thì seed lại dữ liệu test, không để dữ liệu backup prod lẫn vào staging lâu dài.
- Resend ở staging chỉ gửi tới email test; không gửi email thật cho học viên từ staging.

---

## 5. Production

### 5.1. Biến môi trường — Production

| Biến | Dùng ở | Bắt buộc | Ghi chú |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend (Cloudflare Pages production) | Có | URL project Supabase **production (project thứ 1)** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend (Cloudflare Pages production) | Có | Anon key project **production** |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend (Cloudflare Pages production) | Có | Base URL Workers **production** — `https://visfaracademy.netlify.app/api/v1` (domain đã chốt; kiểm tra lại cách gắn domain cho Workers khi triển khai, xem §2) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Frontend (Cloudflare Pages production) | Có, khi bật CAPTCHA | Site key công khai của Turnstile |
| `SUPABASE_URL` | Workers production (Workers Secrets) | Có | URL project Supabase **production** |
| `SUPABASE_SERVICE_ROLE_KEY` | Workers production (Workers Secrets) | Có | Service-role key project **production** — chỉ ở server |
| `SUPABASE_JWT_SECRET` | Workers production (Workers Secrets) | Có | JWT secret project **production** |
| `RESEND_API_KEY` | Workers production (Workers Secrets) | Có | Key Resend production |
| `RESEND_WEBHOOK_SECRET` | Workers production (Workers Secrets) | Có | Xác minh webhook trạng thái email Resend |
| `RESEND_FROM_EMAIL` | Workers production (Workers Secrets) | Có | Địa chỉ gửi từ domain riêng đã xác minh DNS (SPF, DKIM, DMARC) — không gửi cho người dùng thật từ `onboarding@resend.dev` |
| `ADMIN_NOTIFY_EMAIL` | Workers production (Workers Secrets) | Có | Email admin nhận báo lead mới + cảnh báo hệ thống: `visfaracademy@gmail.com` (theo phê duyệt Task 02, quyết định 14) |
| `TURNSTILE_SECRET_KEY` | Workers production (Workers Secrets) | Có, khi bật CAPTCHA | Secret phía server của Turnstile |
| `GOOGLE_SHEET_ID` | Workers production (Workers Secrets) | Có, khi chạy luồng Sheet | ID Google Sheet đối soát (bản sao, không phải database chính) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Workers production (Workers Secrets) | Có, khi chạy luồng Sheet | Hoặc `GOOGLE_SHEETS_API_KEY` — chọn 1 trong 2 |
| `APPS_SCRIPT_WEB_APP_URL` | Workers production (Workers Secrets) | Không | Chỉ khi luồng triển khai giữ Apps Script làm cầu nối |
| `SEPAY_WEBHOOK_SECRET` | Workers production (Workers Secrets) | Không | Chỉ khi SePay được phê duyệt và triển khai |
| `SEPAY_API_TOKEN` | Workers production (Workers Secrets) | Không | Chỉ khi SePay được phê duyệt |
| `SEPAY_MERCHANT_ID` | Workers production (Workers Secrets) | Không | Chỉ khi SePay yêu cầu |

### 5.2. `.env.example` — Production

Production **không dùng file `.env`** — mọi biến đặt trực tiếp trong dashboard Cloudflare (Pages env vars cho frontend, Workers Secrets cho API) ở môi trường production. Khối dưới đây là **bản liệt kê để đối chiếu**, không phải file để commit hay để chạy local.

```env
# ============================================================
# PRODUCTION — bản liệt kê đối chiếu (KHÔNG phải file .env thật)
# Đặt các giá trị này trong:
#  - Cloudflare Pages > Settings > Environment variables (production)
#    cho 4 biến NEXT_PUBLIC_*
#  - Cloudflare Workers > Settings > Variables and Secrets
#    cho các biến còn lại (môi trường production)
# ============================================================
# --- Frontend (Cloudflare Pages production) ---
NEXT_PUBLIC_SUPABASE_URL=<YOUR_PRODUCTION_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_PRODUCTION_SUPABASE_ANON_KEY>
NEXT_PUBLIC_API_BASE_URL=https://visfaracademy.netlify.app/api/v1
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<YOUR_TURNSTILE_SITE_KEY>
# --- Workers API production (Workers Secrets) ---
SUPABASE_URL=<YOUR_PRODUCTION_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_JWT_SECRET=<YOUR_PRODUCTION_SUPABASE_JWT_SECRET>
RESEND_API_KEY=<YOUR_RESEND_API_KEY>
RESEND_WEBHOOK_SECRET=<YOUR_RESEND_WEBHOOK_SECRET>
RESEND_FROM_EMAIL=<YOUR_RESEND_FROM_EMAIL>
ADMIN_NOTIFY_EMAIL=visfaracademy@gmail.com
TURNSTILE_SECRET_KEY=<YOUR_TURNSTILE_SECRET_KEY>
GOOGLE_SHEET_ID=<YOUR_GOOGLE_SHEET_ID>
GOOGLE_SERVICE_ACCOUNT_KEY=<YOUR_GOOGLE_SERVICE_ACCOUNT_KEY_JSON>
APPS_SCRIPT_WEB_APP_URL=<YOUR_APPS_SCRIPT_WEB_APP_URL>
# --- Chỉ khi SePay được phê duyệt ---
SEPAY_WEBHOOK_SECRET=<YOUR_SEPAY_WEBHOOK_SECRET>
SEPAY_API_TOKEN=<YOUR_SEPAY_API_TOKEN>
SEPAY_MERCHANT_ID=<YOUR_SEPAY_MERCHANT_ID>
```

### 5.3. Lưu ý riêng Production

- Deploy production chỉ khi merge vào `main`. Không deploy prod từ branch, không deploy prod bằng tay từ máy cá nhân.
- Sau mỗi lần deploy production: kiểm tra `GET /api/health` trả 200 và chạy 1 request API mẫu (xem §10). `/api/health` trả 503 `not_configured` khi thiếu biến môi trường, 503 `supabase_error` khi Supabase lỗi/tạm dừng.
- Backup production chạy hàng ngày qua GitHub Actions (`pg_dump`); xem `DEPLOYMENT_ARCHITECTURE.md` §6. Biến phục vụ backup/migration chỉ nằm trong GitHub Secrets, không nằm trong code chạy production (xem §7).

---

## 6. Bảng phân biệt: biến nào dùng ở frontend, biến nào chỉ ở server

Quy tắc nhận biết nhanh: **mọi biến bắt đầu bằng `NEXT_PUBLIC_` đều bị nhúng vào bundle JavaScript gửi tới trình duyệt** — ai mở DevTools cũng đọc được. Chỉ đặt ở đó những giá trị được thiết kế để công khai (URL, anon key bị RLS chặn, site key CAPTCHA). Mọi secret còn lại **chỉ ở server**.

| Biến | Frontend (Next.js) | Workers / server | GitHub Actions (CI/CD, backup) | Mức nhạy cảm |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ (dùng chung giá trị) | — | Thấp — URL công khai |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ (dùng chung giá trị) | — | Thấp — anon key bị RLS chặn; vẫn phải xoay khi phát hiện lộ |
| `NEXT_PUBLIC_API_BASE_URL` | ✓ | — | — | Thấp — URL API công khai |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✓ | — | — | Thấp — site key công khai |
| `SUPABASE_URL` | ✗ | ✓ | — | Thấp — trùng giá trị `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | **✗ KHÔNG BAO GIỜ** | ✓ (Workers Secrets) | — | **Rất cao — bypass RLS, lộ key là lộ toàn bộ database** |
| `SUPABASE_JWT_SECRET` | **✗** | ✓ (Workers Secrets) | — | Cao — dùng để xác minh JWT |
| `RESEND_API_KEY` | **✗** | ✓ (Workers Secrets) | — | Cao — gửi email nhân danh domain Visfar |
| `RESEND_WEBHOOK_SECRET` | **✗** | ✓ (Workers Secrets) | — | Cao — xác minh webhook Resend |
| `RESEND_FROM_EMAIL` | **✗** | ✓ (Workers Secrets) | — | Thấp — địa chỉ gửi, cấu hình |
| `ADMIN_NOTIFY_EMAIL` | **✗** | ✓ (Workers Secrets) | — | Thấp — email admin |
| `TURNSTILE_SECRET_KEY` | **✗** | ✓ (Workers Secrets) | — | Cao — xác minh CAPTCHA phía server |
| `SEPAY_WEBHOOK_SECRET` | **✗** | ✓ (Workers Secrets, khi dùng SePay) | — | Cao — xác minh webhook thanh toán |
| `SEPAY_API_TOKEN` | **✗** | ✓ (Workers Secrets, khi dùng SePay) | — | Cao |
| `SEPAY_MERCHANT_ID` | **✗** | ✓ (Workers Secrets, khi dùng SePay) | — | Trung bình — ID merchant, không phải key |
| `GOOGLE_SHEET_ID` | **✗** | ✓ (Workers Secrets) | — | Trung bình — ID Sheet đối soát |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | **✗** | ✓ (Workers Secrets) | — | Cao — quyền ghi Sheet; cấp quyền tối thiểu (chỉ Sheet đối soát) |
| `GOOGLE_SHEETS_API_KEY` | **✗** | ✓ (Workers Secrets) | — | Cao — chỉ dùng nếu chọn API key thay service account |
| `APPS_SCRIPT_WEB_APP_URL` | **✗** | ✓ (Workers Secrets) | — | Trung bình — URL Web App `.gs` |
| `SUPABASE_DB_URL` / `DATABASE_URL` | **✗** | **✗** (không dùng trong code chạy production) | ✓ (GitHub Secrets — `pg_dump`, migration) | Cao — mật khẩu DB trong connection string |
| `SUPABASE_DB_PASSWORD` | **✗** | **✗** | ✓ (GitHub Secrets — backup/restore) | Cao — chỉ dùng cho backup/restore |
| `SUPABASE_ACCESS_TOKEN` | **✗** | **✗** | ✓ (GitHub Secrets — Supabase CLI) | Cao — token CLI |
| `CLOUDFLARE_API_TOKEN` | **✗** | **✗** | ✓ (GitHub Secrets — deploy Pages/Workers) | Cao — giới hạn quyền tối thiểu |
| `CLOUDFLARE_ACCOUNT_ID` | **✗** | **✗** | ✓ (GitHub Secrets — deploy) | Trung bình — ID tài khoản |
| `R2_BUCKET` | **✗** | **✗** | ✓ (GitHub Secrets — lưu backup) | Thấp — tên bucket |
| `R2_ACCESS_KEY_ID` | **✗** | **✗** | ✓ (GitHub Secrets — lưu backup) | Cao |
| `R2_SECRET_ACCESS_KEY` | **✗** | **✗** | ✓ (GitHub Secrets — lưu backup) | Cao |

**Các biến KHÔNG dùng (không tạo, không điền):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe chưa dùng; `YOUTUBE_API_KEY` — chưa cần ở giai đoạn embed unlisted, chỉ thêm khi cần YouTube Data API.

---

## 7. Nơi lưu secret — mỗi loại secret ở đâu

| Secret | Lưu ở | Ai dùng | Không bao giờ ở |
|---|---|---|---|
| Supabase URL + anon key (từng môi trường) | Cloudflare Pages env vars (theo môi trường) + `.env.local` ở máy dev | Frontend + Workers | Không vấn đề gì nếu lộ URL/anon key (bị RLS chặn), nhưng vẫn xoay anon key khi phát hiện lộ |
| `SUPABASE_SERVICE_ROLE_KEY` | **Cloudflare Workers Secrets** (riêng production/staging) | Chỉ Workers API (server) | Frontend, repo, log, email, ảnh chụp màn hình, chat |
| `SUPABASE_JWT_SECRET` | Cloudflare Workers Secrets | Workers API | Frontend, repo |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | Cloudflare Workers Secrets | Workers API | Frontend, repo |
| Webhook secret (SePay) | Cloudflare Workers Secrets | Workers API | Frontend, repo |
| `TURNSTILE_SECRET_KEY` | Cloudflare Workers Secrets | Workers API | Frontend, repo (site key thì được ở frontend) |
| Google service account / Sheets API key | Cloudflare Workers Secrets | Workers API | Frontend, repo |
| `SUPABASE_DB_URL` / `SUPABASE_DB_PASSWORD` / `SUPABASE_ACCESS_TOKEN` | **GitHub Secrets** | GitHub Actions (backup `pg_dump`, migration) | Code chạy production, repo |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | **GitHub Secrets** | GitHub Actions (deploy) | Repo, frontend |
| `R2_*` (bucket + keys backup) | **GitHub Secrets** | GitHub Actions (lưu backup) | Repo, frontend |
| Danh sách **tên biến** (không kèm giá trị) | Tài liệu vận hành (`docs/RUNBOOK.md`) + file này | Người vận hành — để khi mất secret thì nhập lại được | — |

**Quy tắc `.gitignore` (bắt buộc):** chặn `.env*` trừ `.env.example`. Kiểm tra `.gitignore` có các dòng sau trước lần commit đầu tiên:

```gitignore
.env
.env.local
.env.*.local
.dev.vars
*.sql.gz
```

---

## 8. Quy tắc không commit secret key

1. **Không commit `.env`, `.env.local`, `.dev.vars`, hay bất kỳ file nào chứa secret** — kể cả file backup `.sql` / `.sql.gz` (chứa PII học viên) cũng không commit vào repo code chính; backup chỉ lưu ở repo backup riêng (private) + R2.
2. **`.env.example` chỉ chứa tên biến + giá trị mẫu giả** (dạng `<...>`). Không điền giá trị thật vào `.env.example` “tạm thời” — giá trị “tạm” là cách secret lọt vào Git nhiều nhất.
3. **Không đưa service-role key vào frontend** dưới bất kỳ hình thức nào: không `NEXT_PUBLIC_*`, không hardcode trong component, không nhúng trong comment code, không để trong file JSON public, không để trong ảnh chụp màn hình đăng lên PR.
4. **Không ghi secret vào log, email, chat hay ticket.** Log chỉ ghi `reference_code` và `user_id`. Khi báo lỗi liên quan tới key, chỉ ghi tên biến (VD “thiếu `SUPABASE_SERVICE_ROLE_KEY`”), không ghi giá trị.
5. **Không ghi số tài khoản ngân hàng / QR VietQR vào biến môi trường công khai hay tài liệu.** Chỉ dùng file/ảnh do user cung cấp (theo Quyết định 15). Thông tin ngân hàng: MB Bank, chủ tài khoản Công ty TNHH MTV Visfar Holdings — số tài khoản **không ghi vào file này**.
6. **Không chia sẻ key qua kênh không an toàn.** Service-role key và các key server chỉ được nhập trực tiếp vào dashboard Cloudflare Workers Secrets / GitHub Secrets bởi người có quyền; không gửi key qua chat, email hay ảnh chụp.
7. **Mỗi môi trường một bộ key riêng.** Không dùng chung service-role key prod cho staging, không dùng key staging cho prod. Key nào thuộc môi trường nào phải ghi rõ khi nhập vào Secrets.

---

## 9. Xoay key (rotate) khi rò rỉ / khi có người rời đội

### 9.1. Khi nào phải xoay key

| Tình huống | Xoay key nào | Mức độ |
|---|---|---|
| Nghi ngờ / phát hiện service-role key lộ (lọt vào repo, log, ảnh chụp, chat) | `SUPABASE_SERVICE_ROLE_KEY` của môi trường đó — **ngay lập tức** | Khẩn cấp |
| Nghi ngờ / phát hiện anon key lộ | `NEXT_PUBLIC_SUPABASE_ANON_KEY` của môi trường đó | Cao (anon bị RLS chặn nên thiệt hại thấp hơn, vẫn phải xoay) |
| Nghi ngờ / phát hiện Resend key lộ | `RESEND_API_KEY` (+ kiểm tra `email_logs` xem có email lạ không) | Cao |
| Nghi ngờ / phát hiện webhook secret lộ | Secret của webhook đó (`SEPAY_WEBHOOK_SECRET` / `RESEND_WEBHOOK_SECRET`) + cập nhật phía nhà cung cấp | Cao |
| Nghi ngờ / phát hiện Turnstile secret lộ | `TURNSTILE_SECRET_KEY` | Trung bình |
| Nghi ngờ / phát hiện Google service account key lộ | `GOOGLE_SERVICE_ACCOUNT_KEY` (+ thu hồi key cũ trong Google Cloud Console) | Cao |
| Nghi ngờ / phát hiện Cloudflare token lộ | `CLOUDFLARE_API_TOKEN` (+ kiểm tra lịch sử deploy) | Cao |
| **Có người rời đội** (dù rời trong hòa bình) | Thu hồi quyền truy cập của người đó ở mọi nơi (xem §9.3); xoay mọi shared key mà người đó từng có quyền xem | Bắt buộc |
| Rà soát định kỳ | Rà soát lại ai còn quyền, có cần xoay key không — **mỗi quý 1 lần** | Định kỳ |

### 9.2. Quy trình xoay key (áp dụng cho mọi loại key)

1. **Tạo key mới** trong dashboard của nhà cung cấp (Supabase → Settings → API → tạo lại key; Resend → API Keys → tạo key mới; Cloudflare → API Tokens → tạo token mới; SePay/Turnstile/Google tương tự).
2. **Cập nhật nơi lưu secret:** Cloudflare Workers Secrets (key server) / Cloudflare Pages env vars (key frontend) / GitHub Secrets (key CI/CD) — đúng môi trường (prod/staging), không nhập nhầm key môi trường khác.
3. **Deploy lại** (Workers deploy lại để nhận secret mới; frontend build lại nếu đổi biến `NEXT_PUBLIC_*`, vì biến này nhúng vào bundle lúc build).
4. **Kiểm tra:** `GET /api/health` trả 200; chạy 1 request API mẫu (VD `GET /api/courses` và 1 `POST /api/leads` test trên staging); kiểm tra email test gửi được (nếu xoay Resend key).
5. **Thu hồi key cũ** trong dashboard nhà cung cấp — chỉ thu hồi sau khi bước 4 đã đạt. Không thu hồi key cũ trước khi key mới chạy được.
6. **Ghi biên bản:** ghi lại key nào đã xoay, ngày giờ, lý do, người thực hiện — vào `docs/RUNBOOK.md` (chỉ ghi tên biến + thời gian, **không ghi giá trị key cũ/mới**).
7. **Nếu là rò rỉ service-role key:** coi là sự cố bảo mật — kiểm tra log Supabase (query bất thường, đăng nhập lạ), kiểm tra `audit_logs` và các bảng nhạy cảm (`orders`, `payments`, `leads`) có thay đổi lạ không, rồi mới đóng sự cố.

### 9.3. Khi có người rời đội — checklist thu hồi quyền

- [ ] Xóa / thu hồi quyền của người đó trong **Supabase** (Organization / project members) — cả project prod và staging.
- [ ] Xóa / thu hồi quyền trong **Cloudflare** (Pages + Workers) và **GitHub** (repo, Actions secrets nếu họ từng xem).
- [ ] Xóa / thu hồi quyền trong **Resend**, **Google** (Sheet đối soát, service account) và mọi tài khoản dùng chung khác.
- [ ] Xoay mọi shared key mà người đó từng có quyền xem (service-role key, Resend key, webhook secret) theo quy trình §9.2.
- [ ] Kiểm tra `.env.local` / máy cá nhân của người rời đội đã xóa hết key chưa (nhắc bằng văn bản, có xác nhận).
- [ ] Cập nhật danh sách người có quyền trong `docs/RUNBOOK.md`.

---

## 10. Checklist kiểm tra rò rỉ secret trước mỗi commit

Chạy checklist này **trước mỗi commit** (và bắt buộc trước mỗi PR). Dừng commit nếu có bất kỳ mục nào chưa đạt.

- [ ] `git status` — không có file `.env`, `.env.local`, `.dev.vars`, file `.sql` / `.sql.gz`, file chứa key nào trong danh sách commit.
- [ ] `git diff` — đọc lại toàn bộ diff: không có chuỗi key, token, mật khẩu hay connection string nào lọt vào (kể cả trong comment code, file test, file seed).
- [ ] `.env.example` — chỉ chứa tên biến + placeholder dạng `<...>`; không có giá trị thật nào.
- [ ] Không có biến `NEXT_PUBLIC_*` nào ngoài 4 biến đã liệt kê ở §6 (URL, anon key, API base URL, Turnstile site key). Đặc biệt: **không có `NEXT_PUBLIC_*SERVICE*`, `NEXT_PUBLIC_*SECRET*`, `NEXT_PUBLIC_*KEY*` nào khác**.
- [ ] Không có `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `SEPAY_*`, `*_SECRET_*`, `*_PASSWORD` nào xuất hiện trong code frontend (`apps/web/`).
- [ ] Không có ảnh chụp màn hình nào đính kèm trong PR chứa key, dashboard secret hay QR thanh toán.
- [ ] Không có họ tên / SĐT / email học viên thật nào trong code, seed hay file test commit lên (dữ liệu test dùng tên/email giả, VD `test@example.com`).
- [ ] `.gitignore` đã chặn `.env*` (trừ `.env.example`) — kiểm tra bằng `git check-ignore .env.local` (phải trả về “ignored”).
- [ ] Quét nhanh bằng lệnh (chạy ở thư mục gốc repo, trước khi commit):

```bash
# 1. Kiểm tra .gitignore chặn đúng file nhạy cảm
git check-ignore .env.local .dev.vars

# 2. Quét diff sắp commit tìm mẫu secret thường gặp
git diff --cached | grep -iE 'service_role|sk-|resend|secret|password|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' \
  && echo 'PHAT HIEN NGHI VAN — DUNG LAI, KIEM TRA NGAY' || echo 'OK: khong thay mau secret trong diff'

# 3. Quét toàn bộ file tracked tìm key bị commit nhầm từ trước
grep -rInE 'service_role|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^<]' apps/ workers/ --exclude-dir=node_modules \
  | grep -v '.env.example' || echo 'OK: khong thay service-role key trong code'
```

- [ ] Nếu phát hiện secret đã từng commit: **không chỉ xóa dòng đó rồi commit tiếp** — secret vẫn còn trong lịch sử Git. Xử lý: xoay key ngay theo §9.2, rồi xóa khỏi lịch sử Git (VD `git filter-repo` / BFG) hoặc liên hệ admin để xử lý repo; ghi biên bản sự cố.

---

## 11. Việc cần user làm

Tài liệu này ở trạng thái **“Chờ user tạo project Supabase”** — chưa có project, chưa có key thật nào. Các việc dưới đây do user thực hiện (đội ngũ không có quyền truy cập tài khoản Supabase của user, không mật khẩu, không API key).

| # | Việc cần user làm | Chi tiết |
|---|---|---|
| 1 | **Tạo 2 project Supabase** trên tài khoản Gmail `visfaracademy@gmail.com` | Project 1 đặt tên rõ ràng là Production (VD `visfar-academy-prod`), project 2 là Staging (VD `visfar-academy-staging`). Cả hai dùng gói Free. Ghi lại tên project + region đã chọn (region gần Việt Nam, VD Singapore — chốt khi tạo). |
| 2 | **Cung cấp URL + anon key của từng project** | Từ Supabase Dashboard → Project Settings → API: gửi `Project URL` và `anon public key` của project prod và project staging (2 bộ riêng). Hai giá trị này không phải secret cấp cao, có thể gửi qua kênh làm việc hiện tại. |
| 3 | **Nhập service-role key trực tiếp vào Cloudflare Workers Secrets** (không gửi qua chat) | `SUPABASE_SERVICE_ROLE_KEY` của từng project chỉ nhập trực tiếp vào dashboard Cloudflare (Workers → Settings → Variables and Secrets, đúng môi trường prod/staging). **Không gửi key này qua chat, email hay ảnh chụp.** Nếu user chưa có tài khoản Cloudflare / chưa quen thao tác, báo lại để đội ngũ hướng dẫn từng bước. |
| 4 | **Cung cấp `SUPABASE_JWT_SECRET`** của từng project | Lấy từ Supabase Dashboard → Project Settings → API → JWT Secret; nhập cùng cách như mục 3 (trực tiếp vào Workers Secrets, không gửi qua chat). |
| 5 | **Xác minh domain gửi email Resend** (DNS SPF, DKIM, DMARC) | Theo phê duyệt Task 02, quyết định 14: domain gửi Resend cần xác minh DNS trước khi gửi cho người dùng thật. User cho biết domain gửi sẽ dùng (VD domain riêng của Visfar) để đội ngũ hướng dẫn thêm bản ghi DNS; cảnh báo hệ thống gửi về `visfaracademy@gmail.com`. |
| 6 | **Xác nhận cách gắn domain API `visfaracademy.netlify.app` cho Workers** | Domain API đã chốt là `visfaracademy.netlify.app` + `/api/v1`, nhưng đây là subdomain Netlify trong khi API chạy trên Cloudflare Workers — cần user (người giữ domain) xác nhận cách gắn domain khi triển khai, đội ngũ không tự đổi domain. |
| 7 | **SePay — chưa cần làm gì ở giai đoạn này** | SePay chỉ triển khai khi có phê duyệt riêng và sau khi xác minh giá. Khi tới bước đó, user sẽ cung cấp thông tin merchant SePay; **không gửi số tài khoản ngân hàng vào tài liệu/chat** — số tài khoản chỉ dùng từ ảnh chụp / file QR do user cung cấp. |
| 8 | **Xác nhận kênh nhận cảnh báo mức Cao** | Kênh mặc định là email `visfaracademy@gmail.com`. Nếu user muốn thêm kênh dự phòng (VD Zalo) khi Resend hết quota, cho biết kênh đó. |

**Sau khi user hoàn thành mục 1–4:** đội ngũ điền giá trị thật vào Cloudflare Pages env vars / Workers Secrets (đúng môi trường), chạy kiểm tra `GET /api/health` trên staging trước rồi mới tới production, và cập nhật trạng thái file này từ “Chờ user tạo project Supabase” sang “Đã cấu hình — chờ kiểm tra `/api/health`”.
