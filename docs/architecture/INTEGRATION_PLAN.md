# Kế hoạch tích hợp dịch vụ — Nền tảng Visfar Academy (TASK 02)

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt kiến trúc
**Phạm vi:** Kế hoạch tích hợp từng dịch vụ cho nền tảng E-learning Visfar Academy.
**Quy tắc của tài liệu này:** Chưa viết code, chưa tạo database, chưa deploy. Không sửa code / file HTML gốc.

**Tài liệu nguồn:**

- `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` — Tài liệu kiến trúc tổng thể v1.0, 10/11/2026 (đặc biệt §12 — giới hạn miễn phí, backup, mở rộng).
- `workspace/visfar-academy-platform/docs/DECISIONS.md` — 19 quyết định của Lê Đăng Quyết, chốt ngày 10/11/2026.

**Các quyết định đã chốt có ảnh hưởng trực tiếp tới kế hoạch này:**

- Quyết định 19: nền tảng mới dùng **Next.js** (không còn mâu thuẫn Next.js / Astro hay WordPress + LMS).
- Quyết định 5: đường lead — **API làm lớp trước, rồi ghi Sheet**. API nhận lead, validate / chống spam / chống trùng, sau đó ghi vào Google Sheet (bản sao đối soát). Sheet không còn là đường ghi duy nhất. Được phép sửa + deploy lại file `.gs` khi cần cho luồng này.
- Quyết định 15: thanh toán dùng **SePay**. Ngân hàng **MB Bank**, chủ tài khoản là **Công ty TNHH MTV Visfar Holdings**. Số tài khoản **không ghi trong tài liệu** — chỉ dùng từ ảnh chụp / file QR do user cung cấp khi cần tạo khối thanh toán / VietQR. Có thể sử dụng QR Code cũ. Không tự tạo QR mới từ thông tin chưa xác nhận.
- Quyết định 16: video **YouTube unlisted** — chấp nhận đánh đổi (xem §7).
- Quyết định 18: **nâng cấp trả phí khi chạm tới giới hạn miễn phí** — áp cho cả Supabase, Workers và Resend (không chỉ Supabase). Giá tra cứu 10/11/2026 (Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng), **cần xác minh lại** trước khi nâng.
- Quyết định 4: chống spam — thêm cả hai: (a) honeypot + rate-limit + idempotency, và (b) CAPTCHA.
- Quyết định 6: newsletter footer làm thật — form + handler thật (ghi vào Sheet / dịch vụ email), không xóa input.
- Quyết định 7: 3 sự kiện chuyển sang tháng 11; ngày chốt là **25/11/2026** cho cả 3 sự kiện. Giờ + hình thức từng sự kiện chưa được cung cấp — không tự bịa, chờ user gửi sau. Tài liệu này không ghi thêm ngày/giờ sự kiện nào khác.

**Nguyên tắc chung (theo Tài liệu kiến trúc tổng thể):**

1. **0 đồng trước, trả phí chỉ khi được phê duyệt.** Không dùng dịch vụ trả phí nào nếu chưa được user phê duyệt bằng văn bản.
2. **Một nguồn sự thật.** Lead, học viên, khóa học, đơn hàng mỗi thứ chỉ có 1 bảng chính trong PostgreSQL (Supabase). Google Sheet chỉ là bản sao / báo cáo, không phải database chính.
3. **Mọi secret chỉ nằm trong Cloudflare Workers Secrets / GitHub Secrets** (và nơi lưu secret tương đương của dịch vụ). Không commit secret, không ghi giá trị thật của secret vào tài liệu này hay vào repo. Tài liệu này chỉ ghi **tên biến**.
4. **Mọi form đều có xác nhận thật.** Không còn “thành công giả”. Mọi lần gửi đều có mã tham chiếu và trạng thái đối soát được.
5. **Số liệu giới hạn miễn phí dưới đây là snapshot tra cứu ngày 10/11/2026** (theo §12 Tài liệu kiến trúc tổng thể, nguồn thứ cấp tổng hợp từ trang pricing/docs của nhà cung cấp). Nhà cung cấp có thể thay đổi giới hạn — **xác minh lại trên trang pricing chính thức của từng dịch vụ trước khi triển khai**. Giá trả phí ghi trong tài liệu này đều kèm ghi chú **“cần xác minh lại”**.

---

## 1. Supabase — PostgreSQL / Auth / Storage

### Mục đích

- **PostgreSQL:** nguồn sự thật duy nhất — lead, học viên (`profiles`), khóa học, module, bài học, quiz, enrollment, tiến độ, đơn hàng, thanh toán, chứng chỉ, sự kiện, blog, chính sách, nhật ký email, newsletter, audit log (xem §3 Tài liệu kiến trúc tổng thể).
- **Auth:** đăng ký / đăng nhập, JWT, phân quyền theo role (`student` / `instructor` / `admin`).
- **Storage:** ảnh, poster, PDF tài liệu bài học (giai đoạn đầu). **Không dùng Storage cho video** (xem §7).
- **Realtime / Edge Functions:** chỉ dùng ít / dự phòng; luồng chính đi qua Cloudflare Workers API.

### Cách tích hợp

