# BACKUP_RECOVERY — Sao lưu & phục hồi (trạng thái thật 11/11/2026)

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Nguồn:** `docs/release/BACKUP_RESTORE_GUIDE.md` (Task 12), `docs/supabase/BACKUP_GUIDE.md` (Task 04), `docs/architecture/DEPLOYMENT_ARCHITECTURE.md` §6, tài liệu kiến trúc tổng thể §12.
- **Kết luận quan trọng nhất — đọc trước: CHƯA CÓ BACKUP TỰ ĐỘNG NÀO ĐANG CHẠY VÀ CHƯA TỪNG RESTORE THỬ LẦN NÀO.** Theo nguyên tắc đã chốt trong cả hai tài liệu nguồn — **"backup chưa từng restore thử thì coi như chưa có backup"** — hiện tại coi như **chưa có backup**. Tài liệu này là hướng dẫn phải thực hiện **trước khi mở đăng ký cho học viên thật**, không phải biên bản của một lần backup đã chạy.
- **Không chứa secret/key/token nào (chỉ tên biến).**

## 1. Cái gì cần sao lưu

| Hạng mục | Cách backup | Tần suất | Nơi lưu | Giữ bao lâu |
|---|---|---|---|---|
| **Database (Supabase)** | `pg_dump` qua Supabase CLI / `npx supabase db dump`, chạy tự động bằng GitHub Actions hàng ngày | Hàng ngày | **Cả 2 nơi:** (1) repo backup riêng (private), (2) Cloudflare R2 (Free: 10 GB, không phí egress) | File `.sql` hàng ngày giữ 30 ngày gần nhất; 1 bản/tháng giữ 12 tháng |
| **Storage (ảnh, poster, tài liệu)** | File gốc trong repo Git + Supabase Storage; đồng bộ 1 bản sao lên R2 | Hàng tuần | R2 + repo Git | Bản mới nhất + 2 bản trước |
| **Code** | GitHub là nguồn chính | Mọi commit | GitHub (repo chính) | Toàn bộ lịch sử Git |
| **Cấu hình (biến môi trường)** | Danh sách tên biến trong tài liệu vận hành; giá trị secret chỉ trong Workers Secrets / GitHub Secrets | Khi thay đổi | `docs/RUNBOOK.md` (tên biến) + Cloudflare/GitHub Secrets (giá trị) | Theo thay đổi |
| **Nội dung (CMS)** | Nội dung nằm trong database → backup cùng database; file seed (`supabase/seed/`) lưu trong Git | Mỗi lần seed thay đổi | Git + backup DB | Theo Git |
| **Email log** | Bảng `email_logs` trong database (backup cùng DB); log Resend chỉ giữ 30 ngày nên không dựa vào Resend làm nguồn đối soát | Cùng backup DB | Database | Theo backup DB |
| **Google Sheet (nếu còn)** | Sheet là bản sao — giữ bản sao Sheet trước mỗi lần sửa Apps Script / thay đổi luồng lead | Trước mỗi lần sửa | Google Drive | Theo thay đổi |

**Lưu ý quan trọng:**
- Backup database chứa PII (họ tên, SĐT, email học viên) nên repo backup phải là **private**, chỉ admin truy cập, không public, không fork. Không lưu file backup `.sql` vào repo code chính.
- Dump mặc định chỉ bao phủ schema `public`; **`auth.users` nằm ngoài dump** — tài khoản Auth phải được khôi phục riêng (tạo lại qua Supabase Dashboard / Auth Admin API) nếu mất toàn bộ project.
- Không thể chạy `pg_dump` trực tiếp từ VM này — cổng Postgres 5432 bị chặn. Backup chạy qua **GitHub Actions** (dùng secret trong GitHub Secrets), không chạy trên máy cá nhân.
- **Chưa có remote GitHub** (`git remote -v` trống, 11/11/2026) — nên cả workflow backup qua GitHub Actions lẫn repo backup riêng đều **chưa thể chạy** cho tới khi tạo remote. Đây là việc chặn backup tự động (xem §5).

## 2. Trạng thái thật 11/11/2026 (đối chiếu — không bịa)

| Hạng mục | Trạng thái |
|---|---|
| Workflow GitHub Actions backup hàng ngày | **Chưa có** (chưa tạo; chưa có remote GitHub để chạy) |
| Repo backup riêng (private) | **Chưa có** |
| Bản backup R2 nào | **Chưa có** |
| File backup `.sql` nào | **Chưa có** (không có log backup nào trong repo) |
| Script `scripts/backup-check.mjs` | **Chưa có** (chỉ có `scripts/check-migrations.mjs`) |
| Restore thử lên staging | **Chưa từng thực hiện lần nào** |
| Cron giữ ấm `GET /api/health` hàng ngày | **Chưa xác minh đang chạy thật** (Worker `index.ts` không thấy handler `scheduled`) |
| Người vận hành dự phòng | **Chưa có** (phụ thuộc 1 người — xem PROJECT_AUDIT R-09) |

