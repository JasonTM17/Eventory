import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Container } from '@eventory/ui';
import type { AuthUser } from '@eventory/contracts';
import { CheckInScanner } from '../../../src/components/check-in-scanner';
import { apiRequest, isApiError } from '../../../src/lib/api';

export const metadata: Metadata = { title: 'Organizer check-in' };

export default async function OrganizerCheckInPage(): Promise<React.JSX.Element> {
  const cookieHeader = (await cookies()).toString();
  let user: AuthUser | null = null;
  try {
    const response = await apiRequest<{ user: AuthUser }>('/auth/me', {}, cookieHeader);
    user = response.user;
  } catch (error) {
    if (!isApiError(error, 401)) throw error;
  }
  if (!user) {
    return (
      <div className="page-shell">
        <Container>
          <div className="ui-card" style={{ maxWidth: 620 }}>
            <span className="kicker">Organizer check-in</span>
            <h1>Sign in to scan the room.</h1>
            <p className="event-card__description">
              Only members of the event organization can validate tickets.
            </p>
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
            <span className="kicker">Organizer tools / {user.displayName}</span>
            <h1>Open the door.</h1>
          </div>
          <p>
            Validate signed tickets against the live Eventory API. Staff access follows organization
            membership.
          </p>
        </div>
        <div style={{ marginTop: 28 }}>
          <CheckInScanner />
        </div>
      </Container>
    </div>
  );
}
