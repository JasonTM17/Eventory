# Release and local deployment guide

## Local stack

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
dev` from the repository. The optional monitoring profile is documented in the
[observability guide](./architecture/observability.md).

## Stop and reset

```bash
docker compose stop
docker compose down
```

Use `docker compose down --volumes` only when intentionally resetting the local
database and Redis data. It removes the project’s named volumes and cannot be
undone.

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

Semantic version tags run the release workflow. It verifies that every
workspace manifest matches the tag, builds each image once, and publishes the
same OCI manifest to Docker Hub and GitHub Container Registry with semantic,
`latest`, and full source-SHA tags. The workflow also publishes provenance and
SBOM attestations. Immutable digests are recorded in the corresponding GitHub
Release.

Current release `0.1.2` was built from `c3abeb64013fa88dc80b3550591462b2e4bdbd25`
for `linux/amd64`:

```bash
docker pull ghcr.io/jasontm17/eventory-api:0.1.2
docker pull ghcr.io/jasontm17/eventory-web:0.1.2
docker pull nguyenson1710/eventory-api:0.1.2
docker pull nguyenson1710/eventory-web:0.1.2
```

| Service | Manifest digest                                                           |
| ------- | ------------------------------------------------------------------------- |
| API     | `sha256:305e2e4ff3edb739da87bff67e2c74bbc465bf45cfdf1063407883496f19db6f` |
| Web     | `sha256:737e054e5e64f2ed9716939764a9da7ccbd089e57b2c5d6a2427f65a827e3629` |

See the [v0.1.2 release](https://github.com/JasonTM17/Eventory/releases/tag/v0.1.2)
for full-SHA references and immutable digests.

These images run as the non-root `eventory` user. A deployment platform should
inject `DATABASE_URL`, `REDIS_URL`, non-default session/QR/payment secrets, a
production `METRICS_TOKEN`, and an explicit `CORS_ORIGINS` value. The published
web image uses the Dockerfile default `http://localhost:4000/api/v1`; rebuild it
with `NEXT_PUBLIC_API_BASE_URL` set to the public API origin for a hosted
environment. Eventory does not expose a hosted public demo.
