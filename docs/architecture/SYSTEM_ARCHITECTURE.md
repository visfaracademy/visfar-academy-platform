# SYSTEM ARCHITECTURE — Nền tảng Visfar Academy (TASK 02)

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt kiến trúc
**Phạm vi:** Chưa viết code, chưa tạo database, chưa deploy. Tài liệu này chỉ mô tả kiến trúc để chủ dự án kiểm tra và phê duyệt.
**Nguồn đầu vào:**

- `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (Tài liệu kiến trúc tổng thể v1.0, 10/11/2026)
- `workspace/visfar-academy-platform/docs/DECISIONS.md` (19 quyết định đã chốt ngày 10/11/2026)
- `workspace/visfar-academy-platform/docs/audit/WEBSITE_AUDIT.md` (Task 01, 10/11/2026)

**File HTML gốc không bị sửa đổi bởi tài liệu này.** Mọi nội dung thương hiệu, triết lý Giáo dục Tận Gốc, 3 trụ cột Tâm thức – Trí tuệ – Nhân hiệu, màu đen than – vàng gold – ivory champagne, font Be Vietnam Pro và thứ tự 10 khóa học 01–10 được giữ nguyên, chuyển sang hệ thống mới dưới dạng dữ liệu.

---

## 1. Nguyên tắc kiến trúc (bất di bất dịch)

1. **0 đồng trước, trả phí chỉ khi được phê duyệt.** Không dùng dịch vụ trả phí nào nếu chưa được chủ dự án phê duyệt. Mọi dịch vụ miễn phí đều được ghi rõ giới hạn, điểm chạm giới hạn và phương án thay thế (xem §12).
2. **Một nguồn sự thật.** Lead, học viên, khóa học, đơn hàng mỗi thứ chỉ có 1 bảng chính trong PostgreSQL. Google Sheet (nếu còn dùng) chỉ là bản sao đối soát, không phải database chính.
3. **Mọi form đều có xác nhận thật.** Không còn “thành công giả”. Mọi lần gửi đều có mã tham chiếu và trạng thái đối soát được. (Lưu ý: theo Quyết định 3, nhánh fallback form trên trang hiện tại được giữ nguyên cho tới khi nền tảng mới thay thế; nền tảng mới không có nhánh fallback “thành công giả”.)
4. **Bảo mật theo mặc định.** Row Level Security (RLS) bật trên mọi bảng; client không bao giờ chạm trực tiếp vào dữ liệu của người khác; mọi thao tác nhạy cảm đi qua API có xác thực và kiểm tra quyền ở server.
5. **Tách lớp rõ ràng.** Frontend, API, database, storage, email là 5 lớp độc lập — thay 1 lớp không phải viết lại 4 lớp còn lại.
6. **Không tin client.** Mọi validation đều làm lại ở server; không bao giờ tin client báo “đã trả”; đáp án đúng của quiz không bao giờ trả về cho client.

---

## 2. Sơ đồ tổng thể (ASCII)

```
┌──────────────────────────────────────────────────────────────┐
│                        NGƯỜI DÙNG                             │
│   Khách · Học viên · Giảng viên · Admin (Lê Đăng Quyết)       │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE EDGE                               │
│  ┌────────────────────────────┐   ┌───────────────────────────────┐  │
│  │  Cloudflare Pages          │   │  Cloudflare Workers (API)     │  │
│  │  Next.js App Router        │   │  /api/leads, /api/enrollments │  │
│  │  - Trang công khai         │   │  /api/progress, /api/quiz     │  │
│  │  - Khu vực học viên        │   │  /api/orders, /api/webhooks   │  │
│  │  - Admin (route riêng)     │   │  /api/reports (admin)         │  │
│  │  - Static assets, CDN      │   │  Rate-limit, validation,      │  │
│  │  - Preview deployment      │   │  idempotency, JWT verify      │  │
│  └──────────────┬─────────────┘   └───────────────┬───────────────┘  │
└─────────────────┼─────────────────────────────────┼──────────────────┘
                  │                                 │
        ┌─────────┴──────────┐            ┌─────────┴──────────┐
        ▼                    ▼            ▼                    ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SUPABASE         │ │ SUPABASE     │ │ RESEND       │ │ GOOGLE SHEET │
│ - PostgreSQL     │ │ STORAGE      │ │ - Email giao │ │ (tạm, bản   │
│ - Auth (JWT)     │ │ - Ảnh,poster │ │   dịch       │ │  sao đối     │
│ - RLS mọi bảng   │ │ - PDF, tài   │ │ - Automation │ │  soát lead)  │
│ - Realtime (ít)  │ │   liệu       │ │ - Webhook    │ │ - Không phải │
│ - Edge Functions │ │ - Bucket     │ │   trạng thái │ │   DB chính   │
│   (dự phòng)     │ │   theo quyền │ │              │ │ - Bỏ khi API │
└──────────────────┘ └──────────────┘ └──────────────┘ │   lead ổn    │
        │                                              │   định       │
        ▼                                              └──────────────┘
┌──────────────────┐
│ GITHUB           │
│ - Code, PR, CI   │
│ - Deploy tự động │
│   Cloudflare     │
│   Pages          │
└──────────────────┘

        ┌───────────────────────────────────────────────────┐
        │  VIDEO: YouTube unlisted (embed) — xem §7.2       │
        │  THANH TOÁN: MB Bank, chuyển khoản thủ công (§8)   │
        │  + SePay webhook khi được phê duyệt (§8.3)         │
        └───────────────────────────────────────────────────┘
