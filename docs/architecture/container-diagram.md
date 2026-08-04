# Eventory container diagram

```mermaid
flowchart TB
  subgraph client[Client boundary]
    browser[Browser: Next.js App Router]
  end

  subgraph runtime[Application runtime]
    api[NestJS modular monolith + in-process workers]
  end

  subgraph data[Stateful dependencies]
    postgres[(PostgreSQL)]
    redis[(Redis)]
    mailpit[Mailpit]
  end

  browser -->|HTTP, cookies, WebSocket| api
  api --> postgres
  api --> redis
  api --> mailpit
```

The web app and API may run as separate containers but remain one product
boundary. Workers share the API codebase and domain contracts and execute
inside the API process, gated by feature flags rather than a separate worker
container.
