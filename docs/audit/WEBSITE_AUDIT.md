# WEBSITE AUDIT — Visfar Academy (TASK 01)

**Ngày audit:** 10/11/2026
**Đối tượng:** Trang Visfar Academy — landing page tĩnh single-file (chưa phải LMS, chưa phải ứng dụng web).
**Trạng thái file này:** Chỉ kiểm toán. Không sửa code, không sửa file HTML, không tạo database, không deploy.

## 0. Nguồn, phạm vi và cách đọc kết quả

### 0.1. Nguồn duy nhất để kiểm chứng

| # | Nguồn | Vai trò |
|---|---|---|
| 1 | `workspace/user/files/Visfar_Academy.html` | Nguồn chính — đọc trực tiếp bằng `muse.read` / `muse.exec` (grep, đếm bằng Python) trong audit này |
| 2 | `workspace/your_files/bao-cao-phan-tich-visfar-academy/Bao-cao-phan-tich-Visfar-Academy.md` | Báo cáo phân tích đã có — dùng để đối chiếu; mọi số lấy từ báo cáo này đều được ghi rõ và đã đếm lại bằng grep trong audit này, trừ khi ghi chú khác |
| 3 | `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` | File tham chiếu cho cơ chế Apps Script — chỉ dùng để đọc code `.gs`, không dùng làm bằng chứng deploy |

Không dùng thêm nguồn nào khác. Không bịa số liệu — mọi số trong file này đều đếm được từ file HTML (hoặc từ file `.gs` khi ghi rõ).

### 0.2. Dấu vân tay của file đã kiểm toán

| Hạng mục | Số liệu đếm được |
|---|---|
| File | `Visfar_Academy.html` — 5.742.754 byte (5,5 MB), 5.140 dòng theo `wc -l` / 5.141 dòng tính cả dòng cuối |
| md5 | `0328f284880efe01f672596a958715bc` (đếm lại bằng `md5sum` trong audit này, trùng báo cáo đã có) |
| Ngày file | 10/11/2026, 11:50 (theo báo cáo đã có) |
| `<section>` | 13, không trùng `id` |
| `id` | 72, 0 trùng |
| Heading | h1 = 4 (chỉ trong 4 bài chính sách ẩn), h2 = 46, h3 = 66, h4 = 5, h5 = 0, h6 = 0 |
| `<img>` | 27 — tất cả `src` đều là `data:` URI, 0 `src` ngoài |
| `<a>` | 115 (91 link nội bộ `href="#…"`, 8 link `href="https://…"`) |
| `<button>` | 19 |
| `<form>` | 1 (`#consultForm`, dòng 4332) |
| `<input>` | 6 (4 trong form + 1 ô tìm kiếm khóa học + 1 ô email footer) |
| `<select>` | 2 (`#fCity`, `#fCourse`) |
| `<details>` FAQ | 9 |

### 0.3. Quy ước nhãn xác minh (áp dụng cho mọi kết luận trong file)

- **[Xác minh bằng mã nguồn]** — đếm / đọc trực tiếp được từ file HTML (hoặc file `.gs` khi ghi rõ). Có dòng, `id`/`class` hoặc số đếm kèm theo.
- **[Chưa xác minh bằng test thật]** — kết luận cần trình duyệt thật, thiết bị thật, POST thật hoặc kiểm tra Sheet thật mới khẳng định được. File này không giả định chức năng hoạt động nếu chưa kiểm tra thực tế.

### 0.4. Kết luận tổng thể (đọc 1 phút)

Visfar Academy hiện tại là **một landing page tĩnh single-file 5,5 MB**, nội dung triết lý Giáo dục Tận Gốc đã hoàn chỉnh và nhất quán (Tâm thức – Trí tuệ – Nhân hiệu; Thập Nhất Viên Mãn; Lộ trình 6 bước), form thu lead đã có đường chạy tới Google Sheet, giao diện luxury đen than – vàng gold – ivory champagne đã được chăm chút tới từng cỡ chữ trên điện thoại.

Ba rủi ro lớn nhất, theo thứ tự ưu tiên **[xác minh bằng mã nguồn]**:

1. **Đường thu lead duy nhất có điểm mù mất lead:** nhánh fallback iframe hiện hộp "đã gửi đi" chỉ vì iframe `load`, không có xác nhận Sheet ghi xong; form chết hoàn toàn khi tắt JavaScript; endpoint công khai, không token, không CAPTCHA, không chống ghi trùng.
2. **Nợ kỹ thuật CSS tới ngưỡng nguy hiểm:** 300 lần `!important`, 4 khối `<style>` với các khối chốt cuối chồng chéo, quy tắc cũ đã chết vẫn nằm trong file (41 lần `white-space:nowrap`, nhiều rule tí hon cũ chỉ bị ghi đè nhờ vị trí cuối file + `!important`).
3. **Nhiều chức năng trông như đã hoạt động nhưng chỉ là giao diện:** nút "Đăng ký" nhận tin ở footer không gửi email đi đâu; nút "Xem chi tiết" sự kiện chỉ cuộn về form; 3 bài blog không có bài đầy đủ; 4 thẻ "Đang cập nhật" là placeholder; 3 sự kiện vẫn ghi ngày 05/2026 với pill "Đã diễn ra" dù tiêu đề là "Lịch sự kiện sắp diễn ra".

**Nguyên tắc giữ nguyên trong mọi mô tả của audit này:** không xóa nội dung thương hiệu, không thay triết lý Giáo dục Tận Gốc, không thay nhận diện màu đen than – vàng gold – ivory champagne.

---

# PHẦN 1 — KIỂM TOÁN GIAO DIỆN TỪNG PHẦN

Mỗi mục có 4 hàng: **Hiện trạng / Điểm tốt / Điểm chưa đạt / Bằng chứng** (id/class/dòng gần đúng — số dòng theo file 5.141 dòng).

## 1.1. Header

**Hiện trạng:** Header cố định gồm topbar (chỉ còn hotline + email) và thanh điều hướng chính với logo, nút menu mobile, menu 6 mục và nút CTA "Nhận lộ trình phù hợp". Có thanh tiến trình đọc `#progressBar` và nút nổi Zalo / về đầu trang. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Logo trong suốt (đã bỏ nền đỏ), chỉ giữ logo, đổ bóng nhẹ — đúng yêu cầu thương hiệu.
- Topbar gọn: chỉ hotline `034 7897 868` và email `visfaracademy@gmail.com`, đã bỏ dòng khẩu hiệu dài.
- Header có trạng thái `.scrolled` khi cuộn > 10px; nút nổi chỉ hiện khi cuộn > 240px **và** form không trong viewport **và** không mở policy — logic tránh che form đã có trong JS.
- Ảnh hero có `fetchpriority="high"`, logo header eager — ưu tiên tải đúng.

**Điểm chưa đạt:**
- Logo header và logo footer là **cùng 1 file base64 225 KB lặp lại 2 lần = 450 KB trùng lặp** trong file 5,5 MB. **[Chưa xác minh bằng test thật]** mức độ ảnh hưởng tới tốc độ hiển thị trên điện thoại thật.
- Favicon vẫn là file vuông đỏ trong khi logo đã bỏ nền đỏ — nhận diện chưa đồng nhất. **[Xác minh bằng mã nguồn]** (theo báo cáo đã có; chưa đối chiếu lại từng byte favicon trong audit này).
- Hiệu quả hiển thị logo trong suốt trên nền ivory ở điện thoại thật chưa được user xác nhận. **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `<header class="site">` dòng 3491; `.topbar` dòng 3486–3490; `#progressBar` dòng 3485; `.brand-logo` dòng 3494; nút CTA dòng 3505; JS `updateFloats` / header `.scrolled` trong script dòng 4691–5092.

## 1.2. Navigation — 6 mục, không dropdown

**Hiện trạng:** Menu chính 6 mục, mỗi mục là anchor cuộn tới đúng section: TRANG CHỦ → `#trang-chu`; GIỚI THIỆU → `#gioi-thieu`; CÁC KHÓA HỌC → `#chuong-trinh`; SỰ KIỆN → `#su-kien`; BLOG → `#blog`; KẾT NỐI → `#tu-van`. Ngoài ra có `.journey-nav` "Hành trình" với 13 link anchor tới mọi section chính, và footer nav + 4 `nav.policy-links`. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 6 mục, không dropdown, đúng định hướng đã chốt ngày 05/11/2026.
- Active menu theo section bằng `IntersectionObserver` (rootMargin `-40%/-55%`; cuộn < 120px → `trang-chu`); `#su-kien` là `<div>` trong `#blog` nhưng vẫn quan sát được.
- Menu mobile: `#menuBtn` toggle `.open` + `aria-expanded`; bấm link trong nav thì đóng menu.
- Kiểm tra anchor trong audit này: trong 20 đích nội bộ khác nhau, chỉ 4 đích thiếu `id` thật là 4 hash chính sách (xem 1.15) — mọi link menu chính đều có đích thật.

**Điểm chưa đạt:**
- Menu trỏ tới `#su-kien` trong khi `#su-kien` không phải `<section>` riêng mà là `<div>` nằm trong `#blog` (dòng 4205) — cấu trúc sitemap lệch với cảm nhận điều hướng (người dùng tưởng Sự kiện là mục độc lập). **[Xác minh bằng mã nguồn]**
- `.journey-nav` có link `#bay-phuong-dien` (dòng 3539) — đích này có tồn tại (`<div id="bay-phuong-dien">` dòng 3630), nhưng tên id dùng "bảy phương diện" trong khi nội dung là "Thập Nhất Viên Mãn – 11 phương diện": tên kỹ thuật lệch tên nội dung, dễ gây nhầm khi bảo trì. **[Xác minh bằng mã nguồn]**

**Bằng chứng:** `<nav class="main" id="mainNav">` dòng 3497–3504; `#menuBtn` dòng 3496; `.journey-nav` dòng 3533–3550; `#bay-phuong-dien` dòng 3630.

## 1.3. Trang chủ / Hero (`#trang-chu`, dòng 3509)

**Hiện trạng:** Ảnh tập thể 1334×889 đặt trên cùng, khóa khung đầy đủ không cắt; dưới là tuyên ngôn "KHAI MỞ TÂM THỨC • TU DƯỠNG ĐẠO ĐỨC / PHÁT TRIỂN TRÍ TUỆ • HOÀN THIỆN CON NGƯỜI / KIẾN TẠO THỊNH VƯỢNG" (dòng 1 tách 2 dòng con), rồi 4 đoạn nền tảng và 2 CTA ("Khám phá triết lý Visfar" → `#triet-ly`, "Tìm hiểu các chương trình →" → `#chuong-trinh`). Tiêu đề hero là `<h2>`, không có `<h1>` trên trang chính. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Hero đã phi cá nhân hóa theo đúng định hướng: ảnh nhóm ở giữa trên, không còn ảnh chân dung hay khối tên cá nhân.
- Tuyên ngôn giữ đúng nội dung, màu vàng kim tĩnh, dấu chấm ngăn cách màu vàng đậm (không còn điểm gần trắng).
- Văn bản chính căn đều 2 lề; 4 đoạn nền tảng nêu đúng triết lý lấy con người làm trung tâm.
- 2 CTA rõ ràng, 1 chính + 1 phụ, không cạnh tranh nhau.

**Điểm chưa đạt:**
- **Tuyên ngôn dòng 1a/1b chỉ 13,65px ở 390px** (`clamp(12.5px,3.5vw,19px)` → 13,65px ở 390px; 19px từ 768px trở lên) — dưới sàn thân bài 16px. Đây là giới hạn hình học của yêu cầu "mỗi cụm đúng 1 dòng" (tối đa ~13,98px ở hero). User chưa chấp nhận cỡ này. **[Xác minh bằng mã nguồn]** (công thức clamp tại dòng 3297 trở đi; giá trị tính toán đã đối chiếu với báo cáo đã có).
- Không có `<h1>` trên trang chính — tiêu đề hero là `<h2>` (dòng 3516); 4 `<h1>` duy nhất nằm trong 4 bài chính sách ẩn (dòng 4448, 4499, 4538, 4572). Ảnh hưởng SEO và screen-reader. **[Xác minh bằng mã nguồn]**
- Quy tắc ép 1 dòng cũ vẫn nằm trong file và chỉ bị ghi đè nhờ khối chốt cuối + `!important` (ví dụ `.manifesto-line2` có rule `clamp(26px,6.8vw,30px)` dòng 1407 rồi lại `clamp(24px,7vw,26px)` dòng 1692) — sửa một chỗ có thể vỡ chỗ khác. **[Xác minh bằng mã nguồn]**

**Bằng chứng:** `<section class="hero" id="trang-chu">` dòng 3509; `.hero-group-photo` dòng 3511; `<h2>` tuyên ngôn dòng 3516; `.hero-foundation` dòng 3519–3524; `.hero-cta` dòng 3525–3528.

## 1.4. Giới thiệu — Founder Lê Đăng Quyết (`#gioi-thieu`, dòng 3575)

