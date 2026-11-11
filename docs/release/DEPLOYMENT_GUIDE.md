# Hướng dẫn triển khai (Deployment Guide) — Visfar Academy

- **Ngày:** 10/11/2026 (Task 12 — cửa nghiệm thu cuối cùng)
- **Nguồn:** `docs/architecture/DEPLOYMENT_ARCHITECTURE.md` (Task 02), `docs/supabase/SUPABASE_SETUP.md`, `docs/supabase/ENVIRONMENT_CONFIG.md`, `docs/supabase/MIGRATION_GUIDE.md`, `docs/DECISIONS.md` (19 quyết định đã chốt + Task 02 QĐ 1–16 + Task 03).
- **Trạng thái hiện tại (snapshot 10/11/2026 ~24:00 +07):** **CHƯA TRIỂN KHAI PRODUCTION.** Code chạy local + staging Supabase; chưa có repo GitHub remote, chưa có Cloudflare Pages/Workers production, chưa có domain production. Tài liệu này là hướng dẫn triển khai — không phải biên bản đã deploy.

## 1. Kiến trúc triển khai (đã chốt)

| Thành phần | Công nghệ (đã chốt) | Ghi chú |
|---|---|---|
| Frontend | Next.js 15.4 (App Router) + React 19 | Quyết định 19 |
| Hosting frontend | Cloudflare Pages | Free: 500 build/tháng, 1 build đồng thời, 25 MiB/file |
| Backend / API | Cloudflare Workers (`/api/v1/*`) | Free: 100.000 request/ngày; API domain đã chốt `visfaracademy.netlify.app` (Task 02 QĐ 8) — lưu ý: đây là subdomain Netlify trong khi hosting là Cloudflare Pages; cách gắn domain này vào Workers cần xác minh lại khi triển khai |
| Database / Auth / Storage | Supabase (PostgreSQL, Auth, Storage, RLS) | Free: 2 project, DB 500 MB, Storage 1 GB; **tạm dừng sau 7 ngày không hoạt động** |
| Email | Resend | Free: 3.000 email/tháng, **tối đa 100/ngày** |
| Video | YouTube unlisted (giai đoạn 0đ) | Không phải bảo mật thật — đã được user chấp nhận (Quyết định 16) |
| Thanh toán | Chuyển khoản thủ công MB Bank + đối soát; SePay khi phê duyệt riêng | Quyết định 15; **không triển khai live thanh toán khi chưa có phê duyệt riêng (Task 10)** |
| Source control | GitHub | **Chưa có remote** — xem §2.1 |

## 2. Môi trường

| Môi trường | Frontend | API | Supabase project | Dữ liệu |
|---|---|---|---|---|
| Dev (local) | `next dev` (localhost) | `wrangler dev` | Staging (dùng chung) hoặc Supabase local | Test |
| Staging | Preview deployment (mỗi PR) | Workers staging | `scskhplczrxlnxzruweu.supabase.co` | Test / seed |
| Prod | Cloudflare Pages production | Workers production | `ugynqjqyfynkmqutoarp.supabase.co` | Thật — duy nhất |

### 2.1. Việc phải làm trước lần deploy production đầu tiên

1. **Tạo repo GitHub** (private) và push code hiện tại. Hiện tại repo local chỉ có 1 commit `54b6321` (Module 1); **119 thay đổi chưa commit** (snapshot 10/11/2026) — phải commit + tag trước khi deploy.
2. **Sửa trùng số migration trước khi chạy lên prod:** ~~hiện có **3 file cùng số 0017**~~ — **ĐÃ SỬA trong phiên (11/11/2026 ~00:35 +07):** các file đã được đánh lại số duy nhất 0017–0021 (`0017_email_unsubscribe_logs.sql`, `0018_email_task11.sql`, `0019_commerce_payment.sql`, `0020_lead_interactions.sql`, `0021_admin_user_disable.sql`), `scripts/check-migrations.mjs` đã cập nhật và chạy **PASS**. Việc còn lại: chạy migration 0017–0021 lên staging rồi prod (xem §4).
3. **Chạy migration 0017–0019 lên staging trước, kiểm chứng, rồi mới lên prod** (xem §4). Hiện prod + staging đã chạy tới 0016.
4. **Chốt domain production** (domain chính + API domain). Tạm dùng `*.pages.dev` / `*.workers.dev` ở staging.

