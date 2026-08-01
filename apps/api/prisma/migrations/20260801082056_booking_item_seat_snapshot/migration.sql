/*
  Warnings:

  - Added the required column `seatId` to the `booking_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "booking_items" ADD COLUMN     "seatId" UUID NOT NULL;