- Tạo 2 project Supabase Free: 1 project production + 1 project staging (dùng để restore thử backup mỗi tháng 1 lần).
- Frontend (Next.js) đọc nội dung công khai (khóa học, bài viết, sự kiện) trực tiếp qua Supabase JS client bằng anon key, RLS cho phép đọc công khai — để giảm tải Cloudflare Workers (xem §3).
- Mọi ghi dữ liệu nhạy cảm (lead, tiến độ, quiz, đơn hàng, thanh toán) đi qua Cloudflare Workers API, dùng service-role key **chỉ ở server**. Frontend không bao giờ thấy service-role key.
- Bật **Row Level Security (RLS) trên mọi bảng**; mặc định từ chối; anon key không bao giờ `INSERT` / `UPDATE` / `DELETE` vào bảng nhạy cảm.
- Migration đánh số thứ tự (`supabase/migrations/0001_init_schema.sql`, `0002_seed_courses.sql`, `0003_seed_content.sql`…); không sửa migration cũ — chỉ thêm migration mới.
- Seed 10 khóa học hiện tại, giữ nguyên thứ tự 01–10 (xem §3.2 Tài liệu kiến trúc tổng thể). Nội dung 3 khóa Sức khỏe / Mối quan hệ / Tài chính ghi rõ trong seed là “nội dung tạm, chờ user gửi văn bản của mình” (theo Quyết định 10, user đã duyệt nội dung builder viết cho 3 khóa này — khi lập trình cần đối chiếu lại nội dung đã duyệt trước khi seed).
- Backup: Supabase Free không có backup tự động hàng ngày. Backup thủ công bằng `pg_dump` qua Supabase CLI / dashboard, lưu file `.sql` vào repo GitHub riêng (private) + Cloudflare R2; script `scripts/backup-check.mjs` chạy hàng ngày qua GitHub Actions để dump và kiểm tra file backup có mới không. **Backup chưa từng restore thử thì coi như chưa có backup.**

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| `SUPABASE_URL` | Frontend + Workers API | URL project Supabase |
| `SUPABASE_ANON_KEY` | Frontend (Supabase JS client) | Chỉ đọc nội dung công khai qua RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Chỉ Workers API (server)** | Bypass RLS — không bao giờ ở frontend, không commit |
| `SUPABASE_JWT_SECRET` | Workers API (xác minh JWT) | Dùng để xác minh JWT bằng Supabase JWKS; không tin JWT do client tự khai |
| `SUPABASE_DB_PASSWORD` | Vận hành / `pg_dump` / restore | Chỉ dùng cho backup / restore, lưu trong nơi lưu secret của vận hành, không commit |

### Giới hạn miễn phí

| Hạng mục | Giới hạn (tra cứu 10/11/2026) |
|---|---|
| Project đang hoạt động | 2 project |
| Database | **500 MB** |
| Storage | **1 GB** |
| Băng thông | 5 GB egress + 5 GB cached = 10 GB/tháng (một số nguồn ghi 5 GB — lấy số thận trọng là 5 GB egress) |
| Auth | 50.000 MAU/tháng |
| Edge Functions | 500.000 lần/tháng |
| Realtime | 200 kết nối đồng thời |
| **Tạm dừng** | **Tạm dừng sau 7 ngày không hoạt động** |
| Backup / SLA | Không backup tự động hàng ngày, không SLA |

### Điểm chạm đầu tiên

Theo thứ tự dự kiến (Tài liệu kiến trúc tổng thể §12.1):

1. **Tạm dừng sau 7 ngày không hoạt động** — nếu tuần đó ít traffic, project tạm dừng → website không truy cập được DB cho tới khi resume thủ công.
2. **DB 500 MB** — lead + tiến độ học tăng nhanh.
3. **Storage 1 GB** — ảnh, poster, PDF tích lũy; video không lưu ở đây.

Điều xảy ra khi chạm giới hạn: vượt DB 500 MB → chế độ chỉ đọc, không ghi được; vượt băng thông → lỗi 402 cho tới khi nâng cấp hoặc hết chu kỳ; project tạm dừng → website không truy cập được DB cho tới khi resume thủ công.

### Phương án thay thế / nâng cấp

- **Chống tạm dừng (0 đồng):** cron “giữ ấm” — Workers Cron Trigger gọi `GET /api/health` mỗi ngày 1 lần để project không bị coi là không hoạt động. Quy trình phục hồi khi đã tạm dừng: vào dashboard Supabase → Resume project → kiểm tra API hoạt động lại → bật cron giữ ấm.
- **DB / Storage đầy (0 đồng, tạm thời):** dọn dữ liệu log cũ; không lưu video vào Storage; chuyển file sang Cloudflare R2 (10 GB miễn phí, xem §3) khi Storage 1 GB hết.
- **Nâng cấp trả phí:** Supabase Pro $25/tháng (DB 8 GB, băng thông 250 GB, không tạm dừng, backup hàng ngày) — **giá cần xác minh lại** trước khi nâng; **cần phê duyệt** trước khi nâng (Quyết định 18).

---

## 2. Cloudflare Pages — Hosting frontend (Next.js)

### Mục đích

- Host trang công khai + khu vực học viên + admin (Next.js, theo Quyết định 19).
- CDN toàn cầu, preview deployment cho mỗi PR, deploy tự động khi merge vào `main`.

### Cách tích hợp

- Kết nối repo GitHub với Cloudflare Pages; build Next.js bằng adapter Cloudflare (`@cloudflare/next-on-pages` — cần xác minh tương thích tại thời điểm triển khai).
- Deploy tự động: merge vào `main` → deploy production; mỗi PR → preview deployment.
- Đặt CSP, `X-Content-Type-Options`, `Referrer-Policy` trên Pages.
- Ảnh / file tách khỏi HTML (không còn base64 5,5 MB); `srcset` / `sizes`; lazy loading; font `.woff2` riêng, subset tiếng Việt; mục tiêu file HTML đầu tiên < 500 KB.
- Domain chính thức và domain API (`https://api.visfaracademy.vn`) cần user phê duyệt; tạm thời dùng `*.workers.dev` / `*.pages.dev` trong giai đoạn dev (theo §7 Tài liệu kiến trúc tổng thể).

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Actions (deploy) | Token deploy Pages / Workers, giới hạn quyền tối thiểu |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions (deploy) | ID tài khoản Cloudflare |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend (build/runtime) | Biến công khai — chỉ chứa URL, không phải secret nhạy cảm |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend (build/runtime) | Anon key công khai qua RLS (xem §1); không phải service-role key |

