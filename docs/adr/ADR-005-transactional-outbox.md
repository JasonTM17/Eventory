# ADR-005: Use a transactional outbox with at-least-once delivery

- Status: Accepted
- Date: 2026-08-01

## Context

Booking and payment writes must not wait for email delivery. A process crash between a database commit and a queue publish must not silently lose a customer notification, while duplicate workers must not send duplicate messages.

## Decision

Domain mutations insert an `outbox_events` row in the same PostgreSQL transaction. A polling worker claims pending rows with `FOR UPDATE SKIP LOCKED`, records a processing lease, retries transient errors with bounded exponential backoff, and moves exhausted attempts to `DEAD`.

Email consumers use a unique `(outboxEventId, channel)`/dedupe key in `notification_deliveries`. Delivery attempts and errors are persisted. A sent delivery is never sent again when a worker retries the same outbox event.

## Consequences

- Delivery is at-least-once at the outbox boundary; consumers provide idempotency.
- A stale processing lease can be reclaimed after five minutes.
- Mailpit is the local SMTP endpoint; production adapters can replace `EmailService` without changing booking transactions.
- Queue depth and dead letters are observable database state until a dedicated queue is introduced.

## Rejected alternatives

- Synchronous email inside payment confirmation: extends lock duration and makes booking success depend on SMTP.
- Fire-and-forget in-process promises: loses messages on process crash.
- Exactly-once claims: not attainable across database and SMTP; dedupe is the reliable contract.
