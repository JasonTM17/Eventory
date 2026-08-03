# Eventory

Eventory is a production-oriented full-stack event ticketing platform. It is designed as a modular monolith so the project can demonstrate reliable booking, real-time seat holds, simulated payments, signed QR tickets, authorization, observability, testing, and delivery automation without pretending that every feature needs a separate service.

[![Main validation](https://github.com/JasonTM17/Eventory/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/JasonTM17/Eventory/actions/workflows/main.yml)

## Repository status

The local release journey is implemented on the `main` branch. The phase plan,
architecture records, security model, CI, Docker
images, and operational runbooks are maintained alongside the code.

## Stack

- pnpm workspaces + Turborepo
- Next.js App Router + React + TypeScript
- NestJS modular monolith + Prisma
- PostgreSQL, Redis, BullMQ-style workers, and Mailpit
- Docker Compose and GitHub Actions

## Product preview

These screenshots were captured from the seeded local Compose stack and show
the public discovery and seat-selection flows. Payment and email delivery are
deterministic local integrations; this repository does not claim a public demo
or a production payment-provider connection.

![Eventory public event discovery showing a seeded event](./assets/images/eventory-demo-discovery.png)

![Eventory seat map showing available seats for the seeded event](./assets/images/eventory-demo-seats.png)

## Prerequisites

- Node.js 22 or newer
- pnpm 11 (`corepack enable` is recommended)
- Docker Desktop for PostgreSQL, Redis, and Mailpit integration work

## Quick start

```bash
pnpm install --frozen-lockfile
docker compose up --build -d
docker compose ps
```

Compose waits for PostgreSQL, Redis, and Mailpit, applies API migrations at
startup, and exposes the web app at [http://localhost:3000](http://localhost:3000)
and API at [http://localhost:4000/api/v1](http://localhost:4000/api/v1). Seed a
deterministic demo after the stack is healthy:

```bash
pnpm db:seed
```

For host development, use `docker compose up -d postgres redis mailpit`, then
`pnpm db:migrate` and `pnpm dev`. Copy `.env.example` to `.env` when changing
ports or secrets. Never use the local defaults in production.

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:integration
pnpm --filter @eventory/web build
pnpm audit --prod
docker compose config --quiet
```

Enable local Prometheus/Grafana with
`docker compose --profile monitoring up -d prometheus grafana`; see the
[observability guide](./docs/architecture/observability.md).

`pnpm test:integration` owns a temporary dependencies-only Compose project. It
publishes PostgreSQL, Redis, and Mailpit on dynamic ports, proves the database
is `eventory_test`, applies migrations there, runs the API suite, and cleans up
only that project. It never starts the application or outbox workers.

## Architecture

Read the [system overview](./docs/architecture/system-overview.md), [component boundaries](./docs/architecture/component-diagram.md), and [implementation plan](./docs/implementation-plan.md) before changing a module. Important trade-offs are recorded as ADRs under [`docs/adr`](./docs/adr).

The concise [codebase summary](./docs/codebase-summary.md), [architecture
guide](./docs/system-architecture.md), [code standards](./docs/code-standards.md),
[PDR](./docs/project-overview-pdr.md), and [roadmap](./docs/project-roadmap.md)
are useful onboarding entry points.

## Development rules

- Keep changes small and runnable; use Conventional Commits.
- Run the narrowest relevant format, lint, typecheck, and test commands before committing.
- Do not commit `.env` files, credentials, tokens, or personal data.
- PostgreSQL is the source of truth for permanent seat ownership; Redis is only for expiring holds.
- Backend authorization is the security boundary. UI checks improve UX but never replace API policy checks.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md) for the working agreement.

## License

This portfolio project is currently unlicensed. Add a license before distributing it outside the project owner’s intended audience.
