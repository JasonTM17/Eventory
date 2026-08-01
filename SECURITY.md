# Security Policy

## Scope

Eventory is a portfolio project and is not a production payment or identity service. The code still treats authentication, authorization, payment callbacks, seat concurrency, QR validation, and personal data as real trust boundaries.

## Reporting a vulnerability

Do not open a public issue for a suspected secret, account takeover, authorization bypass, payment forgery, or data exposure. Contact the project owner privately with reproduction steps, affected commit, impact, and a safe mitigation suggestion.

## Security expectations

- Keep secrets in environment variables or a managed secret store.
- Use Argon2id (or the documented modern equivalent) for passwords.
- Store refresh tokens hashed and rotate them on use.
- Verify resource ownership on the API, not only in the web app.
- Verify mock payment signatures and make webhook handling idempotent.
- Keep QR payloads opaque, signed, session-bound, and free of personal data.
- Never log passwords, refresh tokens, payment secrets, full QR signatures, or unnecessary PII.

Read the complete [threat model](./docs/security/threat-model.md),
[testing strategy](./docs/testing/test-strategy.md), and dependency outage
[runbooks](./docs/runbooks/) before operating the stack.

Before release, run `pnpm audit --prod`, the focused security tests, and the
repository secret scan. Rotate any credential that appears in a log, image,
branch, or CI artifact; do not paste the value into an issue.
