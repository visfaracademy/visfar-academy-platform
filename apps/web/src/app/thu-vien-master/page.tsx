'use client';

// Trang /thu-vien-master — Thu vien Master (khai niem nguon).
// Banner + 2 cot: cot chinh hien thi bai dang chon, cot phai la danh sach
// cac muc (thu gon/mo rong, muc dang chon to mau). Doc that tu Supabase
// (bai is_published=true); fallback du lieu mac dinh khi DB chua co bang
// hoac rong. Deep-link ?bai=<slug>. Trang thai loading / error / empty.
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  buildLibraryTitleIndex,
  fetchPublishedLibraryItems,
  splitLibraryParagraphs,
  type LibraryState,
  type MasterLibraryItem,
} from '@/lib/master-library';
import { youtubeEmbedUrl } from '@/lib/learning';
import { normalizeSearch } from '@/lib/validation';

function LibraryContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LibraryState>({ status: 'loading' });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchPublishedLibraryItems());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(
    () => (state.status === 'success' ? state.items : []),
    [state],
  );

  // Deep-link ?bai=<slug>; mac dinh chon muc dau tien.
  useEffect(() => {
    if (items.length === 0) return;
    const q = searchParams.get('bai');
    if (q && items.some((i) => i.slug === q)) {
      setSelectedSlug(q);
    } else if (!selectedSlug || !items.some((i) => i.slug === selectedSlug)) {
      setSelectedSlug(items[0].slug);
    }
  }, [items, searchParams, selectedSlug]);

  const selected: MasterLibraryItem | null =
    items.find((i) => i.slug === selectedSlug) ?? items[0] ?? null;

  const paragraphs = useMemo(
    () => (selected ? splitLibraryParagraphs(selected.content) : []),
    [selected],
  );
  const embedUrl = selected?.video_url ? youtubeEmbedUrl(selected.video_url) : null;

  // Ban do ten khai niem (chuan hoa) -> slug, de link cheo tu cac muc
  // tong quan (7 bo thi / 8 to chat / 9 dang nguoi) toi muc chi tiet.
  const titleToSlug = useMemo(() => buildLibraryTitleIndex(items), [items]);

  const q = normalizeSearch(query);
  const visibleItems = items
    .filter((item) => q === '' || normalizeSearch(item.title).includes(q))
    // Khi dang tim kiem thi hien tat ca ket qua, bat ke trang thai thu gon.
    .filter((item) => q !== '' || !collapsed || item.slug === selected?.slug);

  /** Hien thi mot doan van: giu xuong dong cua user (<br/>); dong nao
      trung khop ten mot khai niem thi thanh link toi muc chi tiet do. */
  function renderRichText(text: string, keyPrefix: string) {
    const lines = text.split('\n');
    return lines.map((line, li) => {
      const slug = titleToSlug.get(normalizeSearch(line.replace(/:\s*$/, '').trim()));
      const node =
        slug && slug !== selected?.slug ? (
          <Link
            key={`${keyPrefix}-link-${li}`}
            href={`/thu-vien-master?bai=${slug}`}
            scroll={false}
            className="library-link"
            onClick={() => setSelectedSlug(slug)}
          >
            {line}
          </Link>
        ) : (
          <span key={`${keyPrefix}-text-${li}`}>{line}</span>
        );
      return (
        <span key={`${keyPrefix}-${li}`}>
          {li > 0 && <br />}
          {node}
        </span>
      );
    });
  }

  return (
    <div className="wrap">
      <div className="library-banner">
        <p className="chapter">Thư viện khái niệm nguồn</p>
        <h1 className="gold-title">Thư viện Master</h1>
        <p>
          Những khái niệm nguồn làm rõ hình, rõ khái niệm, rõ trạng thái — để mỗi người
          thấu suốt từ gốc rồi mới hành động.
        </p>
      </div>

      {state.status === 'loading' && (
        <p role="status">Đang tải thư viện…</p>
      )}

      {state.status === 'error' && (
        <div className="card" role="alert">
          <p>{state.message}</p>
          <button type="button" className="btn btn-gold" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {state.status === 'success' && items.length === 0 && (
        <div className="card">
          <p>Thư viện chưa có bài viết. Vui lòng quay lại sau.</p>
        </div>
      )}

      {state.status === 'success' && selected && (
        <div className="library-layout">
          <article className="library-main card">
            {selected.category && <p className="blog-pillar">{selected.category}</p>}
            <h2 className="gold-title">{selected.title}</h2>
            {selected.cover_image_url && (
              <figure className="library-cover">
                <img src={selected.cover_image_url} alt={`Ảnh bìa: ${selected.title}`} />
              </figure>
            )}
            {embedUrl && (
              <div className="library-video">
                <iframe
                  src={embedUrl}
                  title={`Video: ${selected.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {paragraphs.length === 0 ? (
              <p className="muted">Đang cập nhật.</p>
            ) : (
              paragraphs.map((p, idx) => (
                <p key={idx}>
                  {p.lead && (
                    <strong>
                      {(() => {
                        const slug = titleToSlug.get(normalizeSearch(p.lead.replace(/:\s*$/, '').trim()));
                        return slug && slug !== selected.slug ? (
                          <Link
                            href={`/thu-vien-master?bai=${slug}`}
                            scroll={false}
                            className="library-link"
                            onClick={() => setSelectedSlug(slug)}
                          >
                            {p.lead}
                          </Link>
                        ) : (
                          p.lead
                        );
                      })()}{' '}
                    </strong>
                  )}
                  {renderRichText(p.rest, `p${idx}`)}
                </p>
              ))
            )}
            <p className="meta">
              Thư viện Master · Visfar Academy
            </p>
          </article>

          <aside className="library-side card" aria-label="Danh mục thư viện">
            <div className="library-side-head">
              <h2>Danh mục thư viện</h2>
              <button
                type="button"
                className="btn btn-quiet"
                aria-expanded={!collapsed}
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? 'Mở rộng' : 'Thu gọn'}
              </button>
            </div>
            <label htmlFor="librarySearch" className="sr-only">
              Tìm khái niệm trong thư viện
            </label>
            <input
              id="librarySearch"
              className="library-search"
              type="search"
              placeholder="Tìm khái niệm… (vd: trí tuệ, nhân quả)"
              aria-label="Tìm khái niệm trong thư viện"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {q !== '' && (
              <p className="meta" role="status">
                Tìm thấy {visibleItems.length} / {items.length} mục.
              </p>
            )}
            <ul className="library-list">
              {visibleItems.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/thu-vien-master?bai=${item.slug}`}
                      scroll={false}
                      aria-current={item.slug === selected.slug ? 'true' : undefined}
                      className={item.slug === selected.slug ? 'active' : undefined}
                      onClick={() => setSelectedSlug(item.slug)}
                    >
                      <span>{item.title}</span>
                      {item.category && <small>{item.category}</small>}
                    </Link>
                  </li>
                ))}
            </ul>
            {q !== '' && visibleItems.length === 0 && (
              <p className="muted" role="status">
                Không tìm thấy khái niệm nào khớp “{query}”.
              </p>
            )}
            <p className="meta">
              {items.length} mục · Nội dung nguyên văn từ tư liệu lớp Master.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function MasterLibraryPage() {
  return (
    <main className="library-page">
      <Suspense fallback={<div className="wrap"><p role="status">Đang tải thư viện…</p></div>}>
        <LibraryContent />
      </Suspense>
    </main>
  );
}
