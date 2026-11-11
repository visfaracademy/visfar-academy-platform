# Email Supabase Auth — Template tiếng Việt phong cách Visfar

Thay thế 4 email mặc định tiếng Anh của Supabase bằng bản tiếng Việt luxury
(nền ivory champagne, dải vàng gold, nút CTA vàng, footer hotline + email).
Email vẫn gửi qua hệ thống mặc định của Supabase (từ `noreply@mail.app.supabase.io`)
— theo quyết định "Dùng tạm" của user ngày 11/11/2026, chưa đổi sang Resend
(vì chưa có domain riêng để xác minh SPF/DKIM/DMARC).

## Template và tiêu đề (Subject)

| # | File | Dán vào mục trong Supabase Dashboard | Subject |
|---|------|--------------------------------------|---------|
| 1 | `01-confirm-signup.html` | **Confirm signup** | `Xác nhận email của bạn — Visfar Academy` |
| 2 | `02-reset-password.html` | **Reset password** | `Đặt lại mật khẩu — Visfar Academy` |
| 3 | `03-magic-link.html` | **Magic link** | `Đăng nhập Visfar Academy` |
| 4 | `04-change-email.html` | **Change email address** | `Xác nhận email mới — Visfar Academy` |

## Cách dán — làm cho cả 2 project (staging và prod)

1. Mở [Supabase Dashboard](https://supabase.com/dashboard) → chọn project
   (**staging** trước, rồi lặp lại cho **prod**).
2. Menu trái → **Authentication** → **Emails** (mục NOTIFICATIONS).
3. Với từng template trong bảng trên:
   - Bấm vào tên template (vd **Confirm signup**).
   - Ô **Subject**: xóa subject cũ, nhập đúng Subject trong bảng.
   - Ô **Message** (phần HTML): xóa toàn bộ nội dung cũ, mở file HTML
     tương ứng trong thư mục này, copy toàn bộ và dán vào.
   - Bấm **Save**.
4. Kiểm tra: đăng ký 1 tài khoản test mới → mở email xác nhận → phải thấy
   email tiếng Việt nền ivory, nút vàng "Xác nhận email của tôi".

## Lưu ý — không được sửa

- **Giữ nguyên các biến `{{ .ConfirmationURL }}`, `{{ .Token }}`,
  `{{ .NewEmail }}`** trong file HTML — Supabase thay chúng bằng link thật
  khi gửi. Xóa hoặc sửa sai biến sẽ làm link xác nhận hỏng.
- **Không đổi Site URL / Redirect URLs** — đã set đúng
  `https://visfaracademy.pages.dev` cho cả staging và prod ngày 11/11/2026.
- Người gửi vẫn là `noreply@mail.app.supabase.io` cho tới khi cấu hình
  Custom SMTP / domain riêng. Nội dung email đã mang thương hiệu Visfar
  đầy đủ (tên, hotline, email, website) nên học viên vẫn nhận diện được.
- Template **Magic link** chỉ có tác dụng khi bật Magic Link trong
  Authentication → Sign In / Providers. Hiện tại web dùng email + mật khẩu;
  cứ dán sẵn template, khi nào bật Magic Link mới dùng tới.
- Template **Invite user** (mời học viên) chưa làm — Supabase chỉ gửi
  invite khi admin mời qua Dashboard/API; cần thì làm thêm sau.
