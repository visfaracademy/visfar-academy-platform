# TASK 10 — Payment & Commerce — Báo cáo kiểm thử

- **Dự án:** Visfar Academy (Next.js App Router + Supabase + Cloudflare Workers)
- **Ngày kiểm thử:** 10/11/2026 — snapshot cuối **17:22–17:24 UTC** (sau ~90 giây không còn file nguồn nào thay đổi; trước đó repo liên tục có code hạ cánh song song từ các task khác)
- **Người kiểm thử:** subagent kiểm thử Task 10 (chỉ viết test, không viết implementation)
- **Căn cứ:** kiến trúc Task 02 (`docs/architecture/`), schema Task 03, `DECISIONS.md` (QĐ 9, 11, 15, 17)
- **Log kiểm thử:** `/tmp/t10_final_web_test.log`, `/tmp/t10_final_web_typecheck.log`, `/tmp/t10_final_web_lint.log`, `/tmp/t10_final_web_build.log`, `/tmp/t10_final_workers_test.log`, `/tmp/t10_final_workers_typecheck.log`

## Tóm tắt

Hệ thống thanh toán & thương mại đã hạ cánh đầy đủ ở cả 3 tầng: migration 0019, Workers API (SePay webhook + orders + admin), web client + 6 trang. Toàn bộ kiểm thử local **đạt**: web 570/570, Workers 284/284, typecheck + lint + build đều PASS, mọi migration PARSE OK. Hai lỗi thật do test phát hiện (B-T10-2, B-T10-5) đã được sửa trong ngày. Còn **9 phát hiện nhỏ** (mục 5.4) và **8 điểm cần phê duyệt** (mục 7) trước khi triển khai live. **Chưa có test live nào chạy** — không tiền thật, không đơn thật trên prod, không webhook SePay thật, migration 0019 chưa áp cho bất kỳ DB live nào, Workers chưa deploy.

## 1. File giữ nguyên

- Migrations `0001`–`0016`, `0018` (không sửa nội dung; chỉ đổi số hiệu 2 file 0017 — xem mục 3, do task khác thực hiện).
- Schema gốc Task 01/03: `orders`, `payments`, `order_items`, `coupons`, `memberships`, `enrollments`, `system_settings` — 0019 chỉ ALTER/ADD, không DROP bảng, không sửa cột cũ.
- RLS gốc: không có policy INSERT/UPDATE/DELETE client cho `orders`/`payments` (chỉ `orders_select_own`, `payments_admin_read`) — 0019 chỉ thêm policy admin.
- `apps/web/src/lib/api-client.ts` (đã có sẵn `payment_mismatch`, `idempotency_conflict`, `postJson({idempotencyKey})`, `newIdempotencyKey()`).
- Tài liệu kiến trúc Task 02/03, `DECISIONS.md`.
- `workers/api/src/handlers/course-completion.ts` — thuộc task khác, không thuộc Task 10 (chưa rà soát).

## 2. File sửa

| File | Thay đổi |
|---|---|
| `workers/api/src/env.ts` | Khai báo thêm `SEPAY_WEBHOOK_SECRET?`, `SEPAY_API_TOKEN?` (tên cũ `SEPAY_API_KEY` đã đổi theo `SEPAY_INTEGRATION.md` §8, 11/11/2026), `SEPAY_BANK_ACCOUNT_ID?`, `SEPAY_MERCHANT_ID?` |
| `workers/api/src/index.ts` | Thêm toàn bộ route Task 10 (xem mục 4) + route `POST /api/v1/my/orders/:id/refund-request` |
| `workers/api/.dev.vars.example` | Thêm tên biến `SEPAY_WEBHOOK_SECRET`, `SEPAY_API_TOKEN` (tên cũ `SEPAY_API_KEY` đã đổi, 11/11/2026), `SEPAY_BANK_ACCOUNT_ID`, `SEPAY_MERCHANT_ID` (dạng `# ...=<redacted>`, không giá trị thật) |
| `apps/web/src/lib/payments.test.ts` | Mở rộng: assert migration 0019 (56 statements), seed `system_settings`, inventory handler/route, test nhất quán B-T10-2 (0019 không có `cancelled_at` ↔ `payments.ts` không ghi cột này). File này còn được agent web-side cập nhật cùng lúc (assert 6 trang) |
| `scripts/check-migrations.mjs` | Sửa bởi task khác cùng ngày (đổi số hiệu migration 0017 → 0020/0021) — không thuộc Task 10 |

## 3. File mới

**Backend — migration & Workers:**