### Giới hạn miễn phí

| Hạng mục | Giới hạn (tra cứu 10/11/2026) |
|---|---|
| Build | **500 build/tháng**; 1 build đồng thời; build timeout 20 phút |
| File | 20.000 file/site; 25 MiB/file |
| Custom domain | 100 custom domain/project; 100 project/tài khoản |
| **Request tới static asset và băng thông** | **Không giới hạn** |

### Điểm chạm đầu tiên

Khó chạm — 500 build/tháng là nhiều đối với nhịp deploy hiện tại. Giới hạn đầu tiên có thể gặp là 1 build đồng thời (hai lần deploy cùng lúc phải chờ nhau) hoặc build timeout 20 phút nếu build Next.js nặng lên.

Điều xảy ra khi chạm giới hạn: vượt 500 build → không build được cho tới tháng sau.

### Phương án thay thế / nâng cấp

- **0 đồng:** giảm số lần deploy (gộp commit trước khi merge vào `main`); chỉ chạy CI khi có PR; tránh deploy lại không cần thiết.
- **Nâng cấp trả phí:** không có gói Pages trả phí riêng cần thiết ở giai đoạn này; nếu cần nhiều build hơn, xem lại nhịp deploy trước khi xem xét gói trả phí — **giá cần xác minh lại** nếu tới lúc đó mới quyết; **cần phê duyệt** trước khi mua.

---

## 3. Cloudflare Workers — API backend

### Mục đích

- API backend duy nhất cho mọi ghi dữ liệu nhạy cảm và nghiệp vụ: lead, enrollment, tiến độ, quiz, đơn hàng, webhook thanh toán / email, báo cáo admin.
- Validation server, rate-limit, idempotency, chống spam, xác minh JWT + role, gọi Resend, ghi Google Sheet (bản sao đối soát).
- Cron Trigger (miễn phí — cần xác minh giới hạn cron khi triển khai): cron giữ ấm Supabase mỗi ngày; quét đơn quá hạn / học viên không học / sự kiện sắp diễn ra để gửi email nhắc mỗi giờ.

### Cách tích hợp

- Workers API viết bằng TypeScript, router (Hono hoặc itty-router — chốt khi lập trình), cấu trúc `workers/api/src/` theo §2 Tài liệu kiến trúc tổng thể (`routes/`, `lib/supabase-admin.ts`, `lib/auth.ts`, `lib/rate-limit.ts`, `lib/idempotency.ts`, `lib/email.ts`).
- Base URL: `https://api.visfaracademy.vn` (cần user phê duyệt domain; tạm thời `*.workers.dev`).
- Auth: `Authorization: Bearer <Supabase JWT>` cho endpoint cần đăng nhập; endpoint công khai không cần JWT nhưng vẫn rate-limit theo IP.
- Mọi POST tạo dữ liệu (lead, order, quiz submit) nhận header `Idempotency-Key` (UUID do client sinh); server lưu key và trả lại kết quả cũ nếu key trùng.
- Rate-limit (đề xuất, chốt khi lập trình): lead tối đa 5 lần/giờ/IP; đăng nhập tối đa 10 lần/15 phút/IP; endpoint công khai 100 req/phút/IP. Vượt → 429, không ghi dữ liệu.
- Chống spam lead (Quyết định 4): honeypot field + rate-limit + idempotency **và** CAPTCHA (Turnstile của Cloudflare, miễn phí — cần xác minh giới hạn khi triển khai, không giả định).
- Đọc nội dung công khai **trực tiếp qua Supabase** (không qua Workers) để giảm tải Workers; chỉ ghi nhạy cảm và tổng hợp nặng mới qua Workers.
- Mọi secret chỉ nằm trong Cloudflare Workers Secrets; không commit `.env`.

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| `SUPABASE_URL` | Workers API | Xem §1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Workers API (server duy nhất được cầm key này) | Xem §1 |
| `SUPABASE_JWT_SECRET` | Workers API (xác minh JWT) | Xem §1 |
| `RESEND_API_KEY` | Workers API (gửi email) | Xem §4; chỉ ở server, không ở frontend |
| `SEPAY_WEBHOOK_SECRET` | Workers API (`POST /api/webhooks/sepay`) | Chỉ dùng khi SePay được phê duyệt và triển khai (xem §5) |
| `SEPAY_API_TOKEN` | Workers API (nếu SePay yêu cầu) | Chỉ dùng khi SePay được phê duyệt; tên biến chính xác theo tài liệu SePay tại thời điểm triển khai |
| `STRIPE_WEBHOOK_SECRET` | Workers API (`POST /api/webhooks/stripe`) | Chỉ dùng khi Stripe được phê duyệt (chưa chốt — xem §5) |
| `STRIPE_SECRET_KEY` | Workers API | Chỉ dùng khi Stripe được phê duyệt |
| `TURNSTILE_SECRET_KEY` | Workers API (xác minh CAPTCHA) | Secret phía server của Turnstile; site key công khai nằm ở frontend |
| `GOOGLE_SHEETS_API_KEY` / `GOOGLE_SERVICE_ACCOUNT_KEY` | Workers API (ghi Sheet — xem §8) | Một trong hai, theo cách tích hợp Google Sheet được chốt khi triển khai; **chỉ ghi tên biến, không ghi giá trị** |
| `GOOGLE_SHEET_ID` | Workers API | ID của Google Sheet đối soát (không phải secret nhạy cảm như key, nhưng không ghi nhầm thành giá trị thật ở đây) |

### Giới hạn miễn phí

