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

export interface SeatAvailability {
  seatId: string;
  sectionId: string;
  sectionName: string;
  rowLabel: string;
  seatNumber: number;
  code: string;
  status: 'available' | 'blocked' | 'sold' | 'held';
  holdExpiresAt: string | null;
  ticketTypeId: string | null;
}

export interface SeatAvailabilityResponse {
  eventSessionId: string;
  event: {
    id: string;
    name: string;
    status: EventSummary['status'] | 'DRAFT' | 'CANCELLED';
    timezone: string;
  };
  seats: SeatAvailability[];
}

export interface SeatHoldResponse {
  holdId: string;
  holdToken: string;
  eventSessionId: string;
  seatIds: string[];
  expiresAt: string;
}

export interface BookingItemSummary {
  id: string;
  seatCode: string | null;
  ticketTypeName: string;
  priceMinor: number;
  currency: string;
}

export interface BookingSummary {
  id: string;
  publicCode: string;
  eventSessionId: string;
  status: 'PENDING' | 'CONFIRMED' | 'PAYMENT_FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';
  currency: string;
  subtotalMinor: number;
  feeMinor: number;
  totalMinor: number;
  expiresAt: string;
  confirmedAt: string | null;
  items: BookingItemSummary[];
  payment: {
    providerReference: string;
    status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
    amountMinor: number;
    currency: string;
    clientSecret: string | null;
    expiresAt: string | null;
  } | null;
}