**Hiện trạng:** Section `.cream`, tiêu đề "LÊ ĐĂNG QUYẾT", 6 đoạn văn bản của user, ảnh chân dung, cột phải chứa đoạn 1–3, đoạn 4–6 toàn chiều rộng. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Nội dung là văn bản gốc của user, không viết lại; vị trí Founder rõ ràng, ngay sau Sứ mệnh & Tầm nhìn.
- Ảnh chân dung là ảnh thật của user (174 KB base64), không phải ảnh minh họa.

**Điểm chưa đạt:**
- Section này là 1 trong 2 `<section>` **không có `aria-labelledby`** (section còn lại là hero `#trang-chu`) — 11/13 section còn lại đều có. **[Xác minh bằng mã nguồn]**
- Tên "LÊ ĐĂNG QUYẾT" xuất hiện đúng 1 lần trong toàn file (đếm chuỗi, bao gồm cả tiêu đề section) — không có khối chữ ký / chức danh lặp lại ở nơi khác để củng cố nhận diện Founder; mức độ đủ hay thiếu là quyết định của chủ dự án, audit chỉ ghi số đếm. **[Xác minh bằng mã nguồn]**

**Bằng chứng:** `<section class="cream" id="gioi-thieu">` dòng 3575 (không có `aria-labelledby`); chuỗi `LÊ ĐĂNG QUYẾT` đếm = 1.

## 1.5. Triết lý và tầm nhìn

### 1.5.1. Sứ mệnh & Tầm nhìn (`#su-menh-tam-nhin`, dòng 3552)

**Hiện trạng:** 2 thẻ Sứ mệnh / Tầm nhìn xếp dọc, toàn chiều rộng, Sứ mệnh trên, Tầm nhìn dưới; khung trắng viền vàng đôi; tiêu đề thẻ 32px; tiêu đề lớn và tiêu đề 2 thẻ dùng gradient vàng tĩnh trải đều từng dòng, không animation. Dòng in đậm mở đầu Sứ mệnh đã xóa hẳn (chỉ còn ở hero và Tuyên ngôn triết lý). **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Bố cục mở, đã bỏ khung hai thẻ cứng nhắc; đọc rõ trên nền ivory champagne; đúng văn bản user gửi.
- Gradient vàng tĩnh, không animation — đúng chuẩn đã chốt ngày 05/11/2026.

**Điểm chưa đạt:**
- Không phát hiện lỗi hiển thị từ mã nguồn ở mục này; tuy nhiên kích thước/độ tương phản thực tế trên điện thoại thật chưa được đo bằng render. **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `<section id="su-menh-tam-nhin" aria-labelledby="missionVisionTitle">` dòng 3552; `.mv-grid` / `.mv-card` dòng 3558 trở đi.

### 1.5.2. Triết lý Giáo dục Tận Gốc (`#triet-ly`, dòng 3603)

**Hiện trạng:** Một phần hợp nhất gồm 6 mục: (1) Tư tưởng cốt lõi, (2) Quan niệm giáo dục, (3) Hệ thống giáo dục — Thập Nhất Viên Mãn (11 phương diện), (4) Mục tiêu giáo dục (4 dòng LÀM GIÀU / LÀM CHỦ / TRỞ NÊN / TRỞ THÀNH — đúng văn bản user), (5) Nguyên tắc giáo dục, (6) Đích đến giáo dục; kèm hộp "NHÂN TỐT + DUYÊN LÀNH = QUẢ NHƯ Ý", đồ hình VISFAR HOME, Tam giác hiện thực SVG 8 lớp / 24 nhãn tương tác, và Tuyên ngôn triết lý 3 dòng vàng kim tĩnh. `#lo-trinh` nằm trong `#triet-ly` về mặt DOM (ngay sau thẻ 11 VẬT CHẤT, trước mục 4 Mục tiêu giáo dục). **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Nội dung triết lý đầy đủ, nhất quán, giữ nguyên văn bản và thứ tự đã chốt; 4 dòng Mục tiêu giáo dục là đúng văn bản user.
- Hộp "NHÂN TỐT + DUYÊN LÀNH = QUẢ NHƯ Ý" có chú thích cuối rút gọn đúng yêu cầu.
- Tiêu đề "TRIẾT LÝ GIÁO DỤC TẬN GỐC" đúng 1 dòng; 11 tiêu đề thẻ chỉ còn số và tên phương diện.
- Tuyên ngôn triết lý 3 dòng vàng kim tĩnh, dòng 1 tách 2 dòng con như hero.

**Điểm chưa đạt:**
- **Tuyên ngôn triết lý dòng 1 cũng chỉ 13,65px ở 390px** (cùng công thức `clamp(12.5px,3.5vw,19px)`) — cùng vấn đề như hero, user chưa chấp nhận. **[Xác minh bằng mã nguồn]**
- `#lo-trinh` là `<section>` riêng nhưng nằm **bên trong** `#triet-ly` về mặt DOM — cấu trúc lồng section trong section gây khó cho sitemap, SEO và bảo trì (xem thêm 1.6). **[Xác minh bằng mã nguồn]**
- CSS chết: `#phuong-phap-giao-duc`, `#he-thong` xuất hiện 5 lần trong CSS nhưng có **0 `id`** tương ứng trong HTML; `.phil-subtitle` 2 lần trong CSS, 0 phần tử. **[Xác minh bằng mã nguồn]** (số đếm theo báo cáo đã có; đã đối chiếu mẫu bằng grep trong audit này).

**Bằng chứng:** `<section id="triet-ly" aria-labelledby="philosophyTitle">` dòng 3603; `#philosophyTitle` dòng ~3605; các `.phil-h` mục 4/5/6 tại dòng 3739, 3750, 3763; Tuyên ngôn triết lý dòng 3770.

### 1.5.3. Thập Nhất Viên Mãn — 11 phương diện (`#bay-phuong-dien`, dòng 3630)

**Hiện trạng:** 11 thẻ phương diện trong `#triet-ly`, tiêu đề `#lampsTitle` "THẬP NHẤT VIÊN MÃN – 11 PHƯƠNG DIỆN PHÁT TRIỂN CON NGƯỜI" (dòng 3631), đủ 11 phương diện theo thứ tự đã chốt. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 11 phương diện, tiêu đề thẻ chỉ còn số và tên, không còn cách gọi "khu vực" kèm số.
- Đồ hình VISFAR HOME (WebP 484 KB base64, 1696×1472) và chú giải `.house-legend` 16px hiện ở màn hình ≤ 1100px — còn đường đọc chữ trên điện thoại cho đồ hình nhà.

**Điểm chưa đạt:**
- Tên `id="bay-phuong-dien"` ("bảy phương diện") lệch với nội dung "Thập Nhất" (11 phương diện) — tên kỹ thuật cũ chưa đổi theo nội dung, dễ nhầm khi bảo trì. **[Xác minh bằng mã nguồn]**
- Nội dung một số thẻ (ví dụ thân bài thẻ Lĩnh vực 03 "Mối quan hệ" và văn bản bước Lộ trình số 2 "Tin") là do builder viết, chưa được user duyệt — audit ghi nhận theo báo cáo đã có, chưa đối chiếu từng câu với văn bản gốc của user trong audit này. **[Chưa xác minh bằng test thật / chưa đối chiếu văn bản gốc]**

**Bằng chứng:** `<div id="bay-phuong-dien">` dòng 3630; `#lampsTitle` dòng 3631; `.house-legend` dòng 3271–3274 (CSS) và 3637 (HTML).

### 1.5.4. Tam giác hiện thực — SVG 8 lớp / 24 nhãn

**Hiện trạng:** SVG tương tác 8 vòng (`.tri-ring`, 27 lần xuất hiện chuỗi trong file gồm CSS + HTML + JS), 28 `<text>` cho 24 nhãn; thứ tự vòng 3–8 đã sắp lại theo quy tắc "từ đầu ở dưới trái, từ giữa ở trên giữa, từ cuối ở dưới phải": vòng 3 Nghiệp thức / Nghiệp duyên / Nghiệp quả; vòng 4 Nhân / Duyên / Quả; vòng 5 Khái niệm nguồn / Trạng thái nội tâm / Hình ảnh tâm trí; vòng 6 Thân / Tâm / Tuệ; vòng 7 Đạo lý / Tôn giáo / Khoa học; vòng 8 Nhân sinh quan / Vũ trụ quan / Thế giới quan; vòng 1–2 không đổi. Hover/chạm/focus một vòng thì vòng đó `.is-active`, 7 vòng còn lại mờ, vòng được chọn đưa lên trên cùng bằng `appendChild`; mouseleave/focusout/click ngoài/Escape thì khôi phục thứ tự gốc. Chú thích "TAM GIÁC HIỆN THỰC" cùng cỡ với "VISFAR HOME". **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Tương tác đầy đủ cả chuột, bàn phím (focus) và chạm; có `aria-label` cho từng vòng; có xử lý Escape và khôi phục thứ tự gốc.
- Chữ trong SVG đã tăng từ 6.5px lên 11.5px và đã bỏ viền trắng (theo báo cáo đã có).

**Điểm chưa đạt:**
- **Nhãn trong SVG chỉ ~3,98px ở 390px** (`font-size:11.5px` trên viewBox 1024×891 → 3,98px ở 390px / 7,91 ở 768 / 10,78 ở 1024 / 14,78 ở 1440) — dưới mọi sàn đọc. Chú giải chữ dưới tam giác (`.triangle-legend`) đã bị user yêu cầu bỏ ngày 10/11/2026 (grep = 0 lần trong file), nên hiện không còn cách nào đọc nhãn trên điện thoại ngoài việc phóng to hình. Đây là giới hạn hình học của 8 vòng đồng tâm, không sửa được bằng tăng cỡ chữ trong cùng hình học. **[Xác minh bằng mã nguồn]** (công thức và số đo theo báo cáo đã có; chuỗi `.triangle-legend` đếm lại = 0 trong audit này).
- Hành vi tương tác từng vòng mới chỉ xác minh ở mức mã nguồn — user vẫn cần test live từng vòng trên desktop và điện thoại. **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `.tri-ring` 27 lần xuất hiện (CSS + HTML + JS); `<text>` 28; hàm `activate` / `deactivate` / `restoreOrder` trong script dòng 4691–5092; `.triangle-legend` = 0 lần.

## 1.6. Lộ trình 6 bước (`#lo-trinh`, dòng 3718)

**Hiện trạng:** 6 bước — 1 Biết (Xác lập khái niệm), 2 Tin (Tin vào khái niệm), 3 Hiểu (Rõ hình trong đầu), 4 Thấu suốt (Đặt câu hỏi đúng), 5 Chuyển hóa (Mong muốn đủ lớn), 6 Huân tập và quảng bá — 6 thẻ, 1 hàng 6 cột trên desktop → 3 cột ≤ 1100px → 1 cột ≤ 700px. Khối 3 thẻ nhóm trong phần Lộ trình đã bỏ. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 6 bước, đúng thứ tự và tên bước đã chốt; bố cục 1 hàng 6 cột desktop rõ ràng.
- Tiêu đề `#roadmapTitle` đã về cỡ đọc được: `clamp(26px,4.5vw,34px)` → 26px ở 390px (trước đây rule cũ `clamp(6.5px,2.02vw,12.5px)` cho 7,88px ở 390px nếu không có khối audit cuối). **[Xác minh bằng mã nguồn]**

**Điểm chưa đạt:**
- Vị trí DOM: `<section id="lo-trinh">` nằm **bên trong** `<section id="triet-ly">` (dòng 3718, trước mục 4 Mục tiêu giáo dục dòng 3739) — section lồng section, sitemap và outline HTML bị lệch (xem 1.5.2). **[Xác minh bằng mã nguồn]**
- Rule cũ `clamp(6.5px,2.02vw,12.5px)` vẫn nằm trong file — thứ tự thắng hiện tại phụ thuộc hoàn toàn vào vị trí cuối file + `!important`, không phải thứ tự logic. **[Xác minh bằng mã nguồn]**
- Văn bản bước 2 "Tin" là do builder viết, chưa được user duyệt (theo báo cáo đã có). **[Chưa xác minh bằng test thật / chưa đối chiếu văn bản gốc]**
- Viền ngang (horizontal outline) của 6 thẻ Lộ trình chưa được vẽ lại sau khi bỏ viền dọc — 6 thẻ hiện chỉ có viền ngang đơn, không có outline ngang như 3 loại thẻ khác; đang chờ verdict của user (theo báo cáo đã có). **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `<section id="lo-trinh" aria-labelledby="roadmapTitle">` dòng 3718; `.steps` dòng 3727; 6 `.step` dòng 3728–3733; `#roadmapTitle` rule cũ và rule chốt cuối (đối chiếu bằng grep `clamp(6.5px` và `clamp(26px,4.5vw,34px)`).

## 1.7. Lĩnh vực đào tạo — 6 lĩnh vực (`#linh-vuc`, dòng 3779)

