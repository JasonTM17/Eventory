# Booking and payment sequence

```mermaid
sequenceDiagram
    participant A as Attendee
    participant API as Eventory API
    participant R as Redis
    participant DB as PostgreSQL
    participant P as Mock provider

    A->>API: POST /bookings (seatIds, holdToken, idempotency key)
    API->>R: Validate user-owned, unexpired hold
    API->>DB: Snapshot seats/prices + create one durable PENDING checkout/payment claim
    API->>DB: Enqueue booking.created outbox row
    API->>P: Create provider payment with durable provider idempotency key
    API-->>A: Booking + provider reference + amount
    A->>P: Complete local mock payment
    P->>API: HMAC webhook (succeeded/failed/expired)
    API->>DB: Deduplicate provider event
    API->>R: Revalidate hold ownership and expiry
    API->>DB: Conditional AVAILABLE→SOLD updates
    API->>DB: Issue tickets, update payment/booking, enqueue outbox
    API-->>P: 200 idempotent result
    P-->>API: Late success after expiry
    API->>DB: Mark payment REQUIRES_RECONCILIATION + audit + durable open record
```

The database transaction is the durable boundary. Redis holds are temporary
admission evidence; the browser never controls the amount or confirmation state.
Late captures are not auto-refunded or auto-issued in the mock contract: they
remain visible to operators through the reconciliation table, audit record, and
`eventory_payment_reconciliations_open` metric.
