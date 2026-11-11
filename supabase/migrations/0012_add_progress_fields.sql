-- ============================================================================
-- Visfar Academy — Migration 0012 — Task 07 (2/4) Learning Progress
-- Ngay: 10/11/2026
--
-- MUC DICH: bo sung cac truong tien do hoc tap con thieu cho bang
-- lesson_progress (theo yeu cau Task 07 + DECISIONS.md QĐ 17):
--   user_id, course_id, lesson_id, started_at, last_accessed,
--   completed_at, video_position, completion_status
--
-- DOI CHIEU SCHEMA CU (0001_init_schema.sql):
--   lesson_progress DA CO: user_id, lesson_id, status, progress_percent,
--   last_position_sec, completed_at, created_at, updated_at,
--   unique (user_id, lesson_id).
--   THIEU (them o file nay): course_id, started_at, last_accessed,
--   video_position, completion_status.
--   KHONG DOI TEN / KHONG XOA cot cu: status va last_position_sec duoc
--   GIU LAI lam cot legacy, dong bo 2 chieu voi completion_status /
--   video_position bang trigger (code Task 06 — dashboard.ts — van doc
--   status / progress_percent nen khong duoc vo).
--
-- QUYET DINH 17 (DECISIONS.md): lessons.slug UNIQUE theo module (khong
-- theo khoa). 0001 tao unique (module_id, slug), 0005 doi ten cot thanh
-- course_module_id — constraint tu chay theo. File nay KHONG tao lai
-- constraint do, chi KIEM TRA su ton tai cua no o muc 5 (notice).
--
-- CHONG GIAN LAN / RLS — DOC KY TRUOC KHI SUA:
--   1. Migration 0009 (H3) da XOA policy "progress_own" FOR ALL va chi
--      de lai "progress_select_own" (SELECT cua minh) + "progress_admin_read".
--      File nay KHONG them bat ky policy INSERT/UPDATE nao cho client:
--      ghi tien do CHI di qua Workers API bang service-role (xem
--      apps/web/src/lib/progress.ts — POST /api/v1/progress). Mo lai
--      ghi truc tiep tu client se khoi dong lai lo H3 (hoc vien tu ghi
--      100% chua hoc) — CAM them policy ghi o day.
--   2. Trigger trg_progress_sync_guard (muc 3) la lop chan CUOI, chay
--      ca voi service-role: video chi duoc 'completed' khi xem >= 90%
--      (QĐ 17); video_position khong vuot qua do dai video (+10s dung
--      sai); course_id phai khop khoa cua lesson; progress_percent cua
--      bai video duoc server TINH LAI tu video_position / duration —
--      client khong the khai percent 100 trong khi position moi 5 giay.
--      Workers API VAN phai validate lai (enrollment, JWT, nguong)
--      truoc khi ghi — trigger chi la phong thu chieu sau, khong thay
--      the validate o Workers.
--
-- NGUYEN TAC: khong sua migration cu; idempotent (IF NOT EXISTS /
-- DROP IF EXISTS + CREATE, guard to_regclass); chay lai an toan.
-- KHONG chay len DB that khi viet file nay; ap dung staging truoc.
-- ============================================================================

-- ============================================================================
-- MUC 1 — Them cot moi (neu chua co)
-- ============================================================================
alter table public.lesson_progress
  add column if not exists course_id uuid references public.courses (id) on delete cascade,
  add column if not exists started_at timestamptz,
  add column if not exists last_accessed timestamptz,
  add column if not exists video_position integer check (video_position >= 0),
  add column if not exists completion_status text
    check (completion_status in ('not_started', 'in_progress', 'completed'));

comment on column public.lesson_progress.course_id is
  'Khoa cua lesson — du thua co chu dich de truy van tien do theo khoa ma khong join qua lessons/course_modules. Trigger trg_progress_sync_guard tu dien neu NULL va chan neu khac khoa cua lesson.';
