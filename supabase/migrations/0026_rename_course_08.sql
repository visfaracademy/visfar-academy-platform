-- ============================================================================
-- 0026_rename_course_08.sql — Doi ten khoa 08 (hien thi) tu
--   "Master Tam thuc & Nhan hieu" thanh "Master Tam thuc".
--   CHI doi title; GIU NGUYEN slug 'master-tam-thuc-nhan-hieu' de khong
--   vo link cu (/chuong-trinh/master-tam-thuc-nhan-hieu, footer, form).
--   Prod DB da co title moi tu truoc (kiem chung 2026-11-11); migration
--   nay dong bo staging theo. CHUA ap prod (khong can — prod da dung).
--   Khong sua file cu (0001–0025).
-- ============================================================================

update public.courses
set title = 'Master Tâm thức'
where slug = 'master-tam-thuc-nhan-hieu'
  and title <> 'Master Tâm thức';
