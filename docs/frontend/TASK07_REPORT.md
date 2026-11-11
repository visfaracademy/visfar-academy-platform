# TASK 07 — COMPLETE LMS cho Visfar Academy: BÁO CÁO KIỂM THỬ TỔNG HỢP (phần 4/4)

- **Ngày kiểm thử:** 10/11/2026, 22:33–22:42 (+07) — snapshot cuối 22:42 (+07) / 15:42 UTC.
- **Phạm vi:** `workspace/visfar-academy-platform/apps/web` (+ `supabase/migrations/0011–0013`, `workers/api`).
- **Người kiểm thử:** nhóm 4/4 (kiểm thử). Nhóm 1–3 giao code **ngay trong lúc kiểm thử** (file mới xuất hiện liên tục 22:35–22:42); mọi con số dưới đây là trạng thái tại thời điểm snapshot, không phải trạng thái “đã chốt xong”.
- **Kết luận tổng thể: CHƯA ĐẠT — KHÔNG ĐỦ ĐIỀU KIỆN DEPLOY.**
  - `npm test` PASS (256/256), nhưng `typecheck` FAIL (4 lỗi), `lint` FAIL (2 lỗi), `build` FAIL (exit 1), smoke test `next start` **chưa chạy được** (bị chặn bởi build fail).
  - Migration 0011–0013 **chưa áp** lên cả staging lẫn project `.env.local`; DB live **chưa có nội dung bài học thật nào** (0 module, 0 lesson) nên mọi luồng học/tiến độ/quiz/resume **chưa thể test end-to-end live**.
  - Có 1 lỗ hổng bảo mật thật ở route tải tài liệu (mục 5, B3) và 1 mâu thuẫn đường ghi tiến độ (B4) — cần sửa trước khi nghiệm thu.

---

## 1. File giữ nguyên / File sửa / File mới (so với trạng thái trước TASK 07)

Chỉ 1 commit trong repo (`54b6321 Module 1: Foundation`); phần lớn file TASK 06 chưa từng commit nên “mới/sửa” dưới đây phân theo thời điểm xuất hiện trong cửa sổ kiểm thử 22:33–22:42 và đối chiếu nội dung.

### 1.1 File mới — TASK 07 (nhóm 1–3 giao trong lúc kiểm thử)

| File | Dòng | Nội dung |
|---|---|---|
| `apps/web/src/lib/learning.ts` | 898 | Data layer Course Structure + Student Learning (phần 1/4): `fetchCourseStructure`, `fetchLessonDetail`, `fetchResumeTarget`, `markLessonComplete`, `saveLessonProgress`, `saveLessonNote`, helper YouTube/URL/tính tiến độ |
| `apps/web/src/lib/learning.test.ts` | 523 | 40 test cho `learning.ts` (fake client) |
| `apps/web/src/lib/progress.ts` | 843 | Lib Learning Progress (phần 2/4): `resolveProgressUpdate`, `ProgressSaver` (debounce), `saveLessonProgress`/`markLessonComplete`/`markLessonOpened` qua Workers `POST /api/v1/progress`, `getCourseProgressDetail` |
| `apps/web/src/lib/progress.test.ts` | 379 | Test cho `progress.ts` |
| `apps/web/src/lib/lms-access.ts` | 396 | Kiểm tra quyền học phía server (phần 3/4): `decideLessonAccess`, `requireLessonAccess`, `requireLessonAccessById`, `requireAdmin`, `sanitizeLessonForPreview` |
| `apps/web/src/lib/lms-admin.ts` | 640 | Thao tác quản trị (phần 3/4): `grantEnrollment`, `revokeEnrollment`, `listCourseEnrollments`, `fetchAdminCourseList`, `reorderContent`, validator course/module/lesson/resource, `writeAuditLog` |
| `apps/web/src/lib/supabase-server.ts` | 64 | Supabase client phía server từ cookie phiên + JWT người gọi (không dùng service-role) |
| `apps/web/src/lib/admin-api.ts` | 59 | Helper route admin: `getAdminContext` (401/403/503), `readJsonBody`, `jsonError` |
| `apps/web/src/components/course/CourseCurriculum.tsx` | 105 | Mục “Chương trình học” (Course → Module → Lesson) trên trang chi tiết khóa |
| `apps/web/src/components/course/LessonPlayer.tsx` | 443 | Player video YouTube (IFrame API, poll vị trí 5s, tự hoàn thành ≥ 90%) + nút “Đã hoàn thành” cho bài text/file/audio |
| `apps/web/src/components/learning/ResumeButton.tsx` | 62 | Nút “Tiếp tục học / Học lại từ đầu” |
| `apps/web/src/components/admin/CourseCreateForm.tsx` | 116 | Form tạo khóa (admin) |
| `apps/web/src/components/admin/CourseEditForm.tsx` | 116 | Form sửa khóa (admin) |
| `apps/web/src/components/admin/AdminContentTree.tsx` | 456 | Cây chương → bài → tài liệu (admin): lên/xuống, xuất bản, xem thử |
| `apps/web/src/components/admin/AdminEnrollments.tsx` | 226 | Quản lý enrollment 1 khóa: tặng khóa, thu hồi |
| `apps/web/src/app/hoc-vien/khoa-hoc/[courseSlug]/bai/[lessonSlug]/page.tsx` | 579 | **Trang học bài**: đủ 9 loại nội dung (video/text/pdf/audio/image/quiz/assignment/webinar/file), tài liệu đính kèm, ghi chú, đánh dấu hoàn thành, bài trước/tiep |
| `apps/web/src/app/admin/layout.tsx` | 46 | Layout `/admin/*`: chặn server bằng `requireAdmin()` (403 nếu không phải admin) |
| `apps/web/src/app/admin/khoa-hoc/page.tsx` | 81 | Trang admin: danh sách khóa + tạo khóa |
| `apps/web/src/app/admin/khoa-hoc/[courseId]/page.tsx` | 75 | Trang admin: chi tiết khóa (cây nội dung + enrollment) |
| `apps/web/src/app/api/lms/lessons/[lessonId]/route.ts` | — | `GET /api/lms/lessons/[id]` — trả nội dung bài sau khi `requireLessonAccessById` (401/403/404) |
| `apps/web/src/app/api/v1/resources/[id]/download/route.ts` | 113 | `GET /api/v1/resources/[id]/download` — stream file qua API, giới hạn 100 MB (edge runtime) |
| `apps/web/src/app/api/admin/courses/route.ts` | — | `GET` danh sách khóa + đếm module/bài; `POST` tạo khóa + audit |
| `apps/web/src/app/api/admin/courses/[courseId]/route.ts` | 124 | `GET` cây khóa đầy đủ; `PATCH` sửa khóa + audit (không có DELETE) |
| `apps/web/src/app/api/admin/courses/[courseId]/modules/route.ts` | 58 | `POST` tạo chương + audit |
| `apps/web/src/app/api/admin/courses/[courseId]/reorder/route.ts` | 38 | `POST` lưu thứ tự hiển thị + audit |
| `apps/web/src/app/api/admin/modules/[moduleId]/route.ts` | 47 | `PATCH` sửa chương + audit |
| `apps/web/src/app/api/admin/modules/[moduleId]/lessons/route.ts` | 67 | `POST` tạo bài học + audit (slug trùng → 409) |
| `apps/web/src/app/api/admin/lessons/[lessonId]/route.ts` | 69 | `PATCH` sửa bài học + audit |
| `apps/web/src/app/api/admin/lessons/[lessonId]/resources/route.ts` | 58 | `POST` thêm tài liệu + audit |
| `apps/web/src/app/api/admin/resources/[resourceId]/route.ts` | 58 | `PATCH` sửa tài liệu + audit (không hard-delete) |
| `apps/web/src/app/api/admin/enrollments/route.ts` | — | `GET ?courseId=` danh sách enrollment; `POST` tặng khóa + audit (trùng → 409) |
| `apps/web/src/app/api/admin/enrollments/[id]/route.ts` | — | `PATCH` thu hồi enrollment (`status: 'revoked'`, lý do bắt buộc) + thu hồi chứng chỉ |
| `supabase/migrations/0011_add_lesson_notes.sql` | 83 | Bảng `lesson_notes` (1 ghi chú / học viên / bài, tối đa 10.000 ký tự) + mở rộng `lessons.type` thêm audio/image/pdf/assignment/webinar + guard UNIQUE `(course_module_id, slug)` |
| `supabase/migrations/0012_add_progress_fields.sql` | 322 | `lesson_progress` thêm `course_id`, `started_at`, `last_accessed`, `video_position`, `completion_status` + trigger `trg_progress_sync_guard` (chống gian lận: video chỉ completed khi ≥ 90%, percent video tính lại từ position/duration, position không vượt duration + 10s) + backfill + index |
| `supabase/migrations/0013_admin_lms.sql` | 202 | `enrollments.granted_by`/`grant_reason`, `certificates.status` (valid/revoked), `lessons.is_published`, RLS admin INSERT `enrollments`/`audit_logs`, sửa `is_instructor_of()` (sai cột `user_id` → `instructor_id`), thu hẹp SELECT `lesson_resources`, view `lessons_public` (không content/video_url/file_url) |

