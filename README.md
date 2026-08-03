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

These artifacts were captured from a seeded, isolated local Compose stack and
show the public discovery, seat-selection, checkout, and ticket-wallet flows.
Payment and email delivery are deterministic local integrations; this
repository does not claim a public demo or a production payment-provider
connection. The wallet screenshot redacts its locally generated signed QR
payload before it is committed.

![Eventory public event discovery showing a seeded event](./assets/images/eventory-demo-discovery.png)

![Eventory seat map showing one selected seat in the seeded event](./assets/images/eventory-demo-seats.png)

![Eventory booking flow from event page through confirmed checkout](./assets/images/eventory-demo-booking-flow.gif)

![Eventory attendee wallet showing an issued ticket with its local demo QR payload redacted](./assets/images/eventory-demo-ticket-wallet.png)

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

The seed creates the published demo event with sales already open so the
discovery, seat-hold, checkout, and ticket flows can be exercised locally.

For host development, use `docker compose up -d postgres redis mailpit`, then
`pnpm db:migrate` and `pnpm dev`. Copy `.env.example` to `.env` when changing
ports or secrets. Never use the local defaults in production.

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm package:check
pnpm --filter @eventory/web test
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

![Eventory runtime architecture: browser, web, API, PostgreSQL, Redis, integrations, and observability](./assets/diagrams/eventory-runtime-architecture.png)

![Eventory booking lifecycle: selected seat, Redis hold, pending booking, payment callback, durable ticket, and QR check-in](./assets/diagrams/eventory-booking-lifecycle.png)

Read the [system overview](./docs/architecture/system-overview.md), [component boundaries](./docs/architecture/component-diagram.md), and [implementation plan](./docs/implementation-plan.md) before changing a module. Important trade-offs are recorded as ADRs under [`docs/adr`](./docs/adr).

The concise [codebase summary](./docs/codebase-summary.md), [architecture
guide](./docs/system-architecture.md), [code standards](./docs/code-standards.md),
[PDR](./docs/project-overview-pdr.md), and [roadmap](./docs/project-roadmap.md)
are useful onboarding entry points.

## Workspace package delivery

Every workspace package is private. `pnpm package:check` builds the compiled
configuration package, dry-runs config/contracts/UI/ESLint/TypeScript tarballs,
and compares every payload against an exact allow-list. The verifier also fails
when a declared `main` or `types` entrypoint is absent. Config ships `dist`,
contracts and UI retain their intentional source entrypoints, and the root
ESLint configuration consumes the packaged shared preset. This validates the
npm boundary without publishing the private workspaces; application containers
are released separately.

## Development rules

- Keep changes small and runnable; use Conventional Commits.
- Run the narrowest relevant format, lint, typecheck, and test commands before committing.
- Do not commit `.env` files, credentials, tokens, or personal data.
- PostgreSQL is the source of truth for permanent seat ownership; Redis is only for expiring holds.
- Backend authorization is the security boundary. UI checks improve UX but never replace API policy checks.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md) for the working agreement.

## License

This portfolio project is currently unlicensed. Add a license before distributing it outside the project owner’s intended audience.
