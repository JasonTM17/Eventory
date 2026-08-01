# Eventory database ERD

PostgreSQL is the durable source of truth for identity, organizations, venue geometry, event configuration, and event inventory. Redis may hold temporary reservations, but it never owns a seat after a booking is committed.

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
  VENUE {
    uuid id PK
    uuid organization_id FK
    string name
  }
  VENUE_SECTION {
    uuid id PK
    uuid venue_id FK
    string name
  }
  SEAT {
    uuid id PK
    uuid venue_id FK
    uuid section_id FK
    string code
    string row_label
    int seat_number
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
```

## Invariants and indexes

- `organizations.slug` and `events.slug` are public, stable lookup keys; UUIDs remain the canonical resource identifiers.
- A seat is unique within a venue by `code`, and within a section by `(row_label, seat_number)`.
- A session exposes a seat at most once through `(event_session_id, seat_id)`.
- Public discovery uses `(status, start_at)`; organizer views use `(organization_id, status, start_at)`.
- Seat availability queries use `(event_session_id, status)`, while ticket capacity queries use `(ticket_type_id, status)`.
- Foreign keys cascade configuration children when a venue or event is removed. Purchased-ticket tables introduced later must use immutable snapshots and must not rely on deleting this configuration data.
- Booking, payment, ticket, and check-in tables extend the same durable model: bookings snapshot selected prices/seats, tickets carry opaque QR material, and `ticket_check_ins.ticket_id` is unique.
- Analytics filters are bounded by event/session and date window. Existing event-session/status/date indexes plus the unique check-in key keep aggregate reads bounded and concurrent admission authoritative.
