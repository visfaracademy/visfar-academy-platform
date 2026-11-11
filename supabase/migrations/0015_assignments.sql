-- ============================================================================
-- Visfar Academy — Task 08 (ASSIGNMENT) — Migration 0015
-- BO SUNG CHO BAI TAP / BAI NOP / CHAM BAI
-- ----------------------------------------------------------------------------
-- Ngay: 10/11/2026.
-- Phu thuoc: 0004 (bang assignments / submissions / submission_reviews),
-- 0006 (RLS cho 3 bang do). KHONG phu thuoc noi dung 0014 (neu co task
-- song song giu so 0014): file nay chi cham vao 3 bang bai tap + bang
-- file dinh kem moi + bucket 'submissions'. Chay sau 0004/0006.
-- NGUYEN TAC: chi them cot/bang/policy/trigger; KHONG sua migration cu;
-- moi thay doi deu co guard (IF NOT EXISTS / kiem tra information_schema)
-- de chay lai an toan (idempotent) tren staging lan dau ap.
--
-- QUYET DINH DA CHOT AP DUNG O DAY:
--   * DECISIONS.md — Task 03 QĐ 10: hoc vien DUOC nop lai bai tap,
--     giang vien DUOC cham lai. Vi vay:
--       - Nop lai = tao submission MOI (lich su cu giu lai, khong xoa,
--         giong ghi chu 0006 muc 2.10); khong co UNIQUE
--         (assignment_id, user_id) chan nop lai.
--       - Cham lai = them submission_reviews MOI (khong UNIQUE
--         (submission_id)); review moi nhat (reviewed_at DESC) la ket
--         qua hien hanh; trigger dong bo submissions.status/graded_at
--         theo review moi nhat.
--   * DATABASE_SCHEMA.md §3.15–§3.17: trang thai submission
--     draft/submitted/graded/returned; assignments co assignment_type,
--     max_score, due_at, allow_late_submission; submission_reviews co
--     score <= max_score, feedback, status graded/returned.
--   * Luu y lech so voi 0004 (ghi ro de khoi hieu lam):
--       - 0004 dung cot `content` (khong co `content_text` nhu schema
--         §3.16), status cu gom under_review/needs_revision/
--         resubmitted, khong co is_late/graded_at, khong co bang file
--         dinh kem rieng, khong co assignment_type/allow_late/
--         status o assignments (chi co is_published boolean).
--       - File nay bo sung / chuyen doi cac cho do, GIU LAI cot cu
--         (`content`, `file_url`, `is_published`) de code cu khong vo;
--         dong bo 2 chieu bang trigger (muc B2, A2).
-- ============================================================================

-- ============================================================================
-- MUC A — assignments: loai bai tap, cho nop muon, trang thai
-- ============================================================================

-- A1. Cot moi (guard IF NOT EXISTS — chay lai an toan).
alter table public.assignments
  add column if not exists assignment_type text not null default 'essay'
    check (assignment_type in ('essay', 'file_upload', 'mixed'));
alter table public.assignments
  add column if not exists allow_late_submission boolean not null default false;
alter table public.assignments
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published', 'archived'));
comment on column public.assignments.assignment_type is
  'essay = viet truc tiep; file_upload = nop file; mixed = ca hai.';
comment on column public.assignments.allow_late_submission is
  'true = cho nop sau due_at; bai nop muon danh dau is_late o submissions.';
comment on column public.assignments.status is
  'draft = chua mo; published = dang mo nhan bai; archived = dong (chi xem lich su).';

-- A2. Backfill status tu is_published (chi dong nao chua co status hop le),
--     roi dong bo 2 chieu is_published <-> status bang trigger (code cu
--     doc is_published nhu learning.ts, code moi doc status).
update public.assignments
  set status = case when is_published then 'published' else 'draft' end
  where status = 'published' and not is_published;
--    (dong is_published = true giu 'published' mac dinh; dong false ve 'draft')

create or replace function public.sync_assignment_published()
returns trigger
language plpgsql
as $$
begin
  -- status doi -> is_published theo; is_published doi truc tiep -> status theo.
  if new.status is distinct from old.status then
    new.is_published := (new.status = 'published');
  elsif new.is_published is distinct from old.is_published then
    new.status := case when new.is_published then 'published' else 'draft' end;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_assignments_sync_published on public.assignments;
create trigger trg_assignments_sync_published
  before update of status, is_published on public.assignments
  for each row execute function public.sync_assignment_published();

create index if not exists idx_assignments_status
  on public.assignments (course_id, status);

