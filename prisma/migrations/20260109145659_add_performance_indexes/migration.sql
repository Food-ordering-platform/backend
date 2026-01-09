-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_idx" ON "public"."MenuItem"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_restaurantId_idx" ON "public"."Order"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "public"."Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "public"."Order"("paymentStatus");
