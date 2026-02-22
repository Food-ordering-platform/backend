import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import { VendorController } from "./vendor.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Vendors
 *   description: Vendor order management, earnings, and payouts
 */

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────

/**
 * @swagger
 * /vendor/{restaurantId}/orders:
 *   get:
 *     summary: Get all paid orders for a restaurant
 *     description: Returns orders with `paymentStatus` of `PAID` or `REFUNDED`, sorted newest first. Includes customer details, rider info, and a computed `vendorFoodTotal` (vendor's share after fees).
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: The restaurant ID
 *         example: clxyz456def
 *     responses:
 *       200:
 *         description: List of orders for the vendor's dashboard
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
 *                     $ref: '#/components/schemas/VendorOrder'
 *       400:
 *         description: Restaurant not found
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
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:restaurantId/orders", authMiddleware, VendorController.getVendorOrders);

/**
 * @swagger
 * /vendor/order/{id}/accept:
 *   patch:
 *     summary: Accept an order and start preparing
 *     description: |
 *       Transitions order status from `PENDING` → `PREPARING`.
 *
 *       On success:
 *       - Customer receives a push notification
 *       - Customer receives their 4-digit delivery code by email
 *       - Customer receives an order status email
 *     tags: [Vendors]
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
 *         description: Order accepted and kitchen notified
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
 *                   $ref: '#/components/schemas/VendorOrder'
 *       400:
 *         description: Order not found, already processed, or vendor is not the owner
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
router.patch("/order/:id/accept", authMiddleware, VendorController.acceptOrder);

/**
 * @swagger
 * /vendor/order/{id}/request-rider:
 *   patch:
 *     summary: Mark food as ready and request a rider
 *     description: |
 *       Transitions order status from `PREPARING` → `READY_FOR_PICKUP`.
 *
 *       On success:
 *       - Vendor's earnings are credited to their wallet (atomically)
 *       - All online riders receive a push notification about the new pickup
 *       - Customer receives a status update email
 *     tags: [Vendors]
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
 *         description: Order marked ready and riders notified
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
 *                   example: Riders have been notified
 *                 data:
 *                   $ref: '#/components/schemas/VendorOrder'
 *       400:
 *         description: Order must be in PREPARING state, or unauthorized
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
router.patch("/order/:id/request-rider", authMiddleware, VendorController.requestRider);

/**
 * @swagger
 * /vendor/order/{id}/cancel:
 *   patch:
 *     summary: Cancel an order
 *     description: |
 *       Cancels the order and issues a refund if payment was already made.
 *
 *       Cannot cancel orders with status `OUT_FOR_DELIVERY` or `DELIVERED`.
 *       If `paymentStatus` is `PAID`, a Paystack refund is automatically initiated
 *       and `paymentStatus` is updated to `REFUNDED`.
 *     tags: [Vendors]
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
 *         description: Order cancelled (and refunded if applicable)
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
 *                   example: Order cancelled
 *                 data:
 *                   $ref: '#/components/schemas/VendorOrder'
 *       400:
 *         description: Order cannot be cancelled at this stage, or unauthorized
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
router.patch("/order/:id/cancel", authMiddleware, VendorController.cancelOrder);

// ─────────────────────────────────────────────
// EARNINGS & TRANSACTIONS
// ─────────────────────────────────────────────

/**
 * @swagger
 * /vendor/earnings:
 *   get:
 *     summary: Get the vendor's wallet balance and earnings summary
 *     description: |
 *       Returns a full earnings breakdown:
 *       - `availableBalance` — withdrawable balance (credits minus debits)
 *       - `pendingBalance` — estimated earnings from orders currently in `PREPARING`
 *       - `totalEarnings` — all-time credited amount
 *       - `withdrawn` — all-time debited amount
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings summary
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
 *                       example: 85000
 *                     pendingBalance:
 *                       type: number
 *                       description: Estimated share from orders still being prepared
 *                       example: 3400
 *                     totalEarnings:
 *                       type: number
 *                       example: 210000
 *                     withdrawn:
 *                       type: number
 *                       example: 125000
 *                     currency:
 *                       type: string
 *                       example: NGN
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
router.get("/earnings", authMiddleware, VendorController.getEarnings);

/**
 * @swagger
 * /vendor/transactions:
 *   get:
 *     summary: Get the vendor's transaction history
 *     description: Returns the 50 most recent transactions for the authenticated vendor, sorted newest first.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction history
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
 *                     $ref: '#/components/schemas/Transaction'
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
router.get("/transactions", authMiddleware, VendorController.getTransactions);

/**
 * @swagger
 * /vendor/payout:
 *   post:
 *     summary: Request a payout from the vendor's wallet
 *     description: |
 *       Validates the bank account via Paystack, creates a debit transaction, and initiates a transfer.
 *       Unlike the rider payout, this does **not** silently fall back to manual — if the Paystack
 *       transfer fails, the entire request fails and the transaction is rolled back.
 *
 *       Minimum withdrawal: ₦100. Amount must not exceed available balance.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - bankDetails
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to withdraw in Naira (min ₦100)
 *                 example: 10000
 *               bankDetails:
 *                 type: object
 *                 required:
 *                   - accountNumber
 *                   - bankName
 *                 properties:
 *                   accountNumber:
 *                     type: string
 *                     example: "0123456789"
 *                   bankName:
 *                     type: string
 *                     description: Paystack bank code (e.g. "058" for GTBank)
 *                     example: "058"
 *     responses:
 *       201:
 *         description: Payout initiated successfully
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
 *                   example: Payout request submitted
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Insufficient balance, invalid amount, bad bank details, or transfer failure
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
router.post("/payout", authMiddleware, VendorController.requestPayout);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     VendorOrder:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxyz999xyz
 *         reference:
 *           type: string
 *           example: a3f8c2d1e9b7
 *         status:
 *           type: string
 *           enum: [PENDING, PREPARING, READY_FOR_PICKUP, RIDER_ACCEPTED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED]
 *           example: PREPARING
 *         paymentStatus:
 *           type: string
 *           enum: [PENDING, PAID, REFUNDED]
 *           example: PAID
 *         totalAmount:
 *           type: number
 *           example: 3800
 *         deliveryFee:
 *           type: number
 *           example: 700
 *         vendorFoodTotal:
 *           type: number
 *           description: Computed vendor share after platform fee and delivery fee deductions (85% of food revenue)
 *           example: 2550
 *         deliveryAddress:
 *           type: string
 *           example: 12 Main Street, Lagos
 *         riderName:
 *           type: string
 *           nullable: true
 *           example: James Rider
 *         riderPhone:
 *           type: string
 *           nullable: true
 *           example: "+2348011111111"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         customer:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: John Doe
 *             phone:
 *               type: string
 *               nullable: true
 *               example: "+2348012345678"
 *             address:
 *               type: string
 *               nullable: true
 *               example: 12 Main Street, Lagos
 *         rider:
 *           type: object
 *           nullable: true
 *           properties:
 *             name:
 *               type: string
 *               example: James Rider
 *             phone:
 *               type: string
 *               nullable: true
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               menuItemName:
 *                 type: string
 *                 example: Jollof Rice
 *               quantity:
 *                 type: integer
 *                 example: 2
 *               price:
 *                 type: number
 *                 example: 1500
 */



