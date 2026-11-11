// Trang /hoc-vien/danh-gia-11d — lich su cac lan danh gia 11D cua hoc
// vien + so sanh qua thoi gian (lan moi nhat so voi lan truoc).
// Can dang nhap (layout /hoc-vien chan san). Du lieu that tu Supabase.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DashboardNav from '@/components/dashboard/DashboardNav';
import AssessmentResult from '@/components/assessment/AssessmentResult';
import {
  DIMENSIONS,
  fetchMyAssessments,
  formatAssessmentDate,
  formatScore,
  type AssessmentRow,
  type AssessmentsState,
} from '@/lib/assessment-11d';

export default function HocVienDanhGia11DPage() {
  const [state, setState] = useState<AssessmentsState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchMyAssessments());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="wrap">
      <DashboardNav />
      <h1 className="gold-title">Đánh giá 11 phương diện</h1>
      <p>
        Lịch sử các lần bạn tự đánh giá theo hệ Thập Nhất Viên Mãn. Làm lại bài sau
        một thời gian để thấy mình đã thay đổi ở phương diện nào.
      </p>
      <p>
        <Link className="btn btn-gold" href="/danh-gia-11d">
          Làm bài đánh giá mới
        </Link>
      </p>

      {state.status === 'loading' && <p role="status">Đang tải lịch sử đánh giá…</p>}

      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
          <p>Chưa có biến môi trường NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
        </div>
      )}

      {state.status === 'signed-out' && (
        <div className="notice" role="status">
          <p>
            Bạn chưa đăng nhập.{' '}
            <Link className="btn" href="/dang-nhap?next=/hoc-vien/danh-gia-11d">
              Đăng nhập
            </Link>
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được lịch sử đánh giá.</strong>
          </p>
          <p>{state.message}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {state.status === 'success' && state.items.length === 0 && (
        <div className="notice" role="status">
          <p>
            <strong>Bạn chưa có lần đánh giá nào được lưu.</strong>
          </p>
          <p>
            Hãy làm bài đánh giá 11 phương diện (33 câu, khoảng 10 phút) rồi đăng nhập
            để lưu kết quả. Lần sau làm lại, trang này sẽ cho bạn so sánh thay đổi.
          </p>
          <p>
            <Link className="btn btn-gold" href="/danh-gia-11d">
              Làm bài ngay
            </Link>
          </p>
        </div>
      )}

      {state.status === 'success' && state.items.length > 0 && (
        <>
          <LatestAssessment items={state.items} />
          <HistoryList items={state.items} />
        </>
      )}
    </div>
  );
}

function LatestAssessment({ items }: { items: AssessmentRow[] }) {
  const latest = items[0];
  const previous = items[1] ?? null;
  return (
    <AssessmentResult
      scores={latest.scores}
      overall={latest.overall_score}
      previousScores={previous?.scores ?? null}
      completedLabel={
        `Lần gần nhất: ${formatAssessmentDate(latest.completed_at)}` +
        (previous ? ` · So sánh với lần trước: ${formatAssessmentDate(previous.completed_at)}.` : ' · Đây là lần đánh giá đầu tiên của bạn.')
      }
    />
  );
}

function HistoryList({ items }: { items: AssessmentRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section aria-labelledby="lich-su-title" className="assessment-history">
      <h2 id="lich-su-title" className="gold-title">
        Lịch sử các lần đánh giá ({items.length})
      </h2>
      <ul className="assessment-history-list">
        {items.map((item, idx) => {
          const prev = items[idx + 1] ?? null;
          const delta =
            item.overall_score !== null && prev?.overall_score !== null
              ? Math.round((item.overall_score - prev.overall_score) * 10) / 10
              : null;
          const open = openId === item.id;
          return (
            <li key={item.id} className="card">
              <div className="assessment-history-head">
                <div>
                  <strong>{formatAssessmentDate(item.completed_at)}</strong>
                  {idx === 0 && <span className="pill"> Mới nhất</span>}
                  <p className="muted">
                    Điểm trung bình:{' '}
                    {item.overall_score !== null ? `${formatScore(item.overall_score)} / 5` : '—'}
                    {delta !== null && (
                      <>
                        {' · '}
                        {delta > 0 ? `tăng ${formatScore(delta)}` : delta < 0 ? `giảm ${formatScore(Math.abs(delta))}` : 'không đổi'}{' '}
                        so với lần trước
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                >
                  {open ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                </button>
              </div>
              {open && (
                <div className="assessment-history-detail">
                  <table className="assessment-delta-table">
                    <thead>
                      <tr>
                        <th scope="col">Phương diện</th>
                        <th scope="col">Lần này</th>
                        <th scope="col">Lần trước</th>
                        <th scope="col">Thay đổi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DIMENSIONS.map((d) => {
                        const cur = item.scores[d.key];
                        const old = prev?.scores[d.key];
                        const diff =
                          typeof cur === 'number' && typeof old === 'number'
                            ? Math.round((cur - old) * 10) / 10
                            : null;
                        return (
                          <tr key={d.key}>
                            <th scope="row">
                              {d.num} · {d.name}
                            </th>
                            <td>{typeof cur === 'number' ? formatScore(cur) : '—'}</td>
                            <td>{typeof old === 'number' ? formatScore(old) : '—'}</td>
                            <td>
                              {diff === null
                                ? '—'
                                : diff > 0
                                  ? `+${formatScore(diff)}`
                                  : formatScore(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
