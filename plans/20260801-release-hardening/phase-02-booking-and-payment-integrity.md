---
phase: 2
title: Booking and payment integrity
status: completed
priority: P1
effort: 1-2d
dependencies: []
---

# Phase 2: Booking and payment integrity

## Overview

Make checkout and payment state a monotonic, idempotent, recoverable workflow.
A single Redis hold can currently create multiple `PENDING` bookings when
clients omit the optional idempotency key, and both calls can reach the provider
before a database invariant exists. Webhook processing can also fail retries
after a hold expires or regress a confirmed booking on a late failure event.

## Requirements

- Commit one durable checkout claim per valid hold before any external provider
  side effect.
- Persist a provider idempotency identity and recovery state for "provider
  outcome unknown after process failure".
- Make client idempotency records expire and bind each key to the original
  request fingerprint.
- Deduplicate provider events before hold-dependent confirmation work.
- Permit only valid payment/booking state transitions; late events are recorded
  without changing a terminal successful state.
- Define a durable fulfillment or compensation path for a first successful
  payment received after expiry; it must not be merely ignored.
- Define refund/cancellation/chargeback terminality. If unsupported for the mock
  scope, reject and document it explicitly rather than implying production
  coverage.
- Preserve atomic sale allocation and ticket issuance behavior.

## Architecture

The durable database, not Redis, owns the permanent checkout invariant. Redis
continues to establish an expiring temporary hold; a transaction first claims
that hold with a stable checkout/booking identity, then a recoverable command or
job invokes the provider with that durable identity as its idempotency key. A
crash between those steps must reconcile rather than create a second charge.

Webhook handling becomes an event-first transaction: atomically recognize the
provider event, acquire the booking transition under one shared compare-and-set
or row-lock protocol, then either transition once, compensate a late capture,
or record the event as ignored. The expiry worker introduced in Phase 3 must use
the same transition contract; no writer may independently overwrite terminal
booking/payment state.

## Related Code Files

- Modify: `apps/api/prisma/schema.prisma` and a new Prisma migration — enforce
  the one-checkout-per-hold invariant and any idempotency metadata needed.
- Modify: `apps/api/src/modules/bookings/bookings.service.ts` — atomic booking
  claim creation, provider recovery, idempotency semantics, expiry/retry
  behavior, and webhook state machine.
- Modify: `apps/api/src/modules/bookings/booking.dto.ts` — validate any newly
  required client idempotency contract only after preserving backward migration.
- Modify: `apps/api/src/modules/payments/payment-provider.ts` and
  `apps/api/src/modules/payments/payments.service.ts` if provider idempotency is
  added to the adapter contract; include a controlled test double for crash and
  retry behavior.
- Modify: `apps/api/src/modules/outbox/outbox.service.ts` or the smallest
  existing durable-command boundary if provider invocation moves behind a
  committed checkout claim.
- Modify: `apps/api/test/booking.e2e.test.ts`; create focused webhook-state
  tests if the existing file becomes unclear.
- Modify: `apps/web/src/components/checkout-panel.tsx` — scope its checkout key
  to the server-issued hold and rotate/clear it when the hold changes.

## Implementation Steps

1. Write regressions before changing behavior: concurrent no-key booking creates
   for one hold; provider timeout/crash after a durable claim; same key with a
   mismatched payload; retry after record expiry; duplicate success after hold
   expiry; first success after expiry; success followed by a distinct failure;
   and two distinct holds in one event session.
2. Design a staged forward-only migration: query/repair duplicate hold records,
   add compatible data/indexes, deploy writers, create the invariant using a
   low-lock strategy where supported, validate, then enforce. Document recovery
   for a partially applied migration; do not promise a blind rollback.
3. Refactor booking creation so a transaction creates or retrieves one durable
   checkout claim for a hold regardless of client key, verifies actor/session/
   seat fingerprint, persists provider idempotency/recovery data, and commits
   before any provider call.
4. Store a request fingerprint with client idempotency records. Expire or reject
   stale/mismatched keys atomically rather than returning arbitrary old JSON.
   Update the checkout panel to make its key hold-scoped.
5. Refactor webhook processing to deduplicate provider events before hold checks
   and call one shared transition helper. Persist event state, booking/payment
   transition, ticket/outbox effect, and late-capture compensation or
   reconciliation action atomically. Never mutate `CONFIRMED` back to
   `PAYMENT_FAILED`.
6. Define the supported refund/cancellation/chargeback transition table. For
   unsupported mock events, reject/document the boundary; for supported refunds,
   include ticket revocation and outbox/audit effects.
7. Verify ticket counts, seat allocations, audit records, compensation actions,
   and outbox events for happy paths, late captures, and rejected transitions.

## Success Criteria

- [x] Two requests for the same hold yield one durable checkout and one provider
      attempt, including a crash/retry window between claim and provider call.
- [x] A retried webhook acknowledges its already-recorded provider event even
      after its Redis hold expires.
- [x] A first successful payment after expiry creates exactly one durable
      fulfillment or compensation/reconciliation action and never strands a
      captured payment.
- [x] A later non-success event cannot downgrade confirmed booking/payment state.
- [x] Idempotency reuse with a different request is rejected, not replayed.
- [x] The checkout panel creates distinct idempotency identities for distinct
      holds in the same event session.
- [x] Prisma migration is rehearsed against duplicate data, validates on a clean
      database, and integration tests cover all supported state transitions.

## Verification snapshot — 2026-08-03

- The booking E2E suite covers concurrent no-key checkout, provider recovery,
  duplicate/out-of-order webhooks, late capture reconciliation, and idempotency
  mismatch behavior.
- `pnpm test:integration` passes with 17 suites, 46 tests, and 0 failures on
  the isolated Compose target.
- Clean migration deployment and duplicate-hold preflight rehearsals pass;
  duplicate data is rejected before the unique invariant is enforced.

## Risk Assessment

- Risk: provider success is unknown when a process dies after the request.
  Mitigation: durable provider idempotency, a reconciliation worker, operator
  alerting, and a tested recovery path.
- Risk: an incorrect uniqueness migration blocks valid historical data.
  Mitigation: preflight duplicate query, backup, staged forward rollout, and a
  documented partial-migration remediation path.
- Risk: changing provider adapter contracts breaks mock tests.
  Mitigation: update the interface, mock, and fault-injection test double in the
  same focused commit, then run all booking/payment tests.
- Rollback: after an invariant is deployed, use a forward corrective migration;
  code rollback alone is insufficient.

## Security Considerations

- Covers OWASP A04/A08 and integrity/replay/financial-reconciliation risks.
- Never trust client totals, client idempotency keys, or webhook order as proof
  of payment state.