```

**Luồng đọc dữ liệu công khai** (khóa học, bài viết, sự kiện): Frontend → Supabase trực tiếp (anon key, RLS cho phép đọc công khai), hoặc qua Workers API khi cần cache/lọc phức tạp. Ưu tiên đọc trực tiếp qua Supabase để giảm tải Workers (giới hạn 100.000 request/ngày, xem §12).

**Luồng ghi dữ liệu** (đăng ký, tiến độ, đơn hàng): Frontend → Cloudflare Workers API (xác thực JWT, validation server, rate-limit, idempotency) → Supabase. Không cho client ghi trực tiếp vào bảng nhạy cảm (`orders`, `payments`, `lesson_progress`) bằng anon key.

**Luồng lead (theo Quyết định 5):** API làm lớp trước — nhận lead, validate / chống spam / chống trùng — rồi ghi vào Google Sheet (bản sao đối soát). Sheet không còn là đường ghi duy nhất.

**Luồng video:** Frontend → YouTube embed (unlisted). Không stream video qua Supabase Storage hay Workers.

---

## 3. Kiến trúc frontend

**Đã chốt (Quyết định 19): Next.js (App Router) trên Cloudflare Pages.** Không còn mâu thuẫn Next.js / Astro / WordPress + LMS.

| Hạng mục | Quyết định |
|---|---|
| Framework | Next.js, App Router |
| Hosting | Cloudflare Pages (static hosting, CDN toàn cầu, preview deployment) |
| Adapter | `@cloudflare/next-on-pages` (cần xác minh tương thích tại thời điểm triển khai) |
| Design system | Giữ nguyên: nền ivory champagne `#FDFBF3` / `#F8F1D7`, chữ `#16130c`, vàng gold `#a8841c`, gradient tiêu đề chéo 135°, font Be Vietnam Pro, khung 1380px, đệm `clamp(18px,4.5vw,32px)`, thẻ trắng viền vàng đôi mảnh, bo 12px |
| Responsive | Mobile-first; thân bài ≥ 16px; nút chạm ≥ 44px; không tràn ngang; bố cục 1 cột trên điện thoại |
| Hiệu năng | Ảnh/file tách khỏi HTML (không còn base64 5,5 MB như file hiện tại); `srcset`/`sizes`; lazy loading; font `.woff2` subset tiếng Việt; mục tiêu file HTML đầu tiên < 500 KB |
| SEO | `<h1>` thật cho trang chính; OG / Twitter / canonical / JSON-LD (Organization + Course); sitemap.xml; chính sách có URL thật (Quyết định 11, 13) |

**Routes (theo Quyết định 11 — sitemap mới):**

- Công khai: `/`, `/gioi-thieu/*`, `/linh-vuc/*`, `/chuong-trinh`, `/chuong-trinh/[slug]`, `/doanh-nghiep`, `/chia-se`, `/su-kien` (tách khỏi `/blog`), `/su-kien/[slug]`, `/blog`, `/blog/[slug]`, `/faq`, `/tu-van`, `/chinh-sach/*` (URL thật, không còn hash giả).
- Cần đăng nhập: `/hoc-vien/dashboard`, `/hoc-vien/khoa-hoc`, `/hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]`, `/hoc-vien/chung-chi`, `/hoc-vien/ho-so`.
- Admin (role `admin`): `/admin`, `/admin/khoa-hoc`, `/admin/hoc-vien`, `/admin/lead`, `/admin/don-hang`, `/admin/su-kien`, `/admin/blog`, `/admin/chinh-sach`, `/admin/bao-cao`.
- Auth: `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`.

**Lưu ý đã chốt liên quan tới frontend:**

- Tuyên ngôn 1a/1b ở 13,65px trên điện thoại 390px: **chấp nhận hiện tại** (Quyết định 1). Giữ mỗi cụm đúng 1 dòng, không thu hẹp đệm trang.
- Nhãn Tam giác hiện thực ~3,98px ở 390px: **chấp nhận hiện tại** (Quyết định 2). Không khôi phục legend, không tách sơ đồ, không thêm chạm-vòng-hiện-nhãn-lớn.
- 3 sự kiện chuyển sang tháng 11, ngày **25/11/2026 cho cả 3 sự kiện**. Giờ và hình thức từng sự kiện chưa được cung cấp — **không tự bịa**, chờ chủ dự án gửi sau.
- Dọn nợ CSS thực hiện ngay trên file HTML hiện tại (Quyết định 12), song song với việc xây nền tảng mới — không đóng băng hoàn toàn để chờ nền tảng mới.

---

## 4. Kiến trúc backend

**Cloudflare Workers API + Supabase** (Postgres, Auth, Storage, Realtime).

| Hạng mục | Quyết định |
|---|---|
| API runtime | Cloudflare Workers (TypeScript, router Hono hoặc itty-router) |
| Base URL | `https://api.visfaracademy.vn` (custom domain — cần phê duyệt domain; tạm dùng `*.workers.dev` trong giai đoạn dev) |
| Auth | `Authorization: Bearer <Supabase JWT>` cho endpoint cần đăng nhập; endpoint công khai không cần JWT nhưng vẫn rate-limit theo IP |
| Định dạng | JSON. Lỗi: `{ "ok": false, "error": "ma_loi", "message": "…" }`. Thành công: `ok: true` |
| Idempotency | Mọi POST tạo dữ liệu (lead, order, quiz submit) nhận header `Idempotency-Key` (UUID do client sinh); server trả lại kết quả cũ nếu key trùng |
| Rate-limit | Theo IP + user. Ví dụ: lead tối đa 5 lần/giờ/IP; đăng nhập tối đa 10 lần/15 phút/IP. Vượt → 429, không ghi dữ liệu |
| Chống spam | Honeypot + rate-limit + idempotency **và** CAPTCHA (Quyết định 4 — thêm cả hai) |
| Secret | Supabase service-role key, Resend API key, webhook secret chỉ trong Cloudflare Workers Secrets / GitHub Secrets; không commit vào repo; `workers/api` là nơi duy nhất được cầm service-role key |

**Vì sao tách Workers API ra khỏi Supabase trực tiếp:** đọc nội dung công khai thì Supabase trực tiếp là đủ; nhưng đăng ký lead, ghi tiến độ, nộp quiz, tạo đơn, báo cáo admin và gửi email đều phải qua Workers để validation server, chống spam, chống gian lận điểm, xác minh webhook và gọi Resend bằng API key ở server.

**Endpoint chính (tóm tắt; đặc tả đầy đủ ở tài liệu API khi lập trình):**

- Công khai: `GET /api/courses`, `GET /api/courses/:slug`, `GET /api/posts[/:slug]`, `GET /api/events[/:slug]`, `GET /api/policies/:slug`, `POST /api/leads`, `POST /api/newsletter`, `POST /api/newsletter/unsubscribe`.
- Học viên: `GET /api/my/enrollments`, `POST /api/my/enrollments`, `GET /api/my/courses/:slug/lessons`, `GET /api/my/lessons/:lessonId`, `POST /api/my/progress`, `POST /api/my/progress/complete`, `GET /api/my/quiz/:lessonId`, `POST /api/my/quiz/:lessonId/submit`, `GET /api/my/certificates`, `GET /api/my/orders`, `PATCH /api/my/profile`, `GET /api/me`.
- Đơn hàng & thanh toán: `POST /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/cancel`, `POST /api/webhooks/sepay`, `POST /api/webhooks/stripe`, `POST /api/webhooks/resend`.
- Admin: `GET /api/admin/leads`, `PATCH /api/admin/leads/:id`, `GET /api/admin/orders`, `POST /api/admin/orders/:id/mark-paid`, `POST /api/admin/orders/:id/refund`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, quản lý khóa/bài, `GET /api/admin/reports/*`, `GET /api/admin/audit-logs`.

