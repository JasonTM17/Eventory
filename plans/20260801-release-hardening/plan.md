---
title: Eventory release hardening
description: >-
  Close verified security, payment-integrity, CI, and public-repository
  readiness gaps before presenting Eventory as release-ready.
status: completed
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

Eventory entered this plan with verified release blockers in session security,
booking/payment integrity, clean-checkout CI, and operational resilience. Those
delivery criteria are now implemented and verified. Remaining real-provider and
hosted-operations decisions limit production-deployment claims, not completion
of this repository hardening plan.

Production release remains blocked until phases 1–3 meet their acceptance
criteria and the unresolved financial-reconciliation and QR-rotation decisions
are explicitly resolved. Phase 4 is intentionally optional for runtime safety.
The user-authorized follow-up expands Phase 4 with reproducible product media
and published architecture artifacts, adds Phase 12 for package delivery
verification and remote CI evidence, and adds Phase 13 for explicitly requested
Docker Hub publication after those gates pass. It does not invent a public
deployment or license.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Session security](./phase-01-session-security.md) | Completed |
| 2 | [Booking and payment integrity](./phase-02-booking-and-payment-integrity.md) | Completed |
| 3 | [Operational resilience](./phase-03-operational-resilience.md) | Completed |
| 4 | [Portfolio polish](./phase-04-portfolio-polish.md) | Completed |
| 12 | [Package delivery verification](./phase-12-package-delivery-verification.md) | Completed |
| 13 | [Docker Hub image publication](./phase-13-docker-hub-publication.md) | Completed |

## Dependencies

- Existing `plans/20260801-eventory-platform/` is completed; no active plan
  overlaps this remediation work.
- Phase 1 and Phase 2 can be implemented independently, but Phase 3 must
  validate their final contracts before green-lighting release.
- Phase 4 requires a green CI run and a real public demo URL before setting a
  GitHub homepage.
- Phase 12 consumes the media/docs completed in Phase 4, adds a shared-package
  tarball gate, then pushes the verified `main` history and records the remote
  workflow result.
- Phase 13 consumes Phase 12's verified commit and CI evidence, then publishes
  only the explicitly authorized Docker Hub API/web images.

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
- [x] A clean GitHub runner completes typecheck, migration, tests, web build,
  audit, Compose validation, and image builds.
- [x] Integration tests use an explicit Compose-backed database/Redis target and
  cannot mutate an unrelated local service at default host ports.
- [x] WebSocket connections are rejected at handshake for disallowed origins and
  bounded per socket/IP according to the stated public-seat-data policy.
- [x] Outbox claim failures are logged, metered, retried without overlapping
  worker cycles, and covered by a focused regression.
- [x] The public README accurately communicates the demo scope and has visual
  proof only after the release gate is green.
- [x] README includes a short real-product GIF and exported architecture
  diagrams without secrets, PII, local file paths, or production claims.
- [x] Shared workspace-package dry runs contain only intentional publishable
  files and run in local and GitHub Actions validation.
- [x] The verified `main` history is pushed to `origin/main` and its new GitHub
  Actions validation result is recorded.
- [x] Verified API and web images are published to Docker Hub with semantic and
  full-SHA tags and recorded immutable digests.

Local gates and GitHub Actions run `30870326422` are green for source commit
`635256c29f9be517a6444f36728c9ebd2647ef8c`. Release workflow run `30869248045`
published `v0.1.2` from `c3abeb64013fa88dc80b3550591462b2e4bdbd25` to
Docker Hub and GHCR with matching immutable digests. Remaining product questions
below limit production-deployment claims, not this delivery.

## Commit Boundaries

1. `fix(auth): block cross-origin session issuance`
2. `fix(bookings): persist one checkout claim per seat hold`
3. `fix(payments): recover provider intents and enforce state transitions`
4. `fix(ci): build workspace dependencies before typecheck`
5. `test(integration): isolate compose-backed verification`
6. `fix(workers): guard outbox processing failures`
7. `fix(realtime): enforce seating gateway handshakes`
8. `docs(readme): add verified project showcase`
9. `build(packages): verify shared package payloads`
10. `docs(showcase): add real media and architecture artifacts`
11. `fix(realtime): return browser CORS headers for trusted seating sockets`

## Unresolved Questions

- Which public deployment URL should become the GitHub homepage after a verified
  environment exists?
- For a captured payment that arrives after seat-hold expiry, should the product
  automatically void/refund when the provider supports it, or create an
  operator-reconciliation workflow? This is a financial product decision.
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
| 4 | Unique-hold migration needs staged forward rollout | High | Accept | Completed |
| 5 | All session-cookie routes need origin coverage | Medium | Accept | Phase 1 |
| 6 | Checkout key must be hold-scoped | High | Accept | Phase 2 |
| 7 | Test target must be an owned dependencies-only environment | High | Accept | Phase 3 |
| 8 | Outbox claim failures need guarded worker handling | High | Accept | Phase 3 |
| 9 | WebSocket enforcement must occur at handshake | High | Accept | Phase 3 |
| 10 | Refund/chargeback terminality needs a declared contract | High | Accept | Phase 2 |
| 11 | QR rotation needs a product/operations decision | High | Resolved with versioned keyring | Phase 3 |

### Whole-Plan Consistency Sweep

- Files reread after applying the accepted findings: `plan.md`, all four phase
  files.
- Decision deltas reconciled: provider ordering, late-capture compensation,
  transition atomicity, migration rollout, auth-route coverage, test ownership,
  worker resilience, handshake enforcement, and checkout-key scope.
- Unresolved contradictions: 0. Product decisions remain explicitly listed
  above and block a production-ready claim, not plan execution of the other
  corrective work.

## Verification snapshot — 2026-08-04

- Phase 2: durable hold/provider claims, monotonic webhook transitions, late
  capture reconciliation, and idempotency regressions pass; clean and duplicate
  migration rehearsals also pass.
- Phase 3: all 17 API suites and 47 tests pass against an owned dynamic Compose
  project; native WebSocket and browser-polling origin tests are included.
  Typecheck, lint, format, web build, audit, DB validation, and Compose config
  validation pass locally.
- Portfolio: three screenshots and one short GIF were captured from the seeded
  local product; two architecture/lifecycle diagrams were exported as SVG and
  PNG. No public URL or GitHub homepage was invented; the repository now uses
  the explicitly selected MIT License.
- Remote GitHub CI run `30870326422` passed all gates for source commit
  `635256c29f9be517a6444f36728c9ebd2647ef8c`.
- Release workflow run `30869248045` published `v0.1.2` from `c3abeb6` to both
  registries with matching API/web digests, provenance, and SBOM attestations.

## Follow-up scope — 2026-08-03

- Phase 4 now owns a current-source isolated Compose capture, a short GIF
  assembled only from real product frames, a ticket-wallet screenshot, and
  exported SVG/PNG diagrams that match the documented runtime and ticket flow.
- Phase 12 owns shared-package payload allow-lists, a root `package:check`
  command, matching CI gates, full local validation, commit/push, and remote
  workflow evidence.
- Out of scope: publishing npm packages, setting a GitHub homepage without a
  verified deployment, deploying a public environment, or replacing the mock
  payment provider. The repository uses the MIT License; Docker Hub and GHCR
  publication completed through Phase 13 and the `v0.1.2` release workflow.
