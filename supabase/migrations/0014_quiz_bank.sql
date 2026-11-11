-- ============================================================================
-- 0014_quiz_bank.sql — TASK 08 (phan Quiz): ngan hang cau hoi + cham bai
--
--   MUC DICH: mo rong quiz da co (0001/0004/0005/0007) thanh ngan hang
--   cau hoi day du, KHONG sua file migration cu (0001-0013).
--
--   DOI CHIEU TEN THAT (doc tu file goc, khong doan):
--   - Bang lua chon: 0001 tao la `quiz_options`; 0007 (d) doi ten thanh
--     `question_options` + view `question_options_public` (KHONG co
--     cot `is_correct`). File nay xu ly CA HAI ten (guard) de chay
--     duoc ca khi 0007 chua ap.
--   - Bang dap an hoc vien: 0001/0004 tao la `answers`; 0007 (c) doi
--     ten thanh `quiz_answers` (cot attempt_id, question_id, option_id,
--     answer_text, is_correct; UNIQUE (attempt_id, question_id,
--     option_id)). File nay cung xu ly ca hai ten.
--   - `quizzes` (0004): course_id, lesson_id UNIQUE, title,
--     description, pass_score_percent (NULL), time_limit_sec (NULL),
--     max_attempts (NULL), is_published boolean. KHONG co cot
--     `passing_score` / `time_limit_seconds` / `status` rieng — file
--     nay KHONG tao cot trung lap: `passing_score` cua Task 08 anh xa
--     sang `pass_score_percent` (mac dinh 70, xem muc B); gioi han
--     thoi gian anh xa sang `time_limit_sec`; trang thai xuat ban van
--     la `is_published`.
--   - `questions` (0004): quiz_id, question, question_type CHECK IN
--     ('single_choice','multiple_choice','true_false','short_answer'),
--     explanation, points DEFAULT 1, display_order. File nay mo rong
--     CHECK them 'fill_blank' + 'essay' (giu 'short_answer' de tuong
--     thich du lieu cu).
--   - `quiz_attempts` (0001): user_id, lesson_id, score, total,
--     answers jsonb, submitted_at. File nay them quiz_id, status,
--     passed, started_at, needs_review. KHONG xoa cot `answers` jsonb
--     (Task 03 QĐ 4 doi xoa SAU KHI code chuyen het — ham nop bai o
--     muc G van ghi ca jsonb snapshot + bang chuan hoa `quiz_answers`).
--     KHONG xoa cot `lesson_id` (Task 03 QĐ 7 cung doi xoa sau khi
--     code chuyen — ham nop bai van dien ca hai cot).
--
--   QUY TAC CHAM (1 nguon su that = ham submit_quiz_attempt, muc G;
--   ban dac ta TS cung quy tac o apps/web/src/lib/quiz.ts
--   `gradeQuizAttempt`, chi dung de test + Workers tuong lai):
--   - single_choice / true_false: dung khi option duoc chon duy nhat
--     co is_correct = true.
--   - multiple_choice: dung khi tap option duoc chon == tap option
--     dung (khop chinh xac, khong diem thanh phan). Moi option duoc
--     chon ghi 1 dong quiz_answers; diem cua cau chi cong 1 lan.
--   - fill_blank / short_answer: dung khi answer_text (chuan hoa:
--     trim, gom khoang trang, khong phan biet hoa/thuong) trung 1
--     option_text co is_correct = true. Dap an ky vong luu nhu 1 dong
--     question_options co is_correct = true.
--   - essay: KHONG cham tu dong — is_correct NULL, points_awarded
--     NULL, attempt co needs_review = true (cho cham tay sau).
--   - passing_score mac dinh 70: pass_score_percent NULL duoc hieu
--     la 70 (ca ham SQL + lib TS). Diem dat tinh theo tong `points`.
--
--   BAO MAT: dap an dung (question_options.is_correct) KHONG BAO GIO
--   tra ve client truoc khi nop. De thi (GET) chi doc qua VIEW
--   question_options_public (khong co is_correct). Cham bai chi chay
--   trong ham SECURITY DEFINER submit_quiz_attempt (muc G) — apps/web
--   KHONG dung service-role key (bi cam boi security.test.ts + 
--   .env.example), nen route Next /api/v1/quizzes/[quizId]/submit goi
--   ham nay qua RPC bang JWT cua nguoi goi.
--
--   NGUYEN TAC: idempotent o muc co the (IF NOT EXISTS / guard theo
--   pg_catalog / to_regclass). KHONG CHAY len DB that khi viet file
--   nay; ap staging truoc, kiem chung theo muc KIEM CHUNG cuoi file,
--   roi moi len prod. Thu tu chay: sau 0013.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) Guard doi ten (phong khi 0007 chua ap): answers -> quiz_answers,
--     quiz_options -> question_options. Neu ca hai ten deu ton tai thi
--     DUNG LAI o buoc kiem tra cuoi (doi soat tay), khong tu dong xoa.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.answers') is not null
     and to_regclass('public.quiz_answers') is null then
    execute 'alter table public.answers rename to quiz_answers';
    raise notice '(A) OK: answers -> quiz_answers.';
  end if;
  if to_regclass('public.quiz_options') is not null
     and to_regclass('public.question_options') is null then
    execute 'alter table public.quiz_options rename to question_options';
    raise notice '(A) OK: quiz_options -> question_options.';
  end if;
