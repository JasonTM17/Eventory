# ADR-003: Use Redis only for temporary seat holds

- Status: Accepted
- Date: 2026-08-01

## Context

Attendees need immediate feedback while choosing seats, but a pending selection should not create durable booking rows or block a seat forever. A concurrent request must not win because it happened to read availability first.

## Decision

The seating module stores one opaque, expiring Redis key per `(eventSessionId, seatId)`. A Lua script checks every requested key and writes all hold keys in one atomic operation. Hold values contain only the opaque hold token, user/session binding, aggregate hold ID, and expiry timestamp. Release and renew use Lua ownership checks. Redis keyspace expiration events publish an availability update to the session WebSocket room.

PostgreSQL remains authoritative for configured allocation status and later sold ownership. A Redis outage returns a safe failure; it never marks an allocation sold or invents availability.

## Consequences

- Multi-seat holds are all-or-nothing, with bounded TTL controlled by `SEAT_HOLD_TTL_SECONDS`.
- At-least-once WebSocket updates are acceptable because clients refresh the authoritative availability endpoint after reconnect or conflict.
- Redis keyspace notifications are an optimization for live release events; TTL expiry itself remains the correctness mechanism.

## Rejected alternatives

- Read-then-`SET`: vulnerable to two clients observing the same free seat.
- Durable pending rows for every hover/selection: adds database contention and cleanup load before a checkout exists.
- Redis as permanent ownership: unsafe across eviction, restart, or data loss.
