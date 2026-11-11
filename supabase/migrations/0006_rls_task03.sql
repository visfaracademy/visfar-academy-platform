-- ============================================================================
-- Visfar Academy — Task 03 — Migration 0006 — RLS CHO BANG MOI
-- THIET KE — CHUA AP DUNG, CHO PHE DUYET — 10/11/2026
-- ----------------------------------------------------------------------------
-- CHI LA FILE THIET KE. KHONG chay len Supabase that, KHONG deploy.
-- Phu thuoc: 0001 (ham public.current_role(), cac bang cu + policy cu),
-- 0004 (20 bang moi), 0005 (neu da chay: ten bang moi la ten chuan;
-- neu CHUA chay 0005: cac policy duoi day van dung duoc vi ten bang
-- moi o 0004 da la ten moi — chi co policy cho course_modules /
-- questions la ap cho bang moi (trong), chua phai du lieu cu).
--
-- MA TRAN QUYEN AP DUNG (kien truc §5.2/§6 + DECISIONS Task 02 #6):
--   * Hoc vien (student): CHI xem du lieu CA NHAN (enrollment, tien do,
--     bai nop, chung chi, don, thong bao cua minh). Khong xem du lieu
--     nguoi khac, khong xem dap an dung quiz, khong xem SDT/email
--     hoc vien khac, khong xem lead/don/payment cua nguoi khac.
--   * Giang vien (instructor): CHI quan ly khoa DUOC GIAO qua bang
--     course_instructors (0004 muc 20; DECISIONS Task 02 #3). Duoc
--     xem dap an dung quiz, SDT/email hoc vien, tien do, bai nop
--     cua khoa phu trach; duoc quan ly blog/su kien (theo ma tran
--     da duyet, Task 02 #6). KHONG xem lead, KHONG xem don/payment
--     (tru don cua chinh minh), KHONG doi gia khoa, KHONG cap role.
--   * Admin: toan quyen DOC (va ghi, tru cac bang chi ghi qua Workers).
--   * Khach (anon, chua dang nhap): CHI doc noi dung cong khai
--     (categories, membership_plans active, system_settings is_public,
--     course_modules/quizzes/questions cua khoa published — qua
--     policy SELECT cong khai giong 0001; KHONG doc bai nop, dap an,
--     don, thong bao).
--
-- NGUYEN TAC CU THE CHO FILE NAY:
--   1. ENABLE ROW LEVEL SECURITY tren MOI bang moi (20 bang). Khong
--      co policy = mac dinh TU CHOI.
--   2. KHONG cho anon INSERT vao leads / orders / payments: file nay
--      KHONG tao bat ky policy INSERT nao cho cac bang do (giong 0001);
--      lead/don/payment chi tao qua Workers API bang service-role.
--      Muc 4 duoi day co khoi KIEM TRA (truy van pg_policies) de
--      khang dinh khong ton tai policy INSERT cho anon/authenticated
--      tren 3 bang nay — neu phat hien co, phai xoa ngay.
--   3. KHONG cho client SELECT truc tiep dap an dung (quiz_options.
--      is_correct): khong co policy SELECT nao cho anon/student tren
--      bang quiz_options; student chi doc VIEW quiz_options_public
--      (khong co is_correct, da co o 0001). Chi admin va instructor
--      (khoa phu trach) duoc SELECT truc tiep — theo DECISIONS
--      Task 02 #6 (instructor duoc xem dap an dung quiz).
--   4. Ghi nhay cam (orders, payments, quiz_attempts, answers,
--      enrollments, certificates, notifications, automation_events)
--      KHONG co policy INSERT/UPDATE cho client — chi Workers
--      (service-role, bypass RLS) ghi sau khi kiem tra nghiep vu.
--      Ngoai le co chu dich: submissions (hoc vien nop bai cua minh),
--      activity_logs (ghi hanh vi cua minh), notifications (hoc vien
--      tu danh dau da doc cua minh) — xem ghi chu tung bang.
--   5. Role duoc doc qua public.current_role() (0001, doc tu
--      profiles.role). Cho toi khi code chuyen sang user_roles
--      (0005 muc 5), profiles.role VAN la nguon su that ve role.
-- ============================================================================

-- ============================================================================
-- MUC 0 — Ham phu: instructor co phu trach khoa nay khong?
--   SECURITY DEFINER de doc course_instructors ngay ca khi RLS chan
--   user doc bang do truc tiep (mau theo current_role() o 0001).
-- ============================================================================
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

-- Ham phu: course_id cua 1 lesson (dung trong policy lesson_resources /
-- assignments khi chi co lesson_id). Tra NULL neu lesson khong ton tai.
create or replace function public.course_of_lesson(p_lesson_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.course_id
  from public.lessons l
  join public.course_modules cm on cm.id = l.course_module_id
  where l.id = p_lesson_id;
$$;
-- Luu y: ham tren dung ten cot course_module_id (sau 0005 muc 2).
-- Neu 0005 CHUA chay, cot van ten module_id — sua thanh
--   join public.modules m on m.id = l.module_id
-- truoc khi chay file nay tren staging. Day la diem phu thuoc
-- 0005 can kiem tra khi ap dung (xem muc kiem tra cuoi file).

-- ============================================================================
-- MUC 1 — ENABLE RLS tren MOI bang moi (20 bang)
-- ============================================================================
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.course_modules enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.learning_events enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_reviews enable row level security;
alter table public.order_items enable row level security;
alter table public.coupons enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.notifications enable row level security;
alter table public.automation_events enable row level security;
alter table public.activity_logs enable row level security;
alter table public.system_settings enable row level security;
alter table public.course_instructors enable row level security;

-- ============================================================================
-- MUC 2 — Policy cho tung bang moi
--   (Bo qua "drop policy if exists" o day: file thiet ke chay 1 lan;
--    khi chay lai tren staging, them "drop policy if exists ..." truoc
--    moi create policy de idempotent — xem ghi chu cuoi file.)
-- ============================================================================

-- --- 2.1 user_roles: minh doc cua minh; admin toan quyen.
--     Cap/thu role chi admin (qua Workers, ghi audit_logs) — khong co
--     policy INSERT/UPDATE cho client.
create policy "user_roles_select_own" on public.user_roles
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "user_roles_admin_all" on public.user_roles
  for all using (public.current_role() = 'admin');

-- --- 2.2 categories: ai cung doc danh muc dang hoat dong; chi admin ghi.
create policy "categories_select_public" on public.categories
  for select using (is_active = true or public.current_role() = 'admin');
create policy "categories_admin_all" on public.categories
  for all using (public.current_role() = 'admin');

-- --- 2.3 course_modules: doc neu khoa published (giong modules o 0001);
--     instructor khoa phu trach + admin ghi.
create policy "course_modules_select_public" on public.course_modules
  for select using (
    exists (select 1 from public.courses c
            where c.id = course_modules.course_id
              and (c.status = 'published' or public.current_role() = 'admin'))
  );
create policy "course_modules_instructor_manage" on public.course_modules
  for all using (public.is_instructor_of(course_modules.course_id));
create policy "course_modules_admin_all" on public.course_modules
  for all using (public.current_role() = 'admin');

-- --- 2.4 lesson_resources: doc neu khoa published; instructor khoa
--     phu trach + admin ghi. (Kiem tra "da ghi danh moi tai file"
--     thuc hien o API — RLS chi chan khoa draft/archived.)
create policy "lesson_resources_select_public" on public.lesson_resources
  for select using (
    exists (select 1 from public.lessons l
            join public.course_modules cm on cm.id = l.course_module_id
            join public.courses c on c.id = cm.course_id
            where l.id = lesson_resources.lesson_id
              and (c.status = 'published' or public.current_role() = 'admin'))
  );
create policy "lesson_resources_instructor_manage" on public.lesson_resources
  for all using (
    public.is_instructor_of(public.course_of_lesson(lesson_resources.lesson_id))
  );
create policy "lesson_resources_admin_all" on public.lesson_resources
  for all using (public.current_role() = 'admin');

-- --- 2.5 learning_events: hoc vien DA GHI DANH khoa moi xem (ke ca
--     meeting_url); instructor khoa phu trach + admin toan quyen.
--     Khach chua dang nhap khong xem duoc gi.
create policy "learning_events_select_enrolled" on public.learning_events
  for select using (
    exists (select 1 from public.enrollments e
            where e.course_id = learning_events.course_id
              and e.user_id = auth.uid())
    or public.is_instructor_of(learning_events.course_id)
    or public.current_role() = 'admin'
  );
create policy "learning_events_instructor_manage" on public.learning_events
  for all using (public.is_instructor_of(learning_events.course_id));
create policy "learning_events_admin_all" on public.learning_events
  for all using (public.current_role() = 'admin');

-- --- 2.6 quizzes: doc neu khoa published (giong lessons); instructor
--     khoa phu trach + admin ghi.
create policy "quizzes_select_public" on public.quizzes
  for select using (
    exists (select 1 from public.courses c
            where c.id = quizzes.course_id
              and (c.status = 'published' or public.current_role() = 'admin'))
  );
create policy "quizzes_instructor_manage" on public.quizzes
  for all using (public.is_instructor_of(quizzes.course_id));
create policy "quizzes_admin_all" on public.quizzes
  for all using (public.current_role() = 'admin');

-- --- 2.7 questions: nhu quizzes; instructor khoa phu trach + admin ghi.
create policy "questions_select_public" on public.questions
  for select using (
    exists (select 1 from public.quizzes z
            join public.courses c on c.id = z.course_id
            where z.id = questions.quiz_id
              and (c.status = 'published' or public.current_role() = 'admin'))
  );
create policy "questions_instructor_manage" on public.questions
  for all using (
    exists (select 1 from public.quizzes z
            where z.id = questions.quiz_id
              and public.is_instructor_of(z.course_id))
  );
create policy "questions_admin_all" on public.questions
  for all using (public.current_role() = 'admin');

-- --- 2.8 answers: CHI doc dap an cua CHINH MINH (qua quiz_attempts),
--     instructor khoa phu trach, admin. KHONG co policy INSERT/UPDATE
--     cho client — dap an chi ghi qua Workers khi cham quiz o server.
create policy "answers_select_own" on public.answers
  for select using (
    exists (select 1 from public.quiz_attempts qa
            where qa.id = answers.attempt_id
              and qa.user_id = auth.uid())
    or exists (select 1 from public.questions qq
               join public.quizzes z on z.id = qq.quiz_id
               where qq.id = answers.question_id
                 and public.is_instructor_of(z.course_id))
    or public.current_role() = 'admin'
  );

-- --- 2.9 assignments: hoc vien da ghi danh khoa moi xem; instructor
--     khoa phu trach + admin quan ly.
create policy "assignments_select_enrolled" on public.assignments
  for select using (
    exists (select 1 from public.enrollments e
            where e.course_id = assignments.course_id
              and e.user_id = auth.uid())
    or public.is_instructor_of(assignments.course_id)
    or public.current_role() = 'admin'
  );
create policy "assignments_instructor_manage" on public.assignments
  for all using (public.is_instructor_of(assignments.course_id));
create policy "assignments_admin_all" on public.assignments
  for all using (public.current_role() = 'admin');

-- --- 2.10 submissions: hoc vien xem/nop bai CUA MINH; instructor khoa
--      phu trach + admin xem tat ca bai cua khoa. Hoc vien duoc INSERT
--      bai cua minh (nop bai la hanh dong cua chinh hoc vien, giong
--      event_registrations o 0001); khong duoc UPDATE/DELETE bai da nop
--      (muon nop lai thi tao submission moi — lich su duoc giu).
create policy "submissions_select_own" on public.submissions
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.assignments a
               where a.id = submissions.assignment_id
                 and public.is_instructor_of(a.course_id))
    or public.current_role() = 'admin'
  );
create policy "submissions_insert_own" on public.submissions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.enrollments e
                join public.assignments a on a.course_id = e.course_id
                where a.id = submissions.assignment_id
                  and e.user_id = auth.uid())
  );

