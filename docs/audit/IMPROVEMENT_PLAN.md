# Kế hoạch cải tiến — Visfar Academy (TASK 01)

**Ngày:** 10/11/2026
**Trạng thái:** Kế hoạch. Chưa lập trình, chưa sửa code, chưa deploy.
**Phạm vi:** Kế hoạch cải tiến theo 5 giai đoạn (0–4) cho website Visfar Academy, từ trang landing hiện tại thành nền tảng E-learning hoàn chỉnh.

## Nguồn

| Nguồn | Ghi chú |
|---|---|
| `workspace/your_files/bao-cao-phan-tich-visfar-academy/Bao-cao-phan-tich-Visfar-Academy.md` | Báo cáo phân tích hiện trạng (TASK 01), phân tích file HTML 5,5 MB, 5.140 dòng |
| `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` | Tài liệu kiến trúc tổng thể v1.0, 10/11/2026 — **chưa lập trình, chờ phê duyệt** |
| `workspace/user/files/Visfar_Academy.html` | File HTML hiện tại (user tải lên 10/11/2026, 11:50; 5.742.754 byte; md5 `0328f284880efe01f672596a958715bc`) — đã kiểm chứng lại bằng grep, xem “Kiểm chứng bằng grep” ở cuối file |
| `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` | File Apps Script tham chiếu trong báo cáo (chưa xác minh bản deploy thực tế có trùng file này hay không) |

## Stack đã chốt — không tự ý đổi

Next.js (App Router) · Supabase (PostgreSQL / Auth / Storage) · Cloudflare Pages (hosting frontend) · Cloudflare Workers (API) · Resend (email) · GitHub (source control, CI/CD) · 0 đồng giai đoạn đầu (mọi dịch vụ trả phí chỉ dùng khi có phê duyệt bằng văn bản của chủ dự án).

Lưu ý: tài liệu kiến trúc §1.3 còn để ngỏ lựa chọn Next.js hay Astro. Kế hoạch này ghi nhận **Next.js là lựa chọn đã chốt** theo chỉ đạo của chủ dự án; không quay lại tranh luận Astro trừ khi chủ dự án yêu cầu.

## Nguyên tắc xuyên suốt (từ báo cáo + tài liệu kiến trúc)

1. **Giữ nguyên nội dung, triết lý, nhận diện.** Toàn bộ nội dung, triết lý Giáo dục Tận Gốc, 3 trụ cột Tâm thức – Trí tuệ – Nhân hiệu, thứ tự 10 khóa học 01–10, màu đen than – vàng gold – ivory champagne, font Be Vietnam Pro được chuyển nguyên vẹn sang hệ thống mới dưới dạng dữ liệu, không viết lại.
2. **Một nguồn sự thật.** Lead, học viên, khóa học, đơn hàng mỗi thứ chỉ có 1 bảng chính trong PostgreSQL. Google Sheet (nếu còn dùng) chỉ là bản sao/báo cáo, không phải database chính.
3. **Mọi form đều có xác nhận thật.** Không còn “thành công giả”. Mọi lần gửi đều có mã tham chiếu và trạng thái đối soát được.
4. **Bảo mật theo mặc định.** RLS bật trên mọi bảng; client không chạm trực tiếp vào dữ liệu người khác; thao tác nhạy cảm đi qua API có xác thực.
5. **Không thêm khối chốt CSS mới.** Đóng băng CSS hiện tại ở Giai đoạn 1, dọn dần ở Giai đoạn 2.
6. **Không bịa số liệu.** Số học viên/doanh thu theo chương trình và kênh hiện chưa có — ghi rõ “chưa có số liệu”, không bịa, không suy ra từ cảm nhận.

## Hai cổng kiểm soát (bắt buộc)

- **⛔ Không chạy quảng cáo mạnh tới khi Giai đoạn 1 xong.** Quảng cáo đổ traffic vào đường lead chưa an toàn sẽ làm mất lead mà không ai biết (rủi ro S2/R1 trong báo cáo).
- **⛔ Không nhận học phí qua trang tới khi Giai đoạn 3 xong.** Trang hiện tại tự ghi “không có chức năng thanh toán”; chỉ nhận học phí khi đã có đơn hàng + đối soát + xác nhận thanh toán hoạt động và đã test hết luồng.

---

# Giai đoạn 0 — Quyết định kiến trúc (1–2 tuần)

## Mục tiêu

Chốt mọi quyết định mà các giai đoạn sau phụ thuộc vào, bằng văn bản của chủ dự án; có số liệu thật để quyết thay vì quyết bằng cảm nhận; xác minh đường lead hiện tại đang chạy thật ra sao trước khi sửa nó.

## File liên quan

- File HTML hiện tại: `workspace/user/files/Visfar_Academy.html` (chỉ đọc, không sửa).
- Repo mới: `workspace/visfar-academy-platform/` — tạo cấu trúc theo tài liệu kiến trúc §2 (`apps/web`, `workers/api`, `supabase/migrations`, `docs/`, `scripts/`), chưa viết code nghiệp vụ.
- Migration: chưa có migration nào ở giai đoạn này. Chỉ chuẩn bị danh mục migration sẽ viết ở Giai đoạn 2–3 (`0001_init_schema.sql`, `0002_seed_courses.sql`, `0003_seed_content.sql`).
- File Apps Script: `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` (đọc, đối chiếu với bản deploy).

## Việc làm cụ thể

1. **Chốt định nghĩa mục tiêu $100M.** Chủ dự án xác nhận bằng văn bản 1 trong 3: (a) doanh thu tích lũy 10 năm, (b) lợi nhuận giữ lại, (c) giá trị ròng năm thứ 10. Ba định nghĩa này dẫn tới 3 kế hoạch khác nhau — không lập kế hoạch LMS khi chưa có định nghĩa.
2. **Thu thập số liệu thật.** Số học viên / doanh thu theo từng chương trình (01–10) và theo kênh (Zalo, Facebook, giới thiệu, quảng cáo…). Nếu chưa có, ghi rõ “chưa có số liệu” và ghi cách thu thập từ nay (mẫu theo dõi lead/đơn). Không bịa, không ước lượng thay số thật.
3. **Rà soát `Code.gs` + deployment Web App + Sheet thật.** Đối chiếu file `.gs` trong workspace với bản deploy thực tế trên Google (deployment ID, quyền Execute-as / Anyone, version đang chạy); kiểm tra validation server, rate-limit (hiện chưa có bằng chứng về rate-limit trong file `.gs`); kiểm tra tab `DATA VISFAR ACADEMY` có dòng test nào còn sót không (hàm `testVisfar()` trong file `.gs` ghi khóa học `Kiến Tạo Nhân Hiệu` — tên khóa đã bị xóa/đổi trên trang hiện tại, nếu từng chạy sẽ để lại dòng sai tên khóa); kiểm tra có dấu hiệu spam vào Sheet không. Lập biên bản rà soát.
4. **Chốt sitemap mới.** Sitemap đề xuất trong báo cáo §D.2: tách `/su-kien` khỏi `/blog`, tách `/lo-trinh` khỏi `#triet-ly`, chính sách thành URL thật `/chinh-sach/*`, thêm `/hoc-vien/*`, `/dang-nhap`, `/dang-ky`, `/admin/*`. Chủ dự án chốt sitemap (giữ / sửa / bỏ mục nào).
5. **Lập danh mục nội dung cần chủ dự án viết lại / duyệt.** Khung thời gian chính sách (hoàn trả 3/7/15 ngày; khiếu nại 3/15/30 ngày), 3 bài blog, thân bài thẻ Lĩnh vực 03 “Mối quan hệ”, văn bản bước Lộ trình số 2 “Tin”, nội dung 3 khóa 04/05/06 (Sức khỏe / Mối quan hệ / Tài chính — hiện lấy tạm từ Lĩnh vực). Tất cả đều do builder viết, chưa được chủ dự án duyệt.
6. **Xác minh lại giới hạn miễn phí** trên trang pricing chính thức của Supabase, Cloudflare, Resend tại thời điểm bắt đầu lập trình (số trong tài liệu kiến trúc §12.1 là snapshot tra cứu ngày 10/11/2026, nhà cung cấp có thể thay đổi). Ghi rõ 3 giới hạn chạm đầu tiên: Resend 100 email/ngày, Supabase tạm dừng sau 7 ngày không hoạt động, Supabase DB 500 MB / Storage 1 GB.
7. **Lập tài khoản và backlog.** Tài khoản Supabase (project prod + staging), Cloudflare (Pages + Workers), Resend (domain đã xác minh DNS: SPF, DKIM, DMARC — không gửi từ `onboarding@resend.dev` cho người dùng thật), GitHub (repo + branch protection cho `main`). Backlog đã xếp hạng, có người chịu trách nhiệm từng hạng mục.

## Rủi ro

