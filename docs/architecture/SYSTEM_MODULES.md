# SYSTEM_MODULES.md — Đặc tả 12 phân hệ hệ thống Visfar Academy

**Ngày:** 10/11/2026
**Trạng thái:** Chờ phê duyệt kiến trúc
**Phạm vi:** TASK 02 — Visfar Academy (nền tảng E-learning, framework đã chốt: Next.js — xem Quyết định 19)
**Tài liệu nguồn:**
- `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (Tài liệu kiến trúc tổng thể v1.0, 10/11/2026) — đặc biệt §1 (frontend/backend), §3 (schema database), §5 (phân quyền), §6 (RLS), §7 (API), §8 (thanh toán), §9 (luồng học tập), §10 (email automation), §11 (báo cáo), §12 (giới hạn miễn phí, backup, mở rộng)
- `workspace/visfar-academy-platform/docs/DECISIONS.md` (19 quyết định đã chốt ngày 10/11/2026)
- `workspace/visfar-academy-platform/docs/audit/CURRENT_FUNCTIONALITY.md` (TASK 01 — Audit trang HTML hiện tại)

**Quy tắc áp dụng cho file này:**
- Chưa viết code, chưa tạo database, chưa deploy. File này chỉ là đặc tả để phê duyệt.
- Không sửa code / file HTML gốc (`Visfar_Academy.html`).
- Dữ liệu của mọi phân hệ chỉ dùng các bảng trong schema §3 của Tài liệu kiến trúc tổng thể — **không tự ý thay đổi schema, không thêm bảng mới trong file này**. Chỗ nào cần bảng chưa có trong §3 thì ghi rõ là “cần quyết định schema” ở mục “Quyết định cần phê duyệt” cuối file, không tự thêm.
- Không ghi số tài khoản ngân hàng. Thông tin thanh toán duy nhất được ghi trong file này: ngân hàng **MB Bank**, chủ tài khoản **Công ty TNHH MTV Visfar Holdings**. Số tài khoản chỉ dùng từ ảnh chụp / file QR do user cung cấp khi cần tạo khối thanh toán / VietQR (Quyết định 15).
- Không bịa ngày/giờ sự kiện ngoài ngày **25/11/2026** (ngày đã chốt cho cả 3 sự kiện — Quyết định 7). Giờ và hình thức từng sự kiện chưa được cung cấp, chờ user gửi sau.
- Không bịa giá dịch vụ trả phí: mọi giá nâng cấp gói đều ghi **“cần xác minh lại”** trước khi nâng (Quyết định 18).
- Nội dung, triết lý Giáo dục Tận Gốc, 3 trụ cột Tâm thức – Trí tuệ – Nhân hiệu, thứ tự 10 khóa học 01–10, màu đen than – vàng gold – ivory champagne, font Be Vietnam Pro được giữ nguyên và chuyển sang hệ thống mới dưới dạng dữ liệu.

## Quy ước trạng thái (dùng thống nhất trong cả 12 phân hệ)

| Trạng thái | Ý nghĩa |
|---|---|
| ✅ Đã có trên trang HTML hiện tại | Đã xác minh bằng mã nguồn trong audit TASK 01 (mục A trong `CURRENT_FUNCTIONALITY.md`). Khi chuyển sang nền tảng mới, chức năng này được giữ nguyên hành vi, chỉ chuyển từ HTML tĩnh / JS client-side sang dữ liệu + API. |
| 🔧 Cần sửa từ trang hiện tại | Đã có nhưng có lỗi / thiếu sót đã ghi trong audit (mục B/D). Phải sửa khi xây mới, không được sao chép nguyên lỗi sang hệ thống mới. |
| 🆕 Cần xây mới | Chưa có gì trong file HTML hiện tại (mục C/E trong audit) — phải xây hoàn toàn mới. |
| ⏳ Chờ quyết định | Chức năng phụ thuộc vào một quyết định chưa có (ghi rõ ở cuối file). Không tự chọn thay user. |

Quy ước phân biệt trong từng phân hệ: mỗi chức năng được gắn một trong 4 nhãn trên, để không nhầm “đã có trên trang tĩnh” với “đã có trên nền tảng mới”. **Trang HTML hiện tại là landing page tĩnh 1 file — không có tài khoản, không có bài học, không có thanh toán, không có admin.** Mọi chức năng “đã có” dưới đây đều là chức năng của trang tĩnh, chưa phải chức năng của hệ thống E-learning.

## Bảng tổng quan 12 phân hệ

| # | Phân hệ | Trạng thái tổng thể | Bảng dữ liệu chính (schema §3) |
|---|---|---|---|
| M01 | Public Website | ✅ Đã có (nội dung tĩnh) + 🔧 Cần sửa nhiều điểm + 🆕 Trang chi tiết / SEO thật | `courses`, `posts`, `events`, `policies`, `newsletter_subscribers`, `leads` (ghi qua API) |
| M02 | Authentication | 🆕 Cần xây mới hoàn toàn | `profiles` (+ `auth.users` của Supabase Auth) |
| M03 | Student Portal | 🆕 Cần xây mới hoàn toàn | `profiles`, `enrollments`, `lesson_progress`, `certificates`, `orders`, `event_registrations` |
| M04 | LMS (quản lý khóa học & bài học) | 🆕 Cần xây mới (nội dung tĩnh hiện tại chỉ làm dữ liệu seed) | `courses`, `modules`, `lessons`, `enrollments`, `lesson_progress` |
| M05 | Assessment (quiz & đánh giá) | 🆕 Cần xây mới hoàn toàn | `lessons`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `enrollments`, `lesson_progress` |
| M06 | Instructor Portal | 🆕 Cần xây mới hoàn toàn | `profiles`, `courses`, `modules`, `lessons`, `enrollments`, `lesson_progress`, `quiz_attempts` |
| M07 | Admin Panel | 🆕 Cần xây mới hoàn toàn | Mọi bảng (quyền admin), `audit_logs` |
| M08 | CRM (quản lý lead & học viên) | 🆕 Cần xây mới (luồng lead hiện tại là form → Apps Script → Sheet, sẽ thay bằng API-first) | `leads`, `profiles`, `enrollments`, `orders`, `newsletter_subscribers` |
| M09 | Payment (thanh toán & đối soát) | 🆕 Cần xây mới hoàn toàn | `orders`, `payments`, `enrollments`, `profiles` |
| M10 | Email Automation | 🆕 Cần xây mới hoàn toàn | `email_logs`, `leads`, `orders`, `enrollments`, `event_registrations`, `newsletter_subscribers`, `profiles` |
| M11 | Notification (thông báo) | 🆕 Cần xây mới — một phần dùng lại kênh email (M10); thông báo in-app chưa có bảng trong schema §3, cần quyết định | `email_logs`, `orders`, `enrollments`, `event_registrations` (kênh email); in-app: chưa có bảng — xem mục Quyết định cần phê duyệt |
| M12 | Analytics (báo cáo & đối soát) | 🆕 Cần xây mới hoàn toàn | Chỉ đọc: `leads`, `enrollments`, `orders`, `payments`, `lesson_progress`, `quiz_attempts`, `email_logs`, `events`, `event_registrations` |

---

## M01 — Public Website (Trang công khai)

### Mục tiêu
Là cửa ngõ công khai của Visfar Academy: khách chưa đăng nhập xem được toàn bộ nội dung giới thiệu, triết lý, 10 khóa học, sự kiện, blog, chính sách và đăng ký tư vấn — với cùng nội dung, thứ tự và nhận diện như trang hiện tại, nhưng nội dung nằm trong database (không còn hard-code trong 1 file HTML 5,5 MB), có URL thật cho từng trang, SEO thật và hiệu năng thật.

### Chức năng chi tiết

**✅ Đã có trên trang HTML hiện tại (giữ nguyên hành vi khi chuyển sang dữ liệu):**
- Menu 6 mục không dropdown (Trang chủ, Giới thiệu, Các khóa học, Sự kiện, Blog, Kết nối) + điều hướng anchor tới mọi section chính; menu mobile mở/đóng; active menu theo section đang xem (IntersectionObserver); thanh tiến trình đọc; hiệu ứng reveal khi cuộn (tôn trọng `prefers-reduced-motion`).
- Hero + Sứ mệnh & Tầm nhìn + Triết lý Giáo dục Tận Gốc (Thập Nhất Viên Mãn, 11 phương diện) + Lộ trình 6 bước (Biết – Tin – Hiểu – Thấu suốt – Chuyển hóa – Huân tập và quảng bá) + Lĩnh vực ứng dụng + 10 khóa học 01–10 + Giải pháp doanh nghiệp + 8 testimonial học viên (đã xác nhận cho phép đăng) + FAQ 9 câu + footer đầy đủ.
- Tìm kiếm khóa học không dấu (client-side, trong `textContent` của 10 thẻ khóa học); lọc khóa học theo 5 tab trụ cột (Tất cả / Tâm thức / Trí tuệ / Nhân hiệu / Cộng đồng) + đếm “Đang hiển thị X / 10 chương trình”.
- Toggle “Xem chi tiết / Thu gọn” từng khóa học (Nội dung chính + Kết quả hướng đến); pre-select khóa học từ nút CTA vào form tư vấn (14/15 link khớp).
- Tam giác hiện thực SVG tương tác (8 vòng, 24 nhãn; vòng được chọn nổi lên, 7 vòng còn lại mờ).
- 4 trang chính sách mở bằng hash (`#policyView`): bảo mật, điều khoản tham gia, hoàn trả/hủy đăng ký, giải quyết khiếu nại — đủ toàn văn.
- Nút nổi Zalo hỗ trợ + nút Về đầu trang; footer có ô đăng ký nhận tin (xem 🔧 dưới đây).

