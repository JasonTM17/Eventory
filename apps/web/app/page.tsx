import Link from 'next/link';
import { Container } from '@eventory/ui';
import type { EventListResponse } from '@eventory/contracts';
import { EventCard } from '../src/components/event-card';
import { apiRequest } from '../src/lib/api';
import { PublicDiscoveryHeroArt } from '../src/components/public-discovery-hero-art';

async function getFeaturedEvents(): Promise<EventListResponse | null> {
  try {
    return await apiRequest<EventListResponse>('/events?page=1&pageSize=3');
  } catch {
    return null;
  }
}

export default async function HomePage(): Promise<React.JSX.Element> {
  const events = await getFeaturedEvents();
  const discoveryIsAvailable = events !== null;

  return (
    <div className="page-shell page-shell--discovery">
      <Container>
        <section className="discovery-hero" aria-labelledby="discovery-hero-heading">
          <div className="discovery-hero__copy">
            <span className="kicker">A better room for what matters</span>
            <h1 id="discovery-hero-heading">Make the moment count.</h1>
            <p>
              Eventory gives people a quieter way to find great events — and gives organizers the
              tools to fill every meaningful seat.
            </p>
            <div className="discovery-hero__actions">
              <Link className="ui-button ui-button--primary" href="/events">
                Explore events <span aria-hidden="true">↗</span>
              </Link>
              <Link className="ui-button ui-button--secondary" href="/organizer">
                Build an event
              </Link>
            </div>
          </div>
          <div className="discovery-hero__art">
            <PublicDiscoveryHeroArt />
            <div className="discovery-hero__note">
              <span className="kicker">One continuous experience</span>
              <strong>From the first plan to the last scan.</strong>
              <p>Discovery, seating, checkout, and the ticket in your pocket.</p>
            </div>
          </div>
        </section>
        <section className="discovery-section" aria-labelledby="featured-heading">
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
            <div className="discovery-empty-state" role="status">
              <div>
                <span className="kicker">
                  {discoveryIsAvailable ? 'Fresh rooms soon' : 'A short interruption'}
                </span>
                <h3>
                  {discoveryIsAvailable ? 'No public events yet.' : 'Discovery needs a moment.'}
                </h3>
                <p>
                  {discoveryIsAvailable
                    ? 'When an organizer publishes a room, it will appear here.'
                    : 'We could not load public events right now. Try the directory again in a moment.'}
                </p>
              </div>
              <Link className="text-link" href="/events">
                Open the event directory <span aria-hidden="true">↗</span>
              </Link>
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}
