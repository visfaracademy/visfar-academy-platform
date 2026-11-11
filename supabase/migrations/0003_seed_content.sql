-- ============================================================================
-- Visfar Academy — Module 1: Foundation
-- Migration 0003 — seed 4 bai chinh sach (theo Tai lieu kien truc §3.2)
--  * Noi dung o day la BAN TOM TAT DUNG TINH THAN cua 4 bai chinh sach
--    tren trang hien tai (ngay cap nhat 04/11/2026, version 1).
--    TOAN VAN day du se duoc chuyen vao o Module noi dung sau, hoac
--    admin nhap qua CMS — KHONG viet lai toan van o day de tranh sai
--    lech voi ban user da duyet.
--  * KHONG bia dia chi tru so, ma so thue, so/ngay cap DKKD.
--    Thong tin lien he chi dung nhung gi da cong bo: hotline
--    034 7897 868, email visfaracademy@gmail.com, Zalo 0347897868,
--    ten to chuc "To chuc dao tao Visfar Academy".
--  * Idempotent theo (slug, version).
-- ============================================================================

insert into public.policies (slug, title, body, version, is_current)
values
  ('bao-mat', 'Chính sách bảo mật',
   'Tóm tắt đúng tinh thần bản đã công bố ngày 04/11/2026 (version 1). ' ||
   'Visfar Academy chỉ thu thập thông tin học viên cung cấp khi đăng ký tư vấn ' ||
   '(họ tên, số điện thoại, email, tỉnh/thành phố, khóa học quan tâm) để liên hệ tư vấn và chăm sóc. ' ||
   'Thông tin không được bán hay chia sẻ cho bên thứ ba vì mục đích thương mại. ' ||
   'Liên hệ: Tổ chức đào tạo Visfar Academy — Điện thoại 034 7897 868 — Email visfaracademy@gmail.com — Zalo 0347897868. ' ||
   'Toàn văn đầy đủ sẽ được chuyển vào từ trang hiện tại ở module nội dung.',
   1, true),
  ('dieu-khoan-tham-gia', 'Điều khoản tham gia',
   'Tóm tắt đúng tinh thần bản đã công bố ngày 04/11/2026 (version 1). ' ||
   'Học viên tham gia chương trình của Visfar Academy cần cung cấp thông tin đúng, ' ||
   'tôn trọng cộng đồng học tập và nội dung chương trình. ' ||
   'Kết quả học tập phụ thuộc vào hành động của học viên; Visfar Academy không cam kết kết quả “làm giàu nhanh”. ' ||
   'Liên hệ: Tổ chức đào tạo Visfar Academy — Điện thoại 034 7897 868 — Email visfaracademy@gmail.com — Zalo 0347897868. ' ||
   'Toàn văn đầy đủ sẽ được chuyển vào từ trang hiện tại ở module nội dung.',
   1, true),
  ('hoan-tra-huy-dang-ky', 'Chính sách hoàn trả / hủy đăng ký',
   'Tóm tắt đúng tinh thần bản đã công bố ngày 04/11/2026 (version 1). ' ||
   'Học viên có thể yêu cầu hủy đăng ký và hoàn trả theo quy định của từng chương trình. ' ||
   'LƯU Ý: khung thời gian xử lý (3/7/15 ngày làm việc) trong bản hiện tại do builder viết, CHƯA được user duyệt — ' ||
   'cần user duyệt lại trước khi áp dụng chính thức. ' ||
   'Liên hệ: Tổ chức đào tạo Visfar Academy — Điện thoại 034 7897 868 — Email visfaracademy@gmail.com — Zalo 0347897868. ' ||
   'Toàn văn đầy đủ sẽ được chuyển vào từ trang hiện tại ở module nội dung.',
   1, true),
  ('giai-quyet-khieu-nai', 'Giải quyết khiếu nại',
   'Tóm tắt đúng tinh thần bản đã công bố ngày 04/11/2026 (version 1). ' ||
   'Học viên có thể gửi khiếu nại qua điện thoại, email hoặc Zalo của Visfar Academy. ' ||
   'LƯU Ý: khung thời gian xử lý (3/15/30 ngày làm việc) trong bản hiện tại do builder viết, CHƯA được user duyệt — ' ||
   'cần user duyệt lại trước khi áp dụng chính thức. ' ||
   'Liên hệ: Tổ chức đào tạo Visfar Academy — Điện thoại 034 7897 868 — Email visfaracademy@gmail.com — Zalo 0347897868. ' ||
   'Toàn văn đầy đủ sẽ được chuyển vào từ trang hiện tại ở module nội dung.',
   1, true)
on conflict (slug, version) do nothing;
-- UNIQUE(slug, version) da co trong 0001, nen ON CONFLICT o tren hop le.
