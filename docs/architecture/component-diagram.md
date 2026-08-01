# Eventory component boundaries

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
  bookings --> outbox
  outbox --> notify
  bookings --> tickets
  tickets --> analytics
  events --> analytics
  payments --> analytics
```

Each box maps to a NestJS module with domain/application/infrastructure/presentation folders where the boundary is useful. Small modules may keep fewer layers, but they cannot bypass authorization, transaction, or event contracts.