| File | Nội dung |
|---|---|
| `supabase/migrations/0019_commerce_payment.sql` (404 dòng, 56 statements, PARSE OK) | (A) `orders`: `coupon_id`, `original_amount_vnd`, `discount_vnd`, `paid_at`, `refund_*`, `idempotency_key` + partial UNIQUE index (NULL được phép), `idempotency_body_hash`, sequence + `generate_order_reference()` → `DH-YYYY-NNNNNN` làm DEFAULT cho `reference_code`; (B) `orders.user_id` nullable + FK SET NULL; (C) `order_items` CHECK `total = unit_price × quantity` + CHECK 1 loại hàng/dòng; (D) index `payments (method, gateway_reference)`; (E) `coupons` thêm `min_order_vnd`/`max_discount_vnd`/`created_by`, CHECK percent ≤ 100; (F) `membership_plans.course_id`, `memberships` thêm status `pending` + `expires_at` GENERATED từ `ends_at`; (G) `courses.is_pay_what_you_want` default false (chưa bật khóa nào); (H) seed 9 key `system_settings` (7 key Task 03 + `payment.provider="sepay"` + `payment.bank_name="MB Bank"`, không số tài khoản, không secret); (I) RLS `payments_insert_admin` (`verified_by = auth.uid()`) + `orders_update_admin`; RPC `apply_coupon_use` / `release_coupon_use` (atomic, chặn ở `max_uses`) |
| `workers/api/src/sepay.ts` (~400 dòng) | `verifySepayWebhookSignature` (+ alias `verifySepaySignature`), `timingSafeEqual`, `extractReferenceCode`, `getSepaySignatureHeader`, `parseSepayPayload`, `decideIdempotencyReplay`, `isIdempotencyKeyExpired`, `checkPaymentAmount`, `findDuplicatePayment`, `canGrantEnrollment`, `shouldRevokeEnrollment`, `addWorkingDays`, `isRefundRequestInWindow`, `complaintResponseDeadline` |
| `workers/api/src/payments.ts` (~1.800 dòng) | Service core: `createOrder`, `confirmPayment`, `processSepayWebhook`, `grantAccessForOrder`, `cancelOrder`, `expirePendingOrders`, `requestRefund`, `executeRefund`, `enrollFreeCourse`, `computeCouponDiscount`, `computeOrderTotals`, `canonicalOrderBody`, `toOrderSummary`; hằng số `PAYMENT_BANK_NAME='MB Bank'`, `PAYMENT_ACCOUNT_HOLDER='Công ty TNHH MTV Visfar Holdings'`, giữ đơn 48h, hoàn trả 15 ngày làm việc, rate-limit 300 req/h/user |
| `workers/api/src/handlers/payments.ts` | HTTP: tạo/xem/hủy đơn, đơn của tôi, giao dịch của tôi, validate coupon, gói thành viên, ghi danh miễn phí, webhook SePay, yêu cầu hoàn trả |
| `workers/api/src/handlers/payments-admin.ts` | HTTP admin: list đơn, mark-paid, refund, expire-sweep, CRUD coupon, CRUD gói, list payments (đối soát R9) |

**Frontend — web:**

| File | Nội dung |
|---|---|
| `apps/web/src/lib/payments.ts` (18,7 KB) | Client gọi Workers API qua `api-client` (JWT + Idempotency-Key); hàm pure `computeCouponDiscount`/`computeOrderTotals` giữ đồng bộ với Workers; `createOrder`, `fetchOrder`, `fetchMyOrders`, `fetchMyTransactions`, `cancelOrder`, `validateCoupon`, `fetchMembershipPlans` (public), `enrollFreeCourse`, `requestRefund`, admin `fetchAdminOrders`/`markOrderPaid`/`refundOrder`/`expireOrdersSweep`/`fetchAdminCoupons`/`createCoupon`/`toggleCoupon`/`fetchAdminPlans`/`createPlan`/`fetchAdminPayments`. Không có Next API route cho orders/webhook — theo thiết kế (ghi chú trong test G-T10-3b): RLS không cho client INSERT `orders`, service-role key không bao giờ đưa vào web |
| `apps/web/src/app/thanh-toan/[orderId]/page.tsx` | Trang thanh toán: hiển thị ngân hàng, chủ tài khoản, số tiền, nội dung chuyển khoản (mã đơn) + nút sao chép + mã QR từ file `/qr-chuyen-khoan.png` do user tải lên; không có số tài khoản trong code |
| `apps/web/src/app/hoc-vien/giao-dich/page.tsx` | Lịch sử giao dịch học viên |
| `apps/web/src/app/goi-thanh-vien/page.tsx` | Gói thành viên |
| `apps/web/src/app/admin/don-hang/page.tsx` | Admin quản lý đơn |
| `apps/web/src/app/admin/ma-giam-gia/page.tsx` | Admin quản lý mã giảm giá |
| `apps/web/src/app/admin/goi-thanh-vien/page.tsx` | Admin quản lý gói thành viên |
| `apps/web/src/components/payment/CheckoutButton.tsx` | Nút thanh toán (validate coupon + tạo đơn) |

**Test (do subagent kiểm thử viết):**

