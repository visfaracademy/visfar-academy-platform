# TASK 08 — Quiz / Assignment / Certificate cho Visfar Academy: BÁO CÁO KIỂM THỬ + TÍCH HỢP

- **Ngày kiểm thử:** 10/11/2026, 22:59–23:16 (+07) — snapshot cuối 23:16 (+07) / 16:16 UTC.
- **Phạm vi:** `workspace/visfar-academy-platform` (app `apps/web`, `supabase/migrations/0014–0016`, `workers/api`).
- **Người kiểm thử:** nhóm kiểm thử + tích hợp (TASK 08).
- **Lưu ý đường dẫn:** task giao ghi `docs/frontend/TASK08_REPORT.md` theo đường dẫn `apps/web/docs/...`, nhưng trong repo thật docs nằm ở **repo root** (`docs/frontend/TASK07_REPORT.md` cũng ở đó; `apps/web/docs/` không tồn tại). Báo cáo này ghi tại `docs/frontend/TASK08_REPORT.md` (repo root) cho khớp vị trí của TASK07_REPORT.
- **Lưu ý về quá trình giao code:** code TASK 08 **chưa có lúc bắt đầu kiểm thử (22:59 +07)** và đổ về liên tục trong lúc kiểm thử (migration 0014–0016 lúc 23:02–23:03, lib + route lúc 23:04–23:06, trang quiz/bài tập lúc 23:08–23:09, 1 file route còn sửa giữa lúc build 23:12). Mọi con số dưới đây là trạng thái tại **snapshot 23:16 +07, sau 90 giây không còn file nào thay đổi** — không phải trạng thái “đã chốt xong” nếu nhóm làm còn giao tiếp.

## Kết luận tổng thể: CODE ĐÃ ĐỦ, LOCAL PASS TOÀN BỘ — CHƯA ĐỦ ĐIỀU KIỆN DEPLOY/NGHIỆM THU LIVE

- **`npm test` PASS 393/393, `typecheck` PASS, `lint` PASS, `build` PASS** (sau 1 sửa lỗi test cũ + 1 lần build lại do cache/file sửa giữa lúc build — xem §3).
- **Kiểm tra bảo mật tĩnh PASS:** đáp án đúng không lộ xuống frontend (grep + test `toPublicPaper` + route GET chỉ đọc view công khai); chấm quiz ở server (hàm SQL SECURITY DEFINER, RPC); học viên chỉ đọc/nộp bài của mình (RLS + kiểm tra enrollment ở route); chứng chỉ chỉ cấp khi đủ điều kiện — **có test unit cho đúng trường hợp task yêu cầu** (mở video 95% `in_progress` → không cấp; quiz 60% < 70% → không cấp).
- **CHƯA NGHIỆM THU LIVE:** migration 0014–0016 **chưa áp** lên staging/prod (chỉ PARSE OK bằng pglast), Workers **chưa deploy**, DB live không có quiz/assignment thật, nên mọi luồng end-to-end (làm quiz, nộp bài, cấp chứng chỉ) **chưa chạy được trên môi trường thật**.
- **1 khoảng trống tích hợp thật (B-T08-5):** nộp quiz đạt **chưa đánh dấu bài quiz hoàn thành** — không có đường nào đưa bài quiz về `lesson_progress.status='completed'`. Vì điều kiện cấp chứng chỉ đòi 100% bài hoàn thành, **khóa nào có bài quiz thì hiện không thể cấp chứng chỉ** cho tới khi nối đường này. Trang học bài tự ghi nhận việc này (“sẽ được nối sau khi có đường ghi tiến độ qua Workers”).
- **1 lỗi cột sai bị lặp lại ở code mới (B-T08-2):** `assignment-server.ts:122` dùng `course_instructors.instructor_id` (cột không tồn tại) — cùng lỗi với `lms-access.ts:230` từ TASK 07.

---

## 1. File giữ nguyên / File sửa / File mới (so với snapshot TASK 07 lúc 22:42 +07)

Repo vẫn chỉ có 1 commit (`54b6321 Module 1: Foundation`); toàn bộ công việc TASK 06/07/08 vẫn ở trạng thái untracked.

### 1.1 File mới — TASK 08

