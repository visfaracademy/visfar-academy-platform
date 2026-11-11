# Hướng dẫn Backup & Phục hồi — Supabase Backend (Task 04)

**Ngày:** 10/11/2026
**Trạng thái:** Chờ user tạo project Supabase
**Thuộc:** Task 04 — Supabase Backend Implementation, Visfar Academy
**Tài liệu liên quan:**
- `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (§12 — giới hạn miễn phí, backup, mở rộng)
- `workspace/visfar-academy-platform/docs/architecture/DEPLOYMENT_ARCHITECTURE.md` (§6 backup/phục hồi, §7.1 cron giữ ấm)
- `workspace/visfar-academy-platform/docs/architecture/INTEGRATION_PLAN.md` (§1 Supabase)
- `workspace/visfar-academy-platform/docs/DECISIONS.md` (19 quyết định + phê duyệt Task 02, Task 03)

## Phạm vi và giới hạn của tài liệu này

- **Đội ngũ không có quyền truy cập tài khoản Supabase của user**: không mật khẩu, không API key, không connection string thật. Vì vậy tài liệu này là **hướng dẫn + script mẫu để user triển khai**, không phải bản ghi của một lần backup đã chạy.
- **Không chạy backup lên database thật trong nhiệm vụ này.** Mọi lệnh, workflow và script dưới đây đều ở dạng mẫu — chỉ chạy sau khi user đã tạo project Supabase và điền secret vào GitHub Secrets.
- Tài liệu này **chỉ ghi tên secret, không ghi giá trị thật**. Không ghi số tài khoản ngân hàng, không ghi giá trị secret nào.
- Mọi con số giới hạn / giá dịch vụ trong tài liệu này là snapshot tra cứu ngày 10/11/2026 theo tài liệu kiến trúc tổng thể và `DECISIONS.md`; nhà cung cấp có thể thay đổi — **xác minh lại trên trang pricing/docs chính thức trước khi triển khai và trước mỗi lần nâng gói**.

## 1. Vì sao phải tự backup

**Supabase Free không có backup tự động hàng ngày và không có SLA.** Nếu không tự backup, mất database đồng nghĩa với mất toàn bộ lead, học viên, đơn hàng, tiến độ học.

Bối cảnh đã chốt:

- Supabase Free cho **2 project đang hoạt động** — đúng 2 project cần dùng, không còn project dự phòng: **project 1 = production, project 2 = staging** (đồng thời là nơi restore thử backup hàng tháng).
- Cả 2 project tạo trên tài khoản Gmail `visfaracademy@gmail.com` (phê duyệt Task 02, quyết định 15).
- Giới hạn Free (snapshot 10/11/2026, xác minh lại trước khi triển khai): DB 500 MB, Storage 1 GB, **tạm dừng project sau 7 ngày không hoạt động**.
- Ngưỡng nâng cấp trả phí **linh hoạt, tự cập nhật được, ban đầu dùng hoàn toàn miễn phí** (phê duyệt Task 02, quyết định 16): hệ thống theo dõi mức dùng và đề xuất nâng cấp khi chạm giới hạn; giai đoạn đầu 0 đồng. Giá tham khảo tra cứu 10/11/2026 (Supabase Pro $25/tháng — cần xác minh lại trước khi nâng; xem §10).

### Mục tiêu phục hồi (mục tiêu, chưa phải cam kết SLA — gói miễn phí không có SLA)

| Chỉ số | Mục tiêu giai đoạn 0 đồng | Ý nghĩa |
|---|---|---|
| **RPO** (mất tối đa bao nhiêu dữ liệu) | **≤ 24 giờ** | Backup hàng ngày — mất nhiều nhất dữ liệu của 1 ngày |
| **RTO** (khôi phục trong bao lâu) | **≤ 1 ngày làm việc** | Restore thủ công theo runbook trong tài liệu này |

Muốn RPO nhỏ hơn 24 giờ thì tăng tần suất dump (VD 2 lần/ngày) — cần phê duyệt chi phí/thời gian vì tăng phút GitHub Actions và dung lượng lưu trữ.

**Nguyên tắc xuyên suốt: backup chưa từng restore thử thì coi như chưa có backup.**

---

## 2. Bảng các loại backup

| # | Loại | Nội dung | Cách backup | Tần suất | Nơi lưu | Giữ bao lâu |
|---|---|---|---|---|---|---|
| 1 | **Code** | Toàn bộ repo `visfar-academy-platform` (frontend Next.js, Workers API, migration, seed, tài liệu) | GitHub là nguồn chính; branch protection cho `main` (không push trực tiếp, qua PR + review) | Mọi commit | GitHub (repo chính) | Toàn bộ lịch sử Git |
| 2 | **Cấu hình** | Danh sách tên biến môi trường; giá trị secret chỉ nằm trong Cloudflare Workers Secrets / GitHub Secrets | Lưu danh sách tên biến trong tài liệu vận hành (`docs/RUNBOOK.md`); **không lưu giá trị secret vào tài liệu hay repo** | Khi thay đổi | `docs/RUNBOOK.md` (tên biến) + Cloudflare/GitHub Secrets (giá trị) | Theo thay đổi |
| 3 | **Dữ liệu** | Database PostgreSQL trên Supabase — 38 bảng (Task 03): `profiles`, `courses` (10 khóa), `course_modules`, `lessons`, `quizzes`, `questions`, `question_options`, `quiz_answers`, `quiz_attempts`, `enrollments`, `lesson_progress`, `leads`, `orders`, `order_items`, `payments`, `certificates`, `events`, `event_registrations`, `posts`, `policies` (4 chính sách), `newsletter_subscribers`, `email_logs`, `audit_logs`, `activity_logs`, `learning_events`, `automation_events`, `user_roles`, `course_instructors`… | `pg_dump` tự động qua GitHub Actions hàng ngày (xem §4); file `backup-YYYY-MM-DD.sql.gz` | **Hàng ngày** | **Cả 2 nơi:** (1) repo backup riêng (private), (2) Cloudflare R2 | File `.sql.gz` hàng ngày giữ 30 ngày gần nhất; 1 bản/tháng giữ 12 tháng |
| 4 | **Email log** | Bảng `email_logs` trong database (to, template, `resend_id`, status) — nguồn đối soát email, vì log Resend chỉ giữ 30 ngày | Backup cùng database (loại 3); không dựa vào Resend làm nguồn đối soát | Cùng backup DB | Database (theo backup DB) | Theo backup DB |
| 5 | **Storage (ảnh, tài liệu)** | Ảnh poster, ảnh bài học, PDF tài liệu trong Supabase Storage (không chứa video — video ở YouTube unlisted) | File gốc lưu trong repo Git (ảnh dùng chung) + Supabase Storage; đồng bộ 1 bản sao lên R2 | **Hàng tuần** | R2 + repo Git | Bản mới nhất + 2 bản trước |
| 6 | **Google Sheet (bản sao đối soát)** | Sheet lead đối soát (chỉ là bản sao — nguồn chính là PostgreSQL, theo Quyết định 5) | Giữ bản sao Sheet trước mỗi lần sửa Apps Script / thay đổi luồng lead | Trước mỗi lần sửa | Google Drive | Theo thay đổi |

**Lưu ý về repo backup riêng:** file backup database chứa PII (họ tên, SĐT, email học viên) nên repo backup **phải là private, chỉ admin truy cập, không public, không fork**. Không lưu file backup `.sql` / `.sql.gz` vào repo code chính.

**Giới hạn của `pg_dump` cần biết trước:** `pg_dump` mặc định chỉ dump schema `public` (dữ liệu nghiệp vụ). Tài khoản đăng nhập trong `auth.users` (Supabase Auth) và cấu hình Auth/Storage nằm ngoài file dump — xem §8.4: sau khi restore, phải kiểm tra đăng nhập bằng tài khoản test; nếu mất toàn bộ project Supabase, tài khoản Auth cần khôi phục theo hướng dẫn của Supabase (không có trong file dump này).

---

## 3. Chuẩn bị trước khi bật backup tự động

### 3.1. Điều kiện tiên quyết (user làm — xem §11)

1. Đã tạo **2 project Supabase Free** trên tài khoản `visfaracademy@gmail.com`: project 1 = prod, project 2 = staging.
2. Đã chạy migration lên staging rồi lên prod (thứ tự 0004 → 0005 → 0006 theo phê duyệt Task 03; không chạy 0006 trước 0005).
3. Đã tạo **repo backup riêng (private)** trên GitHub, tách khỏi repo code chính.
4. Đã tạo **bucket Cloudflare R2** để lưu file backup (R2 Free: 10 GB lưu trữ, không phí egress — snapshot 10/11/2026, xác minh lại).
5. Đã điền đủ secret ở §3.2 vào GitHub Secrets của repo code chính.

### 3.2. Secret cần có — chỉ ghi tên, KHÔNG ghi giá trị thật

| Secret (tên trong GitHub Secrets) | Dùng cho | Ghi chú |
|---|---|---|
| `SUPABASE_DB_URL` | `pg_dump` database prod | Connection string Postgres của **project prod** (dạng `postgres://postgres:<mat-khau>@<host>:5432/postgres`). Lấy trong dashboard Supabase → Settings → Database. **Dùng connection string direct (cổng 5432), không dùng pooler cho `pg_dump`.** Chỉ dùng cho backup/migration, không dùng trong code chạy production |
| `SUPABASE_DB_URL_STAGING` | Restore thử hàng tháng lên staging | Connection string Postgres của **project staging**. Tách riêng với prod — nhầm 2 key này là lỗi cấm |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI (nếu dùng `supabase db dump` thay `pg_dump`) | Token Supabase CLI; chỉ dùng khi chọn cách dump bằng CLI |
| `R2_BUCKET` | Lưu file backup lên R2 | Tên bucket R2 đã tạo |
| `R2_ACCOUNT_ID` | Lưu file backup lên R2 | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Lưu file backup lên R2 | R2 API token — Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Lưu file backup lên R2 | R2 API token — Secret Access Key |
| `BACKUP_REPO_TOKEN` | Push file backup lên repo backup riêng | Personal Access Token (quyền tối thiểu: chỉ repo backup riêng) hoặc deploy key của repo đó. Không dùng token có quyền toàn bộ tài khoản |
| `ADMIN_NOTIFY_EMAIL` | Gửi cảnh báo khi backup lỗi | Email admin nhận cảnh báo — `visfaracademy@gmail.com` (theo phê duyệt Task 02, quyết định 14) |

