# Prompt 12 — AI Mentor & AI Learning Assistant (RAG trên nội dung đã phê duyệt)

Ngày: 11/11/2026. Trạng thái: **đã xong code + migration staging + test/build/deploy** (xem §7–§8).

## 0. Chế độ hoạt động — ĐỌC TRƯỚC

**TÌM KIẾM THÔNG MINH, KHÔNG LLM.** Đã kiểm tra bằng `wrangler secret list`
(Worker `api`, chỉ tên): chỉ có 5 secret cũ — APPS_SCRIPT_URL, RESEND_API_KEY,
SEPAY_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL. **Không có
OPENAI_API_KEY / GEMINI_API_KEY nào được cấp.** Vì vậy route
`POST /api/v1/ai-mentor/ask` chỉ tìm kiếm trong kho tri thức đã phê duyệt và
trả về đoạn tri thức + trích dẫn nguồn nội bộ + câu hỏi gợi ý; **không gọi
LLM, không bịa câu trả lời**. Chế độ này ghi rõ trong UI trang `/ai-mentor`
("Chế độ hiện tại: Tìm kiếm thông minh") và trong file này.

Nhánh LLM đã viết sẵn trong `workers/api/src/handlers/ai-mentor.ts`
(`tryLlmAnswer`, chỉ chạy khi có `OPENAI_API_KEY` trong Workers Secrets):
gọi OpenAI Chat Completions (`gpt-4o-mini`, temperature 0.2) với system
prompt "chỉ trả lời dựa trên đoạn tri thức được cung cấp, không bịa, trích
dẫn nguồn, phân biệt khoa học / triết học / tín ngưỡng / giả thuyết"; LLM
lỗi thì tự rơi về chế độ tìm kiếm thông minh. Nhánh này có test (mock
fetch OpenAI: 200 → mode `llm`; 503 → rơi về `smart-search`).
`GEMINI_API_KEY` một mình thì vẫn chạy tìm kiếm thông minh — adapter
Gemini chưa có (việc mở).

## 1. Phạm vi đã làm

- **Migration `0029_ai_mentor.sql`** — 3 bảng + hàm tìm kiếm + RLS + seed:
  - `ai_knowledge_chunks` (`id`, `source_type` CHECK `library|course|philosophy`,
    `source_slug`, `title`, `content`, `keywords`, `search_text`,
    `search_vector`, `created_at`, `updated_at`; UNIQUE `(source_type, source_slug)`)
    + trigger duy trì `search_text` (lower + unaccent) và `search_vector`
    (config `simple`) + GIN index trên `search_vector` và trigram GIN trên
    `search_text`.
  - `ai_chat_sessions` (`id`, `user_id` FK `auth.users`, `title`,
    `created_at`, `updated_at`) + `ai_chat_messages` (`id`, `session_id` FK
    cascade, `user_id`, `role` CHECK `user|assistant`, `content`,
    `sources` JSONB array, `helpful` boolean NULL, `created_at`).
    RLS **chỉ chủ sở hữu** đọc/ghi (`user_id = auth.uid()`); không có
    policy admin — không tiết lộ dữ liệu học viên khác.
  - Hàm `search_ai_knowledge(p_query text, p_limit int)` (xem §2).
  - Seed idempotent (chạy lại UPDATE, không trùng): **138 chunk = 119 mục
    Thư viện Master** (lấy trực tiếp từ `master_library_items`, nguyên văn)
    **+ 10 khóa học** (từ `courses` published, subtitle + description;
    3 khóa 04/05/06 có description tạm "NOI DUNG TAM" thì chỉ lấy subtitle
    + câu "Nội dung chi tiết đang được cập nhật.", không đưa chữ tạm nội
    bộ ra ngoài) **+ 9 mục triết lý trang chủ** (nguyên văn
    `homepage-data.ts`: PHILOSOPHY_CORE, PHILOSOPHY_VIEW, EQUATION_NOTE,
    GOALS, PRINCIPLES, DESTINATION, MISSION + VISION, FACETS, ROADMAP_STEPS).
    **Không index nội dung bài học trả phí** (bảng `lessons` không xuất
    hiện trong seed).
