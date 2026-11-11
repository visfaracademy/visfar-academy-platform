-- ============================================================================
-- 0019_commerce_payment.sql — TASK 10: PAYMENT & COMMERCE
--
--   Bo sung cho thuong mai / thanh toan nhung gi Task 03 thiet ke nhung
--   migration 0001/0004 chua co (hoac lech ten cot), de Workers API +
--   trang hoc vien dung duoc that:
--
--   (A) orders: coupon_id, original_amount_vnd, discount_vnd, paid_at,
--       refund_reason / refund_requested_at / refunded_at /
--       refund_bank_reference, idempotency_key (UNIQUE, chong tao don
--       trung khi retry — API_ARCHITECTURE §4, hieu luc 24h o server).
--       + Ma don tu dong: sequence + generate_order_reference()
--       'DH-YYYY-NNNNNN' (VD DH-2026-000123) lam DEFAULT cho
--       reference_code — noi dung chuyen khoan (SYSTEM_ARCHITECTURE §8).
--   (B) orders.user_id: CASCADE -> SET NULL + nullable (DECISIONS.md
--       Task 03 QĐ 9: xoa tai khoan con don thi vo hieu hoa + an danh,
--       giu don de doi soat; khong xoa don theo tai khoan).
--   (C) order_items: them item_type / item_name / unit_price_vnd /
--       quantity / total_vnd theo DATABASE_SCHEMA §3.19; course_id cho
--       phep NULL (don chi mua goi thanh vien khong co course_id);
--       backfill tu cot cu title_snapshot / amount_vnd (0004/0005).
--       Cot cu title_snapshot / amount_vnd GIU LAI (khong drop) de
--       tuong thich nguoc. Frontend hien tai (apps/web/src/lib/
--       dashboard.ts getMyOrders) DA select item_name, unit_price_vnd,
--       quantity, total_vnd va orders.paid_at — truoc migration nay
--       cac cot do chua ton tai; sau migration nay trang /hoc-vien/
--       don-hang doc duoc that.
--   (D) payments: them index doi soat (method, gateway_reference) va
--       (status, created_at). UNIQUE(method, gateway_reference) da co
--       tu 0001 — webhook gui lai khong tao payment trung.
--   (E) coupons: min_order_vnd, max_discount_vnd, created_by;
--       CHECK percent <= 100. GIU NGUYEN ten cot thuc te cua 0004:
--       discount_type 'percent' | 'fixed_vnd' (thiet ke Task 03 ghi
--       'fixed_amount' — code dung 'fixed_vnd' theo DB that),
--       max_uses (thiet ke ghi usage_limit), valid_until (thiet ke ghi
--       valid_to), is_active (thiet ke ghi status). Code KHONG dung
--       ten cot thiet ke khi DB that dung ten khac.
--   (F) membership_plans: course_id (goi kem khoa, vd. goi Cong dong
--       kem khoa 'Cong dong Visfar'; NULL = goi doc lap).
--       memberships: status them 'pending' (cho thanh toan); them
--       expires_at GENERATED tu ends_at (thiet ke ghi expires_at,
--       DB that dung ends_at — 2 cot luon dong bo, code dung
--       expires_at).
--   (G) courses.is_pay_what_you_want: co true = khoa Tuy tam (gia 0
--       + hoc vien nhap custom_amount_vnd). MAC DINH false cho moi
--       khoa; KHONG bat cho khoa nao o day — user chua xac nhan khoa
--       nao la Tuy tam (Task 02 §8.2 chi noi 'Khoa 07 (va cac khoa
--       Tuy tam khac)' nhung khong ghi ro slug). Admin bat sau khi
--       user xac nhan. Gia khoa van 0đ / Tuy tam toi khi user cung
--       cap gia (DECISIONS Task 03 QĐ 11).
--   (H) system_settings: seed 9 key da chot (7 key §3.31 +
--       payment.provider = 'sepay' + payment.bank_name = 'MB Bank').
--       KHONG luu so tai khoan, KHONG luu secret o day.
--   (I) RLS: admin INSERT payments (verified_by = chinh admin) +
--       admin UPDATE orders — theo tien le 0013 (admin INSERT
--       enrollments / audit_logs qua JWT). Workers service-role
--       bypass RLS nen khong phu thuoc policy nay; policy chi mo
--       duong admin tren Next.js. Hoc vien KHONG duoc INSERT/UPDATE
--       payments hay orders — don chi sang 'paid' qua webhook da
--       xac minh hoac admin xac nhan (SYSTEM_ARCHITECTURE §8).
--
-- NGUYEN TAC: KHONG sua file cu (0001–0016). Idempotent o muc co the
-- (IF NOT EXISTS / guard theo pg_catalog). KHONG CHAY len DB that khi
-- viet file nay; ap staging truoc, kiem chung theo muc KIEM CHUNG
-- cuoi file, roi moi len prod.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (A) orders — cot moi
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists coupon_id uuid references public.coupons (id) on delete set null;
alter table public.orders
  add column if not exists original_amount_vnd integer check (original_amount_vnd is null or original_amount_vnd >= 0);
