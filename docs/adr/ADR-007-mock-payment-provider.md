# ADR-007: Use a signed mock payment provider for local checkout

- Status: Accepted
- Date: 2026-08-01

## Context

The checkout path must be testable without credentials or network calls. A client redirect is not proof of payment, and provider callbacks can be retried or arrive after a booking expires.

## Decision

Eventory exposes a `PaymentProvider` boundary and ships a deterministic mock adapter for development and automated tests. Mock webhooks are HMAC-SHA256 signed with `MOCK_PAYMENT_WEBHOOK_SECRET`, and the API validates the provider reference, amount, currency, and event id before mutating a booking.

The local-only completion endpoint is rejected when `NODE_ENV=production`. Successful callbacks confirm a booking, atomically mark allocations sold, issue one ticket per booking item, and enqueue an outbox event in PostgreSQL. Failed or expired callbacks transition the payment and booking to terminal states without selling inventory.

## Consequences

- Local checkout and failure/rollback scenarios are reproducible without external services.
- Provider-specific code is isolated behind a small port and can be replaced by a real adapter later.
- HMAC secrets, provider references, and payment payloads remain server-validated.
- The mock is not a payment gateway and must never be enabled as a production settlement path.

## Rejected alternatives

- Treating a browser return URL as success: forgeable and race-prone.
- Calling a real gateway in tests: slow, credential-dependent, and non-deterministic.
- Storing client totals: permits price tampering; totals are calculated from immutable ticket snapshots.
