# Eventory codebase summary

## Applications

- `apps/api`: NestJS 11 modular monolith, Prisma 7 schema/migrations, Redis
  seat holds, Mailpit outbox worker, signed QR, analytics/admin APIs.
- `apps/web`: Next.js 16 App Router, server-rendered discovery/organizer/admin
  routes and client seat/checkout/ticket/check-in interactions.

## Shared packages

- `packages/config`: Zod environment schema and CORS parsing.
- `packages/contracts`: API-facing TypeScript response contracts.
- `packages/ui`: accessible Button/Card/Field/StatusBadge/Container primitives.
- `packages/typescript-config` and `packages/eslint-config`: shared tooling;
  the root ESLint flat config consumes the packaged preset.

## Infrastructure and workflows

- `compose.yaml`: PostgreSQL, Redis, Mailpit, API, web, and optional monitoring.
- `apps/api/Dockerfile` and `apps/web/Dockerfile`: multi-stage non-root images.
- `.github/workflows/pull-request.yml`: dependency-backed tests and image
  builds; `.github/workflows/main.yml`: repeat validation, focused web
  regressions, and versioned image artifacts; `.github/workflows/release.yml`:
  paired Docker Hub/GHCR publication with OCI provenance and SBOM attestations.
- `scripts/run-integration-tests.mjs`: owned dependencies-only Compose harness
  with dynamic ports, database/Redis sentinels, migration deployment, API
  tests, and scoped cleanup.
- `plans/20260801-eventory-platform`: original delivery phases;
  `plans/20260801-release-hardening`: payment, worker, WebSocket, QR, CI, and
  portfolio hardening evidence.
- `scripts/verify-package-payloads.mjs`: dry-runs the five private reusable
  packages, compares exact payloads, and rejects missing declared entrypoints.
- `pnpm package:check`: builds `@eventory/config` and runs that package verifier.

## Important commands

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm package:check
pnpm --filter @eventory/web test
pnpm db:migrate
pnpm db:seed
pnpm test:integration
pnpm --filter @eventory/web build
docker compose up --build
```