Quy tắc secret (theo `DEPLOYMENT_ARCHITECTURE.md` §5):

- Không commit `.env`, `.env.local`, hay bất kỳ file nào chứa secret. `.gitignore` chặn `.env*` (trừ `.env.example`).
- `.env.example` chỉ chứa tên biến + giá trị mẫu giả, không chứa giá trị thật.
- Service-role key bypass RLS — không bao giờ xuất hiện trong code frontend, log, email, hay ảnh chụp màn hình. Workflow backup **không cần** service-role key; chỉ cần `SUPABASE_DB_URL`.
- Xoay key khi: có người rời đội; nghi ngờ lộ key; rà soát định kỳ mỗi quý.

---

## 4. Backup database hàng ngày — GitHub Actions + `pg_dump`

### 4.1. Luồng

```
GitHub Actions (theo lịch, hàng ngày, giờ ít traffic, múi giờ Việt Nam)
  1. pg_dump database prod → backup-YYYY-MM-DD.sql.gz
  2. Tải lên Cloudflare R2
  3. Push lên repo backup riêng (private)
  4. Chạy scripts/backup-check.mjs — xác nhận file mới có dung lượng > 0
  5. Bất kỳ bước nào lỗi → báo cho admin (xem §4.4)
```

- **Không chạy backup trên máy cá nhân** — chỉ chạy qua GitHub Actions để có lịch sử chạy, log, và không phụ thuộc 1 người.
- **Giờ chạy:** chốt khi lập trình — ưu tiên giờ ít traffic, múi giờ Việt Nam (VD 02:00 giờ Việt Nam = 19:00 UTC hôm trước; kiểm tra lại múi giờ trong cron khi tạo workflow — GitHub Actions dùng UTC).
- **Giới hạn miễn phí:** GitHub Actions Free 2.000 phút/tháng — 1 lần dump/ngày là rất nhỏ so với giới hạn; R2 Free 10 GB — đủ chứa nhiều tháng backup `.sql.gz` đã nén (database giai đoạn đầu nhỏ hơn nhiều so với 500 MB).

