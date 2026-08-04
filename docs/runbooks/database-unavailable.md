# PostgreSQL unavailable runbook

## Symptoms

- `GET /api/v1/health/ready` returns `503` with `database: down`.
- API writes fail with a safe `Unexpected server error` and a request ID.
- Metrics database gauges fall back to zero and should be treated as unknown.

## Safe checks

1. Check `docker compose ps postgres` and recent logs without sharing secrets.
2. Verify `DATABASE_URL`, mapped port, database name, and connection limits.
3. Run `pg_isready -h 127.0.0.1 -p <mapped-port> -U <user> -d <database>`.
4. Check disk space and active connections before restarting; capture the
   request ID and time window for failed operations.

## Recovery

- Restart only PostgreSQL after confirming no migration is running:
  `docker compose restart postgres`.
- Wait for the database health check, verify connectivity, and inspect
  `pnpm --filter @eventory/api exec prisma migrate status`. Apply pending
  migrations only through a separate approved deployment window with backup,
  compatibility, and lock-impact checks.
- Reopen traffic only after application smoke checks and worker backlog/state
  checks. `/api/v1/health/ready` proves PostgreSQL and Redis connectivity only;
  it does not prove schema compatibility, SMTP delivery, worker liveness,
  backups, or reconciliation health.
- Restore from a verified backup only with an approved change window. Validate
  migrations and foreign-key integrity before reopening sales.

## Guardrails

Never delete the named Postgres volume to fix an availability incident. Never
replay a payment blindly after a timeout: first inspect the provider event ID
and `payment_events` idempotency row. Reconcile through a reviewed command so
that booking, seat, payment, ticket, and outbox state remain consistent.
Do not treat an outage as a trigger for automatic schema repair; apply reviewed
migrations only after the database is healthy.
