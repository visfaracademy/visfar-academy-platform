# Kiểm thử RLS bằng tay — CHƯA CHẠY (cần Supabase project thật)

> **Trạng thái: CHƯA CHẠY.** Không tuyên bố test RLS đã pass cho tới khi
> các bước dưới đây được chạy trên Supabase project thật và ghi kết quả.
> Script `scripts/check-migrations.mjs` chỉ kiểm tra tĩnh (RLS được bật
> trong file SQL), không chứng minh RLS hoạt động đúng trên database thật.

## Chuẩn bị

1. Tạo Supabase project (xem README.md), chạy 3 migration theo thứ tự.
2. Tạo 3 tài khoản test qua Supabase Auth (hoặc SQL):
   - `student-a@test.visfar.local` — role `student`
   - `student-b@test.visfar.local` — role `student`
   - `admin@test.visfar.local` — role `admin` (đổi role trong bảng `profiles`)
3. Lấy JWT của từng tài khoản (đăng nhập qua app, hoặc dùng Supabase Auth API).
   Gọi API Supabase với header `Authorization: Bearer <JWT>` và `apikey: <anon key>`.

## Kịch bản kiểm thử (ghi PASS/FAIL cho từng dòng)

| # | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|
| R1 | Anon (không JWT) `SELECT * FROM courses WHERE status='published'` | Thấy 10 khóa | ☐ |
| R2 | Anon `SELECT * FROM courses` (không lọc status) | Chỉ thấy khóa published (draft bị chặn) | ☐ |
| R3 | Anon `SELECT * FROM leads` | 0 dòng / lỗi 42501 (bị chặn) | ☐ |
| R4 | Anon `INSERT INTO leads (...)` | Bị chặn (không có policy INSERT) | ☐ |
| R5 | Anon `SELECT * FROM quiz_options` | Bị chặn (không có policy SELECT trực tiếp) | ☐ |
| R6 | Anon `SELECT * FROM quiz_options_public` | Thấy option_text, KHÔNG thấy cột `is_correct` | ☐ |
| R7 | Student A `SELECT * FROM enrollments` | Chỉ thấy enrollment của A | ☐ |
| R8 | Student A `SELECT * FROM enrollments` của B (lọc user_id=B) | 0 dòng | ☐ |
| R9 | Student A `SELECT * FROM orders` | Chỉ thấy đơn của A | ☐ |
| R10 | Student A `SELECT * FROM payments` | 0 dòng / bị chặn | ☐ |
| R11 | Student A `UPDATE courses SET title='...'` | Bị chặn | ☐ |
| R12 | Admin `SELECT * FROM leads` | Thấy tất cả lead | ☐ |
| R13 | Admin `SELECT * FROM payments` | Thấy tất cả payment | ☐ |
| R14 | Student A đăng ký tài khoản mới | `profiles` tự tạo 1 dòng qua trigger `on_auth_user_created` | ☐ |
| R15 | Student A `SELECT * FROM lesson_progress` | Chỉ thấy tiến độ của A | ☐ |
| R16 | Student A `SELECT * FROM profiles` | Chỉ thấy profile của A (admin thấy tất cả) | ☐ |

## Lưu ý đã biết

- **Quyền instructor sửa bài học** (§6.2) chưa test được vì schema §3 không có
  bảng ánh xạ instructor ↔ course. Trong 0001, ghi module/lesson/quiz chỉ
  admin. Khi thêm bảng `course_instructors` (Module 2+), bổ sung kịch bản
  R17–R19 vào file này.
- Nếu R1–R2 fail, kiểm tra lại policy `courses_select_public` và xem
  `status` của seed có đúng `published` không.
- Ghi ngày chạy, người chạy, và project ref vào bảng kết quả khi chạy thật.
