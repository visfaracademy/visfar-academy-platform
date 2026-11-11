-- ============================================================================
-- Visfar Academy — Migration 0007 — fix blockers (Task 03)
-- Ngay: 10/11/2026
-- ----------------------------------------------------------------------------
-- MUC DICH: sua cac blocker phat hien khi ra soat 0001/0004/0005/0006 truoc
-- khi push lan dau. KHONG sua file 0001-0006 (lich su da duyet); moi sua
-- nam o day. Chay SAU 0004 -> 0005 -> 0006 (DECISIONS.md, Task 03 #14).
-- KHONG chay len DB that khi viet file nay; chi viet SQL.
--
-- CAN CU QUYET DINH (docs/DECISIONS.md, Task 03, chot 10/11/2026):
--   #2  answers -> quiz_answers; dap an dung giu o question_options;
--       quiz_answers.is_correct la ket qua cham o server;
--       UNIQUE (attempt_id, question_id, option_id) cho multiple-choice.
--   #3  user_roles la NGUON DUY NHAT cua role; profiles.role chi la cache
--       doc nhanh, dong bo bang trigger tu user_roles; RLS/API doc user_roles.
--   #4  Bang lua chon la question_options (ten moi cua quiz_options);
--       bo quiz_attempts.answers jsonb SAU KHI migrate (khong lam o file nay).
--   #6  Phuong an A: rename bang cu giu du lieu; VIEW ten cu chi tam thoi.
--   #7  Don nhieu khoa qua order_items (bo orders.course_id SAU backfill);
--       quiz_attempts chi giu quiz_id (bo lesson_id) — ca hai DEU CHUA lam
--       o file nay vi can code chuyen truoc; chi ghi nhan o day.
--   #9  (orders.user_id SET NULL + an danh) — khong thuoc pham vi file nay.
--   #11 Giao dich 0d duoc phep (CHECK >= 0); 7 key system_settings —
--       khong thuoc pham vi file nay.
--   Task 01 #9 (chot 10/11/2026): hoan tra 15 ngay lam viec; phan hoi
--       khieu nai trong 3 ngay.
--
-- NGUYEN TAC CUA FILE NAY:
--   * Idempotent: chay lai khong loi, khong doi du lieu. Moi buoc co guard
--     (to_regclass / information_schema / pg_constraint / pg_policies)
--     truoc khi lam; neu dieu kien khong dat thi RAISE NOTICE va bo qua.
--   * Postgres KHONG co cu phap "ALTER TABLE ... ADD CONSTRAINT
--     IF NOT EXISTS" — vi vay cac FK them o muc (a)/(b) phai kiem tra
--     pg_constraint trong DO block roi moi ALTER TABLE (xem ghi chu).
--   * RENAME TABLE o Postgres tu dong doi theo: FK tro toi bang do,
--     policy gan tren bang do (policy gan theo OID cua bang, khong theo
--     ten), RLS enabled, trigger tren bang do. Chi TEN policy /
--     TEN constraint / TEN index / TEN view la khong tu doi — file nay
--     doi ten thu cong cac ten do de nhat quan.
--
-- !!! CANH BAO BLOCKER (a)/(b) — DOC TRUOC KHI PUSH LAN DAU !!!
--   (a) 0001_init_schema.sql: CREATE TABLE enrollments o DONG 164, trong
--       khi CREATE TABLE orders moi o DONG 239. Cot enrollments.order_id
--       (dong 168) lai khai FK inline "references public.orders (id)".
--       Postgres KHONG cho FK tro toi bang chua ton tai, nen lenh CREATE
--       TABLE enrollments SE LOI ngay khi chay 0001 ("relation \"orders\"
--       does not exist"), bang enrollments se KHONG duoc tao (cac lenh
--       sau van co the chay tiep neu SQL Editor khong dung o loi dau).
--       -> 0007 KHONG CUU DUOC LOI NAY: muc (a) duoi day chi them FK khi
--       CA HAI bang enrollments + orders DA TON TAI. Neu enrollments
--       thieu (do 0001 loi), muc (a) chi bao NOTICE va dung lai.
--       -> PHAI SUA 0001 TRUOC KHI PUSH LAN DAU: chuyen khoi tao orders
--       (+ payments) LEN TREN enrollments, hoac bo FK inline khoi
--       enrollments va de 0007 them FK sau. Quyet dinh sua thuoc ve
--       nguoi duyet — file nay KHONG tu sua 0001.
--   (b) 0004_add_task03_tables.sql: CREATE TABLE order_items o DONG 324,
--       trong khi CREATE TABLE membership_plans moi o DONG 364. Cot
--       order_items.membership_plan_id (dong 328) khai FK inline
--       "references public.membership_plans (id)" — CUNG LOI TUONG TU:
--       lenh CREATE TABLE order_items SE LOI khi chay 0004, bang
--       order_items se KHONG duoc tao (cac bang sau — coupons,
--       membership_plans, memberships, ... — van co the duoc tao neu
--       chay tiep). -> PHAI SUA 0004 TRUOC KHI PUSH LAN DAU: chuyen
--       membership_plans LEN TREN order_items (ngay truoc muc 12),
--       hoac bo FK inline va de 0007 them FK sau. Muc (b) duoi day chi
--       them FK khi ca hai bang DA TON TAI.
--   (Da kiem tra thu tu thuc te bang grep ngay 10/11/2026 — xem muc
--    kiem chung cuoi file. Ngoai 2 cho tren, khong con FK xuoi nao khac
--    trong 0001/0004: cac FK con lai deu tro toi bang da tao truoc do.)
--
-- LUU Y KHAC (phat hien khi doc file goc, KHONG phai doan):
--   * (h) Task giao viet "UPDATE policies SET content = ..." — NHUNG cot
--     that trong 0001 (bang policies, dong ~317) va 0003 la "body", KHONG
--     co cot "content". File nay dung "body" cho dung schema; neu chay
--     dung "content" se loi "column content does not exist".
--   * (h) Chuoi goc trong 0003 con thua cum "... — can user duyet lai
--     truoc khi ap dung chinh thuc." sau cum can thay. Neu chi thay cum
--     theo dung lenh giao, cau van se doc la "... (da chot ngay
--     10/11/2026) — can user duyet lai truoc khi ap dung chinh thuc."
--     (tu mau thuan). File nay thay them cum thua do thanh dau "." va
--     ghi ro o muc (h).
--   * 0004-0006 hien van la FILE THIET KE o docs/database/
--     DATABASE_MIGRATIONS/ (chua nam trong supabase/migrations/).
--     Thu tu chay that phai la: dua 0004/0005/0006 vao supabase/migrations/
--     (sau khi sua blocker (b) o 0004), chay 0001-0006, roi moi chay 0007.
--   * Ten ham/cot dung o file nay deu doc tu file goc, khong doan:
--     profiles.role text NOT NULL DEFAULT 'student' CHECK IN
--     ('student','instructor','admin') — 0001; user_roles.user_id uuid
--     NOT NULL REFERENCES profiles(id), user_roles.role text NOT NULL
--     CHECK IN ('student','instructor','admin') — 0004 muc 1.
-- ============================================================================