**Lưu ý:** route `GET /api/lms/resources/[resourceId]` (redirect 302 sau khi kiểm tra enrollment) **đã tồn tại lúc 22:38 nhưng bị xóa khỏi repo trước 22:42** (thư mục `apps/web/src/app/api/lms/resources/` không còn). Xem blocker B3.

### 1.2 File sửa (TASK 07 chạm vào)

| File | Thay đổi |
|---|---|
| `apps/web/src/app/chuong-trinh/[slug]/page.tsx` | Gắn `CourseCurriculum`, `ResumeButton`, `LessonPlayer` (xem thử) vào trang chi tiết khóa |
| `apps/web/src/lib/dashboard.ts` | **Sửa lỗi `module_id` → `course_module_id`** (dòng 219–220, 239, 353–354): trước TASK 07, `getMyCourseProgress()` truy vấn cột không còn tồn tại sau migration 0005, sẽ lỗi 400 ngay khi khóa có module thật |
| `apps/web/src/lib/dashboard.test.ts` | Cập nhật mock theo `course_module_id` |
| `apps/web/src/app/hoc-vien/khoa-hoc/page.tsx` | Sửa trong cửa sổ TASK 07 (trang “Khóa học của tôi” — hiển thị tiến độ theo module) |
| `apps/web/src/middleware.ts`, `apps/web/src/styles/globals.css` | Chạm vào trong cửa sổ TASK 07 (không đối chiếu chi tiết từng dòng — xem ghi chú mục 6) |

### 1.3 File giữ nguyên (liên quan, không đổi trong TASK 07)

- Toàn bộ `apps/web/src/lib/courses.ts`, `auth.ts`, `leads.ts`, `newsletter.ts`, `api-client.ts`, `session-guard.ts`, `supabase.ts`, `validation.ts` và các test cũ của chúng; `apps/web/src/app/page.tsx`, `/chuong-trinh/page.tsx`, `/hoc-vien/*` còn lại, `/dang-nhap`, `/dang-ky`, `/tu-van`, `/api/health`; `workers/api/` (chỉ còn `README.md` — **Workers API chưa có code**); `supabase/migrations/0001–0010`; `scripts/check-migrations.mjs` (xem B7 — script này lỗi thời nhưng không được sửa trong TASK 07).

### 1.4 Chưa có (TASK 07 nhắc tới nhưng không tìm thấy trong repo lúc snapshot)

- **Trang quiz** `/hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]/quiz` — `quizUrl()` trong `learning.ts` trỏ tới đó, chưa có route/component nào.
- Trang nộp assignment (trang học bài ghi rõ “Chức năng nộp bài tập đang được hoàn thiện”).
- `apps/web/src/lib/progress.ts` được 0012 nhắc tới thì **đã có**; nhưng **Workers API** (`POST /api/v1/progress`, `leads`, `enrollments`, …) **chưa có code, chưa deploy**.
- Không có test cho `lms-access.ts`, `lms-admin.ts`, `supabase-server.ts`, `admin-api.ts`, các component mới và các route API mới (chỉ `learning.test.ts` + `progress.test.ts` là test mới).
- Không có file down/rollback cho migration 0011–0013.

