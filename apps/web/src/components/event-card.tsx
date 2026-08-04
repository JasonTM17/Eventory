import Link from 'next/link';
import type { EventSummary } from '@eventory/contracts';
import { Card, StatusBadge } from '@eventory/ui';
import { formatDate, formatMoney, statusTone } from '../lib/format';

export function EventCard({ event }: { event: EventSummary }): React.JSX.Element {
  const lowestPrice = event.ticketTypes[0];
  const eventDate = formatDate(event.startAt, event.timezone);
  const nextSession = event.sessions[0];
  const posterTone = (event.slug.charCodeAt(0) + event.slug.length) % 4;

  return (
    <Card className="event-card">
      <div
        className={`event-card__visual event-card__visual--tone-${posterTone}`}
        aria-hidden="true"
      >
        <span className="event-card__visual-mark">E</span>
        <span className="event-card__visual-label">Now booking / Eventory</span>
        <strong className="event-card__visual-title">{event.name}</strong>
        <span className="event-card__visual-date">{eventDate}</span>
        <span className="event-card__visual-cut" />
      </div>
      <div className="event-card__body">
        <div className="event-card__eyebrow">
          <StatusBadge label={event.status.replace(/_/g, ' ')} tone={statusTone(event.status)} />
          <span>{eventDate}</span>
        </div>
        <h3>{event.name}</h3>
        <p className="event-card__description">
          {event.description ?? 'Details will be shared by the organizer.'}
        </p>
        <div className="event-card__showtime">
          <span>{nextSession ? 'Next session' : 'Schedule'}</span>
          <strong>
            {nextSession ? formatDate(nextSession.startAt, event.timezone) : 'Coming soon'}
          </strong>
        </div>
        <div className="event-card__footer">
          <span>{event.venue?.name ?? 'Venue to be announced'}</span>
          <span>
            {lowestPrice
              ? `From ${formatMoney(lowestPrice.priceMinor, lowestPrice.currency)}`
              : 'Tickets soon'}
          </span>
        </div>
        <Link className="text-link" href={`/events/${event.slug}`}>
          View showtimes <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </Card>
  );
}
