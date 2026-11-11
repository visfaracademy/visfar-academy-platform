# Nợ kỹ thuật — Visfar Academy (TASK 01 — Audit website)

**Ngày lập:** 10/11/2026
**Thuộc TASK 01:** Audit website Visfar Academy
**Trạng thái:** Tài liệu audit — KHÔNG sửa code, KHÔNG sửa file HTML, KHÔNG tạo database, KHÔNG deploy.

## 1. Nguồn và phạm vi

**Nguồn duy nhất để kiểm chứng:**

| Nguồn | Thông tin đo được |
|---|---|
| `workspace/user/files/Visfar_Academy.html` (file do user tải lên ngày 10/11/2026, 11:50) | 5.742.754 byte (5,5 MB), 5.141 dòng, md5 `0328f284880efe01f672596a958715bc` |
| `workspace/your_files/bao-cao-phan-tich-visfar-academy/Bao-cao-phan-tich-Visfar-Academy.md` | Báo cáo phân tích hiện trạng cùng ngày, đếm từ cùng một file HTML |
| `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` | Chỉ dùng qua báo cáo trên, cho các nhận xét về phía server Apps Script; **chưa xác minh bản deploy thực tế trên Google có trùng file này hay không** |

**Phạm vi:** chỉ mã nguồn trong file HTML nêu trên (cộng file Apps Script tham chiếu qua báo cáo). Không POST thật lên Web App, không test trên trình duyệt thật, không đo hiệu năng render thật. Mọi số liệu trong file này đều đếm được từ file HTML hoặc lấy từ báo cáo phân tích đã dẫn; những điểm ghi “chưa xác minh” thì chưa xác minh.

**Nguyên tắc tôn trọng trong mọi mô tả sửa chữa:** giữ nguyên nội dung thương hiệu, triết lý Giáo dục Tận Gốc (Tâm thức – Trí tuệ – Nhân hiệu; Thập Nhất Viên Mãn; Lộ trình 6 bước Biết – Tin – Hiểu – Thấu suốt – Chuyển hóa – Huân tập và quảng bá), nhận diện màu đen than – vàng gold – ivory champagne, font Be Vietnam Pro và bố cục luxury hiện có. Nợ kỹ thuật ở đây là nợ về cấu trúc, bảo trì, bảo mật và tính trung thực của chức năng — không phải lý do để viết lại nội dung hay đổi triết lý.

**Quy ước mức độ:** Nghiêm trọng / Cao / Trung bình / Thấp.
**Quy ước chi phí sửa:** chỉ dùng Thấp / Trung bình / Cao. Không ghi số giờ chính xác vì chưa có ước lượng từ đội thi công.

**Bối cảnh tổng thể (để đọc các mục dưới đây đúng tầm):** trang hiện tại là 1 file HTML duy nhất 5,5 MB, 13 `<section>`, 1 `<form>` duy nhất (`#consultForm`), 3 khối `<script>`, 0 framework, 0 thư viện ngoài, 0 CDN, 0 analytics. Điểm mạnh cần giữ: nội dung triết lý hoàn chỉnh và nhất quán, form thu lead đã có đường chạy thật tới Google Sheet, 72 `id` không trùng, 0 `innerHTML`/`eval`/`document.write`, 8 link `target="_blank"` đều có `rel="noopener"`.

---

## 2. Nhóm A — Đường thu lead và bảo mật (mất lead / rò rỉ dữ liệu)

### TD-01 — Fallback iframe hiện “thành công giả”: báo đã gửi khi chưa có xác nhận Sheet ghi xong

- **Mức độ:** Nghiêm trọng
- **Bằng chứng từ mã nguồn:** iframe ẩn `#sheetFrame` ở dòng 4437 (`<iframe id="sheetFrame" name="sheetFrame" title="" … style="position:absolute;width:1px;height:1px;opacity:0;…">`). Hàm `submitViaIframe()` (dòng 4925–4953) tạo form tạm target vào iframe; hàm `showFallbackOk()` (dòng ~4912) hiện hộp `#formOk` ngay khi iframe phát sự kiện `load`. Iframe cross-origin nên trình duyệt **không đọc được nội dung phản hồi** — bất kỳ sự kiện `load` nào (kể cả trang lỗi hay redirect của Google) cũng được coi là “đã gửi”. Hết 25.000 ms không `load` thì báo lỗi “Không nhận được xác nhận… Yêu cầu có thể đã được gửi đi, vui lòng đừng gửi lại ngay…”. Nhánh fetch chính thì đúng logic (chỉ gọi `showThankYou()` khi `data.ok === true`, tức server đã `appendRow` xong); điểm mù chỉ nằm ở nhánh fallback. Ngoài ra nhánh `else { fallback(); }` ở dòng 5022–5023 cũng rơi vào đường này khi fetch trả JSON không có `ok:true`.
- **Hậu quả:** người đăng ký thấy “đã gửi” nhưng dòng lead có thể chưa hề vào Sheet; không có mã tham chiếu / id đăng ký để đối soát; mất lead mà không ai biết. Sau mỗi đăng ký thật vẫn phải kiểm tra thủ công tab DATA.
- **Chi phí sửa ước lượng:** Trung bình (đổi văn bản fallback thành “đã gửi, chưa xác nhận — chúng tôi sẽ liên hệ / kiểm tra lại”, kèm mã tham chiếu duy nhất cho mỗi lần gửi; giữ nguyên giao diện hộp xác nhận và luồng cảm ơn hiện có).

### TD-02 — Endpoint Apps Script công khai, không token, không CAPTCHA, không rate-limit, không chống ghi trùng

