-- ============================================================================
-- 0031_gamification.sql — Gamification hoc tap (Prompt 14, Giai doan 2).
--   4 bang: learning_points / badges / user_badges / learning_streaks
--   + cot profiles.gamification_enabled + ham + trigger thuong diem.
--   CHUA ap prod trong dot nay; ap STAGING truoc, kiem chung, roi moi
--   len prod (coordinator duyet). Khong sua file cu (0001–0029).
--
--   QUY TAC DIEM (1 nguon su that = ham + trigger trong file nay;
--   lib gamification.ts chi doc + goi RPC, KHONG tu cong diem):
--   - Hoan thanh bai hoc            +10  (trigger lesson_progress)
--   - Hoan thanh quiz dat           +20  (trigger quiz_attempts.passed)
--   - Hoan thanh khoa hoc           +100 (trigger enrollments)
--   - Bai cong dong duoc danh dau huu ich +5, toi da 1 lan/ngay
--     (trigger community_reactions type='helpful' tu nguoi khac;
--     tu tha 'helpful' cho bai cua minh KHONG duoc diem)
--   - Streak: moi ngay hoc lien tiep +5 (tinh theo ngay co tien do
--     THAT trong lesson_progress: completed_at; ngay tinh theo UTC)
--   Chong gian lận:
--   - Client KHONG co policy INSERT/UPDATE/DELETE tren learning_points,
--     user_badges, learning_streaks (chi SELECT dong cua minh + admin)
--     nen khong tu ghi diem / tu gan huy hieu / tu sua streak duoc.
--   - Moi moc diem chi thuong 1 lan: UNIQUE (user_id, reason,
--     related_id); rieng 'community_helpful' va 'streak' gioi han
--     1 lan/ngay bang cach dat related_id = uuid suy ra tu ngay
--     (md5(user_id || reason || current_date)) — vi cast
--     timestamptz->date phu thuoc TimeZone nen KHONG dung duoc trong
--     index (loi 42P17 khi thu unique index theo ngay).
--   - Tat gamification (profiles.gamification_enabled=false) thi ham
--     thuong diem dung lai ngay (khong ghi them diem / huy hieu moi);
--     diem cu van giu nguyen, UI chi an di hien thi.
--
--   HUY HIEU KHOI DAU (seed trong file nay):
--   - khoi-dau            "Khoi dau"            — hoan thanh bai dau tien
--   - kien-tri-7-ngay     "Kien tri 7 ngay"     — streak dat 7 ngay
--   - hoan-thanh-khoa-dau-tien "Hoan thanh khoa dau tien"
--   - nguoi-chia-se       "Nguoi chia se"       — dang 3 bai cong dong
-- ============================================================================

alter table public.profiles
  add column if not exists gamification_enabled boolean not null default true;

create table if not exists public.learning_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null check (points > 0),
  reason text not null check (reason in (
    'lesson_completed', 'quiz_passed', 'course_completed',
    'community_helpful', 'streak'
  )),
  related_id uuid,
  created_at timestamptz not null default now(),
  constraint uq_learning_points_reason_related
    unique (user_id, reason, related_id)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon text not null default '🏅',
  rule text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.learning_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- (Khong dung unique index theo ngay created_at::date: cast
-- timestamptz->date phu thuoc TimeZone nen Postgres bao 42P17.
-- Gioi han 1 lan/ngay duoc ep bang related_id suy ra tu ngay trong
-- ham award_points_internal + UNIQUE (user_id, reason, related_id).)

create index if not exists idx_learning_points_user_created
  on public.learning_points (user_id, created_at desc);
create index if not exists idx_user_badges_user
  on public.user_badges (user_id, earned_at desc);

-- Trigger cap nhat updated_at (ham co san tu 0001).
drop trigger if exists trg_learning_streaks_updated_at on public.learning_streaks;
create trigger trg_learning_streaks_updated_at
  before update on public.learning_streaks
  for each row execute function public.set_updated_at();

alter table public.learning_points enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.learning_streaks enable row level security;

grant select on public.learning_points to authenticated;
grant select on public.badges to authenticated;
grant select on public.user_badges to authenticated;
grant select on public.learning_streaks to authenticated;
revoke all on public.learning_points from anon;
revoke all on public.badges from anon;
revoke all on public.user_badges from anon;
revoke all on public.learning_streaks from anon;

-- Chi doc dong cua minh (+ admin doc het). KHONG co policy ghi cho
-- client — diem / huy hieu / streak chi ghi qua ham + trigger duoi day.
drop policy if exists "learning_points_select_own" on public.learning_points;
create policy "learning_points_select_own" on public.learning_points
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "badges_select" on public.badges;
create policy "badges_select" on public.badges
  for select using (true);