**Hiện trạng:** 6 thẻ `.field-card`: Nội tâm, Sức khỏe, Mối quan hệ, Tài chính, Tổ chức trường tồn, Cộng đồng tinh hoa. Tiêu đề 6 thẻ cùng cỡ chữ; thiết kế luxury chỉ bằng CSS, không đổi chữ hay thứ tự. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 6 lĩnh vực, tiêu đề thẻ đã thống nhất một cỡ (18,4px theo báo cáo đã có); thẻ trắng viền vàng, hover nâng `translateY(-3px)` chuẩn toàn trang.
- Nội dung 6 lĩnh vực là cầu nối trực tiếp sang 3 khóa mới 04–06 (Sức khỏe / Mối quan hệ / Tài chính).

**Điểm chưa đạt:**
- Thân bài thẻ Lĩnh vực 03 "Mối quan hệ" là do builder viết, chưa được user duyệt (theo báo cáo đã có). **[Chưa xác minh bằng test thật / chưa đối chiếu văn bản gốc]**
- Một số nhãn/phụ đề trong CSS gốc vẫn ở cỡ nhỏ (ví dụ `.field-card .area` ~11,52px theo báo cáo đã có) — khối audit cuối đã nâng nhiều chỗ lên sàn nhãn 14px, nhưng 14px vẫn là sàn nhãn, không phải sàn thân bài; cần audit lại từng vị trí, không kết luận "đã đạt sàn 16px" từ file. **[Xác minh bằng mã nguồn một phần; chưa xác minh bằng render thật]**

**Bằng chứng:** `<section id="linh-vuc" aria-labelledby="fieldsTitle">` dòng 3779; 6 `<article class="field-card reveal">` dòng 3789, 3796, 3803, 3810, 3817, 3824; `#fieldsTitle` rule chốt `clamp(26px,4.2vw,46px)`.

## 1.8. Chương trình — 10 khóa 01–10 (`#chuong-trinh`, dòng 3840)

**Hiện trạng:** 10 khóa theo thứ tự DOM 01–10: 01 Thấu Hiểu Nội Tâm (miễn phí), 02 Thấu Hiểu Tâm Thức, 03 Thấu Hiểu Trí Tuệ, 04 Thấu Hiểu Sức Khỏe, 05 Thấu Hiểu Mối Quan Hệ, 06 Thấu Hiểu Tài Chính, 07 Chuyên gia tư vấn và huấn luyện tâm thức (5 ngày, trực tuyến, học phí Tùy tâm, full-width, poster banner 21:9), 08 Master Tâm thức & Nhân hiệu, 09 Coaching 90 ngày đồng hành, 10 Cộng đồng Visfar. Có ô tìm kiếm (placeholder "Tìm khóa học, giảng viên…"), 5 tab lọc (Tất cả 10 / Tâm thức 8 / Trí tuệ 4 / Nhân hiệu 3 / Cộng đồng 1 — số đếm hard-code trong HTML), dòng `#courseCount` đếm động "Đang hiển thị X / 10 chương trình", nút "Xem chi tiết khóa học" mở rộng từng thẻ (đóng mặc định). Mỗi thẻ gồm poster đỏ – vàng kim 1600×900 vẽ bằng code (tên khóa là chữ HTML thật phủ trên poster), pill trụ cột, tiêu đề, dòng phụ, mô tả ngắn, nút tư vấn về `#tu-van`. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 10 khóa, đúng thứ tự 01–10 đã chốt ngày 10/11/2026; khóa 01 đã đổi tên từ "Thấu Hiểu Bản Thân" thành "Thấu Hiểu Nội Tâm" đồng bộ ở poster, tiêu đề thẻ, `data-course`, option form và footer link.
- Tìm kiếm + lọc hoạt động ở mức mã nguồn: `norm()` bỏ dấu/diacritics, `đ→d`; lọc theo `data-cat` + tìm trong toàn bộ `textContent` của thẻ; `#noResult` hiện khi 0 kết quả.
- Toggle chi tiết 10× `.prog-toggle` đổi `aria-expanded` và nhãn "Xem chi tiết khóa học" ↔ "Thu gọn chi tiết".
- Pre-select khóa học từ CTA: 15× `[data-course]` so sánh `option.text`/`value` sau khi chuẩn hóa khoảng trắng.

**Điểm chưa đạt:**
- **Tên khóa cũ còn sót:** "Thấu Hiểu Bản Thân" ×3, "Khai Mở Trí Tuệ" ×1, "Kiến Tạo Nhân Hiệu" ×1 — ở link tài nguyên "Bắt đầu tại đây" (dòng 4201, `data-course="Thấu Hiểu Bản Thân (miễn phí)"` không khớp option mới "Thấu Hiểu Nội Tâm (miễn phí)" → bấm vào không pre-select được khóa nào, im lặng) và trong 1 câu trả lời FAQ (dòng 4284). Khóa 04 "Kiến Tạo Nhân Hiệu" đã xóa khỏi lưới nhưng tên vẫn xuất hiện ở các chỗ đó. **[Xác minh bằng mã nguồn]**
- **Tên file poster giữ số cũ** cho 3 khóa mới (`poster-09/10/11`) cho khóa 04/05/06 mới — không đổi theo số mới, cần ghi nhớ khi bảo trì, tránh nhầm file. **[Xác minh bằng mã nguồn]** (theo báo cáo đã có).
- Số đếm trên 5 tab lọc là hard-code trong HTML, trong khi `#courseCount` đếm động — hai nguồn số có thể lệch nhau nếu thêm/bớt khóa mà chỉ sửa một chỗ. **[Xác minh bằng mã nguồn]**
- Placeholder tìm kiếm hứa "Tìm khóa học, giảng viên…" nhưng không có trường giảng viên nào trong dữ liệu thẻ — tìm tên giảng viên luôn ra 0 kết quả (trừ khi trùng chữ trong mô tả). **[Xác minh bằng mã nguồn]**
- 10/27 ảnh có `alt=""` — toàn bộ là poster khóa học. Vì tên khóa đã là chữ HTML phủ trên poster nên `alt=""` có thể coi là đúng cho ảnh trang trí; nhưng nếu poster lỗi tải, người dùng mất hoàn toàn ngữ cảnh khóa học. **[Xác minh bằng mã nguồn]**
- Nội dung 3 thẻ khóa học 09/10/11 (theo số cũ; nay là 04/05/06) lấy từ Lĩnh vực 02/03/04, do builder viết, chưa được user duyệt. **[Chưa xác minh bằng test thật / chưa đối chiếu văn bản gốc]**
- Tiêu đề `#coursesTitle`: rule cũ `clamp(10.2px,3.2vw,12.8px)` → 12,48px ở 390px vẫn nằm trong file, chỉ bị ghi đè bởi rule chốt `clamp(25px,3.4vw,38px)` → 25px ở 390px. **[Xác minh bằng mã nguồn]**

**Bằng chứng:** `<section class="cream" id="chuong-trinh" aria-labelledby="coursesTitle">` dòng 3840; `#courseGrid` dòng 3861; 10 `.prog-card` dòng 3862–4033 (`data-num="01"`–`"10"`); ô tìm kiếm dòng 3850; 5 tab (`.tab` ×5); link cũ dòng 4201; FAQ dòng 4284; option form dòng 4392.

## 1.9. Doanh nghiệp (`#doanh-nghiep`, dòng 4065)

**Hiện trạng:** Tiêu đề "Khi đội ngũ cùng nhìn một hướng, văn hóa tự thành hình", 3 thẻ giải pháp (trong đó có "Diễn giả và hội thảo", dòng 4075) + ảnh DSC03023 (ảnh gốc của user, 1334×889, 246 KB base64). Tiêu đề phần đã về 1 dòng ở cỡ đọc được. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Ảnh doanh nghiệp là ảnh thật của user, không phải ảnh minh họa; 3 thẻ giải pháp rõ ràng, đúng định hướng "AI và Marketing là ứng dụng mở rộng, không phải cốt lõi".
- Ảnh mới ở phần doanh nghiệp là ảnh minh họa được tạo ra (không phải ảnh thật của Visfar) vì không có ảnh cộng đồng thật phù hợp trong thư viện user — audit ghi nhận theo báo cáo đã có, user là người quyết định cuối về tính xác thực hình ảnh. **[Chưa xác minh bằng test thật]**

**Điểm chưa đạt:**
- `#bizTitle`: rule cũ `clamp(10px,3.15vw,12.6px)` vẫn nằm trong file, chỉ bị ghi đè bởi rule chốt `clamp(25px,3.2vw,36px)`. **[Xác minh bằng mã nguồn]**
- Không phát hiện thêm lỗi nội dung từ mã nguồn ở mục này.

**Bằng chứng:** `<section class="cream" id="doanh-nghiep" aria-labelledby="bizTitle">` dòng 4065; `#bizTitle` các rule `clamp(10px,3.15vw,12.6px)` và `clamp(25px,3.2vw,36px)`.

## 1.10. Học viên nói — Testimonial (`#chia-se`, dòng 4089)

**Hiện trạng:** Tiêu đề "Học viên nói bằng trải nghiệm của họ", lưới 8 testimonial (`.testimonial-grid`, 2 cột desktop → 1 cột ≤ 880px), mỗi người có tên, chức danh, ảnh đại diện. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 8 học viên thật, user đã xác nhận cho phép đăng lời chia sẻ: Trần Thị Thu Hằng (CEO FutureTech Solutions), Lê Hoàng Nam (Founder & Coach tại Mindset Mastery), Nguyễn Minh Khoa (Giám đốc điều hành Infinity Group), Đỗ Bảo Anh (Chuyên gia đào tạo & phát triển lãnh đạo), Võ Đức Huy (CTO NextGen Solutions), Phạm Thanh Trúc (CMO Elite Branding), Lương Khánh Vy (Chuyên gia tâm lý & phát triển bản thân), Nguyễn Hoàng Ánh (Giám đốc sáng tạo tại VisionArt Studio). Mỗi tên xuất hiện 2 lần trong section (tên hiển thị + `alt` ảnh). Ảnh Nguyễn Hoàng Ánh đã thay bằng ảnh riêng mới, hết trùng ảnh Đỗ Bảo Anh.
- Ảnh chân dung hiển thị 84px nhưng file 40–182 KB PNG (Nguyễn Hoàng Ánh 182 KB, lớn nhất) — chất lượng ảnh tốt, chỉ nặng file.

**Điểm chưa đạt:**
- Không phát hiện lỗi nội dung từ mã nguồn ở mục này; tính xác thực lời chia sẻ dựa trên xác nhận của user, audit không độc lập xác minh từng lời chia sẻ với học viên. **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `<section id="chia-se" aria-labelledby="voicesTitle">` dòng 4089; `#voicesTitle` dòng 4094; `.testimonial-grid` dòng 4098; 8 tên, mỗi tên đếm = 2 trong section dòng 4089–4186.

## 1.11. Blog (`#blog`, dòng 4186) — 3 bài ngắn

**Hiện trạng:** 3 `<article>`: "Rõ hình là ra quả" (Tâm thức), "Nhân tốt, duyên lành, quả như ý" (Trí tuệ), "Ngôi nhà Visfar — 11 phương diện trong 1 căn phòng" (Nhân hiệu); mỗi bài chỉ có tiêu đề + đoạn văn + meta "Đọc trong 2 phút", không có link, không có bài đầy đủ, không có trang chi tiết. `#su-kien` nằm bên trong `#blog`. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- 3 bài đúng 3 trụ cột Tâm thức – Trí tuệ – Nhân hiệu; văn phong ngắn, đúng định hướng "ba bài viết ngắn, cho sự thay đổi thật".

**Điểm chưa đạt:**
- Blog chỉ là giao diện: 3 bài không có bài đầy đủ, không có link tới trang chi tiết, không có trang con. Người đọc bấm vào không đi đâu được. **[Xác minh bằng mã nguồn]**
- 3 bài blog là do builder viết, chưa được user duyệt (theo báo cáo đã có). **[Chưa xác minh bằng test thật / chưa đối chiếu văn bản gốc]**

**Bằng chứng:** `<section class="cream" id="blog" aria-labelledby="blogTitle">` dòng 4186; `.blog-grid` dòng 4195; 3 `<article>` dòng 4196–4198.

## 1.12. Sự kiện — 3 thẻ 22/25/28-05-2026 (`#su-kien`, dòng 4205)

**Hiện trạng:** `<div id="su-kien">` nằm trong `#blog` (không phải `<section>` riêng), gồm 3 thẻ `.ev-card`: 22/05/2026 "Live: Cách viết content không cần cảm hứng", 25/05/2026 "Workshop: 5 dạng niềm tin giới hạn thu nhập", 28/05/2026 "Buổi hỏi đáp tháng 5 với Founder"; cả 3 đều pill "Đã diễn ra", nút "Xem chi tiết" đều là `<a href="#tu-van">`; 3 ảnh sự kiện đã chuẩn hóa 1200×750, 16/10, 136–168 KB; dưới lưới có dòng "Lịch sự kiện đang được cập nhật" (dòng 4262). **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- 3 ảnh sự kiện đã đồng nhất kích thước 1200×750; ảnh thẻ Workshop đã thay bằng đúng ảnh user gửi (giảng viên nam vest xanh thuyết trình trước lớp học viên Việt Nam); thẻ trắng viền vàng đôi, nhãn và pill "Đã diễn ra" nền champagne viền vàng, tiêu đề gradient vàng kim tĩnh, nút "Xem chi tiết" vàng kim, lưới cao bằng nhau.

