# DEPLOYMENT_GUIDE — Hướng dẫn triển khai (trạng thái thật 11/11/2026)

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Vai trò file này:** hướng dẫn deploy ở trạng thái **đã deploy thật** (11/11/2026). Bản snapshot 10/11/2026 ("CHƯA TRIỂN KHAI PRODUCTION") giữ nguyên ở `docs/release/DEPLOYMENT_GUIDE.md` — nhiều mục trong đó nay đã cũ (xem §7 đối chiếu).
- **Không chứa secret/key/token nào (chỉ tên biến).**

## 1. Kiến trúc triển khai (đã chạy thật)

| Thành phần | Giá trị thật | Ghi chú |
|---|---|---|
| Frontend | Cloudflare Pages, project `visfaracademy` | `https://visfaracademy.pages.dev` (production 200) |
| Backend/API | Cloudflare Worker tên `api` | `https://api.visfaracademy.workers.dev` (health 200) |
| Database/Auth/Storage | Supabase (Postgres 17) | Prod `ugynqjqyfynkmqutoarp` (ap-south-1); staging `scskhplczrxlnxzruweu` (ap-southeast-2) |
| Email | Resend ("Dùng tạm") | Chỉ gửi cho admin qua `onboarding@resend.dev` |
| Thanh toán | SePay FREE + MB Bank | Webhook đã nối route, chưa chạy thật |
| Source control | Git local | **Chưa có remote GitHub** (`git remote -v` trống, kiểm tra 11/11/2026); code mới nhất commit local `f577747` (GĐ2 P0) + `dca216d` (cập nhật audit) |
| CI/CD | `.github/workflows/ci.yml` + `deploy.yml` đã có trong repo | **Chưa xác minh CI chạy thật** (chưa có remote nên chưa có PR/push nào chạy CI) |

## 2. Môi trường

| Môi trường | Frontend | API | Supabase | Dữ liệu |
|---|---|---|---|---|
| Dev (local) | `next dev` (localhost) | `wrangler dev` | Staging (dùng chung) hoặc Supabase local | Test |
| Staging | Preview deployment (mỗi PR — khi có remote/CI) | Workers staging (hiện Worker `api` nối PROD — xem lưu ý dưới) | `scskhplczrxlnxzruweu` | Test / seed |
| Prod | Cloudflare Pages production | Worker `api` production | `ugynqjqyfynkmqutoarp` | Thật — duy nhất |

**Lưu ý quan trọng (QĐ 20):** Worker `api` hiện nối **Supabase PROD** (secret `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` đã đặt lại sang prod 11/11/2026). Lead test gửi lên Worker sẽ vào **prod**, không vào staging (đã chứng minh: C-05-02 dòng test nằm ở prod). Khi test, phải xóa dòng test khỏi prod ngay sau kiểm chứng và kiểm tra lại 0 dòng.

## 3. Build & deploy (lệnh đã chứng minh chạy được)

### 3.1. Frontend (Pages)

```bash
# Build (tránh lỗi chown config Vercel trong sandbox này):
XDG_DATA_HOME=/tmp/vdata npm run pages:build
# Deploy:
wrangler pages deploy .vercel/output/static --project-name=visfaracademy
```

- Build qua `@cloudflare/next-on-pages`; `pages_build_output_dir=.vercel/output/static`; `compatibility_flags = ["nodejs_compat"]` trong `apps/web/wrangler.toml` (bắt buộc — thiếu flag này Pages trả 503 `no nodejs_compat`).
- Mọi route page/route handler cần `export const runtime = 'edge';` (34 route đã thêm; route mới quên khai sẽ lỗi build — xem TASK13_14_REPORT §5.9).
- **Không build song song chung `.next`:** nhiều agent/build cùng lúc làm build sau ghi đè chunk của build trước (đã chứng minh 2 lần: server chunk bake nhầm env prod; `ENOENT _ssgManifest.js` / `middleware-manifest.json`). Chỉ build khi không còn agent khác đang build, hoặc copy output sang thư mục riêng rồi deploy từ đó (vd. `/tmp/congdong-deploy`).
- `/tmp` (tmpfs 512M) có thể đầy khi `npx vercel` tải package — dọn `/tmp/vhome` nếu build báo `ENOSPC`.
- Deploy Pages mới nhất trong GĐ2: `https://e951f862.visfaracademy.pages.dev` (production `https://visfaracademy.pages.dev`).

### 3.2. Worker API

