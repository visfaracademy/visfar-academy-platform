// Cay chuong -> bai -> tai lieu o trang admin (client).
// Nut len/xuong goi POST /api/admin/courses/[id]/reorder (luu
// display_order); nut xuat ban / xem thu goi PATCH tuong ung. Moi
// thao tac deu ghi audit_logs o server (xem cac route /api/admin/*).
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { AdminLessonItem, AdminModuleItem, AdminResourceItem } from '@/lib/lms-admin';
import { normalizeYouTubeUrl, slugifyVi } from '@/lib/learning';

const LESSON_TYPES = ['video', 'text', 'quiz', 'file', 'audio', 'image', 'pdf', 'assignment', 'webinar'] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YOUTUBE_ERROR = 'Link chưa đúng — hãy dán link video YouTube, ví dụ https://youtu.be/xxxxxxxxxxx';
const SLUG_HINT = 'Slug chỉ gồm chữ thường, số và dấu gạch ngang — ví dụ: buoi-1-chuyen-hoa-tam-thuc (tự tạo từ tiêu đề nếu để trống).';

/** Goi y tieng Viet duoi o URL tai lieu, tuy theo loai tai lieu. */
function resourceUrlHint(resourceType: string): string {
  if (resourceType === 'video') {
    return 'Dán link YouTube (dạng watch / youtu.be / embed / shorts) hoặc chỉ mã video 11 ký tự.';
  }
  if (resourceType === 'file' || resourceType === 'document') {
    return 'Dán link tới file (ví dụ link Google Drive đã chia sẻ công khai), bắt đầu bằng https://';
  }
  return 'Dán đầy đủ link bắt đầu bằng https://';
}

interface ApiResult {
  ok?: boolean;
  error?: string;
  auditWarning?: string | null;
}

async function callApi(url: string, method: string, body: unknown): Promise<ApiResult> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  try {
    return (await res.json()) as ApiResult;
  } catch {
    return { ok: false, error: `Máy chủ trả về lỗi HTTP ${res.status}.` };
  }
}

function MoveButtons({
  disabled,
  onMove,
}: {
  disabled: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <span className="admin-move" role="group" aria-label="Đổi thứ tự">
      <button type="button" className="btn btn-small" disabled={disabled} onClick={() => onMove(-1)} aria-label="Di chuyển lên">
        ↑
      </button>{' '}
      <button type="button" className="btn btn-small" disabled={disabled} onClick={() => onMove(1)} aria-label="Di chuyển xuống">
        ↓
      </button>
    </span>
  );
}

