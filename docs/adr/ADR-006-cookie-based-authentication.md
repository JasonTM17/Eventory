# ADR-006: Use rotating cookie-based sessions

- Status: Accepted
- Date: 2026-08-01

## Context

The web client needs authenticated API requests without exposing long-lived refresh credentials to JavaScript. Sessions must support revocation, refresh-token reuse detection, and explicit logout while keeping access tokens short-lived.

## Decision

Eventory issues a short-lived signed access token and a random refresh token in separate `HttpOnly` cookies. The access token is verified on each request and the current user status is read from PostgreSQL. Refresh tokens are stored only as SHA-256 digests, rotated transactionally, and grouped by a family identifier. Reuse or replay revokes every token in the family.

Cookies use `SameSite=Lax`, `HttpOnly`, `Secure` in production, and narrow paths (`/api` for access and `/api/v1/auth` for refresh). CORS remains an explicit allow-list. Session-issuing routes require a trusted `Origin`/`Referer`; originless SSR/service callers must send `X-Eventory-Client: server` and omit Fetch Metadata headers such as `Sec-Fetch-Site`.

## Consequences

- Browser code cannot read refresh credentials.
- Logout and reuse detection are server-side operations that survive process restarts.
- Access-token verification performs a user lookup, which keeps suspension effective without waiting for token expiry.
- Cross-site state-changing requests still require the Origin CSRF boundary, and cross-site session issuance is rejected before a user or token is written; `SameSite` is defense-in-depth, not the sole control.

## Alternatives considered

- Local storage tokens: rejected because an XSS bug can extract long-lived credentials.
- Server-only opaque access sessions: viable, but adds a Redis/database lookup to every request and obscures the signed API contract.
- Better Auth session tables: not selected because Eventory needs explicit Prisma domain constraints and custom refresh-family reuse behavior.
