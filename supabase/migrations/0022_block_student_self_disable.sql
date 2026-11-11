-- ============================================================================
-- 0022_block_student_self_disable.sql — S-01: CHAN HOC VIEN TU VO HIEU HOA
--   (VA NHUNG COT LIEN QUAN) TAI KHOAN CUA CHINH MINH
--
--   LO HONG (0021 de lai, ghi ro trong 0021): cot profiles.is_disabled /
--   disabled_at / disabled_reason KHONG bi chan — policy
--   profiles_update_own (0001) cho phep chu so huu UPDATE dong cua minh
--   (USING id = auth.uid(), khong WITH CHECK ve cot), nen hoc vien goi
--   truc tiep qua Supabase REST:
--     update profiles set is_disabled = true where id = auth.uid();
--   SE THANH CONG. Hoc vien tu vo hieu hoa tai khoan cua minh (hoac tu
--   mo lai / tu sua ly do) la hanh vi chi admin moi duoc lam (0021:
--   admin chi doi qua API /api/admin/users/[id] sau requireAdmin()).
--
--   CACH SUA (khong sua lich su 0001–0021 — moi sua nam o file nay):
--   Trigger BEFORE UPDATE OF is_disabled, disabled_at, disabled_reason
--   tren profiles, theo dung mau trigger chan doi role cua 0009
--   (prevent_profiles_role_change / trg_profiles_block_role_change):
--     - Chan khi nguoi goi co JWT (auth.uid() IS NOT NULL) va khong
--       phai admin (public.current_role() IS DISTINCT FROM 'admin'),
--       va bat ky cot nao trong 3 cot tren thay doi (IS DISTINCT FROM
--       gia tri cu). RAISE EXCEPTION -> REST tra loi 4xx, UPDATE
--       khong ghi gi.
--     - CHO PHEP: service-role (Workers, auth.uid() NULL — khong co
--       JWT nguoi dung) va admin JWT (current_role() = 'admin').
--       Admin van doi is_disabled truc tiep bang JWT qua
--       admin-users.ts setUserDisabled() (khong qua service-role),
--       nen trigger PHAI cho admin qua — khong duoc dung REVOKE o day.
--
--   KHONG DUNG REVOKE UPDATE (is_disabled, ...) FROM authenticated:
--   moi user dang nhap (ke ca admin) deu mang role `authenticated`,
--   nen REVOKE se pha luong admin vo hieu hoa / mo lai tai khoan
--   (setUserDisabled goi .update() bang JWT admin qua anon key).
--   Khac voi 0009 (REVOKE role an toan vi admin khong bao gio UPDATE
--   profiles.role truc tiep — role doi qua user_roles + trigger dong
--   bo SECURITY DEFINER). O day trigger la lop chan duy nhat, va la
--   lop chan dung: no so sanh OLD vs NEW nen chi chan dung 3 cot nay,
--   hoc vien van sua duoc cac cot khac cua profile minh (full_name,
--   phone, ...) nhu truoc.
--
--   KHONG VIET LAI profiles_update_own VOI WITH CHECK: WITH CHECK
--   chi nhin duoc dong MOI, khong tham chieu duoc OLD, nen khong the
--   dien dat "is_disabled khong duoc doi"; ep new.is_disabled = false
--   trong WITH CHECK vua khong chan duoc truong hop hoc vien da bi
--   disable (dong moi is_disabled = true se bi chan ca khi chi sua
--   ten), vua la hanh vi sai. Trigger so sanh OLD/NEW la cach dung.
--
--   Chan dang nhap khi bi disable (middleware + layout /hoc-vien doc
--   is_disabled roi sign-out / redirect ve /dang-nhap?reason=disabled)
--   lam o apps/web trong cung dot S-01 nay, KHONG nam trong file nay.
--
--   NGUYEN TAC: KHONG sua file cu (0001–0021). Idempotent (CREATE OR
--   REPLACE + DROP TRIGGER IF EXISTS). KHONG CHAY len prod trong dot
--   nay; ap staging truoc, kiem chung, roi moi len prod (coordinator
--   duyet).
-- ============================================================================

-- --- Trigger chan tu doi is_disabled / disabled_at / disabled_reason -------
create or replace function public.prevent_profiles_disable_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chi chan khi nguoi goi la user JWT (auth.uid() IS NOT NULL) va khong
  -- phai admin. Service-role (Workers, uid NULL) va admin JWT duoc phep.
  -- current_role() doc profiles.role — voi hoc vien thi luc trigger chay
  -- role cu van la 'student' nen bi chan.
  if (new.is_disabled is distinct from old.is_disabled
      or new.disabled_at is distinct from old.disabled_at
      or new.disabled_reason is distinct from old.disabled_reason)
     and auth.uid() is not null
     and public.current_role() is distinct from 'admin' then
    raise exception 'Khong duoc tu thay doi trang thai vo hieu hoa tai khoan (chi admin moi duoc).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_block_disable_change on public.profiles;
create trigger trg_profiles_block_disable_change
  before update of is_disabled, disabled_at, disabled_reason on public.profiles
  for each row execute function public.prevent_profiles_disable_change();

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0022, bang 1 JWT student that;
--   JWT admin that chi dung de xac minh duong admin khong vo):
--   1. update profiles set is_disabled = true where id = auth.uid();
--      -- Ky vong: LOI (trigger, REST tra 4xx) — PATCH /rest/v1/profiles
--      -- bang anon key + JWT student bi chan.
--      -- Sau do select is_disabled from profiles where id = auth.uid();
--      -- Ky vong: van false.
--   2. update profiles set disabled_reason = 'tu sua' where id = auth.uid();
--      -- Ky vong: LOI (trigger chan ca disabled_reason).
--   3. update profiles set full_name = 'Ten moi' where id = auth.uid();
--      -- Ky vong: THANH CONG (trigger chi chan 3 cot disable, khong
--      -- chan sua profile binh thuong).
--   4. Admin (JWT admin): update profiles set is_disabled = true,
--      disabled_at = now(), disabled_reason = 'kiem thu S-01'
--      where id = '<uuid hoc vien test>';
--      -- Ky vong: THANH CONG; sau do tra lai is_disabled = false.
--   5. Hoc vien bi disable (is_disabled = true, do admin set): mo
--      /hoc-vien -> middleware + layout chan, sign-out, ve
--      /dang-nhap?reason=disabled (kiem chung o dot S-01, khong o day).
-- ============================================================================
