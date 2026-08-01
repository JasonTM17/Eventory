import Link from 'next/link';
import { Button, Container } from '@eventory/ui';
import type { EventListResponse } from '@eventory/contracts';
import { EventCard } from '../src/components/event-card';
import { apiRequest } from '../src/lib/api';

async function getFeaturedEvents(): Promise<EventListResponse | null> {
  try {
    return await apiRequest<EventListResponse>('/events?page=1&pageSize=3');
  } catch {
    return null;
  }
}

export default async function HomePage(): Promise<React.JSX.Element> {
  const events = await getFeaturedEvents();
  return (
    <div className="page-shell">
      <Container>
        <section className="hero">
          <div>
            <span className="kicker">A better room for what matters</span>
            <h1>Make the moment count.</h1>
            <p>
              Eventory gives people a quieter way to find great events — and gives organizers the
              tools to fill every meaningful seat.
            </p>
            <div className="hero__actions">
              <Link href="/events">
                <Button>
                  Explore events <span aria-hidden="true">↗</span>
                </Button>
              </Link>
              <Link href="/organizer">
                <Button variant="secondary">Build an event</Button>
              </Link>
            </div>
          </div>
          <aside className="hero__aside">
            <strong>
              One platform.
              <br />
              The whole night.
            </strong>
            <span>
              Discovery, seating, secure checkout, and the ticket in your pocket — designed to feel
              like one continuous experience.
            </span>
          </aside>
        </section>
        <section aria-labelledby="featured-heading">
          <div className="section-heading">
            <div>
              <span className="kicker">The public room</span>
              <h2 id="featured-heading">Find your next reason to go out.</h2>
            </div>
            <Link className="text-link" href="/events">
              View all events ↗
            </Link>
          </div>
          {events?.items.length ? (
            <div className="event-grid">
              {events.items.map((event) => (
                <EventCard event={event} key={event.id} />
              ))}
            </div>
          ) : (
            <div className="ui-card empty-state">
              The discovery feed is warming up. Check back soon for the first published rooms.
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}