### 4.2. Workflow mẫu — `.github/workflows/backup.yml`

> File mẫu. Chỉ tạo sau khi user đã tạo project Supabase và điền đủ secret ở §3.2. Chỉ chứa tên secret, không chứa giá trị thật.

```yaml
name: Backup database (Supabase prod)

# Chạy hàng ngày lúc 19:00 UTC (= 02:00 giờ Việt Nam hôm sau).
# Kiểm tra lại múi giờ khi tạo workflow — GitHub Actions dùng UTC.
on:
  schedule:
    - cron: "0 19 * * *"
  # Cho phép chạy tay để kiểm tra lần đầu (Actions → Run workflow).
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Install PostgreSQL client (pg_dump)
        run: sudo apt-get update && sudo apt-get install -y postgresql-client

      - name: Dump production database
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          DATE=$(date -u +%Y-%m-%d)
          # Dump schema public + dữ liệu. Không dump role/mật khẩu.
          pg_dump "$SUPABASE_DB_URL" --format=plain --no-owner --no-privileges \
            | gzip > "backup-${DATE}.sql.gz"
          ls -lh "backup-${DATE}.sql.gz"

      - name: Upload backup to Cloudflare R2
        env:
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
        run: |
          DATE=$(date -u +%Y-%m-%d)
          # Cần cài aws-cli (đã có sẵn trên runner ubuntu-latest).
          aws s3 cp "backup-${DATE}.sql.gz" \
            "s3://${R2_BUCKET}/supabase-prod/backup-${DATE}.sql.gz" \
            --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

      - name: Push backup to private backup repo
        env:
          BACKUP_REPO_TOKEN: ${{ secrets.BACKUP_REPO_TOKEN }}
        run: |
          DATE=$(date -u +%Y-%m-%d)
          # <ten-tai-khoan>/<ten-repo-backup-rieng>: thay bằng tên repo thật khi tạo.
          # Repo này phải là PRIVATE (backup chứa PII — xem §2).
          git clone "https://x-access-token:${BACKUP_REPO_TOKEN}@github.com/<ten-tai-khoan>/<ten-repo-backup-rieng>.git" backup-repo
          cp "backup-${DATE}.sql.gz" backup-repo/
          cd backup-repo
          git config user.name "visfar-backup-bot"
          git config user.email "visfaracademy@gmail.com"
          git add "backup-${DATE}.sql.gz"
          git commit -m "Backup prod ${DATE}" || echo "Khong co thay doi de commit"
          git push origin main

      - name: Verify backup (file exists, size > 0, dated today)
        run: node scripts/backup-check.mjs

      - name: Notify admin on failure
        if: failure()
        # Giai đoạn 0 đồng: cảnh báo qua email tới admin.
        # Cách gửi (Resend / SMTP) chốt khi lập trình; kênh dự phòng khi
        # Resend hết quota (VD Zalo/email cá nhân) chốt cùng user (xem §11).
        run: |
          echo "BACKUP THAT BAI — can admin kiem tra ngay tab Actions cua repo."
          echo "Backup lai bang tay trong ngay (xem BACKUP_GUIDE.md §8.2)."
```

**Dọn file backup cũ (giữ 30 ngày / 12 tháng):** thêm 1 bước vào workflow trên (hoặc workflow dọn riêng chạy cuối tháng):

```bash
# Xóa file .sql.gz quá 30 ngày trong repo backup riêng (giữ lại 1 bản/tháng).
# Chạy trong thư mục backup-repo đã clone ở bước trên:
find . -name 'backup-*.sql.gz' -mtime +30 \
  -not -name 'backup-*-01.sql.gz' -delete
# Tương tự trên R2 (dùng aws s3 rm theo ngày) hoặc đặt lifecycle rule của R2.
```