| File | Dòng | Nội dung |
|---|---|---|
| `supabase/migrations/0014_quiz_bank.sql` | 552 | Ngân hàng câu hỏi + chấm bài: guard rename `answers→quiz_answers` / `quiz_options→question_options`, view `question_options_public` (không `is_correct`), `quizzes.shuffle_questions` + default `pass_score_percent=70`, mở CHECK `question_type` thêm `fill_blank` + `essay` (giữ `short_answer`), `quiz_attempts` thêm `quiz_id/status/passed/started_at/needs_review`, `quiz_answers` thêm `points_awarded/answered_at` + UNIQUE `(attempt_id, question_id, option_id)`, hàm SECURITY DEFINER `submit_quiz_attempt` (chấm server, kiểm tra enrollment, giới hạn lần làm, hết giờ +60s grace) |
| `supabase/migrations/0015_assignments.sql` | 476 | Bài tập: `assignments` thêm `assignment_type/allow_late_submission/status` + trigger đồng bộ `is_published↔status`; `submissions` thêm `content_text/is_late/graded_at` + CHECK mới (`draft/submitted/graded/returned`) + trigger chặn nộp muộn; bảng mới `submission_files` (+ RLS) ; `submission_reviews` CHECK mới (`graded/returned`) + trigger đồng bộ `submissions.status/graded_at`; bucket private `submissions` + 4 policy Storage |
| `supabase/migrations/0016_certificates.sql` | 265 | Chứng chỉ: sequence + `generate_certificate_code()` (mã `VISFAR-CERT-YYYY-NNNNNN`), `verification_code` (hex 32, UNIQUE, backfill), `revoked_at/revoked_by/revoked_reason`, `eligibility_snapshot` + `issued_via`, UNIQUE riêng phần (chỉ 1 chứng chỉ `valid` / user+khoá — cho cấp lại sau thu hồi), hàm SECURITY DEFINER `verify_certificate` (chỉ trả 6 trường an toàn, GRANT cho anon), policy admin INSERT/UPDATE `certificates` |
| `apps/web/src/lib/quiz.ts` | 538 | Lib quiz: 6 loại câu hỏi, `gradeQuizAttempt` (bản đặc tả TS của hàm SQL — chỉ dùng test/server, route không dùng), `toPublicPaper` (cắt `is_correct`), shuffle có seed, đếm ngược, `fetchQuizPaper` / `submitQuizAttempt` / `fetchQuizHistory` |
| `apps/web/src/lib/quiz.test.ts` | 443 | 29 test quiz (shuffle, đếm ngược, chấm đủ 5 loại, `toPublicPaper` không lọt `is_correct`, fetch wrapper) |
| `apps/web/src/lib/assignments.ts` | 538 | Lib assignment: validate (bài tập / bài nộp / chấm / file), `decideCanSubmit`, URL (không lộ URL gốc), gọi API `/api/v1/assignments/*` |
| `apps/web/src/lib/assignments.test.ts` | 348 | 25 test assignment |
| `apps/web/src/lib/assignment-server.ts` | 274 | Helper phía server cho route bài tập: `getAssignmentCaller`, `loadAssignmentContext`, `fetchSubmissionsDetailed` (không trả `storage_path`) |
| `apps/web/src/lib/certificates.ts` | 526 | Lib chứng chỉ: `checkCertificateEligibility` (enrollment + 100% bài + quiz đạt ngưỡng, mặc định 70%), `issueCertificateIfEligible` (idempotent), `revokeCertificate`, `verifyCertificateByCode` (chỉ RPC), QR chỉ chứa URL tra cứu công khai |
| `apps/web/src/lib/certificates.test.ts` | 480 | 29 test chứng chỉ (gồm test đúng yêu cầu task: video `in_progress` 95% → không cấp; quiz 60% → không cấp, 70% → cấp) |
| `apps/web/src/components/quiz/QuizPlayer.tsx` | 644 | Component làm quiz (đếm ngược, trộn đề, nộp bài, hiện kết quả + đáp án đúng sau khi nộp) |
| `apps/web/src/components/certificate/CertificateCard.tsx` | 97 | Thẻ hiển thị chứng chỉ (+ QR tra cứu) |
| `apps/web/src/app/hoc-vien/khoa-hoc/[courseSlug]/quiz/[quizId]/page.tsx` | 23 | Trang làm quiz (wrapper quanh `QuizPlayer`) |
| `apps/web/src/app/hoc-vien/khoa-hoc/[courseSlug]/bai-tap/[assignmentId]/page.tsx` | 361 | Trang nộp bài tập |
| `apps/web/src/app/hoc-vien/khoa-hoc/[courseSlug]/bai-tap/[assignmentId]/cham-bai/page.tsx` | 399 | Trang chấm bài (instructor/admin) |
| `apps/web/src/app/chung-chi/tra-cuu/page.tsx` | 172 | Trang tra cứu chứng chỉ công khai |
| `apps/web/src/app/api/v1/quizzes/[quizId]/route.ts` | 191 | `GET` đề thi (không đáp án đúng) — kiểm tra quyền qua `requireLessonAccessById` |
| `apps/web/src/app/api/v1/quizzes/[quizId]/submit/route.ts` | 102 | `POST` nộp bài — gọi RPC `submit_quiz_attempt`, map lỗi hàm SQL sang HTTP |
| `apps/web/src/app/api/v1/quizzes/[quizId]/attempts/route.ts` | 67 | `GET` lịch sử làm bài của chính mình |
| `apps/web/src/app/api/v1/assignments/route.ts` | 218 | `POST` giao bài (instructor/admin) + `GET` danh sách bài tập |
| `apps/web/src/app/api/v1/assignments/[id]/route.ts` | 75 | `GET` chi tiết bài tập (chỉ enrolled/instructor/admin) |
| `apps/web/src/app/api/v1/assignments/[id]/submissions/route.ts` | 187 | `GET` danh sách bài nộp + `POST` nộp/nháp (kiểm tra enrollment + `decideCanSubmit`) |
| `apps/web/src/app/api/v1/assignments/[id]/submissions/[submissionId]/reviews/route.ts` | 118 | `POST` chấm bài (chỉ instructor/admin, điểm ≤ maxScore) |
| `apps/web/src/app/api/v1/assignments/[id]/upload/route.ts` | 188 | `POST` upload file vào bucket private `submissions` (không trả `storage_path`) |
| `apps/web/src/app/api/v1/assignments/[id]/files/[fileId]/download/route.ts` | 90 | `GET` stream file qua server (kiểm tra chủ bài nộp / instructor / admin) |
| `apps/web/src/app/api/v1/certificates/verify/route.ts` | 42 | `GET` tra cứu công khai qua RPC `verify_certificate` |
| `apps/web/src/app/api/admin/certificates/issue/route.ts` | 41 | `POST` admin cấp chứng chỉ (422 khi chưa đủ điều kiện) |
| `apps/web/src/app/api/admin/certificates/[id]/revoke/route.ts` | 34 | `POST` admin thu hồi chứng chỉ (lý do bắt buộc) |

### 1.2 File sửa — TASK 08 chạm vào

| File | Thay đổi |
|---|---|
| `apps/web/src/lib/learning.ts` | `quizUrl()` đổi chữ ký + đích: trước là `/.../bai/[lessonSlug]/quiz` (route không tồn tại — B8 TASK 07), nay là `/hoc-vien/khoa-hoc/[courseSlug]/quiz/[quizId]` (route đã có); thêm import `assignmentUrl` |
| `apps/web/src/app/hoc-vien/khoa-hoc/[courseSlug]/bai/[lessonSlug]/page.tsx` | Nút “Làm quiz ngay” dùng `quizUrl(slug, quiz.id)` mới; thêm link nộp bài tập qua `assignmentUrl`; ghi rõ “Đánh dấu bài học hoàn thành theo kết quả quiz sẽ được nối sau khi có đường ghi tiến độ qua Workers” (xem B-T08-5) |
| `apps/web/src/lib/lms-admin.ts` | Chạm trong cửa sổ TASK 08 (23:06) — thêm loại action audit `certificate.issue` / `certificate.revoke` (dòng 22–23); logic thu hồi chứng chỉ khi thu hồi enrollment giữ nguyên |
| `apps/web/src/app/hoc-vien/chung-chi/page.tsx` | Sửa trong cửa sổ TASK 08 (23:05) — gắn `CertificateCard` (chưa đối chiếu từng dòng) |
| `apps/web/src/styles/globals.css` | Chạm trong cửa sổ TASK 08 (chưa đối chiếu từng dòng) |
| `apps/web/src/lib/lms-admin.test.ts` | **Nhóm kiểm thử sửa (xem §3.1):** test tĩnh migration 0013 khẳng định đúng `ci.user_id = auth.uid()` thay vì `ci.instructor_id` (tiền đề sai đã bị chứng minh trên DB live ở TASK 07 §9.5.1). Sửa test, không sửa logic nghiệp vụ. |

### 1.3 File giữ nguyên (liên quan, không đổi trong TASK 08)

- Schema gốc quiz/assignment/certificate (0001/0004) + RLS (0006/0009/0013); `learning.ts` (đọc metadata quiz/assignment), `progress.ts` (vẫn chặn hoàn thành bài quiz bằng nút bấm — nay thành 1 phần của B-T08-5), `lms-access.ts` (lỗi `instructor_id` còn nguyên), `dashboard.ts`, `workers/api/` (chỉ có `README.md` — Workers API vẫn chưa có code).

---

## 2. Chức năng đã làm (đối chiếu code đã đọc)

