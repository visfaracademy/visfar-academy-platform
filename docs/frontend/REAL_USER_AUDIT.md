# Rà soát toàn bộ website như người dùng thật — REAL_USER_AUDIT

Ngày: 2026-11-11. Người rà soát: subagent (task sửa lỗi ảnh + rà soát toàn site + header + 3 trụ cột + thay ảnh doanh nghiệp).
Quy tắc: chỉ sửa lỗi hiển thị/kỹ thuật, không đổi chữ/nội dung đã chốt, không đổi thiết kế đã chốt, không bịa số liệu. Trang chủ giữ nguyên nội dung/thiết kế đã chốt.

## Cách kiểm chứng

- **Trình duyệt thật (headless Chromium, Playwright) trên server local** (`next start`, build mới từ `pages:build`): 2 cỡ 390px + 1440px × 26 route (82 lượt kiểm tra, có cuộn hết trang để kích hoạt ảnh lazy-load) + quét riêng 6 cỡ 390/768/1024/1280/1440/1920 × 13 route (78 lượt) để tìm chữ bị cắt / phần tử tràn phải, + kiểm tra header riêng 6 cỡ × 2 trạng thái (chưa đăng nhập + mô phỏng đã đăng nhập admin "Visfar Academy").
- **Live qua HTTP (curl/requests)**: toàn bộ route chính trả 200/307 đúng, 31 asset (26 ảnh + QR + 3 font) GET 200 với dung lượng thật; ảnh hero so md5 local = live.
- **Hạn chế kiểm chứng (ghi rõ, không giấu):**
  - Trình duyệt test trong VM **không ra được Internet** (mọi host ngoài đều `ERR_TUNNEL_CONNECTION_FAILED`, kể cả `example.com`, dù curl/requests/Node qua cùng proxy vẫn 200). Vì vậy: (a) audit trình duyệt chạy trên server local, không phải trực tiếp trên live; (b) **chưa đăng nhập được bằng trình duyệt** — mọi gọi Supabase từ trình duyệt test đều rớt (môi trường test, không phải lỗi site; người dùng thật truy cập bình thường). Các trang `/hoc-vien`, `/admin` đã kiểm tra ở trạng thái chưa đăng nhập (redirect 307 đúng về `/dang-nhap?next=...`); trạng thái đã đăng nhập của header được mô phỏng bằng DOM (chèn nút tài khoản admin "Visfar Academy" y hệt component thật) ở đủ 6 cỡ. **Cần parent chạy thêm 1 lượt trình duyệt đã đăng nhập bằng tài khoản admin thật trên live** (đăng nhập, dropdown 6 mục + "Quản trị", các trang con `/hoc-vien`, `/admin`).
  - Fetch Supabase từ trình duyệt test cũng rớt vì lý do trên, nên trang `/chuong-trinh` (đọc live từ Supabase) được kiểm chứng bằng REST trực tiếp + chạy `filterCourses` với đúng 10 dòng PROD thật.

## 1. Lỗi ảnh gốc trong ảnh user gửi — ĐÃ SỬA

| Mục | Nội dung |
|---|---|
| Trang / vị trí | Trang chủ, ảnh hero tập thể (thẻ pill bo tròn ngay dưới header) |
| Mô tả | Ảnh vỡ: hiện icon ảnh hỏng + alt text "Đông đảo thành viên và học viên Visfar Academy đứng trên sân khấu trong một sự kiện của học viện" |
| Mức độ | Nghiêm trọng (ảnh đầu tiên user nhìn thấy) |
| Nguyên nhân gốc | Toàn bộ 29 file asset trong `public/` đã bị ghi đè thành **0 byte lúc 2026-11-11 02:21:41 UTC**; bản deploy build từ trạng thái đó nên trình duyệt nhận file rỗng → ảnh vỡ. Không phải sai đường dẫn, không phải sai tên file, không phải lỗi base64, không phải config Next Image. |
| Đã sửa | Khôi phục 29/29 file từ base64 trong file HTML gốc, đối chiếu md5 (hero `cd879f90fa0c…`, biz-group `0afa8d078a2a…` = ảnh DSC03023 gốc, QR `70158485…`). Không còn file 0 byte trong `public/` và trong output build. |
| Kiểm chứng | Live: `GET /images/hero-group.jpg` 200 / 257.159 byte, md5 live = md5 local `cd879f90fa0c…`; cả qua URL tối ưu `/_next/image?url=%2Fimages%2Fhero-group.jpg&w=3840&q=75` cũng 200, đúng md5. Trên trình duyệt local, ảnh hero `naturalWidth = 1334`, `ok = true` ở cả 390px và 1440px. |
| Trạng thái | ✅ Đã sửa + đã kiểm chứng |

## 2. Rà soát toàn site (đợt 1: 26 route × 2 cỡ, có cuộn trang)

82/82 lượt kiểm tra sạch sau khi build mới: **0 ảnh vỡ, 0 tràn ngang, 0 lỗi console (trừ lỗi mạng test — xem dưới), 0 request 404**.

- Ảnh: 27 ảnh trang chủ (logo, hero, founder, VISFAR HOME, 10 poster, biz-group, 8 testimonial, 3 sự kiện, logo footer) đều tải sau khi cuộn. Lưu ý: lần đo đầu báo 24 ảnh "vỡ" là **sai số đo** — đó là ảnh `loading="lazy"` dưới màn hình đầu, chưa được trình duyệt tải (currentSrc rỗng), không phải ảnh hỏng; đo lại sau khi cuộn thì 0 vỡ.
- Lỗi duy nhất trong log trình duyệt test: `ERR_TUNNEL_CONNECTION_FAILED` tới `ugynqjqyfynkmqutoarp.supabase.co/rest/v1/courses` (header AccountNav + trang `/chuong-trinh` gọi Supabase) — **lỗi môi trường test** (trình duyệt test không ra Internet, xem mục "Hạn chế kiểm chứng"); người dùng thật không gặp. Trang chủ không phụ thuộc gọi này (dữ liệu khóa học tĩnh).
- Route: `/` `/chuong-trinh` + đủ 10 `/chuong-trinh/[slug]` `/dang-nhap` `/dang-ky` `/quen-mat-khau` `/dat-lai-mat-khau` `/tu-van` `/goi-thanh-vien` `/chung-chi/tra-cuu` 4 `/chinh-sach/*` `/hoc-vien` `/admin` `/thanh-toan/DH-2026-000004` + 8 trang con `/hoc-vien/*` và `/admin/*` — đều 200 (hoặc 307 đúng về đăng nhập khi chưa đăng nhập).
- Kiểm tra tĩnh bổ sung: 18 tham chiếu ảnh tĩnh trong code đều trỏ tới file có thật trong `public/`; 29 link nội bộ đều trỏ tới route có thật; hotline `034 7897 868` đúng mọi chỗ, không còn số cũ `0347875229`; ngày sự kiện 25/11/2026 · 18:30 đúng cả 3; 4 slug chính sách tồn tại.
- Lỗi đo lần đầu (đã loại, không phải lỗi site): lần audit đầu chạy trên server local mà thư mục `.next` bị agent khác xóa giữa chừng (build song song) → CSS/JS trả 400, trang báo "Application error". Đã chạy lại sau khi build solo mới: sạch.

## 3. LỖI 1 — Nút "Nhận lộ trình phù hợp" che mất chữ "KẾT NỐI" — ĐÃ SỬA

