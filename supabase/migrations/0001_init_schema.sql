-- ============================================================================
-- Visfar Academy — Module 1: Foundation
-- Migration 0001 — init schema (theo Tai lieu kien truc tong the §3, §6)
-- NGUYEN TAC:
--  * Moi bang deu co id uuid PK, created_at, updated_at (§3.1).
--    (Mot so bang trong §3.2 chi liet ke submitted_at/issued_at;
--     o day bo sung them updated_at cho dong nhat, khong bo cot nao.)
--  * Tien luu integer (VND). Khong hard-delete du lieu nghiep vu.
--  * RLS bat tren MOI bang. Mac dinh tu choi.
--  * GHI CHU VE QUYEN INSTRUCTOR: §6.2 cho instructor sua bai hoc cua
--    khoa minh phu trach, nhung schema §3 KHONG co bang anh xa
--    instructor <-> course, nen khong the viet policy do mot cach
--    dung dan. Trong migration nay, ghi bai hoc/module/quiz chi admin.
--    Bang `course_instructors` se duoc them o migration sau (Module 2+)
--    khi co yeu cau cu the — KHONG tu y them cot/bang o day.
--  * Chay bang Supabase SQL Editor / `supabase db push`. Idempotent
--    o muc co the (IF NOT EXISTS / ON CONFLICT o seed, khong o day).
-- ============================================================================

-- Can pgcrypto cho gen_random_uuid() (Supabase mac dinh da co)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. profiles — 1-1 voi auth.users
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text check (phone ~ '^0[0-9]{9}$'),
  email text not null unique,
  province text,
  role text not null default 'student'
    check (role in ('student', 'instructor', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ham lay role cua user hien tai (§6.2). SECURITY DEFINER de doc profiles
-- ngay ca khi RLS chan user doc profile cua nguoi khac.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Trigger: tao profiles khi co auth.users moi (Supabase Auth signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. courses
-- ============================================================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_order integer not null,
  title text not null,
  subtitle text,
  description text,
  details jsonb,
  pillar text check (pillar in ('tam-thuc', 'tri-tue', 'nhan-hieu', 'cong-dong')),
  poster_url text,
  price_vnd integer not null default 0 check (price_vnd >= 0),
  is_featured boolean not null default false,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. modules / lessons
-- ============================================================================
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  slug text not null,
  title text not null,
  type text not null check (type in ('video', 'text', 'quiz', 'file')),
  content text,
  video_url text,
  video_duration_sec integer,
  file_url text,
  display_order integer not null,
  is_free_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug)
);
-- GHI CHU (§3.4): slug nen UNIQUE theo khoa, khong theo module.
-- Quyet dinh nay chua duoc chot o buoi kiem tra kien truc, nen tam
-- giu UNIQUE(module_id, slug); se sua o migration sau khi chot.

-- ============================================================================
-- 4. quiz_questions / quiz_options
-- ============================================================================
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  question text not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 7. orders / payments
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  amount_vnd integer not null default 0 check (amount_vnd >= 0),
  custom_amount_vnd integer,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'refunded', 'expired')),
  payment_method text check (payment_method in ('bank_transfer', 'sepay', 'stripe', 'cash', 'free')),
  reference_code text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount_vnd integer not null check (amount_vnd > 0),
  method text not null check (method in ('bank_transfer', 'sepay', 'stripe')),
  gateway_reference text,
  gateway_payload jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (method, gateway_reference)
);
-- LUU Y: unique(method, gateway_reference) van chap nhan nhieu dong co
-- gateway_reference NULL (Postgres coi NULL la khac nhau) — dung nhu
-- thiet ke: chi chong trung khi co ma giao dich cong that.

-- 5. enrollments / lesson_progress / quiz_attempts / certificates
-- ============================================================================
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'revoked')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('not_started', 'in_progress', 'completed')),
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  last_position_sec integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  score integer not null,
  total integer not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  certificate_code text not null unique,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

-- ============================================================================
-- 6. leads (thay form -> Apps Script -> Sheet)
-- ============================================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  idempotency_key text not null unique,
  full_name text not null,
  phone text not null check (phone ~ '^0[0-9]{9}$'),
  email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  province text not null,
  course_id uuid references public.courses (id) on delete set null,
  course_interest_text text,
  source text not null default 'visfar-academy',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'enrolled', 'closed', 'spam')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ============================================================================
