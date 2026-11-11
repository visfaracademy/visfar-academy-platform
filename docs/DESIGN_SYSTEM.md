# DESIGN SYSTEM — Visfar Academy (tài liệu hoá hệ thống đang có)

- **Ngày:** 11/11/2026 (GĐ2, Prompt 03 — chỉ bổ sung phần thiếu, **không redesign**)
- **Phạm vi:** `apps/web/src/styles/globals.css` (973 dòng trước đợt này) +
  `apps/web/src/styles/post-auth.css` (163 dòng). Nhận diện đã chốt giữ nguyên:
  **đen than + vàng gold + nền ivory champagne** (DECISIONS QĐ 12, QĐ 19–21);
  không đổi sang cam, không đổi màu, không redesign trang nào.
- **Phương pháp:** mọi mục dưới đây đều đối chiếu code thật. Component nào không
  tìm thấy trong code được ghi rõ **"chưa có"** — không bịa component.
- **Dọn CSS đợt này (§9):** chỉ xóa khai báo chết đã chứng minh bị ghi đè hoặc
  selector không còn dùng ở đâu trong `apps/web/src`; test 702/702 + typecheck
  PASS sau dọn (xem `docs/frontend/SEO_CRO_PERFORMANCE_REPORT.md`).

## 1. Màu sắc (tokens thật trong `:root`, `globals.css`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg-ivory` | `#fdfbf3` | Nền header, nền trang sáng |
| `--bg-champagne` | `#f8f1d7` | Nền footer, topbar, nền nổi bật nhẹ |
| `--cream` | `#f7f5ef` | Nền section `.cream` |
| `--ink` | `#16130c` | Chữ chính (đen than) |
| `--ink-soft` | `#4a4232` | Chữ phụ |
| `--gold` | `#c6a45c` | Viền, điểm nhấn chính |
| `--gold-strong` | `#a8841c` | Viền đậm, accent |
| `--gold-dark` | `#6e4f0a` | Chữ vàng đậm, link |
| `--gold-mid` | `#c9a227` | Gradient, đường kẻ `.rule` |
| `--gold-light` | `#d4af37` | Gradient |
| `--gold-bright` | `#e8c766` | Gradient |
| `--gold-deep` | `#8c6d1f` | Gradient |
| `--grad` | `linear-gradient(105deg, #f4dd8f 0%, #d4af37 42%, #a8841c 78%, #e8c766 100%)` | Nút vàng, dải đầu footer, thanh tiến độ |
| `--frame` | `1380px` | Chiều rộng khung `.wrap` |
| `--radius` | `12px` | Bo góc chuẩn |
| `--shadow` | `0 18px 38px rgba(0,0,0,0.38)` | Bóng khi hover khung |
| `--font-body` | `var(--font-bvp, "Be Vietnam Pro"), "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | Font toàn trang |

Nền `body` (không qua token): `#fbf7e9` + lattice vàng chéo mờ
(`repeating-linear-gradient(45deg/−45deg, rgba(198,164,92,0.05) … 28px)`) +
gradient ngang `#fdfbf3 → #fcf9ed → #f8f1d7 → #fcf9ed → #fdfbf3`.

**Màu hard-code ngoài token (đang dùng thật, ghi để khỏi nhầm là token):**
lỗi `#b3261e`; thành công/xanh lá `#1e6b34` (`.success-text`), `#137333`
(`.pill-pass`, `.password-checklist li.met`); thất bại `#a50e0e`
(`.pill-fail`); đỏ avatar `#a31d1e`; đỏ mận poster `#560f15` (ảnh gốc) và
`#6d0813` sau filter; navy `#0a1230` (nhãn tam giác); `#fff6cc` (nhãn vàng
trên nền tối); `#f4dd8f`/`#f4e9c4` (chữ trên poster); xám khóa `#6b6252`.
Gradient tiêu đề `.gold-title` (riêng, không dùng `--grad`):
`linear-gradient(135deg, #6e4f0a 0%, #a67c00 38%, #c9a227 62%, #d4af37 80%, #e8c766 90%, #8c6d1f 100%)`
với `background-clip: text; color: transparent`.

## 2. Typography

- **Font duy nhất:** Be Vietnam Pro, **tự host** 12 face woff2
  (`public/fonts/`, `font-display: swap`, không Google Fonts/CDN), weights
  400/500/600/700/800/900 × normal/italic, biến `--font-bvp`
  (`apps/web/src/app/layout.tsx`).
