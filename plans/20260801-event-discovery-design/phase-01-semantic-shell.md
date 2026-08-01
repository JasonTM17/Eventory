---
phase: 1
title: Semantic shell and navigation
status: pending
priority: P1
dependencies: []
---

# Phase 1: Semantic shell and navigation

## Scope

Make the public shell accessible and mobile-safe before changing the visual
composition. Keep this phase server-rendered; do not add a client-only menu
unless native HTML disclosure cannot meet the interaction requirement.

## File ownership

- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/src/components/site-header.tsx`
- Modify: `apps/web/app/globals.css`
- Add tests only under: `apps/web/test/` if existing browser-test conventions
  support the route.

## Requirements

1. Add a skip link and a stable `main` target.
2. Give the document an explicit light color scheme and matching theme color.
3. Replace the narrow-screen hidden-link behavior with a labelled,
   keyboard-accessible mobile disclosure that exposes all primary routes.
4. Preserve visible focus treatment, 44px interactive targets, readable text,
   and no horizontal scrolling at 375px.
5. Add a global reduced-motion override for existing shimmer/transition-heavy
   UI without removing functional loading feedback.

## Validation

- Keyboard tab order: skip link, brand, menu/opened routes, sign-in.
- Browser snapshots at 375px and desktop width show all primary destinations.
- Verify `prefers-reduced-motion: reduce` disables nonessential animation.

## Risks and rollback

- Do not hide navigation destinations solely for layout convenience.
- Keep selectors scoped so organizer/admin pages retain their current shell.
