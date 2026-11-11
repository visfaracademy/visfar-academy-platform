-- ============================================================================
-- 0013_admin_lms.sql — TASK 07 (phan 3/4): SECURITY + ADMIN
--
--   (A) Admin tang khoa (DECISIONS.md Task 02 QĐ 7, Task 03 §5):
--       enrollments.granted_by + enrollments.grant_reason (bat buoc khi
--       tang qua API admin; don tra binh thuong de NULL).
--   (B) Thu hoi quyen hoc: certificates.status ('valid' / 'revoked') de
--       thu hoi chung chi cung luc thu hoi enrollment.
--   (C) Trang thai xuat ban cap bai: lessons.is_published (courses da co
--       status draft/published/archived, course_modules da co is_published).
--   (D) RLS cho duong ghi admin qua JWT (khong co Workers service-role o
--       apps/web): admin duoc INSERT enrollments (tang khoa) va INSERT
--       audit_logs (actor_id = chinh admin). Khong co policy nay thi moi
--       thao tac admin o /admin deu bi RLS chan (0001 chi co
--       audit_logs_admin_read; 0009 da xoa enrollments_insert_own).
--   (E) KIEM TRA / KHANG DINH ham is_instructor_of (SUA NGAY 10/11/2026):
--       Ban goc cua muc nay viet sai tien de: bang course_instructors
--       (0004 muc 20) chi co cot user_id, KHONG co instructor_id, va
--       ham is_instructor_of() + 2 policy o 0006 DA DUNG user_id dung.
--       Chay thu 0013 lan 1 tren staging loi 42703
--       (column ci.instructor_id does not exist) da chung minh dieu do.
--       Vi vay muc (E) chi tao lai ham + policy VOI COT user_id DUNG
--       (giong het 0006, idempotent), khong doi ten cot nao.
--   (F) Bao ve tai lieu tra phi: lesson_resources_select_public (0006)
--       cho bat ky ai doc file_url cua khoa published — ke ca chua ghi
--       danh. Thu hep: chi free-preview, hoc vien da ghi danh
--       (active/completed), instructor khoa phu trach, admin.
--   (G) View lessons_public (khong co content / video_url / file_url)
--       cho danh sach bai cong khai — duong doc metadata an toan, URL
--       nhay cam chi tra qua API route co kiem tra enrollment.
--
-- NGUYEN TAC: KHONG sua file cu (0001–0011). Idempotent o muc co the
-- (IF NOT EXISTS / DROP POLICY IF EXISTS / guard theo pg_catalog).
-- KHONG CHAY len DB that khi viet file nay; ap staging truoc, kiem
-- chung theo muc KIEM CHUNG cuoi file, roi moi len prod.
-- Thu tu chay: sau 0011 (va 0012 neu co). Khong phu thuoc du lieu cu.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) enrollments.granted_by / grant_reason — admin tang khoa
-- ---------------------------------------------------------------------------
alter table public.enrollments
  add column if not exists granted_by uuid references public.profiles (id) on delete set null;
alter table public.enrollments
  add column if not exists grant_reason text;

-- ---------------------------------------------------------------------------
-- (B) certificates.status — thu hoi chung chi khi thu hoi enrollment
-- ---------------------------------------------------------------------------
alter table public.certificates
  add column if not exists status text not null default 'valid';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.certificates'::regclass
      and conname = 'certificates_status_check'
  ) then
    alter table public.certificates
      add constraint certificates_status_check
      check (status in ('valid', 'revoked'));
  end if;
end $$;

create index if not exists idx_certificates_user_course_status
  on public.certificates (user_id, course_id, status);

-- ---------------------------------------------------------------------------
-- (C) lessons.is_published — xuat ban / an bai hoc cap bai
-- ---------------------------------------------------------------------------
alter table public.lessons
  add column if not exists is_published boolean not null default true;

-- ---------------------------------------------------------------------------
-- (D) RLS: admin INSERT enrollments + INSERT audit_logs qua JWT
-- ---------------------------------------------------------------------------
-- Tang khoa: chi admin, actor phai la nguoi tang (granted_by = auth.uid()).
-- Don tra / khoa mien phi van tao qua Workers service-role (bypass RLS).
drop policy if exists "enrollments_insert_admin" on public.enrollments;
create policy "enrollments_insert_admin" on public.enrollments
  for insert with check (
    public.current_role() = 'admin'
    and granted_by = auth.uid()
  );

