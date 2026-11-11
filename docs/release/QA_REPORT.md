# BÁO CÁO QA TOÀN HỆ THỐNG — VISFAR ACADEMY (Prompt 18, GĐ2 cuối)

- **Ngày QA:** 11/11/2026, phiên ~14:40–15:30 +07 (giờ Việt Nam)
- **Phạm vi:** `workspace/visfar-academy-platform` — Next.js 15 + Cloudflare Workers + Supabase; web live <https://visfaracademy.pages.dev>, Worker <https://api.visfaracademy.workers.dev>
- **Người QA:** subagent QA cuối đợt GĐ2 (không phải tác giả các module GĐ2)
- **Tài liệu đã đọc trước:** `docs/PROJECT_AUDIT.md` (GĐ1), `docs/DECISIONS.md` (QĐ 1–23), `docs/CHANGELOG.md`, `docs/release/` (TEST_REPORT, SECURITY_REPORT, PRODUCTION_CHECKLIST, PERFORMANCE_REPORT), `docs/frontend/TASK11_11D_REPORT.md`, `TASK12_AI_MENTOR_REPORT.md`, `TASK13_14_REPORT.md`, `SEO_CRO_PERFORMANCE_REPORT.md`, `docs/ROADMAP.md`
- **Nguyên tắc:** chỉ ghi PASS cho thứ đã chạy thật và đạt; chỗ nào chưa kiểm chứng ghi rõ **"chưa kiểm chứng"**. Không bịa số liệu, không ghi secret/key/token nào vào báo cáo này. **Không sửa code trong phiên QA này** (0 file code thay đổi; các lỗi nhỏ cũng chỉ ghi vào báo cáo để builder sửa có kiểm chứng lại — xem QA-18-UI-01/02).
- **Môi trường chạy lệnh:** VM, `XDG_DATA_HOME=/tmp/vdata-qa`, build/test chạy solo trong cửa sổ yên (không build song song chung `.next`).
- **BỔ SUNG — Đợt P0 11/11/2026 ~15:50–16:05 +07 (user nói "Làm hết cho tôi"):** xem **§11 Kiểm thử lại sau sửa** ở cuối báo cáo này — 3/5 chặn P0 đã đóng (S-03 trên prod, 0025–0031 lên prod, newsletter 404); verdict **vẫn CHƯA NGHIỆM THU MỞ BÁN THẬT** vì SePay E2E + email học viên thật còn mở.

## 0. VERDICT — KẾT LUẬN NGHIỆM THU

### ❌ CHƯA NGHIỆM THU MỞ BÁN THẬT (không đủ điều kiện phát hành cho người dùng trả phí)

| Tiêu chí nghiệm thu | Kết quả |
|---|---|
| Test suites (web + Workers) + typecheck + lint + build | ✅ **PASS toàn bộ** — web 702/702, Workers 345/345, tsc cả hai PASS, lint PASS, `check-migrations` 319/319 PASS, `pages:build` PASS |
| Bảo mật nghiêm trọng (rò nội dung trả phí / leo thang quyền / mất dữ liệu) | ❌ **Còn 1 lỗi Cao mở trên PROD: S-03** — migration 0028 chưa áp prod, anon REST prod vẫn đọc được dòng `lessons` (xem QA-18-SEC-01). Không phát hiện lỗi bảo mật nghiêm trọng MỚI nào do GĐ2 gây ra |
| Thanh toán | ❌ **Chưa chạy thật** — chưa có POST webhook SePay live, chưa có đơn thật, chưa đối soát (trạng thái không đổi từ GĐ1) |
| Quyền học / ghi danh | ⚠️ Chưa kiểm chứng bằng tài khoản thật (không có tài khoản test; xem §7) |
| Mất dữ liệu | ✅ Không phát hiện nguy cơ mất dữ liệu mới; không có migration phá dữ liệu trong 0027–0031 |
| Tính năng GĐ2 trên staging | ✅ 11D / AI Mentor / Cộng đồng / Gamification đều có code + test + kiểm chứng staging |
| Tính năng GĐ2 trên PROD | ❌ **0025–0031 chưa áp prod** — AI Mentor trên live trả 502, Thư viện prod chạy dữ liệu tĩnh trong code, Cộng đồng/Gamification/11D-lưu-kết-quả chưa chạy được trên prod |
| Lỗi chức năng mới phát hiện | ⚠️ **1 lỗi Trung bình mới: form Newsletter footer POST → 404 live** (QA-18-FUNC-01) — route Worker chưa được nối dù frontend + handler đã có |

**Diễn giải:** code GĐ2 đạt chất lượng kiểm thử tự động (1047/1047 test PASS) và không phá vỡ gì đang chạy; nhưng **điều kiện mở bán vẫn chưa đủ** vì 3 chặn P0 từ GĐ1 chưa đóng (S-03 trên prod, SePay chưa chạy thật, email thật cho học viên chưa gửi được) cộng thêm 2 chặn mới của GĐ2 (0025–0031 chưa lên prod; newsletter 404). Hệ thống **đủ điều kiện dùng nội bộ / demo / nghiệm thu staging**, chưa đủ điều kiện thu tiền học viên thật.

---

## 1. Kết quả kiểm thử tự động (chạy thật trong phiên này)

| Lệnh | Kết quả | Thời gian |
|---|---|---|
| `npm test` — `apps/web` | **702/702 PASS, 40 file, 0 fail** | ~12s |
| `npm test` — `workers/api` | **345/345 PASS, 13 file, 0 fail** | ~10s |
| `npm run typecheck` — `apps/web` (`tsc --noEmit`) | **PASS, exit 0** | — |
| `npm run typecheck` — `workers/api` | **PASS, exit 0** | — |
| `npm run lint` — `apps/web` (`eslint .`) | **PASS, exit 0, 0 lỗi, 0 warning** | — |
| `node scripts/check-migrations.mjs` | **319/319 PASS, 0 FAIL** (31 migration 0001–0031 liên tục, không trùng số) | — |
| `npm run pages:build` — `apps/web` | **PASS, exit 0, 23,02s, 57 prerendered routes**, 0 lỗi prerender | — |

