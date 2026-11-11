# Workers API — Visfar Academy

Cloudflare Workers (TypeScript, không framework nặng) — lớp API trước
database, theo `docs/architecture/API_ARCHITECTURE.md` (Task 02) và
`docs/DECISIONS.md` (Task 02 QĐ 8: domain `visfaracademy.netlify.app`
+ tiền tố `/api/v1`).

> **Trạng thái deploy (10/11/2026): CHƯA DEPLOY.** Code + test local đã
> xong (xem § Test). Chưa có Cloudflare API token / OAuth nên chưa chạy
> được `wrangler deploy` — xem § Deploy để chạy khi có token. **Không
> bịa URL deploy.**

## Endpoints

| Method + Path | Mô tả | Auth |
|---|---|---|
| `POST /api/v1/leads` | Tạo lead tư vấn — validate server, honeypot + rate-limit + idempotency, ghi PostgreSQL rồi ghi Sheet | Không — 5 req/giờ/IP |
| `POST /api/v1/progress` | Lưu tiến độ học — JWT JWKS, kiểm tra enrollment, luật 90%, chống gian lận, quiz chỉ hoàn thành khi `passed=true` | JWT Supabase |
| `GET /api/health` (+ alias `GET /api/v1/health`) | Kiểm tra sống **thật** (select 1 dòng `courses`) — 503 khi chưa cấu hình / Supabase lỗi | Không |

Mọi response là JSON thống nhất (`API_ARCHITECTURE.md` §7):
thành công `{ ok:true, ... }`, lỗi `{ ok:false, error:"ma_loi",
message:"Tiếng Việt" }`. **Không có thành công giả:** chỉ trả `201`
khi ghi DB đã xác nhận; DB lỗi → `502`, không `ok:true`.

### `POST /api/v1/leads`

Frontend gửi (`apps/web/src/lib/leads.ts` — camelCase, kèm header
`Idempotency-Key`):
`{ fullName, phone, email, province, courseId|null,
courseInterestText, source, turnstileToken|null, honeypot:'' }`.

- Validate server: SĐT `^0\d{9}$` → `invalid_phone`; email TLD ≥ 2 →
  `invalid_email`; tỉnh trong 34 tỉnh → `invalid_province`; `courseId`
  phải tồn tại + `published` → `invalid_course`; tên 2–100 ký tự.
- Honeypot không rỗng → `400 spam_suspected`, không ghi.
- Rate-limit **5 req/giờ/IP** (đếm cả request lỗi validation) → `429`
  kèm header `Retry-After`.
- Turnstile: có `TURNSTILE_SECRET` + client gửi token → verify thật,
  sai → `400 spam_suspected`; có secret nhưng không có token → **cho
  qua + ghi log** (Task 03 QĐ 13: widget có thể không tải được); chưa
  có secret → bỏ qua.
- Idempotency: trùng key + cùng body → `200 { duplicate:true }`,
  cùng `referenceCode`, không ghi thêm; trùng key + body khác → `409
  idempotency_conflict`. Key hết hiệu lực theo UNIQUE ở DB (24 giờ
  theo kiến trúc — dọn dẹp khi lập trình module dọn).
- `referenceCode`: `VISFAR-2026-NNNNNN` (6 số ngẫu nhiên, thử lại khi
  trùng UNIQUE).
- Ghi DB trước (PostgreSQL qua service-role, bảng `leads` — nguồn sự
  thật), rồi ghi Sheet qua Apps Script Web App (bản sao đối soát).
  **Sheet lỗi sau khi DB đã ghi xong → vẫn `201` kèm
  `sheetSynced:false` + log** (đối soát sau, báo cáo R9) — không biến
  lỗi Sheet thành lỗi lead. `APPS_SCRIPT_URL` chưa cấu hình →
  `sheetSynced:false`.
- File `.gs` hiện tại (`workspace/visfar-academy/Code-hop-nhat-2-trang.gs`)
  nhận đúng field Workers gửi (`source, fullName, phone, email,
  province, course`) và ghi tab `DATA VISFAR ACADEMY` 6 cột. Workers
  gửi thêm `referenceCode` / `idempotencyKey` để tương thích khi `.gs`
  được mở rộng — **hiện `.gs` chưa lưu mã tham chiếu vào Sheet** (cần
  sửa `.gs` + deploy lại, xem § Việc còn lại).

### `POST /api/v1/progress`

Frontend gửi (`apps/web/src/lib/progress.ts` — snake_case):
`{ lesson_id, course_id, lesson_type, event, video_position_sec?,
progress_percent?, explicit_complete?, quiz_attempt_id?,
quiz_percent? }`, `event: opened | position | completed`, kèm
`Authorization: Bearer <Supabase JWT>` + `Idempotency-Key`. Trả về
`{ ok:true, data: <LessonProgressRow snake_case> }` đúng hình dạng
`progress.ts` đợi.

