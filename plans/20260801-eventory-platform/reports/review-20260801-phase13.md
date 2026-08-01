## Code Review Summary

### Scope

- Files: 18 delivery, CI, package, and documentation files from `5cbb001..HEAD`
- Focus: pre-landing review of container packaging, Compose startup, CI gates, security boundaries, and onboarding claims
- Checks: critical + API + web checklists; `git diff --check`; local quality gates; Docker runtime smoke; API integration suite; dependency audit; docs validator; secret-pattern scan

### Overall Assessment

Pre-Landing Review: No blocking issues found. The release slice is internally consistent and was exercised through real PostgreSQL/Redis/Mailpit containers.

### Critical Issues

None.

### High Priority

None.

### Medium/Informational

- [apps/api/Dockerfile:32] `pnpm deploy --legacy` emits a pnpm warning because the workspace does not enable injected packages. This is intentional for pnpm 11 compatibility and the resulting runtime image was verified through migration and readiness; revisit when the workspace adopts injected deployments.
- [docs/deployment-guide.md:17] Host ports are documented with defaults, while another local Docker project can occupy those ports. The guide explicitly directs operators to override `*_PORT` values; the full stack was verified with isolated ports `55434/56381/11026/18026`.
- [docs/design-guidelines.md:32] The docs validator reports five component references (`Button`, `Card`, `Field`, `StatusBadge`, `Container`) that exist through the UI package export but are not recognized by the validator. This is a pre-existing validator limitation, not a broken internal link.

### Edge Cases Reviewed

- API runtime image has no package manager; the entrypoint uses the deployed local Prisma binary and was verified against a live database.
- Direct `express` imports are declared as a production dependency, avoiding transitive-hoisting assumptions.
- Compose API/web health checks gate startup on database/Redis/Mailpit/API readiness.
- Cookie mutation CSRF, rate limits, redaction, audit rows, signed QR payloads, and cross-organization authorization remain covered by tests.
- API test files run sequentially against shared real fixtures while seat/check-in race assertions remain concurrent inside their suites.
- No tracked dotenv secrets, private keys, high-confidence credential patterns, dangerous shell/HTML sinks, or known production dependency vulnerabilities were found.

### Verification Evidence

- `pnpm format:check`: pass
- `pnpm lint`: pass
- `pnpm typecheck`: pass
- `pnpm --filter @eventory/api db:validate`: pass
- `pnpm audit --prod`: no known vulnerabilities
- `docker compose config --quiet` and monitoring profile config: pass
- API and web Docker builds: pass
- Compose API readiness: `{"status":"ok","checks":{"database":"up","redis":"up"}}`
- Compose web `/events`: HTTP 200
- API integration suite: 33 tests, 12 suites, 0 failures, 0 cancellations

### Recommended Actions

1. Keep the documented port override and local disk-cache cleanup guidance for machines with conflicting services or low disk space.
2. Re-run the same checks in GitHub Actions after opening a pull request or dispatching the workflow.

### Unresolved Questions

- No live production deployment target or real payment/email provider was requested; those remain explicit extension points in the roadmap.

Status: DONE_WITH_CONCERNS
Summary: No blocking findings; release packaging, security boundaries, and local smoke checks are verified.
Concerns/Blockers: Informational pnpm deploy warning and pre-existing docs-validator false positives only.