- **Mức độ:** Nghiêm trọng
- **Bằng chứng từ mã nguồn:** URL Web App hard-code đúng 1 lần trong file, dòng 4862: `https://script.google.com/macros/s/AKfycbxMYvos2_UjIC9AQHnbA_I4F2gAIntnzmjkL6bWv4Doq26ltrfA6T0BpkONdesQk-fM/exec`. Đếm trong file: `captcha` / `recaptcha` / `honeypot` / `csrf` = 0. Fetch POST không kèm token, header xác thực hay mã chống spam nào. Phía server (theo file `.gs` qua báo cáo): `doPost` chỉ có `LockService.getScriptLock().tryLock(10000)` để serialize (chống ghi đồng thời), **không có idempotency key / mã yêu cầu / kiểm tra trùng** trước `appendRow`. Không xác minh được cấu hình deploy thực tế (Execute as / Anyone), nên không kết luận quyền deploy chỉ từ HTML.
- **Hậu quả:** ai có URL đều POST được họ tên / SĐT / email giả vào Sheet; một lần fetch timeout 30 s sau khi server đã `appendRow` nhưng trước khi client nhận JSON sẽ khiến client gọi fallback iframe và ghi thêm 1 dòng trùng; `AbortController` hủy phía client, không hủy phía server. Sheet lead bị nhiễu, khó đối soát.
- **Chi phí sửa ước lượng:** Cao (thêm idempotency key sinh ở client + kiểm tra trùng ở server, honeypot hoặc CAPTCHA, rate-limit phía server trong `Code.gs`, đồng bộ lại sau khi xác minh bản deploy thực tế).

### TD-03 — Dữ liệu cá nhân (PII) bị đưa vào `mailto:` và clipboard

- **Mức độ:** Nghiêm trọng
- **Bằng chứng từ mã nguồn:** `mailto:` xuất hiện 8 lần trong file; `data-body` xuất hiện 2 lần (dòng 4983, 5034). Trước khi fetch, JS chuẩn bị sẵn `mailto:visfaracademy@gmail.com?subject=…&body={Họ tên / SĐT / Email / Tỉnh / Khóa học}` và gán vào `okBox.setAttribute("data-body", body)` cùng `mailtoBtn.href` (dòng 4978–4983). Nút `#copyBtn` (dòng 5033–5038) sao chép toàn bộ body qua `navigator.clipboard.writeText` + fallback `textarea + document.execCommand("copy")`. Địa chỉ `visfaracademy@gmail.com` xuất hiện 19 lần trong file; hotline `tel:+84347897868` xuất hiện 10 lần.
- **Hậu quả:** email client, lịch sử trình duyệt, clipboard và bất kỳ ai bấm nhầm nút dự phòng đều thấy đủ họ tên + SĐT + email + tỉnh + khóa học của người đăng ký; dữ liệu rời khỏi kênh POST HTTPS duy nhất được kiểm soát. Lưu ý quirk đã xác minh: `#formOk` chỉ hiện ở nhánh fallback, nên người đăng ký thành công bình thường không bao giờ thấy nút mailto/copy dự phòng — rủi ro tập trung ở nhánh dự phòng.
- **Chi phí sửa ước lượng:** Thấp (hộp dự phòng chỉ chứa mã tham chiếu, không chứa PII; PII chỉ gửi qua POST HTTPS tới server; giữ nguyên nút Zalo nhóm và Zalo hỗ trợ trên màn hình cảm ơn).

### TD-04 — Form chết hoàn toàn khi tắt JavaScript

- **Mức độ:** Nghiêm trọng
- **Bằng chứng từ mã nguồn:** file chỉ có 1 `<form>` (`<form id="consultForm" class="reveal" novalidate>`, dòng 4332) — không có `action`, không có `method`; `novalidate` tắt hoàn toàn validation native của trình duyệt. Toàn bộ validation và submit đều do JS làm (dòng 4954–5031). Không có thông báo dự phòng khi không có JS.
- **Hậu quả:** đường chuyển đổi duy nhất của trang biến mất khi không có JS; người dùng không gửi được đăng ký và cũng không được báo lý do.
- **Chi phí sửa ước lượng:** Trung bình (thêm `action` POST thẳng tới Web App làm dự phòng hoặc thông báo rõ ràng khi không có JS; bổ sung validation HTML `pattern`/`required` song song với JS; giữ nguyên các field, thứ tự và nhãn hiện có).

---

## 3. Nhóm B — CSS: nợ đã tới ngưỡng nguy hiểm

### TD-05 — Lạm dụng `!important`: 300 lần

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn:** đếm được đúng **300 lần** `!important` trong file, trên 187 dòng. Ví dụ: `#philosophyTitle{… !important}` (dòng 1397); `.hero-manifesto h2 .manifesto-line2{… !important}` (dòng 1407, rồi lại dòng 1692 với giá trị khác); `html.js .reveal{… !important}` lặp ở dòng 1447, 1476, 1503 với 3 giá trị `transition` khác nhau.
- **Hậu quả:** thứ tự thắng của CSS phụ thuộc vào vị trí cuối file + `!important`, không phụ thuộc thứ tự logic; sửa một chỗ có thể vỡ chỗ khác — đây là nguyên nhân trực tiếp của các lỗi “sửa chỗ này, hỏng chỗ kia” trong lịch sử trang. Mọi thay đổi giao diện sau này đều đắt và rủi ro.
- **Chi phí sửa ước lượng:** Cao (dỡ `!important` theo từng cụm, thay bằng specificity đúng và thứ tự lớp rõ ràng; phải kiểm tra hồi quy từng section vì không có test giao diện tự động; không đổi màu sắc, font hay bố cục trong quá trình dỡ).

