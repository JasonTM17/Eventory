# Payment webhook failure runbook

## Symptoms

- A provider reports retries or a booking remains `PENDING`.
- `outbox_events` contains `PENDING`, `PROCESSING`, or `DEAD` rows.
- `notification_deliveries.lastError` contains an SMTP or template error.

## Safe checks

1. Inspect the booking and payment status by provider reference; do not mark a payment successful from a browser redirect.
2. Verify webhook HMAC, provider reference, amount, and currency. A mismatch is a data-integrity signal, not a retryable success.
3. Inspect outbox attempts and `nextAttemptAt`. A `PROCESSING` row older than five minutes is eligible for reclaim.
4. Check Mailpit/SMTP health and credentials without printing message bodies, tokens, or recipient lists.

## Recovery

- Re-send the same signed provider event ID. The unique provider event constraint makes the state transition idempotent.
- For transient email failures, let the worker retry with bounded backoff.
- For a `DEAD` notification, correct the dependency and replay the outbox row through an authenticated operator action; preserve the original error for audit.
- Never edit `seat_allocations`, `payments`, or `bookings` by hand to force a success. Use a reviewed reconciliation command.