-- 8. events / event_registrations / posts / policies
-- ============================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  type text check (type in ('live', 'workshop', 'qa')),
  description text,
  starts_at timestamptz not null,
  location text,
  image_url text,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'happened', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  email text not null,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, email)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  cover_url text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  body text not null,
  version integer not null default 1,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, version)
);

-- ============================================================================
-- 9. email_logs / newsletter_subscribers / audit_logs
-- ============================================================================
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  resend_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'subscribed'
    check (status in ('subscribed', 'unsubscribed')),
  source text not null default 'footer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes (§3.3)
-- ============================================================================
create index if not exists idx_courses_display_order
  on public.courses (display_order) where status = 'published';
create index if not exists idx_courses_slug on public.courses (slug);
create index if not exists idx_modules_course
  on public.modules (course_id, display_order);
create index if not exists idx_lessons_module
  on public.lessons (module_id, display_order);
create index if not exists idx_enrollments_user on public.enrollments (user_id);
create index if not exists idx_enrollments_course on public.enrollments (course_id);
create index if not exists idx_progress_user_lesson
  on public.lesson_progress (user_id, lesson_id);
create index if not exists idx_leads_status_created
  on public.leads (status, created_at desc);
create index if not exists idx_leads_phone on public.leads (phone);
create index if not exists idx_leads_reference on public.leads (reference_code);
create index if not exists idx_orders_user_status
  on public.orders (user_id, status);
create index if not exists idx_orders_reference on public.orders (reference_code);
create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_email_logs_to_template
  on public.email_logs (to_email, template, created_at desc);
create index if not exists idx_posts_slug_status
  on public.posts (slug) where status = 'published';
create index if not exists idx_events_starts
  on public.events (starts_at) where status = 'upcoming';

-- Trigger updated_at cho moi bang co updated_at
do $$
declare t text;
begin
  for t in select table_name from information_schema.tables
           where table_schema = 'public'
             and table_name in (
               'profiles','courses','modules','lessons','quiz_questions',
               'quiz_options','enrollments','lesson_progress','quiz_attempts',
               'certificates','leads','orders','payments','events',
               'event_registrations','posts','policies','email_logs',
               'newsletter_subscribers','audit_logs')
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at
         before update on public.%1$s
         for each row execute function public.set_updated_at();',
      t);
  end loop;
end $$;

-- ============================================================================
-- RLS (§6) — bat tren MOI bang, mac dinh tu choi
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.certificates enable row level security;
alter table public.leads enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.posts enable row level security;
alter table public.policies enable row level security;
alter table public.email_logs enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.audit_logs enable row level security;

-- --- profiles: minh + admin
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'admin');
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.current_role() = 'admin');

-- --- courses: cong khai neu published; chi admin ghi
create policy "courses_select_public" on public.courses
  for select using (status = 'published' or public.current_role() = 'admin');
create policy "courses_admin_all" on public.courses
  for all using (public.current_role() = 'admin');

-- --- modules: doc neu khoa published; chi admin ghi
create policy "modules_select_public" on public.modules
  for select using (
    exists (select 1 from public.courses c
            where c.id = modules.course_id
              and (c.status = 'published' or public.current_role() = 'admin'))
  );
create policy "modules_admin_all" on public.modules
  for all using (public.current_role() = 'admin');

-- --- lessons: doc neu khoa published; chi admin ghi
-- (Kiem tra "da ghi danh moi xem bai khong xem thu" thuc hien o API,
--  khong phai o RLS — RLS chi chan doc bai cua khoa draft/archived.)
create policy "lessons_select_public" on public.lessons
  for select using (
    exists (select 1 from public.modules m
            join public.courses c on c.id = m.course_id
            where m.id = lessons.module_id
              and (c.status = 'published' or public.current_role() = 'admin'))
  );
create policy "lessons_admin_all" on public.lessons
  for all using (public.current_role() = 'admin');

-- --- quiz_questions: nhu lessons; chi admin ghi
create policy "quiz_questions_select_public" on public.quiz_questions
  for select using (
    exists (select 1 from public.lessons l
            join public.modules m on m.id = l.module_id
            join public.courses c on c.id = m.course_id
            where l.id = quiz_questions.lesson_id
              and (c.status = 'published' or public.current_role() = 'admin'))
  );
