---
phase: 1
title: Session security
status: completed
priority: P1
effort: 4-6h
dependencies: []
---

# Phase 1: Session security

## Overview

Close login-CSRF/account-confusion on every endpoint that issues or rotates
session cookies. The global CSRF guard currently permits every unsafe request
with no existing session, which is correct for first-party registration but
unsafe for a cross-origin form that logs a victim into an attacker's account.

## Requirements

- Reject a cookie-issuing auth mutation when a browser supplies an Origin outside
  `CORS_ORIGINS`, even if the request has no existing session cookie.
- Inventory every route that calls `setSessionCookies` or clears session cookies;
  cover registration, login, refresh, and logout deliberately.
- Preserve intended first-party registration, login, refresh, and logout flows.
- Define and test the policy for originless non-browser clients and
  `Sec-Fetch-Site`, rather than silently accepting a browser bypass.
- Keep the existing CSRF protection for authenticated mutations intact.

## Architecture

Use a narrow guard/policy at the session-issuance boundary rather than making the
global CSRF policy over-broad. The identity controller is the boundary for
`register`, `login`, and `refresh`; the policy should normalize origins using
the same allowlist source as CORS. The policy must run before
`IdentityService` calls `setSessionCookies`. Logout is already authenticated,
but remains in the route inventory and test matrix because it mutates a session.

## Related Code Files

- Modify: `apps/api/src/common/security/csrf.guard.ts` — share safe origin
  normalization only if it avoids duplicated policy.
- Create or modify: `apps/api/src/common/security/session-origin.guard.ts` —
  scoped policy for endpoints that issue session cookies.
- Modify: `apps/api/src/modules/identity/identity.controller.ts` — apply the
  boundary guard to the correct mutation routes.
- Modify: `apps/api/test/security.e2e.test.ts` — add no-cookie cross-origin
  register/login/refresh regressions plus allowed and originless policy cases.
- Modify if needed: `apps/api/src/common/security/security.module.ts` or the
  nearest existing provider registration file.

## Implementation Steps

1. Trace every `setSessionCookies` and clear-cookie caller, then define the
   Origin, Referer, and `Sec-Fetch-Site` allow/deny matrix for browser and
   supported API-client flows.
2. Write E2E tests that submit `application/x-www-form-urlencoded` or JSON
   register/login/refresh requests with `Origin: https://evil.example` and no
   cookies; assert 403 and no session cookie. Cover configured first-party,
   originless, and logout behavior explicitly.
3. Implement a route-scoped session-origin policy using the existing
   `CORS_ORIGINS` parser. Do not weaken the current global guard to solve this.
4. Decide the explicit originless-client behavior and document it in API/security
   docs; favor an explicit non-browser contract over a silent bypass.
5. Run focused identity/security tests, then the full API suite.

## Success Criteria

- [x] A cross-origin registration, login, or refresh request cannot set an
      access or refresh cookie.
- [x] Valid same-origin login, registration, refresh, and logout behavior stays
      compatible.
- [x] Authenticated cross-origin mutations remain rejected.
- [x] Every session-cookie route has an explicit tested origin policy; no route
      relies on the absence of an existing cookie as its only CSRF defense.
- [x] No token, cookie, or password value is added to logs or test output.

## Risk Assessment

- Risk: rejecting legitimate API clients that omit Origin.
  Mitigation: make the client policy explicit, test it, and document an
  alternative non-cookie auth flow if one is supported.
- Rollback: revert only the new guard/controller binding; no schema migration.

## Security Considerations

- Covers OWASP A01/A07 and STRIDE spoofing/tampering.
- CORS alone is not a CSRF defense because cross-origin form posts are not
  blocked by the browser's CORS read policy.
