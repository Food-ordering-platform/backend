/*
  Warnings:

  - Added the required column `deliveryFee` to the `Restaurant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deliveryTime` to the `Restaurant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isOpen` to the `Restaurant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minimumOrder` to the `Restaurant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Restaurant" ADD COLUMN     "deliveryFee" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "deliveryTime" TEXT NOT NULL,
ADD COLUMN     "isOpen" BOOLEAN NOT NULL,
ADD COLUMN     "minimumOrder" DOUBLE PRECISION NOT NULL;
