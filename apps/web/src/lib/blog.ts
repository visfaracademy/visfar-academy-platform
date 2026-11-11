// Blog — lay bai theo slug. Bai viet hien chi co doan ngan da chot o
// homepage-data.ts (BLOG_POSTS); trang chi tiet hien thi dung doan do,
// khong bia them noi dung dai.
import { BLOG_POSTS, type BlogPost } from './homepage-data';

export function getBlogPostBySlug(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
