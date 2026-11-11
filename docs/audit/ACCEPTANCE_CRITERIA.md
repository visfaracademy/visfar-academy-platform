# Tiêu chí nghiệm thu — TASK 01 Audit website Visfar Academy

**Ngày:** 10/11/2026
**Phạm vi (TASK 01):** chỉ viết tiêu chí nghiệm thu. Không sửa code, không sửa file HTML, không tạo database, không deploy.
**Trạng thái:** tài liệu kiểm tra — chưa chạy test nào. Mọi tiêu chí dưới đây đều ở trạng thái **CHƯA TEST** cho tới khi có bằng chứng test thật kèm theo.

## Nguồn

| # | Nguồn | Nội dung dùng làm căn cứ |
|---|---|---|
| 1 | `workspace/your_files/bao-cao-phan-tich-visfar-academy/Bao-cao-phan-tich-Visfar-Academy.md` | Báo cáo phân tích hiện trạng — các lỗi S1–S5, H1–H8, M1–M7; kế hoạch Giai đoạn 0–4 (§F); tiêu chí nghiệm thu từng giai đoạn (§H) |
| 2 | `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (v1.0, 10/11/2026) | Kiến trúc nền tảng: schema §3, RBAC §5, RLS §6, API §7, thanh toán §8, học tập §9, email §10, báo cáo §11, giới hạn miễn phí §12, Phụ lục A |
| 3 | `workspace/user/files/Visfar_Academy.html` (kiểm chứng bằng grep ngày 10/11/2026) | File gốc do user tải lên 10/11/2026, 11:50 — xem bảng kiểm chứng dưới đây |

## Bảng kiểm chứng từ file HTML gốc (grep, 10/11/2026)

| Hạng mục | Số liệu đo được | Căn cứ trong báo cáo |
|---|---|---|
| Kích thước file | 5.742.754 byte (5,5 MB) | Báo cáo A.1 |
| `<h1>` | 4 — tất cả trong 4 bài chính sách ẩn (`#policyView`); trang chính **không có h1** | Lỗi S1 |
| OG / Twitter / canonical / JSON-LD / CSP | 0 / 0 / 0 / 0 / 0 | Lỗi H8 |
| Form `#consultForm` | `novalidate`, **không có `action`, không có `method`** | Lỗi S3 |
| `mode:"no-cors"` trong file | 0 lần — fetch hiện tại là CORS mặc định | Báo cáo A.5 (đính chính) |
| URL Web App Apps Script | 1 URL duy nhất, đúng 1 lần trong file | Báo cáo A.5 |
| Tỉnh/TP `#fCity` | 35 `<option>` = 1 placeholder + **34 tỉnh/thành** | Báo cáo A.5 |
| Khóa học `#fCourse` | 13 `<option>` = 1 placeholder + **12 lựa chọn** (10 khóa 01–10 + “Doanh nghiệp…” + “Chưa biết bắt đầu từ đâu…”) | Báo cáo A.5 |
| SĐT | regex `/^0\d{9}$/` (10 số, bắt đầu bằng 0) | Báo cáo A.5 |
| Timeout | fetch 30.000 ms; fallback iframe 25.000 ms | Báo cáo A.5 |
| Tuyên ngôn hero | `clamp(12.5px,3.5vw,19px)` → **13,65px ở 390px** | Báo cáo A.4 |
| `!important` | 300 lần | Lỗi H1 |
| `#footEmail` (newsletter footer) | 2 lần xuất hiện (label + input), **không có `<form>`, không có handler JS** | Lỗi H5 |
| `#floatCta` | 2 lần trong JS, **0 phần tử HTML** (code chết) | Lỗi H4 |
| Link Zalo | nhóm `https://zalo.me/g/9p1ow5o696mfjvvhtfu6`, hỗ trợ `https://zalo.me/0347897868/` | Báo cáo A.5 |

## Quy ước đọc file này

- Mỗi tiêu chí có dạng checklist `[ ]` với 4 dòng: **Cách test** — **PASS khi** — **FAIL khi** — **Ai test**.
- **PASS/FAIL chỉ được kết luận bằng bằng chứng đo được** (screenshot, dòng Sheet/database, log, response JSON, số đo), không bằng lời nói “đã xong”.
- **“Chưa test” ≠ FAIL.** Tiêu chí chưa chạy test thì ghi rõ “CHƯA TEST + lý do” (ví dụ: chưa có project Supabase thật, chưa có bản build mới).
- **Nguyên tắc chung (áp cho mọi giai đoạn):** kiểm tra trên **điện thoại thật của user (390px)** và desktop (1440px); không làm mất nội dung, triết lý Giáo dục Tận Gốc, màu đen than – vàng gold – ivory champagne, font Be Vietnam Pro, hoặc thứ tự 10 khóa học 01–10 đã chốt; không dùng từ “đã xong” cho thứ user chưa xác nhận.
- **Dữ liệu test phải dọn sau khi test:** mọi dòng lead/đơn/học viên test đều phải xóa hoặc đánh dấu rõ sau khi đối soát, để không lẫn với dữ liệu thật.
- **PII trong bằng chứng:** bằng chứng test (screenshot/log) không được chứa SĐT/email thật của người khác; dùng dữ liệu test do chính người test tạo.

---

# Giai đoạn 0 — Quyết định kiến trúc (1–2 tuần)

Mục đích: có quyết định bằng văn bản trước khi viết code. Không có code mới trong giai đoạn này.

## G0.1 — Định nghĩa mục tiêu $100M

- [ ] **G0.1 — Mục tiêu $100M đã được định nghĩa bằng văn bản**
  - **Cách test:** đọc văn bản quyết định do user ký/chốt; kiểm tra trong đó có đúng 1 trong 3 định nghĩa: (a) doanh thu tích lũy 10 năm, (b) lợi nhuận giữ lại, (c) giá trị ròng năm 10.
  - **PASS khi:** văn bản ghi rõ đúng 1 định nghĩa + mốc thời gian 10 năm + chữ ký/xác nhận của user.
  - **FAIL khi:** văn bản ghi 2–3 định nghĩa cùng lúc, hoặc không ghi định nghĩa nào, hoặc chỉ nói miệng.
  - **Ai test:** user (chốt định nghĩa) + QA (đối chiếu văn bản).

## G0.2 — Số liệu thật theo chương trình và kênh

- [ ] **G0.2 — Có bảng số liệu học viên/doanh thu theo chương trình và kênh**
  - **Cách test:** mở bảng số liệu; kiểm tra mỗi chương trình (01–10) có cột số học viên và doanh thu theo kênh (nếu có); đối chiếu 1–2 dòng với nguồn gốc (Sheet/đơn hàng/sao kê).
  - **PASS khi:** bảng có đủ 10 chương trình, mỗi ô hoặc có số thật kèm nguồn, hoặc ghi rõ “chưa có số liệu” — không ô nào bịa số.
  - **FAIL khi:** có con số không truy được nguồn, hoặc bảng thiếu chương trình, hoặc ghi số 0 thay cho “chưa biết”.
  - **Ai test:** user (cung cấp số) + QA (đối chiếu nguồn).

## G0.3 — Rà soát Apps Script + deployment + Sheet thật

- [ ] **G0.3 — Có biên bản rà soát `Code.gs` + deployment Web App + Sheet thật**
  - **Cách test:** mở biên bản; kiểm tra có đủ 5 mục: (1) quyền deploy (Execute as / Anyone), (2) validation server (SĐT `/^0\d{9}$/`, email TLD ≥ 2 ký tự, `source` whitelist), (3) rate-limit (có/không), (4) bản deploy có trùng file `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` hay không, (5) dòng test còn sót trong tab `DATA VISFAR ACADEMY` (có/không, đã xóa chưa).
  - **PASS khi:** biên bản trả lời đủ 5 mục bằng bằng chứng (screenshot deployment, diff file `.gs`, ảnh tab DATA), và mọi dòng test đã xóa.
  - **FAIL khi:** thiếu bất kỳ mục nào, hoặc kết luận “trùng file” mà không có diff, hoặc dòng test vẫn còn trong Sheet.
  - **Ai test:** dev (rà soát) + user (xác nhận quyền deploy).

## G0.4 — Chốt hướng nền tảng

- [ ] **G0.4 — Hướng nền tảng đã chốt bằng văn bản (WordPress + LMS hay web app riêng)**
  - **Cách test:** đọc văn bản quyết định; kiểm tra có nêu hướng đã chọn + lý do (ngân sách, đội ngũ, thời gian) + đánh đổi đã chấp nhận.
  - **PASS khi:** chỉ chốt 1 hướng, có lý do và đánh đổi ghi rõ, user xác nhận.
  - **FAIL khi:** chốt cả 2 hướng, hoặc chốt mà không ghi lý do/đánh đổi, hoặc chưa có xác nhận của user.
  - **Ai test:** user (chốt) + dev (trình bày đánh đổi).

## G0.5 — Chốt sitemap mới và danh mục nội dung cần viết lại

- [ ] **G0.5 — Sitemap mới (Báo cáo §D.2) đã chốt; danh mục nội dung cần user viết lại đã liệt kê**
  - **Cách test:** đối chiếu sitemap đã chốt với §D.2 (13 section hiện tại + `/hoc-vien`, `/dang-nhap`, `/admin`, `/chinh-sach/*` có URL thật); kiểm tra danh mục nội dung gồm đủ: 3 bài blog, thẻ Lĩnh vực 03 “Mối quan hệ”, bước Lộ trình số 2 “Tin”, nội dung 3 khóa 04/05/06 (Sức khỏe / Mối quan hệ / Tài chính), khung thời gian chính sách.
  - **PASS khi:** sitemap chốt khớp §D.2 (hoặc có thay đổi ghi rõ lý do + user duyệt); danh mục nội dung đủ 5 nhóm trên, mỗi nhóm ghi rõ “user viết” hay “giữ tạm, ghi chú nội dung tạm”.
  - **FAIL khi:** sitemap thiếu URL thật cho chính sách, hoặc danh mục nội dung thiếu nhóm, hoặc nội dung do builder viết được coi là “đã duyệt” khi user chưa duyệt.
  - **Ai test:** user (chốt sitemap + nội dung) + QA (đối chiếu §D.2).

