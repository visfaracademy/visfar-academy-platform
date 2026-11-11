# So sánh trang chủ Next.js với file HTML tĩnh gốc — Visfar Academy

**Mục đích:** chuẩn bị cho việc thiết kế lại trang chủ Next.js cho y hệt bản gốc.
**Phạm vi task:** chỉ đọc và ghi báo cáo so sánh. **Không sửa code.** Không đổi nội dung chữ đã chốt, không bịa số liệu.

| Hạng mục | Giá trị |
|---|---|
| Nguồn chuẩn (bản gốc) | `~/workspace/user/files/Visfar_Academy.html` — 5.742.754 byte, 5.141 dòng, md5 `0328f284880efe01f672596a958715bc` (đã xác minh lại bằng `md5sum` trong task này) |
| Bản gốc chốt ngày | 10/11/2026 (theo tên file/timestamp; nội dung chính sách ghi "Cập nhật: ngày 04 tháng 11 năm 2026") |
| Báo cáo phân tích sẵn (đã đọc trước) | `~/workspace/your_files/bao-cao-phan-tich-visfar-academy/Bao-cao-phan-tich-Visfar-Academy.md` — các số liệu trong báo cáo này đã được đo lại độc lập trong task này; chỗ nào chỉ lấy từ báo cáo cũ thì ghi rõ "theo báo cáo phân tích" |
| Repo so sánh | `~/workspace/visfar-academy-platform/apps/web` — Next.js `^15.3.0` theo `package.json` (task ghi 15.4 — chưa kiểm tra version đã cài trong `node_modules`), React 19, deploy Cloudflare Pages (`next.config.ts`) |
| Trang chủ Next.js | `src/app/page.tsx` (47 dòng) + `src/app/layout.tsx` + `src/styles/globals.css` (270 dòng) + `src/components/layout/Header.tsx` + `src/components/layout/Footer.tsx` |
| Ngày lập báo cáo | 11/11/2026 |
| Phương pháp | Đọc mã nguồn cả hai bên bằng script trích xuất (section/id/CSS/ảnh/JS/form) + đọc tay các file Next.js liên quan. **Không render trên trình duyệt thật, không chạy dev server, không POST thử.** Mọi nhận xét về hiển thị thực tế (màu, cỡ chữ trên điện thoại) đều suy từ CSS, chưa được kiểm chứng bằng render. |

## Kết luận nhanh

Trang chủ Next.js hiện tại **không phải là bản chuyển đổi của trang gốc mà chỉ là trang tối thiểu (placeholder) cho Module 1** — chính `page.tsx` cũng ghi rõ: *"Trang chu toi thieu cho Module 1… Cac section day du (Triet ly, Lo trinh, …) se duoc chuyen dan tu noi dung that o module noi dung sau — khong copy HTML 5,5 MB cu."*

- **Trang gốc:** 13 section, 27 ảnh nhúng base64, ~258 KB CSS (đã tách base64), JS tương tác đầy đủ (tìm kiếm/lọc khóa học, triangle SVG 8 vòng, policy hash, form → Google Sheet).
- **Trang chủ Next.js:** 2 section ngắn (hero rút gọn + 3 trụ cột), **0 ảnh**, CSS 16,7 KB, không có section nào khác. Toàn bộ "phần thân" của trang gốc đều vắng mặt trên `/`.
- Một phần chức năng gốc **đã tồn tại ở dạng tốt hơn** trong repo nhưng nằm ở route khác (`/chuong-trinh`, `/tu-van`, footer) hoặc ở tầng API — không được tính là "có trên trang chủ".
- **Tổng điểm khác đếm được: 76 điểm** — (a) thiếu section/nội dung: 26 · (b) sai màu/font/kích thước/khoảng cách: 17 · (c) thiếu ảnh/hiệu ứng: 16 · (d) thiếu/sai tính năng: 17. Ngoài ra có **12 điểm Next.js đang tốt hơn bản gốc và NÊN GIỮ** (mục 4e).

---

# 1. Bản HTML tĩnh gốc — kiểm kê đầy đủ

## 1.1. Cấu trúc: 13 `<section>` (thứ tự DOM)

| # | id | class | Tiêu đề chính (h2) | Nội dung chính |
|---|---|---|---|---|
| 1 | `trang-chu` | `.hero` | Tuyên ngôn (h2, không phải h1): "KHAI MỞ TÂM THỨC • TU DƯỠNG ĐẠO ĐỨC / PHÁT TRIỂN TRÍ TUỆ • HOÀN THIỆN CON NGƯỜI / KIẾN TẠO THỊNH VƯỢNG" | Ảnh tập thể 1334×889, chapter "Visfar Academy", 4 đoạn văn (tổ chức lấy con người làm trung tâm; giáo dục chân chính; hài hòa trí tuệ–đạo đức; mục tiêu tối thượng lan tỏa Triết lý Giáo dục Tận Gốc) |
| 2 | `su-menh-tam-nhin` | — | Sứ mệnh & Tầm nhìn | 2 thẻ Sứ mệnh / Tầm nhìn, khung trắng viền vàng đôi, tiêu đề thẻ 32px |
| 3 | `gioi-thieu` | `.cream` | LÊ ĐĂNG QUYẾT | Founder: 6 đoạn văn bản của user + ảnh chân dung; cột phải đoạn 1–3, đoạn 4–6 toàn chiều rộng; dòng giới thiệu "Nhà sáng lập Visfar Academy. Người kiến tạo và lan tỏa triết lý giáo dục tận gốc" |
| 4 | `triet-ly` | — | TRIẾT LÝ GIÁO DỤC TẬN GỐC | 6 mục (xem 1.7): Tư tưởng cốt lõi, Quan niệm giáo dục, Hệ thống giáo dục (Thập Nhất Viên Mãn — 11 phương diện), Mục tiêu giáo dục, Nguyên tắc giáo dục, Đích đến giáo dục; hộp "NHÂN TỐT + DUYÊN LÀNH = QUẢ NHƯ Ý"; đồ hình VISFAR HOME; Tam giác hiện thực SVG 8 vòng / 24 nhãn; Tuyên ngôn triết lý |
| 5 | `lo-trinh` | — | Lộ trình 6 bước: Biết - Tin - Hiểu - Thấu Suốt - Chuyển Hóa - Huân tập & Quảng bá | 6 thẻ (1 hàng 6 cột desktop). **Lưu ý DOM: `<section id="lo-trinh">` nằm LỒNG TRONG `<section id="triet-ly">`** (mở sau thẻ 11 VẬT CHẤT, đóng trước khi `#triet-ly` đóng) và chứa luôn mục 4 Mục tiêu giáo dục, mục 5 Nguyên tắc giáo dục, mục 6 Đích đến giáo dục + Tuyên ngôn triết lý |
| 6 | `linh-vuc` | — | Một khung chung, sáu lĩnh vực của đời sống | 6 thẻ Lĩnh vực ứng dụng 01–06: Nội tâm, Sức khỏe, Mối quan hệ, Tài chính, Tổ chức trường tồn, Cộng đồng tinh hoa |
| 7 | `chuong-trinh` | `.cream` | MƯỜI CHƯƠNG TRÌNH – MỘT HÀNH TRÌNH PHÁT TRIỂN | 10 khóa học (bảng 1.7), ô tìm kiếm, 5 tab lọc, nút "Xem chi tiết" mở rộng từng thẻ; thẻ 07 full-width, poster banner 21:9 |
| 8 | `doanh-nghiep` | `.cream` | Khi đội ngũ cùng nhìn một hướng, văn hóa tự thành hình | 3 thẻ giải pháp + ảnh DSC03023 (1334×889) |
| 9 | `chia-se` | — | Học viên nói bằng trải nghiệm của họ | 8 testimonial thật (user đã xác nhận cho phép đăng), kèm ảnh đại diện 84×84 |
| 10 | `blog` | `.cream` | Ba bài viết ngắn, cho sự thay đổi thật | 3 bài blog ngắn + **`<div id="su-kien">` nằm BÊN TRONG section `#blog`** (không phải section riêng): 3 thẻ sự kiện 22/05, 25/05, 28/05/2026 + 1 thẻ "Lịch sự kiện đang được cập nhật" |
| 11 | `faq` | — | Câu hỏi thường gặp | 9 `<details>/<summary>` (xem 1.7) |
| 12 | `dang-cap-nhat` | — | Những phần đang được chuẩn bị | 4 thẻ placeholder: Đội ngũ chuyên gia, Nghiên cứu & xuất bản, Đối tác, Đánh giá & chứng nhận |
| 13 | `tu-van` | `.form-section.cream` | Đăng ký tham gia | Form tư vấn `#consultForm` → Google Sheet (xem 1.5). **`#policyView` (4 trang con chính sách) nằm BÊN TRONG section `#tu-van`** trong DOM |

**Ngoài 13 section:** header (topbar + logo + menu 6 mục + nút "Nhận lộ trình phù hợp" + `#progressBar`), `.journey-nav` "Hành trình" với 13 link anchor (Sứ mệnh & Tầm nhìn · Nhà sáng lập · Triết lý · Thập Nhất Viên Mãn · Lĩnh vực · Chương trình · Lộ trình · Doanh nghiệp · Học viên · Bài viết · Hỏi đáp · Đang hoàn thiện · Kết nối), footer 5 cột + khối giới thiệu toàn chiều rộng + dải newsletter + thanh Copyright, nút nổi Zalo (`#floatZalo`) và về đầu trang (`#floatTop`).

**Thống kê đo lại trong task này:** 72 `id` (0 trùng), h1 = 4 (chỉ trong 4 bài chính sách ẩn — **trang chính không có h1**), h2 = 46, h3 = 66, h4 = 5, h5/h6 = 0; 115 `<a>` (91 link nội bộ `#…`), 19 `<button>`, 9 `<details>`, 1 `<form>`, 1 `<iframe>` ẩn (`#sheetFrame`, 1×1px, `title=""` rỗng).

## 1.2. CSS chính

- **7 khối `<style>`, tổng 1.353.803 ký tự; sau khi tách các `data:` URI base64 còn ≈ 257.932 ký tự ≈ 258 KB CSS thật.** ~1.955–2.015 rule (tùy cách đếm khối `@media`/`@font-face`), 1.104 selector duy nhất, **134 `@media`, 74 `clamp()`, 300 lần `!important`, 41 lần `white-space:nowrap`** (đã đo lại: `!important` = 300, `@media` = 134, `clamp(` = 74).
- **Token gốc (`:root`, khối style đầu):** `--black:#171717; --coal:#1c1c1c; --cream:#f7f5ef; --cream2:#efe9dc; --paper:#ffffff; --gold:#c6a45c; --gold2:#e8c766; --gold3:#f4dd8f; --gold-deep:#8a6d2a; --ink:#16130c; --muted-d:#ddd8c9; --muted-l:#3d382c; --grad:linear-gradient(105deg,#f4dd8f 0%,#d4af37 42%,#a8841c 78%,#e8c766 100%); --shadow:0 24px 60px rgba(0,0,0,.45); --radius:12px`.
- **Nền toàn trang (khối chốt cuối, ghi đè nền đen ban đầu):** `html{background:#fdfbf3}`; `body{background-color:#fbf7e9; background-image: lattice kim cương chéo vàng rất mờ (2 × repeating-linear-gradient ±45°, rgba(198,164,92,.05), chu kỳ 28px) + linear-gradient(90deg,#fdfbf3 0%,#fcf9ed 24%,#f8f1d7 50%,#fcf9ed 76%,#fdfbf3 100%); color:#171717}` — tức ivory champagne #FDFBF3 hai bên, #F8F1D7 ở giữa, trung bình #FBF7E9. Lưu ý: CSS gốc ban đầu đặt `body{background:var(--black); color:#f2efe6}` (nền đen) và chỉ khối chốt cuối mới đổi sang nền sáng — thứ tự thắng phụ thuộc hoàn toàn vào vị trí cuối file + `!important`.
- **Khung:** `.wrap{width:100%; max-width:1380px; margin-inline:auto; padding-inline:clamp(18px,4.5vw,32px)}` — nội dung 1.316px ở 1440px, 354px ở 390px (đệm 18px mỗi bên).
- **Font:** 12 `@font-face` **Be Vietnam Pro tự host bằng base64** (weights 400–900, normal + italic, `font-display:swap`, tổng ≈ 643 KB base64 ≈ 470 KB giải mã, không subset, không Google Fonts/CDN). Stack: `"Be Vietnam Pro","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`. Thân bài `font-size:17px` (khối đầu) rồi chốt cuối `16px`, `line-height:1.65–1.7`, `text-align:justify` (52 lần) + `hyphens:auto`, `lang="vi"`.
- **Gradient vàng tiêu đề (chuẩn, 135°):** `linear-gradient(135deg,#6e4f0a 0%,#a67c00 38%,#c9a227 62%,#d4af37 80%,#e8c766 90%,#8c6d1f 100%)` với `background-clip:text`, điểm sáng nhất `#e8c766` ở 90%, không điểm gần trắng. Áp cho tuyên ngôn hero (`.manifesto-line1a/1b`, `.manifesto-line2`), Tuyên ngôn triết lý (`.phil-decl-line1/2`), các tiêu đề section.
- **Tuyên ngôn hero (chốt cuối):** line 1a "KHAI MỞ TÂM THỨC • TU DƯỠNG ĐẠO ĐỨC" và line 1b "PHÁT TRIỂN TRÍ TUỆ • HOÀN THIỆN CON NGƯỜI" mỗi dòng `white-space:nowrap`, `clamp(12.5px,3.5vw,19px)` → **13,65px ở 390px**, 19px từ 768px trở lên; line 2 "KIẾN TẠO THỊNH VƯỢNG" `clamp(24px,7vw,26px)` mobile / tới 30–32px desktop. Đây là giới hạn hình học của yêu cầu "mỗi cụm đúng 1 dòng" — user chưa chấp nhận cỡ 13,65px (theo báo cáo phân tích).
- **Cỡ chữ tiêu đề (tính từ clamp):** `#philosophyTitle` 21,06px @390 → 44,8px @1440; `.triangle-caption` 27,3 → 57,6; `.house-caption` ~32–33 → 57,6; `#roadmapTitle` 26 → 34; `#fieldsTitle` 26 → 46; `#coursesTitle` 25 → 38; `#bizTitle` 25 → 36. Tiêu đề 4 thẻ Mục tiêu giáo dục cố định 16px.
- **Chữ dưới sàn 16px còn tồn tại trong gốc** (không được gọi là "đã xong"): nhãn SVG Tam giác `font-size:11.5px` trên viewBox 1024×891 → **≈3,98px ở 390px**; `.card .tier` 11,52px; `.poster-kicker` ~10,24–10,56px mobile; nhiều nhãn `.72rem–.86rem`. Quy tắc ép 1 dòng cũ (`white-space:nowrap` 41 lần, clamp tí hon như `#roadmapTitle clamp(6.5px,2.02vw,12.5px)` → 7,88px @390) vẫn nằm trong file dưới dạng dead code, chỉ bị khối audit cuối (`!important`) ghi đè.
- **Hover chuẩn toàn trang:** `translateY(-3px)`, viền vàng `rgba(212,175,55,.6)`, bóng `0 18px 38px rgba(0,0,0,.38)`, 220ms; tắt trên touch và `prefers-reduced-motion` (15× `prefers-reduced-motion`, 6× `hover:none`). Nút: `.btn-gold:hover{background-position:100% 50%; transform:translateY(-2px); box-shadow:0 16px 32px rgba(212,175,55,.38)}`; `.btn-ghost:hover{background:rgba(212,175,55,.12)}`.
- **Section `.cream`:** nền `#f7f5ef` (có biến thể `#fdfcf8`), `padding:54–78px 0` (nhiều lần ghi đè khác nhau trong file).
- **Footer CSS:** `footer{background-color:#f8f1d7; background-image: lattice ±45° như body; border-top:1px solid #c6a45c; padding-top:60px}`, `footer::before` dải gradient vàng ngang có `box-shadow:0 0 12px rgba(198,164,92,.30)`. (Footer gốc nền champagne sáng, **không** phải nền đen.)
- **Breakpoint:** nhiều nhất 640px (25×), 880px (19×), 700px (13×), 920px (12×), 600px (10×), 1100px (7×), 560px (7×), 1020px (4×). **Không có breakpoint riêng 768px.** Touch target: nút 48px, tab/link footer/policy 44–46px, `.menu-btn` 48×48px, input/select 50px, `#fCity` 52px.
- **Nợ kỹ thuật (giữ nguyên để biết khi chuyển đổi):** 300 `!important` trên 187 dòng; selector trùng nhiều nhất `nav.main a` ×14, `section` ×9, `.foot-grid` ×8, `html.js .reveal` ×8; dead CSS `.intl-note` ×15 / `.intl-panel` ×30 (0 phần tử), `#phuong-phap-giao-duc`, `#he-thong`, `.phil-subtitle` (0 phần tử). **Không nên copy-paste nguyên CSS này** — xem mục 5.