- **Cơ số:** `html { font-size: 16px }`; `body` 1rem, `line-height: 1.7`;
  đoạn văn `text-align: justify` toàn trang (kèm `hyphens: auto`).
- **Phân cấp thực tế** (desktop → mobile, theo CSS):

| Cấp | Selector / vị trí | Cỡ |
|---|---|---|
| Display (tuyên ngôn dòng 2) | `.manifesto-line2`, `.phil-decl-line2` | `clamp(24px, 7vw, 26px)` / `clamp(24px, 6.4vw, 30px)` |
| Tuyên ngôn dòng 1 | `.manifesto-line1a/1b`, `.phil-decl-line1a/1b` | `clamp(12.5px, 3.5vw, 19px)` — **13,65px ở 390px, user đã chấp nhận (QĐ 1)** |
| H1 trang | `.hero h1`, `.policy-article h1` | `clamp(1.75rem, 4vw, 2.8rem)` |
| H1 auth | `.auth-card h1` | 2rem (1,7rem ≤700px) |
| H1 đánh giá | `.assessment-intro h1` | `clamp(1.75rem, 4vw, 2.6rem)` |
| H2 section | `h2.title` | `clamp(1.6rem, 7.5vw, 2.3rem)` |
| H2 trang chi tiết | `.lesson-player h2`, `.assignment-form h2` | 1,5rem |
| H3 | `h3` (toàn cục) | 1,25rem; `.mv-card h3` 2rem; `.founder-name` `clamp(1.7rem, 4vw, 2.4rem)` |
| Body | `body`, `p` | 1rem (16px), `line-height: 1.7`; `.lead` 1,05rem/1,8 |
| Caption / nhãn nhỏ | `.chapter` | 0,875rem, uppercase, `letter-spacing: 0.2em`, weight 800 |
| Label form | `.field label` | 1rem, weight 700 |
| Muted / chú thích | `.muted`, `.hint`, `.form-note` | 0,95rem |
| Nút | `.btn` | 1rem, weight 700; `.btn-small` 0,95rem |

- **Chuẩn đọc đã chốt (từ 05/11/2026):** thân bài ≥16px, nút chạm ≥44px,
  tiêu đề/tuyên ngôn/nút/menu/nhãn form/chú thích giữ căn cũ; văn bản chính
  căn đều 2 bên lề cả desktop lẫn mobile. Ngoại lệ đã chốt: nhãn Tam giác
  hiện thực ~3,98px ở 390px (QĐ 2), legend 16px đi kèm (`.house-legend`,
  hiện ≤1100px).

## 3. Layout & spacing

- **Khung:** `.wrap { max-width: 1380px; margin-inline: auto; padding-inline: clamp(18px, 4.5vw, 32px) }`.
- **Section:** `main section { padding: 64px 0 }` (52px ≤700px);
  `scroll-margin-top: 84px` (header sticky 68px + đệm).
- **Grid:** `.course-grid`, `.prog-grid`, `.fields` 3 cột → 2 cột ≤1020px →
  1 cột ≤700px; `.testimonial-grid`, `.update-grid`, `.blog-grid`,
  `.event-cards` tương tự; `.mv-grid`, `.founder-grid` 2 cột → 1 cột ≤920px;
  `.stat-grid` 5 → 3 (≤1020px) → 2 (≤700px); `.foot-grid` 5 cột →
  2 cột ≤1100px → 1 cột ≤560px; `.library-layout` 1fr/320px → 1 cột ≤900px
  (sidebar lên trên); `.lesson-layout` 1fr/340px → 1 cột ≤900px.
- **Breakpoint header:** ≤900px menu mobile (`.menu-btn`, `.main-nav` dọc);
  901–1300px header 2 dòng; ≥1301px khóa 1 dòng; topbar ẩn ≤920px.
- **Border / bo góc:** viền khung `1px solid rgba(168,132,28,0.55)` (biến thể
  `#c6a45c` / `#c9bfa4` / `#e2d9c2` theo section); bo góc chuẩn
  `var(--radius)` = 12px; pill `999px`; nút 8px; input 8px; ảnh 12px.
