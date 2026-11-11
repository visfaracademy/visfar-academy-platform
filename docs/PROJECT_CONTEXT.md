# PROJECT_CONTEXT — Trạng thái hiện tại tổng thể (Prompt 19)

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Repo:** `workspace/visfar-academy-platform` (monorepo npm workspaces).
- **Live:** Web <https://visfaracademy.pages.dev> · Worker API <https://api.visfaracademy.workers.dev>.
- **Nguyên tắc của file này:** bản đồ tổng thể + link tới doc chi tiết. Mọi khẳng định đều đối chiếu code/migration/doc thật; chỗ nào chưa làm ghi rõ **"chưa có / chưa kiểm chứng"**, không bịa. Không chứa secret/key/token nào (chỉ tên biến).

## 1. Stack đã chốt

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 15.4.11 + React 19, App Router, TypeScript | Deploy Cloudflare Pages, project `visfaracademy`, build qua `@cloudflare/next-on-pages`, `runtime = 'edge'` |
| Backend/API | Cloudflare Worker `api` (router tay, không dùng framework router) | Tiền tố `/api/v1`; xem `docs/API_DOCUMENTATION.md` |
| Database/Auth/Storage | Supabase Postgres 17 | Prod ref `ugynqjqyfynkmqutoarp` (ap-south-1); staging `scskhplczrxlnxzruweu` (ap-southeast-2) |
| Email | Resend, trạng thái **"Dùng tạm"** | Chỉ gửi qua `onboarding@resend.dev` cho admin; chưa có domain riêng, chưa xác minh SPF/DKIM/DMARC; chưa gửi được email thật cho học viên |
| Thanh toán | SePay gói FREE (50 GD tiền vào/tháng) + MB Bank của Công ty TNHH MTV Visfar Holdings | Webhook đã nối route nhưng **chưa từng chạy end-to-end thật**; xem §4 |
| Video | YouTube unlisted | Đã chấp nhận đánh đổi: ai có link đều xem được (QĐ 16) |
| Lead | Worker API làm lớp trước → ghi DB (nguồn sự thật) → ghi Google Sheet (bản sao đối soát) qua Apps Script | Fallback Apps Script cũ còn giữ theo QĐ 3 |
| Nhận diện | Đen than + vàng gold + nền ivory champagne; 3 trụ cột khóa học **Thân – Tâm – Tuệ** (migration 0024) | 10 khóa học; Thư viện Master 119 mục |

Quyết định đã chốt đầy đủ: `docs/DECISIONS.md` (QĐ 1–23). Kiểm toán tổng thể: `docs/PROJECT_AUDIT.md` (11/11/2026 + bổ sung GĐ2).

## 2. Module — đã xong / dở / chưa

| Module | Trạng thái 11/11/2026 | Bằng chứng / doc |
|---|---|---|
| Nền tảng (Next.js + Supabase schema/RLS/seed) | ✅ Xong | Commit `54b6321`; 10 khóa published; test web 694/694, Workers 345/345 (sau GĐ2) |
| Frontend + form lead | ✅ Xong code; kiểm chứng live một phần | C-05-02 chống trùng Idempotency-Key **ĐẠT live** 11/11/2026 (201 → 200 `duplicate:true` → 409) |
| Auth + Dashboard + bảo mật H1–H4 | ✅ Xong | H1–H4 đã vá (0009) + kiểm chứng live bị chặn |
| LMS lõi (bài, tiến độ, guard) | ✅ Xong, còn sót nhỏ | S-06: đường ghi tiến độ trực tiếp trong `learning.ts` còn sót (fail-closed, nhận 42501 live) |
| Quiz + Assignment + Certificate | ✅ Xong | Chấm server qua RPC `submit_quiz_attempt`; mã chứng chỉ `VISFAR-CERT-YYYY-NNNNNN`; tra cứu công khai qua RPC |
| Admin + CRM + vô hiệu hóa user | ✅ Xong code | 11 trang `/admin/*`; S-01 đã vá bằng 0021/0022 (trigger chặn tự sửa `is_disabled`) + middleware chặn tài khoản disabled |
| Commerce + Payment SePay | ⚠️ **Dở — chưa chạy thật** | Code + test đủ; chưa có đơn thật, chưa test POST webhook live, chưa đối soát tiền vào |
| Đánh giá 11D (Prompt 11) | ✅ Code + staging; **chưa áp prod** | Migration 0027 đã áp staging; trang `/danh-gia-11d` live 200; nút "Lưu kết quả" trên prod sẽ lỗi cho tới khi 0027 lên prod |
| AI Mentor (Prompt 12) | ✅ Code + staging; **chưa áp prod** | Migration 0029 đã áp staging; **chế độ tìm kiếm thông minh, không LLM** (chưa có key AI nào được cấp); route live trên prod hiện 502 vì prod chưa có bảng |
| Cộng đồng (Prompt 13) | ✅ Code + staging; **chưa áp prod** | Migration 0030 đã áp staging; `/cong-dong` live 200 |
| Gamification (Prompt 14) | ✅ Code + staging; **chưa áp prod** | Migration 0031 đã áp staging; `/hoc-vien/thanh-tich` live (guard 307 khi chưa đăng nhập) |
| SEO/CRO | ⚠️ Dở | Sitemap (25 URL) + robots đã live 200 (GĐ2); analytics tỷ lệ chuyển đổi chưa có; LCP chưa từng đo |
| Hiệu năng | ⚠️ Dở | Bundle tốt; LCP/Lighthouse **chưa từng đo** |
| QA E2E | ❌ Chưa có | Unit 694 + 345 PASS; chưa có E2E live toàn luồng bằng tài khoản thật |
| Tài liệu (Prompt 19) | ✅ File này + 9 file cùng đợt | Xem §5 |