1. **Quiz — 5 loại theo task + 1 loại tương thích:** `single_choice`, `multiple_choice`, `true_false`, `fill_blank`, `essay` (đủ 5 loại task yêu cầu) + `short_answer` giữ tương thích dữ liệu cũ → CHECK ở 0014 có 6 giá trị. Quy tắc chấm: trắc nghiệm đúng khi chọn đúng duy nhất / khớp đúng tập option (không điểm thành phần); `fill_blank`/`short_answer` khớp chuỗi chuẩn hoá (trim, gom khoảng trắng, không phân biệt hoa/thường); `essay` không chấm tự động (`needs_review`). Ngưỡng đạt mặc định 70% khi `pass_score_percent` NULL. Giới hạn lần làm (`max_attempts`), hết giờ (`time_limit_sec` + 60s grace → `expired`, `passed=false`). Trộn đề có seed (FNV-1a + mulberry32). Lịch sử làm bài của chính mình.
2. **Assignment:** nộp bài viết / nộp file (tối đa 5 file, 10 MB/file, đuôi cho phép pdf/doc/docx/txt/md/png/jpg/jpeg) / mixed; nháp (draft, 1 dòng/học viên/bài); nộp lại = submission mới (lịch sử giữ lại); chấm tay / chấm lại (review mới nhất là kết quả hiện hành, trigger đồng bộ `submissions.status/graded_at`); chặn nộp muộn ở cả lib (`decideCanSubmit`) và trigger DB (`enforce_submission_due`); file ở bucket private `submissions`, chỉ tải qua API stream (không lộ `storage_path`/URL gốc).
3. **Certificate:** cấp khi đủ 3 điều kiện (enrollment active/completed; 100% bài `completed`; mọi quiz đạt ngưỡng — điểm cao nhất ≥ `pass_score_percent` hoặc 70% mặc định; khóa không có quiz chỉ cần 2 điều kiện đầu). Cấp idempotent (đã có `valid` thì trả lại, không tạo trùng); cấp lại được sau thu hồi (UNIQUE riêng phần); mã `VISFAR-CERT-YYYY-NNNNNN` + `verification_code` do DB sinh; tra cứu công khai chỉ qua RPC `verify_certificate` (6 trường an toàn, không PII); thu hồi cần lý do + ghi audit; QR chỉ chứa URL tra cứu công khai.
4. **Sửa B8 TASK 07:** nút “Làm quiz ngay” nay trỏ tới trang quiz thật (`/hoc-vien/khoa-hoc/[slug]/quiz/[quizId]`).

---

## 3. Kết quả kiểm thử local (chạy thật, 10/11/2026)

Môi trường: Node v24.22.1, npm 10.9.4, `apps/web`. Log đầy đủ lưu ở `/tmp/t08_test3.log`, `/tmp/t08_tc2.log`, `/tmp/t08_lint2.log`, `/tmp/t08_build2.log`, `/tmp/t08_build3.log` (log lần 1–2 trước khi code TASK 08 giao: `/tmp/t08_test.log`, `/tmp/t08_test2.log`, `/tmp/t08_tc.log`, `/tmp/t08_lint.log`, `/tmp/t08_build.log`).

| # | Lệnh | Kết quả | Chi tiết |
|---|---|---|---|
| L1 | `npm test` (vitest run) — baseline trước TASK 08 | **FAIL rồi PASS sau sửa test** | Lần 1: 310 test, 309 pass, **1 fail** (`lms-admin.test.ts:335`, tiền đề sai về `instructor_id` — xem §3.1). Lần 2 sau sửa test: **310/310 PASS**. |
| L2 | `npm test` — sau khi code TASK 08 giao đủ (23:11 +07) | **PASS** — exit 0 | **18 file, 393 test, 393 pass.** Test mới: `quiz.test.ts` (29), `assignments.test.ts` (25), `certificates.test.ts` (29) = **83 test mới**, gồm: chấm đủ 5 loại câu hỏi; `toPublicPaper` cắt `is_correct` (JSON không chứa chuỗi `is_correct`); video `in_progress` 95% → không cấp chứng chỉ; quiz 60% → không cấp, 70% → cấp; quiz chưa làm → không cấp; enrollment revoked → không cấp; nộp muộn / nộp lại / chấm vượt maxScore đều bị chặn. |
| L3 | `npm run typecheck` (`tsc --noEmit`) | **PASS** — exit 0 | Không lỗi (chạy sau khi code TASK 08 giao đủ). |
| L4 | `npm run lint` (eslint) | **PASS** — exit 0 | Không lỗi. |
| L5 | `npm run build` (`next build`) — lần 1 (23:12 +07) | **FAIL** — exit 1 | Compile thành công (20s), lint/typecheck trong build pass, rồi fail ở “Collecting page data”: `ENOENT: no such file or directory, open '.next/build-manifest.json'`. Nguyên nhân: **1 file route (`assignments/[id]/submissions/route.ts`) bị sửa giữa lúc build** (nhóm làm còn giao code) làm hỏng manifest — không phải lỗi code. |
| L6 | `npm run build` — lần 2, sau `rm -rf .next` (23:15 +07) | **PASS** — exit 0 | Build thành công, đủ route mới: `/api/v1/quizzes/[quizId]` (+ `/submit`, `/attempts`), `/api/v1/assignments` (+ `[id]`, `/submissions`, `/reviews`, `/upload`, `/files/[fileId]/download`), `/api/v1/certificates/verify`, `/api/admin/certificates/issue` + `/[id]/revoke`, `/hoc-vien/khoa-hoc/[slug]/quiz/[quizId]`, `/.../bai-tap/[assignmentId]` (+ `/cham-bai`), `/chung-chi/tra-cuu`. Không có file nào thay đổi trong lúc build lần 2. |
| L7 | `pglast` parse 0014–0016 | **PASS** | 0014: 30 câu, 0015: 47 câu, 0016: 24 câu — PARSE OK (chỉ kiểm tra cú pháp, không kiểm tra kiểu dữ liệu / chạy thật). |

**Kết luận local:** chuỗi test → typecheck → lint → build **đều xanh** trên code TASK 08 đầy đủ. Lưu ý: test dùng fake/mock client — không chạm DB thật, nên không chứng minh được gì về RLS/schema live hay tính đúng đắn của hàm SQL `submit_quiz_attempt` so với bản đặc tả TS (`gradeQuizAttempt`) — kiểm tra parity đó nằm trong mục KIỂM CHUNG số 7 của file 0014, **chưa chạy** (cần staging + dữ liệu thật).

### 3.1 Sửa lỗi gặp trong lúc kiểm thử (ghi rõ)

1. **Sửa test cũ (nhóm kiểm thử):** `lms-admin.test.ts:333-341` — khẳng định đúng `ci.user_id = auth.uid()` thay vì `ci.instructor_id` (xem §1.2). Chỉ sửa test, không sửa logic nghiệp vụ. Sau sửa, test baseline 309/310 → 310/310.
2. **Build lại sau lỗi cache (nhóm kiểm thử):** `rm -rf apps/web/.next` (build artifact, build sau tự tạo lại) rồi chạy lại build → PASS. Không sửa/sửa logic nào trong code nguồn. Tiền lệ: TASK 07 §9.1 (cache ESLint cũ).

---

## 4. Kết quả kiểm thử live (PASS / CHƯA CHẠY từng mục + lý do)

