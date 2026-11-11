# KIỂM TOÁN CUỐI — VISFAR ACADEMY (Prompt 20, GĐ2 cuối)

- **Ngày kiểm toán:** 11/11/2026, phiên ~14:40–15:45 +07
- **Phạm vi:** toàn bộ nền tảng `workspace/visfar-academy-platform` — Next.js 15 + Cloudflare Workers + Supabase; web live <https://visfaracademy.pages.dev>, Worker <https://api.visfaracademy.workers.dev>
- **Tài liệu đầu vào:** `docs/PROJECT_AUDIT.md` (GĐ1, Prompt 02), `docs/DECISIONS.md` (QĐ 1–23), `docs/CHANGELOG.md`, `docs/release/QA_REPORT.md` (Prompt 18, cùng đợt này), `docs/release/` (TEST_REPORT, SECURITY_REPORT, PRODUCTION_CHECKLIST, PERFORMANCE_REPORT), `docs/frontend/TASK11_11D_REPORT.md`, `TASK12_AI_MENTOR_REPORT.md`, `TASK13_14_REPORT.md`, `SEO_CRO_PERFORMANCE_REPORT.md`, `docs/ROADMAP.md` (kế hoạch 90 ngày Prompt 19)
- **Nguyên tắc:** không tự chấm 10/10 khi chưa có bằng chứng; điểm nào chưa có bằng chứng ghi rõ. Không ghi secret/key/token nào. Không sửa code trong phiên kiểm toán này.

## 0. Kết luận tổng thể

**Điểm trung bình 20 tiêu chí: 6,4/10 (cập nhật sau đợt P0 11/11/2026 ~16:00 +07 — Security 6→7, Automation 4→5; xem ghi chú cuối §0).** Nền tảng đã là một sản phẩm chạy được với đầy đủ module lõi (LMS, quiz, assignment, certificate, admin, CRM, thanh toán SePay, 11D, AI Mentor, Cộng đồng, Gamification, SEO) và chất lượng kỹ thuật tự động tốt (1047/1047 test PASS, build xanh, 31 migration sạch). Nhưng **khoảng cách giữa "code xong" và "bán được" vẫn là 2 chặn P0 chưa đóng**: (1) SePay chưa từng chạy thật, (2) email thật cho học viên chưa gửi được. **Chưa đủ điều kiện mở bán thật; đủ điều kiện dùng nội bộ/demo/nghiệm thu staging + dùng thử các module mới trên prod.** 90 ngày tới phải ưu tiên đóng P0 và chạy E2E thật trước khi thêm tính năng mới.

**Cập nhật sau đợt P0 11/11/2026:** S-03 đã ĐÓNG trên prod (0028 áp prod, anon `lessons` 0 dòng); migrations 0025–0031 đã lên prod (Thư viện 119, AI Mentor 138 chunk, Cộng đồng, Gamification, 11D đều chạy được trên live); form Newsletter đã nối route + test live đạt. Điểm Security 6→7, Automation 4→5, trung bình 6,3→6,4/10. Còn mở: SePay E2E thật, email học viên thật, E2E toàn luồng, GitHub remote/backup/restore. Chi tiết: `docs/release/QA_REPORT.md` §11, `docs/DECISIONS.md` QĐ 25.

| Tiêu chí | Điểm | Tiêu chí | Điểm |
|---|---|---|---|
| 1. Brand Identity | 8 | 11. Payment | 4 |
| 2. Visual Design | 8 | 12. CRM | 6 |
| 3. UX | 7 | 13. Automation | 5 |
| 4. Accessibility | 6 | 14. AI Integration | 6 |
| 5. Information Architecture | 8 | 15. Security | 7 |
| 6. Learning Experience | 7 | 16. Performance | 7 |
| 7. Student Management | 7 | 17. SEO | 7 |
| 8. Instructor Management | 5 | 18. Analytics | 4 |
| 9. Admin Experience | 7 | 19. Scalability | 6 |
| 10. E-commerce | 5 | 20. Maintainability | 7 |

---

## 1. Đánh giá 20 tiêu chí

### 1. Brand Identity — 8/10
- **Bằng chứng:** nhận diện đen than + vàng gold + nền ivory champagne thống nhất toàn trang (DESIGN_SYSTEM.md đối chiếu đúng `:root`); tuyên ngôn "KHAI MỞ TÂM THỨC • TU DƯỠNG ĐẠO ĐỨC • PHÁT TRIỂN TRÍ TUỆ • HOÀN THIỆN CON NGƯỜI • KIẾN TẠO THỊNH VƯỢNG"; khẩu hiệu "Hiểu mình, sáng trí, dựng hiệu."; 3 trụ cột Thân–Tâm–Tuệ (QĐ 20); topbar "Visfar Academy — Việt Nam Vươn Xa".
- **Điểm mạnh:** nhất quán, sang trọng, đúng định vị "học viện cao cấp"; triết lý Thập Nhất Viên Mãn là điểm khác biệt thật.
- **Điểm yếu:** tên cũ "Thấu Hiểu Bản Thân" còn sót 1 chỗ (HomeSections.tsx:485); văn bản cũ về trụ cột còn ở intro trang chủ/`/chuong-trinh`/`/tu-van` (QA-18-UI-01).
- **Rủi ro:** thấp — chỉ gây nhầm lẫn nhẹ, không ảnh hưởng chức năng.
- **Đề xuất:** dọn 3 điểm văn bản cũ khi user chốt; khóa tên khóa/trụ cột vào 1 file hằng số duy nhất để tránh lệch. **Ưu tiên: Thấp.**

