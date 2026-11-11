# KIỂM TOÁN TOÀN BỘ DỰ ÁN VISFAR ACADEMY — PROJECT AUDIT (Prompt 02, MASTER PROMPT PACK)

- **Ngày kiểm toán:** 11/11/2026 (phiên 13:19–~14:00 +07; các mốc live ghi theo UTC trong bằng chứng)
- **Phạm vi:** `workspace/visfar-academy-platform` — Next.js 15 + Cloudflare Workers + Supabase
- **Live:** Web <https://visfaracademy.pages.dev> · Worker <https://api.visfaracademy.workers.dev>
- **Nguyên tắc:** CHỈ KIỂM TOÁN, KHÔNG SỬA MÃ NGUỒN. Không bịa số liệu: chỉ số nào chưa đo ghi rõ **"chưa đo"**. Không ghi bất kỳ secret/key/token nào vào báo cáo này (chỉ kiểm tra CÓ/KHÔNG).
- **Tài liệu đã đọc trước:** `docs/DECISIONS.md` (22 quyết định), `docs/frontend/REAL_USER_AUDIT.md`, `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md`, `docs/frontend/TASK05–TASK11_REPORT.md`, `docs/release/` (TEST_REPORT, SECURITY_REPORT S-01→S-18, PERFORMANCE_REPORT, DEPLOYMENT_GUIDE, PRODUCTION_CHECKLIST, ANALYTICS_CHECK, BACKUP_RESTORE_GUIDE), `docs/payment/SEPAY_INTEGRATION.md`, `docs/audit/`, `docs/database/`, `docs/architecture/`.

## Kết luận tổng thể (1 đoạn)

Nền tảng đã ở trạng thái **chạy được trên production nhưng chưa đủ điều kiện mở bán thật cho người dùng trả phí**: web live 200 + Worker health `ok` + test unit 644/644 (web) và 328/328 (Workers) đều PASS, 10 khóa học + Thư viện Master 119 mục hiển thị đúng; nhưng 3 chặn lớn còn nguyên — **(1) S-03 vẫn MỞ trên staging** (anon REST đọc được nội dung bài trả phí, đã chứng minh lại hôm nay); **(2) thanh toán SePay chưa từng chạy end-to-end thật** (chưa có đơn thật, chưa test POST webhook live, chưa đối soát tiền vào); **(3) email thật cho học viên chưa gửi được** (Resend "Dùng tạm", chỉ gửi cho admin). Thêm vào đó: không có sitemap.xml/robots.txt, không có CSP, LCP chưa từng đo, và toàn bộ code Task 05–11 vẫn chưa commit (1 commit duy nhất trong git). Chi tiết ở §4, §5 và Top 10 cuối báo cáo.

## Bổ sung GĐ2 — 11/11/2026 (sau kiểm toán; các mục dưới đã đổi trạng thái)

- **B-01 / S-03 — ĐÃ VÁ TRÊN STAGING, CHƯA ÁP PROD.** Migration `0028_fix_s03_lessons_rls.sql` (số 0027 đã thuộc về đánh giá 11D của nhóm song song): policy mới `lessons_select_enrolled` + view `lessons_preview_video`; áp staging HTTP 201. Anon REST `lessons` 0 dòng / 0 content (trước: 269 ký tự); JWT đã ghi danh đọc đủ 2 bài; guard route: đã ghi danh 200 đủ content, chưa ghi danh 403 `not-enrolled`, xem thử 200 `previewOnly:true` chỉ có `video_url`. **Prod vẫn chạy policy cũ — chưa áp 0028, chờ user nghiệm thu staging.**
- **B-02 — ĐÃ SỬA.** `sitemap.ts` (25 URL công khai có thật) + `robots.ts` đã deploy; live `/sitemap.xml` 200 (đủ 25 URL), `/robots.txt` 200. Không đưa `/su-kien` (không có route riêng) và `/hoc-vien/*`, `/admin/*` (cần đăng nhập) vào sitemap — lệch QĐ 11 ở điểm này, xem DECISIONS QĐ 23.
- **B-04 / S-04 — ĐÃ SỬA.** CSP + HSTS + `X-Frame-Options: SAMEORIGIN` + `Permissions-Policy` trong `next.config.ts`; đã đo đủ header thật trên production. CSP còn `'unsafe-inline'`/`'unsafe-eval'` (follow-up: nonce-based).
- **B-06 — ĐÃ SỬA.** `scripts/check-migrations.mjs` đếm động (số liên tục, không trùng): **271/271 PASS, 0 FAIL**.
- **C-05-02 — ĐẠT live:** 201 → 200 `duplicate:true` → 409; DB prod 1 dòng rồi đã xóa (Worker nối PROD); `sheetSynced:false` nên Sheet không nhận dòng test.
- **B-03 — ĐANG SỬA (commit ở cuối GĐ2, chỉ local, không push).** Deploy Pages mới `https://f55e3294.visfaracademy.pages.dev` (production 200, render đủ). Test sau GĐ2: web 660/660, Workers 328/328, typecheck PASS, `pages:build` PASS.
- **Chưa đổi trong GĐ2:** SePay end-to-end thật, email thật cho học viên, LCP, E2E live, migration 0025/0026 lên prod, 0028 lên prod.

## Bổ sung GĐ2 cuối — Prompt 18 QA + Prompt 20 Kiểm toán cuối (11/11/2026, ~14:40–15:45 +07)

