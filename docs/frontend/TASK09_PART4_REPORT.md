# Báo cáo Task 09 — phần 4/4: CRM + Audit Log

**Dự án:** Visfar Academy — `apps/web` (Next.js + Supabase)
**Ngày:** 10/11/2026
**Phạm vi:** Trang `/admin/crm` (lead + phân loại CRM + hồ sơ + lịch sử tương tác),
trang `/admin/audit-logs`, rà soát audit cho mọi thao tác quản trị quan trọng,
bổ sung phần còn thiếu (hoàn trả đơn hàng). Không sửa migration cũ, không
chạy migration/DB thật, không bịa dữ liệu.

Tài liệu đã đọc trước khi làm: `docs/DECISIONS.md` (lead API làm lớp trước
rồi ghi Sheet; trạng thái lead new/contacted/enrolled/closed/spam; hoàn trả
15 ngày làm việc / khiếu nại phản hồi 3 ngày), `docs/frontend/TASK05_REPORT.md`
(đã có `leads.ts`, form tư vấn, bảng `leads`), code hiện tại trong
`apps/web/src/lib/` và `apps/web/src/app/admin/`.

---

## 1. File tạo mới

| File | Vai trò |
|---|---|
| `apps/web/src/lib/crm.ts` | Lib CRM + audit-log: `classifyLead()` (8 nhóm), `fetchCrmLeads()`, `fetchLeadDetail()`, `updateLeadStatus()`, `addLeadInteraction()`, `validateInteractionInput()`, `fetchAuditLogs()`, `auditActionLabel()` |
| `apps/web/src/lib/crm.test.ts` | 23 test (mock Supabase client, fake ghi thật vào store trong bộ nhớ) |
| `apps/web/src/lib/lms-admin-audit.test.ts` | 3 test cho `refundOrder()` |
| `apps/web/src/app/admin/crm/page.tsx` | Danh sách lead: tìm kiếm (tên/SĐT/email/mã), lọc trạng thái + phân loại CRM |
| `apps/web/src/app/admin/crm/[leadId]/page.tsx` | Hồ sơ lead: thông tin + phân loại + đổi trạng thái + lịch sử tương tác + ghi danh/đơn hàng + audit liên quan |
| `apps/web/src/app/admin/audit-logs/page.tsx` | Danh sách audit_logs: lọc theo action / actor / từ khóa |
| `apps/web/src/components/admin/LeadStatusForm.tsx` | Form client đổi trạng thái lead |
| `apps/web/src/components/admin/LeadInteractionForm.tsx` | Form client ghi tương tác mới |
| `apps/web/src/app/api/admin/leads/[leadId]/status/route.ts` | PATCH đổi trạng thái lead (admin) |
| `apps/web/src/app/api/admin/leads/[leadId]/interactions/route.ts` | POST ghi tương tác (admin) |
| `supabase/migrations/0020_lead_interactions.sql` | **CHỈ VIẾT FILE, CHƯA CHẠY** — bảng `lead_interactions` + policy `orders_admin_update` (xem §4) |
| `docs/frontend/TASK09_PART4_REPORT.md` | Báo cáo này |

## 2. File sửa

| File | Thay đổi |
|---|---|
| `apps/web/src/lib/lms-admin.ts` | Thêm action audit `'lead.status'`, `'lead.interaction'`, `'order.refund'`; thêm `refundOrder()` (xem §3) |
| `apps/web/src/app/admin/layout.tsx` | Thêm link nav CRM + Nhật ký quản trị (vẫn qua `requireAdmin()` server) |
| `apps/web/src/styles/globals.css` | Thêm `.field textarea` vào rule `.field input/select` sẵn có (cùng token, không đổi màu/font) |

## 3. Chức năng

### 3.1. CRM — `/admin/crm`
- Dữ liệu thật từ Supabase (`leads` + `profiles`/`enrollments`/`orders` để suy ra
  phân loại). Chưa có lead → empty state, không bịa.
- Tìm kiếm theo tên / SĐT / email / mã tham chiếu; lọc theo trạng thái gốc
  (`new/contacted/enrolled/closed/spam`).
- Phân loại CRM 8 nhóm, suy ra bằng `classifyLead()` (logic thuần, đã test):
  lead mới / đã tư vấn / đã đăng ký / đã mua / đang học / hoàn thành /
  không hoạt động / khách hàng quay lại. Thứ tự ưu tiên: quay lại (≥ 2 đơn
  đã trả hoặc ≥ 2 ghi danh) > hoàn thành > đang học > đã mua > đã đăng ký
  (status) > đã tư vấn (status) > không hoạt động (closed/spam, hoặc tạo
  hơn 30 ngày mà không có tương tác trong 30 ngày) > lead mới.
