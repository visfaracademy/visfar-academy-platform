-- ============================================================================
-- 0024_pillars_than_tam_tue.sql — 3 tru cot Than – Tam – Tue (11/11/2026)
-- ============================================================================
-- Quyet dinh user 11/11/2026: ra soat 10 khoa hoc theo 3 tru cot
-- Than – Tam – Tue; nhan tru cot / phan loai cu (Tam thuc – Tri tue –
-- Nhan hieu) la SAI, sua cho khop o ca 3 noi: trang chu (du lieu tinh
-- homepage-data.ts), /chuong-trinh + trang chi tiet (bang courses),
-- va form admin (CourseEditForm).
--
-- Anh xa (ten khoa 01–10 GIU NGUYEN, khong doi ten):
--   01 Thau Hieu Noi Tam        tam-thuc  -> tam
--   02 Thau Hieu Tam Thuc       tam-thuc  -> tam
--   03 Thau Hieu Tri Tue        tri-tue   -> tue
--   04 Thau Hieu Suc Khoe       tam-thuc  -> than   (suc khoe = Than)
--   05 Thau Hieu Moi Quan He    tam-thuc  -> tam    (moi quan he = Tam)
--   06 Thau Hieu Tai Chinh      tam-thuc  -> than   (vat chat = Than;
--                                        lua chon cua agent — user chot
--                                        sau neu muon doi sang Tue/Tam)
--   07 Chuyen gia tu van ...    tam-thuc  -> tich-hop (ca 3 tru cot)
--   08 Master Tam thuc & Nhan hieu nhan-hieu -> tich-hop (ca 3 tru cot)
--   09 Coaching 90 ngay         nhan-hieu -> tich-hop (ca 3 tru cot)
--   10 Cong dong Visfar         cong-dong -> cong-dong (khong doi)
--
-- Dong thoi dong bo subtitle + description cua ca 10 khoa ve dung van
-- ban da chot o trang chu (homepage-data.ts, Quyet dinh 10), de trang
-- chu / /chuong-trinh / trang chi tiet hien cung 1 mo ta. Rieng
-- 04/05/06: description trong DB dang la ghi chu noi bo "NOI DUNG TAM
-- — ... Cho user gui van ban cua minh de thay." (lo ra trang chi tiet
-- cong khai) + co co noi_dung_tam = true hien dong "Noi dung tam — cho
-- van ban cua nguoi sang lap de thay." — ca hai deu duoc xoa o day vi
-- van ban 04/05/06 da duoc user chap nhan (Quyet dinh 10).
--
-- Tuong thich: code frontend co normalizePillar() (packages/shared)
-- map gia tri cu sang bo moi de trang /chuong-trinh khong vo trong
-- khoang giua deploy code va ap migration nay. Sau khi 0024 da ap
-- len staging + prod, xoa normalizePillar() + LEGACY_PILLAR_BY_SLUG.
-- ============================================================================

-- THU TU QUAN TRONG (sua 11/11/2026): CHECK cu chan ca gia tri moi
-- ('tam' bi CHECK cu tu choi), CHECK moi chan ca gia tri cu
-- ('tam-thuc' bi CHECK moi tu choi). Nen phai: (A1) BO CHECK CU
-- truoc -> (B) doi gia tri -> (A2) THEM CHECK MOI sau. Ca 2 lan ap
-- staging truoc deu loi 23514 vi thu tu sai.

-- (A1) Bo CHECK cu truoc.
alter table public.courses
  drop constraint if exists courses_pillar_check;

-- (B) Doi gia tri pillar cua 10 khoa (theo anh xa o tren).
update public.courses set pillar = 'tam' where slug = 'thau-hieu-noi-tam';
update public.courses set pillar = 'tam' where slug = 'thau-hieu-tam-thuc';
update public.courses set pillar = 'tue' where slug = 'thau-hieu-tri-tue';
update public.courses set pillar = 'than' where slug = 'thau-hieu-suc-khoe';
update public.courses set pillar = 'tam' where slug = 'thau-hieu-moi-quan-he';
update public.courses set pillar = 'than' where slug = 'thau-hieu-tai-chinh';
update public.courses set pillar = 'tich-hop' where slug = 'chuyen-gia-tu-van';
update public.courses set pillar = 'tich-hop' where slug = 'master-tam-thuc-nhan-hieu';
update public.courses set pillar = 'tich-hop' where slug = 'coaching-90-ngay';
-- 'cong-dong-visfar' giu nguyen 'cong-dong'.

-- (A2) Them CHECK moi SAU khi gia tri da doi xong.
alter table public.courses
  add constraint courses_pillar_check
  check (pillar in ('than', 'tam', 'tue', 'tich-hop', 'cong-dong'));

-- (C) Dong bo subtitle + description ve van ban da chot (trang chu).
update public.courses set
  subtitle = 'Hiểu bản thân để bắt đầu thay đổi',
  description = 'Giúp bạn nhận diện những yếu tố đang chi phối nhận thức, suy nghĩ, cảm xúc và hành vi của chính mình.'
  where slug = 'thau-hieu-noi-tam';
