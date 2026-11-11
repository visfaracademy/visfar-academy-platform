-- ============================================================================
-- 0017_email_unsubscribe_logs.sql — TASK 11: UNSUBSCRIBE + EMAIL LOGS +
--   BOUNCE / RETRY (Resend)
--
--   Bo sung cho 2 bang Module 1 (0001) nhung gi con thieu de lam that
--   unsubscribe, log email, retry va xu ly bounce:
--     (A) email_logs: them error_message, sent_at (DATA_DICTIONARY §2.27
--         da ghi "MOI" nhung 0001 chua co); them attempts + next_retry_at
--         de theo doi retry; mo rong CHECK status them 'complained'
--         (khieu nai spam) va 'skipped' (bi chan vi huy nhan tin /
--         hard bounce — co log nhung khong gui that).
--     (B) email_logs: unique index theo resend_id (moi email Resend chi
--         co 1 dong log; webhook tim dong de cap nhat theo resend_id).
--     (C) newsletter_subscribers: them unsubscribed_at,
--         unsubscribe_reason, hard_bounced_at — de route huy dang ky
--         va webhook bounce ghi lai, va de sender kiem tra quyen nhan
--         tin truoc khi gui marketing/care.
--     (D) Khong doi RLS: ghi van chi qua Workers service-role; admin
--         chi SELECT (policy cu 0001 giu nguyen).
--
-- NGUYEN TAC: KHONG sua file cu (0001–0016). Idempotent o muc co the
-- (IF NOT EXISTS / guard theo pg_catalog). KHONG CHAY len DB that khi
-- viet file nay; ap staging truoc, kiem chung theo muc KIEM CHUNG
-- cuoi file, roi moi len prod. Trang thai: CHUA AP.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) email_logs — cot moi
-- ---------------------------------------------------------------------------
alter table public.email_logs
  add column if not exists error_message text;

alter table public.email_logs
  add column if not exists sent_at timestamptz;

-- So lan da thu gui (1 = gui 1 lan, khong retry; toi da 3 — xem
-- workers/api/src/email/retry.ts, MAX_SEND_ATTEMPTS).
alter table public.email_logs
  add column if not exists attempts integer not null default 1
  check (attempts >= 1);

-- Thoi diem hen thu lai lan ke (NULL = khong hen thu lai).
alter table public.email_logs
  add column if not exists next_retry_at timestamptz;

-- Mo rong CHECK status: 'complained' + 'skipped'.
-- CHECK o 0001 la inline nen ten constraint do Postgres tu sinh
-- (thuong la email_logs_status_check) — tim dong theo dinh nghia
-- thay vi doan ten, roi thay bang CHECK moi.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.email_logs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%queued%'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.email_logs drop constraint %I', c.conname);
  end loop;
end $$;

-- Chi them CHECK moi khi chua co CHECK nao chua 'complained'
-- (tranh loi khi chay lai file lan 2).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.email_logs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%complained%'
  ) then
    alter table public.email_logs
      add constraint email_logs_status_check
      check (status in ('queued', 'sent', 'delivered', 'bounced',
                        'failed', 'complained', 'skipped'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- (B) email_logs — index theo resend_id (webhook tim dong de cap nhat)
-- ---------------------------------------------------------------------------
create unique index if not exists idx_email_logs_resend_id
  on public.email_logs (resend_id)
  where resend_id is not null;

create index if not exists idx_email_logs_status_created
  on public.email_logs (status, created_at desc);

-- ---------------------------------------------------------------------------
-- (C) newsletter_subscribers — cot huy dang ky + hard bounce
-- ---------------------------------------------------------------------------
alter table public.newsletter_subscribers
  add column if not exists unsubscribed_at timestamptz;

-- Ly do huy: do nguoi dung nhap, hoac he thong ghi ('hard_bounce',
-- 'spam_complaint'). Text tu do, toi da 500 ky tu o tang API.
alter table public.newsletter_subscribers
  add column if not exists unsubscribe_reason text;

-- Hard bounce (dia chi khong ton tai / bi tu choi vinh vien): dung
-- gui marketing/care cho dia chi nay, ke ca khi status van la
-- 'subscribed' (webhook Resend ghi).
alter table public.newsletter_subscribers
  add column if not exists hard_bounced_at timestamptz;

create index if not exists idx_newsletter_subscribers_status
  on public.newsletter_subscribers (status);

create index if not exists idx_newsletter_subscribers_hard_bounced
  on public.newsletter_subscribers (hard_bounced_at)
  where hard_bounced_at is not null;

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0017)
--   1. Cot moi ton tai:
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name='email_logs'
--          and column_name in ('error_message','sent_at','attempts',
--            'next_retry_at');  -- 4 dong
--        select column_name from information_schema.columns
--        where table_schema='public'
--          and table_name='newsletter_subscribers'
--          and column_name in ('unsubscribed_at','unsubscribe_reason',
--            'hard_bounced_at');  -- 3 dong
--   2. CHECK status chap nhan gia tri moi, tu choi gia tri la:
--        insert into email_logs (to_email, template, status)
--        values ('t@example.com','test','complained');  -- OK, xoa sau
--        insert into email_logs (to_email, template, status)
--        values ('t@example.com','test','skipped');     -- OK, xoa sau
--        insert into email_logs (to_email, template, status)
--        values ('t@example.com','test','nope');        -- LOI CHECK
--   3. Chay lai file lan 2 khong loi (idempotent).
--   4. Don cu van hop le: select count(*) from email_logs;
--      select count(*) from newsletter_subscribers;
--      -- bang so truoc/sau khi ap.
--   5. RLS khong doi: anon REST van khong doc duoc 2 bang
--      (policy admin-read cu 0001).
-- ============================================================================