- JWT xác minh bằng **JWKS Supabase Auth** (`crypto.subtle`, **RS256 và ES256**,
  cache 10 phút), kiểm tra `iss = <SUPABASE_URL>/auth/v1`,
  `aud = authenticated`, `exp`. Sai/thiếu/hết hạn → `401
  unauthorized`. Không đọc claim nào của token chưa xác minh.
  **Sửa 11/11/2026:** Supabase staging dùng publishable key mới phát hành
  JWT alg **ES256** (khoa EC P-256, chu ky raw r||s 64 bytes); ban cu
  `src/jwt.ts` chi chap nhan RS256 nen token that bi 401 "Phiên đăng
  nhập đã hết hạn". Nay verify ca RS256 (RSA n/e) va ES256 (EC crv
  P-256, x/y); alg khac (none, HS256, ...) deu bi tu choi. Test:
  `test/jwt-es256.test.ts` (7 test: ES256 hop le/het han/sai chu ky,
  ES256 vs JWKS chi co RSA, RS256 hoi quy, none, HS256) — `npm test`
  300/300 PASS, `npx tsc --noEmit` PASS. Deploy Worker `api` Version
  ID `e1cab21f-f3ba-4138-80e7-2cc8ccec107e` (11/11/2026); test live:
  dang nhap that tra token ES256, `GET /api/v1/my/orders` → 200.

### `POST /api/v1/orders` — bug `title_snapshot` (B-T10-6, 11/11/2026)

`createOrder` (`src/payments.ts`) insert `order_items` thieu 2 cot cu
tu 0004: `title_snapshot` NOT NULL (khong default) va `amount_vnd`
NOT NULL — 0019 chi them `item_type/item_name/unit_price_vnd/
quantity/total_vnd`, khong bo 2 cot cu. PostgREST tra 23502 → Worker
map thanh 502; 2 don mo coi DH-2026-000001/000002 (pending, 1.000đ,
0 order_items) — khong dung de test thanh toan. **Da sua:** insert
them `title_snapshot: p.itemName` va `amount_vnd: unitPrice*quantity`
(khoa Tuy tam: gia goc 0 nen `amount_vnd` item = 0, so tien Tuy tam
nam o `orders.amount_vnd/custom_amount_vnd`); `OrderItemRow` bo sung
2 field. Mock test enforce NOT NULL (23502) + CHECK total (23514)
cho `order_items` + 2 test hoi quy (khoa + goi thanh vien). `npm
test` 302/302 PASS, `tsc` PASS. Deploy Worker `api` Version ID
`5739e074-b647-4c04-9ec2-47ceaec52d17` (11/11/2026); don test moi
**DH-2026-000003** (1.000đ, pending) tao thanh cong HTTP 201,
kiem chung truc tiep staging: 1 `order_items` voi `title_snapshot`
= "Thấu Hiểu Nội Tâm".
- Rate-limit: **100 req/phút/IP + 300 req/giờ/user** (Task 03 QĐ 13).
- Enrollment phải tồn tại, `status` `active`/`completed` (`revoked`
  hoặc chưa ghi danh → `403`). Lưu ý: cho phép `completed` để học viên
  xem lại bài sau khi hoàn thành khóa (chỉ `revoked` mới chặn hẳn).
- Video: **percent do server tính lại** từ `position/duration`
  (làm tròn xuống, giống `progress.ts` + trigger DB 0012) — percent
  client gửi bị bỏ qua. `position > duration + 10s` → `400`.
  Hoàn thành chỉ khi ≥ 90% (QĐ 17); hoàn thành mà không có bằng chứng
  position ≥ 90% → `400` (chặn nhảy 0%→100%). Nhảy vị trí quá nhanh
  so với thời gian thực kể từ lần lưu trước (scrub tới cuối) khi
  chuyển sang `completed` → `400` (sai số cho phép 30 giây; không có
  dòng cũ thì không có cơ sở để chặn). Mở bài lần đầu chưa có vị trí
  → `not_started` (cùng luật `resolveProgressUpdate` ở frontend);
  mở bài không có position **giữ nguyên** vị trí/% cũ, không reset về 0.
- Text/file: chỉ `completed` khi bấm “Đã hoàn thành”
  (`explicit_complete` / `event: completed`) → 100%.
- Quiz (B-T08-5): chỉ `completed` khi `quiz_attempts.passed = true`
  — đối chiếu bằng `quiz_attempt_id` (đúng user, đúng bài), không tin
  claim của client. Chưa đạt / thiếu attempt → `400`; attempt của
  người khác → `403`.
