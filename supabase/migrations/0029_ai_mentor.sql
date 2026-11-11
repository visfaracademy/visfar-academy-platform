-- ============================================================================
-- 0029_ai_mentor.sql — AI Mentor & AI Learning Assistant (Prompt 12, GĐ2).
--   Bang public.ai_knowledge_chunks + public.ai_chat_sessions +
--   public.ai_chat_messages + ham public.search_ai_knowledge + RLS.
--   CHUA ap prod trong dot nay; ap STAGING truoc, kiem chung, roi moi
--   len prod (coordinator duyet). Khong sua file cu (0001–0028).
--
--   CHE DO HOAT DONG (11/11/2026): TIM KIEM THONG MINH, KHONG LLM.
--   Worker `api` KHONG co key AI nao (OPENAI_API_KEY / GEMINI_API_KEY
--   deu chua set — da kiem tra bang `wrangler secret list`, chi co 5
--   secret cu). Vi vay route /api/v1/ai-mentor/ask CHI tim kiem trong
--   kho tri thuc duoc phe duyet va tra ve doan tri thuc + trich dan
--   nguon, KHONG goi LLM, KHONG bia cau tra loi. Neu sau nay user cap
--   OPENAI_API_KEY thi Worker moi goi LLM voi system prompt "chi tra
--   loi dua tren doan tri thuc duoc cung cap" (xem handlers/ai-mentor.ts).
--
--   TIM KIEM: Postgres full-text (to_tsvector config 'simple' — khong
--   co tu dien tieng Viet trong Postgres) + khop nguyen tu khong dau
--   (regex \y...\y) + thuong cum tu ke nhau. Chi tiet cham diem +
--   hieu chuan xem ngay tren ham search_ai_knowledge ben duoi.
--   KHONG phai vector embedding: khong dung embedding that, khong
--   dung pgvector. Tim khong dau nho extension `unaccent` (STABLE nen
--   KHONG dung duoc cot generated / expression index — vi vay duy tri
--   2 cot `search_text` (lower + unaccent) va `search_vector` bang
--   trigger truoc insert/update).
--
--   KHO TRI THUC (seed idempotent, chay lai khong trung):
--   - 119 muc Thu vien Master: lay truc tiep tu bang
--     public.master_library_items (seed cua 0025, nguyen van user gui
--     11/11/2026 — xem docs/library/noi-dung-thu-vien-master.md).
--   - 10 khoa hoc: lay tu public.courses (status='published',
--     subtitle + description). 3 khoa 04/05/06 co description tam
--     "NOI DUNG TAM" (0025 ghi ro cho user gui van ban thay) nen chi
--     lay subtitle + cau "Noi dung chi tiet dang duoc cap nhat." —
--     KHONG dua dong chu tam noi bo ra ngoai.
--   - 9 muc triet ly trang chu: chep NGUYEN VAN tu
--     apps/web/src/lib/homepage-data.ts (PHILOSOPHY_CORE,
--     PHILOSOPHY_VIEW, EQUATION_NOTE, GOALS, PRINCIPLES, DESTINATION,
--     MISSION + VISION_LEAD + VISION_BODY, FACETS, ROADMAP_STEPS).
--   Tong: 119 + 10 + 9 = 138 chunk. KHONG index noi dung bai hoc
--   tra phi (bang lessons): cau hoi ve khoa chua ghi danh chi duoc
--   tra loi bang mo ta cong khai + ghi chu "chua ghi danh".
-- ============================================================================

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Kho tri thuc tim kiem duoc
-- ---------------------------------------------------------------------------
create table if not exists public.ai_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null
    check (source_type in ('library', 'course', 'philosophy')),
  source_slug text not null,
  title text not null,
  content text not null,
  keywords text not null default '',
  search_text text not null default '',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_chunks_source_unique
    unique (source_type, source_slug)
);

create index if not exists idx_ai_knowledge_chunks_type
  on public.ai_knowledge_chunks (source_type);
create index if not exists idx_ai_knowledge_chunks_search_vector
  on public.ai_knowledge_chunks using gin (search_vector);
create index if not exists idx_ai_knowledge_chunks_search_text_trgm
  on public.ai_knowledge_chunks using gin (search_text gin_trgm_ops);

