# Checklist — Mua domain + verify Resend cho Visfar Academy

**Ngày viết:** 11/11/2026
**Trạng thái hiện tại ("Dùng tạm", theo DECISIONS.md QĐ 14 Task 02):**
- Resend API key **đã set** trên Worker `api` (chỉ xác nhận theo tên trong
  `wrangler secret list`, QA_REPORT.md §3 — không ghi giá trị key ở đây).
- `RESEND_FROM_EMAIL` **chưa set, có chủ đích**. Sender hiện tại
  `onboarding@resend.dev` chỉ gửi được cho chính chủ tài khoản Resend
  (`visfaracademy@gmail.com`).
- **Chưa có domain nào được verify.** Email giao dịch / chăm sóc học viên
  thật (mẫu E1–E13) vẫn **bị chặn** cho tới khi mua domain + verify DNS xong.
- Code Worker **không tự fallback** sang `onboarding@resend.dev`: thiếu
  `RESEND_FROM_EMAIL` thì gửi lỗi `email_not_configured`, không gửi bừa
  (xem `workers/api/src/email/client.ts`). Vì vậy chỉ cần set secret khi
  domain đã verify — không cần sửa code.
- Template Supabase Auth (4 file trong `docs/email/`) là hệ thống **riêng**,
  gửi qua `noreply@mail.app.supabase.io` — không liên quan tới Resend.
  Việc paste template lên Dashboard là bước riêng, xem cuối file.

**Nguyên tắc:** chỉ user mới mua được domain và thêm DNS (cần tài khoản
nhà đăng ký + quyền DNS). Không ai được tự chọn tên domain thay user —
ô tên domain dưới đây để trống cho user điền.

---

## (a) Chọn tên domain — user tự điền

Tên domain đã chọn: ______________________________

Gợi ý (chỉ gợi ý — **chưa kiểm chứng được còn trống** từ môi trường làm
việc này: DNS lookup trong VM trả kết quả sai, tra cứu web không thấy
website nào đang chạy trên 2 tên đầu, nhưng đó không phải bằng chứng còn
trống). **Bắt buộc kiểm tra lại tại ô tìm kiếm của nhà đăng ký trước khi
trả tiền** — nếu đã có người dùng, chọn tên khác trong danh sách hoặc
biến thể:

| Ưu tiên | Tên gợi ý | Ghi chú |
|---------|-----------|---------|
| 1 | `visfaracademy.vn` | Đúng thương hiệu VN nhất; mua qua nhà đăng ký trong nước, cần eKYC CCCD/GPKD; giá ~700.000–770.000đ/năm (xem §b) |
| 2 | `visfaracademy.com` | Quốc tế, mua nhanh không cần eKYC, rẻ nhất (~$11–12/năm); dùng được ngay cho Resend |
| 3 | `visfar.academy` | Ngắn, đúng ngành đào tạo; kiểm tra giá lúc mua (thường đắt hơn `.com`) |

- [ ] Đã tra ô tìm kiếm nhà đăng ký: tên đã chọn **còn trống** (chụp lại kết quả)
- [ ] Đã quyết: dùng **1 domain duy nhất** làm domain gửi email
      (khuyến nghị: trùng với domain website sau này nếu có)

## (b) Mua domain

**Nếu chọn `.com` (nhanh, rẻ):**

| Nhà đăng ký | Giá tham khảo `.com`/năm | Ghi chú |
|-------------|--------------------------|---------|
| Cloudflare Registrar | **$11,17** (giá gốc, không đổi khi gia hạn) | Rẻ nhất dài hạn; **bắt buộc dùng nameserver Cloudflare** |
| Porkbun | **$11,81** (năm đầu = gia hạn) | Linh hoạt nameserver, có sẵn email forward miễn phí |
| Namecheap | **~$12,08** năm đầu, gia hạn **~$19,98** | Năm đầu rẻ nhưng gia hạn đắt — chỉ chọn nếu thích hỗ trợ 24/7 |

