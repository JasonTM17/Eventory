# Eventory code standards

## Structure

- `apps/api/src/common` contains cross-cutting HTTP, auth, security, and
  observability concerns.
- `apps/api/src/modules/<domain>` owns controllers, DTOs, services, and module
  wiring for one business boundary.
- `apps/api/prisma` contains the schema, migrations, and deterministic seed.
- `apps/web/app` contains route-level server components; `apps/web/src`
  contains reusable client components and API helpers.
- `packages/contracts`, `packages/ui`, and `packages/config` are shared
  boundaries with no database access.
- `docs/adr` records decisions; `plans/` records executable phase scope.

## TypeScript

- Use strict TypeScript, `unknown` at untrusted boundaries, and explicit
  return types for public service/controller methods.
- Prefer existing domain types and Prisma-generated enums over duplicate
  string unions. Avoid `any`; narrow external values with DTOs or predicates.
- Use NodeNext `.js` import extensions in source imports.
- Keep files below roughly 200 lines when a real domain boundary can reduce
  complexity; do not split simple configuration or markdown mechanically.

## API and data

- Controllers translate HTTP to typed service calls; business invariants live
  in services and policies.
- DTOs use `class-validator` with global whitelist, transform, and forbidden
  unknown properties. Add length/range/format limits at the boundary.
- Use Prisma transactions for state transitions and idempotency constraints
  for retried external events. Never use Redis as durable inventory.
- Queries must scope by user/organization before returning a resource. Admin
  lists select safe fields explicitly and page deterministically.
- Error responses use the shared `{ statusCode, code, message, requestId,
details }` contract; do not return stack traces.

## Security

- Hash passwords with Argon2id; store only refresh-token hashes; use secure
  cookie options in production.
- Add `@Public`, `@Roles`, organization policy, and/or `@RateLimit` metadata
  intentionally. API authorization is never delegated to the web UI.
- Do not log credentials, cookies, QR/payment signatures, provider secrets, or
  unnecessary PII. Update Pino redaction when adding a sensitive field.
- Use cryptographic randomness (`node:crypto`) for tokens/nonces and constant
  time comparison for signatures.

## Testing and commits

- Add a focused unit/integration/concurrency test for new behavior and at
  least one failure/authorization path.
- Run the narrowest useful test first, then format/lint/typecheck/build gates.
- Keep Conventional Commits focused (`feat:`, `fix:`, `test:`, `docs:`,
  `chore:`); never commit dotenv files, credentials, or generated secrets.
- Update docs when behavior, commands, architecture, security posture, or
  public contracts change.
