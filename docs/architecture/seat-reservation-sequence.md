# Seat reservation sequence

```mermaid
sequenceDiagram
  participant Browser
  participant API
  participant PostgreSQL
  participant Redis
  participant WebSocket

  Browser->>API: GET /seating/{session}/availability
  API->>PostgreSQL: Read session allocations and seat geometry
  API->>Redis: MGET hold keys
  API-->>Browser: Durable status + temporary hold status

  Browser->>API: POST /seating/{session}/holds (seat IDs)
  API->>PostgreSQL: Validate session, sales window, allocation status
  API->>Redis: Atomic Lua check-and-set with PX TTL
  Redis-->>API: 1 success / 0 conflict
  API->>WebSocket: Broadcast held seat IDs to session room
  API-->>Browser: Opaque hold token + expiry

  Browser->>API: DELETE /seating/{session}/holds
  API->>Redis: Atomic owner check and delete
  API->>WebSocket: Broadcast available seat IDs
  API-->>Browser: Idempotent release result

  Redis-->>API: Key expiration notification
  API->>WebSocket: Broadcast available seat ID
  Note over API,PostgreSQL: Booking confirmation later revalidates the hold and commits sold state in one transaction.
```

Clients treat WebSocket messages as hints and refresh availability after reconnect, expiry, or a conflict response. No client claim or Redis value is enough to issue a ticket.
