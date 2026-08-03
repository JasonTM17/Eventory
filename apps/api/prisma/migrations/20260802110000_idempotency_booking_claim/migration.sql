ALTER TABLE "idempotency_records"
  ADD COLUMN "bookingId" UUID;

CREATE INDEX "idempotency_records_bookingId_idx"
  ON "idempotency_records"("bookingId");

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