### 2. Visual Design — 8/10
- **Bằng chứng:** DESIGN_SYSTEM.md đầy đủ (màu, typography Be Vietnam Pro tự host, layout 1380px, button/card/form, motion 220ms); render thật headless 52 lượt: 0 tràn ngang ở 390/768/1024/1440, không lỗi hiển thị ở các phần đã render (QA_REPORT §3); poster đỏ mận sáng hơn bằng CSS đã đo màu thật.
- **Điểm mạnh:** hệ thống luxury nhất quán; chuẩn mobile-first (body ≥16px, tap target ≥44px) được giữ trong mọi thay đổi GĐ2.
- **Điểm yếu:** hiệu ứng hover toàn trang chưa kiểm chứng được bằng headless Chromium trong VM (`hover: none`); nhãn Tam giác hiện thực ~3,98px ở 390px và tuyên ngôn 13,65px — user đã chấp nhận (QĐ 1–2) nhưng vẫn là giới hạn đã chốt, không phải điểm mạnh; chưa có modal/toast/tooltip/skeleton/pagination trong code.
- **Rủi ro:** thấp — trải nghiệm desktop có chuột là phần chưa được kiểm chứng duy nhất.
- **Đề xuất:** kiểm chứng hover + toàn trang bằng trình duyệt desktop thật (browser-task); bổ sung skeleton cho các trang tải client-side (thay "Đang tải…" trơ trọi). **Ưu tiên: Thấp.**

### 3. UX — 7/10
- **Bằng chứng:** luồng Guest → xem khóa → tư vấn rõ ràng; guard 307 đúng ở mọi trang cần đăng nhập (live); form đăng nhập/tư vấn render sạch ở 390px; 11D làm được không cần đăng nhập (lưu nháp localStorage); AI Mentor + Cộng đồng có cổng đăng nhập rõ ràng + disclaimer.
- **Điểm mạnh:** 1 hành động chính mỗi trang; ít ma sát cho người mới (xem A–Z không cần đăng ký).
- **Điểm yếu:** nhiều trang chỉ hiện "Đang tải…" khi dữ liệu chưa về (không skeleton, không retry rõ ràng); Thư viện lỗi mạng → hiện lỗi thay vì dùng dữ liệu tĩnh đã bundle (QA-18-UI-02); tìm kiếm header chưa kiểm chứng trả kết quả thật; chưa có toast/modal phản hồi thao tác.
- **Rủi ro:** trung bình — người dùng mạng yếu gặp trang lỗi/trống dù nội dung đã có sẵn.
- **Đề xuất:** skeleton + trạng thái lỗi có nút thử lại cho mọi trang tải client-side; fallback dữ liệu tĩnh khi offline (Thư viện, danh sách khóa); kiểm chứng tìm kiếm header live. **Ưu tiên: Trung bình.**

### 4. Accessibility — 6/10
- **Bằng chứng:** có link "Bỏ qua tới nội dung chính" (skip link); label form đầy đủ (`Email *`, `Mật khẩu *`); alt: rà soát 15 vị trí ảnh — 0 thiếu alt (SEO_CRO_REPORT); `aria` cho trạng thái tải (`role="status"`); legend 16px cho Tam giác hiện thực trên màn hình ≤1100px.
- **Điểm mạnh:** nền tảng cơ bản đúng (skip link, label, alt, tương phản vàng trên nền sáng đã đo đọc rõ).
- **Điểm yếu:** **chưa từng chạy kiểm tra accessibility thật** (axe/Lighthouse a11y, điều hướng bàn phím, screen reader); nhãn trong sơ đồ Tam giác vẫn ~4px (dưới ngưỡng đọc) dù đã có legend; focus visible chưa được kiểm chứng; chưa có kiểm tra độ tương phản toàn trang bằng công cụ.
- **Rủi ro:** trung bình — học viên lớn tuổi (đối tượng đã nêu: đọc được ở tuổi 60) có thể gặp khó với chữ nhỏ trong sơ đồ.
- **Đề xuất:** chạy axe/Lighthouse a11y 1 lượt trên 5 trang chính; kiểm tra bàn phím + focus; quyết định cuối về legend/tách sơ đồ Tam giác. **Ưu tiên: Trung bình.**

### 5. Information Architecture — 8/10
- **Bằng chứng:** menu chính 6–7 mục rõ ràng; sitemap 27 URL công khai có thật; breadcrumb ở trang chi tiết khóa/blog/chính sách; Thư viện 119 mục có phân nhóm (11 nhóm) + tìm kiếm không dấu + deep-link `?bai=`; 10 khóa theo đúng thứ tự 01, 02, 03, 09, 10, 11, 05, 06, 07, 08.
- **Điểm mạnh:** cấu trúc 1 hành trình (Biết → Tin → Hiểu → Thấu suốt → Chuyển hóa → Huân tập) xuyên suốt trang chủ, lộ trình, khóa học.
- **Điểm yếu:** `/su-kien` chỉ là neo `/#su-kien`, không có route riêng (lệch QĐ 11, chưa chốt lại); chưa có trang admin tổng hợp 11D (view đã sẵn); blog admin chưa có nên IA quản trị thiếu 1 nhánh.
- **Rủi ro:** thấp.
- **Đề xuất:** chốt lại lệch QĐ 11 về sitemap; thêm trang admin 11D + admin blog/sự kiện khi có nhu cầu thật. **Ưu tiên: Thấp.**

### 6. Learning Experience — 7/10
- **Bằng chứng:** LMS lõi đầy đủ code + test: bài học (video/text/PDF), tiến độ 90% video, quiz chấm server qua RPC `submit_quiz_attempt` (34 test), assignment upload bucket private (25 test), certificate mã `VISFAR-CERT-YYYY-NNNNNN` + tra cứu công khai (32 test), progress 47 test; guard bài trả phí đã kiểm chứng trên staging (403 `not-enrolled` / preview chỉ có `video_url`).
- **Điểm mạnh:** quy tắc học rõ ràng (90%, quiz đạt mới hoàn thành, chứng chỉ có thu hồi); nội dung Thư viện 119 mục nguyên văn, chất lượng tri thức cao.
- **Điểm yếu:** **chưa có học viên thật nào hoàn thành 1 khóa** — toàn bộ mới ở mức test mock; chưa phát video thật / làm quiz thật / nộp bài thật trên live; nội dung 3 khóa 04/05/06 vẫn là đoạn tạm; PDF chưa từng mở/render thật.
- **Rủi ro:** cao về mặt chứng minh giá trị — chưa biết trải nghiệm học thật có mượt không.
- **Đề xuất:** chạy 1 khóa học thử end-to-end bằng tài khoản thật (học 1 bài → quiz → hoàn thành → chứng chỉ) ngay sau khi có tài khoản test; thay nội dung thật cho khóa 04/05/06 (chờ user gửi). **Ưu tiên: Cao.**

