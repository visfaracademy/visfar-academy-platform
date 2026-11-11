// Noi dung trang chu — lay NGUYEN VAN tu file HTML goc
// (workspace/user/files/Visfar_Academy.html, chot 10/11/2026).
// Khong doi chu da chot, khong bia so lieu. Anh nam o public/images/
// (tach tu base64 trong file goc). 3 su kien dung ngay 25/11/2026,
// 18:30, Zoom theo quyet dinh da chot (khong dung ngay 22/25/28-05/2026).
// Khoa 04/05/06: van ban lay tu phan Linh vuc, da duoc user chap nhan
// (Quyet dinh 10, 10/11/2026) nen khong con danh dau noi dung tam nua.
// 3 tru cot: Than – Tam – Tue (11/11/2026) — thay cho bo cu Tam thuc –
// Tri tue – Nhan hieu o nhan tru cot/phan loai khoa hoc.

export interface HomeCourse {
  num: string;
  slug: string;
  cats: string[];
  kicker: string;
  posterTitle: string;
  posterSub: string;
  title: string;
  subtitle: string;
  description: string;
  contentTitle: string;
  content: string[];
  outcomeLabel: string;
  outcome: string;
  extra?: string[];
  ctaLabel: string;
  featured?: boolean;
  temp?: boolean;
}

