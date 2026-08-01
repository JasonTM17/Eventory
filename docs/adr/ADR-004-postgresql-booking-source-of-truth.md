# ADR-004: Keep PostgreSQL as the booking source of truth

- Status: Accepted
- Date: 2026-08-01

## Context

Seat selection is a high-contention workflow. Redis is useful for short-lived holds and WebSocket fan-out, but Redis keys can expire, be evicted, or be lost during a restart. A booking must remain auditable and recoverable after a process or cache failure.

## Decision

PostgreSQL owns durable seat allocation and booking state. Redis stores only expiring hold tokens with a bounded TTL. The API validates a hold, then commits the booking and the seat state in one database transaction. The transaction is protected by the unique `(event_session_id, seat_id)` allocation key and row-level locking/conditional updates. Payment callbacks use an idempotency key and update the same durable aggregate.

## Consequences

- Database constraints remain authoritative during concurrent checkout attempts.
- Redis failures can reject new holds without corrupting sold inventory.
- Expired holds require cleanup/expiry handling, but no booking data is reconstructed from Redis.
- High-volume availability reads may use Redis or a read model later, provided writes still commit through PostgreSQL.

## Rejected alternatives

- Redis-only ownership: fast, but unsafe for durable tickets and recovery after eviction.
- Database-only temporary holds: correct, but creates unnecessary write contention and makes real-time seat updates more expensive.