### 7. Student Management — 7/10
- **Bằng chứng:** dashboard học viên, hồ sơ, đổi mật khẩu, đơn hàng, lịch sử, thông báo, thành tích (điểm/streak/huy hiệu); vô hiệu hóa tài khoản: migration 0022 **đã áp prod** + chặn đăng nhập ở middleware (kiểm chứng staging PASS); CRM lead + tương tác.
- **Điểm mạnh:** đủ vòng đời học viên (đăng ký → học → thành tích → chứng chỉ); chặn tài khoản bị disable đã có kiểm chứng.
- **Điểm yếu:** chưa có dữ liệu học viên thật để vận hành; chưa kiểm chứng bằng tài khoản thật trong phiên này (không có tài khoản test); trang admin học viên/CRM có route nhưng chưa kiểm chứng bằng admin thật.
- **Rủi ro:** trung bình — quy trình vô hiệu hóa/mở lại chưa từng chạy trên prod bằng tài khoản thật.
- **Đề xuất:** tạo 3 tài khoản test dùng chung; chạy kịch bản admin vô hiệu hóa → học viên bị chặn → mở lại. **Ưu tiên: Cao (gắn với E2E).**

### 8. Instructor Management — 5/10
- **Bằng chứng:** bảng `course_instructors` (chỉ admin gán, migration mới); instructor xem được đáp án đúng quiz + SĐT/email học viên khóa phụ trách + quản lý blog/sự kiện (theo ma trận quyền đã duyệt); test `lms-instructors` 17 test PASS.
- **Điểm mạnh:** phân quyền instructor đã được thiết kế đúng và có test.
- **Điểm yếu:** **không có luồng instructor hoàn chỉnh nào được kiểm chứng live** (không có tài khoản instructor thật, không có trang dashboard instructor riêng, không có quy trình onboarding instructor, chưa ai chấm bài thật); chấm bài tập tay chưa từng chạy thật.
- **Rủi ro:** trung bình — khi có giảng viên thật sẽ lúng túng vì chưa có quy trình.
- **Đề xuất:** 1 kịch bản instructor thật: gán khóa → xem học viên → chấm 1 bài tập → xem đáp án quiz. Viết hướng dẫn instructor ngắn (1 trang) khi làm. **Ưu tiên: Trung bình.**

### 9. Admin Experience — 7/10
- **Bằng chứng:** 10 mục admin (`khoa-hoc`, `hoc-vien`, `don-hang`, `crm`, `ma-giam-gia`, `goi-thanh-vien`, `lich-hen`, `thu-vien`, `cong-dong`, `audit-logs`); quản lý thư viện (CRUD + audit); kiểm duyệt cộng đồng (ẩn/hiện/ghim/xóa, xử lý báo cáo); test admin 73 test PASS.
- **Điểm mạnh:** bao phủ đủ nghiệp vụ vận hành ngày đầu (khóa, học viên, đơn, lead, mã giảm giá, thư viện, cộng đồng, audit).
- **Điểm yếu:** **chưa có admin blog** (blog tĩnh 3 bài); chưa có trang admin tổng hợp 11D; báo cáo R1–R10 (`GET /api/admin/reports/*`) chưa implemented; chưa kiểm chứng bằng tài khoản admin thật trên live.
- **Rủi ro:** trung bình — admin chưa tự đăng bài blog/sự kiện được.
- **Đề xuất:** thêm admin blog + admin 11D theo nhu cầu user (ROADMAP tháng 2); kiểm chứng toàn bộ trang admin bằng tài khoản admin thật. **Ưu tiên: Trung bình.**

### 10. E-commerce — 5/10
- **Bằng chứng:** orders + order_items + coupons + membership-plans + reference code `DH-YYYY-NNNNNN` + idempotency (code + test); trang checkout `/thanh-toan/[orderId]` có chuyển khoản MB + mã QR user cung cấp; trang `/goi-thanh-vien` live 200.
- **Điểm mạnh:** mô hình đơn hàng/mã giảm giá/gói thành viên đã thiết kế đúng (2 lớp, chống trùng).
- **Điểm yếu:** **chưa có đơn hàng thật nào**; giá khóa trả phí vẫn "Tùy tâm/0đ" (chờ user cung cấp giá) nên chưa test được `amount_vnd > 0`; chưa có trang quản trị đơn hoàn chỉnh trên live; chưa có chính sách giá hiển thị.
- **Rủi ro:** cao về kinh doanh — không có giá thì không có doanh thu, không đo được chuyển đổi.
- **Đề xuất:** user cung cấp giá thật cho khóa trả phí đầu tiên; 1 đơn thật end-to-end (ROADMAP tuần 1–2). **Ưu tiên: Cao.**

