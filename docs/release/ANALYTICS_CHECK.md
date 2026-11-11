# Kiểm chứng Analytics — Visfar Academy (Task 12)

- **Ngày kiểm chứng:** 10/11/2026, 23:41–23:52 +07 (snapshot cuối 23:52 +07 / 16:52 UTC).
- **Phạm vi:** `apps/web/src/lib/admin-dashboard.ts` + `apps/web/src/app/admin/page.tsx`
  (Task 09 phần 1/4 — dashboard admin), các lib liên quan (`dashboard.ts`, `quiz.ts`,
  `leads.ts`, `newsletter.ts`, `crm.ts`), schema Task 03
  (`docs/database/DATABASE_SCHEMA.md`, `supabase/migrations/0001`, `0004`, `0014`),
  kiến trúc Task 02 (`docs/architecture/SYSTEM_MODULES.md` §M12, báo cáo R1–R10),
  `docs/DECISIONS.md` (QĐ 17).
- **Người kiểm chứng:** subagent kiểm chứng Task 12 (không phải tác giả Task 09).
- **Nguyên tắc:** mọi số phải lấy từ Supabase thật, không số liệu giả; chưa có dữ liệu
  thì hiện 0 / empty state. Báo cáo này **không bịa số liệu vận hành nào** — mọi con số
  dưới đây chỉ là kết quả kiểm thử/test hoặc kết quả query thật đã chạy (ghi rõ nguồn).

## 0. Lưu ý về tài liệu đầu vào

- **Không tồn tại file `docs/frontend/TASK09_REPORT.md`.** Task 09 không có báo cáo
  tổng hợp; công việc được chia 1/4–4/4 ngay trong header các file code:
  `admin-dashboard.ts` (1/4 — dashboard), `lms-admin.ts` (3/4 — quản lý khóa học),
  `app/admin/crm/page.tsx` (4/4 — CRM). Thư mục `docs/frontend/` chỉ có tới
  `TASK08_REPORT.md`.
- **Repo đang bị sửa song song trong lúc kiểm chứng** (các agent Task 09 phần 2–4):
  `app/admin/page.tsx` được sửa lúc 16:44:15 UTC (thêm nhánh `state.status !==
  'success'`), `app/admin/layout.tsx` thêm nav Tổng quan / Khóa học / Học viên / CRM /
  Nhật ký quản trị, các trang `/admin/hoc-vien`, `/admin/crm`, `/admin/audit-logs`
  mới xuất hiện. Mọi kết luận dưới đây là trạng thái tại **snapshot 23:52 +07**;
  lần chạy `tsc` đầu (trước 16:44 UTC) còn thấy 3 lỗi type ở `page.tsx`, lần chạy
  sau (sau khi file được sửa) đã hết lỗi — xem §4.

## 1. Kết luận tổng thể

| Hạng mục | Kết quả |
|---|---|
| 12 chỉ số được giao kiểm tra | **9 CÓ** (7 đầy đủ + 2 một phần), **3 KHÔNG** (điểm quiz tổng hợp, email, tỷ lệ chuyển đổi) |
| Số liệu có nguồn Supabase thật, không mock | ✅ Đúng — `getAdminDashboardStats()` chỉ đọc Supabase; test empty-state khẳng định không bịa số (xem §4) |
| Có trang dashboard admin hiển thị số liệu | ✅ CÓ — `/admin` (`app/admin/page.tsx`), sau `requireAdmin` ở layout; 8 thẻ thống kê + bảng tiến độ theo khóa + đăng ký gần đây |
| Đã kiểm chứng live bằng tài khoản admin thật | ❌ **CHƯA** — subagent không có JWT admin; query anon chỉ chứng minh được RLS chặn (xem §3) |
| Đúng kiến trúc M12 (tổng hợp ở Workers API + cache) | ❌ **CHƯA** — hiện đọc trực tiếp bằng JWT admin qua Supabase client (xem §5.6) |

