# SePay Integration — Visfar Academy (Task 10)

**Ngày nghiên cứu:** 10/11/2026
**Trạng thái:** Tài liệu nghiên cứu — **chưa triển khai live**. Mọi bước triển khai live đều cần phê duyệt riêng (xem §10).
**Tài liệu nền:** `docs/DECISIONS.md` (Quyết định 15: dùng SePay; Quyết định 9: hoàn trả 15 ngày làm việc / khiếu nại phản hồi 3 ngày; phê duyệt Task 02/03) và `docs/architecture/` (Task 02 — đặc biệt `API_ARCHITECTURE.md` §10, `SYSTEM_ARCHITECTURE.md` §8, `SYSTEM_MODULES.md` M09, `INTEGRATION_PLAN.md` §5).

> **Quy tắc an toàn áp dụng cho toàn bộ file này:**
> - **Không ghi số tài khoản ngân hàng.** Ngân hàng nhận: **MB Bank**, chủ tài khoản: **Công ty TNHH MTV Visfar Holdings** (theo ảnh chụp màn hình user gửi ngày 10/11/2026). Số tài khoản chỉ lấy từ ảnh chụp / file QR do user cung cấp khi cần tạo khối thanh toán / VietQR. **Dùng được QR Code cũ; không tự tạo QR mới từ thông tin chưa xác nhận** (Quyết định 15).
> - Mọi con số phí/gói đều ghi kèm nguồn và ngày tra cứu. Chỗ nào không tìm được nguồn chính thức thì ghi rõ **"cần xác minh lại"**, không bịa.

---

## 0. SePay là gì — mô hình hoạt động (hiểu đúng trước khi tích hợp)

SePay (Công ty Cổ phần SePay, TP.HCM) **không phải ví trung gian giữ tiền hộ**. Mô hình của SePay là **A2A (account-to-account)**: khách chuyển khoản thẳng từ tài khoản của khách vào tài khoản ngân hàng MB Bank của Visfar Academy; SePay chỉ **đọc biến động số dư và báo lại** cho hệ thống của mình qua webhook / API để tự động đối soát.

- Tiền về thẳng tài khoản ngân hàng, nhận ngay lập tức, không qua trung gian.
- SePay kết nối API trực tiếp với **12 ngân hàng, trong đó có MB** (Vietcombank, BIDV, VietinBank, MB, ACB, VPBank, TPBank, Sacombank, MSB, OCB, KienLongBank, Shinhan Bank). Các ngân hàng còn lại kết nối qua SMS Banking.
- SePay kết nối được cả tài khoản cá nhân và tài khoản doanh nghiệp; không giới hạn số lượng tài khoản ngân hàng kết nối.
- Phương thức thanh toán SePay hỗ trợ: VietQR (chuyển khoản ngân hàng), NAPAS QR, thẻ quốc tế Visa/Mastercard/JCB (theo bài so sánh cổng thanh toán trên blog chính thức của SePay).

**Hệ quả cho kiến trúc Visfar:** SePay **không có "phiên thanh toán" (checkout session) kiểu Stripe** — không có bước "tạo yêu cầu thanh toán" trên máy chủ SePay rồi redirect khách sang trang SePay. Luồng của Visfar là:

1. Hệ thống của mình tạo đơn (`POST /api/orders`) với `reference_code` duy nhất (VD `DH-2026-000123`).
2. Hiển thị cho học viên mã **VietQR động** (số tiền + `reference_code` làm nội dung chuyển khoản) — xem §1.3. Giai đoạn đầu vẫn dùng QR cũ đã có theo Quyết định 15; VietQR động là bước nâng cấp khi triển khai SePay.
3. Học viên quét QR / chuyển khoản bằng app ngân hàng.
4. SePay phát hiện tiền vào tài khoản MB → gửi **webhook** về `POST /api/webhooks/sepay` → hệ thống xác minh chữ ký → khớp đơn theo `reference_code` → khớp số tiền → đơn `paid` → tạo enrollment → gửi email (xem §5 và §6).
5. Webhook lỗi/mất → đối soát bù bằng **API giao dịch v2** (xem §1.2) và báo cáo R9 hằng ngày.

---

## 1. API Documentation

Tài liệu chính thức: **https://developer.sepay.vn** (SePay Developer) và **https://docs.sepay.vn** (hướng dẫn sử dụng). Môi trường Sandbox có sẵn cho API v2, dữ liệu giả lập cách ly hoàn toàn, không cần ngân hàng thật.

### 1.1. Môi trường và xác thực API v2

| Môi trường | Base URL | Dữ liệu |
|---|---|---|
| Production | `https://userapi.sepay.vn/v2` | Giao dịch ngân hàng thật |
| Sandbox | `https://userapi-sandbox.sepay.vn/v2` | Dữ liệu giả lập, cách ly hoàn toàn |

- **Xác thực:** Bearer Token — header `Authorization: Bearer <API_TOKEN>`. Token lấy từ Dashboard SePay (my.sepay.vn → Cấu hình Công ty → API Access).
- **Yêu cầu tiên quyết:** tài khoản SePay đã liên kết ít nhất 1 tài khoản ngân hàng (MB Bank của Visfar).
- **Rate limit (API v2):** **3 req/giây** theo tài liệu giới thiệu API v2 ("Xác thực & Rate Limiting: giới hạn 3 req/giây, xử lý lỗi 401/429"). Lưu ý: một số tài liệu/đoạn mẫu cũ hơn ghi 2 req/giây cho mỗi API token — **cần xác minh lại** con số áp dụng tại thời điểm triển khai. Vì giới hạn thấp, **webhook là luồng chính (realtime), API chỉ dùng để tra cứu/đối soát bù, không poll liên tục**.
- Response v2 dùng envelope JSON thống nhất, UUID thay cho numeric ID, phân trang chuẩn (`page`/`per_page`), trường tiền tệ kiểu integer, HTTP status đúng quy ước (401, 404, 422, 429).

### 1.2. Xác minh giao dịch — API lấy danh sách giao dịch (đối soát bù / tra cứu)

**Endpoint:** `GET https://userapi.sepay.vn/v2/transactions`

Dùng để: kiểm tra lại một giao dịch khi webhook không tới, đối soát bù hằng ngày, và phục vụ nút "Kiểm tra thanh toán" (nếu làm). **Không dùng để poll realtime thay webhook.**

Tham số lọc quan trọng (đầy đủ trong tài liệu chính thức):

| Tham số | Ý nghĩa |
|---|---|
| `q` | Tìm theo `reference_number`, `transaction_content`, `code` |
| `bank_account_id` | Lọc theo UUID tài khoản ngân hàng (MB Bank) |
| `reference_number` | Lọc theo mã tham chiếu — **khớp chính xác** |
| `transaction_content` | Tìm theo nội dung giao dịch (chứa `reference_code` của đơn) |
| `amount_in_min` / `amount_in_max` | Khoảng số tiền vào |
| `transaction_date_from` / `transaction_date_to` | Khoảng ngày giao dịch |
| `transfer_type` | `in` hoặc `out` |
| `webhook_success` | `0` = chưa gửi/thất bại, `1` = thành công — **dùng để tìm giao dịch webhook bị lỗi để đối soát bù** |
| `since_id` | Lấy giao dịch mới từ lần gọi trước (truyền UUID giao dịch cuối cùng; khi polling thêm `transaction_date_sort=asc` và đọc hết các trang) |
| `page` / `per_page` | Phân trang — mặc định 20/trang, tối đa 100 |

Ví dụ:

```bash
curl --request GET \
  --url 'https://userapi.sepay.vn/v2/transactions?bank_account_id=<MB_BANK_ACCOUNT_UUID>&transaction_content=DH-2026-000123&transfer_type=in' \
  --header 'Authorization: Bearer <SEPAY_API_TOKEN>'
```

Response 200 (rút gọn):

```json
{
  "status": "success",
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "transaction_date": "2025-08-15 09:30:00",
      "account_number": "19028745631",
      "amount_in": 500000,
      "amount_out": 0,
      "transaction_content": "Chuyen tien mua hang DH2025001",
      "reference_number": "FT26069ABC",
      "code": "ABC123",
      "bank_brand_name": "ACB",
      "webhook_success": 1,
      "transfer_type": "in"
    }
  ],
  "meta": { "pagination": { "total": 150, "per_page": 20, "current_page": 1, "last_page": 8, "has_more": true } }
}
```

Ghi chú: `id` là UUID của giao dịch; `webhook_success`: `0` = chưa gửi/thất bại, `1` = thành công, `null` nếu không có cấu hình webhook; trường tiền tệ luôn là integer (VND).

### 1.3. "Tạo yêu cầu thanh toán" — VietQR động (không có hosted checkout)

SePay không cung cấp endpoint "tạo phiên thanh toán" kiểu Stripe Checkout. Cách tạo yêu cầu thanh toán cho học viên là **sinh mã VietQR động** chứa sẵn số tiền và nội dung chuyển khoản (`reference_code` của đơn), rồi hiển thị cùng thông tin chuyển khoản. SePay cung cấp công cụ tạo ảnh QR tại `qr.sepay.vn` và cấu trúc link nhúng công khai:

```
https://vietqr.app/img?acc=<SO_TAI_KHOAN>&bank=<NGAN_HANG>&amount=<SO_TIEN>&des=<NOI_DUNG>&template=<TEMPLATE>&download=<DOWNLOAD>&showinfo=<SHOW_INFO>&fullacc=<FULLACC>&holder=<TEN_CHU_TK>&store=<TEN_CUA_HANG>
```

| Tham số | Bắt buộc | Mô tả |
|---|---|---|
| `acc` | Có | Số tài khoản ngân hàng. Chỉ nhập chữ và số |
| `bank` | Có | Ngân hàng — theo `code`, `bin`, `short_name` hoặc `alias` trong `banks.json` (VD: `MB`, mã BIN của MB, hoặc `MBBank`) |
| `amount` | Không | Số tiền chuyển khoản (VND). Chỉ nhập số; bỏ trống để khách tự nhập |
| `des` | Không | Nội dung chuyển khoản, tối đa 94 ký tự. Dấu tiếng Việt và ký tự đặc biệt (ngoài chữ, số, khoảng trắng) sẽ tự động bị bỏ — **vì vậy `reference_code` của đơn phải là chuỗi không dấu, không ký tự đặc biệt (VD `DH2026000123`)** |
| `template` | Không | Kiểu hiển thị: bỏ trống (chuẩn kèm logo VietQR), `compact` (gọn, phù hợp nhúng trang thanh toán), `qronly` (chỉ ảnh QR), `standee` (in quầy) |
| `showinfo` / `fullacc` / `holder` / `store` | Không | Hiển thị thông tin tài khoản/chủ TK/cửa hàng kèm ảnh QR |

Nhúng vào website:

```html
<img src="https://vietqr.app/img?acc=<SO_TAI_KHOAN>&bank=MB&amount=<SO_TIEN>&des=<REFERENCE_CODE>&template=compact"
     alt="QR thanh toán VietQR" />
```

**Lưu ý áp dụng cho Visfar:**

- **Giai đoạn đầu (đã chốt): dùng QR cũ đã có** theo Quyết định 15 — QR tĩnh, học viên tự nhập số tiền và nội dung. VietQR động chỉ dùng khi triển khai SePay live và user phê duyệt đổi sang QR động.
- **Không tự sinh QR từ số tài khoản chưa xác nhận.** Số tài khoản chỉ lấy từ ảnh chụp / file QR do user cung cấp.
- `des` tối đa 94 ký tự và tự bỏ dấu tiếng Việt — `reference_code` phải thiết kế không dấu ngay từ đầu (kiến trúc đã chốt dạng `DH-2026-000123`; dấu `-` có thể bị xử lý — **cần kiểm tra thực tế** khi test VietQR động xem dấu gạch ngang có giữ nguyên trong nội dung chuyển khoản không, vì đối soát khớp theo chuỗi này).
- **VA theo đơn hàng (Virtual Account) — KHÔNG dùng được với MB Bank.** API v2 "VA theo đơn hàng" (tạo/hủy/gắn VA cho từng đơn) hiện chỉ hỗ trợ: BIDV (doanh nghiệp), Sacombank (cá nhân/hộ kinh doanh), Vietcombank (doanh nghiệp/hộ kinh doanh), VietinBank (doanh nghiệp), Shinhan Bank (doanh nghiệp). **MB Bank không có trong danh sách** → Visfar không dùng VA theo đơn; luồng đối soát dựa vào tài khoản MB thật + `reference_code` trong nội dung chuyển khoản (đúng như kiến trúc Task 02 đã thiết kế).

### 1.4. Quản lý webhook qua API (tùy chọn — Visfar nên tạo bằng Dashboard)

Ngoài việc tạo webhook bằng giao diện my.sepay.vn (xem §5.1), SePay có API quản lý webhook:

- **BankHub API:** `POST https://bankhub-api.sepay.vn/v1/webhook` — upsert (tạo mới nếu chưa có, cập nhật nếu đã tồn tại); body gồm `webhook_url` (HTTPS bắt buộc ở production, tối đa 2000 ký tự, chặn IP nội bộ — SSRF protection), `secret_key` (gửi trong header `X-Secret-Key`), `allow_events` (whitelist 13 sự kiện). **Chỉ cho phép một webhook trên mỗi merchant** (BankHub). Yêu cầu Bearer Token trong header Authorization.
- **OAuth 2.0 API:** `GET/POST/PATCH/DELETE https://my.sepay.vn/api/v1/webhooks` (và `/{id}`) — cần scope `webhook:read` / `webhook:write` / `webhook:delete` trong Access Token.

**Khuyến nghị cho Visfar:** tạo webhook bằng Dashboard (đơn giản, đủ dùng, chỉ cần đúng 1 webhook). Chỉ dùng API quản lý webhook nếu sau này cần tự động hóa việc cấu hình.

---

## 2. Chi phí

**Nguồn chính:** trang Bảng giá chính thức https://sepay.vn/bang-gia.html và FAQ https://sepay.vn/faq.html — tra cứu ngày **10/11/2026**. Giá có thể thay đổi; **xác minh lại trên trang bảng giá ngay trước khi phê duyệt triển khai**.

### 2.1. Các gói giao dịch (dịch vụ đối soát / webhook / API)

| Gói | Phí tháng | Giao dịch tiền vào / tháng | Ghi chú |
|---|---|---|---|
| **FREE** | **0đ/tháng** | **50 giao dịch/tháng** | Cho phép vượt giao dịch và tính phí sau vượt. Hỗ trợ 12 ngân hàng. Đủ để chạy thử luồng trước khi trả tiền |
| **STARTUP** | **120.000đ/tháng** (theo tháng) | **Cần xác minh lại** — xem ghi chú dưới | Cho phép vượt giao dịch và tính phí sau vượt. Hỗ trợ tất cả ngân hàng qua API |
| **SHOP** (gói eShop) | **70.000đ / 1 cửa hàng / tháng** khi trả theo năm (840.000đ/năm; giá gốc gạch ngang 99.000đ) | **Không giới hạn** ("Miễn phí tất cả giao dịch") | Đây là gói phần mềm bán hàng eShop, không phải gói giao dịch thuần — chỉ phù hợp nếu dùng kèm eShop |

- **Theo năm giảm giá:** gói giao dịch giảm tới 20%/năm; gói SHOP giảm tới 30%/năm (theo trang bảng giá).
- **Tất cả các gói đều dùng được tất cả tính năng của SePay** (theo FAQ trang bảng giá) — khác nhau ở số giao dịch tối đa/tháng, ngân hàng hỗ trợ và giá. Tính năng, số tích hợp, số tài khoản ngân hàng và số nhân viên không bị giới hạn theo gói.
- **"Số lượng giao dịch" được tính là gì:** tổng số lượng **giao dịch tiền vào** trong một tháng (không tính tiền ra). **Lưu ý quan trọng:** mọi khoản tiền vào tài khoản MB đã liên kết đều tính vào hạn mức — kể cả khoản chuyển không liên quan tới đơn hàng (nếu tài khoản MB nhận tiền khác ngoài học phí). Nếu dùng chung tài khoản MB cho nhiều mục đích, hạn mức 50 GD/tháng của gói FREE có thể hết nhanh — cần chốt với user xem có tách tài khoản nhận học phí riêng hay không (xem §10).
- **Vượt gói:** được phép vượt; SePay tính tiền thêm theo công thức: **Tiền tính thêm = Giá tiền 1 giao dịch × số giao dịch vượt** (theo docs.sepay.vn — "Hướng dẫn xem gói dịch vụ đã đăng ký"). **Đơn giá 1 giao dịch vượt: cần xác minh lại** — trang bảng giá chính thức không công bố con số này trong phần trích xuất ngày 10/11/2026. Tài liệu tham khảo thứ cấp: thể lệ khuyến mại BIDV–SePay (11/2025–03/2026) ghi đơn giá giao dịch vượt là **466đ/1 giao dịch**, và gói STARTUP trong tài liệu đó là **180 giao dịch/tháng** — **đây là tài liệu khuyến mại theo ngân hàng, không phải bảng giá hiện hành; chỉ dùng làm tham chiếu, phải xác minh lại với SePay trước khi chốt ngân sách**. Bài viết trên blog chính thức của SePay (cập nhật 11/03/2026) ghi phí VietQR cố định **200đ–500đ/giao dịch tùy gói, không tính %** — phù hợp với khoảng đơn giá vượt nêu trên, nhưng vẫn cần xác minh con số áp cho đúng gói Visfar chọn.
- **VAT:** trang bảng giá không ghi rõ giá gói đã gồm VAT hay chưa (chỉ ghi rõ "chưa bao gồm VAT 8%" ở mục hóa đơn điện tử/chữ ký số). **Cần xác minh lại** khi lấy báo giá.
- **Dữ liệu giao dịch lưu tối đa 6 tháng** trên SePay (theo docs.sepay.vn). Muốn lưu lâu hơn cần liên hệ SePay báo giá — hệ thống Visfar lưu payload vào `payments.gateway_payload` và database của mình nên không phụ thuộc vào giới hạn này, nhưng cần biết khi đối soát lịch sử cũ trên dashboard SePay.