- **Test suites chạy lại trong phiên này:** web **702/702 PASS** (40 file), Workers **345/345 PASS** (13 file), typecheck cả hai PASS, ESLint web PASS, `check-migrations` **319/319 PASS** (31 migration 0001–0031), `pages:build` PASS (23,02s, 57 prerendered routes). Không còn test đỏ nào (G-T10-3b đã hết).
- **Live (HTTP-level):** 16 route công khai 200, 4 route cần đăng nhập 307 đúng; sitemap 27 URL; Worker health 200; CSP/HSTS/X-Frame-Options/Permissions-Policy đủ header thật; Pages deploy mới nhất `9fd24d55` success 07:37 UTC đúng commit HEAD; Worker version #14 `76bb202c` 07:14 UTC; Supabase prod + staging ACTIVE_HEALTHY; Worker đúng 5 secret cũ.
- **UI render thật headless Chromium local (13 trang × 4 viewport = 52 lượt):** 52/52 status 200, **0 tràn ngang**, 0 pageerror; lỗi duy nhất là `ERR_SSL_PROTOCOL_ERROR` của Chromium trong VM (không TLS được ra ngoài — giới hạn VM đã biết, không phải lỗi sản phẩm) khiến các trang tải dữ liệu client-side kẹt ở "Đang tải…". Đã xem bằng mắt: trang chủ, 11D, AI Mentor, Cộng đồng, đăng nhập, tư vấn — không lỗi hiển thị.
- **Probe anon lại:** prod 0025–0031 **chưa áp** (toàn bộ bảng GĐ2 404); prod `lessons` anon vẫn đọc được 5 dòng bài trả phí nhưng `content` dài 0 ký tự (S-03 còn mở về policy, chưa rò nội dung thật). Staging: `lessons` anon 0 dòng (0028 có hiệu lực), `master_library_items` 119/119, `ai_knowledge_chunks` 138/138 (anon đọc được cả `content` — theo thiết kế, policy công khai, chỉ chứa nội dung công khai), community/gamification anon 401.
- **Lỗi mới duy nhất (Trung bình): QA-18-FUNC-01 — form Newsletter footer POST `/api/v1/newsletter` → 404 live** (Worker router chưa nối route dù frontend + handler đã có). Các lỗi Thấp mới: tên cũ "Thấu Hiểu Bản Thân" còn 1 chỗ (HomeSections.tsx:485) + văn bản trụ cột cũ; Thư viện lỗi mạng hiện lỗi thay vì dùng dữ liệu tĩnh 119 mục đã bundle.
- **Verdict Prompt 18: CHƯA NGHIỆM THU MỞ BÁN** — code GĐ2 đạt kiểm thử tự động nhưng 3 chặn P0 chưa đóng (S-03 trên prod, SePay chưa chạy thật, email thật chưa gửi được) + 0025–0031 chưa lên prod + newsletter 404. Đủ điều kiện dùng nội bộ/demo/nghiệm thu staging.
- **Kiểm toán cuối Prompt 20: điểm trung bình 20 tiêu chí 6,3/10** (cao nhất Brand/Visual/IA 8; thấp nhất Payment/Automation/Analytics 4). Chi tiết: `docs/release/FINAL_AUDIT.md`. Kế hoạch 90 ngày đã đối chiếu + bổ sung vào FINAL_AUDIT §6 (giữ khung ROADMAP, thêm: nối route newsletter, tạo tài khoản test, chốt 3 quyết định văn bản, skeleton/retry + kiểm tra a11y, kịch bản instructor thật).
- **User journey:** chỉ bước Guest (xem) và 1 phần guard bài trả phí (staging) có bằng chứng thật; 8/11 bước còn lại "chưa kiểm chứng" (không có tài khoản test; VM browser không TLS ra ngoài).
- **LCP đợt này chưa đo lại** (Chromium VM không tải được tài nguyên ngoài); đối chiếu số Prompt 16: trang chủ LCP 448–720ms, CLS 0 — đạt; CLS `/chuong-trinh` 0,56/0,17 vẫn là sai số đo VM, CLS thật chưa đo được.

## Phương pháp kiểm chứng live (đợt này)

| Kênh kiểm chứng | Kết quả |
|---|---|
| `browser.open` trang chủ live | 200, render đủ: tuyên ngôn, Sứ mệnh/Tầm nhìn, Founder, Triết lý 11 phương diện, Lộ trình 6 bước, 6 lĩnh vực, 10 chương trình, testimonial, sự kiện |
| `browser.open` Worker `/api/v1/health` | 200, `{"ok":true,"status":"ok","latency_ms":854}` |
| `browser.open` `/sitemap.xml` | **404** (không tồn tại) |
| `browser.open` GET `/api/v1/webhooks/sepay` | **404** — route chỉ nhận POST nên GET 404 là hành vi có thể kỳ vọng, **không** dùng làm bằng chứng webhook sống/chết; POST có chữ ký **chưa kiểm chứng** trong đợt này |
| curl từ VM (User-Agent mặc định) | **403 `error code: 1010`** trên cả Pages lẫn Worker — Cloudflare chặn bot từ IP VM; curl với User-Agent trình duyệt → 200. Kết luận: curl từ VM **không đáng tin** để kết luận live chết; `browser.open` mới là kênh chuẩn trong đợt này |
| Supabase Management API (token qua env var) | Prod `ugynqjqyfynkmqutoarp` ACTIVE_HEALTHY, region ap-south-1, Postgres 17; staging `scskhplczrxlnxzruweu` ACTIVE_HEALTHY, ap-southeast-2. Endpoint `/database/migrations` trả `[]` — endpoint này không liệt kê migration đã áp, **không dùng làm bằng chứng**; trạng thái áp migration được xác minh bằng anon REST probe dưới đây |
| Anon REST probe prod + staging (chỉ đọc) | Xem §8. Prod: 10 khóa published; `master_library_items` **404** → migration 0025 **chưa áp prod**; staging: thư viện **119/119 mục**. S-03: staging vẫn rò content bài trả phí (269 ký tự); prod trả row bài trả phí nhưng `content` rỗng (seed chưa có nội dung) — policy vẫn mở |
| Cloudflare API (key qua env var) | Account xác thực OK; Pages project `visfaracademy`, deploy production mới nhất **success 2026-11-11 06:10:33 UTC**, id `010353fb`, commit `54b6321` (dirty) |
| `wrangler secret list` (Worker `api`, chỉ tên) | **Có (5):** APPS_SCRIPT_URL, RESEND_API_KEY, SEPAY_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL. **Không có:** RESEND_FROM_EMAIL, RESEND_WEBHOOK_SECRET, TURNSTILE_SECRET, UNSUBSCRIBE_SECRET, SEPAY_API_TOKEN, SEPAY_BANK_ACCOUNT_ID, SEPAY_MERCHANT_ID (đối chiếu `workers/api/src/env.ts`; RESEND_FROM_EMAIL chưa set là **có chủ đích** theo QĐ "Dùng tạm") |
| Test suite chạy lại hôm nay | Web: **644/644 PASS, 34 file** (trước đây 546/548, 2 fail GAP đã hết — xem §2). Workers: **328/328 PASS, 12 file**. Web `tsc --noEmit` PASS, `eslint` PASS, Workers `tsc` PASS |
| `node scripts/check-migrations.mjs` | **FAIL 1 kiểm tra** — script hard-code danh sách migration cũ (không biết 0020–0026); đây là lỗi script, không phải lỗi migration (xem §4, B-06) |

---

## (1) Kiến trúc hiện tại

