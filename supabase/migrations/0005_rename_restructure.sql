-- ============================================================================
-- Visfar Academy — Task 03 — Migration 0005 — DOI TEN / GOP BANG GIU DU LIEU
-- THIET KE — CHUA AP DUNG, CHO PHE DUYET — 10/11/2026
-- ----------------------------------------------------------------------------
-- CHI LA FILE THIET KE. KHONG chay len Supabase that, KHONG deploy.
-- Quy trinh bat buoc truoc khi chay file nay (du chi la ban thiet ke,
-- day la dieu kien ap dung):
--   1. CHAY TREN STAGING TRUOC. Chi chay prod sau khi staging dat
--      toan bo buoc kiem tra o cuoi file (so dong truoc/sau bang nhau).
--   2. BACKUP TRUOC KHI CHAY PROD (pg_dump day du; giu ban backup
--      co the khoi phuc; ghi lai ten file backup + thoi diem vao
--      RUNBOOK truoc khi bat dau).
--   3. KHONG DROP DU LIEU NGHIEP VU. File nay chi RENAME bang/cot,
--      ADD COLUMN (nullable hoac co DEFAULT), va backfill INSERT...
--      SELECT tu du lieu cu. Khong co DROP TABLE du lieu nghiep vu,
--      khong co TRUNCATE, khong co DELETE.
--   4. ROLLBACK: rename nguoc theo muc 8 cuoi file (chi ap dung khi
--      CHUA co du lieu moi ghi vao ten moi; neu da co du lieu moi,
--      rollback phai kem theo backfill nguoc — xem muc 8).
--   5. File nay phu thuoc 0004 (cac bang moi da ton tai, DANG TRONG).
--      Neu 0004 chua chay, cac buoc kiem tra "bang moi trong" se loi
--      va file phai DUNG LAI (xem DO block muc 0).
--
-- NGUYEN TAC DOI TEN:
--   * Ten moi la ten chuan thiet ke Task 03; ten cu chi duoc bo SAU KHI
--     code (API/frontend) da chuyen sang ten moi. Trong thoi gian
--     chuyen doi, co the tao VIEW ten cu tro ve ten moi (muc 7, tuy chon)
--     de code cu khong vo ngay — VIEW nay chi tam thoi, xoa khi code
--     da chuyen het.
--   * Moi buoc rename deu co DO block kiem tra truoc (guard): neu
--     dieu kien khong dat, RAISE EXCEPTION va TOAN BO transaction
--     dung lai — khong rename do dang.
--   * Chay toan file trong 1 transaction (BEGIN ... COMMIT) khi chay
--     bang psql / Supabase SQL Editor theo khoi; neu SQL Editor tu
--     commit tung lenh, chay tung muc theo thu tu va dung ngay khi
--     gap loi.
-- ============================================================================

begin;

-- ============================================================================
-- MUC 0 — GUARD: dieu kien tien quyet (dung lai neu khong dat)
-- ============================================================================
do $$
declare
  v_new_modules_count bigint;
  v_new_questions_count bigint;
begin
  -- 0004 phai da chay: cac bang moi phai ton tai.
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'course_modules')
     or not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'questions') then
    raise exception 'MUC 0: 0004 chua chay — thieu bang course_modules/questions. DUNG LAI, chay 0004 truoc.';
  end if;

  -- Bang moi course_modules / questions (tao o 0004) phai DANG TRONG,
  -- vi du lieu that se chuyen tu bang cu sang bang ten moi. Neu bang
  -- moi da co du lieu (ai do da ghi vao truoc khi gop), DUNG LAI de
  -- doi soat tay — khong tu dong ghi de.
  select count(*) into v_new_modules_count from public.course_modules;
  select count(*) into v_new_questions_count from public.questions;
  if v_new_modules_count > 0 then
    raise exception 'MUC 0: course_modules (0004) da co % dong. DUNG LAI — doi soat tay truoc khi gop, khong tu dong ghi de.', v_new_modules_count;
  end if;
  if v_new_questions_count > 0 then
    raise exception 'MUC 0: questions (0004) da co % dong. DUNG LAI — doi soat tay truoc khi gop, khong tu dong ghi de.', v_new_questions_count;
  end if;

  raise notice 'MUC 0 OK: 0004 da chay, course_modules/questions dang trong — du dieu kien gop.';
end $$;