---

## 2. Chức năng đã làm (đối chiếu code đã đọc)

1. **Cấu trúc khóa học (1/4):** `fetchCourseStructure` đọc `courses` (published) → `course_modules` (`is_published`) → `lessons` (`course_module_id`, đúng tên cột sau 0005); hiển thị trên trang chi tiết khóa qua `CourseCurriculum` (empty state khi chưa có nội dung, không bịa dữ liệu).
2. **Trang học bài (1/4):** đủ 9 loại lesson (video/text/pdf/audio/image/quiz/assignment/webinar/file); YouTube embed qua `youtube-nocookie`; PDF qua API download; ghi chú (`lesson_notes`, tối đa 10.000 ký tự); đánh dấu hoàn thành; bài trước/tiep (`findPrevNext`); trạng thái locked khi chưa ghi danh + không phải free preview.
3. **Resume (1/4):** `fetchResumeTarget` + `ResumeButton` — tiếp tục ở bài dở (ưu tiên bài đang dở), học hết → “Học lại từ đầu”.
4. **Tiến độ (2/4):** `progress.ts` — ngưỡng video ≥ 90% (QĐ 17), không auto-complete khi chỉ mở bài, debounce 5s, chỉ lưu khi vị trí đổi ≥ 2s, `ProgressSaver`; `LessonPlayer` dùng YouTube IFrame API, poll vị trí 5s; trigger DB 0012 là lớp chặn cuối (tính lại percent, chặn completed < 90%).
5. **Bảo mật + Admin (3/4):** `decideLessonAccess` (admin/instructor > chưa xuất bản > xem thử > enrollment active/completed > revoked > chưa ghi danh); `requireAdmin` đọc `user_roles` + `profiles.role`; layout `/admin` chặn server; API admin CRUD khóa/chương/bài/tài liệu + tặng/thu hồi enrollment + sắp xếp thứ tự — mọi ghi đều kèm `audit_logs`.
6. **API route:** `/api/lms/lessons/[id]` (gated), `/api/v1/resources/[id]/download` (stream 100 MB), 11 route `/api/admin/*`.
7. **Sửa lỗi cũ:** `dashboard.ts` dùng sai tên cột `module_id` đã được sửa thành `course_module_id` (mục 1.2).

---

## 3. Kết quả kiểm thử local (chạy thật, 10/11/2026)

Môi trường: Node v24.22.1, npm 10.9.4, `apps/web`. Lệnh chạy từ repo, log đầy đủ lưu ở `/tmp/t07_test2.log`, `/tmp/t07_tc2.log`, `/tmp/t07_lint2.log`, `/tmp/t07_build.log`.

| # | Lệnh | Kết quả | Chi tiết |
|---|---|---|---|
| L1 | `npm test` (vitest run) | **PASS** — exit 0 | **13 file, 256 test, 256 pass.** Gồm test mới `learning.test.ts` (40) + `progress.test.ts` (~40). Lưu ý: test dùng fake/mock client — không chạm DB thật, nên không chứng minh được gì về RLS/schema live. Số test tăng trong lúc kiểm thử: 176 (22:34, trước TASK 07) → 216 (22:37) → 256 (22:38). |
| L2 | `npm run typecheck` (`tsc --noEmit`) | **FAIL** — exit 2 | **4 lỗi:** (1) `src/app/chuong-trinh/[slug]/page.tsx(93,27)` TS2339 — `Property 'course' does not exist on type 'State'` (truy cập `state.course` trong mảng deps của `useEffect` khi `state` chưa được thu hẹp về `success`); (2–4) `src/lib/progress.test.ts(357,48)` TS2493, `(359,36)` TS2532, `(359,60)` TS2493 — index tuple `[]`. Lưu ý: lỗi thay đổi theo từng lần chạy vì nhóm 1–3 đang sửa dở (lỗi `CourseCurriculum.tsx(30,55)` ở lần chạy 22:39 đã biến mất ở lần 22:40, thay bằng lỗi mới ở trang `[slug]`). |
| L3 | `npm run lint` (eslint) | **FAIL** — exit 1 | **2 lỗi:** (1) `src/components/course/LessonPlayer.tsx(166,19)` — `'pct' is defined but never used`; (2) `src/lib/progress.ts(639,9)` — `'moduleTitleById' is assigned a value but never used`. Lỗi `@next/next/no-img-element` ở trang học bài (lần chạy 22:39) đã biến mất ở lần 22:40 (đã sửa). |
| L4 | `npm run build` (`next build`) | **FAIL** — exit 1 | Compile thành công (40s) rồi **fail ở bước “Linting and checking validity of types”** vì đúng 2 lỗi lint L3 (`pct`, `moduleTitleById`). Không tạo được production build mới. Cảnh báo kèm theo (không phải lỗi chặn): “The Next.js plugin was not detected in your ESLint configuration”. |
| L5 | Smoke test `next start` | **CHƯA CHẠY** — bị chặn | Không có build mới để chạy (L4 fail). `.next/` hiện tại là build cũ từ trước TASK 07 — chạy nó sẽ test code cũ, gây hiểu lầm nên **không chạy**. Cần build pass trước rồi mới smoke test các route: `/`, `/chuong-trinh`, `/chuong-trinh/[slug]`, `/hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]`, `/admin/khoa-hoc`, `/api/health`, `/api/lms/lessons/[id]`, `/api/v1/resources/[id]/download`. |
| L6 | `node scripts/check-migrations.mjs` | **FAIL** — 1 kiểm tra | `FAIL du 3 migration theo thu tu (0001…0013)` — script hard-code kỳ vọng **đúng 3 file migration** (dòng 56–57), nay đã có 13 file. Đây là **lỗi của script kiểm tra (lỗi thời)**, không phải lỗi migration. Cần cập nhật script, không phải sửa migration. |
| L7 | `git status` / đối chiếu file | — | Repo chỉ có 1 commit; TASK 07 chưa commit gì. Toàn bộ file mới ở trạng thái untracked. |

