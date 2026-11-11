# ARCHITECTURE — Kiến trúc Visfar Academy (trạng thái hiện tại)

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Vai trò file này:** bản đồ kiến trúc ở trạng thái **hiện tại** (sau GĐ2) + link tới doc chi tiết. Tài liệu thiết kế Task 02 giữ nguyên ở `docs/architecture/`; những điểm thiết kế đã đổi khi triển khai được ghi rõ ở §6 (không sửa ngược file thiết kế cũ).
- **Không chứa secret/key/token nào (chỉ tên biến).**

## 1. Sơ đồ tổng thể (đang chạy)

```
Người dùng (khách · học viên · giảng viên · admin)
        │ HTTPS
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Cloudflare Edge                                                  │
│  Pages `visfaracademy` (Next.js 15, App Router, edge runtime)    │
│  Worker `api` (router tay, /api/v1)                              │
└──────┬───────────────────────────────┬──────────────────────────┘
       │ anon key + RLS (đọc công khai)│ service-role (ghi nhạy cảm)
       ▼                               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐
│ Supabase     │  │ Supabase     │  │ Resend       │  │ Google    │
│ Postgres 17  │  │ Storage      │  │ (Dùng tạm)   │  │ Sheet     │
│ + Auth (JWT) │  │ avatars /    │  │ email giao   │  │ (bản sao  │
│ + RLS        │  │ submissions  │  │ dịch         │  │ đối soát  │
└──────────────┘  └──────────────┘  └──────────────┘  │ lead)     │
       ▲                                              └───────────┘
       │  YouTube unlisted (video bài học, embed youtube-nocookie)
       │  SePay webhook → Worker (chưa chạy thật)
       └──────────────────────────────────────────────────────────
```

- **Frontend:** `apps/web` — Next.js 15.4.11 + React 19, App Router, TypeScript; deploy Cloudflare Pages (`https://visfaracademy.pages.dev`, project `visfaracademy`, build `@cloudflare/next-on-pages`, `pages_build_output_dir=.vercel/output/static`, `compatibility_flags = ["nodejs_compat"]`). Monorepo npm workspaces: `apps/web`, `packages/shared`, `workers/api`, `supabase/`, `scripts/`, `tests/`.
- **Backend/API:** `workers/api` — Worker tên `api` (`https://api.visfaracademy.workers.dev`), router tay trong `src/index.ts`, tiền tố `/api/v1`. JWT verify RS256 + ES256 qua JWKS (đã sửa 11/11/2026 vì Supabase staging phát hành JWT ES256). Rate-limit (KV nếu có, fallback bộ nhớ trong-process). Xem `docs/API_DOCUMENTATION.md`.
- **Database:** Supabase Postgres 17. Prod `ugynqjqyfynkmqutoarp` (ap-south-1), staging `scskhplczrxlnxzruweu` (ap-southeast-2). Migrations 0001–0031 (xem `docs/DATABASE_SCHEMA.md`). RLS bật trên mọi bảng vật lý.
- **Email:** Resend qua Worker; 13 mẫu E1–E13 + mẫu Task 11; webhook Resend/Svix đã có code verify nhưng **chưa nối route** (`POST /api/webhooks/resend` chưa tồn tại — xem API doc §5). Trạng thái "Dùng tạm": chưa domain riêng, chỉ gửi cho admin qua `onboarding@resend.dev`.
- **Thanh toán:** SePay gói FREE; webhook `POST /api/v1/webhooks/sepay` (+ alias không `/v1`), HMAC-SHA256 `X-SePay-Signature: sha256={hex}` trên `{timestamp}.{raw_body}`; **chưa từng chạy end-to-end thật**. Đối soát bù qua SePay API v2 (cần `SEPAY_API_TOKEN` — chưa set). Xem `docs/payment/SEPAY_INTEGRATION.md`.
- **Video:** YouTube unlisted, embed `youtube-nocookie`; `video_url` trong `lessons.video_url` (QĐ 16 — chấp nhận đánh đổi).

Chi tiết thiết kế gốc: `docs/architecture/SYSTEM_ARCHITECTURE.md` (§2 sơ đồ, §3 frontend, §4 backend, §5 database, §6 auth, §7 storage/video, §8 payment, §9 email, §10 12 phân hệ, §12 giới hạn miễn phí).

## 2. Luồng dữ liệu

### 2.1. Đọc công khai (không cần đăng nhập)

Frontend → Supabase trực tiếp bằng anon key + RLS cho phép đọc công khai (khóa published, bài blog, sự kiện, chính sách, Thư viện Master, view `lessons_public` chỉ metadata). Mục đích: giảm tải Worker (giới hạn Free 100.000 request/ngày).

