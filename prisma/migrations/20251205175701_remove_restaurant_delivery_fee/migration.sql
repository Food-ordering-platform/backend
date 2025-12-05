/*
  Warnings:

  - The values [CONFIRMED,ON_THE_WAY,CANCELLED] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `deliveryFee` on the `Restaurant` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryTime` on the `Restaurant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId]` on the table `Restaurant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deliveryFee` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `menuItemName` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone` on table `Restaurant` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."OrderStatus_new" AS ENUM ('PENDING', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Order" ALTER COLUMN "status" TYPE "public"."OrderStatus_new" USING ("status"::text::"public"."OrderStatus_new");
ALTER TYPE "public"."OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "public"."OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "public"."Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'RIDER';

-- DropForeignKey
ALTER TABLE "public"."MenuCategory" DROP CONSTRAINT "MenuCategory_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MenuItem" DROP CONSTRAINT "MenuItem_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Otp" DROP CONSTRAINT "Otp_userId_fkey";

-- AlterTable
ALTER TABLE "public"."MenuItem" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "deliveryFee" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "deliveryNotes" TEXT,
ADD COLUMN     "token" TEXT;

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "menuItemName" TEXT NOT NULL,
ALTER COLUMN "menuItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Restaurant" DROP COLUMN "deliveryFee",
DROP COLUMN "deliveryTime",
ADD COLUMN     "prepTime" INTEGER NOT NULL DEFAULT 20,
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "isOpen" SET DEFAULT false,
ALTER COLUMN "minimumOrder" SET DEFAULT 0.0;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "phone" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_token_key" ON "public"."Order"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_ownerId_key" ON "public"."Restaurant"("ownerId");

-- AddForeignKey
ALTER TABLE "public"."Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