- **R12 — Chọn sai nền tảng / quyết vội khi chưa có số liệu.** Giảm thiểu: không quyết hướng nền tảng bằng cảm nhận; quyết sau khi có số liệu Giai đoạn 0. (Trong kế hoạch này Next.js đã chốt theo chỉ đạo chủ dự án; rủi ro còn lại là quyết các mục 1–4 vội.)
- **R6 — Bản deploy Apps Script khác file `.gs` trong workspace.** Sửa đường lead dựa trên file `.gs` sai sẽ sửa sai chỗ. Giảm thiểu: việc 3 phải xong trước khi chạm vào form ở Giai đoạn 1.
- **R13 — Nội dung do builder viết chưa được duyệt bị coi là văn bản chính thức.** Giảm thiểu: việc 5 lập danh mục và ghi rõ “nội dung tạm” trong seed.

## Phụ thuộc

- Quyết định của chủ dự án: định nghĩa $100M, sitemap, danh mục nội dung duyệt/viết lại.
- Quyền truy cập thật: tài khoản Google (Apps Script + Sheet), tài khoản Supabase/Cloudflare/Resend/GitHub.
- Không phụ thuộc giai đoạn trước (đây là giai đoạn đầu).

## Đầu ra kiểm chứng được

- Văn bản quyết định kiến trúc (ghi vào `workspace/visfar-academy-platform/docs/DECISIONS.md`): định nghĩa $100M, Next.js đã chốt, sitemap đã chốt.
- Biên bản rà soát `Code.gs` + deployment + Sheet (quyền deploy, validation server, rate-limit, dòng test còn sót — có/không, ghi rõ).
- Bảng số liệu thật theo chương trình/kênh, hoặc văn bản ghi rõ “chưa có số liệu” + cách thu thập.
- Danh mục nội dung chờ duyệt/viết lại (5 mục ở việc 5).
- Bảng giới hạn miễn phí đã xác minh lại trên trang pricing chính thức (ngày xác minh ghi rõ).

## Tiêu chí xong

- [ ] Có văn bản quyết định: định nghĩa $100M, sitemap mới đã chốt.
- [ ] Có số liệu thật (hoặc ghi rõ “chưa có số liệu”).
- [ ] Đã rà soát `Code.gs` + deployment + Sheet thật, có biên bản.
- [ ] Backlog đã xếp hạng, có người chịu trách nhiệm từng hạng mục.
- [ ] Chưa viết code nghiệp vụ nào; chưa sửa file HTML hiện tại.

---

# Giai đoạn 1 — Cứu đường lead + dọn nợ kỹ thuật (2–3 tuần)

## Mục tiêu

Trang hiện tại an toàn để chạy quảng cáo: không mất lead âm thầm, không ghi trùng, không bị spam, không rò rỉ dữ liệu cá nhân; dọn xong nội dung lỗi thời và code chết; CSS đóng băng, không thêm nợ mới.

## File liên quan

- File HTML hiện tại: `workspace/user/files/Visfar_Academy.html` — **đây là giai đoạn duy nhất được sửa file HTML hiện tại**, và chỉ sửa các lỗi liệt kê dưới đây, không viết lại trang. Mọi thay đổi phải giữ nguyên nội dung, triết lý, màu sắc, thứ tự 10 khóa học.
- Repo mới: `workspace/visfar-academy-platform/` — ghi lại mọi thay đổi vào docs; chưa đưa trang lên repo mới ở giai đoạn này (trang mới chỉ bắt đầu ở Giai đoạn 2).
- Migration: chưa có. Đường lead vẫn chạy qua Apps Script + Sheet ở giai đoạn này; API `POST /api/leads` (Workers) chỉ bắt đầu ở Giai đoạn 2–3. Nếu rà soát Giai đoạn 0 cho thấy endpoint Apps Script không khóa được, phương án dự phòng là đưa API lead tối giản lên trước — quyết riêng, không tự ý làm.

## Việc làm cụ thể

### 1.1. Sửa lỗi nghiêm trọng S1–S5 (báo cáo §B.1)

1. **S1 — Thêm `<h1>` thật cho trang chính.** Hiện trang chính không có `<h1>`; 4 `<h1>` duy nhất đều nằm trong 4 bài chính sách ẩn (`#policyView`, dòng 4448/4499/4538/4572 — đã kiểm chứng bằng grep). Tiêu đề hero hiện là `<h2>` (dòng 3516). Thêm 1 `<h1>` cho nội dung chính, giữ nguyên 4 `<h1>` chính sách.
2. **S2 — Bỏ fallback “thành công giả”.** Nhánh fallback iframe (`submitViaIframe`, dòng 4925–4953; `showFallbackOk`, dòng 4912) hiện hộp “đã gửi” chỉ vì iframe `load`, trong khi iframe cross-origin không đọc được nội dung phản hồi — không có xác nhận Sheet ghi xong. Sửa thành: chỉ hiện màn hình cảm ơn khi `data.ok === true` ở nhánh fetch chính (đã đúng ở nhánh này — `showThankYou` chỉ chạy khi `ok:true`, server chỉ trả `ok:true` sau `appendRow`); nhánh fallback chỉ báo “đã gửi, chưa xác nhận — chúng tôi sẽ liên hệ / kiểm tra lại”, kèm mã tham chiếu duy nhất cho mỗi lần gửi. Không hiện chữ “đã ghi nhận” ở nhánh fallback.
3. **S3 — Form hoạt động khi không có JavaScript.** Form `#consultForm` (dòng 4332) hiện có `novalidate`, không có `action`, không có `method` — tắt JS là form chết hoàn toàn. Thêm `action` dự phòng (POST thẳng tới Web App) hoặc hiện thông báo rõ ràng khi không có JS; bỏ `novalidate` hoặc thay bằng validation HTML (`pattern`, `required`) song song với JS.
4. **S4 — Khóa endpoint Apps Script.** URL Web App hard-code dòng 4862, POST không kèm token/CAPTCHA/honeypot/rate-limit (đếm `captcha/honeypot/csrf/recaptcha = 0` trong báo cáo). Theo kết quả rà soát Giai đoạn 0: thêm honeypot + rate-limit phía server trong `Code.gs` (nếu deployment cho phép sửa), whitelist `province`/`course` theo danh sách cho phép ở server, đồng bộ regex email client/server (TLD tối thiểu 2 ký tự — hiện client cho `a@b.c` qua, server yêu cầu `\.[^\s@]{2,}$`, lệch nhau). Không kết luận cấu hình deploy là “Anyone” chỉ từ HTML — chỉ kết luận sau khi rà soát thật.
5. **S5 — Xóa PII khỏi mailto/clipboard.** Body chứa họ tên + SĐT + email + tỉnh + khóa học hiện được gán vào `mailto:visfaracademy@gmail.com` và `data-body` để sao chép (dòng 4978–4983, `#copyBtn` dòng 5033–5038; `mailto:` xuất hiện 8 lần trong file — đã kiểm chứng bằng grep). Sửa thành: PII chỉ gửi qua POST HTTPS tới server; hộp dự phòng chỉ chứa mã tham chiếu, không chứa họ tên/SĐT/email. Lưu ý quirk đã xác minh: `#formOk` chỉ hiện ở nhánh fallback, người đăng ký thành công bình thường không thấy nút mailto/copy — sửa cả hai nhánh.

### 1.2. Idempotency + mã tham chiếu + chống double-submit

6. Thêm idempotency key: mã yêu cầu sinh ở client cho mỗi lần gửi, server kiểm tra trùng trước khi `appendRow` (chống ghi trùng khi fetch timeout 30s sau khi server đã ghi nhưng trước khi client nhận JSON → client gọi fallback iframe → ghi thêm 1 dòng trùng; `LockService` chỉ serialize, không chống trùng; `AbortController` hủy phía client, không hủy phía server).
7. Mỗi lần gửi có mã tham chiếu duy nhất (dạng `VISFAR-2026-000123` — định dạng đầy đủ ở Giai đoạn 3; ở giai đoạn này tối thiểu là mã duy nhất để đối soát), hiện cho người đăng ký và lưu vào Sheet.
8. Chống double-submit bằng token/khóa bấm: nút gửi chỉ `disabled` trong lúc gửi hiện chưa đủ.

### 1.3. Sửa lỗi cao H5–H8 (báo cáo §B.2)

