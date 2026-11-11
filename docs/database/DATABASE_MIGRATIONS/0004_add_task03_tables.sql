-- ============================================================================
-- Visfar Academy — Task 03 — Migration 0004 — BANG MOI (thiet ke)
-- THIET KE — CHUA AP DUNG, CHO PHE DUYET — 10/11/2026
-- ----------------------------------------------------------------------------
-- CHI LA FILE THIET KE. KHONG chay len Supabase that, KHONG deploy,
-- KHONG sua code Module 1 (0001_init_schema.sql giu nguyen).
-- Thu tu ap dung (neu duoc phe duyet): 0004 -> 0005 -> 0006, tren
-- STAGING truoc, backup truoc khi chay prod (xem 0005).
--
-- Phu thuoc: 0001_init_schema.sql da ap dung (cac bang profiles, courses,
-- modules, lessons, quiz_questions, quiz_options, quiz_attempts, orders,
-- events, audit_logs, ... va ham public.set_updated_at(),
-- public.current_role() da ton tai).
--
-- QUY UOC CHUNG (theo kien truc §3.1 va 0001):
--   * Moi bang: id uuid PK DEFAULT gen_random_uuid(),
--     created_at / updated_at timestamptz NOT NULL DEFAULT now().
--   * Tien: integer (VND). Khong hard-delete du lieu nghiep vu.
--   * Moi FK deu co ON DELETE ro rang.
--   * RLS: xem 0006_rls_task03.sql (file nay CHI tao bang + index,
--     KHONG tao policy — policy tap trung o 0006).
--
-- DIEM MAU THUAN / CHONG LAP VOI MODULE 1 — CAN PHE DUYET (xem them 0005):
--   [A] course_modules (MOI) vs modules (CU, 0001): hai bang cung vai tro
--       "chuong / module trong khoa hoc". File nay tao course_modules
--       nhu mot bang MOI, RIENG BIET — KHONG drop, KHONG rename bang
--       modules cu; lessons van FK ve modules. Day la buoc tam de
--       thiet ke duoc duyet truoc khi chon phuong an gop (xem 0005,
--       phuong an A duoc de xuat: rename modules -> course_modules).
--       TRONG LUC CHUA CHAY 0005: course_modules CHI la bang thiet ke,
--       khong co du lieu nghiep vu, khong duoc dung lam nguon su that.
--   [B] quizzes / questions vs quiz_questions (CU): questions la ten moi
--       gon hon cho quiz_questions; quizzes la bang chua (container)
--       cho mot bai quiz gan voi 1 lesson (truoc day quiz ngam dinh
--       qua lessons.type = 'quiz' + quiz_questions.lesson_id).
--       Cho toi khi 0005 chay, quiz_questions van la nguon su that.
--   [C] answers: CHUAN HOA lai quiz_attempts.answers (jsonb) thanh
--       dong rieng. FK question_id -> questions.id (bang MOI), nen
--       answers CHI co nghia sau khi 0005 backfill quiz_questions
--       sang questions. Truoc do answers de trong.
--   [D] user_roles vs profiles.role (text, 0001): user_roles cho phep
--       1 user co NHIEU role; profiles.role chi 1 role. Cho toi khi
--       0005 chay, profiles.role van la nguon su that; user_roles
--       chi la bang bo sung, dong bo 1 chieu tu profiles.role.
--   [E] learning_events vs events (CU): events la su kien marketing
--       (live/workshop/qa, cong khai); learning_events la buoi hoc
--       truc tiep gan voi khoa hoc/lesson (chi hoc vien da ghi danh).
--       Hai bang KHAC muc dich, KHONG gop — giu ca hai (can xac nhan).
--   [F] order_items vs orders.course_id (CU): orders hien chi 1 khoa/
--       don. order_items cho phep don NHIEU khoa. orders.course_id
--       duoc GIU LAI de tuong thich nguoc; 0005 backfill order_items
--       tu orders hien co.
--   [G] activity_logs vs audit_logs (CU): audit_logs = thao tac ADMIN
--       (da co); activity_logs = hanh vi NGUOI DUNG (xem bai, click,
--       ...). KHAC muc dich, KHONG gop — giu ca hai.
--   [H] categories vs courses.pillar (CU): pillar la enum cung 4 gia
--       tri (tam-thuc/tri-tue/nhan-hieu/cong-dong); categories la
--       taxonomy mo rong (cho courses/posts/events). pillar duoc GIU;
--       categories.category chi bo sung, khong thay the pillar.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. user_roles — nhieu role / 1 user (bo sung profiles.role, xem [D])
--    Nguon su that hien tai van la profiles.role cho toi khi 0005 chay.
-- ============================================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('student', 'instructor', 'admin')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists idx_user_roles_user on public.user_roles (user_id);
create index if not exists idx_user_roles_role on public.user_roles (role);

