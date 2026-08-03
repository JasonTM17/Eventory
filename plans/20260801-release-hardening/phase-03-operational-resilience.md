---
phase: 3
title: 'Operational resilience'
status: in-progress
priority: P1
effort: '1-2d'
dependencies: [1, 2]
---

# Phase 3: Operational resilience

## Overview

Make verification reproducible from a clean checkout and close remaining
availability/operations gaps that would obscure a real regression. This phase
includes the red GitHub Actions typecheck, local Compose test-target ambiguity,
outbox test flakiness and worker failure handling, pending-booking
reconciliation, late-capture operations, and public seating gateway hardening.

## Requirements

- `pnpm typecheck` must work on a clean runner without stale `dist/` files.
- Integration tests must use an owned dependencies-only Compose target, the
  existing `eventory_test` database, dynamic published-port propagation, and a
  sentinel check before migrations or tests.
- Test state must be isolated; an unrelated eligible outbox event must not make
  assertions flaky.
- Abandoned pending bookings must eventually reach a durable terminal/reconciled
  state.
- An outbox claim failure must be caught, logged, measured, backed off, and not
  overlap the next worker cycle.
- Seating WebSocket origins must be enforced at server handshake, with an
  explicit originless-client/public-seat-data policy and bounded connection/
  message pressure.
- QR rotation must have a release decision: compatible verification keyring, or
  an explicit operational prohibition/runbook until all affected tickets expire.

## Architecture

Turbo dependency edges must reflect emitted declaration dependencies, not only
no-emit typecheck order. The test command should receive one owned runtime
configuration source shared with a dependencies-only Compose project; it must
prove the selected database is `eventory_test` and the application/outbox worker
is not concurrently processing records. Durable booking expiry and late-payment
reconciliation use the Phase 2 transition helper, not incidental webhook
branches. Gateway HTTP CORS is supplemented by server-side Socket.IO handshake
enforcement; rate limiting belongs at the gateway/edge boundary.

## Related Code Files

- Modify: `turbo.json`, `packages/config/package.json`, and possibly root
  `package.json` — make declaration-producing workspace dependencies available
  to consumers in clean typecheck runs.
- Modify: `.github/workflows/main.yml` and `.github/workflows/pull-request.yml`
  — prove the chosen clean-checkout command; retain least-privilege permissions.
- Modify or create: `apps/api/package.json`, `scripts/`, `.env.example`, and
  `README.md` — one explicit, owned integration-test configuration path.
- Modify: `infrastructure/docker/postgres-init/001-create-test-database.sql` or
  the closest test-Compose configuration — preserve and assert the dedicated
  test database lifecycle.
- Modify or create: `apps/api/test/**` shared setup/teardown — isolate database,
  Redis, Mailpit, outbox state, and fault-injection scenarios.
- Modify: `apps/api/src/modules/bookings/bookings.service.ts`; create a small
  booking-expiry/reconciliation worker/module only where it fits existing module
  boundaries.
- Modify: `apps/api/src/modules/outbox/outbox.worker.ts` and
  `apps/api/src/modules/outbox/outbox.service.ts` — non-overlapping guarded
  processing, claim-failure observability, and retry/backoff.
- Modify: `apps/api/src/modules/seating/seating.gateway.ts` plus focused
  WebSocket-transport handshake and flood-control tests.
- Modify: `apps/api/src/modules/tickets/ticket-qr.service.ts` and security/deploy
  docs only if a versioned keyring is accepted; otherwise document the deferred
  limitation in `docs/security/threat-model.md`.

## Implementation Steps

1. Reproduce the CI failure in a clean worktree or clean build-output state.
   Map every package that consumes `@eventory/config` declarations before
   changing Turbo dependencies.
2. Apply the smallest graph/script change that makes a clean `pnpm typecheck`
   deterministic. Verify locally without pre-existing `packages/*/dist`, then
   push only after the GitHub workflow is green.
3. Add a dependencies-only test Compose target with a unique project/run ID.
   Discover ports with `docker compose port`, use the explicit `eventory_test`
   URL, wait for health, verify a database/Redis sentinel, and scope cleanup to
   that run. Never start the application/outbox worker for this target.
4. Fix test isolation before treating the suite as a release signal. Give each
   test run owned records or a reset namespace, make outbox assertions select
   only records created by that test, and prove an unrelated pending event cannot
   affect the result.
5. Add one non-overlapping, guarded outbox worker cycle. Catch claim failures,
   emit structured logs/metrics, apply bounded backoff, and test a rejected
   `claim()` without an unhandled promise.
6. Add a conditional pending-booking expiry/reconciliation worker using the
   Phase 2 transition helper. It must coordinate with late success webhooks,
   create exactly one fulfillment or compensation action, and alert operators.
7. Enforce the normalized origin allowlist at Socket.IO handshake (not CORS
   headers alone). Define missing-Origin and public-seat-data policy; add
   per-IP/socket connection and join/message limits with disconnect behavior and
   a hostile `transports: ['websocket']` test.
8. Decide QR key-rotation scope. Prefer a versioned verification keyring for a
   real deployment; otherwise implement and document a strict no-rotation-until-
   ticket-expiry runbook. Do not mark a production release green by documentation
   alone.

## Success Criteria

- [ ] A fresh clone/clean CI runner passes typecheck without prebuilt workspace
      declarations.
- [ ] GitHub Actions on `main` is green through tests, web build, audit, Compose
      validation, Docker builds, and artifact upload.
- [ ] API tests pass using the Compose services actually started for that run;
      intentionally wrong ports or a non-test database fail with a clear setup
      error, and no test mutates the normal `eventory` database.
- [ ] Repeated test runs are deterministic; the outbox test has no dependence on
      globally claimable stale records.
- [ ] A claim failure cannot create an unhandled worker rejection or overlapping
      processing cycle, and emits the expected log/metric signal.
- [ ] Expiry and late-payment paths use the shared transition contract and leave
      one consistent durable fulfillment or compensation state.
- [ ] Disallowed WebSocket origins are rejected before connection, including
      native WebSocket transport; allowed clients cannot exceed stated limits.
- [ ] QR rotation has either compatible verification coverage or an approved,
      tested operational prohibition/runbook.

## Risk Assessment

- Risk: a broad Turbo `^build` dependency increases CI time or introduces a
  cycle. Mitigation: inspect the graph first and add only declaration-producing
  dependencies required by typechecking.
- Risk: an expiry worker races with a real webhook. Mitigation: conditional
  updates/row locks in the shared Phase 2 transition helper plus synchronized
  race tests.
- Risk: test tooling deletes or connects to an unrelated local database.
  Mitigation: a unique Compose project, dynamic ports, a test-db sentinel, and
  cleanup restricted to project-owned resources.
- Risk: gateway origin changes break an intentionally public seating display.
  Mitigation: decide the public-data policy before implementation and test
  explicit allowed, denied, and originless handshakes.
- Risk: QR secret rotation invalidates active tickets.
  Mitigation: compatible keyring or a mandatory no-rotation runbook; do not rely
  on a prose disclaimer.

## Security Considerations

- Covers availability and misconfiguration risks (OWASP A05/A06/A09).
- Preserve masked secrets in CI logs and avoid putting connection strings in
  committed test helpers.

## Verification snapshot — 2026-08-03

Implemented and locally verified: clean typecheck dependency graph, owned
dependencies-only integration runner, guarded outbox/booking workers, gateway
handshake and pressure limits, and compatible QR signing key rotation. The
integration suite cannot run on the current workstation because Docker
Desktop's Linux engine is unavailable; keep the phase open until CI or a
working Docker host confirms the full API suite.