9. **H5 — Newsletter footer thật hoặc xóa.** `#footEmail` chỉ xuất hiện 2 lần (label + input), không có `<form>`, không có handler JS nào đọc nó (đã kiểm chứng bằng grep: 2 dòng); nút “Đăng ký” là `<a href="#tu-van">` — bấm chỉ cuộn tới form, email đã gõ bị bỏ. Hoặc thêm `<form>` + handler thật (ghi vào tab Sheet riêng hoặc dịch vụ email), hoặc xóa input để không đánh lừa người dùng.
10. **H6 — Chính sách thành URL thật.** Link `href="#chinh-sach-bao-mat"`… không có phần tử nào mang `id` đó (đích thật là `id="page-bao-mat"`… + `data-policy`); chỉ chạy nhờ `renderPolicy()` bắt `hashchange` — không JS, không chia sẻ link trực tiếp, bot không tới được. Tối thiểu: thêm `id` đích trùng với hash để link mở được; gộp 4 khối liên hệ chính sách lặp nguyên văn thành 1 include (sửa 1 số điện thoại hiện phải sửa 4 chỗ).
11. **H8 — SEO cơ bản + CSP.** Thêm OG/Twitter/canonical/robots/JSON-LD (Organization + Course); CSP; hiện có 0 `og:`, 0 `twitter:`, 0 `canonical`, 0 `robots`, 0 `application/ld+json` (đã kiểm chứng bằng grep: `og:` = 0) và chỉ 4 `<meta>` (charset, viewport, color-scheme, description). Không có canonical thì bản `Visfar_Academy.html` và bản artifact live có thể bị coi là trùng lặp.
12. **H7 — Dọn nội dung lỗi thời / mâu thuẫn.** (a) 3 sự kiện 22/05, 25/05, 28/05/2026 (dòng 4225/4240/4255 — đã kiểm chứng bằng grep) vẫn ghi “Lịch sự kiện sắp diễn ra” nhưng cả 3 thẻ đều pill “Đã diễn ra” — đã qua hơn 5 tháng so với 10/11/2026: cập nhật ngày mới hoặc gỡ; (b) dọn 5 chỗ tên khóa cũ còn sót — “Thấu Hiểu Bản Thân” (grep: 2 dòng), “Khai Mở Trí Tuệ” ×1, “Kiến Tạo Nhân Hiệu” ×1 — ở link tài nguyên “Bắt đầu tại đây” (data-course không khớp option trong form nên bấm vào không pre-select được khóa nào) và trong 1 câu trả lời FAQ; (c) sửa link “Bắt đầu tại đây” cho khớp option form.

### 1.4. Dọn dead code + đóng băng CSS

13. Dọn dead code: `.intl-note` (15 lần, 0 phần tử), `.intl-panel` (30 lần, 0 phần tử), `#phuong-phap-giao-duc` / `#he-thong` (5 lần trong CSS, 0 `id`), `.phil-subtitle` (2 lần, 0 phần tử); `[data-copy]` — handler tồn tại (dòng 4836–4837, đã kiểm chứng bằng grep) nhưng không có phần tử nào mang `data-copy` trong HTML, xóa handler hoặc khôi phục tính năng; `#floatCta` — JS `getElementById("floatCta")` (dòng 4841, grep: 2 dòng) nhưng HTML không có id này — hoặc thêm phần tử thật, hoặc xóa code chết.
14. **Đóng băng CSS.** 300 lần `!important` (đã kiểm chứng bằng grep: đúng 300 lần xuất hiện, trên 187 dòng), ~1.955 rule, 1.104 selector duy nhất, 134 `@media`. Lập danh mục 300 `!important` để dọn dần ở Giai đoạn 2. **Không thêm khối chốt CSS mới nào trong giai đoạn này.** Quy tắc cũ ép 1 dòng (`white-space:nowrap` 41 lần; các clamp tí hon cũ như `#roadmapTitle clamp(6.5px,2.02vw,12.5px)` → 7,88px ở 390px nếu không có khối audit cuối ghi đè) vẫn nằm trong file — ghi vào danh mục dọn, không xóa bừa khi chưa hiểu thứ tự thắng hiện tại (phụ thuộc vị trí cuối file + `!important`).
15. **Git + backup từ giai đoạn này.** Toàn bộ website hiện là 1 file HTML + 1 Sheet + 1 Apps Script, không có backup/versioning được ghi nhận (R11). Đưa file HTML vào Git (repo riêng hoặc `workspace/visfar-academy-platform/`), mọi thay đổi qua commit có mô tả; giữ bản sao Sheet trước mỗi lần sửa `Code.gs`.

## Rủi ro

- **R1 — Mất lead mà không ai biết (fallback “thành công giả”).** Giảm thiểu: việc 2 + test fallback trong tiêu chí xong.
- **R2 — Ghi trùng lead (timeout + fallback).** Giảm thiểu: việc 6–8.
- **R3 — Spam / ghi rác vào Sheet qua endpoint công khai.** Giảm thiểu: việc 4; chưa chạy quảng cáo mạnh cho tới khi việc 4 + test spam xong.
- **R4 — Rò rỉ PII qua mailto/clipboard.** Giảm thiểu: việc 5.
- **R5 — Sửa CSS vỡ trang.** Giảm thiểu: việc 14 (đóng băng, lập danh mục, không thêm khối chốt); mọi thay đổi kiểm tra trên điện thoại thật của chủ dự án (390px) và desktop (1440px).
- **R6 — Bản deploy Apps Script khác file `.gs`.** Giảm thiểu: chỉ sửa sau khi biên bản rà soát Giai đoạn 0 xong.

## Phụ thuộc

- Giai đoạn 0: biên bản rà soát `Code.gs` + deployment + Sheet (quyết định sửa `Code.gs` hay thay bằng API tối giản).
- Quyết định của chủ dự án: sự kiện 05/2026 cập nhật ngày mới hay gỡ; newsletter làm thật hay xóa; `#floatCta` khôi phục hay xóa.
- Dịch vụ miễn phí: chưa dùng thêm dịch vụ nào ở giai đoạn này; Apps Script + Google Sheet vẫn là đường lead chính.

## Đầu ra kiểm chứng được

- File HTML đã sửa (commit Git có mô tả từng lỗi S1–S5, H5–H8 đã sửa).
- Danh mục 300 `!important` + danh mục dead code đã dọn / còn lại (ghi rõ từng mục: đã xóa hay đã khôi phục thành tính năng thật).
- Test đăng ký thật từ trình duyệt của chủ dự án (xem tiêu chí xong).

## Tiêu chí xong

- [ ] **Test đăng ký thật:** chủ dự án submit 1 lần từ trình duyệt của mình (chọn tỉnh từ dropdown 34 tỉnh, chọn 1 khóa 01–10), thấy thank-you **chỉ sau khi** Sheet có dòng mới; tab `DATA VISFAR ACADEMY` có đúng 1 dòng mới, đúng 6 cột (Thời gian | Họ và tên | Số điện thoại | Email | Tỉnh / Thành phố | Khóa học quan tâm), SĐT giữ số 0 đầu; xóa dòng test sau khi kiểm tra.
- [ ] **Test fallback:** ngắt mạng / chặn fetch, xác nhận trang **không** hiện “đã ghi nhận” mà hiện thông báo “chưa xác nhận” + mã tham chiếu.
- [ ] **Test chống trùng:** gửi 2 lần cùng mã yêu cầu, Sheet chỉ có 1 dòng.
- [ ] **Test spam:** POST trực tiếp lên endpoint với dữ liệu sai định dạng / ngoài whitelist, bị từ chối; không có dòng rác mới trong Sheet.
- [ ] **Test không JS:** tắt JavaScript, form vẫn gửi được (qua `action` dự phòng) hoặc hiện thông báo rõ ràng.
- [ ] **Kiểm tra PII:** grep mã nguồn — không còn họ tên/SĐT/email trong `mailto:`, `data-body`, clipboard.
- [ ] **Kiểm tra SEO cơ bản:** có `<h1>` thật cho trang chính; có OG/Twitter/canonical/robots/JSON-LD; có CSP; chính sách mở được bằng URL thật (không cần JS).
- [ ] **Kiểm tra nội dung:** 0 chỗ tên khóa cũ; sự kiện không còn ngày 05/2026 đã qua (đã cập nhật hoặc gỡ); newsletter hoặc gửi được thật, hoặc đã xóa.
- [ ] **Kiểm tra dead code:** grep `.intl-`, `#phuong-phap-giao-duc`, `#he-thong`, `.phil-subtitle`, `data-copy`, `floatCta` — hoặc đã xóa, hoặc đã khôi phục thành tính năng thật.
- [ ] Không thêm khối chốt CSS mới nào trong giai đoạn này.
- [ ] **Cổng kiểm soát mở:** chỉ khi tất cả ô trên đã tick mới được chạy quảng cáo mạnh.

---

# Giai đoạn 2 — Tách tài nguyên + CMS (3–4 tuần)

## Mục tiêu

Trang công khai chạy trên kiến trúc file tách rời (không còn single-file 5,5 MB), đo được hiệu suất cải thiện; nội dung quản lý được qua CMS/database — thêm 1 khóa học không cần sửa tay HTML + form option + footer link; blog/sự kiện có trang thật; sitemap mới đi vào hoạt động ở phần công khai.

## File liên quan

