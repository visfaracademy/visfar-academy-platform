# Prompt 13 (Cộng đồng) + Prompt 14 (Gamification) — GĐ2

Ngày: 11/11/2026. Trạng thái: **đã xong code + migration staging + test/build/deploy** (xem §7–§8).

## 1. Phạm vi đã làm

### A. Cộng đồng (Prompt 13) — migration `0030_community.sql`

- **4 bảng:** `community_posts` (`id`, `author_id`, `course_id` nullable,
  `title`, `body`, `author_name`, `created_at`, `updated_at`, `is_pinned`,
  `status` ∈ `visible|hidden`) + `community_comments` (`id`, `post_id`,
  `author_id`, `body`, `author_name`, `created_at`) + `community_reactions`
  (`id`, `post_id`/`comment_id` nullable — đúng 1 mục tiêu, `user_id`,
  `type` ∈ `like|helpful|celebrate`) + `community_reports` (`id`,
  `post_id`/`comment_id`, `reporter_id`, `reason`, `status` ∈
  `open|resolved|dismissed`, `resolved_at`).
- **RLS:** chỉ học viên đã đăng nhập đọc/ghi (anon bị thu hồi toàn bộ quyền
  — probe anon REST staging: cả 4 bảng 401 `42501`); tác giả sửa/xóa bài
  của mình; instructor/admin kiểm duyệt (ẩn/hiện/ghim/xóa bài, xử lý báo
  cáo); bài bị ẩn chỉ tác giả + người kiểm duyệt thấy.
- **Không lộ PII người khác:** tên hiển thị lưu sẵn `author_name` lúc đăng
  (lấy từ hồ sơ của chính tác giả); không join bảng `profiles` (RLS profiles
  chỉ cho đọc hồ sơ của mình + admin).
- **Không biến thành mạng xã hội gây mất tập trung:** không feed vô hạn
  (phân trang lo 20 bài + nút "Xem thêm"), không video tự phát, không bảng
  xếp hạng; chỉ học tập / hỏi đáp / chia sẻ thành tích; bài gắn theo khóa
  học hoặc chung cho cả cộng đồng.
- **Trang `/cong-dong`:** lọc theo khóa học + tất cả, đăng bài, thả cảm xúc
  (toggle), xem chi tiết; **trang `/cong-dong/[id]`:** bình luận, sửa/xóa
  bài của mình, báo cáo nội dung. **Trang `/admin/cong-dong`:** kiểm duyệt
  (duyệt/ẩn/hiện/ghim/xóa, xử lý báo cáo).

### B. Gamification (Prompt 14) — migration `0031_gamification.sql`

- **4 bảng + 1 cột:** `learning_points` (`id`, `user_id`, `points`,
  `reason`, `related_id`, `created_at`) + `badges` (`id`, `slug`, `name`,
  `description`, `icon`, `rule`) + `user_badges` (`user_id`, `badge_id`,
  `earned_at`) + `learning_streaks` (`user_id`, `current_streak`,
  `longest_streak`, `last_active_date`) + `profiles.gamification_enabled`
  (boolean, mặc định true — dùng bảng đã có, không tạo bảng trùng).
- **Quy tắc điểm (ghi trong code migration + `lib/gamification.ts` +
  trang Thành tích):** hoàn thành bài học +10, hoàn thành quiz đạt +20,
  hoàn thành khóa học +100, bài cộng đồng được người khác đánh dấu hữu ích
  +5 (tối đa 1 lần/ngày), streak mỗi ngày học liên tiếp +5.
- **Chống gian lận:** điểm do **trigger server-side** cộng (không phải
  client tự khai): `lesson_progress` → completed +10,
  `quiz_attempts.passed` +20, `enrollments` → completed +100,
  `community_reactions` `helpful` từ người khác +5, streak tính từ ngày
  `completed_at` thật trong `lesson_progress` (ngày UTC). Client **không có
  policy INSERT/UPDATE/DELETE** trên `learning_points` / `user_badges` /
  `learning_streaks` (chỉ SELECT dòng của mình + admin). Mỗi mốc chỉ thưởng
  1 lần (`UNIQUE (user_id, reason, related_id)`); riêng `community_helpful`
  và `streak` giới hạn 1 lần/ngày bằng `related_id` suy ra từ ngày
  (`md5(user||reason||current_date)`). Tự thả `helpful` cho bài của mình
  không được điểm. Tắt gamification thì hàm thưởng dừng ngay.
- **Huy hiệu khởi đầu (seed đủ 4):** "Khởi đầu" (bài đầu tiên), "Kiên trì
  7 ngày" (streak 7), "Hoàn thành khóa đầu tiên", "Người chia sẻ"
  (3 bài cộng đồng). Huy hiệu do hàm `award_badges_internal` kiểm tra điều
  kiện thật rồi mới ghi.