comment on column public.lesson_progress.started_at is
  'Lan dau mo bai (dat o lan ghi dau tien, khong doi sau do).';
comment on column public.lesson_progress.last_accessed is
  'Lan mo / cap nhat tien do gan nhat — trigger cap nhat = now() moi lan UPDATE.';
comment on column public.lesson_progress.video_position is
  'Vi tri video hien tai (giay). Dong bo 2 chieu voi cot legacy last_position_sec.';
comment on column public.lesson_progress.completion_status is
  'Trang thai hoan thanh chuan (QĐ 17): not_started / in_progress / completed. Dong bo 2 chieu voi cot legacy status.';

-- ============================================================================
-- MUC 2 — Backfill tu du lieu cu + tu lessons/course_modules
--   course_id: suy tu lessons -> course_modules -> courses.
--   Ten cot FK cua lessons phu thuoc 0005 da chay hay chua
--   (course_module_id neu da chay, module_id neu chua) — xac dinh dong.
-- ============================================================================
do $$
declare
  v_lesson_module_col text;
  v_backfilled bigint;
begin
  if to_regclass('public.lesson_progress') is null then
    raise notice '(muc 2) BO QUA: bang lesson_progress chua ton tai.';
    return;
  end if;

  select column_name into v_lesson_module_col
  from information_schema.columns
  where table_schema = 'public' and table_name = 'lessons'
    and column_name in ('course_module_id', 'module_id')
  order by case column_name when 'course_module_id' then 0 else 1 end
  limit 1;

  if v_lesson_module_col is null then
    raise notice '(muc 2) BO QUA: khong tim thay cot module cua lessons.';
    return;
  end if;

  execute format(
    'update public.lesson_progress lp
        set course_id = cm.course_id
       from public.lessons l
       join public.course_modules cm on cm.id = l.%I
      where lp.lesson_id = l.id and lp.course_id is null',
    v_lesson_module_col);
  get diagnostics v_backfilled = row_count;
  raise notice '(muc 2) OK: backfill course_id cho % dong (cot lessons.%I).',
    v_backfilled, v_lesson_module_col;

  -- Cot moi con lai lay tu cot legacy tuong duong.
  update public.lesson_progress
     set started_at = coalesce(started_at, created_at),
         last_accessed = coalesce(last_accessed, updated_at),
         video_position = coalesce(video_position, last_position_sec),
         completion_status = coalesce(completion_status, status, 'not_started')
   where started_at is null
      or last_accessed is null
      or video_position is null
      or completion_status is null;
  raise notice '(muc 2) OK: backfill started_at/last_accessed/video_position/completion_status.';

  -- Chi dat NOT NULL cho course_id khi backfill day du — neu con dong
  -- lech (lesson khong thuoc khoa nao), de NULL + notice de xu ly tay,
  -- khong lam migration that bai; trigger o muc 3 se tu dien course_id
  -- cho moi dong ghi moi.
  if not exists (select 1 from public.lesson_progress where course_id is null) then
    alter table public.lesson_progress alter column course_id set not null;
    raise notice '(muc 2) OK: course_id NOT NULL (backfill day du).';
  else
    raise notice '(muc 2) CANH BAO: con dong lesson_progress co course_id NULL (lesson lech khoa) — giu nullable, can doi chieu tay truoc khi dat NOT NULL.';
  end if;
end $$;