So với GĐ1: web 644 → **702** (+58 test mới GĐ2: 11D, AI Mentor, Cộng đồng, Gamification, SEO, Analytics), Workers 328 → **345** (+17 AI Mentor). Test GAP `payments.test.ts` G-T10-3b đã hết (suite exit 0). Không còn test đỏ nào.

---

## 2. Kiểm chứng live — HTTP-level (browser.open + curl User-Agent trình duyệt)

### 2.1 Trang công khai — trạng thái HTTP

| Route | Status | Ghi chú |
|---|---|---|
| `/` | 200 | Render đủ: tuyên ngôn, Sứ mệnh/Tầm nhìn, Founder, Triết lý 11 phương diện, Lộ trình 6 bước, 6 lĩnh vực, 10 chương trình, testimonial, sự kiện |
| `/chuong-trinh` | 200 | Shell + bộ lọc render; danh sách khóa tải client-side (xem §3) |
| `/chuong-trinh/thau-hieu-noi-tam` | 200 | Route tồn tại; nội dung chi tiết tải client-side (xem §3) |
| `/thu-vien-master` | 200 | Shell render; nội dung 119 mục tải client-side (xem §3) |
| `/danh-gia-11d` | 200 | Render đủ nhánh công khai: 33 câu, thang 1–5, lưu nháp localStorage |
| `/ai-mentor` | 200 | Render đủ nhánh chưa đăng nhập: mô tả + nút Đăng nhập/Đăng ký + disclaimer y tế/pháp lý/tài chính |
| `/cong-dong` | 200 | Render đủ: mô tả + form đăng bài + lọc khóa học (danh sách tải sau đăng nhập) |
| `/blog` | 200 | Đủ 3 bài tĩnh đã chốt |
| `/tu-van` | 200 | Form tư vấn render đủ trường (xem ảnh §3) |
| `/dang-nhap`, `/dang-ky` | 200 | Form đăng nhập render đủ (Email/Mật khẩu/Quên mật khẩu/Đăng ký) |
| `/chung-chi/tra-cuu` | 200 | Trang tra cứu công khai render đủ |
| `/goi-thanh-vien` | 200 | Trang gói thành viên render đủ |
| `/sitemap.xml` | 200 | **27 URL** (tăng từ 25: thêm `/danh-gia-11d`, `/chung-chi/tra-cuu`) |
| `/robots.txt` | 200 | Chặn `/api/`, `/admin/`, `/hoc-vien/`, `/auth/`, `/thanh-toan/`; có Sitemap |
| `/hoc-vien`, `/hoc-vien/thanh-tich`, `/admin`, `/admin/cong-dong` | **307** | Guard đúng: chưa đăng nhập chuyển về đăng nhập |

### 2.2 Worker API + header bảo mật