### 11. Payment — 4/10
- **Bằng chứng:** SePay gói FREE (50 GD/tháng, tài khoản MB dùng chung — QĐ 15); webhook `POST /api/v1/webhooks/sepay` (+ alias) đã nối route; verify HMAC-SHA256 + timing-safe + fail-closed (test contract PASS); `UNIQUE (method, gateway_reference)` chống trùng; secret đã set cho Worker; C-05-02 (idempotency lead) PASS live — nhưng đó là lead, không phải thanh toán.
- **Điểm mạnh:** thiết kế chống trùng/trùng lặp đúng; webhook fail-closed an toàn.
- **Điểm yếu:** **chưa từng test POST webhook live** (chữ ký đúng → 200 + đơn `paid`; sai → 401; replay → không trùng đơn đều chưa chạy); chưa có giao dịch thật; thuật toán/header chữ ký SePay thật chưa đối chiếu tài liệu chính thức (code tự ghi là giả định); `SEPAY_API_TOKEN`/`SEPAY_BANK_ACCOUNT_ID` chưa set nên đối soát bù chưa chạy được; giới hạn 50 GD/tháng tính cả giao dịch ngoài học phí (tài khoản dùng chung).
- **Rủi ro:** **cao nhất về tiền** — sai chữ ký thật → từ chối mọi webhook thật (không nhận được tiền); hết hạn mức FREE giữa tháng → mất giao dịch.
- **Đề xuất:** test POST webhook thật 3 kịch bản + 1 đơn thật end-to-end + đối soát bù; đối chiếu tài liệu SePay chính thức; theo dõi số GD/tháng, chuẩn bị nâng STARTUP. **Ưu tiên: Cao (P0).**

### 12. CRM — 6/10
- **Bằng chứng:** leads qua Worker API (validate + honeypot + rate-limit 5/giờ/IP + idempotency 24h); C-05-02 PASS live; CRM lib (đổi trạng thái, tương tác, audit) 23 test + leads 18 test PASS; trang admin CRM tồn tại.
- **Điểm mạnh:** chống trùng lead đã chứng minh live — điểm sáng duy nhất có bằng chứng live ở tầng ghi dữ liệu.
- **Điểm yếu:** **form Newsletter footer hỏng live (404)** — mất 1 kênh thu lead trên mọi trang (QA-18-FUNC-01); lần test C-05-02 `sheetSynced:false` (Sheet không nhận dòng test); đối soát lead DB–Sheet 14 ngày chưa chạy; chưa có lead thật nào từ form mới.
- **Rủi ro:** trung bình — lead có thể rơi rớt mà không biết nếu Sheet lệch.
- **Đề xuất:** nối route newsletter + test live; chạy đối soát lead 14 ngày; ghi rõ trạng thái Sheet sync trong dashboard admin. **Ưu tiên: Cao.**

### 13. Automation — 5/10
- **Bằng chứng:** email templates E1–E13 + Task 11 đã viết; trigger gamification server-side (cộng điểm theo tiến độ thật, 7 trigger, 4 hàm); token hủy đăng ký HMAC 90 ngày; cron thiết kế trong tài liệu.
- **Điểm mạnh:** trigger điểm/huy hiệu/streak chống gian lận tốt (client không tự ghi điểm).
- **Điểm yếu:** **Worker `index.ts` chỉ export `fetch`, không có handler `scheduled`** — cron giữ ấm + cron nhắc học chưa nối, chưa chạy ngày nào; email automation chưa gửi được cho học viên (Resend "Dùng tạm"); chưa có workflow backup tự động.
- **Rủi ro:** trung bình — Supabase có thể bị tạm dừng sau 7 ngày không dùng; học viên không nhận được email nhắc học/onboarding.
- **Đề xuất:** nối `scheduled()` hoặc GitHub Actions gọi health mỗi ngày; bật email onboarding sau khi có domain riêng. **Ưu tiên: Cao.**
- **Cập nhật đợt P0 11/11/2026 (~16:00):** route Newsletter/Unsubscribe/Resend-webhook đã nối + test live đạt (đăng ký 201, trùng 200, hủy sai token 400, webhook không chữ ký 401); 2 secret `UNSUBSCRIBE_SECRET`/`RESEND_WEBHOOK_SECRET` đã set; workflow keep-warm + backup đã viết sẵn (chưa chạy — chờ repo GitHub). Điểm 4→5.

### 14. AI Integration — 6/10
- **Bằng chứng:** AI Mentor chế độ tìm kiếm thông minh (không LLM, không bịa): 138 chunk (119 thư viện + 10 khóa + 9 triết lý), Postgres full-text + khớp không dấu, hiệu chuẩn staging ("An vui là gì?" → đúng; câu chứng khoán lãi 100% → bị lọc, trả "chưa tìm thấy"); Worker routes ask/sessions/feedback + rate-limit 20 câu/giờ/user + kiểm tra enrollment; UI chat + lịch sử + 6 câu gợi ý + disclaimer; test 345/345 Workers, 10 test lib web.
- **Điểm mạnh:** guardrails tốt (không bịa, lọc ngoài phạm vi, disclaimer y tế/pháp lý); không cần key AI vẫn chạy được.
- **Điểm yếu:** **chưa có key AI nào** nên nhánh LLM (gpt-4o-mini) chưa từng chạy thật; **trên prod route ask trả 502** (0029 chưa áp prod); chưa có adapter Gemini; chưa có trang admin xem phản hồi hữu ích/không hữu ích.
- **Rủi ro:** trung bình — quảng bá AI Mentor trên live trong khi tính năng chưa chạy được trên prod.
- **Đề xuất:** áp 0029 lên prod → hỏi thử 3 câu end-to-end bằng tài khoản thật; xin key LLM khi user sẵn sàng; thêm trang admin phản hồi. **Ưu tiên: Cao (gắn với áp migration prod).**