end $$;

-- View cong khai KHONG co is_correct (tao lai sau guard rename o (A)).
-- Giu ten question_options_public theo 0007 (d); view cu quiz_options_public
-- (neu con) duoc drop de khong co 2 duong doc lech nhau.
create or replace view public.question_options_public as
  select id, question_id, option_text, display_order
  from public.question_options;
grant select on public.question_options_public to anon, authenticated;
drop view if exists public.quiz_options_public;

-- ---------------------------------------------------------------------------
-- (B) quizzes: shuffle flag + mac dinh passing_score 70 + dam bao cac
--     cot gioi han da co. KHONG tao cot `passing_score` /
--     `time_limit_seconds` / `status` moi (trung lap voi cot that).
-- ---------------------------------------------------------------------------
alter table public.quizzes
  add column if not exists shuffle_questions boolean not null default false;
alter table public.quizzes
  add column if not exists time_limit_sec integer
    check (time_limit_sec is null or time_limit_sec > 0);
alter table public.quizzes
  add column if not exists max_attempts integer
    check (max_attempts is null or max_attempts > 0);
alter table public.quizzes
  add column if not exists pass_score_percent integer
    check (pass_score_percent is null or (pass_score_percent >= 0 and pass_score_percent <= 100));
-- Mac dinh 70 cho quiz moi; quiz cu co pass_score_percent NULL van duoc
-- hieu la 70 o ham cham (muc G) + lib TS (DEFAULT_PASSING_SCORE).
alter table public.quizzes
  alter column pass_score_percent set default 70;

-- ---------------------------------------------------------------------------
-- (C) questions: them loai fill_blank + essay; dam bao points/explanation.
--     Giu 'short_answer' (du lieu cu) — fill_blank la dang dien khuyet
--     co dap an co dinh, short_answer giu cach cham cu (khop chuoi).
-- ---------------------------------------------------------------------------
alter table public.questions
  add column if not exists points integer not null default 1 check (points >= 0);
alter table public.questions
  add column if not exists explanation text;

do $$
declare
  r record;
begin
  -- Xoa CHECK cu tren question_type (ten constraint khac nhau tuy DB:
  -- tim theo dinh nghia chua 'question_type', khong doan ten).
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%question_type%'
  loop
    execute format('alter table public.questions drop constraint %I', r.conname);
    raise notice '(C) OK: da xoa CHECK cu %.', r.conname;
  end loop;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%question_type%'
  ) then
    alter table public.questions add constraint questions_question_type_check
      check (question_type in (
        'single_choice', 'multiple_choice', 'true_false',
        'fill_blank', 'essay', 'short_answer'
      ));
    raise notice '(C) OK: CHECK question_type moi (6 loai).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- (D) quiz_attempts: them quiz_id / status / passed / started_at /
