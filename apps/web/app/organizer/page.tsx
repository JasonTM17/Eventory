import type { Metadata } from 'next';
import { Container } from '@eventory/ui';
import type { AuthUser, OrganizationSummary } from '@eventory/contracts';
import { OrganizerStudio } from '../../src/components/organizer-studio';
import { apiRequest, isApiError } from '../../src/lib/api';
import { cookies } from 'next/headers';

export const metadata: Metadata = { title: 'Organizer studio' };

export default async function OrganizerPage(): Promise<React.JSX.Element> {
  const cookieHeader = (await cookies()).toString();
  let user: AuthUser | null = null;
  let organizations: OrganizationSummary[] = [];
  try {
    const response = await apiRequest<{ user: AuthUser }>('/auth/me', {}, cookieHeader);
    user = response.user;
    organizations = await apiRequest<OrganizationSummary[]>('/organizations', {}, cookieHeader);
  } catch (error) {
    if (!isApiError(error, 401)) throw error;
  }
  if (!user)
    return (
      <div className="page-shell">
        <Container>
          <div className="ui-card" style={{ maxWidth: 620 }}>
            <span className="kicker">Organizer studio</span>
            <h1>Sign in to enter the room.</h1>
            <p className="event-card__description">
              Your event workspaces and drafts are protected by the API session. Sign in to
              continue.
            </p>
            <a className="text-link" href="/login">
              Go to sign in ↗
            </a>
          </div>
        </Container>
      </div>
    );
  return (
    <div className="page-shell">
      <Container>
        <div className="section-heading">
          <div>
            <span className="kicker">Good to see you, {user.displayName}</span>
            <h1
              style={{
                margin: '12px 0 0',
                fontSize: 'clamp(42px, 6vw, 72px)',
                letterSpacing: '-.08em',
                lineHeight: '.95',
              }}
            >
              Make a room
              <br />
              worth entering.
            </h1>
          </div>
          <p>Role: {user.role}</p>
        </div>
        <OrganizerStudio organizations={organizations} />
      </Container>
    </div>
  );
}
