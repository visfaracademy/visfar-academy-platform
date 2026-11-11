# ROADMAP — Kế hoạch 90 ngày (từ 11/11/2026)

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Nguồn:** `docs/PROJECT_AUDIT.md` §11 (kế hoạch triển khai đề xuất) + Top 10 + các việc còn mở trong `docs/CHANGELOG.md`, `docs/frontend/TASK11_11D_REPORT.md`, `TASK12_AI_MENTOR_REPORT.md`, `TASK13_14_REPORT.md`, `docs/release/SECURITY_REPORT.md` §7, `docs/release/DEPLOYMENT_GUIDE.md` §10.
- **Nguyên tắc:** P0 trước (chặn mở bán) → P1 (tin cậy, đo lường) → P2 (tính năng, QA, tài liệu). Mọi việc ghi rõ điều kiện xong; việc nào chưa có số liệu thì ghi "chưa có", không bịa.
- **Không chứa secret/key/token nào.**

## 0. Điểm xuất phát (11/11/2026)

- Web + Worker live 200; test web 694/694, Workers 345/345; sitemap/robots + CSP/HSTS đã live; C-05-02 chống trùng lead ĐẠT live.
- Prod đã áp migration tới 0024; **0025–0031 chỉ mới áp staging**.
- **Chưa có remote GitHub** (`git remote -v` trống); code GĐ2 mới commit local (`f577747`, `dca216d`).
- **Chưa có backup tự động, chưa từng restore thử** (coi như chưa có backup).
- SePay / email thật cho học viên / LCP / E2E live: **chưa có cái nào chạy thật**.

## 1. Tuần 1–2 (ngày 1–14): P0 — Chặn mở bán

| # | Việc | Điều kiện xong | Chủ |
|---|---|---|---|
| 1 | Tạo remote GitHub private + push toàn bộ code (kể cả commit GĐ2) + bật branch protection cho `main` (không push trực tiếp, qua PR + CI xanh) | `git remote -v` có remote; `git status` sạch; CI chạy xanh trên 1 PR thử | User + agent |
| 2 | User nghiệm thu staging cho 0025–0031, rồi áp migrations lên prod theo thứ tự (backup prod trước mỗi lần áp) — **ưu tiên 0028 (S-03) trước khi bán khóa có content thật** | Probe anon prod: `lessons` 0 dòng / 0 content; `master_library_items` đếm 119; AI Mentor ask không còn 502; cộng đồng/thành tích/11D-lưu-kết-quả chạy được trên prod | Agent (áp) + user (nghiệm thu) |
| 3 | Test POST webhook SePay thật: chữ ký đúng → 200 + đơn `paid`; sai → 401; gửi lại → không trùng đơn (UNIQUE `(method, gateway_reference)`) | Có biên bản test webhook thật (không phải test mock); user đổi URL webhook trong SePay sang `https://api.visfaracademy.workers.dev/api/v1/webhooks/sepay` | Agent + user (đổi URL trong SePay) |
| 4 | 1 đơn thật end-to-end: tạo đơn → chuyển khoản thật → webhook → enrollment → email | Đơn `paid` → enrollment → học viên vào học được; đối soát khớp | User (chuyển khoản thật) + agent |
| 5 | Đối soát bù qua SePay API v2 + nút "Kiểm tra thanh toán" (cần set `SEPAY_API_TOKEN`, `SEPAY_BANK_ACCOUNT_ID`) | Đối soát bù chạy được 1 lần thật; giao dịch lệch (sai tiền/sai nội dung/không tìm thấy đơn) có quy trình xử lý tay | Agent |

## 2. Tuần 3–4 (ngày 15–30): P1 — Tin cậy

