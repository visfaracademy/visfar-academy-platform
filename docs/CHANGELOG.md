# CHANGELOG — Visfar Academy Platform

## 2026-11-11 — Đợt P0 "Làm hết cho tôi" (6 mục còn mở sau QA Prompt 18 + kiểm toán cuối)

### Mục 1 — Áp 0025–0031 lên PROD: XONG
- Mỗi file HTTP 201 qua Management API (`scripts/apply-migrations-0025-0031-prod.py` mới): 0025 thư viện 119 mục, 0026 title khóa 08 "Master Tâm thức", 0027 11D, 0028 S-03, 0029 AI 138 chunk, 0030 Cộng đồng, 0031 Gamification. Probe anon prod **ALL PASS** (`scripts/verify-prod-p0.py` mới): `lessons` 0 dòng — **S-03 ĐÓNG trên prod**; thư viện 119/119; AI chunks 138/138; community/gamification anon 401. Ghi bảng §3.2 `docs/supabase/MIGRATION_GUIDE.md`.

### Mục 2 — Nối route Newsletter/Unsubscribe/Resend-webhook: XONG (QA-18-FUNC-01 ĐÓNG)
- Worker `api` deploy Version `55ea104e-…`; test live: đăng ký mới 201, trùng 200, email sai 400, token hủy sai 400, webhook Resend không chữ ký 401. 2 secret mới tự sinh đã set (`UNSUBSCRIBE_SECRET`, `RESEND_WEBHOOK_SECRET`). Workers test **354/354 PASS** (14 file), web **702/702 PASS**, check-migrations PASS.

### Mục 3 — SePay E2E thật: CHƯA XONG (chờ user + secret)
- Đối chiếu tài liệu chính thức SePay: HMAC-SHA256 + header + chuỗi ký `{timestamp}.{raw_body}` + chống replay 5 phút **khớp đúng code**. Webhook không chữ ký → 401. Chưa làm được: test chữ ký đúng → 200 (cần `SEPAY_WEBHOOK_SECRET`); đơn test thật (cần JWT tài khoản đã xác nhận); đối soát DH-2026-000004 (cần service_role key).

### Mục 4 — Email domain riêng: CHƯA XONG (chờ user mua domain, đúng "Dùng tạm")
- Đã viết `docs/email/DOMAIN_CHECKLIST.md`; 4 template Auth đủ trong repo, chưa rõ user đã paste lên Dashboard chưa. Không gửi email thử trong đợt này.

### Mục 5 — Tài khoản test + E2E live: CHƯA XONG
- 1 tài khoản student test tạo trên prod (`visfaracademy+paytest2@gmail.com`, ID `e3d90578-…`) nhưng **chưa xác nhận email** (email xác nhận không tới Gmail sau 2 lần gửi); instructor/admin test chưa tạo. E2E trình duyệt thật chưa chạy được. Mật khẩu ghi trong file nội bộ `~/workspace/visfar-test-accounts.md` (ngoài repo).

### Mục 6 — GitHub + backup: CHƯA XONG (chờ user)
- File sẵn: `deploy.yml` (đủ 2 jobs), `ci.yml`, `backup.yml` + `keep-warm.yml` mới (YAML parse OK), `docs/release/GITHUB_SETUP.md`. Chưa push thử (403 App `meta-muse-ai` lần trước); backup + restore thử chưa có.
- **Verdict sau đợt P0: vẫn CHƯA NGHIỆM THU MỞ BÁN THẬT** (SePay E2E + email học viên thật còn mở). Chi tiết: `docs/release/QA_REPORT.md` §11, `docs/DECISIONS.md` QĐ 25.

## 2026-11-11 — GĐ2 cuối (Prompt 18 QA toàn hệ thống + Prompt 20 Kiểm toán cuối)