| File | Số test |
|---|---|
| `workers/api/test/sepay.test.ts` | 24 |
| `workers/api/test/sepay-contract.test.ts` | 29 |
| `workers/api/test/payments.test.ts` (service + HTTP qua `handleRequest`) | 59 |
| `apps/web/src/lib/payments-client.test.ts` (mới) | 12 |
| `apps/web/src/lib/payments.test.ts` (mở rộng, 40 test) | — |

## 4. Chức năng

**Route Workers API (`/api/v1`, base `https://visfaracademy.netlify.app/api/v1`):**

| Route | Auth | Hành vi chính |
|---|---|---|
| `POST /orders` | JWT | Tạo đơn, giá lấy từ DB, giữ đơn 48h, trả `reference_code` + khối chuyển khoản; 201 mới / 200 trùng key / 409 khác body |
| `GET /orders/:id` | JWT (chủ đơn) | Xem đơn; người khác → 404 |
| `POST /orders/:id/cancel` | JWT (chủ đơn) | Hủy đơn pending; hủy lại → 409 |
| `GET /my/orders` | JWT | Đơn của tôi + phân trang |
| `GET /my/transactions` | JWT | Giao dịch của tôi (join đơn) |
| `POST /coupons/validate` | JWT | Kiểm tra mã, trả discount + số tiền sau giảm |
| `GET /membership-plans` | Công khai | Gói đang bán |
| `POST /my/enrollments` | JWT | Ghi danh khóa miễn phí; 201 mới / 200 đã ghi danh |
| `POST /my/orders/:id/refund-request` | JWT (chủ đơn) | Yêu cầu hoàn trả đơn đã paid, trong hạn 15 ngày làm việc; gửi lại → 409 |
| `POST /webhooks/sepay` (+ alias `/api/webhooks/sepay`) | Chữ ký HMAC | Xem luồng webhook bên dưới |
| `GET /admin/orders` | Admin | List + lọc status/q/refundRequested, kèm hồ sơ học viên |
| `POST /admin/orders/:id/mark-paid` | Admin | Xác nhận đã nhận tiền sau khi kiểm tra sao kê (amount + gatewayReference) |
| `POST /admin/orders/:id/refund` | Admin | Hoàn trả (reason + refundBankReference bắt buộc; `forceReason` cho đơn quá hạn) |
| `POST /admin/orders/expire-sweep` | Admin | Quét đơn pending quá hạn → `expired` |
| `GET/POST /admin/coupons`, `PATCH /admin/coupons/:id` | Admin | CRUD mã (chỉ bật/tắt qua PATCH) |
| `GET/POST /admin/membership-plans` | Admin | Quản lý gói |
| `GET /admin/payments` | Admin | Đối soát giao dịch (R9) |

**Luồng webhook SePay (11 bước, theo `API_ARCHITECTURE.md` §10.1):** 1. Đọc raw body → 2. Verify chữ ký HMAC-SHA256, sai/thiếu → 401, không ghi DB → 3. Parse payload, tách `reference_code` (`DH-YYYY-NNNNNN`) từ nội dung chuyển khoản → 4. Không tìm thấy đơn → 200 `matched:false` + audit `order.webhook_unmatched`, không đổi đơn nào → 5. Số tiền phải khớp tuyệt đối (sai lệch 0đ), lệch → 200 `payment_mismatch`, đơn giữ `pending`, ghi `payments` `failed` + audit → 6. Chống trùng bằng UNIQUE (`method`, `gateway_reference`): gửi lại → 200 `duplicate:true`, 1 payment, 1 enrollment → 7. Khớp → `payments` `succeeded` → đơn `paid` → enrollment → email E4 (đánh số theo Task 11) → `email_logs`. Không bao giờ tin client tự báo "đã trả".

**Coupon & Tùy tâm:** percent (trần `max_discount_vnd`) / `fixed_vnd` (trần bằng số tiền đơn); kiểm tra active, hiệu lực, lượt dùng, đơn tối thiểu; 100% → đơn 0đ, tự động paid + ghi danh, không tạo payment. Khóa Tùy tâm (`is_pay_what_you_want`): chỉ khóa đó được nhập `customAmountVnd`, không dùng chung coupon. Đơn 0đ (khóa miễn phí / coupon 100%) tự paid + ghi danh ngay khi tạo.

**Hoàn trả:** học viên yêu cầu trong hạn 15 ngày làm việc kể từ `paid_at` (tính theo ngày làm việc, bỏ T7/CN); admin thực hiện hoàn trả **thủ công qua chuyển khoản ngân hàng** (không gọi API hoàn tiền SePay); hoàn trả → đơn `refunded`, payment `refunded`, thu hồi enrollment + chứng chỉ, giải phóng lượt coupon, hủy membership (chỉ đổi status), ghi audit `order.refund`, gửi thông báo in-app. **Không gửi email hoàn trả** (Task 11 chưa có template) và **không gửi email khi tạo đơn** — chỉ log + hướng dẫn trên trang.