--     needs_review. Giu lesson_id + answers jsonb (xem dau file).
-- ---------------------------------------------------------------------------
alter table public.quiz_attempts
  add column if not exists quiz_id uuid references public.quizzes (id) on delete set null;
alter table public.quiz_attempts
  add column if not exists status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'expired'));
alter table public.quiz_attempts
  add column if not exists passed boolean;
alter table public.quiz_attempts
  add column if not exists started_at timestamptz;
alter table public.quiz_attempts
  add column if not exists needs_review boolean not null default false;
create index if not exists idx_quiz_attempts_quiz
  on public.quiz_attempts (quiz_id, submitted_at desc);
create index if not exists idx_quiz_attempts_user_quiz
  on public.quiz_attempts (user_id, quiz_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- (E) quiz_answers: them diem tung cau + thoi diem tra loi; dam bao
--     UNIQUE (attempt_id, question_id, option_id) de multiple_choice
--     ghi duoc nhieu dong (neu UNIQUE cu (attempt_id, question_id) con
--     ton tai — tuc 0007 chua ap — thi doi sang UNIQUE moi sau khi
--     kiem tra khong co nhom trung).
-- ---------------------------------------------------------------------------
alter table public.quiz_answers
  add column if not exists points_awarded integer check (points_awarded is null or points_awarded >= 0);
alter table public.quiz_answers
  add column if not exists answered_at timestamptz not null default now();

do $$
declare
  v_dup bigint := 0;
  r record;
begin
  -- Tim UNIQUE cu chi gom (attempt_id, question_id) — nhan dang bang
  -- danh sach cot cua index, khong doan ten constraint.
  for r in
    select c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.conrelid = 'public.quiz_answers'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%attempt_id%'
      and pg_get_constraintdef(c.oid) not ilike '%option_id%'
  loop
    select count(*) into v_dup
    from (
      select attempt_id, question_id, option_id
      from public.quiz_answers
      group by attempt_id, question_id, option_id
      having count(*) > 1
    ) d;
    if v_dup > 0 then
      raise exception '(E) DUNG LAI: co % nhom trung (attempt_id, question_id, option_id) trong quiz_answers — doi soat tay truoc khi doi UNIQUE.', v_dup;
    end if;
    execute format('alter table public.quiz_answers drop constraint %I', r.conname);
    raise notice '(E) OK: da xoa UNIQUE cu %.', r.conname;
  end loop;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_answers'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%attempt_id%'
      and pg_get_constraintdef(oid) ilike '%option_id%'
  ) then
    alter table public.quiz_answers
      add constraint quiz_answers_attempt_question_option_key
      unique (attempt_id, question_id, option_id);
    raise notice '(E) OK: UNIQUE (attempt_id, question_id, option_id).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- (F) RLS: bat RLS (da bat tu 0001/0006 — lenh nay idempotent) + policy
--     INSERT cho ham SECURITY DEFINER? KHONG CAN: ham SECURITY DEFINER
--     bypass RLS. Client KHONG duoc INSERT truc tiep quiz_attempts /
--     quiz_answers (khong them policy INSERT) — moi luot nop phai di
--     qua ham submit_quiz_attempt (muc G) de cham o server.
--     Policy SELECT cua minh (0001/0006/0007) giu nguyen: hoc vien chi
--     doc attempt + dap an cua chinh minh (lich su lam bai).
-- ---------------------------------------------------------------------------
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