### Prompt 18 — QA toàn hệ thống (không sửa code)
- **Test/build chạy lại trong phiên này:** web **702/702 PASS** (40 file), Workers **345/345 PASS** (13 file), typecheck cả hai PASS, ESLint web PASS, `check-migrations` **319/319 PASS** (31 migration 0001–0031), `pages:build` PASS (23,02s, 57 prerendered routes). Không còn test đỏ.
- **Live (HTTP-level):** 16 route công khai 200, 4 route cần đăng nhập 307 đúng; sitemap 27 URL; Worker health 200; CSP/HSTS/X-Frame-Options/Permissions-Policy đủ header thật; Pages deploy mới nhất `9fd24d55` success đúng commit HEAD; Worker version #14; Supabase prod + staging ACTIVE_HEALTHY; Worker đúng 5 secret cũ.
- **UI render thật headless Chromium local (13 trang × 4 viewport = 52 lượt):** 52/52 status 200, **0 tràn ngang**, 0 pageerror; đã xem bằng mắt trang chủ, 11D, AI Mentor, Cộng đồng, đăng nhập, tư vấn — không lỗi hiển thị. Lỗi duy nhất là `ERR_SSL_PROTOCOL_ERROR` của Chromium trong VM (giới hạn VM đã biết) khiến trang tải client-side kẹt ở "Đang tải…"; LCP đợt này chưa đo lại, đối chiếu số Prompt 16 (trang chủ LCP 448–720ms, CLS 0).
- **Probe anon lại:** prod 0025–0031 **chưa áp**; prod `lessons` anon vẫn đọc được 5 dòng bài trả phí nhưng `content` dài 0 ký tự (S-03 còn mở về policy, chưa rò nội dung thật). Staging: `lessons` anon 0 dòng (0028 có hiệu lực), `master_library_items` 119/119, `ai_knowledge_chunks` 138/138, community/gamification anon 401.
- **Lỗi mới:** QA-18-FUNC-01 (Trung bình) — form Newsletter footer POST `/api/v1/newsletter` → **404 live** (Worker router chưa nối route); QA-18-UI-01 (Thấp) — tên cũ "Thấu Hiểu Bản Thân" còn 1 chỗ + văn bản trụ cột cũ; QA-18-UI-02 (Thấp) — Thư viện lỗi mạng hiện lỗi thay vì dùng dữ liệu tĩnh 119 mục đã bundle; QA-18-SEC-02 (Thấp, ghi nhận) — `ai_knowledge_chunks` anon đọc được `content` theo thiết kế (chỉ nội dung công khai).
- **User journey:** chỉ bước Guest + 1 phần guard bài trả phí (staging) có bằng chứng thật; 8/11 bước còn lại "chưa kiểm chứng" (không có tài khoản test).
- **Verdict: CHƯA NGHIỆM THU MỞ BÁN** (3 chặn P0 chưa đóng + 0025–0031 chưa lên prod + newsletter 404). Chi tiết: `docs/release/QA_REPORT.md`.

### Prompt 20 — Kiểm toán cuối
- **Điểm trung bình 20 tiêu chí: 6,3/10** (cao nhất Brand/Visual/IA 8; thấp nhất Payment/Automation/Analytics 4; không tiêu chí nào 10/10). Top 10 vấn đề nghiêm trọng nhất, 10 cơ hội cải tiến lớn nhất, 10 tính năng ROI cao nhất, điểm nghẽn công nghệ/kinh doanh, kế hoạch 90 ngày (giữ khung ROADMAP, bổ sung: nối route newsletter, tạo tài khoản test, chốt 3 quyết định văn bản, skeleton/retry + kiểm tra a11y, kịch bản instructor thật). Chi tiết: `docs/release/FINAL_AUDIT.md`.
- Cập nhật `docs/PROJECT_AUDIT.md` (bổ sung GĐ2 cuối + Top 10) và `docs/DECISIONS.md` (QĐ 24: verdict QA + kiểm toán cuối, commit chỉ local không push).