**Điểm chưa đạt:**
- **Nội dung lỗi thời / mâu thuẫn:** tiêu đề phần là "Lịch sự kiện sắp diễn ra" nhưng cả 3 thẻ đều pill "Đã diễn ra", ngày 22/05, 25/05, 28/05/2026 — đã qua hơn 5 tháng so với 10/11/2026. Chuỗi "Đã diễn ra" xuất hiện 5 lần trong file (3 trong thẻ + 2 trong CSS). **[Xác minh bằng mã nguồn]**
- **Nút "Xem chi tiết" giả:** cả 3 thẻ đều là `<a href="#tu-van">` — không có trang chi tiết sự kiện, không modal, không dữ liệu sự kiện riêng; bấm chỉ cuộn về form tư vấn. **[Xác minh bằng mã nguồn]**
- Viền ngang (horizontal outline) của 3 thẻ Sự kiện chưa được vẽ lại sau khi bỏ viền dọc — như 6 thẻ Lộ trình, đang chờ verdict của user (theo báo cáo đã có). **[Chưa xác minh bằng test thật]**
- 3 ảnh sự kiện vẫn chờ user kiểm tra trên trang thật (theo báo cáo đã có). **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `<div id="su-kien" style="margin-top:64px">` dòng 4205; 3 `.ev-card` dòng 4215, 4230, 4245; 3 `.ev-title` dòng 4224, 4239, 4254; mỗi ngày 22/05, 25/05, 28/05/2026 đếm = 1; "Xem chi tiết" trong `#su-kien` đếm = 3, đều trỏ `#tu-van`.

## 1.13. FAQ (`#faq`, dòng 4274)

**Hiện trạng:** 9 `<details>/<summary>` với câu hỏi thường gặp, bao gồm: bắt đầu từ đâu, triết lý giáo dục tận gốc là gì, Biết — Hiểu — Thấu suốt — Chuyển hóa là gì, "khái niệm nguồn" / "tam giác hiện thực" có phải thuật ngữ khoa học không, Nhân — Duyên — Quả áp dụng ra sao, chương trình có mang tính tôn giáo không, AI và Marketing có phải trọng tâm không, hình thức học và học phí, doanh nghiệp muốn đào tạo riêng thì liên hệ thế nào. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 9 câu hỏi, trả lời đúng định hướng đã chốt: AI/Marketing chỉ là ứng dụng mở rộng, trọng tâm là Tâm thức – Trí tuệ – Nhân hiệu; các thuật ngữ được giải thích rõ không phải thuật ngữ khoa học; chương trình không mang tính tôn giáo.
- Dùng `<details>` native — hoạt động cả khi JavaScript có lỗi (trừ style `.reveal` phụ thuộc JS, xem 2.2).

**Điểm chưa đạt:**
- Câu trả lời "bắt đầu từ đâu" vẫn còn tên khóa cũ "Thấu Hiểu Bản Thân" (dòng 4284) — 1 trong 3 lần xuất hiện của tên cũ trong file; cần đồng bộ thành "Thấu Hiểu Nội Tâm" nếu user quyết định đổi cả 2 chỗ còn sót. **[Xác minh bằng mã nguồn]**
- Khung thời gian chính sách trong các bài chính sách liên quan (hoàn trả 3/7/15 ngày làm việc; khiếu nại 3/15/30 ngày làm việc) là do builder viết, chưa được user duyệt (theo báo cáo đã có). **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `<section id="faq" aria-labelledby="faqTitle">` dòng 4274; 9 `<details>`; câu trả lời dòng 4284 chứa "Thấu Hiểu Bản Thân".

## 1.14. Form tư vấn (`#tu-van`, dòng 4315)

**Hiện trạng:** Form `#consultForm` (dòng 4332, `novalidate`) với 5 trường bắt buộc: Họ và tên `#fName` (text, `autocomplete="name"`, placeholder "Nguyễn Văn A"), SĐT `#fPhone` (tel, `inputmode="tel"`, hint "10 chữ số, bắt đầu bằng số 0"), Email `#fEmail` (email), Tỉnh/TP `#fCity` (select, 1 placeholder disabled + 34 tỉnh/thành, tổng 35 `<option>`), Khóa học `#fCourse` (select, 1 placeholder + 12 lựa chọn = 13 `<option>`: 10 khóa 01–10 + "Doanh nghiệp…" + "Chưa biết bắt đầu từ đâu…"); kèm hidden `source=visfar-academy`; nút submit "Đăng ký tham gia" rộng 100%; khối liên hệ (điện thoại, email, tổ chức đào tạo Visfar Academy) đặt cạnh form; ghi chú "Trang cảm ơn chỉ hiện sau khi hệ thống xác nhận đã ghi nhận." (dòng 4408). Chi tiết kỹ thuật đầy đủ ở Phần 2.4. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ 5 trường cần thiết, có `autocomplete`, có hint SĐT rõ ràng, có label gắn đúng `for`/`id`.
- Ghi chú trong form nói đúng cơ chế nhánh fetch chính (cảm ơn chỉ hiện khi `data.ok === true`).
- Màn hình cảm ơn cá nhân hóa theo tên và khóa học, có nút tham gia nhóm Zalo và Zalo hỗ trợ, nút "Đăng ký thêm" reset form.

**Điểm chưa đạt:**
- `novalidate` tắt hoàn toàn validation của trình duyệt; mọi kiểm tra do JS tự làm; không có textarea ghi chú, không checkbox đồng ý điều khoản, không CAPTCHA, không honeypot, không upload biên lai.
- Validation lệch client/server: email client cho phép TLD 1 ký tự (`a@b.c` qua được), server yêu cầu TLD tối thiểu 2 ký tự — email qua được client có thể bị server trả `ok:false`. SĐT chỉ chấp nhận `0 + 9 số`, từ chối +84. Tỉnh không kiểm tra có nằm trong 34 option hay không.
- Nhánh fallback iframe hiện "đã gửi" mà không có xác nhận Sheet (xem 2.4) — điểm mù mất lead duy nhất còn lại.
- Dữ liệu cá nhân (họ tên + SĐT + email + tỉnh + khóa học) được đưa vào `mailto:` và clipboard ở hộp dự phòng `#formOk` (xem 2.8).
- Form chết hoàn toàn khi tắt JavaScript: không có `action`, không có `method`. **[Xác minh bằng mã nguồn]**

**Bằng chứng:** `<section class="form-section cream" id="tu-van" aria-labelledby="formTitle">` dòng 4315; `<form id="consultForm" novalidate>` dòng 4332; các field dòng 4333–4406; `#formOk` dòng 4409–4418; `#thankYou` dòng 4420–4436; `<iframe id="sheetFrame">` dòng 4437.

## 1.15. Trang con chính sách — `#policyView` (dòng 4443)

**Hiện trạng:** 4 "trang con" chính sách mở bằng hash trong cùng trang: bảo mật, điều khoản tham gia, hoàn trả/hủy đăng ký, giải quyết khiếu nại; mỗi bài có `<h1>` riêng (dòng 4448, 4499, 4538, 4572); mỗi bài có `nav.policy-links` (4 lần, dòng 4486, 4525, 4559, 4598); đã điền tên doanh nghiệp "Tổ chức đào tạo Visfar Academy", SĐT 0347875229, email visfaracademy@gmail.com; ngày cập nhật ghi 04/11/2026 (theo báo cáo đã có). **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Đủ toàn văn 4 chính sách; 4 link footer đã bấm thử và mở đúng trang con trong cùng trang (theo báo cáo đã có).

**Điểm chưa đạt:**
- **Hash không có đích thật:** link `href="#chinh-sach-bao-mat"`… (4 link) không có phần tử nào mang `id` đó — đích thật là `id="page-bao-mat"`… + `data-policy`; chỉ chạy nhờ `renderPolicy()` bắt `hashchange`. Không JS, không chia sẻ link trực tiếp, bot/crawler đều không tới được. Đây là 4 đích nội bộ duy nhất thiếu `id` thật trong toàn file (kiểm tra anchor trong audit này). **[Xác minh bằng mã nguồn]**
- Khối liên hệ chính sách lặp nguyên văn 4 lần — sửa 1 số điện thoại phải sửa 4 chỗ. **[Xác minh bằng mã nguồn]**
- Địa chỉ trụ sở, mã số thuế, số/ngày cấp đăng ký kinh doanh chưa được cung cấp — không được bịa; không thêm logo hay khẳng định đã thông báo/đăng ký với Bộ Công Thương. **[Xác minh bằng mã nguồn]** (ghi nhận theo MEMORY / báo cáo đã có).
- Policy ẩn khỏi cây accessibility cho tới khi mở; 4 `<h1>` chính sách vì thế vô hình với SEO. **[Xác minh bằng mã nguồn một phần; chưa xác minh bằng test thật với screen-reader]**

**Bằng chứng:** `<div class="policy-view" id="policyView" aria-live="polite">` dòng 4443; 4 `<h1>` dòng 4448, 4499, 4538, 4572; 4 `href="#chinh-sach-…"`; 4 `id="page-…"`; hàm `renderPolicy` trong script dòng 5093–5138.

## 1.16. Footer (dòng 4613)

**Hiện trạng:** Footer gồm: cột brand (logo + khẩu hiệu "Hiểu mình, sáng trí, dựng hiệu." — theo MEMORY, cột 1 nay chỉ còn logo đỏ vuông và khẩu hiệu), các cột link "Về Visfar Academy" và "Khóa học" (10 khóa, link đều về `#chuong-trinh`), các cột liên hệ/chính sách, khối giới thiệu toàn chiều rộng ngay dưới lưới 5 cột (đoạn giới thiệu + dòng "Cộng đồng: Cộng đồng VISFAR"), dải đăng ký nhận thông tin (newsletter), thanh cuối chỉ "Copyright 2026 © Visfar Academy." Cụm giới thiệu thuộc hệ sinh thái đã bỏ khỏi toàn bộ website (11/11/2026). `.foot-grid` 5 cột → 2 cột ≤ 960px → 1 cột ≤ 560px (theo báo cáo đã có). **[Xác minh bằng mã nguồn một phần]**

**Điểm tốt:**
- Footer luxury đen – vàng gold, bỏ khung vuông quanh logo chân trang, chỉ còn quầng sáng vàng mềm; logo header không đổi.
- Khối giới thiệu toàn chiều rộng đã chuyển xuống dưới lưới 5 cột, trên dải newsletter và thanh Copyright; chữ căn đều 2 lề.
- 4 link chính sách ở footer mở đúng trang con; 8 link `target="_blank"` trong file đều có `rel="noopener"`.

**Điểm chưa đạt:**
- **Newsletter footer là form giả:** input `#footEmail` chỉ xuất hiện 2 lần trong file (label + input, dòng 4675, 4677); **không có `<form>` trong footer, không có JS nào đọc `#footEmail`**. Nút "Đăng ký" là `<a href="#tu-van">` — bấm chỉ cuộn tới `#tu-van`; email đã gõ bị bỏ, không lưu ở đâu. Đây là điểm giả rõ nhất trong file. **[Xác minh bằng mã nguồn]**
- Lưu ý đếm CSS: `.foot-grid` trong CSS gốc đặt 4 track cột (`grid-template-columns:1.05fr .68fr 1.25fr 1.35fr`, dòng 525) trong khi footer có 5 khối con (brand + 4 nhóm) — số cột hiển thị thực tế phụ thuộc vào các rule ghi đè sau đó; audit này không kết luận số cột hiển thị cuối cùng mà không có render thật. **[Chưa xác minh bằng test thật]**

**Bằng chứng:** `<footer>` dòng 4613; `.foot-grid` dòng 4615; `.foot-brand` + tagline dòng 4616–4618; cột "Về Visfar Academy" dòng 4620–4629; cột "Khóa học" dòng 4630–4644; `#footEmail` dòng 4675, 4677 (đếm = 2, đều là HTML, 0 lần trong JS).

## 1.17. Responsive — khung 1380px, breakpoint, cỡ chữ, touch target

**Hiện trạng:** Khung duy nhất `.wrap{max-width:1380px; padding-inline:clamp(18px,4.5vw,32px)}` áp cho topbar/header/section/footer. Nội dung ở 1440px là 1.316px; ở 390px là 354px (đệm 18px mỗi bên). Thân bài căn đều 2 lề (`text-align:justify` 52 lần, `hyphens:auto`, `lang="vi"`). **[Xác minh bằng mã nguồn]**

