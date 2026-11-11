# Supabase Backend — Hướng dẫn triển khai (Task 04)

**Ngày:** 10/11/2026
**Trạng thái:** Chờ user tạo project Supabase
**Phạm vi:** Task 04 — Supabase Backend Implementation, Visfar Academy
**Tài khoản Supabase:** `visfaracademy@gmail.com` (theo Quyết định Task 02 #15, `docs/DECISIONS.md`)
**Thời gian dự kiến:** 30 phút (không tính thời gian chờ email xác minh / chờ project khởi tạo)

## Đọc trước — và những gì tài liệu này KHÔNG làm

Tài liệu này chỉ là **hướng dẫn để user tự triển khai**. Người viết không có quyền truy cập tài khoản Supabase của user, không có mật khẩu, không có API key, nên:

- **KHÔNG** tự tạo project thật, **KHÔNG** chạy migration lên database thật, **KHÔNG** tạo dữ liệu học viên thật.
- **KHÔNG** ghi secret thật vào tài liệu này — chỉ ghi **tên biến** (xem §3.3). Mật khẩu database, API key và token chỉ xuất hiện trên màn hình của user và trong nơi lưu secret của user, không copy vào chat, file hay repo.
- **KHÔNG** ghi số tài khoản ngân hàng. Thông tin thanh toán (MB Bank, chủ tài khoản Công ty TNHH MTV Visfar Holdings) chỉ dùng từ ảnh chụp / file QR do user cung cấp khi cần, theo Quyết định 15.

**Căn cứ đã đọc trước khi viết:** Tài liệu kiến trúc tổng thể (`Tai-lieu-kien-truc-tong-the-Visfar-Academy.md`); 7 file kiến trúc Task 02 (`docs/architecture/`); 6 đầu ra Task 03 (`docs/database/`, đặc biệt `DATABASE_SCHEMA.md` và migration `0004`, `0005`, `0006`); toàn bộ quyết định đã chốt tại `docs/DECISIONS.md` (19 quyết định Task 01 + phê duyệt Task 02 + phê duyệt Task 03, ngày 10/11/2026).

**Quy ước trong tài liệu này:**

- Mọi con số về giá và giới hạn miễn phí đều ghi kèm **“cần xác minh lại”** — đó là snapshot tra cứu ngày 10/11/2026, nhà cung cấp có thể thay đổi. Trước khi nâng gói hoặc cam kết con số với người khác, kiểm tra lại trên trang pricing chính thức của Supabase.
- Chỗ nào là **đề xuất mới của Task 04** (chưa có trong kiến trúc Task 02 / Task 03) sẽ ghi rõ “Đề xuất Task 04 — chưa chốt trong kiến trúc”, để user quyết trước khi làm.
- Lệnh trong tài liệu là lệnh chạy trên máy của user (macOS / Windows / Linux đều dùng được nếu đã cài Node.js và Supabase CLI).

## 0. Tổng quan 30 phút

| Phút | Bước | Kết quả phải thấy |
|---|---|---|
| 0–3 | §1 — Đăng nhập Supabase bằng `visfaracademy@gmail.com` | Vào được Supabase Dashboard |
| 3–10 | §2 — Tạo 2 project: prod + staging | 2 project ở trạng thái Active, đúng tên, đúng tài khoản |
| 10–13 | §3 — Lấy URL + key của từng project, ghi vào nơi lưu secret | Đủ 2 bộ key (prod / staging), không lẫn nhau |
| 13–16 | §4 — Kiểm tra PostgreSQL (extension, pooling) | `pgcrypto` bật, kết nối được bằng SQL Editor |
| 16–24 | §5 — Chạy migration 0001–0006: staging trước, prod sau | Đủ 38 bảng, RLS bật, số dòng kiểm tra khớp (§5.4) |
| 24–27 | §6 — Cấu hình Authentication + template email tiếng Việt | Đăng ký test xác minh được email, đăng nhập được |
| 27–29 | §7 + §8 — Kiểm tra RLS, tạo Storage bucket | Không còn bảng nào tắt RLS; đủ bucket theo §8.1 |
| 29–30 | §9–§11 — Ghi nhận API / Edge Functions / cron giữ ấm + checklist cuối | Checklist §12 đánh dấu đủ |

**Thứ tự bắt buộc:** tạo project → lấy key → migration staging → kiểm tra → migration prod. Không chạy migration lên prod trước khi staging đạt. Không dùng database production cho thử nghiệm không kiểm soát (§2.3).

**Chuẩn bị trước khi bắt đầu (user chuẩn bị):**

1. Đăng nhập được vào hộp thư `visfaracademy@gmail.com` (để nhận email xác minh của Supabase và email xác minh tài khoản học viên test).
2. Một nơi lưu secret: trình quản lý mật khẩu (1Password / trình quản lý mật khẩu của trình duyệt / file ghi chú riêng tư, không phải repo code). Mật khẩu database của 2 project và các key sẽ lưu ở đây.
3. Máy đã cài Node.js (để chạy Supabase CLI qua `npx`) và Git (để lấy code migration trong repo `visfar-academy-platform`).
4. Repo đã có sẵn 3 migration Module 1 tại `supabase/migrations/` (`0001_init_schema.sql`, `0002_seed_courses.sql`, `0003_seed_content.sql`) và 3 file thiết kế Task 03 tại `docs/database/DATABASE_MIGRATIONS/` (`0004_add_task03_tables.sql`, `0005_rename_restructure.sql`, `0006_rls_task03.sql`).

---

## 1. Đăng nhập Supabase

1. Mở trình duyệt, vào **https://supabase.com**.
2. Bấm nút **Start your project** (góc trên bên phải) hoặc **Sign in** nếu đã có tài khoản.
3. Ở màn hình đăng nhập, bấm **Continue with Google** (nút có logo Google, dòng chữ “Continue with Google”).
4. Chọn đúng tài khoản **`visfaracademy@gmail.com`** trong danh sách tài khoản Google. Nếu trình duyệt đang đăng nhập bằng tài khoản Google khác, bấm “Use another account” rồi nhập `visfaracademy@gmail.com`.
5. Sau khi đăng nhập xong, màn hình chính là **Supabase Dashboard** — thanh menu bên trái có các mục: Home, Organizations, Projects (danh sách project), Billing, Account.

**Kiểm chứng:** góc trên bên phải Dashboard hiện avatar / chữ cái đầu của tài khoản `visfaracademy@gmail.com`. Nếu hiện tài khoản khác, đăng xuất rồi đăng nhập lại — **mọi project phải nằm trên tài khoản này** (Quyết định Task 02 #15), không tạo project trên tài khoản cá nhân khác.

**Lưu ý:** Supabase có thể yêu cầu xác minh email khi tạo tài khoản mới. Mở hộp thư `visfaracademy@gmail.com`, tìm email từ Supabase, bấm link xác minh rồi quay lại Dashboard.

---

## 2. Tạo 2 project: prod + staging

Supabase gói miễn phí cho **2 project đang hoạt động** (cần xác minh lại) — đúng 2 project cần dùng, **không còn project dự phòng**. Vì vậy không tạo project thứ 3 để thử nghiệm linh tinh; mọi thử nghiệm dùng project staging hoặc Supabase local (xem §2.3).

### 2.1. Project 1 — PRODUCTION (dữ liệu thật duy nhất)

1. Ở Dashboard, bấm nút **New project** (nút màu xanh lá, phía trên danh sách project).
2. Màn hình “Create a new project” hiện ra, điền như sau:
   - **Organization:** chọn organization mặc định của tài khoản `visfaracademy@gmail.com` (nếu chưa có organization, Supabase sẽ tạo một organization theo tên tài khoản — giữ nguyên, không đổi tên lúc này).
   - **Name:** nhập chính xác `visfar-academy-prod`.
   - **Database Password:** bấm **Generate a password** (nút “Generate” bên cạnh ô mật khẩu) để Supabase sinh mật khẩu mạnh, rồi bấm biểu tượng **con mắt** để hiện mật khẩu và **copy toàn bộ mật khẩu này vào nơi lưu secret** ngay lập tức, ghi chú rõ “DB password — visfar-academy-prod”. Mật khẩu này **không lấy lại được** sau khi tạo project (chỉ đặt lại được) — mất mật khẩu này thì phải reset ở Settings → Database → Reset database password.
   - **Region:** chọn **`Singapore (Southeast Asia)`** — khu vực gần Việt Nam nhất trong danh sách. *(Đề xuất Task 04 — chưa chốt trong kiến trúc. Nếu user muốn region khác, chọn trước khi bấm Create; region không đổi được sau khi project đã tạo.)*
   - **Pricing Plan:** giữ **Free** (mặc định). Không chọn Pro ở bước này — nâng gói chỉ khi chạm giới hạn và được phê duyệt riêng (Quyết định 18).
3. Bấm **Create new project**. Supabase mất khoảng 1–2 phút để khởi tạo database; màn hình hiện tiến trình “Setting up your project…”. Chờ tới khi Dashboard của project hiện ra (thanh menu bên trái có: Home, Table Editor, SQL Editor, Authentication, Storage, Edge Functions, Settings…).
4. Ghi chú lại **Project URL** và **Project ref**: vào **Settings** (biểu tượng bánh răng, cuối menu trái) → **General** → mục “Project Settings” hiện **Reference ID** (dạng `abcdefghijklm`) và **Project URL** (dạng `https://<project-ref>.supabase.co`). Đây là project **prod**.

**Kiểm chứng:** ở trang danh sách project (bấm logo Supabase / “Projects” ở menu trái), project `visfar-academy-prod` hiện trạng thái **Active** (chấm xanh), Plan **Free**.

### 2.2. Project 2 — STAGING (dữ liệu test, nơi duy nhất restore thử backup)

Lặp lại đúng các bước §2.1, chỉ khác 2 chỗ:

- **Name:** nhập chính xác `visfar-academy-staging`.
- **Database Password:** bấm **Generate a password** để sinh mật khẩu **khác** mật khẩu prod, lưu riêng với ghi chú “DB password — visfar-academy-staging”. Không dùng chung mật khẩu prod/staging.
- Region giữ **`Singapore (Southeast Asia)`** như prod (để staging giống prod nhất có thể). Plan giữ **Free**.

**Kiểm chứng:** danh sách project có đủ 2 project: `visfar-academy-prod` và `visfar-academy-staging`, cả hai đều **Active**, cùng tài khoản `visfaracademy@gmail.com`.

### 2.3. Quy tắc phân biệt prod / staging — đọc kỹ trước khi chạm vào database

| | **Prod — `visfar-academy-prod`** | **Staging — `visfar-academy-staging`** |
|---|---|---|
| Dữ liệu | **Dữ liệu thật duy nhất**: học viên thật, lead thật, đơn hàng thật | Chỉ seed + dữ liệu test; xóa và seed lại được bất cứ lúc nào |
| Dùng để | Phục vụ học viên thật | Kiểm thử trước khi lên prod; **nơi duy nhất restore thử backup hàng tháng** |
| Migration | Chỉ chạy sau khi staging đạt (§5) + đã backup prod | Chạy trước, chạy thử thoải mái |
| Thử nghiệm | **Cấm** thử nghiệm không kiểm soát, cấm test đăng ký / test thanh toán bằng dữ liệu giả | Mọi thử nghiệm làm ở đây |
| Dev local | Không trỏ máy dev vào prod | Máy dev trỏ vào staging, hoặc Supabase local qua CLI |

- **Không bao giờ dùng dữ liệu thật ở staging/dev.** Không copy database prod sang staging để “test cho giống thật” (dữ liệu học viên thật không được đem ra khỏi prod).
- **Không có project thứ 3.** Dev không có project Supabase riêng — lập trình viên dùng project staging (dữ liệu test) hoặc Supabase local qua CLI. Hết quota miễn phí (2 project — cần xác minh lại) nên không tạo thêm.
- **Nhầm key staging/prod là lỗi cấm.** Sau mỗi lần deploy / đổi key, kiểm tra bằng `GET /api/health` (xem §9.2) để chắc frontend/API đang nói chuyện với đúng project.
- Sau khi restore thử backup lên staging, seed lại dữ liệu test; không để dữ liệu backup prod lẫn trong staging lâu dài.

---

## 3. Lấy URL + key của từng project

Mỗi project có **một bộ key riêng**. Lấy key prod và key staging vào **hai mục riêng** trong nơi lưu secret, ghi rõ tên project trên từng mục. Không copy key prod vào cấu hình staging và ngược lại.

### 3.1. Vị trí lấy key (làm riêng cho từng project)

1. Ở Dashboard, bấm vào tên project (`visfar-academy-prod` trước) để vào project đó.
2. Vào **Settings** (bánh răng, cuối menu trái) → **API**.
3. Trang “API Settings” hiện các mục sau — copy từng giá trị vào nơi lưu secret:
   - **Project URL** — dạng `https://<project-ref>.supabase.co`.
   - **Project API keys — `anon` `public`** — key công khai, dùng ở frontend.
   - **Project API keys — `service_role` `secret`** — key bí mật, **chỉ server được cầm**. Bấm nút **Reveal** (con mắt) mới thấy; copy xong bấm lại để ẩn.
   - **JWT Settings — JWT Secret** — dùng để Workers xác minh JWT (qua JWKS). Nằm cùng trang API Settings, mục “JWT Settings”.
4. Vào **Settings** → **Database** → mục **Connection string** → chọn tab **URI**: copy chuỗi kết nối dạng `postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres` vào nơi lưu secret (chuỗi này chứa mật khẩu database — coi như secret). Mục này cũng hiện **Database password** (không hiện lại mật khẩu cũ — chỉ có nút reset).
5. Lặp lại bước 1–4 cho project `visfar-academy-staging`, lưu thành mục riêng.

### 3.2. Bảng key — project nào dùng key nào

| Giá trị | Prod (`visfar-academy-prod`) | Staging (`visfar-academy-staging`) |
|---|---|---|
| Project URL | URL prod | URL staging (khác ref) |
| Anon key (`public`) | Key anon prod | Key anon staging |
| Service-role key (`secret`) | Key service-role prod | Key service-role staging |
| JWT Secret | JWT Secret prod | JWT Secret staging |
| Database password | Mật khẩu DB prod (§2.1) | Mật khẩu DB staging (§2.2, khác prod) |
| Connection string (URI) | URI prod | URI staging |

### 3.3. Tên biến môi trường (chỉ tên biến — không ghi giá trị thật vào tài liệu này)

Các biến này được dùng ở frontend (Next.js, Cloudflare Pages) và Workers API. Cùng tên biến, khác giá trị theo môi trường:

| Biến | Đặt ở đâu | Ai được cầm |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cloudflare Pages env vars (frontend) + `.env.local` máy dev | Frontend — chứa URL, không phải secret nhạy cảm |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloudflare Pages env vars (frontend) + `.env.local` máy dev | Frontend — anon key được phép ở frontend vì RLS chặn (§7) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Chỉ Cloudflare Workers Secrets** (server) + GitHub Secrets (cho workflow backup/migration) | **Chỉ Workers API (server). Không bao giờ ở frontend, không bao giờ commit vào repo.** Service-role bypass RLS. |
| `SUPABASE_JWT_SECRET` | Cloudflare Workers Secrets | Workers API — xác minh JWT bằng Supabase JWKS |
| `SUPABASE_DB_URL` / `DATABASE_URL` | **Chỉ GitHub Secrets** (backup/migration) | GitHub Actions — `pg_dump` / restore; không dùng trong code chạy production |
| `SUPABASE_ACCESS_TOKEN` | GitHub Secrets / máy vận hành | Supabase CLI — backup / migration, nếu cần |

**Quy tắc secret (kiến trúc §6.1/§6.3):** không commit `.env`, không dán key vào chat/ticket, không chụp màn hình có key. `.env.example` trong repo chỉ chứa tên biến + giá trị mẫu giả, ví dụ `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY=<chi-duoc-dat-tren-server>`. Xoay key khi có người rời đội (Settings → API → “Generate new keys” — thao tác này làm key cũ hết hiệu lực ngay, phải cập nhật lại Workers/Pages cùng lúc).

**Kiểm chứng:** sau khi lưu xong, đối chiếu 2 mục trong nơi lưu secret — URL prod và URL staging phải khác nhau ở phần `<project-ref>`; anon key prod và anon key staging phải khác nhau. Nếu giống nhau là đã copy nhầm.

---

## 4. Cấu hình PostgreSQL

### 4.1. Kiểm tra phiên bản và extension (làm cho cả 2 project)

1. Trong project, vào **SQL Editor** (menu trái, biểu tượng `</>` / “SQL Editor”) → bấm **New query**.
2. Dán và bấm **Run** (nút “Run” góc dưới bên phải khung SQL, hoặc `Ctrl/Cmd + Enter`):

```sql
select version();
```

3. Mở query mới, chạy tiếp:

```sql
create extension if not exists "pgcrypto";
select extname, extversion from pg_extension where extname = 'pgcrypto';
```

`pgcrypto` là extension migration `0004` yêu cầu (hàm `gen_random_uuid()` dùng cho mọi `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`). Lệnh `create extension` ở trên đã có sẵn trong đầu file `0004`, nhưng chạy kiểm tra trước để chắc quyền tạo extension hoạt động.

**Kiểm chứng:** câu `select version()` trả 1 dòng hiện phiên bản PostgreSQL; câu kiểm tra extension trả 1 dòng `pgcrypto` (có `extversion`). Nếu báo lỗi quyền, dừng lại — không chạy migration khi extension chưa bật được.

### 4.2. Connection pooling — Supavisor (mặc định của Supabase)

- Supabase dùng **Supavisor** làm connection pooler. Khi copy connection string ở §3.1 bước 4, trang Settings → Database hiện 2 chế độ: **Session mode** (cổng 5432) và **Transaction mode** (cổng 6543).
- **Quy tắc:** `pg_dump` / restore / chạy migration bằng CLI dùng **Session mode (cổng 5432)**. Code ứng dụng (Workers API) dùng Transaction mode (cổng 6543) khi có nhiều kết nối đồng thời. Không dùng nhầm Transaction mode cho `pg_dump` (dễ lỗi giữa chừng).
- Không cần bật/tắt gì thêm ở bước này — Supavisor đã bật mặc định trên project mới. *(Nếu giao diện Supabase tại thời điểm user làm khác với mô tả — tên tab, vị trí nút đổi — thì làm theo tên mục tương đương trên màn hình và ghi chú lại chỗ khác để cập nhật tài liệu.)*

### 4.3. Những gì KHÔNG đổi ở bước này

- **Timezone:** Supabase lưu `timestamptz` theo UTC; ứng dụng hiển thị theo giờ Việt Nam (`Asia/Ho_Chi_Minh`) ở tầng frontend/API. Không đổi timezone của database.
- **Không bật Realtime cho bảng nào** ở bước này. Kiến trúc chỉ dùng Realtime ít / dự phòng; luồng chính không phụ thuộc Realtime. Khi nào module nào cần Realtime thật thì bật riêng cho bảng đó (Database → Replication) và ghi vào quyết định.
- **Không tạo Database Webhook** ở bước này. Luồng email / automation đi qua Workers API + Resend, không đi qua webhook của Supabase.

---

## 5. Chạy migration 0001–0006 (staging trước, prod sau)

### 5.1. Chuẩn bị file migration trong repo

Repo `visfar-academy-platform` đã có:

- `supabase/migrations/0001_init_schema.sql` — schema Module 1 (bảng `profiles`, `courses`, `modules`, `lessons`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `orders`, `events`, `audit_logs`…, hàm `public.current_role()`, trigger tạo `profiles` khi có `auth.users` mới).
- `supabase/migrations/0002_seed_courses.sql` — seed 10 khóa học, giữ nguyên thứ tự 01–10.
- `supabase/migrations/0003_seed_content.sql` — seed nội dung (triết lý, lĩnh vực, chính sách).
- `docs/database/DATABASE_MIGRATIONS/0004_add_task03_tables.sql` — 20 bảng mới Task 03 (chỉ tạo bảng + index, **không** tạo policy).
- `docs/database/DATABASE_MIGRATIONS/0005_rename_restructure.sql` — đổi tên / gộp bảng giữ dữ liệu (Phương án A: rename bảng cũ giữ dữ liệu; `modules → course_modules`, `quiz_questions → questions`; tách lớp `quizzes`; backfill `answers`, `order_items`, `user_roles`).
- `docs/database/DATABASE_MIGRATIONS/0006_rls_task03.sql` — RLS cho bảng mới (48 lệnh `create policy`).

**Bước chuẩn bị (trên máy user, trong thư mục repo):** copy 3 file Task 03 vào thư mục migration chuẩn của repo — không sửa nội dung file, chỉ copy:

```bash
cp docs/database/DATABASE_MIGRATIONS/0004_add_task03_tables.sql supabase/migrations/0004_add_task03_tables.sql
cp docs/database/DATABASE_MIGRATIONS/0005_rename_restructure.sql supabase/migrations/0005_rename_restructure.sql
cp docs/database/DATABASE_MIGRATIONS/0006_rls_task03.sql supabase/migrations/0006_rls_task03.sql
ls supabase/migrations/
```

**Kiểm chứng:** `ls` hiện đủ 6 file `0001` → `0006` theo đúng thứ tự số.

**Lưu ý về trạng thái phê duyệt:** đầu mỗi file 0004–0006 ghi “THIẾT KẾ — CHƯA ÁP DỤNG, CHỜ PHÊ DUYỆT”. Các **quyết định Task 03** đã được user phê duyệt ngày 10/11/2026 20:18 (`docs/DECISIONS.md`, mục “Phê duyệt Task 03”, nguyên tắc “lựa chọn sao cho hiện đại nhất, tinh tế và thuận tiện nhất”). Dù vậy, quy trình bắt buộc vẫn là **chạy staging trước, đối chiếu kiểm tra cuối file 0005, rồi mới chạy prod** (§5.3–§5.5). Nếu khi chạy staging phát hiện lỗi, dừng lại, không chạy prod để “sửa sau”.

**Thứ tự bắt buộc: 0004 → 0005 → 0006.** Không chạy 0006 trước 0005 (Quyết định Task 03 #14). File 0005 có khối guard ở Mục 0: nếu 0004 chưa chạy, hoặc bảng mới `course_modules` / `questions` đã có dữ liệu, toàn bộ transaction dừng lại — đó là hành vi đúng, không phải lỗi cần vượt qua.

### 5.2. Cài Supabase CLI và liên kết project

Chạy trên máy user (terminal, tại thư mục repo):

```bash
# Kiểm tra / cài Supabase CLI (dùng npx, không cần cài global)
npx supabase --version

# Đăng nhập CLI bằng trình duyệt (mở link, chọn tài khoản visfaracademy@gmail.com)
npx supabase login

# Liên kết repo với project STAGING trước (lấy <project-ref> ở Settings → General, §2.1 bước 4)
npx supabase link --project-ref <project-ref-staging>

# Xem trạng thái migration: file local nào chưa chạy lên project đã link
npx supabase migration list
```

**Kiểm chứng:** `migration list` hiện 6 migration local (`0001` → `0006`) ở trạng thái chưa áp dụng (hoặc `0001`–`0003` đã áp dụng nếu project đã từng chạy Module 1 — khi đó chỉ `0004`–`0006` hiện chưa áp dụng, vẫn đúng).

### 5.3. Chạy migration lên STAGING

```bash
# Đang link staging (kiểm tra lại bằng: npx supabase link --project-ref <project-ref-staging>)
npx supabase db push
```

Lệnh này chạy các migration local chưa áp dụng, theo đúng thứ tự số. Nếu CLI hỏi xác nhận, gõ `y`.

**Nếu `db push` báo lỗi ở 0005:** đọc thông báo lỗi — thường là guard Mục 0 (0004 chưa chạy / bảng mới đã có dữ liệu). Không sửa file 0005 để “vượt guard”. Xử lý đúng là: kiểm tra xem 0004 đã chạy chưa (`npx supabase migration list`), kiểm tra dữ liệu trong `course_modules` / `questions`, đối soát tay rồi chạy lại.

### 5.4. Kiểm tra sau khi chạy staging — bắt buộc, làm trong SQL Editor của project staging

Mở **SQL Editor** của project `visfar-academy-staging`, chạy từng câu sau và đối chiếu kết quả:

```sql
-- 1. Đủ 38 bảng vật lý (31 bảng Task 03 + course_instructors + question_options
--    + 5 bảng Module 1: events, event_registrations, posts, policies,
--    newsletter_subscribers) — Quyết định Task 03 #1: 38 bảng, không bỏ bảng nào.
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';
-- Kỳ vọng: 38

-- 2. Seed khóa học: đúng 10 khóa, đúng thứ tự 01–10.
select display_order, slug, title from public.courses order by display_order;
-- Kỳ vọng: 10 dòng; dòng 1 là thau-hieu-noi-tam / "Thấu Hiểu Nội Tâm"
-- (đã đổi tên từ "Thấu Hiểu Bản Thân" ngày 10/11/2026).

-- 3. Kiểm tra cuối file 0005 (số dòng trước/sau phải bằng nhau):
select count(*) from public.course_modules;   -- = số dòng modules cũ
select count(*) from public.questions;        -- = số dòng quiz_questions cũ
select count(*) from public.questions where quiz_id is null;  -- = 0
select count(*) from public.lessons;          -- không đổi so với trước khi chạy
select count(*) from public.quiz_attempts;    -- không đổi
select count(*) from public.orders;           -- không đổi
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('modules', 'quiz_questions');
-- Kỳ vọng: 0 dòng (nếu không tạo VIEW tên cũ ở Mục 7 của file 0005).
```

**Kiểm chứng đạt khi:** đủ 4 điều — (a) 38 bảng, (b) 10 khóa đúng thứ tự, (c) 6 câu kiểm tra file 0005 đều khớp, (d) không có thông báo lỗi nào trong log của `db push`. Nếu bất kỳ điều nào lệch: **dừng, không chạy prod**. Ghi lại kết quả lệch và xử lý trên staging (thêm migration mới sửa — không sửa file migration cũ).

### 5.5. Backup prod, rồi chạy migration lên PROD

Chỉ làm bước này khi §5.4 đã đạt trên staging.

**Bước 5.5a — Backup prod trước (bắt buộc):**

```bash
# Lấy connection string Session mode (cổng 5432) của PROD ở Settings → Database (§3.1 bước 4)
# rồi dump (đặt mật khẩu qua biến môi trường, không gõ mật khẩu lên dòng lệnh):
npx supabase db dump -f backup-prod-2026-11-10-before-0004-0006.sql --db-url "$SUPABASE_DB_URL"
ls -lh backup-prod-2026-11-10-before-0004-0006.sql
```

Tên file backup ghi theo ngày + lý do (`before-0004-0006`). **Kiểm chứng:** file backup có dung lượng > 0 byte. File backup 0 byte = chưa có backup — không chạy prod. Lưu file backup vào repo backup riêng (private) và/hoặc Cloudflare R2 theo quy trình backup ở `DEPLOYMENT_ARCHITECTURE.md` §6 (backup hàng ngày bằng GitHub Actions sẽ được dựng ở Task triển khai CI/CD — ở bước này chỉ cần bản backup tay trước migration).

**Bước 5.5b — Đổi link sang prod rồi chạy:**

```bash
npx supabase link --project-ref <project-ref-prod>
npx supabase migration list
npx supabase db push
```

**Bước 5.5c — Kiểm tra lại trên prod:** lặp lại toàn bộ câu kiểm tra §5.4 trong SQL Editor của project **prod** (38 bảng, 10 khóa, 6 câu kiểm tra file 0005). Đối chiếu số dòng các bảng chính (`courses` = 10, `policies` = 4, `leads`, `profiles`, `orders`, `enrollments`) với staging và với backup trước khi chạy.

**Quy tắc rollback:** `git revert` chỉ quay lại code, không quay lại database. Migration đã chạy không tự quay lại — sai thì thêm migration mới sửa lại, không sửa file migration cũ. Trường hợp xấu nhất (migration lỗi trên prod): restore database từ file backup §5.5a, hoặc migration mới khắc phục — quyết theo mức độ, ghi biên bản. Riêng file 0005 có sẵn hướng dẫn rollback ở Mục 8 cuối file — chỉ dùng khi **chưa có dữ liệu mới** ghi vào tên mới; nếu đã có dữ liệu mới thì phải backfill ngược trước, cần kế hoạch rollback riêng.

### 5.6. Việc CHƯA có trong 0004–0006 — không tự thêm ở bước này

- **Đổi tên `answers` → `quiz_answers`** (Quyết định Task 03 #2: đáp án đúng giữ ở `question_options`; `quiz_answers.is_correct` là kết quả chấm ở server; UNIQUE `(attempt_id, question_id, option_id)` cho multiple-choice): file 0004 vẫn tạo bảng tên `answers`, file 0005 vẫn backfill vào `answers`. Việc đổi tên này **chưa có trong 3 file** — cần **migration mới riêng (0007)** ở Task tiếp theo, không tự sửa 0004/0005 trong bước setup này.
- **Cột `orders.receipt_url`** (biên lai học viên upload — `DATA_DICTIONARY.md` §2.20: Storage private, chỉ admin đọc): chưa có trong migration 0004–0006. Cần migration mới riêng khi triển khai upload biên lai (§8.1).
- **Cột `certificates.pdf_url`** (file PDF chứng chỉ — `DATA_DICTIONARY.md`): chưa có trong migration 0004–0006. Cần migration mới riêng khi triển khai chứng chỉ PDF (§8.1).
- **7 key `system_settings` khởi tạo** (Quyết định Task 03 #11: hoàn trả 15 ngày làm việc, khiếu nại phản hồi 3 ngày, SePay, MB Bank — không lưu số tài khoản): seed bằng migration/seed riêng ở Task tiếp theo, không chèn tay vào prod ở bước này.

---

## 6. Cấu hình Authentication (Supabase Auth)

Nguồn JWT duy nhất của toàn hệ thống là Supabase Auth (đăng ký / đăng nhập / quên mật khẩu qua Supabase, không tự viết hệ thống auth riêng). Workers xác minh JWT bằng Supabase JWKS, kèm kiểm tra `iss`, `aud`, `exp` — không tin JWT do client tự khai.

### 6.1. Bật provider Email, tắt provider chưa dùng (làm cho cả 2 project)

1. Trong project, vào **Authentication** (menu trái) → **Providers**.
2. Tìm mục **Email**: bấm để mở, đảm bảo công tắc **Enable Email provider** đang **BẬT**.
   - **Allow new users to sign up:** BẬT (học viên tự đăng ký).
   - **Confirm email:** **BẬT** (xem §6.2 — bắt buộc, để chắc email học viên là thật trước khi ghi danh / mua khóa).
   - **Secure email change:** BẬT (đổi email phải xác minh email mới).
3. Các provider khác (**Google, Facebook, GitHub, Apple…**): giữ **TẮT** ở giai đoạn này. Kiến trúc chốt đăng ký/đăng nhập bằng email + mật khẩu; thêm đăng nhập mạng xã hội là quyết định riêng, không bật chỉ vì “có sẵn”.
4. **Magic Link / OTP qua email:** giữ **TẮT** ở giai đoạn này (chỉ dùng email + mật khẩu + link xác minh / đặt lại mật khẩu). Nếu sau này bật, ghi quyết định riêng.

**Kiểm chứng:** trang Providers chỉ có Email đang bật; các provider khác hiện “Disabled”.

### 6.2. Xác minh email — bắt buộc

1. Vào **Authentication** → **Providers** → **Email** (như §6.1): xác nhận **Confirm email** đang BẬT.
2. Vào **Authentication** → **URL Configuration** (mục “URL Configuration” trong trang Authentication):
   - **Site URL:** nhập URL production của frontend. Ở giai đoạn dev/staging, tạm nhập URL preview Cloudflare Pages (dạng `https://<ten-preview>.pages.dev`) — domain production chính thức (`visfaracademy.vn` / `api.visfaracademy.vn`) **chưa được phê duyệt** nên chưa điền domain đó vào đây. *(Khi domain production được phê duyệt, quay lại đây đổi Site URL thành domain chính, rồi kiểm tra lại toàn bộ link email.)*
   - **Redirect URLs:** bấm **Add URL** và thêm từng URL sau (mỗi URL một dòng — Supabase chỉ cho redirect về URL có trong danh sách này):
     - `http://localhost:3000/**` (dev local — Next.js dev server)
     - `https://<ten-preview>.pages.dev/**` (preview Cloudflare Pages — thay `<ten-preview>` bằng tên preview thật)
     - URL production khi có domain chính thức (thêm sau khi domain được phê duyệt)
   - Không thêm URL lạ / domain không thuộc Visfar vào danh sách này — link xác minh email có thể bị lợi dụng để redirect ra ngoài.
3. Kiểm tra bằng tài khoản test trên **staging**: đăng ký một tài khoản bằng email test (email thật mà user kiểm soát được, ví dụ chính `visfaracademy@gmail.com` hoặc một email test riêng), mở hộp thư, bấm link xác minh trong email. Sau đó đăng nhập bằng tài khoản đó.

**Kiểm chứng:** sau khi bấm link xác minh, vào **Authentication** → **Users** thấy tài khoản test có cột **Email Confirmed** hiện đã xác minh (ngày/giờ xác minh), và đăng nhập thành công. Đồng thời bảng `public.profiles` có 1 dòng tương ứng (trigger `handle_new_user` ở `0001` tự tạo profile, `role` mặc định `'student'`) — kiểm tra bằng SQL Editor:

```sql
select id, full_name, email, role from public.profiles order by created_at desc limit 5;
```

### 6.3. Giới hạn đăng nhập / mật khẩu

- **Rate-limit đăng nhập (10 lần/15 phút/IP)** áp ở tầng API/edge trước Supabase Auth (theo `SECURITY_MODEL.md` §2) — không cấu hình trong Dashboard Supabase ở bước này; cấu hình ở Workers API khi dựng API.
- **Chính sách mật khẩu:** vào **Authentication** → **Policies** (hoặc **Providers** → **Email** → mục password, tùy giao diện Supabase tại thời điểm làm): giữ mặc định của Supabase (tối thiểu 6 ký tự — cần xác minh lại giá trị mặc định trên màn hình lúc làm). Không nới lỏng chính sách mật khẩu.
- **JWT expiry:** giữ mặc định của Supabase (3600 giây = 1 giờ — cần xác minh lại trên màn hình lúc làm). Client dùng refresh token để lấy JWT mới; API trả `401` khi JWT hết hạn, không tự gia hạn.
- **Không role nào tự nâng cấp role của chính mình.** Chỉ admin cấp/thu hồi role qua API admin, ghi `audit_logs`. Nguồn sự thật về role là bảng `user_roles` (Quyết định Task 03 #3); `profiles.role` là cache đọc nhanh, đồng bộ bằng trigger từ `user_roles` (trigger này do migration 0005 tạo — kiểm tra sau khi chạy 0005).

### 6.4. Template email tiếng Việt (Supabase Auth)

Email xác minh / đặt lại mật khẩu của Supabase Auth là email hệ thống — soạn bằng tiếng Việt, giọng tự nhiên, ít emoji, không thúc ép / FOMO mạnh (theo chuẩn giọng văn của Visfar Academy). Vị trí: **Authentication** → **Email Templates** (menu trái trong trang Authentication). Bấm vào từng template để sửa, bấm **Save** sau mỗi template.

**Lưu ý về biến trong template:** Supabase dùng biến dạng `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`. **Không xóa các biến này** khỏi template — xóa link xác minh thì học viên không xác minh được. Nếu giao diện Supabase tại thời điểm làm dùng tên biến khác, giữ nguyên biến gốc trên màn hình, chỉ sửa phần chữ xung quanh.

**Template 1 — Confirm signup (Xác nhận đăng ký tài khoản):**

- **Subject:** `Xác nhận đăng ký tài khoản Visfar Academy`
- **Body (gợi ý, sửa trực tiếp trên màn hình template):**

```text
Chào bạn,

Cảm ơn bạn đã đăng ký tài khoản tại Visfar Academy.
Vui lòng bấm vào liên kết dưới đây để xác nhận email của bạn:

{{ .ConfirmationURL }}

Liên kết này chỉ dùng cho lần đăng ký này. Nếu bạn không đăng ký tài khoản
tại Visfar Academy, bạn có thể bỏ qua email này.

Trân trọng,
Visfar Academy
```

**Template 2 — Reset password (Đặt lại mật khẩu):**

- **Subject:** `Đặt lại mật khẩu Visfar Academy`
- **Body (gợi ý):**

```text
Chào bạn,

Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Visfar Academy.
Vui lòng bấm vào liên kết dưới đây để đặt mật khẩu mới:

{{ .ConfirmationURL }}

Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.
Mật khẩu hiện tại của bạn vẫn giữ nguyên cho tới khi bạn đặt mật khẩu mới.

Trân trọng,
Visfar Academy
```

**Template 3 — Change email address (Đổi địa chỉ email):**

- **Subject:** `Xác nhận đổi địa chỉ email Visfar Academy`
- **Body (gợi ý):** giữ nguyên biến `{{ .ConfirmationURL }}` của template gốc, sửa phần chữ thành: “Bạn vừa yêu cầu đổi địa chỉ email cho tài khoản Visfar Academy. Vui lòng bấm vào liên kết dưới đây để xác nhận địa chỉ email mới: {{ .ConfirmationURL }}. Nếu bạn không yêu cầu đổi email, bạn có thể bỏ qua email này.”

**Template 4 — Magic Link:** không dùng ở giai đoạn này (§6.1) — không cần sửa template này. Nếu sau này bật Magic Link thì soạn lại bằng tiếng Việt theo cùng giọng văn.

**Kiểm chứng:** sau khi lưu 4 template, làm lại bước đăng ký test ở §6.2 — email xác minh nhận được phải là **tiếng Việt** theo template mới, link xác minh bấm được, không còn chữ tiếng Anh mặc định của Supabase.

### 6.5. SMTP — gửi email Auth bằng gì?

- **Staging + giai đoạn đầu:** dùng **SMTP mặc định của Supabase** (không cấu hình gì thêm). Đủ để test xác minh email / đặt lại mật khẩu. Giới hạn gửi của SMTP mặc định thấp — chỉ dùng cho test, không dùng cho email hàng loạt.
- **Production (khi gửi cho học viên thật):** cấu hình **Custom SMTP** trỏ về Resend, tại **Authentication** → **SMTP Settings** (bật “Enable Custom SMTP”): Host / Port / Username / Password lấy theo tài liệu Resend tại thời điểm cấu hình — **cần xác minh lại** tên host, cổng và cách lấy mật khẩu SMTP trên trang tài liệu chính thức của Resend lúc làm, không ghi cứng vào tài liệu này. Mật khẩu SMTP (Resend API key) chỉ nhập trên màn hình Settings, lưu vào nơi lưu secret với tên biến `RESEND_API_KEY` — không ghi giá trị thật vào đây.
- **Domain gửi:** email Auth gửi từ domain riêng của Visfar **chỉ sau khi đã xác minh DNS SPF/DKIM/DMARC** (Quyết định Task 02 #14). Không gửi email cho học viên thật từ địa chỉ mặc định của Supabase/Resend (`onboarding@resend.dev` — địa chỉ này chỉ gửi được tới email của chính tài khoản Resend). Email giao dịch chính (E1–E13: chào mừng, đơn hàng, nhắc thanh toán…) gửi qua **Workers API gọi Resend**, không qua Supabase Auth SMTP — SMTP ở mục này chỉ phục vụ email xác minh / đặt lại mật khẩu của Supabase Auth.
- **Kênh cảnh báo hệ thống:** gửi về `visfaracademy@gmail.com` (Quyết định Task 02 #14).

**Kiểm chứng:** sau khi cấu hình Custom SMTP (prod), gửi lại 1 email đặt lại mật khẩu test — kiểm tra header email nhận được: địa chỉ người gửi là domain riêng của Visfar (không phải domain mặc định của Supabase/Resend).

---

## 7. Cấu hình RLS (Row Level Security)

**Nguyên tắc (kiến trúc §6.1):** bật RLS trên mọi bảng, mặc định từ chối. Không có policy nào cho phép thì không đọc/ghi được gì. Anon key chỉ đọc nội dung công khai; service-role key chỉ ở Workers API.

RLS đã được tạo bởi migration `0001` (bảng Module 1) và `0006` (20 bảng mới Task 03 — 48 lệnh `create policy`). Bước này **không viết policy mới** — chỉ kiểm tra và kiểm tra bằng tài khoản thật.

### 7.1. Kiểm tra RLS đã bật trên mọi bảng

Chạy trong SQL Editor (làm cho cả prod và staging):

```sql
-- Mọi bảng public đều phải có rowsecurity = true. Kỳ vọng: 0 dòng.
select tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;

-- Đếm policy theo bảng (đối chiếu nhanh với RLS_POLICIES.md).
select tablename, count(*) as so_policy
from pg_policies where schemaname = 'public'
group by tablename order by tablename;
```

**Kiểm chứng:** câu đầu trả 0 dòng (không bảng nào tắt RLS). Nếu có bảng nào hiện ra, dừng lại — bật RLS cho bảng đó (`alter table public.<ten_bang> enable row level security;`) rồi kiểm tra lại, và ghi chú bảng đó vào biên bản để Task sau rà soát policy tương ứng.

### 7.2. Kiểm tra các policy cấm — không có là đúng

Chạy trong SQL Editor (các câu này đã có sẵn ở cuối file `0006`, chạy lại ở đây để xác nhận sau khi migration xong):

```sql
-- 1. Không có policy INSERT/UPDATE/DELETE cho anon trên leads/orders/payments.
--    Lead/đơn/payment chỉ tạo qua Workers API bằng service-role. Kỳ vọng: 0 dòng.
select policyname, tablename, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('leads', 'orders', 'payments')
  and cmd in ('INSERT', 'UPDATE', 'DELETE')
  and roles::text like '%anon%';

-- 2. Không có policy SELECT nào mở bảng quiz_options (chứa đáp án đúng)
--    cho mọi authenticated user. Học viên chỉ đọc VIEW quiz_options_public
--    (không có cột is_correct). Kỳ vọng: chỉ 2 policy —
--    "quiz_options_admin_all" và "quiz_options_instructor_read".
select policyname, tablename, cmd from pg_policies
where schemaname = 'public' and tablename = 'quiz_options' and cmd = 'SELECT';
```

**Kiểm chứng:** câu 1 trả 0 dòng; câu 2 trả đúng 2 policy kể trên. Nếu câu 1 có dòng nào, **xóa policy đó ngay** (`drop policy <ten_policy> on public.<ten_bang>;`) — đó là lỗ hổng cho phép client ghi trực tiếp vào bảng nhạy cảm.

### 7.3. Kiểm tra bằng tài khoản thật trên staging (bắt buộc trước khi mở prod)

Dùng 2 tài khoản test trên **staging** (tạo theo §6.2, một tài khoản để role mặc định `student`, một tài khoản được admin gán role `instructor` cho 1 khóa test qua bảng `course_instructors`):

1. Đăng nhập bằng tài khoản **student** trên trang học viên staging, kiểm tra: chỉ thấy enrollment / tiến độ / đơn / chứng chỉ **của chính mình**; không đọc được lead, đơn, payment của người khác; không đọc được đáp án đúng quiz (chỉ thấy câu hỏi + lựa chọn, không thấy `is_correct`); không insert được vào `leads` / `orders` / `payments` bằng Supabase client trực tiếp (phải báo lỗi RLS).
2. Đăng nhập bằng tài khoản **instructor**, kiểm tra: chỉ thấy học viên, tiến độ, bài nộp của **khóa được giao**; xem được đáp án đúng quiz của khóa đó; **không** xem được lead, **không** xem được đơn/payment (trừ đơn của chính mình), **không** đổi được giá khóa (`courses.price_vnd`), **không** cấp/thu hồi role.
3. Đăng nhập bằng tài khoản **admin**, kiểm tra: đọc được mọi bảng, đổi được trạng thái lead/đơn, mọi thao tác ghi đều sinh `audit_logs`.

**Kiểm chứng:** ghi lại kết quả 3 tài khoản vào biên bản test (đạt / không đạt từng dòng). Bất kỳ dòng nào không đạt thì dừng mở prod — sửa policy bằng migration mới rồi kiểm tra lại trên staging.

### 7.4. Lưu ý về nguồn sự thật của role

- RLS và API đều đọc role từ **`user_roles`** (Quyết định Task 03 #3 — nguồn duy nhất). `profiles.role` giữ làm cache đọc nhanh, đồng bộ bằng trigger từ `user_roles`.
- Hàm phụ `public.current_role()` (ở `0001`, đọc từ `profiles.role`) và `public.is_instructor_of(p_course_id)` / `public.course_of_lesson(p_lesson_id)` (ở `0006`, `SECURITY DEFINER`) là hàm RLS policy dùng để kiểm tra quyền — không xóa, không sửa chữ ký của các hàm này khi chưa có migration mới.
- File `0006` ghi chú: để chạy lại file này trên staging, thêm `drop policy if exists <ten_policy> on public.<bang>;` trước mỗi `create policy` (tên policy đã cố định trong file).

---

## 8. Cấu hình Storage

### 8.1. Bảng bucket — bucket nào chứa gì

Kiến trúc chia bucket theo quyền: `public` (đọc công khai) / `private` (chỉ lấy bằng signed URL, hết hạn sau 1 giờ). Task 04 tách thêm bucket riêng theo **độ nhạy cảm**, để một policy sai ở bucket này không làm lộ file ở bucket khác (đặc biệt là biên lai chuyển khoản). Các bucket `avatars`, `receipts`, `certificates` là **đề xuất Task 04 — chưa chốt trong kiến trúc** (kiến trúc chỉ nêu tên 2 bucket `public` / `private`); user xác nhận bảng này trước khi tạo bucket.

| Bucket | Public / Private | Chứa gì | Đường dẫn / cột trỏ tới | Ai đọc | Ai ghi |
|---|---|---|---|---|---|
| `public` | **Public** | Poster khóa học, ảnh sự kiện, ảnh bìa blog, logo | `courses.poster_url`, `events.image_url`, `posts.cover_url` | Mọi người (kể cả chưa đăng nhập) | Chỉ admin (qua Workers / Dashboard) |
| `avatars` | **Public** | Ảnh đại diện học viên | `profiles.avatar_url` | Mọi người (khi hiển thị trên trang) | Chính chủ, chỉ trong thư mục của mình (`<user_id>/…`) |
| `private` | **Private** | **Tài liệu học** (`lesson_resources.file_url`) + **bài nộp tự luận** (`submissions.file_url`) | `lesson_resources.file_url`, `submissions.file_url` | Học viên đã ghi danh (tài liệu) / chính chủ + giảng viên khóa phụ trách + admin (bài nộp) — qua **signed URL, hết hạn sau 1 giờ** | Admin / giảng viên khóa phụ trách (tài liệu, qua Workers); chính chủ (bài nộp, qua Workers) |
| `receipts` | **Private** | **Biên lai chuyển khoản** học viên upload | `orders.receipt_url` (cột mới đề xuất, chưa có trong migration — xem §5.6) | **Chỉ admin** (qua Workers / Dashboard) | Học viên upload **qua Workers API** (service-role), không có policy ghi trực tiếp cho client |
| `certificates` | **Private** | File PDF chứng chỉ hoàn thành | `certificates.pdf_url` (cột mới đề xuất, chưa có trong migration — xem §5.6) | Chính chủ + admin — qua signed URL | Chỉ Workers (service-role) khi cấp chứng chỉ |

**Không dùng Supabase Storage cho video.** Video bài giảng đăng YouTube ở chế độ không công khai (unlisted), `video_url` lưu trong `lessons.video_url` (Quyết định 16 — chấp nhận đánh đổi: ai có link đều xem được, không chống tải). Storage 1 GB không đủ chứa video (giới hạn miễn phí — cần xác minh lại).

**Giới hạn file đề xuất khi tạo bucket** (cấu hình của dự án, không phải giới hạn của nhà cung cấp — điền vào ô “File size limit” và “Allowed MIME types” khi tạo bucket trên Dashboard; nếu để trống thì dùng mặc định của Supabase):

| Bucket | File size limit (đề xuất) | MIME types cho phép (đề xuất) |
|---|---|---|
| `public` | 5 MB | `image/jpeg`, `image/png`, `image/webp` |
| `avatars` | 2 MB | `image/jpeg`, `image/png`, `image/webp` |
| `private` | 10 MB | `application/pdf`, `image/jpeg`, `image/png` |
| `receipts` | 5 MB | `image/jpeg`, `image/png`, `application/pdf` |
| `certificates` | 5 MB | `application/pdf` |

### 8.2. Tạo bucket (làm cho cả 2 project — tạo đủ 5 bucket ở cả prod và staging)

1. Trong project, vào **Storage** (menu trái, biểu tượng thùng / “Storage”).
2. Bấm **New bucket** (nút phía trên danh sách bucket).
3. Điền **Name** đúng tên bucket ở §8.1 (ví dụ `public`), chọn **Public bucket** = BẬT nếu bucket Public, = TẮT nếu bucket Private (màn hình hiện công tắc “Public bucket” kèm dòng giải thích “Anyone can access files in a public bucket” — kiểm tra kỹ công tắc này trước khi bấm Create; tạo nhầm public/private thì phải xóa bucket làm lại).
4. Điền **File size limit** và **Allowed MIME types** theo bảng §8.1 (nếu màn hình có các ô này; nếu không có thì cấu hình sau bằng policy/SQL).
5. Bấm **Create bucket**. Lặp lại cho 4 bucket còn lại.

**Kiểm chứng:** trang Storage hiện đủ 5 bucket, đúng tên, đúng cột Public/Private (`public` và `avatars` hiện “Public”, `private`, `receipts`, `certificates` hiện “Private”).

### 8.3. Storage policy (RLS cho file)

Supabase Storage cũng dùng RLS trên bảng `storage.objects` — tạo bucket chưa đủ, phải có policy thì file mới được đọc/ghi đúng người. Tạo policy trong **SQL Editor** (chạy cho cả 2 project):

```sql
-- 1. Bucket public: ai cũng đọc được (kể cả chưa đăng nhập).
create policy "public_bucket_read" on storage.objects
for select using (bucket_id = 'public');

-- 2. Bucket avatars: ai cũng đọc được; chỉ chính chủ được ghi vào thư mục của mình.
create policy "avatars_read" on storage.objects
for select using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
for insert with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_update_own" on storage.objects
for update using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_delete_own" on storage.objects
for delete using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Bucket private / receipts / certificates: KHÔNG tạo policy SELECT/INSERT
--    cho anon/authenticated. File chỉ lấy qua signed URL do Workers API cấp
--    (service-role bypass RLS) sau khi API kiểm tra enrollment / quyền sở hữu.
--    Nếu kiểm tra thấy có policy nào mở 3 bucket này cho client, xóa ngay.
```

**Lưu ý:**

- Tên file upload phải đặt theo quy tắc: `avatars/<user_id>/<ten-file>`, `private/lessons/<lesson_id>/<ten-file>`, `private/submissions/<submission_id>/<ten-file>`, `receipts/<order_id>/<ten-file>`, `certificates/<certificate_code>.pdf`. Quy tắc này do Workers API áp khi upload (kiểm tra ở server), policy RLS ở trên chỉ là lớp chặn cuối cho bucket `avatars`.
- **Ảnh đại diện hiển thị công khai:** `DATA_DICTIONARY.md` ghi “Đọc: chính mình + admin (+ công khai nếu hiển thị trên trang chia sẻ — chờ chốt)”. Bảng §8.1 đang để `avatars` là Public theo đề xuất Task 04. Nếu user quyết **không** hiển thị avatar công khai thì đổi `avatars` thành Private và chỉ cấp signed URL khi cần — quyết trước khi học viên upload ảnh thật.
- **Kiểm chứng:** upload 1 file test vào từng bucket trên staging (qua Dashboard: vào bucket → **Upload**), rồi kiểm tra: file ở `public`/`avatars` mở được bằng link công khai khi chưa đăng nhập; file ở `private`/`receipts`/`certificates` **không** mở được bằng link trực tiếp khi chưa đăng nhập (phải báo lỗi). Xóa file test sau khi kiểm tra xong.

---

## 9. Cấu hình API (phía Supabase)

### 9.1. Frontend đọc Supabase trực tiếp — chỉ nội dung công khai

- Nội dung công khai (khóa học, bài viết, sự kiện, chính sách) được frontend đọc **trực tiếp qua Supabase JS client bằng anon key**, RLS cho phép đọc công khai — để giảm tải Cloudflare Workers (giới hạn miễn phí 100.000 request/ngày — cần xác minh lại).
- Mọi ghi nhạy cảm (lead, tiến độ, nộp quiz, tạo đơn, xác nhận thanh toán) **không** đi qua Supabase trực tiếp — đi qua **Cloudflare Workers API** (xác thực JWT, validation server, rate-limit, idempotency, chống spam). Workers là nơi duy nhất được cầm service-role key (§3.3).
- Frontend dùng biến `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (§3.3). Không nhúng service-role key vào code frontend dưới bất kỳ hình thức nào.

### 9.2. Endpoint kiểm tra sức khỏe — `/api/health`

- Workers API có endpoint công khai `GET /api/health` (không cần JWT): trả `200` khi Supabase kết nối được; `503 not_configured` khi thiếu biến môi trường; `503 supabase_error` khi Supabase lỗi/tạm dừng.
- **Kiểm chứng sau mỗi lần đổi key / deploy:** mở trình duyệt vào `https://<workers-domain>/api/health` — phải trả `200`. Không trả `200` thì kiểm tra lại URL/key đã trỏ đúng project (§3.2) trước khi kết luận Supabase lỗi.
- Domain API: `visfaracademy.netlify.app`, tiền tố `/api/v1` có dùng (Quyết định Task 02 #8). Ghi chú: domain này là subdomain Netlify, khác với hosting Cloudflare Pages/Workers trong kiến trúc — cần kiểm tra lại cách gắn domain cho Workers API khi triển khai, không tự đổi domain trong bước này.

### 9.3. Những gì API cần từ Supabase (để Task API sau này dùng)

- **JWKS endpoint** để Workers xác minh JWT: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` (thay `<project-ref>` bằng ref thật của từng project). Workers lấy JWKS từ đây, không hard-code key.
- **Database URL (pooler, Transaction mode, cổng 6543)** cho Workers khi cần kết nối trực tiếp (ít dùng — chủ yếu Workers gọi Supabase qua client với service-role key).
- **Realtime:** không bật ở bước này (§4.3).

---

## 10. Edge Functions — KHI NÀO cần

**Kết luận cho bước setup này: KHÔNG tạo Edge Function nào.**

- Kiến trúc chốt luồng chính đi qua **Cloudflare Workers API**; Supabase Edge Functions chỉ là **dự phòng** (`INTEGRATION_PLAN.md` §1: “Realtime / Edge Functions: chỉ dùng ít / dự phòng; luồng chính đi qua Cloudflare Workers API”).
- Không có Edge Function nào được kiến trúc Task 02 / Task 03 yêu cầu ở giai đoạn này. Tạo Edge Function “cho đủ” chỉ tốn lượt gọi miễn phí và thêm chỗ phải bảo trì.

**Chỉ tạo Edge Function khi gặp một trong các trường hợp sau** (quyết riêng từng cái, ghi vào `DECISIONS.md` trước khi tạo):

1. Cần xử lý **ngay trong Supabase** khi có thay đổi database mà Workers API không nên giữ (ví dụ: một Database Trigger cần gọi ra ngoài mà không qua Workers).
2. Cần một webhook receiver đặt **cùng phía Supabase** vì dịch vụ ngoài chỉ cho phép gọi về Supabase (không gọi được về Workers).
3. Cần chạy một tác vụ nền gắn chặt với Auth (ví dụ: Auth Hook xử lý ngay khi user đăng ký — thay cho trigger `handle_new_user` đã có ở `0001`).

**Nếu sau này cần tạo, lệnh chuẩn (chạy trên máy user, tại thư mục repo):**

```bash
# Tạo function mới (tên viết thường, gạch ngang)
npx supabase functions new <ten-function>

# Deploy lên project đã link (staging trước, prod sau — như migration)
npx supabase functions deploy <ten-function> --project-ref <project-ref>

# Xem log khi function lỗi
npx supabase functions logs <ten-function> --project-ref <project-ref>
```

**Giới hạn miễn phí Edge Functions: 500.000 lần gọi/tháng — cần xác minh lại.** Vượt giới hạn thì function ngừng chạy cho tới kỳ sau hoặc tới khi nâng gói — không tự nâng gói, xin phê duyệt theo Quyết định 18.

---

## 11. Cron giữ ấm — chống tạm dừng sau 7 ngày không hoạt động

**Vấn đề:** Supabase Free **tạm dừng project sau 7 ngày không hoạt động** (cần xác minh lại) — project tạm dừng thì website không truy cập được database cho tới khi resume thủ công. Đây là giới hạn chạm đầu tiên của gói miễn phí.

**Cách chống (0 đồng):** Cloudflare Workers Cron Trigger gọi `GET /api/health` **mỗi ngày 1 lần** để project không bị coi là không hoạt động. Cron này được dựng cùng Workers API ở Task API (chưa có Workers ở bước Supabase này), nên ở bước này user chỉ cần làm 2 việc:

1. **Tạm thời (trước khi có Workers):** mỗi tuần mở Dashboard Supabase 1 lần (vào project prod, mở Table Editor hoặc SQL Editor) — hoạt động này tính là project có hoạt động. Ghi chú vào lịch tuần của user cho tới khi cron giữ ấm chạy.
2. **Khi project đã tạm dừng (phục hồi):** vào Dashboard Supabase → mở project bị tạm dừng → bấm **Resume project** (nút hiện trên banner vàng “This project is paused”) → chờ project Active lại → kiểm tra `GET /api/health` trả `200` → kiểm tra cron giữ ấm đang chạy (sau khi đã có Workers).

**Kiểm chứng cron (sau khi Workers có cron):** log mỗi lần gọi `/api/health` phải có 1 lần/ngày; nếu `/api/health` không trả `200` thì cảnh báo admin ngay về `visfaracademy@gmail.com` — đó có thể là dấu hiệu project đã tạm dừng hoặc Supabase lỗi. Khi nâng lên Supabase Pro (không tạm dừng — cần xác minh lại), cron giữ ấm không còn bắt buộc nhưng vẫn giữ làm health check hàng ngày.

---

## 12. Giới hạn miễn phí Supabase — bảng tổng hợp (cần xác minh lại toàn bộ)

Mọi con số dưới đây là **snapshot tra cứu ngày 10/11/2026** (theo `SYSTEM_ARCHITECTURE.md` §12, `INTEGRATION_PLAN.md` §1, `DEPLOYMENT_ARCHITECTURE.md` §7). **Cần xác minh lại** trên trang pricing chính thức của Supabase tại thời điểm bắt đầu lập trình / trước khi nâng gói — nhà cung cấp có thể thay đổi. Không dùng bảng này để cam kết với học viên hay đối tác.

| Hạng mục | Giới hạn miễn phí (tra cứu 10/11/2026 — **cần xác minh lại**) | Điều xảy ra khi chạm giới hạn | Phương án khi chạm |
|---|---|---|---|
| Project đang hoạt động | **2 project** | Không tạo được project thứ 3 | Dùng staging / Supabase local, không tạo thêm |
| Database | **500 MB** | Chế độ chỉ đọc, không ghi được | Dọn log cũ (log lưu trữ 12 tháng); xin phê duyệt nâng Pro |
| Storage | **1 GB** | Không upload thêm được | Không lưu video vào Storage; chuyển file sang Cloudflare R2 (10 GB miễn phí — cần xác minh lại) |
| Băng thông | **5 GB egress/tháng** (một số nguồn ghi 5 GB egress + 5 GB cached = 10 GB — lấy số thận trọng là 5 GB egress) | Lỗi 402 cho tới khi nâng cấp hoặc hết chu kỳ | Đọc công khai qua cache Cloudflare; giảm dung lượng ảnh |
| Auth | **50.000 MAU/tháng** | Không đăng ký / đăng nhập mới được | Xin phê duyệt nâng Pro |
| Edge Functions | **500.000 lần gọi/tháng** | Function ngừng chạy | Giảm lượt gọi; xin phê duyệt nâng Pro |
| Realtime | **200 kết nối đồng thời** | Kết nối mới bị từ chối | Không dùng Realtime cho luồng chính |
| **Tạm dừng** | **Tạm dừng sau 7 ngày không hoạt động** | Website không truy cập được DB cho tới khi resume thủ công | Cron giữ ấm §11; resume thủ công |
| Backup / SLA | **Không backup tự động hàng ngày, không SLA** | Mất database = mất toàn bộ lead, học viên, đơn hàng nếu không tự backup | Backup `pg_dump` hàng ngày qua GitHub Actions; restore thử hàng tháng lên staging |

**Ngưỡng cảnh báo (theo dõi hàng tuần, theo `DEPLOYMENT_ARCHITECTURE.md` §7.2):**

- Database ≥ **400 MB / 500 MB (80%)** → email admin; dọn log cũ; chuẩn bị nâng Pro.
- Storage ≥ **800 MB / 1 GB (80%)** → email admin; chuyển Storage sang R2.
- `/api/health` không trả `200` → email admin ngay (có thể project đã tạm dừng).

**Nâng cấp trả phí — chỉ khi chạm giới hạn và được phê duyệt riêng (Quyết định 18):** Supabase Pro **$25/tháng** (DB 8 GB, băng thông 250 GB, không tạm dừng, backup hàng ngày tự động — **giá cần xác minh lại** trước khi nâng). Nâng gói áp cho cả Supabase, Workers và Resend (không chỉ Supabase): Workers Paid $5/tháng, Resend Pro $20/tháng — giá tra cứu 10/11/2026, **cần xác minh lại** trước khi nâng. Mỗi lần nâng cụ thể cần phê duyệt riêng bằng văn bản; không tự nâng.

**Ba giới hạn chạm đầu tiên (theo thứ tự dự kiến):** (1) Resend 100 email/ngày; (2) Supabase tạm dừng sau 7 ngày không hoạt động; (3) Supabase DB 500 MB / Storage 1 GB.

---

## 13. Checklist nghiệm thu cuối (đánh dấu sau khi làm xong)

- [ ] Đăng nhập đúng tài khoản `visfaracademy@gmail.com`; Dashboard hiện đúng tài khoản.
- [ ] Đủ 2 project **Active**: `visfar-academy-prod` (Project 1 — prod) và `visfar-academy-staging` (Project 2 — staging), cùng region Singapore (hoặc region user đã chọn), plan Free.
- [ ] Đủ 2 bộ key riêng (prod / staging) đã lưu vào nơi lưu secret: Project URL, anon key, service-role key, JWT Secret, DB password, connection string — đã đối chiếu không lẫn nhau.
- [ ] `pgcrypto` đã bật ở cả 2 project (§4.1).
- [ ] Migration `0001`–`0006` đã chạy lên **staging** và đạt kiểm tra §5.4 (38 bảng, 10 khóa đúng thứ tự, 6 câu kiểm tra file 0005 khớp).
- [ ] Đã backup prod trước khi chạy migration (§5.5a, file backup > 0 byte), rồi chạy migration lên **prod** và đạt kiểm tra §5.5c.
- [ ] Auth: chỉ provider Email bật; **Confirm email BẬT**; Site URL + Redirect URLs đã điền; 4 template email đã sửa sang tiếng Việt (§6.4); đăng ký test xác minh được email, `profiles` tự tạo với role `student`.
- [ ] RLS: câu kiểm tra §7.1 trả 0 dòng (không bảng nào tắt RLS); câu kiểm tra §7.2 trả đúng kỳ vọng (0 policy anon INSERT/UPDATE/DELETE trên leads/orders/payments; đúng 2 policy SELECT trên `quiz_options`); test 3 tài khoản student/instructor/admin trên staging đạt (§7.3).
- [ ] Storage: đủ 5 bucket đúng Public/Private (§8.2); policy §8.3 đã chạy; kiểm tra file test đạt (public đọc được khi chưa đăng nhập, private/receipts/certificates không đọc được khi chưa đăng nhập); đã xóa file test.
- [ ] API: frontend chỉ đọc công khai qua anon key; service-role key chỉ ở Workers Secrets; `GET /api/health` trả `200` (sau khi có Workers).
- [ ] Edge Functions: **không tạo** function nào ở bước này (§10).
- [ ] Cron giữ ấm: đã ghi chú lịch mở Dashboard hàng tuần cho tới khi Workers Cron chạy (§11).

---

## 14. Việc cần user làm

1. **Tạo 2 project Supabase** trên tài khoản `visfaracademy@gmail.com` theo §2: `visfar-academy-prod` (Project 1 — prod, dữ liệu thật duy nhất) và `visfar-academy-staging` (Project 2 — staging, dữ liệu test). Người viết không có quyền tài khoản nên không tự tạo được.
2. **Chọn region** cho 2 project (đề xuất: Singapore — §2.1; nếu muốn region khác thì quyết trước khi bấm Create, vì region không đổi được sau khi tạo).
3. **Lưu mật khẩu database + toàn bộ key** (URL, anon key, service-role key, JWT Secret, connection string) của cả 2 project vào nơi lưu secret của user theo §3 — không gửi các giá trị này qua chat, không ghi vào repo.
4. **Chạy migration 0001–0006** theo §5: copy 3 file Task 03 vào `supabase/migrations/`, chạy **staging trước**, đối chiếu kiểm tra §5.4, backup prod rồi mới chạy **prod**. Không chạy migration lên prod trước khi staging đạt.
5. **Cấu hình Authentication** theo §6: chỉ bật provider Email, bật **Confirm email**, điền Site URL + Redirect URLs, sửa 4 template email sang tiếng Việt, đăng ký 1 tài khoản test trên staging để xác minh email hoạt động.
6. **Xác nhận bảng bucket §8.1** — đặc biệt 3 bucket đề xuất mới `avatars`, `receipts`, `certificates` và việc để `avatars` ở chế độ Public (hay đổi thành Private nếu không hiển thị avatar công khai) — rồi tạo 5 bucket + chạy policy §8.3.
7. **Kiểm tra RLS bằng 3 tài khoản thật trên staging** theo §7.3 (student / instructor / admin) và đánh dấu checklist §13. Tài khoản instructor test cần được gán vào 1 khóa test qua bảng `course_instructors` trước khi kiểm tra.
8. **Quyết các việc chưa chốt sau đây** (để Task tiếp theo làm, không tự quyết thay user):
   - Đổi tên `answers` → `quiz_answers` (Quyết định Task 03 #2): cần migration mới riêng (0007) — chưa có trong 0004–0006 (§5.6).
   - Thêm cột `orders.receipt_url` (biên lai) và `certificates.pdf_url` (chứng chỉ PDF): cần migration mới riêng (§5.6, §8.1).
   - Seed 7 key `system_settings` khởi tạo (Quyết định Task 03 #11: hoàn trả 15 ngày làm việc, khiếu nại phản hồi 3 ngày, SePay, MB Bank — không lưu số tài khoản).
   - Domain production chính thức + Site URL / Redirect URLs tương ứng (§6.2) và cách gắn domain cho Workers API (Quyết định Task 02 #8: `visfaracademy.netlify.app`, tiền tố `/api/v1`).
   - Cấu hình Custom SMTP trỏ Resend cho email Auth production + xác minh DNS SPF/DKIM/DMARC của domain gửi (Quyết định Task 02 #14).
   - Giờ + hình thức từng sự kiện 25/11/2026 (hiện mới chốt ngày 25/11/2026 và giờ mặc định 18:30, hình thức Zoom — theo `DECISIONS.md`).
9. **Xác minh lại toàn bộ giá và giới hạn miễn phí** ở §12 trên trang pricing chính thức của Supabase trước khi cam kết con số với bất kỳ ai hoặc trước khi nâng gói. Mọi lần nâng gói (Supabase Pro $25/tháng — cần xác minh lại) đều cần phê duyệt riêng theo Quyết định 18.
10. **Quét thử mã QR chuyển khoản** (file QR do user cung cấp) để xác nhận mã ra đúng tài khoản nhận — việc này vẫn đang chờ user làm từ Task trước, không thuộc bước Supabase này nhưng chặn việc mở bán khóa trả phí.

---

## Tài liệu tham khảo (đã đọc khi viết file này)

- `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (v1.0, 10/11/2026) — §1, §3, §5, §6, §7, §8, §9, §12.
- `workspace/visfar-academy-platform/docs/architecture/` — `SYSTEM_ARCHITECTURE.md` (§5, §6, §7, §8, §9, §12), `API_ARCHITECTURE.md` (§3, §8), `DEPLOYMENT_ARCHITECTURE.md` (§2, §3, §5, §6, §7), `INTEGRATION_PLAN.md` (§1, §9), `ROLE_PERMISSION_MATRIX.md`, `SYSTEM_MODULES.md`, `USER_FLOWS.md`.
- `workspace/visfar-academy-platform/docs/database/` — `DATABASE_SCHEMA.md` (38 bảng; §5 migration đổi tên/gộp), `DATABASE_ERD.md`, `DATA_DICTIONARY.md` (§2.7 lesson_resources, §2.20 orders.receipt_url, certificates.pdf_url, profiles.avatar_url), `RLS_POLICIES.md`, `SECURITY_MODEL.md` (§2 Auth JWT, §7 Storage, §9 giới hạn miễn phí).
- `workspace/visfar-academy-platform/docs/database/DATABASE_MIGRATIONS/` — `0004_add_task03_tables.sql`, `0005_rename_restructure.sql`, `0006_rls_task03.sql` (48 policy; kiểm tra cuối file 0005/0006).
- `workspace/visfar-academy-platform/supabase/migrations/` — `0001_init_schema.sql`, `0002_seed_courses.sql`, `0003_seed_content.sql`.
- `workspace/visfar-academy-platform/docs/DECISIONS.md` — 19 quyết định Task 01 (10/11/2026 19:40), phê duyệt Task 02 (20:08), phê duyệt Task 03 (20:18).