---

## 5. Database — PostgreSQL trên Supabase

**Schema đã thống nhất ở Module 1 — KHÔNG tự ý thay đổi trong tài liệu này.** Mọi thay đổi schema sau này chỉ bằng migration mới, đánh số thứ tự, không sửa migration cũ.

| Bảng | Vai trò |
|---|---|
| `profiles` | Hồ sơ người dùng, 1–1 với `auth.users`; `role` ∈ (`student`, `instructor`, `admin`) |
| `courses` | 10 khóa học hiện tại (giữ nguyên thứ tự hiển thị 01–10) + khóa mới; `price_vnd` integer (VND, 0 = miễn phí / Tùy tâm) |
| `modules` | Chương / module trong khóa học |
| `lessons` | Bài học (`video`, `text`, `quiz`, `file`); `video_url` là link YouTube unlisted; `is_free_preview` |
| `quiz_questions`, `quiz_options` | Câu hỏi và lựa chọn trắc nghiệm; `is_correct` không bao giờ trả về client |
| `enrollments` | Ghi danh (học viên ↔ khóa học), UNIQUE (`user_id`, `course_id`) |
| `lesson_progress` | Tiến độ từng bài học, UNIQUE (`user_id`, `lesson_id`) |
| `quiz_attempts` | Bài làm quiz (điểm, đáp án đã chọn) |
| `leads` | Đăng ký tư vấn; `reference_code` (VD `VISFAR-2026-000123`), `idempotency_key`, `status` ∈ (`new`, `contacted`, `enrolled`, `closed`, `spam`) |
| `orders` | Đơn hàng; `reference_code` (VD `DH-2026-000123`, dùng làm nội dung chuyển khoản); `status` ∈ (`pending`, `paid`, `cancelled`, `refunded`, `expired`) |
| `payments` | Giao dịch thanh toán; UNIQUE (`method`, `gateway_reference`) khi có mã cổng |
| `certificates` | Chứng chỉ hoàn thành; `certificate_code` duy nhất |
| `events` | Sự kiện; `status` ∈ (`upcoming`, `happened`, `cancelled`) |
| `event_registrations` | Đăng ký sự kiện, UNIQUE (`event_id`, `email`) |
| `posts` | Bài blog (Markdown) |
| `policies` | Chính sách có versioning (`version`, `is_current`) |
| `email_logs` | Nhật ký email để đối soát Resend |
| `newsletter_subscribers` | Đăng ký nhận tin (sửa lỗi newsletter giả trên trang hiện tại) |
| `audit_logs` | Nhật ký thao tác admin |

**Quy ước chung:** mọi bảng có `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at` / `updated_at timestamptz DEFAULT now()`; không xóa cứng dữ liệu nghiệp vụ (dùng `deleted_at` hoặc trạng thái); tiền lưu bằng `integer` (VND, không dùng float); index trên mọi cột lọc/tìm kiếm thường xuyên.

**Quyết định đã chốt áp dụng cho schema (Quyết định 17):** `lessons.slug` UNIQUE theo **module** (không theo khóa). Ngưỡng hoàn thành bài: video ≥ 90%, bài text bấm “Đã hoàn thành”, tính theo module.

---

## 6. Authentication & Authorization

### 6.1. Authentication — Supabase Auth

- Đăng ký / đăng nhập bằng email + mật khẩu; JWT do Supabase Auth cấp; Workers xác minh JWT bằng Supabase JWKS, không tin JWT do client tự khai.
- `profiles` được tạo qua trigger khi đăng ký; `role` mặc định `student`.
- Quên / đặt lại mật khẩu qua Supabase Auth (email gửi qua Resend + Supabase SMTP).
- Token hết hạn → refresh theo chuẩn Supabase.

### 6.2. Authorization — RBAC + RLS (2 lớp)

**RBAC — 3 vai trò:**

| Role | Quyền |
|---|---|
| `student` | Xem khóa đã ghi danh + bài xem thử; học bài, làm quiz, xem tiến độ và chứng chỉ của mình; sửa hồ sơ của mình; đăng ký sự kiện; tạo lead/đơn cho chính mình |
| `instructor` | Mọi quyền của `student` + xem học viên và tiến độ của khóa mình phụ trách; sửa nội dung bài học của khóa mình phụ trách (không sửa giá, không sửa đơn hàng, không xem lead) |
| `admin` | Mọi quyền; quản lý khóa học, học viên, lead, đơn hàng, thanh toán, sự kiện, blog, chính sách, báo cáo; cấp/thu hồi role |

Không có role `superadmin` riêng trong giai đoạn đầu — `admin` là cao nhất.

**RLS — bật trên mọi bảng, mặc định từ chối:**

- Anon key chỉ đọc nội dung công khai (`courses`/`posts`/`events`/`policies` đã published/hiện hành).
- Học viên chỉ đọc/ghi dữ liệu của chính mình (`enrollments`, `lesson_progress`, `orders`, `certificates`).
- `leads`, `payments`, `email_logs`, `audit_logs`: chỉ admin đọc; không có policy INSERT cho client — ghi qua Workers bằng service-role.
- `quiz_options`: client chỉ đọc qua VIEW `quiz_options_public` (không có cột `is_correct`); bảng gốc chỉ Workers đọc để chấm điểm.
- Service-role key chỉ ở Workers API, không bao giờ ở frontend.

**Bảo mật khác:** validation server cho mọi field (SĐT `^0\d{9}$`, email TLD ≥ 2 ký tự, `province` trong 34 tỉnh/thành, `course_id` tồn tại và published); webhook xác minh chữ ký; PII không đưa vào log (log chỉ ghi `reference_code` và `user_id`); CSP + header bảo mật trên Cloudflare Pages; không dùng `innerHTML` với dữ liệu người dùng.

**Lưu ý theo Quyết định 8:** hộp xác nhận dự phòng trên trang hiện tại vẫn giữ `mailto:` + nút sao chép chứa họ tên/SĐT/email. Đây là quyết định của chủ dự án sau khi đội ngũ đã cảnh báo rủi ro (PII lộ qua email client / lịch sử trình duyệt / clipboard). Nền tảng mới giảm thiểu bằng mã tham chiếu + đối soát, không tự ý đổi ngược quyết định này trên trang hiện tại.

