'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function TicketQrCode({
  payload,
  code,
}: {
  payload: string;
  code: string;
}): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    setDataUrl('');
    void QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#162120', light: '#fffdf8' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError('Could not render this signed QR. Use the ticket code instead.');
      });
    return () => {
      active = false;
    };
  }, [payload]);

  if (error) return <p className="form-error">{error}</p>;
  if (!dataUrl) return <div className="ticket-qr__loading" aria-label="Generating QR code" />;
  return <img className="ticket-qr" src={dataUrl} alt={`Signed QR code for ticket ${code}`} />;
}
