-- ============================================================================
-- Visfar Academy — Migration 0009 — Task 06 security fixes (RLS)
-- Ngay: 10/11/2026
-- ----------------------------------------------------------------------------
-- LY DO: kiem chung Task 06 phat hien 3 lo RLS trong migration 0001, khong
-- duoc sua boi 0005/0006/0007 (da grep doi chieu — 0006 chi THEM policy
-- instructor, khong drop/sua 3 policy duoi day). Ca 3 deu mau thuan voi
-- docs/database/RLS_POLICIES.md va docs/architecture/ROLE_PERMISSION_MATRIX.md:
--
--   H1 (NGHIEM TRONG — leo thang dac quyen): "profiles_update_own" (0001)
--      FOR UPDATE USING (id = auth.uid() OR current_role() = 'admin')
--      KHONG co WITH CHECK ve cot nao. Voi UPDATE, khi thieu WITH CHECK thi
--      USING vua la dieu kien dong cu vua la dieu kien dong moi — dieu kien
--      `id = auth.uid()` van dung khi dong moi co role='admin' (id khong
--      doi). Hoc vien goi truc tiep qua Supabase REST:
--        update profiles set role='admin' where id = <uid cua minh>
--      SE THANH CONG. current_role() (0001) doc profiles.role nen sau do
--      moi policy "chi admin" deu mo cho hoc vien do. Frontend khong co
--      nut nao lam viec nay (auth.ts khong co ham update profile), nhung
--      RLS la lop chan cuoi — no phai chan ca khi goi truc tiep.
--      Them: trigger trg_sync_profiles_role (0007) chi dong bo
--      user_roles -> profiles.role, KHONG ngan update truc tiep
--      profiles.role, nen khong cuu duoc H1.
--
--   H2 (NGHIEM TRONG — tu ghi danh khoa tra phi): "enrollments_insert_own"
--      (0001) FOR INSERT WITH CHECK (user_id = auth.uid()). Chi kiem tra
--      user_id, khong kiem tra course_id / status / order_id. Hoc vien
--      insert truc tiep enrollment status='active' cho bat ky khoa nao,
--      bo qua don hang/thanh toan. Mau thuan RLS_POLICIES.md §5 ("Khong co
--      policy INSERT nao tren enrollments cho anon hay authenticated").
--
--   H3 (NGHIEM TRONG — tu ghi tien do gia): "progress_own" (0001)
--      FOR ALL USING (user_id = auth.uid()). Hoc vien INSERT/UPDATE
--      lesson_progress cua minh tuy y (vd 100% chua hoc). Mau thuan
--      RLS_POLICIES.md §7.7 ("Khong policy INSERT/UPDATE truc tiep cho
--      client: ghi qua Workers API").
--
--   H4 (nhe — cung ho H1): "profiles_insert_own" (0001) WITH CHECK chi
--      kiem tra id, khong kiem tra role. (Trigger handle_new_user tao
--      profile bang SECURITY DEFINER, bypass RLS, nen duong chinh khong
--      anh huong; day la phong thu chieu sau.)
--
-- CACH SUA (khong sua lich su 0001 — moi sua nam o file nay, chay sau 0007 + 0008 (F-12, da phe duyet 22:14):
--   H1: (a) trigger BEFORE UPDATE OF role tren profiles — chi chan khi
--       nguoi goi co JWT (auth.uid() IS NOT NULL) va khong phai admin;
--       service-role (uid NULL, di qua Workers) va admin JWT van duoc
--       doi role truc tiep; (b) REVOKE UPDATE (role) doi voi role
--       `authenticated` — phong thu chieu sau o muc quyen cot (trigger
--       dong bo 0007 chay SECURITY DEFINER voi quyen owner nen khong
--       bi anh huong; handle_new_user INSERT, khong phai UPDATE).
--   H2: DROP POLICY "enrollments_insert_own" — khong co policy thay the.
--       Enrollment chi tao qua Workers service-role (don paid / khoa
--       mien phi / admin tang kem audit_logs).
--   H3: DROP POLICY "progress_own" — thay bang SELECT-only cho chinh minh
--       (admin da co "progress_admin_read" rieng). Tien do chi ghi qua
--       Workers service-role sau khi kiem tra enrollment + nguong.
--   H4: tao lai "profiles_insert_own" voi WITH CHECK them role='student'.
--
-- SO THU TU: file nay la 0009 vi 0008 da duoc dung cho fix F-12
-- (0008_fix_fk_answers.sql, user phe duyet 10/11/2026 22:14). Thu tu chay:
-- 0008 (F-12) -> chay lai 0007 -> 0009 (file nay). Chu y: hien co them
-- 0008_dashboard_avatar_storage.sql (nhom Dashboard) cung mang so 0008 —
-- da doi so thanh 0010_dashboard_avatar_storage.sql ngay 10/11/2026.
-- KHONG CHAY len DB that khi viet file nay; chi viet SQL. Ap dung len
-- staging truoc (can SUPABASE_ACCESS_TOKEN — cung blocker nhu Task 05
-- C-05-01), kiem chung theo muc KIEM CHUNG cuoi file, roi moi len prod.
-- Frontend khong goi truc tiep 3 duong ghi nay (dashboard chi SELECT
-- profiles/enrollments cua minh; tien do/enrollment qua Workers) nen
-- sua nay khong lam vo frontend hien tai.
-- ============================================================================

-- --- H1(a) Trigger chan tu doi role -----------------------------------------
create or replace function public.prevent_profiles_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chi chan khi nguoi goi la user JWT (auth.uid() IS NOT NULL) va khong
  -- phai admin. Service-role (Workers, uid NULL) va admin JWT duoc phep.
  -- current_role() doc profiles.role (cache) — voi hoc vien dang leo thang
  -- thi luc trigger chay role cu van la 'student' nen bi chan.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and public.current_role() is distinct from 'admin' then
    raise exception 'Khong duoc tu thay doi vai tro (chi admin cap qua user_roles).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_block_role_change on public.profiles;
create trigger trg_profiles_block_role_change
  before update of role on public.profiles
  for each row execute function public.prevent_profiles_role_change();

-- --- H1(b) Thu hoi quyen UPDATE cot role doi voi role authenticated --------
-- (Neu cot role da bi thu hoi truoc do, REVOKE chi bao warning, khong loi.)
revoke update (role) on public.profiles from authenticated;

-- --- H4: profiles_insert_own — chi duoc tao profile role='student' ----------
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid() and role = 'student');

-- --- H2: bo hoan toan INSERT enrollment truc tiep tu client -----------------
drop policy if exists "enrollments_insert_own" on public.enrollments;

-- --- H3: lesson_progress — client chi duoc SELECT cua minh ------------------
drop policy if exists "progress_own" on public.lesson_progress;
create policy "progress_select_own" on public.lesson_progress
  for select using (user_id = auth.uid());

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0009, bang 1 JWT student that;
-- xem them docs/database/RLS_POLICIES.md §8 — test 2, 4, 9):
--   1. update profiles set role='admin' where id = auth.uid();
--      -- Ky vong: LOI (trigger H1a, hoac 42501 do H1b).
--      -- Sau do select role from profiles where id = auth.uid();
--      -- Ky vong: van 'student'.
--   2. insert into user_roles (user_id, role) values (auth.uid(), 'admin');
--      -- Ky vong: LOI (chi policy admin — khong doi o file nay).
--   3. insert into enrollments (user_id, course_id, status)
--      values (auth.uid(), '<1 khoa published>', 'active');
--      -- Ky vong: LOI (khong con policy INSERT — H2).
--   4. insert into lesson_progress (user_id, lesson_id, progress_percent)
--      values (auth.uid(), '<1 lesson>', 100);
--      -- Ky vong: LOI (chi con SELECT — H3).
--      select * from lesson_progress where user_id = auth.uid();
--      -- Ky vong: chi doc duoc dong cua minh (200, co the 0 dong).
--   5. select * from profiles where id <> auth.uid() limit 1;
--      select * from enrollments where user_id <> auth.uid() limit 1;
--      select * from orders where user_id <> auth.uid() limit 1;
--      -- Ky vong: 0 dong (khong doi o file nay, kiem chung lai sau 0009).
--   6. Kiem chung khong vo dong bo 0007: admin cap role qua user_roles
--      (qua Workers service-role) -> profiles.role cap nhat theo (trigger
--      trg_sync_profiles_role van chay, vi no UPDATE bang SECURITY DEFINER
--      voi auth.uid() NULL nen trigger H1a cho qua).
-- ============================================================================
