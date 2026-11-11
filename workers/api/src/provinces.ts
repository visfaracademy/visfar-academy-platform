// 34 tinh/thanh pho — copy NGUYEN VAN tu packages/shared/constants.ts
// (nguon duy nhat o frontend). Neu danh sach doi, sua ca 2 noi.
// Khong import tu workspace: Workers build doc lap, khong phu thuoc monorepo.
export const PROVINCES: readonly string[] = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng',
  'Đắk Lắk', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Nội',
  'Hà Tĩnh', 'Hải Phòng', 'Huế', 'Hưng Yên', 'Khánh Hòa', 'Lai Châu',
  'Lâm Đồng', 'Lào Cai', 'Lạng Sơn', 'Nghệ An', 'Ninh Bình', 'Phú Thọ',
  'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh',
  'Thái Nguyên', 'Thanh Hóa', 'TP. Hồ Chí Minh', 'Tuyên Quang', 'Vĩnh Long',
] as const;