-- ============================================================================
-- 2. categories — taxonomy mo rong (xem [H])
--    type: pham vi ap dung. parent_id: danh muc cha (NULL = goc).
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null default 'course'
    check (type in ('course', 'post', 'event', 'general')),
  parent_id uuid references public.categories (id) on delete set null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_categories_type_order
  on public.categories (type, display_order);
create index if not exists idx_categories_parent on public.categories (parent_id);

-- ============================================================================
-- 3. course_modules — BANG MOI (xem [A] — QUAN TRONG)
--    Day la bang MOI, TACH BIET voi bang modules cu (0001).
--    - KHONG drop bang modules cu trong file nay.
--    - KHONG doi FK cua lessons (lessons.module_id van -> modules.id).
--    - Bang nay CHI ton tai o muc thiet ke cho toi khi 0005 duoc phe
--      duyet va chay: phuong an duoc de xuat la rename modules
--      -> course_modules (giu du lieu), dong thoi xu ly bang moi
--      nay (trong neu chua co du lieu) — xem 0005 muc 1.
--    - Neu phuong an gop KHONG duoc duyet, bang nay phai duoc XOA
--      khoi thiet ke (khong de 2 bang song song lam nguon su that).
--    Cac cot them so voi modules cu: slug, description, is_free_preview,
--    is_published — la ly do de xuat doi ten/mo rong (giu lai khi rename).
-- ============================================================================
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  display_order integer not null,
  is_free_preview boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);
create index if not exists idx_course_modules_course
  on public.course_modules (course_id, display_order);

-- ============================================================================
-- 4. lesson_resources — tai lieu dinh kem theo bai hoc (nhieu file / 1 bai)
--    Bo sung cho lessons.file_url (chi 1 file) — file_url duoc GIU LAI,
--    khong xoa; resource dung cho tai lieu mo rong (PDF, slide, link).
-- ============================================================================
create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null,
  resource_type text not null default 'file'
    check (resource_type in ('file', 'link', 'video', 'document')),
  file_url text,
  file_size_bytes integer check (file_size_bytes is null or file_size_bytes >= 0),
  display_order integer not null default 0,
  is_free_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lesson_resources_lesson
  on public.lesson_resources (lesson_id, display_order);

-- ============================================================================
-- 5. learning_events — buoi hoc truc tiep gan voi khoa hoc (xem [E])
--    KHAC events (marketing, cong khai): chi hoc vien da ghi danh khoa
--    moi thay/tham gia; co meeting_url (Zoom) chi hien sau khi ghi danh.
-- ============================================================================
create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_url text,
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_learning_events_course
  on public.learning_events (course_id, starts_at);
create index if not exists idx_learning_events_starts
  on public.learning_events (starts_at) where status = 'scheduled';

-- ============================================================================
-- 6. quizzes — container cho 1 bai quiz (xem [B])
--    1 lesson co toi da 1 quiz (UNIQUE lesson_id). course_id du phong
--    de truy van theo khoa ma khong can join qua lessons/modules.
-- ============================================================================
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  title text not null,
  description text,
  pass_score_percent integer check (pass_score_percent is null or (pass_score_percent >= 0 and pass_score_percent <= 100)),
  time_limit_sec integer check (time_limit_sec is null or time_limit_sec > 0),
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id)
);
create index if not exists idx_quizzes_course on public.quizzes (course_id);
create index if not exists idx_quizzes_lesson on public.quizzes (lesson_id);

-- ============================================================================
-- 7. questions — cau hoi quiz, ten moi gon hon (xem [B])
--    Thay the / ke thua quiz_questions (CU) sau khi 0005 backfill.
--    question_type: 'single_choice' (1 dap an dung) / 'multiple_choice'
--    / 'true_false' / 'short_answer' (tu luan ngan, cham tay — lien
--    quan DECISIONS Task 02 #5: bai tap tu luan + cham tay).
--    DAP AN DUNG KHONG NAM O DAY — van o quiz_options.is_correct (CU).
-- ============================================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  question text not null,
  question_type text not null default 'single_choice'
    check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'short_answer')),
  explanation text,
  display_order integer not null,
  points integer not null default 1 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_questions_quiz
  on public.questions (quiz_id, display_order);