| Kiểm tra | Kết quả |
|---|---|
| `GET /api/v1/health` | 200 `{"ok":true,"status":"ok","latency_ms":1444}` (lần gọi này) |
| `POST /api/v1/ai-mentor/ask` không JWT | **401** đúng |
| `GET /api/v1/webhooks/sepay` | 404 — route chỉ nhận POST, hành vi kỳ vọng, không dùng làm bằng chứng webhook sống/chết |
| `POST /api/v1/newsletter` live | **404 `{"ok":false,"error":"not_found"}`** — xem QA-18-FUNC-01 |
| Header `/` live (curl -I, UA trình duyệt) | `Content-Security-Policy` ✅, `Strict-Transport-Security: max-age=31536000; includeSubDomains` ✅, `X-Frame-Options: SAMEORIGIN` ✅, `Permissions-Policy: camera=(), microphone=(), geolocation=()` ✅, `X-Content-Type-Options: nosniff` ✅, `Referrer-Policy` ✅. CSP còn `'unsafe-inline'`/`'unsafe-eval'` (follow-up nonce-based, đã biết) |
| Cloudflare API (key qua env var) | Pages project `visfaracademy`: deploy production mới nhất **9fd24d55, success, 2026-11-11 07:37 UTC, commit `dca216d`** (= HEAD hiện tại). Worker `api` version mới nhất **76bb202c (#14), 2026-11-11 07:14 UTC** (bản AI Mentor) |
| Supabase Management API (token qua env var) | Prod `ugynqjqyfynkmqutoarp` **ACTIVE_HEALTHY**, ap-south-1; staging `scskhplczrxlnxzruweu` **ACTIVE_HEALTHY**, ap-southeast-2 |
| `wrangler secret list` Worker `api` (chỉ tên) | **Có đúng 5:** APPS_SCRIPT_URL, RESEND_API_KEY, SEPAY_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL. **Không có:** RESEND_FROM_EMAIL (có chủ đích, "Dùng tạm"), TURNSTILE_SECRET, SEPAY_API_TOKEN, SEPAY_BANK_ACCOUNT_ID, SEPAY_MERCHANT_ID, OPENAI_API_KEY / GEMINI_API_KEY |

### 2.3 Form tư vấn — không gửi lead thật mới

Dùng lại kết quả **C-05-02 đã PASS live** (GĐ2 P0): `POST /api/v1/leads` 201 `duplicate:false` → 200 `duplicate:true` (cùng mã `VISFAR-2026-708302`) → 409 `idempotency_conflict`; dòng test đã xóa khỏi DB prod, kiểm tra lại 0 dòng; `sheetSynced:false`. **Không gửi thêm lead thật nào trong phiên QA này** (theo yêu cầu task). Form `/tu-van` render đủ trường ở cả live (crawler) và local headless (xem §3). Luồng gửi form end-to-end bằng trình duyệt thật vẫn **chưa kiểm chứng** (cần browser-task có đăng nhập/không đăng nhập + đối soát Sheet).

---

## 3. UI — render thật bằng headless Chromium local (Playwright-core + chromium đã cache)

- **Cách chạy:** `next start` local (port 3100, build từ `pages:build` trong phiên này) + Chromium headless; **13 trang × 4 viewport (390/768/1024/1440) = 52 lượt**, mỗi lượt ghi status, tràn ngang (`scrollWidth > innerWidth`), console error, pageerror, request failed, LCP; chụp ảnh từng lượt.
- **Kết quả tổng:** **52/52 status 200, 0 tràn ngang ở cả 4 chiều rộng, 0 pageerror, 0 lỗi console thật của ứng dụng.**
- **Nhiễu môi trường (không phải lỗi sản phẩm):** 208 lỗi `net::ERR_SSL_PROTOCOL_ERROR` — Chromium trong VM này không TLS-handshake được tới bất kỳ HTTPS ngoài nào (Supabase, Worker, và cả RSC `localhost`); kèm 52 thông báo "Failed to fetch RSC payload… Falling back to browser navigation" (hệ quả của cùng lỗi TLS khi prefetch route `/hoc-vien/giao-dich`). Đã thử `--ignore-certificate-errors`: vẫn lỗi y hệt. Đây là **giới hạn đã biết của VM** (Prompt 16 ghi cùng hiện tượng với Supabase), không phải lỗi code. Hệ quả: các trang tải dữ liệu client-side từ Supabase kẹt ở trạng thái "Đang tải…" trong render local (xem bảng dưới) — nội dung thật của các trang đó chỉ kiểm chứng được bằng trình duyệt thật / dữ liệu đã kiểm chứng ở các đợt trước.
- **LCP đợt này: chưa đo được** — `performance.getEntriesByType('largest-contentful-paint')` trả rỗng trong cả 52 lượt (do tài nguyên ngoài không tải được trong VM); **đối chiếu số Prompt 16** thay vì bịa số mới (xem §6).

| Trang | 390 | 768 | 1024 | 1440 | Xem bằng mắt |
|---|---|---|---|---|---|
| `/` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ Hero + tuyên ngôn 3 dòng + intro căn đều, không lỗi hiển thị |
| `/chuong-trinh` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ Tiêu đề + bộ lọc (Tất cả/Thân/Tâm/Tuệ/Cộng đồng) đẹp; danh sách khóa kẹt "Đang tải danh sách khóa học…" do TLS VM (nội dung 10 khóa đã kiểm chứng live qua trang chủ) |
| `/chuong-trinh/thau-hieu-noi-tam` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ⚠️ Breadcrumb render; nội dung kẹt "Đang tải khóa học…" do TLS VM; **không có h1 trong DOM ở trạng thái tải** (h1 chỉ xuất hiện sau khi dữ liệu về — cần kiểm chứng bằng trình duyệt thật) |
| `/thu-vien-master` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ⚠️ Banner + "Đang tải thư viện…" kẹt do TLS VM; nội dung 119 mục đã kiểm chứng bằng dữ liệu (code đủ 119 slug; staging anon đếm 119 — xem §5) |
| `/danh-gia-11d` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ Intro 33 câu + "Đã trả lời 0/33 câu" + mục 01 Tâm thức, không lỗi hiển thị |
| `/ai-mentor` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ Cổng đăng nhập + disclaimer đầy đủ, không lỗi hiển thị |
| `/cong-dong` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ Cổng "chỉ dành cho học viên đã đăng nhập" + nút Đăng nhập/Đăng ký, không lỗi hiển thị |
| `/blog` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ (chỉ kiểm tra trạng thái + tràn ngang; nội dung 3 bài đã kiểm chứng live qua browser.open) |
| `/dang-nhap` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ Form sạch, đủ trường, nút ≥44px, không lỗi hiển thị |
| `/tu-van` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ Form Họ và tên / SĐT + ghi chú 10 chữ số render đủ |
| `/chung-chi/tra-cuu` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ (trạng thái + tràn ngang) |
| `/goi-thanh-vien` | 200, không tràn | 200, không tràn | 200, không tràn | 200, không tràn | ✅ (trạng thái + tràn ngang; gói tải từ Worker nên kẹt dữ liệu trong VM) |
| `/hoc-vien/thanh-tich` | 200 → chuyển `/dang-nhap?next=…` | như 390 | như 390 | như 390 | ✅ Guard đúng ở cả 4 viewport |

Ảnh chụp lưu tại `/tmp/qa-render/shots/` (52 file, chỉ dùng trong phiên QA, không commit).

---

## 4. Tích hợp — Frontend ↔ Supabase ↔ Cloudflare ↔ SePay ↔ Email

| Tích hợp | Trạng thái thật |
|---|---|
| Frontend → Supabase (anon REST) | ✅ Chạy: prod 10 khóa published; staging đủ GĐ2. Lỗi TLS chỉ xảy ra trong Chromium VM, không xảy ra ở curl/browser.open |
| Frontend → Worker API | ✅ Health 200; leads idempotency PASS live; ai-mentor ask 401 khi không JWT |
| Cloudflare Pages + Worker deploy | ✅ Deploy mới nhất success, đúng commit HEAD; Worker version #14 đúng bản AI Mentor |
| SePay | ⚠️ **Chưa chạy thật:** route webhook + hàm verify HMAC-SHA256 đã có trong code (test 345/345), secret đã set; nhưng **chưa từng test POST webhook live, chưa có đơn thật, chưa đối soát**; `SEPAY_API_TOKEN`/`SEPAY_BANK_ACCOUNT_ID` chưa set nên đối soát bù qua API v2 chưa chạy được |
| Email (Resend) | ⚠️ **Chưa gửi được cho học viên** ("Dùng tạm", QĐ 14 Task 02): chỉ gửi qua `onboarding@resend.dev` cho admin; `RESEND_FROM_EMAIL` chưa set có chủ đích; **route `POST /api/webhooks/resend` chưa có trong Worker router**; cron/automation chưa nối (`index.ts` chỉ export `fetch`, không có `scheduled`) |
| Newsletter | ❌ **Hỏng live:** frontend `NewsletterForm` POST tới `/api/v1/newsletter` nhưng Worker router không có route này (cũng không có `/api/v1/newsletter/unsubscribe` dù handler `unsubscribe.ts` đã có) — xem QA-18-FUNC-01 |
| Google Sheet (đối soát lead) | ⚠️ Lead ghi DB trước (nguồn sự thật), Sheet là bản sao; lần test C-05-02 `sheetSynced:false` nên Sheet không nhận dòng test; đối soát 14 ngày chưa chạy |
| Turnstile CAPTCHA | ⚠️ Fail-open theo QĐ (chưa có site key + secret); chỉ còn rate-limit + honeypot |

---

## 5. Bảo mật — probe anon lại (chỉ đọc, không tạo/sửa/xóa)

Probe anon REST trên cả prod và staging (key anon từ `.env.local`/`.env.staging` local, không ghi giá trị key vào báo cáo):

### 5.1 PROD (`ugynqjqyfynkmqutoarp`)

| Bảng/view | Kết quả anon | Kết luận |
|---|---|---|
| `courses?status=published` | 200, **10 khóa** | ✅ Đúng |
| `master_library_items` | 404 `PGRST205` | 0025 **chưa áp prod** — prod chạy dữ liệu tĩnh trong code |
| `lessons` | 200, 5 dòng, bài trả phí `is_free_preview=false`, **`content` dài 0 ký tự** cả 5 bài | ⚠️ **S-03 vẫn MỞ về policy trên prod** (anon đọc được dòng); chưa rò nội dung thật vì content seed đang rỗng — xem QA-18-SEC-01 |
| `lessons_public` | 200, 5 dòng metadata (chỉ `id`, `title`) | ✅ |
| `lessons_preview_video` | 404 `PGRST205` | 0028 chưa áp prod |
| `assessments_11d`, `ai_knowledge_chunks`, `ai_chat_sessions`, `ai_chat_messages`, `community_*` (4), `learning_points`, `badges`, `user_badges`, `learning_streaks` | 404 `PGRST205` toàn bộ | 0027/0029/0030/0031 **chưa áp prod** |
| `profiles`, `orders`, `payments`, `enrollments`, `event_registrations` | 200, **0 dòng** | ✅ Không rò rỉ |

### 5.2 STAGING (`scskhplczrxlnxzruweu`) — 0025–0031 đã áp

| Bảng/view | Kết quả anon | Kết luận |
|---|---|---|
| `courses?status=published` | 200, 10 khóa | ✅ |
| `master_library_items` | 200, **đếm 119/119** (`Content-Range: 0-118/119`) | ✅ |
| `lessons` | 200, **0 dòng** | ✅ **S-03 đã đóng trên staging** (0028 có hiệu lực) |
| `lessons_public` | 200, 2 dòng metadata | ✅ |
| `lessons_preview_video` | 200, 0 dòng | ✅ (chưa có bài xem thử có video trong seed staging) |
| `assessments_11d` | 200, 0 dòng | ✅ RLS owner-only chặn anon |
| `ai_knowledge_chunks` | 200, **đếm 138/138**; anon SELECT được cả cột `content` | ⚠️ Theo thiết kế (policy `ai_knowledge_chunks_select_public`, "Tri thức công khai") — xem QA-18-SEC-02 (Thấp) |
| `ai_chat_sessions`, `ai_chat_messages` | 200, 0 dòng | ✅ RLS owner-only |
| `community_posts/comments/reactions/reports` | **401 `42501`** (không có quyền SELECT cho anon) | ✅ Chặn cứng hơn cả RLS rỗng |
| `learning_points`, `badges`, `user_badges`, `learning_streaks` | **401 `42501`** | ✅ Client không đọc/ghi điểm trực tiếp (điểm do trigger server-side) |
| `profiles`, `orders`, `payments`, `enrollments`, `event_registrations` | 200, 0 dòng | ✅ |

### 5.3 Các mục bảo mật cũ (đối chiếu SECURITY_REPORT, không chạy lại kiểm thử 2 tài khoản trong phiên này)

- H1–H4 (0009): đã vá + kiểm chứng live bị chặn ở các đợt trước; **không chạy lại kiểm thử 2 tài khoản trong phiên này** (không có tài khoản test — mật khẩu các đợt trước không được ghi lại; xem QA-18-E2E-01).
- S-01 (tự mở lại tài khoản bị disable): đã vá bằng 0022 + chặn đăng nhập ở middleware; 0022 **đã áp prod** (QĐ 20) — không kiểm chứng lại bằng tài khoản thật trong phiên này.
- S-04 (CSP/HSTS): **đã đóng** — header đo thật trên prod (§2.2).
- S-05 (middleware không verify chữ ký JWT + cookie không HttpOnly): **còn mở** (không đổi trong GĐ2).
- S-06 (đường ghi tiến độ trực tiếp trong `learning.ts`): **còn mở** (không đổi trong GĐ2).
- S-07 (anon INSERT `event_registrations`): **còn mở** theo policy text (không thử INSERT thật trong phiên này vì sẽ tạo dữ liệu; SELECT anon trả 0 dòng).
- S-08/S-12/S-13/S-16/S-17: **còn mở** (không đổi trong GĐ2).
- Không phát hiện secret hard-code trong `src/` (grep `sb_secret_` = 0 kết quả; service-role chỉ qua `env` Worker).

---

## 6. Hiệu năng — đối chiếu số đo Prompt 16

**Đợt này không đo lại LCP/CLS/INP thật** (Chromium VM không tải được tài nguyên ngoài; `largest-contentful-paint` trả rỗng cả 52 lượt — xem §3). Số dưới đây là số Prompt 16 đã đo thật bằng headless Chromium local (`docs/frontend/perf-*.json`, 11/11/2026 07:27–07:34 UTC), được đối chiếu lại trong phiên này (không bịa số mới):

| Trang / viewport | LCP | CLS | INP-proxy | TTFB | Kết luận Prompt 16 |
|---|---|---|---|---|---|
| Trang chủ 390px | 616–720ms | 0 | 24ms | 19–20ms | ✅ Đạt cả 3 mục tiêu |
| Trang chủ 1440px | 448–520ms | 0 | — | 16–18ms | ✅ Đạt |
| `/chuong-trinh` 390px | 672–780ms | **0,56** | 24ms | 19–70ms | ⚠️ CLS là **sai số đo của VM** (Supabase rớt `ERR_SSL_PROTOCOL_ERROR`, trang kẹt ở trạng thái tải); CLS thật khi có dữ liệu **chưa đo được** |
| `/chuong-trinh` 1440px | 896–980ms | **0,17** | — | 9ms | ⚠️ Cùng sai số đo như trên |
| Bundle | First Load JS shared **100 kB**; JS trang ~237–243 kB; ảnh dưới fold đã lazy; font tự host | | | | ✅ Tốt |

**Chưa có:** LCP/FCP/CLS/INP **trên live** (máy thật / Lighthouse thật), INP thật (cần tương tác thật), điểm Lighthouse. Đây vẫn là khoảng trống kiểm chứng từ GĐ1 (B-10), chưa đóng trong GĐ2.

---

## 7. User journey — từng bước đã kiểm chứng tới đâu

| Bước | Đã kiểm chứng | Chưa kiểm chứng |
|---|---|---|
| Guest: xem trang chủ, khóa học, thư viện, blog | ✅ Live render đủ (browser.open + headless local); 10 khóa + 3 bài blog + 119 mục thư viện (dữ liệu) | Danh sách khóa `/chuong-trinh` và nội dung chi tiết khóa render sau JS — chưa xem được bằng trình duyệt thật trong phiên này (crawler/local VM đều kẹt ở trạng thái tải) |
| Register: tạo tài khoản | ❌ | **Chưa kiểm chứng** — chỉ test mock (45 test auth PASS); không tạo tài khoản thật |
| Login: đăng nhập | ❌ | **Chưa kiểm chứng** — chỉ guard 307 khi chưa đăng nhập + form render; chưa đăng nhập thật bằng trình duyệt |
| Free Course: học khóa miễn phí | ❌ | **Chưa kiểm chứng** — chưa có enrollment thật, chưa phát video thật |
| Paid Course: xem/khóa bài trả phí | ⚠️ Một phần | Guard route đã kiểm chứng trên staging ở GĐ2 P0 (chưa ghi danh → 403 `not-enrolled`; xem thử → 200 `previewOnly:true` chỉ có `video_url`); trên **prod chưa kiểm chứng** (0028 chưa áp) |
| Payment: tạo đơn → chuyển khoản → webhook → paid | ❌ | **Chưa kiểm chứng** — toàn bộ: chưa có đơn thật, chưa test POST webhook live, chưa đối soát |
| Enrollment: ghi danh sau thanh toán | ❌ | **Chưa kiểm chứng** — chỉ có UNIQUE + test mock |
| Learning: video/quiz/bài tập/tiến độ | ❌ | **Chưa kiểm chứng** — chỉ test mock (quiz 34, assignment 25, progress 47 PASS); chưa phát video thật, chưa làm quiz thật, chưa nộp bài thật |
| Completion: hoàn thành khóa | ❌ | **Chưa kiểm chứng** — chỉ test mock (quy tắc 90% video, quiz đạt → completed) |
| Certificate: cấp + tra cứu | ⚠️ Một phần | Tra cứu công khai `/chung-chi/tra-cuu` render 200; **chưa cấp chứng chỉ thật, chưa tra cứu mã thật** |
| Hỗ trợ: tư vấn / Zalo / khiếu nại | ⚠️ Một phần | Form tư vấn render đủ; C-05-02 chống trùng lead PASS live; **chưa gửi form thật end-to-end + đối soát Sheet**; nút Zalo tồn tại (chưa bấm thật) |

**Kết luận journey:** chỉ bước Guest (xem) và 1 phần Paid-guard (staging) có bằng chứng thật; **8/11 bước còn lại ở trạng thái "chưa kiểm chứng"** — không ghi PASS cho bất kỳ bước nào trong số đó.

---

## 8. Danh sách lỗi (mã QA-18-*)

### 8.1 Lỗi mới phát hiện trong phiên này

| Mã | Mức | Lỗi | Bằng chứng / Tái hiện | Ảnh hưởng | Giải pháp | Trạng thái |
|---|---|---|---|---|---|---|
| **QA-18-FUNC-01** | **Trung bình** | **Form Newsletter footer hỏng live: `POST /api/v1/newsletter` → 404 `not_found`** | `curl -X POST https://api.visfaracademy.workers.dev/api/v1/newsletter` → 404. `workers/api/src/index.ts` không có route `newsletter` / `newsletter/unsubscribe` / `webhooks/resend` dù frontend `NewsletterForm.tsx` + `newsletter.ts` POST tới đó và handler `workers/api/src/email/unsubscribe.ts` đã có. QĐ 6 ("Newsletter footer — Làm thật") chưa hoàn thành ở tầng Worker | Người đăng ký nhận tin ở footer (mọi trang) luôn thất bại; mất kênh thu lead/email nuôi dưỡng | Nối route `POST /api/v1/newsletter` (+ `unsubscribe` + `webhooks/resend`) vào Worker router, deploy, test live 201 + trùng email → không trùng dòng | **MỞ** |
| **QA-18-SEC-02** | Thấp | **Anon đọc được toàn bộ `content` của `ai_knowledge_chunks` (138 chunk) qua REST trực tiếp** | Staging anon `GET /rest/v1/ai_knowledge_chunks?select=id,content` → 200, trả đủ nội dung chunk. Policy `ai_knowledge_chunks_select_public` (`using (true)`) có chủ đích trong 0029 ("Tri thức công khai") | Thấp: nội dung chunk chỉ gồm Thư viện Master (công khai) + mô tả khóa học (công khai) + triết lý trang chủ — **không có nội dung bài trả phí** (đã xác nhận không index `lessons`). Nhưng nó **vượt qua ghi chú enrollment** của route ask (chưa ghi danh chỉ dùng mô tả công khai) ở tầng REST trực tiếp | Nếu muốn siết: đổi policy thành chỉ `authenticated`, hoặc tách chunk khóa học ra bảng/view riêng; nếu giữ công khai thì ghi rõ quyết định vào SECURITY_GUIDE | **MỞ (ghi nhận)** |
| **QA-18-UI-01** | Thấp | **Tên cũ "Thấu Hiểu Bản Thân" còn sót 1 chỗ + văn bản cũ về trụ cột** | `apps/web/src/components/home/HomeSections.tsx:485` — link tài nguyên "Bắt đầu tại đây" vẫn ghi `<strong>Thấu Hiểu Bản Thân</strong>` (href đã đúng slug mới `thau-hieu-noi-tam`). Dòng giới thiệu "Từ thấu hiểu bản thân đến phát triển trí tuệ…" còn ở trang chủ + `/chuong-trinh`; intro `/tu-van` còn "theo thứ tự Tâm thức, Trí tuệ, Nhân hiệu" (trụ cột cũ, QĐ 20 đã đổi thành Thân–Tâm–Tuệ) | Nhầm lẫn tên khóa/trụ cột cho người đọc; không ảnh hưởng chức năng | Đổi nhãn theo tên mới khi user chốt (2 điểm còn lại đã nêu trong ROADMAP §5) | **MỞ** |
| **QA-18-UI-02** | Thấp | **Thư viện Master: lỗi mạng → hiện lỗi thay vì dùng dữ liệu mặc định 119 mục đã bundle trong code** | `apps/web/src/lib/master-library.ts` (`fetchPublishedLibraryItems`): `catch` lỗi network (`TypeError`/fetch fail) trả `{status:'error', message:'Không có kết nối mạng…'}`; chỉ khi DB trả `error` (vd. bảng chưa có) mới fallback dữ liệu mặc định. Trong render local, trang kẹt ở "Đang tải thư viện…" rồi rơi vào trạng thái lỗi thay vì hiện 119 mục tĩnh | Người dùng mạng chập chờn thấy trang lỗi dù nội dung tĩnh đã có sẵn trong code | Cân nhắc: lỗi network cũng fallback dữ liệu mặc định + hiện ghi chú "đang xem bản ngoại tuyến" (quyết định UX, không tự đổi trong QA) | **MỞ (ghi nhận)** |

### 8.2 Lỗi cũ còn mở (đối chiếu, không phải phát hiện mới)

| Mã | Mức | Lỗi | Trạng thái |
|---|---|---|---|
| **QA-18-SEC-01 (= B-01 / S-03)** | **Cao** | **S-03 vẫn MỞ trên PROD: 0028 chưa áp prod** — anon REST prod đọc được dòng `lessons` (5 dòng, bài trả phí, `content` hiện dài 0 ký tự vì seed rỗng). Policy sẽ rò nội dung thật ngay khi khóa có content thật | **MỞ — BLOCKER mở bán.** Đã đóng trên staging (anon 0 dòng). Cần user nghiệm thu staging rồi áp 0028 lên prod + probe lại |
| QA-18-INT-01 | **Cao** | **Migration 0025–0031 chưa áp prod** — AI Mentor live 502 `upstream_error` (prod chưa có bảng, theo TASK12); Thư viện prod chạy dữ liệu tĩnh; Cộng đồng/Gamification/11D-lưu-kết-quả chưa chạy được trên prod | **MỞ — BLOCKER mở bán GĐ2.** Cần nghiệm thu staging → áp theo thứ tự (backup trước mỗi lần áp) |
| QA-18-PAY-01 | **Cao** | **SePay chưa từng chạy end-to-end thật** (không đổi từ GĐ1): chưa test POST webhook live, chưa có đơn thật, chưa đối soát; `SEPAY_API_TOKEN`/`SEPAY_BANK_ACCOUNT_ID` chưa set | **MỞ — BLOCKER mở bán** |
| QA-18-MAIL-01 | **Trung bình** | **Email thật cho học viên chưa gửi được** (Resend "Dùng tạm"; không đổi từ GĐ1) + route webhook Resend chưa nối + cron chưa nối | **MỞ** |
| QA-18-E2E-01 | **Trung bình** | **Chưa có kiểm thử E2E live toàn luồng bằng tài khoản thật** (không đổi từ GĐ1): không có tài khoản test dùng chung (mật khẩu các đợt trước không được ghi lại); VM browser không ra Internet qua TLS tới Supabase/Worker | **MỞ.** Cần tạo 3 tài khoản test (admin/student/instructor), ghi lại ở nơi an toàn (không ghi vào repo), rồi chạy lại bằng browser-task |
| QA-18-SEC-03 (= S-05) | Trung bình | Middleware chỉ đọc `exp` JWT, không verify chữ ký; cookie phiên không HttpOnly | **MỞ** (không đổi trong GĐ2) |
| QA-18-SEC-04 (= S-07) | Trung bình | Anon được INSERT trực tiếp `event_registrations` (policy 0001) | **MỞ** (không đổi trong GĐ2) |
| QA-18-SEC-05 (= S-06/S-08/S-12/S-13/S-16/S-17) | Thấp | Đường ghi tiến độ trực tiếp còn sót trong `learning.ts`; mâu thuẫn SELECT `payments`; kẽ hở scrub video ở request đầu; `contentType` avatar từ client; thiếu `WITH CHECK`; `current_role()` đọc cache | **MỞ** (không đổi trong GĐ2) |
| QA-18-PERF-01 (= B-10) | Thấp | LCP/CLS/INP **trên live** chưa từng đo; CLS `/chuong-trinh` thật chưa đo được (số 0,56/0,17 là sai số đo VM) | **MỞ** (không đổi trong GĐ2) |
| QA-18-OPS-01 | Thấp | Chưa có remote GitHub (git remote trống); chưa có CI; chưa từng backup/restore thật; chưa có cron giữ ấm/nhắc học | **MỞ** — 1 phần (git) sẽ đóng bằng commit cuối đợt này (chỉ local, không push) |

### 8.3 Đã đóng trong GĐ2 (kiểm chứng lại trong phiên này)

| Mã gốc | Nội dung | Bằng chứng đóng |
|---|---|---|
| B-02 | Sitemap/robots | Live `/sitemap.xml` 200 (27 URL), `/robots.txt` 200 |
| B-04 / S-04 | CSP/HSTS | Header đo thật trên prod (§2.2) |
| B-06 / S-09 | `check-migrations.mjs` lỗi thời | 319/319 PASS, đếm động, 31 migration |
| B-T12-2 (G-T10-3b) | Test payments assertion lỗi thời | Web test 702/702, exit 0 |
| S-10 | Workers `tsc` FAIL + test biến động | Workers tsc PASS, vitest 345/345 PASS |
| S-02 | Trùng số migration 0017 | 31 file 0001–0031 liên tục, không trùng |
| C-05-02 | Chống trùng Idempotency-Key live | ĐẠT live (GĐ2 P0, dùng lại kết quả, không gửi lead mới) |
| S-03 trên staging | Rò content bài trả phí | Staging anon `lessons` 0 dòng / 0 content (0028 có hiệu lực) |

---

## 9. Kiểm thử lại (regression) — không áp dụng sửa code nên không có vòng retest

Phiên QA này **không sửa code** nên không có mục "kiểm thử lại sau sửa". Các lỗi ở §8 cần sửa ở đợt sau rồi chạy lại đúng bằng chứng đã ghi trong cột "Bằng chứng / Tái hiện" (probe anon, curl live, render headless, test suites).

---

## 10. Việc còn mở sau QA (chuyển sang FINAL_AUDIT + ROADMAP)

1. Áp 0025–0031 lên prod (ưu tiên 0028/S-03) sau khi user nghiệm thu staging — probe anon lại.
2. Nối route Newsletter/Unsubscribe/Resend-webhook vào Worker + test live (QA-18-FUNC-01).
3. Test POST webhook SePay thật + 1 đơn thật end-to-end + đối soát bù (cần user đổi URL webhook trong SePay + chuyển khoản thật).
4. Email domain riêng + gửi thử 1 email thật cho học viên.
5. Tạo tài khoản test dùng chung + chạy E2E live toàn luồng bằng browser-task (đăng ký → đăng nhập → mua → học → hoàn thành → chứng nhận → hỗ trợ).
6. Đo LCP/Lighthouse trên máy thật (mobile + desktop).
7. Sửa S-05/S-06/S-07 + các mục Thấp S-08/S-12/S-13/S-16/S-17; nâng CSP lên nonce-based.
8. Chốt 2 điểm còn tên cũ (QA-18-UI-01) + quyết định fallback offline của Thư viện (QA-18-UI-02) + quyết định giữ/siết policy `ai_knowledge_chunks` công khai (QA-18-SEC-02).
9. Tạo remote GitHub private + push + CI + backup tự động + restore thử lần đầu.

---

*Báo cáo này không chứa secret/key/token nào. Mọi con số đều từ lệnh đã chạy trong phiên này hoặc được đối chiếu rõ nguồn (Prompt 16 / GĐ2 P0 / các báo cáo trước). Chỗ nào chưa đo/chưa kiểm chứng đều ghi rõ.*

---

## 11. Kiểm thử lại sau sửa — đợt P0 11/11/2026 ~15:50–16:05 +07 (user: "Làm hết cho tôi")

Đợt này sửa code + áp prod theo đúng 6 mục P0. Chỉ ghi PASS cho thứ đã chạy thật và đạt.

### 11.1. Kết quả theo từng lỗi P0

| Mã | Nội dung | Kết quả sau đợt P0 |
|---|---|---|
| QA-18-SEC-01 (S-03) | Rò content bài trả phí trên prod (0028 chưa áp) | ✅ **ĐÓNG** — 0028 áp prod HTTP 201; probe anon prod `lessons` = **0 dòng**; view `lessons_preview_video` 200, 0 dòng |
| QA-18-INT-01 | Migrations 0025–0031 chưa áp prod | ✅ **ĐÓNG** — cả 7 file HTTP 201 theo thứ tự (script `scripts/apply-migrations-0025-0031-prod.py`); kiểm chứng `scripts/verify-prod-p0.py`: **ALL P0 PROBES PASS** (lessons 0 dòng; thư viện 119/119; AI chunks 138/138; community/gamification anon 401; 11D anon 200, 0 dòng) |
| QA-18-FUNC-01 | Form Newsletter footer POST → 404 live | ✅ **ĐÓNG** — nối route `POST /api/v1/newsletter` + `GET/POST /api/v1/newsletter/unsubscribe` + `POST /api/webhooks/resend` vào Worker `api`, deploy Version `55ea104e-…`; test live: đăng ký mới **201**, trùng email **200** (`duplicate:true`), email sai **400**, token hủy sai **400** `invalid_token`, webhook Resend không chữ ký **401**. Worker test **354/354 PASS** (14 file), web test **702/702 PASS**, check-migrations PASS |
| QA-18-PAY-01 | SePay chưa chạy thật | ❌ **VẪN MỞ** — chỉ làm được phần không cần secret: webhook không chữ ký → **401** đúng; đối chiếu tài liệu chính thức SePay (developer.sepay.vn): thuật toán HMAC-SHA256 + header `X-SePay-Signature: sha256={hex}` + `X-SePay-Timestamp` + chuỗi ký `{timestamp}.{raw_body}` + chống replay 5 phút **khớp đúng code** (`workers/api/src/sepay.ts`) — giả định trước đây đã được xác minh bằng nguồn chính thức. **Chưa làm được:** test webhook chữ ký đúng → 200 (cần `SEPAY_WEBHOOK_SECRET`, không có trong phiên này); tạo đơn test thật (cần JWT của tài khoản đã xác nhận email — tài khoản test `visfaracademy+paytest2@gmail.com` đã tạo nhưng **chưa xác nhận**, email xác nhận không tới Gmail sau 2 lần gửi; xem §11.2); đối soát DH-2026-000004 (cần service_role key) |
| QA-18-MAIL-01 | Email thật cho học viên chưa gửi được | ⚠️ **MỞ MỘT PHẦN** — route email đã nối + test live (xem FUNC-01); 2 secret mới `UNSUBSCRIBE_SECRET` + `RESEND_WEBHOOK_SECRET` đã set trên Worker (tự sinh, không ghi giá trị). **Vẫn chặn:** email tới học viên thật cần domain riêng + verify DNS (quyết định "Dùng tạm" — không mua domain trong đợt này); checklist mua domain + DNS đã viết tại `docs/email/DOMAIN_CHECKLIST.md`; trạng thái 4 template Auth: đã viết đủ trong repo, **chưa rõ user đã paste lên Dashboard staging/prod chưa** |
| QA-18-E2E-01 | Chưa có E2E live toàn luồng | ❌ **VẪN MỞ** — 1 tài khoản test student đã tạo trên prod nhưng chưa xác nhận email (xem §11.2); tài khoản instructor/admin test **chưa tạo** (cần service_role key hoặc Dashboard); E2E bằng trình duyệt thật **không chạy được trong phiên này** (generic subagent không có browser-task; VM Chromium không TLS ra ngoài). Live route sau migration: `/`, `/thu-vien-master`, `/ai-mentor`, `/cong-dong`, `/danh-gia-11d`, `/blog`, `/chuong-trinh` = 200; `/hoc-vien/thanh-tich`, `/admin/thu-vien` = 307 đúng; AI Mentor ask guest → 401 (không còn 502) |
| QA-18-OPS-01 | Chưa có remote/CI/backup/restore | ⚠️ **MỞ MỘT PHẦN** — file đã sẵn: `.github/workflows/deploy.yml` (đã sửa, đủ 2 jobs), `ci.yml` (có sẵn), `backup.yml` + `keep-warm.yml` (mới, YAML parse OK), `docs/release/GITHUB_SETUP.md` (hướng dẫn tạo repo private + cấp quyền App + secrets + branch protection). **Chưa làm được:** push thử (không có công cụ GitHub trong phiên subagent này; lần thử trước 403 do App `meta-muse-ai` chưa có quyền ghi — cần user kiểm tra installation); backup đầu tiên + restore thử (chưa có backup thật — VM chặn port 5432, chỉ chạy được trên GitHub Actions sau khi có repo) |

### 11.2. Tài khoản test + dữ liệu test trong đợt này

- Tài khoản student test trên prod: `visfaracademy+paytest2@gmail.com`, user ID `e3d90578-f78a-4c11-b4d8-de3e801a4052` — **đã tạo, chưa xác nhận email**; đăng nhập trả `400 email_not_confirmed`; đã gửi lại email xác nhận 1 lần (200) nhưng Gmail không nhận được email nào sau ~5 phút (nghi hết hạn mức gửi email Supabase). Mật khẩu ghi trong file nội bộ `~/workspace/visfar-test-accounts.md` (**ngoài repo, không commit/push**).
- Dòng test trong prod: `newsletter_subscribers` 1 dòng `p0-newsletter-test@visfar-academy.test` (kiểm chứng route mới) — dọn khi xong đợt.
- Đơn DH-2026-000004: **chưa đối soát lại** trong đợt này (cần service_role key).

### 11.3. Verdict sau đợt P0

**❌ VẪN CHƯA NGHIỆM THU MỞ BÁN THẬT.** Đã đóng 3/5 chặn P0 (S-03 prod, migrations prod, newsletter). Còn mở: **SePay E2E thật** (webhook chữ ký đúng + 1 đơn thật + đối soát) và **email thật cho học viên** (cần user mua domain). E2E toàn luồng vẫn chưa kiểm chứng. Hệ thống đủ điều kiện dùng nội bộ/demo/nghiệm thu staging + dùng thử các module mới trên prod (Thư viện 119 mục, AI Mentor, Cộng đồng, Gamification, 11D) với tài khoản đã xác nhận.
