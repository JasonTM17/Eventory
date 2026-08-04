# Booking and payment sequences

## Local demo completion

```mermaid
sequenceDiagram
    participant A as Attendee
    participant API as Eventory API
    participant R as Redis
    participant DB as PostgreSQL

    A->>API: POST /api/v1/bookings (seatIds, holdToken, idempotency key)
    API->>R: Validate user-owned, unexpired hold
    API->>DB: Create one durable PENDING booking/payment claim
    API->>DB: Enqueue booking.created outbox row
    API->>API: Mock adapter creates provider reference idempotently
    API-->>A: Booking, amount, and provider reference
    A->>API: POST /api/v1/payments/mock/:providerReference/complete
    API->>API: Synthesize supported mock payment event
    API->>DB: Apply monotonic payment/booking transition
    API->>R: Revalidate hold ownership and expiry
    API->>DB: Sell seats, issue tickets, and enqueue outbox rows
    API-->>A: Confirmed booking or reconciliation disposition
```

## Signed webhook contract

```mermaid
sequenceDiagram
    participant P as Provider contract test
    participant API as Eventory API
    participant DB as PostgreSQL

    P->>API: POST /api/v1/payments/webhooks/mock + HMAC
    API->>API: Verify signature, amount, currency, and event shape
    API->>DB: Deduplicate by provider event identity
    API->>DB: Apply the same monotonic transition contract
    API-->>P: Idempotent result
```

The database transaction is the durable boundary. Redis holds are temporary
admission evidence; the browser never controls amount or confirmation state.
The current provider is an in-process deterministic adapter. Late captures are
not auto-refunded or auto-issued: they remain visible through the reconciliation
table, audit record, and `eventory_payment_reconciliations_open` metric.
