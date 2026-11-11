-- ============================================================================
-- 0028_fix_s03_lessons_rls.sql — S-03 (CAO): siet RLS bang lessons.
--   Van de (PROJECT_AUDIT B-01, SECURITY_REPORT S-03): policy cu
--   "lessons_select_public" (0001) cho anon doc MOI COT cua moi bai
--   thuoc khoa published — anon REST tra du content bai tra phi
--   (chung minh lai 11/11/2026: bai 2, content 269 ky tu).
--   PostgREST/RLS khong chan theo cot trong cung policy, nen phai
--   chan theo DONG + tach duong doc cong khai ra view.
--
--   Sau migration nay:
--   * Bang lessons (REST truc tiep): CHI admin / instructor khoa phu
--     trach / hoc vien co enrollment active|completed cua khoa
--     published moi SELECT duoc dong (ke ca content/video_url/
--     file_url). Anon: 0 dong — ke ca bai xem thu. Hoc vien chua ghi
--     danh: 0 dong doi voi bai tra phi.
--   * View lessons_public (0013, khong doi): duong doc cong khai duy
--     nhat cho metadata (title, loai, thoi luong...) — khong co
--     content / video_url / file_url.
--   * View MOI lessons_preview_video: chi tra video_url cua bai
--     is_free_preview=true thuoc khoa published (mau mien phi, video
--     YouTube unlisted theo QĐ 16 — ai co link deu xem duoc). Day la
--     duong DUY NHAT lay video_url bai xem thu khi chua ghi danh, doc
--     qua API guard /api/lms/lessons/[id] (xem lms-access.ts).
--     Khong tra content / file_url cua bai xem thu o bat ky dau.
--   * Duong doc noi dung that cho hoc vien da ghi danh: GIU NGUYEN
--     qua API guard GET /api/lms/lessons/[lessonId] (server doc bang
--     lessons bang JWT nguoi goi — RLS moi cho phep vi da ghi danh).
--   * Luu y: hoc vien chua ghi danh goi guard cho bai tra phi nay
--     tra 404 not-found (thay vi 403 not-enrolled nhu truoc) vi RLS
--     khong tra dong de guard phan biet; UI van khoa bai nhu cu
--     (client coi ca 403/404 la locked, khong lo noi dung).
--
--   CHI ap STAGING truoc (chua ap prod — cho user nghiem thu).
--   Khong sua file cu (0001–0026).
-- ============================================================================

-- (1) Thay policy cu bang policy chi cho phep doc khi co quyen hoc.
drop policy if exists "lessons_select_public" on public.lessons;
create policy "lessons_select_enrolled" on public.lessons
  for select using (
    exists (
      select 1
      from public.course_modules cm
      join public.courses c on c.id = cm.course_id
      where cm.id = lessons.course_module_id
        and (
          -- Admin xem moi bai, ke ca khoa draft / bai chua xuat ban.
          public.current_role() = 'admin'
          or (
            c.status = 'published'
            and lessons.is_published is not false
            and (
              public.is_instructor_of(c.id)
              or exists (
                select 1 from public.enrollments e
                where e.course_id = c.id
                  and e.user_id = auth.uid()
                  and e.status in ('active', 'completed')
              )
            )
          )
        )
    )
  );

-- (2) View chi tra video_url cua bai xem thu (mau mien phi).
--     View chay voi quyen owner (security_invoker = false mac dinh)
--     nen doc duoc bang goc; truy van truc tiep bang goc van bi RLS
--     o (1) chan. Chi co 2 cot: id + video_url.
create or replace view public.lessons_preview_video as
select
  l.id,
  l.video_url
from public.lessons l
join public.course_modules cm on cm.id = l.course_module_id
join public.courses c on c.id = cm.course_id
where l.is_free_preview = true
  and l.is_published is not false
  and c.status = 'published'
  and l.video_url is not null;
grant select on public.lessons_preview_video to anon, authenticated;

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0028)
--   1. Anon REST: lessons?is_free_preview=eq.false&select=content
--      -- Ky vong: 200, [] (0 dong, khong con content 269 ky tu).
--   2. Anon REST: lessons?select=id,content,video_url,file_url
--      -- Ky vong: 200, [] (0 dong — ke ca bai xem thu).
--   3. Anon REST: lessons_public -- Ky vong: metadata day du, xin
--      content -> 42703 (cot khong ton tai).
--   4. Anon REST: lessons_preview_video -- Ky vong: chi id +
--      video_url cua bai xem thu (neu bai xem thu co video_url).
--   5. Hoc vien da ghi danh (JWT): lessons?select=content -> tra du
--      content bai tra phi cua khoa da ghi danh; bai khoa khac -> [].
--   6. Guard route: GET /api/lms/lessons/<id-bai-tra-phi> voi JWT
--      hoc vien da ghi danh -> 200 ok:true, du content; voi JWT
--      chua ghi danh -> 404; bai xem thu -> 200 ok:true,
--      previewOnly:true, chi co video_url (khong content/file_url).
-- ============================================================================
