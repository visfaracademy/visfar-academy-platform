-- ============================================================================
-- 0018_email_task11.sql — TASK 11: EMAIL AUTOMATION (M10) — PHAN BO SUNG
--
--   File nay CHI them nhung gi file song song cung Task 11
--   0017_email_unsubscribe_logs.sql CHUA co (ap truoc, theo thu tu ten
--   file). Khong lap lai cac cot do 0017 da them — neu lap lai thi
--   IF NOT EXISTS van an toan, nhung kho doc va de lech (vd. 0017 dat
--   attempts DEFAULT 1 + CHECK >= 1; ban cu cua file nay tung dat
--   DEFAULT 0 — da bo).
--
--   Noi dung cua 0017_email_unsubscribe_logs.sql (khong lap lai o day):
--     email_logs: error_message, sent_at, attempts, next_retry_at,
--       CHECK status them 'complained'/'skipped',
--       UNIQUE idx_email_logs_resend_id, idx_email_logs_status_created.
--     newsletter_subscribers: unsubscribed_at, unsubscribe_reason,
--       hard_bounced_at + 2 index.
--
--   Noi dung cua file nay (0018):
--     (A) email_logs.user_id — lien ket toi nguoi nhan (apps/web
--         queueEmailLog ghi; admin doi soat theo user). FK SET NULL,
--         nullable. + idx_email_logs_user.
--     (B) automation_events (0004): them trigger, target_count,
--         success_count, failure_count, started_at, finished_at theo
--         DATABASE_SCHEMA.md §3.28 (thiet ke da phe duyet cho luot
--         chay cron). Luu y trung thuc: code Task 11 hien tai
--         (workers/api/src/automation-rules.ts) chi ghi event_type /
--         user_id / related_* / payload / status / processed_at /
--         error_message — cac cot §3.28 nay CHUA co code nao ghi,
--         them de DB khop thiet ke duyet, dung khi cron tong hop
--         luot chay. CHECK status mo rong them 'running'/'succeeded'
--         (theo §3.28), GIU LAI 'processed' de khong vo dong cu.
--         Cot payload cua 0004 chinh la 'details' cua §3.28 — khong
--         them cot details rieng.
--
--   Quyet dinh ten cot (doi chieu code that, khong doan):
--     - attempts (khong phai retry_count): ten store.ts/templated.ts
--       dung; 0017 da them dung ten nay.
--     - resend_id la id cua provider: khong them cot provider_message_id.
--     - token huy dang ky la HMAC ky bang UNSUBSCRIBE_SECRET
--       (workers/api/src/email/token.ts — khong luu DB): khong them
--       cot unsubscribe_token.
--     - webhook chi cap nhat status + error_message: khong them
--       provider / subject / delivered_at / bounced_at / bounce_reason.
--
--   NGUYEN TAC: KHONG sua file cu (0001–0017). Idempotent o muc co the
--   (IF NOT EXISTS / guard theo pg_catalog). KHONG CHAY len DB that khi
--   viet file nay; ap staging truoc, kiem chung theo muc KIEM CHUNG
--   cuoi file, roi moi len prod. Khong phu thuoc du lieu cu.
--   Ghi chu so hieu: 0017 da co 3 file song song (admin_user_disable —
--   Task 09; email_unsubscribe_logs — Task 11; lead_interactions —
--   Task 09); file nay la 0018. Truoc khi ap len Supabase that, can
--   coordinator xac nhan thu tu ap file (theo ten file).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) email_logs.user_id — lien ket nguoi nhan
-- ---------------------------------------------------------------------------
alter table public.email_logs
  add column if not exists user_id uuid references public.profiles (id) on delete set null;

create index if not exists idx_email_logs_user
  on public.email_logs (user_id, created_at desc) where user_id is not null;

comment on column public.email_logs.user_id is
  'Task 11: nguoi nhan (apps/web queueEmailLog ghi; admin doi soat theo user).';