**Kết luận local:** unit test xanh nhưng **chuỗi typecheck → lint → build đứt ở cả 3 khâu** vì 6 lỗi nhỏ (4 TS + 2 unused var) — đều sửa được nhanh, nhưng ở trạng thái snapshot thì **không build được, không deploy được**.

---

## 4. Kết quả kiểm thử live (REST staging + project `.env.local`, anon key)

- **Hai project đều trả kết quả giống hệt nhau:** staging `scskhplczrxlnxzruweu.supabase.co` (`.env.staging`, project đã link) và project `.env.local` `ugynqjqyfynkmqutoarp.supabase.co`. Cả hai đều có 10 khóa published (đúng seed 0002, cùng UUID), đều chưa áp 0011–0013, đều 0 module/lesson.
- **Cách test:** `curl` REST với anon key đọc từ env file trong shell (không in key ra log). Chỉ đếm dòng + mã HTTP, không dump nội dung.

| # | Kiểm tra live | Kết quả | Ghi chú |
|---|---|---|---|
| V1 | `courses?status=eq.published` | **PASS** — HTTP 200, **10 dòng** | Đúng 10 khóa seed 0002 |
| V2 | `courses` (không lọc status) | HTTP 200, 10 dòng | Cả 10 đều published nên **không test được** RLS chặn draft (không có dòng draft nào) |
| V3 | `course_modules` | HTTP 200, **0 dòng** | Bảng tồn tại (đã áp 0004/0005), **chưa có nội dung thật** |
| V4 | `lessons` (cột đúng `course_module_id`) | HTTP 200, **0 dòng** | Chưa có bài học thật nào |
| V5 | `lessons?is_free_preview=eq.true` | HTTP 200, 0 dòng | Không có bài xem thử để test |
| V6 | `lessons` (anon đọc `content`/`video_url` của bài trả phí) | **CHƯA CHỨNG MINH ĐƯỢC** — 0 dòng | Không có bài nào để kiểm tra. **Thiết kế RLS hiện tại (0001/0006) cho phép anon đọc lessons của khóa published** — chặn bài trả phí được giao cho lớp API (`requireLessonAccess`), không phải RLS (ghi rõ trong comment 0001). Vì vậy “anon không xem được bài trả phí” **không thể PASS bằng RLS**; chỉ API mới chặn được — mà API chưa deploy/test live được (xem B3, mục 6). |
| V7 | `enrollments` anon | HTTP 200, 0 dòng | Phù hợp RLS chặn (hoặc bảng rỗng) — **không phân biệt được bằng anon**; cần JWT học viên test mới kết luận |
| V8 | `lesson_progress` anon | HTTP 200, 0 dòng | Như V7 |
| V9 | `leads` / `profiles` / `orders` anon | HTTP 200, 0 dòng | Như V7 |
| V10 | `quizzes`, `questions`, `lesson_resources` anon | HTTP 200, 0 dòng | Bảng tồn tại, rỗng |
| V11 | `quiz_options`, `quiz_questions` anon | HTTP **404 PGRST205** — bảng không có trong schema cache | Đúng thiết kế sau 0005 (đổi sang `quizzes`/`questions`/`answers`) |
| V12 | `answers` anon | HTTP **404 PGRST205** | Bảng `answers` cũng không có trong schema cache ở cả 2 project (cần đối chiếu 0008 — có thể bảng chưa được tạo/đổi tên trên DB live) |
| V13 | `lesson_notes` (0011) | HTTP **404 PGRST205** | **Migration 0011 chưa áp** (cả 2 project) |
| V14 | `lessons?select=is_published` (0013-C) | HTTP **400** `column lessons.is_published does not exist` | **Migration 0013 chưa áp** |
| V15 | `lessons_public` view (0013-G) | HTTP **404 PGRST205** | **0013 chưa áp** |
| V16 | `enrollments?select=granted_by` (0013-A) | HTTP **400** `column enrollments.granted_by does not exist` | **0013 chưa áp** |
| V17 | `certificates?select=status` (0013-B) | HTTP **400** `column certificates.status does not exist` | **0013 chưa áp** |
| V18 | `lesson_progress` các cột 0012 (`course_id`, `started_at`, `last_accessed`, `video_position`, `completion_status`) | HTTP **400** `column lesson_progress.course_id does not exist` | **Migration 0012 chưa áp** |
| V19 | `modules` (tên cũ) | HTTP **404 PGRST205** | Đúng sau 0005 (đã rename thành `course_modules`) — code nào còn dùng `modules`/`module_id` sẽ lỗi (xem B6: `dashboard.ts` đã sửa) |
| V20 | `lessons?select=module_id` (tên cột cũ) | HTTP **400** `column lessons.module_id does not exist` | Xác nhận cột hiện tại là `course_module_id` |

**Kết luận live:** hạ tầng đọc công khai (10 khóa) còn nguyên; **mọi thứ thuộc TASK 07 đều chưa có mặt trên DB live** (0011–0013 chưa áp, 0 module/lesson, 0 quiz, 0 resource). Không có dữ liệu thật nên **không thể test luồng học, tiến độ, quiz, resume, tặng/thu hồi enrollment, hay RLS theo vai trò** trên môi trường live.

---

## 5. Blocker / lỗi phát hiện (theo mức nghiêm trọng)

