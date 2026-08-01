/*
  Warnings:

  - Added the required column `holdId` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "holdId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "bookings_holdId_idx" ON "bookings"("holdId");
