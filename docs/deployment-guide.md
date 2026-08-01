# Local deployment guide

## Local full stack

Copy `.env.example` to `.env` when you need overrides, then start the complete
stack:

```bash
docker compose up --build -d
pnpm wait:dependencies
docker compose ps
```

The web app is available at `localhost:3000`, API at `localhost:4000`,
PostgreSQL at `localhost:5432`, Redis at `localhost:6379`, SMTP capture at
`localhost:1025`, and Mailpit UI at [http://localhost:8025](http://localhost:8025).
The API container applies migrations before serving. Run `pnpm db:seed` after
readiness when a demo dataset is needed.

For host development, start only dependencies and run `pnpm db:migrate`/`pnpm
dev` from the repository. The optional monitoring profile is documented in
the [observability guide](./architecture/observability.md).

## Stop and reset

```bash
docker compose stop
docker compose down
```

Use `docker compose down --volumes` only when intentionally resetting the local database and Redis data. It removes the project’s named volumes and cannot be undone.

## Troubleshooting

- `docker compose config` validates interpolation before startup.
- `docker compose ps` shows health status and mapped ports.
- `docker compose logs postgres redis mailpit` shows dependency logs.
- If a port is already occupied, override the corresponding `*_PORT` value in `.env` and rerun `docker compose up -d`.
- If the wait script fails, check Docker Desktop and run `docker compose up -d postgres redis mailpit` again.
- If an API/web image fails to build, run `docker compose config --quiet`, check
  available disk, and inspect the build output before pruning only recreatable
  build cache.

## CI and release artifacts

Pull requests run the full quality matrix and build both images. The main
workflow tags images with the commit SHA and uploads compressed image archives;
it does not deploy or require production credentials. A deployment platform
should inject `DATABASE_URL`, `REDIS_URL`, non-default session/QR/payment
secrets, a production `METRICS_TOKEN`, and an explicit `CORS_ORIGINS` value.