| Hạng mục | Giới hạn (tra cứu 10/11/2026) |
|---|---|
| Request | **100.000 request/ngày** (reset 00:00 UTC) |
| CPU | **10 ms/request** |
| Subrequest | 50 subrequest/lần gọi |
| Workers | 100 Workers/tài khoản |
| Bộ nhớ | 128 MB/isolate |

### Điểm chạm đầu tiên

**100.000 request/ngày** — nếu API đọc khóa học đi qua Workers thay vì đọc trực tiếp Supabase. Vượt giới hạn → lỗi 1027, request bị từ chối (không tính phí).

### Phương án thay thế / nâng cấp

- **0 đồng:** đọc nội dung công khai trực tiếp qua Supabase (không qua Workers); cache ở Cloudflare; giữ endpoint công khai nhẹ, phân trang.
- **Nâng cấp trả phí:** Workers Paid $5/tháng (10.000.000 request/tháng, CPU 30 giây) — **giá cần xác minh lại** trước khi nâng; **cần phê duyệt** trước khi nâng (Quyết định 18).

---

## 4. Resend — Email giao dịch + automation

### Mục đích

- Gửi mọi email giao dịch và automation: chào mừng, đặt lại mật khẩu, lead đã ghi nhận, báo lead mới cho admin, đơn hàng (QR + số tiền + mã đơn + hạn 48h), nhắc thanh toán 12h / 24h, đã nhận thanh toán, hoàn thành khóa học, nhắc học sau 7 ngày không học, nhắc sự kiện, xác nhận đăng ký nhận tin, xác nhận hoàn trả (E1–E13, xem §10.2 Tài liệu kiến trúc tổng thể).
- Webhook trạng thái gửi (`delivered` / `bounced`) để cập nhật `email_logs`.

### Cách tích hợp

- Mọi email đều gửi qua Workers API (gọi Resend bằng API key ở server), **không gọi Resend từ frontend**.
- Mọi email đều ghi vào bảng `email_logs` (to, template, `resend_id`, status) để đối soát; webhook Resend cập nhật `delivered` / `bounced`.
- Gửi từ **domain riêng của Visfar** (cần xác minh DNS: SPF, DKIM, DMARC). **Không gửi từ `onboarding@resend.dev` cho người dùng thật**, vì địa chỉ đó chỉ gửi được tới email của tài khoản Resend.
- Template bằng tiếng Việt, giữ giọng văn tự nhiên, ít emoji, không thúc ép / FOMO mạnh (theo sở thích của user).
- Hàng đợi (giai đoạn 0 đồng): Workers Cron Trigger chạy mỗi giờ để quét đơn quá hạn / học viên không học / sự kiện sắp diễn ra và gửi email nhắc. Không dùng hàng đợi trả phí nếu chưa phê duyệt.
- Email quan trọng (E3/E5/E8) gửi đồng bộ; email nhắc (E6/E7/E10/E11) qua hàng đợi cron.

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| `RESEND_API_KEY` | Workers API (server) | Key gửi email; chỉ ở server |
| `RESEND_WEBHOOK_SECRET` | Workers API (`POST /api/webhooks/resend`) | Xác minh chữ ký webhook trạng thái email |
| `RESEND_FROM_EMAIL` | Workers API (cấu hình gửi) | Địa chỉ gửi từ domain riêng đã xác minh DNS (VD `…@visfaracademy.vn` — domain chính xác chốt khi xác minh DNS) |
| `ADMIN_NOTIFY_EMAIL` | Workers API (template `lead-notify-admin`) | Email admin nhận báo lead mới |

### Giới hạn miễn phí

| Hạng mục | Giới hạn (tra cứu 10/11/2026) |
|---|---|
| Email | **3.000 email/tháng, tối đa 100 email/ngày** (reset 00:00 UTC) |
| Domain gửi | 3 domain |
| Inbox | 3 inbox |
| Lưu log | 30 ngày |
| Mua thêm (overage) | Không mua thêm được |

### Điểm chạm đầu tiên

**100 email/ngày** — giới hạn chạm đầu tiên của toàn bộ hệ thống. Một ngày có 150 đăng ký mới thì 50 email chào mừng sẽ lỗi `daily_quota_exceeded` cho tới 00:00 UTC hôm sau.

Điều xảy ra khi chạm giới hạn: email thứ 101 trong ngày → lỗi `daily_quota_exceeded`, không gửi được.

### Phương án thay thế / nâng cấp

- **0 đồng (khi chạm giới hạn):** xếp hàng email nhắc (E6/E7/E10) sang ngày hôm sau, ưu tiên email giao dịch (E3/E5/E8); email giao dịch xếp hàng, gửi lại sau 00:00 UTC; admin nhận cảnh báo (báo cáo R8 — số email gửi / delivered / bounced / failed theo template; chạm giới hạn Resend bao nhiêu lần).
- **Phương án thay thế miễn phí khác:** Supabase Auth SMTP + Gmail — chỉ cho email auth, không cho email marketing; không dùng Gmail cá nhân gửi hàng loạt.
- **Nâng cấp trả phí:** Resend Pro $20/tháng (50.000 email, không giới hạn ngày) — **giá cần xác minh lại** trước khi nâng; **cần phê duyệt** trước khi nâng (Quyết định 18).

---

## 5. SePay — Webhook đối soát thanh toán (chỉ triển khai khi phê duyệt)

### Mục đích

- Tự động đối soát chuyển khoản ngân hàng: khi học viên chuyển khoản, SePay gửi webhook → hệ thống tự động đổi đơn sang `paid`, tạo enrollment, gửi email — thay cho admin đối soát tay mỗi ngày.
- Giai đoạn đầu (0 đồng) vẫn dùng **chuyển khoản thủ công + admin đối soát** (xem §8.2 Tài liệu kiến trúc tổng thể). SePay là giai đoạn sau.