-- ============================================================================
-- MUC B — submissions: content_text, is_late, graded_at, trang thai moi
--   (draft/submitted/graded/returned) + trigger chan nop muon + dong bo
-- ============================================================================

-- B1. Cot moi.
alter table public.submissions
  add column if not exists content_text text;
alter table public.submissions
  add column if not exists is_late boolean not null default false;
alter table public.submissions
  add column if not exists graded_at timestamptz;
comment on column public.submissions.content_text is
  'Noi dung bai viet truc tiep (tu luan). Dong bo 2 chieu voi cot cu content (B2).';
comment on column public.submissions.is_late is
  'true khi submitted_at > assignments.due_at (chi xay ra khi allow_late_submission).';
comment on column public.submissions.graded_at is
  'Thoi diem cham xong — dong bo tu submission_reviews.reviewed_at (muc D).';

-- B2. Backfill content_text tu content, roi trigger dong bo 2 chieu.
update public.submissions
  set content_text = content
  where content_text is null and content is not null;

create or replace function public.sync_submission_content()
returns trigger
language plpgsql
as $$
begin
  new.content_text := coalesce(new.content_text, new.content);
  new.content := coalesce(new.content, new.content_text);
  return new;
end;
$$;
drop trigger if exists trg_submissions_sync_content on public.submissions;
create trigger trg_submissions_sync_content
  before insert or update of content, content_text on public.submissions
  for each row execute function public.sync_submission_content();

-- B3. Chuyen doi trang thai cu sang bo 4 trang thai chuan, truoc khi doi CHECK.
--     under_review -> submitted (dang cho cham, van la bai da nop);
--     needs_revision -> returned (tra lai lam lai);
--     resubmitted -> submitted (ban nop moi nhat, lich su giu o dong cu).
update public.submissions set status = 'submitted'
  where status in ('under_review', 'resubmitted');
update public.submissions set status = 'returned'
  where status = 'needs_revision';

-- B4. Thay CHECK cu bang CHECK moi (draft/submitted/graded/returned).
--     Ten constraint cu la ten tu dong (Postgres dat), nen tim + drop theo
--     dinh nghia trong pg_constraint (khong hard-code ten). Postgres luu
--     `check (status in (...))` duoi dang `CHECK ((status = ANY (ARRAY...)))`
--     nen khop theo mau do.
do $$
declare
  v_con name;
begin
  for v_con in
    select conname from pg_constraint
    where conrelid = 'public.submissions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%=%any%array%'
  loop
    execute format('alter table public.submissions drop constraint %I', v_con);
    raise notice 'B4: da drop CHECK cu % tren submissions.', v_con;
  end loop;
end $$;
alter table public.submissions
  add constraint submissions_status_check
    check (status in ('draft', 'submitted', 'graded', 'returned'));

-- B5. Backfill is_late cho du lieu cu (chi dong da nop sau han, khoa co han).
update public.submissions s
  set is_late = true
  from public.assignments a
  where s.assignment_id = a.id
    and a.due_at is not null
    and s.submitted_at > a.due_at
    and s.status <> 'draft';

-- B6. Trigger chan nop muon + tu danh dau is_late (lop chan cuoi o DB,
--     API cung kiem tra lai — khong tin client).
--     - Draft duoc tao/sua bat ky luc nao (chua phai bai nop).
--     - Bai submitted sau due_at ma khong cho nop muon -> LOI (exception).
--     - Bai submitted sau due_at khi cho nop muon -> is_late = true.
create or replace function public.enforce_submission_due()
returns trigger
language plpgsql
as $$
declare
  v_due timestamptz;
  v_allow boolean;
begin
  if new.status = 'draft' then
    return new;
  end if;
  select a.due_at, a.allow_late_submission into v_due, v_allow
    from public.assignments a where a.id = new.assignment_id;
  if v_due is not null and new.submitted_at > v_due then
    if not coalesce(v_allow, false) then
      raise exception 'assignment_overdue: bai tap % da qua han nop %',
        new.assignment_id, v_due
        using errcode = 'check_violation';
    end if;
    new.is_late := true;
  else
    new.is_late := false;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_submissions_enforce_due on public.submissions;
create trigger trg_submissions_enforce_due
  before insert or update of status, submitted_at on public.submissions
  for each row execute function public.enforce_submission_due();

-- B7. Index lich su nop: giang vien xem bai nop cua 1 bai tap theo hoc vien
--     + moi nhat truoc (trang cham bai sap xep theo hoc vien).
create index if not exists idx_submissions_assignment_user
  on public.submissions (assignment_id, user_id, submitted_at desc);

