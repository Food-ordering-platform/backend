import { Router } from "express";
import { RiderController } from "./rider.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Riders
 *   description: Rider order management, earnings, and status
 */

router.use(authMiddleware);

// ─────────────────────────────────────────────
// ORDER MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @swagger
 * /rider/orders/available:
 *   get:
 *     summary: Get all orders available for pickup
 *     description: |
 *       Returns the pool of orders with status `READY_FOR_PICKUP` that have no assigned rider.
 *       Returns an empty array if the rider is offline or already has an active order.
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available orders (empty if rider is busy or offline)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AvailableOrder'
 *       400:
 *         description: Unauthorized — no rider ID on token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/orders/available", authMiddleware, RiderController.getAvailableOrders);

/**
 * @swagger
 * /rider/orders/active:
 *   get:
 *     summary: Get the rider's current active order
 *     description: Returns the single order currently assigned to the rider with status `RIDER_ACCEPTED` or `OUT_FOR_DELIVERY`. Returns `null` in data if no active order exists.
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active order or null
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/ActiveOrder'
 *                     - type: 'null'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/orders/active", authMiddleware, RiderController.getActiveOrder);

/**
 * @swagger
 * /rider/orders/{id}/accept:
 *   patch:
 *     summary: Accept an available order
 *     description: |
 *       Atomically assigns the order to the rider and sets status to `RIDER_ACCEPTED`.
 *       The rider is marked offline (busy) after accepting.
 *
 *       This uses an atomic DB update to prevent race conditions — if another rider
 *       accepts the same order a split-second earlier, this will return a 400 error.
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
 *         example: clxyz999xyz
 *     responses:
 *       200:
 *         description: Order accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Order accepted
 *                 data:
 *                   $ref: '#/components/schemas/ActiveOrder'
 *       400:
 *         description: Order already taken, rider is busy, or other business rule violation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/orders/:id/accept", authMiddleware, RiderController.acceptOrder);



/**
 * @swagger
 * /rider/orders/{id}/pickup:
 *   patch:
 *     summary: Confirm order pickup from restaurant
 *     description: |
 *       Updates order status to `OUT_FOR_DELIVERY` and credits the vendor's earnings wallet.
 *       A status email is sent to the customer.
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
 *         example: clxyz999xyz
 *     responses:
 *       200:
 *         description: Pickup confirmed, order is now out for delivery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Pickup confirmed. Status updated to OUT_FOR_DELIVERY.
 *                 data:
 *                   $ref: '#/components/schemas/ActiveOrder'
 *       400:
 *         description: Not authorized for this order or invalid state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/orders/:id/pickup", authMiddleware, RiderController.confirmPickup);

/**
 * @swagger
 * /rider/orders/{id}/deliver:
 *   patch:
 *     summary: Confirm delivery using the customer's 4-digit code
 *     description: |
 *       Verifies the customer's delivery OTP and marks the order as `DELIVERED`.
 *       On success:
 *       - Rider's delivery fee is credited to their wallet
 *       - Rider's status is set back to online (available for new orders)
 *       - Customer receives a delivery confirmation email
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
 *         example: clxyz999xyz
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: The 4-digit delivery confirmation code shown to the customer
 *                 example: "4821"
 *     responses:
 *       200:
 *         description: Delivery confirmed and rider earnings credited
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Delivery confirmed. Earnings credited to wallet.
 *                 data:
 *                   $ref: '#/components/schemas/ActiveOrder'
 *       400:
 *         description: Missing code, wrong code, or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/orders/:id/deliver", authMiddleware, RiderController.confirmDelivery);

// ─────────────────────────────────────────────
// EARNINGS & HISTORY
// ─────────────────────────────────────────────

/**
 * @swagger
 * /rider/earnings:
 *   get:
 *     summary: Get wallet balance and transaction history
 *     description: |
 *       Returns a full earnings breakdown:
 *       - `availableBalance` — withdrawable balance (credits minus debits)
 *       - `pendingBalance` — delivery fees for orders currently in progress
 *       - `totalEarnings` — all-time credited amount
 *       - `withdrawn` — all-time debited amount
 *       - `transactions` — full transaction log
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings summary and transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     availableBalance:
 *                       type: number
 *                       example: 12500
 *                     pendingBalance:
 *                       type: number
 *                       description: Earnings locked in active deliveries
 *                       example: 700
 *                     totalEarnings:
 *                       type: number
 *                       example: 45000
 *                     withdrawn:
 *                       type: number
 *                       example: 32500
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/earnings", authMiddleware, RiderController.getEarnings);

/**
 * @swagger
 * /rider/history:
 *   get:
 *     summary: Get completed and cancelled delivery history
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of past deliveries sorted by most recent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeliveryHistoryItem'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/history", authMiddleware, RiderController.getHistory);

// ─────────────────────────────────────────────
// PAYOUT & STATUS
// ─────────────────────────────────────────────

router.post("/payout", authMiddleware, RiderController.requestPayout)

export default router;