**Ngoại lệ quan trọng (S-03, GĐ2):** bảng `lessons` gốc không còn đọc công khai được nữa trên staging (migration 0028: policy `lessons_select_enrolled`; anon REST 0 dòng). Metadata đọc qua view `lessons_public`; video bài xem thử đọc qua view mới `lessons_preview_video` (chỉ `id` + `video_url`). Nội dung đầy đủ chỉ qua API guard `GET /api/lms/lessons/[lessonId]` khi đã ghi danh. **Trên prod 0028 chưa áp nên policy cũ vẫn mở** (xem PROJECT_CONTEXT §2).

### 2.2. Ghi nhạy cảm (luôn qua server)

Frontend → Worker API (JWT + validation server + rate-limit + idempotency) → Supabase bằng service-role key; hoặc Frontend → Next.js Route Handler (`apps/web/src/app/api/...`) → Supabase bằng `auth.getUser()` + RLS. Client **không** ghi trực tiếp vào `orders`, `payments`, `enrollments`, `lesson_progress`, `quiz_attempts`.

Hai đường ghi song song tồn tại (lịch sử, cần biết khi sửa code):

| Đường ghi | Dùng cho | Ghi chú |
|---|---|---|
| Worker `/api/v1/*` | leads, progress, orders, payments, coupons, membership-plans, appointments, referrals, AI Mentor | `workers/api/src/index.ts` + `src/handlers/` |
| Next.js `/api/*` (Route Handlers) | LMS guard (`/api/lms/lessons/[id]`), quiz (`/api/v1/quizzes/*`), assignment (`/api/v1/assignments/*`), certificate verify, admin CRUD (`/api/admin/*`) | `apps/web/src/app/api/` — lưu ý: tiền tố `/api/v1/` ở đây là của **Next.js**, khác Worker `/api/v1/`; base URL phân biệt bằng `NEXT_PUBLIC_API_BASE_URL` |

### 2.3. Luồng đăng ký tư vấn (lead) — QĐ 5

```
Form /tu-van → POST /api/v1/leads (Worker)
  1. Rate-limit 5 req/giờ/IP → 429, không ghi
  2. Honeypot + Turnstile (fail-open khi chưa có secret) → spam_suspected
  3. Validation server (SĐT ^0\d{9}$, email TLD ≥ 2, tỉnh trong 34 tỉnh, courseId published)
  4. Idempotency-Key: trùng key + cùng body → 200 duplicate:true; khác body → 409
  5. Ghi bảng leads (nguồn sự thật) + sinh reference_code VISFAR-YYYY-NNNNNN → 201
  6. Ghi Google Sheet qua Apps Script (bản sao đối soát; sheetSynced:false vẫn trả 201)
  7. Gửi email E3 (học viên) + E4 (admin) — hiện chỉ tới admin do Resend "Dùng tạm"
```

Đã kiểm chứng live 11/11/2026: 201 → 200 `duplicate:true` → 409 `idempotency_conflict` (mã `VISFAR-2026-708302`); dòng test đã xóa khỏi prod. Fallback Apps Script cũ còn giữ theo QĐ 3 (chỉ khi API lỗi mạng/5xx/timeout, không lách rate-limit/validation).

### 2.4. Luồng thanh toán (đã chốt, chưa chạy thật)

```
Chọn khóa → POST /api/v1/orders (JWT + Idempotency-Key)
  → đơn pending, reference_code DH-YYYY-NNNNNN, expires_at +48h
  → hiện QR VietQR (file do user cung cấp) + MB Bank + nội dung = mã đơn
  → học viên chuyển khoản
  → SePay webhook POST /api/v1/webhooks/sepay (verify HMAC, tìm đơn theo
    reference_code, kiểm tra số tiền khớp sai lệch 0đ, UNIQUE (method, gateway_reference))
  → payments succeeded → orders paid → enrollments → email E8
  → hoặc admin xác nhận thủ công POST /api/v1/admin/orders/:id/mark-paid
Hoàn trả (15 ngày làm việc): admin POST .../refund → chuyển khoản thủ công
  → payments refunded → orders refunded → enrollment revoked → email E13
```

**Chưa kiểm chứng:** POST webhook thật, 1 đơn thật end-to-end, đối soát bù qua SePay API v2. `SEPAY_API_TOKEN` chưa set trong Worker secrets.

### 2.5. Luồng học (LMS)

