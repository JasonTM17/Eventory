---
phase: 4
title: Portfolio polish
status: completed
priority: P2
effort: 4-8h
dependencies:
  - 3
---

# Phase 4: Portfolio polish

## Overview

Turn the technically strong repository into a convincing, evidence-based
showcase. Capture from an isolated current-source Compose stack, add a compact
real-product GIF and exported diagrams, then make README/docs explain exactly
what is local demo evidence versus a public production integration.

## Requirements

- Keep `main` as the default GitHub branch and retain the existing About topics.
- Add visual proof from the real running product, not placeholder UI.
- Add one compact GIF assembled from real runtime frames and one ticket-wallet
  screenshot; do not use fake names, production credentials, or hidden state.
- Add versioned SVG and PNG runtime/ticket-lifecycle diagrams under
  `assets/diagrams/`, with labels consistent with the NestJS, PostgreSQL,
  Redis, worker/outbox, mock-payment, and signed-QR implementation.
- Add only badges that reflect a real workflow and real package constraints.
- Set `homepageUrl` only after a verified public demo/deployment exists.
- Add a license only after the repository owner selects it.
- Do not market mock payment/email or local-only monitoring as production
  integrations.

## Architecture

The README becomes a layered entry point: short product value and visual proof
first, a reproducible quick start second, then links to detailed architecture,
security, deployment, and package-boundary docs. Screenshots and GIF live in
`assets/images/`; diagram source and raster exports live in `assets/diagrams/`.
The GIF is a sequence of real browser frames, not an animation that invents
state. PNG exports make diagrams render reliably in GitHub while SVG remains
reviewable source.

## Related Code Files

- Modify: `README.md` — showcase header, real media, architecture entry point,
  shared-package summary, accurate scope statement, and links to technical docs.
- Create: `assets/images/eventory-demo-ticket-wallet.png` — current-source
  signed-ticket wallet evidence.
- Create: `assets/images/eventory-demo-booking-flow.gif` — compact sequence of
  current-source discovery, seats, checkout, and issued-ticket evidence.
- Create: `assets/diagrams/eventory-runtime-architecture.svg` and `.png` —
  exported system context and trust/data boundaries.
- Create: `assets/diagrams/eventory-booking-lifecycle.svg` and `.png` —
  hold → checkout → payment webhook → ticket/check-in lifecycle.
- Modify: `docs/architecture/system-overview.md` and
  `docs/system-architecture.md` — reference the exported diagram and preserve
  Mermaid as editable inline documentation.
- Modify if supported by a real endpoint: GitHub repository homepage metadata.
- Create: `LICENSE` only after owner choice.
- Modify when claims change: `docs/deployment-guide.md`,
  `docs/project-overview-pdr.md`, or `docs/security/threat-model.md`.

## Implementation Steps

1. Start an isolated current-source Compose project on non-default ports,
   migrate and seed it, then use browser automation to capture public and
   authenticated demo frames with no real data or credentials visible.
2. Inspect every captured frame. Keep a ticket-wallet PNG and assemble a short
   optimized GIF from selected real frames; reject frames with browser chrome,
   local paths, secrets, or confusing state.
3. Generate a runtime architecture and ticket lifecycle diagram from the
   verified documentation. Validate SVG syntax, export PNG, and visually review
   both exports before linking them.
4. Rewrite README preview/architecture/package sections with descriptive alt
   text, relative paths, a reproducible local demo command, and honest mock/
   local boundaries.
5. Link the runtime diagram from architecture docs without replacing the
   existing Mermaid diagrams.
6. Run Markdown link/doc validation and keep media sizes reasonable before
   handing package delivery to Phase 12.

## Success Criteria

- [x] README contains real, accessible visual proof: existing discovery/seat
      screenshots, a ticket-wallet screenshot, a short booking-flow GIF, and
      links to exported architecture artifacts.
- [x] The validation badge resolves to the real workflow and the default branch
      is `main`.
- [x] About description/topics remain accurate; homepage is empty or verified.
- [x] No screenshot/GIF exposes PII, secrets, browser chrome, local file paths,
      or fake payment/provider behavior.
- [x] Both SVG and PNG diagrams render and match current documented topology.
- [ ] License is present only with an explicit owner choice.

## Verification snapshot — 2026-08-03

- Discovery, event detail, selected/held seats, checkout, and issued-wallet
  frames were captured from isolated current-source Compose ports 13000/54000
  after seed and browser health checks.
- Wallet QR payload is fully redacted with a visible `QR REDACTED / LOCAL DEMO`
  label; no browser chrome, credential, local path, or real provider is shown.
- Runtime and booking-lifecycle SVG/PNG exports were rendered and visually
  reviewed against the current docs and code.
- README labels local/demo evidence honestly; no public deployment claim was
  added.
- Badge setup is verified; homepage metadata and license remain owner choices.

## Risk Assessment

- Risk: polished README exaggerates production readiness.
  Mitigation: explicitly label mock integrations and local/demo boundaries.
- Risk: large GIFs slow repository cloning.
  Mitigation: use a short 6-frame optimized GIF and verify file size before
  committing; retain static images for detail.
- Risk: a screenshot could represent stale source.
  Mitigation: capture only after an isolated current-source build, migration,
  seed, and browser health check.
- Risk: diagrams drift from code.
  Mitigation: derive nodes/flows from current docs and re-read the relevant
  architecture pages during review.
- Rollback: remove the media/readme commit independently of code changes.

## Next Steps

- Hand off package payload verification, CI gate, remote push, and workflow
  evidence to Phase 12.
- Public deployment URL and license selection remain user decisions.
