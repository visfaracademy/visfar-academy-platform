# TASK 07 (phần 3/4) — SECURITY + ADMIN — Báo cáo

**Ngày:** 10/11/2026 · **Người làm:** subagent phần 3/4 · **Phạm vi:** repo
`workspace/visfar-academy-platform`, app `apps/web` (Next.js 15 + Supabase).

**Căn cứ:** `docs/DECISIONS.md` (Task 02 QĐ 6–7, Task 03 QĐ 3/5/6), `docs/database/RLS_POLICIES.md`
(§4.1 bài không xem thử qua API, §4.2 không lộ `is_correct`, §5 không tự cấp enrollment,
admin tặng khóa ghi `audit_logs`), `docs/architecture/ROLE_PERMISSION_MATRIX.md`.

## 1. Việc đã làm

### SECURITY — kiểm tra quyền học phía server
- `src/lib/lms-access.ts` (mới): `decideLessonAccess()` thuần + `requireLessonAccess()` /
  `requireLessonAccessById()` chạy ở server (client mang JWT người gọi, `getUser()` verify
  token thật qua Auth API). Chỉ `enrollment` `active`/`completed` mới xem bài trả phí;
  `revoked` → chặn ngay (`lesson = null`, không trả `content`/`video_url`/`file_url`);
  bài xem thử → chỉ bản preview đã lọc URL; admin / instructor khóa phụ trách được xem
  để kiểm tra (kể cả khóa draft, bài chưa xuất bản); học viên xem khóa draft / bài chưa
  xuất bản → `not-published`.
- `src/lib/supabase-server.ts` (mới): client server đọc access token từ cookie phiên,
  gọi Supabase bằng anon key + `Authorization: Bearer <token>` — **không có service-role
  key ở `apps/web`** (RLS vẫn là lớp chặn cuối).
- `GET /api/lms/lessons/[lessonId]` (mới): endpoint guard — 401 chưa đăng nhập, 404 không
  tìm thấy/chưa xuất bản, 403 chưa ghi danh/bị thu hồi, 200 kèm bài đầy đủ hoặc bản preview.
- Tích hợp vào luồng học thật của phần 1/4 (`src/lib/learning.ts`, sửa): `fetchLessonDetail()`
  gọi guard server qua `verifyLessonAccessViaApi()` (param thứ 5, inject được cho test);
  server từ chối → `locked = true` + `stripLessonContent()` (content/video/file → null) +
  `resources = []`; server trả previewOnly → mở bài nhưng không có URL; không gọi được API
  (unit test / mất mạng) → fallback quyết định client như cũ. Không đổi chữ ký cũ nên
  trang bài học và các test phần 1/4 không phải sửa.
- `GET /api/v1/resources/[id]/download` (sửa — route gốc của phần 1/4): **trước đây chỉ
  kiểm tra khóa published, bất kỳ ai có id tài liệu cũng tải được file trả phí**. Nay dùng
  server client + `requireLessonAccessById()` (enrollment active/completed; revoked → 403;
  xem thử chỉ khi chính tài liệu đó là xem thử); khách chưa đăng nhập chỉ tải được tài
  liệu xem thử của bài xem thử. Giữ nguyên stream file qua API (tối đa 100 MB, không lộ
  URL gốc trong HTML/Location/header), giữ `runtime = 'edge'`.
- Đã **xóa** route `/api/lms/resources/[resourceId]` do tôi tạo giữa chừng: trùng chức năng
  với route v1 nhưng yếu hơn (redirect 302 lộ URL ở header Location); chỉ giữ 1 endpoint
  chuẩn là v1.

### ADMIN — `/admin/khoa-hoc` (chỉ admin)
- Middleware (`src/middleware.ts`, sửa): matcher thêm `/admin/:path*` + `/api/admin/:path*`;
  chưa đăng nhập → redirect `/dang-nhap` (trang) hoặc JSON 401 (API). Quyền admin thật do
  `requireAdmin()` kiểm tra ở server (đọc `user_roles` — nguồn sự thật — + `profiles.role`
  cache), không tin cookie.
- `src/app/admin/layout.tsx` (mới): server layout — chưa đăng nhập → redirect login;
  không phải admin → trang 403, không lộ dữ liệu quản trị.
- `src/app/admin/khoa-hoc/page.tsx` + `[courseId]/page.tsx` (mới, server component):
  danh sách khóa (cả draft/archived, kèm số chương/bài), chi tiết khóa (sửa thông tin,
  cây chương → bài → tài liệu, quản lý học viên). Phong cách luxury theo token sẵn có
  (ivory champagne / vàng gold), responsive (bảng cuộn ngang trên điện thoại, nút ≥ 44px).