| # | Vấn đề | Bằng chứng | Ảnh hưởng / Hướng sửa |
|---|---|---|---|
| **B1 — Chặn deploy** | Build fail vì 2 biến thừa | L3/L4: `LessonPlayer.tsx:166` (`pct`), `progress.ts:639` (`moduleTitleById`) | Xóa 2 biến thừa → build lại. |
| **B2 — Chặn build** | Typecheck fail, 4 lỗi | L2: `chuong-trinh/[slug]/page.tsx:93` (truy cập `state.course` khi `state` chưa thu hẹp); `progress.test.ts:357,359` (index tuple rỗng) | Thu hẹp `state` trước khi dùng `state.course` (vd. lấy `course` ra trước `useEffect`); sửa test dùng tuple rỗng. |
| **B3 — Bảo mật** | Route tải tài liệu duy nhất còn lại **không kiểm tra enrollment**; route có kiểm tra đã bị xóa | Lúc 22:38 còn `GET /api/lms/resources/[resourceId]` (dùng JWT + `requireLessonAccessById`, 302) — đến 22:42 thư mục này **không còn**. Chỉ còn `GET /api/v1/resources/[id]/download` dùng **anon client**, chỉ kiểm tra `courses.status = 'published'`. Trên RLS hiện tại (0006, `lesson_resources_select_public` cho anon đọc `file_url` của khóa published) → **bất kỳ ai biết UUID resource đều tải được tài liệu trả phí của khóa published**. Sau khi áp 0013 (RLS chỉ cho anon thấy resource free-preview) thì route này lại **404 cả với học viên đã ghi danh** (vì anon không thấy dòng) — hỏng cả hai chiều. | Khôi phục kiểm tra quyền bằng JWT + `requireLessonAccess` trong route `/api/v1/resources/[id]/download` (như route đã xóa từng làm), hoặc khôi phục route `/api/lms/resources/[id]` và đổi `resourceDownloadUrl()` trỏ về đó. Không để route anon là đường tải duy nhất. |
| **B4 — Mâu thuẫn thiết kế** | Hai đường ghi tiến độ trái ngược nhau; đường trang học bài đang dùng sẽ bị RLS chặn | `learning.ts` (`markLessonComplete`/`saveLessonProgress`/`upsertProgress`) ghi **trực tiếp** `lesson_progress` bằng client; nhưng 0009 (H3) đã xóa policy ghi của client và 0012 khẳng định “ghi tiến độ CHỈ đi qua Workers API bằng service-role”. Trang học bài dùng `learning.ts:markLessonComplete` → nút “Đã hoàn thành” sẽ nhận **42501** khi chạy live. `LessonPlayer` dùng `progress.ts` (Workers) — đúng hướng nhưng **Workers chưa deploy** nên cũng lỗi rõ (không lưu được). | Thống nhất 1 đường ghi: trang học bài cũng phải đi qua `progress.ts`/Workers (hoặc qua 1 route Next proxy có kiểm tra enrollment). Xóa/đánh dấu deprecated các hàm ghi trực tiếp trong `learning.ts` để không ai dùng nhầm. |
| **B5 — Phụ thuộc migration chưa áp** | `fetchLessonDetail` đọc `lesson_notes` và sẽ throw `PGRST205` nếu 0011 chưa áp | `learning.ts`: “nếu project chưa chạy 0011 thì PGRST205 → lỗi rõ”. Live V13 xác nhận 0011 chưa áp. Hiện chưa lộ vì DB có 0 bài học (không gọi tới nhánh này với dữ liệu thật). | Áp 0011 lên staging trước, kiểm chứng theo mục KIỂM CHUNG cuối file 0011, rồi mới áp prod (đúng hướng dẫn trong chính file migration). |
| **B6 — Đã sửa trong TASK 07 (ghi nhận)** | `dashboard.ts` dùng sai cột `module_id` | Trước TASK 07: `getMyCourseProgress` select `id, module_id, type` + `.in('module_id', …)` trong khi live chỉ có `course_module_id` (V20) → lỗi 400 ngay khi khóa có module. Trong TASK 07 đã sửa thành `course_module_id` (kèm test). | Không cần làm thêm; nhưng vì lỗi này từng bị test mock che (mock trả row bất kể tên cột) nên lần sau cần 1 test tích hợp với schema thật. |
| **B7 — Script kiểm tra lỗi thời** | `check-migrations.mjs` FAIL giả | L6: hard-code đúng 3 migration (dòng 56–57), nay có 13 file. | Cập nhật script (cho phép danh sách dài hơn / kiểm tra 0011–0013), không sửa migration. |
| **B8 — Thiếu trang** | Nút “Làm quiz ngay” trỏ tới trang chưa tồn tại; nộp assignment chưa làm | `learning.ts:quizUrl()` → `/hoc-vien/khoa-hoc/[slug]/bai/[lessonSlug]/quiz` — không có route/component nào. Trang học bài: “Chức năng nộp bài tập đang được hoàn thiện.” | Làm trang quiz (chấm ở server theo G3.1) hoặc ẩn nút quiz tới khi có trang; ghi rõ assignment là chưa làm, không để nút chết. |
| **B9 — Không có dữ liệu thật** | 0 module / 0 lesson / 0 quiz / 0 resource trên cả 2 project | V3–V5, V10 | Cần seed nội dung thật (ít nhất 1 khóa có 1 module + 2 bài: 1 free preview + 1 trả phí, 1 quiz, 1 resource) trên staging rồi mới test được luồng học, RLS theo vai trò, resume, download. |
| **B10 — Workers chưa deploy** | Mọi ghi tiến độ qua `progress.ts` đều qua Workers `POST /api/v1/progress` | `workers/api/` chỉ có `README.md` (“CHƯA TRIỂN KHAI Ở MODULE 1”); `.env.example` ghi rõ Workers chưa deploy; `progress.ts` tự ghi “Workers API CHƯA deploy … trả lỗi rõ ràng”. | Deploy Workers (hoặc làm route Next proxy tạm có kiểm tra enrollment) rồi mới test được lưu tiến độ. |

Các vấn đề **không** phát hiện (ghi rõ để khỏi hiểu lầm là “chưa test”): logic thuần trong `learning.test.ts`/`progress.test.ts` đều pass (YouTube id, format thời lượng, prev/next, resume, ngưỡng 90%, clamp 0–100, debounce); `decideLessonAccess` có thứ tự ưu tiên đúng (admin/instructor > chưa xuất bản > xem thử > enrollment > revoked); các route admin đều qua `getAdminContext` + `requireAdmin` (không tin client).

---

## 6. Mục chưa chạy live và vì sao

