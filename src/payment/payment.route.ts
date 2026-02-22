import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { authMiddleware } from "../auth/auth.middleware";
import bodyParser from "body-parser";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment verification, webhooks, and bank utilities
 */

/**
 * @swagger
 * /payment/webhook:
 *   post:
 *     summary: Paystack webhook receiver
 *     description: |
 *       Receives real-time payment events directly from Paystack's servers.
 *       **Do not call this endpoint from the frontend or add a JWT token** —
 *       Paystack does not send one.
 *
 *       Handled events:
 *       - `charge.success` — marks the order as `PAID`, sends confirmation email and vendor push notification
 *       - `charge.failed` — marks the order `paymentStatus` as `FAILED`
 *
 *       Requests are authenticated via HMAC-SHA512 signature verification using the
 *       `x-paystack-signature` header. Invalid signatures are rejected with `403`.
 *
 *       Always returns `200` to Paystack even on internal errors — this prevents
 *       Paystack from retrying events unnecessarily.
 *     tags: [Payments]
 *     parameters:
 *       - in: header
 *         name: x-paystack-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC-SHA512 signature of the raw request body, signed with your Paystack secret key
 *         example: 3c4e5f6a7b8c...
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [charge.success, charge.failed]
 *                 example: charge.success
 *               data:
 *                 type: object
 *                 properties:
 *                   reference:
 *                     type: string
 *                     description: The order reference that was paid
 *                     example: a3f8c2d1e9b7
 *                   status:
 *                     type: string
 *                     example: success
 *                   amount:
 *                     type: integer
 *                     description: Amount in Kobo
 *                     example: 380000
 *     responses:
 *       200:
 *         description: Event received and processed (always returned to prevent Paystack retries)
 *       400:
 *         description: Missing signature or body
 *       403:
 *         description: Invalid HMAC signature — request did not originate from Paystack
 */
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  PaymentController.webhook
);

/**
 * @swagger
 * /payment/verify/{reference}:
 *   get:
 *     summary: Verify a payment by order reference
 *     description: |
 *       Called by the frontend after Paystack redirects the user back to the app.
 *       Performs a server-to-server verification with Paystack to confirm the payment status.
 *
 *       - If `success` — delegates to `OrderService.processSuccessfulPayment` (idempotent, safe to call multiple times)
 *       - If `failed` or `pending` — updates `paymentStatus` directly
 *
 *       Note: The webhook and this endpoint may both fire for the same payment.
 *       The service layer handles this safely via idempotency checks.
 *     tags: [Payments]
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
 *         description: Verification result from Paystack
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: True if Paystack reports the transaction as successful
 *                   example: true
 *                 transactionData:
 *                   type: object
 *                   description: Raw Paystack transaction object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [success, failed, pending, abandoned]
 *                       example: success
 *                     reference:
 *                       type: string
 *                       example: a3f8c2d1e9b7
 *                     amount:
 *                       type: integer
 *                       description: Amount in Kobo
 *                       example: 380000
 *                     paid_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-06-01T12:05:00.000Z
 *                     channel:
 *                       type: string
 *                       example: card
 *                     currency:
 *                       type: string
 *                       example: NGN
 *       404:
 *         description: Order with this reference not found
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
 *         description: Paystack verification failed or server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/verify/:reference", authMiddleware, PaymentController.verify);

/**
 * @swagger
 * /payment/banks:
 *   get:
 *     summary: Get a list of supported Nigerian banks
 *     description: |
 *       Fetches the full list of NGN-supported banks from Paystack.
 *       Used to populate the bank selector in payout forms for both riders and vendors.
 *
 *       If the Paystack API is unavailable, falls back to a hardcoded list of major banks
 *       (GTBank, Access, Zenith, UBA, First Bank, OPay, PalmPay, Kuda).
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of banks with their Paystack codes
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
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: GTBank
 *                       code:
 *                         type: string
 *                         description: Bank code used in payout requests
 *                         example: "058"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to fetch banks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/banks", authMiddleware, PaymentController.getBanks);

export default router;