# Quyết định của chủ dự án — 19 quyết định sau Task 01 Audit

**Ngày:** 10/11/2026, 19:40 +07
**Nguồn:** tin nhắn phê duyệt của Lê Đăng Quyết sau báo cáo Task 01 (19 quyết định).
**Trạng thái:** Đã ghi nhận. **Cả 19 quyết định đã chốt xong ngày 10/11/2026** (quyết định 17 và ngày sự kiện chốt ở tin nhắn cuối). Chỉ còn giờ + hình thức từng sự kiện là chưa được cung cấp.

## Quyết định đã chốt (theo cách hiểu của đội ngũ)

| # | Quyết định | Nội dung đã chốt |
|---|---|---|
| 1 | Tuyên ngôn 13,65px ở 390px | **Chấp nhận hiện tại.** Giữ tuyên ngôn 1a/1b ở 13,65px trên điện thoại 390px, mỗi cụm đúng 1 dòng. Không thu hẹp đệm trang, không bỏ yêu cầu 1 dòng. |
| 2 | Nhãn Tam giác hiện thực ~3,98px ở 390px | **Chấp nhận hiện tại.** Không khôi phục legend, không tách sơ đồ, không thêm chạm-vòng-hiện-nhãn-lớn. |
| 3 | Nhánh fallback form | **Giữ nguyên.** Không đổi văn bản fallback, không bỏ nhánh fallback. |
| 4 | Chống spam | **Thêm cả hai:** (a) honeypot + rate-limit + idempotency, và (b) CAPTCHA. |
| 5 | Đường lead / Apps Script | **Chốt ngày 10/11/2026:** API làm lớp trước, rồi ghi Sheet. API nhận lead, validate / chống spam / chống trùng, sau đó ghi vào Sheet (bản sao đối soát) — Sheet không còn là đường ghi duy nhất. Được phép sửa + deploy lại file `.gs` khi cần cho luồng này. |
| 6 | Newsletter footer | **Làm thật.** Thêm form + handler thật (ghi vào Sheet/dịch vụ email), không xóa input. |
| 7 | Sự kiện 05/2026 | **Đổi thành tháng 11.** Cập nhật 3 sự kiện sang lịch tháng 11 (ngày/giờ cụ thể do user cung cấp sau, không tự bịa ngày). |
| 8 | PII trong mailto/clipboard | **Giữ.** Giữ nguyên mailto + nút sao chép chứa họ tên/SĐT/email trong hộp xác nhận dự phòng. Ghi chú rủi ro: PII vẫn lộ qua email client / lịch sử trình duyệt / clipboard — đây là quyết định của chủ dự án, đội ngũ đã cảnh báo. |
| 9 | Khung hoàn trả / khiếu nại | **Chốt ngày 10/11/2026:** hoàn trả 15 ngày làm việc; khiếu nại **3 ngày** (phản hồi). “15 ngày” áp cho xử lý hoàn trả; “3 ngày” áp cho phản hồi khiếu nại. Các bước còn lại trong khung cũ (builder viết) giữ nguyên cho tới khi user nói khác. |
| 10 | Nội dung do builder viết | **Duyệt.** User duyệt nội dung builder viết: 3 bài blog, thẻ Lĩnh vực 03, bước “Tin”, nội dung 3 khóa 04/05/06. |
| 11 | Sitemap mới | **Chốt.** Tách `/su-kien` khỏi `/blog`; chính sách thành URL thật; thêm `/hoc-vien/*`, `/dang-nhap`, `/dang-ky`, `/admin/*`. |
| 12 | Dọn nợ CSS | **Dọn ngay trên file hiện tại.** Không đóng băng hoàn toàn để chờ nền tảng mới; dọn dead code và khối chốt trên file hiện tại. |
| 13 | SEO cơ bản | **Chốt.** Bổ sung `<h1>` chính + OG / Twitter / canonical / JSON-LD (+ CSP theo tài liệu kiến trúc). |
| 14 | Định nghĩa mục tiêu $100M | **Chốt ngày 10/11/2026:** cả 3 chỉ số cùng đạt — doanh thu tích lũy, lợi nhuận giữ lại, và giá trị ròng năm 10, cả 3 cùng đạt 100 triệu đô mới tính là đạt mục tiêu. |
| 15 | Thanh toán | **Dùng SePay — gói FREE (user chốt 11/11/2026).** 0đ/tháng, 50 giao dịch tiền vào/tháng, vượt thì tính phí theo giao dịch hoặc nâng STARTUP sau. Tài khoản ngân hàng **MB Bank**, chủ tài khoản là Công ty TNHH MTV Visfar Holdings (theo ảnh chụp màn hình user gửi ngày 10/11/2026, file `Screenshot_20261110-194231.jpg`). **Không tách tài khoản riêng (user chốt 11/11/2026, sửa lại quyết định “có tách” cùng ngày)** — dùng chung tài khoản MB hiện tại để nhận học phí; lưu ý mọi khoản tiền vào tài khoản này đều tính vào hạn mức 50 GD/tháng của gói FREE, kể cả giao dịch ngoài học phí. Số tài khoản **không ghi vào tài liệu này** — chỉ dùng từ ảnh chụp / file QR do user cung cấp khi cần tạo khối thanh toán / VietQR. **Có thể sử dụng QR Code cũ.** Không tự tạo QR mới từ thông tin chưa xác nhận. Webhook SePay đã tạo 11/11/2026: URL mới (sau khi đổi tên Worker) `https://api.visfaracademy.workers.dev/api/v1/webhooks/sepay`, HMAC-SHA256, `SEPAY_WEBHOOK_SECRET` đã set lại cho Worker mới, test chữ ký PASS (200 đúng / 401 sai) — **user phải đổi URL webhook trong SePay sang URL mới, URL cũ đã chết cùng Worker cũ**. Worker API đổi tên 11/11/2026: `visfar-academy-api` → `api`, URL mới `https://api.visfaracademy.workers.dev`, Worker cũ đã xóa (URL cũ trả 404). Web Next.js deploy Cloudflare Pages 11/11/2026: `https://visfaracademy.pages.dev` (project `visfaracademy`). |
| 16 | Video YouTube unlisted | **Chấp nhận đánh đổi.** Video không công khai, không phải bảo mật thật — ai có link đều xem được, không chống tải. |
| 17 | Ngưỡng hoàn thành / slug | **Chốt ngày 10/11/2026:** theo **module** — `lessons.slug` UNIQUE theo module (không theo khóa). Ngưỡng hoàn thành bài giữ đề xuất 90% (video) / bấm “Đã hoàn thành” (bài text), tính theo module, cho tới khi user nói khác. |
| 18 | Nâng cấp trả phí | **Chốt ngày 10/11/2026:** nâng cấp trả phí khi chạm tới giới hạn miễn phí — áp cho cả Supabase, Workers và Resend (không chỉ Supabase). Giá tra cứu 10/11/2026 (Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng), cần xác minh lại trước khi nâng. |
| 19 | Hướng nền tảng / framework | **Chốt Next.js.** Không còn mâu thuẫn Next.js/Astro hay WordPress + LMS — nền tảng mới dùng Next.js. |
| 20 | 3 trụ cột khóa học (11/11/2026) | **Thân – Tâm – Tuệ** (thay bộ cũ Tâm thức – Trí tuệ – Nhân hiệu ở nhãn trụ cột/phân loại khóa học). Ánh xạ: 01 Tâm, 02 Tâm (trụ cột 2), 03 Tuệ (trụ cột 3), 04 Thân (trụ cột 1), 05 Tâm (trụ cột 2), 06 Thân (trụ cột 1 — lựa chọn của agent, user chốt sau), 07/08/09 tích hợp cả 3, 10 Cộng đồng. Tên khóa 01–10 giữ nguyên. Migration 0024 đã viết, **chưa áp** (chờ `SUPABASE_ACCESS_TOKEN`); code có lớp tương thích tạm `normalizePillar()` để live không vỡ trong lúc chờ, xóa sau khi 0024 áp xong. Văn bản chính sách (policies.ts) vẫn giữ câu cũ, chờ user chốt riêng. |