-- ============================================================================
-- (a) FK enrollments.order_id -> orders.id (ON DELETE SET NULL, nhu 0001)
--     Guard: ca hai bang + cot phai ton tai; FK chua ton tai (kiem tra
--     pg_constraint theo cot, khong theo ten — vi neu 0001 co chay lot
--     thi ten constraint mac dinh la enrollments_order_id_fkey).
--     Neu enrollments thieu -> xem CANH BAO (a) o dau file: phai sua 0001.
-- ============================================================================
do $$
declare
  v_att smallint;
  v_has_fk boolean := false;
begin
  if to_regclass('public.enrollments') is null then
    raise notice '(a) BO QUA: bang public.enrollments KHONG ton tai — 0001 nhieu kha nang da loi o CREATE TABLE enrollments (dong 164, FK tro toi orders chua tao o dong 239). Sua thu tu tao bang trong 0001 truoc, chay lai 0001, roi chay lai 0007. 0007 khong tu tao lai bang enrollments.';
  elsif to_regclass('public.orders') is null then
    raise notice '(a) BO QUA: bang public.orders chua ton tai — chay 0001 (sau khi sua thu tu) truoc.';
  elsif not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'enrollments'
                      and column_name = 'order_id') then
    raise notice '(a) BO QUA: cot enrollments.order_id khong ton tai.';
  else
    select a.attnum into v_att
    from pg_attribute a
    where a.attrelid = 'public.enrollments'::regclass and a.attname = 'order_id';
    select exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.enrollments'::regclass
        and c.contype = 'f'
        and c.confrelid = 'public.orders'::regclass
        and c.conkey @> array[v_att]
    ) into v_has_fk;
    if v_has_fk then
      raise notice '(a) FK enrollments.order_id -> orders.id da ton tai, khong them lai.';
    else
      execute 'alter table public.enrollments '
           || 'add constraint enrollments_order_id_fkey '
           || 'foreign key (order_id) references public.orders (id) on delete set null';
      raise notice '(a) OK: da them FK enrollments_order_id_fkey (order_id -> orders.id, ON DELETE SET NULL).';
    end if;
  end if;
end $$;

-- ============================================================================
-- (b) FK order_items.membership_plan_id -> membership_plans.id
--     (ON DELETE SET NULL, nhu 0004 muc 12)
--     Guard nhu (a). Neu order_items thieu -> xem CANH BAO (b) o dau file:
--     phai sua 0004 (chuyen membership_plans len truoc order_items).
-- ============================================================================
do $$
declare
  v_att smallint;
  v_has_fk boolean := false;