update public.courses set
  subtitle = 'Thấu hiểu gốc rễ nhận thức – Làm chủ bản thân',
  description = 'Khám phá cách tâm thức hình thành nhận thức, định hướng suy nghĩ, cảm xúc, lựa chọn và hành vi trong đời sống.'
  where slug = 'thau-hieu-tam-thuc';
update public.courses set
  subtitle = 'Hiểu bản chất – Mở rộng tư duy – Nâng cao trí tuệ',
  description = 'Phát triển khả năng nhận biết, phân tích, tư duy độc lập và nhìn nhận vấn đề đa chiều để đưa ra quyết định sáng suốt.'
  where slug = 'thau-hieu-tri-tue';
update public.courses set
  subtitle = 'Đẹp thân — tâm — trí — nhan: phần lớn bên trong, phần nhỏ bên ngoài, cần bảo dưỡng đều',
  description = 'Tâm sinh tướng. Trân trọng, yêu thương bản thân trước; chăm sóc trong lẫn ngoài, đúng, đủ, đều.',
  details = details - 'noi_dung_tam'
  where slug = 'thau-hieu-suc-khoe';
update public.courses set
  subtitle = 'Mối quan hệ bền bắt đầu từ lắng nghe và thấu hiểu — hiểu người trước khi mong được hiểu',
  description = 'Khi niềm tin được vun đắp bằng chân thành, trân trọng và bao dung, mỗi người trở thành điểm tựa an vui cho nhau trong gia đình và cuộc sống.',
  details = details - 'noi_dung_tam'
  where slug = 'thau-hieu-moi-quan-he';
update public.courses set
  subtitle = 'Làm chủ vật chất bắt đầu từ cách nhìn về tiền — rồi mới tới công cụ, vốn, thói quen',
  description = 'Bốn vị trí — làm thuê, làm tư, làm chủ, đầu tư — soi lại thói quen với tiền. Tiết kiệm để đầu tư trước, chi tiêu sau.',
  details = details - 'noi_dung_tam'
  where slug = 'thau-hieu-tai-chinh';
update public.courses set
  subtitle = 'Chuyển hóa từ nhận thức – Kiến tạo giá trị và nhân hiệu',
  description = 'Chương trình tích hợp ba trụ cột Thân – Tâm – Tuệ, giúp người học nhìn lại nền tảng nhận thức, định hình giá trị bản thân và xây dựng định hướng phát triển.'
  where slug = 'chuyen-gia-tu-van';
update public.courses set
  subtitle = 'Biến tri thức thành năng lực – Biến nhận thức thành hành động',
  description = 'Đưa những kiến thức đã học vào tình huống thực tế, giải quyết vấn đề cụ thể và xây dựng kế hoạch phát triển có thể triển khai.'
  where slug = 'master-tam-thuc-nhan-hieu';
update public.courses set
  subtitle = 'Có định hướng – Có người đồng hành – Có tiến trình thực hiện',
  description = 'Chương trình dành cho những người mong muốn phát triển chuyên sâu, cần sự đồng hành, phản hồi và rà soát tiến độ trong quá trình thực hiện mục tiêu.'
  where slug = 'coaching-90-ngay';
update public.courses set
  subtitle = 'Cùng học hỏi – Cùng thực hành – Cùng lan tỏa giá trị',
  description = 'Không dừng lại sau một khóa học, Cộng đồng VISFAR là môi trường để học viên tiếp tục trao đổi tri thức, thực hành và kết nối những người cùng định hướng phát triển.'
  where slug = 'cong-dong-visfar';

-- ============================================================================
-- KIEM CHUNG (chay tay sau khi ap 0024, staging truoc roi prod):
--   1. select slug, pillar from public.courses order by display_order;
--      -- Ky vong: tam, tam, tue, than, tam, than, tich-hop, tich-hop,
--      -- tich-hop, cong-dong (dung thu tu 01–10).
--   2. select slug, description from public.courses
--      where slug in ('thau-hieu-suc-khoe','thau-hieu-moi-quan-he',
--      'thau-hieu-tai-chinh');
--      -- Ky vong: khong con chu "NOI DUNG TAM".
--   3. select slug from public.courses
--      where (details ? 'noi_dung_tam');
--      -- Ky vong: 0 dong.
--   4. Thu chen gia tri cu (du kien LOI):
--      update public.courses set pillar = 'tam-thuc'
--      where slug = 'thau-hieu-noi-tam';
--      -- Ky vong: ERROR check constraint "courses_pillar_check".
--   5. Mo /chuong-trinh tren live: tab Than hien 5 khoa, Tam 6 khoa,
--      Tue 4 khoa, Cong dong 1 khoa, Tat ca 10 khoa; the pill tren
--      the khoa hien Than / Tam / Tue / Tich hop / Cong dong.
-- ============================================================================
