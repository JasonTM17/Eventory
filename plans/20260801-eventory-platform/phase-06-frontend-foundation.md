---
phase: 6
title: Frontend foundation
status: completed
effort: 1 session
---

# Phase 6: Frontend foundation

## Overview

Create the Next.js App Router app, shared UI/config packages, secure auth-aware layouts, public event discovery/detail pages, and organizer event management screens with loading/error/empty/permission states.

## Requirements

- Functional: public routes render from API contracts; auth pages establish cookie sessions; protected layouts provide useful unauthorized/forbidden states; organizer can manage event drafts.
- Non-functional: accessible forms, keyboard navigation, responsive layout, metadata/SEO, server components by default, no client-side authorization as security boundary.

## File inventory

| Action | Paths                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Create | `apps/web/`, `packages/ui/`, `packages/contracts/`, `packages/config/`, `packages/eslint-config/`, `packages/typescript-config/` |
| Create | `docs/design-guidelines.md`, frontend test utilities and route tests                                                             |

## Architecture

Contracts are shared as validation/types without leaking server internals. Server components fetch public/read data; client components are limited to forms, dialogs, and future seat interactions. Auth uses same-site HttpOnly cookies and server-side route checks for UX, while API guards remain authoritative.

## Implementation Steps

1. Scaffold Next.js app and shared packages with strict TS and accessible base components.
2. Add API client, error normalization, auth pages, protected layouts, and session-aware navigation.
3. Add public events listing/detail and organizer event CRUD/lifecycle screens.
4. Add responsive states, metadata, keyboard/focus behavior, and form validation.
5. Add component/route tests and run web lint/typecheck/build.

## Test scenario matrix

| Scenario        | Expected result                                                                   |
| --------------- | --------------------------------------------------------------------------------- |
| API 401         | Route shows sign-in state and does not render protected data.                     |
| API 403         | Route shows permission state without leaking resource details.                    |
| Empty events    | Clear empty state with recovery action.                                           |
| Narrow viewport | Critical actions remain reachable with 44px touch targets and no horizontal trap. |

## Success Criteria

- [x] Required public and organizer routes exist with typed data boundaries.
- [x] Auth is cookie-safe and not dependent on localStorage tokens.
- [x] Web build/lint/typecheck pass.

## Verification

- `pnpm --filter @eventory/web lint`
- `pnpm --filter @eventory/web typecheck`
- `pnpm --filter @eventory/web build`

## Dependency map

Depends on phases 3-5 API contracts; unblocks checkout, seat map, attendee wallet, and admin UI.

## Risk Assessment

Do not duplicate business rules in the browser. UI optimistic updates are restricted to safe local state; server responses remain authoritative.