-- --- 2.11 submission_reviews: nguoi nop xem review bai cua minh;
--      instructor khoa phu trach + admin xem va ghi review.
create policy "submission_reviews_select" on public.submission_reviews
  for select using (
    exists (select 1 from public.submissions s
            where s.id = submission_reviews.submission_id
              and s.user_id = auth.uid())
    or exists (select 1 from public.submissions s
               join public.assignments a on a.id = s.assignment_id
               where s.id = submission_reviews.submission_id
                 and public.is_instructor_of(a.course_id))
    or public.current_role() = 'admin'
  );
create policy "submission_reviews_instructor_manage" on public.submission_reviews
  for all using (
    exists (select 1 from public.submissions s
            join public.assignments a on a.id = s.assignment_id
            where s.id = submission_reviews.submission_id
              and public.is_instructor_of(a.course_id))
    or public.current_role() = 'admin'
  );

-- --- 2.12 order_items: chu don xem dong hang cua don minh; admin xem
--      tat ca. KHONG co policy INSERT/UPDATE cho client — chi Workers.
create policy "order_items_select_own" on public.order_items
  for select using (
    exists (select 1 from public.orders o
            where o.id = order_items.order_id
              and (o.user_id = auth.uid() or public.current_role() = 'admin'))
  );

-- --- 2.13 coupons: admin quan ly; user da dang nhap duoc doc coupon
--      dang hoat dong (de ap ma o checkout — API van kiem tra lai
--      han su dung / luot dung o server). Khach chua dang nhap khong doc.
create policy "coupons_select_active" on public.coupons
  for select using (
    (is_active = true and auth.uid() is not null)
    or public.current_role() = 'admin'
  );
