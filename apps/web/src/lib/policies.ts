// Noi dung 4 bai chinh sach — lay NGUYEN VAN tu file HTML goc
// (workspace/user/files/Visfar_Academy.html, #page-bao-mat/dieu-khoan/hoan-tra/khieu-nai).
// Cap nhat: ngay 04 thang 11 nam 2026. Khong doi chu, khong them dia chi tru so,
// ma so thue hay so dang ky kinh doanh (chua duoc cung cap).

export type PolicyBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

export interface Policy { slug: string; title: string; meta: string; lead: string; blocks: PolicyBlock[]; }

export const POLICIES: Policy[] = [
  {
    slug: "bao-mat",
    title: "Chính sách bảo mật",
    meta: "Cập nhật: ngày 04 tháng 11 năm 2026 · Áp dụng cho trang Visfar Academy và form Đăng ký tư vấn trên trang này.",
    lead: "Chính sách này giải thích Visfar Academy thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu bạn để lại trong form Đăng ký tư vấn như thế nào, và bạn có những quyền gì đối với dữ liệu đó.",
    blocks: [
      { type: "h2", text: "1. Phạm vi áp dụng và bên xử lý dữ liệu" },
      { type: "p", text: "Chính sách này áp dụng cho mọi người truy cập trang Visfar Academy và để lại thông tin qua form Đăng ký tư vấn trên trang này. Tổ chức đào tạo Visfar Academy là bên quyết định mục đích và cách thức xử lý dữ liệu bạn cung cấp qua form, và chịu trách nhiệm trả lời các yêu cầu của bạn về dữ liệu đó theo khối liên hệ ở cuối trang này. Chính sách này không áp dụng cho các trang web, ứng dụng hay dịch vụ khác mà bạn có thể tới được qua một liên kết đặt trên trang này." },
      { type: "p", text: "Chính sách được xây dựng theo các nguyên tắc chung của pháp luật Việt Nam về bảo vệ dữ liệu cá nhân và bảo vệ quyền lợi người tiêu dùng, cùng các nguyên tắc được thừa nhận rộng rãi trong thông lệ quốc tế: minh bạch, giới hạn đúng mục đích, chỉ thu thập dữ liệu cần thiết, bảo mật và tôn trọng quyền của người cung cấp dữ liệu. Trang này không đưa ra khẳng định về một chứng nhận hay một sự tuân thủ đã được cơ quan nào xác nhận, ngoài cam kết vận hành đúng những gì viết tại đây." },
      { type: "h2", text: "2. Dữ liệu được thu thập" },
      { type: "p", text: "Form Đăng ký tư vấn chỉ thu thập đúng những thông tin bạn tự điền và thông tin hệ thống tự ghi khi bạn gửi form, cụ thể như sau:" },
      { type: "ul", items: ["Họ và tên;", "Số điện thoại;", "Địa chỉ email;", "Tỉnh / thành phố nơi bạn đang sinh sống;", "Trụ cột hoặc chương trình bạn quan tâm;", "Thời gian bạn gửi form, do hệ thống tự ghi nhận để đội ngũ tư vấn theo dõi thứ tự liên hệ."] },
      { type: "p", text: "Form này không yêu cầu, và bạn vui lòng không gửi thêm, giấy tờ tùy thân, số tài khoản ngân hàng, mật khẩu, hay thông tin sức khỏe và các thông tin nhạy cảm khác. Trang này cũng không yêu cầu bạn tạo tài khoản. Nếu bạn gửi thêm thông tin ngoài các mục trên, Visfar Academy sẽ chỉ dùng thông tin đó để liên hệ tư vấn cho yêu cầu của bạn và sẽ không dùng cho mục đích khác." },
      { type: "h2", text: "3. Cơ sở và mục đích xử lý" },
      { type: "p", text: "Khi bạn điền đầy đủ thông tin và bấm gửi form, bạn đồng ý để Visfar Academy xử lý các dữ liệu nêu ở mục 2 cho đúng các mục đích dưới đây. Sự đồng ý này là cơ sở để Visfar Academy liên hệ với bạn, và bạn có thể rút lại đồng ý bất cứ lúc nào theo hướng dẫn ở mục 6, mà việc rút lại không ảnh hưởng tới tính hợp pháp của việc xử lý đã thực hiện trước khi bạn rút lại." },
      { type: "p", text: "Dữ liệu được dùng duy nhất để: liên hệ tư vấn và cùng bạn tìm điểm bắt đầu phù hợp theo ba trụ cột Tâm thức, Trí tuệ và Nhân hiệu; gửi thông tin về chương trình bạn đã quan tâm; ghi nhận và theo dõi yêu cầu tư vấn để không bỏ sót liên hệ; trả lời câu hỏi và xử lý yêu cầu hủy đăng ký, chỉnh sửa hay xóa dữ liệu của bạn. Visfar Academy không dùng dữ liệu để đưa ra quyết định tự động về bạn, không chấm điểm hay phân loại bạn bằng công cụ tự động." },
      { type: "h2", text: "4. Lưu trữ qua Google Sheet và Web App" },
      { type: "p", text: "Khi bạn gửi form, dữ liệu được chuyển qua Web App và lưu trữ trong Google Sheet của Visfar Academy để đội ngũ tư vấn theo dõi và liên hệ. Việc lưu trữ qua dịch vụ của Google đồng nghĩa dữ liệu được xử lý trên hạ tầng kỹ thuật của Google, và Visfar Academy chỉ sử dụng dịch vụ này để vận hành form và lưu trữ đăng ký tư vấn. Chỉ những người trực tiếp phụ trách tư vấn và vận hành trang mới được xem dữ liệu này, trong phạm vi công việc của họ." },
      { type: "p", text: "Dữ liệu chỉ được lưu trong thời gian cần thiết để liên hệ tư vấn và chăm sóc sau đăng ký. Khi không còn cần thiết cho mục đích tư vấn, hoặc khi bạn yêu cầu xóa theo mục 6, dữ liệu sẽ được xóa khỏi danh sách theo dõi tư vấn. Việc xóa khỏi danh sách theo dõi không làm mất hiệu lực của các trao đổi tư vấn đã diễn ra trước đó, nếu bạn và Visfar Academy đã cùng xác nhận bằng một hình thức khác." },
      { type: "h2", text: "5. Không bán, không chia sẻ vì mục đích tiếp thị" },
      { type: "p", text: "Visfar Academy không bán, không cho thuê và không chia sẻ dữ liệu của bạn cho bên thứ ba vì mục đích tiếp thị hay quảng cáo. Dữ liệu chỉ được chuyển cho bên cung cấp hạ tầng kỹ thuật vận hành form và lưu trữ nêu ở mục 4, và chỉ trong phạm vi cần thiết để form hoạt động. Ngoài trường hợp đó, dữ liệu chỉ được cung cấp cho cơ quan nhà nước có thẩm quyền khi pháp luật yêu cầu, và Visfar Academy sẽ thông báo cho bạn khi pháp luật cho phép." },
      { type: "h2", text: "6. Quyền của bạn đối với dữ liệu của mình" },
      { type: "p", text: "Bạn có quyền: được biết dữ liệu của mình đang được xử lý như thế nào; yêu cầu xem và nhận bản sao dữ liệu đăng ký của mình; yêu cầu sửa dữ liệu chưa đúng; rút lại sự đồng ý đã cho khi gửi form; yêu cầu xóa dữ liệu khỏi danh sách theo dõi tư vấn; yêu cầu hạn chế xử lý trong khi một yêu cầu khác của bạn đang được xem xét; và phản ánh, khiếu nại về việc xử lý dữ liệu theo Chính sách giải quyết khiếu nại trên trang này." },
      { type: "p", text: "Để thực hiện các quyền trên, bạn liên hệ qua hotline, email hoặc Zalo hỗ trợ ở khối liên hệ cuối trang, nêu rõ họ tên, số điện thoại và email đã đăng ký để Visfar Academy xác minh đúng người yêu cầu. Visfar Academy sẽ xác nhận đã nhận yêu cầu của bạn trong vòng 03 ngày làm việc và xử lý trong thời gian hợp lý, cố gắng không quá 15 ngày làm việc kể từ khi nhận đủ thông tin xác minh. Nếu yêu cầu của bạn chưa thể thực hiện vì lý do chính đáng, Visfar Academy sẽ giải thích rõ lý do và hướng bạn tới cách xử lý phù hợp." },
      { type: "h2", text: "7. Biện pháp bảo mật" },
      { type: "p", text: "Visfar Academy áp dụng các biện pháp hợp lý, phù hợp với tính chất của dữ liệu đăng ký tư vấn: giới hạn người được xem dữ liệu, sử dụng tài khoản có mật khẩu để truy cập bảng lưu trữ, không công khai dữ liệu trên trang, và nhắc đội ngũ tư vấn giữ kín thông tin khi liên hệ. Không có biện pháp kỹ thuật nào bảo đảm tuyệt đối, vì vậy nếu xảy ra sự cố ảnh hưởng tới dữ liệu của bạn, Visfar Academy sẽ xem xét, khắc phục và thông báo cho bạn cùng cơ quan có thẩm quyền theo quy định của pháp luật về bảo vệ dữ liệu cá nhân." },
      { type: "h2", text: "8. Thay đổi chính sách" },
      { type: "p", text: "Khi cách thu thập hay mục đích xử lý dữ liệu thay đổi, Visfar Academy sẽ cập nhật chính sách này ngay trên trang con này và ghi rõ ngày cập nhật. Việc bạn tiếp tục gửi form sau khi chính sách đã cập nhật được hiểu là bạn đã đọc và đồng ý với nội dung mới. Bạn nên đọc lại chính sách này mỗi khi đăng ký tư vấn." },
    ],
  },
  {
    slug: "dieu-khoan-tham-gia",
    title: "Điều khoản tham gia",
    meta: "Cập nhật: ngày 04 tháng 11 năm 2026 · Áp dụng cho trang Visfar Academy và form Đăng ký tư vấn trên trang này.",
    lead: "Điều khoản này là thỏa thuận chung giữa bạn và Visfar Academy khi bạn đăng ký tư vấn và tham gia các chương trình, buổi tư vấn và cộng đồng của Visfar Academy.",
    blocks: [
      { type: "h2", text: "1. Đối tượng và phạm vi áp dụng" },
      { type: "p", text: "Điều khoản này áp dụng cho việc bạn truy cập trang Visfar Academy, đăng ký tư vấn qua form trên trang và tham gia các chương trình, buổi tư vấn, nhóm Zalo và cộng đồng do Visfar Academy tổ chức. Trang hướng tới người đã đủ 18 tuổi; người chưa đủ 18 tuổi chỉ đăng ký và tham gia khi có sự đồng ý của cha, mẹ hoặc người giám hộ. Visfar Academy là nền tảng chia sẻ tư duy theo triết lý giáo dục tận gốc, không phải cơ sở khám chữa bệnh, và không cung cấp dịch vụ tư vấn y tế, tâm lý lâm sàng hay tư vấn pháp lý chuyên môn." },
      { type: "h2", text: "2. Cách đăng ký tư vấn" },
      { type: "p", text: "Bạn đăng ký tư vấn bằng cách điền form Đăng ký tư vấn trên trang, gồm họ tên, số điện thoại, email, tỉnh / thành phố và trụ cột hoặc chương trình quan tâm. Việc đăng ký tư vấn là miễn phí và không bắt buộc bạn phải tham gia bất kỳ chương trình trả phí nào. Sau khi nhận đăng ký, đội ngũ tư vấn sẽ liên hệ qua số điện thoại hoặc email bạn đã để lại để cùng bạn tìm điểm bắt đầu phù hợp. Việc đăng ký chưa đồng nghĩa với việc giữ chỗ hay xác nhận lịch, cho tới khi hai bên cùng xác nhận bằng một hình thức liên hệ cụ thể." },
      { type: "h2", text: "3. Trách nhiệm cung cấp thông tin đúng" },
      { type: "p", text: "Bạn chịu trách nhiệm về tính chính xác của thông tin mình để lại, và vui lòng cập nhật kịp thời khi thông tin liên hệ thay đổi, bằng cách đăng ký lại hoặc liên hệ qua hotline, email hay Zalo hỗ trợ. Bạn không dùng tên, số điện thoại hay email của người khác để đăng ký khi chưa được người đó đồng ý. Nếu Visfar Academy không liên hệ được vì thông tin bạn để lại chưa đúng, Visfar Academy không chịu trách nhiệm về việc chậm liên hệ, và bạn có thể đăng ký lại với thông tin đúng." },
      { type: "h2", text: "4. Tôn trọng nội dung và quyền sở hữu trí tuệ" },
      { type: "p", text: "Nội dung trên trang, tài liệu và bài giảng trong chương trình được chia sẻ để bạn học và rèn luyện cho bản thân. Bạn vui lòng không sao chép, ghi hình, ghi âm hay phát tán nội dung cho mục đích thương mại, và không đăng tải lại toàn bộ tài liệu lên nơi công cộng, khi chưa được Visfar Academy đồng ý. Việc trích dẫn ngắn gọn cho mục đích học tập, kèm ghi rõ nguồn Visfar Academy, được tôn trọng theo quy định của pháp luật về quyền tác giả. Các khái niệm về tâm thức và phẩm chất được dùng làm khung tham khảo để học và rèn luyện, không trình bày như trích dẫn đã kiểm chứng từ một nguồn cụ thể." },
      { type: "h2", text: "5. Ứng xử trong cộng đồng" },
      { type: "p", text: "Khi tham gia nhóm Zalo và cộng đồng Visfar, bạn ứng xử tôn trọng, lắng nghe và chia sẻ trên tinh thần học hỏi: không đăng nội dung quảng cáo, không gây mâu thuẫn, không xúc phạm hay tiết lộ thông tin cá nhân của người khác khi chưa được đồng ý, và không đăng nội dung vi phạm pháp luật hay trái thuần phong mỹ tục. Nếu có hành vi ảnh hưởng tới cộng đồng, đội ngũ Visfar sẽ nhắc nhở và trao đổi trực tiếp với bạn trước; chỉ khi hành vi tiếp diễn sau nhắc nhở, Visfar Academy mới có thể mời bạn rời nhóm, để bảo vệ không gian học tập chung." },
      { type: "h2", text: "6. Quyền thay đổi lịch và nội dung tư vấn" },
      { type: "p", text: "Visfar Academy có thể điều chỉnh lịch tư vấn, hình thức, nội dung hay người đồng hành vì lý do khách quan, và sẽ thông báo trước cho bạn qua thông tin liên hệ bạn đã đăng ký, trong thời gian hợp lý. Nếu thay đổi làm ảnh hưởng đáng kể tới việc tham gia của bạn, bạn có thể chọn lịch khác, chọn hình thức khác, hoặc hủy đăng ký tư vấn mà không phải chịu phí, theo Chính sách hoàn trả / hủy đăng ký trên trang này. Nội dung chương trình có thể được cập nhật để rõ ràng và phù hợp hơn, nhưng vẫn giữ đúng triết lý giáo dục tận gốc và ba trụ cột đã công bố." },
      { type: "h2", text: "7. Tính chất tư vấn giáo dục và giới hạn trách nhiệm" },
      { type: "p", text: "Các chương trình và buổi tư vấn của Visfar Academy mang tính chia sẻ tư duy, rèn luyện nhận thức và xây dựng nhân hiệu trong đời sống và công việc. Nội dung không thay thế tư vấn y tế, tâm lý hay pháp lý chuyên môn, và bạn nên tìm tới chuyên gia có chuyên môn khi gặp vấn đề thuộc các lĩnh vực đó. Visfar Academy không cam kết một kết quả cụ thể nào cho từng người, vì sự thay đổi phụ thuộc vào việc bạn thay đổi cách nhìn, cách nghĩ và cách sống một cách đều đặn và kiên trì, cùng với sự đồng hành của đội ngũ Visfar." },
      { type: "p", text: "Trong phạm vi pháp luật cho phép, trách nhiệm của Visfar Academy giới hạn ở việc cung cấp thông tin đúng, tư vấn thiện chí và tổ chức chương trình đúng như đã thông báo và xác nhận với bạn. Giới hạn này không làm mất quyền lợi của bạn theo pháp luật bảo vệ quyền lợi người tiêu dùng, và không loại trừ trách nhiệm trong trường hợp Visfar Academy vi phạm nghĩa vụ đã cam kết rõ ràng với bạn." },
      { type: "h2", text: "8. Thay đổi điều khoản" },
      { type: "p", text: "Visfar Academy có thể cập nhật điều khoản này để phù hợp với cách tổ chức chương trình và quy định pháp luật, và sẽ đăng bản mới ngay trên trang con này kèm ngày cập nhật. Điều khoản mới áp dụng cho các đăng ký gửi sau ngày cập nhật; các trao đổi và xác nhận đã có trước đó vẫn theo nội dung hai bên đã thống nhất. Nếu bạn không đồng ý với nội dung mới, bạn có thể dừng đăng ký tư vấn và liên hệ để được hướng dẫn." },
    ],
  },
  {
    slug: "hoan-tra-huy-dang-ky",
    title: "Chính sách hoàn trả / hủy đăng ký",
    meta: "Cập nhật: ngày 04 tháng 11 năm 2026 · Áp dụng cho trang Visfar Academy và form Đăng ký tư vấn trên trang này.",
    lead: "Chính sách này nói rõ trang này không thu tiền, cách hủy đăng ký tư vấn, và cách xử lý hoàn trả đối với chương trình có phí theo thông báo riêng của từng chương trình.",
    blocks: [
      { type: "h2", text: "1. Trang này chỉ nhận đăng ký tư vấn, không thu tiền trực tiếp" },
      { type: "p", text: "Trang Visfar Academy chỉ có chức năng giới thiệu chương trình và nhận đăng ký tư vấn qua form. Trang không có chức năng thanh toán, không thu bất kỳ khoản phí nào trực tiếp trên trang, và không thu thập số tài khoản ngân hàng hay thông tin thanh toán của bạn qua form tư vấn. Mọi thông tin về học phí, nếu có, đều được thông báo riêng trong buổi tư vấn và tại thời điểm đăng ký từng chương trình, trước khi bạn thanh toán bằng bất kỳ hình thức nào." },
      { type: "h2", text: "2. Hủy đăng ký tư vấn" },
      { type: "p", text: "Bạn có thể hủy yêu cầu tư vấn bất cứ lúc nào, không cần nêu lý do và không phải chịu phí, bằng cách liên hệ qua hotline, email hoặc Zalo hỗ trợ ở khối liên hệ cuối trang. Khi nhận được yêu cầu, Visfar Academy sẽ dừng liên hệ tư vấn, xóa bạn khỏi danh sách theo dõi tư vấn và xác nhận đã hủy cho bạn. Việc hủy đăng ký tư vấn không ảnh hưởng tới việc bạn đăng ký lại sau này, nếu bạn muốn." },
      { type: "h2", text: "3. Chương trình có phí: điều kiện được thông báo riêng trước khi thanh toán" },
      { type: "p", text: "Đối với chương trình có phí, trước khi bạn thanh toán, Visfar Academy sẽ thông báo rõ bằng văn bản hoặc bằng hình thức liên hệ đã xác nhận: mức phí, hình thức và thời hạn thanh toán, lịch và hình thức học, điều kiện hoàn trả, chuyển đổi sang chương trình khác hay bảo lưu (nếu có), và thời hạn áp dụng của từng điều kiện đó. Chỉ điều kiện đã thông báo rõ và được bạn xác nhận tại thời điểm đó mới được áp dụng; Visfar Academy không áp dụng thêm điều kiện hoàn trả nào mà bạn chưa được biết trước khi thanh toán. Bạn vui lòng giữ lại xác nhận đăng ký và chứng từ thanh toán để đối chiếu khi cần." },
      { type: "h2", text: "4. Chương trình phí tùy tâm" },
      { type: "p", text: "Chương trình Chuyên Gia Tư Vấn và Huấn Luyện Tâm Thức áp dụng phí tùy tâm. Mức đóng góp do bạn tự quyết định, theo khả năng và sự trân trọng của bạn, và được thông báo rõ về cách đóng góp trước khi tham gia, trong buổi tư vấn. Việc đóng góp tùy tâm không phải là điều kiện để bạn được tư vấn, và bạn vẫn được tư vấn đầy đủ ngay cả khi chưa quyết định mức đóng góp." },
      { type: "h2", text: "5. Nguyên tắc hoàn trả theo quy định bảo vệ người tiêu dùng" },
      { type: "p", text: "Việc hoàn trả, nếu có, được xử lý trên các nguyên tắc chung của pháp luật Việt Nam về bảo vệ quyền lợi người tiêu dùng: thông tin về phí và điều kiện phải rõ ràng trước khi thanh toán; tôn trọng quyền được biết, quyền lựa chọn và quyền khiếu nại của bạn; không gây khó khăn bất hợp lý khi bạn gửi yêu cầu; và giải quyết thiện chí, công bằng, dựa trên điều kiện đã thông báo và chứng từ thực tế. Nếu chương trình đã diễn ra đúng như đã thông báo và xác nhận, việc hoàn trả được xem xét theo đúng điều kiện hoàn trả đã thông báo cho chương trình đó." },
      { type: "h2", text: "6. Trình tự gửi yêu cầu và thời gian phản hồi" },
      { type: "p", text: "Để gửi yêu cầu hủy đăng ký, hoàn trả hay chuyển đổi, bạn liên hệ qua hotline, email hoặc Zalo hỗ trợ, nêu rõ họ tên, số điện thoại và email đã đăng ký, tên chương trình, ngày đăng ký hoặc ngày thanh toán (nếu có), nội dung yêu cầu và mong muốn của bạn, kèm chứng từ thanh toán nếu yêu cầu liên quan tới khoản đã trả. Visfar Academy sẽ xác nhận đã nhận yêu cầu trong vòng 03 ngày làm việc, và phản hồi kết quả trong vòng 07 ngày làm việc đối với yêu cầu đơn giản, hoặc không quá 15 ngày làm việc đối với yêu cầu cần kiểm tra thêm, kể từ khi nhận đủ thông tin. Nếu yêu cầu được chấp nhận, hình thức và thời gian hoàn trả thực hiện theo điều kiện đã thông báo của chương trình và theo kênh thanh toán bạn đã dùng; nếu yêu cầu chưa được chấp nhận, Visfar Academy sẽ giải thích rõ lý do và hướng dẫn bạn gửi khiếu nại theo Chính sách giải quyết khiếu nại trên trang này." },
    ],
  },
  {
    slug: "giai-quyet-khieu-nai",
    title: "Giải quyết khiếu nại",
    meta: "Cập nhật: ngày 04 tháng 11 năm 2026 · Áp dụng cho trang Visfar Academy và form Đăng ký tư vấn trên trang này.",
    lead: "Visfar Academy tiếp nhận mọi phản ánh và khiếu nại về tư vấn, chương trình và cách phục vụ, và xử lý trên tinh thần thiện chí, tôn trọng, theo các bước và thời gian nêu dưới đây. Bạn có thể gửi khiếu nại mà không phải chịu phí.",
    blocks: [
      { type: "h2", text: "1. Phạm vi tiếp nhận" },
      { type: "p", text: "Visfar Academy tiếp nhận mọi phản ánh và khiếu nại liên quan tới trang này và hoạt động của Visfar Academy: việc đăng ký và liên hệ tư vấn, nội dung và cách tổ chức chương trình, thái độ phục vụ, thông tin về phí và điều kiện hoàn trả, và việc xử lý dữ liệu cá nhân của bạn. Bạn được khuyến khích liên hệ trực tiếp với Visfar Academy trước, để hai bên cùng làm rõ sự việc một cách thiện chí, thay vì để hiểu lầm kéo dài." },
      { type: "h2", text: "2. Cách gửi khiếu nại" },
      { type: "p", text: "Bạn có thể gửi phản ánh qua hotline, email hoặc Zalo hỗ trợ ở khối liên hệ cuối trang, mà không phải chịu phí gửi khiếu nại. Khi gửi, bạn vui lòng nêu: họ tên, số điện thoại và email đã đăng ký; nội dung phản ánh và thời điểm xảy ra sự việc; mong muốn của bạn; và tài liệu, hình ảnh hay trao đổi liên quan, nếu có. Thông tin càng rõ ràng, việc kiểm tra càng nhanh và chính xác. Visfar Academy giữ kín nội dung khiếu nại của bạn trong quá trình xử lý, và chỉ chia sẻ cho những người trực tiếp liên quan tới việc kiểm tra." },
      { type: "h2", text: "3. Các bước xử lý" },
      { type: "ul", items: ["Bước 1 — Tiếp nhận và xác nhận: ghi nhận khiếu nại, xác nhận đã nhận và cho bạn biết kênh sẽ theo dõi vụ việc của bạn.", "Bước 2 — Kiểm tra và làm rõ: đối chiếu thông tin bạn cung cấp với đăng ký, trao đổi tư vấn và chương trình liên quan, và liên hệ với bạn khi cần làm rõ thêm.", "Bước 3 — Hòa giải và thương lượng: hai bên trao đổi thiện chí, trên tinh thần tôn trọng và hướng tới giải pháp công bằng, phù hợp với điều kiện đã thông báo và quy định của pháp luật.", "Bước 4 — Thông báo kết quả: thông báo kết quả xử lý và hướng thực hiện đã thống nhất, bằng điện thoại, email hoặc Zalo, theo kênh bạn đã dùng để gửi khiếu nại."] },
      { type: "h2", text: "4. Thời gian xử lý" },
      { type: "p", text: "Visfar Academy xác nhận đã nhận khiếu nại trong vòng 03 ngày làm việc kể từ khi nhận được phản ánh của bạn. Thời gian xử lý thông thường là không quá 15 ngày làm việc kể từ khi nhận đủ thông tin cần thiết; đối với vụ việc phức tạp cần kiểm tra thêm, thời gian có thể kéo dài tới 30 ngày làm việc, và Visfar Academy sẽ thông báo cho bạn lý do kéo dài cùng thời gian dự kiến hoàn thành. Các mốc thời gian này là cam kết vận hành của Visfar Academy, áp dụng theo chuẩn chung về xử lý phản ánh của người tiêu dùng, và không làm mất quyền của bạn theo pháp luật khi cần tới cơ quan có thẩm quyền." },
      { type: "h2", text: "5. Nguyên tắc giải quyết" },
      { type: "p", text: "Mọi khiếu nại được giải quyết trên nguyên tắc thiện chí, tôn trọng, công bằng và giữ kín thông tin. Visfar Academy không phân biệt hay gây khó khăn cho bạn vì bạn đã gửi khiếu nại, và không yêu cầu bạn phải rút khiếu nại để được tư vấn hay tham gia chương trình. Nếu sự việc thuộc trách nhiệm của Visfar Academy, Visfar Academy sẽ nhận rõ phần trách nhiệm của mình và thực hiện biện pháp khắc phục đã thống nhất; nếu sự việc xuất phát từ hiểu lầm, hai bên cùng làm rõ để tránh lặp lại." },
      { type: "h2", text: "6. Khi hòa giải không thành" },
      { type: "p", text: "Nếu hai bên đã trao đổi thiện chí mà chưa thống nhất được hướng giải quyết, bạn có thể gửi yêu cầu tới cơ quan quản lý nhà nước có thẩm quyền về bảo vệ quyền lợi người tiêu dùng, hoặc cơ quan có thẩm quyền giải quyết tranh chấp theo pháp luật Việt Nam, để được hòa giải hoặc xử lý theo quy định; hoặc khởi kiện tại Tòa án có thẩm quyền theo pháp luật Việt Nam. Nếu hai bên đã thỏa thuận về trọng tài thương mại, tranh chấp có thể được giải quyết bằng trọng tài theo thỏa thuận đó. Visfar Academy tôn trọng kết quả hòa giải, quyết định của cơ quan có thẩm quyền và phán quyết của Tòa án hay trọng tài, khi đã có hiệu lực theo pháp luật." },
    ],
  },
];

export const POLICY_SLUGS = POLICIES.map((p) => p.slug);
