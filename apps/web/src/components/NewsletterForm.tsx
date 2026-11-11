// Form dang ky nhan tin o footer — lam that theo DECISIONS QĐ 6:
// POST /api/v1/newsletter, chi hien thanh cong khi API tra ok:true.
// Trang thai: idle / submitting / success / error (kem nut Thu lai).
'use client';

import { useState } from 'react';
import { submitNewsletter } from '@/lib/newsletter';

type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string; canRetry: boolean };

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  async function doSubmit() {
    setState({ status: 'submitting' });
    const result = await submitNewsletter(email);
    if (result.status === 'success') {
      setState({ status: 'success' });
    } else {
      setState({ status: 'error', message: result.message, canRetry: result.canRetry });
    }
  }

  if (state.status === 'success') {
    return (
      <p role="status">
        Cảm ơn bạn đã đăng ký nhận tin từ Visfar Academy. Vui lòng kiểm tra email để xác nhận.
      </p>
    );
  }

  return (
    <form
      className="newsletter-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void doSubmit();
      }}
    >
      <label htmlFor="newsletter-email">Nhận tin từ Visfar Academy</label>
      <div className="newsletter-row">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ban@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state.status === 'submitting'}
        />
        <button className="btn" type="submit" disabled={state.status === 'submitting'}>
          {state.status === 'submitting' ? 'Đang gửi…' : 'Đăng ký nhận tin'}
        </button>
      </div>
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {state.message}{' '}
          {state.canRetry && (
            <button type="button" className="btn btn-ghost" onClick={() => void doSubmit()}>
              Thử lại
            </button>
          )}
        </p>
      )}
    </form>
  );
}
