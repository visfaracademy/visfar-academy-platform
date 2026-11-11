# Báo cáo rebuild trang chủ — Visfar Academy (Next.js = file HTML gốc)

- **Ngày:** 11/11/2026 ~01:33 +07
- **Nguồn chuẩn:** `~/workspace/user/files/Visfar_Academy.html` (5.742.754 byte, md5 `0328f284880efe01f672596a958715bc`)
- **Báo cáo so sánh:** `docs/frontend/HOMEPAGE_COMPARE.md` (76 điểm khác: 26 thiếu section, 17 sai màu/font, 16 thiếu ảnh/hiệu ứng, 17 thiếu/sai tính năng; 12 điểm Next.js tốt hơn NÊN GIỮ)
- **Repo:** `apps/web` (Next.js 15.4.11, React 19, Cloudflare Pages project `visfaracademy`)

## 1. Kết quả tổng quan

Trang chủ đã đủ **13 section đúng thứ tự DOM gốc** (`#lo-trinh` lồng trong `#triet-ly`,
`#su-kien` là `<div>` trong `#blog`), đủ nội dung chữ nguyên văn, đủ 27 ảnh, font
self-host, tương tác đầy đủ. Kiểm chứng bằng render thật (Chromium headless):
390px và 1440px đều **không tràn ngang**, body **16px**, manifesto **13,65px @390px**
(đúng quyết định 1), 27/27 ảnh tải đủ, **0 lỗi console** (xem §5).

**Trạng thái deploy: CHƯA DEPLOY — bị chặn ở bước xác thực Cloudflare (xem §6).**
Live https://visfaracademy.pages.dev lúc 01:33 +07 vẫn là bản cũ.

## 2. Điểm khác đã sửa (theo mã báo cáo so sánh)

### 2a. Thiếu section / nội dung — A01–A26 (đủ)
- **A01–A03** Hero: ảnh tập thể 1334×889 (priority + fetchpriority high) + chapter
  "Visfar Academy" (h1 thật, E01 giữ nguyên) + tuyên ngôn h2 3 dòng gradient
  (line1a/line1b 13,65px @390px, line2 24–26px) + đủ 4 đoạn văn + 2 CTA đúng đích.
- **A04** Sứ mệnh & Tầm nhìn: 2 thẻ khung trắng viền vàng đôi, tiêu đề thẻ 32px.
- **A05** Founder: 6 đoạn văn + ảnh chân dung 1200×1200 + dòng vai trò; đoạn 1–3
  cạnh ảnh, đoạn 4–6 toàn chiều rộng (như gốc).
- **A06–A08** Triết lý mục 1–2 + hộp "NHÂN TỐT + DUYÊN LÀNH = QUẢ NHƯ Ý" + chú thích.
- **A07** Thập Nhất Viên Mãn: đủ 11 phương diện 01–11 (thẻ chữ lớn).
- **A09** VISFAR HOME: ảnh WebP 1696×1472 + caption + `.house-legend` (hiện ≤1100px).
- **A10** Tam giác hiện thực: SVG 8 vòng / 24 nhãn / 28 `<text>` nguyên văn từ file gốc,
  tương tác hover/focus/click (vòng active nổi, 7 vòng còn lại mờ, khôi phục thứ tự
  gốc, Escape/click ngoài để gỡ). Nhãn giữ ~3,98px @390px, không legend (quyết định 2).
- **A11** Tuyên ngôn triết lý 3 dòng vàng kim tĩnh + dòng "VISFAR – Giáo dục vì sự
  phát triển toàn diện của con người."
- **A12–A13** Lộ trình 6 bước (1 hàng 6 cột desktop, 3/2/1 cột responsive) + 4 dòng
  Mục tiêu giáo dục (LÀM GIÀU/LÀM CHỦ/TRỞ NÊN/TRỞ THÀNH) + Nguyên tắc + Đích đến.
- **A14** 6 thẻ Lĩnh vực ứng dụng (đủ thân bài + dòng "Ứng dụng:").
- **A15** 10 thẻ khóa học trên trang chủ: poster 1600×900 + chữ phủ poster + pill +
  mô tả + toggle "Xem chi tiết khóa học" (mở Nội dung chính + Kết quả hướng đến) +
  thẻ 07 full-width (poster 21:9, "Hình thức: Trực tuyến, 5 ngày. Học phí: Tùy tâm."),
  khóa 04/05/06 gắn nhãn "Nội dung tạm — chờ văn bản của người sáng lập để thay."