## 1.3. JS (3 khối `<script>`, tổng ≈ 20.756 ký tự ≈ 21 KB, 0 framework, 0 thư viện ngoài)

Hàm đã đo được: `setActiveMenu`, `updateProgress`, `norm`, `applyCourseFilter`, `requestFilter`, `copyText`, `fallbackCopy`, `updateFloats`, `appendPhoneLink`, `setStatus`, `summaryRow`, `showThankYou`, `showFallbackOk`, `showErr`, `submitViaIframe`, `onLoad`, `finish`, `fallback`, `renderPolicy`, `restoreOrder`, `activate`, `deactivate`. 24 `addEventListener`, 36 `getElementById`, 10 `querySelectorAll`, 0 `localStorage`/`sessionStorage`/cookie, 0 `innerHTML`/`eval`/`document.write`/`console.log`/`alert` (theo báo cáo phân tích; đã đối chiếu hàm qua trích xuất).

| Chức năng | Cách hoạt động trong gốc |
|---|---|
| Menu mobile | `#menuBtn` toggle `.open` + `aria-expanded`; bấm link trong nav thì đóng menu |
| Active menu theo section | `IntersectionObserver` rootMargin `-40%/-55%`; scroll <120 → `trang-chu`; `#su-kien` là `<div>` trong `#blog` vẫn quan sát được |
| Thanh tiến trình đọc | `#progressBar`, width % theo scroll, listener `scroll` + `resize` |
| Reveal khi cuộn | Observer threshold 0.08, stagger tối đa 320ms (>640px, không reduced-motion); fallback `setTimeout 2000ms` ép thêm `.in` cho tất cả; không có Observer thì thêm ngay |
| Tìm kiếm + lọc khóa học | `norm()` bỏ dấu/diacritics, `đ→d`; lọc theo `data-cat` + tìm trong toàn bộ `textContent` của thẻ; đếm "Đang hiển thị X / 10 chương trình"; `#noResult` hiện khi 0 kết quả; placeholder "Tìm khóa học, giảng viên…" (nhưng không có trường giảng viên nào — tìm tên giảng viên luôn ra 0 kết quả) |
| Toggle chi tiết khóa học | 10× `.prog-toggle`, toggle class `details-open`, đổi `aria-expanded` và nhãn "Xem chi tiết khóa học" ↔ "Thu gọn chi tiết" |
| Pre-select khóa học từ CTA | 15× `[data-course]` so sánh `option.text`/`value` với `data-course` sau khi chuẩn hóa khoảng trắng; **trừ 1 link cũ "Thấu Hiểu Bản Thân (miễn phí)" không khớp option mới "Thấu Hiểu Nội Tâm (miễn phí)" → bấm link này không chọn được khóa nào, im lặng** |
| Header + nút nổi | header thêm class khi scroll >10; Zalo + về đầu trang hiện khi scroll >240 **và** form không trong viewport **và** không mở policy |
| Policy 4 trang con bằng hash | hash → hiện đúng 1 bài, `body.policy-open`, scroll về 0; hash khác → đóng, scroll tới anchor nếu có. Link `href="#chinh-sach-bao-mat"`… **không có phần tử nào mang `id` đó** (đích thật là `id="page-bao-mat"`… + `data-policy`); chỉ chạy nhờ `renderPolicy()` bắt `hashchange` |
| Tam giác hiện thực SVG | 8 `.tri-ring`, mouseenter/focus/click → ring đó `.is-active`, 7 ring còn lại mờ, đưa ring lên trên cùng bằng `appendChild`; mouseleave/focusout/click ngoài/Escape → gỡ, khôi phục thứ tự gốc. Chỉ xác minh ở mức mã nguồn |
| Form submit | Xem 1.5 |
| Code chết | `[data-copy]`: 0 phần tử (handler không bao giờ chạy); `#floatCta`: JS `getElementById("floatCta")` nhưng HTML không có id này — nhờ guard `if(floatCta)` nên không crash, nhưng tính năng "nút CTA nổi sau 700px" vĩnh viễn không hiện |

## 1.4. Ảnh: 27 `<img>`, tất cả `src` đều là `data:` URI, 0 `src` ngoài

Tổng base64 của 27 `<img>` ≈ **4.684 KB ký tự base64 (≈ 4,57 MB trong file), giải mã ≈ 3,43 MB**. Thêm favicon (data URI, file vuông đỏ) + 1 chevron SVG trong CSS. `loading="lazy"` = 24/27; eager = 3 (logo header, ảnh hero, logo footer); hero có `fetchpriority="high"`; 26/27 ảnh có `width/height`; **không có `srcset`/`sizes`**. 10 poster khóa học có `alt=""` rỗng. Kích thước dưới đây là độ dài base64 trong file (KB, làm tròn) — cùng phương pháp với báo cáo phân tích nên khớp với báo cáo đó (chênh ±1 KB do làm tròn).

| # | Ảnh (mô tả / alt) | Loại, hiển thị | Base64 ≈ |
|---|---|---|---|
| 0 | Logo Visfar Academy (header) — "Logo Visfar Academy — chữ V vàng kim và 5 ngôi sao, dòng chữ…" | PNG, 160×160, eager | 225 KB |
| 1 | Ảnh tập thể hero — "Đông đảo thành viên và học viên Visfar Academy đứng trên sân…" | JPEG, 1334×889, eager, `fetchpriority="high"`, viền `#c6a45c` + bóng `0 18px 40px rgba(122,95,12,.15)` | 335 KB |
| 2 | Chân dung founder Lê Đăng Quyết — "mặc vest xanh navy, áo sơ mi đen và cà vạt sọc…" | JPEG, lazy | 175 KB |
| 3 | Đồ hình ngôi nhà viên mãn VISFAR HOME | WebP, 1696×1472, lazy | 485 KB |
| 4–13 | 10 poster khóa học 01–10 (1600×900, tên khóa là chữ HTML thật phủ trên poster, không vẽ vào ảnh) | JPEG, lazy, `alt=""` | 130 / 129 / 128 / 108 / 109 / 107 / 129 / 127 / 128 / 128 KB |
| 14 | Ảnh doanh nghiệp DSC03023 — "Năm người Việt chụp ảnh chung tại một sự kiện…" | JPEG, 1334×889, lazy | 246 KB |
| 15–22 | 8 chân dung học viên (Trần Thị Thu Hằng, Lê Hoàng Nam, Nguyễn Minh Khoa, Đỗ Bảo Anh, Võ Đức Huy, Phạm Thanh Trúc, Lương Khánh Vy, Nguyễn Hoàng Ánh) | PNG, hiển thị 84×84, lazy | 44 / 48 / 41 / 53 / 48 / 64 / 51 / 182 KB (Nguyễn Hoàng Ánh lớn nhất) |
| 23–25 | 3 ảnh sự kiện (micro sân khấu; lớp workshop; diễn giả trên sân khấu) | JPEG, 1200×750 (16:10), lazy | 168 / 157 / 137 KB |
| 26 | Logo Visfar Academy (footer) — cùng 1 file với #0, lặp lại | PNG, 230×230, eager | 225 KB (trùng lặp: 450 KB cho 2 lần nhúng cùng logo) |

**Lưu ý về ảnh:** logo hiện tại là file trong suốt, bỏ nền đỏ, chỉ giữ logo, `drop-shadow(0 4px 10px rgba(0,0,0,.18))`; favicon vẫn là file vuông đỏ. Poster khóa học 04/05/06 mới **giữ tên file poster-09/10/11 cũ**, không đổi theo số mới.

## 1.5. Form tư vấn `#consultForm` (dòng 4315–4438 trong file gốc)

| Field | Kiểu / thuộc tính | Bắt buộc |
|---|---|---|
| `source` (hidden) | `<input type="hidden" name="source" value="visfar-academy">` | — |
| Họ và tên `#fName` / `name="fullName"` | text, `autocomplete="name"`, placeholder "Nguyễn Văn A" | Có |
| SĐT `#fPhone` / `name="phone"` | tel, `inputmode="tel"`, hint "10 chữ số, bắt đầu bằng số 0" | Có |
| Email `#fEmail` / `name="email"` | email | Có |
| Tỉnh/TP `#fCity` / `name="province"` | `<select>`, 1 placeholder disabled + **34 tỉnh/thành theo thứ tự ABC** (An Giang → Vĩnh Long) | Có |
| Khóa học `#fCourse` / `name="course"` | `<select>`, 1 placeholder + **12 lựa chọn** (10 khóa 01–10 + "Doanh nghiệp — đào tạo / diễn giả / cố vấn" + "Chưa biết bắt đầu từ đâu — cần tư vấn lộ trình") | Có |
| Submit | `<button type="submit">Đăng ký tham gia</button>`, rộng 100% | — |

- Form có `novalidate` — validation trình duyệt tắt hoàn toàn, mọi kiểm tra do JS tự làm. Không có textarea ghi chú, không checkbox đồng ý điều khoản, không CAPTCHA, không honeypot, không upload biên lai.
- **Validation JS:** họ tên chỉ kiểm tra khác rỗng; SĐT `/^0\d{9}$/` (không chấp nhận +84); email client cho phép TLD 1 ký tự (`a@b.c` qua được) trong khi Apps Script server yêu cầu `\.[^\s@]{2,}$` — **lệch validation client/server**. Tỉnh chỉ cần `select.value` khác rỗng. Lỗi gom vào `#formErr` + `#formStatus`, cuộn tới lỗi, không gửi.
- **Submit:** fetch CORS mặc định (đính chính quan trọng so với ghi chú cũ: trong file này **không có `mode:"no-cors"`**, grep = 0), `Content-Type: application/x-www-form-urlencoded`, payload tự build bằng `URLSearchParams` (không dùng `FormData` nên hidden `source` thực ra không được gửi qua form — giá trị `source` được hard-code lại trong JS), timeout 30.000ms qua `AbortController`, tới URL Web App duy nhất trong file (dòng 4862, xem Phụ lục A — không ghi lại URL đầy đủ ở đây vì không cần cho việc thiết kế lại giao diện; xem `leads.ts` trong repo). `res.text()` → `JSON.parse`, **không kiểm tra `res.ok`/HTTP status**; `data.ok === true` → `showThankYou()`; `data.error` → hiển thị nguyên văn lỗi server; JSON lỗi / fetch reject → `fallback()` bằng iframe.
- **Fallback iframe:** `#sheetFrame` 1×1px, timer 25.000ms; cross-origin nên không đọc được phản hồi — bất kỳ sự kiện `load` nào cũng được coi là "đã gửi" (`showFallbackOk()` hiện hộp `#formOk` bên trong form với văn bản thừa nhận "đã gửi đi bằng cách dự phòng, nhưng trình duyệt không đọc được xác nhận ghi nhận"). Hết 25s không `load` → báo lỗi "Không nhận được xác nhận…".
- **Thank-you view** (`#thankYou`, chỉ gọi khi `data.ok === true` ở nhánh fetch chính): cá nhân hóa theo tên và khóa học (`"Cảm ơn " + name + "!"`), tóm tắt 3 dòng (Họ và tên / Số điện thoại / Quan tâm — không email, không tỉnh); nút: tham gia nhóm Zalo `https://zalo.me/g/9p1ow5o696mfjvvhtfu6`, Zalo hỗ trợ `https://zalo.me/0347897868/`, "Quay lại trang chính" → `#top`, "Đăng ký thêm" → reset form. Tổng số link `zalo.me` trong file: 13 (2 URL duy nhất).
- **Hộp dự phòng `#formOk` + mailto + copy:** JS chuẩn bị sẵn `mailto:visfaracademy@gmail.com?subject=…&body={Họ tên / SĐT / Email / Tỉnh / Khóa học}` và nội dung plain-text để sao chép; `#copyBtn` dùng `navigator.clipboard.writeText` + fallback `textarea + document.execCommand("copy")`, đổi nhãn "Đã sao chép ✓" trong 2.200ms. **Quirk:** `#formOk` chỉ hiện ở nhánh fallback; người đăng ký thành công bình thường không bao giờ thấy nút mailto/copy dự phòng. `#mailtoBtn` ban đầu `href="#"`.
- **Cơ chế Apps Script** (theo báo cáo phân tích, từ `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` — chưa xác minh bản deploy thực tế có trùng file này hay không): Spreadsheet ID và route `visfar-academy` → tab `DATA VISFAR ACADEMY`, 6 cột (Thời gian | Họ và tên | Số điện thoại | Email | Tỉnh / Thành phố | Khóa học quan tâm); `doPost` dùng `LockService` (chỉ serialize, **không chống ghi trùng** — không idempotency key); server không bắt buộc `province`; không token/CAPTCHA/rate-limit.
- **Rủi ro còn lại trong gốc:** (1) nhánh fallback hiện "đã gửi" mà không có xác nhận Sheet; (2) ghi trùng khi fetch timeout sau khi server đã `appendRow`; (3) form chết hoàn toàn khi tắt JavaScript (không `action`/`method`); (4) PII trong `mailto:`/clipboard.

