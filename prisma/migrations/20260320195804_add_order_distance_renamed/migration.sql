/*
  Warnings:

  - You are about to drop the column `deliveyDistance` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "deliveyDistance",
ADD COLUMN     "deliveryDistance" DOUBLE PRECISION;
