import { Router } from "express";
import { OrderController } from "./order.controller";
import { authMiddleware } from "../auth/auth.middleware"; // 👈 Import Middleware

const router = Router();

// Apply middleware globally to all order routes (Optional, or add per route)
// router.use(authMiddleware); 

// 1. Create Order (Must be a logged-in User)
router.post("/", authMiddleware, OrderController.createOrder);

// 2. Get Quote (Can be Public if you allow guest checkout, otherwise Private)
router.post("/quote", authMiddleware, OrderController.getQuote); 

// 3. Customer History (Strictly Private)
router.get("/customer/:customerId", authMiddleware, OrderController.getAllOrders);

// 4. Track Order (Strictly Private)
router.get("/single/:reference", authMiddleware, OrderController.getSingleOrder);

// 5. Vendor Dashboard (Strictly Private)
router.get("/restaurant/:restaurantId", authMiddleware, OrderController.getVendorOrders);

// 6. Update Status (CRITICAL SECURITY - Only Riders/Vendors)
router.patch("/:id/status", authMiddleware, OrderController.updateOrderStatus);

router.post("/:id/accept", authMiddleware, OrderController.acceptOrder);

router.post("/:id/complete", authMiddleware, OrderController.completeOrder);

router.get("/rider/stats", authMiddleware, OrderController.getRiderStats);

//7
router.post("/:id/rate", authMiddleware, OrderController.rateOrder);

export default router;