### 15. Security — 7/10
- **Bằng chứng:** H1–H4 đã vá + kiểm chứng live bị chặn; S-03 đã đóng trên staging (anon `lessons` 0 dòng); CSP/HSTS/X-Frame-Options/Permissions-Policy đo thật trên prod; RLS bật trên mọi bảng; probe anon đợt này: `profiles`/`orders`/`payments`/`enrollments` = 0 dòng cả prod + staging; community/gamification anon 401; không có secret hard-code trong `src/`.
- **Điểm mạnh:** tầng RLS + guard API làm đúng ở phần lớn bề mặt; kiểm chứng live có kỷ luật (probe anon lặp lại mỗi đợt).
- **Điểm yếu:** S-05 (middleware không verify chữ ký + cookie không HttpOnly), S-07 (anon INSERT `event_registrations`) còn mở; CSP còn `'unsafe-inline'`/`'unsafe-eval'`; Turnstile fail-open; kiểm thử 2 tài khoản chưa chạy lại trong đợt này (không có tài khoản test).
- **Rủi ro:** trung bình — còn S-05/S-07 và CSP chưa nonce-based.
- **Đề xuất:** sửa S-05/S-07; tạo tài khoản test + chạy lại kiểm thử 2 tài khoản; nâng CSP nonce-based. **Ưu tiên: Cao.**
- **Cập nhật đợt P0 11/11/2026 (~16:00):** **S-03 ĐÃ ĐÓNG trên prod** — 0028 áp prod HTTP 201, probe anon `lessons` = **0 dòng**. Điểm 6→7.

### 16. Performance — 7/10
- **Bằng chứng:** số Prompt 16 đo thật local (đối chiếu lại đợt này): trang chủ LCP 448–720ms, CLS 0, INP-proxy 24ms, TTFB 9–20ms — đạt mục tiêu; First Load JS shared 100 kB; font tự host; ảnh dưới fold đã lazy; 0 lỗi prerender.
- **Điểm mạnh:** bundle gọn, TTFB tốt, trang chủ đạt cả 3 chỉ số Core Web Vitals ở local.
- **Điểm yếu:** **LCP/CLS/INP trên live chưa từng đo** (máy thật/Lighthouse); CLS `/chuong-trinh` 0,56/0,17 chưa xác định được thật hay sai số đo VM; INP thật chưa đo (cần tương tác thật); lazy-load hầu như chưa có cho ảnh trên fold; chưa có đo lường hiệu năng liên tục.
- **Rủi ro:** trung bình — trải nghiệm mobile thật có thể chậm mà không biết.
- **Đề xuất:** đo Lighthouse trên máy thật (mobile + desktop) 1 lượt; đo lại CLS `/chuong-trinh` khi có dữ liệu thật. **Ưu tiên: Trung bình.**

### 17. SEO — 7/10
- **Bằng chứng:** metadata (title/description/canonical/OG/Twitter) cho mọi trang công khai qua 12 `layout.tsx`; sitemap 27 URL + robots live 200; JSON-LD Organization + ItemList 10 Course trong HTML tĩnh + Course trang chi tiết + FAQPage 9 câu + BreadcrumbList; mỗi trang đúng 1 h1; 0 ảnh thiếu alt; không đưa giá vào JSON-LD (giá chưa chốt — đúng).
- **Điểm mạnh:** nền tảng SEO kỹ thuật đầy đủ và đã kiểm chứng trong HTML tĩnh, không chỉ trong code.
- **Điểm yếu:** **chưa có bằng chứng index/lưu lượng thật** (Search Console, thứ hạng, click); GA4 + Meta Pixel đã viết code nhưng **chưa kích hoạt** (chưa có ID thật, component trả `null`, không tải script tracking); chưa có dữ liệu chuyển đổi.
- **Rủi ro:** thấp về kỹ thuật, trung bình về tăng trưởng (không đo được thì không tối ưu được).
- **Đề xuất:** gắn Search Console + GA4 (khi có ID) sau khi mở bán; theo dõi index 27 URL. **Ưu tiên: Trung bình.**

### 18. Analytics — 4/10
- **Bằng chứng:** ANALYTICS_CHECK: **9/12 chỉ số CÓ** (7 đầy đủ: học viên mới, học viên hoạt động, khóa học, tiến độ học, tỷ lệ hoàn thành, doanh thu, đơn hàng; 2 một phần: lượt đăng ký, thanh toán), **3 KHÔNG** (điểm quiz tổng hợp, email, **tỷ lệ chuyển đổi**); dashboard formulas 53 test PASS.
- **Điểm mạnh:** số liệu lấy từ Supabase thật, không bịa; dashboard có fallback + empty state.
- **Điểm yếu:** kiến trúc M12 (tổng hợp ở Workers + cache) **chưa implemented** — dashboard đọc trực tiếp Supabase bằng JWT admin; **tỷ lệ chuyển đổi xem → mua chưa có dữ liệu** (chưa có đơn thật); GA4/Pixel chưa bật; chưa có báo cáo R1–R10.
- **Rủi ro:** trung bình — quyết định kinh doanh đang chạy mù.
- **Đề xuất:** implement M12 + đối soát lead 14 ngày sau khi có đơn thật đầu tiên. **Ưu tiên: Trung bình.**

### 19. Scalability — 6/10
- **Bằng chứng:** kiến trúc serverless (Pages + Workers + Supabase Postgres 17) chịu tải theo nhu cầu; test 1047 PASS; không có stateful server tự quản; RLS + trigger xử lý ở tầng DB.
- **Điểm mạnh:** không có điểm nghẽn kiến trúc rõ ràng ở quy mô 100–1.000 học viên (mục tiêu đã nêu).
- **Điểm yếu:** **chưa từng load test**; các giới hạn miễn phí chưa được theo dõi tự động (Resend 100 email/ngày; Supabase tạm dừng sau 7 ngày không dùng; DB 500 MB / Storage 1 GB; SePay FREE 50 GD/tháng trên tài khoản dùng chung); video YouTube unlisted không chống tải (đã chấp nhận, QĐ 16).
- **Rủi ro:** trung bình — chạm giới hạn miễn phí giữa chừng mà không biết trước.
- **Đề xuất:** dashboard theo dõi 3 giới hạn chạm đầu tiên + cảnh báo; kế hoạch nâng gói theo QĐ 18 (Supabase Pro $25, Workers Paid $5, Resend Pro $20 — cần xác minh lại giá trước khi nâng). **Ưu tiên: Trung bình.**