### 4.3. Script kiểm tra backup hàng ngày — `scripts/backup-check.mjs`

> File mẫu — tạo trong repo code chính tại `scripts/backup-check.mjs`. Script chỉ kiểm tra file backup, không chứa secret, không đọc nội dung PII trong file dump.

```js
// scripts/backup-check.mjs
// Kiểm tra backup hàng ngày: file mới nhất có tồn tại, dung lượng > 0,
// và ngày tạo là hôm nay. Chạy trong workflow backup (§4.2).
// Thoát mã != 0 khi kiểm tra lỗi -> GitHub Actions báo lỗi -> cảnh báo admin.
import { readdirSync, statSync } from "node:fs";

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
const expected = `backup-${today}.sql.gz`;

// Tìm file backup mới nhất trong thư mục làm việc của workflow.
const files = readdirSync(".").filter((f) => /^backup-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(f));
if (files.length === 0) {
  console.error("BACKUP CHECK FAILED: khong tim thay file backup nao.");
  process.exit(1);
}
const latest = files.sort().at(-1);
const size = statSync(latest).size;

if (latest !== expected) {
  console.error(`BACKUP CHECK FAILED: file moi nhat la ${latest}, mong doi ${expected}.`);
  process.exit(1);
}
if (size <= 0) {
  console.error(`BACKUP CHECK FAILED: file ${latest} co dung luong 0 byte.`);
  process.exit(1);
}
console.log(`BACKUP CHECK OK: ${latest} (${size} bytes, ngay ${today}).`);
```

Kiểm tra nâng cao (tùy chọn, chạy khi có database tạm — xem §5.2): giải nén và restore thử file `.sql.gz` vào database tạm, đếm số dòng bảng chính; nếu restore lỗi hoặc số dòng = 0 thì báo lỗi.

### 4.4. Khi workflow backup lỗi

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| Workflow lỗi ở bước `pg_dump` | Sai `SUPABASE_DB_URL`; project prod bị tạm dừng (7 ngày không hoạt động); DB đầy 500 MB (chế độ chỉ đọc) | Kiểm tra secret; kiểm tra project có bị tạm dừng không (dashboard Supabase → Resume); kiểm tra dung lượng DB; **backup lại bằng tay ngay trong ngày** (xem §8.2) |
| Workflow lỗi ở bước upload R2 | Sai secret R2; bucket chưa tạo; R2 đầy 10 GB | Kiểm tra secret + bucket; dọn file backup cũ theo §4.2 |
| Workflow lỗi ở bước push repo backup | Sai `BACKUP_REPO_TOKEN`; repo chưa tạo / không phải private | Kiểm tra token + repo; tạo lại repo backup riêng (private) |
| `backup-check.mjs` báo lỗi | Không có file backup hôm nay; file 0 byte | Điều tra bước dump; backup lại bằng tay ngay trong ngày |
| Workflow chạy nhưng không thấy file mới | Cron GitHub Actions bị tắt (repo không hoạt động lâu) hoặc lịch sai múi giờ | Kiểm tra tab Actions; chạy tay bằng `workflow_dispatch` để kiểm tra |

Cảnh báo backup thất bại là **mức Cao** (theo `DEPLOYMENT_ARCHITECTURE.md` §7.2): email admin ngay; backup lại bằng tay ngay trong ngày — không để sang hôm sau.

---

## 5. Kiểm tra backup — hàng ngày và hàng tháng

### 5.1. Kiểm tra hàng ngày (tự động)

Workflow backup (§4.2) chạy `scripts/backup-check.mjs` sau mỗi lần dump — kiểm tra 3 điều:

1. File backup mới nhất **tồn tại**.
2. File có **dung lượng > 0**.
3. Ngày tạo của file **là hôm nay**.

Bất kỳ điều nào lỗi → workflow báo lỗi → cảnh báo admin → backup lại bằng tay trong ngày.

### 5.2. Restore thử vào database tạm (kiểm tra file dump đọc được)

Mỗi tuần 1 lần (hoặc sau mỗi lần đổi schema/migration), restore thử file backup mới nhất vào **database tạm trên máy cá nhân** (không phải staging, không phải prod) để chứng minh file dump không hỏng:

```bash
# 1. Tải file backup mới nhất từ R2 (hoặc repo backup riêng) về máy.
# 2. Tạo database tạm trên máy (PostgreSQL local; chưa có thì cài PostgreSQL
#    hoặc dùng Supabase CLI local — không dùng database thật).
createdb visfar_backup_test

# 3. Restore thử.
gunzip -c backup-YYYY-MM-DD.sql.gz | psql -d visfar_backup_test

# 4. Đếm số dòng các bảng chính — phải > 0 với bảng đã có dữ liệu
#    (courses = 10, policies = 4 theo seed hiện tại; các bảng khác > 0
#    khi đã có dữ liệu thật; bảng chưa có dữ liệu thì = 0 là bình thường).
psql -d visfar_backup_test -c "SELECT count(*) FROM courses;"
psql -d visfar_backup_test -c "SELECT count(*) FROM policies;"
psql -d visfar_backup_test -c "SELECT count(*) FROM leads;"
psql -d visfar_backup_test -c "SELECT count(*) FROM profiles;"
psql -d visfar_backup_test -c "SELECT count(*) FROM orders;"
psql -d visfar_backup_test -c "SELECT count(*) FROM enrollments;"

# 5. Xóa database tạm sau khi kiểm tra xong.
dropdb visfar_backup_test
```