---

## 7. File storage & video delivery

### 7.1. File storage — Supabase Storage (giai đoạn đầu) → Cloudflare R2 (khi vượt giới hạn)

- Bucket `public`: poster, ảnh khóa học, ảnh sự kiện, logo.
- Bucket `private`: tài liệu bài học — chỉ học viên đã ghi danh mới lấy được signed URL, hết hạn sau 1 giờ.
- Ảnh/file tách khỏi HTML, không còn base64 trong file trang.
- Khi Supabase Storage 1 GB hết: chuyển sang Cloudflare R2 (10 GB miễn phí, không phí egress) — xem §12.

### 7.2. Video delivery — YouTube unlisted (đánh đổi đã chấp nhận)

**Đã chốt (Quyết định 16): chấp nhận đánh đổi.** Video bài giảng đăng lên YouTube ở chế độ không công khai (unlisted), nhúng bằng YouTube embed; `video_url` lưu trong `lessons.video_url`.

- Ưu điểm: miễn phí, không giới hạn dung lượng, CDN toàn cầu. Supabase Storage 1 GB không đủ chứa video; Workers không stream video.
- Đánh đổi phải ghi rõ: video unlisted **không phải là bảo mật thật** — ai có link đều xem được, không chống tải xuống, không có DRM.
- Phương án thay thế khi cần bảo mật hơn (cần phê duyệt, có phí — giá cần xác minh lại): Cloudflare Stream, Mux hoặc Vimeo Pro — video có signed URL, hết hạn, chống tải. Chuyển sang khi doanh thu khóa học đủ bù chi phí, hoặc khi phát hiện video bị chia sẻ trái phép.
- **Không dùng Supabase Storage cho video.**

---

## 8. Payment — SePay + MB Bank, chuyển khoản thủ công giai đoạn đầu

**Đã chốt (Quyết định 15): dùng SePay. Tài khoản ngân hàng MB Bank, chủ tài khoản là Công ty TNHH MTV Visfar Holdings.** Số tài khoản **không ghi vào tài liệu này** — chỉ dùng từ ảnh chụp / file QR do chủ dự án cung cấp khi cần tạo khối thanh toán / VietQR. Có thể sử dụng QR Code cũ; không tự tạo QR mới từ thông tin chưa xác nhận.

### 8.1. Giai đoạn đầu (0 đồng) — chuyển khoản thủ công + đối soát

1. Học viên chọn khóa → `POST /api/orders` → tạo đơn `pending`, mã `reference_code` (VD `DH-2026-000123`), `expires_at` = +48h.
2. Hiện QR VietQR (từ file/QR do chủ dự án cung cấp) + ngân hàng MB Bank + chủ tài khoản Công ty TNHH MTV Visfar Holdings + số tiền + nội dung chuyển khoản = mã đơn.
3. Học viên chuyển khoản bằng app ngân hàng.
4. Admin kiểm tra sao kê mỗi ngày → `POST /api/admin/orders/:id/mark-paid` → tạo `payments` (`bank_transfer`, `succeeded`) → đơn `paid` → tạo `enrollments` → gửi email “Đã nhận thanh toán”.
5. Email nhắc “chưa thanh toán” sau 12h và 24h; đơn quá hạn → `expired`, học viên tạo đơn mới.

**Nguyên tắc:** không bao giờ tin client báo “đã trả”. Đơn chỉ chuyển sang `paid` khi webhook cổng xác minh chữ ký, hoặc admin xác nhận thủ công sau khi kiểm tra sao kê.

### 8.2. Học phí Tùy tâm

Khóa 07 (và các khóa Tùy tâm khác) dùng `price_vnd = 0` + `custom_amount_vnd` do học viên nhập. Khóa miễn phí (`price_vnd = 0`, không Tùy tâm) ghi danh trực tiếp qua `POST /api/my/enrollments`, không qua đơn hàng. Khóa “Cộng đồng Visfar” ghi danh mở, không cần thanh toán.

### 8.3. SePay (tự động đối soát — triển khai sau khi phê duyệt)

SePay webhook → `POST /api/webhooks/sepay`: xác minh chữ ký → tìm đơn theo `reference_code` trong nội dung chuyển khoản → kiểm tra số tiền khớp (không chấp nhận thiếu/thừa) → tạo `payments` (`succeeded`) + đơn `paid` + enrollment + email. Idempotency: UNIQUE (`method`, `gateway_reference`) — webhook gửi lại không tạo trùng. **SePay có gói trả phí — giá cần xác minh lại tại thời điểm triển khai, không giả định miễn phí.**

### 8.4. Stripe (thanh toán thẻ quốc tế — chỉ khi được phê duyệt)

Chưa triển khai cho tới khi phê duyệt; cần xác minh Stripe có hỗ trợ tài khoản Việt Nam và phí giao dịch tại thời điểm triển khai (giá cần xác minh lại). Luồng: Workers tạo Checkout Session / PaymentIntent → học viên trả bằng thẻ trên trang Stripe → webhook xác minh chữ ký → `payments` + đơn `paid` + enrollment + email.

### 8.5. Hoàn trả / khiếu nại (đã chốt — Quyết định 9)

- Hoàn trả: **15 ngày làm việc** (xử lý hoàn trả).
- Khiếu nại: **3 ngày** (phản hồi khiếu nại).
- Luồng: học viên yêu cầu hoàn trả → admin kiểm tra khung thời gian → đơn `refunded`, tạo bản ghi `payments` hoàn trả, gửi email xác nhận, thu hồi enrollment (`status = revoked`). Hoàn trả chuyển khoản thủ công: admin chuyển khoản lại, ghi `gateway_reference` là mã giao dịch hoàn.

---

## 9. Email — Resend

- Mọi email gửi qua Workers API (gọi Resend bằng API key ở server), **không gọi Resend từ frontend**.
- Mọi email ghi vào `email_logs` (người nhận, template, `resend_id`, trạng thái) để đối soát; webhook Resend cập nhật `delivered` / `bounced`.
- Email gửi từ domain riêng của Visfar (cần xác minh DNS: SPF, DKIM, DMARC). Không gửi từ `onboarding@resend.dev` cho người dùng thật.
- Template tiếng Việt, giọng văn tự nhiên, ít emoji, không thúc ép / FOMO mạnh.
- Hàng đợi nhắc (email nhắc thanh toán, nhắc học, nhắc sự kiện): dùng Cloudflare Workers Cron Trigger chạy mỗi giờ để quét và gửi. Không dùng hàng đợi trả phí nếu chưa phê duyệt.

