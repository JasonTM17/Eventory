# ADR-009: Signed, session-bound tickets with database-authoritative check-in

- Status: Accepted
- Date: 2026-08-01

## Context

Tickets are presented in an untrusted browser or camera scanner. A copied or modified QR value must not grant access to another event, and two scanners must not admit the same ticket concurrently.

## Decision

Eventory signs a compact versioned payload with HMAC-SHA256. The payload includes an opaque public ticket code, a one-way event-session binding, a per-ticket nonce, a key version, and a signature. It never includes attendee PII or raw database IDs. New tickets use `QR_KEY_VERSION`; verification accepts that version and any retained entries in `QR_SIGNING_KEYS` (`version:secret;version:secret`). Unsupported versions are rejected.

The API resolves the opaque code, verifies the stored nonce and session binding, then authorizes the scanner through event-organization membership. A PostgreSQL transaction conditionally changes `ISSUED` to `CHECKED_IN` and inserts one `ticket_check_ins` row. The unique ticket constraint wins concurrent races; repeated scans return `ALREADY_CHECKED_IN` without another mutation.

## Consequences

- Forged, replayed for another session, or rotated-key QR values fail before ticket state is touched.
- Check-in history retains the ticket, session, scanner identity when available, and timestamp.
- Scanners require online API access in the first release. Offline queues are intentionally deferred because they need a conflict/reconciliation policy and trusted device keys.
- Key rotation is a compatibility window: add the new version and retain the previous secret in `QR_SIGNING_KEYS`, deploy, then make the new version active. Remove an old secret only after every ticket signed with that version has expired or been reissued. Secrets belong in a managed secret store, never in `.env.example` or source control.
