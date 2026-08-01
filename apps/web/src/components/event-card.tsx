import Link from 'next/link';
import type { EventSummary } from '@eventory/contracts';
import { Card, StatusBadge } from '@eventory/ui';
import { formatDate, formatMoney, statusTone } from '../lib/format';

export function EventCard({ event }: { event: EventSummary }): React.JSX.Element {
  const lowestPrice = event.ticketTypes[0];
  return (
    <Card className="event-card">
      <div className="event-card__eyebrow">
        <StatusBadge label={event.status.replace(/_/g, ' ')} tone={statusTone(event.status)} />
        <span>{formatDate(event.startAt, event.timezone)}</span>
      </div>
      <h3>{event.name}</h3>
      <p className="event-card__description">
        {event.description ?? 'A carefully produced Eventory experience.'}
      </p>
      <div className="event-card__footer">
        <span>{event.venue?.name ?? 'Venue to be announced'}</span>
        <span>
          {lowestPrice
            ? `From ${formatMoney(lowestPrice.priceMinor, lowestPrice.currency)}`
            : 'Tickets soon'}
        </span>
      </div>
      <Link className="text-link" href={`/events/${event.slug}`}>
        View event <span aria-hidden="true">↗</span>
      </Link>
    </Card>
  );
}
