/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "public"."Transaction"("reference");
