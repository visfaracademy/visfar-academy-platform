# RUNBOOK — Vận hành, backup, phục hồi (Module 1)

Ngắn gọn cho giai đoạn Foundation. Chi tiết đầy đủ sẽ bổ sung khi có
Workers API, email và thanh toán (Module 2+).

## 1. Dịch vụ đang dùng (Module 1)

| Dịch vụ | Dùng cho | Gói |
|---|---|---|
| Supabase Free | PostgreSQL, Auth, RLS | Miễn phí — DB 500 MB, Storage 1 GB, tạm dừng sau 7 ngày không hoạt động, không backup tự động |
| Cloudflare Pages Free | Hosting frontend Next.js | Miễn phí — 500 build/tháng, static không giới hạn |
| GitHub Free | Code, CI | Miễn phí |

Resend **chưa dùng** ở Module 1. Workers API **chưa có** ở Module 1.

## 2. Backup (bắt buộc — Supabase Free không backup tự động)

1. **Hàng ngày:** dump database bằng Supabase CLI hoặc dashboard:
   ```bash
   npx supabase db dump -f backup-$(date +%F).sql
   ```
   Lưu file `.sql` vào repo backup riêng (private) và/hoặc Cloudflare R2.
   Script kiểm tra backup (`scripts/backup-check.mjs`) sẽ được thêm khi có
   GitHub Actions chạy dump tự động.
2. **Hàng tháng:** restore thử file backup mới nhất lên project Supabase
   staging (project miễn phí thứ 2) và đếm số dòng các bảng chính
   (`courses` = 10, `policies` = 4, `leads`, `profiles` khớp production).
   **Backup chưa từng restore thử thì coi như chưa có backup.**
3. **Code:** GitHub là nguồn chính; bật branch protection cho `main`
   (không push trực tiếp, phải qua PR). Rollback bằng `git revert` hoặc
   deploy lại commit cũ trên Cloudflare Pages.

## 3. Phục hồi khi sự cố

| Sự cố | Cách xử lý |
|---|---|
| Supabase project bị tạm dừng (7 ngày không hoạt động) | Dashboard Supabase → Resume project → gọi `GET /api/health` kiểm tra 200. Phòng ngừa: cron “giữ ấm” gọi `/api/health` mỗi ngày (thêm ở Module 2). |
| Database lỗi / mất dữ liệu | Restore từ file `pg_dump` mới nhất → kiểm tra số dòng bảng chính khớp báo cáo hôm trước → thông báo cho admin. |
| Deploy lỗi trên Cloudflare Pages | Xem log build → deploy lại commit trước (Pages giữ lại các deployment cũ). |
| `/api/health` trả 503 `not_configured` | Kiểm tra biến môi trường trên Cloudflare/local: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` đã đặt chưa, có khoảng trắng thừa không. |
| `/api/health` trả 503 `supabase_error` | Kiểm tra Supabase project có bị tạm dừng không; kiểm tra migration đã chạy chưa (`courses` có tồn tại không). |
| Mất/ lộ secret | Xoay key trong Supabase dashboard → cập nhật Cloudflare env → deploy lại. **Anon key lộ không nguy hiểm bằng service-role key** (anon bị RLS chặn), nhưng vẫn phải xoay. Service-role key KHÔNG BAO GIỜ có trong repo này. |

## 4. Kiểm tra định kỳ

- **Mỗi ngày:** `/api/health` trả 200; số dòng `courses`/`policies` không đổi bất thường.
- **Mỗi tuần:** kiểm tra dung lượng DB Supabase còn bao nhiêu trong 500 MB.
- **Mỗi tháng:** restore thử backup lên staging (mục 2); rà soát lại giới hạn
  miễn phí trên trang pricing của Supabase/Cloudflare (giới hạn có thể thay đổi).
