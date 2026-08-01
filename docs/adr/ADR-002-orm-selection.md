# ADR-002: Select Prisma for persistence

- Status: Accepted
- Date: 2026-08-01

## Context

The platform needs explicit migrations, typed queries, constraints, and transaction APIs for booking/payment/check-in races.

## Decision

Use Prisma with migrations from the first schema. Keep domain/application services independent of Prisma by isolating the client in infrastructure repositories and transaction adapters.

## Consequences

Schema and generated types are easy to review and seed locally. Complex SQL, partial indexes, and locking may use reviewed migrations or tagged SQL when the Prisma schema cannot express the invariant directly.

## Alternatives considered

- TypeORM: viable but less predictable for a greenfield strict-schema project.
- Raw SQL everywhere: maximum control but more repetitive mapping and weaker generated contract support.