- **Frontend:** Next.js 15.4.11 + React 19, App Router, TypeScript, deploy Cloudflare Pages (`visfaracademy.pages.dev`, build qua `@cloudflare/next-on-pages`, `pages_build_output_dir=.vercel/output/static`). Monorepo npm workspaces: `apps/web`, `packages/shared`, `workers/api`, `supabase/`, `scripts/`, `tests/`.
- **Backend/API:** Cloudflare Worker `api` (`api.visfaracademy.workers.dev`), Hono-style router tay trong `workers/api/src/index.ts`, tiền tố `/api/v1`. Routes đã nối: leads, progress, health, orders (+ my/orders, transactions, coupons/validate, membership-plans, my/enrollments), webhooks SePay (+ alias không `/v1`), admin orders/coupons/membership-plans/payments, appointments, referrals. Email/Resend, automation-cron, course-completion nằm trong Worker.
- **Database:** Supabase Postgres 17. Prod ref `ugynqjqyfynkmqutoarp` (ap-south-1), staging `scskhplczrxlnxzruweu` (ap-southeast-2). Migrations 0001–0026 (đã đổi số xong: S-02 đã được xử lý bằng cách renumber — 4 file 0017 cũ nay là 0017–0022 theo thứ tự mới; xem §8).
- **Thanh toán:** SePay gói FREE (50 GD tiền vào/tháng), tài khoản MB Bank dùng chung của Công ty TNHH MTV Visfar Holdings (không tách tài khoản — QĐ 15). Webhook `POST /api/v1/webhooks/sepay`, HMAC-SHA256, secret đã set cho Worker.
- **Email:** Resend, trạng thái "Dùng tạm" (QĐ 14 Task 02): chưa mua domain riêng, chưa xác minh SPF/DKIM/DMARC, chỉ gửi qua `onboarding@resend.dev` cho chính admin; chưa gửi được email thật cho học viên.
- **Video:** YouTube unlisted (QĐ 16 — chấp nhận đánh đổi: ai có link đều xem được).
- **Lead:** API làm lớp trước → ghi DB (nguồn sự thật) → ghi Sheet (bản sao đối soát) qua Apps Script; fallback Apps Script cũ còn giữ theo QĐ.
- **Nhận diện:** đen than + vàng gold + nền ivory champagne; 3 trụ cột khóa học **Thân – Tâm – Tuệ** (migration 0024, đã áp prod theo DECISIONS); 10 khóa học; Thư viện Master 119 mục; Blog 3 bài tĩnh.

## (2) Chức năng đang hoạt động (đã có bằng chứng)

| # | Chức năng | Bằng chứng đợt này |
|---|---|---|
| 1 | Trang chủ + 10 chương trình + Triết lý 11 phương diện + Lộ trình 6 bước | `browser.open` live render đủ; REAL_USER_AUDIT 82/82 lượt sạch (0 ảnh vỡ, 0 tràn ngang, 0 lỗi console thật) |
| 2 | Menu 7 mục | Code `Header.tsx` NAV = TRANG CHỦ, GIỚI THIỆU, CÁC KHÓA HỌC, SỰ KIỆN, BLOG, KẾT NỐI, THƯ VIỆN MASTER; lỗi CTA che menu đã sửa + kiểm chứng 12/12 (REAL_USER_AUDIT §3) |
| 3 | Danh sách khóa học từ Supabase prod | Anon REST prod `courses?status=published` → 10 khóa |
| 4 | Trang chi tiết khóa học xem A–Z không cần đăng nhập; bài trả phí khóa + cuộn tới đăng ký | QĐ 20 (DECISIONS); view `lessons_public` anon trả 200 cả prod + staging |
| 5 | Thư viện Master 119 mục + tìm kiếm không dấu + link chéo | Staging anon đếm 119/119; QĐ 22: chunk JS live chứa đủ 119/119 slug; prod tạm chạy dữ liệu mặc định trong code (do 0025 chưa áp prod) |
| 6 | Worker health + leads + progress + orders + payments + appointments + referrals (code + test) | Health live 200 `ok/latency 854ms`; Workers vitest 328/328; router `index.ts` nối đủ các route trên |
| 7 | Auth: đăng ký/đăng nhập/đổi/quên/đặt lại mật khẩu, session guard, callback | Web test 45 test auth PASS (mock); route `/dang-nhap`, `/dang-ky`, `/auth/callback` build được; redirect 307 đúng khi chưa đăng nhập (REAL_USER_AUDIT) |
| 8 | LMS: quiz (chấm server qua RPC `submit_quiz_attempt`), assignment (upload bucket private `submissions`), certificate (mã `VISFAR-CERT-YYYY-NNNNNN`, tra cứu công khai qua RPC chỉ trả 6 trường), progress 90% video | Web test: quiz 34, assignment 25, certificate 32, progress 47 — đều PASS (mock/fake client); TASK08 kiểm chứng live 17/17 (theo SECURITY_REPORT §6) |
| 9 | Admin: quản lý khóa/bài, học viên, đơn hàng, CRM lead, mã giảm giá, gói thành viên, audit log | 14 trang `/admin/*` + 22 route `/api/admin/*` tồn tại trong code; test admin 73 test PASS (mock) |
| 10 | RLS chặn leo thang quyền H1–H4 | Đã vá bằng 0009 + kiểm chứng live bị chặn (BACKEND_TEST_REPORT §5E, dẫn lại trong SECURITY_REPORT §2); anon REST prod/staging: `profiles`/`orders`/`payments`/`enrollments` đều trả `[]` |
| 11 | Chống trùng lead (Idempotency-Key) ở tầng code + test | Handler leads kiểm tra key trước khi ghi, trùng key + khác body → 409; test local PASS. **Live chưa chạy** — xem §3 (C-05-02) |
| 12 | H1–H4 + quiz `is_correct` không lộ | Anon `question_options` → `[]`; view `question_options_public` không có cột `is_correct` (400 `42703` khi hỏi cột đó — theo SECURITY_REPORT, chưa chạy lại đợt này) |

## (3) Chức năng chưa hoạt động / chưa kiểm chứng live