begin
  if to_regclass('public.order_items') is null then
    raise notice '(b) BO QUA: bang public.order_items KHONG ton tai — 0004 nhieu kha nang da loi o CREATE TABLE order_items (dong 324, FK tro toi membership_plans chua tao o dong 364). Sua thu tu tao bang trong 0004 truoc, chay lai 0004, roi chay lai 0007. 0007 khong tu tao lai bang order_items.';
  elsif to_regclass('public.membership_plans') is null then
    raise notice '(b) BO QUA: bang public.membership_plans chua ton tai — chay 0004 (sau khi sua thu tu) truoc.';
  elsif not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'order_items'
                      and column_name = 'membership_plan_id') then
    raise notice '(b) BO QUA: cot order_items.membership_plan_id khong ton tai.';
  else
    select a.attnum into v_att
    from pg_attribute a
    where a.attrelid = 'public.order_items'::regclass and a.attname = 'membership_plan_id';
    select exists (
      select 1 from pg_constraint c
      where c.conrelid = 'public.order_items'::regclass
        and c.contype = 'f'
        and c.confrelid = 'public.membership_plans'::regclass
        and c.conkey @> array[v_att]
    ) into v_has_fk;
    if v_has_fk then
      raise notice '(b) FK order_items.membership_plan_id -> membership_plans.id da ton tai, khong them lai.';
    else
      execute 'alter table public.order_items '
           || 'add constraint order_items_membership_plan_id_fkey '
           || 'foreign key (membership_plan_id) references public.membership_plans (id) on delete set null';
      raise notice '(b) OK: da them FK order_items_membership_plan_id_fkey (membership_plan_id -> membership_plans.id, ON DELETE SET NULL).';
    end if;
  end if;
end $$;

-- ============================================================================
-- (c) Doi ten answers -> quiz_answers (Task 03 #2)
--     - Policy "answers_select_own" (0006 muc 2.8) gan theo OID cua bang
--       nen TU DONG theo sang ten moi sau RENAME — khong mat policy.
--       File nay chi doi TEN policy cho nhat quan (drop + tao lai cung
--       dinh nghia, doi answers. -> quiz_answers.); neu 0006 chua chay
--       (chua co policy) thi chi bao NOTICE, khong tu tao policy moi
--       (policy thuoc pham vi 0006).
--     - RLS da bat tren answers o 0006 muc 1 cung tu theo rename.
--     - UNIQUE cu (attempt_id, question_id) -> UNIQUE moi
--       (attempt_id, question_id, option_id) de ho tro multiple-choice.
--       LUU Y: option_id NULL (cau short_answer / tu luan) — Postgres
--       coi NULL la khac nhau trong UNIQUE nen nhieu dong NULL option_id
--       van lot duoc; rang buoc "1 cau / 1 lan lam" voi cau tu luan phai
--       kiem tra o API, khong dua hoan toan vao UNIQUE nay.
-- ============================================================================
do $$
begin
  if to_regclass('public.answers') is not null
     and to_regclass('public.quiz_answers') is null then
    execute 'alter table public.answers rename to quiz_answers';
    raise notice '(c) OK: answers -> quiz_answers.';
  elsif to_regclass('public.quiz_answers') is not null
        and to_regclass('public.answers') is null then
    raise notice '(c) Bang da ten quiz_answers, khong can rename lai.';
  elsif to_regclass('public.quiz_answers') is not null
        and to_regclass('public.answers') is not null then
    raise notice '(c) CANH BAO: ca answers VA quiz_answers deu ton tai — dung lai, doi soat tay xem bang nao moi la du lieu that truoc khi rename/xoa. Khong tu dong lam gi them o buoc rename.';
  else
    raise notice '(c) BO QUA: khong co bang answers / quiz_answers — 0004 chua chay.';
  end if;
end $$;

-- Doi ten index cho nhat quan (ten cu van chay tot sau rename, chi doi ten).
alter index if exists idx_answers_attempt rename to idx_quiz_answers_attempt;
alter index if exists idx_answers_question rename to idx_quiz_answers_question;

-- Doi ten FK answers.option_id -> quiz_options.id (ten constraint khong
-- tu doi khi rename bang; dich FK thi tu doi theo OID — muc (d) kiem
-- tra lai dich sau khi quiz_options doi ten).
do $$
begin
  if to_regclass('public.quiz_answers') is not null
     and exists (select 1 from pg_constraint
                 where conrelid = 'public.quiz_answers'::regclass
                   and conname = 'answers_option_id_fkey')
     and not exists (select 1 from pg_constraint
                     where conrelid = 'public.quiz_answers'::regclass
                       and conname = 'quiz_answers_option_id_fkey') then
    execute 'alter table public.quiz_answers rename constraint answers_option_id_fkey to quiz_answers_option_id_fkey';
    raise notice '(c) OK: constraint answers_option_id_fkey -> quiz_answers_option_id_fkey.';
  end if;
end $$;

-- Doi UNIQUE (attempt_id, question_id) -> (attempt_id, question_id, option_id).
do $$
declare
  v_old_key smallint[];
  v_new_key smallint[];
  r record;
  v_dup bigint;
begin
  if to_regclass('public.quiz_answers') is null then
    raise notice '(c) BO QUA doi UNIQUE: bang quiz_answers khong ton tai.';
  else
    select array_agg(a.attnum order by a.attnum) into v_old_key
    from pg_attribute a
    where a.attrelid = 'public.quiz_answers'::regclass
      and a.attname in ('attempt_id', 'question_id');
    select array_agg(a.attnum order by a.attnum) into v_new_key
    from pg_attribute a
    where a.attrelid = 'public.quiz_answers'::regclass
      and a.attname in ('attempt_id', 'question_id', 'option_id');

    -- Kiem tra trung LAP TRUOC KHI drop UNIQUE cu: neu du lieu hien co
    -- trung (attempt_id, question_id, option_id) thi DUNG LAI LOI LON
    -- (khong tu dong xoa du lieu, khong bo qua lang le) — va quan trong
    -- la chua drop gi ca, bang van giu UNIQUE cu neu chay tung lenh
    -- khong co transaction bao quanh.
    select count(*) into v_dup
    from (select attempt_id, question_id, option_id
          from public.quiz_answers
          group by attempt_id, question_id, option_id
          having count(*) > 1) s;
    if v_dup > 0 then
      raise exception '(c) DUNG LAI: co % nhom trung (attempt_id, question_id, option_id) trong quiz_answers — doi soat tay truoc khi dat UNIQUE moi.', v_dup;
    end if;

    -- Drop moi UNIQUE chi gom dung (attempt_id, question_id).
    for r in
      select c.conname from pg_constraint c
      where c.conrelid = 'public.quiz_answers'::regclass
        and c.contype = 'u' and c.conkey = v_old_key
    loop
      execute format('alter table public.quiz_answers drop constraint %I', r.conname);
      raise notice '(c) OK: da drop UNIQUE cu % (attempt_id, question_id).', r.conname;
    end loop;

    if not exists (select 1 from pg_constraint c
                   where c.conrelid = 'public.quiz_answers'::regclass
                     and c.contype = 'u' and c.conkey = v_new_key) then
      execute 'alter table public.quiz_answers '
           || 'add constraint quiz_answers_attempt_question_option_key '
           || 'unique (attempt_id, question_id, option_id)';
      raise notice '(c) OK: da them UNIQUE (attempt_id, question_id, option_id) — ho tro multiple-choice (Task 03 #2).';
    else
      raise notice '(c) UNIQUE (attempt_id, question_id, option_id) da ton tai, khong them lai.';
    end if;
  end if;
end $$;

-- Doi ten policy answers_select_own -> quiz_answers_select_own (0006 muc 2.8).
do $$
begin
  if to_regclass('public.quiz_answers') is null then
    raise notice '(c) BO QUA doi ten policy: bang quiz_answers khong ton tai.';
  elsif exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'quiz_answers'
                  and policyname = 'quiz_answers_select_own') then
    raise notice '(c) Policy quiz_answers_select_own da ton tai, khong can doi ten lai.';
  elsif exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'quiz_answers'
                  and policyname = 'answers_select_own') then
    execute 'drop policy "answers_select_own" on public.quiz_answers';
    execute 'create policy "quiz_answers_select_own" on public.quiz_answers '
         || 'for select using ('
         || 'exists (select 1 from public.quiz_attempts qa '
         || 'where qa.id = quiz_answers.attempt_id and qa.user_id = auth.uid()) '
         || 'or exists (select 1 from public.questions qq '
         || 'join public.quizzes z on z.id = qq.quiz_id '
         || 'where qq.id = quiz_answers.question_id '
         || 'and public.is_instructor_of(z.course_id)) '
         || 'or public.current_role() = ''admin'')';
    raise notice '(c) OK: policy answers_select_own -> quiz_answers_select_own (dinh nghia giu nguyen nhu 0006 muc 2.8).';
  else
    raise notice '(c) NOTICE: khong co policy answers_select_own tren quiz_answers — 0006 co the chua chay; policy thuoc pham vi 0006, 0007 khong tu tao.';
  end if;