| Mục | Nội dung |
|---|---|
| Trang / vị trí | Header mọi trang, cỡ desktop (đặc biệt 1024px và cả 1280/1440/1920px khi đã đăng nhập) |
| Mô tả | Nút CTA vàng đè lên link menu "KẾT NỐI" (chỉ còn thấy "KẾT N…"); ở 1024px khi đã đăng nhập còn đè cả "CÁC KHÓA HỌC", "SỰ KIỆN", "BLOG", cụm tài khoản đè "KẾT NỐI" |
| Mức độ | Nghiêm trọng (menu chính không bấm được) |
| Nguyên nhân gốc | `.main-nav` có `flex-shrink: 1` + `min-width: 0` nên bị nén nhỏ hơn tổng bề rộng 6 link `nowrap` → link cuối tràn khỏi hộp nav và chui dưới nút CTA (CTA đứng sau trong DOM nên vẽ đè lên). `header-main` không tràn ngang nên lỗi không lộ qua `scrollWidth` — chỉ thấy bằng mắt/render thật. Khung nội dung giới hạn 1380px nên tổng bề rộng (logo 44 + menu ~589 + CTA ~213 + tìm kiếm 200 + giỏ 44 + tài khoản tên dài ~200 + gap) vượt khung ngay cả ở 1920px. |
| Đã sửa | Chỉ CSS (`apps/web/src/styles/globals.css`, giữ nguyên chữ/thứ tự/thiết kế): (1) từ 901px trở lên thu hẹp cỡ chữ menu (0.85rem), padding, ô tìm kiếm (140px), tên tài khoản (tối đa 110px, ellipsis), CTA (0.95rem) để 1 dòng vừa khung 1380px; (2) **901–1300px chuyển header sang 2 dòng** — hàng 1: logo + CTA + tìm kiếm + giỏ + tài khoản; hàng 2: menu 6 mục full-width; (3) chỉ khóa 1 dòng từ 1301px trở lên (trước đây khóa từ 901px nên 1024px không thể vừa). Không ẩn tính năng nào, không đổi chữ, tên tài khoản "Visfar Academy" giữ nguyên (chỉ ellipsis khi dài). |
| Kiểm chứng | Render thật 6 cỡ × 2 trạng thái (chưa đăng nhập + mô phỏng admin) = 12/12 sạch, 0 chồng lấn, 0 tràn. Đã xem ảnh chụp: 1024px admin 2 dòng, đủ 6 link gồm "KẾT NỐI". |
| Trạng thái | ✅ Đã sửa + đã kiểm chứng |

## 4. LỖI 2 — Quét lỗi che/cắt/tràn tương tự toàn site — KHÔNG TÌM THÊM LỖI THẬT

- Quét 13 route × 6 cỡ (390/768/1024/1280/1440/1920): 72/78 lượt sạch hoàn toàn; 6 lượt còn lại chỉ dính **1 dương tính giả**: `LABEL.sr-only` "Tìm khóa học, giảng viên" trên trang chủ — label chỉ dành cho trình đọc màn hình, cố ý rộng 1px với overflow ẩn (kỹ thuật sr-only chuẩn), không phải chữ bị cắt.
- Không còn chỗ nào menu/tiêu đề/nút/thẻ khóa học/footer/form bị che, cắt hay tràn ở bất kỳ cỡ nào.
- Ghi chú (không phải lỗi): nút nổi "Zalo hỗ trợ" + "Nhận lộ trình phù hợp" là fixed-position nên khi cuộn sẽ phủ lên nội dung bên dưới — đó là hành vi thiết kế đã chốt của nút nổi, không sửa.

## 5. Thay ảnh nhóm 5 người (vest đỏ, backdrop sinh nhật) bằng ảnh giảng trước lớp — ĐÃ SỬA

| Mục | Nội dung |
|---|---|
| Ảnh cũ | `workspace/user/media_library/image/image-293.png` — đã xác nhận bằng mắt là đúng ảnh đang dùng ở mục **Giải pháp doanh nghiệp** (`#doanh-nghiep`, file `public/images/biz-group.jpg`, md5 cũ `0afa8d078a2a…`): 5 người, anh mặc vest đỏ đứng giữa, backdrop "Sinh nhật lần thứ 10…". **Không phải ảnh hero** (hero là ảnh tập thể lớn trên sân khấu, giữ nguyên). |
| Ảnh mới | `workspace/user/media_library/image/4d5afd89-3da3-40b3-ac50-a8d0abe7e3bf.png` (1439×1093): anh mặc vest xanh đứng giảng trước bảng trắng, lớp học viên ngồi dưới. |
| Đã sửa | Chuyển ảnh mới sang JPEG chất lượng 90, ghi đè đúng file đích `public/images/biz-group.jpg` (md5 mới `924e44699553340a22f158cc221df971`, 1439×1093, 206.178 byte; bản cũ lưu dự phòng tại `/tmp/biz-group-old.jpg`, md5 cũ `0afa8d078a2a…`). Cập nhật `width/height` của `<Image>` thành 1439/1093 và alt thành "Lê Đăng Quyết mặc vest xanh đang đứng giảng trước lớp học viên trong một buổi đào tạo của Visfar Academy". CSS `.biz-figure img` là `width: 100%; height: auto` (không khóa tỉ lệ, không `object-fit: cover`) nên ảnh mới hiển thị đầy đủ, không cắt, không méo, không tràn ở mọi cỡ. |
| Kiểm chứng | Trình duyệt local: ảnh `naturalWidth = 1439`, `naturalHeight = 1093`, `ok = true` ở cả 1440px và 390px; đã xem ảnh chụp 390px: ảnh hiển thị đầy đủ. (Kiểm chứng live sau deploy: xem mục 8.) |
| Lưu ý | Cùng ảnh giảng này đã có sẵn ở thẻ sự kiện Workshop (`event-workshop.jpg`, cùng md5 gốc `6d97ae5e…`) — sau lần thay này ảnh xuất hiện 2 lần trên trang chủ (mục doanh nghiệp + thẻ Workshop), đúng theo yêu cầu user. Ảnh cũ không còn xuất hiện ở chỗ nào khác trên trang (chỉ dùng duy nhất tại `HomeSections.tsx:401`). |
| Trạng thái | ✅ Đã sửa + đã kiểm chứng local; chờ kiểm chứng live sau deploy |

## 6. Khóa học theo 3 trụ cột Thân – Tâm – Tuệ — ĐÃ RÀ SOÁT + ĐÃ SỬA

### 6.1. Kết quả rà soát (trước khi sửa)

Hệ phân loại cũ trên site là **Tâm thức – Trí tuệ – Nhân hiệu** (+ Cộng đồng), khác với 3 trụ cột **Thân – Tâm – Tuệ** user chốt. Các lệch cụ thể:

