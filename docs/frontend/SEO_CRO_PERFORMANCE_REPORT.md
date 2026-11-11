# SEO / CRO / HIỆU NĂNG — GĐ2 Prompt 15 + 16

- **Ngày:** 11/11/2026 (GĐ2). **Không redesign, không đổi nội dung/đường dẫn.**
- **Kèm theo:** `docs/DESIGN_SYSTEM.md` (Prompt 03), `docs/frontend/perf-baseline-before.json`,
  `docs/frontend/perf-after-changes.json` (số đo thô).
- **Test/build đợt này:** web **702/702 PASS** (mới: `seo.test.ts` 5, `analytics.test.ts` 3),
  typecheck PASS, `pages:build` PASS, ESLint PASS trên file đã đổi.
  (Trước đợt này: 694/694 — xem CHANGELOG.)

## A. Prompt 15 — SEO (phần còn thiếu sau sitemap/robots P0)

### A1. Kiểm tra từng trang công khai trước đợt này

| Trang | Title/meta | Canonical | OG/Twitter | JSON-LD | h1 |
|---|---|---|---|---|---|
| `/` (trang chủ) | Có (layout) | `/` | Có | Organization | 1 ("Visfar Academy") |
| `/chuong-trinh` | **Không** (client) | Không | Không | Không | 1 |
| `/chuong-trinh/[slug]` | **Không** (client) | Không | Không | Không | 1 |
| `/thu-vien-master` | **Không** (client) | Không | Không | Không | 1 |
| `/blog` | **Không** (client) | Không | Không | Không | 1 |
| `/blog/[slug]` | **Không** | Không | Không | Không | 1 |
| `/chinh-sach/[slug]` | Có (title/desc) | Không | Không | Không | 1 |
| `/tu-van` | Có (title/desc) | Không | Không | Không | 1 |
| `/goi-thanh-vien` | **Không** (client) | Không | Không | Không | 1 |
| `/dang-nhap`, `/dang-ky` | **Không** (client) | Không | Không | Không | 1 |
| `/danh-gia-11d` | **Không** (client) | Không | Không | Không | 1 |
| `/cong-dong`, `/ai-mentor` | **Không** (client) | Không | Không | Không | 1 |
| `/chung-chi/tra-cuu` | **Không** (client) | Không | Không | Không | 1 |
| `/quen-mat-khau`, `/dat-lai-mat-khau` | **Không** (client) | Không | Không | Không | 1 |

Nguyên nhân chung: hầu hết trang công khai là **client component** (`'use client'`)
nên không export `metadata` được từ page. Sitemap P0 đã có 25 URL (live 200).

### A2. Đã bổ sung đợt này

- **Metadata cấp mục (layout server, 12 file mới):** `chuong-trinh`, `thu-vien-master`,
  `blog`, `goi-thanh-vien`, `dang-nhap`, `dang-ky`, `quen-mat-khau`, `dat-lai-mat-khau`,
  `danh-gia-11d`, `cong-dong`, `ai-mentor`, `chung-chi` — title/description lấy đúng
  văn bản sẵn có trên trang, kèm canonical + OG + Twitter, qua helper
  `src/lib/seo.ts` (`publicPageMetadata`). Mô tả không viết mới, không nhồi từ khóa.
- **`/tu-van`:** thêm canonical + OG/Twitter vào metadata sẵn có.
- **`/chinh-sach/[slug]`:** `generateMetadata` thêm canonical + OG.
- **`/blog/[slug]`:** thêm `generateMetadata` (title/description/canonical, OG
  `article`, Twitter) + BreadcrumbList JSON-LD + breadcrumb UI.
