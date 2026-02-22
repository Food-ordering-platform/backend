import { Router } from "express";
import { OrderController } from "./order.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order placement, tracking, and management
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order and initialize payment
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: idempotency-key
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional idempotency key to prevent duplicate orders on retry
 *         example: order-uuid-abc-123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - restaurantId
 *               - deliveryAddress
 *               - items
 *               - name
 *               - email
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: clxyz123abc
 *               restaurantId:
 *                 type: string
 *                 example: clxyz456def
 *               deliveryAddress:
 *                 type: string
 *                 example: 12 Main Street, Lagos
 *               deliveryPhoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               deliveryNotes:
 *                 type: string
 *                 example: Leave at the gate
 *               deliveryLatitude:
 *                 type: number
 *                 format: float
 *                 example: 6.5244
 *               deliveryLongitude:
 *                 type: number
 *                 format: float
 *                 example: 3.3792
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - menuItemId
 *                     - quantity
 *                   properties:
 *                     menuItemId:
 *                       type: string
 *                       example: clxyz789ghi
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *               name:
 *                 type: string
 *                 description: Customer's full name (used for payment gateway)
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer's email (used for payment gateway)
 *                 example: john@example.com
 *               idempotencyKey:
 *                 type: string
 *                 description: Can also be passed in the body instead of the header
 *                 example: order-uuid-abc-123
 *     responses:
 *       201:
 *         description: Order created and payment initialized
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
 *                     orderId:
 *                       type: string
 *                       example: clxyz999xyz
 *                     reference:
 *                       type: string
 *                       example: a3f8c2d1e9b7
 *                     checkoutUrl:
 *                       type: string
 *                       description: Paystack/Flutterwave redirect URL to complete payment
 *                       example: https://checkout.paystack.com/xyz
 *                     amounts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 4700
 *                         delivery:
 *                           type: number
 *                           example: 700
 *       400:
 *         description: Missing required fields
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
router.post("/", authMiddleware, OrderController.createOrder);

/**
 * @swagger
 * /orders/quote:
 *   post:
 *     summary: Get a price quote before placing an order
 *     description: Calculates subtotal, delivery fee (based on haversine distance), platform fee, and total. Use this before creating an order to show the customer a breakdown.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - deliveryLatitude
 *               - deliveryLongitude
 *               - items
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 example: clxyz456def
 *               deliveryLatitude:
 *                 type: number
 *                 format: float
 *                 example: 6.5244
 *               deliveryLongitude:
 *                 type: number
 *                 format: float
 *                 example: 3.3792
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - price
 *                     - quantity
 *                   properties:
 *                     price:
 *                       type: number
 *                       example: 1500
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *     responses:
 *       200:
 *         description: Price quote calculated successfully
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
 *                     subtotal:
 *                       type: number
 *                       example: 3000
 *                     deliveryFee:
 *                       type: number
 *                       example: 700
 *                     platformFee:
 *                       type: number
 *                       example: 100
 *                     totalAmount:
 *                       type: number
 *                       example: 3800
 *                     distanceKm:
 *                       type: number
 *                       example: 4.73
 *       400:
 *         description: Missing location or items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Restaurant location unavailable or server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/quote", authMiddleware, OrderController.getQuote);

/**
 * @swagger
 * /orders/customer/{customerId}:
 *   get:
 *     summary: Get all orders for a customer
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer's user ID
 *         example: clxyz123abc
 *     responses:
 *       200:
 *         description: List of orders for the customer, sorted newest first
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
 *                     $ref: '#/components/schemas/OrderSummary'
 *       400:
 *         description: Customer ID is required
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
router.get("/customer/:customerId", authMiddleware, OrderController.getAllOrders);

/**
 * @swagger
 * /orders/single/{reference}:
 *   get:
 *     summary: Get a single order by its payment reference
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique order payment reference
 *         example: a3f8c2d1e9b7
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/OrderDetail'
 *       400:
 *         description: Reference is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Order not found
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
router.get("/single/:reference", authMiddleware, OrderController.getSingleOrder);

/**
 * @swagger
 * /orders/{id}/rate:
 *   post:
 *     summary: Rate and review an order's restaurant
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID to rate
 *         example: clxyz999xyz
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 4
 *               comment:
 *                 type: string
 *                 example: Great food, fast delivery!
 *     responses:
 *       200:
 *         description: Review submitted successfully
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
 *                     id:
 *                       type: string
 *                       example: clxyz111rev
 *                     rating:
 *                       type: integer
 *                       example: 4
 *                     comment:
 *                       type: string
 *                       example: Great food, fast delivery!
 *       400:
 *         description: Validation error or review already submitted
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
router.post("/:id/rate", authMiddleware, OrderController.rateOrder);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxyz999xyz
 *         reference:
 *           type: string
 *           example: a3f8c2d1e9b7
 *         totalAmount:
 *           type: number
 *           example: 3800
 *         deliveryFee:
 *           type: number
 *           example: 700
 *         paymentStatus:
 *           type: string
 *           enum: [PENDING, PAID, REFUNDED]
 *           example: PAID
 *         status:
 *           type: string
 *           enum: [PENDING, PREPARING, READY, IN_TRANSIT, DELIVERED, CANCELLED]
 *           example: PREPARING
 *         checkoutUrl:
 *           type: string
 *           example: https://checkout.paystack.com/xyz
 *         restaurant:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: Mama's Kitchen
 *             imageUrl:
 *               type: string
 *               example: https://cdn.example.com/restaurant.jpg
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
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2024-06-01T12:00:00.000Z
 *
 *     OrderDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: clxyz999xyz
 *         reference:
 *           type: string
 *           example: a3f8c2d1e9b7
 *         totalAmount:
 *           type: number
 *           example: 3800
 *         deliveryFee:
 *           type: number
 *           example: 700
 *         paymentStatus:
 *           type: string
 *           enum: [PENDING, PAID, REFUNDED]
 *           example: PAID
 *         status:
 *           type: string
 *           enum: [PENDING, PREPARING, READY, IN_TRANSIT, DELIVERED, CANCELLED]
 *           example: DELIVERED
 *         deliveryAddress:
 *           type: string
 *           example: 12 Main Street, Lagos
 *         deliveryNotes:
 *           type: string
 *           nullable: true
 *           example: Leave at the gate
 *         restaurant:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: Mama's Kitchen
 *             address:
 *               type: string
 *               example: 5 Food Court, Lekki
 *             phone:
 *               type: string
 *               example: "+2348099999999"
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               menuItemId:
 *                 type: string
 *                 example: clxyz789ghi
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