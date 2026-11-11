# Prompt 11 — Hệ thống đánh giá 11 phương diện (11D)

Ngày: 11/11/2026. Trạng thái: **đã xong code + migration staging + test/build/deploy** (xem §7–§8).

## 1. Phạm vi đã làm

- **Migration `0027_assessments_11d.sql`** — 1 bảng duy nhất `assessments_11d`
  (`id`, `user_id` FK `auth.users`, `answers` JSONB, `scores` JSONB,
  `overall_score` numeric(4,2), `completed_at`, `created_at`, `updated_at`)
  + trigger `updated_at` + index `(user_id, completed_at desc)`.
  Không tách bảng kết quả riêng (thiết kế tối giản; điểm tính ở client theo đúng
  bộ câu hỏi đã chốt, DB chỉ lưu và ràng buộc phạm vi 1–5).
  View `assessment_aggregates_11d` (security_invoker): tổng hợp theo từng phương
  diện (avg/min/max/số lượt) — **không có `user_id`/`answers`, không PII** — để
  admin/instructor đọc tổng hợp mà không lộ dữ liệu học viên khác.
  RLS: học viên chỉ SELECT/INSERT/UPDATE/DELETE dòng của mình (`user_id =
  auth.uid()`); admin được SELECT (qua `current_role() = 'admin'`).
- **Trang công khai `/danh-gia-11d`** — 33 câu (11 phương diện × 3 câu), thang 1–5
  (Rất ít → Rất thường xuyên), mỗi câu có giải thích ngắn, không dẫn dắt, không
  phán xét. Làm bài **không cần đăng nhập** (đáp án lưu nháp localStorage);
  lưu kết quả + xem lại thì cần đăng nhập. Tiến độ `x/33`, báo lỗi khi nộp thiếu câu.
- **Báo cáo cá nhân** — điểm từng phương diện (thanh + nhãn Đang vững / Đang
  phát triển / Cần chăm sóc thêm), **biểu đồ radar SVG thuần** (không thêm lib),
  3 phương diện cao nhất, 3 cần chăm sóc thêm, mục tiêu gợi ý từng phương diện,
  lộ trình đề xuất (gợi ý khóa học thật trong 10 khóa — map: Tâm thức→01/02,
  Trí tuệ→03, Thể chất→04 Sức khỏe, Nhân cách/Mối quan hệ→05, Tài chính/Vật
  chất→06, còn lại→07/08/09 tích hợp/chuyên sâu). Disclaimer trên trang kết quả:
  “Công cụ tự đánh giá tham khảo, không thay thế chẩn đoán chuyên môn.”
  Điểm số không dùng để định giá nhân phẩm; không quảng cáo là chẩn đoán tâm lý
  hay đánh giá lâm sàng đã chuẩn hóa.
- **Trang `/hoc-vien/danh-gia-11d`** — lịch sử các lần đánh giá (mới nhất trước),
  radar so sánh lần mới nhất với lần trước, bảng thay đổi từng phương diện,
  xem chi tiết từng lần. Link vào từ menu tài khoản (“Đánh giá 11D”), nav
  dashboard và trang Tổng quan `/hoc-vien`.
- **Lib `src/lib/assessment-11d.ts`** — 11 phương diện đúng thứ tự/tên đã chốt
  (01 Tâm thức, 02 Tâm thái, 03 Tâm đạo, 04 Trí tuệ, 05 Nghị lực, 06 Thể chất,
  07 Tinh thần, 08 Phẩm chất, 09 Nhân cách, 10 Năng lực, 11 Vật chất), tính
  điểm, xếp hạng, lộ trình, tọa độ radar, lưu nháp, lưu/đọc Supabase.
  Test `assessment-11d.test.ts`: 13 test (thứ tự phương diện, 33 câu, tính điểm,
  mạnh/yếu, map khóa thật, hình học radar).

## 2. File tạo / sửa

