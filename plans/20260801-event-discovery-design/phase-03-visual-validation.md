---
phase: 3
title: Visual proof and quality gates
status: completed
priority: P1
dependencies: [1, 2]
---

# Phase 3: Visual proof and quality gates

## Scope

Verify the implemented product rather than the Stitch mockup. Capture only
temporary local review images until a reproducible seeded demo produces
truthful GitHub showcase media.

## File ownership

- Add/modify only tests under `apps/web/test/` when test coverage is added.
- Modify `docs/design-guidelines.md` only if the completed interaction rules
  extend the documented public design contract.
- Do not modify `README.md` or `assets/images/` in this phase; those remain
  gated by the release-hardening portfolio phase.

## Validation

1. Run format check, lint, typecheck, and web build.
2. Check home, `/events`, sign-in, and organizer shell at 375px, 768px,
   1024px, and desktop width for overflow and visual regressions.
3. Check keyboard-only navigation, focus visibility, and reduced motion.
4. Run an adversarial UI review against the changed files before commit.
5. Attach the implementation report under `plans/.../reports/` with exact
   commands and real screenshot paths if needed for handoff.

## Success criteria

- Visual reference is clearly reflected in the running app without copying
  unsupported design elements.
- New behavior has focused automated coverage where the existing test stack
  supports it; no validation result is represented as passing without output.
- Docs impact is stated explicitly before merge.

## Completed evidence

- `pnpm --filter @eventory/web typecheck`, `lint`, `test`, and `build` passed.
  The current web package has zero automated test files, so `node --test`
  reported zero tests rather than a fabricated pass.
- Browser checks at 375px, 768px, 1024px, and 1440px found no horizontal
  overflow on `/`, `/events`, `/login`, or `/organizer`.
- Keyboard focus reached the skip link first; the native mobile menu opened
  with Enter and exposed four primary routes. Reduced-motion emulation reduced
  UI transition duration to `0.00001s`.
- Local fixtures proved both recovery branches: an empty API list renders
  truthful no-event states; an unreachable API renders the interruption state
  with a retry link. Temporary review screenshots are listed in the phase
  report and are intentionally excluded from the repository.
- CK scout, quality review, and adversarial review completed. All concrete
  findings were fixed before this phase was closed.