Không chạy kiểm thử live mới trong đợt này: migration 0014–0016 chưa áp, Workers chưa deploy, DB live không có quiz/assignment thật. Kết quả live của TASK 07 (§9.5.3: 17/17 PASS trên staging) vẫn giữ nguyên giá trị, không chạy lại.

| # | Kiểm tra live | Kết quả | Lý do / ghi chú |
|---|---|---|---|
| V-T08-1 | Đáp án đúng không lộ xuống frontend (mở quiz thật, xem response/network) | **CHƯA CHẠY (động); PASS (tĩnh)** | Chưa có quiz thật / migration chưa áp. Tĩnh: grep `is_correct` trong `apps/web/src` chỉ còn ở comment + code chấm phía server (`quiz.ts:gradeQuizAttempt`, chỉ dùng test/server) — không có trong response client; route GET đọc options qua view `question_options_public` (không `is_correct`) + `toPublicPaper()` cắt mọi trường `is_correct` còn sót; test `toPublicPaper` assert JSON không chứa chuỗi `is_correct`. |
| V-T08-2 | Học viên không xem được bài/điểm của người khác (B đọc `quiz_attempts`/`answers`/`submissions` của A) | **CHƯA CHẠY** | Chưa có dữ liệu thật / tài khoản test TASK 08. Tĩnh: `quiz_attempts_select_own` (0001:520, own + admin, không ghi trực tiếp); `answers_select_own` (0006:221-231); `submissions_select_own` (0006:253); route attempts chỉ query `user_id = user.id`; route submissions: instructor/admin mới thấy tất cả, học viên chỉ thấy của mình (`userIdFilter`). |
| V-T08-3 | Chưa ghi danh không làm quiz / không nộp bài | **CHƯA CHẠY** | Chưa có endpoint live để thử. Tĩnh: hàm SQL `submit_quiz_attempt` raise `not_enrolled` khi không có enrollment active/completed (trừ free preview / instructor / admin); route submissions/upload raise 403 khi chưa ghi danh; route assignment GET raise 403. Cần test live: B chưa ghi danh gọi submit → phải 403 `not_enrolled`. |
| V-T08-4 | Chứng chỉ không cấp khi chưa đủ điều kiện — test theo task: mở video 100% nhưng quiz chưa đạt → không cấp | **CHƯA CHẠY (live); PASS (unit test)** | Chưa có DB/migration live để chạy. Unit test `certificates.test.ts:350` chứng minh: quiz 60% < 70% → `not-eligible`; `certificates.test.ts:338` chứng minh: chỉ mở video (`in_progress`, 95%) → `not-eligible`. Lưu ý: test này mô phỏng “mở video” bằng `progress_percent: 95` + `status: in_progress`; trường hợp “video 100%” theo nghĩa `progress_percent=100` nhưng `status` vẫn `in_progress` cũng không cấp vì code chỉ đếm `status='completed'` — đúng thiết kế (trigger 0012 chỉ cho `completed` khi ≥ 90%). |
| V-T08-5 | DB migration 0014–0016 đã áp (staging + prod) | **CHƯA CHẠY — migration chưa áp** | 3 file đã có trong repo nhưng chưa chạy lên DB nào. Chỉ mới PARSE OK bằng pglast (L7). Cần áp staging trước, chạy mục KIỂM CHUNG cuối mỗi file, rồi mới lên prod. |
| V-T08-6 | Workers API đã deploy (chấm quiz ở server, cấp chứng chỉ, nộp bài) | **CHƯA CHẠY — Workers chưa deploy; nhưng TASK 08 không phụ thuộc Workers** | `workers/api/` vẫn chỉ có `README.md`. Khác TASK 07: TASK 08 cố tình **không dùng Workers** — chấm quiz chạy bằng hàm SQL `submit_quiz_attempt` qua RPC, cấp chứng chỉ qua route Next admin, nộp bài qua route Next. Vì vậy Workers chưa deploy **không chặn** TASK 08, chỉ chặn đường ghi tiến độ cũ (B4 TASK 07) — và chính đường đó là thứ B-T08-5 đang chờ. |
| V-T08-7 | Quiz 5 loại làm được end-to-end trên staging | **CHƯA CHẠY** | Cần seed 1 quiz đủ 5 loại + tài khoản test A (ghi danh) / B (chưa ghi danh); kiểm tra parity SQL↔TS theo KIỂM CHUNG số 7 của 0014. |
| V-T08-8 | Assignment nộp / nộp lại / chấm tay end-to-end | **CHƯA CHẠY** | Cần seed 1 assignment + bucket `submissions` (0015 mục E) + tài khoản test student/instructor. |
| V-T08-9 | Chứng chỉ cấp / tra cứu công khai end-to-end | **CHƯA CHẠY** | Cần seed khóa đủ điều kiện + kiểm tra `verify_certificate` không lộ PII (KIỂM CHUNG số 3, 6 của 0016). |

---

## 5. Blocker / lỗi phát hiện (theo mức nghiêm trọng)