### TD-06 — Khối chốt CSS chồng chéo: 4 khối `<style>` thật (7 lần chuỗi `<style>` kể cả trong comment), ~1.955 rule

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn:** chuỗi `<style` xuất hiện 7 lần, trong đó 3 lần là nhắc tới trong comment CSS (dòng 1662, 1803, 1906); khối `<style>` thật là 4 (dòng 11, 2836, 3132, 3277) với 4 thẻ đóng `</style>` (dòng 2835, 3131, 3276, 3481). Báo cáo phân tích đếm ~258 KB CSS, **~1.955 rule**, 1.104 selector duy nhất, 134 lần `@media` (đếm trực tiếp: 134), 74 `clamp()`, 41 lần `white-space:nowrap` (đếm trực tiếp: 41). Selector trùng nhiều nhất: `@media(max-width:640px)` ×25, `@media(max-width:880px)` ×19, `nav.main a` ×14, `section` ×9, `.foot-grid` ×8, `html.js .reveal` ×8, `.wrap` ×6. Comment trong code tự thừa nhận ở dòng 1583–1692: “Ghi đè quy tắc căn trái !important của khối chuẩn điện thoại ở trên…”. Quy tắc ép 1 dòng cũ vẫn nằm trong file nhưng đã bị khối audit cuối (dòng ~3133–3276, dùng `!important`) ghi đè — ví dụ `#roadmapTitle clamp(6.5px,2.02vw,12.5px)` sẽ cho 7,88px ở 390px nếu không có khối audit; `#coursesTitle clamp(10.2px,3.2vw,12.8px)` → 12,48px.
- **Hậu quả:** không ai còn biết chắc quy tắc nào đang thắng ở một breakpoint; mỗi lần sửa phải đọc 4 khối chốt chồng nhau; rủi ro hồi quy cao, đặc biệt trên điện thoại 390px và tablet 768px (không có breakpoint riêng 768px — tablet rơi vào dải 641–1100px, cỡ chữ chỉ suy từ công thức clamp).
- **Chi phí sửa ước lượng:** Cao (hợp nhất các khối chốt thành một lớp CSS có thứ tự rõ ràng, gom các `@media` trùng breakpoint, xóa quy tắc cũ đã bị ghi đè; giữ nguyên giá trị hiển thị cuối cùng — màu, cỡ chữ, bố cục — chỉ đổi cách tổ chức).

### TD-07 — Dead code CSS/JS: selector còn, phần tử đã xóa

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn (đếm trực tiếp):**
  - `.intl-note`: 15 lần, **0 phần tử**; `.intl-panel`: 30 lần, **0 phần tử**; tổng chuỗi `.intl-` là 64 lần. Riêng `.intl-*` còn 30 lần gợi ý có cả một panel quốc tế đã bị xóa mà CSS chưa dọn.
  - `#phuong-phap-giao-duc`: 5 lần trong CSS, **0 `id`** trong HTML; `#he-thong`: 5 lần, **0 `id`**.
  - `.phil-subtitle`: 2 lần, **0 phần tử**.
  - `[data-copy]`: handler JS ở dòng 4836–4837 (`document.querySelectorAll("[data-copy]")…`), nhưng **0 phần tử** nào trong HTML mang thuộc tính `data-copy` (chuỗi `data-copy` chỉ xuất hiện đúng 2 lần, cả hai đều ở 2 dòng JS này) — handler không bao giờ chạy.
  - `#floatCta`: JS nhắc 4 lần (dòng 4841 `getElementById("floatCta")`, dòng 4849 `if(floatCta) floatCta.classList.toggle("show", …)`), nhưng HTML **không có `id="floatCta"`** — nhờ guard `if(floatCta)` nên không crash, nhưng tính năng “nút CTA nổi sau 700px” vĩnh viễn không hiện.
- **Hậu quả:** file phình to vô ích; người bảo trì tưởng tính năng còn tồn tại (panel quốc tế, nút CTA nổi, nút copy) và sửa nhầm chỗ chết; che khuất quy tắc đang chạy thật.
- **Chi phí sửa ước lượng:** Thấp (xóa các selector/handler chết sau khi xác nhận không còn phần tử nào dùng; hoặc khôi phục phần tử `floatCta` nếu chủ dự án muốn tính năng này — xem quyết định D7).

---

## 4. Nhóm C — Single-file 5,5 MB: tài nguyên nhúng base64

### TD-08 — Một file duy nhất 5,5 MB, ~93% là base64, không cache riêng từng asset

- **Mức độ:** Trung bình
- **Bằng chứng từ mã nguồn:** file 5.742.754 byte, 5.141 dòng; theo báo cáo phân tích, ~5.202 KB / 5.577 KB file (93%) là base64; ảnh ~4.684.780 byte (81,6% file); phần HTML+CSS+JS thật chỉ ~375 KB. 0 file CSS/JS/font/ảnh ngoài; 0 CDN. Base64 làm ảnh nặng hơn ~33% so với file nhị phân. CSS ~258 KB nằm inline trong `<head>` nên chặn first paint.
- **Hậu quả:** file đơn phải tải hết trước khi render ý nghĩa; không cache riêng từng ảnh/font; mỗi lần sửa 1 chữ phải tải lại cả 5,5 MB; không tận dụng HTTP/2 multiplexing cho asset. Điểm cộng cần giữ: `loading="lazy"` 24/27 ảnh, hero có `fetchpriority="high"`, `font-display:swap`, 26/27 ảnh có `width/height` chống layout shift.
- **Chi phí sửa ước lượng:** Cao (tách CSS/JS/ảnh/font ra file riêng, giữ nguyên nội dung và giao diện; cần quy trình build/deploy mới thay cho xuất file đơn — xem quyết định D6).

### TD-09 — Logo lặp 2 lần trong file; không có `srcset`; font base64 không subset

- **Mức độ:** Trung bình
- **Bằng chứng từ mã nguồn:** 27 thẻ `<img>`, tất cả `src` đều là `data:` URI (32 lần `data:image`, gồm 16 JPEG + 14 PNG + 1 WebP + 1 SVG chevron trong CSS), 0 `src` ngoài. Logo (cùng một file PNG base64, cùng tiền tố `iVBOR…`) xuất hiện 2 lần: header dòng 3494 và footer dòng 4617 — theo báo cáo mỗi lần ~225 KB, tức ~450 KB trùng lặp. `srcset` = 0 (đếm trực tiếp) — ảnh poster 1600×900 vẫn tải đủ trên điện thoại 390px. Font: 12 `@font-face` Be Vietnam Pro (weights 400–900, normal + italic, đếm trực tiếp: 12), `src:url(data:application/octet-stream;base64,…)` — tổng ~643 KB base64 (~470 KB giải mã) theo báo cáo; không tách file, không subset, không dùng Google Fonts/CDN.
- **Hậu quả:** tải trùng 225 KB logo; điện thoại tải ảnh thừa độ phân giải; font tải đủ 12 face dù trang có thể chỉ dùng một phần; tất cả đều cộng vào 5,5 MB ở TD-08.
- **Chi phí sửa ước lượng:** Trung bình (dùng chung 1 file logo, thêm `srcset`/`sizes` cho poster và ảnh sự kiện, subset font theo ký tự tiếng Việt thực dùng; giữ nguyên logo trong suốt hiện tại — đã bỏ nền đỏ — và stack fallback `"Be Vietnam Pro","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`).