- API admin (mới, 11 route, mọi thao tác ghi `audit_logs`):
  - `GET/POST /api/admin/courses`, `GET/PATCH /api/admin/courses/[courseId]`
    (tạo/sửa khóa, trạng thái `draft/published/archived`; không có DELETE — ẩn bằng archived).
  - `POST /api/admin/courses/[courseId]/modules`, `PATCH /api/admin/modules/[moduleId]`,
    `POST /api/admin/modules/[moduleId]/lessons`, `PATCH /api/admin/lessons/[lessonId]`,
    `POST /api/admin/lessons/[lessonId]/resources`, `PATCH /api/admin/resources/[resourceId]`
    (không DELETE tài liệu — giữ lịch sử thay vì hard-delete).
  - `POST /api/admin/courses/[courseId]/reorder` — nút lên/xuống, lưu `display_order`,
    kiểm tra mọi id cùng 1 cha trước khi ghi.
  - `GET/POST /api/admin/enrollments` (tặng khóa: `granted_by` + `grant_reason` bắt buộc,
    `order_id = NULL`; đã active → 409; đã revoked → mở lại dòng cũ) và
    `PATCH /api/admin/enrollments/[id]` (chỉ `status: 'revoked'` + lý do bắt buộc).
- `src/lib/lms-admin.ts` (mới): `grantEnrollment()`, `revokeEnrollment()` (đổi status +
  thu hồi chứng chỉ `valid` của học viên ở khóa đó + audit `enrollment.revoke`),
  `reorderContent()`, `listCourseEnrollments()`, `fetchAdminCourseList()`,
  `fetchAdminCourseTree()`, `writeAuditLog()`, validation form admin. Audit ghi lỗi thì
  thao tác chính vẫn trả kết quả kèm `auditWarning` hiển thị ở UI (không im lặng).
- Client components (mới): `CourseCreateForm`, `CourseEditForm`, `AdminContentTree`
  (lên/xuống, xuất bản/ẩn, xem thử, thêm chương/bài/tài liệu), `AdminEnrollments`
  (tặng khóa, thu hồi kèm lý do).

### Migration mới — `supabase/migrations/0013_admin_lms.sql` (không sửa file cũ)
- (A) `enrollments.granted_by` + `grant_reason` (tặng khóa theo Task 02 QĐ 7).
- (B) `certificates.status` (`valid`/`revoked`) để thu hồi chứng chỉ cùng enrollment.
- (C) `lessons.is_published` (trạng thái xuất bản cấp bài).
- (D) RLS cho đường ghi admin qua JWT (không có Workers service-role ở web):
  `enrollments_insert_admin`, `audit_logs_insert_admin` (actor phải là chính admin gọi).
  Không có 2 policy này thì mọi thao tác admin đều bị RLS chặn (0001 chỉ có
  `audit_logs_admin_read`; 0009 đã xóa `enrollments_insert_own`).
- (E) **Sửa lỗi 0006:** `is_instructor_of()` và 2 policy (`course_instructors_select_own`,
  `profiles_instructor_read_students`) dùng cột `user_id` **không tồn tại** trên bảng
  `course_instructors` (bảng chỉ có `instructor_id` — 0004) nên mọi kiểm tra instructor
  đều lỗi/sai. Đã sửa sang `instructor_id`.
- (F) Thu hẹp `lesson_resources` SELECT: bỏ policy công khai cũ (anon đọc được `file_url`
  của mọi tài liệu khóa published) → chỉ free-preview / đã ghi danh / instructor / admin.
- (G) View `lessons_public` (không có `content`/`video_url`/`file_url`) cho danh sách bài
  công khai; URL nhạy cảm chỉ trả qua API route sau khi kiểm tra enrollment.

## 2. Kết quả test local (chạy thật, 10/11/2026)

Lệnh chạy từ `apps/web` bằng binary ở root workspace (`../../node_modules/.bin/...`,
do `apps/web/node_modules` chỉ còn eslint):

| Lệnh | Kết quả |
|---|---|
| `vitest run` (toàn suite) | **15 file, 310 test — tất cả pass** (trong đó file mới `lms-access.test.ts` 27 test, `lms-admin.test.ts` 19 test; `learning.test.ts` 48 test gồm 7 test mới về server guard) |
| `tsc --noEmit` | **pass, 0 lỗi** |
| `eslint .` | **pass, 0 lỗi** |
| `next build --no-lint` | **pass** — đủ route mới đều dynamic: `/admin/khoa-hoc`, `/admin/khoa-hoc/[courseId]`, 11 route `/api/admin/*`, `/api/lms/lessons/[lessonId]`, `/api/v1/resources/[id]/download` |

