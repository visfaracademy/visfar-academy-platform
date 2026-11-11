// Trang /hoc-vien — tong quan dashboard hoc vien (Task 06).
// Ho so (profiles) + tom tat: khoa dang hoc / da hoan thanh (tien do
// theo module, nguong video 90% — QĐ 17), chung chi, don hang,
// thong bao chua doc. Doc that tu Supabase; chua co du lieu thi hien
// empty state, khong bia so lieu.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  getMyEnrollments,
  getMyProfileState,
  signOut,
  signOutAllDevices,
  subscribeToAuthChanges,
  type EnrollmentsState,
  type ProfileState,
} from '@/lib/auth';
import {
  getMyCertificates,
  getMyCourseProgress,
  getMyNotifications,
  getMyOrders,
  splitEnrollments,
  type CertificateItem,
  type CourseProgressItem,
  type DashboardState,
  type NotificationItem,
  type OrderItem,
} from '@/lib/dashboard';
import {
  formatAppointmentCountdown,
  listMyAppointments,
  splitAppointments,
  type Appointment,
  type AppointmentsState,
} from '@/lib/appointments';
import { fetchMyAchievements, type Achievements } from '@/lib/gamification';
import DashboardNav from '@/components/dashboard/DashboardNav';
import ResumeButton from '@/components/learning/ResumeButton';