| # | Chức năng | Trạng thái thật |
|---|---|---|
| 1 | **Thanh toán SePay end-to-end thật** | Chưa từng chạy: chưa có đơn thật, chưa test POST webhook live (chỉ có test chữ ký 200 đúng/401 sai theo DECISIONS — chưa kiểm chứng độc lập trong đợt này), chưa đối soát tiền vào, chưa có giao dịch nào vượt qua `reference_code DH-…` → `paid` → enrollment. Webhook SePay #71562 (theo task) chưa được đối chiếu với dashboard my.sepay.vn trong đợt này (không có quyền truy cập dashboard) |
| 2 | **C-05-02 chống trùng Idempotency-Key live** | **ĐẠT live 11/11/2026 (GĐ2):** 201 `duplicate:false` → 200 `duplicate:true` (cùng mã `VISFAR-2026-708302`) → 409 `idempotency_conflict`; DB prod 1 dòng rồi đã xóa, kiểm tra lại 0 dòng; `sheetSynced:false` (xem CHANGELOG GĐ2) |
| 3 | **Email thật cho học viên** | Chưa gửi được (Resend "Dùng tạm"). `RESEND_FROM_EMAIL` chưa set có chủ đích; webhook Resend chưa nối route (`POST /api/webhooks/resend` chưa tồn tại — theo SECURITY_REPORT S-11; code Svix verify đã có) |
| 4 | **Turnstile CAPTCHA thật** | Chưa có site key + secret; form đang chạy ở chế độ fail-open (rate-limit + honeypot + log) theo QĐ 13 Task 03 |
| 5 | **Admin đăng/sửa blog** | Chưa có — blog hiện là dữ liệu tĩnh 3 bài (QĐ 21) |
| 6 | **Thư viện Master trên prod từ DB** | Chưa — 0025 chưa áp prod, prod chạy dữ liệu mặc định trong code |
| 7 | **Migration 0026 (đổi tên khóa 08) trên prod** | Chưa áp prod (theo DECISIONS; prod đã có sẵn title mới từ trước nên không cần đổi — chưa kiểm chứng lại bằng query prod trong đợt này) |
| 8 | **Tài khoản disabled chặn đăng nhập/học** | Chưa rõ hiệu lực: 0022 (trigger chặn tự sửa `is_disabled`) đã áp prod theo DECISIONS, nhưng nội dung trigger **chưa đọc lại** trong đợt này; SECURITY_REPORT S-01 ghi middleware/layout chưa kiểm tra `is_disabled` — chưa xác minh đã sửa hay chưa |
| 9 | **AI Mentor (Prompt 12), Cộng đồng (13), Gamification (14), 11D (11)** | Không có code/route/module nào cho 4 tính năng này trong repo (grep theo tên trong `SYSTEM_MODULES.md` không thấy triển khai) — xem bảng đối chiếu §12 |
| 10 | **SEO/CRO (15), Hiệu năng (16), QA E2E (18)** | Chưa hoàn thành: sitemap 404, LCP chưa đo, chưa có E2E live (xem §4–§7) |
| 11 | **Kiểm thử 2 tài khoản live (A đọc dữ liệu B, vượt quyền)** | Chưa chạy lại trong đợt này (lần gần nhất: BACKEND_TEST_REPORT §5E + Task 08 §9.6); mật khẩu tài khoản test các đợt trước không được ghi lại |
| 12 | **Nút "Kiểm tra thanh toán" / đối soát bù qua SePay API v2** | Code đối soát có trong `payments.ts`/`sepay.ts` (test contract PASS) nhưng chưa chạy thật; `SEPAY_API_TOKEN` chưa set trong Worker secrets |

## (4) Lỗi (đã xác minh đợt này, mã B-AUDIT-*)

| Mã | Mức | Lỗi | Bằng chứng |
|---|---|---|---|
| B-01 | **Cao** | **S-03 ~~vẫn MỞ trên staging~~ → ĐÃ VÁ STAGING 11/11/2026 (GĐ2, migration 0028), CHƯA áp prod:** anon REST `lessons` nay 0 dòng / 0 content; xem § "Bổ sung GĐ2" ở đầu báo cáo | Probe staging hôm nay (trước vá): `lessons?is_free_preview=eq.false` → 200, bài "Bài 2 — Thay đổi từ gốc nhận thức", `content` dài 269 ký tự. Prod: policy vẫn mở (chưa áp 0028) nhưng `content` seed đang rỗng nên chưa rò nội dung thật — rủi ro sẽ thành thật ngay khi có content |
| B-02 | **Cao** | **~~Không có sitemap.xml / robots.txt~~ → ĐÃ CÓ 11/11/2026 (GĐ2):** `sitemap.ts` (25 URL) + `robots.ts`; live `/sitemap.xml` 200, `/robots.txt` 200 | Trước GĐ2: `browser.open` `/sitemap.xml` → 404; không có file `sitemap.ts`/`robots.ts` trong `apps/web/src/app/` |
| B-03 | **Cao** | **Git: 1 commit duy nhất, toàn bộ Task 05–11 chưa commit** (162 dòng thay đổi/untracked) | `git log` chỉ có `54b6321 Module 1: Foundation`; `git status --short` 162 dòng. Mất code / không rollback được nếu VM lỗi; deploy Pages đang build từ working tree dirty (commit_hash `54b6321`, `commit_dirty: true`) |
| B-04 | **Trung bình** | **~~Không có CSP, HSTS, X-Frame-Options~~ → ĐÃ CÓ 11/11/2026 (GĐ2, S-04):** CSP + HSTS + `X-Frame-Options: SAMEORIGIN` trong `next.config.ts`; đã đo đủ header thật trên production | Trước GĐ2: `next.config.ts` `headers()` chỉ có `X-Content-Type-Options: nosniff` + `Referrer-Policy` |
| B-05 | **Trung bình** | **Middleware chỉ đọc `exp` JWT, không verify chữ ký; cookie phiên không HttpOnly** (S-05 còn nguyên) | Đã ghi nhận từ Task 06, code chưa đổi; bù lại mọi route thật đều `auth.getUser()`/JWKS nên chưa rò dữ liệu — lớp phòng thủ yếu, không phải lỗ rò trực tiếp |
| B-06 | **Thấp** | **~~`scripts/check-migrations.mjs` FAIL 1 kiểm tra (lỗi thời)~~ → ĐÃ SỬA 11/11/2026 (GĐ2):** đếm động, **271/271 PASS, 0 FAIL** | Trước GĐ2: script hard-code danh sách migration cũ; repo nay có 28 file 0001–0028. FAIL đúng 1 check "đủ 24 migration theo thứ tự" |
| B-07 | **Thấp** | **Anon được INSERT trực tiếp `event_registrations`** (S-07 còn nguyên) | Policy `0001:551–552` cho anon INSERT `user_id NULL`; chưa có frontend đăng ký sự kiện nên rủi ro hiện tại thấp |
| B-08 | **Thấp** | **Đường ghi tiến độ trực tiếp trong `learning.ts` còn sót** (S-06) | `upsertProgress`/`markLessonComplete` vẫn ghi trực tiếp client → sẽ nhận 42501 live; trang học bài chưa chuyển hẳn sang `progress.ts` (Workers) — theo SECURITY_REPORT, chưa kiểm chứng lại code trong đợt này |
| B-09 | **Thấp** | **`current_role()` đọc cache `profiles.role`, lệch QĐ "`user_roles` là nguồn duy nhất"** (S-17) | Theo SECURITY_REPORT; chưa kiểm chứng lại trong đợt này |
| B-10 | **Thấp** | **LCP / Lighthouse chưa từng đo** (không phải lỗi code, là khoảng trống kiểm chứng) | PERFORMANCE_REPORT: Chrome headless bị chặn bởi chính sách WebGL của VM; không có số LCP/FCP/CLS/INP nào |
| — | Đã sửa từ đợt trước | S-02 (4 file cùng số 0017) → đã renumber thành 0017–0026; S-01 → migration 0022 đã áp prod theo DECISIONS (trigger chặn tự sửa `is_disabled`); test GAP `payments.test.ts` G-T10-3b → nay web test 644/644 PASS, không còn fail | Đối chiếu DECISIONS + chạy test hôm nay |