**🔧 Cần sửa từ trang hiện tại (không sao chép lỗi sang hệ thống mới):**
- Tuyên ngôn hero + Tuyên ngôn triết lý ở 13,65px trên điện thoại 390px — **đã được user chấp nhận giữ nguyên** (Quyết định 1). Ghi nhận trạng thái “đã chấp nhận”, không tự ý tăng cỡ hay bỏ yêu cầu 1 dòng.
- Nhãn Tam giác hiện thực ~3,98px ở 390px — **đã được user chấp nhận giữ nguyên** (Quyết định 2). Không khôi phục legend, không tách sơ đồ, không thêm chạm-vòng-hiện-nhãn-lớn.
- Thiếu `<h1>` trang chính (4 `<h1>` hiện tại đều nằm trong `#policyView` ẩn); thiếu OG / Twitter / canonical / JSON-LD / sitemap; chính sách dùng hash không có đích thật (bot/crawler không đọc được) — **sửa theo Quyết định 13 (bổ sung `<h1>` + OG/Twitter/canonical/JSON-LD + CSP) và Quyết định 11 (sitemap mới: tách `/su-kien` khỏi `/blog`; chính sách thành URL thật; thêm `/hoc-vien/*`, `/dang-nhap`, `/dang-ky`, `/admin/*`)**.
- Sự kiện: tiêu đề “Lịch sự kiện sắp diễn ra” nhưng cả 3 thẻ đều “Đã diễn ra” với ngày 22/05/2026, 25/05/2026, 28/05/2026 — **đổi sang lịch tháng 11, ngày 25/11/2026 cho cả 3 sự kiện** (Quyết định 7). Giờ + hình thức từng sự kiện chưa được cung cấp, không tự bịa.
- Tên khóa cũ còn sót: link “Thấu Hiểu Bản Thân” (không khớp option mới “Thấu Hiểu Nội Tâm”) và câu FAQ chứa 3 tên cũ; số đếm trên 5 tab lọc là hard-code — sửa tên theo lưới hiện tại và chuyển số tab sang đếm động từ dữ liệu.
- Tìm kiếm hứa tìm “giảng viên” nhưng không có trường giảng viên trong dữ liệu thẻ — hoặc bổ sung dữ liệu giảng viên, hoặc sửa placeholder cho đúng với dữ liệu thật (xem mục Quyết định cần phê duyệt).
- Nợ kỹ thuật CSS: 300 `!important`, khối chốt cuối chồng chéo, code chết (`#floatCta`, `[data-copy]`, dead CSS) — **dọn ngay trên file hiện tại** (Quyết định 12), và không mang nợ này sang hệ thống mới: design system tách thành CSS variables + component library riêng.
- Khối liên hệ chính sách lặp nguyên văn 4 lần — khi chuyển sang dữ liệu, khối liên hệ dùng chung 1 nguồn, sửa 1 chỗ là đổi cả 4 bài.
- Ảnh/file base64 chiếm ~93% file (5,5 MB) — tách ảnh ra khỏi HTML, dùng `srcset`/`sizes`, lazy loading, font `.woff2` subset tiếng Việt; mục tiêu file HTML đầu tiên <500 KB.

**🆕 Cần xây mới (chưa có trên trang hiện tại):**
- Trang chi tiết từng khóa học (`/chuong-trinh/[slug]`), từng sự kiện (`/su-kien/[slug]`), từng bài blog (`/blog/[slug]`) — hiện tại blog chỉ có tiêu đề + đoạn văn, không có link tới bài đầy đủ; nút “Xem chi tiết” sự kiện chỉ cuộn về form tư vấn chung.
- Trang đăng ký sự kiện riêng cho từng sự kiện (không dùng chung form tư vấn).
- Sitemap, robots, JSON-LD (Organization + Course) render phía server.
- Form đăng ký tư vấn mới qua API (xem M08) thay cho form → Apps Script hiện tại; form vẫn giữ các trường hiện tại (họ tên, SĐT, email, tỉnh/thành trong 34 tỉnh, khóa quan tâm) và pre-select từ CTA.

### Dữ liệu (bảng liên quan theo schema §3)
- `courses` — 10 khóa hiện tại làm dữ liệu seed, giữ nguyên `display_order` 01–10, `slug`, `title`, `pillar`, `price_vnd` (0 = miễn phí / Tùy tâm), `is_featured`, `status`. Lưu ý: nội dung 3 khóa 04/05/06 (Sức khỏe / Mối quan hệ / Tài chính) hiện lấy từ Lĩnh vực — seed ghi rõ “nội dung tạm, chờ user gửi văn bản của mình”; nội dung do builder viết (3 bài blog, thẻ Lĩnh vực 03, bước “Tin”, nội dung 3 khóa 04/05/06) **đã được user duyệt** (Quyết định 10).
- `posts` — 3 bài blog hiện tại (đã duyệt theo Quyết định 10) + bài mới; chỉ `status='published'` mới hiện công khai.
- `events` — 3 sự kiện, ngày **25/11/2026** (giờ + hình thức chờ user gửi sau); `status` phải phản ánh đúng thực tế (không để “sắp diễn ra” mà toàn thẻ “Đã diễn ra”).
- `policies` — 4 chính sách hiện tại, có versioning (`version`, `is_current`); khung hoàn trả / khiếu nại theo Quyết định 9: **hoàn trả 15 ngày làm việc; khiếu nại phản hồi trong 3 ngày**. Các bước còn lại trong khung cũ giữ nguyên cho tới khi user nói khác.
- `newsletter_subscribers` — chỉ đọc qua form footer sau khi làm thật (xem M10).
- `leads` — ghi mới qua API (không ghi trực tiếp từ client); xem M08.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M08 (CRM)** cho form tư vấn (ghi lead qua API); **M10 (Email Automation)** cho email xác nhận sau đăng ký tư vấn; **M04 (LMS)** cho dữ liệu khóa học; **M07 (Admin Panel)** cho CMS quản lý nội dung công khai (khóa học, sự kiện, blog, chính sách); **M12 (Analytics)** cho số liệu hiển thị (nếu có).
- Dịch vụ ngoài: Cloudflare Pages (hosting frontend), Supabase (đọc nội dung công khai qua Supabase JS client + anon key + RLS `SELECT` công khai), Zalo (link ngoài `zalo.me` — chỉ là link, không phải tích hợp hệ thống).

### Giới hạn (miễn phí, kỹ thuật)
- Cloudflare Pages Free: 500 build/tháng, 20.000 file/site, 25 MiB/file; request tới static asset và băng thông không giới hạn — khó chạm ở giai đoạn đầu.
- Nội dung công khai nên đọc trực tiếp qua Supabase (không qua Workers API) để tránh chạm giới hạn Workers Free 100.000 request/ngày.
- Tuyên ngôn 13,65px và nhãn Tam giác ~3,98px ở 390px là giới hạn hình học của yêu cầu “đúng 1 dòng” — đã được user chấp nhận (Quyết định 1, 2), không tự ý “sửa” bằng cách phá yêu cầu 1 dòng.
- Không có tài khoản / khu vực học viên trên trang công khai — khách muốn học phải qua M02/M03.

### Trạng thái
- **✅ Đã có (nội dung tĩnh + tương tác client-side) / 🔧 Cần sửa nhiều điểm / 🆕 Cần xây mới (trang chi tiết, SEO thật, sitemap, form API).** Đây là phân hệ duy nhất có nền tảng thật từ trang hiện tại; các phân hệ còn lại phần lớn phải xây mới hoàn toàn.

---

## M02 — Authentication (Xác thực & tài khoản)

### Mục tiêu
Cho phép khách tạo tài khoản, đăng nhập, đăng xuất, đặt lại mật khẩu và quản lý hồ sơ — làm cửa ngõ bắt buộc trước mọi chức năng học tập, mua khóa học và quản trị. Không tự viết hệ thống xác thực: dùng Supabase Auth.

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có gì trên trang hiện tại):**
- Đăng ký tài khoản bằng email + mật khẩu (qua Supabase Auth); khi đăng ký xong, trigger tạo `profiles` tương ứng (1–1 với `auth.users`).
- Đăng nhập / đăng xuất; phiên đăng nhập bằng JWT của Supabase Auth; token hết hạn thì refresh.
- Quên mật khẩu / đặt lại mật khẩu (email đặt lại qua Supabase Auth + Resend — xem M10).
- Trang hồ sơ cá nhân: xem / sửa họ tên, SĐT, tỉnh/thành (1 trong 34 tỉnh/thành — whitelist ở API), ảnh đại diện.
- Phân quyền theo role (`student` / `instructor` / `admin`) — xem §5 Tài liệu kiến trúc tổng thể; role mặc định khi đăng ký là `student`; chỉ admin mới cấp/thu hồi role (qua M07).
- Bảo vệ route: `/hoc-vien/*` yêu cầu đăng nhập; `/admin/*` yêu cầu role `admin`; khách chưa đăng nhập bấm “Đăng ký học” được chuyển tới `/dang-nhap` rồi quay lại.
- Chống lạm dụng đăng nhập: rate-limit tối đa 10 lần/15 phút/IP (vượt thì trả 429, không ghi dữ liệu).

**✅ Đã có trên trang HTML hiện tại:** Không có. Trang hiện tại tự thừa nhận ở 1 dòng duy nhất: “Chưa có cổng đăng nhập riêng trên trang này: khu vực học viên là cộng đồng và lời chia sẻ của học viên tại phần Học viên. Đăng ký tư vấn vẫn qua form tại phần Kết nối.” — câu này biến mất khi M02 hoàn thành (khu vực học viên thật thay cho câu thừa nhận).

### Dữ liệu (bảng liên quan theo schema §3)
- `profiles` — `id` (= `auth.users(id)`, FK ON DELETE CASCADE), `full_name`, `phone` (CHECK `^0\d{9}$`), `email` (UNIQUE), `province`, `role` (CHECK IN `student`, `instructor`, `admin`; mặc định `student`), `avatar_url`, `created_at`, `updated_at`.
- `auth.users` — bảng xác thực của Supabase (không thuộc schema §3, do Supabase Auth quản lý; không tự tạo bảng người dùng riêng).
- `audit_logs` — ghi lại thao tác cấp/thu hồi role (qua M07).

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **Supabase Auth** (đăng ký/đăng nhập/JWT) và **M07 (Admin Panel)** cho cấp role; **M10 (Email Automation)** cho email chào mừng và đặt lại mật khẩu; **M03 (Student Portal)** và **M06 (Instructor Portal)** là nơi tiêu thụ phiên đăng nhập.
- Mọi API cần đăng nhập đều xác minh JWT bằng Supabase JWKS ở Workers API, không tin JWT do client tự khai.