- **Hiển thị:** trang `/hoc-vien/thanh-tich` (tổng điểm, streak hiện tại /
  dài nhất, huy hiệu đã đạt + chưa đạt, lịch sử điểm, quy tắc điểm, nút
  bật/tắt gamification) + Tổng quan `/hoc-vien` hiện tổng điểm / streak /
  số huy hiệu + mục Cộng đồng. **Tắt gamification:** toggle
  `gamification_enabled` ở trang Hồ sơ (`/hoc-vien/ho-so`) và trang Thành
  tích; điểm cũ giữ nguyên, bật lại thì hiện lại.
- **RPC `refresh_my_gamification()`:** tính lại streak + huy hiệu của chính
  mình (`auth.uid()`, không nhận `user_id` từ client), trang Thành tích gọi
  trước khi đọc.

## 2. File tạo / sửa

| File | Thay đổi |
|---|---|
| `supabase/migrations/0030_community.sql` (mới) | 4 bảng cộng đồng + RLS + index |
| `supabase/migrations/0031_gamification.sql` (mới) | 4 bảng + cột `profiles.gamification_enabled` + seed 4 huy hiệu + 4 hàm + RPC + 5 trigger |
| `apps/web/src/lib/community.ts` (mới) | Kiểu + fetch/đăng/sửa/xóa/bình luận/cảm xúc/báo cáo/kiểm duyệt |
| `apps/web/src/lib/community.test.ts` (mới) | 12 test |
| `apps/web/src/lib/gamification.ts` (mới) | Quy tắc điểm, `computeStreakFromDates`, `fetchMyAchievements`, toggle |
| `apps/web/src/lib/gamification.test.ts` (mới) | 12 test |
| `apps/web/src/components/community/ReactionButtons.tsx` (mới) | Nút thả cảm xúc (toggle) |
| `apps/web/src/app/cong-dong/page.tsx` (mới) | Danh sách + lọc khóa học + đăng bài, phân trang 20 |
| `apps/web/src/app/cong-dong/[id]/page.tsx` (mới) | Chi tiết + bình luận + sửa/xóa + báo cáo (`runtime = 'edge'`) |
| `apps/web/src/app/admin/cong-dong/page.tsx` (mới) | Kiểm duyệt + xử lý báo cáo (`runtime = 'edge'`) |
| `apps/web/src/app/hoc-vien/thanh-tich/page.tsx` (mới) | Điểm / streak / huy hiệu / lịch sử / quy tắc / toggle |
| `apps/web/src/lib/auth.ts` | `MyProfile.gamification_enabled?` + select kèm fallback khi DB chưa có cột (prod chưa áp 0031) |
| `apps/web/src/app/hoc-vien/page.tsx` | Mục Điểm & thành tích + mục Cộng đồng |
| `apps/web/src/app/hoc-vien/ho-so/page.tsx` | Mục cài đặt gamification (toggle) |
| `apps/web/src/components/dashboard/DashboardNav.tsx` | Thêm “Thành tích” |
| `apps/web/src/components/account-menu-items.ts` | Thêm “Thành tích”, “Cộng đồng” |
| `apps/web/src/components/account-menu.test.ts` | 9 → 11 mục menu |
| `apps/web/src/lib/security.test.ts` | Đếm `.from('profiles'/'enrollments')` 3 → 4 (thêm lần retry fallback ở `auth.ts`) |
| `apps/web/src/lib/payments.test.ts` | Thêm `ai-mentor.ts` vào danh sách handler Workers (file của agent song song Prompt 12) |
| `apps/web/src/app/admin/layout.tsx` | Thêm link “Cộng đồng” vào nav admin |
| `apps/web/src/styles/globals.css` | `.success-text`, `.error-text`, `.community-*`, `.reaction-*`, `.badge-*` |
| `scripts/check-migrations.mjs` | Thêm check 0030 + 0031 |
| `docs/CHANGELOG.md` | Mục Prompt 13 + 14 |
| `docs/frontend/TASK13_14_REPORT.md` (file này) | Báo cáo |

## 3. Migration — trạng thái