### Commit cuối đợt GĐ2
- Commit toàn bộ thay đổi GĐ2 còn chưa commit (chỉ local, **không push** — GitHub push đang bị chặn ở quyền App). Xem `git log` sau commit này.

## 2026-11-11 — GĐ2 (Prompt 03 Design System + Prompt 15 SEO/CRO + Prompt 16 Hiệu năng)

### Design system (Prompt 03 — chỉ bổ sung, không redesign)
- Tài liệu mới **`docs/DESIGN_SYSTEM.md`**: bảng màu thật (`:root` — đen than
  + vàng gold + ivory champagne), typography Be Vietnam Pro tự host (phân cấp
  Display/H1/H2/H3/Body/Caption/Label/Button + cỡ thật desktop/mobile, gồm
  ngoại lệ đã chốt 13,65px tuyên ngôn ở 390px), layout (khung 1380px, grid,
  breakpoint), button/card/form system, modal/dropdown/tabs/accordion/
  breadcrumb/pagination/toast/alert/tooltip/skeleton/empty/error — **chỉ ghi
  cái có thật trong code** (modal, toast, tooltip, skeleton, pagination ghi
  rõ "chưa có"), motion (220ms hover, reveal 480ms, reduced-motion).
- Dọn CSS chết trong `apps/web/src/styles/globals.css` (đối chiếu grep toàn
  `src` trước khi xóa): rule `.hero` đầu bị ghi đè, `max-width: 640px` của
  `.consult-form`, toàn bộ 3 rule `.account-greeting` (không còn dùng ở đâu),
  khai báo `.main-nav a` trùng. Giữ nguyên các cascade có chủ đích
  (`.resource-list` 2 ngữ cảnh, `.notice` border-left ở post-auth.css).
  Không đổi màu, không đổi nhận diện, không redesign trang nào.

### SEO/CRO (Prompt 15)
- Metadata (title/description/canonical/OG/Twitter) cho mọi trang công khai
  qua 12 `layout.tsx` mới (trang client không export metadata được từ page)
  + mở rộng `/tu-van`, `/chinh-sach/[slug]`, `generateMetadata` cho
  `/blog/[slug]` (OG article); helper + test mới `src/lib/seo.ts`
  (`seo.test.ts` 5 test). Sitemap 25 → **27 URL** (thêm `/danh-gia-11d`,
  `/chung-chi/tra-cuu` công khai 200; không thêm `/cong-dong`, `/ai-mentor`
  vì cần đăng nhập).
- JSON-LD: Organization (có sẵn) + ItemList 10 Course trong HTML tĩnh
  (`/chuong-trinh`, layout server — đã kiểm chứng `grep ItemList` có mặt;
  trước đó script trong page client không vào HTML tĩnh do Suspense) +
  Course riêng trang chi tiết (render khi khóa tải xong, chỉ sau JS) +
  FAQPage 9 câu nguyên văn trang chủ + BreadcrumbList ở blog/khóa học.
  **Không đưa giá vào JSON-LD** (giá "Tùy tâm / 0đ" chưa chốt).
  Breadcrumb UI mới (`Breadcrumb.tsx` + `.breadcrumb`) ở trang chi tiết
  khóa học/blog/chính sách.
- Alt: rà soát toàn bộ 15 vị trí ảnh — **0 thiếu alt** (poster `alt=""` có
  chủ đích vì tiêu đề đã ở overlay). Mỗi trang công khai đúng 1 h1.
- CRO (chi tiết trong `docs/frontend/SEO_CRO_PERFORMANCE_REPORT.md`):
  hero CTA chính "Khám phá triết lý Visfar" chỉ cuộn nội trang (không dẫn
  tới đăng ký); giá "Miễn phí / Tùy tâm" rõ; 8 testimonial tĩnh; FAQ 9 câu;
  checkout chuyển khoản QR + SePay webhook chưa chạy thật nên **tỷ lệ
  chuyển đổi chưa có dữ liệu** — không bịa số.