## G0.6 — Backlog đã xếp hạng, có người chịu trách nhiệm

- [ ] **G0.6 — Backlog Giai đoạn 1–4 đã xếp hạng, mỗi hạng mục có người chịu trách nhiệm**
  - **Cách test:** mở backlog; kiểm tra mỗi hạng mục có thứ tự ưu tiên + người chịu trách nhiệm + tiêu chí nghiệm thu tương ứng trong file này.
  - **PASS khi:** 100% hạng mục có đủ 3 trường trên; không hạng mục nào “không ai làm”.
  - **FAIL khi:** có hạng mục thiếu người chịu trách nhiệm hoặc thiếu tiêu chí nghiệm thu.
  - **Ai test:** QA (đối chiếu backlog với file này).

## G0.7 — Checklist Phụ lục A kiến trúc đã hoàn tất

- [ ] **G0.7 — Phụ lục A (Tài liệu kiến trúc) đã được user phê duyệt từng mục**
  - **Cách test:** đối chiếu từng mục Phụ lục A: framework frontend (Next.js hay Astro), domain API, ngưỡng hoàn thành bài, quyết định `lessons.slug` UNIQUE theo khóa hay module, khung hoàn trả, thông tin tài khoản ngân hàng + QR VietQR, xác minh lại giới hạn miễn phí (Supabase/Cloudflare/Resend), quyết định SePay/Stripe, tài khoản Supabase/Cloudflare/Resend/GitHub, nội dung thật cho 3 khóa 04/05/06, kế hoạch test RLS + test lead.
  - **PASS khi:** mỗi mục có trạng thái “đã duyệt” hoặc “đã quyết — ghi rõ quyết định” kèm ngày và người duyệt; không mục nào để trống.
  - **FAIL khi:** bất kỳ mục nào chưa có quyết định mà công việc giai đoạn sau đã bắt đầu dựa trên nó.
  - **Ai test:** user (phê duyệt) + QA (đối chiếu Phụ lục A).

---

# Giai đoạn 1 — Cứu đường lead và dọn nợ kỹ thuật (2–3 tuần)

Mục đích: trang hiện tại an toàn để chạy quảng cáo; không còn mất lead mà không ai biết. Đầu ra có test đăng ký thật từ trình duyệt user, đối soát được trong Sheet.

## G1.1 — Test đăng ký thật từ trình duyệt user (bắt buộc, tiêu chí cổng)

- [ ] **G1.1 — Đăng ký thật 1 lần từ trình duyệt user: thank-you chỉ sau khi Sheet/DB có dòng mới, đúng 6 cột, SĐT giữ số 0**
  - **Cách test:** user mở trang đã xuất bản trên trình duyệt của mình (không phải máy dev), điền form `#consultForm`: họ tên thật test (ghi rõ là test), SĐT 10 số bắt đầu bằng 0, email test, **chọn tỉnh từ dropdown `#fCity` (1 trong 34 tỉnh)**, **chọn 1 khóa 01–10 từ dropdown `#fCourse`**; bấm “Đăng ký tham gia”; ghi lại thời gian gửi (giờ:phút:giây). Sau đó mở tab `DATA VISFAR ACADEMY` (giai đoạn 1) hoặc bảng `leads` (khi đã có API) và kiểm tra.
  - **PASS khi:** (1) màn hình cảm ơn **chỉ hiện sau khi** đã thấy dòng mới trong Sheet/DB (thứ tự thời gian chứng minh được: dòng mới có `created_at` trước thời điểm thank-you hiện); (2) đúng **1 dòng mới**; (3) đủ **đúng 6 cột**: Thời gian | Họ và tên | Số điện thoại | Email | Tỉnh / Thành phố | Khóa học quan tâm; (4) **SĐT giữ số 0 đầu** (hiển thị `090…`, không bị Sheet chuyển thành số mất số 0 — cột SĐT có định dạng text `@`); (5) tỉnh và khóa trong dòng mới khớp đúng lựa chọn đã bấm; (6) dòng test đã xóa sau khi kiểm tra xong.
  - **FAIL khi:** thank-you hiện trước khi Sheet có dòng mới; hoặc có 0 dòng mới / ≥ 2 dòng mới; hoặc thiếu/sai cột; hoặc SĐT mất số 0; hoặc tỉnh/khóa trong Sheet khác lựa chọn đã bấm; hoặc dòng test không được xóa.
  - **Ai test:** user (submit từ trình duyệt của mình) + QA/dev (kiểm tra Sheet/DB + xóa dòng test).

## G1.2 — Test fallback (ngắt mạng / chặn fetch)

- [ ] **G1.2 — Ngắt mạng hoặc chặn fetch tới Web App/API → KHÔNG hiện “đã ghi nhận”, hiện lỗi + mã tham chiếu**
  - **Cách test:** bật chế độ offline trong DevTools (hoặc chặn request tới `script.google.com` / API bằng rule chặn), điền form hợp lệ, bấm gửi; ghi lại toàn bộ màn hình sau khi gửi. Lặp lại 1 lần với mạng yếu (throttle 3G chậm) và timeout.
  - **PASS khi:** trang **không** hiện bất kỳ chữ nào mang nghĩa “đã ghi nhận / đã gửi thành công / đã đăng ký thành công”; thay vào đó hiện thông báo lỗi rõ ràng (ví dụ “Chưa xác nhận được — yêu cầu có thể chưa được ghi nhận”) **kèm mã tham chiếu duy nhất** của lần gửi đó; không có dòng mới nào xuất hiện trong Sheet/DB cho lần gửi lỗi này (hoặc nếu có dòng mới do server đã ghi trước khi mất mạng thì mã tham chiếu trong thông báo khớp đúng dòng đó).
  - **FAIL khi:** trang hiện “đã ghi nhận”/“đã gửi” trong khi Sheet/DB không có dòng mới; hoặc hiện lỗi nhưng không có mã tham chiếu; hoặc không hiện gì (trang đứng im).
  - **Ai test:** QA (chặn mạng + ghi màn hình) + dev (đối chiếu Sheet/DB).

## G1.3 — Test chống trùng (idempotency)

- [ ] **G1.3 — Gửi 2 lần cùng idempotency key → chỉ 1 dòng trong Sheet/DB**
  - **Cách test:** gửi 1 form hợp lệ, lấy idempotency key (hoặc mã yêu cầu) của lần gửi đó; gửi lại đúng payload đó lần 2 với **cùng key** (mô phỏng timeout 30s + fallback, hoặc bấm gửi 2 lần liên tiếp); kiểm tra Sheet/DB sau cả 2 lần.
  - **PASS khi:** Sheet/DB chỉ có **đúng 1 dòng** cho key đó; lần gửi thứ 2 trả về kết quả trùng (`duplicate: true`, kèm mã tham chiếu cũ — theo Tài liệu kiến trúc §7.5) thay vì tạo dòng mới; 2 lần gửi đều có cùng `reference_code`.
  - **FAIL khi:** Sheet/DB có 2 dòng cho cùng 1 lần đăng ký; hoặc lần 2 tạo mã tham chiếu mới; hoặc lần 2 báo lỗi thay vì trả kết quả cũ.
  - **Ai test:** QA (gửi trùng) + dev (kiểm tra DB + response).

## G1.4 — Test chống spam

- [ ] **G1.4 — POST sai định dạng / ngoài whitelist → bị từ chối, không có dòng rác mới**
  - **Cách test:** POST trực tiếp lên endpoint (Web App ở giai đoạn 1, `/api/leads` ở giai đoạn sau) 5 trường hợp: (1) SĐT sai định dạng (9 số, 11 số, `+84…`); (2) email TLD 1 ký tự (`a@b.c`); (3) `province` ngoài 34 tỉnh; (4) `course` không tồn tại/không published; (5) honeypot có giá trị (nếu đã triển khai) hoặc thiếu `source` hợp lệ. Ghi lại status + body trả về từng trường hợp; kiểm tra Sheet/DB trước và sau.
  - **PASS khi:** cả 5 trường hợp đều bị từ chối (400, `ok: false`, mã lỗi rõ ràng như `invalid_phone`); **không có dòng rác mới nào** trong Sheet/DB; rate-limit hoạt động: gửi > 5 lần/giờ/IP (mức theo Tài liệu kiến trúc §7.2) thì request thứ 6 trả 429 và không ghi dữ liệu.
  - **FAIL khi:** bất kỳ trường hợp nào ghi được dòng vào Sheet/DB; hoặc trả `ok: true` cho dữ liệu sai; hoặc không có rate-limit (gửi 10 lần liên tiếp đều ghi được).
  - **Ai test:** dev (POST trực tiếp) + QA (đối chiếu Sheet/DB).

## G1.5 — Test không JavaScript

- [ ] **G1.5 — Tắt JavaScript: form vẫn gửi được (qua `action` dự phòng) hoặc hiện thông báo rõ ràng**
  - **Cách test:** tắt JavaScript trong trình duyệt, tải lại trang, điền form đầy đủ, bấm gửi; ghi lại kết quả. Kiểm tra mã nguồn: form có `action` + `method` hay không.
  - **PASS khi:** một trong hai: (a) form gửi được qua `action` dự phòng và Sheet/DB có dòng mới đúng 6 cột; hoặc (b) trang hiện thông báo rõ ràng, dễ thấy ngay tại form: “Cần bật JavaScript để đăng ký” + cách liên hệ thay thế (Zalo/số điện thoại). Không chấp nhận cả hai đều không có.
  - **FAIL khi:** tắt JS thì bấm gửi không có phản hồi gì, hoặc form biến mất, hoặc trang trắng/lỗi — mà không có thông báo nào.
  - **Ai test:** QA (tắt JS + test) + dev (kiểm tra `action`/`method`).

