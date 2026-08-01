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
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/events">Discover</Link>
          <Link href="/organizer">Organizer studio</Link>
          <Link className="site-nav__action" href="/login">
            Sign in
          </Link>
        </nav>
      </Container>
    </header>
  );
}