-- Trigger cap nhat updated_at (ham co san tu 0001).
drop trigger if exists trg_ai_knowledge_chunks_updated_at on public.ai_knowledge_chunks;
create trigger trg_ai_knowledge_chunks_updated_at
  before update on public.ai_knowledge_chunks
  for each row execute function public.set_updated_at();

-- Trigger duy tri search_text (khong dau, chu thuong) + search_vector.
-- unaccent() la STABLE nen khong dung cot generated duoc.
create or replace function public.ai_knowledge_chunks_refresh_search()
returns trigger
language plpgsql
as $$
begin
  new.search_text := lower(unaccent(
    coalesce(new.title, '') || ' ' ||
    coalesce(new.content, '') || ' ' ||
    coalesce(new.keywords, '')
  ));
  new.search_vector := to_tsvector('simple', new.search_text);
  return new;
end;
$$;

drop trigger if exists trg_ai_knowledge_chunks_search on public.ai_knowledge_chunks;
create trigger trg_ai_knowledge_chunks_search
  before insert or update of title, content, keywords
  on public.ai_knowledge_chunks
  for each row execute function public.ai_knowledge_chunks_refresh_search();

alter table public.ai_knowledge_chunks enable row level security;

-- Tri thuc cong khai: ai cung doc duoc (anon + authenticated).
drop policy if exists "ai_knowledge_chunks_select_public" on public.ai_knowledge_chunks;
create policy "ai_knowledge_chunks_select_public" on public.ai_knowledge_chunks
  for select using (true);