---

## 5. Nhóm D — SEO, cấu trúc và điều hướng

### TD-10 — Không có `<h1>` cho trang chính

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn:** `<h1` xuất hiện đúng 4 lần (đếm trực tiếp), tất cả đều trong 4 bài chính sách ẩn thuộc `#policyView`: dòng 4448 (`policyPrivacyTitle`), 4499 (`policyTermsTitle`), 4538 (`policyRefundTitle`), 4572 (`policyComplaintTitle`). Trang chính có h2 = 46, h3 = 66 — tiêu đề hero tuyên ngôn là `<h2>` (dòng 3516). Policy ẩn sau JS nên bot/crawler không tới được nội dung chính sách; 4 h1 này vì thế cũng vô hình với SEO.
- **Hậu quả:** SEO sai cấu trúc; screen-reader không có tiêu đề cấp 1 để định vị trang; tiêu đề tuyên ngôn “Khai mở tâm thức • Tu dưỡng đạo đức • Phát triển trí tuệ • Hoàn thiện con người • Kiến tạo thịnh vượng” không được nhận diện là tiêu đề chính.
- **Chi phí sửa ước lượng:** Thấp (thêm 1 `<h1>` thật cho trang chính, giữ nguyên chữ tuyên ngôn và kiểu gradient vàng hiện có; 4 h1 chính sách giữ nguyên khi chính sách có URL thật — xem TD-14).

### TD-11 — Thiếu CSP, OG/Twitter, canonical, robots, JSON-LD, sitemap

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn:** `Content-Security-Policy` = 0; `og:` = 0; `twitter:` = 0; `canonical` = 0; `robots` = 0; `application/ld+json` = 0 (đếm trực tiếp tất cả). File chỉ có 4 thẻ `<meta>` (đếm trực tiếp: 4): charset, viewport, color-scheme, description. Title dài ~100 ký tự (có đủ tuyên ngôn) và meta description đã có — đó là phần tốt cần giữ.
- **Hậu quả:** chia sẻ link lên Zalo/Facebook không có ảnh/tiêu đề đẹp; không có canonical thì bản `Visfar_Academy.html` và bản artifact live có thể bị coi là trùng lặp; không có lớp CSP bảo vệ trước chèn tài nguyên lạ; công cụ tìm kiếm không có dữ liệu cấu trúc về tổ chức và khóa học.
- **Chi phí sửa ước lượng:** Thấp (thêm các thẻ meta/OG/canonical/JSON-LD Organization + Course và CSP; dùng đúng ảnh hero tập thể và tiêu đề hiện có, không đổi nội dung).

### TD-12 — Chính sách qua hash, không có `id` đích; khối liên hệ lặp nguyên văn 4 lần

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn:** link hash `#chinh-sach-bao-mat` xuất hiện 4 lần; `id="chinh-sach-…"` = 0 phần tử. Đích thật là `id="page-bao-mat"` (1 lần), `id="page-dieu-khoan"`, `id="page-hoan-tra"`, `id="page-khieu-nai"` (mỗi 1 lần), cộng `data-policy`; chỉ chạy nhờ `renderPolicy()` (dòng 5062–5089) bắt `hashchange`. Khối liên hệ chính sách lặp nguyên văn 4 lần — sửa 1 số điện thoại phải sửa 4 chỗ. Tên doanh nghiệp trong chính sách: “Tổ chức đào tạo Visfar Academy”, SĐT 0347875229, email visfaracademy@gmail.com; địa chỉ trụ sở, mã số thuế, số/ngày cấp đăng ký kinh doanh chưa được cung cấp — không được bịa.
- **Hậu quả:** không JS thì không mở được chính sách; không chia sẻ được link trực tiếp tới một chính sách; bot/crawler không tới được; bảo trì 4 bản sao dễ lệch nhau (ví dụ đổi SĐT sót 1 chỗ).
- **Chi phí sửa ước lượng:** Trung bình (thêm `id` đích trùng với hash hoặc tách thành URL thật `/chinh-sach/…`; gộp 4 khối liên hệ thành 1 nguồn dùng chung; giữ nguyên toàn văn 4 chính sách).

### TD-13 — Blog và sự kiện không có trang đích; nút “Xem chi tiết” chỉ cuộn về form

- **Mức độ:** Trung bình
- **Bằng chứng từ mã nguồn:** 3 bài blog trong `#blog` là `<article>` thuần túy — chỉ có tiêu đề + đoạn văn + meta “Đọc trong 2 phút”, không có link, không có bài đầy đủ, không có trang chi tiết. Cả 3 thẻ sự kiện `#su-kien` đều là `<a href="#tu-van">` — nút “Xem chi tiết” không mở trang chi tiết sự kiện, không modal, không dữ liệu sự kiện riêng. 4 thẻ `#dang-cap-nhat` (“Đội ngũ chuyên gia”, “Nghiên cứu & xuất bản”, “Đối tác”, “Đánh giá & chứng nhận”) chỉ có dòng “Đang cập nhật.” + 1 câu hẹn, và tự thừa nhận chưa có cổng đăng nhập riêng.
- **Hậu quả:** người đọc bấm “Xem chi tiết” rồi bị đưa về form tư vấn mà không hiểu vì sao; blog và sự kiện trông như đã hoạt động nhưng thực ra chỉ là giao diện; nội dung hứa hẹn (“Đang cập nhật”) không có ngày hoàn thành.
- **Chi phí sửa ước lượng:** Trung bình (làm trang chi tiết thật cho sự kiện/blog, hoặc đổi nhãn nút cho trung thực và gỡ khỏi menu cho tới khi có nội dung — xem quyết định D5; giữ nguyên văn bản 3 bài blog hiện có).

