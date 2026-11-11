-- ============================================================================
-- 0023_appointments_referrals_wallet.sql — LICH HEN + TIEP THI LIEN KET + VI
--
--   Bang moi:
--     appointments       — lich hen 1-1 hoc vien <-> giang vien/admin
--     referral_codes     — ma gioi thieu cua moi user (1 user = 1 ma)
--     referrals          — quan he gioi thieu (1 nguoi chi co 1 referrer)
--     wallet_transactions— vi hoa hong / rut tien / dieu chinh
--
--   QUY UOC VI (ghi ro de Workers + frontend dung 1 kieu):
--     - amount_vnd > 0: tien VAO vi (commission, adjustment duong).
--     - amount_vnd < 0: tien RA khoi vi (withdrawal — luu SO AM).
--     - So du vi = SUM(amount_vnd) voi status = 'completed'.
--     - So du KHA DUNG de rut = SUM(amount_vnd) voi status IN
--       ('completed', 'pending') — rut tien dang cho duyet (pending,
--       so am) da tru vao kha dung, tranh rut vuot 2 lan.
--
--   TY LE HOA HONG MAC DINH 10% — KHONG tao bang settings moi; hang so
--   COMMISSION_RATE = 0.10 nam trong workers/api/src/referrals.ts
--   (kem ghi chu "mac dinh, cho user chot"). Neu user chot ty le khac
--   hoac muon cau hinh theo khoa, doi hang so / them settings sau —
--   KHONG tu y them bang o day.
--
--   RLS:
--     - appointments: hoc vien SELECT/INSERT lich cua minh; UPDATE cua
--       minh / lich duoc giao (instructor) / admin — policy WITH CHECK
--       DON GIAN (chi rang buoc chu so huu). Logic chuyen trang thai
--       chi tiet (student chi duoc huy khi pending; confirm can
--       meeting_url khi mode zoom; ...) do Workers API kiem tra truoc
--       khi ghi (service-role bypass RLS). Client goi truc tiep REST
--       khong qua API co the doi status sai luat — chap nhan o dot nay
--       theo quyet dinh task (lop chan day du se bo sung trigger neu
--       user yeu cau, nhu mau 0022).
--     - referral_codes: owner SELECT/INSERT cua minh, admin SELECT.
--     - referrals: referrer SELECT cua minh, admin SELECT. KHONG co
--       policy INSERT — chi service-role / Workers ghi (khi user dang
--       ky kem ma gioi thieu — luong ghi do apps/web + Workers lo,
--       khong mo cho client tu ghi).
--     - wallet_transactions: owner SELECT cua minh, admin SELECT/UPDATE.
--       KHONG co policy INSERT — chi service-role / Workers ghi
--       (commission do hook confirmPayment, withdrawal do API tao
--       status pending; KHONG tu dong chuyen tien).
--
--   Helper quyen dung san: public.current_role() (0001) — KHONG co
--   ham is_admin() trong schema, nen policy dung
--   public.current_role() = 'admin'.
--
--   NGUYEN TAC: KHONG sua file cu (0001–0022). Idempotent o muc co the
--   (IF NOT EXISTS / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS).
--   CHUA ap prod trong dot nay; ap staging truoc, kiem chung, roi moi
--   len prod (coordinator duyet).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  instructor_id uuid references public.profiles (id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  mode text not null default 'zoom' check (mode in ('zoom', 'truc-tiep')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  note text,
  meeting_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_student
  on public.appointments (student_id);
create index if not exists idx_appointments_instructor
  on public.appointments (instructor_id);
create index if not exists idx_appointments_scheduled
  on public.appointments (scheduled_at);

-- Trigger cap nhat updated_at (ham co san tu 0001).
drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments
  for select using (
    student_id = auth.uid()
    or instructor_id = auth.uid()
    or public.current_role() = 'admin'
  );

drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own" on public.appointments
  for insert with check (student_id = auth.uid());

-- WITH CHECK don gian theo task: chi rang buoc chu so huu / nguoi duoc
-- giao / admin; luat chuyen trang thai chi tiet do Workers API giu.
drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own" on public.appointments
  for update using (
    student_id = auth.uid()
    or instructor_id = auth.uid()
    or public.current_role() = 'admin'
  )
  with check (
    student_id = auth.uid()
    or instructor_id = auth.uid()
    or public.current_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 2. referral_codes — 1 user = 1 ma, dang VISFAR-XXXXXX
-- ---------------------------------------------------------------------------
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles (id) on delete cascade,
  code text unique not null check (code ~ '^VISFAR-[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_codes_user
  on public.referral_codes (user_id);

alter table public.referral_codes enable row level security;

drop policy if exists "referral_codes_select_own" on public.referral_codes;
create policy "referral_codes_select_own" on public.referral_codes
  for select using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
  );

drop policy if exists "referral_codes_insert_own" on public.referral_codes;
create policy "referral_codes_insert_own" on public.referral_codes
  for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. referrals — 1 nguoi chi duoc gioi thieu boi 1 nguoi
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid unique references public.profiles (id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_user_id)
);

create index if not exists idx_referrals_referrer
  on public.referrals (referrer_id);
create index if not exists idx_referrals_referred_user
  on public.referrals (referred_user_id);

alter table public.referrals enable row level security;

-- Chi SELECT (referrer + admin). KHONG co policy INSERT/UPDATE/DELETE:
-- quan he gioi thieu chi service-role / Workers ghi.
drop policy if exists "referrals_select_referrer" on public.referrals;
create policy "referrals_select_referrer" on public.referrals
  for select using (
    referrer_id = auth.uid()
    or public.current_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 4. wallet_transactions — vi hoa hong / rut tien / dieu chinh
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('commission', 'withdrawal', 'adjustment')),
  amount_vnd bigint not null
    check (
      (type = 'commission' and amount_vnd > 0)
      or (type = 'withdrawal' and amount_vnd < 0)
      or (type = 'adjustment' and amount_vnd <> 0)
    ),
  related_order_id uuid references public.orders (id) on delete set null,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'rejected')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_user
  on public.wallet_transactions (user_id);
create index if not exists idx_wallet_order
  on public.wallet_transactions (related_order_id);

-- Chan ghi hoa hong trung cho cung 1 don o muc DB (lop chan cuoi cho
-- tinh idempotent cua hook confirmPayment — Workers van kiem tra
-- truoc khi insert).
create unique index if not exists uq_wallet_one_commission_per_order
  on public.wallet_transactions (related_order_id)
  where type = 'commission' and related_order_id is not null;

alter table public.wallet_transactions enable row level security;

-- Chi SELECT (owner + admin) va UPDATE (admin — duyet/tu choi rut tien).
-- KHONG co policy INSERT: chi service-role / Workers ghi.
drop policy if exists "wallet_select_own" on public.wallet_transactions;
create policy "wallet_select_own" on public.wallet_transactions
  for select using (
    user_id = auth.uid()
    or public.current_role() = 'admin'
  );

drop policy if exists "wallet_update_admin" on public.wallet_transactions;
create policy "wallet_update_admin" on public.wallet_transactions
  for update using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0023):
--   1. select * from pg_tables where tablename in
--      ('appointments','referral_codes','referrals','wallet_transactions');
--      -- Ky vong: 4 dong, schemaname = 'public'.
--   2. select tablename, rowsecurity from pg_tables where tablename in (...);
--      -- Ky vong: rowsecurity = true cho ca 4 bang.
--   3. select schemaname, tablename, policyname from pg_policies
--      where tablename in (... ) order by tablename, policyname;
--      -- Ky vong: appointments 3 policy (select/insert/update),
--      -- referral_codes 2, referrals 1, wallet_transactions 2.
--   4. insert vao wallet_transactions 2 dong commission cung
--      related_order_id -> dong 2 LOI (unique index
--      uq_wallet_one_commission_per_order).
--   5. JWT student: select appointments cua minh OK; select cua nguoi
--      khac 0 dong; insert wallet_transactions truc tiep -> LOI (khong
--      co policy INSERT).
-- ============================================================================