## 1.6. Header, footer, policy (gốc)

- **Topbar:** chỉ còn hotline `034 7897 868` + email `visfaracademy@gmail.com` (đã bỏ dòng "Visfar Academy — Việt Nam Vươn Xa"). CSS gốc có cả `.topbar{background:#000; …}` và một rule `.topbar{display:none}` — **cần kiểm tra ngữ cảnh breakpoint của rule `display:none` khi thiết kế lại**, chưa kết luận topbar có đang hiển thị ở mọi cỡ màn hình hay không. Hotline `tel:+84347897868` xuất hiện ×10, email ×8–19 lần trong file (HTML+JS).
- **Menu chính — 6 mục, không dropdown:** TRANG CHỦ → `#trang-chu`; GIỚI THIỆU → `#gioi-thieu`; CÁC KHÓA HỌC → `#chuong-trinh`; SỰ KIỆN → `#su-kien`; BLOG → `#blog`; KẾT NỐI → `#tu-van`. Nút CTA header: "Nhận lộ trình phù hợp" → `#tu-van`.
- **Footer:** `.foot-grid` 5 cột (5 cột → 2 cột ≤960px → 1 cột ≤560px): (1) brand — logo + khẩu hiệu "Hiểu mình, sáng trí, dựng hiệu."; (2) "Về Visfar Academy" — Giới thiệu, Sứ mệnh & Tầm nhìn, Triết lý giáo dục tận gốc, Lộ trình phát triển, Cộng đồng VISFAR; (3) "Khóa học" — đủ 10 khóa (Thấu Hiểu Nội Tâm … Cộng Đồng Visfar); (4) "Hỗ trợ" — 4 link chính sách + Tư vấn; (5) "Liên hệ" — Tổ chức đào tạo Visfar Academy, Điện thoại 034 7897 868, Email visfaracademy@gmail.com, Zalo hỗ trợ zalo.me/0347897868. Dưới lưới 5 cột: khối giới thiệu toàn chiều rộng ("Visfar Academy là nền tảng chia sẻ tư duy theo triết lý giáo dục tận gốc…") + dòng "Cộng đồng: Cộng đồng VISFAR"; dải newsletter "Đăng ký nhận thông tin từ Visfar Academy" (input `#footEmail` + link "Đăng ký" — **form giả, xem 1.8**); thanh cuối chỉ "Copyright 2026 © Visfar Academy." + nút về đầu trang ↑; dòng disclaimer "Thông tin chỉ dùng để liên hệ tư vấn. Không có khóa học "làm giàu nhanh", kết quả phụ thuộc vào hành động của học viên."
- **Policy — 4 "trang con" trong `#policyView`:** Chính sách bảo mật (`#page-bao-mat`, ~1.443 từ), Điều khoản tham gia (`#page-dieu-khoan`, ~1.175 từ), Chính sách hoàn trả / hủy đăng ký (`#page-hoan-tra`, ~883 từ), Giải quyết khiếu nại (`#page-khieu-nai`, ~879 từ). Ghi "Cập nhật: ngày 04 tháng 11 năm 2026". Khối liên hệ chính sách lặp nguyên văn 4 lần. Tên doanh nghiệp trong policy: "Tổ chức đào tạo Visfar Academy", SĐT 0347875229, email visfaracademy@gmail.com. **Địa chỉ trụ sở, mã số thuế, số/ngày cấp đăng ký kinh doanh chưa được cung cấp — không được bịa.**

## 1.7. Nội dung chữ từng section (gốc — tóm tắt để đối chiếu, không chép toàn văn)

- **Hero:** chapter "Visfar Academy"; tuyên ngôn 3 dòng (xem 1.2); 4 đoạn văn (đoạn 1: "Tổ chức đào tạo Visfar là tổ chức giáo dục lấy con người làm trung tâm…"; đoạn 2: "VISFAR quan niệm rằng, giáo dục chân chính không chỉ dừng lại ở việc truyền thụ kiến thức…"; đoạn 3: hài hòa trí tuệ–đạo đức, thể chất–tinh thần…; đoạn 4: mục tiêu tối thượng lan tỏa Triết lý Giáo dục Tận Gốc…).
- **Sứ mệnh & Tầm nhìn:** 2 thẻ; Sứ mệnh về lan tỏa tri thức giáo dục Tận Gốc; Tầm nhìn mở bằng dòng in đậm về hệ sinh thái giáo dục tầm vóc quốc tế.
- **Founder:** 6 đoạn văn của user (bắt đầu "Tôi là Lê Đăng Quyết, là nhà sáng lập Visfar Academy…"; niềm tin "Muốn thay đổi cuộc đời, trước hết phải thay đổi từ gốc nhận thức"; hệ thống tri thức chắt lọc từ tinh hoa minh triết phương Đông…).
- **Triết lý (6 mục):** 1. Tư tưởng cốt lõi · 2. Quan niệm giáo dục · 3. Hệ thống giáo dục — Thập Nhất Viên Mãn với 11 phương diện (01 Tâm thức, 02 Tâm thái, 03 Tâm đạo, 04 Trí tuệ, 05 Nghị lực, 06 Thể chất, 07 Tinh thần, 08 Phẩm chất, 09 Nhân cách, 10 Năng lực, 11 Vật chất) · 4. Mục tiêu giáo dục — 4 dòng LÀM GIÀU / LÀM CHỦ / TRỞ NÊN / TRỞ THÀNH (văn bản chính xác của user) · 5. Nguyên tắc giáo dục · 6. Đích đến giáo dục. Hộp "NHÂN TỐT + DUYÊN LÀNH = QUẢ NHƯ Ý" + chú thích "Nhân tốt: khái niệm có lợi, hình hướng tốt, lòng cân bằng. Duyên lành từ con người. Quả như ý: thông tin, trạng thái, kết quả vật chất cùng đổi." Tuyên ngôn triết lý 3 dòng vàng kim tĩnh (dòng 1 tách 2 dòng con "KHAI MỞ TÂM THỨC • TU DƯỠNG ĐẠO ĐỨC / PHÁT TRIỂN TRÍ TUỆ • HOÀN THIỆN CON NGƯỜI" + "KIẾN TẠO THỊNH VƯỢNG").
- **Tam giác hiện thực (SVG, 8 vòng / 24 nhãn, 28 phần tử `<text>`):** vòng lõi Năng lượng / Thông tin / Vật chất; rồi Tin / Biết / Hiểu; Nghiệp thức / Nghiệp duyên / Nghiệp quả; Nhân / Duyên / Quả; Khái niệm nguồn / Trạng thái nội tâm / Hình ảnh tâm trí; Thân / Tâm / Tuệ; Đạo lý / Tôn giáo / Khoa học; ngoài cùng Nhân sinh quan / Vũ trụ quan / Thế giới quan. Quy tắc xếp: từ đầu ở dưới-trái, từ giữa ở trên-giữa, từ cuối ở dưới-phải (vòng 3–8). Caption "TAM GIÁC HIỆN THỰC" cùng cỡ với "VISFAR HOME". Chú giải chữ dưới tam giác (`.triangle-legend`) đã bị user yêu cầu bỏ ngày 10/11/2026; chú giải dưới VISFAR HOME (`.house-legend`, 16px, hiện ≤1100px) vẫn còn.
- **VISFAR HOME:** đồ hình ngôi nhà 2D (ảnh WebP vẽ sẵn, chữ trong ảnh), 10 yếu tố xung quanh gồm Tâm đạo; Tài chính ở phần áp mái ngoài thân xanh, cùng nhóm Nội tâm, Sức khỏe, Mối quan hệ; "Cảnh giới cuộc sống" và "Giá trị - Di sản" màu xanh, cỡ chữ bằng nhau, chính giữa viền mái.
- **Lộ trình 6 bước:** Biết (Xác lập khái niệm) · Tin (Tin vào khái niệm) · Hiểu (Rõ hình trong đầu) · Thấu suốt (Đặt câu hỏi đúng) · Chuyển hóa (Mong muốn đủ lớn) · Huân tập và quảng bá.
- **Lĩnh vực 6 thẻ:** 01 Tư vấn và huấn luyện nội tâm · 02 … sức khỏe · 03 … mối quan hệ · 04 … tài chính · 05 Tổ chức trường tồn · 06 Cộng đồng tinh hoa.
- **10 khóa học (thứ tự DOM, số mới):** 01 Thấu Hiểu Nội Tâm (Trụ cột 1 | TÂM THỨC) · 02 Thấu Hiểu Tâm Thức (TÂM THỨC) · 03 Thấu Hiểu Trí Tuệ (Trụ cột 2 | TRÍ TUỆ) · 04 Thấu Hiểu Sức Khỏe (TÂM THỨC) · 05 Thấu Hiểu Mối Quan Hệ (TÂM THỨC) · 06 Thấu Hiểu Tài Chính (TÂM THỨC) · 07 Chuyên gia tư vấn và huấn luyện tâm thức (Chương trình trọng tâm | 5 ngày | Trực tuyến; học phí Tùy tâm; thẻ full-width) · 08 Master Tâm thức & Nhân hiệu (Chương trình ứng dụng | Cá nhân và thực tiễn) · 09 Coaching 90 ngày đồng hành (Chương trình chuyên sâu | 90 ngày) · 10 Cộng đồng Visfar (Học tập suốt đời | Kết nối và phát triển). Mỗi thẻ: poster, pill trụ cột, tiêu đề, dòng phụ, mô tả ngắn, nút tư vấn về `#tu-van`, nút "Xem chi tiết khóa học" mở rộng Nội dung chính + Kết quả hướng đến (đóng mặc định). 5 tab lọc với số đếm hard-code: Tất cả 10 / Tâm thức 8 / Trí tuệ 4 / Nhân hiệu 3 / Cộng đồng 1 (dòng `#courseCount` đếm động "Đang hiển thị X / 10 chương trình").
- **Doanh nghiệp 3 thẻ:** Đào tạo cho đội ngũ · Diễn giả và hội thảo · Cố vấn con người và nhân hiệu.
- **Testimonial 8 người** (đã xác nhận cho phép đăng): Trần Thị Thu Hằng (CEO FutureTech Solutions) · Lê Hoàng Nam (Founder & Coach, Mindset Mastery) · Nguyễn Minh Khoa (Giám đốc điều hành Infinity Group) · Đỗ Bảo Anh (Chuyên gia đào tạo & phát triển lãnh đạo) · Võ Đức Huy (CTO NextGen Solutions) · Phạm Thanh Trúc (CMO Elite Branding) · Lương Khánh Vy (Chuyên gia tâm lý & phát triển bản thân) · Nguyễn Hoàng Ánh (Giám đốc sáng tạo, VisionArt Studio). Mỗi người 1 trích dẫn dài (blockquote).
- **Blog 3 bài:** "Rõ hình là ra quả" · "Nhân tốt, duyên lành, quả như ý" · "Ngôi nhà Visfar — 11 phương diện trong 1 căn phòng" (mỗi bài chỉ tiêu đề + đoạn văn + meta "Đọc trong 2 phút", không link, không bài đầy đủ).
- **Sự kiện 3 thẻ:** Live: Cách viết content không cần cảm hứng — 22/05/2026 · Workshop: 5 dạng niềm tin giới hạn thu nhập — 25/05/2026 · Buổi hỏi đáp tháng 5 với Founder — 28/05/2026; cả 3 đều pill "Đã diễn ra" dù tiêu đề phần là "Lịch sự kiện sắp diễn ra". **Mâu thuẫn cần hỏi user trước khi mang sang:** MEMORY.md ghi "cả 3 sự kiện tháng 11 diễn ra ngày 25/11/2026, 18h30", nhưng file HTML chốt 10/11/2026 này vẫn ghi 22/25/28-05/2026 — báo cáo này lấy theo file HTML, không tự sửa ngày.
- **FAQ 9 câu:** bắt đầu từ đâu khi chưa từng học tâm thức · Triết lý giáo dục tận gốc là gì · Biết — Hiểu — Thấu suốt — Chuyển hóa là gì · "khái niệm nguồn"/"tam giác hiện thực" có phải thuật ngữ khoa học không · Nhân — Duyên — Quả áp dụng ra sao · chương trình có mang tính tôn giáo không · AI và Marketing có phải trọng tâm không · trực tuyến hay trực tiếp, học phí bao nhiêu · doanh nghiệp muốn đào tạo riêng thì liên hệ thế nào.
- **Đang cập nhật 4 thẻ:** Đội ngũ chuyên gia · Nghiên cứu & xuất bản · Đối tác · Đánh giá & chứng nhận (tự thừa nhận chưa có cổng đăng nhập riêng: "khu vực học viên là cộng đồng…").
- **Form section:** tiêu đề "Đăng ký tham gia", kicker "Đăng ký và kết nối", đoạn dẫn "Để lại thông tin, Visfar Academy liên hệ, cùng tìm điểm bắt đầu phù hợp: từ Biết tới Chuyển hóa, theo thứ tự Tâm thức, Trí tuệ, Nhân hiệu. Năm ô thông tin.", liên hệ hotline/email, dòng "Tổ chức đào tạo Visfar Academy" (cụm hệ sinh thái đã bỏ 11/11/2026). + đoạn "Nói thẳng: không có đường tắt thay cho huân tập từ gốc…".

