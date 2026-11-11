'use client';

// Trang /blog — danh sach bai viet (3 bai da chot o BLOG_POSTS).
// Trang Blog tren trang chu giu nguyen; day la trang rieng de doc day du.
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/homepage-data';

export default function BlogPage() {
  return (
    <main className="blog-page">
      <div className="wrap">
        <p className="chapter">Bài viết và tài nguyên</p>
        <h1 className="gold-title">Blog Visfar Academy</h1>
        <p>
          Mỗi bài đi thẳng vào khái niệm, hình trong đầu, trạng thái trong lòng.
          Đọc trước, cảm trước — rồi mới hành động.
        </p>
        <div className="blog-grid">
          {BLOG_POSTS.map((b) => (
            <article key={b.slug} className="card">
              <p className="blog-pillar">{b.pillar}</p>
              <h2>
                <Link href={`/blog/${b.slug}`}>{b.title}</Link>
              </h2>
              <p>{b.body}</p>
              <p className="meta">{b.meta}</p>
              <p>
                <Link href={`/blog/${b.slug}`}>Đọc bài →</Link>
              </p>
            </article>
          ))}
        </div>
        <p>
          <Link href="/#tu-van">Nhận tư vấn về chương trình phù hợp →</Link>
        </p>
      </div>
    </main>
  );
}