### Cách tích hợp

- **Chỉ triển khai khi user phê duyệt.** SePay có gói trả phí — **cần xác minh giá** tại thời điểm triển khai, không giả định miễn phí.
- Luồng (theo §8.3 Tài liệu kiến trúc tổng thể):
  1. Học viên → `POST /api/orders` (`payment_method=sepay`) → hiện QR VietQR (SePay) + thông tin chuyển khoản. Ngân hàng **MB Bank**, chủ tài khoản **Công ty TNHH MTV Visfar Holdings**. Số tài khoản **không ghi trong tài liệu này**.
  2. Học viên chuyển khoản (app ngân hàng), nội dung = mã đơn (`reference_code`, VD `DH-2026-000123`).
  3. SePay webhook → `POST /api/webhooks/sepay`:
     - Xác minh chữ ký webhook bằng `SEPAY_WEBHOOK_SECRET`; từ chối webhook không có chữ ký đúng.
     - Tìm order theo `reference_code` trong nội dung chuyển khoản.
     - Kiểm tra số tiền khớp (cho phép sai lệch 0đ — không chấp nhận thiếu / thừa).
     - Tạo `payments` (`succeeded`) + `orders` → `paid` + tạo `enrollments` + gửi email “Đã nhận thanh toán”.
     - Idempotency: (`method`, `gateway_reference`) UNIQUE — webhook gửi lại không tạo trùng.
     - Lưu payload webhook gốc vào `payments.gateway_payload` để đối soát (không chứa secret).
- QR VietQR: chỉ dùng file / ảnh do user cung cấp hoặc tạo từ thông tin user đã xác nhận. Có thể sử dụng QR Code cũ (Quyết định 15). **Không tự tạo QR mới từ thông tin chưa xác nhận.**
- **Không bao giờ tin client báo “đã trả”.** Đơn chỉ chuyển sang `paid` khi (a) webhook SePay xác minh chữ ký, hoặc (b) admin xác nhận thủ công sau khi kiểm tra sao kê.
- Stripe (thẻ quốc tế) là phương án riêng, chưa chốt — chỉ dùng khi cần thu thẻ quốc tế, **chưa triển khai cho tới khi user phê duyệt; cần xác minh Stripe có hỗ trợ tài khoản Việt Nam và phí giao dịch tại thời điểm triển khai**.

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| `SEPAY_API_TOKEN` | Workers API | Tên biến chính xác theo tài liệu SePay tại thời điểm triển khai |
| `SEPAY_WEBHOOK_SECRET` | Workers API (`POST /api/webhooks/sepay`) | Xác minh chữ ký webhook |
| `SEPAY_MERCHANT_ID` | Workers API (cấu hình) | ID merchant SePay, nếu SePay yêu cầu |

### Giới hạn miễn phí

- **Không có gói miễn phí được giả định.** SePay có gói trả phí — **cần xác minh giá** tại thời điểm triển khai (bảng giá / phí giao dịch / phí duy trì — tra cứu trên trang chính thức của SePay trước khi phê duyệt).
- Giới hạn kỹ thuật (số webhook / số giao dịch / giới hạn gọi API — nếu có) tra cứu cùng lúc với giá, ghi vào tài liệu vận hành khi triển khai.

### Điểm chạm đầu tiên

Không áp dụng ở giai đoạn 0 đồng — SePay chưa triển khai. Điểm chạm đầu tiên của luồng thanh toán ở giai đoạn đầu là **đối soát thủ công**: admin phải đối soát tay mỗi ngày; học viên chờ lâu (tối đa 48h giữ chỗ); sai nội dung chuyển khoản → không đối soát được.

### Phương án thay thế / nâng cấp

- **Phương án hiện tại (0 đồng, không cần phê duyệt thêm):** chuyển khoản thủ công + admin đối soát (mã đơn duy nhất; email nhắc “chưa thanh toán” sau 12h và 24h; đơn quá hạn → `expired`, học viên tạo đơn mới; báo cáo đối soát hàng ngày R9).
- **Nâng cấp (khi phê duyệt SePay):** triển khai webhook theo luồng trên; giữ luồng thủ công làm dự phòng khi webhook lỗi.
- **Phương án thay thế khác (khi phê duyệt riêng):** Stripe cho thẻ quốc tế — **cần phê duyệt riêng; cần xác minh hỗ trợ Việt Nam và phí giao dịch; giá cần xác minh lại**.

---

## 6. GitHub — Source control + CI/CD

### Mục đích

- Lưu code, quản lý PR / review / rollback; CI (lint + typecheck + test) trên mọi PR; deploy tự động lên Cloudflare Pages khi merge vào `main`.
- Lưu file seed, migration, tài liệu kiến trúc; backup database (file `.sql` vào repo riêng, private — xem §1).

### Cách tích hợp

- Repo: code frontend (Next.js) + Workers API + Supabase migration/seed + tài liệu, theo cấu trúc thư mục §2 Tài liệu kiến trúc tổng thể.
- Branch protection cho `main`: không push trực tiếp, phải qua PR + review.
- Workflows (`.github/workflows/`):
  - `ci.yml` — lint + typecheck + test (mọi PR).
  - `deploy.yml` — deploy Cloudflare Pages khi merge vào `main`.
  - Backup hàng ngày: script `scripts/backup-check.mjs` chạy qua GitHub Actions để dump database và kiểm tra file backup có mới không.
- Rollback: `git revert` hoặc deploy lại commit cũ trên Cloudflare Pages (preview deployment giữ lại); giữ lại 5 commit gần nhất cho Workers API.
- Mọi secret nằm trong GitHub Secrets; không commit `.env`.

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Actions (deploy) | Xem §2 |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions (deploy) | Xem §2 |
| `SUPABASE_DB_PASSWORD` | GitHub Actions (backup `pg_dump`) | Chỉ dùng cho backup; xem §1 |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions / Supabase CLI (nếu dùng) | Token Supabase CLI cho backup / migration, nếu cần |

