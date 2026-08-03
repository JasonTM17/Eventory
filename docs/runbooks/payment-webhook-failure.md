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
5. Query open `payment_reconciliations` rows and correlate the provider event ID
   with the signed provider dashboard; do not expose payment secrets in tickets.
6. Query `payment_webhook_inbox` for `RECEIVED` rows when a webhook arrived before
   Eventory had persisted the provider reference. The inbox is durable and is
   retried by the booking reconciliation worker; do not delete or replay rows by
   hand.

## Recovery

- Re-send the same signed provider event ID. The unique provider event constraint makes the state transition idempotent.
- For transient email failures, let the worker retry with bounded backoff.
- For a `DEAD` notification, correct the dependency and replay the outbox row through an authenticated operator action; preserve the original error for audit.
- Never edit `seat_allocations`, `payments`, or `bookings` by hand to force a success. Use a reviewed reconciliation command.
- A late capture after hold expiry is intentionally manual in the mock contract:
  it leaves the booking without tickets, payment status
  `REQUIRES_RECONCILIATION`, one `OPEN` reconciliation row, an audit record, and
  a metric signal. Resolve it only through an approved provider refund/void or
  a reviewed fulfillment decision when a real provider contract exists.
- Administrators can review `GET /api/v1/admin/payment-reconciliations?status=OPEN`
  and mark a provider-confirmed action complete with the authenticated,
  CSRF-protected `PATCH /api/v1/admin/payment-reconciliations/:id/resolve`
  endpoint and a bounded resolution note. This records the operator audit; it
  does not pretend to issue a refund or ticket automatically.
- The mock boundary rejects refund, cancellation, chargeback, and other
  unsupported event types. Do not bypass DTO validation or mark tickets/payment
  states manually; use a reviewed provider adapter and forward migration when
  those financial transitions are actually specified.
