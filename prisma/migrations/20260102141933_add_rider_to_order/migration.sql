-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'DISPATCHER';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "riderId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