**Khác:** rate-limit tạo đơn 300 req/h/user (+ 100 req/phút/IP); `Idempotency-Key` hiệu lực 24h; email đơn đã thanh toán là E4 theo đánh số Task 11 (khác với E8 trong `SYSTEM_ARCHITECTURE.md` §9 — xem mục 5.4); đối soát qua `GET /admin/orders` + `GET /admin/payments`, không ghi đơn ra Google Sheet (Sheet chỉ là bản sao đối soát lead theo QĐ 5).

## 5. Kết quả kiểm thử

### 5.1 Local — chạy thật (snapshot 17:22–17:24 UTC 10/11/2026)

| Lệnh | Kết quả |
|---|---|
| Web `npm test` | **570/570 PASS** (27 file), gồm Task 10: `payments.test.ts` 40, `payments-client.test.ts` 12 |
| Web `npm run typecheck` | **PASS** (`tsc --noEmit`, exit 0) |
| Web `npm run lint` | **PASS** (`eslint .`, exit 0) |
| Web `npm run build` | **PASS** (compiled 8.0s; đủ route `/thanh-toan/[orderId]`, `/admin/don-hang`, `/admin/ma-giam-gia`, `/admin/goi-thanh-vien`) |
| Workers `npm test` | **284/284 PASS** (10 file), gồm Task 10: `payments.test.ts` 59, `sepay.test.ts` 24, `sepay-contract.test.ts` 29 |
| Workers `npm run typecheck` | **PASS** (exit 0) |
| Parse migration (pglast, Python) | **Tất cả 21 file PARSE OK** — 0019: 56 statements; 0020: 10; 0021: 6 |

### 5.2 Đối chiếu yêu cầu kiểm thử của Task 10

| Yêu cầu | Cách test | Kết quả |
|---|---|---|
| Webhook signature đúng/sai | `sepay.test.ts`: HMAC đúng → true; sai 1 ký tự / sai body / sai secret / secret rỗng / chữ ký null-rỗng-khoảng trắng / không phải hex → false (fail-closed); chấp nhận tiền tố `sha256=`, `Bearer `, hex hoa; HTTP: sai chữ ký → 401, không ghi DB | PASS |
| Idempotency: trùng key trả kết quả cũ | Service + HTTP: cùng key + cùng body → 200 `duplicate:true`, đúng 1 đơn | PASS |
| Idempotency: cùng key khác body → 409 | Service + HTTP: → 409 `idempotency_conflict` | PASS |
| Idempotency hết hạn 24h | Key tạo 25h trước → tạo đơn mới, đơn mới **không mang key cũ** (hồi quy B-T10-5) | PASS |
| Chống trùng thanh toán (UNIQUE method+gateway_reference) | Mock PostgREST mô phỏng UNIQUE thật (409 `23505`); webhook gửi lại + mark-paid gửi lại → `duplicate:true`, 1 payment, 1 enrollment; `gateway_reference` NULL không tính trùng | PASS |
| Kiểm tra số tiền: khớp sai lệch 0đ | Exact amount → paid + enrollment; lệch −1đ → 422 `payment_mismatch`, đơn giữ `pending`, payment `failed` + audit, không enrollment | PASS |
| Không cấp quyền khi chưa xác minh | `canGrantEnrollment` chỉ true khi đơn `paid` + payment `succeeded` + đã verify; webhook sai chữ ký / sai tiền / không khớp mã → không enrollment; HTTP: không JWT → 401, JWT hết hạn → 401, học viên gọi admin → 403, xem đơn người khác → 404 | PASS |
| Hoàn trả 15 ngày làm việc / khiếu nại 3 ngày | `addWorkingDays` bỏ T7/CN; paid 10/11/2026 + 15 ngày làm việc = 01/12/2026 (yêu cầu ngày 01/12 được, 02/12 không); khiếu nại +3 ngày | PASS (lưu ý: "3 ngày" đang hiểu là ngày lịch — xem mục 7) |
| Frontend client | `payments-client.test.ts`: pure pricing parity với Workers (cùng số, cùng reason); `createOrder` gửi đúng path/header JWT + Idempotency-Key; 409 → error; offline → `isOffline:true`; chưa đăng nhập → `signed-out`; `fetchMembershipPlans` public, không gửi Authorization | PASS |

### 5.3 Lỗi thật do test phát hiện — đã sửa trong ngày

