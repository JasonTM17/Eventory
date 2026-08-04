# ADR-001: Use a modular monolith

- Status: Accepted
- Date: 2026-08-01

## Context

Eventory has many domains but a single portfolio deployment target. Splitting every domain into a service would multiply operational and consistency problems before the business rules are proven.

## Decision

Keep the backend in one NestJS process with explicit module boundaries, ports
for external systems, and shared Prisma transactions when workflows span
aggregates. Extract a service only after a measured scaling or isolation need
exists.

## Consequences

We get simpler local development and cross-domain transactions. Module imports
and controllers provide code boundaries, while persistence ownership is a
review convention because services share Prisma and may coordinate
cross-domain transactions.

## Alternatives considered

- Microservices now: rejected due to operational overhead and distributed transaction complexity.
- One unstructured NestJS folder: rejected because authorization and booking invariants would become implicit.
