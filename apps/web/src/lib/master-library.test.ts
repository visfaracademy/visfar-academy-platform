// Test Thu vien Master — du lieu mac dinh + validate + tach doan.
import { describe, expect, it } from 'vitest';
import { MASTER_LIBRARY_DEFAULT_ITEMS } from './master-library-data';
import { normalizeSearch } from './validation';
import {
  buildLibraryTitleIndex,
  splitLibraryParagraphs,
  suggestLibrarySlug,
  validateLibraryInput,
  type LibraryInput,
} from './master-library';

const validInput: LibraryInput = {
  title: '7 Bố Thí Quan Trọng Đời Người',
  slug: '7-bo-thi-quan-trong-doi-nguoi',
  category: 'Khái niệm nguồn',
  content: 'Nhan thí: Đang cập nhật.',
  coverImageUrl: '',
  videoUrl: '',
  isPublished: true,
  displayOrder: 1,
};

describe('MASTER_LIBRARY_DEFAULT_ITEMS', () => {
  it('co 119 muc (3 tong quan + 116 khai niem), slug duy nhat, muc dau la bai 7 bo thi', () => {
    expect(MASTER_LIBRARY_DEFAULT_ITEMS).toHaveLength(119);
    const slugs = MASTER_LIBRARY_DEFAULT_ITEMS.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(MASTER_LIBRARY_DEFAULT_ITEMS[0].slug).toBe('7-bo-thi-quan-trong-doi-nguoi');
    expect(MASTER_LIBRARY_DEFAULT_ITEMS[1].slug).toBe('8-to-chat-nhan-tai');
    expect(MASTER_LIBRARY_DEFAULT_ITEMS[2].slug).toBe(
      '9-dang-nguoi-can-nhan-dang-thu-hut-doi-dai-tro-thanh-trong-triet-ly-giao-duc-tan-goc',
    );
  });

  it('bai 7 bo thi nhac du 7 khai niem; khong muc nao rong (0 "Dang cap nhat")', () => {
    const first = MASTER_LIBRARY_DEFAULT_ITEMS[0];
    for (const name of ['Nhan thí', 'Nhãn thí', 'Ngôn thí', 'Tâm thí', 'Phòng thí', 'Thân Thí', 'Tọa Thí']) {
      expect(first.content).toContain(name);
    }
    const empty = MASTER_LIBRARY_DEFAULT_ITEMS.filter((i) => i.content.trim() === '');
    expect(empty).toHaveLength(0);
    expect(MASTER_LIBRARY_DEFAULT_ITEMS.every((i) => i.is_published)).toBe(true);
  });

  it('moi muc deu co tieu de + slug hop le + chuyen muc', () => {
    for (const item of MASTER_LIBRARY_DEFAULT_ITEMS) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(item.category).toBeTruthy();
    }
    const cats = new Set(MASTER_LIBRARY_DEFAULT_ITEMS.map((i) => i.category));
    for (const cat of ['Bố thí', 'Tố chất nhân tài', '9 dạng người', 'Nhân cách', 'Trí tuệ', 'Khái niệm nguồn']) {
      expect(cats.has(cat)).toBe(true);
    }
  });
});

describe('buildLibraryTitleIndex', () => {
  it('link duoc 9 dang nguoi + khiêm tốn + trân trọng biết ơn; nhan thi khong co muc chi tiet', () => {
    const index = buildLibraryTitleIndex(MASTER_LIBRARY_DEFAULT_ITEMS);
    expect(index.size).toBe(MASTER_LIBRARY_DEFAULT_ITEMS.length);
    for (const [name, slug] of [
      ['Cao nhân', 'cao-nhan'],
      ['Quý nhân', 'quy-nhan'],
      ['Nhân mạch', 'nhan-mach'],
      ['Thần tài', 'than-tai'],
      ['Nhân tài', 'nhan-tai'],
      ['Minh sư', 'minh-su'],
      ['Thầy (cô)', 'thay-co'],
      ['Chuyên gia', 'chuyen-gia'],
      ['Thiện tri thức', 'thien-tri-thuc'],
      ['Khiêm tốn', 'khiem-ton'],
      ['Trân trọng biết ơn', 'tran-trong-biet-on'],
    ] as const) {
      expect(index.get(normalizeSearch(name))).toBe(slug);
    }
    // Nhan thi chi co trong muc tong quan, khong co muc chi tiet rieng.
    expect(index.get('nhan thi')).toBeUndefined();
    expect(index.get('nguoi co tri tue tang bac 1')).toBe('nguoi-co-tri-tue-tang-bac-1');
  });
});

describe('validateLibraryInput', () => {
  it('chap nhan du lieu hop le', () => {
    expect(validateLibraryInput(validInput)).toBeNull();
  });

  it('tu choi tieu de qua ngan, slug sai dinh dang', () => {
    expect(validateLibraryInput({ ...validInput, title: 'A' })).toMatch(/ít nhất 2 ký tự/);
    expect(validateLibraryInput({ ...validInput, slug: 'Bai Viet Moi' })).toMatch(/Slug chỉ gồm/);
    expect(validateLibraryInput({ ...validInput, slug: '' })).toMatch(/Slug chỉ gồm/);
  });

  it('tu choi link anh bia khong phai http(s) va link video khong phai YouTube', () => {
    expect(validateLibraryInput({ ...validInput, coverImageUrl: 'ftp://x/y.jpg' })).toMatch(/http/);
    expect(validateLibraryInput({ ...validInput, videoUrl: 'https://vimeo.com/123' })).toMatch(/YouTube/);
    expect(validateLibraryInput({ ...validInput, videoUrl: 'https://youtu.be/xE0ofNDjBXo' })).toBeNull();
  });

  it('tu choi thu tu hien thi khong hop le', () => {
    expect(validateLibraryInput({ ...validInput, displayOrder: -1 })).toMatch(/Thứ tự/);
    expect(validateLibraryInput({ ...validInput, displayOrder: 1.5 })).toMatch(/Thứ tự/);
  });
});

describe('suggestLibrarySlug', () => {
  it('sinh slug tu tieu de tieng Viet', () => {
    expect(suggestLibrarySlug('7 Bố Thí Quan Trọng Đời Người')).toBe('7-bo-thi-quan-trong-doi-nguoi');
    expect(suggestLibrarySlug('Thầy (Cô)')).toBe('thay-co');
  });
});

describe('splitLibraryParagraphs', () => {
  it('in dam phan ten khai niem truoc dau hai cham', () => {
    const out = splitLibraryParagraphs('Nhan thí: Đang cập nhật.\n\nDoan thuong khong co hai cham dau.');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ lead: 'Nhan thí:', rest: 'Đang cập nhật.' });
    expect(out[1].lead).toBeNull();
  });
});
