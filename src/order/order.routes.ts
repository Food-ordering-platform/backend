import { Router } from "express";
import { OrderController } from "./order.controller";

const router = Router();

// Create a new order
router.post("/", OrderController.createOrder);

// Get all orders for a customer
router.get("/customer/:customerId", OrderController.getAllOrders);

// Get a single order by reference
router.get("/single/:reference", OrderController.getSingleOrder);

//Temporal Code

// Get order by token (for restaurant dashboard and customer tracking)
router.get("/token/:token", OrderController.getOrderByToken);

// Update order status by token (for restaurant dashboard)
router.patch("/token/:token/status", OrderController.updateOrderStatusByToken);

export default router;
