import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Container } from '@eventory/ui';
import type { AdminPage, AdminUserSummary, AuthUser } from '@eventory/contracts';
import { AdminConsole } from '../../src/components/admin-console';
import { apiRequest, isApiError } from '../../src/lib/api';

export const metadata: Metadata = { title: 'Platform administration' };

export default async function AdminPage(): Promise<React.JSX.Element> {
  const cookieHeader = (await cookies()).toString();
  let user: AuthUser | null = null;
  let users: AdminPage<AdminUserSummary> | null = null;
  let denied = false;
  try {
    const response = await apiRequest<{ user: AuthUser }>('/auth/me', {}, cookieHeader);
    user = response.user;
    users = await apiRequest<AdminPage<AdminUserSummary>>(
      '/admin/users?page=1&pageSize=20',
      {},
      cookieHeader,
    );
  } catch (error) {
    if (isApiError(error, 401)) user = null;
    else if (isApiError(error, 403)) denied = true;
    else throw error;
  }
  if (!user)
    return (
      <div className="page-shell">
        <Container>
          <div className="ui-card" style={{ maxWidth: 620 }}>
            <span className="kicker">Administration</span>
            <h1>Sign in to guard the platform.</h1>
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
        <div className="directory-header">
          <div>
            <span className="kicker">Platform administration / {user.displayName}</span>
            <h1>Make it safe.</h1>
          </div>
          <p>
            Moderation is deliberately separate from organizer tools. User-facing secrets and
            password material never leave the API.
          </p>
        </div>
        <div style={{ marginTop: 28 }}>
          {denied ? (
            <div className="ui-card">
              <p className="form-error">Administrator role required.</p>
            </div>
          ) : users ? (
            <AdminConsole initialPage={users} currentUserId={user.id} />
          ) : null}
        </div>
      </Container>
    </div>
  );
}
