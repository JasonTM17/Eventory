CREATE TYPE "PaymentWebhookInboxStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED');

ALTER TABLE "payments"
  ADD COLUMN "providerAttemptId" UUID;

CREATE INDEX "payments_providerAttemptId_idx"
  ON "payments"("providerAttemptId");

CREATE TABLE "payment_webhook_inbox" (
  "id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "providerEventId" VARCHAR(160) NOT NULL,
  "eventType" VARCHAR(80) NOT NULL,
  "reference" VARCHAR(160) NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "PaymentWebhookInboxStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "payment_webhook_inbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_inbox_provider_providerEventId_key"
  ON "payment_webhook_inbox"("provider", "providerEventId");
CREATE INDEX "payment_webhook_inbox_status_receivedAt_idx"
  ON "payment_webhook_inbox"("status", "receivedAt");
