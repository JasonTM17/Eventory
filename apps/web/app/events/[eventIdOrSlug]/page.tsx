import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, Container, StatusBadge } from '@eventory/ui';
import type { EventSummary } from '@eventory/contracts';
import { apiRequest, isApiError } from '../../../src/lib/api';
import { formatDate, formatMoney, statusTone } from '../../../src/lib/format';

interface EventPageProps {
  params: Promise<{ eventIdOrSlug: string }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { eventIdOrSlug } = await params;
  try {
    const event = await apiRequest<EventSummary>(`/events/${encodeURIComponent(eventIdOrSlug)}`);
    return { title: event.name, description: event.description ?? undefined };
  } catch {
    return { title: 'Event not found' };
  }
}

export default async function EventDetailPage({
  params,
}: EventPageProps): Promise<React.JSX.Element> {
  const { eventIdOrSlug } = await params;
  let event: EventSummary;
  try {
    event = await apiRequest<EventSummary>(`/events/${encodeURIComponent(eventIdOrSlug)}`);
  } catch (error) {
    if (isApiError(error, 404)) notFound();
    throw error;
  }
  return (
    <div className="page-shell">
      <Container>
        <div className="event-detail">
          <div>
            <StatusBadge label={event.status.replace(/_/g, ' ')} tone={statusTone(event.status)} />
            <h1>{event.name}</h1>
            <p className="event-detail__description">
              {event.description ?? 'A carefully produced Eventory experience.'}
            </p>
            <div className="event-detail__facts">
              <div className="fact">
                <small>When</small>
                <strong>{formatDate(event.startAt, event.timezone)}</strong>
              </div>
              <div className="fact">
                <small>Where</small>
                <strong>{event.venue?.name ?? 'Venue to be announced'}</strong>
              </div>
              <div className="fact">
                <small>Timezone</small>
                <strong>{event.timezone}</strong>
              </div>
              <div className="fact">
                <small>Sessions</small>
                <strong>{event.sessions.length} programmed</strong>
              </div>
            </div>
          </div>
          <Card className="ticket-panel">
            <span className="kicker">Showtimes</span>
            <h2>Choose a session.</h2>
            {event.sessions.length ? (
              <div className="showtime-list">
                {event.sessions.map((session) => (
                  <Link
                    className="showtime-row"
                    href={`/events/${event.slug}/seats/${session.id}`}
                    key={session.id}
                  >
                    <span>
                      <strong>{session.name}</strong>
                      <small>{formatDate(session.startAt, event.timezone)}</small>
                    </span>
                    <span aria-hidden="true">Select seats →</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">No sessions are scheduled yet.</p>
            )}
            <div className="ticket-panel__pricing">
              <span className="kicker">Admission</span>
              {event.ticketTypes.length ? (
                event.ticketTypes.map((ticket) => (
                  <div className="ticket-row" key={ticket.id}>
                    <span>
                      <strong>{ticket.name}</strong>
                      <small>{ticket.description ?? 'Admission ticket'}</small>
                    </span>
                    <strong>{formatMoney(ticket.priceMinor, ticket.currency)}</strong>
                  </div>
                ))
              ) : (
                <p className="empty-state">Tickets are not on sale yet.</p>
              )}
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