alter table public.orders
  add column if not exists discount_vnd integer not null default 0 check (discount_vnd >= 0);
alter table public.orders
  add column if not exists paid_at timestamptz;
alter table public.orders
  add column if not exists refund_reason text;
alter table public.orders
  add column if not exists refund_requested_at timestamptz;
alter table public.orders
  add column if not exists refunded_at timestamptz;
alter table public.orders
  add column if not exists refund_bank_reference text;
alter table public.orders
  add column if not exists idempotency_key text;
alter table public.orders
  add column if not exists idempotency_body_hash text;

-- Backfill: don cu chua co gia goc = so tien da tra (discount luc do = 0).
update public.orders
  set original_amount_vnd = amount_vnd
  where original_amount_vnd is null;

-- Idempotency-Key duy nhat / don (NULL duoc phep nhieu dong — don cu
-- chua co key). Trung key + body khac -> API tra 409, khong ghi them.
create unique index if not exists idx_orders_idempotency_key
  on public.orders (idempotency_key) where idempotency_key is not null;
create index if not exists idx_orders_status_expires
  on public.orders (status, expires_at);
create index if not exists idx_orders_coupon on public.orders (coupon_id);
create index if not exists idx_orders_paid_at
  on public.orders (paid_at desc) where status = 'paid';

-- Ma don tu dong DH-YYYY-NNNNNN (sequence toan cuc; tinh duy nhat dam
-- bao boi sequence + UNIQUE(reference_code), khong phai boi nam).
create sequence if not exists public.order_reference_seq;

create or replace function public.generate_order_reference()
returns text
language sql
volatile
set search_path = public
as $$
  select 'DH-'
    || to_char(now(), 'YYYY')
    || '-'
    || lpad(nextval('public.order_reference_seq')::text, 6, '0');
$$;