| # | Vấn đề | Bằng chứng | Ảnh hưởng / Hướng sửa |
|---|---|---|---|
| **B-T08-1 — Đã giao đủ (không còn là blocker)** | Lúc 22:59 code TASK 08 chưa có; tới 23:09 đã giao đủ (migration + lib + route + trang) | §1.1: 26 file mới, build route list đủ | Không cần làm thêm ở khâu giao code; chỉ còn các blocker dưới đây. |
| **B-T08-2 — Lỗi cột sai (chưa sửa)** | `assignment-server.ts:122` dùng `.eq('instructor_id', userId)` trên `course_instructors` — cột không tồn tại (0004 chỉ có `user_id`); cùng lỗi ở `lms-access.ts:230` (TASK 07 §9.5.1) | `grep instructor_id` toàn `src/` còn 3 chỗ: `lms-access.ts:230`, `assignment-server.ts:122`, `lms-access.test.ts:328` (mock) | Truy vấn instructor lỗi 400 (PGRST204) trên DB thật → `isInstructor` luôn `false` → instructor bị đối xử như học viên thường ở cả quiz (route GET qua `requireLessonAccessById`) và assignment (`loadAssignmentContext`). Fail-closed (không cấp quyền sai) nên là lỗi chức năng, không phải lỗ hổng bảo mật. Hướng sửa: đổi thành `.eq('user_id', userId)` ở cả 2 file + mock test, chạy lại test. Ngoài phạm vi “chỉ sửa lỗi test/build” của task này nên **chưa sửa**. |
| **B-T08-3 — Kế thừa từ TASK 07, vẫn còn** | B3 (route download `/api/v1/resources/[id]/download` không kiểm tra enrollment), B4 (hai đường ghi tiến độ mâu thuẫn), B10 (Workers chưa deploy) | TASK 07 §5, §9.4 | B8 (trang quiz) đã được xử lý trong TASK 08. B3/B4/B10 vẫn chưa sửa. |
| **B-T08-4 — Thiếu dữ liệu thật** | DB live không có quiz/assignment thật; seed TASK 07 chỉ có 2 lesson, không có quiz | TASK 07 V10, §9.5.2 | Cần seed TASK 08 (xem §7.4). |
| **B-T08-5 — Khoảng trống tích hợp: quiz đạt chưa hoàn thành bài học → chứng chỉ không bao giờ cấp được cho khóa có quiz** | Không có code nào gọi `markLessonComplete` sau khi nộp quiz đạt: `QuizPlayer.tsx` + trang quiz + route `/submit` đều không chạm `lesson_progress`; `progress.ts:308-314` chặn hoàn thành bài quiz bằng nút bấm; trang học bài tự ghi “Đánh dấu bài học hoàn thành theo kết quả quiz sẽ được nối sau khi có đường ghi tiến độ qua Workers” | `issueCertificateIfEligible` đòi `completedLessons == totalLessons` (chỉ đếm `status='completed'`). Bài quiz không bao giờ đạt `completed` → điều kiện (2) không bao giờ thỏa với khóa có bài quiz → `issue` luôn trả `not-eligible` cho khóa đó, dù học viên làm quiz đạt 100%. Đây là lỗi tích hợp giữa 3 phần (quiz → progress → certificate), không phải lỗi của riêng phần nào. Hướng sửa: khi `submit_quiz_attempt` trả `passed=true`, gọi đường ghi tiến độ (route Next proxy có kiểm tra enrollment, hoặc Workers khi deploy) để đánh dấu bài quiz `completed`; hoặc cho `issueCertificateIfEligible` tính bài quiz là hoàn thành khi có attempt `passed` (cần quyết định thiết kế — quiz đạt có tính là hoàn thành bài không, hay cần cả hai). | **B-T08-6 — Chưa kiểm chứng parity SQL↔TS** | `gradeQuizAttempt` (TS) và `submit_quiz_attempt` (SQL) là 2 bản cài đặt cùng quy tắc chấm; chỉ 1 trong 2 chạy thật trên production (SQL). Nếu 2 bản lệch nhau (vd. cách tính `percent`: SQL `round(score*100.0/total)` vs TS `Math.round(score*100/total)`; cách xử lý `total=0`: SQL `passed=true` khi `total=0`, TS cũng vậy — đã khớp ở 2 điểm này khi đọc code, nhưng chưa kiểm chứng bằng chạy thật) thì kết quả chấm live sẽ khác kết quả test | Chạy KIỂM CHUNG số 7 của 0014 trên staging sau khi áp migration (seed quiz đủ 5 loại + 1 câu multiple_choice chọn thiếu 1 option đúng; đối chiếu score/total/passed từng câu). |

Các vấn đề **không** phát hiện (đã kiểm tra, ghi rõ để khỏi hiểu lầm là “chưa test”): không có code nào dùng service-role key trong `apps/web` (grep = 0); route GET quiz không tạo attempt (chỉ đếm khi nộp); route submit validate body (tối đa 200 câu, 50 option/câu, text ≤ 5000 ký tự) trước khi gọi RPC; upload file validate đuôi + 10 MB ở cả client lib và route; download file kiểm tra chủ bài nộp/instructor/admin + stream qua server (không redirect URL gốc); `verify_certificate` chỉ trả 6 trường, không PII; `certificates` không có policy SELECT công khai.

---

## 6. Mục chưa chạy live và vì sao

| # | Mục | Vì sao chưa chạy |
|---|---|---|
| U1 | Áp 0014–0016 + chạy KIỂM CHUNG cuối mỗi file | Migration mới giao lúc 23:02–23:03, chưa áp lên DB nào. |
| U2 | Làm quiz end-to-end (5 loại, hết giờ, hết lượt, trộn đề) | Cần U1 + seed quiz thật + tài khoản test. |
| U3 | Nộp / nộp lại / chấm tay assignment + tải file | Cần U1 + seed assignment + bucket `submissions` + tài khoản test student/instructor. |
| U4 | Cấp / thu hồi / tra cứu chứng chỉ + test V-T08-4 live | Cần U1 + seed + sửa B-T08-5 trước (nếu không, khóa có quiz sẽ không bao giờ đủ điều kiện cấp). |
| U5 | Parity chấm SQL↔TS (KIỂM CHUNG 0014 số 7) | Cần U1 + U2. |
| U6 | RLS theo vai trò cho quiz/assignment (B đọc bài/điểm của A) | Cần U1 + tài khoản test A/B + dữ liệu thật (`tests/rls-manual.md` vẫn CHƯA CHẠY). |
| U7 | Kiểm thử trên trình duyệt thật (QuizPlayer, đếm ngược, trang chấm bài, tra cứu chứng chỉ + QR) | Có build mới (L6 PASS) nhưng chưa có dữ liệu/migration live để mở trang thật. |

---

## 7. Phương án rollback

Trạng thái hiện tại **an toàn để rollback** vì chưa có gì ra production: code chưa commit, chưa deploy, migration 0014–0016 chưa áp lên DB nào, Workers chưa deploy.

| Tầng | Cách rollback | Ghi chú |
|---|---|---|
| Code `apps/web` (TASK 08) | Xóa các file mới ở §1.1 (lib quiz/assignments/assignment-server/certificates + test, component QuizPlayer/CertificateCard, trang quiz/bài-tap/tra-cuu, route `/api/v1/quizzes/*`, `/api/v1/assignments/*`, `/api/v1/certificates/verify`, `/api/admin/certificates/*`); revert `learning.ts` (khôi phục `quizUrl` cũ trỏ `/.../bai/[lessonSlug]/quiz`), trang học bài, `hoc-vien/chung-chi/page.tsx`, `globals.css`, `lms-admin.ts` về bản trước TASK 08. | Repo chưa commit nên rollback = xóa file untracked + `git checkout -- <file sửa>` với file đã track. **Cẩn thận:** nhiều file TASK 06/07 cũng đang untracked — chỉ xóa đúng danh sách §1.1, đừng `git clean` bừa. |
| Code test (nhóm kiểm thử sửa) | Revert `lms-admin.test.ts` về bản khẳng định `ci.instructor_id` — **không khuyến nghị** (bản sửa là đúng theo schema thật; revert sẽ làm test lại FAIL 1). | — |
| Migration 0014–0016 | **Không cần rollback DB** — chưa áp lên staging/prod. Chỉ cần không chạy các file này. | Không có file down. Nếu sau này đã áp rồi mới cần rollback thì phải làm thủ công theo thứ tự ngược: drop hàm `submit_quiz_attempt` + `verify_certificate`, drop view `question_options_public` (khôi phục `quiz_options_public` nếu cần), drop cột 0014–0016, drop bảng `submission_files`, khôi phục UNIQUE `(user_id, course_id)` ở `certificates` + CHECK cũ ở `submissions`/`submission_reviews` — và phải đối chiếu dữ liệu trước khi drop. |
| DB live (staging + prod) | Không đổi gì — dữ liệu TASK 07 (§9.5.2) vẫn nguyên (đã xác nhận qua TASK 07 V1–V20, không chạy lại trong đợt này). | Nếu đã seed dữ liệu TASK 08 sau này thì xóa đúng các dòng seed test theo id, không xóa 10 khóa seed gốc. |
| Workers API | Không có gì để rollback (chưa deploy). | — |
| Sau rollback | Chạy lại `npm test && npm run typecheck && npm run lint && npm run build` ở trạng thái trước TASK 08 để xác nhận về baseline TASK 07: test 310/310 (với test đã sửa), typecheck/lint/build PASS (đã đo ở L1–L4 lần đầu, §3). | Baseline này đã được đo trong chính đợt kiểm thử này trước khi code TASK 08 đổ về. |