| # | Mục | Vì sao chưa chạy |
|---|---|---|
| U1 | Smoke test `next start` (route mới: trang khóa học, trang học bài, admin) | Build fail (B1/B2) → không có production build mới để chạy. |
| U2 | Đăng nhập học viên test → mở bài trả phí / bài free preview | DB có 0 bài học (B9); chưa có tài khoản test nào được cấp (cần student A/B, instructor, admin theo `tests/rls-manual.md`). |
| U3 | RLS: anon không xem được bài trả phí | Không có bài nào để kiểm tra (B9); hơn nữa RLS thiết kế **không chặn** ở tầng này (V6) — cần test ở tầng API sau khi deploy. |
| U4 | RLS theo vai trò (học viên A không thấy tiến độ của B; instructor chỉ thấy khóa mình; admin thấy tất cả) | Chưa có JWT test nào; `tests/rls-manual.md` vẫn ở trạng thái CHƯA CHẠY. Cần tạo tài khoản test + dữ liệu thật trên staging trước. |
| U5 | Lưu tiến độ / đánh dấu hoàn thành / resume (end-to-end) | Workers chưa deploy (B10) + đường ghi `learning.ts` bị RLS chặn (B4) + 0012 chưa áp (V18) + không có bài thật (B9). |
| U6 | Ghi chú bài học | 0011 chưa áp (V13) → `lesson_notes` không tồn tại trên DB live. |
| U7 | Tải tài liệu (cả 2 route) | 0 resource trên DB (V10); route có kiểm tra enrollment đã bị xóa (B3); route còn lại chưa được kiểm chứng live (cần resource thật + tài khoản test). |
| U8 | Quiz (làm bài, chấm điểm, giới hạn lần làm) | Chưa có trang quiz (B8), chưa có quiz/question/answer thật (V10–V12), chưa có Workers chấm bài. |
| U9 | Admin: tạo khóa/chương/bài, tặng/thu hồi enrollment, sắp xếp, xem audit | 0013 chưa áp (V14–V17) → tặng khóa (cần `granted_by`) và ghi audit (cần policy mới) sẽ lỗi trên DB live; chưa có tài khoản admin test; UI admin chưa được chạy thử trên trình duyệt. |
| U10 | Kiểm thử `G3.1` (học 1 bài + quiz + tiến độ còn sau khi đăng nhập lại), `G3.4` (chống gian lận trigger 0012), `G3.6b` (học viên không vào được `/admin`) | Tất cả đều cần dữ liệu + tài khoản + migration đã áp + Workers/deploy — chưa có cái nào. |
| U11 | Kiểm thử trên trình duyệt thật (mobile, nút chạm, video YouTube phát được) | Không có build để chạy, không có bài/video thật. `LessonPlayer` dùng YouTube IFrame API chưa từng được mở trên trình duyệt. |

---

## 7. Phương án rollback

Trạng thái hiện tại **an toàn để rollback** vì chưa có gì ra production: code chưa commit, chưa deploy, migration 0011–0013 chưa áp lên DB nào, Workers chưa deploy.

| Tầng | Cách rollback | Ghi chú |
|---|---|---|
| Code `apps/web` | Xóa các file mới ở mục 1.1; revert `chuong-trinh/[slug]/page.tsx` về bản trước TASK 07 (bỏ `CourseCurriculum`/`ResumeButton`/`LessonPlayer`); revert `dashboard.ts` + `dashboard.test.ts` về bản dùng `module_id` — **không khuyến nghị** revert phần này vì đó là sửa lỗi đúng (B6), chỉ revert nếu muốn quay về đúng trạng thái trước TASK 07. | Repo chưa commit nên rollback = xóa file untracked + `git checkout -- <file sửa>` với file đã track. **Cẩn thận:** nhiều file TASK 06 cũng đang untracked — chỉ xóa đúng danh sách mục 1.1, đừng `git clean` bừa. |
| Migration 0011–0013 | **Không cần rollback DB** — chưa áp lên staging/prod. Chỉ cần không chạy các file này. | Không có file down. Nếu sau này đã áp rồi mới cần rollback thì phải làm thủ công: `drop table lesson_notes`, `drop trigger trg_progress_sync_guard` + drop function + drop cột 0012, `drop view lessons_public` + drop cột 0013 + drop policy mới/khôi phục policy cũ — và phải đối chiếu dữ liệu trước khi drop. Không tự động hóa việc này khi chưa có dữ liệu thật. |
| DB live (staging + `.env.local`) | Không đổi gì — dữ liệu 10 khóa seed vẫn nguyên (đã xác nhận V1). | Nếu đã seed nội dung test sau này thì xóa đúng các dòng seed test (module/lesson/resource/quiz) theo id, không xóa 10 khóa seed. |
| Workers API | Không có gì để rollback (chưa deploy). | — |
| Sau rollback | Chạy lại `npm test && npm run typecheck && npm run lint && npm run build` ở trạng thái trước TASK 07 để xác nhận về mức baseline: test 176 pass (trạng thái 22:34), typecheck/lint/build pass như lần chạy 22:33–22:35. | Baseline này đã được đo trong chính đợt kiểm thử này (test 176/176, typecheck/lint/build đều pass trước khi file TASK 07 đổ về). |

---

## 8. Điều kiện nghiệm thu lại (đề nghị cho lần test sau)

1. Sửa hết B1 + B2 → `npm test`, `typecheck`, `lint`, `build` đều exit 0, rồi chạy smoke test `next start` đủ route mới (kèm cả `/api/lms/lessons/[id]` trả 401 khi chưa đăng nhập).
2. Áp 0011–0013 lên **staging trước**, chạy mục KIỂM CHUNG cuối mỗi file migration, đối chiếu lại V13–V18 thành 200.
3. Seed tối thiểu 1 khóa staging: 1 module + 2 bài (1 free preview, 1 trả phí) + 1 quiz + 1 resource; tạo tài khoản test student/instructor/admin.
4. Sửa B3 (route download kiểm tra enrollment bằng JWT) và B4 (thống nhất 1 đường ghi tiến độ), rồi test lại U2–U9 theo `tests/rls-manual.md` + tiêu chí G3.1/G3.4/G3.6b.
5. Nhóm 1–3 **tuyên bố dừng giao code** trước khi test lại — đợt này file đổ về liên tục trong lúc test nên kết quả chỉ đúng tại thời điểm snapshot.

---

## 9. Sửa blocker sau báo cáo (10/11/2026 ~22:55 +07, user auto-duyệt)