### 2.2. Chi phí không liên quan trực tiếp (ghi để tránh nhầm)

| Khoản | Giá (nguồn: sepay.vn/bang-gia.html, 10/11/2026) | Liên quan Visfar? |
|---|---|---|
| Hóa đơn điện tử (eInvoice) | 100đ–600đ/hóa đơn tùy gói số lượng (chưa gồm VAT 8%) | Không — chỉ khi dùng kèm dịch vụ xuất hóa đơn của SePay |
| Chữ ký số HSM | 1.272.000đ/năm (chưa gồm VAT 8%) | Không — chỉ khi xuất hóa đơn điện tử |
| Phần mềm SePay eShop | Cơ bản 50.000đ/tháng; Chuyên nghiệp 99.000đ/tháng; Toàn diện 199.000đ/tháng | Không — Visfar không dùng phần mềm bán hàng eShop |

### 2.3. Ước tính cho Visfar (minh họa — số học viên chưa có thật, chỉ để chốt gói)

- Dưới 50 giao dịch tiền vào/tháng → **gói FREE 0đ** đủ chạy thử và vận hành giai đoạn đầu.
- Vượt 50 GD/tháng → hoặc trả phí vượt theo giao dịch, hoặc lên STARTUP 120.000đ/tháng.
- Ngưỡng nâng cấp trả phí của toàn bộ nền tảng (Supabase/Workers/Resend/SePay) đã chốt là **linh hoạt, tự cập nhật, ban đầu dùng hoàn toàn miễn phí** (phê duyệt Task 02, quyết định 16) — SePay cũng đi theo nguyên tắc này: bắt đầu FREE, nâng cấp khi chạm giới hạn.

---

## 3. Điều kiện sử dụng

Nguồn: **Quy định sử dụng dịch vụ của SePay** — https://sepay.vn/terms-of-service.html (thỏa thuận pháp lý giữa Khách hàng và Công ty Cổ phần SePay), FAQ https://sepay.vn/faq.html, và docs.sepay.vn (hợp đồng điện tử) — tra cứu 10/11/2026. Dưới đây là các điểm ảnh hưởng trực tiếp tới Visfar; **toàn văn điều khoản phải đọc kỹ trước khi ký, không thay thế bằng bản tóm tắt này**.

1. **Bản chất dịch vụ:** SePay là phần mềm cấp quyền sử dụng (license) — cung cấp quyền truy cập/khai thác tính năng (đối soát, webhook, API, cổng thanh toán) cho mục đích phù hợp pháp luật Việt Nam. SePay **không giữ tiền** của khách; tiền chuyển khoản đi thẳng từ người mua tới tài khoản ngân hàng của người bán.
2. **Ký hợp đồng điện tử — bắt buộc kể cả gói miễn phí.** Khi sử dụng dịch vụ SePay, bao gồm cả gói miễn phí, phải ký **hợp đồng dịch vụ điện tử** với SePay, thực hiện hoàn toàn trực tuyến. Hệ thống yêu cầu ký khi: đăng nhập tài khoản hiện có chưa ký, đăng ký tài khoản mới (sau khi chọn gói), hoặc thay đổi gói dịch vụ. **Chỉ tài khoản có quyền Super Admin mới ký được.** Phải hoàn tất ký trong vòng **30 ngày** kể từ khi nhận thông báo — quá hạn tài khoản bị **tạm khóa** cho tới khi hoàn tất ký. Khi đổi gói sau khi đã ký, hệ thống tạo **phụ lục hợp đồng**.
   - Tài khoản Cá nhân/Hộ kinh doanh: xác nhận qua OTP Zalo/SMS. Tài khoản Tổ chức/Doanh nghiệp: quy trình ký riêng (xem docs.sepay.vn/hop-dong-dien-tu.html).
   - Visfar đăng ký dưới tên **Công ty TNHH MTV Visfar Holdings** → thuộc diện tài khoản Tổ chức/Doanh nghiệp.
3. **Phí sử dụng:** Khách hàng phải trả phí sử dụng phần mềm cho SePay **bất kể có sử dụng hay không sử dụng** phần mềm (theo định nghĩa "Tính phí sử dụng Phần mềm" trong Quy định sử dụng). Quyền sử dụng có được khi đã thanh toán đầy đủ phí + chi phí kích hoạt theo quy định.
4. **Hoàn tiền phí phần mềm SePay (không phải hoàn tiền cho học viên):** SePay hỗ trợ hoàn tiền trong **15 ngày đầu tiên** nếu khách hàng không hài lòng về phần mềm (theo FAQ trang bảng giá và trang FAQ chính thức; xem thêm "Quy định hoàn tiền" trên trang SePay). **Không nhầm với chính sách hoàn trả học phí 15 ngày làm việc của Visfar** — đây là hai chính sách khác nhau, của hai bên khác nhau.
5. **Liên kết ngân hàng:** đăng ký tại my.sepay.vn/register, liên kết ngân hàng và xác nhận bằng OTP của ngân hàng; dùng được ngay trong ngày (theo blog chính thức SePay). Không giới hạn số lượng tài khoản ngân hàng. Tài khoản MB Bank của Visfar thuộc nhóm 12 ngân hàng kết nối API trực tiếp.
6. **Tuân thủ và chấm dứt:** SePay có thể đơn phương hủy quyền sử dụng nếu khách hàng vi phạm điều khoản thỏa thuận. Khách hàng có thể đề nghị hủy quyền sử dụng. (Chi tiết xem toàn văn Quy định sử dụng.)
7. **Thông tin doanh nghiệp SePay (để đối chiếu khi ký):** Công ty Cổ phần SePay; MST 0317887567, cấp ngày 19/06/2023 tại Sở Kế hoạch và Đầu tư TP.HCM; địa chỉ: 13 Đường số 38, Vạn Phúc City, P. Hiệp Bình Phước, Thủ Đức, TP. Hồ Chí Minh; hotline 02873.059.589; email info@sepay.vn / hoptac@sepay.vn.

---

## 4. Webhook

### 4.1. Tạo webhook (Dashboard — cách làm cho Visfar)

Trên my.sepay.vn → menu **Webhooks** → **+ Thêm webhook**, điền form 4 bước:

| Bước | Nội dung | Chọn cho Visfar |
|---|---|---|
| 1. Thông tin cơ bản | Tên, sự kiện, URL nhận webhook | Tên VD `Visfar Academy - Payment In`; sự kiện **`Có tiền vào`** (chỉ tiền vào — đơn hàng chỉ cần tiền vào; không cần "Có tiền ra" hay "Cả hai"); URL: `POST /api/webhooks/sepay` (xem §4.5 về URL chính xác) |
| 2. Tài khoản và bộ lọc | Tài khoản ngân hàng áp dụng; lọc theo tài khoản ảo (VA) hoặc tiền tố mã thanh toán | Tài khoản **MB Bank**; lọc theo **tiền tố mã thanh toán** = tiền tố của `reference_code` (VD `DH`) để chỉ nhận webhook của đơn học phí, giảm nhiễu từ các khoản tiền vào khác (nếu tài khoản MB dùng chung) |
| 3. Bảo mật | Phương thức xác thực: HMAC-SHA256 / API Key / OAuth 2.0 / không xác thực | **HMAC-SHA256 (khuyến nghị của SePay)** — xem §4.2. Không bao giờ chọn "không xác thực" ở production |
| 4. Cảnh báo | Kênh nhận thông báo khi webhook lỗi | Cấu hình kênh cảnh báo về email admin `visfaracademy@gmail.com` (kênh cảnh báo đã chốt ở phê duyệt Task 02, quyết định 14) |

Chỉ Super Admin / người được phân quyền mới tạo và quản lý webhook trên dashboard SePay.

### 4.2. Chữ ký webhook — HMAC-SHA256 (phương thức khuyến nghị)

SePay hỗ trợ 4 cách xác thực webhook; HMAC-SHA256 là cách an toàn nhất và được SePay khuyến nghị vì phát hiện được payload bị sửa giữa đường truyền (API Key chỉ xác minh người gửi, không bảo vệ payload).

**Headers SePay gửi:**

| Header | Định dạng |
|---|---|
| `X-SePay-Signature` | `sha256={hex_hash}` |
| `X-SePay-Timestamp` | Unix timestamp (giây) lúc ký |

**Cách SePay ký (theo tài liệu chính thức):**

1. Lấy timestamp hiện tại (Unix seconds).
2. Ghép chuỗi: `{timestamp}.{raw_body}`.
3. Tính HMAC-SHA256 với Secret Key.
4. Gửi header `X-SePay-Signature: sha256={hex_hash}` và `X-SePay-Timestamp: {timestamp}`.

**Cách server xác minh (theo code mẫu chính thức Node.js / PHP của SePay):**

