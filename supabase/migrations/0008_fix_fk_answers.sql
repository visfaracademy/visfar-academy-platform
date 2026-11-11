-- ============================================================================
-- 0008_fix_fk_answers.sql — SUA FK answers.question_id + DON BANG TAM
--   Ngay: 10/11/2026. Trang thai: da duoc user phe duyet (10/11/2026 22:14).
--   Ly do (F-12, phat hien khi chay 0007 len staging):
--     - 0004 tao bang questions (trong, bang MOI) va answers.question_id FK
--       tro toi bang questions do.
--     - 0005 rename questions -> questions_new_empty, roi rename
--       quiz_questions -> questions (bang THAT). Postgres rename bang
--       KHONG doi OID trong FK, nen answers_question_id_fkey VAN tro
--       questions_new_empty.
--     - 0007 buoc (g) DROP questions_new_empty vi the bi chan (2BP01).
--   Phuong an (da phe duyet): migration moi 0008, KHONG sua file cu,
--   KHONG dung DROP ... CASCADE:
--     (1) Kiem tra 0 dong mo coi trong answers.question_id so voi bang
--         questions THAT; neu co > 0 dong mo coi -> RAISE EXCEPTION, dung.
--     (2) DROP + tao lai FK answers.question_id tro toi bang questions
--         THAT (on delete cascade, nhu dinh nghia goc o 0004).
--     (3) DROP 2 bang tam course_modules_new_empty va questions_new_empty
--         (deu trong, 0 dong — kiem tra truoc khi drop; neu co du lieu
--         hoac con FK nao khac tro toi chung -> RAISE EXCEPTION, dung).
--     (4) Guard idempotent: chay lai 0008 sau khi 0007 da chay (luc do
--         bang da la quiz_answers, bang tam da mat) thi chi RAISE NOTICE
--         va bo qua tung buoc — khong loi, khong doi du lieu.
--   Thu tu chay: 0008 TRUOC, roi chay lai 0007 (0007 co guard idempotent).
--   Luu y: 0007 buoc (c) doi ten answers -> quiz_answers SAU 0008, nen
--   0008 lam viec tren ten answers; neu chay lai sau 0007 thi lam viec
--   tren ten quiz_answers (xu ly ca hai ten trong file nay).
-- ============================================================================

-- ============================================================================
-- (a) Kiem tra mo coi: answers.question_id phai ton tai trong bang
--     questions THAT. answers hien 0 dong tren staging (da kiem chung),
--     nhung van kiem tra that truoc khi doi FK — khong tin vao gia dinh.
-- ============================================================================
do $$
declare
  v_tbl text;
  v_orphan bigint;
begin
  if to_regclass('public.quiz_answers') is not null then
    v_tbl := 'quiz_answers';
  elsif to_regclass('public.answers') is not null then
    v_tbl := 'answers';
  else
    raise notice '(a) BO QUA: khong co bang answers / quiz_answers — 0004 chua chay.';
    return;
  end if;

  if to_regclass('public.questions') is null then
    raise exception '(a) DUNG LAI: bang questions THAT khong ton tai — chay 0005 truoc.';
  end if;

  execute format(
    'select count(*) from public.%I a '
    'where not exists (select 1 from public.questions q where q.id = a.question_id)',
    v_tbl) into v_orphan;
  raise notice '(a) Bang %: % dong mo coi (question_id khong co trong bang questions THAT).',
    v_tbl, v_orphan;
  if v_orphan > 0 then
    raise exception '(a) DUNG LAI: co % dong mo coi trong %.question_id — doi soat tay truoc khi doi FK.', v_orphan, v_tbl;
  end if;
end $$;

-- ============================================================================
-- (b) Doi FK question_id sang bang questions THAT.
--     - Neu FK answers_question_id_fkey da tro questions THAT -> NOTICE, bo qua.
--     - Neu FK tro questions_new_empty (trang thai hien tai) -> DROP
--       constraint, ADD lai tro public.questions (id) on delete cascade.
--     - Neu FK khong ton tai -> ADD constraint (idempotent, IF NOT EXISTS
--       khong dung duoc cho ADD CONSTRAINT nen kiem tra qua pg_constraint).
--     Khong dung DROP ... CASCADE o bat ky cho nao.
-- ============================================================================
do $$
declare
  v_tbl text;
  v_ref regclass;
