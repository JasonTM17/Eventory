---
phase: 4
title: 'Portfolio polish'
status: pending
priority: P2
effort: '4-8h'
dependencies: [3]
---

# Phase 4: Portfolio polish

## Overview

Turn the technically strong repository into a convincing public showcase only
after the safety and local verification gates are green. README now contains
real screenshots from the seeded product; public homepage, badges, and license
remain intentionally unresolved until their sources or owner decisions exist.

## Requirements

- Keep `main` as the default GitHub branch and retain the existing About topics.
- Add visual proof from the real running product, not placeholder UI.
- Add only badges that reflect a real workflow and real package constraints.
- Set `homepageUrl` only after a verified public demo/deployment exists.
- Add a license only after the repository owner selects it.
- Do not market mock payment/email or local-only monitoring as production
  integrations.

## Architecture

The README becomes a layered entry point: short product value and visual proof
first, a reproducible quick start second, then links to the existing detailed
architecture/security/deployment docs. Media belongs under a versioned
repository asset directory (for example `assets/images/`) and must be captured
from the actual Eventory flow.

## Related Code Files

- Modify: `README.md` — showcase header, verified badges, demo flow, accurate
  scope statement, and links to technical docs.
- Create: `assets/images/` — optimized screenshots or a short GIF of real
  booking → mock payment → QR ticket → check-in flow. Current evidence includes
  discovery and seat-selection screenshots.
- Modify if supported by a real endpoint: GitHub repository homepage metadata.
- Create: `LICENSE` only after owner choice.
- Modify when claims change: `docs/deployment-guide.md`,
  `docs/project-overview-pdr.md`, or `docs/security/threat-model.md`.

## Implementation Steps

1. Wait for Phase 3's green GitHub run. Capture a reproducible demo with seeded
   data, at desktop width, with no real user data, tokens, or local filesystem
   paths visible.
2. Add one hero screenshot and, if it materially clarifies the product, one
   short optimized GIF showing the critical user journey. Use descriptive
   alt text and keep repository size reasonable.
3. Add badges for the real `main` validation workflow, Node/pnpm requirement,
   and license only once each target is truthful.
4. Rewrite the top README section for a recruiter/maintainer: problem,
   capabilities, architecture credibility, demo steps, and honest limits.
5. Set the GitHub homepage only after the URL has been smoke-tested. Do not use
   a localhost or unverified preview URL.
6. Confirm all Markdown paths render on GitHub and all media is committed with
   a focused documentation commit.

## Success Criteria

- [x] README contains real, accessible visual proof and a concise demo flow.
- [x] The validation badge resolves to the real workflow and the default branch
      is `main`.
- [x] About description/topics remain accurate; homepage is empty or verified.
- [x] No screenshot/GIF exposes PII, secrets, localhost-only claims, or fake
      payment/provider behavior.
- [ ] License is present only with an explicit owner choice.

## Verification snapshot — 2026-08-03

- `assets/images/eventory-demo-discovery.png` and
  `assets/images/eventory-demo-seats.png` were captured from the seeded local
  Compose product and visually inspected.
- README labels the screenshots as local/demo evidence and does not claim a
  public URL or production payment-provider integration.
- Badge setup, GitHub homepage metadata, and license remain open external or
  owner-choice items; no value was invented.

## Risk Assessment

- Risk: polished README exaggerates production readiness.
  Mitigation: explicitly label mock integrations and local/demo boundaries.
- Risk: large GIFs slow repository cloning.
  Mitigation: use a short, compressed recording; prefer a static screenshot
  where it communicates the same fact.
- Rollback: remove the media/readme commit independently of code changes.

## Next Steps

- User decision required: public deployment URL and license selection.
- Runtime hardening is complete locally; execute the remaining external/owner
  decisions before calling the public repository release-ready.
