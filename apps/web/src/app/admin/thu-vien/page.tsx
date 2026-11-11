'use client';

// Trang /admin/thu-vien — quan tri Thu vien Master.
export const runtime = 'edge';
// Guard admin o app/admin/layout.tsx. Tao / sua / xoa qua
// /api/admin/library (ghi that vao DB + audit log). Anh bia: dan link
// anh (https://...); chua ho tro tai file truc tiep — co the dan link
// anh da tai len Supabase Storage. Video: dan link YouTube, he thong
// tu chuan hoa nhu form bai hoc.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { normalizeYouTubeUrl, slugifyVi } from '@/lib/learning';
import { validateLibraryInput, type MasterLibraryItem } from '@/lib/master-library';

interface AdminItem extends MasterLibraryItem {
  created_at?: string;
  updated_at?: string;
}

const EMPTY_FORM = {
  title: '',
  slug: '',
  category: 'Khái niệm nguồn',
  content: '',
  coverImageUrl: '',
  videoUrl: '',
  isPublished: true,
  displayOrder: 0,
};

export default function AdminLibraryPage() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [videoNote, setVideoNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/library', { credentials: 'same-origin' });
      const data = (await res.json()) as { ok?: boolean; items?: AdminItem[]; error?: string };
      if (!res.ok || !data.ok) {
        setLoadError(data.error ?? 'Không tải được danh sách thư viện.');
        setItems([]);
      } else {
        setItems(data.items ?? []);
      }
    } catch {
      setLoadError('Không có kết nối mạng. Vui lòng kiểm tra mạng và thử lại.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(item: AdminItem) {
    setEditingId(item.id);
    setSlugTouched(true);
    setForm({
      title: item.title,
      slug: item.slug,
      category: item.category ?? '',
      content: item.content,
      coverImageUrl: item.cover_image_url ?? '',
      videoUrl: item.video_url ?? '',
      isPublished: item.is_published,
      displayOrder: item.display_order,
    });
    setMsg(null);
    setErr(null);
    setVideoNote(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setSlugTouched(false);
    setForm(EMPTY_FORM);
    setErr(null);
    setVideoNote(null);
  }

  function onTitleChange(value: string) {
    setForm((f) => ({ ...f, title: value, slug: slugTouched ? f.slug : slugifyVi(value) }));
  }

  function onVideoChange(value: string) {
    setForm((f) => ({ ...f, videoUrl: value }));
    if (value.trim() === '') {
      setVideoNote(null);
      return;
    }
    const normalized = normalizeYouTubeUrl(value);
    setVideoNote(
      normalized
        ? `Sẽ lưu dạng chuẩn: ${normalized}`
        : 'Link này không phải YouTube hợp lệ (watch / youtu.be / embed / shorts / live).',
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const input = {
      title: form.title,
      slug: form.slug.trim() === '' ? slugifyVi(form.title) : form.slug.trim(),
      category: form.category,
      content: form.content,
      coverImageUrl: form.coverImageUrl,
      videoUrl: form.videoUrl,
      isPublished: form.isPublished,
      displayOrder: form.displayOrder,
    };
    const validationError = validateLibraryInput(input);
    if (validationError) {
      setErr(validationError);
      return;
    }
    setBusy(true);
    try {
      const url = editingId ? `/api/admin/library/${editingId}` : '/api/admin/library';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          slug: input.slug,
          category: input.category,
          content: input.content,
          cover_image_url: input.coverImageUrl,
          video_url: input.videoUrl,
          is_published: input.isPublished,
          display_order: input.displayOrder,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; auditWarning?: string | null };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? 'Không lưu được bài viết.');
        return;
      }
      setMsg(
        `${editingId ? 'Đã cập nhật' : 'Đã tạo'} bài “${input.title}”.${data.auditWarning ? ` ${data.auditWarning}` : ''}`,
      );
      cancelEdit();
      await load();
    } catch {
      setErr('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/library/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = (await res.json()) as { ok?: boolean; error?: string; auditWarning?: string | null };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? 'Không xóa được bài viết.');
        return;
      }
      setMsg(`Đã xóa bài.${data.auditWarning ? ` ${data.auditWarning}` : ''}`);
      setConfirmDeleteId(null);
      await load();
    } catch {
      setErr('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="gold-title">Thư viện Master</h1>
      <p>
        Đăng bài khái niệm nguồn cho trang{' '}
        <Link href="/thu-vien-master" target="_blank" rel="noopener">
          Thư viện Master
        </Link>
        . Bài “Đã xuất bản” mới hiện với mọi người; bài nháp chỉ admin thấy.
      </p>

      {msg && (
        <p role="status" className="card">
          {msg}
        </p>
      )}
      {err && (
        <p role="alert" className="card">
          {err}
        </p>
      )}

      <section className="card" aria-label={editingId ? 'Sửa bài viết' : 'Tạo bài viết mới'}>
        <h2>{editingId ? 'Sửa bài viết' : 'Tạo bài viết mới'}</h2>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <label htmlFor="lib-title">Tiêu đề *</label>
          <input
            id="lib-title"
            type="text"
            value={form.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="VD: 7 Bố Thí Quan Trọng Đời Người"
            required
          />

          <label htmlFor="lib-slug">Slug *</label>
          <input
            id="lib-slug"
            type="text"
            inputMode="url"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm((f) => ({ ...f, slug: e.target.value }));
            }}
            placeholder="vd: 7-bo-thi-quan-trong-doi-nguoi"
          />
          <p className="meta">Slug tự sinh từ tiêu đề; để trống sẽ tự tạo khi lưu.</p>

          <label htmlFor="lib-category">Chuyên mục</label>
          <input
            id="lib-category"
            type="text"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Khái niệm nguồn"
          />

          <label htmlFor="lib-content">Nội dung *</label>
          <textarea
            id="lib-content"
            rows={12}
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder={'Viết nội dung bài. Xuống dòng 2 lần để tách đoạn.\nĐoạn mở đầu bằng “Tên khái niệm: …” sẽ được in đậm tên.\nĐể trống nội dung thì trang hiển thị “Đang cập nhật”.'}
          />

          <label htmlFor="lib-cover">Link ảnh bìa</label>
          <input
            id="lib-cover"
            type="text"
            inputMode="url"
            value={form.coverImageUrl}
            onChange={(e) => setForm((f) => ({ ...f, coverImageUrl: e.target.value }))}
            placeholder="https://…/anh-bia.jpg (để trống nếu không có)"
          />
          <p className="meta">Dán link ảnh (https://…). Chưa hỗ trợ tải file trực tiếp.</p>

          <label htmlFor="lib-video">URL video (YouTube)</label>
          <input
            id="lib-video"
            type="text"
            inputMode="url"
            value={form.videoUrl}
            onChange={(e) => onVideoChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… (để trống nếu không có)"
          />
          {videoNote && <p className="meta">{videoNote}</p>}

          <label htmlFor="lib-order">Thứ tự hiển thị</label>
          <input
            id="lib-order"
            type="number"
            min={0}
            step={1}
            value={form.displayOrder}
            onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) || 0 }))}
          />

          <p>
            <label>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              />{' '}
              Đã xuất bản (hiện với mọi người)
            </label>
          </p>

          <p>
            <button type="submit" className="btn btn-gold" disabled={busy}>
              {busy ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo bài viết'}
            </button>{' '}
            {editingId && (
              <button type="button" className="btn" onClick={cancelEdit} disabled={busy}>
                Hủy sửa
              </button>
            )}
          </p>
        </form>
      </section>

      <section aria-label="Danh sách bài viết">
        <h2>Danh sách bài viết ({items.length})</h2>
        {loading && <p role="status">Đang tải danh sách…</p>}
        {loadError && (
          <p role="alert" className="card">
            {loadError}{' '}
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        )}
        {!loading && !loadError && items.length === 0 && (
          <p>Chưa có bài viết nào. Tạo bài đầu tiên ở form trên.</p>
        )}
        {!loading && items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tiêu đề</th>
                  <th scope="col">Chuyên mục</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thứ tự</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <br />
                      <small className="muted">{item.slug}</small>
                    </td>
                    <td>{item.category ?? '—'}</td>
                    <td>{item.is_published ? 'Đã xuất bản' : 'Nháp'}</td>
                    <td>{item.display_order}</td>
                    <td>
                      <button type="button" className="btn btn-quiet" onClick={() => startEdit(item)} disabled={busy}>
                        Sửa
                      </button>{' '}
                      <Link className="btn btn-quiet" href={`/thu-vien-master?bai=${item.slug}`} target="_blank" rel="noopener">
                        Xem
                      </Link>{' '}
                      {confirmDeleteId === item.id ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void handleDelete(item.id)}
                          disabled={busy}
                        >
                          Xác nhận xóa?
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setConfirmDeleteId(item.id)}
                          disabled={busy}
                        >
                          Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
