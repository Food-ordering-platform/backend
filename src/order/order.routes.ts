import { Router } from "express";
import { OrderController } from "./order.controller";

const router = Router();

// Orders
router.post("/", OrderController.createOrder);

// Get all orders for a customer
router.get("/customer/:customerId", OrderController.getAllOrders);

// Get a single order by ID
router.get("/single/:orderId", OrderController.getSingleOrderById);

export default router;