### Giới hạn miễn phí

| Hạng mục | Giới hạn (tra cứu 10/11/2026) |
|---|---|
| Repo | Public / private không giới hạn |
| GitHub Actions | **2.000 phút/tháng** cho tài khoản miễn phí |

### Điểm chạm đầu tiên

Khó chạm ở giai đoạn đầu — 2.000 phút Actions/tháng là nhiều đối với CI + backup hàng ngày ở quy mô hiện tại.

Điều xảy ra khi chạm giới hạn: vượt phút Actions → CI dừng.

### Phương án thay thế / nâng cấp

- **0 đồng:** giảm số lần chạy CI (chỉ chạy khi có PR); gộp commit; backup chạy 1 lần/ngày, không chạy nhiều lần.
- **Nâng cấp trả phí:** GitHub Team / mua thêm phút Actions — **giá cần xác minh lại** nếu tới lúc đó mới quyết; **cần phê duyệt** trước khi mua.

---

## 7. YouTube (unlisted) — Video bài giảng

### Mục đích

- Chứa video bài giảng: miễn phí, không giới hạn dung lượng, CDN toàn cầu.
- Supabase Storage miễn phí chỉ 1 GB — không đủ chứa video; Cloudflare Workers không stream video.

### Cách tích hợp

- Video bài giảng đăng lên **YouTube ở chế độ không công khai (unlisted)**.
- Frontend nhúng YouTube embed; `video_url` lưu trong `lessons.video_url` (cùng `video_duration_sec`).
- **Không dùng Supabase Storage cho video.** Storage chỉ dùng cho ảnh, poster, PDF tài liệu.
- Không stream video qua Supabase Storage hay Workers.

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

Không có secret API bắt buộc cho luồng embed unlisted ở giai đoạn đầu — video nhúng bằng URL công khai (unlisted) trong `lessons.video_url`.

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| *(Không có)* | — | Nếu sau này cần YouTube Data API để quản lý / liệt kê video tự động, thêm `YOUTUBE_API_KEY` khi đó — **chưa cần ở giai đoạn này, không tạo trước** |

Tài khoản YouTube / kênh đăng video do user quản lý; tài liệu này không ghi thông tin đăng nhập kênh.

### Giới hạn miễn phí

| Hạng mục | Giới hạn |
|---|---|
| Dung lượng video unlisted | Không giới hạn dung lượng (theo chính sách YouTube) |
| Giới hạn kỹ thuật | Không phải giới hạn kỹ thuật — giới hạn là chính sách: vi phạm chính sách → video bị gỡ |

### Điểm chạm đầu tiên

Không phải giới hạn kỹ thuật. Điểm chạm là **bảo mật** — xem “Đánh đổi” dưới đây.

### Đánh đổi bảo mật — đã chấp nhận (Quyết định 16)

Video unlisted **không phải là bảo mật thật**:

- Ai có link đều xem được.
- Không chống tải xuống.
- Không có DRM.

Đây là đánh đổi chấp nhận được ở giai đoạn 0 đồng, khi nội dung chưa phải là tài sản trả phí cao (theo §9.4 Tài liệu kiến trúc tổng thể và Quyết định 16).

### Phương án thay thế / nâng cấp

- **Khi cần bảo mật hơn (cần phê duyệt, có phí):** Cloudflare Stream, Mux, hoặc Vimeo Pro — video có signed URL, hết hạn, chống tải. Chuyển sang khi doanh thu khóa học đủ bù chi phí, hoặc khi phát hiện video bị chia sẻ trái phép.
- **Giá các dịch vụ video trả phí: cần xác minh lại** tại thời điểm quyết định chuyển; **cần phê duyệt** trước khi mua.
- Cho tới lúc đó: không đưa `video_url` của bài không xem thử cho người chưa ghi danh (API chỉ trả video URL khi đã ghi danh hoặc `is_free_preview`).

---

## 8. Google Sheet — Bản sao đối soát (API làm lớp trước, rồi ghi Sheet)

### Mục đích

- **Chỉ là bản sao đối soát**, không phải database chính (Quyết định 5; nguyên tắc “Một nguồn sự thật” — nguồn chính là PostgreSQL trên Supabase).
- Dùng để admin đối soát lead / đơn trong giai đoạn chuyển đổi, và làm handler thật cho newsletter footer (Quyết định 6: ghi vào Sheet / dịch vụ email).
- Bỏ khi API lead ổn định.

### Cách tích hợp

- **API làm lớp trước, rồi ghi Sheet** (Quyết định 5):
  1. Frontend → `POST /api/leads` (Cloudflare Workers API).
  2. Workers validate (SĐT `^0\d{9}$`, email TLD ≥ 2 ký tự, `province` trong 34 tỉnh/thành, `course_id` tồn tại và `published`), chống spam (honeypot + rate-limit + idempotency + CAPTCHA), chống trùng (idempotency key).
  3. Workers ghi lead vào bảng `leads` trong Supabase, trả `reference_code` (VD `VISFAR-2026-000123`) cho người đăng ký — **không có nhánh fallback “thành công giả”** (xem lưu ý Quyết định 3: nhánh fallback trên trang hiện tại được giữ nguyên theo ý chủ dự án; luồng API mới này không dùng nhánh đó — nếu API lỗi, client hiện lỗi, không hiện cảm ơn).
  4. Workers ghi thêm 1 dòng vào Google Sheet (bản sao đối soát) — ghi sau khi đã ghi Supabase; nếu ghi Sheet lỗi, lead trong Supabase vẫn giữ nguyên và ghi log để đối soát lại (không báo “thành công giả” ngược lại, không mất lead).