## (5) Bảo mật

- **Đã vá + kiểm chứng live:** H1–H4 (0009): tự nâng role, tự ghi danh, tự ghi tiến độ giả, insert profile sai role — đều bị chặn live (BACKEND_TEST_REPORT §5E). Anon REST prod/staging: `profiles`, `orders`, `payments`, `enrollments`, `leads`, `system_settings`, `certificates`, `audit_logs`, `user_roles` đều trả `[]`.
- **Còn mở — ưu tiên sửa trước khi mở bán:**
  1. **S-03 (Cao):** xem B-01. Hướng sửa đã có trong SECURITY_REPORT: view `lessons_public` làm đường đọc công khai; thu hẹp policy bảng `lessons` gốc (chỉ API/service-role đọc `content`/`video_url`/`file_url`).
  2. **S-04 (Trung bình):** thiếu CSP/HSTS/X-Frame-Options (B-04).
  3. **S-05 (Trung bình):** middleware không verify chữ ký JWT + cookie không HttpOnly (B-05).
  4. **S-07 (Trung bình):** anon INSERT `event_registrations` (B-07).
  5. **S-15 (Trung bình, theo QĐ đã chốt):** Turnstile fail-open; fallback Apps Script không có chống spam — giữ theo quyết định user, cần ghi rõ giới hạn.
  6. **S-12 (Thấp):** chống scrub video có kẽ hở ở request đầu tiên (khai 90% ngay từ đầu được chấp nhận).
  7. **S-13 (Thấp):** `contentType` avatar lấy từ `file.type` client gửi.
  8. **S-08/S-16/S-17 (Thấp):** mâu thuẫn policy SELECT `payments`; `orders_admin_update` thiếu `WITH CHECK`; `current_role()` đọc cache.
- **Không phát hiện mới trong đợt này:** không có secret/key hard-code trong `src/` (grep `dangerouslySetInnerHTML` chỉ thấy 2 chỗ an toàn: JSON-LD Organization trong `layout.tsx` và SVG tam giác tĩnh trong `TriangleDiagram.tsx` — không render HTML người dùng); không SQL injection (toàn bộ qua supabase-js builder/RPC tham số); không open-redirect (`isSafeNextPath`).
- **Lưu ý quy trình:** webhook SePay đã có secret (`SEPAY_WEBHOOK_SECRET` có trong `wrangler secret list`); thuật toán chữ ký SePay trong code là HMAC-SHA256 `sha256=<hmac(timestamp + '.' + raw_body)>` theo `docs/payment/SEPAY_INTEGRATION.md` §4.2 — **chưa kiểm chứng POST thật** nên chưa thể khẳng định khớp với SePay production.

## (6) Điểm yếu UI/UX

1. **Chưa kiểm chứng trạng thái đã đăng nhập trên live bằng trình duyệt thật:** REAL_USER_AUDIT chạy trên server local (trình duyệt test trong VM không ra Internet); các trang `/hoc-vien`, `/admin` chỉ kiểm tra ở trạng thái chưa đăng nhập (redirect 307 đúng); header đã đăng nhập chỉ mô phỏng bằng DOM. Cần 1 lượt trình duyệt đã đăng nhập bằng tài khoản admin thật trên live (theo chính REAL_USER_AUDIT).
2. **Tuyên ngôn 13,65px ở 390px + nhãn Tam giác hiện thực ~3,98px:** user đã chấp nhận (QĐ 1–2) — ghi nhận là giới hạn đã chốt, không phải lỗi cần sửa; legend 16px cho tam giác đã có theo ALIGNMENT (chưa kiểm chứng lại trong đợt này).
3. **Hover toàn trang (`@media (hover: hover)`):** chưa kiểm chứng được bằng headless Chromium trong VM (`hover: none`) — cần trình duyệt desktop thật có chuột (QĐ 21).
4. **Ảnh giảng viên xuất hiện 2 lần trên trang chủ** (mục Giải pháp doanh nghiệp + thẻ Workshop) — đúng theo yêu cầu user, ghi nhận không phải lỗi.
5. **Tìm kiếm:** header có ô tìm kiếm (theo REAL_USER_AUDIT §4, label sr-only "Tìm khóa học, giảng viên"); tìm kiếm trong Thư viện Master hoạt động (lọc không dấu, "tri tue" → 8 mục). **Chưa kiểm chứng tìm kiếm header có trả kết quả thật hay không** trong đợt này — cần test live.
6. **Nút nổi Zalo + CTA cố định phủ nội dung khi cuộn** — hành vi thiết kế đã chốt, không sửa.

## (7) Điểm yếu chuyển đổi (CRO)

1. **Chưa có luồng mua thật:** không có đơn thật nào đi qua SePay → không thể đo tỷ lệ chuyển đổi xem → mua; mọi số CRO hiện tại đều là giả định. Đây là điểm yếu lớn nhất về chuyển đổi.
2. **Không có sitemap/robots** (B-02) + **không có analytics đo chuyển đổi**: ANALYTICS_CHECK ghi 9/12 chỉ số có, **3 không có** (điểm quiz tổng hợp, email, **tỷ lệ chuyển đổi**); kiến trúc M12 (tổng hợp ở Workers + cache) chưa implemented — dashboard hiện đọc trực tiếp Supabase bằng JWT admin.
3. **Email onboarding/chăm sóc chưa gửi được cho học viên** (Resend "Dùng tạm") — mất kênh nuôi dưỡng sau đăng ký; email chỉ tới admin.
4. **Giá "Tùy tâm/0đ" cho tới khi user cung cấp giá** (QĐ 11 Task 03): chưa có giá thật cho khóa trả phí → chưa có căn cứ định giá, chưa test được `amount_vnd > 0` end-to-end (CHECK cho phép >= 0).
5. **Form đăng ký tư vấn còn đường fallback Apps Script** (QĐ 3 giữ "thành công giả" + QĐ 8 giữ PII trong mailto/clipboard) — hai rủi ro đã được cảnh báo và user chấp nhận; cần đối soát lead hàng ngày (C-05-08, cần vận hành thật 14 ngày — chưa chạy).
6. **Thiếu bằng chứng xã hội động:** testimonial 8 học viên là tĩnh (đã xác nhận cho phép đăng); chưa có số học viên/doanh thu thật theo chương trình/kênh để xếp hạng (theo MEMORY/alignment).