- **Khoảng trắng:** gap lưới 1,5rem; gap danh sách 0,5–1rem; `.rule`
  64×3px vàng; section cách nhau bằng padding 64px (không dùng margin âm).

## 4. Button system

| Class | Đặc điểm thật |
|---|---|
| `.btn` | Cơ sở: `inline-flex`, `min-height: 48px`, padding `0.7rem 1.4rem`, radius 8px, `border: 2px solid var(--gold)`, nền gradient vàng `#c9a227 → #d4af37`, chữ `--ink`, weight 700; `:disabled` opacity 0,6 |
| `.btn-gold` | Nền `var(--grad)` (190% width, hover trượt `background-position`), chữ `#171204`, `box-shadow: 0 10px 26px rgba(212,175,55,0.28)`; hover lift −2px |
| `.btn-ghost` | Nền trong suốt, viền `rgba(122,95,12,0.55)`; hover nền `rgba(212,175,55,0.12)` |
| `.btn-small` | `min-height: 44px`, padding `0.4rem 0.9rem`, 0,95rem |
| `.btn-danger` | Viền/chữ `#b3261e`, nền trắng; hover `#fdf0ef` |
| `.tab` / `.tabs` | Pill 999px, `min-height: 44px`, nền trắng, viền gold; `[aria-pressed="true"]` nền gradient vàng |
| `.header-icon-btn` | Tròn 44px, viền gold, hover lift −2px |
| Nút nổi | `.float-zalo` / `.float-cta` / `.float-top`: fixed phải-dưới, `min-width/min-height: 48px`, pill, nền `--grad`, bóng `0 10px 26px rgba(0,0,0,0.25)`; `.float-zalo` bottom 140px, `.float-cta` 76px, `.float-top` 16px |
| `.to-top` | 44px, viền gold, radius 8px |

Quy tắc chung: mọi nút/bấm `min-height` ≥44px (`button { min-height: 44px }`
toàn cục); hover chỉ trong `@media (hover: hover)` (xem §8).

## 5. Card system

- **Cơ sở `.card`:** nền trắng, viền `1px solid rgba(168,132,28,0.55)`,
  radius 12px, padding 1,25rem, bóng `0 6px 18px rgba(0,0,0,0.08)`;
  hover (desktop có chuột): lift `translateY(-3px)`, viền
  `rgba(212,175,55,0.6)`, bóng `var(--shadow)`.
- **Biến thể (cùng ngôn ngữ, khác nội dung):** `.prog-card` (poster 16/9 +
  `.prog-body`, `.featured` full-width poster 21/9), `.field-card`,
  `.voice-card` (avatar tròn 84px), `.blog-grid article`,
  `.event-card` (ảnh 16/10 + `.ev-tag` pill), `.update-card`,
  `.stat-card` (căn giữa, `.stat-num` 1,75rem vàng đậm),
  `.mv-card` (thêm `outline: 1px solid rgba(198,164,92,0.45)` cách 4px),
  `.biz article`, `.lamp`, `.equation`, `.library-banner`,
  `.ai-mentor-chat`, `.badge-card` (`.locked` opacity 0,75 + icon xám),
  `.dashboard-list .list-row` (`.unread` nền champagne + viền gold),
  `.lesson-sidebar .sidebar-module`, `.admin-inline-form` (viền đứt).
- **Auth (post-auth.css):** `.auth-card` max-width 560px, margin `3rem auto`,
  dải vàng kim 4px trên cùng (`::before`, `var(--grad)`), tiêu đề căn giữa +
  gạch 64px; mobile ≤700px padding thu lại, h1 1,7rem.
- **Pill/tag:** `.pill` (0,875rem, weight 700, viền gold, pill),
  `.ev-tag`, `.pill-locked` (xám), `.pill-pass` / `.pill-fail`
  (xanh/đỏ nhạt).

## 6. Form system

- `.field { margin-bottom: 1rem }`; label `display: block`, weight 700,
  `margin-bottom: 0.35rem`.
- Input/select/textarea: `width: 100%`, `min-height: 50px`, padding
  `0.7rem 0.9rem`, font 1rem, viền `1px solid rgba(168,132,28,0.6)`,
  radius 8px, nền trắng; **focus:** `outline: 2px solid var(--gold)` +
  `border-color: var(--gold)`; disabled opacity 0,6.
- `.field textarea` min-height 80px; `.note-textarea` line-height 1,7,
  resize vertical; `input[type="file"]` cùng khung 50px.