1. Đọc **raw body** (bytes gốc, chưa parse JSON). Lưu ý quan trọng: nếu middleware đã parse JSON rồi `JSON.stringify` lại thì chữ ký sẽ lệch — phải giữ raw body (VD Express dùng `express.raw()` cho route webhook; với Cloudflare Workers thì đọc `request.text()` / `arrayBuffer()` trước khi parse).
2. Kiểm tra timestamp: **từ chối nếu lệch quá 5 phút** so với thời gian hiện tại (chống replay attack).
3. Tính lại: `expected = 'sha256=' + HMAC_SHA256(secret, timestamp + '.' + raw_body)`.
4. So sánh bằng **constant-time comparison** (`crypto.timingSafeEqual` / `hash_equals`).
5. Sai/thiếu chữ ký → trả `401`, không xử lý, không ghi dữ liệu (đúng §10 API_ARCHITECTURE.md).

```js
// Mẫu theo tài liệu chính thức của SePay (Node.js) — viết lại cho Workers API
import crypto from 'node:crypto';

const signature = req.headers.get('x-sepay-signature') ?? '';
const timestamp = Number(req.headers.get('x-sepay-timestamp') ?? 0);
const secret = env.SEPAY_WEBHOOK_SECRET; // Workers Secret, không commit

// Chống replay: timestamp lệch quá 5 phút bị từ chối
if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
  return Response.json({ success: false, message: 'Stale timestamp' }, { status: 401 });
}

const rawBody = await req.text(); // đọc raw body TRƯỚC khi parse JSON
const expected = 'sha256=' + crypto.createHmac('sha256', secret)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

const sig = Buffer.from(signature);
const exp = Buffer.from(expected);
if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) {
  return Response.json({ success: false, message: 'Invalid signature' }, { status: 401 });
}
// ... parse JSON và xử lý tiếp
```

**Lưu ý:**

- Sau khi lưu, SePay chỉ hiển thị 4 ký tự cuối của Secret Key (`****xxxx`) — SePay không lưu plaintext. **Mất secret thì tạo lại**, và phải cập nhật `SEPAY_WEBHOOK_SECRET` trong Workers Secrets đồng thời.
- Nếu webhook cấu hình dạng `application/x-www-form-urlencoded` hoặc `multipart/form-data`, SePay ký trên chuỗi form-encoded (tương tự PHP `http_build_query`), không phải JSON. **Visfar dùng JSON mặc định** để khớp với code mẫu trên.
- Phương thức **API Key** (dự phòng): SePay gửi header `Authorization: Apikey <API_KEY_CUA_BAN>`. Chỉ dùng khi HMAC gặp vấn đề kỹ thuật không khắc phục được; không dùng làm phương thức chính.
- **OAuth 2.0:** SePay luôn gửi JSON; endpoint phải trả **201** (chỉ xét HTTP status, không đọc body). Không khuyến nghị cho Visfar trừ khi có lý do riêng.
- **Danh sách IP gửi webhook của SePay** (thêm vào whitelist nếu hệ thống có giới hạn IP — chỉ là lớp phụ, không thay thế xác minh chữ ký):
  - IPv4: `172.236.138.20`, `172.233.83.68`, `171.244.35.2`, `151.158.108.68`, `151.158.109.79`, `103.255.238.139`, `45.57.137.67`
  - IPv6: `2400:8905::2000:8cff:fe98:45cd`, `2600:3c15::2000:8aff:fedd:874b`

### 4.3. Payload webhook mẫu

SePay gửi HTTP **POST**, body JSON mặc định (trừ OAuth 2.0 luôn gửi JSON; các kiểu khác có thể chọn `multipart/form-data` hoặc `application/x-www-form-urlencoded` ở ô "Định dạng dữ liệu"):

```json
{
  "id": 92704,
  "gateway": "Vietcombank",
  "transactionDate": "2024-07-02 11:08:33",
  "accountNumber": "1017588888",
  "subAccount": "",
  "code": "SEVN63DC8E5C",
  "content": "SEVN63DC8E5C chuyen tien",
  "transferType": "in",
  "description": "NGUYEN VAN A chuyen tien",
  "transferAmount": 5000000,
  "accumulated": 105000000,
  "referenceCode": "FT24012345678"
}
```

| Trường | Ý nghĩa | Dùng cho Visfar thế nào |
|---|---|---|
| `id` | ID giao dịch trên SePay (số) | **`gateway_reference`** — khóa chống trùng: UNIQUE (`method`, `gateway_reference`) trên bảng `payments`. Cùng một giao dịch có thể nhận webhook nhiều lần (retry, gửi lại thủ công, nhiều webhook trỏ cùng endpoint) → kiểm tra trùng theo `id` trước khi xử lý |
| `gateway` | Ngân hàng phát sinh giao dịch | Kiểm tra = MB (ngân hàng đã cấu hình) |
| `transactionDate` | Thời gian giao dịch | Đối soát, hiển thị |
| `accountNumber` | Số tài khoản nhận | **Không log toàn bộ / không hiển thị công khai** — chỉ dùng nội bộ để đối soát; không ghi số tài khoản vào tài liệu |
| `subAccount` | Tài khoản phụ / VA (nếu có) | Rỗng với tài khoản MB thật (không dùng VA) |
| `code` | Mã thanh toán SePay sinh (VD `SEVN63DC8E5C`) | Tham chiếu phụ; không phải mã đơn của mình |
| `content` | Nội dung chuyển khoản (chứa mã + text khách gõ) | **Tìm `reference_code` của đơn trong chuỗi này** (VD `DH-2026-000123`) |
| `transferType` | `in` (tiền vào) / `out` (tiền ra) | Chỉ xử lý `in`; webhook Visfar chỉ đăng ký sự kiện "Có tiền vào" |
| `description` | Mô tả giao dịch (tên người chuyển + nội dung) | Đối soát tay khi cần |
| `transferAmount` | Số tiền giao dịch (VND, integer) | **Khớp với `orders.amount_vnd` — sai lệch cho phép 0đ** (xem §6) |
| `accumulated` | Số dư tích lũy sau giao dịch | Tham khảo, không dùng để đối soát đơn |
| `referenceCode` | Mã tham chiếu ngân hàng (VD `FT24012345678`) | Lưu vào `gateway_payload` để đối soát với sao kê |

**Lưu toàn bộ payload gốc** vào `payments.gateway_payload` (jsonb) để đối soát — không chứa secret (đúng kiến trúc Task 02).

### 4.4. Phản hồi hợp lệ và retry

SePay tính là gửi thành công khi endpoint trả về **đủ cả 3 điều kiện**:

1. HTTP status **200** hoặc **201** (với OAuth 2.0: trả **201**; một số webhook tạo ở giao diện cũ hoặc gắn trực tiếp với một tài khoản ngân hàng chỉ coi **201** là thành công — trả 200 sẽ bị ghi thất bại).
2. Body JSON có `{"success": true}`.
3. Phản hồi trong thời gian chờ: SePay chờ tối đa **30 giây** (webhook OAuth 2.0 có thể chỉ chờ **8 giây**) → phải phản hồi trong vài giây. **Vì vậy endpoint webhook phải: xác minh chữ ký → ghi nhận nhanh → trả 200 + `{"success": true}` ngay; các bước nặng (tạo enrollment, gửi email) xử lý sau khi đã trả lời hoặc làm nhanh trong cùng request nhưng không để quá 30 giây.**

**Retry tự động:** SePay chỉ tự gọi lại trong hai trường hợp: (1) không kết nối được tới endpoint hoặc quá thời gian chờ; (2) đã bật tùy chọn "Tự động gửi lại khi server trả lỗi" (giao diện cũ: "Gọi lại Webhooks khi? → HTTP Status Code không nằm trong phạm vi từ 200 đến 299") và endpoint trả mã ngoài khoảng 200–299. **Endpoint trả 200 nhưng thiếu `{"success": true}` chỉ bị ghi là thất bại, không được gọi lại.**

- Tối đa **7 lần gọi lại**, khoảng cách tăng theo dãy Fibonacci: **1, 1, 2, 3, 5, 8, 13 phút** — tức khoảng 33 phút sau lần thất bại đầu tiên. Mỗi lần gọi SePay chờ tối đa 30 giây (OAuth 2.0: 8 giây).
- Endpoint ngừng hoạt động lâu hơn khoảng thời gian trên → webhook bị đánh dấu thất bại hẳn. Khi đó **gửi lại thủ công** trong nhật ký webhook (my.sepay.vn → Nhật ký webhooks) hoặc dùng **API giao dịch** (§1.2) để đối soát bù.
- **Kiểm tra hoạt động:** (1) trên trang chi tiết webhook dùng tính năng **Gửi thử** để bắn payload mẫu sang URL mà không cần phát sinh giao dịch thật; (2) chuyển một khoản nhỏ vào tài khoản đã cấu hình để tạo giao dịch thật, rồi xem Nhật ký webhooks.

**Áp dụng cho kiến trúc Visfar (API_ARCHITECTURE.md §10.1):**

