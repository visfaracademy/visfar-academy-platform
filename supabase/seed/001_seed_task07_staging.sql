-- Seed toi thieu TASK 07 — CHI CHAY TREN STAGING (10/11/2026).
-- Khoa 01 "Thau Hieu Noi Tam" (published, da co tu 0002) + 1 module + 2 lesson + 1 resource.
-- Noi dung dung chu cua user (Founder / tieu de khoa 01), khong bia noi dung khoa moi.
-- Lesson video: video_url = NULL — chua co link YouTube unlisted that do user cung cap;
-- video_duration_sec = 600 de test nguong hoan thanh 90% (540/600 giay).
-- UUID co dinh de doi chieu / xoa test sau nay.
insert into public.course_modules (id, course_id, title, slug, display_order, is_free_preview, is_published)
values ('22222222-0001-4000-8000-000000000001',
        '11111111-0001-4000-8000-000000000001',
        'Mô-đun 1 — Hiểu mình để bắt đầu thay đổi',
        'mo-dun-1-hieu-minh', 1, false, true)
on conflict (id) do nothing;

insert into public.lessons (id, course_module_id, slug, title, type, content, video_url, video_duration_sec, display_order, is_free_preview, is_published)
values
  ('33333333-0001-4000-8000-000000000001',
   '22222222-0001-4000-8000-000000000001',
   'bai-1-khai-mo-tam-thuc', 'Bài 1 — Khai mở tâm thức', 'video',
   'Khai mở tâm thức: nhận thức được khai mở, trí tuệ được phát triển, tâm thái được nuôi dưỡng và nhân cách được hoàn thiện.',
   null, 600, 1, true, true),
  ('33333333-0002-4000-8000-000000000002',
   '22222222-0001-4000-8000-000000000001',
   'bai-2-goc-nhan-thuc', 'Bài 2 — Thay đổi từ gốc nhận thức', 'text',
   'Muốn thay đổi cuộc đời, trước hết phải thay đổi từ gốc nhận thức. Khi nhận thức được khai mở, trí tuệ được phát triển, tâm thái được nuôi dưỡng và nhân cách được hoàn thiện, con người sẽ từng bước làm chủ bản thân, kiến tạo nhân hiệu và tạo dựng những giá trị bền vững.',
   null, null, 2, false, true)
on conflict (id) do nothing;

insert into public.lesson_resources (id, lesson_id, title, resource_type, file_url, display_order, is_free_preview)
values ('44444444-0001-4000-8000-000000000001',
        '33333333-0002-4000-8000-000000000002',
        'Tài liệu bài 2 (chờ file PDF thật từ user)',
        'document', null, 1, false)
on conflict (id) do nothing;