- Được phép sửa + deploy lại file Google Apps Script (`.gs`) khi cần cho luồng này (Quyết định 5).
- Sheet không còn là đường ghi duy nhất; mọi báo cáo chỉ đọc từ database, không đọc từ Sheet (xem §11 Tài liệu kiến trúc tổng thể).
- Đối soát hàng ngày: admin mở báo cáo R9 — kiểm tra Sheet khớp với `leads` trong database.
- Newsletter footer (Quyết định 6): form + handler thật — ghi vào Sheet / dịch vụ email (chốt đích ghi khi lập trình: Sheet đối soát hoặc bảng `newsletter_subscribers` trong Supabase — ưu tiên Supabase làm chính, Sheet làm bản sao nếu cần).

### Secret cần có (chỉ ghi tên biến, KHÔNG ghi giá trị thật)

| Biến | Dùng ở đâu | Ghi chú |
|---|---|---|
| `GOOGLE_SHEET_ID` | Workers API | ID của Google Sheet đối soát |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Workers API (ghi Sheet) | Service account để Workers ghi Sheet; **chỉ ghi tên biến, không ghi giá trị**; cấp quyền tối thiểu (chỉ Sheet đối soát) |
| `GOOGLE_SHEETS_API_KEY` | Workers API (phương án thay thế) | Chỉ dùng nếu chọn tích hợp bằng API key thay vì service account — chọn 1 trong 2 khi triển khai, không dùng cả hai |
| `APPS_SCRIPT_WEB_APP_URL` | Workers API / cấu hình (nếu giữ Apps Script làm cầu nối) | URL Web App của file `.gs` đã deploy — chỉ dùng nếu luồng triển khai giữ Apps Script; nếu Workers gọi trực tiếp Google Sheets API thì không cần biến này |

### Giới hạn miễn phí

| Hạng mục | Giới hạn |
|---|---|
| Google Sheet | Giới hạn của Google (không phải giới hạn chính của hệ thống) |
| Google Sheets API | Hạn ngạch gọi API của Google — tra cứu tại thời điểm triển khai, ghi vào tài liệu vận hành |

### Điểm chạm đầu tiên

Chỉ dùng làm bản sao đối soát nên khó chạm giới hạn trước các dịch vụ chính. Điểm chạm thực tế là **đồng bộ lệch**: Sheet ghi lỗi / ghi chậm trong khi Supabase đã ghi — cần log và đối soát hàng ngày (R9) để phát hiện.

### Phương án thay thế / nâng cấp

- **Bỏ Sheet khi API lead ổn định** — admin làm việc trực tiếp trên dashboard admin (`/admin/lead`) và báo cáo R1–R2, không cần bản sao Sheet nữa.
- **Nếu Sheet lỗi thường xuyên:** dừng ghi Sheet tạm thời, lead vẫn ghi đầy đủ vào Supabase; khôi phục ghi Sheet sau khi sửa Apps Script / quyền service account; đối soát bù từ `leads` trong database.
- **Không nâng cấp trả phí cho Sheet** — Sheet chỉ là bản sao tạm; nếu cần báo cáo mạnh hơn, dùng báo cáo trong database (§11 Tài liệu kiến trúc tổng thể), không mua gói Google trả phí cho mục đích này.

---

## 9. Thứ tự tích hợp và phụ thuộc giữa các dịch vụ

Thứ tự dưới đây là thứ tự **tích hợp** (không phải thứ tự viết code chi tiết — code chỉ bắt đầu sau khi kiến trúc được phê duyệt).

| Bước | Dịch vụ | Làm gì ở bước này | Phụ thuộc |
|---|---|---|---|
| 0 | — | **Phê duyệt kiến trúc** (tài liệu này + Tài liệu kiến trúc tổng thể + 19 quyết định). Chốt domain API, framework đã chốt là Next.js (Quyết định 19). Xác minh lại giới hạn miễn phí trên trang pricing chính thức của từng dịch vụ. | — |
| 1 | **GitHub** | Tạo repo, branch protection cho `main`, workflow CI (`ci.yml`), cấu trúc thư mục (§2 Tài liệu kiến trúc tổng thể). | Bước 0 |
| 2 | **Supabase** | Tạo 2 project (prod + staging); migration schema + RLS; seed 10 khóa học; bật cron giữ ấm (sau khi có Workers, xem bước 4). | Bước 1 (migration + seed lưu trong repo) |
| 3 | **Cloudflare Pages** | Kết nối repo GitHub → Pages; deploy Next.js (trang công khai đọc trực tiếp Supabase); đặt CSP / header. | Bước 1, 2 |
| 4 | **Cloudflare Workers** | Dựng Workers API (lead, enrollment, tiến độ, quiz, order, webhook, báo cáo); rate-limit, idempotency, CAPTCHA, validation server; cron giữ ấm Supabase + cron email nhắc. | Bước 2 (Supabase), 3 (Pages gọi API) |
| 5 | **Resend** | Xác minh domain riêng (SPF, DKIM, DMARC); tạo template E1–E13; nối Workers → Resend; nối webhook trạng thái email → `email_logs`; kiểm tra giới hạn 100 email/ngày. | Bước 4 (Workers gọi Resend) |
| 6 | **Google Sheet** | API làm lớp trước, rồi ghi Sheet (Quyết định 5); sửa / deploy lại file `.gs` nếu cần; đối soát Sheet ↔ `leads` trong Supabase; handler newsletter thật. | Bước 4 (Workers API lead), 2 (Supabase là nguồn chính) |
| 7 | **YouTube (unlisted)** | Đăng video bài giảng ở chế độ unlisted; lưu `video_url` vào `lessons`; kiểm tra embed chỉ trả video URL cho người đã ghi danh hoặc bài xem thử. | Bước 2 (bảng `lessons`), 4 (API trả video URL theo quyền) |
| 8 | **SePay** | **Chỉ khi được phê duyệt.** Xác minh giá SePay; tạo merchant; nối webhook `POST /api/webhooks/sepay` (xác minh chữ ký, đối soát theo `reference_code`, kiểm tra số tiền khớp); kiểm tra idempotency webhook; giữ luồng chuyển khoản thủ công làm dự phòng. | Bước 4 (Workers webhook), 5 (email “Đã nhận thanh toán”), phê duyệt riêng |

