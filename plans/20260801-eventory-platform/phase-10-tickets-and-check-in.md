---
phase: 10
title: 'Tickets and check-in'
status: completed
effort: 1 session
---

# Phase 10: Tickets and check-in

## Overview

Issue signed QR tickets after confirmation and implement organizer check-in with signature/state/event-scope validation, atomic uniqueness, attendee wallet, and scanner UX.

## Requirements

- Functional: QR contains minimal signed non-PII payload; server validates signature/key version/session binding; duplicate scans return a clear conflict/result code.
- Non-functional: opaque public ticket codes, replay-resistant binding/expiry, unique successful check-in, organizer resource authorization, and no full QR secrets in logs.

## File inventory

| Action | Paths                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------- |
| Create | `apps/api/src/modules/tickets/`, `apps/api/src/modules/check-in/`, signing utilities, migrations, tests |
| Modify | `apps/web` attendee ticket wallet and organizer scanner routes                                          |
| Create | `docs/architecture/check-in-sequence.md`, `docs/adr/ADR-004-postgresql-booking-source-of-truth.md`      |

## Architecture

Ticket payload uses version, random ticket code, event session ID, nonce, key version, and signature. Check-in verifies the signed payload and ownership scope before a transaction atomically updates the ticket and inserts a unique check-in record.

## Implementation Steps

1. Add ticket/check-in models and constraints for public codes and one successful check-in.
2. Implement QR signing/key rotation configuration and server-side verifier.
3. Issue one ticket per booking item/attendee during confirmation or a reliable outbox handler, matching the selected model.
4. Implement check-in endpoint with result enum and organizer event authorization.
5. Add attendee wallet/QR display and organizer camera scanner with manual fallback.
6. Add duplicate/concurrent scan, invalid signature, wrong event, cancelled/refunded tests.

## Test scenario matrix

| Scenario                  | Expected result                                 |
| ------------------------- | ----------------------------------------------- |
| Valid active ticket       | `VALID`, state becomes checked in once.         |
| Duplicate scan            | `ALREADY_CHECKED_IN`, no second record.         |
| Forged/replayed QR        | `INVALID_SIGNATURE` or session-bound rejection. |
| Wrong organizer/event     | Authorization or `WRONG_EVENT`, no data leak.   |
| Cancelled/refunded ticket | Explicit non-valid status, no mutation.         |

## Success Criteria

- [x] Signed QR verification is covered by unit and API tests.
- [x] Database uniqueness wins concurrent check-in races.
- [x] Offline mode is documented as future work, not falsely implied as supported.

## Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @eventory/api exec node --require ts-node/register --test test/ticket-qr.test.ts`
- `pnpm --filter @eventory/api exec node --require ts-node/register --test test/check-in.e2e.test.ts`
- `pnpm --filter @eventory/web build`

## Dependency map

Depends on phases 4, 5, 8, and 9; unblocks final end-to-end journey.

## Risk Assessment

Key rotation and event-session binding must be explicit. Never put names, email, or raw database IDs in QR payloads.
