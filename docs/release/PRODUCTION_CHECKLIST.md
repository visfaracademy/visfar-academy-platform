# Production Checklist — Visfar Academy (Task 12)

- **Ngày:** 10–11/11/2026 (phiên kiểm chứng 23:41 +07 10/11 → 00:xx +07 11/11)
- **Phạm vi:** toàn bộ nền tảng `workspace/visfar-academy-platform` (Next.js `apps/web`, Workers `workers/api`, Supabase migrations 0001–0019).
- **Nguyên tắc verdict (theo nhiệm vụ Task 12, thắng quy tắc auto-duyệt):** **KHÔNG phát hành nếu còn lỗi bảo mật nghiêm trọng hoặc chưa kiểm thử luồng thanh toán và quyền truy cập.**

## 1. Kết quả kiểm chứng (tóm tắt)

| Hạng mục | Kết quả | Nguồn |
|---|---|---|
| Unit test `apps/web` | 546/548 PASS (snapshot 00:01 +07 11/11); hiệu lực 547/548 sau khi 1 lỗi được sửa thật; còn **1 test đỏ G-T10-3b** (assertion lỗi thời, cần cập nhật) | `docs/release/TEST_REPORT.md` §2.1 |
| Typecheck `apps/web` | PASS (exit 0) | TEST_REPORT §2.2 |
| Lint `apps/web` | PASS (exit 0) | TEST_REPORT §2.3 |
| Build `apps/web` | PASS (exit 0), 31/31 trang tĩnh | TEST_REPORT §2.4 |
| Test Workers API | **CHƯA CHẠY trong phiên QA**; Security ghi `tsc` Workers **FAIL exit 2** (trùng field `Env`, lỗi test-only) và vitest Workers biến động theo thời gian (code đang đổ về) | SECURITY_REPORT §5, S-10 |
| Bảo mật | **RLS FAIL** — S-03 (nội dung bài trả phí lộ qua REST anon, **live trên staging**), S-01 (tiềm ẩn, tự mở lại tài khoản bị disable sau khi áp 0017), S-02 (3 file cùng số 0017) | `docs/release/SECURITY_REPORT.md` |
| Analytics | 9/12 chỉ số CÓ (7 đầy đủ + 2 một phần), **3 KHÔNG** (điểm quiz tổng hợp, email, tỷ lệ chuyển đổi) | `docs/release/ANALYTICS_CHECK.md` |
| Performance | LCP **CHƯA ĐO** — Chrome headless bị chặn bởi chính sách WebGL domain của môi trường; TTFB localhost đo thật (`/` 18,5 ms cold / 2,5 ms warm); bundle shared 100 kB, trang 172–187 kB; lazy loading hầu như chưa có (0 `next/image`, chỉ 1 `loading="lazy"`); video chỉ tải khi mở bài học | `docs/release/PERFORMANCE_REPORT.md` |
| Workers API deploy | **CHƯA DEPLOY** — code xong, test local PASS, thiếu Cloudflare token | Báo cáo Workers API 11/11/2026 |
| Thanh toán live | **CHƯA TEST** — không có route webhook SePay, không có `SEPAY_WEBHOOK_SECRET`, chưa có đơn/thanh toán thật | SECURITY_REPORT S-11; TEST_REPORT §3.10 |
| Backup tự động | **CHƯA CÓ** — chưa có workflow backup, chưa từng restore thử | `docs/release/BACKUP_RESTORE_GUIDE.md` |

## 2. Checklist phát hành

### 2.1. Code & build — ✅ ĐẠT (với 1 lưu ý)

- [x] `npm test` apps/web chạy được, 547/548 test pass (hiệu lực)
- [x] `npm run typecheck` PASS
- [x] `npm run lint` PASS
- [x] `npm run build` PASS, 31/31 trang
- [ ] **Cập nhật `payments.test.ts` G-T10-3b** thành khẳng định dương rồi chạy lại `npm test` tới exit 0
- [ ] Chạy test Workers API (`workers/api`: vitest + tsc) tới PASS — hiện `tsc` FAIL
- [ ] Thống nhất cấu hình lint giữa `eslint .` và lint trong `next build` (B-T12-1)

### 2.2. Database & migration — ❌ CHƯA ĐẠT