-- ---------------------------------------------------------------------------
-- Ham tim kiem: full-text (khong dau) + ILIKE fallback theo tung tu.
--   Ghi chu hieu nang (11/11/2026, da hieu chuan tren staging):
--   - unaccent() la STABLE nen chi dung duoc trong trigger / ham SQL,
--     khong dung duoc cot generated hay expression index.
--   - Tu dung trong cau hoi bi loai truoc khi cham: ~70 tu chuc nang
--     tieng Viet (la/gi/nhu/the/nao/de/cua/va/khong/mot/cac/...).
--     Tu con lai la "tu noi dung". Neu het tu noi dung -> 0 dong.
--   - rank = diem tieu de (100 * (so tu khoa co trong tieu de /
--     tong tu khoa)^2 — binh phuong de tieu de khop 1 tu don le
--     khong at noi dung khop du tu) + 10 * so tu noi dung khop
--     nguyen tu trong noi dung + so lan xuat hien (toi da 10)
--     + 15 * so cap tu ke nhau khop nguyen cum (toi da 30)
--     + ts_rank_cd * 5 (hoa giai).
--   - Worker loc them: chi giu chunk co title_match, hoac co cap tu
--     khop, hoac khop >= 4 tu noi dung, va rank >= 25 — cau hoi
--     ngoai pham vi (VD "dau tu chung khoan lai 100%") bi loai het
--     va tra loi "chua tim thay" thay vi bia cau tra loi.
-- Tra ve toi da p_limit chunk (mac dinh 5, toi da 10), xep theo rank.
--
drop function if exists public.search_ai_knowledge(text, integer);
create or replace function public.search_ai_knowledge(p_query text, p_limit integer default 5)
returns table (
  chunk_id uuid,
  source_type text,
  source_slug text,
  title text,
  content text,
  keywords text,
  rank real,
  matched_words integer,
  title_match boolean,
  pair_bonus integer
)
language sql
stable
as $$
  with raw as (
    select lower(unaccent(coalesce(p_query, ''))) as plain
  ),
  allw as (
    select array_agg(w) as words
    from (
      select unnest(regexp_split_to_array((select plain from raw), '[^a-z0-9]+')) as w
    ) s
    where w <> '' and (length(w) >= 2 or w ~ '^[0-9]+$')
  ),
  stop as (
    select array[
      'la','gi','nhu','the','nao','de','cua','va','co','khong','mot','cac',
      'trong','voi','cho','thi','ma','ve','tu','nay','do','duoc','sao','ra',
      'bao','nhieu','nhung','moi','da','dang','se','khi','neu','hay','hoac',
      'vi','do','tai','o','den','di','lai','len','xuong','rat','qua','chi',
      'cung','con','het','ca','theo','giua','sau','truoc','tren','duoi',
      'ngoai','bang','hon','nhat','can','phai','muon','nen','roi','vay',
      'ay','kia','ai','cai','toi','ban','minh','ne','nhe','em','anh','ta',
      'nua'
    ] as sw
  ),
  w as (
    select coalesce(
      (select array_agg(x) from unnest((select words from allw)) x
       where not ((select sw from stop) @> array[x])),
      array[]::text[]
    ) as words
  ),
  pairs as (
    select coalesce(array_agg(a || ' ' || b), array[]::text[]) as prs
    from (
      select words[i] as a, words[i+1] as b
      from (select words from w) s,
           generate_series(1, greatest(array_length(words, 1) - 1, 0)) i
    ) p
  ),
  q as (
    select
      (select words from w) as words,
      (select prs from pairs) as prs,
      case
        when coalesce(array_length((select words from w), 1), 0) = 0 then ''::tsquery
        else plainto_tsquery('simple', array_to_string((select words from w), ' '))
      end as tsq
  ),
  scored as (
    select
      c.id, c.source_type, c.source_slug, c.title, c.content, c.keywords,
      (select count(*)::int from unnest(q.words) x
        where c.search_text ~ ('\y' || x || '\y')) as matched,
      (select count(*)::int from unnest(q.words) x
        where lower(unaccent(c.title)) ~ ('\y' || x || '\y')) as title_matched,
      least(
        (select count(*)::int
         from regexp_matches(
           c.search_text,
           '\y(' || array_to_string(q.words, '|') || ')\y', 'g'
         ) m),
        10
      ) as occ,
      least(
        (select count(*)::int from unnest(q.prs) p where c.search_text like '%' || p || '%')
        * 15,
        30
      ) as pb,
      coalesce(ts_rank_cd(c.search_vector, q.tsq), 0) as tsr
    from public.ai_knowledge_chunks c, q
    where coalesce(array_length(q.words, 1), 0) > 0
  )
  select
    id, source_type, source_slug, title, content, keywords,
    (
      -- Diem tieu de theo ty le BINH PHUONG (100 neu du, 25 neu duoc
      -- 1/2 tu): tieu de khop 1 tu don le khong duoc at noi dung khop
      -- du tu khoa ("lam giau" -> "Muc tieu giao duc" phai hon
      -- "Giau Toan Dien"); khoa goi dung ten van vuot muc tong quan.
      (100.0 * title_matched * title_matched
        / (greatest(array_length(q_words_len, 1), 1) * greatest(array_length(q_words_len, 1), 1)))
      + matched * 10 + occ + pb + tsr * 5
    )::real as rank,
    matched, (title_matched = array_length(q_words_len, 1)) as title_match, pb
  from (
    select s.*, (select words from q) as q_words_len
    from scored s
  ) t
  where matched >= 1
  order by rank desc, title asc
  limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;


-- ---------------------------------------------------------------------------
-- Lich su hoi thoai AI Mentor — CHI chu so huu doc (RLS owner-only).
-- Worker ghi qua service-role (bypass RLS) sau khi da xac minh JWT +
-- quyen so huu o handler; khong co duong doc cheo giua cac hoc vien.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Hội thoại mới',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_chat_sessions_user_created
  on public.ai_chat_sessions (user_id, created_at desc);

drop trigger if exists trg_ai_chat_sessions_updated_at on public.ai_chat_sessions;
create trigger trg_ai_chat_sessions_updated_at
  before update on public.ai_chat_sessions
  for each row execute function public.set_updated_at();

alter table public.ai_chat_sessions enable row level security;

drop policy if exists "ai_chat_sessions_select_own" on public.ai_chat_sessions;
create policy "ai_chat_sessions_select_own" on public.ai_chat_sessions
  for select using (user_id = auth.uid());
drop policy if exists "ai_chat_sessions_insert_own" on public.ai_chat_sessions;
create policy "ai_chat_sessions_insert_own" on public.ai_chat_sessions
  for insert with check (user_id = auth.uid());
