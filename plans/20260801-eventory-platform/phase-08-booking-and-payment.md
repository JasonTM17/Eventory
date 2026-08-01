---
phase: 8
title: 'Booking and payment'
status: completed
effort: 1 session
---

# Phase 8: Booking and payment

## Overview

Implement booking lifecycle, immutable price snapshots, idempotent confirmation, a payment-provider port with a signed mock provider/webhook, rollback-safe transactions, and attendee checkout.

## Requirements

- Functional: pending booking creation derives totals server-side; mock payments support success/failure/delay; duplicate callbacks are safe; successful confirmation issues tickets/outbox records atomically.
- Non-functional: minor-unit money, provider reference uniqueness, idempotency scope, timeout handling, and no synchronous email inside the payment transaction.

## File inventory

| Action | Paths                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `apps/api/src/modules/bookings/`, `apps/api/src/modules/payments/`, payment provider ports/adapters, migrations, API/concurrency tests         |
| Modify | `apps/api/src/modules/seating/`, `packages/contracts/`, `apps/web` checkout routes                                                             |
| Create | `docs/architecture/payment-sequence.md`, `docs/adr/ADR-007-mock-payment-provider.md`, `docs/adr/ADR-004-postgresql-booking-source-of-truth.md` |

## Architecture

Booking confirmation runs one PostgreSQL transaction: validate idempotency key and hold ownership/expiry, lock relevant seats, re-check sold uniqueness, create tickets/payment history/outbox event, and transition booking/payment. Webhook requests only validate and enqueue/perform the minimal idempotent state mutation; slow notifications are worker work.

## Implementation Steps

1. Add booking, booking item, payment, payment history, and idempotency models with money/index constraints.
2. Implement booking creation, server total calculation, expiry/cancellation rules, and ownership queries.
3. Define `PaymentProvider`; implement mock create/query/refund and HMAC-signed webhook verification.
4. Implement idempotent confirmation transaction and failure/timeout state transitions.
5. Add checkout/payment UI with bounded polling or event updates and clear retry states.
6. Add unit/integration/concurrency/rollback/webhook-idempotency tests.

## Test scenario matrix

| Scenario                    | Expected result                                     |
| --------------------------- | --------------------------------------------------- |
| Client tampers total        | Server ignores client total and uses snapshots.     |
| Duplicate confirmation key  | Same result returned; no duplicate tickets/payment. |
| Duplicate webhook           | No duplicate state transition or side effect.       |
| Hold expires during payment | Confirmation fails safely; no sold ticket.          |
| DB rollback                 | No partial booking/ticket/payment/outbox records.   |

## Success Criteria

- [x] Price and fee calculations use integer minor units/decimal, never float.
- [x] Payment webhook signatures and provider references are validated.
- [x] Concurrent confirmation cannot oversell a seat.

## Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @eventory/api exec node --require ts-node/register --test test/booking.e2e.test.ts`
- `pnpm --filter @eventory/web build`

## Dependency map

Depends on phases 3-7; unblocks outbox, notifications, tickets, and attendee wallet.

## Risk Assessment

State transitions must be explicit and monotonic where required. Never treat a client redirect as proof of payment.
