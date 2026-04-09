-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "logisticsCompanyId" TEXT;

-- CreateTable
CREATE TABLE "public"."LogisticsCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "managerEmail" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "showEarningsToRiders" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsCompany_managerEmail_key" ON "public"."LogisticsCompany"("managerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsCompany_inviteCode_key" ON "public"."LogisticsCompany"("inviteCode");

-- CreateIndex
CREATE INDEX "LogisticsCompany_inviteCode_idx" ON "public"."LogisticsCompany"("inviteCode");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_logisticsCompanyId_fkey" FOREIGN KEY ("logisticsCompanyId") REFERENCES "public"."LogisticsCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