- **A16** Doanh nghiệp: 3 thẻ giải pháp + ảnh DSC03023 1334×889.
- **A17** 8 testimonial nguyên văn + 8 ảnh chân dung (đúng người/đúng lời).
- **A18** 3 bài blog ngắn + 3 link tài nguyên.
- **A19** 3 thẻ sự kiện — ngày **25/11/2026, 18:30, Zoom** cho cả 3 (quyết định 7 +
  phê duyệt Task 02 mục 13; xem §7 về 2 điểm lệch kèm theo) + thẻ "Lịch sự kiện
  đang được cập nhật".
- **A20** 9 câu FAQ dạng `<details>/<summary>` nguyên văn.
- **A21** 4 thẻ "Đang cập nhật" + ghi chú cuối section (giữ nguyên văn — xem §7).
- **A22** Form tư vấn nhúng trên trang chủ (giữ nguyên `ConsultationForm` + luồng
  Worker API, Idempotency-Key, thank-you chỉ khi `ok:true` — E02).
- **A23** 4 bài chính sách nguyên văn (~4.380 từ, ngày cập nhật 04/11/2026) thành
  **route thật** `/chinh-sach/bao-mat`, `/dieu-khoan-tham-gia`,
  `/hoan-tra-huy-dang-ky`, `/giai-quyet-khieu-nai` (thay hash view gốc).
- **A24** Footer 5 cột (brand + Về Visfar 5 link + Khóa học 10 link + Hỗ trợ 4 policy
  + Tư vấn + Liên hệ đầy đủ + logo footer) + khối giới thiệu toàn chiều rộng +
  dòng "Cộng đồng: Cộng đồng VISFAR" + dải newsletter thật + thanh Copyright.
- **A25** `.journey-nav` "Hành trình" 13 link anchor (ẩn ≤640px như gốc).
- **A26** Topbar hotline 034 7897 868 + email visfaracademy@gmail.com (ẩn ≤920px —
  đã xác minh rule `.topbar{display:none}` nằm trong `@media(max-width:920px)`).

### 2b. Màu / font / kích thước — B01–B17 (đủ)
- **B01** Nền ivory champagne gradient 90° + lattice kim cương ±45° chu kỳ 28px.
- **B02** Be Vietnam Pro self-host: 12 face woff2 (~40KB/face, đã subset) qua
  `next/font/local`, `font-display:swap`; không Google Fonts/CDN, không base64.
- **B03** Token: `--gold:#c6a45c`, `--cream:#f7f5ef`, `--grad` (105°); `--shadow`
  về đúng bóng hover gốc `0 18px 38px rgba(0,0,0,.38)`.
- **B04/B15** `.cream` + padding section 64px (52px mobile).
- **B05/B14** Tiêu đề section có clamp riêng; `.chapter` chữ hoa, letter-spacing,
  gạch vàng 2 bên.
- **B06** Tuyên ngôn 3 dòng + gradient từng dòng + text-shadow (xem A03).
- **B07** Hover chuẩn 220ms cho nút/nav/tab/thẻ (lift −2/−3px + bóng vàng).
- **B08** Header có trạng thái scrolled (shadow khi cuộn >10px) + topbar.
- **B09** Footer: lattice + viền `#c6a45c` + dải gradient vàng `::before` +
  padding-top 60px.
- **B10** Breakpoint 560/640/700/920/1020/1100px (chọn lọc từ 134 khối gốc, không
  mang hết).
- **B11** `prefers-reduced-motion` (tắt reveal/hover) + `hover:none` (tắt lift).
- **B12/B13** Thẻ Sứ mệnh/Tầm nhìn viền vàng đôi; bóng hover đúng gốc.
- **B16** Menu dùng nhãn HOA như gốc; **B17** gradient text có text-shadow.

### 2c. Ảnh / hiệu ứng — C01–C16 (đủ)
- **C01–C08** 27 ảnh tách từ base64 ra `public/images/` (tổng 2,8MB, giải mã;
  logo chỉ 1 file — gốc nhúng trùng 2 lần), dùng `next/image` với width/height
  thật, `loading="lazy"` cho 24 ảnh, `priority` cho logo + ảnh hero.
- **C09** Favicon vuông đỏ → `src/app/icon.png` (Next.js tự dùng).
- **C10** Reveal khi cuộn (IntersectionObserver 0.08, stagger ≤320ms, fallback 2000ms).
- **C11–C13** Hover lift toàn trang; thanh tiến trình đọc; nút nổi Zalo + về đầu
  trang (hiện khi cuộn >240 và form không trong viewport).
