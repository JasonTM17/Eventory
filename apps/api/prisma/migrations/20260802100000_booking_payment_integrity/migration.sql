-- Keep the payment state machine explicit for captures that cannot be fulfilled
-- automatically after a seat hold expires.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_RECONCILIATION';

CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "idempotency_records"
  ADD COLUMN "requestFingerprint" VARCHAR(128);

-- Existing payments predate durable provider claims. A booking has exactly one
-- payment, so its id is a safe legacy identity for the forward migration.
ALTER TABLE "payments"
  ADD COLUMN "providerIdempotencyKey" VARCHAR(160),
  ADD COLUMN "providerAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "providerLastError" VARCHAR(500),
  ADD COLUMN "reconciliationRequiredAt" TIMESTAMP(3);

UPDATE "payments"
SET "providerIdempotencyKey" = 'legacy:' || "bookingId"::text
WHERE "providerIdempotencyKey" IS NULL;

ALTER TABLE "payments"
  ALTER COLUMN "providerIdempotencyKey" SET NOT NULL,
  ALTER COLUMN "providerReference" DROP NOT NULL;

CREATE UNIQUE INDEX "payments_providerIdempotencyKey_key"
  ON "payments"("providerIdempotencyKey");

-- Do not silently pick a winner if historical data already contains more than
-- one checkout for a Redis hold. Remediate duplicates before rerunning.
DO $$
BEGIN
  IF EXISTS (
    SELECT "holdId"
    FROM "bookings"
    GROUP BY "holdId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce unique bookings.holdId: duplicate hold ids require manual remediation';
  END IF;
END $$;

DROP INDEX IF EXISTS "bookings_holdId_idx";
CREATE UNIQUE INDEX "bookings_holdId_key" ON "bookings"("holdId");

CREATE TABLE "payment_reconciliations" (
  "id" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "providerEventId" VARCHAR(160) NOT NULL,
  "reason" VARCHAR(160) NOT NULL,
  "status" "PaymentReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_reconciliations_paymentId_key"
  ON "payment_reconciliations"("paymentId");
CREATE UNIQUE INDEX "payment_reconciliations_providerEventId_key"
  ON "payment_reconciliations"("providerEventId");
CREATE INDEX "payment_reconciliations_status_createdAt_idx"
  ON "payment_reconciliations"("status", "createdAt");

ALTER TABLE "payment_reconciliations"
  ADD CONSTRAINT "payment_reconciliations_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