create policy "quiz_questions_admin_all" on public.quiz_questions
  for all using (public.current_role() = 'admin');

-- --- quiz_options: KHONG co policy SELECT truc tiep cho client.
-- Dap an dung (is_correct) chi duoc doc qua VIEW quiz_options_public
-- (ben duoi) va qua service-role o Workers. Khong co policy = mac dinh
-- tu choi doi voi moi truy van truc tiep vao bang nay.
create policy "quiz_options_admin_all" on public.quiz_options
  for all using (public.current_role() = 'admin');

-- VIEW cong khai, KHONG co is_correct (§6.2).
-- View chay voi quyen owner (security_invoker = false mac dinh) nen
-- doc duoc bang goc; truy van truc tiep bang goc van bi RLS chan.
create or replace view public.quiz_options_public as
  select id, question_id, option_text, display_order
  from public.quiz_options;
grant select on public.quiz_options_public to anon, authenticated;

-- --- enrollments: minh + admin; insert cua minh (duong ghi chinh la Workers)
create policy "enrollments_select_own" on public.enrollments
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "enrollments_insert_own" on public.enrollments
  for insert with check (user_id = auth.uid());
create policy "enrollments_update_admin" on public.enrollments
  for update using (public.current_role() = 'admin');

-- --- lesson_progress: minh; admin chi doc
create policy "progress_own" on public.lesson_progress
  for all using (user_id = auth.uid());
create policy "progress_admin_read" on public.lesson_progress
  for select using (public.current_role() = 'admin');

-- --- quiz_attempts: minh + admin doc; khong ghi truc tiep (qua Workers)
create policy "quiz_attempts_select_own" on public.quiz_attempts
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

-- --- certificates: minh + admin doc; khong ghi truc tiep (qua Workers)
create policy "certificates_select_own" on public.certificates
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

-- --- leads: chi admin doc; KHONG co policy INSERT cho client.
-- Lead chi duoc tao qua Workers API bang service-role (Module 2).
create policy "leads_admin_read" on public.leads
  for select using (public.current_role() = 'admin');
create policy "leads_admin_update" on public.leads
  for update using (public.current_role() = 'admin');

-- --- orders: minh + admin doc; khong ghi truc tiep (qua Workers)
create policy "orders_select_own" on public.orders
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

-- --- payments: chi admin doc; khong ghi truc tiep (qua Workers)
create policy "payments_admin_read" on public.payments
  for select using (public.current_role() = 'admin');

-- --- events: cong khai neu upcoming/happened; chi admin ghi
create policy "events_select_public" on public.events
  for select using (status in ('upcoming', 'happened') or public.current_role() = 'admin');
create policy "events_admin_all" on public.events
  for all using (public.current_role() = 'admin');

-- --- event_registrations: minh + admin; insert cua minh hoac khach (user_id null)
create policy "event_registrations_select_own" on public.event_registrations
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "event_registrations_insert" on public.event_registrations
  for insert with check (user_id is null or user_id = auth.uid());
create policy "event_registrations_delete_own" on public.event_registrations
  for delete using (user_id = auth.uid() or public.current_role() = 'admin');

-- --- posts: cong khai neu published; chi admin ghi
create policy "posts_select_public" on public.posts
  for select using (status = 'published' or public.current_role() = 'admin');
create policy "posts_admin_all" on public.posts
  for all using (public.current_role() = 'admin');

-- --- policies: cong khai ban hien tai; chi admin ghi
create policy "policies_select_public" on public.policies
  for select using (is_current = true or public.current_role() = 'admin');
create policy "policies_admin_all" on public.policies
  for all using (public.current_role() = 'admin');

-- --- email_logs / newsletter_subscribers / audit_logs: chi admin doc;
-- ghi qua Workers (service-role). Newsletter unsubscribe xu ly o Workers.
create policy "email_logs_admin_read" on public.email_logs
  for select using (public.current_role() = 'admin');
create policy "newsletter_admin_read" on public.newsletter_subscribers
  for select using (public.current_role() = 'admin');
create policy "audit_logs_admin_read" on public.audit_logs
  for select using (public.current_role() = 'admin');
