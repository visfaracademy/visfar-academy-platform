-- ============================================================================
-- 0011_add_lesson_notes.sql — TASK 07 (phan 1/4): Course Structure +
-- Student Learning.
--
--   (A) Bang moi public.lesson_notes — ghi chu cua hoc vien theo bai hoc.
--   (B) Mo rong CHECK lessons.type them cac loai noi dung Task 07 can:
--       audio / image / pdf / assignment / webinar (0001 chi co
--       video / text / quiz / file). KHONG sua file cu — chi thay
--       constraint o migration moi nay.
--   (C) Kiem tra (khong tao lai): lessons.slug UNIQUE theo module
--       (course_module_id, slug) — QĐ 17 DECISIONS.md, da co tu 0001
--       (unique module_id, slug) va giu nguyen qua 0005 (rename cot).
--       Neu rang buoc nay thieu, migration DUNG LAI de doi soat tay.
--
-- Thu tu chay: sau 0010. Khong phu thuoc du lieu cu.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (C) Kiem tra UNIQUE (course_module_id, slug) tren lessons.
-- ---------------------------------------------------------------------------
do $$
declare
  v_found boolean;
begin
  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'lessons'
      and tc.constraint_type = 'UNIQUE'
    group by tc.constraint_name
    having array_agg(kcu.column_name::text order by kcu.ordinal_position)
           = array['course_module_id', 'slug']
  ) into v_found;
  if not v_found then
    raise exception '0011: lessons.slug KHONG UNIQUE theo module (course_module_id, slug) — dung lai, doi soat lai 0001/0005 truoc khi chay tiep.';
  end if;
  raise notice '0011 (C) OK: lessons.slug UNIQUE theo module.';
end $$;

-- ---------------------------------------------------------------------------
-- (B) Mo rong loai bai hoc (lessons.type).
--     Constraint goc o 0001 la CHECK inline -> Postgres dat ten mac dinh
--     lessons_type_check. Chi thay the neu ten do ton tai; cac dong hien
--     tai deu nam trong tap cu (tap con cua tap moi) nen khong vo du lieu.
-- ---------------------------------------------------------------------------
alter table public.lessons drop constraint if exists lessons_type_check;
alter table public.lessons
  add constraint lessons_type_check
  check (type in ('video', 'text', 'quiz', 'file',
                  'audio', 'image', 'pdf', 'assignment', 'webinar'));

-- ---------------------------------------------------------------------------
-- (A) Bang lesson_notes — 1 ghi chu / 1 hoc vien / 1 bai hoc.
--     Hoc vien sua ghi chu = upsert (ghi de ban cu, giu lai ban moi nhat);
--     lich su phien ban cu khong luu o bang nay.
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  content text not null default ''
    check (char_length(content) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index if not exists idx_lesson_notes_user
  on public.lesson_notes (user_id, lesson_id);
create index if not exists idx_lesson_notes_lesson
  on public.lesson_notes (lesson_id);

alter table public.lesson_notes enable row level security;

-- Hoc vien: toan quyen tren ghi chu cua CHINH MINH, khong thay ghi chu
-- cua nguoi khac. Admin: chi doc (doi soat / ho tro).
create policy "lesson_notes_own" on public.lesson_notes
  for all using (user_id = auth.uid());
create policy "lesson_notes_admin_read" on public.lesson_notes
  for select using (public.current_role() = 'admin');
