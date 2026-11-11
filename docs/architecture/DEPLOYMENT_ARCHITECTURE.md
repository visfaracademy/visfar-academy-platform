# Kiến trúc triển khai (Deployment Architecture) — Visfar Academy

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt kiến trúc
**Thuộc TASK 02 — Visfar Academy**
**Chưa viết code, chưa tạo database, chưa deploy.** Tài liệu này chỉ mô tả kiến trúc triển khai để phê duyệt; mọi bước thực thi (tạo project, viết workflow, deploy) chỉ bắt đầu sau khi tài liệu được phê duyệt.

## Nguồn

| Nguồn | Vai trò đối với tài liệu này |
|---|---|
| `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (§12, §1–§2, §6) | Kiến trúc tổng thể v1.0 — giới hạn miễn phí, chiến lược backup/phục hồi, lộ trình mở rộng, cấu trúc repo |
| `workspace/visfar-academy-platform/docs/DECISIONS.md` | 19 quyết định đã chốt ngày 10/11/2026 (Next.js, SePay, nâng cấp trả phí khi chạm giới hạn, API lead ghi Sheet sau) |
| `workspace/visfar-academy-platform/docs/audit/IMPROVEMENT_PLAN.md` | Kế hoạch cải tiến 5 giai đoạn (0–4) — thứ tự triển khai, cổng kiểm soát |
| `workspace/visfar-academy-platform/docs/RUNBOOK.md` | Runbook vận hành — quy trình phục hồi chi tiết khi lập trình xong |

## Nguyên tắc

1. **0 đồng trước, trả phí chỉ khi được phê duyệt bằng văn bản.** Không dùng dịch vụ trả phí nào nếu chưa được chủ dự án phê duyệt. Mọi giới hạn miễn phí đều ghi rõ điểm chạm và phương án thay thế (theo Quyết định 18: nâng cấp trả phí khi chạm tới giới hạn miễn phí — áp cho cả Supabase, Workers và Resend).
2. **Không sửa file HTML gốc.** File `Visfar_Academy.html` chỉ là nguồn nội dung để chuyển (đọc, không sửa); mọi thay đổi sau Giai đoạn 1 của kế hoạch cải tiến đều diễn ra trên repo mới `visfar-academy-platform/`.
3. **Một nguồn sự thật.** PostgreSQL trên Supabase là database chính. Google Sheet (nếu còn dùng) chỉ là bản sao đối soát theo Quyết định 5 (API nhận lead, validate, chống spam/trùng, rồi ghi Sheet) — không phải database chính.
4. **Bảo mật theo mặc định.** RLS bật trên mọi bảng; service-role key chỉ ở server (Workers); secret không bao giờ commit vào repo.

---

# 1. Tổng quan kiến trúc triển khai

```
Lập trình viên
     │ git push / mở PR
     ▼
┌─────────────────────────────┐
│ GitHub                       │
│ - Repo visfar-academy-platform│
│ - Branch protection (main)   │
│ - GitHub Actions: CI/CD      │
└──────┬──────────────┬───────┘
       │ PR           │ merge main
       ▼              ▼