export default function HocVienPage() {
  const [profileState, setProfileState] = useState<ProfileState>({ status: 'loading' });
  const [enrollState, setEnrollState] = useState<EnrollmentsState>({ status: 'loading' });
  const [progressState, setProgressState] = useState<DashboardState<CourseProgressItem[]>>({
    status: 'success',
    data: [],
  });
  const [certState, setCertState] = useState<DashboardState<CertificateItem[]>>({
    status: 'success',
    data: [],
  });
  const [orderState, setOrderState] = useState<DashboardState<OrderItem[]>>({
    status: 'success',
    data: [],
  });
  const [notifState, setNotifState] = useState<DashboardState<NotificationItem[]>>({
    status: 'success',
    data: [],
  });
  const [apptState, setApptState] = useState<AppointmentsState>({ status: 'loading' });
  const [achState, setAchState] = useState<
    | { status: 'loading' }
    | { status: 'success'; data: Achievements }
    | { status: 'error' }
  >({ status: 'loading' });
  const [signingOut, setSigningOut] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);

  const load = useCallback(async () => {
    setProfileState({ status: 'loading' });
    setEnrollState({ status: 'loading' });
    const p = await getMyProfileState();
    setProfileState(p);
    if (p.status === 'success') {
      const [enr, prog, certs, orders, notifs, appts, ach] = await Promise.all([
        getMyEnrollments(),
        getMyCourseProgress(),
        getMyCertificates(),
        getMyOrders(),
        getMyNotifications(),
        listMyAppointments(),
        fetchMyAchievements(),
      ]);
      setEnrollState(enr);
      setProgressState(prog);
      setCertState(certs);
      setOrderState(orders);
      setNotifState(notifs);
      setApptState(appts);
      setAchState(ach.status === 'success' ? { status: 'success', data: ach.data } : { status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Phien bi thu hoi tu thiet bi khac (dang xuat moi thiet bi) hoac het
  // han -> tai lai de hien trang thai signed-out thay vi du lieu cu.
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((event) => {
      if (event === 'SIGNED_OUT') void load();
    });
    return () => {
      unsubscribe?.();
    };
  }, [load]);

  if (profileState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải dashboard…
        </p>
      </div>
    );
  }

  if (profileState.status === 'not-configured') {
    return (
      <div className="wrap">
        <div className="notice error" role="alert">
          <p>
            <strong>Chưa cấu hình Supabase.</strong>
          </p>
          <p>Chưa có biến môi trường NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
        </div>
      </div>
    );
  }

  if (profileState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Dashboard học viên</h1>
        <div className="notice" role="status">
          <p>Bạn chưa đăng nhập.</p>
          <p>
            <Link className="btn" href="/dang-nhap">
              Đăng nhập
            </Link>{' '}
            <Link className="btn btn-ghost" href="/dang-ky">
              Đăng ký
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (profileState.status === 'error') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Dashboard học viên</h1>
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được hồ sơ.</strong>
          </p>
          <p>{profileState.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      </div>
    );
  }

  const { profile, user } = profileState;
  const progressItems = progressState.status === 'success' ? progressState.data : [];
  const { inProgress, completed } = splitEnrollments(progressItems);
  const certCount = certState.status === 'success' ? certState.data.length : 0;
  const orderCount = orderState.status === 'success' ? orderState.data.length : 0;
  const unreadCount =
    notifState.status === 'success' ? notifState.data.filter((n) => !n.isRead).length : 0;
  const totalLessonsDone = progressItems.reduce((s, c) => s + c.completedLessons, 0);
  const nextCourse = inProgress[0] ?? null;
  const upcomingAppts: Appointment[] =
    apptState.status === 'success' ? splitAppointments(apptState.data).upcoming.slice(0, 3) : [];
  const latestNotifs: NotificationItem[] =
    notifState.status === 'success'
      ? [...notifState.data].sort((a, b) => Number(!a.isRead) - Number(!b.isRead)).slice(0, 3)
      : [];

  return (
    <div className="wrap">
      <h1 className="gold-title">Dashboard học viên</h1>
      <DashboardNav />

      {nextCourse && nextCourse.courseSlug && (
        <section className="card resume-hero" aria-labelledby="tiep-tuc-hoc-title">
          <h2 id="tiep-tuc-hoc-title" className="gold-title">Tiếp tục học</h2>
          <p>
            <strong>{nextCourse.courseTitle}</strong> — đã học {nextCourse.completedLessons}/
            {nextCourse.totalLessons} bài ({nextCourse.progressPercent}%)
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={nextCourse.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Tiến độ ${nextCourse.courseTitle}`}
          >
            <div className="progress-fill" style={{ width: `${nextCourse.progressPercent}%` }} />
          </div>
          <p>
            <ResumeButton courseSlug={nextCourse.courseSlug} returnTo="/hoc-vien" />
          </p>
        </section>
      )}

      <section className="card" aria-labelledby="profile-title">
        <h2 id="profile-title" className="gold-title">Xin chào, {profile?.full_name || user.email}</h2>
        {profile?.avatar_url && (
          <img className="avatar avatar-lg" src={profile.avatar_url} alt="Ảnh đại diện của bạn" />
        )}
        <p>
          <strong>Email:</strong> {profile?.email ?? user.email}
        </p>
        <p>
          <strong>Số điện thoại:</strong> {profile?.phone || '(chưa cập nhật)'}
        </p>
        <p>
          <strong>Tỉnh / Thành phố:</strong> {profile?.province || '(chưa cập nhật)'}
        </p>
        <p>
          <Link className="btn btn-ghost" href="/hoc-vien/ho-so">
            Chỉnh sửa hồ sơ
          </Link>{' '}
          <Link className="btn btn-ghost" href="/hoc-vien/doi-mat-khau">
            Đổi mật khẩu
          </Link>{' '}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().then(() => void load());
            }}
          >
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </p>
        <p>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={signingOutAll}
            onClick={() => {
              if (!confirmSignOutAll) {
                setConfirmSignOutAll(true);
                return;
              }
              setSigningOutAll(true);
              void signOutAllDevices().then(() => void load());
            }}
          >
            {signingOutAll
              ? 'Đang đăng xuất…'
              : confirmSignOutAll
                ? 'Bấm lại để xác nhận đăng xuất mọi thiết bị'
                : 'Đăng xuất khỏi tất cả thiết bị'}
          </button>
        </p>
      </section>

      <section aria-labelledby="stats-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="stats-title" className="gold-title">Tổng quan học tập</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-num">{inProgress.length}</p>
            <p>Khóa đang học</p>
          </div>
          <div className="stat-card">
            <p className="stat-num">{completed.length}</p>
            <p>Khóa hoàn thành</p>
          </div>
          <div className="stat-card">
            <p className="stat-num">{certCount}</p>
            <p>Chứng chỉ</p>
          </div>
          <div className="stat-card">
            <p className="stat-num">{orderCount}</p>
            <p>Đơn hàng</p>
          </div>
          <div className="stat-card">
            <p className="stat-num">{totalLessonsDone}</p>
            <p>Bài đã hoàn thành</p>
          </div>
          <div className="stat-card">
            <p className="stat-num">{unreadCount}</p>
            <p>Thông báo chưa đọc</p>
          </div>
        </div>
        {progressState.status === 'error' && (
          <div className="notice error" role="alert">
            <p>
              <strong>Không tải được tiến độ học.</strong>
            </p>
            <p>{progressState.message}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="thanh-tich-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="thanh-tich-title" className="gold-title">Điểm & thành tích</h2>
        {achState.status === 'loading' && (
          <p role="status" aria-live="polite">
            Đang tải thành tích…
          </p>
        )}
        {achState.status === 'success' && achState.data.gamificationEnabled && (
          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-num">{achState.data.totalPoints}</p>
              <p>Tổng điểm</p>
            </div>
            <div className="stat-card">
              <p className="stat-num">{achState.data.streak.current_streak} ngày</p>
              <p>Chuỗi học liên tiếp</p>
            </div>
            <div className="stat-card">
              <p className="stat-num">{achState.data.badges.length}</p>
              <p>Huy hiệu đã đạt</p>
            </div>
          </div>
        )}
        {achState.status === 'success' && achState.data.gamificationEnabled && (
          <p>
            <Link className="btn btn-ghost" href="/hoc-vien/thanh-tich">
              Xem thành tích chi tiết
            </Link>
          </p>
        )}
        {achState.status === 'success' && !achState.data.gamificationEnabled && (
          <div className="notice">
            <p>
              Bạn đang tắt gamification.{' '}
              <Link href="/hoc-vien/thanh-tich">Bật lại điểm và huy hiệu</Link>.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="cong-dong-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="cong-dong-title" className="gold-title">Cộng đồng VISFAR</h2>
        <div className="notice">
          <p>
            Hỏi đáp, chia sẻ bài học và thành tích cùng các học viên khác trong cộng
            đồng học tập suốt đời của Visfar Academy.
          </p>
          <p>
            <Link className="btn btn-gold" href="/cong-dong">
              Mở cộng đồng
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="recent-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="recent-title" className="gold-title">Khóa học đang học</h2>
        {enrollState.status === 'loading' && (
          <p role="status" aria-live="polite">
            Đang tải danh sách khóa học…
          </p>
        )}
        {enrollState.status === 'error' && (
          <div className="notice error" role="alert">
            <p>
              <strong>Không tải được danh sách khóa học.</strong>
            </p>
            <p>{enrollState.message}</p>
            <p>
              <button type="button" className="btn" onClick={() => void load()}>
                Thử lại
              </button>
            </p>
          </div>
        )}
        {enrollState.status === 'success' && progressItems.length === 0 && (
          <div className="notice">
            <p>Bạn chưa ghi danh khóa học nào.</p>
            <p>
              <Link className="btn" href="/chuong-trinh">
                Xem 10 chương trình
              </Link>
            </p>
          </div>
        )}
        {progressItems.length > 0 && (
          <div className="course-grid">
            {inProgress.slice(0, 3).map((c) => (
              <article className="card" key={c.enrollmentId}>
                <h3>
                  {c.courseSlug ? (
                    <Link href={`/chuong-trinh/${c.courseSlug}`}>{c.courseTitle}</Link>
                  ) : (
                    c.courseTitle
                  )}
                </h3>
                <p>
                  Đã học {c.completedLessons}/{c.totalLessons} bài — {c.progressPercent}%
                </p>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={c.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Tiến độ ${c.courseTitle}`}
                >
                  <div className="progress-fill" style={{ width: `${c.progressPercent}%` }} />
                </div>
                <p>
                  <Link href="/hoc-vien/khoa-hoc">Xem chi tiết tiến độ</Link>
                </p>
              </article>
            ))}
          </div>
        )}
        {inProgress.length === 0 && progressItems.length > 0 && (
          <div className="notice">
            <p>Bạn đã hoàn thành tất cả khóa đã ghi danh. Chúc mừng!</p>
            <p>
              <Link className="btn" href="/hoc-vien/chung-chi">
                Xem chứng chỉ
              </Link>
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="danh-gia-11d-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="danh-gia-11d-title" className="gold-title">Đánh giá 11 phương diện</h2>
        <div className="notice">
          <p>
            Tự đánh giá đầu vào theo hệ Thập Nhất Viên Mãn (33 câu, khoảng 10 phút) để
            nhìn rõ mình đang ở đâu và chọn hướng phát triển tiếp theo.
          </p>
          <p>
            <Link className="btn btn-gold" href="/danh-gia-11d">
              Làm bài đánh giá
            </Link>{' '}
            <Link className="btn btn-ghost" href="/hoc-vien/danh-gia-11d">
              Xem lịch sử đánh giá
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="ai-mentor-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="ai-mentor-title" className="gold-title">AI Mentor</h2>
        <div className="notice">
          <p>
            Trợ lý học tập trả lời dựa trên Thư viện Master, mô tả khóa học và triết lý
            Giáo dục Tận Gốc đã được phê duyệt — mỗi câu trả lời đều ghi rõ nguồn để bạn
            kiểm chứng lại (tối đa 20 câu / giờ).
          </p>
          <p>
            <Link className="btn btn-gold" href="/ai-mentor">
              Hỏi AI Mentor
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="lich-hen-sap-toi-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="lich-hen-sap-toi-title" className="gold-title">Lịch hẹn sắp tới</h2>
        {apptState.status === 'loading' && (
          <p role="status" aria-live="polite">
            Đang tải lịch hẹn…
          </p>
        )}
        {apptState.status === 'error' && (
          <div className="notice">
            <p>Lịch hẹn chưa tải được ({apptState.message}).</p>
            <p>
              <Link className="btn btn-ghost" href="/hoc-vien/lich-su">
                Mở trang lịch hẹn
              </Link>
            </p>
          </div>
        )}
        {apptState.status === 'success' && upcomingAppts.length === 0 && (
          <div className="notice">
            <p>Bạn chưa có lịch hẹn nào sắp tới.</p>
            <p>
              <Link className="btn" href="/hoc-vien/lich-su">
                Đặt lịch tư vấn 1-1
              </Link>
            </p>
          </div>
        )}
        {upcomingAppts.length > 0 && (
          <ul className="dashboard-list">
            {upcomingAppts.map((a) => (
              <li key={a.id} className="list-row">
                <p>
                  <strong>
                    {new Date(a.scheduledAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>{' '}
                  · {formatAppointmentCountdown(a.scheduledAt)} · {a.durationMinutes} phút
                </p>
                {a.status === 'confirmed' && a.meetingUrl && (
                  <p>
                    <a
                      className="btn btn-small"
                      href={a.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Vào phòng họp
                    </a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link className="btn btn-ghost" href="/hoc-vien/lich-su">
            Xem tất cả lịch hẹn
          </Link>
        </p>
      </section>

      <section aria-labelledby="thong-bao-moi-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="thong-bao-moi-title" className="gold-title">Thông báo mới</h2>
        {notifState.status === 'error' && (
          <div className="notice error" role="alert">
            <p>
              <strong>Không tải được thông báo.</strong>
            </p>
            <p>{notifState.message}</p>
          </div>
        )}
        {notifState.status === 'success' && latestNotifs.length === 0 && (
          <div className="notice">
            <p>Chưa có thông báo nào.</p>
          </div>
        )}
        {latestNotifs.length > 0 && (
          <ul className="dashboard-list">
            {latestNotifs.map((n) => (
              <li key={n.id} className="list-row">
                <p>
                  {!n.isRead && <strong>● </strong>}
                  <strong>{n.title}</strong>
                </p>
                {n.body && <p className="muted">{n.body}</p>}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link className="btn btn-ghost" href="/hoc-vien/thong-bao">
            Xem tất cả thông báo{unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}
          </Link>
        </p>
      </section>
    </div>
  );
}