- **C14** Tam giác tương tác (xem A10). **C15/C16** nhịp `.cream` + lattice/gradient.

### 2d. Tính năng — D01–D06, D09, D10, D13, D14, D15, D17 (đủ)
- **D01** Menu mobile (nút `#menuBtn`, toggle `.open`, `aria-expanded`, bấm link đóng).
- **D02** Active menu theo section (IntersectionObserver rootMargin `-40%/-55%`,
  cuộn <120 → Trang chủ).
- **D03** Tìm kiếm + 5 tab lọc trên trang chủ: `norm()` bỏ dấu (dùng
  `normalizeSearch` có sẵn — đã xác minh `filterCourses` dùng nó), số đếm
  **10 / 8 / 4 / 3 / 1** khớp gốc (khóa 07–09 thuộc 3 trụ, đúng `data-cat` gốc),
  đếm động "Đang hiển thị X / 10 chương trình", `#noResult` khi 0 kết quả.
  Placeholder giữ nguyên "Tìm khóa học, giảng viên…" (như gốc).
- **D04** Toggle "Xem chi tiết khóa học" ↔ "Thu gọn chi tiết" + `aria-expanded`.
- **D05** Pre-select từ CTA: `ConsultationForm` đọc `?course=<slug>` (khớp slug
  trước, tên chuẩn hóa sau; không khớp thì để trống — không lặp lỗi gốc
  "Thấu Hiểu Bản Thân" không khớp).
- **D06** Form tư vấn trên trang chủ (xem A22).
- **D09** Màn hình cảm ơn có nút "Tham gia nhóm Zalo"
  (`https://zalo.me/g/9p1ow5o696mfjvvhtfu6`) + "Zalo hỗ trợ"
  (`https://zalo.me/0347897868/`) mở tab mới.
- **D10** Policy thành route thật (xem A23). **D13** FAQ `<details>` (xem A20).
- **D14** Nút nổi + header scrolled (xem C13/B08). **D15** Skip-link mới.
- **D17** SEO: OG/Twitter/canonical (`https://visfaracademy.pages.dev`)/robots/
  JSON-LD Organization; h1 thật giữ nguyên (E01). CSP chưa thêm (xem §7).
- D07/D08/D11/D12/D16: đã tốt hơn gốc từ trước, giữ nguyên (E02/E03/E04);
  không có thay đổi.

### 2e. Giữ nguyên 12 điểm tốt hơn — E01–E12
h1 thật; form Worker API + Idempotency-Key + mã tham chiếu `VISFAR-2026-NNNNNN`;
validation thống nhất; newsletter thật; đăng nhập/đăng ký/khu vực học viên;
Supabase + trang chi tiết khóa học; không PII trong mailto/clipboard; CSS
0 `!important` (CSS gốc 300 `!important` + dead code `.intl-*` đã dọn, không
mang sang); header bảo mật; khung `.wrap` 1380px; metadata; liên hệ footer.

## 3. File đã sửa / tạo

**Mới:**
- `apps/web/src/lib/homepage-data.ts` — toàn bộ nội dung tĩnh trang chủ nguyên văn
  từ file gốc (10 khóa học, hero, founder, triết lý, lộ trình, lĩnh vực, doanh
  nghiệp, testimonial, blog, sự kiện, FAQ, đang cập nhật, journey/footer links).
- `apps/web/src/lib/policies.ts` — 4 bài chính sách nguyên văn (trích tự động từ
  `#page-*` trong file gốc).
- `apps/web/src/lib/homepage-data.test.ts` — 6 test (10 khóa học, số đếm tab,
  8 testimonial, 9 FAQ, ngày sự kiện, 4 policy).
- `apps/web/src/components/home/TriangleDiagram.tsx` — SVG tam giác 8 vòng
  nguyên văn + tương tác.
- `apps/web/src/components/home/CourseExplorer.tsx` — tìm kiếm + 5 tab + toggle.
- `apps/web/src/components/home/HomeClient.tsx` — RevealInit + FloatingButtons.
- `apps/web/src/components/home/HomeSections.tsx` — 13 section.
- `apps/web/src/app/chinh-sach/[slug]/page.tsx` — 4 route chính sách (edge).
- `apps/web/public/images/` — 26 file (logo, hero-group, founder, visfar-home,
  poster-01…10, biz-group, 8 testimonial, 3 event).
