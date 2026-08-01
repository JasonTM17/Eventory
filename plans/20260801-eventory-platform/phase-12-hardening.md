---
phase: 12
title: 'Hardening'
status: pending
effort: ''
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

## Test scenario matrix

| Scenario              | Expected result                                                |
| --------------------- | -------------------------------------------------------------- |
| Login burst           | 429 after configured threshold with safe response.             |
| Cross-origin mutation | Rejected unless origin allowlisted and CSRF valid.             |
| Production error      | No stack trace, password, token, signature, or payment secret. |
| Full journey          | Register/login → publish → hold → pay → QR → check-in passes.  |
| Dependency outage     | Readiness/metrics/runbook reflect degraded state.              |

## Success Criteria

- [ ] Threat model and runbooks are complete and verified against code.
- [ ] Full quality gates pass with deterministic data.
- [ ] Security review has no unresolved critical findings.

## Dependency map

Depends on all previous phases; unblocks delivery packaging and release.

## Risk Assessment

Rate limits and CSRF settings must be configurable per environment without weakening production defaults. E2E tests must not depend on external payment or email providers.
