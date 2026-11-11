// The hien chung chi + QR xac thuc — Task 08.
// QR chi chua URL tra cuu cong khai (/chung-chi/tra-cuu?ma=...), khong
// chua ten/email/SDT hay so tai khoan. Anh QR ve qua api.qrserver.com
// tu URL do; neu dich vu anh khong tai duoc (offline) thi an anh va
// chi hien link tra cuu (khong bao loi gia).
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buildQrCodeImageUrl, buildVerificationUrl } from '@/lib/certificates';
import { certificateStatusLabelVi } from '@/lib/dashboard';

export interface CertificateCardProps {
  certificateCode: string;
  courseTitle: string;
  courseSlug: string;
  status: string;
  issuedAt: string;
  /** Ten hoc vien — chi hien o trang tra cuu cong khai. */
  recipientName?: string;
  /** Hien QR xac thuc (mac dinh: co). */
  showQr?: boolean;
}

export default function CertificateCard({
  certificateCode,
  courseTitle,
  courseSlug,
  status,
  issuedAt,
  recipientName,
  showQr = true,
}: CertificateCardProps) {
  const [origin, setOrigin] = useState('');
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const verificationUrl = origin ? buildVerificationUrl(origin, certificateCode) : '';
  const qrUrl = verificationUrl ? buildQrCodeImageUrl(verificationUrl) : '';
  const revoked = status === 'revoked';

  return (
    <article className="card">
      <p className="muted" style={{ letterSpacing: '0.08em', fontWeight: 700 }}>
        CHỨNG CHỈ HOÀN THÀNH
      </p>
      <h3>
        {courseSlug ? (
          <Link href={`/chuong-trinh/${courseSlug}`}>{courseTitle}</Link>
        ) : (
          courseTitle
        )}
      </h3>
      {recipientName && (
        <p>
          Học viên: <strong>{recipientName}</strong>
        </p>
      )}
      <p>
        Mã chứng chỉ: <strong>{certificateCode}</strong>
      </p>
      <p>
        Trạng thái: <strong>{certificateStatusLabelVi(status)}</strong>
      </p>
      <p className="muted">Cấp ngày {new Date(issuedAt).toLocaleDateString('vi-VN')}</p>
      {revoked && (
        <div className="notice error" role="alert">
          <p>Chứng chỉ này đã bị thu hồi và không còn hiệu lực.</p>
        </div>
      )}
      {showQr && verificationUrl && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          {!qrFailed ? (
            <img
              src={qrUrl}
              alt={`Mã QR xác thực chứng chỉ ${certificateCode}`}
              width={240}
              height={240}
              loading="lazy"
              onError={() => setQrFailed(true)}
              style={{ background: '#fff', padding: 8, borderRadius: 8, maxWidth: '100%', height: 'auto' }}
            />
          ) : null}
          <p className="muted">Quét mã để xác thực chứng chỉ</p>
          <p>
            <Link href={`/chung-chi/tra-cuu?ma=${encodeURIComponent(certificateCode)}`}>
              Mở trang xác thực
            </Link>
          </p>
        </div>
      )}
    </article>
  );
}
