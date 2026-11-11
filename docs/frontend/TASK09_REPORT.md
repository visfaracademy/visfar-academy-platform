# TASK 09 — ADMIN PANEL & CRM: báo cáo tổng hợp

- Ngày: 10/11/2026
- Trạng thái: **Code xong, test local PASS; live chưa chạy — chưa đủ điều kiện nghiệm thu live.**
- Báo cáo chi tiết từng phần: [TASK09_PART4_REPORT.md](sandbox://workspace/visfar-academy-platform/docs/frontend/TASK09_PART4_REPORT.md) (phần 4/4 CRM + Audit). Các phần 1/4, 2/4, 3/4 báo cáo trong handoff của từng nhóm (tóm tắt dưới đây).

## 1. File giữ nguyên

- Trang HTML gốc `workspace/user/files/Visfar_Academy.html` và `workspace/visfar-academy/Code-hop-nhat-2-trang.gs` (chỉ đọc, không sửa).
- Migration cũ 0001–0016 (không sửa file cũ); `workers/api/` (chỉ README, chưa có code — Workers deploy là việc riêng).
- Grep service-role/JWT trong `src/` = 0 (theo các nhóm).

## 2. File mới

| Nhóm | File |
|---|---|
| 1/4 Dashboard | `apps/web/src/lib/admin-dashboard.ts`, `admin-dashboard.test.ts` (17 test), `apps/web/src/app/admin/page.tsx`, `apps/web/src/app/admin/loading.tsx` |
| 2/4 User Management | `apps/web/src/lib/admin-users.ts`, `admin-users.test.ts` (20 test), `supabase/migrations/0017_admin_user_disable.sql`, `apps/web/src/app/admin/hoc-vien/page.tsx`, `apps/web/src/app/admin/hoc-vien/[id]/page.tsx`, `apps/web/src/app/api/admin/users/route.ts`, `apps/web/src/app/api/admin/users/[id]/route.ts`, `apps/web/src/components/admin/AdminUserActions.tsx`, `apps/web/src/components/admin/AdminUserEnrollments.tsx` |
| 3/4 Course Management | `apps/web/src/lib/lms-instructors.test.ts` (17 test), `apps/web/src/components/admin/AdminInstructors.tsx`, `apps/web/src/app/api/admin/courses/[courseId]/instructors/route.ts`, `apps/web/src/app/api/admin/courses/[courseId]/instructors/[userId]/route.ts`, `apps/web/src/app/api/admin/instructors/route.ts` |
| 4/4 CRM + Audit | `apps/web/src/lib/crm.ts`, `crm.test.ts` (23 test), `lms-admin-audit.test.ts` (3 test), `apps/web/src/app/admin/crm/page.tsx`, `apps/web/src/app/admin/crm/[leadId]/page.tsx`, `apps/web/src/app/admin/audit-logs/page.tsx`, `apps/web/src/components/admin/LeadStatusForm.tsx`, `apps/web/src/components/admin/LeadInteractionForm.tsx`, `supabase/migrations/0020_lead_interactions.sql` (đổi số từ 0017 → 0020, xem §6) |

## 3. File sửa

- `apps/web/src/lib/lms-admin.ts` — thêm `assignInstructor` / `revokeInstructorAssignment` / `listCourseInstructors` / `listInstructorCandidates` / `validateInstructorRole`, audit actions `instructor.assign` / `instructor.revoke`, `refundOrder()`, mở rộng union `AuditAction` (`user.role.change` / `user.disable` / `user.enable`); sửa bug `previous_role` bị ghi đè (chụp trước khi update).
- `apps/web/src/components/admin/AdminContentTree.tsx` — thêm UI sửa chương/bài/tài liệu (`ModuleEditForm`, `LessonEditForm`, `ResourceEditForm`; trước đây chỉ có API PATCH, chưa có UI).
- `apps/web/src/app/admin/khoa-hoc/[courseId]/page.tsx` — gắn mục "Giảng viên phụ trách" (`AdminInstructors`).
- `apps/web/src/app/admin/layout.tsx` — nav admin thêm link Tổng quan / Học viên / CRM / Nhật ký; redirect chưa đăng nhập đổi `next=/admin/khoa-hoc` → `next=/admin`.
- `apps/web/src/middleware.ts` — matcher thêm `/admin` (trước đây chỉ có `/admin/:path*`).
- `apps/web/src/styles/globals.css` — chỉ thêm class / `.field textarea` vào rule sẵn có, không đổi màu/font/ảnh.
- Lỗi `instructor_id` đã biết: **đã được sửa sẵn trước Task 09** — `lms-access.ts` và `assignment-server.ts` + `api/v1/assignments` đều dùng đúng `user_id` trên `course_instructors`; test assert không còn `instructor_id`.

## 4. Chức năng đã làm

### Admin Dashboard (`/admin`)
8 chỉ số, mọi số đọc thật từ Supabase (chưa có dữ liệu → 0 / empty state, **không bịa số**):
tổng học viên, học viên mới (30 ngày), học viên hoạt động (có `lesson_progress.updated_at` trong 30 ngày), tổng khóa học (kèm số đã xuất bản), đăng ký khóa học (kèm số active), doanh thu, đơn hàng (kèm số `paid`), tỷ lệ hoàn thành.
Doanh thu: tổng `payments.amount_vnd` với `status='succeeded'`; nếu bảng `payments` chưa có/lỗi → fallback sang tổng `orders.amount_vnd` với `status='paid'` và hiện cảnh báo ghi rõ nguồn (`revenueSource` + `revenueWarning`), không đổi nguồn im lặng. Cả hai đều lỗi → error state.
Tỷ lệ hoàn thành = bài đã hoàn thành / tổng bài phải học của enrollment `active` + `completed` (loại `revoked`), theo ngưỡng QĐ 17 (video ≥90%, bài text khi `status='completed'`); chỉ dùng cột 0001 để không lỗi 400 trên DB chưa chạy 0012; tổng bài suy ra qua `course_modules → lessons` (cột đúng `course_module_id`).
Thêm: bảng tiến độ theo khóa học và 10 đăng ký gần đây.

### User Management (`/admin/hoc-vien`)
Danh sách + tìm kiếm tên/email/SĐT (sanitize `% _ \`) + lọc role / trạng thái tài khoản / khóa học + phân trang 20/trang; trang chi tiết: hồ sơ, roles, enrollment kèm tiến độ (ngưỡng QĐ 17), lịch sử đơn hàng kèm `order_items`.
`changeUserRole()` chỉ qua `user_roles` (nguồn sự thật duy nhất, QĐ Task 03 #3), `profiles.role` đồng bộ bằng trigger 0007, audit `user.role.change`; chặn tự đổi role của chính mình.
`setUserDisabled()` vô hiệu hóa / mở lại **thay vì xóa** (QĐ Task 03 #9): `profiles.is_disabled/disabled_at/disabled_reason`, lý do bắt buộc, audit `user.disable` / `user.enable`; đơn hàng và enrollment giữ nguyên, không thu hồi, không xóa. **Không có hàm xóa tài khoản** (có test tĩnh chặn `profiles.delete`, `auth.admin.deleteUser`).
Tặng/thu hồi khóa dùng lại `grantEnrollment`/`revokeEnrollment` (bắt buộc `granted_by` + `grant_reason` + audit).

### Course Management (`/admin/khoa-hoc`)
Đã có sẵn và kiểm tra lại: tạo/sửa khóa (draft/published/archived, giá, thứ tự), chương/bài/tài liệu, xuất bản/ẩn, sắp xếp `display_order` ↑↓, tặng/thu hồi enrollment + thu hồi chứng chỉ — mọi ghi đều `audit_logs`.
Mới bổ sung (phần thiếu lớn nhất): **phân công giảng viên** — `assignInstructor` (gán mới / đổi vai trò, tối đa 1 `lead` mỗi khóa, kiểm tra vai trò instructor ở `user_roles`, trùng vai trò → lỗi), `revokeInstructorAssignment`, `listCourseInstructors`, `listInstructorCandidates`, audit `instructor.assign` / `instructor.revoke`; 3 route API mới + UI `AdminInstructors` (form phân công, bảng giảng viên, đổi vai trò tại chỗ, thu hồi 2 bước xác nhận). **Không cần migration mới** (`course_instructors` đã có từ 0004, RLS admin từ 0006/0013).

### CRM (`/admin/crm`) + Audit Log (`/admin/audit-logs`)
CRM: dữ liệu thật từ Supabase (`leads`, `enrollments`, `orders`); phân loại 8 nhóm: mới / đã tư vấn / đã đăng ký / đã mua / đang học / hoàn thành / không hoạt động sau 30 ngày / quay lại (≥2 đơn đã trả hoặc ≥2 ghi danh); đọc tối đa 200 lead mới nhất (ghi rõ trên trang khi chạm giới hạn).
Hồ sơ lead: đổi trạng thái (audit `lead.status`), lịch sử tương tác ghi ai/khi nào/kênh/nội dung/kết quả vào `lead_interactions` + audit `lead.interaction`. Khi bảng 0020 chưa có: hiện cảnh báo rõ, form trả lỗi rõ — không giả vờ đã lưu.
Audit log: trang đọc thật `audit_logs` kèm tên actor, lọc action/actor/từ khóa.
Rà soát audit: tặng/thu hồi khóa, đổi role, phân công giảng viên, xuất bản/ẩn khóa, chấm bài, cấp/thu hồi chứng chỉ **đã có audit từ trước**; chỉ còn thiếu hoàn trả → đã bổ sung `refundOrder()`: chỉ đơn `paid` mới hoàn được, lý do bắt buộc, audit `order.refund` (số tiền, trạng thái cũ, lý do, ngày đặt đơn, ghi chú chính sách 15 ngày làm việc QĐ 9). Test bắt được 1 bug thật (`previousStatus` bị ghi đè thành `refunded` do đọc sau update) — đã sửa.
Bảo mật: chỉ admin (middleware `/admin/*` + `requireAdmin()` ở layout + `getAdminContext()` ở API route).

## 5. Kết quả kiểm thử

### Coordinator kiểm chứng lại sau khi cả 4 nhóm xong (10/11/2026)
- `npx vitest run` 5 file test Task 09: **80/80 PASS** (`admin-dashboard` 17, `admin-users` 20, `lms-instructors` 17, `crm` 23, `lms-admin-audit` 3).
- `npm run typecheck` (`npx tsc --noEmit`): **PASS, 0 lỗi**.
- `npm run build`: **CHƯA PASS — do môi trường, không phải lỗi code.** Các nhóm chạy build song song + `rm -rf .next` giữa chừng: lần nào cũng `✓ Compiled successfully` + typecheck/lint pass, rồi fail ở bước Collecting page data vì file `.next` sinh ra bị thiếu giữa chừng (`pages-manifest.json`, `next-font-manifest.json`, `page.js.nft.json`). Cần chạy lại `npm run build` một mình khi không còn build song song + smoke test (`/admin` chưa đăng nhập → 307; admin → 200; học viên thường → 403).
- Full suite theo các nhóm: 528/532 PASS — 4 test fail có sẵn, không thuộc Task 09: `payments.test.ts` ×3 (test GAP Task 10, cố tình fail tới khi code Task 10 về) và `unsubscribe.test.ts` ×1.

### Live — CHƯA CHẠY (không ghi PASS giả)
- Đăng nhập admin thật → mở `/admin` → đối chiếu số với DB; gán/thu hồi giảng viên → đối chiếu `course_instructors` + `audit_logs`; ghi tương tác + đổi trạng thái lead thật; hoàn trả 1 đơn `paid` thật; kiểm tra non-admin bị chặn 403 — tất cả CHƯA CHẠY, cần migration 0017 + 0020 trên staging + tài khoản admin thật.

## 6. Migration mới — xung đột số đã xử lý 1 phần

- `0017_admin_user_disable.sql` (phần 2/4): thêm `profiles.is_disabled` + `disabled_at` + `disabled_reason`, idempotent. **Đã áp staging (11/11/2026 ~07:38 +07) và prod (11/11/2026 ~08:03 +07), HTTP 201, kiểm chứng PASS (41 bảng, RLS 41/41).**
- `0020_lead_interactions.sql` (phần 4/4, đổi số từ 0017 → 0020 bởi coordinator vì trùng số): bảng `lead_interactions` + policy `orders_admin_update` (bắt buộc thì `refundOrder()` qua JWT admin mới không bị chặn 42501). **Đã áp staging và prod cùng đợt 0017→0021 ngày 11/11/2026 (HTTP 201 cả 5 file).**
- ⚠️ **Xung đột còn lại, ngoài phạm vi Task 09:** thư mục `supabase/migrations/` hiện có **3 file số 0017** (`0017_admin_user_disable.sql`, `0017_email_unsubscribe_logs.sql`, `0017_lead_interactions.sql` đã đổi thành 0020 nên còn 2 file 0017) và `0018_email_task11.sql`, `0019_commerce_payment.sql` do các task song song khác tạo. Cần một đợt renumber thống nhất trước khi `db push` (CLI sẽ chạy theo thứ tự tên file, trùng số gây lỗi / bỏ qua file).

## 7. Follow-up cần quyết (ghi rõ, không tự ý làm)

**Cập nhật 11/11/2026 — các follow-up 1–3 và 5 đã ĐÓNG (xem chi tiết dưới):**
1. **✅ ĐÃ VÁ (S-01, migration 0022, 11/11/2026):** trigger `trg_profiles_block_disable_change` trong `0022_block_student_self_disable.sql` chặn non-admin UPDATE `is_disabled`/`disabled_at`/`disabled_reason` (RAISE P0001); chặn đăng nhập khi bị disable ở `middleware.ts` (REST check `is_disabled`, logout + redirect `/dang-nhap?reason=disabled`) + layout `/hoc-vien`. 0022 đã áp staging HTTP 201, kiểm chứng live PASS (student PATCH `is_disabled` → 400 P0001; PATCH `full_name` → 204; tài khoản disable → GET `/hoc-vien` 307, refresh token bị thu hồi; mở lại → 200). **0022 CHƯA áp prod.** Lưu ý: không dùng REVOKE (admin vô hiệu hóa/mở lại bằng JWT admin trực tiếp qua `setUserDisabled()` — REVOKE sẽ phá luồng này); middleware chỉ đọc `exp`/`sub` của JWT, không verify chữ ký (bảo mật thật do Supabase Auth + RLS + trigger đảm nhiệm).
2. **✅ ĐÃ VÁ cùng migration 0022 (xem mục 1):** trigger so sánh OLD/NEW chặn đúng 3 cột disable; học viên vẫn sửa được các cột khác của profile mình. Không viết lại `profiles_update_own` bằng WITH CHECK (WITH CHECK không tham chiếu được OLD).
3. **✅ ĐÃ SỬA bằng migration 0019:** `orders.user_id` nay là `ON DELETE SET NULL` (kiểm chứng prod sau khi áp 0017→0021 ngày 11/11/2026: FK `ON DELETE SET NULL`, cột nullable = YES).
4. **Quy ước CRM chưa được user chốt:** "không hoạt động sau 30 ngày không tương tác" và "quay lại = ≥2 đơn đã trả hoặc ≥2 ghi danh" — cần xác nhận.
5. **✅ ĐÃ ÁP migration 0017→0021 lên staging (11/11/2026 ~07:38 +07, HTTP 201 cả 5 file) và prod (11/11/2026 ~08:03 +07, HTTP 201 cả 5 file, kiểm chứng PASS: 41 bảng, RLS 41/41, courses=10).** Còn lại: chạy kiểm thử live C-09 (admin dashboard, user management, phân công giảng viên, CRM, hoàn trả, non-admin 403) và áp 0022 lên prod sau khi staging PASS.

## 8. Phương án rollback

Code chưa commit, chưa deploy, migration 0017 + 0020 chưa áp lên DB nào → rollback = xóa file mới ở §2 + revert các file sửa ở §3; không cần rollback DB. Baseline trước Task 09: test 401/401 (Task 08), typecheck/lint/build pass.
