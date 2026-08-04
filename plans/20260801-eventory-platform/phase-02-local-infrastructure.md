---
phase: 2
title: Local infrastructure
status: completed
effort: ''
---

# Phase 2: Local infrastructure

## Overview

Provide reproducible local PostgreSQL, Redis, and Mailpit services with health checks, named volumes, environment wiring, and developer scripts. Application containers may be added later, but the dependency stack must be usable now.

## Requirements

- Functional: `docker compose up -d postgres redis mailpit` starts healthy services; scripts expose migration/seed/dev commands.
- Non-functional: non-secret defaults, persistent named volumes, bounded health probes, and clear failure messages.

## File inventory

| Action | Paths                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------- |
| Create | `compose.yaml`, `infrastructure/docker/postgres-init/`, `infrastructure/docker/redis/`, `.dockerignore` |
| Create | `scripts/check-dependencies.*`, `scripts/wait-for-services.*`, `docs/deployment-guide.md`               |

## Architecture

Compose services are dependency infrastructure only. PostgreSQL exposes the API database, Redis exposes expiring seat holds, and Mailpit captures email. Health checks are the contract consumed by later API and CI services.

## Implementation Steps

1. Define service versions, ports, credentials sourced from `.env`, named volumes, and health checks.
2. Add local scripts that wait for healthy dependencies without busy loops or platform-specific assumptions.
3. Add optional monitoring/reverse-proxy profiles without making them prerequisites for the MVP.
4. Document startup, shutdown, reset, and troubleshooting commands.
5. Run compose config validation and a smoke connection check where Docker is available.

## Test scenario matrix

| Scenario        | Check                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Healthy startup | Compose reports PostgreSQL, Redis, and Mailpit healthy.               |
| Restart         | Services restart without losing named-volume data.                    |
| Missing env     | Validation fails with the variable name and remediation.              |
| Local reset     | Documented reset removes only project volumes after explicit command. |

## Success Criteria

- [ ] Compose file validates and starts dependency services.
- [ ] Health checks are consumed by scripts and documented.
- [ ] No credentials are committed outside non-production `.env.example` values.

## Dependency map

Depends on phase 1 manifests and environment contract; unblocks API/database and local integration tests.

## Risk Assessment

Do not couple application correctness to Docker availability; unit tests must still run without containers, while integration tests clearly report missing dependencies.