## 1.8. Khuyết điểm của bản gốc — biết để KHÔNG mang sang Next.js

(Nguồn: báo cáo phân tích; đã đối chiếu lại các điểm có thể đo từ mã nguồn trong task này.)

1. Không có `<h1>` trong nội dung chính; thiếu OG/Twitter/canonical/robots/JSON-LD/sitemap; chỉ có 4 `<meta>`; policy ẩn sau JS nên bot không tới được.
2. Newsletter footer là form giả (`#footEmail` chỉ xuất hiện 2 lần, không `<form>`, không handler JS; bấm "Đăng ký" chỉ cuộn tới `#tu-van`, email đã gõ bị bỏ).
3. Nút "Xem chi tiết" sự kiện chỉ là `<a href="#tu-van">`; blog không có bài đầy đủ; tìm "giảng viên" luôn ra 0 kết quả.
4. Sự kiện 05/2026 đã qua hơn 5 tháng so với 10/11/2026 nhưng vẫn mang tiêu đề "sắp diễn ra".
5. Tên khóa cũ còn sót: "Thấu Hiểu Bản Thân" ×3, "Khai Mở Trí Tuệ" ×1, "Kiến Tạo Nhân Hiệu" ×1 (link tài nguyên "Bắt đầu tại đây" có `data-course` không khớp option trong form; 1 câu trả lời FAQ).
6. Code chết: `#floatCta`, `[data-copy]`, dead CSS `.intl-*` v.v. (xem 1.2/1.3).
7. Nội dung do builder viết, chưa được user duyệt: khung thời gian chính sách (hoàn trả 3/7/15 ngày; khiếu nại 3/15/30 ngày), các bài blog, thân bài thẻ Lĩnh vực 03, văn bản bước Lộ trình số 2 "Tin", nội dung 3 thẻ khóa học 09/10/11 (lấy từ Lĩnh vực 02/03/04). Khi chuyển sang Next.js, các nội dung này cần được đánh dấu "tạm — chờ văn bản của người sáng lập" (repo đã có cơ chế `details.noi_dung_tam` trong `CourseCard.tsx`).
8. Không có skip-link; iframe `#sheetFrame` có `title=""` rỗng; một số chữ gradient vàng trên nền ivory có tương phản thấp ở điểm sáng nhất (~1,45–1,64:1 ở `#e8c766` theo báo cáo phân tích).

---

# 2. Trang chủ Next.js hiện tại — kiểm kê

## 2.1. `src/app/page.tsx` — 47 dòng, 2 section

```tsx
// Trang chu toi thieu cho Module 1: co <h1> that (sua loi S1 o bao cao),
// gioi thieu 3 tru cot va dan toi trang khoa hoc doc that tu Supabase.
// Cac section day du (Triet ly, Lo trinh, ...) se duoc chuyen dan
// tu noi dung that o module noi dung sau — khong copy HTML 5,5 MB cu.
```

| Phần tử | Nội dung thực tế |
|---|---|
| `<div className="wrap">` | Khung duy nhất của trang |
| `<section className="hero">` | `<h1 className="gold-title">Visfar Academy</h1>` (h1 thật — điểm tốt, xem 4e) + `<p className="lead"><strong>` tuyên ngôn gộp 1 đoạn: "Khai mở tâm thức • Tu dưỡng đạo đức • Phát triển trí tuệ • Hoàn thiện con người • Kiến tạo thịnh vượng." + `<hr className="rule">` + 1 đoạn văn (đoạn 1 của hero gốc, giữ gần nguyên văn: "Tổ chức đào tạo Visfar là tổ chức giáo dục lấy con người làm trung tâm…") + 2 nút: "Xem 10 chương trình" → `/chuong-trinh`, "Đăng ký tư vấn" → `/tu-van` |
| `<section aria-labelledby="pillars-title">` | `<h2 id="pillars-title">Ba trụ cột: Tâm thức – Trí tuệ – Nhân hiệu</h2>` + 1 đoạn ("Giáo dục chân chính không chỉ dừng lại ở việc truyền thụ kiến thức…") + `<p className="muted">Nhân tốt + Duyên lành = Quả như ý. Trang này đang được xây dựng lại trên nền tảng mới (Next.js + Supabase); nội dung đầy đủ sẽ được chuyển dần từ trang hiện tại.</p>` |

**Hết.** Không còn section, component hay nội dung nào khác trên `/`. Không ảnh, không form, không danh sách khóa học, không tìm kiếm/lọc, không testimonial, không FAQ, không policy, không nút nổi.

## 2.2. `src/app/layout.tsx` — khung chung mọi trang

- `<html lang="vi">`, `<Header />` + `<main>{children}</main>` + `<Footer />`.
- Metadata: `title` = "Visfar Academy — Khai mở tâm thức • Tu dưỡng đạo đức • Phát triển trí tuệ • Hoàn thiện con người • Kiến tạo thịnh vượng" (dài, giống gốc), `description` = "Visfar Academy là nền tảng chia sẻ tư duy theo triết lý giáo dục tận gốc — phát triển Tâm thức, Trí tuệ và Nhân hiệu từ gốc nhận thức." **Không có** Open Graph / Twitter / canonical / robots / JSON-LD / favicon (`src/app/` không có file `icon.*`/`favicon.*`; `public/` chỉ có `qr-chuyen-khoan.png`).
- `next.config.ts`: `reactStrictMode: true`, `images.remotePatterns: []` (ảnh sẽ nằm ở Supabase Storage / R2 ở module sau), headers toàn trang chỉ có `X-Content-Type-Options: nosniff` và `Referrer-Policy: strict-origin-when-cross-origin` (**chưa có Content-Security-Policy**).

## 2.3. `src/styles/globals.css` — 270 dòng / 16.739 byte / 8 `@media` / 0 `!important` thật

(1 lần xuất hiện chữ "important" duy nhất là trong comment dòng 2: "Khong dung !important de chot cuoi; token la nguon that duy nhat.")