- **Staging (`scskhplczrxlnxzruweu`): ĐÃ ÁP** qua Management API
  `POST /v1/projects/{ref}/database/query`, HTTP **201** cho cả hai file
  (nội dung áp lúc đó mang số 0029/0030 — xem §5 về việc đổi số sau đó;
  nội dung SQL không đổi, chỉ đổi số file). Kiểm chứng bằng query trực
  tiếp: đủ 8 bảng, RLS bật 8/8, đủ 19 policy (posts 5, comments 4,
  reactions 3, reports 3, points/badges/streaks/user_badges 1 mỗi bảng),
  seed đủ 4 huy hiệu, cột `profiles.gamification_enabled` boolean mặc
  định true, đủ 4 hàm (`award_points_internal`,
  `refresh_streak_internal`, `award_badges_internal`,
  `refresh_my_gamification`) và đủ 7 trigger. Probe anon REST staging:
  cả 8 bảng → **401 `42501`** (anon không có quyền, đúng thiết kế).
- **Prod: CHƯA ÁP** (chờ nghiệm thu staging theo quy trình). Trên prod,
  trang cộng đồng/thành tích vẫn mở được (hiện lỗi rõ khi gọi Supabase,
  không "thành công giả"); `getMyProfileState` có fallback retry không có
  cột `gamification_enabled` nên dashboard không vỡ trước khi 0031 áp prod.

## 4. Kiểm chứng

- `npm run check:migrations` — **PASS** (31 migration liên tục 0001–0031).
- Web test: **694/694 PASS** (37 file; +24 test cộng đồng/gamification
  trong đợt này; 10 test còn lại là của agent song song Prompt 12).
- Typecheck **PASS**, ESLint **PASS**.
- `next build` **PASS** (đủ 4 route mới: `/cong-dong`, `/cong-dong/[id]`,
  `/admin/cong-dong`, `/hoc-vien/thanh-tich`).
- Render thật local (headless Chromium, server `next start` từ đúng bản
  build): `/cong-dong` 200 ở 390px + 1440px, không tràn ngang, form đăng
  bài + lọc khóa học hiện đủ; `/hoc-vien/thanh-tich` khi chưa đăng nhập →
  chuyển về đăng nhập (guard đúng); `/admin/cong-dong` khi chưa đăng nhập
  → chuyển về đăng nhập.
- Deploy Pages + kiểm chứng live: xem §7–§8.

## 5. Lỗi kỹ thuật gặp trong đợt (đã xử lý, không bịa kết quả)

1. **0031 lần áp 1: `42P17: functions in index expression must be marked
   IMMUTABLE`** — unique index theo ngày dùng `created_at::date` (cast
   timestamptz→date phụ thuộc TimeZone). Đổi cơ chế: `related_id` suy ra
   từ ngày (`md5(user||reason||current_date)::uuid`) để `UNIQUE (user_id,
   reason, related_id)` ép giới hạn 1 lần/ngày; bỏ 2 unique index theo ngày.
2. **0031 lần áp 2: `42703: column "tg_op" does not exist`** — mệnh đề
   `WHEN` của trigger không được tham chiếu `TG_OP`. Bỏ `TG_OP` khỏi
   `WHEN`; lần áp 3 lại báo **`42P17: INSERT trigger's WHEN condition
   cannot reference OLD values`** — trigger INSERT không được tham chiếu
   OLD trong `WHEN`. Bỏ hẳn `WHEN`, chuyển điều kiện vào trong thân hàm
   trigger (`new.status='completed'`, `old.status` chỉ kiểm tra khi
   `TG_OP='UPDATE'`). Áp lại → **201**.
3. **Trùng số migration 0029 với agent song song (Prompt 12):** agent kia
   tạo `0029_ai_mentor.sql` trong lúc đợt này đang làm; file cộng đồng của
   đợt này lúc đầu cũng đặt 0029, gamification 0030. Đã đổi số file của đợt
   này thành **0030 (cộng đồng) / 0031 (gamification)** — giữ nguyên thứ tự
   phụ thuộc (gamification cần bảng community). Nội dung SQL đã áp staging
   không đổi, chỉ đổi số file + nhãn trong code/check script; staging
   không cần áp lại (Management API không ghi số version).
4. **Test `payments.test.ts` G-T10-3b fail:** agent song song thêm handler
   `workers/api/src/handlers/ai-mentor.ts` (Prompt 12) nên danh sách thư
   mục lệch. Đã thêm `ai-mentor.ts` vào danh sách kỳ vọng của test (ghi
   chú nguồn song song), không sửa file của agent kia.
5. **Test `security.test.ts` fail (đếm `.from('profiles'/'enrollments')`
   3 → 4):** do `getMyProfileState` thêm lần retry fallback khi DB chưa
   có cột `gamification_enabled`. Đã cập nhật test thành 4 (cả 4 đều lọc
   theo uid).
6. **Lỗi typecheck `auth.ts`:** `data = retry.data` — kiểu select retry
   thiếu cột mới. Sửa bằng cast `as typeof data`. Lỗi typecheck
   `community.ts` (`toError` trả `CommunityState<never>` không khớp
   success shape riêng): đổi `toError` trả trực tiếp shape lỗi.
