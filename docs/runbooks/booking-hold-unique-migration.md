# Booking hold uniqueness migration runbook

The booking/payment integrity migration adds a database-owned unique invariant
on `bookings.holdId`. Redis holds remain temporary; PostgreSQL owns the durable
one-checkout claim.

## Preflight

Run the migration against a backup or staging copy first. The migration checks
for duplicate `holdId` values and fails with:

```text
Cannot enforce unique bookings.holdId: duplicate hold ids require manual remediation
```

This is intentional. Do not choose a winner, delete bookings, or edit payment
rows inside the migration.

## Duplicate-data remediation

1. Stop new checkout writes or put the affected deployment in maintenance mode.
2. Export the duplicate groups, their bookings, payments, payment events,
   tickets, seat allocations, and audit records.
3. Have an owner decide which historical checkout is authoritative and record
   the decision in an approved forward migration or operator procedure.
4. Reconcile any captured payment before removing or superseding a duplicate;
   preserve the audit trail and never silently issue a refund or ticket.
5. Re-run the migration only after a reviewed check confirms every `holdId` is
   unique.

## Validation and rollback

The migration is forward-only once the unique index is created. Validate on a
clean database, inspect `_prisma_migrations`, and run the focused booking/
payment tests before reopening checkout. If a later defect is found, deploy a
corrective forward migration; do not roll back application code while leaving
the database invariant partially applied.