-- ---------------------------------------------------------------------------
-- (G) Ham nop bai + cham o server — SECURITY DEFINER.
--     Tien le trong repo: current_role() / is_instructor_of() /
--     course_of_lesson() (0001/0006) cung SECURITY DEFINER +
--     set search_path = public. Ham nay bypass RLS de doc
--     question_options.is_correct va ghi quiz_attempts / quiz_answers;
--     nguoi goi chi goi duoc qua RPC bang JWT cua chinh minh
--     (auth.uid() la nguon su that — khong tin user_id tu client).
--
--     Dau vao p_answers: jsonb ARRAY cac object, moi object:
--       {"question_id": "<uuid>",
--        "option_ids": ["<uuid>", ...],      -- trac nghiem (co the rong)
--        "answer_text": "<chuoi>"}           -- fill_blank / short_answer / essay
--     Chi 1 trong 2 dang duoc dung cho moi cau; cau khong tra loi thi
--     khong co object trong mang (tinh 0 diem, ghi is_correct = false
--     o ket qua tra ve, khong ghi dong quiz_answers).
--
--     Tra ve jsonb (CHI SAU KHI NOP — duoc phep co dap an dung):
--       {"attempt_id","score","total","percent","passed","needs_review",
--        "status","results":[{"question_id","question_type","is_correct",
--        "points_awarded","points","explanation","correct_option_ids",
--        "selected_option_ids","answer_text"}]}
--
--     Loi: raise exception voi message la ma loi de route Next map
--     sang HTTP: 'unauthenticated' | 'quiz_not_found' |
--     'not_enrolled' | 'max_attempts_reached'.
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(
  p_quiz_id uuid,
  p_started_at timestamptz,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz record;
  v_lesson record;
  v_used integer := 0;
  v_expired boolean := false;
  v_started timestamptz := coalesce(p_started_at, now());
  v_passing integer;
  v_attempt_id uuid;
  v_score integer := 0;
  v_total integer := 0;
  v_needs_review boolean := false;
  v_results jsonb := '[]'::jsonb;
  q record;
  a jsonb;
  v_option_ids uuid[];
  v_answer_text text;
  v_correct_ids uuid[];
  v_is_correct boolean;
  v_points integer;
  v_first_option uuid;
  v_i integer;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'invalid_answers';
  end if;

  select z.id, z.course_id, z.lesson_id, z.title,
         coalesce(z.pass_score_percent, 70) as passing,
         z.time_limit_sec, z.max_attempts
    into v_quiz
    from public.quizzes z
    where z.id = p_quiz_id and z.is_published = true;
  if not found then
    raise exception 'quiz_not_found';
  end if;
  v_passing := v_quiz.passing;

  -- Quyen lam bai: admin / instructor khoa / enrollment active-completed
  -- / bai xem thu (giong decideLessonAccess o apps/web/src/lib/lms-access.ts).
  if v_quiz.lesson_id is not null then
    select l.id, l.is_free_preview into v_lesson
      from public.lessons l where l.id = v_quiz.lesson_id;
  end if;
  if public.current_role() <> 'admin'
     and not public.is_instructor_of(v_quiz.course_id)
     and not exists (
       select 1 from public.enrollments e
       where e.user_id = v_user_id and e.course_id = v_quiz.course_id
         and e.status in ('active', 'completed'))
     and coalesce(v_lesson.is_free_preview, false) = false then
    raise exception 'not_enrolled';
  end if;

  -- Gioi han so lan lam (chi dem luot da nop / het gio).
  select count(*) into v_used
    from public.quiz_attempts qa
    where qa.user_id = v_user_id and qa.quiz_id = p_quiz_id
      and qa.status in ('submitted', 'expired');
  if v_quiz.max_attempts is not null and v_used >= v_quiz.max_attempts then
    raise exception 'max_attempts_reached';
  end if;

  -- Het gio: qua time_limit_sec + 60 giay grace (QUIZ_SUBMIT_GRACE_SEC).
  if v_quiz.time_limit_sec is not null
     and now() > v_started + (v_quiz.time_limit_sec + 60) * interval '1 second' then
    v_expired := true;
  end if;

  -- Tao attempt truoc de co id cho quiz_answers (score/total cap nhat sau).
  insert into public.quiz_attempts
    (user_id, lesson_id, quiz_id, score, total, passed, status,
     started_at, submitted_at, answers, needs_review)
  values
    (v_user_id, v_quiz.lesson_id, p_quiz_id, 0, 0, false,
     case when v_expired then 'expired' else 'submitted' end,
     v_started, now(), p_answers, false)
  returning id into v_attempt_id;

  -- Cham tung cau theo display_order.
  for q in
    select qq.id, qq.question_type, qq.points, qq.explanation
    from public.questions qq
    where qq.quiz_id = p_quiz_id
    order by qq.display_order, qq.id
  loop
    v_total := v_total + coalesce(q.points, 0);
    v_is_correct := null;
    v_points := 0;
    v_option_ids := '{}'::uuid[];
    v_answer_text := null;
    v_correct_ids := '{}'::uuid[];

    -- Tim cau tra loi cua cau nay trong mang p_answers.
    select elem into a
      from jsonb_array_elements(p_answers) as elem
      where (elem ->> 'question_id') = q.id::text
      limit 1;

    if a is not null then
      -- option_ids: mang uuid (co the rong / khong co key).
      select coalesce(array_agg((v)::uuid), '{}'::uuid[]) into v_option_ids
        from jsonb_array_elements_text(coalesce(a -> 'option_ids', '[]'::jsonb)) as v;
      v_answer_text := nullif(btrim(a ->> 'answer_text'), '');

      -- Tap option dung (chi doc o day, trong ham server).
      select coalesce(array_agg(o.id), '{}'::uuid[]) into v_correct_ids
        from public.question_options o
        where o.question_id = q.id and o.is_correct = true;
    end if;

    if q.question_type in ('single_choice', 'true_false') then
      if a is not null and array_length(v_option_ids, 1) = 1 then
        v_is_correct := v_option_ids[1] = any (v_correct_ids);
        v_points := case when v_is_correct then q.points else 0 end;
        insert into public.quiz_answers
          (attempt_id, question_id, option_id, answer_text, is_correct, points_awarded)
        values
          (v_attempt_id, q.id, v_option_ids[1], null, v_is_correct, v_points);
      elsif a is not null then
        -- Chon 0 hoac >1 option cho cau chi co 1 dap an: sai, khong ghi dong
        -- (khong co option dai dien); ket qua tra ve is_correct = false.
        v_is_correct := false;
      else
        v_is_correct := false;
      end if;

    elsif q.question_type = 'multiple_choice' then
      if a is not null and array_length(v_option_ids, 1) is not null then
        -- Dung khi tap chon == tap dung (khong diem thanh phan).
        v_is_correct := (v_option_ids <@ v_correct_ids)
                        and (v_correct_ids <@ v_option_ids)
                        and array_length(v_correct_ids, 1) is not null;
        v_points := case when v_is_correct then q.points else 0 end;
        -- Moi option duoc chon 1 dong; diem cau cong 1 lan tren dong dau.
        for v_i in 1 .. array_length(v_option_ids, 1) loop
          v_first_option := v_option_ids[v_i];
          insert into public.quiz_answers
            (attempt_id, question_id, option_id, answer_text, is_correct, points_awarded)
          values
            (v_attempt_id, q.id, v_first_option, null,
             (v_first_option = any (v_correct_ids)),
             case when v_i = 1 then v_points else 0 end);
        end loop;
      else
        v_is_correct := false;
      end if;

    elsif q.question_type in ('fill_blank', 'short_answer') then
      if a is not null and v_answer_text is not null then
        -- Khop chuoi chuan hoa: trim, gom khoang trang, khong phan biet hoa/thuong.
        v_is_correct := exists (
          select 1 from public.question_options o
          where o.question_id = q.id and o.is_correct = true
            and lower(btrim(regexp_replace(o.option_text, '\s+', ' ', 'g')))
              = lower(btrim(regexp_replace(v_answer_text, '\s+', ' ', 'g')))
        );
        -- Neu cau khong dinh nghia dap an dung nao: chua cham duoc.
        if array_length(v_correct_ids, 1) is null then
          v_is_correct := null;
          v_needs_review := true;
        else
          v_points := case when v_is_correct then q.points else 0 end;
        end if;
        insert into public.quiz_answers
          (attempt_id, question_id, option_id, answer_text, is_correct, points_awarded)
        values
          (v_attempt_id, q.id, null, v_answer_text, v_is_correct,
           case when v_is_correct is null then null else v_points end);
      else
        v_is_correct := false;
      end if;

    elsif q.question_type = 'essay' then
      -- Tu luan: khong cham tu dong.
      v_is_correct := null;
      if a is not null and v_answer_text is not null then
        v_needs_review := true;
        insert into public.quiz_answers
          (attempt_id, question_id, option_id, answer_text, is_correct, points_awarded)
        values (v_attempt_id, q.id, null, v_answer_text, null, null);
      end if;

    else
      v_is_correct := false;
    end if;

    v_score := v_score + coalesce(v_points, 0);
    v_results := v_results || jsonb_build_object(
      'question_id', q.id,
      'question_type', q.question_type,
      'is_correct', v_is_correct,
      'points_awarded', v_points,
      'points', q.points,
      'explanation', q.explanation,
      'correct_option_ids', to_jsonb(v_correct_ids),
      'selected_option_ids', to_jsonb(v_option_ids),
      'answer_text', v_answer_text
    );
  end loop;

  -- Cap nhat attempt: het gio thi passed = false; essay/fill_blank chua
  -- cham duoc thi needs_review = true (diem chi tinh phan cham duoc).
  update public.quiz_attempts
    set score = v_score,
        total = v_total,
        passed = case when v_expired then false
                      else (v_total = 0 or (v_score * 100.0 / nullif(v_total, 0)) >= v_passing)
                 end,
        needs_review = v_needs_review
    where id = v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'score', v_score,
    'total', v_total,
    'percent', case when v_total = 0 then 0
                    else round(v_score * 100.0 / v_total)::integer end,
    'passed', case when v_expired then false
                   else (v_total = 0 or (v_score * 100.0 / nullif(v_total, 0)) >= v_passing)
              end,
    'needs_review', v_needs_review,
    'status', case when v_expired then 'expired' else 'submitted' end,
    'results', v_results
  );
