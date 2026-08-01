# Redis unavailable runbook

## Symptoms

- `GET /api/v1/health/ready` returns `503` with `redis: down`.
- Seat availability or holds fail, or WebSocket seat updates stop.
- Metrics may report zero active holds while Redis is unreachable; this is a
  degraded observation, not proof that holds are empty.

## Safe checks

1. Check `docker compose ps redis` and `docker compose logs --tail=100 redis`.
2. Run `redis-cli -h 127.0.0.1 -p <mapped-port> ping` and verify the configured
   `REDIS_URL` matches the running service.
3. Check disk and memory before restarting; do not delete the Redis volume as
   a first response.
4. Preserve the request ID and timestamp for any failed checkout or hold.

## Recovery

- Restart only the dependency: `docker compose restart redis`.
- Wait for the health check, then call readiness again. Expired holds can be
  recreated by users; PostgreSQL remains the source of truth for sold seats.
- If persistence is corrupt, stop traffic, take a copy of the named volume,
  and follow a reviewed restore procedure. Never flush Redis in a shared
  environment.

## Guardrails

Do not mark seats sold, confirm payments, or edit booking rows manually while
Redis is unavailable. If recovery is not immediate, keep checkout closed and
communicate the degraded state rather than bypassing the hold invariant.