**Bối cảnh đã chốt:** Supabase Free không có backup tự động hàng ngày và không có SLA. Free cho 2 project đang hoạt động — đúng 2 project cần dùng (prod + staging), không còn project dự phòng; staging đồng thời là nơi restore thử backup hàng tháng. Cả 2 project tạo trên tài khoản Gmail `visfaracademy@gmail.com`. Giới hạn Free (snapshot 10/11/2026, xác minh lại trước khi triển khai): DB 500 MB, Storage 1 GB, **tạm dừng project sau 7 ngày không hoạt động**.

## 3. Workflow backup tự động (cần tạo — CHƯA CÓ)

- **Lịch chạy:** hàng ngày, giờ ít traffic, múi giờ Việt Nam (chốt giờ cụ thể khi lập trình).
- **Việc làm:** (1) `pg_dump` database prod qua Supabase CLI; (2) nén + đặt tên file theo ngày (`backup-YYYY-MM-DD.sql.gz`); (3) tải lên R2 và push lên repo backup riêng (private); (4) chạy script kiểm tra backup (`scripts/backup-check.mjs` — kiểm tra file mới nhất tồn tại, dung lượng > 0, ngày tạo là hôm nay); (5) nếu bất kỳ bước nào lỗi → báo cho admin ngay.
- **Giới hạn miễn phí:** GitHub Actions Free 2.000 phút/tháng — 1 lần dump/ngày là rất nhỏ; R2 Free 10 GB — đủ chứa nhiều tháng backup `.sql` đã nén.
- **Điều kiện tiên quyết:** tạo remote GitHub trước (xem §5) — không có remote thì không có Actions để chạy workflow này.

## 4. Phục hồi — quy trình

**Nguyên tắc: backup chưa từng restore thử thì coi như chưa có backup.**

| # | Bước | Chi tiết |
|---|---|---|
| 1 | **Restore thử hàng tháng** | Mỗi tháng 1 lần, restore file backup mới nhất lên **project Supabase staging** bằng `psql`. Sau đó đếm số dòng các bảng chính (`courses` = 10, `policies` = 4, `leads`, `profiles`, `orders`, `enrollments`) và đối chiếu với production. Khớp → ghi biên bản restore thử; lệch → điều tra ngay. **Chưa từng thực hiện lần nào.** |
| 2 | **Khôi phục khi database lỗi / mất dữ liệu** | Restore từ file `pg_dump` mới nhất (từ R2 hoặc repo backup riêng) vào project Supabase mới (nếu project cũ lỗi) hoặc cùng project → kiểm tra số lượng lead/order/enrollment khớp với báo cáo hôm trước → thông báo cho admin → kiểm tra `/api/health` và 1 luồng đăng ký mẫu. |
| 3 | **Khôi phục khi Storage mất file** | Tải lại từ R2 / repo Git; kiểm tra lại ảnh poster và tài liệu bài học hiển thị đúng. |
| 4 | **Khôi phục khi mất code** | `git clone` lại từ GitHub; deploy lại commit gần nhất qua Cloudflare Pages. **Hiện chưa có remote GitHub — bước này chưa thực hiện được; code hiện chỉ có trên VM (đã commit local).** |
| 5 | **Khôi phục khi mất secret** | Xoay key → cập nhật Workers Secrets → deploy lại → kiểm tra API. |
| 6 | **Khôi phục khi Supabase project bị tạm dừng** | Vào dashboard Supabase → Resume project → kiểm tra API hoạt động lại → kiểm tra cron giữ ấm đang chạy. |

## 5. Mục tiêu phục hồi (RTO/RPO — mục tiêu, chưa cam kết SLA)

| Chỉ số | Mục tiêu giai đoạn 0đ | Ghi chú |
|---|---|---|
| RPO (mất tối đa bao nhiêu dữ liệu) | ≤ 24 giờ (backup hàng ngày) | Muốn RPO nhỏ hơn thì tăng tần suất dump — cần phê duyệt chi phí/thời gian |
| RTO (khôi phục trong bao lâu) | ≤ 1 ngày làm việc (restore thủ công theo runbook) | Chưa có restore tự động ở giai đoạn 0đ |

## 6. Checklist trước khi mở cho học viên thật

- [ ] Tạo remote GitHub private + push code (điều kiện tiên quyết cho cả backup lẫn CI/CD)
- [ ] Workflow GitHub Actions backup hàng ngày đã tạo và chạy thành công ít nhất 1 lần
- [ ] File backup đầu tiên đã có trên R2 + repo backup riêng (private), dung lượng > 0
- [ ] Script `scripts/backup-check.mjs` đã viết và chạy trong workflow
- [ ] **Restore thử lần đầu lên staging đã làm và ghi biên bản** (đếm dòng `courses` = 10, `policies` = 4, đối chiếu `leads`/`profiles`/`orders`/`enrollments`)
- [ ] Cron giữ ấm `GET /api/health` hàng ngày đã chạy (chống tạm dừng sau 7 ngày)
- [ ] Quy trình xoay key đã ghi trong runbook
- [ ] Người vận hành dự phòng (không phụ thuộc 1 người) đã có quyền truy cập GitHub + Cloudflare + Supabase