## (8) Database hiện tại

- **Migrations:** 26 file `0001–0026` trong `supabase/migrations/`. Đã áp **staging**: 0025 + 0026 (HTTP 201, đã xác minh — staging có `master_library_items` 119 mục; theo DECISIONS). Đã áp **prod**: tới 0024 (0022/0023/0024 HTTP 201, đã xác minh — theo DECISIONS); **0025/0026 chưa áp prod** (xác minh lại hôm nay: prod `master_library_items` → 404 `PGRST205`).
- **Schema (đếm từ migration, tĩnh):** 55 lệnh `CREATE TABLE` (gồm tên cũ trước rename như `modules`, `quiz_questions`); ~46 tên bảng riêng; **38 bảng vật lý** theo QĐ Task 03 (31 bảng Task 03 + `course_instructors` + `question_options` + 5 bảng Module 1). 123 `CREATE POLICY`, 21 hàm (`CREATE [OR REPLACE] FUNCTION`), 16 trigger, 14 view (gồm `lessons_public`, `question_options_public` không có `is_correct`).
- **Seed:** 10 khóa học (prod anon đếm `0-9/10`); thư viện staging 119 mục; 3 bài blog tĩnh (không phải seed DB).
- **Storage buckets:** 5 bucket theo BACKEND_TEST_REPORT §5D (gồm `avatars` public + `submissions` private); migration 0007/0015 có guard tạo bucket nếu `storage.buckets` tồn tại — **chưa kiểm chứng danh sách bucket live** trong đợt này (không có quyền Storage API trong đợt kiểm toán).
- **RLS:** bật trên mọi bảng vật lý (theo SECURITY_REPORT §4.1); 2 lỗ còn mở xem §5 (S-03, S-07) + S-01 đã vá bằng 0022 (theo DECISIONS; nội dung trigger chưa đọc lại đợt này).
- **Chức năng DB chưa kiểm chứng live:** hàm `submit_quiz_attempt`, `verify_certificate`, trigger tạo profile (`handle_new_user`), trigger đồng bộ role — chỉ có test mock + báo cáo Task 08; chưa chạy lại bằng tài khoản test thật trong đợt này.
- **Backup:** có `docs/release/BACKUP_RESTORE_GUIDE.md` + `docs/supabase/BACKUP_GUIDE.md`; **chưa kiểm chứng đã chạy backup/restore thật lần nào** (không có log backup trong repo).

## (9) Module tái sử dụng (đã có, dùng được cho giai đoạn 2)

| Module | Vị trí | Ghi chú |
|---|---|---|
| Design tokens / CSS luxury (đen than + vàng gold + ivory) | `apps/web/src/styles/globals.css` | Đã chốt; QĐ 12 yêu cầu dọn dead code trên file hiện tại (chưa xác minh đã dọn xong chưa) |
| Header/Footer/Menu 7 mục + AccountNav | `apps/web/src/components/layout/` | Tái dùng cho mọi trang mới |
| CourseCard / CourseCurriculum / LessonPlayer | `apps/web/src/components/course/` | Player YouTube-nocookie, quy tắc 90% |
| Auth lib + session guard + `isSafeNextPath` | `apps/web/src/lib/auth*.ts`, `session-guard.ts` | 45 test PASS |
| API client + mã lỗi chuẩn (`ApiErrorCode`) | `apps/web/src/lib/api-client.ts` | Dùng chung cho mọi route Next.js |
| Leads lib (honeypot + idempotency + fallback Apps Script) | `apps/web/src/lib/leads.ts`, `workers/api/src/handlers/leads.ts` | Idempotency live chưa chạy (C-05-02) |
| Worker: JWT verify (RS256 + JWKS), rate-limit (KV fallback bộ nhớ), Turnstile fail-open, SePay verify (HMAC-SHA256 + timing-safe) | `workers/api/src/jwt.ts`, `rate-limit.ts`, `turnstile.ts`, `sepay.ts` | Test 328/328 PASS |
| Worker: email templates (E1–E13 + Task 11), token hủy đăng ký HMAC 90 ngày, Svix verify | `workers/api/src/email/` | Chưa gửi thật (Resend "Dùng tạm") |
| Payments: orders, idempotency, `reference_code DH-YYYY-NNNNNN`, chống trùng `UNIQUE (method, gateway_reference)` | `workers/api/src/handlers/payments*.ts`, `payments.ts` | Chưa chạy thật |
| Master Library data + tìm kiếm không dấu | `apps/web/src/lib/master-library-data.ts` | 119 mục nguyên văn |
| Admin libs: users/CRM/LMS-admin/dashboard | `apps/web/src/lib/admin-*.ts`, `crm.ts`, `lms-admin.ts` | Test PASS; một số lib chưa có route gọi (S-14 đã nối phần lớn — cần rà lại) |
| Test harness: 34 file web + 12 file Workers, fake Supabase | `apps/web/src/**/*.test.ts`, `workers/api/test/` | 972 test PASS tổng cộng hôm nay (644 + 328) |

## (10) Kiến trúc đề xuất (giữ nguyên nền tảng, sửa theo thứ tự)

1. **Giữ nguyên:** Next.js 15 + Cloudflare Pages + Workers + Supabase (QĐ 19 đã chốt Next.js; không đổi framework). Không tách tài khoản MB, không đổi domain API.
2. **Sửa bảo mật trước (§5):** thu hẹp policy `lessons` qua view (S-03) → thêm CSP/HSTS (S-04) → verify JWT ở middleware + cookie HttpOnly (S-05) → drop anon INSERT `event_registrations` (S-07). Mỗi sửa kèm probe anon lại như §8.
3. **Hoàn thiện thanh toán:** test POST webhook SePay thật (chữ ký đúng → 200 + đơn `paid`; sai → 401; replay → không trùng đơn) → 1 đơn thật end-to-end (tạo đơn → chuyển khoản thật → webhook → enrollment → email) → đối soát bù qua SePay API v2 + nút "Kiểm tra thanh toán".
4. **Hoàn thiện email:** mua domain riêng → xác minh SPF/DKIM/DMARC → set `RESEND_FROM_EMAIL` → nối `POST /api/webhooks/resend` → gửi thử 1 email thật cho học viên.
5. **SEO/CRO:** thêm `sitemap.ts` + `robots.ts` (QĐ 11) → đo LCP/Lighthouse trên máy thật → analytics tỷ lệ chuyển đổi (M12) → Turnstile site key thật.
6. **Mới (Prompt 11–14):** 11D, AI Mentor, Cộng đồng, Gamification — xây thành module riêng trên nền đã có (xem §11), không sửa lại LMS lõi.
7. **Quy trình:** commit toàn bộ code Task 05–11 ngay (B-03); cập nhật `check-migrations.mjs` (B-06); cấm build song song chung `.next` (đã gây fail giả 2 lần); tạo tài khoản test dùng chung có ghi lại (admin/student/instructor) để chạy lại kiểm thử 2 tài khoản.