```
Xem danh sách bài: view lessons_public (metadata A–Z, không cần đăng nhập;
  bài trả phí hiện ổ khóa, bấm cuộn tới khối đăng ký)
Học bài: GET /api/lms/lessons/[lessonId] (guard lms-access.ts)
  → chưa ghi danh + bài trả phí: 403 not-enrolled
  → bài xem thử: 200 previewOnly:true, chỉ video_url (không content/file_url)
  → đã ghi danh: 200 đủ content
Tiến độ: POST /api/v1/progress (Worker; kiểm tra enrollment + ngưỡng hợp lý;
  video ≥ 90% mới completed; bài text bấm "Đã hoàn thành")
  — S-06: learning.ts còn đường ghi trực tiếp (sẽ 42501 live), cần chuyển hẳn sang progress.ts
Quiz: GET/POST /api/v1/quizzes/[quizId] (Next.js) → RPC submit_quiz_attempt (SECURITY DEFINER, chấm server)
Assignment: /api/v1/assignments/* → bucket private submissions (signed URL, tối đa 5 file × 10 MB)
Certificate: đủ 100% bài → tạo mã VISFAR-CERT-YYYY-NNNNNN; tra cứu công khai GET /api/v1/certificates/verify (RPC verify_certificate, chỉ trả 6 trường)
```

### 2.6. Luồng 11D / AI Mentor / Cộng đồng / Gamification (GĐ2)

- **11D:** làm bài công khai `/danh-gia-11d` (33 câu, nháp localStorage) → lưu kết quả cần đăng nhập → bảng `assessments_11d` (0027, staging) → lịch sử/so sánh ở `/hoc-vien/danh-gia-11d`. View tổng hợp `assessment_aggregates_11d` không PII (chưa có trang admin).
- **AI Mentor:** `/ai-mentor` → `POST /api/v1/ai-mentor/ask` (JWT, 20 câu/giờ/user) → hàm `search_ai_knowledge` trên 138 chunk (119 Thư viện + 10 khóa + 9 triết lý; **không index nội dung bài trả phí**) → kiểm tra enrollment cho chunk course. **Không LLM** (chưa có key AI); nhánh OpenAI `gpt-4o-mini` đã viết sẵn, chỉ chạy khi có `OPENAI_API_KEY`.
- **Cộng đồng:** `/cong-dong` + `/cong-dong/[id]` → bảng `community_*` (0030, staging), RLS chỉ người đăng nhập; kiểm duyệt ở `/admin/cong-dong` (ẩn/hiện/ghim/xóa, xử lý báo cáo).
- **Gamification:** trigger server-side cộng điểm (`learning_points`: bài +10, quiz đạt +20, khóa +100, helpful +5 tối đa 1 lần/ngày, streak +5/ngày) + 4 huy hiệu seed; RPC `refresh_my_gamification()`; hiển thị `/hoc-vien/thanh-tich`; toggle `profiles.gamification_enabled`.

## 3. Auth & phân quyền (RBAC + RLS, 2 lớp)

- **Auth:** Supabase Auth (email + mật khẩu); JWT verify ở Worker bằng JWKS (RS256 + ES256, cache, kiểm tra `iss`/`aud`/`exp`); ở Next.js mọi route thật dùng `auth.getUser()`.
- **Middleware Next.js** (`apps/web/src/middleware.ts`, matcher `/hoc-vien/*`, `/admin*`, `/api/admin/*`): chỉ đọc `exp`/`sub` của JWT, **không verify chữ ký** (S-05 — lớp định tuyến; bảo mật thật do Supabase Auth + RLS ở mỗi query). Middleware kiểm tra `profiles.is_disabled` (S-01): tài khoản disabled → thu hồi refresh token + redirect `/dang-nhap?reason=disabled`; khi Supabase REST lỗi thì fail-open, layout `/hoc-vien` là lớp chặn thứ 2.
- **RBAC 3 role** (`student` / `instructor` / `admin`; nguồn sự thật `user_roles`, `profiles.role` là cache đồng bộ bằng trigger — S-17: `current_role()` hiện vẫn đọc cache, lệch QĐ, chưa sửa). Ma trận quyền đầy đủ: `docs/architecture/ROLE_PERMISSION_MATRIX.md`.
- **RLS:** bật trên mọi bảng; chi tiết policy: `docs/database/RLS_POLICIES.md`, `docs/database/SECURITY_MODEL.md`.

## 4. Email & automation

