---
phase: 5
title: 'Event management'
status: pending
effort: ''
---

# Phase 5: Event management

## Overview

Build venues, sections, seats, events, sessions, ticket types, inventory rules, and explicit event lifecycle commands with organizer ownership and admin moderation hooks.

## Requirements

- Functional: organizers create/manage venues and events; publish/open/close/cancel commands enforce lifecycle invariants; ticket type and session validation are server-side.
- Non-functional: public UUIDs/slugs, price snapshots prepared for booking, safe indexes, and immutable purchased-ticket-impacting fields.

## File inventory

| Action | Paths                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `apps/api/src/modules/venues/`, `apps/api/src/modules/events/`, `apps/api/src/modules/ticket-types/`, related Prisma migrations and seed factories |
| Create | `apps/api/test/events/`, `docs/database/erd.md`, `docs/adr/ADR-004-postgresql-booking-source-of-truth.md`                                          |

## Architecture

Lifecycle transitions are intent-based application commands, not arbitrary status patches. Event services enforce session/ticket prerequisites and ownership policies. Venue seat identity is unique within a venue; event/session references are explicit to prevent ambiguous inventory.

## Implementation Steps

1. Add venue/section/seat/event/session/ticket-type/seat-allocation models, constraints, and lookup indexes.
2. Implement organizer CRUD with DTO validation and ownership policy.
3. Implement lifecycle transition map and command endpoints.
4. Add public discovery filtering/pagination/sorting with safe published-field projection.
5. Seed a published event with venue, sections, seats, sessions, ticket types, and demo users.
6. Add unit/API tests for transition matrix, invalid prerequisites, ownership, and pagination.

## Test scenario matrix

| Scenario                       | Expected result                                              |
| ------------------------------ | ------------------------------------------------------------ |
| Publish without session/ticket | Conflict with actionable domain code.                        |
| Completed → draft              | Rejected; terminal lifecycle preserved.                      |
| Organizer edits foreign event  | Forbidden/not found without leakage.                         |
| Public listing                 | Only published/visible events and valid pagination returned. |

## Success Criteria

- [ ] All event statuses and transitions are explicit and unit tested.
- [ ] Venue seat uniqueness and event slug constraints migrate from empty DB.
- [ ] Seed data supports the later reservation journey.

## Dependency map

Depends on phases 3-4. Unblocks web discovery, seating, and organizer management.

## Risk Assessment

Avoid exposing draft/admin-only fields through public queries. Any field that affects sold tickets must be protected after sales begin.