**Bảng email automation (13 mẫu):** E1 chào mừng đăng ký tài khoản; E2 đặt lại mật khẩu; E3 lead đã ghi nhận (kèm mã tham chiếu); E4 báo lead mới cho admin; E5 đơn hàng mới (QR + ngân hàng + số tiền + mã đơn + hạn 48h); E6/E7 nhắc thanh toán sau 12h/24h; E8 đã nhận thanh toán; E9 hoàn thành khóa học + chứng chỉ; E10 nhắc học sau 7 ngày không học; E11 nhắc sự kiện trước 1 ngày; E12 xác nhận đăng ký nhận tin; E13 xác nhận hoàn trả.

---

## 10. 12 phân hệ

### 10.1. Public Website — Trang công khai

- **Mục đích:** giới thiệu Visfar Academy, triết lý Giáo dục Tận Gốc, 10 khóa học, lĩnh vực, doanh nghiệp, học viên nói, blog, sự kiện, FAQ, chính sách và thu lead tư vấn. Đây là bộ mặt duy nhất khách mới nhìn thấy.
- **Thành phần:** Next.js App Router (SSR/static); Header 6 mục (Trang chủ, Giới thiệu, Các khóa học, Sự kiện, Blog, Kết nối); Hero + tuyên ngôn; Sứ mệnh & Tầm nhìn; Triết lý (Thập Nhất Viên Mãn, Lộ trình 6 bước, VISFAR HOME, Tam giác hiện thực); Lĩnh vực 6 thẻ; lưới 10 khóa học (tìm kiếm không dấu + lọc theo trụ cột); Doanh nghiệp; Testimonial 8 học viên; Blog; Sự kiện; FAQ; form tư vấn; footer + newsletter thật; trang con chính sách có URL thật.
- **Dữ liệu chính:** `courses` (published), `posts` (published), `events`, `policies` (bản hiện hành), `leads` (ghi qua API), `newsletter_subscribers`. Nội dung 3 khóa 04/05/06, thẻ Lĩnh vực 03, bước “Tin”, 3 bài blog là nội dung builder viết — **đã được chủ dự án duyệt (Quyết định 10)**.

### 10.2. Authentication — Xác thực

- **Mục đích:** đăng ký, đăng nhập, đăng xuất, quên/đặt lại mật khẩu an toàn, cấp JWT cho toàn bộ hệ thống.
- **Thành phần:** Supabase Auth (email + mật khẩu); trigger tạo `profiles` khi đăng ký; route `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`; Workers xác minh JWT bằng JWKS; refresh token; rate-limit đăng nhập (tối đa 10 lần/15 phút/IP).
- **Dữ liệu chính:** `auth.users` (do Supabase quản lý), `profiles` (`full_name`, `phone`, `email`, `province`, `role`, `avatar_url`).

### 10.3. Student Portal — Khu vực học viên

- **Mục đích:** nơi học viên thấy toàn bộ hành trình học của mình: khóa đã ghi danh, tiến độ, chứng chỉ, đơn hàng, hồ sơ.
- **Thành phần:** Dashboard (`/hoc-vien/dashboard`); danh sách khóa của tôi; trang bài học (video/text/quiz/file); “tiếp tục học” từ `last_position_sec`; trang chứng chỉ; trang hồ sơ; đăng ký sự kiện.
- **Dữ liệu chính:** `profiles` (của chính mình), `enrollments`, `lesson_progress`, `certificates`, `orders` (của mình), `event_registrations`.

### 10.4. LMS — Quản lý học tập

- **Mục đích:** tổ chức nội dung khóa học thành module → bài học và phân phối nội dung đúng quyền (bài xem thử công khai, bài còn lại chỉ học viên đã ghi danh).
- **Thành phần:** cấu trúc `courses` → `modules` → `lessons`; trình phát video YouTube unlisted; tài liệu đính kèm qua signed URL Storage (hết hạn 1 giờ); bài xem thử (`is_free_preview`); ghi danh khóa miễn phí / qua đơn đã trả; admin tặng khóa (ghi `audit_logs`).
- **Dữ liệu chính:** `courses`, `modules`, `lessons`, `enrollments`, `lesson_progress`. Ngưỡng hoàn thành: video ≥ 90%, bài text bấm “Đã hoàn thành”, tính theo module (Quyết định 17); `lessons.slug` UNIQUE theo module.

### 10.5. Assessment — Đánh giá (Quiz)

- **Mục đích:** kiểm tra hiểu bài bằng trắc nghiệm, chấm điểm ở server, lưu lịch sử làm bài.
- **Thành phần:** API lấy câu hỏi (không kèm `is_correct`); API nộp bài, chấm ở server, trả điểm + đáp án đúng chỉ sau khi nộp; lưu `quiz_attempts`; báo cáo câu hỏi nhiều người sai nhất.
- **Dữ liệu chính:** `quiz_questions`, `quiz_options` (đáp án đúng chỉ Workers đọc), `quiz_attempts` (`score`, `total`, `answers` jsonb), `lessons` (loại `quiz`).
- **Ghi chú:** không giới hạn số lần làm lại trong giai đoạn đầu; quiz không phải điều kiện bắt buộc để hoàn thành bài, trừ khi khóa học ghi rõ.

### 10.6. Instructor Portal — Khu vực giảng viên

- **Mục đích:** giảng viên quản lý nội dung và theo dõi học viên của khóa mình phụ trách, không chạm tới tiền và lead.
- **Thành phần:** danh sách khóa phụ trách; xem học viên + tiến độ từng khóa; tạo/sửa nội dung bài học của khóa phụ trách; xem báo cáo khóa phụ trách.
- **Dữ liệu chính:** `profiles` (role `instructor`), `courses`, `modules`, `lessons`, `enrollments`, `lesson_progress`, `quiz_attempts` (giới hạn theo khóa phụ trách).
- **Giới hạn quyền:** không sửa giá, không sửa đơn hàng, không xem lead, không cấp role. Việc gắn giảng viên với khóa phụ trách cần một bảng liên kết — **chưa có trong schema Module 1**, xem §14 (quyết định cần phê duyệt).

### 10.7. Admin Panel — Khu vực quản trị

