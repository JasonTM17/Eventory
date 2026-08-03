'use client';

import { useEffect, useRef, useState } from 'react';
import type { BookingSummary, SeatHoldResponse } from '@eventory/contracts';
import { Button, Card, StatusBadge } from '@eventory/ui';
import { apiRequest, isApiError } from '../lib/api';
import { formatMoney } from '../lib/format';

interface CheckoutPanelProps {
  eventSessionId: string;
}

function holdStorageKey(eventSessionId: string): string {
  return `eventory:seat-hold:${eventSessionId}`;
}

function bookingKeyStorageKey(eventSessionId: string, holdId: string): string {
  return `eventory:booking-key:${eventSessionId}:${holdId}`;
}

export function CheckoutPanel({ eventSessionId }: CheckoutPanelProps): React.JSX.Element {
  const [hold, setHold] = useState<SeatHoldResponse | null>(null);
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const startedForHold = useRef<string | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(holdStorageKey(eventSessionId));
    if (!stored) {
      setError('Your seat hold is missing. Return to the seat map and select seats again.');
      return;
    }
    try {
      const parsed = JSON.parse(stored) as SeatHoldResponse;
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        setError('Your seat hold has expired. Return to the seat map and select seats again.');
        return;
      }
      setHold(parsed);
    } catch {
      setError('The seat hold could not be read. Return to the seat map and try again.');
    }
  }, [eventSessionId]);

  useEffect(() => {
    if (!hold || startedForHold.current === hold.holdId) return;
    startedForHold.current = hold.holdId;
    const keyName = bookingKeyStorageKey(eventSessionId, hold.holdId);
    const idempotencyKey = window.sessionStorage.getItem(keyName) ?? crypto.randomUUID();
    window.sessionStorage.setItem(keyName, idempotencyKey);
    void apiRequest<BookingSummary>('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        eventSessionId,
        seatIds: hold.seatIds,
        holdToken: hold.holdToken,
        idempotencyKey,
      }),
    })
      .then(setBooking)
      .catch((requestError: unknown) => {
        setError(
          isApiError(requestError)
            ? (requestError.body.message ?? 'Checkout could not be started.')
            : 'Checkout could not be started.',
        );
      });
  }, [eventSessionId, hold]);

  useEffect(() => {
    if (!booking || booking.status !== 'PENDING') return;
    const timer = window.setInterval(() => {
      void apiRequest<BookingSummary>(`/bookings/${booking.id}`)
        .then(setBooking)
        .catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [booking]);

  async function completeMock(outcome: 'succeed' | 'fail'): Promise<void> {
    if (!booking?.payment?.providerReference) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<BookingSummary>(
        `/payments/mock/${encodeURIComponent(booking.payment.providerReference)}/complete`,
        { method: 'POST', body: JSON.stringify({ outcome }) },
      );
      setBooking(updated);
    } catch (requestError) {
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Payment could not be completed.')
          : 'Payment could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !booking) {
    return (
      <Card className="checkout-card">
        <span className="kicker">Checkout unavailable</span>
        <p className="form-error" role="alert">
          {error}
        </p>
      </Card>
    );
  }

  return (
    <Card className="checkout-card">
      <div className="checkout-card__header">
        <div>
          <span className="kicker">Secure checkout</span>
          <h1>Keep the moment.</h1>
        </div>
        <StatusBadge
          label={booking?.status ?? 'Preparing'}
          tone={booking?.status === 'CONFIRMED' ? 'success' : 'warning'}
        />
      </div>
      {booking ? (
        <>
          <div className="checkout-summary">
            <div>
              <span>Booking</span>
              <strong>{booking.publicCode}</strong>
            </div>
            <div>
              <span>{booking.items.length} ticket(s)</span>
              <strong>{formatMoney(booking.totalMinor, booking.currency)}</strong>
            </div>
          </div>
          <div className="checkout-items">
            {booking.items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.ticketTypeName} {item.seatCode ? `· ${item.seatCode}` : ''}
                </span>
                <strong>{formatMoney(item.priceMinor, item.currency)}</strong>
              </div>
            ))}
          </div>
          {booking.status === 'PENDING' && booking.payment?.providerReference ? (
            <div className="checkout-actions">
              <p>Mock payment is ready. Choose a result to exercise the full callback flow.</p>
              <div>
                <Button onClick={() => void completeMock('succeed')} disabled={busy}>
                  {busy ? 'Processing…' : 'Pay successfully'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void completeMock('fail')}
                  disabled={busy}
                >
                  Simulate failure
                </Button>
              </div>
            </div>
          ) : booking.status === 'PENDING' ? (
            <p className="empty-state">
              Payment initialization is syncing. This page will refresh automatically.
            </p>
          ) : (
            <p className={booking.status === 'CONFIRMED' ? 'form-success' : 'form-error'}>
              {booking.status === 'CONFIRMED'
                ? 'Payment confirmed. Your tickets are being issued.'
                : `Booking is ${booking.status.toLowerCase().replace('_', ' ')}.`}
            </p>
          )}
        </>
      ) : (
        <p className="empty-state">Creating a server-priced booking…</p>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