- Webhook không tìm thấy đơn (không có `reference_code` khớp) → ghi log + báo cáo đối soát R9, **trả `200` cho SePay** (đã nhận webhook) nhưng không đổi trạng thái đơn nào. Lưu ý: theo quy tắc retry của SePay, trả 200 + `{"success": true}` thì SePay coi là thành công và không gửi lại — đúng ý đồ (đơn không tồn tại thì gửi lại cũng vô ích; xử lý tay qua R9).
- Webhook sai lệch số tiền → ghi `payments` trạng thái `failed` (hoặc bản ghi đối soát), không đổi đơn sang `paid`, đưa vào R9 để admin xử lý tay. Trong log nội bộ trả lỗi `422` (`payment_mismatch`) — nhưng **phản hồi trả cho SePay vẫn phải là 200 + `{"success": true}`** (đã nhận và đã ghi nhận để xử lý tay), nếu không SePay sẽ retry vô ích trong 33 phút cho một giao dịch vốn đã được ghi nhận. **Điểm này cần chốt khi lập trình** (xem §10): "nhận thành công, xử lý tay sau" khác với "gửi lại".
- Webhook gửi lại cùng giao dịch → UNIQUE (`method`, `gateway_reference`) chặn trùng; lần gửi lại trả kết quả cũ, không tạo payment trùng.

### 4.5. Endpoint và secret (Workers API)

| Hạng mục | Giá trị |
|---|---|
| Endpoint nhận webhook | `POST /api/webhooks/sepay` trên Workers API (theo API_ARCHITECTURE.md §8.4/§10.1) |
| URL đầy đủ | **Cần phê duyệt / xác nhận domain trước khi cấu hình trên SePay** (xem §10). Phê duyệt Task 02 ghi domain API là `visfaracademy.netlify.app` với tiền tố `/api/v1` (VD `https://visfaracademy.netlify.app/api/v1/webhooks/sepay`), trong khi kiến trúc Task 02 viết base URL production là `https://api.visfaracademy.vn` — **hai domain này mâu thuẫn, phải chốt một domain trước khi đăng ký webhook**. URL webhook phải là HTTPS công khai, ổn định — `localhost` không nhận được webhook |
| Xác thực | Không JWT — xác minh chữ ký HMAC-SHA256 (xem §4.2) |
| Secret | `SEPAY_WEBHOOK_SECRET` — chỉ trong Cloudflare Workers Secrets (và GitHub Secrets nếu cần cho CI), không commit vào repo |
| API Token (đối soát bù) | `SEPAY_API_TOKEN` — Bearer Token SePay API v2, cũng chỉ trong Workers Secrets |
| Rate-limit | Webhook không rate-limit theo IP công khai (xác minh bằng chữ ký thay cho rate-limit — API_ARCHITECTURE.md §4); giới hạn chống flood ở tầng edge nếu cần |

---

## 5. So sánh ngắn

### 5.1. SePay vs Stripe (chỉ tham khảo — Stripe chưa được phê duyệt)

> **Trạng thái theo Quyết định 15 và phê duyệt Task 02:** **Dùng SePay. Stripe chưa dùng.** Phần này chỉ để đối chiếu khi user xét duyệt Stripe trong tương lai; **không triển khai Stripe** nếu chưa có phê duyệt riêng.

| Tiêu chí | **SePay (đã chốt dùng)** | **Stripe (chưa phê duyệt)** |
|---|---|---|
| Mô hình | A2A — tiền về thẳng tài khoản ngân hàng MB, SePay chỉ báo giao dịch | Cổng thẻ — tiền qua Stripe rồi mới payout về tài khoản |
| Hỗ trợ doanh nghiệp Việt Nam | **Có** — đăng ký ngay, cá nhân/hộ kinh doanh/doanh nghiệp đều được; MB nằm trong 12 ngân hàng kết nối API trực tiếp | **Không hỗ trợ doanh nghiệp đăng ký tại Việt Nam** (kiểm tra tháng 09–10/2026: Việt Nam không có trong danh sách quốc gia Stripe hỗ trợ; các nguồn độc lập đều xác nhận — MONA Media kiểm tra 19/09/2026, GetPaidAtlas kiểm tra 30/10/2026). Muốn dùng Stripe phải có pháp nhân ở nước được hỗ trợ (VD lập công ty Mỹ qua Stripe Atlas + tài khoản ngân hàng Mỹ) — **vượt phạm vi và chi phí của Visfar hiện tại** |
| Phương thức | VietQR / chuyển khoản ngân hàng (chính); NAPAS QR; thẻ quốc tế Visa/Mastercard/JCB (qua SePay) | Thẻ quốc tế là chính; không nhận chuyển khoản ngân hàng nội địa Việt Nam |
| Phí giao dịch | VietQR cố định **200đ–500đ/giao dịch tùy gói, không tính %** (blog chính thức SePay, 11/03/2026); gói FREE 0đ/50 GD/tháng; STARTUP 120.000đ/tháng | Không áp dụng cho doanh nghiệp Việt Nam. Tham khảo giá Mỹ (stripe.com/pricing, kiểm tra 02/11/2026): **2,9% + $0,30** mỗi giao dịch thẻ nội địa Mỹ; +1,5% thẻ quốc tế; +1% chuyển đổi tiền tệ. Singapore: 3,4% + S$0,50. **Phí % khiến đơn học phí lớn tốn kém hơn nhiều so với phí cố định của SePay** (VD đơn 1.000.000đ: SePay ~200–500đ; Stripe Mỹ ~2,9% ≈ 29.000đ + $0,30) |
| Nhận tiền | Ngay lập tức vào tài khoản ngân hàng | Payout theo chu kỳ Stripe (thường T+2–7 ngày tùy quốc gia) |
| Hoàn tiền qua API | Có API hoàn tiền nhưng **chỉ VietinBank doanh nghiệp** — MB Bank không dùng được (xem §7) | Có API hoàn tiền đầy đủ (khi dùng được Stripe) |
| Tích hợp | Webhook + API v2 + VietQR động; đăng ký và dùng ngay trong ngày | API + webhook chuẩn quốc tế, tài liệu đầy đủ — nhưng rào cản pháp nhân Việt Nam là điểm chặn |
| Khi nào xét lại | — | Chỉ khi Visfar cần thu thẻ quốc tế từ học viên nước ngoài và chấp nhận lập pháp nhân ở nước được Stripe hỗ trợ, hoặc khi Stripe mở hỗ trợ Việt Nam (cần kiểm tra lại danh sách quốc gia của Stripe tại thời điểm đó) |

**Kết luận so sánh:** Với Visfar Academy (doanh nghiệp Việt Nam, học viên chuyển khoản nội địa, học phí Tùy tâm/cố định bằng VND), **SePay là lựa chọn đúng và duy nhất khả thi trong hai phương án** — Stripe hiện không mở được tài khoản cho doanh nghiệp Việt Nam nên không phải là phương án dự phòng thực tế.

### 5.2. SePay vs chuyển khoản thủ công MB Bank (phương án hiện tại / dự phòng)

| Tiêu chí | **Chuyển khoản thủ công (hiện tại — 0 đồng)** | **SePay webhook (sau phê duyệt)** |
|---|---|---|
| Cách vận hành | Học viên chuyển khoản (app ngân hàng, quét QR cũ) → admin kiểm tra sao kê hằng ngày → `POST /api/admin/orders/:id/mark-paid` | SePay webhook tự động đối soát: xác minh chữ ký → khớp đơn → khớp tiền → đơn `paid` + enrollment + email, không cần admin can thiệp |
| Chi phí | 0đ (không phí SePay) | Gói FREE 0đ tới 50 GD tiền vào/tháng; vượt thì trả phí vượt hoặc lên STARTUP 120.000đ/tháng (xem §2) |
| Tốc độ ghi danh | Chậm — học viên chờ tới khi admin đối soát (tối đa 48h giữ chỗ); email nhắc "chưa thanh toán" sau 12h và 24h | Gần như ngay lập tức sau khi tiền vào tài khoản (SePay mô tả vòng đối soát diễn ra trong khoảng mười giây) |
| Rủi ro sai sót | Cao — sai nội dung chuyển khoản → không đối soát được; sai số tiền → phải xử lý tay; admin có thể bỏ sót | Thấp — máy khớp theo `reference_code` + số tiền chính xác; sai lệch đưa vào R9 để xử lý tay có hệ thống |
| Đối soát | Tay, mỗi sáng mở R9 | Tự động + R9 chỉ còn các ca lệch/ngoại lệ; API giao dịch để đối soát bù |
| Khi webhook lỗi | Không áp dụng | **Luồng thủ công là dự phòng:** admin đối soát tay bằng `mark-paid` như hiện tại; đồng thời gửi lại webhook thủ công từ nhật ký SePay hoặc đối soát bù bằng API giao dịch (xem §4.4, §6) |
| Triển khai | Đã có trong kiến trúc (M09 giai đoạn đầu) — không cần phê duyệt thêm | Cần phê duyệt riêng: giá/gói, thời điểm, webhook URL, tài khoản SePay (xem §10) |

