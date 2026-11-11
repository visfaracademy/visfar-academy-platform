'use client';

// Nut dang ky / mua khoa hoc tren trang chi tiet khoa (Task 10).
// - Khoa mien phi (price 0, khong Tuy tam): ghi danh truc tiep qua
//   Workers POST /my/enrollments — khong tao don, khong tao payment.
// - Khoa Tuy tam: hoc vien nhap so tien (>= 0) -> tao don -> trang
//   /thanh-toan/[orderId]. KHONG ket hop ma giam gia (server chan).
// - Khoa co phi: chon them khoa khac (combo) + ma giam gia -> tao don
//   -> trang thanh toan. Tong tien hien o day CHI la uoc tinh hien thi
//   (tinh bang computeOrderTotals); server tinh lai tu DB va la gia
//   chot. Khong bao gio hien "da thanh toan" o day.
// - Chua dang nhap: dan toi /dang-nhap.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Course } from '@visfar/shared';
import { fetchPublishedCourses } from '@/lib/courses';
import {
  computeOrderTotals,
  createOrder,
  enrollFreeCourse,
  getAccessToken,
  validateCoupon,
  type CouponForPricing,
} from '@/lib/payments';
import { formatVnd } from '@/lib/dashboard';

interface ComboCourse {
  id: string;
  title: string;
  priceVnd: number;
}

