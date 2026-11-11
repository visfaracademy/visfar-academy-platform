// Test Blog — slug duy nhat, khop slugifyVi(tieu de), tim theo slug.
import { describe, expect, it } from 'vitest';
import { BLOG_POSTS } from './homepage-data';
import { getBlogPostBySlug } from './blog';
import { slugifyVi } from './learning';

describe('BLOG_POSTS', () => {
  it('co 3 bai, slug duy nhat va khop slugifyVi(tieu de)', () => {
    expect(BLOG_POSTS).toHaveLength(3);
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(3);
    for (const p of BLOG_POSTS) {
      expect(p.slug).toBe(slugifyVi(p.title));
    }
  });

  it('noi dung bai la doan ngan da chot, khong rong', () => {
    for (const p of BLOG_POSTS) {
      expect(p.body.trim().length).toBeGreaterThan(20);
      expect(p.meta.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('getBlogPostBySlug', () => {
  it('tim dung bai theo slug, tra null khi khong co', () => {
    expect(getBlogPostBySlug('ro-hinh-la-ra-qua')?.title).toBe('Rõ hình là ra quả');
    expect(getBlogPostBySlug('khong-ton-tai')).toBeNull();
  });
});