end;
$$;

-- Chi authenticated duoc goi ham nop bai; anon khong goi duoc.
revoke all on function public.submit_quiz_attempt(uuid, timestamptz, jsonb) from public;
grant execute on function public.submit_quiz_attempt(uuid, timestamptz, jsonb) to authenticated;

-- ============================================================================
-- KIEM CHUNG (chay tren STAGING sau khi ap 0014 — KHONG chay o day):
--   1. select column_name from information_schema.columns
--      where table_name = 'quizzes' and column_name = 'shuffle_questions';
--      -- ky vong: 1 dong.
--   2. select column_default from information_schema.columns
--      where table_name = 'quizzes' and column_name = 'pass_score_percent';
--      -- ky vong: 70.
--   3. select column_name from information_schema.columns
--      where table_name = 'quiz_attempts'
--        and column_name in ('quiz_id','status','passed','started_at','needs_review');
--      -- ky vong: 5 dong.
--   4. select column_name from information_schema.columns
--      where table_name = 'quiz_answers'
--        and column_name in ('points_awarded','answered_at');
--      -- ky vong: 2 dong.
--   5. select column_name from information_schema.columns
--      where table_name = 'question_options_public'
--        and column_name = 'is_correct';
--      -- ky vong: 0 dong (view cong khai KHONG co dap an dung).
--   6. select proname from pg_proc where proname = 'submit_quiz_attempt';
--      -- ky vong: 1 dong; + kiem tra quyen: anon goi rpc phai loi 401.
--   7. PARITY (so sanh ham SQL voi dac ta TS apps/web/src/lib/quiz.ts
--      gradeQuizAttempt): seed 1 quiz co du 5 loai cau (single, multi,
--      true_false, fill_blank, essay) + 1 cau multiple_choice chon
--      thieu 1 option dung; nop bang student test qua route
--      POST /api/v1/quizzes/[quizId]/submit; doi chieu score/total/
--      passed/ket qua tung cau voi ket qua gradeQuizAttempt tren cung
--      fixture o quiz.test.ts. Leech phai bang nhau, neu khong thi
--      DUNG LAI va sua 1 trong 2 cho khop truoc khi mo cho hoc vien that.
--   8. Gioi han lan lam: dat max_attempts = 1, nop lan 2 phai tra
--      'max_attempts_reached' (HTTP 409 o route).
--   9. Het gio: nop voi started_at cach day > time_limit_sec + 60s
--      phai tra status 'expired', passed = false.
-- ============================================================================