(Giá tra cứu ngày 02/11/2026 — **kiểm tra lại giá lúc thanh toán**.)
Khuyến nghị: **Cloudflare Registrar** nếu đã dùng Cloudflare Pages/Workers
(DNS ở cùng một chỗ, thêm bản ghi nhanh nhất); **Porkbun** nếu muốn giữ
nameserver tự do.

**Nếu chọn `.vn`:**
- Chỉ mua qua **nhà đăng ký trong nước được VNNIC công nhận**:
  **PA Vietnam, Mắt Bão, Tenten** (người ở Việt Nam bắt buộc dùng nhà
  đăng ký trong nước).
- Giá tham khảo: **~770.000đ/năm đã gồm VAT** (PA Vietnam, tra 29/09/2026;
  phí nhà nước: đăng ký 100.000đ + duy trì 350.000đ/năm; nhà đăng ký có
  thể thu thêm phí dịch vụ — kiểm tra lại lúc mua).
- Cần chuẩn bị: **CCCD (cá nhân) hoặc Giấy phép kinh doanh (công ty)**
  để eKYC — đăng ký có thể chờ duyệt xác minh, không xong ngay như `.com`.

- [ ] Đã mua xong domain: ______________________________ (điền tên thật)
- [ ] Đã bật **tự động gia hạn (auto-renew)** + bật khóa chuyển nhượng nếu có
- [ ] Đã ghi lại nhà đăng ký + ngày hết hạn: ______________________________

## (c) Thêm domain vào Resend