### Giới hạn (miễn phí, kỹ thuật)
- Supabase Auth Free: 50.000 MAU/tháng — khó chạm ở giai đoạn đầu.
- Supabase Free tạm dừng project sau 7 ngày không hoạt động — cần cron “giữ ấm” gọi API mỗi ngày (xem Tài liệu kiến trúc §12.2); khi chạm giới hạn thì nâng gói — **cần xác minh lại** giá trước khi nâng (Quyết định 18).
- Không có role `superadmin` riêng trong giai đoạn đầu — `admin` là cao nhất.

### Trạng thái
- **🆕 Cần xây mới hoàn toàn.**

---

## M03 — Student Portal (Khu vực học viên)

### Mục tiêu
Là “nhà” của học viên sau khi đăng nhập: xem được các khóa đã ghi danh, tiếp tục học dở, theo dõi tiến độ, làm quiz, xem chứng chỉ, xem đơn hàng và đăng ký sự kiện — tất cả chỉ trong phạm vi dữ liệu của chính học viên đó.

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có gì trên trang hiện tại):**
- Dashboard học viên (`/hoc-vien/dashboard`): các khóa đã ghi danh + % hoàn thành từng khóa, bài học tiếp theo (“tiếp tục học” từ `last_position_sec`), chứng chỉ đã nhận, sự kiện sắp diễn ra đã đăng ký.
- Danh sách khóa học của tôi (`/hoc-vien/khoa-hoc`) + trang học từng bài (`/hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]`): xem video / đọc bài / tải tài liệu (signed URL, hết hạn sau 1 giờ — chỉ học viên đã ghi danh mới lấy được).
- Tiến độ học: cập nhật `progress_percent` + `last_position_sec`; đánh dấu hoàn thành bài; khi đủ 100% bài trong khóa thì enrollment chuyển `completed` + tạo chứng chỉ (xem M04/M05).
- Chứng chỉ của tôi (`/hoc-vien/chung-chi`): danh sách chứng chỉ + mã chứng chỉ duy nhất (`VISFAR-CERT-…`).
- Đơn hàng của tôi: xem trạng thái đơn, số tiền, mã đơn, hạn giữ chỗ; hủy đơn `pending` của mình.
- Hồ sơ của tôi (`/hoc-vien/ho-so`): sửa hồ sơ (xem M02).
- Đăng ký sự kiện (khi đã đăng nhập) và xem sự kiện đã đăng ký.
- Chỉ xem được dữ liệu của mình: RLS chặn học viên A đọc dữ liệu học viên B; kiểm tra quyền ở cả 2 lớp (RLS + Workers API).

**✅ Đã có trên trang HTML hiện tại:** Không có khu vực học viên thật. Chỉ có phần “Học viên” là cộng đồng + 8 lời chia sẻ (testimonial) tĩnh — đó là nội dung giới thiệu, không phải cổng học viên; phần này ở lại trang công khai (M01), không phải Student Portal.

### Dữ liệu (bảng liên quan theo schema §3)
- `profiles` — hồ sơ của chính học viên.
- `enrollments` — ghi danh của học viên (`user_id`, `course_id`, `order_id`, `status` `active`/`completed`/`revoked`, `enrolled_at`, `completed_at`; UNIQUE `user_id` + `course_id`).
- `lesson_progress` — tiến độ từng bài của học viên (`status`, `progress_percent` 0–100, `last_position_sec`, `completed_at`; UNIQUE `user_id` + `lesson_id`).
- `certificates` — chứng chỉ (`certificate_code` UNIQUE; UNIQUE `user_id` + `course_id`).
- `orders` — đơn hàng của học viên (chỉ xem đơn của mình).
- `event_registrations` — đăng ký sự kiện của học viên.
- `quiz_attempts` — bài làm quiz của học viên (xem M05).

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M02 (Authentication)** (bắt buộc đăng nhập + JWT); **M04 (LMS)** (nội dung khóa/bài); **M05 (Assessment)** (quiz); **M09 (Payment)** (đơn hàng, trạng thái thanh toán → enrollment); **M10 (Email Automation)** (email nhắc học, chúc mừng hoàn thành); **M11 (Notification)** (nhắc sự kiện, nhắc tiếp tục học).

### Giới hạn (miễn phí, kỹ thuật)
- Tài liệu bài học (PDF) lấy qua signed URL hết hạn sau 1 giờ; video bài giảng qua YouTube unlisted (xem M04) — không phải bảo mật thật.
- Học viên không xem được bài học của khóa chưa ghi danh, trừ bài `is_free_preview`.
- Không lưu tiến độ ở `localStorage`/cookie — tiến độ chỉ lưu ở server (database) sau khi xác minh enrollment.

### Trạng thái
- **🆕 Cần xây mới hoàn toàn.**

---

## M04 — LMS (Quản lý khóa học, module & bài học)

### Mục tiêu
Biến 10 khóa học tĩnh trên trang hiện tại thành khóa học có cấu trúc thật (khóa → module → bài học), có video / tài liệu / bài xem thử, có ghi danh và tiến độ — làm xương sống cho toàn bộ hoạt động học tập.

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (về mặt chức năng học tập):**
- Quản lý khóa học (admin tạo/sửa/xuất bản/lưu trữ khóa; giảng viên chỉ sửa bài học của khóa mình phụ trách — xem M06): tiêu đề, mô tả, nội dung chính + kết quả hướng đến (`details` jsonb), trụ cột, poster, giá, trạng thái `draft`/`published`/`archived`.
- Quản lý module (`modules`) và bài học (`lessons`): tiêu đề, thứ tự hiển thị, loại bài (`video` / `text` / `quiz` / `file`), nội dung text, link video, thời lượng, tài liệu đính kèm, cờ `is_free_preview`.
- Ghi danh: khóa miễn phí (`price_vnd = 0`) ghi danh ngay qua `POST /api/my/enrollments`; khóa trả phí / Tùy tâm phải qua đơn hàng → thanh toán → enrollment tự tạo khi đơn `paid` (xem M09); khóa “Cộng đồng Visfar” ghi danh mở, không cần thanh toán. Không có đường tắt tạo enrollment mà không có đơn đã trả (trừ admin tặng — phải ghi `audit_logs`).
- Tiến độ và hoàn thành: client gửi `progress_percent` + `last_position_sec` định kỳ (mỗi 30 giây khi xem video, và khi rời bài); server kiểm tra enrollment còn `active`, `progress_percent` 0–100, chống nhảy 0% → 100% trong 1 giây. **Ngưỡng hoàn thành đã chốt (Quyết định 17): 90% (video) / bấm “Đã hoàn thành” (bài text), tính theo module.** Khi tất cả bài trong khóa đều `completed` → enrollment `completed` + tạo chứng chỉ + gửi email chúc mừng.
- Video bài giảng: đăng lên **YouTube ở chế độ không công khai (unlisted)** — giải pháp 0 đồng đã chốt; `video_url` lưu trong `lessons.video_url`.
- Học viên xem lại bài đã hoàn thành bất cứ lúc nào; tiến độ không bị xóa khi xem lại.

**✅ Đã có trên trang HTML hiện tại (chỉ ở dạng nội dung tĩnh — làm dữ liệu seed, không phải chức năng LMS):**
- 10 thẻ khóa học với “Nội dung chính + Kết quả hướng đến” (mở bằng toggle), taxonomy `data-cat`/`data-num`, tìm kiếm + lọc client-side — đây là **nội dung**, không phải khóa học có cấu trúc. Khi lên LMS, nội dung này làm nền cho `courses`/`modules`/`lessons`, không tự thành khóa học.
- Nội dung triết lý (6 mục, 11 phương diện, Lộ trình 6 bước) là chữ HTML tĩnh — làm nền cho `modules`/`lessons` khi nhập nội dung thật.
- **Chưa có trên trang hiện tại:** module, bài học riêng, video, tài liệu từng bài, tiến độ, ghi danh thật (`bài học` grep = 0; `video` grep = 0).

### Dữ liệu (bảng liên quan theo schema §3)
- `courses` — xem M01; `display_order` giữ nguyên 01–10; `poster_url` trỏ tới file mới (tên file theo số mới, không giữ tên poster cũ `poster-09/10/11` gây nhầm lẫn).
- `modules` — `course_id` (FK CASCADE), `title`, `display_order`.
- `lessons` — `module_id` (FK CASCADE), `slug`, `title`, `type` (`video`/`text`/`quiz`/`file`), `content`, `video_url` (YouTube unlisted), `video_duration_sec`, `file_url`, `display_order`, `is_free_preview`. **Quy tắc slug đã chốt (Quyết định 17): `lessons.slug` UNIQUE theo module (không theo khóa).**
- `enrollments` — ghi danh (UNIQUE `user_id` + `course_id`).
- `lesson_progress` — tiến độ từng bài (UNIQUE `user_id` + `lesson_id`).
- `certificates` — tạo khi hoàn thành 100% bài trong khóa.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M02 (Authentication)** (chỉ học viên đã ghi danh mới xem bài không xem thử); **M05 (Assessment)** (bài loại `quiz`); **M09 (Payment)** (ghi danh khóa trả phí đi qua đơn hàng); **M07 (Admin Panel)** / **M06 (Instructor Portal)** (soạn nội dung); **M10 (Email Automation)** (email chúc mừng hoàn thành); **M12 (Analytics)** (báo cáo % hoàn thành, bài bị bỏ nhiều).
- Dịch vụ ngoài: YouTube (video unlisted), Supabase Storage (ảnh, poster, PDF tài liệu — bucket `public` cho poster, bucket `private` cho tài liệu bài học), Cloudflare R2 (khi Storage 1 GB hết — xem giới hạn).

### Giới hạn (miễn phí, kỹ thuật)
- Video YouTube unlisted **không phải bảo mật thật** — ai có link đều xem được, không chống tải, không DRM. Đây là đánh đổi **đã được user chấp nhận** (Quyết định 16). Phương án thay thế khi cần bảo mật hơn (Cloudflare Stream / Mux / Vimeo Pro) có phí — **cần phê duyệt và cần xác minh lại** giá trước khi dùng.
- Supabase Storage Free chỉ 1 GB — **không dùng Storage cho video**; chỉ dùng cho ảnh, poster, PDF. Khi hết 1 GB thì chuyển sang Cloudflare R2 Free (10 GB, không phí egress).
- `courses.details` dùng `jsonb` cho Nội dung chính + Kết quả hướng đến — đủ cho giai đoạn đầu; khi cần tìm kiếm sâu trong chi tiết thì tách thành bảng riêng (quyết định schema sau, không tự đổi trong file này).

