// GET /api/v1/resources/[id]/download — tai tai lieu dinh kem qua API.
// Hoc vien chi thay URL /api/... — URL goc (file_url) KHONG bao gio tra
// ve client, khong nam trong Location, khong lo qua header.
// Luong: resource -> lesson -> course; kiem tra quyen PHIA SERVER
// (requireLessonAccessById — chi enrollment active/completed, bai xem
// thu, admin hoac instructor khoa phu trach moi tai duoc). Truoc day
// route nay chi kiem tra khoa published — bat ky ai co id tai lieu
// cung tai duoc file tra phi; Task 07 phan 3/4 dong lo nay.
// File duoc stream tu URL goc qua API (gioi han 100 MB); URL goc phai
// la https. Loi goc -> 502, khong de lo URL trong thong bao loi.
// Khach chua dang nhap chi tai duoc tai lieu xem thu (is_free_preview)
// cua bai xem thu trong khoa published.
// Cloudflare Pages yeu cau route dong chay Edge Runtime.
export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { requireLessonAccessById } from '@/lib/lms-access';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { MAX_DOWNLOAD_BYTES } from '@/lib/learning';

function fileNameFor(title: string, fileUrl: string): string {
  const cleanTitle = title.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ') || 'tai-lieu';
  let ext = '';
  try {
    const path = new URL(fileUrl).pathname;
    const match = path.match(/\.([A-Za-z0-9]{1,10})$/);
    if (match) ext = `.${match[1].toLowerCase()}`;
  } catch {
    ext = '';
  }
  const base = cleanTitle.endsWith(ext) ? cleanTitle : `${cleanTitle}${ext}`;
  return base;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }
  try {
    // Client mang JWT nguoi goi (doc tu cookie phien) — RLS + kiem tra
    // enrollment deu chay theo dung user nay. Khong co phien thi dung
    // anon client: chi tai lieu xem thu moi mo (xem ben duoi).
    const serverClient = await getServerSupabaseClient();
    const supabase = serverClient ?? getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
    }

    const { data: resource, error: resErr } = await supabase
      .from('lesson_resources')
      .select('id, lesson_id, title, file_url, is_free_preview')
      .eq('id', id)
      .maybeSingle();
    if (resErr || !resource) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    const row = resource as unknown as {
      lesson_id: string;
      title: string;
      file_url: string | null;
      is_free_preview: boolean;
    };
    if (!row.file_url || !/^https:\/\//i.test(row.file_url)) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    if (serverClient) {
      // Da dang nhap: kiem tra quyen hoc phia server (enrollment
      // active/completed; revoked -> 403 ngay lap tuc; bai xem thu
      // chi mo khi chinh tai lieu do cung la xem thu).
      const access = await requireLessonAccessById(serverClient, row.lesson_id);
      const allowed =
        (access.allowed && access.reason === 'ok') ||
        (access.allowed && access.reason === 'ok-preview' && row.is_free_preview);
      if (!allowed) {
        if (access.reason === 'not-found' || access.reason === 'not-published') {
          return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
        }
        return NextResponse.json(
          { ok: false, error: 'forbidden' },
          { status: access.reason === 'unauthenticated' ? 401 : 403 },
        );
      }
    } else {
      // Chua dang nhap: chi tai lieu xem thu cua bai xem thu trong
      // khoa published (an ca su ton tai cua tai lieu tra phi).
      // S-03 / 0028: doc metadata qua view lessons_public (anon doc
      // duoc view) thay vi bang lessons (anon bi RLS chan het).
      const { data: lesson } = await supabase
        .from('lessons_public')
        .select('course_module_id, is_free_preview')
        .eq('id', row.lesson_id)
        .maybeSingle();
      const lessonRow = lesson as unknown as { course_module_id: string; is_free_preview: boolean } | null;
      if (!lessonRow || !row.is_free_preview || !lessonRow.is_free_preview) {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
      const { data: mod } = await supabase
        .from('course_modules')
        .select('course_id')
        .eq('id', lessonRow.course_module_id)
        .maybeSingle();
      const modRow = mod as unknown as { course_id: string } | null;
      if (!modRow) {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
      const { data: course } = await supabase
        .from('courses')
        .select('status')
        .eq('id', modRow.course_id)
        .maybeSingle();
      const courseRow = course as unknown as { status: string } | null;
      if (!courseRow || courseRow.status !== 'published') {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
    }

    const upstream = await fetch(row.file_url, { redirect: 'follow' });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { ok: false, error: 'upstream_unavailable' },
        { status: 502 },
      );
    }
    const contentLength = upstream.headers.get('content-length');
    if (contentLength !== null && Number(contentLength) > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 413 });
    }
    const fileName = fileNameFor(row.title, row.file_url);
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        ...(contentLength !== null ? { 'Content-Length': contentLength } : {}),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'unreachable' }, { status: 502 });
  }
}