┌──────────────────┐ ┌──────────────────┐
│ Preview deployment│ │ Production deploy │
│ (Cloudflare      │ │ (Cloudflare      │
│  Pages, mỗi PR)  │ │  Pages + Workers) │
└──────────────────┘ └────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│ Supabase     │   │ Cloudflare       │   │ Resend       │
│ PostgreSQL / │   │ Workers (API)    │   │ Email giao   │
│ Auth /       │   │ /api/*           │   │ dịch +       │
│ Storage / RLS│   │                  │   │ automation   │
└──────────────┘   └──────────────────┘   └──────────────┘
```

- **Frontend:** Next.js (App Router) — đã chốt theo Quyết định 19, không còn tranh luận Next.js/Astro.
- **Hosting frontend:** Cloudflare Pages (static hosting, CDN toàn cầu, preview deployment).
- **Backend / API:** Cloudflare Workers (`/api/leads`, `/api/enrollments`, `/api/progress`, `/api/quiz`, `/api/orders`, `/api/webhooks`, `/api/reports`, `/api/health`).
- **Database / Auth / Storage:** Supabase (PostgreSQL, Auth, Storage, RLS).
- **Email:** Resend.
- **Video:** YouTube unlisted ở giai đoạn 0 đồng (không stream qua Supabase Storage hay Workers).
- **Thanh toán:** giai đoạn đầu chuyển khoản thủ công + đối soát; SePay webhook chỉ khi phê duyệt riêng (Quyết định 15 — tài khoản MB Bank, chủ tài khoản Công ty TNHH MTV Visfar Holdings; số tài khoản **không ghi vào tài liệu**).

---

# 2. Môi trường: dev / staging / prod

Supabase Free cho **2 project đang hoạt động** — đúng 2 project cần dùng, không còn project dự phòng. Phân bổ như sau:

| Môi trường | Frontend | API (Workers) | Supabase project | Database | Mục đích |
|---|---|---|---|---|---|
| **Dev** (local) | `localhost` (Next.js dev server) | Wrangler dev / local | Project staging (dùng chung) hoặc local Supabase CLI | Staging (không dùng dữ liệu thật) | Lập trình, test nhanh trên máy cá nhân |
| **Staging** | Preview deployment Cloudflare Pages (mỗi PR có 1 URL riêng) | Workers staging (deploy từ PR/branch) | **Project Supabase thứ 2** | Staging — dữ liệu test, seed khóa học mẫu | Kiểm thử trước khi lên prod; **nơi restore thử backup hàng tháng** |
| **Prod** | Cloudflare Pages production (domain chính) | Workers production | **Project Supabase thứ 1** | Production — dữ liệu thật duy nhất | Phục vụ học viên thật |

## 2.1. Quy tắc môi trường

- **Không bao giờ dùng dữ liệu thật ở staging/dev.** Dữ liệu staging chỉ là seed + dữ liệu test; xóa và seed lại được bất cứ lúc nào.
- **Không bao giờ chạy migration trực tiếp lên prod bằng tay.** Migration chỉ chạy qua quy trình có kiểm soát (xem §3.3): chạy thử trên staging trước, prod sau, mỗi migration đánh số thứ tự, không sửa migration cũ — chỉ thêm migration mới.
- **Staging là nơi duy nhất restore thử backup.** Vì Supabase Free chỉ có 2 project (prod + staging), việc restore thử hàng tháng (§6.3) dùng chính project staging — restore xong thì seed lại dữ liệu test, không để dữ liệu backup prod lẫn vào staging lâu dài.
- **Dev không có project Supabase riêng.** Lập trình viên dùng project staging (dữ liệu test) hoặc Supabase local qua CLI; không tạo project thứ 3 vì đã hết quota miễn phí.
- **Biến môi trường tách riêng theo môi trường** (xem §5): cùng tên biến, khác giá trị; prod dùng key prod, staging dùng key staging. Nhầm key staging/prod là lỗi cấm — kiểm tra bằng `/api/health` sau mỗi lần deploy (xem §7.1).

## 2.2. Tên miền

- **Tạm thời (giai đoạn dev/staging):** dùng domain mặc định `*.pages.dev` (Pages) và `*.workers.dev` (Workers).
- **Production:** domain chính + `api.visfaracademy.vn` cho Workers API (tên miền trong tài liệu kiến trúc tổng thể §7 — **cần phê duyệt**, xem §9).
- Không cấu hình domain production cho tới khi có phê duyệt tên miền.

---

# 3. CI/CD — GitHub Actions → Cloudflare Pages

## 3.1. Luồng tổng thể

```
                         ┌──────────────────────────────┐
  git push branch/PR ──► │ GitHub Actions — CI          │
                         │ 1. npm ci                    │
                         │ 2. typecheck (tsc --noEmit)  │
                         │ 3. lint                      │
                         │ 4. test (unit + kiểm tra     │
                         │    migration/seed nếu có)    │
                         │ 5. build (Next.js)           │
                         └──────────┬───────────────────┘
                                    │ CI xanh
                                    ▼
                         ┌──────────────────────────────┐
                         │ Cloudflare Pages             │
                         │ Preview deployment (URL riêng │
                         │ cho từng PR)                 │
                         └──────────────────────────────┘

  merge PR vào main ───► ┌──────────────────────────────┐
                         │ GitHub Actions — Deploy      │
                         │ (chạy lại đủ bước CI, rồi    │
                         │ deploy Pages + Workers prod) │
                         └──────────┬───────────────────┘
                                    ▼
                         ┌──────────────────────────────┐
                         │ Production                   │
                         │ Pages + Workers + migration  │
                         │ (staging trước, prod sau)    │
                         └──────────────────────────────┘
```

## 3.2. Workflow — 2 file (theo cấu trúc repo §2 tài liệu kiến trúc tổng thể)

| File | Chạy khi | Việc làm |
|---|---|---|
| `.github/workflows/ci.yml` | Mọi PR + mọi push lên branch (trừ `main`) | `npm ci` → typecheck → lint → test → build. **Không deploy.** Kết quả CI phải xanh mới được merge. |
| `.github/workflows/deploy.yml` | Merge vào `main` (push lên `main`) | Chạy lại đủ bước CI → deploy Cloudflare Pages production → deploy Workers production → kiểm tra `/api/health` trả 200. |

**Quy tắc CI/CD:**

- **Branch protection cho `main`:** không push trực tiếp lên `main`; mọi thay đổi qua PR + review; PR chỉ merge được khi CI xanh (typecheck, lint, test, build đều đạt).
- **Preview deployment cho mọi PR:** mỗi PR tự có 1 URL preview trên Cloudflare Pages để chủ dự án kiểm tra trên điện thoại thật (390px) và desktop (1440px) trước khi merge. Preview dùng project Supabase staging — không chạm dữ liệu prod.
- **Deploy prod chỉ khi merge vào `main`.** Không deploy prod từ branch, không deploy prod bằng tay từ máy cá nhân.
- **Build phải đạt trước khi deploy:** build lỗi → deploy dừng, prod giữ nguyên bản đang chạy.
- **Giới hạn miễn phí:** GitHub Actions Free 2.000 phút/tháng; Cloudflare Pages Free 500 build/tháng, 1 build đồng thời, build timeout 20 phút. Cả hai đều khó chạm ở giai đoạn đầu — nếu gần chạm, gộp commit để giảm số lần chạy CI, không nâng gói khi chưa phê duyệt.
- **Workers deploy:** deploy Workers qua `wrangler deploy` trong `deploy.yml` (dùng Wrangler token lưu trong GitHub Secrets — xem §5). Deploy Workers staging cho PR, Workers production chỉ khi merge `main`.

## 3.3. Migration database trong CI/CD

- Migration nằm trong `supabase/migrations/`, đánh số thứ tự (`0001_init_schema.sql`, `0002_seed_courses.sql`, `0003_seed_content.sql`, …).
- **Thứ tự chạy:** migration chạy lên **staging trước**, kiểm tra xong mới chạy lên **prod** (chạy bằng Supabase CLI với 2 project riêng).
- **Không sửa migration cũ** — sai thì thêm migration mới sửa lại.
- **Chưa có migration nào ở thời điểm viết tài liệu này** (Giai đoạn 0 của kế hoạch cải tiến chỉ chuẩn bị danh mục migration). Migration đầu tiên được viết ở Giai đoạn 2–3.
- Trước khi chạy migration lên prod: backup prod trước (pg_dump, xem §6), chạy thử trên staging, đối chiếu số dòng bảng chính.

---

# 4. Sơ đồ triển khai chi tiết (theo môi trường)

| Thành phần | Dev (local) | Staging | Prod |
|---|---|---|---|
| Frontend | `next dev` trên máy cá nhân | Preview deployment (mỗi PR) | Cloudflare Pages production |
| Workers API | `wrangler dev` | Workers staging | Workers production |
| Supabase | Project staging / Supabase local | Project thứ 2 | Project thứ 1 |
| Resend | Không gửi thật (log + ghi `email_logs` ở staging) | Domain test / gửi tới email test | Domain riêng đã xác minh DNS (SPF, DKIM, DMARC) |
| Google Sheet | Không | Không bắt buộc | Bản sao đối soát (chỉ khi API lead ổn định, theo Quyết định 5) |
| Dữ liệu | Test | Test / seed | Thật — duy nhất |

---

# 5. Secrets — quản lý khóa và biến môi trường

## 5.1. Nơi lưu secret

| Secret | Lưu ở | Ai dùng |
|---|---|---|
| Supabase service-role key | **Cloudflare Workers Secrets** (chỉ Workers production/staging) + GitHub Secrets (cho workflow backup/migration) | Chỉ Workers API (server). **Không bao giờ ở frontend, không bao giờ trong repo.** |
| Resend API key | Cloudflare Workers Secrets | Chỉ Workers API (server). |
| Webhook secret (SePay / Stripe / Resend) | Cloudflare Workers Secrets | Workers API — xác minh chữ ký webhook. |
| Supabase anon key + URL | Cloudflare Pages env vars (public, nhưng bị RLS chặn) + `.env.local` ở máy dev | Frontend (anon key chỉ đọc nội dung công khai qua RLS). |
| Cloudflare API token / Account ID | **GitHub Secrets** | GitHub Actions — deploy Pages/Workers. |
| Supabase access token / DB password (cho pg_dump, migration) | **GitHub Secrets** | GitHub Actions — backup hàng ngày, chạy migration. |
| Wrangler token | **GitHub Secrets** | GitHub Actions — deploy Workers. |

## 5.2. Quy tắc bắt buộc

- **Không commit `.env`, `.env.local`, hay bất kỳ file nào chứa secret.** `.gitignore` chặn `.env*` (trừ `.env.example`).
- **`.env.example` chỉ chứa tên biến + giá trị mẫu giả, không chứa giá trị thật.** Ví dụ: `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY=<chi-duoc-dat-tren-server>`.
- **Danh sách biến môi trường (tên, không kèm giá trị)** lưu trong tài liệu vận hành (`docs/RUNBOOK.md`) để khi mất secret thì nhập lại được. Giá trị secret chỉ nằm trong Cloudflare Workers Secrets / GitHub Secrets.
- **Service-role key bypass RLS** — lộ key này là lộ toàn bộ database. Key này **không bao giờ** xuất hiện trong code frontend, log, email, hay ảnh chụp màn hình.
- **Không đưa PII (họ tên/SĐT/email) vào log, URL, hay biến môi trường.** Log chỉ ghi `reference_code` và `user_id`.
- **Xoay key (rotate) khi:** có người rời đội; nghi ngờ lộ key; định kỳ rà soát mỗi quý. Quy trình xoay key: tạo key mới trong dashboard nhà cung cấp → cập nhật Cloudflare Workers Secrets + GitHub Secrets → deploy lại → kiểm tra `/api/health` và 1 request API mẫu → thu hồi key cũ. Chi tiết từng bước ghi trong `docs/RUNBOOK.md` khi lập trình.
- **Anon key lộ không nguy hiểm bằng service-role key** (anon bị RLS chặn), nhưng vẫn phải xoay khi phát hiện lộ.
- **Số tài khoản ngân hàng / QR VietQR:** không ghi vào tài liệu, không ghi vào biến môi trường công khai; chỉ dùng file/ảnh do chủ dự án cung cấp (Quyết định 15).

## 5.3. Danh sách biến môi trường theo môi trường (tên biến)

| Biến | Frontend (Pages) | Workers (server) | Ghi chú |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ (mọi môi trường) | ✓ | URL project Supabase (khác nhau prod/staging) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ (mọi môi trường) | ✓ | Anon key (bị RLS chặn) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✗ không bao giờ | ✓ (Workers Secrets) | Chỉ server |
| `SUPABASE_DB_URL` / `DATABASE_URL` | ✗ | Chỉ GitHub Actions (backup/migration) | Dùng cho `pg_dump`, không dùng trong code chạy production |
| `RESEND_API_KEY` | ✗ | ✓ (Workers Secrets) | Chỉ server |
| `RESEND_WEBHOOK_SECRET` | ✗ | ✓ (Workers Secrets) | Xác minh webhook Resend |
| `SEPAY_WEBHOOK_SECRET` | ✗ | ✓ (Workers Secrets, khi dùng SePay) | Chỉ khi SePay được phê duyệt |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | ✗ | Chỉ GitHub Secrets | Deploy qua Actions |
| `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | ✗ | Chỉ GitHub Secrets | Lưu backup (§6) |

---

# 6. Backup và phục hồi

## 6.1. Vấn đề gốc

**Supabase Free không có backup tự động hàng ngày và không có SLA.** Nếu không tự backup, mất database đồng nghĩa với mất toàn bộ lead, học viên, đơn hàng. Vì vậy backup là việc **bắt buộc, tự động, kiểm tra được** — không phải việc "làm sau".

## 6.2. Backup — cái gì, lưu ở đâu, bao lâu một lần

| Hạng mục | Cách backup | Tần suất | Nơi lưu | Giữ bao lâu |
|---|---|---|---|---|
| **Database (Supabase)** | `pg_dump` qua Supabase CLI / `npx supabase db dump`, chạy tự động bằng **GitHub Actions hàng ngày** (workflow riêng, chạy theo lịch — xem §6.4) | **Hàng ngày** | **Cả 2 nơi:** (1) repo backup riêng (private, không phải repo code chính), (2) Cloudflare R2 (Free: 10 GB, không phí egress) | File `.sql` hàng ngày giữ 30 ngày gần nhất; 1 bản/tháng giữ 12 tháng |
| **Storage (ảnh, poster, tài liệu)** | File gốc lưu trong repo Git (ảnh dùng chung) + Supabase Storage; đồng bộ 1 bản sao lên R2 | **Hàng tuần** | R2 + repo Git | Bản mới nhất + 2 bản trước |
| **Code** | GitHub là nguồn chính | Mọi commit | GitHub (repo chính) | Toàn bộ lịch sử Git |
| **Cấu hình (biến môi trường)** | Danh sách tên biến trong tài liệu vận hành; **giá trị secret chỉ trong Workers Secrets / GitHub Secrets** (xem §5) | Khi thay đổi | `docs/RUNBOOK.md` (tên biến) + Cloudflare/GitHub Secrets (giá trị) | Theo thay đổi |
| **Nội dung (CMS)** | Nội dung nằm trong database → backup cùng database; file seed (`supabase/seed/`) lưu trong Git | Mỗi lần seed thay đổi | Git + backup DB | Theo Git |
| **Email log** | Bảng `email_logs` trong database (backup cùng DB); log Resend chỉ giữ 30 ngày nên không dựa vào Resend làm nguồn đối soát | Cùng backup DB | Database | Theo backup DB |
| **Google Sheet (nếu còn)** | Sheet là bản sao — giữ bản sao Sheet trước mỗi lần sửa Apps Script / thay đổi luồng lead | Trước mỗi lần sửa | Google Drive | Theo thay đổi |

**Kiểm tra backup hàng ngày:** script `scripts/backup-check.mjs` (đã nêu trong tài liệu kiến trúc tổng thể §2 và §12.2) chạy trong workflow backup — kiểm tra file backup mới nhất có tồn tại, có dung lượng > 0, và có ngày tạo là hôm nay; nếu không, báo lỗi cho admin (xem §7.2).

**Lưu ý về repo backup riêng:** backup database chứa PII (họ tên, SĐT, email học viên) nên repo backup phải là **private**, chỉ admin truy cập, không public, không fork. Không lưu file backup `.sql` vào repo code chính.

## 6.3. Phục hồi — quy trình và kiểm tra

**Nguyên tắc: backup chưa từng restore thử thì coi như chưa có backup.**

| # | Bước | Chi tiết |
|---|---|---|
| 1 | **Restore thử hàng tháng** | Mỗi tháng 1 lần, restore file backup mới nhất lên **project Supabase staging** (project miễn phí thứ 2) bằng `psql`. Sau đó đếm số dòng các bảng chính (`courses` = 10, `policies` = 4, `leads`, `profiles`, `orders`, `enrollments`) và đối chiếu với production. Khớp → ghi biên bản restore thử; lệch → điều tra ngay. |
| 2 | **Khôi phục khi database lỗi / mất dữ liệu** | Restore từ file `pg_dump` mới nhất (từ R2 hoặc repo backup riêng) vào project Supabase mới (nếu project cũ lỗi) hoặc cùng project → kiểm tra số lượng lead/order/enrollment khớp với báo cáo hôm trước → thông báo cho admin → kiểm tra `/api/health` và 1 luồng đăng ký mẫu. |
| 3 | **Khôi phục khi Storage mất file** | Tải lại từ R2 / repo Git; kiểm tra lại ảnh poster và tài liệu bài học hiển thị đúng. |
| 4 | **Khôi phục khi mất code** | `git clone` lại từ GitHub; deploy lại commit gần nhất qua Cloudflare Pages. |
| 5 | **Khôi phục khi mất secret** | Xoay key (xem §5.2) → cập nhật Workers Secrets → deploy lại → kiểm tra API. |
| 6 | **Khôi phục khi Supabase project bị tạm dừng** | Vào dashboard Supabase → Resume project → kiểm tra API hoạt động lại → kiểm tra cron giữ ấm (§7.1) đang chạy. |

**Mục tiêu phục hồi (RTO/RPO — mục tiêu, chưa cam kết SLA vì gói miễn phí không có SLA):**

| Chỉ số | Mục tiêu giai đoạn 0 đồng | Ghi chú |
|---|---|---|
| RPO (mất tối đa bao nhiêu dữ liệu) | ≤ 24 giờ (backup hàng ngày) | Muốn RPO nhỏ hơn thì tăng tần suất dump — cần phê duyệt chi phí/thời gian |
| RTO (khôi phục trong bao lâu) | ≤ 1 ngày làm việc (restore thủ công theo runbook) | Chưa có restore tự động ở giai đoạn 0 đồng |

## 6.4. Workflow backup tự động (GitHub Actions — mô tả, chưa viết)

- **Lịch chạy:** hàng ngày (giờ chạy cụ thể chốt khi lập trình — ưu tiên giờ ít traffic, múi giờ Việt Nam).
- **Việc làm:** (1) `pg_dump` database prod qua Supabase CLI (dùng secret trong GitHub Secrets); (2) nén + đặt tên file theo ngày (`backup-YYYY-MM-DD.sql.gz`); (3) tải lên R2 và push lên repo backup riêng (private); (4) chạy `scripts/backup-check.mjs` để xác nhận file mới có dung lượng > 0; (5) nếu bất kỳ bước nào lỗi → báo cho admin (xem §7.2).
- **Không chạy backup trên máy cá nhân** — chỉ chạy qua GitHub Actions để có lịch sử chạy, log, và không phụ thuộc 1 người.
- **Giới hạn miễn phí:** GitHub Actions Free 2.000 phút/tháng — 1 lần dump/ngày là rất nhỏ so với giới hạn; R2 Free 10 GB — đủ chứa nhiều tháng backup `.sql` đã nén (database giai đoạn đầu nhỏ hơn nhiều so với 500 MB).

---

# 7. Giám sát và cảnh báo

## 7.1. Cron giữ ấm Supabase — chống tạm dừng sau 7 ngày

**Vấn đề:** Supabase Free **tạm dừng project sau 7 ngày không hoạt động** — project tạm dừng thì website không truy cập được database cho tới khi resume thủ công. Đây là giới hạn chạm đầu tiên (cùng với Resend 100 email/ngày), theo tài liệu kiến trúc tổng thể §12.1.

**Giải pháp (0 đồng):** cron gọi `GET /api/health` **mỗi ngày 1 lần** để project luôn được tính là "đang hoạt động".

| Mục | Nội dung |
|---|---|
| Endpoint | `GET /api/health` — trả 200 khi Supabase kết nối được; 503 `not_configured` khi thiếu biến môi trường; 503 `supabase_error` khi Supabase lỗi/tạm dừng (theo `docs/RUNBOOK.md` §3) |
| Cách chạy | **1 trong 2, chốt khi lập trình:** (a) GitHub Actions chạy theo lịch (scheduled workflow) gọi `curl` tới `/api/health`; (b) Cloudflare Workers Cron Trigger gọi `/api/health` mỗi ngày (miễn phí — cần xác minh giới hạn cron khi triển khai) |
| Tần suất | Mỗi ngày 1 lần (đủ để tránh ngưỡng 7 ngày; không gọi dày để tránh tốn quota Workers 100.000 request/ngày) |
| Kiểm tra | Log mỗi lần gọi; nếu `/api/health` không trả 200 → cảnh báo admin ngay (xem §7.2) — vì đó có thể là dấu hiệu project đã tạm dừng hoặc Supabase lỗi |

**Lưu ý:** cron giữ ấm chỉ giữ project không bị tạm dừng — không thay thế backup (§6) và không thay thế giám sát (§7.2). Khi nâng lên Supabase Pro (không tạm dừng), cron giữ ấm không còn cần thiết nhưng vẫn giữ làm health check hàng ngày.

## 7.2. Giám sát — log và cảnh báo

### Log — xem ở đâu

| Nguồn log | Xem ở đâu | Dùng để phát hiện |
|---|---|---|
| Cloudflare Pages (build + runtime) | Dashboard Cloudflare Pages → Deployments / Functions log | Build lỗi, deploy lỗi, lỗi runtime frontend |
| Cloudflare Workers (API) | Dashboard Cloudflare Workers → Logs / `wrangler tail` | Lỗi API (5xx), request bất thường, rate-limit chạm ngưỡng |
| Supabase (Postgres + Auth) | Dashboard Supabase → Logs / Database | Lỗi query, RLS chặn sai, đăng nhập bất thường, dung lượng DB |
| Resend | Dashboard Resend + bảng `email_logs` trong database | Email failed/bounced, chạm quota ngày |
| GitHub Actions | Tab Actions của repo | CI lỗi, backup lỗi, deploy lỗi |
| Báo cáo đối soát | `GET /api/admin/reports/reconciliation` (R9) | Đơn pending quá 48h, đơn paid chưa có enrollment, payment không khớp, webhook lỗi |

### Cảnh báo — khi nào báo cho admin

| # | Điều kiện cảnh báo | Mức | Cách báo (chốt kênh khi lập trình) |
|---|---|---|---|
| 1 | **API lỗi:** Workers trả 5xx vượt ngưỡng (VD > 10 lỗi/giờ hoặc 1 endpoint lỗi liên tục) | Cao | Email admin + kiểm tra log Workers ngay |
| 2 | **`/api/health` không trả 200** (cron giữ ấm thất bại) | Cao | Email admin ngay — có thể Supabase đã tạm dừng |
| 3 | **Resend sắp hết quota:** đã gửi ≥ 80 email trong ngày (ngưỡng 100 email/ngày) hoặc lỗi `daily_quota_exceeded` | Cao | Email admin; chuyển sang chế độ xếp hàng — ưu tiên email giao dịch (E3/E5/E8), dời email nhắc (E6/E7/E10) sang hôm sau |
| 4 | **Supabase sắp hết dung lượng:** DB ≥ 400 MB / 500 MB (80%) hoặc Storage ≥ 800 MB / 1 GB (80%) | Cao | Email admin; dọn log cũ, chuyển Storage sang R2; chuẩn bị nâng Pro (cần phê duyệt) |
| 5 | **Workers sắp hết quota:** request/ngày gần 100.000 | Trung bình | Email admin; đọc công khai qua Supabase trực tiếp (không qua Workers), bật cache |
| 6 | **Backup thất bại:** workflow backup hàng ngày lỗi hoặc file backup không mới | Cao | Email admin; backup lại bằng tay ngay trong ngày |
| 7 | **CI/CD thất bại:** deploy prod lỗi | Cao | Email admin; prod giữ bản cũ, không deploy lại khi chưa rõ nguyên nhân |
| 8 | **Webhook lỗi:** SePay/Stripe/Resend webhook xác minh chữ ký thất bại hoặc xử lý lỗi | Cao | Email admin + kiểm tra R9 (đối soát) |
| 9 | **Đăng nhập / RLS bất thường:** nhiều lần đăng nhập thất bại từ 1 IP, hoặc log RLS chặn bất thường | Trung bình | Email admin; xem xét chặn IP / xoay key |

**Kênh cảnh báo:** ở giai đoạn 0 đồng, cảnh báo qua **email tới admin** (dùng Resend — lưu ý: nếu Resend hết quota thì email cảnh báo cũng không gửi được, nên cảnh báo mức Cao về backup/quota cần có kênh dự phòng; kênh dự phòng — VD Zalo/email cá nhân — **chốt khi lập trình**, xem §9). Không dùng dịch vụ giám sát trả phí (VD PagerDuty, Datadog) khi chưa phê duyệt.

### Kiểm tra định kỳ (vận hành, không phải code)

| Tần suất | Việc kiểm tra |
|---|---|
| **Mỗi ngày** | `/api/health` trả 200; backup hôm qua có file mới; R9 (đối soát) không có đơn pending quá hạn / payment không khớp; số email đã gửi trong ngày (< 100) |
| **Mỗi tuần** | Dung lượng DB Supabase còn bao nhiêu trong 500 MB; Storage còn bao nhiêu trong 1 GB; số request Workers/ngày; CI có lỗi tồn đọng không |
| **Mỗi tháng** | Restore thử backup lên staging (§6.3); rà soát lại giới hạn miễn phí trên trang pricing chính thức của Supabase/Cloudflare/Resend (giới hạn có thể thay đổi); rà soát secret (ai còn quyền, có cần xoay key không) |
| **Mỗi quý** | Rà soát toàn bộ giới hạn miễn phí + chi phí nâng cấp; quyết định có nâng gói không (cần phê duyệt) |

---

# 8. Rollback — quay lại bản chạy tốt

## 8.1. Nguyên tắc

- **Rollback code không rollback database.** `git revert` chỉ quay lại code; migration database đã chạy không tự quay lại — cần migration mới sửa lại (không sửa migration cũ). Vì vậy **chạy migration lên prod phải có backup trước** (§6.3).
- **Prod luôn giữ được bản đang chạy** khi deploy mới lỗi: deploy lỗi → CI dừng, prod không đổi.

## 8.2. Các cách rollback

| Tình huống | Cách rollback | Chi tiết |
|---|---|---|
| Deploy Pages lỗi / trang mới vỡ giao diện | **Deploy lại commit cũ trên Cloudflare Pages** | Cloudflare Pages giữ lại các deployment cũ — chọn deployment của commit trước đó và "Rollback" / redeploy. Không cần push code mới. |
| Deploy Workers API lỗi | **Deploy lại commit trước bằng Wrangler** | `git checkout <commit-cu>` → `wrangler deploy` (hoặc deploy lại từ GitHub Actions với commit cũ). Tài liệu kiến trúc tổng thể §12.2: giữ lại 5 commit gần nhất để rollback. |
| Code mới có bug nghiệp vụ (đã deploy prod) | **`git revert` commit lỗi → PR → CI xanh → merge main → deploy tự động** | `git revert` tạo commit mới hoàn tác thay đổi (giữ lịch sử Git), không dùng `git reset --hard` trên `main`. |
| Migration lỗi trên staging | Dừng, không chạy lên prod; thêm migration mới sửa; chạy lại trên staging | Không bao giờ chạy migration lỗi lên prod để "sửa sau" |
| Migration lỗi trên prod | Restore database từ backup mới nhất (§6.3) **hoặc** migration mới khắc phục — quyết theo mức độ, ghi biên bản | Đây là trường hợp xấu nhất; phòng ngừa bằng backup trước migration + chạy thử staging |
| Secret mới làm API chết | Quay lại secret cũ trong Workers Secrets → deploy lại | Kiểm tra `/api/health` sau khi quay lại |

## 8.3. Preview deployment giữ lại để đối chiếu

- Mỗi PR có preview deployment riêng — khi phát hiện lỗi ở prod, có thể mở preview của commit trước đó để đối chiếu hành vi (preview dùng staging, không chạm dữ liệu prod).
- Không xóa preview deployment của commit đang chạy prod cho tới khi bản mới đã chạy ổn định ít nhất 1 ngày.

---

# 9. Lộ trình mở rộng 100 → 1.000 → 10.000 học viên

Lộ trình theo tài liệu kiến trúc tổng thể §12.3. **Nguyên tắc mở rộng: không thay kiến trúc khi tăng quy mô — chỉ thay giới hạn (nâng gói) và thay lớp lưu trữ video/thanh toán khi có phê duyệt.** Schema database (§3 tài liệu kiến trúc tổng thể) đã thiết kế để chứa 10.000 học viên mà không cần đổi bảng.

| Giai đoạn | Học viên | Thay đổi triển khai | Chi phí dự kiến |
|---|---|---|---|
| **Giai đoạn 1: 0–100 học viên** | 100 | Stack 0 đồng như tài liệu này. Video YouTube unlisted. Thanh toán chuyển khoản thủ công + đối soát. Email Resend Free (≤100/ngày). Supabase Free + cron giữ ấm hàng ngày. Backup pg_dump hàng ngày qua GitHub Actions. | **0 đồng/tháng** |
| **Giai đoạn 2: 100–1.000 học viên** | 1.000 | Nâng **Supabase Pro $25/tháng** (hết tạm dừng, DB 8 GB, backup hàng ngày tự động) — **cần phê duyệt**. Chuyển Storage sang **R2** (10 GB miễn phí). SePay webhook (nếu phê duyệt) để tự động đối soát. Cron giữ ấm không còn bắt buộc nhưng giữ làm health check. | ~$25/tháng + SePay (cần xác minh giá) |
| **Giai đoạn 3: 1.000–10.000 học viên** | 10.000 | Nâng **Workers Paid $5/tháng** (10M request/tháng, CPU 30s). Nâng **Resend Pro $20/tháng** (50.000 email, không giới hạn ngày). Video chuyển sang Cloudflare Stream / Mux (có phí, cần phê duyệt) nếu cần bảo mật. Thêm cache (Cloudflare KV / Cache API) cho nội dung công khai. Tách read replica nếu Supabase cho phép (Pro). | ~$50/tháng + video + SePay/Stripe |
| **Giai đoạn 4: >10.000 học viên** | 10.000+ | Xem xét Supabase Team / dedicated, hoặc tách database riêng; CDN + cache toàn diện; đội vận hành; SLA; **kiểm tra tải (load test) trước mỗi đợt ra mắt lớn**. | Theo báo giá lúc đó — **không cam kết số trong tài liệu này** |

**Giá tham khảo:** Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng — tra cứu ngày 10/11/2026 (Quyết định 18), **cần xác minh lại trước khi nâng**. Ba giới hạn chạm đầu tiên theo thứ tự dự kiến: (1) **Resend 100 email/ngày**, (2) **Supabase tạm dừng sau 7 ngày không hoạt động**, (3) **Supabase DB 500 MB / Storage 1 GB**.

**Điểm chạm giới hạn và tín hiệu nâng cấp:**

| Giới hạn | Tín hiệu chạm | Hành động |
|---|---|---|
| Resend 100 email/ngày | Lỗi `daily_quota_exceeded` hoặc ≥80 email/ngày nhiều ngày liên tiếp | Xếp hàng email nhắc; xin phê duyệt Resend Pro $20 |
| Supabase tạm dừng 7 ngày | `/api/health` không trả 200 sau 7 ngày ít traffic | Resume thủ công; xin phê duyệt Supabase Pro $25 |
| Supabase DB 500 MB | DB ≥ 400 MB (80%) | Dọn log cũ; xin phê duyệt Supabase Pro $25 |
| Supabase Storage 1 GB | Storage ≥ 800 MB (80%) | Chuyển sang R2 (miễn phí 10 GB) |
| Workers 100.000 request/ngày | Request/ngày gần giới hạn | Đọc công khai qua Supabase trực tiếp + cache; xin phê duyệt Workers Paid $5 |
| Pages 500 build/tháng | Build/tháng gần 500 | Gộp commit, giảm số lần deploy |

---

# 10. Rủi ro triển khai và giảm thiểu

| # | Rủi ro | Mức | Giảm thiểu (trong tài liệu này) |
|---|---|---|---|
| R1 | Supabase Free tạm dừng sau 7 ngày → website chết | Cao | Cron giữ ấm mỗi ngày (§7.1); nâng Pro khi có doanh thu (cần phê duyệt) |
| R2 | Resend 100 email/ngày → email chào mừng lỗi ngày ra mắt | Cao | Xếp hàng email, ưu tiên giao dịch (§7.2); nâng Pro khi cần (cần phê duyệt) |
| R3 | Workers 100.000 request/ngày → API chết ngày cao điểm | Trung bình | Đọc công khai qua Supabase trực tiếp; cache; nâng Paid $5 khi cần |
| R4 | Backup chưa từng restore thử → khi cần mới biết backup hỏng | Cao | Restore thử hàng tháng lên staging (§6.3); kiểm tra backup hàng ngày bằng script |
| R5 | Secret lộ (service-role, Resend key) | Cao | Secret chỉ trong Workers Secrets/GitHub Secrets; xoay key định kỳ; không commit `.env` (§5) |
| R6 | Deploy lỗi lên prod (không có preview kiểm tra) | Trung bình | CI bắt buộc xanh + preview deployment cho mọi PR (§3); rollback bằng deploy lại commit cũ (§8) |
| R7 | Nhầm key staging/prod | Cao | Biến môi trường tách riêng theo môi trường; kiểm tra `/api/health` sau mỗi deploy (§2.1, §7.1) |
| R8 | Nhà cung cấp đổi giới hạn miễn phí | Trung bình | Rà soát trang pricing mỗi tháng/quý (§7.2); số trong tài liệu này là snapshot 10/11/2026, xác minh lại trước khi triển khai |
| R9 | Phụ thuộc 1 người vận hành | Trung bình | Runbook (`docs/RUNBOOK.md`); backup tự động qua Actions; GitHub + Cloudflare đều có lịch sử deploy |
| R10 | Migration lỗi trên prod | Cao | Backup trước migration; chạy thử staging trước; không sửa migration cũ (§3.3, §6.3) |

---

# 11. Quyết định cần phê duyệt

Tài liệu này **chờ phê duyệt kiến trúc** — chưa viết code, chưa tạo database, chưa deploy. Các quyết định dưới đây cần chủ dự án phê duyệt (bằng văn bản) trước khi triển khai:

| # | Quyết định cần phê duyệt | Lựa chọn đề xuất (trong tài liệu này) | Ghi chú |
|---|---|---|---|
| 1 | **Phê duyệt kiến trúc triển khai này** (môi trường, CI/CD, secrets, backup, giám sát, rollback, lộ trình mở rộng) | Phê duyệt toàn bộ tài liệu | Sau phê duyệt mới bắt đầu tạo project/tài khoản và viết workflow |
| 2 | **Phân bổ 2 project Supabase Free** | Project 1 = prod, project 2 = staging (đồng thời là nơi restore thử backup) | Supabase Free chỉ có 2 project — không còn project dự phòng; dev dùng chung staging hoặc Supabase local |
| 3 | **Luồng CI/CD** | PR → CI (typecheck, lint, test, build) → preview deployment; merge `main` → deploy prod; branch protection cho `main` | Theo §3; workflow `.github/workflows/ci.yml` + `deploy.yml` |
| 4 | **Tên miền production** | Domain chính + `api.visfaracademy.vn` cho Workers API | Tạm dùng `*.pages.dev` / `*.workers.dev` ở giai đoạn dev; domain production cần phê duyệt riêng |
| 5 | **Nơi lưu backup database** | Cả 2 nơi: repo backup riêng (private) + Cloudflare R2 | Backup chứa PII nên repo backup phải private; cần phê duyệt việc tạo repo backup riêng |
| 6 | **Cơ chế cron giữ ấm** | 1 trong 2: (a) GitHub Actions theo lịch, hoặc (b) Workers Cron Trigger — gọi `GET /api/health` mỗi ngày | Chốt 1 cơ chế khi lập trình; cả hai đều 0 đồng (cần xác minh giới hạn cron khi triển khai) |
| 7 | **Kênh cảnh báo cho admin** | Email tới admin (qua Resend) + kênh dự phòng khi Resend hết quota (VD Zalo/email cá nhân) | Kênh dự phòng chưa chốt — cần chủ dự án cho biết kênh nhận cảnh báo mức Cao |
| 8 | **Ngưỡng cảnh báo** | DB ≥ 80% (400 MB/500 MB), Storage ≥ 80% (800 MB/1 GB), Resend ≥ 80 email/ngày, `/api/health` không trả 200 | Theo §7.2; chủ dự án có thể điều chỉnh ngưỡng |
| 9 | **Mục tiêu phục hồi RTO/RPO** | RPO ≤ 24 giờ, RTO ≤ 1 ngày làm việc (khôi phục thủ công theo runbook) | Chưa có SLA vì gói miễn phí không có SLA; RPO nhỏ hơn cần tăng tần suất dump |
| 10 | **Ngưỡng nâng cấp trả phí** | Nâng gói khi chạm giới hạn miễn phí (Quyết định 18): Supabase Pro $25, Workers Paid $5, Resend Pro $20/tháng — giá tra cứu 10/11/2026, xác minh lại trước khi nâng | Mỗi lần nâng gói cần phê duyệt riêng bằng văn bản; không tự nâng |
| 11 | **Giờ chạy backup hàng ngày** | Giờ ít traffic, múi giờ Việt Nam (chốt khi lập trình) | Backup chạy qua GitHub Actions theo lịch |
| 12 | **Xác minh lại giới hạn miễn phí** | Xác minh lại trên trang pricing chính thức của Supabase, Cloudflare, Resend **tại thời điểm bắt đầu lập trình** | Số trong tài liệu này là snapshot tra cứu ngày 10/11/2026, nhà cung cấp có thể thay đổi |

**Các quyết định đã chốt trước (không hỏi lại):** Next.js là framework frontend (Quyết định 19); thanh toán giai đoạn đầu là chuyển khoản thủ công, SePay khi phê duyệt riêng (Quyết định 15); nâng cấp trả phí khi chạm giới hạn (Quyết định 18); API lead làm lớp trước rồi ghi Sheet (Quyết định 5); số tài khoản ngân hàng không ghi vào tài liệu (Quyết định 15).

---

*Tài liệu kiến trúc triển khai — TASK 02 Visfar Academy — 10/11/2026 — Chờ phê duyệt kiến trúc. Chưa viết code, chưa tạo database, chưa deploy.*