- **B-T10-5 (hết hạn Idempotency-Key):** key hết hạn 24h nhưng `createOrder` vẫn insert đơn mới mang key cũ → UNIQUE chặn → nhánh race trả về đơn cũ, key hết hạn không bao giờ có hiệu lực. **Đã sửa:** key hết hạn → `effectiveIdempotencyKey = null`, đơn mới không mang key. Hệ quả theo spec: sau 24h, mỗi lần retry tạo 1 đơn mới (không dedup). Test hồi quy giữ nguyên assert, đã PASS.
- **B-T10-2 (hoàn trả gói thành viên):** `executeRefund` từng PATCH `memberships` với cột `cancelled_at` không tồn tại (0004) → PostgREST lỗi PGRST204, membership ở lại `active` sau hoàn trả. **Đã sửa theo hướng khác với ghi chú ban đầu:** không thêm cột vào 0019; `executeRefund` hiện chỉ PATCH `{ status: 'cancelled' }` (comment trong code ghi rõ lý do). Test hồi quy + test nhất quán web (0019 không chứa `cancelled_at` ↔ code không ghi cột này) đã PASS. Nếu sau này thêm cột, phải đổi cả migration mới và code cùng lúc.

### 5.4 Phát hiện còn lại (chưa sửa — mức thấp/trung bình, không chặn triển khai staging)

1. **(b)** Webhook thiếu số tiền (`amount = null`) trả 200 `payment_mismatch` nhưng **không ghi audit log, không ghi payment `failed`** — không nhất quán với nhánh lệch tiền (có log + failed row). Nên bổ sung log để đối soát.
2. **(a)** Nhánh lệch tiền trong `confirmPayment` insert payment `failed` mà không kiểm tra kết quả: gửi lại cùng mã giao dịch sẽ chạm UNIQUE và bị nuốt lặng (vô hại — không tạo được dòng trùng — nhưng nên kiểm tra để rõ ràng).
3. **(c)** `applyCouponUse` được gọi mà không dùng giá trị trả về; RPC tự chặn ở `max_uses`, nhưng nếu coupon vừa hết lượt do đơn khác chen ngang giữa lúc validate và lúc thanh toán, người mua vẫn giữ discount mà `used_count` không tăng (race nhỏ).
4. **(d)** Kiểm tra mua trùng chỉ chặn enrollment `active`, không chặn `completed` — học viên đã hoàn thành khóa có thể mua lại khóa đó (có thể là chủ ý — cần quyết định).
5. **(e)** `grantAccessForOrder` không tự kiểm tra paid/verified mà tin caller (đường 0đ và `confirmPayment` đã gate bằng `canGrantEnrollment` với `verified:true` hardcode) — đúng thiết kế hiện tại, nhưng hàm này không an toàn nếu gọi trực tiếp từ nơi khác.
6. **(f)** Thông báo hoàn trả luôn ghi "đã hoàn trả … trong 15 ngày làm việc" kể cả khi dùng `forceReason` (đơn đã quá hạn) — sai ngữ nghĩa với trường hợp quá hạn.
7. **(g/h)** Không gửi email khi tạo đơn và khi hoàn trả (Task 11 chưa có template) — chỉ thông báo in-app (hoàn trả) / hướng dẫn trên trang (tạo đơn).
8. **(i)** Upsert enrollment ghi đè `order_id` khi trùng: hoàn trả đơn cũ có thể không thu hồi được enrollment mà `order_id` đã bị đơn mới ghi đè (trường hợp biên).
9. **(j)** Sau một lần mark-paid lệch tiền, thử lại với **cùng** mã giao dịch sẽ bị chặn `duplicate` (do dòng `failed` đã tồn tại) — admin muốn sửa số tiền phải dùng mã giao dịch khác.
10. **Đánh số template lệch:** email đơn đã thanh toán là E4 theo Task 11, nhưng `SYSTEM_ARCHITECTURE.md` §9 gọi là E8 (E4 ở đó là email admin có lead mới). Cần thống nhất một bảng đánh số.
11. **Chữ ký SePay chưa xác thực:** thuật toán HMAC-SHA256 trên raw body + header `x-sepay-signature` là **giả định theo hợp đồng nội bộ**, chưa đối chiếu tài liệu chính thức SePay (file `docs/database/SEPAY_INTEGRATION.md` vẫn chưa có — test G-T10-4 ghi nhận). Nếu tài liệu thật khác, chỉ cần đổi `verifySepaySignature()` + test chữ ký.
12. **Hai hàm hoàn trả song song:** `refundOrder()` trong `apps/web/src/lib/lms-admin.ts` (Task 09, ghi trực tiếp Supabase, không chặn hạn 15 ngày, không thu hồi enrollment, không có test) và `refundOrder()` trong `apps/web/src/lib/payments.ts` (Task 10, qua Workers `executeRefund`, đầy đủ luồng). Chỉ nên giữ một đường chuẩn (Workers) để tránh hai luồng hoàn trả lệch nhau.

### 5.5 Live — CHƯA CHẠY

Không có test live nào được chạy, theo đúng chỉ đạo của task:

- **Không thu tiền thật, không tạo đơn thật trên prod, không gọi webhook SePay thật khi chưa phê duyệt.**
- Migration 0019 chưa áp cho bất kỳ DB live nào (mới parse-check); Workers chưa deploy; chưa có dữ liệu đơn/giao dịch thật.
- Các mục live cần chạy sau phê duyệt (V-T10-*): webhook end-to-end với giao dịch SePay thật (sandbox/prod) đúng số tiền → đơn paid + enrollment + email E4; webhook sai tiền / sai mã đơn / gửi lại; admin mark-paid sau khi kiểm tra sao kê MB Bank thật; hoàn trả với chuyển khoản MB Bank thật + kiểm tra thu hồi quyền; đối soát R9; email E4 đến hộp thư thật (sau khi xác minh DNS Resend); trang `/thanh-toan/[orderId]` hiển thị đúng khối chuyển khoản + quét thử mã QR; hết hạn đơn 48h + email nhắc 12h/24h.

## 6. Phương án rollback

- **Migration 0019 chỉ thêm (additive) và có guard `if not exists`:** rollback = deploy lại code Workers phiên bản trước + giữ nguyên các cột 0019 (không bắt buộc xóa). Không bao giờ sửa file 0019 sau khi đã áp lên staging/prod; mọi sửa đổi sau đó phải là migration mới.
- **Nếu cần gỡ cột:** viết migration mới DROP cột/index, không sửa 0019. Đơn đã `paid` vẫn giữ `paid`; enrollment đã cấp không tự thu hồi khi rollback code (chỉ thu hồi qua luồng hoàn trả).
- **Webhook secret:** xoay bằng `wrangler secret put SEPAY_WEBHOOK_SECRET` (secret cũ mất hiệu lực ngay — webhook SePay đang bay tới sẽ 401 cho tới khi SePay cập nhật secret mới; phối hợp thời điểm xoay với phía SePay).
- **Tắt thanh toán khẩn cấp:** đặt `payment.provider` / khóa endpoint webhook ở Workers (trả 401) trong khi giữ nguyên web — trang thanh toán sẽ báo lỗi rõ ràng thay vì "ok" giả.
- **Dữ liệu:** không có dữ liệu live nào để rollback ở thời điểm báo cáo (chưa triển khai).

## 7. Cần phê duyệt trước khi triển khai live

1. **Xác nhận scheme chữ ký SePay thật** (thuật toán + tên header) theo tài liệu chính thức / file `SEPAY_INTEGRATION.md` (đang do agent khác soạn). Hiện tại code giả định HMAC-SHA256 trên raw body, secret `SEPAY_WEBHOOK_SECRET`.
2. **Gói/thời gian kích hoạt SePay:** xác nhận gói SePay, thời gian bật webhook, URL webhook prod trỏ tới Workers.
3. **Áp 0019 lên staging trước**, chạy checklist KIỂM CHUNG cuối file 0019 + chạy các mục live V-T10-* ở mục 5.5, rồi mới áp prod.
4. **Đặt secret thật:** `wrangler secret put SEPAY_WEBHOOK_SECRET` (+ `SEPAY_API_TOKEN` nếu dùng API SePay đối soát bù). Không commit secret vào repo; `.dev.vars.example` chỉ có tên biến.
5. **Xác minh DNS Resend (SPF/DKIM/DMARC)** trước khi gửi email E4 thật.
6. **Xác nhận danh sách khóa Tùy tâm:** hiện `is_pay_what_you_want` chưa bật cho khóa nào — khóa nào được nhập tùy tâm, khóa nào giá cố định (giá lấy từ DB, user chưa cung cấp giá).
7. **Quyết định các điểm còn mở:** (a) khiếu nại "3 ngày" = ngày lịch hay ngày làm việc; (b) học viên đã hoàn thành có được mua lại khóa không; (c) chấp nhận việc key hết hạn 24h → retry tạo đơn mới; (d) chấp nhận thiếu email tạo đơn + email hoàn trả (hoặc chờ template Task 11); (e) chỉ giữ một đường hoàn trả chuẩn qua Workers, bỏ/đóng đường `lms-admin.ts` trực tiếp.
8. **Quét thử mã QR** trên trang thanh toán bằng ứng dụng ngân hàng thật để xác nhận ra đúng tài khoản nhận (file QR do user tải lên, chưa ai quét thử).

## 8. Bổ sung sau snapshot 17:24 UTC (11/11/2026, builder Task 10)

Các thay đổi dưới đây hạ cánh sau khi báo cáo trên được snapshot; số liệu kiểm thử đã chạy lại đầy đủ sau mỗi thay đổi.

### 8.1 Chữ ký webhook SePay — ĐÃ XÁC NHẬN theo tài liệu chính thức (đóng mục 5.4.11 và 7.1)