**Breakpoint — đếm được từ file:** 134 block `@media`. Dùng nhiều nhất: 640px (25×), 880px (19×), 700px (13×), 920px (12×), 600px (10×), 1100px (7×), 560px (7×), 1020px (4×). **Không có breakpoint riêng 768px** — tablet 768px rơi vào dải 641–1100px, cỡ chữ ở đó chỉ suy từ công thức clamp, không có probe riêng trong file. Có 19 lần `prefers-reduced-motion:reduce`, 7 lần `hover:none` (đếm lại trong audit này; báo cáo đã có ghi 15× / 6× — chênh lệch do cách đếm chuỗi con trong comment/base64, không ảnh hưởng kết luận). Lưới responsive: khóa học 3 cột → 2 cột ≤ 1020px → 1 cột ≤ 700px; Lộ trình 6 cột → 3 cột ≤ 1100px → 1 cột ≤ 700px; `.foot-grid` 5 cột → 2 cột ≤ 960px → 1 cột ≤ 560px (theo báo cáo đã có). **[Xác minh bằng mã nguồn]**

**Cỡ chữ tính toán từ clamp — rule chốt cuối cho mỗi selector (giá trị tính tại 390 / 768 / 1024 / 1440px):**

| Quy tắc (rule chốt cuối) | 390px | 768px | 1024px | 1440px |
|---|---|---|---|---|
| `#philosophyTitle` — `clamp(16px,5.4vw,2.8rem)` | 21,06 | 41,47 | 44,8 | 44,8 |
| `.triangle-caption` — `clamp(16px,7vw,3.6rem)` | 27,3 | 53,76 | 57,6 | 57,6 |
| `.house-caption` — VISFAR HOME | 32–33,15 | 46,08 | 57,6 | 57,6 |
| `#roadmapTitle` — `clamp(26px,4.5vw,34px)` | 26 | 34 | 34 | 34 |
| `#fieldsTitle` — `clamp(26px,4.2vw,46px)` | 26 | 32,26 | 43,01 | 46 |
| `#coursesTitle` — `clamp(25px,3.4vw,38px)` | 25 | 26,11 | 34,82 | 38 |
| `#bizTitle` — `clamp(25px,3.2vw,36px)` | 25 | 25 | 32,77 | 36 |
| `.phil-sys-title` — Thập Nhất Viên Mãn | 20 | 23,04 | 30,4 | 30,4 |
| 4 thẻ Mục tiêu giáo dục (LÀM GIÀU / LÀM CHỦ / TRỞ NÊN / TRỞ THÀNH) | 16 | 16 | 16 | 16 |
| Tuyên ngôn 1a/1b (hero + Tuyên ngôn Triết lý) — `clamp(12.5px,3.5vw,19px)` | **13,65** | 19 | 19 | 19 |

Bảng trên lấy từ báo cáo đã có; audit này đã đối chiếu lại công thức clamp chốt cuối của từng selector bằng grep (ví dụ `#roadmapTitle`, `#fieldsTitle`, `#coursesTitle`, `#bizTitle`, `#philosophyTitle`, `.triangle-caption` đều có rule chốt cuối trùng công thức trong bảng) và tính lại ô tuyên ngôn (13,65px ở 390px). **Cảnh báo phương pháp:** mỗi selector có 2–3 rule `clamp` cạnh tranh trong file (rule cũ tí hon + rule chốt cuối); bảng giả định rule chốt cuối thắng nhờ vị trí cuối file + `!important`. Cỡ chữ hiển thị thực tế chỉ khẳng định được bằng render thật. **[Xác minh bằng mã nguồn (công thức) / Chưa xác minh bằng test thật (hiển thị thực tế)]**

**Chữ dưới sàn 16px còn tồn tại — chưa đạt, không được gọi là "đã xong":**
1. Tuyên ngôn 1a/1b: **13,65px ở 390px** (xem 1.3, 1.5.2). User chưa chấp nhận. Chỉ có 3 lựa chọn: chấp nhận 13,65px, bỏ yêu cầu 1 dòng cho cụm 1b, hoặc thu hẹp đệm trang.
2. Nhãn SVG Tam giác hiện thực: **~3,98px ở 390px** (xem 1.5.4); `.triangle-legend` đã bỏ nên không còn cách đọc nhãn trên điện thoại ngoài phóng to hình.
3. Nhãn/meta/kicker nhỏ trong CSS gốc: 9 khai báo `font-size` px dưới 16px trong CSS (đếm bằng regex `font-size:\s*(\d+(\.\d+)?)px` < 16 trong 4 khối `<style>`); ví dụ `.poster-kicker` 10,24–10,56px trên mobile, `.chapter` 12,16px ở một số nơi, placeholder ô tìm kiếm 14px, `.topbar` gốc 13,28px (khối audit nâng lên 15,2px). Khối audit cuối đã nâng nhiều chỗ lên sàn nhãn 14px và thân bài 16px, nhưng 14px vẫn là sàn nhãn, không phải sàn thân bài.
4. Quy tắc ép 1 dòng cũ vẫn nằm trong file: `white-space:nowrap` 41 lần (chuỗi `nowrap` xuất hiện 55 lần kể cả tên class/comment); các clamp tí hon cũ vẫn tồn tại nhưng đã bị khối audit cuối ghi đè — ví dụ `#roadmapTitle clamp(6.5px,2.02vw,12.5px)` → 7,88px ở 390px nếu không có audit; `#coursesTitle clamp(10.2px,3.2vw,12.8px)` → 12,48px.

**Touch target:** khối audit đặt `min-height:44–50px` cho nút (48px), tab/link footer/policy (44–46px), `.menu-btn` 48×48px (dòng 1427), input/select 50px, `#fCity` 52px, `.btn` `min-height:48px` (dòng 1431). **[Xác minh bằng mã nguồn; chưa xác minh bằng test thật trên thiết bị]** (chưa kiểm chứng bằng render thật trên thiết bị).

**Overflow:** `overflow:hidden` 18 lần (chủ yếu `.ev-card`, `.prog-media`); `overflow-x:hidden/clip` trên `html/body` không xuất hiện hiệu lực trong CSS đã strip comment — cần xác minh bằng render thật. **[Chưa xác minh bằng test thật]**

**Màu sắc và hiệu ứng tiêu đề:** toàn bộ tiêu đề dùng gradient vàng chéo 135° (`#6e4f0a → #a67c00 → #c9a227 → #d4af37 → #e8c766 → #8c6d1f`), điểm sáng nhất `#e8c766` chỉ ở góc chéo 90%, không còn điểm trắng `#fff6c8` giữa chữ (grep = 0). Tương phản đo được (theo báo cáo đã có): `#6e4f0a` 6,66–7,54:1, giữa chữ ~2,9–3,6:1, điểm sáng nhất 1,45–1,64:1 — điểm sáng vẫn dưới chuẩn tương phản chữ thường, nhưng chỉ chiếm dải hẹp ở góc. Hover chuẩn toàn trang: nâng `translateY(-3px)`, viền vàng `rgba(212,175,55,.6)`, bóng `0 18px 38px rgba(0,0,0,.38)`, 220ms; tắt trên touch và `prefers-reduced-motion`. **[Xác minh bằng mã nguồn (gradient, grep `#fff6c8` = 0) / Chưa xác minh bằng test thật (đo tương phản lại sau đổi gradient)]**

---

# PHẦN 2 — KIỂM TOÁN KỸ THUẬT

## 2.1. HTML structure

**Hiện trạng — đếm được từ file:** 1 file HTML duy nhất, `<!DOCTYPE html>`, `<html lang="vi">`, 4 `<meta>` (charset, viewport, color-scheme, description), 13 `<section>` theo đúng thứ tự DOM: `trang-chu` (3509), `su-menh-tam-nhin` (3552), `gioi-thieu` (3575), `triet-ly` (3603), `lo-trinh` (3718, lồng trong `triet-ly`), `linh-vuc` (3779), `chuong-trinh` (3840), `doanh-nghiep` (4065), `chia-se` (4089), `blog` (4186, chứa `#su-kien` dòng 4205), `faq` (4274), `dang-cap-nhat` (4297), `tu-van` (4315). Ngoài 13 section: `#policyView` (4443) và `<footer>` (4613). 72 `id`, 0 trùng — hiếm gặp ở file qua nhiều lần sửa. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Không có duplicate `id` (72 id, 0 trùng).
- 11/13 section có `aria-labelledby`; `lang="vi"`; `hyphens:auto` cho văn bản căn đều.
- 26/27 ảnh có `width/height` (chống layout shift); `loading="lazy"` 24/27; eager 3 (logo header, ảnh hero, logo footer); hero có `fetchpriority="high"`.

**Điểm chưa đạt:**
- **Không có `<h1>` trong nội dung chính** — chỉ có 4 `<h1>` trong 4 bài chính sách ẩn (dòng 4448, 4499, 4538, 4572); tiêu đề hero là `<h2>` (dòng 3516). Heading: h1 = 4, h2 = 46, h3 = 66, h4 = 5, h5/h6 = 0.
- Section lồng section: `#lo-trinh` nằm trong `#triet-ly`; `#su-kien` là `<div>` trong `#blog` — sitemap và outline lệch.
- 2 section thiếu `aria-labelledby`: `#trang-chu` và `#gioi-thieu`.
- Không có skip-link ("bỏ qua tới nội dung"): chuỗi `skip` chỉ xuất hiện 1 lần trong file, nằm bên trong chuỗi base64 của một ảnh (dòng 3634) — không có skip-link thật.
- `<iframe id="sheetFrame">` có `title=""` rỗng (dòng 4437).
- Inline style còn 10 chỗ (đếm `style="`), ví dụ `style="width:100%"` ở nút submit, `style="margin-top:64px"` ở `#su-kien`, `style="margin-top:10px;font-size:.86rem"` (×2).
- Nội dung lặp: hotline `tel:+84347897868` xuất hiện 10 lần (chuỗi `tel:`), email `visfaracademy@gmail.com` 19 lần trong HTML+JS; khối liên hệ chính sách lặp nguyên văn 4 lần.
- 10/27 ảnh có `alt=""` (toàn bộ poster khóa học) — xem 1.8.
- Không có `srcset`/`sizes` — ảnh 1600px vẫn tải đủ trên điện thoại 390px.

## 2.2. CSS

**Hiện trạng — đếm được từ file:**
- **4 khối `<style>` thật** (mở tại dòng 11, 2836, 3132, 3277; đóng tại 2835, 3131, 3276, 3481). Lưu ý đối chiếu: chuỗi `<style` xuất hiện 7 lần trong file vì 3 lần nằm trong comment CSS (dòng 1662, 1803, 1906) — báo cáo đã có ghi "nhóm UI đếm 4, nhóm kỹ thuật đếm 7"; audit này xác nhận **4 khối thật**, 3 lần còn lại là nhắc trong comment.
- Tổng nội dung 4 khối `<style>`: **1.353.803 ký tự** (đếm bằng Python trong audit này) — bao gồm 12 `@font-face` base64 (~643 KB); con số "~258 KB CSS" trong báo cáo đã có là CSS sau khi trừ base64 font, audit này không tính lại con số đó mà ghi số thô đếm được. Số rule ≈ 2.015 dấu `}` trong CSS (báo cáo đã có ghi ~1.955 rule / 1.104 selector duy nhất — chênh lệch do cách đếm).
- 134 `@media`; 74 `clamp()`; **300 lần `!important`**; `white-space:nowrap` 41 lần; `text-align:justify` 52 lần.
- CSS variables: `--gold`, `--gold2`, `--grad`, `--ink`, khung 1380px, Be Vietnam Pro, gradient chéo 135° — design system tái dùng được nếu tách CSS ra file riêng. **[Xác minh bằng mã nguồn]**

**Điểm tốt:**
- Design system nhất quán: biến màu, khung 1380px, gradient vàng chéo 135°, hover chuẩn toàn trang, `prefers-reduced-motion` và `hover:none` đã có.
- Khối audit cuối đã nâng nhiều cỡ chữ lên sàn đọc được (tiêu đề phần 25–26px ở 390px, nút ≥ 44px, input 50px).

**Điểm chưa đạt:**
- **`!important` lạm dụng: 300 lần, trên 187 dòng** (theo báo cáo đã có). Ví dụ: `#philosophyTitle{... !important}` (dòng 1397), `.hero-manifesto h2 .manifesto-line2{... !important}` (dòng 1407, rồi lại dòng 1692 với giá trị khác), `html.js .reveal{... !important}` lặp ở dòng 1447, 1476, 1503 với 3 giá trị `transition` khác nhau. Sửa 1 chỗ có thể vỡ chỗ khác — nguyên nhân trực tiếp của các lỗi "sửa chỗ này, hỏng chỗ kia".
- **Khối chốt chồng chéo:** selector trùng nhiều nhất (theo báo cáo đã có): `@media(max-width:640px)` ×25, `@media(max-width:880px)` ×19, `nav.main a` ×14, `section` ×9, `.foot-grid` ×8, `html.js .reveal` ×8, `.wrap` ×6. Comment trong code tự thừa nhận: dòng 1583–1692 "Ghi đè quy tắc căn trái !important của khối chuẩn điện thoại ở trên…".
- **Dead code CSS:** `.intl-note` 15 lần, **0 phần tử**; `.intl-panel` 30 lần, **0 phần tử**; `#phuong-phap-giao-duc`, `#he-thong` 5 lần trong CSS, **0 `id`**; `.phil-subtitle` 2 lần, **0 phần tử**. Riêng `.intl-*` còn 30 lần gợi ý có cả một panel quốc tế đã bị xóa mà CSS chưa dọn. (Số đếm theo báo cáo đã có; đã đối chiếu mẫu `.intl-note`/`.intl-panel` bằng grep trong audit này.)
- Quy tắc cũ tí hon vẫn nằm trong file và chỉ bị ghi đè nhờ vị trí cuối + `!important` (xem 1.17, mục 4).
- Không có file CSS riêng — toàn bộ CSS inline trong `<head>`, chặn render lần đầu (FCP/LCP bị chặn bởi CSS inline nặng, trong đó có base64 font).

