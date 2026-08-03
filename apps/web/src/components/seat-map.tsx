'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { io, type Socket } from 'socket.io-client';
import type {
  SeatAvailability,
  SeatAvailabilityResponse,
  SeatHoldResponse,
} from '@eventory/contracts';
import { Button, Card, StatusBadge } from '@eventory/ui';
import { apiBaseUrl, apiRequest, isApiError } from '../lib/api';

interface SeatMapProps {
  eventSessionId: string;
  eventName: string;
}
interface SeatUpdate {
  eventSessionId: string;
  seatIds: string[];
  state: 'held' | 'available';
  holdExpiresAt?: string;
}

function holdStorageKey(eventSessionId: string): string {
  return `eventory:seat-hold:${eventSessionId}`;
}

export function SeatMap({ eventSessionId, eventName }: SeatMapProps): React.JSX.Element {
  const [seats, setSeats] = useState<SeatAvailability[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hold, setHold] = useState<SeatHoldResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [salesOpen, setSalesOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await apiRequest<SeatAvailabilityResponse>(
        `/seating/${eventSessionId}/availability`,
      );
      setSeats(response.seats);
      setSalesOpen(response.event.status === 'SALES_OPEN');
      setError('');
    } catch (requestError) {
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Seats are unavailable.')
          : 'The seating service is unavailable.',
      );
    }
  }, [eventSessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(holdStorageKey(eventSessionId));
    if (!stored) return;
    try {
      const restored = JSON.parse(stored) as SeatHoldResponse;
      if (new Date(restored.expiresAt).getTime() > Date.now()) {
        setHold(restored);
        setSecondsLeft(Math.ceil((new Date(restored.expiresAt).getTime() - Date.now()) / 1_000));
      } else {
        window.sessionStorage.removeItem(holdStorageKey(eventSessionId));
      }
    } catch {
      window.sessionStorage.removeItem(holdStorageKey(eventSessionId));
    }
  }, [eventSessionId]);

  useEffect(() => {
    const origin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
    const socket: Socket = io(`${origin}/seating`, {
      withCredentials: true,
      reconnectionAttempts: 5,
    });
    socket.on('connect', () => {
      setLive(true);
      socket.emit('joinSession', { eventSessionId });
    });
    socket.on('disconnect', () => setLive(false));
    socket.on('seat.updated', (update: SeatUpdate) => {
      if (update.eventSessionId !== eventSessionId) return;
      setSeats((current) =>
        current.map((seat) =>
          update.seatIds.includes(seat.seatId)
            ? { ...seat, status: update.state, holdExpiresAt: update.holdExpiresAt ?? null }
            : seat,
        ),
      );
    });
    return () => {
      socket.disconnect();
    };
  }, [eventSessionId]);

  useEffect(() => {
    if (!hold) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1_000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setHold(null);
        window.sessionStorage.removeItem(holdStorageKey(eventSessionId));
        setMessage('Your hold expired. The map is available again.');
        void refresh();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [hold, refresh]);

  const rows = useMemo(() => {
    const grouped = new Map<string, SeatAvailability[]>();
    for (const seat of seats)
      grouped.set(seat.rowLabel, [...(grouped.get(seat.rowLabel) ?? []), seat]);
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [seats]);

  function toggleSeat(seat: SeatAvailability): void {
    if (!salesOpen || hold || seat.status !== 'available') return;
    setSelected((current) =>
      current.includes(seat.seatId)
        ? current.filter((id) => id !== seat.seatId)
        : [...current, seat.seatId],
    );
    setError('');
  }

  async function createHold(): Promise<void> {
    if (!selected.length) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiRequest<SeatHoldResponse>(`/seating/${eventSessionId}/holds`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: selected, idempotencyKey: crypto.randomUUID() }),
      });
      setHold(response);
      window.sessionStorage.setItem(holdStorageKey(eventSessionId), JSON.stringify(response));
      setSelected([]);
      setSecondsLeft(Math.ceil((new Date(response.expiresAt).getTime() - Date.now()) / 1_000));
      setMessage('Seats are held for you. Continue to checkout before the timer ends.');
    } catch (requestError) {
      const errorMessage = isApiError(requestError)
        ? (requestError.body.message ?? 'Those seats were just taken.')
        : 'The seating service is unavailable.';
      await refresh();
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function releaseHold(): Promise<void> {
    if (!hold) return;
    setBusy(true);
    try {
      await apiRequest(`/seating/${eventSessionId}/holds`, {
        method: 'DELETE',
        body: JSON.stringify({ seatIds: hold.seatIds, holdToken: hold.holdToken }),
      });
      setHold(null);
      window.sessionStorage.removeItem(holdStorageKey(eventSessionId));
      setMessage('Hold released.');
      await refresh();
    } catch (requestError) {
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Could not release the hold.')
          : 'The seating service is unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="seat-map-card">
      <div className="seat-map-card__header">
        <div>
          <span className="kicker">Choose your seats</span>
          <h2>{eventName}</h2>
        </div>
        <StatusBadge label={live ? 'Live map' : 'Refreshing'} tone={live ? 'success' : 'warning'} />
      </div>
      <div className="seat-stage" aria-hidden="true">
        STAGE
      </div>
      <div className="seat-grid" aria-label="Seat map">
        {rows.map(([row, rowSeats]) => (
          <div className="seat-row" key={row}>
            <span className="seat-row__label">{row}</span>
            {rowSeats.map((seat) => {
              const isSelected = selected.includes(seat.seatId);
              const isDisabled = !salesOpen || seat.status !== 'available' || Boolean(hold);
              return (
                <button
                  type="button"
                  key={seat.seatId}
                  className={`seat ${isSelected ? 'seat--selected' : ''} seat--${seat.status}`}
                  aria-label={`Row ${seat.rowLabel}, seat ${seat.seatNumber}, ${seat.status}`}
                  aria-pressed={isSelected}
                  disabled={isDisabled}
                  onClick={() => toggleSeat(seat)}
                >
                  {seat.seatNumber}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="seat-legend">
        <span>
          <i aria-hidden="true" className="seat-dot seat-dot--available" />
          Available
        </span>
        <span>
          <i aria-hidden="true" className="seat-dot seat-dot--selected" />
          Selected
        </span>
        <span>
          <i aria-hidden="true" className="seat-dot seat-dot--held" />
          Held
        </span>
        <span>
          <i aria-hidden="true" className="seat-dot seat-dot--sold" />
          Unavailable
        </span>
      </div>
      {hold ? (
        <div className="hold-banner" role="status">
          <div>
            <strong>{secondsLeft}s reserved</strong>
            <span>
              {hold.seatIds.length} seat{hold.seatIds.length === 1 ? '' : 's'} held for you.
            </span>
          </div>
          <Button variant="secondary" onClick={releaseHold} disabled={busy}>
            Release
          </Button>
          <Link className="ui-button ui-button--primary" href={`/checkout/${eventSessionId}`}>
            Continue to payment
          </Link>
        </div>
      ) : (
        <div className="seat-map-card__footer">
          <span>
            {salesOpen
              ? selected.length
                ? `${selected.length} selected`
                : 'Select up to 12 seats'
              : 'Sales open soon'}
          </span>
          <Button onClick={createHold} disabled={!salesOpen || !selected.length || busy}>
            {busy ? 'Holding…' : 'Hold seats'}
          </Button>
        </div>
      )}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
