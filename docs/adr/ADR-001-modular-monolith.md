# ADR-001: Use a modular monolith

- Status: Accepted
- Date: 2026-08-01

## Context

Eventory has many domains but a single portfolio deployment target. Splitting every domain into a service would multiply operational and consistency problems before the business rules are proven.

## Decision

Keep the backend in one NestJS process with explicit module boundaries, ports for external systems, and transactional database ownership. Extract a service only after a measured scaling or isolation need exists.

## Consequences

We get simpler local development and cross-domain transactions, while dependency boundaries and queue workers still demonstrate production design. The monolith must resist direct cross-module table writes and unbounded imports.

## Alternatives considered

- Microservices now: rejected due to operational overhead and distributed transaction complexity.
- One unstructured NestJS folder: rejected because authorization and booking invariants would become implicit.
