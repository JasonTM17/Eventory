---
title: Eventory production-ready ticketing platform
description: >-
  Build Eventory as a production-oriented modular monolith with a Next.js web
  app, NestJS API, reliable seat booking, simulated payments, signed tickets,
  security controls, tests, and delivery automation.
status: pending
priority: P1
branch: feature/eventory-platform
tags:
  - feature
  - frontend
  - backend
  - database
  - api
  - auth
  - infra
  - critical
blockedBy: []
blocks: []
created: '2026-08-01T05:47:26.413Z'
createdBy: 'ck:plan'
source: skill
---

# Eventory production-ready ticketing platform

## Overview

Eventory will be implemented from the supplied specification as one cohesive portfolio-grade ticketing platform. The repository is currently empty apart from project instructions, so the first phase establishes the workspace and documentation before any business code is added.

### Architecture decisions

- **Repository:** pnpm workspaces + Turborepo, with `apps/web`, `apps/api`, and focused shared packages.
- **Backend:** NestJS modular monolith. Modules own their domain rules and communicate through application contracts; no unnecessary network microservices.
- **Persistence:** PostgreSQL is the source of truth. Prisma migrations and explicit transactions protect booking, payment, ticket, and check-in invariants.
- **Ephemeral coordination:** Redis stores short-lived seat holds and BullMQ jobs. Redis is never treated as permanent seat ownership.
- **Web:** Next.js App Router with server components by default, typed API contracts, accessible responsive UI, and WebSocket updates only for interactive seating.
- **Authentication:** Rotating refresh sessions in secure HttpOnly cookies, Argon2id password hashing, CSRF protection for cookie-mutating requests, and backend-first authorization.
- **Integration seams:** `PaymentProvider`, `EmailProvider`, QR signing, and job dispatch are explicit ports with local implementations (`MockPaymentProvider`, Mailpit adapter).
- **Reliability:** transactional outbox records are written with business mutations; workers perform retryable side effects idempotently.

### Scope boundary

The first release implements the complete local/demo journey: register/login, organizer event publishing, attendee seat reservation, simulated payment callbacks, signed QR tickets, organizer check-in, notifications, analytics/admin views, security hardening, tests, Docker Compose, CI, and operational docs. Real payment settlement, offline check-in, production cloud deployment, and third-party identity providers remain documented extension points rather than release blockers.

### Execution and commit policy

Phases are sequential because schema and contract changes are dependencies. Every logically complete slice is validated before a focused Conventional Commit; no blanket `git add .`, no empty commits, and no commit mixes unrelated domains. Each commit report records the hash, message, changed modules, checks, result, and next slice.

### Definition of done

- A new developer can run the documented setup from an empty database.
- Migrations and deterministic seed data produce a usable demo scenario.
- Core booking invariants hold under duplicate requests and concurrency tests.
- API, web, workers, infrastructure, security, observability, CI, and documentation are all represented by executable checks or verified artifacts.
- `format`, `lint`, `typecheck`, unit/integration/API/E2E checks, and production builds pass for the supported local toolchain.

## Phases

| Phase | Name                                                                       | Status    |
| ----- | -------------------------------------------------------------------------- | --------- |
| 1     | [Repository foundation](./phase-01-repository-foundation.md)               | Completed |
| 2     | [Local infrastructure](./phase-02-local-infrastructure.md)                 | Completed |
| 3     | [NestJS foundation](./phase-03-nestjs-foundation.md)                       | Completed |
| 4     | [Identity and authorization](./phase-04-identity-and-authorization.md)     | Completed |
| 5     | [Event management](./phase-05-event-management.md)                         | Completed |
| 6     | [Frontend foundation](./phase-06-frontend-foundation.md)                   | Completed |
| 7     | [Seat reservation](./phase-07-seat-reservation.md)                         | Completed |
| 8     | [Booking and payment](./phase-08-booking-and-payment.md)                   | Completed |
| 9     | [Outbox and notifications](./phase-09-outbox-and-notifications.md)         | Completed |
| 10    | [Tickets and check-in](./phase-10-tickets-and-check-in.md)                 | Completed |
| 11    | [Analytics and administration](./phase-11-analytics-and-administration.md) | Completed |
| 12    | [Hardening](./phase-12-hardening.md)                                       | Pending   |
| 13    | [Delivery](./phase-13-delivery.md)                                         | Pending   |

## Dependencies

No cross-plan dependencies. This plan owns the empty repository and should be executed sequentially on `feature/eventory-platform`.

## Validation gates

1. **Per commit:** format, lint, typecheck, and the narrowest relevant tests; staged secret scan; clean diff except intentional files.
2. **Per phase:** API/web builds where applicable, database migration/seed smoke test, and phase-specific unit/integration/concurrency checks.
3. **Before delivery:** full test matrix, Docker Compose health check, CI workflow validation, adversarial code review, docs/link validation, and a final working-tree audit.

## Risks and mitigations

| Risk                    | Mitigation                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Seat race conditions    | Atomic Redis Lua hold operation plus PostgreSQL uniqueness/transaction constraints and concurrency tests.                     |
| Payment callback replay | Signed webhook verification, provider-event idempotency records, state transition guard, and outbox event.                    |
| Authorization gaps      | Policy guards plus resource ownership checks in application services; API tests for cross-user and cross-organization access. |
| Schema drift            | Prisma migrations from the first schema, deterministic seed, and CI migration validation.                                     |
| Scope explosion         | Keep integrations behind ports; defer real gateways, offline mode, and cloud deployment while retaining documented seams.     |
| Local setup friction    | Compose health checks, `.env.example`, scripts, and README smoke path tested from a clean install.                            |
