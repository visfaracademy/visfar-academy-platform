-- 0033: Bo sung loi giai Nhan thi + Toa thi (muc "7 Bo Thi Quan Trong Doi Nguoi").
-- Nguon: tai lieu cua chinh user — file 160_CH.docx trong workspace/user/files/
-- (loi giai Nhan thi: "Nu cuoi thay doi duoc van menh..."; loi giai Toa thi:
-- "doanh nghiep de lai cho con chau tri tue..."). Chi sua nhe loi chinh ta,
-- khong bia them. Tam thi KHONG tim thay loi giai trong bat ky tai lieu nao
-- cua user (DOCX 65 chu de chi co tieu de; PDF tong hop la file anh, khong
-- trich xuat duoc text) nen giu nguyen chi ten, khong them loi giai.
-- Idempotent: UPDATE theo slug; chay lai khong doi.
update public.master_library_items
set content = $lib$Nhan thí

Nhan thí là bố thí nụ cười. Một nụ cười thay đổi được vận mệnh của một quốc gia, thay đổi sự nghiệp, thay đổi cuộc đời. Có mấy câu chuyện: cô gái bán hoa, bán bảo hiểm… Mật mã 7-1-3: 7 bố thí là đối với nhân, để kích duyên lành. Nhắc đến con người là tài sản rất lớn của đời mình — nếu ai có người đến thì người đó rất giàu. Thu hút được người đến thì người ta mới muốn nghe mình nói; khi thu hút con người đến thì mình giàu không thể hình dung.

Nhãn thí
Ngôn thí
Tâm thí
Phòng thí
Thân Thí
Tọa Thí

Tọa thí: nếu muốn nói đến tọa thí thì một doanh nghiệp mà họ để lại cho con cháu của họ không phải là tiền mà họ để lại cho con cháu là trí tuệ — làm thế nào để lại được tri thức mà người sau kế thừa và làm tốt hơn hiện tại. Muốn vậy phải áp dụng được 15 khái niệm nguồn. Ví dụ: chú Sinh làm bên phân bón hoá sinh, học biết bao nhiêu, chi tiền tỷ ra để học mà còn trăn trở không biết làm thế nào để để lại tri thức này cho thế hệ sau; sau đó chú tìm được WiT, hiểu 15 khái niệm nguồn và áp dụng vào doanh nghiệp của mình.$lib$,
    updated_at = now()
where slug = '7-bo-thi-quan-trong-doi-nguoi';