drop policy if exists "ai_chat_sessions_update_own" on public.ai_chat_sessions;
create policy "ai_chat_sessions_update_own" on public.ai_chat_sessions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "ai_chat_sessions_delete_own" on public.ai_chat_sessions;
create policy "ai_chat_sessions_delete_own" on public.ai_chat_sessions
  for delete using (user_id = auth.uid());

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  helpful boolean,
  created_at timestamptz not null default now(),
  constraint ai_chat_messages_sources_is_array
    check (jsonb_typeof(sources) = 'array')
);

create index if not exists idx_ai_chat_messages_session_created
  on public.ai_chat_messages (session_id, created_at);
create index if not exists idx_ai_chat_messages_user_created
  on public.ai_chat_messages (user_id, created_at desc);

alter table public.ai_chat_messages enable row level security;

drop policy if exists "ai_chat_messages_select_own" on public.ai_chat_messages;
create policy "ai_chat_messages_select_own" on public.ai_chat_messages
  for select using (user_id = auth.uid());
drop policy if exists "ai_chat_messages_insert_own" on public.ai_chat_messages;
create policy "ai_chat_messages_insert_own" on public.ai_chat_messages
  for insert with check (user_id = auth.uid());
drop policy if exists "ai_chat_messages_update_own" on public.ai_chat_messages;
create policy "ai_chat_messages_update_own" on public.ai_chat_messages
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "ai_chat_messages_delete_own" on public.ai_chat_messages;
create policy "ai_chat_messages_delete_own" on public.ai_chat_messages
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed kho tri thuc (idempotent — chay lai UPDATE theo
-- (source_type, source_slug), khong tao trung).
-- ---------------------------------------------------------------------------

-- 1) 119 muc Thu vien Master (nguyen van tu master_library_items).
insert into public.ai_knowledge_chunks (source_type, source_slug, title, content, keywords)
select 'library', slug, title, content, coalesce(category, '') || ' ' || title
from public.master_library_items
where coalesce(is_published, false) = true
on conflict (source_type, source_slug) do update set
  title = excluded.title,
  content = excluded.content,
  keywords = excluded.keywords,
  updated_at = now();

-- 2) 10 khoa hoc cong khai (subtitle + description; 3 khoa co
-- description tam "NOI DUNG TAM" thi chi lay subtitle + cau bao
-- "dang duoc cap nhat", khong dua chu tam noi bo ra ngoai).
insert into public.ai_knowledge_chunks (source_type, source_slug, title, content, keywords)
select
  'course',
  slug,
  title,
  coalesce(subtitle, title) || '. ' ||
    case
      when description ilike 'NOI DUNG TAM%' then 'Nội dung chi tiết đang được cập nhật.'
      else coalesce(description, '')
    end,
  title || ' ' || slug || ' ' || coalesce(pillar, '')
from public.courses
where status = 'published'
on conflict (source_type, source_slug) do update set
  title = excluded.title,
  content = excluded.content,
  keywords = excluded.keywords,
  updated_at = now();

