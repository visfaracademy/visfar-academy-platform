# SECURITY_GUIDE — Hướng dẫn vận hành bảo mật

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Nguồn:** `docs/release/SECURITY_REPORT.md` (S-01→S-18 + cập nhật GĐ2), `docs/PROJECT_AUDIT.md` §5, `docs/database/RLS_POLICIES.md`, `docs/database/SECURITY_MODEL.md`, `docs/frontend/TASK06_SECURITY_REPORT.md`, code thật (`apps/web/src/middleware.ts`, `workers/api/src/jwt.ts`, `workers/api/src/sepay.ts`, `apps/web/next.config.ts`, migrations 0009/0021/0022/0028).
- **Không chứa secret/key/token nào (chỉ tên biến).**

## 1. Mô hình bảo mật (2 lớp — phải hiểu trước khi vận hành)

1. **Lớp API (Workers / Next.js Route Handlers):** xác thực JWT, kiểm tra role/nghiệp vụ, validation server, rate-limit, idempotency, xác minh chữ ký webhook.
2. **Lớp database (RLS):** chặn cuối ở Postgres — kể cả khi ai đó gọi thẳng Supabase REST bằng anon key. RLS bật trên mọi bảng; mặc định từ chối.

Chỉ kiểm tra 1 lớp là không đủ. Mọi thao tác nhạy cảm phải đi qua cả hai lớp. Client không bao giờ được tin: không tin client báo "đã trả", không tin điểm quiz/tiến độ client gửi, đáp án đúng quiz không bao giờ trả về client trước khi nộp.

## 2. Trạng thái các lỗi S-01→S-18 (11/11/2026)

