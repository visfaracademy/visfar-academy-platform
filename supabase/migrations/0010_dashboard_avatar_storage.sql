-- 0010_dashboard_avatar_storage.sql — Task 06 (Student Dashboard)
--
-- 1. Policy Storage cho bucket `avatars` (bucket da tao o 0007, public;
--    0007 ghi ro "Policy Storage chi tiet lam o buoc sau" — buoc sau
--    chinh la file nay). Chi chu so huu duoc ghi/xoa anh cua minh:
--    duong dan <auth.uid()>/avatar.<ext>. Doc cong khai (bucket public).
-- 2. (DA BO ngay 10/11/2026, xem muc (b) cuoi file) Policy SELECT rieng
--    cho hoc vien tren `learning_events` — bang thuc te khong co cot
--    user_id nen khong the tao policy nay; lich su hoc thuoc ve
--    activity_logs (follow-up Task 06).
--
-- Nguyen tac: idempotent (IF NOT EXISTS / DROP IF EXISTS + CREATE),
-- guard to_regclass — chay lai an toan, khong sua migration cu.
-- KHONG chay o day; chay len staging/prod bang Supabase CLI / SQL
-- Editor khi co access token (xem docs/frontend/TASK06_REPORT.md).

-- ============================================================================
-- (a) Storage policies — bucket `avatars`
-- ============================================================================
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'storage' and table_name = 'objects') then
    raise notice '(a) BO QUA: schema storage / bang storage.objects khong ton tai.';
    return;
  end if;

  -- Doc: ai cung doc duoc (bucket public) — anh dai dien hien tren trang.
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'avatars_select_public') then
    create policy "avatars_select_public" on storage.objects
      for select using (bucket_id = 'avatars');
    raise notice '(a) OK: policy avatars_select_public.';
  end if;

  -- Ghi: chi chu so huu, file nam ngay duoi thu muc <auth.uid()>/.
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'avatars_insert_own') then
    create policy "avatars_insert_own" on storage.objects
      for insert with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
    raise notice '(a) OK: policy avatars_insert_own.';
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'avatars_update_own') then
    create policy "avatars_update_own" on storage.objects
      for update using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
    raise notice '(a) OK: policy avatars_update_own.';
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname = 'avatars_delete_own') then
    create policy "avatars_delete_own" on storage.objects
      for delete using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
    raise notice '(a) OK: policy avatars_delete_own.';
  end if;
end $$;

-- ============================================================================
-- (b) learning_events — DA BO (sua ngay 10/11/2026, truoc khi ap lan dau):
--   Ban goc tao policy "learning_events_select_own" voi
--   using (user_id = auth.uid()), nhung bang learning_events THUC TE
--   (0004) la buoi hoc truc tiep gan khoa hoc: chi co course_id,
--   lesson_id, title, starts_at... — KHONG co cot user_id / event_type /
--   event_data / occurred_at. Chay ban goc loi 42703
--   (column "user_id" does not exist) va lam rollback ca phan (a).
--   Lich su hoc cua hoc vien thuoc ve activity_logs (co user_id, action,
--   created_at) — can sua dashboard.ts getMyLearningHistory() doc tu
--   activity_logs/lesson_progress thay vi learning_events (follow-up
--   Task 06, chua lam o file nay). Policy SELECT cu cho learning_events
--   (0006, theo khoa da ghi danh) giu nguyen.
-- ============================================================================

-- Kiem chung sau khi chay (SQL Editor):
--   select policyname from pg_policies where tablename = 'objects'
--     and policyname like 'avatars_%';            -- ky vong: 4 dong