File `docs/payment/SEPAY_INTEGRATION.md` đã có (nghiên cứu từ developer.sepay.vn / docs.sepay.vn, 10/11/2026). Scheme thật khác giả định ban đầu:

| Hạng mục | Giả định cũ (trước 11/11) | Đã xác nhận + đã sửa trong code |
|---|---|---|
| Chuỗi ký | HMAC-SHA256(raw body) | HMAC-SHA256(`"{timestamp}.{raw_body}"`) — `workers/api/src/sepay.ts` `verifySepayWebhookSignature(rawBody, signature, secret, timestamp)` |
| Header | `x-sepay-signature` (tên đoán) | `X-SePay-Signature: sha256={hex}` + `X-SePay-Timestamp` (Unix seconds) — `getSepayTimestampHeader()` |
| Chống replay | Không có | Từ chối timestamp lệch quá 5 phút (300 giây) — `isSepayTimestampFresh()` |
| Trả lời SePay | `{ok: true}` | **200 + `{"success": true}`** trong mọi phản hồi webhook đã nhận (kể cả không khớp đơn, lệch tiền) — SePay chỉ coi là thành công khi đủ cả 3 điều kiện (200/201 + `{"success": true}` + trong 30 giây); trả 200 thiếu `success:true` chỉ bị ghi thất bại, không retry |
| Tiền ra | Không lọc | Chỉ xử lý `transferType === 'in'`; webhook `out` trả 200 `success:true` + `ignored: 'transfer_out'`, không ghi DB |
| Mã đơn trong nội dung | Regex `DH-\d{4}-\d{6}` | Chấp nhận cả dạng mất gạch ngang do VietQR (`DH2026000123` → chuẩn hóa `DH-2026-000123`); dấu `-` có giữ nguyên sau khi quét VietQR động hay không vẫn cần kiểm tra thực tế khi test live (SEPAY_INTEGRATION.md §1.3) |
| `referenceCode` trong payload | Từng có nguy cơ nhầm là mã đơn | Đã ghi rõ trong code: đó là mã tham chiếu **ngân hàng** (VD `FT...`), không phải mã đơn; mã đơn chỉ trích từ `content`; `gateway_reference` = `payload.id` |

Test cập nhật theo scheme thật: `workers/api/test/sepay.test.ts` (ký kèm timestamp, stale/future timestamp → false, thiếu timestamp → false, `sha256=` + hex hoa OK) và `workers/api/test/payments.test.ts` (`signSepay` ký `{timestamp}.{body}`, mọi lần gọi webhook truyền `X-SePay-Timestamp`, thêm test tiền ra + mã mất gạch ngang). **Workers: 293/293 PASS** (tăng từ 284; +9 test mới).

### 8.2 Tên biến môi trường SePay — đổi theo SEPAY_INTEGRATION.md §8

`SEPAY_API_KEY` → **`SEPAY_API_TOKEN`** (Bearer Token API v2, dùng cho đối soát bù); thêm `SEPAY_BANK_ACCOUNT_ID?` (UUID tài khoản MB trên SePay — không phải số tài khoản) và `SEPAY_MERCHANT_ID?` vào `workers/api/src/env.ts`, `.dev.vars.example`, `wrangler.toml` (dạng comment `wrangler secret put`). Đã đổi cả trong `docs/architecture/INTEGRATION_PLAN.md` và `docs/supabase/ENVIRONMENT_CONFIG.md` cho nhất quán. Test G-T10-2b đã cập nhật và PASS. Web: **570/570 PASS**, typecheck + lint + build PASS.

### 8.3 Hai phát hiện 5.4 đã sửa

- **5.4(b) — webhook thiếu số tiền:** nhánh `amountVnd === null` trong `processSepayWebhook` trước đây trả 200 mà không để lại dấu vết; nay ghi audit `order.payment_mismatch` (chi tiết `reason: 'webhook_thieu_so_tien'`) để đối soát R9. Có test hồi quy.
- **5.4(f) — thông báo hoàn trả sai ngữ nghĩa khi quá hạn:** notification `order_refunded` trước đây luôn ghi "trong 15 ngày làm việc" kể cả hoàn cưỡng chế ngoài hạn; nay ghi rõ "hoàn trả ngoài hạn 15 ngày làm việc theo quyết định của quản trị viên" khi `inWindow === false`.

### 8.4 Hai đường hoàn trả — đã chốt một đường chuẩn (đóng một nửa mục 5.4.12)

`refundOrder()` trong `apps/web/src/lib/lms-admin.ts` (Task 09) đã gắn chú thích **DEPRECATED**: chỉ đổi status + audit, không ghi payments `refunded`, không thu hồi enrollment/membership/chứng chỉ, không chặn hạn 15 ngày. Đường chuẩn duy nhất là Workers `executeRefund()` qua `apps/web/src/lib/payments.ts` (trang `/admin/don-hang`). Hàm cũ được giữ lại để không vỡ code Task 09; không mở thêm route nào gọi nó. Việc xóa hẳn hàm cũ cần quyết định riêng (cần kiểm tra không còn nơi nào gọi).