- GA4 + Meta Pixel: code tích hợp đã viết (`src/lib/analytics.ts`,
  `src/components/analytics/Analytics.tsx`, CSP mở domain, env mẫu) nhưng
  **CHƯA kích hoạt — chưa có ID thật nào**, component trả `null`, không tải
  script tracking nào (đã kiểm chứng bằng test + HTML local).

### Hiệu năng (Prompt 16)
- Đo thật bằng headless Chromium (localhost, không throttle): trang chủ
  **LCP 448–720ms, CLS 0, INP-proxy 24ms — ĐẠT cả 3 mục tiêu ở 390px +
  1440px**; `/chuong-trinh` LCP 780–896ms, INP-proxy 24ms (đạt), CLS
  0,56/0,17 **là sai số đo của VM** (Supabase rớt `ERR_SSL_PROTOCOL_ERROR`
  từ trình duyệt VM, trang kẹt ở trạng thái tải — giá trị giống hệt trước
  và sau thay đổi; CLS thật khi có dữ liệu chưa đo được, cần browser-task
  trên live). TTFB 9–20ms, First Load JS shared 100 kB, ảnh dưới fold đã
  lazy, font tự host, code splitting sẵn có — không cần tối ưu thêm đợt này.
  Số thô: `docs/frontend/perf-baseline-before.json`,
  `docs/frontend/perf-after-changes.json`.
- Test: web **702/702 PASS** (+8 mới), typecheck PASS, `pages:build` PASS.
- Deploy: Pages `https://9fd24d55.visfaracademy.pages.dev` (production
  `https://visfaracademy.pages.dev`); live đã kiểm chứng: sitemap 27 URL,
  robots đúng, trang chủ FAQPage + canonical + OG đủ và không có script
  tracking, `/chuong-trinh` có ItemList trong HTML tĩnh, blog có canonical +
  OG article + BreadcrumbList, `/danh-gia-11d` và `/chung-chi/tra-cuu` 200.
  Chi tiết: `docs/frontend/SEO_CRO_PERFORMANCE_REPORT.md` §C.

## 2026-11-11 — GĐ2 (Prompt 19: Tài liệu còn thiếu)

- Viết mới 10 tài liệu (chỉ viết tài liệu, không sửa code, không deploy):
  `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`,
  `docs/DATABASE_SCHEMA.md` (từ migrations 0001–0031; bản thiết kế Task 03 giữ
  nguyên ở `docs/database/DATABASE_SCHEMA.md`),
  `docs/API_DOCUMENTATION.md` (từ code Worker + Next.js thật),
  `docs/SECURITY_GUIDE.md` (tổng hợp SECURITY_REPORT S-01→S-18 + các vá GĐ2),
  `docs/DEPLOYMENT_GUIDE.md` (trạng thái deploy thật 11/11/2026; bản snapshot
  10/11 giữ ở `docs/release/DEPLOYMENT_GUIDE.md`),
  `docs/BACKUP_RECOVERY.md` (backup chưa từng kiểm chứng chạy thật — ghi rõ),
  `docs/ADMIN_GUIDE.md`, `docs/STUDENT_GUIDE.md`, `docs/ROADMAP.md`
  (kế hoạch 90 ngày).
- `CHANGELOG.md` đã đủ mục GĐ2 (11D, AI Mentor, Cộng đồng, Gamification, P0)
  — đợt này chỉ bổ sung mục Prompt 19 này, không viết lại các mục cũ.
- DESIGN_SYSTEM.md: **không viết trùng** — không tìm thấy file design system
  nào trong repo tại thời điểm viết (11/11/2026); nếu agent song song đã viết,
  lấy file đó làm chuẩn; tokens hiện tại nằm trong
  `apps/web/src/styles/globals.css`.
- Phát hiện khi đối chiếu (ghi lại, không sửa code): `git remote -v` trống —
  chưa có remote GitHub nào, code GĐ2 mới commit local; Worker `index.ts`
  chỉ export `fetch` (không thấy handler `scheduled` — cron automation
  chưa nối); route `POST /api/webhooks/resend` và `POST /api/newsletter`
  chưa có trong code (thiết kế Task 02 có, router thật không có).