### Trạng thái
- **🆕 Cần xây mới hoàn toàn** (chức năng LMS). Nội dung tĩnh hiện tại chỉ là dữ liệu seed, không tính là “đã có LMS”.

---

## M05 — Assessment (Quiz, bài tập & chấm điểm)

### Mục tiêu
Cho phép học viên làm quiz sau mỗi bài học, chấm điểm ở server (không chấm bằng JS trên trình duyệt), lưu lịch sử làm bài và dùng kết quả làm đầu vào cho báo cáo — không cho phép gian lận điểm bằng cách sửa client.

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có gì trên trang hiện tại):**
- Ngân hàng câu hỏi trắc nghiệm theo bài học: mỗi bài loại `quiz` có nhiều câu hỏi (`quiz_questions`), mỗi câu có nhiều lựa chọn (`quiz_options`) với cờ `is_correct`.
- Học viên lấy câu hỏi qua API — response **không chứa `is_correct`** (client chỉ đọc qua VIEW `quiz_options_public`, không SELECT trực tiếp bảng gốc).
- Nộp bài qua API — server chấm bằng `quiz_options.is_correct`, lưu `quiz_attempts` (số câu đúng, tổng số câu, đáp án đã chọn), trả điểm + đáp án đúng (chỉ sau khi nộp).
- Không giới hạn số lần làm lại trong giai đoạn đầu (nếu sau này muốn giới hạn, thêm cột `max_attempts` vào `lessons` — quyết định schema sau, không tự thêm trong file này).
- Quiz không phải điều kiện bắt buộc để hoàn thành bài, trừ khi khóa học ghi rõ — quyết theo từng khóa khi nhập nội dung.
- Báo cáo quiz (xem M12): điểm trung bình / bài, câu hỏi nhiều người sai nhất.

**✅ Đã có trên trang HTML hiện tại:** Không có. `quiz` grep = 0; không có form quiz, không có logic chấm điểm.

### Dữ liệu (bảng liên quan theo schema §3)
- `lessons` — bài loại `quiz` (`type='quiz'`).
- `quiz_questions` — `lesson_id` (FK CASCADE), `question`, `display_order`.
- `quiz_options` — `question_id` (FK CASCADE), `option_text`, `is_correct`, `display_order`. **Đáp án đúng không bao giờ trả về cho client.**
- `quiz_attempts` — `user_id`, `lesson_id`, `score` (số câu đúng), `total` (tổng số câu), `answers` (jsonb — đáp án đã chọn, không lưu đáp án đúng ở đây), `submitted_at`.
- `enrollments` — chỉ học viên đã ghi danh khóa mới được làm quiz của khóa đó.
- `lesson_progress` — trạng thái hoàn thành bài quiz (nếu quiz là điều kiện hoàn thành theo từng khóa).

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M04 (LMS)** (bài học loại quiz, cấu trúc module); **M02 (Authentication)** (chỉ học viên đã ghi danh); **M03 (Student Portal)** (giao diện làm quiz, xem điểm); **M06 (Instructor Portal)** (giảng viên xem kết quả quiz của khóa mình phụ trách); **M12 (Analytics)** (báo cáo quiz R6).

### Giới hạn (miễn phí, kỹ thuật)
- Chấm điểm bắt buộc ở server (Workers API) — mọi ghi điểm từ client đều phải qua API kiểm tra enrollment; không chấm bằng JS trên trình duyệt.
- Chỉ hỗ trợ trắc nghiệm trong giai đoạn đầu (schema §3 chưa có bảng bài tập tự luận / chấm tay) — nếu cần bài tập tự luận thì cần quyết định schema (xem mục Quyết định cần phê duyệt).

### Trạng thái
- **🆕 Cần xây mới hoàn toàn.**

---

## M06 — Instructor Portal (Khu vực giảng viên)

### Mục tiêu
Cho phép giảng viên (do admin cấp role) xem học viên và tiến độ của khóa mình phụ trách, sửa nội dung bài học của khóa đó — nhưng không được chạm vào giá, đơn hàng, thanh toán hay lead.

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có gì trên trang hiện tại):**
- Mọi quyền của `student` (xem M03) + thêm:
- Xem danh sách học viên và tiến độ của khóa mình phụ trách (theo khóa, theo bài, theo học viên).
- Xem kết quả quiz của học viên trong khóa mình phụ trách.
- Tạo/sửa nội dung bài học của khóa mình phụ trách (tiêu đề, nội dung, video, tài liệu, câu hỏi quiz).
- **Không được:** sửa giá khóa học; xem/sửa đơn hàng hay thanh toán; xem lead; cấp/thu hồi role; xem báo cáo ngoài khóa mình phụ trách.
- “Khóa mình phụ trách” là khái niệm phân công giảng viên — xem lưu ý dữ liệu dưới đây (schema §3 chưa có bảng phân công, cần quyết định).

**✅ Đã có trên trang HTML hiện tại:** Không có. Trang hiện tại không có khái niệm giảng viên trong dữ liệu: ô tìm kiếm hứa tìm “giảng viên” nhưng không có trường giảng viên nào trong dữ liệu thẻ (audit B8) — tìm tên giảng viên luôn ra 0 kết quả. Tên giảng viên trong testimonial là học viên/chức danh, không phải dữ liệu giảng viên của LMS.

### Dữ liệu (bảng liên quan theo schema §3)
- `profiles` — giảng viên là `profiles` có `role='instructor'` (do admin cấp).
- `courses`, `modules`, `lessons` — giảng viên chỉ sửa bài học của khóa mình phụ trách (giới hạn ở API + RLS).
- `enrollments`, `lesson_progress`, `quiz_attempts` — chỉ đọc trong phạm vi khóa mình phụ trách.
- ⚠️ **Thiếu trong schema §3:** không có bảng hay cột nào ghi “giảng viên X phụ trách khóa Y”. Không tự thêm bảng trong file này — việc phân công giảng viên–khóa học là một **quyết định schema cần phê duyệt** (xem cuối file). Tạm thời, phân hệ này được đặc tả theo quyền (ai được làm gì) chứ chưa chốt cơ chế lưu phân công.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M02 (Authentication)** (role `instructor`); **M04 (LMS)** (nội dung khóa/bài); **M05 (Assessment)** (kết quả quiz); **M07 (Admin Panel)** (admin là người duy nhất cấp role `instructor` và — cho tới khi có cơ chế phân công — quyết định giảng viên phụ trách khóa nào).

### Giới hạn (miễn phí, kỹ thuật)
- Giảng viên không có quyền admin: không xem lead, không xem đơn hàng/thanh toán, không xem báo cáo toàn hệ thống.
- Chưa có cơ chế phân công giảng viên–khóa trong schema §3 (xem trên) — phân hệ này chưa thể triển khai đầy đủ cho tới khi chốt cơ chế đó.

### Trạng thái
- **🆕 Cần xây mới hoàn toàn** (và còn một quyết định schema chưa chốt — xem cuối file).

---

## M07 — Admin Panel (Khu vực quản trị)

### Mục tiêu
Là trung tâm vận hành duy nhất của Visfar Academy: admin (Lê Đăng Quyết + người được ủy quyền) quản lý toàn bộ khóa học, học viên, lead, đơn hàng, thanh toán, sự kiện, blog, chính sách, báo cáo và phân quyền — thay cho việc sửa tay file HTML như hiện tại.

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có gì trên trang hiện tại):**
- Quản lý khóa học / module / bài học / quiz: tạo, sửa, xuất bản (`published`), lưu trữ (`archived`), sắp xếp `display_order` (giữ nguyên thứ tự 01–10 khi seed).
- Quản lý học viên: danh sách, tìm kiếm, xem ghi danh / tiến độ / đơn hàng từng học viên; cấp/thu hồi role (`student` / `instructor` / `admin`).
- Quản lý lead: danh sách, lọc theo trạng thái / nguồn / khóa / tỉnh / thời gian, đổi trạng thái, ghi chú chăm sóc (xem M08).
- Quản lý đơn hàng & thanh toán: danh sách đơn, lọc theo trạng thái/khóa; xác nhận thanh toán thủ công (`mark-paid`); hoàn trả (xem M09).
- Quản lý sự kiện: tạo/sửa sự kiện, đổi trạng thái `upcoming`/`happened`/`cancelled`, xem số đăng ký.
- Quản lý blog: tạo/sửa/xuất bản/lưu trữ bài viết (Markdown).
- Quản lý chính sách: tạo version mới (tăng `version`, chỉ 1 bản `is_current` / 1 slug) — **không sửa version cũ**; hiển thị ngày cập nhật cho người dùng.
- Báo cáo / dashboard: xem các báo cáo R1–R10 (xem M12).
- Nhật ký thao tác admin (`audit_logs`): xem ai đã làm gì (VD `order.mark_paid`, `course.publish`, `lead.status`).
- Không có role `superadmin` riêng trong giai đoạn đầu — `admin` là cao nhất.

**✅ Đã có trên trang HTML hiện tại:** Không có route `/admin`, trang quản trị hay CMS nào. Thêm 1 khóa học hiện tại phải sửa tay HTML + form option + footer link; 4 khối liên hệ chính sách lặp nguyên văn (sửa 1 số điện thoại phải sửa 4 chỗ); chính sách không có versioning + ngày cập nhật (hiện ghi 04/11/2026).

### Dữ liệu (bảng liên quan theo schema §3)
- Mọi bảng trong schema §3 (quyền admin đọc/ghi theo RLS + kiểm tra role ở Workers API), đặc biệt: `courses`, `modules`, `lessons`, `quiz_questions`, `quiz_options`, `profiles`, `leads`, `orders`, `payments`, `enrollments`, `events`, `event_registrations`, `posts`, `policies`, `email_logs`, `newsletter_subscribers`.
- `audit_logs` — `actor_id`, `action`, `target_type`, `target_id`, `details`, `created_at`; chỉ admin đọc; chỉ Workers ghi.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M02 (Authentication)** (route `/admin/*` yêu cầu role `admin`); **M04 (LMS)**, **M08 (CRM)**, **M09 (Payment)**, **M12 (Analytics)** là các chức năng được vận hành từ Admin Panel; **M10 (Email Automation)** (xem log email, trạng thái gửi).

