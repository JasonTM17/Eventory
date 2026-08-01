---
phase: 7
title: Seat reservation
status: completed
effort: 1 session
---

# Phase 7: Seat reservation

## Overview

Implement the critical seat reservation path: atomic Redis TTL holds, PostgreSQL-backed availability, hold tokens tied to user/booking, release/expiration, WebSocket seat updates, and a responsive interactive seat map.

## Requirements

- Functional: a seat can be held by at most one active user; hold expiry releases it; clients receive hold/release events; database remains final sold-state authority.
- Non-functional: Lua or equivalent atomic Redis operation, bounded TTL, idempotent release, no naive check-then-set, and concurrency tests.

## File inventory

| Action | Paths                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------- |
| Create | `apps/api/src/modules/seating/`, Redis scripts, gateway adapters, seating migrations/tests         |
| Modify | `packages/contracts/`, `apps/web` seat/session routes and components                               |
| Create | `docs/architecture/seat-reservation-sequence.md`, `docs/adr/ADR-003-redis-temporary-seat-holds.md` |

## Architecture

Redis key `seat-hold:{eventSessionId}:{seatId}` stores an opaque hold token, booking ID, user ID, and expiry. A single Lua script verifies absence/ownership and writes all requested seats atomically. PostgreSQL locks/constraints protect permanent ownership during confirmation. WebSocket messages are derived from successful state transitions, not from client claims.

## Implementation Steps

1. Define hold value schema, TTL policy, Lua acquire/release/renew scripts, and Redis adapter.
2. Implement availability query and seat-hold endpoints with authorization and idempotency.
3. Add expiration worker and WebSocket gateway broadcasting hold/release updates.
4. Implement web seat map with keyboard/focus states, countdown, reconnect behavior, and clear conflict handling.
5. Add unit, Redis integration, and concurrency tests for hold races/expiry.

## Test scenario matrix

| Scenario                   | Expected result                                                           |
| -------------------------- | ------------------------------------------------------------------------- |
| Two users hold same seat   | Exactly one success; loser gets `SEAT_ALREADY_HELD`.                      |
| Partial multi-seat request | Atomic failure; no orphan subset holds.                                   |
| Expired hold               | Seat becomes available and release event is emitted once.                 |
| Redis unavailable          | Safe 503/degraded response; no false sold state.                          |
| Reconnect                  | Client refreshes authoritative availability before accepting interaction. |

## Success Criteria

- [x] No double active holds under concurrency tests.
- [x] Hold ownership and expiry are revalidated on release/confirmation.
- [x] WebSocket updates are scoped to the event session and do not leak user data.

## Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @eventory/api test` (seat hold, ownership, idempotency, and race tests)
- `pnpm --filter @eventory/web build`

## Dependency map

Depends on phases 2-5 and web foundation; unblocks booking/payment.

## Risk Assessment

Redis TTL is advisory for cleanup, not the only correctness mechanism. Clock skew and worker delays must be tolerated by server-side expiry checks.