-- ---------------------------------------------------------------------------
-- (B) automation_events — cot luot chay theo §3.28
-- ---------------------------------------------------------------------------
alter table public.automation_events
  add column if not exists trigger text not null default 'cron';
alter table public.automation_events
  add column if not exists target_count integer not null default 0;
alter table public.automation_events
  add column if not exists success_count integer not null default 0;
alter table public.automation_events
  add column if not exists failure_count integer not null default 0;
alter table public.automation_events
  add column if not exists started_at timestamptz not null default now();
alter table public.automation_events
  add column if not exists finished_at timestamptz;

do $$
begin
  -- CHECK trigger: cron / manual / webhook (§3.28). Cot moi co
  -- DEFAULT 'cron' nen dong cu khong vi pham.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.automation_events'::regclass
      and conname = 'automation_events_trigger_check'
  ) then
    alter table public.automation_events
      add constraint automation_events_trigger_check
      check (trigger in ('cron', 'manual', 'webhook'));
  end if;

  -- CHECK so luong >= 0 (chi them khi khong co dong vi pham).
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.automation_events'::regclass
      and conname = 'automation_events_counts_check'
  ) and not exists (
    select 1 from public.automation_events
    where target_count < 0 or success_count < 0 or failure_count < 0
  ) then
    alter table public.automation_events
      add constraint automation_events_counts_check
      check (target_count >= 0 and success_count >= 0 and failure_count >= 0);
  end if;
end $$;

-- Mo rong CHECK status: (pending, processed, failed, skipped) ->
-- (pending, processed, running, succeeded, failed, skipped).
-- Giu 'processed' (0004) de khong vo dong cu; them 'running' +
-- 'succeeded' (theo §3.28).
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.automation_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%'
    and pg_get_constraintdef(oid) like '%pending%';
  if v_conname is not null then
    execute format('alter table public.automation_events drop constraint %I', v_conname);
    raise notice '0018 (B): da bo CHECK status cu % tren automation_events.', v_conname;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.automation_events'::regclass
      and conname = 'automation_events_status_check'
  ) then
    alter table public.automation_events
      add constraint automation_events_status_check
      check (status in ('pending', 'processed', 'running', 'succeeded', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists idx_automation_events_type_time
  on public.automation_events (event_type, started_at desc);
create index if not exists idx_automation_events_status_time
  on public.automation_events (status, started_at desc);

comment on column public.automation_events.trigger is
  'Task 11: nguon kich hoat luot chay — cron (Workers Cron moi gio) / manual (admin chay tay) / webhook. Theo §3.28.';
comment on column public.automation_events.payload is
  'Task 11: chi tiet luot chay (jsonb) — day la cot details cua §3.28 (0004 dat ten payload); khong them cot details rieng.';

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0017 + 0018)
--   1. Cot moi cua 0018 ton tai:
--        select table_name, column_name from information_schema.columns
--        where table_schema='public' and
--          (table_name='email_logs' and column_name='user_id'
--           or table_name='automation_events' and column_name in
--            ('trigger','target_count','success_count','failure_count',
--             'started_at','finished_at'));
--        -- Ky vong: 1 + 6 = 7 dong.
--   2. CHECK status automation_events chap nhan 'running'/'succeeded'
--      va van chap nhan 'processed' (dong cu khong vo):
--        select pg_get_constraintdef(oid) from pg_constraint
--        where conrelid='public.automation_events'::regclass
--          and conname='automation_events_status_check';
--   3. Khong co cot thua / lech ten trong ca 3 bang email:
--        select column_name from information_schema.columns
--        where table_schema='public' and table_name in
--          ('email_logs','automation_events','newsletter_subscribers')
--          and column_name in ('retry_count','provider_message_id',
--            'details','unsubscribe_token','provider','subject',
--            'delivered_at','bounced_at','bounce_reason');
--        -- Ky vong: 0 dong.
--   4. RLS khong doi: email_logs/automation_events chi admin doc,
--      ghi qua Workers (service-role) — giong 0001/0006.
-- ============================================================================