### TD-14 — Nội dung lỗi thời và tên khóa cũ còn sót trong chính file

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn (đếm trực tiếp):**
  - Sự kiện: tiêu đề phần là “Lịch sự kiện sắp diễn ra” nhưng cả 3 thẻ đều gắn pill “Đã diễn ra” (chuỗi “Đã diễn ra” xuất hiện 5 lần trong file), ngày 22/05, 25/05, 28/05/2026 — đã qua hơn 5 tháng so với ngày audit 10/11/2026.
  - Tên khóa cũ còn sót: “Thấu Hiểu Bản Thân” ×3, “Khai Mở Trí Tuệ” ×1, “Kiến Tạo Nhân Hiệu” ×1. Khóa 04 “Kiến Tạo Nhân Hiệu” đã xóa khỏi lưới nhưng tên vẫn xuất hiện ở link tài nguyên “Bắt đầu tại đây” (data-course không khớp option trong form nên bấm vào không pre-select được khóa nào) và trong một câu trả lời FAQ. Tên file poster giữ số cũ (`poster-09/10/11`) cho 3 khóa mới đã đánh số lại 01–10 — cần ghi nhớ khi bảo trì, tránh nhầm file.
  - Số đếm trên 5 tab lọc (Tất cả 10 / Tâm thức 8 / Trí tuệ 4 / Nhân hiệu 3 / Cộng đồng 1) là hard-code trong HTML, trong khi dòng `#courseCount` đếm động (“Đang hiển thị X / 10 chương trình”) — hai nguồn số có thể lệch nhau khi thêm/bớt khóa.
- **Hậu quả:** trang tự mâu thuẫn trước mắt người đọc (sự kiện “sắp diễn ra” đã qua 5 tháng); người bấm link “Bắt đầu tại đây” không chọn được khóa nào, im lặng; bảo trì nhầm poster vì tên file không khớp số khóa.
- **Chi phí sửa ước lượng:** Thấp (cập nhật hoặc gỡ 3 sự kiện, dọn 5 chỗ tên khóa cũ, sửa link data-course và câu FAQ, đồng bộ số đếm tab lọc; giữ nguyên thứ tự 10 khóa 01–10 và tên khóa mới “Thấu Hiểu Nội Tâm”).

---

## 6. Nhóm E — Chức năng “giả hoạt động” và form

### TD-15 — Newsletter footer là form giả: không `<form>`, không handler

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn:** `#footEmail` chỉ xuất hiện 2 lần (dòng 4675 label, dòng 4677 input); cả file chỉ có 1 thẻ `<form>` — chính là `#consultForm` — nên footer **không có `<form>`** và không có JS nào đọc `#footEmail`. Nút “Đăng ký” dưới ô email là `<a href="#tu-van">`. Tiêu đề dải newsletter: “Đăng ký nhận thông tin từ Visfar Academy” (dòng 4671).
- **Hậu quả:** bấm “Đăng ký” chỉ cuộn tới `#tu-van`; email đã gõ bị bỏ, không lưu ở đâu; người dùng tưởng đã đăng ký nhận tin nhưng thực ra chưa. Đây là điểm giả rõ nhất trong file.
- **Chi phí sửa ước lượng:** Thấp (làm form thật ghi vào tab Sheet riêng hoặc dịch vụ email, hoặc xóa input để không đánh lừa người dùng — xem quyết định D4).

### TD-16 — Validation chỉ ở client, lệch email client/server; SĐT hẹp; không chống double-submit bằng token

- **Mức độ:** Trung bình
- **Bằng chứng từ mã nguồn:** form có `novalidate` nên validation trình duyệt bị tắt hoàn toàn; mọi kiểm tra do JS tự làm (dòng 4954–4980). Họ tên chỉ kiểm tra khác rỗng (không kiểm tra độ dài, ký tự). SĐT đúng định dạng `0 + 9 số` (`/^0\d{9}$/`, dòng tương ứng trong JS) — không kiểm tra đầu số nhà mạng, không chấp nhận +84. Email client (dòng 4964): `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — cho phép TLD 1 ký tự (`a@b.c` qua được), trong khi Apps Script server yêu cầu `\.[^\s@]{2,}$` — **lệch validation client/server**: một email qua được client có thể bị server trả `ok:false`. Tỉnh không kiểm tra có nằm trong 34 option hay không (chỉ cần `select.value` khác rỗng); phía server `province` cũng **không bắt buộc** (chỉ trim) trong khi form bắt buộc — lệch theo chiều ngược lại. Nút gửi chỉ `disabled` trong lúc gửi, không chống double-submit bằng token. Payload tự build bằng `URLSearchParams`, không dùng `FormData` (nên hidden input `source` thực ra không được gửi qua form — giá trị `source` được hard-code lại trong JS). Fetch không kiểm tra `res.ok` / HTTP status, chỉ `res.text()` → `JSON.parse` rồi xét `data.ok`.
- **Hậu quả:** người dùng nhập email hợp lệ ở client nhưng bị server từ chối mà không hiểu vì sao; số +84 bị từ chối; gửi trùng khi bấm lại (xem TD-02); dữ liệu vào Sheet thiếu tỉnh dù form bắt buộc tỉnh.
- **Chi phí sửa ước lượng:** Trung bình (đồng bộ regex email client/server với TLD tối thiểu 2 ký tự, chấp nhận +84 rồi chuẩn hóa về 0…, bắt buộc `province` ở server, thêm token chống double-submit, kiểm tra `res.ok`; giữ nguyên các field và hint “10 chữ số, bắt đầu bằng số 0”).

### TD-17 — Tìm kiếm hứa tìm “giảng viên” nhưng không có dữ liệu giảng viên

- **Mức độ:** Thấp
- **Bằng chứng từ mã nguồn:** placeholder ô tìm kiếm khóa học ghi “Tìm khóa học, giảng viên…” nhưng không có trường giảng viên nào trong dữ liệu thẻ; tìm tên giảng viên luôn ra 0 kết quả (trừ khi trùng chữ trong mô tả). Bộ lọc tìm trong toàn bộ `textContent` của thẻ và đếm “Đang hiển thị X / 10 chương trình”; `#noResult` hiện khi 0 kết quả.
- **Hậu quả:** hứa hẹn sai về khả năng tìm kiếm; người dùng tìm giảng viên tưởng không có giảng viên nào.
- **Chi phí sửa ước lượng:** Thấp (sửa placeholder cho đúng dữ liệu hiện có, hoặc bổ sung trường giảng viên vào dữ liệu khóa học; giữ nguyên logic lọc và đếm hiện tại).

