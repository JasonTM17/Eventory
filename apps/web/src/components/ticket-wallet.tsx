'use client';

import { Card, StatusBadge } from '@eventory/ui';
import type { TicketSummary } from '@eventory/contracts';
import { TicketQrCode } from './ticket-qr-code';
import { formatDate, formatMoney } from '../lib/format';

function ticketTone(status: TicketSummary['status']): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'CHECKED_IN') return 'success';
  if (status === 'VOID' || status === 'REFUNDED') return 'danger';
  return 'neutral';
}

export function TicketWallet({ tickets }: { tickets: TicketSummary[] }): React.JSX.Element {
  if (!tickets.length) {
    return (
      <p className="empty-state">Your wallet is quiet. Confirm a booking to see tickets here.</p>
    );
  }

  return (
    <div className="wallet-grid">
      {tickets.map((ticket) => (
        <Card className="wallet-ticket" key={ticket.id}>
          <div className="wallet-ticket__header">
            <div>
              <span className="kicker">{ticket.publicCode}</span>
              <h2>{ticket.event.name}</h2>
            </div>
            <StatusBadge label={ticket.status.replace('_', ' ')} tone={ticketTone(ticket.status)} />
          </div>
          <div className="wallet-ticket__meta">
            <div>
              <span>Session</span>
              <strong>{ticket.session.name}</strong>
              <small>{formatDate(ticket.session.startAt)}</small>
            </div>
            <div>
              <span>Seat</span>
              <strong>{ticket.seatCode ?? 'General admission'}</strong>
              <small>{ticket.ticketTypeName}</small>
            </div>
          </div>
          <div className="wallet-ticket__qr">
            <TicketQrCode payload={ticket.qrPayload} code={ticket.publicCode} />
            <p>
              Show this signed code to the organizer scanner. Screenshots work online; do not share
              it publicly.
            </p>
          </div>
          <div className="wallet-ticket__footer">
            <span>{formatMoney(ticket.priceMinor, ticket.currency)}</span>
            <span>
              {ticket.checkedInAt
                ? `Checked in ${formatDate(ticket.checkedInAt)}`
                : `Issued ${formatDate(ticket.issuedAt)}`}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
