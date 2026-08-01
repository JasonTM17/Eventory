# Eventory roadmap

## Delivered on `feature/eventory-platform`

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

## Next increments

- Replace mock payment/email adapters with reviewed provider implementations.
- Move rate limiting and metrics storage to managed/shared infrastructure for
  multiple API instances.
- Add offline scanner synchronization with explicit conflict resolution.
- Add managed secret rotation, alert routing, backups, and a deployment target.
- Add richer organizer reporting only after measuring query/index demand.