---

## 7. Nhóm F — Khả năng đọc và accessibility

### TD-18 — Chữ dưới sàn 16px còn tồn tại: tuyên ngôn 13,65px ở 390px, nhãn Tam giác ~3,98px, nhãn/meta 10–14px

- **Mức độ:** Cao
- **Bằng chứng từ mã nguồn (tính từ clamp trong file, theo báo cáo phân tích):**
  - **Tuyên ngôn 1a/1b** (hero + Tuyên ngôn Triết lý): `font-size:clamp(12.5px,3.5vw,19px) !important` (dòng 3303) → **13,65px ở 390px**, 19px từ 768px trở lên. Đây là giới hạn hình học của yêu cầu “mỗi cụm đúng 1 dòng” (tối đa ~13,98px ở hero / ~14,18px ở Triết lý). User chưa chấp nhận cỡ này. Không được âm thầm tăng cỡ trong cùng hình học — chỉ có 3 lựa chọn (xem quyết định D1).
  - **Nhãn trong SVG Tam giác hiện thực:** `font-size:11.5px` (đếm trực tiếp: 1 lần khai báo này) trên viewBox 1024×891, 8 vòng, 28 `<text>` cho 24 nhãn → hiển thị **~3,98px ở 390px / 7,91 ở 768 / 10,78 ở 1024 / 14,78 ở 1440**. Chú giải chữ dưới tam giác (`.triangle-legend`) đã bị user yêu cầu bỏ ngày 10/11/2026, nên hiện không còn cách nào đọc nhãn trên điện thoại ngoài việc phóng to hình. Chú giải dưới VISFAR HOME (`.house-legend`, 16px, hiện ≤1100px) vẫn còn.
  - **Nhãn/meta/kicker nhỏ trong CSS gốc:** 191 khai báo `font-size` dưới 1rem; ví dụ `.story .who`, `.field-card .area`, `.value-card .who`, `.blog-grid .tag`, `.card .tier` 11,52px (`.72rem`); `.poster-kicker` 10,24–10,56px trên mobile; `.chapter` 12,16px ở một số nơi; `.mv-close-text` 14,08px dưới 1025px; placeholder ô tìm kiếm 14px; `.topbar` gốc 13,28px (khối audit nâng lên 15,2px). Khối audit cuối đã nâng nhiều chỗ lên sàn nhãn 14px và thân bài 16px, nhưng 14px vẫn là sàn nhãn, không phải sàn thân bài — cần audit lại từng vị trí, không kết luận “đã đạt sàn 16px” từ file.
- **Hậu quả:** người đọc khoảng 55–60 tuổi (đối tượng user đã nêu) khó đọc tuyên ngôn và nhãn sơ đồ trên điện thoại; Tam giác hiện thực — một đồ hình cốt lõi của triết lý — gần như không đọc được nhãn trên điện thoại.
- **Chi phí sửa ước lượng:** Trung bình (riêng tuyên ngôn cần quyết định của chủ dự án — D1; nhãn Tam giác cần chú giải/chế độ phóng to hoặc tách sơ đồ; các nhãn/meta nâng lên sàn 14px, thân bài giữ sàn 16px; giữ nguyên chữ tuyên ngôn và thứ tự 24 nhãn trên 8 vòng).

### TD-19 — Không có skip-link; iframe fallback có `title=""` rỗng; policy ẩn khỏi cây accessibility

- **Mức độ:** Trung bình
- **Bằng chứng từ mã nguồn:** `skip-link` / `skipLink` = 0 (đếm trực tiếp). Điểm tốt cần giữ: `lang="vi"`, 99 `aria-*`, 19 `role=`, `aria-labelledby` trên 12/13 section, `aria-label` cho từng vòng SVG, `prefers-reduced-motion` ×15, nút chạm ≥44px ở nhiều nơi. Điểm thiếu: iframe `#sheetFrame` có `title=""` rỗng (dòng 4437); policy ẩn khỏi cây accessibility cho tới khi mở; một số chữ gradient vàng trên nền ivory có tương phản thấp ở điểm sáng nhất (điểm sáng `#e8c766` chỉ chiếm dải hẹp ở góc chéo 90% của gradient 135°, đã bỏ điểm trắng `#fff6c8` giữa chữ — grep = 0).
- **Hậu quả:** người dùng bàn phím/screen-reader phải tab qua toàn bộ header/menu mới tới nội dung; iframe không tên gây nhiễu cho screen-reader; nội dung chính sách không tiếp cận được khi chưa mở bằng JS.
- **Chi phí sửa ước lượng:** Thấp (thêm skip-link “Bỏ qua tới nội dung”, đặt `title` mô tả cho iframe, mở policy thành nội dung thật — xem TD-12; giữ nguyên toàn bộ `aria-*` và hiệu ứng `prefers-reduced-motion` hiện có).

### TD-20 — Inline style còn 10 chỗ; trùng lặp nội dung liên hệ