| File | Thay đổi |
|---|---|
| `supabase/migrations/0027_assessments_11d.sql` (mới) | Bảng + RLS + view tổng hợp |
| `apps/web/src/lib/assessment-11d.ts` (mới) | Dữ liệu 11D, tính điểm, map khóa, Supabase |
| `apps/web/src/lib/assessment-11d.test.ts` (mới) | 13 test |
| `apps/web/src/components/assessment/RadarChart.tsx` (mới) | Radar SVG 11 trục (+ so sánh 2 lần) |
| `apps/web/src/components/assessment/AssessmentResult.tsx` (mới) | Báo cáo cá nhân dùng chung |
| `apps/web/src/app/danh-gia-11d/page.tsx` (mới) | Trang làm bài công khai |
| `apps/web/src/app/hoc-vien/danh-gia-11d/page.tsx` (mới) | Lịch sử + so sánh |
| `apps/web/src/components/account-menu-items.ts` | Thêm “Đánh giá 11D” (sau Lịch sử học) |
| `apps/web/src/components/dashboard/DashboardNav.tsx` | Thêm link “Đánh giá 11D” |
| `apps/web/src/components/account-menu.test.ts` | 8 → 9 mục menu |
| `apps/web/src/app/hoc-vien/page.tsx` | Thêm mục “Đánh giá 11 phương diện” ở Tổng quan |
| `apps/web/src/styles/globals.css` | CSS `.assessment-*`, `.radar-label` |
| `scripts/check-migrations.mjs` | EXPECTED_FILES 24 → 28 (thêm 0025/0026/0027/0028) + kiểm tra 0027 |
| `docs/CHANGELOG.md` (mới) | Mục 11D |
| `docs/frontend/TASK11_11D_REPORT.md` (file này) | Báo cáo |

Lưu ý: trong lúc làm, một agent song song tạo `0028_fix_s03_lessons_rls.sql`
(S-03, ngoài phạm vi Prompt 11); file đó được ghi vào EXPECTED_FILES để
`check-migrations` không FAIL, không sửa nội dung của nó.

## 3. Migration — trạng thái

- **Staging (`scskhplczrxlnxzruweu`): ĐÃ ÁP** qua Management API
  `POST /v1/projects/{ref}/database/query`, HTTP **201**. Kiểm chứng bằng query
  trực tiếp: bảng tồn tại (1), RLS bật (true), đủ 4 policy
  (`select/insert/update/delete_own`), view có đúng 5 cột tổng hợp
  (`dimension, avg_score, responses, min_score, max_score`), 8 cột bảng đúng
  kiểu. Probe anon REST staging: `GET assessments_11d` → `[]` (RLS chặn);
  `GET assessment_aggregates_11d` anon → 42501 (chỉ authenticated được đọc,
  đúng thiết kế).
- **Prod: CHƯA ÁP** (chờ nghiệm thu staging theo quy trình). Trên prod, trang
  `/danh-gia-11d` vẫn làm bài + xem kết quả bình thường (tính trên trình duyệt);
  chỉ nút “Lưu kết quả” sẽ báo lỗi cho tới khi 0027 áp prod — thông báo lỗi hiển
  rõ, không “thành công giả”.

## 4. Kiểm chứng

- `npm run check:migrations` — **PASS** (đã sửa danh sách cứng 24 → 28; lỗi
  B-06 trong PROJECT_AUDIT nay hết).
- Web test: **660/660 PASS** (35 file; +13 test 11D, +2 test từ agent song song).
  Lưu ý: 1 lần chạy `npm test` giữa chừng báo fail rồi chạy lại PASS — do agent
  song song sửa file trong lúc test chạy (xung đột `.next`/file chung), không
  phải lỗi code 11D.
- Typecheck **PASS**, ESLint **PASS**.
- `pages:build` **PASS** (46,24s; route `/danh-gia-11d` có trong output).
- Render thật local (headless Chromium, server `next start` từ đúng bản build):
  `/danh-gia-11d` 200 ở 390px + 1440px, không tràn ngang, tiêu đề gradient vàng,
  165 radio (33 câu × 5 mức). Luồng end-to-end bằng CDP: chọn đáp án 4 cho cả
  33 câu → tiến độ 33/33 → nộp → báo cáo hiện đúng (radar đủ 11 nhãn, điểm
  trung bình 4.0/5 “Đang vững”, có disclaimer, có “Lộ trình đề xuất”).
  `/hoc-vien/danh-gia-11d` khi chưa đăng nhập → **307** về đăng nhập (guard đúng).