export default function AdminContentTree({
  courseId,
  modules,
}: {
  courseId: string;
  modules: AdminModuleItem[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [openLessonForm, setOpenLessonForm] = useState<string | null>(null);
  const [openResourceForm, setOpenResourceForm] = useState<string | null>(null);
  const [openModuleEdit, setOpenModuleEdit] = useState<string | null>(null);
  const [openLessonEdit, setOpenLessonEdit] = useState<string | null>(null);
  const [openResourceEdit, setOpenResourceEdit] = useState<string | null>(null);

  function report(result: ApiResult, successText: string) {
    if (!result.ok) {
      setIsError(true);
      setMessage(result.error ?? 'Đã có lỗi xảy ra.');
      return;
    }
    setIsError(false);
    setMessage(result.auditWarning ?? successText);
    router.refresh();
  }

  async function move(
    kind: 'module' | 'lesson' | 'resource',
    parentId: string,
    items: Array<{ id: string; display_order: number }>,
    index: number,
    dir: -1 | 1,
  ) {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
    const swapped = [...sorted];
    const tmp = swapped[index];
    swapped[index] = swapped[next];
    swapped[next] = tmp;
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/courses/${courseId}/reorder`, 'POST', {
        kind,
        parentId,
        items: swapped.map((item, i) => ({ id: item.id, displayOrder: i })),
      });
      report(result, 'Đã lưu thứ tự mới.');
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleModulePublished(module: AdminModuleItem) {
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/modules/${module.id}`, 'PATCH', {
        is_published: !module.is_published,
      });
      report(result, module.is_published ? 'Đã ẩn chương.' : 'Đã xuất bản chương.');
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleLesson(module: AdminModuleItem, lesson: AdminLessonItem, field: 'is_published' | 'is_free_preview') {
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/lessons/${lesson.id}`, 'PATCH', {
        [field]: field === 'is_published' ? lesson.is_published === false : !lesson.is_free_preview,
      });
      report(result, 'Đã lưu bài học.');
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function addModule(e: FormEvent) {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/courses/${courseId}/modules`, 'POST', {
        title: newModuleTitle.trim(),
        display_order: modules.length,
      });
      if (result.ok) {
        setNewModuleTitle('');
        report(result, 'Đã thêm chương.');
      } else {
        report(result, '');
      }
    } catch {
      setIsError(true);
      setMessage('Không có kết nối mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <p className={isError ? 'field-error' : 'muted'} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}

      {modules.length === 0 && (
        <div className="notice">
          <p>Khóa học chưa có chương nào.</p>
        </div>
      )}

      {modules.map((module, moduleIndex) => (
        <article key={module.id} className="card admin-module">
          <h3>
            {module.display_order + 1}. {module.title}{' '}
            <span className="muted">({module.is_published ? 'đã xuất bản' : 'đang ẩn'})</span>
          </h3>
          <p>
            <MoveButtons
              disabled={busy}
              onMove={(dir) => void move('module', courseId, modules, moduleIndex, dir)}
            />{' '}
            <button type="button" className="btn btn-small" disabled={busy} onClick={() => void toggleModulePublished(module)}>
              {module.is_published ? 'Ẩn chương' : 'Xuất bản chương'}
            </button>{' '}
            <button
              type="button"
              className="btn btn-small btn-ghost"
              disabled={busy}
              onClick={() => setOpenModuleEdit(openModuleEdit === module.id ? null : module.id)}
            >
              Sửa chương
            </button>{' '}
            <button
              type="button"
              className="btn btn-small btn-ghost"
              disabled={busy}
              onClick={() => setOpenLessonForm(openLessonForm === module.id ? null : module.id)}
            >
              + Thêm bài học
            </button>
          </p>

          {openModuleEdit === module.id && (
            <ModuleEditForm
              module={module}
              disabled={busy}
              onDone={(result) => {
                setOpenModuleEdit(null);
                report(result, 'Đã lưu chương.');
              }}
            />
          )}

          {openLessonForm === module.id && (
            <LessonCreateForm
              moduleId={module.id}
              nextOrder={module.lessons.length}
              disabled={busy}
              onDone={(result) => {
                setOpenLessonForm(null);
                report(result, 'Đã thêm bài học.');
              }}
            />
          )}

          {module.lessons.length === 0 ? (
            <p className="muted">Chương chưa có bài học nào.</p>
          ) : (
            <ul className="admin-list">
              {module.lessons.map((lesson, lessonIndex) => (
                <li key={lesson.id} className="admin-lesson">
                  <p>
                    <strong>
                      {lesson.display_order + 1}. {lesson.title}
                    </strong>{' '}
                    <span className="muted">
                      ({lesson.type}
                      {lesson.is_published === false ? ' · đang ẩn' : ''}
                      {lesson.is_free_preview ? ' · xem thử' : ''})
                    </span>
                  </p>
                  <p>
                    <MoveButtons
                      disabled={busy}
                      onMove={(dir) => void move('lesson', module.id, module.lessons, lessonIndex, dir)}
                    />{' '}
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={busy}
                      onClick={() => void toggleLesson(module, lesson, 'is_published')}
                    >
                      {lesson.is_published === false ? 'Xuất bản bài' : 'Ẩn bài'}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      disabled={busy}
                      onClick={() => void toggleLesson(module, lesson, 'is_free_preview')}
                    >
                      {lesson.is_free_preview ? 'Bỏ xem thử' : 'Cho xem thử'}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      disabled={busy}
                      onClick={() => setOpenLessonEdit(openLessonEdit === lesson.id ? null : lesson.id)}
                    >
                      Sửa bài
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      disabled={busy}
                      onClick={() => setOpenResourceForm(openResourceForm === lesson.id ? null : lesson.id)}
                    >
                      + Tài liệu
                    </button>
                  </p>

                  {openLessonEdit === lesson.id && (
                    <LessonEditForm
                      lesson={lesson}
                      disabled={busy}
                      onDone={(result) => {
                        setOpenLessonEdit(null);
                        report(result, 'Đã lưu bài học.');
                      }}
                    />
                  )}

                  {openResourceForm === lesson.id && (
                    <ResourceCreateForm
                      lessonId={lesson.id}
                      nextOrder={lesson.resources.length}
                      disabled={busy}
                      onDone={(result) => {
                        setOpenResourceForm(null);
                        report(result, 'Đã thêm tài liệu.');
                      }}
                    />
                  )}

                  {lesson.resources.length > 0 && (
                    <ul className="admin-list">
                      {lesson.resources.map((resource, resourceIndex) => (
                        <li key={resource.id}>
                          📄 {resource.title} ({resource.resource_type}
                          {resource.is_free_preview ? ' · xem thử' : ''}){' '}
                          <MoveButtons
                            disabled={busy}
                            onMove={(dir) => void move('resource', lesson.id, lesson.resources, resourceIndex, dir)}
                          />{' '}
                          <button
                            type="button"
                            className="btn btn-small btn-ghost"
                            disabled={busy}
                            onClick={() => setOpenResourceEdit(openResourceEdit === resource.id ? null : resource.id)}
                          >
                            Sửa
                          </button>
                          {openResourceEdit === resource.id && (
                            <ResourceEditForm
                              resource={resource}
                              disabled={busy}
                              onDone={(result) => {
                                setOpenResourceEdit(null);
                                report(result, 'Đã lưu tài liệu.');
                              }}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}

      <form onSubmit={addModule} className="card">
        <div className="field">
          <label htmlFor="new-module-title">Thêm chương mới</label>
          <input
            id="new-module-title"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            required
            minLength={2}
            maxLength={200}
            placeholder="Ví dụ: Chương 1 — Hiểu về tâm thức"
          />
        </div>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Đang thêm…' : 'Thêm chương'}
        </button>
      </form>
    </div>
  );
}

function LessonCreateForm({
  moduleId,
  nextOrder,
  disabled,
  onDone,
}: {
  moduleId: string;
  nextOrder: number;
  disabled: boolean;
  onDone: (result: ApiResult) => void;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [type, setType] = useState<string>('text');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onTitleChange(value: string) {
    setTitle(value);
    // Go y slug tu tieu de khi admin chua sua tay o slug.
    if (!slugTouched) setSlug(slugifyVi(value));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSlugError(null);
    setVideoError(null);
    const finalSlug = slug.trim() || slugifyVi(title);
    if (!finalSlug || !SLUG_PATTERN.test(finalSlug)) {
      setSlugError('Slug chỉ gồm chữ thường, số và dấu gạch ngang — ví dụ: buoi-1-chuyen-hoa-tam-thuc');
      return;
    }
    let normalizedVideo: string | null = null;
    if (type === 'video' && videoUrl.trim()) {
      normalizedVideo = normalizeYouTubeUrl(videoUrl);
      if (!normalizedVideo) {
        setVideoError(YOUTUBE_ERROR);
        return;
      }
    }
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/modules/${moduleId}/lessons`, 'POST', {
        title: title.trim(),
        slug: finalSlug,
        type,
        video_url: normalizedVideo,
        display_order: nextOrder,
      });
      onDone(result);
    } catch {
      onDone({ ok: false, error: 'Không có kết nối mạng. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="admin-inline-form">
      <div className="field">
        <label htmlFor={`lesson-title-${moduleId}`}>Tiêu đề bài học</label>
        <input
          id={`lesson-title-${moduleId}`}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          required
          minLength={2}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor={`lesson-slug-${moduleId}`}>Slug bài học</label>
        <input
          id={`lesson-slug-${moduleId}`}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          placeholder="Ví dụ: buoi-1-chuyen-hoa-tam-thuc"
        />
        <p className="hint">{SLUG_HINT}</p>
        {slugError && (
          <p className="field-error" role="alert">
            {slugError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`lesson-type-${moduleId}`}>Loại bài</label>
        <select id={`lesson-type-${moduleId}`} value={type} onChange={(e) => setType(e.target.value)}>
          {LESSON_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {type === 'video' && (
        <div className="field">
          <label htmlFor={`lesson-video-${moduleId}`}>URL video (YouTube)</label>
          <input
            id={`lesson-video-${moduleId}`}
            type="text"
            inputMode="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <p className="hint">Dán link YouTube (dạng watch / youtu.be / embed / shorts) hoặc chỉ mã video 11 ký tự.</p>
          {videoError && (
            <p className="field-error" role="alert">
              {videoError}
            </p>
          )}
        </div>
      )}
      <button type="submit" className="btn btn-small" disabled={disabled || busy}>
        {busy ? 'Đang thêm…' : 'Thêm bài học'}
      </button>
    </form>
  );
}

function ModuleEditForm({
  module,
  disabled,
  onDone,
}: {
  module: AdminModuleItem;
  disabled: boolean;
  onDone: (result: ApiResult) => void;
}) {
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description ?? '');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/modules/${module.id}`, 'PATCH', {
        title: title.trim(),
        description: description.trim() || null,
      });
      onDone(result);
    } catch {
      onDone({ ok: false, error: 'Không có kết nối mạng. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="admin-inline-form">
      <div className="field">
        <label htmlFor={`module-edit-title-${module.id}`}>Tiêu đề chương</label>
        <input
          id={`module-edit-title-${module.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor={`module-edit-desc-${module.id}`}>Mô tả chương</label>
        <textarea
          id={`module-edit-desc-${module.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <button type="submit" className="btn btn-small" disabled={disabled || busy}>
        {busy ? 'Đang lưu…' : 'Lưu chương'}
      </button>
    </form>
  );
}

function LessonEditForm({
  lesson,
  disabled,
  onDone,
}: {
  lesson: AdminLessonItem;
  disabled: boolean;
  onDone: (result: ApiResult) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [slug, setSlug] = useState(lesson.slug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [type, setType] = useState<string>(lesson.type);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? '');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [content, setContent] = useState(lesson.content ?? '');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSlugError(null);
    setVideoError(null);
    const finalSlug = slug.trim();
    if (!finalSlug || !SLUG_PATTERN.test(finalSlug)) {
      setSlugError('Slug chỉ gồm chữ thường, số và dấu gạch ngang — ví dụ: buoi-1-chuyen-hoa-tam-thuc');
      return;
    }
    let normalizedVideo: string | null = null;
    if (type === 'video' && videoUrl.trim()) {
      normalizedVideo = normalizeYouTubeUrl(videoUrl);
      if (!normalizedVideo) {
        setVideoError(YOUTUBE_ERROR);
        return;
      }
    } else {
      // Bai khong phai video: giu nguyen gia tri cu (khong chan luu).
      normalizedVideo = videoUrl.trim() || null;
    }
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/lessons/${lesson.id}`, 'PATCH', {
        title: title.trim(),
        slug: finalSlug,
        type,
        video_url: normalizedVideo,
        content: content || null,
      });
      onDone(result);
    } catch {
      onDone({ ok: false, error: 'Không có kết nối mạng. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="admin-inline-form">
      <div className="field">
        <label htmlFor={`lesson-edit-title-${lesson.id}`}>Tiêu đề bài học</label>
        <input
          id={`lesson-edit-title-${lesson.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor={`lesson-edit-slug-${lesson.id}`}>Slug bài học</label>
        <input
          id={`lesson-edit-slug-${lesson.id}`}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
        />
        <p className="hint">{SLUG_HINT}</p>
        {slugError && (
          <p className="field-error" role="alert">
            {slugError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`lesson-edit-type-${lesson.id}`}>Loại bài</label>
        <select id={`lesson-edit-type-${lesson.id}`} value={type} onChange={(e) => setType(e.target.value)}>
          {LESSON_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`lesson-edit-video-${lesson.id}`}>URL video (YouTube)</label>
        <input
          id={`lesson-edit-video-${lesson.id}`}
          type="text"
          inputMode="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
        <p className="hint">Dán link YouTube (dạng watch / youtu.be / embed / shorts) hoặc chỉ mã video 11 ký tự.</p>
        {videoError && (
          <p className="field-error" role="alert">
            {videoError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`lesson-edit-content-${lesson.id}`}>Nội dung bài (text)</label>
        <textarea
          id={`lesson-edit-content-${lesson.id}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
      </div>
      <button type="submit" className="btn btn-small" disabled={disabled || busy}>
        {busy ? 'Đang lưu…' : 'Lưu bài học'}
      </button>
    </form>
  );
}

function ResourceEditForm({
  resource,
  disabled,
  onDone,
}: {
  resource: AdminResourceItem;
  disabled: boolean;
  onDone: (result: ApiResult) => void;
}) {
  const [title, setTitle] = useState(resource.title);
  const [resourceType, setResourceType] = useState(resource.resource_type);
  const [fileUrl, setFileUrl] = useState(resource.file_url ?? '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isFreePreview, setIsFreePreview] = useState(resource.is_free_preview);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setUrlError(null);
    let finalUrl = fileUrl.trim() || '';
    if (resourceType === 'video' && finalUrl) {
      const normalized = normalizeYouTubeUrl(finalUrl);
      if (!normalized) {
        setUrlError(YOUTUBE_ERROR);
        return;
      }
      finalUrl = normalized;
    }
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/resources/${resource.id}`, 'PATCH', {
        title: title.trim(),
        resource_type: resourceType,
        file_url: finalUrl || null,
        is_free_preview: isFreePreview,
      });
      onDone(result);
    } catch {
      onDone({ ok: false, error: 'Không có kết nối mạng. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="admin-inline-form">
      <div className="field">
        <label htmlFor={`resource-edit-title-${resource.id}`}>Tiêu đề tài liệu</label>
        <input
          id={`resource-edit-title-${resource.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor={`resource-edit-type-${resource.id}`}>Loại tài liệu</label>
        <select id={`resource-edit-type-${resource.id}`} value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
          <option value="file">File</option>
          <option value="document">Tài liệu (PDF / slide)</option>
          <option value="video">Video</option>
          <option value="link">Liên kết</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`resource-edit-url-${resource.id}`}>URL tài liệu</label>
        <input
          id={`resource-edit-url-${resource.id}`}
          type="text"
          inputMode="url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://…"
        />
        <p className="hint">{resourceUrlHint(resourceType)}</p>
        {urlError && (
          <p className="field-error" role="alert">
            {urlError}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`resource-edit-preview-${resource.id}`}>
          <input
            id={`resource-edit-preview-${resource.id}`}
            type="checkbox"
            checked={isFreePreview}
            onChange={(e) => setIsFreePreview(e.target.checked)}
          />{' '}
          Cho xem thử (không cần ghi danh)
        </label>
      </div>
      <button type="submit" className="btn btn-small" disabled={disabled || busy}>
        {busy ? 'Đang lưu…' : 'Lưu tài liệu'}
      </button>
    </form>
  );
}

function ResourceCreateForm({
  lessonId,
  nextOrder,
  disabled,
  onDone,
}: {
  lessonId: string;
  nextOrder: number;
  disabled: boolean;
  onDone: (result: ApiResult) => void;
}) {
  const [title, setTitle] = useState('');
  const [resourceType, setResourceType] = useState('file');
  const [fileUrl, setFileUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setUrlError(null);
    let finalUrl = fileUrl.trim();
    if (resourceType === 'video' && finalUrl) {
      const normalized = normalizeYouTubeUrl(finalUrl);
      if (!normalized) {
        setUrlError(YOUTUBE_ERROR);
        return;
      }
      finalUrl = normalized;
    }
    setBusy(true);
    try {
      const result = await callApi(`/api/admin/lessons/${lessonId}/resources`, 'POST', {
        title: title.trim(),
        resource_type: resourceType,
        file_url: finalUrl,
        display_order: nextOrder,
      });
      onDone(result);
    } catch {
      onDone({ ok: false, error: 'Không có kết nối mạng. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="admin-inline-form">
      <div className="field">
        <label htmlFor={`resource-title-${lessonId}`}>Tiêu đề tài liệu</label>
        <input
          id={`resource-title-${lessonId}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor={`resource-type-${lessonId}`}>Loại tài liệu</label>
        <select id={`resource-type-${lessonId}`} value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
          <option value="file">File</option>
          <option value="document">Tài liệu (PDF / slide)</option>
          <option value="video">Video</option>
          <option value="link">Liên kết</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`resource-url-${lessonId}`}>URL tài liệu</label>
        <input
          id={`resource-url-${lessonId}`}
          type="text"
          inputMode="url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://…"
        />
        <p className="hint">{resourceUrlHint(resourceType)}</p>
        {urlError && (
          <p className="field-error" role="alert">
            {urlError}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-small" disabled={disabled || busy}>
        {busy ? 'Đang thêm…' : 'Thêm tài liệu'}
      </button>
    </form>
  );
}