| # | Việc | Điều kiện xong |
|---|---|---|
| 6 | Email domain riêng: mua domain → xác minh SPF/DKIM/DMARC → set `RESEND_FROM_EMAIL` → nối `POST /api/webhooks/resend` → gửi thử 1 email thật cho học viên | Học viên nhận được email thật (E3/E5/E8); webhook Resend cập nhật trạng thái `delivered` trong `email_logs` |
| 7 | Turnstile thật: lấy site key + secret, set `TURNSTILE_SECRET`, kiểm tra form lead chặn spam thật (không còn fail-open) | Gửi lead kèm token sai → 400 `spam_suspected`; token đúng → 201 |
| 8 | Middleware verify chữ ký JWT + cân nhắc cookie HttpOnly (S-05); sửa S-07 (drop anon INSERT `event_registrations` hoặc ghi quyết định giữ lại) | Middleware verify chữ ký (test: JWT giả → chặn ngay ở middleware); probe anon `event_registrations` INSERT bị chặn (hoặc có quyết định giữ lại bằng văn bản) |
| 9 | Backup tự động: workflow GitHub Actions backup hàng ngày (pg_dump → R2 + repo backup riêng private) + script `scripts/backup-check.mjs` + **restore thử lần đầu lên staging** (ghi biên bản đếm dòng) | File backup đầu tiên có trên R2 + repo riêng, dung lượng > 0; biên bản restore thử khớp số dòng (`courses` = 10, `policies` = 4) |
| 10 | Cron giữ ấm + cron nhắc học: nối `scheduled()` trong Worker (hiện `index.ts` chỉ export `fetch`) hoặc GitHub Actions gọi `GET /api/health` mỗi ngày | Có log cron chạy 7 ngày liên tiếp; Supabase không bị tạm dừng |
| 11 | Tạo tài khoản test dùng chung (admin/student/instructor) và **ghi lại ở nơi an toàn** (không ghi vào repo) — mật khẩu test các đợt trước không được ghi lại nên kiểm thử 2 tài khoản không chạy lại được | Có 3 tài khoản test; chạy lại kiểm thử 2 tài khoản (A đọc dữ liệu B = 0 dòng; A thử update role/is_disabled, INSERT enrollment/progress/orders/payments đều bị chặn) |

## 3. Tháng 2 (ngày 31–60): P1 — Đo lường + sửa tồn đọng

| # | Việc | Điều kiện xong |
|---|---|---|
| 12 | Đo LCP / Lighthouse trên máy thật (mobile + desktop) — lần đầu có số thật | Có số LCP/FCP/CLS/INP thật (không bịa); danh sách việc tối ưu theo số đo |
| 13 | Analytics tỷ lệ chuyển đổi (M12: tổng hợp ở Workers + cache) + đối soát lead 14 ngày | Có tỷ lệ chuyển đổi xem → mua; báo cáo lead đối soát khớp DB–Sheet 14 ngày liên tiếp |
| 14 | Sửa tồn đọng bảo mật thấp: S-06 (chuyển trang học bài sang `progress.ts`, bỏ đường ghi trực tiếp trong `learning.ts`); S-12 (theo dõi scrub video); S-13 (`contentType` avatar suy từ ext); S-16 (`WITH CHECK`); S-17 (`current_role()` đọc `user_roles`); S-08 (chốt SELECT `payments`) | Từng mục có kiểm chứng (test + probe) sau khi sửa |
| 15 | Nâng CSP lên nonce-based (bỏ `'unsafe-inline'`/`'unsafe-eval'`) | Header CSP mới đo thật trên prod, trang vẫn render đủ (đặc biệt YouTube embed + Supabase) |
| 16 | Hoàn thiện admin còn thiếu theo nhu cầu user: trang admin blog (nếu user cần — hiện blog tĩnh 3 bài), trang admin sự kiện, trang admin tổng hợp 11D (view đã sẵn), báo cáo R1–R10 (`GET /api/admin/reports/*`) | Từng trang có kiểm chứng bằng tài khoản admin thật |
| 17 | Nội dung thật cho 3 khóa 04/05/06 (hiện có đoạn "NOI DUNG TAM" — AI Mentor đã lọc không đưa ra ngoài) + văn bản 11D/AI Mentor của user (hiện là bản agent soạn) | User gửi văn bản của mình; thay wholesale, không giữ bản tạm |

