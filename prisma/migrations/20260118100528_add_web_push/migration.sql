-- CreateTable
CREATE TABLE "public"."WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "public"."WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_idx" ON "public"."WebPushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "public"."WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