- Lỗi: `.field-error { color: #b3261e; font-weight: 600 }`;
  gợi ý: `.hint` (0,95rem, `--ink-soft`); trạng thái form: `.form-status`;
  honeypot chống spam: `.honeypot` (absolute, `left: -9999px`).
- Form tư vấn (`.consult-form`): 5 ô bắt buộc (họ tên / SĐT / email /
  tỉnh-thành / trụ cột-chương trình) + honeypot `website`;
  newsletter (`.newsletter-form` + `.newsletter-row`, input `flex: 1 1 240px`);
  tìm kiếm: `.search` (50px), `.header-search` (pill 200px → 140px ≥901px),
  `.library-search`.
- Radio thang đo: `.assessment-scale-option` (pill, `accent-color: var(--gold-strong)`,
  checked → nền gradient vàng).
- Checkbox checklist: `.password-checklist li.met` (xanh `#137333`).

## 7. Các pattern khác (chỉ ghi cái có thật)

| Pattern | Trạng thái thật |
|---|---|
| Header / Footer / Topbar | Có: `.site-header` sticky, `.topbar`, `.brand img` 56px, `.foot-brand img` 168px, `.site-footer::before` dải `--grad` 3px |
| Dropdown (menu tài khoản) | Có (custom, không phải component generic): `.account-menu` + `.account-trigger` (avatar tròn đỏ `#a31d1e` + tên + chevron) + `.account-dropdown` (absolute, `min-width: 260px`, nền `#fffdf6`, bóng `0 18px 40px rgba(0,0,0,0.16)`, radius 12px, mục 44px, `.active` đỏ) |
| Tabs | Có (3 dạng): `.tabs/.tab` (lọc khóa học, `aria-pressed`), `.dashboard-nav a` (`aria-current="page"` → gradient), `.admin-nav a` (pill), `.filter-tabs button` (`.active` → `var(--grad)`, chữ trắng) |
| Accordion | Có dạng native `<details>/<summary>`: `.faq details` (padding `1rem 1.25rem`, summary 44px, focus-visible outline gold), `.curriculum-module`, `.lesson-sidebar .sidebar-module`, `.dashboard-list details` |
| Breadcrumb | **Có từ GĐ2 Prompt 15** (mới): `src/components/seo/Breadcrumb.tsx` + `.breadcrumb` (ol flex, phân tách `›`, mục cuối `aria-current="page"`); dùng ở trang chi tiết khóa học, blog, chính sách |
| Modal / Dialog | **Chưa có** — không có component modal/dialog (`role="dialog"`, `aria-modal`) nào trong code; xác nhận thanh toán dùng trang `/thanh-toan/[orderId]`, không dùng modal |
| Toast | **Chưa có** — không có hệ toast; phản hồi dùng `.notice` + `role="status"`/`role="alert"` + `.form-status` |
| Alert | Có: `.notice` (viền gold, nền trắng, radius 12px, padding `1rem 1.25rem`); `.notice.error` viền `#b3261e`; `.notice.success` nền champagne; post-auth.css thêm viền trái 4px (`--gold-mid`, lỗi `#b3261e`) |
| Tooltip | **Chưa có** |
| Skeleton | **Chưa có** — trạng thái tải là dòng chữ `<p role="status">Đang tải…</p>` |
| Pagination | **Chưa có** — không có phân trang số trang; cộng đồng dùng nút "Xem thêm" (20 bài/lần), thư viện dùng thu gọn/mở rộng |
| Empty state | Có dạng text: `.no-result`, "Thư viện chưa có bài viết. Vui lòng quay lại sau.", "Chưa có …" ở dashboard/cộng đồng; không có component empty-state riêng |
| Error state | Có: `.notice.error` + `role="alert"` (tải lỗi, không tìm thấy khóa/bài, form lỗi) |
| Progress | Có: `.progress-track` (12px, nền champagne, viền gold) + `.progress-fill` (gradient vàng); `.assessment-bar` (10px) + `.progress-bar` (3px, `--grad`, transition 120ms) |
| Table (admin) | Có: `.admin-table` (nền trắng, viền gold, `th` nền champagne chữ vàng đậm; ≤700px cuộn ngang trong bảng) |
| Video / media | Có: `.video-embed`, `.video-wrap` (16/9, nền đen, radius 12px), `.pdf-viewer` (70vh), `.audio-player`, `.lesson-image` |
| Skeleton thay thế (loading) | Xem "Skeleton" ở trên — chưa có |
| Skip link / a11y | Có: `.skip-link` (ẩn tới khi focus), `.sr-only` chuẩn, `aria-label`/`aria-current`/`aria-pressed` ở nav/tab/dropdown, focus-visible outline gold ở summary |