| # | Khóa học | Nhãn cũ (poster/kicker) | Phân loại cũ | Vấn đề |
|---|---|---|---|---|
| 01 | Thấu Hiểu Nội Tâm | "Khởi đầu miễn phí" (không ghi trụ cột) | Tâm thức | Phân loại cũ, không ghi trụ cột → Tâm |
| 02 | Thấu Hiểu Tâm Thức | "Trụ cột 1 \| TÂM THỨC" | Tâm thức | Ghi trụ cột khác → Tâm (trụ cột 2) |
| 03 | Thấu Hiểu Trí Tuệ | "Trụ cột 2 \| TRÍ TUỆ" | Trí tuệ | Ghi trụ cột khác → Tuệ (trụ cột 3) |
| 04 | Thấu Hiểu Sức Khỏe | "Trụ cột 1 \| TÂM THỨC" | Tâm thức | **Sai**: sức khỏe là Thân, không phải Tâm |
| 05 | Thấu Hiểu Mối Quan Hệ | "Trụ cột 1 \| TÂM THỨC" | Tâm thức | Ghi trụ cột khác → Tâm (trụ cột 2) |
| 06 | Thấu Hiểu Tài Chính | "Trụ cột 1 \| TÂM THỨC" | Tâm thức | **Sai**: tài chính/vật chất là Thân, không phải Tâm |
| 07 | Chuyên gia tư vấn và huấn luyện tâm thức | (không ghi số trụ cột) | Tâm thức + Trí tuệ + Nhân hiệu | Mô tả ghi "ba trụ cột Tâm thức – Trí tuệ – Nhân hiệu" → Thân – Tâm – Tuệ |
| 08 | Master Tâm thức & Nhân hiệu | (không ghi số trụ cột) | Tâm thức + Trí tuệ + Nhân hiệu | Nội dung ghi "tư duy Tâm – Trí" → Tâm – Tuệ |
| 09 | Coaching 90 ngày đồng hành | (không ghi số trụ cột) | Tâm thức + Trí tuệ + Nhân hiệu | Phân loại cũ → tích hợp cả 3 |
| 10 | Cộng đồng Visfar | (không ghi trụ cột) | Cộng đồng | Đúng, giữ nguyên (Cộng đồng không phải trụ cột) |

**Tên khóa 01–10 giữ nguyên toàn bộ** (không tên nào mâu thuẫn trực tiếp với 3 trụ cột). Thứ tự trụ cột dùng trong nhãn: Thân = trụ cột 1, Tâm = trụ cột 2, Tuệ = trụ cột 3 (theo thứ tự "Thân–Tâm–Tuệ" trên đồ hình VISFAR HOME).

### 6.2. Đã sửa (code)

- `apps/web/src/lib/homepage-data.ts`: `cats` mới (01 Tâm; 02 Tâm; 03 Tuệ; 04 Thân; 05 Tâm; 06 Thân; 07/08/09 cả 3; 10 Cộng đồng); `COURSE_TABS` mới: Tất cả / Thân / Tâm / Tuệ / Cộng đồng; kicker + posterSub mới (02 "Trụ cột 2 | TÂM", 03 "Trụ cột 3 | TUỆ", 04 "Trụ cột 1 | THÂN", 05 "Trụ cột 2 | TÂM", 06 "Trụ cột 1 | THÂN"); mô tả 07 thành "Chương trình tích hợp ba trụ cột Thân – Tâm – Tuệ…"; nội dung 07 thành 3 dòng Thân/Tâm/Tuệ (dòng Thân là diễn đạt lại từ chất liệu Sức khỏe/Tài chính có sẵn trên site, ghi rõ để user duyệt văn bản sau); nội dung 08 "tư duy Tâm – Trí" → "tư duy Tâm – Tuệ".
- `packages/shared/src/constants.ts`: `PILLARS` mới (Thân/Tâm/Tuệ/Tích hợp/Cộng đồng), `PILLAR_LABELS` mới, thêm `normalizePillar()` tương thích tạm thời với dữ liệu cũ (xem 6.3).
- `apps/web/src/lib/courses.ts`: `filterCourses()` — khóa "Tích hợp" hiện dưới cả 3 tab trụ cột (giống hành vi multi-cat ở trang chủ).
- `apps/web/src/app/chuong-trinh/page.tsx`: tab lọc lấy từ `PILLARS` trừ "Tích hợp" (không hiện tab riêng cho tích hợp).
- `apps/web/src/components/course/CourseCard.tsx`: pill hiển thị nhãn mới (qua `normalizePillar()`).
- `apps/web/src/components/admin/CourseEditForm.tsx`: dropdown "Trụ cột" đổi sang Thân/Tâm/Tuệ/Tích hợp (cả 3 trụ cột)/Cộng đồng.
- Test cập nhật: `homepage-data.test.ts` (đếm tab mới, mapping cats từng khóa), `courses.test.ts` (lọc theo trụ cột mới, khóa tích hợp, dữ liệu cũ).

### 6.3. Đã sửa (dữ liệu) — và 1 bước còn chặn

- Viết migration **`supabase/migrations/0024_pillars_than_tam_tue.sql`** (đã kiểm tra cú pháp pglast: PARSE OK, 21 câu): đổi CHECK `courses.pillar` sang `('than','tam','tue','tich-hop','cong-dong')`; đổi giá trị pillar của 10 khóa theo bảng 6.1 (07/08/09 → `tich-hop`); **đồng bộ subtitle + description cả 10 khóa về đúng văn bản đã chốt ở trang chủ**; **xóa ghi chú nội bộ rò rỉ ra trang công khai** — description của 04/05/06 trong DB đang là "NOI DUNG TAM — lay tu phan Linh vuc ung dung… Cho user gui van ban cua minh de thay." và cờ `details.noi_dung_tam = true` khiến trang chi tiết hiện dòng "Nội dung tạm — chờ văn bản của người sáng lập để thay." (Văn bản 04/05/06 đã được user chấp nhận theo Quyết định 10 nên cờ `temp` ở trang chủ cũng đã bỏ.)
- **⛔ CHƯA ÁP ĐƯỢC 0024 — chờ token:** áp migration cần `SUPABASE_ACCESS_TOKEN` qua Management API, token này không có trong phiên làm việc (theo quy trình đã ghi: user cấp lại qua kênh bảo mật). **0024 chưa chạy trên staging lẫn prod.**
- **Tương thích tạm thời để live không vỡ trong lúc chờ:** `normalizePillar()` map giá trị cũ sang bộ mới (tam-thuc→Tâm, tri-tue→Tuệ, nhan-hieu→Tích hợp; riêng 04/06 → Thân và 07 → Tích hợp map theo slug vì giá trị cũ không phân biệt được). Đã kiểm chứng với đúng 10 dòng PROD thật: số đếm tab ra **Tất cả 10 / Thân 5 / Tâm 6 / Tuệ 4 / Cộng đồng 1**, khớp hoàn toàn với kết quả sau khi 0024 chạy. Sau khi 0024 đã áp staging + prod, xóa `normalizePillar()` + `LEGACY_PILLAR_BY_SLUG`.
- Kiểm chứng hiển thị (local): tab trang chủ hiện "Tất cả 10 Thân 5 Tâm 6 Tuệ 4 Cộng đồng 1"; poster-sub từng khóa đúng nhãn mới; không còn dòng "Nội dung tạm" trên trang chủ.

### 6.4. Đã chốt ngày 11/11/2026 (QĐ 27 + QĐ 29) — các mục dưới đây ĐÃ ĐÓNG, không còn mở