Nếu restore lỗi (VD lỗi cú pháp SQL, thiếu bảng, số dòng = 0 ở bảng phải có dữ liệu) → điều tra ngay: kiểm tra lại lệnh `pg_dump` (có dump đủ schema không), kiểm tra migration mới có lỗi không. **Không chờ tới kỳ restore tháng mới xử lý.**

### 5.3. Restore thử hàng tháng lên staging — bắt buộc

**Mỗi tháng 1 lần**, restore file backup prod mới nhất lên **project Supabase staging** (project miễn phí thứ 2) bằng `psql`, rồi đối chiếu số dòng các bảng chính với production.

Quy trình từng bước:

1. **Ghi lại số dòng bảng chính ở prod trước khi restore** (chạy trên prod — chỉ `SELECT count(*)`, không ghi):
   ```sql
   SELECT 'courses' AS bang, count(*) FROM courses
   UNION ALL SELECT 'policies', count(*) FROM policies
   UNION ALL SELECT 'leads', count(*) FROM leads
   UNION ALL SELECT 'profiles', count(*) FROM profiles
   UNION ALL SELECT 'orders', count(*) FROM orders
   UNION ALL SELECT 'enrollments', count(*) FROM enrollments
   UNION ALL SELECT 'payments', count(*) FROM payments
   UNION ALL SELECT 'lesson_progress', count(*) FROM lesson_progress
   UNION ALL SELECT 'certificates', count(*) FROM certificates
   UNION ALL SELECT 'email_logs', count(*) FROM email_logs;
   ```
   Lưu kết quả (kèm ngày giờ) vào biên bản restore thử.
2. **Tải file backup prod mới nhất** từ R2 hoặc repo backup riêng.
3. **Restore lên staging** (dùng `SUPABASE_DB_URL_STAGING` — kiểm tra kỹ, không nhầm với prod):
   ```bash
   gunzip -c backup-YYYY-MM-DD.sql.gz | psql "$SUPABASE_DB_URL_STAGING"
   ```
   Lưu ý: restore ghi đè dữ liệu staging hiện tại — đó là điều bình thường, vì dữ liệu staging chỉ là seed + dữ liệu test.
4. **Đếm lại số dòng các bảng chính trên staging** bằng cùng câu `SELECT` ở bước 1, đối chiếu với số liệu prod đã ghi:
   - **Khớp** (sai lệch chỉ do dữ liệu phát sinh giữa lúc ghi số liệu và lúc dump — ghi rõ khoảng lệch và lý do) → ghi biên bản restore thử (ngày, file backup dùng, người thực hiện, kết quả đối chiếu) → qua bước 5.
   - **Lệch không giải thích được** (VD thiếu bảng, số dòng chênh lớn, restore báo lỗi) → điều tra ngay: kiểm tra file backup có đầy đủ không, migration trên prod và staging có lệch nhau không, lệnh `pg_dump` có thiếu schema không. Không coi backup là “đã kiểm tra” cho tới khi đối chiếu khớp.
5. **Dọn staging sau restore thử:** xóa dữ liệu backup prod vừa restore, seed lại dữ liệu test cho staging (theo `supabase/seed/`). **Không để dữ liệu backup prod lẫn trong staging lâu dài** — staging không bao giờ chứa dữ liệu thật ngoài thời gian restore thử.
6. **Kiểm tra nhanh 1 luồng mẫu trên staging sau restore:** đăng nhập tài khoản test → mở 1 khóa học → kiểm tra bài học hiển thị đúng.

Bảng đối chiếu mẫu (ghi vào biên bản restore thử hàng tháng):

| Bảng | Số dòng prod (trước restore) | Số dòng staging (sau restore) | Khớp? |
|---|---|---|---|
| `courses` | 10 | 10 | ✓ |
| `policies` | 4 | 4 | ✓ |
| `leads` | (ghi số thật lúc kiểm tra) | (ghi số thật lúc kiểm tra) | |
| `profiles` | | | |
| `orders` | | | |
| `enrollments` | | | |
| `payments` | | | |
| `lesson_progress` | | | |
| `certificates` | | | |
| `email_logs` | | | |

> `courses` = 10 và `policies` = 4 là số liệu seed hiện tại theo tài liệu kiến trúc tổng thể và `DEPLOYMENT_ARCHITECTURE.md` §6.3. Nếu sau này thêm/bớt khóa hay chính sách, cập nhật 2 con số này trong biên bản (không sửa lịch sử biên bản cũ).

---

## 6. Cron giữ ấm — chống tạm dừng sau 7 ngày

### 6.1. Vấn đề

Supabase Free **tạm dừng project sau 7 ngày không hoạt động** — project tạm dừng thì website không truy cập được database cho tới khi resume thủ công. Đây là giới hạn chạm đầu tiên (cùng với Resend 100 email/ngày).

### 6.2. Giải pháp (0 đồng)

Cron gọi `GET /api/health` **mỗi ngày 1 lần** để project luôn được tính là “đang hoạt động”.

| Mục | Nội dung |
|---|---|
| Endpoint | `GET /api/health` — trả 200 khi Supabase kết nối được; 503 `not_configured` khi thiếu biến môi trường; 503 `supabase_error` khi Supabase lỗi/tạm dừng (theo `docs/RUNBOOK.md`) |
| Cách chạy | **1 trong 2, chốt khi lập trình:** (a) GitHub Actions chạy theo lịch gọi `curl` tới `/api/health` (mẫu dưới đây); (b) Cloudflare Workers Cron Trigger gọi `/api/health` mỗi ngày (miễn phí — cần xác minh giới hạn cron khi triển khai) |
| Tần suất | Mỗi ngày 1 lần (đủ để tránh ngưỡng 7 ngày; không gọi dày để tránh tốn quota Workers 100.000 request/ngày) |
| Kiểm tra | Log mỗi lần gọi; nếu `/api/health` không trả 200 → cảnh báo admin ngay — có thể project đã tạm dừng hoặc Supabase lỗi |