end $$;

-- ============================================================================
-- (d) Doi ten quiz_options -> question_options (Task 03 #2/#4, phuong an A)
--     - VIEW quiz_options_public (0001, KHONG co is_correct) -> view moi
--       question_options_public cung cac cot (id, question_id, option_text,
--       display_order), khong them is_correct. Code frontend/API doc
--       view moi; view cu bi drop o duoi.
--     - FK quiz_answers.option_id -> question_options.id: sau RENAME,
--       FK tu tro sang bang moi theo OID (khong can sua dich); muc (d)
--       chi kiem tra lai bang pg_constraint va bao ket qua.
--     - Policy quiz_options_admin_all (0001) va quiz_options_instructor_read
--       (0006 muc 3a) cung tu theo rename (gan theo OID); file nay chi
--       doi TEN cho nhat quan. Policy instructor chi tao lai duoc khi
--       0005 da chay (can questions.lesson_id + lessons.course_module_id
--       + ham is_instructor_of); neu chua du dieu kien thi GIU TEN CU
--       (policy van chay dung) va bao NOTICE — khong drop truoc roi moi
--       biet la khong tao lai duoc.
-- ============================================================================
do $$
begin
  if to_regclass('public.quiz_options') is not null
     and to_regclass('public.question_options') is null then
    execute 'alter table public.quiz_options rename to question_options';
    raise notice '(d) OK: quiz_options -> question_options.';
  elsif to_regclass('public.question_options') is not null
        and to_regclass('public.quiz_options') is null then
    raise notice '(d) Bang da ten question_options, khong can rename lai.';
  elsif to_regclass('public.question_options') is not null
        and to_regclass('public.quiz_options') is not null then
    raise notice '(d) CANH BAO: ca quiz_options VA question_options deu ton tai — dung lai, doi soat tay truoc khi rename/xoa. Khong tu dong lam gi them o buoc rename.';
  else
    raise notice '(d) BO QUA: khong co bang quiz_options / question_options — 0001 chua chay.';
  end if;
end $$;

-- View moi (khong co is_correct) + drop view cu. Chi lam khi bang moi co.
do $$
begin
  if to_regclass('public.question_options') is null then
    raise notice '(d) BO QUA view: bang question_options khong ton tai.';
  else
    execute 'create or replace view public.question_options_public as '
         || 'select id, question_id, option_text, display_order '
         || 'from public.question_options';
    execute 'grant select on public.question_options_public to anon, authenticated';
    execute 'drop view if exists public.quiz_options_public';
    raise notice '(d) OK: view question_options_public (khong co is_correct) da tao; view cu quiz_options_public da drop. Frontend/API doc view moi.';
  end if;
end $$;

-- Kiem tra FK quiz_answers.option_id (hoac answers.option_id neu (c) chua
-- rename) dang tro toi question_options.id; doi ten constraint neu con ten cu.
do $$
declare
  v_tbl regclass;
  v_has_fk boolean := false;
begin
  if to_regclass('public.quiz_answers') is not null then
    v_tbl := 'public.quiz_answers'::regclass;
  elsif to_regclass('public.answers') is not null then
    v_tbl := 'public.answers'::regclass;
  end if;

  if v_tbl is null then
    raise notice '(d) BO QUA kiem tra FK option_id: khong co bang quiz_answers / answers.';
  elsif to_regclass('public.question_options') is null then
    raise notice '(d) BO QUA kiem tra FK option_id: bang question_options khong ton tai.';
  else
    if exists (select 1 from pg_constraint
               where conrelid = v_tbl and conname = 'answers_option_id_fkey')
       and not exists (select 1 from pg_constraint
                       where conrelid = v_tbl and conname = 'quiz_answers_option_id_fkey') then
      execute format('alter table %s rename constraint answers_option_id_fkey to quiz_answers_option_id_fkey', v_tbl);
      raise notice '(d) OK: constraint answers_option_id_fkey -> quiz_answers_option_id_fkey.';
    end if;
    select exists (
      select 1 from pg_constraint c
      where c.conrelid = v_tbl and c.contype = 'f'
        and c.confrelid = 'public.question_options'::regclass
    ) into v_has_fk;
    if v_has_fk then
      raise notice '(d) OK: FK %.option_id -> question_options.id dang ton tai (tu doi theo sau RENAME).', v_tbl;
    else
      raise notice '(d) CANH BAO: khong tim thay FK tu %.option_id sang question_options.id — kiem tra tay, co the 0004 chua chay hoac FK da bi xoa.', v_tbl;
    end if;
  end if;
end $$;

-- Doi ten policy quiz_options_admin_all -> question_options_admin_all (0001).
do $$
begin
  if to_regclass('public.question_options') is null then
    raise notice '(d) BO QUA doi ten policy admin: bang question_options khong ton tai.';
  elsif exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'question_options'
                  and policyname = 'question_options_admin_all') then
    raise notice '(d) Policy question_options_admin_all da ton tai, khong can doi ten lai.';
  elsif exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'question_options'
                  and policyname = 'quiz_options_admin_all') then
    execute 'drop policy "quiz_options_admin_all" on public.question_options';
    execute 'create policy "question_options_admin_all" on public.question_options '
         || 'for all using (public.current_role() = ''admin'')';
    raise notice '(d) OK: policy quiz_options_admin_all -> question_options_admin_all.';
  else
    raise notice '(d) NOTICE: khong co policy quiz_options_admin_all tren question_options — 0001 co the chua chay day du; 0007 khong tu tao.';
  end if;