-- Audit log: chi admin, actor_id phai la chinh admin goi.
-- Moi thao tac ghi o /admin deu insert 1 dong vao day (xem lms-admin.ts).
drop policy if exists "audit_logs_insert_admin" on public.audit_logs;
create policy "audit_logs_insert_admin" on public.audit_logs
  for insert with check (
    public.current_role() = 'admin'
    and actor_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- (E) SUA LOI 0006: is_instructor_of + 2 policy dung sai cot user_id
--     (bang course_instructors chi co user_id — xem 0004 muc 20; 0006 da dung dung)
-- ---------------------------------------------------------------------------
create or replace function public.is_instructor_of(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_instructors ci
    where ci.course_id = p_course_id
      and ci.user_id = auth.uid()
  );
$$;

drop policy if exists "course_instructors_select_own" on public.course_instructors;
create policy "course_instructors_select_own" on public.course_instructors
  for select using (
    user_id = auth.uid() or public.current_role() = 'admin'
  );

drop policy if exists "profiles_instructor_read_students" on public.profiles;
create policy "profiles_instructor_read_students" on public.profiles
  for select using (
    exists (select 1 from public.enrollments e
            join public.course_instructors ci on ci.course_id = e.course_id
            where e.user_id = profiles.id
              and ci.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- (F) lesson_resources: thu hep SELECT — khong con doc file_url cong khai
-- ---------------------------------------------------------------------------
drop policy if exists "lesson_resources_select_public" on public.lesson_resources;
create policy "lesson_resources_select_enrolled_or_preview" on public.lesson_resources
  for select using (
    public.current_role() = 'admin'
    or public.is_instructor_of(public.course_of_lesson(lesson_resources.lesson_id))
    -- Tai lieu xem thu: chi khi bai thuoc khoa published.
    or (
      lesson_resources.is_free_preview = true
      and exists (select 1 from public.lessons l
                  join public.course_modules cm on cm.id = l.course_module_id
                  join public.courses c on c.id = cm.course_id
                  where l.id = lesson_resources.lesson_id
                    and c.status = 'published')
    )
    -- Hoc vien da ghi danh (active/completed) khoa chua bai hoc.
    or exists (select 1 from public.lessons l
               join public.course_modules cm on cm.id = l.course_module_id
               join public.enrollments e on e.course_id = cm.course_id
               where l.id = lesson_resources.lesson_id
                 and e.user_id = auth.uid()
                 and e.status in ('active', 'completed'))
  );

-- ---------------------------------------------------------------------------
-- (G) View lessons_public — metadata bai hoc, KHONG co URL / noi dung nhay cam
--     (content, video_url, file_url chi tra qua API route /api/lms/lessons/*
--      sau khi kiem tra enrollment o server — xem src/lib/lms-access.ts)
-- ---------------------------------------------------------------------------
create or replace view public.lessons_public as
select
  l.id,
  l.course_module_id,
  l.slug,
  l.title,
  l.type,
  l.video_duration_sec,
  l.display_order,
  l.is_free_preview,
  l.is_published,
  l.created_at,
  l.updated_at
from public.lessons l;
grant select on public.lessons_public to anon, authenticated;

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0013)
--   1. Cot moi ton tai:
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name='enrollments'
--          and column_name in ('granted_by','grant_reason');  -- 2 dong
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name='certificates'
--          and column_name='status';                          -- 1 dong
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name='lessons'
--          and column_name='is_published';                    -- 1 dong
--   2. Ham instructor sua dung cot:
--        select prosrc from pg_proc where proname='is_instructor_of';
--        -- phai chua 'user_id', khong chua 'instructor_id' (cot do khong ton tai).
--   3. Anon doc lesson_resources cua khoa published (chua ghi danh):
--        select * from lesson_resources where is_free_preview = false;
--        -- Ky vong: 0 dong (chi free-preview tra ve).
--   4. Admin JWT insert audit_logs voi actor_id = auth.uid():
--        insert into audit_logs (actor_id, action, target_type)
--        values (auth.uid(), 'test.ping', 'test') returning id;
--        -- Ky vong: thanh cong. Sau do xoa dong test.
--   5. Student JWT insert enrollments truc tiep:
--        insert into enrollments (user_id, course_id, status)
--        values (auth.uid(), '<1 khoa>', 'active');
--        -- Ky vong: LOI (khong co policy INSERT cho student — 0009 + 0013).
--   6. View khong lo URL:
--        select * from lessons_public limit 1;
--        -- Ky vong: khong co cot content / video_url / file_url.
-- ============================================================================
