-- ============================================================================
-- 0021_admin_user_disable.sql — TASK 09 (phan 2/4): ADMIN PANEL & CRM
--   Vo hieu hoa tai khoan thay vi xoa (DECISIONS.md Task 03 QĐ 9):
--   khong xoa tai khoan con don — vo hieu hoa thay vi xoa, du lieu tai
--   chinh (orders / enrollments) giu nguyen.
--
--   Them vao profiles:
--     is_disabled     boolean   — true = tai khoan bi vo hieu hoa
--     disabled_at     timestamptz — thoi diem vo hieu hoa gan nhat
--     disabled_reason text      — ly do admin nhap (bat buoc o API)
--
--   RLS: khong doi policy — profiles_update_own (0001) da cho admin
--   UPDATE (using current_role() = 'admin', khong WITH CHECK); chi co
--   cot `role` bi trigger 0009 chan, cot is_disabled khong bi chan.
--   Admin chi doi qua API /api/admin/users/[id] sau requireAdmin().
--
--   GIOI HAN (ghi ro, khong gia vo): co nay mot minh CHUA chan dang
--   nhap — JWT da cap van dung duoc toi khi het han, RLS khong kiem
--   tra is_disabled. Chan hoc vien bi vo hieu hoa o middleware +
--   layout /hoc-vien (kiem tra is_disabled roi sign-out / 403) la
--   follow-up can coordinator quyet dinh, KHONG lam trong file nay.
--
--   NGUYEN TAC: KHONG sua file cu (0001–0016). Idempotent (IF NOT
--   EXISTS). KHONG CHAY len DB that khi viet file nay; ap staging
--   truoc, kiem chung, roi moi len prod (coordinator duyet).
-- ============================================================================

alter table public.profiles
  add column if not exists is_disabled boolean not null default false;
alter table public.profiles
  add column if not exists disabled_at timestamptz;
alter table public.profiles
  add column if not exists disabled_reason text;

create index if not exists idx_profiles_is_disabled
  on public.profiles (is_disabled);

comment on column public.profiles.is_disabled is
  'Task 09 2/4: true = tai khoan bi admin vo hieu hoa thay vi xoa (Task 03 QĐ 9). Don hang + enrollment giu nguyen.';
comment on column public.profiles.disabled_reason is
  'Task 09 2/4: ly do vo hieu hoa do admin nhap (bat buoc o API); NULL khi tai khoan dang hoat dong.';

-- Kiem chung sau khi ap (staging truoc):
--   select column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('is_disabled', 'disabled_at', 'disabled_reason');
--   -- ky vong: 3 dong (boolean / timestamp with time zone / text).
--   update public.profiles set is_disabled = true, disabled_reason = 'kiem thu'
--   where id = '<uuid hoc vien test>'; -- chi admin moi update duoc
--   -- ky vong: thanh cong voi JWT admin; hoc vien tu update is_disabled
--   -- cua minh bi chan boi profiles_update_own (chi id = auth.uid()...)
--   -- luu y: policy nay cho phep chu so huu update cac cot khac cua
--   -- chinh minh; neu muon chan hoc vien tu doi is_disabled cua minh
--   -- thi can them trigger/CHECK o migration sau (follow-up).