### Giới hạn (miễn phí, kỹ thuật)
- Admin Panel là route riêng trong cùng frontend Next.js (không phải hệ thống riêng).
- Mọi thao tác nhạy cảm (xác nhận thanh toán, hoàn trả, cấp role, xuất bản khóa) đi qua Workers API có xác thực + kiểm tra quyền ở server; RLS là lớp chặn cuối, không phải đường ghi chính.
- Không xóa cứng dữ liệu nghiệp vụ — dùng `deleted_at` / trạng thái (VD khóa học nên chuyển sang `archived` thay vì xóa; đơn hàng đã có thì khóa học không được xóa — `RESTRICT`).

### Trạng thái
- **🆕 Cần xây mới hoàn toàn.**

---

## M08 — CRM (Quản lý lead, học viên & chăm sóc)

### Mục tiêu
Biến form tư vấn hiện tại (điểm mù lớn nhất của trang: “thành công giả”, ghi trùng, không chống spam, không mã tham chiếu) thành một pipeline lead có kiểm soát: mọi đăng ký tư vấn đều có mã tham chiếu, chống trùng, chống spam, trạng thái chăm sóc rõ ràng, và liên kết được với học viên/đơn hàng khi lead chuyển đổi.

### Chức năng chi tiết

**🔧 Cần sửa từ trang hiện tại — luồng lead (điểm thay đổi lớn nhất của TASK 02):**
- Form tư vấn hiện tại (`#consultForm`): gửi về Google Sheet qua Apps Script Web App; validation client (họ tên khác rỗng; SĐT `/^0\d{9}$/`; email cho phép TLD 1 ký tự; tỉnh/khóa học khác rỗng); màn hình cảm ơn chỉ hiện khi server trả `ok:true` ở nhánh fetch chính — **nhưng nhánh fallback iframe hiện “thành công giả”** (iframe cross-origin không đọc được phản hồi; bất kỳ sự kiện `load` nào cũng hiện “Yêu cầu tư vấn của bạn đã được gửi đi.”). **Quyết định 3: giữ nguyên nhánh fallback** — không đổi văn bản fallback, không bỏ nhánh fallback. Đội ngũ giảm thiểu bằng mã tham chiếu + đối soát, không tự ý đổi ngược quyết định. Sau mỗi đăng ký thật vẫn cần kiểm tra tab DATA cho tới khi luồng mới thay thế hoàn toàn.
- Lệch validation email client/server (client cho TLD 1 ký tự, server yêu cầu ≥2 ký tự) — đồng bộ cả hai về TLD ≥2 ký tự ở luồng mới.
- Không có idempotency / mã tham chiếu / kiểm tra trùng — một lần bấm có thể tạo 2 dòng (fetch timeout 30 giây sau khi server đã ghi → client gọi fallback iframe → ghi thêm 1 dòng trùng).
- Endpoint Web App công khai, không chống spam (không CAPTCHA, honeypot, CSRF, token; không giới hạn độ dài tên).
- **Luồng mới đã chốt (Quyết định 5): API làm lớp trước, rồi ghi Sheet.** API nhận lead → validate / chống spam / chống trùng → ghi vào database (nguồn sự thật) → ghi Sheet (bản sao đối soát). Sheet không còn là đường ghi duy nhất. Được phép sửa + deploy lại file `.gs` khi cần cho luồng này.
- **Chống spam đã chốt (Quyết định 4): thêm cả hai** — (a) honeypot + rate-limit + idempotency, và (b) CAPTCHA.
- **PII trong mailto/clipboard dự phòng (Quyết định 8): giữ nguyên** theo ý chủ dự án (đội ngũ đã cảnh báo rủi ro: PII lộ qua email client / lịch sử trình duyệt / clipboard). Luồng mới giảm thiểu bằng mã tham chiếu + đối soát; PII chỉ gửi qua POST HTTPS tới server mới là đúng — ghi nhận quyết định, không tự ý bỏ.

**🆕 Cần xây mới:**
- API `POST /api/leads` (qua Workers): validation server đầy đủ (họ tên 2–100 ký tự; SĐT `/^0\d{9}$/`; email TLD ≥2 ký tự; tỉnh trong 34 tỉnh/thành; `course_id` tồn tại và `published` hoặc null); honeypot phải rỗng; rate-limit 5 lần/giờ/IP; header `Idempotency-Key` (UUID do client sinh) — trùng key thì trả lại kết quả cũ (mã tham chiếu cũ, `duplicate: true`).
- Mã tham chiếu duy nhất cho mỗi lead (`reference_code`, VD `VISFAR-2026-000123`) — để đối soát và để người đăng ký tra cứu; **không còn “thành công” nào mà không có mã tham chiếu**.
- Pipeline chăm sóc lead: trạng thái `new` → `contacted` → `enrolled` / `closed` / `spam`; ghi chú chăm sóc (admin); lọc theo trạng thái / nguồn / khóa / tỉnh / thời gian.
- Liên kết lead → học viên: lead chưa gắn cứng với user; khi lead đăng ký tài khoản bằng cùng email, hệ thống liên kết bằng email (không FK cứng); admin chuyển trạng thái lead sang `enrolled` khi lead thành học viên.
- Nguồn lead (`source`): `visfar-academy` / `nang-tam` / khác — ghi lại đúng nguồn; lưu cả `course_interest_text` (tên khóa lúc đăng ký, đề phòng khóa đổi tên/xóa sau này).
- Newsletter thật (Quyết định 6): form footer + handler thật (ghi vào `newsletter_subscribers` / dịch vụ email), không xóa input. Hiện tại `#footEmail` không có `<form>`, không có JS nào đọc nó; nút “Đăng ký” chỉ cuộn tới `#tu-van`, email đã gõ bị bỏ — đây là điểm giả rõ nhất trong file, phải làm thật.
- Dashboard CRM: số lead mới theo ngày/tuần, theo nguồn, theo khóa, theo tỉnh; tỷ lệ chuyển đổi lead → đơn (xem M12, R2).

### Dữ liệu (bảng liên quan theo schema §3)
- `leads` — `reference_code` (UNIQUE), `idempotency_key` (UNIQUE), `full_name`, `phone`, `email`, `province`, `course_id` (FK SET NULL; NULL nếu “Chưa biết bắt đầu từ đâu”), `course_interest_text`, `source` (mặc định `visfar-academy`), `status` (`new`/`contacted`/`enrolled`/`closed`/`spam`), `notes`, `created_at`, `updated_at`.
- `profiles` — liên kết lead → học viên bằng email (không FK cứng).
- `enrollments`, `orders` — lead chuyển đổi thành ghi danh / đơn hàng (liên kết qua user/email, không FK cứng từ `leads`).
- `newsletter_subscribers` — `email` (UNIQUE), `status` (`subscribed`/`unsubscribed`), `source` (mặc định `footer`).
- `audit_logs` — ghi thao tác đổi trạng thái / ghi chú lead của admin.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M01 (Public Website)** (form tư vấn, form newsletter footer); **M07 (Admin Panel)** (quản lý lead, pipeline chăm sóc); **M10 (Email Automation)** (email “Đã ghi nhận, mã tham chiếu VISFAR-…” cho người đăng ký + email báo lead mới cho admin); **M09 (Payment)** (lead → đơn hàng khi đăng ký khóa trả phí); **M12 (Analytics)** (báo cáo lead R2, tỷ lệ chuyển đổi).
- Dịch vụ ngoài (giai đoạn chuyển tiếp): Google Sheet (bản sao đối soát — chỉ để đối soát, không phải database chính; bỏ khi API lead ổn định) + Apps Script Web App (file `.gs` được phép sửa + deploy lại cho luồng API-first).

### Giới hạn (miễn phí, kỹ thuật)
- Rate-limit lead: tối đa 5 lần/giờ/IP; vượt thì trả 429, không ghi dữ liệu.
- Form chết hoàn toàn khi tắt JavaScript (form hiện tại không có `action`/`method`, toàn bộ submit nằm trong JS) — luồng mới giữ nguyên yêu cầu JavaScript cho form, nhưng **không hiện “cảm ơn” khi chưa có xác nhận ghi xong** (trừ nhánh fallback đã được user quyết giữ — Quyết định 3).
- Google Sheet chỉ là bản sao; nguồn sự thật duy nhất là PostgreSQL (nguyên tắc kiến trúc số 3).

### Trạng thái
- **🔧 Cần sửa từ trang hiện tại (luồng lead) + 🆕 Cần xây mới (API lead, pipeline CRM, newsletter thật).** Đây là phân hệ có nhiều rủi ro đã biết nhất (D1, D2, D4, D5, D6 trong audit) và nhiều quyết định đã chốt nhất (Quyết định 3, 4, 5, 6, 8).

---

## M09 — Payment (Thanh toán, đơn hàng & đối soát)