- File HTML hiện tại: `workspace/user/files/Visfar_Academy.html` — làm **nguồn nội dung để chuyển** (script migrate đọc từ file này), không sửa thêm sau Giai đoạn 1. Bản HTML sau Giai đoạn 1 được lưu trong Git làm baseline để đối chiếu.
- Repo mới: `workspace/visfar-academy-platform/` — đây là nơi xây chính:
  - `apps/web/` — frontend Next.js (App Router): routes công khai theo sitemap đã chốt, components, `styles/tokens.css` (design system tách từ CSS hiện tại: `--gold`, `--gold2`, `--grad`, `--ink`, khung 1380px, Be Vietnam Pro, gradient chéo 135°), giữ nguyên giao diện luxury.
  - `supabase/migrations/0001_init_schema.sql` — bảng + index + RLS (theo tài liệu kiến trúc §3, §6).
  - `supabase/migrations/0002_seed_courses.sql` — 10 khóa học, giữ nguyên thứ tự 01–10 (seed slug theo số mới; **tên file poster theo số mới**, không giữ tên file poster cũ `poster-09/10/11` gây nhầm lẫn).
  - `supabase/migrations/0003_seed_content.sql` — triết lý, lĩnh vực, chính sách (nội dung nào chưa được chủ dự án duyệt thì ghi rõ “nội dung tạm, chờ văn bản của chủ dự án” trong seed).
  - `scripts/migrate-content.mjs` — chuyển nội dung từ `Visfar_Academy.html` → Supabase (chạy 1 lần, có đối chiếu số lượng).
  - `workers/api/src/routes/leads.ts` + `lib/idempotency.ts` + `lib/rate-limit.ts` — API `POST /api/leads` thay đường Apps Script làm đường ghi chính (xem việc 4).
- Migration: 0001, 0002, 0003 (đánh số thứ tự, không sửa migration cũ — chỉ thêm migration mới).

## Việc làm cụ thể

1. **Tách tài nguyên khỏi HTML.** Ảnh thành file riêng trong Supabase Storage (giai đoạn đầu) — logo 225 KB ×2 đang lặp lại trong file (450 KB trùng lặp) chỉ lưu 1 lần; 10 poster 1600×900, ảnh hero 1334×889, VISFAR HOME WebP 484 KB, 8 chân dung học viên (hiển thị 84px nhưng file 40–182 KB — resize về kích thước hiển thị thật); font thành file `.woff2` riêng, subset tiếng Việt, `font-display:swap`, preload chỉ weight dùng nhiều (hiện 12 `@font-face` Be Vietnam Pro base64 ~643 KB). Thêm `srcset`/`sizes` (hiện 0 `srcset` — ảnh 1600px vẫn tải đủ trên điện thoại 390px); giữ `loading="lazy"` (24/27 ảnh đã có) và `width/height` (26/27 ảnh đã có). Mục tiêu: file HTML đầu tiên (HTML+CSS+JS, chưa tính ảnh lazy) dưới 500 KB, từ 5,5 MB.
2. **Tách CSS, dọn nợ kỹ thuật.** Tách CSS ~258 KB thành `main.css` + `components.css` với CSS variables (design system §1.4 tài liệu kiến trúc); dọn dần danh mục 300 `!important` đã lập ở Giai đoạn 1; xóa dead code CSS còn lại (`.intl-*` v.v. nếu Giai đoạn 1 chưa dọn hết); **không thêm khối chốt mới**. Kiểm tra lại toàn bộ cỡ chữ <16px (191 khai báo `font-size` dưới 1rem trong CSS gốc; `.poster-kicker` 10,24–10,56px; `.card .tier` 11,52px…) và tương phản gradient vàng (điểm sáng nhất `#e8c766` tương phản 1,45–1,64:1, dưới chuẩn chữ thường — chỉ chiếm dải hẹp ở góc, nhưng phải đo lại sau khi tách CSS).
3. **Quyết 3 lựa chọn cho tuyên ngôn 13,65px.** Tuyên ngôn 1a/1b (hero + Tuyên ngôn Triết lý) `clamp(12.5px,3.5vw,19px)` → 13,65px ở 390px, dưới sàn thân bài 16px, do giới hạn hình học của yêu cầu “mỗi cụm đúng 1 dòng” (tối đa ~13,98px ở hero / ~14,18px ở Triết lý). Chủ dự án quyết bằng văn bản 1 trong 3: (a) chấp nhận 13,65px, (b) bỏ yêu cầu 1 dòng cho cụm 1b, (c) thu hẹp đệm trang. Không tự ý tăng cỡ trong cùng hình học.
4. **Quyết cách đọc nhãn Tam giác hiện thực trên điện thoại.** Nhãn SVG 11,5px trên viewBox 1024×891 → ~3,98px ở 390px, không đọc được; chú giải `.triangle-legend` đã bị chủ dự án yêu cầu bỏ ngày 10/11/2026. Các phương án: chú giải mới / tách tam giác thành 2 nửa phóng to / chạm-vòng-hiện-nhãn-lớn. Chủ dự án quyết 1 phương án, hoặc chấp nhận hiện trạng bằng văn bản. (Chú giải dưới VISFAR HOME, 16px, hiện ≤1100px, vẫn giữ.)
5. **Nội dung vào CMS/database.** Khóa học, sự kiện, blog, chính sách vào Supabase (bảng `courses`, `events`, `posts`, `policies` — chính sách có versioning + ngày cập nhật; hiện ghi 04/11/2026, chưa có versioning). Trang công khai render từ dữ liệu. Thêm 1 khóa học không cần sửa tay HTML + form option + footer link (số đếm trên 5 tab lọc hiện hard-code trong HTML, trong khi `#courseCount` đếm động — sau CMS, số đếm phải đếm từ dữ liệu thật).
6. **Blog và sự kiện có trang thật.** Mỗi bài blog có trang đầy đủ (`/blog/{slug}`); mỗi sự kiện có trang chi tiết + đăng ký sự kiện cụ thể (`/su-kien/{slug}`); nút “Xem chi tiết” không còn trỏ về `#tu-van`. Sitemap mới (D.2) đi vào hoạt động ở phần công khai; không còn link chết trong menu/footer. Lưu ý: 3 bài blog hiện chỉ có tiêu đề + đoạn văn + meta “Đọc trong 2 phút”, không có bài đầy đủ — cần chủ dự án duyệt hoặc gửi bài đầy đủ; nếu chưa có, gỡ khỏi menu cho tới khi có nội dung, không để link chết.
7. **API lead mới thay Apps Script làm đường ghi chính.** `POST /api/leads` qua Cloudflare Workers: validation server (SĐT `^0\d{9}$`, email TLD ≥2 ký tự, `province` trong 34 tỉnh, `course_id` tồn tại và published), rate-limit (5 req/giờ/IP), honeypot + Turnstile (Cloudflare, miễn phí — xác minh giới hạn khi triển khai), idempotency key (header `Idempotency-Key`, trả lại kết quả cũ nếu trùng), `reference_code` duy nhất (`VISFAR-2026-000123`). Response thành công 201 `{ok:true, referenceCode, message}`; lỗi `{ok:false, error, message}`. **Không có nhánh fallback “thành công giả”** — API lỗi thì client hiện lỗi + mã tham chiếu (nếu có), không hiện cảm ơn. Google Sheet chỉ còn là bản sao/báo cáo (đồng bộ từ database), không phải nơi ghi duy nhất; bỏ Sheet khi API lead ổn định (quyết riêng ở cuối giai đoạn).
8. **SEO đầy đủ.** `<h1>` thật (từ Giai đoạn 1), OG/Twitter/canonical/robots/JSON-LD (Organization + Course), `sitemap.xml`; chính sách có URL thật (`/chinh-sach/*`); `alt` cho 10 poster khóa học hiện đang `alt=""` rỗng — tên khóa đã là chữ HTML phủ trên poster nên `alt=""` có thể coi là đúng cho ảnh trang trí, nhưng nếu poster lỗi tải thì mất ngữ cảnh: bổ sung `alt` có nghĩa hoặc fallback text.
9. **Giữ nguyên design system và chuẩn mobile.** Khung 1380px, đệm `clamp(18px,4.5vw,32px)`, thân bài ≥16px, nút chạm ≥44px, không tràn ngang, bố cục 1 cột trên điện thoại, văn bản chính căn đều 2 lề (đã chốt). Mọi thay đổi kiểm tra trên điện thoại thật của chủ dự án (390px) và desktop (1440px).

## Rủi ro

