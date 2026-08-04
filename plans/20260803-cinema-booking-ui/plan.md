---
title: Eventory cinema-booking UI refactor
status: completed
date: 2026-08-03
---

# Eventory cinema-booking UI refactor

## Goal

Make the real Eventory journey feel like a production cinema/event booking product: clear discovery, session-led booking, a credible auditorium, focused checkout, and a branded signed-QR pass.

## Phases

1. **Foundation and discovery** — tighten navigation, hierarchy, event cards, search, responsive spacing, and real-data states.
2. **Event and session selection** — present venue, date, ticket price, and bookable sessions like a real showtime flow.
3. **Auditorium** — seed 140 seats across 10 rows; render screen, aisles, row labels, capacity, live state, and mobile scrolling.
4. **Checkout and ticket** — clarify order summary and payment state; render the API-signed QR as a branded admission pass.
5. **Runtime proof** — test 390/768/1440 px, keyboard flow, overflow, console, signed QR, lint, typecheck, tests, and production build.

## Acceptance criteria

- Demo auditorium contains 10 rows and 140 real database-backed seats.
- Seat selection remains keyboard-operable, touch targets are at least 44 px, and mobile uses an intentional horizontal auditorium viewport.
- The issued ticket QR is generated from the API-signed payload; no placeholder is rendered in the live app.
- Core pages share one deliberate cinema-booking visual system and do not expose test-fixture naming in approved showcase evidence.
- Public API and database schema contracts stay unchanged.
- Focused tests, lint, typecheck, build, and live-browser checks pass.

## Scope boundary

- No public deployment, real payment provider, licensed movie artwork, or destructive reset of unknown local data.
- Existing release/package changes in the dirty worktree remain untouched.