create policy "coupons_admin_all" on public.coupons
  for all using (public.current_role() = 'admin');

-- --- 2.14 membership_plans: ai cung doc goi dang hoat dong; chi admin ghi.
create policy "membership_plans_select_public" on public.membership_plans
  for select using (is_active = true or public.current_role() = 'admin');
create policy "membership_plans_admin_all" on public.membership_plans
  for all using (public.current_role() = 'admin');

-- --- 2.15 memberships: minh + admin. KHONG co policy INSERT cho client
--      — goi thanh vien chi tao qua Workers khi don da tra.
create policy "memberships_select_own" on public.memberships
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "memberships_admin_all" on public.memberships
  for all using (public.current_role() = 'admin');

-- --- 2.16 notifications: minh + admin. Hoc vien duoc UPDATE is_read
--      cua thong bao minh (danh dau da doc); khong duoc INSERT/DELETE.
--      Thong bao chi tao qua Workers (service-role).
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "notifications_update_own_read" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notifications_admin_all" on public.notifications
  for all using (public.current_role() = 'admin');

-- --- 2.17 automation_events: chi admin doc; chi Workers ghi.
create policy "automation_events_admin_read" on public.automation_events
  for select using (public.current_role() = 'admin');

-- --- 2.18 activity_logs: minh doc cua minh + admin doc tat ca; minh
--      duoc INSERT hanh vi cua minh (khong ghi PII vao details —
--      kiem tra o API). Khong UPDATE/DELETE.
create policy "activity_logs_select_own" on public.activity_logs
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check (user_id = auth.uid() or user_id is null);

