import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Container } from '@eventory/ui';
import type { AuthUser, EventAnalyticsSummary } from '@eventory/contracts';
import { AnalyticsDashboard } from '../../../../src/components/analytics-dashboard';
import { apiRequest, isApiError } from '../../../../src/lib/api';

export const metadata: Metadata = { title: 'Event analytics' };

export default async function OrganizerAnalyticsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<React.JSX.Element> {
  const { eventId } = await params;
  const cookieHeader = (await cookies()).toString();
  let user: AuthUser | null = null;
  let metrics: EventAnalyticsSummary | null = null;
  let denied = false;
  try {
    const response = await apiRequest<{ user: AuthUser }>('/auth/me', {}, cookieHeader);
    user = response.user;
    metrics = await apiRequest<EventAnalyticsSummary>(
      `/organizer/events/${eventId}/analytics`,
      {},
      cookieHeader,
    );
  } catch (error) {
    if (isApiError(error, 401)) user = null;
    else if (isApiError(error, 403)) denied = true;
    else throw error;
  }
  if (!user) {
    return (
      <div className="page-shell">
        <Container>
          <div className="ui-card" style={{ maxWidth: 620 }}>
            <span className="kicker">Event analytics</span>
            <h1>Sign in to read the room.</h1>
            <a className="text-link" href="/login">
              Go to sign in ↗
            </a>
          </div>
        </Container>
      </div>
    );
  }
  return (
    <div className="page-shell">
      <Container>
        <div className="directory-header">
          <div>
            <span className="kicker">Organizer analytics / {user.displayName}</span>
            <h1>Read the room.</h1>
          </div>
          <p>Event-scoped aggregates keep private workspaces separate and keep queries bounded.</p>
        </div>
        <div style={{ marginTop: 28 }}>
          {denied ? (
            <div className="ui-card">
              <p className="form-error">You do not have access to this event.</p>
            </div>
          ) : metrics ? (
            <AnalyticsDashboard metrics={metrics} />
          ) : null}
        </div>
      </Container>
    </div>
  );
}
