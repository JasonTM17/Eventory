# Eventory threat model

Last reviewed: 2026-08-01

Eventory treats the browser, payment provider, QR scanner, and all request
payloads as untrusted. PostgreSQL is the durable source of truth; Redis holds
only expiring coordination data. This document records the release threat
model and the controls verified in the API.

## Assets and trust boundaries

| Asset                              | Impact if compromised         | Primary control                                                              |
| ---------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| Password hashes and session tokens | Account takeover              | Argon2id, hashed refresh tokens, rotation, HttpOnly cookies, log redaction   |
| Booking, payment, and seat state   | Financial loss or double sale | PostgreSQL transactions, idempotency, signed webhooks, atomic Redis holds    |
| Ticket QR payloads                 | Unauthorized entry            | HMAC signature, key version, nonce, session binding, organizer authorization |
| Organizer/admin data               | Cross-tenant data exposure    | Resource ownership checks, organization roles, admin role guard              |
| Audit and operational data         | Loss of accountability        | Transactional audit records and bounded admin pagination                     |

The browser-to-API boundary validates DTOs, rejects unknown fields, applies
body limits, uses Helmet headers, checks the CORS allowlist, and rejects
session issuance from an untrusted source. A supplied `Origin` or `Referer`
must normalize to `CORS_ORIGINS`; browser-indicated requests without either are
rejected. Originless session issuance is reserved for SSR/service callers that
send `X-Eventory-Client: server` and do not present `Sec-Fetch-Site`; any
request that carries Fetch Metadata without a trusted origin is rejected.
Deployments should still keep the API private or use an authenticated gateway
for service callers.

## Adversarial scenarios and controls

| Threat                                  | Likely path                                                                  | Controls                                                                                                                                         | Residual risk                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Credential stuffing / denial of service | Repeated register, login, refresh, hold, checkout, webhook, or scan requests | Per-route rate limits, bounded request body, generic credential errors, Argon2id                                                                 | The in-process limiter is per instance; multi-instance deployments should add a Redis-backed limiter or edge throttle |
| BOLA / tenant escape                    | Guess event, booking, ticket, organization, or admin IDs                     | Ownership queries, organization membership policy, admin role guard, cross-tenant tests                                                          | Operators with database credentials can bypass the API; use least-privilege database access                           |
| Seat race / replay                      | Two buyers hold or confirm the same seat                                     | Redis Lua hold script, PostgreSQL allocation transaction, idempotency records, payment-event uniqueness                                          | Redis outage rejects holds; see the Redis runbook                                                                     |
| QR forgery / replay                     | Edit a QR, reuse it at another session, or scan it twice concurrently        | HMAC-SHA256, key version, random nonce, opaque public code, session binding, conditional status update, unique check-in row                      | An authorized scanner can still scan a valid ticket; rotate signing keys with a future key version                    |
| CSRF / login CSRF                       | A malicious page submits a cookie-backed mutation or issues a session        | Origin allowlist guard, route-scoped session-issuance policy, `SameSite=Lax` cookies, CORS credentials allowlist                                 | Originless session issuance is limited to SSR/service callers with the explicit non-simple header                     |
| XSS / unsafe output                     | User-controlled event names or search values rendered in the web app         | React escaping, DTO length constraints, Helmet CSP-related defaults, no raw HTML rendering                                                       | CSP is not a substitute for output encoding; audit any future rich-text feature                                       |
| Injection                               | Query, search, webhook, or body values reach persistence                     | Prisma parameterization, DTO validation, bounded pagination, no shell interpolation                                                              | Raw SQL is limited to reviewed aggregate/update statements                                                            |
| Enumeration                             | Probe login, tickets, bookings, or metrics                                   | Generic authentication errors, opaque public codes, ownership filters, metrics token in production                                               | Public event discovery is intentionally searchable by product design                                                  |
| Privilege escalation                    | Change a role/status or organization membership                              | Backend role and organization policy checks, self-moderation denial, audit records, suspended-session revocation                                 | A compromised admin account remains high impact; protect admin credentials and monitor audit logs                     |
| Secret / PII leakage                    | Request or response logs, metrics, errors                                    | Pino redacts authorization/cookies/passwords/refresh tokens/QR/payment signatures and response `Set-Cookie`; safe error filter; metrics omit PII | Third-party infrastructure logs need equivalent redaction policies                                                    |
| Dependency / supply chain               | Vulnerable package or leaked environment file                                | Lockfile, `npm audit`/`pnpm audit`, `.gitignore`, CI checks, no secrets in images                                                                | Audit findings must be triaged when advisories change                                                                 |

## Operational invariants

1. Never mark a payment successful from a browser redirect or by editing rows
   manually. Use a verified provider event and preserve its idempotency key.
2. Never treat Redis as permanent inventory. A database transaction must make
   a seat `SOLD` before issuing a ticket.
3. Never put raw database IDs, email addresses, or secrets in QR payloads,
   metrics labels, or logs.
4. Treat a `401`, `403`, signature mismatch, amount mismatch, or cross-tenant
   denial as a security signal and retain the request ID for investigation.

## Verification evidence

- `apps/api/test/security.e2e.test.ts` verifies untrusted session issuance is
  rejected before persistence or cookies, and metrics do not contain sensitive
  fields.
- `apps/api/test/rate-limit.guard.test.ts` verifies the 429 budget and
  `Retry-After` response.
- `apps/api/test/check-in.e2e.test.ts` verifies forged, wrong-session, and
  concurrent QR scans.
- `apps/api/src/main.ts` configures Helmet, CORS, JSON/form body limits, and
  the global validation pipe.
- `apps/api/src/common/http/api-exception.filter.ts` returns a generic 500
  message without a stack trace.

## Open follow-ups

- Replace the process-local limiter with a Redis/edge-backed algorithm before
  running more than one API instance.
- Add alerting on repeated `AUTHENTICATION_REQUIRED`, `CSRF_ORIGIN_DENIED`,
  `INVALID_QR_SIGNATURE`, payment mismatches, and dead outbox events.
- Keep QR signing keys in a managed secret store and publish a key-rotation
  runbook before a production rollout.