-- ============================================================================
-- MUC 3 — Trigger dong bo legacy <-> moi + chan gian lan (server-side)
--   Chay BEFORE INSERT OR UPDATE, ca voi service-role (Workers).
--   a. course_id: tu dien tu lesson; sai khoa -> exception.
--   b. status <-> completion_status, last_position_sec <-> video_position:
--      ben nao thay doi thi ben kia chay theo; INSERT lay gia tri co san.
--   c. last_accessed = now() moi lan UPDATE; started_at chi dat 1 lan.
--   d. completed_at: tu dat khi chuyen sang completed, xoa khi roi khoi.
--   e. Video 'completed' chi khi progress_percent >= 90% HOAC
--      video_position / video_duration_sec >= 90% (QĐ 17).
--      Chi mo video KHONG tu hoan thanh — trigger khong tu dat
--      completed khi chi co position/percent < 90%.
--   f. progress_percent cua bai video duoc server TINH LAI tu
--      video_position / video_duration_sec (khi biet duration) — client
--      khai percent tuy y khong co tac dung.
--   g. video_position vuot duration + 10s (dung sai lam tron) -> exception.
-- ============================================================================
create or replace function public.sync_and_guard_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_lesson_type text;
  v_duration integer;
begin
  -- Lay khoa / loai / do dai cua lesson (join dung ten cot sau 0005;
  -- neu 0005 chua chay, cot van la module_id — xu ly ca 2 truong hop).
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'lessons'
               and column_name = 'course_module_id') then
    select cm.course_id, l.type, l.video_duration_sec
      into v_course_id, v_lesson_type, v_duration
      from public.lessons l
      join public.course_modules cm on cm.id = l.course_module_id
     where l.id = new.lesson_id;
  else
    select cm.course_id, l.type, l.video_duration_sec
      into v_course_id, v_lesson_type, v_duration
      from public.lessons l
      join public.course_modules cm on cm.id = l.module_id
     where l.id = new.lesson_id;
  end if;

  -- (a) course_id: tu dien / kiem tra khop khoa cua lesson.
  if new.course_id is null then
    new.course_id := v_course_id;
  elsif v_course_id is not null and new.course_id is distinct from v_course_id then
    raise exception 'course_id khong khop khoa cua lesson (lesson % thuoc khoa %, nhan %).',
      new.lesson_id, v_course_id, new.course_id;
  end if;

  -- (b) Dong bo 2 chieu legacy <-> moi.
  if TG_OP = 'INSERT' then
    new.completion_status := coalesce(new.completion_status, new.status, 'not_started');
    new.status := new.completion_status;
    new.video_position := coalesce(new.video_position, new.last_position_sec);
    new.last_position_sec := new.video_position;
    new.started_at := coalesce(new.started_at, new.created_at, now());
    new.last_accessed := coalesce(new.last_accessed, now());
  else
    if new.completion_status is distinct from old.completion_status then
      new.status := new.completion_status;
    elsif new.status is distinct from old.status then
      new.completion_status := new.status;
    end if;
    if new.video_position is distinct from old.video_position then
      new.last_position_sec := new.video_position;
    elsif new.last_position_sec is distinct from old.last_position_sec then
      new.video_position := new.last_position_sec;
    end if;
    -- (c) Moi lan UPDATE la 1 lan cham tien do.
    new.last_accessed := now();
  end if;

  -- (d) completed_at theo completion_status.
  if new.completion_status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  elsif new.completion_status is distinct from 'completed' then
    new.completed_at := null;
  end if;

  -- (f) Server tinh lai percent cho bai video khi biet duration.
  --     LAM TRON XUONG (floor) — giong progress.ts videoProgressPercent:
  --     539/600 giay = 89,83% that -> 89%, chua dat nguong 90%.
  if v_lesson_type = 'video' and v_duration is not null and v_duration > 0
     and new.video_position is not null then
    new.progress_percent :=
      greatest(0, least(100, floor(new.video_position::numeric / v_duration * 100)::integer));
  end if;

  -- (g) Position vuot duration + 10s -> khong hop le.
  if v_lesson_type = 'video' and v_duration is not null and v_duration > 0
     and new.video_position is not null and new.video_position > v_duration + 10 then
    raise exception 'video_position (% giay) vuot qua do dai video (% giay).',
      new.video_position, v_duration;
  end if;

  -- (e) Video chi 'completed' khi >= 90% (QĐ 17).
  if v_lesson_type = 'video' and new.completion_status = 'completed'
     and coalesce(new.progress_percent, 0) < 90 then
    raise exception 'Bai video chi duoc danh dau hoan thanh khi xem >= 90%% (hien tai %% %).',
      new.progress_percent;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_progress_sync_guard on public.lesson_progress;
