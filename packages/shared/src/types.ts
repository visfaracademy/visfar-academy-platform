// Visfar Academy — shared types (theo Tai lieu kien truc §3)
import type { Pillar } from './constants';

export type CourseStatus = 'draft' | 'published' | 'archived';

export interface Course {
  id: string;
  slug: string;
  display_order: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  details: {
    noi_dung_chinh?: unknown[];
    ket_qua_huong_den?: unknown[];
    noi_dung_tam?: boolean;
  } | null;
  pillar: Pillar | null;
  poster_url: string | null;
  price_vnd: number;
  // Task 10 (migration 0019): khoa Tuy tam — hoc vien tu chon so tien
  // (>= 0). Mac dinh false; chua khoa nao duoc bat cho toi khi user
  // xac nhan khoa nao la Tuy tam. Optional de khong vo code cu.
  is_pay_what_you_want?: boolean;
  is_featured: boolean;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}
