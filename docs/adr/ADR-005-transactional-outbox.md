# ADR-005: Use a transactional outbox with at-least-once delivery

- Status: Accepted
- Date: 2026-08-01

## Context

Booking and payment writes must not wait for email delivery. A process crash
between a database commit and delivery must not silently lose a customer
notification. Retries need durable deduplication, but SMTP cannot provide an
exactly-once guarantee across the database boundary.

## Decision

Domain mutations insert an `outbox_events` row in the same PostgreSQL transaction. A polling worker claims pending rows with `FOR UPDATE SKIP LOCKED`, records a processing lease, retries transient errors with bounded exponential backoff, and moves exhausted attempts to `DEAD`.

Email consumers use unique `(outboxEventId, channel)` and `dedupeKey` constraints
in `notification_deliveries`. Delivery attempts and errors are persisted.
Retries that observe `SENT` skip delivery, but a crash after SMTP acceptance and
before the database update can produce a duplicate email.

## Consequences

- Delivery is at-least-once. Database state provides retry dedupe where
  observable; recipients and templates must tolerate rare duplicate email.
- A stale processing lease can be reclaimed after five minutes.
- A crash after the database commit but before SMTP/send completion is an
  expected delivery window; dedupe keys and notification status are the
  contract, not exactly-once SMTP.
- Mailpit is the local SMTP endpoint; production adapters can replace `EmailService` without changing booking transactions.
- Queue depth and dead letters are observable database state until a dedicated queue is introduced.

## Rejected alternatives

- Synchronous email inside payment confirmation: extends lock duration and makes booking success depend on SMTP.
- Fire-and-forget in-process promises: loses messages on process crash.
- Exactly-once claims: not attainable across database and SMTP; dedupe is the reliable contract.
