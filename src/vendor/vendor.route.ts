import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware"; // 👈 Import Middleware
import { VendorController } from "./vendor.controller";

const router = Router();

//1.Get vendor orders
router.get("/restaurant/:restaurantId", authMiddleware, VendorController.getVendorOrders);

//2.Update order status
router.patch("/:id/status", authMiddleware, VendorController.updateOrderStatus);




export default router