## 4. Tháng 3 (ngày 61–90): P2 — QA toàn luồng + mở bán

| # | Việc | Điều kiện xong |
|---|---|---|
| 18 | QA E2E live toàn luồng bằng tài khoản thật (Prompt 18): mới → đăng ký → đăng nhập → mua → học → hoàn thành → chứng nhận → hỗ trợ | Có biên bản E2E live từng bước PASS/FAIL rõ ràng; lỗi phát hiện được sửa + kiểm chứng lại |
| 19 | Kiểm thử trình duyệt đã đăng nhập trên live (parent/browser-task): 11D lưu kết quả + so sánh; AI Mentor hỏi 3 câu end-to-end; cộng đồng đăng bài/bình luận/cảm xúc/báo cáo + admin kiểm duyệt; học xong 1 bài thật → +10 điểm + huy hiệu "Khởi đầu" ở `/hoc-vien/thanh-tich` | Có biên bản kiểm chứng live từng luồng |
| 20 | Kiểm toán cuối + cập nhật tài liệu (Prompt 20): rà lại PROJECT_AUDIT Top 10, cập nhật 12 tài liệu Prompt 19 theo trạng thái mới | Báo cáo kiểm toán cuối; tài liệu không còn mục nào ghi sai trạng thái |
| 21 | Mở bán thật (khi P0 + P1 xong): khóa trả phí đầu tiên có content thật, giá thật (hiện giá Tùy tâm/0đ — chờ user cung cấp giá) | Có đơn thật đầu tiên từ học viên thật (không phải test); đối soát khớp |
| 22 | Chuẩn bị mở rộng: theo dõi 3 giới hạn chạm đầu tiên (Resend 100 email/ngày; Supabase tạm dừng 7 ngày; DB 500 MB / Storage 1 GB); kế hoạch nâng gói khi chạm giới hạn (QĐ 18) | Có số liệu dùng thật theo tuần; quyết định nâng gói dựa trên số thật, không phải dự đoán |

## 5. Việc còn mở — danh sách kiểm tra nhanh (đối chiếu khi nghiệm thu)

- [ ] Áp 0025–0031 lên prod (đặc biệt 0028/S-03)
- [ ] SePay thật (webhook POST live + 1 đơn thật + đối soát bù)
- [ ] Email domain riêng + gửi thật cho học viên
- [ ] LCP/Lighthouse số thật
- [ ] E2E live toàn luồng
- [ ] GitHub push (tạo remote + push + branch protection + CI xanh)
- [ ] Backup tự động + restore thử lần đầu (ghi biên bản)
- [ ] Turnstile key thật
- [ ] Cron giữ ấm + cron nhắc học đang chạy thật
- [ ] Tài khoản test dùng chung (ghi lại, không ghi vào repo)
- [ ] Sửa S-05/S-06/S-07/S-08/S-12/S-13/S-16/S-17 + CSP nonce-based
- [ ] Giá thật cho khóa trả phí (chờ user cung cấp)
- [ ] Nội dung thật khóa 04/05/06 + văn bản 11D/AI Mentor của user
- [ ] Kênh cảnh báo dự phòng khi Resend hết quota (chờ user chốt)
- [ ] Chốt lại lệch QĐ 11 về sitemap (không đưa `/su-kien`, `/hoc-vien/*`, `/admin/*` vào sitemap)
- [ ] Chốt lại 2 điểm còn tên cũ "Thấu Hiểu Bản Thân" (link tài nguyên "Bắt đầu tại đây" + 1 câu FAQ) — có đổi theo tên mới "Thấu Hiểu Nội Tâm" hay không