-- ============================================================================
-- 8. answers — DAP AN HOC VIEN DA CHON trong 1 lan lam quiz (xem [C])
--    QUAN TRONG — KHONG CHUA DAP AN DUNG:
--    - attempt_id FK -> quiz_attempts.id (lan lam bai, bang CU 0001).
--    - question_id FK -> questions.id (bang MOI muc 7).
--    - option_id FK -> quiz_options.id (bang CU 0001; NULL khi cau
--      short_answer / tu luan khong co lua chon san).
--    - answer_text: cau tra loi dang text (tu luan ngan / true_false).
--    - is_correct: ket qua CHAM o server (Workers) tai thoi diem nop;
--      chi de doc nhanh ket qua, KHONG phai la noi luu dap an dung
--      goc — dap an dung goc VAN CHI O quiz_options.is_correct.
--    - Chuan hoa lai quiz_attempts.answers (jsonb, CU): jsonb duoc GIU
--      LAI de doi soat; answers la ban chuan hoa de truy van.
--    - Rang buoc: 1 cau hoi / 1 lan lam bai chi co toi da 1 dong
--      (UNIQUE attempt_id + question_id) doi voi single_choice /
--      true_false / short_answer; multiple_choice ghi NHIEU dong
--      (moi option duoc chon 1 dong) thi UNIQUE nay phai duoc no'i
--      long o 0005 neu chon ho tro multiple_choice — xem ghi chu
--      trong 0005 muc 4. Tam thoi giu UNIQUE nay cho single_choice.
-- ============================================================================
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  option_id uuid references public.quiz_options (id) on delete set null,
  answer_text text,
  is_correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index if not exists idx_answers_attempt on public.answers (attempt_id);
create index if not exists idx_answers_question on public.answers (question_id);

-- ============================================================================
-- 9. assignments — bai tap (gom tu luan cham tay, DECISIONS Task 02 #5)
--    Gan voi 1 lesson (NULL duoc neu bai tap cap khoa hoc) + 1 khoa.
-- ============================================================================
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null,
  description text not null,
  due_at timestamptz,
  max_score integer check (max_score is null or max_score >= 0),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_assignments_course
  on public.assignments (course_id);
create index if not exists idx_assignments_lesson
  on public.assignments (lesson_id);

-- ============================================================================
-- 10. submissions — bai nop cua hoc vien (1 hoc vien / 1 bai tap / 1 lan nop
--     co the nop lai: ban nop moi nhat duoc danh dau bang status;
--     lich su nop cu duoc giu lai, khong xoa)
-- ============================================================================
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text,
  file_url text,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'graded', 'needs_revision', 'resubmitted')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_submissions_assignment
  on public.submissions (assignment_id, submitted_at desc);
create index if not exists idx_submissions_user
  on public.submissions (user_id, assignment_id);

-- ============================================================================
-- 11. submission_reviews — cham tay bai nop (giang vien / admin)
--     reviewer_id: nguoi cham (instructor cua khoa hoac admin).
-- ============================================================================
create table if not exists public.submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  score integer check (score is null or score >= 0),
  feedback text,
  status text not null default 'graded'
    check (status in ('graded', 'needs_revision', 'approved')),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_submission_reviews_submission
  on public.submission_reviews (submission_id, reviewed_at desc);

-- ============================================================================
-- 14. membership_plans — goi thanh vien (vd: goi thang / nam / tron doi)
-- ============================================================================
create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_vnd integer not null default 0 check (price_vnd >= 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_membership_plans_active
  on public.membership_plans (slug) where is_active = true;

-- 12. order_items — dong hang trong don (don nhieu khoa, xem [F])
--     orders.course_id (CU) duoc GIU LAI; 0005 backfill 1 dong
--     order_items / 1 don hien co tu orders.course_id + amount_vnd.
-- ============================================================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  membership_plan_id uuid references public.membership_plans (id) on delete set null,
  title_snapshot text not null,
  amount_vnd integer not null default 0 check (amount_vnd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, course_id)
);
create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_course on public.order_items (course_id);

