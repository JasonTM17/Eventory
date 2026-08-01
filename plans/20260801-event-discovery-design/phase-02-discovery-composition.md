---
phase: 2
title: Discovery composition
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Discovery composition

## Scope

Translate the selected Stitch direction into real Eventory components. The
visual hierarchy may change, but discovery remains driven by the existing
server-side `EventListResponse` and no mock content may appear in production.

## File ownership

- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/events/page.tsx`
- Modify: `apps/web/src/components/event-card.tsx`
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/src/components/public-discovery-hero-art.tsx` only if the
  decorative SVG/CSS implementation is large enough to justify a boundary.

## Requirements

1. Use valid links styled as primary/secondary calls to action; do not nest
   the shared native `Button` inside `next/link`.
2. Add a decorative, `aria-hidden` ticket/seat-map artifact using CSS/SVG.
3. Strengthen card hierarchy with date/status/venue/price metadata already in
   `EventSummary`; never add imaginary images, categories, capacities, or
   attendee counts.
4. Give home and directory empty states an actionable, truthful recovery path.
5. Keep one dominant action per primary visual group and preserve the current
   `formatDate`/`formatMoney` helpers for locale/value correctness.

## Validation

- Render both API-backed and unavailable/empty responses.
- Verify real event names wrap without clipping at narrow widths.
- Verify card and CTA targets have visible hover, press, and focus states.

## Risks and rollback

- Do not turn public server components into client components for decorative
  state.
- Keep the abstract artwork independent of event data so a missing API field
  cannot break rendering.
