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
- `packages/typescript-config` and `packages/eslint-config`: shared tooling.

## Infrastructure and workflows

- `compose.yaml`: PostgreSQL, Redis, Mailpit, API, web, and optional monitoring.
- `apps/api/Dockerfile` and `apps/web/Dockerfile`: multi-stage non-root images.
- `.github/workflows/pull-request.yml`: dependency-backed tests and image
  builds; `.github/workflows/main.yml`: repeat validation and versioned image
  artifacts.
- `plans/20260801-eventory-platform`: phase files and acceptance evidence.

## Important commands

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm --filter @eventory/api db:migrate
pnpm --filter @eventory/api db:seed
pnpm --filter @eventory/api test
pnpm --filter @eventory/web build
docker compose up --build
```