## 2.3. JavaScript

**Hiện trạng — đếm được từ file:** 3 khối `<script>`: (1) dòng 3482, 1 dòng `document.documentElement.classList.add("js")`; (2) dòng 4691–5092, ~18.886 ký tự, logic chính; (3) dòng 5093–5138, ~1.825 ký tự, `renderPolicy`. Tổng JS ~20.756 ký tự (~20 KB), 0 framework, 0 thư viện ngoài. 24 `addEventListener`, 36 `getElementById`, 10 `querySelectorAll`, 7 lần `IntersectionObserver`, 0 `localStorage` / `sessionStorage` / cookie, 0 `innerHTML` / `eval` / `document.write` / `console.log` / `alert`. **[Xác minh bằng mã nguồn]**

**Các hàm chính (đếm tên hàm trong file):** `setActiveMenu`, `updateProgress`, `norm`, `applyCourseFilter`, `requestFilter`, `copyText`, `fallbackCopy`, `updateFloats`, `appendPhoneLink`, `setStatus`, `summaryRow`, `showThankYou`, `showFallbackOk`, `showErr`, `submitViaIframe`, `onLoad`, `finish`, `fallback`, `renderPolicy`, `restoreOrder`, `activate`, `deactivate`. **[Xác minh bằng mã nguồn]**

**Chức năng đang hoạt động — có handler, khớp với phần tử trong HTML [xác minh bằng mã nguồn]:**
| Chức năng | Bằng chứng |
|---|---|
| Menu mobile + active menu theo section | `#menuBtn` (3496), `IntersectionObserver` rootMargin `-40%/-55%` |
| Thanh tiến trình đọc | `#progressBar` (3485), listener `scroll` + `resize` |
| Reveal khi cuộn | Observer threshold 0.08, stagger tối đa 320ms (> 640px, không reduced-motion); fallback an toàn: `setTimeout 2000ms` ép thêm `.in` cho tất cả; nếu không có Observer thì thêm ngay |
| Tìm kiếm + lọc khóa học | `norm()` bỏ dấu, `đ→d`; `#courseSearch` (3850); `#noResult`; `#courseCount` |
| Toggle chi tiết khóa học | 10× `.prog-toggle`, toggle class `details-open`, đổi `aria-expanded` |
| Pre-select khóa học từ CTA | 15× `[data-course]`; trừ 1 link cũ "Thấu Hiểu Bản Thân" không khớp (xem 1.8) |
| Header shadow + nút nổi | header `.scrolled` khi scroll > 10; Zalo + về đầu trang hiện khi scroll > 240 và form không trong viewport và không mở policy |
| Policy 4 trang con bằng hash | `renderPolicy` (5093–5138), bắt `hashchange`, `body.policy-open`, scroll về 0 |
| Tam giác hiện thực SVG | 8 `.tri-ring`, `activate`/`deactivate`/`restoreOrder`; chỉ xác minh ở mức mã nguồn |
| Form submit fetch + fallback iframe; validation JS; thank-you chỉ khi `ok:true`; copy/mailto dự phòng (chỉ thấy ở nhánh fallback) | Xem 2.4 |

**Code chết / giả hoạt động [xác minh bằng mã nguồn]:**
| Vị trí | Thực tế |
|---|---|
| `[data-copy]` | Handler tại dòng 4836–4837 (`querySelectorAll("[data-copy]")`), nhưng **0 phần tử** nào trong HTML có thuộc tính `data-copy` (chuỗi `data-copy` xuất hiện đúng 2 lần trong file, cả 2 đều ở dòng JS 4836–4837) — handler không bao giờ chạy |
| `#floatCta` | JS dòng 4841 `getElementById("floatCta")`, dòng 4849 `if(floatCta)...`; HTML **không có `id="floatCta"`** — nhờ guard nên không crash, nhưng tính năng "nút CTA nổi sau 700px" vĩnh viễn không hiện |
| Newsletter footer | Không có `<form>`, không có JS nào đọc `#footEmail` (xem 1.16) |
| "Xem chi tiết" sự kiện / Blog | Chỉ là anchor, không có trang đích (xem 1.11, 1.12) |
| Tìm "giảng viên" | Placeholder hứa tìm giảng viên nhưng không có dữ liệu giảng viên (xem 1.8) |

**Điểm tốt về an toàn JS:** 0 `innerHTML`, 0 `eval(`, 0 `document.write`, 0 `console.log`, 0 `alert(` — dữ liệu người dùng được chèn bằng `textContent`/`createTextNode`; không có XSS sink trực tiếp. **[Xác minh bằng mã nguồn]**

**Điểm chưa đạt:** form chết hoàn toàn khi tắt JavaScript (không `action`/`method`); policy chỉ chạy nhờ JS; không có lưu trữ cục bộ nào nên không có "tiếp tục học dở" hay ghi nhớ form.

## 2.4. Form submission — fetch CORS, fallback iframe, timeout

**Hiện trạng — dòng 4862–5044 [xác minh bằng mã nguồn]:**
- **Fetch chính (dòng 4988–5031):** payload tự build bằng `URLSearchParams`, **không dùng `FormData`** (nên hidden input `source` thực ra không được gửi qua form — giá trị `source` được hard-code lại trong JS). **Không có `mode:"no-cors"`** (grep = 0) — đây là fetch CORS mặc định, `Content-Type: application/x-www-form-urlencoded`. Timeout 30.000ms qua `AbortController` (đếm `AbortController` = 2, `30000` = 1). Phản hồi: `res.text()` → `JSON.parse`, **không kiểm tra `res.ok` / HTTP status**; `data.ok === true` → `showThankYou()` (dòng 4899, gọi tại 5018); `data.error` → hiển thị nguyên văn lỗi server; JSON lỗi / fetch reject (mạng, CORS, abort) → `fallback()` bằng iframe.
- **Fallback iframe (dòng 4925–4953, iframe dòng 4437):** iframe 1×1px, `opacity:0`, `aria-hidden`, timer 25.000ms (đếm `25000` = 1); iframe cross-origin nên **không đọc được nội dung phản hồi** — bất kỳ sự kiện `load` nào (kể cả trang lỗi/redirect của Google) cũng được coi là "đã gửi" (`submitViaIframe` gọi `onDone()` ngay khi iframe load). Hết 25s không `load` → báo lỗi "Không nhận được xác nhận… Yêu cầu có thể đã được gửi đi, vui lòng đừng gửi lại ngay…". Khi `load` → `showFallbackOk()` hiện hộp `#formOk` **bên trong form** (không phải màn hình cảm ơn), với văn bản thừa nhận rõ: "Yêu cầu đã được gửi đi bằng cách dự phòng, nhưng trình duyệt không đọc được xác nhận ghi nhận."
- **Thank-you view (dòng 4420–4436, `showThankYou` 4897–4912):** chỉ gọi khi `data.ok === true` ở nhánh fetch chính. Form ẩn đi, thank-you hiện, cá nhân hóa theo tên và khóa học, tóm tắt chỉ 3 dòng — Họ và tên / Số điện thoại / Quan tâm (không email, không tỉnh). Nút: Zalo nhóm `https://zalo.me/g/9p1ow5o696mfjvvhtfu6`, Zalo hỗ trợ `https://zalo.me/0347897868/`, "Quay lại trang chính" → `#top`, "Đăng ký thêm" → reset form, focus `#fName`. Tổng số link `zalo.me` trong file: 13 lần xuất hiện chuỗi (8 link `href="https://zalo.me…"`).
- **Hộp xác nhận dự phòng `#formOk` + mailto + copy (dòng 4409–4418, 5033–5044):** trước khi fetch, JS đã chuẩn bị sẵn `mailto:visfaracademy@gmail.com?subject=…&body={Họ tên / SĐT / Email / Tỉnh / Khóa học}` và nội dung plain-text để sao chép (`data-body`). `#copyBtn` dùng `navigator.clipboard.writeText` + fallback `textarea + document.execCommand("copy")`, đổi nhãn "Đã sao chép ✓" trong 2.200ms. **Quirk đã xác minh:** `#formOk` chỉ được hiện trong nhánh fallback; ở nhánh thành công chuẩn, form bị ẩn và màn hình cảm ơn hiện thay — nên người đăng ký thành công bình thường không bao giờ thấy nút mailto/copy dự phòng. `#mailtoBtn` ban đầu `href="#"`; nếu bấm trước khi submit thì chỉ nhảy `#`.
- **Validation JS (dòng 4954–4980):** họ tên chỉ kiểm tra khác rỗng (không kiểm tra độ dài, ký tự); SĐT đúng định dạng `0 + 9 số` (`/^0\d{9}$/`, không kiểm tra đầu số nhà mạng, không chấp nhận +84); email client cho phép TLD 1 ký tự, trong khi Apps Script server yêu cầu `\.[^\s@]{2,}$` — **lệch validation client/server**. Tỉnh không kiểm tra có nằm trong 34 option hay không (chỉ cần `select.value` khác rỗng). Lỗi gom vào `#formErr` + `#formStatus`, cuộn tới lỗi, không gửi.

**Kết luận đã sửa so với bản cũ (quan trọng):** ở nhánh fetch chính, rủi ro "thank-you hiện trước khi Sheet ghi xong" đã được khắc phục về mặt logic — `showThankYou` chỉ chạy khi `data.ok === true`, mà server chỉ trả `ok:true` **sau** `appendRow`. Dòng ghi chú trong form (dòng 4408) cũng nói đúng. **Rủi ro còn lại:** (1) nhánh fallback iframe hiện "đã gửi" mà không có xác nhận Sheet — điểm mù duy nhất còn hiển thị "thành công" mà không có xác nhận; (2) **ghi trùng:** không có idempotency key / mã yêu cầu / kiểm tra trùng — fetch timeout 30s sau khi server đã `appendRow` nhưng trước khi client nhận JSON → client gọi fallback iframe → ghi thêm 1 dòng trùng; `LockService` chỉ serialize (chống ghi đồng thời), không chống trùng; (3) `AbortController` hủy phía client, không hủy phía server; (4) server không bắt buộc `province`; (5) không xác minh được bản deploy.

**Chưa xác minh bằng test thật:** chưa POST thật, chưa kiểm tra tab `DATA VISFAR ACADEMY` có dòng mới hay không, chưa kiểm tra CORS thực tế từ trình duyệt, chưa kiểm tra tốc độ/latency của Web App, chưa xác minh bản deploy Apps Script có trùng `Code-hop-nhat-2-trang.gs` hay không, chưa xác minh quyền deploy (Execute as / Anyone), chưa kiểm tra `testVisfar()` có từng chạy và để lại dòng test trong Sheet hay không. **Chưa có lần đăng ký thật nào từ trình duyệt của user trên trang đã xuất bản được xác nhận** — sau mỗi lần đăng ký thật vẫn cần kiểm tra tab DATA.

## 2.5. Google Apps Script — chỉ URL Web App trong HTML

**Hiện trạng:** File HTML **không chứa** mã Apps Script — chỉ chứa 1 URL Web App duy nhất, đúng 1 lần trong file (dòng 4862): `https://script.google.com/macros/s/AKfycbxMYvos2_UjIC9AQHnbA_I4F2gAIntnzmjkL6bWv4Doq26ltrfA6T0BpkONdesQk-fM/exec`. Mọi thông tin dưới đây lấy từ file tham chiếu `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` (276 dòng, kiểm tra tồn tại trong audit này) — **chưa xác minh bản deploy thực tế trên Google có trùng file này hay không** (HTML không ghi version/deployment ID, không ghi quyền Execute-as / Anyone). **[Xác minh bằng mã nguồn (.gs) / Chưa xác minh bằng test thật (deploy)]**