**Trạng thái migration lên prod (11/11/2026):** prod đã áp tới **0024** (0022/0023/0024 đã xác minh). **Chưa áp prod: 0025, 0026, 0027, 0028, 0029, 0030, 0031** — tất cả đã áp staging (HTTP 201) và chờ user nghiệm thu staging. Hệ quả: Thư viện Master trên prod chạy bằng dữ liệu mặc định trong code (đủ 119 mục); S-03 trên prod vẫn mở về mặt policy (nhưng `content` seed prod đang rỗng nên chưa rò nội dung thật); AI Mentor / Cộng đồng / Gamification / 11D-lưu-kết-quả chưa chạy thật trên prod.

## 3. Bảo mật — trạng thái nhanh (chi tiết: `docs/SECURITY_GUIDE.md`)

- **Đã vá GĐ2:** S-03 (migration 0028, staging; policy `lessons_select_enrolled` + view `lessons_preview_video`), S-04 (CSP + HSTS + `X-Frame-Options: SAMEORIGIN`, đã đo header thật trên prod), S-09/`check-migrations` (đếm động, 271/271 PASS).
- **Còn mở, theo `docs/release/SECURITY_REPORT.md` (S-01→S-18):** S-05 middleware chỉ đọc `exp` JWT, không verify chữ ký (bù bằng `auth.getUser()`/JWKS ở mọi route thật — lớp phòng thủ yếu, không phải lỗ rò trực tiếp); S-07 anon INSERT `event_registrations`; S-15 Turnstile fail-open (theo QĐ đã chốt); S-12 chống scrub video có kẽ hở ở request đầu tiên; S-13 `contentType` avatar lấy từ client; S-08/S-16/S-17 (mâu thuẫn policy `payments`, thiếu `WITH CHECK`, `current_role()` đọc cache).
- **Chưa kiểm chứng lại trong đợt này:** kiểm thử 2 tài khoản live (A đọc dữ liệu B, vượt quyền) — lần gần nhất là BACKEND_TEST_REPORT §5E + Task 08.

## 4. Ba chặn lớn trước khi mở bán thật (theo PROJECT_AUDIT)

1. **S-03 vẫn mở trên prod** (chưa áp 0028 lên prod).
2. **SePay chưa từng chạy end-to-end thật** (chưa đơn thật, chưa test POST webhook live, chưa đối soát tiền vào).
3. **Email thật cho học viên chưa gửi được** (Resend "Dùng tạm").

Thêm: code GĐ2 (11D, AI Mentor, Cộng đồng, Gamification, P0) đã commit local (`f577747` + `dca216d`) nhưng **`git remote -v` trống — chưa có remote GitHub nào được cấu hình**, nên chưa push được; xem `docs/ROADMAP.md`).

## 5. Bản đồ tài liệu (12 tài liệu Prompt 19)