-- ============================================================================
-- MUC C — submission_files: file dinh kem bai nop (nhieu file / 1 bai)
--   Chi luu STORAGE PATH (vd 'uid/assignmentId/submissionId/ten-file.pdf'),
--   KHONG luu URL goc / signed URL — client chi tai qua API route
--   /api/v1/assignments/[id]/files/[fileId]/download (stream qua server).
-- ============================================================================
create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size_bytes integer not null default 0 check (file_size_bytes >= 0),
  mime_type text,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.submission_files.storage_path is
  'Duong dan trong bucket private submissions. KHONG phai URL — khong tra ve client.';
create index if not exists idx_submission_files_submission
  on public.submission_files (submission_id, created_at);
create index if not exists idx_submission_files_path
  on public.submission_files (storage_path);

alter table public.submission_files enable row level security;

-- C1. RLS submission_files: chu bai nop xem/tai file cua minh; giang vien
--     khoa phu trach + admin xem/tai de cham; chi chu bai nop duoc them file
--     (qua API route — API dung JWT nguoi goi, RLS van ap dung).
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'submission_files'
                   and policyname = 'submission_files_select') then
    create policy "submission_files_select" on public.submission_files
      for select using (
        exists (select 1 from public.submissions s
                where s.id = submission_files.submission_id
                  and s.user_id = auth.uid())
        or exists (select 1 from public.submissions s
                   join public.assignments a on a.id = s.assignment_id
                   where s.id = submission_files.submission_id
                     and public.is_instructor_of(a.course_id))
        or public.current_role() = 'admin'
      );
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'submission_files'
                   and policyname = 'submission_files_insert_own') then
    create policy "submission_files_insert_own" on public.submission_files
      for insert with check (
        uploaded_by = auth.uid()
        and exists (select 1 from public.submissions s
                    where s.id = submission_files.submission_id
                      and s.user_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'submission_files'
                   and policyname = 'submission_files_delete_own') then
    create policy "submission_files_delete_own" on public.submission_files
      for delete using (
        uploaded_by = auth.uid()
        and exists (select 1 from public.submissions s
                    where s.id = submission_files.submission_id
                      and s.user_id = auth.uid()
                      and s.status = 'draft')
      );
  end if;
end $$;

-- C2. Cho hoc vien sua nhap cua CHINH MINH (chi khi con draft) — can de
--     luu nhap / nop lai tu nhap; bai da submitted chi nop lai bang dong moi.
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'submissions'
                   and policyname = 'submissions_update_own_draft') then
    create policy "submissions_update_own_draft" on public.submissions
      for update using (
        user_id = auth.uid() and status = 'draft'
      )
      with check (
        user_id = auth.uid()
      );
  end if;
end $$;

-- ============================================================================
-- MUC D — submission_reviews: trang thai graded/returned + trigger dong bo
--   submissions.status / graded_at theo review moi nhat (cham lai duoc).
-- ============================================================================

-- D1. Chuyen doi trang thai cu: needs_revision -> returned, approved -> graded.
update public.submission_reviews set status = 'returned'
  where status = 'needs_revision';
update public.submission_reviews set status = 'graded'
  where status = 'approved';

-- D2. Thay CHECK cu bang CHECK moi (graded/returned).
do $$
declare
  v_con name;
begin
  for v_con in
    select conname from pg_constraint
    where conrelid = 'public.submission_reviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%=%any%array%'
  loop
    execute format('alter table public.submission_reviews drop constraint %I', v_con);
    raise notice 'D2: da drop CHECK cu % tren submission_reviews.', v_con;
  end loop;
end $$;
alter table public.submission_reviews
  add constraint submission_reviews_status_check
    check (status in ('graded', 'returned'));

-- D3. Trigger: review moi (hoac sua review) -> submissions cua bai do doi
--     status/graded_at theo review moi nhat. SECURITY DEFINER de vuot RLS
--     khi hoc vien/giao vien ghi review (review insert da qua policy
--     submission_reviews_instructor_manage o 0006).
create or replace function public.sync_submission_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.submissions
    set status = new.status,
        graded_at = new.reviewed_at,
        updated_at = now()
    where id = new.submission_id;
  return new;
end;
$$;
drop trigger if exists trg_submission_reviews_sync on public.submission_reviews;
create trigger trg_submission_reviews_sync
  after insert or update of status, reviewed_at on public.submission_reviews
  for each row execute function public.sync_submission_review();

create index if not exists idx_submission_reviews_reviewer
  on public.submission_reviews (reviewer_id, reviewed_at desc);