## G1.6 — Kiểm tra PII không còn trong mailto/clipboard

- [ ] **G1.6 — Grep mã nguồn: không còn họ tên/SĐT/email trong `mailto:`, `data-body`, clipboard**
  - **Cách test:** chạy grep trên mã nguồn trang/API: tìm `mailto:` kèm biến chứa họ tên/SĐT/email; tìm `data-body` chứa PII; tìm `clipboard.writeText` / `execCommand("copy")` với nội dung chứa PII. Kiểm tra cả nhánh fallback và hộp dự phòng.
  - **PASS khi:** grep = 0 vị trí PII (họ tên, SĐT, email, tỉnh) trong `mailto:`, `data-body`, clipboard; hộp dự phòng (nếu còn) chỉ chứa **mã tham chiếu**, không chứa PII; PII chỉ đi qua POST HTTPS tới server.
  - **FAIL khi:** còn ≥ 1 vị trí PII trong mailto/clipboard/data-body; hoặc hộp dự phòng vẫn hiện đủ họ tên + SĐT + email.
  - **Ai test:** dev (grep + sửa) + QA (grep lại độc lập).

## G1.7 — SEO cơ bản + chính sách có URL thật

- [ ] **G1.7a — Có `<h1>` thật cho trang chính**
  - **Cách test:** mở trang chính, kiểm tra DOM: có đúng 1 `<h1>` trong nội dung chính (không nằm trong `#policyView` ẩn), nội dung là tên/thương hiệu trang.
  - **PASS khi:** đúng 1 h1 trong nội dung chính, hiển thị được (không `display:none`), screen-reader đọc được.
  - **FAIL khi:** 0 h1 trong nội dung chính, hoặc ≥ 2 h1, hoặc h1 duy nhất vẫn nằm trong khối ẩn.
  - **Ai test:** QA (kiểm tra DOM) + dev.
- [ ] **G1.7b — Có OG / Twitter / canonical / robots / JSON-LD và CSP**
  - **Cách test:** đọc `<head>` của trang chính: kiểm tra `og:title`, `og:description`, `og:image`, `twitter:card`, `<link rel="canonical">`, `robots`, `application/ld+json` (Organization + Course); kiểm tra header `Content-Security-Policy` trả về từ server/hosting. Dán link trang lên Zalo/Facebook để xem preview.
  - **PASS khi:** đủ các thẻ trên, nội dung khớp trang thật (tiêu đề/mô tả/ảnh đúng); preview Zalo/Facebook hiện ảnh + tiêu đề đẹp; CSP có và không chặn tài nguyên hợp lệ của trang.
  - **FAIL khi:** thiếu bất kỳ thẻ nào; hoặc preview Zalo/Facebook không có ảnh/tiêu đề; hoặc CSP chặn JS/CSS/ảnh của chính trang.
  - **Ai test:** QA (kiểm tra head + preview) + dev (CSP).
- [ ] **G1.7c — Chính sách mở được bằng URL thật, không cần JS**
  - **Cách test:** tắt JS, truy cập trực tiếp URL từng chính sách (`/chinh-sach/bao-mat`, `/chinh-sach/dieu-khoan-tham-gia`, `/chinh-sach/hoan-tra-huy-dang-ky`, `/chinh-sach/giai-quyet-khieu-nai` — hoặc URL thật tương đương đã chốt); kiểm tra 4 link footer đều mở đúng trang.
  - **PASS khi:** cả 4 URL mở được nội dung đầy đủ khi tắt JS; link footer trỏ đúng URL thật (không còn hash `#chinh-sach-…` không có đích).
  - **FAIL khi:** bất kỳ URL nào trắng/lỗi khi tắt JS, hoặc link footer vẫn là hash giả.
  - **Ai test:** QA (tắt JS + bấm 4 link).

## G1.8 — Dọn nội dung lỗi thời và tên khóa cũ

- [ ] **G1.8 — 0 chỗ tên khóa cũ; sự kiện 05/2026 đã cập nhật hoặc gỡ; newsletter thật hoặc đã xóa**
  - **Cách test:** grep toàn trang các tên cũ: “Thấu Hiểu Bản Thân”, “Khai Mở Trí Tuệ”, “Kiến Tạo Nhân Hiệu” (báo cáo ghi 5 chỗ: link tài nguyên “Bắt đầu tại đây” + 1 câu FAQ + các chỗ khác); kiểm tra 3 thẻ sự kiện (22/25/28-05-2026, pill “Đã diễn ra”); kiểm tra footer newsletter: nhập email test, bấm “Đăng ký”, kiểm tra email có được lưu/ghi nhận ở đâu không.
  - **PASS khi:** grep tên cũ = 0; link “Bắt đầu tại đây” pre-select đúng khóa mới (bấm vào thì form chọn đúng khóa); sự kiện đã cập nhật ngày mới hoặc đã gỡ (không còn tiêu đề “sắp diễn ra” đi kèm toàn thẻ “Đã diễn ra” quá 5 tháng); newsletter hoặc ghi được email thật vào `newsletter_subscribers`/Sheet, hoặc input đã xóa hẳn.
  - **FAIL khi:** còn ≥ 1 tên cũ; hoặc link tài nguyên bấm vào không pre-select được khóa nào; hoặc sự kiện cũ vẫn còn nguyên; hoặc newsletter vẫn là form giả (email gõ vào bị bỏ).
  - **Ai test:** QA (grep + bấm link) + user (xác nhận nội dung sự kiện mới).

## G1.9 — Dọn dead code

- [ ] **G1.9 — Dead code đã xóa hoặc đã khôi phục thành tính năng thật**
  - **Cách test:** grep mã nguồn: `.intl-`, `#phuong-phap-giao-duc`, `#he-thong`, `.phil-subtitle`, `data-copy`, `floatCta`; đối chiếu mỗi kết quả với phần tử/tính năng thật.
  - **PASS khi:** mỗi mục hoặc grep = 0 (đã xóa), hoặc có phần tử/tính năng thật hoạt động được (ví dụ `floatCta` hiện nút CTA nổi sau 700px như thiết kế cũ — test bấm được).
  - **FAIL khi:** còn selector/handler trỏ tới phần tử không tồn tại mà không có ghi chú “đã quyết giữ”; hoặc `floatCta` được “khôi phục” nhưng bấm không có tác dụng.
  - **Ai test:** dev (grep + dọn) + QA (grep lại độc lập).

## G1.10 — Không thêm khối chốt CSS mới

- [ ] **G1.10 — Không thêm khối chốt CSS mới trong Giai đoạn 1; danh mục 300 `!important` đã lập**
  - **Cách test:** đếm `!important` trong file trước và sau Giai đoạn 1 (baseline: 300 lần, ngày 10/11/2026); kiểm tra diff CSS: không có khối `<style>` chốt cuối mới; kiểm tra có file danh mục 300 `!important` để dọn dần ở Giai đoạn 2.
  - **PASS khi:** số `!important` không tăng so với 300; không có khối chốt mới; có danh mục dọn dần.
  - **FAIL khi:** `!important` tăng, hoặc xuất hiện khối chốt CSS mới dù chỉ 1 khối.
  - **Ai test:** dev (đếm + diff) + QA (đếm lại).

---

# Giai đoạn 2 — Tách tài nguyên và CMS nội dung (3–4 tuần)

Mục đích: trang công khai chạy trên kiến trúc file tách rời, đo được hiệu suất cải thiện; nội dung quản lý được qua CMS.

## G2.1 — Hiệu năng: file HTML đầu tiên < 500 KB

- [ ] **G2.1 — File HTML đầu tiên (HTML+CSS+JS, chưa tính ảnh lazy) < 500 KB; FCP/LCP cải thiện có số đo**
  - **Cách test:** đo kích thước file HTML đầu tiên trả về (DevTools Network, tắt cache, đo 3 lần lấy trung bình) trên desktop và điện thoại thật 390px (mạng 4G); đo FCP/LCP bằng Lighthouse (mobile) trước và sau, ghi số vào bảng trước/sau.
  - **PASS khi:** file HTML đầu tiên **< 500 KB** (từ 5,5 MB baseline ngày 10/11/2026); FCP và LCP đều giảm so với trước (ghi rõ số trước/sau, ví dụ LCP từ X giây xuống Y giây); không còn base64 ảnh/font trong HTML (ảnh/font thành file riêng).
  - **FAIL khi:** file HTML đầu tiên ≥ 500 KB; hoặc FCP/LCP không cải thiện (tăng hoặc bằng); hoặc còn base64 ảnh/font trong HTML.
  - **Ai test:** QA (đo Lighthouse + Network) + dev.

## G2.2 — Ảnh và font tách riêng

- [ ] **G2.2 — Ảnh có `srcset`/`sizes`, lazy loading thật; font `.woff2` riêng, subset tiếng Việt**
  - **Cách test:** kiểm tra 27 ảnh hiện tại (baseline): mỗi ảnh có `srcset` + `sizes`, file riêng (không `data:` URI), `loading="lazy"` trừ ảnh hero/logo; kiểm tra font: file `.woff2` riêng, subset tiếng Việt, `font-display:swap`, preload chỉ weight dùng nhiều.
  - **PASS khi:** 0 ảnh còn `data:` URI; 100% ảnh nội dung có `srcset`; font tải dưới dạng file riêng, tổng font < 643 KB base64 cũ; ảnh 1600px không còn tải đủ trên điện thoại 390px (kiểm tra Network: ảnh tải về ≤ 800px ở 390px).
  - **FAIL khi:** còn ≥ 1 ảnh base64; hoặc ảnh thiếu `srcset`; hoặc điện thoại 390px vẫn tải ảnh 1600px.
  - **Ai test:** QA (Network + kiểm tra `srcset`) + dev.