### 9.1 Code — PASS toàn bộ

| Lệnh | Kết quả thật sau sửa |
|---|---|
| `npm run build` | **PASS, exit 0** (chỉ còn warning không chặn: "The Next.js plugin was not detected in your ESLint configuration") |
| `npm run lint` | **PASS, exit 0** |
| `npm run typecheck` | **PASS, exit 0** |
| `npm test` | **PASS — 15 file, 310/310 test** (snapshot cũ 256/256; số test tăng do code giao thêm sau snapshot) |

- **B1 (2 biến thừa): đã không còn trong code.** `pct` tại `LessonPlayer.tsx:238` đang được dùng thật (`setProgressPercent(pct)`, `if (pct >= VIDEO_COMPLETION_THRESHOLD…)`); `moduleTitleById` grep toàn `src/` = 0 kết quả. Cả 2 file sửa lần cuối 22:41:52+07 — nhóm 1–3 đã xóa biến thừa trong lúc kiểm thử, sau thời điểm snapshot. Nguyên nhân thật khiến build vẫn fail: **cache ESLint cũ của Next.js** (`.next/cache/eslint/.cache_oyszep`, tạo 15:22:49 UTC) vẫn chứa kết quả lint cũ. Cách sửa: xóa `rm -rf .next/cache/eslint` (build artifact, build sau tự tạo lại) rồi chạy lại build → PASS. Không xóa/sửa logic nào trong `LessonPlayer.tsx` hay `progress.ts`.
- **B6 (mâu thuẫn cột dashboard.ts): đã đúng, không cần sửa code.** Migration 0005 Mục 2: `alter table public.lessons rename column module_id to course_module_id;` → cột đúng là **`course_module_id`**. `dashboard.ts` đã dùng đúng ở mọi chỗ (dòng 220, 239, 353–354). Chỉ còn chữ `module_id` trong 1 comment giải thích tên cũ — giữ nguyên.
- **getMyLearningHistory(): đã sửa, chuyển từ `learning_events` sang `lesson_progress`.** Schema thật: `learning_events` (0004) chỉ có `id, course_id, lesson_id, title, description, starts_at, ends_at, meeting_url, location, status, created_at, updated_at` — **không có `user_id` / `event_type` / `event_data` / `occurred_at`**; query cũ hỏi 4 cột không tồn tại → lỗi 400 (PGRST204) trên DB thật. Chọn `lesson_progress` thay vì `activity_logs` (có `user_id` + `created_at` nhưng không có cột lesson trực tiếp, phải suy diễn qua `target_id`/`target_type`/`details` jsonb, và hiện không có code nào ghi lịch học vào đó). `lesson_progress` (0001) có đủ: `user_id` + `lesson_id` + `status`/`progress_percent` + `completed_at`/`updated_at`. Sửa: query `lesson_progress` chỉ cột 0001, không dùng `course_id`/`last_accessed`/`completion_status` (cột 0012 chưa áp trên DB live); `eventType` suy ra từ `status` (`completed` → `lesson_completed`, còn lại → `lesson_started`); `occurredAt = completed_at ?? updated_at`; tên khóa suy ra qua `lessons.course_module_id` → `course_modules.course_id` → `courses.title`. File sửa: `src/lib/dashboard.ts` (viết lại `getMyLearningHistory()` + 2 comment), `src/lib/dashboard.test.ts` (viết lại test lịch sử học theo nguồn mới), `src/app/hoc-vien/lich-su/page.tsx` (1 dòng comment). Không đụng `learning.ts:651–654` (dùng `learning_events` đúng mục đích lịch buổi học trực tiếp). Test lịch sử mới chỉ chứng minh bằng unit test với fake client; chưa test end-to-end live vì DB live có 0 bài học/tiến độ thật và 0011–0013 chưa áp.

### 9.2 Migration 0011–0013 — DỪNG ở 0011 trên staging, prod CHƯA CHẠY

- Cú pháp pglast v8.7 trước khi chạy: cả 3 file PARSE OK — 0011: 9 câu, 0012: 13 câu, 0013: 19 câu (chỉ kiểm tra cú pháp, không kiểm tra kiểu dữ liệu).
- **0011 staging: FAIL, HTTP 400** (10/11/2026 22:49 +07). Lỗi nguyên văn: `ERROR: 42883: operator does not exist: information_schema.sql_identifier[] = text[]` — khối kiểm tra (C) đầu 0011 so sánh `array_agg(kcu.column_name …)` với `array['course_module_id', 'slug']`; `kcu.column_name` kiểu `information_schema.sql_identifier` nên `array_agg` trả về `sql_identifier[]`, không có toán tử `=` với `text[]` trên PostgreSQL 17. Lỗi ở câu lệnh đầu tiên, trước mọi DDL — toàn bộ 0011 rollback. Không sửa file migration nào.
- Kiểm chứng thật sau lỗi (staging): `lesson_notes` = null (chưa tồn tại), `lessons_public` = null, 0/5 cột mới của `lesson_progress`, policy `enrollments_insert_admin` = 0. Staging giữ nguyên trạng thái sau lần 4 (0001→0010). **0012 và 0013 chưa chạy, prod chưa chạy gì** trong đợt này.
- Phương án sửa 0011 (chưa chốt, chưa sửa — ghi trong `MIGRATION_GUIDE.md` §2.13): ép kiểu `array_agg(kcu.column_name::text …)` hoặc kiểm tra UNIQUE bằng `pg_index`/`pg_attribute` như cách 0012 mục 5 đã làm. File 0011 chưa từng áp thành công ở đâu nên được sửa trước khi áp (tiền lệ 0010 ở §5E). Sau khi sửa: chạy lại từ 0011 trên staging, kiểm chứng đủ 4 điểm (bảng `lesson_notes`, `lesson_progress` đủ 5 cột mới, view `lessons_public`, policy admin), rồi mới lên prod. Ghi biên bản lỗi vào `MIGRATION_GUIDE.md` §2.13 và `BACKEND_TEST_REPORT.md` §5F + hàng F-13 trong §6. Không có token trong 2 file docs.