- **Worker route mới** (`workers/api/src/handlers/ai-mentor.ts`, nối trong
  `workers/api/src/index.ts`):
  - `POST /api/v1/ai-mentor/ask` — cần JWT; rate-limit **20 câu hỏi/giờ/user**
    (key `ai-mentor:{userId}:{ip}`, dùng `checkRateLimit` sẵn có; 401 không
    đếm); validate câu hỏi 2–1000 ký tự; session: dùng lại nếu thuộc về
    user, không thì 404 (không lộ session người khác), chưa có thì tạo mới
    (tiêu đề = 60 ký tự đầu câu hỏi); tìm kiếm → lọc mức liên quan (§2) →
    **kiểm tra enrollment** cho chunk loại course (qua `getCourseBySlug` +
    `getEnrollment`): chưa ghi danh thì `enrolled:false` + ghi chú "chưa
    ghi danh — nội dung bài học đầy đủ chỉ mở sau khi ghi danh, phần trên
    chỉ là mô tả công khai"; lưu tin nhắn user + assistant (lỗi ghi lịch
    sử không làm mất câu trả lời — trả `historySaved:false`, theo mẫu
    leads khi Sheet lỗi vẫn giữ 201); trả `{ mode, sessionId, answer,
    sources[{sourceType, sourceSlug, title, url, enrolled?}], suggestions,
    historySaved }`.
  - `GET /api/v1/ai-mentor/sessions` — 20 phiên mới nhất của user.
  - `GET /api/v1/ai-mentor/sessions/:id` — chi tiết phiên + tối đa 100 tin
    nhắn (chỉ khi session thuộc về user, không thì 404).
  - `PATCH /api/v1/ai-mentor/messages/:id/feedback` — `{ helpful: boolean }`,
    chỉ tin nhắn assistant của chính user.
  - `env.ts` thêm `OPENAI_API_KEY?` / `GEMINI_API_KEY?` (tùy chọn, chỉ qua
    Workers Secrets, không commit giá trị).
- **Trang `/ai-mentor`** (`apps/web/src/app/ai-mentor/page.tsx` + lib
  `apps/web/src/lib/ai-mentor.ts`): ô nhập (đếm ký tự, tối đa 1000),
  lịch sử hội thoại (danh sách phiên + nút hội thoại mới), 6 câu hỏi gợi
  ý (đều có câu trả lời trong kho tri thức), trích dẫn nguồn nội bộ dưới
  mỗi câu trả lời (link `/thu-vien-master?bai=…`, `/chuong-trinh/…`,
  `/#triet-ly`; nguồn course ghi rõ Đã/Chưa ghi danh), nút phản hồi
  👍 Hữu ích / 👎 Chưa hữu ích, disclaimer "AI hỗ trợ học tập, không thay
  thế bác sĩ / chuyên gia tâm lý / luật sư / cố vấn tài chính", trạng
  thái loading/success/error/empty đầy đủ; chưa đăng nhập thì hiện thẻ
  mời đăng nhập (`/dang-nhap?next=/ai-mentor`).
- **Link vào**: menu tài khoản ("AI Mentor", sau "Đánh giá 11D", icon
  `sparkles` mới trong `AccountNav`), `DashboardNav`, mục "AI Mentor" ở
  trang Tổng quan `/hoc-vien`. Không đưa `/ai-mentor` vào sitemap (cần
  đăng nhập, như `/hoc-vien/*`).
- `patchJson` mới trong `apps/web/src/lib/api-client.ts` (dùng cho feedback).

## 2. Tìm kiếm — Postgres full-text, KHÔNG phải vector embedding

Không dùng embedding thật, không dùng pgvector. Cách làm:

- `unaccent` là STABLE (đã đo trên staging: `provolatile='s'`) nên **không
  dùng được cột generated hay expression index** — duy trì `search_text`
  (lower + unaccent) và `search_vector` bằng trigger `BEFORE INSERT OR
  UPDATE`.
