import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container } from '@eventory/ui';
import type { EventListResponse } from '@eventory/contracts';
import { EventCard } from '../../src/components/event-card';
import { apiRequest } from '../../src/lib/api';

export const metadata: Metadata = { title: 'Discover events' };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; page?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const { search, page } = await searchParams;
  const searchTerm = (Array.isArray(search) ? search[0] : search)?.trim() ?? '';
  const requestedPage = Number.parseInt((Array.isArray(page) ? page[0] : page) ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const query = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
  let response: EventListResponse | null = null;
  try {
    response = await apiRequest<EventListResponse>(
      `/events?page=${currentPage}&pageSize=12${query}`,
    );
  } catch {
    response = null;
  }
  if (response && response.total > 0 && currentPage > response.pageCount) {
    redirect(
      `/events?page=${response.pageCount}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`,
    );
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
        <div className="events-directory">
          {response?.items.length ? (
            <>
              <div className="events-toolbar">
                <span>
                  {response.total} event{response.total === 1 ? '' : 's'} available
                </span>
                <span>
                  Page {response.page} of {response.pageCount}
                </span>
              </div>
              <div
                className={`event-grid${response.items.length === 1 ? ' event-grid--single' : ''}`}
              >
                {response.items.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </div>
              {response.pageCount > 1 ? (
                <nav className="events-pagination" aria-label="Event pages">
                  {response.page > 1 ? (
                    <Link
                      className="ui-button ui-button--secondary"
                      href={`/events?page=${response.page - 1}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`}
                    >
                      Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  {response.page < response.pageCount ? (
                    <Link
                      className="ui-button ui-button--primary"
                      href={`/events?page=${response.page + 1}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`}
                    >
                      Next page
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </>
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