1. **Khóa 06 Tài chính → Thân — ĐÃ CHỐT (QĐ 27, 11/11/2026).** Trước đây là lựa chọn của agent; nay user đã phê duyệt chính thức. Migration 0024 + `cats` của 06 đã áp staging + prod.
2. **Tên khóa 02/08 theo hệ Thân–Tâm–Tuệ — ĐÃ CHỐT (QĐ 29, 11/11/2026).** Khóa 02 "Thấu Hiểu Tâm Thức" → **"Thấu Hiểu Tâm"**; khóa 08 "Master Tâm thức" → **"Master Thân – Tâm – Tuệ"** (tên khóa 08 suy ra từ phân loại "Tích hợp", không phải tên user viết sẵn — user sửa lại bằng 1 câu nếu muốn tên khác). Slug cả hai khóa giữ nguyên. Migration 0032 đã áp staging + prod, xác minh đúng title mới.
3. **Câu "ba trụ cột Tâm thức, Trí tuệ và Nhân hiệu" còn ở 2 chỗ ngoài phạm vi khóa học:** `apps/web/src/lib/policies.ts` (chính sách bảo mật + điều khoản tham gia — văn bản pháp lý). Không tự sửa văn bản chính sách; user chốt có đổi theo hệ mới không thì sửa riêng.
4. Dòng nội dung 07 về Thân ("Chăm sóc thân thể, sức khỏe và nền tảng vật chất — nền bền cho hành trình phát triển.") là văn bản agent viết lại từ chất liệu có sẵn; user gửi văn bản của mình để thay khi muốn.

## 7. Lỗi khác tìm được trong đợt rà soát

| # | Lỗi | Mức độ | Trạng thái |
|---|---|---|---|
| 1 | Ảnh hero vỡ (mục 1) | Nghiêm trọng | ✅ Đã sửa |
| 2 | Header che "KẾT NỐI" (mục 3) | Nghiêm trọng | ✅ Đã sửa |
| 3 | Mô tả 04/05/06 trong DB là ghi chú nội bộ "NOI DUNG TAM…" rò ra trang chi tiết công khai + dòng "Nội dung tạm" | Trung bình | ✅ Code + migration 0024 đã xong; ⛔ chờ token để áp DB (mục 6.3). Trang chủ đã hết dòng "Nội dung tạm". |
| 4 | Lần đo đầu báo 24 ảnh "vỡ" (lazy-load, sai số đo) | — | Không phải lỗi; đã đo lại đúng cách (mục 2) |
| 5 | Lần audit đầu hỏng do `.next` bị xóa giữa chừng vì build song song với agent khác | — | Không phải lỗi site; đã build solo lại |
| 6 | `LABEL.sr-only` bị quét nhầm là chữ cắt (mục 4) | — | Dương tính giả, không sửa |

## 8. Kiểm chứng cuối + deploy

- Test: `npm test` — **616/616 PASS** (32 file). Typecheck: **PASS**. `check:migrations` — **PASS** (đã thêm kiểm tra 0024).
- Build: `npm run pages:build` — **PASS**, 0 file 0-byte trong output.
- Deploy: `wrangler pages deploy` project `visfaracademy` — **thành công, EXIT 0**. Deploy mới: https://1f5bc5a7.visfaracademy.pages.dev (chính: https://visfaracademy.pages.dev).
- Kiểm chứng live sau deploy (qua HTTP, ngày 2026-11-11 ~03:20 +07):
  - Trang chủ 200 (162.570 byte); HTML chứa nhãn mới "Trụ cột 1 | THÂN", "Trụ cột 2 | TÂM", "Trụ cột 3 | TUỆ", "ba trụ cột Thân – Tâm – Tuệ"; không còn "Trụ cột 1 | TÂM THỨC" / "Tâm thức 8". (Số đếm tab "Thân 5 / Tâm 6 / Tuệ 4" render phía client nên không có trong HTML tĩnh — đã kiểm chứng bằng trình duyệt local trên cùng bản build: hiện đủ.)
  - Ảnh hero live 200 / 257.159 byte, md5 = `cd879f90fa0c…` (khớp local). Ảnh doanh nghiệp mới live 200 / 206.178 byte, md5 = `924e44699553…` (khớp file mới). Logo + QR đúng md5.
  - Route live: `/chuong-trinh`, `/chuong-trinh/thau-hieu-suc-khoe`, `/dang-nhap`, `/tu-van`, `/chinh-sach/bao-mat` 200; `/hoc-vien`, `/admin` 307 đúng về `/dang-nhap?next=...`.
  - **Chưa kiểm chứng bằng trình duyệt trực tiếp trên live** (trình duyệt test trong VM không ra Internet — xem "Hạn chế kiểm chứng" ở đầu file). Đã kiểm chứng bằng trình duyệt trên server local cùng bản build + HTTP live.

## 9. Việc còn mở (cần parent/user)

1. **⛔ Migration 0024 chưa áp** (staging + prod) — cần `SUPABASE_ACCESS_TOKEN`, user cấp lại qua kênh bảo mật. File migration đã viết xong + kiểm tra cú pháp + kiểm tra offline PASS. Trong lúc chờ, live vẫn hiển thị đúng nhờ lớp tương thích `normalizePillar()`; sau khi áp 0024 thì xóa lớp này.
2. **Lượt trình duyệt đã đăng nhập trên live** (admin thật): đăng nhập, dropdown tài khoản (6 mục + "Quản trị"), các trang con `/hoc-vien` và `/admin` — cần parent chạy bằng browser-task vì trình duyệt trong VM này không đăng nhập được (không ra Internet).
3. ~~User chốt: Tài chính → Thân (mục 6.4.1); tên khóa 02/08 có giữ từ "Tâm thức"/"Nhân hiệu" không (6.4.2); chính sách có đổi theo hệ Thân–Tâm–Tuệ không (6.4.3); văn bản dòng Thân của khóa 07 (6.4.4).~~ **ĐÃ CHỐT ngày 11/11/2026:** Tài chính → Thân (QĐ 27), tên khóa 02/08 (QĐ 29). Còn mở: chính sách có đổi theo hệ Thân–Tâm–Tuệ không (6.4.3); văn bản dòng Thân của khóa 07 (6.4.4).

## 10. Nâng cấp menu tài khoản học viên lên chuẩn top-tier (11/11/2026 ~03:35 +07)

Rà soát + nâng cấp cả 10 mục menu tài khoản (Tổng quan, Khóa học của tôi, Lịch sử học, Lịch hẹn của tôi, Đơn hàng, Ví & tiếp thị liên kết, Thông tin cá nhân, Đổi mật khẩu, Quản trị, Đăng xuất). Trang chủ không đổi.

### 10.1 Đã nâng cấp (dữ liệu thật, không mock)

