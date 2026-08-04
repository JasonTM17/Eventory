import Link from 'next/link';
import { cookies } from 'next/headers';
import { Container } from '@eventory/ui';
import type { AuthUser } from '@eventory/contracts';
import { apiRequest } from '../lib/api';
import { AccountAction } from './account-action';

async function currentUser(): Promise<AuthUser | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;
  try {
    return (await apiRequest<{ user: AuthUser }>('/auth/me', {}, cookieHeader)).user;
  } catch {
    return null;
  }
}

export async function SiteHeader(): Promise<React.JSX.Element> {
  const user = await currentUser();
  const studioHref = user?.role === 'ADMIN' ? '/admin' : '/organizer';
  const studioLabel = user?.role === 'ADMIN' ? 'Admin' : 'Organizer studio';

  const accountControl = user ? (
    <AccountAction displayName={user.displayName} />
  ) : (
    <Link className="site-nav__action" href="/login">
      Sign in
    </Link>
  );

  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <Link className="brand" href="/" aria-label="Eventory home">
          <span className="brand__mark">E</span>
          <span>eventory</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/events">Discover</Link>
          <Link href="/tickets">Tickets</Link>
          {user?.role !== 'ATTENDEE' ? <Link href={studioHref}>{studioLabel}</Link> : null}
          {accountControl}
        </nav>
        <details className="site-nav-mobile">
          <summary>Menu</summary>
          <nav className="site-nav-mobile__panel" aria-label="Mobile navigation">
            <Link href="/events">Discover</Link>
            <Link href="/tickets">Tickets</Link>
            {user?.role !== 'ATTENDEE' ? <Link href={studioHref}>{studioLabel}</Link> : null}
            {accountControl}
          </nav>
        </details>
      </Container>
    </header>
  );
}
