# Eventory test strategy

## Test pyramid

| Layer         | Scope                                     | Examples                                                           |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Unit          | Pure policies, signing, guards, parsers   | QR payload verification, password policy, rate-limit budget        |
| Integration   | Nest module + real PostgreSQL/Redis       | identity sessions, organizations, event inventory, outbox delivery |
| Concurrency   | Competing requests against the same state | seat holds and eight simultaneous QR scans                         |
| Contract/UI   | Shared DTOs and Next.js routes            | discovery, seat selection, checkout, ticket wallet, admin console  |
| Build/quality | Repository-wide regressions               | format, ESLint, TypeScript, Prisma validation, web/API builds      |

## Local prerequisites

Start the dependency services and apply migrations before API integration
tests:

```powershell
docker compose up -d postgres redis mailpit
$env:DATABASE_URL='postgresql://eventory:eventory@127.0.0.1:55434/eventory?schema=public'
$env:REDIS_URL='redis://127.0.0.1:56381'
$env:MAILPIT_PORT='11026'
$env:OUTBOX_WORKER_ENABLED='false'
pnpm db:migrate
pnpm --filter @eventory/config build
```

Use the ports from `.env` if another local mapping is configured. Tests never
call a real payment or email provider; Mailpit is the local SMTP boundary.

## Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm --filter @eventory/api test
pnpm --filter @eventory/web build
pnpm --filter @eventory/api db:validate
```

For a focused API e2e file, run it from `apps/api` with the test environment
variables above:

```powershell
node --require ts-node/register --test test/check-in.e2e.test.ts
```

## Determinism and cleanup

- Test suites use unique email/slug prefixes and `concurrency: false` when
  they share database fixtures.
- The API test script runs files sequentially because each suite owns a real
  PostgreSQL/Redis application fixture; concurrency assertions remain explicit
  inside the relevant suites.
- Cleanup follows foreign-key order: dependent users/bookings/tickets first,
  then organizations and venues. Do not use `down --volumes` as a test helper.
- Each concurrent scenario asserts both the winning result and all losing
  results; a happy-path response alone is insufficient.
- Generated Prisma/config output is rebuilt when source environment parsing
  changes so ts-node tests exercise current contracts.

## Security and failure matrix

Every sensitive route should have a success and a failure assertion for:

- missing/invalid identity and suspended users;
- wrong organization or resource owner;
- malformed, replayed, forged, or cross-session QR/payment input;
- duplicate idempotency keys and concurrent state transitions;
- rate-limit exhaustion, rejected origins, oversized/unknown request fields;
- dependency outage reflected by readiness and a safe error response.

## CI acceptance

CI must run the same format, lint, typecheck, API tests, web build, Prisma
validation, and migration checks as local development. Docker image builds are
an additional packaging gate; external deployment credentials are never needed
for pull requests.