| Mục | Nâng cấp |
|---|---|
| Tổng quan `/hoc-vien` | Thêm thẻ "Tiếp tục học" (khóa đang học đầu tiên + nút ResumeButton tới đúng bài đang dở); thêm mục "Lịch hẹn sắp tới" (3 lịch gần nhất, đếm ngược, nút "Vào phòng họp" khi đã xác nhận); thêm mục "Thông báo mới" (3 thông báo, chưa đọc lên trước); thêm stat "Bài đã hoàn thành" (tổng số bài đã học thật) |
| Khóa học của tôi `/hoc-vien/khoa-hoc` | Thêm ô tìm kiếm theo tên khóa + 3 tab lọc (Tất cả / Đang học / Đã hoàn thành, kèm số đếm thật); giữ nút "Học tiếp" từng khóa |
| Lịch sử học `/hoc-vien/lich-su-hoc` | Thêm mục "Điểm quiz" (đọc `quiz_attempts` thật: điểm, %, nhãn Đạt/Chưa đạt theo ngưỡng 70% QĐ Task 08, tên bài + tên khóa + ngày nộp; hàm mới `getMyQuizAttempts()`); thêm bộ lọc theo loại hoạt động |
| Lịch hẹn của tôi `/hoc-vien/lich-su` | Tách danh sách thành "Sắp tới" (xếp sớm nhất trước) và "Đã qua"; lịch gần nhất được highlight + đếm ngược ("Còn 2 ngày 3 giờ"); hàm mới `formatAppointmentCountdown()` / `splitAppointments()` |
| Đơn hàng `/hoc-vien/don-hang` | Thêm 3 stat tổng kết (tổng số đơn / đơn đã thanh toán / tổng đã thanh toán, tính từ đơn thật); mỗi đơn thêm link "Xem chi tiết đơn" → `/thanh-toan/{id}` và "Xem giao dịch" → `/hoc-vien/giao-dich` |
| Ví & tiếp thị liên kết `/hoc-vien/vi` | Thêm 2 stat "Tổng hoa hồng đã nhận" và "Tổng đã rút" (chỉ tính giao dịch completed; hàm mới `summarizeWallet()`); tỷ lệ hoa hồng đã chốt 10% (QĐ 26, 11/11/2026) — nay chỉ hiện "10%" |
| Thông tin cá nhân `/hoc-vien/ho-so` | Thêm dòng "Tham gia ngày" (từ `user.created_at` của Supabase Auth) |
| Đổi mật khẩu `/hoc-vien/doi-mat-khau` | Thêm checklist yêu cầu cập nhật trực tiếp khi gõ (≥8 ký tự / khác mật khẩu hiện tại / nhập lại khớp) |
| Quản trị `/admin` | Không cần sửa: đã có 8 chỉ số thật + các trang con; đã kiểm chứng route live 200 → chuyển về đăng nhập khi chưa đăng nhập |
| Đăng xuất | Đã có và hoạt động (signOut + đăng xuất mọi thiết bị); không đổi |

CSS mới (`post-auth.css`): `.resume-hero`, `.filter-tabs`, `.pill-pass` / `.pill-fail`, `.list-row.appt-next`, `.password-checklist` — dùng đúng token ivory/gold sẵn có, mobile 1 cột, nút ≥44px.

### 10.2 Kiểm chứng

- Test: `npm test` — **622/622 PASS** (32 file; +6 test mới cho `quizScorePercent`/`isQuizPassed`, `formatAppointmentCountdown`/`splitAppointments`, `summarizeWallet`). Typecheck: **PASS** (đã sửa 1 lỗi type trong test appointments).
- Build: `npm run pages:build` solo — **PASS** (19,35s). Deploy: `wrangler pages deploy` project `visfaracademy` — **EXIT 0**, deploy mới https://edfe1b0b.visfaracademy.pages.dev (chính: https://visfaracademy.pages.dev).
- Kiểm chứng live qua HTTP: `/` 200; `/chuong-trinh`, `/dang-nhap` 200; tất cả route `/hoc-vien/*` và `/admin` 200 → chuyển đúng về `/dang-nhap?next=...` khi chưa đăng nhập; `/hoc-vien/chung-chi`, `/hoc-vien/thong-bao`, `/hoc-vien/giao-dich` cũng chuyển đúng.
- Chuỗi mới đã có trong chunk JS live: `filter-tabs` (khoa-hoc), `pill-pass` (lich-su-hoc), `hoa hồng` (vi, 15.159 byte), `resume-hero`/`password-checklist` trong build.
- Trình duyệt local (localhost, build mới): `/` overflow 0 ở cả 390px và 1440px. Các 404 `/_next/image` và 404 route trong lần đo local là **giả** — do dùng `python http.server` thay cho Pages Functions (không có image optimizer, không có SPA fallback); live đã kiểm chứng 200 qua curl. Các `ERR_TUNNEL_CONNECTION_FAILED` tới Supabase là giới hạn mạng của VM, không phải lỗi site.
- **Chưa kiểm chứng bằng trình duyệt đã đăng nhập trên live** (trình duyệt trong VM không ra Internet — cùng hạn chế đã ghi ở đầu file): cần parent chạy browser-task với tài khoản học viên/admin thật để bấm hết 10 mục menu, đặt/hủy lịch, rút tiền, đổi mật khẩu, xem điểm quiz.

### 10.3 Việc còn mở

1. **Migration 0023 (lịch hẹn + ví) và 0024 (trụ cột) mới áp staging, chưa áp prod** — trên prod, trang Lịch hẹn/Ví hiện trạng thái lỗi rõ cho tới khi migration áp prod; KHÔNG tự áp prod (chờ user nghiệm thu staging). (Mục 9.1 trong file này nói 0024 chưa áp là thông tin cũ trước khi parent áp staging — parent cập nhật giúp.)
2. Email nhắc lịch chưa có (ghi rõ trong UI trang Lịch hẹn).
3. Chưa có endpoint admin duyệt/từ chối yêu cầu rút tiền — admin xử lý trực tiếp trên Supabase (đã ghi trong docs/payment/referrals-wallet.md).
4. Tỷ lệ hoa hồng 10% vẫn là mặc định, chờ user chốt.

## 11. Đợt 11/11/2026 ~11:30–12:05 +07 — Worker sang PROD (QĐ 20) + hover/gradient + logo + căn đều + Thư viện Master + Blog riêng + đổi tên khóa 08

### 11.0 Tóm tắt đợt

Một lần build + deploy duy nhất, gồm: (a) Worker `api` chuyển sang PROD + migration 0022/0023/0024 lên PROD + biến môi trường Pages (QĐ 20 — xem `docs/DECISIONS.md`); (b) trang chi tiết khóa học hiển thị A–Z không cần đăng ký, bài trả phí khóa/mở tự động (QĐ 20); (c) hover lift + tiêu đề gradient vàng kim toàn trang; (d) cân logo header/footer; (e) căn đều 4 đoạn hero rộng bằng ảnh; (f) trang Thư viện Master mới + admin đăng bài; (g) trang Blog riêng `/blog` + chi tiết từng bài; (h) đổi tên khóa 08 thành MASTER TÂM THỨC (giữ slug). Deploy Pages mới: https://d7528991.visfaracademy.pages.dev (chính: https://visfaracademy.pages.dev). CSS live mới: `2436ec61889cf9ad.css`.

### 11.1 Hover toàn trang + tiêu đề gradient (mục c)

