import { Router } from "express";
import { OrderController } from "./order.controller";

const router = Router();

// Create a new order
router.post("/", OrderController.createOrder);

router.post("/quote", OrderController.getQuote);

// Get all orders for a customer
router.get("/customer/:customerId", OrderController.getAllOrders);

// Get a single order by reference
router.get("/single/:reference", OrderController.getSingleOrder);

//Get orders for a restaurant
router.get("/restaurant/:restaurantId", OrderController.getVendorOrders)

//Update Order status
router.patch("/:id/status", OrderController.updateOrderStatus)


export default router;