## 2026-11-11 — GĐ2 (Prompt 12 AI Mentor)

### AI Mentor & AI Learning Assistant — CHẾ ĐỘ TÌM KIẾM THÔNG MINH (không LLM)
- **Không có key AI nào được cấp** (`wrangler secret list` Worker `api`: chỉ
  5 secret cũ, không có `OPENAI_API_KEY` / `GEMINI_API_KEY`). Route
  `POST /api/v1/ai-mentor/ask` chỉ tìm kiếm trong kho tri thức đã phê duyệt
  và trả về đoạn tri thức + trích dẫn nguồn + câu hỏi gợi ý; **không gọi
  LLM, không bịa câu trả lời**. Nhánh LLM (OpenAI `gpt-4o-mini`, system
  prompt "chỉ trả lời dựa trên đoạn tri thức được cung cấp") đã viết sẵn,
  chỉ chạy khi có `OPENAI_API_KEY`; LLM lỗi thì tự rơi về tìm kiếm thông
  minh. Ghi rõ chế độ trong UI trang `/ai-mentor`.
- Migration mới **`0029_ai_mentor.sql`** (đã áp **STAGING, HTTP 201**,
  CHƯA áp prod): bảng `ai_knowledge_chunks` + `ai_chat_sessions` +
  `ai_chat_messages` (RLS chỉ chủ sở hữu) + hàm `search_ai_knowledge`
  (Postgres full-text config `simple` + khớp nguyên từ không dấu, **không
  phải vector embedding** — không dùng embedding/pgvector) + seed
  idempotent **138 chunk = 119 Thư viện Master + 10 khóa học + 9 triết lý
  trang chủ**. Không index nội dung bài trả phí (`lessons`).
  Hiệu chuẩn trên staging: "An vui là gì?" → An Vui (148.9); câu chứng
  khoán lãi 100% → bị lọc hết, trả "chưa tìm thấy"; câu về khóa →
  "Thấu Hiểu Tâm Thức" đứng đầu (124.4).
- Worker `api` (deploy Version `76bb202c`): `POST /api/v1/ai-mentor/ask`
  (JWT + rate-limit 20 câu/giờ/user + kiểm tra enrollment cho chunk
  course: chưa ghi danh thì chỉ dùng mô tả công khai + ghi chú),
  `GET /api/v1/ai-mentor/sessions[/:id]`,
  `PATCH /api/v1/ai-mentor/messages/:id/feedback`.
  Live: health 200; ask/sessions không JWT → 401 đúng.
- Trang **`/ai-mentor`**: chat + lịch sử phiên + 6 câu hỏi gợi ý + trích
  dẫn nguồn nội bộ + nút phản hồi hữu ích/không hữu ích + disclaimer
  "AI hỗ trợ học tập, không thay thế bác sĩ / chuyên gia tâm lý / luật
  sư / cố vấn tài chính". Link từ menu tài khoản, DashboardNav, Tổng quan
  `/hoc-vien`. Live `https://visfaracademy.pages.dev/ai-mentor` 200
  (render đủ; đã xem bằng mắt ở 390px + 1440px trên đúng bản deploy).
- Test: web **694/694**, Workers **345/345** (+17 AI Mentor), typecheck
  PASS cả hai, `pages:build` PASS, `check-migrations` PASS.
- **Mở:** áp 0029 lên prod sau khi nghiệm thu staging (route ask trên
  live hiện 502 `upstream_error` vì prod chưa có bảng); hỏi thử 3 câu
  end-to-end bằng tài khoản thật sau khi 0029 lên prod; adapter Gemini
  chưa có; nhánh LLM chưa chạy thật (chưa có key).
