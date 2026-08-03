---
phase: 12
title: 'Package delivery verification'
status: completed
priority: P1
effort: '2-4h'
dependencies: [4]
---

# Phase 12: Package delivery verification

## Overview

Make the workspace packaging boundary explicit and verifiable, then publish
the already-merged local `main` history only after local gates, media/docs
checks, and review succeed. The five reusable workspace packages remain
private; this phase validates their payloads, it does not publish them.

## Requirements

- Add a root `pnpm package:check` command that dry-runs the five reusable
  packages: config, contracts, UI, ESLint config, and TypeScript config.
- Restrict config/contracts/UI tarballs to intentional files via manifest
  allow-lists that preserve each package's declared entrypoint.
- Run the packaging gate in pull-request and main GitHub workflows after the
  workspace build/typecheck prerequisites.
- Push `main` to `origin/main`, inspect the triggered main workflow, and record
  the actual result. Docker image publication is tracked separately in Phase
  13 after this phase's gates are green.

## Architecture

Applications are delivered as Docker image artifacts; reusable workspaces are
private internal packages. `package:check` validates only the internal package
tarball boundary, catching accidental `.turbo`, source, test, or metadata
payloads before a future publication decision. GitHub Actions runs the same
gate on pull requests and `main`, so local and remote expectations match.

## Related Code Files

- Modify: `package.json` — add the root packaging verification command.
- Modify: `packages/config/package.json`, `packages/contracts/package.json`,
  `packages/ui/package.json` — add intentional tarball file allow-lists.
- Modify: `.github/workflows/pull-request.yml`, `.github/workflows/main.yml` —
  run `pnpm package:check` after typecheck.
- Modify: `README.md`, `docs/testing/test-strategy.md`,
  `docs/codebase-summary.md`, and `docs/project-roadmap.md` — explain private
  workspace/package gate and remote verification truthfully.

## Implementation Steps

1. Prove the current dry-run payloads, then add the narrowest manifest/script
   changes that remove `.turbo` and TypeScript build metadata while retaining
   each package's declared source or compiled runtime entrypoint.
2. Run the root package check and inspect each dry-run payload; confirm the
   existing config/tooling packages retain their declared payloads.
3. Add the same command to both workflows without changing image publication,
   deployment, or registry behavior; Phase 13 owns Docker Hub publication.
4. Run focused package/build checks followed by repository format, lint,
   typecheck, integration, web build, audit, Compose, docs, media, and diagram
   validation.
5. Perform spec, code-quality, and adversarial review; resolve verified
   findings before focused commits.
6. Push the verified `main` history, wait for GitHub Actions, and record the
   run URL/status in plan/docs only after it actually succeeds.

## Success Criteria

- [x] `pnpm package:check` passes and each private package dry run contains
      only its declared runtime entrypoint plus `package.json`; tool-config
      packages retain only their declared config files.
- [x] Both GitHub workflows run the package gate after required build output
      exists.
- [x] Local quality, runtime/media, docs, and diagram gates pass.
- [x] `origin/main` equals the verified local `main` history and a new main
      workflow has a recorded green result.

## Delivery evidence

- Source commit: `d66e7b643bf603fdec2e2fb0486e5444f515df87`.
- GitHub Actions: [main validation run 30810707641](https://github.com/JasonTM17/Eventory/actions/runs/30810707641), `success`.
- The run passed package payload, web test, integration, build, audit, Compose,
  and API/web image-build gates.
- [x] No npm publish, license, or homepage update occurs without a separate
      owner decision; Docker Hub publication is explicitly authorized in the
      follow-up request and tracked by Phase 13.

## Risk Assessment

- Risk: restricting files can omit runtime code.
  Mitigation: build first, inspect `pnpm pack --dry-run`, and run web/API
  typecheck/build after each manifest change.
- Risk: remote push is rejected or CI fails for an environment-only reason.
  Mitigation: preserve local commits, capture exact remote evidence, and do not
  report the remote gate as passed without a green run.
- Risk: registry actions are mistaken for the requested Git push.
  Mitigation: keep every workspace `private` and make no npm/Docker publish
  command part of this phase.
