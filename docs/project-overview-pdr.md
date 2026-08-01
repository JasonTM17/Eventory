# Eventory project overview and PDR

## Product goal

Eventory provides a trustworthy local/demo ticketing journey for attendees,
organizers, and platform administrators: discover an event, reserve seats,
checkout with a signed mock payment callback, receive a QR ticket, and perform
an authorized check-in.

## Personas

| Persona        | Need                                     | Release capability                                   |
| -------------- | ---------------------------------------- | ---------------------------------------------------- |
| Attendee       | Discover, reserve, pay, and keep tickets | Public discovery, atomic holds, checkout, wallet, QR |
| Organizer      | Publish inventory and operate entry      | Venue/seats, event lifecycle, analytics, scanner     |
| Platform admin | Moderate users and investigate           | Paginated admin views, suspension, audit logs        |

## Functional requirements

1. Users register/login with Argon2id and rotating HttpOnly refresh sessions.
2. Organizers create organizations, venues, seats, sessions, ticket types, and
   publish/open sales through backend authorization policies.
3. Attendees see public events, hold seats atomically, create idempotent
   bookings, and complete a signed mock payment webhook.
4. Payment confirmation changes durable seat/ticket state in one transaction
   and emits retryable outbox notifications.
5. Tickets contain opaque signed QR material; check-in is session-bound,
   organization-authorized, and concurrency-safe.
6. Organizers see bounded analytics; admins can page safe user/org/event/audit
   records and suspend a user with refresh-token revocation.
7. API boundaries enforce validation, rate limits, body limits, CORS/CSRF,
   security headers, safe errors, audit records, health, and metrics.

## Non-functional requirements

- PostgreSQL is the source of truth for durable state; Redis holds only
  expiring seat coordination.
- Booking, payment, ticket, and check-in transitions remain transactionally
  consistent under duplicate and concurrent requests.
- No password, token, signature, provider secret, or unnecessary PII appears
  in logs, metrics, QR payloads, or committed configuration.
- A clean checkout can run the local dependency/app stack with Docker Compose;
  CI repeats the same quality gates without production credentials.
- Public contracts remain typed through `@eventory/contracts`.

## Acceptance criteria

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, API tests, and web build
  pass on Node 22/pnpm 11.
- Prisma migrations apply to an empty PostgreSQL database and seed produces a
  deterministic demo scenario.
- Seat hold, duplicate payment, outbox retry, and concurrent check-in tests
  demonstrate the core invariants.
- Docker Compose config validates, API/web images build, and health checks
  expose dependency readiness.
- Threat model, testing strategy, runbooks, deployment guide, CI workflows,
  and ADRs match the implemented code.

## Scope boundary

Real payment settlement, offline scanning, third-party identity, cloud
deployment, and multi-region scaling are explicit extension points. They are
not implied by the local mock provider or the development monitoring profile.