- Lưu ý vận hành: 2 agent song song (Prompt 13/14) cùng build chung
  `.next` — deploy Pages lần 1-2 lỗi ENOENT do output bị build khác xóa
  giữa chừng; đã copy output sang thư mục riêng rồi deploy từ đó
  (`https://c28e85b9.visfaracademy.pages.dev`).

## 2026-11-11 — GĐ2 (Prompt 13 Cộng đồng + Prompt 14 Gamification)

### Cộng đồng VISFAR (Prompt 13)
- Migration mới **`0030_community.sql`**: 4 bảng `community_posts` /
  `community_comments` / `community_reactions` / `community_reports` + RLS
  (chỉ học viên đã đăng nhập đọc/ghi; tác giả sửa/xóa bài của mình;
  instructor/admin kiểm duyệt; bài bị ẩn chỉ tác giả + kiểm duyệt thấy;
  anon bị thu hồi toàn bộ quyền). Tên hiển thị lưu sẵn `author_name` lúc
  đăng nên không lộ PII người khác qua join `profiles`.
- Trang **`/cong-dong`**: lọc theo khóa học + tất cả, đăng bài, thả cảm xúc
  (toggle), phân trang lo 20 bài + nút "Xem thêm" (không feed vô hạn,
  không video tự phát); trang **`/cong-dong/[id]`**: bình luận, sửa/xóa bài
  của mình, báo cáo nội dung; trang **`/admin/cong-dong`**: kiểm duyệt
  (ẩn/hiện/ghim/xóa, xử lý báo cáo).
- **Đã áp STAGING (HTTP 201), CHƯA áp prod.** Kiểm chứng staging: đủ 4 bảng,
  RLS bật, 13 policy; probe anon REST cả 4 bảng 401 `42501`.
- Lưu ý đổi số: file lúc đầu đặt 0029, trùng `0029_ai_mentor.sql` của agent
  song song (Prompt 12) nên đổi thành 0030 (nội dung đã áp staging không
  đổi, chỉ đổi số file).

### Gamification (Prompt 14)
- Migration mới **`0031_gamification.sql`**: 4 bảng `learning_points` /
  `badges` / `user_badges` / `learning_streaks` + cột
  `profiles.gamification_enabled` (mặc định true). Seed đủ 4 huy hiệu:
  Khởi đầu, Kiên trì 7 ngày, Hoàn thành khóa đầu tiên, Người chia sẻ.
- Quy tắc điểm: bài học +10, quiz đạt +20, khóa học +100, bài cộng đồng
  được đánh dấu hữu ích +5 (tối đa 1 lần/ngày), streak +5/ngày. Điểm do
  **trigger server-side** cộng theo tiến độ thật (client không có policy
  ghi điểm/huy hiệu/streak; mỗi mốc thưởng 1 lần; tự thả `helpful` cho bài
  của mình không được điểm). RPC `refresh_my_gamification()` tính lại
  streak + huy hiệu của chính mình.
- Trang **`/hoc-vien/thanh-tich`**: tổng điểm, streak, huy hiệu, lịch sử
  điểm, quy tắc điểm, nút bật/tắt gamification; Tổng quan `/hoc-vien` hiện
  điểm/streak/huy hiệu + mục Cộng đồng; toggle tắt gamification ở Hồ sơ
  (`/hoc-vien/ho-so`) và trang Thành tích (điểm cũ giữ nguyên).
- **Đã áp STAGING (HTTP 201), CHƯA áp prod.** Kiểm chứng staging: đủ 4 bảng,
  RLS bật, 4 policy đọc + 0 policy ghi cho client, đủ 4 hàm + 7 trigger,
  probe anon REST 401 `42501`. Hai lỗi lúc áp đã sửa trong file (unique
  index theo ngày `42P17` → `related_id` theo ngày; `WHEN` trigger không
  được tham chiếu `TG_OP`/`OLD` ở INSERT → chuyển điều kiện vào thân hàm).
