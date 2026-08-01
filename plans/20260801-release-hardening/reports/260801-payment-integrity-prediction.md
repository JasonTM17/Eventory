---
title: Payment integrity prediction
status: caution
date: 2026-08-01
phase: 2
---

# Payment integrity prediction

## Evidence

- `BookingsService.create()` calls `PaymentsService.create()` before its
  database transaction and `Booking.holdId` is indexed but not unique.
- `handlePaymentWebhook()` checks a Redis hold before writing a
  `PaymentEvent`, and the non-pending branch can overwrite a confirmed booking.
- `IdempotencyRecord` stores only a response and expiry; it has no request
  fingerprint or explicit stale-key outcome.
- `CheckoutPanel` keys browser idempotency by event session rather than hold.

## Verdict: CAUTION

Proceed with a durable checkout claim and explicit state machine, but do not
pick an automatic financial outcome for a captured payment after expiry without
the repository owner's decision.

## Five-perspective review

| Perspective      | Finding                                                                                        | Required guardrail                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Architecture     | Redis holds are temporary coordination, not a durable checkout identity.                       | Unique `Booking.holdId`; commit booking/payment claim before provider work.                                         |
| Security         | A client key or webhook order cannot prove payment intent.                                     | Bind idempotency keys to a server-derived request fingerprint; verify and persist provider events first.            |
| Performance      | A provider call inside a database transaction would hold locks across the network.             | Persist claim, then acquire a short database attempt lease and call the provider outside the transaction.           |
| UX               | A duplicate request can arrive while payment initialization is in progress.                    | Return the same booking and make the checkout UI handle a pending provider initialization safely.                   |
| Devil's advocate | Moving all provider work to the outbox now couples Phase 2 to the worker hardening in Phase 3. | Keep the synchronous path, but make it recoverable through a stable provider idempotency identity and lease expiry. |

## Proposed technical boundary

1. Add a forward-only unique invariant for `Booking.holdId`, with a migration
   preflight that fails with remediation instructions if duplicates exist.
2. Persist a booking and payment checkout claim in one transaction before any
   provider call. Store a stable provider idempotency identity and attempt
   lease/state on `Payment`.
3. Claim the provider-attempt lease atomically; the lease holder invokes the
   provider outside the transaction. Retrying after a crash uses the same
   provider identity and cannot create a second provider charge.
4. Bind a client idempotency record to the canonical event session, sorted seat
   IDs, and hold identity. Reject a reused key with a different fingerprint;
   reject expired keys rather than replaying stale JSON.
5. Insert/deduplicate the provider event before any hold/expiry decision. Use
   one transition helper so `CONFIRMED` cannot regress. Persist an ignored or
   reconciliation disposition for every valid late event.
6. Scope the browser key to `holdId`, not the event session.

## Probe findings

| Domain     | Question                                                                                                                                                    | Why it matters                                                                 | Next step                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| Billing    | When a provider reports first success after the seat hold has expired, should Eventory automatically refund/void or create an operator reconciliation case? | Determines customer outcome, booking/payment statuses, and operator workflow.  | DECIDE                                  |
| Billing    | Are refund, cancellation, and chargeback webhooks explicitly unsupported in the mock release?                                                               | Prevents the API from implying production financial coverage it does not have. | DECIDE                                  |
| Operations | Which external provider guarantees an idempotency key and status lookup after a timeout?                                                                    | A crash-safe recovery path depends on provider contract.                       | DECIDE before real provider integration |
| Migration  | Does any non-local database contain duplicate `bookings.holdId` values?                                                                                     | A unique invariant must not silently discard historical records.               | TEST before deploy                      |
| UX         | Should a request while provider initialization is leased return 202/polling or wait briefly for the same booking?                                           | Defines public API and checkout UI behavior under concurrency.                 | DECIDE during implementation            |

## Recommendation

Implement the durable claim, request-fingerprint, provider-attempt lease, and
monotonic webhook transitions now. Default no real-provider refund behavior to
an operator-visible reconciliation record only if the owner approves that
policy; do not silently auto-refund or fulfill a late capture.

## Unresolved questions

- Late-capture policy: automatic void/refund or manual reconciliation?
- Mock release boundary: explicitly reject/document refunds, cancellations, and
  chargebacks, or model supported behavior now?