## G2.3 — CMS hoạt động: thêm 1 khóa học test không sửa tay HTML

- [ ] **G2.3 — Thêm 1 khóa học test qua CMS: tự hiện ở lưới, form option, footer link, tab lọc với số đếm đúng; xóa sau khi test**
  - **Cách test:** tạo 1 khóa học test qua CMS/admin (tiêu đề ghi rõ “TEST — xóa sau kiểm tra”); tải lại trang chính, kiểm tra 4 nơi: (1) lưới khóa học `#courseGrid` có thẻ mới; (2) dropdown `#fCourse` có option mới; (3) footer link tới khóa mới; (4) tab lọc và dòng `#courseCount` đếm đúng (ví dụ “Đang hiển thị 11 / 11 chương trình”, tab “Tất cả” = 11). Sau đó xóa khóa test qua CMS và kiểm tra 4 nơi đều mất khóa đó.
  - **PASS khi:** khóa test xuất hiện đủ 4 nơi mà **không sửa tay file HTML**; số đếm khớp ở cả 4 nơi; sau khi xóa, 4 nơi đều không còn khóa test; thứ tự 10 khóa thật 01–10 không đổi.
  - **FAIL khi:** phải sửa tay HTML ở bất kỳ nơi nào; hoặc số đếm sai ở 1 nơi; hoặc sau khi xóa, khóa test còn sót ở 1 nơi; hoặc thứ tự 10 khóa thật bị xáo.
  - **Ai test:** QA (tạo/xóa khóa test) + dev (xác nhận không sửa tay HTML).

## G2.4 — Blog và sự kiện có trang chi tiết thật

- [ ] **G2.4 — Mỗi bài blog có trang đầy đủ; mỗi sự kiện có trang chi tiết; nút “Xem chi tiết” không còn trỏ về `#tu-van`**
  - **Cách test:** bấm từng bài trong 3 bài blog → kiểm tra có trang bài đầy đủ (nội dung, không chỉ tiêu đề + đoạn ngắn); bấm “Xem chi tiết” từng thẻ sự kiện → kiểm tra mở trang chi tiết sự kiện (ngày, giờ, địa điểm, nút đăng ký sự kiện cụ thể), không phải cuộn về form tư vấn.
  - **PASS khi:** 3/3 bài blog có trang đầy đủ; 3/3 sự kiện có trang chi tiết; 0 nút “Xem chi tiết” sự kiện còn trỏ về `#tu-van`; trạng thái sự kiện đúng (không còn “sắp diễn ra” mà toàn thẻ “Đã diễn ra” — theo Tài liệu kiến trúc §3.2, `status` phải là `upcoming`/`happened`/`cancelled` đúng thực tế).
  - **FAIL khi:** bất kỳ bài blog nào không có trang đầy đủ; hoặc bất kỳ nút sự kiện nào còn trỏ về `#tu-van`; hoặc trạng thái sự kiện sai thực tế.
  - **Ai test:** QA (bấm từng link) + user (xác nhận nội dung bài/sự kiện).

## G2.5 — Chữ và tương phản: audit lại toàn bộ cỡ chữ < 16px

- [ ] **G2.5 — Audit lại toàn bộ cỡ chữ < 16px, có bảng trước/sau; tuyên ngôn 13,65px và nhãn Tam giác đã có quyết định của user**
  - **Cách test:** quét toàn bộ CSS, lập bảng mọi khai báo `font-size` < 16px (baseline báo cáo A.4: 191 khai báo dưới 1rem, `.72rem` ≈ 11,5px, nhãn SVG Tam giác 11,5px → ~4px ở 390px); kiểm tra từng vị trí sau sửa trên điện thoại thật 390px (đọc được hay không); kiểm tra quyết định của user về tuyên ngôn và Tam giác (xem “Các tiêu chí cần chủ dự án phê duyệt” cuối file).
  - **PASS khi:** có bảng trước/sau đầy đủ; thân bài ≥ 16px ở mọi vị trí trên 390px và 1440px; nhãn ≥ 14px (sàn nhãn theo khối audit cuối) — mọi vị trí dưới sàn đều có quyết định bằng văn bản của user; tuyên ngôn và Tam giác đã có quyết định (chấp nhận / bỏ 1 dòng / thu hẹp đệm / legend mới / tách nửa / chạm-vòng-hiện-nhãn-lớn) và đã làm đúng quyết định đó.
  - **FAIL khi:** thiếu bảng trước/sau; hoặc còn thân bài < 16px mà không có quyết định của user; hoặc tuyên ngôn/Tam giác vẫn ở trạng thái “chưa quyết” mà coi là xong.
  - **Ai test:** QA (quét CSS + test đọc trên điện thoại thật) + user (quyết định tuyên ngôn/Tam giác).

## G2.6 — Sitemap mới đi vào hoạt động, không còn link chết

- [ ] **G2.6 — Sitemap mới (Báo cáo §D.2) hoạt động ở phần công khai; không còn link chết trong menu/footer**
  - **Cách test:** bấm toàn bộ link menu (6 mục) + footer nav + 4 link chính sách + `.journey-nav` (13 link); kiểm tra mỗi link mở đúng đích (status 200, nội dung đúng); kiểm tra `sitemap.xml` có và khớp URL thật.
  - **PASS khi:** 100% link mở đúng đích, 0 link chết (404/trắng/hash giả); `sitemap.xml` có, chứa đủ URL công khai đã chốt.
  - **FAIL khi:** ≥ 1 link chết hoặc mở sai đích; hoặc thiếu `sitemap.xml`.
  - **Ai test:** QA (bấm toàn bộ link + kiểm tra sitemap).

---

# Giai đoạn 3 — Tài khoản học viên và thanh toán (4–6 tuần)

Mục đích: học viên thật học được 1 khóa hoàn toàn trên hệ thống mới; thanh toán đối soát được. Không nhận học phí qua trang cho tới khi giai đoạn này xong.

## G3.1 — Học viên thật học được 1 khóa (luồng đầu-cuối)

- [ ] **G3.1 — 1 học viên test đăng ký, đăng nhập, ghi danh 1 khóa, học 1 bài, làm 1 quiz, tiến độ ghi nhận đúng; đăng xuất rồi đăng nhập lại vẫn thấy tiến độ**
  - **Cách test:** tạo tài khoản test (email test riêng); đăng nhập; ghi danh 1 khóa (miễn phí hoặc qua đơn test — xem G3.2); học 1 bài (xem video/đọc bài tới ≥ 90% theo ngưỡng đã chốt — xem tiêu chí cần phê duyệt); làm 1 quiz; kiểm tra tiến độ trong DB (`lesson_progress`) và trên dashboard; đăng xuất, đăng nhập lại, kiểm tra tiến độ vẫn còn; kiểm tra nút “tiếp tục học” mở đúng vị trí dở (`last_position_sec`).
  - **PASS khi:** toàn bộ luồng chạy được bằng tài khoản test; tiến độ trong DB khớp với những gì học viên đã làm (đúng bài, đúng %, đúng thời gian); sau khi đăng nhập lại, tiến độ không mất; “tiếp tục học” mở đúng bài và đúng vị trí dở (± 10 giây).
  - **FAIL khi:** bất kỳ bước nào lỗi; hoặc tiến độ trong DB sai/không ghi; hoặc đăng nhập lại mất tiến độ; hoặc “tiếp tục học” mở sai bài/vị trí.
  - **Ai test:** QA (đóng vai học viên test) + dev (kiểm tra DB).

## G3.2 — Thanh toán: đơn pending → paid chỉ qua webhook/admin, không qua client

- [ ] **G3.2a — Luồng chuyển khoản thủ công: tạo đơn → QR/STK/mã đơn → admin xác nhận → paid + enrollment + email**
  - **Cách test:** học viên test tạo đơn cho 1 khóa (qua `POST /api/orders`); kiểm tra đơn ở trạng thái `pending`, có `reference_code` duy nhất (VD `DH-2026-000123`), có QR VietQR + STK + số tiền + nội dung = mã đơn + hạn giữ chỗ 48h; admin xác nhận thủ công (`POST /api/admin/orders/:id/mark-paid`) sau khi kiểm tra sao kê test; kiểm tra đơn → `paid`, có dòng `payments` (`bank_transfer`, `succeeded`), enrollment được tạo, học viên nhận email `order-paid` và vào học được ngay.
  - **PASS khi:** đủ 7 điểm: (1) đơn `pending` có mã đơn duy nhất; (2) QR/STK/số tiền/nội dung/hạn 48h hiển thị đúng; (3) đơn không tự chuyển `paid` trước khi admin xác nhận; (4) sau admin xác nhận, đơn `paid` + có `payments` + có enrollment; (5) email `order-paid` đã gửi (có dòng trong `email_logs`); (6) học viên vào học được ngay; (7) `audit_logs` có dòng `order.mark_paid` với admin thực hiện.
  - **FAIL khi:** thiếu bất kỳ điểm nào; hoặc đơn tự chuyển `paid` mà không có admin/webhook; hoặc QR sai tài khoản/số tiền/nội dung (kiểm tra bằng cách quét thử).
  - **Ai test:** QA (đóng vai học viên) + user/admin (xác nhận thủ công + quét QR) + dev (kiểm tra DB/email_logs).
