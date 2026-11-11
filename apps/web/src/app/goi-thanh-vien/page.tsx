// Trang /goi-thanh-vien — goi thanh vien cong khai (Task 10).
// Doc goi dang mo qua Workers GET /membership-plans. Mua goi = tao don
// 1 item membership -> trang /thanh-toan/[orderId]. Gia lay tu server;
// hien thi o day chi de xem truoc.
'use client';

export const runtime = 'edge';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatVnd } from '@/lib/dashboard';
import {
  createOrder,
  fetchMembershipPlans,
  getAccessToken,
  type MembershipPlan,
  type PaymentsState,
} from '@/lib/payments';

export default function GoiThanhVienPage() {
  const router = useRouter();
  const [state, setState] = useState<PaymentsState<{ plans: MembershipPlan[] }>>({
    status: 'loading',
  });
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchMembershipPlans());
    setSignedIn((await getAccessToken()) !== null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buy = async (plan: MembershipPlan) => {
    setBuying(plan.id);
    setError(null);
    const res = await createOrder({ items: [{ itemType: 'membership', planId: plan.id }] });
    setBuying(null);
    if (res.status === 'success') {
      router.push(`/thanh-toan/${res.data.order.id}`);
    } else if (res.status === 'signed-out') {
      router.push('/dang-nhap?next=/goi-thanh-vien');
    } else if (res.status === 'error') {
      setError(res.message);
    } else {
      setError('Chưa kết nối được. Vui lòng thử lại sau.');
    }
  };

  return (
    <div className="wrap">
      <h1 className="gold-title">Gói thành viên</h1>
      <p>
        Thành viên Visfar Academy học trọn bộ chương trình theo gói — một lần đăng ký, học xuyên
        suốt thời hạn gói.
      </p>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite">
          Đang tải gói thành viên…
        </p>
      )}

      {state.status === 'not-configured' && (
        <div className="notice error" role="alert">
          <p>Gói thành viên chưa được cấu hình. Vui lòng thử lại sau.</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert">
          <p>
            <strong>Không tải được gói thành viên.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void load()}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status === 'success' && state.data.plans.length === 0 && (
        <div className="notice">
          <p>Hiện chưa có gói thành viên nào đang mở bán.</p>
          <p>
            <Link className="btn" href="/chuong-trinh">
              Xem 10 chương trình
            </Link>
          </p>
        </div>
      )}

      {state.status === 'success' && state.data.plans.length > 0 && (
        <div className="dashboard-list">
          {state.data.plans.map((plan) => (
            <article className="card list-row" key={plan.id}>
              <h2 className="gold-title">{plan.name}</h2>
              {plan.description ? <p>{plan.description}</p> : null}
              <p>
                <strong>{formatVnd(plan.priceVnd)}</strong>
                {plan.durationDays ? ` · ${plan.durationDays} ngày` : ' · Không giới hạn thời gian'}
              </p>
              {signedIn === false ? (
                <p>
                  <Link className="btn" href="/dang-nhap?next=/goi-thanh-vien">
                    Đăng nhập để mua gói
                  </Link>
                </p>
              ) : (
                <p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void buy(plan)}
                    disabled={buying !== null}
                  >
                    {buying === plan.id ? 'Đang tạo đơn…' : 'Mua gói này'}
                  </button>
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {error ? (
        <div className="notice error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
