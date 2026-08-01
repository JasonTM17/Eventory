-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SALES_OPEN', 'SALES_CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SeatAllocationStatus" AS ENUM ('AVAILABLE', 'BLOCKED', 'SOLD');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "ownerId" UUID;

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_sections" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "venue_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "rowLabel" VARCHAR(30) NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "code" VARCHAR(80) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "venueId" UUID,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "description" TEXT,
    "timezone" VARCHAR(64) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_sessions" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "salesStartAt" TIMESTAMP(3) NOT NULL,
    "salesEndAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "capacity" INTEGER NOT NULL,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_allocations" (
    "id" UUID NOT NULL,
    "eventSessionId" UUID NOT NULL,
    "seatId" UUID NOT NULL,
    "ticketTypeId" UUID,
    "status" "SeatAllocationStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "seat_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venues_organizationId_createdAt_idx" ON "venues"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "venue_sections_venueId_sortOrder_idx" ON "venue_sections"("venueId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "venue_sections_venueId_name_key" ON "venue_sections"("venueId", "name");

-- CreateIndex
CREATE INDEX "seats_venueId_sectionId_idx" ON "seats"("venueId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "seats_venueId_code_key" ON "seats"("venueId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "seats_sectionId_rowLabel_seatNumber_key" ON "seats"("sectionId", "rowLabel", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_startAt_idx" ON "events"("status", "startAt");

-- CreateIndex
CREATE INDEX "events_organizationId_status_startAt_idx" ON "events"("organizationId", "status", "startAt");

-- CreateIndex
CREATE INDEX "event_sessions_eventId_startAt_idx" ON "event_sessions"("eventId", "startAt");

-- CreateIndex
CREATE INDEX "event_sessions_salesStartAt_salesEndAt_idx" ON "event_sessions"("salesStartAt", "salesEndAt");

-- CreateIndex
CREATE INDEX "ticket_types_eventId_priceMinor_idx" ON "ticket_types"("eventId", "priceMinor");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_types_eventId_name_key" ON "ticket_types"("eventId", "name");

-- CreateIndex
CREATE INDEX "seat_allocations_eventSessionId_status_idx" ON "seat_allocations"("eventSessionId", "status");

-- CreateIndex
CREATE INDEX "seat_allocations_ticketTypeId_status_idx" ON "seat_allocations"("ticketTypeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seat_allocations_eventSessionId_seatId_key" ON "seat_allocations"("eventSessionId", "seatId");

-- CreateIndex
CREATE INDEX "organizations_ownerId_idx" ON "organizations"("ownerId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_sections" ADD CONSTRAINT "venue_sections_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "venue_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sessions" ADD CONSTRAINT "event_sessions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_allocations" ADD CONSTRAINT "seat_allocations_eventSessionId_fkey" FOREIGN KEY ("eventSessionId") REFERENCES "event_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_allocations" ADD CONSTRAINT "seat_allocations_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_allocations" ADD CONSTRAINT "seat_allocations_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