- Upsert theo UNIQUE `(user_id, lesson_id)` nên tự nhiên idempotent
  (key `progress-complete-<lessonId>` frontend gửi được chấp nhận
  nhưng không cần cột riêng). Trigger `trg_progress_sync_guard`
  (migration 0012) là lớp chặn cuối ở DB.
- `started_at` chỉ đặt lần đầu, `last_accessed = now()` mỗi lần,
  `completed_at` theo trạng thái.

### `GET /api/health`

- Chưa cấu hình `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` → `503
  { ok:false, status:'not_configured' }`.
- `select id from courses limit 1` thật qua service-role: lỗi →
  `503 supabase_error`; thành công → `200 { ok:true, status:'ok',
  latency_ms }`. Không dùng `head:true` (PostgREST nuốt lỗi bảng
  không tồn tại — cùng bài học ở route health Next.js).

## Cấu trúc

```
workers/api/
  wrangler.toml          # tên worker, vars, KV (tùy chọn, comment)
  package.json           # scripts: dev / deploy / test / typecheck
  tsconfig.json
  .dev.vars.example      # TÊN biến secret (không giá trị thật)
  src/
    index.ts             # router + CORS + error mapping
    env.ts               # Env + isSupabaseConfigured + safeLog
    errors.ts            # ApiError + format lỗi thống nhất
    validation.ts        # phone/email/tên/tỉnh/referenceCode
    provinces.ts         # 34 tỉnh (copy từ packages/shared)
    jwt.ts               # verify JWT bằng JWKS (WebCrypto, không dep)
    rate-limit.ts        # rate-limit (KV nếu có, không thì bộ nhớ)
    supabase.ts          # PostgREST client (service-role)
    turnstile.ts         # verify Turnstile
    sheet.ts             # ghi Sheet qua Apps Script Web App
    handlers/leads.ts    # POST /api/v1/leads
    handlers/progress.ts # POST /api/v1/progress
    handlers/health.ts   # GET /api/health
  test/
    fake-supabase.ts     # fake PostgREST + ký JWT RS256 thật (test)
    leads.test.ts        # 18 test
    progress.test.ts     # 23 test
    health.test.ts       # 9 test
```

Các module khác trong `src/` (`email/`, `sepay.ts`,
`automation-*`, …) thuộc task khác, không thuộc phạm vi README này.

## Secrets — CHỈ ở Workers Secrets (không commit giá trị thật)