- [ ] Đăng nhập [Resend](https://resend.com/domains) bằng tài khoản
      `visfaracademy@gmail.com` (tài khoản đã có API key)
- [ ] Bấm **Add Domain** → nhập đúng tên domain đã mua → **Add**
- [ ] Resend hiện bảng DNS cần thêm (SPF / DKIM / DMARC) — **giữ tab này mở**,
      copy từng giá trị sang bước (d)

## (d) Thêm 3 bản ghi DNS (SPF / DKIM / DMARC)

Thêm tại nơi đang quản lý DNS của domain (Cloudflare Dashboard nếu DNS ở
Cloudflare; hoặc trang quản trị DNS của nhà đăng ký đã mua).

| # | Loại | Host / Name | Giá trị |
|---|------|-------------|---------|
| 1 | TXT | `@` (domain gốc) | `v=spf1 include:amazonses.com ~all` |
| 2 | TXT | `resend._domainkey` | **Resend cấp riêng cho domain — copy đúng giá trị trên Dashboard Resend, KHÔNG dùng giá trị mẫu, KHÔNG tự bịa.** Giá trị này là khóa công khai DKIM duy nhất của domain, dạng `p=MIGfMA0G...` rất dài. |
| 3 | TXT | `_dmarc` | `v=DMARC1; p=none;` (chế độ theo dõi lúc đầu; siết lên `p=quarantine` sau khi email chạy ổn) |

Lưu ý:
- Giá trị **SPF** và **DMARC** ở bảng trên là giá trị chuẩn theo hướng dẫn
  Resend — nếu Dashboard Resend hiện giá trị khác, **làm theo Dashboard**.
- Giá trị **DKIM không có mẫu chung** — mỗi domain một giá trị khác nhau,
  chỉ lấy từ Dashboard Resend sau bước (c).
- Nếu domain đã có bản ghi SPF khác: **gộp thành 1 bản ghi duy nhất**,
  không tạo 2 bản ghi SPF (vd: `v=spf1 include:amazonses.com include:... ~all`).
- [ ] Đã thêm đủ 3 bản ghi DNS
- [ ] Đã chờ DNS lan truyền (thường vài phút, tối đa 24–48h)
- [ ] Bấm **Verify** trên Resend → trạng thái domain chuyển **Verified**
      (cả 3 mục SPF / DKIM / DMARC đều xanh)

## (e) Set địa chỉ gửi + kiểm tra cấu hình

Chỉ làm **sau khi domain đã Verified** ở bước (d).

- [ ] Chạy (trên máy có Wrangler + quyền Worker `api`):
      `wrangler secret put RESEND_FROM_EMAIL`
      rồi nhập: `Visfar Academy <hello@<domain-đã-mua>>`
      (thay `<domain-đã-mua>` bằng tên thật, vd `hello@visfaracademy.com`)
- [ ] Kiểm tra lại (chỉ tên, không in giá trị):
      `wrangler secret list` → phải thấy **cả 2**: `RESEND_API_KEY`,
      `RESEND_FROM_EMAIL`
- [ ] Deploy lại Worker `api` (để nhận secret mới) — hoặc xác nhận Worker
      đang chạy đã đọc secret mới
- [ ] Ghi chú: không cần sửa code — mọi chỗ gửi email trong Worker đều
      đọc `RESEND_FROM_EMAIL` (fallback cũ `RESEND_FROM` chỉ là alias);
      thiếu secret thì gửi lỗi `email_not_configured`, không gửi bừa.

## (f) Gửi thử 1 email thật + kiểm tra inbox/spam

- [ ] Gửi thử 1 email mẫu E7 (Chào mừng) hoặc E4 (Xác nhận thanh toán)
      tới **chính hộp thư của user** (vd `visfaracademy@gmail.com`)
      — gửi qua luồng thật (đăng ký tài khoản test mới) hoặc nút gửi thử
      trên Resend Dashboard
- [ ] Email **vào Inbox** (không vào Spam / Promotions), hiển thị đúng
      tên `Visfar Academy`, đúng địa chỉ `hello@<domain-đã-mua>`
- [ ] Mở email trên **điện thoại**: chữ đọc rõ, nút bấm được, link không hỏng
- [ ] Nếu vào Spam: kiểm tra lại 3 bản ghi DNS đã xanh trên Resend chưa,
      rồi gửi thử lại (không gửi thử lặp nhiều lần trong 1 giờ)
- [ ] Kiểm tra log: bảng `email_logs` có dòng `status = sent` cho email thử
      (sau khi migration 0017/0018 đã áp — nếu chưa áp thì kiểm tra bằng
      phản hồi Resend Dashboard → mục Emails)
- [ ] Chỉ sau bước này mới coi email học viên thật là **đã mở** — trước đó
      mọi email E1–E13 vẫn trong trạng thái "Dùng tạm" (chặn)

---

## Việc riêng: paste 4 template Supabase Auth lên Dashboard

(Không liên quan Resend — làm bất cứ lúc nào, độc lập với checklist trên.
File sẵn trong `docs/email/`, hướng dẫn chi tiết trong
`docs/email/SUPABASE_EMAIL_TEMPLATES.md`.)

- [ ] **Staging:** Authentication → Emails → dán đủ 4 template + Subject
      (01 Confirm signup, 02 Reset password, 03 Magic link, 04 Change email)
- [ ] **Prod:** lặp lại đủ 4 template như staging
- [ ] Đăng ký 1 tài khoản test mới → mở email xác nhận → thấy email
      tiếng Việt nền ivory, nút vàng "Xác nhận email của tôi"
- [ ] **Không sửa** các biến `{{ .ConfirmationURL }}`, `{{ .NewEmail }}`
      trong file HTML khi dán (xóa/sửa sai sẽ hỏng link xác nhận)

## Sau khi hoàn tất checklist này

- [ ] Cập nhật `docs/DECISIONS.md` QĐ 14 Task 02: ghi domain đã verify +
      ngày verify (để lần sau không phải hỏi lại)
- [ ] Báo cho nhóm: email học viên thật đã mở — lúc đó mới nối tiếp
      cron nhắc học + route webhook Resend + newsletter (đang mở theo
      QA_REPORT QA-18-MAIL-01 / QA-18-FUNC-01)