drop policy if exists "user_badges_select_own" on public.user_badges;
create policy "user_badges_select_own" on public.user_badges
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "learning_streaks_select_own" on public.learning_streaks;
create policy "learning_streaks_select_own" on public.learning_streaks
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

-- Seed 4 huy hieu khoi dau (idempotent).
insert into public.badges (slug, name, description, icon, rule) values
  ('khoi-dau', 'Khởi đầu', 'Hoàn thành bài học đầu tiên của bạn.', '🌱',
   'Hoàn thành 1 bài học (lesson_progress.status = completed).'),
  ('kien-tri-7-ngay', 'Kiên trì 7 ngày', 'Học liên tiếp 7 ngày không nghỉ.', '🔥',
   'Streak học liên tiếp đạt 7 ngày (tính từ lesson_progress thật).'),
  ('hoan-thanh-khoa-dau-tien', 'Hoàn thành khóa đầu tiên', 'Hoàn thành trọn vẹn khóa học đầu tiên.', '🎓',
   'Có 1 enrollment status = completed.'),
  ('nguoi-chia-se', 'Người chia sẻ', 'Đăng 3 bài viết trong cộng đồng VISFAR.', '💬',
   'Đăng 3 bài community_posts ở trạng thái visible.')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  rule = excluded.rule;