- Hàm `search_ai_knowledge`: tách từ khóa khỏi câu hỏi, loại ~70 từ chức
  năng tiếng Việt (là/gì/như/thế/nào/để/của/và/không/một/các/…); nếu hết
  từ nội dung thì trả 0 dòng. Chấm điểm: điểm tiêu đề
  `100 × (số từ khóa có trong tiêu đề / tổng từ khóa)²` (bình phương để
  tiêu đề khớp 1 từ đơn lẻ không át nội dung khớp đủ từ) + `10 × số từ
  nội dung khớp nguyên từ` (regex `\y…\y`, không khớp chuỗi con — "an"
  không khớp "nhân") + `số lần xuất hiện` (tối đa 10) + `15 × số cặp từ
  kề nhau khớp nguyên cụm` (tối đa 30) + `ts_rank_cd × 5` (hòa giải).
- Worker lọc thêm: chỉ giữ chunk có `rank >= 25` VÀ (`title_match` hoặc
  `pair_bonus > 0` hoặc `matched_words >= 4`).
- Hiệu chuẩn trên staging (6 câu, xem §3): câu trong Thư viện → đúng mục
  đầu tiên ("An Vui", "Bao Dung", "7 Bố Thí…"); câu về khóa → đúng khóa
  đầu tiên ("Thấu Hiểu Tâm Thức" 124.4, trên "Năng Lực" 85.0); câu ngoài
  phạm vi → bị lọc hết, trả lời "chưa tìm thấy" thay vì bịa. Lỗi đã tìm
  và sửa trong đợt này: v1 dùng `ts_rank × 10 + ILIKE` theo chuỗi con —
  "Nhân Cách Vui Vẻ" (12.79) vượt "An Vui" và câu chứng khoán vẫn trả 5
  chunk (rank 6–7); v2 thêm stopword + khớp nguyên từ + cặp từ; v3 thêm
  điểm tiêu đề bình phương (sửa "làm giàu là gì" trả "Giàu Toàn Diện"
  thay vì "Mục tiêu giáo dục").

## 3. Kiểm chứng staging (migration 0029)

- Áp staging (`scskhplczrxlnxzruweu`) qua Management API: HTTP **201**.
  Áp lại toàn bộ file lần 2: HTTP **201**, số chunk không đổi (idempotent).
- Đếm chunk: **library 119 + course 10 + philosophy 9 = 138**.
- RLS bật trên cả 3 bảng; đủ 9 policy (chunks: 1 select public;
  sessions/messages: select/insert/update/delete own).
- Hàm tìm kiếm (truy vấn trực tiếp staging):

| Câu hỏi | Kết quả top 1 | Ghi chú |
|---|---|---|
| "An vui là gì?" | An Vui — rank 148.9, title_match=true | Đúng chế độ: trả đoạn tri thức + nguồn |
| "làm thế nào để đầu tư chứng khoán lãi 100% mỗi tháng" | "Yêu Thương" 33.0, matched 3, title_match=false, pair_bonus=0 — **bị Worker lọc hết** | Ngoài phạm vi → "chưa tìm thấy", không bịa |
| "khóa Thấu Hiểu Tâm Thức học những gì" | Thấu Hiểu Tâm Thức — rank 124.4 (course) | Kèm kiểm tra ghi danh ở Worker |
| "an vui la gi" (không dấu) | An Vui — 148.9 | Tìm không dấu đúng |
| "Bao dung là gì" | Nhân Cách Bao Dung / Bao Dung — 122.0/120.5 | Đúng mục |
| "7 bố thí gồm những gì" | 7 Bố Thí Quan Trọng Đời Người — 84.4 | Đúng mục |
| "làm giàu là gì" | Mục tiêu giáo dục — 45.6 | Đúng mục |

## 4. File tạo / sửa

