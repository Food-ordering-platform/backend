import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware"; // 👈 Import Middleware
import { VendorController } from "./vendor.controller";

const router = Router();

//1.Get vendor orders
router.get("/vendor/:vendorId/orders", authMiddleware, VendorController.getVendorOrders);

//2.Update order status

router.get("/transactions", authMiddleware, VendorController.getTransactions);
router.patch("/order/:id/accept", authMiddleware, VendorController.acceptOrder);
router.patch("/order/:id/request-rider", authMiddleware, VendorController.requestRider);
router.patch("/order/:id/cancel", authMiddleware, VendorController.cancelOrder);


// Earnings
router.get("/earnings", authMiddleware, VendorController.getEarnings);
router.post("/payout", authMiddleware, VendorController.requestPayout);



export default router