- Hover: bổ sung `:hover` lift translateY(−3px) + viền vàng + bóng gold 220ms cho `.prog-card`, `.biz article`, `.lamp`, `.prog-help`, `.equation`, `#lo-trinh .step` (bước lộ trình lift nhẹ −2px + nền champagne vì là ô trong lưới chung); bổ sung `transition` còn thiếu cho `.mv-card`, `.biz article`, `.lamp`, `.prog-help`, `.equation`, `#lo-trinh .step`; mở rộng danh sách reset `@media (hover: none)` và `prefers-reduced-motion` cho toàn bộ selector mới. Đã có sẵn, không đổi: `.card`, `.field-card`, `.voice-card`, `.blog-grid article`, `.event-card`, `.update-card`, `.stat-card`/`.list-row`, `.admin-nav a`, `.btn`. Cố ý bỏ qua `.auth-card` (form không nên nhảy khi hover).
- Gradient vàng kim `linear-gradient(135deg, #6e4f0a 0%, #a67c00 38%, #c9a227 62%, #d4af37 80%, #e8c766 90%, #8c6d1f 100%)` áp cho **57 h2 + 1** qua class `.gold-title`: trang chi tiết khóa học, `/chinh-sach/[slug]`, `/goi-thanh-vien`, `/thanh-toan/[orderId]`, toàn bộ `/hoc-vien/*`, trang bài học/bài tập, toàn bộ `/admin/*`, tiêu đề Founder trang chủ. Không đổi: manifesto h2 (con đã gradient), `QuizPlayer`/`LessonPlayer`/`CheckoutButton` (nội bộ player/modal).
- **Kết luận kiểm chứng hover (quan trọng): hover KHÔNG đo được bằng headless Chromium trong VM — đó là giới hạn của môi trường kiểm thử, không phải lỗi code.** Bằng chứng: CDP cho thấy `matchMedia('(hover: hover)') = false`, `(hover: none) = true`, `(pointer: fine) = false` trong headless_shell (không có thiết bị trỏ); phần tử vẫn `matches(':hover') = true` sau khi di chuột nhưng `transform: none` vì quy tắc lift nằm trong `@media (hover: hover)` (tắt) và quy tắc reset `@media (hover: none)` (bật). Trên trình duyệt desktop thật có chuột, `(hover: hover)` = true nên lift sẽ áp dụng; trên cảm ứng, reset tắt hover kẹt đúng thiết kế. **Cần parent kiểm chứng hover bằng trình duyệt thật (browser-task, desktop có chuột) trước khi khẳng định với user.**
- Render local (build mới): homepage 0 tràn ngang ở 390/768/1024/1280/1440/1920; 33 `.gold-title`; tiêu đề vàng kim đọc rõ trên nền ivory ở 1440px và 390px (đã xem ảnh chụp bằng mắt). Trang chi tiết khóa học không render được local (route động + fetch Supabase; trình duyệt VM không ra Internet) — đã kiểm chứng bằng bundle live (xem 11.7).

### 11.2 Logo (mục d)

- Vị trí user phản ánh là logo chân trang cột 1 (chỉ có 2 vị trí logo trên toàn trang: header + footer cột 1; không có logo ở trang đăng nhập hay nơi khác). Đo file `public/images/logo.png` (2411×2411 RGBA): vùng nội dung thật chỉ chiếm 73% chiều rộng × 55,4% chiều cao khung (bbox alpha 325–2085 × 537–1873) — tức logo hiển thị 96px thì nét vẽ thật chỉ ~70×53px trong cột footer rộng ~318px, nên trông bé tí.
- Sửa: `.foot-brand img` 96px → **168px** (nét vẽ thật ~123×93px); mobile ≤560px (footer 1 cột) căn giữa khối `.foot-brand`. `.brand img` (header) 44px → **56px** (vừa khung header min-height 68px). Không đổi file ảnh, không méo/vỡ. Kiểm chứng local: header 56×56, footer 168×168 (đo bằng CDP ở 1440px); mobile 390px footer căn giữa, 168px, không tràn. Live: CSS `foot-brand img{width:168px;height:168px}` đã có trong bundle `2436ec61889cf9ad.css`.

### 11.3 Căn đều 4 đoạn hero (mục e) — nguyên nhân thật + cách sửa

- **Điều tra bằng code live thật (không kết luận cache khi chưa có bằng chứng):** tải HTML + CSS đang live (`993cfedf1d7f05df.css`, deploy 11:30): cả 4 đoạn đều đã có `text-align: justify` (`.hero-manifesto>p.lead` và `>p:not(.lead)` + quy tắc `p` toàn cục), `lang="vi"`, không có service worker/PWA, không có quy tắc nào đè justify. Render lại đúng HTML+CSS live này bằng Chromium local ở 390px và 1440px rồi **xem ảnh bằng mắt: lề phải của cả 4 đoạn đều thẳng** (đã xem 2 ảnh crop). Header HTTP của tài liệu live: `Cache-Control: public, max-age=0, must-revalidate` (trình duyệt phải kiểm tra lại khi tải mới); CSS `immutable, max-age=31536000` (đúng cho file băm theo nội dung). **Kết luận: code live đã căn đều đúng; ảnh chụp 11:40 của user nhiều khả năng là tab mở từ trước đợt sửa 10:33 và chưa tải lại (chuyển tab không tải lại trang — không header nào sửa được tab đã mở sẵn).**
- **Sửa tận gốc phần còn lệch thật trên desktop:** trước đây 4 đoạn bị giới hạn `max-width: 760px` (lead) / `860px` (3 đoạn còn lại) trong khi ảnh hero rộng bằng khung `.wrap` — nên mép phải của chữ thụt vào ~230–260px so với mép ảnh. Đã đổi cả 3 quy tắc (`.hero .lead`, `.hero-manifesto > p.lead`, `.hero-manifesto > p:not(.lead)`) sang `max-width: 100%` — chữ nay rộng đúng bằng ảnh, giữ nguyên justify + `text-align-last: left` + hyphens. Kiểm chứng local (build mới): cả 4 đoạn đều 55–1371, **trùng khít mép ảnh 55–1371** ở 1440px, `text-align: justify`; ở 390px đoạn rộng 354px = ảnh 354px, justify. Mobile không đổi (đã full-width từ trước).
- **Còn mở:** cần parent chạy browser-task trên live (trình duyệt thật) chụp hero ở 1440px + 390px để xác nhận lề phải thẳng; user cần **đóng hẳn tab cũ rồi mở lại link** (hoặc Ctrl+F5 / Cmd+Shift+R) — tab mở từ trước đợt sửa sẽ vẫn hiện bản cũ cho tới khi tải lại.

### 11.4 Thư viện Master (mục f)