-- --- 2.19 system_settings: ai cung doc key is_public; chi admin ghi.
create policy "system_settings_select_public" on public.system_settings
  for select using (is_public = true or public.current_role() = 'admin');
create policy "system_settings_admin_all" on public.system_settings
  for all using (public.current_role() = 'admin');

-- --- 2.20 course_instructors: instructor xem phan cong CUA MINH;
--      admin toan quyen. Hoc vien khong doc bang nay truc tiep
--      (ten giang vien hien o trang khoa lay qua API).
create policy "course_instructors_select_own" on public.course_instructors
  for select using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "course_instructors_admin_all" on public.course_instructors
  for all using (public.current_role() = 'admin');

-- ============================================================================
-- MUC 3 — BO SUNG CHO BANG CU (theo DECISIONS Task 02 #6)
--   3a. quiz_options — DAP AN DUNG: them policy SELECT cho instructor
--       khoa phu trach (giang vien duoc xem dap an dung de cham/soat).
--       Student va anon VAN KHONG co policy SELECT truc tiep — chi doc
--       qua VIEW quiz_options_public (khong co is_correct, o 0001).
--       Admin da co policy FOR ALL o 0001 — giu nguyen.
-- ============================================================================
create policy "quiz_options_instructor_read" on public.quiz_options
  for select using (
    exists (select 1 from public.questions qq
            join public.lessons l on l.id = qq.lesson_id
            join public.course_modules cm on cm.id = l.course_module_id
            where qq.id = quiz_options.question_id
              and public.is_instructor_of(cm.course_id))
  );
-- Luu y phu thuoc 0005: policy nay dung ten moi questions /
-- course_modules / course_module_id (sau 0005). Neu 0005 chua chay,
-- thay "public.questions" thanh "public.quiz_questions",
-- "public.course_modules" thanh "public.modules" va
-- "l.course_module_id" thanh "l.module_id" truoc khi chay file nay
-- tren staging.

--   3b. profiles — instructor duoc doc SDT/email hoc vien CUA KHOA
--       PHU TRACH (Task 02 #6). Policy cu o 0001 chi cho "minh + admin".
--       Them policy rieng cho instructor (chi khi co enrollment chung
--       khoa). Khong mo rong cho instructor xem moi profile.
create policy "profiles_instructor_read_students" on public.profiles
  for select using (
    exists (select 1 from public.enrollments e
            join public.course_instructors ci on ci.course_id = e.course_id
            where e.user_id = profiles.id
              and ci.user_id = auth.uid())
  );

-- ============================================================================
-- MUC 4 — KHANG DINH "KHONG CHO ANON INSERT / KHONG CHO CLIENT DOC DAP AN"
--   File nay KHONG tao policy INSERT nao cho leads/orders/payments va
--   KHONG tao policy SELECT nao cho anon/student tren quiz_options.
--   Cac truy van kiem tra duoi day PHAI tra ve 0 dong sau khi chay
--   (chay tay tren staging). Neu tra ve > 0 dong, co policy thua —
--   xoa policy do truoc khi dua len prod.
--     select policyname, tablename, cmd from pg_policies
--     where schemaname = 'public'
--       and tablename in ('leads','orders','payments')
--       and cmd in ('INSERT','UPDATE','DELETE')
--       and roles::text like '%anon%';
--     -- Ky vong: 0 dong (khong co policy INSERT/UPDATE/DELETE nao
--     -- cho anon tren 3 bang nay; policy hien co chi la SELECT
--     -- cho authenticated/admin o 0001).
--     select policyname, tablename, cmd from pg_policies
--     where schemaname = 'public' and tablename = 'quiz_options'
--       and cmd = 'SELECT';
--     -- Ky vong: chi 2 policy — "quiz_options_admin_all" (0001) va
--     -- "quiz_options_instructor_read" (muc 3a). Khong co policy
--     -- SELECT nao mo cho moi authenticated user.
--     select tablename from pg_tables
--     where schemaname = 'public'
--       and tablename in ('user_roles','categories','course_modules',
--         'lesson_resources','learning_events','quizzes','questions',
--         'answers','assignments','submissions','submission_reviews',
--         'order_items','coupons','membership_plans','memberships',
--         'notifications','automation_events','activity_logs',
--         'system_settings','course_instructors')
--       and rowsecurity = false;
--     -- Ky vong: 0 dong (RLS bat tren moi bang moi).
-- ============================================================================

-- ============================================================================
-- GHI CHU KHI AP DUNG (khong phai SQL chay):
--   * Idempotent: de chay lai file nay tren staging, them
--     "drop policy if exists <ten> on public.<bang>;" truoc moi
--     "create policy" (ten policy da co dinh o tren).
--   * Thu tu: ham is_instructor_of / course_of_lesson phai tao TRUOC
--     policy dung chung. Neu 0005 chua chay, sua 2 cho ghi "phu
--     thuoc 0005" o tren truoc khi chay.
--   * Service-role (Workers API) bypass RLS — policy o day khong anh
--     huong duong ghi qua Workers; Workers van phai tu kiem tra role
--     + nghiep vu (kien truc §5.2: kiem tra 2 lop).
--   * Sau khi chay: kiem tra bang 1 tai khoan student that tren
--     staging — dam bao student KHONG doc duoc quiz_options truc
--     tiep, KHONG insert duoc leads/orders/payments, CHI thay du
--     lieu cua minh; instructor CHI thay khoa duoc giao.
-- ============================================================================
