// Trang /hoc-vien/thanh-tich — Diem, streak, huy hieu (Prompt 14, GĐ2).
// Du lieu that tu Supabase (migration 0031). Diem do trigger server
// thuong theo tien do that, client khong tu cong diem. Co the tat
// gamification trong cai dat ben duoi (profiles.gamification_enabled).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DashboardNav from '@/components/dashboard/DashboardNav';
import {
  POINT_RULES,
  REASON_LABEL_VI,
  fetchMyAchievements,
  updateGamificationEnabled,
  type Achievements,
} from '@/lib/gamification';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ThanhTichPage() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'not-configured' }
    | { status: 'signed-out' }
    | { status: 'success'; data: Achievements }
    | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [toggling, setToggling] = useState(false);
  const [toggleMsg, setToggleMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const res = await fetchMyAchievements();
    if (res.status === 'success') {
      setState({ status: 'success', data: res.data });
    } else if (res.status === 'signed-out') {
      setState({ status: 'signed-out' });
    } else if (res.status === 'not-configured') {
      setState({ status: 'not-configured' });
    } else {
      setState({ status: 'error', message: res.message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(enabled: boolean) {
    setToggling(true);
    setToggleMsg(null);
    const res = await updateGamificationEnabled(enabled);
    setToggling(false);
    if (res.status === 'ok') {
      setToggleMsg(enabled ? 'Đã bật lại điểm và huy hiệu.' : 'Đã tắt điểm và huy hiệu. Điểm cũ vẫn được giữ nguyên.');
      void load();
    } else {
      setToggleMsg(res.status === 'signed-out' ? 'Bạn cần đăng nhập.' : res.message);
    }
  }

  return (
    <div className="wrap">
      <DashboardNav />
      <h1 className="gold-title">Thành tích học tập</h1>
      <p>
        Điểm thưởng ghi nhận tiến độ học thật của bạn: hoàn thành bài học, quiz đạt,
        hoàn thành khóa học, bài cộng đồng được đánh dấu hữu ích và chuỗi ngày học
        liên tiếp. Điểm không dùng để xếp hạng hay so sánh với học viên khác.
      </p>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải thành tích…
        </p>
      )}

      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
        </div>
      )}

      {state.status === 'signed-out' && (
        <div className="notice" role="status">
          <p>Bạn chưa đăng nhập.</p>
          <p>
            <Link className="btn" href="/dang-nhap?next=/hoc-vien/thanh-tich">
              Đăng nhập
            </Link>
          </p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được thành tích.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status === 'success' && (
        <>
          {!state.data.gamificationEnabled && (
            <div className="notice" role="status">
              <p>
                <strong>Bạn đang tắt gamification.</strong> Điểm và huy hiệu không còn
                được cộng thêm, nhưng điểm cũ vẫn được giữ nguyên.
              </p>
            </div>
          )}

          <section aria-labelledby="tong-quan-title">
            <h2 id="tong-quan-title" className="gold-title">
              Tổng quan
            </h2>
            <div className="stat-grid">
              <div className="stat-card">
                <p className="stat-num">{state.data.totalPoints}</p>
                <p>Tổng điểm</p>
              </div>
              <div className="stat-card">
                <p className="stat-num">{state.data.streak.current_streak} ngày</p>
                <p>Chuỗi học liên tiếp</p>
              </div>
              <div className="stat-card">
                <p className="stat-num">{state.data.streak.longest_streak} ngày</p>
                <p>Chuỗi dài nhất</p>
              </div>
              <div className="stat-card">
                <p className="stat-num">{state.data.badges.length}</p>
                <p>Huy hiệu đã đạt</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="huy-hieu-title" style={{ marginTop: '1.5rem' }}>
            <h2 id="huy-hieu-title" className="gold-title">
              Huy hiệu
            </h2>
            {state.data.catalog.length === 0 && (
              <div className="notice">
                <p>Chưa có huy hiệu nào được thiết lập.</p>
              </div>
            )}
            {state.data.catalog.length > 0 && (
              <div className="badge-grid">
                {state.data.catalog.map((b) => {
                  const earned = state.data.badges.find((e) => e.slug === b.slug);
                  return (
                    <article key={b.slug} className={`card badge-card${earned ? ' earned' : ' locked'}`}>
                      <p className="badge-icon" aria-hidden="true">
                        {b.icon}
                      </p>
                      <h3>{b.name}</h3>
                      <p>{b.description}</p>
                      <p className="muted">{b.rule}</p>
                      <p>
                        {earned ? (
                          <strong>Đã đạt · {formatDate(earned.earned_at)}</strong>
                        ) : (
                          <span className="muted">Chưa đạt</span>
                        )}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="lich-su-title" style={{ marginTop: '1.5rem' }}>
            <h2 id="lich-su-title" className="gold-title">
              Lịch sử điểm
            </h2>
            {state.data.history.length === 0 && (
              <div className="notice">
                <p>
                  Bạn chưa có điểm nào. Hoàn thành bài học đầu tiên để nhận +10 điểm —{' '}
                  <Link href="/hoc-vien/khoa-hoc">mở khóa học của tôi</Link>.
                </p>
              </div>
            )}
            {state.data.history.length > 0 && (
              <ul className="dashboard-list">
                {state.data.history.map((h) => (
                  <li key={h.id} className="list-row">
                    <p>
                      <strong>+{h.points} điểm</strong> · {REASON_LABEL_VI[h.reason] ?? h.reason}
                    </p>
                    <p className="muted">{formatDate(h.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="quy-tac-title" style={{ marginTop: '1.5rem' }}>
            <h2 id="quy-tac-title" className="gold-title">
              Quy tắc điểm
            </h2>
            <ul className="dashboard-list">
              {POINT_RULES.map((r) => (
                <li key={r.reason} className="list-row">
                  <p>
                    <strong>+{r.points} điểm</strong> · {r.label}
                  </p>
                </li>
              ))}
            </ul>
            <p className="muted">
              Điểm chỉ cộng khi có tiến độ học thật (bài hoàn thành, quiz đạt, khóa hoàn
              thành) hoặc bài cộng đồng được người khác đánh dấu hữu ích. Không cộng
              điểm cho hành vi tự khai hay lặp lại cùng một mốc.
            </p>
          </section>

          <section className="card" aria-labelledby="cai-dat-title" style={{ marginTop: '1.5rem' }}>
            <h2 id="cai-dat-title" className="gold-title">
              Cài đặt gamification
            </h2>
            <p>
              Nếu bạn không muốn thấy điểm, chuỗi ngày học và huy hiệu, có thể tắt
              gamification. Điểm cũ vẫn được giữ nguyên và sẽ hiện lại khi bạn bật lại.
            </p>
            <p>
              <button
                type="button"
                className="btn"
                disabled={toggling}
                onClick={() => void handleToggle(!state.data.gamificationEnabled)}
              >
                {toggling
                  ? 'Đang lưu…'
                  : state.data.gamificationEnabled
                    ? 'Tắt điểm và huy hiệu'
                    : 'Bật lại điểm và huy hiệu'}
              </button>
            </p>
            {toggleMsg && (
              <p role="status">
                {toggleMsg}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
