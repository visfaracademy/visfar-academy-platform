// Nut "Tiep tuc hoc" (resume): dua hoc vien toi bai dang do trong khoa.
// - Chua dang nhap -> nut dan toi trang dang nhap (ghi nho trang hien tai).
// - Chua ghi danh / khoa chua co bai -> khong hien gi.
// - Hoc het khoa -> nut "Hoc lai tu dau" (bai dau tien).
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchResumeTarget, lessonUrl, type ResumeTarget } from '@/lib/learning';

type State =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'hidden' }
  | { status: 'ready'; target: ResumeTarget };

export default function ResumeButton({
  courseSlug,
  returnTo,
}: {
  courseSlug: string;
  /** Duong dan quay lai sau khi dang nhap (mac dinh trang chi tiet khoa). */
  returnTo?: string;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchResumeTarget(courseSlug);
      if (cancelled) return;
      if (res.status === 'signed-out') setState({ status: 'signed-out' });
      else if (res.status !== 'success' || !res.data) setState({ status: 'hidden' });
      else setState({ status: 'ready', target: res.data });
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  if (state.status === 'loading' || state.status === 'hidden') return null;

  if (state.status === 'signed-out') {
    return (
      <Link
        className="btn"
        href={`/dang-nhap?next=${encodeURIComponent(returnTo ?? `/chuong-trinh/${courseSlug}`)}`}
      >
        Đăng nhập để tiếp tục học
      </Link>
    );
  }

  const t = state.target;
  return (
    <Link className="btn" href={lessonUrl(t.courseSlug, t.lessonSlug, t.moduleSlug)}>
      {t.allCompleted
        ? 'Học lại từ đầu'
        : `Tiếp tục học: ${t.lessonTitle} (${t.completedLessons}/${t.totalLessons} bài)`}
    </Link>
  );
}
