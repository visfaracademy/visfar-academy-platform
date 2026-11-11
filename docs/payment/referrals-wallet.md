# Tiếp thị liên kết & Ví — Lịch hẹn (Task 12, migration 0023)

Backend cho 2 tính năng Visfar Academy: Lịch hẹn 1-1 + Ví & tiếp thị
liên kết. UI ở `apps/web` làm riêng sau; Worker KHÔNG deploy trong
đợt này.

## Migration

`supabase/migrations/0023_appointments_referrals_wallet.sql` — 4 bảng:

| Bảng | Ghi chú |
|---|---|
| `appointments` | `student_id` NOT NULL, `instructor_id` NULL (chờ phân công), `scheduled_at`, `duration_minutes` DEFAULT 60 CHECK > 0, `mode` `zoom`/`truc-tiep`, `status` `pending`/`confirmed`/`cancelled`/`completed`, `note`, `meeting_url` |
| `referral_codes` | 1 user = 1 mã; `user_id` UNIQUE, `code` UNIQUE, CHECK `^VISFAR-[A-Z0-9]{6}$` |
| `referrals` | `referrer_id` NOT NULL, `referred_user_id` UNIQUE (1 người chỉ có 1 referrer), `referral_code`, CHECK chống tự giới thiệu |
| `wallet_transactions` | `type` `commission`/`withdrawal`/`adjustment`, `amount_vnd` bigint, `related_order_id` → `orders(id)`, `status` `pending`/`completed`/`rejected` |

Index: `appointments(student_id)`, `appointments(scheduled_at)`,
`appointments(instructor_id)`, `wallet_transactions(user_id)`,
`wallet_transactions(related_order_id)` + unique index riêng phần
`uq_wallet_one_commission_per_order` (1 hoa hồng / đơn).

## RLS (dùng helper có sẵn `public.current_role()` — schema KHÔNG có `is_admin()`)

- `appointments`: học viên SELECT/INSERT của mình; UPDATE của mình /
  lịch được giao / admin (policy WITH CHECK đơn giản — luật chuyển
  trạng thái chi tiết do Workers API giữ, xem dưới).
- `referral_codes`: owner SELECT/INSERT, admin SELECT.
- `referrals`: referrer SELECT, admin SELECT. KHÔNG có policy INSERT —
  chỉ service-role / Workers ghi.
- `wallet_transactions`: owner SELECT, admin SELECT/UPDATE. KHÔNG có
  policy INSERT — chỉ service-role / Workers ghi.

## Quy ước ví

- `amount_vnd > 0`: tiền VÀO ví (commission, adjustment dương).
- `amount_vnd < 0`: tiền RA khỏi ví (withdrawal — lưu SỐ ÂM).
- Số dư ví = `SUM(amount_vnd)` với `status = 'completed'`.
- Số dư KHẢ DỤNG để rút = `SUM(amount_vnd)` với `status IN
  ('completed', 'pending')` — lệnh rút đang chờ duyệt (số âm) đã trừ
  vào khả dụng, tránh rút vượt 2 lần.

## Tỷ lệ hoa hồng — ĐÃ CHỐT 10% (QĐ 26, 11/11/2026)

**`COMMISSION_RATE = 0.10` (10%)** trong
`workers/api/src/referrals.ts` — là nguồn sự thật duy nhất, KHÔNG có
bảng settings mới. Nếu user chốt tỷ lệ khác hoặc muốn cấu hình theo
khóa, đổi hằng số này (hoặc thêm settings sau).

Hook: `confirmPayment()` (`workers/api/src/payments.ts`) sau khi đơn
chuyển `paid` gọi `recordReferralCommission()` — best-effort, không
bao giờ làm hỏng đơn đã paid; chỉ ghi khi người mua có dòng
`referrals`, đơn `amount_vnd > 0`, và chưa có commission cho đơn đó
(kiểm tra `related_order_id` + `type='commission'` trước khi insert;
DB chặn trùng bằng unique index). Đơn 0đ không sinh hoa hồng.
Lưu ý: đơn 0đ được cấp quyền trực tiếp trong `createOrder` (không qua
`confirmPayment`) — nhưng hoa hồng 0đ cũng bằng 0 nên không thiếu.

## API (Workers, `workers/api/src/index.ts`)

| Route | Auth | Ghi chú |
|---|---|---|
| `GET /api/v1/appointments` | JWT | Học viên: lịch của mình; instructor: lịch được giao; admin: tất cả. Lọc `?status=` |
| `POST /api/v1/appointments` | JWT | `scheduled_at` ISO, phải > now + 1h; `duration_minutes` 30/60/90; `mode` zoom/truc-tiep; `instructor_id` optional (phải là instructor/admin); `note` ≤ 1000 ký tự. Rate-limit 5/giờ/user (như leads). Tạo `pending` |
| `PATCH /api/v1/appointments/:id` | JWT | Học viên chỉ hủy lịch của mình khi `pending`. Admin/instructor được giao: `pending→confirmed/cancelled`, `confirmed→completed/cancelled`. Confirm lịch `zoom` bắt buộc có `meeting_url` |
| `GET /api/v1/referrals/me` | JWT | Tự tạo mã nếu chưa có; số dư ví; lịch sử giao dịch; danh sách người đã giới thiệu + `hasPaidOrder` + `commissionEarnedVnd` |
| `GET /api/v1/referrals/validate?code=` | public | `{ valid: true/false }` |
| `POST /api/v1/referrals/withdraw` | JWT | `amount_vnd > 0`, ≤ số dư khả dụng, `payout_info` (thông tin nhận tiền, ≤ 500 ký tự, lưu vào `note`). Tạo `withdrawal` `pending` — KHÔNG tự động chuyển tiền; admin duyệt / chuyển khoản thủ công sau |

Mã giới thiệu sinh xác định từ hash SHA-256 của user id:
`VISFAR-` + 6 ký tự `[A-Z0-9]` (`generateReferralCode`).

## Kiểm chứng

- `python3 -c "import pglast; pglast.parse_sql(...)"` trên file 0023:
  parse OK (35 statements).
- `npm run check:migrations` (repo root): PASS toàn bộ (23 migration).
- `npx tsc --noEmit` trong `workers/api`: PASS.
- `npm test` trong `workers/api`: 12 files, 325 tests PASS (trong đó
  `test/appointments-referrals.test.ts` 23 tests mới: tạo lịch hợp lệ
  + quá khứ bị chặn, hủy lịch không phải của mình bị chặn, referral
  code tạo + validate, commission 10% + idempotent, rút vượt số dư bị
  chặn).

## Còn chờ

- **Áp migration 0023 lên STAGING chưa thực hiện** (xem báo cáo task:
  `SUPABASE_ACCESS_TOKEN` không có trong env của phiên làm việc này).
  Sau khi áp: kiểm chứng 4 bảng tồn tại, RLS bật, đủ policy, unique
  index chặn commission trùng (hướng dẫn trong cuối file 0023).
- **CHƯA áp prod.**
- Chưa deploy Worker (parent deploy sau).
- Chưa có luồng ghi `referrals` khi user đăng ký kèm mã giới thiệu
  (cần UI + endpoint đăng ký — ngoài phạm vi task này; hiện
  `referrals` chỉ được đọc bởi hook commission, chưa có code nào ghi
  dòng mới — hook sẽ không tạo hoa hồng cho tới khi có luồng ghi này).
- Admin duyệt/từ chối rút tiền (PATCH `wallet_transactions` status)
  chưa có endpoint — admin làm trực tiếp trên Supabase / task sau.