-- ============================================================================
-- MUC E — Bucket Storage private 'submissions' + policy Storage
--   (mau theo 0007 muc (f) + 0010: guard khi schema storage chua ton tai;
--   policy chi tao khi bang storage.objects ton tai).
--   Duong dan: <user_id>/<assignment_id>/<submission_id>/<ten-file>
--   - Hoc vien: upload/xoa file trong thu muc cua minh; doc file minh nop.
--   - Giang vien khoa phu trach + admin: doc file de cham (qua EXISTS
--     vao submission_files -> submissions -> assignments).
--   Bucket private: khong co URL cong khai — tai chi qua API route.
-- ============================================================================
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'storage' and table_name = 'buckets') then
    raise notice '(E) BO QUA: schema storage / bang storage.buckets khong ton tai — bat Storage tren Supabase truoc roi chay lai 0015.';
  else
    execute 'insert into storage.buckets (id, name, public) values '
         || '(''submissions'', ''submissions'', false) '
         || 'on conflict (id) do nothing';
    raise notice '(E) OK: bucket private submissions da co (ON CONFLICT DO NOTHING).';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'storage' and table_name = 'objects') then
    raise notice '(E) BO QUA policy Storage: bang storage.objects khong ton tai.';
  else
    -- Insert: chi chu file (folder dau = auth.uid()).
    if not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and policyname = 'submissions_insert_own') then
      create policy "submissions_insert_own" on storage.objects
        for insert with check (
          bucket_id = 'submissions'
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    end if;
    -- Select: chu file, hoac giang vien khoa phu trach / admin (de cham bai).
    if not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and policyname = 'submissions_select') then
      create policy "submissions_select" on storage.objects
        for select using (
          bucket_id = 'submissions'
          and (
            (storage.foldername(name))[1] = auth.uid()::text
            or exists (
              select 1 from public.submission_files sf
              join public.submissions s on s.id = sf.submission_id
              join public.assignments a on a.id = s.assignment_id
              where sf.storage_path = storage.objects.name
                and (public.is_instructor_of(a.course_id)
                     or public.current_role() = 'admin')
            )
          )
        );
    end if;
    -- Update: chu file (ghi de khi upload lai cung ten).
    if not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and policyname = 'submissions_update_own') then
      create policy "submissions_update_own" on storage.objects
        for update using (
          bucket_id = 'submissions'
          and (storage.foldername(name))[1] = auth.uid()::text
        )
        with check (
          bucket_id = 'submissions'
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    end if;
    -- Delete: chu file (chi khi bai con draft — rang buoc o lop API/RLS bang).
    if not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and policyname = 'submissions_delete_own') then
      create policy "submissions_delete_own" on storage.objects
        for delete using (
          bucket_id = 'submissions'
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    end if;
    raise notice '(E) OK: 4 policy Storage cho bucket submissions da co.';
  end if;
end $$;

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0015 — KHONG chay tu dong)
--   1. Cot moi assignments:
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name='assignments'
--          and column_name in ('assignment_type','allow_late_submission','status');
--        -- 3 dong.
--   2. Cot moi submissions:
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name='submissions'
--          and column_name in ('content_text','is_late','graded_at');
--        -- 3 dong. CHECK moi:
--        select pg_get_constraintdef(oid) from pg_constraint
--        where conrelid='public.submissions'::regclass
--          and conname='submissions_status_check';
--        -- phai chua draft/submitted/graded/returned.
--   3. Bang + RLS submission_files:
--        select count(*) from pg_policies where tablename='submission_files';
--        -- >= 3 policy (select/insert/delete). Bucket:
--        select id, public from storage.buckets where id='submissions';
--        -- 1 dong, public = false.
--   4. CHECK reviews moi:
--        select pg_get_constraintdef(oid) from pg_constraint
--        where conrelid='public.submission_reviews'::regclass
--          and conname='submission_reviews_status_check';
--        -- phai chua graded/returned.
--   5. Thu nop muon bi chan (can 1 assignment co due_at qua + allow_late=false):
--        insert into submissions (assignment_id, user_id, content_text, status, submitted_at)
--        values ('<assignment-id>', auth.uid(), 'thu', 'submitted', now());
--        -- Ky vong: LOI assignment_overdue. Draft cung du lieu thi OK:
--        --   status='draft' -> thanh cong, sau do xoa dong test.
--   6. Khong lo URL goc: submissions.file_url / submission_files.storage_path
--      khong bao gio xuat hien trong response API (chi id + ten file + link
--      /api/v1/assignments/[id]/files/[fileId]/download).
-- ============================================================================