## Những việc user hứa gửi sau / đã gửi ngày 10/11/2026

- Thông tin tài khoản ngân hàng MB Bank — **đã gửi** qua ảnh chụp màn hình QR VietQR MB Bank ngày 10/11/2026 (file `Screenshot_20261110-194231.jpg`). Số tài khoản không ghi vào tài liệu.
- Ngày/giờ cụ thể cho 3 sự kiện tháng 11 — user chốt ngày **25/11/2026, theo module, cho cả 3 sự kiện**. Giờ + hình thức (Zoom) của từng sự kiện chưa được cung cấp — không tự bịa, chờ user gửi sau.
- QR Code cũ đã có thể dùng — không cần gửi lại nếu vẫn là file đã tải lên trước đây.

## Phê duyệt Task 02 — kiến trúc hệ thống (10/11/2026, 20:08 +07)

User phê duyệt toàn bộ kiến trúc Task 02 (7 file) và 16 quyết định gộp:

| # | Quyết định Task 02 | Nội dung đã chốt |
|---|---|---|
| 1 | Phê duyệt toàn bộ kiến trúc | **Chốt.** Đủ điều kiện để bắt đầu lập trình theo kiến trúc Task 02. |
| 2 | Mâu thuẫn QĐ 3 vs API mới | **Dùng quy tắc API mới.** API mới không hiện cảm ơn khi chưa nhận `ok:true`; không kế thừa nhánh fallback “thành công giả” của trang HTML hiện tại. |
| 3 | Bảng `course_instructors` | **Tạo bằng migration mới sau khi duyệt.** Không gán giảng viên bằng cách khác. |
| 4 | Bảng `notifications` | **Có tạo.** Thông báo in-app được hỗ trợ, không chỉ dùng email. |
| 5 | Bài tập tự luận | **Có hỗ trợ.** Cần thêm chỗ lưu bài tập tự luận + chấm tay vào schema (migration mới). |
| 6 | Quyền xem của Instructor | **Có được xem.** Instructor được xem đáp án đúng quiz, SĐT/email học viên, và quản lý blog/sự kiện (theo ma trận quyền đã duyệt). |
| 7 | Admin tặng khóa | **Có được tặng khóa.** Admin tạo enrollment không qua đơn đã trả, phải ghi `audit_logs`. |
| 8 | Domain API | **Domain API: `visfaracademy.netlify.app`, tiền tố `/api/v1` có dùng.** Ghi chú: domain này là subdomain Netlify, khác với hosting Cloudflare Pages/Workers trong kiến trúc — cần kiểm tra lại cách gắn domain cho Workers API khi triển khai, không tự đổi domain. |
| 9 | SePay / Stripe | **Dùng SePay.** Stripe chưa dùng. |
| 10 | Turnstile CAPTCHA | **Có áp theo user ngoài theo IP.** Rate-limit + CAPTCHA áp cả theo IP và theo user. |
| 11 | Khung hoàn trả/khiếu nại | **Chốt như cũ.** Hoàn trả 15 ngày làm việc, khiếu nại phản hồi 3 ngày. |
| 12 | Nguồn dữ liệu lợi nhuận/giá trị ròng | **Cho phép nhập tay.** Lợi nhuận và giá trị ròng cho mục tiêu $100M được nhập tay (ai nhập, tần suất cập nhật: admin nhập, cập nhật định kỳ — ghi rõ khi làm module báo cáo). |
| 13 | Giờ sự kiện 25/11/2026 | **Giờ mặc định 18h30.** Cả 3 sự kiện ngày 25/11/2026, giờ mặc định 18:30, hình thức Zoom (theo thông tin sự kiện hiện tại). |
| 14 | Domain gửi Resend + kênh cảnh báo | **Kênh cảnh báo qua mail `visfaracademy@gmail.com`.** Domain gửi Resend cần xác minh DNS SPF/DKIM/DMARC trước khi gửi cho người dùng thật; cảnh báo hệ thống gửi về `visfaracademy@gmail.com`. **Bổ sung 11/11/2026 — user chốt "Dùng tạm":** chưa mua domain riêng lúc này (domain miễn phí `visfaracademy.pages.dev` trên Cloudflare không thêm được bản ghi DNS nên không xác minh được Resend); Resend chỉ gửi qua `onboarding@resend.dev` cho chính admin, chưa gửi được email thật cho học viên; sẽ mua domain riêng + xác minh DNS SPF/DKIM/DMARC sau. Không set `RESEND_FROM_EMAIL` lúc này. |
| 15 | Tài khoản Supabase | **Supabase tạo trên tài khoản Gmail `visfaracademy@gmail.com`.** Cả project prod + staging dùng tài khoản này. |
| 16 | Ngưỡng nâng cấp trả phí | **Linh hoạt, tự cập nhật được, ban đầu dùng hoàn toàn miễn phí.** Ngưỡng nâng cấp không cố định cứng — hệ thống theo dõi mức dùng và đề xuất nâng cấp khi chạm giới hạn; giai đoạn đầu 0 đồng. |

## Phê duyệt Task 03 — Database & Security (10/11/2026, 20:18 +07)

User phê duyệt tất cả các quyết định Task 03, với nguyên tắc: **lựa chọn sao cho hiện đại nhất, tinh tế và thuận tiện nhất**. Áp dụng như sau:

