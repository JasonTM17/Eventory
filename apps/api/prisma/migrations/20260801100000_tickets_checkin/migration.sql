-- Add opaque, rotatable QR material to tickets. Existing tickets are backfilled
-- before the columns become required so this migration is safe on a live database.
ALTER TABLE "tickets" ADD COLUMN "qrNonce" VARCHAR(80);
UPDATE "tickets" SET "qrNonce" = gen_random_uuid()::text WHERE "qrNonce" IS NULL;
ALTER TABLE "tickets" ALTER COLUMN "qrNonce" SET NOT NULL;
ALTER TABLE "tickets" ADD COLUMN "qrKeyVersion" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "tickets_qrNonce_key" ON "tickets"("qrNonce");

-- One ticket may be successfully checked in at most once. Scanner identity is
-- nullable so deleting a user does not destroy the attendance audit trail.
CREATE TABLE "ticket_check_ins" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "eventSessionId" UUID NOT NULL,
    "scannerUserId" UUID,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_check_ins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_check_ins_ticketId_key" ON "ticket_check_ins"("ticketId");
CREATE INDEX "ticket_check_ins_eventSessionId_checkedInAt_idx" ON "ticket_check_ins"("eventSessionId", "checkedInAt");
CREATE INDEX "ticket_check_ins_scannerUserId_checkedInAt_idx" ON "ticket_check_ins"("scannerUserId", "checkedInAt");

ALTER TABLE "ticket_check_ins" ADD CONSTRAINT "ticket_check_ins_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_check_ins" ADD CONSTRAINT "ticket_check_ins_eventSessionId_fkey"
  FOREIGN KEY ("eventSessionId") REFERENCES "event_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_check_ins" ADD CONSTRAINT "ticket_check_ins_scannerUserId_fkey"
  FOREIGN KEY ("scannerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