- **R7 — Hiệu suất: file 5,5 MB, không cache riêng.** Giảm thiểu: việc 1; đo FCP/LCP thật trên điện thoại thật, ghi số trước/sau.
- **R5 — Sửa CSS vỡ trang (300 `!important`).** Giảm thiểu: việc 2 dọn dần theo danh mục, không xóa bừa; test trên 390px/1440px sau mỗi đợt dọn.
- **R9 — Chữ dưới sàn 16px (tuyên ngôn 13,65px; nhãn Tam giác ~4px).** Giảm thiểu: việc 3–4 phải có quyết định bằng văn bản của chủ dự án; không tự ý quyết thay.
- **R8 — SEO.** Giảm thiểu: việc 8; kiểm tra chia sẻ link lên Zalo/Facebook có ảnh/tiêu đề đẹp.
- **R13 — Nội dung do builder viết chưa được duyệt.** Giảm thiểu: việc 5–6 ghi rõ “nội dung tạm” trong seed; blog chưa có bài đầy đủ thì gỡ khỏi menu.
- **Rủi ro chuyển đổi:** migrate nội dung sai/thiếu (mất đoạn văn, sai thứ tự khóa). Giảm thiểu: script migrate có đối chiếu số lượng (13 section, 10 khóa, 8 testimonial, 9 FAQ, 4 chính sách) và chủ dự án đối chiếu trang mới với trang cũ trước khi chuyển traffic.

## Phụ thuộc

- Giai đoạn 1 xong (đường lead an toàn, CSS đóng băng, dead code đã dọn) — nếu Giai đoạn 1 chưa xong, không bắt đầu tách tài nguyên vì sẽ tách cả lỗi sang hệ thống mới.
- Quyết định của chủ dự án: tuyên ngôn 13,65px (3 lựa chọn), cách đọc nhãn Tam giác, nội dung blog đầy đủ / gỡ khỏi menu, bỏ Sheet khi API lead ổn định.
- Dịch vụ miễn phí và giới hạn: Supabase Free (DB 500 MB, Storage 1 GB, tạm dừng sau 7 ngày không hoạt động — cần cron “giữ ấm” gọi API mỗi ngày); Cloudflare Pages Free (500 build/tháng, static request không giới hạn); Workers Free (100.000 request/ngày — đọc nội dung công khai đi trực tiếp qua Supabase, không qua Workers, để không chạm giới hạn này); Resend Free (3.000 email/tháng, tối đa 100 email/ngày — email automation đầy đủ chỉ ở Giai đoạn 3, giai đoạn này chỉ email xác nhận lead tối thiểu nếu cần).

## Đầu ra kiểm chứng được

- Repo `workspace/visfar-academy-platform/` chạy được trang công khai trên Cloudflare Pages (preview deployment), nội dung render từ Supabase.
- Migration 0001–0003 đã chạy trên project Supabase staging + prod; script migrate đã chạy 1 lần, có biên bản đối chiếu số lượng.
- Số đo hiệu suất trước/sau (FCP/LCP trên điện thoại thật).
- API `POST /api/leads` hoạt động; Sheet (nếu còn) khớp với bảng `leads`.

## Tiêu chí xong

- [ ] **Hiệu suất đo được:** file HTML đầu tiên (HTML+CSS+JS, chưa tính ảnh lazy) dưới 500 KB (từ 5,5 MB); FCP/LCP đo trên điện thoại thật cải thiện so với trước (ghi số trước/sau); ảnh có `srcset`, font đã subset.
- [ ] **CMS hoạt động:** thêm 1 khóa học test qua CMS (không sửa tay HTML), khóa mới tự hiện trong lưới, form option, footer link, và tab lọc với số đếm đúng; xóa khóa test sau khi kiểm tra.
- [ ] **Blog/sự kiện thật:** mỗi bài blog có trang đầy đủ; mỗi sự kiện có trang chi tiết; nút “Xem chi tiết” không còn trỏ về `#tu-van`.
- [ ] **Chữ và tương phản:** audit lại toàn bộ cỡ chữ <16px, có bảng trước/sau; tuyên ngôn 13,65px đã có quyết định của chủ dự án bằng văn bản; nhãn Tam giác có cách đọc được trên điện thoại hoặc chủ dự án chấp nhận hiện trạng bằng văn bản.
- [ ] Sitemap mới (D.2) đã đi vào hoạt động ở phần công khai; không còn link chết trong menu/footer.
- [ ] **Test API lead:** POST thật qua API mới, đối soát được trong bảng `leads` (đúng 1 dòng, có `reference_code` + `idempotency_key`); gửi trùng idempotency key chỉ trả lại kết quả cũ, không ghi thêm dòng.
- [ ] Không còn base64 trong HTML; không còn khối chốt CSS mới.

---

# Giai đoạn 3 — Tài khoản học viên + thanh toán (4–6 tuần)

## Mục tiêu

Học viên đầu tiên học xong 1 khóa hoàn toàn trên hệ thống mới: đăng ký/đăng nhập, mua/đăng ký khóa, học bài, làm quiz, tiến độ ghi nhận đúng; đơn hàng đối soát được; email xác nhận và nhắc học hoạt động.

## File liên quan

- Repo mới: `workspace/visfar-academy-platform/` —
  - `apps/web/src/app/(student)/` — khu vực học viên: `/hoc-vien/dashboard`, `/hoc-vien/khoa-hoc`, `/hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]`, `/hoc-vien/chung-chi`, `/hoc-vien/ho-so`; `(auth)/` — `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau`; `(admin)/` — khung admin tối thiểu (quản lý lead/đơn, xem ở Giai đoạn 4 đầy đủ).
  - `workers/api/src/routes/` — `enrollments.ts`, `progress.ts`, `quiz.ts`, `orders.ts`, `webhooks.ts`, `leads.ts` (đã có từ Giai đoạn 2).
  - `workers/api/src/lib/` — `supabase-admin.ts` (service-role key, **chỉ ở server**, frontend không bao giờ thấy), `auth.ts` (xác minh JWT bằng Supabase JWKS), `rate-limit.ts`, `idempotency.ts`, `email.ts` (gọi Resend).
  - `packages/shared/` — `types.ts`, `constants.ts` (34 tỉnh/thành, trụ cột, trạng thái).
- Migration: thêm migration mới cho các bảng học tập/thanh toán (không sửa migration 0001–0003): `profiles`, `modules`, `lessons`, `quiz_questions`, `quiz_options`, `enrollments`, `lesson_progress`, `quiz_attempts`, `orders`, `payments`, `certificates` (chứng chỉ cấp ở Giai đoạn 4, nhưng bảng tạo từ giai đoạn này), `events`, `event_registrations`, `posts`, `policies`, `email_logs`, `newsletter_subscribers`, `audit_logs` (theo tài liệu kiến trúc §3.2, §3.3 index bắt buộc).
- File HTML hiện tại: không sửa nữa; chỉ dùng làm nguồn đối chiếu nội dung.

## Việc làm cụ thể

### 3.1. Tài khoản học viên (Supabase Auth)

1. Đăng ký/đăng nhập bằng email + mật khẩu (qua Supabase Auth, không tự viết auth); hồ sơ (`profiles`, 1–1 với `auth.users`); đổi mật khẩu, quên mật khẩu (email đặt lại qua Supabase Auth + Resend SMTP). Phân quyền: `student` / `instructor` / `admin` (tài liệu kiến trúc §5; không có role `superadmin` riêng giai đoạn đầu — `admin` là cao nhất).
2. RLS bật trên mọi bảng (§6 tài liệu kiến trúc): anon key chỉ đọc nội dung công khai; học viên chỉ thấy dữ liệu của mình; `leads`/`orders`/`payments` không có policy INSERT cho client — mọi ghi nhạy cảm đi qua Workers. Kiểm tra RLS bằng tài khoản test: học viên A không đọc được dữ liệu học viên B.
3. Khu vực học viên: dashboard (tiến độ, khóa đang học), khóa của tôi, hồ sơ. Câu hẹn trong `#dang-cap-nhat` (“Chưa có cổng đăng nhập riêng trên trang này…”) được thay bằng cổng đăng nhập thật.

### 3.2. Khóa học có cấu trúc

4. Mỗi khóa = module → bài học (video / text / quiz / file): bảng `modules`, `lessons` (`type` ∈ `video|text|quiz|file`, `video_url` là YouTube unlisted — xem việc 7, `is_free_preview` cho bài xem thử).
5. Tiến độ: `lesson_progress` (`progress_percent`, `last_position_sec` để “tiếp tục học”); client gửi tiến độ định kỳ (mỗi 30 giây khi xem video, và khi rời bài); server kiểm tra enrollment còn `active`, `progress_percent` 0–100, không cho nhảy 0% → 100% trong 1 giây (ngưỡng theo `video_duration_sec`); bài `completed` khi `progress_percent >= 90` (video) hoặc học viên bấm “Đã hoàn thành” (bài text) — ngưỡng 90% là đề xuất, chốt ở buổi kiểm tra (xem Quyết định cần phê duyệt).
6. Quiz chấm ở server: `GET /api/my/quiz/:lessonId` trả câu hỏi + lựa chọn, **không kèm `is_correct`** (client chỉ đọc VIEW `quiz_options_public`, không SELECT trực tiếp bảng `quiz_options`); `POST /api/my/quiz/:lessonId/submit` chấm ở server, lưu `quiz_attempts`, trả điểm + đáp án đúng chỉ sau khi nộp. Không giới hạn số lần làm lại giai đoạn đầu (nếu sau này muốn giới hạn, thêm cột `max_attempts` vào `lessons`).

