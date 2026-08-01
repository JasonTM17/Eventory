# Phase 1 Docs Sync Report

## Current State Assessment
- Security docs already described the new session-issuance boundary, but they were still vague on the originless server path.
- The code now enforces a narrow policy in `origin-policy.ts`: trusted `Origin` or `Referer`, otherwise `X-Eventory-Client: server` with no `Sec-Fetch-Site`.

## Changes Made
- Updated `docs/security/threat-model.md` to state the exact session issuance policy, including the Fetch Metadata constraint.
- Updated `docs/adr/ADR-006-cookie-based-authentication.md` to match the same server-client contract.
- Updated `docs/project-roadmap.md` to reflect the shipped session-origin guard in the Phase 1 security line.
- Updated `docs/system-architecture.md` to note the auth-boundary guard on register/login/refresh and the unchanged global CSRF guard for authenticated mutations.

## Gaps Identified
- No docs file in scope yet explains the full header matrix in table form.
- No user-facing API guide in scope was updated here.

## Recommendations
1. Keep the next security doc update focused on a single policy table for `Origin`, `Referer`, `Sec-Fetch-Site`, and `X-Eventory-Client`.
2. Add a short note to any future API auth guide that originless cookie issuance is server-only, not browser-facing.

## Metrics
- Docs touched: 4
- Broken links found: 0
- Code identifiers checked: `SessionOriginGuard`, `CsrfGuard`, `assertTrustedSessionIssuer`, `X-Eventory-Client`

## Unresolved Questions
- None.
