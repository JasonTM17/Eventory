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
it does not deploy or require production credentials.

Release `0.1.0` was built by the green main workflow for source commit
`d66e7b643bf603fdec2e2fb0486e5444f515df87` and published to Docker Hub. Both
semantic and full-SHA tags resolve to the same immutable manifest:

| Service | Pull reference                     | Manifest digest                                                           |
| ------- | ---------------------------------- | ------------------------------------------------------------------------- |
| API     | `nguyenson1710/eventory-api:0.1.0` | `sha256:a210cdc58aa3a4891f2e3d7bdb34863b2f1eb8094f01437e3e1b05f9ae376ea7` |
| Web     | `nguyenson1710/eventory-web:0.1.0` | `sha256:fd0b7ee19c5022920f2391ef300771b495166ee48db8a788b212bbadfb5ead0c` |

For reproducible deployment, pull by digest:

```bash
docker pull nguyenson1710/eventory-api@sha256:a210cdc58aa3a4891f2e3d7bdb34863b2f1eb8094f01437e3e1b05f9ae376ea7
docker pull nguyenson1710/eventory-web@sha256:fd0b7ee19c5022920f2391ef300771b495166ee48db8a788b212bbadfb5ead0c
```

These images run as the non-root `eventory` user. A deployment platform should
inject `DATABASE_URL`, `REDIS_URL`, non-default session/QR/payment secrets, a
production `METRICS_TOKEN`, and an explicit `CORS_ORIGINS` value. The published
web image uses the Dockerfile default `http://localhost:4000/api/v1`; rebuild it
with `NEXT_PUBLIC_API_BASE_URL` set to the public API origin for a hosted
environment.
