-- ============================================================================
-- 0032_rename_courses_02_08.sql — Doi ten hien thi 2 khoa theo he
--   Than – Tam – Tue (QĐ 29, 11/11/2026, user chot truc tiep).
--   - Khoa 02 (tru Tam):  "Thấu Hiểu Tâm Thức" -> "Thấu Hiểu Tâm"
--   - Khoa 08 (tich hop): "Master Tâm thức"    -> "Master Thân – Tâm – Tuệ"
--   CHI doi title; GIU NGUYEN slug de khong vo link cu:
--     thau-hieu-tam-thuc, master-tam-thuc-nhan-hieu.
--   LUU Y: ten moi cua khoa 08 la SUY RA tu phan loai "Tich hop"
--   (ca 3 tru) cua user, KHONG phai ten user viet san — user sua lai
--   bang 1 cau neu muon ten khac.
--   Idempotent (chi doi khi title con cu). Khong sua file cu (0001–0031).
-- ============================================================================

update public.courses
set title = 'Thấu Hiểu Tâm'
where slug = 'thau-hieu-tam-thuc'
  and title <> 'Thấu Hiểu Tâm';

update public.courses
set title = 'Master Thân – Tâm – Tuệ'
where slug = 'master-tam-thuc-nhan-hieu'
  and title <> 'Master Thân – Tâm – Tuệ';