-- 3) 9 muc triet ly trang chu — NGUYEN VAN tu
-- apps/web/src/lib/homepage-data.ts (da chot, khong viet lai).
insert into public.ai_knowledge_chunks (source_type, source_slug, title, content, keywords)
values
  ('philosophy', 'triet-ly-giao-duc-tan-goc', 'Triết lý Giáo dục Tận Gốc',
   'Giáo dục Tận Gốc là triết lý giáo dục lấy con người làm trung tâm, lấy sự phát triển toàn diện và viên mãn của con người làm mục tiêu. Giáo dục không chỉ dừng lại ở truyền thụ kiến thức hay đào tạo kỹ năng, mà phải khai mở nhận thức, phát triển trí tuệ, nuôi dưỡng tâm hồn, hoàn thiện nhân cách và phát huy tiềm năng của mỗi con người. VISFAR hướng đến một nền giáo dục giúp con người hiểu mình, thấu hiểu cuộc sống, làm chủ bản thân, phát triển năng lực và kiến tạo những giá trị tốt đẹp, bền vững cho gia đình, xã hội và nhân loại.',
   'triết lý giáo dục tận gốc visfar con người làm trung tâm'),
  ('philosophy', 'quan-niem-giao-duc', 'Quan niệm giáo dục',
   'VISFAR quan niệm rằng, giáo dục chân chính phải bắt đầu từ gốc rễ con người, hướng đến sự phát triển hài hòa trên cả phương diện nội tâm và đời sống bên ngoài. Mỗi người cần được khai mở khả năng tự nhận thức, hình thành tư duy độc lập, nuôi dưỡng tinh thần học tập suốt đời, biết tôn trọng sự khác biệt, sống hài hòa với tự nhiên và có trách nhiệm với cộng đồng. Biết để hiểu – Hiểu để chuyển hóa – Chuyển hóa để trưởng thành – Trưởng thành để cống hiến.',
   'quan niệm giáo dục chân chính gốc rễ con người biết hiểu chuyển hóa'),
  ('philosophy', 'nhan-tot-duyen-lanh-qua-nhu-y', 'Nhân tốt + Duyên lành = Quả như ý',
   'Nhân tốt: khái niệm có lợi, hình hướng tốt, lòng cân bằng. Duyên lành từ con người. Quả như ý: thông tin, trạng thái, kết quả vật chất cùng đổi.',
   'nhân duyên quả nhân tốt duyên lành quả như ý'),
  ('philosophy', 'muc-tieu-giao-duc', 'Mục tiêu giáo dục',
   'LÀM GIÀU: Giàu tâm thức, tâm thái, tâm đạo, trí tuệ, nghị lực, thể chất, tinh thần, phẩm chất, nhân cách, năng lực, vật chất. LÀM CHỦ: Làm chủ nội tâm, sức khỏe, mối quan hệ, tài chính, và tiến tới nâng cao cảnh giới cuộc sống, để lại giá trị & di sản cho nhân sinh và xã hội. TRỞ NÊN: Khôn ngoan, thông thái, uyên bác và trí tuệ hơn. TRỞ THÀNH: Người trưởng thành, tiến tới con người tinh hoa, kiến tạo trở thành người giàu toàn diện, lan tỏa giá trị và sứ mệnh của mình.',
   'mục tiêu giáo dục làm giàu làm chủ trở nên trở thành'),
  ('philosophy', 'nguyen-tac-giao-duc', 'Nguyên tắc giáo dục',
   'Lấy con người làm trung tâm, lấy sự phát triển toàn diện làm mục tiêu. Tôn trọng sự khác biệt, khuyến khích tư duy độc lập và tinh thần khai phóng. Kết hợp tri thức với thực hành, nhận thức với hành động. Đề cao đạo đức, trách nhiệm và sự hài hòa giữa cá nhân, xã hội và tự nhiên. Khuyến khích học tập suốt đời, tự giáo dục và tự hoàn thiện. Kế thừa tinh hoa minh triết nhân loại, văn hóa dân tộc và vận dụng thành tựu khoa học hiện đại.',
   'nguyên tắc giáo dục con người làm trung tâm học tập suốt đời'),
  ('philosophy', 'dich-den-giao-duc', 'Đích đến giáo dục',
   'Giáo dục không nhằm tạo ra những con người giống nhau, mà giúp mỗi người nhận ra giá trị riêng, phát huy tiềm năng và sống một cuộc đời có ý nghĩa. Một con người phát triển toàn diện không chỉ có tri thức mà còn có trí tuệ; không chỉ có năng lực mà còn có phẩm chất; không chỉ làm chủ bản thân mà còn biết tạo dựng giá trị và đóng góp cho cộng đồng. Đó là hành trình hướng đến sự viên mãn của con người trên 11 phương diện – cũng chính là tinh thần của Giáo dục Tận Gốc VISFAR.',
   'đích đến giáo dục viên mãn 11 phương diện giá trị riêng tiềm năng'),
  ('philosophy', 'su-menh-tam-nhin', 'Sứ mệnh & Tầm nhìn',
   'VISFAR mang sứ mệnh nghiên cứu, phát triển và lan tỏa tri thức giáo dục Tận Gốc; đồng hành cùng mỗi cá nhân và tổ chức trên hành trình khai mở nhận thức, phát triển trí tuệ, nuôi dưỡng đạo đức, hoàn thiện nhân cách và nâng cao năng lực, hướng tới sự phát triển toàn diện của con người và xã hội. Trở thành hệ sinh thái giáo dục và phát triển con người có tầm vóc quốc tế, góp phần đưa tri thức và giá trị giáo dục Việt Nam vươn ra toàn cầu. VISFAR hướng tới xây dựng một hệ sinh thái giáo dục mở, kết hợp tinh hoa minh triết nhân loại, tri thức khoa học, giá trị văn hóa Việt Nam và sức mạnh công nghệ; kiến tạo những thế hệ con người có trí tuệ, phẩm chất, bản lĩnh và năng lực, cùng đóng góp cho một tương lai thịnh vượng, nhân văn và bền vững.',
   'sứ mệnh tầm nhìn visfar hệ sinh thái giáo dục quốc tế'),
  ('philosophy', 'thap-nhat-vien-man', 'Thập Nhất Viên Mãn — 11 phương diện',
   '01 TÂM THỨC: Khai mở khả năng tự nhận biết, thấu hiểu bản thân và nhận diện thế giới nội tâm. 02 TÂM THÁI: Nuôi dưỡng thái độ sống tích cực, bình an, trân trọng, biết ơn và bao dung. 03 TÂM ĐẠO: Xây dựng hệ giá trị, nguyên tắc và con đường sống đúng đắn, có ý nghĩa. 04 TRÍ TUỆ: Phát triển hiểu biết, tư duy độc lập, năng lực phân tích, phản biện và sáng tạo. 05 NGHỊ LỰC: Tôi luyện bản lĩnh, lòng dũng cảm, sự kiên trì và khả năng vượt qua nghịch cảnh. 06 THỂ CHẤT: Rèn luyện sức khỏe, thể lực và khả năng duy trì trạng thái sống khỏe mạnh, bền bỉ. 07 TINH THẦN: Bồi dưỡng đời sống nội tâm, niềm tin, ý nghĩa sống và sự an nhiên. 08 PHẨM CHẤT: Vun đắp đạo đức, lòng nhân ái, sự chính trực, trách nhiệm và những giá trị tốt đẹp. 09 NHÂN CÁCH: Hoàn thiện con người thông qua sự thống nhất giữa nhận thức, tư tưởng, lời nói và hành động. 10 NĂNG LỰC: Nâng cao khả năng vận dụng tri thức, kỹ năng và kinh nghiệm để giải quyết vấn đề, tạo ra giá trị. 11 VẬT CHẤT: Kiến tạo nền tảng kinh tế, tài chính và điều kiện vật chất ổn định, tự chủ, thịnh vượng.',
   'thập nhất viên mãn 11 phương diện tâm thức tâm thái tâm đạo trí tuệ nghị lực thể chất tinh thần phẩm chất nhân cách năng lực vật chất'),
  ('philosophy', 'lo-trinh-6-buoc', 'Lộ trình 6 bước',
   '1 Biết — Xác lập khái niệm: Bộ khởi đầu: niềm tin, khái niệm đầu tiên. 2 Tin — Tin vào khái niệm: Tin vào khái niệm đã biết; niềm tin vững là điểm tựa để hiểu sâu hơn. 3 Hiểu — Rõ hình trong đầu: Rõ hình, rõ khái niệm; nhìn rõ bản chất trong toàn cảnh rộng. 4 Thấu suốt — Đặt câu hỏi đúng: Hỏi đúng; soi lại khái niệm, hình, trạng thái bằng tam giác hiện thực. 5 Chuyển hóa — Mong muốn đủ lớn: Muốn đủ, đổi tư duy, hành vi theo nhận thức mới. 6 Huân tập và quảng bá: Ở lại cộng đồng Visfar, luyện đều cho rõ hình, rõ khái niệm.',
   'lộ trình 6 bước biết tin hiểu thấu suốt chuyển hóa huân tập quảng bá')
on conflict (source_type, source_slug) do update set
  title = excluded.title,
  content = excluded.content,
  keywords = excluded.keywords,
  updated_at = now();