create trigger trg_progress_sync_guard
  before insert or update on public.lesson_progress
  for each row execute function public.sync_and_guard_lesson_progress();

-- ============================================================================
-- MUC 4 — Index cho truy van tien do theo khoa
-- ============================================================================
create index if not exists idx_progress_user_course
  on public.lesson_progress (user_id, course_id);
create index if not exists idx_progress_course_accessed
  on public.lesson_progress (course_id, last_accessed desc);

-- ============================================================================
-- MUC 5 — Kiem tra (chi notice, khong fail migration):
--   (i) lessons.slug UNIQUE theo module van con (QĐ 17);
--   (ii) RLS: client van CHI SELECT lesson_progress (H3 — 0009),
--        khong co policy INSERT/UPDATE truc tiep nao.
-- ============================================================================
do $$
declare
  v_slug_unique boolean := false;
  v_write_policy text;
begin
  select exists (
    select 1 from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'lessons'
      and i.indisunique
      and (i.indkey::text = (select string_agg(a.attnum::text, ' ')
                               from pg_attribute a
                              where a.attrelid = c.oid
                                and a.attname in ('course_module_id', 'slug'))
           or i.indkey::text = (select string_agg(a.attnum::text, ' ')
                                  from pg_attribute a
                                 where a.attrelid = c.oid
                                   and a.attname in ('module_id', 'slug')))
  ) into v_slug_unique;
  if v_slug_unique then
    raise notice '(muc 5) OK: lessons.slug UNIQUE theo module van ton tai (QĐ 17).';
  else
    raise notice '(muc 5) CANH BAO: khong tim thay unique (module, slug) tren lessons — kiem tra tay, KHONG tu tao o day.';
  end if;

  select string_agg(policyname, ', ') into v_write_policy
  from pg_policies
  where schemaname = 'public' and tablename = 'lesson_progress'
    and cmd in ('INSERT', 'UPDATE', 'ALL');
  if v_write_policy is null then
    raise notice '(muc 5) OK: lesson_progress khong co policy INSERT/UPDATE/ALL — ghi chi qua Workers service-role (H3 — 0009 dung).';
  else
    raise notice '(muc 5) CANH BAO: lesson_progress co policy ghi truc tiep: % — xem lai H3 (0009), ghi tien do phai qua Workers API.', v_write_policy;
  end if;
end $$;

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0012, bang service-role
-- hoac SQL Editor; JWT student chi SELECT — xem 0009 muc KIEM CHUNG 4):
--   1. select column_name from information_schema.columns
--      where table_name = 'lesson_progress'
--        and column_name in ('course_id','started_at','last_accessed',
--                            'video_position','completion_status');
--      -- Ky vong: 5 dong.
--   2. -- Video 50% khong duoc completed (trigger muc 3e):
--      update lesson_progress set completion_status='completed',
--        progress_percent=50 where ...; -- Ky vong: LOI '>= 90%'.
--   3. -- Khai percent 100 nhung position 5s (trigger muc 3f tinh lai):
--      update lesson_progress set video_position=5, progress_percent=100
--        where lesson la video dai 600s; -- Ky vong: percent ve 1%.
--   4. -- Mo bai (UPDATE last_accessed) khong tu completed:
--      update lesson_progress set last_accessed=now() where ...;
--      select completion_status from lesson_progress where ...;
--      -- Ky vong: van 'in_progress' (khong tu thanh 'completed').
--   5. -- Client ghi truc tiep van bi chan (H3):
--      insert into lesson_progress (user_id, lesson_id, progress_percent)
--      values (auth.uid(), '<1 lesson>', 100); -- JWT student: LOI 42501.
-- ============================================================================