end $$;

-- Doi ten policy quiz_options_instructor_read -> question_options_instructor_read
-- (0006 muc 3a). CHI doi ten khi du dieu kien tao lai (0005 da chay).
do $$
declare
  v_can boolean := false;
begin
  if to_regclass('public.question_options') is null then
    raise notice '(d) BO QUA doi ten policy instructor: bang question_options khong ton tai.';
  elsif exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'question_options'
                  and policyname = 'question_options_instructor_read') then
    raise notice '(d) Policy question_options_instructor_read da ton tai, khong can doi ten lai.';
  elsif not exists (select 1 from pg_policies
                     where schemaname = 'public' and tablename = 'question_options'
                       and policyname = 'quiz_options_instructor_read') then
    raise notice '(d) NOTICE: khong co policy quiz_options_instructor_read tren question_options — 0006 muc 3a co the chua chay; 0007 khong tu tao.';
  else
    -- Dieu kien tao lai: questions.lesson_id + lessons.course_module_id
    -- (0005 muc 2-3) + ham is_instructor_of (0006 muc 0).
    v_can := to_regclass('public.questions') is not null
      and to_regclass('public.course_modules') is not null
      and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'questions'
                    and column_name = 'lesson_id')
      and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lessons'
                    and column_name = 'course_module_id')
      and exists (select 1 from pg_proc
                  where proname = 'is_instructor_of'
                    and pronamespace = 'public'::regnamespace);
    if v_can then
      execute 'drop policy "quiz_options_instructor_read" on public.question_options';
      execute 'create policy "question_options_instructor_read" on public.question_options '
           || 'for select using ('
           || 'exists (select 1 from public.questions qq '
           || 'join public.lessons l on l.id = qq.lesson_id '
           || 'join public.course_modules cm on cm.id = l.course_module_id '
           || 'where qq.id = question_options.question_id '
           || 'and public.is_instructor_of(cm.course_id)))';
      raise notice '(d) OK: policy quiz_options_instructor_read -> question_options_instructor_read (dinh nghia giu nguyen nhu 0006 muc 3a).';
    else
      raise notice '(d) GIU TEN CU: policy quiz_options_instructor_read van ton tai va van chay dung tren bang da doi ten (gan theo OID); chua doi ten vi thieu dieu kien tao lai — can questions.lesson_id / lessons.course_module_id (0005) hoac ham is_instructor_of (0006). Chay lai 0007 sau khi 0005+0006 day du.';
    end if;
  end if;