-- Tang / giam luot dung coupon NGUYEN TU (tranh race khi 2 don cung
-- dung 1 ma). Tra true neu doi so luong thanh cong, false neu ma het
-- luot / khong ton tai. Workers goi qua PostgREST /rpc.
create or replace function public.apply_coupon_use(p_coupon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.coupons
    set used_count = used_count + 1
    where id = p_coupon_id
      and (max_uses is null or used_count < max_uses);
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.release_coupon_use(p_coupon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.coupons
    set used_count = greatest(used_count - 1, 0)
    where id = p_coupon_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Chi don MOI nhan ma tu ham nay; ma cu giu nguyen.
alter table public.orders
  alter column reference_code set default public.generate_order_reference();

-- ---------------------------------------------------------------------------
-- (B) orders.user_id: CASCADE -> SET NULL (Task 03 QĐ 9)
-- ---------------------------------------------------------------------------
-- Ten constraint FK mac dinh cua Postgres la orders_user_id_fkey; tim
-- va xoa bat ky FK nao tu orders.user_id -> profiles(id) de khong phu
-- thuoc ten constraint.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'f'
      and conkey = array[
        (select attnum from pg_attribute
          where attrelid = 'public.orders'::regclass and attname = 'user_id')
      ]
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.orders alter column user_id drop not null;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- (C) order_items — cot moi theo DATABASE_SCHEMA §3.19
-- ---------------------------------------------------------------------------
alter table public.order_items
  add column if not exists item_type text not null default 'course'
    check (item_type in ('course', 'membership'));
alter table public.order_items
  add column if not exists item_name text;
alter table public.order_items
  add column if not exists unit_price_vnd integer check (unit_price_vnd is null or unit_price_vnd >= 0);
alter table public.order_items
  add column if not exists quantity integer not null default 1 check (quantity > 0);
alter table public.order_items
  add column if not exists total_vnd integer check (total_vnd is null or total_vnd >= 0);

-- Backfill tu cot cu: ten = title_snapshot, don gia = tong = amount_vnd.
update public.order_items
  set item_name = coalesce(item_name, title_snapshot),
      unit_price_vnd = coalesce(unit_price_vnd, amount_vnd),
      total_vnd = coalesce(total_vnd, amount_vnd),
      item_type = case
        when membership_plan_id is not null then 'membership'
        else 'course'
      end
  where item_name is null or unit_price_vnd is null or total_vnd is null;

alter table public.order_items alter column item_name set not null;
alter table public.order_items alter column unit_price_vnd set not null;
alter table public.order_items alter column total_vnd set not null;

-- Don chi mua goi thanh vien khong co course_id -> cho phep NULL.
alter table public.order_items alter column course_id drop not null;

-- Bo UNIQUE(order_id, course_id) cu (chan don goi thanh vien + chan
-- 2 dong cung khoa trong 1 combo). Thay bang CHECK: moi dong chi
-- thuoc 1 loai hang.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_order_id_course_id_key'
  ) then
    alter table public.order_items drop constraint order_items_order_id_course_id_key;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_single_item_type_check'
  ) then
    alter table public.order_items
      add constraint order_items_single_item_type_check
      check (
        (item_type = 'course' and course_id is not null and membership_plan_id is null)
        or (item_type = 'membership' and membership_plan_id is not null and course_id is null)
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_total_check'
  ) then
    alter table public.order_items
      add constraint order_items_total_check
      check (total_vnd = unit_price_vnd * quantity);
  end if;
end $$;

create index if not exists idx_order_items_plan
  on public.order_items (membership_plan_id);

-- Trigger updated_at cho bang da co (0004 chi lap trigger cho bang moi).
drop trigger if exists trg_order_items_updated_at on public.order_items;
create trigger trg_order_items_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- (D) payments — index doi soat
-- ---------------------------------------------------------------------------
create index if not exists idx_payments_gateway
  on public.payments (method, gateway_reference);
create index if not exists idx_payments_status
  on public.payments (status, created_at desc);

-- ---------------------------------------------------------------------------
-- (E) coupons — min / max / nguoi tao / CHECK percent
-- ---------------------------------------------------------------------------
alter table public.coupons
  add column if not exists min_order_vnd integer not null default 0 check (min_order_vnd >= 0);
alter table public.coupons
  add column if not exists max_discount_vnd integer check (max_discount_vnd is null or max_discount_vnd > 0);
alter table public.coupons
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.coupons'::regclass
      and conname = 'coupons_percent_value_check'
  ) then
    alter table public.coupons
      add constraint coupons_percent_value_check
      check ((discount_type = 'percent' and discount_value <= 100) or discount_type = 'fixed_vnd');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- (F) membership_plans.course_id + memberships 'pending' / expires_at
-- ---------------------------------------------------------------------------
alter table public.membership_plans
  add column if not exists course_id uuid references public.courses (id) on delete set null;
create index if not exists idx_membership_plans_course
  on public.membership_plans (course_id);

-- Them 'pending' vao CHECK status (don cho thanh toan).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.memberships'::regclass
      and conname = 'memberships_status_check'
  ) then
    alter table public.memberships drop constraint memberships_status_check;
  end if;
  alter table public.memberships
    add constraint memberships_status_check
    check (status in ('active', 'expired', 'cancelled', 'pending'));
end $$;

-- expires_at GENERATED tu ends_at (DB that dung ends_at; thiet ke ghi
-- expires_at). Code dung expires_at; 2 cot luon dong bo.
alter table public.memberships
  add column if not exists expires_at timestamptz generated always as (ends_at) stored;
create index if not exists idx_memberships_expires
  on public.memberships (expires_at) where status = 'active';