### Mục tiêu
Thu học phí (bao gồm học phí “Tùy tâm”) một cách có kiểm soát: mọi đơn hàng đều có mã tham chiếu duy nhất làm nội dung chuyển khoản, đơn chỉ chuyển sang `paid` khi có xác minh thật (webhook có chữ ký hoặc admin đối soát sao kê), enrollment chỉ tạo khi đơn đã trả, hoàn trả thực thi đúng chính sách đã công bố.

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có gì trên trang hiện tại):**
- Tạo đơn hàng (`POST /api/orders`): body `course_id` + `custom_amount_vnd` (nếu Tùy tâm); trả `reference_code` (VD `DH-2026-000123` — nội dung chuyển khoản) + QR VietQR + thông tin chuyển khoản + hạn giữ chỗ 48 giờ (`expires_at` = +48h).
- Xem đơn của mình / hủy đơn `pending` của mình (học viên); admin xem mọi đơn, lọc theo trạng thái/khóa.
- **Giai đoạn đầu (0 đồng, triển khai đầu tiên): chuyển khoản thủ công + admin đối soát.** Học viên chuyển khoản (app ngân hàng) → admin kiểm tra sao kê hằng ngày → `POST /api/admin/orders/:id/mark-paid` (tạo `payments` + đơn → `paid` + tạo enrollment + gửi email “Đã nhận thanh toán”). Đơn quá hạn → `expired`, học viên tạo đơn mới. Email nhắc “chưa thanh toán” sau 12h và 24h (xem M10).
- **SePay (đã chốt dùng — Quyết định 15):** khi triển khai, webhook SePay tự động đối soát — xác minh chữ ký webhook, tìm đơn theo `reference_code` trong nội dung chuyển khoản, kiểm tra số tiền khớp (không chấp nhận thiếu/thừa), tạo `payments` (`succeeded`) + đơn → `paid` + enrollment + email. Idempotency: (`method`, `gateway_reference`) UNIQUE — webhook gửi lại không tạo trùng. **SePay có gói trả phí — giá cần xác minh lại tại thời điểm triển khai, không giả định miễn phí.**
- Stripe (thẻ quốc tế): chỉ dùng khi cần thu thẻ quốc tế; chưa triển khai cho tới khi phê duyệt; cần xác minh Stripe có hỗ trợ tài khoản Việt Nam và phí giao dịch tại thời điểm triển khai — **cần xác minh lại**.
- Hoàn trả theo chính sách đã chốt (Quyết định 9): **hoàn trả trong 15 ngày làm việc; khiếu nại được phản hồi trong 3 ngày**. Học viên yêu cầu hoàn trả → admin kiểm tra khung thời gian → bấm hoàn trả → đơn → `refunded`, tạo bản ghi `payments` hoàn trả, gửi email xác nhận, thu hồi enrollment (`status='revoked'`). Hoàn trả chuyển khoản thủ công: admin chuyển khoản lại, ghi `gateway_reference` là mã giao dịch hoàn.
- Đối soát hằng ngày (xem M12, R9): đơn `pending` quá 48h; đơn `paid` chưa có enrollment; payment không khớp order; webhook lỗi.
- **Không bao giờ tin client báo “đã trả”.** Đơn chỉ chuyển sang `paid` khi (a) webhook cổng thanh toán xác minh chữ ký, hoặc (b) admin xác nhận thủ công sau khi kiểm tra sao kê. Client không bao giờ được tạo đơn “đã trả”.

**✅ Đã có trên trang HTML hiện tại:** Không có chức năng thanh toán. Trang tự ghi trong chính sách hoàn trả: “Trang Visfar Academy chỉ có chức năng giới thiệu chương trình và nhận đăng ký tư vấn qua form. Trang không có chức năng thanh toán, không thu bất kỳ khoản phí nào trực tiếp trên trang…” Học phí khóa 07 ghi “Tùy tâm” — không có luồng thu tiền trên trang. Chính sách hoàn trả/hủy đăng ký đã có toàn văn trong `#policyView` nhưng chưa có hệ thống nào thực thi.
- Thông tin tài khoản nhận (duy nhất được ghi trong đặc tả này): ngân hàng **MB Bank**, chủ tài khoản **Công ty TNHH MTV Visfar Holdings**. **Không ghi số tài khoản trong file này.** QR VietQR dùng file/ảnh do user cung cấp (QR Code cũ đã có thể dùng — Quyết định 15); không tự tạo QR mới từ thông tin chưa xác nhận.

### Dữ liệu (bảng liên quan theo schema §3)
- `orders` — `user_id`, `course_id` (FK RESTRICT — không cho xóa khóa đã có đơn), `amount_vnd` (integer, VND, ≥0; 0 = miễn phí / Tùy tâm chưa nhập số), `custom_amount_vnd`, `status` (`pending`/`paid`/`cancelled`/`refunded`/`expired`; chỉ server mới được đổi sang `paid`), `payment_method` (`bank_transfer`/`sepay`/`stripe`/`cash`/`free`), `reference_code` (UNIQUE — nội dung chuyển khoản), `expires_at`.
- `payments` — `order_id` (FK CASCADE), `amount_vnd` (>0), `method` (`bank_transfer`/`sepay`/`stripe`), `gateway_reference`, `gateway_payload` (jsonb — payload webhook gốc để đối soát, không chứa secret), `status` (`pending`/`succeeded`/`failed`/`refunded`), `paid_at`, `verified_by` (admin xác nhận thủ công). UNIQUE (`method`, `gateway_reference`) khi `gateway_reference` không NULL.
- `enrollments` — tạo khi đơn `paid` (hoặc admin tặng — ghi `audit_logs`); thu hồi (`revoked`) khi hoàn trả.
- `profiles` — chủ đơn hàng; `verified_by` trỏ tới admin xác nhận.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M04 (LMS)** (khóa học, giá, ghi danh sau thanh toán); **M03 (Student Portal)** (học viên xem đơn của mình); **M07 (Admin Panel)** (xác nhận thủ công, hoàn trả); **M10 (Email Automation)** (email tạo đơn, nhắc thanh toán, đã nhận thanh toán, hoàn trả xong); **M12 (Analytics)** (báo cáo doanh thu R4, đối soát R9).
- Dịch vụ ngoài: ngân hàng **MB Bank** (tài khoản nhận — xem trên); SePay (webhook đối soát tự động — khi triển khai); Stripe (khi phê duyệt).

### Giới hạn (miễn phí, kỹ thuật)
- Luồng thủ công: admin phải đối soát tay mỗi ngày; học viên chờ lâu (tối đa 48h giữ chỗ); sai nội dung chuyển khoản → không đối soát được. Giảm thiểu: mã đơn ngắn, dễ ghi; email nhắc sau 12h/24h; báo cáo đối soát hằng ngày.
- SePay/Stripe: có phí — **giá cần xác minh lại** trước khi triển khai, không giả định miễn phí; không dùng cho tới khi phê duyệt triển khai.
- Tiền lưu bằng `integer` (đơn vị VND, không dùng float cho tiền).

### Trạng thái
- **🆕 Cần xây mới hoàn toàn.** (Giai đoạn đầu: chuyển khoản thủ công; SePay đã chốt dùng nhưng thời điểm triển khai webhook cần phê duyệt — xem cuối file.)

---

## M10 — Email Automation (Email giao dịch & tự động)

### Mục tiêu
Mọi email của hệ thống (giao dịch + nhắc nhở) đều gửi qua một dịch vụ duy nhất (Resend, gọi từ server), có template tiếng Việt thống nhất, có nhật ký để đối soát, và tôn trọng giới hạn miễn phí (xếp hàng khi chạm quota, ưu tiên email giao dịch).

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có logic gửi email nào trên trang hiện tại):**
- Gửi email qua Workers API (gọi Resend bằng API key ở server) — **không gọi Resend từ frontend**.
- Ghi mọi email vào `email_logs` (người nhận, template, `resend_id`, trạng thái); webhook Resend cập nhật `delivered`/`bounced`.
- Email gửi từ domain riêng của Visfar (cần xác minh DNS: SPF, DKIM, DMARC) — **không gửi từ `onboarding@resend.dev` cho người dùng thật**.
- Template tiếng Việt, giọng văn tự nhiên, ít emoji, không thúc ép/FOMO mạnh (theo sở thích của user).
- Bảng email automation (13 email — theo §10.2 Tài liệu kiến trúc tổng thể):

| # | Trigger | Template | Gửi tới |
|---|---|---|---|
| E1 | Đăng ký tài khoản xong | `welcome` | Học viên mới |
| E2 | Quên mật khẩu | `reset-password` | Học viên |
| E3 | Tạo lead tư vấn | `lead-received` | Người đăng ký (“Đã ghi nhận, mã tham chiếu VISFAR-…”) |
| E4 | Tạo lead tư vấn | `lead-notify-admin` | Admin (báo có lead mới) |
| E5 | Tạo đơn hàng | `order-created` | Học viên (QR + thông tin chuyển khoản + số tiền + nội dung = mã đơn + hạn 48h) |
| E6 | Đơn quá 12h chưa trả | `order-reminder-12h` | Học viên |
| E7 | Đơn quá 24h chưa trả | `order-reminder-24h` | Học viên |
| E8 | Đơn đã trả | `order-paid` | Học viên (“Đã nhận thanh toán, vào học ngay” + link bài đầu tiên) |
| E9 | Hoàn thành khóa học | `course-completed` | Học viên (chúc mừng + chứng chỉ + gợi ý khóa tiếp theo) |
| E10 | Học viên không học 7 ngày | `lesson-reminder-7d` | Học viên (chỉ khi enrollment còn active và chưa hoàn thành) |
| E11 | Sự kiện sắp diễn ra (trước 1 ngày) | `event-reminder` | Người đăng ký sự kiện (link, giờ, chuẩn bị) |
| E12 | Đăng ký nhận tin | `newsletter-welcome` | Người đăng ký |
| E13 | Hoàn trả xong | `refund-done` | Học viên |

- Luồng kích hoạt: Workers API ghi dữ liệu → gọi hàm gửi email (đồng bộ cho email quan trọng E3/E5/E8; hàng đợi cho email nhắc E6/E7/E10/E11). Hàng đợi giai đoạn 0 đồng: Cloudflare Workers Cron Trigger chạy mỗi giờ để quét đơn quá hạn / học viên không học / sự kiện sắp diễn ra và gửi email nhắc. Không dùng hàng đợi trả phí nếu chưa phê duyệt.

**✅ Đã có trên trang HTML hiện tại:** Không có logic gửi email, không có hệ thống thông báo, không có lịch nhắc nào trong file; email duy nhất là `mailto:` dự phòng do người dùng tự bấm (xem M08 — Quyết định 8 giữ nguyên mailto/clipboard dự phòng).

### Dữ liệu (bảng liên quan theo schema §3)
- `email_logs` — `to_email`, `template`, `resend_id`, `status` (`queued`/`sent`/`delivered`/`bounced`/`failed`), `related_type` (VD `lead`, `order`, `enrollment`), `related_id`.
- Đọc từ: `leads` (E3/E4), `orders` (E5–E8/E13), `enrollments` + `lesson_progress` (E9/E10), `event_registrations` (E11), `newsletter_subscribers` (E12), `profiles` (E1/E2).
- Không FK cứng từ `email_logs` tới các bảng nghiệp vụ (`related_type` + `related_id`) để không khóa xóa.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M02 (Authentication)** (E1/E2), **M08 (CRM)** (E3/E4/E12), **M09 (Payment)** (E5–E8/E13), **M04 (LMS)** (E9/E10), **M01 (Public Website)** (E11 — sự kiện); **M11 (Notification)** dùng chung hàng đợi cron và dữ liệu kích hoạt; **M12 (Analytics)** (báo cáo email R8).
- Dịch vụ ngoài: Resend (gửi email + webhook trạng thái), Supabase Auth (email đặt lại mật khẩu — qua SMTP của Supabase).