end $$;

-- ============================================================================
-- (e) Trigger dong bo user_roles -> profiles.role (Task 03 #3)
--     user_roles la nguon duy nhat; profiles.role chi la cache doc nhanh.
--     - Thu tu uu tien khi 1 user co nhieu role: admin > instructor > student.
--     - Khi xoa role cuoi cung: profiles.role ve 'student' (default 0001).
--     - Ham phu sync_one_profile_role() de trigger + resync 1 lan dung chung.
--     - Ten cot da doc tu file goc (khong doan): profiles.role text,
--       user_roles.user_id uuid, user_roles.role text — xem header.
--     - RLS/API van phai doc user_roles theo #3 (doi code, khong phai
--       migration); trigger o day chi giu cache profiles.role dong bo.
-- ============================================================================
create or replace function public.sync_one_profile_role(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_user_id is null then
    return;
  end if;
  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = p_user_id
  order by case ur.role when 'admin' then 1 when 'instructor' then 2 else 3 end
  limit 1;
  if v_role is null then
    v_role := 'student';
  end if;
  update public.profiles
  set role = v_role
  where id = p_user_id and role is distinct from v_role;
end;
$$;

create or replace function public.sync_profiles_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_one_profile_role(new.user_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_one_profile_role(old.user_id);
  end if;
  return coalesce(new, old);
end;
$$;

-- Tao trigger (guard: ca hai bang phai ton tai; ham tren tao duoc ca khi
-- bang chua co vi plpgsql khong kiem tra bang luc tao ham, nhung trigger
-- thi bat buoc bang phai ton tai).
do $$
begin
  if to_regclass('public.user_roles') is null
     or to_regclass('public.profiles') is null then
    raise notice '(e) BO QUA tao trigger: thieu bang user_roles hoac profiles — chay 0001 + 0004 truoc, roi chay lai 0007.';
  else
    execute 'drop trigger if exists trg_sync_profiles_role on public.user_roles';
    execute 'create trigger trg_sync_profiles_role '
         || 'after insert or update or delete on public.user_roles '
         || 'for each row execute function public.sync_profiles_role()';
    raise notice '(e) OK: trigger trg_sync_profiles_role (AFTER INSERT/UPDATE/DELETE ON user_roles) da tao.';
  end if;
end $$;

-- Resync 1 lan cho du lieu hien co (chi profile nao DA CO dong user_roles
-- moi duoc cap nhat — neu user_roles dang trong, KHONG dong vao profiles.role
-- de tranh ghi de admin/instructor thanh student).
do $$
declare
  v_n integer;
begin
  if to_regclass('public.user_roles') is null
     or to_regclass('public.profiles') is null then
    raise notice '(e) BO QUA resync 1 lan: thieu bang user_roles hoac profiles.';
  else
    update public.profiles p
    set role = s.role
    from (
      select distinct on (ur.user_id) ur.user_id, ur.role
      from public.user_roles ur
      order by ur.user_id,
        case ur.role when 'admin' then 1 when 'instructor' then 2 else 3 end
    ) s
    where s.user_id = p.id and p.role is distinct from s.role;
    get diagnostics v_n = row_count;
    raise notice '(e) Resync 1 lan: % profiles duoc cap nhat role theo user_roles (0 = da dong bo, hoac user_roles dang trong).', v_n;
  end if;
end $$;

-- ============================================================================
-- (f) Bucket Storage bang SQL (chi tao bucket; policy Storage chi tiet
--     lam o buoc sau, khong lam o file nay)
--     public = true chi cho 'public' va 'avatars'; con lai false.
--     Guard: schema storage / bang storage.buckets phai ton tai (project
--     Supabase da bat Storage). ON CONFLICT (id) DO NOTHING: bucket da
--     co thi giu nguyen cau hinh cu, khong ghi de public flag.
-- ============================================================================
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'storage' and table_name = 'buckets') then
    raise notice '(f) BO QUA: schema storage / bang storage.buckets khong ton tai — bat Storage tren Supabase truoc roi chay lai 0007.';
  else
    execute 'insert into storage.buckets (id, name, public) values '
         || '(''public'', ''public'', true), '
         || '(''avatars'', ''avatars'', true), '
         || '(''private'', ''private'', false), '
         || '(''receipts'', ''receipts'', false), '
         || '(''certificates'', ''certificates'', false) '
         || 'on conflict (id) do nothing';
    raise notice '(f) OK: bucket public/avatars (public) + private/receipts/certificates (rieng tu) da co (ON CONFLICT DO NOTHING — bucket cu giu nguyen). Policy Storage chi tiet lam o buoc sau.';
  end if;
end $$;

-- ============================================================================
-- (g) Don 2 bang tam _new_empty do 0005 muc 1/3 de lai
--     (course_modules_new_empty, questions_new_empty — bang thiet ke trong
--     cua 0004 duoc doi ten di cho de rename bang cu giu du lieu).
--     - Ton tai VA trong (count = 0) -> DROP TABLE.
--     - Ton tai VA CO DU LIEU -> RAISE NOTICE, GIU LAI, khong drop;
--       bat RLS cho chung (khong co policy = mac dinh tu choi; can them
--       policy neu muon doc duoc — service-role van bypass RLS).
--     - Khong ton tai -> NOTICE, bo qua.
-- ============================================================================
do $$
declare
  v_t text;
  v_n bigint;
begin
  foreach v_t in array array['course_modules_new_empty', 'questions_new_empty'] loop
    if to_regclass('public.' || v_t) is null then
      raise notice '(g) Bang % khong ton tai, bo qua.', v_t;
    else
      execute format('select count(*) from public.%I', v_t) into v_n;
      if v_n = 0 then
        execute format('drop table public.%I', v_t);
        raise notice '(g) OK: % dang trong (0 dong) — da DROP TABLE.', v_t;
      else
        execute format('alter table public.%I enable row level security', v_t);
        raise notice '(g) GIU LAI: % co % dong — KHONG drop; da bat RLS (chua co policy, mac dinh tu choi; doi soat tay truoc khi xoa).', v_t, v_n;
      end if;
    end if;
  end loop;
end $$;

-- ============================================================================
-- (h) Cap nhat seed 0003 — KHONG sua file 0003
--     Can cu: DECISIONS.md Task 01 #9 (chot 10/11/2026): hoan tra 15 ngay
--     lam viec; phan hoi khieu nai trong 3 ngay.
--     LUU Y QUAN TRONG (xem header): cot that la "body", KHONG phai
--     "content" nhu lenh giao viet — file nay dung "body".
--     Chi update dong is_current = true co chua cum "CHƯA được user duyệt"
--     (idempotent: chay lai thi WHERE khong match, 0 dong).
--     Cum goc thay the lay dung tu 0003 (noi chuoi || trong file seed):
--       hoan-tra:  'khung thời gian xử lý (3/7/15 ngày làm việc) trong bản
--                    hiện tại do builder viết, CHƯA được user duyệt'
--       khieu-nai: 'khung thời gian xử lý (3/15/30 ngày làm việc) trong bản
--                    hiện tại do builder viết, CHƯA được user duyệt'
--     Ngoai cum tren, cum thua " — cần user duyệt lại trước khi áp dụng
--     chính thức." cung duoc thay bang "." — neu khong, cau van se tu
--     mau thuan ("da chot" + "can user duyet lai"). Xem header.
-- ============================================================================
do $$
declare
  v_n integer;
begin
  if to_regclass('public.policies') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'policies'
                      and column_name = 'body') then
    raise notice '(h) BO QUA: bang public.policies / cot body khong ton tai — chay 0001 + 0003 truoc.';
  else
    update public.policies
    set body = replace(
      replace(body,
        'khung thời gian xử lý (3/7/15 ngày làm việc) trong bản hiện tại do builder viết, CHƯA được user duyệt',
        'khung hoàn trả 15 ngày làm việc (đã chốt ngày 10/11/2026)'),
      ' — cần user duyệt lại trước khi áp dụng chính thức.',
      '.')
    where slug = 'hoan-tra-huy-dang-ky'
      and is_current = true
      and body like '%CHƯA được user duyệt%';
    get diagnostics v_n = row_count;
    raise notice '(h) hoan-tra-huy-dang-ky: % dong cap nhat (0 = da cap nhat tu truoc hoac seed chua chay).', v_n;

    update public.policies
    set body = replace(
      replace(body,
        'khung thời gian xử lý (3/15/30 ngày làm việc) trong bản hiện tại do builder viết, CHƯA được user duyệt',
        'phản hồi khiếu nại trong 3 ngày (đã chốt ngày 10/11/2026)'),
      ' — cần user duyệt lại trước khi áp dụng chính thức.',
      '.')
    where slug = 'giai-quyet-khieu-nai'
      and is_current = true
      and body like '%CHƯA được user duyệt%';
    get diagnostics v_n = row_count;
    raise notice '(h) giai-quyet-khieu-nai: % dong cap nhat (0 = da cap nhat tu truoc hoac seed chua chay).', v_n;
  end if;