### 8.5 Xung đột số hiệu migration — đã được task khác giải quyết

Ba file cùng số `0017` trước đây nay đã đánh lại: `0017_email_unsubscribe_logs.sql`, `0018_email_task11.sql`, `0019_commerce_payment.sql` (không đổi), `0020_lead_interactions.sql`, `0021_admin_user_disable.sql`. `node scripts/check-migrations.mjs` PASS; parse tất cả migration OK. Không còn trùng số.

### 8.6 Tích hợp SePay — những gì CHƯA làm (theo SEPAY_INTEGRATION.md)

- **Đối soát bù qua API v2** (`GET /v2/transactions`, lọc `webhook_success=0` / `since_id`, Bearer `SEPAY_API_TOKEN`) **chưa được lập trình** — chỉ có webhook là luồng chính; đối soát bù hiện làm tay qua `GET /admin/payments` (R9) và `mark-paid`. Cần một task riêng nếu muốn nút "Kiểm tra thanh toán" / job đối soát bù tự động.
- **VietQR động** chưa dùng: giai đoạn đầu vẫn dùng QR tĩnh do user tải lên (`/qr-chuyen-khoan.png`); VietQR động (`vietqr.app/img?...&des=DH-...`) chỉ khi user phê duyệt (SEPAY_INTEGRATION.md §10 #9). **VA theo đơn hàng không dùng được với MB Bank**; **hoàn tiền qua SePay API không dùng được với MB Bank** (chỉ VietinBank doanh nghiệp) — hoàn trả giữ thủ công qua MB Bank như đã chốt.
- **Domain webhook chưa chốt:** `visfaracademy.netlify.app/api/v1` (phê duyệt Task 02) vs `api.visfaracademy.vn` (kiến trúc Task 02) — mâu thuẫn trong SEPAY_INTEGRATION.md §4.5/§10 #4. Code đã có cả hai route (`/api/v1/webhooks/sepay` và alias `/api/webhooks/sepay`) để dùng được với bất kỳ domain nào được chốt; URL đăng ký trên my.sepay.vn vẫn chờ user chốt domain.
- **Gói SePay / thời điểm bật / hợp đồng điện tử / tài khoản MB riêng hay chung:** chờ phê duyệt §10 của SEPAY_INTEGRATION.md. Luồng chuyển khoản thủ công (admin `mark-paid`) là phương án đang chạy được ngay, không cần SePay.
- Các mục còn mở ở §7 (khiếu nại 3 ngày = ngày lịch hay ngày làm việc; học viên hoàn thành có được mua lại khóa; key hết hạn 24h → retry tạo đơn mới; thiếu email tạo đơn + hoàn trả) vẫn giữ nguyên — chưa quyết.

### 8.7 Bug tạo đơn thiếu `title_snapshot` — B-T10-6 (11/11/2026, đã sửa, test live PASS)

Sau khi migrations 0017→0021 áp xong lên staging, `POST /api/v1/orders` trả **502**: `createOrder` trong `workers/api/src/payments.ts` insert `order_items` thiếu 2 cột cũ từ 0004 — `title_snapshot` NOT NULL (không default) và `amount_vnd` NOT NULL. Migration 0019 chỉ thêm `item_type/item_name/unit_price_vnd/quantity/total_vnd`, không bỏ 2 cột cũ. PostgREST trả 23502 → Worker map thành 502. Hai đơn mồ côi **DH-2026-000001, DH-2026-000002** (pending, 1.000đ, 0 `order_items`) — không dùng để test thanh toán.

**Đã sửa:** insert thêm `title_snapshot: p.itemName` và `amount_vnd: unitPrice * quantity` (khóa Tùy tâm: giá gốc 0 nên `amount_vnd` của item = 0, số tiền Tùy tâm nằm ở `orders.amount_vnd/custom_amount_vnd`); `OrderItemRow` bổ sung 2 field; mock test enforce NOT NULL (23502) + CHECK total (23514) cho `order_items` + 2 test hồi quy (khóa + gói thành viên). Workers: **302/302 PASS**, `tsc` PASS. Deploy Worker `api` Version ID `5739e074-b647-4c04-9ec2-47ceaec52d17` (11/11/2026). Đơn test mới **DH-2026-000003** (khóa 01 “Thấu Hiểu Nội Tâm”, 1.000đ, pending, hết hạn 13/11/2026) tạo thành công **HTTP 201** (Idempotency-Key `test-pay-order-003`); kiểm chứng trực tiếp staging: 1 `order_items` với `title_snapshot` = “Thấu Hiểu Nội Tâm”. Chờ user chuyển khoản 1.000đ với nội dung `DH-2026-000003` để test webhook end-to-end.