- **Mục đích:** vận hành toàn bộ nền tảng: nội dung, học viên, lead, đơn hàng, thanh toán, sự kiện, blog, chính sách, báo cáo.
- **Thành phần:** route `/admin/*`; quản lý khóa/bài (tạo/sửa/xuất bản/lưu trữ); quản lý học viên + cấp/thu hồi role; quản lý lead (pipeline `new` → `contacted` → `enrolled` / `closed` / `spam`); quản lý đơn (xác nhận thanh toán thủ công, hoàn trả); quản lý sự kiện/blog/chính sách (versioning); xem `audit_logs`.
- **Dữ liệu chính:** toàn bộ bảng; thao tác nhạy cảm ghi `audit_logs` (`order.mark_paid`, `course.publish`, `lead.status`, …).

### 10.8. CRM — Quản lý lead & chăm sóc

- **Mục đích:** thu lead tư vấn, chống spam/trùng, chăm sóc tới khi thành học viên, đo tỷ lệ chuyển đổi.
- **Thành phần:** form tư vấn (`POST /api/leads`) với validation server, honeypot + CAPTCHA, rate-limit, idempotency, mã tham chiếu `VISFAR-…`; API ghi Sheet sau khi validate (Quyết định 5 — Sheet là bản sao đối soát); pipeline trạng thái lead; tìm/lọc lead theo trạng thái, nguồn, khóa, tỉnh, thời gian; liên kết lead với tài khoản cùng email khi lead đăng ký (liên kết bằng email, không FK cứng).
- **Dữ liệu chính:** `leads` (`reference_code`, `idempotency_key`, `full_name`, `phone`, `email`, `province`, `course_id`, `course_interest_text`, `source`, `status`, `notes`), `courses`, `orders` (khi lead thành đơn).

### 10.9. Payment — Thanh toán

- **Mục đích:** thu học phí (miễn phí / Tùy tâm / trả phí), đối soát và hoàn trả minh bạch.
- **Thành phần:** tạo đơn (`POST /api/orders`) với mã đơn duy nhất; khối chuyển khoản (QR VietQR từ file do chủ dự án cung cấp + MB Bank + chủ tài khoản Công ty TNHH MTV Visfar Holdings); xác nhận thủ công (`mark-paid`); SePay webhook (sau phê duyệt); Stripe (sau phê duyệt); hoàn trả theo khung 15 ngày làm việc; báo cáo đối soát R9.
- **Dữ liệu chính:** `orders` (`amount_vnd`, `custom_amount_vnd`, `status`, `payment_method`, `reference_code`, `expires_at`), `payments` (`method`, `gateway_reference`, `gateway_payload`, `status`, `paid_at`, `verified_by`), `enrollments`, `email_logs` (E5/E6/E7/E8/E13).
- **Xem chi tiết:** §8.

### 10.10. Email Automation — Tự động gửi email

- **Mục đích:** gửi đúng email, đúng người, đúng lúc trong toàn bộ hành trình (đăng ký → mua → học → hoàn thành → nhắc học), có nhật ký để đối soát.
- **Thành phần:** 13 mẫu email E1–E13 (xem §9); Workers gọi Resend; webhook Resend cập nhật trạng thái; Workers Cron chạy mỗi giờ cho email nhắc (E6/E7/E10/E11); ưu tiên email giao dịch khi chạm giới hạn Resend.
- **Dữ liệu chính:** `email_logs` (`to_email`, `template`, `resend_id`, `status`, `related_type`, `related_id`), `leads`, `orders`, `enrollments`, `event_registrations`, `newsletter_subscribers`.

### 10.11. Notification — Thông báo

- **Mục đích:** nhắc học viên và admin về việc cần làm (đơn chưa trả, sự kiện sắp diễn ra, lead mới, học viên lâu không học), qua các kênh đã có.
- **Thành phần (giai đoạn đầu, dùng kênh đã có):** email nhắc qua Resend + Cron (E6/E7/E10/E11); email báo lead mới cho admin (E4); thông báo trong Student Portal/Admin Panel suy ra từ dữ liệu (đơn `pending`, sự kiện `upcoming`, lead `new`); nút Zalo hỗ trợ và nút tham gia nhóm Zalo trên trang cảm ơn (liên kết ngoài, không phải tích hợp API Zalo tự động).
- **Dữ liệu chính:** `email_logs`, `orders` (`pending` quá hạn), `events` + `event_registrations`, `leads` (`new`), `lesson_progress` / `enrollments` (không học 7 ngày).
- **Ghi chú:** schema Module 1 **không có bảng `notifications` riêng**. Thông báo đẩy (push) và bảng thông báo riêng là tính năng giai đoạn sau — nếu cần, thêm bằng migration mới sau khi phê duyệt (xem §14). Không tự ý thêm bảng trong tài liệu này.

### 10.12. Analytics — Phân tích & báo cáo

- **Mục đích:** trả lời câu hỏi quan trọng nhất — chương trình nào thu hút học viên, kênh nào hiệu quả, doanh thu ra sao — ngay từ ngày đầu, không chờ “đủ dữ liệu”.
- **Thành phần:** 10 báo cáo R1–R10 (`GET /api/admin/reports/*`): tổng quan; lead theo thời gian/nguồn/khóa/tỉnh; học viên theo khóa; doanh thu; tiến độ học tập; quiz; sự kiện; email; đối soát thanh toán; tăng trưởng (học viên mới/tuần, MAU, retention 7/30 ngày). Mọi báo cáo có phân trang, lọc theo thời gian, xuất CSV (giai đoạn sau).
- **Dữ liệu chính:** đọc từ toàn bộ bảng nghiệp vụ (`leads`, `enrollments`, `orders`, `payments`, `lesson_progress`, `quiz_attempts`, `event_registrations`, `email_logs`); báo cáo chỉ đọc từ database, không đọc từ Sheet.
- **Mục tiêu đo lường (Quyết định 14):** mục tiêu $100M trong 10 năm được tính là đạt khi **cả 3 chỉ số cùng đạt 100 triệu đô** — doanh thu tích lũy, lợi nhuận giữ lại, và giá trị ròng năm 10. Hệ thống báo cáo phải đo được cả 3 chỉ số này (doanh thu từ `orders`/`payments`; lợi nhuận và giá trị ròng cần dữ liệu chi phí/tài sản ngoài hệ thống — xem §14).

---

## 11. Deployment & vận hành