### Giới hạn (miễn phí, kỹ thuật)
- Resend Free: 3.000 email/tháng, **tối đa 100 email/ngày** (reset 00:00 UTC); 3 domain gửi; lưu log 30 ngày. **100 email/ngày là giới hạn chạm đầu tiên** — một ngày có 150 đăng ký mới thì 50 email chào mừng sẽ lỗi `daily_quota_exceeded` cho tới 00:00 UTC hôm sau.
- Phương án khi chạm giới hạn: (1) xếp hàng email nhắc (E6/E7/E10) sang ngày hôm sau, ưu tiên email giao dịch (E3/E5/E8); (2) nâng lên Resend Pro — **giá cần xác minh lại** trước khi nâng (Quyết định 18); (3) phương án thay thế miễn phí khác (VD Supabase Auth SMTP + Gmail — chỉ cho email auth, không cho email marketing; không dùng Gmail cá nhân gửi hàng loạt).
- Cron Trigger miễn phí của Cloudflare Workers — cần xác minh giới hạn cron khi triển khai, không giả định.

### Trạng thái
- **🆕 Cần xây mới hoàn toàn.**

---

## M11 — Notification (Thông báo)

### Mục tiêu
Nhắc học viên và admin đúng lúc, đúng việc (đơn chưa trả, sắp tới sự kiện, lâu không học, có lead mới) — dùng email làm kênh chính trong giai đoạn đầu; thông báo in-app (chuông/thông báo trong trang) chỉ làm khi có quyết định riêng, vì schema hiện tại chưa có chỗ lưu nó.

### Chức năng chi tiết

**🆕 Cần xây mới — kênh email (dùng lại M10, không xây kênh mới):**
- Nhắc thanh toán sau 12h/24h (đơn `pending` chưa trả) — email E6/E7.
- Nhắc tiếp tục học khi không học 7 ngày (enrollment còn active, chưa hoàn thành) — email E10.
- Nhắc sự kiện trước 1 ngày cho người đã đăng ký sự kiện — email E11 (giờ + link tham gia; giờ từng sự kiện ngày 25/11/2026 chưa được cung cấp — email chỉ gửi khi đã có giờ thật, không bịa giờ).
- Báo lead mới cho admin — email E4 (chỉ gửi tới admin).
- Báo hết quota / lỗi gửi email cho admin (xem M12, R8) — để admin biết email nhắc đang bị xếp hàng.

**✅ Đã có trên trang HTML hiện tại (dạng tĩnh, không phải hệ thống thông báo):**
- Nút nổi Zalo hỗ trợ (`https://zalo.me/0347897868/`) và nút Zalo nhóm trong màn hình cảm ơn — đây là **link tĩnh ra Zalo**, không phải thông báo do hệ thống gửi; giữ nguyên link trên trang mới, không tính là chức năng Notification.
- Không có logic gửi email, không có hệ thống thông báo, không có lịch nhắc nào trong file (audit C12).

**⏳ Chờ quyết định — thông báo in-app:**
- Chuông thông báo / danh sách thông báo trong trang (học viên thấy “đơn của bạn đã được xác nhận”, “sự kiện ngày mai”, admin thấy “có lead mới”) **chưa được đặc tả đầy đủ** vì schema §3 không có bảng `notifications` (hay tương đương). Không tự thêm bảng trong file này. Nếu user muốn thông báo in-app thì cần quyết định schema + phạm vi (xem cuối file). Cho tới lúc đó, mọi thông báo đều đi qua email (M10).

### Dữ liệu (bảng liên quan theo schema §3)
- Kênh email: `email_logs` (nhật ký thông báo đã gửi), `orders` (nhắc thanh toán), `enrollments` + `lesson_progress` (nhắc học), `event_registrations` + `events` (nhắc sự kiện), `leads` (báo lead mới cho admin).
- Thông báo in-app: **không có bảng trong schema §3** — không bịa bảng, xem mục Quyết định cần phê duyệt.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M10 (Email Automation)** (kênh gửi + hàng đợi cron mỗi giờ); **M09 (Payment)** (đơn quá hạn); **M04 (LMS)** (học viên không học); **M01 (Public Website)** (sự kiện); **M08 (CRM)** (lead mới cho admin).
- Không phụ thuộc dịch vụ thông báo đẩy / SMS nào — **không có SMS trong stack** (cần quyết riêng, không tự ý thêm).

### Giới hạn (miễn phí, kỹ thuật)
- Mọi giới hạn của M10 (Resend 100 email/ngày) đều áp dụng cho M11 — khi chạm quota, thông báo nhắc bị xếp hàng, thông báo giao dịch được ưu tiên.
- Không có thông báo đẩy (push) trình duyệt / SMS trong giai đoạn đầu.
- Email nhắc sự kiện trước 1 ngày chỉ có ý nghĩa khi giờ sự kiện đã có thật (hiện chưa có giờ cho 3 sự kiện ngày 25/11/2026).

### Trạng thái
- **🆕 Cần xây mới (kênh email — dùng lại M10) / ⏳ Chờ quyết định (thông báo in-app — chưa có bảng trong schema §3).**

---

## M12 — Analytics (Báo cáo, đối soát & tăng trưởng)

### Mục tiêu
Cho admin nhìn được toàn bộ hoạt động trong một chỗ: lead, học viên, doanh thu, tiến độ học, quiz, sự kiện, email, đối soát thanh toán và tăng trưởng — chỉ đọc từ database, có phân trang, lọc theo thời gian, xuất CSV (giai đoạn sau). Số liệu “học viên/doanh thu theo chương trình và kênh” là báo cáo quan trọng nhất và phải chạy được ngay từ ngày đầu, không chờ “đủ dữ liệu” (hiện chưa có số liệu thật để xếp hạng chương trình).

### Chức năng chi tiết

**🆕 Cần xây mới hoàn toàn (chưa có gì trên trang hiện tại):**
- Báo cáo (theo §11.2 Tài liệu kiến trúc tổng thể):

| # | Báo cáo | Chỉ số chính |
|---|---|---|
| R1 | Tổng quan (dashboard admin) | Tổng học viên, tổng lead, tổng đơn, doanh thu, tỷ lệ chuyển đổi lead → đơn |
| R2 | Lead theo thời gian / nguồn / khóa / tỉnh | Số lead mới, theo trạng thái (`new`/`contacted`/`enrolled`/`closed`/`spam`), theo `source`, theo `course_id`, theo `province` |
| R3 | Học viên theo khóa học | Số ghi danh, % hoàn thành, số chứng chỉ / khóa; xếp hạng khóa theo ghi danh và hoàn thành |
| R4 | Doanh thu | Doanh thu theo ngày/tuần/tháng, theo khóa, theo phương thức; đơn pending quá hạn; hoàn trả |
| R5 | Tiến độ học tập | % hoàn thành trung bình / khóa; học viên không học 7/14/30 ngày; bài học có tỷ lệ bỏ cao nhất |
| R6 | Quiz | Điểm trung bình / bài; câu hỏi nhiều người sai nhất |
| R7 | Sự kiện | Số đăng ký / sự kiện; tỷ lệ tham dự (nếu có điểm danh) |
| R8 | Email | Số email gửi / delivered / bounced / failed theo template; số lần chạm giới hạn Resend |
| R9 | Đối soát thanh toán | Đơn `pending` quá 48h; đơn `paid` chưa có enrollment; payment không khớp order; webhook lỗi |
| R10 | Tăng trưởng | Học viên mới / tuần, MAU, retention (quay lại học sau 7/30 ngày) |

- Đối soát hằng ngày (quy trình vận hành, không phải code): mỗi sáng admin mở R9 — kiểm tra đơn pending quá hạn, payment không khớp, webhook lỗi; kiểm tra Sheet (nếu còn dùng) khớp với `leads` trong database. Mỗi tuần xem R1–R4; mỗi tháng xem R5, R6, R10 + kiểm tra dung lượng Supabase (500 MB) và Storage (1 GB) còn bao nhiêu.
- **Mục tiêu $100M đã chốt (Quyết định 14): cả 3 chỉ số cùng đạt mới tính là đạt mục tiêu** — doanh thu tích lũy, lợi nhuận giữ lại, và giá trị ròng năm 10, cả 3 cùng đạt 100 triệu đô. Báo cáo tăng trưởng (R10) và doanh thu (R4) là nơi theo dõi 3 chỉ số này; không tự định nghĩa lại mục tiêu trong báo cáo.
- Chỉ admin xem được báo cáo (giảng viên chỉ xem báo cáo khóa mình phụ trách — xem M06).

**✅ Đã có trên trang HTML hiện tại:** Không có dashboard, báo cáo hay analytics nào trong file (0 analytics, 0 `console.log`); số liệu duy nhất là Sheet thủ công và tab DATA phải kiểm tra tay sau mỗi đăng ký thật. Số đếm duy nhất trên trang là `#courseCount` (“Đang hiển thị X / 10 chương trình”) — đếm client-side, không phải analytics.

### Dữ liệu (bảng liên quan theo schema §3)
- Chỉ đọc (không ghi bảng mới): `leads`, `enrollments`, `orders`, `payments`, `lesson_progress`, `quiz_attempts`, `email_logs`, `events`, `event_registrations`, `courses`, `profiles`, `certificates`, `audit_logs`.
- Mọi báo cáo đều tổng hợp ở server (Workers API), có cache và phân trang — không tổng hợp nặng bằng RLS admin đọc trực tiếp.

### Phụ thuộc vào phân hệ / dịch vụ khác
- Phụ thuộc **M07 (Admin Panel)** (giao diện xem báo cáo); **M08 (CRM)** (dữ liệu lead), **M09 (Payment)** (dữ liệu đơn/payment), **M04 (LMS)** + **M05 (Assessment)** (tiến độ, quiz), **M10 (Email Automation)** (log email), **M01 (Public Website)** (dữ liệu sự kiện).
- Không phụ thuộc dịch vụ phân tích trả phí nào — **dịch vụ phân tích trả phí không có trong stack** (cần quyết riêng, không tự ý thêm).

