import { Router } from "express";
import { OrderController } from "./order.controller";

const router = Router();

// Create a new order
router.post("/", OrderController.createOrder);

// Get all orders for a customer
router.get("/customer/:customerId", OrderController.getAllOrders);

// Get a single order by reference
router.get("/single/:reference", OrderController.getSingleOrder);

export default router;