| Hạng mục | Quyết định |
|---|---|
| Source control | GitHub; branch protection cho `main` (không push trực tiếp, qua PR + review); CI lint + typecheck + test trên mọi PR |
| Deploy frontend | Cloudflare Pages tự động khi merge vào `main`; preview deployment cho mỗi PR |
| Deploy API | Cloudflare Workers qua Wrangler; rollback bằng cách deploy lại commit trước |
| Môi trường | Prod + staging (project Supabase thứ 2 trong 2 project miễn phí dùng làm staging để restore thử backup) |
| Cron giữ ấm | Workers Cron gọi `GET /api/health` mỗi ngày 1 lần để Supabase Free không bị tạm dừng sau 7 ngày không hoạt động |
| Backup database | Supabase Free không có backup tự động hàng ngày → `pg_dump` hàng ngày qua GitHub Actions, lưu file `.sql` vào repo riêng (private) + Cloudflare R2; restore thử lên staging mỗi tháng 1 lần — **backup chưa từng restore thử thì coi như chưa có backup** |
| Backup storage | File gốc trong repo Git + Storage; đồng bộ 1 bản sao lên R2 hàng tuần |
| Đối soát hàng ngày | Mỗi sáng admin mở báo cáo R9 (đơn pending quá hạn, payment không khớp, webhook lỗi); kiểm tra Sheet khớp với `leads` trong database (nếu còn dùng) |
| Runbook | Chi tiết sự cố và phục hồi trong `docs/RUNBOOK.md` khi lập trình |

---

## 12. Giới hạn miễn phí & phương án thay thế

**Số liệu dưới đây tra cứu ngày 10/11/2026 từ các nguồn thứ cấp tổng hợp từ trang pricing/docs của nhà cung cấp; nhà cung cấp có thể thay đổi giới hạn — trước khi triển khai phải xác minh lại trên trang pricing chính thức của từng dịch vụ.**

| Dịch vụ | Giới hạn miễn phí | Khi chạm giới hạn | Điểm chạm đầu tiên | Phương án thay thế / nâng cấp |
|---|---|---|---|---|
| **Supabase Free** | 2 project; DB 500 MB; Storage 1 GB; băng thông ~5 GB egress/tháng; Auth 50.000 MAU/tháng; Edge Functions 500.000 lần/tháng; Realtime 200 kết nối; **tạm dừng sau 7 ngày không hoạt động**; không backup tự động, không SLA | Vượt DB → chỉ đọc; vượt băng thông → lỗi 402; tạm dừng → website không truy cập được DB | Tạm dừng sau 7 ngày; DB 500 MB | Cron giữ ấm; dọn log cũ; không lưu video vào Storage; nâng Supabase Pro — **giá cần xác minh lại, cần phê duyệt** |
| **Cloudflare Pages Free** | 500 build/tháng; 20.000 file/site; 25 MiB/file; **request static asset và băng thông không giới hạn** | Vượt 500 build → không build được tới tháng sau | Khó chạm | Gộp commit để giảm số lần deploy |
| **Cloudflare Workers Free** | 100.000 request/ngày; CPU 10ms/request; 50 subrequest/lần gọi; 128 MB/isolate | Vượt → lỗi 1027, request bị từ chối | 100.000 request/ngày nếu API đọc khóa học đi qua Workers | Đọc công khai trực tiếp qua Supabase; cache ở Cloudflare; nâng Workers Paid — **giá cần xác minh lại, cần phê duyệt** |
| **Resend Free** | 3.000 email/tháng, **tối đa 100 email/ngày** | Email thứ 101 trong ngày → lỗi `daily_quota_exceeded` | **100 email/ngày** — ngày ra mắt có 150 đăng ký là chạm ngay | Xếp hàng email nhắc sang hôm sau, ưu tiên email giao dịch; nâng Resend Pro — **giá cần xác minh lại, cần phê duyệt** |
| **Cloudflare R2 Free** | 10 GB lưu trữ; 1M đọc/tháng (Class A), 10M đọc/tháng (Class B); **không phí egress** | Vượt → tính phí theo mức dùng | Chưa dùng giai đoạn đầu | Dùng R2 thay Supabase Storage khi Storage 1 GB hết |
| **GitHub Free** | Repo không giới hạn; Actions 2.000 phút/tháng | Vượt phút Actions → CI dừng | Khó chạm | Chỉ chạy CI khi có PR |
| **YouTube (video)** | Không giới hạn dung lượng video unlisted | Vi phạm chính sách → video bị gỡ | Không phải giới hạn kỹ thuật | Cloudflare Stream / Mux / Vimeo khi cần bảo mật (có phí, cần phê duyệt) |
| **Google Sheet (tạm)** | Giới hạn của Google | — | Chỉ là bản sao đối soát | Bỏ khi API lead ổn định |

**Ba giới hạn chạm đầu tiên (theo thứ tự dự kiến):** (1) Resend 100 email/ngày; (2) Supabase tạm dừng sau 7 ngày không hoạt động; (3) Supabase DB 500 MB / Storage 1 GB.

**Nâng cấp trả phí (Quyết định 18):** nâng cấp khi chạm tới giới hạn miễn phí — áp cho cả Supabase, Workers và Resend (không chỉ Supabase). Giá các gói trả phí **cần xác minh lại** trên trang pricing chính thức trước khi nâng; không cam kết số trong tài liệu này.

**Lộ trình mở rộng:** 0–100 học viên: stack 0 đồng. 100–1.000: nâng Supabase Pro (hết tạm dừng, DB lớn hơn, backup hàng ngày) + chuyển Storage sang R2 + SePay webhook (nếu phê duyệt). 1.000–10.000: nâng Workers Paid + Resend Pro + video sang Stream/Mux (nếu cần bảo mật) + cache. Trên 10.000: xem xét gói cao hơn, load test trước mỗi đợt ra mắt lớn. Nguyên tắc: không thay kiến trúc khi tăng quy mô — chỉ thay giới hạn và thay lớp video/thanh toán khi có phê duyệt.

---