### Giới hạn (miễn phí, kỹ thuật)
- Supabase Free: DB 500 MB, Storage 1 GB, băng thông 5 GB egress (+ 5 GB cached — lấy số thận trọng là 5 GB egress), Auth 50.000 MAU, Edge Functions 500.000 lần/tháng, Realtime 200 kết nối đồng thời, **tạm dừng sau 7 ngày không hoạt động**, không backup tự động hàng ngày, không SLA. Vượt DB 500 MB → chế độ chỉ đọc; vượt băng thông → lỗi 402; project tạm dừng → website không truy cập được DB cho tới khi resume thủ công.
- Workers Free: 100.000 request/ngày (reset 00:00 UTC); CPU 10ms/request — báo cáo nặng phải tổng hợp ở server + cache, không để mỗi lần mở dashboard quét toàn bộ bảng.
- Khi chạm giới hạn miễn phí thì nâng gói — áp cho cả Supabase, Workers và Resend (Quyết định 18); **giá cần xác minh lại** trước khi nâng, không cam kết số trong file này.
- Số liệu trong báo cáo là số liệu thật từ database; hiện chưa có số học viên/doanh thu theo chương trình hay kênh để xếp hạng — **không bịa số liệu, không trình bày số 0 như “đã đo”** khi dữ liệu chưa có.

### Trạng thái
- **🆕 Cần xây mới hoàn toàn.**

---

## Quan hệ phụ thuộc giữa 12 phân hệ (tóm tắt)

```
M01 Public Website ──ghi lead──▶ M08 CRM ──chuyển đổi──▶ M09 Payment ──paid──▶ M04 LMS (enrollment)
  │                                  │                        │                       │
  │ đọc courses/posts/events         │                        │                       ▼
  ▼                                  ▼                        ▼                 M03 Student Portal
M07 Admin Panel ◀──quản lý── M08 / M09 / M04 / M01      M10 Email Automation ◀──▶ M11 Notification
  │                                  │                        │
  ▼                                  ▼                        ▼
M02 Authentication ──JWT/role──▶ M03 / M06 / M07      M12 Analytics (chỉ đọc mọi phân hệ)
  │
  └──▶ M06 Instructor Portal ──sửa bài──▶ M04 LMS ──quiz──▶ M05 Assessment
```

Nguyên tắc: M02 là cửa ngõ (không đăng nhập thì không có M03/M06/M07); M09 là cổng duy nhất tạo enrollment cho khóa trả phí (không đường tắt); M08 là đường lead duy nhất (API-first, Sheet chỉ là bản sao); M10 là kênh gửi email duy nhất (không gọi Resend từ frontend); M12 chỉ đọc, không ghi bảng nghiệp vụ.

## Giới hạn chung (áp cho cả 12 phân hệ)

- **0 đồng trước, trả phí chỉ khi được phê duyệt.** Không dùng dịch vụ trả phí nào nếu chưa được user phê duyệt bằng văn bản. Mọi dịch vụ miễn phí đều có giới hạn đã ghi ở từng phân hệ; khi chạm giới hạn thì nâng gói — **giá cần xác minh lại** trước khi nâng (Quyết định 18).
- **Những gì KHÔNG có trong stack** (cần quyết riêng, không tự ý thêm): cổng thanh toán online ngoài SePay/Stripe đã chốt (xem M09); dịch vụ video trả phí (Cloudflare Stream, Mux, Vimeo); dịch vụ phân tích trả phí; dịch vụ SMS.
- **Bảo mật theo mặc định:** RLS bật trên mọi bảng; client không bao giờ chạm trực tiếp vào dữ liệu của người khác; mọi thao tác nhạy cảm đi qua Workers API có xác thực và kiểm tra quyền ở server; secret chỉ trong Cloudflare Workers Secrets / GitHub Secrets, không commit vào repo.
- **Một nguồn sự thật:** lead, học viên, khóa học, đơn hàng mỗi thứ chỉ có 1 bảng chính trong PostgreSQL. Google Sheet (nếu còn dùng) chỉ là bản sao/báo cáo, không phải database chính.
- **Mọi form đều có xác nhận thật:** không còn “thành công giả” trong luồng mới — mọi lần gửi đều có mã tham chiếu và trạng thái đối soát được. (Ngoại lệ duy nhất: nhánh fallback iframe trên trang hiện tại được user quyết giữ nguyên — Quyết định 3 — cho tới khi luồng mới thay thế hoàn toàn.)
- **Tách lớp rõ ràng:** Frontend (Next.js — Quyết định 19), API (Cloudflare Workers), database (Supabase Postgres), storage, email là 5 lớp độc lập.

---

## Quyết định cần phê duyệt

Các quyết định dưới đây đều là việc chỉ chủ dự án (Lê Đăng Quyết) mới quyết được — agent không tự chọn thay. Mỗi quyết định ghi rõ phân hệ liên quan và hệ quả đã biết.

| # | Quyết định | Phân hệ | Phương án (chọn 1) | Hệ quả đã biết |
|---|---|---|---|---|
| Q1 | **Cơ chế phân công giảng viên – khóa học** (giảng viên nào phụ trách khóa nào, lưu ở đâu?) | M06 | (a) Thêm bảng phân công mới (quyết định schema — cần thêm bảng ngoài §3); (b) Thêm cột `instructor_id` vào `courses`; (c) Chưa cần phân công — giảng viên xem mọi khóa ở chế độ chỉ đọc cho tới khi có quyết định | Schema §3 hiện không có chỗ nào lưu “giảng viên X phụ trách khóa Y”. Không chốt thì M06 chưa thể triển khai đầy đủ (giảng viên không biết mình phụ trách khóa nào). |
| Q2 | **Thông báo in-app** (chuông/danh sách thông báo trong trang) — có làm không, lưu ở đâu? | M11 | (a) Chỉ dùng email (M10) — không làm in-app; (b) Làm in-app — thêm bảng `notifications` (quyết định schema ngoài §3); (c) Làm in-app nhưng không lưu database (chỉ tính toán từ `orders`/`events`/`enrollments` khi mở trang) | Schema §3 không có bảng thông báo. Chọn (b) thì phải sửa schema; chọn (a)/(c) thì không cần sửa schema nhưng thông báo in-app sẽ hạn chế (không có lịch sử đã đọc/chưa đọc nếu chọn (c)). |
| Q3 | **Bài tập tự luận / chấm tay** — có cần ngoài quiz trắc nghiệm không? | M05 | (a) Chỉ trắc nghiệm (đủ schema §3 hiện tại); (b) Thêm tự luận — cần thêm bảng/cột (quyết định schema ngoài §3: bài nộp, chấm điểm tay, phản hồi giảng viên) | Chọn (b) thì phải sửa schema và thêm luồng chấm của giảng viên (M06). Chọn (a) thì M05 triển khai được ngay với schema hiện tại. |
| Q4 | **Tìm kiếm “giảng viên”** trên trang công khai — bổ sung dữ liệu giảng viên hay sửa placeholder? | M01, M06 | (a) Bổ sung dữ liệu giảng viên (tên, giới thiệu, khóa phụ trách) để tìm được thật; (b) Sửa placeholder thành chỉ tìm khóa học (bỏ chữ “giảng viên”) | Hiện tìm tên giảng viên luôn ra 0 kết quả (audit B8). Chọn (a) thì gắn với Q1 (cần biết giảng viên phụ trách khóa nào). |
| Q5 | **Thời điểm triển khai webhook SePay** (chuyển khoản thủ công trước, SePay sau — hay SePay ngay từ đầu?) | M09 | (a) Chuyển khoản thủ công trước, SePay sau khi luồng thủ công chạy ổn; (b) SePay ngay từ đầu (cùng lúc với ra mắt nền tảng) | SePay đã chốt dùng (Quyết định 15) nhưng giá **cần xác minh lại** tại thời điểm triển khai. Chọn (b) thì phải xác minh giá + đăng ký SePay trước khi ra mắt; chọn (a) thì ra mắt nhanh hơn nhưng admin đối soát tay mỗi ngày trong thời gian đầu. |
| Q6 | **Giờ + hình thức từng sự kiện ngày 25/11/2026** | M01, M11 | User cung cấp sau (không tự bịa) | Ngày 25/11/2026 đã chốt cho cả 3 sự kiện (Quyết định 7). Chưa có giờ thì email nhắc sự kiện (M10-E11, M11) chưa gửi được và trang sự kiện chưa hiển thị giờ thật. |
| Q7 | **Nâng cấp trả phí — ngưỡng và thứ tự** (nâng Supabase / Workers / Resend, cái nào trước, khi chạm giới hạn nào?) | M02, M10, M12 | (a) Nâng khi chạm giới hạn (Quyết định 18 — đã chốt nguyên tắc, chưa chốt ngưỡng cụ thể từng dịch vụ); (b) Nâng trước một gói cụ thể ngay từ đầu | Nguyên tắc “nâng khi chạm giới hạn” đã chốt (Quyết định 18). Giá các gói **cần xác minh lại** trước khi nâng. Không chốt ngưỡng cụ thể thì đội ngũ sẽ báo cáo khi chạm giới hạn và xin phê duyệt từng lần. |
| Q8 | **Xác nhận các trạng thái “đã chấp nhận” còn treo trong đặc tả** (để khóa lại, không mở lại sau này) | M01 | (a) Khóa lại: tuyên ngôn 13,65px (QĐ 1), nhãn Tam giác ~3,98px (QĐ 2), nhánh fallback giữ nguyên (QĐ 3), PII trong mailto/clipboard giữ nguyên (QĐ 8) — cả 4 đã chốt ngày 10/11/2026; (b) Mở lại một trong 4 để quyết lại | Cả 4 đã chốt trong `DECISIONS.md` ngày 10/11/2026. File này chỉ ghi nhận lại; nếu user muốn đổi thì quyết lại rõ ràng ở đây, không âm thầm đổi trong lúc lập trình. |

---

*File đặc tả phân hệ — TASK 02 Visfar Academy. Ngày 10/11/2026. Trạng thái: Chờ phê duyệt kiến trúc. Chưa viết code, chưa tạo database, chưa deploy.*