-- ============================================================================
-- MUC 1 — modules -> course_modules (GIU DU LIEU) [MAU THUAN CHINH — CAN PHE DUYET]
--   Van de: 0004 da tao bang course_modules MOI (trong). Khong the
--   RENAME modules -> course_modules khi ten dich da ton tai.
--   Cach xu ly (chon 1 trong 2, MAC DINH LA A):
--     A (DE XUAT): doi ten bang moi (trong) thanh course_modules_new_empty
--        de giu lai lam bang chung thiet ke, roi rename modules (co du
--        lieu) -> course_modules, roi them cac cot thieu cua thiet ke moi.
--     B (NEU DUYET): DROP bang moi (trong) roi rename nhu A. Chi chon B
--        khi user xac nhan bang thiet ke trong co the bo — file nay
--        MAC DINH KHONG DROP, de nguoi duyet tu chon bang cach bo
--        comment 1 dong o duoi.
--   Sau buoc nay: course_modules = du lieu cu cua modules + cot moi.
--   lessons.module_id VAN GIU NGUYEN ten cot va FK (FK tu dong chay
--   theo ten bang moi sau RENAME — Postgres doi ten bang khong doi
--   ten cot FK). Viec doi ten cot lessons.module_id ->
--   lessons.course_module_id nam o muc 2 (rieng, co the tach ra chay sau).
-- ============================================================================

-- Buoc 1a (MAC DINH — phuong an A): doi ten bang moi (trong) di cho khac.
alter table public.course_modules rename to course_modules_new_empty;
-- Buoc 1a' (PHUONG AN B — CHI DUNG NEU DUYET, bo comment dong duoi):
-- drop table public.course_modules_new_empty;

-- Buoc 1b: rename bang cu (co du lieu) sang ten moi.
alter table public.modules rename to course_modules;

-- Buoc 1c: them cac cot thieu cua thiet ke moi (nullable / co DEFAULT
--   de khong vo dong cu). slug backfill o buoc 1d.
alter table public.course_modules
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists is_free_preview boolean not null default false,
  add column if not exists is_published boolean not null default true;

-- Buoc 1d: backfill slug tu title (slug don gian, khong dau — chi tam
--   de dong cu co gia tri; API/frontend se chuan hoa lai khi can).
--   Luu y: slug o thiet ke moi UNIQUE theo (course_id, slug); backfill
--   them hau to so thu tu neu trung trong cung khoa.
do $$
declare
  r record;
  v_base text;
  v_slug text;
  v_n integer;
begin
  for r in select id, course_id, title from public.course_modules
           where slug is null order by course_id, display_order, id
  loop
    v_base := lower(regexp_replace(coalesce(r.title, 'module'), '[^a-z0-9]+', '-', 'g'));
    v_base := trim(both '-' from v_base);
    if v_base = '' then v_base := 'module'; end if;
    v_slug := v_base; v_n := 1;
    while exists (select 1 from public.course_modules
                  where course_id = r.course_id and slug = v_slug and id <> r.id) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    update public.course_modules set slug = v_slug where id = r.id;
  end loop;
end $$;

-- Buoc 1e: sau khi backfill xong moi dat NOT NULL + UNIQUE (khong dat
--   truoc khi backfill de tranh vo dong cu co slug NULL).
alter table public.course_modules alter column slug set not null;
create unique index if not exists uq_course_modules_course_slug
  on public.course_modules (course_id, slug);

-- Buoc 1f: doi ten index cu cho dung ten moi (khong bat buoc, de doc).
--   Index cu idx_modules_course van hoat dong sau rename; chi doi ten
--   cho nhat quan.
alter index if exists idx_modules_course rename to idx_course_modules_course_order;

-- Buoc 1g: KIEM TRA — so dong truoc/sau phai bang nhau.
--   (So dong "truoc" lay tu backup / log truoc khi chay; neu chay tren
--    staging, so sanh voi bang modules tren prod tai thoi diem backup.)
do $$
declare v_count bigint;
begin
  select count(*) into v_count from public.course_modules;
  raise notice 'MUC 1: course_modules co % dong sau rename (doi chieu voi so dong modules cu trong backup).', v_count;
end $$;

-- ============================================================================
-- MUC 2 — lessons.module_id -> lessons.course_module_id (DOI TEN COT, GIU DU LIEU)
--   Chi doi ten cot + index; FK tu dong chay theo. Khong doi du lieu.
--   CO THE TACH RIENG: neu muon giam rui ro, bo qua muc nay o dot 1
--   (code moi van doc duoc cot module_id qua VIEW muc 7) va chay sau.
-- ============================================================================
alter table public.lessons rename column module_id to course_module_id;
alter index if exists idx_lessons_module rename to idx_lessons_course_module;