-- ============================================================================
-- 13. coupons — ma giam gia
--     discount_type: 'percent' (0-100) hoac 'fixed_vnd'. Ma code luu
--     dang chuan hoa (UPPER, khong khoang trang) — chuan hoa o API.
-- ============================================================================
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null default 'percent'
    check (discount_type in ('percent', 'fixed_vnd')),
  discount_value integer not null check (discount_value >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_coupons_code_active
  on public.coupons (code) where is_active = true;

-- ============================================================================
-- ============================================================================
-- 15. memberships — goi thanh vien cua 1 user
-- ============================================================================
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.membership_plans (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled')),
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_memberships_user
  on public.memberships (user_id, status);
create index if not exists idx_memberships_plan on public.memberships (plan_id);

-- ============================================================================
-- 16. notifications — thong bao in-app (DECISIONS Task 02 #4: CO TAO)
--     related_type/related_id: lien ket mem (course/order/assignment...),
--     khong FK cung de khong khoa xoa du lieu goc.
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_type text,
  related_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_notifications_user
  on public.notifications (user_id, is_read, created_at desc);

-- ============================================================================
-- 17. automation_events — su kien kich hoat automation (email / nhac nho)
--     Ghi lai moi lan automation chay (de doi soat voi email_logs CU).
--     status: 'pending' | 'processed' | 'failed' | 'skipped'.
-- ============================================================================
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references public.profiles (id) on delete set null,
  related_type text,
  related_id uuid,
  payload jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed', 'skipped')),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_automation_events_status
  on public.automation_events (status, created_at);
create index if not exists idx_automation_events_type
  on public.automation_events (event_type, created_at desc);

-- ============================================================================
-- 18. activity_logs — nhat ky hanh vi nguoi dung (xem [G])
--     KHAC audit_logs (CU, thao tac admin): day la hanh vi hoc vien
--     (xem bai, tim kiem, click...). Chi ghi muc dich phan tich,
--     KHONG ghi PII (khong SDT/email) vao details.
-- ============================================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_activity_logs_user
  on public.activity_logs (user_id, created_at desc);
create index if not exists idx_activity_logs_action
  on public.activity_logs (action, created_at desc);

-- ============================================================================
-- 19. system_settings — cau hinh he thong dang key/value
--     value: jsonb de linh hoat kieu. is_public: true = client duoc
--     doc qua API (vd: ten hien thi, banner); false = chi admin.
-- ============================================================================
create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_system_settings_public
  on public.system_settings (key) where is_public = true;

-- ============================================================================
-- 20. course_instructors — giang vien phu trach khoa hoc
--     (DECISIONS Task 02 #3: TAO BANG MIGRATION MOI SAU KHI DUYET;
--      0001 da ghi ro khong tu y them o Module 1.)
--     role: 'lead' (phu trach chinh) / 'assistant' (tro giang).
--     Day la bang lam co so cho policy instructor o 0006.
-- ============================================================================
create table if not exists public.course_instructors (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'assistant'
    check (role in ('lead', 'assistant')),
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index if not exists idx_course_instructors_course
  on public.course_instructors (course_id);
create index if not exists idx_course_instructors_user
  on public.course_instructors (user_id);

-- ============================================================================
-- Trigger updated_at cho cac bang moi (dung lai ham 0001)
-- ============================================================================
do $$
declare t text;
begin
  for t in select table_name from information_schema.tables
           where table_schema = 'public'
             and table_name in (
               'user_roles','categories','course_modules','lesson_resources',
               'learning_events','quizzes','questions','answers',
               'assignments','submissions','submission_reviews','order_items',
               'coupons','membership_plans','memberships','notifications',
               'automation_events','activity_logs','system_settings',
               'course_instructors')
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
-- KIEM TRA SAU KHI CHAY (chay tay, khong tu dong doi du lieu):
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('user_roles','categories','course_modules',
--       'lesson_resources','learning_events','quizzes','questions',
--       'answers','assignments','submissions','submission_reviews',
--       'order_items','coupons','membership_plans','memberships',
--       'notifications','automation_events','activity_logs',
--       'system_settings','course_instructors');
--   -- Ky vong: 20 dong. Bang cu modules / quiz_questions VAN TON TAI
--   -- song song sau file nay — do la co y (xem [A]/[B] va 0005).
-- ============================================================================