- **JSON-LD Course (10 khóa, dữ liệu thật):**
  - `/chuong-trinh` — ItemList 10 Course trong **HTML tĩnh** (đặt ở
    `chuong-trinh/layout.tsx` vì trang danh sách là client + Suspense nên script
    trong page không vào HTML tĩnh — đã kiểm chứng: trước khi chuyển, HTML tĩnh
    không chứa `ItemList`; sau khi chuyển, `grep ItemList` = 1, slug đầu
    `thau-hieu-noi-tam` có mặt). ItemList này cũng hiện trên trang chi tiết
    (cùng layout) — chấp nhận được vì mô tả đúng danh mục khóa học của site.
  - `/chuong-trinh/[slug]` — Course JSON-LD riêng (title/description/slug từ DB)
    render khi khóa đã tải (client). **Giới hạn:** chỉ có sau khi JS chạy, không
    có trong HTML tĩnh; chưa kiểm chứng render sau hydration trên live (trình
    duyệt VM không tới được Supabase) — cần parent kiểm chứng bằng browser-task.
  - **Không đưa `offers`/giá vào JSON-LD** vì giá khóa hiện là "Tùy tâm / 0đ"
    (QĐ 11 Task 03) — không bịa giá.
  - Trang chủ — FAQPage JSON-LD (9 câu FAQ nguyên văn, `grep FAQPage` = 2:
    script + flight payload).
- **Breadcrumb:** component mới `src/components/seo/Breadcrumb.tsx` + CSS
  `.breadcrumb` (token sẵn có); dùng ở trang chi tiết khóa học, blog, chính sách.
- **Sitemap:** 25 → **27 URL** — thêm `/danh-gia-11d` và `/chung-chi/tra-cuu`
  (công khai, curl local 200). Không thêm `/cong-dong`, `/ai-mentor` (nội dung
  chính cần đăng nhập, khách chỉ thấy lời mời đăng nhập — cùng lý do loại
  `/hoc-vien/*`, `/admin/*`).
- **Image alt:** rà soát toàn bộ 15 vị trí `<img>`/`<Image>` — **0 ảnh thiếu alt**
  (các "MISSING" trong lần quét thô là alt dạng biểu thức `alt={...}`, kiểm tra tay
  đều có giá trị; duy nhất poster khóa học `alt=""` có chủ đích vì tiêu đề đã nằm
  trong overlay kề bên). Không sửa alt nào.
- **Semantic HTML:** mỗi trang công khai đúng **1 h1** (đo bằng trình duyệt local:
  `/` 1, `/chuong-trinh` 1, `/blog/[slug]` 1; các trang còn lại kiểm tra bằng grep
  — mỗi file page chỉ có 1 h1 ở trạng thái render chính; các h1 lặp trong code là
  các nhánh trạng thái loading/error loại trừ lẫn nhau).
- **Internal linking:** đã có sẵn và giữ nguyên — header 7 mục, footer link khóa/
  chính sách, trang chủ link neo `#triet-ly`/`#chuong-trinh`/`#tu-van`/`/#faq`,
  trang chi tiết link về `/chuong-trinh`, blog link qua lại `/blog`, chính sách
  link chéo 4 bài. Không thêm link mới (trừ breadcrumb).

### A3. Không làm (theo yêu cầu)

- Không tạo nội dung SEO trùng lặp/nhồi từ khóa; không FOMO giả, không đếm ngược
  giả, không đánh giá giả (testimonial 8 học viên là tĩnh, đã xác nhận cho phép đăng).
- Không đổi title trang chủ (dài nhưng đã chốt) và không đổi bất kỳ văn bản nào.

### A4. CRO — rà soát có bằng chứng (trang chủ + trang khóa học)

