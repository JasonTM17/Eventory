# Observability

## Signals

- `GET /api/v1/health/live` reports process liveness.
- `GET /api/v1/health/ready` checks PostgreSQL and Redis and returns `503` when
  either dependency is unavailable.
- `GET /api/v1/metrics` returns Prometheus text. In production it requires the
  `x-metrics-token` header; local/test environments may leave the token empty.
- Pino request logs include a bounded request ID and redact cookies,
  authorization, passwords, refresh tokens, QR/payment signatures, client
  secrets, and response `Set-Cookie` headers.

## Metric contract

HTTP counters use only `method`, the Nest route template (or a stable
controller/handler fallback), and status. The service caps the in-memory route
cardinality. Database/Redis gauges are intentionally aggregate and contain no
user, event, booking, ticket, or provider identifiers.

| Metric                                    | Meaning                              |
| ----------------------------------------- | ------------------------------------ |
| `eventory_http_requests_total`            | Request count by method/route/status |
| `eventory_http_request_duration_ms_total` | Cumulative request duration          |
| `eventory_bookings_total`                 | Durable bookings                     |
| `eventory_bookings_pending`               | Bookings awaiting payment            |
| `eventory_payments_succeeded_total`       | Successful durable payments          |
| `eventory_active_seat_holds`              | Redis hold keys                      |
| `eventory_checkins_total`                 | Durable ticket check-ins             |
| `eventory_outbox_pending`                 | Pending outbox events                |

## Local monitoring profile

The optional Compose `monitoring` profile runs Prometheus and Grafana:

```bash
docker compose --profile monitoring up -d prometheus grafana
```

Prometheus scrapes a locally running API at `host.docker.internal:4000`. Keep
the profile local/demo-only until a secured metrics gateway and persistent
Grafana credentials are configured.

## Response practice

Use the `x-request-id` value in incident reports. Logs and metrics are for
diagnostics, not a second data store: do not add email, raw QR payloads,
provider signatures, or authorization values to labels or messages.