- [x] Staging + prod đã chạy migration 0001→0016 (0008 fix FK, 0009/0010 vá bảo mật, 0011–0013 LMS, 0014–0016 quiz/assignment/certificate)
- [x] **Sửa trùng số migration: ĐÃ SỬA trong phiên** — các file 0017 trùng nhau đã được đánh lại số duy nhất 0017–0021 (`0017_email_unsubscribe_logs`, `0018_email_task11`, `0019_commerce_payment`, `0020_lead_interactions`, `0021_admin_user_disable`); `node scripts/check-migrations.mjs` → **OK: tất cả kiểm tra đều PASS** (kiểm chứng lại 11/11/2026 ~00:35 +07)
- [x] **Áp migration 0017–0021 lên staging (11/11/2026 ~07:38 +07, HTTP 201 cả 5 file, kiểm chứng PASS) rồi lên prod (11/11/2026 ~08:03 +07, HTTP 201 cả 5 file, kiểm chứng PASS: 41 bảng, RLS 41/41, đủ cột mới, `orders.user_id` SET NULL, trigger `trg_sync_profiles_role` còn nguyên, courses=10)**
- [x] **Vá S-01 (11/11/2026): migration 0022 `0022_block_student_self_disable.sql` — trigger `trg_profiles_block_disable_change` chặn non-admin UPDATE `is_disabled`/`disabled_at`/`disabled_reason` (RAISE P0001); KHÔNG dùng REVOKE vì admin vô hiệu hóa/mở lại bằng JWT admin trực tiếp qua `setUserDisabled()` (REVOKE sẽ phá luồng này). Chặn đăng nhập khi bị disable ở `middleware.ts` (REST check `is_disabled`, logout + redirect `/dang-nhap?reason=disabled`) + layout `/hoc-vien`. 0022 đã áp staging HTTP 201, kiểm chứng live PASS (student PATCH `is_disabled` → 400 P0001; PATCH `full_name` → 204; tài khoản disable → GET `/hoc-vien` 307 về đăng nhập, refresh token bị thu hồi). 0022 CHƯA áp prod — còn chờ áp prod sau khi staging PASS.**
- [ ] Chốt QĐ 4 (S-03): thu hẹp đường đọc bảng `lessons` (view `lessons_public` làm đường công khai) rồi kiểm chứng lại bằng probe anon — **đã vá 1 phần ngày 11/11/2026 (xem §2.3 S-03): app đã chuyển sang `lessons_public`, nhưng REST anon đọc trực tiếp bảng `lessons` vẫn lộ `content` bài trả phí — cần migration RLS riêng, chưa làm**

### 2.3. Bảo mật — ❌ CHƯA ĐẠT (lỗi chặn)

- [x] H1–H4 (Task 06) đã vá bằng 0009 và kiểm chứng live bị chặn (L-01→L-03)
- [x] Không lộ service-role key/JWT/secret hard-code trong `src/`; không SQL injection; không XSS qua `innerHTML`
- [ ] **S-03 (CAO, live — ĐÃ VÁ 1 PHẦN ngày 11/11/2026, chưa đóng hoàn toàn):** app đã chuyển `fetchStructureRows()`/`buildCourseDetail()` sang view `lessons_public` (kiểm chứng live staging: qua view chỉ trả metadata, xin `content` → 42703; `npm test` apps/web 589/589, typecheck PASS). **Còn mở:** REST anon đọc trực tiếp bảng `lessons` vẫn trả đủ `content` bài 2 trả phí (269 ký tự) — cần migration RLS riêng siết policy `lessons_select_public`, rồi kiểm chứng lại probe anon. Tác dụng phụ: bài xem thử không còn phát video qua đường đọc trực tiếp — cần quyết định riêng cho route preview trả `video_url` của bài `is_free_preview=true`. Không tuyên bố S-03 đã đóng cho tới khi migration RLS xong.
- [x] **S-01 (CAO — ĐÃ VÁ ngày 11/11/2026, staging PASS, 0022 chưa áp prod):** migration 0022 trigger chặn student tự sửa `is_disabled`/`disabled_at`/`disabled_reason` + chặn đăng nhập ở middleware/layout `/hoc-vien`. Kiểm chứng live staging PASS (xem §2.2). Lưu ý: không dùng REVOKE (phá luồng admin JWT).
- [x] **S-02 (CAO, quy trình):** đổi số 3 file 0017 trùng nhau — đã sửa, check-migrations PASS (22 file sau khi thêm 0022)
- [ ] Thêm CSP (+ `frame-ancestors 'self'`) vào `next.config.ts`, kiểm chứng header thật trên domain deploy (S-04)
- [ ] Sửa S-07: drop policy anon INSERT `event_registrations` (hoặc ghi quyết định giữ lại có chủ đích)
- [ ] Kiểm thử live 2 tài khoản test mới (tạo qua Supabase Dashboard/Auth Admin API, ghi lại tài khoản dùng chung): A đọc dữ liệu B; A thử update `role`/`is_disabled`; A INSERT `enrollments`/`lesson_progress`/`orders`/`payments`; anon INSERT `leads`/`event_registrations`; B nộp quiz khi chưa ghi danh; kiểm tra `lessons` anon sau khi sửa S-03
- [ ] Follow-up (không chặn mở thử nghiệm nội bộ): verify chữ ký JWT ở middleware + cân nhắc cookie HttpOnly (S-05); rate-limit cho route Next.js; chốt mâu thuẫn SELECT `payments` (S-08); đổi `current_role()` sang đọc `user_roles` (S-17)

