/*
  Warnings:

  - A unique constraint covering the columns `[trackingId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "deliveryCode" TEXT,
ADD COLUMN     "logisticsPartnerId" TEXT,
ADD COLUMN     "trackingId" TEXT;

-- CreateTable
CREATE TABLE "public"."LogisticsPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "LogisticsPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LogisticsPayout" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "partnerId" TEXT NOT NULL,

    CONSTRAINT "LogisticsPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsPartner_secretKey_key" ON "public"."LogisticsPartner"("secretKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingId_key" ON "public"."Order"("trackingId");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_logisticsPartnerId_fkey" FOREIGN KEY ("logisticsPartnerId") REFERENCES "public"."LogisticsPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogisticsPayout" ADD CONSTRAINT "LogisticsPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."LogisticsPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
