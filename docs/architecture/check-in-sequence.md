# Ticket and check-in sequence

```mermaid
sequenceDiagram
  participant Attendee
  participant Scanner
  participant API
  participant DB as PostgreSQL

  Attendee->>API: GET /tickets (authenticated)
  API->>DB: Read owned ticket + nonce + key version
  API->>API: Sign versioned QR payload with session binding hash
  API-->>Attendee: Ticket details + QR data URL input

  Scanner->>API: POST /check-in (QR payload, optional session)
  API->>API: Verify HMAC, key version, payload shape
  API->>DB: Resolve opaque code and session binding
  API->>DB: Check organizer membership for event organization
  API->>DB: Transaction: conditional ISSUED → CHECKED_IN
  API->>DB: Insert unique ticket_check_ins row
  API-->>Scanner: VALID, ALREADY_CHECKED_IN, or non-valid result
```

The QR payload contains a version, opaque ticket code, a one-way event-session binding, nonce, key version, and signature. It does not contain names, email addresses, or raw database identifiers. A scanner must be online so PostgreSQL remains authoritative; the unique `ticket_id` constraint and conditional status update decide concurrent scans.