| Nhóm | Nội dung thực tế |
|---|---|
| Token (`:root`) | `--bg-ivory:#fdfbf3; --bg-champagne:#f8f1d7; --ink:#16130c; --ink-soft:#4a4232; --gold:#a8841c; --gold-dark:#6e4f0a; --gold-mid:#c9a227; --gold-light:#d4af37; --gold-bright:#e8c766; --gold-deep:#8c6d1f; --frame:1380px; --radius:12px; --shadow:0 18px 38px rgba(0,0,0,0.12); --font-body:"Be Vietnam Pro","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif` |
| Body | `margin:0; font-family:var(--font-body); font-size:1rem; line-height:1.7; color:var(--ink); background:var(--bg-ivory)` — **nền phẳng `#fdfbf3`, không gradient 90°, không lattice kim cương** |
| Chung | `p{text-align:justify; text-justify:inter-word}`; `h1,h2,h3{line-height:1.3; margin:0 0 0.5em}` (**không có quy tắc cỡ chữ riêng cho h2/h3** — dùng cỡ mặc định trình duyệt ≈24px/18,7px); `button,input,select{font:inherit}`; `button{min-height:44px}` |
| `.wrap` | `max-width:var(--frame); margin-inline:auto; padding-inline:clamp(18px,4.5vw,32px)` — **giống hệt gốc** |
| `.gold-title` | Gradient **cùng các điểm dừng với gốc**: `linear-gradient(135deg,#6e4f0a 0%,#a67c00 38%,#c9a227 62%,#d4af37 80%,#e8c766 90%,#8c6d1f 100%)`, `background-clip:text; color:transparent` (không có `text-shadow:0 1px 2px rgba(122,95,12,.18)` như gốc) |
| `.rule` | `width:64px; height:3px; background:var(--gold-mid); border:0; margin:1rem 0` |
| `.btn` | `inline-flex, min-height:48px, padding:0.7rem 1.4rem, radius:8px, border:2px solid var(--gold), background:linear-gradient(135deg,#c9a227,#d4af37), color:var(--ink), font-weight:700`; `.btn-ghost{background:transparent; color:var(--gold-dark)}`; `.btn:disabled{opacity:0.6}`. **Không có `.btn:hover`** (không hover lift/shadow) |
| `.card` | `background:#fff; border:1px solid rgba(168,132,28,0.55); radius:12px; padding:1.25rem; box-shadow:0 6px 18px rgba(0,0,0,0.08); transition:transform 220ms, box-shadow 220ms, border-color 220ms`; `@media (hover:hover){.card:hover{transform:translateY(-3px); border-color:rgba(212,175,55,0.6); box-shadow:var(--shadow)}}` — hover lift giống chuẩn gốc, nhưng chỉ áp cho `.card` |
| `.site-header` | `background:var(--bg-ivory); border-bottom:1px solid rgba(168,132,28,0.35); position:sticky; top:0; z-index:10`; `.wrap` flex, `min-height:68px`; `.brand` text 1.25rem weight 900; `.main-nav a` padding 0.6rem 0.8rem, weight 600, min-height 44px, hover chỉ đổi màu. **Không có topbar, không có trạng thái scrolled/shadow, không có menu mobile.** Sửa tràn ngang mobile bằng `@media (max-width:900px)` cho wrap (nav xuống hàng riêng, CTA full-width) |
| `.hero` | `text-align:center; padding:3rem 0 2rem`; `.hero h1{font-size:clamp(1.75rem,4vw,2.8rem)}` (= 28–44,8px); `.hero .lead{max-width:760px; margin:0 auto}` |
| Khóa học (dùng ở `/chuong-trinh`, không có trên trang chủ) | `.course-grid` 3 cột → 2 cột ≤1020px → 1 cột ≤700px (giống gốc); `.course-num` (gold, weight 900); `.pill` (0.875rem, viền gold, radius 999px); `.tabs`/`.tab` (min-height 44px, pill; `[aria-pressed="true"]` nền gradient vàng); `.search` (100%, min-height 50px, radius 8px) |
| Form | `.field` (label weight 700; input/select/textarea 100%, min-height 50px, padding 0.7rem 0.9rem, viền `rgba(168,132,28,0.6)`, radius 8px, focus `outline:2px solid var(--gold)`); `.field-error` (#b3261e); `.hint`/`.form-note` (0.95rem, `--ink-soft`); `.consult-form{max-width:640px; margin-top:1.5rem}`; `.honeypot{position:absolute; left:-9999px; …}`; `.notice`/`.notice.error`/`.notice.success` |
| Footer | `.site-footer{border-top:1px solid rgba(168,132,28,0.35); margin-top:3rem; padding:2rem 0; background:var(--bg-champagne)}` — nền `#f8f1d7` **khớp màu gốc**, nhưng thiếu lattice, thiếu `border-top:1px solid #c6a45c`, thiếu `::before` dải gradient vàng, padding 2rem thay vì 60px top |
| Khác | `.muted`, `.sr-only`, dashboard/admin/lesson/quiz/assignment (Task 06–08, không liên quan trang chủ). **Không có:** `@font-face`, `.cream`, `.hero-manifesto`, `.manifesto-line*`, `.chapter`, `.reveal`, `.journey-nav`, `.foot-grid`, `.tri-ring`, `.prog-grid`, `.form-section`, `.policy*`, `.topbar`, `.progress*` (trừ `.progress-track/.progress-fill` của dashboard), `.float-zalo`, `.float-top`, `prefers-reduced-motion`, `hover:none` |

## 2.4. Header / Footer Next.js (khung chung, xuất hiện cả trên trang chủ)

**`src/components/layout/Header.tsx` — 25 dòng:**

- Brand là **chữ** `VISFAR <span>ACADEMY</span>` (`.brand`, không có ảnh logo).
- Nav 5 link: Trang chủ → `/` · Các khóa học → `/chuong-trinh` · **Giới thiệu → `/chuong-trinh` (SAI đích — phải tới phần giới thiệu/founder)** · Tư vấn → `/tu-van` · **Kết nối → `/chuong-trinh` (SAI đích — gốc là `#tu-van`)**. Không có link Sự kiện / Blog (gốc có), không có topbar, không có nút menu mobile, không có active-section theo cuộn, không có thanh tiến trình đọc.
- `<AccountNav />` (Đăng nhập / Đăng ký khi chưa đăng nhập; "Xin chào, {tên}" + Dashboard + Đăng xuất khi đã đăng nhập — điểm mới, gốc không có) + nút `.btn` "Nhận lộ trình phù hợp" → `/tu-van` (giữ đúng nhãn và đích gốc).

**`src/components/layout/Footer.tsx` — 30 dòng:**

- `<NewsletterForm />` (thật — xem 2.5), rồi 4 đoạn văn: "Visfar Academy — Tổ chức đào tạo Visfar Academy"; Điện thoại `034 7897 868` · Email `visfaracademy@gmail.com` · Zalo `zalo.me/0347897868`; tuyên ngôn 1 dòng; "Copyright 2026 © Visfar Academy."; disclaimer "Thông tin chỉ dùng để liên hệ tư vấn. Không có khóa học "làm giàu nhanh", kết quả phụ thuộc vào hành động của học viên."
- **Thiếu so với footer gốc:** lưới 5 cột (chỉ còn 1 cột văn bản), khối giới thiệu toàn chiều rộng + dòng "Cộng đồng: Cộng đồng VISFAR", 5 link "Về Visfar Academy", 10 link khóa học, 4 link chính sách, link "Tư vấn", nút về đầu trang ↑, logo footer. Liên hệ (SĐT/email/Zalo/copyright/disclaimer) thì khớp.

## 2.5. Những gì đã có trong repo nhưng KHÔNG nằm trên trang chủ `/`

| Hạng mục | Vị trí | Trạng thái so với gốc |
|---|---|---|
| Form tư vấn đầy đủ | `src/components/ConsultationForm.tsx` (323 dòng, `'use client'`), dùng ở `src/app/tu-van/page.tsx` | 5 field giống gốc (họ tên, SĐT, email, tỉnh 34 — lấy từ `PROVINCES` trong `@visfar/shared`, khóa học load từ Supabase + 2 lựa chọn Doanh nghiệp/Chưa biết). Khác gốc: xem 4d/4e |
| Trang khóa học | `src/app/chuong-trinh/page.tsx` (`'use client'`) + `src/components/course/CourseCard.tsx` (29 dòng) + `src/app/chuong-trinh/[slug]/` | Đọc thật từ Supabase (`fetchPublishedCourses`, `filterCourses`), có ô tìm kiếm + tab lọc theo trụ cột + đếm "Đang hiển thị X / Y chương trình" + trạng thái loading/error/empty/not-configured. Khác gốc: xem 4d |
| Newsletter thật | `src/components/NewsletterForm.tsx` (75 dòng), dùng trong Footer | POST `/api/v1/newsletter`, chỉ hiện thành công khi API trả `ok:true`, có nút "Thử lại" |
| Auth / học viên / LMS | `src/app/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/hoc-vien`, `/goi-thanh-vien`, `/chung-chi`, `/thanh-toan`, `/admin/*`, `src/lib/auth.ts`, `courses.ts`, `learning.ts`, `payments.ts`, `quiz.ts`, `certificates.ts`… | Mới hoàn toàn, gốc không có (gốc tự thừa nhận chưa có cổng đăng nhập) |
| Worker API (leads) | `src/lib/api-client.ts` (`getApiBaseUrl()` → `https://api.visfaracademy.workers.dev/api/v1`, alias Netlify cũ giữ lại), `src/lib/leads.ts`, `src/lib/validation.ts` | POST `/api/v1/leads` + `Idempotency-Key` + honeypot; fallback Apps Script cũ chỉ khi API lỗi mạng/5xx/timeout và chỉ thành công khi đọc được JSON `{ok:true}` (xem 4e) |
| Tài sản tĩnh | `apps/web/public/` chỉ có `qr-chuyen-khoan.png` | **Không có bất kỳ ảnh trang chủ nào** (logo, hero, founder, poster, chân dung, sự kiện, VISFAR HOME). `next.config.ts` ghi ảnh sẽ nằm ở Supabase Storage / R2 ở module sau, `remotePatterns: []` |
| Font | Không có `@font-face`, không dùng `next/font`, không có file font trong repo | `globals.css` chỉ khai báo tên `"Be Vietnam Pro"` trong font stack — trình duyệt sẽ rơi về `Segoe UI`/Roboto/Arial nếu máy không có sẵn font này |

## 2.6. Route KHÔNG tồn tại trong repo (gốc có nội dung tương ứng)

`ls src/app/` cho thấy chỉ có: `admin`, `api`, `auth`, `chung-chi`, `chuong-trinh`, `dang-ky`, `dang-nhap`, `dat-lai-mat-khau`, `goi-thanh-vien`, `hoc-vien`, `layout.tsx`, `page.tsx`, `quen-mat-khau`, `thanh-toan`, `tu-van`. **Không có** `/chinh-sach/*` (4 chính sách), `/blog/*`, `/su-kien/*`, `/faq`, `/gioi-thieu`, `/triet-ly`, `/lo-trinh`, `/linh-vuc`, `/doanh-nghiep`, `/chia-se`. Grep `chinh-sach|policy` trong `src/app` (`.tsx`) trả về 0 file. Header/footer cũng không link tới các route này (footer Next không có link policy nào).

---

# 3. Bảng so sánh theo section

"Có trên `/`" nghĩa là có trong `page.tsx` (trang chủ). "Có ở route khác" không tính là có trên trang chủ.

| Section gốc (`id`) | Bản gốc | Trang chủ Next.js (`/`) | Mức độ |
|---|---|---|---|
| Header + topbar | Topbar hotline+email; logo ảnh PNG; menu 6 mục đúng đích; CTA "Nhận lộ trình phù hợp"; `#menuBtn` mobile; active-section; `#progressBar` | Brand chữ; nav 5 link, 2 link sai đích (Giới thiệu, Kết nối → `/chuong-trinh`); không topbar/menu mobile/active/progress; có thêm AccountNav + CTA đúng | ⚠️ Sai một phần + thiếu |
| 1. Hero `#trang-chu` | Ảnh tập thể 1334×889; chapter "Visfar Academy"; tuyên ngôn h2 3 dòng gradient (13,65px @390); 4 đoạn văn | h1 "Visfar Academy" (tốt — mới); tuyên ngôn gộp 1 `<p><strong>` 16px, không gradient, không tách dòng; chỉ 1/4 đoạn văn; 2 nút đúng đích; không ảnh, không chapter | ⚠️ Chỉ còn khung sườn |
| 2. Sứ mệnh & Tầm nhìn `#su-menh-tam-nhin` | 2 thẻ Sứ mệnh/Tầm nhìn, khung trắng viền vàng đôi, tiêu đề thẻ 32px | Không có | ❌ Thiếu hoàn toàn |
| 3. Giới thiệu `#gioi-thieu` | 6 đoạn văn founder + ảnh chân dung | Không có (nav "Giới thiệu" còn trỏ sai sang `/chuong-trinh`) | ❌ Thiếu hoàn toàn |
| 4. Triết lý `#triet-ly` | 6 mục; 11 phương diện; hộp Nhân–Duyên–Quả; VISFAR HOME; Tam giác SVG 8 vòng tương tác; Tuyên ngôn triết lý | Không có | ❌ Thiếu hoàn toàn |
| 5. Lộ trình `#lo-trinh` (lồng trong `#triet-ly`) | 6 thẻ 1 hàng 6 cột + Mục tiêu 4 dòng + Nguyên tắc + Đích đến | Không có | ❌ Thiếu hoàn toàn |
| 6. Lĩnh vực `#linh-vuc` | 6 thẻ lĩnh vực | Không có | ❌ Thiếu hoàn toàn |
| 7. Chương trình `#chuong-trinh` | 10 thẻ + poster + tìm kiếm + 5 tab lọc + toggle chi tiết + pre-select | Không có trên `/`; **có ở `/chuong-trinh`** nhưng khác: không poster, không toggle chi tiết, lọc theo 4 trụ cột (không có tab "Cộng đồng" tách riêng như tab thứ 5 — xem D03), dữ liệu từ Supabase, thẻ link sang trang chi tiết riêng | ⚠️ Có ở route khác, khác nội dung/hình thức |
| 8. Doanh nghiệp `#doanh-nghiep` | 3 thẻ + ảnh DSC03023 | Không có | ❌ Thiếu hoàn toàn |
| 9. Chia sẻ `#chia-se` | 8 testimonial + 8 ảnh chân dung | Không có | ❌ Thiếu hoàn toàn |
| 10. Blog + Sự kiện `#blog` / `#su-kien` | 3 bài blog + 3 thẻ sự kiện + 1 thẻ cập nhật | Không có (không có route `/blog`, `/su-kien`) | ❌ Thiếu hoàn toàn |
| 11. FAQ `#faq` | 9 `<details>` | Không có (không có route `/faq`) | ❌ Thiếu hoàn toàn |
| 12. Đang cập nhật `#dang-cap-nhat` | 4 thẻ placeholder | Không có | ❌ Thiếu hoàn toàn |
| 13. Tư vấn `#tu-van` | Form 5 field + thank-you + Zalo group/hỗ trợ | Không có trên `/`; **có ở `/tu-van`** với form tốt hơn (xem 4e) nhưng thiếu nút Zalo nhóm/hỗ trợ ở màn hình cảm ơn | ⚠️ Có ở route khác |
| Policy `#policyView` | 4 bài chính sách qua hash (~4.380 từ) | Không có (không có route `/chinh-sach/*`, footer không link) | ❌ Thiếu hoàn toàn |
| Footer | 5 cột + intro toàn chiều rộng + newsletter + Copyright | Newsletter thật (tốt hơn) + liên hệ + Copyright + disclaimer; thiếu toàn bộ lưới 5 cột/link | ⚠️ Chỉ còn lõi liên hệ |
| `.journey-nav` "Hành trình" | 13 link anchor | Không có | ❌ Thiếu hoàn toàn |
| Nút nổi | Zalo nổi + về đầu trang (hiện khi scroll >240, ẩn khi form trong viewport/khi mở policy) | Không có | ❌ Thiếu hoàn toàn |

**Điểm đã khớp (không tính vào điểm khác):** `.wrap` 1380px + đệm `clamp(18px,4.5vw,32px)`; gradient vàng 135° cùng điểm dừng (chỉ dùng ở `.gold-title`); `text-align:justify` cho thân bài; thân bài ≥16px; nút chạm ≥44px (48px `.btn`, 44px `.tab`/nav); lưới khóa học 3→2→1 cột ở 1020/700px (ở `/chuong-trinh`); thông tin liên hệ footer (SĐT 034 7897 868, email visfaracademy@gmail.com, Zalo hỗ trợ, Copyright 2026 © Visfar Academy, disclaimer "làm giàu nhanh"); tiêu đề/meta description trang.

---

# 4. Danh sách TẤT CẢ điểm khác

Quy ước: mã `A/B/C/D-xx` để tiện đối chiếu khi sửa. **Tổng (a)–(d) = 76 điểm.** Mục (e) là điểm NÊN GIỮ, không tính vào điểm khác.

## 4a. Thiếu section / nội dung — 26 điểm

| Mã | Điểm khác | Gốc (file/vị trí) | Next.js hiện tại |
|---|---|---|---|
| A01 | Thiếu ảnh tập thể hero 1334×889 + viền vàng + bóng | `img#1`, section `#trang-chu` | Không ảnh nào trên `/` |
| A02 | Thiếu 3/4 đoạn văn hero (đoạn 2, 3, 4: quan niệm giáo dục chân chính; hài hòa trí tuệ–đạo đức; mục tiêu tối thượng) | `#trang-chu` | Chỉ giữ đoạn 1 (trong `page.tsx` dòng 19–24) |
| A03 | Thiếu chapter "Visfar Academy" + cấu trúc tuyên ngôn h2 3 dòng (line1a/line1b/line2) | `.hero-manifesto h2`, `.manifesto-line1a/1b/2` | Tuyên ngôn gộp 1 `<p><strong>` trong `page.tsx` dòng 12–17 |
| A04 | Thiếu toàn bộ section Sứ mệnh & Tầm nhìn (2 thẻ) | `#su-menh-tam-nhin` | Không có |
| A05 | Thiếu toàn bộ section Giới thiệu founder (6 đoạn văn + ảnh chân dung + dòng vai trò) | `#gioi-thieu` | Không có |
| A06 | Thiếu Triết lý mục 1–2: Tư tưởng cốt lõi, Quan niệm giáo dục | `#triet-ly` h3 1–2 | Không có |
| A07 | Thiếu Triết lý mục 3: Hệ thống giáo dục — Thập Nhất Viên Mãn (11 phương diện 01–11) | `#triet-ly`, `#bay-phuong-dien` | Không có |
| A08 | Thiếu hộp "NHÂN TỐT + DUYÊN LÀNH = QUẢ NHƯ Ý" + chú thích | `#triet-ly` | Chỉ còn 1 dòng "Nhân tốt + Duyên lành = Quả như ý." trong `page.tsx` dòng 40 (dạng text thường, không phải hộp) |
| A09 | Thiếu đồ hình VISFAR HOME (ảnh WebP 1696×1472) + `.house-legend` | `#triet-ly` | Không có |
| A10 | Thiếu Tam giác hiện thực SVG (8 vòng / 24 nhãn / 28 `<text>`) + caption | `#triet-ly` | Không có |
| A11 | Thiếu Tuyên ngôn triết lý (3 dòng vàng kim tĩnh) | `.phil-decl` trong `#triet-ly` | Không có |
| A12 | Thiếu Lộ trình 6 bước (6 thẻ) | `#lo-trinh` | Không có |
| A13 | Thiếu Mục tiêu giáo dục (4 dòng LÀM GIÀU/LÀM CHỦ/TRỞ NÊN/TRỞ THÀNH — văn bản chính xác của user) + Nguyên tắc + Đích đến giáo dục | Trong `#lo-trinh` (DOM) | Không có |
| A14 | Thiếu 6 thẻ Lĩnh vực ứng dụng | `#linh-vuc` | Không có |
| A15 | Thiếu 10 thẻ khóa học trên trang chủ (poster, pill, mô tả, toggle chi tiết, thẻ 07 full-width) | `#chuong-trinh`, `.prog-grid` | Chỉ có ở `/chuong-trinh` dạng `CourseCard` không poster, không toggle (xem D04) |
| A16 | Thiếu 3 thẻ Giải pháp doanh nghiệp + ảnh DSC03023 | `#doanh-nghiep` | Không có |
| A17 | Thiếu 8 testimonial + 8 ảnh chân dung (nội dung đã được user xác nhận cho phép đăng) | `#chia-se` | Không có |
| A18 | Thiếu 3 bài blog ngắn | `#blog` | Không có |
| A19 | Thiếu 3 thẻ sự kiện (22/05, 25/05, 28/05/2026) + thẻ "Lịch sự kiện đang được cập nhật" | `#su-kien` (div trong `#blog`) | Không có |
| A20 | Thiếu 9 câu FAQ | `#faq`, 9 `<details>` | Không có |
| A21 | Thiếu 4 thẻ "Đang cập nhật" | `#dang-cap-nhat` | Không có |
| A22 | Thiếu section form tư vấn trên trang chủ | `#tu-van` | Form chỉ có ở route `/tu-van` (xem 2.5) |
| A23 | Thiếu 4 bài chính sách (~4.380 từ) | `#policyView` (`#page-bao-mat/dieu-khoan/hoan-tra/khieu-nai`) | Không có route/thành phần nào |
| A24 | Thiếu footer 5 cột: link Về Visfar (5), Khóa học (10), Hỗ trợ (4 policy + Tư vấn), Liên hệ đầy đủ, logo footer, khối giới thiệu toàn chiều rộng + "Cộng đồng: Cộng đồng VISFAR" | `<footer>`, `.foot-grid` | `Footer.tsx` chỉ còn 4 đoạn văn + newsletter |
| A25 | Thiếu `.journey-nav` "Hành trình" (13 link anchor) | Sau header | Không có |
| A26 | Thiếu topbar (hotline + email) | `.topbar` | `Header.tsx` không có topbar (lưu ý: gốc có rule `.topbar{display:none}` — cần kiểm tra ngữ cảnh breakpoint, xem 1.6) |

## 4b. Sai màu / font / kích thước / khoảng cách — 17 điểm

| Mã | Điểm khác | Gốc | Next.js hiện tại |
|---|---|---|---|
| B01 | Nền trang: phẳng vs gradient + lattice | `body` gradient 90° #fdfbf3→#fcf9ed→#f8f1d7→#fcf9ed→#fdfbf3 + lattice kim cương ±45° `rgba(198,164,92,.05)` chu kỳ 28px, nền `#fbf7e9` | `globals.css`: `background:var(--bg-ivory)` phẳng `#fdfbf3`, không gradient, không lattice |
| B02 | Font Be Vietnam Pro tự host vs chỉ khai tên | 12 `@font-face` base64 (~643 KB), `font-display:swap` | Không `@font-face`, không `next/font`, không file font — trình duyệt rơi về Segoe UI/Roboto/Arial |
| B03 | Token vàng lệch + thiếu token gradient | `--gold:#c6a45c; --grad:linear-gradient(105deg,#f4dd8f 0%,#d4af37 42%,#a8841c 78%,#e8c766 100%)` | `--gold:#a8841c` (đậm hơn gốc 1 bậc); không có `--grad` (gradient 135° chỉ viết cứng trong `.gold-title`); `--cream:#f7f5ef` gốc không có trong token Next (chỉ có `--bg-champagne:#f8f1d7`) |
| B04 | Thiếu class `.cream` (nhịp nền xen kẽ các section) | `.cream{background:#f7f5ef / #fdfcf8; padding:54–78px 0}` cho `#gioi-thieu`, `#chuong-trinh`, `#doanh-nghiep`, `#blog`, `#tu-van` | Không có `.cream`; các section không có quy tắc padding dọc riêng |
| B05 | Tiêu đề section: không còn cỡ/gradient/kicker | Từng tiêu đề có clamp riêng (21–46px, xem 1.2) + gradient 135° + `.chapter` kicker (chữ hoa, `letter-spacing:.34em`, gạch vàng 2 bên) | `h2/h3` không có quy tắc cỡ chữ (mặc định trình duyệt); chỉ `h1` hero có `clamp(1.75rem,4vw,2.8rem)`; không có `.chapter` |
| B06 | Tuyên ngôn: mất cấu trúc 3 dòng + gradient từng dòng | line1a/1b `nowrap`, 13,65px @390 → 19px desktop; line2 24–32px; gradient từng dòng | 1 `<p><strong>` 16px, không gradient, không tách dòng, không `nowrap` |
| B07 | Hover: chỉ còn trên `.card`, mất hover chuẩn ở nút/nav/tab | Hover chuẩn toàn trang 220ms (xem 1.2); `.btn-gold:hover` lift −2px + bóng vàng; nav hover đổi màu + gạch chân vàng | `.card:hover` giữ đúng chuẩn; `.btn` **không có `:hover`**; `.tab` không có hover; `.main-nav a:hover` chỉ đổi màu |
| B08 | Header: mất trạng thái khi cuộn + topbar | JS thêm class khi scroll >10 (theo báo cáo phân tích); `nav.main` mobile nền `#fdfbf3` | `.site-header` sticky, không trạng thái scrolled/shadow; không topbar |
| B09 | Footer: mất lattice + viền vàng + dải gradient + padding | `background:#f8f1d7` + lattice; `border-top:1px solid #c6a45c`; `::before` dải gradient vàng; `padding-top:60px` | `background:var(--bg-champagne)` (màu khớp) nhưng không lattice, viền `rgba(168,132,28,0.35)`, không `::before`, `padding:2rem 0` |
| B10 | Breakpoint: 134 khối `@media` vs 8 | 134 `@media` (640×25, 880×19, 700×13, 920×12, 600×10, 1100×7, 560×7, 1020×4); không có 768px riêng | 8 `@media` (900, 1020, 700px…) — chưa đủ để tái hiện hành vi responsive từng section của gốc |
| B11 | Thiếu `prefers-reduced-motion` / `hover:none` | 15× `prefers-reduced-motion:reduce`, 6× `hover:none` (tắt reveal/hover trên touch/giảm chuyển động) | Chỉ có `@media (hover:hover)` cho `.card`; không có quy tắc reduced-motion nào |
| B12 | Thẻ: mất viền vàng đôi + bóng gốc | Thẻ Sứ mệnh/Tầm nhìn "khung trắng viền vàng đôi"; thẻ sự kiện "viền vàng đôi mảnh"; bóng hover `rgba(0,0,0,.38)` | `.card` 1 viền `rgba(168,132,28,0.55)`, bóng `0 6px 18px rgba(0,0,0,0.08)` |
| B13 | Token bóng lệch | `--shadow:0 24px 60px rgba(0,0,0,.45)` | `--shadow:0 18px 38px rgba(0,0,0,0.12)` (nhạt hơn nhiều) |
| B14 | h2/h3 không có cỡ chữ thiết kế | Mọi tiêu đề section đều có clamp riêng (xem 1.2) | Không quy tắc nào cho `h2/h3` ngoài `line-height:1.3` |
| B15 | Section không có padding dọc | `.cream` 54–78px; section thường có padding riêng theo thiết kế | Không quy tắc padding cho `section` (trừ `.hero{padding:3rem 0 2rem}`) |
| B16 | Nav/footer: mất chữ hoa + letter-spacing | Menu gốc dùng nhãn HOA ("TRANG CHỦ", "GIỚI THIỆU"…); `.chapter` `letter-spacing:.34em` | Nav Next dùng title case ("Trang chủ", "Các khóa học"…), không rule uppercase/letter-spacing |
| B17 | Gradient text thiếu text-shadow | `.manifesto-line*`/`.phil-decl` có `text-shadow:0 1px 2px rgba(122,95,12,.18)` | `.gold-title` không có text-shadow |

## 4c. Thiếu ảnh / hiệu ứng — 16 điểm

| Mã | Điểm khác | Gốc | Next.js hiện tại |
|---|---|---|---|
| C01 | Logo ảnh (PNG trong suốt, 225 KB base64, dùng 2 lần header+footer) | `img#0` + `img#26` | Brand chữ `VISFAR ACADEMY`, không có file logo |
| C02 | Ảnh tập thể hero 1334×889 (335 KB) | `img#1`, `fetchpriority="high"`, viền `#c6a45c` | Không có |
| C03 | Ảnh chân dung founder (175 KB) | `img#2` | Không có |
| C04 | Đồ hình VISFAR HOME WebP 1696×1472 (485 KB) | `img#3` | Không có |
| C05 | 10 poster khóa học 1600×900 (107–130 KB mỗi cái) | `img#4–13`, `alt=""` | Không có (`CourseCard` không có ảnh) |
| C06 | Ảnh doanh nghiệp DSC03023 1334×889 (246 KB) | `img#14` | Không có |
| C07 | 8 ảnh chân dung học viên (41–182 KB) | `img#15–22`, hiển thị 84×84 | Không có |
| C08 | 3 ảnh sự kiện 1200×750 (137–168 KB) | `img#23–25` | Không có |
| C09 | Favicon (data URI, file vuông đỏ) | `<link rel="icon">` data URI | Không có file `icon.*`/`favicon.*`, không metadata icons |
| C10 | Reveal khi cuộn + stagger 320ms + fallback 2000ms | `IntersectionObserver` threshold 0.08, class `.reveal`/`.in` | Không có (không class `.reveal`, không Observer) |
| C11 | Hover lift chỉ còn trên `.card` | Hover chuẩn áp cho thẻ/nút/nav toàn trang (xem B07) | Xem B07 |
| C12 | Thanh tiến trình đọc `#progressBar` | Có, theo scroll + resize | Không có |
| C13 | Nút nổi Zalo + về đầu trang | `#floatZalo`, `#floatTop`, hiện khi scroll >240 và form không trong viewport và không mở policy | Không có (Zalo chỉ còn 1 link text trong footer) |
| C14 | Tam giác tương tác (hover/focus/click 1 vòng → vòng đó nổi, 7 vòng còn lại mờ; Escape/click ngoài khôi phục) | 8 `.tri-ring`, `appendChild` đưa vòng lên trên | Không có (không có SVG nào) |
| C15 | Nhịp nền xen kẽ `.cream` giữa các section | 5 section `.cream` | Không có (xem B04) |
| C16 | Nền lattice + gradient toàn trang | Xem B01 | Không có (xem B01) |

## 4d. Thiếu / sai tính năng — 17 điểm

| Mã | Điểm khác | Gốc | Next.js hiện tại |
|---|---|---|---|
| D01 | Menu mobile (nút `#menuBtn`, toggle `.open`, `aria-expanded`, bấm link thì đóng) | Có | Không có nút menu; mobile chỉ wrap nav xuống hàng (`@media max-width:900px`) — khác hành vi |
| D02 | Active menu theo section khi cuộn | `IntersectionObserver` rootMargin `-40%/-55%` | Không có |
| D03 | Tìm kiếm + 5 tab lọc khóa học trên trang chủ | Ô search (placeholder "Tìm khóa học, giảng viên…", `norm()` bỏ dấu, tìm trong toàn bộ `textContent`) + 5 tab (Tất cả 10 / Tâm thức 8 / Trí tuệ 4 / Nhân hiệu 3 / Cộng đồng 1, số đếm hard-code) + `#courseCount` đếm động + `#noResult` | Không có trên `/`. Ở `/chuong-trinh`: có search + tab theo 4 trụ cột (`PILLARS`: Tâm thức/Trí tuệ/Nhân hiệu/Cộng đồng) + đếm động, dữ liệu Supabase — **không có tab "Cộng đồng" tách riêng với số đếm như tab thứ 5 của gốc, và chưa xác minh có `norm()` bỏ dấu hay không** (cần kiểm tra `filterCourses` trong `src/lib/courses.ts` khi thiết kế lại) |
| D04 | Toggle "Xem chi tiết khóa học" mở rộng từng thẻ | 10× `.prog-toggle`, `details-open`, đổi nhãn/aria | Không có; `CourseCard` chỉ có link "Xem chi tiết khóa học" sang trang `/chuong-trinh/[slug]` riêng |
| D05 | Pre-select khóa học từ CTA (`[data-course]` ×15) | Có (trừ 1 link cũ "Thấu Hiểu Bản Thân (miễn phí)" không khớp — lỗi gốc) | Không có; `ConsultationForm` không đọc query param/searchParams để pre-select |
| D06 | Form tư vấn trên trang chủ | `#consultForm` trong `#tu-van` | Chỉ có ở route `/tu-van` |
| D07 | Validation form | Client: tên chỉ khác rỗng; SĐT `/^0\d{9}$/`; email TLD ≥1; tỉnh không whitelist. Server: email TLD ≥2, `course` bắt buộc, `province` không bắt buộc | **Tốt hơn gốc** (xem E03) — ghi ở đây để đối chiếu: `validateLeadInput` dùng chung `validation.ts` cả 2 phía |
| D08 | Submit form | Fetch CORS tới Apps Script + fallback iframe hiện "thành công giả" | **Tốt hơn gốc** (xem E02) — POST Worker API + fallback JSON-only |
| D09 | Màn hình cảm ơn có nút Zalo nhóm + Zalo hỗ trợ | `showThankYou()`: nút tham gia nhóm Zalo `zalo.me/g/9p1ow5o696mfjvvhtfu6` + Zalo hỗ trợ `zalo.me/0347897868/` + "Quay lại trang chính" + "Đăng ký thêm" | `ConsultationForm` success chỉ có mã tham chiếu + email/phone liên hệ + nút "Đăng ký thêm một yêu cầu khác" — **không có nút Zalo nào** |
| D10 | Policy 4 trang con qua hash | `renderPolicy()` + `hashchange`, `body.policy-open` | Không có route `/chinh-sach/*`, không có hash view, footer không link |
| D11 | Newsletter footer | Form giả (không gửi đi đâu) | **Tốt hơn gốc** (xem E04) — POST `/api/v1/newsletter` thật |
| D12 | Trang chi tiết sự kiện / bài blog đầy đủ | Không có thật (sự kiện link về `#tu-van`, blog không link) — **gốc cũng giả** | Không có route `/su-kien/*`, `/blog/*` — ngang gốc (cả hai đều chưa có), nhưng khi thiết kế lại cần quyết định: làm thật hoặc gỡ khỏi menu (theo sitemap mới trong báo cáo phân tích) |
| D13 | FAQ `<details>` tương tác | 9 `<details>/<summary>` | Không có |
| D14 | Nút nổi + header scrolled | Xem C13, B08 | Không có |
| D15 | Skip-link ("bỏ qua tới nội dung") | Không có (gốc cũng thiếu) | Không có — ngang gốc, nên bổ sung khi làm lại (điểm tốt, không tính là thụt lùi) |
| D16 | Form hoạt động khi tắt JavaScript | Chết hoàn toàn (không `action`/`method`, `novalidate`) | Form React client component cũng cần JS; `noValidate` vẫn giữ — ngang gốc, chưa cải thiện |
| D17 | SEO kỹ thuật | Không h1 chính; không OG/Twitter/canonical/robots/JSON-LD; title + description có | **Tốt hơn một phần** (xem E01): có h1 thật + title/description; vẫn **không có** OG/Twitter/canonical/robots/JSON-LD/CSP |

## 4e. Điểm Next.js đang tốt hơn bản gốc — NÊN GIỮ (12 điểm)

| Mã | Điểm tốt hơn | Vị trí trong repo | Ghi chú khi thiết kế lại |
|---|---|---|---|
| E01 | `<h1>` thật "Visfar Academy" (sửa lỗi S1 của báo cáo phân tích) | `src/app/page.tsx` dòng 11 | **Giữ.** Gốc không có h1 chính (4 h1 chỉ nằm trong policy ẩn). Khi làm lại hero y hệt gốc, phải giữ 1 h1 thật (có thể là chính tuyên ngôn hoặc tên học viện) — không được quay lại dùng h2 cho tiêu đề chính |
| E02 | Form gọi Worker API thay vì Apps Script trực tiếp + iframe: POST `/api/v1/leads` (Worker `https://api.visfaracademy.workers.dev/api/v1`), `Idempotency-Key` (dùng lại khi retry), honeypot, chỉ hiện cảm ơn khi nhận `ok:true` + `referenceCode`; fallback Apps Script chỉ khi API lỗi mạng/5xx/timeout và chỉ thành công khi đọc được JSON `{ok:true}` | `src/lib/api-client.ts`, `src/lib/leads.ts`, `src/components/ConsultationForm.tsx` | **Giữ nguyên luồng.** Sửa lỗi S2 (thank-you giả) và chống ghi trùng của gốc. Lưu ý đính chính: gốc dùng fetch CORS mặc định chứ không phải `no-cors` (theo báo cáo phân tích A.5) — điểm tốt hơn thực sự là Worker + idempotency + mã tham chiếu, không phải "bỏ no-cors" |
| E03 | Validation thống nhất client/server | `src/lib/validation.ts` + `validateLeadInput` (`leads.ts`): tên 2–100 ký tự, SĐT 10 số bắt đầu bằng 0, email TLD ≥2, tỉnh phải nằm trong whitelist 34 tỉnh | **Giữ.** Sửa lỗi lệch client/server của gốc (email TLD ≥1 vs ≥2; tỉnh không kiểm tra; tên không giới hạn độ dài) |
| E04 | Newsletter thật | `src/components/NewsletterForm.tsx` → POST `/api/v1/newsletter`, chỉ hiện thành công khi `ok:true`, có "Thử lại" | **Giữ.** Sửa lỗi H5 (newsletter giả) của gốc |
| E05 | Đăng nhập / đăng ký / khu vực học viên | `src/app/dang-nhap`, `/dang-ky`, `/hoc-vien`, `src/components/AccountNav.tsx`, `src/lib/auth.ts` | **Giữ.** Gốc tự thừa nhận chưa có cổng đăng nhập riêng |
| E06 | Khóa học đọc thật từ Supabase + trang chi tiết riêng + hạ tầng LMS (module/bài học, tiến độ, quiz, thanh toán, chứng chỉ, admin) | `src/app/chuong-trinh/`, `src/lib/courses.ts`, `src/components/course/*`, `src/app/api/*` | **Giữ kiến trúc.** Khi đưa 10 khóa học lên trang chủ, dữ liệu lấy từ Supabase (kèm cờ `details.noi_dung_tam` cho nội dung tạm), không hard-code lại số đếm tab như gốc; poster lấy từ Storage/R2 (xem mục 5) |
| E07 | Không còn PII trong mailto/clipboard | `ConsultationForm.tsx` (comment đầu file, theo QĐ 13): đã bỏ hộp `#formOk` chứa họ tên/SĐT/email | **Giữ.** Sửa lỗi S5 của gốc |
| E08 | CSS không `!important`, token là nguồn duy nhất | `src/styles/globals.css` dòng 2 + toàn file: 0 `!important` thật | **Giữ nguyên tắc.** Khi chuyển CSS gốc sang, phải dọn 300 `!important` và các khối chốt cuối chồng chéo — không mang nợ kỹ thuật này sang (xem mục 5) |
| E09 | Header bảo mật cơ bản | `next.config.ts` `headers()`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | **Giữ và bổ sung CSP** (gốc và Next hiện tại đều chưa có CSP) |
| E10 | Khung + nhịp chữ đã khớp gốc | `.wrap` 1380px/đệm clamp giống hệt; `p` căn đều 2 lề; thân bài 16px; nút ≥44px; gradient `.gold-title` cùng điểm dừng | **Giữ.** Đây là nền để áp CSS gốc lên mà không vỡ layout |
| E11 | Metadata title/description đầy đủ ở layout chung | `src/app/layout.tsx` | **Giữ và bổ sung** OG/Twitter/canonical/JSON-LD (Organization + Course) khi làm lại |
| E12 | Footer giữ đúng thông tin liên hệ + disclaimer | `src/components/layout/Footer.tsx`: SĐT 034 7897 868, email visfaracademy@gmail.com, Zalo hỗ trợ, Copyright 2026 © Visfar Academy, disclaimer "làm giàu nhanh" | **Giữ nội dung**, chỉ bổ sung lại cấu trúc 5 cột + link (xem A24) |

---

# 5. Đề xuất phương án sửa cụ thể

## 5.1. Nguyên tắc chung

1. **Không copy-paste nguyên file 5,5 MB.** CSS gốc có 300 `!important`, nhiều khối chốt cuối chồng chéo và dead code (xem 1.2) — mang nguyên sang sẽ mang cả nợ kỹ thuật sang Next.js và phá vỡ nguyên tắc "token là nguồn duy nhất" của `globals.css` (E08). Chỉ chuyển **giá trị thiết kế** (màu, cỡ chữ, khoảng cách, hiệu ứng), viết lại thành CSS sạch.
2. **Không đổi nội dung chữ đã chốt.** Mọi đoạn văn, tiêu đề, tên khóa học, testimonial, FAQ, policy lấy nguyên văn từ file gốc (trừ các lỗi đã biết ở 1.8 — sửa theo quyết định riêng, không tự ý sửa trong lúc chuyển đổi).
3. **Giữ nguyên các điểm tốt hơn ở 4e** (E01–E12). Đặc biệt: luồng form Worker API, h1 thật, newsletter thật, auth, dữ liệu khóa học từ Supabase.
4. **Thứ tự sửa theo giá trị nhìn thấy**, không theo thứ tự file gốc.

## 5.2. Phương án CSS: dùng lại CSS gốc dưới dạng global CSS của trang chủ (không dùng CSS module riêng lẻ cho từng section)

- **Khuyến nghị: mở rộng `src/styles/globals.css` hiện có** (270 dòng) bằng một khối "Homepage — chuyển từ bản gốc" có cấu trúc rõ ràng theo section, dùng đúng token đã có (`--bg-ivory`, `--bg-champagne`, `--gold*`, `--frame`) và bổ sung token còn thiếu: `--cream:#f7f5ef`, `--gold:#c6a45c` (đổi từ `#a8841c` hiện tại về đúng gốc — kiểm tra chỗ nào đang dùng `--gold` cho chữ/border để không vỡ tương phản), `--grad` (gradient 105° của gốc), `--shadow` về `0 24px 60px rgba(0,0,0,.45)` cho hover (giữ `--shadow` hiện tại cho bóng thường nếu cần, tách thành 2 token).
- **Quy trình chuyển đổi CSS gốc (bắt buộc, không bỏ qua):**
  1. Tách 7 khối `<style>` (1.353.803 ký tự) → loại bỏ toàn bộ `data:` URI base64 (font + chevron) → còn ≈ 258 KB CSS thật.
  2. Dọn dead code trước khi chuyển: `.intl-*` (45 lần), `#phuong-phap-giao-duc`, `#he-thong`, `.phil-subtitle`, các clamp tí hon ép 1 dòng cũ (`#roadmapTitle clamp(6.5px,2.02vw,12.5px)`…), các rule `body{background:var(--black)}` ban đầu (đã bị ghi đè).
  3. Gộp các rule trùng selector (`nav.main a` ×14, `section` ×9, `.foot-grid` ×8, `.cream` nhiều biến thể padding 54–78px → chốt 1 giá trị sau khi hỏi user hoặc đo từ render), **xóa toàn bộ 300 `!important`** bằng cách sắp xếp lại thứ tự/cụ thể selector (specificity) thay vì chốt cuối.
  4. Giữ nguyên các giá trị đã chốt: nền gradient 90° + lattice (B01), gradient vàng 135° (B05/B06), `.wrap` 1380px (đã khớp), hover chuẩn 220ms (B07), breakpoint 640/700/880/920/1020/1100px (B10 — chuyển có chọn lọc, không cần đủ 134 khối), touch target ≥44px, `prefers-reduced-motion` + `hover:none` (B11), sàn chữ: thân bài ≥16px, nhãn ≥14px.
  5. **Không dùng CSS module riêng cho từng section** cho phần này: các section dùng chung token, `.wrap`, `.cream`, `.chapter`, `.gold-title`, hover chuẩn — tách module sẽ nhân bản token và khó giữ nhất quán. Chỉ dùng CSS module (hoặc component-scoped style) cho 2 thành phần thực sự độc lập: Tam giác hiện thực SVG tương tác và form tư vấn (nếu cần).
- **2 quyết định còn treo, phải hỏi user trước khi chốt CSS (không tự quyết):**
  - Tuyên ngôn hero 13,65px @390px: chấp nhận 13,65px, hay bỏ yêu cầu "mỗi cụm đúng 1 dòng" cho cụm 1b, hay thu hẹp đệm trang để đạt 16px (xem 1.2).
  - Nhãn Tam giác 3,98px @390px: chú giải `.triangle-legend` đã bị user yêu cầu bỏ ngày 10/11/2026 — cần quyết định phương án thay thế (legend 16px dưới hình, tách hình làm đôi, hoặc bấm vào vòng để xem nhãn lớn) trước khi chuyển SVG sang React.

## 5.3. Phương án ảnh: tách base64 ra file assets trong `public/`, KHÔNG giữ data: URI

- **Khuyến nghị: tách toàn bộ 27 ảnh ra file trong `public/images/`** (ví dụ `public/images/logo.png`, `hero-group.jpg`, `founder.jpg`, `visfar-home.webp`, `posters/poster-01.jpg`…, `biz-dsc03023.jpg`, `testimonials/<ten>.png`, `events/<ten>.jpg`), dùng `next/image` (`<Image>`) với `width`/`height` thật (đã có trong gốc: 1334×889, 1696×1472, 1600×900, 1200×750, 84×84…), `loading="lazy"` cho 24 ảnh như gốc, `priority` cho logo header + ảnh hero (2 ảnh eager gốc), `fetchpriority="high"` cho hero. Lý do:
  - File gốc 5,5 MB phải tải hết trước khi render ý nghĩa; base64 nặng hơn ~33% so với file nhị phân; mỗi lần sửa 1 chữ phải tải lại cả 5,5 MB; ảnh/font không được cache riêng.
  - Tổng ảnh giải mã ≈ 3,43 MB; tách ra cho phép cache riêng từng ảnh, nén lại (poster JPEG 1600×900 hiện 107–130 KB có thể nén thêm; chân dung 84×84 hiện tới 182 KB là quá lớn so với hiển thị — nên resize về 168×168 @2x trước khi đưa lên).
  - **Logo chỉ giữ 1 file** (gốc nhúng trùng 2 lần = 450 KB base64 cho cùng 1 file).
  - **Giữ tên file poster-09/10/11 cho khóa 04/05/06 mới** (như gốc) và ghi chú mapping trong code để tránh nhầm khi bảo trì.
  - `public/qr-chuyen-khoan.png` đã có sẵn — giữ nguyên vị trí, không nhúng lại base64.
- **Không giữ data: URI** cho bất kỳ ảnh nào (kể cả logo/favicon): favicon vuông đỏ chuyển thành `src/app/icon.png` (hoặc `favicon.ico` trong `public/`); chevron SVG trong CSS chuyển thành file SVG hoặc bỏ nếu không dùng.
- **Font Be Vietnam Pro:** không giữ base64 643 KB trong CSS. Tách 12 face ra file `woff2` trong `public/fonts/` (hoặc dùng `next/font/local` với file font đã subset tiếng Việt) — kiểm tra lại giấy phép/subset trước khi dùng; nếu không tách được từ base64 thì tải lại từ nguồn chính thức của font. Giữ `font-display:swap` và cùng font stack fallback.
- **Tam giác hiện thực: KHÔNG raster hóa thành ảnh.** Chuyển SVG 8 vòng / 24 nhãn thành React component (giữ nguyên 28 `<text>`, `aria-label` từng vòng, class `.tri-ring`/`.is-active`, hành vi hover/focus/click + Escape như 1.3). VISFAR HOME thì khác: chữ nằm trong ảnh WebP vẽ sẵn nên **giữ nguyên file ảnh** (không vẽ lại bằng code trừ khi user yêu cầu đổi chữ — bản code-redraw chuẩn trước đây nằm ở `workspace/imagine_media/ngoi-nha-2d-luxury.webp` theo MEMORY, cần đối chiếu khi tới bước này).
- **Nội dung chữ trong poster:** tên khóa học là chữ HTML phủ trên poster (không vẽ vào ảnh) — giữ nguyên cách này để không phải sửa ảnh khi đổi tên khóa.

## 5.4. Phương án tính năng (giữ khung Next.js, thêm hành vi gốc)

| Tính năng gốc | Cách làm trên Next.js (đề xuất) |
|---|---|
| Menu mobile + active-section + progress bar + nút nổi | Component `Header`/`Footer` hiện có + thêm: `useState` menu mobile (nút `#menuBtn` tương đương), `IntersectionObserver` cho active-section (giữ rootMargin `-40%/-55%`), thanh tiến trình đọc (scroll listener), nút Zalo nổi + về đầu trang (hiện khi scroll >240, ẩn khi form trong viewport/khi mở policy) — toàn bộ bằng React state, không copy JS gốc |
| Tìm kiếm + 5 tab lọc khóa học (trang chủ) | Đưa `CourseGrid` lên trang chủ, dữ liệu từ Supabase (`fetchPublishedCourses`); **xác minh `filterCourses` có `norm()` bỏ dấu như gốc không**, nếu chưa có thì bổ sung; tab "Cộng đồng" giữ số đếm động (không hard-code như gốc); ô search giữ placeholder "Tìm khóa học, giảng viên…" chỉ khi có dữ liệu giảng viên thật, nếu không thì đổi placeholder cho trung thực |
| Toggle chi tiết khóa học | `useState` mở/đóng từng thẻ trên trang chủ (giữ nhãn "Xem chi tiết khóa học" ↔ "Thu gọn chi tiết" + `aria-expanded`); trang chi tiết `/chuong-trinh/[slug]` đã có thì giữ làm đích phụ, không thay toggle |
| Pre-select khóa học | `ConsultationForm` đọc `searchParams` (`?course=<slug>`) từ CTA; các CTA trang chủ link `/tu-van?course=…`; bỏ link cũ "Thấu Hiểu Bản Thân (miễn phí)" (lỗi gốc A05/1.8-5) |
| Form tư vấn trên trang chủ | Nhúng `ConsultationForm` vào section `#tu-van` trên trang chủ (giữ nguyên component + luồng Worker API, không viết lại form); bổ sung nút Zalo nhóm + Zalo hỗ trợ vào màn hình cảm ơn (D09) |
| Policy 4 trang con | **Route thật `/chinh-sach/bao-mat`, `/dieu-khoan-tham-gia`, `/hoan-tra-huy-dang-ky`, `/giai-quyet-khieu-nai`** (theo sitemap mới trong báo cáo phân tích) thay vì hash view; nội dung lấy nguyên văn từ `#page-*` (kèm ngày cập nhật 04/11/2026); footer link tới route thật; gộp 4 khối liên hệ lặp nguyên văn thành 1 component dùng chung |
| FAQ | Chuyển 9 `<details>` thành component FAQ (giữ nguyên văn câu hỏi/trả lời; sửa câu còn tên khóa cũ theo quyết định riêng) |
| Blog / Sự kiện | Quyết định trước khi làm: hoặc làm trang chi tiết thật (`/blog/[slug]`, `/su-kien/[slug]` + đăng ký sự kiện), hoặc gỡ khỏi menu cho tới khi có nội dung — **không mang link chết `#tu-van` của gốc sang**. Ngày sự kiện: hỏi user trước (mâu thuẫn 05/2026 trong file vs 25/11/2026 trong MEMORY — xem 1.7) |
| Newsletter | Giữ `NewsletterForm` thật (E04); chỉ đổi vị trí/giao diện về đúng dải newsletter footer gốc |
| SEO/a11y | Giữ h1 thật (E01); bổ sung OG/Twitter/canonical/robots/JSON-LD (Organization + Course), CSP (E09), skip-link (D15), `title` thật cho iframe nếu còn dùng (không dùng iframe fallback nữa thì thôi) |

## 5.5. Thứ tự ưu tiên sửa (đề xuất)

| Giai đoạn | Việc | Bao gồm (mã điểm khác) | Ghi chú |
|---|---|---|---|
| **1 — Khung + nền + chữ** | Nền ivory gradient + lattice; token `--cream`/`--gold`/`--grad`; `.cream`; tiêu đề section + `.chapter`; tuyên ngôn hero 3 dòng | B01, B03, B04, B05, B06, B15, B17 | Hỏi user về 13,65px trước khi chốt tuyên ngôn (5.2) |
| **2 — Ảnh + font** | Tách 27 ảnh → `public/images/` + `next/image`; logo 1 file; favicon; font Be Vietnam Pro self-host (woff2/next-font) | C01–C09, B02 | Ảnh chân dung resize trước khi đưa lên; poster giữ tên file cũ |
| **3 — Section nội dung** | Hero đầy đủ (ảnh + 4 đoạn) → Sứ mệnh & Tầm nhìn → Founder → Triết lý (6 mục + 11 phương diện + hộp Nhân–Duyên–Quả + VISFAR HOME + Tam giác SVG React + Tuyên ngôn) → Lộ trình → Lĩnh vực → Doanh nghiệp → Chia sẻ → Blog/Sự kiện → FAQ → Đang cập nhật | A01–A21 (trừ A15/A22/A23) | Nội dung lấy nguyên văn từ file gốc; nội dung "tạm" (1.8-7) đánh dấu `noi_dung_tam`; Tam giác cần quyết định phương án nhãn trước (5.2) |
| **4 — Khóa học + form trên trang chủ** | 10 thẻ khóa học (poster + toggle + pre-select) + search/5 tab lọc; nhúng `ConsultationForm` + nút Zalo cảm ơn | A15, A22, D03, D04, D05, D09 | Dữ liệu từ Supabase (E06); giữ luồng Worker API (E02) |
| **5 — Header/Footer/Policy/tính năng còn lại** | Topbar + menu 6 mục đúng đích + menu mobile + active-section + progress bar + nút nổi; footer 5 cột + link policy/khóa học; 4 route `/chinh-sach/*`; FAQ tương tác; SEO (OG/JSON-LD/CSP) + skip-link | A23–A26, B07–B14, B16, C10–C16, D01, D02, D10, D12–D15, D17 | Sửa 2 link nav sai đích (Giới thiệu, Kết nối) ngay trong giai đoạn này; ngày sự kiện + tên khóa cũ hỏi user trước |

---

# Phụ lục

## A. Nguồn và số liệu đo (task này)

| Số liệu | Giá trị đo được | Cách đo |
|---|---|---|
| File gốc | 5.742.754 byte, 5.141 dòng, md5 `0328f284880efe01f672596a958715bc` | `ls -l`, `wc -l`, `md5sum` — khớp task |
| `<style>` / `<script>` | 7 khối style (1.353.803 ký tự; tách base64 còn 257.932 ký tự ≈ 258 KB), 3 khối script (≈ 20.756 ký tự ≈ 21 KB) | Trích xuất bằng Python (regex `<style>`/`<script>`) |
| `!important` / `@media` / `clamp()` | 300 / 134 / 74 | Đếm trong các khối style |
| Section / id / heading | 13 section, 72 id (0 trùng), h1=4, h2=46, h3=66, h4=5 | Trích xuất bằng Python |
| Ảnh | 27 `<img>` (16 JPEG + 14 PNG + 1 WebP trong tổng `data:image`, gồm favicon/chevron ngoài `<img>`); base64 ảnh ≈ 4.684 KB ký tự, giải mã ≈ 3,43 MB | Trích xuất `<img src="data:image…">` |
| Font | 12 `@font-face` Be Vietnam Pro, ≈ 643 KB base64 | Đếm `@font-face` + độ dài khối font |
| Link/nút | 115 `<a>`, 19 `<button>`, 9 `<details>`, 1 `<form>`, 1 iframe ẩn; 13 link `zalo.me` (2 URL duy nhất) | Trích xuất bằng Python |
| Trang chủ Next | `page.tsx` 47 dòng; `globals.css` 270 dòng / 16.739 byte / 8 `@media` / 0 `!important` thật; `Header.tsx` 25 dòng; `Footer.tsx` 30 dòng; `ConsultationForm.tsx` 323 dòng; `NewsletterForm.tsx` 75 dòng; `CourseCard.tsx` 29 dòng | `wc -l` / `wc -c`, đọc tay |
| Worker API | `https://api.visfaracademy.workers.dev/api/v1` (mặc định trong `getApiBaseUrl()`), POST `/api/v1/leads` | `src/lib/api-client.ts`, `src/lib/leads.ts` |
| Dữ liệu dùng chung | `PROVINCES` 34 tỉnh/thành (ABC); `PILLARS` 4 trụ cột (Tâm thức/Trí tuệ/Nhân hiệu/Cộng đồng) | `packages/shared/src/constants.ts` |

Số liệu nào lấy từ báo cáo phân tích sẵn mà không đo lại trong task này (ví dụ: 1.104 selector duy nhất, 41 `white-space:nowrap`, số từ policy, tương phản gradient) đều được ghi rõ "theo báo cáo phân tích" ở chỗ dùng.

## B. File tham chiếu chính

- Gốc: `~/workspace/user/files/Visfar_Academy.html`
- Báo cáo phân tích sẵn: `~/workspace/your_files/bao-cao-phan-tich-visfar-academy/Bao-cao-phan-tich-Visfar-Academy.md`
- Trang chủ Next: `~/workspace/visfar-academy-platform/apps/web/src/app/page.tsx`, `src/app/layout.tsx`, `src/styles/globals.css`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`
- Liên quan: `src/components/ConsultationForm.tsx`, `src/components/NewsletterForm.tsx`, `src/components/course/CourseCard.tsx`, `src/app/tu-van/page.tsx`, `src/app/chuong-trinh/page.tsx`, `src/lib/leads.ts`, `src/lib/api-client.ts`, `src/lib/validation.ts`, `src/lib/courses.ts`, `packages/shared/src/constants.ts`, `apps/web/next.config.ts`, `apps/web/public/qr-chuyen-khoan.png`
- Báo cáo này: `~/workspace/visfar-academy-platform/docs/frontend/HOMEPAGE_COMPARE.md`

## C. Giới hạn và câu hỏi còn mở (cần parent/user xác nhận trước khi thiết kế lại)

1. **Chưa render/kiểm chứng bằng trình duyệt thật** — mọi nhận xét về hiển thị (màu, cỡ chữ, tràn ngang) đều suy từ mã nguồn. Nên chụp/screenshot đối chiếu sau khi làm xong giai đoạn 1–2.
2. **Ngày sự kiện mâu thuẫn:** file gốc ghi 22/25/28-05/2026 ("Đã diễn ra"), MEMORY.md ghi 3 sự kiện tháng 11 ngày 25/11/2026, 18h30. Chưa rõ bản nào mới hơn — hỏi user trước khi mang ngày sự kiện sang.
3. **Tuyên ngôn 13,65px @390px** và **nhãn Tam giác 3,98px @390px** — 2 quyết định còn treo (xem 5.2).
4. **Topbar gốc có rule `.topbar{display:none}`** — chưa xác định ngữ cảnh breakpoint; cần kiểm tra trước khi quyết định có hiện topbar trên Next.js hay không.
5. **Chưa xác minh `filterCourses` có bỏ dấu tiếng Việt (`norm()`) như gốc không** — kiểm tra `src/lib/courses.ts` khi tới giai đoạn 4.
6. **Chưa kiểm tra nội dung Supabase hiện có đủ 10 khóa học với đúng tên/thứ tự 01–10 hay không** — trang `/chuong-trinh` đọc từ Supabase nên trang chủ sẽ chỉ đúng khi dữ liệu đúng.
7. **Không ghi secret/token/key/mật khẩu nào trong báo cáo này.** URL Web App Apps Script gốc và URL Worker API là các endpoint công khai đã có sẵn trong mã nguồn repo/file gốc; báo cáo chỉ nhắc tên file chứa chúng, không trích nguyên văn URL Apps Script.

---

# Đã sửa — 11/11/2026 ~01:33 +07 (task rebuild trang chủ)

Trang chủ Next.js đã được thiết kế lại cho khớp file HTML gốc theo đúng 5 giai đoạn §5.
Chi tiết đầy đủ: `docs/frontend/HOMEPAGE_REBUILD_REPORT.md`.

| Giai đoạn | Kết quả |
|---|---|
| 1 — Khung + nền + chữ | Xong: nền ivory gradient + lattice, token `--cream`/`--gold:#c6a45c`/`--grad`, `.cream`, tiêu đề section + `.chapter`, tuyên ngôn hero 3 dòng 13,65px @390px (quyết định 1, giữ nguyên) |
| 2 — Ảnh + font | Xong: 27 ảnh tách ra `public/images/` (logo 1 file, không trùng lặp), font Be Vietnam Pro 12 face woff2 self-host qua `next/font/local`, favicon `src/app/icon.png`, 0 data: URI |
| 3 — Section nội dung | Xong: đủ 13 section đúng thứ tự DOM gốc (`#lo-trinh` lồng trong `#triet-ly`, `#su-kien` là div trong `#blog`); hero 4 đoạn + ảnh; Sứ mệnh/Tầm nhìn; Founder 6 đoạn + ảnh; Triết lý 6 mục + 11 phương diện + hộp Nhân–Duyên–Quả + VISFAR HOME + Tam giác SVG 8 vòng tương tác + Tuyên ngôn; Lộ trình 6 bước; 6 Lĩnh vực; Doanh nghiệp; 8 testimonial nguyên văn; Blog + Sự kiện (ngày 25/11/2026, 18:30, Zoom); 9 FAQ; 4 thẻ Đang cập nhật |
| 4 — Khóa học + form | Xong: 10 thẻ khóa học nguyên văn (poster + toggle chi tiết + CTA pre-select `/tu-van?course=<slug>`), tìm kiếm bỏ dấu + 5 tab lọc (số đếm 10/8/4/3/1 khớp gốc), form tư vấn nhúng trên trang chủ (giữ luồng Worker API + Idempotency-Key, thank-you chỉ khi ok:true), màn hình cảm ơn bổ sung 2 nút Zalo |
| 5 — Header/Footer/Policy/tính năng | Xong: topbar (ẩn ≤920px như gốc), logo ảnh, menu 6 mục đúng đích + menu mobile + active-section + progress bar; footer 5 cột + intro toàn chiều rộng + newsletter thật + 4 link policy; 4 route thật `/chinh-sach/*` (nội dung nguyên văn); nút Zalo nổi + về đầu trang; reveal khi cuộn; OG/Twitter/canonical/JSON-LD + skip-link |

**Điểm khác đã sửa (mã báo cáo):** A01–A26 (trừ A19 một phần — xem dưới), B01–B17, C01–C16, D01–D06, D09, D10, D13, D14, D15, D17. **Giữ nguyên 12 điểm tốt hơn E01–E12** (h1 thật, form Worker API, validation thống nhất, newsletter thật, auth, Supabase, không PII trong mailto, CSS 0 `!important`, header bảo mật, khung/nhịp chữ, metadata, liên hệ footer).

**Chưa khớp hẳn / cần user quyết:**
- A19 (sự kiện): ngày dùng 25/11/2026, 18:30, Zoom theo quyết định đã chốt; pill "Đã diễn ra" của gốc đã bỏ (mâu thuẫn với ngày tương lai); tiêu đề Q&A đổi "tháng 5" → "tháng 11" theo ngày đã chốt.
- FAQ câu 1 vẫn giữ nguyên văn tên khóa cũ ("Thấu Hiểu Bản Thân… Khai Mở Trí Tuệ, Kiến Tạo Nhân Hiệu") như file gốc — chờ quyết định của user (xem 1.8-5).
- Ghi chú "Chưa có cổng đăng nhập riêng" ở section Đang cập nhật giữ nguyên văn gốc dù nền tảng đã có `/dang-nhap` — chờ user quyết có sửa câu này không.
- Footer link khóa học trỏ tới `/chuong-trinh/<slug>` (trang chi tiết thật) thay vì anchor `#chuong-trinh` như gốc.
- Khóa học trên trang chủ dùng nội dung tĩnh nguyên văn từ file gốc (xem báo cáo rebuild — Supabase seed chưa có danh sách Nội dung chính/Kết quả).

**Kiểm chứng:** `npm test` 595/595 PASS · `tsc --noEmit` PASS · `eslint` PASS · `next build` PASS · render thật bằng Chromium headless: 390px và 1440px đều không tràn ngang, body 16px, manifesto 13,65px @390px, 27/27 ảnh tải đủ, 0 lỗi console (trừ lỗi mạng sandbox chặn Supabase từ trình duyệt headless — curl từ VM tới Supabase trả 401 như kỳ vọng khi thiếu key, tức endpoint vẫn sống).

**DEPLOY — CHƯA XONG (chặn):** `wrangler pages deploy` lỗi vì VM không có xác thực Cloudflare: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work` và `wrangler whoami` trả `You are not authenticated. Please run 'wrangler login'`. Build Pages đã xong (`.vercel/output/static`, 14M) và sẵn sàng deploy. Live https://visfaracademy.pages.dev lúc 01:33 +07 vẫn là bản cũ (13.530 byte, không có `#triet-ly`).
