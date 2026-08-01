export const workspaceName = '@eventory/contracts';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Array<{ property: string; constraints: string[] }>;
  requestId?: string;
}

export interface AuthUser {
  id: string;
  role: 'ADMIN' | 'ORGANIZER' | 'ATTENDEE';
  email: string;
  displayName: string;
}

export interface EventSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  startAt: string;
  endAt: string;
  status: 'PUBLISHED' | 'SALES_OPEN' | 'SALES_CLOSED' | 'ONGOING';
  venue: { id: string; name: string; address: string | null } | null;
  sessions: Array<{ id: string; name: string; startAt: string; endAt: string }>;
  ticketTypes: Array<{
    id: string;
    name: string;
    description: string | null;
    priceMinor: number;
    currency: string;
  }>;
}

export interface EventListResponse {
  items: EventSummary[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  membership: 'OWNER' | 'ADMIN' | 'STAFF';
}