- Giới hạn đọc: tối đa 200 lead mới nhất rồi phân loại trong bộ nhớ (ghi rõ
  trên trang khi chạm giới hạn — phân loại cần đơn/ghi danh nên không lọc
  được bằng 1 query SQL đơn giản).

### 3.2. Hồ sơ lead — `/admin/crm/[leadId]`
- Thông tin lead, phân loại CRM, tài khoản học viên khớp theo email rồi SĐT
  (nếu có), ghi danh + đơn hàng thật của người đó.
- Đổi trạng thái lead (PATCH, có ghi chú) → ghi audit `lead.status`
  (trạng thái cũ/mới).
- Lịch sử tương tác: mỗi mục ghi ai (`actor_id`), khi nào, kênh
  (điện thoại/Zalo/email/gặp trực tiếp/khác), nội dung, kết quả
  (không nghe máy/quan tâm/không quan tâm/đã ghi danh/cần theo dõi).
  Ghi mới → lưu `lead_interactions` + audit `lead.interaction`.
- Nếu bảng `lead_interactions` chưa có (0020 chưa chạy): mục tương tác hiện
  cảnh báo rõ ràng, form ghi mới trả lỗi rõ — không giả vờ đã lưu.

### 3.3. Nhật ký quản trị — `/admin/audit-logs`
- Đọc thật `audit_logs` (mới nhất trước, 50 mục/trang), kèm tên người thực
  hiện (join `profiles`). Lọc theo hành động / ID người thực hiện / từ khóa
  (hành động, đối tượng). Chưa có log → empty state.

### 3.4. Rà soát audit — kết quả
Đã có audit từ trước (không thêm trùng):

| Thao tác | Audit đã có | Ở đâu |
|---|---|---|
| Tặng / thu hồi khóa | `enrollment.grant` / `enrollment.revoke` | `lms-admin.ts` |
| Đổi vai trò | `user.role.change` | `admin-users.ts` (phần khác của Task 09) |
| Vô hiệu / mở tài khoản | `user.disable` / `user.enable` | `admin-users.ts` |
| Phân công / gỡ giảng viên | `instructor.assign` / `instructor.revoke` | `lms-admin.ts` |
| Tạo / sửa khóa (kể cả xuất bản / ẩn — đổi `status`) | `course.create` / `course.update` | route `/api/admin/courses/*` |
| Tạo / sửa chương, bài, tài liệu; sắp xếp | `module.*` / `lesson.*` / `resource.*` / `content.reorder` | route admin + `lms-admin.ts` |
| Chấm bài | `submission.grade` | route `/api/v1/assignments/.../reviews` |
| Cấp / thu hồi chứng chỉ | `certificate.issue` / `certificate.revoke` | `certificates.ts` |

**Mới bổ sung trong phần này:**
- Hoàn trả đơn hàng — `refundOrder()` trong `lms-admin.ts`: chỉ đơn `paid`
  mới hoàn trả được (`pending` → hủy đơn là việc khác; `refunded` không làm
  lại), lý do bắt buộc ≤ 500 ký tự, ghi audit `order.refund` (số tiền,
  trạng thái cũ, lý do, ngày đặt đơn, ghi chú chính sách 15 ngày làm việc
  theo QĐ 9). Không tự tính 15 ngày làm việc (cần lịch nghỉ lễ) — admin
  kiểm tra hạn trước khi bấm; không tự thu hồi enrollment (làm riêng bằng
  `revokeEnrollment()` nếu cần, có audit riêng).
- Đổi trạng thái lead / ghi tương tác — audit `lead.status` /
  `lead.interaction` trong `crm.ts` (xem §3.2).
- Bug bắt được nhờ test: `refundOrder()` ban đầu đọc `row.status` làm
  `previousStatus` sau khi update nên audit ghi nhầm `refunded` thay vì
  `paid` — đã sửa (giữ lại trạng thái cũ trước khi update) và test pass.

## 4. Migration 0020 — VIẾT FILE, CHƯA CHẠY, CẦN COORDINATOR DUYỆT

`supabase/migrations/0020_lead_interactions.sql` (không sửa file cũ):
- (A) Bảng `lead_interactions` (`lead_id` FK cascade, `actor_id`,
  `channel` CHECK, `content` 1–2000 ký tự, `outcome` CHECK, index,
  RLS chỉ admin, trigger `updated_at`).