## (11) Kế hoạch triển khai (đề xuất cho giai đoạn 2 — thứ tự ưu tiên)

| Giai đoạn | Việc | Điều kiện xong |
|---|---|---|
| **P0 — Chặn mở bán (trước mọi thứ)** | Vá S-03; test lại probe anon; commit code; áp 0025/0026 lên prod sau khi user nghiệm thu staging | Probe anon bài trả phí trả `[]`/không content; git sạch (0 thay đổi chưa commit) |
| **P0 — Tiền** | Test POST webhook SePay thật + 1 đơn thật end-to-end + C-05-02 live | Đơn `paid` → enrollment → email đối soát khớp; gửi 2 lần cùng key chỉ 1 dòng |
| **P1 — Tin cậy** | CSP/HSTS; middleware verify JWT; email domain riêng + gửi thật; Turnstile key thật; sitemap/robots | Header live có CSP; email học viên nhận được; sitemap.xml 200 |
| **P1 — Đo lường** | LCP/Lighthouse trên máy thật; analytics chuyển đổi; đối soát lead 14 ngày | Có số LCP thật (không bịa); có tỷ lệ chuyển đổi |
| **P2 — Tính năng mới** | Prompt 11 (11D) → 13 (Cộng đồng) → 12 (AI Mentor) → 14 (Gamification) — thứ tự đề xuất: cộng đồng trước (nền cho gamification + AI Mentor cần dữ liệu hành vi), 11D song song | Mỗi module có test + kiểm chứng live riêng, không phá LMS lõi |
| **P2 — Tài liệu + QA** | Prompt 19 (tài liệu còn thiếu) + 18 (QA E2E toàn luồng) + 20 (kiểm toán cuối + kế hoạch 90 ngày) | E2E: mới → đăng ký → đăng nhập → mua → học → hoàn thành → chứng nhận → hỗ trợ, chạy bằng tài khoản thật |

## (12) Rủi ro

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R-01 | S-03 rò nội dung khóa trả phí trước khi mở bán | Cao | Vá P0; chưa bán khóa có content thật trước khi vá |
| R-02 | SePay FREE hết 50 GD/tháng (tài khoản MB dùng chung — mọi khoản tiền vào đều tính) | Cao | Theo dõi số GD; chuẩn bị nâng STARTUP; lọc webhook theo tiền tố `DH` |
| R-03 | Mất code do chưa commit (1 commit, working tree dirty) | Cao | Commit ngay; backup repo |
| R-04 | Webhook SePay sai thuật toán/header chữ ký thật → từ chối mọi webhook thật (fail-closed) | Trung bình | Test POST thật trước khi mở bán; đối chiếu tài liệu SePay chính thức |
| R-05 | Email không tới học viên (Resend chưa xác minh domain) | Trung bình | Mua domain + xác minh DNS trước khi mở bán; hiện chỉ dùng cho admin |
| R-06 | LCP chưa đo — trải nghiệm mobile có thể chậm mà không biết | Trung bình | Đo trên máy thật trước khi quảng cáo |
| R-07 | Turnstile fail-open + fallback Apps Script không chống spam → spam lead | Trung bình | Rate-limit + honeypot đang chạy; đối soát lead hàng ngày |
| R-08 | Video YouTube unlisted bị chia sẻ link / tải lại | Thấp | Đã chấp nhận (QĐ 16); không dùng làm kênh chống sao chép |
| R-09 | SePay API v2 rate limit 3 req/giây | Thấp | Webhook làm luồng chính, API chỉ đối soát bù |
| R-10 | Trùng lặp migration / script kiểm tra lỗi thời | Thấp | Đã renumber xong; cập nhật `check-migrations.mjs` |

---

## BẢNG ĐỐI CHIẾU 21 PROMPT ↔ TRẠNG THÁI HIỆN TẠI

> **Lưu ý nguồn:** file MASTER PROMPT PACK gốc **không có trong repo** (đã tìm trong `workspace/` — không thấy file tên "master prompt pack"). Bảng dưới suy ra từ `docs/DECISIONS.md` (Task 01–03), `docs/frontend/TASK05–TASK11_REPORT.md`, `docs/release/*`, `docs/architecture/SYSTEM_MODULES.md` và mô tả trong lệnh kiểm toán (Prompt 02 = kiểm toán này; các prompt 04–10 phần lớn đã xong; thiếu/dở: 03, 11–20). **Cần parent đối chiếu lại tên prompt chính xác với pack gốc** trước khi dùng làm đầu vào giai đoạn 2.

