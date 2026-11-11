# ADMIN_GUIDE — Hướng dẫn quản trị

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Nguồn:** code thật — `apps/web/src/app/admin/*/page.tsx`, `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/api/admin/*` (Route Handlers), `workers/api/src/handlers/payments-admin.ts`, migrations 0013/0019/0021/0022/0030.
- **Đối tượng:** admin (role `admin` — hiện là Lê Đăng Quyết). Học viên thường **không** thấy mục "Quản trị" trong menu tài khoản.
- **Truy cập:** đăng nhập → menu tài khoản → **Quản trị** → `/admin`. Middleware chặn chưa đăng nhập (redirect `/dang-nhap`); layout server `requireAdmin()` chặn tiếp (đọc role từ DB, không tin cookie). API admin trả JSON 401 khi chưa đăng nhập, 403 khi không đủ quyền.

## 1. Tổng quan — `/admin`

Trang Tổng quan admin (nav: Tổng quan · Khóa học · Thư viện · Cộng đồng · Học viên · Đơn hàng · Lịch hẹn · Mã giảm giá · Gói thành viên · CRM · Nhật ký quản trị). Mọi thao tác admin đổi dữ liệu đều ghi `audit_logs` (`actor_id`, `action`, `target_type`, `target_id`, `details`).

## 2. Đăng khóa học / bài học — `/admin/khoa-hoc`

- **Trang:** `/admin/khoa-hoc` (danh sách khóa) → `/admin/khoa-hoc/[courseId]` (chi tiết + module + bài).
- **Tạo/sửa khóa:** form ở cuối trang `/admin/khoa-hoc` (gọi `POST /api/admin/courses`); sửa qua `PATCH /api/admin/courses/[courseId]`.
- **Module:** tạo qua `POST /api/admin/courses/[courseId]/modules`; sửa module qua `PATCH /api/admin/modules/[moduleId]`; thêm bài vào module qua `POST /api/admin/modules/[moduleId]/lessons`.
- **Bài học:** sửa qua `PATCH /api/admin/lessons/[lessonId]`; tài liệu đính kèm qua `.../lessons/[lessonId]/resources` (thêm/xóa resource qua `.../resources/[resourceId]`).
- **Thứ tự:** đổi thứ tự khóa qua `POST /api/admin/courses/[courseId]/reorder`.
- **Giảng viên phụ trách:** gán/xóa qua `GET/POST/DELETE /api/admin/courses/[courseId]/instructors` (+ `[userId]`); chỉ admin gán.
- **Lưu ý:** `lessons.slug` UNIQUE **theo module** (QĐ 17); bài xem thử đặt `is_free_preview=true`. Sau khi áp 0028 lên prod, nội dung bài trả phí chỉ học viên đã ghi danh mới đọc được — đừng kiểm tra nội dung bài bằng tài khoản anon/khách.

## 3. Đăng bài Thư viện — `/admin/thu-vien`

- **Trang:** `/admin/thu-vien` (danh sách + form đăng/sửa).
- **API:** `GET/POST /api/admin/library`, `GET/PATCH/DELETE /api/admin/library/[id]`; mọi thao tác ghi audit `library.create/update/delete`.
- **Trường bài:** tiêu đề, slug (duy nhất), category, nội dung, ảnh bìa, video, `is_published`, `display_order`. **Ảnh bìa hiện chỉ dán link, chưa hỗ trợ tải file.**
- **Hiển thị:** bài đã xuất bản hiện ở `/thu-vien-master` (119 mục seed; tìm kiếm không dấu; deep-link `?bai=`).
- **Chưa áp prod:** migration 0025 chưa lên prod — bài đăng trên staging chưa hiện trên prod từ DB (prod chạy dữ liệu mặc định trong code). Đừng đăng bài mới trên prod rồi thắc mắc sao không thấy, cho tới khi 0025 áp prod.

## 4. Kiểm duyệt cộng đồng — `/admin/cong-dong`