---

## 8. Điều kiện nghiệm thu lại (đề nghị cho lần test sau)

1. **Sửa B-T08-2** (`instructor_id` → `user_id` ở `lms-access.ts:230` + `assignment-server.ts:122` + mock `lms-access.test.ts:328`) — nếu không, instructor sẽ không được nhận quyền trên DB thật ở cả quiz lẫn assignment.
2. **Quyết định + sửa B-T08-5** (nối quiz đạt → hoàn thành bài học) trước khi nghiệm thu chứng chỉ — nếu không, khóa có bài quiz không bao giờ cấp được chứng chỉ.
3. Áp 0014–0016 lên **staging trước**, chạy mục KIỂM CHUNG cuối mỗi file migration (đặc biệt parity SQL↔TS số 7 của 0014), rồi mới lên prod.
4. Seed tối thiểu trên staging: 1 quiz đủ 5 loại câu hỏi + 1 assignment (có hạn nộp) + 1 video; tài khoản test A (ghi danh, quiz đạt), B (chưa ghi danh), C (ghi danh, video 100% nhưng quiz chưa đạt — phục vụ test V-T08-4 live).
5. Chạy lại toàn bộ §3 (test/typecheck/lint/build) + §4 (V-T08-1 → V-T08-9), đặc biệt test V-T08-4 live: C xem video 100% nhưng quiz chưa đạt → **không có chứng chỉ nào được cấp** (kiểm tra cả bảng `certificates` lẫn trang `/hoc-vien/chung-chi`).
6. Nhóm làm **tuyên bố dừng giao code** trước khi test lại — đợt này file đổ về liên tục trong lúc test (kể cả giữa lúc build), làm kết quả chỉ đúng tại thời điểm snapshot 23:16 +07.

---

## 9. Sửa blocker + kiểm thử live (10/11/2026, sau §8)

Token Supabase chỉ dùng qua biến môi trường, không ghi file/log. Kết quả tổng hợp từ 2 nhóm: code (B-T08-2, B-T08-5) và migration/live (0014–0016, V-T08-1→V-T08-9).

### 9.1 B-T08-2 — `instructor_id` → `user_id` (ĐÃ SỬA, test PASS)

Schema thật: `0004:487-493` bảng `course_instructors` chỉ có `course_id, user_id, role, assigned_by…`; `0013:98,108` cũng dùng `ci.user_id`. File sửa: `assignment-server.ts:122`, `lms-access.ts:230`, `app/api/v1/assignments/route.ts:63,145` (cùng lỗi ở GET + POST), mock `lms-access.test.ts` đổi thành `{ course_id: 'c1', user_id: OTHER_ID }` + test guard tĩnh (3 file không được chứa `instructor_id`). Sau sửa, grep `instructor_id` trong `src/` chỉ còn chuỗi guard âm trong test — không còn code dùng cột sai.

### 9.2 B-T08-5 — quiz ĐẠT → hoàn thành bài học (ĐÃ SỬA, test PASS)

Đường ghi đã chọn: **Workers/progress (`POST /api/v1/progress`)**, gọi từ client sau khi route submit trả `passed=true`. Lý do: migration 0009 đã xóa policy ghi `lesson_progress` của client (chỉ còn SELECT); fallback "route Next server dùng service-role" không thực hiện được — apps/web không có service-role key ở đâu cả (chỉ anon key; key chỉ nằm trong Workers Secrets). `progress.ts` thêm `resolveQuizCompletion()` + `markQuizLessonComplete(lessonId, courseId, result)`: chỉ tin `passed` do hàm SQL SECURITY DEFINER `submit_quiz_attempt` (0014) trả về, không tự tính lại từ score/total (quiz có `pass_score_percent` riêng). ĐẠT → POST Workers `{lesson_type:'quiz', event:'completed', progress_percent:100, quiz_attempt_id}`; chưa đạt/hết giờ → `blocked`, không gọi fetch/Supabase. `quiz.ts` + route GET quiz thêm `lessonId`/`courseId`; `QuizPlayer.tsx` sau khi nộp ĐẠT và quiz gắn bài học thì gọi ghi tiến độ, chưa đạt thì không gọi; lỗi ghi (Workers chưa deploy) → thông báo + nút "Thử ghi tiến độ lại" (điểm quiz đã lưu ở server qua RPC nên chỉ ghi lại việc đánh dấu).

Test mới (7 test, `progress.test.ts` + `quiz.test.ts`): đạt 7/10=70% → POST đúng body; chưa đạt 6/10=60% → blocked, không gọi fetch; hết giờ → không gọi fetch; Workers lỗi → error/offline, không "ok" giả; ngưỡng mặc định 70% (7/10 đạt, 6/10 trượt); quiz ngưỡng riêng 80% làm 75% → trượt, không gọi fetch.

**Lưu ý trung thực:** hôm nay ở production, việc đánh dấu hoàn thành sau quiz ĐẠT sẽ lỗi rõ (Workers chưa deploy) và UI cho thử lại — điểm quiz thì đã lưu chắc chắn qua RPC. Chỉ khi Workers `/progress` deploy xong thì bài mới được đánh dấu hoàn thành thật. Cách chắc chắn nhất là đánh dấu ngay trong `submit_quiz_attempt` — nhưng đó là migration mới (0017), ngoài phạm vi đợt này.

**Cập nhật 10/11/2026 ~17:00 +07 (Workers API — B-T08-5 code xong, chưa deploy):** `POST /api/v1/progress` đã có tại `workers/api/src/handlers/progress.ts` — quiz `completed` chỉ khi đối chiếu `quiz_attempts.passed = true` bằng `quiz_attempt_id` (đúng user, đúng bài), đúng hợp đồng `markQuizLessonComplete` gửi (`lesson_type:'quiz', event:'completed', progress_percent:100, quiz_attempt_id`). Test local **23 test progress PASS** (gồm quiz đạt → completed 100%, chưa đạt → 400, thiếu attempt → 400, attempt của người khác → 403). **Chưa deploy** (chưa có Cloudflare token — `wrangler whoami` báo chưa đăng nhập) nên live end-to-end vẫn chờ deploy + tài khoản test; migration 0017 (đánh dấu ngay trong `submit_quiz_attempt`) vẫn là phương án dự phòng chưa quyết.

### 9.3 Code sau sửa — PASS toàn bộ