- Tương thích prod chưa áp 0031: `getMyProfileState` fallback retry không có
  cột `gamification_enabled` nên dashboard không vỡ; trang Thành tích mặc
  định bật khi chưa đọc được cột.
- Test: web **694/694 PASS** (+24 test mới trong đợt này; 10 test còn lại
  của agent song song Prompt 12), typecheck + lint PASS,
  `check-migrations` PASS (31 migration 0001–0031), `next build` PASS (đủ
  4 route mới). Deploy Pages `https://e951f862.visfaracademy.pages.dev`
  (production `https://visfaracademy.pages.dev`); live `/cong-dong` 200
  đủ nội dung, `/hoc-vien/thanh-tich` + `/admin/cong-dong` 307 về đăng
  nhập khi chưa đăng nhập. Chi tiết: `docs/frontend/TASK13_14_REPORT.md`.

## 2026-11-11 — GĐ2 (P0: vá S-03, C-05-02, SEO, CSP/HSTS, check-migrations)

### Bảo mật — S-03 (CAO, blocker phát hành)
- Migration mới **`0028_fix_s03_lessons_rls.sql`** (số 0027 đã thuộc về
  đánh giá 11D của nhóm song song nên S-03 lấy số tiếp theo 0028):
  drop policy cũ `lessons_select_public` (0001), thay bằng
  `lessons_select_enrolled` — chỉ admin / instructor khoa phụ trách /
  học viên có enrollment `active|completed` của khóa `published` mới
  SELECT được dòng trên bảng `lessons`. Anon: 0 dòng (kể cả bài xem
  thử). Học viên chưa ghi danh: 0 dòng với bài trả phí.
- View mới **`lessons_preview_video`** (chỉ `id` + `video_url` của bài
  `is_free_preview=true` thuộc khóa `published`): đường duy nhất lấy
  video mẫu khi chưa ghi danh. Không trả `content` / `file_url` ở bất
  kỳ đâu cho bài xem thử.
- `lms-access.ts`: guard đọc metadata qua view `lessons_public`
  (giữ được lý do `not-enrolled`/`revoked`/`not-published` thay vì
  404 chung), đọc nội dung đầy đủ qua bảng `lessons` chỉ khi quyết
  định `ok`, đọc video mẫu qua view `lessons_preview_video` khi
  `ok-preview`. `learning.ts` giữ `videoUrl` mẫu khi preview, vẫn
  lọc `content`/`fileUrl`; bài khóa vẫn lọc sạch cả ba.
- Route tải tài liệu (chưa đăng nhập) đổi sang đọc view
  `lessons_public` thay vì bảng `lessons` (anon bị RLS chặn hết).
- **Đã áp STAGING (HTTP 201), CHƯA áp prod** (chờ user nghiệm thu).
  Kiểm chứng staging: anon REST `lessons` 0 dòng / 0 content (trước:
  bài trả phí 269 ký tự); `lessons_public` 2 dòng metadata;
  JWT học viên đã ghi danh đọc đủ 2 bài (`content` 121 + 269 ký tự);
  JWT chưa ghi danh 0 dòng; guard route local (staging env):
  đã ghi danh → 200 đủ `content` 269 ký tự, chưa ghi danh →
  403 `not-enrolled`, bài xem thử → 200 `previewOnly:true` chỉ có
  `video_url`. Dữ liệu test (2 user + enrollment + `video_url` tạm)
  đã xóa sạch sau kiểm chứng.
- Lưu ý: guard route khi chưa đăng nhập (không cookie) trả 503
  "Chưa cấu hình Supabase" (hành vi có sẵn từ trước, chưa sửa ở đợt
  này — trang học bài nằm sau middleware `/hoc-vien/*` nên UI không
  chạm tới); CSP dùng `'unsafe-inline'`/`'unsafe-eval'` cho Next.js
  runtime (nâng lên nonce-based CSP là follow-up).