- **Trang:** `/admin/cong-dong`.
- **Thao tác:** ẩn/hiện bài (`status: hidden/visible`), ghim/bỏ ghim (`is_pinned`), xóa bài, xử lý báo cáo (`community_reports`: `open` → `resolved`/`dismissed`). Bài bị ẩn chỉ tác giả + người kiểm duyệt thấy.
- **Chưa áp prod:** migration 0030 chưa lên prod — kiểm duyệt cộng đồng hiện chỉ chạy trên staging.

## 5. Quản lý học viên — `/admin/hoc-vien`

- **Trang:** `/admin/hoc-vien` (danh sách, lọc theo trạng thái gồm "Đã vô hiệu hóa") → `/admin/hoc-vien/[id]` (chi tiết: lý do + thời gian vô hiệu hóa).
- **API:** `GET /api/admin/users`, `GET/PATCH /api/admin/users/[id]` (đổi role, vô hiệu hóa).
- **Vô hiệu hóa:** `setUserDisabled` — **cấm tự disable chính mình**, lý do bắt buộc, ghi audit. Tài khoản disabled bị middleware chặn đăng nhập/học (thu hồi refresh token, redirect `/dang-nhap?reason=disabled`).
- **Cấp/thu hồi role:** qua `user_roles` (nguồn sự thật); `profiles.role` chỉ là cache đồng bộ bằng trigger.
- **Tặng khóa học:** tạo enrollment không qua đơn đã trả — qua `POST /api/admin/enrollments` (ghi rõ `granted_by` + `grant_reason`), **bắt buộc ghi `audit_logs`** (`enrollment.grant`); thu hồi qua `PATCH /api/admin/enrollments/[id]`.

## 6. Quản lý đơn hàng & hoàn tiền — `/admin/don-hang`

- **Trang:** `/admin/don-hang` (lọc theo trạng thái: pending/paid/cancelled/refunded/expired; lọc đơn có yêu cầu hoàn trả).
- **Xác nhận đã nhận tiền (mark-paid):** chỉ khi admin đã đối soát được sao kê (tiền vào đúng mã đơn `DH-YYYY-NNNNNN`, đúng số tiền). Gọi `POST /api/v1/admin/orders/:id/mark-paid` (Worker; body: `amount_vnd`, `note`) → tạo `payments` (`bank_transfer`, `succeeded`) → đơn `paid` → tạo enrollment → gửi email E8. **Không bao giờ tin client báo "đã trả".**
- **Hoàn trả (refund):** khung **15 ngày làm việc** (QĐ 9). Gọi `POST /api/v1/admin/orders/:id/refund` → đơn `refunded`, ghi payment `refunded`, thu hồi enrollment (`revoked`), giảm lượt dùng coupon, ghi audit `order.refund`, gửi email E13. **Hoàn tiền thực tế là chuyển khoản thủ công:** admin chuyển khoản lại cho học viên, ghi `refund_bank_reference` là mã giao dịch hoàn. (SePay không có API hoàn tiền dùng cho Visfar — xem `docs/payment/SEPAY_INTEGRATION.md` §7.)
- **Yêu cầu hoàn trả của học viên:** học viên gửi qua `POST /api/v1/my/orders/:id/refund-request`; admin thấy ở bộ lọc "có yêu cầu hoàn trả" và xử lý trong 15 ngày làm việc; khiếu nại phản hồi trong **3 ngày**.
- **Đơn quá hạn:** đơn `pending` quá +48h → `expired` (route `POST /api/v1/admin/orders/expire-sweep` — **chưa xác minh có scheduler nào gọi định kỳ**; kiểm tra tay nếu thấy đơn quá hạn chưa chuyển trạng thái).
- **Đối soát:** xem giao dịch ở `GET /api/v1/admin/payments`; đơn `paid` chưa có enrollment / payment không khớp đơn / webhook lỗi đều nằm trong báo cáo đối soát R9 — kiểm tra mỗi sáng.

## 7. Mã giảm giá & gói thành viên — `/admin/ma-giam-gia`, `/admin/goi-thanh-vien`