- `apps/web/public/fonts/` — 12 file woff2 Be Vietnam Pro.
- `apps/web/src/app/icon.png` — favicon vuông đỏ từ file gốc.
- `docs/frontend/HOMEPAGE_REBUILD_REPORT.md` — báo cáo này.

**Sửa:**
- `apps/web/src/app/page.tsx` — composition 13 section (thay placeholder Module 1).
- `apps/web/src/app/layout.tsx` — font local 12 face, metadata OG/Twitter/
  canonical/robots/JSON-LD, skip-link, `<main id="main-content">`.
- `apps/web/src/styles/globals.css` — token `--cream`/`--gold`/`--grad`, nền
  gradient + lattice, `.btn-gold`, khối CSS trang chủ (~380 dòng, 0 `!important`).
- `apps/web/src/components/layout/Header.tsx` — topbar, logo ảnh, menu 6 mục
  đúng đích (`/#trang-chu`, `/#gioi-thieu`, `/#chuong-trinh`, `/#su-kien`,
  `/#blog`, `/#tu-van`), menu mobile, active-section, progress bar.
- `apps/web/src/components/layout/Footer.tsx` — lưới 5 cột + intro + newsletter.
- `apps/web/src/components/ConsultationForm.tsx` — pre-select `?course=` +
  2 nút Zalo ở màn hình cảm ơn.
- `apps/web/src/app/tu-van/page.tsx` — bọc form trong `<Suspense>` (do
  `useSearchParams`).
- `docs/frontend/HOMEPAGE_COMPARE.md` — thêm mục "Đã sửa" cuối file.

**Không sửa:** file HTML gốc, `.env.local` (không commit), luồng Worker API,
Supabase seed, các route/module khác.

## 4. Quyết định lệch khỏi file gốc (đã chốt trong task hoặc bắt buộc)

1. **Khóa học trang chủ dùng dữ liệu tĩnh nguyên văn**, không đọc Supabase:
   seed Supabase (`supabase/migrations/0002_seed_courses.sql`) chỉ có mô tả ngắn,
   `details.noi_dung_chinh`/`ket_qua_huong_den` rỗng, và pillar đơn trị
   (Tâm thức 6 / Trí tuệ 1 / Nhân hiệu 2 / Cộng đồng 1) nên không tái hiện được
   thẻ gốc (chi tiết đầy đủ + tab đếm 10/8/4/3/1 + khóa 07–09 thuộc 3 trụ).
   Route `/chuong-trinh` vẫn đọc Supabase như cũ. Khi Supabase được bổ sung
   đủ nội dung chi tiết + danh mục đa trị thì chuyển trang chủ sang đọc Supabase.
2. **Poster đặt tên lại `poster-01…10.jpg`** theo số khóa mới (gốc giữ tên file
   poster-09/10/11 cho khóa 04/05/06); nội dung ảnh không đổi.
3. **Footer link khóa học → `/chuong-trinh/<slug>`** (trang chi tiết thật) thay
   vì anchor `#chuong-trinh` như gốc.
4. **Header CTA + nav dùng `/#…`** (thay `#…`) để link đúng cả khi đang ở trang khác.
5. **Nút Zalo nổi:** chữ "Z" trong vòng tròn xanh + "Zalo hỗ trợ" (gốc chỉ có
   chữ Z + text); hành vi hiện/ẩn giữ nguyên.
6. **Body text căn đều 2 lề** theo quyết định đứng 05/11/2026 (trong file gốc có
   một khối audit cuối ép `text-align:left !important` cho nhiều selector;
   đã chọn theo quyết định đứng, không theo khối audit đó).

## 5. Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `npm test` (apps/web) | **595/595 PASS** (29 file, gồm 6 test mới `homepage-data.test.ts`) |
| `npx tsc --noEmit` | **PASS** |
| `npx eslint .` | **PASS** (không lỗi) |
| `npm run build` | **PASS** (Next.js 15.4.11) |
| `npm run pages:build` | **PASS** (19,56s; `.vercel/output/static` 14M) |
| Render thật Chromium headless 390px | **PASS**: scrollW = clientW = 390 (không tràn ngang), body 16px, manifesto 13,65px vừa đúng 354px, 8 vòng tam giác hiển thị, 10 khóa học, 8 testimonial, 9 FAQ, 4 thẻ sự kiện, 27/27 ảnh tải đủ |
| Render thật Chromium headless 1440px | **PASS**: không tràn ngang, manifesto 19px, đủ section/ảnh như trên |
| Console | **0 lỗi console** từ trang. Chỉ có lỗi `ERR_TUNNEL_CONNECTION_FAILED` cho request Supabase REST từ trình duyệt headless trong sandbox (proxy sandbox chặn `*.supabase.co` từ Chromium; curl từ VM tới cùng endpoint trả 401 — endpoint vẫn sống, 401 là do thiếu key). Không phải lỗi code; form vẫn gửi được qua business/unknown khi Supabase không tải được (hành vi có sẵn). |
| HTML sau build (`next start` local, `/` 200, 162.280 byte) | Đủ 14 id section, `<h1>Visfar Academy</h1>`, 27 `<img>`, 0 `data:image`, có `25/11/2026`, `tri-ring`, `chinh-sach/bao-mat` |
| Route policy | `/chinh-sach/bao-mat` 200, `/tu-van` 200 (local) |

