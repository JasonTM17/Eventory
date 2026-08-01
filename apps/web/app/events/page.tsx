import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@eventory/ui';
import type { EventListResponse } from '@eventory/contracts';
import { EventCard } from '../../src/components/event-card';
import { apiRequest } from '../../src/lib/api';

export const metadata: Metadata = { title: 'Discover events' };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const { search } = await searchParams;
  const searchTerm = (Array.isArray(search) ? search[0] : search)?.trim() ?? '';
  const query = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
  let response: EventListResponse | null = null;
  try {
    response = await apiRequest<EventListResponse>(`/events?page=1&pageSize=30${query}`);
  } catch {
    response = null;
  }
  const discoveryIsAvailable = response !== null;
  const emptyStateAction = !discoveryIsAvailable
    ? { href: '/events', label: 'Try again' }
    : searchTerm
      ? { href: '/events', label: 'Reset discovery' }
      : { href: '/organizer', label: 'Build an event' };

  return (
    <div className="page-shell page-shell--discovery">
      <Container>
        <div className="directory-header">
          <div>
            <span className="kicker">Public discovery</span>
            <h1>
              Go where
              <br />
              the energy is.
            </h1>
          </div>
          <p>
            Browse published events, compare the room, and keep your attention on the part that
            matters: showing up.
          </p>
        </div>
        <form className="inline-form" role="search" action="/events">
          <label className="sr-only" htmlFor="event-search">
            Search events
          </label>
          <input
            autoComplete="off"
            id="event-search"
            name="search"
            defaultValue={searchTerm}
            placeholder="Search by event name…"
            type="search"
          />
          <button className="ui-button ui-button--secondary" type="submit">
            Search
          </button>
        </form>
        <div style={{ marginTop: 38 }}>
          {response?.items.length ? (
            <div className="event-grid">
              {response.items.map((event) => (
                <EventCard event={event} key={event.id} />
              ))}
            </div>
          ) : (
            <div className="discovery-empty-state" role="status">
              <div>
                <span className="kicker">
                  {discoveryIsAvailable
                    ? searchTerm
                      ? 'No matching rooms'
                      : 'Fresh rooms soon'
                    : 'A short interruption'}
                </span>
                <h2>
                  {discoveryIsAvailable
                    ? searchTerm
                      ? 'No published events match that search.'
                      : 'No public events yet.'
                    : 'Discovery needs a moment.'}
                </h2>
                <p>
                  {discoveryIsAvailable
                    ? searchTerm
                      ? 'Try a wider phrase or reset your search to see every published event.'
                      : 'When an organizer publishes a room, it will appear here.'
                    : 'We could not load the directory right now. Refresh this page in a moment.'}
                </p>
              </div>
              <Link className="text-link" href={emptyStateAction.href}>
                {emptyStateAction.label} <span aria-hidden="true">↗</span>
              </Link>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
