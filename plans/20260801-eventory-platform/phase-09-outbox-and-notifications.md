---
phase: 9
title: 'Outbox and notifications'
status: completed
effort: 1 session
---

# Phase 9: Outbox and notifications

## Overview

Add transactional outbox processing and asynchronous notification delivery for
booking/payment/ticket/event events using PostgreSQL polling workers inside the
API process, Mailpit locally, bounded retry/backoff, and deduplicated delivery
records.

## Requirements

- Functional: business mutations and outbox rows commit atomically; workers publish/process records, retry transient failures, and dead-letter permanent failures; delivery attempts are persisted.
- Non-functional: duplicate workers do not duplicate side effects, queue depth is observable, and email is never required for booking transaction success.

## File inventory

| Action | Paths                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Create | `apps/api/src/modules/outbox/`, `apps/api/src/modules/notifications/`, workers/processors, migrations, integration tests |
| Create | `docs/adr/ADR-005-transactional-outbox.md`, `docs/runbooks/payment-webhook-failure.md`                                   |

## Architecture

Outbox rows contain event type, aggregate/public ID, payload version, attempt count, next-attempt time, and processed timestamp. A polling/queue bridge claims records safely, handlers use idempotency keys, and notifications move through PENDING → PROCESSING → SENT/FAILED/DEAD.

## Implementation Steps

1. Add outbox and notification delivery models and repository contracts.
2. Implement transaction helper for enqueueing domain events with state mutations.
3. Add worker claim/retry/backoff/dead-letter flow and idempotent handlers.
4. Add Mailpit email adapter and notification templates without PII leakage in logs.
5. Add duplicate-worker, retry, permanent-failure, and outbox persistence tests.

## Test scenario matrix

| Scenario                        | Expected result                           |
| ------------------------------- | ----------------------------------------- |
| Business transaction rolls back | No outbox event exists.                   |
| Worker crash after side effect  | Re-run is idempotent.                     |
| Transient email failure         | Bounded exponential retry.                |
| Permanent validation failure    | Mark DEAD with reason; no infinite retry. |

## Success Criteria

- [x] Outbox records are written atomically with booking/payment/ticket changes.
- [x] Notification attempts are persisted and observable.
- [x] Duplicate processing tests pass.

## Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @eventory/api exec node --require ts-node/register --test test/outbox.e2e.test.ts`
- Mailpit delivery and dead-letter transitions are covered by the integration test.

## Dependency map

Depends on phases 3 and 8; unblocks reliable ticket delivery and event reminders.

## Risk Assessment

At-least-once delivery is intentional; consumers must be idempotent. Do not claim exactly-once semantics from a queue.
