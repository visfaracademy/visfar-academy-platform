-- ============================================================================
-- 0027_assessments_11d.sql — He thong danh gia dau vao 11 phuong dien
--   (Thap Nhat Vien Man — Prompt 11, Giai doan 2).
--   Bang public.assessments_11d + view tong hop (khong PII) + RLS.
--   CHUA ap prod trong dot nay; ap STAGING truoc, kiem chung, roi moi
--   len prod (coordinator duyet). Khong sua file cu (0001–0026).
--
--   Thiet ke toi gian: CHI 1 bang, khong tach bang ket qua rieng.
--   - answers JSONB: {"tam-thuc-1": 4, ...} — dap an tho 1–5 theo tung cau.
--   - scores  JSONB: {"tam-thuc": 4.0, ...} — diem trung binh moi phuong
--     dien (1–5), tinh o client theo dung bo cau hoi da chot; DB chi luu
--     va rang buoc pham vi, khong tinh lai (tranh lech logic giua 2 noi).
--   - overall_score: diem trung binh 11 phuong dien (1–5).
--   - completed_at: thoi diem hoan thanh bai (lam lai -> dong moi, giu
--     lich su de so sanh qua thoi gian).
--   View public.assessment_aggregates_11d: tong hop theo tung phuong
--   dien (diem trung binh, so luot, min/max) — KHONG co user_id, answers
--   hay bat ky dinh danh nao — de admin/instructor doc tong hop ma
--   khong lo PII cua hoc vien khac. View dung security_invoker de ton
--   trong RLS cua bang goc (chi dem nhung dong nguoi doc duoc phep thay;
--   admin thay toan bo, hoc vien chi thay dong cua minh).
--   Diem so CHI de tu nhan dien huong phat trien, KHONG dung de dinh
--   gia nhan pham; day KHONG phai chan doan tam ly hay danh gia lam
--   sang da duoc chuan hoa (disclaimer hien tren trang ket qua).
-- ============================================================================

create table if not exists public.assessments_11d (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  overall_score numeric(4, 2),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_11d_answers_is_object
    check (jsonb_typeof(answers) = 'object'),
  constraint assessments_11d_scores_is_object
    check (jsonb_typeof(scores) = 'object'),
  constraint assessments_11d_overall_range
    check (overall_score is null or (overall_score >= 1 and overall_score <= 5))
);

create index if not exists idx_assessments_11d_user_completed
  on public.assessments_11d (user_id, completed_at desc);
create index if not exists idx_assessments_11d_completed
  on public.assessments_11d (completed_at desc);

-- Trigger cap nhat updated_at (ham co san tu 0001).
drop trigger if exists trg_assessments_11d_updated_at on public.assessments_11d;
create trigger trg_assessments_11d_updated_at
  before update on public.assessments_11d
  for each row execute function public.set_updated_at();

alter table public.assessments_11d enable row level security;

-- Hoc vien chi doc/ghi ket qua cua chinh minh.
drop policy if exists "assessments_11d_select_own" on public.assessments_11d;
create policy "assessments_11d_select_own" on public.assessments_11d
  for select using (user_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "assessments_11d_insert_own" on public.assessments_11d;
create policy "assessments_11d_insert_own" on public.assessments_11d
  for insert with check (user_id = auth.uid());

drop policy if exists "assessments_11d_update_own" on public.assessments_11d;
create policy "assessments_11d_update_own" on public.assessments_11d
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "assessments_11d_delete_own" on public.assessments_11d;
create policy "assessments_11d_delete_own" on public.assessments_11d
  for delete using (user_id = auth.uid() or public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- View tong hop (khong PII): diem trung binh / so luot / min / max theo
-- tung phuong dien. Khong co user_id, khong co answers. Admin thay toan
-- bo; instructor/hoc vien chi thay phan tong hop tu nhung dong minh
-- duoc phep doc (security_invoker).
-- ---------------------------------------------------------------------------
create or replace view public.assessment_aggregates_11d
with (security_invoker = true) as
select
  kv.key as dimension,
  round(avg((kv.value)::numeric), 2) as avg_score,
  count(*) as responses,
  min((kv.value)::numeric) as min_score,
  max((kv.value)::numeric) as max_score
from public.assessments_11d a
cross join lateral jsonb_each_text(a.scores) as kv(key, value)
where jsonb_typeof(a.scores) = 'object'
group by kv.key;

-- View khong can RLS rieng (Postgres 17: view security_invoker ton
-- trong RLS bang goc); chi cap quyen doc cho authenticated.
grant select on public.assessment_aggregates_11d to authenticated;
revoke select on public.assessment_aggregates_11d from anon;