begin
  if to_regclass('public.quiz_answers') is not null then
    v_tbl := 'quiz_answers';
  elsif to_regclass('public.answers') is not null then
    v_tbl := 'answers';
  else
    raise notice '(b) BO QUA: khong co bang answers / quiz_answers.';
    return;
  end if;

  select c.confrelid into v_ref
  from pg_constraint c
  where c.conrelid = ('public.' || v_tbl)::regclass
    and c.contype = 'f'
    and c.conname = 'answers_question_id_fkey';

  if v_ref is null then
    -- Khong co FK ten nay: co the FK da doi ten o 0007 (c) hoac chua tao.
    -- Kiem tra xem da co FK nao tu question_id tro questions THAT chua.
    if exists (select 1 from pg_constraint c
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
               where c.conrelid = ('public.' || v_tbl)::regclass
                 and c.contype = 'f'
                 and c.confrelid = 'public.questions'::regclass
                 and a.attname = 'question_id') then
      raise notice '(b) FK question_id -> questions THAT da ton tai (ten khac), khong can them.';
    else
      execute format(
        'alter table public.%I add constraint answers_question_id_fkey '
        'foreign key (question_id) references public.questions (id) on delete cascade',
        v_tbl);
      raise notice '(b) OK: da them FK answers_question_id_fkey -> questions THAT.';
    end if;
  elsif v_ref = 'public.questions'::regclass then
    raise notice '(b) FK answers_question_id_fkey da tro bang questions THAT, khong can doi.';
  elsif v_ref = 'public.questions_new_empty'::regclass then
    execute format('alter table public.%I drop constraint answers_question_id_fkey', v_tbl);
    execute format(
      'alter table public.%I add constraint answers_question_id_fkey '
      'foreign key (question_id) references public.questions (id) on delete cascade',
      v_tbl);
    raise notice '(b) OK: FK answers_question_id_fkey da doi tu questions_new_empty sang questions THAT.';
  else
    raise exception '(b) DUNG LAI: FK answers_question_id_fkey dang tro bang khong mong doi % — doi soat tay.', v_ref;
  end if;
end $$;

-- ============================================================================
-- (c) DROP 2 bang tam — chi khi ca hai dieu kien deu dat:
--       1. Bang ton tai VA trong (count = 0).
--       2. Khong con FK/constraint nao tro toi bang do.
--     Neu bang co du lieu hoac con FK tro toi -> RAISE EXCEPTION, dung
--     (khong drop, khong bat RLS thay the — du lieu phai duoc doi soat tay).
--     Khong ton tai -> NOTICE, bo qua (idempotent cho lan chay lai).
-- ============================================================================
do $$
declare
  v_t text;
  v_n bigint;
  v_dep text;
begin
  foreach v_t in array array['course_modules_new_empty', 'questions_new_empty'] loop
    if to_regclass('public.' || v_t) is null then
      raise notice '(c) Bang % khong ton tai, bo qua.', v_t;
      continue;
    end if;

    execute format('select count(*) from public.%I', v_t) into v_n;
    if v_n > 0 then
      raise exception '(c) DUNG LAI: bang % co % dong — KHONG drop; doi soat tay truoc khi xoa.', v_t, v_n;
    end if;

    select string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ')
      into v_dep
    from pg_constraint c
    where c.confrelid = ('public.' || v_t)::regclass;
    if v_dep is not null then
      raise exception '(c) DUNG LAI: bang % trong nhung van con doi tuong phu thuoc: % — doi soat tay.', v_t, v_dep;
    end if;

    execute format('drop table public.%I', v_t);
    raise notice '(c) OK: % dang trong (0 dong), khong con phu thuoc — da DROP TABLE.', v_t;
  end loop;
end $$;

-- ============================================================================
-- KIEM CHUNG (chi RAISE NOTICE, khong doi du lieu)
-- ============================================================================
do $$
begin
  raise notice 'KIEM CHUNG: FK answers.question_id -> questions THAT = % (ky vong: true).',
    (exists (select 1 from pg_constraint c
             where c.conrelid = coalesce(to_regclass('public.answers'), to_regclass('public.quiz_answers'))
               and c.contype = 'f'
               and c.conname = 'answers_question_id_fkey'
               and c.confrelid = 'public.questions'::regclass));
  raise notice 'KIEM CHUNG: bang tam course_modules_new_empty con ton tai = %; questions_new_empty con ton tai = % (ky vong: false).',
    (to_regclass('public.course_modules_new_empty') is not null),
    (to_regclass('public.questions_new_empty') is not null);
  raise notice 'KIEM CHUNG: bang answers con ton tai = %; bang quiz_answers con ton tai = % (ky vong truoc 0007: true/false; sau 0007: false/true).',
    (to_regclass('public.answers') is not null),
    (to_regclass('public.quiz_answers') is not null);
end $$;
