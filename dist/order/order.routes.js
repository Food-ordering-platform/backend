"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("./order.controller");
const auth_middleware_1 = require("../auth/auth.middleware"); // 👈 Import Middleware
const router = (0, express_1.Router)();
// Apply middleware globally to all order routes (Optional, or add per route)
// router.use(authMiddleware); 
// 1. Create Order (Must be a logged-in User)
router.post("/", auth_middleware_1.authMiddleware, order_controller_1.OrderController.createOrder);
// 2. Get Quote (Can be Public if you allow guest checkout, otherwise Private)
router.post("/quote", auth_middleware_1.authMiddleware, order_controller_1.OrderController.getQuote);
// 3. Customer History (Strictly Private)
router.get("/customer/:customerId", auth_middleware_1.authMiddleware, order_controller_1.OrderController.getAllOrders);
// 4. Track Order (Strictly Private)
router.get("/single/:reference", auth_middleware_1.authMiddleware, order_controller_1.OrderController.getSingleOrder);
// 5. Vendor Dashboard (Strictly Private)
router.get("/restaurant/:restaurantId", auth_middleware_1.authMiddleware, order_controller_1.OrderController.getVendorOrders);
// 6. Update Status (CRITICAL SECURITY - Only Riders/Vendors)
router.patch("/:id/status", auth_middleware_1.authMiddleware, order_controller_1.OrderController.updateOrderStatus);
//7
router.post("/:id/rate", auth_middleware_1.authMiddleware, order_controller_1.OrderController.rateOrder);
exports.default = router;
//# sourceMappingURL=order.routes.js.map