| Hạng mục | Nội dung trong file `.gs` (số dòng đếm lại trong audit này) |
|---|---|
| Spreadsheet ID | `141suS0pdN2-TrXEUpUTTDoHnV_WQqaTlvIdKhbRnrL8` (dòng 6 và 49; chuỗi xuất hiện 2 lần trong file) |
| Route `visfar-academy` | Tab `DATA VISFAR ACADEMY` (chuỗi xuất hiện 4 lần), 6 cột: Thời gian \| Họ và tên \| Số điện thoại \| Email \| Tỉnh / Thành phố \| Khóa học quan tâm |
| Route `nang-tam` | Tab `DATA TÂM THỨC & NHÂN HIỆU`, 5 cột + biên lai Drive |
| Mặc định khi thiếu `source` | `nang-tam` |
| `source` lạ | `ok:false, error: 'source không hợp lệ: …'` |
| `doPost` (dòng 192) | `LockService.getScriptLock().tryLock(10000)` → parse JSON hoặc `e.parameter` → validate name / phone `/^0\d{9}$/` / email `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` → với `visfar-academy`, `course` bắt buộc, `province` **không bắt buộc ở server** (chỉ trim) → `appendRow([new Date(), name, phone, email, province, course])` → cột SĐT (cột 3) set `NumberFormat '@'` → trả `{ok:true, source, sheet, message:'Đã ghi thành công.'}` |
| `jsonResponse_` | `ContentService.createTextOutput(JSON).setMimeType(JSON)` — **không set header CORS tường minh**; việc fetch CORS có đọc được JSON hay không phụ thuộc header mặc định của Google Web App, không kiểm soát được từ code này |
| `doGet` | Trả `{ok:true, message:'Web App hợp nhất 2 trang đang chạy.', routes:[...]}` |
| `testVisfar()` (dòng 144) | Ghi dòng test với khóa học `Kiến Tạo Nhân Hiệu` — tên khóa đã bị xóa/đổi trên trang hiện tại; nếu chạy test này sẽ ghi một dòng dữ liệu sai tên khóa vào tab thật |

**Lưu ý bảo mật khi đọc audit này:** Spreadsheet ID và URL Web App là thông tin kỹ thuật phục vụ kiểm toán; không dùng để POST thử khi chưa được chủ dự án cho phép (POST thử sẽ ghi dòng thật vào Sheet).

## 2.6. API endpoints

**Hiện trạng:** Chỉ **1 endpoint duy nhất** trong toàn file: 1 URL Web App Google Apps Script (dòng 4862, xuất hiện đúng 1 lần; chuỗi `script.google.com` đếm = 1). Không có API nào khác, không có endpoint nội bộ, không có webhook. **[Xác minh bằng mã nguồn]**

| Endpoint | Phương thức | Dùng ở đâu | Trạng thái |
|---|---|---|---|
| `https://script.google.com/macros/s/AKfycbx…/exec` | POST (fetch CORS) + POST dự phòng qua iframe | Form `#consultForm` (dòng 4862) | **[Chưa xác minh bằng test thật]** — chưa POST thật, chưa xác minh deploy trùng file `.gs` |

Không có endpoint đăng nhập/đăng ký tài khoản, thanh toán, khóa học, blog, sự kiện — trang hiện tại chưa có backend ứng dụng nào ngoài Web App ghi Sheet.

## 2.7. Base64 assets

**Hiện trạng — đếm được từ file:**
- `data:image` = 32 (16 JPEG + 14 PNG + 1 WebP + 1 SVG chevron trong CSS). `<img>` = 27, tất cả `src` đều là `data:` URI.
- Tổng base64 (ảnh + font): theo báo cáo đã có, ~5.202 KB / 5.577 KB file (93%) là base64; ảnh ~4.684.780 byte (81,6% file); font ~643 KB base64. Audit này đếm lại: 31 blob `data:image…;base64,…` với tổng 4.683.944 ký tự base64 (82,0% tổng số ký tự file 5.711.248) — chênh lệch nhỏ so với báo cáo đã có do cách tính (ký tự base64 thuần so với byte đã giải mã + URI prefix); kết luận không đổi: **phần lớn file là base64**.
- Kích thước từng ảnh (base64, theo báo cáo đã có): logo 225 KB ×2 (header + footer, cùng 1 file lặp lại = 450 KB trùng lặp); hero tập thể 334 KB (1334×889); founder 174 KB; VISFAR HOME WebP 484 KB (1696×1472); 10 poster khóa học 1600×900, mỗi 107–129 KB; ảnh doanh nghiệp DSC03023 246 KB (1334×889); 8 chân dung học viên hiển thị 84px nhưng file 40–182 KB PNG (Nguyễn Hoàng Ánh 182 KB, lớn nhất); 3 ảnh sự kiện 1200×750, 136–168 KB.
- Font: 12 `@font-face` Be Vietnam Pro, weights 400–900, cả normal + italic, `font-display:swap`, `src:url(data:application/octet-stream;base64,…)` (đếm `data:application/octet-stream` = 12) — tổng ~643.448 byte base64 (~470 KB giải mã). Không dùng Google Fonts/CDN. Stack fallback: `"Be Vietnam Pro","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`. Font không tách file, không subset. **[Xác minh bằng mã nguồn]**

**Hệ quả hiệu suất (từ cấu trúc file, chưa đo render):** file đơn 5,5 MB phải tải hết trước khi render ý nghĩa (CSS + font + ảnh đều inline, không cache riêng từng asset, không nén riêng, không HTTP/2 multiplexing cho asset). Base64 làm ảnh nặng hơn ~33% so với file nhị phân. Mỗi lần sửa 1 chữ phải tải lại cả 5,5 MB. Điểm cộng: lazy loading 24/27, `fetchpriority` cho hero, `font-display:swap`, width/height đầy đủ 26/27. **[Chưa xác minh bằng test thật]** (chưa đo FCP/LCP trên thiết bị thật).

## 2.8. External dependencies

**Hiện trạng — đếm được từ file:** 0 file CSS/JS/font/ảnh ngoài; **0 CDN**; 0 analytics; 0 `<link>` ngoài (2 `<link>` trong file đều là data URI: favicon/apple-touch-icon). Domain ngoài duy nhất xuất hiện trong file: `zalo.me` và `script.google.com` (danh sách host trích từ các URL trong file: `script.google.com`, `www.w3.org` — chỉ là namespace SVG trong code, không phải tài nguyên tải về — và `zalo.me`). **[Xác minh bằng mã nguồn]**

| Phụ thuộc ngoài | Dùng ở đâu | Ghi chú |
|---|---|---|
| Google Apps Script Web App (`script.google.com`) | Form `#consultForm`, dòng 4862 | Endpoint duy nhất; xem 2.5–2.6 |
| Zalo (`zalo.me`) | 8 link `href` (nhóm Zalo, Zalo hỗ trợ, nút nổi) + 13 lần xuất hiện chuỗi trong file | Link ngoài duy nhất tới mạng xã hội/nhắn tin |
| Không có CDN, font ngoài, analytics, thư viện JS | — | Không rò rỉ referrer sang bên thứ ba qua asset; favicon/apple-touch-icon là data URI |

**Điểm tốt:** không phụ thuộc CDN nên không có rủi ro CDN sập hay rò rỉ dữ liệu sang bên thứ ba qua asset.
**Điểm chưa đạt:** 0 analytics nên không có dữ liệu đo lường hành vi người dùng, tỷ lệ chuyển đổi form, hay nguồn traffic — mọi quyết định cải tiến hiện dựa trên quan sát thủ công, không có số liệu. **[Xác minh bằng mã nguồn]** (không có bằng chứng analytics trong file; việc có analytics ở tầng host khác hay không là ngoài phạm vi file này).

## 2.9. SEO

**Hiện trạng — đếm được từ file:** title dài (~100 ký tự, chứa đủ tuyên ngôn), meta description có; **thiếu h1 chính**; thiếu OG/Twitter/canonical/robots/JSON-LD/sitemap (đếm `og:` = 0, `twitter:` = 0, `canonical` = 0, `robots` = 0, `application/ld+json` = 0); chỉ có 4 `<meta>`: charset, viewport, color-scheme, description. **[Xác minh bằng mã nguồn]**

**Điểm chưa đạt:**
- Không có `<h1>` chính (xem 2.1); 4 `<h1>` chính sách nằm trong `#policyView` ẩn sau JS nên bot/crawler không tới được nội dung chính sách.
- Chính sách ẩn sau JS (hash + `renderPolicy`) — không có URL thật, không chia sẻ link trực tiếp được, bot không đọc được.
- Chia sẻ link lên Zalo/Facebook sẽ không có ảnh/tiêu đề đẹp (thiếu OG/Twitter); không có canonical thì bản `Visfar_Academy.html` và bản artifact live có thể bị coi là trùng lặp.
- Không có sitemap, không có JSON-LD (Organization + Course).

**Chưa xác minh bằng test thật:** thứ hạng tìm kiếm thực tế, cách Google/Zalo render preview link, hay việc trang đã được index hay chưa — ngoài phạm vi đọc mã nguồn.

## 2.10. Performance

**Hiện trạng (từ cấu trúc file, chưa đo render):** file đơn 5,5 MB; 93% là base64 (xem 2.7); CSS inline ~1,35 MB ký tự thô (bao gồm base64 font) trong `<head>` chặn render lần đầu; không cache riêng từng ảnh/font; không `srcset`/`sizes`; mỗi lần sửa 1 chữ phải tải lại cả 5,5 MB. **[Xác minh bằng mã nguồn (cấu trúc) / Chưa xác minh bằng test thật (chỉ số tốc độ)]**

**Điểm tốt:** lazy loading 24/27 ảnh; `fetchpriority="high"` cho hero; `font-display:swap`; width/height đầy đủ 26/27 ảnh (chống layout shift); 0 thư viện JS ngoài (JS chỉ ~20 KB).

**Điểm chưa đạt / chưa đo được:**
- Chưa đo FCP/LCP/CLS/TBT trên thiết bị thật, chưa đo ở mạng 3G/4G Việt Nam — mọi nhận định tốc độ trong audit này là suy từ cấu trúc file, không phải số đo.
- Ảnh 1600px tải đủ trên điện thoại 390px (không `srcset`); logo lặp 2 lần (450 KB trùng lặp); 8 ảnh chân dung 84px nhưng file tới 182 KB.
- `overflow-x:hidden/clip` trên `html/body` không xuất hiện hiệu lực trong CSS — tràn ngang (nếu có) chỉ khẳng định được bằng render thật.

## 2.11. Accessibility

**Điểm tốt [xác minh bằng mã nguồn]:** `lang="vi"`; 104 lần xuất hiện chuỗi `aria-` (99 thuộc tính `aria-*` theo báo cáo đã có — chênh lệch do cách đếm chuỗi con); 19 `role=`; `aria-labelledby` trên 11/13 section; `aria-label` cho từng vòng SVG Tam giác; `prefers-reduced-motion` 19 lần; nút chạm ≥ 44px ở nhiều nơi (xem 1.17); 8 link `target="_blank"` đều có `rel="noopener"`; `<details>` FAQ dùng native nên hoạt động cả khi JS lỗi.

**Điểm chưa đạt [xác minh bằng mã nguồn]:**
- Không có skip-link (xem 2.1).
- Không có `<h1>` chính (xem 2.1).
- Policy ẩn khỏi cây accessibility cho tới khi mở.
- `<iframe id="sheetFrame">` có `title=""` rỗng.
- Một số chữ gradient vàng trên nền ivory có tương phản thấp ở điểm sáng nhất (`#e8c766` ~1,45–1,64:1 theo báo cáo đã có — cần đo lại sau đổi gradient chéo 135°).
- Nhãn SVG Tam giác ~3,98px ở 390px và không còn chú giải chữ (xem 1.5.4).

**Chưa xác minh bằng test thật:** kiểm tra bằng screen-reader thật, kiểm tra bàn phím toàn trang, đo tương phản thực tế trên màn hình — chưa thực hiện trong audit này.

## 2.12. Security

**Điểm tốt [xác minh bằng mã nguồn]:**
- Không có XSS sink trực tiếp: `innerHTML` = 0, `outerHTML` = 0, `document.write` = 0, `eval(` = 0, `insertAdjacentHTML` = 0; dữ liệu người dùng được chèn bằng `textContent`/`createTextNode`.
- Link ngoài an toàn: 8 link `target="_blank"` đều có `rel="noopener"`; chỉ có 2 domain ngoài: `zalo.me` và `script.google.com`.
- Favicon/apple-touch-icon là data URI, không CDN ngoài — không rò rỉ referrer sang bên thứ ba.
- `console.log` = 0, `alert(` = 0, `TODO/FIXME/lorem` = 0 (theo báo cáo đã có).

**Điểm chưa đạt [xác minh bằng mã nguồn]:**
- **Endpoint Apps Script công khai, không xác thực, không chống spam:** URL hard-code dòng 4862; fetch POST không kèm token, captcha, honeypot, CSRF hay header xác thực (đếm `captcha/honeypot/csrf/recaptcha` = 0 theo báo cáo đã có). Ai có URL đều POST được họ tên/SĐT/email giả vào Sheet. **Chưa xác minh** cấu hình deploy (Anyone / Anyone with Google account), validation phía server, rate-limit trong `Code.gs` — không được kết luận "Anyone" chỉ từ HTML.
- **Không có CSP:** `Content-Security-Policy` = 0.
- **Dữ liệu cá nhân bị đưa vào `mailto:` và clipboard:** dòng 4978–4983 (theo báo cáo đã có; vị trí tương ứng trong file: khối chuẩn bị `mailtoBtn`/`data-body` trước khi fetch, hàm `copyText`/`fallbackCopy`): body chứa họ tên + SĐT + email + tỉnh + khóa học được gán vào `okBox.setAttribute("data-body", body)` và `mailtoBtn.href`; `#copyBtn` sao chép toàn bộ body. Email client / lịch sử trình duyệt / bất kỳ ai bấm nhầm đều thấy đủ PII.
- **Không chống ghi trùng / double-submit bằng token:** nút gửi chỉ `disabled` trong lúc gửi; không có idempotency key; fetch timeout 30s có thể gây ghi trùng qua fallback iframe (xem 2.4).
- **Validation chỉ ở client, regex hẹp:** SĐT `/^0\d{9}$/` từ chối số +84; email client chấp nhận nhiều địa chỉ không thật; không kiểm tra trùng lặp, không giới hạn độ dài tên, không sanitize phía client.
- Form có `novalidate` — validation native bị tắt hoàn toàn.