- [ ] **G3.2b — Client tự báo “đã trả” KHÔNG làm đơn chuyển sang `paid`**
  - **Cách test:** (1) gọi trực tiếp API giả mạo “đã trả” từ client (POST không có chữ ký webhook, hoặc sửa response client); (2) thử sửa trạng thái đơn qua Supabase client với anon key / JWT học viên; kiểm tra trạng thái đơn trong DB sau mỗi lần thử.
  - **PASS khi:** cả 2 cách đều thất bại — đơn vẫn `pending`, không có dòng `payments` mới, không có enrollment mới; server trả lỗi (401/403/400) và ghi log.
  - **FAIL khi:** bất kỳ cách nào làm đơn chuyển `paid` hoặc tạo được enrollment; hoặc server trả `ok: true` cho request giả.
  - **Ai test:** dev (tấn công giả lập) + QA (kiểm tra DB).
- [ ] **G3.2c — Đơn quá hạn 48h → `expired`; email nhắc 12h và 24h đã gửi**
  - **Cách test:** tạo đơn test, không thanh toán, chờ (hoặc chỉnh `expires_at` về quá khứ trong DB test); kiểm tra đơn chuyển `expired`, học viên tạo được đơn mới; kiểm tra `email_logs` có email nhắc `order-reminder-12h` và `order-reminder-24h` đúng thời điểm.
  - **PASS khi:** đơn quá hạn chuyển `expired` đúng; email nhắc 12h và 24h đều có trong `email_logs` với đúng template và đúng người nhận; học viên tạo đơn mới được (không bị kẹt ở đơn cũ).
  - **FAIL khi:** đơn quá hạn vẫn `pending`; hoặc thiếu email nhắc; hoặc học viên không tạo được đơn mới.
  - **Ai test:** QA + dev (kiểm tra DB/email_logs).
- [ ] **G3.2d — Hoàn trả test đi đúng khung thời gian chính sách đã công bố**
  - **Cách test:** tạo đơn test đã `paid`, yêu cầu hoàn trả; admin thực hiện hoàn trả (`POST /api/admin/orders/:id/refund`); kiểm tra đơn → `refunded`, có dòng `payments` hoàn trả, enrollment bị thu hồi (`status=revoked`), học viên nhận email `refund-done`; đối chiếu thời gian hoàn trả với khung chính sách đã được user duyệt (xem tiêu chí cần phê duyệt — khung 3/7/15 ngày làm việc hiện do builder viết, chưa được duyệt).
  - **PASS khi:** đơn `refunded` + có `payments` hoàn trả + enrollment `revoked` + email `refund-done` đã gửi; thời gian xử lý nằm trong khung chính sách đã duyệt.
  - **FAIL khi:** thiếu bất kỳ điểm nào; hoặc hoàn trả xong mà enrollment vẫn `active`; hoặc khung thời gian áp dụng chưa được user duyệt.
  - **Ai test:** QA + user/admin (thực hiện hoàn trả) + dev.

## G3.3 — Quiz: đáp án đúng không lộ ở client, chấm ở server

- [ ] **G3.3a — API lấy câu hỏi KHÔNG trả `is_correct` về client**
  - **Cách test:** gọi `GET /api/my/quiz/:lessonId` bằng JWT học viên đã ghi danh; đọc toàn bộ response JSON (kiểm tra cả field ẩn, header, và Network tab trình duyệt); kiểm tra mã nguồn frontend không chứa đáp án đúng hard-code.
  - **PASS khi:** response chỉ có câu hỏi + các lựa chọn (id, text, thứ tự), **không có field nào** cho biết đáp án đúng (`is_correct`, `correct`, `answer`…); Network tab không lộ đáp án; grep frontend = 0 đáp án đúng.
  - **FAIL khi:** response chứa bất kỳ dấu hiệu nào của đáp án đúng; hoặc frontend có đáp án hard-code.
  - **Ai test:** dev (gọi API + đọc JSON) + QA (Network tab).
- [ ] **G3.3b — Nộp quiz: chấm ở server, lưu `quiz_attempts`, trả điểm + đáp án đúng chỉ sau khi nộp**
  - **Cách test:** học viên test nộp quiz (1 lần đúng hết, 1 lần sai 1 câu); kiểm tra response trả điểm đúng số câu; kiểm tra DB `quiz_attempts` có dòng mới (đúng `score`, `total`, `answers` đã chọn — không lưu đáp án đúng ở đây); kiểm tra đáp án đúng chỉ hiện sau khi nộp, không hiện trước.
  - **PASS khi:** điểm trả về khớp số câu đúng thật (tính tay đối chiếu); `quiz_attempts` lưu đúng; đáp án đúng không hiện trước khi nộp.
  - **FAIL khi:** điểm sai; hoặc `quiz_attempts` thiếu/sai; hoặc đáp án đúng lộ trước khi nộp; hoặc client tự gửi điểm mà server tin (thử gửi `score: 10/10` từ client — server phải chấm lại, không tin điểm client gửi).
  - **Ai test:** QA (làm quiz) + dev (kiểm tra DB + thử gửi điểm giả).

## G3.4 — Tiến độ: chống gian lận, ngưỡng hoàn thành

- [ ] **G3.4 — Không cho nhảy 0% → 100% trong 1 giây; bài hoàn thành khi `progress_percent >= 90%` (video) hoặc bấm “Đã hoàn thành” (bài text)**
  - **Cách test:** (1) gửi `POST /api/my/progress` với `progress_percent` nhảy từ 0 lên 100 trong 1 request cho bài video dài (ví dụ video 10 phút); (2) gửi tiến độ hợp lệ (xem tới 90% thời lượng) rồi đánh dấu hoàn thành; (3) thử gửi `progress_percent` = 150 và = -5.
  - **PASS khi:** (1) server từ chối hoặc không đánh dấu hoàn thành cho lần nhảy 0→100 trong 1 giây (theo ngưỡng `video_duration_sec` đã chốt); (2) bài hoàn thành đúng khi đạt ngưỡng 90% (hoặc ngưỡng khác đã được user phê duyệt — xem tiêu chí cần phê duyệt); (3) giá trị ngoài 0–100 bị từ chối (400).
  - **FAIL khi:** nhảy 0→100 trong 1 giây vẫn được đánh dấu hoàn thành; hoặc ngưỡng áp dụng khác ngưỡng đã duyệt mà không có quyết định; hoặc giá trị ngoài 0–100 được chấp nhận.
  - **Ai test:** dev (gửi request giả lập) + QA (kiểm tra DB).

## G3.5 — Email: ghi `email_logs`, đúng template

- [ ] **G3.5 — Mọi email giao dịch đều có dòng trong `email_logs` với đúng template, đúng người nhận, đúng trạng thái**
  - **Cách test:** thực hiện các trigger: đăng ký tài khoản (E1 `welcome`), tạo lead (E3 `lead-received` + E4 `lead-notify-admin`), tạo đơn (E5 `order-created`), đơn đã trả (E8 `order-paid`), hoàn thành khóa (E9 `course-completed`); sau mỗi trigger, kiểm tra bảng `email_logs` (đủ `to_email`, `template`, `resend_id`, `status`); mở email thật nhận được, đối chiếu nội dung với template (tiếng Việt, giọng tự nhiên, ít emoji, không FOMO mạnh).
  - **PASS khi:** mỗi trigger tạo đúng 1 dòng `email_logs` với đúng template + đúng người nhận + `status` cập nhật theo webhook Resend (`sent` → `delivered`/`bounced`); nội dung email khớp template; email gửi từ domain riêng của Visfar (đã xác minh SPF/DKIM/DMARC), **không** gửi từ `onboarding@resend.dev` cho người dùng thật.
  - **FAIL khi:** thiếu dòng `email_logs` cho bất kỳ trigger nào; hoặc sai template/người nhận; hoặc email gửi từ `onboarding@resend.dev`; hoặc `status` mãi ở `queued` mà không cập nhật.
  - **Ai test:** QA (kích trigger + mở email thật) + dev (kiểm tra `email_logs` + DNS).

## G3.6 — Bảo mật tài khoản và phân quyền

- [ ] **G3.6a — Mật khẩu được hash, không lưu plain-text; session hết hạn đúng**
  - **Cách test:** kiểm tra DB: cột mật khẩu (qua Supabase Auth) không chứa plain-text (không đọc được mật khẩu thật từ DB); đăng nhập, chờ hết hạn session (hoặc thu hồi session), kiểm tra token cũ không dùng được nữa (API trả 401).
  - **PASS khi:** không tìm thấy mật khẩu plain-text trong DB/log; token hết hạn bị từ chối (401); refresh token hoạt động đúng.
  - **FAIL khi:** mật khẩu plain-text xuất hiện ở bất kỳ đâu (DB/log/email); hoặc token hết hạn vẫn dùng được.
  - **Ai test:** dev (kiểm tra DB + token).
- [ ] **G3.6b — Học viên không vào được `/admin`; instructor không xem được lead**
  - **Cách test:** đăng nhập bằng tài khoản học viên test, truy cập `/admin` và `GET /api/admin/leads`; đăng nhập bằng tài khoản instructor test, truy cập `GET /api/admin/leads` và trang quản lý đơn hàng; ghi lại response.
  - **PASS khi:** học viên vào `/admin` bị chặn (redirect về trang học viên hoặc 403); instructor gọi API lead bị từ chối (403); không có dữ liệu admin/lead nào lộ trong response.
  - **FAIL khi:** bất kỳ tài khoản nào không phải admin xem được trang/dữ liệu admin hoặc lead.
  - **Ai test:** QA (đăng nhập từng role + truy cập) + dev.

## G3.7 — Dữ liệu: một nguồn sự thật