-- ---------------------------------------------------------------------------
-- Ham noi bo (SECURITY DEFINER — chi trigger / RPC goi, khong goi truc
-- tiep tu client). Mọi ham deu ton trong profiles.gamification_enabled.
-- ---------------------------------------------------------------------------
create or replace function public.award_points_internal(
  p_user_id uuid, p_points integer, p_reason text, p_related_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_related uuid := p_related_id;
begin
  if p_user_id is null or p_points is null or p_points <= 0 then
    return false;
  end if;
  select gamification_enabled into v_enabled
    from public.profiles where id = p_user_id;
  if v_enabled is distinct from true then
    return false;
  end if;
  -- Gioi han 1 lan/ngay cho 2 loai diem theo ngay: related_id suy ra
  -- tu ngay (md5) nen UNIQUE (user_id, reason, related_id) ep duoc.
  if p_reason in ('community_helpful', 'streak') then
    v_related := md5(p_user_id::text || p_reason || current_date::text)::uuid;
  end if;
  begin
    insert into public.learning_points (user_id, points, reason, related_id)
    values (p_user_id, p_points, p_reason, v_related);
  exception when unique_violation then
    return false;
  end;
  return true;
end;
$$;

create or replace function public.refresh_streak_internal(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_dates date[];
  v_day date;
  v_streak integer := 0;
  v_longest integer := 0;
begin
  if p_user_id is null then
    return 0;
  end if;
  -- Ngay co tien do THAT: ngay completed_at cua bai da hoan thanh.
  select coalesce(array_agg(d), '{}')
    into v_active_dates
  from (
    select distinct (completed_at::date) as d
    from public.lesson_progress
    where user_id = p_user_id
      and status = 'completed'
      and completed_at is not null
    order by d desc
  ) s;

  -- Streak hien tai: bat dau tu hom nay, neu hom nay chua hoc thi tu
  -- hom qua; dem nguoc ngay lien tiep. Hom nay chua hoc + hom qua
  -- khong hoc = streak 0 (chua dut ngay hom qua neu hom qua co hoc
  -- thi bat dau tu hom qua).
  v_day := current_date;
  if not (v_day = any (v_active_dates)) then
    v_day := current_date - 1;
  end if;
  while v_day = any (v_active_dates) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  select coalesce(max(current_streak), 0) into v_longest
    from public.learning_streaks where user_id = p_user_id;
  v_longest := greatest(v_longest, v_streak);

  insert into public.learning_streaks
    (user_id, current_streak, longest_streak, last_active_date)
  values (
    p_user_id, v_streak, v_longest,
    case when v_streak > 0 then current_date - (case
      when (current_date = any (v_active_dates)) then 0 else 1 end)
    else null end
  )
  on conflict (user_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    last_active_date = excluded.last_active_date,
    updated_at = now();

  -- Thuong streak +5 neu hom nay co hoc that va chua thuong hom nay.
  if current_date = any (v_active_dates) then
    perform public.award_points_internal(p_user_id, 5, 'streak', null);
  end if;
  return v_streak;
end;
$$;

create or replace function public.award_badges_internal(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_streak integer;
begin
  if p_user_id is null then
    return;
  end if;
  select gamification_enabled into v_enabled
    from public.profiles where id = p_user_id;
  if v_enabled is distinct from true then
    return;
  end if;

  -- Khoi dau: 1 bai hoan thanh.
  if exists (
    select 1 from public.lesson_progress
    where user_id = p_user_id and status = 'completed'
  ) then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where slug = 'khoi-dau'
    on conflict do nothing;
  end if;

  -- Kien tri 7 ngay: streak hien tai >= 7.
  select current_streak into v_streak
    from public.learning_streaks where user_id = p_user_id;
  if coalesce(v_streak, 0) >= 7 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where slug = 'kien-tri-7-ngay'
    on conflict do nothing;
  end if;

  -- Hoan thanh khoa dau tien.
  if exists (
    select 1 from public.enrollments
    where user_id = p_user_id and status = 'completed'
  ) then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges
    where slug = 'hoan-thanh-khoa-dau-tien'
    on conflict do nothing;
  end if;

  -- Nguoi chia se: 3 bai cong dong dang hien.
  if (
    select count(*) from public.community_posts
    where author_id = p_user_id and status = 'visible'
  ) >= 3 then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where slug = 'nguoi-chia-se'
    on conflict do nothing;
  end if;
end;
$$;

-- RPC cho client: tinh lai streak + huy hieu cua CHINH MINH (auth.uid),
-- tra ve tong quan de trang Thanh tich hien ngay ma khong doi trigger.
create or replace function public.refresh_my_gamification()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_streak integer;
  v_total integer;
  v_badges integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_streak := public.refresh_streak_internal(v_uid);
  perform public.award_badges_internal(v_uid);
  select coalesce(sum(points), 0) into v_total
    from public.learning_points where user_id = v_uid;
  select count(*) into v_badges
    from public.user_badges where user_id = v_uid;
  return jsonb_build_object(
    'current_streak', v_streak,
    'total_points', v_total,
    'badge_count', v_badges
  );
end;
$$;

grant execute on function public.refresh_my_gamification() to authenticated;
revoke execute on function public.refresh_my_gamification() from anon;

-- ---------------------------------------------------------------------------
-- Trigger thuong diem (server-side). Moi trigger boc exception de loi
-- thuong diem KHONG lam hong ghi tien do / bai quiz / ghi danh goc.
-- ---------------------------------------------------------------------------
create or replace function public.trg_award_lesson_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chi thuong khi bai vua chuyen sang hoan thanh.
  if new.status is distinct from 'completed' then
    return new;
  end if;
  -- Da hoan thanh tu truoc thi khong thuong lai (UNIQUE cung chan,
  -- nhung tranh goi refresh streak / badges thua).
  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new;
  end if;
  begin
    perform public.award_points_internal(new.user_id, 10, 'lesson_completed', new.lesson_id);
    perform public.refresh_streak_internal(new.user_id);
    perform public.award_badges_internal(new.user_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_lesson_progress_award on public.lesson_progress;
create trigger trg_lesson_progress_award
  after insert or update of status on public.lesson_progress
  for each row
  execute function public.trg_award_lesson_points();

create or replace function public.trg_award_course_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.award_points_internal(new.user_id, 100, 'course_completed', new.course_id);
    perform public.award_badges_internal(new.user_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_enrollments_award on public.enrollments;
create trigger trg_enrollments_award
  after update of status on public.enrollments
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.trg_award_course_points();

create or replace function public.trg_award_quiz_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chi thuong khi quiz vua dat (passed=true, status=submitted) va
  -- chua tung dat truoc (UPDATE tu passed=true sang passed=true thi bo).
  if new.passed is distinct from true or new.status is distinct from 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.passed is true then
    return new;
  end if;
  begin
    perform public.award_points_internal(
      new.user_id, 20, 'quiz_passed', coalesce(new.quiz_id, new.lesson_id));
    perform public.award_badges_internal(new.user_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_quiz_attempts_award on public.quiz_attempts;
create trigger trg_quiz_attempts_award
  after insert or update of passed, status on public.quiz_attempts
  for each row
  execute function public.trg_award_quiz_points();

-- Bai cong dong huu ich +5: khi co nguoi KHAC tha 'helpful' cho bai.
create or replace function public.trg_award_helpful_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  begin
    select author_id into v_author
      from public.community_posts where id = new.post_id;
    if v_author is not null and v_author <> new.user_id then
      perform public.award_points_internal(v_author, 5, 'community_helpful', new.post_id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_reactions_helpful_award on public.community_reactions;
create trigger trg_reactions_helpful_award
  after insert on public.community_reactions
  for each row
  when (new.type = 'helpful' and new.post_id is not null)
  execute function public.trg_award_helpful_post();

-- Dang bai cong dong -> kiem tra huy hieu "Nguoi chia se".
create or replace function public.trg_community_post_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.award_badges_internal(new.author_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_community_posts_badges on public.community_posts;
create trigger trg_community_posts_badges
  after insert on public.community_posts
  for each row
  execute function public.trg_community_post_badges();