7. **Lỗi lint `gamification.test.ts`:** biến `Row`/`values` không dùng —
   đã bỏ.
8. **Lỗi test logic `fetchMyAchievements` (fake trả `[]` cho maybeSingle
   khi không có dòng):** lib đã sửa để coi mảng là "không có dòng" (trả
   streak mặc định 0) thay vì chỉ sửa test.
9. **`pages:build` lần 1 lỗi thiếu `runtime = 'edge'`** ở 2 route động
   (`/cong-dong/[id]`, `/admin/cong-dong`) — đã thêm theo mẫu
   `chuong-trinh/[slug]`. Lần build `next build` tiếp theo fail 1 lần do
   build worker chết giữa chừng (log nhắc tới file của agent song song),
   chạy lại thì PASS — lỗi flaky, không phải lỗi code đợt này.
10. **Tương thích prod chưa áp 0031:** `getMyProfileState` select kèm cột
    mới sẽ lỗi `column does not exist` trên prod → đã thêm fallback retry
    không có cột; `fetchMyAchievements` coi lỗi query profiles là mặc định
    bật thay vì hỏng cả trang.

## 6. Ghi chú vận hành (cho đợt sau)

- Build Pages trên VM này: `XDG_DATA_HOME=/tmp/vdata-congdong npm run pages:build`
  (tránh lỗi chown config Vercel). Không build song song với agent khác
  (chung `.next` gây fail giả — đợt này gặp 1 lần).
- Deploy: `wrangler pages deploy .vercel/output/static --project-name=visfaracademy`
  với `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` qua env var (không dùng làm
  `CLOUDFLARE_API_TOKEN`, không ghi giá trị vào file/log).
- Staging đã áp nội dung 0030/0031 (dưới số cũ 0029/0030); nếu sau này
  chuyển sang `supabase db push`, cần `migration repair` đánh dấu version
  (theo MIGRATION_GUIDE §5.5 — Management API không ghi
  `schema_migrations`).

## 7. Deploy + kiểm chứng live

- Deploy Pages: `wrangler pages deploy /tmp/congdong-deploy
  --project-name=visfaracademy --commit-dirty=true` (copy output build ra
  `/tmp/congdong-deploy` trước khi deploy để không bị agent song song xóa
  `.vercel` giữa chừng) — **thành công**, deploy mới
  `https://e951f862.visfaracademy.pages.dev`, production
  `https://visfaracademy.pages.dev`.
- Kiểm chứng live (11/11/2026 ~07:20 UTC): prod `/cong-dong` **200**,
  render đủ (tiêu đề, giới thiệu, form "Đăng bài viết mới" với Tiêu đề /
  Nội dung / Khóa học liên quan, mục "Bài viết" + lọc theo khóa học, trạng
  thái "Đang tải danh sách bài viết…"); `/hoc-vien/thanh-tich` và
  `/admin/cong-dong` khi chưa đăng nhập → **307** về đăng nhập (guard
  đúng, đã đo bằng curl local trước khi deploy; trên live `browser.open`
  chỉ còn shell header/footer sau redirect).
- Render thật local (headless Chromium, server `next start` từ đúng bản
  build): `/cong-dong` 200 ở 390px + 1440px, không tràn ngang, tiêu đề
  gradient vàng, notice đăng nhập rõ (đã xem bằng mắt cả 2 cỡ).

## 8. Việc còn mở

1. Áp migration **0030 + 0031 lên prod** sau khi user nghiệm thu staging
   (lúc đó đăng bài/bình luận/cộng điểm mới chạy thật trên prod).
2. Kiểm chứng bằng trình duyệt đã đăng nhập trên live (parent/browser-task):
   đăng nhập → đăng bài cộng đồng → bình luận → thả cảm xúc → báo cáo →
   admin ẩn bài / xử lý báo cáo; học xong 1 bài thật → mở
   `/hoc-vien/thanh-tich` thấy +10 điểm và huy hiệu "Khởi đầu".
3. Kiểm chứng trigger thưởng điểm bằng dữ liệu thật trên staging (hiện chỉ
   kiểm chứng ở mức schema + unit test; chưa có học viên thật hoàn thành
   bài/quiz trên staging trong đợt này).
4. `refresh_my_gamification` chưa có test tích hợp với DB thật (RPC chỉ
   được gọi từ UI; logic streak đã có unit test với ngày giả).
5. Trang `/cong-dong` chưa có tìm kiếm bài viết (chỉ lọc theo khóa học) —
   thêm khi user cần.