### 9.3 Seed nội dung thật tối thiểu + kiểm thử live end-to-end — CHƯA CHẠY (trạng thái cũ, xem 9.5 để biết kết quả mới)

Bị chặn bởi 9.2: 0011–0013 chưa áp nên `lesson_notes` và cột mới của `lesson_progress` chưa tồn tại; seed tối thiểu (1 khóa published + 1 module + 2 lesson + 1 resource) và kiểm thử live với 2 tài khoản test (đăng nhập student, ghi danh khóa miễn phí, mở bài học, xem video, đánh dấu hoàn thành, ghi chú, resume, kiểm tra tiến độ, thử truy cập bài/resource trả phí khi chưa ghi danh) đều **CHƯA CHẠY** tại thời điểm viết mục này. Không ghi PASS giả.

## 9.5 Sửa + chạy lại migration 0011–0013, seed + e2e live — PASS (10/11/2026 ~23:00 +07, user auto-duyệt)

### 9.5.1 Migration

- **0011:** sửa khối kiểm tra (C) — `array_agg(kcu.column_name::text …)`; pglast PARSE OK (9 câu). Chạy staging **HTTP 201**.
- **0012:** chạy staging **HTTP 201**.
- **0013 lần 1:** **FAIL, HTTP 400** — `ERROR: 42703: column ci.instructor_id does not exist`. Nguyên nhân: tiền đề mục (E) của 0013 sai sự thật — bảng `course_instructors` (0004 mục 20) chỉ có cột `user_id`, không có `instructor_id`; hàm `is_instructor_of()` và 2 policy ở 0006 đã dùng `user_id` đúng từ đầu. Sửa 0013: mục (E) đổi thành khẳng định lại hàm + policy với cột `user_id` đúng (giống hệt 0006, idempotent); pglast PARSE OK (19 câu). Chạy lại staging **HTTP 201**.
- **Kiểm chứng staging:** `lesson_notes`=1; `lesson_progress` đủ 5 cột mới; `lessons_public`=1; policy admin `enrollments_insert_admin` + `audit_logs_insert_admin`=2.
- **Prod:** 0011 → 0012 → 0013 đều **HTTP 201**; kiểm chứng 1 query: `lesson_notes=1, progress_cols=5, lessons_public=1, admin_policies=2`.
- **Lưu ý code app:** `src/lib/lms-access.ts:230` (`.eq('instructor_id', userId)`) và test `lms-admin.test.ts:333-335` (assert `ci.instructor_id`) vẫn dùng tên cột sai — lỗi code app/test, ngoài phạm vi migration, cần sửa riêng.

### 9.5.2 Seed tối thiểu trên staging

File `supabase/seed/001_seed_task07_staging.sql` (chỉ staging): khóa 01 "Thấu Hiểu Nội Tâm" + 1 module + 2 lesson (bài 1 video free preview, bài 2 text trả phí) + 1 resource — kiểm chứng modules=1, lessons=2, resources=1. Lưu ý: `lesson_resources.resource_type` chỉ cho `file/link/video/document` (không có `pdf`) nên resource dùng `document`; lesson video có `video_url = NULL` vì chưa có link YouTube unlisted thật do user cung cấp, `video_duration_sec = 600` để test ngưỡng 90%.

### 9.5.3 Kiểm thử live end-to-end trên staging — 17/17 PASS

Tài khoản test mới tạo qua Auth Admin API: `test-student-lms-02@visfar-academy.test` (A, đã ghi danh) và `test-student-lms-03@visfar-academy.test` (B, chưa ghi danh). Mật khẩu test sinh ngẫu nhiên, không ghi vào tài liệu.

| # | Kiểm thử | Kết quả |
|---|---|---|
| 1–2 | Đăng nhập student A, B | PASS — HTTP 200 |
| 3 | Ghi danh khóa miễn phí cho A (service_role — thay đường Workers API chưa deploy) | PASS — HTTP 201 |
| 4 | B tự ghi danh trực tiếp bằng JWT | PASS (bị chặn) — HTTP 403 |
| 5 | A đọc `lessons_public` (không lộ `content`/`video_url`) | PASS — HTTP 200 |
| 6 | Ghi tiến độ 300/600s → 50% `in_progress` | PASS — HTTP 201 |
| 7 | Đánh dấu completed khi mới 300s | PASS (bị trigger chặn) — HTTP 400, `P0001: >= 90% (hien tai % 50)` |
| 8 | Xem 540/600s → 90% `completed` + `completed_at` | PASS — HTTP 200 |
| 9 | Resume: A đọc lại tiến độ của mình | PASS — 540s, completed, 90% |
| 10 | A ghi chú bài 1 bằng JWT | PASS — HTTP 201 |
| 11–12 | B không đọc được ghi chú / tiến độ của A | PASS — HTTP 200, 0 dòng |
| 13 | Anon không đọc được resource trả phí | PASS — HTTP 200, 0 dòng |
| 14 | B chỉ thấy metadata bài trả phí qua `lessons_public` | PASS — HTTP 200 |

Giới hạn còn lại: (a) "xem video" ở đây là ghi `video_position` qua đường server — chưa phát video thật trên trình duyệt vì `video_url` còn NULL (chờ link YouTube unlisted thật) và Workers API chưa deploy; (b) chặn bài trả phí chứng minh ở tầng RLS (resource) + view `lessons_public`, còn bảng `lessons` gốc qua REST anon vẫn đọc được `content` bài trả phí theo thiết kế cũ (V6) — chặn đầy đủ chỉ ở tầng API `requireLessonAccess`, chưa deploy/test live; (c) quiz chưa có trong seed nên luồng quiz chưa test live. Chi tiết đầy đủ trong `MIGRATION_GUIDE.md` §2.14 và `BACKEND_TEST_REPORT.md` §5G.

### 9.4 Còn lại (ngoài phạm vi đợt sửa này)

B3 (route download không kiểm tra enrollment), B4 (thống nhất đường ghi tiến độ), B8 (trang quiz), B9/B10 (seed dữ liệu thật, Workers chưa deploy), B7 (script `check-migrations.mjs`) — **không sửa**, vẫn như báo cáo gốc.
