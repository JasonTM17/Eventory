# Eventory roadmap

## Delivered on `main`

1. Repository/tooling and local PostgreSQL/Redis/Mailpit foundation.
2. NestJS API, Prisma schema, identity, authorization, organizations, venues,
   events, and deterministic seed.
3. Next.js discovery/organizer UI and real-time atomic seat holds.
4. Transactional bookings, mock payment webhooks, outbox notifications.
5. Signed QR ticket wallet, online organizer check-in, analytics, and admin.
6. Rate limits, Origin CSRF, session-origin guard for login/register/refresh,
   body/security headers, audits, metrics, threat model, runbooks, monitoring
   profile, dependency audit fixes.
7. Docker images, Compose app services, CI workflows, and release docs.
8. Release hardening for durable checkout claims, monotonic payment recovery,
   reconciliation workers, owned integration tests, WebSocket handshakes, QR
   keyrings, and a verified local portfolio preview.

The current local verification baseline is `pnpm test:integration` with 17
suites, 46 tests, and 0 failures, plus format, lint, typecheck, web build,
audit, Prisma validation, and Compose config checks. A new remote workflow run
for local-only commits, a public deployment URL, and a license remain release
decisions rather than undocumented assumptions.

## Next increments

- Replace mock payment/email adapters with reviewed provider implementations.
- Move rate limiting and metrics storage to managed/shared infrastructure for
  multiple API instances.
- Add offline scanner synchronization with explicit conflict resolution.
- Add managed secret rotation, alert routing, backups, and a deployment target.
- Add richer organizer reporting only after measuring query/index demand.