```bash
cd workers/api
wrangler deploy            # deploy Worker `api`
wrangler secret list       # chỉ liệt kê TÊN secret (không in giá trị)
wrangler secret put <TÊN>  # set secret (chỉ tên, không ghi giá trị vào file/log)
```

- Deploy GĐ2 mới nhất: Version `76bb202c` (AI Mentor). Kiểm tra sau deploy: `GET /api/v1/health` → 200.
- Worker cũ `visfar-academy-api` đã xóa; URL cũ trả 404. **User phải đổi URL webhook trong SePay sang URL mới** `https://api.visfaracademy.workers.dev/api/v1/webhooks/sepay` (URL cũ đã chết cùng Worker cũ).

### 3.3. Migration database

- Thứ tự: **staging trước → kiểm chứng → backup prod → prod**. Không sửa migration cũ — sai thì thêm migration mới.
- Cách chạy đã chứng minh: Supabase Management API qua HTTPS (`POST /v1/projects/{ref}/database/query`), HTTP 201 = thành công. **Không dùng `supabase db push` từ VM này** — cổng Postgres 5432 bị chặn (lỗi SSL).
- Kiểm tra trước/sau: `node scripts/check-migrations.mjs` (đếm động, 271/271 PASS); đối chiếu số dòng bảng chính (`courses` = 10, `policies` = 4; staging `master_library_items` = 119).
- Trạng thái 11/11/2026: prod tới 0024; staging tới 0031. **Chưa áp prod: 0025–0031** (chờ user nghiệm thu staging).
- Lưu ý: staging đã áp nội dung 0030/0031 dưới số cũ 0029/0030 (đổi số sau khi áp); nếu chuyển sang `supabase db push`, cần `migration repair` đánh dấu version (Management API không ghi `schema_migrations` — xem `docs/supabase/MIGRATION_GUIDE.md` §5.5).

## 4. Secrets & biến môi trường (chỉ tên — không giá trị)

