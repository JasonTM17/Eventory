import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Container } from '@eventory/ui';
import type { AuthUser, TicketSummary } from '@eventory/contracts';
import { TicketWallet } from '../../src/components/ticket-wallet';
import { apiRequest, isApiError } from '../../src/lib/api';

export const metadata: Metadata = { title: 'Your tickets' };

export default async function TicketsPage(): Promise<React.JSX.Element> {
  const cookieHeader = (await cookies()).toString();
  let user: AuthUser | null = null;
  let tickets: TicketSummary[] = [];
  try {
    const response = await apiRequest<{ user: AuthUser }>('/auth/me', {}, cookieHeader);
    user = response.user;
    tickets = await apiRequest<TicketSummary[]>('/tickets', {}, cookieHeader);
  } catch (error) {
    if (!isApiError(error, 401)) throw error;
  }

  if (!user) {
    return (
      <div className="page-shell">
        <Container>
          <div className="ui-card" style={{ maxWidth: 620 }}>
            <span className="kicker">Ticket wallet</span>
            <h1>Sign in to carry your tickets.</h1>
            <p className="event-card__description">
              Confirmed tickets and their signed QR codes stay behind your account.
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
    <div className="page-shell page-shell--wallet">
      <Container>
        <div className="wallet-hero">
          <div>
            <span className="kicker">Eventory wallet / {user.displayName}</span>
            <h1>Your way in.</h1>
          </div>
          <p>
            Your confirmed passes live here. Each ticket is signed for one session and can be
            validated only by its organizer team.
          </p>
        </div>
        <div className="wallet-content">
          <TicketWallet tickets={tickets} />
        </div>
      </Container>
    </div>
  );
}
