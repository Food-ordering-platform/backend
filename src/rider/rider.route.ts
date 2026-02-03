import { Router } from "express";
import { RiderController } from "./rider.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

// Apply auth middleware to all rider routes
router.use(authMiddleware);

/**
 * @route   GET /api/rider/orders/available
 * @desc    Get all orders with status READY_FOR_PICKUP (The Pool)
 * @access  Rider
 */
router.get("/orders/available", RiderController.getAvailableOrders);

/**
 * @route   PATCH /api/rider/orders/:id/accept
 * @desc    Accept an order (assigns to rider, status -> RIDER_ACCEPTED)
 * @access  Rider
 */
router.patch("/orders/:id/accept", RiderController.acceptOrder);

/**
 * @route   PATCH /api/rider/orders/:id/reject
 * @desc    Reject/Unassign an order (returns to pool, status -> READY_FOR_PICKUP)
 * @access  Rider
 */
router.patch("/orders/:id/reject", RiderController.rejectOrder);


// Update Status: Pickup
router.patch("/orders/:id/pickup", RiderController.confirmPickup);


// Update Status: Delivery (Send JSON body: { "code": "1234" })
router.patch("/orders/:id/deliver", RiderController.confirmDelivery)

/**
 * @route   GET /api/rider/earnings
 * @desc    Get wallet balance, total earnings, and transaction history
 * @access  Rider
 */
router.get("/earnings", RiderController.getEarnings);

/**
 * @route   POST /api/rider/payout
 * @desc    Request a payout from wallet
 * @access  Rider
 */
router.post("/payout", RiderController.requestPayout);



export default router;