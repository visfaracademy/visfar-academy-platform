# Visfar Academy — Nền tảng E-learning

**Module 1: Foundation — Next.js (App Router) + TypeScript + Supabase (PostgreSQL, Auth, RLS) + Cloudflare Pages.**

Tài liệu kiến trúc thống nhất:
[`workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md`](../your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md)
(đọc lại trước khi sửa code — đặc biệt §1, §2, §3, §5, §6, §12).

## Module 1 gồm những gì — và KHÔNG gồm những gì

| Có trong Module 1 | Chưa có (Module 2+) |
|---|---|
| Scaffold Next.js App Router + TypeScript, adapter Cloudflare Pages (`@cloudflare/next-on-pages`) | Workers API (leads, enrollments, progress, quiz, orders, webhooks) |
| Supabase migrations 0001–0003: đủ 19 bảng §3, index §3.3, RLS §6, trigger tạo `profiles`, seed 10 khóa + 4 chính sách (tóm tắt) | Auth UI (đăng nhập/đăng ký), khu vực học viên, admin |
| Frontend đọc thật từ Supabase: trang chủ (có `<h1>` thật), `/chuong-trinh` (tìm kiếm/lọc), `/chuong-trinh/[slug]`, `GET /api/health` (báo thật) | Form lead, đơn hàng, thanh toán, email (Resend chưa dùng ở module này) |
| Validation dùng chung (SĐT/email/tỉnh/tham chiếu), Vitest, script kiểm tra migration offline, CI GitHub | Test RLS trên Supabase thật (xem `tests/rls-manual.md` — **chưa chạy**) |

**Không phá vỡ trang artifact Visfar Academy hiện tại.** Repo này là nền tảng mới,
độc lập; không copy file HTML 5,5 MB cũ vào repo, không sửa artifact đó.

## Cấu trúc

```
visfar-academy-platform/
├── apps/web/                  # Next.js app (App Router)
│   ├── src/app/               # /, /chuong-trinh, /chuong-trinh/[slug], /api/health
│   ├── src/components/        # Header, Footer, CourseCard
│   ├── src/lib/               # supabase (anon only), validation, courses
│   ├── src/styles/globals.css # Design tokens §1.4
│   ├── .env.example           # CHI anon key — KHONG service-role key
│   └── wrangler.toml          # Cloudflare Pages
├── packages/shared/           # constants (34 tỉnh, trụ cột) + types
├── supabase/migrations/       # 0001 schema+RLS, 0002 seed 10 khóa, 0003 seed chính sách
├── workers/api/               # GIU CHO — Module 2+ (xem README trong đó)
├── docs/RUNBOOK.md            # Vận hành, backup, phục hồi
├── scripts/check-migrations.mjs
├── tests/rls-manual.md        # Test RLS bang tay — CHUA CHAY
└── .github/workflows/ci.yml
```

## Bắt đầu (cần user làm — xem “Cần user làm tiếp” cuối file)

### 1. Tạo Supabase project miễn phí

1. Vào https://supabase.com/dashboard → New project (Free).
2. Ghi lại **Project URL** và **anon public key** (Settings → API).
   **Chỉ dùng anon key ở frontend. Service-role key KHÔNG BAO GIỜ đưa vào repo này.**
3. Chạy migration theo thứ tự trong Supabase Dashboard → SQL Editor
   (dán từng file, Run), hoặc bằng Supabase CLI:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
4. Kiểm tra: bảng `courses` có 10 dòng, `policies` có 4 dòng.

### 2. Chạy local

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # dien URL + anon key that
npm run dev                                     # http://localhost:3000
```

### 3. Kiểm thử

```bash
npm run check:migrations   # kiem tra migration offline (regex, khong can Supabase)
npm run test:ci            # Vitest
npm run typecheck          # tsc --noEmit
npm run lint
npm run build              # next build
npm run pages:build        # build kieu Cloudflare Pages (@cloudflare/next-on-pages)
```

### 4. Deploy Cloudflare Pages (sau khi có repo GitHub)

1. Push repo lên GitHub (branch `main`, bật branch protection).
2. Cloudflare Dashboard → Pages → Create → Connect to Git → chọn repo.
3. Build command: `npm run pages:build`; Output: `.vercel/output/static`
   (theo `@cloudflare/next-on-pages`).
4. Environment variables trên Cloudflare: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chỉ anon key).

## Giới hạn miễn phí — đọc kỹ trước khi vận hành (§12 kiến trúc)

| Dịch vụ | Giới hạn miễn phí | Điểm chạm đầu tiên |
|---|---|---|
| Supabase Free | DB 500 MB; Storage 1 GB; băng thông ~5 GB egress/tháng; Auth 50.000 MAU; **tạm dừng sau 7 ngày không hoạt động**; không backup tự động | Tạm dừng sau 7 ngày ít traffic; DB 500 MB |
| Cloudflare Pages Free | 500 build/tháng; static request/băng thông không giới hạn | Khó chạm |
| Cloudflare Workers Free | 100.000 request/ngày; CPU 10ms/request | Module 1 chưa dùng Workers nên chưa chạm |
| Resend | **Chưa dùng ở Module 1** | — |

**Backup:** Supabase Free không backup tự động. Xem `docs/RUNBOOK.md` — dump
`pg_dump` hàng ngày qua GitHub Actions, restore thử lên staging mỗi tháng 1 lần.
Backup chưa từng restore thử thì coi như chưa có backup.

## Quy tắc bắt buộc (áp cho mọi module sau)

1. Không thay đổi schema đã thống nhất — chỉ thêm migration mới.
2. Không đưa secret/API key vào frontend; secret chỉ trong Cloudflare Workers
   Secrets / GitHub Secrets.
3. Không dùng localStorage cho dữ liệu quan trọng.
4. Mọi chức năng kết nối dữ liệu thật; mọi thao tác có loading/success/error;
   mất mạng phải hiện lỗi + nút thử lại, không hiện dữ liệu giả.
5. Không chuyển module tiếp theo nếu module hiện tại chưa đạt nghiệm thu.

## Cần user làm tiếp (trước khi nghiệm thu Module 1)

1. **Tạo Supabase project miễn phí** và gửi lại Project URL + anon key
   (hoặc tự điền vào `apps/web/.env.local` — không gửi service-role key).
2. **Chạy 3 migration** theo thứ tự 0001 → 0002 → 0003, xác nhận `courses` có
   10 dòng và `policies` có 4 dòng.
3. **Chạy test RLS bằng tay** theo `tests/rls-manual.md` (16 kịch bản, cần
   3 tài khoản test) và ghi kết quả vào file đó.
4. **Kiểm tra trang `/chuong-trinh`** trên local: thấy đủ 10 khóa theo đúng
   thứ tự 01–10, tìm kiếm/lọc hoạt động, tắt mạng thì thấy thông báo lỗi +
   nút thử lại (không thấy dữ liệu giả).
5. **Kiểm tra `/api/health`**: chưa cấu hình → 503 `not_configured`; đã cấu
   hình + Supabase chạy → 200 `ok`.
6. Quyết định còn mở (không chặn Module 1, ghi lại để Module 2+ xử lý):
   `lessons.slug` UNIQUE theo khóa hay module (§3.4); khung hoàn trả 3/7/15
   ngày (chưa duyệt); nội dung thật cho 3 khóa 04/05/06.
