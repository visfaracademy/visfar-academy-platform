-- ============================================================================
-- 0016_certificates.sql — TASK 08: CERTIFICATE
--
--   Bo sung cho bang certificates (0001 + 0013) nhung gi con thieu de cap /
--   thu hoi / tra cuu chung chi that:
--     (A) Ma chung chi UNIQUE dang VISFAR-CERT-YYYY-NNNNNN (VD
--         VISFAR-CERT-2026-000001) — sequence + ham sinh ma + DEFAULT cho
--         cot certificate_code (chi ap cho dong MOI; ma cu giu nguyen).
--         Sequence la cuc toan cuc, so khong reset theo nam; tinh duy
--         nhat duoc dam bao boi sequence + UNIQUE, khong phai boi nam.
--     (B) verification_code — ma tra cuu ngan (hex 32 ky tu) de in QR /
--         tra cuu ma khong can go nguyen ma chung chi dai; UNIQUE,
--         sinh tu dong, backfill cho dong cu.
--     (C) Thu hoi: revoked_at / revoked_by / revoked_reason (0001 +
--         0013 chi co status). KHONG them CHECK "revoked => co reason"
--         vi duong thu hoi cu o lms-admin.ts (revokeEnrollment) chi
--         update status; CHECK do se lam vo duong cu. Ly do bat buoc
--         o tang lib/route (revokeCertificate), khong o CHECK.
--     (D) Dieu kien cap: eligibility_snapshot (jsonb) — anh chup dieu
--         kien tai thoi diem cap: so bai hoan thanh/tong bai, tung quiz
--         (nguong ap dung, diem cao nhat, dat/khong), trang thai
--         enrollment; + issued_via ('auto' | 'admin').
--         DIEU KIEN CAP (chot o lib certificates.ts, ghi lai o day de
--         migration va code cung 1 su that):
--           1. enrollment con active/completed (khong revoked);
--           2. hoan thanh 100% bai hoc (lesson_progress.status =
--              'completed' — chi dat khi video >= 90% theo trigger
--              0012 hoac bai text bam "Da hoan thanh"; CHI MO VIDEO
--              chi tao in_progress, KHONG bao gio cap chung chi);
--           3. moi quiz cua khoa co 1 lan lam dat nguong: diem cao
--              nhat >= quizzes.pass_score_percent, neu quiz de NULL
--              thi nguong mac dinh 70% (DEFAULT_PASSING_SCORE_PERCENT).
--         Khoa khong co quiz: chi can (1) + (2).
--     (E) Cap lai sau thu hoi: UNIQUE(user_id, course_id) goc (0001)
--         chan tao chung chi thu 2 cho cung cap user+khoa — ke ca khi
--         chung chi cu da revoked. Doi thanh UNIQUE RIENG PHAN:
--         chi 1 chung chi 'valid' / 1 cap user+khoa; chung chi revoked
--         khong chan cap moi.
--     (F) Tra cuu cong khai: ham public.verify_certificate(p_code)
--         SECURITY DEFINER — tra DUY NHAT: ma chung chi, ten hoc vien,
--         ten/slug khoa, ngay cap, trang thai. KHONG tra email, SDT,
--         user_id, verification_code, ly do thu hoi hay bat ky PII
--         nao khac. Nhan ca certificate_code lan verification_code.
--         Ham nay la duong doc cong khai DUY NHAT; khong mo RLS
--         SELECT cong khai tren bang certificates.
--     (G) RLS cho duong ghi admin qua JWT (Workers service-role bypass
--         RLS, khong can policy): admin duoc INSERT + UPDATE
--         certificates — neu khong co, route /api/admin/certificates/*
--         bi chan 42501 nhu buoc thu hoi chung chi trong
--         revokeEnrollment hien tai (chi bao certificatesWarning).
--
-- NGUYEN TAC: KHONG sua file cu (0001–0015). Idempotent o muc co the
-- (IF NOT EXISTS / guard theo pg_catalog). KHONG CHAY len DB that khi
-- viet file nay; ap staging truoc, kiem chung theo muc KIEM CHUNG
-- cuoi file, roi moi len prod. Khong phu thuoc du lieu cu.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) Ma chung chi VISFAR-CERT-YYYY-NNNNNN
-- ---------------------------------------------------------------------------
create sequence if not exists public.certificate_code_seq;

create or replace function public.generate_certificate_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'VISFAR-CERT-'
    || to_char(now(), 'YYYY')
    || '-'
    || lpad(nextval('public.certificate_code_seq')::text, 6, '0');
$$;

-- Chi dong MOI nhan ma tu ham nay; ma cu (neu co) giu nguyen.
alter table public.certificates
  alter column certificate_code set default public.generate_certificate_code();

-- Rang buoc dinh dang — chi them khi khong co dong cu nao vi pham
-- (neu DB da co ma cu khac dinh dang, bo qua CHECK thay vi lam vo
-- migration; ma moi van dung dinh dang nho DEFAULT o tren).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.certificates'::regclass
      and conname = 'certificates_code_format_check'
  ) and not exists (
    select 1 from public.certificates
    where certificate_code !~ '^VISFAR-CERT-[0-9]{4}-[0-9]{6}$'
  ) then
    alter table public.certificates
      add constraint certificates_code_format_check
      check (certificate_code ~ '^VISFAR-CERT-[0-9]{4}-[0-9]{6}$');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- (B) verification_code — ma tra cuu ngan, sinh tu dong, UNIQUE
-- ---------------------------------------------------------------------------
alter table public.certificates
  add column if not exists verification_code text;

-- Backfill dong cu: moi dong 1 gia tri ngau nhien rieng (gen_random_bytes
-- la volatile nen UPDATE danh gia lai tung dong; khong dung 1 gia tri
-- chung cho ca bang).
update public.certificates
  set verification_code = encode(gen_random_bytes(16), 'hex')
  where verification_code is null;

alter table public.certificates
  alter column verification_code set not null;
alter table public.certificates
  alter column verification_code set default encode(gen_random_bytes(16), 'hex');

create unique index if not exists idx_certificates_verification_code
  on public.certificates (verification_code);

-- ---------------------------------------------------------------------------
-- (C) Thu hoi: revoked_at / revoked_by / revoked_reason
-- ---------------------------------------------------------------------------
alter table public.certificates
  add column if not exists revoked_at timestamptz;
alter table public.certificates
  add column if not exists revoked_by uuid references public.profiles (id) on delete set null;
alter table public.certificates
  add column if not exists revoked_reason text;

-- ---------------------------------------------------------------------------
-- (D) Dieu kien cap: eligibility_snapshot + issued_via
-- ---------------------------------------------------------------------------
alter table public.certificates
  add column if not exists eligibility_snapshot jsonb;
alter table public.certificates
  add column if not exists issued_via text not null default 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.certificates'::regclass
      and conname = 'certificates_issued_via_check'
  ) then
    alter table public.certificates
      add constraint certificates_issued_via_check
      check (issued_via in ('auto', 'admin'));
  end if;
end $$;

create index if not exists idx_certificates_revoked_by
  on public.certificates (revoked_by) where revoked_by is not null;

-- ---------------------------------------------------------------------------
-- (E) Cap lai sau thu hoi: UNIQUE(user_id, course_id) -> UNIQUE RIENG PHAN
--     (chi 1 chung chi 'valid' / 1 cap user+khoa)
-- ---------------------------------------------------------------------------
do $$
declare
  v_conname text;
begin
  -- Tim constraint UNIQUE goc tren (user_id, course_id) neu con ton tai
  -- (ten mac dinh: certificates_user_id_course_id_key).
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.certificates'::regclass
    and contype = 'u'
    and conkey = (
      select array_agg(attnum order by attnum)
      from pg_attribute
      where attrelid = 'public.certificates'::regclass
        and attname in ('user_id', 'course_id')
    );
  if v_conname is not null then
    execute format('alter table public.certificates drop constraint %I', v_conname);
    raise notice '0016 (E): da bo UNIQUE goc % tren (user_id, course_id).', v_conname;
  end if;
end $$;

-- Chi chan trung khi chung chi cu van 'valid'; revoked khong chan cap moi.
-- (Neu DB da co 2 dong 'valid' trung cap user+khoa tu truoc — dieu ma
-- UNIQUE goc khong cho phep — thi lenh duoi loi; khi do phai doi soat
-- tay truoc khi ap lai. Trang thai binh thuong: 0 dong trung.)
create unique index if not exists uniq_certificates_one_valid_per_user_course
  on public.certificates (user_id, course_id)
  where status = 'valid';

-- ---------------------------------------------------------------------------
-- (F) Tra cuu cong khai — ham SECURITY DEFINER, chi tra truong an toan
-- ---------------------------------------------------------------------------
create or replace function public.verify_certificate(p_code text)
returns table (
  certificate_code text,
  recipient_name text,
  course_title text,
  course_slug text,
  issued_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.certificate_code,
    p.full_name,
    co.title,
    co.slug,
    c.issued_at,
    c.status
  from public.certificates c
  join public.profiles p on p.id = c.user_id
  join public.courses co on co.id = c.course_id
  where upper(btrim(p_code)) = upper(c.certificate_code)
     or upper(btrim(p_code)) = upper(c.verification_code)
  limit 1;
$$;

-- Ham SECURITY DEFINER vuot RLS theo thiet ke (chi tra 6 truong tren);
-- chi can GRANT EXECUTE, khong can mo policy SELECT cong khai.
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (G) RLS: admin INSERT + UPDATE certificates qua JWT
--     (can cho route /api/admin/certificates/*; Workers service-role
--     bypass RLS nen khong phu thuoc policy nay)
-- ---------------------------------------------------------------------------
drop policy if exists "certificates_insert_admin" on public.certificates;
create policy "certificates_insert_admin" on public.certificates
  for insert with check (public.current_role() = 'admin');

drop policy if exists "certificates_update_admin" on public.certificates;
create policy "certificates_update_admin" on public.certificates
  for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0016)
--   1. Cot moi ton tai:
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name='certificates'
--          and column_name in ('verification_code','revoked_at',
--            'revoked_by','revoked_reason','eligibility_snapshot',
--            'issued_via');  -- 6 dong
--   2. Ma moi dung dinh dang:
--        select public.generate_certificate_code();
--        -- Ky vong: VISFAR-CERT-2026-000001 (so tang theo lan goi)
--   3. Ham tra cuu khong lo PII (ma khong ton tai -> 0 dong):
--        select * from public.verify_certificate('VISFAR-CERT-2026-999999');
--        -- Ky vong: 0 dong. Voi ma that: 1 dong, chi 6 cot tren,
--        -- khong co cot email / phone / user_id / verification_code.
--   4. Cap lai sau thu hoi khong bi UNIQUE chan:
--        -- (tren dong test) update 1 chung chi thanh revoked roi
--        -- insert chung chi moi cung user_id + course_id voi
--        -- status='valid' -> thanh cong; insert dong 'valid' thu 2
--        -- cung cap -> LOI unique. Xoa dong test sau do.
--   5. Admin JWT insert/update certificates: dung route
--        POST /api/admin/certificates/issue va
--        POST /api/admin/certificates/<id>/revoke (xem lib
--        certificates.ts) — khong con loi 42501.
--   6. Anon REST khong doc duoc bang goc:
--        select * from certificates limit 1;  -- voi anon key
--        -- Ky vong: 0 dong (RLS certificates_select_own chan).
-- ============================================================================