**Sơ đồ phụ thuộc (tóm tắt):**

```
GitHub ──► Supabase ──► Cloudflare Pages (đọc công khai)
   │            │
   │            ▼
   └────► Cloudflare Workers ──► Resend (email)
                 │  │
                 │  ├─► Google Sheet (bản sao đối soát)
                 │  ├─► YouTube unlisted (video_url theo quyền)
                 │  └─► SePay (chỉ khi phê duyệt — webhook đối soát)
                 │
                 ▼
           PostgreSQL (Supabase) — nguồn sự thật duy nhất
```

**Lưu ý phụ thuộc quan trọng:**

- Workers API phụ thuộc Supabase (database + Auth) — không có Supabase thì API không có nơi ghi.
- Pages phụ thuộc GitHub (deploy) và Supabase (đọc công khai); Pages không phụ thuộc Workers cho nội dung công khai.
- Resend phụ thuộc Workers (chỉ Workers gọi Resend) và phụ thuộc xác minh DNS domain riêng.
- Google Sheet phụ thuộc Workers API lead — Sheet không bao giờ là đường ghi duy nhất.
- SePay phụ thuộc Workers webhook + phê duyệt riêng + xác minh giá; SePay không chặn các bước 1–7.
- YouTube không phụ thuộc dịch vụ nào khác ngoài bảng `lessons` và kiểm tra quyền ở API.

---

## 10. Checklist trước khi tích hợp (từng dịch vụ)

- [ ] Đã xác minh lại giới hạn miễn phí trên trang pricing chính thức của Supabase, Cloudflare, Resend tại thời điểm bắt đầu lập trình (số trong tài liệu này tra cứu ngày 10/11/2026, có thể thay đổi).
- [ ] Đã có tài khoản: Supabase (project prod + staging), Cloudflare (Pages + Workers), Resend (domain đã xác minh DNS), GitHub (repo + branch protection).
- [ ] Đã có danh sách secret theo tên biến ở §1–§8, lưu trong Cloudflare Workers Secrets + GitHub Secrets; không commit `.env`.
- [ ] Đã quyết: domain API (cần user phê duyệt; tạm thời `*.workers.dev`).
- [ ] Đã có kế hoạch test RLS (học viên A không đọc được dữ liệu học viên B) và test lead (POST thật, đối soát Sheet / database).
- [ ] SePay: **chưa triển khai** cho tới khi user phê duyệt; đã xác minh giá SePay tại thời điểm triển khai.
- [ ] Ngân hàng: MB Bank, chủ tài khoản Công ty TNHH MTV Visfar Holdings; số tài khoản **không ghi vào tài liệu** — chỉ dùng từ ảnh chụp / file QR do user cung cấp; có thể sử dụng QR Code cũ; không tự tạo QR mới từ thông tin chưa xác nhận.

---

## Quyết định cần phê duyệt

Tài liệu này ở trạng thái **“Chờ phê duyệt kiến trúc”**. Các quyết định dưới đây cần user phê duyệt trước khi bắt đầu viết code / tạo database / deploy:

1. **Phê duyệt kế hoạch tích hợp này** (thứ tự 8 bước ở §9, phụ thuộc giữa các dịch vụ, secret theo tên biến ở §1–§8).
2. **Phê duyệt Tài liệu kiến trúc tổng thể** (đặc biệt §12 — giới hạn miễn phí và phương án nâng cấp) cùng với tài liệu này, vì hai tài liệu đi cùng nhau.
3. **Domain API:** phê duyệt domain `https://api.visfaracademy.vn` (hoặc domain khác do user chọn); tạm thời dùng `*.workers.dev` trong giai đoạn dev nếu chưa chốt domain.
4. **SePay:** phê duyệt riêng việc triển khai SePay (bước 8) — chỉ triển khai sau khi phê duyệt; giá SePay **cần xác minh lại** tại thời điểm triển khai và trình user trước khi mua.
5. **Nâng cấp trả phí khi chạm giới hạn miễn phí** (Quyết định 18): xác nhận lại nguyên tắc nâng cấp khi chạm giới hạn (Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng — **giá cần xác minh lại** trước khi nâng); mỗi lần nâng cụ thể vẫn cần phê duyệt riêng tại thời điểm đó.
6. **Google Sheet:** xác nhận luồng “API làm lớp trước, rồi ghi Sheet” (Quyết định 5) và thời điểm bỏ Sheet khi API lead ổn định.
7. **YouTube unlisted:** xác nhận lại việc chấp nhận đánh đổi bảo mật (Quyết định 16) và thời điểm chuyển sang dịch vụ video có bảo mật (Cloudflare Stream / Mux / Vimeo Pro — có phí, **giá cần xác minh lại**, cần phê duyệt riêng).
8. **Resend domain gửi:** phê duyệt domain gửi email riêng và việc xác minh DNS (SPF, DKIM, DMARC).

**Sau khi phê duyệt:** bắt đầu Task tiếp theo theo thứ tự §9 (GitHub → Supabase → Cloudflare Pages → Cloudflare Workers → Resend → Google Sheet → YouTube → SePay khi phê duyệt). **Trước khi phê duyệt: chưa viết code, chưa tạo database, chưa deploy.**
