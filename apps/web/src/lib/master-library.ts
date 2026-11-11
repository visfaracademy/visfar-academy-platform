// Thu vien Master — doc cong khai + validate du lieu admin.
// Trang cong khai doc tu Supabase (chi bai is_published=true); neu bang
// chua ton tai (prod chua ap migration 0025) hoac DB tra ve rong thi
// dung du lieu mac dinh trong master-library-data.ts (noi dung that cua
// user, khong bia). Admin ghi qua /api/admin/library (RLS chi admin).
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { normalizeYouTubeUrl, slugifyVi } from './learning';
import { normalizeSearch } from './validation';
import { MASTER_LIBRARY_DEFAULT_ITEMS } from './master-library-data';

export interface MasterLibraryItem {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  content: string;
  cover_image_url: string | null;
  video_url: string | null;
  is_published: boolean;
  display_order: number;
}

export type LibraryState =
  | { status: 'loading' }
  | { status: 'success'; items: MasterLibraryItem[]; source: 'db' | 'default' }
  | { status: 'error'; message: string; isOffline: boolean }
  | { status: 'not-configured' };

function toLibraryItem(row: Record<string, unknown>): MasterLibraryItem {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    category: typeof row.category === 'string' ? row.category : null,
    content: typeof row.content === 'string' ? row.content : '',
    cover_image_url: typeof row.cover_image_url === 'string' ? row.cover_image_url : null,
    video_url: typeof row.video_url === 'string' ? row.video_url : null,
    is_published: row.is_published === true,
    display_order: typeof row.display_order === 'number' ? row.display_order : 0,
  };
}

/** Doc bai da xuat ban; fallback du lieu mac dinh khi DB chua co / rong. */
export async function fetchPublishedLibraryItems(): Promise<LibraryState> {
  if (!isSupabaseConfigured()) return { status: 'success', items: MASTER_LIBRARY_DEFAULT_ITEMS, source: 'default' };
  const supabase = getSupabaseClient();
  if (!supabase) return { status: 'success', items: MASTER_LIBRARY_DEFAULT_ITEMS, source: 'default' };
  try {
    const { data, error } = await supabase
      .from('master_library_items')
      .select('id,title,slug,category,content,cover_image_url,video_url,is_published,display_order')
      .eq('is_published', true)
      .order('display_order', { ascending: true });
    if (error) return { status: 'success', items: MASTER_LIBRARY_DEFAULT_ITEMS, source: 'default' };
    const items = (data ?? []).map((r) => toLibraryItem(r as Record<string, unknown>));
    if (items.length === 0) return { status: 'success', items: MASTER_LIBRARY_DEFAULT_ITEMS, source: 'default' };
    return { status: 'success', items, source: 'db' };
  } catch (err) {
    const isOffline =
      err instanceof TypeError || (err instanceof Error && /network|fetch|Failed to fetch/i.test(err.message));
    if (isOffline) return { status: 'error', message: 'Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.', isOffline: true };
    return { status: 'success', items: MASTER_LIBRARY_DEFAULT_ITEMS, source: 'default' };
  }
}

export interface LibraryInput {
  title: string;
  slug: string;
  category: string;
  content: string;
  coverImageUrl: string;
  videoUrl: string;
  isPublished: boolean;
  displayOrder: number;
}

/** Validate du lieu admin gui len (dung chung cho tao + sua). */
export function validateLibraryInput(input: LibraryInput): string | null {
  const title = input.title.trim();
  if (title.length < 2) return 'Tiêu đề phải có ít nhất 2 ký tự.';
  if (title.length > 200) return 'Tiêu đề tối đa 200 ký tự.';
  const slug = input.slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Slug chỉ gồm chữ thường, số và dấu gạch ngang (vd: 7-bo-thi-quan-trong-doi-nguoi).';
  }
  if (input.category.trim().length > 100) return 'Chuyên mục tối đa 100 ký tự.';
  if (input.content.length > 200000) return 'Nội dung tối đa 200.000 ký tự.';
  if (input.coverImageUrl.trim() !== '' && !/^https?:\/\/.+/i.test(input.coverImageUrl.trim())) {
    return 'Link ảnh bìa phải bắt đầu bằng http:// hoặc https://.';
  }
  if (input.videoUrl.trim() !== '' && normalizeYouTubeUrl(input.videoUrl) === null) {
    return 'Link video phải là link YouTube hợp lệ (watch / youtu.be / embed / shorts / live) hoặc mã video 11 ký tự.';
  }
  if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0 || input.displayOrder > 10000) {
    return 'Thứ tự hiển thị phải là số nguyên từ 0 đến 10000.';
  }
  return null;
}

/** Goi y slug tu tieu de (dung slugifyVi da co). */
export function suggestLibrarySlug(title: string): string {
  return slugifyVi(title);
}

/**
 * Tach noi dung thanh doan de hien thi. Doan mo dau bang "Ten khai niem:"
 * (<= 30 ky tu truoc dau hai cham) thi in dam phan ten — dung cho bai
 * 7 bo thi (Nhan thi:, Nhãn thí:, ...). Tra ve tung doan {lead, rest}.
 */
export function splitLibraryParagraphs(content: string): { lead: string | null; rest: string }[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      const m = p.match(/^([^:\n]{2,30}):\s+([\s\S]+)$/);
      if (m) return { lead: `${m[1]}:`, rest: m[2] };
      return { lead: null, rest: p };
    });
}

/**
 * Ban do ten khai niem (chuan hoa: bo dau tieng Viet, bo dau ':' cuoi,
 * chu thuong) -> slug. Dung cho link cheo trong bai viet: mot dong trong
 * muc tong quan (vd "Cao nhân", "Khiêm tốn") trung ten mot khai niem
 * thi thanh link toi muc chi tiet do. Ten khong co muc chi tiet (vd
 * "Nhan thí") khong co trong ban do, giu nguyen dang chu thuong.
 */
export function buildLibraryTitleIndex(items: MasterLibraryItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(normalizeSearch(item.title.replace(/:\s*$/, '').trim()), item.slug);
  }
  return map;
}