- [ ] **G3.7 — Lead, học viên, đơn hàng mỗi thứ chỉ có 1 bảng chính; Sheet (nếu còn) chỉ là bản sao, khớp với database**
  - **Cách test:** liệt kê bảng chính cho lead (`leads`), học viên (`profiles`), đơn hàng (`orders`); kiểm tra không còn đường ghi nào khác (không còn form nào ghi thẳng vào Sheet mà bỏ qua DB); đối chiếu số dòng Sheet (nếu còn dùng làm bản sao) với số dòng `leads` trong DB cùng thời điểm.
  - **PASS khi:** mỗi thực thể chỉ có 1 bảng chính; mọi đường ghi đều qua API → DB; Sheet (nếu còn) khớp số dòng với DB (sai lệch = 0, hoặc sai lệch có giải thích bằng văn bản + đã xử lý).
  - **FAIL khi:** còn đường ghi song song vào Sheet; hoặc Sheet lệch số dòng với DB mà không có giải thích.
  - **Ai test:** dev (liệt kê đường ghi) + QA (đối chiếu số dòng).

---

# Giai đoạn 4 — LMS đầy đủ và vận hành (4–6 tuần, lặp lại)

Mục đích: nền tảng vận hành được với 100–1.000 học viên, có số liệu để quyết định bước tiếp theo.

## G4.1 — Vận hành với 100–1.000 học viên

- [ ] **G4.1 — Hệ thống chịu được số học viên mục tiêu; có backup tự động và quy trình rollback; có giám sát và cảnh báo khi form/API lỗi**
  - **Cách test:** (1) kiểm tra backup: file `pg_dump` mới nhất (trong 24h) tồn tại, restore thử lên project staging 1 lần/tháng và đếm số dòng các bảng chính khớp production; (2) kiểm tra rollback: deploy lại 1 commit cũ trên Cloudflare Pages/Workers thành công; (3) kiểm tra giám sát: giả lập lỗi form/API (tắt Workers hoặc trả lỗi 500), xác nhận cảnh báo tới admin trong vòng 15 phút; (4) kiểm tra giới hạn miễn phí chưa chạm ngưỡng chặn (Supabase DB < 500 MB, Storage < 1 GB, Resend < 100 email/ngày, Workers < 100.000 request/ngày — theo Tài liệu kiến trúc §12.1, đã xác minh lại trên trang pricing chính thức).
  - **PASS khi:** backup trong 24h + restore thử khớp số dòng; rollback deploy lại được; cảnh báo lỗi tới admin ≤ 15 phút; chưa chạm ngưỡng chặn nào (hoặc đã có phương án nâng cấp được phê duyệt).
  - **FAIL khi:** backup quá 24h hoặc restore thử lệch số dòng; hoặc rollback thất bại; hoặc giả lập lỗi mà không có cảnh báo; hoặc đã chạm ngưỡng chặn mà chưa có phương án.
  - **Ai test:** dev (backup/restore/rollback) + QA (giả lập lỗi + đo thời gian cảnh báo).

## G4.2 — Chứng chỉ hoàn thành

- [ ] **G4.2 — 1 học viên hoàn thành 1 khóa và nhận chứng chỉ ghi nhận được**
  - **Cách test:** học viên test hoàn thành 100% bài của 1 khóa (theo ngưỡng G3.4); kiểm tra `enrollments.status = completed`, `completed_at` có giá trị, bảng `certificates` có dòng mới với `certificate_code` duy nhất (VD `VISFAR-CERT-2026-000123`); học viên mở được chứng chỉ của mình; kiểm tra không cấp trùng (1 học viên + 1 khóa chỉ có 1 chứng chỉ).
  - **PASS khi:** đủ 4 điểm: enrollment `completed` + có `certificate_code` duy nhất + học viên xem được chứng chỉ + không trùng; email `course-completed` đã gửi.
  - **FAIL khi:** thiếu bất kỳ điểm nào; hoặc cấp 2 chứng chỉ cho cùng 1 học viên + 1 khóa.
  - **Ai test:** QA (học hết khóa test) + dev (kiểm tra DB).

## G4.3 — Admin quản lý được toàn bộ mà không cần sửa code

- [ ] **G4.3 — Admin quản lý được khóa học, học viên, lead, đơn hàng, sự kiện, blog, chính sách (có versioning) qua giao diện admin**
  - **Cách test:** admin (user) thực hiện qua giao diện, không sửa code: (1) tạo/sửa 1 khóa học; (2) đổi trạng thái 1 lead + ghi chú; (3) xem danh sách học viên; (4) xác nhận 1 đơn `paid`; (5) tạo/sửa 1 sự kiện; (6) đăng 1 bài blog; (7) sửa 1 chính sách — kiểm tra version tăng (+1) và chỉ 1 bản `is_current` / 1 slug, bản cũ còn đọc được; (8) xem báo cáo R1–R4.
  - **PASS khi:** cả 8 thao tác làm được qua giao diện, thay đổi hiện ngay trên trang công khai (nơi áp dụng); chính sách có versioning đúng (version tăng, bản cũ còn nguyên); không thao tác nào cần sửa code.
  - **FAIL khi:** bất kỳ thao tác nào phải sửa code mới làm được; hoặc sửa chính sách ghi đè bản cũ (mất version cũ); hoặc có 2 bản `is_current` cùng 1 slug.
  - **Ai test:** user/admin (thực hiện 8 thao tác) + QA (kiểm tra trang công khai + DB).

## G4.4 — Báo cáo bằng số thật

- [ ] **G4.4 — Có báo cáo học viên/doanh thu theo chương trình và kênh bằng số thật (R1–R10)**
  - **Cách test:** mở từng báo cáo R1–R10 (Tài liệu kiến trúc §11.2): tổng quan, lead, học viên theo khóa, doanh thu, tiến độ, quiz, sự kiện, email, đối soát thanh toán (R9), tăng trưởng; đối chiếu 2–3 con số trong mỗi báo cáo với dữ liệu gốc trong DB (đếm tay bằng query).
  - **PASS khi:** cả 10 báo cáo mở được, có phân trang + lọc theo thời gian; số liệu khớp với DB (sai lệch = 0 trong mẫu đối chiếu); báo cáo R9 phát hiện được đơn `pending` quá 48h, đơn `paid` chưa có enrollment, payment không khớp order (nếu có trường hợp test).
  - **FAIL khi:** bất kỳ báo cáo nào không mở được, thiếu phân trang/lọc, hoặc số liệu lệch với DB; hoặc R9 không phát hiện được trường hợp test đã tạo cố ý.
  - **Ai test:** QA (mở báo cáo + đối chiếu số) + dev.

## G4.5 — Đối soát lead hàng ngày ổn định 2 tuần

- [ ] **G4.5 — Quy trình đối soát lead (form → database → Sheet) chạy ổn định ít nhất 2 tuần liên tiếp không mất lead**
  - **Cách test:** trong 14 ngày liên tiếp, mỗi sáng admin mở báo cáo đối soát (R9 + đối chiếu Sheet nếu còn): đếm số lead form gửi, số dòng trong DB, số dòng trong Sheet (nếu còn); ghi nhật ký đối soát hàng ngày.
  - **PASS khi:** đủ 14 ngày nhật ký; mỗi ngày số lead form = số dòng DB = số dòng Sheet (nếu còn) — sai lệch = 0 trong cả 14 ngày; không ngày nào mất lead.
  - **FAIL khi:** thiếu ngày nhật ký; hoặc bất kỳ ngày nào lệch số mà không có giải thích + khắc phục trong ngày; hoặc mất ≥ 1 lead trong 14 ngày.
  - **Ai test:** user/admin (đối soát hàng ngày) + QA (kiểm tra nhật ký 14 ngày).

## G4.6 — Cộng đồng học viên thay câu hẹn trong `#dang-cap-nhat`

- [ ] **G4.6 — Khu vực học viên/cộng đồng hoạt động thật (không còn là câu hẹn “Chưa có cổng đăng nhập riêng…” )**
  - **Cách test:** mở trang khu vực học viên/cộng đồng bằng tài khoản học viên test; kiểm tra vào được, xem được khóa của mình, tham gia được cộng đồng/sự kiện; kiểm tra 4 thẻ “Đang cập nhật” (Đội ngũ chuyên gia, Nghiên cứu & xuất bản, Đối tác, Đánh giá & chứng nhận) — mỗi thẻ hoặc có nội dung thật, hoặc đã gỡ khỏi trang.
  - **PASS khi:** học viên vào được khu vực học viên; 0 thẻ placeholder còn mang câu hẹn chung chung; mỗi thẻ còn lại đều có nội dung thật hoặc đã gỡ.
  - **FAIL khi:** khu vực học viên vẫn là câu hẹn; hoặc còn thẻ “Đang cập nhật” không có nội dung thật.
  - **Ai test:** QA (đăng nhập + kiểm tra 4 thẻ) + user (xác nhận nội dung).

---

# Test RLS — 16 kịch bản (Tài liệu kiến trúc §5–§6)

**Trạng thái chung: CHƯA CHẠY — chưa có project Supabase thật.** Chưa có project thì không được kết luận RLS “đã đúng”. Mỗi kịch bản phải chạy bằng tài khoản test thật (anon, học viên A, học viên B, instructor, admin) trên project staging trước, rồi mới chạy lại trên production. Bằng chứng mỗi kịch bản: câu query đã chạy + kết quả trả về (số dòng / lỗi 403) + vai trò đã dùng.