| # | Quyết định Task 03 | Lựa chọn đã chốt (hiện đại / thuận tiện nhất) |
|---|---|---|
| 1 | Tổng số bảng | **38 bảng vật lý.** Giữ đủ 31 bảng Task 03 + `course_instructors` + `question_options` + 5 bảng Module 1 (events, event_registrations, posts, policies, newsletter_subscribers). Không bỏ bảng nào. |
| 2 | `answers` vs đáp án đúng | **Đổi `answers` thành `quiz_answers`.** Đáp án đúng giữ ở bảng lựa chọn `question_options` (không gộp/đổi tên thành `answers`). Giữ cột `quiz_answers.is_correct` là kết quả chấm ở server. Hỗ trợ multiple-choice: UNIQUE `(attempt_id, question_id, option_id)`. |
| 3 | Nguồn sự thật cho role | **`user_roles` là nguồn duy nhất.** `profiles.role` giữ làm cache đọc nhanh, đồng bộ bằng trigger từ `user_roles`; RLS và API đều đọc `user_roles`. |
| 4 | Đáp án quiz lưu ở đâu | **Bảng `question_options`.** Bỏ `quiz_attempts.answers` jsonb sau khi migrate sang bảng `quiz_answers` (không giữ trùng lặp). |
| 5 | Lớp trung gian `quizzes` | **Có lớp `quizzes`.** `lessons` → `quizzes` (1–1) → `questions` (`quiz_id`). Xóa `questions.lesson_id` sau backfill. |
| 6 | Đổi tên bảng | **Phương án A.** Rename bảng cũ giữ dữ liệu (`modules → course_modules`, `quiz_questions → questions`), code chuyển sang tên mới sau khi migration chạy xong; VIEW tên cũ tạm thời chỉ dùng trong thời gian chuyển đổi. |
| 7 | Trùng lặp có chủ đích | **Dọn trùng lặp, giữ 1 nguồn sự thật:** bỏ `quiz_attempts.answers` jsonb; đơn hàng nhiều khóa qua `order_items` (bỏ `orders.course_id` sau backfill); giữ `courses.pillar` làm trụ cột + `categories` làm nhóm hiển thị; 4 bảng log giữ riêng vai trò (learning_events = học tập, activity_logs = hành vi, audit_logs = bảo mật/quản trị, automation_events = tự động hóa), lưu trữ 12 tháng, IP trong log chỉ admin xem; `lessons.file_url` chuyển hẳn sang `lesson_resources`; `quiz_attempts` chỉ giữ `quiz_id` (bỏ `lesson_id`). |
| 8 | Quyền instructor | **Theo QĐ 6 Task 02 đã phê duyệt (ghi đè ma trận cũ).** Instructor được xem đáp án đúng, SĐT/email học viên khóa phụ trách, và quản lý blog/sự kiện. |
| 9 | Xóa tài khoản có đơn hàng | **`orders.user_id` SET NULL + ẩn danh.** Không xóa tài khoản còn đơn — vô hiệu hóa thay vì xóa; dữ liệu tài chính giữ nguyên. |
| 10 | Nộp lại / chấm lại / xem log | **Học viên được nộp lại bài tập, giảng viên được chấm lại.** Học viên xem được `activity_logs` của chính mình. |
| 11 | Giá membership/khóa trả phí | **Giữ Tùy tâm/0đ cho tới khi user cung cấp giá.** Giao dịch 0đ được phép (CHECK >= 0). Duyệt 7 key `system_settings` khởi tạo (hoàn trả 15 ngày, khiếu nại 3 ngày, SePay, MB Bank — không lưu số tài khoản). |
| 12 | `course_instructors` | **Xác nhận lại: tạo bằng migration mới, chỉ admin gán.** |
| 13 | Payment/SePay | **Phê duyệt mô hình 2 lớp.** Triển khai SePay (giá/gói/thời điểm xác minh lại trước khi triển khai); Turnstile đặt ở form lead + đăng ký, khi không tải được thì cho qua với rate-limit chặt hơn và ghi log (không chặn cứng người dùng thật); rate-limit theo user 300 req/giờ/user; hiệu lực `Idempotency-Key` 24 giờ; các bước còn lại của khung hoàn trả/khiếu nại giữ như cũ; giữ YouTube unlisted giai đoạn đầu; xác minh lại giới hạn miễn phí trước khi lập trình; bỏ hộp xác nhận PII khi chuyển form cũ sang API mới (hệ thống mới không hiện PII trong mailto/clipboard). |
| 14 | Phụ thuộc 0005 → 0006 | **Chạy đúng thứ tự 0004 → 0005 → 0006.** Không chạy 0006 trước 0005. |

## Quyết định 24 — Verdict QA cuối đợt + kiểm toán cuối (11/11/2026 ~15:45 +07, Prompt 18 + 20, auto-duyệt)

- **Verdict QA (Prompt 18): CHƯA NGHIỆM THU MỞ BÁN THẬT.** Code GĐ2 đạt kiểm thử tự động (web 702/702, Workers 345/345, typecheck + lint + build PASS) nhưng 3 chặn P0 chưa đóng: (1) S-03 còn mở trên prod (0028 chưa áp), (2) SePay chưa từng chạy thật, (3) email thật cho học viên chưa gửi được; cộng thêm migrations GĐ2 0025–0031 chưa lên prod và form Newsletter footer hỏng live (404). Hệ thống đủ điều kiện dùng nội bộ/demo/nghiệm thu staging. Chi tiết: `docs/release/QA_REPORT.md`.
- **Kiểm toán cuối (Prompt 20): điểm trung bình 20 tiêu chí 6,3/10** (cao nhất Brand Identity/Visual Design/Information Architecture 8; thấp nhất Payment/Automation/Analytics 4). Không tiêu chí nào chấm 10/10. Chi tiết + Top 10 vấn đề/cơ hội/tính năng ROI + điểm nghẽn + kế hoạch 90 ngày (đối chiếu + bổ sung ROADMAP): `docs/release/FINAL_AUDIT.md`.
- **Lỗi mới duy nhất mức Trung bình — QA-18-FUNC-01:** form Newsletter footer POST `/api/v1/newsletter` → 404 live vì Worker router chưa nối route (frontend + handler đã có). **Phải nối route + test live trước khi mở bán** (đưa vào kế hoạch 90 ngày tuần 1–2).
- **Không sửa code trong phiên QA/kiểm toán cuối này** (0 file code thay đổi): các lỗi nhỏ (tên cũ 1 chỗ, fallback offline Thư viện, policy công khai `ai_knowledge_chunks`) chỉ ghi vào báo cáo để user chốt hướng sửa, không tự đổi.
- **Commit cuối đợt GĐ2: chỉ commit local, KHÔNG push** (GitHub push đang bị chặn ở quyền App — không thử push). Remote GitHub vẫn trống; việc tạo remote + push + CI + branch protection chuyển sang kế hoạch 90 ngày tuần 1–2 (cần user).

## Quyết định 25 — Đợt P0 11/11/2026 ~16:00 +07: "Làm hết cho tôi" (6 mục P0 sau Master Prompt Pack)

User phê duyệt làm hết 6 mục P0 còn mở sau QA Prompt 18 + kiểm toán cuối (bao gồm cả việc áp migration lên prod). Kết quả:

- **Mục 1 — Áp 0025–0031 lên PROD: XONG.** Mỗi file HTTP 201 qua Management API (script `scripts/apply-migrations-0025-0031-prod.py`, token chỉ qua env var): 0025 (thư viện 119 mục), 0026 (title khóa 08 = "Master Tâm thức"), 0027 (11D), 0028 (S-03), 0029 (AI 138 chunk), 0030 (Cộng đồng 4 bảng), 0031 (Gamification 4 bảng). Probe anon prod **ALL PASS** (`scripts/verify-prod-p0.py`): `lessons` 0 dòng — **S-03 ĐÓNG trên prod**; thư viện 119/119; AI chunks 138/138; community/gamification anon 401; 11D anon 200, 0 dòng. Đã ghi bảng §3.2 trong `docs/supabase/MIGRATION_GUIDE.md` (lưu ý: bảng này chưa từng có dòng 0014–0024 — khoảng trống có sẵn từ trước). **Không backup full prod trước khi áp** (VM chặn port 5432 nên không pg_dump được; migration đều cộng thêm/idempotent; dữ liệu prod lúc áp rất ít: 3 profiles, 0 enrolment/order/lead) — backup tự động chuyển sang workflow GitHub Actions sau khi có repo.
- **Mục 2 — Nối route Newsletter/Unsubscribe/Resend-webhook: XONG.** Worker `api` deploy Version `55ea104e-…`; test live: đăng ký mới 201, trùng 200, email sai 400, token hủy sai 400, webhook Resend không chữ ký 401. 2 secret mới tự sinh đã set trên Worker (`UNSUBSCRIBE_SECRET`, `RESEND_WEBHOOK_SECRET` — không ghi giá trị). Workers test 354/354 PASS, web 702/702 PASS. **QA-18-FUNC-01 ĐÓNG.**
- **Mục 3 — SePay E2E thật: CHƯA XONG (chờ user + secret).** Đã đối chiếu tài liệu chính thức SePay (developer.sepay.vn): thuật toán HMAC-SHA256 + header + chuỗi ký `{timestamp}.{raw_body}` + chống replay 5 phút **khớp đúng code** — giả định trước đây đã xác minh. Webhook không chữ ký → 401 đúng. **Chưa làm được:** test webhook chữ ký đúng → 200 (cần `SEPAY_WEBHOOK_SECRET`); tạo đơn test thật 2.000đ khóa 01 (cần JWT tài khoản đã xác nhận email); đối soát DH-2026-000004 (cần service_role key). Tài khoản test `visfaracademy+paytest2@gmail.com` đã tạo trên prod nhưng **chưa xác nhận email** (email xác nhận không tới Gmail sau 2 lần gửi — nghi hết hạn mức gửi Supabase); mật khẩu ghi trong file nội bộ `~/workspace/visfar-test-accounts.md` (ngoài repo, không commit/push).
- **Mục 4 — Email domain riêng: CHƯA XONG (chờ user mua domain — đúng quyết định "Dùng tạm").** Không mua domain, không tự chọn tên domain. Đã viết `docs/email/DOMAIN_CHECKLIST.md` (từng bước mua + DNS SPF/DKIM/DMARC + verify + gửi thử); 4 template Auth đã viết đủ trong repo, **chưa rõ user đã paste lên Dashboard staging/prod chưa**. Không gửi email thử trong đợt này (không có Resend API key trong phiên).
- **Mục 5 — 3 tài khoản test + E2E live: CHƯA XONG.** Chỉ tạo được 1 tài khoản student (chưa xác nhận, xem trên); instructor/admin test chưa tạo (cần service_role key hoặc Dashboard); E2E bằng trình duyệt thật không chạy được trong phiên subagent này (không có browser-task; VM Chromium không TLS ra ngoài). Live route sau migration đều 200 (guard 307 đúng); AI Mentor ask guest → 401 (không còn 502).
- **Mục 6 — GitHub + backup: CHƯA XONG (chờ user).** File đã sẵn: `.github/workflows/deploy.yml` (đủ 2 jobs), `ci.yml` (có sẵn), `backup.yml` + `keep-warm.yml` (mới, YAML parse OK), `docs/release/GITHUB_SETUP.md`. Chưa push thử (phiên subagent không có công cụ GitHub; lần trước 403 do App `meta-muse-ai` chưa có quyền ghi). Backup đầu tiên + restore thử chưa có (chỉ chạy được trên GitHub Actions sau khi có repo).
- **Verdict sau đợt P0: vẫn CHƯA NGHIỆM THU MỞ BÁN THẬT** (SePay E2E + email học viên thật còn mở). Chi tiết: `docs/release/QA_REPORT.md` §11.

## Quyết định 26 — Hoa hồng tiếp thị liên kết CHỐT 10% (11/11/2026 ~16:19 +07, user chốt "D. Chốt 10%")

- Tỷ lệ hoa hồng **ĐÃ CHỐT 10%** (không còn là mặc định chờ chốt). `COMMISSION_RATE = 0.10` trong `workers/api/src/referrals.ts` giữ nguyên giá trị, chỉ bỏ chữ "mặc định, chờ Visfar chốt" ở mọi chỗ hiển thị: nhãn `COMMISSION_RATE_LABEL` trong `apps/web/src/lib/referrals.ts` nay là `'10%'` (trang `/hoc-vien/vi` hiện "10%"), ghi chú hoa hồng trong giao dịch ví của Worker bỏ "(mặc định)", tài liệu `docs/payment/referrals-wallet.md` đổi tiêu đề thành "ĐÃ CHỐT 10%". Test `referrals.test.ts` cập nhật theo (nhãn đúng bằng `'10%'`).

## Quyết định 27 — Tài chính → Thân ĐÃ ĐƯỢC CHỐT (11/11/2026 ~16:19 +07, user chốt "E. Tài chính là thân")

- Phân loại khóa 06 Tài chính vào trụ **Thân** đã được user phê duyệt chính thức — không còn là lựa chọn của agent. Migration 0024 + `cats` của khóa 06 (đã áp staging + prod từ đợt trước) nay là trạng thái đã chốt. Mục "chờ phê duyệt" tương ứng trong `docs/frontend/REAL_USER_AUDIT.md` §6.4 (mục 1) đã đóng.

## Quyết định 28 — Giữ tiêu đề "Sứ mệnh & Tầm nhìn" (11/11/2026 ~16:19 +07, user chốt "I. Giữ")

- Tiêu đề lớn "Sứ mệnh & Tầm nhìn" ở phần sau hero **GIỮ NGUYÊN, không xóa, không sửa**. Đóng câu hỏi mở từ 2026-11-05 (xóa hay giữ tiêu đề này).

## Quyết định 29 — Đổi tên khóa 02 và 08 theo hệ Thân–Tâm–Tuệ (11/11/2026 ~16:19 +07, user chốt "F. Tên khóa 02 và 08 đổi theo hệ thân - tâm - tuệ")

- Khóa 02 (trụ Tâm): "THẤU HIỂU TÂM THỨC" → **"THẤU HIỂU TÂM"**. Khóa 08 (tích hợp cả ba trụ): "MASTER TÂM THỨC" → **"MASTER THÂN – TÂM – TUỆ"**. Đồng bộ mọi nơi: poster overlay, thẻ khóa học (trang chủ + `/chuong-trinh` + trang chi tiết), nút tư vấn, option form (lấy từ DB nên theo title DB), link footer "Khóa học", FAQ, câu hỏi mẫu AI Mentor (khóa 02).
- **LƯU Ý QUAN TRỌNG:** tên mới của khóa 08 là **suy ra từ phân loại "Tích hợp"** (cả ba trụ Thân–Tâm–Tuệ), **không phải tên user viết sẵn** — user sửa lại bằng 1 câu nếu muốn tên khác. Slug `master-tam-thuc-nhan-hieu` **GIỮ NGUYÊN** để không vỡ link cũ; chỉ đổi title hiển thị. Slug khóa 02 `thau-hieu-tam-thuc` cũng giữ nguyên.
- **Migration 0032** (`0032_rename_courses_02_08.sql`, idempotent, chỉ đổi title): đã áp **STAGING (HTTP 201)** và **PROD (HTTP 201)** trong cùng đợt (user ra lệnh đổi tên trực tiếp = phê duyệt áp prod cho migration này); xác minh qua REST cả 2 môi trường: title mới đúng.
- Grep sau sửa: 0 lần "THẤU HIỂU TÂM THỨC" và 0 lần "MASTER TÂM THỨC" ở phần hiển thị trong `apps/web/src` (trừ ghi chú lịch sử trong docs/migration cũ). Tên mới khóa 08 dài hơn — đã kiểm tra poster overlay không vỡ/tràn ở 1440px + 390px.

## Quyết định 30 — Bỏ link "Đăng nhập học viên" ở thanh Copyright footer (11/11/2026 ~16:19 +07, user chốt "G. Link đó bỏ")

- Link `<a href="/dang-nhap">Đăng nhập học viên</a>` trong thanh Copyright (`Footer.tsx`) đã **xóa hẳn**; thanh cuối nay chỉ còn "Copyright 2026 © Visfar Academy.". Các link footer khác giữ nguyên. Grep xác nhận 0 lần xuất hiện. (Đăng nhập/đăng ký vẫn vào được từ cụm tài khoản trên header.)

## Quyết định 31 — Đồng bộ hết tên cũ còn sót (11/11/2026 ~16:19 +07, user chốt "H. Bỏ hết")

