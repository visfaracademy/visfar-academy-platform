# STUDENT_GUIDE — Hướng dẫn học viên

- **Ngày lập:** 11/11/2026 (GĐ2, Prompt 19 — chỉ viết tài liệu, không sửa code, không deploy).
- **Nguồn:** code thật — `apps/web/src/app/(hoc-vien|ai-mentor|cong-dong|danh-gia-11d|thanh-toan|chung-chi)`, `apps/web/src/components/account-menu-items.ts`, `workers/api/src/handlers/` (payments, referrals, ai-mentor), migrations 0014/0016/0023/0027/0029/0030/0031.
- **Trang web:** <https://visfaracademy.pages.dev>. Hỗ trợ: nút Zalo trên trang (nút nổi + nút Zalo hỗ trợ) và form tư vấn `/tu-van`.

## 1. Đăng ký / đăng nhập

- **Đăng ký:** `/dang-ky` (email + mật khẩu). Sau khi đăng ký, hồ sơ được tạo tự động; vai trò mặc định là học viên.
- **Đăng nhập:** `/dang-nhap`. Quên mật khẩu: `/quen-mat-khau` → đặt lại ở `/dat-lai-mat-khau`. Đổi mật khẩu khi đã đăng nhập: menu tài khoản → **Đổi mật khẩu** (`/hoc-vien/doi-mat-khau`).
- **Chưa đăng nhập** mà vào `/hoc-vien/*`, `/admin/*`, `/ai-mentor`, `/hoc-vien/thanh-tich`, `/admin/cong-dong`… sẽ bị chuyển về `/dang-nhap` (307, kèm `?next=` để quay lại trang cũ sau khi đăng nhập).
- **Tài khoản bị vô hiệu hóa:** sẽ bị đăng xuất và chuyển về trang đăng nhập kèm thông báo — liên hệ quản trị viên để được hỗ trợ.
- **Thông tin cá nhân:** menu tài khoản → **Thông tin cá nhân** (`/hoc-vien/ho-so`) — sửa họ tên, SĐT (10 số, bắt đầu bằng 0), tỉnh/thành, ảnh đại diện (jpg/jpeg/png/webp, tối đa 2 MB). Tại đây cũng có nút bật/tắt gamification (điểm cũ giữ nguyên khi tắt).

## 2. Xem khóa học & mua khóa học

- **Xem khóa học:** `/chuong-trinh` (đủ 10 khóa) và `/chuong-trinh/[slug]` (chi tiết). **Không cần đăng nhập** vẫn xem được danh sách module/bài học (tên, loại, thời lượng); bài trả phí hiện ổ khóa — bấm vào sẽ cuộn tới khối đăng ký khóa học.
- **Khóa miễn phí:** bấm ghi danh trực tiếp (không qua đơn hàng).
- **Khóa trả phí / Tùy tâm:** chọn khóa → tạo đơn → đơn ở trạng thái chờ thanh toán, có mã đơn `DH-YYYY-NNNNNN` và hạn giữ chỗ **48 giờ**. Thanh toán bằng cách **chuyển khoản** theo hướng dẫn trên trang thanh toán (`/thanh-toan/[orderId]`): quét **mã QR VietQR do Visfar Academy cung cấp** bằng ứng dụng ngân hàng, nội dung chuyển khoản **chính là mã đơn** (ghi đúng mã để được đối soát). Số tài khoản không hiển thị trong tài liệu này — chỉ dùng thông tin trên trang thanh toán.
- **Sau khi chuyển khoản:** chờ admin đối soát sao kê rồi xác nhận (hoặc hệ thống tự xác nhận khi webhook SePay chạy thật — **hiện webhook chưa chạy thật nên mọi đơn vẫn xác nhận thủ công**). Khi đơn chuyển sang đã thanh toán, bạn được ghi danh vào khóa và nhận email xác nhận. **Không có chuyện "đã trả" ngay khi bạn bấm nút** — quyền học chỉ được cấp khi server xác nhận.
- **Đơn hàng của tôi:** menu tài khoản → **Đơn hàng** (`/hoc-vien/don-hang`); giao dịch/ví xem ở **Ví & tiếp thị liên kết** (`/hoc-vien/vi`) và mục giao dịch (`/hoc-vien/giao-dich`).
- **Hủy đơn:** hủy được đơn đang chờ thanh toán của mình.
- **Hoàn trả:** gửi yêu cầu hoàn trả từ trang đơn hàng của mình; admin xử lý trong **15 ngày làm việc**, tiền hoàn bằng chuyển khoản thủ công. Khiếu nại được phản hồi trong **3 ngày**.