**Worker secrets** (đặt bằng `wrangler secret put`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APPS_SCRIPT_URL`, `RESEND_API_KEY`, `SEPAY_WEBHOOK_SECRET` (đã set), `RESEND_FROM_EMAIL` (chưa set có chủ đích — Resend "Dùng tạm"), `RESEND_WEBHOOK_SECRET`, `UNSUBSCRIBE_SECRET`, `TURNSTILE_SECRET`, `SEPAY_API_TOKEN`, `SEPAY_BANK_ACCOUNT_ID`, `SEPAY_MERCHANT_ID`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ADMIN_NOTIFY_EMAIL`, `ALLOWED_ORIGINS`.

Đã xác minh bằng `wrangler secret list` (chỉ tên, 11/11/2026): có 5 — `APPS_SCRIPT_URL`, `RESEND_API_KEY`, `SEPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. Không có: `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `TURNSTILE_SECRET`, `UNSUBSCRIBE_SECRET`, `SEPAY_API_TOKEN`, `SEPAY_BANK_ACCOUNT_ID`, `SEPAY_MERCHANT_ID`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

**Pages env vars** (Dashboard > Settings > Environment variables — phải set đủ trước lần build production tiếp theo): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`. (Lần build 11/11/2026 dùng `.env.local` có sẵn trên máy + default Worker mới trong code — không dựa vào đó cho lần sau.)

**Quy tắc:** không commit `.env`, `.env.local`, `.dev.vars`; `.gitignore` chặn `.env*` (trừ `.env.example` — chỉ tên biến + giá trị mẫu giả). Service-role key chỉ ở Worker; frontend không bao giờ thấy key này. Số tài khoản ngân hàng / QR VietQR không ghi vào tài liệu hay biến môi trường công khai.

## 5. Kiểm tra sau mỗi lần deploy (smoke test)

1. `GET /api/v1/health` → 200 (`{"ok":true,"status":"ok"}`); 503 `not_configured` khi thiếu biến môi trường.
2. Trang chủ `/` → 200, có `<h1>Visfar Academy</h1>`; `/chuong-trinh` → 200, đủ 10 khóa theo thứ tự 01–10.
3. `/sitemap.xml` → 200 (đủ 25 URL); `/robots.txt` → 200.
4. Header bảo mật thật trên production: CSP, HSTS, `X-Frame-Options: SAMEORIGIN`.
5. Đăng nhập bằng tài khoản test trên staging → vào được `/hoc-vien`; chưa đăng nhập → 307 về `/dang-nhap`.
6. Gửi 1 lead test qua form `/tu-van` trên staging → 201 + dòng mới trong `leads` (nhớ: Worker hiện nối PROD — dòng test sẽ vào prod, phải xóa ngay sau kiểm chứng).
7. Không có lỗi JavaScript nghiêm trọng trong console; không tràn ngang ở 390px và 1440px.

## 6. Giám sát & cảnh báo (mục tiêu — chưa xác minh đã chạy thật)

- **Cron giữ ấm Supabase:** gọi `GET /api/health` mỗi ngày 1 lần (chống tạm dừng sau 7 ngày không hoạt động). **Chưa xác minh cron này đang chạy thật trong đợt này** (Worker `index.ts` không thấy handler `scheduled`; xem `docs/API_DOCUMENTATION.md` §2.10).
- **Kiểm tra mỗi ngày:** `/api/health` 200; đối soát R9 (đơn pending quá hạn / payment không khớp / webhook lỗi); số email đã gửi < 100.
- **Kiểm tra mỗi tuần:** dung lượng DB (500 MB) / Storage (1 GB); số request Workers/ngày; CI có lỗi tồn đọng không.
- **Kiểm tra mỗi tháng:** restore thử backup lên staging (chưa từng làm — xem `docs/BACKUP_RECOVERY.md`); rà soát giới hạn miễn phí trên trang pricing chính thức; rà soát secret.
- **Cảnh báo mức Cao (email admin `visfaracademy@gmail.com`):** API 5xx vượt ngưỡng; `/api/health` không trả 200; Resend ≥ 80 email/ngày; DB ≥ 400 MB / Storage ≥ 800 MB; backup thất bại; deploy prod lỗi; webhook xác minh chữ ký thất bại.
- **Kênh cảnh báo dự phòng khi Resend hết quota (VD Zalo/email cá nhân) — CHƯA CHỐT**, cần user cho biết kênh nhận cảnh báo mức Cao.

## 7. Đối chiếu với bản snapshot 10/11/2026 (`docs/release/DEPLOYMENT_GUIDE.md`)

| Mục trong bản cũ | Trạng thái nay (11/11/2026) |
|---|---|
| "CHƯA TRIỂN KHAI PRODUCTION" | **Đã deploy thật:** Pages + Worker production đều live 200 |
| "Chưa có repo GitHub remote, 119 thay đổi chưa commit" | Code đã commit local (`54b6321`, `f577747`, `dca216d`); **vẫn chưa có remote** (`git remote -v` trống) |
| Trùng số migration 0017 | Đã sửa (0017–0021), `check-migrations` PASS |
| `deploy.yml` chưa được viết | `deploy.yml` đã có trong repo (chưa xác minh chạy thật vì chưa có remote) |
| Migration 0017–0021 chưa chạy ở đâu | Đã áp tới 0024 prod, tới 0031 staging |
| Env Pages production chưa set trong Dashboard | Vẫn cần set đủ 3 biến trước lần build production tiếp theo |
| POST `/api/v1/orders` 502 vì 0019 chưa áp staging | Đã qua (0019 đã áp); nhưng SePay end-to-end thật vẫn chưa chạy |
| Domain production + API domain chưa chốt | Vẫn chưa chốt; đang dùng `*.pages.dev` / `*.workers.dev` |

## 8. Rollback

| Tình huống | Cách rollback |
|---|---|
| Deploy Pages lỗi / giao diện vỡ | Deploy lại commit cũ trên Cloudflare Pages (giữ lại các deployment cũ) |
| Deploy Workers API lỗi | `git checkout <commit-cũ>` → `wrangler deploy`; giữ lại 5 commit gần nhất |
| Code mới có bug nghiệp vụ (đã deploy prod) | `git revert` commit lỗi → PR → CI xanh → merge `main` → deploy tự động. Không dùng `git reset --hard` trên `main` |
| Migration lỗi trên staging | Dừng, không chạy lên prod; thêm migration mới sửa; chạy lại trên staging |
| Migration lỗi trên prod | Restore database từ backup mới nhất **hoặc** migration mới khắc phục — quyết theo mức độ, ghi biên bản |
| Secret mới làm API chết | Quay lại secret cũ trong Workers Secrets → deploy lại → kiểm tra `/api/health` |

**Nguyên tắc: rollback code không rollback database.** Migration đã chạy không tự quay lại — cần migration mới sửa lại. Vì vậy chạy migration lên prod phải có backup trước.