Khi nâng lên Supabase Pro (không tạm dừng), cron giữ ấm không còn cần thiết nhưng vẫn giữ làm health check hàng ngày.

### 6.3. Workflow mẫu — `.github/workflows/keep-warm.yml`

> File mẫu — dùng phương án (a) GitHub Actions. Nếu chọn phương án (b) Workers Cron Trigger thì không cần file này.

```yaml
name: Keep Supabase warm

# Mỗi ngày 1 lần, lúc 00:00 UTC (= 07:00 giờ Việt Nam).
on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Call /api/health (prod)
        run: |
          # Thay URL dưới bằng URL Workers API thật sau khi deploy.
          # Domain API https://api.visfaracademy.vn cần phê duyệt;
          # tạm thời dùng URL *.workers.dev của Workers prod.
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            https://api.visfaracademy.vn/api/health)
          echo "Health status: ${STATUS}"
          if [ "$STATUS" != "200" ]; then
            echo "HEALTH CHECK FAILED: /api/health tra ${STATUS} (mong doi 200)."
            exit 1
          fi

      - name: Notify admin on failure
        if: failure()
        run: |
          echo "CANH BAO: /api/health khong tra 200 — co the Supabase prod da tam dung."
          echo "Kiem tra dashboard Supabase -> Resume project (xem BACKUP_GUIDE.md §8.1)."
```

Lưu ý: cron giữ ấm chỉ giữ project không bị tạm dừng — **không thay thế backup (§4) và không thay thế giám sát**.

### 6.4. Khi project đã tạm dừng (phục hồi)

1. Vào dashboard Supabase → chọn project bị tạm dừng → **Resume project**.
2. Kiểm tra API hoạt động lại: gọi `GET /api/health` — phải trả 200.
3. Kiểm tra cron giữ ấm (§6.3) đang chạy — xem lịch sử chạy trong tab Actions (hoặc log Workers Cron Trigger).
4. Kiểm tra 1 luồng đăng ký mẫu (lead) hoạt động bình thường.
5. Ghi biên bản sự cố: ngày tạm dừng (nếu biết), ngày resume, nguyên nhân (VD cron giữ ấm lỗi / repo không hoạt động), biện pháp tránh lặp lại.

---

## 7. Quy trình phục hồi khi mất dữ liệu — từng bước

### 7.1. Nguyên tắc chung

1. **Bình tĩnh, không ghi thêm dữ liệu vào database đang lỗi** (dừng deploy, dừng migration, báo admin).
2. **Xác định phạm vi mất mát trước khi restore**: mất 1 bảng, mất vài dòng, hay mất toàn bộ project.
3. **Restore thử lên staging trước** (nếu có thời gian và sự cố chưa quá khẩn) để xác nhận file backup tốt — rồi mới restore lên prod.
4. **Luôn backup hiện trạng trước khi restore** (dump database đang lỗi — dù lỗi — ra file riêng, để còn đường quay lại nếu restore sai).
5. **Kiểm tra sau restore** bằng số dòng bảng chính + `/api/health` + 1 luồng đăng ký mẫu.
6. **Ghi biên bản sự cố**: thời gian phát hiện, phạm vi, file backup đã dùng, số dòng trước/sau, người thực hiện.

### 7.2. Tình huống A — Mất dữ liệu trong 1 bảng / vài dòng (VD xóa nhầm lead, đơn)

1. Xác định thời điểm dữ liệu còn đúng (VD lead bị xóa lúc 10:00 → dùng file backup hôm qua hoặc hôm nay trước 10:00 nếu đã có).
2. Tải file backup phù hợp từ R2 (hoặc repo backup riêng).
3. Restore file backup vào **database tạm** (§5.2), lấy ra các dòng bị mất bằng `SELECT` (không restore đè lên prod).
4. Chèn lại các dòng bị mất vào prod bằng câu lệnh `INSERT` có kiểm tra (hoặc qua Workers API/admin nếu có giao diện) — ghi `audit_logs` cho thao tác này.
5. Đối chiếu: đếm số dòng bảng đó trước/sau; kiểm tra 1–2 dòng mẫu hiển thị đúng trên admin.
6. Thông báo cho admin; ghi biên bản.

### 7.3. Tình huống B — Database lỗi / mất toàn bộ dữ liệu prod

1. **Dừng ghi:** báo admin; tạm dừng deploy và migration; nếu cần, bật trang bảo trì (thông báo ngắn, không ghi PII).
2. **Dump hiện trạng (nếu database còn truy cập được):** `pg_dump` database đang lỗi ra file riêng `backup-truoc-restore-YYYY-MM-DD-HHMM.sql.gz` — để còn đường quay lại.
3. **Chọn file backup:** file `pg_dump` mới nhất còn tốt trên R2 (ưu tiên R2; nếu R2 lỗi thì lấy từ repo backup riêng). Kiểm tra file: tồn tại, dung lượng > 0, ngày tạo gần nhất.
4. **Restore lên staging trước (nếu kịp):** theo §5.3 — xác nhận file backup restore được và số dòng khớp.
5. **Restore lên prod:** nếu project prod cũ còn dùng được thì restore vào cùng project; nếu project cũ lỗi không restore được thì tạo project Supabase mới (lưu ý: Free chỉ có 2 project — tạo project mới có thể cần xóa project lỗi cũ sau khi đã lấy đủ dữ liệu; quyết cùng user trước khi xóa bất cứ project nào) rồi restore vào project mới và cập nhật `SUPABASE_DB_URL` / key ở Workers Secrets + GitHub Secrets.
   ```bash
   gunzip -c backup-YYYY-MM-DD.sql.gz | psql "$SUPABASE_DB_URL"
   ```
