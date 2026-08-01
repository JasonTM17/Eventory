/*
  Warnings:

  - Added the required column `updatedAt` to the `outbox_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