| # | Tài liệu | Vị trí | Trạng thái |
|---|---|---|---|
| 1 | PROJECT_CONTEXT | `docs/PROJECT_CONTEXT.md` | ✅ Mới viết (file này) |
| 2 | ARCHITECTURE | `docs/ARCHITECTURE.md` | ✅ Mới viết (bản đồ + trạng thái hiện tại; chi tiết giữ ở `docs/architecture/`) |
| 3 | DATABASE_SCHEMA | `docs/DATABASE_SCHEMA.md` | ✅ Mới viết (từ migrations 0001–0031); bản thiết kế Task 03 giữ nguyên ở `docs/database/DATABASE_SCHEMA.md` |
| 4 | API_DOCUMENTATION | `docs/API_DOCUMENTATION.md` | ✅ Mới viết (từ code Worker + Next.js thật) |
| 5 | DESIGN_SYSTEM | — | ⚠️ **Không viết trùng.** Không tìm thấy file design system nào trong repo tại thời điểm viết (11/11/2026). Nếu agent song song đã viết, lấy file đó làm chuẩn; tokens hiện tại nằm trong `apps/web/src/styles/globals.css` |
| 6 | SECURITY_GUIDE | `docs/SECURITY_GUIDE.md` | ✅ Mới viết (tổng hợp từ SECURITY_REPORT + các vá GĐ2) |
| 7 | DEPLOYMENT_GUIDE | `docs/DEPLOYMENT_GUIDE.md` | ✅ Mới viết (trạng thái deploy thật 11/11/2026; bản snapshot 10/11 giữ ở `docs/release/DEPLOYMENT_GUIDE.md`) |
| 8 | BACKUP_RECOVERY | `docs/BACKUP_RECOVERY.md` | ✅ Mới viết; **backup chưa từng kiểm chứng chạy thật — ghi rõ trong file** |
| 9 | ADMIN_GUIDE | `docs/ADMIN_GUIDE.md` | ✅ Mới viết (từ code admin thật) |
| 10 | STUDENT_GUIDE | `docs/STUDENT_GUIDE.md` | ✅ Mới viết (từ code thật) |
| 11 | CHANGELOG | `docs/CHANGELOG.md` | ✅ Đã có, đủ mục GĐ2 (11D, AI Mentor, Cộng đồng, Gamification, P0); chỉ bổ sung mục Prompt 19 |
| 12 | ROADMAP | `docs/ROADMAP.md` | ✅ Mới viết (kế hoạch 90 ngày) |

**Tài liệu gốc khác (không thuộc Prompt 19 nhưng cần đọc kèm):** `docs/DECISIONS.md` · `docs/PROJECT_AUDIT.md` · `docs/RUNBOOK.md` · `docs/architecture/` (SYSTEM_ARCHITECTURE, API_ARCHITECTURE, DEPLOYMENT_ARCHITECTURE, SYSTEM_MODULES, USER_FLOWS, ROLE_PERMISSION_MATRIX) · `docs/database/` (DATABASE_SCHEMA thiết kế, DATA_DICTIONARY, RLS_POLICIES, SECURITY_MODEL, DATABASE_ERD) · `docs/release/` (SECURITY_REPORT, TEST_REPORT, PERFORMANCE_REPORT, PRODUCTION_CHECKLIST, ANALYTICS_CHECK) · `docs/payment/SEPAY_INTEGRATION.md` · `docs/frontend/TASK11_11D_REPORT.md`, `TASK12_AI_MENTOR_REPORT.md`, `TASK13_14_REPORT.md` · `workspace/your_files/bao-cao-phan-tich-visfar-academy/Tai-lieu-kien-truc-tong-the-Visfar-Academy.md` (tài liệu kiến trúc tổng thể v1.0).

## 6. Việc còn mở (tóm tắt — chi tiết ở `docs/ROADMAP.md`)

- Áp migrations 0025–0031 lên prod sau khi user nghiệm thu staging (đặc biệt 0028/S-03 trước khi bán khóa có content thật).
- SePay thật: test POST webhook live → 1 đơn thật end-to-end → đối soát bù qua SePay API v2; user đổi URL webhook trong SePay sang URL Worker mới.
- Email domain riêng + xác minh SPF/DKIM/DMARC → set `RESEND_FROM_EMAIL` → gửi thử 1 email thật cho học viên.
- Đo LCP/Lighthouse trên máy thật; E2E live toàn luồng bằng tài khoản thật; GitHub push (code GĐ2 hiện chỉ commit local).
- Turnstile site key + secret thật (hiện fail-open theo QĐ).