**Chưa xác minh bằng test thật:** chưa thử POST giả/spam vào endpoint (và không nên thử khi chưa được chủ dự án cho phép, vì sẽ ghi dòng thật vào Sheet); chưa kiểm tra quyền deploy Apps Script; chưa kiểm tra Sheet có dòng test/dòng rác hay không.

---

# PHẦN 3 — QUYẾT ĐỊNH CẦN CHỦ DỰ ÁN PHÊ DUYỆT

Các quyết định dưới đây đều cần Lê Đăng Quyết phê duyệt trước khi thực hiện — audit này không tự quyết thay chủ dự án. Mỗi quyết định ghi rõ "giữ nguyên" hay "thay đổi" đối với nội dung thương hiệu / triết lý / màu sắc.

## Q1. Chấp nhận cỡ chữ tuyên ngôn 13,65px ở điện thoại 390px, hay bỏ yêu cầu "mỗi cụm đúng 1 dòng"?
- **Vấn đề:** tuyên ngôn hero + Tuyên ngôn Triết lý chỉ 13,65px ở 390px, dưới sàn 16px; giới hạn hình học của yêu cầu 1 dòng là ~13,98px (hero) / ~14,18px (Triết lý).
- **Lựa chọn:** (a) chấp nhận 13,65px; (b) bỏ yêu cầu 1 dòng cho cụm 1b để tăng cỡ chữ; (c) thu hẹp đệm trang để đạt 16px mà vẫn giữ 1 dòng.
- **Phạm vi:** chỉ thay đổi hiển thị; **giữ nguyên** nội dung tuyên ngôn và màu vàng kim.

## Q2. Chấp nhận chú giải Tam giác hiện thực đã bỏ, hay chọn cách khác để đọc nhãn trên điện thoại?
- **Vấn đề:** nhãn SVG chỉ ~3,98px ở 390px; `.triangle-legend` đã bỏ nên không còn cách đọc nhãn ngoài phóng to hình.
- **Lựa chọn:** (a) chấp nhận hiện trạng (chỉ phóng to mới đọc được); (b) khôi phục chú giải chữ 16px dưới tam giác (như `.house-legend` của VISFAR HOME); (c) tách tam giác thành 2 nửa phóng lớn; (d) chạm vào một vòng thì hiện nhãn của vòng đó cỡ lớn.
- **Phạm vi:** chỉ thay đổi cách hiển thị; **giữ nguyên** 8 vòng, 24 nhãn và thứ tự vòng 3–8 đã chốt.

## Q3. Sửa nhánh fallback form như thế nào để không hiện "đã gửi" khi chưa xác nhận Sheet?
- **Vấn đề:** fallback iframe hiện hộp "đã gửi đi" chỉ vì iframe `load`, không có xác nhận Sheet ghi xong; có nguy cơ ghi trùng khi fetch timeout 30s.
- **Lựa chọn:** (a) nhánh fallback chỉ báo "đã gửi, chưa xác nhận — chúng tôi sẽ liên hệ / kiểm tra lại", kèm mã tham chiếu duy nhất cho mỗi lần gửi; (b) thêm idempotency key (mã yêu cầu sinh ở client, server kiểm tra trùng trước khi `appendRow`); (c) cả (a) + (b).
- **Phạm vi:** thay đổi logic hiển thị và Apps Script; **giữ nguyên** 5 trường form, nội dung cảm ơn và màu sắc.

## Q4. Có cho phép chống spam / xác thực cho endpoint Apps Script không, và bằng cách nào?
- **Vấn đề:** endpoint công khai, không token, không CAPTCHA, không rate-limit; ai có URL đều POST được dữ liệu giả vào Sheet.
- **Lựa chọn:** (a) thêm CAPTCHA hoặc honeypot + rate-limit phía server trong `Code.gs`; (b) đồng bộ regex email client/server (TLD tối thiểu 2 ký tự) + whitelist `province`/`course` ở server; (c) cả (a) + (b). Cần chủ dự án xác nhận có được sửa file `Code-hop-nhat-2-trang.gs` và deploy lại Web App hay không, vì audit này **chưa xác minh** bản deploy hiện tại có trùng file `.gs` hay không.
- **Phạm vi:** thay đổi kỹ thuật phía server; **giữ nguyên** luồng form → Sheet → cảm ơn.

## Q5. Xử lý 3 nhóm nội dung "giả hoạt động" như thế nào: newsletter footer, nút "Xem chi tiết" sự kiện, blog không bài đầy đủ?
- **Vấn đề:** newsletter footer không gửi email đi đâu (`#footEmail` chỉ xuất hiện 2 lần, không có `<form>`, không có handler); 3 nút "Xem chi tiết" sự kiện chỉ cuộn về form; 3 bài blog không có bài đầy đủ.
- **Lựa chọn cho từng nhóm:** làm thật (newsletter ghi vào tab Sheet riêng hoặc dịch vụ email; sự kiện có trang chi tiết + đăng ký sự kiện cụ thể; blog có bài đầy đủ) **hoặc** gỡ/xóa khỏi trang cho tới khi có nội dung thật — không để link/nút đánh lừa người dùng.
- **Phạm vi:** thay đổi chức năng/nội dung; **giữ nguyên** triết lý và nhận diện.

## Q6. Cập nhật hay gỡ 3 sự kiện 05/2026, và đồng bộ 5 chỗ tên khóa cũ còn sót?
- **Vấn đề:** 3 sự kiện 22/05, 25/05, 28/05/2026 đã "Đã diễn ra" hơn 5 tháng nhưng tiêu đề phần vẫn là "Lịch sự kiện sắp diễn ra"; tên khóa cũ còn sót 5 chỗ: "Thấu Hiểu Bản Thân" ×3, "Khai Mở Trí Tuệ" ×1, "Kiến Tạo Nhân Hiệu" ×1 (link "Bắt đầu tại đây" dòng 4201 làm hỏng pre-select, và 1 câu trả lời FAQ dòng 4284).
- **Lựa chọn:** (a) cập nhật lịch sự kiện mới (cần user cung cấp ngày/giờ/nội dung sự kiện thật) hoặc gỡ 3 thẻ cũ; (b) đổi 5 chỗ tên cũ theo tên mới (khóa 01 "Thấu Hiểu Nội Tâm") — bao gồm quyết định có đổi cả 2 chỗ còn sót (link tài nguyên và FAQ) hay không; (c) đổi tên file poster `poster-09/10/11` theo số mới 04/05/06 hay giữ nguyên tên file cũ.
- **Phạm vi:** cập nhật nội dung; **giữ nguyên** thứ tự 10 khóa 01–10 và triết lý.

## Q7. Có dọn nợ kỹ thuật CSS (300 `!important`, khối chốt chồng chéo, dead code) ngay trên file hiện tại, hay đóng băng file và xây nền tảng mới?
- **Vấn đề:** 300 lần `!important`, 4 khối `<style>` với khối chốt cuối chồng chéo, dead code (`.intl-*` 30 lần, `#phuong-phap-giao-duc`/`#he-thong`, `.phil-subtitle`, `[data-copy]`, `#floatCta`), rule cũ tí hon chỉ bị ghi đè nhờ vị trí cuối + `!important`. Sửa một chỗ có thể vỡ chỗ khác.
- **Lựa chọn:** (a) dọn dần trên file hiện tại (xóa dead code, gỡ `!important` theo từng cụm, có kiểm tra render sau mỗi cụm); (b) đóng băng file hiện tại, chỉ sửa lỗi nghiêm trọng (Q3–Q6), và xây nền tảng mới tách 3 lớp (nội dung/CMS, tài khoản/học tập, thanh toán/quản trị) với nội dung và nhận diện giữ nguyên; (c) kết hợp: sửa lỗi nghiêm trọng trên file hiện tại trước khi chạy quảng cáo, song song chuẩn bị nền tảng mới.
- **Phạm vi:** thay đổi kỹ thuật; **giữ nguyên** toàn bộ nội dung, triết lý Giáo dục Tận Gốc và nhận diện đen than – vàng gold – ivory champagne trong mọi phương án.

## Q8. Có bổ sung SEO cơ bản và `<h1>` chính cho trang không?
- **Vấn đề:** trang chính không có `<h1>` (4 `<h1>` duy nhất nằm trong chính sách ẩn); thiếu OG/Twitter/canonical/robots/JSON-LD; chính sách không có URL thật nên bot không đọc được.
- **Lựa chọn:** (a) thêm `<h1>` thật cho trang chính + OG/Twitter/canonical/robots/JSON-LD (Organization + Course) + CSP; (b) tách 4 chính sách thành URL thật thay cho hash (đòi hỏi thay đổi cấu trúc trang/hosting); (c) chỉ làm (a) trước, để (b) cho giai đoạn nền tảng mới.
- **Phạm vi:** thay đổi kỹ thuật + cấu trúc URL; **giữ nguyên** nội dung chính sách và nhận diện.

---

## Phụ lục — Bảng đếm nhanh (đối chiếu)

| Chỉ số | Giá trị đếm được trong audit này | Ghi chú |
|---|---|---|
| Kích thước file | 5.742.754 byte, 5.140/5.141 dòng, md5 `0328f284880efe01f672596a958715bc` | Đếm lại bằng `wc`/`md5sum`, trùng báo cáo đã có |
| `<section>` / `id` | 13 / 72, 0 trùng | Theo thứ tự DOM, xem 2.1 |
| h1 / h2 / h3 / h4 / h5 / h6 | 4 / 46 / 66 / 5 / 0 / 0 | h1 chỉ trong policy ẩn |
| `<style>` thật | 4 khối (dòng 11, 2836, 3132, 3277); 1.353.803 ký tự thô; ~2.015 `}` | Chuỗi `<style` xuất hiện 7 lần (3 lần trong comment) |
| `@media` / `clamp()` / `!important` | 134 / 74 / 300 | Đếm bằng grep/Python |
| `white-space:nowrap` | 41 (chuỗi `nowrap` 55 lần) | — |
| `<script>` | 3 khối; ~20.756 ký tự; 24 `addEventListener`; 36 `getElementById`; 10 `querySelectorAll` | 0 `innerHTML`/`eval`/`console.log` |
| `<img>` / `data:image` | 27 / 32 (16 JPEG, 14 PNG, 1 WebP, 1 SVG) | Tất cả `src` đều là `data:` |
| Base64 ảnh (ký tự) | 4.683.944 ký tự base64 thuần (82,0% số ký tự file) | Báo cáo đã có ghi ~93% theo byte — chênh lệch do cách tính, kết luận không đổi |
| `@font-face` / base64 font | 12 / ~643 KB | Be Vietnam Pro 400–900, normal + italic |
| `<a>` / `target="_blank"` | 115 / 8 (đều có `rel="noopener"`) | 91 link nội bộ `#…` |
| Form | 1 form, 6 input, 2 select; `#fCity` 35 option, `#fCourse` 13 option | Xem 1.14 / 2.4 |
| Endpoint | 1 URL Web App, xuất hiện đúng 1 lần (dòng 4862) | Xem 2.5–2.6 |
| `zalo.me` | 13 lần xuất hiện chuỗi; 8 link `href` | — |
| SEO meta | `og:` 0, `twitter:` 0, `canonical` 0, `robots` 0, `ld+json` 0, CSP 0 | Chỉ có 4 `<meta>` |
| Tên khóa cũ còn sót | "Thấu Hiểu Bản Thân" ×3, "Khai Mở Trí Tuệ" ×1, "Kiến Tạo Nhân Hiệu" ×1 | Dòng 4201, 4284 và các chỗ khác |
| Code chết | `[data-copy]` 0 phần tử, `#floatCta` 0 phần tử, `.intl-*` 30 lần/0 phần tử | Xem 2.2–2.3 |
| Newsletter footer | `#footEmail` xuất hiện 2 lần, 0 `<form>`, 0 handler JS | Xem 1.16 |

---

*Hết file audit. File này chỉ kiểm toán — không sửa code, không sửa file HTML, không tạo database, không deploy. Mọi kết luận "đang hoạt động" trong file này đều là xác minh bằng mã nguồn, trừ khi ghi rõ "chưa xác minh bằng test thật".*
