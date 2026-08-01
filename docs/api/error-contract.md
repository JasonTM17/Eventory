# API error contract

Every versioned API error is returned as JSON with the same top-level fields:

```json
{
  "statusCode": 409,
  "code": "SEAT_ALREADY_HELD",
  "message": "The selected seat is no longer available.",
  "requestId": "request-id",
  "details": {}
}
```

## Rules

- `statusCode` matches the HTTP response status.
- `code` is a stable machine-readable value; clients must not branch on prose.
- `message` is safe for a user-facing summary and never contains stack traces, SQL, secrets, or internal file paths.
- `requestId` matches the `x-request-id` response header and is safe to share with support.
- `details` contains bounded, field-level validation or conflict data; it is `{}` when no safe details exist.

## Status mapping

| Status | Use                                             |
| -----: | ----------------------------------------------- |
|    400 | Malformed request or validation failure         |
|    401 | Missing/invalid authentication                  |
|    403 | Authenticated but not allowed                   |
|    404 | Resource absent or intentionally undiscoverable |
|    409 | State or uniqueness conflict                    |
|    429 | Rate limit exceeded                             |
|    500 | Unexpected server failure                       |
|    503 | Dependency unavailable or service not ready     |
