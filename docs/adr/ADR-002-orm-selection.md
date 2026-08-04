# ADR-002: Select Prisma for persistence

- Status: Accepted
- Date: 2026-08-01

## Context

The platform needs explicit migrations, typed queries, constraints, and transaction APIs for booking/payment/check-in races.

## Decision

Use Prisma with migrations from the first schema. The Prisma 7 `prisma-client` generator writes generated code under the API source tree, while `prisma.config.ts` owns the datasource URL used by CLI commands. Runtime access uses the PostgreSQL driver adapter so the generated client is created once by the infrastructure module and lifecycle-managed by NestJS. Keep domain/application services independent of Prisma by isolating the client in infrastructure services and transaction adapters; do not invent a generic repository abstraction just to hide the queries.

## Consequences

Schema and generated types are easy to review and seed locally. Complex SQL, partial indexes, and locking may use reviewed migrations or tagged SQL when the Prisma schema cannot express the invariant directly. `prisma migrate deploy` is the only production schema command; runtime startup never synchronizes schema automatically.

## Alternatives considered

- TypeORM: viable but less predictable for a greenfield strict-schema project.
- Raw SQL everywhere: maximum control but more repetitive mapping and weaker generated contract support.