- Link tài nguyên "Bắt đầu tại đây": "Thấu Hiểu Bản Thân" → **"Thấu Hiểu Nội Tâm"** (href đã là `/tu-van?course=thau-hieu-noi-tam` từ trước nên form pre-select đã đúng, chỉ đổi chữ hiển thị).
- FAQ lộ trình học: "...Thấu Hiểu Tâm Thức, Khai Mở Trí Tuệ, Kiến Tạo Nhân Hiệu." → **"...Thấu Hiểu Tâm, Thấu Hiểu Trí Tuệ."** ("Kiến Tạo Nhân Hiệu" là khóa đã xóa nên bỏ hẳn, không để lại tên khóa không còn tồn tại.)
- Tên cũ "Nâng Tầm Tâm Thức & Nhân Hiệu" còn trong 1 dòng FAQ + mục 4 trang hoàn trả/hủy đăng ký → **"Chuyên Gia Tư Vấn và Huấn Luyện Tâm Thức"** (tên hiện tại của khóa 07).
- Grep sau sửa: 0 lần "Thấu Hiểu Bản Thân", 0 lần "Kiến Tạo Nhân Hiệu", 0 lần "Nâng Tầm Tâm Thức & Nhân Hiệu" ở phần hiển thị trong `apps/web/src` (trừ ghi chú lịch sử trong docs/migration cũ và cụm từ thường "thấu hiểu bản thân"/"kiến tạo nhân hiệu" viết thường trong văn xuôi giới thiệu — không phải tên khóa).

## Quy tắc làm việc từ 10/11/2026, 22:32 +07

User chốt: **từ giờ trở đi không cần hỏi lại, auto duyệt**. Nhóm làm việc cứ làm theo quyết định đã chốt và ghi lại đầy đủ, chỉ dừng khi gặp lỗi kỹ thuật (ghi lỗi chính xác, không tự sửa bừa). Áp dụng cho cả phê duyệt migration, vá bảo mật, và tạo tài khoản test.

## Ghi chú

- Quyết định 8 (giữ PII trong mailto/clipboard) và quyết định 3 (giữ nguyên fallback “thành công giả”) là hai rủi ro đã được cảnh báo trong báo cáo Task 01; đội ngũ ghi nhận theo ý chủ dự án và sẽ giảm thiểu bằng mã tham chiếu + đối soát, không tự ý đổi ngược quyết định.
- Tài liệu kiến trúc và các file audit cần được cập nhật theo 19 quyết định này ở nhiệm vụ tiếp theo — chưa cập nhật trong file này.

## Quyết định 20 — Worker API chuyển sang PROD + migration prod (11/11/2026 ~11:25 +07, user chốt)

