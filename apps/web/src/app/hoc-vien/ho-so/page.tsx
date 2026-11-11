// Trang /hoc-vien/ho-so — sua thong tin ca nhan + anh dai dien.
// Chi sua duoc: ho ten / SĐT / tinh (+ avatar). KHONG sua role /
// email truc tiep — hai truong nay chi hien thi (dong bo tu auth /
// user_roles). Avatar upload len bucket Storage `avatars`.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PROVINCES } from '@visfar/shared';
import { getMyProfileState, type ProfileState } from '@/lib/auth';
import {
  updateMyProfile,
  uploadMyAvatar,
  validateProfileUpdate,
  type ProfileFieldError,
} from '@/lib/dashboard';
import { updateGamificationEnabled } from '@/lib/gamification';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default function HoSoPage() {
  const [profileState, setProfileState] = useState<ProfileState>({ status: 'loading' });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [gamificationOn, setGamificationOn] = useState(true);
  const [gamificationSaving, setGamificationSaving] = useState(false);
  const [gamificationMsg, setGamificationMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const p = await getMyProfileState();
    setProfileState(p);
    if (p.status === 'success' && p.profile) {
      setFullName(p.profile.full_name ?? '');
      setPhone(p.profile.phone ?? '');
      setProvince(p.profile.province ?? '');
      setAvatarPreview(p.profile.avatar_url);
      setGamificationOn(p.profile.gamification_enabled ?? true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const errFor = (field: string) => fieldErrors.find((e) => e.field === field)?.message;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    const input = { fullName, phone, province };
    const errors = validateProfileUpdate(input);
    setFieldErrors(errors);
    if (errors.length > 0) return;
    setSaving(true);
    const res = await updateMyProfile(input);
    setSaving(false);
    if (res.status === 'ok') {
      setSaveMsg({ kind: 'success', text: 'Đã lưu hồ sơ.' });
      void load();
    } else {
      setFieldErrors(res.fieldErrors);
      setSaveMsg({ kind: 'error', text: res.message });
    }
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMsg(null);
    setUploading(true);
    const res = await uploadMyAvatar(file, file, undefined);
    setUploading(false);
    if (res.status === 'ok') {
      setAvatarPreview(res.publicUrl);
      setAvatarMsg({ kind: 'success', text: 'Đã cập nhật ảnh đại diện.' });
    } else {
      setAvatarMsg({ kind: 'error', text: res.message });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  if (profileState.status === 'loading') {
    return (
      <div className="wrap">
        <p role="status" aria-live="polite">
          Đang tải hồ sơ…
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
        </div>
      </div>
    );
  }
  if (profileState.status === 'signed-out') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Hồ sơ của tôi</h1>
        <div className="notice" role="status">
          <p>
            Bạn chưa đăng nhập.{' '}
            <Link className="btn" href="/dang-nhap">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    );
  }
  if (profileState.status === 'error') {
    return (
      <div className="wrap">
        <h1 className="gold-title">Hồ sơ của tôi</h1>
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

  return (
    <div className="wrap">
      <h1 className="gold-title">Hồ sơ của tôi</h1>
      <DashboardNav />

      <section className="card" aria-labelledby="avatar-title">
        <h2 id="avatar-title" className="gold-title">Ảnh đại diện</h2>
        {avatarPreview ? (
          <img className="avatar avatar-lg" src={avatarPreview} alt="Ảnh đại diện của bạn" />
        ) : (
          <p className="muted">Bạn chưa có ảnh đại diện.</p>
        )}
        <p>
          <label className="btn btn-ghost" htmlFor="avatar-input">
            {uploading ? 'Đang tải lên…' : 'Chọn ảnh đại diện'}
          </label>
          <input
            id="avatar-input"
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void handleAvatar(e)}
          />
        </p>
        <p className="hint">Ảnh JPG, PNG hoặc WebP, tối đa 2 MB. Chỉ bạn mới thay được ảnh của mình.</p>
        {avatarMsg && (
          <div className={`notice ${avatarMsg.kind === 'success' ? 'success' : 'error'}`} role="status">
            <p>{avatarMsg.text}</p>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="edit-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="edit-title" className="gold-title">Thông tin cá nhân</h2>
        <form onSubmit={(e) => void handleSave(e)} noValidate>
          <div className="field">
            <label htmlFor="pf-name">Họ và tên</label>
            <input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={saving} />
            {errFor('fullName') && (
              <p className="field-error" role="alert">
                {errFor('fullName')}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="pf-phone">Số điện thoại</label>
            <input
              id="pf-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
            />
            {errFor('phone') && (
              <p className="field-error" role="alert">
                {errFor('phone')}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="pf-province">Tỉnh / Thành phố</label>
            <select id="pf-province" value={province} onChange={(e) => setProvince(e.target.value)} disabled={saving}>
              <option value="">— Chưa chọn —</option>
              {(PROVINCES as readonly string[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errFor('province') && (
              <p className="field-error" role="alert">
                {errFor('province')}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="pf-email">Email (không sửa được ở đây)</label>
            <input id="pf-email" value={profile?.email ?? user.email} disabled readOnly />
            <p className="hint">Email gắn với tài khoản đăng nhập. Cần đổi email, vui lòng liên hệ hỗ trợ.</p>
          </div>
          <p>
            <strong>Vai trò:</strong> {profile?.role ?? 'student'}
          </p>
          <p>
            <strong>Tham gia ngày:</strong>{' '}
            {user.created_at
              ? new Date(user.created_at).toLocaleDateString('vi-VN')
              : '(chưa rõ)'}
          </p>
          {saveMsg && (
            <div className={`notice ${saveMsg.kind === 'success' ? 'success' : 'error'}`} role="status">
              <p>{saveMsg.text}</p>
            </div>
          )}
          <p>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
          </p>
        </form>
      </section>

      <section className="card" aria-labelledby="gamification-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="gamification-title" className="gold-title">Điểm & huy hiệu (gamification)</h2>
        <p>
          Khi bật, bạn thấy điểm thưởng, chuỗi ngày học liên tiếp và huy hiệu tại{' '}
          <Link href="/hoc-vien/thanh-tich">trang Thành tích</Link>. Khi tắt, điểm và
          huy hiệu không cộng thêm nữa, nhưng điểm cũ vẫn được giữ nguyên.
        </p>
        <p>
          <button
            type="button"
            className="btn"
            disabled={gamificationSaving}
            onClick={() => {
              setGamificationSaving(true);
              setGamificationMsg(null);
              void updateGamificationEnabled(!gamificationOn).then((res) => {
                setGamificationSaving(false);
                if (res.status === 'ok') {
                  setGamificationOn(!gamificationOn);
                  setGamificationMsg(
                    gamificationOn ? 'Đã tắt điểm và huy hiệu.' : 'Đã bật lại điểm và huy hiệu.',
                  );
                } else {
                  setGamificationMsg(res.status === 'signed-out' ? 'Bạn cần đăng nhập.' : res.message);
                }
              });
            }}
          >
            {gamificationSaving ? 'Đang lưu…' : gamificationOn ? 'Tắt điểm và huy hiệu' : 'Bật lại điểm và huy hiệu'}
          </button>
        </p>
        {gamificationMsg && (
          <p role="status">
            {gamificationMsg}
          </p>
        )}
      </section>
    </div>
  );
}
