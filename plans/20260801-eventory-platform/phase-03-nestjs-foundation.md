---
phase: 3
title: 'NestJS foundation'
status: pending
effort: ''
---

# Phase 3: NestJS foundation

## Overview

Initialize the NestJS modular monolith, Prisma migration boundary, configuration validation, structured request logging/correlation, API error contracts, OpenAPI, and health/readiness/liveness endpoints.

## Requirements

- Functional: `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`, and OpenAPI are available with stable response/error shapes.
- Non-functional: strict config validation, request IDs, JSON logs without secrets, graceful shutdown, and no auto schema synchronization.

## File inventory

| Action | Paths                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `apps/api/package.json`, `apps/api/tsconfig*.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`                                                |
| Create | `apps/api/src/config/`, `apps/api/src/common/`, `apps/api/src/infrastructure/database/`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` |
| Create | `apps/api/test/health.e2e-spec.ts`, `docs/api/error-contract.md`, `docs/adr/ADR-002-orm-selection.md`                                                   |

## Architecture

`main.ts` owns process bootstrap and middleware only. `common` owns cross-cutting concerns. Prisma is injected through a lifecycle-safe database service; modules depend on an application-facing database port rather than constructing clients. Health readiness checks database and Redis connectivity separately from liveness.

## Implementation Steps

1. Scaffold NestJS app and API version prefix.
2. Add typed environment schema, configuration module, request ID middleware/interceptor, and structured logger.
3. Add Prisma service, baseline schema metadata, migration scripts, and transaction helper conventions.
4. Add validation pipe, consistent exception filter, OpenAPI setup, security headers, and graceful shutdown hooks.
5. Add health indicators and focused unit/API tests.
6. Commit API bootstrap, observability baseline, health endpoints, and ORM migration system separately.

## Test scenario matrix

| Scenario             | Check                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| Invalid config       | Process exits with actionable variable errors.                                  |
| Correlated request   | Response and log share a request ID; caller-supplied IDs are bounded/validated. |
| Database unavailable | Readiness fails without exposing stack traces; liveness remains meaningful.     |
| API error            | Error body contains status, code, message, requestId, and safe details.         |

## Success Criteria

- [ ] API boots in development and test modes.
- [ ] Migration from empty PostgreSQL is deterministic.
- [ ] Health and error contract tests pass.
- [ ] No secret or stack trace appears in production responses/logs.

## Dependency map

Depends on phases 1-2. Unblocks all domain modules and API integration tests.

## Risk Assessment

Avoid overloading health checks with expensive queries. Keep logger adapters replaceable so tests remain deterministic.