`npm test` **401/401, 18 file**; `npm run typecheck` PASS (exit 0); `npm run lint` PASS (exit 0). (Lần chạy typecheck đầu fail TS6053 do `.next` cũ, chạy lại không đổi code thì PASS. Warning stderr có sẵn ở `quiz.test.ts:385` — assertion chưa await, không phải do đợt này.)

### 9.4 Migration 0014–0016 — PASS staging + prod

0011–0013 kiểm chứng PASS cả staging + prod (không chạy lại). Parse pglast OK (0014: 30, 0015: 47, 0016: 24 câu). Mỗi file HTTP **201** trên cả 2 project, kiểm chứng cuối file PASS hết:
- **0014**: `shuffle_questions`, default `pass_score_percent=70`, 5 cột `quiz_attempts`, 2 cột `quiz_answers`, view `question_options_public` 0 cột `is_correct`, `submit_quiz_attempt` tồn tại, CHECK 6 loại câu, UNIQUE `(attempt_id, question_id, option_id)`.
- **0015**: 3 cột `assignments` + 3 cột `submissions`, CHECK `draft/submitted/graded/returned` và `graded/returned`, 3 policy `submission_files`, bucket `submissions` private, 2 trigger.
- **0016**: 6 cột mới, `generate_certificate_code()` → `VISFAR-CERT-2026-000001`, `verify_certificate` mã lạ → 0 dòng và trả đúng 6 cột an toàn, UNIQUE riêng phần 1 cert `valid`/user+khóa, 2 policy admin, UNIQUE cũ đã gỡ.
- Prod xác nhận sạch dữ liệu test (0 quiz/certificate/submission). Không dump backup được từ VM (cổng Postgres 5432 bị chặn — cùng lý do phải dùng Management API); lúc áp prod chưa có dữ liệu học viên thật.

### 9.5 Seed staging (chỉ staging, nội dung Visfar thật)

Quiz **"Kiểm tra — Khai mở tâm thức"** (khóa Thấu Hiểu Nội Tâm, gắn Bài 2 — bài không free preview để test chặn, `pass_score_percent=NULL` → 70, giới hạn 600s): 5 câu 1 điểm — Q1 một đáp án, Q2 nhiều đáp án (3 đúng), Q3 đúng/sai, Q4 điền từ, Q5 tự luận. Assignment **"Bài tập — Viết lại một khái niệm nguồn có lợi"** (tự luận, tối đa 10, hạn 30/11/2026) + 1 assignment quá hạn (09/11/2026) để test chặn nộp muộn. 4 tài khoản test qua Auth Admin API (tránh 429 signUp): A đã ghi danh, B chưa ghi danh, C đã ghi danh, ADMIN (`role=admin`). Mật khẩu ngẫu nhiên, chỉ trong bộ nhớ, không ghi lại.

### 9.6 Kiểm thử live V-T08-1→V-T08-9 (dev server local → staging)

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| V-T08-1 | **PASS** | GET đề thi 200, 5 câu, không có `is_correct` trong response; REST view cũng sạch |
| V-T08-2 | **PASS** | B đọc `quiz_attempts`/`submissions` của A qua REST: 0 dòng; route attempts của B: 0 dòng |
| V-T08-3 | **PASS** (lưu ý) | B GET quiz 403 `not_enrolled`, B submit 403 `not_enrolled`; B nộp assignment bị chặn bằng **404** (RLS ẩn assignment trước bước kiểm tra ghi danh) thay vì 403 như §8 từng viết — kết quả vẫn là chặn |
| V-T08-4 | **PASS** | C video 100% + quiz 20% → issue 422, lý do "chưa đạt ngưỡng 70% (cao nhất 20%)"; C có 0 chứng chỉ |
| V-T08-5 | **PASS** | Mục 9.4 ở trên |
| V-T08-6 | **KHÔNG ÁP DỤNG** (cập nhật 10/11/2026 ~17:00: code Workers `/progress` đã có, test local PASS, **chưa deploy** — xem §9.2) | `workers/api` trước đây chỉ có README; Task 08 cố tình không dùng Workers (chấm = hàm SQL, cấp/chấm bài = route Next) |
| V-T08-7 | **FAIL ở route / PASS ở hàm SQL** | Xem blocker B-T08-7 dưới. RPC trực tiếp: A 4/5 = 80% đạt (`needs_review` do essay), C 1/5 = 20% trượt, multi thiếu 1 option đúng = 0 điểm. **Parity SQL↔TS PASS** cả A và C (score/total/percent/passed/needsReview + từng câu). Hết giờ: started −15p → `expired`, `passed=false` (vẫn chấm 4/5). Giới hạn lượt: `max_attempts=1` → 409 `max_attempts_reached`, đã trả về NULL |
| V-T08-8 | **PASS** | A nộp → 201 `submitted`; nộp lại → id mới, tổng 2 bài; admin chấm 8/10 → 201, submission `graded` + `graded_at` set; nộp muộn bị chặn ở route (400) và trigger DB (`assignment_overdue`) |
| V-T08-9 | **PASS** | Cấp cho A → `VISFAR-CERT-2026-000002`; tra cứu công khai bằng mã và bằng `verification_code` → 200, đúng 6 trường, không PII; **QR giải mã thật bằng zxing-cpp ra đúng URL tra cứu**; mã lạ → 404; thu hồi → 200, DB `revoked` + lý do; tra cứu sau thu hồi → `revoked`, không lộ lý do/PII; cấp lại → mã mới `...000003`, tra cứu `valid` |

**🔴 Blocker mới — B-T08-7 (phát hiện live, KHÔNG tự sửa):** Route `POST /api/v1/quizzes/[quizId]/submit` không chuyển đổi key camelCase↔snake_case. Client thật (`buildSubmitPayload`) gửi `{questionId, optionIds, answerText}`; route chuyển thẳng sang RPC, hàm SQL chỉ đọc `{question_id, option_ids, answer_text}` → không khớp câu nào → **mọi bài nộp qua UI đều 0 điểm**. Chiều về cũng sai: SQL trả snake_case (`attempt_id`, `question_id`, `is_correct`) trong khi lib client đợi camelCase (`attemptId`, …) → `submitQuizAttempt` sẽ throw `bad_response`, trang kết quả không hiện được từng câu. Hàm SQL đã chứng minh đúng (RPC snake_case đạt 4/5). Cần sửa route (map 2 chiều) trước khi mở cho học viên thật. Lưu ý liên quan: `QuizPlayer` còn gọi `markQuizLessonComplete` qua Workers chưa deploy (B-T08-5 cũ) — nhưng trong đợt test này tiến độ được ghi trực tiếp để kiểm tra cấp chứng chỉ.

**Cập nhật 10/11/2026 ~17:00:** đọc code route `POST /api/v1/quizzes/[quizId]/submit` thấy **đã có map camelCase↔snake_case 2 chiều** (B-T08-7 đã sửa ở code — client gửi camelCase, route chuẩn hóa rồi map sang snake_case trước RPC); kiểm thử lại nộp qua UI end-to-end vẫn chờ chạy live.

