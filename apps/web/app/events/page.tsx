import type { Metadata } from 'next';
import { Container } from '@eventory/ui';
import type { EventListResponse } from '@eventory/contracts';
import { EventCard } from '../../src/components/event-card';
import { apiRequest } from '../../src/lib/api';

export const metadata: Metadata = { title: 'Discover events' };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}): Promise<React.JSX.Element> {
  const { search } = await searchParams;
  const query = search ? `&search=${encodeURIComponent(search)}` : '';
  let response: EventListResponse | null = null;
  try {
    response = await apiRequest<EventListResponse>(`/events?page=1&pageSize=30${query}`);
  } catch {
    response = null;
  }
  return (
    <div className="page-shell">
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
            id="event-search"
            name="search"
            defaultValue={search}
            placeholder="Search by event name"
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
            <div className="ui-card empty-state">
              No published events match that search. Try a wider phrase or return soon.
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