### Chống trùng — C-05-02 (live, Worker `api`)
- Gửi 3 lần lên `POST /api/v1/leads`: lần 1 → **201**
  `duplicate:false`, mã `VISFAR-2026-708302`; lần 2 cùng key + cùng
  body → **200 `duplicate:true`**, cùng mã; lần 3 cùng key + body
  khác → **409 `idempotency_conflict`**. DB: staging 0 dòng,
  **prod 1 dòng** (Worker hiện nối PROD — xem DECISIONS QĐ 20);
  dòng test đã xóa khỏi prod, kiểm tra lại 0 dòng cả hai DB.
  `sheetSynced:false` ở lần gửi này (Sheet không nhận dòng test nên
  không cần xóa trên Sheet).

### SEO cơ bản (S-04 một phần)
- Thêm `apps/web/src/app/sitemap.ts` (25 URL công khai có thật:
  `/`, `/chuong-trinh` + 10 slug khóa, `/thu-vien-master`, `/blog` +
  3 bài, `/chinh-sach/*` 4 mục, `/tu-van`, `/goi-thanh-vien`,
  `/dang-nhap`, `/dang-ky`) và `robots.ts` (chặn `/api/`, `/admin/`,
  `/hoc-vien/`, `/auth/`, `/thanh-toan/`). Không đưa `/su-kien`
  (chỉ là neo `/#su-kien`, không có route riêng); `/hoc-vien/*` và
  `/admin/*` không đưa vào sitemap vì cần đăng nhập (trả 307 cho
  khách) — lệch QĐ 11 ở điểm này, ghi rõ để user chốt lại nếu muốn
  đổi. Live: `/sitemap.xml` 200 (đủ 25 URL), `/robots.txt` 200.

### Bảo mật header — S-04
- `apps/web/next.config.ts`: thêm `Content-Security-Policy`
  (cho `youtube-nocookie`/YouTube, `*.supabase.co`,
  `api.visfaracademy.workers.dev`, font self-hosted; Zalo chỉ là
  link nên không cần chỉ thị), `Strict-Transport-Security`
  (`max-age=31536000; includeSubDomains`, không preload),
  `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`.
  Live đã kiểm chứng đủ header trên production.
- Deploy Pages mới: `https://f55e3294.visfaracademy.pages.dev`
  (production `https://visfaracademy.pages.dev` 200, render đủ).

### Quy trình
- `scripts/check-migrations.mjs`: bỏ danh sách cứng (đã lỗi thời ở
  24 → 27 → 28 file), đếm động: số migration phải liên tục
  `0001..NNNN`, không trùng số; thêm kiểm tra nội dung 0028.
  Chạy lại: **271/271 PASS, 0 FAIL**.
- Test: web **660/660 PASS** (gồm test guard/preview mới của đợt này
  và test 11D của nhóm song song), Workers **328/328 PASS**;
  typecheck cả hai PASS; ESLint PASS trên file đã đổi;
  `pages:build` PASS.

## 2026-11-11 — Prompt 11: Hệ thống đánh giá 11 phương diện (11D)

- Migration **0027** (`assessments_11d` + RLS + view tổng hợp không PII):
  **đã áp staging**, chưa áp prod.
- Trang công khai **`/danh-gia-11d`**: 33 câu (11 phương diện × 3), thang 1–5,
  làm bài không cần đăng nhập (lưu nháp localStorage); lưu kết quả cần đăng nhập.
- Báo cáo cá nhân: điểm từng phương diện, **biểu đồ radar SVG**, 3 mạnh nhất /
  3 cần chăm sóc thêm, mục tiêu gợi ý, lộ trình đề xuất theo 10 khóa thật.
  Disclaimer: “Công cụ tự đánh giá tham khảo, không thay thế chẩn đoán chuyên môn.”
- Trang **`/hoc-vien/danh-gia-11d`**: lịch sử các lần đánh giá + so sánh với lần trước.
- Test web 660/660 PASS; typecheck + lint PASS; `pages:build` PASS.
- Xem chi tiết: `docs/frontend/TASK11_11D_REPORT.md`.