| Prompt | Nội dung (theo suy luận từ tài liệu) | Trạng thái | Bằng chứng |
|---|---|---|---|
| 01 | Audit ban đầu (Task 01) | ✅ Đã xong | `docs/audit/WEBSITE_AUDIT.md`, `docs/DECISIONS.md` 19 QĐ |
| 02 | **Kiểm toán toàn bộ (báo cáo này)** | ✅ Đã xong (báo cáo này) | File này, 11/11/2026 |
| 03 | Design system | ⚠️ **Làm dở** | Tokens đen–vàng–ivory + CSS luxury đã có và đang dùng; còn thiếu: dọn dead code CSS (QĐ 12 — chưa xác minh xong), chưa có tài liệu design system riêng |
| 04 | Foundation (Next.js + Supabase schema/RLS/seed) | ✅ Đã xong | Commit `54b6321`; 38 bảng, 10 khóa, RLS 38/38 (theo BACKEND_TEST_REPORT §5D) |
| 05 | Frontend + form lead (Task 05) | ✅ Đã xong (trừ kiểm chứng live) | `TASK05_REPORT.md`; C-05-01–C-05-04 **chưa chạy live** (chờ deploy + tài khoản test) |
| 06 | Auth + Dashboard + bảo mật H1–H4 (Task 06) | ✅ Đã xong | `TASK06_*_REPORT.md`; H1–H4 đã vá + kiểm chứng live |
| 07 | LMS lõi: bài học, progress, guard (Task 07) | ✅ Đã xong | `TASK07_REPORT.md`; còn sót S-06 (ghi trực tiếp trong `learning.ts`) |
| 08 | Quiz + Assignment + Certificate (Task 08) | ✅ Đã xong | `TASK08_REPORT.md`; live 17/17 (theo SECURITY_REPORT) |
| 09 | Admin + CRM + vô hiệu hóa user (Task 09) | ✅ Đã xong (code) | `TASK09_REPORT.md`; S-01 đã vá bằng 0022 (theo DECISIONS) |
| 10 | Commerce + Payment SePay (Task 10) | ⚠️ **Làm dở** | `TASK10_REPORT.md`; code + test đủ, **chưa chạy thật** (webhook POST, đơn thật, đối soát) |
| 11 | 11D (11 phương diện — "Thập Nhất Viên Mãn" mở rộng?) | ❌ **Chưa làm** | Không có module/route nào tên 11D trong repo; chỉ có nội dung 11 phương diện tĩnh trên trang chủ |
| 12 | AI Mentor | ❌ **Chưa làm** | Không có code/route/API nào cho AI Mentor |
| 13 | Cộng đồng | ❌ **Chưa làm** | Chỉ có phần "Cộng đồng" tĩnh + link nhóm (theo MEMORY); không có diễn đàn/nhóm trong nền tảng |
| 14 | Gamification | ❌ **Chưa làm** | Không có điểm/huy hiệu/bảng xếp hạng trong code hay schema |
| 15 | SEO/CRO | ⚠️ **Làm dở** | OG/Twitter/canonical/JSON-LD + h1 đã có; **thiếu sitemap.xml/robots.txt**; chưa có analytics chuyển đổi; LCP chưa đo |
| 16 | Hiệu năng | ⚠️ **Làm dở** | Bundle tốt (shared 100 kB), TTFB localhost tốt; **LCP/Lighthouse chưa đo**; lazy-load hầu như chưa có (theo PERFORMANCE_REPORT) |
| 17 | Security audit | ⚠️ **Làm dở** | SECURITY_REPORT S-01→S-18 đã có; **S-03 vẫn mở**, S-04/S-05/S-07 chưa sửa |
| 18 | QA (E2E) | ⚠️ **Làm dở** | TEST_REPORT: unit 644/644 + Workers 328/328 PASS; **chưa có E2E live** toàn luồng |
| 19 | Tài liệu còn thiếu | ⚠️ **Làm dở** | Tài liệu kiến trúc/database/release đầy đủ; còn thiếu: báo cáo Task 09–11 đã có nay (86/223/152 dòng) — nhưng thiếu tài liệu design system (P03), tài liệu vận hành SePay live, log backup/restore thật |
| 20 | Kiểm toán cuối + kế hoạch 90 ngày | ❌ **Chưa làm** | Đây mới là kiểm toán giữa kỳ (Prompt 02); kế hoạch 90 ngày chưa có |
| 21 | (Prompt 21 — chưa rõ tên trong pack) | ❓ **Không xác định được** | Không có trong tài liệu đã đọc; cần đối chiếu pack gốc |

## TOP 10 VẤN ĐỀ NGHIÊM TRỌNG NHẤT

1. **S-03 ~~vẫn mở trên staging~~ → đã vá staging (0028, 11/11/2026); còn mở trên prod cho tới khi áp 0028 lên prod** (B-01).
2. **Thanh toán SePay chưa từng chạy thật** — chưa có đơn thật, chưa test POST webhook live.
3. **Email thật cho học viên chưa gửi được** (Resend "Dùng tạm").
4. **~~Code Task 05–11 chưa commit~~ → đã commit local 11/11/2026 (`f577747`, chỉ local, không push); cây làm việc sạch.**
5. **~~Không có sitemap.xml/robots.txt~~ → đã có, live 200 (B-02).**
6. **~~Không có CSP/HSTS~~ → đã có, live đủ header (S-04).**
7. **Migration 0025/0026 chưa áp prod** — Thư viện Master prod chạy dữ liệu tĩnh trong code.
8. **C-05-02 ~~(chống trùng Idempotency-Key live) chưa chạy~~ → ĐẠT live 11/11/2026.**
9. **LCP chưa từng đo** — không biết tốc độ thật trên mobile.
10. **Chưa có kiểm thử E2E live toàn luồng** (mới → đăng ký → đăng nhập → mua → học → hoàn thành → chứng nhận → hỗ trợ) bằng tài khoản thật.

> **Cập nhật 11/11/2026 (Prompt 18 + 20):** Top 10 đã rà lại trong `docs/release/FINAL_AUDIT.md` §2 (thêm: migrations GĐ2 chưa lên prod, newsletter 404 live, chưa có remote/CI/backup thật). Verdict: **CHƯA NGHIỆM THU MỞ BÁN** — xem `docs/release/QA_REPORT.md` §0. Điểm trung bình 20 tiêu chí: **6,3/10**.

## HÀNH TRÌNH KHÁCH HÀNG — ĐÃ KIỂM THỬ LIVE CHỖ NÀO / CHƯA CHỖ NÀO

| Bước | Đã kiểm thử live | Chưa kiểm thử live |
|---|---|---|
| Mới (xem trang chủ, khóa học) | ✅ `browser.open` live render đủ; anon REST 10 khóa | Tìm kiếm header chưa test |
| Đăng ký (tài khoản) | ❌ — chỉ test mock (45 test auth) | Tạo tài khoản thật + trigger tạo profile |
| Đăng nhập | ❌ — chỉ redirect 307 khi chưa đăng nhập | Đăng nhập thật trên live bằng trình duyệt |
| Mua (SePay) | ❌ | Toàn bộ: tạo đơn → chuyển khoản → webhook → enrollment |
| Học (video/quiz/bài tập) | ❌ — chỉ test mock | Phát video thật, làm quiz thật, nộp bài thật |
| Hoàn thành (90% / quiz đạt) | ❌ — chỉ test mock (B-T08-5 mới nối trong code) | Hoàn thành khóa thật |
| Chứng nhận | ❌ — chỉ test mock | Cấp + tra cứu chứng chỉ thật |
| Hỗ trợ (Zalo, tư vấn, khiếu nại) | ⚠️ Form tư vấn có code + fallback Apps Script; nút Zalo tồn tại trên trang | Gửi form tư vấn thật end-to-end qua API mới + đối soát Sheet |

---

*Báo cáo này không sửa mã nguồn. Mọi khẳng định đều gắn bằng chứng (lệnh đã chạy / link live / file đã đọc) như ghi trong từng mục; chỗ nào chưa đo/chưa kiểm chứng đều ghi rõ "chưa đo"/"chưa chạy". Không chứa secret/key/token nào.*
