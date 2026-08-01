import type { Metadata, Viewport } from 'next';
import { SiteHeader } from '../src/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Eventory — make the moment count', template: '%s — Eventory' },
  description: 'Discover, publish, and experience events with Eventory.',
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f5f3ed',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          <div className="ui-container">EVENTORY / THE ROOM BETWEEN A PLAN AND A MEMORY</div>
        </footer>
      </body>
    </html>
  );
}