### 2.4. Thanh toán — ❌ CHƯA ĐẠT (lỗi chặn)

- [ ] Nối route webhook SePay + Resend vào Workers `index.ts` (hiện chỉ có `leads`/`progress`/`health`)
- [ ] Bổ sung `SEPAY_WEBHOOK_SECRET` qua Workers Secrets
- [ ] **Xác nhận thuật toán/header chữ ký SePay từ tài liệu chính thức SePay** (code hiện tại tự ghi rõ là giả định chưa xác nhận)
- [ ] Test webhook SePay thật (ký, trùng lặp, sai số tiền, cấp quyền sau thanh toán) — không dùng tiền thật, không tạo đơn prod thật
- [ ] Kiểm thử end-to-end: tạo đơn → thanh toán → webhook → đối soát → cấp quyền học (11 bước theo Task 10)
- [ ] **Phê duyệt riêng trước khi triển khai live thanh toán** (yêu cầu Task 10, thắng auto-duyệt)

### 2.5. Workers API & tích hợp — ❌ CHƯA ĐẠT

- [x] Code Workers API xong (`POST /api/v1/leads`, `POST /api/v1/progress`, `GET /api/health`), test local PASS
- [ ] **Deploy Workers API** — cần Cloudflare API token (hiện thiếu)
- [ ] Sau khi deploy: kiểm thử lead thật trên staging (201 + dòng mới trong `leads` + ghi Sheet), ghi tiến độ sau quiz (B-T08-5) end-to-end
- [ ] Cấu hình Turnstile site key + secret (hiện fail-open theo QĐ 13 — chỉ còn rate-limit 5/giờ/IP + honeypot)
- [ ] Cấu hình Resend domain + xác minh DNS SPF/DKIM/DMARC trước khi gửi email thật

### 2.6. Email — ⚠️ CHƯA ĐỦ ĐIỀU KIỆN GỬI THẬT

- [x] 21/21 test email pass (15 template E1–E13 + 2 mẫu Task 11); unsubscribe 6/6 pass
- [ ] Xác minh DNS SPF/DKIM/DMARC của domain gửi (chưa làm)
- [ ] Kiểm thử gửi email thật trên staging (ít nhất 1 email giao dịch + 1 email marketing, kiểm tra `email_logs`)
- [ ] Áp migration 0018/0017 email lên staging rồi prod; kiểm chứng webhook Resend (Svix) sau khi nối route

### 2.7. Analytics — ⚠️ THIẾU 3 CHỈ SỐ

- [x] 7 chỉ số đầy đủ: học viên mới, học viên hoạt động, khóa học, tiến độ học, tỷ lệ hoàn thành, doanh thu, đơn hàng
- [ ] Bổ sung: điểm quiz tổng hợp, email (gửi/delivered/bounced/failed), tỷ lệ chuyển đổi (cần chốt định nghĩa mẫu số + cách nối lead→đơn)
- [ ] Kiểm chứng live `/admin` bằng JWT admin thật, đối chiếu từng thẻ với DB

### 2.8. Performance — ⚠️ LCP CHƯA ĐO

