# Eventory business capability flow

```mermaid
flowchart LR
  identity[Identity and users]
  orgs[Organizations]
  venues[Venues and seating]
  events[Events and sessions]
  bookings[Bookings]
  payments[Payments]
  tickets[Tickets and check-in]
  notify[Notifications]
  analytics[Analytics and admin]
  outbox[Transactional outbox]

  identity --> orgs
  orgs --> events
  venues --> events
  events --> bookings
  bookings --> payments
  payments --> outbox
  payments --> analytics
  bookings --> outbox
  outbox --> notify
  bookings --> tickets
  tickets --> analytics
  events --> analytics
  payments --> analytics
```

This diagram shows business flow, not the NestJS import graph. Services are
organized primarily as flat Nest modules and may share Prisma transactions
across capabilities. Authorization, transaction, webhook-inbox,
reconciliation, and outbox contracts remain explicit even when one service
coordinates several tables.
