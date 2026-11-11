-- ============================================================================
-- 0030_community.sql — Cong dong hoc tap VISFAR (Prompt 13, Giai doan 2).
--   4 bang: community_posts / community_comments / community_reactions /
--   community_reports + RLS + trigger updated_at.
--   CHUA ap prod trong dot nay; ap STAGING truoc, kiem chung, roi moi
--   len prod (coordinator duyet). Khong sua file cu (0001–0028).
--
--   Thiet ke chong mat tap trung (theo yeu cau Prompt 13):
--   - KHONG feed vo han: trang /cong-dong phan trang theo lo 20 bai,
--     nut "Xem them", khong cuon vo han, khong video tu phat.
--   - Chi hoc tap / hoi dap / chia se thanh tich: bai gan theo khoa hoc
--     (course_id nullable; null = chung cho ca cong dong).
--   - Khong lo PII nguoi khac: ten hien thi luu truong author_name ngay
--     khi tao bai/binh luan (lay tu ho so cua chinh tac gia luc dang);
--     KHONG join bang profiles (RLS profiles chi cho doc ho so cua
--     minh + admin) nen khong the lo SĐT/email nguoi khac qua cong dong.
--   - Kiem duyet: bai mac dinh status='visible'; instructor/admin
--     duoc an (status='hidden') / xoa bai vi pham; bai bi an chi tac
--     gia + nguoi kiem duyet thay duoc.
--   - Bao cao: hoc vien bao cao bai/binh luan vi pham; chi nguoi bao
--     cao + instructor/admin thay duoc bao cao.
-- ============================================================================

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  title text not null check (char_length(title) >= 3 and char_length(title) <= 200),
  body text not null check (char_length(body) >= 1 and char_length(body) <= 5000),
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_pinned boolean not null default false,
  status text not null default 'visible'
    check (status in ('visible', 'hidden'))
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 2000),
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('like', 'helpful', 'celebrate')),
  created_at timestamptz not null default now(),
  constraint community_reactions_one_target
    check ((post_id is null) <> (comment_id is null))
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) >= 3 and char_length(reason) <= 500),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint community_reports_one_target
    check ((post_id is null) <> (comment_id is null))
);

create index if not exists idx_community_posts_course_created
  on public.community_posts (course_id, created_at desc);
create index if not exists idx_community_posts_status_created
  on public.community_posts (status, created_at desc);
create index if not exists idx_community_posts_author
  on public.community_posts (author_id, created_at desc);
create index if not exists idx_community_comments_post
  on public.community_comments (post_id, created_at asc);
create index if not exists idx_community_reactions_post
  on public.community_reactions (post_id, type);
create index if not exists idx_community_reactions_comment
  on public.community_reactions (comment_id, type);
create index if not exists idx_community_reports_status
  on public.community_reports (status, created_at desc);

-- Moi user chi 1 cam xuc moi loai cho 1 bai / 1 binh luan (bam lai =
-- bo cam xuc o client; khong cho spam so luot bang insert trung).
create unique index if not exists uq_community_reactions_post
  on public.community_reactions (post_id, user_id, type)
  where comment_id is null;
create unique index if not exists uq_community_reactions_comment
  on public.community_reactions (comment_id, user_id, type)
  where post_id is null;

-- Trigger cap nhat updated_at (ham co san tu 0001).
drop trigger if exists trg_community_posts_updated_at on public.community_posts;
create trigger trg_community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

grant select, insert, update, delete on public.community_posts to authenticated;
grant select, insert, update, delete on public.community_comments to authenticated;
grant select, insert, delete on public.community_reactions to authenticated;
grant select, insert, update on public.community_reports to authenticated;
revoke all on public.community_posts from anon;
revoke all on public.community_comments from anon;
revoke all on public.community_reactions from anon;
revoke all on public.community_reports from anon;

-- ---------------------------------------------------------------------------
-- community_posts
-- ---------------------------------------------------------------------------
drop policy if exists "community_posts_select" on public.community_posts;
create policy "community_posts_select" on public.community_posts
  for select using (
    status = 'visible'
    or author_id = auth.uid()
    or public.current_role() in ('admin', 'instructor')
  );

drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own" on public.community_posts
  for insert with check (author_id = auth.uid() and status = 'visible');

drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own" on public.community_posts
  for update using (author_id = auth.uid() and status = 'visible')
  with check (author_id = auth.uid() and status = 'visible');

-- Kiem duyet: instructor/admin duoc doi status / is_pinned / xoa bai.
drop policy if exists "community_posts_moderate" on public.community_posts;
create policy "community_posts_moderate" on public.community_posts
  for update using (public.current_role() in ('admin', 'instructor'))
  with check (public.current_role() in ('admin', 'instructor'));

drop policy if exists "community_posts_delete_own_or_moderate" on public.community_posts;
create policy "community_posts_delete_own_or_moderate" on public.community_posts
  for delete using (
    author_id = auth.uid()
    or public.current_role() in ('admin', 'instructor')
  );

-- ---------------------------------------------------------------------------
-- community_comments — chi thay khi bai chu con hien (hoac minh la tac
-- gia bai / nguoi kiem duyet); tac gia binh luan sua/xoa binh luan cua minh.
-- ---------------------------------------------------------------------------
drop policy if exists "community_comments_select" on public.community_comments;
create policy "community_comments_select" on public.community_comments
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.status = 'visible'
          or p.author_id = auth.uid()
          or public.current_role() in ('admin', 'instructor'))
    )
  );

drop policy if exists "community_comments_insert_own" on public.community_comments;
create policy "community_comments_insert_own" on public.community_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.status = 'visible'
    )
  );

drop policy if exists "community_comments_update_own" on public.community_comments;
create policy "community_comments_update_own" on public.community_comments
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "community_comments_delete_own_or_moderate" on public.community_comments;
create policy "community_comments_delete_own_or_moderate" on public.community_comments
  for delete using (
    author_id = auth.uid()
    or public.current_role() in ('admin', 'instructor')
  );

-- ---------------------------------------------------------------------------
-- community_reactions — chi user_id (khong PII); ai cung doc duoc so
-- luot de hien thi; chi tu tha / tu bo cam xuc cua minh.
-- ---------------------------------------------------------------------------
drop policy if exists "community_reactions_select" on public.community_reactions;
create policy "community_reactions_select" on public.community_reactions
  for select using (true);

drop policy if exists "community_reactions_insert_own" on public.community_reactions;
create policy "community_reactions_insert_own" on public.community_reactions
  for insert with check (user_id = auth.uid());

drop policy if exists "community_reactions_delete_own" on public.community_reactions;
create policy "community_reactions_delete_own" on public.community_reactions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- community_reports — nguoi bao cao + instructor/admin moi thay; chi
-- instructor/admin xu ly (doi status / resolved_at).
-- ---------------------------------------------------------------------------
drop policy if exists "community_reports_select" on public.community_reports;
create policy "community_reports_select" on public.community_reports
  for select using (
    reporter_id = auth.uid()
    or public.current_role() in ('admin', 'instructor')
  );

drop policy if exists "community_reports_insert_own" on public.community_reports;
create policy "community_reports_insert_own" on public.community_reports
  for insert with check (reporter_id = auth.uid() and status = 'open');

drop policy if exists "community_reports_moderate" on public.community_reports;
create policy "community_reports_moderate" on public.community_reports
  for update using (public.current_role() in ('admin', 'instructor'))
  with check (public.current_role() in ('admin', 'instructor'));