- Xem `docs/release/PERFORMANCE_REPORT.md`.
- **LCP ≤ 2,5s: CHƯA ĐO** — Chrome headless không khởi động được trong môi trường này (lỗi `Hatch WebGL domain policy is required for browser startup`). Cần đo Lighthouse thật trên môi trường cho phép Chrome chạy, cả desktop và mobile.
- Đã đo thật: TTFB localhost `/` 18,5 ms (cold) / 2,5 ms (warm), `/chuong-trinh` 3,7 ms (chỉ là thời gian server, không phải LCP).
- Bundle: First Load JS shared 100 kB, các trang 172–187 kB — mức vừa phải.
- Lazy loading hầu như chưa có (0 `next/image`, chỉ 1 `loading="lazy"` trong 5 thẻ `<img>`) — việc cải thiện, không chặn.
- Video: YouTube chỉ tải khi mở trang bài học — đạt.
- Trạng thái lỗi/phục hồi: có ở nhiều trang (kiểm chứng tĩnh).
- Responsive + console JS: chưa kiểm tra trên trình duyệt thật.

### 2.9. Vận hành & phát hành — ❌ CHƯA ĐẠT

- [ ] Tạo repo GitHub private + push code (hiện chỉ 1 commit `54b6321`, **~125 thay đổi chưa commit**)
- [ ] Viết `.github/workflows/deploy.yml` (hiện chỉ có `ci.yml`); bật branch protection cho `main`
- [ ] Tạo workflow backup hàng ngày (GitHub Actions → R2 + repo backup riêng private); chạy thành công ít nhất 1 lần
- [ ] **Restore thử lần đầu lên staging** và ghi biên bản (đếm dòng `courses` = 10, `policies` = 4, đối chiếu `leads`/`profiles`/`orders`/`enrollments`)
- [ ] Cron giữ ấm `GET /api/health` hàng ngày (chống tạm dừng Supabase sau 7 ngày)
- [ ] Chốt domain production + API domain (`visfaracademy.netlify.app` — cần xác minh cách gắn vào Workers/Cloudflare)
- [ ] Chốt kênh cảnh báo dự phòng khi Resend hết quota
- [ ] Bổ sung báo cáo Task 09–11 vào `docs/frontend/` (hiện không tồn tại — QA sau không có đầu vào đầy đủ)
- [ ] Kiểm thử PDF thật (mở/render/tải file PDF, phân quyền) và phát video thật (YouTube embed, % xem) — hiện cả hai đều chưa có kiểm thử thực chất

## 3. Lỗi chặn phát hành (blocking issues)

| # | Lỗi | Mức | Bằng chứng |
|---|---|---|---|
| B1 | **S-03: nội dung bài học trả phí lộ qua REST anon** (live trên staging) | CAO — bảo mật | SECURITY_REPORT §3, S-03; probe anon `lessons?is_free_preview=false` → 200, trả đủ `content` bài 2 |
| B2 | **Luồng thanh toán chưa kiểm thử live** — không có route webhook SePay, không có `SEPAY_WEBHOOK_SECRET`, thuật toán chữ ký SePay chưa xác nhận từ tài liệu chính thức, Workers chưa deploy | CHẶN — thanh toán | SECURITY_REPORT S-11; TEST_REPORT §3.10, B-T12-6; báo cáo Workers API (chưa deploy, thiếu Cloudflare token) |
| B3 | **Quyền truy cập chưa kiểm thử live đầy đủ trong đợt này** — kiểm thử 2 tài khoản test chưa chạy lại; middleware không verify chữ ký JWT (S-05); S-01 tiềm ẩn sau khi áp 0017 | CHẶN — quyền truy cập | SECURITY_REPORT §6–§7; TEST_REPORT §4 (cột Live = CHƯA ở mọi lĩnh vực) |
| B4 | ~~3 file migration cùng số 0017~~ — **ĐÃ SỬA trong phiên**: đánh lại số duy nhất 0017–0021, `check-migrations.mjs` PASS (kiểm chứng 11/11/2026 ~00:35 +07) | Đã sửa — không còn chặn |
| B5 | **Workers API chưa deploy** (thiếu Cloudflare token) — form lead vẫn fallback Apps Script; ghi tiến độ sau quiz vẫn lỗi hiển thị | CHẶN — tích hợp | Báo cáo Workers API 11/11/2026; TEST_REPORT B-T08-5 |
| B6 | **`tsc` Workers FAIL** (trùng field `Env`, lỗi test-only) — Workers chưa đủ điều kiện build | Trung bình–Cao | SECURITY_REPORT S-10 |
| B7 | **Chưa có backup tự động, chưa từng restore thử** — mất DB = mất toàn bộ lead/học viên/đơn hàng | CAO — vận hành | BACKUP_RESTORE_GUIDE.md §5 |
| B8 | Chưa có repo GitHub remote, ~125 thay đổi chưa commit, chưa có `deploy.yml` | Trung bình — phát hành | TEST_REPORT §0, §5; DEPLOYMENT_GUIDE §2.1 |

