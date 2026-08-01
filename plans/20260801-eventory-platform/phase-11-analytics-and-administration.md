---
phase: 11
title: 'Analytics and administration'
status: completed
effort: 1 session
---

# Phase 11: Analytics and administration

## Overview

Provide organizer event metrics and admin management views for users, organizations, events, and audit logs, with bounded queries and role/resource authorization.

## Requirements

- Functional: organizer sees event-scoped booking/payment/attendance metrics; admin can moderate/suspend and inspect audit records; all queries are paginated and authorized.
- Non-functional: no unbounded N+1 queries, aggregate indexes/queries are documented, and sensitive values are redacted.

## File inventory

| Action | Paths                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `apps/api/src/modules/analytics/`, extend `apps/api/src/modules/audit/`, `apps/api/src/modules/admin/`, migrations/indexes, API tests |
| Modify | `apps/web/app/organizer/.../analytics`, `apps/web/app/admin/...`                                                                      |
| Create | `docs/architecture/component-diagram.md` updates and admin runbook notes                                                              |

## Architecture

Analytics services query event-scoped aggregates from PostgreSQL with explicit date/status filters. Admin commands are separate from organizer APIs and emit audit logs. UI never receives secrets or unrestricted user data.

## Implementation Steps

1. Define metric DTOs and efficient aggregate queries with documented indexes.
2. Add organizer analytics endpoints and dashboards.
3. Add admin user/event/organization/audit endpoints with policy checks and pagination.
4. Add moderation/suspension commands and audit events.
5. Add API/UI tests for scope, pagination, and empty/error states.

## Test scenario matrix

| Scenario                     | Expected result                                      |
| ---------------------------- | ---------------------------------------------------- |
| Organizer cross-event metric | Rejected; query never aggregates outside scope.      |
| Admin pagination             | Stable cursor/offset contract and bounded page size. |
| Suspended user               | Sensitive operations blocked and audited.            |
| No activity                  | Zero-valued metrics, not null/NaN.                   |

## Success Criteria

- [x] Metrics and admin views are API-authorized and tested.
- [x] Query plans/index rationale are documented.
- [x] Audit records cover moderation and sensitive admin operations.

## Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @eventory/api exec node --require ts-node/register --test test/analytics-admin.e2e.test.ts`
- `pnpm --filter @eventory/web build`

## Dependency map

Depends on phases 4, 5, 8, 9, and 10; unblocks dashboard completeness.

## Risk Assessment

Keep analytics read models simple for MVP; avoid premature event-sourcing or a second warehouse.