| File | Thay đổi |
|---|---|
| `supabase/migrations/0029_ai_mentor.sql` (mới) | 3 bảng + RLS + hàm tìm kiếm + seed 138 chunk |
| `workers/api/src/handlers/ai-mentor.ts` (mới) | ask/list/get/feedback + smart-search + nhánh LLM |
| `workers/api/test/ai-mentor.test.ts` (mới) | 17 test |
| `workers/api/test/fake-supabase.ts` | Chunk mẫu + RPC + bảng ai_* + slug khóa |
| `workers/api/src/env.ts` | `OPENAI_API_KEY?`, `GEMINI_API_KEY?` |
| `workers/api/src/supabase.ts` | `getCourseBySlug` |
| `workers/api/src/index.ts` | 4 route ai-mentor |
| `apps/web/src/lib/ai-mentor.ts` (mới) | Client API + gợi ý + validation |
| `apps/web/src/lib/ai-mentor.test.ts` (mới) | 10 test |
| `apps/web/src/lib/api-client.ts` | Thêm `patchJson` |
| `apps/web/src/app/ai-mentor/page.tsx` (mới) | Trang chat |
| `apps/web/src/styles/globals.css` | CSS `.ai-mentor-*` |
| `apps/web/src/components/account-menu-items.ts` | Thêm "AI Mentor" (sau Đánh giá 11D) |
| `apps/web/src/components/account-menu.test.ts` | 11 → 12 mục (+ admin list) |
| `apps/web/src/components/AccountNav.tsx` | Icon `sparkles` |
| `apps/web/src/components/dashboard/DashboardNav.tsx` | Thêm link "AI Mentor" |
| `apps/web/src/app/hoc-vien/page.tsx` | Mục "AI Mentor" ở Tổng quan |
| `scripts/check-migrations.mjs` | Kiểm tra 0029 (18 check) |
| `docs/CHANGELOG.md` | Mục Prompt 12 |
| `docs/frontend/TASK12_AI_MENTOR_REPORT.md` (file này) | Báo cáo |

Lưu ý: trong lúc làm, 2 agent song song chạy Prompt 13 (Cộng đồng,
migration 0030) và Prompt 14 (Gamification, migration 0031) cùng sửa
các file chung (menu, DashboardNav, `/hoc-vien`, `check-migrations.mjs`,
`globals.css`). File 0029 không trùng số; các sửa chung đã đối chiếu
thủ công với trạng thái mới nhất của file trước mỗi lần sửa (menu hiện
12 mục, DashboardNav đã có "Thành tích"). Build Pages phải chờ agent
khác build xong (chung `.next` gây fail giả) — xem §5.

## 5. Lỗi kỹ thuật gặp trong đợt (đã xử lý, không bịa kết quả)

1. **`unaccent` chưa cài + là STABLE, không phải IMMUTABLE** — probe
   staging: `pg_proc` không có `unaccent` (gọi thử → HTTP 400); sau
   `CREATE EXTENSION unaccent` thì `provolatile='s'`. Hệ quả: không
   dùng cột generated / expression index được — chuyển sang trigger
   duy trì `search_text` + `search_vector`.
2. **Đổi kiểu trả về của hàm** — `CREATE OR REPLACE FUNCTION` báo
   `42P13 cannot change return type` khi thêm cột `matched_words` /
   `title_match` / `pair_bonus`. Cách làm: `DROP FUNCTION` trước
   `CREATE` trong migration (an toàn khi chạy mới trên prod).
3. **Lỗi SQL `x = ANY(subquery)`** — dạng subquery trả về `text[]` nên
   Postgres hiểu nhầm `text = text[]` (`42883`). Sửa thành toán tử
   chứa mảng `@>`.
4. **Fake RPC so sánh chuỗi có dấu với mẫu không dấu** — test hỏi
   "Thấu Hiểu Tâm Thức" không khớp `includes('tam thuc')`. Sửa fake
   chuẩn hóa không dấu trước khi so.
5. **Import sai module** — `isSupabaseConfigured` nằm ở `env.ts`, không
   phải `supabase.ts` (17 test fail 500 lúc đầu). Sửa import.
6. **Mất dòng khai báo `postJson`** khi chèn `patchJson` bằng edit
   (old_text chỉ là dòng signature). Khôi phục ngay, typecheck lại PASS.
7. **Build song song chung `.next`** — một agent khác đang chạy
   `next build` lúc 07:05; chờ build đó xong rồi mới build solo (theo
   chuẩn đã chốt), không build chồng.

## 6. Kiểm chứng (test / build)

- `npm run check:migrations` — **PASS** (gồm 18 check mới cho 0029).
- Workers test: **345/345 PASS** (13 file; +17 test AI Mentor),
  typecheck **PASS**.
- Web test: **694/694 PASS** (38 file; +10 test AI Mentor lib,
  menu 12 mục) — sau khi sửa test admin list (11 → 12 mục).