export default function CheckoutButton({ course }: { course: Course }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [combo, setCombo] = useState<ComboCourse[]>([]);
  const [selectedCombo, setSelectedCombo] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<CouponForPricing | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const isPayWhatYouWant = course.is_pay_what_you_want === true;
  const isFree = course.price_vnd === 0 && !isPayWhatYouWant;

  useEffect(() => {
    let alive = true;
    void getAccessToken().then((token) => {
      if (alive) setSignedIn(token !== null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const loadCombo = useCallback(async () => {
    const res = await fetchPublishedCourses();
    if (res.status === 'success') {
      setCombo(
        res.courses
          .filter((c) => c.id !== course.id)
          .map((c) => ({ id: c.id, title: c.title, priceVnd: c.price_vnd })),
      );
    }
  }, [course.id]);

  const openForm = () => {
    setOpen(true);
    setError(null);
    if (!isFree && !isPayWhatYouWant) void loadCombo();
  };

  const toggleCombo = (id: string) => {
    setSelectedCombo((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itemsForTotals = [
    { unitPriceVnd: course.price_vnd, quantity: 1 },
    ...combo
      .filter((c) => selectedCombo.has(c.id))
      .map((c) => ({ unitPriceVnd: c.priceVnd, quantity: 1 })),
  ];
  const totals = computeOrderTotals(itemsForTotals, coupon);

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponMsg(null);
    const res = await validateCoupon(code, totals.originalAmountVnd);
    if (res.status === 'success') {
      const p = res.data;
      if (p.valid) {
        // validateCoupon tra ve preview; giu lai dang CouponForPricing
        // de tinh lai tong khi doi combo. Gia tri giam thuc te do
        // server tinh lai khi tao don.
        setCoupon({
          discountType: p.discountType,
          discountValue: p.discountValue,
          minOrderVnd: 0,
          maxDiscountVnd: null,
          maxUses: null,
          usedCount: 0,
          validFrom: null,
          validUntil: null,
          isActive: true,
        });
        setCouponMsg(`Đã áp dụng mã ${p.code}: giảm ${formatVnd(p.discountVnd)}.`);
      } else {
        setCoupon(null);
        setCouponMsg(p.reason ? `Mã không áp dụng được (${p.reason}).` : 'Mã không áp dụng được.');
      }
    } else if (res.status === 'error') {
      setCoupon(null);
      setCouponMsg(res.message);
    } else {
      setCouponMsg('Vui lòng đăng nhập để dùng mã giảm giá.');
    }
  };

  const handleFreeEnroll = async () => {
    setBusy(true);
    setError(null);
    const res = await enrollFreeCourse(course.id);
    setBusy(false);
    if (res.status === 'success') {
      setDone(
        res.data.alreadyEnrolled
          ? 'Bạn đã ghi danh khóa này rồi.'
          : 'Ghi danh thành công. Chúc bạn học tốt.',
      );
    } else if (res.status === 'signed-out') {
      setError('Vui lòng đăng nhập để ghi danh.');
    } else if (res.status === 'error') {
      setError(res.message);
    } else {
      setError('Chưa kết nối được. Vui lòng thử lại sau.');
    }
  };

  const handleCreateOrder = async () => {
    setBusy(true);
    setError(null);
    const items: Array<{ itemType: 'course' | 'membership'; courseId?: string }> = [
      { itemType: 'course', courseId: course.id },
    ];
    for (const c of combo) {
      if (selectedCombo.has(c.id)) items.push({ itemType: 'course', courseId: c.id });
    }
    let customAmountVnd: number | null = null;
    if (isPayWhatYouWant) {
      const n = Number(customAmount.replace(/[^\d]/g, ''));
      if (!Number.isFinite(n) || n < 0) {
        setBusy(false);
        setError('Vui lòng nhập số tiền tùy tâm (0đ trở lên).');
        return;
      }
      customAmountVnd = n;
    }
    const res = await createOrder({
      items,
      couponCode: isPayWhatYouWant ? null : couponCode.trim() || null,
      customAmountVnd,
    });
    setBusy(false);
    if (res.status === 'success') {
      router.push(`/thanh-toan/${res.data.order.id}`);
    } else if (res.status === 'signed-out') {
      setError('Vui lòng đăng nhập để đăng ký.');
    } else if (res.status === 'error') {
      setError(res.message);
    } else {
      setError('Chưa kết nối được. Vui lòng thử lại sau.');
    }
  };

  if (signedIn === false) {
    return (
      <Link className="btn" href={`/dang-nhap?next=/chuong-trinh/${course.slug}`}>
        Đăng nhập để đăng ký
      </Link>
    );
  }

  if (done) {
    return (
      <div>
        <p className="notice success">{done}</p>
        <p>
          <Link className="btn-ghost" href="/hoc-vien/khoa-hoc">
            Vào lớp học của tôi
          </Link>
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn" onClick={openForm} disabled={signedIn === null}>
        {isFree ? 'Ghi danh miễn phí' : isPayWhatYouWant ? 'Đăng ký — Tùy tâm' : 'Đăng ký học'}
      </button>
    );
  }

  return (
    <div className="card">
      <h2>Đăng ký khóa học</h2>
      <p>
        <strong>{course.title}</strong>
        <br />
        <span className="muted">
          Học phí:{' '}
          {isFree
            ? 'Miễn phí'
            : isPayWhatYouWant
              ? 'Tùy tâm — bạn tự chọn số tiền đóng góp'
              : formatVnd(course.price_vnd)}
        </span>
      </p>

      {isFree ? (
        <p>
          <button type="button" className="btn" onClick={() => void handleFreeEnroll()} disabled={busy}>
            {busy ? 'Đang ghi danh…' : 'Xác nhận ghi danh miễn phí'}
          </button>
        </p>
      ) : (
        <>
          {isPayWhatYouWant ? (
            <p>
              <label htmlFor="custom-amount">
                Số tiền tùy tâm (đ)
                <input
                  id="custom-amount"
                  className="field"
                  type="number"
                  min={0}
                  step={1000}
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Ví dụ: 500000"
                />
              </label>
              <span className="muted">Nhập 0 nếu bạn muốn học miễn phí đợt này.</span>
            </p>
          ) : (
            <>
              {combo.length > 0 ? (
                <fieldset>
                  <legend>Đăng ký kèm (combo — chung một đơn)</legend>
                  {combo.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={selectedCombo.has(c.id)}
                        onChange={() => toggleCombo(c.id)}
                      />{' '}
                      {c.title} — {c.priceVnd === 0 ? 'Miễn phí / Tùy tâm' : formatVnd(c.priceVnd)}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <p>
                <label htmlFor="coupon-code">
                  Mã giảm giá
                  <input
                    id="coupon-code"
                    className="field"
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCoupon(null);
                      setCouponMsg(null);
                    }}
                    placeholder="Nhập mã nếu có"
                    autoComplete="off"
                  />
                </label>
                <button type="button" className="btn-ghost btn-small" onClick={() => void applyCoupon()}>
                  Áp dụng mã
                </button>
              </p>
              {couponMsg ? <p className="muted">{couponMsg}</p> : null}
              <p>
                Tạm tính: {formatVnd(totals.originalAmountVnd)}
                {totals.discountVnd > 0 ? (
                  <>
                    <br />
                    Giảm giá: −{formatVnd(totals.discountVnd)}
                    <br />
                    <strong>Tổng thanh toán (ước tính): {formatVnd(totals.amountVnd)}</strong>
                  </>
                ) : null}
                <br />
                <span className="muted">Giá cuối cùng do hệ thống xác nhận khi tạo đơn.</span>
              </p>
            </>
          )}
          <p>
            <button type="button" className="btn" onClick={() => void handleCreateOrder()} disabled={busy}>
              {busy ? 'Đang tạo đơn…' : 'Tạo đơn & xem hướng dẫn thanh toán'}
            </button>{' '}
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Đóng
            </button>
          </p>
        </>
      )}
      {error ? <p className="notice error">{error}</p> : null}
    </div>
  );
}
