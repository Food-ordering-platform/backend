-- CreateIndex
CREATE INDEX "MenuCategory_restaurantId_idx" ON "public"."MenuCategory"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "public"."MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_available_deletedAt_idx" ON "public"."MenuItem"("available", "deletedAt");

-- CreateIndex
CREATE INDEX "Order_riderId_idx" ON "public"."Order"("riderId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "public"."Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "public"."OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Otp_userId_code_idx" ON "public"."Otp"("userId", "code");

-- CreateIndex
CREATE INDEX "Otp_expiresAt_idx" ON "public"."Otp"("expiresAt");

-- CreateIndex
CREATE INDEX "Restaurant_isOpen_idx" ON "public"."Restaurant"("isOpen");

-- CreateIndex
CREATE INDEX "Restaurant_rating_idx" ON "public"."Restaurant"("rating");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "public"."Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_orderId_idx" ON "public"."Transaction"("orderId");

-- CreateIndex
CREATE INDEX "Transaction_status_type_idx" ON "public"."Transaction"("status", "type");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "public"."Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE INDEX "User_isOnline_idx" ON "public"."User"("isOnline");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "public"."User"("phone");
