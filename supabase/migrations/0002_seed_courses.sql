-- ============================================================================
-- Visfar Academy — Module 1: Foundation
-- Migration 0002 — seed 10 khoa hoc (theo Tai lieu kien truc §3.2)
--  * Thu tu hien thi 01-10 GIU NGUYEN thu tu trang hien tai.
--  * UUID co dinh de seed sau co the tham chieu on dinh.
--  * Idempotent: chay lai se UPDATE theo slug, khong tao trung.
--  * Noi dung 3 khoa 04/05/06 (Suc khoe / Moi quan he / Tai chinh) hien
--    lay tu phan Linh vuc ung dung — GHI RO LA NOI DUNG TAM, cho user
--    gui van ban cua minh de thay. Khong gia vo do la van ban goc.
--  * Hoc phi: 0 = mien phi / Tuy tam (khoa 07). Gia cac khoa khac chua
--    duoc user cong bo nen de 0, KHONG tu dat gia.
-- ============================================================================

insert into public.courses
  (id, slug, display_order, title, subtitle, description, details, pillar,
   poster_url, price_vnd, is_featured, status)
values
  ('11111111-0001-4000-8000-000000000001', 'thau-hieu-noi-tam', 1,
   'Thấu Hiểu Nội Tâm', 'Hiểu bản thân để bắt đầu thay đổi',
   'Hiểu nội tâm của mình để bắt đầu thay đổi từ gốc nhận thức.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": []}'::jsonb,
   'tam-thuc', null, 0, false, 'published'),
  ('11111111-0002-4000-8000-000000000002', 'thau-hieu-tam-thuc', 2,
   'Thấu Hiểu Tâm Thức', 'Khai mở tâm thức, nuôi dưỡng tâm thái',
   'Thấu hiểu tâm thức — nền tảng của sự phát triển toàn diện con người.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": []}'::jsonb,
   'tam-thuc', null, 0, false, 'published'),
  ('11111111-0003-4000-8000-000000000003', 'thau-hieu-tri-tue', 3,
   'Thấu Hiểu Trí Tuệ', 'Hiểu bản chất – Mở rộng tư duy – Nâng cao trí tuệ',
   'Hiểu bản chất, mở rộng tư duy và nâng cao trí tuệ.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": []}'::jsonb,
   'tri-tue', null, 0, false, 'published'),
  ('11111111-0004-4000-8000-000000000004', 'thau-hieu-suc-khoe', 4,
   'Thấu Hiểu Sức Khỏe', 'Tư vấn và huấn luyện sức khỏe',
   'NOI DUNG TAM — lay tu phan Linh vuc ung dung (the 02 Suc khoe). Cho user gui van ban cua minh de thay.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": [], "noi_dung_tam": true}'::jsonb,
   'tam-thuc', null, 0, false, 'published'),
  ('11111111-0005-4000-8000-000000000005', 'thau-hieu-moi-quan-he', 5,
   'Thấu Hiểu Mối Quan Hệ', 'Tư vấn và huấn luyện mối quan hệ',
   'NOI DUNG TAM — lay tu phan Linh vuc ung dung (the 03 Moi quan he). Cho user gui van ban cua minh de thay.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": [], "noi_dung_tam": true}'::jsonb,
   'tam-thuc', null, 0, false, 'published'),
  ('11111111-0006-4000-8000-000000000006', 'thau-hieu-tai-chinh', 6,
   'Thấu Hiểu Tài Chính', 'Tư vấn và huấn luyện tài chính',
   'NOI DUNG TAM — lay tu phan Linh vuc ung dung (the 04 Tai chinh). Cho user gui van ban cua minh de thay.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": [], "noi_dung_tam": true}'::jsonb,
   'tam-thuc', null, 0, false, 'published'),
  ('11111111-0007-4000-8000-000000000007', 'chuyen-gia-tu-van', 7,
   'Chuyên gia tư vấn và huấn luyện tâm thức', 'Chương trình trọng tâm · 5 ngày · Trực tuyến',
   'Chương trình trọng tâm của Visfar Academy: tư vấn và huấn luyện tâm thức trong 5 ngày, học trực tuyến. Học phí: Tùy tâm.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": []}'::jsonb,
   'tam-thuc', null, 0, true, 'published'),
  ('11111111-0008-4000-8000-000000000008', 'master-tam-thuc-nhan-hieu', 8,
   'Master Tâm thức & Nhân hiệu', 'Biến tri thức thành năng lực – Biến nhận thức thành hành động',
   'Chương trình ứng dụng: biến tri thức thành năng lực, biến nhận thức thành hành động.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": []}'::jsonb,
   'nhan-hieu', null, 0, false, 'published'),
  ('11111111-0009-4000-8000-000000000009', 'coaching-90-ngay', 9,
   'Coaching 90 ngày đồng hành', 'Chương trình chuyên sâu · 90 ngày',
   'Coaching 1–1 hoặc nhóm nhỏ, đồng hành 90 ngày.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": []}'::jsonb,
   'nhan-hieu', null, 0, false, 'published'),
  ('11111111-0010-4000-8000-000000000010', 'cong-dong-visfar', 10,
   'Cộng đồng Visfar', 'Học tập suốt đời · Kết nối và phát triển',
   'Cộng đồng học tập suốt đời của Visfar Academy — nơi học viên trao đổi tri thức, thực hành và kết nối cùng nhau.',
   '{"noi_dung_chinh": [], "ket_qua_huong_den": []}'::jsonb,
   'cong-dong', null, 0, false, 'published')
on conflict (slug) do update set
  display_order = excluded.display_order,
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  details = excluded.details,
  pillar = excluded.pillar,
  price_vnd = excluded.price_vnd,
  is_featured = excluded.is_featured,
  status = excluded.status,
  updated_at = now();