6. **Kiểm tra sau restore:**
   - Đếm số dòng các bảng chính (§5.3) và đối chiếu với báo cáo hôm trước (R1/R9 — tổng lead, đơn, enrollment).
   - Gọi `GET /api/health` — phải trả 200.
   - Chạy 1 luồng đăng ký mẫu (tạo lead test) và kiểm tra lead ghi được vào database.
   - Kiểm tra đăng nhập bằng tài khoản test (lưu ý giới hạn Auth ở §2 — nếu đăng nhập lỗi sau restore toàn bộ project, xử lý theo §8.4).
7. **Thông báo cho admin** và ghi biên bản sự cố (xem §7.1 bước 6).
8. **Chạy lại backup ngay** sau khi prod ổn định, để có bản backup mới của trạng thái đã khôi phục.

### 7.4. Tình huống C — Mất file Storage (ảnh, poster, tài liệu)

1. Xác định file nào mất (đường dẫn trong `courses.poster_url`, `lessons.file_url`…).
2. Tải lại từ R2 (bản sao hàng tuần, §2 loại 5); nếu R2 không có thì lấy từ repo Git (file gốc).
3. Tải lại lên Supabase Storage đúng bucket/đường dẫn cũ.
4. Kiểm tra lại ảnh poster và tài liệu bài học hiển thị đúng trên trang.

### 7.5. Tình huống D — Mất code

`git clone` lại repo từ GitHub; deploy lại commit gần nhất qua Cloudflare Pages (deploy lỗi thì deploy lại commit trước đó — Pages giữ lại các deployment cũ).

### 7.6. Tình huống E — Mất secret

Xoay key (tạo key mới trong dashboard nhà cung cấp → cập nhật Cloudflare Workers Secrets + GitHub Secrets → deploy lại → kiểm tra `/api/health` và 1 request API mẫu → thu hồi key cũ). Danh sách tên biến xem §3.2 và `docs/RUNBOOK.md`.

---

## 8. Backup trước migration và rollback

- **Trước khi chạy migration lên prod: backup prod trước** (`pg_dump` theo §4, hoặc chạy tay workflow backup bằng `workflow_dispatch`), chạy thử migration trên staging, đối chiếu số dòng bảng chính.
- **Rollback code không rollback database.** `git revert` chỉ quay lại code; migration đã chạy không tự quay lại — cần migration mới sửa lại (không sửa migration cũ).
- **Migration lỗi trên staging:** dừng, không chạy lên prod; thêm migration mới sửa; chạy lại trên staging.
- **Migration lỗi trên prod:** restore database từ backup mới nhất (§7.3) **hoặc** migration mới khắc phục — quyết theo mức độ, ghi biên bản.

---

## 9. Checklist kiểm tra định kỳ

### 9.1. Mỗi ngày

- [ ] `GET /api/health` trả 200 (cron giữ ấm §6 chạy thành công).
- [ ] Backup hôm qua có file mới (workflow backup §4 chạy xanh; `backup-check.mjs` OK: file tồn tại, dung lượng > 0, ngày tạo là hôm nay).
- [ ] Báo cáo đối soát R9 không có đơn pending quá hạn / payment không khớp.
- [ ] Số email đã gửi trong ngày < 100 (giới hạn Resend Free).

### 9.2. Mỗi tuần

- [ ] Dung lượng DB Supabase còn bao nhiêu trong 500 MB; Storage còn bao nhiêu trong 1 GB.
- [ ] Số request Workers/ngày (giới hạn Free 100.000 request/ngày).
- [ ] Đồng bộ Storage lên R2 (bản sao hàng tuần, §2 loại 5).
- [ ] Restore thử file backup mới nhất vào database tạm (§5.2) — ít nhất 1 lần/tuần, hoặc sau mỗi lần đổi schema/migration.
- [ ] CI có lỗi tồn đọng không.

### 9.3. Mỗi tháng

- [ ] **Restore thử backup lên staging** (§5.3) + đối chiếu số dòng bảng chính + ghi biên bản restore thử.
- [ ] Rà soát lại giới hạn miễn phí trên trang pricing chính thức của Supabase / Cloudflare / Resend (giới hạn có thể thay đổi — cập nhật tài liệu nếu đổi).
- [ ] Rà soát secret: ai còn quyền, có cần xoay key không.
- [ ] Dọn file backup cũ: file ngày giữ 30 ngày, 1 bản/tháng giữ 12 tháng (§4.2).
- [ ] Kiểm tra dung lượng R2 (10 GB Free) còn đủ cho backup các tháng tới không.

### 9.4. Mỗi quý

