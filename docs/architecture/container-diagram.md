# Eventory container diagram

```mermaid
flowchart TB
  subgraph client[Client boundary]
    browser[Browser: Next.js App Router]
  end

  subgraph runtime[Application runtime]
    api[NestJS modular monolith]
    worker[Queue and outbox workers]
  end

  subgraph data[Stateful dependencies]
    postgres[(PostgreSQL)]
    redis[(Redis)]
    mailpit[Mailpit]
  end

  browser -->|HTTP, cookies, WebSocket| api
  api --> postgres
  api --> redis
  worker --> postgres
  worker --> redis
  worker --> mailpit
```

The web app and API may run as separate containers but remain one product boundary. Workers share the API codebase and domain contracts while running as a separate process profile when queue throughput requires it.