**Thứ tự triển khai đã chốt trong kiến trúc:** chuyển khoản thủ công trước (giai đoạn 0 đồng), SePay webhook sau — thời điểm bật SePay (ngay từ đầu hay sau khi luồng thủ công chạy ổn) là câu hỏi Q5 trong SYSTEM_MODULES.md, **chưa chốt** (xem §10).

---

## 6. Quy trình đối soát

### 6.1. Luồng đối soát tự động (webhook SePay)

```
Tiền vào tài khoản MB
  → SePay gửi webhook POST /api/webhooks/sepay
  → 1. Xác minh chữ ký HMAC-SHA256 (+ timestamp ≤ 5 phút)
       Sai/thiếu → 401, không xử lý, không ghi dữ liệu
  → 2. Kiểm tra transferType = "in" (chỉ xử lý tiền vào)
  → 3. Chống trùng: gateway_reference = payload.id
       Đã tồn tại (UNIQUE method + gateway_reference) → trả kết quả cũ, không tạo thêm
  → 4. Tìm đơn theo reference_code trong content
       Không tìm thấy → ghi log + R9, trả 200 {"success": true} cho SePay,
       không đổi trạng thái đơn nào
  → 5. Kiểm tra số tiền: transferAmount == orders.amount_vnd
       → 6a. Khớp (sai lệch 0đ): tạo payments (method=sepay, status=succeeded,
            paid_at=now(), lưu gateway_payload) → orders → paid
            → tạo enrollments → gửi email order-paid (E8) → ghi email_logs
       → 6b. Lệch: xem §6.2
  → 7. Trả 200 {"success": true} trong vài giây
```

Quy tắc nền tảng (kiến trúc Task 02/03, không đổi):

- **Không bao giờ tin client báo "đã trả".** Đơn chỉ chuyển sang `paid` khi (a) webhook SePay đã xác minh chữ ký, hoặc (b) admin xác nhận thủ công sau khi kiểm tra sao kê.
- **Chỉ server mới được đổi đơn sang `paid`.**
- **Sai lệch cho phép: 0đ — không chấp nhận thiếu/thừa.** (API_ARCHITECTURE.md §10.1; SYSTEM_ARCHITECTURE.md §8.3; lỗi `422 payment_mismatch` trong log nội bộ.)

### 6.2. Xử lý lệch (sai số tiền / sai nội dung / không tìm thấy đơn)

| Trường hợp | Phát hiện | Xử lý |
|---|---|---|
| **Thiếu tiền** (transferAmount < amount_vnd) | Webhook bước 5 | Ghi `payments` trạng thái `failed` (hoặc bản ghi đối soát) + lưu `gateway_payload`; **không đổi đơn sang `paid`**; đưa vào **R9** để admin xử lý tay; trả 200 `{"success": true}` cho SePay (đã ghi nhận, không retry vô ích — xem §4.4). Admin liên hệ học viên: chuyển thêm phần thiếu (tạo đơn/phần thu bổ sung theo quy trình admin — **cần chốt quy trình này khi lập trình**, vì kiến trúc hiện chưa quy định cách thu phần thiếu) hoặc hủy đơn và hoàn lại phần đã chuyển (hoàn thủ công — xem §7) |
| **Thừa tiền** (transferAmount > amount_vnd) | Webhook bước 5 | Như trên — không tự động ghi nhận thừa thành `paid`. Admin xử lý tay: xác nhận với học viên (ghi nhận thừa làm đóng góp thêm cho khóa Tùy tâm, hay hoàn lại phần thừa bằng chuyển khoản thủ công) rồi mới `mark-paid` |
| **Sai / thiếu nội dung chuyển khoản** (không có `reference_code` trong `content`) | Webhook bước 4 — không tìm thấy đơn | Ghi log + R9; trả 200 cho SePay; admin đối chiếu tay bằng tên người chuyển (`description`), số tiền, thời gian (`transactionDate`) với danh sách đơn `pending` rồi `mark-paid` thủ công. **Phòng ngừa:** VietQR động điền sẵn `des` (xem §1.3) + hướng dẫn học viên không sửa nội dung chuyển khoản + email E5 ghi rõ mã đơn |
| **Đơn không tồn tại / đã hết hạn / đã hủy** | Webhook bước 4 | Ghi log + R9; không đổi trạng thái đơn nào; admin xử lý tay (VD đơn đã `expired` nhưng tiền vẫn vào → tạo đơn mới cho học viên rồi `mark-paid`, hoặc hoàn tiền) |
| **Webhook trùng lặp** (SePay retry / gửi lại thủ công) | Bước 3 — `gateway_reference` đã tồn tại | Trả kết quả cũ, không tạo payment trùng, không tạo enrollment trùng |
| **Webhook không tới** (endpoint lỗi > 33 phút, SePay đánh dấu thất bại hẳn) | R9: đơn `pending` quá 48h; hoặc lọc API `webhook_success=0` | Đối soát bù: admin gọi `GET /v2/transactions?webhook_success=0` (hoặc `since_id` polling) → khớp tay / chạy job đối soát bù → `mark-paid` cho đơn khớp; hoặc gửi lại webhook thủ công từ Nhật ký webhooks trên my.sepay.vn |
| **Đơn `paid` nhưng chưa có enrollment** | R9 hằng ngày | Báo cáo R9 liệt kê; admin/kỹ thuật xử lý bổ sung (tạo enrollment bù, ghi `audit_logs`) — không tự tạo enrollment ngoài luồng đã chốt |

### 6.3. Đối soát hằng ngày (quy trình vận hành, không phải code)

Mỗi sáng admin mở báo cáo **R9** (`GET /api/admin/reports/reconciliation`):

- Đơn `pending` quá 48h.
- Đơn `paid` chưa có enrollment.
- Payment không khớp order (sai lệch ≠ 0đ).
- Webhook lỗi (log webhook + `webhook_success=0` trên API SePay).
- Kiểm tra Sheet (nếu còn dùng) khớp với `leads` trong database — Sheet chỉ là bản sao đối soát, database là nguồn sự thật.

Đơn quá hạn → `expired`, học viên tạo đơn mới (email nhắc sau 12h/24h đã gửi theo M10 E6/E7).

### 6.4. Lưu trữ và kiểm toán

- Payload webhook gốc lưu vào `payments.gateway_payload` (jsonb) — phục vụ đối soát, không chứa secret.
- Mọi thao tác admin đổi dữ liệu (xác nhận thủ công, hoàn trả) ghi `audit_logs`.
- `payments` giữ `verified_by` (admin xác nhận thủ công) để phân biệt đơn qua webhook tự động và đơn qua tay.
- Lưu ý giới hạn của SePay: dữ liệu giao dịch trên SePay chỉ lưu tối đa 6 tháng — dữ liệu đối soát dài hạn dựa vào database của Visfar, không dựa vào dashboard SePay.

---

## 7. Hoàn tiền

### 7.1. Kết luận ngắn

**SePay CÓ API hoàn tiền — nhưng Visfar (tài khoản MB Bank) KHÔNG dùng được.**

API hoàn tiền của SePay API v2 (thêm mới ngày 10/09/2026 theo changelog chính thức) hiện **chỉ hỗ trợ tài khoản VietinBank doanh nghiệp**. Tài khoản thuộc ngân hàng khác nhận lỗi `422 unsupported_bank`; tài khoản chưa được SePay mở hoàn tiền nhận `422 not_available`. MB Bank không nằm trong danh sách ngân hàng hỗ trợ hoàn tiền → mọi lệnh hoàn tiền qua SePay API cho tài khoản MB sẽ bị từ chối.

**Vì vậy: hoàn trả học phí của Visfar tiếp tục thực hiện thủ công bằng chuyển khoản từ MB Bank** (đúng như kiến trúc M09/SYSTEM_ARCHITECTURE.md §8.5 đã chốt), không qua SePay API. Khi nào SePay mở rộng hoàn tiền sang MB Bank thì xét lại.

### 7.2. API hoàn tiền của SePay (để tham khảo / xét lại sau)

Nguồn: https://developer.sepay.vn/vi/sepay-api/v2/hoan-tien/ — tra cứu 10/11/2026.

| Endpoint | Dùng khi nào |
|---|---|
| `POST https://userapi.sepay.vn/v2/transactions/{transaction_id}/refund` | Hoàn tiền một giao dịch thu hộ, dùng khi tiền vào không gắn đơn hàng VA nào (VD khách chuyển thẳng vào tài khoản thật). Lấy `transaction_id` từ API danh sách giao dịch |
| Hoàn tiền theo đơn hàng (VA order) | Hoàn phần đã thu của một đơn hàng VA. Chỉ đơn ở trạng thái Paid hoặc Partially và đã nhận tiền mới hoàn được |
| `GET` danh sách / chi tiết hoàn tiền | Tra cứu lệnh hoàn tiền theo `refund_id`, xem trạng thái xử lý và thông tin ngân hàng trả về |

Quy tắc kỹ thuật (nếu sau này đủ điều kiện dùng):