### 3.3. Thanh toán — chuyển khoản thủ công + đối soát trước

7. **Video 0 đồng:** video bài giảng đăng YouTube ở chế độ không công khai (unlisted). Ghi rõ giới hạn: unlisted không phải bảo mật thật — ai có link đều xem được, không chống tải, không DRM. Đây là đánh đổi chấp nhận được ở giai đoạn 0 đồng. **Không dùng Supabase Storage cho video** (1 GB không đủ). Phương án thay thế có phí (Cloudflare Stream / Mux / Vimeo Pro) chỉ khi phê duyệt.
8. **Đơn hàng:** `POST /api/orders` tạo đơn (`reference_code` duy nhất dạng `DH-2026-000123` — học viên ghi mã này vào nội dung chuyển khoản; `expires_at` = +48h giữ chỗ). Học phí “Tùy tâm” (khóa 07 hiện tại): `price_vnd = 0`, `custom_amount_vnd` là số học viên nhập.
9. **Chuyển khoản thủ công + đối soát (triển khai đầu tiên, 0 đồng):** hiện QR + STK + số tiền + nội dung = mã đơn. **QR chỉ dùng file/ảnh do chủ dự án cung cấp hoặc tạo từ thông tin chủ dự án đã xác nhận — không tự tạo QR từ thông tin chưa xác nhận** (theo quy tắc đã chốt: không bịa QR; mã QR hiện tại trong form “Nâng Tầm” vẫn chờ chủ dự án quét thử xác nhận — cùng quy tắc áp dụng ở đây). Admin kiểm tra sao kê hàng ngày → `POST /api/admin/orders/:id/mark-paid` (tạo `payments` bank_transfer succeeded + đơn → `paid` + tạo `enrollments` + gửi email “Đã nhận thanh toán”). Đơn quá hạn → `expired`, học viên tạo đơn mới.
10. **SePay / Stripe chỉ khi phê duyệt.** SePay webhook (`POST /api/webhooks/sepay`, xác minh chữ ký, kiểm tra amount khớp, idempotency `(method, gateway_reference)` UNIQUE) và Stripe Checkout (`POST /api/webhooks/stripe`) **không triển khai** cho tới khi chủ dự án phê duyệt bằng văn bản (SePay có gói trả phí — xác minh giá tại thời điểm triển khai; Stripe cần xác minh hỗ trợ tài khoản Việt Nam và phí giao dịch). **Không bao giờ tin client báo “đã trả”** — đơn chỉ sang `paid` khi webhook xác minh chữ ký hoặc admin xác nhận thủ công sau khi kiểm tra sao kê.
11. **Hoàn trả theo chính sách đã công bố.** Khung thời gian hoàn trả 3/7/15 ngày làm việc hiện do builder viết, chưa được chủ dự án duyệt — phải duyệt lại trước khi áp dụng (xem Quyết định cần phê duyệt). Luồng: học viên yêu cầu → admin kiểm tra khung → `orders → refunded`, tạo bản ghi `payments` refunded, gửi email, thu hồi enrollment (`status=revoked`).
12. **Ghi danh:** khóa miễn phí (`price_vnd = 0`) → `POST /api/my/enrollments` tạo enrollment ngay, không qua đơn; khóa trả phí/Tùy tâm → phải qua `/api/orders` → thanh toán → enrollment tự tạo khi đơn `paid`; không có đường tắt tạo enrollment mà không có đơn đã trả (trừ admin tặng — ghi `audit_logs`). Khóa “Cộng đồng Visfar”: ghi danh mở, không cần thanh toán.

### 3.4. Email automation (Resend, qua Workers)

13. Email giao dịch qua Resend, gửi từ domain riêng đã xác minh DNS (không gửi từ `onboarding@resend.dev` cho người dùng thật); mọi email ghi vào `email_logs` để đối soát; webhook Resend cập nhật `delivered`/`bounced`. Template tiếng Việt, giọng tự nhiên, ít emoji, không thúc ép/FOMO mạnh.
14. Triển khai email theo thứ tự ưu tiên (tài liệu kiến trúc §10.2): E3 `lead-received` (mã tham chiếu, không chứa PII thừa) + E4 `lead-notify-admin`, E5 `order-created` (QR + STK + số tiền + mã đơn + hạn 48h), E8 `order-paid` (link bài đầu tiên), E1 `welcome`, E2 `reset-password`, E13 `refund-done` trước; E6/E7 nhắc thanh toán 12h/24h, E10 nhắc học 7 ngày, E11 nhắc sự kiện trước 1 ngày, E12 `newsletter-welcome` sau. Hàng đợi email nhắc: Cloudflare Workers Cron Trigger chạy mỗi giờ (miễn phí — xác minh giới hạn cron khi triển khai).
15. **Giới hạn Resend Free là rủi ro vận hành từ giai đoạn này:** 3.000 email/tháng, tối đa **100 email/ngày** — ngày có 150 đăng ký mới thì 50 email sẽ lỗi `daily_quota_exceeded` tới 00:00 UTC hôm sau. Phương án khi chạm giới hạn: xếp hàng email nhắc sang ngày hôm sau, ưu tiên email giao dịch (E3/E5/E8); nâng Resend Pro $20/tháng (50.000 email) chỉ khi phê duyệt.

## Rủi ro

- **R6 (RLS) — RLS cấu hình sai → lộ dữ liệu học viên khác.** Giảm thiểu: test RLS bằng tài khoản test trước khi ra mắt; audit policy mỗi lần thêm bảng.
- **R5 (thanh toán thủ công) — Đối soát sai / chậm.** Giảm thiểu: mã đơn duy nhất; email nhắc 12h/24h; báo cáo đối soát hàng ngày (R9, §11 tài liệu kiến trúc).
- **R4 (video) — Video YouTube unlisted bị chia sẻ trái phép.** Giảm thiểu: chấp nhận ở giai đoạn 0 đồng; chuyển Stream/Mux khi có doanh thu hoặc phát hiện chia sẻ trái phép (cần phê duyệt).
- **R2 (Resend) — 100 email/ngày.** Giảm thiểu: việc 15 (xếp hàng, ưu tiên giao dịch).
- **R7 (secret) — Service-role key / Resend API key lộ.** Giảm thiểu: secret chỉ trong Cloudflare Workers Secrets + GitHub Secrets; không commit `.env`; xoay key khi có người rời đội.
- **Rủi ro dữ liệu:** `lessons.slug` UNIQUE theo khóa hay theo module chưa quyết (tài liệu kiến trúc §3.4) — quyết ở buổi kiểm tra trước khi viết migration, không tự ý chọn.

## Phụ thuộc

- Giai đoạn 2 xong (CMS + API lead + database nền tảng hoạt động).
- Quyết định của chủ dự án: khung hoàn trả 3/7/15 ngày (duyệt hay sửa), ngưỡng hoàn thành bài 90% (hay khác), `lessons.slug` UNIQUE theo khóa hay module, thông tin tài khoản ngân hàng + QR VietQR đã xác nhận, SePay/Stripe (chưa triển khai — chỉ khi phê duyệt riêng).
- Dịch vụ miễn phí và giới hạn: Supabase Auth 50.000 MAU/tháng; Workers Free 100.000 request/ngày (ghi nhạy cảm qua Workers — theo dõi, nâng Paid $5/tháng khi cần, phải phê duyệt); Resend Free 100 email/ngày (xem việc 15); YouTube unlisted (không giới hạn dung lượng, nhưng không phải bảo mật thật).

## Đầu ra kiểm chứng được

- 1 học viên thật (tài khoản test của chủ dự án hoặc học viên đầu tiên) đi hết luồng: đăng ký → đăng nhập → tạo đơn → chuyển khoản → admin xác nhận → vào học bài đầu tiên → làm quiz → tiến độ ghi nhận.
- Bảng `orders` / `payments` / `enrollments` đối soát được; email trong `email_logs` khớp với Resend.
- Báo cáo đối soát R9 chạy được (đơn pending quá 48h, đơn paid chưa có enrollment, payment không khớp, webhook lỗi).

## Tiêu chí xong

- [ ] **Học viên thật học được:** 1 học viên đăng ký, đăng nhập, mua/đăng ký 1 khóa, học 1 bài (video/tài liệu), làm 1 quiz, tiến độ ghi nhận đúng; đăng xuất rồi đăng nhập lại vẫn thấy tiến độ.
- [ ] **Thanh toán đối soát được:** 1 đơn hàng test đi hết luồng thanh toán → đối soát → hóa đơn; 1 yêu cầu hoàn trả test đi đúng khung thời gian chính sách đã được chủ dự án duyệt.
- [ ] **Email:** học viên nhận được email xác nhận đăng ký và nhắc học; không có email nào chứa PII không cần thiết.
- [ ] **Bảo mật:** mật khẩu được hash, không lưu plain-text; phân quyền đúng (học viên không vào được `/admin`); session hết hạn đúng; test RLS (học viên A không đọc được dữ liệu học viên B) đã qua.
- [ ] **Dữ liệu:** lead, học viên, đơn hàng mỗi thứ chỉ có 1 bảng chính; Sheet (nếu còn) chỉ là bản sao, khớp với database.
- [ ] **Cổng kiểm soát mở:** chỉ khi tất cả ô trên đã tick mới được nhận học phí qua trang. Trước đó, mọi khoản thu vẫn qua kênh thủ công ngoài trang như hiện tại.