Các trường hợp guard đã test (fake client, không cần DB thật):
chưa đăng nhập → `unauthenticated`; student không enrollment → `not-enrolled`, lesson null,
không lộ chuỗi URL; student enrollment `revoked` → `revoked`, lesson null (cả qua slug lẫn
qua id); bài xem thử → `ok-preview` không có URL; admin/instructor → xem được cả khóa draft;
`grantEnrollment` (mới / trùng / mở lại revoked) + audit; `revokeEnrollment` (active →
revoked + thu hồi 1 chứng chỉ `valid` + audit `enrollment.revoke` + `previous_status`);
`reorderContent` (đổi thật + audit; id khác cha / trùng order / trùng id → lỗi, không đổi gì).

## 3. Mục live chưa chạy + vì sao
- **Chưa chạy migration 0013 lên Supabase staging/prod** (không chạy DB thật khi viết
  migration, theo quy ước các task trước; cần access token / SQL Editor + duyệt).
  Hệ quả tới khi chạy: route admin tặng khóa / ghi audit sẽ bị RLS chặn (400/500) và
  `lesson_resources` vẫn đọc công khai qua anon key. Kiểm chứng theo mục KIEM CHUNG
  cuối file migration.
- **Chưa test live 2 tài khoản / revoked thật trên staging**: cần tài khoản admin +
  student thật trên staging (staging Auth từng bị rate-limit ở Task 06) và migration
  0013 đã áp. Unit test + fake client đã bao phủ logic; live chỉ còn để xác nhận
  RLS/policy trên DB thật.
- **Chưa quét thử QR / kiểm tra tay trên điện thoại thật**: không thuộc phạm vi phần này.
- `next build` **mặc định (có lint) FAIL** — không phải do file phần này: 2 lỗi
  `@typescript-eslint/no-unused-vars` ở file của nhóm khác đang làm song song:
  `src/components/course/LessonPlayer.tsx:166` (`pct` không dùng),
  `src/lib/progress.ts:639` (`moduleTitleById` không dùng). `eslint .` của repo thì pass
  (cấu hình khác bước lint của Next). Tôi **không sửa 2 file đó** vì nhóm khác đang
  sửa dở — parent quyết định ai dọn.

## 4. Rủi ro còn tồn / follow-up (ghi rõ, không giấu)
1. **RLS `lessons` vẫn cho đọc `content`/`video_url`/`file_url` của khóa published qua
   query trực tiếp** (policy `lessons_select_public` — row-level, không chặn theo cột).
   Trang bài học đã qua guard server (UI + download đều chặn), nhưng ai biết gọi Supabase
   trực tiếp vẫn đọc được nội dung bài. Đóng hẳn cần: `fetchStructureRows()` (phần 1/4)
   chuyển sang view `lessons_public` (đã tạo ở 0013) + lấy nội dung bài hiện tại chỉ qua
   `GET /api/lms/lessons/[id]` — thay đổi này chạm test phần 1/4 (đang assert `videoUrl`
   trong structure) và trang `/chuong-trinh/[slug]`, cần phối hợp phần 1/4, không tự
   đổi trong phần này.
2. **Download v1 stream file (không phải signed URL 1 giờ)**: URL gốc không lộ, nhưng ai
   có URL gốc vẫn tải được (giống video YouTube unlisted, DECISIONS QĐ 16). Signed URL
   thật cần service-role / Storage bucket riêng — chưa có ở giai đoạn này.
3. **Access token hết hạn (~1 giờ)**: server route không tự refresh (tránh ghi cookie từ
   2 nơi); khi đó guard trả 401 và trang bài học fallback quyết định client. Client sẽ
   refresh rồi gọi lại — chấp nhận được, ghi rõ ở `supabase-server.ts`.
4. **Tặng khóa cần nhập UUID học viên tay** (chưa có ô tìm học viên theo tên/email ở UI
   admin). Có thể bổ sung sau bằng 1 endpoint tìm kiếm admin.
5. **Phát hiện ngoài phạm vi:** `src/lib/dashboard.ts` đọc lessons bằng cột `module_id`
   (tên cũ trước 0005; sau 0005 là `course_module_id`) — có thể lỗi nếu migration 0005
   đã chạy. Không sửa trong phần này, ghi lại để nhóm Dashboard đối chiếu.