**Ghi chú kiểm thử:** Việc hoàn thành bài học của A/C được mô phỏng bằng insert SQL trực tiếp (video 600/600s, text 100%), tuân thủ đúng trigger 0012 — trigger cũng đã kiểm chứng chặn video 50% đòi `completed`. QR test dùng origin dev local (`http://localhost:3100`); khi deploy domain thật, origin trong QR sẽ đổi theo. V-T08-8a/8b từng ghi FAIL chỉ do script kỳ vọng HTTP 200 trong khi route trả đúng 201 — đã đính chính thành PASS theo bằng chứng log.

**Trạng thái cuối staging:** A có 2 chứng chỉ (1 `valid` `...000003`, 1 `revoked` `...000002`), C 0 chứng chỉ, A 2 submissions, `max_attempts` của quiz đã về NULL. VM restart giữa chừng làm mất `/tmp` (script + log lần 1); đã viết lại script tại `~/workspace/t08-work/` và chạy lại toàn bộ từ đầu; dữ liệu DB không bị ảnh hưởng. Dev server test đã dừng.

### 9.7 `scripts/check-migrations.mjs` — đã sửa, PASS toàn bộ

Từ hard-code 3 file → danh sách đủ **16 migration** theo thứ tự; thêm kiểm tra tĩnh 0014 (8 mục), 0015 (6), 0016 (10, gồm `verify_certificate` trả đúng 6 trường và không lộ PII). `npm run check:migrations` → **OK: tất cả PASS**.

### 9.8 Việc còn lại

1. **B-T08-7 (chặn mở cho học viên thật):** sửa route submit quiz map camelCase↔snake_case 2 chiều, test lại nộp qua UI end-to-end.
2. Deploy Workers `/progress` (code đã xong 10/11/2026 ~17:00, test local PASS — chỉ còn chờ Cloudflare token + secret, lệnh ở `workers/api/README.md` § Deploy) để việc đánh dấu hoàn thành sau quiz ĐẠT chạy thật (B-T08-5); hoặc làm migration 0017 đánh dấu ngay trong `submit_quiz_attempt` (chắc chắn hơn, cần quyết định).
3. V-T08-6 không áp dụng cho Task 08; Workers vẫn là việc riêng (form lead + progress).
4. Dọn dữ liệu test staging khi không cần nữa (2 chứng chỉ của A, 2 submissions, quiz/assignment seed) — chỉ xóa đúng dòng seed test, không xóa 10 khóa seed gốc.

### 9.9 B-T08-7 — ĐÃ SỬA (10/11/2026, test local + live staging PASS)

**Nguyên nhân (đã xác nhận):** route `POST /api/v1/quizzes/[quizId]/submit` chuyển thẳng body client sang RPC; hàm SQL `submit_quiz_attempt` (0014) chỉ đọc `question_id/option_ids/answer_text` nên không khớp câu nào → mọi bài nộp qua UI đều 0 điểm. Chiều về SQL trả snake_case (`attempt_id`, `needs_review`, …) trong khi `submitQuizAttempt` đợi camelCase (`attemptId`, …) → throw `bad_response`. Route `/attempts` đã map đúng từ trước — chỉ route submit sai.

**File sửa:**
- `apps/web/src/lib/quiz.ts` — thêm 2 hàm pure có test: `toSnakeCaseQuizAnswers()` (camelCase → snake_case) và `toCamelCaseQuizSubmitResult()` (snake_case → camelCase, trả `null` khi hình dạng không hợp lệ).
- `apps/web/src/app/api/v1/quizzes/[quizId]/submit/route.ts` — `parseAnswers()` chấp nhận cả 2 kiểu key (camel ưu tiên, snake dự phòng); `startedAt`/`started_at` đều chấp nhận; map sang snake_case trước khi RPC; map kết quả RPC sang camelCase trước khi trả về; kết quả sai dạng → 502 `submit_failed` thay vì để client throw `bad_response`. Không sửa hàm SQL, không sửa client.
- `apps/web/src/lib/quiz.test.ts` — thêm 5 test mapper (đi + về, không đổi mảng gốc, trả `null` khi sai dạng) + 1 test `submitQuizAttempt` nhận result camelCase từ route.

**Kiểm thử local (chạy thật):** `npm test` **406/406, 18 file** (401 trước + 5 test mới); `npm run typecheck` PASS; `npm run lint` PASS; `npm run build` PASS (sau `rm -rf .next/cache/eslint` — cache lint cũ, đã biết từ Task 07).

**Kiểm thử live staging (dev server local port 3100, env staging → staging, tài khoản test mới D `test-t08-d@visfar-academy.test`, đã ghi danh khóa 01; script `/tmp/bt087_e2e.py`, đã dừng dev server sau test): 7/7 PASS**
- GET đề thi qua route: HTTP 200, 5 câu, response không chứa `is_correct` (đáp án chỉ hiện sau khi nộp).
- POST submit camelCase qua route: HTTP 200, `ok:true`, `attemptId` dạng camelCase, không còn key snake_case trong response.
- Điểm đúng: **4/5 = 80%, `passed=true`, `needsReview=true`** (essay chưa chấm tự động) — khớp đúng kết quả RPC snake_case trực tiếp ở §9.6 (A cũng 4/5).
- Kết quả từng câu camelCase (`questionId`, `questionType`, `isCorrect`, `pointsAwarded`, `correctOptionIds`, `selectedOptionIds`, `answerText`), 5/5 câu, đáp án đúng + giải thích chỉ có sau khi nộp.
- Đối chiếu DB: `quiz_attempts` ghi đúng 1 dòng `738ff9e3-…`, `score=4, total=5, passed=true, needs_review=true, status='submitted'`.
- `submitQuizAttempt` không còn throw `bad_response` (route trả đúng dạng client đợi — chứng minh ở cả unit test và live).

**Giới hạn trung thực:**
- Test nộp bài đi qua route Next bằng HTTP với session cookie thật (đăng nhập thật qua Supabase Auth), **không phải click trên trình duyệt thật** — subagent không dùng live browser; luồng `QuizPlayer` (UI) dùng đúng `submitQuizAttempt` đã test ở trên nên không còn điểm gãy ở tầng route/lib.
- **Ghi tiến độ sau quiz ĐẠT vẫn chưa chạy thật:** `lesson_progress` của D sau khi nộp vẫn trống — đường ghi đi qua Workers `/progress` (chưa deploy, B-T08-5 cũ). Route submit trả `passed=true` làm đầu vào đúng, nhưng việc đánh dấu bài quiz `completed` chỉ xảy ra khi Workers deploy (hoặc migration 0017 đánh dấu ngay trong `submit_quiz_attempt`).
- Dữ liệu test mới trên staging: 1 tài khoản D + 1 attempt `738ff9e3-…` (chưa dọn; dọn cùng đợt dọn test ở §9.8 mục 4).

**Trạng thái B-T08-7: ĐÃ SỬA — đủ điều kiện mở nộp quiz qua UI về mặt route/lib; còn chặn ở B-T08-5 (Workers `/progress`) đối với việc đánh dấu hoàn thành + cấp chứng chỉ tự động cho khóa có quiz.**