---

# Giai đoạn 4 — LMS đầy đủ và vận hành (4–6 tuần, lặp lại)

## Mục tiêu

Nền tảng LMS vận hành được với 100–1.000 học viên (mục tiêu chủ dự án từng nêu), có số liệu để quyết định bước tiếp theo; admin quản lý được mọi thứ mà không cần sửa code; backup/giám sát/đối soát chạy ổn định ít nhất 2 tuần liên tiếp không mất lead.

## File liên quan

- Repo mới: `workspace/visfar-academy-platform/` —
  - `apps/web/src/app/(admin)/` — đầy đủ: `/admin`, `/admin/khoa-hoc`, `/admin/hoc-vien`, `/admin/lead`, `/admin/don-hang`, `/admin/su-kien`, `/admin/blog`, `/admin/chinh-sach`, `/admin/bao-cao`.
  - `workers/api/src/routes/reports.ts` — báo cáo R1–R10 (tài liệu kiến trúc §11).
  - `docs/RUNBOOK.md` — vận hành, backup, phục hồi (tài liệu kiến trúc §12.2).
  - `docs/DECISIONS.md` — ADR, ghi mọi quyết định kiến trúc.
  - `scripts/backup-check.mjs` — kiểm tra backup hàng ngày.
- Migration: thêm migration mới khi cần (chứng chỉ đã có bảng từ Giai đoạn 3; thêm cột/trường mới chỉ bằng migration mới, không sửa migration cũ).
- File HTML hiện tại: không còn dùng; giữ trong Git làm tài liệu lịch sử.

## Việc làm cụ thể

1. **Chứng chỉ hoàn thành.** Khi học viên hoàn thành 100% bài trong khóa → `enrollments.status = completed`, `completed_at = now()`, tạo `certificates` (mã duy nhất `VISFAR-CERT-2026-000123`, UNIQUE theo user+course), gửi email chúc mừng (E9) + gợi ý khóa tiếp theo. Học viên xem/tải chứng chỉ tại `/hoc-vien/chung-chi`.
2. **Đánh giá, bài tập, cộng đồng học viên.** Đánh giá khóa học, bài tập nộp bài, khu vực cộng đồng thay câu hẹn trong `#dang-cap-nhat` (hiện 4 thẻ placeholder: Đội ngũ chuyên gia, Nghiên cứu & xuất bản, Đối tác, Đánh giá & chứng nhận — làm thật từng thẻ hoặc gỡ khỏi trang cho tới khi có nội dung, không để placeholder trong sitemap mới).
3. **Admin dashboard đầy đủ.** Quản lý khóa học, bài học, học viên, lead (pipeline `new/contacted/enrolled/closed/spam`), đơn hàng, sự kiện, blog, chính sách (versioning — tạo version mới, không sửa version cũ; chỉ 1 bản `is_current` / 1 slug). Mọi thao tác admin ghi `audit_logs` (`order.mark_paid`, `course.publish`, `lead.status`…).
4. **Báo cáo (R1–R10, tài liệu kiến trúc §11).** Quan trọng nhất: học viên/doanh thu theo chương trình và kênh (R2–R4) — báo cáo này phải chạy được ngay từ ngày đầu, không chờ “đủ dữ liệu”; dùng báo cáo để quyết định chương trình nào mở rộng, chương trình nào dừng, bằng số thật, không bằng cảm nhận. Thêm: tổng quan (R1), tiến độ (R5), quiz (R6), sự kiện (R7), email (R8 — chạm giới hạn Resend bao nhiêu lần), đối soát thanh toán (R9), tăng trưởng (R10: học viên mới/tuần, MAU, retention 7/30 ngày). Mọi báo cáo có phân trang, lọc theo thời gian, xuất CSV (giai đoạn sau).
5. **Quy trình vận hành.**
   - **Mỗi sáng:** admin mở R9 — đơn pending quá hạn, payment không khớp, webhook lỗi; kiểm tra Sheet (nếu còn dùng) khớp với `leads` trong database.
   - **Mỗi tuần:** xem R1–R4 — lead, ghi danh, doanh thu; quyết định chương trình nào cần nội dung mới.
   - **Mỗi tháng:** xem R5, R6, R10; kiểm tra dung lượng Supabase (500 MB) và Storage (1 GB) còn bao nhiêu; restore thử backup lên project staging.
   - **Đối soát lead hàng ngày:** quy trình đối soát (form → database → Sheet) chạy ổn định ít nhất 2 tuần liên tiếp không mất lead.
6. **Backup và phục hồi (§12.2 tài liệu kiến trúc).** Supabase Free không có backup tự động hàng ngày: backup thủ công bằng `pg_dump` qua Supabase CLI/dashboard, lưu file `.sql` vào GitHub (repo riêng, private) + Cloudflare R2 (miễn phí 10 GB); script `backup-check.mjs` chạy hàng ngày qua GitHub Actions (miễn phí) để dump và kiểm tra file backup có mới không. File gốc (ảnh, tài liệu) lưu trong repo Git + Storage, đồng bộ 1 bản sao lên R2 hàng tuần. **Backup chưa từng restore thử thì coi như chưa có backup** — mỗi tháng restore thử 1 lần lên project staging (project thứ 2 trong 2 project miễn phí) và kiểm tra số dòng các bảng chính khớp với production.
7. **Giám sát và cảnh báo.** Cảnh báo khi form/API lỗi (Workers log + cron kiểm tra `GET /api/health` mỗi ngày — đồng thời là cron “giữ ấm” chống Supabase tạm dừng sau 7 ngày không hoạt động); cảnh báo khi Resend chạm quota ngày; cảnh báo khi dung lượng DB/Storage gần đầy. Runbook sự cố (§12.2): Supabase bị tạm dừng → Resume; DB lỗi → restore từ `pg_dump` mới nhất; Workers lỗi → deploy lại commit trước (giữ 5 commit gần nhất); Resend hết quota → xếp hàng email, gửi lại sau 00:00 UTC; mất secret → xoay key, cập nhật Workers Secrets, deploy lại.
8. **Lộ trình mở rộng 100 → 1.000 → 10.000 học viên (§12.3 tài liệu kiến trúc).**
   - 0–100: stack 0 đồng như hiện tại.
   - 100–1.000: nâng Supabase Pro $25/tháng (hết tạm dừng, DB 8 GB, backup hàng ngày) — **cần phê duyệt**; chuyển Storage sang R2 (10 GB miễn phí); SePay webhook (nếu phê duyệt).
   - 1.000–10.000: Workers Paid $5/tháng (10M request); Resend Pro $20/tháng (50.000 email); video chuyển sang Cloudflare Stream/Mux (có phí, cần phê duyệt) nếu cần bảo mật; thêm cache cho nội dung công khai.
   - >10.000: xem xét Supabase Team/dedicated hoặc tách database riêng; load test trước mỗi đợt ra mắt lớn. Không thay kiến trúc khi tăng quy mô — chỉ thay giới hạn và lớp lưu trữ video/thanh toán khi có phê duyệt.

## Rủi ro

- **R1 (Supabase) — Project tạm dừng sau 7 ngày không hoạt động → website không truy cập được DB.** Giảm thiểu: cron giữ ấm mỗi ngày; nâng Pro khi có doanh thu (cần phê duyệt).
- **R2 (Resend) — 100 email/ngày.** Giảm thiểu: xếp hàng, ưu tiên giao dịch; nâng Pro khi cần (cần phê duyệt).
- **R3 (Workers) — 100.000 request/ngày.** Giảm thiểu: đọc công khai qua Supabase trực tiếp; cache; nâng Paid $5 khi cần.
- **Rủi ro vận hành — Phụ thuộc 1 người.** Giảm thiểu: runbook, backup tự động, GitHub + Cloudflare đều có lịch sử deploy; branch protection cho `main` (không push trực tiếp, phải qua PR + review).
- **Rủi ro nhà cung cấp đổi giới hạn miễn phí.** Giảm thiểu: theo dõi trang pricing mỗi quý; tài liệu ghi rõ “xác minh lại trước khi triển khai”.
- **Rủi ro nội dung:** 4 thẻ “Đang cập nhật” và các placeholder còn sót làm mất niềm tin nếu để lâu. Giảm thiểu: việc 2 — làm thật hoặc gỡ.

## Phụ thuộc