| # | Kịch bản | Vai trò test | Cách test | PASS khi | FAIL khi |
|---|---|---|---|---|---|
| RLS-01 | Anon chỉ thấy khóa `published` | Anon (không đăng nhập) | `SELECT` bảng `courses` bằng anon key | Chỉ thấy các khóa `status='published'`; không thấy `draft`/`archived` | Thấy ≥ 1 khóa `draft`/`archived` |
| RLS-02 | Anon không đọc được lead | Anon | `SELECT` bảng `leads` bằng anon key | 0 dòng / lỗi từ chối | Thấy ≥ 1 dòng lead |
| RLS-03 | Anon không ghi được vào bảng nhạy cảm | Anon | `INSERT` vào `leads`, `orders`, `payments`, `lesson_progress` bằng anon key | Cả 4 đều bị từ chối | Bất kỳ bảng nào ghi được |
| RLS-04 | Anon đọc được bài blog `published` và chính sách `is_current` | Anon | `SELECT` `posts` (`published`) và `policies` (`is_current=true`) | Chỉ thấy bài published / chính sách hiện hành; không thấy `draft` | Thấy bài `draft` hoặc chính sách cũ (không phải `is_current`) |
| RLS-05 | Học viên A không thấy enrollment của học viên B | Học viên A | `SELECT` `enrollments` bằng JWT của A | Chỉ thấy enrollment có `user_id = A` | Thấy enrollment của B |
| RLS-06 | Học viên A không thấy tiến độ của học viên B | Học viên A | `SELECT` `lesson_progress` bằng JWT của A | Chỉ thấy tiến độ của A | Thấy tiến độ của B |
| RLS-07 | Học viên A không thấy đơn hàng của học viên B | Học viên A | `SELECT` `orders` bằng JWT của A | Chỉ thấy đơn của A | Thấy đơn của B |
| RLS-08 | Học viên A không thấy chứng chỉ / quiz attempts của học viên B | Học viên A | `SELECT` `certificates` và `quiz_attempts` bằng JWT của A | Chỉ thấy của A | Thấy của B |
| RLS-09 | Học viên không đọc được `payments` và `leads` | Học viên A | `SELECT` `payments` và `leads` bằng JWT của A | 0 dòng / từ chối cả 2 bảng | Thấy ≥ 1 dòng ở bảng nào |
| RLS-10 | Học viên không ghi enrollment cho người khác | Học viên A | `INSERT` `enrollments` với `user_id = B` bằng JWT của A | Bị từ chối | Ghi được |
| RLS-11 | Học viên chỉ đọc bài học của khóa đã ghi danh (bài không xem thử) | Học viên A (chưa ghi danh khóa X) | `GET /api/my/lessons/:lessonId` của khóa X (bài không `is_free_preview`) bằng JWT của A | Bị từ chối (403/404); không nhận được `video_url`/`file_url` | Nhận được video/file URL của bài chưa ghi danh |
| RLS-12 | Học viên đọc được bài xem thử (`is_free_preview`) mà không cần ghi danh | Anon / học viên chưa ghi danh | `GET /api/my/lessons/:lessonId` của bài `is_free_preview=true` | Nhận được nội dung bài xem thử | Bị từ chối bài xem thử |
| RLS-13 | Instructor chỉ xem tiến độ học viên của khóa mình phụ trách | Instructor (phụ trách khóa X) | `SELECT` `lesson_progress` của học viên khóa X và khóa Y (không phụ trách) | Thấy tiến độ khóa X; không thấy khóa Y | Thấy tiến độ khóa Y, hoặc không thấy khóa X |
| RLS-14 | Instructor không xem được lead và không sửa được giá/đơn hàng | Instructor | `SELECT` `leads`; `UPDATE` `courses.price_vnd`; `UPDATE` `orders` | Cả 3 đều bị từ chối | Bất kỳ thao tác nào thành công |
| RLS-15 | Admin thấy tất cả | Admin | `SELECT` `leads`, `orders`, `payments`, `enrollments`, `lesson_progress`, `email_logs`, `audit_logs` bằng JWT admin | Thấy đủ tất cả các bảng, kể cả dữ liệu của A và B | Thiếu bảng nào, hoặc không thấy dữ liệu của A/B |
| RLS-16 | Học viên chỉ sửa được hồ sơ của mình | Học viên A | `UPDATE` `profiles` của A (được) và của B (phải bị từ chối); `PATCH /api/my/profile` với `user_id` khác | Sửa của mình thành công; sửa của B bị từ chối | Sửa được hồ sơ của B, hoặc không sửa được hồ sơ của mình |

**Quy tắc chạy 16 kịch bản:** chạy đủ 16 trên staging trước khi ra mắt; chạy lại đủ 16 sau mỗi lần thêm bảng mới hoặc sửa policy; ghi lại ngày chạy + người chạy + kết quả từng kịch bản. **Chưa chạy = chưa đạt**, không được ghi “RLS đã đúng” chỉ vì policy đã viết trong migration.

---

# Test mất mạng (áp cho mọi form/API)

- [ ] **T1 — Mất mạng giữa chừng: thông báo lỗi + nút thử lại, không dữ liệu giả**
  - **Cách test:** áp cho form tư vấn, form newsletter, đăng nhập, nộp quiz, cập nhật tiến độ: ngắt mạng ngay sau khi bấm gửi/nộp (DevTools offline); ghi lại màn hình; sau đó bật mạng lại, bấm “Thử lại”.
  - **PASS khi:** hiện thông báo lỗi rõ ràng (“Không có mạng / chưa gửi được”) + có nút “Thử lại”; **không** hiện dữ liệu giả (không hiện “đã lưu tiến độ 100%”, không hiện “đã nộp quiz” khi chưa nộp được); sau khi bật mạng và bấm “Thử lại”, thao tác hoàn tất thật và DB có dòng mới/kết quả đúng (đối chiếu DB).
  - **FAIL khi:** hiện thông báo thành công giả khi mất mạng; hoặc không có nút thử lại; hoặc bấm “Thử lại” tạo 2 dòng trùng (xem G1.3 — idempotency phải chặn trùng).
  - **Ai test:** QA (ngắt mạng + thử lại) + dev (đối chiếu DB).

---

# Test responsive — 390px và 1440px (áp cho mọi giai đoạn)

- [ ] **R1 — 390px (điện thoại thật của user): không tràn ngang, thân bài ≥ 16px, nút ≥ 44px, 10 khóa đúng thứ tự**
  - **Cách test:** mở trang chính và từng trang con trên điện thoại thật của user (390px, trình duyệt thật, không chỉ emulator): kiểm tra tràn ngang (cuộn ngang được hay không); đo cỡ chữ thân bài (DevTools hoặc đo bằng thước trên screenshot — ghi số px từng vị trí chính: hero, Sứ mệnh, Triết lý, Lộ trình, Lĩnh vực, 10 khóa, FAQ, form); đo chiều cao nút chạm (nút chính, tab lọc, link footer, menu); kiểm tra thứ tự 10 khóa 01–10 trong lưới (đối chiếu bảng thứ tự Báo cáo A.3: 01 Nội Tâm, 02 Tâm Thức, 03 Trí Tuệ, 04 Sức Khỏe, 05 Mối Quan Hệ, 06 Tài Chính, 07 Chuyên gia, 08 Master, 09 Coaching 90 ngày, 10 Cộng đồng Visfar).
  - **PASS khi:** (1) không tràn ngang ở bất kỳ trang nào (không cuộn ngang được); (2) thân bài ≥ 16px ở mọi vị trí (trừ các vị trí đã có quyết định của user — xem “Các tiêu chí cần phê duyệt”); (3) mọi nút/link chạm được ≥ 44px chiều cao (menu 48×48px, input/select ≥ 50px); (4) 10 khóa đúng thứ tự 01–10, không thiếu/không thừa; (5) ảnh đầy đủ không cắt, bố cục 1 cột.
  - **FAIL khi:** tràn ngang ở bất kỳ trang nào; hoặc thân bài < 16px ở vị trí chưa được user chấp nhận; hoặc nút < 44px; hoặc thứ tự khóa sai/thiếu/thừa.
  - **Ai test:** user (kiểm tra trên điện thoại thật của mình) + QA (đo số liệu).
- [ ] **R2 — 1440px (desktop): không tràn ngang, thân bài ≥ 16px, 10 khóa đúng thứ tự, lưới đúng thiết kế**
  - **Cách test:** mở trang chính trên desktop 1440px: kiểm tra tràn ngang; đo thân bài; kiểm tra lưới (khóa học 3 cột, Lộ trình 6 cột 1 hàng, footer 5 cột); kiểm tra thứ tự 10 khóa như R1.
  - **PASS khi:** không tràn ngang; thân bài ≥ 16px; lưới đúng số cột thiết kế; 10 khóa đúng thứ tự 01–10.
  - **FAIL khi:** tràn ngang; hoặc lưới sai số cột; hoặc thứ tự khóa sai.
  - **Ai test:** QA (desktop 1440px).
- [ ] **R3 — Tablet 768px: kiểm tra riêng (không có breakpoint riêng 768px trong file gốc)**
  - **Cách test:** mở trang ở 768px (tablet hoặc DevTools): kiểm tra tràn ngang, cỡ chữ (chỉ suy từ `clamp`, không có probe riêng trong file gốc — phải đo thật), bố cục (khóa học 2 cột ≤ 1020px, Lộ trình 3 cột ≤ 1100px).
  - **PASS khi:** không tràn ngang; thân bài ≥ 16px; lưới đúng như thiết kế ở dải 641–1100px.
  - **FAIL khi:** tràn ngang hoặc thân bài < 16px ở 768px.
  - **Ai test:** QA (768px).

---

# Test SEO (áp từ Giai đoạn 1)