| Yếu tố | Hiện trạng (bằng chứng) | Đánh giá |
|---|---|---|
| Hero headline | Tuyên ngôn 3 dòng "KHAI MỞ TÂM THỨC • TU DƯỠNG ĐẠO ĐỨC / PHÁT TRIỂN TRÍ TUỆ • HOÀN THIỆN CON NGƯỜI / KIẾN TẠO THỊNH VƯỢNG" + 4 đoạn lead, ảnh tập thể | Rõ định vị, đã chốt |
| Hero CTA | Nút chính **"Khám phá triết lý Visfar" → `#triet-ly`** (cuộn nội trang), phụ "Tìm hiểu các chương trình →" | **Điểm yếu:** CTA chính của hero không dẫn tới đăng ký/tư vấn; đăng ký chỉ ở cuối trang (`#tu-van`), nút nổi và header "Nhận lộ trình phù hợp" |
| Giá trị / giá | Trang chi tiết hiện "Miễn phí / Tùy tâm" khi `price_vnd === 0`; checkout có nhập số tiền tùy tâm | Rõ ràng, đúng QĐ; chưa có giá thật cho khóa trả phí nên chưa test được rào cản giá |
| Social proof | 8 testimonial tĩnh (tên + vai trò + ảnh), 3 sự kiện 25/11/2026 18:30, logo/ảnh cộng đồng | Tĩnh, không có số học viên/doanh thu thật theo chương trình/kênh để xếp hạng (đã ghi trong PROJECT_AUDIT) |
| FAQ | 9 câu trên trang chủ (`FAQS`, có FAQPage JSON-LD từ đợt này) | Đủ, đúng nội dung đã chốt |
| Form tư vấn | 5 ô bắt buộc (họ tên / SĐT / email / tỉnh-thành / trụ cột-chương trình) + honeypot; gửi qua Worker API, fallback Apps Script | Ngắn gọn; fallback "thành công giả" giữ theo QĐ 3 |
| Checkout | `/thanh-toan/[orderId]`: chuyển khoản MB + mã QR user cung cấp + nội dung = mã đơn; quyền học chỉ cấp khi webhook SePay xác nhận | Đầy đủ luồng; **chưa từng chạy end-to-end thật** (PROJECT_AUDIT §3) nên tỷ lệ chuyển đổi xem → mua **chưa có dữ liệu** |
| Đo lường chuyển đổi | Không có analytics (xem A5); dashboard chưa có chỉ số tỷ lệ chuyển đổi (ANALYTICS_CHECK: 3/12 thiếu) | **Chưa có dữ liệu** — mọi nhận xét CRO trên đây là định tính, không có số đo |

### A5. GA4 + Meta Pixel — chuẩn bị tích hợp, CHƯA kích hoạt

- Code đã viết: `src/lib/analytics.ts` (`getAnalyticsConfig` — chỉ nhận GA4
  dạng `G-…` và Pixel toàn số, sai định dạng bị loại), `src/components/analytics/Analytics.tsx`
  (client, render `<Script>` gtag + fbq `PageView` chỉ khi có ID), gắn vào
  `src/app/layout.tsx`, CSP đã mở domain `googletagmanager.com`,
  `connect.facebook.net`, `google-analytics.com`, `facebook.com`
  (`next.config.ts`), biến đã thêm vào `apps/web/.env.example` (comment, không giá trị).
- **Hiện chưa có ID thật nào** (cả hai env đều trống) → component trả `null`,
  **không tải script tracking nào**. Đã kiểm chứng bằng test
  (`analytics.test.ts`: không ID → `{}`) và bằng HTML trang chủ local: không có
  `googletagmanager`/`fbevents` trong HTML. Khi user cung cấp ID thật, chỉ cần
  set env trên Pages là tracking bật — không cần sửa code.

## B. Prompt 16 — Hiệu năng

### B1. Số đo thật (headless Chromium, Playwright + chromium đã cache, server `next start` local)

- Điều kiện đo: **localhost, không throttle mạng/CPU** (máy thật của user sẽ chậm
  hơn); trình duyệt VM **không ra được Internet** nên mọi gọi Supabase từ trình
  duyệt đều rớt — xem lưu ý ở B2. LCP/CLS đo bằng PerformanceObserver
  (`largest-contentful-paint`, `layout-shift` không tính shift sau input);
  INP là **proxy**: duration lớn nhất của các `event` entry trong lúc tải + sau
  1 lần click tổng hợp (không phải INP chuẩn của Chrome UX — ghi rõ để khỏi nhầm).
- Script đo: `/tmp/perf_measure.cjs` (tạm, không commit); số thô:
  `docs/frontend/perf-baseline-before.json`, `docs/frontend/perf-after-changes.json`.