- Web typecheck **PASS**, ESLint trên các file đợt này **PASS**.
- `pages:build` — **PASS** (22.67s, route `/ai-mentor` có trong output;
  bản build solo sau khi chờ agent khác build xong). Lưu ý: build của
  chính đợt này lúc đầu cho `ai-mentor.html` 0 byte (giống `/tu-van` có
  sẵn — trang ISR, file tĩnh chỉ là placeholder, worker render khi có
  request); bản build sau của agent song song cho file 30700 byte, đã
  dùng bản đó để deploy.

## 7. Deploy + kiểm chứng live

- Deploy Worker `api`: **thành công**, Version ID `76bb202c-f1c1-4c0b-a8e8-9c29392967ba`,
  `https://api.visfaracademy.workers.dev`. Live: `/api/v1/health` 200
  `{"ok":true,"status":"ok"}`; `GET /api/v1/ai-mentor/sessions` và
  `POST /api/v1/ai-mentor/ask` không JWT → **401** `unauthorized` đúng.
- Deploy Pages: **thành công**, `https://c28e85b9.visfaracademy.pages.dev`
  (production `https://visfaracademy.pages.dev`). Hai lần deploy đầu lỗi
  `ENOENT` do agent song song (Prompt 13/14) đang build chung `.next` và
  xóa `.vercel/output/static` giữa chừng; đã copy output (16M, có
  `ai-mentor.html` 30700 byte) sang thư mục riêng `/tmp/ai-mentor-deploy`
  rồi deploy từ đó.
- Kiểm chứng live (11/11/2026 ~07:18 UTC): `/ai-mentor` **200** qua
  `browser.open` — render đủ nhánh chưa đăng nhập (tiêu đề "AI Mentor",
  giới thiệu, thẻ mời đăng nhập, disclaimer). Xem bằng mắt trên đúng
  bản deploy (phục vụ từ file tĩnh đã deploy): **390px + 1440px đều
  đúng** — tiêu đề gradient vàng, chữ ≥16px, không tràn ngang, nút
  chạm ≥44px, footer đủ. (Logo trong ảnh chụp local hiện biểu tượng
  vỡ — do `/_next/image` cần server tối ưu ảnh, không chạy dưới
  `python http.server`; không phải lỗi trang.)
- 3 câu hỏi kiểm chứng: tầng tìm kiếm đã kiểm chứng trực tiếp trên
  staging (§3) và luồng ask đầy đủ đã kiểm chứng bằng Worker test với
  JWT thật (17 test). **Hạn chế:** Worker `api` hiện nối Supabase PROD,
  mà migration 0029 **CHƯA áp prod** (chờ nghiệm thu staging) nên route
  ask trên live sẽ trả 502 `upstream_error` cho tới khi 0029 áp prod —
  UI hiện lỗi rõ ràng, không "thành công giả". Hỏi thử 3 câu
  end-to-end bằng tài khoản thật trên live cần parent/browser-task sau
  khi 0029 lên prod (trình duyệt test trong VM không ra Internet để
  đăng nhập, cùng hạn chế đã ghi trong REAL_USER_AUDIT).

## 8. Việc còn mở

1. Áp migration **0029 lên prod** sau khi user nghiệm thu staging (lúc
   đó route ask trên live mới trả lời được thật; hiện tại trên prod chỉ
   xem được trang + trạng thái lỗi rõ ràng).
2. Hỏi thử 3 câu end-to-end bằng tài khoản thật trên live sau khi 0029
   lên prod (parent/browser-task): 1 câu trong Thư viện, 1 câu ngoài
   phạm vi, 1 câu về khóa chưa ghi danh — kiểm chứng câu trả lời, nguồn,
   ghi chú chưa ghi danh, lịch sử lưu được.
3. Adapter Gemini (nếu user cấp `GEMINI_API_KEY` mà không cấp
   `OPENAI_API_KEY`): hiện vẫn chạy tìm kiếm thông minh.
4. Nhánh LLM chưa từng chạy thật (không có key để thử) — khi user cấp
   key, thử 1 câu có key rồi kiểm chứng mode `llm` + nguồn đính kèm
   trước khi công bố.
5. Trang admin xem phản hồi hữu ích/không hữu ích: chưa có (dữ liệu
   `helpful` đã lưu, thêm trang admin khi user cần).
