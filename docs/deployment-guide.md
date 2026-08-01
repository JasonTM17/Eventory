# Local deployment guide

## Dependency services

Copy `.env.example` to `.env` when you need overrides, then start the local dependency stack:

```bash
docker compose up -d postgres redis mailpit
pnpm wait:dependencies
docker compose ps
```

PostgreSQL is available at `localhost:5432`, Redis at `localhost:6379`, SMTP capture at `localhost:1025`, and the Mailpit UI at [http://localhost:8025](http://localhost:8025). The Compose file uses named volumes so a normal restart preserves local data.

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