**9 chỉ số CÓ** (7 đầy đủ + 2 một phần), **3 chỉ số KHÔNG hoàn toàn**.
**7 CÓ đầy đủ:** học viên mới, học viên hoạt động, khóa học, tiến độ học,
tỷ lệ hoàn thành, doanh thu, đơn hàng.
**2 CÓ MỘT PHẦN:** lượt đăng ký (có ghi danh, thiếu tổng lead tư vấn),
thanh toán (chỉ có qua doanh thu, thiếu đếm giao dịch theo trạng thái).
**3 KHÔNG:** điểm quiz (tổng hợp), email, tỷ lệ chuyển đổi.

## 2. Bảng kiểm chứng từng chỉ số (12 chỉ số)

> Cột “Trạng thái” dùng: ✅ CÓ / ⚠️ CÓ MỘT PHẦN / ❌ KHÔNG.
> “Kiểm chứng” ghi rõ đã chạy gì; **không có con số vận hành thật nào** được ghi ở
> đây ngoài kết quả query/test đã chạy (xem §3–§4).

| # | Chỉ số | Trạng thái | Nguồn bảng (schema thật) | Công thức / định nghĩa trong code | Hiển thị ở UI | Kiểm chứng |
|---|---|---|---|---|---|---|
| 1 | Học viên mới | ✅ CÓ | `profiles.created_at` | `COUNT profiles WHERE created_at >= now − 30 ngày` (`NEW_STUDENT_DAYS = 30`, `daysAgoIso()`); đếm bằng `select id, {count:'exact', head:true}` | Thẻ “Học viên mới” + hint “Đăng ký trong 30 ngày qua”; đồng thời là hint của thẻ “Tổng học viên” | Unit test pass (fake client); **live chưa chạy** (cần JWT admin) |
| 2 | Học viên hoạt động | ✅ CÓ | `lesson_progress.updated_at` + `user_id` | Số `user_id` riêng biệt có `lesson_progress.updated_at >= now − 30 ngày` (`countDistinctUsers()`; `ACTIVE_STUDENT_DAYS = 30`) | Thẻ “Học viên hoạt động”, hint “Có tiến độ học trong 30 ngày qua” | Unit test pass; **live chưa chạy**. ⚠️ Giới hạn: query `.limit(1000)` — quá 1.000 dòng tiến độ trong 30 ngày sẽ đếm thiếu |
| 3 | Khóa học | ✅ CÓ | `courses` (+ `status`) | `COUNT courses` (mọi trạng thái) và `COUNT courses WHERE status='published'` | Thẻ “Tổng khóa học” (hint “N khóa đã xuất bản”); bảng “Tiến độ theo khóa học” liệt kê từng khóa | Unit test pass; **live (anon): `courses` trả 10 dòng** — khớp seed “10 khóa” trong `BACKEND_TEST_REPORT.md` |
| 4 | Lượt đăng ký | ⚠️ CÓ MỘT PHẦN | `enrollments` (CÓ); `leads` (CHƯA đưa lên dashboard) | Ghi danh: `COUNT enrollments` (mọi trạng thái: active + completed + revoked) và `COUNT enrollments WHERE status='active'`; 10 đăng ký mới nhất kèm tên học viên + tên khóa | Thẻ “Đăng ký khóa học” (hint “N đang học”); mục “Đăng ký gần đây” (empty state khi chưa có) | Unit test pass; **live chưa chạy**. Lead tư vấn: chỉ xem được dạng danh sách ở `/admin/crm` (`fetchCrmLeads`, tối đa 200 lead mới nhất), **không có tổng số lead** trên dashboard |
| 5 | Tiến độ học | ✅ CÓ | `lesson_progress` + `lessons` qua `course_modules` + `enrollments` | Mỗi enrollment active/completed: tổng số bài của khóa = số `lessons` qua `course_modules`; bài xong = `isLessonCompleted()` theo QĐ 17 (video: `progress_percent >= 90`; bài text: `status='completed'`). Tổng hợp toàn hệ thống + theo từng khóa (`CourseDashboardRow.completedLessons`, `totalLessons`) | Hint thẻ “Tỷ lệ hoàn thành”: “X/Y bài đã hoàn thành”; cột “Hoàn thành” theo từng khóa | Unit test pass, gồm case video 90% tính là hoàn thành; **live chưa chạy** |
| 6 | Tỷ lệ hoàn thành | ✅ CÓ | Như #5 | `computeCompletionRate(completed, total) = round(completed/total*100)`, mẫu số 0 → 0%, kẹp 0–100. Chỉ tính enrollment `active`/`completed` (loại `revoked`); khóa chưa có bài → 0% | Thẻ “Tỷ lệ hoàn thành” (%) + tỷ lệ từng khóa trong bảng | Unit test pass (0/0→0, 1/2→50, 1/3→33, vượt tổng kẹp 100); **live chưa chạy** |
| 7 | Điểm quiz | ❌ KHÔNG | Bảng có sẵn nhưng **không được đọc**: `quiz_attempts` (`score`, `total`; 0014 thêm `quiz_id`, `status`, `passed`, `started_at`, `needs_review`), `quiz_answers.points_awarded` | **Không có công thức tổng hợp nào.** Chỉ có điểm từng lượt làm: `quiz.ts` `gradeQuizAttempt()` (chấm từng bài, `percent = round(score/total*100)`, ngưỡng đạt mặc định 70) và `fetchQuizHistory()` (lịch sử của chính học viên, từng quiz) — không có điểm trung bình / bài, / khóa, không có “câu sai nhiều nhất” (M12 R6 yêu cầu) | Không hiển thị ở `/admin` | Grep toàn `src/lib` + `src/app`: không có `avg`/`average`/trung bình nào cho quiz; `admin-dashboard.ts` không hề query `quiz_attempts` |
| 8 | Doanh thu | ✅ CÓ | `payments.amount_vnd` (ưu tiên) → fallback `orders.amount_vnd` | `SUM payments.amount_vnd WHERE status='succeeded'`, chỉ cộng số nguyên > 0 (`sumRevenue()` bỏ qua null/âm/NaN). Nếu query `payments` lỗi (vd. bảng chưa có — `PGRST205`): fallback `SUM orders.amount_vnd WHERE status='paid'` và **báo rõ nguồn** qua `revenueSource` (`'payments'`/`'orders'`/`'none'`) + `revenueWarning` hiện thành notice trên UI. Cả hai đều lỗi → error state, không trả số giả | Thẻ “Doanh thu” (định dạng VND), hint ghi rõ nguồn; notice cảnh báo khi dùng fallback | Unit test pass: tổng 350.000đ từ payments; rỗng → 0 + `revenueSource='payments'`; PGRST205 → fallback orders 50.000đ + warning; cả hai lỗi → error. **Live chưa chạy** |
| 9 | Đơn hàng | ✅ CÓ | `orders` (+ `status`) | `COUNT orders` và `COUNT orders WHERE status='paid'` | Thẻ “Đơn hàng” (hint “N đơn đã thanh toán”) | Unit test pass; **live chưa chạy**. Lưu ý: `orders.course_id` vẫn tồn tại trong 0001 (Task 03 QĐ 7 đổi bỏ sau backfill sang `order_items`) — đếm đơn không bị ảnh hưởng |
| 10 | Thanh toán | ⚠️ CÓ MỘT PHẦN | `payments` (chỉ dùng làm nguồn doanh thu) | Chỉ có tổng tiền `succeeded` (xem #8). **Không có:** số lượng giao dịch, phân rã theo trạng thái (`pending`/`succeeded`/`failed`/`refunded`), theo phương thức (`bank_transfer`/`sepay`/`stripe`), đơn `paid` chưa có enrollment / payment không khớp order (M12 R9 đối soát) | Không có thẻ/mục riêng; chỉ hiện gián tiếp qua hint nguồn doanh thu | Code đọc `payments` đã được test qua fallback; nhưng **không có chỉ số “thanh toán” độc lập nào** để kiểm chứng |
| 11 | Email | ❌ KHÔNG | Bảng có sẵn nhưng **không được đọc**: `email_logs` (`to_email`, `template`, `resend_id`, `status` ∈ queued/sent/delivered/bounced/failed), `newsletter_subscribers` (`email`, `status` ∈ subscribed/unsubscribed) | **Không có công thức nào.** Không đếm email gửi/delivered/bounced/failed theo template, không đếm subscriber, không cảnh báo chạm giới hạn Resend (M12 R8 yêu cầu) | Không hiển thị ở `/admin` | Grep toàn `apps/web/src` + `workers/api/src`: **0 lần nhắc** `email_logs` / `newsletter_subscribers`. Form newsletter (`newsletter.ts`) chỉ POST `/api/v1/newsletter`, không đọc lại số liệu |
| 12 | Tỷ lệ chuyển đổi | ❌ KHÔNG | Có dữ liệu nền nhưng chưa nối: `leads` (`status` ∈ new/contacted/enrolled/closed/spam, `course_id`, `source`, `province`), `orders`, `enrollments` | **Không có công thức nào trong code.** Grep “conversion / chuyển đổi” chỉ ra đặc tả ở `SYSTEM_MODULES.md` (M12 R1/R2, M08) — chưa implement. Công thức đề xuất (chưa chốt, cần user/coordinator chốt): `đơn paid có nguồn từ lead / tổng lead` hoặc `enrollment từ lead / tổng lead` — phải chốt mẫu số (tất cả lead hay trừ `spam`?) và cách nối lead→đơn (hiện chỉ khớp mềm theo email rồi SĐT trong `crm.ts` `classifyLead()`, không có FK cứng theo M08) | Không hiển thị ở `/admin` | Không có code, không có test |

## 3. Kiểm chứng live đã chạy thật (10/11/2026)

Chạy bằng anon key trong `apps/web/.env.local` (project prod
`ugynqjqyfynkmqutoarp.supabase.co`; staging là project khác
`scskhplczrxlnxzruweu.supabase.co` — chỉ ghi host, không ghi key):

```text
GET /rest/v1/<table>?select=id  (Prefer: count=exact, anon key)
courses                 HTTP 200  content-range: 0-9/10
profiles                HTTP 200  content-range: */0
enrollments             HTTP 200  content-range: */0
orders                  HTTP 200  content-range: */0
payments                HTTP 200  content-range: */0
lesson_progress         HTTP 200  content-range: */0
quiz_attempts           HTTP 200  content-range: */0
leads                   HTTP 200  content-range: */0
newsletter_subscribers  HTTP 200  content-range: */0
email_logs              HTTP 200  content-range: */0
```

- **Kết luận từ query live:** chỉ chứng minh được (a) project prod còn sống,
  (b) bảng `courses` có **10 dòng public thật** (khớp seed 10 khóa trong
  `BACKEND_TEST_REPORT.md` §5D–§5G), (c) mọi bảng admin-only đều trả **0 dòng cho
  anon** — đúng RLS (vd. `payments_admin_read`, `leads_admin_read` chỉ cho admin).
- **Không kết luận được gì thêm:** với anon key, “0 dòng” không phân biệt được
  “bảng trống” với “bị RLS chặn”. Vì vậy **không có số liệu vận hành thật nào
  (học viên, đơn, doanh thu…) được xác nhận trong báo cáo này** — cần chạy lại
  `getAdminDashboardStats()` bằng JWT admin (hoặc kiểm tra trực tiếp trang
  `/admin` khi đăng nhập admin) mới biết các chỉ số hiện ra số mấy.
- **Không có dữ liệu giả:** toàn bộ code dashboard trả 0 / mảng rỗng khi chưa có
  dữ liệu (test empty-state khẳng định), trang `/admin` có empty state “Chưa có
  dữ liệu” khi `totalStudents = totalCourses = totalEnrollments = totalOrders = 0`.

## 4. Kiểm thử code đã chạy thật (10/11/2026, 23:42–23:48 +07)

| Lệnh | Kết quả |
|---|---|
| `npx vitest run src/lib/admin-dashboard.test.ts src/lib/dashboard.test.ts` (apps/web) | **53/53 PASS** (admin-dashboard 17 test, dashboard 36 test) — công thức tính, fallback doanh thu, empty state, video 90% đều pass với **fake client** (mô phỏng chuỗi query supabase-js), không phải DB thật |
| `npx vitest run src/lib/admin-dashboard.test.ts` (chạy lại sau khi file bị sửa song song) | **17/17 PASS** |
| `npx tsc --noEmit --incremental false` (apps/web) | **PASS, exit 0, 0 lỗi** tại snapshot 23:48 +07 — lưu ý lần chạy trước đó (23:42) còn 3 lỗi ở `app/admin/page.tsx` (`state.data` sau khi chỉ kiểm tra `error`, tham số `c`/`e` implicit any); file đã được agent khác sửa lúc 16:44:15 UTC (thêm nhánh `state.status !== 'success'`) nên lỗi đã hết |

## 5. Thiếu sót / rủi ro (xếp theo mức độ)

### 5.1. Thiếu chỉ số (cần làm thêm để đủ 12)

1. **Điểm quiz (❌):** thêm tổng hợp từ `quiz_attempts` — điểm trung bình / bài,
   / khóa, tỷ lệ đạt (`passed`), câu hỏi sai nhiều nhất (cần join `quiz_answers`
   + `question_options`). Lưu ý 0014 đã có `passed`/`status` để dùng; và lỗi
   T08-5 (nộp quiz đạt chưa đánh dấu `lesson_progress` completed) vẫn ảnh hưởng
   tới tỷ lệ hoàn thành của khóa có bài quiz.
2. **Email (❌):** thêm tổng hợp từ `email_logs` (gửi/delivered/bounced/failed
   theo template) + `newsletter_subscribers` (tổng subscriber, tăng mới).
   Hiện không có dòng code nào đọc 2 bảng này.
3. **Tỷ lệ chuyển đổi (❌):** chốt định nghĩa rồi implement — đề xuất:
   `enrollments có nguồn lead / tổng lead (trừ spam)` và/hoặc
   `orders paid có nguồn lead / tổng lead`; cần chốt mẫu số + cách nối
   (hiện chỉ có khớp mềm email/SĐT ở `crm.ts`).
4. **Thanh toán (⚠️):** tách thành chỉ số riêng — số giao dịch theo trạng thái
   và phương thức; đối soát R9 (đơn `pending` quá 48h, đơn `paid` chưa có
   enrollment, payment không khớp order).
5. **Lượt đăng ký (⚠️):** đưa tổng lead + lead theo trạng thái/nguồn/khóa/tỉnh
   lên dashboard (M12 R2); hiện chỉ có danh sách ở `/admin/crm`.

### 5.2. Đối chiếu với đặc tả M12 (Task 02) — phần lớn chưa làm

| Báo cáo M12 | Trạng thái |
|---|---|
| R1 Tổng quan | ⚠️ Một phần — thiếu tổng lead + tỷ lệ chuyển đổi |
| R2 Lead | ⚠️ Danh sách + phân loại có ở `/admin/crm`, thiếu số tổng hợp theo thời gian/nguồn/khóa/tỉnh |
| R3 Học viên theo khóa | ⚠️ Một phần — có ghi danh + % hoàn thành / khóa, thiếu số chứng chỉ / khóa và xếp hạng khóa |
| R4 Doanh thu | ⚠️ Chỉ có tổng doanh thu; thiếu theo ngày/tuần/tháng, theo khóa, theo phương thức, đơn pending quá hạn, hoàn trả |
| R5 Tiến độ học tập | ⚠️ Chỉ có % hoàn thành; thiếu học viên không học 7/14/30 ngày, bài bị bỏ nhiều nhất |
| R6 Quiz | ❌ Chưa có |
| R7 Sự kiện | ❌ Chưa có (bảng `events`/`event_registrations` có sẵn) |
| R8 Email | ❌ Chưa có |
| R9 Đối soát thanh toán | ❌ Chưa có |
| R10 Tăng trưởng | ❌ Chưa có (học viên mới/tuần, MAU, retention 7/30 ngày; mục tiêu $100M — lợi nhuận/giá trị ròng nhập tay theo DECISIONS Task 02 QĐ 12 — cũng chưa có chỗ nhập/hiển thị) |

### 5.3. Lệch kiến trúc + giới hạn kỹ thuật

- **Lệch M12:** kiến trúc yêu cầu “mọi báo cáo đều tổng hợp ở server (Workers
  API), có cache và phân trang — không tổng hợp nặng bằng RLS admin đọc trực
  tiếp”. Hiện tại `getAdminDashboardStats()` đọc trực tiếp bằng JWT admin qua
  Supabase client. Với quy mô 100–1.000 học viên thì chạy được, nhưng cần ghi
  nhận là chưa theo kiến trúc đã duyệt; khi dữ liệu lớn lên phải chuyển sang
  RPC/Workers + cache.
- **Giới hạn đếm:** tổng tiền đọc theo trang 1.000 dòng, tối đa 10 trang
  (10.000 dòng); `lesson_progress` (học viên hoạt động + tiến độ) và
  `enrollments` đều `.limit(1000)` — vượt ngưỡng sẽ đếm thiếu mà không báo.
  Cần RPC aggregate khi vượt ngưỡng (đã ghi trong header file).
- **Định nghĩa “Tổng học viên”:** đếm mọi dòng `profiles`, kể cả tài khoản
  admin/instructor — đã ghi rõ trong comment code, nhưng UI không chú thích;
  dễ hiểu lầm là “học viên đang học”.
- **Không có lọc theo thời gian / xuất CSV** trên dashboard (M12 yêu cầu ở
  giai đoạn sau — chưa phải blocker).

### 5.4. Việc còn cần kiểm chứng live (chưa làm được trong task này)

- [ ] Mở `/admin` bằng tài khoản admin thật trên staging/prod, đối chiếu từng
      thẻ với số dòng thật trong Supabase (đặc biệt doanh thu + tỷ lệ hoàn thành).
- [ ] Kiểm tra empty state hiển thị đúng khi DB chưa có dữ liệu (hiện chỉ mới
      test bằng fake client).
- [ ] Kiểm tra `revenueWarning` hiện đúng khi bảng `payments` chưa sẵn sàng.
- [ ] Chốt định nghĩa tỷ lệ chuyển đổi + ngưỡng “học viên không học” rồi mới
      implement R5/R6/R8/R9/R10.

## 6. File tham chiếu

- Data layer: `apps/web/src/lib/admin-dashboard.ts` (499 dòng),
  test: `apps/web/src/lib/admin-dashboard.test.ts` (17 test).
- UI: `apps/web/src/app/admin/page.tsx` (189 dòng), guard admin:
  `apps/web/src/app/admin/layout.tsx` (`requireAdmin`).
- Hỗ trợ: `apps/web/src/lib/dashboard.ts` (`isLessonCompleted`,
  `computeModuleProgress`, `computeCourseProgress`, `getMyCourseProgress`),
  `apps/web/src/lib/quiz.ts` (`gradeQuizAttempt`, `fetchQuizHistory`),
  `apps/web/src/lib/crm.ts` (`fetchCrmLeads`, `classifyLead`),
  `apps/web/src/lib/newsletter.ts` (chỉ submit, không thống kê).
- Schema: `supabase/migrations/0001_init_schema.sql` (bảng + RLS),
  `0014_quiz_bank.sql` (`quiz_attempts` mở rộng),
  `docs/database/DATABASE_SCHEMA.md` §3.
- Kiến trúc: `docs/architecture/SYSTEM_MODULES.md` §M12 (R1–R10),
  `docs/DECISIONS.md` QĐ 17 (ngưỡng hoàn thành) + Task 02 QĐ 12 ($100M nhập tay).
