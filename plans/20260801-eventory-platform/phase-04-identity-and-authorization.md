---
phase: 4
title: 'Identity and authorization'
status: pending
effort: ''
---

# Phase 4: Identity and authorization

## Overview

Implement identity persistence, Argon2id password authentication, rotating refresh sessions, cookie-safe auth endpoints, roles, organization membership, resource policies, and audit-ready authorization checks.

## Requirements

- Functional: register/login/refresh/logout flows work; refresh rotation detects reuse; role and resource policies reject cross-user/cross-organization access.
- Non-functional: normalized email, bounded login rate limits, secure cookie defaults, no tokens/passwords in logs, and explicit session revocation.

## File inventory

| Action | Paths                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create | `apps/api/prisma/migrations/*identity*`, `apps/api/src/modules/identity/`, `apps/api/src/modules/users/`, `apps/api/src/modules/organizations/`, `apps/api/src/modules/audit/` |
| Create | `apps/api/src/common/auth/`, `apps/api/test/identity/`, `docs/adr/ADR-006-cookie-based-authentication.md`                                                                      |

## Architecture

Access sessions are short-lived signed tokens bound to a server-side rotated refresh-token record. Refresh tokens are hashed at rest, rotated transactionally, and revoked on reuse. Guards check authentication and coarse roles; application policies verify organization membership and ownership against the database.

## Implementation Steps

1. Add users, organizations, memberships, refresh tokens, and idempotency/audit persistence with constraints and indexes.
2. Implement password policy, Argon2id hashing, registration, login, logout, refresh rotation, and session revocation.
3. Add role metadata, authentication guard, role guard, resource policy helpers, and secure cookie/CSRF boundary.
4. Add API DTO validation and safe error mapping.
5. Add integration/API tests for happy path, invalid credentials, reuse detection, and authorization matrix.
6. Commit persistence, auth flows, policy guards, and tests in separate slices.

## Test scenario matrix

| Scenario                 | Expected result                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Duplicate email          | Safe conflict; no account enumeration details.                                       |
| Refresh replay           | Current session family revoked and request rejected.                                 |
| Organizer foreign event  | 403/404 according to contract; no data leak.                                         |
| Attendee foreign booking | Rejected even when ID is known.                                                      |
| Brute-force login        | Rate-limited/progressively delayed without locking out legitimate users permanently. |

## Success Criteria

- [ ] All auth endpoints are versioned and documented.
- [ ] Refresh token rotation and reuse detection are tested.
- [ ] Policy tests cover ADMIN, ORGANIZER, ATTENDEE and ownership boundaries.
- [ ] Seed/demo accounts use non-production credentials only.

## Dependency map

Depends on phase 3 database/config/API foundation; unblocks organizer and attendee workflows.

## Risk Assessment

Cookie auth requires CSRF protection and CORS discipline. Never trust role claims alone for resource authorization.