- Giai đoạn 3 xong (tài khoản + thanh toán + email hoạt động).
- Quyết định của chủ dự án: nâng gói nào, khi nào (Supabase Pro $25, Workers Paid $5, Resend Pro $20, SePay, video trả phí) — mọi nâng cấp trả phí đều cần phê duyệt bằng văn bản, kèm số liệu cho thấy đã chạm giới hạn.
- Dịch vụ miễn phí và giới hạn: xem bảng §12.1 tài liệu kiến trúc (Supabase Free 2 project, DB 500 MB, Storage 1 GB, băng thông 5 GB egress, Auth 50.000 MAU, Edge Functions 500.000 lần/tháng, Realtime 200 kết nối; Pages Free 500 build/tháng; Workers Free 100.000 request/ngày; Resend Free 3.000 email/tháng, 100 email/ngày, 3 domain, log 30 ngày; R2 Free 10 GB, không phí egress; GitHub Free 2.000 phút Actions/tháng; YouTube unlisted không giới hạn dung lượng).

## Đầu ra kiểm chứng được

- Admin dashboard quản lý được khóa học, học viên, lead, đơn hàng, sự kiện, blog, chính sách mà không cần sửa code.
- Báo cáo R1–R10 chạy được bằng số thật.
- Backup tự động chạy hàng ngày; đã restore thử thành công 1 lần lên staging.
- Quy trình đối soát lead hàng ngày chạy ổn định ít nhất 2 tuần liên tiếp không mất lead.

## Tiêu chí xong

- [ ] **Vận hành với 100–1.000 học viên:** hệ thống chịu được số học viên mục tiêu; có backup tự động và quy trình rollback; có giám sát và cảnh báo khi form/API lỗi.
- [ ] **Chứng chỉ:** 1 học viên hoàn thành 1 khóa và nhận chứng chỉ ghi nhận được.
- [ ] **Admin:** quản trị viên quản lý được khóa học, học viên, lead, đơn hàng, sự kiện, blog, chính sách (có versioning) mà không cần sửa code.
- [ ] **Báo cáo:** có báo cáo học viên/doanh thu theo chương trình và kênh bằng số thật; dùng báo cáo này để quyết định chương trình nào mở rộng, chương trình nào dừng.
- [ ] **Đối soát lead hàng ngày:** quy trình đối soát (form → database → Sheet) chạy ổn định ít nhất 2 tuần liên tiếp không mất lead.
- [ ] Không còn placeholder (“Đang cập nhật”, blog không bài, sự kiện không trang con) trong sitemap mới — hoặc đã làm thật, hoặc đã gỡ khỏi menu.

---

# Quyết định cần chủ dự án phê duyệt

1. **Định nghĩa mục tiêu $100M** — 1 trong 3: (a) doanh thu tích lũy 10 năm, (b) lợi nhuận giữ lại, (c) giá trị ròng năm thứ 10. (Giai đoạn 0, việc 1. Chưa có định nghĩa thì không lập kế hoạch LMS chi tiết.)
2. **Sitemap mới** — chốt sitemap đề xuất (báo cáo §D.2): tách `/su-kien` khỏi `/blog`, chính sách thành URL thật `/chinh-sach/*`, thêm `/hoc-vien/*`, `/dang-nhap`, `/dang-ky`, `/admin/*`; mục nào giữ/sửa/bỏ. (Giai đoạn 0, việc 4.)
3. **Tuyên ngôn 13,65px ở 390px** — 1 trong 3: (a) chấp nhận 13,65px, (b) bỏ yêu cầu mỗi cụm đúng 1 dòng cho cụm 1b, (c) thu hẹp đệm trang để đạt 16px. (Giai đoạn 2, việc 3.)
4. **Cách đọc nhãn Tam giác hiện thực trên điện thoại** — 1 trong 4: chú giải mới / tách tam giác thành 2 nửa phóng to / chạm-vòng-hiện-nhãn-lớn / chấp nhận hiện trạng (nhãn ~3,98px ở 390px, chỉ đọc được khi phóng to hình). (Giai đoạn 2, việc 4.)
5. **Khung thời gian hoàn trả 3/7/15 ngày làm việc** (và khiếu nại 3/15/30 ngày) — khung hiện tại do builder viết, chưa được duyệt: duyệt nguyên khung hay sửa khung mới trước khi áp dụng vào luồng hoàn trả. (Giai đoạn 0, việc 5; áp dụng ở Giai đoạn 3, việc 11.)
6. **Nội dung do builder viết — duyệt hay gửi văn bản của mình:** 3 bài blog, thân bài thẻ Lĩnh vực 03 “Mối quan hệ”, văn bản bước Lộ trình số 2 “Tin”, nội dung 3 khóa 04/05/06 (Sức khỏe / Mối quan hệ / Tài chính). Nội dung nào chưa duyệt thì ghi rõ “nội dung tạm” trong seed, không công bố như văn bản chính thức. (Giai đoạn 0, việc 5.)
7. **Thanh toán: SePay và Stripe — có dùng không, và khi nào.** Giai đoạn đầu chỉ dùng chuyển khoản thủ công + đối soát (0 đồng). SePay (cần xác minh giá) và Stripe (cần xác minh hỗ trợ tài khoản Việt Nam và phí) chỉ triển khai khi có phê duyệt riêng bằng văn bản. Đồng thời xác nhận thông tin tài khoản ngân hàng + QR VietQR dùng cho khối chuyển khoản (không tự tạo QR từ thông tin chưa xác nhận). (Giai đoạn 3, việc 9–10.)
8. **Nâng cấp trả phí — nâng gói nào, khi nào.** Supabase Pro $25/tháng, Workers Paid $5/tháng, Resend Pro $20/tháng, video trả phí (Cloudflare Stream/Mux/Vimeo Pro): mỗi gói chỉ nâng khi có số liệu cho thấy đã chạm giới hạn miễn phí tương ứng, và có phê duyệt bằng văn bản. (Giai đoạn 4, việc 8.)

---

# Kiểm chứng bằng grep (10/11/2026, trên `workspace/user/files/Visfar_Academy.html`)

Các điểm đã kiểm chứng lại trực tiếp bằng grep, không chỉ dựa vào báo cáo:

- `!important`: đúng **300 lần** xuất hiện (trên 187 dòng) — khớp báo cáo.
- `<h1`: **4**, tất cả trong 4 bài chính sách ẩn (dòng 4448, 4499, 4538, 4572); trang chính không có `<h1>` — khớp báo cáo (S1).
- `no-cors`: **0** — file này dùng fetch CORS mặc định, không có `mode:"no-cors"` — khớp đính chính trong báo cáo (A.5).
- `og:`: **0** — không có meta Open Graph — khớp báo cáo (H8).
- `floatCta`: **2 dòng**, chỉ trong JS (`getElementById` dòng 4841), HTML không có id này — khớp báo cáo (H4).
- `footEmail`: **2 dòng** (label + input), không có `<form>` trong footer, không có handler — khớp báo cáo (H5).
- `data-copy`: chỉ có handler JS (dòng 4836–4837), không có phần tử HTML nào mang `data-copy` — khớp báo cáo (code chết).
- `mailto:`: **8 lần** — khớp báo cáo (S5).
- Sự kiện 22/05, 25/05, 28/05/2026: còn nguyên tại dòng 4225, 4240, 4255, với pill “Đã diễn ra” — khớp báo cáo (H7).
- URL Web App Apps Script: đúng 1 lần trong file (dòng 4862).
- `Thấu Hiểu Bản Thân`: grep đếm **2 dòng** (báo cáo ghi ×3 — chênh lệch do cách đếm dòng/xuất hiện; cần đối chiếu lại khi dọn ở Giai đoạn 1, không ảnh hưởng kết luận: tên khóa cũ còn sót).
- `<style`: 7 khối; `<script`: 3 khối — khớp lưu ý trong báo cáo (nhóm UI đếm 4 khối `<style>` chính, nhóm kỹ thuật đếm 7 kể cả khối chốt nhỏ).

# Những gì kế hoạch này KHÔNG xác minh được (kế thừa từ báo cáo)

1. Bản deploy Apps Script thực tế có trùng `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` hay không; quyền deploy; rate-limit phía server.
2. Tab `DATA VISFAR ACADEMY` có dòng test nào còn sót hay không; có ai đang spam Sheet hay không.
3. CORS/latency thực tế của Web App từ trình duyệt; Zalo link có mở đúng nhóm/số hay không.
4. Hiệu năng render thật (FCP/LCP) trên điện thoại thật; overflow ngang thật; độ mượt của hiệu ứng reveal/hover trên điện thoại thật.
5. Số học viên/doanh thu thật theo chương trình và kênh; định nghĩa mục tiêu $100M.

Những mục này cần test thật ở Giai đoạn 0–1, không được kết luận từ mã nguồn.

*Kế hoạch cải tiến — chưa lập trình, chưa sửa code, chưa deploy. Mọi quyết định kiến trúc và nội dung thuộc về chủ dự án.*