| Mã | Mức | Nội dung | Trạng thái 11/11/2026 |
|---|---|---|---|
| S-01 | Cao (đã vá) | Học viên tự mở lại tài khoản bị vô hiệu hóa (`profiles.is_disabled`) | **Đã vá:** migration 0022 (trigger `prevent_profiles_disable_change` chặn JWT non-admin) + middleware chặn tài khoản disabled (thu hồi refresh token, redirect `?reason=disabled`) + layout `/hoc-vien` là lớp chặn thứ 2. Kiểm tra lại sau mỗi lần đổi policy `profiles`. |
| S-02 | Cao (đã sửa) | 4 file migration cùng số 0017 | **Đã sửa:** đổi số thành 0017–0021, `check-migrations` PASS. Quy tắc: không bao giờ tạo 2 file cùng số; script kiểm tra đếm động. |
| S-03 | Cao | Nội dung bài trả phí đọc được qua REST anon | **Đã vá trên staging, CHƯA áp prod.** Migration 0028: drop `lessons_select_public` → policy `lessons_select_enrolled` (chỉ admin/instructor/học viên đã ghi danh) + view `lessons_preview_video`. Kiểm chứng staging: anon `lessons` 0 dòng; JWT đã ghi danh đọc đủ 2 bài; guard: đã ghi danh 200, chưa ghi danh 403 `not-enrolled`, xem thử 200 `previewOnly:true` chỉ `video_url`. **Quy tắc vận hành: KHÔNG bán khóa có content thật trên prod trước khi 0028 áp prod.** |
| S-04 | Trung bình (đã vá) | Không có CSP/HSTS/X-Frame-Options | **Đã vá:** `apps/web/next.config.ts` thêm CSP (YouTube/Supabase/Worker API/font self-hosted), HSTS `max-age=31536000; includeSubDomains` (không preload), `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`. Header đã đo thật trên production. **Follow-up:** CSP còn `'unsafe-inline'`/`'unsafe-eval'` — nâng lên nonce-based CSP khi có điều kiện. |
| S-05 | Trung bình (còn mở) | Middleware chỉ đọc `exp` JWT, không verify chữ ký; cookie phiên không HttpOnly | **Còn mở.** Bù lại: mọi route thật dùng `auth.getUser()` (Worker verify RS256+ES256 qua JWKS); JWT giả đã chứng minh live là không lấy được dữ liệu. Hướng sửa: verify chữ ký ở middleware bằng `@supabase/ssr` hoặc Auth API; cân nhắc cookie HttpOnly cho refresh token. Không chặn release vì đã có RLS + `getUser()`. |
| S-06 | Thấp (fail-closed) | Đường ghi tiến độ trực tiếp còn sót trong `learning.ts` | **Còn sót.** `upsertProgress`/`markLessonComplete` ghi trực tiếp client → sẽ nhận 42501 live; nút "Đã hoàn thành" cho bài text/file trên trang học bài có thể hỏng. Hướng sửa: chuyển trang học bài sang `progress.ts` (Worker `/api/v1/progress`), xóa/đánh dấu deprecated hàm ghi trực tiếp. |
| S-07 | Trung bình (còn mở) | Anon được INSERT trực tiếp `event_registrations` | **Còn mở.** Policy 0001 cho anon INSERT `user_id NULL`. Rủi ro hiện tại thấp (chưa có frontend đăng ký sự kiện). Hướng sửa: drop policy INSERT cho anon (chỉ ghi qua Worker khi có endpoint đăng ký sự kiện), hoặc ghi quyết định giữ lại có chủ đích + rate-limit ở edge. |
| S-08 | Thấp (còn mở) | Mâu thuẫn policy SELECT `payments` | Policy chỉ admin SELECT; ma trận quyền lại ghi student được đọc payment của mình. Thực tế fail-closed. Cần chốt 1 bên trước khi có trang thanh toán. |
| S-09 | Thấp (đã sửa) | `check-migrations.mjs` lỗi thời | **Đã sửa:** đếm động, 271/271 PASS. |
| S-10 | Trung bình (đã qua) | Workers `tsc` FAIL + test biến động do giao code song song | Đã qua sau GĐ2 (Workers 345/345 PASS). Bài học vận hành: **không build/test song song chung `.next`** — build sau ghi đè chunk của build trước (đã chứng minh: server chunk bake nhầm env prod). Chỉ build khi không còn agent khác đang build, hoặc build trong thư mục riêng. |
| S-11 | Trung bình (đã đổi) | Webhook SePay/Resend chưa nối route; thuật toán chữ ký SePay chưa xác nhận | **Đã đổi một phần:** route `POST /api/v1/webhooks/sepay` đã nối (verify HMAC-SHA256 + timing-safe + fail-closed); thuật toán đã khớp `docs/payment/SEPAY_INTEGRATION.md` §4.2 — **nhưng chưa kiểm chứng POST thật**, nên chưa khẳng định khớp SePay production. Webhook Resend **vẫn chưa nối route** (code Svix verify đã có, tolerance 5 phút). |
| S-12 | Thấp (còn mở) | Chống scrub video có kẽ hở ở request đầu tiên | Request đầu tiên khai 90% ngay từ đầu được chấp nhận (không có baseline). Giảm nhẹ: trigger 0012 chặn `completed` khi < 90%. Theo dõi hành vi (nhiều bài completed trong vài giây đầu phiên) ở báo cáo đối soát. |
| S-13 | Thấp (còn mở) | `contentType` avatar lấy từ `file.type` client gửi | Hướng sửa: suy `contentType` từ ext đã whitelist (jpg/jpeg/png/webp, ≤ 2 MB), không tin `file.type`; cân nhắc kiểm tra magic bytes. |
| S-14 | Thấp (đã nối phần lớn) | Lib admin/CRM chưa có route/trang | Sau Task 09–10 phần lớn đã nối (xem `docs/API_DOCUMENTATION.md` §3.3). Rà lại từng lib trước khi dùng. |
| S-15 | Trung bình (theo QĐ) | Turnstile fail-open + fallback Apps Script không chống spam | **Theo quyết định đã chốt** (QĐ Task 03-13): khi chưa có secret, không có token, hoặc Cloudflare không liên hệ được → cho qua + ghi log. Lớp chống spam lúc đó chỉ còn rate-limit 5/giờ/IP + honeypot. Ghi rõ giới hạn này; bật Turnstile thật khi có site key + secret. |
| S-16 | Thấp (còn mở) | `orders_admin_update` thiếu `WITH CHECK` | Admin có thể đổi đơn sang bất kỳ trạng thái nào bằng JWT admin trực tiếp. Hướng sửa: thêm `WITH CHECK` + chặn ở tầng API (Postgres policy không giới hạn được cột). |
| S-17 | Thấp (còn mở) | `current_role()` đọc cache `profiles.role`, lệch QĐ "`user_roles` là nguồn duy nhất" | Hướng sửa: đổi `current_role()` đọc `user_roles` (`EXISTS` + `revoked_at IS NULL`), giữ `profiles.role` chỉ để hiển thị. Nếu trigger đồng bộ lỗi/tắt, thu hồi role trong `user_roles` sẽ không thu hồi quyền thật. |
| S-18 | Thấp (đã qua) | Test GAP hết hạn | Đã cập nhật khi Task 10 chốt. |

**Đã kiểm chứng và KHÔNG phát hiện vấn đề:** H1–H4 (tự nâng role, tự ghi danh, tự ghi tiến độ giả, insert profile sai role) — đã vá bằng 0009 + kiểm chứng live bị chặn; không SQL injection (toàn bộ qua supabase-js builder/RPC tham số); không XSS qua `innerHTML` (grep = 0; chỉ còn JSON-LD Organization trong `layout.tsx` và SVG tam giác tĩnh — không render HTML người dùng); không open-redirect (`isSafeNextPath`); không secret hard-code trong `src/`.

## 3. Checklist vận hành bảo mật

### 3.1. Mỗi ngày

- [ ] `/api/health` trả 200 (Worker + Pages).
- [ ] Đối soát R9: đơn `pending` quá hạn, payment không khớp, webhook lỗi, lead mới chưa xử lý.
- [ ] Kiểm tra Sheet khớp với `leads` trong DB (nếu còn dùng Sheet).
- [ ] Số email đã gửi trong ngày < 100 (Resend Free).

