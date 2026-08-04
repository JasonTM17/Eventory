# Security Policy

## Scope

Eventory is a non-production reference implementation. It does not process real
payments or operate a hosted identity service, but authentication,
authorization, callbacks, seat concurrency, QR validation, and personal data
are treated as real trust boundaries.

## Reporting a vulnerability

Do not open a public issue for a suspected secret, account takeover,
authorization bypass, payment forgery, or data exposure. Report privately in
[GitHub Security Advisories](https://github.com/JasonTM17/Eventory/security/advisories/new)
with the affected commit, impact, reproduction steps, and a safe mitigation
suggestion. Private vulnerability reporting is enabled for this repository.

## Security expectations

- Keep secrets in environment variables or a managed secret store.
- Use Argon2id for passwords and store refresh tokens only as hashes.
- Verify resource ownership on the API, not only in the web app.
- Verify mock payment signatures and make webhook handling idempotent.
- Keep QR payloads opaque, signed, session-bound, and free of personal data.
- Never log passwords, refresh tokens, payment secrets, full QR signatures, or unnecessary PII.
- Treat release publication as artifact publication only; it is not a hosted deployment.

Read the complete [threat model](./docs/security/threat-model.md),
[testing strategy](./docs/testing/test-strategy.md), and dependency outage
[runbooks](./docs/runbooks/) before operating the stack.

Before tagging a release, require a successful Main validation run for the
release commit. That workflow runs the repository's format, lint, type, package,
schema, test, production-audit, Compose, web-build, and image-build gates.
Inspect the staged diff for credentials and keep GitHub secret scanning and push
protection enabled. Rotate any credential that appears in a log, image, branch,
or CI artifact; do not paste the value into an issue.