end $$;

-- ============================================================================
-- KIEM CHUNG (chi RAISE NOTICE + SELECT an toan, khong doi du lieu)
--   Chay luon o cuoi file. Neu mot muc bao "KHONG ton tai / BO QUA" thi
--   xem lai NOTICE cua muc do o tren de biet buoc tien quyet nao thieu.
-- ============================================================================
do $$
declare
  v_tables bigint;
  v_buckets bigint;
  v_storage boolean;
begin
  select count(*) into v_tables
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE';
  raise notice 'KIEM CHUNG: schema public co % bang (BASE TABLE).', v_tables;
  raise notice 'KIEM CHUNG: quiz_answers ton tai = % (ky vong: true).',
    (to_regclass('public.quiz_answers') is not null);
  raise notice 'KIEM CHUNG: question_options ton tai = % (ky vong: true).',
    (to_regclass('public.question_options') is not null);
  raise notice 'KIEM CHUNG: bang cu answers con ton tai = % (ky vong: false).',
    (to_regclass('public.answers') is not null);
  raise notice 'KIEM CHUNG: bang cu quiz_options con ton tai = % (ky vong: false).',
    (to_regclass('public.quiz_options') is not null);
  raise notice 'KIEM CHUNG: trigger trg_sync_profiles_role tren user_roles ton tai = % (ky vong: true).',
    (to_regclass('public.user_roles') is not null
     and exists (select 1 from pg_trigger
                 where tgrelid = 'public.user_roles'::regclass
                   and tgname = 'trg_sync_profiles_role'
                   and not tgisinternal));
  raise notice 'KIEM CHUNG: FK enrollments.order_id -> orders.id ton tai = % (ky vong: true; false = xem CANH BAO (a)).',
    (to_regclass('public.enrollments') is not null
     and to_regclass('public.orders') is not null
     and exists (select 1 from pg_constraint c
                 where c.conrelid = 'public.enrollments'::regclass
                   and c.contype = 'f'
                   and c.confrelid = 'public.orders'::regclass));
  raise notice 'KIEM CHUNG: FK order_items.membership_plan_id -> membership_plans.id ton tai = % (ky vong: true; false = xem CANH BAO (b)).',
    (to_regclass('public.order_items') is not null
     and to_regclass('public.membership_plans') is not null
     and exists (select 1 from pg_constraint c
                 where c.conrelid = 'public.order_items'::regclass
                   and c.contype = 'f'
                   and c.confrelid = 'public.membership_plans'::regclass));
  raise notice 'KIEM CHUNG: FK quiz_answers.option_id -> question_options.id ton tai = % (ky vong: true).',
    (to_regclass('public.quiz_answers') is not null
     and to_regclass('public.question_options') is not null
     and exists (select 1 from pg_constraint c
                 where c.conrelid = 'public.quiz_answers'::regclass
                   and c.contype = 'f'
                   and c.confrelid = 'public.question_options'::regclass));
  raise notice 'KIEM CHUNG: UNIQUE (attempt_id, question_id, option_id) tren quiz_answers ton tai = % (ky vong: true).',
    (to_regclass('public.quiz_answers') is not null
     and exists (select 1 from pg_constraint c
                 where c.conrelid = 'public.quiz_answers'::regclass
                   and c.contype = 'u'
                   and c.conname = 'quiz_answers_attempt_question_option_key'));
  raise notice 'KIEM CHUNG: view question_options_public ton tai = % (ky vong: true); view cu quiz_options_public con ton tai = % (ky vong: false).',
    (to_regclass('public.question_options_public') is not null),
    (to_regclass('public.quiz_options_public') is not null);
  raise notice 'KIEM CHUNG: bang tam course_modules_new_empty con ton tai = %; questions_new_empty con ton tai = % (ky vong: false neu ca hai deu trong luc chay).',
    (to_regclass('public.course_modules_new_empty') is not null),
    (to_regclass('public.questions_new_empty') is not null);

  select exists (select 1 from information_schema.tables
                 where table_schema = 'storage' and table_name = 'buckets')
    into v_storage;
  if v_storage then
    execute 'select count(*) from storage.buckets '
         || 'where id in (''public'', ''avatars'', ''private'', ''receipts'', ''certificates'')'
      into v_buckets;
    raise notice 'KIEM CHUNG: bucket du 5 (public/avatars/private/receipts/certificates) = % (ky vong: 5).', v_buckets;
  else
    raise notice 'KIEM CHUNG: storage.buckets khong ton tai — chua kiem duoc 5 bucket (xem muc (f)).';
  end if;

  if to_regclass('public.policies') is not null then
    raise notice 'KIEM CHUNG: seed hoan-tra da chot 15 ngay = %; seed khieu-nai da chot 3 ngay = %; ca hai con cum "CHƯA được user duyệt" = % (ky vong: true / true / false).',
      (exists (select 1 from public.policies
               where slug = 'hoan-tra-huy-dang-ky' and is_current = true
                 and body like '%khung hoàn trả 15 ngày làm việc (đã chốt ngày 10/11/2026)%')),
      (exists (select 1 from public.policies
               where slug = 'giai-quyet-khieu-nai' and is_current = true
                 and body like '%phản hồi khiếu nại trong 3 ngày (đã chốt ngày 10/11/2026)%')),
      (exists (select 1 from public.policies
               where slug in ('hoan-tra-huy-dang-ky', 'giai-quyet-khieu-nai')
                 and is_current = true
                 and body like '%CHƯA được user duyệt%'));
  end if;
end $$;

-- Kiem chung nhanh bang SELECT (an toan ca khi bang chua ton tai):
select 'quiz_answers' as doi_tuong, (to_regclass('public.quiz_answers') is not null) as ton_tai
union all select 'question_options', (to_regclass('public.question_options') is not null)
union all select 'question_options_public (view)', (to_regclass('public.question_options_public') is not null)
union all select 'trigger trg_sync_profiles_role', (to_regclass('public.user_roles') is not null
  and exists (select 1 from pg_trigger where tgrelid = 'public.user_roles'::regclass and tgname = 'trg_sync_profiles_role' and not tgisinternal));
