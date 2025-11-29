"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("./order.controller");
const router = (0, express_1.Router)();
// Create a new order
router.post("/", order_controller_1.OrderController.createOrder);
// Get all orders for a customer
router.get("/customer/:customerId", order_controller_1.OrderController.getAllOrders);
// Get a single order by reference
router.get("/single/:reference", order_controller_1.OrderController.getSingleOrder);
//Temporal Code
// Get order by token (for restaurant dashboard and customer tracking)
router.get("/token/:token", order_controller_1.OrderController.getOrderByToken);
// Update order status by token (for restaurant dashboard)
router.patch("/token/:token/status", order_controller_1.OrderController.updateOrderStatusByToken);
exports.default = router;
//# sourceMappingURL=order.routes.js.map