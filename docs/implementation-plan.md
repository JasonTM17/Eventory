# Eventory implementation plan

The executable plan is maintained by the CK plan CLI at [`plans/20260801-eventory-platform/plan.md`](../plans/20260801-eventory-platform/plan.md). It is intentionally separate from this short index so phase status remains machine-readable.

## Goal

Deliver a local, testable, production-oriented ticketing platform from an empty checkout: organizer event publishing, attendee discovery and booking, race-safe seat holds, simulated payments, signed QR tickets, organizer check-in, asynchronous notifications, analytics/admin surfaces, security/observability, Docker, CI, and complete operational documentation.

## Phase sequence

| Phase | Outcome                                    | Primary commit groups                                               |
| ----: | ------------------------------------------ | ------------------------------------------------------------------- |
|     1 | Workspace, tooling, docs, env contract     | `chore(repo)`, `chore(tooling)`, `docs(architecture)`, `chore(dev)` |
|     2 | PostgreSQL, Redis, Mailpit local stack     | `chore(infra)`                                                      |
|     3 | NestJS/API/Prisma/health baseline          | `feat(api)`, `feat(database)`                                       |
|     4 | Identity, sessions, roles, policies        | `feat(identity)`, `feat(authz)`, `test(identity)`                   |
|     5 | Venues, events, lifecycle, ticket types    | `feat(venues)`, `feat(events)`, `feat(tickets)`, `test(events)`     |
|     6 | Next.js app, auth/public/organizer screens | `feat(web)`                                                         |
|     7 | Atomic holds, WebSocket, interactive map   | `feat(seating)`, `feat(web)`, `test(seating)`                       |
|     8 | Bookings, mock payments, confirmation      | `feat(bookings)`, `feat(payments)`, `test(bookings)`, `feat(web)`   |
|     9 | Outbox and notification workers            | `feat(outbox)`, `feat(notifications)`, `test(outbox)`               |
|    10 | Signed tickets and check-in                | `feat(tickets)`, `feat(check-in)`, `feat(web)`, `test(check-in)`    |
|    11 | Analytics and administration               | `feat(analytics)`, `feat(admin)`, `feat(web)`                       |
|    12 | Security, audit, metrics, E2E              | `feat(security)`, `feat(audit)`, `feat(observability)`, `test(e2e)` |
|    13 | Docker images, CI, docs, release           | `chore(docker)`, `ci(github)`, `docs(project)`, `chore(release)`    |

## Invariants that gate completion

- PostgreSQL owns permanent seat/ticket state; Redis holds are short-lived and atomic.
- Totals, ownership, state transitions, signatures, and permissions are server-validated.
- Payment callbacks, booking confirmation, outbox processing, and check-in are idempotent under retries/races.
- All sensitive operations are auditable and do not leak secrets or unnecessary PII.
- A clean checkout can migrate, seed, run, test, and build using documented commands.

## Decision record index

- [ADR-001 Modular monolith](./adr/ADR-001-modular-monolith.md)
- [ADR-002 ORM selection](./adr/ADR-002-orm-selection.md)
- [ADR-003 Redis temporary holds](./adr/ADR-003-redis-temporary-seat-holds.md)
- [ADR-004 PostgreSQL booking source of truth](./adr/ADR-004-postgresql-booking-source-of-truth.md)
- [ADR-005 Transactional outbox](./adr/ADR-005-transactional-outbox.md)
- [ADR-006 Cookie authentication](./adr/ADR-006-cookie-based-authentication.md)
- [ADR-007 Mock payment provider](./adr/ADR-007-mock-payment-provider.md)
- [ADR-008 Monorepo structure](./adr/ADR-008-monorepo-structure.md)
