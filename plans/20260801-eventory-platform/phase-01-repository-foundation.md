---
phase: 1
title: Repository foundation
status: completed
effort: ''
---

# Phase 1: Repository foundation

## Overview

Create the repository contract: workspace manifests, strict TypeScript/tooling, baseline docs, environment conventions, Git hygiene, and the initial architecture record. The output must be runnable even before business modules exist.

## Requirements

- Functional: pnpm and Turborepo understand the workspace; root scripts expose format, lint, typecheck, test, build, and dev entry points.
- Non-functional: strict TypeScript, deterministic formatting, no committed secrets, documented Node/pnpm compatibility, and a clean initial commit.

## File inventory

| Action | Paths                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.gitignore`, `.editorconfig`, `.prettierrc`, `.env.example`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`                                                                 |
| Create | `docs/architecture/system-overview.md`, `docs/architecture/container-diagram.md`, `docs/architecture/component-diagram.md`, `docs/adr/ADR-001-modular-monolith.md`, `docs/adr/ADR-002-orm-selection.md`, `docs/adr/ADR-008-monorepo-structure.md` |
| Create | Workspace stubs under `apps/`, `packages/`, `infrastructure/`, `scripts/`                                                                                                                                                                         |

## Architecture

The root owns orchestration only. Applications and packages own runtime code. Shared config packages must not import application modules. Documentation records module ownership and the allowed dependency direction before implementation starts.

## Implementation Steps

1. Initialize Git on `main`, create `feature/eventory-platform`, and configure the requested `origin` remote.
2. Add workspace/package-manager/tooling manifests and scripts with strict defaults.
3. Add empty-but-valid app/package boundaries and root health commands; do not add fake business behavior.
4. Write README setup assumptions, contribution/security rules, system context, initial diagrams, and ADRs.
5. Run install, format check, lint, typecheck, and workspace discovery; stage only foundation files.
6. Commit in small slices: repository manifest, tooling, architecture docs, then environment/config hygiene.

## Test scenario matrix

| Scenario            | Check                                                     |
| ------------------- | --------------------------------------------------------- |
| Workspace discovery | `pnpm -r list` resolves every package.                    |
| Strict compiler     | `pnpm typecheck` exits zero on the baseline.              |
| Secret hygiene      | staged diff contains no credentials; `.env` is ignored.   |
| New developer path  | README commands are internally consistent and executable. |

## Success Criteria

- [ ] Root workspace installs without undeclared dependencies.
- [ ] README and initial architecture docs exist and link only to real paths.
- [ ] Baseline quality commands pass.
- [ ] Four focused foundation commits are created and reported.

## Dependency map

This phase has no runtime dependencies and unblocks every later phase.

## Risk Assessment

Avoid placeholder source files that pretend to implement domain behavior. If a tool is not available locally, document the exact fallback and keep the script portable.