## 13. Rủi ro kiến trúc chính

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R1 | Supabase Free tạm dừng sau 7 ngày → website chết | Cao | Cron giữ ấm mỗi ngày; nâng Pro khi có doanh thu (cần phê duyệt) |
| R2 | Resend 100 email/ngày → email chào mừng lỗi ngày ra mắt | Cao | Xếp hàng email, ưu tiên giao dịch; nâng Pro khi cần |
| R3 | Workers 100.000 request/ngày → API chết ngày cao điểm | Trung bình | Đọc công khai qua Supabase trực tiếp; cache; nâng Paid $5 khi cần |
| R4 | Video YouTube unlisted bị chia sẻ trái phép | Trung bình | Chấp nhận ở giai đoạn 0 đồng; chuyển Stream/Mux khi có doanh thu |
| R5 | Thanh toán thủ công đối soát sai / chậm | Trung bình | Mã đơn duy nhất; email nhắc; báo cáo đối soát hàng ngày (R9) |
| R6 | RLS cấu hình sai → lộ dữ liệu học viên khác | Cao | Test RLS bằng tài khoản test (học viên A không đọc được dữ liệu học viên B) trước khi ra mắt; audit policy mỗi lần thêm bảng |
| R7 | Secret lộ (service-role, Resend key) | Cao | Secret chỉ trong Workers Secrets/GitHub Secrets; xoay key định kỳ; không commit `.env` |
| R8 | Nhà cung cấp đổi giới hạn miễn phí | Trung bình | Ghi rõ “xác minh lại trước khi triển khai”; theo dõi trang pricing mỗi quý |
| R9 | Phụ thuộc 1 người vận hành | Trung bình | Runbook; backup tự động; GitHub + Cloudflare đều có lịch sử deploy |

---

## 14. Quyết định cần phê duyệt

Tài liệu này ở trạng thái **“Chờ phê duyệt kiến trúc”**. Chưa viết code, chưa tạo database, chưa deploy cho tới khi chủ dự án phê duyệt. Các quyết định sau cần chủ dự án xác nhận (đánh dấu ☐ = chưa quyết, ☑ = đã chốt trong DECISIONS.md):

**A. Kiến trúc tổng thể**

- ☐ Phê duyệt toàn bộ kiến trúc trong tài liệu này (frontend Next.js App Router + Cloudflare Pages; backend Cloudflare Workers API + Supabase; database PostgreSQL theo schema Module 1; auth Supabase Auth; RBAC + RLS).
- ☑ Framework frontend: **Next.js App Router** (Quyết định 19).
- ☑ Sitemap mới: tách `/su-kien` khỏi `/blog`; chính sách thành URL thật; thêm `/hoc-vien/*`, `/dang-nhap`, `/dang-ky`, `/admin/*` (Quyết định 11).
- ☐ Domain API `api.visfaracademy.vn` (tạm dùng `*.workers.dev` trong giai đoạn dev nếu chưa chốt domain).

**B. Schema & dữ liệu**

- ☐ Xác nhận schema Module 1 giữ nguyên, không thay đổi trong Task 02.
- ☐ Bảng liên kết giảng viên ↔ khóa phụ trách (Instructor Portal, §10.6): thêm bảng mới bằng migration, hay quản lý bằng cột/quy ước khác? (Chưa có trong schema Module 1 — không tự thêm.)
- ☐ Bảng `notifications` riêng cho phân hệ Notification (§10.11): có cần trong giai đoạn đầu, hay dùng email + thông báo suy ra từ dữ liệu là đủ?
- ☐ Đo lợi nhuận giữ lại và giá trị ròng cho mục tiêu $100M (§10.12): dữ liệu chi phí/tài sản lấy từ đâu (nhập tay, file riêng, hay hệ thống kế toán)?

**C. Thanh toán**

- ☑ Dùng SePay; ngân hàng MB Bank; chủ tài khoản Công ty TNHH MTV Visfar Holdings; dùng được QR Code cũ (Quyết định 15). Số tài khoản không ghi vào tài liệu.
- ☐ Thời điểm bật SePay webhook tự động (sau khi chuyển khoản thủ công chạy ổn định, hay bật ngay từ đầu)? Giá SePay **cần xác minh lại** trước khi bật.
- ☐ Có dùng Stripe cho thẻ quốc tế không, và khi nào? (Giá và hỗ trợ tài khoản Việt Nam **cần xác minh lại**.)
- ☑ Khung hoàn trả 15 ngày làm việc; khiếu nại phản hồi trong 3 ngày (Quyết định 9).

**D. Giới hạn miễn phí & nâng cấp**

- ☑ Nâng cấp trả phí khi chạm giới hạn miễn phí — áp cho cả Supabase, Workers và Resend (Quyết định 18).
- ☐ Ngưỡng cụ thể để nâng từng dịch vụ (ví dụ: nâng Supabase Pro ngay khi có doanh thu đầu tiên, hay chờ chạm 500 MB / tạm dừng lần đầu)? Giá các gói trả phí **cần xác minh lại** trước khi nâng.

**E. Nội dung & sự kiện**

- ☑ Nội dung builder viết đã duyệt: 3 bài blog, thẻ Lĩnh vực 03, bước “Tin”, nội dung 3 khóa 04/05/06 (Quyết định 10).
- ☑ 3 sự kiện tháng 11, ngày **25/11/2026 cho cả 3 sự kiện** (Quyết định 7).
- ☐ Giờ + hình thức (Zoom) từng sự kiện ngày 25/11/2026 — chủ dự án gửi sau, **không tự bịa**.
- ☐ Nội dung thật cho 3 khóa 04/05/06 (nếu muốn thay nội dung tạm đã duyệt) — chủ dự án gửi văn bản của mình.

**F. Các quyết định đã chốt khác được áp dụng trong tài liệu này (không cần phê duyệt lại)**

- Tuyên ngôn 13,65px ở 390px: chấp nhận hiện tại (Q1). Nhãn Tam giác hiện thực ~3,98px: chấp nhận hiện tại (Q2). Giữ nguyên nhánh fallback form trên trang hiện tại (Q3). Chống spam: honeypot + rate-limit + idempotency **và** CAPTCHA (Q4). API làm lớp trước rồi ghi Sheet (Q5). Newsletter làm thật (Q6). Giữ PII trong mailto/clipboard trên trang hiện tại sau khi đã cảnh báo rủi ro (Q8). SEO cơ bản: `<h1>` + OG/Twitter/canonical/JSON-LD + CSP (Q13). Mục tiêu $100M: cả 3 chỉ số cùng đạt (Q14). Video YouTube unlisted: chấp nhận đánh đổi (Q16). `lessons.slug` UNIQUE theo module; ngưỡng hoàn thành 90% video / bấm “Đã hoàn thành” (bài text), tính theo module (Q17).

---

*Tài liệu kiến trúc hệ thống — TASK 02 Visfar Academy — 10/11/2026 — Chờ phê duyệt kiến trúc. Chưa viết code, chưa tạo database, chưa deploy.*
