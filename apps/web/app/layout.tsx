import type { Metadata } from 'next';
import { SiteHeader } from '../src/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Eventory — make the moment count', template: '%s — Eventory' },
  description: 'Discover, publish, and experience events with Eventory.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="page-footer">
          <div className="ui-container">EVENTORY / THE ROOM BETWEEN A PLAN AND A MEMORY</div>
        </footer>
      </body>
    </html>
  );
}
