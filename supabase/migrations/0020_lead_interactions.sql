-- ============================================================================
-- 0020_lead_interactions.sql — TASK 09 phan 4/4: CRM + AUDIT LOG
--
--   (A) Bang lead_interactions: lich su tuong tac voi lead (moi tuong
--       tac ghi ai, khi nao, kenh, noi dung, ket qua). Trang /admin/crm
--       doc + ghi bang nay qua lib crm.ts (addLeadInteraction /
--       fetchLeadDetail). TRUOC 0020 khong co bang nay — page van chay
--       nhung muc tuong tac hien canh bao thay vi lich su.
--   (B) Policy orders_admin_update: can de refundOrder() o
--       lms-admin.ts chay qua JWT admin (orders hien chi co policy
--       SELECT cho admin o 0001/0006, chua co UPDATE — goi hoan tra
--       qua JWT se bi chan 42501 neu thieu policy nay).
--
-- NGUYEN TAC: KHONG sua file cu (0001–0016). Idempotent o muc co the
-- (IF NOT EXISTS / drop policy if exists). KHONG CHAY len DB that khi
-- viet file nay; ap staging truoc (can SUPABASE_ACCESS_TOKEN), kiem
-- chung theo muc KIEM CHUNG cuoi file, roi moi len prod.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) lead_interactions
-- ---------------------------------------------------------------------------
create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  channel text not null
    check (channel in ('phone', 'zalo', 'email', 'in_person', 'other')),
  content text not null check (char_length(content) >= 1 and char_length(content) <= 2000),
  outcome text
    check (outcome in ('no_answer', 'interested', 'not_interested', 'enrolled', 'follow_up')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lead_interactions_lead_created
  on public.lead_interactions (lead_id, created_at desc);
create index if not exists idx_lead_interactions_actor
  on public.lead_interactions (actor_id);

alter table public.lead_interactions enable row level security;

-- Chi admin doc / ghi tuong tac (lead la du lieu nhay cam: SDT/email).
drop policy if exists "lead_interactions_admin_all" on public.lead_interactions;
create policy "lead_interactions_admin_all" on public.lead_interactions
  for all using (public.current_role() = 'admin');

-- Trigger updated_at (dung lai ham 0001).
drop trigger if exists trg_lead_interactions_updated_at on public.lead_interactions;
create trigger trg_lead_interactions_updated_at
  before update on public.lead_interactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- (B) orders: admin duoc UPDATE (chi de hoan tra — refundOrder)
-- ---------------------------------------------------------------------------
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
  for update using (public.current_role() = 'admin');

-- ============================================================================
-- KIEM CHUNG (chay tay tren staging sau khi ap 0017, bang JWT admin that):
--   1. insert into lead_interactions (lead_id, actor_id, channel,
--      content, outcome) values ('<1 lead id>', auth.uid(), 'phone',
--      'Goi tu van lan 1', 'interested');
--      -- Ky vong: OK; select lai thay dong moi.
--   2. Cung cau tren bang JWT student (khong phai admin):
--      -- Ky vong: LOI 42501 (policy lead_interactions_admin_all).
--   3. update orders set status='refunded' where id='<1 don paid>'
--      bang JWT admin: -- Ky vong: OK (policy orders_admin_update).
--      Bang JWT student: -- Ky vong: LOI 42501.
--      Sau kiem chung, khoi phuc don test ve 'paid' neu can.
--   4. Trang /admin/crm/<lead id>: muc lich su tuong tac hien dong
--      vua insert; them tuong tac moi tu UI -> dong moi xuat hien +
--      1 dong audit_logs action='lead.interaction'.
--   5. Hoan tra 1 don paid tu UI/route admin (neu co) -> orders
--      status='refunded' + 1 dong audit_logs action='order.refund'.
-- ============================================================================