## 8. Motion

- **Chuẩn:** mọi hover lift dùng `transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease`;
  lift −3px (khung), −2px (nút, bước lộ trình, icon header); nút gold trượt
  gradient (`background-position` 0% → 100%, nền 190% width).
- **Reveal khi cuộn:** `.reveal { opacity: 0; transform: translateY(14px); transition: opacity 480ms ease, transform 480ms ease }`,
  `.in` hiện; `IntersectionObserver` threshold 0,08, stagger tối đa 320ms
  (>640px), fallback thêm `.in` sau 2000ms (`HomeClient.tsx`).
- **Khác:** `.progress-bar span` 120ms linear; `.assessment-bar span` 200ms;
  vòng tam giác `.tri-ring` 220ms (opacity/filter); `.account-dropdown`
  chevron `transform 200ms ease`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` — `.reveal`
  hiện ngay không transition; tắt transition cho `.card, .field-card, .mv-card,
  .voice-card, .blog-grid article, .event-card, .update-card, .prog-card,
  .biz article, .lamp, .prog-help, .equation, #lo-trinh .step, .btn`;
  `scroll-behavior: auto`.
- **Hover gating:** mọi lift/bóng nằm trong `@media (hover: hover)`; khối
  `@media (hover: none)` reset `transform: none; box-shadow: none` cho cùng
  danh sách selector — trên cảm ứng không kẹt trạng thái hover.

## 9. Dọn CSS đợt này (Prompt 03 A1 — chỉ xóa cái chết, không đụng quy tắc đang dùng)

Đã xóa khỏi `globals.css` (đối chiếu `grep` toàn `apps/web/src` trước khi xóa):

1. `.hero { text-align: center; padding: 3rem 0 2rem; }` — bị ghi đè hoàn toàn
   bởi `.hero { text-align: center; padding: 88px 0 72px; }` ở phần Trang chủ
   (giữ lại `.hero h1` / `.hero .lead` đi kèm vì không có rule sau định nghĩa lại).
2. `max-width: 640px` trong `.consult-form` — bị `.consult-form { max-width: none; }`
   ở phần Form tư vấn ghi đè; giữ `margin-top: 1.5rem`.
3. Toàn bộ 3 rule `.account-greeting` (`.account-nav .account-greeting`,
   `.account-dropdown .account-greeting`, và dòng trong `@media (min-width: 901px)`)
   — class không còn xuất hiện trong bất kỳ file `.tsx` nào (AccountNav hiện
   dùng `.account-trigger-name`); các rule `.account-dropdown …` khác giữ nguyên.
4. `font-size: 0.95rem` trong `.main-nav a { text-transform: uppercase; … }` và
   dòng `.main-nav a { font-size: 0.85rem; padding: 0.6rem 0.5rem; }` trùng hệt
   trong `@media (min-width: 901px)` — cả hai đều bị rule `.main-nav a`
   toàn cục phía sau (0,85rem / 0,6rem 0,5rem) ghi đè.

**Cố tình giữ lại (không phải dead code):** `.resource-list` xuất hiện 2 lần
(cùng selector, khác `margin-top`: danh sách tài nguyên bài học vs. danh sách
tài nguyên blog — cascade có chủ đích); `.notice` trong `post-auth.css` chỉ
thêm `border-left` (ghi đè có chủ đích cho khu vực sau đăng nhập);
`.field textarea` định nghĩa riêng sau `.field input/select/textarea`
(min-height 80px có chủ đích); `.intl-*` chỉ còn trong 1 dòng comment ghi chú
"không mang dead code", không phải rule CSS.

Kiểm chứng sau dọn: `npm test` 702/702, `tsc --noEmit` PASS, `pages:build`
PASS; render thật trang chủ 390px + 1440px không tràn ngang, header/menu
không đổi (xem `docs/frontend/SEO_CRO_PERFORMANCE_REPORT.md`).