- (B) Policy `orders_admin_update`: hiện `orders` chỉ có policy SELECT cho
  admin (0001/0006), chưa có UPDATE — `refundOrder()` gọi qua JWT admin sẽ
  bị chặn 42501 nếu thiếu policy này.
- Chưa chạy lên DB thật (staging hay prod). Cần coordinator duyệt → áp
  staging trước → kiểm chứng theo mục KIEM CHUNG cuối file migration → rồi
  mới lên prod. Không có `SUPABASE_ACCESS_TOKEN` trong phần này nên cũng
  không chạy được.

## 5. Kết quả kiểm thử local (đã chạy thật)

| # | Kiểm thử | Kết quả |
|---|---|---|
| T-09-4-01 | Unit test mới | **PASS — 26/26** (`crm.test.ts` 23 + `lms-admin-audit.test.ts` 3), vitest 2.1.9 |
| T-09-4-02 | Unit test lms-admin cũ (hồi quy) | **PASS — 19/19** (chạy chung 3 file: 45/45) |
| T-09-4-03 | Typecheck `npm run typecheck` | **PASS — 0 lỗi** (lần chạy đầu báo lỗi do race với part khác đang sửa file cùng lúc; chạy lại pass) |
| T-09-4-04 | Lint các file phần này `npx eslint …` | **PASS — 0 lỗi** |
| T-09-4-05 | Build `npm run build` | **CHƯA ĐẠT TRỌN VẸN — lỗi ở file của part khác, không phải file phần này.** Compile: **thành công trong 5,2 phút** (gồm cả 3 route/trang mới). Giai đoạn type-check sau compile báo lỗi `src/lib/unsubscribe.ts:45` (`'invalid_token'` không nằm trong `ApiErrorCode`) — file này thuộc part khác, đang được sửa song song lúc build chạy. Chạy lại `npx tsc --noEmit` ngay sau đó: **PASS, 0 lỗi** (`'invalid_token'` đã có ở `api-client.ts:31`), chứng tỏ cây code hiện tại nhất quán. Không chạy lại full build để tránh race với các part đang sửa file cùng lúc; coordinator cho build lại sau khi mọi part xong. |

## 6. CHƯA CHẠY — live / staging (không ghi PASS)

| # | Kiểm thử | Vì sao chưa chạy | Điều kiện để chạy |
|---|---|---|---|
| C-09-4-01 | Migration 0020 lên staging, kiểm chứng theo mục KIEM CHUNG trong file | **CHƯA CHẠY.** Cần coordinator duyệt + `SUPABASE_ACCESS_TOKEN` | Duyệt 0020 → áp staging → chạy 5 bước kiểm chứng trong file |
| C-09-4-02 | Mở `/admin/crm`, `/admin/crm/[id]`, `/admin/audit-logs` bằng tài khoản admin thật trên staging | **CHƯA CHẠY.** Cần staging đã chạy 0020 + tài khoản admin thật | Như C-09-4-01 + đăng nhập admin thật |
| C-09-4-03 | Ghi tương tác + đổi trạng thái lead thật, đối soát `lead_interactions` + `audit_logs` | **CHƯA CHẠY.** Cần bảng 0020 trên staging | Như C-09-4-01 |
| C-09-4-04 | Hoàn trả 1 đơn `paid` thật trên staging, đối soát `orders` + `audit_logs` | **CHƯA CHẠY.** Cần policy `orders_admin_update` (0017) trên staging | Như C-09-4-01; khôi phục đơn test về `paid` sau kiểm chứng |
| C-09-4-05 | Kiểm tra non-admin vào `/admin/crm` bị chặn 403 | **CHƯA CHẠY.** Cần tài khoản non-admin trên staging | Đăng nhập tài khoản student thật → mở `/admin/crm` |

## 7. Việc cần coordinator / user quyết sau phần này

1. Duyệt migration 0020 rồi áp staging trước (xem §4, §6).
2. Sau khi C-09-4-02–C-09-4-04 đạt trên staging mới áp 0020 lên prod.
3. Xác nhận quy tắc "không hoạt động sau 30 ngày không tương tác" và ngưỡng
   "khách hàng quay lại" (≥ 2 đơn đã trả hoặc ≥ 2 ghi danh) có đúng ý vận hành
   không — hiện là quy ước của phần này, chưa được user chốt.