-- Ghi chu ve Quyet dinh 17 (DECISIONS.md): lessons.slug UNIQUE theo
-- module (khong theo khoa) — GIU NGUYEN unique(module_id, slug) cu,
-- chi doi ten cot trong constraint neu can. Postgres tu cap nhat ten
-- cot trong unique constraint khi rename cot; khong tao lai constraint
-- o day. Khong doi sang UNIQUE theo khoa neu chua co quyet dinh moi.

-- ============================================================================
-- MUC 3 — quiz_questions -> questions (GIU DU LIEU) [MAU THUAN THU HAI]
--   Tuong tu muc 1: bang questions moi (0004, trong) da ton tai.
--   A: doi ten bang moi -> questions_new_empty, roi rename bang cu.
--   Sau rename: them cac cot thieu cua thiet ke moi (question_type,
--   explanation, points), backfill question_type = 'single_choice'.
--   quiz_options KHONG doi ten, KHONG doi cau truc — dap an dung van
--   o quiz_options.is_correct (xem 0004 muc 8). FK quiz_options.
--   question_id tu dong chay theo ten bang moi.
-- ============================================================================
alter table public.questions rename to questions_new_empty;

alter table public.quiz_questions rename to questions;

-- Them cot quiz_id (bang cu khong co cot nay — cot nay chi co o bang
-- questions moi cua 0004, da doi ten di o tren). De NULL tam de
-- backfill, dat NOT NULL SAU buoc kiem tra 3c.
alter table public.questions
  add column if not exists quiz_id uuid references public.quizzes (id) on delete cascade,
  add column if not exists question_type text not null default 'single_choice'
    check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'short_answer')),
  add column if not exists explanation text,
  add column if not exists points integer not null default 1 check (points >= 0);

-- Backfill quiz_id: moi question cu gan voi 1 lesson; quiz tuong ung la
-- quiz cua lesson do (bang quizzes, 0004). Tao quiz thieu truoc, roi
-- gan question.quiz_id theo lesson.
-- Buoc 3a: tao quiz cho moi lesson co question ma chua co quiz.
insert into public.quizzes (course_id, lesson_id, title, is_published)
select distinct
  cm.course_id,
  q.lesson_id,
  'Quiz — ' || l.title,
  true
from public.questions q
join public.lessons l on l.id = q.lesson_id
join public.course_modules cm on cm.id = l.course_module_id
where not exists (select 1 from public.quizzes z where z.lesson_id = q.lesson_id);
-- Luu y: neu lesson thuoc khoa chua co trong course_modules (du lieu
-- lech), dong do se KHONG duoc tao quiz — buoc kiem tra 3c se bao.

-- Buoc 3b: gan quiz_id cho question (cot quiz_id NOT NULL o 0004 —
--   dong nao khong gan duoc se loi o buoc kiem tra, khong tu dong
--   xoa question).
--   (Cot quiz_id da co tu 0004; neu chay lenh nay ma cot chua ton tai
--    do 0004 chua chay, MUC 0 da dung lai tu truoc.)
update public.questions q
set quiz_id = z.id
from public.quizzes z
where z.lesson_id = q.lesson_id
  and q.quiz_id is null;

-- Buoc 3c: KIEM TRA — khong question nao mat quiz_id; so dong bang nhau.
do $$
declare
  v_orphan bigint;
  v_total bigint;
begin
  select count(*) into v_orphan from public.questions where quiz_id is null;
  if v_orphan > 0 then
    raise exception 'MUC 3: co % question khong gan duoc quiz_id (lesson khong co khoa hop le?). DUNG LAI, doi soat tay — khong tu dong xoa.', v_orphan;
  end if;
  select count(*) into v_total from public.questions;
  raise notice 'MUC 3: questions co % dong sau rename, 0 dong mo coi.', v_total;
end $$;

-- Buoc 3c': chi sau khi 0 dong mo coi moi dat quiz_id NOT NULL
-- (ve dung dinh nghia NOT NULL cua thiet ke 0004).
alter table public.questions alter column quiz_id set not null;

-- Buoc 3d: bo cot lesson_id cu? KHONG BO trong dot nay. Giu lai
--   questions.lesson_id lam cot doi soat cho toi khi code chuyen het
--   sang quiz_id. Xoa cot chi o migration sau khi code da chuyen.
--   (Neu muon bo ngay, can phe duyet rieng — khong tu y bo.)

