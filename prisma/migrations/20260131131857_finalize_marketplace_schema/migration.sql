/*
  Warnings:

  - The values [DISPATCHER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `logisticsPartnerId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `trackingId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the `LogisticsPartner` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE 'RIDER_ACCEPTED';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."Role_new" AS ENUM ('CUSTOMER', 'VENDOR', 'ADMIN', 'RIDER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."Role_new" USING ("role"::text::"public"."Role_new");
ALTER TYPE "public"."Role" RENAME TO "Role_old";
ALTER TYPE "public"."Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."LogisticsPartner" DROP CONSTRAINT "LogisticsPartner_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_logisticsPartnerId_fkey";

-- DropIndex
DROP INDEX "public"."Order_trackingId_key";

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "logisticsPartnerId",
DROP COLUMN "trackingId";

-- DropTable
DROP TABLE "public"."LogisticsPartner";
