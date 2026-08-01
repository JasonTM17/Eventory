---
phase: 13
title: 'Delivery'
status: pending
effort: ''
---

# Phase 13: Delivery

## Overview

Package and document the release: multi-stage Dockerfiles, CI validation/image workflows, complete setup/API/operations docs, migration checks, and a release-ready branch/PR without force pushes or committed secrets.

## Requirements

- Functional: `docker compose up --build` can start the complete local stack; PR CI validates format/lint/type/test/build/migrations/images; main workflow builds versioned artifacts without real cloud credentials.
- Non-functional: non-root containers where practical, graceful shutdown, reproducible lockfile, documented deployment options, and clean release audit.

## File inventory

| Action | Paths                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Create | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.github/workflows/pull-request.yml`, `.github/workflows/main.yml`, release scripts |
| Update | `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, all required `docs/` architecture/API/database/testing/security/runbook pages      |

## Architecture

CI uses the same root scripts developers run. Docker images use multi-stage dependency/build/runtime layers and environment injection at runtime. Release automation produces artifacts and a PR; it does not require production credentials or deploy automatically.

## Implementation Steps

1. Add API/web multi-stage Dockerfiles and compose application services with health checks.
2. Add PR workflow for install/cache, formatting, lint, typecheck, tests, migration validation, builds, and image builds.
3. Add main workflow for repeat validation and versioned image artifacts.
4. Complete architecture, security, API, test, deployment, and runbook docs; validate links/examples.
5. Run final local clean-start smoke, full checks, `ck:code-review`, staged secret scan, and `ck:ship` dry-run/ship according to remote availability.

## Test scenario matrix

| Scenario       | Expected result                                                                           |
| -------------- | ----------------------------------------------------------------------------------------- |
| Empty checkout | README setup succeeds from clean clone.                                                   |
| Empty database | Migration + seed succeeds without manual SQL.                                             |
| Compose build  | API/web/dependencies become healthy.                                                      |
| CI simulation  | Every workflow command passes locally or is documented as CI-only.                        |
| Remote push    | Branch is pushed without force; PR creation is attempted only with available GitHub auth. |

## Success Criteria

- [ ] Docker, CI, docs, and release artifacts are present and validated.
- [ ] All required definition-of-done journeys and tests pass.
- [ ] Final branch has focused conventional commits and no untracked secrets.
- [ ] User receives a commit-by-commit report and any external-auth blocker is explicit.

## Dependency map

Depends on phase 12 and all prior deliverables; terminal phase.

## Risk Assessment

Do not claim a remote PR or deployment unless the command succeeds. If GitHub auth/permissions block push, preserve local commits and report the exact safe next command.