- [ ] **S1 — Có h1 thật, OG/canonical/JSON-LD, CSP** (xem G1.7a, G1.7b — tiêu chí cổng)
- [ ] **S2 — Mỗi khóa học / bài blog / sự kiện có trang riêng với h1, OG, canonical riêng**
  - **Cách test:** mở 3 trang con mẫu (1 khóa, 1 bài blog, 1 sự kiện): kiểm tra mỗi trang có đúng 1 h1 (tên khóa/bài/sự kiện), OG riêng (title/description/image đúng trang đó), canonical riêng, JSON-LD riêng (Course/BlogPosting/Event).
  - **PASS khi:** cả 3 trang đều đủ h1 + OG + canonical + JSON-LD riêng, nội dung khớp trang đó.
  - **FAIL khi:** bất kỳ trang nào thiếu, hoặc OG/canonical trỏ về trang chủ thay vì trang con.
  - **Ai test:** QA (kiểm tra head 3 trang mẫu) + dev.
- [ ] **S3 — Sitemap.xml và robots.txt đúng**
  - **Cách test:** mở `/sitemap.xml` và `/robots.txt`; kiểm tra sitemap chứa đủ URL công khai, không chứa URL admin/học viên; robots cho phép trang công khai, chặn `/admin`, `/hoc-vien`.
  - **PASS khi:** sitemap đủ URL, không lộ URL riêng tư; robots đúng.
  - **FAIL khi:** sitemap thiếu URL hoặc lộ URL admin/học viên; robots chặn nhầm trang công khai.
  - **Ai test:** QA.

---

# Ghi chú về giới hạn miễn phí (kiểm tra lại trước mỗi lần nghiệm thu)

Các số sau tra cứu ngày 10/11/2026 từ nguồn thứ cấp tổng hợp từ trang pricing/docs của nhà cung cấp; **nhà cung cấp có thể thay đổi — trước mỗi lần nghiệm thu giai đoạn, xác minh lại trên trang pricing chính thức** (Tài liệu kiến trúc §12.1, Phụ lục B): Supabase Free — 2 project, DB 500 MB, Storage 1 GB, Auth 50.000 MAU/tháng, tạm dừng sau 7 ngày không hoạt động; Cloudflare Workers Free — 100.000 request/ngày; Resend Free — 3.000 email/tháng, tối đa 100 email/ngày; Cloudflare R2 Free — 10 GB, không phí egress. Ba giới hạn chạm đầu tiên theo thứ tự dự kiến: (1) Resend 100 email/ngày, (2) Supabase tạm dừng sau 7 ngày, (3) Supabase DB 500 MB / Storage 1 GB. Nghiệm thu giai đoạn không được coi là đạt nếu hệ thống đã chạm ngưỡng chặn mà chưa có phương án (xếp hàng email, cron giữ ấm, nâng gói đã phê duyệt).

---

# Các tiêu chí cần chủ dự án phê duyệt

Những tiêu chí dưới đây **không được coi là nghiệm thu** cho tới khi anh (Lê Đăng Quyết, chủ dự án) chốt bằng văn bản. Dev/QA không tự quyết thay.

| # | Tiêu chí cần phê duyệt | Lựa chọn cần anh chốt | Ảnh hưởng nếu chưa chốt |
|---|---|---|---|
| P1 | **Tuyên ngôn 13,65px ở 390px** (hero + Tuyên ngôn Triết lý, `clamp(12.5px,3.5vw,19px)`) | (a) Chấp nhận 13,65px; (b) Bỏ yêu cầu mỗi cụm đúng 1 dòng cho cụm 1b (cho phép xuống dòng, tăng cỡ lên ≥ 16px); (c) Thu hẹp đệm trang để đủ 16px mà vẫn 1 dòng | Người đọc lớn tuổi (đối tượng chính) có thể không đọc được tuyên ngôn — đúng chỗ quan trọng nhất của trang. G2.5 không đạt nếu chưa chốt. |
| P2 | **Nhãn Tam giác hiện thực trên điện thoại** (11,5px trên viewBox → ~3,98px ở 390px; legend đã bị bỏ theo yêu cầu anh ngày 10/11/2026) | (a) Chấp nhận hiện trạng (chỉ đọc được khi phóng to); (b) Thêm legend mới 16px dưới tam giác; (c) Tách tam giác thành 2 nửa phóng to; (d) Chạm vào vòng thì hiện nhãn lớn | Không có cách nào đọc nhãn Tam giác trên điện thoại nếu không chốt 1 trong 4. G2.5 không đạt nếu chưa chốt. |
| P3 | **Khung hoàn trả 3/7/15 ngày làm việc** (chính sách hoàn trả/hủy đăng ký) | Chốt khung thời gian hoàn trả chính thức (giữ 3/7/15 ngày hay khung khác), ghi rõ điều kiện từng mốc | G3.2d không test được (không có chuẩn để đối chiếu); hoàn trả sai khung = vi phạm chính sách đã công bố. |
| P4 | **Ngưỡng hoàn thành bài 90%** (video: `progress_percent >= 90`; bài text: bấm “Đã hoàn thành”) | (a) Giữ 90%; (b) Ngưỡng khác (ghi rõ số %, ví dụ 80% hay 100%); (c) Ngưỡng riêng theo loại bài | G3.4 và G4.2 không test được (không có chuẩn để đối chiếu); ngưỡng sai = cấp chứng chỉ sai. |
| P5 | **Khung thời gian khiếu nại 3/15/30 ngày làm việc** (chính sách giải quyết khiếu nại) | Chốt khung chính thức (giữ 3/15/30 ngày hay khung khác) | Chính sách khiếu nại công bố sai ý anh = nội dung chưa duyệt bị coi là chính thức (rủi ro R13 trong báo cáo). |
| P6 | **Định nghĩa mục tiêu $100M** | (a) Doanh thu tích lũy 10 năm; (b) Lợi nhuận giữ lại; (c) Giá trị ròng năm 10 | Không lập được kế hoạch LMS (G0.1); mọi KPI doanh thu sau này đều không có chuẩn. |
| P7 | **Hướng nền tảng: WordPress + LMS hay web app riêng** | Chốt 1 hướng + lý do + đánh đổi đã chấp nhận | G0.4 chưa xong thì không bắt đầu code giai đoạn sau (rủi ro làm lại từ đầu, R12). |
| P8 | **Framework frontend: Next.js hay Astro** (Tài liệu kiến trúc §1.3) | Chốt 1 trong 2 | Không bắt đầu code frontend khi chưa chốt. |
| P9 | **Quyết định `lessons.slug` UNIQUE theo khóa hay theo module** (Tài liệu kiến trúc §3.4) | Chốt 1 trong 2 | Ảnh hưởng schema và URL bài học; sửa sau = migration. |
| P10 | **SePay / Stripe: có dùng hay không, và khi nào** (Tài liệu kiến trúc §8) | (a) Chỉ chuyển khoản thủ công; (b) Thêm SePay (cần xác minh giá lúc triển khai); (c) Thêm Stripe (cần xác minh hỗ trợ VN + phí) | Giai đoạn đầu chỉ làm chuyển khoản thủ công; không triển khai SePay/Stripe khi chưa duyệt (nguyên tắc 0 đồng). |
| P11 | **Thông tin tài khoản ngân hàng + QR VietQR** (Tài liệu kiến trúc §8.1, Phụ lục A) | Xác nhận số tài khoản, ngân hàng, tên tài khoản nhận; xác nhận QR dùng file anh cung cấp (không tự tạo QR từ thông tin chưa xác nhận; anh quét thử QR để xác nhận đúng tài khoản nhận) | QR sai = tiền chuyển nhầm tài khoản. G3.2a không đạt nếu QR chưa được anh quét thử. |
| P12 | **Nội dung do builder viết chưa được anh duyệt** (blog, thẻ Lĩnh vực 03, bước Lộ trình “Tin”, 3 khóa 04/05/06, khung chính sách) | Anh gửi văn bản của mình để thay, hoặc duyệt bằng văn bản nội dung hiện tại (ghi rõ từng mục) | Nội dung sai ý anh bị công bố như văn bản chính thức (rủi ro R13). G0.5 và G2.4 không đạt nếu chưa chốt. |
| P13 | **Tên khóa cũ còn sót: “Thấu Hiểu Bản Thân” → đổi thành “Thấu Hiểu Nội Tâm” ở link tài nguyên “Bắt đầu tại đây” và 1 câu FAQ hay không** | (a) Đổi cả 2 chỗ theo tên mới; (b) Giữ nguyên 2 chỗ đó (ghi rõ lý do) | G1.8 không đạt nếu chưa chốt (link tài nguyên bấm vào không pre-select được khóa nào). |
| P14 | **Video YouTube unlisted (không phải bảo mật thật)** (Tài liệu kiến trúc §9.4) | Chấp nhận đánh đổi (ai có link đều xem được, không chống tải, không DRM) ở giai đoạn 0 đồng, hoặc chọn phương án trả phí (Cloudflare Stream/Mux/Vimeo) | Học viên chia sẻ link video = nội dung trả phí bị xem miễn phí. Cần quyết trước khi đăng video khóa trả phí. |
| P15 | **Nâng cấp trả phí khi chạm giới hạn miễn phí** (Supabase Pro $25/tháng, Workers Paid $5/tháng, Resend Pro $20/tháng — giá tra cứu 10/11/2026, cần xác minh lại) | Chốt ngưỡng nào thì nâng gói nào (ví dụ: DB gần 500 MB → Supabase Pro; > 100 email/ngày → Resend Pro) | Chạm giới hạn mà chưa duyệt nâng cấp = website/API/email dừng (Tài liệu kiến trúc §12). |

**Quy tắc:** tiêu chí nào nằm trong bảng trên mà chưa có quyết định bằng văn bản của anh thì ghi rõ “CHỜ PHÊ DUYỆT — chưa nghiệm thu” trong biên bản nghiệm thu, không được ghi “đạt” hay “đã xong”.

---

*Hết file. File này chỉ là tiêu chí nghiệm thu — không sửa code, không sửa file HTML, không tạo database, không deploy. Mọi test trong file đều ở trạng thái CHƯA TEST cho tới khi có bằng chứng test thật.*