Ảnh chụp kiểm chứng (lưu tạm trên VM, không commit): `/tmp/shot-390.png`,
`/tmp/shot-1440.png`, `/tmp/sec-390-triet-ly.png`, `/tmp/sec-390-chuong-trinh.png`,
`/tmp/sec-390-chia-se.png`, `/tmp/sec-390-tu-van.png`, `/tmp/sec-390-footer.png`.

## 6. Deploy — CHƯA XONG (chặn ở xác thực Cloudflare)

Lệnh `wrangler pages deploy .vercel/output/static --project-name=visfaracademy`
lỗi chính xác:

> `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN
> environment variable for wrangler to work.`

Và `wrangler whoami` trả: `You are not authenticated. Please run 'wrangler login'.`

VM không có `CLOUDFLARE_API_TOKEN` trong env, không có session wrangler cũ
(`~/.config/.wrangler` chỉ có logs/metrics), không có file token nào được task
chỉ định. `wrangler login` là OAuth tương tác, subagent không chạy được.
**Build Pages đã sẵn sàng** (`.vercel/output/static`, 14M) — chỉ cần chạy lại
lệnh deploy sau khi có xác thực (token hoặc `wrangler login` ở phiên tương tác).
Live https://visfaracademy.pages.dev lúc 01:33 +07 vẫn là bản cũ
(13.530 byte, không có `#triet-ly`, không có `#chuong-trinh`).

## 7. Điểm chưa khớp hẳn + lý do (cần user/parent quyết)

1. **Sự kiện — pill "Đã diễn ra" đã bỏ:** gốc gắn pill này với ngày 22/25/28-05/2026
   (đã qua). Ngày đã chốt là 25/11/2026 (tương lai so với 11/11/2026) nên giữ pill
   sẽ sai sự thật; đã bỏ pill, chỉ giữ tag (Live free / Members only / Q&A).
2. **Sự kiện — tiêu đề Q&A:** gốc "Buổi hỏi đáp tháng 5 với Founder"; đã đổi
   thành "Buổi hỏi đáp tháng 11 với Founder" cho khớp ngày đã chốt (tháng trong
   tiêu đề là một phần của ngày). Nếu user muốn giữ nguyên "tháng 5" thì nói lại.
3. **FAQ câu 1 giữ tên khóa cũ** ("Thấu Hiểu Bản Thân… Khai Mở Trí Tuệ, Kiến Tạo
   Nhân Hiệu") nguyên văn như file gốc — theo báo cáo so sánh §1.8-5 đây là tên
   cũ còn sót, đang chờ quyết định của user (đồng bộ với "Thấu Hiểu Nội Tâm" hay giữ).
4. **Section Đang cập nhật giữ câu "Chưa có cổng đăng nhập riêng trên trang này"**
   nguyên văn gốc, dù nền tảng đã có `/dang-nhap` + `/hoc-vien` (E05). Cần user
   quyết có sửa câu này không.
5. **CSP chưa thêm** (D17 một phần): `next.config.ts` vẫn chỉ có 2 header cũ.
   Cần quyết nội dung CSP cho `next/image` + Supabase + Worker trước khi thêm.
6. **Blog/sự kiện chưa có trang chi tiết thật** (`/blog/*`, `/su-kien/*`): gốc
   cũng không có (link về `#tu-van`); đã giữ link về `/#tu-van` như gốc (D12).
7. **Chưa kiểm chứng trên điện thoại thật của user** (390px đã kiểm bằng Chromium
   headless trên VM; nút Zalo nổi, menu mobile, form pre-select cần user bấm thử
   trên máy thật sau khi deploy).
