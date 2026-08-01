---
phase: 12
title: 'Hardening'
status: completed
effort: '1 day'
---

# Phase 12: Hardening

## Overview

Harden the platform for adversarial input and operations: rate limits, security headers, CSRF/CORS, audit coverage, structured metrics, queue/database/Redis health, and complete API/E2E/concurrency verification.

## Requirements

- Functional: sensitive routes are rate-limited; security headers and CORS allowlist are enforced; metrics expose latency/errors/booking/payment/holds/check-ins/queue depth; critical journeys run end-to-end.
- Non-functional: threat model covers credential stuffing, BOLA, race/replay, forgery, XSS/CSRF, injection, enumeration, bypass, and escalation; logs redact secrets/PII.

## File inventory

| Action | Paths                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `apps/api/src/common/security/`, `apps/api/src/common/observability/`, metrics tests, E2E fixtures                                                                          |
| Create | `docs/security/threat-model.md`, `docs/testing/test-strategy.md`, `docs/runbooks/redis-unavailable.md`, `docs/runbooks/database-unavailable.md`, monitoring compose profile |

## Architecture

Security controls are enforced at API boundaries and documented as defense-in-depth. Metrics use low-cardinality labels and correlation IDs; readiness reflects dependency state. E2E tests exercise real API/web contracts with deterministic seed data.

## Implementation Steps

1. Add global throttling, body/request-size limits, security headers, CORS allowlist, CSRF checks, and safe production error handling.
2. Expand audit logging for auth, booking, payment, check-in, and admin actions.
3. Add metrics/tracing hooks and optional Prometheus/Grafana development profile.
4. Write threat model and operational runbooks.
5. Add API integration, concurrency, and critical booking/check-in E2E journeys; run full type/lint/build/test matrix.

## Implementation checklist

- [x] Global rate limits cover authentication, holds, checkout, webhooks, check-in, and admin mutation routes.
- [x] Helmet, CORS allowlist, Origin-based cookie CSRF defense, DTO validation, and JSON/form body limits are active in `main.ts`/global guards.
- [x] Auth, booking, payment webhook, check-in, and admin actions leave audit evidence; request/response secrets are redacted.
- [x] Metrics expose bounded HTTP latency/errors plus booking, payment, hold, check-in, and outbox gauges; readiness covers PostgreSQL and Redis.
- [x] Threat model, testing strategy, dependency runbooks, observability guide, and local Prometheus/Grafana profile are documented.
- [x] Security and concurrency tests pass with real PostgreSQL/Redis/Mailpit dependencies.

## Verification

- `pnpm --filter @eventory/config build`
- `pnpm --filter @eventory/api typecheck`
- `node --require ts-node/register --test test/rate-limit.guard.test.ts`
- `node --require ts-node/register --test test/security.e2e.test.ts`
- `node --require ts-node/register --test test/identity.e2e.test.ts test/booking.e2e.test.ts test/check-in.e2e.test.ts test/outbox.e2e.test.ts`
- `docker compose --profile monitoring config`

## Docs impact

Major: security, testing, runbook, observability, and local monitoring documentation added.

## Test scenario matrix

| Scenario              | Expected result                                                |
| --------------------- | -------------------------------------------------------------- |
| Login burst           | 429 after configured threshold with safe response.             |
| Cross-origin mutation | Rejected unless origin allowlisted and CSRF valid.             |
| Production error      | No stack trace, password, token, signature, or payment secret. |
| Full journey          | Register/login → publish → hold → pay → QR → check-in passes.  |
| Dependency outage     | Readiness/metrics/runbook reflect degraded state.              |

## Success Criteria

- [x] Threat model and runbooks are complete and verified against code.
- [x] Focused quality gates pass with deterministic data; full repository gates remain in the delivery phase.
- [x] Security review has no unresolved critical findings at this phase.

## Dependency map

Depends on all previous phases; unblocks delivery packaging and release.

## Risk Assessment

Rate limits and CSRF settings must be configurable per environment without weakening production defaults. E2E tests must not depend on external payment or email providers.
