/*
  Warnings:

  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebPushSubscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WebPushSubscription" DROP CONSTRAINT "WebPushSubscription_userId_fkey";

-- DropTable
DROP TABLE "public"."Review";

-- DropTable
DROP TABLE "public"."WebPushSubscription";

-- DropTable
DROP TABLE "public"."session";