- **Lỗi radar đã tìm và sửa trong đợt này:** nhãn trái (“10 Năng lực”,
  “09 Nhân cách”) bị cắt ở mép viewBox và 2 nhãn đáy (“07 Tinh thần” /
  “06 Thể chất”) chồng nhau. Đã sửa: viewBox có lề (`-40 -15 480 430`), 2 nhãn
  đáy neo ra hai phía; kiểm chứng lại bằng mắt ở cả 390px và 1440px — đủ 11 nhãn.

## 5. Lỗi kỹ thuật gặp trong đợt (đã xử lý, không bịa kết quả)

1. **Vercel CLI không tạo được `~/.local/share/com.vercel.cli/config.json`**
   (“operation not permitted”) → nguyên nhân thật (strace): CLI ghi file tạm rồi
   gọi `chown(..., 0, 65534)` và bị EPERM trong sandbox này. Cách làm:
   `XDG_DATA_HOME=/tmp/vdata` để CLI dùng thư mục config mới (không còn chown
   về gid cũ). Đã ghi vào §6 để các đợt sau dùng lại.
2. **`/tmp` (tmpfs 512M) đầy 100%** do lần thử `npx vercel` tải package vào
   `/tmp/vhome` (466M) → `ENOSPC`. Đã dọn `/tmp/vhome` (của đợt này) rồi build lại.
3. **Build song song chung `.next`** (agent khác + lần build mồ côi của chính đợt
   này) → `next build` lỗi `MODULE_NOT_FOUND middleware-manifest.json`. Đã chờ
   tiến trình build kia xong, xóa `.next`/`.vercel/output`, build solo lại → PASS.
4. **Trùng số migration 0027** với agent song song (lúc đầu cả hai đều đặt 0027);
   agent kia đã đổi file của họ thành 0028, file 11D giữ 0027 — không còn trùng.

## 6. Ghi chú vận hành (cho đợt sau)

- Build Pages trên VM này: `XDG_DATA_HOME=/tmp/vdata npm run pages:build`
  (tránh lỗi chown config Vercel). Không build song song với agent khác (chung
  `.next` gây fail giả). Dọn `/tmp` nếu build báo `ENOSPC`.
- Deploy: `wrangler pages deploy .vercel/output/static --project-name=visfaracademy`
  với `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` qua env var (không dùng làm
  `CLOUDFLARE_API_TOKEN`, không ghi giá trị vào file/log).

## 7. Deploy + kiểm chứng live

- Deploy Pages: `wrangler pages deploy .vercel/output/static
  --project-name=visfaracademy` — **thành công**, deploy mới
  `https://105b28b3.visfaracademy.pages.dev`, production
  `https://visfaracademy.pages.dev`.
- Kiểm chứng live (11/11/2026 ~06:43 UTC): prod `/danh-gia-11d` **200**
  (cả `browser.open` lẫn curl); `/hoc-vien/danh-gia-11d` **307** về đăng nhập
  khi chưa đăng nhập (guard đúng). HTML live tham chiếu đúng chunk trang mới
  (`app/danh-gia-11d/page-ceec3a575f4fb23a.js`, chứa “Thập Nhất”), chunk này
  tham chiếu chunk radar (8543, chứa mã radar) — tức bản build mới đã lên prod.
  Render đầy đủ sau hydration đã kiểm chứng bằng trình duyệt local trên đúng
  bản build này (xem §4); trình duyệt thật trên live chưa chạy (cần parent).

## 8. Việc còn mở

1. Áp migration **0027 lên prod** sau khi user nghiệm thu staging (lúc đó nút
   “Lưu kết quả” mới lưu được thật; hiện tại trên prod chỉ làm bài + xem kết quả).
2. Kiểm chứng bằng trình duyệt đã đăng nhập trên live (parent/browser-task):
   đăng nhập → làm bài → Lưu kết quả → mở `/hoc-vien/danh-gia-11d` thấy lần
   đánh giá → làm lại bài lần 2 → thấy so sánh thay đổi. Trình duyệt test trong
   VM không ra Internet nên chưa đăng nhập được (cùng hạn chế đã ghi trong
   REAL_USER_AUDIT).
3. Admin xem tổng hợp: chưa có trang admin cho view `assessment_aggregates_11d`
   (view đã sẵn; thêm trang admin khi user cần).
4. Câu hỏi/mục tiêu gợi ý hiện là bản agent soạn theo triết lý đã chốt — user
   gửi văn bản của mình để thay khi muốn (không tự nhận là văn bản đã chốt).
