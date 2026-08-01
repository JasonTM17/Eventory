import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@eventory/ui';
import type { EventSummary } from '@eventory/contracts';
import { SeatMap } from '../../../../../src/components/seat-map';
import { apiRequest, isApiError } from '../../../../../src/lib/api';

interface SeatPageProps {
  params: Promise<{ eventIdOrSlug: string; eventSessionId: string }>;
}

export async function generateMetadata({ params }: SeatPageProps): Promise<Metadata> {
  const { eventIdOrSlug } = await params;
  try {
    const event = await apiRequest<EventSummary>(`/events/${encodeURIComponent(eventIdOrSlug)}`);
    return { title: `Seats for ${event.name}` };
  } catch {
    return { title: 'Choose seats' };
  }
}

export default async function SeatSelectionPage({
  params,
}: SeatPageProps): Promise<React.JSX.Element> {
  const { eventIdOrSlug, eventSessionId } = await params;
  let event: EventSummary;
  try {
    event = await apiRequest<EventSummary>(`/events/${encodeURIComponent(eventIdOrSlug)}`);
  } catch (error) {
    if (isApiError(error, 404)) notFound();
    throw error;
  }
  const session = event.sessions.find((item) => item.id === eventSessionId);
  if (!session) notFound();
  return (
    <div className="page-shell">
      <Container>
        <div className="section-heading">
          <div>
            <span className="kicker">{event.name}</span>
            <h1
              style={{
                margin: '12px 0 0',
                fontSize: 'clamp(42px, 6vw, 72px)',
                letterSpacing: '-.08em',
                lineHeight: '.95',
              }}
            >
              Find your
              <br />
              place in it.
            </h1>
          </div>
          <p>
            {session.name}
            <br />
            {new Date(session.startAt).toLocaleString()}
          </p>
        </div>
        <SeatMap eventSessionId={eventSessionId} eventName={event.name} />
      </Container>
    </div>
  );
}