| Biến | Bắt buộc | Dùng cho |
|---|---|---|
| `SUPABASE_URL` | Có | REST + JWKS (`<URL>/auth/v1/...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Có | Ghi DB qua PostgREST (chỉ Workers cầm key này) |
| `APPS_SCRIPT_URL` | Có (để đồng bộ Sheet) | POST lead sang Apps Script Web App |
| `TURNSTILE_SECRET` | Không (khi có site key) | Verify CAPTCHA Turnstile |
| `ALLOWED_ORIGINS` | Không | CORS (mặc định: `visfaracademy.netlify.app` + localhost) |
| `RATE_LIMIT_KV` | Không | KV namespace rate-limit (không có → bộ nhớ per-isolate) |

Local dev: copy `.dev.vars.example` → `.dev.vars` (đã bị `.gitignore`
chặn) rồi điền giá trị thật. **Không ghi secret vào file/tài liệu
nào trong repo.**

## Chạy local

```bash
cd workers/api
npm install
npm test            # vitest (xem § Test)
npm run typecheck   # tsc --noEmit
npm run dev         # wrangler dev --port 8787
```

Không có secret, dev server vẫn chạy và trả đúng mã “chưa sẵn sàng”:
`GET /api/health` → `503 not_configured`; `POST /api/v1/leads` với
SĐT sai → `400 invalid_phone`; không JWT → `401` (progress).

## Test

```bash
npm test   # vitest run test/leads.test.ts test/progress.test.ts test/health.test.ts
```

**Kết quả 10/11/2026: 50/50 PASS** (leads 18 + progress 23 + health 9),
mock fetch (fake PostgREST + JWKS ký RS256 thật bằng WebCrypto).
Bao phủ: validation từng field, honeypot, rate-limit 5/giờ (leads),
idempotency trùng key / khác body, DB lỗi → 502 (không 201),
Sheet lỗi → vẫn 201 + `sheetSynced:false`, JWT sai/hết hạn/sai
iss/aud, chưa ghi danh → 403, video vượt duration+10s, hoàn thành
< 90%, nhảy 0%→100% (scrub), percent client bị tính lại, quiz
chưa đạt / đạt, health 503/200.

Lưu ý: `npm test` toàn thư mục còn chạy cả test của task khác
(email/sepay/automation) đang làm song song — xem § Việc còn lại.

## Deploy — CHƯA CHẠY (thiếu token)

`wrangler whoami` ngày 10/11/2026: **“You are not authenticated.
Please run `wrangler login`.”** — chưa có Cloudflare API token /
OAuth nên **dừng ở bước deploy**, không bịa URL.

Khi có token, chạy đúng các lệnh sau (từ `workers/api/`):

```bash
# 1. Đăng nhập (OAuth) hoặc export CLOUDFLARE_API_TOKEN
wrangler login

# 2. Set secrets (chỉ tên biến ở đây — giá trị lấy từ kho secret của user,
#    KHÔNG ghi vào repo; SUPABASE_SERVICE_ROLE_KEY lấy từ Supabase
#    dashboard project staging/prod, APPS_SCRIPT_URL là URL /exec đã có)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put APPS_SCRIPT_URL
wrangler secret put TURNSTILE_SECRET   # chỉ khi đã có site key

# 3. Kiểm tra bundle trước (không deploy)
wrangler deploy --dry-run

# 4. Deploy
wrangler deploy
```

## Cập nhật 11/11/2026 — Worker đổi tên thành `api` + đã deploy thật

- `wrangler.toml`: `name = "api"` (đổi từ `visfar-academy-api`).
- Worker mới: **https://api.visfaracademy.workers.dev** (Version ID
  `711e195f-4443-4bec-b1c8-aace3be26eca`, deploy 11/11/2026 ~06:41 +07).
- 5 secret đã set lại cho Worker mới (secret gắn theo tên Worker):
  `SUPABASE_URL` (staging), `SUPABASE_SERVICE_ROLE_KEY` (staging),
  `APPS_SCRIPT_URL`, `SEPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`.
- Kiểm chứng live: `GET /api/v1/health` → **200 `{"ok":true}`**;
  POST lead test → **201**, mã `VISFAR-2026-605018`, `sheetSynced:true`,
  đã đối chiếu có đúng 1 row trong bảng `leads` staging.
- Worker cũ **đã xóa** (`wrangler delete --name visfar-academy-api`):
  URL cũ `https://visfar-academy-api.visfaracademy.workers.dev` nay trả
  **404**. Webhook SePay **phải đổi** sang
  `https://api.visfaracademy.workers.dev/api/v1/webhooks/sepay`
  (user tự đổi trong SePay).
- Alias đã chốt `visfaracademy.netlify.app/api/v1` (DECISIONS Task 02
  QĐ 8) vẫn giữ — chỉ dùng được sau khi có redirect Netlify về Worker
  mới. Code web (`apps/web/src/lib/api-client.ts`) nay mặc định gọi
  thẳng Worker mới, override bằng `NEXT_PUBLIC_API_BASE_URL` khi cần.
- Web Next.js đã deploy Cloudflare Pages: **https://visfaracademy.pages.dev**
  (project `visfaracademy`, xem `docs/release/DEPLOYMENT_GUIDE.md`).

Kiểm chứng sau deploy (staging): `GET /api/health` → 200; gửi form
thật 1 lần → đếm đúng 1 row `leads` staging + tab DATA VISFAR
ACADEMY khớp (C-05-01); gửi 2 lần cùng key → DB chỉ 1 dòng (C-05-02).

## Việc còn lại

1. **Deploy** khi có Cloudflare token (lệnh ở § Deploy) + set đủ
   secret; sau đó chạy kiểm chứng live C-05-01–C-05-04.
2. **Test live staging** POST leads/progress + kiểm chứng row DB:
   cần service-role key staging + tài khoản test (chưa được cung cấp
   trong đợt này) — xem `docs/frontend/TASK05_REPORT.md` §6.2.
3. **Mở rộng `.gs`** để lưu `reference_code` vào Sheet (thêm cột +
   deploy lại Apps Script, giữ nguyên URL `/exec`) — hiện Sheet chỉ
   có 6 cột, chưa có mã tham chiếu để đối soát.
4. **Turnstile site key** chưa có (C-05-07): user cung cấp site key
   + secret thì bật verify; hiện code đã sẵn sàng.
5. **Rate-limit KV** (tùy chọn): tạo KV namespace để giới hạn chính
   xác qua nhiều isolate; hiện fallback bộ nhớ per-isolate (đủ cho
   lượng lead thấp, UNIQUE ở DB vẫn chặn trùng cuối).
6. **Dọn test song song:** `npm run typecheck` toàn thư mục hiện lỗi
   ở file của task khác đang làm dở (email/sepay/automation) — file
   của task này (leads/progress/health + lib dùng chung) **không có
   lỗi type nào**; phối hợp với task đó trước khi yêu cầu typecheck
   toàn thư mục PASS.
7. **Dọn `Idempotency-Key`**: key hết hiệu lực 24 giờ theo kiến trúc
   — cần job dọn định kỳ khi vận hành thật (chưa làm trong đợt này).