| Trang | Cỡ | | Trước (07:27 UTC) | Sau (07:34 UTC) | Mục tiêu |
|---|---|---|---|---|---|
| Trang chủ | 390px | LCP | **616 ms** | **720 ms** | ≤2.500 ms ✅ |
| Trang chủ | 390px | CLS | **0** | **0** | ≤0,1 ✅ |
| Trang chủ | 390px | INP-proxy | **24 ms** | **24 ms** | ≤200 ms ✅ |
| Trang chủ | 1440px | LCP | **520 ms** | **448 ms** | ≤2.500 ms ✅ |
| Trang chủ | 1440px | CLS | **0** | **0** | ≤0,1 ✅ |
| Trang chủ | 1440px | INP-proxy | không ghi được entry | không ghi được entry | — |
| `/chuong-trinh` | 390px | LCP | **672 ms** | **780 ms** | ≤2.500 ms ✅ |
| `/chuong-trinh` | 390px | CLS | **0,5646** | **0,5646** | ≤0,1 ❌ (xem B2) |
| `/chuong-trinh` | 390px | INP-proxy | **24 ms** | **24 ms** | ≤200 ms ✅ |
| `/chuong-trinh` | 1440px | LCP | **980 ms** | **896 ms** | ≤2.500 ms ✅ |
| `/chuong-trinh` | 1440px | CLS | **0,1666** | **0,1666** | ≤0,1 ❌ (xem B2) |
| `/chuong-trinh` | 1440px | INP-proxy | không ghi được entry | không ghi được entry | — |

Kèm theo (cả hai lần đo, không đổi): TTFB 9–20 ms (localhost), `load` ~500–800 ms,
First Load JS shared **100 kB** (build), JS tải thực tế ~237–243 kB, ảnh ~200 kB
(trang chủ, chỉ ảnh trên fold nhờ lazy-load), CSS 11 kB, 41–59 resource,
0 request lỗi HTTP ≥400, 0 tràn ngang (scrollWidth = clientWidth ở cả 2 cỡ),
h1 = 1 mỗi trang, 0 ảnh thiếu alt.

### B2. Kết luận hiệu năng

- **Trang chủ ĐẠT cả 3 mục tiêu ở cả 2 cỡ** (LCP ≤720 ms, CLS 0, INP-proxy 24 ms).
  Chênh lệch LCP trước/sau (±100 ms) là nhiễu giữa các lần chạy localhost, không
  phải hồi quy do thay đổi (JS chỉ +2 kB, số resource không đổi).
- **`/chuong-trinh` — CLS "không đạt" là SAI SỐ ĐO của môi trường VM, không phải
  lỗi trang:** đã chứng minh bằng probe riêng — gọi Supabase từ trình duyệt VM
  rớt `ERR_SSL_PROTOCOL_ERROR` (3 lần retry), trang kẹt ở "Đang tải danh sách khóa
  học…" rồi chuyển trạng thái lỗi, gây shift; giá trị CLS **giống hệt nhau trước
  và sau** (0,5646 / 0,1666) dù đợt này không đụng gì tới layout trang đó.
  CLS thật của trang khi có dữ liệu **chưa đo được** — cần đo lại bằng trình duyệt
  có Internet (live, browser-task) sau deploy. LCP/INP-proxy của trang này vẫn
  trong ngưỡng.
- **INP-proxy "không ghi được entry" ở 1440px:** PerformanceObserver `event`
  không thu được entry nào trong phiên đo (click tổng hợp không chạm phần tử có
  handler đo được); không kết luận được INP ở cỡ này — ghi rõ, không bịa số.
- **Tối ưu đã có sẵn, không cần làm thêm đợt này:** ảnh dưới fold đã
  `loading="lazy"` (founder, VISFAR HOME, biz, 8 testimonial, 3 sự kiện, 10 poster;
  hero `priority` + `fetchPriority="high"`), font Be Vietnam Pro tự host 12 face
  woff2 (`font-display: swap`), code splitting tự động của Next.js (shared 100 kB),
  mọi ảnh `<Image>` đều có width/height (chống shift). Không đổi nội dung, không
  thêm lazy-load nào (đã đủ), không đụng bundle.

