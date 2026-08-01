# Eventory

Eventory is a production-oriented full-stack event ticketing platform. It is designed as a modular monolith so the project can demonstrate reliable booking, real-time seat holds, simulated payments, signed QR tickets, authorization, observability, testing, and delivery automation without pretending that every feature needs a separate service.

## Repository status

The repository foundation is in place. Business modules are being implemented phase-by-phase from the [implementation plan](./docs/implementation-plan.md). The first two commits establish the pnpm/Turborepo workspace and strict TypeScript/ESLint/Prettier tooling; later phases add the runnable API, web app, and local infrastructure.

## Stack

- pnpm workspaces + Turborepo
- Next.js App Router + React + TypeScript
- NestJS modular monolith + Prisma
- PostgreSQL, Redis, BullMQ-style workers, and Mailpit
- Docker Compose and GitHub Actions

## Prerequisites

- Node.js 22 or newer
- pnpm 11 (`corepack enable` is recommended)
- Docker Desktop for PostgreSQL, Redis, and Mailpit integration work

## Current checks

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
```

The database and application start commands will be enabled as their phases land:

```bash
docker compose up -d postgres redis mailpit
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Architecture

Read the [system overview](./docs/architecture/system-overview.md), [component boundaries](./docs/architecture/component-diagram.md), and [implementation plan](./docs/implementation-plan.md) before changing a module. Important trade-offs are recorded as ADRs under [`docs/adr`](./docs/adr).

## Development rules

- Keep changes small and runnable; use Conventional Commits.
- Run the narrowest relevant format, lint, typecheck, and test commands before committing.
- Do not commit `.env` files, credentials, tokens, or personal data.
- PostgreSQL is the source of truth for permanent seat ownership; Redis is only for expiring holds.
- Backend authorization is the security boundary. UI checks improve UX but never replace API policy checks.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md) for the working agreement.

## License

This portfolio project is currently unlicensed. Add a license before distributing it outside the project owner’s intended audience.