## 3. Học — `/hoc-vien/khoa-hoc`

- **Khóa học của tôi:** menu tài khoản → **Khóa học của tôi** (`/hoc-vien/khoa-hoc`) — tiếp tục học từ vị trí dở dang (`last_position_sec`).
- **Bài học:** video (YouTube), bài text, quiz, file tài liệu, bài tập tự luận. Video xem được khi đã ghi danh; bài xem thử (`is_free_preview`) xem được video mẫu mà không cần ghi danh (chỉ video — nội dung text/tài liệu của bài xem thử không mở).
- **Hoàn thành bài:** video xem tới **≥ 90%** mới tính hoàn thành; bài text bấm **"Đã hoàn thành"**. Khi hoàn thành 100% bài trong khóa, khóa chuyển sang đã hoàn thành và chứng chỉ được tạo tự động.
- **Tài liệu đính kèm:** tải qua trang bài học (chỉ học viên đã ghi danh; link có hạn).
- **Lịch sử học:** menu tài khoản → **Lịch sử học** (`/hoc-vien/lich-su-hoc`).
- **Ghi chú bài học:** có tính năng ghi chú riêng cho từng bài (bảng `lesson_notes`).

## 4. Làm quiz & bài tập

- **Quiz:** làm trong trang bài học loại quiz. Câu hỏi lấy từ server **không kèm đáp án đúng**; nộp bài → chấm ở server → trả điểm + đáp án đúng + giải thích **chỉ sau khi nộp**. Điểm đạt theo ngưỡng của từng quiz (nếu có).
- **Bài tập tự luận:** nộp bài viết trực tiếp hoặc tải file (pdf/doc/docx/txt/md/png/jpg/jpeg, tối đa 10 MB/file, tối đa 5 file). Được **nộp lại** bài tập; giảng viên được **chấm lại**. Xem kết quả chấm + nhận xét ở trang bài tập của mình.

## 5. Nhận chứng nhận

- Hoàn thành 100% khóa → nhận chứng chỉ mã `VISFAR-CERT-YYYY-NNNNNN`.
- **Chứng chỉ của tôi:** menu tài khoản → `/hoc-vien/chung-chi`.
- **Tra cứu công khai:** `/chung-chi/tra-cuu` — nhập mã chứng chỉ để kiểm tra (chỉ hiện 6 trường công khai, không lộ thông tin riêng tư).

## 6. Đánh giá 11D — `/danh-gia-11d`

- Làm bài **không cần đăng nhập**: 33 câu (11 phương diện × 3 câu), thang 1–5; đáp án nháp lưu trên trình duyệt của bạn. Nộp thiếu câu sẽ báo lỗi.
- **Lưu kết quả cần đăng nhập.** Báo cáo cá nhân: điểm từng phương diện, biểu đồ radar, 3 phương diện mạnh nhất / 3 cần chăm sóc thêm, mục tiêu gợi ý, lộ trình khóa học đề xuất (theo 10 khóa thật).
- **Lịch sử:** `/hoc-vien/danh-gia-11d` — xem các lần đánh giá trước, so sánh với lần trước.
- **Lưu ý:** đây là công cụ tự đánh giá tham khảo, **không thay thế chẩn đoán chuyên môn**. Điểm số không dùng để định giá nhân phẩm.
- **Chưa chạy thật trên prod:** migration 0027 chưa áp prod — nút "Lưu kết quả" trên prod sẽ báo lỗi cho tới khi 0027 lên prod; làm bài + xem kết quả vẫn bình thường.

## 7. AI Mentor — `/ai-mentor`

- Hỏi đáp học tập: gõ câu hỏi (2–1000 ký tự), chọn trong 6 câu hỏi gợi ý, xem lịch sử phiên, đánh dấu câu trả lời hữu ích/không hữu ích.
- **Chế độ hiện tại: Tìm kiếm thông minh, không phải AI trò chuyện.** Câu trả lời chỉ tìm trong kho tri thức đã phê duyệt (119 mục Thư viện Master + 10 khóa học + 9 mục triết lý), kèm trích dẫn nguồn; câu ngoài phạm vi sẽ trả lời "chưa tìm thấy" thay vì bịa. Giới hạn **20 câu/giờ**.
- Câu hỏi về khóa học: nếu bạn **chưa ghi danh** khóa đó, AI Mentor chỉ dùng mô tả công khai và ghi rõ bạn chưa ghi danh — nội dung bài học đầy đủ chỉ mở sau khi ghi danh.
- **AI hỗ trợ học tập, không thay thế bác sĩ / chuyên gia tâm lý / luật sư / cố vấn tài chính.**
- **Chưa chạy thật trên prod:** migration 0029 chưa áp prod — trang trên prod hiện lỗi khi hỏi (502). Chờ 0029 lên prod.

