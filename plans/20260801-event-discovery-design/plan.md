---
title: Eventory public discovery design refresh
description: >-
  Turn the selected Stitch direction into an accessible, data-honest Eventory
  public-discovery experience without expanding the current API contract.
status: in-progress
priority: P2
effort: 1 day
branch: feat/event-discovery-design
tags:
  - frontend
  - accessibility
  - portfolio
  - design
created: '2026-08-01T16:00:00+07:00'
createdBy: 'ck:plan + ck:stitch + ck:frontend-design'
---

# Eventory public discovery design refresh

## Overview

Stitch exploration produced two implementation-ready directions. Direction A
(`292dd58ce3c5476e9753bdd2f230a213`) is selected because its asymmetric,
ticket-and-seat-map hero gives the empty public catalog a credible first
impression without pretending that Eventory already has rich event artwork or
category filtering. Direction B remains useful reference for future
event-card density once the API supplies richer content.

The implementation keeps Eventory's documented paper/ink/lime tokens,
Space Grotesk, DM Mono, server-rendered discovery, and real `EventSummary`
fields. It does not add fabricated event images, statistics, newsletter
collection, category filters, or API surface area.

## Design decision

- Direction: editorial, high-contrast, quiet confidence; one memorable
  ticket-and-seat-map composition rather than generic marketing art.
- Design dials: variance 7/10, motion 2/10, density 5/10.
- Accessibility baseline: semantic navigation, skip link, 44px controls,
  visible focus, reduced motion, and responsive layouts at 375/768/1024/1440.
- Handoff: Stitch HTML/DESIGN.md was exported locally for analysis only; no AI
  mockup media belongs in the public repository or README.

## Phases

| Phase | Name | Status |
| --- | --- | --- |
| 1 | [Semantic shell and navigation](./phase-01-semantic-shell.md) | Pending |
| 2 | [Discovery composition](./phase-02-discovery-composition.md) | Pending |
| 3 | [Visual proof and quality gates](./phase-03-visual-validation.md) | Pending |

## Dependencies

- `main` CI run `30706811454` is green.
- Existing `EventSummary` is the only allowed discovery content contract.
- The release-hardening payment decision remains unrelated and unresolved; no
  payment behavior changes are included here.

## Acceptance criteria

- [ ] Public home and discovery routes remain server-rendered and work when
      the event API returns an empty list or is unavailable.
- [ ] Header has keyboard-accessible mobile navigation and the document has a
      skip link targeting the main landmark.
- [ ] No `Link` contains a native `button`; all calls to action use valid,
      focusable semantics.
- [ ] The visual ticket/seat-map treatment is CSS/SVG, decorative, and does
      not add an image field or fake event data.
- [ ] Motion is optional and disabled for `prefers-reduced-motion`.
- [ ] Screenshots used later in README are captured from the running product,
      not from Stitch.
- [ ] Format, lint, typecheck, web build, focused browser checks, and desktop
      plus mobile visual review pass before merge.

## Commit boundaries

1. `feat(web): add accessible public navigation shell`
2. `feat(web): refresh event discovery composition`
3. `test(web): verify public discovery responsiveness`
4. `docs(design): record public discovery interaction rules` when the final
   implementation changes the documented design contract.

## Risks and rollback

- Risk: visual polish can accidentally imply features the API does not expose.
  Mitigation: compose every event card from `EventSummary`; use only a
  decorative CSS/SVG artifact.
- Risk: a mobile drawer can regress keyboard navigation.
  Mitigation: use native semantic controls, test focus order and Escape/native
  disclosure behavior, and retain desktop navigation unchanged.
- Risk: broad global CSS affects authenticated workspaces.
  Mitigation: scope new selectors under public page/header class names and
  verify primary authenticated routes after the change.
- Rollback: revert the focused frontend commits independently; API/data
  contracts remain untouched.

## Unresolved questions

- None for this frontend scope. Deployment URL and license choice remain
  release-portfolio decisions in `plans/20260801-release-hardening/`.