- 13 mẫu E1–E13 (+ Task 11) gửi qua Resend từ Worker; ghi `email_logs`; token hủy đăng ký HMAC 90 ngày; verify Svix đúng chuẩn nhưng webhook Resend chưa nối route.
- Cron: `workers/api/src/automation-cron.ts` — chỉ rule nhắc học (E9) chạy theo cron (ghi chú trong file: `crons = ["0 * * * *"]` + nối `scheduled()`). **Chưa nối:** `workers/api/src/index.ts` chỉ export `fetch`, không thấy handler `scheduled` trong đợt này; các rule còn lại là event-driven. Cron giữ ấm Supabase (`GET /api/health` mỗi ngày) — chưa xác minh đang chạy thật, xem `docs/DEPLOYMENT_GUIDE.md` §6.

## 5. Giới hạn miễn phí & điểm chạm (snapshot 10/11/2026, xác minh lại trước khi nâng)

Supabase Free (2 project, DB 500 MB, Storage 1 GB, tạm dừng sau 7 ngày không hoạt động, không backup tự động) · Workers Free (100.000 req/ngày) · Resend Free (3.000/tháng, tối đa 100/ngày — chạm đầu tiên) · Pages Free (500 build/tháng) · SePay FREE (50 GD tiền vào/tháng, tính cả giao dịch ngoài học phí vì dùng chung tài khoản MB). Nâng cấp trả phí khi chạm giới hạn, cần phê duyệt (QĐ 18); giá tra cứu 10/11/2026 (Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng) cần xác minh lại.

## 6. Những điểm thiết kế Task 02 đã đổi khi triển khai (đối chiếu thật)

| Thiết kế Task 02 | Thực tế 11/11/2026 |
|---|---|
| API domain `api.visfaracademy.vn` (QĐ 8 ghi `visfaracademy.netlify.app`) | Chưa có domain riêng; Worker chạy `https://api.visfaracademy.workers.dev`; Pages `https://visfaracademy.pages.dev` |
| Tiền tố `/api/...` (chưa chốt `/api/v1`) | Đã chốt `/api/v1` trên Worker; Next.js cũng có `/api/v1/*` riêng (hai hệ khác nhau, xem §2.2) |
| Router Hono/itty-router | Router tay trong `workers/api/src/index.ts` |
| `modules` / `quiz_questions` / `quiz_options` | Đã rename: `course_modules` / `questions` / `question_options` (0005); `answers` đổi thành `quiz_answers` theo QĐ Task 03 (kiểm tra tên thật trong 0004/0005 trước khi dùng) |
| Trụ cột Tâm thức – Trí tuệ – Nhân hiệu | Đổi thành **Thân – Tâm – Tuệ** (0024, QĐ 20); giá trị `tam`/`tam`/`tue`/`than`/`tich-hop`/`cong-dong` |
| Sitemap gồm `/su-kien`, `/hoc-vien/*`, `/admin/*` (QĐ 11) | Sitemap thực tế 25 URL, **không** có `/su-kien` (chỉ là neo `/#su-kien`), không có `/hoc-vien/*` và `/admin/*` (cần đăng nhập) — lệch QĐ 11, ghi rõ để user chốt lại (QĐ 23) |
| Webhook Resend nối route | Chưa nối route (code verify đã có) |
| Newsletter endpoint | Chưa xác minh có endpoint riêng trong Worker trong đợt này — xem API doc §5 |
| Cron giữ ấm + backup tự động | Chưa xác minh cron đang chạy thật; `workers/api/src/index.ts` chỉ export `fetch` (không thấy handler `scheduled` — cron automation chưa nối, xem API doc §5); backup tự động **chưa có** (xem `docs/BACKUP_RECOVERY.md`) |
| GitHub remote + CI/CD | `.github/workflows/ci.yml` + `deploy.yml` đã có trong repo; nhưng **`git remote -v` trống — chưa có remote GitHub nào**; code GĐ2 mới commit local (`f577747`, `dca216d`), chưa push được vì chưa có remote |

## 7. Tài liệu kiến trúc chi tiết (đọc thêm, không viết lại ở đây)

- `docs/architecture/SYSTEM_ARCHITECTURE.md` — thiết kế hệ thống Task 02 (12 phân hệ).
- `docs/architecture/API_ARCHITECTURE.md` — đặc tả API Task 02 (đã cũ ở một số endpoint — đối chiếu với `docs/API_DOCUMENTATION.md` khi lập trình).
- `docs/architecture/DEPLOYMENT_ARCHITECTURE.md` — kiến trúc triển khai Task 02.
- `docs/architecture/SYSTEM_MODULES.md` · `docs/architecture/USER_FLOWS.md` · `docs/architecture/ROLE_PERMISSION_MATRIX.md` · `docs/architecture/INTEGRATION_PLAN.md`.
- `docs/database/DATABASE_ERD.md` · `docs/database/DATA_DICTIONARY.md`.
- Tài liệu kiến trúc tổng thể v1.0: `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md`.
