# Eventory test strategy

## Test pyramid

| Layer         | Scope                                     | Examples                                                             |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Unit          | Pure policies, signing, guards, parsers   | QR payload verification, password policy, rate-limit budget          |
| Integration   | Nest module + real PostgreSQL/Redis       | identity sessions, organizations, event inventory, outbox delivery   |
| Concurrency   | Competing requests against the same state | seat holds and eight simultaneous QR scans                           |
| Contract/UI   | Shared DTOs and Next.js routes            | discovery, seat selection, checkout hold cleanup, ticket wallet      |
| Build/quality | Repository-wide regressions               | format, ESLint, TypeScript, package payloads, Prisma, web/API builds |

## Local prerequisites

Run the owned integration target for API integration tests:

```powershell
pnpm test:integration
```

The runner starts only PostgreSQL, Redis, and Mailpit in a unique Compose
project, discovers dynamic host ports, verifies the `eventory_test` database
sentinel, applies migrations, and then starts tests with both workers disabled.
Tests never call a real payment or email provider; Mailpit is the local SMTP
boundary. A wrong database or unavailable dependency fails before migrations.

## Commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm package:check
pnpm --filter @eventory/web test
pnpm test:integration
pnpm --filter @eventory/web build
pnpm --filter @eventory/api db:validate
```

For a focused API test file, first run the owned dependency target or provide
equivalent `eventory_test`/Redis services, then run it from `apps/api`:

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
- `apps/api/test/seating-websocket.e2e.test.ts` exercises native WebSocket and
  browser-style Engine.IO polling handshakes. It proves trusted origins receive
  credentialed CORS headers while hostile origins are rejected before
  application traffic begins.
- Generated Prisma/config output is rebuilt when source environment parsing
  changes so ts-node tests exercise current contracts.
- The dependencies-only Compose target has no application or outbox worker;
  test assertions cannot be consumed by a concurrently running worker.

## Security and failure matrix

Every sensitive route should have a success and a failure assertion for:

- missing/invalid identity and suspended users;
- wrong organization or resource owner;
- malformed, replayed, forged, or cross-session QR/payment input;
- duplicate idempotency keys and concurrent state transitions;
- rate-limit exhaustion, rejected origins, oversized/unknown request fields;
- dependency outage reflected by readiness and a safe error response.

## CI acceptance

CI must run the same format, lint, typecheck, private-workspace package
dry-run, focused web regression, API tests, web build, Prisma validation, and
migration checks as local development. Docker image builds are an additional
packaging gate; external deployment credentials are never needed for pull
requests.
