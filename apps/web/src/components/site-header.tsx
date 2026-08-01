import Link from 'next/link';
import { Container } from '@eventory/ui';

export function SiteHeader(): React.JSX.Element {
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
          <Link href="/organizer">Organizer studio</Link>
          <Link className="site-nav__action" href="/login">
            Sign in
          </Link>
        </nav>
        <details className="site-nav-mobile">
          <summary>Menu</summary>
          <nav className="site-nav-mobile__panel" aria-label="Mobile navigation">
            <Link href="/events">Discover</Link>
            <Link href="/tickets">Tickets</Link>
            <Link href="/organizer">Organizer studio</Link>
            <Link className="site-nav__action" href="/login">
              Sign in
            </Link>
          </nav>
        </details>
      </Container>
    </header>
  );
}