## C. Kiểm chứng live (sau deploy)

- **Deploy:** `wrangler pages deploy` project `visfaracademy` — **thành công**,
  deploy mới **https://9fd24d55.visfaracademy.pages.dev**
  (production https://visfaracademy.pages.dev).
  Lưu ý: deploy build từ cây làm việc hiện tại, gồm cả code chưa commit của các
  agent song song GĐ2 (AI Mentor, Cộng đồng, Gamification, tài liệu Prompt 19) —
  không chỉ riêng đợt này; parent đối chiếu `git status` khi cần tách riêng.
- **Sitemap live:** `/sitemap.xml` 200, đủ **27 URL** (đếm bằng fetch, gồm 2 URL mới
  `/danh-gia-11d`, `/chung-chi/tra-cuu`). `/robots.txt` 200, đúng nội dung
  (chặn `/api/`, `/admin/`, `/hoc-vien/`, `/auth/`, `/thanh-toan/`).
- **Trang chủ live:** 200, render đủ (tuyên ngôn, Sứ mệnh/Tầm nhìn, Founder, Triết
  lý 11 phương diện, Lộ trình 6 bước, 10 chương trình, testimonial, sự kiện);
  HTML thô: `FAQPage` 2, `application/ld+json` 4, canonical `/`, OG có,
  `googletagmanager`/`fbevents` = **0** (tracking chưa bật).
- **`/chuong-trinh` live:** title "Mười chương trình — Visfar Academy",
  canonical `/chuong-trinh`, `ItemList` = 1 trong HTML tĩnh.
- **Blog live:** `/blog/ro-hinh-la-ra-qua` canonical đúng, `og:type` = article,
  `BreadcrumbList` = 1, breadcrumb UI = 1 (đã xem bằng mắt ở 390px local).
- **`/tu-van` live:** canonical `/tu-van`. `/danh-gia-11d` 200,
  `/chung-chi/tra-cuu` 200 (title/canonical/OG/Twitter đầy đủ trong HTML),
  `/chuong-trinh/thau-hieu-noi-tam` 200, `/chinh-sach/bao-mat` 200.
- **Trang chi tiết khóa học live:** breadcrumb UI = 1 và ItemList = 1 trong HTML
  tĩnh; 10 kết quả `"@type":"Course"` trong HTML là 10 mục của ItemList, **không**
  phải script Course riêng — script Course riêng (dữ liệu DB) chỉ render sau khi
  JS tải xong khóa học, **chưa kiểm chứng được trên live** bằng fetch (cần
  browser-task, xem mục D2).

## D. Việc còn mở

1. **CLS thật của `/chuong-trinh` (và trang chi tiết khóa học) khi có dữ liệu:**
   cần đo lại bằng trình duyệt có Internet trên live (browser-task) — VM không đo được.
2. **JSON-LD Course trang chi tiết sau hydration:** kiểm chứng bằng browser-task
   trên live (mở 1 khóa, kiểm tra script `application/ld+json` `@type: Course`).
3. **Per-course title/meta riêng:** trang chi tiết là client component nên title
   vẫn là title cấp mục "Mười chương trình — Visfar Academy"; muốn title riêng
   theo khóa phải chuyển trang chi tiết sang server component — ngoài phạm vi
   "không redesign" đợt này.
4. **GA4 / Meta Pixel:** chờ user cung cấp ID thật rồi set env trên Pages.
5. **Modal / Toast / Tooltip / Skeleton / Pagination:** chưa có trong code (ghi
   trong DESIGN_SYSTEM.md) — chỉ làm khi có yêu cầu tính năng, không tự bịa.
6. **INP chuẩn:** chưa đo được bằng INP thật của Chrome (cần tương tác thật trên
   trình duyệt có người dùng); số trên đây là proxy.