export const HOME_COURSES: HomeCourse[] = [
  {
    num: '01',
    slug: 'thau-hieu-noi-tam',
    cats: ['tam'],
    kicker: 'Khởi đầu miễn phí | Dành cho mọi người',
    posterTitle: 'THẤU HIỂU NỘI TÂM',
    posterSub: 'Khởi đầu miễn phí | Dành cho mọi người',
    title: 'THẤU HIỂU NỘI TÂM',
    subtitle: 'Hiểu bản thân để bắt đầu thay đổi',
    description:
      'Giúp bạn nhận diện những yếu tố đang chi phối nhận thức, suy nghĩ, cảm xúc và hành vi của chính mình.',
    contentTitle: 'Nội dung chính',
    content: [
      'Nhận diện bản thân và những khuôn mẫu nhận thức.',
      'Hiểu mối liên hệ giữa suy nghĩ, cảm xúc và hành vi.',
      'Thực hành quan sát tâm thức, tâm thái trong 7 ngày.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome: 'Có nền tảng tự nhận thức và xác định phương hướng phát triển cá nhân.',
    ctaLabel: 'Tư vấn chương trình →',
  },
  {
    num: '02',
    slug: 'thau-hieu-tam-thuc',
    cats: ['tam'],
    kicker: 'Trụ cột 2 | TÂM',
    posterTitle: 'THẤU HIỂU TÂM',
    posterSub: 'Trụ cột 2 | TÂM',
    title: 'THẤU HIỂU TÂM',
    subtitle: 'Thấu hiểu gốc rễ nhận thức – Làm chủ bản thân',
    description:
      'Khám phá cách tâm thức hình thành nhận thức, định hướng suy nghĩ, cảm xúc, lựa chọn và hành vi trong đời sống.',
    contentTitle: 'Nội dung chính',
    content: [
      'Cấu trúc và cơ chế vận hành của tâm thức.',
      'Nhận thức về tài chính, sức khỏe, thời gian và các mối quan hệ.',
      'Nhận diện niềm tin, thói quen và khuôn mẫu tư duy.',
      'Rèn luyện khả năng quan sát và quản trị bản thân.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome:
      'Hiểu rõ hơn những yếu tố bên trong đang ảnh hưởng đến cuộc sống và chủ động điều chỉnh hành vi.',
    ctaLabel: 'Tư vấn chương trình →',
  },
  {
    num: '03',
    slug: 'thau-hieu-tri-tue',
    cats: ['tue'],
    kicker: 'Trụ cột 3 | TUỆ',
    posterTitle: 'THẤU HIỂU TRÍ TUỆ',
    posterSub: 'Trụ cột 3 | TUỆ',
    title: 'THẤU HIỂU TRÍ TUỆ',
    subtitle: 'Hiểu bản chất – Mở rộng tư duy – Nâng cao trí tuệ',
    description:
      'Phát triển khả năng nhận biết, phân tích, tư duy độc lập và nhìn nhận vấn đề đa chiều để đưa ra quyết định sáng suốt.',
    contentTitle: 'Nội dung chính',
    content: [
      'Các cấp độ nhận thức: Biết – Hiểu – Thấu suốt – Chuyển hóa.',
      'Tư duy hệ thống, tư duy phản biện và tư duy sáng tạo.',
      'Phân biệt thông tin, bản chất và góc nhìn.',
      'Phương pháp hình thành khái niệm và mô hình tư duy.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome: 'Nâng cao năng lực tư duy, phân định và giải quyết vấn đề trong thực tiễn.',
    ctaLabel: 'Tư vấn chương trình →',
  },
  {
    num: '04',
    slug: 'thau-hieu-suc-khoe',
    cats: ['than'],
    kicker: 'Trụ cột 1 | THÂN',
    posterTitle: 'THẤU HIỂU SỨC KHỎE',
    posterSub: 'Trụ cột 1 | THÂN',
    title: 'THẤU HIỂU SỨC KHỎE',
    subtitle: 'Đẹp thân — tâm — trí — nhan: phần lớn bên trong, phần nhỏ bên ngoài, cần bảo dưỡng đều',
    description:
      'Tâm sinh tướng. Trân trọng, yêu thương bản thân trước; chăm sóc trong lẫn ngoài, đúng, đủ, đều.',
    contentTitle: 'Nội dung chính',
    content: [
      'Tâm sinh tướng: trân trọng, yêu thương bản thân trước.',
      'Chăm sóc trong lẫn ngoài, đúng, đủ, đều.',
      'Thực hành: một nếp nhỏ đều mỗi ngày, thay vì một đợt lớn rồi bỏ.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome: 'Hình thành nếp chăm sóc bản thân đúng, đủ, đều — từ bên trong ra bên ngoài.',
    ctaLabel: 'Tư vấn chương trình →',
  },
  {
    num: '05',
    slug: 'thau-hieu-moi-quan-he',
    cats: ['tam'],
    kicker: 'Trụ cột 2 | TÂM',
    posterTitle: 'THẤU HIỂU MỐI QUAN HỆ',
    posterSub: 'Trụ cột 2 | TÂM',
    title: 'THẤU HIỂU MỐI QUAN HỆ',
    subtitle: 'Mối quan hệ bền bắt đầu từ lắng nghe và thấu hiểu — hiểu người trước khi mong được hiểu',
    description:
      'Khi niềm tin được vun đắp bằng chân thành, trân trọng và bao dung, mỗi người trở thành điểm tựa an vui cho nhau trong gia đình và cuộc sống.',
    contentTitle: 'Nội dung chính',
    content: [
      'Lắng nghe và thấu hiểu — hiểu người trước khi mong được hiểu.',
      'Vun đắp niềm tin bằng chân thành, trân trọng và bao dung.',
      'Trở thành điểm tựa an vui cho nhau trong gia đình và cuộc sống.',
      'Thực hành: lắng nghe trọn vẹn một người thân, trước khi đưa ra lời khuyên.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome: 'Xây dựng mối quan hệ bền, bắt đầu từ lắng nghe và thấu hiểu.',
    ctaLabel: 'Tư vấn chương trình →',
  },
  {
    num: '06',
    slug: 'thau-hieu-tai-chinh',
    cats: ['than'],
    kicker: 'Trụ cột 1 | THÂN',
    posterTitle: 'THẤU HIỂU TÀI CHÍNH',
    posterSub: 'Trụ cột 1 | THÂN',
    title: 'THẤU HIỂU TÀI CHÍNH',
    subtitle: 'Làm chủ vật chất bắt đầu từ cách nhìn về tiền — rồi mới tới công cụ, vốn, thói quen',
    description:
      'Bốn vị trí — làm thuê, làm tư, làm chủ, đầu tư — soi lại thói quen với tiền. Tiết kiệm để đầu tư trước, chi tiêu sau.',
    contentTitle: 'Nội dung chính',
    content: [
      'Cách nhìn về tiền — nền tảng trước công cụ, vốn và thói quen.',
      'Bốn vị trí: làm thuê, làm tư, làm chủ, đầu tư — soi lại thói quen với tiền.',
      'Tiết kiệm để đầu tư trước, chi tiêu sau.',
      'Thực hành: xem lại một thói quen nhỏ với tiền tuần này.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome: 'Bắt đầu làm chủ vật chất từ cách nhìn và thói quen với tiền.',
    ctaLabel: 'Tư vấn chương trình →',
  },
  {
    num: '07',
    slug: 'chuyen-gia-tu-van',
    cats: ['than', 'tam', 'tue'],
    kicker: 'CHƯƠNG TRÌNH TRỌNG TÂM | 5 NGÀY | TRỰC TUYẾN',
    posterTitle: 'CHUYÊN GIA TƯ VẤN VÀ HUẤN LUYỆN TÂM THỨC',
    posterSub: 'CHƯƠNG TRÌNH TRỌNG TÂM | 5 NGÀY | TRỰC TUYẾN',
    title: 'CHUYÊN GIA TƯ VẤN VÀ HUẤN LUYỆN TÂM THỨC',
    subtitle: 'Chuyển hóa từ nhận thức – Kiến tạo giá trị và nhân hiệu',
    description:
      'Chương trình tích hợp ba trụ cột Thân – Tâm – Tuệ, giúp người học nhìn lại nền tảng nhận thức, định hình giá trị bản thân và xây dựng định hướng phát triển.',
    contentTitle: 'Nội dung chính',
    content: [
      'Thân: Chăm sóc thân thể, sức khỏe và nền tảng vật chất — nền bền cho hành trình phát triển.',
      'Tâm: Hiểu mình và nhận diện gốc rễ nhận thức.',
      'Tuệ: Mở rộng góc nhìn, tư duy và khả năng phân định.',
      'Phẩm chất, năng lực và các mối quan hệ trong hành trình phát triển.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome:
      'Có nền tảng nhận thức rõ hơn và định hướng cụ thể cho hành trình phát triển bản thân, nhân hiệu.',
    extra: ['Hình thức: Trực tuyến, 5 ngày.', 'Học phí: Tùy tâm.'],
    ctaLabel: 'Đăng ký tham gia →',
    featured: true,
  },
  {
    num: '08',
    slug: 'master-tam-thuc-nhan-hieu',
    cats: ['than', 'tam', 'tue'],
    kicker: 'CHƯƠNG TRÌNH ỨNG DỤNG | CÁ NHÂN VÀ THỰC TIỄN',
    posterTitle: 'MASTER THÂN – TÂM – TUỆ',
    posterSub: 'CHƯƠNG TRÌNH ỨNG DỤNG | CÁ NHÂN VÀ THỰC TIỄN',
    title: 'MASTER THÂN – TÂM – TUỆ',
    subtitle: 'Biến tri thức thành năng lực – Biến nhận thức thành hành động',
    description:
      'Đưa những kiến thức đã học vào tình huống thực tế, giải quyết vấn đề cụ thể và xây dựng kế hoạch phát triển có thể triển khai.',
    contentTitle: 'Nội dung chính',
    content: [
      'Phân tích vấn đề và xác định mục tiêu thực tế.',
      'Ứng dụng tư duy Tâm – Tuệ trong lựa chọn và hành động.',
      'Thực hành định vị, xây dựng nội dung và phát triển nhân hiệu.',
      'Lập kế hoạch hành động và đánh giá kết quả.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome: 'Tạo ra sản phẩm, kế hoạch hoặc thay đổi cụ thể từ chính tình huống của người học.',
    ctaLabel: 'Tư vấn chương trình →',
  },
  {
    num: '09',
    slug: 'coaching-90-ngay',
    cats: ['than', 'tam', 'tue'],
    kicker: 'CHƯƠNG TRÌNH CHUYÊN SÂU | 90 NGÀY',
    posterTitle: 'COACHING 90 NGÀY ĐỒNG HÀNH',
    posterSub: 'CHƯƠNG TRÌNH CHUYÊN SÂU | 90 NGÀY',
    title: 'COACHING 90 NGÀY ĐỒNG HÀNH',
    subtitle: 'Có định hướng – Có người đồng hành – Có tiến trình thực hiện',
    description:
      'Chương trình dành cho những người mong muốn phát triển chuyên sâu, cần sự đồng hành, phản hồi và rà soát tiến độ trong quá trình thực hiện mục tiêu.',
    contentTitle: 'Nội dung chính',
    content: [
      'Xác định mục tiêu và lộ trình phát triển cá nhân.',
      'Đồng hành, phản hồi và rà soát theo tuần.',
      'Thực hành trên những vấn đề thực tế.',
      'Đánh giá tiến độ và điều chỉnh kế hoạch.',
    ],
    outcomeLabel: 'Kết quả hướng đến',
    outcome: 'Duy trì tiến trình phát triển có định hướng, có trách nhiệm và có khả năng đánh giá.',
    extra: ['Hình thức: Coaching 1–1 hoặc nhóm nhỏ.'],
    ctaLabel: 'Đăng ký tư vấn chuyên sâu →',
  },
  {
    num: '10',
    slug: 'cong-dong-visfar',
    cats: ['cong-dong'],
    kicker: 'HỌC TẬP SUỐT ĐỜI | KẾT NỐI VÀ PHÁT TRIỂN',
    posterTitle: 'CỘNG ĐỒNG VISFAR',
    posterSub: 'HỌC TẬP SUỐT ĐỜI | KẾT NỐI VÀ PHÁT TRIỂN',
    title: 'CỘNG ĐỒNG VISFAR',
    subtitle: 'Cùng học hỏi – Cùng thực hành – Cùng lan tỏa giá trị',
    description:
      'Không dừng lại sau một khóa học, Cộng đồng VISFAR là môi trường để học viên tiếp tục trao đổi tri thức, thực hành và kết nối những người cùng định hướng phát triển.',
    contentTitle: 'Hoạt động chính',
    content: [
      'Chia sẻ tri thức và kinh nghiệm thực tiễn.',
      'Sinh hoạt, thảo luận và thực hành định kỳ.',
      'Kết nối chuyên gia, học viên và đối tác.',
      'Cập nhật kiến thức, công cụ và ứng dụng AI.',
    ],
    outcomeLabel: 'Giá trị hướng đến',
    outcome:
      'Xây dựng cộng đồng học tập tích cực, hỗ trợ nhau trưởng thành và lan tỏa những giá trị tốt đẹp.',
    ctaLabel: 'Tìm hiểu Cộng đồng VISFAR →',
  },
];

export const COURSE_TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'than', label: 'Thân' },
  { value: 'tam', label: 'Tâm' },
  { value: 'tue', label: 'Tuệ' },
  { value: 'cong-dong', label: 'Cộng đồng' },
] as const;

export const HERO_PARAGRAPHS = [
  'Tổ chức đào tạo Visfar là tổ chức giáo dục lấy con người làm trung tâm, lấy sự phát triển toàn diện con người làm mục tiêu; kế thừa tinh hoa minh triết nhân loại, kết hợp giá trị văn hóa dân tộc, tri thức khoa học và tư tưởng giáo dục tiến bộ.',
  'VISFAR quan niệm rằng, giáo dục chân chính không chỉ dừng lại ở việc truyền thụ kiến thức và đào tạo kỹ năng, mà phải hướng đến sự phát triển toàn diện con người: khai mở Tâm thức, nuôi dưỡng Tâm thái, định hướng Tâm đạo, phát triển Trí tuệ, tôi luyện Nghị lực, rèn luyện Thể chất, bồi dưỡng Tinh thần, vun đắp Phẩm chất, hoàn thiện Nhân cách, nâng cao Năng lực và kiến tạo nền tảng Vật chất. Qua đó, giúp mỗi người phát huy trọn vẹn tiềm năng, làm chủ bản thân, sống có giá trị và không ngừng hoàn thiện cuộc đời.',
  'Thông qua sự phát triển hài hòa giữa trí tuệ và đạo đức, thể chất và tinh thần, cá nhân và xã hội, giá trị nội tâm và đời sống vật chất, VISFAR hướng đến xây dựng những con người có hiểu biết, có nhân cách, có bản lĩnh, có năng lực sáng tạo và khả năng kiến tạo giá trị.',
  'Mục tiêu tối thượng của Visfar là lan tỏa Triết Lý Giáo dục Tận Gốc, giúp mỗi người phát triển toàn diện, sống tự do, hạnh phúc, có phẩm giá và trách nhiệm; góp phần xây dựng gia đình hạnh phúc, xã hội nhân văn, dân tộc thịnh vượng và một nhân loại hòa bình, phát triển bền vững.',
];

export const MISSION =
  'VISFAR mang sứ mệnh nghiên cứu, phát triển và lan tỏa tri thức giáo dục Tận Gốc; đồng hành cùng mỗi cá nhân và tổ chức trên hành trình khai mở nhận thức, phát triển trí tuệ, nuôi dưỡng đạo đức, hoàn thiện nhân cách và nâng cao năng lực, hướng tới sự phát triển toàn diện của con người và xã hội.';

export const VISION_LEAD =
  'Trở thành hệ sinh thái giáo dục và phát triển con người có tầm vóc quốc tế, góp phần đưa tri thức và giá trị giáo dục Việt Nam vươn ra toàn cầu.';

export const VISION_BODY =
  'VISFAR hướng tới xây dựng một hệ sinh thái giáo dục mở, kết hợp tinh hoa minh triết nhân loại, tri thức khoa học, giá trị văn hóa Việt Nam và sức mạnh công nghệ; kiến tạo những thế hệ con người có trí tuệ, phẩm chất, bản lĩnh và năng lực, cùng đóng góp cho một tương lai thịnh vượng, nhân văn và bền vững.';

export const VISION_FOOT =
  'Sứ mệnh và tầm nhìn này là la bàn cho mọi chương trình, lộ trình và cộng đồng của Visfar Academy.';

export const FOUNDER_PARAGRAPHS = [
  'Tôi là Lê Đăng Quyết, là nhà sáng lập Visfar Academy – nền tảng nghiên cứu, phát triển và lan tỏa tri thức theo triết lý Giáo dục Tận Gốc.',
  'Tôi theo đuổi một niềm tin xuyên suốt: Muốn thay đổi cuộc đời, trước hết phải thay đổi từ gốc nhận thức. Khi nhận thức được khai mở, trí tuệ được phát triển, tâm thái được nuôi dưỡng và nhân cách được hoàn thiện, con người sẽ từng bước làm chủ bản thân, kiến tạo nhân hiệu và tạo dựng những giá trị bền vững.',
  'Tôi lựa chọn bắt đầu từ con người, bởi sự phát triển của mỗi cá nhân chính là nền tảng cho sự phát triển của gia đình, tổ chức và doanh nghiệp.',
  'Hệ thống tri thức VISFAR được chắt lọc, hệ thống hóa từ tinh hoa minh triết phương Đông, tri thức nhân loại và những thành tựu khoa học hiện đại; hướng đến một lộ trình học tập có nền tảng, có phương pháp và có tính ứng dụng. Mỗi khái niệm cần được hiểu đúng, mỗi vấn đề cần được nhìn nhận đa chiều, mỗi hành động cần được dẫn dắt bởi nhận thức và giá trị đúng đắn.',
  'Tôi không mong muốn trao cho ai những đáp án có sẵn hay khuôn mẫu để sao chép. Tôi mong muốn khơi mở khả năng tự nhận thức, tư duy độc lập và năng lực tự chuyển hóa của mỗi người. Bởi con đường trưởng thành đích thực không thể được đi thay, mà chỉ có thể được soi sáng và đồng hành.',
  'Tôi tin rằng, khi mỗi người biết quản trị chính mình, họ sẽ từng bước làm chủ cuộc đời và tạo ra những giá trị tốt đẹp cho thế giới.',
];

export interface Facet {
  num: string;
  name: string;
  desc: string;
}

export const FACETS: Facet[] = [
  { num: '01', name: 'TÂM THỨC', desc: 'Khai mở khả năng tự nhận biết, thấu hiểu bản thân và nhận diện thế giới nội tâm.' },
  { num: '02', name: 'TÂM THÁI', desc: 'Nuôi dưỡng thái độ sống tích cực, bình an, trân trọng, biết ơn và bao dung.' },
  { num: '03', name: 'TÂM ĐẠO', desc: 'Xây dựng hệ giá trị, nguyên tắc và con đường sống đúng đắn, có ý nghĩa.' },
  { num: '04', name: 'TRÍ TUỆ', desc: 'Phát triển hiểu biết, tư duy độc lập, năng lực phân tích, phản biện và sáng tạo.' },
  { num: '05', name: 'NGHỊ LỰC', desc: 'Tôi luyện bản lĩnh, lòng dũng cảm, sự kiên trì và khả năng vượt qua nghịch cảnh.' },
  { num: '06', name: 'THỂ CHẤT', desc: 'Rèn luyện sức khỏe, thể lực và khả năng duy trì trạng thái sống khỏe mạnh, bền bỉ.' },
  { num: '07', name: 'TINH THẦN', desc: 'Bồi dưỡng đời sống nội tâm, niềm tin, ý nghĩa sống và sự an nhiên.' },
  { num: '08', name: 'PHẨM CHẤT', desc: 'Vun đắp đạo đức, lòng nhân ái, sự chính trực, trách nhiệm và những giá trị tốt đẹp.' },
  { num: '09', name: 'NHÂN CÁCH', desc: 'Hoàn thiện con người thông qua sự thống nhất giữa nhận thức, tư tưởng, lời nói và hành động.' },
  { num: '10', name: 'NĂNG LỰC', desc: 'Nâng cao khả năng vận dụng tri thức, kỹ năng và kinh nghiệm để giải quyết vấn đề, tạo ra giá trị.' },
  { num: '11', name: 'VẬT CHẤT', desc: 'Kiến tạo nền tảng kinh tế, tài chính và điều kiện vật chất ổn định, tự chủ, thịnh vượng.' },
];

export const HOUSE_LEGEND =
  'Đọc đồ hình: Trí tuệ ở giữa; mười yếu tố xung quanh gồm Vật chất, Năng lực, Nhân cách, Phẩm chất, Tâm đạo, Tâm thức, Tâm thái, Nghị lực, Thể chất và Tinh thần; mái ghi Tài chính, viền mái ghi Cảnh giới cuộc sống và Giá trị – Di sản; tường ghi Nội tâm, Sức khỏe và Mối quan hệ. Mười một phương diện có thẻ chữ lớn ngay dưới đây.';

export interface RoadmapStep {
  n: string;
  name: string;
  sub: string;
  body: string;
}

export const ROADMAP_STEPS: RoadmapStep[] = [
  { n: '1', name: 'Biết', sub: 'Xác lập khái niệm', body: 'Bộ khởi đầu: niềm tin, khái niệm đầu tiên.' },
  { n: '2', name: 'Tin', sub: 'Tin vào khái niệm', body: 'Tin vào khái niệm đã biết; niềm tin vững là điểm tựa để hiểu sâu hơn.' },
  { n: '3', name: 'Hiểu', sub: 'Rõ hình trong đầu', body: 'Rõ hình, rõ khái niệm; nhìn rõ bản chất trong toàn cảnh rộng.' },
  { n: '4', name: 'Thấu suốt', sub: 'Đặt câu hỏi đúng', body: 'Hỏi đúng; soi lại khái niệm, hình, trạng thái bằng tam giác hiện thực.' },
  { n: '5', name: 'Chuyển hóa', sub: 'Mong muốn đủ lớn', body: 'Muốn đủ, đổi tư duy, hành vi theo nhận thức mới.' },
  { n: '6', name: 'Huân tập và quảng bá', sub: '', body: 'Ở lại cộng đồng Visfar, luyện đều cho rõ hình, rõ khái niệm.' },
];

export const PHILOSOPHY_CORE = [
  'Giáo dục Tận Gốc là triết lý giáo dục lấy con người làm trung tâm, lấy sự phát triển toàn diện và viên mãn của con người làm mục tiêu.',
  'Giáo dục không chỉ dừng lại ở truyền thụ kiến thức hay đào tạo kỹ năng, mà phải khai mở nhận thức, phát triển trí tuệ, nuôi dưỡng tâm hồn, hoàn thiện nhân cách và phát huy tiềm năng của mỗi con người.',
  'VISFAR hướng đến một nền giáo dục giúp con người hiểu mình, thấu hiểu cuộc sống, làm chủ bản thân, phát triển năng lực và kiến tạo những giá trị tốt đẹp, bền vững cho gia đình, xã hội và nhân loại.',
];

export const PHILOSOPHY_VIEW = [
  'VISFAR quan niệm rằng, giáo dục chân chính phải bắt đầu từ gốc rễ con người, hướng đến sự phát triển hài hòa trên cả phương diện nội tâm và đời sống bên ngoài.',
  'Mỗi người cần được khai mở khả năng tự nhận thức, hình thành tư duy độc lập, nuôi dưỡng tinh thần học tập suốt đời, biết tôn trọng sự khác biệt, sống hài hòa với tự nhiên và có trách nhiệm với cộng đồng.',
  'Biết để hiểu – Hiểu để chuyển hóa – Chuyển hóa để trưởng thành – Trưởng thành để cống hiến.',
];

export const EQUATION_NOTE =
  'Nhân tốt: khái niệm có lợi, hình hướng tốt, lòng cân bằng. Duyên lành từ con người. Quả như ý: thông tin, trạng thái, kết quả vật chất cùng đổi.';

export const GOALS = [
  { label: 'LÀM GIÀU', text: 'Giàu tâm thức, tâm thái, tâm đạo, trí tuệ, nghị lực, thể chất, tinh thần, phẩm chất, nhân cách, năng lực, vật chất.' },
  { label: 'LÀM CHỦ', text: 'Làm chủ nội tâm, sức khỏe, mối quan hệ, tài chính, và tiến tới nâng cao cảnh giới cuộc sống, để lại giá trị & di sản cho nhân sinh và xã hội.' },
  { label: 'TRỞ NÊN', text: 'Khôn ngoan, thông thái, uyên bác và trí tuệ hơn.' },
  { label: 'TRỞ THÀNH', text: 'Người trưởng thành, tiến tới con người tinh hoa, kiến tạo trở thành người giàu toàn diện, lan tỏa giá trị và sứ mệnh của mình.' },
];

export const PRINCIPLES = [
  'Lấy con người làm trung tâm, lấy sự phát triển toàn diện làm mục tiêu.',
  'Tôn trọng sự khác biệt, khuyến khích tư duy độc lập và tinh thần khai phóng.',
  'Kết hợp tri thức với thực hành, nhận thức với hành động.',
  'Đề cao đạo đức, trách nhiệm và sự hài hòa giữa cá nhân, xã hội và tự nhiên.',
  'Khuyến khích học tập suốt đời, tự giáo dục và tự hoàn thiện.',
  'Kế thừa tinh hoa minh triết nhân loại, văn hóa dân tộc và vận dụng thành tựu khoa học hiện đại.',
];

export const DESTINATION = [
  'Giáo dục không nhằm tạo ra những con người giống nhau, mà giúp mỗi người nhận ra giá trị riêng, phát huy tiềm năng và sống một cuộc đời có ý nghĩa.',
  'Một con người phát triển toàn diện không chỉ có tri thức mà còn có trí tuệ; không chỉ có năng lực mà còn có phẩm chất; không chỉ làm chủ bản thân mà còn biết tạo dựng giá trị và đóng góp cho cộng đồng.',
  'Đó là hành trình hướng đến sự viên mãn của con người trên 11 phương diện – cũng chính là tinh thần của Giáo dục Tận Gốc VISFAR.',
];

export interface Field {
  num: string;
  title: string;
  body: string[];
  app: string;
}

export const FIELDS: Field[] = [
  {
    num: '01',
    title: 'Tư vấn và huấn luyện nội tâm',
    body: [
      'Nói cho Biết, Hiểu, Thấu suốt, Chuyển hóa — mỗi tầng một điểm tựa.',
      'Điểm tựa mỗi tầng: niềm tin, cái biết, câu hỏi đúng, mong muốn đủ lớn; người học về với an vui khi học.',
    ],
    app: 'Ứng dụng: mình đang nói ở tầng nào — và người nghe đang ở tầng nào?',
  },
  {
    num: '02',
    title: 'Tư vấn và huấn luyện sức khỏe',
    body: [
      'Đẹp thân — tâm — trí — nhan: phần lớn bên trong, phần nhỏ bên ngoài, cần bảo dưỡng đều.',
      'Tâm sinh tướng. Trân trọng, yêu thương bản thân trước; chăm sóc trong lẫn ngoài, đúng, đủ, đều.',
    ],
    app: 'Ứng dụng: một nếp nhỏ đều mỗi ngày, thay vì một đợt lớn rồi bỏ.',
  },
  {
    num: '03',
    title: 'Tư vấn và huấn luyện mối quan hệ',
    body: [
      'Mối quan hệ bền bắt đầu từ lắng nghe và thấu hiểu — hiểu người trước khi mong được hiểu.',
      'Khi niềm tin được vun đắp bằng chân thành, trân trọng và bao dung, mỗi người trở thành điểm tựa an vui cho nhau trong gia đình và cuộc sống.',
    ],
    app: 'Ứng dụng: lắng nghe trọn vẹn một người thân hôm nay, trước khi đưa ra lời khuyên.',
  },
  {
    num: '04',
    title: 'Tư vấn và huấn luyện tài chính',
    body: [
      'Làm chủ vật chất bắt đầu từ cách nhìn về tiền — rồi mới tới công cụ, vốn, thói quen.',
      'Bốn vị trí — làm thuê, làm tư, làm chủ, đầu tư — soi lại thói quen với tiền. Tiết kiệm để đầu tư trước, chi tiêu sau.',
    ],
    app: 'Ứng dụng: xem lại một thói quen nhỏ với tiền tuần này.',
  },
  {
    num: '05',
    title: 'Tổ chức trường tồn',
    body: [
      'Đặt lợi ích người khác cao hơn lợi ích của mình; tạo giá trị bằng cách cho đi.',
      'Môi trường đẹp, đủ đầy để người giỏi ở lại; hiểu cùng một hướng trước khi làm cùng một việc.',
    ],
    app: 'Ứng dụng: xây văn hóa từ cách đối đãi hằng ngày.',
  },
  {
    num: '06',
    title: 'Cộng đồng tinh hoa',
    body: [
      'Cộng đồng giữ được nhau lâu nhờ nếp sống, ngôn từ chung, sinh hoạt chung rõ ràng.',
      'Thành viên coi nhau như gia đình; người dẫn dắt chuyển giao tri thức, đồng hành chuyển hóa. Sinh hoạt chung giữ cộng đồng gắn qua nhiều thế hệ.',
    ],
    app: 'Ứng dụng: nếp nào giữ người, nếp nào đẩy người đi?',
  },
];

export interface BizCard {
  title: string;
  desc: string;
  who: string;
}

export const BIZ_CARDS: BizCard[] = [
  {
    title: 'Đào tạo cho đội ngũ',
    desc: 'Chương trình theo ba trụ: quản trị tâm thức, tư duy, hành vi — bắt đầu từ con người bên trong.',
    who: 'Đối tượng: đội ngũ, quản lý và hệ thống đại lý.',
  },
  {
    title: 'Diễn giả và hội thảo',
    desc: 'Chia sẻ hệ thống tri thức, trí tuệ theo triết lý giáo dục tận gốc, cho hội thảo, sự kiện nội bộ, cộng đồng doanh nhân.',
    who: 'Đối tượng: ban lãnh đạo, đội ngũ và cộng đồng doanh nhân.',
  },
  {
    title: 'Cố vấn con người và nhân hiệu',
    desc: 'Cố vấn cho lãnh đạo về phát triển con người, văn hóa hành xử, nhân hiệu — làm nền cho thương hiệu tổ chức.',
    who: 'Đối tượng: CEO và ban lãnh đạo doanh nghiệp.',
  },
];

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  img: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Trần Thị Thu Hằng',
    role: 'CEO FutureTech Solutions',
    quote:
      'Anh Quyết là một người thầy tận tâm, tận tình với những kinh nghiệm, trải nghiệm thực tế, một người anh, một người thầy không chỉ biết nói mà còn xắn tay áo vào làm tất cả mọi thứ để chứng minh rằng không gì là không thể.',
    img: '/images/testimonial-thu-hang.png',
  },
  {
    name: 'Lê Hoàng Nam',
    role: 'Founder & Coach tại Mindset Mastery',
    quote:
      'Anh không chỉ là một người thầy, mà còn là một người anh, một người dẫn đường tận tâm, giúp tôi khai phá tiềm năng mà chính tôi cũng chưa từng nhận ra.',
    img: '/images/testimonial-hoang-nam.png',
  },
  {
    name: 'Nguyễn Minh Khoa',
    role: 'Giám đốc điều hành Infinity Group',
    quote:
      'Nhờ anh, tôi không chỉ thay đổi tư duy về kinh doanh, mà còn thay đổi cách nhìn nhận về cuộc sống, trở nên mạnh mẽ và chủ động hơn.',
    img: '/images/testimonial-minh-khoa.png',
  },
  {
    name: 'Đỗ Bảo Anh',
    role: 'Chuyên gia đào tạo & phát triển lãnh đạo',
    quote:
      'Anh là người thầy hiếm có, không chỉ truyền đạt kiến thức mà còn truyền động lực và khát khao vươn lên không ngừng.',
    img: '/images/testimonial-bao-anh.png',
  },
  {
    name: 'Võ Đức Huy',
    role: 'CTO NextGen Solutions',
    quote:
      'Chỉ sau một thời gian ngắn học hỏi từ anh, tôi đã thấy bản thân trưởng thành vượt bậc, nhận thức sâu sắc hơn về nhân – duyên – quả trong kinh doanh lẫn cuộc sống.',
    img: '/images/testimonial-duc-huy.png',
  },
  {
    name: 'Phạm Thanh Trúc',
    role: 'CMO Elite Branding',
    quote:
      'Anh luôn tạo ra một môi trường mà ở đó, ai cũng có thể phát triển, bứt phá và trở thành phiên bản tốt nhất của chính mình.',
    img: '/images/testimonial-thanh-truc.png',
  },
  {
    name: 'Lương Khánh Vy',
    role: 'Chuyên gia tâm lý & phát triển bản thân',
    quote:
      'Mọi lời nói của anh đều xuất phát từ trải nghiệm thực tế, từ những lần thử – sai – sửa, giúp tôi rút ngắn đáng kể hành trình đi đến thành công.',
    img: '/images/testimonial-khanh-vy.png',
  },
  {
    name: 'Nguyễn Hoàng Ánh',
    role: 'Giám đốc sáng tạo tại VisionArt Studio',
    quote:
      'Anh không chỉ là một người thầy, mà còn là một người truyền lửa thực thụ. Nhờ anh, tôi dám mơ lớn và hành động quyết liệt hơn bao giờ hết.',
    img: '/images/testimonial-hoang-anh.png',
  },
];

export interface BlogPost {
  slug: string;
  pillar: string;
  title: string;
  body: string;
  meta: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'ro-hinh-la-ra-qua',
    pillar: 'Tâm thức',
    title: 'Rõ hình là ra quả',
    body: 'Mọi việc bắt đầu bằng hình trong đầu. Hình còn mờ, hành động đi lòng vòng. Hình đã rõ, hành động có chỗ tựa. Đổi hình không phải mơ mộng: nói rõ điều muốn, giữ hình đó mỗi ngày.',
    meta: 'Tâm thức · Đọc trong 2 phút',
  },
  {
    slug: 'nhan-tot-duyen-lanh-qua-nhu-y',
    pillar: 'Trí tuệ',
    title: 'Nhân tốt, duyên lành, quả như ý',
    body: 'Nhân là điều gieo trong mình: khái niệm có lợi, hình hướng tốt, lòng cân bằng. Duyên là người gặp, đường đi, cầu bước qua. Quả không tới vì đòi — quả tới khi nhân tốt, duyên lành, mình vẫn làm đều.',
    meta: 'Trí tuệ · Đọc trong 2 phút',
  },
  {
    slug: 'ngoi-nha-visfar-11-phuong-dien-trong-1-can-phong',
    pillar: 'Nhân hiệu',
    title: 'Ngôi nhà Visfar — 11 phương diện trong 1 căn phòng',
    body: 'Đừng loay hoay dọn bóng tối. Thắp đèn: tâm thức, tâm thái, tâm đạo, trí tuệ, nghị lực, thể chất, tinh thần, phẩm chất, nhân cách, năng lực, vật chất — 11 phương diện, một ánh sáng. Thắp một diện cho sáng hẳn, ánh sáng lan sang các góc còn lại. Nhân hiệu bền cũng vậy: bắt đầu từ con người đã đổi từ gốc, không từ hình ảnh dựng lên.',
    meta: 'Nhân hiệu · Đọc trong 2 phút',
  },
];

export interface HomeEvent {
  tag: string;
  title: string;
  date: string;
  meta: string;
  img: string;
  alt: string;
}

export const HOME_EVENTS: HomeEvent[] = [
  {
    tag: 'Live free',
    title: 'Live: Cách viết content không cần cảm hứng',
    date: '25/11/2026 · 18:30',
    meta: 'Zoom · Miễn phí',
    img: '/images/event-live.jpg',
    alt: 'Micro sân khấu trước khán phòng đông người trong một buổi live',
  },
  {
    tag: 'Members only',
    title: 'Workshop: 5 dạng niềm tin giới hạn thu nhập',
    date: '25/11/2026 · 18:30',
    meta: 'Zoom · Skool members',
    img: '/images/event-workshop.jpg',
    alt: 'Lớp workshop với người hướng dẫn trước màn chiếu và học viên ngồi nghe',
  },
  {
    tag: 'Q&A',
    title: 'Buổi hỏi đáp tháng 11 với Founder',
    date: '25/11/2026 · 18:30',
    meta: 'Zoom · Tất cả học viên',
    img: '/images/event-qa.jpg',
    alt: 'Diễn giả trên sân khấu hội nghị thuyết trình trước khán giả trong khán phòng',
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'Tôi chưa từng học về tâm thức hay phát triển bản thân thì bắt đầu từ đâu?',
    a: 'Từ Thấu Hiểu Nội Tâm, miễn phí; rồi Thấu Hiểu Tâm, Thấu Hiểu Trí Tuệ.',
  },
  {
    q: 'Triết lý giáo dục tận gốc là gì?',
    a: 'Bắt đầu từ gốc nhận thức: rõ khái niệm, hình trong đầu, trạng thái trong lòng — rồi mới tới kỹ năng, kết quả.',
  },
  {
    q: 'Biết — Hiểu — Thấu suốt — Chuyển hóa là gì?',
    a: 'Biết dựa vào niềm tin, Hiểu dựa vào Biết, Thấu suốt dựa vào câu hỏi đúng, Chuyển hóa dựa vào mong muốn đủ lớn.',
  },
  {
    q: 'Các từ như “khái niệm nguồn” hay “tam giác hiện thực” có phải thuật ngữ khoa học không?',
    a: 'Không. Đó là ngôn từ của mô hình thực hành trong hệ thống Visfar. Giải nghĩa từng từ, kèm ví dụ, ở phần 05.',
  },
  {
    q: 'Nhân — Duyên — Quả áp dụng trong đời sống ra sao?',
    a: 'Nhân tốt + Duyên lành = Quả như ý. Nhân tốt: khái niệm có lợi, hình hướng tốt, lòng cân bằng. Duyên lành từ con người. Quả như ý: thông tin, trạng thái, kết quả vật chất. Đây là khung suy ngẫm và hành động, không phải định luật khoa học.',
  },
  {
    q: 'Các chương trình có mang tính tôn giáo không?',
    a: 'Không. Chương trình tập trung vào hiểu mình, rèn tư duy, phẩm chất, dựng nhân hiệu. Ba gốc đạo đức, tôn giáo, khoa học là ba cách soi cùng một sự thật; khung làm việc là tam giác hiện thực. Khái niệm dùng làm khung học, rèn — không trình bày như trích dẫn đã kiểm chứng.',
  },
  {
    q: 'AI và Marketing có phải trọng tâm của Visfar Academy không?',
    a: 'Không. Trọng tâm là Tâm thức, Trí tuệ, Nhân hiệu. AI, Marketing chỉ là ứng dụng mở rộng trong trụ Nhân hiệu.',
  },
  {
    q: 'Các chương trình diễn ra trực tuyến hay trực tiếp, và học phí là bao nhiêu?',
    a: 'Tùy chương trình. Chuyên Gia Tư Vấn và Huấn Luyện Tâm Thức: trực tuyến 5 ngày, phí tùy tâm. Lịch khai giảng đang cập nhật; học phí còn lại thông báo trong buổi tư vấn.',
  },
  {
    q: 'Doanh nghiệp muốn đào tạo riêng thì liên hệ thế nào?',
    a: 'Chọn “Doanh nghiệp — đào tạo / diễn giả / cố vấn” trong form tư vấn, hoặc gọi 034 7897 868.',
  },
];

export interface UpdateCard {
  title: string;
  body: string;
}

export const UPDATE_CARDS: UpdateCard[] = [
  {
    title: 'Đội ngũ chuyên gia',
    body: 'Thông tin về đội ngũ giảng dạy và nghiên cứu sẽ công bố tại đây khi đã xác nhận.',
  },
  {
    title: 'Nghiên cứu & xuất bản',
    body: 'Nghiên cứu, tài liệu tham khảo và ấn phẩm sẽ công bố tại đây khi đã xác nhận.',
  },
  {
    title: 'Đối tác',
    body: 'Mạng lưới hợp tác trong nước và quốc tế sẽ công bố tại đây khi đã xác nhận.',
  },
  {
    title: 'Đánh giá & chứng nhận',
    body: 'Phương pháp đánh giá kết quả học tập và chứng nhận sẽ công bố tại đây khi đã xác nhận.',
  },
];

export const JOURNEY_LINKS = [
  { href: '#su-menh-tam-nhin', label: 'Sứ mệnh & Tầm nhìn' },
  { href: '#gioi-thieu', label: 'Nhà sáng lập' },
  { href: '#triet-ly', label: 'Triết lý' },
  { href: '#bay-phuong-dien', label: 'Thập Nhất Viên Mãn' },
  { href: '#linh-vuc', label: 'Lĩnh vực' },
  { href: '#chuong-trinh', label: 'Chương trình' },
  { href: '#lo-trinh', label: 'Lộ trình' },
  { href: '#doanh-nghiep', label: 'Doanh nghiệp' },
  { href: '#chia-se', label: 'Học viên' },
  { href: '#blog', label: 'Bài viết' },
  { href: '#faq', label: 'Hỏi đáp' },
  { href: '#dang-cap-nhat', label: 'Đang hoàn thiện' },
  { href: '#tu-van', label: 'Kết nối' },
];

export const FOOTER_ABOUT_LINKS = [
  { href: '/#gioi-thieu', label: 'Giới thiệu' },
  { href: '/#su-menh-tam-nhin', label: 'Sứ mệnh & Tầm nhìn' },
  { href: '/#triet-ly', label: 'Triết lý giáo dục tận gốc' },
  { href: '/#lo-trinh', label: 'Lộ trình phát triển' },
  { href: '/chuong-trinh/cong-dong-visfar', label: 'Cộng đồng VISFAR' },
];

export const FOOTER_COURSE_LINKS = [
  { href: '/chuong-trinh/thau-hieu-noi-tam', label: 'Thấu Hiểu Nội Tâm' },
  { href: '/chuong-trinh/thau-hieu-tam-thuc', label: 'Thấu Hiểu Tâm' },
  { href: '/chuong-trinh/thau-hieu-tri-tue', label: 'Thấu Hiểu Trí Tuệ' },
  { href: '/chuong-trinh/thau-hieu-suc-khoe', label: 'Thấu Hiểu Sức Khỏe' },
  { href: '/chuong-trinh/thau-hieu-moi-quan-he', label: 'Thấu Hiểu Mối Quan Hệ' },
  { href: '/chuong-trinh/thau-hieu-tai-chinh', label: 'Thấu Hiểu Tài Chính' },
  { href: '/chuong-trinh/chuyen-gia-tu-van', label: 'Chuyên gia tư vấn và huấn luyện tâm thức' },
  { href: '/chuong-trinh/master-tam-thuc-nhan-hieu', label: 'Master Thân – Tâm – Tuệ' },
  { href: '/chuong-trinh/coaching-90-ngay', label: 'Coaching 90 Ngày Đồng Hành' },
  { href: '/chuong-trinh/cong-dong-visfar', label: 'Cộng Đồng Visfar' },
];

export const FOOTER_SUPPORT_LINKS = [
  { href: '/chinh-sach/bao-mat', label: 'Chính sách bảo mật' },
  { href: '/chinh-sach/dieu-khoan-tham-gia', label: 'Điều khoản tham gia' },
  { href: '/chinh-sach/hoan-tra-huy-dang-ky', label: 'Chính sách hoàn trả / hủy đăng ký' },
  { href: '/chinh-sach/giai-quyet-khieu-nai', label: 'Giải quyết khiếu nại' },
  { href: '/#tu-van', label: 'Tư vấn' },
];