### 20. Maintainability — 7/10
- **Bằng chứng:** tài liệu đầy đủ sau Prompt 19 (10 tài liệu: PROJECT_CONTEXT, ARCHITECTURE, DATABASE_SCHEMA, API_DOCUMENTATION, SECURITY_GUIDE, DEPLOYMENT_GUIDE, BACKUP_RECOVERY, ADMIN_GUIDE, STUDENT_GUIDE, ROADMAP); test 1047/1047 PASS; `check-migrations` động 319/319; monorepo npm workspaces rõ ràng; CHANGELOG/DECISIONS/PROJECT_AUDIT cập nhật đều.
- **Điểm mạnh:** tài liệu + test là điểm mạnh nhất của dự án so với mặt bằng; quy trình QA có kỷ luật (probe anon lặp lại, không bịa số).
- **Điểm yếu:** **chưa có remote GitHub, chưa có CI, chưa có branch protection** (git remote trống; code GĐ2 chỉ commit local ở cuối đợt này, không push được do quyền App bị chặn); nhiều agent build song song chung `.next` đã gây lỗi giả 3 lần (cần cửa sổ yên); dead code CSS mới dọn 1 phần (QĐ 12); 2 agent song song từng đặt trùng số migration (0029) — quy trình đánh số cần 1 nguồn duy nhất.
- **Rủi ro:** trung bình — mất code / không rollback được nếu VM lỗi trước khi push; lỗi build giả làm chậm release.
- **Đề xuất:** tạo remote GitHub private + push + CI xanh + branch protection (ROADMAP tuần 1–2, cần user); quy tắc 1 agent build tại 1 thời điểm. **Ưu tiên: Cao.**

---

## 2. 10 vấn đề nghiêm trọng nhất

| # | Vấn đề | Mức | Bằng chứng |
|---|---|---|---|
| 1 | **S-03 còn mở trên PROD** — 0028 chưa áp prod; anon đọc được dòng `lessons` | Cao | QA_REPORT §5.1: prod anon `lessons` 5 dòng (content hiện 0 ký tự) |
| 2 | **SePay chưa từng chạy thật** — webhook POST live, đơn thật, đối soát đều chưa có | Cao | QA_REPORT §4; PROJECT_AUDIT §3 |
| 3 | **Migrations GĐ2 (0025–0031) chưa áp prod** — AI Mentor 502 live, 4 module mới chưa chạy trên prod | Cao | QA_REPORT §5.1: toàn bộ bảng GĐ2 404 trên prod |
| 4 | **Email thật cho học viên chưa gửi được** (Resend "Dùng tạm") + webhook Resend + cron chưa nối | Cao | QA_REPORT §4; Worker chỉ có 5 secret cũ |
| 5 | **Form Newsletter footer hỏng live (404)** | Trung bình | QA_REPORT §8.1 QA-18-FUNC-01: POST live → 404 `not_found` |
| 6 | **Chưa có E2E live toàn luồng bằng tài khoản thật** — 8/11 bước journey "chưa kiểm chứng" | Trung bình | QA_REPORT §7 |
| 7 | **Chưa có remote GitHub / CI / backup thật** — code chỉ ở local + VM | Trung bình | `git remote -v` trống; chưa từng restore thử |
| 8 | **S-05 + S-07 còn mở** (middleware không verify JWT; anon INSERT `event_registrations`) | Trung bình | SECURITY_REPORT; QA_REPORT §5.3 |
| 9 | **Chưa có giá thật cho khóa trả phí** — không test được mua thật, không đo chuyển đổi | Trung bình | QĐ 11 Task 03 ("Tùy tâm/0đ tới khi user cung cấp giá") |
| 10 | **LCP/CLS/INP trên live chưa từng đo; analytics chuyển đổi chưa có** | Trung bình | QA_REPORT §6; ANALYTICS_CHECK 3/12 thiếu |

## 3. 10 cơ hội cải tiến lớn nhất

| # | Cơ hội | Tác động kỳ vọng |
|---|---|---|
| 1 | Đóng P0 (0028 lên prod + SePay thật + email domain) rồi mở bán khóa trả phí đầu tiên | Mở được dòng tiền — giá trị lớn nhất, chặn mọi thứ khác |
| 2 | E2E live toàn luồng bằng tài khoản thật (lần đầu có bằng chứng thật cho 8 bước journey) | Biết chắc sản phẩm chạy được cho người thật, không chỉ test mock |
| 3 | Nối route Newsletter/Unsubscribe/Resend-webhook + đối soát lead 14 ngày | Khôi phục kênh thu lead trên mọi trang + tin được số lead |
| 4 | Bật GA4 + Search Console + analytics chuyển đổi (M12) | Lần đầu đo được xem → mua; quyết định dựa trên số thật |
| 5 | Đo Lighthouse/LCP trên máy thật + sửa CLS `/chuong-trinh` | Biết tốc độ thật trên mobile trước khi chạy quảng cáo |
| 6 | Skeleton + trạng thái lỗi có retry cho các trang tải client-side | Giảm cảm giác "trang hỏng" trên mạng yếu; tăng giữ chân |
| 7 | Nâng CSP lên nonce-based + sửa S-05/S-07 | Đóng 2 lỗ trung bình còn lại; tăng tin cậy trước khi quảng bá rộng |
| 8 | Cron giữ ấm + nhắc học + backup tự động + restore thử | Chống tạm dừng Supabase; chống mất dữ liệu; học viên được nhắc học |
| 9 | Hoàn thiện admin còn thiếu (blog, 11D tổng hợp, báo cáo R1–R10) | Admin tự vận hành được mà không cần agent sửa code mỗi lần |
| 10 | Nội dung thật cho khóa 04/05/06 + văn bản 11D/AI Mentor của user (thay bản agent soạn) | Khóa học bán được bằng nội dung thật, không còn đoạn tạm |

## 4. 10 tính năng ROI cao nhất