- **Bắt buộc header `X-Idempotency-Key`** (do mình tự sinh, duy nhất cho mỗi yêu cầu hoàn tiền, tối đa 100 ký tự). Thiếu → `422 idempotency_key_required`. Gửi lại cùng khóa trả về đúng bản ghi cũ thay vì chi tiền lần hai. Khóa đã dùng cho yêu cầu khác → `409 idempotency_key_reused`.
- Body: `refund_amount` (integer, VND, số nguyên dương). Bỏ trống để hoàn toàn bộ phần còn lại của giao dịch gốc. Hoàn một phần được phép (theo hạn mức còn lại của giao dịch gốc).
- Response 200: `{"status": "success", "data": {"refund_id": "RF-...", "amount": ..., "scope": "full", "status": "pending", ...}}` — lệnh hoàn được **ghi nhận** ở trạng thái `pending`, cần theo dõi trạng thái tiếp (không phải hoàn xong ngay).
- Lỗi chính: `422 not_available` (tài khoản chưa được mở hoàn tiền), `422 unsupported_bank` (ngân hàng chưa hỗ trợ hoàn tiền — **đây là lỗi MB Bank sẽ gặp**), `422 not_refundable`, `422 already_refunded`, `422 validation_error` (số tiền vượt phần còn lại), `422 refund_declined` / `refund_failed` / `refund_rejected` (ngân hàng từ chối), `500 unexpected_error` (lệnh có thể đã tới ngân hàng — tra lại bằng danh sách hoàn tiền hoặc gửi lại **cùng khóa**, đừng sinh khóa mới), `503 refund_busy` (đang có lệnh hoàn khác cho cùng giao dịch — thử lại sau ít giây với cùng khóa).
- **Sandbox không áp dụng khóa ngân hàng**: lệnh hoàn chạy được trên Sandbox vẫn có thể trả `422 not_available` khi lên thật — **không được coi test Sandbox là bằng chứng hoàn tiền chạy được trên production với MB Bank**.

Ví dụ (từ tài liệu chính thức — chỉ tham khảo, không chạy được với MB Bank):

```bash
curl --request POST \
  --url https://userapi.sepay.vn/v2/transactions/6398452/refund \
  --header 'Authorization: Bearer <SEPAY_API_TOKEN>' \
  --header 'X-Idempotency-Key: refund-order-DH20250001-01' \
  --header 'content-type: application/json' \
  --data '{"refund_amount": 50000}'
```

### 7.3. Hoàn trả thực tế của Visfar (luồng đã chốt — thủ công)

Chính sách đã chốt (Quyết định 9): **hoàn trả trong 15 ngày làm việc; khiếu nại được phản hồi trong 3 ngày.**

Luồng (theo M09 / SYSTEM_ARCHITECTURE.md §8.5):

1. Học viên yêu cầu hoàn trả → admin kiểm tra khung thời gian (còn trong 15 ngày làm việc không).
2. Admin bấm hoàn trả (`POST /api/admin/orders/:id/refund`) → đơn → `refunded`, tạo bản ghi `payments` hoàn trả, gửi email xác nhận (E13), thu hồi enrollment (`status = 'revoked'`).
3. **Tiền hoàn:** admin chuyển khoản lại từ tài khoản MB Bank bằng app ngân hàng (thủ công), ghi `gateway_reference` là mã giao dịch hoàn trên sao kê.
4. Ghi `audit_logs` cho toàn bộ thao tác.

**Phân biệt rõ:** "SePay hỗ trợ hoàn tiền trong 15 ngày đầu nếu không hài lòng về phần mềm" (FAQ SePay) là chính sách hoàn phí **phần mềm SePay** cho Visfar với tư cách khách hàng của SePay — không liên quan tới việc Visfar hoàn học phí cho học viên.

---

## 8. Biến môi trường và secret (Workers API)

| Biến | Nơi dùng | Ghi chú |
|---|---|---|
| `SEPAY_API_TOKEN` | Workers API (đối soát bù qua API v2, nút "Kiểm tra thanh toán" nếu có) | Bearer Token SePay API v2, lấy từ Dashboard. Tên biến chính xác theo tài liệu SePay tại thời điểm triển khai (INTEGRATION_PLAN.md §5) |
| `SEPAY_WEBHOOK_SECRET` | Workers API (`POST /api/webhooks/sepay`) | Secret HMAC-SHA256, tạo khi cấu hình webhook trên my.sepay.vn. Chỉ trong Cloudflare Workers Secrets + GitHub Secrets |
| `SEPAY_BANK_ACCOUNT_ID` | Workers API (lọc giao dịch theo tài khoản MB khi đối soát bù) | UUID tài khoản ngân hàng trên SePay — lấy từ Dashboard sau khi liên kết MB Bank; **không phải số tài khoản** |
| `SEPAY_MERCHANT_ID` | Workers API (cấu hình) | ID merchant SePay, nếu SePay yêu cầu (INTEGRATION_PLAN.md §5) |

Secret chỉ nằm trong Cloudflare Workers Secrets / GitHub Secrets, **không commit vào repo**. Frontend không bao giờ thấy các key này. Xoay key khi có người rời đội (theo API_ARCHITECTURE.md §11).

---

## 9. Checklist kỹ thuật trước khi triển khai (dev — không cần user phê duyệt từng mục, nhưng phải xong trước khi xin phê duyệt live ở §10)

- [ ] Đăng ký tài khoản SePay dưới tên Công ty TNHH MTV Visfar Holdings; liên kết tài khoản MB Bank (xác nhận bằng OTP ngân hàng); ký hợp đồng điện tử (Super Admin ký, trong 30 ngày).
- [ ] Tạo webhook trên my.sepay.vn: sự kiện "Có tiền vào", tài khoản MB, lọc theo tiền tố `reference_code`, xác thực HMAC-SHA256, cảnh báo lỗi về `visfaracademy@gmail.com`.
- [ ] Triển khai `POST /api/webhooks/sepay` trên Workers: đọc raw body → kiểm tra timestamp ≤ 5 phút → xác minh HMAC (constant-time) → 401 nếu sai → xử lý theo §6.1 → trả `200 {"success": true}` trong vài giây.
- [ ] Test bằng tính năng **Gửi thử** trên trang chi tiết webhook + chuyển khoản nhỏ thật vào MB, kiểm tra Nhật ký webhooks.
- [ ] Test Sandbox API v2: `GET /v2/transactions` (lọc `webhook_success=0`, `since_id`) phục vụ đối soát bù.
- [ ] Test idempotency: gửi lại cùng webhook → không tạo payment trùng; gửi lại cùng `X-Idempotency-Key` hoàn tiền → không chi tiền lần hai (chỉ khi đủ điều kiện dùng API hoàn tiền — hiện không áp dụng với MB).
- [ ] Test các ca lệch: thiếu tiền, thừa tiền, sai nội dung, đơn không tồn tại → vào R9, đơn không chuyển `paid`.
- [ ] Test VietQR động (nếu dùng): `des` chứa `reference_code` không dấu, đúng 94 ký tự trở xuống; kiểm tra dấu `-` trong mã đơn có giữ nguyên sau khi quét không.
- [ ] Kiểm tra rate limit thực tế của API v2 tại thời điểm triển khai (tài liệu ghi 3 req/giây; tài liệu cũ ghi 2 req/giây/token).
- [ ] Xác minh lại giá gói tại thời điểm triển khai (STARTUP hạn mức bao nhiêu GD/tháng, đơn giá giao dịch vượt, VAT đã gồm hay chưa).
- [ ] R9 đối soát chạy được: đơn pending quá 48h, đơn paid chưa có enrollment, payment không khớp, webhook lỗi.

---

## 10. Cần phê duyệt trước khi triển khai live

**Chưa có mục nào dưới đây được phê duyệt — SePay vẫn ở trạng thái "đã chốt dùng, chưa triển khai".** Mỗi điểm cần user chốt riêng trước khi bật live:

| # | Điểm cần chốt | Gợi ý / ngữ cảnh để user quyết |
|---|---|---|
| 1 | **Triển khai SePay live** | Đồng ý bật webhook SePay tự động đối soát (thay cho đối soát tay hằng ngày)? Hay giữ chuyển khoản thủ công thêm một thời gian rồi mới bật? (Câu hỏi Q5 — SYSTEM_MODULES.md: (a) thủ công trước, SePay sau khi luồng thủ công chạy ổn; (b) SePay ngay từ đầu cùng lúc ra mắt nền tảng) |
| 2 | **Giá / gói SePay** | Bắt đầu bằng **gói FREE 0đ / 50 GD tiền vào/tháng** (đủ chạy thử và giai đoạn đầu), nâng cấp khi chạm giới hạn — theo nguyên tắc "ban đầu dùng hoàn toàn miễn phí" đã chốt? Hay đăng ký luôn STARTUP 120.000đ/tháng? **Cần xác minh lại trước khi chốt:** hạn mức GD/tháng của STARTUP, đơn giá giao dịch vượt, giá đã gồm VAT hay chưa (xem §2.1) |
| 3 | **Tài khoản MB Bank đã có** | Xác nhận tài khoản MB Bank nhận học phí là tài khoản trong ảnh chụp màn hình QR VietQR user đã gửi ngày 10/11/2026 (số tài khoản không ghi vào tài liệu). Có tách tài khoản nhận học phí riêng khỏi tài khoản MB dùng cho các khoản tiền khác không? (Mọi khoản tiền vào đều tính vào hạn mức GD/tháng của gói SePay — xem §2.1) |
| 4 | **Webhook URL** | Chốt domain API trước khi đăng ký webhook trên SePay: `visfaracademy.netlify.app/api/v1` (phê duyệt Task 02) hay `api.visfaracademy.vn` (kiến trúc Task 02)? Webhook URL đầy đủ sẽ là `https://<domain-da-chot>/api/v1/webhooks/sepay` (hoặc `/api/webhooks/sepay` nếu không dùng tiền tố `/api/v1` — cần chốt cùng domain). URL phải là HTTPS công khai, ổn định |
| 5 | **Ngưỡng** | (a) Ngưỡng nâng cấp gói SePay: vượt 50 GD/tháng thì trả phí vượt theo giao dịch hay lên STARTUP? (b) Hạn giữ chỗ đơn `pending`: giữ 48h như kiến trúc đã chốt? (c) Ngưỡng cảnh báo: đơn pending quá 48h, webhook lỗi — báo về `visfaracademy@gmail.com` (đã chốt kênh) với ngưỡng nào thì gửi cảnh báo ngay thay vì chờ R9 sáng hôm sau? (d) Ngưỡng nâng cấp trả phí chung (Supabase/Workers/Resend/SePay) đã chốt là linh hoạt, tự cập nhật — có áp ngưỡng cụ thể nào cho SePay không? |
| 6 | **Hoàn tiền qua SePay API** | **Không dùng được với MB Bank** (SePay API hoàn tiền chỉ hỗ trợ VietinBank doanh nghiệp — xem §7). User xác nhận giữ **hoàn trả thủ công bằng chuyển khoản MB** theo luồng M09 đã chốt? (Không có gì để phê duyệt thêm ở đây ngoài việc xác nhận đã biết giới hạn này) |
| 7 | **VA theo đơn hàng** | **Không dùng được với MB Bank** (chỉ BIDV/Sacombank/Vietcombank/VietinBank/Shinhan — xem §1.3). User xác nhận đối soát theo `reference_code` trong nội dung chuyển khoản trên tài khoản MB thật (không dùng tài khoản ảo VA)? |
| 8 | **Ký hợp đồng điện tử SePay** | Ai là Super Admin ký hợp đồng dịch vụ điện tử với SePay (bắt buộc kể cả gói miễn phí, hoàn tất trong 30 ngày kể từ thông báo, nếu không tài khoản bị tạm khóa)? Tài khoản đăng ký dưới tên Công ty TNHH MTV Visfar Holdings |
| 9 | **QR thanh toán** | Giai đoạn SePay live: tiếp tục dùng **QR cũ** (học viên tự nhập số tiền + nội dung) hay chuyển sang **VietQR động** (điền sẵn số tiền + `reference_code`)? Nếu dùng VietQR động, cần kiểm tra thực tế dấu `-` trong mã đơn có giữ nguyên sau khi quét không (xem §1.3) |
| 10 | **Thời điểm bật** | Bật SePay cùng lúc ra mắt nền tảng, hay sau khi luồng chuyển khoản thủ công chạy ổn định? (Cùng câu hỏi với #1 nhưng chốt mốc thời gian cụ thể: ngày bật, và ai là người bấm bật trên dashboard SePay) |

---

## Nguồn tham khảo (tra cứu ngày 10/11/2026)

| Nguồn | URL | Dùng cho |
|---|---|---|
| Bảng giá SePay (chính thức) | https://sepay.vn/bang-gia.html | §2 — gói FREE/STARTUP/SHOP, FAQ (hoàn tiền 15 ngày, 12 ngân hàng API, giao dịch tính theo tiền vào) |
| Quy định sử dụng dịch vụ SePay (chính thức) | https://sepay.vn/terms-of-service.html | §3 — thỏa thuận pháp lý, phí, hợp đồng |
| FAQ SePay (chính thức) | https://sepay.vn/faq.html | §2, §3 — hoàn tiền phí phần mềm 15 ngày, OAuth2/API Key/Secret Key |
| Hướng dẫn tích hợp Webhooks (chính thức) | https://docs.sepay.vn/tich-hop-webhooks.html | §4 — tạo webhook, payload mẫu, phản hồi hợp lệ, retry, danh sách IP |
| Xác thực webhook (chính thức) | https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc | §4.2 — HMAC-SHA256, công thức ký, raw body, chống replay 5 phút |
| Lập trình webhook Node.js (chính thức) | https://developer.sepay.vn/vi/sepay-webhooks/lap-trinh-webhooks/lap-trinh-webhook-nodejs | §4.2 — code mẫu HMAC, chống trùng |
| Giới thiệu SePay API v2 (chính thức) | https://developer.sepay.vn/vi/sepay-api/v2/gioi-thieu | §1.1 — môi trường, Bearer Token, rate limit 3 req/giây, VA, hoàn tiền VietinBank |
| API lấy danh sách giao dịch (chính thức) | https://developer.sepay.vn/vi/sepay-api/v2/giao-dich/danh-sach | §1.2 — endpoint, tham số lọc, `webhook_success`, `since_id` |
| API hoàn tiền theo giao dịch (chính thức) | https://developer.sepay.vn/vi/sepay-api/v2/hoan-tien/hoan-tien-giao-dich | §7 — chỉ VietinBank doanh nghiệp, `X-Idempotency-Key`, bảng lỗi |
| Tổng quan API hoàn tiền (chính thức) | https://developer.sepay.vn/vi/sepay-api/v2/hoan-tien/index.md | §7 — hoàn theo đơn hàng / theo giao dịch |
| Tạo QR Code VietQR động (chính thức) | https://docs.sepay.vn/tao-qr-code-vietqr-dong.html | §1.3 — cấu trúc link `vietqr.app/img`, tham số, `des` tối đa 94 ký tự |
| API tạo/cập nhật Webhook — BankHub (chính thức) | https://developer.sepay.vn/vi/bankhub/api/api-webhook/cap-nhat-webhook | §1.4 — một webhook/merchant, SSRF protection |
| API Webhooks qua OAuth 2.0 (chính thức) | https://developer.sepay.vn/vi/sepay-oauth2/api-webhook | §1.4, §4.4 — `X-SePay-Signature`, trả 201 với OAuth 2.0 |
| Hợp đồng điện tử (chính thức) | https://docs.sepay.vn/hop-dong-dien-tu.html | §3 — ký hợp đồng bắt buộc kể cả gói miễn phí, 30 ngày, Super Admin |
| Xem gói dịch vụ đã đăng ký (chính thức) | https://docs.sepay.vn/goi-dich-vu.html | §2 — công thức phí vượt, dữ liệu lưu tối đa 6 tháng |
| Cổng thanh toán là gì? So sánh cổng thanh toán tại Việt Nam (blog chính thức SePay) | https://sepay.vn/blog/cong-thanh-toan-la-gi/ | §2, §5 — phí VietQR 200đ–500đ/GD, NAPAS 0,3%, thẻ quốc tế 2.200đ + 1,6–2,2% |
| Changelog SePay Developer (chính thức) | https://developer.sepay.vn/vi/changelog | §7 — API hoàn tiền thêm mới 10/09/2026; VA theo đơn hàng |
| Thể lệ khuyến mại BIDV–SePay (thứ cấp, PDF) | https://bidv.1cdn.vn/2025/11/20/phu-luc.-chi-tiet-the-le.pdf | §2.1 — tham chiếu STARTUP 180 GD/tháng, phí vượt 466đ/GD (chưa xác minh trên bảng giá hiện hành) |
| Stripe không hỗ trợ doanh nghiệp Việt Nam (thứ cấp, kiểm chứng chéo 2 nguồn) | https://mona.media/en/how-to-register-a-stripe-payment-account/ ; https://getpaidatlas.com/guides/stripe-alternatives-south-southeast-asia | §5.1 — Stripe chưa hỗ trợ Việt Nam (kiểm tra 19/09/2026 và 30/10/2026) |
| Giá Stripe Mỹ (tham khảo) | https://stripe.com/pricing (qua calculatorlib.com, kiểm tra 02/11/2026) | §5.1 — 2,9% + $0,30; Singapore 3,4% + S$0,50 |
| Tài liệu nội bộ | `docs/DECISIONS.md`; `docs/architecture/API_ARCHITECTURE.md` §10; `SYSTEM_ARCHITECTURE.md` §8; `SYSTEM_MODULES.md` M09; `INTEGRATION_PLAN.md` §5 | Toàn bộ các quy tắc kiến trúc đã chốt (0đ sai lệch, R9, 48h, 15 ngày / 3 ngày) |

**Lịch sử cập nhật file này:**

| Ngày | Nội dung |
|---|---|
| 10/11/2026 | Tạo mới (Task 10) — nghiên cứu tài liệu chính thức SePay, đối chiếu kiến trúc Task 02. Chưa triển khai live; chờ phê duyệt §10. |