## 8. Cộng đồng — `/cong-dong`

- Chỉ học viên đã đăng nhập mới đọc/ghi. Đăng bài (tiêu đề 3–200 ký tự, nội dung tối đa 5000 ký tự), gắn theo khóa học hoặc chung cho cả cộng đồng; bình luận; thả cảm xúc (thích / hữu ích / chúc mừng — bấm lần nữa để bỏ); sửa/xóa bài của mình; báo cáo nội dung không phù hợp.
- Danh sách phân trang 20 bài + nút "Xem thêm" (không feed vô hạn, không video tự phát).
- Bài bị ẩn chỉ tác giả + người kiểm duyệt thấy. Tên hiển thị là tên bạn đã lưu lúc đăng bài.
- **Chưa chạy thật trên prod:** migration 0030 chưa áp prod.

## 9. Thành tích & điểm thưởng — `/hoc-vien/thanh-tich`

- **Quy tắc điểm:** hoàn thành bài học **+10**, quiz đạt **+20**, hoàn thành khóa học **+100**, bài cộng đồng được người khác đánh dấu hữu ích **+5** (tối đa 1 lần/ngày), mỗi ngày học liên tiếp (streak) **+5/ngày**.
- **Huy hiệu:** Khởi đầu (bài đầu tiên), Kiên trì 7 ngày, Hoàn thành khóa đầu tiên, Người chia sẻ (3 bài cộng đồng). Điểm do hệ thống cộng theo tiến độ thật — không tự cộng được; tự thả "hữu ích" cho bài của mình không được điểm.
- Trang Thành tích hiện tổng điểm, streak hiện tại/dài nhất, huy hiệu đã đạt + chưa đạt, lịch sử điểm, quy tắc điểm, nút bật/tắt gamification.
- **Chưa chạy thật trên prod:** migration 0031 chưa áp prod (trang vẫn mở được; điểm/streak hiện mặc định).

## 10. Ví & tiếp thị liên kết — `/hoc-vien/vi`

- **Mã giới thiệu của bạn:** chia sẻ mã — khi người được giới thiệu mua khóa học, bạn nhận hoa hồng vào ví.
- Xem số dư khả dụng, tổng hoa hồng đã nhận, lịch sử giao dịch, người đã giới thiệu.
- **Rút tiền:** nhập số tiền rút (đồng, số nguyên > 0) → gửi yêu cầu; quản trị viên xét duyệt và **chuyển khoản thủ công trong 15 ngày làm việc**. Trạng thái yêu cầu rút là "đang chờ" cho tới khi admin xử lý.

## 11. Lịch hẹn — `/hoc-vien/lich-su`

- Đặt lịch hẹn 1–1 với giảng viên (Zoom mặc định hoặc trực tiếp); xem lịch hẹn của mình, trạng thái (`pending`/`confirmed`/`cancelled`/`completed`), link phòng họp khi được xác nhận.
- Thông báo in-app xem ở `/hoc-vien/thong-bao`.

## 12. Thư viện Master — `/thu-vien-master`

- 119 mục tri thức (khái niệm nguồn, nhân cách, tâm thái, trí tuệ, 9 dạng người, con người, phẩm chất, ba khối đức, triết lý giáo dục tận gốc, bố thí, tố chất nhân tài). Tìm kiếm theo tên khái niệm (gõ không dấu vẫn tìm được, vd. "tri tue" → 8 mục); bấm mục để đọc; mục tổng quan có link chéo tới mục chi tiết.
- Không cần đăng nhập để đọc.

## 13. Cần hỗ trợ?

- Nút Zalo nổi trên trang (chat hỗ trợ) và form tư vấn `/tu-van` (ghi lại mã tham chiếu `VISFAR-YYYY-NNNNNN` sau khi gửi để đối soát).
- Sự kiện: 3 sự kiện ngày **25/11/2026, 18:30** (hình thức Zoom) — xem mục Sự kiện trên trang chủ.