- **Mức độ:** Thấp
- **Bằng chứng từ mã nguồn:** `style="` xuất hiện đúng 10 lần (đếm trực tiếp), ví dụ `style="font-weight:800;color:#7a5f0c"`, `style="margin-top:64px"`, `style="margin-top:10px;font-size:.86rem"` (×2), `style="width:100%"`. Ngoài ra hotline `tel:+84347897868` ×10 và email `visfaracademy@gmail.com` ×19 rải khắp HTML+JS.
- **Hậu quả:** sửa 1 giá trị hiển thị phải sửa tay nhiều chỗ; dễ sót và lệch nhau; inline style thắng cả `!important` theo cơ chế khác nên càng khó gỡ TD-05.
- **Chi phí sửa ước lượng:** Thấp (chuyển 10 inline style thành class, gom hotline/email thành 1 nguồn dùng chung; giữ nguyên màu `#7a5f0c` và các giá trị hiển thị).

---

## 8. Nhóm G — Rủi ro dữ liệu và vận hành còn lại

### TD-21 — Hàm test `testVisfar()` trong Apps Script ghi tên khóa đã bị xóa

- **Mức độ:** Trung bình
- **Bằng chứng từ mã nguồn (qua báo cáo, file `.gs` dòng 145–157):** `testVisfar()` ghi dòng test với khóa học `Kiến Tạo Nhân Hiệu` — tên khóa đã bị xóa/đổi trên trang hiện tại; nếu chạy test này sẽ ghi một dòng dữ liệu sai tên khóa vào tab thật. Chưa xác minh `testVisfar()` có từng chạy và để lại dòng test trong Sheet hay không.
- **Hậu quả:** dữ liệu test lẫn vào dữ liệu lead thật, làm sai lệch đối soát và thống kê.
- **Chi phí sửa ước lượng:** Thấp (sửa tên khóa test theo tên hiện tại hoặc tách test ra tab riêng; kiểm tra tab DATA xem có dòng test cũ không).

### TD-22 — Không có lưu trữ phiên / chống mất dữ liệu form khi tải lại trang

- **Mức độ:** Thấp
- **Bằng chứng từ mã nguồn:** `localStorage` = 0, `sessionStorage` / cookie = 0 (đếm trực tiếp `localStorage` = 0; báo cáo xác nhận cả 3 đều 0). Người dùng gõ dở form rồi tải lại trang sẽ mất toàn bộ nội dung đã nhập.
- **Hậu quả:** mất lead tiềm năng do nhập lại nản; đặc biệt với form 5 field bắt buộc (họ tên, SĐT, email, tỉnh/thành, khóa học).
- **Chi phí sửa ước lượng:** Thấp (lưu nháp form vào `sessionStorage` và khôi phục khi quay lại; không lưu PII lâu hơn phiên làm việc).

### TD-23 — Không có cơ chế cập nhật nội dung: mọi thay đổi đều là sửa tay file 5,5 MB

- **Mức độ:** Trung bình
- **Bằng chứng từ mã nguồn:** nội dung hard-code trong HTML — thêm 1 khóa học phải sửa tay lưới khóa học + option trong form + footer link + số đếm tab lọc; 4 trang chính sách không có versioning hay ngày cập nhật (hiện ghi 04/11/2026); 4 thẻ “Đang cập nhật” thừa nhận chưa có khu vực học viên, chưa có cổng đăng nhập riêng (chữ “đăng nhập” chỉ xuất hiện 1 lần trong câu thừa nhận chưa có). Chưa có gì cho tài khoản học viên, cấu trúc khóa học (module → bài học → video/tài liệu/quiz), thanh toán, quản trị hay CMS — trang hiện tại là landing page tĩnh, không phải LMS.
- **Hậu quả:** mỗi lần cập nhật nội dung là một lần sửa file khổng lồ, dễ sót chỗ (như TD-14 đã cho thấy); không thể mở rộng thành nền tảng học tập nếu giữ kiến trúc này.
- **Chi phí sửa ước lượng:** Cao (tách nội dung khỏi giao diện thành CMS/dữ liệu có cấu trúc, theo sitemap và kiến trúc 3 lớp đã đề xuất trong báo cáo phân tích; giữ nguyên toàn bộ văn bản, thứ tự và triết lý hiện có khi chuyển đổi).

---

## 9. Bảng tổng hợp nợ theo mức độ

| Mức độ | Số mục | Mã mục | Ghi chú |
|---|---|---|---|
| Nghiêm trọng | 4 | TD-01, TD-02, TD-03, TD-04 | Đều chạm tới đường thu lead duy nhất hoặc dữ liệu cá nhân — sửa trước khi chạy quảng cáo |
| Cao | 9 | TD-05, TD-06, TD-07, TD-10, TD-11, TD-12, TD-14, TD-15, TD-18 | CSS chồng chéo, SEO/cấu trúc, nội dung lỗi thời, newsletter giả, chữ dưới sàn 16px |
| Trung bình | 7 | TD-08, TD-09, TD-13, TD-16, TD-19, TD-21, TD-23 | Chủ yếu là kiến trúc, hiệu suất và validation |
| Thấp | 3 | TD-17, TD-20, TD-22 | Tìm kiếm “giảng viên”, inline style, mất nháp form khi tải lại trang |
| **Tổng cộng** | **23** | **TD-01 – TD-23** | 4 + 9 + 7 + 3 = 23 mục |

**Thứ tự ưu tiên sửa (theo báo cáo phân tích):**

1. **Trước khi chạy quảng cáo:** TD-01, TD-02, TD-03, TD-04 (Nghiêm trọng) + TD-15 (newsletter giả) + TD-14 (sự kiện lỗi thời, tên khóa cũ).
2. **Ngay sau đó:** TD-05, TD-06 (dỡ `!important` và hợp nhất khối chốt CSS — chặn đứng vòng lặp “sửa chỗ này, hỏng chỗ kia”) + TD-10, TD-11, TD-12 (h1, SEO cơ bản, chính sách có URL thật) + TD-18 (chữ dưới sàn 16px, cần quyết định D1).
3. **Theo lộ trình nền tảng:** TD-08, TD-09, TD-23 (tách file, tách nội dung khỏi giao diện) rồi mới tới tài khoản học viên, khóa học có cấu trúc, thanh toán và quản trị.

