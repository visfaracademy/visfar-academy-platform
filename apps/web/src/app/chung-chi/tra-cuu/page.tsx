// Trang tra cuu chung chi cong khai — Task 08.
// Nhap ma chung chi (hoac ma tra cuu ngan) -> hien TEN HOC VIEN, KHOA
// HOC, NGAY CAP, TRANG THAI. Khong hien PII khac (email, SDT, user_id).
// Du lieu qua GET /api/v1/certificates/verify (RPC verify_certificate).
'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CertificateCard from '@/components/certificate/CertificateCard';
import { normalizeCertificateCode, type PublicCertificate } from '@/lib/certificates';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; data: PublicCertificate }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

function TraCuuContent() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const autoVerifiedFor = useRef('');

  const verify = useCallback(async (rawCode: string) => {
    const normalized = normalizeCertificateCode(rawCode);
    if (!normalized) {
      setState({ status: 'error', message: 'Vui lòng nhập mã chứng chỉ.' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const res = await fetch(
        `/api/v1/certificates/verify?code=${encodeURIComponent(normalized)}`,
      );
      const body = (await res.json()) as {
        ok: boolean;
        certificate?: PublicCertificate;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        if (res.status === 404) {
          setState({ status: 'not-found' });
          return;
        }
        setState({ status: 'error', message: body.error ?? 'Không tra cứu được.' });
        return;
      }
      if (!body.certificate) {
        setState({ status: 'not-found' });
        return;
      }
      setState({ status: 'found', data: body.certificate });
    } catch {
      setState({ status: 'error', message: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
    }
  }, []);

  // Mo bang QR / link co san ?ma=... -> tu tra cuu 1 lan.
  useEffect(() => {
    const ma = searchParams.get('ma') ?? '';
    if (ma && autoVerifiedFor.current !== ma) {
      autoVerifiedFor.current = ma;
      setCode(ma);
      void verify(ma);
    }
  }, [searchParams, verify]);

  return (
    <div className="wrap">
      <h1 className="gold-title">Tra cứu chứng chỉ</h1>
      <p className="muted">
        Nhập mã chứng chỉ (VD: VISFAR-CERT-2026-000001) hoặc quét mã QR trên chứng chỉ để kiểm
        tra tính xác thực.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
      >
        <div className="field">
          <label htmlFor="cert-code">Mã chứng chỉ</label>
          <input
            id="cert-code"
            name="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="VISFAR-CERT-2026-000001"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="btn" disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Đang tra cứu…' : 'Tra cứu'}
        </button>
      </form>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          Đang tra cứu…
        </p>
      )}

      {state.status === 'error' && (
        <div className="notice error" role="alert" style={{ marginTop: '1rem' }}>
          <p>
            <strong>Không tra cứu được.</strong>
          </p>
          <p>{state.message}</p>
          <p>
            <button type="button" className="btn" onClick={() => void verify(code)}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {state.status === 'not-found' && (
        <div className="notice" role="status" style={{ marginTop: '1rem' }}>
          <p>
            <strong>Không tìm thấy chứng chỉ với mã này.</strong>
          </p>
          <p>Vui lòng kiểm tra lại mã, hoặc liên hệ Visfar Academy để được hỗ trợ.</p>
        </div>
      )}

      {state.status === 'found' && (
        <div style={{ marginTop: '1rem' }}>
          <div className="notice success" role="status" style={{ marginBottom: '1rem' }}>
            <p>
              <strong>
                {state.data.status === 'revoked'
                  ? 'Đã tìm thấy chứng chỉ, nhưng chứng chỉ này đã bị thu hồi.'
                  : 'Chứng chỉ hợp lệ.'}
              </strong>
            </p>
          </div>
          <CertificateCard
            certificateCode={state.data.certificateCode}
            courseTitle={state.data.courseTitle}
            courseSlug={state.data.courseSlug}
            status={state.data.status}
            issuedAt={state.data.issuedAt}
            recipientName={state.data.recipientName}
          />
          <p style={{ marginTop: '1rem' }}>
            <Link href="/">Về trang chủ</Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default function TraCuuChungChiPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap">
          <p role="status">Đang tải trang tra cứu…</p>
        </div>
      }
    >
      <TraCuuContent />
    </Suspense>
  );
}