- **Mã giảm giá:** trang `/admin/ma-giam-gia`; Worker API `GET/POST /api/v1/admin/coupons`, `PATCH /api/v1/admin/coupons/:id`. Trường: `code` (viết hoa, không dấu), `discount_type` (`percent`/`fixed_amount`), `discount_value`, `min_order_vnd`, `max_discount_vnd`, `usage_limit`, `valid_from`/`valid_to`, `status`. `used_count` tăng khi đơn `paid` (Workers, transaction), giảm khi hoàn trả.
- **Gói thành viên:** trang `/admin/goi-thanh-vien`; Worker API `GET/POST /api/v1/admin/membership-plans`. Học viên mua gói qua đơn hàng (`order_items` loại `membership`).

## 8. CRM lead — `/admin/crm`

- **Trang:** `/admin/crm` (lọc theo trạng thái, danh mục, tìm kiếm) → `/admin/crm/[leadId]` (chi tiết + tương tác).
- **Trạng thái lead:** `new` → `contacted` → `enrolled` / `closed` / `spam`. Đổi trạng thái qua `PATCH /api/admin/leads/[leadId]/status`; ghi tương tác chăm sóc qua `.../interactions`.
- **Đối soát lead:** DB là nguồn sự thật; Google Sheet chỉ là bản sao đối soát — kiểm tra tab DATA khớp với `leads` sau mỗi đăng ký thật (đặc biệt khi `sheetSynced:false`).
- **Chống trùng:** lead trùng `Idempotency-Key` + cùng body → 200 `duplicate:true` (không ghi thêm); khác body → 409. Đừng tạo tay 2 dòng cho cùng 1 lần đăng ký.

## 9. Lịch hẹn — `/admin/lich-hen`

- **Trang:** `/admin/lich-hen`. Lịch hẹn 1–1 (`appointments`): học viên đặt qua `POST /api/v1/appointments`; admin/instructor đổi trạng thái qua `PATCH /api/v1/appointments/:id` (`pending`/`confirmed`/`cancelled`/`completed`). Hình thức `zoom` (mặc định) hoặc trực tiếp; `meeting_url` điền khi xác nhận.

## 10. Chứng chỉ — chỉ API route (chưa có trang UI admin)

- Cấp: `POST /api/admin/certificates/issue`; thu hồi: `POST /api/admin/certificates/[id]/revoke`.
- Mã chứng chỉ dạng `VISFAR-CERT-YYYY-NNNNNN`; tra cứu công khai ở `/chung-chi/tra-cuu` (RPC `verify_certificate`, chỉ trả 6 trường).
- Chứng chỉ tự động tạo khi học viên hoàn thành 100% bài trong khóa (enrollment → `completed`).

## 11. Nhật ký quản trị — `/admin/audit-logs`

- **Trang:** `/admin/audit-logs` — xem nhật ký thao tác admin (đọc bảng `audit_logs`: ai, làm gì, đối tượng nào, khi nào, chi tiết). Dùng để đối soát sau mỗi thao tác nhạy cảm (tặng khóa, mark-paid, refund, đổi role, vô hiệu hóa, đăng/xóa bài Thư viện).
- **Lưu ý:** IP trong log chỉ admin xem; log lưu trữ 12 tháng (theo quy tắc 4 bảng log).

## 12. Việc admin CHƯA làm được (đừng tìm — chưa có)

- **Đăng/sửa blog:** chưa có trang admin blog; blog hiện là 3 bài tĩnh trong code (QĐ 21).
- **Đăng/sửa sự kiện:** chưa có trang admin sự kiện; 3 sự kiện 25/11/2026, 18:30 là dữ liệu hiện có.
- **Xem tổng hợp 11D:** view `assessment_aggregates_11d` đã sẵn (không PII) nhưng chưa có trang admin cho view này.
- **Báo cáo R1–R10 (`GET /api/admin/reports/*`):** đã thiết kế nhưng **chưa có route**; báo cáo hiện đọc trực tiếp Supabase bằng JWT admin.
- **Xác nhận thanh toán tự động qua SePay:** webhook đã nối route nhưng **chưa chạy thật** — tới khi chạy thật, mọi đơn vẫn xác nhận thủ công bằng sao kê.