**Cập nhật 11/11/2026 — đã deploy thật (staging):**
- **Web:** Cloudflare Pages project `visfaracademy` → **https://visfaracademy.pages.dev** (HTTP 200, đúng title Visfar Academy; `/chuong-trinh`, `/dang-nhap`, `/tu-van` đều 200). Deploy bằng `npm run pages:build` + `wrangler pages deploy .vercel/output/static --project-name=visfaracademy`.
- **API:** Worker đổi tên `visfar-academy-api` → **`api`** → **https://api.visfaracademy.workers.dev** (health 200, lead test 201). Worker cũ đã xóa.
- **Sửa JWT ES256 (11/11/2026, deploy Version ID `e1cab21f-f3ba-4138-80e7-2cc8ccec107e`):** Supabase staging phát hành JWT alg ES256 (khoa EC P-256) nhưng `src/jwt.ts` chỉ chấp nhận RS256 → token thật bị 401. Đã sửa để verify cả RS256 và ES256, từ chối alg khác (none/HS256); test `test/jwt-es256.test.ts` 7 test, `npm test` 300/300 PASS, `tsc --noEmit` PASS. Test live: đăng nhập thật trả token ES256, `GET /api/v1/my/orders` → 200.
- **CHẶN — POST /api/v1/orders vẫn 502 trên staging (11/11/2026):** migration **0019_commerce_payment.sql chưa được áp lên staging** (staging mới tới 0016) nên `courses.is_pay_what_you_want` và `orders.idempotency_key`/`idempotency_body_hash` không tồn tại — PostgREST trả 400 `42703 column ... does not exist`, Worker map thành 502 `upstream_error`. Cần áp 0017→0021 lên staging (cần Supabase access token — phiên này không có token nên chưa áp được), rồi mới tạo được đơn test. Lưu ý thêm: khi 0019 đã áp, khóa 01 `is_pay_what_you_want` mặc định false nên `customAmountVnd: 1000` sẽ bị 400 — muốn test chuyển khoản 1.000đ phải bật Tùy tâm cho khóa đó hoặc tạo đơn theo giá khóa (0đ).
- **2 lỗi đã gặp khi build Pages (ghi lại để lần sau khỏi vấp):** (1) Vercel CLI không tạo được `~/.local/share/com.vercel.cli/config.json` (operation not permitted) — chạy build với `HOME=/tmp/vercel-home`; (2) 34 route chưa khai `runtime = 'edge'` — đã thêm `export const runtime = 'edge';` vào 34 file page/route (typecheck + test 570/570 vẫn PASS); (3) sau deploy Pages trả 503 `no nodejs_compat compatibility flag` — set flag qua API `PATCH /accounts/{id}/pages/projects/visfaracademy` (`deployment_configs.production/preview.compatibility_flags: ["nodejs_compat"]`) + ghi `compatibility_flags = ["nodejs_compat"]` vào `apps/web/wrangler.toml`, rồi deploy lại.
- **Env Pages production chưa set trong Dashboard:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL` — lần build này dùng `.env.local` có sẵn trên máy + default Worker mới trong code; trước lần build production tiếp theo phải set đủ 3 biến trong Dashboard Pages > Settings > Environment variables.
5. **Bật branch protection cho `main`:** không push trực tiếp; mọi thay đổi qua PR + CI xanh.

## 3. CI/CD

| File | Chạy khi | Việc làm |
|---|---|---|
| `.github/workflows/ci.yml` | Mọi PR + push (trừ `main`) | `npm ci` → typecheck → lint → test → build. Không deploy. |
| `.github/workflows/deploy.yml` | Merge vào `main` | Chạy lại đủ bước CI → deploy Cloudflare Pages production → deploy Workers production → kiểm tra `GET /api/health` trả 200. |

Quy tắc: build lỗi → deploy dừng, prod giữ nguyên bản đang chạy. Mỗi PR có preview deployment riêng (dùng Supabase staging, không chạm dữ liệu prod) để kiểm tra trên điện thoại thật (390px) và desktop (1440px) trước khi merge.

**Trạng thái hiện tại:** chỉ có `ci.yml`; `deploy.yml` **chưa được viết** — phải viết trước lần deploy production đầu tiên.

## 4. Migration database

- Thứ tự: **staging trước, kiểm chứng xong mới prod**. Không sửa migration cũ — sai thì thêm migration mới.
- Cách chạy hiện tại (đã chứng minh): Management API Supabase qua HTTPS (`POST /v1/projects/{ref}/database/query`), HTTP 201 = thành công. **Không dùng `supabase db push`** từ VM này — cổng Postgres 5432 bị chặn (lỗi SSL).
- Trước khi chạy migration lên prod: **backup prod trước** (xem `BACKUP_RESTORE_GUIDE.md`), chạy thử trên staging, đối chiếu số dòng bảng chính (`courses` = 10, `policies` = 4).
- Trạng thái migration (snapshot 11/11/2026 ~00:35 +07): staging + prod đã chạy 0001→0016 (+0008 fix FK, 0009/0010 vá bảo mật). 0011–0013 đã chạy cả hai. 0014–0016 đã chạy cả hai. 0017–0021 (sau khi đổi số — xem §2.1 mục 2) **chưa chạy ở đâu**; `node scripts/check-migrations.mjs` → **OK: tất cả kiểm tra đều PASS**.

## 5. Secrets và biến môi trường

| Secret | Lưu ở | Ai dùng |
|---|---|---|
| Supabase service-role key | Cloudflare Workers Secrets + GitHub Secrets (backup/migration) | Chỉ Workers API (server). **Không bao giờ ở frontend, không bao giờ trong repo.** |
| Resend API key | Cloudflare Workers Secrets | Chỉ Workers API |
| Webhook secret (SePay / Resend) | Cloudflare Workers Secrets | Workers API — xác minh chữ ký webhook |
| Supabase anon key + URL | Cloudflare Pages env vars + `.env.local` (máy dev) | Frontend (bị RLS chặn) |
| Cloudflare API token / Account ID, Wrangler token | GitHub Secrets | GitHub Actions — deploy |
| Supabase access token / DB password | GitHub Secrets | GitHub Actions — backup, migration |

- **Không commit `.env`, `.env.local` hay bất kỳ file nào chứa secret.** `.gitignore` chặn `.env*` (trừ `.env.example`).
- `.env.example` chỉ chứa tên biến + giá trị mẫu giả.
- Service-role key bypass RLS — lộ key này là lộ toàn bộ database. Xoay key khi: có người rời đội, nghi ngờ lộ, hoặc rà soát định kỳ mỗi quý.
- Số tài khoản ngân hàng / QR VietQR: **không ghi vào tài liệu, không ghi vào biến môi trường công khai**; chỉ dùng file/ảnh do user cung cấp (Quyết định 15).

## 6. Kiểm tra sau mỗi lần deploy (smoke test)

1. `GET /api/health` → 200 (503 `not_configured` khi thiếu biến môi trường; 503 `supabase_error` khi Supabase lỗi/tạm dừng).
2. Trang chủ `/` → 200, có `<h1>Visfar Academy</h1>`.
3. `/chuong-trinh` → 200, hiển thị đủ 10 khóa học theo thứ tự 01–10.
4. Đăng nhập bằng tài khoản test trên staging → vào được `/hoc-vien`; tài khoản chưa đăng nhập → 307 về `/dang-nhap`.
5. Gửi 1 lead test qua form `/tu-van` trên staging → 201 + dòng mới trong bảng `leads` staging (không dùng dữ liệu thật).
6. Kiểm tra không có lỗi JavaScript nghiêm trọng trong console.

## 7. Rollback

| Tình huống | Cách rollback |
|---|---|
| Deploy Pages lỗi / giao diện vỡ | Deploy lại commit cũ trên Cloudflare Pages (giữ lại các deployment cũ) |
| Deploy Workers API lỗi | `git checkout <commit-cũ>` → `wrangler deploy`; giữ lại 5 commit gần nhất |
| Code mới có bug nghiệp vụ (đã deploy prod) | `git revert` commit lỗi → PR → CI xanh → merge `main` → deploy tự động. Không dùng `git reset --hard` trên `main` |
| Migration lỗi trên staging | Dừng, không chạy lên prod; thêm migration mới sửa; chạy lại trên staging |
| Migration lỗi trên prod | Restore database từ backup mới nhất **hoặc** migration mới khắc phục — quyết theo mức độ, ghi biên bản |
| Secret mới làm API chết | Quay lại secret cũ trong Workers Secrets → deploy lại → kiểm tra `/api/health` |

**Nguyên tắc: rollback code không rollback database.** Migration đã chạy không tự quay lại — cần migration mới sửa lại. Vì vậy chạy migration lên prod phải có backup trước.

## 8. Giám sát và cảnh báo (sau khi deploy)

- **Cron giữ ấm Supabase:** gọi `GET /api/health` mỗi ngày 1 lần (GitHub Actions theo lịch hoặc Workers Cron Trigger) — chống tạm dừng sau 7 ngày không hoạt động.
- **Kiểm tra mỗi ngày:** `/api/health` trả 200; backup hôm qua có file mới; đối soát R9 không có đơn pending quá hạn / payment không khớp; số email đã gửi trong ngày (< 100).
- **Kiểm tra mỗi tuần:** dung lượng DB còn bao nhiêu trong 500 MB; Storage còn bao nhiêu trong 1 GB; số request Workers/ngày; CI có lỗi tồn đọng không.
- **Kiểm tra mỗi tháng:** restore thử backup lên staging; rà soát giới hạn miễn phí trên trang pricing chính thức; rà soát secret.
- **Cảnh báo mức Cao (email admin):** API 5xx vượt ngưỡng; `/api/health` không trả 200; Resend ≥ 80 email/ngày; DB ≥ 400 MB / Storage ≥ 800 MB; backup thất bại; deploy prod lỗi; webhook xác minh chữ ký thất bại.
- **Kênh cảnh báo dự phòng khi Resend hết quota (VD Zalo/email cá nhân) — CHƯA CHỐT**, cần user cho biết kênh nhận cảnh báo mức Cao.

## 9. Lộ trình mở rộng 100 → 1.000 → 10.000 học viên

| Giai đoạn | Thay đổi triển khai | Chi phí dự kiến |
|---|---|---|
| 0–100 học viên | Stack 0đ như tài liệu này. Video YouTube unlisted. Thanh toán chuyển khoản thủ công + đối soát. | 0 đồng/tháng |
| 100–1.000 học viên | Nâng Supabase Pro $25/tháng (cần phê duyệt). Chuyển Storage sang R2 (10 GB miễn phí). SePay webhook (nếu phê duyệt). | ~$25/tháng + SePay (cần xác minh giá) |
| 1.000–10.000 học viên | Nâng Workers Paid $5/tháng, Resend Pro $20/tháng (cần phê duyệt). Video sang Cloudflare Stream/Mux nếu cần bảo mật (cần phê duyệt). Thêm cache. | ~$50/tháng + video + SePay/Stripe |
| > 10.000 học viên | Xem xét Supabase Team/dedicated; load test trước mỗi đợt ra mắt lớn. | Theo báo giá lúc đó |

Giá tham khảo tra cứu 10/11/2026 (Quyết định 18: nâng cấp trả phí khi chạm giới hạn — áp cho cả Supabase, Workers, Resend); **xác minh lại trước khi nâng**. Ba giới hạn chạm đầu tiên: (1) Resend 100 email/ngày, (2) Supabase tạm dừng sau 7 ngày, (3) Supabase DB 500 MB / Storage 1 GB.

## 10. Việc còn thiếu trước khi deploy production

- [ ] Tạo repo GitHub private + push code (119 thay đổi chưa commit)
- [x] Sửa trùng số migration 0017×3 — **ĐÃ SỬA trong phiên** (đánh lại 0017–0021, `check-migrations.mjs` PASS)
- [ ] Viết `.github/workflows/deploy.yml`
- [ ] Chạy migration 0017–0021 lên staging rồi prod
- [ ] Chốt domain production + API domain (`visfaracademy.netlify.app` — cần xác minh cách gắn vào Workers/Cloudflare)
- [ ] Chốt kênh cảnh báo dự phòng
- [ ] Deploy Workers API production (hiện đang triển khai — chặn form lead và ghi tiến độ sau quiz)
- [ ] Cấu hình Resend domain + xác minh DNS SPF/DKIM/DMARC trước khi gửi email thật