## 4. VERDICT

# ❌ CHƯA ĐẠT ĐỂ PHÁT HÀNH

**Cập nhật 11/11/2026 ~08:10 +07 (sau đợt vá S-01/S-03 + áp migration prod):** B2 (thanh toán) đã ĐÓNG — test end-to-end thật 2.000đ PASS (đơn `DH-2026-000004` → `paid` → cấp quyền học, webhook SePay HMAC PASS). B5 (Workers) đã ĐÓNG — Worker `api` live, health 200, Pages live. B4 đã ĐÓNG. S-01 đã vá + kiểm chứng staging PASS (0022 chưa áp prod). **Còn mở nên verdict vẫn CHƯA ĐẠT:** B1/S-03 chỉ vá 1 phần (REST anon đọc trực tiếp bảng `lessons` vẫn lộ `content` bài trả phí — cần migration RLS riêng); B7 (chưa backup/restore); B8 (GitHub push đang chặn 403 — App chưa có quyền ghi, 0 file đã push); email thật chưa gửi được cho học viên (user chốt "Dùng tạm", chưa mua domain — xem DECISIONS.md mục 14 Task 02).

Hệ thống **chưa đủ điều kiện phát hành cho người dùng thật**. Code biên dịch được, build được, 547/548 test unit đạt — nhưng còn **lỗi bảo mật nghiêm trọng đang live (B1: nội dung bài trả phí lộ qua REST anon)**, **luồng thanh toán chưa hề được kiểm thử live (B2)**, **quyền truy cập chưa kiểm thử live đầy đủ trong đợt này (B3)**, Workers chưa deploy (B5), và chưa có backup/restore (B7). Theo quy tắc Task 12, chỉ riêng B1 + B2 + B3 đã đủ để kết luận CHƯA ĐẠT. (Lỗi trùng số migration B4 đã được sửa trong phiên — xem §2.2.)

**Được phép làm tiếp (không phải phát hành production):** mở thử nghiệm nội bộ trên staging sau khi vá B1 + B4 (và vá S-01 trước khi áp file 0017 disable), với dữ liệu test, không thu tiền thật, không gửi email thật cho người dùng thật.

**Điều kiện tối thiểu để đổi verdict sang ĐẠT:**
1. Vá + kiểm chứng lại live: S-03 (B1), S-01 (trước khi áp 0017), S-02 (B4).
2. Deploy Workers API + nối route webhook SePay/Resend + bổ sung `SEPAY_WEBHOOK_SECRET` + xác nhận chữ ký SePay từ tài liệu chính thức + test webhook thật (B2, B5).
3. Kiểm thử live 2 tài khoản test (quyền truy cập, B3) + kiểm thử end-to-end thanh toán (B2).
4. `npm test` exit 0 (cập nhật G-T10-3b) + `tsc` Workers PASS (B6).
5. Backup tự động chạy thành công + restore thử lần đầu lên staging có biên bản (B7).
6. Push code lên GitHub + `deploy.yml` + chốt domain (B8).
7. Performance: đo Lighthouse thật (LCP ≤ 2,5s) trên môi trường cho phép Chrome chạy — hiện CHƯA ĐO (xem PERFORMANCE_REPORT.md §2).

---

*Tài liệu này tổng hợp từ: `docs/release/TEST_REPORT.md`, `docs/release/SECURITY_REPORT.md`, `docs/release/ANALYTICS_CHECK.md`, `docs/release/PERFORMANCE_REPORT.md`, `docs/release/DEPLOYMENT_GUIDE.md`, `docs/release/BACKUP_RESTORE_GUIDE.md`, báo cáo Workers API 11/11/2026.*