### 3.2. Mỗi lần deploy / áp migration

- [ ] Chạy `node scripts/check-migrations.mjs` (phải PASS; số migration liên tục, không trùng).
- [ ] Áp migration lên **staging trước**, kiểm chứng, rồi mới lên prod (backup prod trước — xem `docs/BACKUP_RECOVERY.md`).
- [ ] Probe anon sau khi đổi RLS: `lessons` (0 dòng / 0 content), `profiles`/`orders`/`payments`/`enrollments`/`leads`/`certificates`/`audit_logs`/`user_roles` (đều `[]`), `question_options_public` không có cột `is_correct` (400 `42703` khi hỏi cột đó).
- [ ] Kiểm tra header thật trên production (CSP, HSTS, `X-Frame-Options`).
- [ ] Không build song song chung `.next` với agent/build khác.
- [ ] Commit + push code (hiện **chưa có remote GitHub** — xem ROADMAP; tới khi có remote thì cấm push trực tiếp `main`, qua PR + CI xanh).

### 3.3. Mỗi lần thêm bảng / policy mới

- [ ] Bật RLS trên bảng mới ngay khi tạo; mặc định từ chối; chỉ mở đúng policy cần thiết.
- [ ] Không có policy INSERT/UPDATE/DELETE cho client trên bảng nhạy cảm — ghi qua Worker/service-role.
- [ ] Kiểm thử 2 tài khoản: A đọc dữ liệu B (phải = 0 dòng), A thử update `role`/`is_disabled`, A INSERT `enrollments`/`lesson_progress`/`orders`/`payments` (phải bị chặn 403/42501).
- [ ] Ghi lại tài khoản test dùng chung (admin/student/instructor) — mật khẩu tài khoản test các đợt trước **không được ghi lại**, nên các đợt sau không chạy lại được kiểm thử 2 tài khoản. Lần này phải ghi lại ở nơi an toàn (không ghi vào repo/doc công khai).

### 3.4. Secret — quy tắc bất di bất dịch

- Secret chỉ trong Cloudflare Workers Secrets / GitHub Secrets; **không bao giờ commit** `.env`, `.env.local`, `.dev.vars`, file chứa secret. `.gitignore` chặn `.env*` (trừ `.env.example` — chỉ tên biến + giá trị mẫu giả).
- Service-role key bypass RLS — lộ key này là lộ toàn bộ database. **Xoay key khi:** có người rời đội, nghi ngờ lộ, hoặc rà soát định kỳ mỗi quý.
- Số tài khoản ngân hàng / QR VietQR: **không ghi vào tài liệu, không ghi vào biến môi trường công khai**; chỉ dùng file/ảnh do user cung cấp. Không tự tạo QR mới từ thông tin chưa xác nhận.
- Không ghi PII (họ tên/SĐT/email) vào log, URL, `mailto:`, clipboard ở tầng API. Log chỉ ghi `reference_code` / `user_id` / mã lỗi. (Ngoại lệ: QĐ 8 giữ PII trong mailto/clipboard ở **trang HTML cũ** — quyết định của chủ dự án sau khi đã cảnh báo rủi ro; tầng API mới không kế thừa.)
- Webhook không có chữ ký đúng → từ chối 401/403, không xử lý, không ghi dữ liệu. Secret webhook chỉ nằm trong Workers Secrets.
- Xoay key/secret xong phải deploy lại Worker và kiểm tra `/api/health` + 1 luồng thật (lead test).

### 3.5. Khi nghi ngờ lộ / bị tấn công

1. Xoay secret bị nghi lộ ngay (service-role key, Resend key, webhook secret) → deploy lại → kiểm tra `/api/health`.
2. Kiểm tra `audit_logs` + `activity_logs` (ai làm gì, khi nào, từ IP nào — IP chỉ admin xem).
3. Kiểm tra đơn `paid` không có `payments` tương ứng và ngược lại (báo cáo đối soát R9).
4. Nếu nghi lộ service-role key: coi như toàn bộ DB đã lộ — rà soát dữ liệu nhạy cảm, thông báo cho admin, ghi biên bản.
5. Không xóa log để "dọn dẹp" — log là bằng chứng.

## 4. Những giới hạn đã chốt (không phải lỗi — đừng "sửa" ngược quyết định)

- Video YouTube unlisted không phải bảo mật thật (QĐ 16).
- Turnstile fail-open (QĐ Task 03-13) + fallback Apps Script không chống spam (QĐ 3, 5).
- PII trong mailto/clipboard ở trang cũ (QĐ 8) — đã cảnh báo.
- Giá "Tùy tâm/0đ" cho tới khi user cung cấp giá (QĐ Task 03-11).
- Tuyên ngôn 13,65px ở 390px + nhãn Tam giác ~3,98px: user đã chấp nhận (QĐ 1–2).
