# Eventory database ERD

PostgreSQL is the durable source of truth for identity, organizations, venue
geometry, event configuration, booking snapshots, payment inbox/reconciliation
state, tickets, check-ins, and outbox notifications. Redis may hold expiring
reservations, but it never owns a seat after a booking is committed.

```mermaid
erDiagram
  USER ||--o{ ORGANIZATION_MEMBER : joins
  ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has
  USER ||--o{ ORGANIZATION : owns
  ORGANIZATION ||--o{ VENUE : manages
  VENUE ||--o{ VENUE_SECTION : contains
  VENUE ||--o{ SEAT : defines
  VENUE_SECTION ||--o{ SEAT : groups
  ORGANIZATION ||--o{ EVENT : publishes
  VENUE o|--o{ EVENT : hosts
  EVENT ||--o{ EVENT_SESSION : schedules
  EVENT ||--o{ TICKET_TYPE : sells
  EVENT_SESSION ||--o{ SEAT_ALLOCATION : exposes
  SEAT ||--o{ SEAT_ALLOCATION : maps
  TICKET_TYPE o|--o{ SEAT_ALLOCATION : prices
  USER ||--o{ REFRESH_TOKEN : rotates
  USER ||--o{ AUDIT_LOG : acts
  USER ||--o{ IDEMPOTENCY_RECORD : owns
  EVENT_SESSION ||--o{ BOOKING : books
  USER ||--o{ BOOKING : places
  BOOKING ||--o{ BOOKING_ITEM : snapshots
  SEAT_ALLOCATION ||--o{ BOOKING_ITEM : reserves
  TICKET_TYPE ||--o{ BOOKING_ITEM : prices
  BOOKING ||--o| PAYMENT : settles
  PAYMENT ||--o{ PAYMENT_EVENT : records
  PAYMENT ||--o| PAYMENT_RECONCILIATION : reconciles
  PAYMENT ||--o{ PAYMENT_WEBHOOK_INBOX : inboxes
  BOOKING ||--o{ OUTBOX_EVENT : emits
  OUTBOX_EVENT ||--o{ NOTIFICATION_DELIVERY : delivers
  BOOKING_ITEM ||--o| TICKET : issues
  TICKET ||--o{ TICKET_CHECK_IN : checks
  EVENT_SESSION ||--o{ TICKET_CHECK_IN : admits

  USER {
    uuid id PK
    string email UK
    enum role
    enum status
  }
  ORGANIZATION {
    uuid id PK
    string slug UK
    uuid owner_id FK
  }
  EVENT {
    uuid id PK
    uuid organization_id FK
    uuid venue_id FK
    string slug UK
    enum status
    datetime start_at
    datetime end_at
  }
  EVENT_SESSION {
    uuid id PK
    uuid event_id FK
    datetime sales_start_at
    datetime sales_end_at
  }
  TICKET_TYPE {
    uuid id PK
    uuid event_id FK
    int price_minor
    int capacity
    int sold_quantity
  }
  SEAT_ALLOCATION {
    uuid id PK
    uuid event_session_id FK
    uuid seat_id FK
    uuid ticket_type_id FK
    enum status
  }
  BOOKING {
    uuid id PK
    uuid user_id FK
    uuid event_session_id FK
    uuid hold_id UK
    enum status
    int total_minor
  }
  BOOKING_ITEM {
    uuid id PK
    uuid booking_id FK
    uuid seat_allocation_id FK
    uuid seat_id FK
    int price_minor
  }
  PAYMENT {
    uuid id PK
    uuid booking_id FK
    string provider_reference UK
    enum status
  }
  PAYMENT_RECONCILIATION {
    uuid id PK
    uuid payment_id FK
    string provider_event_id UK
    enum status
  }
  PAYMENT_WEBHOOK_INBOX {
    uuid id PK
    string provider
    string provider_event_id UK
    enum status
  }
  OUTBOX_EVENT {
    uuid id PK
    string topic
    string aggregate_type
    uuid aggregate_id
    enum status
  }
  NOTIFICATION_DELIVERY {
    uuid id PK
    string dedupe_key UK
    uuid outbox_event_id FK
    enum status
  }
  TICKET {
    uuid id PK
    uuid booking_item_id FK
    string public_code UK
    string qr_nonce UK
    enum status
  }
  TICKET_CHECK_IN {
    uuid id PK
    uuid ticket_id UK
    uuid event_session_id FK
    uuid scanner_user_id FK
  }
```

## Invariants and indexes

- `organizations.slug` and `events.slug` are public, stable lookup keys; UUIDs
  remain the canonical resource identifiers.
- A seat is unique within a venue by `code`, and within a section by `(row_label, seat_number)`.
- A session exposes a seat at most once through `(event_session_id, seat_id)`.
- Public discovery uses `(status, start_at)`; organizer views use `(organization_id, status, start_at)`.
- Seat availability queries use `(event_session_id, status)`, while ticket capacity queries use `(ticket_type_id, status)`.
- Booking, payment, ticket, webhook inbox, reconciliation, and outbox tables all carry unique keys for idempotent retries instead of relying on Redis.
- Booking items snapshot the sold seat, price, and ticket type; tickets carry opaque QR material; `ticket_check_ins.ticket_id` is unique.
- Analytics requests enforce an event/session and a maximum one-year date
  window. Production query-plan and latency validation remain required; add
  indexes only from representative `EXPLAIN (ANALYZE, BUFFERS)` evidence.