**Điểm tốt cần giữ nguyên khi sửa (không phải nợ):** 72 `id` không trùng; 0 `innerHTML`/`eval`/`document.write`/`console.log`/`alert`; `TODO/FIXME/lorem` = 0; dữ liệu người dùng được chèn bằng `textContent`/`createTextNode`; 8 link `target="_blank"` đều có `rel="noopener"`; chỉ 2 domain ngoài (`zalo.me`, `script.google.com`); favicon/apple-touch-icon là data URI, không CDN ngoài.

---

## 10. Quyết định cần chủ dự án phê duyệt

Các quyết định dưới đây **chỉ chủ dự án mới được chốt** — không tự ý quyết trong lúc sửa nợ, vì mỗi quyết định đều đổi hành vi nhìn thấy được của trang hoặc đổi kiến trúc.

| # | Quyết định | Bối cảnh (đã có trong file này) | Các phương án |
|---|---|---|---|
| D1 | Tuyên ngôn 13,65px ở 390px: chấp nhận hay bỏ yêu cầu “mỗi cụm đúng 1 dòng”? | TD-18 — `clamp(12.5px,3.5vw,19px)` cho tối đa ~13,98px ở hero / ~14,18px ở Triết lý nếu giữ 1 dòng; user chưa chấp nhận cỡ này | (a) Chấp nhận 13,65px; (b) Bỏ yêu cầu 1 dòng cho cụm 1b để lên ≥16px; (c) Thu hẹp đệm trang để đủ 16px mà vẫn 1 dòng |
| D2 | Nhánh fallback iframe: giữ, sửa văn bản, hay bỏ hẳn? | TD-01 — hiện “đã gửi” mà không có xác nhận Sheet | (a) Giữ fallback nhưng chỉ báo “đã gửi, chưa xác nhận” + mã tham chiếu; (b) Bỏ fallback, chỉ báo lỗi và hướng dẫn gửi lại; (c) Giữ nguyên văn bản hiện tại (không khuyến nghị) |
| D3 | Chống spam và chống ghi trùng cho form: chọn phương án nào? | TD-02, TD-16 — endpoint công khai, không CAPTCHA/honeypot/rate-limit/idempotency | (a) Honeypot + rate-limit server + idempotency key; (b) Thêm CAPTCHA; (c) Cả hai; kèm xác minh bản deploy Apps Script thực tế |
| D4 | Newsletter footer: làm thật hay xóa hẳn? | TD-15 — input `#footEmail` không có form, không handler; email gõ vào bị bỏ | (a) Làm thật: ghi vào tab Sheet riêng hoặc dịch vụ email; (b) Xóa input và dải newsletter khỏi footer |
| D5 | Sự kiện 05/2026 và blog/sự kiện không trang đích: cập nhật hay gỡ? | TD-13, TD-14 — 3 sự kiện đã “Đã diễn ra” hơn 5 tháng; blog không bài đầy đủ; nút “Xem chi tiết” chỉ về form | (a) Cập nhật lịch sự kiện mới + làm trang chi tiết thật; (b) Gỡ 3 sự kiện và 3 bài blog khỏi trang cho tới khi có nội dung; (c) Giữ bài/sự kiện nhưng đổi nhãn nút cho trung thực |
| D6 | Tách file single-file 5,5 MB hay giữ nguyên file đơn? | TD-08, TD-09, TD-23 — 93% base64, logo lặp, font không subset, nội dung hard-code | (a) Tách CSS/JS/ảnh/font ra file riêng, giữ nguyên giao diện và nội dung; (b) Giữ file đơn, chỉ dọn trùng lặp (logo, dead code); (c) Tách toàn diện sang CMS + kiến trúc 3 lớp theo lộ trình nền tảng |
| D7 | Khôi phục nút CTA nổi `floatCta` hay xóa code chết? | TD-07 — JS nhắc 4 lần, HTML không có phần tử; tính năng “nút CTA nổi sau 700px” vĩnh viễn không hiện | (a) Thêm phần tử `floatCta` thật (nút nổi về form tư vấn); (b) Xóa code JS liên quan; kèm dọn `[data-copy]` chết và dead CSS `.intl-*`, `#phuong-phap-giao-duc`, `#he-thong`, `.phil-subtitle` |
| D8 | Nhãn Tam giác hiện thực trên điện thoại: chấp nhận chú giải, tách sơ đồ, hay chạm để phóng to? | TD-18 — nhãn ~3,98px ở 390px; `.triangle-legend` đã bị user yêu cầu bỏ ngày 10/11/2026 | (a) Chú giải 16px dưới sơ đồ (đã có tiền lệ `.house-legend` 16px dưới VISFAR HOME); (b) Tách sơ đồ thành 2 nửa phóng to; (c) Chạm vào vòng để hiện nhãn lớn; (d) Chấp nhận hiện trạng, chỉ đọc được khi phóng to hình |

---

## 11. Ghi chú cuối

- File này là tài liệu audit của TASK 01. Mọi con số đều đếm được từ `Visfar_Academy.html` hoặc lấy từ báo cáo phân tích đã dẫn nguồn; chỗ nào ghi “chưa xác minh” thì cần test thật (POST thật, kiểm tra tab DATA, kiểm tra trên trình duyệt/thiết bị thật) trước khi kết luận.
- Không sửa code, không sửa file HTML, không tạo database, không deploy trong phạm vi file này.
- Khi sửa nợ: giữ nguyên nội dung thương hiệu, triết lý Giáo dục Tận Gốc, màu đen than – vàng gold – ivory champagne, font Be Vietnam Pro và bố cục luxury hiện có. Chỉ thay đổi cấu trúc, cách tổ chức và tính trung thực của chức năng.