- Route mới `/thu-vien-master`, menu chính thành **7 mục** (THƯ VIỆN MASTER sau KẾT NỐI). Banner gradient + tiêu đề lớn giữa; bên dưới 2 cột: bài đang chọn (tiêu đề gradient, ảnh bìa, video YouTube nhúng qua youtube-nocookie, nội dung chia đoạn — đoạn mở đầu bằng “Tên khái niệm:” được in đậm tên) + cột phải danh sách 11 mục (nút Thu gọn/Mở rộng, mục đang chọn nền vàng kim nổi bật, deep-link `?bai=<slug>`).
- Nội dung ban đầu: bài “7 Bố Thí Quan Trọng Đời Người” (viết lại ngắn gọn từ tài liệu Master K03 của user, chủ đề 43–50; 4 khái niệm có lời giải trong tài liệu: Nhãn thí, Ngôn thí, Phòng thí, Thân thí; 3 khái niệm chưa có lời giải chi tiết trong tài liệu — Nhan thí, Tâm thí, Tọa thí — ghi “Đang cập nhật”, không bịa) + 10 mục lấy từ ảnh mẫu (TÂM THÁI, TÁNH KHÔNG, THÀNH CÔNG, THẦN TÀI, THẦY (CÔ), THIÊN TRI THỨC, THỜI GIAN, THÔNG TIN TRONG CON NGƯỜI, THỤ ĐẮC, TÍN) đều “Đang cập nhật”. Banner hiện là panel gradient (không có ảnh sách thật trong thư viện ảnh — user có thể gửi ảnh kệ sách sau để thay).
- Dữ liệu: bảng `master_library_items` (migration **0025**, xem 11.8); trang công khai đọc bài `is_published=true` từ Supabase, fallback dữ liệu mặc định (khớp seed) khi DB chưa có bảng (prod hiện tại) hoặc trả về rỗng. Admin `/admin/thu-vien` + API `/api/admin/library` (GET/POST) và `/api/admin/library/[id]` (GET/PATCH/DELETE): tạo/sửa (tiêu đề, slug tự sinh bằng `slugifyVi`, chuyên mục, nội dung dài, link ảnh bìa, link YouTube chuẩn hóa bằng `normalizeYouTubeUrl`, xuất bản/nháp, thứ tự), xóa 2 bước, ghi audit `library.create/update/delete`; link “Thư viện” đã thêm vào nav admin. Ảnh bìa hiện chỉ dán link (https://…), chưa hỗ trợ tải file trực tiếp — ghi rõ trong UI trang admin.
- Kiểm chứng local (render build mới + chặn REST thư viện trả 404 để mô phỏng prod chưa có bảng): sidebar 11 mục, bài mặc định hiển thị đủ 12 đoạn, `?bai=tam-thai` → “Tâm Thái / Đang cập nhật.”; 1440px 2 cột (972px + 320px), 390px 1 cột (sidebar lên trên, `order: -1`), 0 tràn ngang ở cả 2 cỡ. (Lưu ý kỹ thuật: script chèn trước tải trang qua CDP chỉ có hiệu lực khi đã `Page.enable` — lần chạy đầu thiếu bước này nên trang kẹt ở “Đang tải…”, đã sửa và kiểm chứng lại đạt.)

### 11.5 Blog riêng (mục g)

- Trang `/blog`: danh sách 3 bài đã chốt (giữ nguyên văn bản), mỗi bài link tới trang chi tiết. Trang `/blog/[slug]`: hiển thị đúng đoạn văn đã chốt của bài, **không bịa thêm nội dung dài** (3 bài hiện chỉ có đoạn ngắn — ghi rõ ở đây, không ghi thêm vào trang). Menu BLOG đổi đích từ neo `#blog` sang `/blog`; phần Blog trên trang chủ giữ nguyên + thêm link “Xem tất cả bài viết →” và link từng tiêu đề bài tới trang chi tiết. Admin đăng/sửa bài blog: **chưa có** — blog hiện là dữ liệu tĩnh trong `homepage-data.ts`, không có bảng blog trong DB (chỉ có nhắc tới trong migration 0006 về quyền instructor quản lý blog/sự kiện); cần thêm sau, không làm menu giả. Kiểm chứng: `/blog` local 3 bài, h1 “Blog Visfar Academy”; live `/blog` 200, `/blog/ro-hinh-la-ra-qua` 200 và có nội dung bài.

### 11.6 Đổi tên khóa 08 (mục h)

- Tên mới: **MASTER TÂM THỨC** (giữ nguyên slug `master-tam-thuc-nhan-hieu`, không vỡ link cũ). Đổi ở: `homepage-data.ts` — `posterTitle` + `title` khóa 08 (poster overlay trang chủ) và label link footer “Khóa học” (`/chuong-trinh/master-tam-thuc-nhan-hieu`). Form tư vấn lấy option từ DB nên theo title DB; nút tư vấn dùng dữ liệu khóa từ `HOME_COURSES` (title đã đổi).
- DB: **prod đã có sẵn title mới “Master Tâm thức” từ trước** (kiểm chứng bằng REST prod ngày 11/11/2026) — không cần đổi prod. **Staging** còn title cũ nên đã đổi bằng migration **0026** (chỉ `UPDATE title`, giữ slug), áp staging HTTP 201, xác minh title staging = “Master Tâm thức”. Subtitle + `details` không chứa tên cũ.
- Grep toàn repo sau sửa: “MASTER TÂM THỨC & NHÂN HIỆU” còn 0 trong `apps/web/src` (2 chỗ đã đổi). Còn lại trong docs/migration cũ là ghi chú lịch sử (WEBSITE_AUDIT.md, DATA_DICTIONARY.md, HOMEPAGE_COMPARE.md, REAL_USER_AUDIT mục cũ, seed 0002) — giữ nguyên làm lịch sử, không sửa. Chữ “NHÂN HIỆU” ở các khóa khác không đổi.
- Kiểm chứng: poster overlay khóa 08 trên trang chủ (render local) hiện “MASTER TÂM THỨC”, căn giữa; link footer “Master Tâm thức”; REST prod title “Master Tâm thức”.

### 11.7 Kiểm chứng chung đợt

- Test: web **643/643 PASS** (34 file; +12 test mới: thư viện 9, blog 3 — trước đợt 631). Typecheck **PASS**. Workers **328/328 PASS** (không đổi code Worker đợt này). `pages:build` **PASS** (22,38s; 2 lỗi build gặp trong đợt đã sửa: (1) comment `eslint-disable @next/next/no-img-element` trỏ tới rule không tồn tại vì plugin ESLint của Next.js không được phát hiện — đã bỏ comment; (2) 2 route mới thiếu `export const runtime = 'edge'` — đã thêm cho `/admin/thu-vien` và `/blog/[slug]`).
- Header 7 mục: 1440px 1 dòng, 7 link không chồng (mục cuối kết thúc x=981, trước ô tìm kiếm); 1280px 1 dòng, không tràn, không chồng; 1024px 2 dòng đúng quy tắc cũ (dòng 1 logo+search+tài khoản y 80–136, dòng 2 menu y 140–184 — đo trước đây “chồng” là dương tính giả do chỉ so trục x khác dòng); 768px menu mobile ẩn đúng; 390px 0 tràn ngang.
- Live sau deploy (https://d7528991.visfaracademy.pages.dev; chính https://visfaracademy.pages.dev): `/` 200 (CSS mới `2436ec61889cf9ad.css`); `/thu-vien-master` 200 (chunk live chứa slug `7-bo-thi-quan-trong-doi-nguoi`; chuỗi tiếng Việt trong bundle bị minifier escape nên grep literal không thấy — kiểm tra bằng slug ASCII); `/blog` 200; `/blog/ro-hinh-la-ra-qua` 200; `/admin/thu-vien` 307 → đăng nhập khi chưa đăng nhập (guard đúng); Worker health 200 `ok:true`. CSS live chứa: `foot-brand img{width:168px;height:168px}`, `hero-manifesto>p.lead{max-width:100%;…text-align:justify…}`, kiểu `.library-list`.
- **Chưa kiểm chứng bằng trình duyệt thật trên live** (VM không ra Internet): (1) hover lift trên desktop có chuột; (2) hero căn đều + logo 168px trên máy user sau khi tải lại cứng; (3) bấm hết luồng Thư viện (chọn bài, thu gọn/mở rộng, `?bai=`), Blog (danh sách → chi tiết → quay lại), admin `/admin/thu-vien` đăng nhập thật (tạo/sửa/xóa bài + xem bài mới hiện trên `/thu-vien-master`); (4) trang chi tiết khóa học `/chuong-trinh/[slug]` sau deploy (khóa/mở đúng).

### 11.8 Migration 0025 + 0026 (staging — CHƯA áp prod)

- **0025_master_library.sql** — bảng `master_library_items` (id, title, slug UNIQUE, category, content, cover_image_url, video_url, is_published, display_order, created_at, updated_at) + trigger `trg_master_library_updated_at` (dùng hàm `set_updated_at()` có sẵn từ 0001) + RLS bật + 2 policy (`master_library_select_public` SELECT bài đã xuất bản hoặc admin; `master_library_admin_all` ALL cho admin qua `public.current_role() = 'admin'`) + seed 11 mục (khớp dữ liệu mặc định trong code). Áp **staging** HTTP 201; xác minh: RLS on, đủ 2 policy, trigger tồn tại, 11 mục published đọc được qua anon REST.
- **0026_rename_course_08.sql** — `UPDATE courses SET title='Master Tâm thức' WHERE slug='master-tam-thuc-nhan-hieu'` (giữ slug). Áp **staging** HTTP 201; xác minh title staging = “Master Tâm thức”. **Không áp prod** (prod đã có title mới từ trước).
- **Cả 2 migration CHƯA áp prod** — chờ user nghiệm thu staging rồi mới áp prod theo quy trình. Trên prod hiện tại, trang Thư viện chạy bằng dữ liệu mặc định trong code (đủ 11 mục); sau khi áp 0025 lên prod, trang sẽ đọc từ DB (seed đã có sẵn trong migration).

### 11.9 Việc còn mở sau đợt này

1. Áp migration 0025 + 0026 lên prod sau khi user nghiệm thu staging (0026 thực chất không đổi gì trên prod vì prod đã có title mới — chỉ cần xác nhận).
2. Kiểm chứng bằng trình duyệt thật trên live (mục 11.7, 4 việc).
3. Nội dung Thư viện: chờ user gửi thêm văn bản cho 10 mục T… và lời giải chi tiết cho Nhan thí / Tâm thí / Tọa thí; ảnh banner kệ sách (nếu user muốn thay panel gradient hiện tại).
4. Admin đăng/sửa bài blog chưa có (blog hiện là dữ liệu tĩnh) — thêm sau khi user chốt.
5. Tỷ lệ hoa hồng 10% đã chốt (QĐ 26); Tài chính → Thân đã chốt (QĐ 27); tên khóa 02/08 đã chốt (QĐ 29); các quyết định mở cũ khác (xem mục 10.3 và DECISIONS.md).
6. S-03 vẫn mở (RLS `lessons` cho phép anon REST đọc content bài trả phí) — đợt này không làm tệ thêm (trang chi tiết chỉ đọc `lessons_public`, nội dung bài chỉ qua API guard); vẫn cần migration siết RLS riêng.

## 12. Đợt 11/11/2026 ~16:19–17:10 +07 — QĐ 26–38 + sửa màn hình kẹt + topbar + nút căn giữa + giảng viên + menu

- **QĐ 26–31 (D–I) + QĐ 32–36 (J–R):** xem DECISIONS.md. Code + migration 0032/0033 đã áp staging + prod; deploy Pages + Worker **CHƯA chạy** (xem §12.6).
- **12.1 Giảng viên = Lê Đăng Quyết (QĐ 37).** Dòng "Giảng viên: Ngô Mạnh Cường" trong ảnh user 16:53 **không tìm thấy ở bất kỳ nguồn nào**: repo = 0, `git log -S` toàn lịch sử = 0, DB prod (profiles/course_instructors/courses incl. details) = 0, staging = 0, HTML gốc = 0, built chunks + live HTML `/`, `/chuong-trinh`, 3 trang chi tiết = 0; code hiện tại cũng không render dòng giảng viên nào ở thẻ khóa học (chỉ admin `/admin/khoa-hoc` có "Giảng viên phụ trách", giảng viên duy nhất ở đó đã là Lê Đăng Quyết). Kết luận: ảnh nhiều khả năng là trang cache cũ hoặc trang khác — không có nguồn để gỡ. Trạng thái cuối: hiển thị "Giảng viên: Lê Đăng Quyết" ở cả 3 nơi (thẻ trang chủ `CourseExplorer`, thẻ `/chuong-trinh` `CourseCard`, trang chi tiết `[slug]`) qua hằng số `LEAD_INSTRUCTOR_NAME` (`lib/courses.ts`) + test hồi quy; dữ liệu: Lê Đăng Quyết đã là lead cả 10 khóa trên **prod** (xác minh 10/10); staging chưa gắn được vì tài khoản không tồn tại trên staging (FK chặn, đúng thiết kế).
- **12.2 Menu "KHÓA HỌC" (QĐ 38).** Đổi 1 dòng duy nhất trong `Header.tsx` (`NAV`); link đích `/#chuong-trinh` giữ nguyên; tiêu đề section "MƯỜI CHƯƠNG TRÌNH…" không đổi. Render local: menu 7 mục đủ, "KHÓA HỌC" hiện đúng, header cân đối 1440px + 390px.
- **12.3 Topbar sau sửa (đo CDP, build local).** 1440px: topbar **80px → 32,8px** (font 14px, padding 4px), header tổng **152px → 105px**, doc **22039px → 20921px** (−1118px). 390px: topbar `display:none` (giữ nguyên), header 72px. Không tràn ngang (scrollW = clientW cả 2 cỡ).
- **12.4 Nút thẻ khóa học căn giữa — ĐÃ XÁC MINH bằng đo + mắt.** 1440px: 4 thẻ mẫu, tâm nút vàng = tâm nút viền = tâm thẻ (266/712/1159, sai số 0). 390px: 195 = 195 = 195. Ảnh crop xem bằng mắt: nút vàng trên, nút viền dưới, nằm đúng giữa thẻ, cân đối. `/chuong-trinh` (1 nút/thẻ) chưa đo được local (trang fetch Supabase client-side, VM không ra Internet — xem §12.6); code đã sửa giống hệt (`text-align:center`).
- **12.5 Rà soát cân đối 2 bên — trang chủ ĐẠT, các trang client CHƯA đo được local.** Trang chủ 1440px + 390px: mọi section `left == right` (diff 0, khung 1380px, lề 23px/23px ở 1440px), mọi h2 căn giữa có offset 0, không tràn ngang. `/chuong-trinh`, `/thu-vien-master`, `/blog`, trang chi tiết khóa học: không render được trong VM (client-side fetch Supabase; trình duyệt VM không ra Internet — giới hạn đã biết từ QA) nên chưa đo lề/balance ở các trang này; khung `.wrap` dùng chung với trang chủ nên rủi ro thấp, nhưng **cần kiểm chứng bằng browser-task trên live sau deploy**.
- **12.6 Việc còn mở sau đợt này (cần parent/user).**
  1. **Deploy BLOCKED — cần credential Cloudflare** (Global Key / User API Token không còn trong phiên; `wrangler whoami` = chưa xác thực). Chạy: `workers/api: npx wrangler deploy` + `apps/web: pages:build` rồi `wrangler pages deploy .vercel/output/static --project-name=visfaracademy` (stream log ra file, không dùng `capture_output=True`).
  2. Sau deploy, kiểm chứng live: `/` 200 + 0 tên cũ + "Sứ mệnh & Tầm nhìn" còn + footer không còn link "Đăng nhập học viên" + `/chuong-trinh` tên mới 02/08 + `/hoc-vien/vi` "10%" không "chờ chốt" + bài Buổi 1 có video + ảnh cộng đồng Ivory mới + topbar ~33px + nút căn giữa + "Giảng viên: Lê Đăng Quyết" + menu "KHÓA HỌC".
  3. **Browser-task (parent sắp xếp):** bấm hết 10 mục dropdown bằng tài khoản student test `visfaracademy+paytest2@gmail.com` và (user tự đăng nhập) `lequyet.hvnh@gmail.com`; kiểm tra hover lift trên desktop có chuột; kiểm tra `/chuong-trinh`, `/thu-vien-master`, `/blog`, trang chi tiết trên điện thoại thật.
  4. Ảnh trong render local bị vỡ là artifact của static server (URL optimizer của Next không chạy trên `python http.server`) — không phải lỗi thật; live Pages phục vụ ảnh bình thường.