-- ---------------------------------------------------------------------------
-- (G) courses.is_pay_what_you_want — mac dinh false, chua bat khoa nao
-- ---------------------------------------------------------------------------
alter table public.courses
  add column if not exists is_pay_what_you_want boolean not null default false;

-- ---------------------------------------------------------------------------
-- (H) system_settings — seed 9 key da chot (KHONG so tai khoan, KHONG secret)
-- ---------------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public)
values
  ('completion.video_threshold_percent', '90'::jsonb, 'Nguong hoan thanh video (%) — QĐ 17', false),
  ('order.expiry_hours', '48'::jsonb, 'Han giu cho don chuyen khoan (gio)', false),
  ('order.reminder_hours', '[12, 24]'::jsonb, 'Cac moc nhac thanh toan (gio sau khi tao don) — email E6/E7', false),
  ('learning.inactivity_reminder_days', '7'::jsonb, 'So ngay khong hoc thi nhac — email E10', false),
  ('refund.working_days', '15'::jsonb, 'Khung xu ly hoan tra (ngay lam viec) — QĐ 9', false),
  ('complaint.response_days', '3'::jsonb, 'Khung phan hoi khieu nai (ngay) — QĐ 9', false),
  ('event.reminder_hours_before', '24'::jsonb, 'Nhac su kien truoc bao nhieu gio — email E11', false),
  ('payment.provider', '"sepay"'::jsonb, 'Cong thanh toan — QĐ 15 (SePay). Stripe chua dung.', true),
  ('payment.bank_name', '"MB Bank"'::jsonb, 'Ngan hang nhan chuyen khoan — QĐ 15. So tai khoan KHONG luu o day.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- (I) RLS — admin ghi payments / sua orders qua JWT (tien le 0013)
-- ---------------------------------------------------------------------------
-- Admin xac nhan thu cong: tao payments voi verified_by = chinh admin.
drop policy if exists "payments_insert_admin" on public.payments;
create policy "payments_insert_admin" on public.payments
  for insert with check (
    public.current_role() = 'admin'
    and verified_by = auth.uid()
  );

-- Admin sua don: doi status / paid_at / thong tin hoan tra. Khong cho
-- admin sua amount_vnd / reference_code qua policy nay (chi sua trang
-- thai — tien chi doi khi tao don hoac hoan tra co payments moi).
-- Ghi chu: policy UPDATE khong gioi han cot o Postgres; rang buoc nay
-- duoc dam bao o tang API (Workers + route admin chi update cac cot
-- trang thai). Khong mo UPDATE cho hoc vien.
drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin" on public.orders
  for update using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- KIEM CHUNG SAU KHI CHAY (chay tay, khong tu dong doi du lieu):
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'orders'
--     and column_name in ('coupon_id','original_amount_vnd','discount_vnd',
--       'paid_at','refund_reason','refund_requested_at','refunded_at',
--       'refund_bank_reference','idempotency_key');           -- ky vong 9 dong
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'order_items'
--     and column_name in ('item_type','item_name','unit_price_vnd',
--       'quantity','total_vnd');                              -- ky vong 5 dong
--   select key, value from public.system_settings
--     where key like 'payment.%' or key like 'refund.%'
--     or key like 'complaint.%' or key like 'order.%';        -- ky vong 6 dong, KHONG co so tai khoan
--   select public.generate_order_reference();                  -- dang DH-YYYY-NNNNNN
--   -- Don cu: moi orders deu co >= 1 order_items, total = unit*quantity:
--   select count(*) from public.orders o
--     where not exists (select 1 from public.order_items oi where oi.order_id = o.id);
--     -- ky vong 0 (neu DB co don tu 0005; DB trong ky vong 0 vi chua co don)
--   select count(*) from public.order_items
--     where total_vnd <> unit_price_vnd * quantity;           -- ky vong 0
--   -- Hoc vien KHONG insert duoc payments (test bang JWT hoc vien):
--   --   insert into public.payments (order_id, amount_vnd, method, status)
--   --   values ('<order-id>', 1000, 'bank_transfer', 'succeeded');
--   --   -- ky vong loi 42501 (RLS chan).
-- ============================================================================