- **Worker `api` chuyển sang Supabase PROD:** secret `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (định dạng mới `sb_secret_…`) đã đặt lại sang prod; Worker deploy lại (Version ID `6377aa16-…`). Kiểm chứng: lead test vào PROD, không vào staging; JWT prod thật gọi `GET /api/v1/my/orders` → 200 (hết lỗi 401 issuer mismatch).
- **Migration đã áp lên PROD (HTTP 201, đã xác minh):** 0022 (trigger `trg_profiles_block_disable_change`), 0023 (4 bảng lịch hẹn/ví + RLS), 0024 (trụ cột Thân–Tâm–Tuệ: tam,tam,tue,than,tam,than,tich-hop,tich-hop,tich-hop,cong-dong; 0 dòng "NOI DUNG TAM").
- **Biến môi trường production Pages đã đặt đủ 3 biến:** `NEXT_PUBLIC_SUPABASE_URL` (prod), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (lấy từ `.env.local`, đã xác minh gọi REST prod 200), `NEXT_PUBLIC_API_BASE_URL` (Worker prod).
- **Trang chi tiết khóa học hiển thị A–Z không cần đăng ký:** danh sách module/bài (tên, loại, thời lượng) xem được cho mọi người; bài trả phí hiện ổ khóa 🔒 + nhãn "Đã khóa", bấm vào cuộn tới khối đăng ký khóa học; đã ghi danh thì tự động mở (bấm vào là học). Nội dung bài chỉ qua API guard `/api/lms/lessons/[id]`; danh sách chỉ đọc view `lessons_public` (không lộ content/video_url/file_url).

## Quyết định 21 — Thư viện Master + Blog riêng + đổi tên khóa 08 + logo/căn đều (11/11/2026 ~12:05 +07, user chốt)

- **Thư viện Master (`/thu-vien-master`, menu 7 mục):** banner + 2 cột (bài đang chọn | danh sách 11 mục, thu gọn/mở rộng, mục đang chọn tô vàng, deep-link `?bai=`). Nội dung ban đầu: bài “7 Bố Thí Quan Trọng Đời Người” (từ tài liệu Master K03 của user; 3 khái niệm Nhan thí/Tâm thí/Tọa thí chưa có lời giải chi tiết nên ghi “Đang cập nhật”, không bịa) + 10 mục T… “Đang cập nhật”. Admin tự đăng bài tại `/admin/thu-vien` (API `/api/admin/library`, audit `library.create/update/delete`); ảnh bìa hiện chỉ dán link, chưa hỗ trợ tải file.
- **Migration 0025** (`master_library_items` + RLS + seed 11 mục) và **0026** (đổi title khóa 08 trên staging) — **đã áp STAGING (HTTP 201, đã xác minh), CHƯA áp prod** (chờ user nghiệm thu; trang Thư viện trên prod tạm chạy bằng dữ liệu mặc định trong code, đủ 11 mục).
- **Blog riêng:** `/blog` (danh sách 3 bài đã chốt) + `/blog/[slug]` (hiện đúng đoạn văn đã chốt, không bịa thêm); menu BLOG → `/blog`; phần Blog trang chủ giữ nguyên + link “Xem tất cả”. Admin đăng/sửa bài blog **chưa có** (blog hiện là dữ liệu tĩnh) — thêm sau.
- **Đổi tên khóa 08 → “MASTER TÂM THỨC”, GIỮ NGUYÊN slug `master-tam-thuc-nhan-hieu`.** Prod DB đã có sẵn title mới từ trước nên không cần đổi prod; staging đã đổi bằng migration 0026.
- **Logo:** footer 96px → **168px** (căn giữa ở mobile 1 cột), header 44px → **56px**; giữ nguyên file ảnh.
- **Căn đều hero:** 4 đoạn đã căn đều đúng trong code live (đã render đúng HTML+CSS live và xem bằng mắt: lề phải thẳng ở 390px và 1440px); lệch còn lại trên desktop là do `max-width` 760/860px khiến mép chữ thụt vào so với mép ảnh — đã đổi sang `max-width: 100%` (rộng đúng bằng ảnh, đo được 55–1371 trùng mép ảnh). Ảnh chụp 11:40 của user nhiều khả năng là tab mở từ trước đợt sửa chưa tải lại — user cần đóng hẳn tab cũ rồi mở lại (hoặc tải lại cứng).
- **Hover toàn trang:** lift + viền vàng + bóng gold đã áp cho mọi khung (kể cả các khung trước đây thiếu); **chưa kiểm chứng được bằng headless Chromium trong VM** (môi trường báo `hover: none`, quy tắc `@media (hover: hover)` không kích hoạt — đây là giới hạn kiểm thử, không phải lỗi code; cần kiểm chứng bằng trình duyệt desktop thật có chuột).

## Quyết định 22 — Thư viện Master đủ 119 mục nguyên văn + xóa dòng Founder + poster đỏ mận sáng hơn (11/11/2026 ~13:00 +07, user chốt, auto-duyệt)

- **Thư viện Master đủ 119 mục (3 tổng quan + 116 khái niệm), nguyên văn user gửi 11/11/2026, không cắt gọn/không viết lại/không bịa:** nguồn `docs/library/noi-dung-thu-vien-master.md`; đã đối chiếu — cả 560 dòng không trống trong file nguồn đều có mặt đúng thứ tự trong dữ liệu. Seed mặc định `apps/web/src/lib/master-library-data.ts` + seed SQL trong migration 0025 (idempotent, `on conflict (slug)` cập nhật) đều đủ 119 mục, slug duy nhất. **Migration 0025 đã cập nhật đã áp STAGING (HTTP 201; anon REST đếm 119 mục đã xuất bản), CHƯA áp prod** — prod chạy bằng dữ liệu mặc định trong code (đã xác minh chunk JS live chứa đủ 119/119 slug). Deploy Pages `https://010353fb.visfaracademy.pages.dev`; production `https://visfaracademy.pages.dev` 200 (`/` + `/thu-vien-master`), CSS live chứa `brightness(1.38)`.
- **Cách gom nhóm (category):** Khái niệm nguồn 46 · Nhân cách 15 · Tâm thái 13 · Trí tuệ 11 · 9 dạng người 10 · Con người 9 · Phẩm chất 7 · Ba khối đức 4 · Triết lý giáo dục tận gốc 2 · Bố thí 1 · Tố chất nhân tài 1 (= 119). 3 mục tổng quan link chéo tới mục chi tiết khi có: 9 dạng người 9/9 link, 8 tố chất 2/2 link (Khiêm tốn, Trân trọng biết ơn), 7 bố thí 0 link (7 thành phần chưa có mục chi tiết riêng — đúng theo yêu cầu, không bịa mục mới). **0 mục còn "Đang cập nhật"** (mọi mục đều có nội dung).
- **Hiển thị:** sidebar thêm ô tìm kiếm theo tên khái niệm (không dấu, lọc ngay; vd "tri tue" → 8 mục; không khớp → "Tìm thấy 0 / 119 mục."); nội dung giữ xuống dòng/dấu `+`/`–` của user (render `<br/>`); chữ căn đều theo chuẩn toàn trang (`p { text-align: justify }` sẵn có).
- **Xóa dòng "Lê Đăng Quyết — Founder Visfar Academy":** đó là `<h2 id="founderTitle">` trong `FounderSection` (phần #gioi-thieu); đã xóa hẳn, chuyển `id="founderTitle"` sang dòng tên chính `<p class="founder-name">LÊ ĐĂNG QUYẾT</p>` (giữ nguyên, cỡ 1.7–2.4rem). Grep `apps/web/src` = 0 lần "Founder Visfar Academy"; live HTML cũng 0 lần; "LÊ ĐĂNG QUYẾT" còn 2 lần. Ảnh Founder và 6 đoạn văn Founder giữ nguyên.
- **Poster khóa học đỏ mận tươi sáng hơn (chỉ CSS, không vẽ lại ảnh, không đổi file/chữ):** ảnh gốc là nền đỏ mận sẫm đặc `#560f15`; `.poster img` thêm `filter: brightness(1.38) saturate(1.3)`; `.poster-overlay` giảm lớp phủ đen từ `0.28/0.55/0.74` xuống `0.12/0.28/0.48`. Đo bằng render thật: nền poster giữa khung `#6d0813` (cũ ~`#270709`), vẫn đỏ mận đậm (không đỏ tươi/hồng), chữ vàng/trắng vẫn đọc rõ. Áp cho cả 10 poster (chỉ trang chủ dùng ảnh poster; `/chuong-trinh` và trang chi tiết không dùng ảnh poster nên không bị ảnh hưởng).
- **Kiểm chứng đợt này:** web test 644/644 PASS, typecheck + `pages:build` PASS; render thật bằng headless Chromium (Playwright + chromium đã cache, `--no-proxy-server`): thư viện 119 mục + tìm kiếm + link chéo đúng, trang chủ không tràn ngang 1440/390, poster sáng hơn rõ rệt, chữ đọc rõ. Lưu ý: `scripts/check-migrations.mjs` báo FAIL 1 kiểm tra (danh sách cứng 24 migration, repo nay có 26 file 0001–0026) — lỗi có sẵn từ trước, không do đợt này; chưa sửa script.

## Quyết định 23 — Vá S-03 bằng migration 0028 + preview trả video_url qua guard (11/11/2026 ~14:00 +07, GĐ2 P0, auto-duyệt)

- **S-03 — siết policy bảng `lessons` (migration 0028, số 0027 đã thuộc về đánh giá 11D của nhóm song song):** drop `lessons_select_public`, thay bằng `lessons_select_enrolled` — chỉ admin / instructor khoa phụ trách / học viên có enrollment `active|completed` của khóa `published` mới SELECT được dòng (kể cả `content`/`video_url`/`file_url`). Anon đọc trực tiếp bảng `lessons` được 0 dòng (kể cả bài xem thử); đường đọc công khai duy nhất cho metadata là view `lessons_public` (không đổi).
- **Bài xem thử (`is_free_preview=true`) vẫn xem được video:** view mới `lessons_preview_video` (chỉ `id` + `video_url` của bài xem thử thuộc khóa `published`) + API guard `GET /api/lms/lessons/[lessonId]` trả `video_url` khi `previewOnly:true`; `content` và `file_url` của bài xem thử KHÔNG trả ở bất kỳ đâu (video mẫu là YouTube unlisted theo QĐ 16 — ai có link đều xem được, còn nội dung text/tài liệu vẫn giữ kín).
- **Đường đọc nội dung thật cho học viên đã ghi danh giữ nguyên qua API guard** (guard đọc metadata qua view rồi mới đọc dòng đầy đủ qua bảng `lessons` khi quyết định `ok`; học viên chưa ghi danh gọi guard cho bài trả phí vẫn nhận 403 `not-enrolled` như cũ).
- **Migration 0028 đã áp STAGING (HTTP 201, đã xác minh), CHƯA áp prod** (chờ user nghiệm thu). Kiểm chứng staging đầy đủ trong `docs/CHANGELOG.md` (mục GĐ2) và `docs/release/SECURITY_REPORT.md` (Task 12, S-03).
- **C-05-02 chống trùng Idempotency-Key live: ĐẠT.** Gửi 3 lần lên Worker `api`: 201 `duplicate:false` → 200 `duplicate:true` (cùng mã `VISFAR-2026-708302`) → 409 `idempotency_conflict`. Dòng test đã xóa khỏi DB (Worker hiện nối PROD nên dòng test nằm ở prod, không phải staging như dự kiến ban đầu); `sheetSynced:false` nên Sheet không nhận dòng test, không cần xóa trên Sheet.
- **Sitemap/robots:** chỉ liệt kê route công khai có thật (25 URL); `/su-kien` không có route riêng (chỉ là neo `/#su-kien`) nên không đưa vào; `/hoc-vien/*` và `/admin/*` không đưa vào sitemap vì cần đăng nhập (trả 307 cho khách) — lệch QĐ 11 ở điểm này, user chốt lại nếu muốn đổi. `robots.txt` chặn `/api/`, `/admin/`, `/hoc-vien/`, `/auth/`, `/thanh-toan/`.
- **CSP/HSTS (S-04):** CSP cho YouTube embed, Supabase, Worker API, font self-hosted; HSTS `max-age=31536000; includeSubDomains` (không preload); `X-Frame-Options: SAMEORIGIN`. CSP dùng `'unsafe-inline'`/`'unsafe-eval'` cho Next.js runtime (nâng lên nonce-based CSP là follow-up, chưa làm đợt này).
- **Lưu ý vận hành (phát hiện trong đợt này):** nhiều agent build song song chung thư mục `.next` làm build sau ghi đè chunk của build trước (server chunk bake nhầm env prod trong lúc server staging đang chạy) — đã ghi vào SECURITY_REPORT/PROJECT_AUDIT; lần sau chỉ build khi không còn agent khác đang build, hoặc build trong thư mục riêng.

## Quyết định 32 — Giá khóa học / gói thành viên GIỮ Tùy tâm / 0đ (11/11/2026, user chốt, mục K)

- Không đổi giá nào. Giá khóa học và gói thành viên **giữ nguyên Tùy tâm / 0đ cho tới khi user gửi giá mới**. Không tự đặt giá, không tự đổi trạng thái `is_pay_what_you_want` / `price_vnd` của bất kỳ khóa nào.

## Quyết định 33 — Bài Buổi 1 khóa 01 đã có video YouTube (11/11/2026, user gửi link, mục J/Q)

- Link user gửi: `https://youtu.be/xE0ofNDjBXo?si=l6jQuZFh8e7J2twk` (video ID `xE0ofNDjBXo`).
- Kiểm tra DB **prod** ngày 2026-11-11: khóa 01 có 1 module "Chương 1 - Thấu hiểu về nội tâm" với 5 bài "Buổi 1–5 - Chuyển hóa nội tâm"; bài **"Buổi 1 - Chuyển hóa nội tâm"** (slug `buoi-1-chuyen-hoa-noi-tam`) **đã có sẵn `video_url = https://www.youtube.com/watch?v=xE0ofNDjBXo`** — đúng link user gửi — và `is_published = true`. **Không tạo bài trùng.** (Lưu ý tên bài trong DB là "Chuyển hóa nội tâm", khác chữ "tâm thức" trong tin user gửi lúc báo lỗi form — đó là tên bài user tự đặt khi thêm bài.)
- Các bài Buổi 2–5 đã có sẵn video YouTube khác (không đụng tới).

## Quyết định 34 — Bổ sung lời giải Nhan thí + Tọa thí cho Thư viện (11/11/2026, user nói "OK thêm cho tôi", mục L)

- **Tìm thấy trong tài liệu của chính user** (file `160_CH.docx`, `workspace/user/files/`):
  - **Nhan thí:** bố thí nụ cười — "Một nụ cười thay đổi được vận mệnh của một quốc gia, thay đổi sự nghiệp, thay đổi cuộc đời"; mật mã 7-1-3 (7 bố thí đối với nhân, để kích duyên lành).
  - **Tọa thí:** để lại cho thế hệ sau trí tuệ/tri thức thay vì tiền — "làm thế nào để lại được tri thức mà người sau kế thừa và làm tốt hơn hiện tại", áp dụng 15 khái niệm nguồn (ví dụ chú Sinh, phân bón hoá sinh, WiT).
  - Nội dung đưa vào mục "7 Bố Thí Quan Trọng Đời Người" đúng văn bản gốc của user, chỉ sửa nhẹ lỗi chính tả rõ ràng (học→họ, đề→để, kết→kế, tiềm→tìm), không bịa thêm.
- **Tâm thí: KHÔNG tìm thấy lời giải trong bất kỳ tài liệu nào của user** — DOCX "TỔNG HỢP 65 CHỦ ĐỀ" chỉ có tiêu đề "47. TVHL Tâm thí" không có nội dung; các DOCX khác chỉ liệt kê tên; file PDF tổng hợp khái niệm nguồn là file ảnh quét, không trích xuất được text. **Giữ nguyên chỉ tên "Tâm thí", không bịa lời giải** — chờ user gửi lời giải hoặc xác nhận.
- **Đính chính hồ sơ:** QĐ 21/22 từng ghi mục 7 Bố thí "ghi Đang cập nhật" cho 3 khái niệm — kiểm tra thực tế seed + DB prod cho thấy mục này **chưa từng chứa chữ "Đang cập nhật"**, chỉ liệt kê 7 tên không lời giải. Sau đợt này: Nhan thí + Tọa thí có lời giải thật; Tâm thí vẫn chỉ có tên.
- Cập nhật: `apps/web/src/lib/master-library-data.ts` + seed trong migration 0025 (cho cài mới) + **migration 0033** (`0033_bo_thi_nhan_toa.sql`, UPDATE theo slug, idempotent) — áp staging + prod, đã xác minh qua REST.
- **Ảnh banner kệ sách cho Thư viện: user chưa gửi — KHÔNG tự tạo ảnh giả làm banner**, giữ panel gradient hiện tại, đang chờ ảnh.

## Quyết định 35 — Ảnh cộng đồng thật thay ảnh phần Doanh nghiệp (11/11/2026, user gửi ảnh, mục M)

- File user gửi: `workspace/user/media_library/image/A7305795_Original.jpg` (ảnh tập thể ~200 người tại Ivory, núi + hồ + đài phun nước).
- Ảnh này **thay `apps/web/public/images/biz-group.jpg`** (phần Giải pháp doanh nghiệp, trang chủ). Xử lý: resize 4096×2305 → **1600×900**, JPEG q88, **không crop** (giữ nguyên tất cả người ở rìa), giữ nguyên tên file; cập nhật `width/height` (1600×900) + alt "Cộng đồng Visfar Academy" trong `HomeSections.tsx`.
- **Đính chính:** ảnh bị thay KHÔNG phải ảnh AI minh họa như mô tả trong yêu cầu — đó là **ảnh thật của user đang giảng trước lớp** (vest xanh, 1439×1093, md5 `924e4469…`), đã sao lưu tại `/tmp/biz-group-lecturing-backup.jpg`. Ảnh giảng này hiện không còn xuất hiện ở đâu khác trên trang chủ (thẻ Workshop đã đổi sang ảnh chân dung từ trước). Nếu user muốn giữ lại ảnh giảng ở vị trí khác thì báo lại.
- Ảnh tập thể chỉ dùng làm ảnh cộng đồng chung, **không ghi tên ai** (không có thông tin từng người).

## Ghi nhận — Mục N, O, P (11/11/2026, user báo đã làm xong)

- **N + O:** user báo đã kiểm tra bằng mắt trên điện thoại/máy tính và đã quét QR + đăng ký thử — **không báo lỗi gì**, coi như đạt ở phía user. Không cần làm thêm.
- **P:** user báo OK đã dán 4 template email Supabase Auth trên Dashboard (staging + prod) — việc của user, không cần làm thêm.

## Quyết định 36 — Tặng khóa 01 cho tài khoản lequyet.hvnh@gmail.com (11/11/2026, user nói "ok", mục R)

- **Đã tặng khóa 01 "Thấu Hiểu Nội Tâm"** cho tài khoản `lequyet.hvnh@gmail.com` (tài khoản của chính user, role instructor, trước đó 0 khóa học). Enrolment `be4d3482-6f83-4908-8e4e-725011b83263`, status `active`, `order_id` NULL, `granted_by` = admin `visfaracademy@gmail.com`, `grant_reason` ghi rõ quyết định user ngày 2026-11-11 (mục R); `audit_logs` có dòng `enrollment.grant` tương ứng (16:36:59 +07).
- **Cách thực hiện:** ghi trực tiếp qua Supabase Management API SQL, sao chép đúng các cột + dòng audit của hàm chuẩn `grantEnrollment()` (`/api/admin/enrollments`) — vì luồng API cần phiên admin (mật khẩu admin không có trong phiên này). Không dùng form admin trên trình duyệt. **Email thông báo tặng khóa (Task 11 E5) KHÔNG được gửi** — Worker hiện fail-close email do chưa đặt `RESEND_FROM_EMAIL` (xem QĐ "Dùng tạm"); user tự thông báo cho chính mình không cần thiết.
- **Tài khoản test học viên mới tinh CHƯA tạo** (user chưa yêu cầu thêm). Nếu muốn thêm thì báo sau.

## Quyết định 37 — Giảng viên tất cả khóa học là Lê Đăng Quyết (11/11/2026, user xác nhận "Giảng viên: Lê Đăng Quyết")

- **Nguồn dòng cũ "Giảng viên: Ngô Mạnh Cường" — KHÔNG TÌM THẤY ở bất kỳ nguồn nào kiểm tra được:** grep toàn repo (`apps/web/src`, `packages/shared`, migrations, seed, docs) = 0; `git log -S` toàn lịch sử repo = 0 (tên này chưa từng có trong repo); DB prod: `profiles` (4 tài khoản) = 0, `course_instructors` = 0, `courses` (title/subtitle/description/details) = 0; DB staging = 0; file HTML gốc user gửi = 0; built chunks + live HTML `/` + `/chuong-trinh` + 3 trang chi tiết = 0; code hiện tại cũng **không render dòng giảng viên nào** ở thẻ khóa học/trang chi tiết (chỉ trang admin `/admin/khoa-hoc` có mục "Giảng viên phụ trách", và giảng viên duy nhất được phân công ở đó đã là Lê Đăng Quyết — khóa 01). **Kết luận:** ảnh user chụp lúc 16:53 nhiều khả năng là trang đã cache cũ trên máy user hoặc một trang khác — không có nguồn nào trong hệ thống hiện tại để gỡ. Không bịa thêm, không đoán URL trong ảnh.
- **Trạng thái cuối chốt:** mọi chỗ hiển thị giảng viên đều là **"Giảng viên: Lê Đăng Quyết"** — không chức danh/bằng cấp kèm theo. Hiển thị bằng hằng số `LEAD_INSTRUCTOR_NAME` trong `apps/web/src/lib/courses.ts` (dùng chung ở 3 nơi: thẻ khóa học trang chủ `CourseExplorer`, thẻ `/chuong-trinh` `CourseCard`, trang chi tiết khóa học `[slug]`), kèm test hồi quy trong `courses.test.ts`.
- **Dữ liệu (nguồn thật):** đã gắn Lê Đăng Quyết (tài khoản `lequyet.hvnh@gmail.com`, id `3c749a12…`) làm giảng viên chính (`role='lead'`, `assigned_by` = admin) cho **cả 10 khóa trên PROD** (khóa 01 đã có từ trước; thêm 9 khóa, `ON CONFLICT DO NOTHING`, đã xác minh 10/10). **Staging chưa gắn được:** tài khoản này không tồn tại trên staging nên FK `course_instructors_user_id_fkey` chặn insert (HTTP 400, đúng thiết kế) — staging giữ nguyên 0 phân công, không tạo tài khoản giả.
- **Tên "Ngô Mạnh Cường" là tên bịa cũ, đã chốt gỡ từ trước** — sau đợt này chỉ còn xuất hiện trong 1 comment giải thích trong `courses.ts` và 1 test hồi quy khẳng định tên đó không phải giảng viên (ghi chú lịch sử, không hiển thị cho người dùng).

## Ghi nhận — Sửa màn hình kẹt "Đang kiểm tra phiên đăng nhập…" (11/11/2026, user báo 16:37 +07)

- **Nguyên nhân gốc:** guard `/hoc-vien` (`useRequireAuth` + `checkCurrentAccountDisabled`) `await` không giới hạn, không try/catch, không timeout — bất kỳ request nào treo (auth-js `fetch` không có timeout) cũng kẹt trang vĩnh viễn, không lối thoát. Thêm 2 lỗi cùng đường: `getSupabaseClient()` tạo client mới mỗi lần gọi (4–5 client/1 lần tải, đua nhau rotate refresh token) và storage đồng bộ cookie luôn ưu tiên localStorage nên sau khi middleware rotate token ở server, client vẫn dùng refresh token đã thu hồi.
- **Đã sửa (code, chưa deploy):** timeout 10s + try/catch → trạng thái lỗi có nút **Thử lại** (reload) + **Đăng nhập lại** (`useRequireAuth.ts`, `auth.ts`, `session-guard.ts`); singleton browser client; storage ưu tiên giá trị có `expires_at` mới hơn giữa cookie và localStorage (`supabase.ts`). Guard vẫn chặn nội dung cho tới khi phiên được xác minh — không yếu bảo mật. Test 715/715, typecheck + build PASS.
- **Chưa xong:** kiểm chứng bằng browser-task (bấm hết 10 mục dropdown với tài khoản student test + tài khoản user tự đăng nhập) — subagent không chạy browser-task được, cần parent sắp xếp; deploy đang chờ credential Cloudflare.

## Ghi nhận — Thu nhỏ thanh hotline + thu gọn khoảng cách dọc (11/11/2026, user yêu cầu kèm ảnh cận topbar)

- **Đo trước (CDP, build local, 1440px):** topbar **80px** (font 15.2px, padding 5.6px) — nguyên nhân: `.topbar.wrap` thừa hưởng `min-height: 68px` từ `.site-header.wrap`; header tổng **152px**; doc cao 22039px.
- **Đã sửa (CSS, `globals.css`):** topbar font 0.95rem → **0.875rem (14px)**, padding 0.35rem → **0.25rem**, thêm `.topbar.wrap { min-height: 0; }` (dự kiến ~33px); `main section` padding 64px → **48px**; `scroll-margin-top` 84px → **108px** (header mới ~103px; sửa luôn lỗi anchor bị che ~68px dưới header cũ 152px); `.hero` 88px/72px → **64px/56px**; `.site-footer` padding-top 60px → **44px**. Mobile topbar `display:none` ≤920px giữ nguyên. Không đổi nội dung/thứ tự/màu sắc.
- **Chưa xong:** đo lại sau sửa (topbar/header/doc height, 1440px + 390px) + xem ảnh render bằng mắt; deploy đang chờ credential.

## Ghi nhận — Căn giữa 2 nút thẻ khóa học + rà soát cân đối 2 bên (11/11/2026, user yêu cầu 16:52 +07)

- **Nút:** `.prog-actions` (trang chủ `CourseExplorer`) → `flex-direction: column; align-items: center; justify-content: center; text-align: center` — nút vàng "Tư vấn chương trình →" trên, nút viền "Xem chi tiết khóa học" dưới, gap 0.75rem. `/chuong-trinh` `CourseCard` (1 nút viền) → `className="card-actions"` + CSS `.card-actions { text-align: center; }`. Trang chi tiết khóa học không có cặp nút này (chỉ nút "Học bài" + nút đóng modal) — không sửa gì ở đó.
- **Rà soát cân đối:** đang chạy cùng đợt (đo lề trái/phải từng section bằng CDP 1440px + 390px, xem ảnh bằng mắt) — kết quả ghi vào `docs/frontend/REAL_USER_AUDIT.md` khi xong.

## Quyết định 38 — Đổi nhãn menu "CÁC KHÓA HỌC" thành "KHÓA HỌC" (11/11/2026, user yêu cầu 17:06 +07)

- Chỉ đổi nhãn hiển thị trong menu header (`apps/web/src/components/layout/Header.tsx`, mảng `NAV`, 1 dòng duy nhất trong repo chứa nhãn này). Link đích giữ nguyên `/#chuong-trinh`.
- **Tiêu đề section trên trang chủ KHÔNG đổi** ("MƯỜI CHƯƠNG TRÌNH – MỘT HÀNH TRÌNH PHÁT TRIỂN") — đó là chuỗi khác, không dùng chung với nhãn menu.
- Kiểm chứng render local 1440px + 390px: menu hiện "KHÓA HỌC", đủ 7 mục, header cân đối, không tràn.