- [ ] Rà soát toàn bộ giới hạn miễn phí + chi phí nâng cấp; quyết định có nâng gói không (cần phê duyệt bằng văn bản — xem §10).
- [ ] Rà soát quyền truy cập repo backup riêng (private): chỉ admin còn quyền; thu hồi quyền người đã rời đội.
- [ ] Xoay key định kỳ nếu đến hạn rà soát (service-role, Resend API key, R2 key, `BACKUP_REPO_TOKEN`).
- [ ] Diễn tập phục hồi toàn bộ (§7.3) 1 lần/quý trên staging — tính thời gian thực tế so với mục tiêu RTO ≤ 1 ngày làm việc, ghi biên bản.

---

## 10. Nâng cấp trả phí — khi nào thì backup tự động thay đổi

Ngưỡng nâng cấp **linh hoạt, tự cập nhật được, ban đầu dùng hoàn toàn miễn phí** (phê duyệt Task 02, quyết định 16; Quyết định 18: nâng cấp khi chạm tới giới hạn miễn phí — áp cho cả Supabase, Workers và Resend).

| Tín hiệu chạm giới hạn | Hành động 0 đồng trước | Khi nâng gói thì backup thay đổi thế nào |
|---|---|---|
| DB ≥ 400 MB / 500 MB (80%) | Dọn log cũ (log lưu trữ 12 tháng theo Task 03); chuyển Storage sang R2 | Supabase Pro (giá tham khảo tra cứu 10/11/2026: $25/tháng — **cần xác minh lại** trước khi nâng): DB 8 GB, **backup hàng ngày tự động** của Supabase, hết tạm dừng. `pg_dump` hàng ngày qua Actions vẫn giữ làm bản sao độc lập (không bỏ ngay) |
| Project tạm dừng sau 7 ngày (do ít traffic) | Resume thủ công; kiểm tra cron giữ ấm | Supabase Pro: hết tạm dừng; cron giữ ấm giữ lại làm health check |
| Storage ≥ 800 MB / 1 GB (80%) | Chuyển file sang R2 (10 GB miễn phí) | Chuyển hẳn Storage sang R2 |
| Resend ≥ 80 email/ngày (giới hạn 100/ngày) | Xếp hàng email nhắc sang hôm sau, ưu tiên email giao dịch | Resend Pro (giá tham khảo 10/11/2026: $20/tháng — **cần xác minh lại**) |
| Workers gần 100.000 request/ngày | Đọc công khai qua Supabase trực tiếp + cache | Workers Paid (giá tham khảo 10/11/2026: $5/tháng — **cần xác minh lại**) |

**Mỗi lần nâng gói cần phê duyệt riêng bằng văn bản; không tự nâng.** Sau khi nâng lên Supabase Pro và xác nhận backup tự động của Supabase chạy ổn + restore thử thành công, mới xem xét giảm tần suất `pg_dump` thủ công — không bỏ `pg_dump` ngay khi vừa nâng.

---

## 11. Việc cần user làm

> Các việc dưới đây chỉ user (chủ tài khoản) mới làm được — đội ngũ không có quyền truy cập tài khoản Supabase, không mật khẩu, không API key.

1. **Tạo 2 project Supabase Free** trên tài khoản Gmail `visfaracademy@gmail.com`: project 1 = production, project 2 = staging. Gửi lại tên/ref của 2 project (không gửi mật khẩu / key qua chat).
2. **Điền secret vào GitHub Secrets** của repo code chính theo tên ở §3.2 (`SUPABASE_DB_URL`, `SUPABASE_DB_URL_STAGING`, `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `BACKUP_REPO_TOKEN`, `ADMIN_NOTIFY_EMAIL`). Chỉ điền tên + giá trị thật trong GitHub Secrets — không gửi giá trị thật qua chat, không ghi vào tài liệu.
3. **Tạo repo backup riêng (private)** trên GitHub và tạo Cloudflare R2 bucket lưu backup; gửi lại tên repo và tên bucket (không gửi token/key qua chat).
4. **Chốt giờ chạy backup hàng ngày** (giờ ít traffic, múi giờ Việt Nam) và **chốt 1 trong 2 cơ chế cron giữ ấm**: (a) GitHub Actions theo lịch, hoặc (b) Workers Cron Trigger.
5. **Chốt kênh cảnh báo mức Cao khi Resend hết quota** (cảnh báo backup/quota cần kênh dự phòng vì email cảnh báo qua Resend cũng không gửi được khi hết quota — VD Zalo / email cá nhân).
6. **Chốt domain API thật** (`https://api.visfaracademy.vn` cần phê duyệt; tạm thời dùng `*.workers.dev`) để điền URL đúng vào workflow giữ ấm §6.3.
7. **Chạy thử lần đầu cùng đội ngũ:** chạy tay workflow backup (`workflow_dispatch`) sau khi điền secret → xác nhận file `backup-YYYY-MM-DD.sql.gz` xuất hiện trên R2 và repo backup riêng → chạy restore thử tháng đầu tiên lên staging theo §5.3 và xác nhận biên bản đối chiếu.
8. **Quét thử mã QR / kiểm tra khối chuyển khoản** — không thuộc phạm vi backup, ghi lại đây để không sót việc user đã hứa kiểm tra (QR trong khối chuyển khoản dùng file user tải lên; user tự quét thử để xác nhận ra đúng tài khoản nhận).

---

*Tài liệu hướng dẫn Backup & Phục hồi — Task 04 Supabase Backend Implementation — Visfar Academy — 10/11/2026 — Chờ user tạo project Supabase. Chưa chạy backup lên database thật. Mọi workflow và script trong tài liệu này đều là mẫu, chỉ chạy sau khi user hoàn thành §11.*