-- ============================================================================
-- MUC 4 — quiz_attempts.answers (jsonb) -> answers (bang chuan hoa)
--   Backfill CO DIEU KIEN, khong bat buoc dat 100%:
--   - Cau truc jsonb hien tai KHONG duoc mo ta chac chan trong 0001
--     (chi ghi "luu dap an da chon"), nen file nay KHONG doan dinh
--     dang jsonb. Khoi backfill duoi CHI chay khi jsonb la OBJECT
--     dang {"<question_id>": "<option_id>", ...} — dinh dang pho bien
--     nhat. Neu jsonb co dang khac, khoi nay se bo qua (0 dong) va
--     ghi NOTICE, khong loi, khong xoa jsonb goc.
--   - quiz_attempts.answers (jsonb) DUOC GIU LAI de doi soat.
--   - Han che da biet (xem 0004 muc 8): UNIQUE(attempt_id, question_id)
--     chi dung cho single_choice. Neu sau nay ho tro multiple_choice
--     (1 cau hoi chon nhieu option), phai bo UNIQUE nay truoc va
--     thay bang UNIQUE(attempt_id, question_id, option_id) o
--     migration sau — KHONG sua o day khi chua co quyet dinh.
-- ============================================================================
do $$
declare
  v_inserted bigint := 0;
begin
  -- Chi backfill khi answers dang trong (chua ai ghi) va jsonb dung dang.
  if (select count(*) from public.answers) = 0 then
    insert into public.answers (attempt_id, question_id, option_id, is_correct)
    select
      qa.id,
      (kv.key)::uuid,
      (kv.value)::uuid,
      qo.is_correct
    from public.quiz_attempts qa,
         jsonb_each_text(qa.answers) as kv(key, value)
    join public.questions qq on qq.id = (kv.key)::uuid
    join public.quiz_options qo on qo.id = (kv.value)::uuid
    -- Chi backfill key/value dung dang UUID; dang khac bi bo qua
    -- (khong lam vo transaction) va bao o NOTICE.
    where kv.key ~ '^[0-9a-fA-F-]{36}$'
      and kv.value ~ '^[0-9a-fA-F-]{36}$'
    on conflict (attempt_id, question_id) do nothing;
    get diagnostics v_inserted = row_count;
  end if;
  raise notice 'MUC 4: backfill answers duoc % dong (0 = jsonb khong dung dang object question->option, hoac answers da co du lieu — can doi soat tay, jsonb goc VAN DUOC GIU).', v_inserted;
end $$;

-- ============================================================================
-- MUC 5 — profiles.role (text) -> user_roles (backfill 1 chieu, GIU cot cu)
--   - Moi profile co 1 dong user_roles tuong ung role hien tai.
--   - profiles.role KHONG XOA, KHONG DOI trong file nay — van la
--     nguon su that cho toi khi code chuyen sang doc user_roles.
--   - Neu sau nay muon nhieu role / user, code phai doc user_roles
--     thay vi profiles.role; viec bo cot profiles.role can phe
--     duyet rieng o migration sau.
-- ============================================================================
insert into public.user_roles (user_id, role)
select id, role from public.profiles
on conflict (user_id, role) do nothing;

do $$
declare v_profiles bigint; v_roles bigint;
begin
  select count(*) into v_profiles from public.profiles;
  select count(distinct user_id) into v_roles from public.user_roles;
  if v_roles < v_profiles then
    raise notice 'MUC 5: user_roles chi co % user / % profile — co profile role khong hop le (khong in student/instructor/admin)? Doi soat tay.', v_roles, v_profiles;
  else
    raise notice 'MUC 5 OK: user_roles du % user tren % profile.', v_roles, v_profiles;
  end if;
end $$;

-- ============================================================================
-- MUC 6 — orders (1 khoa / don) -> order_items (nhieu khoa / don)
--   - Moi don hien co sinh 1 dong order_items tu orders.course_id
--     + orders.amount_vnd. orders.course_id DUOC GIU LAI.
--   - Don nao co course_id NULL (neu co, du kieu NOT NULL o 0001 —
--     phong truong hop du lieu lech) se duoc bo qua va bao o NOTICE.
-- ============================================================================
insert into public.order_items (order_id, course_id, title_snapshot, amount_vnd)
select
  o.id,
  o.course_id,
  coalesce(c.title, 'Khoa hoc'),
  o.amount_vnd
from public.orders o
left join public.courses c on c.id = o.course_id
where o.course_id is not null
  and not exists (select 1 from public.order_items oi where oi.order_id = o.id);
