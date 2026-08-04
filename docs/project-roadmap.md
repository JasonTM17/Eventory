# Eventory roadmap

## Delivered on `main`

1. Repository/tooling and local PostgreSQL/Redis/Mailpit foundation.
2. NestJS API, Prisma schema, identity, authorization, organizations, venues,
   events, and deterministic seed.
3. Next.js discovery/organizer UI, server/client component boundaries, and
   real-time atomic seat holds.
4. Transactional bookings, mock payment webhooks, payment reconciliation,
   and outbox notifications.
5. Signed QR ticket wallet, online organizer check-in, analytics, and admin.
6. Rate limits, Origin CSRF, session-origin guard for login/register/refresh,
   body/security headers, audits, metrics, threat model, runbooks, monitoring
   profile, dependency audit fixes.
7. Docker images, Compose app services, CI workflows, and release docs.
8. Release hardening for durable checkout claims, monotonic payment recovery,
   reconciliation workers, owned integration tests, browser-compatible trusted
   WebSocket handshakes, QR keyrings, and a verified local portfolio preview.
9. Exact private-workspace package payload checks, real product GIF/screenshots,
   and exported runtime/booking diagrams.
10. Paired Docker Hub/GHCR release packages with semantic/full-SHA tags,
    provenance, SBOM attestations, changelog, and GitHub Release records for
    `v0.1.2`.

The current local verification baseline is 17 API suites with 47 tests and 0
failures against an owned Compose dependency project, plus the 4-file web
suite with 10 test cases, format, lint, typecheck, package payload, web build,
audit, Prisma validation, and Compose config checks. The current release
artifacts are `v0.1.2` from `c3abeb64013fa88dc80b3550591462b2e4bdbd25`; a
public deployment URL remains a release decision rather than an undocumented
assumption.

## Next increments

- Replace mock payment/email adapters with reviewed provider implementations.
- Move rate limiting and metrics storage to managed/shared infrastructure for
  multiple API instances.
- Add offline scanner synchronization with explicit conflict resolution.
- Add managed secret rotation, alert routing, backups, and a deployment target.
- Add richer organizer reporting only after measuring query/index demand.