| # | Tính năng | Vì sao ROI cao |
|---|---|---|
| 1 | **Thanh toán SePay chạy thật end-to-end** (webhook + đơn thật + đối soát) | Không có nó thì không có doanh thu — ROI vô hạn so với chi phí 1 buổi test |
| 2 | **Áp migrations GĐ2 lên prod** (0025–0031) | 4 module đã xây xong chỉ cần 1 lần áp là chạy — chi phí thấp, giá trị cao |
| 3 | **Email domain riêng + onboarding/chăm sóc tự động** | Kênh nuôi dưỡng sau đăng ký; giữ học viên quay lại học |
| 4 | **Nối route Newsletter** | 1 route, sửa trong 1 buổi, khôi phục kênh lead toàn trang |
| 5 | **Analytics chuyển đổi (M12)** | Biết kênh nào ra đơn để dồn ngân sách đúng chỗ |
| 6 | **AI Mentor chạy được trên prod (sau 0029) + hỏi thử 3 câu thật** | Tính năng khác biệt đã xây xong, chỉ chờ áp migration |
| 7 | **Cộng đồng chạy được trên prod (sau 0030) + 1 bài đăng thật đầu tiên** | Cộng đồng là lý do học viên ở lại + giới thiệu người mới |
| 8 | **Gamification chạy được trên prod (sau 0031) — điểm/huy hiệu thật đầu tiên** | Tăng hoàn thành khóa bằng chi phí gần 0 (trigger đã có) |
| 9 | **11D lưu kết quả trên prod (sau 0027) + trang admin tổng hợp** | Biến công cụ tự đánh giá thành dữ liệu tư vấn bán khóa |
| 10 | **Trang admin blog + đăng bài thật** | Blog là kênh SEO/traffic dài hạn; hiện phải nhờ agent sửa code mới có bài mới |

## 5. Điểm nghẽn

### 5.1 Điểm nghẽn công nghệ
1. **Nghiệm thu staging → áp prod là nút cổ chai thủ công duy nhất:** 7 migration (0025–0031) chờ user nghiệm thu; không có CI/CD tự động, không có staging deploy tách biệt rõ ràng với prod; mỗi lần áp đều làm tay qua Management API.
2. **VM Chromium không TLS được ra ngoài** — mọi kiểm chứng render/E2E bằng trình duyệt trong VM đều kẹt ở dữ liệu client-side; phải dựa vào browser-task của parent cho kiểm chứng thật.
3. **Build song song chung `.next`** đã gây lỗi giả 3 lần (ENOENT); quy trình "cửa sổ yên" là giải pháp tạm, chưa có giải pháp kỹ thuật (thư mục build riêng/CI).
4. **Không có remote/CI** — không rollback tập thể, không kiểm tra tự động trước khi merge.
5. **Worker thiếu `scheduled`** — mọi tác vụ định kỳ (giữ ấm, nhắc học, backup, đối soát) đều chưa có chỗ chạy.

### 5.2 Điểm nghẽn kinh doanh
1. **Chưa có giá thật** — không định giá được, không test được mua thật, không đo chuyển đổi; mọi quyết định CRO đều là giả định.
2. **Chưa có đơn thật nào** — không có bằng chứng thị trường (người ta có trả tiền không), không có testimonial trả phí.
3. **Email chưa tới được học viên** — mất kênh nuôi dưỡng sau đăng ký; onboarding hoàn toàn thủ công (Zalo).
4. **Nội dung khóa 04/05/06 còn tạm + văn bản 11D/AI Mentor là bản agent soạn** — sản phẩm chưa đủ "thật" để bán giá cao.
5. **Phụ thuộc vào 1 người (user) cho mọi nghiệm thu/quyết định** — các việc P0 đều chờ user (nghiệm thu staging, cung cấp giá, đổi URL webhook SePay, chuyển khoản test, mua domain).

## 6. Kế hoạch 90 ngày tiếp theo

Đối chiếu `docs/ROADMAP.md` (Prompt 19) — kế hoạch dưới đây **giữ nguyên khung ROADMAP và bổ sung** các việc phát hiện trong QA/kiểm toán cuối này (đánh dấu **[MỚI]**). Mốc tính từ 11/11/2026.

### Tuần 1–2 (ngày 1–14): P0 — Chặn mở bán
| # | Việc | Điều kiện xong |
|---|---|---|
| 1 | Tạo remote GitHub private + push toàn bộ code (kể cả commit cuối GĐ2 này) + bật branch protection + CI xanh | `git remote -v` có remote; CI xanh trên 1 PR thử |
| 2 | User nghiệm thu staging cho 0025–0031, rồi áp migrations lên prod theo thứ tự (backup prod trước mỗi lần áp) — **ưu tiên 0028 (S-03)** | Probe anon prod: `lessons` 0 dòng; `master_library_items` 119; AI Mentor ask hết 502; cộng đồng/thành tích/11D-lưu chạy được trên prod |
| 3 | **[MỚI]** Nối route `POST /api/v1/newsletter` (+ `unsubscribe`, `webhooks/resend`) vào Worker + deploy + test live (QA-18-FUNC-01) | Đăng ký newsletter live → 201; trùng email → không trùng dòng; hủy đăng ký bằng token → 200 |
| 4 | Test POST webhook SePay thật (đúng → 200 + đơn `paid`; sai → 401; replay → không trùng đơn) | Có biên bản test webhook thật; user đổi URL webhook trong SePay |
| 5 | 1 đơn thật end-to-end: tạo đơn → chuyển khoản thật → webhook → enrollment → email | Đơn `paid` → enrollment → học viên vào học được; đối soát khớp |
| 6 | Đối soát bù qua SePay API v2 + nút "Kiểm tra thanh toán" (cần set `SEPAY_API_TOKEN`, `SEPAY_BANK_ACCOUNT_ID`) | Đối soát bù chạy được 1 lần thật |
| 7 | **[MỚI]** Tạo 3 tài khoản test dùng chung (admin/student/instructor), ghi lại ở nơi an toàn (không ghi vào repo) | Có 3 tài khoản; chạy lại kiểm thử 2 tài khoản |