-- Luu y: title_snapshot la anh chup ten khoa tai thoi diem tao dong
-- hang; neu khoa doi ten sau nay, snapshot khong doi theo.

do $$
declare v_orders bigint; v_items bigint; v_missing bigint;
begin
  select count(*) into v_orders from public.orders where course_id is not null;
  select count(distinct order_id) into v_items from public.order_items;
  v_missing := v_orders - v_items;
  if v_missing > 0 then
    raise notice 'MUC 6: con % don chua co order_items — doi soat tay.', v_missing;
  else
    raise notice 'MUC 6 OK: % don da co order_items.', v_items;
  end if;
end $$;

-- ============================================================================
-- MUC 7 — VIEW tam thoi ten cu (tuy chon, de code cu khong vo ngay)
--   Chi tao khi can chay song song code cu + code moi trong thoi gian
--   chuyen doi. VIEW chi doc (khong ghi). XOA view khi code da chuyen
--   het sang ten moi. Neu khong can chay song song, BO QUA muc nay.
-- ============================================================================
-- create or replace view public.modules as
--   select id, course_id, title, display_order, created_at, updated_at
--   from public.course_modules;
-- create or replace view public.quiz_questions as
--   select id, lesson_id, question, display_order, created_at, updated_at
--   from public.questions;
-- Luu y: VIEW ten cu khong the co cung ten voi bang that; chi tao duoc
-- sau khi bang cu da duoc rename (muc 1/3) — dung nhu tren.

-- ============================================================================
-- MUC 8 — ROLLBACK (chi dung khi CHUA co du lieu moi ghi vao ten moi)
--   Chay nguoc tung buoc, trong 1 transaction, tren STAGING truoc:
--     begin;
--     -- 8a. Xoa du lieu backfill o bang moi (chi khi du lieu do do
--     --     chinh file nay sinh ra, chua co du lieu moi tu API):
--     delete from public.answers;              -- backfill muc 4
--     delete from public.order_items;          -- backfill muc 6
--     delete from public.user_roles;           -- backfill muc 5
--     -- 8b. Xoa quiz tao them o muc 3a (chi quiz do file nay tao):
--     --     can doi soat bang created_at / tieu de 'Quiz — ...' truoc
--     --     khi xoa; KHONG xoa quiz do nguoi dung tao sau do.
--     -- 8c. Rename nguoc:
--     alter table public.questions rename to quiz_questions;
--     alter table public.questions_new_empty rename to questions;
--     alter table public.course_modules rename to modules;
--     alter table public.course_modules_new_empty rename to course_modules;
--     alter table public.lessons rename column course_module_id to module_id;
--     -- 8d. Bo cot them o muc 1c/3 (neu muon ve dung trang thai cu):
--     alter table public.modules
--       drop column if exists slug,
--       drop column if exists description,
--       drop column if exists is_free_preview,
--       drop column if exists is_published;
--     alter table public.quiz_questions
--       drop column if exists quiz_id,
--       drop column if exists question_type,
--       drop column if exists explanation,
--       drop column if exists points;
--     commit;
--   NEU DA CO DU LIEU MOI ghi vao ten moi (dang ky, nop quiz, don
--   hang moi sau khi chay 0005): KHONG rollback kieu nay. Phai
--   backfill nguoc du lieu moi ve ten cu truoc, roi moi rename
--   nguoc — can ke hoach rollback rieng, duyet truoc khi chay prod.
-- ============================================================================

commit;

-- ============================================================================
-- KIEM TRA SAU KHI CHAY (chay tay, so sanh voi backup truoc khi chay):
--   1. select count(*) from public.course_modules;   -- = so dong modules cu
--   2. select count(*) from public.questions;        -- = so dong quiz_questions cu
--   3. select count(*) from public.questions where quiz_id is null; -- = 0
--   4. select count(*) from public.lessons;          -- khong doi
--   5. select count(*) from public.quiz_attempts;    -- khong doi (jsonb giu nguyen)
--   6. select count(*) from public.orders;           -- khong doi
--   7. Kiem tra ten bang cu khong con (tru VIEW muc 7 neu co tao):
--      select table_name from information_schema.tables
--      where table_schema='public' and table_name in ('modules','quiz_questions');
--      -- Ky vong: 0 dong (neu khong tao VIEW muc 7).
--   8. Kiem tra bang tam: course_modules_new_empty, questions_new_empty
--      ton tai, DANG TRONG — xoa chung o migration don dep sau khi
--      code da chuyen het sang ten moi (can phe duyet rieng).
-- ============================================================================
