---
title: Eventory release hardening
description: >-
  Close verified security, payment-integrity, CI, and public-repository
  readiness gaps before presenting Eventory as release-ready.
status: in-progress
priority: P1
effort: 4-6 days
branch: main
tags:
  - bugfix
  - security
  - backend
  - database
  - infra
  - docs
  - critical
blockedBy: []
blocks: []
created: '2026-08-01T12:11:37.831Z'
createdBy: 'ck:plan'
source: skill
---

# Eventory release hardening

## Overview

Eventory has a credible modular-monolith foundation, but a CK adversarial review
verified release blockers: login CSRF, duplicate checkout attempts for one seat
hold, provider side effects before a durable checkout claim, and non-monotonic
payment webhook transitions. A fresh GitHub Actions run on `main` is also red
because a clean checkout typecheck cannot resolve the generated
`@eventory/config` declarations. This plan fixes those facts first, then makes
integration validation deterministic and only then polishes the public
repository.

Production release remains blocked until phases 1–3 meet their acceptance
criteria and the unresolved financial-reconciliation and QR-rotation decisions
are explicitly resolved. Phase 4 is intentionally optional for runtime safety.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Session security](./phase-01-session-security.md) | Completed |
| 2 | [Booking and payment integrity](./phase-02-booking-and-payment-integrity.md) | Completed |
| 3 | [Operational resilience](./phase-03-operational-resilience.md) | In Progress |
| 4 | [Portfolio polish](./phase-04-portfolio-polish.md) | In Progress |

## Dependencies

- Existing `plans/20260801-eventory-platform/` is completed; no active plan
  overlaps this remediation work.
- Phase 1 and Phase 2 can be implemented independently, but Phase 3 must
  validate their final contracts before green-lighting release.
- Phase 4 requires a green CI run and a real public demo URL before setting a
  GitHub homepage.

## Release Acceptance Criteria

- [x] Cross-origin cookie-issuing auth mutations are rejected and covered by an
  E2E regression test.
- [x] A valid seat hold maps to one durable checkout and one provider attempt.
- [x] The durable checkout claim commits before any external provider side
  effect, with an idempotent recovery path for an unknown provider outcome.
- [x] Webhook duplicates and out-of-order events cannot regress confirmed state.
- [x] A first successful payment received after expiry has a durable fulfillment
  or compensation disposition, audit record, and operator-visible signal.
- [x] Schema changes are forward-only, duplicate-safe, and rehearsed before
  enforcing a new checkout invariant.
- [ ] A clean GitHub runner completes typecheck, migration, tests, web build,
  audit, Compose validation, and image builds.
- [x] Integration tests use an explicit Compose-backed database/Redis target and
  cannot mutate an unrelated local service at default host ports.
- [x] WebSocket connections are rejected at handshake for disallowed origins and
  bounded per socket/IP according to the stated public-seat-data policy.
- [x] Outbox claim failures are logged, metered, retried without overlapping
  worker cycles, and covered by a focused regression.
- [x] The public README accurately communicates the demo scope and has visual
  proof only after the release gate is green.

The local release gate is green for the current worktree. The unchecked CI
criterion is intentionally limited to a new remote run for these unpushed
commits; the latest observed `main` run predates this work.

## Commit Boundaries

1. `fix(auth): block cross-origin session issuance`
2. `fix(bookings): persist one checkout claim per seat hold`
3. `fix(payments): recover provider intents and enforce state transitions`
4. `fix(ci): build workspace dependencies before typecheck`
5. `test(integration): isolate compose-backed verification`
6. `fix(workers): guard outbox processing failures`
7. `fix(realtime): enforce seating gateway handshakes`
8. `docs(readme): add verified project showcase`

## Unresolved Questions

- Which public deployment URL should become the GitHub homepage after a verified
  environment exists?
- Which license does the repository owner want to publish? Do not add one until
  that choice is explicit.
- For a captured payment that arrives after seat-hold expiry, should the product
  automatically void/refund when the provider supports it, or create an
  operator-reconciliation workflow? This is a financial product decision.
- Is live seat availability intentionally public? The answer determines whether
  a valid authenticated session is required at the WebSocket handshake.
- Does the next real-release scope require compatible QR key rotation, or must
  operations prohibit key/secret rotation while any ticket remains valid?
- Are refunds and chargebacks part of the current payment contract, or explicitly
  unsupported until a real payment-provider integration plan is approved?

## Red Team Review

### Session — 2026-08-01

**Findings:** 11 (10 accepted, 1 scope decision pending)
**Severity breakdown:** 2 Critical, 8 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Provider call precedes durable checkout claim | Critical | Accept | Phase 2 |
| 2 | Late captured payment lacks compensation path | Critical | Accept | Phase 2, Phase 3 |
| 3 | Webhook and expiry writers lack one transition contract | High | Accept | Phase 2, Phase 3 |
| 4 | Unique-hold migration needs staged forward rollout | High | Accept | Phase 2 |
| 5 | All session-cookie routes need origin coverage | Medium | Accept | Phase 1 |
| 6 | Checkout key must be hold-scoped | High | Accept | Phase 2 |
| 7 | Test target must be an owned dependencies-only environment | High | Accept | Phase 3 |
| 8 | Outbox claim failures need guarded worker handling | High | Accept | Phase 3 |
| 9 | WebSocket enforcement must occur at handshake | High | Accept | Phase 3 |
| 10 | Refund/chargeback terminality needs a declared contract | High | Accept | Phase 2 |
| 11 | QR rotation needs a product/operations decision | High | Pending decision | Phase 3 |

### Whole-Plan Consistency Sweep

- Files reread after applying the accepted findings: `plan.md`, all four phase
  files.
- Decision deltas reconciled: provider ordering, late-capture compensation,
  transition atomicity, migration rollout, auth-route coverage, test ownership,
  worker resilience, handshake enforcement, and checkout-key scope.
- Unresolved contradictions: 0. Product decisions remain explicitly listed
  above and block a production-ready claim, not plan execution of the other
  corrective work.

## Verification snapshot — 2026-08-03

- Phase 2: durable hold/provider claims, monotonic webhook transitions, late
  capture reconciliation, and idempotency regressions pass; clean and duplicate
  migration rehearsals also pass.
- Phase 3: `pnpm test:integration` passes against an owned dynamic Compose
  project with 17 suites, 46 tests, and 0 failures; the native WebSocket origin
  test is included. Typecheck, lint, format, web build, audit, DB validation,
  and Compose config validation pass locally.
- Portfolio: two screenshots were captured from the seeded local product and
  linked from README. No public URL, license, or GitHub metadata was invented.
- Remote GitHub CI for the unpushed commits is not verified; keep that release
  criterion open until the owner authorizes a push or runs it externally.