### Tuần 3–4 (ngày 15–30): P1 — Tin cậy
| # | Việc | Điều kiện xong |
|---|---|---|
| 8 | Email domain riêng: mua domain → SPF/DKIM/DMARC → set `RESEND_FROM_EMAIL` → gửi thử 1 email thật cho học viên | Học viên nhận được email thật; webhook Resend cập nhật `delivered` |
| 9 | Turnstile thật: site key + secret, form lead chặn spam thật | Token sai → 400; token đúng → 201 |
| 10 | Middleware verify chữ ký JWT + cân nhắc cookie HttpOnly (S-05); sửa S-07 (drop anon INSERT `event_registrations` hoặc ghi quyết định giữ lại) | JWT giả → chặn ngay ở middleware; probe anon INSERT bị chặn (hoặc có quyết định bằng văn bản) |
| 11 | Backup tự động + **restore thử lần đầu lên staging** (ghi biên bản đếm dòng) | File backup đầu tiên có trên R2 + repo riêng; biên bản restore khớp số dòng |
| 12 | Cron giữ ấm + nhắc học: nối `scheduled()` trong Worker hoặc GitHub Actions gọi health mỗi ngày | Log cron chạy 7 ngày liên tiếp |
| 13 | **[MỚI]** Chốt 3 quyết định văn bản còn mở: tên cũ (QA-18-UI-01), fallback offline Thư viện (QA-18-UI-02), policy công khai `ai_knowledge_chunks` (QA-18-SEC-02) | Có quyết định ghi vào DECISIONS.md + sửa (nếu chốt sửa) |

### Tháng 2 (ngày 31–60): P1 — Đo lường + sửa tồn đọng
| # | Việc | Điều kiện xong |
|---|---|---|
| 14 | Đo LCP / Lighthouse trên máy thật (mobile + desktop) — lần đầu có số thật | Có số LCP/FCP/CLS/INP thật; danh sách tối ưu theo số đo |
| 15 | Analytics tỷ lệ chuyển đổi (M12) + đối soát lead 14 ngày | Có tỷ lệ chuyển đổi xem → mua; báo cáo đối soát khớp 14 ngày liên tiếp |
| 16 | Sửa tồn đọng bảo mật thấp: S-06, S-12, S-13, S-16, S-17, S-08 | Từng mục có kiểm chứng (test + probe) sau khi sửa |
| 17 | Nâng CSP lên nonce-based (bỏ `'unsafe-inline'`/`'unsafe-eval'`) | Header CSP mới đo thật trên prod, trang vẫn render đủ |
| 18 | Hoàn thiện admin: blog, sự kiện, tổng hợp 11D, báo cáo R1–R10 | Từng trang kiểm chứng bằng tài khoản admin thật |
| 19 | Nội dung thật cho khóa 04/05/06 + văn bản 11D/AI Mentor của user | User gửi văn bản; thay wholesale |
| 20 | **[MỚI]** Skeleton + retry cho các trang tải client-side; kiểm tra accessibility (axe) 1 lượt | Không còn trang "Đang tải…" trơ trọi; báo cáo a11y có danh sách lỗi/sửa |

### Tháng 3 (ngày 61–90): P2 — QA toàn luồng + mở bán
| # | Việc | Điều kiện xong |
|---|---|---|
| 21 | QA E2E live toàn luồng bằng tài khoản thật: mới → đăng ký → đăng nhập → mua → học → hoàn thành → chứng nhận → hỗ trợ | Biên bản E2E từng bước PASS/FAIL; lỗi sửa + kiểm chứng lại |
| 22 | Kiểm thử trình duyệt đã đăng nhập trên live: 11D lưu + so sánh; AI Mentor 3 câu; cộng đồng đăng/bình luận/cảm xúc/báo cáo + kiểm duyệt; học xong 1 bài thật → +10 điểm + huy hiệu | Biên bản kiểm chứng live từng luồng |
| 23 | **[MỚI]** 1 kịch bản instructor thật: gán khóa → xem học viên → chấm 1 bài tập | Có biên bản; viết hướng dẫn instructor 1 trang |
| 24 | Mở bán thật (khi P0 + P1 xong): khóa trả phí đầu tiên có content thật + giá thật | Có đơn thật đầu tiên từ học viên thật (không phải test); đối soát khớp |
| 25 | Chuẩn bị mở rộng: theo dõi 3 giới hạn chạm đầu tiên; kế hoạch nâng gói khi chạm giới hạn (QĐ 18) | Có số liệu dùng thật theo tuần; quyết định nâng gói dựa trên số thật |

---

## 7. Rủi ro còn lại nếu mở bán ngay (không chờ P0)

| # | Rủi ro | Hậu quả |
|---|---|---|
| R-01 | Bán khóa có content thật khi S-03 còn mở trên prod | Nội dung trả phí bị đọc miễn phí qua REST anon |
| R-02 | Webhook SePay sai thuật toán/chữ ký thật | Từ chối mọi webhook thật → thu tiền nhưng không cấp quyền học |
| R-03 | Hết 50 GD SePay FREE giữa tháng (tài khoản MB dùng chung) | Mất giao dịch / phải nâng gói gấp |
| R-04 | Email không tới học viên sau khi mua | Học viên trả tiền nhưng không nhận được hướng dẫn vào học |
| R-05 | AI Mentor/Cộng đồng/Gamification quảng bá nhưng 502/chưa chạy trên prod | Học viên thất vọng, mất tin cậy ngay lần đầu dùng |
| R-06 | Không có backup/restore thật | Sự cố DB = mất dữ liệu không khôi phục được |

---

*Kiểm toán cuối này không sửa code. Mọi điểm số đều gắn bằng chứng (lệnh đã chạy / probe live / file đã đọc) như ghi trong từng mục; chỗ nào chưa đo/chưa kiểm chứng đều ghi rõ. Không chứa secret/key/token nào.*
