/*
  Warnings:

  - You are about to drop the column `secretKey` on the `LogisticsPartner` table. All the data in the column will be lost.
  - You are about to drop the `LogisticsPayout` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `LogisticsPartner` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId]` on the table `LogisticsPartner` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `address` to the `LogisticsPartner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `LogisticsPartner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `LogisticsPartner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `LogisticsPartner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `LogisticsPartner` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."LogisticsPayout" DROP CONSTRAINT "LogisticsPayout_partnerId_fkey";

-- DropIndex
DROP INDEX "public"."LogisticsPartner_secretKey_key";

-- AlterTable
ALTER TABLE "public"."LogisticsPartner" DROP COLUMN "secretKey",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "public"."LogisticsPayout";

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsPartner_email_key" ON "public"."LogisticsPartner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsPartner_ownerId_key" ON "public"."LogisticsPartner"("ownerId");

-- AddForeignKey
ALTER TABLE "public"."LogisticsPartner" ADD CONSTRAINT "LogisticsPartner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
